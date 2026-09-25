import { CATEGORIES } from '@/data/categories';
import { COMPETITORS, STRATEGY_LABELS } from '@/data/competitors';
import { DIFFICULTIES } from '@/data/difficulties';
import { FACTORY_LOCATIONS } from '@/data/locations';
import { REGION_IDS } from '@/data/regions';
import { addNews } from '@/simulation/news';
import { chance, gaussian, pick, randomInt, randomRange } from '@/simulation/rng';
import type { Competitor, CompetitorProduct, GameState, ProductCategoryId, RegionId, Tier } from '@/types';
import { clamp, pushCapped } from '@/utils/math';
import { PLAYER_OWNER } from '@/systems/market/demand';
import { generateCompetitorProduct, LIFECYCLE_DAYS, TIER_PREFERENCE } from './products';

const VALUATION_MULTIPLE: Record<Competitor['strategy'], number> = { premium: 5, innovation: 4.5, gaming: 2.6, business: 2.1, budget: 1.3 };

export function createCompetitors(state: GameState): Competitor[] {
  const competitors: Competitor[] = [];
  for (const def of COMPETITORS) {
    const awareness = {} as Record<RegionId, number>;
    for (const region of REGION_IDS) awareness[region] = def.awareness[region] ?? 0.4;
    const competitor: Competitor = {
      id: def.id,
      name: def.name,
      shortName: def.shortName,
      color: def.color,
      strategy: def.strategy,
      description: def.description,
      cash: def.cash,
      revenueMonth: 0,
      profitMonth: 0,
      revenueLastMonth: 0,
      profitLastMonth: 0,
      revenueHistory: [],
      valuation: 0,
      techLead: def.techLead,
      marketingPower: def.marketingPower,
      brand: { awareness, ...def.brand },
      focus: { ...def.focus },
      products: [],
      factories: def.factories,
      employees: def.employees,
      nextDecisionDay: randomInt(state, 20, 40),
      lastCounterDay: {},
      productCounter: 0,
      sharePrice: randomRange(state, 40, 180),
      priceAggression: def.priceAggression,
    };
    const lifecycle = LIFECYCLE_DAYS[def.strategy];
    for (const [category, focus] of Object.entries(def.focus) as [ProductCategoryId, number][]) {
      if (focus < 0.3) continue;
      const count = focus >= 0.8 ? 3 : focus >= 0.5 ? 2 : 1;
      const tiers = TIER_PREFERENCE[def.strategy].slice(0, count);
      for (const tier of tiers) {
        const releaseDay = -randomInt(state, 20, Math.round(lifecycle * 0.95));
        competitor.products.push(generateCompetitorProduct(state, competitor, category, tier, releaseDay, 1));
      }
    }
    competitors.push(competitor);
  }
  return competitors;
}

function tierFromPrice(category: ProductCategoryId, price: number, priceLevel: number): Tier {
  const ratio = price / (CATEGORIES[category].referencePrice * priceLevel);
  if (ratio < 0.75) return 'budget';
  if (ratio < 1.2) return 'mainstream';
  if (ratio < 1.8) return 'performance';
  return 'enthusiast';
}

export function launchCompetitorProduct(
  state: GameState,
  competitor: Competitor,
  category: ProductCategoryId,
  tier: Tier,
  options: { priceOverride?: number; performanceBoost?: number; counterEdition?: boolean; replace?: CompetitorProduct } = {},
): CompetitorProduct {
  const product = generateCompetitorProduct(state, competitor, category, tier, state.time.day, state.economy.priceLevel, options);
  if (options.replace) options.replace.active = false;
  competitor.products.push(product);
  // Alte, inaktive Modelle begrenzen.
  const inactive = competitor.products.filter((p) => !p.active);
  if (inactive.length > 12) {
    const drop = new Set(inactive.slice(0, inactive.length - 12).map((p) => p.id));
    competitor.products = competitor.products.filter((p) => !drop.has(p.id));
  }
  return product;
}

