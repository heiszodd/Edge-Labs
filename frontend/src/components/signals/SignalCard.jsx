import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dismissSignal } from '../../api/signals';

const PHASE_COLORS = {
  1: 'bg-sky-500/10 text-sky-400',
  2: 'bg-sky-500/10 text-sky-400',
  3: 'bg-amber-500/10 text-amber-400',
  4: 'bg-emerald-500/10 text-emerald-400',
};

const DIR_ICON = {
  bullish: '📈',
  bearish: '📉',
};

export default function SignalCard({ signal, onViewPlan, onExecute }) {
  const [dismissed, setDismissed] = useState(false);
  const qc = useQueryClient();

  const dismiss = useMutation({
    mutationFn: () => dismissSignal(signal.id),
    onSuccess: () => {
      setDismissed(true);
      qc.invalidateQueries({ queryKey: ['signals', 'pending'] });
    },
  });

  if (dismissed) return null;

  const grade = signal.quality_grade || '?';
  const score = Number(signal.quality_score || 0);
  const phase = signal.phase || 1;
  const pair = signal.pair || '?';
  const tf = signal.timeframe || '?';
  const dir = signal.direction || '?';

  const timeAgo = (() => {
    const diff = Date.now() - new Date(signal.created_at || Date.now()).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  })();

  return (
    <div className={`card animate-slide-up border-l-4 ${phase === 4 ? 'border-l-emerald-500' : phase === 3 ? 'border-l-amber-500' : 'border-l-sky-500'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${PHASE_COLORS[phase]}`}>P{phase}</span>
          <span className="font-semibold text-[var(--text-primary)]">{DIR_ICON[dir] || '📊'} {pair}</span>
          <span className="badge bg-[var(--bg-secondary)] text-[var(--text-muted)]">{tf}</span>
          <span className={`grade-${grade}`}>{grade}</span>
        </div>
        <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{timeAgo}</span>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
          <span>Quality</span>
          <span>{score.toFixed(0)}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-sky-500'}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={() => onViewPlan?.(signal)} className="btn-secondary btn-sm flex-1">Plan</button>
        {phase === 4 && <button onClick={() => onExecute?.(signal)} className="btn-primary btn-sm flex-1">Execute</button>}
        <button onClick={() => dismiss.mutate()} disabled={dismiss.isPending} className="btn-ghost btn-sm px-2">✕</button>
      </div>
    </div>
  );
}

