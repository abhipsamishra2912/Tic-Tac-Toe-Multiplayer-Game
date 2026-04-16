import sqlite3
import asyncio

DB_PATH = "project_db.db"

def get_connection():
    return sqlite3.connect(DB_PATH)

def get_player_ratings(uid1, uid2):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT uid, elo_rating FROM users WHERE uid IN (?, ?)",
        (uid1, uid2)
    )
    rows = cursor.fetchall()
    conn.close()

    if len(rows) != 2:
        raise ValueError("One or both users not found")

    ratings = {uid: rating for uid, rating in rows}
    return ratings[uid1], ratings[uid2]

def update_ratings_in_db(uid1, uid2, new_r1, new_r2):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE users SET elo_rating = ? WHERE uid = ?",
            (new_r1, uid1)
        )
        cursor.execute(
            "UPDATE users SET elo_rating = ? WHERE uid = ?",
            (new_r2, uid2)
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def compute_expected_score(r1, r2):
    E1 = 1 / (1 + 10 ** ((r2 - r1) / 400))
    E2 = 1 / (1 + 10 ** ((r1 - r2) / 400))
    return E1, E2

def determine_actual_score(winner_uid, uid1, uid2):
    if winner_uid is None:
        return 0.5, 0.5
    elif winner_uid == uid1:
        return 1.0, 0.0
    elif winner_uid == uid2:
        return 0.0, 1.0
    else:
        raise ValueError("Invalid winner_uid")

def compute_new_ratings(r1, r2, E1, E2, S1, S2, K=32):
    new_r1 = round(r1 + K * (S1 - E1))
    new_r2 = round(r2 + K * (S2 - E2))
    return new_r1, new_r2

async def update_ratings(uid1, uid2, winner_uid):
    loop = asyncio.get_event_loop()

    def sync_task():
        if uid1 == uid2:
            raise ValueError("Cannot update rating for same player")

        r1, r2 = get_player_ratings(uid1, uid2)
        E1, E2 = compute_expected_score(r1, r2)
        S1, S2 = determine_actual_score(winner_uid, uid1, uid2)
        new_r1, new_r2 = compute_new_ratings(r1, r2, E1, E2, S1, S2)
        update_ratings_in_db(uid1, uid2, new_r1, new_r2)
        return {uid1: new_r1, uid2: new_r2}

    return await loop.run_in_executor(None, sync_task)

async def handle_forfeit(winner_uid, loser_uid):
    return await update_ratings(winner_uid, loser_uid, winner_uid)

async def get_leaderboard():
    loop = asyncio.get_event_loop()

    def sync_task():
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT uid, name, elo_rating FROM users ORDER BY elo_rating DESC"
        )
        rows = cursor.fetchall()
        conn.close()

        return [
            {"uid": uid, "name": name, "elo_rating": rating}
            for uid, name, rating in rows
        ]

    return await loop.run_in_executor(None, sync_task)