document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const lobby = document.getElementById("lobby")
    const placeLetter = document.getElementById("place-letter")
    const letterSquares = document.getElementById("letter-squares")
    const turnText = document.getElementById("turn-text")
    const challengeButton = document.getElementById("challenge-button")
    const wordsSection = document.getElementById("words-section")
    // Chat 
    const messages = document.getElementById("messages")
    const messageForm = document.getElementById("message-form")
    const messageInput = document.getElementById("message-input")


    // Data
    let turn = 0
    let challenge = false
    let game_over = false
    let game_host = ""
    let line_colors = {}

    let letterSquareListener = (event) => {
        if (event.key === "Backspace") {
            event.target.innerText = ""
        } else if (event.target.innerText.length == 1) {
            event.preventDefault()
        }
    }

    // Web sockets
    const socket = io(URL) 
    const name = sessionStorage.getItem("name")
    const lobby_id = sessionStorage.getItem("lobby_id")
    const game_id = new URLSearchParams(window.location.search).get("g")
    socket.on("connect", () => {
        socket.emit("join_2d_game", game_id, lobby_id)
        let players

        let player_colors = []
        socket.on("colors", (colors) => {
            player_colors = colors
        })

        socket.on("players", (_players, _game_host) => {
            players = _players
            game_host = _game_host
            let last_color = null
            lobby.innerHTML = ""
            for (let i = 0; i < players.length; i++) {
                const player = players[i]
                const avatar = document.createElement("div")
                avatar.classList.add("avatar")
                const avatarIcon = document.createElement("div")
                avatarIcon.classList.add("avatar-icon")
                avatarIcon.style.border = `4px solid ${player_colors[i]}`
                avatarIcon.innerText = player[0]
                const avatarText = document.createElement("div")
                player_text = player
                if (player === game_host) {
                    player_text += " (host)"
                }
                if (player === name) {
                    player_text += " (you)"
                }
                avatarText.innerText = player_text
                avatarText.classList.add("avatar-text")
                avatar.append(avatarIcon)
                avatar.append(avatarText)
                lobby.append(avatar)
            }
        })

        let game_grid
        socket.on("grid", (grid) => {
            game_grid = grid.split(",")
            for (const child of letterSquares.children) {
                child.removeEventListener("keydown", letterSquareListener)
            }
            letterSquares.innerHTML = ""
            for (let i = 0; i < game_grid.length; i++) {
                for (let j = 0; j < game_grid[i].length; j++) {
                    const letterSquare = document.createElement("div")
                    if (game_grid[i].charAt(j) === "_") {
                        letterSquare.classList.add("candidate-letter-square")
                        letterSquare.contentEditable = "true"
                        letterSquare.addEventListener("keydown", letterSquareListener)
                    } else {
                        letterSquare.classList.add(game_grid[i].charAt(j) == "*" ?"invalid-letter-square" : "letter-square")
                        letterSquare.innerText = game_grid[i].charAt(j) == "*" ? "" : game_grid[i].charAt(j)
                    }
                    letterSquare.setAttribute("data-pos", game_grid.length*i + j)
                    letterSquares.append(letterSquare)
                }
            }
        })

        let game_words = {}
        socket.on("words", (words) => {
            game_words = words
            for (const child of wordsSection.getElementsByClassName("small-candidate-square")) {
                child.removeEventListener("keydown", letterSquareListener)
            }
            wordsSection.innerHTML = ""
            for (const line in game_words) {
                if (game_words[line]) {
                    const wordContainer = document.createElement("div")
                    wordContainer.classList.add("word")
                    const lineTag = document.createElement("div")
                    lineTag.classList.add("line-tag")
                    lineTag.id = `small-${line}`
                    if (line_colors[line]) {
                        lineTag.style.color = line_colors[line]
                    }
                    lineTag.innerText = line
                    wordContainer.append(lineTag)
                    let i = 0
                    for (const letter of game_words[line]) {
                        const letterSquare = document.createElement("div")
                        letterSquare.classList.add(letter === "+" ? "small-candidate-letter-square" : "small-letter-square")
                        letterSquare.innerText = letter === "+" ? "" : letter
                        if (letter === "+") {
                            letterSquare.contentEditable = "true"
                            letterSquare.addEventListener("keydown", letterSquareListener)
                            letterSquare.setAttribute("data-line", line)
                            letterSquare.setAttribute("data-pos", i === 0 ? "front" : "back")
                        }
                        wordContainer.append(letterSquare)
                        i++
                    }
                    wordsSection.append(wordContainer)
                } 
            }
        })
        
        socket.on("last_move", (last_move, last_color) => {
            for (const line of last_move) {
                line_colors[line] = last_color
                document.getElementById(line).style.color = last_color
                let e = document.getElementById(`small-${line}`)
                if (e) e.style.color = last_color
            }
        })
        
        let interval
        let wait_interval
        socket.on("turn", (_turn) => {
            if (players.length === 1) {
                clearInterval(interval)
            }
            turn = _turn
            turnText.innerText = `${players[turn % players.length]}'s turn`
            clearInterval(interval)
            clearInterval(wait_interval)
            if (name === players[turn % players.length]) {
                placeLetter.style.display = "flex"
                if (turn >= 2) {
                    challengeButton.style.display = "flex"
                } else {
                    challengeButton.style.display = "none"
                }
                placeLetter.innerText = "Place letter (60s)"
                const start = Date.now()
                interval = setInterval(() => {
                    if (60 - (Math.floor((Date.now() - start) / 1000)) < 0) {
                        clearInterval(interval)
                    }
                    placeLetter.innerText = `Place letter (${Math.max(60 - (Math.floor((Date.now() - start) / 1000)), 0)}s left)`
                }, 1000)
            } else {
                placeLetter.style.display = "none"
                challengeButton.style.display = "none"
                clearInterval(interval)
                turnText.innerText = `${players[turn % players.length]}'s turn (60s left)`
                const start = Date.now()
                wait_interval = setInterval(() => {
                    if (60 - (Math.floor((Date.now() - start) / 1000)) < 0) {
                        clearInterval(wait_interval)
                    }
                    turnText.innerText = `${players[turn % players.length]}'s turn (${Math.max(60 - (Math.floor((Date.now() - start) / 1000)), 0)}s left)`
                }, 1000)
            }
        })

        socket.on("challenge_word", () => {
            renderMessage({
                username: "GameBot",
                time: Date.now(),
                text: `You have been challenged by ${players[turn % players.length]}! The current letters are '${game_word}.' Enter '/response' followed by your intended word here:`
            })
            challenge = true
        })

        socket.on("challenge_all", () => {
            placeLetter.style.display = "none"
            challengeButton.style.display = "none"
            turnText.innerText = ""
            clearInterval(interval)
            clearInterval(wait_interval)
        })

        socket.on("challenge_outcome", (outcome) => {
            renderMessage({
                username: "GameBot",
                time: Date.now(),
                text: outcome
            })
        }) 

         // Message from server
        socket.on("message", (message) => {
            renderMessage(message)
        })

        socket.on("game_over", (game_points, loser, _game_host) => {
            game_over = true
            game_host = _game_host
            sorted_players = Object.keys(game_points)
            sorted_players.sort((a, b) => {
                return game_points[b] - game_points[a]
            })
            let message = "Game over! Current standings:\n"
            for (let i = 0; i < sorted_players.length; i++) {
                message += `${i + 1}. ${sorted_players[i]} - ${game_points[sorted_players[i]]} points `
                if (sorted_players[i] !== loser) {
                    message += "(+1 point)"
                }
                message += "\n"
            }
            renderMessage({
                username: "GameBot",
                time: Date.now(),
                text: message
            })
            if (game_host === name) {
                renderMessage({
                    username: "GameBot",
                    time: Date.now(),
                    text: `Does your group want to play another game? Enter '/start' to start the next game.`
                })
            } else {
                renderMessage({
                    username: "GameBot",
                    time: Date.now(),
                    text: `Want to play another game? Ask the host '${game_host}' to enter '/start' to start the next game.`
                })
            }
            challengeButton.style.display = "none"
            placeLetter.style.display = "none"
        })
    })

    placeLetter.addEventListener("click", () => {
        let move_pos = -1
        let move_letter = ""
        let move_type = ""
        let children = [...letterSquares.getElementsByClassName("candidate-letter-square"), ...wordsSection.getElementsByClassName("small-candidate-letter-square")]
        for (const child of children) {
            if (child.innerText.length > 1) {
                return 
            }
            if (child.innerText.length == 1) {
                if (!child.innerText.toUpperCase().match(/[A-Z]/i)) {
                    return
                }
                if (move_type) {
                    return 
                }
                if (child.classList.contains("candidate-letter-square")) {
                    move_pos = +child.dataset.pos
                    move_letter = child.innerText.toUpperCase()
                    move_type = "in_grid"
                } else {
                    move_pos = [child.dataset.line, child.dataset.pos]
                    move_letter = child.innerText.toUpperCase()
                    move_type = "beyond_grid"
                }
            }
        }
        if (!move_type) {
            return
        }
        console.log(move_pos, move_letter, move_type)
        socket.emit("play_letter_2d", move_pos, move_letter, move_type)
    })

    challengeButton.addEventListener("click", () => {
        const confirm_challenge = confirm(`Click 'OK' to confirm your challenge; otherwise click 'Cancel.'`)
        if (confirm_challenge) {
            socket.emit("challenge_2d")
        }
    })

    messageForm.addEventListener("submit", event => {
        event.preventDefault()
        const message = messageInput.value.trim()
        if (message) {
            if (challenge && message.startsWith("/response ")) {
                socket.emit("challenge_word_response", message.slice("/response ".length))
                challenge = false
            } else if (game_over && name === game_host && message.toLowerCase() === "/start") {
                socket.emit("next_game")
            } else {
                socket.emit("message", message)
            }
            messageInput.value = ""
        }
    })

    // Render message in DOM
    let last_rendered_username = ""
    let last_rendered_time = null
    function renderMessage(message) {
        const messageElement = document.createElement("div")
        messageElement.className = "message"
        const meta = document.createElement("div")
        meta.className = "message-meta"
        const username = document.createElement("div")
        username.innerText = message.username
        username.className = "message-username"
        const time = document.createElement("div")
        time.innerText = formatTime(message.time)
        time.className = "message-time"
        const text = document.createElement("div")
        text.innerText = message.text
        text.className = "message-text"
        if (last_rendered_time === null || last_rendered_username !== message.username || formatTime(last_rendered_time) !== formatTime(message.time)) {
            meta.appendChild(username)
            meta.appendChild(time)
            messageElement.appendChild(meta)
        } else {
            messageElement.className = "message-below"
        }
        last_rendered_username = message.username
        last_rendered_time = message.time
        messageElement.appendChild(text)
        messages.appendChild(messageElement)
        messageElement.scrollIntoView()
    }

    // Format time with correct timezone
    function formatTime(time) {
        time = new Date(time)
        return `${time.getHours() % 12 === 0 ? 12 : time.getHours() % 12}:${time.getMinutes().toString().padStart(2, "0")}`
    }
})