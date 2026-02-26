import { useState } from 'react';

const plans = ['Free', 'Pro', 'Premium'];

export default function Subscription() {
  const [yearly, setYearly] = useState(false);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Subscription</h1>
      <button className="btn bg-zinc-800" onClick={() => setYearly((v) => !v)}>{yearly ? 'Yearly' : 'Monthly'}</button>
      <div className="grid md:grid-cols-3 gap-4">{plans.map((p) => <div key={p} className="card"><h3 className="text-lg">{p}</h3><button className="btn bg-violet-500 mt-3">{p === 'Free' ? 'Get Started' : 'Upgrade'}</button></div>)}</div>
      <div className="card overflow-x-auto"><table className="w-full text-sm"><tbody><tr><td>Live trading</td><td>❌</td><td>✅</td><td>✅</td></tr><tr><td>AI analysis</td><td>❌</td><td>❌</td><td>✅</td></tr><tr><td>Max wallets</td><td>1</td><td>5</td><td>∞</td></tr></tbody></table></div>
      <div className="card">Current Plan: Free · Status Active · <button className="btn bg-zinc-700">Manage Billing</button></div>
    </div>
  );
}
