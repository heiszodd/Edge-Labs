import client, { unwrap } from './client';

export const getSettings = () => client.get('/api/users/settings').then(unwrap);
export const saveSettings = (payload) => client.put('/api/users/settings', payload).then(unwrap);
export const getSubscription = () => client.get('/api/users/subscription').then(unwrap);

