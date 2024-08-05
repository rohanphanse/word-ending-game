class Game {
    constructor(id) {
        this.id = id
        this.host = null
        this.game_type = null
        this.players = []
        this.turn = 0
        this.word = ""
        this.points = {}
    }
    
    add_player(name, lobby_id) {
        if (!this.get_player_by_name(name)) {
            this.players.push({
                name,
                lobby_id,
                player_id: "",
                save: false,
            })
            return true
        }
        return false
    }

    get_player_names() {
        let player_names = []
        for (const player of this.players) {
            player_names.push(player.name)
        }
        return player_names
    }

    get_player_by_lobby_id(lobby_id) {
        for (const player of this.players) {
            if (player.lobby_id === lobby_id) {
                return player
            } 
        }
        return null
    }

    get_player_by_name(name) {
        for (const player of this.players) {
            if (player.name === name) {
                return player
            } 
        }
        return null
    }

    remove_player_by_lobby_id(lobby_id) {
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].lobby_id === lobby_id) {
                this.players.splice(i, 1)
                break
            }
        }
    }

    update_host() {
        if (this.players.length > 0) {
            this.host = this.players[0].lobby_id
        } else {
            this.host = null
        }
    }

    get current_player() {
        return this.players[this.turn % this.players.length]
    }

    get last_player() {
        if (this.turn == 0) return null
        return this.players[(this.turn - 1) % this.players.length]
    }

    save_all_players() {
        for (const player of this.players) {
            player.save = true
            this.points[player.lobby_id] = 0
        }
    }

    get host_name() {
        return this.get_player_by_lobby_id(this.host).name
    }

    get_points_by_name() {
        let points = {}
        for (const player of this.players) {
            points[player.name] = this.points[player.lobby_id]
        }
        return points
    }
}

module.exports = Game