import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { PageWrapper } from '../components/common/PageWrapper';

function CountUp({ end = 0, duration = 800, prefix = '', suffix = '', decimals = 2, className = '' }) {
  const [value, setValue] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (end == null) return;
    let startTime = null;
    const startVal = 0;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(startVal + (end - startVal) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [end, duration]);

  return (
    <span className={className}>
      {prefix}
      {Number(value || 0).toFixed(decimals)}
      {suffix}
    </span>
  );
}

function ROIPill({ value = 0 }) {
  const positive = Number(value) >= 0;
  return <span className={`badge ${positive ? 'badge-success' : 'badge-danger'}`}>{positive ? '▲' : '▼'} {Math.abs(Number(value || 0)).toFixed(1)}%</span>;
}

function SectionCard({ title, href, data = {}, icon, delay = 0 }) {
  const isPositive = Number(data.total_pnl || 0) >= 0;
  return (
    <Link to={href} style={{ animation: 'slideUp 0.45s ease both', animationDelay: `${delay}ms` }} className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-[var(--text-muted)]">{icon} {title}</p>
          <p className="text-xs text-[var(--text-muted)]">{data.open_positions || 0} open positions</p>
        </div>
        <ROIPill value={data.roi_pct || 0} />
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-1">Balance</p>
      <CountUp end={Number(data.demo_balance || 0)} prefix="$" className="text-2xl font-semibold" />
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Total PnL</p>
          <p className={`text-lg font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? '+' : ''}
            {Number(data.total_pnl || 0).toFixed(2)}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-[var(--text-muted)]">Win</p>
          <p className="font-semibold">{Number(data.win_rate || 0).toFixed(1)}%</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-3 gap-2 text-center">
        <div><p className="font-semibold">{data.total_trades || 0}</p><p className="text-xs text-[var(--text-muted)]">Trades</p></div>
        <div><p className="font-semibold">{data.open_positions || 0}</p><p className="text-xs text-[var(--text-muted)]">Open</p></div>
        <div><p className={`font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{Number(data.win_rate || 0).toFixed(1)}%</p><p className="text-xs text-[var(--text-muted)]">Win</p></div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const overviewQ = useQuery({
    queryKey: ['overview'],
    queryFn: () => client.get('/api/overview').then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const data = overviewQ.data || {};
  const totalPnl = Number(data.total_pnl || 0);
  const positive = totalPnl >= 0;

  return (
    <PageWrapper className="space-y-5">
      <section className={`card ${positive ? 'shadow-[0_0_24px_rgba(16,185,129,0.2)]' : 'shadow-[0_0_24px_rgba(244,63,94,0.2)]'}`}>
        <p className="text-sm text-[var(--text-muted)]">Total Portfolio PnL</p>
        <CountUp end={totalPnl} prefix={positive ? '+$' : '-$'} decimals={2} className={`text-4xl font-bold ${positive ? 'text-emerald-400' : 'text-rose-400'}`} />
      </section>

      <section className="grid-section gap-4">
        <SectionCard title="Perps" href="/perps" data={data.perps || {}} icon="📈" delay={0} />
        <SectionCard title="Degen" href="/degen" data={data.degen || {}} icon="🔥" delay={80} />
        <SectionCard title="Predictions" href="/predictions" data={data.predictions || {}} icon="🎯" delay={160} />
      </section>

      {Number(data?.signals?.pending_count || 0) > 0 && (
        <section className="card bg-signal-500/10 border-signal-500/30">
          <p className="font-medium">Pending signals: {data.signals.pending_count}</p>
          <p className="text-sm text-[var(--text-muted)]">Phase 4 ready: {data.signals.phase4_count}</p>
        </section>
      )}

      <section className="card">
        <h3 className="font-semibold mb-2">Recent Signals</h3>
        <div className="space-y-2">
          {(data?.signals?.recent || []).slice(0, 5).map((signal, i) => (
            <div key={signal.id || i} style={{ animation: 'slideUp 0.35s ease both', animationDelay: `${i * 60}ms` }} className="flex items-center justify-between text-sm border-b border-[var(--border)] pb-2">
              <div>
                <p className="font-medium">{signal.section || 'section'} {signal.pair || ''}</p>
                <p className="text-xs text-[var(--text-muted)]">Phase {signal.phase} {signal.direction || ''}</p>
              </div>
              <span className="badge badge-info">{Number(signal.quality_score || 0).toFixed(1)}</span>
            </div>
          ))}
          {!(data?.signals?.recent || []).length && <p className="text-sm text-[var(--text-muted)]">No recent signals.</p>}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Link to="/perps" className="btn-primary">Run Scanners</Link>
        <Link to="/profile" className="btn-secondary">View Positions</Link>
      </section>
    </PageWrapper>
  );
}
