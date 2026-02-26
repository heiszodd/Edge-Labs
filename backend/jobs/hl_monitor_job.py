from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def hl_monitor_job():
    logger.info('hl_monitor_job tick')
