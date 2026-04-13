from fastapi import FastAPI, Request
from auth import authenticate
from db import set_user_online
import base64

app = FastAPI() 
#initialization

sessions = {}

@app.post("/login")
async def login(request: Request):
    data = await request.json()
    image_data = data.get("image")

    if not image_data:
        return {"status": "error", "message": "No image provided"}
    
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]
    image_data = base64.b64decode(image_data)

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