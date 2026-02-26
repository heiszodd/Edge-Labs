import { Link, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const mobileNav = [
  ['/', 'Home'],
  ['/perps', 'Perps'],
  ['/degen', 'Degen'],
  ['/predictions', 'Predictions'],
  ['/settings', 'Settings'],
];

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen flex bg-zinc-950 text-zinc-100">
      <Sidebar />
      <div className="flex-1 flex flex-col pb-16 md:pb-0">
        <Topbar />
        <main className="p-4 md:p-6"><Outlet /></main>
      </div>
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-zinc-900 border-t border-zinc-700 flex justify-around py-2">
        {mobileNav.map(([to, label]) => (
          <Link key={to} to={to} className={`text-xs ${pathname === to ? 'text-violet-400' : 'text-zinc-400'}`}>{label}</Link>
        ))}
      </nav>
    </div>
  );
}
