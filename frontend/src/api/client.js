import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const normalizeBaseUrl = (value) => {
  const raw = (value || '').trim();
  if (!raw) return 'http://localhost:8000';
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
  const host = raw.replace(/\/+$/, '');
  const isLocalHost = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)(:\d+)?$/i.test(host);
  return `${isLocalHost ? 'http' : 'https'}://${host}`;
};

const API = normalizeBaseUrl(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL);

const apiClient = axios.create({
  baseURL: API,
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
    console.debug(`[API] ${method} ${API}${path}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const method = (error?.config?.method || 'get').toUpperCase();
    const path = error?.config?.url || '';
    console.error(`[API ERROR] ${method} ${API}${path} -> ${status || 'NETWORK_ERROR'}`, error?.response?.data || error?.message);
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
