import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import ThemeToggle from '../common/ThemeToggle';

const NAV = [
  { href: '/dashboard', icon: 'O', label: 'Overview' },
  { href: '/perps', icon: 'P', label: 'Perps' },
  { href: '/degen', icon: 'D', label: 'Degen' },
  { href: '/predictions', icon: 'R', label: 'Predictions' },
  { href: '/backtesting', icon: 'B', label: 'Backtest' },
  { href: '/analytics', icon: 'A', label: 'Analytics' },
  { href: '/profile', icon: 'U', label: 'Profile' },
  { href: '/settings', icon: 'S', label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle, onNavigate }) {
  const loc = useLocation();
  const user = useAuthStore((s) => s.user);
  const tier = useAuthStore((s) => s.tier);

  const tierColor = {
    free: 'bg-warm-500/20 text-warm-400',
    pro: 'bg-signal-500/20 text-signal-400',
    premium: 'bg-amber-500/20 text-amber-400',
  }[tier] || '';

  return (
    <div className="flex flex-col h-full px-3 py-5 gap-2">
      <div className={`flex items-center mb-4 px-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && <span className="font-semibold text-sm text-[var(--text-primary)]">TradeIntel</span>}
        <button onClick={onToggle} className="btn-ghost p-1.5 rounded-xl text-xs">
          {collapsed ? '>' : '<'}
        </button>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map((item) => {
          const active = loc.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => onNavigate?.()}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 ${collapsed ? 'justify-center' : ''} ${active ? 'bg-signal-500/10 text-signal-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}`}
              title={collapsed ? item.label : ''}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="mt-auto">
          <div className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-signal-500/20 flex items-center justify-center text-sm font-semibold text-signal-400">
              {user?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">{user?.username || user?.email}</p>
              <span className={`badge text-[10px] px-1.5 py-0.5 ${tierColor}`}>{tier}</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
