import { Link, useLocation } from 'react-router-dom';
import TelegramLink from '../common/TelegramLink';
import useAuth from '../../hooks/useAuth';

const nav = [
  ['/', 'Home'],
  ['/perps', 'Perps'],
  ['/degen', 'Degen'],
  ['/predictions', 'Predictions'],
  ['/analytics', 'Analytics'],
  ['/backtesting', 'Backtesting'],
  ['/journal', 'Journal'],
  ['/settings', 'Settings'],
  ['/subscription', 'Subscription'],
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const { tier } = useAuth();

  return (
    <aside className="hidden md:flex w-64 border-r border-zinc-700 bg-zinc-900 p-4 flex-col gap-4">
      <h1 className="text-xl font-semibold">Edge Labs</h1>
      <span className="inline-flex w-fit px-2 py-1 rounded bg-violet-500/20 text-violet-300 text-xs uppercase">{tier}</span>
      <nav className="space-y-2">
        {nav.map(([to, label]) => (
          <Link key={to} to={to} className={`block px-3 py-2 rounded ${pathname === to ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'}`}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto">
        <TelegramLink />
      </div>
    </aside>
  );
}
