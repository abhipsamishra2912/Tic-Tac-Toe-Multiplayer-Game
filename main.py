from fastapi import WebSocket, WebSocketDisconnect, FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from auth import authenticate, init_cache
from managers.game_manager import GameManager
from managers.elo_manager import update_ratings, get_leaderboard
from managers.ws_manager import ConnectionManager
from managers.match_manager import MatchManager
from managers.room_manager import RoomManager
from db import set_user_online

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

sessions = {}
match_manager = MatchManager()
room_manager  = RoomManager()
game_manager  = GameManager(None, update_ratings, room_manager)
manager       = ConnectionManager(match_manager, room_manager, game_manager)
game_manager.connection_manager = manager
match_manager.room_manager  = room_manager
match_manager.game_manager  = game_manager

@app.on_event("startup")
async def startup_event():
    print("Building face encodings cache...")
    init_cache()
    print("Cache ready")

@app.get("/")
def serve_login():
    return FileResponse("static/login.html")

@app.get("/static/lobby.html")
def serve_lobby():
    return FileResponse("static/lobby.html")

@app.get("/static/game.html")
def serve_game():
    return FileResponse("static/game.html")

@app.get("/static/leaderboard.html")
def serve_leaderboard_page():
    return FileResponse("static/leaderboard.html")

@app.post("/login")
async def login(request: Request):
    data = await request.json()
    image_data = data.get("image")

    if not image_data:
        return {"status": "error", "message": "No image provided"}

    if "," in image_data:
        image_data = image_data.split(",", 1)[1]

    uid = await authenticate(image_data)

    if uid is None:
        return {"status": "fail", "message": "Face not recognised"}

    sessions[uid] = True
    set_user_online(uid)

    return {"status": "success", "uid": uid}

@app.get("/leaderboard")
async def leaderboard():
    data = await get_leaderboard()
    return JSONResponse(data)

@app.websocket("/ws/{uid}")
async def websocket_endpoint(websocket: WebSocket, uid: str):
    await manager.connect(uid, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.handle_message(uid, data)
    except WebSocketDisconnect:
        await manager.disconnect(uid)