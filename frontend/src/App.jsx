import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import useAuth from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import Analytics from './pages/Analytics';
import Backtesting from './pages/Backtesting';
import Dashboard from './pages/Dashboard';
import Degen from './pages/Degen';
import Journal from './pages/Journal';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Perps from './pages/Perps';
import Predictions from './pages/Predictions';
import Profile from './pages/Profile';
import Register from './pages/Register';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';

function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card text-center">
        <h1 className="text-3xl font-bold mb-2">404</h1>
        <p className="text-[var(--text-muted)] mb-4">Page not found</p>
        <a href="/" className="btn-primary">Go Home</a>
      </div>
    </div>
  );
}

export default function App() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/"
        element={(
          <Protected>
            <Layout />
          </Protected>
        )}
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="perps" element={<Perps />} />
        <Route path="degen" element={<Degen />} />
        <Route path="predictions" element={<Predictions />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="backtesting" element={<Backtesting />} />
        <Route path="journal" element={<Journal />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="subscription" element={<Subscription />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
