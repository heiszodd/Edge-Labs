import { useState } from 'react';

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'AVAXUSDT', 'DOGEUSDT'];
const TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d'];

function parseRules(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((ruleId) => ({ ruleId, params: {} }));
}

export default function AdvancedModelBuilder({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [pair, setPair] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [direction, setDirection] = useState('both');
  const [minQualityScore, setMinQualityScore] = useState(65);
  const [logic, setLogic] = useState('AND');
  const [leverage, setLeverage] = useState(5);
  const [sl, setSl] = useState(20);
  const [tp1, setTp1] = useState(50);
  const [tp2, setTp2] = useState(100);
  const [tp3, setTp3] = useState(200);
  const [autoTrade, setAutoTrade] = useState(false);
  const [autoThreshold, setAutoThreshold] = useState(80);
  const [phase1, setPhase1] = useState('');
  const [phase2, setPhase2] = useState('');
  const [phase3, setPhase3] = useState('');
  const [phase4, setPhase4] = useState('');

  const save = () => {
    onSave?.({
      name,
      pair,
      timeframe,
      direction,
      minQualityScore,
      logic,
      leverage,
      sl,
      tp1,
      tp2,
      tp3,
      autoTrade,
      autoThreshold,
      phase1Rules: parseRules(phase1),
      phase2Rules: parseRules(phase2),
      phase3Rules: parseRules(phase3),
      phase4Rules: parseRules(phase4),
    });
  };

  return (
    <div className="bg-[var(--bg-card)] text-[var(--text-primary)] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Advanced Model Builder</h2>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onCancel}>Close</button>
          <button className="btn-primary" onClick={save} disabled={!name.trim()}>Save Model</button>
        </div>
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        <input className="input" placeholder="Model name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="input" value={pair} onChange={(e) => setPair(e.target.value)}>{PAIRS.map((p) => <option key={p}>{p}</option>)}</select>
        <select className="input" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>{TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="input" value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="both">both</option>
          <option value="long">long</option>
          <option value="short">short</option>
        </select>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <label className="text-sm">Min Quality Score<input className="input mt-1" type="number" value={minQualityScore} onChange={(e) => setMinQualityScore(Number(e.target.value || 0))} /></label>
        <label className="text-sm">Leverage<input className="input mt-1" type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value || 0))} /></label>
        <label className="text-sm">Logic<select className="input mt-1" value={logic} onChange={(e) => setLogic(e.target.value)}><option>AND</option><option>OR</option></select></label>
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        <label className="text-sm">SL %<input className="input mt-1" type="number" value={sl} onChange={(e) => setSl(Number(e.target.value || 0))} /></label>
        <label className="text-sm">TP1 %<input className="input mt-1" type="number" value={tp1} onChange={(e) => setTp1(Number(e.target.value || 0))} /></label>
        <label className="text-sm">TP2 %<input className="input mt-1" type="number" value={tp2} onChange={(e) => setTp2(Number(e.target.value || 0))} /></label>
        <label className="text-sm">TP3 %<input className="input mt-1" type="number" value={tp3} onChange={(e) => setTp3(Number(e.target.value || 0))} /></label>
      </div>
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoTrade} onChange={(e) => setAutoTrade(e.target.checked)} />
          Auto trade
        </label>
        <input className="input max-w-40" type="number" value={autoThreshold} onChange={(e) => setAutoThreshold(Number(e.target.value || 0))} />
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <label className="text-sm">Phase 1 Rules (one `ruleId` per line)<textarea className="input min-h-32 mt-1" value={phase1} onChange={(e) => setPhase1(e.target.value)} /></label>
        <label className="text-sm">Phase 2 Rules<textarea className="input min-h-32 mt-1" value={phase2} onChange={(e) => setPhase2(e.target.value)} /></label>
        <label className="text-sm">Phase 3 Rules<textarea className="input min-h-32 mt-1" value={phase3} onChange={(e) => setPhase3(e.target.value)} /></label>
        <label className="text-sm">Phase 4 Rules<textarea className="input min-h-32 mt-1" value={phase4} onChange={(e) => setPhase4(e.target.value)} /></label>
      </div>
    </div>
  );
}
