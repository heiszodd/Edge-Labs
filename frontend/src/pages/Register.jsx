import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    const result = await registerUser(form.email, form.password, form.username);
    if (!result.success) {
      setError(result.error);
      return;
    }

    const data = result.data || {};
    if (data.requires_email_verification) {
      setNotice(data.message || 'Check your email and verify your account, then sign in.');
      return;
    }
    const token = data.token || data.access_token;
    const user = data.user;
    if (token && user) {
      localStorage.setItem('auth_token', token);
      useAuthStore.getState().register(user, token);
      navigate('/dashboard');
      return;
    }
    setNotice('Account created. Please sign in.');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form className="card w-full max-w-md space-y-3" onSubmit={onSubmit}>
        <h2 className="text-xl font-semibold">Register</h2>
        <input className="input" placeholder="Email" onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" placeholder="Username" onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className="input" type="password" placeholder="Password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {notice && <p className="text-emerald-500 text-sm">{notice}</p>}
        <button className="btn w-full bg-violet-500 hover:bg-violet-600">Create account</button>
      </form>
    </div>
  );
}
