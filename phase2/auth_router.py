import base64
import secrets
from typing import Optional

from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel

from db import get_mysql_connection, get_mongo_collection

from utils.facial_recognition_module import find_closest_match

router = APIRouter()

_sessions: dict[str, str] = {}

SESSION_COOKIE = "arena_session"   


class LoginRequest(BaseModel):
    image_data: str         


class LoginResponse(BaseModel):
    success: bool
    uid: Optional[str] = None
    name: Optional[str] = None
    message: str


class MeResponse(BaseModel):
    uid: str
    name: str
    elo_rating: int



def _load_db_images() -> dict[str, str]:
    collection = get_mongo_collection()
    db_images  = {}

    for doc in collection.find({}, {"_id": 1, "uid": 1, "image_data": 1, "image": 1}):
        uid = str(doc.get("_id") or doc.get("uid") or "")
        image_data = doc.get("image_data")
        if image_data is None:
            image_data = doc.get("image")

        if not uid or image_data is None:
            continue 

        db_images[uid] = image_data

    return db_images


def _get_user(uid: str) -> Optional[dict]:
    """Return the MySQL users row for uid, or None if not found."""
    conn   = get_mysql_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT uid, name, elo_rating, is_online FROM users WHERE uid = %s",
        (uid,)
    )
    user = cursor.fetchone()
    conn.close()
    return user



def _set_online(uid: str, online: bool) -> None:
    """Flip the is_online column for a user in MySQL."""
    conn   = get_mysql_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET is_online = %s WHERE uid = %s",
        (1 if online else 0, uid)
    )
    conn.close()


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, response: Response):
    image_b64 = request.image_data

    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Base64 image data")

    db_images = _load_db_images()

    if not db_images:
        raise HTTPException(
            status_code=503,
            detail="No profile images in database. Run Phase 1 scraper first."
        )

    matched_uid = find_closest_match(image_bytes, db_images)

    if matched_uid is None:
        return LoginResponse(
            success=False,
            message="Face not recognised. Please try again in better lighting."
        )

    user = _get_user(matched_uid)

    if user is None:
        return LoginResponse(
            success=False,
            message="User record not found in database."
        )

    session_token = secrets.token_hex(32)   
    _sessions[session_token] = matched_uid

    _set_online(matched_uid, online=True)

    response.set_cookie(
        key=SESSION_COOKIE,
        value=session_token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 8,    
    )

    return LoginResponse(
        success=True,
        uid=matched_uid,
        name=user["name"],
        message=f"Welcome, {user['name']}!"
    )


@router.post("/logout")
async def logout(request: Request, response: Response):
   
    token = request.cookies.get(SESSION_COOKIE)

    if token and token in _sessions:
        uid = _sessions.pop(token)
        _set_online(uid, online=False)

    response.delete_cookie(SESSION_COOKIE)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=MeResponse)
async def get_me(request: Request):
    token = request.cookies.get(SESSION_COOKIE)

    if not token or token not in _sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")

    uid  = _sessions[token]
    user = _get_user(uid)

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return MeResponse(
        uid=user["uid"],
        name=user["name"],
        elo_rating=user["elo_rating"],
    )



def get_uid_from_session(token: str) -> Optional[str]:
    return _sessions.get(token)
