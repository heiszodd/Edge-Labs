import { useState } from 'react';

const plans = ['Free', 'Pro', 'Premium'];
const featureRows = [
  { key: 'Live trading', free: 'No', pro: 'Yes', premium: 'Yes' },
  { key: 'AI analysis', free: 'No', pro: 'No', premium: 'Yes' },
  { key: 'Max wallets', free: '1', pro: '5', premium: 'Unlimited' },
];

export default function Subscription() {
  const [yearly, setYearly] = useState(false);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Subscription</h1>
      <button className="btn-secondary" onClick={() => setYearly((v) => !v)}>{yearly ? 'Yearly' : 'Monthly'}</button>
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div key={p} className="card">
            <h3 className="text-lg">{p}</h3>
            <button className="btn-primary mt-3">{p === 'Free' ? 'Get Started' : 'Upgrade'}</button>
          </div>
        ))}
      </div>
      <div className="card hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2">Feature</th>
              <th className="text-left">Free</th>
              <th className="text-left">Pro</th>
              <th className="text-left">Premium</th>
            </tr>
          </thead>
          <tbody>
            {featureRows.map((r) => (
              <tr key={r.key}>
                <td className="py-2">{r.key}</td>
                <td>{r.free}</td>
                <td>{r.pro}</td>
                <td>{r.premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 md:hidden">
        {featureRows.map((r) => (
          <div key={r.key} className="card !p-3 text-sm">
            <p className="font-medium">{r.key}</p>
            <p className="text-[var(--text-muted)]">Free: {r.free}</p>
            <p className="text-[var(--text-muted)]">Pro: {r.pro}</p>
            <p className="text-[var(--text-muted)]">Premium: {r.premium}</p>
          </div>
        ))}
      </div>
      <div className="card">
        Current Plan: Free · Status Active · <button className="btn-secondary">Manage Billing</button>
      </div>
    </div>
  );
}
