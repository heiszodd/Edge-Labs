import client, { unwrap } from './client';

export const getSettings = () => client.get('/api/users/settings').then(unwrap);
export const saveSettings = (payload) => client.put('/api/users/settings', payload).then(unwrap);
export const getSubscription = () => client.get('/api/users/subscription').then(unwrap);
export const getProfile = () => client.get('/api/users/profile').then(unwrap);
export const updateProfile = (payload) => client.put('/api/users/profile', payload).then(unwrap);
export const requestPasswordReset = (email) => client.post('/api/users/password-reset', { email }).then(unwrap);
export const deleteAccount = (confirm_text = 'DELETE') => client.delete('/api/users/account', { data: { confirm_text } }).then(unwrap);
export const generateTelegramLinkCode = () => client.post('/api/auth/telegram-link').then((r) => r.data);
export const unlinkTelegram = () => client.post('/api/auth/telegram-unlink').then((r) => r.data);
