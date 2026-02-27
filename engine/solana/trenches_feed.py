from __future__ import annotations

from backend import db
from engine.degen.contract_scanner import scan_contract


async def run_degen_scanner_for_user(user_id) -> list:
    models = db.get_degen_models(user_id, active_only=True)
    if not models:
        return []
    # Placeholder token universe.
    tokens = [{"address": "So11111111111111111111111111111111111111112", "market_cap_usd": 1000000}]
    saved = []
    for token in tokens:
        report = await scan_contract(token["address"])
        for model in models:
            score = _score_against_model(report, model)
            if score >= float(model.get("min_score", 70)):
                sid = db.save_pending_signal({"user_id": user_id, "section": "degen", "status": "pending", "meta": {"token": token, "report": report, "score": score}})
                saved.append({"id": sid, "score": score, "token": token["address"]})
    return saved


def _score_against_model(token_data, model) -> float:
    if token_data.get("honeypot"):
        return 0.0
    max_mcap = float(model.get("max_market_cap_usd", 1e12))
    if float(token_data.get("market_cap_usd", 0) or 0) > max_mcap * 1.2:
        return 0.0
    return max(0.0, min(100.0, float(token_data.get("score", 0) or 0)))
