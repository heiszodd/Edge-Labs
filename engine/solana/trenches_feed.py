from __future__ import annotations

import logging

import httpx

from backend import db
from engine.degen.contract_scanner import scan_contract

log = logging.getLogger(__name__)

DEXSCREENER_TOKEN_PROFILES = "https://api.dexscreener.com/token-profiles/latest/v1"


async def _fetch_candidate_tokens(limit: int = 40) -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(DEXSCREENER_TOKEN_PROFILES)
            response.raise_for_status()
            rows = response.json() or []
        out = []
        for row in rows:
            chain_id = str(row.get("chainId") or "").lower()
            if chain_id != "solana":
                continue
            token_address = str(row.get("tokenAddress") or "").strip()
            if token_address and token_address not in out:
                out.append(token_address)
            if len(out) >= limit:
                break
        return out
    except Exception as exc:
        log.warning("degen token universe fetch failed: %s", exc)
        return []


def _score_against_model(token_data: dict, model: dict) -> float:
    if token_data.get("is_honeypot"):
        return 0.0
    mcap = float(token_data.get("mcap_usd", 0) or 0)
    liq = float(token_data.get("liquidity_usd", 0) or 0)
    age_minutes = float(token_data.get("age_hours", 0) or 0) * 60.0
    holders = float(token_data.get("holder_count", 0) or 0)
    rug_score = float(token_data.get("rug_score", 100) or 100)
    safety = float(token_data.get("safety_score", 0) or 0)

    min_mcap = float(model.get("min_mcap_usd", 0) or 0)
    max_mcap = float(model.get("max_mcap_usd", 1e12) or 1e12)
    min_liq = float(model.get("min_liquidity_usd", 0) or 0)
    max_age = float(model.get("max_age_minutes", 1e9) or 1e9)
    min_holders = float(model.get("min_holder_count", 0) or 0)
    max_rug = float(model.get("max_rug_score", 100) or 100)

    if mcap < min_mcap or mcap > max_mcap:
        return 0.0
    if liq < min_liq:
        return 0.0
    if age_minutes > max_age:
        return 0.0
    if holders < min_holders:
        return 0.0
    if rug_score > max_rug:
        return 0.0
    return max(0.0, min(100.0, safety))


async def run_degen_scanner_for_user(user_id) -> list:
    models = db.get_degen_models(user_id, active_only=True)
    if not models:
        return []

    watchlist_tokens = [str(row.get("token_address") or "").strip() for row in db.get_solana_watchlist(user_id)]
    market_tokens = await _fetch_candidate_tokens(limit=40)
    token_addresses = []
    for token in watchlist_tokens + market_tokens:
        if token and token not in token_addresses:
            token_addresses.append(token)

    if not token_addresses:
        return []

    saved = []
    for token_address in token_addresses:
        report = await scan_contract(token_address)
        if not report.get("found"):
            continue
        for model in models:
            score = _score_against_model(report, model)
            threshold = float(model.get("min_score", 70) or 70)
            if score >= threshold:
                sid = db.save_pending_signal(
                    {
                        "user_id": user_id,
                        "section": "degen",
                        "status": "pending",
                        "meta": {
                            "token": {
                                "address": token_address,
                                "symbol": report.get("symbol"),
                                "name": report.get("name"),
                            },
                            "report": report,
                            "score": score,
                            "model_id": model.get("id"),
                        },
                    }
                )
                saved.append({"id": sid, "score": score, "token": token_address, "model_id": model.get("id")})
    return saved
