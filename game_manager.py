games = {}


class GameManager:
    def __init__(self, connection_manager, elo_manager, match_manager):
        self.connection_manager = connection_manager
        self.elo_manager = elo_manager
        self.match_manager = match_manager

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

        games[room_id] = game
        await self.send_game_start(game)

    async def handle_move(self, uid, room_id, position):
        game = games.get(room_id)
        if not game or game["status"] != "active":
            return

        if uid != game["turn"]:
            return

        if position not in range(9):
            return

        if game["board"][position] is not None:
            return

        game["board"][position] = game["symbol"][uid]
        winner_symbol = self.check_win(game["board"])

        if winner_symbol:
            winner_uid = next(
                (user for user, symbol in game["symbol"].items() if symbol == winner_symbol),
                None,
            )
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
        win_patterns = (
            (0, 1, 2), (3, 4, 5), (6, 7, 8),
            (0, 3, 6), (1, 4, 7), (2, 5, 8),
            (0, 4, 8), (2, 4, 6),
        )

        for a, b, c in win_patterns:
            if board[a] and board[a] == board[b] == board[c]:
                return board[a]

        return None

    def check_draw(self, board):
        return all(cell is not None for cell in board)

    async def end_game(self, room_id, winner_uid):
        game = games.get(room_id)
        if not game:
            return

        game["status"] = "finished"
        await self.send_game_end(game, winner_uid)

        await self.elo_manager.update_ratings(
            game["player1"],
            game["player2"],
            winner_uid,
        )

        games.pop(room_id, None)
        await self.match_manager.cleanup_room(room_id)

    async def handle_disconnect(self, uid, room_id):
        game = games.get(room_id)
        if not game or game["status"] != "active":
            return

        opponent = (
            game["player2"] if uid == game["player1"] else game["player1"]
        )
        await self.end_game(room_id, opponent)

    async def send_game_start(self, game):
        for uid in (game["player1"], game["player2"]):
            await self.connection_manager.send_to_user(
                uid,
                {
                    "type": "game_start",
                    "data": {
                        "room_id": game["room_id"],
                        "symbol": game["symbol"][uid],
                        "turn": game["turn"],
                    },
                },
            )

    async def send_game_update(self, game):
        for uid in (game["player1"], game["player2"]):
            await self.connection_manager.send_to_user(
                uid,
                {
                    "type": "game_update",
                    "data": {
                        "board": game["board"],
                        "turn": game["turn"],
                    },
                },
            )

    async def send_game_end(self, game, winner_uid):
        for uid in (game["player1"], game["player2"]):
            await self.connection_manager.send_to_user(
                uid,
                {
                    "type": "game_end",
                    "data": {
                        "winner": winner_uid,
                        "board": game["board"],
                    },
                },
            )