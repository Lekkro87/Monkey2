import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/simulation/calendar';
import { resolveDecision } from '@/systems/events/events';
import { useGame, useGameStore } from '@/store/gameStore';
import { formatMoney } from '@/utils/format';
import clsx from 'clsx';

/** Zeigt anstehende Entscheidungen (z. B. Rückrufe) als Dialog. */
export function DecisionModal() {
  const decision = useGame((g) => g.events.decisions[0]);
  const cash = useGame((g) => g.finance.cash);
  const execute = useGameStore((s) => s.execute);
  const [selected, setSelected] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  if (!decision || dismissedId === decision.id) return null;
  const choice = selected && decision.options.some((o) => o.id === selected) ? selected : decision.defaultOptionId;

  return (
    <Modal
      open
      width="lg"
      title={
        <span className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-400" /> {decision.title}
        </span>
      }
      onClose={() => setDismissedId(decision.id)}
      footer={
        <>
          <span className="mr-auto text-xs text-muted">Frist: {formatDate(decision.deadlineDay)} – danach gilt „{decision.options.find((o) => o.id === decision.defaultOptionId)?.label}“.</span>
          <Button variant="ghost" onClick={() => setDismissedId(decision.id)}>
            Später
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const result = execute((d) => resolveDecision(d, decision.id, choice));
              if (result.ok) setSelected(null);
            }}
          >
            Entscheidung umsetzen
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink/90">{decision.description}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {decision.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelected(option.id)}
            className={clsx(
              'rounded-xl border p-3 text-left transition',
              choice === option.id ? 'accent-border bg-white/5 ring-2 ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]' : 'border-line hover:border-slate-500',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{option.label}</span>
              <span className={clsx('text-xs font-semibold tabular', option.cost > cash ? 'text-red-400' : 'text-muted')}>{option.cost > 0 ? formatMoney(option.cost) : 'kostenlos'}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{option.description}</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}
