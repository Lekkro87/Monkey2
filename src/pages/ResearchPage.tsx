import clsx from 'clsx';
import { CheckCircle2, Code2, FlaskConical, ListPlus, Lock, Pause, Play, Rocket, X } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES } from '@/data/categories';
import { LABS } from '@/data/facilities';
import { SOFTWARE_PROJECTS } from '@/data/software';
import { getTech, TECH_CATEGORIES, TECH_CATEGORY_ORDER, TECHNOLOGIES } from '@/data/technologies';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { Segmented } from '@/components/ui/Form';
import { ProgressBar } from '@/components/ui/Progress';
import { KeyValue, MiniStat, StatCard } from '@/components/ui/Stat';
import { formatDate } from '@/simulation/calendar';
import { describeTechEffect } from '@/systems/research/describe';
import { buildLab, currentLab, isResearched, queueResearch, removeFromQueue, researchBlocker, researchPointsPerDay, startResearch, stopResearch } from '@/systems/research/research';
import { softwareBlocker, startSoftwareProject, totalSubscribers } from '@/systems/software/software';
import { departmentHeadcount } from '@/systems/workforce/employees';
import { useGameStore } from '@/store/gameStore';
import type { GameState, TechCategory, TechnologyDef } from '@/types';
import { formatDays, formatMoney, formatNumber, formatPercent } from '@/utils/format';

type Tab = 'tree' | 'software';

function etaDays(game: GameState, tech: TechnologyDef, progress: number): number | null {
  const perDay = researchPointsPerDay(game);
  if (perDay <= 0) return null;
  return Math.ceil(Math.max(0, tech.cost - progress) / perDay);
}

function TechCard({ tech }: { tech: TechnologyDef }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const research = game.research;
  const done = isResearched(game, tech.id);
  const active = research.active?.techId === tech.id;
  const queued = research.queue.includes(tech.id);
  const blocker = done ? null : researchBlocker(game, tech);
  const partial = active ? research.active!.progress : (research.partialProgress[tech.id] ?? 0);
  const prerequisitesMissing = tech.prerequisites.some((p) => !isResearched(game, p));
  const eta = !done ? etaDays(game, tech, partial) : null;

  return (
    <div
      className={clsx(
        'rounded-xl border p-3 transition',
        done ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : active ? 'accent-border bg-white/[0.03]' : prerequisitesMissing ? 'border-line/60 bg-surface/30 opacity-70' : 'border-line bg-panel/80',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            {done ? <CheckCircle2 size={14} className="text-emerald-400" /> : prerequisitesMissing ? <Lock size={13} className="text-muted" /> : null}
            <span className="truncate">{tech.name}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            Stufe {tech.tier} · {formatNumber(tech.cost)} Punkte
            {tech.minResearchers > 0 && ` · ab ${tech.minResearchers} Forschenden`}
            {tech.minLabLevel > 0 && ` · ${LABS[tech.minLabLevel].name}`}
          </div>
        </div>
        {done && <Badge tone="good">{formatDate(research.completed[tech.id])}</Badge>}
        {active && <Badge tone="accent">läuft</Badge>}
        {queued && <Badge tone="info">#{research.queue.indexOf(tech.id) + 1} in Warteschlange</Badge>}
      </div>
      <p className="mt-2 text-xs text-muted">{tech.description}</p>
      <ul className="mt-2 space-y-0.5 text-xs">
        {tech.effects.map((effect, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="accent-text">•</span>
            {describeTechEffect(effect)}
          </li>
        ))}
      </ul>
      {tech.prerequisites.length > 0 && !done && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tech.prerequisites.map((p) => (
            <Badge key={p} tone={isResearched(game, p) ? 'good' : 'neutral'}>
              {getTech(p)?.name ?? p}
            </Badge>
          ))}
        </div>
      )}
      {!done && partial > 0 && (
        <div className="mt-2">
          <ProgressBar value={partial} max={tech.cost} height="h-1.5" />
          <div className="mt-0.5 text-[10px] text-muted tabular">
            {formatPercent(partial / tech.cost, 0)}
            {eta !== null && ` · noch ca. ${formatDays(eta)}`}
          </div>
        </div>
      )}
      {!done && !active && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Button size="xs" variant="primary" icon={<Play size={12} />} disabled={!!blocker} onClick={() => execute((d) => startResearch(d, tech.id))}>
            Erforschen
          </Button>
          {!queued && (
            <Button size="xs" icon={<ListPlus size={12} />} onClick={() => execute((d) => queueResearch(d, tech.id))}>
              Vormerken
            </Button>
          )}
          {blocker && <span className="text-[11px] text-amber-300">{blocker}</span>}
          {!blocker && eta !== null && !partial && <span className="text-[11px] text-muted">ca. {formatDays(eta)}</span>}
        </div>
      )}
    </div>
  );
}

