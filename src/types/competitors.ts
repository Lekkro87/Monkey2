import type { Day, Id, ProductCategoryId, RegionId, Tier } from './common';
import type { ProductAttributes } from './products';

export type CompetitorStrategy = 'budget' | 'premium' | 'gaming' | 'business' | 'innovation';

export interface CompetitorProduct {
  id: Id;
  name: string;
  category: ProductCategoryId;
  tier: Tier;
  releaseDay: Day;
  /** Leistungsindex vor Normierung (wie bei Spielerprodukten). */
  perfIndex: number;
  attributes: ProductAttributes;
  price: number;
  unitCost: number;
  reviewScore: number;
  unitsSold: number;
  active: boolean;
  buzz: number;
}

export interface CompetitorBrand {
  awareness: Record<RegionId, number>;
  trust: number;
  premium: number;
  innovation: number;
  gaming: number;
  business: number;
}

export interface Competitor {
  id: Id;
  name: string;
  shortName: string;
  color: string;
  strategy: CompetitorStrategy;
  description: string;
  cash: number;
  revenueMonth: number;
  profitMonth: number;
  revenueLastMonth: number;
  profitLastMonth: number;
  revenueHistory: number[];
  valuation: number;
  /** Technologievorsprung in Jahren (negativ = Rückstand). */
  techLead: number;
  marketingPower: number;
  brand: CompetitorBrand;
  focus: Partial<Record<ProductCategoryId, number>>;
  products: CompetitorProduct[];
  factories: number;
  employees: number;
  nextDecisionDay: Day;
  /** Zuletzt entschiedene Reaktion auf den Spieler je Kategorie (Tag). */
  lastCounterDay: Partial<Record<ProductCategoryId, Day>>;
  productCounter: number;
  sharePrice: number;
  priceAggression: number;
}
