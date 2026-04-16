from utils.facial_recognition_module import find_closest_match
from db import user_exists
import asyncio

async def authenticate(login_image_data, encodings_cache):
    loop = asyncio.get_event_loop()
    matched_uid = find_closest_match(login_image_data, encodings_cache)

    if matched_uid is None:
        return None
    exists = await loop.run_in_executor(None, user_exists, matched_uid)
    if not exists:
        return None
    
    return matched_uid