import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buyYesNo, demoTrade, depositDemo, getDemo, getScanner, getWallet, resetDemo, withdrawDemo } from '../api/predictions';
import { PageWrapper } from '../components/common/PageWrapper';

function MarketCard({ market, onBuyYes, onBuyNo, onDemo }) {
  return (
    <div className="card card-hover">
      {Number(market.days_left) <= 3 && (
        <div className="badge badge-danger mb-3 animate-pulse-soft">🔥 Closes in {Number(market.days_left) === 0 ? 'today' : `${market.days_left}d`}</div>
      )}
      <p className="font-semibold text-sm mb-4 leading-relaxed">{market.question}</p>
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-emerald-400 font-bold">YES {market.yes_pct}%</span>
          <span className="text-rose-400 font-bold">NO {market.no_pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
          <div style={{ width: `${market.yes_pct}%` }} className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        <div className="text-center"><p className="font-bold">${(Number(market.volume_usd || 0) / 1000).toFixed(0)}K</p><p className="text-[var(--text-muted)]">Volume</p></div>
        <div className="text-center"><p className={`font-bold grade-${market.grade}`}>{market.grade}</p><p className="text-[var(--text-muted)]">Grade</p></div>
        <div className="text-center"><p className="font-bold">{market.days_left ?? '?'}</p><p className="text-[var(--text-muted)]">Days left</p></div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onBuyYes(market)} className="btn-success btn-sm flex-1">YES ↑</button>
        <button onClick={() => onBuyNo(market)} className="btn-danger btn-sm flex-1">NO ↓</button>
        <button onClick={() => onDemo(market)} className="btn-secondary btn-sm">Demo</button>
      </div>
    </div>
  );
}

export default function Predictions() {
  const [size, setSize] = useState(25);
  const [amount, setAmount] = useState(100);
  const [confirm, setConfirm] = useState(null);
  const qc = useQueryClient();

  const scannerQ = useQuery({
    queryKey: ['predictions', 'scanner'],
    queryFn: () => getScanner({ limit: 10 }),
    staleTime: 30_000,
  });
  const walletQ = useQuery({ queryKey: ['predictions', 'wallet'], queryFn: getWallet, staleTime: 20_000 });
  const demoQ = useQuery({ queryKey: ['predictions', 'demo'], queryFn: getDemo, staleTime: 30_000 });

  const buyM = useMutation({ mutationFn: ({ m, s, side }) => buyYesNo(m, s, side, 'live', true) });
  const demoM = useMutation({
    mutationFn: ({ m, s, side }) => demoTrade(m, s, side),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }),
  });
  const depM = useMutation({ mutationFn: depositDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }) });
  const withdrawM = useMutation({ mutationFn: withdrawDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }) });
  const resetM = useMutation({ mutationFn: resetDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }) });

  return (
    <PageWrapper className="space-y-4">
      <h1 className="text-2xl font-semibold">Predictions</h1>
      <div className="card space-y-2">
        <h2 className="font-semibold">Polygon Wallet</h2>
        <p className="text-sm text-[var(--text-muted)]">MATIC: {walletQ.data?.matic_balance ?? 0} | USDC: {walletQ.data?.usdc_balance ?? 0}</p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {(scannerQ.data?.markets || []).map((market, i) => (
          <div key={market.id || i} style={{ animation: 'slideUp 0.4s ease both', animationDelay: `${i * 60}ms` }}>
            <MarketCard
              market={market}
              onBuyYes={(m) => setConfirm({ market: m, side: 'yes', mode: 'live' })}
              onBuyNo={(m) => setConfirm({ market: m, side: 'no', mode: 'live' })}
              onDemo={(m) => setConfirm({ market: m, side: 'yes', mode: 'demo' })}
            />
          </div>
        ))}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Demo Wallet</h2>
        <p className="text-sm text-[var(--text-muted)]">Balance: {demoQ.data?.balance ?? 0}</p>
        <div className="flex gap-2">
          <input className="input max-w-40" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value || 0))} />
          <button className="btn-success" onClick={() => depM.mutate(amount)} disabled={depM.isPending}>Deposit</button>
          <button className="btn-secondary" onClick={() => withdrawM.mutate(amount)} disabled={withdrawM.isPending}>Withdraw</button>
          <button className="btn-danger" onClick={() => resetM.mutate()} disabled={resetM.isPending}>Reset</button>
        </div>
      </div>

      {confirm && (
        <div className="modal-overlay">
          <div className="modal space-y-3">
            <h3 className="font-semibold">Confirm {confirm.mode === 'live' ? 'Live' : 'Demo'} Order</h3>
            <p className="text-sm text-[var(--text-muted)]">{confirm.market.question} | {confirm.side.toUpperCase()} | ${size}</p>
            <input className="input max-w-32" type="number" value={size} onChange={(e) => setSize(Number(e.target.value || 0))} />
            <div className="flex gap-2">
              <button
                className="btn-primary"
                onClick={async () => {
                  if (confirm.mode === 'live') {
                    await buyM.mutateAsync({ m: confirm.market.id, s: size, side: confirm.side });
                  } else {
                    await demoM.mutateAsync({ m: confirm.market.id, s: size, side: confirm.side });
                  }
                  setConfirm(null);
                }}
              >
                Confirm
              </button>
              <button className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <a href={confirm.market.market_url} target="_blank" rel="noreferrer" className="btn-secondary">Polymarket ↗</a>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