function TechTree() {
  const [category, setCategory] = useState<TechCategory | 'all'>('all');
  const game = useGameStore((s) => s.game!);
  const categories = category === 'all' ? TECH_CATEGORY_ORDER : [category];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        <Button size="xs" variant={category === 'all' ? 'primary' : 'secondary'} onClick={() => setCategory('all')}>
          Alle
        </Button>
        {TECH_CATEGORY_ORDER.map((c) => {
          const total = TECHNOLOGIES.filter((t) => t.category === c).length;
          const done = TECHNOLOGIES.filter((t) => t.category === c && isResearched(game, t.id)).length;
          return (
            <Button key={c} size="xs" variant={category === c ? 'primary' : 'secondary'} onClick={() => setCategory(c)}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: TECH_CATEGORIES[c].color }} />
              {TECH_CATEGORIES[c].name}
              <span className="text-muted">
                {done}/{total}
              </span>
            </Button>
          );
        })}
      </div>
      {categories.map((c) => {
        const techs = TECHNOLOGIES.filter((t) => t.category === c).sort((a, b) => a.tier - b.tier || a.cost - b.cost);
        const tiers = [...new Set(techs.map((t) => t.tier))];
        return (
          <section key={c}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TECH_CATEGORIES[c].color }} />
              {TECH_CATEGORIES[c].name}
            </h3>
            <div className="space-y-3">
              {tiers.map((tier) => (
                <div key={tier} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {techs
                    .filter((t) => t.tier === tier)
                    .map((tech) => (
                      <TechCard key={tech.id} tech={tech} />
                    ))}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SoftwareTab() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const developers = departmentHeadcount(game, 'software');
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Eigene Software verbessert die Software-Wertung aller Geräte, spart Lizenzkosten und bringt wiederkehrende Abo-Umsätze. Softwareprojekte teilen sich die Kapazität der Softwareabteilung mit der Produktentwicklung (aktuell {developers} Entwickler:innen, {formatNumber(totalSubscribers(game))} Abonnent:innen).
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SOFTWARE_PROJECTS.map((project) => {
          const state = game.software.projects[project.id];
          const blocker = softwareBlocker(game, project);
          const released = state?.completedDay !== undefined;
          const subscribers = game.software.subscribers[project.id] ?? 0;
          const requiredTech = project.requiredTech ? getTech(project.requiredTech) : undefined;
          return (
            <Card
              key={project.id}
              title={project.name}
              icon={<Code2 size={15} />}
              actions={released ? <Badge tone="good">veröffentlicht</Badge> : state ? <Badge tone="accent">in Entwicklung</Badge> : blocker ? <Badge tone="neutral">gesperrt</Badge> : <Badge tone="info">verfügbar</Badge>}
            >
              <p className="text-sm text-muted">{project.description}</p>
              <div className="mt-3 space-y-0.5 text-xs">
                {!!project.effects.softwareBonus && <div>• +{project.effects.softwareBonus} Software-Wertung</div>}
                {!!project.effects.innovationBonus && <div>• +{project.effects.innovationBonus} Innovationsgrad</div>}
                {project.effects.removesOsLicense && <div>• Keine Betriebssystem-Lizenz mehr für {project.effects.removesOsLicense.map((c) => CATEGORIES[c].name).join(', ')}</div>}
                {!!project.effects.supportEfficiency && <div>• Support +{formatPercent(project.effects.supportEfficiency, 0)} effizienter</div>}
                {project.effects.subscription && (
                  <div>
                    • Abo „{project.effects.subscription.name}“ für {formatMoney(project.effects.subscription.pricePerMonth, 2)}/Monat
                  </div>
                )}
              </div>
              <div className="mt-3 rounded-lg border border-line/60 bg-surface/40 px-3 py-1.5">
                <KeyValue label="Aufwand" value={`${formatNumber(project.effort)} Stunden`} />
                <KeyValue label="Kosten" value={formatMoney(project.cost * game.economy.priceLevel)} />
                <KeyValue label="Team" value={`ab ${project.minDevelopers} Entwickler:innen`} />
                {requiredTech && <KeyValue label="Forschung" value={requiredTech.name} />}
              </div>
              {state && !released && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{project.phases[state.phaseIndex]}</span>
                    <span className="tabular">{formatPercent(state.progress / project.effort, 0)}</span>
                  </div>
                  <ProgressBar value={state.progress} max={project.effort} />
                </div>
              )}
              {released && (
                <div className="mt-3 text-xs text-muted">
                  Veröffentlicht am {formatDate(state!.completedDay!)}
                  {project.effects.subscription && ` · ${formatNumber(subscribers)} Abonnent:innen`}
                </div>
              )}
              {!state && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="xs" variant="primary" icon={<Rocket size={12} />} disabled={!!blocker} onClick={() => execute((d) => startSoftwareProject(d, project.id))}>
                    Projekt starten
                  </Button>
                  {blocker && <span className="text-[11px] text-amber-300">{blocker}</span>}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const [tab, setTab] = useState<Tab>('tree');
  const research = game.research;
  const lab = currentLab(game);
  const nextLab = LABS[research.labLevel + 1];
  const researchers = departmentHeadcount(game, 'research');
  const perDay = researchPointsPerDay(game);
  const activeTech = research.active ? getTech(research.active.techId) : undefined;
  const completedCount = Object.keys(research.completed).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Forschung" description="Technologien erschließen neue Produktkategorien, bessere Fertigung und effizientere Abläufe." icon={<FlaskConical size={20} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Forschungspunkte" value={`${formatNumber(perDay, 1)}/Tag`} hint={`${formatNumber(research.totalPoints)} insgesamt`} />
        <StatCard label="Forschende" value={`${researchers}/${lab.maxResearchers}`} hint={researchers > lab.maxResearchers ? 'Labor überfüllt' : lab.name} tone={researchers > lab.maxResearchers ? 'warn' : 'default'} />
        <StatCard label="Erforscht" value={`${completedCount}/${TECHNOLOGIES.length}`} />
        <StatCard label="Laborfaktor" value={`×${formatNumber(lab.speedMultiplier, 1)}`} hint={lab.monthlyCost > 0 ? `${formatMoney(lab.monthlyCost * game.economy.priceLevel)}/Monat` : 'keine laufenden Kosten'} />
      </div>

      {researchers === 0 && (
        <Alert tone="info" title="Noch keine Forschenden">
          Solange die Firma klein ist, forscht die Gründerin bzw. der Gründer nebenbei (langsam). Stelle Forschende ein, um schneller voranzukommen.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Aktuelle Forschung" className="lg:col-span-2">
          {activeTech && research.active ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{activeTech.name}</div>
                  <div className="text-xs text-muted">{activeTech.description}</div>
                </div>
                <Button size="xs" icon={<Pause size={12} />} onClick={() => execute(stopResearch)}>
                  Pausieren
                </Button>
              </div>
              <ProgressBar value={research.active.progress} max={activeTech.cost} />
              <div className="flex justify-between text-xs text-muted">
                <span className="tabular">
                  {formatNumber(research.active.progress)} / {formatNumber(activeTech.cost)} Punkte
                </span>
                <span>{perDay > 0 ? `noch ca. ${formatDays(Math.ceil((activeTech.cost - research.active.progress) / perDay))}` : 'keine Forschungskapazität'}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Keine laufende Forschung. Wähle unten eine Technologie aus.</p>
          )}
          {research.queue.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-muted">Warteschlange</div>
              <div className="flex flex-wrap gap-1.5">
                {research.queue.map((id, index) => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface/60 py-0.5 pr-1 pl-2 text-xs">
                    {index + 1}. {getTech(id)?.name ?? id}
                    <button type="button" onClick={() => execute((d) => removeFromQueue(d, id), { silent: true })} className="rounded p-0.5 text-muted hover:bg-white/10 hover:text-ink" aria-label="Entfernen">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Labor" subtitle={lab.description}>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Stufe" value={lab.name} />
            <MiniStat label="Plätze" value={formatNumber(lab.maxResearchers)} />
          </div>
          {research.labConstruction ? (
            <div className="mt-3">
              <div className="mb-1 text-xs text-muted">
                Bau: {LABS[research.labConstruction.targetLevel].name} – fertig am {formatDate(research.labConstruction.readyDay)}
              </div>
              <ProgressBar value={LABS[research.labConstruction.targetLevel].buildDays - (research.labConstruction.readyDay - game.time.day)} max={LABS[research.labConstruction.targetLevel].buildDays} />
            </div>
          ) : nextLab ? (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-muted">
                Nächste Stufe: <span className="text-ink">{nextLab.name}</span> – {nextLab.description}
              </div>
              <Button size="sm" variant="primary" className="w-full" onClick={() => execute(buildLab)} disabled={game.finance.cash < nextLab.cost * game.economy.priceLevel}>
                Bauen für {formatMoney(nextLab.cost * game.economy.priceLevel)} ({nextLab.buildDays} Tage)
              </Button>
              <div className="text-[11px] text-muted">
                Laufende Kosten: {formatMoney(nextLab.monthlyCost * game.economy.priceLevel)}/Monat · Tempo ×{formatNumber(nextLab.speedMultiplier, 1)} · {nextLab.maxResearchers} Plätze
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Das größte Forschungszentrum ist in Betrieb.</p>
          )}
        </Card>
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'tree', label: 'Technologiebaum' },
          { value: 'software', label: 'Software & Dienste' },
        ]}
      />
      {tab === 'tree' ? <TechTree /> : <SoftwareTab />}
    </div>
  );
}
