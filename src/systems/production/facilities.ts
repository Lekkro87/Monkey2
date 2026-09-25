import { CATEGORIES } from '@/data/categories';
import { HOURS_PER_DAY } from '@/data/departments';
import {
  AUTOMATION_LEVELS,
  FACTORY_BASE_COST,
  FACTORY_BUILD_DAYS,
  factoryCapacity,
  factoryUpgradeCost,
  factoryUpgradeDays,
  factoryWorkersNeeded,
  LINE_TYPES,
  QC_LEVELS,
  WORKSHOP_TOOLS,
} from '@/data/facilities';
import { FACTORY_LOCATIONS, getFactoryLocation } from '@/data/locations';
import { CommandError, ensure, nextId } from '@/simulation/commands';
import { multiplier } from '@/simulation/modifiers';
import { addNews } from '@/simulation/news';
import type { AutomationLevel, Factory, GameState, Product, ProductionLine, ProductionLineType, QcLevelId } from '@/types';
import { clamp } from '@/utils/math';
import { addTransaction } from '@/systems/finance/ledger';
import { hasTech, techEffects } from '@/systems/research/effects';
import { facilityCapacity, facilityHeadcount } from '@/systems/workforce/employees';

export const WORKSHOP_CATEGORY_TOOL_LEVEL: Partial<Record<string, number>> = {
  desktop: 1,
  gaming_pc: 1,
  monitor: 2,
  server: 2,
};

export function factoryBaseValue(state: GameState, factory: Pick<Factory, 'level' | 'locationId'>): number {
  const location = getFactoryLocation(factory.locationId);
  return FACTORY_BASE_COST * (factoryCapacity(factory.level) / 1_000) ** 0.75 * location.buildCostFactor * state.economy.priceLevel;
}

export function maxLines(state: GameState, facilityId: string): number {
  if (facilityId === 'workshop') return WORKSHOP_TOOLS[state.production.workshop.toolLevel]?.lines ?? 0;
  const factory = state.production.factories.find((f) => f.id === facilityId);
  return factory ? 2 + Math.floor((factory.level - 1) / 2) : 0;
}

export function qcLevelOf(state: GameState, facilityId: string): QcLevelId {
  if (facilityId === 'workshop') return state.production.workshop.qcLevel;
  return state.production.factories.find((f) => f.id === facilityId)?.qcLevel ?? 'basic';
}

/** Kann die Kategorie an diesem Standort gefertigt werden? Liefert Fehlermeldung oder null. */
export function facilitySupportsCategory(state: GameState, facilityId: string, product: Pick<Product, 'category'>): string | null {
  const category = CATEGORIES[product.category];
  if (facilityId === 'workshop') {
    const required = WORKSHOP_CATEGORY_TOOL_LEVEL[category.id];
    if (!category.workshop || required === undefined) return `${category.pluralName} können nicht von Hand montiert werden – dafür wird eine Fabrik mit ${LINE_TYPES[category.lineType].name} benötigt.`;
    if (state.production.workshop.toolLevel < required) return `Für ${category.pluralName} wird die Werkstattstufe „${WORKSHOP_TOOLS[required].name}“ benötigt.`;
    return null;
  }
  const factory = state.production.factories.find((f) => f.id === facilityId);
  if (!factory) return 'Fabrik nicht gefunden.';
  if (!factory.lineTypes.includes(category.lineType)) return `In ${factory.name} fehlt eine ${LINE_TYPES[category.lineType].name}.`;
  return null;
}

export interface FacilityCapacityInfo {
  /** Kapazität pro Tag: Werkstatt in Arbeitsstunden, Fabrik in Kapazitätseinheiten. */
  perDay: number;
  unit: 'hours' | 'units';
  staffing: number;
  speed: number;
}

