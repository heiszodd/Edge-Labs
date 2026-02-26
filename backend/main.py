from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import db
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
from backend.config import FRONTEND_URL
from backend.jobs.scheduler import start_scheduler

logger = logging.getLogger(__name__)

app = FastAPI(title='Trading Intelligence Platform API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
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


@app.get('/health')
def health() -> dict:
    return {'status': 'ok'}


app.include_router(auth_router)
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
