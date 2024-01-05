const express = require("express")
const http = require("http")
const socketio = require("socket.io")
const BadWordsFilter = require("bad-words")
const path = require("path")
const fs = require("fs")

const app = express()
const url = "https://word-ending-game.onrender.com"
// const url = "http://localhost:3000"
const server = http.createServer(app)
const io = socketio(server, {
    cors: {
        origin: url
    }
})
const badWordsFilter = new BadWordsFilter()

app.use(express.static("public"))

const word_strings = fs.readFileSync("data/words.txt", "utf8").split("\r\n")
const words = {}
for (const word of word_strings) {
    if (word.length > 2) words[word] = true
}

const id_to_name = {}
const game_hosts = {}
const game_types = {}
const game_players = {}
const game_turns = {}
const game_words = {}
const last_players = {}
io.on("connection", (socket) => {
    let game_id
    let socket_id
    socket.on("join_game", async (name, _game_id, _game_type) => {
        game_id = _game_id
        socket_id = socket.id
        console.log()
        if (!game_types[game_id]) game_types[game_id] = _game_type
        if (name.length && badWordsFilter.clean(name) === name) {
            id_to_name[socket.id] = name
            socket.join(game_id)
            if (!game_hosts[game_id]) {
                game_hosts[game_id] = socket.id
            }
            io.to(game_id).emit("players", (await io.in(game_id).fetchSockets()).map((socket) => game_hosts[game_id] === socket.id ? id_to_name[socket.id] + " (host)" : id_to_name[socket.id]))
            game_players[game_id] = (await io.in(game_id).fetchSockets()).map((socket) => id_to_name[socket.id])
        } 
    })

    socket.on("request_welcome", async (_game_id) => {
        game_id = _game_id
        if (game_hosts[_game_id] && game_types[game_id]) {
            console.log("rwgt", game_types[game_id])
            socket.emit("welcome", id_to_name[game_hosts[game_id]], game_types[game_id])
            socket.emit("players", [...(await io.in(game_id).fetchSockets()).map((socket) => game_hosts[game_id] === socket.id ? id_to_name[socket.id] + " (host)" : id_to_name[socket.id])])
        }
    })

    socket.on("disconnect", async () => {
        delete id_to_name[socket_id]
        if (socket_id === game_hosts[game_id]) {
            delete game_hosts[game_id]
        }
        io.to(game_id).emit("players", (await io.in(game_id).fetchSockets()).map((socket) => game_hosts[game_id] === socket.id ? id_to_name[socket.id] + " (host)" : id_to_name[socket.id]))
    })

    socket.on("request_start_game", async () => {
        if (socket.id !== game_hosts[game_id]) return
        console.log("hi", game_players)
        game_players[game_id] = shuffleArray(game_players[game_id])
        game_turns[game_id] = 0
        game_words[game_id] = ""
        io.to(game_id).emit("start_game")
    })

    socket.on("join_1d_game", async (name, _game_id) => {
        console.log("join_1d_game", name, _game_id)
        game_id = _game_id
        if (!game_players[game_id]) return
        socket_id = socket.id
        socket.join(game_id)
        id_to_name[socket.id] = name
        console.log("game_players", game_players, game_players[game_id])
        io.to(game_id).emit("players", game_players[game_id])
        socket.emit("turn", game_turns[game_id])
        socket.emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `Welcome to game '${game_id}'`
        })
        socket.emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `${game_players[game_id][game_turns[game_id] % game_players[game_id].length]}, it's your turn!`
        })
        socket.emit("word", game_words[game_id])
    })

    socket.on("play_letter_1d", (letter, position) => {
        console.log(letter, position)
        if (typeof letter !== "string") return
        console.log("is string")
        if (letter.length !== 1) return
        console.log("1 long")
        if (!letter.match(/[a-z]/i) && !letter.match(/[A-Z]/i)) return
        console.log("is a to z")
        console.log("name", id_to_name[socket.id])
        console.log("cplayer", game_players[game_id][game_turns[game_id] % game_players[game_id].length])
        if (id_to_name[socket.id] !== game_players[game_id][game_turns[game_id] % game_players[game_id].length]) return
        console.log("correct player")
        if (position !== "front" && position !== "back") return
        console.log("valid position")
        letter = letter.toUpperCase()
        console.log("waiting...")
        if (position === "front") {
            if (game_words[game_id].length > 2 && words[(letter + game_words[game_id]).toLowerCase()]) {
                console.log("check fail!")
                socket.emit("message", {
                    username: "GameBot",
                    time: Date.now(),
                    text: `${id_to_name[socket_id]}, ${letter + game_words[game_id]} is a word! Choose another letter.`
                })
                return
            }
            game_words[game_id] = letter + game_words[game_id]
        }
        if (position === "back") {
            if (game_words[game_id].length > 2 && words[(game_words[game_id] + letter).toLowerCase()]) {
                console.log("check fail!")
                socket.emit("message", {
                    username: "GameBot",
                    time: Date.now(),
                    text: `${id_to_name[socket_id]}, ${game_words[game_id] + letter} is a word! Choose another letter.`
                })
                return
            }
            game_words[game_id] = game_words[game_id] + letter
        }
        io.to(game_id).emit("word", game_words[game_id])
        console.log("word", game_words[game_id])
        io.to(game_id).emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `${id_to_name[socket.id]} played ${letter} at the ${position}.`
        })
        game_turns[game_id]++
        io.to(game_id).emit("turn", game_turns[game_id])
        console.log("turn", game_turns[game_id])
        io.to(game_id).emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `${game_players[game_id][game_turns[game_id] % game_players[game_id].length]}, it's your turn!`
        })
        last_players[game_id] = socket.id
    })

    socket.on("challenge_1d", () => {
        if (id_to_name[socket.id] !== game_players[game_id][game_turns[game_id] % game_players[game_id].length]) return
        socket.to(last_players[game_id]).emit("challenge_word")
    })

    socket.on("challenge_word_response", (challenge_word) => {
        if (typeof challenge_word !== "string") return
        challenge_word = challenge_word.toUpperCase()
        const current_player = game_players[game_id][game_turns[game_id] % game_players[game_id].length]
        const last_player = id_to_name[last_players[game_id]]
        if (words[challenge_word.toLowerCase()] && challenge_word.includes(game_words[game_id])) {
            io.to(game_id).emit("challenge_outcome", `Since ${last_player}'s word '${challenge_word}' is in the English dictionary and contains the letters played '${game_words[game_id]}, ${current_player}' challenge of ${last_player} was unsuccessful.`)
        } else {
            io.to(game_id).emit("challenge_outcome", `Since ${last_player}'s word '${challenge_word}' is either not in the English dictionary or does not contain the letters played '${game_words[game_id]}, ${current_player}' challenge of ${last_player} was successful.`)
        }
    })

    socket.on("message", (message) => {
        if (message.length > 200) {
            socket.emit("message", {
                username: "GameBot",
                time: Date.now(),
                text: `${id_to_name[socket_id]}, your message was too long and could not be sent.`
            })
            return
        }
        io.to(game_id).emit("message", {
            username: id_to_name[socket.id],
            time: Date.now(),
            text: message,
        })
    })
})

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1))
        let temp = array[i]
        array[i] = array[j]
        array[j] = temp
    }
    return array
}

app.get("/play-1d", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "play-1d.html"))
})

app.get("/play-2d", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "play-2d.html"))
})

const PORT = 3000
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
})

