import { CATEGORIES, CATEGORY_IDS } from '@/data/categories';
import { DIFFICULTIES } from '@/data/difficulties';
import { REGION_IDS, REGIONS } from '@/data/regions';
import { SEGMENT_IDS, SEGMENTS } from '@/data/segments';
import { dateOf } from '@/simulation/calendar';
import { multiplier } from '@/simulation/modifiers';
import { stochasticRound } from '@/simulation/rng';
import type { Competitor, CompetitorProduct, GameState, Product, ProductCategoryId, RegionId, SegmentId } from '@/types';
import { clamp, pushCapped } from '@/utils/math';
import { addTransaction, recordCogs } from '@/systems/finance/ledger';
import { exportCostPerUnit, logisticsCostFactor } from '@/systems/logistics/logistics';
import { companySoftwareScore, currentAttributes } from '@/systems/products/design';
import { channelMix, type ChannelMix } from './channels';
import { offerUtility, outsideUtility, seasonality, seasonalityForMonth, strategySegmentAffinity, type BrandValues } from './utility';

export const PLAYER_OWNER = 'player';
export const OTHER_OWNER = 'other';

interface Offer {
  owner: string;
  product?: Product;
  competitorProduct?: CompetitorProduct;
  competitor?: Competitor;
  price: number;
  /** exp(Nutzen) × Verfügbarkeit je Segmentindex. */
  weight: Float64Array;
}

export interface PlayerDemand {
  total: number;
  byRegion: Partial<Record<RegionId, number>>;
  bySegment: Partial<Record<SegmentId, number>>;
}

const SEGMENT_COUNT = SEGMENT_IDS.length;

/** Nachfrage des gesamten Segments pro Tag in einer Region. */
export function segmentMarketSize(state: GameState, categoryId: ProductCategoryId, region: RegionId, segment: SegmentId): number {
  const category = CATEGORIES[categoryId];
  const market = state.markets[categoryId];
  const regionDef = REGIONS[region];
  return (
    (category.baseMonthlyUnits *
      market.trend *
      regionDef.marketShare *
      (regionDef.categoryAffinity[categoryId] ?? 1) *
      category.segmentMix[segment] *
      state.economy.consumerConfidence *
      seasonality(categoryId, state.time.day) *
      multiplier(state, 'demand', { category: categoryId }) *
      multiplier(state, 'segmentDemand', { segment, category: categoryId })) /
    30.44
  );
}

function playerBrand(state: GameState): BrandValues {
  const brand = state.brand;
  return { trust: brand.trust, premium: brand.premium, innovation: brand.innovation, gaming: brand.gaming, business: brand.business };
}

function competitorBrand(competitor: Competitor): BrandValues {
  const b = competitor.brand;
  return { trust: b.trust, premium: b.premium, innovation: b.innovation, gaming: b.gaming, business: b.business };
}

function buildOffers(state: GameState, categoryId: ProductCategoryId): Offer[] {
  const offers: Offer[] = [];
  const priceLevel = state.economy.priceLevel;
  const day = state.time.day;
  const brand = playerBrand(state);
  const software = companySoftwareScore(state, categoryId);
  for (const product of state.products) {
    if (product.category !== categoryId || product.status !== 'on_sale') continue;
    if (product.quality.salesHaltUntil !== undefined && product.quality.salesHaltUntil > day) continue;
    const attributes = currentAttributes(state, categoryId, product.attributes, product.attributesDay, product.launchDay, software);
    const stock = state.inventory.products[product.id]?.qty ?? 0;
    const availability = stock > 0 ? 1 : product.sales.backorders > 0 ? 0.55 : 0.75;
    const input = { category: categoryId, price: product.price, attributes, brand, review: product.review?.overall ?? null, rating: product.customerRating, buzz: product.buzz };
    const weight = new Float64Array(SEGMENT_COUNT);
    for (let s = 0; s < SEGMENT_COUNT; s++) weight[s] = Math.exp(offerUtility(input, SEGMENT_IDS[s], priceLevel)) * availability;
    offers.push({ owner: PLAYER_OWNER, product, price: product.price, weight });
  }
  for (const competitor of state.competitors) {
    const cBrand = competitorBrand(competitor);
    for (const cp of competitor.products) {
      if (!cp.active || cp.category !== categoryId) continue;
      const attributes = currentAttributes(state, categoryId, cp.attributes, cp.releaseDay, cp.releaseDay, cp.attributes.software);
      const input = { category: categoryId, price: cp.price, attributes, brand: cBrand, review: cp.reviewScore, rating: 0, buzz: cp.buzz };
      const weight = new Float64Array(SEGMENT_COUNT);
      for (let s = 0; s < SEGMENT_COUNT; s++) weight[s] = Math.exp(offerUtility(input, SEGMENT_IDS[s], priceLevel));
      offers.push({ owner: competitor.id, competitorProduct: cp, competitor, price: cp.price, weight });
    }
  }
  return offers;
}

