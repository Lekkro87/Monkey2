import { HOURS_PER_DAY } from '@/data/departments';
import { getSoftwareProject, SOFTWARE_PROJECTS } from '@/data/software';
import { ensure } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import type { GameState, SoftwareProjectDef } from '@/types';
import { addTransaction } from '@/systems/finance/ledger';
import { techEffects } from '@/systems/research/effects';
import { departmentCapacity, departmentHeadcount } from '@/systems/workforce/employees';

export function isSoftwareUnlocked(state: GameState, projectId: string): boolean {
  return techEffects(state).software.has(projectId);
}

export function softwareBlocker(state: GameState, project: SoftwareProjectDef): string | null {
  if (state.software.projects[project.id]) return state.software.projects[project.id].completedDay !== undefined ? 'Bereits veröffentlicht.' : 'Läuft bereits.';
  if (!isSoftwareUnlocked(state, project.id)) return 'Muss zuerst erforscht werden.';
  const developers = departmentHeadcount(state, 'software');
  if (developers < project.minDevelopers) return `Es werden mindestens ${project.minDevelopers} Software-Entwickler:innen benötigt (aktuell ${developers}).`;
  return null;
}

export function startSoftwareProject(state: GameState, projectId: string): string {
  const project = getSoftwareProject(projectId);
  ensure(project, 'Unbekanntes Softwareprojekt.');
  const blocker = softwareBlocker(state, project);
  ensure(!blocker, blocker ?? '');
  const cost = project.cost * state.economy.priceLevel;
  ensure(state.finance.cash >= cost, `Nicht genügend Kapital. Das Projekt kostet ${Math.round(cost).toLocaleString('de-DE')} €.`);
  addTransaction(state, 'development', -cost);
  state.software.projects[projectId] = { projectId, progress: 0, phaseIndex: 0, startedDay: state.time.day, version: 1 };
  return `Softwareprojekt „${project.name}“ gestartet.`;
}

/** Anteil der Softwareabteilung, der für Softwareprojekte verfügbar ist. */
export function softwareProjectShare(state: GameState): number {
  const productNeedsSoftware = state.products.some((p) => p.status === 'development');
  return productNeedsSoftware ? 0.5 : 1;
}

export function progressSoftware(state: GameState): void {
  const active = Object.values(state.software.projects).filter((p) => p.completedDay === undefined);
  if (active.length > 0) {
    const hours = (departmentCapacity(state, 'software') * HOURS_PER_DAY * softwareProjectShare(state)) / active.length;
    for (const project of active) {
      const def = getSoftwareProject(project.projectId);
      if (!def) continue;
      project.progress += hours;
      project.phaseIndex = Math.min(def.phases.length - 1, Math.floor((project.progress / def.effort) * def.phases.length));
      if (project.progress >= def.effort) {
        project.completedDay = state.time.day;
        project.phaseIndex = def.phases.length - 1;
        addNews(state, 'company', 'positive', `${state.company.name} veröffentlicht ${def.name}`, def.description);
      }
    }
  }

  // Abonnement-Umsätze aus veröffentlichter Software.
  for (const def of SOFTWARE_PROJECTS) {
    const project = state.software.projects[def.id];
    const subscription = def.effects.subscription;
    if (!project || project.completedDay === undefined || !subscription) continue;
    let base = 0;
    for (const product of state.products) {
      if (subscription.categories.includes(product.category)) base += product.sales.installedBase;
    }
    const maturity = Math.min(1, (state.time.day - project.completedDay) / 180);
    const subscribers = base * subscription.adoption * (0.3 + 0.7 * maturity);
    state.software.subscribers[def.id] = Math.round(subscribers);
    const revenue = (subscribers * subscription.pricePerMonth * state.economy.priceLevel) / 30.44;
    if (revenue > 0) addTransaction(state, 'subscriptions', revenue);
  }
}

export function totalSubscribers(state: GameState): number {
  return Object.values(state.software.subscribers).reduce((a, b) => a + b, 0);
}
