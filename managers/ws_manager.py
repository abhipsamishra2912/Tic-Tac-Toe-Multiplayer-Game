from db import set_user_offline
class ConnectionManager:
    def __init__(self, match_manager, room_manager, game_manager):
        self.webdict = {}
        self.match_manager = match_manager
        self.room_manager = room_manager
        self.game_manager = game_manager

    async def connect(self, uid, websocket):
        await websocket.accept()
        self.webdict[uid] = websocket
        await self.broadcast_lobby_update()

    async def disconnect(self, uid):
         if uid in self.webdict:
             del self.webdict[uid]
         set_user_offline(uid)      
         room_id = self.room_manager.get_room(uid)
     
         if room_id:
             players = self.room_manager.get_players(room_id)
     
             for p in players:
                 if p != uid:
                    await self.game_manager.force_win(room_id, p)
     
             self.room_manager.remove_room(room_id)
         await self.broadcast_lobby_update()

    async def send_to_user(self, uid, message):
        if uid not in self.webdict:
            return

        websocket = self.webdict[uid]

        try:
            await websocket.send_json(message)
        except:
            del self.webdict[uid]

    async def broadcast(self, message):
        for uid in list(self.webdict.keys()):
            try:
                await self.send_to_user(uid, message)
            except:
                pass

    def get_online_users(self):
        return list(self.webdict.keys())

    async def handle_message(self, uid, data):
        print(f"handle_message called: uid={uid} data={data}")
        import json
        msg = json.loads(data)

        if msg["type"] == "find_match":
            await self.match_manager.find_match(uid)

        elif msg["type"] == "send_challenge":                      
            await self.match_manager.send_challenge(uid, msg["target_uid"])

        elif msg["type"] == "respond_challenge":                    
            await self.match_manager.respond_challenge(
                uid, msg["challenger_uid"], msg["accepted"]
            )

        elif msg["type"] == "forfeit":
            room_id = self.room_manager.get_room(uid)
            if room_id:
                game = self.game_manager.games.get(room_id)
                if game and game["status"] == "active":
                    opponent = (
                        game["player2"] if uid == game["player1"] else game["player1"]
                    )
                    await self.game_manager.force_win(room_id, opponent)
                    
        elif msg["type"] == "move":
            await self.game_manager.handle_move(uid, msg["room_id"], msg["position"])

        elif msg["type"] == "chat":
            await self.match_manager.send_chat(uid, msg["room_id"], msg["message"])


    # async def broadcast(self, message):
    #         for uid in list(self.webdict.keys()):
    #             try:
    #                 await self.send_to_user(uid, message)
    #             except:
    #                 pass

    async def broadcast_lobby_update(self):
        online_users = self.get_online_users()
        await self.broadcast({
            "type": "lobby_update",
            "online_users": online_users
        })