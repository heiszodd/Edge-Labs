import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CandlestickChart from '../components/charts/CandlestickChart';
import ModelCard from '../components/models/ModelCard';
import AdvancedModelBuilder from '../components/models/AdvancedModelBuilder';
import SignalCard from '../components/signals/SignalCard';
import TierGuard from '../components/common/TierGuard';
import {
  clearDemoLogs,
  createModel,
  depositDemo,
  getAccount,
  getDemoBalance,
  getDemoHistory,
  getDepositAddress,
  getHealth,
  getHistory,
  getModels,
  getOrders,
  getPending,
  getPositions,
  getRisk,
  requestWithdraw,
  resetDemo,
  runScanner,
  updateRisk,
  withdrawDemo,
} from '../api/perps';
import { executeDemo, executeLive } from '../api/signals';

const tabs = ['Overview', 'Scanner', 'Models', 'Pending', 'Demo', 'Risk'];

export default function Perps() {
  const [tab, setTab] = useState('Overview');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [demoAmount, setDemoAmount] = useState(500);
  const [withdrawAmount, setWithdrawAmount] = useState(100);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [riskForm, setRiskForm] = useState({
    max_risk_pct: 1,
    daily_loss_limit: 200,
    max_positions: 5,
    max_leverage: 10,
    max_daily_trades: 10,
  });
  const [selectedModelIds, setSelectedModelIds] = useState([]);
  const [selectedPairs, setSelectedPairs] = useState([]);
  const qc = useQueryClient();

  const accountQ = useQuery({ queryKey: ['perps', 'account'], queryFn: () => getAccount(7), refetchInterval: 7000 });
  const healthQ = useQuery({ queryKey: ['perps', 'health'], queryFn: getHealth, refetchInterval: 7000 });
  const positionsQ = useQuery({ queryKey: ['perps', 'positions'], queryFn: () => getPositions(true), refetchInterval: 10000 });
  const ordersQ = useQuery({ queryKey: ['perps', 'orders'], queryFn: () => getOrders(true), refetchInterval: 10000 });
  const historyQ = useQuery({ queryKey: ['perps', 'history'], queryFn: () => getHistory(100, true), staleTime: 10_000 });
  const modelsQ = useQuery({ queryKey: ['perps', 'models'], queryFn: getModels, staleTime: 30_000 });
  const pendingQ = useQuery({ queryKey: ['perps', 'pending'], queryFn: getPending, staleTime: 30_000, refetchOnWindowFocus: true });
  const demoQ = useQuery({ queryKey: ['perps', 'demo'], queryFn: getDemoBalance, staleTime: 30_000 });
  const demoHistoryQ = useQuery({ queryKey: ['perps', 'demo-history'], queryFn: getDemoHistory, staleTime: 30_000 });
  const riskQ = useQuery({ queryKey: ['perps', 'risk'], queryFn: getRisk, staleTime: 30_000 });
  const depositAddressQ = useQuery({ queryKey: ['perps', 'deposit'], queryFn: getDepositAddress, staleTime: 60_000 });

  useEffect(() => {
    if (riskQ.data) setRiskForm((prev) => ({ ...prev, ...riskQ.data }));
  }, [riskQ.data]);
  useEffect(() => {
    const ids = (modelsQ.data || []).map((m) => Number(m.id)).filter(Boolean);
    if (ids.length && selectedModelIds.length === 0) {
      setSelectedModelIds(ids);
    }
    const pairs = Array.from(new Set((modelsQ.data || []).map((m) => (m.pair || '').toUpperCase()).filter(Boolean)));
    if (pairs.length && selectedPairs.length === 0) {
      setSelectedPairs(pairs);
    }
  }, [modelsQ.data]);

  const scannerM = useMutation({
    mutationFn: runScanner,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'pending'] }),
  });
  const createModelM = useMutation({
    mutationFn: createModel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'models'] }),
  });
  const depositM = useMutation({
    mutationFn: depositDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'demo'] }),
  });
  const withdrawM = useMutation({
    mutationFn: withdrawDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'demo'] }),
  });
  const resetM = useMutation({
    mutationFn: resetDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'demo'] }),
  });
  const clearLogsM = useMutation({
    mutationFn: clearDemoLogs,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'demo-history'] }),
  });
  const saveRiskM = useMutation({
    mutationFn: updateRisk,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'risk'] }),
  });
  const withdrawLiveM = useMutation({ mutationFn: requestWithdraw });
  const execLiveM = useMutation({
    mutationFn: executeLive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'pending'] }),
  });
  const execDemoM = useMutation({
    mutationFn: executeDemo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perps', 'pending'] });
      qc.invalidateQueries({ queryKey: ['perps', 'demo'] });
    },
  });

  const healthBadge = useMemo(() => {
    const indicator = healthQ.data?.indicator;
    if (indicator === 'green') return ['badge-success', 'Connected'];
    if (healthQ.isFetching) return ['badge-warning', 'Slow'];
    return ['badge-danger', 'Disconnected'];
  }, [healthQ.data, healthQ.isFetching]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Perps</h1>
      <div className="tab-bar">
        {tabs.map((item) => (
          <button key={item} className={`tab ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-muted)]">Hyperliquid Account</p>
              <span className={`badge ${healthBadge[0]}`}>{healthBadge[1]}</span>
            </div>
            {accountQ.data?.error && <div className="badge badge-danger">{accountQ.data.error.detail}</div>}
            {accountQ.data?.error?.response_body && (
              <pre className="text-xs text-danger bg-[var(--bg-secondary)] p-2 rounded-xl overflow-auto">
                {String(accountQ.data.error.response_body).slice(0, 500)}
              </pre>
            )}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="card !p-3"><p className="text-[var(--text-muted)]">Equity</p><p className="font-semibold">{accountQ.data?.equity ?? 0}</p></div>
              <div className="card !p-3"><p className="text-[var(--text-muted)]">Available</p><p className="font-semibold">{accountQ.data?.available ?? 0}</p></div>
              <div className="card !p-3"><p className="text-[var(--text-muted)]">Margin Used</p><p className="font-semibold">{accountQ.data?.margin_used ?? 0}</p></div>
            </div>
            <div className="text-xs text-[var(--text-muted)] break-all">Address: {accountQ.data?.hl_address || '-'}</div>
            <div className="flex gap-2">
              <button className="btn-secondary btn-sm" onClick={() => { positionsQ.refetch(); ordersQ.refetch(); historyQ.refetch(); }}>Refresh Orders/Positions</button>
              <button className="btn-secondary btn-sm" onClick={() => accountQ.refetch()}>Refresh Balance</button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="card !p-3">
                <p className="text-xs text-[var(--text-muted)] mb-2">Deposit Address</p>
                <p className="text-xs break-all">{depositAddressQ.data?.deposit_address || 'Wallet not connected'}</p>
              </div>
              <div className="card !p-3 space-y-2">
                <p className="text-xs text-[var(--text-muted)]">Withdraw</p>
                <input className="input input-sm" placeholder="Address" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} />
                <input className="input input-sm" type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(Number(e.target.value || 0))} />
                <button
                  className="btn-danger btn-sm"
                  disabled={withdrawLiveM.isPending || !withdrawAddress}
                  onClick={() => withdrawLiveM.mutate({ address: withdrawAddress, amount: Number(withdrawAmount), confirm: true })}
                >
                  Confirm Withdraw
                </button>
                {withdrawLiveM.error && <p className="text-xs text-danger">{withdrawLiveM.error?.response?.data?.detail || 'Withdraw failed'}</p>}
              </div>
            </div>
          </div>
          <CandlestickChart />
          <div className="card">
            <h3 className="font-semibold mb-2">Open Positions</h3>
            <div className="text-xs space-y-1 max-h-56 overflow-auto">
              {(positionsQ.data || []).map((row, i) => <div key={i}>{row.coin} {row.side} size {row.size} uPnL {row.live_upnl}</div>)}
            </div>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-2">Orders + History</h3>
            <div className="text-xs space-y-1 max-h-56 overflow-auto">
              {(ordersQ.data || []).slice(0, 8).map((row, i) => <div key={`o-${i}`}>#{row.order_id || i} {row.coin} {row.status}</div>)}
              {(historyQ.data || []).slice(0, 8).map((row, i) => <div key={`h-${i}`}>Fill {row.coin} pnl {row.closed_pnl}</div>)}
            </div>
          </div>
        </div>
      )}

      {tab === 'Scanner' && (
        <TierGuard tier="pro">
          <div className="card space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium mb-2">Models</p>
                <div className="flex gap-2 mb-2">
                  <button className="btn-secondary btn-sm" onClick={() => setSelectedModelIds((modelsQ.data || []).map((m) => Number(m.id)).filter(Boolean))}>Select All</button>
                  <button className="btn-ghost btn-sm" onClick={() => setSelectedModelIds([])}>Clear</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(modelsQ.data || []).map((model) => {
                    const id = Number(model.id);
                    const active = selectedModelIds.includes(id);
                    return (
                      <button
                        key={id}
                        className={`btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSelectedModelIds((prev) => (active ? prev.filter((x) => x !== id) : [...prev, id]))}
                      >
                        {model.name || `Model ${id}`}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Pairs</p>
                <div className="flex gap-2 mb-2">
                  <button className="btn-secondary btn-sm" onClick={() => setSelectedPairs(Array.from(new Set((modelsQ.data || []).map((m) => (m.pair || '').toUpperCase()).filter(Boolean))))}>Select All</button>
                  <button className="btn-ghost btn-sm" onClick={() => setSelectedPairs([])}>Clear</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set((modelsQ.data || []).map((m) => (m.pair || '').toUpperCase()).filter(Boolean))).map((pair) => {
                    const active = selectedPairs.includes(pair);
                    return (
                      <button
                        key={pair}
                        className={`btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSelectedPairs((prev) => (active ? prev.filter((x) => x !== pair) : [...prev, pair]))}
                      >
                        {pair}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <button
              className="btn-primary"
              onClick={() => scannerM.mutate({
                model_ids: selectedModelIds,
                pairs: selectedPairs,
                include_all_models: selectedModelIds.length === 0,
                include_all_pairs: selectedPairs.length === 0,
              })}
              disabled={scannerM.isPending || ((modelsQ.data || []).length > 0 && selectedModelIds.length === 0)}
            >
              {scannerM.isPending ? 'Running...' : 'Run Scanner'}
            </button>
            <p className="text-sm text-[var(--text-muted)]">Runs selected models and selected pairs, then returns structured signal strength and scan timestamp.</p>
            {scannerM.data?.results?.length > 0 && (
              <div className="text-xs space-y-1">
                {scannerM.data.results.map((r) => <div key={r.id}>{r.pair} score {r.signal_strength} @ {r.timestamp}</div>)}
              </div>
            )}
            {scannerM.error && <div className="badge badge-danger">{scannerM.error?.response?.data?.detail || 'Scan failed'}</div>}
          </div>
        </TierGuard>
      )}

      {tab === 'Models' && (
        <div className="space-y-4">
          <div className="card flex items-center justify-between">
            <p className="text-sm text-[var(--text-muted)]">Advanced Model Builder only</p>
            <button className="btn-secondary" onClick={() => setBuilderOpen(true)}>Open Advanced Builder</button>
          </div>
          {createModelM.error && <div className="text-sm text-danger">{createModelM.error?.response?.data?.detail || 'Model save failed'}</div>}
          <div className="grid md:grid-cols-2 gap-4">
            {(modelsQ.data || []).map((model) => <ModelCard key={model.id} model={model} />)}
          </div>
        </div>
      )}

      {tab === 'Pending' && (
        <div className="grid md:grid-cols-2 gap-4">
          {(pendingQ.data || []).map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onExecute={(s) => (s.phase === 4 ? execLiveM.mutate(s.id) : execDemoM.mutate(s.id))}
            />
          ))}
        </div>
      )}

      {tab === 'Demo' && (
        <div className="card space-y-3">
          <p className="text-sm text-[var(--text-muted)]">Balance: <span className="text-[var(--text-primary)]">{demoQ.data?.balance ?? 0}</span></p>
          <div className="flex gap-2 flex-wrap">
            <input className="input max-w-40" type="number" value={demoAmount} onChange={(e) => setDemoAmount(Number(e.target.value || 0))} />
            <button className="btn-success" onClick={() => depositM.mutate(Number(demoAmount))} disabled={depositM.isPending}>Deposit</button>
            <button className="btn-secondary" onClick={() => withdrawM.mutate(Number(demoAmount))} disabled={withdrawM.isPending}>Withdraw</button>
            <button className="btn-danger" onClick={() => resetM.mutate()} disabled={resetM.isPending}>Reset</button>
            <button className="btn-ghost" onClick={() => clearLogsM.mutate()} disabled={clearLogsM.isPending}>Clear Logs</button>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Open: {demoHistoryQ.data?.open?.length || 0} | Closed: {demoHistoryQ.data?.closed?.length || 0}
          </div>
        </div>
      )}

      {tab === 'Risk' && (
        <div className="card grid md:grid-cols-2 gap-3">
          {Object.keys(riskForm).map((key) => (
            <label key={key} className="text-sm">
              <span className="block mb-1 text-[var(--text-muted)]">{key}</span>
              <input
                className="input"
                type="number"
                value={riskForm[key]}
                onChange={(e) => setRiskForm((p) => ({ ...p, [key]: Number(e.target.value || 0) }))}
              />
            </label>
          ))}
          <button className="btn-primary md:col-span-2" onClick={() => saveRiskM.mutate(riskForm)} disabled={saveRiskM.isPending || riskQ.isLoading}>
            {saveRiskM.isPending ? 'Saving...' : 'Save Risk Settings'}
          </button>
        </div>
      )}

      {builderOpen && (
        <div className="modal-overlay">
          <div className="modal !max-w-[95vw] !w-[1300px] !p-0 overflow-hidden">
            <AdvancedModelBuilder
              onCancel={() => setBuilderOpen(false)}
              onSave={(model) => {
                const payload = {
                  name: model.name,
                  pair: model.pair,
                  timeframe: model.timeframe,
                  active: false,
                  model_meta: {
                    direction: model.direction,
                    logic: model.logic,
                    sl: model.sl,
                    tp1: model.tp1,
                    tp2: model.tp2,
                    tp3: model.tp3,
                    leverage: model.leverage,
                    auto_trade: model.autoTrade,
                    auto_threshold: model.autoThreshold,
                  },
                  min_quality_score: model.minQualityScore,
                  phase1_rules: model.phase1Rules,
                  phase2_rules: model.phase2Rules,
                  phase3_rules: model.phase3Rules,
                  phase4_rules: model.phase4Rules,
                };
                createModelM.mutate(payload, {
                  onSuccess: () => setBuilderOpen(false),
                });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
