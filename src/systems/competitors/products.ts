import { CATEGORIES } from '@/data/categories';
import { COMPETITORS } from '@/data/competitors';
import { yearOf } from '@/simulation/calendar';
import { gaussian, randomRange, type RngHolder } from '@/simulation/rng';
import type { AttributeKey, Competitor, CompetitorProduct, CompetitorStrategy, ProductAttributes, ProductCategoryId, Tier } from '@/types';
import { clamp } from '@/utils/math';

type BaseAttrs = Omit<ProductAttributes, 'performance'>;

const STRATEGY_ATTRIBUTES: Record<CompetitorStrategy, BaseAttrs> = {
  budget: { quality: 52, durability: 55, efficiency: 55, acoustics: 50, thermals: 55, design: 45, repairability: 60, battery: 58, display: 50, camera: 48, software: 52, innovation: 30 },
  premium: { quality: 86, durability: 78, efficiency: 72, acoustics: 70, thermals: 68, design: 90, repairability: 30, battery: 70, display: 85, camera: 85, software: 82, innovation: 68 },
  gaming: { quality: 72, durability: 68, efficiency: 50, acoustics: 55, thermals: 70, design: 72, repairability: 62, battery: 50, display: 78, camera: 55, software: 65, innovation: 62 },
  business: { quality: 80, durability: 84, efficiency: 70, acoustics: 72, thermals: 70, design: 62, repairability: 72, battery: 72, display: 68, camera: 60, software: 75, innovation: 45 },
  innovation: { quality: 76, durability: 68, efficiency: 72, acoustics: 64, thermals: 64, design: 80, repairability: 40, battery: 68, display: 84, camera: 80, software: 74, innovation: 88 },
};

const TIER_PERFORMANCE: Record<Tier, number> = { budget: 44, mainstream: 62, performance: 79, enthusiast: 93 };
const TIER_BONUS: Record<Tier, number> = { budget: -10, mainstream: 0, performance: 5, enthusiast: 8 };
const TIER_PRICE: Record<Tier, number> = { budget: 0.6, mainstream: 0.95, performance: 1.45, enthusiast: 2.2 };
const STRATEGY_MARKUP: Record<CompetitorStrategy, number> = { budget: 0.86, business: 1.02, gaming: 1.03, innovation: 1.08, premium: 1.22 };
const COST_SHARE: Record<CompetitorStrategy, number> = { budget: 0.83, business: 0.72, gaming: 0.72, innovation: 0.68, premium: 0.58 };
const TIER_SUFFIX: Record<Tier, string> = { budget: 'Lite', mainstream: '', performance: 'Pro', enthusiast: 'Ultra' };

export const TIER_PREFERENCE: Record<CompetitorStrategy, Tier[]> = {
  budget: ['budget', 'mainstream', 'performance'],
  premium: ['performance', 'enthusiast', 'mainstream'],
  gaming: ['mainstream', 'performance', 'enthusiast'],
  business: ['mainstream', 'budget', 'performance'],
  innovation: ['enthusiast', 'performance', 'mainstream'],
};

export const LIFECYCLE_DAYS: Record<CompetitorStrategy, number> = { budget: 400, premium: 365, gaming: 330, business: 420, innovation: 300 };

const TUNED_ATTRIBUTES: AttributeKey[] = ['quality', 'design', 'display', 'camera', 'innovation', 'software'];

export function competitorProductName(competitor: Competitor, category: ProductCategoryId, tier: Tier, releaseDay: number, counterEdition = false): string {
  const def = COMPETITORS.find((c) => c.id === competitor.id);
  const prefix = def?.productPrefix[category] ?? `${competitor.shortName} ${CATEGORIES[category].shortName}`;
  const model = yearOf(Math.max(0, releaseDay)) - 2009 + (releaseDay < 0 ? -1 : 0);
  const suffix = counterEdition ? 'X' : TIER_SUFFIX[tier];
  return `${prefix} ${model}${suffix ? ` ${suffix}` : ''}`;
}

export function generateCompetitorProduct(
  rng: RngHolder,
  competitor: Competitor,
  category: ProductCategoryId,
  tier: Tier,
  releaseDay: number,
  priceLevel: number,
  options: { priceOverride?: number; performanceBoost?: number; counterEdition?: boolean } = {},
): CompetitorProduct {
  const cat = CATEGORIES[category];
  const base = STRATEGY_ATTRIBUTES[competitor.strategy];
  const tierBonus = TIER_BONUS[tier];
  const attributes = {} as ProductAttributes;
  for (const key of Object.keys(base) as (keyof BaseAttrs)[]) {
    let value = base[key];
    if (TUNED_ATTRIBUTES.includes(key)) value += tierBonus;
    if (key === 'repairability') value = (value + cat.repairabilityBase) / 2;
    attributes[key] = clamp(value + gaussian(rng, 0, 4), 5, 98);
  }
  const performance = TIER_PERFORMANCE[tier] * (1 + competitor.techLead * 0.12) + gaussian(rng, 0, 3) + (options.performanceBoost ?? 0);
  attributes.performance = clamp(performance, 10, 100);
  if (!cat.relevantAttributes.includes('battery')) attributes.battery = 0;
  if (!cat.relevantAttributes.includes('camera')) attributes.camera = 0;
  if (!cat.relevantAttributes.includes('display')) attributes.display = 0;

  const listPrice = cat.referencePrice * TIER_PRICE[tier] * STRATEGY_MARKUP[competitor.strategy] * priceLevel * randomRange(rng, 0.95, 1.05);
  const price = Math.round(options.priceOverride ?? listPrice) - 0.01;
  const unitCost = listPrice * COST_SHARE[competitor.strategy];
  const relevant = cat.relevantAttributes.filter((a) => attributes[a] > 0);
  const avg = relevant.reduce((a, k) => a + attributes[k], 0) / Math.max(1, relevant.length);
  const reviewScore = clamp(avg / 10 + 0.6 + gaussian(rng, 0, 0.4), 4, 9.6);
  competitor.productCounter += 1;
  return {
    id: `${competitor.id}-p${competitor.productCounter}`,
    name: competitorProductName(competitor, category, tier, releaseDay, options.counterEdition),
    category,
    tier,
    releaseDay,
    perfIndex: attributes.performance,
    attributes,
    price: Math.max(19.99, price),
    unitCost,
    reviewScore: Math.round(reviewScore * 10) / 10,
    unitsSold: 0,
    active: true,
    buzz: competitor.strategy === 'premium' || competitor.strategy === 'innovation' ? 0.4 : 0.25,
  };
}
