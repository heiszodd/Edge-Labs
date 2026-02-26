from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def wallet_tracker_job():
    logger.info('wallet_tracker_job tick')