export function workshopCapacity(state: GameState): FacilityCapacityInfo {
  const tools = WORKSHOP_TOOLS[state.production.workshop.toolLevel] ?? WORKSHOP_TOOLS[0];
  const qc = QC_LEVELS[state.production.workshop.qcLevel];
  const speed = tools.speed * (1 + techEffects(state).productionEfficiency) * qc.speed * multiplier(state, 'factoryCapacity', { factoryId: 'workshop' });
  const workers = facilityCapacity(state, 'workshop');
  return { perDay: workers * HOURS_PER_DAY * speed, unit: 'hours', staffing: workers > 0 ? 1 : 0, speed };
}

export function factoryDailyCapacity(state: GameState, factory: Factory): FacilityCapacityInfo {
  if (factory.status === 'construction') return { perDay: 0, unit: 'units', staffing: 0, speed: 0 };
  const needed = factoryWorkersNeeded(factory.level, factory.automation);
  const staffing = clamp(facilityCapacity(state, factory.id) / needed, 0, 1.15);
  const automation = AUTOMATION_LEVELS.find((a) => a.level === factory.automation) ?? AUTOMATION_LEVELS[0];
  const qc = QC_LEVELS[factory.qcLevel];
  const disruption = factory.disruptedUntil !== undefined && factory.disruptedUntil > state.time.day ? (factory.disruptionFactor ?? 0) : 1;
  const eventFactor = multiplier(state, 'factoryCapacity', { factoryId: factory.id });
  const speed = automation.speed * (1 + techEffects(state).productionEfficiency) * qc.speed * disruption * eventFactor;
  return { perDay: (factoryCapacity(factory.level) / 30.4) * staffing * speed, unit: 'units', staffing, speed };
}

export function facilityDailyCapacity(state: GameState, facilityId: string): FacilityCapacityInfo {
  if (facilityId === 'workshop') return workshopCapacity(state);
  const factory = state.production.factories.find((f) => f.id === facilityId);
  return factory ? factoryDailyCapacity(state, factory) : { perDay: 0, unit: 'units', staffing: 0, speed: 0 };
}

/** Kapazitätsbedarf pro Stück (Stunden in der Werkstatt, Kapazitätseinheiten in Fabriken). */
export function unitCapacityCost(facilityId: string, product: Pick<Product, 'category'>): number {
  const category = CATEGORIES[product.category];
  return facilityId === 'workshop' ? category.assemblyHours : category.capacityUnits;
}

// ---------------------------------------------------------------------------
// Commands: Werkstatt
// ---------------------------------------------------------------------------

export function upgradeWorkshopTools(state: GameState): string {
  const next = WORKSHOP_TOOLS[state.production.workshop.toolLevel + 1];
  ensure(next, 'Die Werkstatt ist bereits voll ausgestattet.');
  const cost = next.cost * state.economy.priceLevel;
  ensure(state.finance.cash >= cost, 'Nicht genügend Kapital.');
  addTransaction(state, 'capex', -cost);
  state.production.workshop.toolLevel = next.level;
  if (state.production.lines.filter((l) => l.facilityId === 'workshop').length === 0) {
    state.production.lines.push(createLine(state, 'workshop'));
  }
  return `Werkstatt ausgebaut: ${next.name}.`;
}

export function setQcLevel(state: GameState, facilityId: string, level: QcLevelId): string {
  const def = QC_LEVELS[level];
  ensure(techEffects(state).qcLevels.has(level), `„${def.name}“ muss zuerst erforscht werden.`);
  if (facilityId === 'workshop') {
    state.production.workshop.qcLevel = level;
  } else {
    const factory = state.production.factories.find((f) => f.id === facilityId);
    ensure(factory, 'Fabrik nicht gefunden.');
    factory.qcLevel = level;
  }
  return `Qualitätskontrolle auf „${def.name}“ umgestellt.`;
}

// ---------------------------------------------------------------------------
// Commands: Fabriken
// ---------------------------------------------------------------------------

