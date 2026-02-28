import client, { unwrap } from './client';

export const getScanner = (params = {}) => client.get('/api/predictions/scanner', { params }).then(unwrap);
export const getWallet = () => client.get('/api/predictions/wallet').then(unwrap);
export const getTrades = () => client.get('/api/predictions/trades').then(unwrap);
export const getModels = () => client.get('/api/predictions/models').then(unwrap);
export const toggleModel = (id, active) => client.post(`/api/predictions/models/${id}/toggle`, { active }).then(unwrap);
export const buyYesNo = (market_id, size_usd, side = 'yes', mode = 'live', confirm = true, entry_price = null, question = null) =>
  client.post('/api/predictions/trade', { market_id, size_usd, side, mode, confirm, entry_price, question }).then(unwrap);
export const demoTrade = (market_id, size_usd, side = 'yes', entry_price = null, question = null) =>
  client.post('/api/predictions/demo-trade', { market_id, size_usd, side, entry_price, question }).then(unwrap);
export const getDemo = () => client.get('/api/predictions/demo').then(unwrap);
export const depositDemo = (amount) => client.post('/api/predictions/demo/deposit', { amount }).then(unwrap);
export const withdrawDemo = (amount) => client.post('/api/predictions/demo/withdraw', { amount }).then(unwrap);
export const resetDemo = () => client.post('/api/predictions/demo/reset').then(unwrap);
