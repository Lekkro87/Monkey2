import { CATEGORIES } from '@/data/categories';
import { SHIPPING_MODES } from '@/data/channels';
import { AUTOMATION_LEVELS, QC_LEVELS, WORKSHOP_TOOLS } from '@/data/facilities';
import { getFactoryLocation } from '@/data/locations';
import { CommandError } from '@/simulation/commands';
import type { ComponentSku, GameState, Product, ProductionLine } from '@/types';
import { pushCapped } from '@/utils/math';
import { getSku } from '@/systems/components/catalog';
import { addTransaction } from '@/systems/finance/ledger';
import { addProductStock, componentStock, consumeComponent, storageCapacity, usedStorage } from '@/systems/inventory/inventory';
import { hasOwnOs } from '@/systems/products/design';
import { techEffects } from '@/systems/research/effects';
import { defaultShippingMode, placeOrder, quantityInTransit, quotePurchase, shippingOptions } from '@/systems/supply/purchasing';
import { facilityDailyCapacity, qcLevelOf, unitCapacityCost } from './facilities';

export interface BomItem {
  sku: ComponentSku;
  quantity: number;
}

export function billOfMaterials(state: GameState, product: Product): BomItem[] {
  const category = CATEGORIES[product.category];
  const items: BomItem[] = [];
  for (const slot of category.slots) {
    const sku = getSku(state, product.components[slot.key]);
    if (sku) items.push({ sku, quantity: slot.quantity });
  }
  return items;
}

/** Wie viele Einheiten lassen sich mit dem aktuellen Lagerbestand bauen? */
export function buildableUnits(state: GameState, product: Product): number {
  let buildable = Infinity;
  for (const item of billOfMaterials(state, product)) {
    buildable = Math.min(buildable, Math.floor(componentStock(state, item.sku) / item.quantity));
  }
  return Number.isFinite(buildable) ? buildable : 0;
}

export interface Shortage {
  sku: ComponentSku;
  missing: number;
}

export function componentShortages(state: GameState, product: Product, units: number): Shortage[] {
  const shortages: Shortage[] = [];
  for (const item of billOfMaterials(state, product)) {
    const missing = item.quantity * units - componentStock(state, item.sku);
    if (missing > 0) shortages.push({ sku: item.sku, missing: Math.ceil(missing) });
  }
  return shortages.sort((a, b) => b.missing - a.missing);
}

function describeShortage(state: GameState, shortages: Shortage[]): string {
  // Nicht mehr lieferbare Teile zuerst nennen – dort hilft nur ein Nachfolgemodell.
  const discontinued = shortages.find((s) => !s.sku.inhouseProductId && state.components.market[s.sku.id]?.status === 'discontinued');
  if (discontinued) {
    return `Produktion gestoppt: ${discontinued.sku.name} wird nicht mehr hergestellt – entwickle einen Nachfolger mit aktuellen Komponenten.`;
  }
  const first = shortages[0];
  const more = shortages.length > 1 ? ` (+${shortages.length - 1} weitere Komponenten)` : '';
  return `Produktion gestoppt: ${first.missing.toLocaleString('de-DE')} × ${first.sku.name} fehlen${more}.`;
}

function facilityDefectFactor(state: GameState, facilityId: string): number {
  if (facilityId === 'workshop') {
    const tools = WORKSHOP_TOOLS[state.production.workshop.toolLevel] ?? WORKSHOP_TOOLS[0];
    return 1 - tools.qualityBonus / 40;
  }
  const factory = state.production.factories.find((f) => f.id === facilityId);
  if (!factory) return 1;
  const automation = AUTOMATION_LEVELS.find((a) => a.level === factory.automation) ?? AUTOMATION_LEVELS[0];
  return (1 / getFactoryLocation(factory.locationId).qualityFactor) * (1 - automation.quality / 40);
}

function energyPerUnit(state: GameState, facilityId: string, product: Product): number {
  const category = CATEGORIES[product.category];
  const efficiency = 1 - techEffects(state).energyEfficiency;
  if (facilityId === 'workshop') return 1.5 * state.economy.energyPrice * efficiency;
  const factory = state.production.factories.find((f) => f.id === facilityId);
  if (!factory) return 0;
  const automation = AUTOMATION_LEVELS.find((a) => a.level === factory.automation) ?? AUTOMATION_LEVELS[0];
  const location = getFactoryLocation(factory.locationId);
  return 12 * category.capacityUnits * automation.energy * location.energyFactor * state.economy.energyPrice * efficiency;
}

