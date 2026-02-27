import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buyYesNo,
  demoTrade,
  depositDemo,
  getDemo,
  getScanner,
  resetDemo,
} from '../api/predictions';

export default function Predictions() {
  const [market, setMarket] = useState('');
  const [size, setSize] = useState(25);
  const [amount, setAmount] = useState(100);
  const qc = useQueryClient();
  const scannerQ = useQuery({ queryKey: ['predictions', 'scanner'], queryFn: getScanner, staleTime: 30_000 });
  const demoQ = useQuery({ queryKey: ['predictions', 'demo'], queryFn: getDemo, staleTime: 30_000 });

  const buyM = useMutation({ mutationFn: ({ m, s }) => buyYesNo(m, s) });
  const demoM = useMutation({
    mutationFn: ({ m, s }) => demoTrade(m, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }),
  });
  const depM = useMutation({
    mutationFn: depositDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }),
  });
  const resetM = useMutation({
    mutationFn: resetDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', 'demo'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Predictions</h1>
      <div className="card space-y-3">
        <h2 className="font-semibold">Scanner</h2>
        <div className="space-y-2">
          {(scannerQ.data || []).map((row, idx) => (
            <button key={idx} className="w-full card !p-3 text-left" onClick={() => setMarket(row.market)}>
              <div className="font-medium">{row.market}</div>
              <div className="text-xs text-[var(--text-muted)]">Score {row.score} · Grade {row.grade}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input className="input min-w-[280px]" value={market} onChange={(e) => setMarket(e.target.value)} placeholder="Selected market" />
          <input className="input max-w-32" type="number" value={size} onChange={(e) => setSize(Number(e.target.value || 0))} />
          <button className="btn-success" onClick={() => buyM.mutate({ m: market, s: size })} disabled={!market || buyM.isPending}>Buy YES</button>
          <button className="btn-secondary" onClick={() => buyM.mutate({ m: market, s: size })} disabled={!market || buyM.isPending}>Buy NO</button>
          <button className="btn-ghost" onClick={() => demoM.mutate({ m: market, s: size })} disabled={!market || demoM.isPending}>Demo Buy</button>
        </div>
      </div>
      <div className="card space-y-3">
        <h2 className="font-semibold">Demo Wallet</h2>
        <p className="text-sm text-[var(--text-muted)]">Balance: {demoQ.data?.balance ?? 0}</p>
        <div className="flex gap-2">
          <input className="input max-w-40" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value || 0))} />
          <button className="btn-success" onClick={() => depM.mutate(amount)} disabled={depM.isPending}>Deposit</button>
          <button className="btn-danger" onClick={() => resetM.mutate()} disabled={resetM.isPending}>Reset</button>
        </div>
      </div>
    </div>
  );
}

