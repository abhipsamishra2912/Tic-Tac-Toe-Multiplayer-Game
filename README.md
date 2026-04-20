# Hairband — Multiplayer Tic-Tac-Toe with Face Login

Multiplayer Tic-Tac-Toe where players log in using their face via webcam. Backend is FastAPI + WebSockets. We're using SQLite for user/ELO data and MongoDB for face embeddings and sessions.

---

## Project Structure

```
project/
├── main.py                  # entry point, all route definitions go here
├── db.py                    # db connection + helper functions (set_user_offline etc.)
├── managers/
│   ├── ws_manager.py        # websocket connections
│   ├── game_manager.py      # game logic
│   ├── match_manager.py     # matchmaking + challenge system
│   ├── room_manager.py      # room tracking
│   └── elo_manager.py       # elo calculation + leaderboard
├── static/
│   ├── login.html / .css / .js
│   ├── lobby.html / lobby.css
│   ├── arena.js
│   ├── leaderboard.html / .css / .js
│   └── theme.js
└── README.md
```

---

## Managers — What We Built & Why

### `ws_manager.py` — Connection Manager

This is the main hub. Every message from the frontend comes here first.

**What it does:**
- `connect(uid, websocket)` — accepts the connection, saves it in `webdict`, checks if user was mid-game and re-sends board state if so, then broadcasts lobby update
- `disconnect(uid)` — removes user from `webdict`, removes from match queue, calls `set_user_offline()` in db, triggers `force_win` for opponent if a game was active
- `send_to_user(uid, message)` — looks up user's websocket from `webdict` and sends JSON
- `broadcast(message)` — sends a message to every connected user
- `broadcast_lobby_update()` — sends updated online users list to everyone
- `handle_message(uid, data)` — parses incoming JSON and routes to the right manager based on `type` field

**Message types handled here:**
`find_match`, `send_challenge`, `respond_challenge`, `move`, `chat`, `forfeit`

---

### `match_manager.py` — Match Manager

Handles everything before the game starts — queue and challenges.

**What it does:**
- `find_match(uid)` — adds player to `waiting` list, if 2 players are waiting pops both and starts a game. Skips if player is already in a room
- `add_player(uid)` / `remove_player(uid)` — manages the waiting queue
- `send_challenge(challenger_uid, target_uid)` — stores challenge in `pending_challenges`, sends `challenge_received` to target
- `respond_challenge(responder_uid, challenger_uid, accepted)` — checks challenge is still valid, creates room and starts game if accepted, sends `challenge_declined` to challenger if not
- `send_chat(uid, room_id, message)` — gets players in room, relays chat message to both

---

### `room_manager.py` — Room Manager

Just tracks which players are in which room. Very simple, other managers call into this a lot.

**What it does:**
- `create_room(p1, p2)` — generates a UUID room ID, stores `{players: [p1, p2]}` in `rooms` dict, maps both uids in `user_room` dict
- `get_room(uid)` — returns room ID for a user, or None if not in a room
- `get_players(room_id)` — returns list of both players in a room
- `remove_room(room_id)` — deletes room from `rooms`, removes both players from `user_room`

---

### `game_manager.py` — Game Manager

Core game logic. Stores all active games in memory.

**Game object looks like this:**
```python
{
  "room_id": "...",
  "player1": "uid1",
  "player2": "uid2",
  "board": [None] * 9,   # 9 cells, None = empty
  "turn": "uid1",        # whose turn it is
  "symbol": {"uid1": "X", "uid2": "O"},
  "status": "active"
}
```

**What it does:**
- `start_game(room_id, player1, player2)` — creates the game object above, saves to `games` dict, calls `send_game_start`
- `handle_move(uid, room_id, position)` — validates move (correct player, correct turn, cell empty, position 0-8), places symbol on board, checks for win/draw, switches turn, calls `send_game_update`
- `check_win(board)` — checks all 8 winning patterns, returns winning symbol or None
- `check_draw(board)` — returns True if all 9 cells are filled
- `end_game(room_id, winner_uid)` — sets status to finished, calls `send_game_end`, calls elo_manager to update ratings, removes game from memory, calls `room_manager.remove_room`
- `force_win(room_id, winner_uid)` — just calls `end_game`, used for forfeits and disconnects
- `handle_disconnect(uid)` — finds user's room, gives opponent the win
- `send_game_start(game)` — sends each player their symbol, opponent uid, current board, whose turn
- `send_game_update(game)` — sends updated board + whose turn to both players
- `send_game_end(game, winner_uid)` — sends winner uid + final board to both players

---

### `elo_manager.py` — ELO Manager

Handles rating updates after every game. All DB calls run in a thread executor so they don't block the async server.

