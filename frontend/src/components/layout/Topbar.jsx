import useAuth from '../../hooks/useAuth';

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  return (
    <header className="h-16 border-b border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-md px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="btn-ghost btn-sm md:hidden">Menu</button>
        <div className="text-sm text-[var(--text-muted)]">Live workspace</div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-danger btn-sm">Emergency Stop</button>
        <div className="text-sm text-[var(--text-primary)]">{user?.username || user?.email || 'Guest'}</div>
        <button className="btn-secondary btn-sm" onClick={logout}>Logout</button>
      </div>
    </header>
  );
}
