import client, { unwrap } from './client';

export const scanContract = (address) => client.post('/api/degen/scan-contract', { address }).then(unwrap);
export const buyLive = (token_address, size_usd) => client.post('/api/degen/buy', { token_address, size_usd }).then(unwrap);
export const buyDemo = (token_address, size_usd) => client.post('/api/degen/demo-buy', { token_address, size_usd }).then(unwrap);
export const getModels = () => client.get('/api/degen/models').then(unwrap);
export const toggleModel = (id, active) => client.post(`/api/degen/models/${id}/toggle`, { active }).then(unwrap);
export const addWatchlist = (address, note = '') => client.post('/api/degen/watchlist', { address, note }).then(unwrap);
export const addBlacklist = (address, note = '') => client.post('/api/degen/blacklist', { address, note }).then(unwrap);
export const getDemo = () => client.get('/api/degen/demo').then(unwrap);
export const depositDemo = (amount) => client.post('/api/degen/demo/deposit', { amount }).then(unwrap);
export const resetDemo = () => client.post('/api/degen/demo/reset').then(unwrap);
export const runScanner = () => client.post('/api/degen/scanner/run').then(unwrap);

