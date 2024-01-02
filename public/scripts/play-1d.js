document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const lobby = document.getElementById("lobby")
    const placeLetter = document.getElementById("place-letter")
    const letterSquares = document.getElementById("letter-squares")
    const turnText = document.getElementById("turn-text")
    const challengeButton = document.getElementById("challenge-button")
    // Elements
    const messages = document.getElementById("messages")
    const messageForm = document.getElementById("message-form")
    const messageInput = document.getElementById("message-input")

    // Data
    let turn = 0
    let challenge = false

    let letterSquareListener = (event) => {
        console.log(event.key)
        if (event.key === "Backspace") {
            event.target.innerText = ""
        } else if (event.target.innerText.length == 1) {
            event.preventDefault()
        }
    }

    // Web sockets
    const socket = io(url) 
    socket.on("connect", () => {
        const name = sessionStorage.getItem("name")
        const game_id = new URLSearchParams(window.location.search).get("g")
        socket.emit("join_1d_game", name, game_id)
        console.log(socket.id)
        let players

        socket.on("players", (_players) => {
            players = _players
            let last_color = null
            lobby.innerHTML = ""
            console.log("game_players", players)
            for (const player of players) {
                const avatar = document.createElement("div")
                avatar.classList.add("avatar")
                const avatarIcon = document.createElement("div")
                avatarIcon.classList.add("avatar-icon")
                const colors = ["blue", "yellow", "red", "green"]
                let color
                do {
                    color = colors[Math.floor(Math.random() * colors.length)]
                } while (color === last_color)
                last_color = color
                avatarIcon.style.border = `4px solid ${color}`
                avatarIcon.innerText = player[0]
                const avatarText = document.createElement("div")
                avatarText.innerText = name === player ? `${player} (you)` : player
                avatarText.classList.add("avatar-text")
                avatar.append(avatarIcon)
                avatar.append(avatarText)
                lobby.append(avatar)
            }
        })

        let game_word
        socket.on("word", (word) => {
            game_word = word
            letterSquares.innerHTML = ""
            word = word.length === 0 ? " " : " " + word + " "
            for (let i = 0; i < word.length; i++) {
                const letterSquare = document.createElement("div")
                if (word[i] === " ") {
                    letterSquare.classList.add("candidate-letter-square")
                    letterSquare.contentEditable = "true"
                    letterSquare.addEventListener("keydown", letterSquareListener)
                } else {
                    letterSquare.classList.add("letter-square")
                    letterSquare.innerText = word[i]
                }
                letterSquares.append(letterSquare)
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
            if (name === players[turn % players.length]) {
                clearInterval(wait_interval)
                placeLetter.style.display = "flex"
                challengeButton.style.display = "flex"
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
            console.log("challenge_word")
            renderMessage({
                username: "GameBot",
                time: Date.now(),
                text: `You have been challenged by ${players[turn % players.length]}! The current letters are '${game_word}.' Enter your intended word here:`
            })
            challenge = true
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
    })

    placeLetter.addEventListener("click", () => {
        const first = letterSquares.children[0]
        const last = letterSquares.children[letterSquares.children.length - 1]
        if (first.innerText.length == 1 && last.innerText.length == 1 && first !== last) return
        if (first.innerText.length === 1) {
            socket.emit("play_letter_1d", first.innerText.toUpperCase(), "front")
            console.log("front")
        } else if (last.innerText.length === 1) {
            socket.emit("play_letter_1d", last.innerText.toUpperCase(), "back")
            console.log("back")
        }
    })

    challengeButton.addEventListener("click", () => {
        const confirm_challenge = confirm(`Click 'OK' to confirm your challenge; otherwise click 'Cancel.'`)
        if (confirm_challenge) {
            socket.emit("challenge_1d")
        }
    })

    messageForm.addEventListener("submit", event => {
        event.preventDefault()
        const message = messageInput.value.trim()
        if (message) {
            if (challenge) {
                socket.emit("challenge_word_response", message)
                return
            }
            socket.emit("message", message)
            messageInput.value = ""
        }
    })

    // Render message in DOM
    let last_rendered_username = ""
    let last_rendered_time = null
    function renderMessage(message) {
        console.log(message)
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
        console.log(formatTime(last_rendered_time), formatTime(message.time))
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