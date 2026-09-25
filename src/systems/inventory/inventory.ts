import { CATEGORIES } from '@/data/categories';
import { OFFICES, OVERFLOW_FEE_PER_UNIT_DAY, WAREHOUSE_TYPES } from '@/data/facilities';
import { CommandError, ensure, nextId } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import type { ComponentSku, GameState, WarehouseKind } from '@/types';
import { addTransaction, recordCogs } from '@/systems/finance/ledger';
import { skuPriceEur } from '@/systems/components/catalog';
import { clamp } from '@/utils/math';

export function componentStock(state: GameState, sku: ComponentSku): number {
  if (sku.inhouseProductId) return state.inventory.products[sku.inhouseProductId]?.qty ?? 0;
  return state.inventory.components[sku.id]?.qty ?? 0;
}

export function addComponentStock(state: GameState, skuId: string, qty: number, unitCost: number): void {
  if (qty <= 0) return;
  const entry = state.inventory.components[skuId];
  if (!entry) {
    state.inventory.components[skuId] = { qty, avgCost: unitCost };
    return;
  }
  const total = entry.qty + qty;
  entry.avgCost = total > 0 ? (entry.qty * entry.avgCost + qty * unitCost) / total : unitCost;
  entry.qty = total;
}

/** Entnimmt Komponenten und liefert den Materialwert der entnommenen Menge. */
export function consumeComponent(state: GameState, sku: ComponentSku, qty: number): number {
  if (qty <= 0) return 0;
  const entry = sku.inhouseProductId ? state.inventory.products[sku.inhouseProductId] : state.inventory.components[sku.id];
  if (!entry || entry.qty < qty) throw new Error(`Bestand für ${sku.id} reicht nicht (${entry?.qty ?? 0} < ${qty})`);
  entry.qty -= qty;
  const value = qty * entry.avgCost;
  if (entry.qty <= 1e-9) {
    entry.qty = 0;
  }
  return value;
}

export function addProductStock(state: GameState, productId: string, qty: number, unitCost: number): void {
  if (qty <= 0) return;
  const entry = state.inventory.products[productId];
  if (!entry) {
    state.inventory.products[productId] = { qty, avgCost: unitCost };
    return;
  }
  const total = entry.qty + qty;
  entry.avgCost = total > 0 ? (entry.qty * entry.avgCost + qty * unitCost) / total : unitCost;
  entry.qty = total;
}

export function productStock(state: GameState, productId: string): number {
  return state.inventory.products[productId]?.qty ?? 0;
}

export function storageCapacity(state: GameState): number {
  const office = OFFICES[state.company.officeLevel] ?? OFFICES[0];
  let capacity = office.storage;
  for (const warehouse of state.warehouses) {
    if (warehouse.status === 'operational') capacity += warehouse.capacity;
  }
  return capacity;
}

export function componentsVolume(state: GameState): number {
  let volume = 0;
  for (const [skuId, entry] of Object.entries(state.inventory.components)) {
    if (entry.qty <= 0) continue;
    const sku = state.components.skus[skuId];
    volume += entry.qty * (sku?.volume ?? 0.1);
  }
  return volume;
}

export function productsVolume(state: GameState): number {
  let volume = 0;
  for (const product of state.products) {
    const qty = state.inventory.products[product.id]?.qty ?? 0;
    if (qty > 0) volume += qty * CATEGORIES[product.category].productVolume;
  }
  return volume;
}

export function usedStorage(state: GameState): number {
  return componentsVolume(state) + productsVolume(state);
}

export function inventoryValue(state: GameState): { components: number; products: number } {
  let components = 0;
  for (const entry of Object.values(state.inventory.components)) components += entry.qty * entry.avgCost;
  let products = 0;
  for (const entry of Object.values(state.inventory.products)) products += entry.qty * entry.avgCost;
  return { components, products };
}

export function totalProductUnits(state: GameState): number {
  let units = 0;
  for (const entry of Object.values(state.inventory.products)) units += entry.qty;
  return units;
}

export function totalComponentUnits(state: GameState): number {
  let units = 0;
  for (const entry of Object.values(state.inventory.components)) units += entry.qty;
  return units;
}

/** Tägliche Lagerkosten: Miete der Lager und Gebühren für Überbestand. */
export function processWarehouses(state: GameState): void {
  const day = state.time.day;
  let rent = 0;
  for (const warehouse of state.warehouses) {
    if (warehouse.status === 'building' && day >= warehouse.readyDay) {
      warehouse.status = 'operational';
      addNews(state, 'company', 'positive', `${warehouse.name} ist einsatzbereit`, `Zusätzliche Lagerkapazität: ${warehouse.capacity.toLocaleString('de-DE')} Einheiten.`);
    }
    if (warehouse.status === 'operational') rent += warehouse.rentPerMonth;
  }
  if (rent > 0) addTransaction(state, 'warehousing', (-rent * state.economy.priceLevel * 12) / 365);

  const used = usedStorage(state);
  const capacity = storageCapacity(state);
  if (used > capacity) {
    addTransaction(state, 'warehousing', -(used - capacity) * OVERFLOW_FEE_PER_UNIT_DAY);
  }
}

