import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import StatCard from '../components/common/StatCard';
import { getPending } from '../api/signals';
import { getWalletStatus } from '../api/wallets';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const tier = useAuthStore((s) => s.tier);
  const { data: signals = [], isLoading: signalsLoading } = useQuery({
    queryKey: ['signals', 'pending'],
    queryFn: getPending,
    staleTime: 30_000,
  });
  const { data: wallets = {}, isLoading: walletLoading } = useQuery({
    queryKey: ['wallets', 'status'],
    queryFn: getWalletStatus,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-8">
      <section className="card-glass">
        <div className="text-sm text-[var(--text-muted)]">Welcome back</div>
        <h1 className="text-3xl font-semibold">{user?.username || user?.email || 'Trader'}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Tier: <span className="badge-signal">{tier}</span></p>
      </section>

      <section className="grid md:grid-cols-4 gap-4">
        <StatCard label="Pending Signals" value={signals.length} icon="⚡" loading={signalsLoading} />
        <StatCard label="Perps Wallet" value={wallets?.perps?.connected ? 'Connected' : 'Not connected'} icon="📈" loading={walletLoading} />
        <StatCard label="Degen Wallet" value={wallets?.degen?.connected ? 'Connected' : 'Not connected'} icon="🔥" loading={walletLoading} />
        <StatCard label="Prediction Wallet" value={wallets?.predictions?.connected ? 'Connected' : 'Not connected'} icon="🎯" loading={walletLoading} />
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Link to="/perps" className="card">Go to Perps</Link>
        <Link to="/degen" className="card">Go to Degen</Link>
        <Link to="/predictions" className="card">Go to Predictions</Link>
      </section>
    </div>
  );
}

