import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteAccount, getProfile, requestPasswordReset, updateProfile } from '../api/users';

export default function Profile() {
  const qc = useQueryClient();
  const profileQ = useQuery({ queryKey: ['users', 'profile'], queryFn: getProfile, staleTime: 20_000 });
  const [username, setUsername] = useState('');
  const [telegram, setTelegram] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const saveM = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'profile'] }),
  });
  const resetM = useMutation({
    mutationFn: requestPasswordReset,
  });
  const deleteM = useMutation({ mutationFn: () => deleteAccount(confirmText) });

  const data = profileQ.data || {};
  const wallets = data.wallets || {};

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <div className="card space-y-3">
        <p className="text-sm text-[var(--text-muted)]">Email: {data.email || '-'}</p>
        <div className="grid md:grid-cols-2 gap-3">
          <input className="input" placeholder={data.username || 'Username'} value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className="input" placeholder={data.telegram_handle || 'Telegram handle'} value={telegram} onChange={(e) => setTelegram(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={() => saveM.mutate({ username: username || undefined, telegram_handle: telegram || undefined })} disabled={saveM.isPending}>
          Save Profile
        </button>
      </div>
      <div className="card space-y-2">
        <h2 className="font-semibold">Connected Wallets</h2>
        <p className="text-sm text-[var(--text-muted)]">Hyperliquid: {wallets.hyperliquid?.connected ? wallets.hyperliquid.address : 'Not connected'}</p>
        <p className="text-sm text-[var(--text-muted)]">Solana: {wallets.solana?.connected ? wallets.solana.address : 'Not connected'}</p>
        <p className="text-sm text-[var(--text-muted)]">Polygon: {wallets.polygon?.connected ? wallets.polygon.address : 'Not connected'}</p>
      </div>
      <div className="card space-y-2">
        <h2 className="font-semibold">Password Reset</h2>
        <button className="btn-secondary" onClick={() => resetM.mutate(data.email)} disabled={resetM.isPending || !data.email}>Send Reset</button>
      </div>
      <div className="card space-y-2">
        <h2 className="font-semibold text-danger">Delete Account</h2>
        <p className="text-xs text-[var(--text-muted)]">Type DELETE to confirm</p>
        <input className="input max-w-60" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        <button className="btn-danger" onClick={() => deleteM.mutate()} disabled={deleteM.isPending || confirmText !== 'DELETE'}>Delete</button>
      </div>
    </div>
  );
}
