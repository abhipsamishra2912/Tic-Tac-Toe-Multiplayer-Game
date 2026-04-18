import json
from db import set_user_offline

class ConnectionManager:
    def __init__(self, match_manager, room_manager, game_manager):
        self.webdict = {}
        self.match_manager = match_manager
        self.room_manager = room_manager
        self.game_manager = game_manager

    async def connect(self, uid, websocket):
        await websocket.accept()

        # If already connected (reconnecting from game page),
        # close the old socket cleanly before replacing it
        old_ws = self.webdict.get(uid)
        if old_ws and old_ws is not websocket:
            try:
                await old_ws.close()
            except Exception:
                pass

        self.webdict[uid] = websocket
        print(f"[WS] {uid} connected. Online: {list(self.webdict.keys())}")

        # If this player is in an active game, resend game_start so
        # the new game page socket gets the board state immediately
        room_id = self.room_manager.get_room(uid)
        if room_id:
            game = self.game_manager.games.get(room_id)
            if game and game["status"] == "active":
                opponent = (
                    game["player2"] if uid == game["player1"] else game["player1"]
                )
                await websocket.send_json({
                    "type": "game_start",
                    "data": {
                        "room_id": room_id,
                        "symbol": game["symbol"][uid],
                        "turn": game["turn"],
                        "opponent": opponent,
                        "board": game["board"],
                    }
                })
                print(f"[WS] resent game_start to {uid} on reconnect")

        await self.broadcast_lobby_update()

    async def disconnect(self, uid):
        self.webdict.pop(uid, None)
        self.match_manager.remove_player(uid)
        set_user_offline(uid)

        room_id = self.room_manager.get_room(uid)
        if room_id:
            game = self.game_manager.games.get(room_id)
            if game and game["status"] == "active":
                opponent = (
                    game["player2"] if uid == game["player1"] else game["player1"]
                )
                await self.game_manager.force_win(room_id, opponent)
            else:
                self.room_manager.remove_room(room_id)

        await self.broadcast_lobby_update()
        print(f"[WS] {uid} disconnected.")

    async def send_to_user(self, uid, message):
        ws = self.webdict.get(uid)
        if not ws:
            print(f"[WS] send_to_user: {uid} not in webdict, skipping")
            return
        try:
            await ws.send_json(message)
            print(f"[WS] sent {message.get('type')} to {uid}")
        except Exception as e:
            print(f"[WS] send_to_user error for {uid}: {e}")
            self.webdict.pop(uid, None)

    async def broadcast(self, message):
        for uid in list(self.webdict.keys()):
            await self.send_to_user(uid, message)

    async def broadcast_lobby_update(self):
        await self.broadcast({
            "type": "lobby_update",
            "online_users": list(self.webdict.keys())
        })

    def get_online_users(self):
        return list(self.webdict.keys())

    async def handle_message(self, uid, data):
        try:
            msg = json.loads(data)
        except Exception:
            print(f"[WS] bad JSON from {uid}: {data}")
            return

        t = msg.get("type")
        print(f"[WS] {uid} → {t}")

        if t == "find_match":
            await self.match_manager.find_match(uid)

        elif t == "send_challenge":
            await self.match_manager.send_challenge(uid, msg["target_uid"])

        elif t == "respond_challenge":
            await self.match_manager.respond_challenge(
                uid, msg["challenger_uid"], msg["accepted"]
            )

        elif t == "move":
            await self.game_manager.handle_move(
                uid, msg["room_id"], msg["position"]
            )

        elif t == "chat":
            await self.match_manager.send_chat(
                uid, msg["room_id"], msg["message"]
            )

        elif t == "forfeit":
            room_id = self.room_manager.get_room(uid)
            if room_id:
                game = self.game_manager.games.get(room_id)
                if game and game["status"] == "active":
                    opponent = (
                        game["player2"] if uid == game["player1"]
                        else game["player1"]
                    )
                    await self.game_manager.force_win(room_id, opponent)

        else:
            print(f"[WS] unknown message type: {t}")