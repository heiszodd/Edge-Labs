import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { generateAiInsights, getAiInsights, getPerformance, getTradeHistory } from '../api/analytics';
import { createEntry, deleteEntry, listEntries, updateEntry } from '../api/journal';
import TierGuard from '../components/common/TierGuard';

const tabs = ['Performance', 'AI Insights', 'Journal'];

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('Performance');
  const [section, setSection] = useState('all');
  const [period, setPeriod] = useState('30d');
  const [performance, setPerformance] = useState({});
  const [historyRows, setHistoryRows] = useState([]);
  const [historySection, setHistorySection] = useState('all');
  const [insightLoading, setInsightLoading] = useState(false);
  const [insight, setInsight] = useState(null);
  const [missed, setMissed] = useState([]);
  const [entries, setEntries] = useState([]);
  const [editing, setEditing] = useState(null);

  const loadPerformance = () => {
    getPerformance(section, period)
      .then((res) => setPerformance(res || {}))
      .catch(() => setPerformance({}));
    getTradeHistory()
      .then((data) => {
        const combined = ['perps', 'degen', 'predictions'].flatMap((key) => (data[key] || []).map((row) => ({ ...row, section: key })));
        setHistoryRows(combined);
      }).catch(() => setHistoryRows([]));
  };

  const loadJournal = () => listEntries().then((res) => setEntries(res || [])).catch(() => setEntries([]));

  useEffect(() => {
    loadPerformance();
  }, [section, period]);

  useEffect(() => {
    if (activeTab === 'Journal') loadJournal();
  }, [activeTab]);

  const filteredHistory = useMemo(() => {
    if (historySection === 'all') return historyRows;
    return historyRows.filter((row) => row.section === historySection);
  }, [historyRows, historySection]);

  const generateInsights = async () => {
    setInsightLoading(true);
    try {
      await generateAiInsights({ period: 'weekly', section });
      const res = await getAiInsights();
      setInsight(res || null);
      setMissed((res?.missed_setups || []));
    } finally {
      setInsightLoading(false);
    }
  };

  const saveEntry = async () => {
    const payload = { title: editing.title, body: editing.body, section: editing.section, trade_id: editing.trade_id || null };
    if (editing.id) await updateEntry(editing.id, payload);
    else await createEntry(payload);
    setEditing(null);
    loadJournal();
  };

  const removeEntry = async () => {
    if (!editing?.id) return;
    await deleteEntry(editing.id);
    setEditing(null);
    loadJournal();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <div className="flex gap-2">
        {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`btn ${activeTab === tab ? 'bg-violet-500' : 'bg-zinc-800 hover:bg-zinc-700'}`}>{tab}</button>)}
      </div>

      {activeTab === 'Performance' && (
        <div className="space-y-4">
          <div className="card grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-zinc-400 mb-1">Section</div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'perps', 'degen', 'predictions'].map((s) => <button key={s} className={`btn ${section === s ? 'bg-violet-500' : 'bg-zinc-700'}`} onClick={() => setSection(s)}>{s}</button>)}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-1">Period</div>
              <div className="flex gap-2 flex-wrap">
                {['7d', '30d', '90d', 'all'].map((p) => <button key={p} className={`btn ${period === p ? 'bg-violet-500' : 'bg-zinc-700'}`} onClick={() => setPeriod(p)}>{p}</button>)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              ['Total Trades', performance.total_trades],
              ['Win Rate', `${performance.win_rate || 0}%`],
              ['Total PnL', performance.total_pnl],
              ['Best Trade', performance.best_trade || '-'],
              ['Worst Trade', performance.worst_trade || '-'],
              ['Avg R:R', performance.avg_rr],
            ].map(([k, v]) => <div className="card !p-3" key={k}><div className="text-xs text-zinc-400">{k}</div><div className="text-lg font-semibold">{v}</div></div>)}
          </div>
          <div className="card h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performance.winrate_series || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis dataKey="idx" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="win_rate" stroke="#22c55e" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card space-y-2">
            <div className="flex gap-2 items-center">
              <span className="text-sm text-zinc-400">Filter section:</span>
              <select className="input max-w-44" value={historySection} onChange={(e) => setHistorySection(e.target.value)}>
                <option value="all">all</option><option value="perps">perps</option><option value="degen">degen</option><option value="predictions">predictions</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-zinc-400 border-b border-zinc-700"><tr>{['date', 'section', 'pair', 'direction', 'entry', 'exit', 'pnl', 'pnl%', 'grade'].map((h) => <th key={h} className="text-left py-2 pr-2">{h}</th>)}</tr></thead>
                <tbody>
                  {filteredHistory.map((row, idx) => (
                    <tr key={row.id || idx} className="border-b border-zinc-800">
                      <td className="py-2 pr-2">{row.closed_at || row.timestamp || '-'}</td><td>{row.section}</td><td>{row.pair || row.market || row.token_symbol || '-'}</td><td>{row.side || row.direction || '-'}</td><td>{row.entry_price || row.entry || '-'}</td><td>{row.exit_price || row.exit || '-'}</td><td>{row.pnl || '-'}</td><td>{row.pnl_percent || '-'}</td><td>{row.grade || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'AI Insights' && (
        <TierGuard tier="premium">
          <div className="space-y-4">
            <button className="btn bg-violet-500 hover:bg-violet-600" onClick={generateInsights}>Generate Insights</button>
            {insightLoading && <div className="text-amber-300">Generating insights...</div>}
            {insight && (
              <div className="card space-y-3">
                <p>{insight.summary || 'No summary generated yet.'}</p>
                <div className="flex gap-2 flex-wrap text-sm">
                  <span className="px-2 py-1 rounded bg-zinc-800">🏆 Best hour: {insight.best_hour || '-'}</span>
                  <span className="px-2 py-1 rounded bg-zinc-800">📉 Weakest pair: {insight.weakest_pair || '-'}</span>
                  <span className="px-2 py-1 rounded bg-zinc-800">✅ Best grade: {insight.best_grade || '-'}</span>
                </div>
                <ul className="list-disc ml-6 text-sm space-y-1">
                  {(insight.suggestions || []).map((item, idx) => <li key={idx}>{item}</li>)}
                </ul>
              </div>
            )}
            <div className="card">
              <h3 className="font-medium mb-2">Missed setups</h3>
              <div className="space-y-2 text-sm">
                {missed.map((row, idx) => <div key={idx} className="flex justify-between border-b border-zinc-800 pb-1"><span>{row.pair} {row.direction}</span><span>Missed PnL: {row.missed_pnl_percent}%</span></div>)}
              </div>
            </div>
          </div>
        </TierGuard>
      )}

      {activeTab === 'Journal' && (
        <div className="space-y-3">
          <button className="btn bg-violet-500 hover:bg-violet-600" onClick={() => setEditing({ title: '', body: '', section: 'perps', trade_id: '' })}>+ New Entry</button>
          <div className="card space-y-2">
            {entries.map((entry) => <button key={entry.id} onClick={() => setEditing(entry)} className="w-full text-left p-2 rounded hover:bg-zinc-800"><div className="font-medium">{entry.title}</div><div className="text-xs text-zinc-400">{entry.created_at}</div></button>)}
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-20">
          <div className="card w-full max-w-2xl space-y-3">
            <h3 className="font-semibold">Journal Entry</h3>
            <input className="input" placeholder="Title" value={editing.title || ''} onChange={(e) => setEditing((p) => ({ ...p, title: e.target.value }))} />
            <textarea className="input min-h-40" placeholder="Body markdown" value={editing.body || ''} onChange={(e) => setEditing((p) => ({ ...p, body: e.target.value }))} />
            <select className="input" value={editing.section || 'perps'} onChange={(e) => setEditing((p) => ({ ...p, section: e.target.value }))}>
              <option value="perps">Perps</option><option value="degen">Degen</option><option value="predictions">Predictions</option>
            </select>
            <input className="input" placeholder="Link to Trade (optional)" value={editing.trade_id || ''} onChange={(e) => setEditing((p) => ({ ...p, trade_id: e.target.value }))} />
            <div className="flex gap-2 justify-end">
              <button className="btn bg-zinc-700" onClick={() => setEditing((p) => ({ ...p, body: `${p.body || ''}\n\n### AI Summary\n- ${((p.body || '').slice(0, 140) || 'No content')}...` }))}>AI Summarize</button>
              <button className="btn bg-emerald-600" onClick={saveEntry}>Save</button>
              <button className="btn bg-red-600" onClick={removeEntry}>Delete</button>
              <button className="btn bg-zinc-700" onClick={() => setEditing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
