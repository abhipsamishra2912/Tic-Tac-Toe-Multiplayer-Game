from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import base64

from auth import authenticate
from db import set_user_online
from elo_manager import get_leaderboard

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

sessions = {}

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

    uid = authenticate(image_data)

    if uid is None:
        return {"status": "fail", "message": "Face not recognised"}

    sessions[uid] = True
    set_user_online(uid)

    return {
        "status": "success",
        "uid": uid,
        "message": "Login successful"
    }

@app.get("/leaderboard")
def leaderboard():
    return get_leaderboard()