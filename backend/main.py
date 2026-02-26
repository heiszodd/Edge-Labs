from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import config, db
from backend.api.admin import router as admin_router
from backend.api.alerts import router as alerts_router
from backend.api.analytics import router as analytics_router
from backend.api.auth import router as auth_router
from backend.api.backtesting import router as backtesting_router
from backend.api.degen import router as degen_router
from backend.api.journal import router as journal_router
from backend.api.payments import router as payments_router
from backend.api.perps import router as perps_router
from backend.api.predictions import router as predictions_router
from backend.api.signals import router as signals_router
from backend.api.users import router as users_router
from backend.api.wallets import router as wallets_router
from backend.config import ALLOW_ALL_CORS, CORS_ORIGIN_REGEX, FRONTEND_URLS
from backend.jobs.scheduler import start_scheduler

logger = logging.getLogger(__name__)

app = FastAPI(title='Trading Intelligence Platform API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ALLOW_ALL_CORS else (FRONTEND_URLS or ["http://localhost:5173"]),
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.on_event('startup')
def startup_event():
    connected = db.verify_connection()
    if connected:
        logger.info('Supabase connection verified')
    else:
        logger.warning('Supabase connection check failed')
    try:
        start_scheduler()
    except Exception:
        logger.exception('Scheduler failed to start')
    try:
        bootstrap_admin()
    except Exception:
        logger.exception("Admin bootstrap failed")


def bootstrap_admin():
    email = config.ADMIN_BOOTSTRAP_EMAIL
    password = config.ADMIN_BOOTSTRAP_PASSWORD
    username = config.ADMIN_BOOTSTRAP_USERNAME or "admin"
    if not email or not password:
        return
    if not db._client:
        logger.warning("Admin bootstrap skipped: Supabase client unavailable")
        return

    existing = db.get_user_by_email(email)
    if existing:
        db.update_user(
            existing.get("id"),
            {
                "role": "admin",
                "is_admin": True,
                "subscription_tier": "premium",
                "subscription_status": "active",
            },
        )
        logger.info("Admin bootstrap ensured existing user: %s", email)
        return

    user_id = None
    try:
        admin_api = getattr(getattr(db._client, "auth", None), "admin", None)
        if admin_api and hasattr(admin_api, "create_user"):
            created = admin_api.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"username": username},
                }
            )
            created_user = getattr(created, "user", None) or getattr(created, "data", None)
            user_id = getattr(created_user, "id", None) or (created_user.get("id") if isinstance(created_user, dict) else None)
        if not user_id:
            signed = db._client.auth.sign_up({"email": email, "password": password})
            signed_user = getattr(signed, "user", None)
            user_id = getattr(signed_user, "id", None)
    except Exception:
        logger.exception("Failed creating admin auth user")
        return

    if not user_id:
        logger.warning("Admin bootstrap could not resolve user id for %s", email)
        return

    db._upsert(
        "users",
        {
            "id": user_id,
            "email": email,
            "username": username,
            "role": "admin",
            "is_admin": True,
            "subscription_tier": "premium",
            "subscription_status": "active",
        },
        on_conflict="id",
    )
    db.create_user_defaults(user_id)
    logger.info("Admin bootstrap user created: %s", email)


@app.get('/health')
def health() -> dict:
    return {'status': 'ok'}


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(perps_router)
app.include_router(degen_router)
app.include_router(predictions_router)
app.include_router(wallets_router)
app.include_router(signals_router)
app.include_router(backtesting_router)
app.include_router(analytics_router)
app.include_router(alerts_router)
app.include_router(journal_router)
app.include_router(payments_router)
app.include_router(users_router)
