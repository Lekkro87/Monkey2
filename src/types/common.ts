/** Tage seit Spielbeginn (Tag 0 = 1. Januar 2026). */
export type Day = number;
export type Id = string;

export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'JPY' | 'CNY';

export type RegionId = 'europe' | 'north_america' | 'asia' | 'south_america' | 'africa' | 'oceania';

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'hardcore';

export type GameSpeed = 0 | 1 | 2 | 5 | 10 | 20;

export type Tier = 'budget' | 'mainstream' | 'performance' | 'enthusiast';

export type SegmentId = 'budget' | 'mainstream' | 'gamer' | 'business' | 'enthusiast' | 'creative';

export type ProductCategoryId =
  | 'desktop'
  | 'gaming_pc'
  | 'laptop'
  | 'gaming_laptop'
  | 'smartphone'
  | 'tablet'
  | 'monitor'
  | 'graphics_card'
  | 'processor'
  | 'mainboard'
  | 'server'
  | 'smartwatch';

export type ShippingMode = 'distributor' | 'truck' | 'ship' | 'air';

export interface StockEntry {
  qty: number;
  /** Gleitender Durchschnittspreis pro Stück in EUR. */
  avgCost: number;
}
