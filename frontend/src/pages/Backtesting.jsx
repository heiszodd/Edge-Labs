import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { createModel, getModels } from '../api/perps';
import { getBacktestRun, runBacktest as runBacktestApi } from '../api/backtesting';
import TierGuard from '../components/common/TierGuard';

const timeframeOptions = ['15m', '1h', '4h', '1d'];
const initialZones = { phase1: [], phase2: [], phase3: [], phase4: [] };
const ruleLibrary = {
  phase1: [
    { id: 'p1-trend', name: 'Trend Alignment', description: 'Confirms higher timeframe direction.', expected: 'Avoids counter-trend entries.' },
    { id: 'p1-structure', name: 'Market Structure', description: 'Requires BOS/CHOCH confirmation.', expected: 'Only take structural setups.' },
  ],
  phase2: [
    { id: 'p2-ob', name: 'Order Block Tap', description: 'Price taps valid order block.', expected: 'Improves entry location.' },
    { id: 'p2-liq', name: 'Liquidity Sweep', description: 'Detects sweep before continuation.', expected: 'Reduces false starts.' },
  ],
  phase3: [
    { id: 'p3-volume', name: 'Volume Spike', description: 'Requires >=1.8x relative volume.', expected: 'Confirms participation.' },
    { id: 'p3-rsi', name: 'Momentum Filter', description: 'Checks momentum regime.', expected: 'Avoids weak breakouts.' },
  ],
  phase4: [
    { id: 'p4-rr', name: 'R:R Gate', description: 'Minimum risk/reward threshold.', expected: 'Prevents low expectancy trades.' },
    { id: 'p4-session', name: 'Session Filter', description: 'Trade only strong sessions.', expected: 'Cuts low-volatility entries.' },
  ],
};

function RuleCard({ rule, index }) {
  return (
    <Draggable draggableId={rule.id} index={index}>
      {(provided) => (
        <div className="card !p-3 mb-2 cursor-grab" ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
          <div className="font-medium text-sm">{rule.name}</div>
          <div className="text-xs text-zinc-400">{rule.description}</div>
          <div className="text-xs text-emerald-300 mt-1">Expected: {rule.expected}</div>
        </div>
      )}
    </Draggable>
  );
}

