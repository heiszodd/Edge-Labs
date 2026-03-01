from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def price_alerts_job():
    logger.info('price_alerts_job tick')
