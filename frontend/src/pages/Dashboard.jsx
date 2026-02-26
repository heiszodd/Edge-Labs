import { Link } from 'react-router-dom';

const wallets = [
  { chain: 'HL', balance: '$12,430', connected: true },
  { chain: 'SOL', balance: '$2,100', connected: false },
  { chain: 'Poly', balance: '$780', connected: true },
];

export default function Dashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid md:grid-cols-3 gap-4">
        {wallets.map((w) => <div key={w.chain} className="card"><div className="text-zinc-400">{w.chain}</div><div className="text-xl">{w.balance}</div><div className={w.connected ? 'text-emerald-500' : 'text-red-500'}>{w.connected ? 'Connected' : 'Disconnected'}</div></div>)}
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">Today PnL: <span className="text-emerald-500">+$450</span></div>
        <Link to="/perps" className="card">Pending signals: <span className="bg-violet-500 rounded px-2 ml-2">3</span></Link>
        <div className="card">Active models: Perps 4 · Degen 3 · Predictions 2</div>
      </div>
      <div className="flex gap-2">
        <Link className="btn bg-zinc-800" to="/perps">📈 Go to Perps</Link>
        <Link className="btn bg-zinc-800" to="/degen">🔥 Go to Degen</Link>
        <Link className="btn bg-zinc-800" to="/predictions">🎯 Predictions</Link>
      </div>
    </div>
  );
}