**Functions:**
- `get_player_ratings(uid1, uid2)` — fetches both players' `elo_rating` from SQLite
- `compute_expected_score(r1, r2)` — standard ELO formula: `E = 1 / (1 + 10^((opp - player) / 400))`
- `determine_actual_score(winner_uid, uid1, uid2)` — win = 1.0/0.0, draw = 0.5/0.5
- `compute_new_ratings(r1, r2, E1, E2, S1, S2, K=32)` — applies K-factor, rounds result
- `update_ratings_in_db(uid1, uid2, new_r1, new_r2)` — saves new ratings to SQLite
- `update_ratings(uid1, uid2, winner_uid)` — async wrapper that runs all the above in sequence
- `handle_forfeit(winner_uid, loser_uid)` — calls update_ratings with winner as winner
- `get_leaderboard()` — fetches all users ordered by `elo_rating DESC` for the leaderboard page

---

## Database

### SQLite — `project_db`

Used for users, ELO ratings, and online status.

**Why SQLite and not MySQL:** MySQL needs a server running on every machine. Since everyone on the team works locally, that means configuring it separately on each device. SQLite is just a file — clone the repo and it works. Schema is the same so switching to MySQL later only needs a connection string change.

**Schema:**
```sql
CREATE TABLE users (
    uid        TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    elo_rating INTEGER DEFAULT 1000,
    is_online  INTEGER DEFAULT 0
);
```

**Set up:**
```bash
sqlite3 project_db < schema.sql
```

---

### MongoDB — Face embeddings & Sessions

**`users` collection** — stores face data for login:
```json
{ "_id": "<uid>", "name": "Alice", "face_embedding": [0.12, -0.45, ...] }
```

**`sessions` collection** — stores login sessions:
```json
{ "session_token": "<uuid>", "uid": "<uid>", "expires_at": "..." }
```

**Set up:**
```bash
mongod --dbpath ./data/db --port 27017

mongosh project_db --eval "
  db.users.createIndex({ uid: 1 }, { unique: true });
  db.sessions.createIndex({ session_token: 1 }, { unique: true });
  db.sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
"
```

---

## How to Run

```bash
# 1. install deps
uv add fastapi uvicorn websockets face-recognition numpy Pillow pymongo python-multipart

# note: face-recognition needs cmake
# ubuntu: sudo apt-get install cmake build-essential
# mac: brew install cmake

# 2. start mongodb
mongod --dbpath ./data/db --port 27017

# 3. init sqlite
sqlite3 project_db < schema.sql

# 4. start server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Pages:**
- Login → `http://localhost:8000/static/login.html`
- Lobby/Game → `http://localhost:8000/static/lobby.html`
- Leaderboard → `http://localhost:8000/static/leaderboard.html`

---

## WebSocket Message Reference

All messages are JSON with a `type` field. Connection is at `ws://localhost:8000/ws/{uid}`.

### Client → Server

| type | payload | description |
|------|---------|-------------|
| `find_match` | — | join random queue |
| `send_challenge` | `{ target_uid }` | challenge specific player |
| `respond_challenge` | `{ challenger_uid, accepted }` | accept or decline |
| `move` | `{ room_id, position }` | play at cell 0–8 |
| `chat` | `{ room_id, message }` | in-game chat |
| `forfeit` | — | give up |

### Server → Client

| type | payload | description |
|------|---------|-------------|
| `lobby_update` | `{ online_users[] }` | who's online right now |
| `challenge_received` | `{ from }` | someone challenged you |
| `challenge_declined` | `{ by }` | your challenge was declined |
| `game_start` | `{ room_id, symbol, turn, opponent, board }` | game is starting |
| `game_update` | `{ room_id, board, turn, symbol }` | board after a move |
| `game_end` | `{ room_id, winner, board }` | game over, winner = null for draw |
| `chat` | `{ from, message }` | opponent's message |
| `error` | `{ message }` | e.g. `not_your_turn`, `cell_taken` |

---
### chats
https://chatgpt.com/share/69e5d5d2-ece4-8321-a6c7-321686877def
### reference
https://dev.to/amverum/websockets-on-fastapi-implementing-a-simple-chat-with-rooms-in-20-minutes-26hj
https://www.sqlitetutorial.net/sqlite-upsert/
https://www.w3schools.com/python/python_mongodb_update.asp
https://www.w3schools.com/python/module_requests.asp
https://www.geeksforgeeks.org/pandas/reading-csv-files-in-python/https://www.geeksforgeeks.org/pandas/reading-csv-files-in-python/
https://www.geeksforgeeks.org/pandas/reading-csv-files-in-python/
