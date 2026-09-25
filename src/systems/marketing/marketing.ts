import { MARKETING_CHANNELS } from '@/data/channels';
import { REGION_IDS, REGIONS } from '@/data/regions';
import { SEGMENT_IDS } from '@/data/segments';
import { ensure, nextId } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import type { BrandAttribute, GameState, MarketingChannelId, RegionId, SegmentId } from '@/types';
import { clamp } from '@/utils/math';
import { addTransaction } from '@/systems/finance/ledger';
import { techEffects } from '@/systems/research/effects';
import { departmentCapacity } from '@/systems/workforce/employees';
import { segmentMarketSize } from '@/systems/market/demand';

/** Budget in EUR pro Tag, das eine Marketing-Vollzeitkraft wirksam steuern kann. */
export const BUDGET_PER_MARKETER = 6_000;
/** Skalierung: Budget pro Tag, das in einer Region mit 23 % Weltmarktanteil ~1 % Bekanntheit/Tag bringt. */
const REACH_SCALE = 350_000;

export function marketingMultiplier(state: GameState): number {
  const totalBudget = state.marketing.campaigns.reduce((a, c) => (c.endDay > state.time.day ? a + c.dailyBudget : a), 0);
  const required = totalBudget / BUDGET_PER_MARKETER;
  const coverage = required < 0.2 ? 1 : clamp(departmentCapacity(state, 'marketing') / required, 0, 1);
  return (0.55 + 0.45 * coverage) * (1 + techEffects(state).marketingEfficiency);
}

export function startCampaign(
  state: GameState,
  channelId: MarketingChannelId,
  region: RegionId,
  dailyBudget: number,
  durationDays: number,
  productId?: string,
): string {
  const channel = MARKETING_CHANNELS[channelId];
  ensure(channel, 'Unbekannter Marketingkanal.');
  ensure(state.company.stage >= channel.minStage, `${channel.name} ist erst ab Unternehmensstufe ${channel.minStage} verfügbar.`);
  ensure(state.company.regions[region]?.status === 'open', 'In dieser Region bist du noch nicht aktiv.');
  ensure(Number.isFinite(dailyBudget) && dailyBudget >= channel.minDailyBudget, `Mindestbudget: ${channel.minDailyBudget.toLocaleString('de-DE')} € pro Tag.`);
  ensure(dailyBudget <= channel.maxDailyBudget, `Maximalbudget: ${channel.maxDailyBudget.toLocaleString('de-DE')} € pro Tag.`);
  ensure([7, 14, 30, 60, 90].includes(durationDays), 'Ungültige Laufzeit.');
  if (productId) {
    const product = state.products.find((p) => p.id === productId);
    ensure(product && (product.status === 'on_sale' || product.status === 'ready'), 'Das beworbene Produkt ist nicht verfügbar.');
  }
  const firstWeek = dailyBudget * Math.min(7, durationDays);
  ensure(state.finance.cash >= firstWeek, `Nicht genügend Kapital. Für die erste Woche werden ${Math.round(firstWeek).toLocaleString('de-DE')} € benötigt.`);
  state.marketing.campaigns.push({
    id: nextId(state, 'cmp'),
    channel: channelId,
    region,
    dailyBudget,
    startDay: state.time.day,
    endDay: state.time.day + durationDays,
    productId,
    spent: 0,
  });
  return `Kampagne „${channel.name}“ in ${REGIONS[region].name} gestartet (${Math.round(dailyBudget * durationDays).toLocaleString('de-DE')} € Gesamtbudget).`;
}

export function stopCampaign(state: GameState, campaignId: string): string {
  const campaign = state.marketing.campaigns.find((c) => c.id === campaignId);
  ensure(campaign && campaign.endDay > state.time.day, 'Kampagne nicht aktiv.');
  campaign.endDay = state.time.day;
  return 'Kampagne beendet.';
}

