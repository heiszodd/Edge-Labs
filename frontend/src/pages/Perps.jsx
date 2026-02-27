import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CandlestickChart from '../components/charts/CandlestickChart';
import ModelCard from '../components/models/ModelCard';
import AdvancedModelBuilder from '../components/models/AdvancedModelBuilder';
import SignalCard from '../components/signals/SignalCard';
import TierGuard from '../components/common/TierGuard';
import {
  createModel,
  depositDemo,
  getDemoBalance,
  getModels,
  getPending,
  getRisk,
  resetDemo,
  runScanner,
  updateRisk,
} from '../api/perps';
import { executeDemo, executeLive } from '../api/signals';

const tabs = ['Overview', 'Scanner', 'Models', 'Pending', 'Demo', 'Risk'];

export default function Perps() {
  const [tab, setTab] = useState('Overview');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [newModel, setNewModel] = useState({ name: '', pair: 'BTCUSDT', timeframe: '1h' });
  const [demoAmount, setDemoAmount] = useState(500);
  const [riskForm, setRiskForm] = useState({
    max_risk_pct: 1,
    daily_loss_limit: 200,
    max_positions: 5,
    max_leverage: 10,
    max_daily_trades: 10,
  });
  const qc = useQueryClient();

  const modelsQ = useQuery({ queryKey: ['perps', 'models'], queryFn: getModels, staleTime: 30_000 });
  const pendingQ = useQuery({ queryKey: ['perps', 'pending'], queryFn: getPending, staleTime: 30_000, refetchOnWindowFocus: true });
  const demoQ = useQuery({ queryKey: ['perps', 'demo'], queryFn: getDemoBalance, staleTime: 30_000 });
  const riskQ = useQuery({ queryKey: ['perps', 'risk'], queryFn: getRisk, staleTime: 30_000 });

  useEffect(() => {
    if (riskQ.data) setRiskForm((prev) => ({ ...prev, ...riskQ.data }));
  }, [riskQ.data]);

  const scannerM = useMutation({
    mutationFn: runScanner,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'pending'] }),
  });
  const createModelM = useMutation({
    mutationFn: createModel,
    onSuccess: () => {
      setNewModel({ name: '', pair: 'BTCUSDT', timeframe: '1h' });
      qc.invalidateQueries({ queryKey: ['perps', 'models'] });
    },
  });
  const depositM = useMutation({
    mutationFn: depositDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'demo'] }),
  });
  const resetM = useMutation({
    mutationFn: resetDemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'demo'] }),
  });
  const saveRiskM = useMutation({
    mutationFn: updateRisk,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'risk'] }),
  });
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
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card-glass">
            <p className="text-sm text-[var(--text-muted)]">Account</p>
            <p className="text-lg font-semibold">Demo + Live monitor</p>
          </div>
          <CandlestickChart />
        </div>
      )}

      {tab === 'Scanner' && (
        <TierGuard tier="pro">
          <div className="card space-y-3">
            <button className="btn-primary" onClick={() => scannerM.mutate()} disabled={scannerM.isPending}>
              {scannerM.isPending ? 'Running...' : 'Run Scanner'}
            </button>
            <p className="text-sm text-[var(--text-muted)]">Triggers perps scanner queue and refreshes pending signals.</p>
          </div>
        </TierGuard>
      )}

      {tab === 'Models' && (
        <div className="space-y-4">
          <div className="card grid md:grid-cols-4 gap-2">
            <input className="input" placeholder="Model name" value={newModel.name} onChange={(e) => setNewModel((p) => ({ ...p, name: e.target.value }))} />
            <input className="input" placeholder="Pair" value={newModel.pair} onChange={(e) => setNewModel((p) => ({ ...p, pair: e.target.value.toUpperCase() }))} />
            <input className="input" placeholder="Timeframe" value={newModel.timeframe} onChange={(e) => setNewModel((p) => ({ ...p, timeframe: e.target.value }))} />
            <button
              className="btn-primary"
              disabled={createModelM.isPending || !newModel.name}
              onClick={() => createModelM.mutate({ ...newModel, active: false })}
            >
              {createModelM.isPending ? 'Saving...' : 'Save Model'}
            </button>
          </div>
          <div className="card flex items-center justify-between">
            <p className="text-sm text-[var(--text-muted)]">Need multi-phase rule design and parameterized strategies?</p>
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
          <div className="flex gap-2">
            <input className="input max-w-40" type="number" value={demoAmount} onChange={(e) => setDemoAmount(Number(e.target.value || 0))} />
            <button className="btn-success" onClick={() => depositM.mutate(Number(demoAmount))} disabled={depositM.isPending}>Deposit</button>
            <button className="btn-danger" onClick={() => resetM.mutate()} disabled={resetM.isPending}>Reset</button>
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
