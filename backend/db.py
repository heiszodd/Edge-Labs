from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from backend import config

logger = logging.getLogger(__name__)

try:
    from supabase import Client, create_client
except Exception:  # pragma: no cover
    Client = Any  # type: ignore
    create_client = None  # type: ignore


def _get_client() -> Client | None:
    try:
        if create_client is None:
            return None
        key = config.SUPABASE_SERVICE_KEY or config.SUPABASE_KEY
        return create_client(config.SUPABASE_URL, key)
    except Exception:
        logger.exception("Failed to initialize Supabase client")
        return None


_client = _get_client()


def _table(name: str):
    if _client is None:
        return None
    try:
        return _client.table(name)
    except Exception:
        logger.exception("Failed table access: %s", name)
        return None


def _select_one(table: str, **filters: Any) -> dict:
    try:
        t = _table(table)
        if t is None:
            return {}
        q = t.select("*")
        for k, v in filters.items():
            q = q.eq(k, v)
        data = q.limit(1).execute().data
        return data[0] if data else {}
    except Exception:
        logger.exception("select_one failed for %s", table)
        return {}


def _select_many(table: str, order: str | None = None, desc: bool = False, limit: int | None = None, **filters: Any) -> list[dict]:
    try:
        t = _table(table)
        if t is None:
            return []
        q = t.select("*")
        for k, v in filters.items():
            q = q.eq(k, v)
        if order:
            q = q.order(order, desc=desc)
        if limit:
            q = q.limit(limit)
        return q.execute().data or []
    except Exception:
        logger.exception("select_many failed for %s", table)
        return []


def _insert(table: str, data: dict) -> dict:
    try:
        t = _table(table)
        if t is None:
            return {}
        rows = t.insert(data).execute().data
        return rows[0] if rows else {}
    except Exception:
        logger.exception("insert failed for %s", table)
        return {}


def _upsert(table: str, data: dict, on_conflict: str | None = None) -> dict:
    try:
        t = _table(table)
        if t is None:
            return {}
        kwargs = {"on_conflict": on_conflict} if on_conflict else {}
        rows = t.upsert(data, **kwargs).execute().data
        return rows[0] if rows else {}
    except Exception:
        logger.exception("upsert failed for %s", table)
        return {}


def _update(table: str, updates: dict, **filters: Any) -> bool:
    try:
        t = _table(table)
        if t is None:
            return False
        q = t.update(updates)
        for k, v in filters.items():
            q = q.eq(k, v)
        q.execute()
        return True
    except Exception:
        logger.exception("update failed for %s", table)
        return False


def _delete(table: str, **filters: Any) -> bool:
    try:
        t = _table(table)
        if t is None:
            return False
        q = t.delete()
        for k, v in filters.items():
            q = q.eq(k, v)
        q.execute()
        return True
    except Exception:
        logger.exception("delete failed for %s", table)
        return False


def verify_connection() -> bool:
    try:
        return bool(_select_many("subscription_tiers", limit=1) is not None)
    except Exception:
        return False


# Users

def get_user_by_id(user_id) -> dict:
    return _select_one("users", id=user_id)


def get_user_by_telegram_id(tg_id) -> dict:
    return _select_one("users", telegram_user_id=tg_id)


def get_user_by_link_token(token) -> dict:
    return _select_one("users", telegram_link_token=token)


def update_user(user_id, fields: dict):
    _update("users", fields, id=user_id)


def create_user_defaults(user_id):
    _upsert("user_settings", {"user_id": user_id}, on_conflict="user_id")
    for section in ("perps", "sol", "poly"):
        _upsert("demo_balance", {"user_id": user_id, "section": section, "balance": 10000}, on_conflict="user_id,section")
        _upsert("risk_settings", {"user_id": user_id, "section": section}, on_conflict="user_id,section")
    _upsert("emergency_stop", {"user_id": user_id, "halted": False}, on_conflict="user_id")


# Keys

def key_exists(user_id, key_name) -> bool:
    try:
        return bool(_select_one("encrypted_keys", user_id=user_id, key_name=key_name))
    except Exception:
        return False


def save_encrypted_key(user_id, key_name, encrypted, label) -> bool:
    return bool(_upsert("encrypted_keys", {"user_id": user_id, "key_name": key_name, "encrypted": encrypted, "label": label}, on_conflict="user_id,key_name"))


def get_encrypted_key(user_id, key_name) -> str:
    row = _select_one("encrypted_keys", user_id=user_id, key_name=key_name)
    return row.get("encrypted", "")


# Signals

def save_pending_signal(data: dict) -> int:
    row = _insert("pending_signals", data)
    return int(row.get("id", 0) or 0)


def get_pending_signals(user_id, section=None, active_only=True) -> list:
    rows = _select_many("pending_signals", user_id=user_id, order="created_at", desc=True)
    if section:
        rows = [r for r in rows if r.get("section") == section]
    if active_only:
        rows = [r for r in rows if r.get("status") == "pending"]
    return rows


def get_pending_signal(signal_id) -> dict:
    return _select_one("pending_signals", id=signal_id)


