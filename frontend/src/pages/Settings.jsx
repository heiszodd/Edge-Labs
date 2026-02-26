import { useState } from 'react';

const tabs = ['Account', 'Telegram', 'Wallets', 'Alerts', 'Buy Presets', 'SL/TP', 'Security'];

function WalletCard({ chain, status, address }) {
  return (
    <div className="card">
      <div className="font-medium">{chain}</div>
      <div className="text-sm text-zinc-400">{status} · {address}</div>
      <div className="flex gap-2 mt-2">
        <button className="btn bg-violet-500">Connect</button>
        <button className="btn bg-red-500">Remove</button>
      </div>
    </div>
  );
}

export default function Settings() {
  const [tab, setTab] = useState(tabs[0]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="flex flex-wrap gap-2">{tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? 'bg-violet-500' : 'bg-zinc-800'}`}>{t}</button>)}</div>
      <div className="card">Active tab: {tab}</div>
      {tab === 'Wallets' && <div className="grid md:grid-cols-3 gap-4"><WalletCard chain="Hyperliquid" status="Connected" address="0x12...fa" /><WalletCard chain="Solana" status="Disconnected" address="-" /><WalletCard chain="Polygon" status="Connected" address="0x77...bc" /></div>}
    </div>
  );
}
