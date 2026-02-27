import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import TierGuard from '../components/common/TierGuard';
import {
  addTrackedWallet,
  addWatchlist,
  buyDemo,
  buyLive,
  clearDemoLogs,
  depositDemo,
  exportTrackedWallets,
  getDemo,
  getDemoHistory,
  getScannerResults,
  getTrackedWallets,
  getWalletBalance,
  getWatchlist,
  resetDemo,
  runScanner,
  scanContract,
  withdrawDemo,
} from '../api/degen';

export default function Degen() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [size, setSize] = useState(50);
  const [slippage, setSlippage] = useState(100);
  const [demoAmount, setDemoAmount] = useState(200);
  const [walletInput, setWalletInput] = useState('');
  const [caInput, setCaInput] = useState('');
  const [result, setResult] = useState(null);
  const [scanReport, setScanReport] = useState(null);
  const [caError, setCaError] = useState('');

  const demoQ = useQuery({ queryKey: ['degen', 'demo'], queryFn: getDemo, staleTime: 30_000 });
  const demoHistoryQ = useQuery({ queryKey: ['degen', 'demo-history'], queryFn: getDemoHistory, staleTime: 30_000 });
  const scannerResultsQ = useQuery({ queryKey: ['degen', 'scanner'], queryFn: getScannerResults, staleTime: 15_000 });
  const walletQ = useQuery({ queryKey: ['degen', 'wallet'], queryFn: getWalletBalance, staleTime: 15_000 });
  const watchQ = useQuery({ queryKey: ['degen', 'watchlist'], queryFn: getWatchlist, staleTime: 30_000 });
  const trackedQ = useQuery({ queryKey: ['degen', 'tracked'], queryFn: getTrackedWallets, staleTime: 30_000 });

  const scannerM = useMutation({ mutationFn: runScanner, onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'scanner'] }) });
  const liveBuyM = useMutation({
    mutationFn: ({ token, amount, slip }) => buyLive(token, amount, slip, true),
    onSuccess: (data) => setResult({ ok: true, message: `Success: ${data?.plan?.token_address || ''}` }),
    onError: (err) => setResult({ ok: false, message: err?.response?.data?.detail || 'RPC failure' }),
  });
  const demoBuyM = useMutation({
    mutationFn: ({ token, amount, slip }) => buyDemo(token, amount, slip),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['degen', 'demo'] });
      setResult({ ok: true, message: 'Demo ape executed' });
    },
    onError: (err) => setResult({ ok: false, message: err?.response?.data?.detail || 'Demo order failed' }),
  });
  const watchM = useMutation({
    mutationFn: (token) => addWatchlist(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'watchlist'] }),
  });
  const depM = useMutation({ mutationFn: depositDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo'] }) });
  const withdrawM = useMutation({ mutationFn: withdrawDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo'] }) });
  const resetM = useMutation({ mutationFn: resetDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo'] }) });
  const clearLogsM = useMutation({ mutationFn: clearDemoLogs, onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo-history'] }) });
  const addTrackedM = useMutation({
    mutationFn: (address) => addTrackedWallet({ wallet_address: address, auto_mirror: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'tracked'] }),
  });
  const scanM = useMutation({
    mutationFn: (address) => scanContract(address),
    onSuccess: (data) => {
      setCaError('');
      setScanReport(data);
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Degen</h1>

      <div className="card space-y-2">
        <h2 className="font-semibold">Solana Wallet</h2>
        <p className="text-sm text-[var(--text-muted)]">SOL: {walletQ.data?.sol_balance ?? 0} | Tokens: {walletQ.data?.token_count ?? 0}</p>
      </div>

      <TierGuard tier="pro">
        <div className="card space-y-3">
          <button className="btn-primary" onClick={() => scannerM.mutate()} disabled={scannerM.isPending}>
            {scannerM.isPending ? 'Running...' : 'Run Scanner'}
          </button>
          {scannerM.error && <p className="text-sm text-danger">{scannerM.error?.response?.data?.detail || 'Scanner failed'}</p>}
        </div>
      </TierGuard>

      <div className="card space-y-3">
        <h2 className="font-semibold">Contract Address Scanner</h2>
        <label className="text-sm text-[var(--text-muted)]">Paste Token Contract Address</label>
        <div className="flex flex-col md:flex-row gap-2">
          <input className="input" value={caInput} onChange={(e) => setCaInput(e.target.value.trim())} placeholder="Paste Token Contract Address" />
          <button
            className="btn-primary"
            disabled={scanM.isPending || !caInput}
            onClick={() => {
              const ok = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(caInput);
              if (!ok) {
                setCaError('Invalid Solana contract address format');
                return;
              }
              scanM.mutate(caInput);
            }}
          >
            {scanM.isPending ? 'Scanning...' : 'Scan'}
          </button>
        </div>
        {caError && <div className="badge badge-danger">{caError}</div>}
        {scanM.error && <div className="badge badge-danger">{scanM.error?.response?.data?.detail || 'Scan failed'}</div>}
        {scanReport && (
          <div className="card !p-3 space-y-1 text-sm">
            <p>Name: {scanReport.symbol || 'Unknown'}</p>
            <p>Price: {scanReport.price_usd ?? 0}</p>
            <p>Liquidity: {scanReport.liquidity_usd ?? 0}</p>
            <p>Volume: {scanReport.volume_24h ?? 0}</p>
            <p>CA: {caInput.slice(0, 4)}...</p>
            <p>Risk: {scanReport.grade || 'D'} | Score: {scanReport.score ?? 0}</p>
            <div className="flex gap-2">
              <button className="btn-secondary btn-sm" onClick={() => setSelected({ token_name: scanReport.symbol || 'Token', token_address: caInput })}>Ape (Demo)</button>
              <button className="btn-primary btn-sm" onClick={() => setSelected({ token_name: scanReport.symbol || 'Token', token_address: caInput })}>Ape (Live)</button>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {(scannerResultsQ.data || []).map((row) => (
          <div key={row.id} className="card !p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{row.token_name}</h3>
              <span className="badge badge-warning">{row.risk_indicator}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">{row.token_short}...</p>
            <p className="text-xs">Price: {row.price} | Liq: {row.liquidity} | Vol: {row.volume}</p>
            <div className="flex gap-2">
              <button className="btn-secondary btn-sm" onClick={() => { setSelected(row); setResult(null); }}>Ape (Demo)</button>
              <button className="btn-primary btn-sm" onClick={() => { setSelected(row); setResult(null); }}>Ape (Live)</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Whitelist</h2>
        <div className="flex gap-2 flex-wrap">
          {(watchQ.data || []).map((item) => <span key={item.id} className="badge badge-info">{item.token_address || item.address}</span>)}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Demo Wallet</h2>
        <p className="text-sm text-[var(--text-muted)]">Balance: {demoQ.data?.balance ?? 0}</p>
        <div className="flex gap-2">
          <input className="input max-w-40" type="number" value={demoAmount} onChange={(e) => setDemoAmount(Number(e.target.value || 0))} />
          <button className="btn-success" onClick={() => depM.mutate(demoAmount)} disabled={depM.isPending}>Deposit</button>
          <button className="btn-secondary" onClick={() => withdrawM.mutate(demoAmount)} disabled={withdrawM.isPending}>Withdraw</button>
          <button className="btn-danger" onClick={() => resetM.mutate()} disabled={resetM.isPending}>Reset</button>
          <button className="btn-ghost" onClick={() => clearLogsM.mutate()} disabled={clearLogsM.isPending}>Clear Logs</button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">Open: {demoHistoryQ.data?.open?.length || 0} | Closed: {demoHistoryQ.data?.closed?.length || 0}</p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Wallet Tracking</h2>
        <div className="flex gap-2">
          <input className="input" value={walletInput} onChange={(e) => setWalletInput(e.target.value)} placeholder="Wallet address" />
          <button className="btn-primary" onClick={() => addTrackedM.mutate(walletInput)} disabled={!walletInput || addTrackedM.isPending}>Track</button>
          <button className="btn-secondary" onClick={async () => {
            const csv = await exportTrackedWallets();
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tracked_wallets.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}>Export CSV</button>
        </div>
        <div className="text-xs space-y-1">
          {(trackedQ.data || []).map((row) => <div key={row.id}>{row.wallet_address} pnl {row.pnl_from_copies ?? 0}</div>)}
        </div>
      </div>

      {selected && (
        <div className="modal-overlay">
          <div className="modal space-y-3">
            <h3 className="font-semibold">{selected.token_name}</h3>
            <p className="text-xs text-[var(--text-muted)]">{selected.token_address}</p>
            <input className="input" type="number" value={size} onChange={(e) => setSize(Number(e.target.value || 0))} />
            <div>
              <label className="text-xs text-[var(--text-muted)]">Slippage (bps)</label>
              <input className="input" type="number" value={slippage} onChange={(e) => setSlippage(Number(e.target.value || 0))} />
            </div>
            <div className="flex gap-2">
              <button
                className="btn-secondary"
                onClick={() => demoBuyM.mutate({ token: selected.token_address, amount: size, slip: slippage })}
                disabled={demoBuyM.isPending}
              >
                Confirm Demo
              </button>
              <button
                className="btn-primary"
                onClick={() => liveBuyM.mutate({ token: selected.token_address, amount: size, slip: slippage })}
                disabled={liveBuyM.isPending}
              >
                Confirm Live
              </button>
              <button className="btn-ghost" onClick={() => setSelected(null)}>Cancel</button>
              <button className="btn-ghost" onClick={() => watchM.mutate(selected.token_address)}>Whitelist</button>
            </div>
            {result && <div className={`badge ${result.ok ? 'badge-success' : 'badge-danger'}`}>{result.message}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
