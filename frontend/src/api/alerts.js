import client, { unwrap } from './client';

export const saveAlertSettings = (payload) => client.put('/api/alerts/settings', payload).then(unwrap);