def dismiss_signal(signal_id, user_id):
    _update("pending_signals", {"status": "dismissed", "dismissed_at": datetime.now(timezone.utc).isoformat()}, id=signal_id, user_id=user_id)


# Models (perps)

def get_user_models(user_id, active_only=False) -> list:
    rows = _select_many("models", user_id=user_id, order="created_at", desc=True)
    return [r for r in rows if r.get("active")] if active_only else rows


def get_model(model_id, user_id) -> dict:
    return _select_one("models", id=model_id, user_id=user_id)


def save_model(user_id, data) -> int:
    payload = {**data, "user_id": user_id}
    row = _insert("models", payload)
    return int(row.get("id", 0) or 0)


def update_model(model_id, user_id, data):
    _update("models", data, id=model_id, user_id=user_id)


def delete_model(model_id, user_id):
    _delete("models", id=model_id, user_id=user_id)


def toggle_model(model_id, user_id, active):
    _update("models", {"active": bool(active)}, id=model_id, user_id=user_id)


def increment_model_signals(model_id):
    row = _select_one("models", id=model_id)
    total = int(row.get("total_signals", 0) or 0) + 1
    today = int(row.get("signals_today", 0) or 0) + 1
    _update("models", {"total_signals": total, "signals_today": today, "last_signal_at": datetime.now(timezone.utc).isoformat()}, id=model_id)


# Demo

def get_demo_balance(user_id, section) -> float:
    row = _select_one("demo_balance", user_id=user_id, section=section)
    return float(row.get("balance", 0.0) or 0.0)


def set_demo_balance(user_id, section, amount):
    _upsert("demo_balance", {"user_id": user_id, "section": section, "balance": amount}, on_conflict="user_id,section")


def reset_demo_balance(user_id, section, amount=10000.0):
    set_demo_balance(user_id, section, amount)


def get_open_demo_trades(user_id, section) -> list:
    return _select_many("demo_trades", user_id=user_id, section=section, status="open", order="opened_at", desc=True)


def get_closed_demo_trades(user_id, section, limit=20) -> list:
    return _select_many("demo_trades", user_id=user_id, section=section, status="closed", order="closed_at", desc=True, limit=limit)


def open_demo_trade(user_id, data) -> int:
    row = _insert("demo_trades", {**data, "user_id": user_id})
    return int(row.get("id", 0) or 0)


def close_demo_trade(trade_id, pnl, reason):
    _update("demo_trades", {"status": "closed", "pnl": pnl, "close_reason": reason, "closed_at": datetime.now(timezone.utc).isoformat()}, id=trade_id)


# Risk

def get_risk_settings(user_id, section) -> dict:
    return _select_one("risk_settings", user_id=user_id, section=section)


def save_risk_settings(user_id, section, data: dict):
    _upsert("risk_settings", {**data, "user_id": user_id, "section": section}, on_conflict="user_id,section")


# Settings

def get_user_settings(user_id) -> dict:
    return _select_one("user_settings", user_id=user_id)


def update_user_settings(user_id, data: dict):
    _upsert("user_settings", {**data, "user_id": user_id}, on_conflict="user_id")


# HL

def get_hl_address(user_id) -> str:
    row = _select_one("encrypted_keys", user_id=user_id, key_name="hl_address")
    return row.get("encrypted", "")


def save_hl_address(user_id, address):
    _upsert("encrypted_keys", {"user_id": user_id, "key_name": "hl_address", "encrypted": address, "label": "hl address"}, on_conflict="user_id,key_name")


def upsert_hl_positions(user_id, positions: list):
    for position in positions:
        _upsert("hl_positions", {**position, "user_id": user_id})


def get_hl_positions(user_id) -> list:
    return _select_many("hl_positions", user_id=user_id, order="updated_at", desc=True)


def save_hl_trade(user_id, data):
    _insert("hl_trade_history", {**data, "user_id": user_id})


def get_hl_trade_history(user_id, limit=50) -> list:
    return _select_many("hl_trade_history", user_id=user_id, order="id", desc=True, limit=limit)


def get_existing_trade_timestamps(user_id) -> set:
    rows = _select_many("hl_trade_history", user_id=user_id)
    return {r.get("timestamp") for r in rows if r.get("timestamp")}


# Solana / Degen

def get_sol_address(user_id) -> str:
    row = _select_one("encrypted_keys", user_id=user_id, key_name="sol_address")
    return row.get("encrypted", "")


def save_sol_address(user_id, address):
    _upsert("encrypted_keys", {"user_id": user_id, "key_name": "sol_address", "encrypted": address, "label": "sol address"}, on_conflict="user_id,key_name")


def get_open_sol_positions(user_id) -> list:
    return _select_many("sol_positions", user_id=user_id, status="open", order="opened_at", desc=True)


def get_sol_position(user_id, token_address) -> dict:
    return _select_one("sol_positions", user_id=user_id, token_address=token_address)


