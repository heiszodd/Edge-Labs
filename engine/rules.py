from __future__ import annotations

from datetime import datetime, timezone


def _body(c): return abs(float(c.get("close", 0)) - float(c.get("open", 0)))
def _upper_wick(c): return float(c.get("high", 0)) - max(float(c.get("open", 0)), float(c.get("close", 0)))
def _lower_wick(c): return min(float(c.get("open", 0)), float(c.get("close", 0))) - float(c.get("low", 0))
def _is_bullish(c): return float(c.get("close", 0)) > float(c.get("open", 0))
def _is_bearish(c): return float(c.get("close", 0)) < float(c.get("open", 0))
def _avg_body(candles, n=20):
    cs = candles[-n:] if candles else []
    return sum(_body(c) for c in cs) / max(len(cs), 1)
def _avg_volume(candles, n=20):
    cs = candles[-n:] if candles else []
    return sum(float(c.get("volume", 0)) for c in cs) / max(len(cs), 1)

def _swing_highs(candles, lookback=20):
    cs = candles[-lookback:]
    return [c for c in cs if float(c.get("high", 0)) >= max(float(x.get("high", 0)) for x in cs)] if cs else []

def _swing_lows(candles, lookback=20):
    cs = candles[-lookback:]
    return [c for c in cs if float(c.get("low", 0)) <= min(float(x.get("low", 0)) for x in cs)] if cs else []

def _safe(fn):
    def w(*a, **k):
        try: return bool(fn(*a, **k))
        except Exception: return False
    return w

@_safe
def rule_htf_bullish(candles, htf_candles=None):
    h = htf_candles or candles
    return len(h) > 5 and float(h[-1]["close"]) > (float(h[-1]["high"]) + float(h[-1]["low"])) / 2 and float(h[-1]["low"]) > float(h[-3]["low"])
@_safe
def rule_htf_bearish(candles, htf_candles=None):
    h = htf_candles or candles
    return len(h) > 5 and float(h[-1]["close"]) < (float(h[-1]["high"]) + float(h[-1]["low"])) / 2 and float(h[-1]["high"]) < float(h[-3]["high"])
@_safe
def rule_regime_trending(candles):
    cs = candles[-20:]
    if len(cs) < 20: return False
    rng = max(float(c["high"]) for c in cs) - min(float(c["low"]) for c in cs)
    atr = sum(float(c["high"]) - float(c["low"]) for c in cs) / len(cs)
    return rng > 3 * atr
@_safe
def rule_daily_bias_bullish(candles, daily_candles=None):
    d = daily_candles or candles
    return len(d) > 1 and float(d[-1]["close"]) > (float(d[-2]["high"]) + float(d[-2]["low"])) / 2
@_safe
def rule_daily_bias_bearish(candles, daily_candles=None):
    d = daily_candles or candles
    return len(d) > 1 and float(d[-1]["close"]) < (float(d[-2]["high"]) + float(d[-2]["low"])) / 2
@_safe
def rule_bos_bullish(candles):
    seg = candles[-53:-3]
    return len(seg) > 10 and float(candles[-1]["close"]) > max(float(c["high"]) for c in seg)
@_safe
def rule_bos_bearish(candles):
    seg = candles[-53:-3]
    return len(seg) > 10 and float(candles[-1]["close"]) < min(float(c["low"]) for c in seg)
@_safe
def rule_choch_bullish(candles):
    a, b = candles[-30:-15], candles[-15:]
    return len(a) > 5 and max(float(c["high"]) for c in b) > max(float(c["high"]) for c in a)
@_safe
def rule_choch_bearish(candles):
    a, b = candles[-30:-15], candles[-15:]
    return len(a) > 5 and min(float(c["low"]) for c in b) < min(float(c["low"]) for c in a)
@_safe
def rule_fvg_bullish(candles):
    for i in range(max(2, len(candles)-15), len(candles)):
        if float(candles[i-2]["high"]) < float(candles[i]["low"]):
            return float(candles[-1]["low"]) <= float(candles[i]["low"]) * 1.01
    return False
@_safe
def rule_fvg_bearish(candles):
    for i in range(max(2, len(candles)-15), len(candles)):
        if float(candles[i-2]["low"]) > float(candles[i]["high"]):
            return float(candles[-1]["high"]) >= float(candles[i]["high"]) * 0.99
    return False
@_safe
def rule_bullish_ob_present(candles):
    for i in range(len(candles)-4):
        if _is_bearish(candles[i]) and all(_is_bullish(candles[i+j]) for j in (1,2,3)):
            lo, hi = float(candles[i]["low"]), float(candles[i]["high"])
            px = float(candles[-1]["close"])
            return lo*0.99 <= px <= hi*1.01
    return False
