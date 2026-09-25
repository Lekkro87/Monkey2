import clsx from 'clsx';
import { Award, Building2, CheckCircle2, Circle, Globe2, Lock, MoveRight, Trophy } from 'lucide-react';
import { DIFFICULTIES } from '@/data/difficulties';
import { OFFICES } from '@/data/facilities';
import { getHeadquarters } from '@/data/locations';
import { REGION_IDS, REGIONS } from '@/data/regions';
import { CompanyLogo } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { KeyValue, MiniStat } from '@/components/ui/Stat';
import { formatDate, formatDuration } from '@/simulation/calendar';
import { ACHIEVEMENTS } from '@/systems/achievements/achievements';
import { moveOffice, officeRent, STAGE_NAMES, stageRequirements } from '@/systems/company/company';
import { EXPANSION_MIN_STAGE, enterRegion, regionEntryCost } from '@/systems/market/regions';
import { officeCapacity, officeHeadcount } from '@/systems/workforce/employees';
import { useGameStore } from '@/store/gameStore';
import type { RegionId } from '@/types';
import { formatMoney, formatMoneyCompact, formatNumber, formatPercent } from '@/utils/format';

function StageCard() {
  const game = useGameStore((s) => s.game!);
  const stage = game.company.stage;
  const next = stage < 5 ? stage + 1 : null;
  const requirements = next ? stageRequirements(game, next) : [];
  const met = requirements.filter((r) => r.met).length;
  return (
    <Card title="Unternehmensentwicklung" icon={<Trophy size={16} />} subtitle="Jede Stufe schaltet neue Möglichkeiten frei: Vertriebskanäle, Marketing, Fachkräfte, Expansion und Börsengang.">
      <div className="mb-4 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex-1">
            <div className={clsx('h-1.5 rounded-full', s <= stage ? 'accent-bg' : 'bg-white/10')} />
            <div className={clsx('mt-1 text-[10px] leading-tight', s === stage ? 'font-semibold text-ink' : 'text-muted')}>{STAGE_NAMES[s]}</div>
          </div>
        ))}
      </div>
      {next ? (
        <>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>
              Nächste Stufe: <strong>{STAGE_NAMES[next]}</strong>
            </span>
            <span className="text-xs text-muted tabular">
              {met}/{requirements.length} erfüllt
            </span>
          </div>
          <ul className="space-y-1.5">
            {requirements.map((r) => (
              <li key={r.label} className="flex items-center gap-2 text-sm">
                {r.met ? <CheckCircle2 size={15} className="shrink-0 text-emerald-400" /> : <Circle size={15} className="shrink-0 text-muted" />}
                <span className={r.met ? 'text-muted line-through decoration-white/20' : ''}>{r.label}</span>
                <span className="ml-auto text-xs text-muted tabular">{r.progress}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted">Höchste Stufe erreicht – {game.company.name} ist ein globaler Technologiekonzern.</p>
      )}
    </Card>
  );
}

function OfficeCard() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const office = OFFICES[game.company.officeLevel];
  const next = OFFICES[game.company.officeLevel + 1];
  const hq = getHeadquarters(game.company.headquartersId);
  const move = game.company.officeMove;
  const headcount = officeHeadcount(game);
  const capacity = officeCapacity(game);
  const moveCost = next ? next.moveCost * hq.rentFactor * game.economy.priceLevel : 0;
  return (
    <Card title="Firmensitz" icon={<Building2 size={16} />} subtitle={`${hq.city}, ${hq.country}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Büro" value={office.name} />
        <MiniStat label="Belegung" value={`${headcount}/${capacity}`} />
        <MiniStat label="Miete" value={`${formatMoney(officeRent(game))}/Mon.`} />
        <MiniStat label="Motivation" value={office.motivationBonus >= 0 ? `+${office.motivationBonus}` : String(office.motivationBonus)} />
      </div>
      <ProgressBar value={headcount} max={capacity} tone={headcount >= capacity ? 'warn' : 'accent'} className="mt-3" height="h-1.5" />
      <p className="mt-3 text-sm text-muted">{office.description}</p>
      {move ? (
        <div className="mt-4 rounded-lg border border-line/60 bg-surface/40 p-3 text-sm">
          <div className="mb-1.5 flex items-center gap-2">
            <MoveRight size={15} className="accent-text" /> Umzug in „{OFFICES[move.targetLevel].name}“ – fertig am {formatDate(move.readyDay)}
          </div>
          <ProgressBar value={OFFICES[move.targetLevel].moveDays - (move.readyDay - game.time.day)} max={OFFICES[move.targetLevel].moveDays} />
        </div>
      ) : next ? (
        <div className="mt-4 rounded-lg border border-line/60 bg-surface/40 p-3">
          <div className="text-sm font-medium">Nächster Schritt: {next.name}</div>
          <p className="mt-0.5 text-xs text-muted">{next.description}</p>
          <div className="mt-2 grid gap-x-6 text-xs sm:grid-cols-2">
            <KeyValue label="Plätze" value={formatNumber(next.maxEmployees)} />
            <KeyValue label="Miete" value={`${formatMoney(officeRent(game, next.level))}/Mon.`} />
            <KeyValue label="Umzugskosten" value={formatMoney(moveCost)} />
            <KeyValue label="Dauer" value={formatDuration(next.moveDays)} />
          </div>
          <Button size="sm" variant="primary" className="mt-3" icon={<MoveRight size={14} />} disabled={game.finance.cash < moveCost} onClick={() => execute(moveOffice)}>
            Umziehen
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Der Tech-Campus ist das größte verfügbare Hauptquartier.</p>
      )}
    </Card>
  );
}

function ExpansionCard() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const canExpand = game.company.stage >= EXPANSION_MIN_STAGE;
  return (
    <Card title="Internationale Expansion" icon={<Globe2 size={16} />} subtitle={canExpand ? 'Neue Regionen bringen zusätzliche Nachfrage – aber auch Zölle, Wechselkurse und längere Lieferwege.' : `Ab Stufe ${EXPANSION_MIN_STAGE} („${STAGE_NAMES[EXPANSION_MIN_STAGE]}“) können weitere Weltregionen erschlossen werden.`} bodyClassName="p-0">
      <div className="divide-y divide-line/50">
        {REGION_IDS.map((id: RegionId) => {
          const def = REGIONS[id];
          const state = game.company.regions[id];
          const home = id === game.company.homeRegion;
          const cost = regionEntryCost(game, id);
          return (
            <div key={id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {def.name}
                  {home && <Badge tone="accent">Heimatmarkt</Badge>}
                  {!home && state.status === 'open' && <Badge tone="good">aktiv</Badge>}
                  {state.status === 'entering' && <Badge tone="info">Markteintritt bis {formatDate(state.readyDay ?? game.time.day)}</Badge>}
                </div>
                <div className="text-xs text-muted">{def.description}</div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-right text-xs">
                <div>
                  <div className="text-muted">Weltmarkt</div>
                  <div className="font-semibold tabular">{formatPercent(def.marketShare, 0)}</div>
                </div>
                <div>
                  <div className="text-muted">Kaufkraft</div>
                  <div className="font-semibold tabular">{formatPercent(def.purchasingPower, 0)}</div>
                </div>
                <div>
                  <div className="text-muted">Zoll</div>
                  <div className="font-semibold tabular">{formatPercent(def.importTariff, 0)}</div>
                </div>
              </div>
              {state.status === 'closed' && (
                <Button size="xs" variant="primary" disabled={!canExpand || game.finance.cash < cost} title={`${def.entryDays} Tage Zertifizierung und Lokalisierung`} onClick={() => execute((d) => enterRegion(d, id))}>
                  Erschließen ({formatMoneyCompact(cost)})
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AchievementsCard() {
  const game = useGameStore((s) => s.game!);
  const unlocked = ACHIEVEMENTS.filter((a) => game.achievements[a.id] !== undefined).length;
  return (
    <Card title={`Erfolge (${unlocked}/${ACHIEVEMENTS.length})`} icon={<Award size={16} />}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const day = game.achievements[a.id];
          const done = day !== undefined;
          return (
            <div key={a.id} className={clsx('flex items-start gap-2.5 rounded-lg border px-3 py-2', done ? 'border-amber-500/30 bg-amber-500/[0.05]' : 'border-line/60 opacity-60')}>
              {done ? <Trophy size={16} className="mt-0.5 shrink-0 text-amber-300" /> : <Lock size={15} className="mt-0.5 shrink-0 text-muted" />}
              <div className="min-w-0">
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-xs text-muted">{a.description}</div>
                {done && <div className="mt-0.5 text-[10px] text-amber-200/80">{formatDate(day)}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function CompanyPage() {
  const game = useGameStore((s) => s.game!);
  const company = game.company;
  const hq = getHeadquarters(company.headquartersId);
  const lifetime = game.finance.lifetime;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-panel/90 p-5">
        <CompanyLogo logo={company.logo} color={company.color} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
          <p className="text-sm text-muted">
            CEO {company.ceoName} · {hq.city}, {hq.country} · gegründet {formatDate(company.foundedDay)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="accent">
              Stufe {company.stage}: {STAGE_NAMES[company.stage]}
            </Badge>
            <Badge>Schwierigkeit: {DIFFICULTIES[game.difficulty].name}</Badge>
            <Badge>{game.workforce.employees.length} Mitarbeitende</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Umsatz gesamt" value={formatMoneyCompact(lifetime.revenue)} />
          <MiniStat label="Gewinn gesamt" value={formatMoneyCompact(lifetime.netIncome)} />
          <MiniStat label="Verkaufte Geräte" value={formatNumber(game.stats.unitsSoldTotal)} />
          <MiniStat label="Höchster Wert" value={formatMoneyCompact(lifetime.peakValuation)} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <StageCard />
        <OfficeCard />
      </div>
      <ExpansionCard />
      <AchievementsCard />
    </div>
  );
}
