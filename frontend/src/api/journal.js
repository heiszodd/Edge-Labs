import client, { unwrap } from './client';

export const listEntries = () => client.get('/api/journal').then(unwrap);
export const createEntry = (payload) => client.post('/api/journal', payload).then(unwrap);
export const updateEntry = (id, payload) => client.put(`/api/journal/${id}`, payload).then(unwrap);
export const deleteEntry = (id) => client.delete(`/api/journal/${id}`).then(unwrap);

