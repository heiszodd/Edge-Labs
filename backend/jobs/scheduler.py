from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from backend.jobs.auto_sell_job import auto_sell_job
from backend.jobs.degen_scanner_job import degen_scanner_job
from backend.jobs.hl_monitor_job import hl_monitor_job
from backend.jobs.phase_scanner_job import phase_scanner_job
from backend.jobs.prediction_scanner_job import prediction_scanner_job
from backend.jobs.price_alerts_job import price_alerts_job
from backend.jobs.wallet_tracker_job import wallet_tracker_job

scheduler = AsyncIOScheduler()


def start_scheduler():
    scheduler.add_job(phase_scanner_job, 'interval', minutes=5, id='phase_scanner')
    scheduler.add_job(hl_monitor_job, 'interval', minutes=5, id='hl_monitor')
    scheduler.add_job(degen_scanner_job, 'interval', minutes=15, id='degen_scanner')
    scheduler.add_job(auto_sell_job, 'interval', seconds=60, id='auto_sell')
    scheduler.add_job(wallet_tracker_job, 'interval', seconds=60, id='wallet_tracker')
    scheduler.add_job(price_alerts_job, 'interval', minutes=5, id='price_alerts')
    scheduler.add_job(prediction_scanner_job, 'interval', minutes=15, id='pred_scanner')
    scheduler.start()
