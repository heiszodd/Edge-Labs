import client, { unwrap } from './client';

export const getPending = () => client.get('/api/signals/pending').then(unwrap);
export const dismissSignal = (id) => client.post(`/api/signals/${id}/dismiss`).then(unwrap);
export const executeLive = (id) => client.post(`/api/signals/${id}/execute-live`).then(unwrap);
export const executeDemo = (id) => client.post(`/api/signals/${id}/execute-demo`).then(unwrap);

