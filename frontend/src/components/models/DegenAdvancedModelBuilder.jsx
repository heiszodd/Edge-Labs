import { useState } from 'react';

const PRESETS = [
  { name: 'Scalp Hunter', min_score: 75, min_liquidity_usd: 20000, max_rug_score: 35, position_size_usd: 40, auto_buy_threshold: 85 },
  { name: 'Midcap Momentum', min_score: 68, min_liquidity_usd: 12000, max_rug_score: 45, position_size_usd: 60, auto_buy_threshold: 80 },
  { name: 'High-Risk Degen', min_score: 60, min_liquidity_usd: 6000, max_rug_score: 60, position_size_usd: 35, auto_buy_threshold: 88 },
];

const DEFAULT_STATE = {
  name: '',
  description: '',
  active: true,
  min_score: 70,
  min_mcap_usd: 0,
  max_mcap_usd: 10000000,
  min_liquidity_usd: 10000,
  max_age_minutes: 1440,
  min_holder_count: 50,
  max_rug_score: 50,
  position_size_usd: 50,
  auto_buy: false,
  auto_buy_threshold: 80,
};

export default function DegenAdvancedModelBuilder({ onCancel, onSave, initialModel }) {
  const [form, setForm] = useState({ ...DEFAULT_STATE, ...(initialModel || {}) });
  const [tab, setTab] = useState('Safety');
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="bg-[var(--bg-card)] text-[var(--text-primary)] h-[85vh] flex flex-col">
      <div className="p-4 border-b border-[var(--border)] flex items-center gap-2">
        <input className="input max-w-80" placeholder="Model name" value={form.name} onChange={(e) => setField('name', e.target.value)} />
        <input className="input max-w-md" placeholder="Description (optional)" value={form.description} onChange={(e) => setField('description', e.target.value)} />
        <div className="flex-1" />
        <button className="btn-secondary" onClick={onCancel}>Close</button>
        <button className="btn-primary" onClick={() => onSave?.(form)} disabled={!form.name.trim()}>Save Model</button>
      </div>

      <div className="p-4 border-b border-[var(--border)] flex gap-2 overflow-x-auto">
        {['Safety', 'Market', 'Risk', 'Automation'].map((item) => (
          <button key={item} className={`btn-sm whitespace-nowrap ${tab === item ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
        <div className="flex-1" />
        <select
          className="input max-w-56"
          onChange={(e) => {
            const preset = PRESETS.find((p) => p.name === e.target.value);
            if (preset) setForm((prev) => ({ ...prev, ...preset }));
          }}
          defaultValue=""
        >
          <option value="">Load preset</option>
          {PRESETS.map((preset) => <option key={preset.name}>{preset.name}</option>)}
        </select>
      </div>

      <div className="p-4 overflow-y-auto space-y-4">
        {tab === 'Safety' && (
          <div className="grid md:grid-cols-2 gap-3">
            <label className="card !p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)] mb-1">Minimum Safety Score ({form.min_score})</p>
              <input type="range" min={0} max={100} value={form.min_score} onChange={(e) => setField('min_score', Number(e.target.value))} />
            </label>
            <label className="card !p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)] mb-1">Max Rug Score ({form.max_rug_score})</p>
              <input type="range" min={0} max={100} value={form.max_rug_score} onChange={(e) => setField('max_rug_score', Number(e.target.value))} />
            </label>
            <label className="card !p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)] mb-1">Minimum Holder Count</p>
              <input className="input" type="number" min={0} value={form.min_holder_count} onChange={(e) => setField('min_holder_count', Number(e.target.value || 0))} />
            </label>
            <label className="card !p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)] mb-1">Maximum Age (minutes)</p>
              <input className="input" type="number" min={1} value={form.max_age_minutes} onChange={(e) => setField('max_age_minutes', Number(e.target.value || 1))} />
            </label>
          </div>
        )}

        {tab === 'Market' && (
          <div className="grid md:grid-cols-2 gap-3">
            <label className="card !p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)] mb-1">Min Market Cap</p>
              <input className="input" type="number" min={0} value={form.min_mcap_usd} onChange={(e) => setField('min_mcap_usd', Number(e.target.value || 0))} />
            </label>
            <label className="card !p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)] mb-1">Max Market Cap</p>
              <input className="input" type="number" min={0} value={form.max_mcap_usd} onChange={(e) => setField('max_mcap_usd', Number(e.target.value || 0))} />
            </label>
            <label className="card !p-3 text-sm md:col-span-2">
              <p className="text-xs text-[var(--text-muted)] mb-1">Min Liquidity ({form.min_liquidity_usd})</p>
              <input type="range" min={0} max={250000} step={500} value={form.min_liquidity_usd} onChange={(e) => setField('min_liquidity_usd', Number(e.target.value))} />
            </label>
          </div>
        )}

        {tab === 'Risk' && (
          <div className="grid md:grid-cols-2 gap-3">
            <label className="card !p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)] mb-1">Position Size (USD)</p>
              <input className="input" type="number" min={1} value={form.position_size_usd} onChange={(e) => setField('position_size_usd', Number(e.target.value || 1))} />
            </label>
            <label className="card !p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)] mb-1">Model Active</p>
              <div className="pt-2">
                <input type="checkbox" checked={form.active} onChange={(e) => setField('active', e.target.checked)} />
              </div>
            </label>
          </div>
        )}

        {tab === 'Automation' && (
          <div className="grid md:grid-cols-2 gap-3">
            <label className="card !p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)] mb-2">Auto-buy</p>
              <input type="checkbox" checked={form.auto_buy} onChange={(e) => setField('auto_buy', e.target.checked)} />
            </label>
            <label className="card !p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)] mb-1">Auto-buy threshold ({form.auto_buy_threshold})</p>
              <input type="range" min={0} max={100} value={form.auto_buy_threshold} onChange={(e) => setField('auto_buy_threshold', Number(e.target.value))} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
