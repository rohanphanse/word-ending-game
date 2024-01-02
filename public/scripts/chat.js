document.addEventListener("DOMContentLoaded", () => {
    const socket = io()

    // Elements
    const messages = document.getElementById("messages")
    const messageForm = document.getElementById("message-form")
    const messageFormInput = document.getElementById("message-form-input")

    const usernameForm = document.getElementById("username-form")
    const usernameFormInput = document.getElementById("username-form-input")

    messageForm.style.display = "none"

    usernameForm.addEventListener("submit", event => {
        const username = usernameFormInput.value.trim()
        if (username) {
            socket.emit("username", username)
        }
        usernameFormInput.value = ""
        event.preventDefault()
    })

    socket.on("username-success", () => {
        usernameForm.style.display = "none"
        messageForm.style.display = "flex"
    })

    // Message from server
    socket.on("message", (message) => {
        console.log(message)
        renderMessage(message)
    })

    messageForm.addEventListener("submit", event => {
        event.preventDefault()
        const message = messageFormInput.value.trim()
        if (message) {
            socket.emit("message", message)
            messageFormInput.value = ""
        }
    })

    // Render message in DOM
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
        meta.appendChild(username)
        meta.appendChild(time)
        messageElement.appendChild(meta)
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