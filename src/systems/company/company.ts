import { OFFICES } from '@/data/facilities';
import { getHeadquarters } from '@/data/locations';
import { ensure } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import type { GameState } from '@/types';
import { addTransaction } from '@/systems/finance/ledger';
import { trailing } from '@/systems/finance/accounts';
import { openRegions } from '@/systems/market/regions';
import { officeHeadcount } from '@/systems/workforce/employees';

export const STAGE_NAMES = ['', 'Garage', 'Start-up', 'Unternehmen', 'Konzern', 'Globaler Technologiekonzern'];

export interface StageRequirement {
  label: string;
  met: boolean;
  progress: string;
}

/** Voraussetzungen für die nächste Entwicklungsstufe. */
export function stageRequirements(state: GameState, stage: number): StageRequirement[] {
  const employees = state.workforce.employees.length;
  const ttm = trailing(state, 12, false).revenue;
  const factories = state.production.factories.filter((f) => f.status !== 'construction').length;
  const launched = state.products.filter((p) => p.launchDay !== undefined).length;
  const categories = new Set(state.products.filter((p) => p.status === 'on_sale').map((p) => p.category)).size;
  const office = state.company.officeLevel;
  const money = (v: number) => `${(v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. €`;
  switch (stage) {
    case 2:
      return [
        { label: 'Kleines Büro bezogen', met: office >= 1, progress: OFFICES[office].name },
        { label: 'Mindestens 6 Mitarbeitende', met: employees >= 6, progress: `${employees}/6` },
        { label: 'Erstes Produkt auf dem Markt', met: launched >= 1, progress: `${launched}/1` },
      ];
    case 3:
      return [
        { label: 'Bürogebäude bezogen', met: office >= 2, progress: OFFICES[office].name },
        { label: 'Eigene Fabrik in Betrieb', met: factories >= 1, progress: `${factories}/1` },
        { label: 'Mindestens 30 Mitarbeitende', met: employees >= 30, progress: `${employees}/30` },
        { label: 'Jahresumsatz ≥ 2 Mio. €', met: ttm >= 2_000_000, progress: money(ttm) },
      ];
    case 4:
      return [
        { label: 'Firmenzentrale bezogen', met: office >= 3, progress: OFFICES[office].name },
        { label: 'Mindestens 2 Fabriken', met: factories >= 2, progress: `${factories}/2` },
        { label: 'Eigenes Forschungslabor', met: state.research.labLevel >= 1, progress: state.research.labLevel >= 1 ? 'vorhanden' : 'fehlt' },
        { label: 'Mindestens 200 Mitarbeitende', met: employees >= 200, progress: `${employees}/200` },
        { label: 'Jahresumsatz ≥ 100 Mio. €', met: ttm >= 100_000_000, progress: money(ttm) },
        { label: 'Produkte in 3 Kategorien', met: categories >= 3, progress: `${categories}/3` },
      ];
    case 5:
      return [
        { label: 'Tech-Campus bezogen', met: office >= 4, progress: OFFICES[office].name },
        { label: 'In 3 Weltregionen aktiv', met: openRegions(state).length >= 3, progress: `${openRegions(state).length}/3` },
        { label: 'Mindestens 4 Fabriken', met: factories >= 4, progress: `${factories}/4` },
        { label: 'Mindestens 2.000 Mitarbeitende', met: employees >= 2_000, progress: `${employees}/2.000` },
        { label: 'Jahresumsatz ≥ 2 Mrd. €', met: ttm >= 2_000_000_000, progress: money(ttm) },
      ];
    default:
      return [];
  }
}

export function updateCompanyStage(state: GameState): void {
  const next = state.company.stage + 1;
  if (next > 5) return;
  const requirements = stageRequirements(state, next);
  if (requirements.length > 0 && requirements.every((r) => r.met)) {
    state.company.stage = next;
    addNews(state, 'company', 'positive', `${state.company.name} erreicht Stufe ${next}: ${STAGE_NAMES[next]}`, 'Neue Möglichkeiten sind freigeschaltet.');
  }
}

export function officeRent(state: GameState, level = state.company.officeLevel): number {
  return (OFFICES[level]?.rentPerMonth ?? 0) * getHeadquarters(state.company.headquartersId).rentFactor * state.economy.priceLevel;
}

export function moveOffice(state: GameState): string {
  ensure(!state.company.officeMove, 'Ein Umzug läuft bereits.');
  const next = OFFICES[state.company.officeLevel + 1];
  ensure(next, 'Es gibt kein größeres Büro.');
  const cost = next.moveCost * getHeadquarters(state.company.headquartersId).rentFactor * state.economy.priceLevel;
  ensure(state.finance.cash >= cost, `Nicht genügend Kapital. Der Umzug kostet ${Math.round(cost).toLocaleString('de-DE')} €.`);
  addTransaction(state, 'capex', -cost);
  state.company.officeMove = { targetLevel: next.level, readyDay: state.time.day + next.moveDays };
  return `Umzug in „${next.name}“ beginnt – fertig in ${next.moveDays} Tagen.`;
}

export function processCompany(state: GameState): void {
  const move = state.company.officeMove;
  if (move && state.time.day >= move.readyDay) {
    state.company.officeLevel = move.targetLevel;
    state.company.officeMove = null;
    addNews(state, 'company', 'positive', `${state.company.name} bezieht ${OFFICES[move.targetLevel].name}`, `Platz für bis zu ${OFFICES[move.targetLevel].maxEmployees.toLocaleString('de-DE')} Mitarbeitende.`);
  }
  addTransaction(state, 'rent', (-officeRent(state) * 12) / 365);
}

export function officeFull(state: GameState): boolean {
  return officeHeadcount(state) >= (OFFICES[state.company.officeLevel]?.maxEmployees ?? 5);
}
