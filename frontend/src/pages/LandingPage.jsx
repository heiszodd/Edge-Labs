import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <p className="badge badge-signal mb-4">TradeIntel</p>
            <h1 className="text-5xl font-bold leading-tight mb-4">Precision Trading Intel, Built For Execution</h1>
            <p className="text-[var(--text-muted)] mb-8">Scan perps, degen tokens, and prediction markets with one workspace.</p>
            <div className="flex gap-3">
              <Link to="/register" className="btn-primary">Create Account</Link>
              <Link to="/login" className="btn-secondary">Log In</Link>
            </div>
          </div>
          <div className="card">
            <div className="grid grid-cols-2 gap-3">
              <div className="card !p-4"><p className="stat-label">Perps</p><p className="stat-value">Phase Scanner</p></div>
              <div className="card !p-4"><p className="stat-label">Degen</p><p className="stat-value">Rug Safety</p></div>
              <div className="card !p-4"><p className="stat-label">Predictions</p><p className="stat-value">Market Grading</p></div>
              <div className="card !p-4"><p className="stat-label">Alerts</p><p className="stat-value">Telegram OAuth</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
