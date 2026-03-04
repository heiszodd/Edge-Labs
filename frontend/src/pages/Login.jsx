import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await loginUser(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    const { token, user } = result.data || {};
    localStorage.setItem('auth_token', token);
    useAuthStore.getState().login(user, token);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form className="card w-full max-w-md space-y-3" onSubmit={handleSubmit}>
        <h2 className="text-xl font-semibold">Login</h2>
        <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="btn w-full bg-violet-500 hover:bg-violet-600" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <Link to="/register" className="text-zinc-400 text-sm block">Need an account? Register</Link>
      </form>
    </div>
  );
}
