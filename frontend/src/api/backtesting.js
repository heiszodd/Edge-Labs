import client, { unwrap } from './client';

export const runBacktest = (payload) => client.post('/api/backtest/run', payload).then(unwrap);
export const getBacktestRun = (runId) => client.get(`/api/backtest/${runId}`).then(unwrap);
export const getBacktestHistory = () => client.get('/api/backtest/history').then(unwrap);

