import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || 'Invalid credentials';
      if (/network error/i.test(String(message))) {
        const apiBase = err?.config?.baseURL || window.location.origin;
        setError(`Cannot reach auth API (${apiBase}). Check frontend API URL and backend CORS/deployment.`);
        return;
      }
      setError(/timeout/i.test(String(message)) ? 'Sign-in timed out. Please try again in a moment.' : message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form className="card w-full max-w-md space-y-3" onSubmit={onSubmit}>
        <h2 className="text-xl font-semibold">Login</h2>
        <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="btn w-full bg-violet-500 hover:bg-violet-600">Sign in</button>
        <Link to="/register" className="text-zinc-400 text-sm block">Need an account? Register</Link>
      </form>
    </div>
  );
}
