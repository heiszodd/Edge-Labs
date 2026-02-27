import client, { unwrap } from './client';

export const getWalletStatus = () => client.get('/api/wallets/status').then(unwrap);
export const connectWallet = (chain, raw_key_or_seed, wallet_address = '') => client.post('/api/wallets/connect', { chain, raw_key_or_seed, wallet_address }).then(unwrap);
export const disconnectWallet = (chain) => client.delete(`/api/wallets/${chain}`).then(unwrap);
