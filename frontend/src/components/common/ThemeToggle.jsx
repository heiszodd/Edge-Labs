import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button onClick={() => setDark((v) => !v)} className="btn-ghost p-2 rounded-xl" aria-label="Toggle theme">
      {dark ? <span className="text-amber-400">☀️</span> : <span>🌙</span>}
    </button>
  );
}

