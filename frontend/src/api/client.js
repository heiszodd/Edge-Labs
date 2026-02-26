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

const apiClient = axios.create({
  baseURL: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL),
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export default apiClient;
