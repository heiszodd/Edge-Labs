import { useAuthStore } from '../store/authStore';

export default function useAuth() {
  const { user, tier, login, logout, isAuthenticated, hasFeature, register } = useAuthStore();
  return { user, tier, login, logout, isAuthenticated, hasFeature, register };
}
