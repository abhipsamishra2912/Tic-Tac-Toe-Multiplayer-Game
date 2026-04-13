from utils.facial_recognition_module import find_closest_match
from db import get_images, user_exists

def authenticate(login_image_data):
    db_images = get_images()

    matched_uid = find_closest_match(login_image_data, db_images)

    if matched_uid is None:
        return None
    
    if not user_exists(matched_uid):
        return None
    
    return matched_uid