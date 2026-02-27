import { useCallback, useRef, useState } from 'react';

const RULE_LIBRARY = {
  'HTF Bias': {
    color: '#38bdf8', glyph: '◈', phase: 1,
    rules: [
      { id: 'htf_bullish', label: 'HTF Bullish', desc: 'Higher timeframe shows bullish structure with ascending highs/lows', complexity: 'basic', params: [] },
      { id: 'htf_bearish', label: 'HTF Bearish', desc: 'Higher timeframe shows bearish structure with descending highs/lows', complexity: 'basic', params: [] },
      { id: 'regime_trending', label: 'Trending Regime', desc: 'Price range exceeds N× ATR — confirms directional bias exists', complexity: 'basic', params: [{ key: 'atr_mult', label: 'ATR Multiplier', type: 'number', default: 3, min: 1, max: 6, step: 0.5 }] },
      { id: 'daily_bias_bullish', label: 'Daily Bias Bullish', desc: 'Daily close above prior candle midpoint', complexity: 'basic', params: [] },
      { id: 'daily_bias_bearish', label: 'Daily Bias Bearish', desc: 'Daily close below prior candle midpoint', complexity: 'basic', params: [] },
      { id: 'weekly_trend_up', label: 'Weekly Trend Up', desc: 'Weekly structure shows consecutive higher highs over last 3 weeks', complexity: 'advanced', params: [{ key: 'weeks', label: 'Lookback Weeks', type: 'number', default: 3, min: 2, max: 8, step: 1 }] },
      { id: 'weekly_trend_down', label: 'Weekly Trend Down', desc: 'Weekly structure shows consecutive lower lows over last N weeks', complexity: 'advanced', params: [{ key: 'weeks', label: 'Lookback Weeks', type: 'number', default: 3, min: 2, max: 8, step: 1 }] },
      { id: 'ma_stack_bullish', label: 'MA Stack Bullish', desc: 'Fast EMA > Slow EMA — classic uptrend stack', complexity: 'intermediate', params: [{ key: 'ema_fast', label: 'Fast EMA', type: 'number', default: 20, min: 5, max: 50, step: 1 }, { key: 'ema_slow', label: 'Slow EMA', type: 'number', default: 200, min: 50, max: 500, step: 10 }] },
      { id: 'ma_stack_bearish', label: 'MA Stack Bearish', desc: 'Fast EMA < Slow EMA — bearish trend alignment', complexity: 'intermediate', params: [{ key: 'ema_fast', label: 'Fast EMA', type: 'number', default: 20, min: 5, max: 50, step: 1 }, { key: 'ema_slow', label: 'Slow EMA', type: 'number', default: 200, min: 50, max: 500, step: 10 }] },
      { id: 'vwap_above', label: 'Price Above VWAP', desc: 'Current price trading above session VWAP — bullish intraday bias', complexity: 'intermediate', params: [] },
      { id: 'vwap_below', label: 'Price Below VWAP', desc: 'Current price trading below session VWAP — bearish intraday bias', complexity: 'intermediate', params: [] },
    ],
  },
  'Structure & POI': {
    color: '#a78bfa', glyph: '◇', phase: 2,
    rules: [
      { id: 'bos_bullish', label: 'BOS Bullish', desc: 'Close above last swing high — break of bearish structure', complexity: 'basic', params: [{ key: 'lookback', label: 'Lookback Bars', type: 'number', default: 50, min: 10, max: 100, step: 5 }] },
      { id: 'bos_bearish', label: 'BOS Bearish', desc: 'Close below last swing low — break of bullish structure', complexity: 'basic', params: [{ key: 'lookback', label: 'Lookback Bars', type: 'number', default: 50, min: 10, max: 100, step: 5 }] },
      { id: 'choch_bullish', label: 'CHoCH Bullish', desc: 'Descending highs in early segment, recent break above mid-segment peak', complexity: 'intermediate', params: [] },
      { id: 'choch_bearish', label: 'CHoCH Bearish', desc: 'Ascending lows in early segment, recent break below mid-segment trough', complexity: 'intermediate', params: [] },
      { id: 'fvg_bullish', label: 'FVG Bullish', desc: 'Bullish fair value gap found in last N bars, price near zone', complexity: 'basic', params: [{ key: 'lookback', label: 'FVG Lookback', type: 'number', default: 15, min: 3, max: 30, step: 1 }, { key: 'tolerance', label: 'Proximity %', type: 'number', default: 0.5, min: 0.1, max: 2, step: 0.1 }] },
      { id: 'fvg_bearish', label: 'FVG Bearish', desc: 'Bearish fair value gap found in last N bars, price near zone', complexity: 'basic', params: [{ key: 'lookback', label: 'FVG Lookback', type: 'number', default: 15, min: 3, max: 30, step: 1 }, { key: 'tolerance', label: 'Proximity %', type: 'number', default: 0.5, min: 0.1, max: 2, step: 0.1 }] },
      { id: 'bullish_ob', label: 'Bullish Order Block', desc: 'Last bearish candle before N+ bullish impulse candles. Price within tolerance.', complexity: 'intermediate', params: [{ key: 'ob_tolerance', label: 'Zone Tolerance %', type: 'number', default: 1.0, min: 0.2, max: 3, step: 0.1 }, { key: 'impulse_bars', label: 'Impulse Candles', type: 'number', default: 3, min: 2, max: 6, step: 1 }] },
      { id: 'bearish_ob', label: 'Bearish Order Block', desc: 'Last bullish candle before N+ bearish impulse candles. Price within tolerance.', complexity: 'intermediate', params: [{ key: 'ob_tolerance', label: 'Zone Tolerance %', type: 'number', default: 1.0, min: 0.2, max: 3, step: 0.1 }, { key: 'impulse_bars', label: 'Impulse Candles', type: 'number', default: 3, min: 2, max: 6, step: 1 }] },
      { id: 'liq_swept_low', label: 'Liquidity Sweep Low', desc: 'Wick penetrated swing low and closed back above — stop hunt complete', complexity: 'advanced', params: [] },
      { id: 'liq_swept_high', label: 'Liquidity Sweep High', desc: 'Wick penetrated swing high and closed back below — stop hunt complete', complexity: 'advanced', params: [] },
      { id: 'equal_highs', label: 'Equal Highs (EQH)', desc: 'Two equal highs within tolerance — liquidity pool resting above', complexity: 'advanced', params: [{ key: 'eq_tolerance', label: 'Equal Tolerance %', type: 'number', default: 0.3, min: 0.05, max: 1, step: 0.05 }] },
      { id: 'equal_lows', label: 'Equal Lows (EQL)', desc: 'Two equal lows within tolerance — liquidity pool resting below', complexity: 'advanced', params: [{ key: 'eq_tolerance', label: 'Equal Tolerance %', type: 'number', default: 0.3, min: 0.05, max: 1, step: 0.05 }] },
      { id: 'mitigation_block_bull', label: 'Mitigation Block Bull', desc: 'Breaker block — failed bearish OB now acting as support', complexity: 'advanced', params: [] },
      { id: 'mitigation_block_bear', label: 'Mitigation Block Bear', desc: 'Breaker block — failed bullish OB now acting as resistance', complexity: 'advanced', params: [] },
    ],
  },
  'Entry Zone': {
    color: '#f59e0b', glyph: '◉', phase: 3,
    rules: [
      { id: 'ote_zone', label: 'OTE Zone', desc: 'Price between Fib retracement levels of last impulse move', complexity: 'intermediate', params: [{ key: 'fib_low', label: 'Fib Low %', type: 'number', default: 61.8, min: 50, max: 70, step: 0.1 }, { key: 'fib_high', label: 'Fib High %', type: 'number', default: 79.0, min: 71, max: 88, step: 0.1 }] },
      { id: 'inside_fvg', label: 'Inside FVG', desc: 'Current price is trading inside an identified FVG', complexity: 'basic', params: [] },
      { id: 'inside_ob', label: 'Inside OB', desc: 'Current price is inside an order block zone', complexity: 'basic', params: [] },
      { id: 'session_overlap', label: 'Session Overlap', desc: 'Price forming in configurable session window', complexity: 'basic', params: [{ key: 'start_hour', label: 'Start Hour (UTC)', type: 'number', default: 13, min: 0, max: 23, step: 1 }, { key: 'end_hour', label: 'End Hour (UTC)', type: 'number', default: 16, min: 0, max: 23, step: 1 }] },
      { id: 'killzone', label: 'Killzone Active', desc: 'Inside London (07–10) or NY (13–16) UTC killzone windows', complexity: 'basic', params: [] },
      { id: 'asian_range_swept', label: 'Asian Range Swept', desc: 'Asian high or low traded through before current candle', complexity: 'advanced', params: [] },
      { id: 'ny_open_reversal', label: 'NY Open Reversal', desc: 'Direction change vs London trend at NY open (13–15 UTC)', complexity: 'advanced', params: [] },
      { id: 'silver_bullet', label: 'Silver Bullet Window', desc: 'UTC hour is 3, 10, or 15 — ICT precision windows', complexity: 'advanced', params: [] },
      { id: 'price_in_discount', label: 'Price in Discount', desc: 'Price below midpoint of recent swing range — buy in discount', complexity: 'intermediate', params: [{ key: 'discount_pct', label: 'Discount Level %', type: 'number', default: 50, min: 30, max: 65, step: 5 }] },
      { id: 'price_in_premium', label: 'Price in Premium', desc: 'Price above midpoint of recent swing range — sell in premium', complexity: 'intermediate', params: [{ key: 'premium_pct', label: 'Premium Level %', type: 'number', default: 50, min: 40, max: 70, step: 5 }] },
      { id: 'previous_day_low', label: 'Near PDL', desc: 'Price within tolerance of previous day low — key support', complexity: 'intermediate', params: [{ key: 'tolerance', label: 'Proximity %', type: 'number', default: 0.5, min: 0.1, max: 2, step: 0.1 }] },
      { id: 'previous_day_high', label: 'Near PDH', desc: 'Price within tolerance of previous day high — key resistance', complexity: 'intermediate', params: [{ key: 'tolerance', label: 'Proximity %', type: 'number', default: 0.5, min: 0.1, max: 2, step: 0.1 }] },
      { id: 'consolidation_break', label: 'Consolidation Break', desc: 'Price breaking out of a tight consolidation range', complexity: 'intermediate', params: [{ key: 'range_pct', label: 'Max Range %', type: 'number', default: 1.5, min: 0.3, max: 5, step: 0.1 }, { key: 'bars', label: 'Consolidation Bars', type: 'number', default: 8, min: 3, max: 20, step: 1 }] },
    ],
  },
  Trigger: {
    color: '#10b981', glyph: '◆', phase: 4,
    rules: [
      { id: 'candle_confirm', label: 'Candle Confirmation', desc: 'Strong close: body > N× avg AND body > P% of full range', complexity: 'basic', params: [{ key: 'body_mult', label: 'Body Multiplier', type: 'number', default: 1.2, min: 0.8, max: 2.5, step: 0.1 }, { key: 'body_pct', label: 'Body % of Range', type: 'number', default: 60, min: 40, max: 80, step: 5 }] },
      { id: 'engulfing_bull', label: 'Bullish Engulfing', desc: 'Bull candle body fully engulfs prior bear body', complexity: 'basic', params: [] },
      { id: 'engulfing_bear', label: 'Bearish Engulfing', desc: 'Bear candle body fully engulfs prior bull body', complexity: 'basic', params: [] },
      { id: 'volume_spike', label: 'Volume Spike', desc: 'Current volume above N× 20-bar average', complexity: 'basic', params: [{ key: 'vol_mult', label: 'Volume Multiplier', type: 'number', default: 1.8, min: 1.1, max: 5, step: 0.1 }] },
      { id: 'momentum_shift', label: 'Momentum Shift', desc: 'N consecutive closes in the same direction', complexity: 'basic', params: [{ key: 'consec_bars', label: 'Consecutive Bars', type: 'number', default: 3, min: 2, max: 6, step: 1 }] },
      { id: 'three_confluences', label: 'Three Confluences', desc: 'N of 4 must pass: HTF trend + BOS + FVG + Volume > 1.5×', complexity: 'advanced', params: [{ key: 'required', label: 'Required Count', type: 'number', default: 3, min: 2, max: 4, step: 1 }] },
      { id: 'pinbar_bull', label: 'Bullish Pin Bar', desc: 'Lower wick > N× body, upper wick < body — rejection wick', complexity: 'intermediate', params: [{ key: 'wick_mult', label: 'Wick Multiplier', type: 'number', default: 2.0, min: 1.5, max: 5, step: 0.25 }] },
      { id: 'pinbar_bear', label: 'Bearish Pin Bar', desc: 'Upper wick > N× body, lower wick < body — rejection wick', complexity: 'intermediate', params: [{ key: 'wick_mult', label: 'Wick Multiplier', type: 'number', default: 2.0, min: 1.5, max: 5, step: 0.25 }] },
      { id: 'inside_bar_break', label: 'Inside Bar Breakout', desc: 'Current candle breaks cleanly above/below the prior inside bar', complexity: 'intermediate', params: [] },
      { id: 'rsi_oversold', label: 'RSI Oversold', desc: 'RSI dipped below level and is recovering upward', complexity: 'intermediate', params: [{ key: 'rsi_period', label: 'RSI Period', type: 'number', default: 14, min: 5, max: 30, step: 1 }, { key: 'oversold', label: 'Oversold Level', type: 'number', default: 30, min: 15, max: 45, step: 1 }] },
      { id: 'rsi_overbought', label: 'RSI Overbought', desc: 'RSI exceeded level and is turning down', complexity: 'intermediate', params: [{ key: 'rsi_period', label: 'RSI Period', type: 'number', default: 14, min: 5, max: 30, step: 1 }, { key: 'overbought', label: 'Overbought Level', type: 'number', default: 70, min: 60, max: 85, step: 1 }] },
      { id: 'macd_cross_bull', label: 'MACD Bullish Cross', desc: 'MACD line crosses above signal line', complexity: 'advanced', params: [{ key: 'fast', label: 'Fast Period', type: 'number', default: 12, min: 5, max: 20, step: 1 }, { key: 'slow', label: 'Slow Period', type: 'number', default: 26, min: 15, max: 50, step: 1 }, { key: 'signal', label: 'Signal Period', type: 'number', default: 9, min: 3, max: 15, step: 1 }] },
      { id: 'macd_cross_bear', label: 'MACD Bearish Cross', desc: 'MACD line crosses below signal line', complexity: 'advanced', params: [{ key: 'fast', label: 'Fast Period', type: 'number', default: 12, min: 5, max: 20, step: 1 }, { key: 'slow', label: 'Slow Period', type: 'number', default: 26, min: 15, max: 50, step: 1 }] },
      { id: 'bb_squeeze_break', label: 'Bollinger Squeeze Break', desc: 'Breakout after period of low volatility (band squeeze)', complexity: 'advanced', params: [{ key: 'bb_period', label: 'BB Period', type: 'number', default: 20, min: 10, max: 50, step: 1 }, { key: 'bb_std', label: 'Std Dev', type: 'number', default: 2.0, min: 1.0, max: 3.0, step: 0.1 }] },
    ],
  },
};