function playerCoverage(state: GameState, region: RegionId, mix: ChannelMix): number {
  const status = state.company.regions[region]?.status;
  if (status !== 'open') return 0;
  const hub = region === state.company.homeRegion || state.company.distributionCenters.includes(region) ? 1 : 0.8;
  return mix.coverage * hub;
}

export interface MarketDayResult {
  playerDemand: Map<string, PlayerDemand>;
  mixes: Record<SegmentId, ChannelMix>;
}

/** Werte, die für alle Kategorien eines Tages gleich sind. */
interface DayContext {
  month: number;
  difficultyDemand: number;
  /** Kaufkraftverschiebung je [Region × Segment]. */
  priceShift: Float64Array;
  /** Bekanntheit × Strategieaffinität der Konkurrenten je [Region × Segment]. */
  competitorConsideration: Map<string, Float64Array>;
}

function createDayContext(state: GameState): DayContext {
  const priceShift = new Float64Array(REGION_IDS.length * SEGMENT_COUNT);
  REGION_IDS.forEach((region, r) => {
    for (let s = 0; s < SEGMENT_COUNT; s++) priceShift[r * SEGMENT_COUNT + s] = REGIONS[region].purchasingPower ** SEGMENTS[SEGMENT_IDS[s]].priceSensitivity;
  });
  const competitorConsideration = new Map<string, Float64Array>();
  for (const competitor of state.competitors) {
    const table = new Float64Array(REGION_IDS.length * SEGMENT_COUNT);
    REGION_IDS.forEach((region, r) => {
      const awareness = competitor.brand.awareness[region] ?? 0;
      for (let s = 0; s < SEGMENT_COUNT; s++) table[r * SEGMENT_COUNT + s] = Math.min(1, awareness * strategySegmentAffinity(competitor.strategy, SEGMENT_IDS[s])) * 0.9;
    });
    competitorConsideration.set(competitor.id, table);
  }
  return { month: dateOf(state.time.day).getUTCMonth(), difficultyDemand: DIFFICULTIES[state.difficulty].demand, priceShift, competitorConsideration };
}

