import { create } from 'zustand';
import client from '../api/client';

const subscriptionTiers = {
  free: [],
  pro: ['scanner', 'backtesting', 'liveTrading'],
  premium: ['scanner', 'backtesting', 'liveTrading', 'aiAnalysis', 'copySignals'],
};

const saved = JSON.parse(localStorage.getItem('edge-auth') || '{}');

const persistAuth = (user, token, tier) => {
  if (token) localStorage.setItem('auth_token', token);
  localStorage.setItem('edge-auth', JSON.stringify({ user, token, tier }));
};

const clearPersistedAuth = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('edge-auth');
};

export const useAuthStore = create((set, get) => ({
  user: saved.user || null,
  token: localStorage.getItem('auth_token') || saved.token || null,
  tier: (saved.tier || saved.user?.subscription_tier || 'free').toLowerCase(),
  isAuthenticated: Boolean(localStorage.getItem('auth_token') || saved.token),

  initializeAuth: async () => {
    const token = localStorage.getItem('auth_token') || get().token;
    if (!token) return;
    try {
      const { data } = await client.get('/api/auth/me');
      const tier = (data?.tier || data?.subscription_tier || 'free').toLowerCase();
      persistAuth(data, token, tier);
      set({ user: data, token, tier, isAuthenticated: true });
    } catch {
      clearPersistedAuth();
      set({ user: null, token: null, tier: 'free', isAuthenticated: false });
    }
  },

  login: (user, token) => {
    const tier = (user?.tier || user?.subscription_tier || 'free').toLowerCase();
    persistAuth(user, token, tier);
    set({ user, token, tier, isAuthenticated: Boolean(token) });
  },

  register: (user, token) => {
    const tier = (user?.tier || user?.subscription_tier || 'free').toLowerCase();
    persistAuth(user, token, tier);
    set({ user, token, tier, isAuthenticated: Boolean(token) });
  },

  logout: () => {
    clearPersistedAuth();
    set({ user: null, token: null, tier: 'free', isAuthenticated: false });
  },

  refresh: async () => {
    const token = localStorage.getItem('auth_token') || get().token;
    if (!token) return;
    const { data } = await client.get('/api/auth/me');
    const tier = (data?.tier || data?.subscription_tier || 'free').toLowerCase();
    persistAuth(data, token, tier);
    set({ user: data, token, tier, isAuthenticated: true });
  },

  hasFeature: (feature) => {
    const tier = get().tier || 'free';
    return (subscriptionTiers[tier] || []).includes(feature);
  },
}));

export { subscriptionTiers };
