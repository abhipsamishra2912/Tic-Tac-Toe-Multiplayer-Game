class MatchManager:
    def __init__(self):
        self.waiting = []
        self.room_manager = None
        self.game_manager = None
        self.pending_challenges = {}

    def add_player(self, uid):
        if uid not in self.waiting:
            self.waiting.append(uid)

    def remove_player(self, uid):
        if uid in self.waiting:
            self.waiting.remove(uid)

    async def find_match(self, uid):
        print(f"[MM] find_match: {uid}, queue before: {self.waiting}")

        # Don't add if already in a room
        if self.room_manager.get_room(uid):
            print(f"[MM] {uid} already in a room, ignoring")
            return

        self.add_player(uid)
        print(f"[MM] queue after add: {self.waiting}")

        if len(self.waiting) >= 2:
            p1 = self.waiting.pop(0)
            p2 = self.waiting.pop(0)

            # Safety: should never happen but guard anyway
            if p1 == p2:
                self.add_player(p1)
                return

            print(f"[MM] matched {p1} vs {p2}")
            room_id = self.room_manager.create_room(p1, p2)
            print(f"[MM] room created: {room_id}")
            await self.game_manager.start_game(room_id, p1, p2)
            print(f"[MM] game started")

    async def send_challenge(self, challenger_uid, target_uid):
        # Don't challenge yourself
        if challenger_uid == target_uid:
            return
        self.pending_challenges[challenger_uid] = target_uid
        await self.game_manager.connection_manager.send_to_user(target_uid, {
            "type": "challenge_received",
            "from": challenger_uid
        })
        print(f"[MM] challenge sent: {challenger_uid} → {target_uid}")

    async def respond_challenge(self, responder_uid, challenger_uid, accepted):
        print(f"[MM] respond_challenge: responder={responder_uid} challenger={challenger_uid} accepted={accepted}")

        expected_target = self.pending_challenges.get(challenger_uid)

        if expected_target != responder_uid:
            print(f"[MM] stale/invalid challenge, ignoring")
            await self.game_manager.connection_manager.send_to_user(responder_uid, {
                "type": "error",
                "message": "Challenge no longer valid"
            })
            return

        del self.pending_challenges[challenger_uid]

        if accepted:
            room_id = self.room_manager.create_room(challenger_uid, responder_uid)
            await self.game_manager.start_game(room_id, challenger_uid, responder_uid)
        else:
            await self.game_manager.connection_manager.send_to_user(challenger_uid, {
                "type": "challenge_declined",
                "by": responder_uid
            })

    async def send_chat(self, uid, room_id, message):
        players = self.room_manager.get_players(room_id)
        for p in players:
            await self.game_manager.connection_manager.send_to_user(p, {
                "type": "chat",
                "from": uid,
                "message": message
            })