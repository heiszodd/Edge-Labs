import client, { unwrap } from './client';

export const createCheckout = (tier, interval) => client.post('/api/payments/create-checkout', { tier, interval }).then(unwrap);
export const cancelSubscription = () => client.post('/api/payments/cancel').then(unwrap);
export const getPaymentStatus = () => client.get('/api/payments/status').then(unwrap);

