import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import TierGuard from '../components/common/TierGuard';
import {
  addBlacklist,
  addWatchlist,
  buyDemo,
  buyLive,
  depositDemo,
  getDemo,
  resetDemo,
  runScanner,
  scanContract,
} from '../api/degen';

export default function Degen() {
  const [address, setAddress] = useState('');
  const [size, setSize] = useState(50);
  const [demoAmount, setDemoAmount] = useState(200);
  const [report, setReport] = useState(null);
  const qc = useQueryClient();

  const demoQ = useQuery({ queryKey: ['degen', 'demo'], queryFn: getDemo, staleTime: 30_000 });
  const scannerM = useMutation({ mutationFn: runScanner });
  const scanM = useMutation({ mutationFn: scanContract, onSuccess: (data) => setReport(data) });
  const liveBuyM = useMutation({ mutationFn: ({ token, amount }) => buyLive(token, amount) });
  const demoBuyM = useMutation({
    mutationFn: ({ token, amount }) => buyDemo(token, amount),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo'] }),
  });
  const watchM = useMutation({ mutationFn: (token) => addWatchlist(token) });
  const blackM = useMutation({ mutationFn: (token) => addBlacklist(token) });
  const depM = useMutation({
    mutationFn: depositDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo'] }),
  });
  const resetM = useMutation({
    mutationFn: resetDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Degen</h1>

      <TierGuard tier="pro">
        <div className="card space-y-3">
          <button className="btn-primary" onClick={() => scannerM.mutate()} disabled={scannerM.isPending}>
            {scannerM.isPending ? 'Running...' : 'Run Scanner'}
          </button>
        </div>
      </TierGuard>

      <div className="card space-y-3">
        <h2 className="font-semibold">Contract Scanner</h2>
        <div className="flex gap-2">
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Token address" />
          <button className="btn-primary" onClick={() => scanM.mutate(address)} disabled={scanM.isPending || !address}>Scan</button>
        </div>
        {report && <pre className="text-xs bg-[var(--bg-secondary)] p-3 rounded-2xl overflow-auto">{JSON.stringify(report, null, 2)}</pre>}
        <div className="flex gap-2 flex-wrap">
          <input className="input max-w-36" type="number" value={size} onChange={(e) => setSize(Number(e.target.value || 0))} />
          <button className="btn-success" onClick={() => liveBuyM.mutate({ token: address, amount: size })} disabled={!address || liveBuyM.isPending}>Buy Live</button>
          <button className="btn-secondary" onClick={() => demoBuyM.mutate({ token: address, amount: size })} disabled={!address || demoBuyM.isPending}>Buy Demo</button>
          <button className="btn-ghost" onClick={() => watchM.mutate(address)} disabled={!address || watchM.isPending}>Add Watchlist</button>
          <button className="btn-danger" onClick={() => blackM.mutate(address)} disabled={!address || blackM.isPending}>Add Blacklist</button>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Demo Wallet</h2>
        <p className="text-sm text-[var(--text-muted)]">Balance: {demoQ.data?.balance ?? 0}</p>
        <div className="flex gap-2">
          <input className="input max-w-40" type="number" value={demoAmount} onChange={(e) => setDemoAmount(Number(e.target.value || 0))} />
          <button className="btn-success" onClick={() => depM.mutate(demoAmount)} disabled={depM.isPending}>Deposit</button>
          <button className="btn-danger" onClick={() => resetM.mutate()} disabled={resetM.isPending}>Reset</button>
        </div>
      </div>
    </div>
  );
}