@_safe
def rule_bearish_ob_present(candles):
    for i in range(len(candles)-4):
        if _is_bullish(candles[i]) and all(_is_bearish(candles[i+j]) for j in (1,2,3)):
            lo, hi = float(candles[i]["low"]), float(candles[i]["high"])
            px = float(candles[-1]["close"])
            return lo*0.99 <= px <= hi*1.01
    return False
@_safe
def rule_liquidity_swept_low(candles): return len(candles)>5 and float(candles[-2]["low"]) < min(float(c["low"]) for c in candles[-20:-2]) and float(candles[-2]["close"]) > float(candles[-3]["low"])
@_safe
def rule_liquidity_swept_high(candles): return len(candles)>5 and float(candles[-2]["high"]) > max(float(c["high"]) for c in candles[-20:-2]) and float(candles[-2]["close"]) < float(candles[-3]["high"])
@_safe
def rule_ote_zone(candles):
    seg = candles[-20:]
    hi, lo, px = max(float(c["high"]) for c in seg), min(float(c["low"]) for c in seg), float(candles[-1]["close"])
    a,b = lo + 0.618*(hi-lo), lo + 0.79*(hi-lo)
    return min(a,b) <= px <= max(a,b)
@_safe
def rule_inside_fvg(candles): return rule_fvg_bullish(candles) or rule_fvg_bearish(candles)
@_safe
def rule_inside_ob(candles): return rule_bullish_ob_present(candles) or rule_bearish_ob_present(candles)
@_safe
def rule_session_overlap(candles):
    ts = int(candles[-1].get("timestamp", 0))/1000
    h = datetime.fromtimestamp(ts, tz=timezone.utc).hour
    return 13 <= h < 16
@_safe
def rule_killzone_active(candles):
    ts = int(candles[-1].get("timestamp", 0))/1000
    h = datetime.fromtimestamp(ts, tz=timezone.utc).hour
    return 7 <= h < 10 or 13 <= h < 16
@_safe
def rule_asian_range_swept(candles):
    a = candles[-24:-8]
    return len(a)>5 and (float(candles[-1]["high"]) > max(float(c["high"]) for c in a) or float(candles[-1]["low"]) < min(float(c["low"]) for c in a))
@_safe
def rule_ny_open_reversal(candles):
    ts = int(candles[-1].get("timestamp", 0))/1000
    h = datetime.fromtimestamp(ts, tz=timezone.utc).hour
    if not (13 <= h < 15): return False
    return (float(candles[-1]["close"])-float(candles[-1]["open"]))*(float(candles[-5]["close"])-float(candles[-5]["open"])) < 0
@_safe
def rule_silver_bullet_window(candles):
    ts = int(candles[-1].get("timestamp", 0))/1000
    return datetime.fromtimestamp(ts, tz=timezone.utc).hour in (3,10,15)
@_safe
def rule_candle_confirmation(candles):
    c=candles[-1]; rng=float(c["high"])-float(c["low"])
    return _body(c) > 1.2*_avg_body(candles,20) and (_body(c)/max(rng,1e-9)) > 0.6
@_safe
def rule_engulfing_bullish(candles):
    a,b=candles[-2],candles[-1]
    return _is_bearish(a) and _is_bullish(b) and float(b["open"]) <= float(a["close"]) and float(b["close"]) >= float(a["open"])
@_safe
def rule_engulfing_bearish(candles):
    a,b=candles[-2],candles[-1]
    return _is_bullish(a) and _is_bearish(b) and float(b["open"]) >= float(a["close"]) and float(b["close"]) <= float(a["open"])
@_safe
def rule_volume_spike(candles): return float(candles[-1]["volume"]) > 1.8*_avg_volume(candles,20)
@_safe
def rule_momentum_shift(candles):
    x = [float(c["close"])-float(c["open"]) for c in candles[-3:]]
    return all(v>0 for v in x) or all(v<0 for v in x)
@_safe
def rule_three_confluences(candles, htf_candles=None):
    hits=[rule_htf_bullish(candles, htf_candles=htf_candles) or rule_htf_bearish(candles, htf_candles=htf_candles), rule_bos_bullish(candles) or rule_bos_bearish(candles), rule_fvg_bullish(candles) or rule_fvg_bearish(candles), float(candles[-1]["volume"]) > 1.5*_avg_volume(candles,20)]
    return sum(1 for h in hits if h) >= 3

RULE_REGISTRY = {k: v for k, v in globals().items() if k.startswith("rule_") and callable(v)}

def evaluate_rule(rule_id, candles, **kwargs) -> bool:
    try:
        fn = RULE_REGISTRY.get(rule_id)
        if not fn:
            norm = str(rule_id).lower().replace("-", "_").replace(" ", "_")
            for name, cand in RULE_REGISTRY.items():
                if norm == name.lower() or norm in name.lower() or name.lower() in norm:
                    fn = cand
                    break
        if not fn:
            return False
        return bool(fn(candles, **kwargs))
    except Exception:
        return False
