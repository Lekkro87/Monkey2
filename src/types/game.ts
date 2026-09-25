import type { CurrencyCode, Day, DifficultyId, Id, ProductCategoryId, RegionId, StockEntry } from './common';
import type { ComponentMarketState, PurchaseOrder, SupplyContract } from './components';
import type { Competitor } from './competitors';
import type { AchievementDef, EventsState, NewsItem } from './events';
import type { FinanceState } from './finance';
import type {
  BrandState,
  Campaign,
  CategoryMarketState,
  RegionState,
  SalesChannelId,
  SupportState,
} from './market';
import type { Product } from './products';
import type {
  ContractManufacturingOrder,
  Factory,
  ProductionLine,
  Warehouse,
  WorkshopState,
} from './production';
import type { ResearchState, SoftwareState } from './research';
import type { WorkforceState } from './workforce';

export type LogoId = 'cpu' | 'zap' | 'rocket' | 'atom' | 'hexagon' | 'circuit' | 'orbit' | 'shield' | 'layers' | 'sparkles' | 'gem' | 'globe';

export interface CompanyState {
  name: string;
  ceoName: string;
  logo: LogoId;
  color: string;
  headquartersId: string;
  homeRegion: RegionId;
  foundedDay: Day;
  stage: number;
  officeLevel: number;
  officeMove: { targetLevel: number; readyDay: Day } | null;
  salesChannels: Partial<Record<SalesChannelId, Day>>;
  regions: Record<RegionId, RegionState>;
  support: SupportState;
  /** Regionale Verteilzentren (reduzieren Exportkosten). */
  distributionCenters: RegionId[];
}

export interface EconomySnapshot {
  month: number;
  inflationRate: number;
  baseInterestRate: number;
  energyPrice: number;
  rawMaterialIndex: number;
  chipIndex: number;
  consumerConfidence: number;
  usd: number;
}

export interface EconomyState {
  inflationRate: number;
  priceLevel: number;
  baseInterestRate: number;
  energyPrice: number;
  wageIndex: number;
  rawMaterialIndex: number;
  chipIndex: number;
  exchangeRates: Record<CurrencyCode, number>;
  consumerConfidence: number;
  cyclePhase: number;
  taxRate: number;
  history: EconomySnapshot[];
}

export interface HistoryPoint {
  day: Day;
  cash: number;
  revenue: number;
  profit: number;
  unitsSold: number;
  unitsProduced: number;
  valuation: number;
  employees: number;
  reputation: number;
  marketShare: number;
  sharePrice: number | null;
  demandIndex: number;
}

export interface PeriodAccumulator {
  revenue: number;
  profit: number;
  unitsSold: number;
  unitsProduced: number;
}

export interface GameStats {
  unitsProducedTotal: number;
  unitsSoldTotal: number;
  productsLaunched: number;
  peakEmployees: number;
  peakMarketShare: number;
  week: PeriodAccumulator;
  month: PeriodAccumulator;
  producedToday: number;
  /** Auslastung aller Produktionsstandorte (0–1). */
  utilization: number;
  /** Tagesverkäufe je Kategorie (für Nachrichten über Trends). */
  demandIndex: number;
}

export type InsolvencyStage = 'ok' | 'warning' | 'restructuring' | 'insolvent';

export interface InsolvencyState {
  stage: InsolvencyStage;
  negativeSinceDay: Day | null;
  restructuringUntil: Day | null;
  bailoutUsed: boolean;
}

export interface GameSettings {
  autosaveIntervalDays: number;
  pauseOnDecision: boolean;
  pauseOnCritical: boolean;
}

export interface SupplyState {
  orders: PurchaseOrder[];
  contracts: SupplyContract[];
  cmOrders: ContractManufacturingOrder[];
}

export interface InventoryState {
  components: Record<Id, StockEntry>;
  products: Record<Id, StockEntry>;
}

export interface ProductionState {
  workshop: WorkshopState;
  factories: Factory[];
  lines: ProductionLine[];
}

export interface MarketingState {
  campaigns: Campaign[];
  spentTotal: number;
}

export type GameStatus = 'running' | 'bankrupt';

export interface GameState {
  schemaVersion: number;
  gameId: string;
  seed: number;
  rng: number;
  idCounter: number;
  createdAt: string;
  difficulty: DifficultyId;
  settings: GameSettings;
  time: { day: Day };
  status: GameStatus;
  company: CompanyState;
  economy: EconomyState;
  components: ComponentMarketState;
  supply: SupplyState;
  inventory: InventoryState;
  warehouses: Warehouse[];
  products: Product[];
  production: ProductionState;
  workforce: WorkforceState;
  research: ResearchState;
  software: SoftwareState;
  marketing: MarketingState;
  brand: BrandState;
  markets: Record<ProductCategoryId, CategoryMarketState>;
  competitors: Competitor[];
  finance: FinanceState;
  events: EventsState;
  news: NewsItem[];
  achievements: Record<string, Day>;
  history: HistoryPoint[];
  stats: GameStats;
  insolvency: InsolvencyState;
  tutorialDismissed: boolean;
}

export interface NewGameSetup {
  companyName: string;
  ceoName: string;
  logo: LogoId;
  color: string;
  headquartersId: string;
  difficulty: DifficultyId;
  seed?: number;
}

export type { AchievementDef };
