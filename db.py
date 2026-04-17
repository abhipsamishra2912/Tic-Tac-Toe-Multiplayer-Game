import sqlite3
from pymongo import MongoClient

conn = sqlite3.connect("project_db", check_same_thread=False)
cursor = conn.cursor()

def get_user(uid):
    cursor.execute("SELECT * FROM users WHERE uid = ?", (uid,))
    return cursor.fetchone()

def user_exists(uid):
    return get_user(uid) is not None

def set_user_online(uid):
    cursor.execute("UPDATE users SET is_online = TRUE WHERE uid = ?", (uid,))
    conn.commit()

def set_user_offline(uid):
    cursor.execute("UPDATE users SET is_online = 0 WHERE uid = ?", (uid,))
    conn.commit()
    
#MONGODB
MONGO_URI = "mongodb+srv://hairband:hairband_a_s_h@cluster0.4ldl2pp.mongodb.net/project_DB_mongo?retryWrites=true&w=majority"
client = MongoClient(MONGO_URI)

db = client["project_DB_mongo"]
collection = db["profile_images"]

def get_images():
    images = {}
    for doc in collection.find():
        uid = doc.get("uid") or str(doc.get("_id", ""))
        image = doc.get("image") or doc.get("image_data")

        if uid and image is not None:
            images[uid] = image
    return images

#retreieves all docs from mongodb collection
#creates a dict of images
#where each uid maps to corresp image data
#doc["uid"] is the key and doc["image" is value]