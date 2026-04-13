from dotenv import load_dotenv
load_dotenv()

import os
import mysql.connector
from pymongo import MongoClient

MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "hairband_user")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "hairband")
MYSQL_DB = os.getenv("MYSQL_DB", "project_db")

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://hairband:hairband_a_s_h@cluster0.4ldl2pp.mongodb.net/project_DB_mongo?retryWrites=true&w=majority",
)
MONGO_DB = os.getenv("MONGO_DB", "project_DB_mongo")

_mongo_client = None


def get_mysql_connection():
    return mysql.connector.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        autocommit=True,
    )


def ensure_phase2_schema() -> None:
    conn = get_mysql_connection()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            uid VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL
        )
        """
    )

    cur.execute("SHOW COLUMNS FROM users LIKE 'elo_rating'")
    if cur.fetchone() is None:
        cur.execute("ALTER TABLE users ADD COLUMN elo_rating INT NOT NULL DEFAULT 1200")

    cur.execute("SHOW COLUMNS FROM users LIKE 'is_online'")
    if cur.fetchone() is None:
        cur.execute("ALTER TABLE users ADD COLUMN is_online BOOLEAN NOT NULL DEFAULT FALSE")

    conn.close()


def get_mongo_client():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(MONGO_URI)
    return _mongo_client


def get_mongo_collection():
    db = get_mongo_client()[MONGO_DB]
    return db["profile_images"]