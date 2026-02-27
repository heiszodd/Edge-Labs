from __future__ import annotations

import logging

from backend import db
from engine.polymarket.scanner import run_scanner_for_user

logger = logging.getLogger(__name__)


async def prediction_scanner_job():
    users = db._select_many("users", is_active=True)
    for user in users:
        try:
            await run_scanner_for_user(user["id"])
        except Exception:
            logger.exception("prediction_scanner_job user failed: %s", user.get("id"))
    logger.info('prediction_scanner_job completed')
