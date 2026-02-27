import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { connectWallet, getWalletStatus } from '../api/wallets';
import { generateTelegramLinkCode, getSettings, saveSettings, unlinkTelegram } from '../api/users';
import { saveAlertSettings } from '../api/alerts';
import apiClient from '../api/client';

export default function Settings() {
  const [wallet, setWallet] = useState({ chain: 'hl', raw_key_or_seed: '', wallet_address: '' });
  const [presets, setPresets] = useState({ buy_preset_1: 25, buy_preset_2: 50, buy_preset_3: 100, buy_preset_4: 250 });
  const [alerts, setAlerts] = useState({ alert_telegram: true, alert_email: false, alert_web_push: false });
  const qc = useQueryClient();

  const statusQ = useQuery({ queryKey: ['wallets', 'status'], queryFn: getWalletStatus, staleTime: 30_000 });
  const settingsQ = useQuery({
    queryKey: ['users', 'settings'],
    queryFn: getSettings,
    staleTime: 30_000,
  });
  const meQ = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiClient.get('/api/auth/me').then((r) => r.data),
    staleTime: 15_000,
  });

  useEffect(() => {
    const data = settingsQ.data;
    if (!data) return;
    setPresets((prev) => ({
      ...prev,
      buy_preset_1: Number(data.buy_preset_1 ?? prev.buy_preset_1),
      buy_preset_2: Number(data.buy_preset_2 ?? prev.buy_preset_2),
      buy_preset_3: Number(data.buy_preset_3 ?? prev.buy_preset_3),
      buy_preset_4: Number(data.buy_preset_4 ?? prev.buy_preset_4),
    }));
    setAlerts((prev) => ({
      ...prev,
      alert_telegram: Boolean(data.alert_telegram),
      alert_email: Boolean(data.alert_email),
      alert_web_push: Boolean(data.alert_web_push),
    }));
  }, [settingsQ.data]);

  const connectM = useMutation({
    mutationFn: (payload) => connectWallet(payload.chain, payload.raw_key_or_seed, payload.wallet_address),
    onSuccess: () => {
      setWallet((prev) => ({ ...prev, raw_key_or_seed: '' }));
      qc.invalidateQueries({ queryKey: ['wallets', 'status'] });
    },
  });
  const savePresetsM = useMutation({ mutationFn: saveSettings, onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'settings'] }) });
  const saveAlertsM = useMutation({ mutationFn: saveAlertSettings });
  const tgLinkM = useMutation({
    mutationFn: generateTelegramLinkCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });
  const tgUnlinkM = useMutation({
    mutationFn: unlinkTelegram,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="card space-y-3">
        <h2 className="font-semibold">Connect Wallet</h2>
        <div className="grid md:grid-cols-4 gap-2">
          <select className="input" value={wallet.chain} onChange={(e) => setWallet((p) => ({ ...p, chain: e.target.value }))}>
            <option value="hl">Hyperliquid</option>
            <option value="sol">Solana</option>
            <option value="poly">Polygon</option>
          </select>
          <input className="input" value={wallet.wallet_address} onChange={(e) => setWallet((p) => ({ ...p, wallet_address: e.target.value }))} placeholder="Wallet address (recommended)" />
          <input className="input md:col-span-2" value={wallet.raw_key_or_seed} onChange={(e) => setWallet((p) => ({ ...p, raw_key_or_seed: e.target.value }))} placeholder="Private key or seed (optional for read-only)" />
          <button className="btn-primary" onClick={() => connectM.mutate(wallet)} disabled={connectM.isPending || (!wallet.raw_key_or_seed && !wallet.wallet_address)}>
            {connectM.isPending ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
        <pre className="text-xs bg-[var(--bg-secondary)] p-3 rounded-2xl overflow-auto">{JSON.stringify(statusQ.data || {}, null, 2)}</pre>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Buy Presets</h2>
        <div className="grid md:grid-cols-4 gap-2">
          {Object.keys(presets).map((k) => (
            <input key={k} className="input" type="number" value={presets[k]} onChange={(e) => setPresets((p) => ({ ...p, [k]: Number(e.target.value || 0) }))} />
          ))}
        </div>
        <button className="btn-primary" onClick={() => savePresetsM.mutate(presets)} disabled={savePresetsM.isPending}>
          {savePresetsM.isPending ? 'Saving...' : 'Save Presets'}
        </button>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Alert Settings</h2>
        <div className="flex gap-4 flex-wrap">
          {Object.keys(alerts).map((k) => (
            <label key={k} className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(alerts[k])} onChange={(e) => setAlerts((p) => ({ ...p, [k]: e.target.checked }))} />
              {k}
            </label>
          ))}
        </div>
        <button className="btn-primary" onClick={() => saveAlertsM.mutate(alerts)} disabled={saveAlertsM.isPending}>
          {saveAlertsM.isPending ? 'Saving...' : 'Save Alert Settings'}
        </button>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Telegram Linking</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Status: {meQ.data?.telegram_linked ? 'Linked' : 'Not Linked'}
          {meQ.data?.telegram_username ? ` (@${meQ.data.telegram_username})` : ''}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          1) Generate code 2) Send code to the Telegram bot 3) Bot verifies and links your account. Codes expire in 10 minutes.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => tgLinkM.mutate()} disabled={tgLinkM.isPending}>
            {tgLinkM.isPending ? 'Generating...' : 'Generate Verification Code'}
          </button>
          <button className="btn-danger" onClick={() => tgUnlinkM.mutate()} disabled={tgUnlinkM.isPending || !meQ.data?.telegram_linked}>
            Unlink Telegram
          </button>
        </div>
        {tgLinkM.data?.token && <div className="badge badge-info">Verification Code: {tgLinkM.data.token}</div>}
      </div>
    </div>
  );
}