def save_sol_position(user_id, data) -> int:
    row = _insert("sol_positions", {**data, "user_id": user_id})
    return int(row.get("id", 0) or 0)


def update_sol_position(user_id, token_address, data):
    _update("sol_positions", data, user_id=user_id, token_address=token_address)


def get_degen_models(user_id, active_only=False) -> list:
    rows = _select_many("degen_models", user_id=user_id, order="created_at", desc=True)
    return [r for r in rows if r.get("active")] if active_only else rows


def save_degen_model(user_id, data) -> int:
    row = _insert("degen_models", {**data, "user_id": user_id})
    return int(row.get("id", 0) or 0)


def toggle_degen_model(model_id, user_id, active):
    _update("degen_models", {"active": bool(active)}, id=model_id, user_id=user_id)


def get_auto_sell_config(user_id, token_address) -> dict:
    return _select_one("auto_sell_configs", user_id=user_id, token_address=token_address)


def save_auto_sell_config(user_id, data):
    _upsert("auto_sell_configs", {**data, "user_id": user_id}, on_conflict="user_id,token_address")


def update_auto_sell_config(user_id, token_address, data):
    _update("auto_sell_configs", data, user_id=user_id, token_address=token_address)


def get_tracked_wallets(user_id) -> list:
    return _select_many("tracked_wallets", user_id=user_id, order="added_at", desc=True)


def save_tracked_wallet(user_id, data):
    _upsert("tracked_wallets", {**data, "user_id": user_id}, on_conflict="user_id,wallet_address")


def get_blacklist(user_id) -> list:
    return _select_many("blacklist", user_id=user_id, order="added_at", desc=True)


def add_to_blacklist(user_id, address, reason):
    _upsert("blacklist", {"user_id": user_id, "address": address, "reason": reason}, on_conflict="user_id,address")


def is_blacklisted(user_id, address) -> bool:
    return bool(_select_one("blacklist", user_id=user_id, address=address))


# Polymarket

def get_poly_address(user_id) -> str:
    row = _select_one("encrypted_keys", user_id=user_id, key_name="poly_address")
    return row.get("encrypted", "")


def save_poly_address(user_id, address):
    _upsert("encrypted_keys", {"user_id": user_id, "key_name": "poly_address", "encrypted": address, "label": "poly address"}, on_conflict="user_id,key_name")


def get_prediction_models(user_id, active_only=False) -> list:
    rows = _select_many("prediction_models", user_id=user_id, order="created_at", desc=True)
    return [r for r in rows if r.get("active")] if active_only else rows


def save_prediction_model(user_id, data) -> int:
    row = _insert("prediction_models", {**data, "user_id": user_id})
    return int(row.get("id", 0) or 0)


def toggle_prediction_model(model_id, user_id, active):
    _update("prediction_models", {"active": bool(active)}, id=model_id, user_id=user_id)


def get_open_poly_trades(user_id) -> list:
    return _select_many("poly_live_trades", user_id=user_id, status="open", order="opened_at", desc=True)


# Emergency stop

def is_halted(user_id) -> bool:
    try:
        row = _select_one("emergency_stop", user_id=user_id)
        return bool(row.get("halted", False))
    except Exception:
        return False


def set_halt(user_id, halted, reason=""):
    _upsert("emergency_stop", {"user_id": user_id, "halted": bool(halted), "reason": reason, "set_at": datetime.now(timezone.utc).isoformat()}, on_conflict="user_id")


# Audit

def log_audit(user_id, action, details, success=True, error=None):
    _insert("audit_log", {"user_id": user_id, "action": action, "details": details or {}, "success": success, "error": error})


# Backtest

def create_backtest_run(user_id, data) -> int:
    row = _insert("backtest_runs", {**data, "user_id": user_id})
    return int(row.get("id", 0) or 0)


def update_backtest_run(run_id, data):
    _update("backtest_runs", data, id=run_id)


def get_backtest_run(run_id, user_id) -> dict:
    return _select_one("backtest_runs", id=run_id, user_id=user_id)


def get_backtest_history(user_id) -> list:
    return _select_many("backtest_runs", user_id=user_id, order="created_at", desc=True)


def save_backtest_trade(data):
    _insert("backtest_trades", data)


# Journal

def get_journal_entries(user_id) -> list:
    return _select_many("journal_entries", user_id=user_id, order="created_at", desc=True)


def save_journal_entry(user_id, data) -> int:
    row = _insert("journal_entries", {**data, "user_id": user_id})
    return int(row.get("id", 0) or 0)


def update_journal_entry(entry_id, user_id, data):
    _update("journal_entries", data, id=entry_id, user_id=user_id)


def delete_journal_entry(entry_id, user_id):
    _delete("journal_entries", id=entry_id, user_id=user_id)


# Price alerts

def get_price_alerts(user_id) -> list:
    return _select_many("price_alerts", user_id=user_id, order="created_at", desc=True)


def save_price_alert(user_id, data):
    _insert("price_alerts", {**data, "user_id": user_id})


def trigger_price_alert(alert_id):
    _update("price_alerts", {"triggered": True}, id=alert_id)
