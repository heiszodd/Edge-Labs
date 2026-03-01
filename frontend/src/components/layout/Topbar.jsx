import useAuth from '../../hooks/useAuth';

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  return (
    <header className="h-16 border-b border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur-md px-3 md:px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="btn-ghost btn-sm md:hidden px-2.5">☰</button>
        <div className="text-xs md:text-sm text-[var(--text-muted)]">Live workspace</div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-danger btn-sm hidden sm:inline-flex">Emergency Stop</button>
        <div className="text-xs md:text-sm text-[var(--text-primary)] max-w-28 md:max-w-none truncate">{user?.username || user?.email || 'Guest'}</div>
        <button className="btn-secondary btn-sm px-2.5 md:px-3" onClick={logout}>Logout</button>
      </div>
    </header>
  );
}
