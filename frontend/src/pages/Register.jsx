import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const { register } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    await register(form.email, form.username, form.password);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form className="card w-full max-w-md space-y-3" onSubmit={onSubmit}>
        <h2 className="text-xl font-semibold">Register</h2>
        <input className="input" placeholder="Email" onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" placeholder="Username" onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className="input" type="password" placeholder="Password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="btn w-full bg-violet-500 hover:bg-violet-600">Create account</button>
      </form>
    </div>
  );
}