export function rentWarehouse(state: GameState, kind: WarehouseKind): string {
  const def = WAREHOUSE_TYPES.find((w) => w.kind === kind);
  if (!def) throw new CommandError('Unbekannter Lagertyp.');
  ensure(state.company.stage >= def.minStage, `${def.name} ist erst ab Unternehmensstufe ${def.minStage} verfügbar.`);
  const cost = def.setupCost * state.economy.priceLevel;
  ensure(state.finance.cash >= cost, 'Nicht genügend Kapital.');
  addTransaction(state, 'capex', -cost);
  const count = state.warehouses.filter((w) => w.kind === kind).length;
  state.warehouses.push({
    id: nextId(state, 'wh'),
    kind,
    name: `${def.name} ${count + 1}`,
    capacity: def.capacity,
    rentPerMonth: def.rentPerMonth,
    status: def.buildDays > 0 ? 'building' : 'operational',
    readyDay: state.time.day + def.buildDays,
  });
  return `${def.name} angemietet – bereit in ${def.buildDays} Tagen.`;
}

export function closeWarehouse(state: GameState, warehouseId: string): string {
  const warehouse = state.warehouses.find((w) => w.id === warehouseId);
  ensure(warehouse, 'Lager nicht gefunden.');
  const remaining = storageCapacity(state) - (warehouse.status === 'operational' ? warehouse.capacity : 0);
  ensure(usedStorage(state) <= remaining, 'Das Lager ist noch belegt. Reduziere zuerst den Bestand.');
  state.warehouses = state.warehouses.filter((w) => w.id !== warehouseId);
  return `${warehouse.name} wurde gekündigt.`;
}

/** Anteil des Marktpreises, den Restpostenhändler für Komponenten zahlen. */
export const COMPONENT_RESALE_FACTOR = 0.6;
/** Anteil des Verkaufspreises, den Restpostenhändler für Fertigwaren zahlen. */
export const PRODUCT_CLEARANCE_FACTOR = 0.45;

export function componentResalePrice(state: GameState, sku: ComponentSku): number {
  return skuPriceEur(state, sku) * COMPONENT_RESALE_FACTOR;
}

/** Verkauft Komponenten an einen Restpostenhändler (Liquidität gegen Abschlag). */
export function sellComponents(state: GameState, skuId: string, quantity: number): string {
  const sku = state.components.skus[skuId];
  ensure(sku && !sku.inhouseProductId, 'Unbekannte Komponente.');
  const entry = state.inventory.components[skuId];
  const qty = Math.floor(quantity);
  ensure(qty >= 1, 'Bitte mindestens 1 Stück angeben.');
  ensure(entry && entry.qty >= qty, `Nur ${Math.floor(entry?.qty ?? 0).toLocaleString('de-DE')} Stück auf Lager.`);
  const proceeds = qty * componentResalePrice(state, sku);
  const bookValue = qty * entry.avgCost;
  entry.qty -= qty;
  // Erlös fließt zurück in den Einkauf (Bestandsabbau), der Buchverlust wird als Materialaufwand erfasst.
  addTransaction(state, 'purchases', proceeds);
  if (bookValue > proceeds) recordCogs(state, bookValue - proceeds);
  return `${qty.toLocaleString('de-DE')} × ${sku.name} für ${Math.round(proceeds).toLocaleString('de-DE')} € verkauft.`;
}

/** Verkauft Fertigwaren als Restposten an Großhändler – schnell, aber mit Imageschaden. */
export function clearProductStock(state: GameState, productId: string, quantity: number): string {
  const product = state.products.find((p) => p.id === productId);
  ensure(product, 'Produkt nicht gefunden.');
  const entry = state.inventory.products[productId];
  const qty = Math.floor(quantity);
  ensure(qty >= 1, 'Bitte mindestens 1 Stück angeben.');
  ensure(entry && entry.qty >= qty, `Nur ${Math.floor(entry?.qty ?? 0).toLocaleString('de-DE')} Stück auf Lager.`);
  const proceeds = qty * product.price * PRODUCT_CLEARANCE_FACTOR;
  entry.qty -= qty;
  addTransaction(state, 'sales', proceeds);
  recordCogs(state, qty * entry.avgCost);
  const share = qty / Math.max(1, product.sales.unitsLast30 + qty);
  state.brand.premium = clamp(state.brand.premium - Math.min(3, share * 4), 0, 100);
  return `${qty.toLocaleString('de-DE')} × ${product.name} als Restposten für ${Math.round(proceeds).toLocaleString('de-DE')} € verkauft.`;
}
