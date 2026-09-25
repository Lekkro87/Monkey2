import type { GameState } from '@/types';
import { isMonthStart, isWeekStart } from './calendar';
import { expireModifiers } from './modifiers';
import { gaussian } from './rng';
import { checkAchievements } from '@/systems/achievements/achievements';
import { processCompany, updateCompanyStage } from '@/systems/company/company';
import { resetMonthlyComponentOrders, updateComponentMarket } from '@/systems/components/market';
import { closeCompetitorMonth, updateCompetitors } from '@/systems/competitors/ai';
import { recordEconomySnapshot, updateEconomy } from '@/systems/economy/economy';
import { checkEvents, processDecisionDeadlines } from '@/systems/events/events';
import { checkInsolvency } from '@/systems/finance/insolvency';
import { processFundingOffers } from '@/systems/finance/investors';
import { processLoansMonthly, processOverdraft } from '@/systems/finance/loans';
import { closeMonth } from '@/systems/finance/monthly';
import { updateStockDaily } from '@/systems/finance/stock';
import { processWarehouses } from '@/systems/inventory/inventory';
import { processChannelCosts } from '@/systems/market/channels';
import { simulateMarkets, updateMarketTrends } from '@/systems/market/demand';
import { processRegions } from '@/systems/market/regions';
import { updateProductReception } from '@/systems/market/reviews';
import { updateMarketingAndBrand } from '@/systems/marketing/marketing';
import { processContractManufacturing } from '@/systems/production/contractManufacturing';
import { processFactories } from '@/systems/production/facilities';
import { runProduction } from '@/systems/production/production';
import { progressDevelopment } from '@/systems/products/development';
import { progressResearch } from '@/systems/research/research';
import { progressSoftware } from '@/systems/software/software';
import { generateMarketNews, recordWeeklySnapshot } from '@/systems/stats/history';
import { processContractsMonthly, processDeliveries } from '@/systems/supply/purchasing';
import { updateSupportAndReputation } from '@/systems/support/support';
import { payDailySalaries, weeklyWorkforceUpdate } from '@/systems/workforce/tick';
import { recomputeWorkforceStats } from '@/systems/workforce/employees';

/** Monatswechsel: Abschluss des Vormonats und monatliche Zahlungen. */
function processMonthStart(state: GameState): void {
  closeMonth(state);
  closeCompetitorMonth(state);
  for (const market of Object.values(state.markets)) {
    const total = Object.values(market.monthUnits).reduce((a, b) => a + b, 0);
    market.history.push({ month: state.finance.months[state.finance.months.length - 1]?.month ?? 0, total, player: market.monthUnits.player ?? 0 });
    if (market.history.length > 120) market.history.splice(0, market.history.length - 120);
    market.lastMonthUnits = market.monthUnits;
    market.monthUnits = {};
  }
  for (const product of state.products) {
    product.sales.bestMonthUnits = Math.max(product.sales.bestMonthUnits, product.sales.unitsThisMonth);
    product.sales.unitsThisMonth = 0;
  }
  state.company.support.ticketsLastMonth = 0;
  processContractsMonthly(state);
  resetMonthlyComponentOrders(state);
  processLoansMonthly(state);
  recordEconomySnapshot(state);
}

/**
 * Ein Simulationstag. Reihenfolge nach Spezifikation: Nachfrage → Marktpreise → Lieferungen →
 * Produktion → Lager → Bestellungen/Umsätze → Personal → Forschung → Kredite → Konkurrenz →
 * Ereignisse → Reputation → Nachrichten.
 */
export function runDay(state: GameState): void {
  if (state.status === 'bankrupt') return;
  state.time.day += 1;
  const day = state.time.day;
  const weekly = isWeekStart(day);
  if (state.workforce.statsDirty) recomputeWorkforceStats(state);
  if (isMonthStart(day)) processMonthStart(state);
  expireModifiers(state);

  updateMarketTrends(state, (sd) => gaussian(state, 0, sd));
  updateEconomy(state);
  updateComponentMarket(state);

  processDeliveries(state);
  processContractManufacturing(state);
  progressDevelopment(state);

  processFactories(state);
  runProduction(state);
  processWarehouses(state);

  simulateMarkets(state);
  updateProductReception(state);
  processChannelCosts(state);
  processRegions(state);
  updateMarketingAndBrand(state);

  payDailySalaries(state);
  processCompany(state);
  if (weekly) weeklyWorkforceUpdate(state);

  progressResearch(state);
  progressSoftware(state);

  processOverdraft(state);
  updateCompetitors(state);

  processDecisionDeadlines(state);
  if (weekly) checkEvents(state);

  updateSupportAndReputation(state);
  updateStockDaily(state);
  processFundingOffers(state);

  if (weekly) {
    recordWeeklySnapshot(state);
    generateMarketNews(state);
    checkAchievements(state);
    updateCompanyStage(state);
  }
  checkInsolvency(state);
}

/**
 * Simuliert mehrere Tage. Die Simulation arbeitet aus Performancegründen auf einer
 * tiefen Arbeitskopie (statt Immer-Drafts); der übergebene Zustand bleibt unverändert,
 * sodass UI und Speicherstände immer konsistente, unveränderliche Snapshots sehen.
 */
export function simulateDays(state: GameState, days: number): GameState {
  if (days <= 0 || state.status === 'bankrupt') return state;
  const working = structuredClone(state) as GameState;
  for (let i = 0; i < days; i++) {
    if (working.status === 'bankrupt') break;
    runDay(working);
  }
  return working;
}
