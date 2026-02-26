from __future__ import annotations

import asyncio
import httpx


async def _fetch_dex(address):
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(f"https://api.dexscreener.com/latest/dex/tokens/{address}")
        return r.json() if r.status_code == 200 else {}


async def _fetch_rugcheck(address):
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(f"https://api.rugcheck.xyz/v1/tokens/{address}/report")
        return r.json() if r.status_code == 200 else {}


async def _fetch_jup(address):
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(f"https://tokens.jup.ag/token/{address}")
        return r.json() if r.status_code == 200 else {}


def _composite_score(data) -> float:
    if data.get("honeypot"):
        return 0.0
    score = 100.0
    score -= min(60.0, float(data.get("rug_score", 0) or 0))
    score -= 20.0 if not data.get("lp_locked", False) else 0.0
    score -= min(20.0, float(data.get("dev_wallet_pct", 0) or 0) * 0.5)
    return max(0.0, min(100.0, score))


async def scan_contract(address) -> dict:
    try:
        dex, rug, jup = await asyncio.gather(_fetch_dex(address), _fetch_rugcheck(address), _fetch_jup(address))
        pair = (dex.get("pairs") or [{}])[0]
        out = {
            "score": 0.0,
            "grade": "D",
            "honeypot": bool((rug or {}).get("honeypot", False)),
            "rug_score": float((rug or {}).get("score", 0) or 0),
            "mint_disabled": bool((rug or {}).get("mintDisabled", True)),
            "freeze_disabled": bool((rug or {}).get("freezeDisabled", True)),
            "lp_locked": bool((rug or {}).get("lpLocked", False)),
            "dev_wallet_pct": float((rug or {}).get("devWalletPct", 0) or 0),
            "holder_count": int((rug or {}).get("holders", 0) or 0),
            "market_cap_usd": float((pair or {}).get("fdv", 0) or 0),
            "liquidity_usd": float(((pair or {}).get("liquidity") or {}).get("usd", 0) or 0),
            "price_usd": float((pair or {}).get("priceUsd", 0) or 0),
            "price_change_1h": float(((pair or {}).get("priceChange") or {}).get("h1", 0) or 0),
            "buy_sell_ratio": 1.0,
            "age_minutes": int((pair or {}).get("pairCreatedAt", 0) or 0),
            "warnings": [],
            "symbol": (jup or {}).get("symbol"),
        }
        out["score"] = _composite_score(out)
        out["grade"] = "A" if out["score"] >= 85 else "B" if out["score"] >= 70 else "C" if out["score"] >= 50 else "D"
        return out
    except Exception:
        return {"score": 0.0, "grade": "D", "honeypot": True, "warnings": ["scan_failed"]}


async def quick_rug_check(address) -> dict:
    data = await scan_contract(address)
    return {"score": data.get("score", 0), "grade": data.get("grade", "D"), "honeypot": data.get("honeypot", True)}
