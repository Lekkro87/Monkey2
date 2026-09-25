import { CATEGORIES } from '@/data/categories';
import { SUPPORT_LEVELS, TICKETS_PER_AGENT } from '@/data/facilities';
import { getSoftwareProject } from '@/data/software';
import { ensure } from '@/simulation/commands';
import { stochasticRound } from '@/simulation/rng';
import type { GameState } from '@/types';
import { clamp } from '@/utils/math';
import { addTransaction } from '@/systems/finance/ledger';
import { hasTech, techEffects } from '@/systems/research/effects';
import { departmentCapacity } from '@/systems/workforce/employees';

export function supportEfficiency(state: GameState): number {
  let bonus = techEffects(state).supportEfficiency;
  for (const [id, project] of Object.entries(state.software.projects)) {
    if (project.completedDay !== undefined) bonus += getSoftwareProject(id)?.effects.supportEfficiency ?? 0;
  }
  return 1 + bonus;
}

export function dailyTickets(state: GameState): number {
  let tickets = 0;
  for (const product of state.products) {
    if (product.sales.installedBase <= 0) continue;
    const load = CATEGORIES[product.category].supportLoad;
    tickets += ((product.sales.installedBase * load) / 1_000 / 30.44) * (1 + product.quality.escapedRate * 30);
  }
  return tickets;
}

export function dailySupportCapacity(state: GameState): number {
  return (departmentCapacity(state, 'support') * TICKETS_PER_AGENT * supportEfficiency(state)) / 30.44;
}

export function setSupportLevel(state: GameState, level: (typeof SUPPORT_LEVELS)[number]['id']): string {
  const def = SUPPORT_LEVELS.find((l) => l.id === level);
  ensure(def, 'Unbekannte Support-Stufe.');
  ensure(hasTech(state, def.requiredTech), `„${def.name}“ muss zuerst erforscht werden.`);
  state.company.support.level = level;
  return `Support-Stufe „${def.name}“ aktiv.`;
}

function processWarranty(state: GameState): void {
  let warrantyCost = 0;
  for (const product of state.products) {
    const pool = product.sales.warrantyPool;
    if (pool <= 0 || product.quality.escapedRate <= 0) continue;
    const expected = (pool * product.quality.escapedRate * 1.4) / 365;
    const defects = stochasticRound(state, expected);
    if (defects <= 0) continue;
    product.quality.fieldDefects += defects;
    const repair = product.quality.recallStatus === 'repair_program' || product.quality.recallStatus === 'recall' ? 0.6 : 1;
    warrantyCost += defects * (product.price * 0.12 + 15 * state.economy.priceLevel) * repair;
  }
  if (warrantyCost > 0) addTransaction(state, 'warranty', -warrantyCost);
}

export function updateSupportAndReputation(state: GameState): void {
  processWarranty(state);
  const support = state.company.support;
  const level = SUPPORT_LEVELS.find((l) => l.id === support.level) ?? SUPPORT_LEVELS[0];
  const tickets = dailyTickets(state);
  const capacity = dailySupportCapacity(state);
  const target = tickets < 0.3 ? 1 : clamp(capacity / tickets, 0, 1.2);
  support.serviceLevel += (target - support.serviceLevel) * 0.05;
  support.ticketsLastMonth += tickets;
  const handled = Math.min(tickets, capacity);
  if (handled > 0) addTransaction(state, 'support', -handled * level.costPerTicket * state.economy.priceLevel);
  if (level.subscriptionPrice > 0) {
    const base = state.products.reduce((a, p) => a + p.sales.installedBase, 0);
    const revenue = (base * 0.02 * level.subscriptionPrice * state.economy.priceLevel) / 30.44;
    if (revenue > 0) {
      addTransaction(state, 'subscriptions', revenue);
      state.software.subscribers.premium_support = Math.round(base * 0.02);
    }
  }

  // Kundenzufriedenheit
  const brand = state.brand;
  const onSale = state.products.filter((p) => p.status === 'on_sale' && p.sales.unitsSold > 0);
  const totalRecent = onSale.reduce((a, p) => a + Math.max(1, p.sales.unitsLast30), 0);
  let rating = 3.6;
  let fieldRate = 0;
  let backlogDays = 0;
  if (onSale.length > 0) {
    rating = onSale.reduce((a, p) => a + p.customerRating * Math.max(1, p.sales.unitsLast30), 0) / totalRecent;
    fieldRate = onSale.reduce((a, p) => a + (p.quality.fieldDefects / Math.max(1, p.sales.unitsSold)) * Math.max(1, p.sales.unitsLast30), 0) / totalRecent;
    const backorders = onSale.reduce((a, p) => a + p.sales.backorders, 0);
    backlogDays = backorders / Math.max(1, totalRecent / 30);
  }
  const satisfactionTarget = clamp(
    55 + 30 * (support.serviceLevel - 0.85) + (rating - 3.6) * 14 - Math.min(14, Math.max(0, backlogDays - 5) * 1.2) - Math.min(20, fieldRate * 400) + level.satisfactionBonus,
    0,
    100,
  );
  brand.satisfaction += (satisfactionTarget - brand.satisfaction) * 0.02;

  const reviewed = state.products.filter((p) => p.review && (p.status === 'on_sale' || (p.discontinuedDay !== undefined && state.time.day - p.discontinuedDay < 365)));
  const reviewScore = reviewed.length > 0 ? (reviewed.reduce((a, p) => a + (p.review?.overall ?? 0), 0) / reviewed.length) * 10 : 55;
  const crisis = state.insolvency.stage === 'ok' ? 0 : state.insolvency.stage === 'warning' ? 5 : 12;
  const reputationTarget = clamp(0.4 * brand.satisfaction + 0.3 * brand.trust + 0.3 * reviewScore - crisis, 0, 100);
  brand.reputation += (reputationTarget - brand.reputation) * 0.01;
}
