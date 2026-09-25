import { LABS } from '@/data/facilities';
import { getTech, TECHNOLOGIES } from '@/data/technologies';
import { CommandError, ensure } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import type { GameState, TechnologyDef } from '@/types';
import { addTransaction } from '@/systems/finance/ledger';
import { departmentCapacity, departmentHeadcount } from '@/systems/workforce/employees';
import { techEffects } from './effects';

export function currentLab(state: GameState) {
  return LABS[state.research.labLevel] ?? LABS[0];
}

/** Forschungspunkte pro Tag bei aktueller Belegschaft und Laborausstattung. */
export function researchPointsPerDay(state: GameState): number {
  const lab = currentLab(state);
  const headcount = departmentHeadcount(state, 'research');
  const capacity = departmentCapacity(state, 'research');
  const limit = headcount > lab.maxResearchers ? lab.maxResearchers / headcount : 1;
  return capacity * limit * lab.speedMultiplier * (1 + techEffects(state).researchSpeed);
}

export function isResearched(state: GameState, techId: string): boolean {
  return techId in state.research.completed;
}

/** Warum kann eine Technologie (noch) nicht erforscht werden? */
export function researchBlocker(state: GameState, tech: TechnologyDef): string | null {
  if (isResearched(state, tech.id)) return 'Bereits erforscht.';
  const missing = tech.prerequisites.filter((p) => !isResearched(state, p));
  if (missing.length > 0) return `Voraussetzung fehlt: ${missing.map((m) => getTech(m)?.name ?? m).join(', ')}.`;
  if (state.research.labLevel < tech.minLabLevel) return `Benötigt mindestens: ${LABS[tech.minLabLevel].name}.`;
  const researchers = departmentHeadcount(state, 'research');
  if (tech.minResearchers > 0 && researchers < tech.minResearchers) {
    return `Für diese Forschung werden mindestens ${tech.minResearchers} Forschende benötigt (aktuell ${researchers}).`;
  }
  return null;
}

export function startResearch(state: GameState, techId: string): string {
  const tech = getTech(techId);
  ensure(tech, 'Unbekannte Technologie.');
  const blocker = researchBlocker(state, tech);
  if (blocker) throw new CommandError(blocker);
  const research = state.research;
  if (research.active) {
    if (research.active.techId === techId) return 'Wird bereits erforscht.';
    research.partialProgress[research.active.techId] = research.active.progress;
  }
  research.active = { techId, progress: research.partialProgress[techId] ?? 0, startedDay: state.time.day };
  delete research.partialProgress[techId];
  research.queue = research.queue.filter((id) => id !== techId);
  return `Forschung an „${tech.name}“ gestartet.`;
}

export function queueResearch(state: GameState, techId: string): string {
  const tech = getTech(techId);
  ensure(tech, 'Unbekannte Technologie.');
  ensure(!isResearched(state, techId), 'Bereits erforscht.');
  ensure(state.research.active?.techId !== techId, 'Wird bereits erforscht.');
  ensure(!state.research.queue.includes(techId), 'Bereits in der Warteschlange.');
  ensure(state.research.queue.length < 10, 'Die Warteschlange ist voll (max. 10).');
  state.research.queue.push(techId);
  if (!state.research.active) startNextFromQueue(state);
  return `„${tech.name}“ zur Warteschlange hinzugefügt.`;
}

export function removeFromQueue(state: GameState, techId: string): string {
  state.research.queue = state.research.queue.filter((id) => id !== techId);
  return 'Aus der Warteschlange entfernt.';
}

export function stopResearch(state: GameState): string {
  const active = state.research.active;
  ensure(active, 'Keine laufende Forschung.');
  state.research.partialProgress[active.techId] = active.progress;
  state.research.active = null;
  return 'Forschung pausiert – der Fortschritt bleibt erhalten.';
}

function startNextFromQueue(state: GameState): void {
  while (state.research.queue.length > 0) {
    const next = state.research.queue[0];
    const tech = getTech(next);
    if (!tech || isResearched(state, next)) {
      state.research.queue.shift();
      continue;
    }
    if (researchBlocker(state, tech)) return;
    state.research.queue.shift();
    state.research.active = { techId: next, progress: state.research.partialProgress[next] ?? 0, startedDay: state.time.day };
    delete state.research.partialProgress[next];
    return;
  }
}

export function buildLab(state: GameState): string {
  const research = state.research;
  ensure(!research.labConstruction, 'Es wird bereits ein Labor gebaut.');
  const next = LABS[research.labLevel + 1];
  ensure(next, 'Das größte Forschungszentrum ist bereits vorhanden.');
  const cost = next.cost * state.economy.priceLevel;
  ensure(state.finance.cash >= cost, `Nicht genügend Kapital. ${next.name} kostet ${Math.round(cost).toLocaleString('de-DE')} €.`);
  addTransaction(state, 'capex', -cost);
  research.labConstruction = { targetLevel: next.level, readyDay: state.time.day + next.buildDays };
  return `Bau: ${next.name} – fertig in ${next.buildDays} Tagen.`;
}

export function completeTechnology(state: GameState, techId: string): void {
  state.research.completed = { ...state.research.completed, [techId]: state.time.day };
  const tech = getTech(techId);
  if (tech) addNews(state, 'research', 'positive', `Forschung abgeschlossen: ${tech.name}`, tech.description);
}

export function progressResearch(state: GameState): void {
  const research = state.research;
  const day = state.time.day;
  if (research.labConstruction && day >= research.labConstruction.readyDay) {
    research.labLevel = research.labConstruction.targetLevel;
    research.labConstruction = null;
    addNews(state, 'research', 'positive', `${currentLab(state).name} eröffnet`, `Platz für bis zu ${currentLab(state).maxResearchers} Forschende.`);
  }
  const lab = currentLab(state);
  if (lab.monthlyCost > 0) addTransaction(state, 'research', (-lab.monthlyCost * state.economy.priceLevel * 12) / 365);

  if (!research.active) startNextFromQueue(state);
  const active = research.active;
  const points = researchPointsPerDay(state);
  research.pointsToday = active ? points : 0;
  if (!active) return;
  const tech = getTech(active.techId);
  if (!tech) {
    research.active = null;
    return;
  }
  active.progress += points;
  research.totalPoints += points;
  if (active.progress >= tech.cost) {
    completeTechnology(state, tech.id);
    research.active = null;
    startNextFromQueue(state);
  }
}

export function availableTechnologies(state: GameState): TechnologyDef[] {
  return TECHNOLOGIES.filter((t) => !isResearched(state, t.id) && t.prerequisites.every((p) => isResearched(state, p)));
}

export function researchProgressRatio(state: GameState): number {
  const active = state.research.active;
  if (!active) return 0;
  const tech = getTech(active.techId);
  return tech ? Math.min(1, active.progress / tech.cost) : 0;
}
