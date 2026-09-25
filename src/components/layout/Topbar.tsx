import clsx from 'clsx';
import { AlertTriangle, FastForward, Menu, Pause, Play, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CompanyLogo } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/simulation/calendar';
import { STAGE_NAMES } from '@/systems/company/company';
import { useGame, useGameStore } from '@/store/gameStore';
import type { GameSpeed } from '@/types';
import { formatMoney, formatMoneyCompact } from '@/utils/format';

const SPEEDS: GameSpeed[] = [1, 2, 5, 10, 20];

export function Topbar({ onToggleMenu }: { onToggleMenu: () => void }) {
  const navigate = useNavigate();
  const name = useGame((g) => g.company.name);
  const logo = useGame((g) => g.company.logo);
  const color = useGame((g) => g.company.color);
  const stage = useGame((g) => g.company.stage);
  const day = useGame((g) => g.time.day);
  const cash = useGame((g) => g.finance.cash);
  const insolvency = useGame((g) => g.insolvency.stage);
  const decisions = useGame((g) => g.events.decisions.length);
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const togglePause = useGameStore((s) => s.togglePause);
  const saveGame = useGameStore((s) => s.saveGame);
  const saving = useGameStore((s) => s.saving);

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-2 border-b border-line bg-[#0a0f1f]/90 px-2 backdrop-blur sm:gap-3 sm:px-3 md:px-5">
      <button type="button" className="rounded-md p-2 text-muted hover:bg-white/5 lg:hidden" onClick={onToggleMenu} aria-label="Menü">
        <Menu size={18} />
      </button>
      <button type="button" onClick={() => navigate('/game/company')} className="hidden min-w-0 items-center gap-2.5 text-left sm:flex">
        <CompanyLogo logo={logo} color={color} size={34} />
        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-sm font-bold">{name}</div>
          <div className="text-[11px] text-muted">
            Stufe {stage} · {STAGE_NAMES[stage]}
          </div>
        </div>
      </button>

      <div className="mx-auto flex items-center gap-2 md:gap-3">
        <div className="hidden text-right md:block">
          <div className="text-sm font-semibold tabular">{formatDate(day)}</div>
          <div className="text-[11px] text-muted">Tag {day + 1}</div>
        </div>
        <div className="flex items-center rounded-xl border border-line bg-surface/70 p-1" role="group" aria-label="Spielgeschwindigkeit">
          <button
            type="button"
            onClick={togglePause}
            title="Pause (Leertaste)"
            className={clsx('flex h-8 w-9 items-center justify-center rounded-lg transition', speed === 0 ? 'bg-amber-500/20 text-amber-300' : 'text-muted hover:text-ink')}
            aria-label={speed === 0 ? 'Fortsetzen' : 'Pausieren'}
          >
            {speed === 0 ? <Play size={16} /> : <Pause size={16} />}
          </button>
          {SPEEDS.map((value, index) => (
            <button
              key={value}
              type="button"
              title={`${value}× (Taste ${index + 1})`}
              onClick={() => setSpeed(value)}
              className={clsx('h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-xs font-bold transition sm:min-w-9', value === 2 || value === 10 ? 'hidden sm:flex' : 'flex', speed === value ? 'accent-bg text-white' : 'text-muted hover:text-ink')}
            >
              {value === 20 ? <FastForward size={14} /> : `${value}×`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {decisions > 0 && (
          <Badge tone="warn" className="pulse-soft">
            <AlertTriangle size={12} /> {decisions} Entscheidung{decisions > 1 ? 'en' : ''}
          </Badge>
        )}
        {insolvency !== 'ok' && (
          <Badge tone="bad" className="hidden sm:inline-flex">
            {insolvency === 'warning' ? 'Konto im Minus' : insolvency === 'restructuring' ? 'Restrukturierung' : 'Insolvent'}
          </Badge>
        )}
        <div className="text-right" title={formatMoney(cash)}>
          <div className="text-[11px] text-muted">Kapital</div>
          <div className={clsx('text-sm font-bold whitespace-nowrap tabular', cash < 0 ? 'text-red-400' : 'text-ink')}>{formatMoneyCompact(cash)}</div>
        </div>
        <button
          type="button"
          onClick={() => void saveGame('slot-1')}
          disabled={saving}
          title="Schnellspeichern in Spielstand 1"
          className="rounded-lg border border-line p-2 text-muted transition hover:border-slate-500 hover:text-ink disabled:opacity-50"
          aria-label="Speichern"
        >
          <Save size={16} />
        </button>
      </div>
    </header>
  );
}
