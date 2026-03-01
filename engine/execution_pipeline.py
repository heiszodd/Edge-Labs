from __future__ import annotations

from backend import db
from backend.security import spending_limits


async def run_execution_pipeline(section, plan, executor, user_id, context=None, skip_confirm=False) -> dict:
    if db._select_one("emergency_stop", user_id=user_id).get("halted"):
        return {"success": False, "error": "halted"}
    user = db.get_user_by_id(user_id)
    tier = str(user.get("subscription_tier", "free")).lower()
    if section == "live" and tier == "free":
        return {"success": False, "error": "tier_not_allowed"}
    key_name = plan.get("key_name")
    if key_name and not db.key_exists(user_id, key_name):
        return {"success": False, "error": "missing_key"}
    allowed, msg = spending_limits.check_spending_limit(user_id, section, float(plan.get("size_usd", 0) or 0))
    if not allowed:
        return {"success": False, "error": msg}
    if plan.get("needs_confirmation") and not skip_confirm:
        return {"pending": True, "confirm_id": "manual-confirm", "message": "Confirmation required"}
    result = await executor(plan)
    db._insert("audit_log", {"user_id": user_id, "section": section, "action": "execute", "payload": plan, "result": result})
    if result.get("success"):
        spending_limits.record_spend(user_id, section, float(plan.get("size_usd", 0) or 0))
        db._insert("positions", {"user_id": user_id, "section": section, "payload": result})
    return result
