import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import './index.css';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Perps from './pages/Perps';
import Degen from './pages/Degen';
import Predictions from './pages/Predictions';
import Subscription from './pages/Subscription';
import Analytics from './pages/Analytics';
import Journal from './pages/Journal';
import Backtesting from './pages/Backtesting';
import useAuth from './hooks/useAuth';
import { useAuthStore } from './store/authStore';

const queryClient = new QueryClient();

function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <Routes>
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
        <Route index element={<Dashboard />} />
        <Route path="perps" element={<Perps />} />
        <Route path="degen" element={<Degen />} />
        <Route path="predictions" element={<Predictions />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="backtesting" element={<Backtesting />} />
        <Route path="journal" element={<Journal />} />
        <Route path="settings" element={<Settings />} />
        <Route path="subscription" element={<Subscription />} />
      </Route>
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
