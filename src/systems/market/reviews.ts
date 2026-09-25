import { CATEGORIES } from '@/data/categories';
import { REVIEW_OUTLETS } from '@/data/names';
import { SEGMENTS } from '@/data/segments';
import { addNews } from '@/simulation/news';
import { gaussian, pickDistinct, randomInt } from '@/simulation/rng';
import type { GameState, Product, ProductAttributes, ProductCategoryId, ReviewCategory, SegmentId } from '@/types';
import { clamp } from '@/utils/math';
import { currentAttributes } from '@/systems/products/design';
import { offerUtility } from './utility';

export const REVIEW_DELAY_DAYS = 14;

export const REVIEW_CATEGORY_LABELS: Record<ReviewCategory, string> = {
  performance: 'Performance',
  price: 'Preis',
  design: 'Design',
  quality: 'Qualität',
  battery: 'Akku',
  acoustics: 'Lautstärke',
  software: 'Software',
  camera: 'Kamera',
};

const PRO_TEXT: Record<ReviewCategory, string> = {
  performance: 'Hervorragende Leistung',
  price: 'Sehr gutes Preis-Leistungs-Verhältnis',
  design: 'Edles Design',
  quality: 'Tadellose Verarbeitung',
  battery: 'Starke Akkulaufzeit',
  acoustics: 'Angenehm leise',
  software: 'Ausgereifte Software',
  camera: 'Überzeugende Kamera',
};

const CON_TEXT: Record<ReviewCategory, string> = {
  performance: 'Leistung nicht mehr zeitgemäß',
  price: 'Zu teuer für das Gebotene',
  design: 'Langweiliges Design',
  quality: 'Verarbeitung mit Schwächen',
  battery: 'Kurze Akkulaufzeit',
  acoustics: 'Laut unter Last',
  software: 'Unausgereifte Software',
  camera: 'Schwache Kamera',
};

/** Hauptzielgruppe einer Kategorie (für Preis-Leistungs-Bewertungen). */
export function mainSegment(categoryId: ProductCategoryId): SegmentId {
  const mix = CATEGORIES[categoryId].segmentMix;
  return (Object.entries(mix) as [SegmentId, number][]).sort((a, b) => b[1] - a[1])[0][0];
}

/** Preis-Leistungs-Wert 0–10 relativ zur aktiven Konkurrenz. */
export function valueScore(state: GameState, categoryId: ProductCategoryId, price: number, attributes: ProductAttributes): number {
  const segment = mainSegment(categoryId);
  const brand = { trust: 50, premium: 50, innovation: 50, gaming: 50, business: 50 };
  const own = offerUtility({ category: categoryId, price, attributes, brand, review: null, rating: 0, buzz: 0 }, segment, state.economy.priceLevel);
  let total = 0;
  let count = 0;
  for (const competitor of state.competitors) {
    for (const cp of competitor.products) {
      if (!cp.active || cp.category !== categoryId) continue;
      const attrs = currentAttributes(state, categoryId, cp.attributes, cp.releaseDay, cp.releaseDay);
      total += offerUtility({ category: categoryId, price: cp.price, attributes: attrs, brand, review: null, rating: 0, buzz: 0 }, segment, state.economy.priceLevel);
      count++;
    }
  }
  const reference = count > 0 ? total / count : own;
  const sensitivity = SEGMENTS[segment].priceSensitivity;
  return clamp(6.2 + (1.6 * (own - reference)) / Math.max(1, sensitivity * 0.6), 1, 10);
}

function categoryScore(key: ReviewCategory, attributes: ProductAttributes, value: number): number {
  switch (key) {
    case 'performance':
      return attributes.performance / 10;
    case 'price':
      return value;
    case 'design':
      return attributes.design / 10;
    case 'quality':
      return (attributes.quality + attributes.durability) / 20;
    case 'battery':
      return attributes.battery / 10;
    case 'acoustics':
      return attributes.acoustics / 10;
    case 'software':
      return attributes.software / 10;
    case 'camera':
      return attributes.camera / 10;
  }
}

