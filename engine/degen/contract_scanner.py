from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from backend.config import HELIUS_RPC_URL

log = logging.getLogger(__name__)

DEXSCREENER = "https://api.dexscreener.com/latest/dex/tokens"
RUGCHECK = "https://api.rugcheck.xyz/v1/tokens"
HELIUS_API = "https://api.helius.xyz/v0"


def _error_report(ca: str, error: str) -> dict:
    return {
        "ca": ca,
        "found": False,
        "error": error,
        "name": "Unknown",
        "symbol": "???",
        "scan_ok": False,
    }


async def _fetch_dexscreener(ca: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{DEXSCREENER}/{ca}")
        response.raise_for_status()
        data = response.json()
        pairs = data.get("pairs") or []
        if not pairs:
            return {}
        return max(pairs, key=lambda pair: float((pair.get("liquidity") or {}).get("usd", 0) or 0))


async def _fetch_rugcheck(ca: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{RUGCHECK}/{ca}/report/summary")
        if response.status_code == 404:
            return {}
        response.raise_for_status()
        return response.json()


async def _fetch_helius(ca: str) -> dict:
    if not HELIUS_RPC_URL:
        return {}
    try:
        api_key = HELIUS_RPC_URL.split("api-key=")[-1].split("&")[0]
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{HELIUS_API}/token-metadata",
                params={"api-key": api_key, "mint": ca},
            )
            if response.status_code != 200:
                return {}
            return response.json()
    except Exception:
        return {}


def _calculate_safety_score(
    mcap_usd,
    liq_usd,
    age_hours,
    holder_count,
    rug_score,
    bs_ratio,
    mint_disabled,
    freeze_disabled,
    lp_locked,
    is_honeypot,
    dev_pct,
    price_change_1h,
) -> int:
    if is_honeypot:
        return 0

    score = 0
    if mcap_usd >= 1_000_000:
        score += 20
    elif mcap_usd >= 500_000:
        score += 16
    elif mcap_usd >= 100_000:
        score += 12
    elif mcap_usd >= 10_000:
        score += 7
    else:
        score += 2

    if liq_usd >= 100_000:
        score += 20
    elif liq_usd >= 50_000:
        score += 16
    elif liq_usd >= 10_000:
        score += 11
    elif liq_usd >= 5_000:
        score += 6
    else:
        score += 1

    if age_hours >= 720:
        score += 10
    elif age_hours >= 168:
        score += 8
    elif age_hours >= 24:
        score += 5
    elif age_hours >= 6:
        score += 2

    if holder_count >= 1000:
        score += 10
    elif holder_count >= 500:
        score += 8
    elif holder_count >= 100:
        score += 5
    elif holder_count >= 50:
        score += 2

    score += max(0, 15 - int(float(rug_score or 0) * 0.15))

    if 0.8 <= bs_ratio <= 3.0:
        score += 10
    elif 0.5 <= bs_ratio <= 5.0:
        score += 6
    else:
        score += 2

    if mint_disabled:
        score += 5
    if freeze_disabled:
        score += 5
    if lp_locked:
        score += 5

    if dev_pct > 30:
        score -= 10
    elif dev_pct > 20:
        score -= 5

    if abs(price_change_1h) > 80:
        score -= 6

    return max(0, min(100, score))


def _build_report(ca, dex, rug, helius) -> dict:
    base_token = dex.get("baseToken", {})
    name = base_token.get("name", "Unknown")
    symbol = base_token.get("symbol", "???")
    price_usd = float(dex.get("priceUsd", 0) or 0)

    mcap_usd = float(dex.get("marketCap", 0) or 0) or float(dex.get("fdv", 0) or 0)
    liq_usd = float((dex.get("liquidity") or {}).get("usd", 0) or 0)
    volume_24h = float((dex.get("volume") or {}).get("h24", 0) or 0)

    created_at = dex.get("pairCreatedAt")
    age_hours = 0.0
    if created_at:
        try:
            created_dt = datetime.fromtimestamp(int(created_at) / 1000, tz=timezone.utc)
            age_hours = (datetime.now(timezone.utc) - created_dt).total_seconds() / 3600
        except Exception:
            pass

    price_change_24h = float((dex.get("priceChange") or {}).get("h24", 0) or 0)
    price_change_1h = float((dex.get("priceChange") or {}).get("h1", 0) or 0)

    txns = (dex.get("txns") or {}).get("h24", {})
    buys = int(txns.get("buys", 0) or 0)
    sells = int(txns.get("sells", 0) or 0)
    bs_ratio = round(buys / sells, 2) if sells > 0 else (10.0 if buys > 0 else 1.0)

    rug_score = rug.get("score", 50) or 50
    risks = rug.get("risks", []) or []
    mint_disabled = not rug.get("mintAuthority")
    freeze_disabled = not rug.get("freezeAuthority")
    lp_locked = bool(rug.get("lpLocked", False))
    verified = bool(rug.get("verified", False))
    top_holders = rug.get("topHolders", []) or []
    holder_count = int(rug.get("totalHolders", 0) or 0)
    if not holder_count:
        holder_count = int((helius or {}).get("holders", 0) or 0)

    dev_pct = 0.0
    if top_holders:
        dev_pct = float(top_holders[0].get("pct", 0) or 0) * 100

    is_honeypot = any("honeypot" in str(r).lower() or "honeypot" in str(r.get("name", "")).lower() for r in risks)

    safety_score = _calculate_safety_score(
        mcap_usd=mcap_usd,
        liq_usd=liq_usd,
        age_hours=age_hours,
        holder_count=holder_count,
        rug_score=rug_score,
        bs_ratio=bs_ratio,
        mint_disabled=mint_disabled,
        freeze_disabled=freeze_disabled,
        lp_locked=lp_locked,
        is_honeypot=is_honeypot,
        dev_pct=dev_pct,
        price_change_1h=price_change_1h,
    )

    grade = (
        "S"
        if safety_score >= 90
        else "A"
        if safety_score >= 80
        else "B"
        if safety_score >= 70
        else "C"
        if safety_score >= 60
        else "D"
        if safety_score >= 50
        else "F"
    )

    warnings = []
    if is_honeypot:
        warnings.append("⚠ HONEYPOT DETECTED")
    if dev_pct > 20:
        warnings.append(f"⚠ Dev holds {dev_pct:.1f}%")
    if not lp_locked:
        warnings.append("⚠ LP not locked")
    if not mint_disabled:
        warnings.append("⚠ Mint authority active")
    if age_hours < 1:
        warnings.append("⚠ Token < 1 hour old")
    if liq_usd < 5000:
        warnings.append("⚠ Very low liquidity")
    if float(rug_score or 0) > 70:
        warnings.append(f"⚠ High rug score ({rug_score})")

    return {
        "ca": ca,
        "found": True,
        "name": name,
        "symbol": symbol,
        "price_usd": price_usd,
        "price_change_1h": price_change_1h,
        "price_change_24h": price_change_24h,
        "mcap_usd": mcap_usd,
        "liquidity_usd": liq_usd,
        "volume_24h": volume_24h,
        "age_hours": round(age_hours, 1),
        "holder_count": holder_count,
        "dev_wallet_pct": round(dev_pct, 1),
        "rug_score": rug_score,
        "safety_score": safety_score,
        "grade": grade,
        "bs_ratio": bs_ratio,
        "buys_24h": buys,
        "sells_24h": sells,
        "is_honeypot": is_honeypot,
        "mint_disabled": mint_disabled,
        "freeze_disabled": freeze_disabled,
        "lp_locked": lp_locked,
        "verified": verified,
        "warnings": warnings,
        "risks": [r.get("name", "") for r in risks[:5]],
        "dex_url": dex.get("url", ""),
        "pair_address": dex.get("pairAddress", ""),
        "chain": "solana",
        "scan_ok": True,
    }


async def scan_contract(ca: str) -> dict:
    ca = str(ca or "").strip()
    if not ca or len(ca) < 32 or len(ca) > 44:
        return _error_report(ca, "Invalid Solana address format")
    try:
        dex_data, rug_data, helius_data = await asyncio.gather(
            _fetch_dexscreener(ca),
            _fetch_rugcheck(ca),
            _fetch_helius(ca),
            return_exceptions=True,
        )

        if isinstance(dex_data, Exception):
            log.error("DexScreener error for %s: %s", ca, dex_data)
            dex_data = {}
        if isinstance(rug_data, Exception):
            log.error("RugCheck error for %s: %s", ca, rug_data)
            rug_data = {}
        if isinstance(helius_data, Exception):
            log.error("Helius error for %s: %s", ca, helius_data)
            helius_data = {}

        if not dex_data and not rug_data:
            return _error_report(ca, "Token not found on DexScreener or RugCheck")

        return _build_report(ca, dex_data, rug_data, helius_data)
    except Exception as exc:
        log.error("scan_contract %s: %s", ca, exc)
        return _error_report(ca, str(exc))


async def quick_rug_check(address) -> dict:
    data = await scan_contract(address)
    return {
        "score": data.get("safety_score", 0),
        "grade": data.get("grade", "F"),
        "honeypot": data.get("is_honeypot", True),
    }
