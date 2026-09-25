import clsx from 'clsx';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { rowsEqual, useGameSelector } from '@/hooks/useGameSelectors';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types';

interface Step {
  label: string;
  done: boolean;
  link: string;
  hint: string;
}

function computeSteps(game: GameState): Step[] {
  const stats = game.workforce.stats;
  return [
    { label: 'Werkstatt ausstatten', done: game.production.workshop.toolLevel >= 1, link: 'production', hint: 'Grundausstattung kaufen (Produktion)' },
    { label: 'Ingenieur:in einstellen', done: stats.engineering.headcount >= 1, link: 'employees', hint: 'Beschleunigt die Entwicklung erheblich' },
    { label: 'Erstes Produkt entwerfen', done: game.products.length > 0, link: 'products/new', hint: 'z. B. Vorlage „NovaStation Basic“' },
    { label: 'Entwicklung starten', done: game.products.some((p) => p.status !== 'draft'), link: 'products', hint: 'Budget und Priorität wählen' },
    { label: 'Produktionspersonal einstellen', done: stats.production.headcount >= 1, link: 'employees', hint: 'Montiert die Geräte in der Werkstatt' },
    {
      label: 'Komponenten einkaufen',
      done: game.supply.orders.length > 0 || Object.values(game.inventory.components).some((e) => e.qty > 0),
      link: 'suppliers',
      hint: 'Großhandel liefert in 2 Tagen',
    },
    { label: 'Produktion starten', done: game.production.lines.some((l) => l.active && l.productId), link: 'production', hint: 'Linie mit Produkt belegen, Auto-Einkauf aktivieren' },
    { label: 'Markteinführung', done: game.products.some((p) => p.launchDay !== undefined), link: 'products', hint: 'Das Produkt in den Verkauf bringen' },
    { label: 'Forschung starten', done: game.research.active !== null || Object.keys(game.research.completed).length > 0, link: 'research', hint: 'z. B. Schlanke Montage' },
    { label: 'Marketing-Kampagne', done: game.marketing.campaigns.length > 0 || game.marketing.spentTotal > 0, link: 'marketing', hint: 'Bekanntheit steigern' },
  ];
}

export function Checklist() {
  const steps = useGameSelector(computeSteps, rowsEqual);
  const dismissed = useGameStore((s) => s.game?.tutorialDismissed ?? true);
  const execute = useGameStore((s) => s.execute);
  if (dismissed) return null;
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <Card
      title="Erste Schritte"
      subtitle={`${done} von ${steps.length} erledigt`}
      actions={
        <button
          type="button"
          className="text-muted hover:text-ink"
          aria-label="Ausblenden"
          onClick={() =>
            execute(
              (d) => {
                d.tutorialDismissed = true;
              },
              { silent: true },
            )
          }
        >
          <X size={15} />
        </button>
      }
    >
      <ol className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.label}>
            <Link to={`/game/${step.link}`} className={clsx('flex items-start gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-white/5', step.done && 'opacity-55')}>
              {step.done ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" /> : <Circle size={16} className="mt-0.5 shrink-0 text-muted" />}
              <span>
                <span className={clsx(step.done && 'line-through')}>{step.label}</span>
                {!step.done && <span className="block text-[11px] text-muted">{step.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
