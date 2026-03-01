import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const result = await register(form.email, form.username, form.password);
      if (result?.requires_email_verification) {
        setNotice(result.message || 'Check your email and verify your account, then sign in.');
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Could not create account');
    }
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
