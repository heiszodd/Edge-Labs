from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from backend import db
from engine.phase_engine import run_phase_scanner_for_user as run_engine_phase_scanner_for_user

logger = logging.getLogger(__name__)


def get_users_with_active_models() -> list[dict]:
    return db._select_many('users', is_active=True)


def _should_run_free(user_id: str) -> bool:
    runs = db._select_many('job_runs', user_id=user_id, job='phase_scanner', order='ran_at', desc=True, limit=1)
    if not runs:
        return True
    last = datetime.fromisoformat(str(runs[0].get('ran_at')).replace('Z', '+00:00'))
    return datetime.now(timezone.utc) - last >= timedelta(minutes=30)


async def run_phase_scanner_for_user(user_id: str, bot_context=None):
    db._insert('job_runs', {'user_id': user_id, 'job': 'phase_scanner', 'ran_at': datetime.now(timezone.utc).isoformat()})
    await run_engine_phase_scanner_for_user(user_id, bot_context)


def _expire_old_signals():
    pass


async def phase_scanner_job():
    users = get_users_with_active_models()
    for user in users:
        tier = user.get('subscription_tier', 'free')
        if tier == 'free' and not _should_run_free(user['id']):
            continue
        await run_phase_scanner_for_user(user['id'], None)
    _expire_old_signals()
    logger.info('phase_scanner_job completed')