export default function Backtesting() {
  const [models, setModels] = useState([]);
  const [form, setForm] = useState({ model_id: '', pair: 'BTCUSDT', timeframe: '1h', start_date: '', end_date: '', capital: 10000, slippage_bps: 0, commission_pct: 0 });
  const [showBuilder, setShowBuilder] = useState(false);
  const [zones, setZones] = useState(initialZones);
  const [qualityScore, setQualityScore] = useState(70);
  const [runId, setRunId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [sortBy, setSortBy] = useState('entry_time');

  useEffect(() => {
    getModels().then((nextModels) => {
      setModels(nextModels);
      if (nextModels.length && !form.model_id) {
        setForm((prev) => ({ ...prev, model_id: nextModels[0].id }));
      }
    }).catch(() => setModels([]));
  }, []);

  const onDragEnd = (event) => {
    if (!event.destination) return;
    const sourceId = event.source.droppableId;
    const destinationId = event.destination.droppableId;
    const sourceItems = Array.from(sourceId.startsWith('library-') ? ruleLibrary[sourceId.replace('library-', '')] : zones[sourceId] || []);
    const [moved] = sourceItems.splice(event.source.index, 1);
    if (!moved) return;
    const destinationItems = Array.from(zones[destinationId] || []);
    if (!destinationItems.find((r) => r.id === moved.id)) destinationItems.splice(event.destination.index, 0, moved);
    setZones((prev) => ({ ...prev, [destinationId]: destinationItems }));
  };

  const runBacktest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        ...form,
        model_id: Number(form.model_id),
        capital: Number(form.capital),
        slippage_bps: Number(form.slippage_bps),
        commission_pct: Number(form.commission_pct),
      };
      const run = await runBacktestApi(payload);
      const nextRunId = run?.run_id;
      setRunId(nextRunId);
      const poll = await getBacktestRun(nextRunId);
      setResult(poll || null);
    } finally {
      setLoading(false);
    }
  };

  const sortedTrades = useMemo(() => {
    const trades = [...(result?.trades || [])];
    return trades.sort((a, b) => {
      if (sortBy === 'pnl') return (b.pnl || 0) - (a.pnl || 0);
      if (sortBy === 'pnl_percent') return (b.pnl_percent || 0) - (a.pnl_percent || 0);
      return String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''));
    });
  }, [result, sortBy]);

  const saveStrategy = async () => {
    const rules = Object.values(zones).flat().map((rule) => rule.id);
    await createModel({
      name: `Custom Strategy ${new Date().toISOString().slice(0, 10)}`,
      section: 'perps',
      rules,
      min_quality_score: qualityScore,
      active: false,
    });
    setShowBuilder(false);
  };

  return (
    <TierGuard tier="pro">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Backtesting</h1>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-1 space-y-4">
            <div className="card space-y-3">
              <h2 className="font-semibold">Backtest Form</h2>
              <select className="input" value={form.model_id} onChange={(e) => setForm((p) => ({ ...p, model_id: e.target.value }))}>
                {models.map((model) => <option key={model.id} value={model.id}>{model.name || `Model ${model.id}`}</option>)}
              </select>
              <button className="btn bg-zinc-700 hover:bg-zinc-600" onClick={() => setShowBuilder((v) => !v)}>Build Strategy</button>
              <input className="input" placeholder="Pair (BTCUSDT)" value={form.pair} onChange={(e) => setForm((p) => ({ ...p, pair: e.target.value }))} />
              <select className="input" value={form.timeframe} onChange={(e) => setForm((p) => ({ ...p, timeframe: e.target.value }))}>
                {timeframeOptions.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="input" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
                <input type="date" className="input" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
              </div>
              <input className="input" type="number" min="100" value={form.capital} onChange={(e) => setForm((p) => ({ ...p, capital: e.target.value }))} />
              <input className="input" type="number" min="0" value={form.slippage_bps} onChange={(e) => setForm((p) => ({ ...p, slippage_bps: e.target.value }))} placeholder="Slippage bps" />
              <input className="input" type="number" min="0" step="0.01" value={form.commission_pct} onChange={(e) => setForm((p) => ({ ...p, commission_pct: e.target.value }))} placeholder="Commission %" />
              <button className="btn bg-violet-500 hover:bg-violet-600" onClick={runBacktest}>Run Backtest</button>
            </div>

            {showBuilder && (
              <div className="card space-y-4">
                <h2 className="font-semibold">Strategy Builder</h2>
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="grid grid-cols-1 gap-3">
                    {Object.keys(ruleLibrary).map((phase) => (
                      <Droppable droppableId={`library-${phase}`} key={`library-${phase}`} isDropDisabled>
                        {(provided) => (
                          <div className="p-2 rounded-lg border border-zinc-700" ref={provided.innerRef} {...provided.droppableProps}>
                            <h3 className="text-sm font-medium mb-2">Library {phase.toUpperCase()}</h3>
                            {ruleLibrary[phase].map((rule, index) => <RuleCard key={rule.id} rule={rule} index={index} />)}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    ))}

                    {['phase1', 'phase2', 'phase3', 'phase4'].map((phase) => (
                      <Droppable droppableId={phase} key={phase}>
                        {(provided) => (
                          <div className="p-2 rounded-lg border border-dashed border-violet-500/60 min-h-16" ref={provided.innerRef} {...provided.droppableProps}>
                            <h4 className="text-sm text-violet-300 mb-2">Drop Zone {phase.toUpperCase()}</h4>
                            {(zones[phase] || []).map((rule, index) => <RuleCard key={`${phase}-${rule.id}`} rule={rule} index={index} />)}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    ))}
                  </div>
                </DragDropContext>
                <label className="text-sm block">min_quality_score: {qualityScore}</label>
                <input type="range" min="1" max="100" value={qualityScore} onChange={(e) => setQualityScore(Number(e.target.value))} className="w-full" />
                <div className="flex gap-2">
                  <button className="btn bg-emerald-600 hover:bg-emerald-700" onClick={runBacktest}>Test This Strategy</button>
                  <button className="btn bg-blue-600 hover:bg-blue-700" onClick={saveStrategy}>Save as Model</button>
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-2 card space-y-4">
            <h2 className="font-semibold">Backtest Results</h2>
            {loading && <div className="text-amber-300">⏳ Running... <span className="animate-pulse">●●●</span></div>}
            {!loading && !result && <div className="text-zinc-400">Run a backtest to view results.</div>}
            {!!result && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    ['Total Trades', result.total_trades],
                    ['Win Rate', `${result.win_rate}%`],
                    ['Total PnL', result.total_pnl],
                    ['Max Drawdown', `${result.max_drawdown}%`],
                    ['Avg R:R', result.avg_rr],
                    ['Profit Factor', result.profit_factor],
                  ].map(([k, v]) => <div className="card !p-3" key={k}><div className="text-xs text-zinc-400">{k}</div><div className="text-lg font-semibold">{v}</div></div>)}
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.equity_curve || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis dataKey="trade" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="equity" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={result.drawdown_curve || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis dataKey="trade" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="drawdown" stroke="#f43f5e" fill="#f43f5e55" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[result.phase_breakdown || {}]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis dataKey="name" hide />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="died_p1" name="Died P1" fill="#ef4444" />
                      <Bar dataKey="died_p2" name="Died P2" fill="#f97316" />
                      <Bar dataKey="died_p3" name="Died P3" fill="#eab308" />
                      <Bar dataKey="completed_p4" name="Completed P4" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-zinc-400">Sort by:</label>
                    <select className="input max-w-40" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      <option value="entry_time">Entry Time</option>
                      <option value="pnl">PnL</option>
                      <option value="pnl_percent">PnL%</option>
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-zinc-400 border-b border-zinc-700">
                        <tr>{['entry_time', 'exit_time', 'pair', 'direction', 'entry_price', 'exit_price', 'pnl', 'pnl_percent', 'reason'].map((h) => <th key={h} className="text-left py-2 pr-2">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {sortedTrades.map((trade) => (
                          <tr key={trade.id} className="border-b border-zinc-800">
                            <td className="py-2 pr-2">{trade.entry_time}</td><td>{trade.exit_time}</td><td>{trade.pair}</td><td>{trade.direction}</td><td>{trade.entry_price}</td><td>{trade.exit_price}</td><td>{trade.pnl}</td><td>{trade.pnl_percent}%</td><td>{trade.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
            {!!runId && <div className="text-xs text-zinc-500">Run #{runId}</div>}
          </div>
        </div>
      </div>
    </TierGuard>
  );
}