const PHASES = [
  { key: 'phase1', label: 'Phase 1', subtitle: 'HTF Bias', color: '#38bdf8', dim: 'rgba(56,189,248,0.06)', border: 'rgba(56,189,248,0.18)' },
  { key: 'phase2', label: 'Phase 2', subtitle: 'Structure / POI', color: '#a78bfa', dim: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.18)' },
  { key: 'phase3', label: 'Phase 3', subtitle: 'Entry Zone', color: '#f59e0b', dim: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)' },
  { key: 'phase4', label: 'Phase 4', subtitle: 'Trigger', color: '#10b981', dim: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.18)' },
];

const COMPLEXITY = {
  basic: { label: 'Basic', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  intermediate: { label: 'Mid', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  advanced: { label: 'Adv', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
};

const PRESETS = [
  { name: 'BTC 4H Trend', pair: 'BTCUSDT', tf: '4h', phase1: ['htf_bullish', 'regime_trending'], phase2: ['bos_bullish', 'bullish_ob'], phase3: ['ote_zone', 'inside_ob'], phase4: ['candle_confirm', 'volume_spike'] },
  { name: 'ETH 1H Scalp', pair: 'ETHUSDT', tf: '1h', phase1: ['htf_bullish', 'daily_bias_bullish'], phase2: ['bos_bullish', 'fvg_bullish'], phase3: ['killzone', 'inside_fvg'], phase4: ['engulfing_bull', 'volume_spike'] },
  { name: 'SOL Momentum', pair: 'SOLUSDT', tf: '1h', phase1: ['regime_trending', 'ma_stack_bullish'], phase2: ['choch_bullish', 'liq_swept_low'], phase3: ['price_in_discount', 'session_overlap'], phase4: ['momentum_shift', 'three_confluences'] },
];

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];
const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'AVAXUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'APTUSDT', 'SUIUSDT', 'DOGEUSDT', 'PEPEUSDT'];

function getAllRules() {
  const out = {};
  Object.values(RULE_LIBRARY).forEach((cat) => cat.rules.forEach((r) => {
    out[r.id] = r;
  }));
  return out;
}
const ALL_RULES = getAllRules();
const genId = () => Math.random().toString(36).slice(2, 9);
const makeInstance = (ruleId) => {
  const rule = ALL_RULES[ruleId];
  if (!rule) return null;
  const params = {};
  rule.params.forEach((p) => {
    params[p.key] = p.default;
  });
  return { iid: genId(), ruleId, params };
};

let _drag = null;

function LibraryRuleCard({ rule, color, alreadyUsed }) {
  const handleDragStart = (e) => {
    _drag = { source: 'library', ruleId: rule.id };
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', rule.id);
  };
  const cx = COMPLEXITY[rule.complexity];
  return (
    <div
      draggable={!alreadyUsed}
      onDragStart={handleDragStart}
      style={{
        padding: '9px 11px',
        borderRadius: 9,
        background: alreadyUsed ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
        border: alreadyUsed ? `1px solid ${color}20` : '1px solid rgba(255,255,255,0.07)',
        cursor: alreadyUsed ? 'not-allowed' : 'grab',
        opacity: alreadyUsed ? 0.4 : 1,
        transition: 'all 0.18s ease',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#e8e6f0', flex: 1, lineHeight: 1.2 }}>{rule.label}</span>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: cx.bg, color: cx.color }}>{cx.label}</span>
      </div>
      <p style={{ fontSize: 10, color: 'rgba(232,230,240,0.32)', lineHeight: 1.4, margin: 0 }}>{rule.desc}</p>
    </div>
  );
}

function PlacedRule({ instance, phaseColor, isFirst, isLast, onRemove, onMoveUp, onMoveDown, onParamChange }) {
  const [open, setOpen] = useState(false);
  const rule = ALL_RULES[instance.ruleId];
  if (!rule) return null;
  const hasParams = rule.params.length > 0;
  return (
    <div style={{ borderRadius: 9, background: `${phaseColor}0e`, border: `1px solid ${phaseColor}28`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px' }} onClick={() => hasParams && setOpen((o) => !o)}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e8e6f0', display: 'block' }}>{rule.label}</span>
          {!open && hasParams && <span style={{ fontSize: 9, color: 'rgba(232,230,240,0.3)', fontFamily: 'monospace' }}>{Object.entries(instance.params).map(([k, v]) => `${k}=${v}`).join(' · ')}</span>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst} style={{ width: 18, height: 18 }}>▲</button>
        <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast} style={{ width: 18, height: 18 }}>▼</button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ width: 18, height: 18 }}>✕</button>
      </div>
      {open && hasParams && (
        <div style={{ padding: '10px 14px', borderTop: `1px solid ${phaseColor}18`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rule.params.map((param) => (
            <div key={param.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: 'rgba(232,230,240,0.45)', fontFamily: 'monospace' }}>{param.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: phaseColor, fontFamily: 'monospace' }}>{instance.params[param.key] ?? param.default}</span>
              </div>
              <input
                type="range"
                min={param.min}
                max={param.max}
                step={param.step}
                value={instance.params[param.key] ?? param.default}
                onChange={(e) => onParamChange(param.key, parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseZone({ phase, instances, onChange }) {
  const [over, setOver] = useState(false);
  const [insertIdx, setInsertIdx] = useState(null);
  const zoneRef = useRef(null);

  const computeInsertIdx = (clientY) => {
    if (!zoneRef.current) return instances.length;
    const items = zoneRef.current.querySelectorAll('[data-placed]');
    let idx = instances.length;
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (clientY < r.top + r.height / 2 && idx === instances.length) idx = i;
    });
    return idx;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setOver(true);
    setInsertIdx(computeInsertIdx(e.clientY));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const state = _drag;
    _drag = null;
    setOver(false);
    const at = insertIdx !== null ? insertIdx : instances.length;
    if (!state) return;
    if (state.source === 'library') {
      if (instances.find((i) => i.ruleId === state.ruleId)) return;
      const inst = makeInstance(state.ruleId);
      if (!inst) return;
      const next = [...instances];
      next.splice(at, 0, inst);
      onChange(next);
      return;
    }
    if (state.source === 'phase' && state.phaseKey === phase.key) {
      const from = state.index;
      const next = [...instances];
      const [item] = next.splice(from, 1);
      const adjustedAt = from < at ? at - 1 : at;
      next.splice(adjustedAt, 0, item);
      onChange(next);
    }
  };

  return (
    <div
      ref={zoneRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={(e) => {
        if (!zoneRef.current?.contains(e.relatedTarget)) {
          setOver(false);
          setInsertIdx(null);
        }
      }}
      style={{ minHeight: 110, borderRadius: 11, border: `2px dashed ${over ? phase.color : phase.border}`, background: over ? phase.dim : 'transparent', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {instances.length === 0 && <div style={{ textAlign: 'center', opacity: 0.5, fontSize: 11, padding: 20 }}>Drop rules here</div>}
      {instances.map((inst, idx) => (
        <div
          key={inst.iid}
          data-placed
          draggable
          onDragStart={() => {
            _drag = { source: 'phase', phaseKey: phase.key, ruleId: inst.ruleId, index: idx };
          }}
        >
          {insertIdx === idx && over && <div style={{ height: 2, background: phase.color }} />}
          <PlacedRule
            instance={inst}
            phaseColor={phase.color}
            isFirst={idx === 0}
            isLast={idx === instances.length - 1}
            onRemove={() => onChange(instances.filter((i) => i.iid !== inst.iid))}
            onMoveUp={() => {
              if (idx === 0) return;
              const n = [...instances];
              [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]];
              onChange(n);
            }}
            onMoveDown={() => {
              if (idx === instances.length - 1) return;
              const n = [...instances];
              [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]];
              onChange(n);
            }}
            onParamChange={(k, v) => onChange(instances.map((i) => (i.iid === inst.iid ? { ...i, params: { ...i.params, [k]: v } } : i)))}
          />
        </div>
      ))}
    </div>
  );
}

export default function AdvancedModelBuilder({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [pair, setPair] = useState('BTCUSDT');
  const [tf, setTf] = useState('1h');
  const [direction, setDirection] = useState('both');
  const [minScore, setMinScore] = useState(65);
  const [logic, setLogic] = useState('AND');
  const [sl, setSl] = useState(20);
  const [tp1, setTp1] = useState(50);
  const [tp2, setTp2] = useState(100);
  const [tp3, setTp3] = useState(200);
  const [leverage, setLeverage] = useState(5);
  const [autoTrade, setAutoTrade] = useState(false);
  const [autoThreshold, setAutoThreshold] = useState(80);
  const [phases, setPhases] = useState({ phase1: [], phase2: [], phase3: [], phase4: [] });
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('HTF Bias');

  const updatePhase = useCallback((key, val) => setPhases((p) => ({ ...p, [key]: val })), []);
  const usedIds = new Set(Object.values(phases).flatMap((arr) => arr.map((i) => i.ruleId)));

  const filteredRules = (catKey) => (RULE_LIBRARY[catKey]?.rules || []).filter((r) => !search || r.label.toLowerCase().includes(search.toLowerCase()) || r.desc.toLowerCase().includes(search.toLowerCase()));

  const loadPreset = (presetName) => {
    const p = PRESETS.find((item) => item.name === presetName);
    if (!p) return;
    setName(p.name);
    setPair(p.pair);
    setTf(p.tf);
    const toInst = (ids) => ids.map(makeInstance).filter(Boolean);
    setPhases({ phase1: toInst(p.phase1), phase2: toInst(p.phase2), phase3: toInst(p.phase3), phase4: toInst(p.phase4) });
  };

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', background: '#0a0a12', color: '#e8e6f0', height: '85vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <input className="ifield" placeholder="Model name..." value={name} onChange={(e) => setName(e.target.value)} style={{ width: 250 }} />
        <select className="ifield" value={pair} onChange={(e) => setPair(e.target.value)} style={{ width: 140 }}>{PAIRS.map((p) => <option key={p}>{p}</option>)}</select>
        <select className="ifield" value={tf} onChange={(e) => setTf(e.target.value)} style={{ width: 80 }}>{TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="ifield" onChange={(e) => loadPreset(e.target.value)} style={{ width: 180 }}>
          <option value="">Load preset...</option>
          {PRESETS.map((p) => <option key={p.name}>{p.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn-secondary btn-sm" onClick={onCancel}>Close</button>
        <button
          className="btn-primary btn-sm"
          disabled={!name.trim()}
          onClick={() => onSave?.({
            name,
            pair,
            timeframe: tf,
            direction,
            minQualityScore: minScore,
            logic,
            sl,
            tp1,
            tp2,
            tp3,
            leverage,
            autoTrade,
            autoThreshold,
            phase1Rules: phases.phase1.map((i) => ({ ruleId: i.ruleId, params: i.params })),
            phase2Rules: phases.phase2.map((i) => ({ ruleId: i.ruleId, params: i.params })),
            phase3Rules: phases.phase3.map((i) => ({ ruleId: i.ruleId, params: i.params })),
            phase4Rules: phases.phase4.map((i) => ({ ruleId: i.ruleId, params: i.params })),
          })}
        >
          Save Model
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 280, borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 10 }}>
            <input className="ifield" placeholder="Search rules..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.keys(RULE_LIBRARY).map((key) => (
              <button key={key} onClick={() => setCat(key)} className="btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: cat === key ? RULE_LIBRARY[key].color : undefined }}>
                {RULE_LIBRARY[key].glyph} {key}
              </button>
            ))}
          </div>
          <div style={{ padding: 8, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {filteredRules(cat).map((rule) => (
              <LibraryRuleCard key={rule.id} rule={rule} color={RULE_LIBRARY[cat].color} alreadyUsed={usedIds.has(rule.id)} />
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {['both', 'long', 'short'].map((d) => <button key={d} onClick={() => setDirection(d)} className={`btn-secondary btn-sm ${direction === d ? '!bg-signal-500/20 !text-signal-400' : ''}`}>{d}</button>)}
            <div style={{ marginLeft: 'auto', width: 180 }}>
              <div style={{ fontSize: 11, marginBottom: 4 }}>Min score: {minScore}</div>
              <input type="range" min={0} max={100} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {PHASES.map((phase) => (
              <div key={phase.key}>
                <div style={{ marginBottom: 6, fontWeight: 700, color: phase.color }}>{phase.label} · {phase.subtitle}</div>
                <PhaseZone phase={phase} instances={phases[phase.key]} onChange={(v) => updatePhase(phase.key, v)} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
            <div><div style={{ fontSize: 11 }}>SL</div><input className="ifield" type="number" value={sl} onChange={(e) => setSl(Number(e.target.value))} /></div>
            <div><div style={{ fontSize: 11 }}>TP1</div><input className="ifield" type="number" value={tp1} onChange={(e) => setTp1(Number(e.target.value))} /></div>
            <div><div style={{ fontSize: 11 }}>TP2</div><input className="ifield" type="number" value={tp2} onChange={(e) => setTp2(Number(e.target.value))} /></div>
            <div><div style={{ fontSize: 11 }}>TP3</div><input className="ifield" type="number" value={tp3} onChange={(e) => setTp3(Number(e.target.value))} /></div>
            <div><div style={{ fontSize: 11 }}>Leverage</div><input className="ifield" type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} /></div>
            <div><div style={{ fontSize: 11 }}>Logic</div><select className="ifield" value={logic} onChange={(e) => setLogic(e.target.value)}><option>AND</option><option>OR</option></select></div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={autoTrade} onChange={(e) => setAutoTrade(e.target.checked)} />
            <span>Auto trade</span>
            {autoTrade && (
              <>
                <span>Threshold</span>
                <input className="ifield" style={{ width: 90 }} type="number" value={autoThreshold} onChange={(e) => setAutoThreshold(Number(e.target.value))} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

