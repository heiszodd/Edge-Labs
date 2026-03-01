import { useEffect, useMemo, useState } from 'react';

const RULE_LIBRARY = {
  phase1: [
    { id: 'htf_bullish', label: 'HTF Bullish', desc: 'Higher timeframe bullish structure', params: [] },
    { id: 'htf_bearish', label: 'HTF Bearish', desc: 'Higher timeframe bearish structure', params: [] },
    { id: 'ma_stack_bullish', label: 'MA Stack Bullish', desc: 'Fast MA above slow MA', params: [{ key: 'fast', label: 'Fast MA', min: 5, max: 100, step: 1, default: 20 }, { key: 'slow', label: 'Slow MA', min: 20, max: 300, step: 1, default: 100 }] },
    { id: 'ma_stack_bearish', label: 'MA Stack Bearish', desc: 'Fast MA below slow MA', params: [{ key: 'fast', label: 'Fast MA', min: 5, max: 100, step: 1, default: 20 }, { key: 'slow', label: 'Slow MA', min: 20, max: 300, step: 1, default: 100 }] },
  ],
  phase2: [
    { id: 'bos_bullish', label: 'BOS Bullish', desc: 'Break of structure bullish', params: [{ key: 'lookback', label: 'Lookback', min: 10, max: 100, step: 1, default: 50 }] },
    { id: 'bos_bearish', label: 'BOS Bearish', desc: 'Break of structure bearish', params: [{ key: 'lookback', label: 'Lookback', min: 10, max: 100, step: 1, default: 50 }] },
    { id: 'bullish_ob', label: 'Bullish OB', desc: 'Price taps bullish order block', params: [] },
    { id: 'bearish_ob', label: 'Bearish OB', desc: 'Price taps bearish order block', params: [] },
    { id: 'fvg_bullish', label: 'FVG Bullish', desc: 'Bullish fair value gap', params: [] },
    { id: 'fvg_bearish', label: 'FVG Bearish', desc: 'Bearish fair value gap', params: [] },
  ],
  phase3: [
    { id: 'ote_zone', label: 'OTE Zone', desc: 'Price in optimal trade entry range', params: [{ key: 'fib_low', label: 'Fib Low', min: 50, max: 70, step: 0.1, default: 61.8 }, { key: 'fib_high', label: 'Fib High', min: 70, max: 90, step: 0.1, default: 79 }] },
    { id: 'killzone', label: 'Killzone', desc: 'Session killzone active', params: [] },
    { id: 'inside_ob', label: 'Inside OB', desc: 'Price inside order block', params: [] },
    { id: 'inside_fvg', label: 'Inside FVG', desc: 'Price inside fair value gap', params: [] },
  ],
  phase4: [
    { id: 'candle_confirm', label: 'Candle Confirm', desc: 'Strong confirmation candle', params: [{ key: 'body_pct', label: 'Body %', min: 40, max: 90, step: 1, default: 60 }] },
    { id: 'volume_spike', label: 'Volume Spike', desc: 'Volume above threshold', params: [{ key: 'mult', label: 'Multiplier', min: 1, max: 5, step: 0.1, default: 1.8 }] },
    { id: 'engulfing_bull', label: 'Engulfing Bull', desc: 'Bullish engulfing pattern', params: [] },
    { id: 'engulfing_bear', label: 'Engulfing Bear', desc: 'Bearish engulfing pattern', params: [] },
    { id: 'momentum_shift', label: 'Momentum Shift', desc: 'Directional close sequence', params: [{ key: 'bars', label: 'Bars', min: 2, max: 8, step: 1, default: 3 }] },
  ],
};

const PRESETS = [
  { name: 'BTC Trend 4H', pair: 'BTCUSDT', timeframe: '4h', phase1: ['htf_bullish', 'ma_stack_bullish'], phase2: ['bos_bullish', 'bullish_ob'], phase3: ['ote_zone', 'killzone'], phase4: ['candle_confirm', 'volume_spike'] },
  { name: 'ETH Intraday', pair: 'ETHUSDT', timeframe: '1h', phase1: ['htf_bullish'], phase2: ['bos_bullish', 'fvg_bullish'], phase3: ['inside_fvg', 'killzone'], phase4: ['engulfing_bull', 'momentum_shift'] },
];

const TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d'];
const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'AVAXUSDT'];
const PHASE_KEYS = ['phase1', 'phase2', 'phase3', 'phase4'];

const ALL_RULES = Object.values(RULE_LIBRARY).flat().reduce((acc, rule) => {
  acc[rule.id] = rule;
  return acc;
}, {});

let dragState = null;

const genId = () => Math.random().toString(36).slice(2, 9);

function makeInstance(ruleId) {
  const rule = ALL_RULES[ruleId];
  if (!rule) return null;
  const params = {};
  for (const p of rule.params) params[p.key] = p.default;
  return { iid: genId(), ruleId, params };
}

