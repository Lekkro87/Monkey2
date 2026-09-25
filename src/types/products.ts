import type { Day, Id, ProductCategoryId, SegmentId } from './common';
import type { ComponentType, FeatureId, FormFactor } from './components';

export type AttributeKey =
  | 'performance'
  | 'quality'
  | 'durability'
  | 'efficiency'
  | 'acoustics'
  | 'thermals'
  | 'design'
  | 'repairability'
  | 'battery'
  | 'display'
  | 'camera'
  | 'software'
  | 'innovation';

export type ProductAttributes = Record<AttributeKey, number>;

export type SlotKey =
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

export interface CategorySlot {
  key: SlotKey;
  type: ComponentType;
  label: string;
  formFactors: FormFactor[];
  required: boolean;
  quantity: number;
  /** Standardteile werden im Editor eingeklappt dargestellt. */
  minor?: boolean;
}

export type ProductionLineType = 'pc_assembly' | 'notebook' | 'mobile' | 'display' | 'pcb' | 'chip' | 'server';

export type ReviewCategory = 'performance' | 'price' | 'design' | 'quality' | 'battery' | 'acoustics' | 'software' | 'camera';

export interface ProductCategoryDef {
  id: ProductCategoryId;
  name: string;
  pluralName: string;
  shortName: string;
  description: string;
  group: 'pc' | 'mobile' | 'display' | 'component' | 'server' | 'wearable';
  slots: CategorySlot[];
  unlockTech?: string;
  /** Kann in der Werkstatt (Handmontage) gefertigt werden. */
  workshop: boolean;
  lineType: ProductionLineType;
  /** Montagestunden pro Einheit bei Produktivität 1. */
  assemblyHours: number;
  /** Kapazitätseinheiten pro Stück in Fabriken (Komplexität). */
  capacityUnits: number;
  /** Ingenieurstunden für eine vollständige Neuentwicklung. */
  devEffort: number;
  devBudget: number;
  toolingCost: number;
  certificationDays: number;
  certificationCost: number;
  /** Weltweite Nachfrage in Stück pro Monat zu Spielbeginn. */
  baseMonthlyUnits: number;
  annualGrowth: number;
  /** Referenzpreis (Mainstream) in EUR. */
  referencePrice: number;
  segmentMix: Record<SegmentId, number>;
  relevantAttributes: AttributeKey[];
  reviewCategories: ReviewCategory[];
  perfWeights: Partial<Record<SlotKey, number>>;
  /** Leistungsaufnahme der restlichen Plattform in Watt. */
  basePower: number;
  /** Anteil der Spitzenleistung im Alltagsbetrieb (für Akkulaufzeit). */
  averageLoad: number;
  /** Erwartete Akkulaufzeit in Stunden (Bewertungsmaßstab). */
  expectedBatteryHours: number;
  repairabilityBase: number;
  productVolume: number;
  licenseCost: number;
  fulfillmentCost: number;
  /** Supportanfragen pro 1.000 verkaufte Geräte und Monat. */
  supportLoad: number;
  devDepartmentMix: { engineering: number; hardware: number; software: number };
  /** Mindestbesetzung je Entwicklungsabteilung. */
  devRequirements: Partial<Record<'engineering' | 'hardware' | 'software', number>>;
  /** Relevanz des Softwareteams für die Produktqualität (0–1). */
  softwareRelevance: number;
}

export type ProductStatus = 'draft' | 'development' | 'ready' | 'on_sale' | 'discontinued';

export type DevPhaseId =
  | 'idea'
  | 'concept'
  | 'prototype'
  | 'engineering_sample'
  | 'testing'
  | 'certification'
  | 'mass_production';

export type DevBudgetLevel = 'minimal' | 'standard' | 'high' | 'maximal';

export type Priority = 'low' | 'normal' | 'high';

export interface DevelopmentState {
  phaseIndex: number;
  /** Fortschritt der aktuellen Phase 0–1. */
  phaseProgress: number;
  phaseStartedDay: Day;
  phasePaid: boolean;
  blockedReason?: string;
  totalEffort: number;
  totalBudget: number;
  spent: number;
  startedDay: Day;
  priority: Priority;
}

