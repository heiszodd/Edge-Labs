import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buyYesNo, demoTrade, depositDemo, getDemo, getScanner, getTrades, getWallet, resetDemo, withdrawDemo } from '../api/predictions';
import { PageWrapper } from '../components/common/PageWrapper';

function MarketCard({ market, onBuyYes, onBuyNo, onDemo }) {
  const canLiveTrade = Boolean(market.id || market.condition_id);
  return (
    <div className="card card-hover">
      {Number(market.days_left) <= 3 && (
        <div className="badge badge-danger mb-3 animate-pulse-soft">Closes in {Number(market.days_left) === 0 ? 'today' : `${market.days_left}d`}</div>
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
        <button onClick={() => onBuyYes(market)} className="btn-success btn-sm flex-1" disabled={!canLiveTrade}>YES</button>
        <button onClick={() => onBuyNo(market)} className="btn-danger btn-sm flex-1" disabled={!canLiveTrade}>NO</button>
        <button onClick={() => onDemo(market)} className="btn-secondary btn-sm">Demo</button>
      </div>
      {!canLiveTrade && <p className="text-xs text-[var(--text-muted)] mt-2">Live disabled for this market snapshot.</p>}
    </div>
  );
}

export default function Predictions() {
  const [size, setSize] = useState(25);
  const [amount, setAmount] = useState(100);
  const [confirm, setConfirm] = useState(null);
  const [actionError, setActionError] = useState('');
  const qc = useQueryClient();

  const scannerQ = useQuery({ queryKey: ['predictions', 'scanner'], queryFn: () => getScanner({ limit: 12 }), staleTime: 20_000, refetchInterval: 30_000 });
  const walletQ = useQuery({ queryKey: ['predictions', 'wallet'], queryFn: getWallet, staleTime: 20_000 });
  const demoQ = useQuery({ queryKey: ['predictions', 'demo'], queryFn: getDemo, staleTime: 15_000, refetchInterval: 20_000 });
  const tradesQ = useQuery({ queryKey: ['predictions', 'trades'], queryFn: getTrades, staleTime: 10_000, refetchInterval: 15_000 });

  const buyM = useMutation({
    mutationFn: ({ m, s, side, entry, q }) => buyYesNo(m, s, side, 'live', true, entry, q),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['predictions', 'trades'] });
      await qc.invalidateQueries({ queryKey: ['predictions', 'wallet'] });
    },
  });
  const demoM = useMutation({
    mutationFn: ({ m, s, side, entry, q }) => demoTrade(m, s, side, entry, q),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['predictions', 'demo'] });
      await qc.invalidateQueries({ queryKey: ['predictions', 'trades'] });
    },
  });
  const depM = useMutation({ mutationFn: depositDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }) });
  const withdrawM = useMutation({ mutationFn: withdrawDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }) });
  const resetM = useMutation({ mutationFn: resetDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }) });

  const openTrades = useMemo(() => {
    const live = tradesQ.data?.open_trades?.live || [];
    const demo = tradesQ.data?.open_trades?.demo || [];
    return [...live, ...demo];
  }, [tradesQ.data]);
  const closedTrades = useMemo(() => {
    const live = tradesQ.data?.closed_trades?.live || [];
    const demo = tradesQ.data?.closed_trades?.demo || [];
    return [...live.map((x) => ({ ...x, mode: 'live' })), ...demo.map((x) => ({ ...x, mode: 'demo' }))];
  }, [tradesQ.data]);
  const hasLiveFunding = Boolean(walletQ.data?.connected) && Number(walletQ.data?.matic_balance || 0) > 0.001;

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
              onBuyYes={(m) => {
                setActionError('');
                if (!hasLiveFunding) {
                  setActionError('Live wallet is not funded. Add MATIC for gas before live trading.');
                  return;
                }
                setConfirm({ market: m, side: 'yes', mode: 'live' });
              }}
              onBuyNo={(m) => {
                setActionError('');
                if (!hasLiveFunding) {
                  setActionError('Live wallet is not funded. Add MATIC for gas before live trading.');
                  return;
                }
                setConfirm({ market: m, side: 'no', mode: 'live' });
              }}
              onDemo={(m) => {
                setActionError('');
                setConfirm({ market: m, side: 'yes', mode: 'demo' });
              }}
            />
          </div>
        ))}
      </div>
      {actionError && <div className="badge badge-danger">{actionError}</div>}

      <div className="card space-y-3">
        <h2 className="font-semibold">Open Trades</h2>
        {openTrades.length === 0 && <p className="text-sm text-[var(--text-muted)]">No open prediction trades.</p>}
        {openTrades.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[var(--text-muted)]">
                <tr>
                  <th className="text-left py-2">Mode</th>
                  <th className="text-left py-2">Market</th>
                  <th className="text-left py-2">Side</th>
                  <th className="text-left py-2">Entry</th>
                  <th className="text-left py-2">Mark</th>
                  <th className="text-left py-2">uPnL</th>
                  <th className="text-left py-2">uPnL %</th>
                </tr>
              </thead>
              <tbody>
                {openTrades.map((row) => (
                  <tr key={`${row.mode}-${row.id || row.market_id}-${row.timestamp || ''}`} className="border-t border-[var(--line)]">
                    <td className="py-2">{row.mode}</td>
                    <td className="py-2 max-w-[340px] truncate">{row.question || row.market_id}</td>
                    <td className="py-2 uppercase">{row.side}</td>
                    <td className="py-2">{Number(row.entry_price || 0).toFixed(4)}</td>
                    <td className="py-2">{Number(row.current_mark || 0).toFixed(4)}</td>
                    <td className={`py-2 ${Number(row.unrealized_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Number(row.unrealized_pnl || 0).toFixed(2)}</td>
                    <td className={`py-2 ${Number(row.pnl_pct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Number(row.pnl_pct || 0).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Resolved Trades</h2>
        {closedTrades.length === 0 && <p className="text-sm text-[var(--text-muted)]">No resolved trades yet.</p>}
        {closedTrades.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[var(--text-muted)]">
                <tr>
                  <th className="text-left py-2">Mode</th>
                  <th className="text-left py-2">Market</th>
                  <th className="text-left py-2">Side</th>
                  <th className="text-left py-2">P/L</th>
                  <th className="text-left py-2">Closed</th>
                </tr>
              </thead>
              <tbody>
                {closedTrades.map((row, idx) => (
                  <tr key={`${row.mode}-${row.id || idx}`} className="border-t border-[var(--line)]">
                    <td className="py-2">{row.mode}</td>
                    <td className="py-2 max-w-[380px] truncate">{row.question || row.market_id}</td>
                    <td className="py-2 uppercase">{row.position || row.side}</td>
                    <td className={`py-2 ${Number(row.resolution_pnl || row.pnl_usd || row.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Number(row.resolution_pnl || row.pnl_usd || row.pnl || 0).toFixed(2)}
                    </td>
                    <td className="py-2">{row.closed_at ? new Date(row.closed_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            {actionError && <div className="badge badge-danger">{actionError}</div>}
            <div className="flex gap-2">
              <button
                className="btn-primary"
                disabled={buyM.isPending || demoM.isPending}
                onClick={async () => {
                  try {
                    const marketId = confirm.market.id || confirm.market.condition_id;
                    const entry = confirm.side === 'yes' ? Number(confirm.market.yes_price || 0) : Number(confirm.market.no_price || 0);
                    if (confirm.mode === 'live') {
                      if (!hasLiveFunding) {
                        setActionError('Live wallet is not funded. Add MATIC and retry.');
                        return;
                      }
                      await buyM.mutateAsync({ m: marketId, s: size, side: confirm.side, entry, q: confirm.market.question });
                    } else {
                      await demoM.mutateAsync({ m: marketId, s: size, side: confirm.side, entry, q: confirm.market.question });
                    }
                    setConfirm(null);
                    setActionError('');
                  } catch (err) {
                    setActionError(err?.response?.data?.detail || 'Trade request failed');
                  }
                }}
              >
                {buyM.isPending || demoM.isPending ? 'Processing...' : 'Confirm'}
              </button>
              <button className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <a href={confirm.market.market_url} target="_blank" rel="noreferrer" className="btn-secondary">Polymarket</a>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
