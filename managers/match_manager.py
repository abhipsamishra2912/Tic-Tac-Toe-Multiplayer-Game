class MatchManager:
    def __init__(self):
        self.waiting = []
        self.room_manager =None
        self.game_manager =None

    def add_player(self, uid):
        if uid not in self.waiting:
            self.waiting.append(uid)

    def remove_player(self, uid):
        if uid in self.waiting:
            self.waiting.remove(uid)

    def get_match(self):
        if len(self.waiting) >= 2:
            p1 = self.waiting.pop(0)
            p2 = self.waiting.pop(0)
            return p1, p2
        return None

    async def find_match(self, uid):
        print(f"find_match called for {uid}")
        self.add_player(uid)
        print(f"waiting queue: {self.waiting}")
        match = self.get_match()
        print(f"match result: {match}")
    
        if match:
            p1, p2 = match
            if p1 == p2:
                self.add_player(p1)
                return
            room_id = self.room_manager.create_room(p1, p2)
            print(f"room created: {room_id}")
            await self.game_manager.start_game(room_id, p1, p2)
            print(f"game started")

    async def send_chat(self, uid, room_id, message):
        players = self.room_manager.get_players(room_id)
        for p in players:
            await self.game_manager.connection_manager.send_to_user(p, {
                "type": "chat",
                "from": uid,
                "message": message
            })