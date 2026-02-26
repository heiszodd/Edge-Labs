from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import db
from backend.config import FRONTEND_URL

logger = logging.getLogger(__name__)

app = FastAPI(title="Trading Intelligence Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    connected = db.verify_connection()
    if connected:
        logger.info("Supabase connection verified")
    else:
        logger.warning("Supabase connection check failed")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
