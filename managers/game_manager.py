class GameManager:
    def __init__(self, connection_manager, elo_manager, room_manager):
        self.connection_manager = connection_manager
        self.elo_manager = elo_manager
        self.room_manager = room_manager
        self.games = {}

    async def start_game(self, room_id, player1, player2):
        game = {
            "room_id": room_id,
            "player1": player1,
            "player2": player2,
            "board": [None for _ in range(9)],
            "turn": player1,
            "symbol": {
                player1: "X",
                player2: "O",
            },
            "status": "active",
        }

        self.games[room_id] = game
        await self.send_game_start(game)

    async def handle_move(self, uid, room_id, position):
        if room_id not in self.games:
            return
        game = self.games.get(room_id)

        if not game or game["status"] != "active":
            return

        if uid not in [game["player1"], game["player2"]]:
            return

        if uid != game["turn"]:
            await self.connection_manager.send_to_user(uid, {
                "type": "error",
                "message": "not_your_turn"
            })
            return

        if position not in range(9):
            return

        if game["board"][position] is not None:
            await self.connection_manager.send_to_user(uid, {
                "type": "error",
                "message": "cell_taken"
            })
            return

        game["board"][position] = game["symbol"][uid]

        winner_symbol = self.check_win(game["board"])

        if winner_symbol:
            symbol_to_uid = {v: k for k, v in game["symbol"].items()}
            winner_uid = symbol_to_uid.get(winner_symbol)
            await self.end_game(room_id, winner_uid)
            return

        if self.check_draw(game["board"]):
            await self.end_game(room_id, None)
            return

        game["turn"] = (
            game["player2"] if uid == game["player1"] else game["player1"]
        )

        await self.send_game_update(game)

    def check_win(self, board):
        patterns = [
            (0,1,2),(3,4,5),(6,7,8),
            (0,3,6),(1,4,7),(2,5,8),
            (0,4,8),(2,4,6)
        ]

        for a, b, c in patterns:
            if board[a] and board[a] == board[b] == board[c]:
                return board[a]

        return None

    def check_draw(self, board):
        return all(cell is not None for cell in board)

    async def end_game(self, room_id, winner_uid):
        game = self.games.get(room_id)

        if not game:
            return

        game["status"] = "finished"

        await self.send_game_end(game, winner_uid)

        await self.elo_manager(
            game["player1"],
            game["player2"],
            winner_uid
        )

        self.games.pop(room_id, None)
        self.room_manager.remove_room(room_id)

    async def handle_disconnect(self, uid):
        room_id = self.room_manager.get_room(uid)

        if not room_id:
            return

        game = self.games.get(room_id)

        if not game or game["status"] != "active":
            return

        opponent = (
            game["player2"] if uid == game["player1"] else game["player1"]
        )

        await self.end_game(room_id, opponent)

    async def send_game_start(self, game):
        for uid in [game["player1"], game["player2"]]:
            await self.connection_manager.send_to_user(uid, {
                "type": "game_start",
                "data": {
                    "room_id": game["room_id"],
                    "symbol": game["symbol"][uid],
                    "turn": game["turn"],
                },
            })

    async def send_game_update(self, game):
        for uid in [game["player1"], game["player2"]]:
            await self.connection_manager.send_to_user(uid, {
                "type": "game_update",
                "data": {
                    "room_id": game["room_id"],
                    "board": game["board"],
                    "turn": game["turn"],
                    "symbol": game["symbol"][uid],
                },
            })

    async def send_game_end(self, game, winner_uid):
        for uid in [game["player1"], game["player2"]]:
            await self.connection_manager.send_to_user(uid, {
                "type": "game_end",
                "data": {
                    "room_id": game["room_id"],
                    "winner": winner_uid,
                    "board": game["board"],
                },
            })
    async def force_win(self, room_id, winner_uid):
        await self.end_game(room_id, winner_uid)