function LibraryRule({ rule, disabled }) {
  return (
    <div
      draggable={!disabled}
      onDragStart={(e) => {
        dragState = { source: 'library', ruleId: rule.id };
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', rule.id);
      }}
      className={`card !p-3 text-sm ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-grab'}`}
    >
      <p className="font-semibold">{rule.label}</p>
      <p className="text-xs text-[var(--text-muted)]">{rule.desc}</p>
    </div>
  );
}

function PlacedRule({ instance, index, total, onRemove, onMoveUp, onMoveDown, onParamChange }) {
  const [open, setOpen] = useState(false);
  const rule = ALL_RULES[instance.ruleId];
  if (!rule) return null;
  return (
    <div
      draggable
      onDragStart={() => {
        dragState = { source: 'phase', index, iid: instance.iid };
      }}
      className="card !p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <button className="btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Params'}</button>
        <p className="font-semibold text-sm flex-1">{rule.label}</p>
        <button className="btn-ghost btn-sm" onClick={onMoveUp} disabled={index === 0}>Up</button>
        <button className="btn-ghost btn-sm" onClick={onMoveDown} disabled={index === total - 1}>Down</button>
        <button className="btn-danger btn-sm" onClick={onRemove}>Remove</button>
      </div>
      {open && rule.params.length > 0 && (
        <div className="grid md:grid-cols-2 gap-2">
          {rule.params.map((p) => (
            <label key={p.key} className="text-xs">
              <span className="block mb-1 text-[var(--text-muted)]">{p.label}: {instance.params[p.key]}</span>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={instance.params[p.key]}
                onChange={(e) => onParamChange(p.key, Number(e.target.value))}
                className="w-full"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseZone({ phaseKey, title, instances, onChange }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`rounded-2xl border p-3 min-h-36 ${over ? 'border-signal-400 bg-signal-500/5' : 'border-[var(--border)] bg-[var(--bg-secondary)]'}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!dragState) return;
        if (dragState.source === 'library') {
          if (instances.some((x) => x.ruleId === dragState.ruleId)) return;
          const added = makeInstance(dragState.ruleId);
          if (!added) return;
          onChange([...instances, added]);
          return;
        }
        if (dragState.source === 'phase') {
          const idx = instances.findIndex((x) => x.iid === dragState.iid);
          if (idx === -1) return;
          const copy = [...instances];
          const [item] = copy.splice(idx, 1);
          copy.push(item);
          onChange(copy);
        }
      }}
    >
      <p className="text-sm font-semibold mb-2">{title}</p>
      <div className="space-y-2">
        {instances.map((inst, idx) => (
          <PlacedRule
            key={inst.iid}
            instance={inst}
            index={idx}
            total={instances.length}
            onRemove={() => onChange(instances.filter((x) => x.iid !== inst.iid))}
            onMoveUp={() => {
              if (idx === 0) return;
              const copy = [...instances];
              [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
              onChange(copy);
            }}
            onMoveDown={() => {
              if (idx === instances.length - 1) return;
              const copy = [...instances];
              [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
              onChange(copy);
            }}
            onParamChange={(k, v) => {
              onChange(instances.map((x) => (x.iid === inst.iid ? { ...x, params: { ...x.params, [k]: v } } : x)));
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdvancedModelBuilder({ onSave, onCancel, initialConfig }) {
  const [name, setName] = useState('');
  const [pair, setPair] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [direction, setDirection] = useState('both');
  const [logic, setLogic] = useState('AND');
  const [minQualityScore, setMinQualityScore] = useState(65);
  const [sl, setSl] = useState(20);
  const [tp1, setTp1] = useState(50);
  const [tp2, setTp2] = useState(100);
  const [tp3, setTp3] = useState(200);
  const [leverage, setLeverage] = useState(5);
  const [autoTrade, setAutoTrade] = useState(false);
  const [autoThreshold, setAutoThreshold] = useState(80);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('phase1');
  const [phases, setPhases] = useState({ phase1: [], phase2: [], phase3: [], phase4: [] });
  const [seedContext, setSeedContext] = useState(null);

  useEffect(() => {
    if (!initialConfig) return;
    if (initialConfig.pair) setPair(initialConfig.pair);
    if (initialConfig.timeframe) setTimeframe(initialConfig.timeframe);
    if (typeof initialConfig.autoThreshold === 'number') setAutoThreshold(initialConfig.autoThreshold);
    if (typeof initialConfig.minQualityScore === 'number') setMinQualityScore(initialConfig.minQualityScore);
    if (initialConfig.seedRuleId) {
      setPhases((prev) => {
        if (prev.phase4.some((r) => r.ruleId === initialConfig.seedRuleId)) return prev;
        const inst = makeInstance(initialConfig.seedRuleId);
        if (!inst) return prev;
        return { ...prev, phase4: [...prev.phase4, inst] };
      });
    }
    if (initialConfig.seedContext) {
      setSeedContext(initialConfig.seedContext);
    }
  }, [initialConfig]);

  const used = useMemo(() => new Set(Object.values(phases).flat().map((x) => x.ruleId)), [phases]);
  const filteredRules = (RULE_LIBRARY[cat] || []).filter(
    (r) =>
      r.label.toLowerCase().includes(search.toLowerCase()) ||
      r.desc.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase()),
  );

  const loadPreset = (nameValue) => {
    const preset = PRESETS.find((p) => p.name === nameValue);
    if (!preset) return;
    setName(preset.name);
    setPair(preset.pair);
    setTimeframe(preset.timeframe);
    setPhases({
      phase1: (preset.phase1 || []).map(makeInstance).filter(Boolean),
      phase2: (preset.phase2 || []).map(makeInstance).filter(Boolean),
      phase3: (preset.phase3 || []).map(makeInstance).filter(Boolean),
      phase4: (preset.phase4 || []).map(makeInstance).filter(Boolean),
    });
  };

  const save = () => {
    onSave?.({
      name,
      pair,
      timeframe,
      direction,
      logic,
      minQualityScore,
      sl,
      tp1,
      tp2,
      tp3,
      leverage,
      autoTrade,
      autoThreshold,
      phase1Rules: phases.phase1.map((x) => ({ ruleId: x.ruleId, params: x.params })),
      phase2Rules: phases.phase2.map((x) => ({ ruleId: x.ruleId, params: x.params })),
      phase3Rules: phases.phase3.map((x) => ({ ruleId: x.ruleId, params: x.params })),
      phase4Rules: phases.phase4.map((x) => ({ ruleId: x.ruleId, params: x.params })),
    });
  };

  return (
    <div className="bg-[var(--bg-card)] text-[var(--text-primary)] h-[85vh] flex flex-col">
      <div className="p-4 border-b border-[var(--border)] flex items-center gap-2">
        <input className="input max-w-72" placeholder="Model name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="input max-w-40" value={pair} onChange={(e) => setPair(e.target.value)}>{PAIRS.map((p) => <option key={p}>{p}</option>)}</select>
        <select className="input max-w-28" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>{TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="input max-w-44" onChange={(e) => loadPreset(e.target.value)} defaultValue=""><option value="">Load preset</option>{PRESETS.map((p) => <option key={p.name}>{p.name}</option>)}</select>
        <div className="flex-1" />
        <button className="btn-secondary" onClick={onCancel}>Close</button>
        <button className="btn-primary" onClick={save} disabled={!name.trim()}>Save Model</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-[var(--border)] p-3 overflow-y-auto space-y-3 bg-[var(--bg-secondary)]">
          <input className="input" placeholder="Search rule..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            {PHASE_KEYS.map((key) => (
              <button key={key} className={`btn-sm ${cat === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCat(key)}>
                {key.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredRules.map((rule) => <LibraryRule key={rule.id} rule={rule} disabled={used.has(rule.id)} />)}
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="card grid md:grid-cols-4 gap-3">
            <select className="input" value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="both">both</option>
              <option value="long">long</option>
              <option value="short">short</option>
            </select>
            <select className="input" value={logic} onChange={(e) => setLogic(e.target.value)}>
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
            <label className="text-xs">
              <span className="block mb-1 text-[var(--text-muted)]">Min Score: {minQualityScore}</span>
              <input type="range" min={0} max={100} step={1} value={minQualityScore} onChange={(e) => setMinQualityScore(Number(e.target.value))} className="w-full" />
            </label>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={autoTrade} onChange={(e) => setAutoTrade(e.target.checked)} />
              <span className="text-sm">Auto trade</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <PhaseZone phaseKey="phase1" title="Phase 1 - HTF Bias" instances={phases.phase1} onChange={(next) => setPhases((p) => ({ ...p, phase1: next }))} />
            <PhaseZone phaseKey="phase2" title="Phase 2 - Structure" instances={phases.phase2} onChange={(next) => setPhases((p) => ({ ...p, phase2: next }))} />
            <PhaseZone phaseKey="phase3" title="Phase 3 - Entry Zone" instances={phases.phase3} onChange={(next) => setPhases((p) => ({ ...p, phase3: next }))} />
            <PhaseZone phaseKey="phase4" title="Phase 4 - Trigger" instances={phases.phase4} onChange={(next) => setPhases((p) => ({ ...p, phase4: next }))} />
          </div>

          <div className="card grid md:grid-cols-6 gap-2">
            <input className="input" type="number" value={sl} onChange={(e) => setSl(Number(e.target.value || 0))} placeholder="SL %" />
            <input className="input" type="number" value={tp1} onChange={(e) => setTp1(Number(e.target.value || 0))} placeholder="TP1 %" />
            <input className="input" type="number" value={tp2} onChange={(e) => setTp2(Number(e.target.value || 0))} placeholder="TP2 %" />
            <input className="input" type="number" value={tp3} onChange={(e) => setTp3(Number(e.target.value || 0))} placeholder="TP3 %" />
            <input className="input" type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value || 0))} placeholder="Leverage" />
            <input className="input" type="number" value={autoThreshold} onChange={(e) => setAutoThreshold(Number(e.target.value || 0))} placeholder="Auto threshold" />
          </div>
          {seedContext && (
            <div className="card !p-3 text-xs text-[var(--text-muted)]">
              Seeded from candle: {seedContext.pair} {seedContext.timeframe} · {seedContext.timestamp}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
