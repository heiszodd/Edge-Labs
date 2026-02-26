from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def prediction_scanner_job():
    logger.info('prediction_scanner_job tick')