function refreshLineup(state: GameState, competitor: Competitor): void {
  const lifecycle = LIFECYCLE_DAYS[competitor.strategy];
  const day = state.time.day;
  for (const product of competitor.products) {
    if (!product.active || day - product.releaseDay < lifecycle * randomRange(state, 0.9, 1.15)) continue;
    if ((competitor.focus[product.category] ?? 0) < 0.2) {
      product.active = false;
      continue;
    }
    const next = launchCompetitorProduct(state, competitor, product.category, product.tier, { replace: product });
    if (product.tier !== 'budget' || chance(state, 0.3)) {
      addNews(
        state,
        'competitor',
        'neutral',
        `${competitor.name} veröffentlicht ${next.name}`,
        `Neuer ${CATEGORIES[next.category].name} für ${Math.round(next.price).toLocaleString('de-DE')} € (${STRATEGY_LABELS[competitor.strategy].name}-Segment).`,
      );
    }
  }
}

function adjustPrices(state: GameState, competitor: Competitor): void {
  const aggression = competitor.priceAggression * DIFFICULTIES[state.difficulty].competitorAggression;
  const lifecycle = LIFECYCLE_DAYS[competitor.strategy];
  const day = state.time.day;
  for (const product of competitor.products) {
    if (!product.active) continue;
    const age = (day - product.releaseDay) / lifecycle;
    let change = 0;
    if (age > 0.55) change -= randomRange(state, 0.01, 0.035) * aggression;
    const market = state.markets[product.category];
    const playerShare = market.share[PLAYER_OWNER] ?? 0;
    if (playerShare > 0.01) {
      const cheaperPlayer = state.products.some(
        (p) => p.category === product.category && p.status === 'on_sale' && p.price < product.price * 1.05 && p.price > product.price * 0.6,
      );
      if (cheaperPlayer) change -= Math.min(0.06, playerShare * 0.5) * aggression;
    }
    if (change === 0 && chance(state, 0.1)) change = 0.01;
    product.price = Math.max(product.unitCost * 1.02, Math.round(product.price * (1 + change) * 100) / 100);
  }
}

function reactToPlayer(state: GameState, competitor: Competitor): void {
  const aggression = DIFFICULTIES[state.difficulty].competitorAggression;
  const day = state.time.day;
  for (const categoryId of Object.keys(state.markets) as ProductCategoryId[]) {
    const share = state.markets[categoryId].share[PLAYER_OWNER] ?? 0;
    if (share < 0.015) continue;
    const focus = competitor.focus[categoryId] ?? 0;
    const strategyFit =
      (competitor.strategy === 'gaming' && ['gaming_pc', 'gaming_laptop', 'graphics_card', 'monitor'].includes(categoryId)) ||
      (competitor.strategy === 'business' && ['desktop', 'laptop', 'server'].includes(categoryId)) ||
      focus >= 0.5;
    if (!strategyFit) {
      if (share > 0.05 && focus < 0.3 && chance(state, 0.04 * aggression)) {
        competitor.focus[categoryId] = 0.4;
        const product = launchCompetitorProduct(state, competitor, categoryId, TIER_PREFERENCE[competitor.strategy][0]);
        addNews(state, 'competitor', 'negative', `${competitor.name} steigt in den Markt für ${CATEGORIES[categoryId].pluralName} ein`, `Mit ${product.name} greift ${competitor.shortName} den wachsenden Markt an.`);
      }
      continue;
    }
    const last = competitor.lastCounterDay[categoryId] ?? -9999;
    if (day - last < 200 || !chance(state, Math.min(0.6, (0.15 + share * 3) * aggression))) continue;
    const best = state.products
      .filter((p) => p.category === categoryId && p.status === 'on_sale')
      .sort((a, b) => b.sales.unitsLast30 - a.sales.unitsLast30)[0];
    if (!best) continue;
    const tier = tierFromPrice(categoryId, best.price, state.economy.priceLevel);
    const product = launchCompetitorProduct(state, competitor, categoryId, tier, {
      priceOverride: best.price * randomRange(state, 0.9, 0.98),
      performanceBoost: 3,
      counterEdition: true,
    });
    competitor.lastCounterDay[categoryId] = day;
    competitor.focus[categoryId] = Math.min(1, focus + 0.1);
    for (const region of REGION_IDS) competitor.brand.awareness[region] = Math.min(0.97, competitor.brand.awareness[region] * 1.02);
    addNews(
      state,
      'competitor',
      'negative',
      `${competitor.name} kontert: ${product.name}`,
      `Der Erfolg von ${state.company.name} bei ${CATEGORIES[categoryId].pluralName} ruft ${competitor.shortName} auf den Plan – ${product.name} kostet nur ${Math.round(product.price).toLocaleString('de-DE')} €.`,
    );
  }
}

