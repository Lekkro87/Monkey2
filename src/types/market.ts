import type { CurrencyCode, Day, Id, ProductCategoryId, RegionId, SegmentId } from './common';
import type { AttributeKey } from './products';

export type BrandAttribute = 'trust' | 'premium' | 'innovation' | 'gaming' | 'business';

export interface CustomerSegmentDef {
  id: SegmentId;
  name: string;
  description: string;
  wants: string[];
  priceSensitivity: number;
  qualitySensitivity: number;
  priceMultiplier: number;
  attributeWeights: Partial<Record<AttributeKey, number>>;
  brandWeights: Partial<Record<BrandAttribute, number>>;
  /** Bereitschaft, auf Lieferungen zu warten (0–1). */
  patience: number;
}

export interface RegionDef {
  id: RegionId;
  name: string;
  currency: CurrencyCode;
  marketShare: number;
  purchasingPower: number;
  importTariff: number;
  entryCost: number;
  entryDays: number;
  shippingCostFactor: number;
  categoryAffinity: Partial<Record<ProductCategoryId, number>>;
  description: string;
}

export type SalesChannelId = 'online_shop' | 'retail' | 'electronics_chains' | 'wholesale' | 'carriers';

export interface SalesChannelDef {
  id: SalesChannelId;
  name: string;
  description: string;
  setupCost: number;
  monthlyCost: number;
  marginCut: number;
  /** Anteil Endkunden-Versand, den das Unternehmen selbst trägt (0–1). */
  fulfillmentShare: number;
  coverage: Record<SegmentId, number>;
  categories?: ProductCategoryId[];
  minSalesStaff: number;
  minReputation: number;
  minStage: number;
}

export type MarketingChannelId =
  | 'online_ads'
  | 'social'
  | 'youtube'
  | 'influencer'
  | 'gaming_events'
  | 'trade_fairs'
  | 'tv'
  | 'sponsoring';

export interface MarketingChannelDef {
  id: MarketingChannelId;
  name: string;
  description: string;
  minDailyBudget: number;
  maxDailyBudget: number;
  /** Reichweite pro 1.000 € (Anteil Bekanntheitsgewinn, vor Marktskalierung). */
  efficiency: number;
  segmentAffinity: Record<SegmentId, number>;
  brandEffects: Partial<Record<BrandAttribute, number>>;
  buzz: number;
  minStage: number;
}

export interface Campaign {
  id: Id;
  channel: MarketingChannelId;
  region: RegionId;
  dailyBudget: number;
  startDay: Day;
  endDay: Day;
  productId?: Id;
  spent: number;
}

export interface BrandState {
  /** Bekanntheit je Region und Segment (0–1). */
  awareness: Record<RegionId, Record<SegmentId, number>>;
  trust: number;
  premium: number;
  innovation: number;
  gaming: number;
  business: number;
  reputation: number;
  satisfaction: number;
}

export interface CategoryMarketState {
  category: ProductCategoryId;
  /** Nachfragetrend (1 = Normalniveau). */
  trend: number;
  /** Aktuelle jährliche Wachstumsrate. */
  growth: number;
  /** Verkäufe im laufenden Monat je Anbieter ('player', Konkurrenten-ID, 'other'). */
  monthUnits: Record<string, number>;
  /** Verkäufe im letzten abgeschlossenen Monat je Anbieter. */
  lastMonthUnits: Record<string, number>;
  /** Marktanteile (letzte 30 Tage, rollierend) je Anbieter. */
  share: Record<string, number>;
  /** Rollierende 30-Tage-Summe je Anbieter. */
  rolling: Record<string, number>;
  /** Gesamtnachfrage pro Tag (alle Regionen). */
  dailyDemand: number;
  /** Monatliche Gesamtverkäufe (Historie). */
  history: { month: number; total: number; player: number }[];
  averagePrice: number;
}

export interface RegionState {
  id: RegionId;
  status: 'closed' | 'entering' | 'open';
  readyDay?: Day;
}

export interface SupportState {
  level: 'basic' | 'phone' | 'premium' | 'onsite';
  ticketsLastMonth: number;
  serviceLevel: number;
}
