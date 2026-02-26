import useAuth from '../../hooks/useAuth';

export default function TelegramLink() {
  const { user } = useAuth();
  const telegram = user?.telegram;

  if (!telegram) {
    return <button className="btn bg-sky-500 hover:bg-sky-600">Link Telegram</button>;
  }

  return (
    <div className="text-sm text-zinc-300">
      @{telegram.username} · <span className="text-emerald-500">{telegram.status || 'linked'}</span>
    </div>
  );
}
