import useAuth from '../../hooks/useAuth';

export default function Topbar() {
  const { user, logout } = useAuth();
  return (
    <header className="h-16 border-b border-zinc-700 bg-zinc-900 px-4 flex items-center justify-between">
      <div className="text-zinc-400">🔔 3 pending signals</div>
      <div className="flex items-center gap-3">
        <button className="btn bg-red-500 hover:bg-red-600">Emergency Stop</button>
        <div className="text-sm">{user?.username || user?.email || 'Guest'}</div>
        <button className="btn bg-zinc-700" onClick={logout}>Logout</button>
      </div>
    </header>
  );
}
