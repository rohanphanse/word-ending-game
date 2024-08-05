// Imports 
const express = require("express")
const http = require("http")
const socketio = require("socket.io")
const path = require("path")
const fs = require("fs")
require("dotenv").config()

const Game = require("./game.js")

// Initialize server and websocket
const PORT = process.env.PORT || 3000
const URL = process.env.URL || "https://word-ending-game.onrender.com"
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
const words = new Set()
for (const word of word_strings) {
    if (word.length > 2) {
        words.add(word)
    }
}

// Game data
const games = {}
const game_types = ["1d", "2d"]

io.on("connection", (socket) => {
    let game_id
    let lobby_id 
    let player_id
    let player_name 
    let game
    
    socket.on("join_game", async (name, _game_id, _game_type) => {
        if (!game_types.includes(_game_type)) return
        // Create new game or join existing game
        if (!games[_game_id]) {
            game_id = generateID()
            while (games[game_id]) {
                game_id = generateID()
            }
            games[game_id] = new Game(game_id)
            socket.emit("game_id", game_id)
        } else {
            game_id = _game_id
        }
        lobby_id = socket.id
        game = games[game_id]
        
        // Set game type
        if (!game.game_type) {
            game.game_type = _game_type
        }
        // Check name and add player to game
        if (name.length > 0 && name.length < 20) {
            let success = game.add_player(name, lobby_id)
            if (!success) return
            socket.join(game_id)
            // Add host
            if (!game.host) {
                game.host = lobby_id
            }
            // Update players 
            io.to(game_id).emit("players", game.get_player_names(), game.host_name)
        }
    })

    // Request welcome
    socket.on("request_welcome", async (_game_id) => {
        if (!games[_game_id]) return
        game_id = _game_id
        game = games[game_id]
        if (game.host && game.game_type) {
            socket.emit("welcome", game.get_player_by_lobby_id(game.host).name, game.game_type)
            socket.emit("players", game.get_player_names(), game.host_name)
        }
    })

    socket.on("disconnect", async () => {
        if (!game) return
        // Remove player 
        if (!game.get_player_by_lobby_id(lobby_id).save) {
            game.remove_player_by_lobby_id(lobby_id)
            // Update host
            if (lobby_id === game.host) {
                game.update_host()
                socket.to(game.host).emit("update_host")
            }
            // Update players
            io.to(game_id).emit("players", game.get_player_names(), game.host_name)
        }
    })

    // Request from host to start game
    socket.on("request_start_game", async () => {
        if (lobby_id !== game.host) return
        // Initialize game
        game.save_all_players()
        game.players = shuffleArray(game.players)
        io.to(game_id).emit("start_game")
    })

    // Join 1D game
    socket.on("join_1d_game", async (_game_id, _lobby_id) => {
        if (!games[_game_id]) return
        game_id = _game_id
        game = games[game_id]
        let player = game.get_player_by_lobby_id(_lobby_id)
        if (!player) return
        lobby_id = _lobby_id
        player_id = socket.id
        player.player_id = player_id
        player_name = game.get_player_by_lobby_id(lobby_id).name
        socket.join(game_id)
        // Broadcast game start information
        io.to(game_id).emit("players", game.get_player_names(), game.host_name)
        socket.emit("turn", game.turn)
        socket.emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `Welcome to game '${game_id}'`
        })
        socket.emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `${game.current_player.name}, it's your turn!`
        })
        socket.emit("word", game.word)
    })

    // Play letter in 1D game
    socket.on("play_letter_1d", (letter, position) => {
        // Validate move
        if (typeof letter !== "string") return
        if (letter.length !== 1) return
        if (!letter.match(/[a-z]/i) && !letter.match(/[A-Z]/i)) return
        if (lobby_id !== game.current_player.lobby_id) return
        if (position !== "front" && position !== "back") return
        letter = letter.toUpperCase()
        if (position === "front") {
            // Letter forms a word 
            if (game.word.length > 2 && words.has((letter + game.word).toLowerCase())) {
                socket.emit("message", {
                    username: "GameBot",
                    time: Date.now(),
                    text: `${player_name}, ${letter + game.word} is a word! Choose another letter.`
                })
                return
            }
            game.word = letter + game.word
        }
        if (position === "back") {
            // Letter forms a word
            if (game.word.length > 2 && words.has((game.word + letter).toLowerCase())) {
                socket.emit("message", {
                    username: "GameBot",
                    time: Date.now(),
                    text: `${player_name}, ${game.word + letter} is a word! Choose another letter.`
                })
                return
            }
            game.word = game.word + letter
        }
        // Broadcast move
        io.to(game_id).emit("word", game.word)
        io.to(game_id).emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `${player_name} played ${letter} at the ${position}.`
        })
        // Next turn
        game.turn++
        io.to(game_id).emit("turn", game.turn)
        io.to(game_id).emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: `${game.current_player.name}, it's your turn!`
        })
        game.last_player = player_id
    })

    // Challenge in 1D game
    socket.on("challenge_1d", () => {
        if (game.turn < 2) return
        if (lobby_id !== game.current_player.lobby_id) return
        socket.to(game.last_player.player_id).emit("challenge_word")
    })

    // Response to challenge in 1D game
    socket.on("challenge_word_response", (challenge_word) => {
        if (typeof challenge_word !== "string") return
        challenge_word = challenge_word.toUpperCase()
        let loser = ""
        if (words.has(challenge_word.toLowerCase()) && challenge_word.includes(game.word)) {
            io.to(game_id).emit("challenge_outcome", `Since ${game.last_player.name}'s word '${challenge_word}' is in the English dictionary and contains the letters played '${game.word}', ${game.current_player.name}'s challenge of ${game.last_player.name} was unsuccessful.`)
            loser = game.current_player
        } else {
            io.to(game_id).emit("challenge_outcome", `Since ${game.last_player.name}'s word '${challenge_word}' is either not in the English dictionary or does not contain the letters played '${game.word}', ${game.current_player.name}'s challenge of ${game.last_player.name} was successful.`)
            loser = game.last_player
        }
        for (const player of game.players) {
            if (player.lobby_id !== loser.lobby_id) {
                game.points[player.lobby_id] += 1
            }
        }
        io.to(game_id).emit("game_over", game.get_points_by_name(), loser.name, game.get_player_by_lobby_id(game.host).name) 
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
            username: player_name,
            time: Date.now(),
            text: message,
        })
    })

    socket.on("next_game", () => {
        if (lobby_id !== game.host) return
        // Initialize game
        game.players = shuffleArray(game.players)
        game.turn = 0
        game.word = ""
        io.to(game_id).emit("message", {
            username: "GameBot",
            time: Date.now(),
            text: "Starting next game..."
        })
        io.to(game_id).emit("word", game.word)
        io.to(game_id).emit("turn", game.turn)
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