function monthlyFinance(state: GameState, competitor: Competitor): void {
  competitor.revenueLastMonth = competitor.revenueMonth;
  const overhead = competitor.employees * 5_200 * state.economy.wageIndex * 0.35;
  competitor.profitLastMonth = competitor.profitMonth - overhead;
  competitor.cash += competitor.profitLastMonth;
  pushCapped(competitor.revenueHistory, competitor.revenueLastMonth, 60);
  const annual = competitor.revenueHistory.slice(-12).reduce((a, b) => a + b, 0) * (12 / Math.min(12, competitor.revenueHistory.length));
  const previous = competitor.valuation;
  competitor.valuation = Math.max(1e9, annual * VALUATION_MULTIPLE[competitor.strategy] + Math.max(0, competitor.cash) * 0.5);
  if (previous > 0) competitor.sharePrice = Math.max(1, competitor.sharePrice * (competitor.valuation / previous) * (1 + gaussian(state, 0, 0.02)));
  competitor.revenueMonth = 0;
  competitor.profitMonth = 0;
  const growth = competitor.revenueHistory.length >= 2 ? competitor.revenueLastMonth / Math.max(1, competitor.revenueHistory[competitor.revenueHistory.length - 2]) - 1 : 0;
  competitor.employees = Math.max(500, Math.round(competitor.employees * (1 + clamp(growth, -0.02, 0.02))));
}

function occasionalMoves(state: GameState, competitor: Competitor): void {
  if (chance(state, 0.025)) {
    competitor.factories += 1;
    const location = pick(state, FACTORY_LOCATIONS);
    for (const product of competitor.products) product.unitCost *= 0.99;
    addNews(state, 'competitor', 'neutral', `${competitor.name} eröffnet neue Fabrik in ${location.name}`, `${competitor.shortName} betreibt jetzt ${competitor.factories} Werke.`);
  }
  const techDrift = competitor.strategy === 'innovation' ? 0.01 : competitor.strategy === 'budget' ? -0.005 : 0.003;
  competitor.techLead = clamp(competitor.techLead + techDrift + gaussian(state, 0, 0.02), -1, 1);
  const def = COMPETITORS.find((c) => c.id === competitor.id);
  for (const region of REGION_IDS) {
    const base = def?.awareness[region] ?? 0.4;
    const target = clamp(base * (0.9 + competitor.marketingPower * 0.15), 0.05, 0.97);
    competitor.brand.awareness[region] = clamp(competitor.brand.awareness[region] + (target - competitor.brand.awareness[region]) * 0.05 + gaussian(state, 0, 0.005), 0.02, 0.98);
  }
}

export function updateCompetitors(state: GameState): void {
  const day = state.time.day;
  for (const competitor of state.competitors) {
    for (const product of competitor.products) if (product.active) product.buzz *= 0.99;
    if (day < competitor.nextDecisionDay) continue;
    competitor.nextDecisionDay = day + randomInt(state, 26, 34);
    refreshLineup(state, competitor);
    adjustPrices(state, competitor);
    reactToPlayer(state, competitor);
    occasionalMoves(state, competitor);
  }
}

export function closeCompetitorMonth(state: GameState): void {
  for (const competitor of state.competitors) monthlyFinance(state, competitor);
}
