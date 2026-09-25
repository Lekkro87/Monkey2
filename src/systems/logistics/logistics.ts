import { REGIONS } from '@/data/regions';
import { CommandError, ensure } from '@/simulation/commands';
import type { GameState, RegionId } from '@/types';
import { clamp } from '@/utils/math';
import { addTransaction } from '@/systems/finance/ledger';
import { techEffects } from '@/systems/research/effects';
import { departmentCapacity } from '@/systems/workforce/employees';

/** Verkaufte Einheiten pro Monat, die ein Logistik-Vollzeitäquivalent abwickeln kann. */
export const UNITS_PER_LOGISTICS_FTE = 2_500;

export function recentMonthlyUnits(state: GameState): number {
  const last = state.finance.months[state.finance.months.length - 1];
  return Math.max(last?.unitsSold ?? 0, state.stats.month.unitsSold);
}

export function logisticsRequirement(state: GameState): number {
  return recentMonthlyUnits(state) / UNITS_PER_LOGISTICS_FTE;
}

/** Abdeckung des Logistikbedarfs durch Personal (0–1,2). */
export function logisticsCoverage(state: GameState): number {
  const required = logisticsRequirement(state);
  if (required < 0.3) return 1;
  return clamp(departmentCapacity(state, 'logistics') / required, 0, 1.2);
}

/** Multiplikator auf alle Transportkosten (Personal + Forschung). */
export function logisticsCostFactor(state: GameState): number {
  const coverage = Math.min(1, logisticsCoverage(state));
  return (1.2 - 0.3 * coverage) * (1 + techEffects(state).logisticsCost);
}

/** Exportkosten pro Stück (Versand in andere Regionen + Zoll auf den Preis). */
export function exportCostPerUnit(state: GameState, region: RegionId, productVolume: number, price: number): number {
  if (region === state.company.homeRegion) return 0;
  const def = REGIONS[region];
  const hub = state.company.distributionCenters.includes(region) ? 0.6 : 1;
  const freight = productVolume * 9 * def.shippingCostFactor * hub * logisticsCostFactor(state) * state.economy.priceLevel;
  return freight + price * def.importTariff;
}

export const DISTRIBUTION_CENTER_COST = 2_000_000;

export function buildDistributionCenter(state: GameState, region: RegionId): string {
  ensure(state.company.regions[region]?.status === 'open', 'Die Region muss zuerst erschlossen werden.');
  ensure(region !== state.company.homeRegion, 'Im Heimatmarkt ist kein zusätzliches Verteilzentrum nötig.');
  if (state.company.distributionCenters.includes(region)) throw new CommandError('Dort gibt es bereits ein Verteilzentrum.');
  const cost = DISTRIBUTION_CENTER_COST * state.economy.priceLevel;
  ensure(state.finance.cash >= cost, 'Nicht genügend Kapital.');
  addTransaction(state, 'capex', -cost);
  state.company.distributionCenters.push(region);
  return `Regionales Verteilzentrum in ${REGIONS[region].name} eröffnet – Exportkosten sinken um 40 %.`;
}
