import { create } from 'zustand';
import apiClient from '../api/client';

// Temporary frontend-only bypass. Set to false when backend auth is ready again.
const AUTH_BYPASS = true;
const BYPASS_USER = { id: 'frontend-dev', email: 'dev@local', username: 'Frontend Dev', subscription_tier: 'premium' };
const BYPASS_TOKEN = 'dev-bypass-token';

const subscriptionTiers = {
  free: [],
  pro: ['scanner', 'backtesting', 'liveTrading'],
  premium: ['scanner', 'backtesting', 'liveTrading', 'aiAnalysis', 'copySignals'],
};

const saved = JSON.parse(localStorage.getItem('edge-auth') || '{}');
const initialUser = AUTH_BYPASS ? (saved.user || BYPASS_USER) : (saved.user || null);
const initialToken = AUTH_BYPASS ? (saved.token || BYPASS_TOKEN) : (saved.token || null);
const initialTier = AUTH_BYPASS ? ((saved.tier || 'premium').toLowerCase()) : ((saved.tier || 'free').toLowerCase());

export const useAuthStore = create((set, get) => ({
  user: initialUser,
  token: initialToken,
  tier: initialTier,
  isAuthenticated: AUTH_BYPASS ? true : Boolean(saved.token),
  login: async (email, password) => {
    if (AUTH_BYPASS) {
      const user = { ...BYPASS_USER, email: email || BYPASS_USER.email };
      const payload = { user, token: BYPASS_TOKEN, tier: 'premium' };
      localStorage.setItem('edge-auth', JSON.stringify(payload));
      set({ ...payload, isAuthenticated: true });
      return { user, access_token: BYPASS_TOKEN, tier: 'premium', bypass: true };
    }
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
    if (AUTH_BYPASS) {
      return get().login(email, password);
    }
    const { data } = await apiClient.post('/api/auth/register', { email, username, password });
    if (data?.requires_email_verification) {
      return data;
    }
    return get().login(email, password);
  },
  logout: () => {
    if (AUTH_BYPASS) {
      const payload = { user: BYPASS_USER, token: BYPASS_TOKEN, tier: 'premium' };
      localStorage.setItem('edge-auth', JSON.stringify(payload));
      set({ ...payload, isAuthenticated: true });
      return;
    }
    localStorage.removeItem('edge-auth');
    set({ user: null, token: null, tier: 'free', isAuthenticated: false });
  },
  refresh: async () => {
    if (AUTH_BYPASS) {
      return;
    }
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
