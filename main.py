from fastapi import WebSocket, WebSocketDisconnect, FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import asyncio
import json
from managers.game_manager import GameManager
from managers.elo_manager import update_ratings
from managers.ws_manager import ConnectionManager
from auth import authenticate
from db import set_user_online
from managers.match_manager import MatchManager
from managers.room_manager import RoomManager
from utils.facial_recognition_module import build_encodings_cache
app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

sessions = {}
match_manager = MatchManager()
room_manager = RoomManager()
game_manager = GameManager(None, update_ratings, room_manager)
manager = ConnectionManager(match_manager, room_manager, game_manager)
game_manager.connection_manager = manager
match_manager.room_manager = room_manager
match_manager.game_manager = game_manager

@app.on_event("startup")
async def startup():
    loop = asyncio.get_event_loop()
    db_images = await loop.run_in_executor(None, get_images)
    global encodings_cache
    encodings_cache = build_encodings_cache(db_images)
    print(f"Server ready. Encodings cache loaded.")
    
@app.get("/")
def serve_login():
    return FileResponse("static/login.html")

@app.post("/login")
async def login(request: Request):
    data = await request.json()
    image_data = data.get("image")

    if not image_data:
        return {"status": "error", "message": "No image provided"}

    if "," in image_data:
        image_data = image_data.split(",", 1)[1]

    uid=await authenticate(image_data)

    if uid is None:
        return {"status": "fail", "message": "Face not recognised"}

    sessions[uid] = True
    set_user_online(uid)

    return {
        "status": "success",
        "uid": uid,
        "message": "Login successful"
    }



from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws/{uid}")
async def websocket_endpoint(websocket: WebSocket, uid: str):
    await manager.connect(uid, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.handle_message(uid, data)
    except WebSocketDisconnect:
        await manager.disconnect(uid)
