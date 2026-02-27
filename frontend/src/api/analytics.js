import client, { unwrap } from './client';

export const getPerformance = (section = 'all', period = '30d') =>
  client.get('/api/analytics/performance', { params: { section, period } }).then(unwrap);
export const getTradeHistory = () => client.get('/api/analytics/trade-history').then(unwrap);
export const generateAiInsights = (payload) => client.post('/api/analytics/ai-insights', payload).then(unwrap);
export const getAiInsights = () => client.get('/api/analytics/ai-insights').then(unwrap);

