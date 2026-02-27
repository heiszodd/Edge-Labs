import client, { unwrap } from './client';

export const getAccount = (refresh_secs = 7) => client.get('/api/perps/account', { params: { refresh_secs } }).then(unwrap);
export const getHealth = () => client.get('/api/perps/health').then(unwrap);
export const getPositions = (sync = true) => client.get('/api/perps/positions', { params: { sync } }).then(unwrap);
export const getOrders = (sync = true) => client.get('/api/perps/orders', { params: { sync } }).then(unwrap);
export const getHistory = (limit = 100, sync = true) => client.get('/api/perps/history', { params: { limit, sync } }).then(unwrap);
export const getDepositAddress = () => client.get('/api/perps/deposit').then(unwrap);
export const requestWithdraw = (payload) => client.post('/api/perps/withdraw', payload).then(unwrap);
export const getModels = () => client.get('/api/perps/models').then(unwrap);
export const toggleModel = (id, active) => client.post(`/api/perps/models/${id}/toggle`, { active }).then(unwrap);
export const createModel = (payload) => client.post('/api/perps/models', payload).then(unwrap);
export const runScanner = (payload = {}) => client.post('/api/perps/scanner/run', payload).then(unwrap);
export const getPending = () => client.get('/api/perps/pending').then(unwrap);
export const dismissSignal = (id) => client.post(`/api/perps/pending/${id}/dismiss`).then(unwrap);
export const getDemoBalance = () => client.get('/api/perps/demo').then(unwrap);
export const getDemoHistory = () => client.get('/api/perps/demo/history').then(unwrap);
export const depositDemo = (amount) => client.post('/api/perps/demo/deposit', { amount }).then(unwrap);
export const withdrawDemo = (amount) => client.post('/api/perps/demo/withdraw', { amount }).then(unwrap);
export const resetDemo = () => client.post('/api/perps/demo/reset').then(unwrap);
export const clearDemoLogs = () => client.post('/api/perps/demo/clear-logs').then(unwrap);
export const getRisk = () => client.get('/api/perps/risk').then(unwrap);
export const updateRisk = (payload) => client.put('/api/perps/risk', payload).then(unwrap);
export const getOHLCV = (pair, timeframe, limit = 100) =>
  client.get('/api/perps/ohlcv', { params: { pair, timeframe, limit } }).then(unwrap);
