import { useEffect, useRef } from 'react';
import client from '../../api/client';

export default function TelegramLogin({ onSuccess, onError }) {
  const containerRef = useRef(null);
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

  useEffect(() => {
    if (!containerRef.current) return;
    if (!botUsername) return;

    window.onTelegramAuth = async (telegramUser) => {
      try {
        const response = await client.post('/api/auth/telegram/verify-oauth', telegramUser);
        onSuccess?.(response.data);
      } catch (err) {
        onError?.(err?.response?.data?.detail || 'Connection failed');
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
      delete window.onTelegramAuth;
    };
  }, [botUsername, onSuccess, onError]);

  if (!botUsername) {
    return (
      <div className="card border-zinc-500/20">
        <p className="text-sm text-[var(--text-muted)]">Telegram bot not available yet.</p>
      </div>
    );
  }
  return <div ref={containerRef} />;
}