export function factoryBuildCost(state: GameState, locationId: string, lineType: ProductionLineType): number {
  const location = getFactoryLocation(locationId);
  return (FACTORY_BASE_COST + LINE_TYPES[lineType].cost) * location.buildCostFactor * state.economy.priceLevel;
}

export function buildFactory(state: GameState, locationId: string, lineType: ProductionLineType, name?: string): string {
  ensure(state.company.officeLevel >= 1, 'Für eine eigene Fabrik brauchst du mindestens ein kleines Büro (Stufe Start-up).');
  const location = FACTORY_LOCATIONS.find((l) => l.id === locationId);
  ensure(location, 'Unbekannter Standort.');
  const line = LINE_TYPES[lineType];
  ensure(hasTech(state, line.requiredTech), `Für die ${line.name} wird Forschung benötigt.`);
  const cost = factoryBuildCost(state, locationId, lineType);
  ensure(state.finance.cash >= cost, `Nicht genügend Kapital. Der Bau kostet ${Math.round(cost).toLocaleString('de-DE')} €.`);
  addTransaction(state, 'capex', -cost);
  const count = state.production.factories.length + 1;
  const factory: Factory = {
    id: nextId(state, 'fac'),
    name: name?.trim() || `Werk ${location.name}${count > 1 ? ` ${count}` : ''}`,
    locationId,
    status: 'construction',
    level: 1,
    readyDay: state.time.day + FACTORY_BUILD_DAYS,
    targetLevel: 1,
    automation: 0,
    qcLevel: 'basic',
    lineTypes: [lineType],
    bookValue: cost,
    builtDay: state.time.day,
  };
  state.production.factories.push(factory);
  return `Bau von ${factory.name} gestartet – Fertigstellung in ${FACTORY_BUILD_DAYS} Tagen.`;
}

function findFactory(state: GameState, factoryId: string): Factory {
  const factory = state.production.factories.find((f) => f.id === factoryId);
  if (!factory) throw new CommandError('Fabrik nicht gefunden.');
  return factory;
}

export function factoryUpgradePrice(state: GameState, factory: Factory): number {
  const location = getFactoryLocation(factory.locationId);
  return factoryUpgradeCost(factory.level) * location.buildCostFactor * (1 + 0.15 * factory.lineTypes.length) * state.economy.priceLevel;
}

export function upgradeFactory(state: GameState, factoryId: string): string {
  const factory = findFactory(state, factoryId);
  ensure(factory.status === 'operational', 'Die Fabrik wird gerade gebaut oder ausgebaut.');
  ensure(factory.level < 10, 'Maximale Ausbaustufe erreicht.');
  const cost = factoryUpgradePrice(state, factory);
  ensure(state.finance.cash >= cost, `Nicht genügend Kapital. Der Ausbau kostet ${Math.round(cost).toLocaleString('de-DE')} €.`);
  addTransaction(state, 'capex', -cost);
  factory.bookValue += cost;
  factory.status = 'upgrading';
  factory.targetLevel = factory.level + 1;
  factory.readyDay = state.time.day + factoryUpgradeDays(factory.level);
  return `Ausbau von ${factory.name} auf Stufe ${factory.targetLevel} gestartet.`;
}

export function lineInstallCost(state: GameState, factory: Factory, lineType: ProductionLineType): number {
  const location = getFactoryLocation(factory.locationId);
  return LINE_TYPES[lineType].cost * (1 + 0.35 * (factory.level - 1)) * location.buildCostFactor * state.economy.priceLevel;
}

export function installLineType(state: GameState, factoryId: string, lineType: ProductionLineType): string {
  const factory = findFactory(state, factoryId);
  ensure(!factory.lineTypes.includes(lineType), 'Diese Fertigungsausstattung ist bereits vorhanden.');
  const line = LINE_TYPES[lineType];
  ensure(hasTech(state, line.requiredTech), `Für die ${line.name} wird Forschung benötigt.`);
  const cost = lineInstallCost(state, factory, lineType);
  ensure(state.finance.cash >= cost, 'Nicht genügend Kapital.');
  addTransaction(state, 'capex', -cost);
  factory.bookValue += cost;
  factory.lineTypes.push(lineType);
  return `${line.name} in ${factory.name} installiert.`;
}

