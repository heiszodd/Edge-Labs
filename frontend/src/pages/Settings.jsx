import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { connectWalletManual, disconnectWallet, getWalletStatus, requestWalletChallenge, verifyWalletOwnership } from '../api/wallets';
import { generateTelegramLinkCode, getSettings, saveSettings } from '../api/users';
import { saveAlertSettings } from '../api/alerts';
import apiClient from '../api/client';
import TelegramLogin from '../components/common/TelegramLogin';
import { PageWrapper } from '../components/common/PageWrapper';

const CHAIN_META = [
  { key: 'hl', label: 'Hyperliquid', section: 'perps', kind: 'evm' },
  { key: 'sol', label: 'Solana', section: 'degen', kind: 'sol' },
  { key: 'poly', label: 'Polygon', section: 'predictions', kind: 'evm' },
];

function bytesToBase64(bytes) {
  let binary = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.byteLength; i += 1) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

export default function Settings() {
  const [manualAddress, setManualAddress] = useState({ hl: '', sol: '', poly: '' });
  const [presets, setPresets] = useState({ buy_preset_1: 25, buy_preset_2: 50, buy_preset_3: 100, buy_preset_4: 250 });
  const [alerts, setAlerts] = useState({ alert_telegram: true, alert_email: false, alert_web_push: false });
  const [statusMessage, setStatusMessage] = useState('');
  const [telegramMessage, setTelegramMessage] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const qc = useQueryClient();
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

  const statusQ = useQuery({ queryKey: ['wallets', 'status'], queryFn: getWalletStatus, staleTime: 30_000 });
  const settingsQ = useQuery({ queryKey: ['users', 'settings'], queryFn: getSettings, staleTime: 30_000 });
  const meQ = useQuery({ queryKey: ['auth', 'me'], queryFn: () => apiClient.get('/api/auth/me').then((r) => r.data), staleTime: 15_000 });

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

  const savePresetsM = useMutation({ mutationFn: saveSettings, onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'settings'] }) });
  const saveAlertsM = useMutation({ mutationFn: saveAlertSettings });
  const tgUnlinkM = useMutation({
    mutationFn: () => apiClient.post('/api/auth/telegram/disconnect').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });
  const tgLinkCodeM = useMutation({
    mutationFn: generateTelegramLinkCode,
    onSuccess: (data) => {
      const token = data?.token || '';
      setTelegramToken(token);
      if (botUsername && token) {
        window.open(`https://t.me/${botUsername}?start=${token}`, '_blank', 'noopener,noreferrer');
      }
      setTelegramMessage(token ? `Link token generated: ${token}` : 'Could not generate Telegram link token');
    },
    onError: (err) => setTelegramMessage(err?.response?.data?.detail || 'Could not generate Telegram link token'),
  });
  const manualConnectM = useMutation({
    mutationFn: ({ chain, address }) => connectWalletManual(chain, address),
    onSuccess: async (_, vars) => {
      setStatusMessage(`Connected ${vars.chain.toUpperCase()} wallet (unverified).`);
      setManualAddress((prev) => ({ ...prev, [vars.chain]: '' }));
      await qc.invalidateQueries({ queryKey: ['wallets', 'status'] });
    },
    onError: (err) => setStatusMessage(err?.response?.data?.detail || 'Manual wallet connect failed'),
  });
  const disconnectM = useMutation({
    mutationFn: disconnectWallet,
    onSuccess: async (_, chain) => {
      setStatusMessage(`Disconnected ${chain.toUpperCase()} wallet.`);
      await qc.invalidateQueries({ queryKey: ['wallets', 'status'] });
    },
    onError: (err) => setStatusMessage(err?.response?.data?.detail || 'Disconnect failed'),
  });

  const connectWithSignature = async (chainKind, chainKey) => {
    if (chainKind === 'sol') {
      const provider = window?.solana;
      if (!provider?.isPhantom && !provider?.connect) throw new Error('Phantom wallet not found');
      const conn = await provider.connect();
      const address = String(conn?.publicKey?.toString?.() || provider?.publicKey?.toString?.() || '');
      if (!address) throw new Error('Could not read Solana wallet address');
      const challenge = await requestWalletChallenge(chainKey, address, null);
      const encoded = new TextEncoder().encode(challenge.message);
      const signed = await provider.signMessage(encoded, 'utf8');
      const signature = bytesToBase64(signed.signature || signed);
      await verifyWalletOwnership({
        chain: chainKey,
        wallet_address: address,
        nonce: challenge.nonce,
        signature,
        signature_encoding: 'base64',
      });
      return address;
    }

    const eth = window?.ethereum;
    if (!eth?.request) throw new Error('EVM wallet not found');
    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    const address = String(accounts?.[0] || '');
    if (!address) throw new Error('Could not read wallet address');
    const chainHex = await eth.request({ method: 'eth_chainId' });
    const chainId = Number.parseInt(String(chainHex || '0x0'), 16) || null;
    const challenge = await requestWalletChallenge(chainKey, address, chainId);
    const signature = await eth.request({ method: 'personal_sign', params: [challenge.message, address] });
    await verifyWalletOwnership({
      chain: chainKey,
      wallet_address: address,
      nonce: challenge.nonce,
      signature,
      chain_id: chainId,
      signature_encoding: 'hex',
    });
    return address;
  };

  return (
    <PageWrapper className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="card space-y-3">
        <h2 className="font-semibold">Wallet Connections</h2>
        <p className="text-sm text-[var(--text-muted)]">Primary flow: connect provider and sign ownership. Manual address linking remains available as unverified fallback.</p>
        {statusMessage && <div className="badge badge-info">{statusMessage}</div>}
        <div className="grid md:grid-cols-3 gap-3">
          {CHAIN_META.map((item) => {
            const status = statusQ.data?.[item.section] || {};
            return (
              <div key={item.key} className="card !p-3 space-y-2">
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {status.connected ? `${status.full_address || status.address}` : 'Not connected'}
                </p>
                <p className={`text-xs ${status.verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {status.connected ? (status.verified ? 'Verified ownership' : 'Unverified manual link') : 'Disconnected'}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    className="btn-primary btn-sm"
                    onClick={async () => {
                      try {
                        const address = await connectWithSignature(item.kind, item.key);
                        setStatusMessage(`Connected and verified ${item.label}: ${address}`);
                        await qc.invalidateQueries({ queryKey: ['wallets', 'status'] });
                      } catch (err) {
                        setStatusMessage(err?.message || err?.response?.data?.detail || `Could not connect ${item.label}`);
                      }
                    }}
                  >
                    Connect Wallet
                  </button>
                  {status.connected && (
                    <button className="btn-danger btn-sm" onClick={() => disconnectM.mutate(item.key)} disabled={disconnectM.isPending}>
                      Disconnect
                    </button>
                  )}
                </div>
                <div className="space-y-2 pt-2 border-t border-[var(--line)]">
                  <p className="text-xs text-[var(--text-muted)]">Advanced fallback: manual address (unverified)</p>
                  <input
                    className="input input-sm"
                    value={manualAddress[item.key]}
                    onChange={(e) => setManualAddress((prev) => ({ ...prev, [item.key]: e.target.value }))}
                    placeholder={`Enter ${item.label} address`}
                  />
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => manualConnectM.mutate({ chain: item.key, address: manualAddress[item.key] })}
                    disabled={manualConnectM.isPending || !manualAddress[item.key]}
                  >
                    Save Unverified
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
        <div className="space-y-3">
          {!meQ.data?.telegram_linked && (
            <>
              <p className="text-sm text-[var(--text-muted)]">Authorize with Telegram login widget to verify ownership and receive alerts.</p>
              <TelegramLogin
                onSuccess={(data) => {
                  setTelegramMessage(`Connected to @${data?.telegram_username || 'telegram'}`);
                  qc.invalidateQueries({ queryKey: ['auth', 'me'] });
                }}
                onError={(msg) => setTelegramMessage(msg)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-secondary btn-sm" onClick={() => tgLinkCodeM.mutate()} disabled={tgLinkCodeM.isPending}>
                  {tgLinkCodeM.isPending ? 'Generating...' : 'Generate Telegram Link Token'}
                </button>
                {telegramToken && <span className="badge badge-info">Token: {telegramToken}</span>}
              </div>
              {!botUsername && (
                <p className="text-xs text-[var(--text-muted)]">
                  Widget unavailable. Use generated token with your bot integration or set <code>VITE_TELEGRAM_BOT_USERNAME</code>.
                </p>
              )}
            </>
          )}
          {meQ.data?.telegram_linked && (
            <button className="btn-danger" onClick={() => tgUnlinkM.mutate()} disabled={tgUnlinkM.isPending}>
              Disconnect Telegram
            </button>
          )}
          {telegramMessage && <div className="badge badge-info">{telegramMessage}</div>}
        </div>
      </div>
    </PageWrapper>
  );
}
