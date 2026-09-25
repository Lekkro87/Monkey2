import { CATEGORIES } from '@/data/categories';
import { SEGMENTS } from '@/data/segments';
import { dateOf } from '@/simulation/calendar';
import type {
  AttributeKey,
  BrandAttribute,
  CompetitorStrategy,
  CustomerSegmentDef,
  ProductAttributes,
  ProductCategoryDef,
  ProductCategoryId,
  SegmentId,
} from '@/types';

export const BRAND_WEIGHT = 1.6;
export const REVIEW_WEIGHT = 0.9;
export const RATING_WEIGHT = 0.5;
export const BUZZ_WEIGHT = 0.8;
export const OUTSIDE_QUALITY = 0.55;
export const OUTSIDE_BRAND = 0.45;

/** Stärke der „anderen Hersteller“ je Kategorie (Anzahl durchschnittlicher Angebote). */
export const OUTSIDE_WEIGHT: Record<ProductCategoryId, number> = {
  desktop: 3.5,
  gaming_pc: 3,
  laptop: 3.5,
  gaming_laptop: 3,
  smartphone: 4,
  tablet: 3,
  monitor: 5,
  graphics_card: 9,
  processor: 10,
  mainboard: 8,
  server: 5,
  smartwatch: 3.5,
};

export type BrandValues = Record<BrandAttribute, number>;

export function segmentQuality(category: ProductCategoryDef, segment: CustomerSegmentDef, attributes: ProductAttributes): number {
  let total = 0;
  let weight = 0;
  for (const [attr, w] of Object.entries(segment.attributeWeights) as [AttributeKey, number][]) {
    if (!category.relevantAttributes.includes(attr)) continue;
    total += w * attributes[attr];
    weight += w;
  }
  return weight > 0 ? total / weight / 100 : 0.5;
}

export function brandFit(segment: CustomerSegmentDef, brand: BrandValues): number {
  let total = 0;
  let weight = 0;
  for (const [attr, w] of Object.entries(segment.brandWeights) as [BrandAttribute, number][]) {
    total += (w * brand[attr]) / 100;
    weight += Math.abs(w);
  }
  return weight > 0 ? total / weight : 0.4;
}

export function referencePrice(categoryId: ProductCategoryId, segmentId: SegmentId, priceLevel: number): number {
  return CATEGORIES[categoryId].referencePrice * SEGMENTS[segmentId].priceMultiplier * priceLevel;
}

export interface UtilityInput {
  category: ProductCategoryId;
  price: number;
  attributes: ProductAttributes;
  brand: BrandValues;
  review: number | null;
  rating: number;
  buzz: number;
}

/** Nutzen eines Angebots für ein Kundensegment (ohne Bekanntheit/Reichweite). */
export function offerUtility(input: UtilityInput, segmentId: SegmentId, priceLevel: number): number {
  const category = CATEGORIES[input.category];
  const segment = SEGMENTS[segmentId];
  const quality = segmentQuality(category, segment, input.attributes);
  const fit = brandFit(segment, input.brand);
  const ref = referencePrice(input.category, segmentId, priceLevel);
  const priceTerm = -segment.priceSensitivity * Math.log(Math.max(1, input.price) / ref);
  const review = input.review === null ? 0 : (input.review - 6.5) / 3.5;
  const rating = input.rating > 0 ? (input.rating - 3.8) / 1.2 : 0;
  return segment.qualitySensitivity * quality + BRAND_WEIGHT * fit + priceTerm + REVIEW_WEIGHT * review + RATING_WEIGHT * rating + BUZZ_WEIGHT * input.buzz;
}

export function outsideUtility(categoryId: ProductCategoryId, segmentId: SegmentId): number {
  const segment = SEGMENTS[segmentId];
  return segment.qualitySensitivity * OUTSIDE_QUALITY + BRAND_WEIGHT * OUTSIDE_BRAND + Math.log(OUTSIDE_WEIGHT[categoryId]);
}

/** Saisonale Nachfrage (Weihnachtsgeschäft, Schulstart). */
export function seasonality(categoryId: ProductCategoryId, day: number): number {
  return seasonalityForMonth(categoryId, dateOf(day).getUTCMonth());
}

export function seasonalityForMonth(categoryId: ProductCategoryId, month: number): number {
  if (categoryId === 'server' || categoryId === 'processor') return 1;
  const base = [0.86, 0.9, 0.95, 0.95, 0.96, 0.95, 0.97, 1.03, 1.06, 1.02, 1.15, 1.3][month];
  if ((categoryId === 'laptop' || categoryId === 'tablet') && (month === 7 || month === 8)) return base + 0.08;
  return base;
}

/** Segmentfaktor der Bekanntheit von Konkurrenten je nach Strategie. */
export function strategySegmentAffinity(strategy: CompetitorStrategy, segment: SegmentId): number {
  switch (strategy) {
    case 'gaming':
      return segment === 'gamer' ? 1.1 : segment === 'enthusiast' ? 1 : 0.7;
    case 'business':
      return segment === 'business' ? 1.15 : 0.85;
    case 'premium':
      return segment === 'enthusiast' || segment === 'creative' ? 1.1 : segment === 'budget' ? 0.8 : 1;
    case 'budget':
      return segment === 'budget' ? 1.1 : segment === 'mainstream' ? 1 : 0.75;
    case 'innovation':
      return segment === 'enthusiast' ? 1.1 : segment === 'creative' ? 1.05 : 0.85;
  }
}