export function automationCost(state: GameState, factory: Factory, target: AutomationLevel): number {
  const current = AUTOMATION_LEVELS.find((a) => a.level === factory.automation)!;
  const next = AUTOMATION_LEVELS.find((a) => a.level === target)!;
  return Math.max(0, (next.costFactor - current.costFactor) * factoryBaseValue(state, factory));
}

export function setAutomation(state: GameState, factoryId: string, level: AutomationLevel): string {
  const factory = findFactory(state, factoryId);
  const def = AUTOMATION_LEVELS.find((a) => a.level === level);
  ensure(def, 'Unbekannte Automatisierungsstufe.');
  ensure(techEffects(state).automation.has(level), `„${def.name}“ muss zuerst erforscht werden.`);
  if (level === factory.automation) return 'Keine Änderung.';
  const cost = automationCost(state, factory, level);
  ensure(state.finance.cash >= cost, `Nicht genügend Kapital. Die Automatisierung kostet ${Math.round(cost).toLocaleString('de-DE')} €.`);
  if (cost > 0) {
    addTransaction(state, 'capex', -cost);
    factory.bookValue += cost;
  }
  factory.automation = level;
  return `${factory.name}: Automatisierung ${level} %.`;
}

export function sellFactory(state: GameState, factoryId: string): string {
  const factory = findFactory(state, factoryId);
  const proceeds = factory.bookValue * 0.4;
  addTransaction(state, 'asset_sale', proceeds);
  state.finance.assetBook = Math.max(0, state.finance.assetBook - factory.bookValue);
  const workers = state.workforce.employees.filter((e) => e.facilityId === factoryId);
  let severance = 0;
  for (const worker of workers) severance += worker.salary * 1.5;
  if (severance > 0) addTransaction(state, 'salaries', -severance);
  state.workforce.employees = state.workforce.employees.filter((e) => e.facilityId !== factoryId);
  state.workforce.statsDirty = true;
  if (workers.length > 0) {
    state.workforce.lastLayoffDay = state.time.day;
    state.workforce.layoffsLast90 += workers.length;
  }
  state.production.lines = state.production.lines.filter((l) => l.facilityId !== factoryId);
  state.production.factories = state.production.factories.filter((f) => f.id !== factoryId);
  addNews(state, 'company', 'negative', `${state.company.name} schließt ${factory.name}`, `${workers.length} Beschäftigte verlieren ihren Arbeitsplatz.`);
  return `${factory.name} verkauft für ${Math.round(proceeds).toLocaleString('de-DE')} €.`;
}

export function processFactories(state: GameState): void {
  const day = state.time.day;
  let maintenance = 0;
  let idleEnergy = 0;
  for (const factory of state.production.factories) {
    if (factory.status !== 'operational' && day >= factory.readyDay) {
      const wasConstruction = factory.status === 'construction';
      factory.status = 'operational';
      factory.level = factory.targetLevel;
      if (wasConstruction) {
        state.production.lines.push(createLine(state, factory.id));
        addNews(state, 'company', 'positive', `${state.company.name} eröffnet ${factory.name}`, `Kapazität: ${factoryCapacity(factory.level).toLocaleString('de-DE')} Einheiten pro Monat. Jetzt Personal einstellen!`);
      } else {
        addNews(state, 'company', 'positive', `${factory.name} auf Stufe ${factory.level} ausgebaut`, `Neue Kapazität: ${factoryCapacity(factory.level).toLocaleString('de-DE')} Einheiten pro Monat.`);
      }
    }
    if (factory.status === 'construction') continue;
    maintenance += (factory.bookValue * 0.07) / 365;
    const location = getFactoryLocation(factory.locationId);
    idleEnergy += (factoryCapacity(factory.level) / 30.4) * 2 * state.economy.energyPrice * location.energyFactor;
  }
  if (maintenance > 0) addTransaction(state, 'maintenance', -maintenance);
  if (idleEnergy > 0) addTransaction(state, 'energy', -idleEnergy * (1 - techEffects(state).energyEfficiency));
}