/** Berechnet die Tagesnachfrage einer Kategorie und verbucht Konkurrenzverkäufe. */
function simulateCategory(state: GameState, categoryId: ProductCategoryId, context: DayContext): MarketDayResult {
  const offers = buildOffers(state, categoryId);
  const market = state.markets[categoryId];
  const category = CATEGORIES[categoryId];
  const playerDemand = new Map<string, PlayerDemand>();
  const mixes = {} as Record<SegmentId, ChannelMix>;
  for (const segment of SEGMENT_IDS) mixes[segment] = channelMix(state, categoryId, segment);
  const regionCount = REGION_IDS.length;

  // Berücksichtigung (Bekanntheit × Reichweite) je Angebot und [Region × Segment].
  const playerConsideration = new Float64Array(regionCount * SEGMENT_COUNT);
  REGION_IDS.forEach((region, r) => {
    for (let s = 0; s < SEGMENT_COUNT; s++) {
      const segment = SEGMENT_IDS[s];
      playerConsideration[r * SEGMENT_COUNT + s] = (state.brand.awareness[region]?.[segment] ?? 0) * playerCoverage(state, region, mixes[segment]);
    }
  });
  const considerations = offers.map((offer) => (offer.owner === PLAYER_OWNER ? playerConsideration : context.competitorConsideration.get(offer.owner)!));
  const offerUnits = new Float64Array(offers.length);
  const playerRegionSegment = offers.map((offer) => (offer.owner === PLAYER_OWNER ? new Float64Array(regionCount * SEGMENT_COUNT) : null));

  const baseDaily =
    (category.baseMonthlyUnits *
      market.trend *
      state.economy.consumerConfidence *
      seasonalityForMonth(categoryId, context.month) *
      multiplier(state, 'demand', { category: categoryId })) /
    30.44;
  const segmentFactor = new Float64Array(SEGMENT_COUNT);
  const outside = new Float64Array(SEGMENT_COUNT);
  for (let s = 0; s < SEGMENT_COUNT; s++) {
    const segment = SEGMENT_IDS[s];
    const mix = category.segmentMix[segment];
    segmentFactor[s] = mix > 0 ? mix * multiplier(state, 'segmentDemand', { segment, category: categoryId }) : 0;
    outside[s] = Math.exp(outsideUtility(categoryId, segment));
  }

  let totalDemand = 0;
  let otherUnits = 0;
  const weights = new Float64Array(offers.length);
  for (let r = 0; r < regionCount; r++) {
    const regionDef = REGIONS[REGION_IDS[r]];
    const regionFactor = baseDaily * regionDef.marketShare * (regionDef.categoryAffinity[categoryId] ?? 1);
    for (let s = 0; s < SEGMENT_COUNT; s++) {
      const size = regionFactor * segmentFactor[s];
      if (size <= 0) continue;
      const cell = r * SEGMENT_COUNT + s;
      const shift = context.priceShift[cell];
      let denominator = outside[s];
      for (let i = 0; i < offers.length; i++) {
        const w = considerations[i][cell] * offers[i].weight[s] * shift;
        weights[i] = w;
        denominator += w;
      }
      totalDemand += size;
      otherUnits += (size * outside[s]) / denominator;
      for (let i = 0; i < offers.length; i++) {
        if (weights[i] <= 0) continue;
        const units = (size * weights[i]) / denominator;
        offerUnits[i] += units;
        const perCell = playerRegionSegment[i];
        if (perCell) perCell[cell] += units;
      }
    }
  }

  const unitsByOwner: Record<string, number> = { [OTHER_OWNER]: otherUnits };
  let competitorUnits = 0;
  let revenueWeighted = 0;
  offers.forEach((offer, i) => {
    const units = offerUnits[i];
    if (units <= 0) return;
    if (offer.owner === PLAYER_OWNER) {
      const perCell = playerRegionSegment[i]!;
      const entry: PlayerDemand = { total: 0, byRegion: {}, bySegment: {} };
      for (let r = 0; r < regionCount; r++) {
        for (let s = 0; s < SEGMENT_COUNT; s++) {
          const value = perCell[r * SEGMENT_COUNT + s] * context.difficultyDemand;
          if (value <= 0) continue;
          entry.total += value;
          entry.byRegion[REGION_IDS[r]] = (entry.byRegion[REGION_IDS[r]] ?? 0) + value;
          entry.bySegment[SEGMENT_IDS[s]] = (entry.bySegment[SEGMENT_IDS[s]] ?? 0) + value;
        }
      }
      playerDemand.set(offer.product!.id, entry);
      return;
    }
    const cp = offer.competitorProduct!;
    const competitor = offer.competitor!;
    cp.unitsSold += units;
    const revenue = units * cp.price * 0.85;
    competitor.revenueMonth += revenue;
    competitor.profitMonth += revenue - units * cp.unitCost;
    unitsByOwner[offer.owner] = (unitsByOwner[offer.owner] ?? 0) + units;
    competitorUnits += units;
    revenueWeighted += units * cp.price;
  });

  market.dailyDemand = totalDemand;
  for (const [owner, units] of Object.entries(unitsByOwner)) {
    market.monthUnits[owner] = (market.monthUnits[owner] ?? 0) + units;
    market.rolling[owner] = (market.rolling[owner] ?? 0) * (29 / 30) + units;
  }
  if (competitorUnits > 0) market.averagePrice = market.averagePrice * 0.97 + (revenueWeighted / competitorUnits) * 0.03;
  return { playerDemand, mixes };
}

