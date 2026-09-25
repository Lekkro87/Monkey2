import { REGIONS } from '@/data/regions';
import { ensure } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import type { GameState, RegionId } from '@/types';
import { addTransaction } from '@/systems/finance/ledger';

export const EXPANSION_MIN_STAGE = 3;

export function openRegions(state: GameState): RegionId[] {
  return (Object.keys(state.company.regions) as RegionId[]).filter((r) => state.company.regions[r].status === 'open');
}

export function regionEntryCost(state: GameState, region: RegionId): number {
  return REGIONS[region].entryCost * state.economy.priceLevel;
}

export function enterRegion(state: GameState, region: RegionId): string {
  const def = REGIONS[region];
  const current = state.company.regions[region];
  ensure(current.status === 'closed', current.status === 'open' ? 'Diese Region ist bereits erschlossen.' : 'Der Markteintritt läuft bereits.');
  ensure(state.company.stage >= EXPANSION_MIN_STAGE, 'Internationale Expansion ist erst ab Unternehmensstufe 3 („Unternehmen“) möglich.');
  const cost = regionEntryCost(state, region);
  ensure(state.finance.cash >= cost, `Nicht genügend Kapital. Der Markteintritt kostet ${Math.round(cost).toLocaleString('de-DE')} €.`);
  addTransaction(state, 'fees', -cost);
  state.company.regions[region] = { id: region, status: 'entering', readyDay: state.time.day + def.entryDays };
  return `Markteintritt in ${def.name} gestartet – Zertifizierung und Lokalisierung dauern ${def.entryDays} Tage.`;
}

export function processRegions(state: GameState): void {
  for (const region of Object.values(state.company.regions)) {
    if (region.status === 'entering' && region.readyDay !== undefined && state.time.day >= region.readyDay) {
      region.status = 'open';
      const def = REGIONS[region.id];
      const segments = state.brand.awareness[region.id];
      for (const key of Object.keys(segments) as (keyof typeof segments)[]) segments[key] = Math.max(segments[key], 0.01);
      addNews(state, 'company', 'positive', `${state.company.name} startet in ${def.name}`, `Neue Kundschaft, aber auch Zölle von ${Math.round(def.importTariff * 100)} % und längere Transportwege.`);
    }
  }
}
