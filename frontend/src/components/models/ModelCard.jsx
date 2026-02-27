import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toggleModel } from '../../api/perps';

export default function ModelCard({ model, onEdit, onDelete }) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (active) => toggleModel(model.id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perps', 'models'] }),
  });

  return (
    <div className={`card group transition-all duration-300 hover:-translate-y-0.5 ${model.active ? 'border-signal-500/20' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${model.active ? 'bg-emerald-400 animate-pulse-soft' : 'bg-[var(--border-hover)]'}`} />
            <h3 className="font-semibold text-sm text-[var(--text-primary)]">{model.name}</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] ml-4">
            {model.pair} · {model.timeframe} {model.grade ? `· ${model.grade}` : ''}
          </p>
        </div>

        <button onClick={() => toggle.mutate(!model.active)} disabled={toggle.isPending} className={`toggle flex-shrink-0 ${model.active ? 'bg-signal-500' : 'bg-[var(--bg-secondary)]'}`}>
          <span className={`toggle-thumb ${model.active ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div className="flex gap-4 mt-3 text-xs text-[var(--text-muted)]">
        <span>Today: {model.signals_today || 0}</span>
        <span>Total: {model.total_signals || 0}</span>
        {model.pass_rate > 0 && <span>Pass: {(Number(model.pass_rate) * 100).toFixed(0)}%</span>}
      </div>

      <div className="flex gap-2 mt-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
        <button onClick={() => onEdit?.(model)} className="btn-ghost btn-sm flex-1">Edit</button>
        <button onClick={() => onDelete?.(model.id)} className="btn-danger btn-sm">Delete</button>
      </div>
    </div>
  );
}