function updateRollingShares(state: GameState, categoryId: ProductCategoryId, playerUnits: number): void {
  const market = state.markets[categoryId];
  market.rolling[PLAYER_OWNER] = (market.rolling[PLAYER_OWNER] ?? 0) * (29 / 30) + playerUnits;
  market.monthUnits[PLAYER_OWNER] = (market.monthUnits[PLAYER_OWNER] ?? 0) + playerUnits;
  let total = 0;
  for (const value of Object.values(market.rolling)) total += value;
  const share: Record<string, number> = {};
  if (total > 0) for (const [owner, value] of Object.entries(market.rolling)) share[owner] = value / total;
  market.share = share;
}

/** Verkauft verfügbare Ware, bedient Rückstände und verbucht Umsatz, Kosten und Statistik. */
function executePlayerSales(state: GameState, product: Product, demand: PlayerDemand | undefined, mixes: Record<SegmentId, ChannelMix>): number {
  const sales = product.sales;
  const category = CATEGORIES[product.category];
  const stockEntry = state.inventory.products[product.id];
  let stock = stockEntry?.qty ?? 0;
  const demandUnits = demand ? stochasticRound(state, demand.total) : 0;
  sales.demandToday = demand?.total ?? 0;

  const shipBackorders = Math.min(sales.backorders, stock);
  stock -= shipBackorders;
  sales.backorders -= shipBackorders;
  const shipNew = Math.min(demandUnits, stock);
  stock -= shipNew;
  const unfilled = demandUnits - shipNew;
  if (unfilled > 0 && demand) {
    let patience = 0;
    for (const [segment, units] of Object.entries(demand.bySegment) as [SegmentId, number][]) {
      patience += (units / Math.max(1e-9, demand.total)) * SEGMENTS[segment].patience;
    }
    const waiting = stochasticRound(state, unfilled * patience);
    sales.backorders += waiting;
    sales.lostSales += unfilled - waiting;
  }
  if (sales.backorders > 0) {
    const cancelRate = 0.035 + Math.min(0.08, sales.backorders / Math.max(20, (sales.unitsLast30 / 30) * 60) * 0.02);
    const cancelled = stochasticRound(state, sales.backorders * cancelRate);
    sales.backorders -= cancelled;
    sales.cancellations += cancelled;
  }

  const shipped = shipBackorders + shipNew;
  let revenue = 0;
  if (shipped > 0 && stockEntry) {
    stockEntry.qty = stock;
    // Kanalmix und Regionen gewichtet nach Nachfrage.
    let marginCut = 0;
    let fulfillmentShare = 0;
    let weightSum = 0;
    const segmentWeights = demand && demand.total > 0 ? demand.bySegment : { mainstream: 1 };
    for (const [segment, units] of Object.entries(segmentWeights) as [SegmentId, number][]) {
      const mix = mixes[segment];
      marginCut += units * mix.marginCut;
      fulfillmentShare += units * mix.fulfillmentShare;
      weightSum += units;
    }
    marginCut = weightSum > 0 ? marginCut / weightSum : 0.05;
    fulfillmentShare = weightSum > 0 ? fulfillmentShare / weightSum : 1;
    const netPrice = product.price * (1 - marginCut);
    revenue = netPrice * shipped;
    const cogs = stockEntry.avgCost * shipped;
    let logistics = category.fulfillmentCost * state.economy.priceLevel * fulfillmentShare * logisticsCostFactor(state) * shipped;
    if (demand && demand.total > 0) {
      for (const [region, units] of Object.entries(demand.byRegion) as [RegionId, number][]) {
        if (region === state.company.homeRegion) continue;
        logistics += exportCostPerUnit(state, region, category.productVolume, product.price) * shipped * (units / demand.total);
      }
      for (const [segment, units] of Object.entries(demand.bySegment) as [SegmentId, number][]) {
        sales.segmentUnits[segment] = (sales.segmentUnits[segment] ?? 0) + shipped * (units / demand.total);
      }
    }
    addTransaction(state, 'sales', revenue);
    recordCogs(state, cogs);
    addTransaction(state, 'logistics', -logistics);
    sales.unitsSold += shipped;
    sales.revenue += revenue;
    sales.grossProfit += revenue - cogs - logistics;
    sales.unitsThisMonth += shipped;
    sales.installedBase += shipped;
    sales.warrantyPool += shipped;
    state.stats.unitsSoldTotal += shipped;
    state.stats.week.unitsSold += shipped;
    state.stats.month.unitsSold += shipped;
    state.finance.lifetime.unitsSold += shipped;
  }

  sales.unitsLast30 += shipped - (sales.daily.length >= 30 ? sales.daily[0] : 0);
  sales.revenueLast30 += revenue - (sales.dailyRevenue.length >= 30 ? sales.dailyRevenue[0] : 0);
  pushCapped(sales.daily, shipped, 30);
  pushCapped(sales.dailyRevenue, revenue, 30);
  sales.installedBase *= 1 - 1 / 1_095;
  sales.warrantyPool *= 1 - 1 / 365;
  return shipped;
}

