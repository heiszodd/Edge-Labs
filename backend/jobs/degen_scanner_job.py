from __future__ import annotations

import logging

from backend import db
from engine.solana.trenches_feed import run_degen_scanner_for_user

logger = logging.getLogger(__name__)


async def degen_scanner_job():
    users = db._select_many("users", is_active=True)
    for user in users:
        try:
            await run_degen_scanner_for_user(user["id"])
        except Exception:
            logger.exception("degen_scanner_job user failed: %s", user.get("id"))
    logger.info('degen_scanner_job completed')
