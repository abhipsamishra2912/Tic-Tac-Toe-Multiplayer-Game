from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from auth_router import router as auth_router
from db import ensure_phase2_schema

app = FastAPI(title="BiometricArena – Phase 2")
BASE_DIR = Path(__file__).resolve().parent

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.on_event("startup")
def startup():
    ensure_phase2_schema()


@app.get("/")
async def serve_login():
    return FileResponse(BASE_DIR / "static" / "login.html")


@app.get("/dashboard")
async def serve_dashboard():
    return FileResponse(BASE_DIR / "static" / "dashboard.html")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)