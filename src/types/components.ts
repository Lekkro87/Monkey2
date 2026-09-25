import type { CurrencyCode, Day, Id, RegionId, ShippingMode, Tier } from './common';

export type ComponentType =
  | 'cpu'
  | 'gpu'
  | 'soc'
  | 'ram'
  | 'storage'
  | 'display'
  | 'battery'
  | 'camera'
  | 'mainboard'
  | 'psu'
  | 'cooler'
  | 'case'
  | 'speakers'
  | 'microphone'
  | 'wifi'
  | 'bluetooth'
  | 'cables'
  | 'packaging'
  | 'gpu_chip'
  | 'vram'
  | 'pcb'
  | 'chipset'
  | 'wafer';

/**
 * Bauform einer Komponente. Produktkategorien legen fest, welche Bauformen in welchem
 * Slot erlaubt sind (z. B. Notebook-CPU vs. Desktop-CPU).
 */
export type FormFactor =
  | 'desktop'
  | 'mobile'
  | 'server'
  | 'phone'
  | 'tablet'
  | 'wearable'
  | 'monitor'
  | 'gpu_board'
  | 'chip'
  | 'm2'
  | 'ufs'
  | 'universal';

export type FeatureId =
  | 'raytracing'
  | 'ai_accel'
  | 'oled'
  | 'miniled'
  | 'ltpo'
  | 'high_refresh'
  | 'wifi7'
  | 'fast_charge'
  | 'periscope'
  | 'liquid_cooling'
  | 'ecc'
  | 'pcie5';

export interface ComponentSpecs {
  cores?: number;
  clockGhz?: number;
  capacityGb?: number;
  memoryType?: string;
  sizeInch?: number;
  resolution?: string;
  /** Pixel in Millionen (für Schärfe-/PPI-Berechnung). */
  megapixels?: number;
  refreshHz?: number;
  panel?: string;
  capacityWh?: number;
  capacityMah?: number;
  cameraMp?: number;
  coolingW?: number;
  /** Relative Lautstärke des Kühlsystems (1 = Standard). */
  noiseFactor?: number;
  level?: 'standard' | 'performance' | 'extreme';
  wattage?: number;
  efficiencyRating?: string;
  material?: 'plastic' | 'aluminum' | 'premium';
  standard?: string;
  processNm?: number;
  layers?: number;
}

export interface Manufacturer {
  id: Id;
  /** Fiktiver Standardname (lizenzfrei). */
  name: string;
  country: string;
  region: RegionId;
  currency: CurrencyCode;
  /** Qualitätsruf 0–100. */
  reputation: number;
  /** Anteil der Kapazität, die dem Spieler maximal zugeteilt wird. */
  allocationShare: number;
  types: ComponentType[];
  description: string;
}

export interface ComponentSku {
  id: Id;
  type: ComponentType;
  manufacturerId: Id;
  familyId: string;
  name: string;
  formFactor: FormFactor;
  tier: Tier;
  generation: number;
  releaseDay: Day;
  /** Listenpreis in Herstellerwährung zum Release. */
  basePrice: number;
  currency: CurrencyCode;
  /** Leistungsindex (Top-Modell am Spielstart ≈ 100, wächst mit Generationen). */
  performance: number;
  quality: number;
  reliability: number;
  powerDraw: number;
  /** Lagervolumen pro Stück in Lagereinheiten. */
  volume: number;
  specs: ComponentSpecs;
  features: FeatureId[];
  /** Technologie, die zum Verbauen erforscht sein muss. */
  requiredTech?: string;
  /** Monatliche Liefermenge, die der Markt insgesamt bereitstellen kann. */
  monthlySupply: number;
  leadTimeDays: number;
  /** Eigenentwicklung des Spielers (Bestand = Fertigwaren des Produkts). */
  inhouseProductId?: Id;
}

export type SkuStatus = 'active' | 'eol' | 'discontinued';

export interface SkuMarketState {
  /** Aktueller Preis in Herstellerwährung (vor Mengenrabatt). */
  price: number;
  /** Preis vor 30 Tagen für Trendanzeige. */
  price30dAgo: number;
  /** Angebots-/Nachfragefaktor (1 = ausgeglichen, > 1 = knapp). */
  scarcity: number;
  /** Vom Spieler im laufenden Monat bestellte Menge. */
  orderedThisMonth: number;
  status: SkuStatus;
  eolDay?: Day;
  /** Preisverlauf (wöchentlich, in EUR). */
  history: number[];
}

export interface ComponentMarketState {
  skus: Record<Id, ComponentSku>;
  market: Record<Id, SkuMarketState>;
  /** Nächste Generationen-Veröffentlichung je Produktfamilie. */
  nextReleaseDay: Record<string, Day>;
}

export type PurchaseOrderStatus = 'in_transit' | 'delivered' | 'cancelled';

export interface PurchaseOrder {
  id: Id;
  skuId: Id;
  quantity: number;
  unitPriceEur: number;
  shippingCost: number;
  orderDay: Day;
  expectedDay: Day;
  deliveryDay: Day;
  mode: ShippingMode;
  status: PurchaseOrderStatus;
  delayed: boolean;
  delayReason?: string;
  contractId?: Id;
  auto: boolean;
}

export type ContractStatus = 'active' | 'expired';

export interface SupplyContract {
  id: Id;
  skuId: Id;
  unitPriceEur: number;
  monthlyMinimum: number;
  startDay: Day;
  endDay: Day;
  orderedThisMonth: number;
  status: ContractStatus;
  mode: ShippingMode;
}