/** Verbucht eine Fertigung: Qualitätskontrolle, Nacharbeit, Lizenzen, Energie. */
export function recordProduction(state: GameState, product: Product, facilityId: string | null, units: number, materialValue: number, qualityBonus = 0): void {
  if (units <= 0) return;
  const qc = QC_LEVELS[facilityId ? qcLevelOf(state, facilityId) : 'automated'];
  const facilityFactor = facilityId ? facilityDefectFactor(state, facilityId) : 1 - qualityBonus / 40;
  const rawDefect = product.quality.defectRate * facilityFactor;
  const caught = rawDefect * qc.detection;
  const escaped = rawDefect * (1 - qc.detection);
  const unitMaterial = materialValue / units;
  const priceLevel = state.economy.priceLevel;
  const reworkCost = caught * units * unitMaterial * 0.25;
  const qcCost = qc.costPerUnit * units * priceLevel;
  if (reworkCost + qcCost > 0) addTransaction(state, 'production', -(reworkCost + qcCost));
  const license = hasOwnOs(state, product.category) ? 0 : CATEGORIES[product.category].licenseCost * priceLevel * units;
  if (license > 0) addTransaction(state, 'licenses', -license);
  if (facilityId) addTransaction(state, 'energy', -energyPerUnit(state, facilityId, product) * units);

  const quality = product.quality;
  quality.escapedRate = (quality.escapedRate * quality.producedUnits + escaped * units) / (quality.producedUnits + units);
  quality.producedUnits += units;
  addProductStock(state, product.id, units, unitMaterial);
  state.stats.producedToday += units;
  state.stats.week.unitsProduced += units;
  state.stats.month.unitsProduced += units;
  state.stats.unitsProducedTotal += units;
}

function runLine(state: GameState, line: ProductionLine, product: Product, allocated: number, unitCost: number): number {
  const possible = line.progress + allocated / unitCost;
  const units = Math.floor(possible + 1e-9);
  if (units <= 0) {
    line.progress = possible;
    line.status = 'running';
    line.stallReason = undefined;
    return 0;
  }
  const category = CATEGORIES[product.category];
  const bom = billOfMaterials(state, product);
  let buildable = units;
  for (const item of bom) buildable = Math.min(buildable, Math.floor(componentStock(state, item.sku) / item.quantity));

  let storageLimited = false;
  const netVolume = category.productVolume - bom.reduce((a, item) => a + (item.sku.inhouseProductId ? 0 : item.sku.volume * item.quantity), 0);
  if (netVolume > 0) {
    const free = storageCapacity(state) - usedStorage(state);
    const maxByStorage = Math.max(0, Math.floor(free / netVolume));
    if (maxByStorage < buildable) {
      buildable = maxByStorage;
      storageLimited = true;
    }
  }

  if (buildable <= 0) {
    line.progress = Math.min(possible, 1);
    line.status = 'stalled';
    if (storageLimited) {
      line.stallReason = 'Lagerkapazität erreicht – Produktion pausiert. Lager erweitern oder Bestand abbauen.';
    } else {
      const weekly = Math.max(units, Math.round((allocated / unitCost) * 7));
      line.stallReason = describeShortage(state, componentShortages(state, product, weekly));
    }
    return 0;
  }

  let materialValue = 0;
  for (const item of bom) materialValue += consumeComponent(state, item.sku, item.quantity * buildable);
  recordProduction(state, product, line.facilityId, buildable, materialValue);

  line.progress = buildable < units ? 0 : possible - units;
  line.producedTotal += buildable;
  if (buildable < units) {
    line.status = 'stalled';
    line.stallReason = storageLimited
      ? 'Lagerkapazität erreicht – Produktion gedrosselt.'
      : describeShortage(state, componentShortages(state, product, Math.max(units, Math.round((allocated / unitCost) * 7))));
  } else {
    line.status = 'running';
    line.stallReason = undefined;
  }
  return buildable;
}

/** Kapital, das die automatische Nachbestellung nicht antastet. */
export const AUTO_ORDER_RESERVE = 3_000;

/**
 * Automatische Nachbestellung: hält die Komponentenreichweite einer Linie aufrecht.
 * Bestellt ausgewogene Sätze (alle Komponenten für dieselbe Stückzahl) und nur so viel,
 * wie das verfügbare Kapital abzüglich einer Reserve erlaubt.
 */