/** Täglich: Kampagnen bezahlen, Bekanntheit und Markenwerte fortschreiben. */
export function updateMarketingAndBrand(state: GameState): void {
  const day = state.time.day;
  const brand = state.brand;
  const multiplier = marketingMultiplier(state);
  const reach: Record<RegionId, Record<SegmentId, number>> = Object.fromEntries(
    REGION_IDS.map((r) => [r, Object.fromEntries(SEGMENT_IDS.map((s) => [s, 0]))]),
  ) as Record<RegionId, Record<SegmentId, number>>;
  const brandPush: Partial<Record<BrandAttribute, number>> = {};

  for (const campaign of state.marketing.campaigns) {
    if (campaign.endDay <= day || campaign.startDay > day) continue;
    if (state.finance.cash < campaign.dailyBudget) {
      campaign.endDay = day;
      addNews(state, 'company', 'negative', 'Kampagne mangels Kapital gestoppt', `${MARKETING_CHANNELS[campaign.channel].name} wurde vorzeitig beendet.`);
      continue;
    }
    addTransaction(state, 'marketing', -campaign.dailyBudget);
    campaign.spent += campaign.dailyBudget;
    state.marketing.spentTotal += campaign.dailyBudget;
    const channel = MARKETING_CHANNELS[campaign.channel];
    const regionScale = REACH_SCALE * (REGIONS[campaign.region].marketShare / 0.23) * state.economy.priceLevel;
    const effective = (campaign.dailyBudget * channel.efficiency * multiplier) / regionScale;
    for (const segment of SEGMENT_IDS) {
      reach[campaign.region][segment] += effective * channel.segmentAffinity[segment];
    }
    for (const [attr, value] of Object.entries(channel.brandEffects) as [BrandAttribute, number][]) {
      brandPush[attr] = (brandPush[attr] ?? 0) + value * Math.min(3, campaign.dailyBudget / (20_000 * state.economy.priceLevel));
    }
    if (campaign.productId) {
      const product = state.products.find((p) => p.id === campaign.productId);
      if (product) product.buzz = Math.min(1, product.buzz + channel.buzz * Math.min(0.02, effective * 2));
    }
  }

  // Mundpropaganda aus Verkäufen der letzten 30 Tage.
  const soldBySegment: Partial<Record<SegmentId, number>> = {};
  for (const product of state.products) {
    if (product.status !== 'on_sale' || product.sales.unitsLast30 <= 0) continue;
    const total = Object.values(product.sales.segmentUnits).reduce((a, b) => a + (b ?? 0), 0);
    for (const segment of SEGMENT_IDS) {
      const share = total > 0 ? (product.sales.segmentUnits[segment] ?? 0) / total : 1 / SEGMENT_IDS.length;
      soldBySegment[segment] = (soldBySegment[segment] ?? 0) + (product.sales.unitsLast30 / 30) * share;
    }
  }
  const satisfactionFactor = clamp(brand.satisfaction / 60, 0.3, 1.5);
  const playerCategories = [...new Set(state.products.filter((p) => p.status === 'on_sale').map((p) => p.category))];

  for (const region of REGION_IDS) {
    if (state.company.regions[region].status !== 'open') continue;
    for (const segment of SEGMENT_IDS) {
      const current = brand.awareness[region][segment];
      const gain = 1 - Math.exp(-reach[region][segment]);
      let marketSize = 0;
      if ((soldBySegment[segment] ?? 0) > 0) {
        for (const categoryId of playerCategories) marketSize += segmentMarketSize(state, categoryId, region, segment);
      }
      const regionShareOfSales = region === state.company.homeRegion ? 0.8 : 0.2 / Math.max(1, REGION_IDS.length - 1);
      const sold = (soldBySegment[segment] ?? 0) * regionShareOfSales;
      const wordOfMouth = marketSize > 0 ? 0.25 * (sold / marketSize) * satisfactionFactor : 0;
      const decay = 0.0012 * current;
      brand.awareness[region][segment] = clamp(current + (gain + wordOfMouth) * (1 - current) - decay, 0, 0.98);
    }
  }

  // Markenwerte nähern sich langsam dem an, was Produkte und Kampagnen vermitteln.
  const sold = state.products.filter((p) => p.status === 'on_sale' && p.sales.unitsLast30 > 0);
  const totalUnits = sold.reduce((a, p) => a + p.sales.unitsLast30, 0);
  if (totalUnits > 0) {
    let premium = 0;
    let innovation = 0;
    let gaming = 0;
    let business = 0;
    for (const product of sold) {
      const weight = product.sales.unitsLast30 / totalUnits;
      const priceRatio = product.price / Math.max(1, product.estimatedUnitCost * 1.3);
      premium += weight * clamp((product.attributes.design + product.attributes.quality) / 2 + (priceRatio - 1) * 20, 0, 100);
      innovation += weight * product.attributes.innovation;
      const segments = product.sales.segmentUnits;
      const segTotal = Object.values(segments).reduce((a, b) => a + (b ?? 0), 0) || 1;
      gaming += weight * clamp(((segments.gamer ?? 0) + (segments.enthusiast ?? 0) * 0.5) / segTotal * 160, 0, 100);
      business += weight * clamp((segments.business ?? 0) / segTotal * 200, 0, 100);
    }
    brand.premium += (premium - brand.premium) * 0.004;
    brand.innovation += (innovation - brand.innovation) * 0.004;
    brand.gaming += (gaming - brand.gaming) * 0.004;
    brand.business += (business - brand.business) * 0.004;
  }
  for (const [attr, value] of Object.entries(brandPush) as [BrandAttribute, number][]) {
    brand[attr] = clamp(brand[attr] + value * 0.05, 0, 100);
  }
  const trustTarget = clamp(0.6 * brand.satisfaction + 0.4 * brand.reputation, 0, 100);
  brand.trust += (trustTarget - brand.trust) * 0.004;

  state.marketing.campaigns = state.marketing.campaigns.filter((c) => c.endDay > day || day - c.endDay < 60);
}

/** Durchschnittliche Bekanntheit über alle Segmente einer Region. */
export function averageAwareness(state: GameState, region: RegionId = state.company.homeRegion): number {
  const values = state.brand.awareness[region];
  return SEGMENT_IDS.reduce((a, s) => a + values[s], 0) / SEGMENT_IDS.length;
}
