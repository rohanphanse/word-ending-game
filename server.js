// Imports 
const express = require("express")
const http = require("http")
const socketio = require("socket.io")
const path = require("path")
const fs = require("fs")
require("dotenv").config()

// Initialize server and websocket
const PORT = process.env.PORT || 3000
const URL = process.env.URL || "https://word-ending-game.onrender.com"
// const URL = process.env.URL || "http://localhost:3000"
const app = express()
const server = http.createServer(app)
const io = socketio(server, {
    cors: {
        origin: URL
    }
})
app.use(express.static("public"))

// Prepare word list
const word_strings = fs.readFileSync("data/words.txt", "utf8").split("\r\n")
const words = {}
for (const word of word_strings) {
    if (word.length > 2) words[word] = true
}

// Game data
const id_to_name = {}
const game_ids = {}
const game_hosts = {}
const game_types = {}
const game_players = {}
const game_turns = {}
const game_words = {}
const last_players = {}
const game_points = {}
io.on("connection", (socket) => {
    let game_id
    let socket_id
    
    socket.on("join_game", async (name, _game_id, _game_type) => {
        if (!game_ids[_game_id]) {
            game_id = generateID()
            while (game_ids[game_id]) {
                game_id = generateID()
            }
            game_ids[game_id] = true
            game_players[game_id] = []
            socket.emit("game_id", game_id)
        } else {
            game_id = _game_id
        }
        socket_id = socket.id
        
        // Set game type
        if (!game_types[game_id]) {
            game_types[game_id] = _game_type
        }
        // Check name and add player to game
        if (name.length > 0 && name.length < 20 && !game_players[game_id].includes(name) && !name.includes("(host)")) {
            id_to_name[socket.id] = name
            socket.join(game_id)
            // Add first player as host
            if (!game_hosts[game_id]) {
                game_hosts[game_id] = socket.id
            }
            // Update players 
            io.to(game_id).emit("players", (await io.in(game_id).fetchSockets()).map((socket) => {
                return id_to_name[socket.id] + (game_hosts[game_id] === socket.id ? " (host)" : "")
            }))
            game_players[game_id] = (await io.in(game_id).fetchSockets()).map((socket) => id_to_name[socket.id])
        }
    })

    // Request welcome
    socket.on("request_welcome", async (_game_id) => {
        game_id = _game_id
        if (game_hosts[_game_id] && game_types[game_id]) {
            socket.emit("welcome", id_to_name[game_hosts[game_id]], game_types[game_id])
            socket.emit("players", [...(await io.in(game_id).fetchSockets()).map((socket) => game_hosts[game_id] === socket.id ? id_to_name[socket.id] + " (host)" : id_to_name[socket.id])])
        }
    })

    socket.on("disconnect", async () => {
        // Remove player ID
        if (socket_id === game_hosts[game_id]) {
            game_hosts[game_id] = id_to_name[socket_id]
        }
        delete id_to_name[socket_id]
        // Update players
        io.to(game_id).emit("players", (await io.in(game_id).fetchSockets()).map((socket) => {
            return id_to_name[socket.id] + (game_hosts[game_id] === socket.id ? " (host)" : "")
        }))
    })

    // Request from host to start game
    socket.on("request_start_game", async () => {
        if (socket.id !== game_hosts[game_id]) return
        // Initialize game
        game_players[game_id] = shuffleArray(game_players[game_id])
        game_turns[game_id] = 0
        game_words[game_id] = ""
        io.to(game_id).emit("start_game")
    })

    // Join 1D game
    socket.on("join_1d_game", async (name, _game_id) => {
        game_id = _game_id
        if (!game_players[game_id]) return
        socket_id = socket.id
        socket.join(game_id)
        id_to_name[socket.id] = name
        // Broadcast game start information
        io.to(game_id).emit("players", game_players[game_id])
        socket.emit("turn", game_turns[game_id])
        socket.emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `Welcome to game '${game_id}'`
        })
        const current_player = game_players[game_id][game_turns[game_id] % game_players[game_id].length]
        socket.emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `${current_player}, it's your turn!`
        })
        socket.emit("word", game_words[game_id])
    })

    // Play letter in 1D game
    socket.on("play_letter_1d", (letter, position) => {
        // Validate move
        if (typeof letter !== "string") return
        if (letter.length !== 1) return
        if (!letter.match(/[a-z]/i) && !letter.match(/[A-Z]/i)) return
        const current_player = game_players[game_id][game_turns[game_id] % game_players[game_id].length]
        if (id_to_name[socket.id] !== current_player) return
        if (position !== "front" && position !== "back") return
        letter = letter.toUpperCase()
        if (position === "front") {
            // Letter forms a word
            if (game_words[game_id].length > 2 && words[(letter + game_words[game_id]).toLowerCase()]) {
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
            // Letter forms a word
            if (game_words[game_id].length > 2 && words[(game_words[game_id] + letter).toLowerCase()]) {
                socket.emit("message", {
                    username: "GameBot",
                    time: Date.now(),
                    text: `${id_to_name[socket_id]}, ${game_words[game_id] + letter} is a word! Choose another letter.`
                })
                return
            }
            game_words[game_id] = game_words[game_id] + letter
        }
        // Broadcast move
        io.to(game_id).emit("word", game_words[game_id])
        io.to(game_id).emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `${id_to_name[socket.id]} played ${letter} at the ${position}.`
        })
        // Next turn
        game_turns[game_id]++
        io.to(game_id).emit("turn", game_turns[game_id])
        io.to(game_id).emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `${game_players[game_id][game_turns[game_id] % game_players[game_id].length]}, it's your turn!`
        })
        last_players[game_id] = socket.id
    })

    // Challenge in 1D game
    socket.on("challenge_1d", () => {
        if (game_turns[game_id] < 2) return
        const current_player = game_players[game_id][game_turns[game_id] % game_players[game_id].length]
        if (id_to_name[socket.id] !== current_player) return
        socket.to(last_players[game_id]).emit("challenge_word")
    })

    // Response to challenge in 1D game
    socket.on("challenge_word_response", (challenge_word) => {
        if (typeof challenge_word !== "string") return
        challenge_word = challenge_word.toUpperCase()
        const current_player = game_players[game_id][game_turns[game_id] % game_players[game_id].length]
        const last_player = id_to_name[last_players[game_id]]
        let loser = ""
        if (words[challenge_word.toLowerCase()] && challenge_word.includes(game_words[game_id])) {
            io.to(game_id).emit("challenge_outcome", `Since ${last_player}'s word '${challenge_word}' is in the English dictionary and contains the letters played '${game_words[game_id]}', ${current_player}'s challenge of ${last_player} was unsuccessful.`)
            loser = current_player
        } else {
            io.to(game_id).emit("challenge_outcome", `Since ${last_player}'s word '${challenge_word}' is either not in the English dictionary or does not contain the letters played '${game_words[game_id]}', ${current_player}'s challenge of ${last_player} was successful.`)
            loser = last_player
        }
        if (!game_points[game_id]) {
            game_points[game_id] = {}
            for (const player of game_players[game_id]) {
                game_points[game_id][player] = 0
            }
        }
        for (const player of game_players[game_id]) {
            if (player !== loser) {
                game_points[game_id][player] += 1
            }
        }
        io.to(game_id).emit("game_over", game_points[game_id], loser, game_hosts[game_id]) 
    })

    // Send message in chat
    socket.on("message", (message) => {
        // Exceed message length limit
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

    socket.on("next_game", () => {
        if (id_to_name[socket.id] !== game_hosts[game_id]) return
        // Initialize game
        game_players[game_id] = shuffleArray(game_players[game_id])
        game_turns[game_id] = 0
        game_words[game_id] = ""
        io.to(game_id).emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: "Starting next game..."
        })
        io.to(game_id).emit("word", game_words[game_id])
        io.to(game_id).emit("turn", game_turns[game_id])
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

// Generate random ID with 6 characters
function generateID() {
    let id = ""
    for (let n = 0; n < 6; n++) {
        // Character
        if (Math.random() > 0.5) {
            id += String.fromCharCode(97 + Math.floor(26 * Math.random()))
        // Number
        } else {
            id += Math.floor(Math.random() * 10)
        }
    }
    return id
}

// Play 1D game
app.get("/play-1d", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "play-1d.html"))
})

// Play 2D game
app.get("/play-2d", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "play-2d.html"))
})

server.listen(PORT, () => {
    console.log(`Server listening at ${URL} on port ${PORT}`)
})

