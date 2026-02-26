import { create } from 'zustand';
import apiClient from '../api/client';

const subscriptionTiers = {
  free: [],
  pro: ['scanner', 'backtesting', 'liveTrading'],
  premium: ['scanner', 'backtesting', 'liveTrading', 'aiAnalysis', 'copySignals'],
};

const saved = JSON.parse(localStorage.getItem('edge-auth') || '{}');

export const useAuthStore = create((set, get) => ({
  user: saved.user || null,
  token: saved.token || null,
  tier: saved.tier || 'free',
  isAuthenticated: Boolean(saved.token),
  login: async (email, password) => {
    const { data } = await apiClient.post('/api/auth/login', { email, password });
    const user = data.user || { email };
    const token = data.access_token || data.token;
    const tier = (data.tier || user.tier || user.subscription_tier || 'free').toLowerCase();
    const payload = { user, token, tier };
    localStorage.setItem('edge-auth', JSON.stringify(payload));
    set({ ...payload, isAuthenticated: Boolean(token) });
    return data;
  },
  register: async (email, username, password) => {
    const { data } = await apiClient.post('/api/auth/register', { email, username, password });
    if (data?.requires_email_verification) {
      return data;
    }
    return get().login(email, password);
  },
  logout: () => {
    localStorage.removeItem('edge-auth');
    set({ user: null, token: null, tier: 'free', isAuthenticated: false });
  },
  refresh: async () => {
    if (!get().token) return;
    const { data } = await apiClient.get('/api/auth/me');
    const tier = (data.tier || 'free').toLowerCase();
    const payload = { user: data, token: get().token, tier };
    localStorage.setItem('edge-auth', JSON.stringify(payload));
    set({ ...payload, isAuthenticated: true });
  },
  hasFeature: (feature) => {
    const tier = get().tier || 'free';
    return (subscriptionTiers[tier] || []).includes(feature);
  },
}));

export { subscriptionTiers };
