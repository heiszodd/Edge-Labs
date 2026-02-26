import { useState } from 'react';

const tabs = ['Scanner', 'Models', 'Trades', 'Demo', 'Watchlist'];

export default function Predictions() {
  const [tab, setTab] = useState('Scanner');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Predictions</h1>
      <div className="flex gap-2">{tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? 'bg-violet-500' : 'bg-zinc-800'}`}>{t}</button>)}</div>
      {tab === 'Scanner' ? <div className="card">MarketScanner with filters and buy yes/no actions.</div> : <div className="card">{tab} content</div>}
    </div>
  );
}
