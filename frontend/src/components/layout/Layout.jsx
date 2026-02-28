import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { pathname } = useLocation();
  const [show, setShow] = useState(true);

  useEffect(() => {
    setShow(false);
    const t = setTimeout(() => setShow(true), 50);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <aside className={`flex-shrink-0 transition-all duration-300 ease-smooth ${sidebarOpen ? 'w-60' : 'w-16'} hidden md:flex flex-col border-r border-[var(--border)] bg-[var(--bg-card)]`}>
        <Sidebar collapsed={!sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-5 md:p-7 pb-24 md:pb-7">
          <div
            className="max-w-7xl mx-auto"
            style={{
              opacity: show ? 1 : 0,
              transform: show ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.3s ease, transform 0.3s ease',
            }}
          >
            <Outlet />
          </div>
        </main>
      </div>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-card)]/90 backdrop-blur-md border-t border-[var(--border)] flex items-center justify-around px-2 py-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {[
          ['/dashboard', 'Home'],
          ['/perps', 'Perps'],
          ['/degen', 'Degen'],
          ['/predictions', 'Pred'],
          ['/profile', 'Me'],
        ].map(([to, label]) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl text-xs font-medium transition-all duration-200 ${pathname === to ? 'text-signal-400 bg-signal-500/10' : 'text-[var(--text-muted)]'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
