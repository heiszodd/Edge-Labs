import { create } from 'zustand';
import apiClient from '../api/client';

const AUTH_TIMEOUT_MS = 45000;

const subscriptionTiers = {
  free: [],
  pro: ['scanner', 'backtesting', 'liveTrading'],
  premium: ['scanner', 'backtesting', 'liveTrading', 'aiAnalysis', 'copySignals'],
};

const saved = JSON.parse(localStorage.getItem('edge-auth') || '{}');
const persistedToken = localStorage.getItem('auth_token') || saved.token || null;
const initialUser = saved.user || null;
const initialTier = (saved.tier || saved.user?.subscription_tier || 'free').toLowerCase();

const persist = (payload) => {
  if (payload?.token) localStorage.setItem('auth_token', payload.token);
  localStorage.setItem('edge-auth', JSON.stringify(payload));
};

const clearPersistedAuth = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('edge-auth');
};

const isTimeoutError = (error) =>
  error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message || ''));

const requestAuth = async (path, payload) => {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await apiClient.post(path, payload, { timeout: AUTH_TIMEOUT_MS });
    } catch (error) {
      lastError = error;
      if (!isTimeoutError(error) || attempt > 0) break;
    }
  }
  throw lastError;
};

export const useAuthStore = create((set, get) => ({
  user: initialUser,
  token: persistedToken,
  tier: initialTier,
  isAuthenticated: Boolean(persistedToken),
  initializeAuth: async () => {
    const token = localStorage.getItem('auth_token') || get().token;
    if (!token) return;
    try {
      const { data } = await apiClient.get('/api/auth/me', { timeout: AUTH_TIMEOUT_MS });
      const user = data || {};
      const tier = (user.tier || user.subscription_tier || 'free').toLowerCase();
      const payload = { user, token, tier };
      persist(payload);
      set({ ...payload, isAuthenticated: true });
    } catch {
      clearPersistedAuth();
      set({ user: null, token: null, tier: 'free', isAuthenticated: false });
    }
  },
  login: async (email, password) => {
    const { data } = await requestAuth('/api/auth/login', { email, password });
    const user = data.user || { email };
    const token = data.access_token || data.token;
    const tier = (data.tier || user.tier || user.subscription_tier || 'free').toLowerCase();
    const payload = { user, token, tier };
    persist(payload);
    set({ ...payload, isAuthenticated: Boolean(token) });
    return data;
  },
  register: async (email, username, password) => {
    const { data } = await requestAuth('/api/auth/register', { email, username, password });
    if (data?.requires_email_verification) {
      return data;
    }
    if (data?.token || data?.access_token) {
      const user = data.user || { email };
      const token = data.access_token || data.token;
      const tier = (data.tier || user.tier || user.subscription_tier || 'free').toLowerCase();
      const payload = { user, token, tier };
      persist(payload);
      set({ ...payload, isAuthenticated: true });
      return data;
    }
    return get().login(email, password);
  },
  logout: () => {
    clearPersistedAuth();
    set({ user: null, token: null, tier: 'free', isAuthenticated: false });
  },
  refresh: async () => {
    if (!get().token) return;
    const { data } = await apiClient.get('/api/auth/me', { timeout: AUTH_TIMEOUT_MS });
    const tier = (data.tier || data.subscription_tier || 'free').toLowerCase();
    const payload = { user: data, token: get().token, tier };
    persist(payload);
    set({ ...payload, isAuthenticated: true });
  },
  hasFeature: (feature) => {
    const tier = get().tier || 'free';
    return (subscriptionTiers[tier] || []).includes(feature);
  },
}));

export { subscriptionTiers };
