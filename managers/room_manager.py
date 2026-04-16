import uuid

class RoomManager:
    def __init__(self):
        self.rooms = {}          # room_id → room data
        self.user_room = {}      # uid → room_id

    def create_room(self, p1, p2):
        room_id = str(uuid.uuid4())

        self.rooms[room_id] = {
            "players": [p1, p2]
        }

        self.user_room[p1] = room_id
        self.user_room[p2] = room_id

        return room_id

    def get_room(self, uid):
        return self.user_room.get(uid)

    def get_players(self, room_id):
        room = self.rooms.get(room_id)
        if room:
            return room["players"]
        return []

    def remove_room(self, room_id):
        players = self.get_players(room_id)

        for p in players:
            if p in self.user_room:
                del self.user_room[p]

        if room_id in self.rooms:
            del self.rooms[room_id]