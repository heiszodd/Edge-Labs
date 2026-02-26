from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

_LIMITS = {
    "hl": {"single": 2000.0, "daily": 5000.0},
    "sol": {"single": 500.0, "daily": 1500.0},
    "poly": {"single": 200.0, "daily": 500.0},
}

_spends: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
_last_day = datetime.now(timezone.utc).date()


def _reset_if_new_day() -> None:
    global _last_day
    today = datetime.now(timezone.utc).date()
    if today != _last_day:
        _spends.clear()
        _last_day = today


def check_spending_limit(user_id, section, amount) -> tuple[bool, str]:
    _reset_if_new_day()
    limits = _LIMITS.get(section)
    if not limits:
        return False, f"Unknown section: {section}"
    amount = float(amount)
    if amount > limits["single"]:
        return False, f"Single-trade limit exceeded (${limits['single']:.2f})"
    total = _spends[str(user_id)][section] + amount
    if total > limits["daily"]:
        return False, f"Daily limit exceeded (${limits['daily']:.2f})"
    return True, "ok"


def record_spend(user_id, section, amount):
    _reset_if_new_day()
    _spends[str(user_id)][section] += float(amount)


def get_daily_summary(user_id) -> dict:
    _reset_if_new_day()
    user_totals = dict(_spends.get(str(user_id), {}))
    return {
        "date_utc": _last_day.isoformat(),
        "totals": user_totals,
    }
