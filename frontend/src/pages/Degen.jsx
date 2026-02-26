import { useState } from 'react';
import TierGuard from '../components/common/TierGuard';

const tabs = ['Overview', 'Scanner', 'Contract', 'Positions', 'Models', 'Tracking', 'Demo', 'Watchlist'];

export default function Degen() {
  const [tab, setTab] = useState('Overview');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Degen</h1>
      <div className="flex flex-wrap gap-2">{tabs.map((t) => <button key={t} className={`btn ${tab === t ? 'bg-violet-500' : 'bg-zinc-800'}`} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Scanner' && <TierGuard tier="pro"><div className="card">DegenScanner + TokenGrid + Run Scan Now</div></TierGuard>}
      {tab === 'Contract' && <div className="card space-y-2"><div className="flex gap-2"><input className="input" placeholder="Contract address" /><button className="btn bg-violet-500">Scan</button></div><div>SafetyReport: ✅ Honeypot check, ✅ LP lock, warnings, buy actions.</div></div>}
      {tab === 'Positions' && <div className="card">sol_positions table with sell/edit config.</div>}
      {tab === 'Tracking' && <div className="card">Wallet tracker with add wallet + copy settings.</div>}
      {tab !== 'Scanner' && tab !== 'Contract' && tab !== 'Positions' && tab !== 'Tracking' && <div className="card">{tab} content</div>}
    </div>
  );
}
