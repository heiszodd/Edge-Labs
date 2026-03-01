from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def auto_sell_job():
    logger.info('auto_sell_job tick')
