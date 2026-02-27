import client, { unwrap } from './client';

export const getScanner = () => client.get('/api/predictions/scanner').then(unwrap);
export const getModels = () => client.get('/api/predictions/models').then(unwrap);
export const toggleModel = (id, active) => client.post(`/api/predictions/models/${id}/toggle`, { active }).then(unwrap);
export const buyYesNo = (market_id, size_usd) => client.post('/api/predictions/trade', { market_id, size_usd }).then(unwrap);
export const demoTrade = (market_id, size_usd) => client.post('/api/predictions/demo-trade', { market_id, size_usd }).then(unwrap);
export const getDemo = () => client.get('/api/predictions/demo').then(unwrap);
export const depositDemo = (amount) => client.post('/api/predictions/demo/deposit', { amount }).then(unwrap);
export const resetDemo = () => client.post('/api/predictions/demo/reset').then(unwrap);