// ---------------------------------------------------------------------------
// Commands: Produktionslinien
// ---------------------------------------------------------------------------

export function createLine(state: GameState, facilityId: string): ProductionLine {
  return {
    id: nextId(state, 'line'),
    facilityId,
    productId: null,
    targetPerDay: 0,
    active: false,
    progress: 0,
    status: 'idle',
    producedTotal: 0,
    producedLast30: [],
    autoReorder: true,
    reorderDays: 21,
    shippingMode: 'distributor',
  };
}

export function addProductionLine(state: GameState, facilityId: string): string {
  const existing = state.production.lines.filter((l) => l.facilityId === facilityId).length;
  const limit = maxLines(state, facilityId);
  ensure(limit > 0, facilityId === 'workshop' ? 'Die Werkstatt braucht zuerst eine Grundausstattung.' : 'Standort nicht verfügbar.');
  ensure(existing < limit, `Maximal ${limit} Linien an diesem Standort.`);
  state.production.lines.push(createLine(state, facilityId));
  return 'Neue Produktionslinie eingerichtet.';
}

export function removeProductionLine(state: GameState, lineId: string): string {
  ensure(state.production.lines.some((l) => l.id === lineId), 'Linie nicht gefunden.');
  state.production.lines = state.production.lines.filter((l) => l.id !== lineId);
  return 'Produktionslinie entfernt.';
}

export interface LineConfig {
  productId?: string | null;
  targetPerDay?: number;
  active?: boolean;
  autoReorder?: boolean;
  reorderDays?: number;
  shippingMode?: ProductionLine['shippingMode'];
}

export function configureLine(state: GameState, lineId: string, config: LineConfig): string {
  const line = state.production.lines.find((l) => l.id === lineId);
  ensure(line, 'Linie nicht gefunden.');
  if (config.productId !== undefined) {
    if (config.productId === null) {
      line.productId = null;
      line.active = false;
      line.status = 'idle';
    } else {
      const product = state.products.find((p) => p.id === config.productId);
      ensure(product, 'Produkt nicht gefunden.');
      ensure(product.status === 'ready' || product.status === 'on_sale', 'Nur fertig entwickelte Produkte können produziert werden.');
      const unsupported = facilitySupportsCategory(state, line.facilityId, product);
      if (unsupported) throw new CommandError(unsupported);
      if (line.productId !== product.id) line.progress = 0;
      line.productId = product.id;
    }
  }
  if (config.targetPerDay !== undefined) {
    ensure(Number.isFinite(config.targetPerDay) && config.targetPerDay >= 0, 'Ungültige Zielmenge.');
    line.targetPerDay = config.targetPerDay;
  }
  if (config.active !== undefined) {
    ensure(!config.active || line.productId, 'Bitte zuerst ein Produkt zuweisen.');
    if (config.active && line.facilityId !== 'workshop') {
      ensure(facilityHeadcount(state, line.facilityId) > 0, 'In dieser Fabrik arbeitet noch niemand. Stelle zuerst Produktionspersonal ein.');
    }
    line.active = config.active;
    line.status = config.active ? 'running' : 'idle';
    if (!config.active) line.stallReason = undefined;
  }
  if (config.autoReorder !== undefined) line.autoReorder = config.autoReorder;
  if (config.reorderDays !== undefined) {
    ensure(config.reorderDays >= 7 && config.reorderDays <= 120, 'Die Reichweite muss zwischen 7 und 120 Tagen liegen.');
    line.reorderDays = config.reorderDays;
  }
  if (config.shippingMode !== undefined) line.shippingMode = config.shippingMode;
  return 'Produktionslinie aktualisiert.';
}
