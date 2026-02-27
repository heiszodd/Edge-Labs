import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buyYesNo, demoTrade, depositDemo, getDemo, getScanner, getWallet, resetDemo, withdrawDemo } from '../api/predictions';

export default function Predictions() {
  const [market, setMarket] = useState('');
  const [size, setSize] = useState(25);
  const [amount, setAmount] = useState(100);
  const [category, setCategory] = useState('all');
  const [offset, setOffset] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const qc = useQueryClient();
  const scannerQ = useQuery({
    queryKey: ['predictions', 'scanner', category, offset],
    queryFn: () => getScanner({ category, offset, limit: 50 }),
    staleTime: 30_000,
  });
  const walletQ = useQuery({ queryKey: ['predictions', 'wallet'], queryFn: getWallet, staleTime: 20_000 });
  const demoQ = useQuery({ queryKey: ['predictions', 'demo'], queryFn: getDemo, staleTime: 30_000 });

  const buyM = useMutation({ mutationFn: ({ m, s, side }) => buyYesNo(m, s, side, 'live', true) });
  const demoM = useMutation({
    mutationFn: ({ m, s, side }) => demoTrade(m, s, side),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }),
  });
  const depM = useMutation({
    mutationFn: depositDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }),
  });
  const withdrawM = useMutation({
    mutationFn: withdrawDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }),
  });
  const resetM = useMutation({
    mutationFn: resetDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Predictions</h1>
      <div className="card space-y-2">
        <h2 className="font-semibold">Polygon Wallet</h2>
        <p className="text-sm text-[var(--text-muted)]">MATIC: {walletQ.data?.matic_balance ?? 0} | USDC: {walletQ.data?.usdc_balance ?? 0}</p>
      </div>
      <div className="card space-y-3">
        <h2 className="font-semibold">Scanner</h2>
        <div className="flex gap-2">
          <select className="input max-w-48" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All Categories</option>
            <option value="politics">Politics</option>
            <option value="crypto">Crypto</option>
            <option value="sports">Sports</option>
          </select>
          <button className="btn-secondary" onClick={() => setOffset((v) => Math.max(0, v - 50))}>Prev</button>
          <button className="btn-secondary" onClick={() => setOffset((v) => v + 50)}>Next</button>
        </div>
        <div className="space-y-2">
          {(scannerQ.data?.items || []).map((row, idx) => (
            <button key={idx} className="w-full card !p-3 text-left" onClick={() => setMarket(row.market_id || row.market)}>
              <div className="font-medium">{row.market}</div>
              <div className="text-xs text-[var(--text-muted)]">Score {row.score} | Grade {row.grade} | {row.category}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input className="input min-w-[280px]" value={market} onChange={(e) => setMarket(e.target.value)} placeholder="Selected market ID" />
          <input className="input max-w-32" type="number" value={size} onChange={(e) => setSize(Number(e.target.value || 0))} />
          <button className="btn-success" onClick={() => setConfirm({ side: 'yes', mode: 'live' })} disabled={!market || buyM.isPending}>Ape YES Live</button>
          <button className="btn-secondary" onClick={() => setConfirm({ side: 'no', mode: 'live' })} disabled={!market || buyM.isPending}>Ape NO Live</button>
          <button className="btn-ghost" onClick={() => setConfirm({ side: 'yes', mode: 'demo' })} disabled={!market || demoM.isPending}>Ape Demo</button>
        </div>
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
            <p className="text-sm text-[var(--text-muted)]">{market} | {confirm.side.toUpperCase()} | ${size}</p>
            <div className="flex gap-2">
              <button
                className="btn-primary"
                onClick={async () => {
                  if (confirm.mode === 'live') {
                    await buyM.mutateAsync({ m: market, s: size, side: confirm.side });
                  } else {
                    await demoM.mutateAsync({ m: market, s: size, side: confirm.side });
                  }
                  setConfirm(null);
                }}
              >
                Confirm
              </button>
              <button className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
            </div>
            {(buyM.error || demoM.error) && <div className="badge badge-danger">{buyM.error?.response?.data?.detail || demoM.error?.response?.data?.detail || 'Order failed'}</div>}
            {(buyM.data || demoM.data) && <div className="badge badge-success">Order submitted</div>}
          </div>
        </div>
      )}
    </div>
  );
}