export function publishReview(state: GameState, product: Product): void {
  const category = CATEGORIES[product.category];
  const attributes = currentAttributes(state, product.category, product.attributes, product.attributesDay, product.launchDay);
  const value = valueScore(state, product.category, product.price, attributes);
  const categories: Partial<Record<ReviewCategory, number>> = {};
  let weighted = 0;
  let weightSum = 0;
  for (const key of category.reviewCategories) {
    const score = clamp(categoryScore(key, attributes, value) * 1.05 + 0.3 + gaussian(state, 0, 0.35), 1, 10);
    categories[key] = Math.round(score * 10) / 10;
    const weight = key === 'performance' || key === 'price' ? 2 : 1;
    weighted += score * weight;
    weightSum += weight;
  }
  const overall = clamp(weighted / weightSum + gaussian(state, 0, 0.15), 1, 9.9);
  const sorted = (Object.entries(categories) as [ReviewCategory, number][]).sort((a, b) => b[1] - a[1]);
  const pros = sorted.filter(([, s]) => s >= 7).slice(0, 3).map(([k]) => PRO_TEXT[k]);
  const cons = sorted
    .filter(([, s]) => s < 6)
    .slice(-3)
    .reverse()
    .map(([k]) => CON_TEXT[k]);
  const outletCount = randomInt(state, 3, 5);
  const outlets = pickDistinct(state, REVIEW_OUTLETS, outletCount).map((outlet) => {
      const score = Math.round(clamp(overall + gaussian(state, 0, 0.5), 1, 10) * 10) / 10;
      const quote = score >= 8.5 ? pros[0] ?? 'Eine klare Empfehlung.' : score >= 7 ? `${pros[0] ?? 'Solides Gerät'}, aber ${cons[0]?.toLowerCase() ?? 'mit kleinen Schwächen'}.` : cons[0] ?? 'Nur mit Abstrichen zu empfehlen.';
      return { outlet, score, quote };
  });
  product.review = { day: state.time.day, overall: Math.round(overall * 10) / 10, categories, outlets, pros, cons };
  const best = outlets.reduce((a, b) => (b.score > a.score ? b : a), outlets[0]);
  const tone = overall >= 7.5 ? 'positive' : overall < 5.5 ? 'negative' : 'neutral';
  addNews(
    state,
    'company',
    tone,
    `${best.outlet}: ${product.name} erhält ${best.score.toLocaleString('de-DE', { minimumFractionDigits: 1 })}/10`,
    `Gesamtwertung aller Tests: ${product.review.overall.toLocaleString('de-DE', { minimumFractionDigits: 1 })}/10. ${pros.length > 0 ? `Stärken: ${pros.join(', ')}.` : ''} ${cons.length > 0 ? `Schwächen: ${cons.join(', ')}.` : ''}`.trim(),
  );
  if (overall >= 8.5) product.buzz = Math.min(1, product.buzz + 0.3);
  else if (overall >= 7.5) product.buzz = Math.min(1, product.buzz + 0.15);
  else if (overall < 5) product.buzz = Math.max(0, product.buzz - 0.2);
}

/** Tägliche Produktpflege: Tests, Kundenbewertungen, Hype, Garantiefälle. */
export function updateProductReception(state: GameState): void {
  const day = state.time.day;
  for (const product of state.products) {
    if (product.status !== 'on_sale') continue;
    if (!product.review && product.launchDay !== undefined && day - product.launchDay >= REVIEW_DELAY_DAYS) publishReview(state, product);
    product.buzz *= 0.985;

    if (product.sales.unitsSold > 0) {
      const attributes = currentAttributes(state, product.category, product.attributes, product.attributesDay, product.launchDay);
      const value = valueScore(state, product.category, product.price, attributes);
      const fieldRate = product.sales.unitsSold > 0 ? product.quality.fieldDefects / product.sales.unitsSold : 0;
      const backlogPenalty = Math.min(0.6, product.sales.cancellations / Math.max(50, product.sales.unitsSold) * 3);
      const supportFactor = (state.company.support.serviceLevel - 0.8) * 0.8;
      const target = clamp(1.4 + 0.022 * attributes.quality + 0.012 * attributes.durability + 0.1 * value - fieldRate * 30 - backlogPenalty + supportFactor, 1, 5);
      const initial = product.customerRating === 0;
      product.customerRating = initial ? target : product.customerRating + (target - product.customerRating) * 0.03;
    }
  }
}
