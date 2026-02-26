from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def degen_scanner_job():
    logger.info('degen_scanner_job tick')
