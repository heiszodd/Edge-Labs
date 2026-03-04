import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const isLocalHost = (host) =>
  /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)(:\d+)?$/i.test(String(host || '').trim());

const normalizeBaseUrl = (value) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
  const host = raw.replace(/\/+$/, '');
  return `${isLocalHost(host) ? 'http' : 'https'}://${host}`;
};

const resolveApiBase = () => {
  const envValue = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
  const normalized = normalizeBaseUrl(envValue);
  if (!normalized) return '';
  if (typeof window === 'undefined') return normalized;

  const appHost = window.location.host || '';
  let apiHost = '';
  try {
    apiHost = new URL(normalized).host;
  } catch {
    return '';
  }

  // Avoid hard-failing deployed apps when envs still point to localhost.
  if (!isLocalHost(appHost) && isLocalHost(apiHost)) {
    console.warn(`[API] Ignoring local API URL (${normalized}) on non-local app host (${appHost}); using same-origin /api.`);
    return '';
  }
  return normalized;
};

const API = resolveApiBase();

const apiClient = axios.create({
  baseURL: API || undefined,
  timeout: 15000,
});

export const unwrap = (response) => response?.data?.data ?? response?.data;

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token') || useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (import.meta.env.DEV) {
    const method = (config.method || 'get').toUpperCase();
    const path = config.url || '';
    const targetBase = config.baseURL || (typeof window !== 'undefined' ? window.location.origin : '');
    console.debug(`[API] ${method} ${targetBase}${path}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const method = (error?.config?.method || 'get').toUpperCase();
    const path = error?.config?.url || '';
    const targetBase = error?.config?.baseURL || API || (typeof window !== 'undefined' ? window.location.origin : '');
    console.error(`[API ERROR] ${method} ${targetBase}${path} -> ${status || 'NETWORK_ERROR'}`, error?.response?.data || error?.message);

    const originalConfig = error?.config || {};
    const isNetworkError = !error?.response;
    const isApiPath = typeof originalConfig.url === 'string' && originalConfig.url.startsWith('/api/');
    const canRetrySameOrigin =
      isNetworkError &&
      !originalConfig.__sameOriginRetry &&
      typeof originalConfig.baseURL === 'string' &&
      /^https?:\/\//i.test(originalConfig.baseURL) &&
      typeof window !== 'undefined';

    // If direct backend call fails at browser network layer (CORS/TLS/etc),
    // retry once through same-origin /api (for hosting-platform rewrites/proxies).
    if (canRetrySameOrigin && isApiPath) {
      const retryConfig = {
        ...originalConfig,
        baseURL: undefined,
        __sameOriginRetry: true,
      };
      return apiClient.request(retryConfig);
    }

    if (error?.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('edge-auth');
      useAuthStore.getState().logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
