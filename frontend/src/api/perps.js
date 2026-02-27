import client, { unwrap } from './client';

export const getModels = () => client.get('/api/perps/models').then(unwrap);
export const toggleModel = (id, active) => client.post(`/api/perps/models/${id}/toggle`, { active }).then(unwrap);
export const createModel = (payload) => client.post('/api/perps/models', payload).then(unwrap);
export const runScanner = () => client.post('/api/perps/scanner/run').then(unwrap);
export const getPending = () => client.get('/api/perps/pending').then(unwrap);
export const dismissSignal = (id) => client.post(`/api/perps/pending/${id}/dismiss`).then(unwrap);
export const getDemoBalance = () => client.get('/api/perps/demo').then(unwrap);
export const depositDemo = (amount) => client.post('/api/perps/demo/deposit', { amount }).then(unwrap);
export const resetDemo = () => client.post('/api/perps/demo/reset').then(unwrap);
export const getRisk = () => client.get('/api/perps/risk').then(unwrap);
export const updateRisk = (payload) => client.put('/api/perps/risk', payload).then(unwrap);
export const getOHLCV = (pair, timeframe, limit = 100) =>
  client.get('/api/perps/ohlcv', { params: { pair, timeframe, limit } }).then(unwrap);

