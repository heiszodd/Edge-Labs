import client, { unwrap } from './client';

export const getWalletStatus = () => client.get('/api/wallets/status').then(unwrap);
export const connectWallet = (chain, raw_key_or_seed, wallet_address = '') => client.post('/api/wallets/connect', { chain, raw_key_or_seed, wallet_address }).then(unwrap);
export const connectWalletManual = (chain, wallet_address) => client.post('/api/wallets/connect', { chain, wallet_address, verified: false }).then(unwrap);
export const requestWalletChallenge = (chain, wallet_address, chain_id = null) =>
  client.post('/api/wallets/challenge', { chain, wallet_address, chain_id }).then(unwrap);
export const verifyWalletOwnership = (payload) => client.post('/api/wallets/verify', payload).then(unwrap);
export const disconnectWallet = (chain) => client.delete(`/api/wallets/${chain}`).then(unwrap);
