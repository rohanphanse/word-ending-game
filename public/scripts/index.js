

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
    const lobby = document.getElementById("lobby")
    const lobbyText = document.getElementById("lobby-text")
    const startGame = document.getElementById("start-game")

    // Data
    let is_host = true
    let game_type = "1d"
    let game_players = []
    let player_name = ""

    function name_already_used(name) {
        for (const player of game_players) {
            if (name === player) {
                return true
            }
        }
        return false
    }

    let gamemode_chosen = false;
    gamemode1D.addEventListener("click", () => {
        if (gamemode_chosen) return
        gamemode1D.classList.add("gamemode-selected")
        gamemode2D.classList.remove("gamemode-selected")
    })
    gamemode2D.addEventListener("click", () => {
        if (gamemode_chosen) return
        gamemode2D.classList.add("gamemode-selected")
        gamemode1D.classList.remove("gamemode-selected")
    })

    setTimeout(() => {
        gamemode1D.style.transition = "0.2s"
        gamemode2D.style.transition = "0.2s"
    }, 500)

    // Web sockets
    let game_id = new URLSearchParams(window.location.search).get("g") || "none"
    const socket = io(URL)
    socket.on("connect", () => {
        socket.emit("request_welcome", game_id)

        socket.on("players", (players, host_name, colors) => {
            lobby.innerHTML = ""
            console.log("players", players)
            if (players.length) {
                lobbyText.style.display = "flex"
            }
            game_players = players
            for (let i = 0; i < players.length; i++) {
                const player = players[i]
                const avatar = document.createElement("div")
                avatar.classList.add("avatar")
                const avatarIcon = document.createElement("div")
                avatarIcon.classList.add("avatar-icon")
                avatarIcon.style.border = `4px solid ${colors[i]}`
                avatarIcon.innerText = player[0]
                const avatarText = document.createElement("div")
                avatarText.innerText = player === host_name ? `${player} (host)` : player
                avatarText.classList.add("avatar-text")
                avatar.append(avatarIcon)
                avatar.append(avatarText)
                lobby.append(avatar)
            }
        })
    })

    socket.on("update_host", () => {
        inviteLink.value = `${URL}/?g=${game_id}`
        inviteLinkSection.style.display = "flex"
        welcomeMessage.innerText = `Welcome to game '${game_id}' hosted by ${player_name}!`
        startGame.style.display = "flex"

    })

    socket.on("game_id", (_game_id) => {
        game_id = _game_id
        inviteLink.value = `${URL}/?g=${game_id}`
    })

    socket.on("welcome", (game_host, _game_type) => {
        is_host = false
        gamemode_chosen = true;
        game_type = _game_type
        welcomeMessage.innerText = `Welcome to game '${game_id}' hosted by ${game_host}!`
        enterLobby.innerText = "Join lobby"
        if (game_type === "1d") {
            gamemode1D.classList.add("gamemode-selected")
            gamemode2D.classList.remove("gamemode-selected")
        }
        if (game_type === "2d") {
            gamemode2D.classList.add("gamemode-selected")
            gamemode1D.classList.remove("gamemode-selected")
        }

        socket.on("start_game", () => {
            window.location.href = `${URL}/play-${game_type}/?g=${game_id}`
        })
    })

    copyInviteLink.addEventListener("click", () => {
        inviteLink.select()
        document.execCommand("copy")
    })

    enterLobby.addEventListener("click", () => {
        const name = enterName.value
        if (name.length > 0 && name.length < 20 && !name_already_used(name) && !name.includes("(host)")) {
            const game_id = new URLSearchParams(window.location.search).get("g")
            if (is_host) game_type = gamemode1D.classList.contains("gamemode-selected") ? "1d" : "2d"
            socket.emit("join_game", name, game_id, game_type)
            enterLobby.style.display = "none"
            enterName.disabled = true
            sessionStorage.setItem("lobby_id", socket.id)
            sessionStorage.setItem("name", enterName.value)
            player_name = name
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
        window.location.href = `${URL}/play-${game_type}/?g=${game_id}`
    })
})