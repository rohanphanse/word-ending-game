

document.addEventListener("DOMContentLoaded", () => {
    // Elements
    // Gamemode elements
    const gamemode1D = document.getElementById("gamemode-1d")
    const gamemode2D = document.getElementById("gamemode-2d")
    const welcomeMessage = document.getElementById("welcome-message")
    // Invite elements
    const inviteLinkSection = document.getElementById("invite-link-section")
    const inviteLink = document.getElementById("invite-link")
    const copyInviteLink = document.getElementById("copy-invite-link")
    // Name elements
    const enterName = document.getElementById("enter-name")
    // Lobby elements
    const enterLobby = document.getElementById("enter-lobby")
    const lobbySection = document.getElementById("lobby-section")
    const lobby = document.getElementById("lobby")
    const lobbyText = document.getElementById("lobby-text")
    const startGame = document.getElementById("start-game")

    // Data
    let is_host = true
    let game_type = "1d"
    const url = "http://localhost:3000"

    gamemode1D.addEventListener("click", () => {
        gamemode1D.classList.add("gamemode-selected")
        gamemode2D.classList.remove("gamemode-selected")
    })
    gamemode2D.addEventListener("click", () => {
        gamemode2D.classList.add("gamemode-selected")
        gamemode1D.classList.remove("gamemode-selected")
    })

    const urlParams = new URLSearchParams(window.location.search)
    if (!urlParams.has("g")) {
        const id = generateID()
        window.location.href = `${url}/?g=${id}` 
    }
    inviteLink.value = window.location.href

    // Web sockets
    const game_id = new URLSearchParams(window.location.search).get("g")
    const socket = io(url)
    socket.on("connect", () => {
        socket.emit("request_welcome", game_id)

        socket.on("players", (players) => {
            let last_color = null
            lobby.innerHTML = ""
            console.log("players", players)
            if (players.length) {
                lobbyText.style.display = "flex"
            }
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
                avatarText.innerText = player
                avatarText.classList.add("avatar-text")
                avatar.append(avatarIcon)
                avatar.append(avatarText)
                lobby.append(avatar)
            }
        })
    })

    socket.on("welcome", (game_host, _game_type) => {
        is_host = false
        game_type = _game_type
        console.log("wgt", game_type)
        welcomeMessage.innerText = `Welcome to game '${game_id}' hosted by ${game_host}!`
        enterLobby.innerText = "Join lobby"
        gamemode1D.style.display = "none"
        gamemode2D.style.display = "none"
        if (game_type === "1d") {
            gamemode2D.style.display = "none"
            gamemode1D.classList.add("gamemode-selected")
        }
        if (game_type === "2d") {
            gamemode1D.style.display = "none"
            gamemode2D.classList.add("gamemode-selected")
        }

        socket.on("start_game", () => {
            window.location.href = `${url}/play-${game_type}/?g=${game_id}`
        })
    })

    copyInviteLink.addEventListener("click", () => {
        inviteLink.select()
        document.execCommand("copy")
    })

    enterLobby.addEventListener("click", () => {
        const name = enterName.value
        if (name.length) {
            const game_id = new URLSearchParams(window.location.search).get("g")
            if (is_host) game_type = gamemode1D.classList.contains("gamemode-selected") ? "1d" : "2d"
            console.log("gt", game_type)
            socket.emit("join_game", name, game_id, game_type)
            enterLobby.style.display = "none"
            enterName.disabled = true
            sessionStorage.setItem("name", enterName.value)
            if (is_host) { 
                inviteLinkSection.style.display = "flex"
                startGame.style.display = "flex"
            }
        } else {
            enterName.focus()
        }
    })

    startGame.addEventListener("click", () => {
        socket.emit("request_start_game")
        window.location.href = `${url}/play-${game_type}/?g=${game_id}`
    })
})

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