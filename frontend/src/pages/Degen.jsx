import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import TierGuard from '../components/common/TierGuard';
import {
  addTrackedWallet,
  addWatchlist,
  buyDemo,
  buyLive,
  clearDemoLogs,
  createModel,
  deleteModel,
  depositDemo,
  exportTrackedWallets,
  getDemo,
  getDemoHistory,
  getModels,
  getScannerResults,
  getTrackedWallets,
  getWalletBalance,
  getWatchlist,
  resetDemo,
  runScanner,
  scanContract,
  toggleModel,
  withdrawDemo,
} from '../api/degen';
import { PageWrapper } from '../components/common/PageWrapper';

const formatNum = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function SafetyReport({ data }) {
  if (!data) return null;
  if (!data.found) return <div className="card"><p className="text-sm text-[var(--text-muted)]">{data.error || 'Token not found'}</p></div>;
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold">{data.name}</h3>
            <p className="text-[var(--text-muted)] font-mono">${data.symbol} · {data.ca.slice(0, 8)}...</p>
          </div>
          <div className={`grade-${data.grade} text-2xl px-4 py-2`}>{data.grade}</div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1"><span>Safety Score</span><span className="font-bold">{data.safety_score}/100</span></div>
          <div className="h-2 rounded-full bg-[var(--bg-secondary)]">
            <div style={{ width: `${data.safety_score}%` }} className={`h-full rounded-full ${data.safety_score >= 70 ? 'bg-emerald-500' : data.safety_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Price', `$${Number(data.price_usd || 0).toFixed(8)}`],
          ['MCap', `$${formatNum(data.mcap_usd)}`],
          ['Liquidity', `$${formatNum(data.liquidity_usd)}`],
          ['Age', `${Number(data.age_hours || 0).toFixed(0)}h`],
          ['Holders', Number(data.holder_count || 0).toLocaleString()],
          ['Dev Wallet', `${Number(data.dev_wallet_pct || 0).toFixed(1)}%`],
          ['B/S Ratio', Number(data.bs_ratio || 0).toFixed(2)],
          ['Rug Score', `${data.rug_score}/100`],
        ].map(([k, v]) => <div key={k} className="card text-center"><p className="stat-label">{k}</p><p className="stat-value text-base">{v}</p></div>)}
      </div>
    </div>
  );
}

const DEFAULT_MODEL = {
  name: '',
  description: '',
  active: true,
  min_score: 70,
  min_mcap_usd: 0,
  max_mcap_usd: 10000000,
  min_liquidity_usd: 10000,
  max_age_minutes: 1440,
  min_holder_count: 50,
  max_rug_score: 50,
  position_size_usd: 50,
  auto_buy: false,
  auto_buy_threshold: 80,
};

export default function Degen() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [size, setSize] = useState(50);
  const [slippage, setSlippage] = useState(100);
  const [demoAmount, setDemoAmount] = useState(200);
  const [walletInput, setWalletInput] = useState('');
  const [caInput, setCaInput] = useState('');
  const [scanReport, setScanReport] = useState(null);
  const [caError, setCaError] = useState('');
  const [modelForm, setModelForm] = useState(DEFAULT_MODEL);
  const [modelError, setModelError] = useState('');

  const demoQ = useQuery({ queryKey: ['degen', 'demo'], queryFn: getDemo, staleTime: 30_000 });
  const demoHistoryQ = useQuery({ queryKey: ['degen', 'demo-history'], queryFn: getDemoHistory, staleTime: 30_000 });
  const scannerResultsQ = useQuery({ queryKey: ['degen', 'scanner'], queryFn: getScannerResults, staleTime: 15_000 });
  const walletQ = useQuery({ queryKey: ['degen', 'wallet'], queryFn: getWalletBalance, staleTime: 15_000 });
  const watchQ = useQuery({ queryKey: ['degen', 'watchlist'], queryFn: getWatchlist, staleTime: 30_000 });
  const trackedQ = useQuery({ queryKey: ['degen', 'tracked'], queryFn: getTrackedWallets, staleTime: 30_000 });
  const modelsQ = useQuery({ queryKey: ['degen', 'models'], queryFn: getModels, staleTime: 30_000 });

  const activeModelCount = useMemo(() => (modelsQ.data || []).filter((m) => m.active).length, [modelsQ.data]);

  const scannerM = useMutation({ mutationFn: runScanner, onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'scanner'] }) });
  const createModelM = useMutation({
    mutationFn: createModel,
    onSuccess: async () => {
      setModelForm(DEFAULT_MODEL);
      setModelError('');
      await qc.invalidateQueries({ queryKey: ['degen', 'models'] });
    },
    onError: (err) => setModelError(err?.response?.data?.detail || 'Could not create model'),
  });
  const toggleModelM = useMutation({ mutationFn: ({ id, active }) => toggleModel(id, active), onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'models'] }) });
  const deleteModelM = useMutation({ mutationFn: deleteModel, onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'models'] }) });
  const liveBuyM = useMutation({ mutationFn: ({ token, amount, slip }) => buyLive(token, amount, slip, true) });
  const demoBuyM = useMutation({ mutationFn: ({ token, amount, slip }) => buyDemo(token, amount, slip), onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo'] }) });
  const watchM = useMutation({ mutationFn: (token) => addWatchlist(token), onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'watchlist'] }) });
  const depM = useMutation({ mutationFn: depositDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo'] }) });
  const withdrawM = useMutation({ mutationFn: withdrawDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo'] }) });
  const resetM = useMutation({ mutationFn: resetDemo, onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo'] }) });
  const clearLogsM = useMutation({ mutationFn: clearDemoLogs, onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'demo-history'] }) });
  const addTrackedM = useMutation({ mutationFn: (address) => addTrackedWallet({ wallet_address: address, auto_mirror: false }), onSuccess: () => qc.invalidateQueries({ queryKey: ['degen', 'tracked'] }) });
  const scanM = useMutation({ mutationFn: (address) => scanContract(address), onSuccess: (data) => { setCaError(''); setScanReport(data); } });

  return (
    <PageWrapper className="space-y-4">
      <h1 className="text-2xl font-semibold">Degen</h1>
      <div className="card space-y-2">
        <h2 className="font-semibold">Solana Wallet</h2>
        <p className="text-sm text-[var(--text-muted)]">SOL: {walletQ.data?.sol_balance ?? 0} | Tokens: {walletQ.data?.token_count ?? 0}</p>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Degen Model Builder</h2>
          <span className="badge badge-info">Active models: {activeModelCount}</span>
        </div>
        <div className="grid md:grid-cols-4 gap-2">
          <input className="input" placeholder="Model name" value={modelForm.name} onChange={(e) => setModelForm((p) => ({ ...p, name: e.target.value }))} />
          <input className="input" type="number" value={modelForm.min_score} onChange={(e) => setModelForm((p) => ({ ...p, min_score: Number(e.target.value || 0) }))} placeholder="Min score" />
          <input className="input" type="number" value={modelForm.min_liquidity_usd} onChange={(e) => setModelForm((p) => ({ ...p, min_liquidity_usd: Number(e.target.value || 0) }))} placeholder="Min liquidity" />
          <input className="input" type="number" value={modelForm.max_rug_score} onChange={(e) => setModelForm((p) => ({ ...p, max_rug_score: Number(e.target.value || 0) }))} placeholder="Max rug score" />
          <input className="input" type="number" value={modelForm.min_mcap_usd} onChange={(e) => setModelForm((p) => ({ ...p, min_mcap_usd: Number(e.target.value || 0) }))} placeholder="Min mcap" />
          <input className="input" type="number" value={modelForm.max_mcap_usd} onChange={(e) => setModelForm((p) => ({ ...p, max_mcap_usd: Number(e.target.value || 0) }))} placeholder="Max mcap" />
          <input className="input" type="number" value={modelForm.max_age_minutes} onChange={(e) => setModelForm((p) => ({ ...p, max_age_minutes: Number(e.target.value || 0) }))} placeholder="Max age mins" />
          <input className="input" type="number" value={modelForm.min_holder_count} onChange={(e) => setModelForm((p) => ({ ...p, min_holder_count: Number(e.target.value || 0) }))} placeholder="Min holders" />
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={modelForm.active} onChange={(e) => setModelForm((p) => ({ ...p, active: e.target.checked }))} />
            Active
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={modelForm.auto_buy} onChange={(e) => setModelForm((p) => ({ ...p, auto_buy: e.target.checked }))} />
            Auto-buy
          </label>
          <button
            className="btn-primary"
            onClick={() => {
              if (!modelForm.name || modelForm.name.trim().length < 2) {
                setModelError('Model name must be at least 2 characters');
                return;
              }
              createModelM.mutate(modelForm);
            }}
            disabled={createModelM.isPending}
          >
            {createModelM.isPending ? 'Saving...' : 'Save Model'}
          </button>
        </div>
        {modelError && <div className="badge badge-danger">{modelError}</div>}
        <div className="space-y-2">
          {(modelsQ.data || []).map((row) => (
            <div key={row.id} className="card !p-3 flex items-center gap-2">
              <div className="flex-1">
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-[var(--text-muted)]">Score≥{row.min_score} · Liq≥{row.min_liquidity_usd} · Rug≤{row.max_rug_score}</p>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => toggleModelM.mutate({ id: row.id, active: !row.active })}>{row.active ? 'Disable' : 'Enable'}</button>
              <button className="btn-danger btn-sm" onClick={() => deleteModelM.mutate(row.id)}>Delete</button>
            </div>
          ))}
          {(modelsQ.data || []).length === 0 && <p className="text-sm text-[var(--text-muted)]">No degen models yet. Create one to enable scanner execution.</p>}
        </div>
      </div>

      <TierGuard tier="pro">
        <div className="card space-y-2">
          <button className="btn-primary" onClick={() => scannerM.mutate()} disabled={scannerM.isPending || activeModelCount === 0}>
            {scannerM.isPending ? 'Running...' : 'Run Scanner'}
          </button>
          {activeModelCount === 0 && <p className="text-sm text-[var(--text-muted)]">Scanner requires at least one active degen model.</p>}
        </div>
      </TierGuard>

      <div className="card space-y-3">
        <h2 className="font-semibold">Contract Address Scanner</h2>
        <div className="flex flex-col md:flex-row gap-2">
          <input className="input" value={caInput} onChange={(e) => setCaInput(e.target.value.trim())} placeholder="Paste Solana contract address" />
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
        <SafetyReport data={scanReport} />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {(scannerResultsQ.data || []).map((row) => (
          <div key={row.id} className="card !p-4">
            <div className="flex items-center justify-between"><h3 className="font-semibold">{row.token_name}</h3><span className="badge badge-warning">{row.risk_indicator}</span></div>
            <p className="text-xs text-[var(--text-muted)]">{row.token_short}...</p>
            <div className="flex gap-2 mt-3">
              <button className="btn-secondary btn-sm" onClick={() => setSelected(row)}>Ape (Demo)</button>
              <button className="btn-primary btn-sm" onClick={() => setSelected(row)}>Ape (Live)</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Demo Wallet</h2>
        <p className="text-sm text-[var(--text-muted)]">Balance: {demoQ.data?.balance ?? 0}</p>
        <div className="flex gap-2">
          <input className="input max-w-40" type="number" value={demoAmount} onChange={(e) => setDemoAmount(Number(e.target.value || 0))} />
          <button className="btn-success" onClick={() => depM.mutate(demoAmount)}>Deposit</button>
          <button className="btn-secondary" onClick={() => withdrawM.mutate(demoAmount)}>Withdraw</button>
          <button className="btn-danger" onClick={() => resetM.mutate()}>Reset</button>
          <button className="btn-ghost" onClick={() => clearLogsM.mutate()}>Clear Logs</button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">Open: {demoHistoryQ.data?.open?.length || 0} | Closed: {demoHistoryQ.data?.closed?.length || 0}</p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Watchlist</h2>
        <div className="flex gap-2 flex-wrap">{(watchQ.data || []).map((item) => <span key={item.id} className="badge badge-info">{item.token_address || item.address}</span>)}</div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Wallet Tracking</h2>
        <div className="flex gap-2">
          <input className="input" value={walletInput} onChange={(e) => setWalletInput(e.target.value)} placeholder="Wallet address" />
          <button className="btn-primary" onClick={() => addTrackedM.mutate(walletInput)} disabled={!walletInput}>Track</button>
          <button
            className="btn-secondary"
            onClick={async () => {
              const csv = await exportTrackedWallets();
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'tracked_wallets.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </button>
        </div>
        <div className="text-xs space-y-1">{(trackedQ.data || []).map((row) => <div key={row.id}>{row.wallet_address} pnl {row.pnl_from_copies ?? 0}</div>)}</div>
      </div>

      {selected && (
        <div className="modal-overlay">
          <div className="modal space-y-3">
            <h3 className="font-semibold">{selected.token_name}</h3>
            <p className="text-xs text-[var(--text-muted)]">{selected.token_address}</p>
            <input className="input" type="number" value={size} onChange={(e) => setSize(Number(e.target.value || 0))} />
            <input className="input" type="number" value={slippage} onChange={(e) => setSlippage(Number(e.target.value || 0))} />
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => demoBuyM.mutate({ token: selected.token_address, amount: size, slip: slippage })}>Confirm Demo</button>
              <button className="btn-primary" onClick={() => liveBuyM.mutate({ token: selected.token_address, amount: size, slip: slippage })}>Confirm Live</button>
              <button className="btn-ghost" onClick={() => setSelected(null)}>Cancel</button>
              <button className="btn-ghost" onClick={() => watchM.mutate(selected.token_address)}>Whitelist</button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