export function simulateMarkets(state: GameState): void {
  const context = createDayContext(state);
  for (const categoryId of CATEGORY_IDS) {
    const hasOffers =
      state.products.some((p) => p.category === categoryId && p.status === 'on_sale') ||
      state.competitors.some((c) => c.products.some((p) => p.active && p.category === categoryId));
    const market = state.markets[categoryId];
    if (!hasOffers) {
      market.dailyDemand = 0;
      continue;
    }
    const result = simulateCategory(state, categoryId, context);
    let playerUnits = 0;
    for (const product of state.products) {
      if (product.category !== categoryId || product.status !== 'on_sale') continue;
      playerUnits += executePlayerSales(state, product, result.playerDemand.get(product.id), result.mixes);
    }
    updateRollingShares(state, categoryId, playerUnits);
  }
}

/** Marktanteil des Spielers über alle Kategorien, in denen er aktiv ist (gewichtet nach Volumen). */
export function overallPlayerShare(state: GameState): number {
  let player = 0;
  let total = 0;
  for (const categoryId of CATEGORY_IDS) {
    const market = state.markets[categoryId];
    const playerRolling = market.rolling[PLAYER_OWNER] ?? 0;
    if (playerRolling <= 0) continue;
    player += playerRolling;
    total += Object.values(market.rolling).reduce((a, b) => a + b, 0);
  }
  return total > 0 ? player / total : 0;
}

export function playerShare(state: GameState, categoryId: ProductCategoryId): number {
  return state.markets[categoryId].share[PLAYER_OWNER] ?? 0;
}

/** Tagesaktualisierung der Kategorie-Trends (Wachstum, Zufall). */
export function updateMarketTrends(state: GameState, noise: (sd: number) => number): void {
  const volatility = DIFFICULTIES[state.difficulty].marketVolatility;
  for (const categoryId of CATEGORY_IDS) {
    const market = state.markets[categoryId];
    const base = CATEGORIES[categoryId].annualGrowth;
    market.growth = clamp(market.growth + 0.004 * (base - market.growth) + noise(0.0012 * volatility), -0.3, 0.5);
    market.trend = clamp(market.trend * (1 + market.growth) ** (1 / 365), 0.2, 20);
  }
}