function autoReorder(state: GameState, line: ProductionLine, product: Product, dailyRate: number): void {
  if (!line.autoReorder || dailyRate <= 0) return;
  interface Plan {
    item: BomItem;
    mode: ProductionLine['shippingMode'];
    missingUnits: number;
    unitPrice: number;
  }
  const plans: Plan[] = [];
  let triggered = false;
  for (const item of billOfMaterials(state, product)) {
    if (item.sku.inhouseProductId) continue;
    const market = state.components.market[item.sku.id];
    if (!market || market.status === 'discontinued') continue;
    const modeAvailable = shippingOptions(state, item.sku).find((o) => o.mode === line.shippingMode)?.available;
    const mode = modeAvailable ? line.shippingMode : defaultShippingMode(state, item.sku);
    const quote = quotePurchase(state, item.sku, Math.max(1, Math.ceil(dailyRate * item.quantity)), mode);
    const coverageDays = Math.max(line.reorderDays, quote.leadTimeDays + 7);
    const targetUnits = dailyRate * coverageDays;
    const availableUnits = (componentStock(state, item.sku) + quantityInTransit(state, item.sku.id)) / item.quantity;
    if (availableUnits < targetUnits * 0.5) triggered = true;
    const missingUnits = Math.max(0, targetUnits - availableUnits);
    if (missingUnits > 0) plans.push({ item, mode, missingUnits, unitPrice: quote.unitPrice * item.quantity });
  }
  if (!triggered || plans.length === 0) return;
  const totalCost = plans.reduce((a, p) => a + p.missingUnits * p.unitPrice, 0);
  const budget = state.finance.cash - AUTO_ORDER_RESERVE;
  if (budget <= 0) {
    const note = `Auto-Einkauf pausiert – Kapital unter ${AUTO_ORDER_RESERVE.toLocaleString('de-DE')} € Reserve.`;
    line.stallReason = line.status === 'stalled' && line.stallReason ? `${line.stallReason} ${note}` : note;
    return;
  }
  const scale = Math.min(1, (budget * 0.95) / Math.max(1, totalCost));
  for (const plan of plans) {
    let quantity = Math.floor(plan.missingUnits * scale * plan.item.quantity);
    const cap = SHIPPING_MODES[plan.mode].maxQuantity;
    if (cap !== null) quantity = Math.min(quantity, cap);
    if (quantity < plan.item.quantity) continue;
    try {
      placeOrder(state, plan.item.sku.id, quantity, plan.mode, true);
    } catch (error) {
      if (!(error instanceof CommandError)) throw error;
      if (line.status !== 'stalled') line.stallReason = `Auto-Einkauf: ${error.message}`;
      return;
    }
  }
}

export function runProduction(state: GameState): void {
  state.stats.producedToday = 0;
  let capacityUnits = 0;
  let usedUnits = 0;
  const facilityIds = ['workshop', ...state.production.factories.map((f) => f.id)];
  const producedByLine = new Map<string, number>();

  for (const facilityId of facilityIds) {
    const capacity = facilityDailyCapacity(state, facilityId);
    const referenceUnits = capacity.unit === 'hours' ? capacity.perDay / 2.5 : capacity.perDay;
    capacityUnits += referenceUnits;
    const lines = state.production.lines.filter((l) => l.facilityId === facilityId && l.active && l.productId);
    if (lines.length === 0 || capacity.perDay <= 0) {
      for (const line of lines) {
        line.status = 'stalled';
        line.stallReason = facilityId === 'workshop' ? 'Kein Produktionspersonal in der Werkstatt.' : 'Kein Personal oder Fabrik im Bau.';
      }
      continue;
    }
    const entries = lines
      .map((line) => {
        const product = state.products.find((p) => p.id === line.productId);
        if (!product || (product.status !== 'ready' && product.status !== 'on_sale')) return null;
        const unitCost = unitCapacityCost(facilityId, product);
        const demand = line.targetPerDay > 0 ? line.targetPerDay * unitCost : Infinity;
        return { line, product, unitCost, demand };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => a.demand - b.demand);

    let remaining = capacity.perDay;
    let count = entries.length;
    for (const entry of entries) {
      const allocated = Math.min(entry.demand, remaining / count);
      remaining -= allocated;
      count--;
      const produced = runLine(state, entry.line, entry.product, allocated, entry.unitCost);
      producedByLine.set(entry.line.id, produced);
      usedUnits += (produced * entry.unitCost) / (capacity.unit === 'hours' ? 2.5 : 1);
      const dailyRate = Math.max(allocated / entry.unitCost, averageDaily(entry.line));
      autoReorder(state, entry.line, entry.product, dailyRate);
    }
  }

  for (const line of state.production.lines) pushCapped(line.producedLast30, producedByLine.get(line.id) ?? 0, 30);
  state.stats.utilization = capacityUnits > 0 ? Math.min(1, usedUnits / capacityUnits) : 0;
}

function averageDaily(line: ProductionLine): number {
  if (line.producedLast30.length === 0) return 0;
  return line.producedLast30.reduce((a, b) => a + b, 0) / line.producedLast30.length;
}
