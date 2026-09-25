import type { Day, Id, ProductCategoryId, RegionId, ShippingMode } from './common';
import type { ProductionLineType } from './products';

export type AutomationLevel = 0 | 25 | 50 | 75 | 100;

export type QcLevelId = 'basic' | 'sampling' | 'automated' | 'stress' | 'safety';

export type FacilityId = 'workshop' | Id;

export interface WorkshopState {
  toolLevel: number;
  qcLevel: QcLevelId;
}

export type FactoryStatus = 'construction' | 'operational' | 'upgrading';

export interface Factory {
  id: Id;
  name: string;
  locationId: string;
  status: FactoryStatus;
  level: number;
  /** Tag, an dem Bau oder Ausbau abgeschlossen ist. */
  readyDay: Day;
  targetLevel: number;
  automation: AutomationLevel;
  qcLevel: QcLevelId;
  lineTypes: ProductionLineType[];
  bookValue: number;
  builtDay: Day;
  /** Kapazitätsausfall (z. B. Brand) bis zu diesem Tag. */
  disruptedUntil?: Day;
  disruptionFactor?: number;
}

export type LineStatus = 'idle' | 'running' | 'stalled';

export interface ProductionLine {
  id: Id;
  facilityId: FacilityId;
  productId: Id | null;
  /** Zielmenge pro Tag; 0 = maximale Auslastung. */
  targetPerDay: number;
  active: boolean;
  progress: number;
  status: LineStatus;
  stallReason?: string;
  producedTotal: number;
  producedLast30: number[];
  autoReorder: boolean;
  reorderDays: number;
  shippingMode: ShippingMode;
}

export interface ContractManufacturer {
  id: string;
  name: string;
  locationName: string;
  region: RegionId;
  lineTypes: ProductionLineType[];
  feePerCapacityUnit: number;
  minOrder: number;
  productionDaysPer1000: number;
  qualityBonus: number;
  shippingDays: number;
  description: string;
}

export interface ContractManufacturingOrder {
  id: Id;
  manufacturerId: string;
  productId: Id;
  quantity: number;
  unitFee: number;
  materialCostPerUnit: number;
  orderDay: Day;
  readyDay: Day;
  status: 'in_production' | 'delivered';
}

export type WarehouseKind = 'garage' | 'storage_unit' | 'warehouse' | 'logistics_center' | 'mega_hub';

export interface Warehouse {
  id: Id;
  kind: WarehouseKind;
  name: string;
  capacity: number;
  rentPerMonth: number;
  status: 'building' | 'operational';
  readyDay: Day;
}

export interface FactoryLocationDef {
  id: string;
  name: string;
  country: string;
  region: RegionId;
  buildCostFactor: number;
  wageFactor: number;
  energyFactor: number;
  /** Zusätzliche Transportkosten pro Stück in den Heimatmarkt (Faktor). */
  logisticsFactor: number;
  qualityFactor: number;
  taxFactor: number;
  description: string;
}

export interface ProductionCategoryStats {
  producedToday: Record<ProductCategoryId, number>;
}
