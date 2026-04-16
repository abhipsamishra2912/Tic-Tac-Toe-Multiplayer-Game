from db import user_exists
from utils.facial_recognition_module import build_encodings_cache, find_closest_match
import asyncio
from db import get_images, user_exists

encodings_cache = {}

def init_cache():
    global encodings_cache
    _db_images = get_images()
    encodings_cache = build_encodings_cache(_db_images)

async def authenticate(login_image_data):
    loop = asyncio.get_event_loop()

    matched_uid = find_closest_match(login_image_data, encodings_cache)

    if matched_uid is None:
        return None

    exists = await loop.run_in_executor(None, user_exists, matched_uid)

    if not exists:
        return None

    return matched_uid