export interface ProductSpecSummary {
  powerDraw: number;
  heat: number;
  coolingCapacity: number;
  temperature: number;
  noiseDb: number;
  batteryHours: number | null;
  throttling: number;
  psuHeadroom: number | null;
  /** Leistungsindex vor Normierung auf den Technologiestand. */
  perfIndex: number;
  displayLabel?: string;
  features: FeatureId[];
}

export interface ReviewOutletScore {
  outlet: string;
  score: number;
  quote: string;
}

export interface ProductReview {
  day: Day;
  overall: number;
  categories: Partial<Record<ReviewCategory, number>>;
  outlets: ReviewOutletScore[];
  pros: string[];
  cons: string[];
}

export interface ProductSalesStats {
  unitsSold: number;
  revenue: number;
  grossProfit: number;
  unitsLast30: number;
  revenueLast30: number;
  /** Rollierende Tagesverkäufe der letzten 30 Tage. */
  daily: number[];
  /** Rollierender Tagesumsatz der letzten 30 Tage. */
  dailyRevenue: number[];
  backorders: number;
  lostSales: number;
  cancellations: number;
  installedBase: number;
  demandToday: number;
  /** Anteil der Käufer pro Segment (für Zielgruppenanalyse). */
  segmentUnits: Partial<Record<SegmentId, number>>;
  unitsThisMonth: number;
  bestMonthUnits: number;
  /** Verkaufte Geräte in der Garantiezeit (exponentiell abklingend) für Defektberechnung. */
  warrantyPool: number;
}

export type RecallStatus = 'none' | 'pending_decision' | 'ignored' | 'repair_program' | 'recall' | 'replacement';

export interface ProductQualityState {
  /** Erwartete Ausfallrate laut Design (vor Qualitätskontrolle, 0–1). */
  defectRate: number;
  /** Tatsächlich unentdeckt ausgelieferte Defektquote (gewichteter Durchschnitt der Produktion). */
  escapedRate: number;
  producedUnits: number;
  /** Tatsächlich im Feld aufgetretene Defekte. */
  fieldDefects: number;
  recallStatus: RecallStatus;
  recallDay?: Day;
  /** Verkaufsstopp bis zu diesem Tag (Rückruf). */
  salesHaltUntil?: Day;
  defectLabel?: string;
}

export interface Product {
  id: Id;
  name: string;
  category: ProductCategoryId;
  /** Slot → Komponenten-ID. */
  components: Partial<Record<SlotKey, Id>>;
  price: number;
  devBudgetLevel: DevBudgetLevel;
  status: ProductStatus;
  createdDay: Day;
  development: DevelopmentState | null;
  devQuality: number;
  attributes: ProductAttributes;
  /** Tag, auf den sich die Attribute beziehen (für Alterung durch Technologiefortschritt). */
  attributesDay: Day;
  specs: ProductSpecSummary;
  /** Materialkosten pro Stück zum Zeitpunkt der Kalkulation (EUR). */
  estimatedUnitCost: number;
  launchDay?: Day;
  readyDay?: Day;
  discontinuedDay?: Day;
  review?: ProductReview;
  /** Kundenbewertung 1–5. */
  customerRating: number;
  sales: ProductSalesStats;
  quality: ProductQualityState;
  buzz: number;
  version: number;
  predecessorId?: Id;
  templateId?: string;
  /** Wird als Komponente für eigene Produkte angeboten. */
  inhouseSkuId?: Id;
  /** Zusätzliche Eigenschaften aus Forschung (z. B. eigene Chips). */
  researchPerformance?: number;
  priceHistory: { day: Day; price: number }[];
}

export interface ProductTemplate {
  id: string;
  name: string;
  category: ProductCategoryId;
  price: number;
  description: string;
  /** Slot → Komponenten-ID (Familie + Variante, wird beim Laden aufgelöst). */
  components: Partial<Record<SlotKey, string>>;
  devBudgetLevel: DevBudgetLevel;
}
