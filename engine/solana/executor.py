from __future__ import annotations

from backend import db


def _get_keypair(user_id: str):
    key = db.get_encrypted_key(user_id, "sol_private_key")
    return {"ready": bool(key)}


async def execute_jupiter_swap(user_id, plan) -> dict:
    kp = _get_keypair(user_id)
    if not kp["ready"]:
        return {"success": False, "error": "missing key"}
    try:
        return {"success": True, "plan": plan, "slippage": plan.get("slippage_bps", 100)}
    except Exception:
        try:
            plan = {**plan, "slippage_bps": 300}
            return {"success": True, "plan": plan, "retried": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
