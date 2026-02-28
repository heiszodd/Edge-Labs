from __future__ import annotations

import logging

from backend import db
from backend.services.external_api import request_json

log = logging.getLogger(__name__)

_BASE = "https://api.hyperliquid.xyz/info"


def _to_num(value, default=0.0) -> float:
    try:
        return float(value or 0)
    except Exception:
        return float(default)


async def _get_address(user_id: str) -> str | None:
    """
    Returns the normalized 0x address for this user or None.
    Never raises.
    """
    try:
        raw = db.get_user_hl_address(user_id)
        if not raw:
            return None
        addr = str(raw).strip()
        if not addr.startswith("0x"):
            addr = f"0x{addr}"
        if len(addr) != 42:
            log.warning("HL address wrong length for user %s: %s chars", user_id, len(addr))
            return None
        return addr
    except Exception as exc:
        log.error("get_address %s: %s", user_id, exc)
        return None


async def fetch_api_health() -> dict:
    _, failure = await request_json("POST", _BASE, json={"type": "meta"}, timeout=10.0)
    if failure:
        return {"status": "disconnected", "latency_ms": None, "reason": failure.reason}
    return {"status": "connected", "latency_ms": None, "reason": ""}


async def fetch_account_summary(user_id: str) -> dict:
    addr = await _get_address(user_id)
    if not addr:
        return {
            "error": "no_address",
            "message": "No Hyperliquid wallet connected",
            "accountValue": 0.0,
            "totalMarginUsed": 0.0,
            "availableMargin": 0.0,
        }
    try:
        data, failure = await request_json("POST", _BASE, json={"type": "clearinghouseState", "user": addr}, timeout=10.0)
        if failure:
            return {"error": failure.reason, "message": failure.detail, "accountValue": 0.0, "totalMarginUsed": 0.0, "availableMargin": 0.0}
        payload = data or {}
        margin = payload.get("marginSummary", {})
        return {
            "connected": True,
            "hl_address": addr,
            "accountValue": _to_num(margin.get("accountValue")),
            "availableMargin": _to_num(margin.get("availableMargin")),
            "totalMarginUsed": _to_num(margin.get("totalMarginUsed")),
            "assetPositions": payload.get("assetPositions", []),
        }
    except Exception as exc:
        log.error("fetch_account_summary %s: %s", user_id, exc)
        return {"error": str(exc), "accountValue": 0.0, "totalMarginUsed": 0.0, "availableMargin": 0.0}


async def fetch_positions(user_id: str) -> list:
    addr = await _get_address(user_id)
    if not addr:
        return []
    try:
        data, failure = await request_json("POST", _BASE, json={"type": "clearinghouseState", "user": addr}, timeout=10.0)
        if failure:
            return []
        out = []
        for item in (data or {}).get("assetPositions", []):
            pos = item.get("position", {})
            size = _to_num(pos.get("szi"))
            entry = _to_num(pos.get("entryPx"))
            mark = _to_num(pos.get("markPx"), default=entry)
            pnl = (mark - entry) * size
            out.append(
                {
                    "coin": pos.get("coin"),
                    "side": "long" if size >= 0 else "short",
                    "size": abs(size),
                    "entry_price": entry,
                    "mark_price": mark,
                    "live_upnl": pnl,
                    "live_upnl_pct": 0.0 if entry == 0 else pnl / max(abs(entry * size), 1e-9),
                    "leverage": _to_num((pos.get("leverage") or {}).get("value")),
                    "liquidation_price": _to_num(pos.get("liquidationPx")),
                }
            )
        return out
    except Exception as exc:
        log.error("fetch_positions %s: %s", user_id, exc)
        return []


async def fetch_open_orders(user_id: str) -> list:
    addr = await _get_address(user_id)
    if not addr:
        return []
    try:
        data, failure = await request_json("POST", _BASE, json={"type": "openOrders", "user": addr}, timeout=10.0)
        if failure:
            return []
        return data or []
    except Exception as exc:
        log.error("fetch_open_orders %s: %s", user_id, exc)
        return []


async def fetch_trade_history(user_id: str, limit: int = 100) -> list:
    addr = await _get_address(user_id)
    if not addr:
        return []
    try:
        data, failure = await request_json("POST", _BASE, json={"type": "userFills", "user": addr}, timeout=10.0)
        if failure:
            return []
        fills = data or []
        return fills[: int(limit)] if fills else []
    except Exception as exc:
        log.error("fetch_trade_history %s: %s", user_id, exc)
        return []


# Backward compatible exports used elsewhere.
async def fetch_positions_with_prices(user_id: str) -> tuple[list, None]:
    return await fetch_positions(user_id), None


async def fetch_open_orders_parsed(user_id: str) -> tuple[list, None]:
    return await fetch_open_orders(user_id), None

