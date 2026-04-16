from utils.facial_recognition_module import find_closest_match
from db import get_images, user_exists
import asyncio

async def authenticate(login_image_data):
    loop = asyncio.get_event_loop()
    db_images = await loop.run_in_executor(None, get_images)  # run sync in thread
    matched_uid = find_closest_match(login_image_data, db_images)

    if matched_uid is None:
        return None
    exists = await loop.run_in_executor(None, user_exists, matched_uid)
    if not exists:
        return None
    
    return matched_uid