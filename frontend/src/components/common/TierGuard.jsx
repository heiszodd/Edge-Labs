import useAuth from '../../hooks/useAuth';

const tierRank = { free: 0, pro: 1, premium: 2 };

export default function TierGuard({ tier = 'pro', children }) {
  const { tier: userTier } = useAuth();
  const allowed = tierRank[userTier] >= tierRank[tier];

  if (allowed) return children;

  return (
    <div className="relative card overflow-hidden">
      <div className="blur-sm pointer-events-none opacity-50">{children}</div>
      <div className="absolute inset-0 bg-zinc-950/70 flex items-center justify-center">
        <button className="btn bg-violet-500 hover:bg-violet-600">Upgrade to {tier}</button>
      </div>
    </div>
  );
}
