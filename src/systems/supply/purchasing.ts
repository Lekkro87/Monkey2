import { getSku, isPurchasable, skuPriceEur } from '@/systems/components/catalog';
import { playerAllocation } from '@/systems/components/market';
import { SHIPPING_MODES } from '@/data/channels';
import { DIFFICULTIES } from '@/data/difficulties';
import { getManufacturer } from '@/data/manufacturers';
import { CommandError, ensure, nextId } from '@/simulation/commands';
import { additive, multiplier } from '@/simulation/modifiers';
import { addNews } from '@/simulation/news';
import { chance, randomInt } from '@/simulation/rng';
import type { ComponentSku, GameState, PurchaseOrder, ShippingMode, SupplyContract } from '@/types';
import { clamp } from '@/utils/math';
import { addComponentStock } from '@/systems/inventory/inventory';
import { addTransaction } from '@/systems/finance/ledger';
import { techEffects } from '@/systems/research/effects';
import { getManufacturerName } from '@/services/brandLicense';
import { logisticsCostFactor } from '@/systems/logistics/logistics';

export interface ShippingOption {
  mode: ShippingMode;
  days: number;
  available: boolean;
}

export function isDomestic(state: GameState, sku: ComponentSku): boolean {
  const manufacturer = getManufacturer(sku.manufacturerId);
  return (manufacturer?.region ?? 'asia') === state.company.homeRegion;
}

export function shippingOptions(state: GameState, sku: ComponentSku): ShippingOption[] {
  const domestic = isDomestic(state, sku);
  return (Object.keys(SHIPPING_MODES) as ShippingMode[]).map((mode) => {
    const def = SHIPPING_MODES[mode];
    const days = domestic ? def.domesticDays : def.intercontinentalDays;
    return { mode, days: days ?? 0, available: days !== null };
  });
}

export function defaultShippingMode(state: GameState, sku: ComponentSku): ShippingMode {
  return isDomestic(state, sku) ? 'truck' : 'ship';
}

export function shippingCost(state: GameState, sku: ComponentSku, quantity: number, mode: ShippingMode): number {
  const def = SHIPPING_MODES[mode];
  const distance = isDomestic(state, sku) || !def.usesSupplierLeadTime ? 1 : 1.6;
  const base = def.fixedCost + quantity * sku.volume * def.costPerVolume * distance;
  return base * state.economy.priceLevel * logisticsCostFactor(state);
}

function volumeDiscount(quantity: number): number {
  if (quantity >= 1_000_000) return 0.16;
  if (quantity >= 100_000) return 0.13;
  if (quantity >= 10_000) return 0.09;
  if (quantity >= 1_000) return 0.05;
  if (quantity >= 100) return 0.02;
  return 0;
}

export function activeContractFor(state: GameState, skuId: string): SupplyContract | undefined {
  return state.supply.contracts.find((c) => c.skuId === skuId && c.status === 'active');
}

export interface PurchaseQuote {
  unitPrice: number;
  listPrice: number;
  discount: number;
  surcharge: number;
  subtotal: number;
  shipping: number;
  total: number;
  leadTimeDays: number;
  allocation: number;
  exceedsAllocation: boolean;
  contract: boolean;
}

/** Faktor für Materialkosten aus Schwierigkeitsgrad und Forschung. */
export function materialCostFactor(state: GameState): number {
  return DIFFICULTIES[state.difficulty].productionCost * (1 + techEffects(state).materialCost);
}

export function quotePurchase(state: GameState, sku: ComponentSku, quantity: number, mode: ShippingMode): PurchaseQuote {
  const def = SHIPPING_MODES[mode];
  const listPrice = skuPriceEur(state, sku) * materialCostFactor(state);
  const contract = def.usesSupplierLeadTime ? activeContractFor(state, sku.id) : undefined;
  const market = state.components.market[sku.id];
  const allocation = playerAllocation(state, sku) + (contract ? contract.monthlyMinimum : 0);
  const alreadyOrdered = market?.orderedThisMonth ?? 0;
  const excess = def.usesSupplierLeadTime ? Math.max(0, alreadyOrdered + quantity - allocation) : 0;
  const excessRatio = excess / Math.max(1, allocation);
  const surcharge = excess > 0 ? clamp(0.1 + 0.25 * excessRatio, 0.1, 0.45) * (excess / quantity) : 0;
  const discount = contract || !def.usesSupplierLeadTime ? 0 : volumeDiscount(quantity);
  const base = contract ? contract.unitPriceEur : listPrice * (1 - discount);
  const unitPrice = base * (1 + surcharge) * (1 + def.pricePremium);
  const subtotal = unitPrice * quantity;
  const shipping = shippingCost(state, sku, quantity, mode);
  const option = shippingOptions(state, sku).find((o) => o.mode === mode);
  const transit = option?.days ?? 30;
  const extraDelay = Math.round(sku.leadTimeDays * Math.min(2, excessRatio) * 0.6);
  const supplierLead = def.usesSupplierLeadTime ? sku.leadTimeDays * multiplier(state, 'leadTime', { componentType: sku.type, manufacturerId: sku.manufacturerId }) : 0;
  const leadTimeDays = Math.round(supplierLead + transit + extraDelay + additive(state, 'shippingDelay', { shippingMode: mode }));
  return {
    unitPrice,
    listPrice,
    discount,
    surcharge,
    subtotal,
    shipping,
    total: subtotal + shipping,
    leadTimeDays,
    allocation,
    exceedsAllocation: excess > 0,
    contract: !!contract,
  };
}

export function placeOrder(state: GameState, skuId: string, quantity: number, mode: ShippingMode, auto = false): PurchaseOrder {
  const sku = getSku(state, skuId);
  ensure(sku, 'Unbekannte Komponente.');
  ensure(isPurchasable(state, sku), `${sku.name} ist nicht mehr lieferbar.`);
  ensure(Number.isFinite(quantity) && quantity >= 1, 'Bitte eine Menge von mindestens 1 Stück angeben.');
  const qty = Math.floor(quantity);
  const option = shippingOptions(state, sku).find((o) => o.mode === mode);
  ensure(option?.available, 'Diese Versandart ist für diesen Lieferanten nicht verfügbar.');
  const maxQuantity = SHIPPING_MODES[mode].maxQuantity;
  ensure(maxQuantity === null || qty <= maxQuantity, `Der Großhandel liefert höchstens ${maxQuantity?.toLocaleString('de-DE')} Stück pro Bestellung.`);
  const quote = quotePurchase(state, sku, qty, mode);
  ensure(state.finance.cash >= quote.total, `Nicht genügend Kapital. Benötigt: ${Math.round(quote.total).toLocaleString('de-DE')} €.`);

  // Frachtkosten werden aktiviert (Teil der Anschaffungskosten des Bestands).
  addTransaction(state, 'purchases', -(quote.subtotal + quote.shipping));
  const market = state.components.market[sku.id];
  const direct = SHIPPING_MODES[mode].usesSupplierLeadTime;
  if (market && direct) market.orderedThisMonth += qty;
  const contract = direct ? activeContractFor(state, sku.id) : undefined;
  if (contract) contract.orderedThisMonth += qty;

  const def = SHIPPING_MODES[mode];
  const delayRisk = def.delayRisk * DIFFICULTIES[state.difficulty].eventFrequency;
  const delayed = chance(state, delayRisk);
  const delayDays = delayed ? randomInt(state, 3, mode === 'ship' ? 14 : 6) : 0;
  const order: PurchaseOrder = {
    id: nextId(state, 'po'),
    skuId: sku.id,
    quantity: qty,
    unitPriceEur: quote.unitPrice + quote.shipping / qty,
    shippingCost: quote.shipping,
    orderDay: state.time.day,
    expectedDay: state.time.day + quote.leadTimeDays,
    deliveryDay: state.time.day + quote.leadTimeDays + delayDays,
    mode,
    status: 'in_transit',
    delayed,
    delayReason: delayed ? (mode === 'ship' ? 'Verzögerung im Hafen' : 'Verzögerung beim Lieferanten') : undefined,
    contractId: contract?.id,
    auto,
  };
  state.supply.orders.push(order);
  return order;
}

export function orderComponents(state: GameState, skuId: string, quantity: number, mode: ShippingMode): string {
  const order = placeOrder(state, skuId, quantity, mode);
  const sku = getSku(state, skuId);
  return `${order.quantity.toLocaleString('de-DE')} × ${sku?.name ?? 'Komponente'} bestellt – Lieferung in ${order.expectedDay - state.time.day} Tagen.`;
}

/** Menge eines Artikels, die bereits unterwegs ist. */
export function quantityInTransit(state: GameState, skuId: string): number {
  let qty = 0;
  for (const order of state.supply.orders) if (order.status === 'in_transit' && order.skuId === skuId) qty += order.quantity;
  return qty;
}

export function processDeliveries(state: GameState): void {
  const day = state.time.day;
  let delivered = false;
  for (const order of state.supply.orders) {
    if (order.status !== 'in_transit' || day < order.deliveryDay) continue;
    order.status = 'delivered';
    delivered = true;
    addComponentStock(state, order.skuId, order.quantity, order.unitPriceEur);
    if (order.delayed && order.deliveryDay - order.expectedDay >= 5 && !order.auto) {
      const sku = getSku(state, order.skuId);
      addNews(state, 'company', 'negative', `Lieferung verspätet: ${sku?.name ?? order.skuId}`, `${order.delayReason ?? 'Verzögerung'} – ${order.deliveryDay - order.expectedDay} Tage später als geplant.`);
    }
  }
  if (delivered) {
    const inTransit = state.supply.orders.filter((o) => o.status === 'in_transit');
    const done = state.supply.orders.filter((o) => o.status !== 'in_transit').slice(-60);
    state.supply.orders = [...done, ...inTransit];
  }
}

/** Verschiebt laufende Lieferungen (z. B. durch Zulieferer-Ausfall oder Hafenstreik). */
export function delayOrders(state: GameState, predicate: (order: PurchaseOrder) => boolean, days: number, reason: string): number {
  let count = 0;
  for (const order of state.supply.orders) {
    if (order.status !== 'in_transit' || !predicate(order)) continue;
    order.deliveryDay += days;
    order.delayed = true;
    order.delayReason = reason;
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Lieferverträge
// ---------------------------------------------------------------------------

export interface ContractQuote {
  unitPrice: number;
  discount: number;
  monthlyValue: number;
  totalCommitment: number;
}

export function quoteContract(state: GameState, sku: ComponentSku, monthlyMinimum: number, months: number): ContractQuote {
  const listPrice = skuPriceEur(state, sku) * materialCostFactor(state);
  const volumeBonus = Math.min(0.04, Math.log10(Math.max(10, monthlyMinimum)) * 0.008);
  const durationBonus = Math.min(0.05, months * 0.0025);
  const discount = 0.03 + volumeBonus + durationBonus;
  const unitPrice = listPrice * (1 - discount);
  return { unitPrice, discount, monthlyValue: unitPrice * monthlyMinimum, totalCommitment: unitPrice * monthlyMinimum * months };
}

export function signContract(state: GameState, skuId: string, monthlyMinimum: number, months: number, mode: ShippingMode): string {
  const sku = getSku(state, skuId);
  ensure(sku, 'Unbekannte Komponente.');
  ensure(isPurchasable(state, sku) && state.components.market[sku.id]?.status === 'active', 'Für Auslaufmodelle werden keine Verträge mehr abgeschlossen.');
  ensure(!activeContractFor(state, skuId), 'Für diese Komponente besteht bereits ein aktiver Vertrag.');
  ensure(monthlyMinimum >= 50, 'Die Mindestabnahme muss mindestens 50 Stück pro Monat betragen.');
  ensure([3, 6, 12, 24].includes(months), 'Ungültige Laufzeit.');
  const option = shippingOptions(state, sku).find((o) => o.mode === mode);
  ensure(option?.available && mode !== 'distributor', 'Diese Versandart ist für Lieferverträge nicht verfügbar.');
  const quote = quoteContract(state, sku, Math.floor(monthlyMinimum), months);
  const deposit = quote.monthlyValue * 0.1;
  ensure(state.finance.cash >= deposit, `Nicht genügend Kapital für die Vertragsanzahlung (${Math.round(deposit).toLocaleString('de-DE')} €).`);
  addTransaction(state, 'fees', -deposit);
  state.supply.contracts.push({
    id: nextId(state, 'ct'),
    skuId,
    unitPriceEur: quote.unitPrice,
    monthlyMinimum: Math.floor(monthlyMinimum),
    startDay: state.time.day,
    endDay: state.time.day + Math.round(months * 30.4),
    orderedThisMonth: 0,
    status: 'active',
    mode,
  });
  return `Liefervertrag mit ${getManufacturerName(sku.manufacturerId)} über ${Math.floor(monthlyMinimum).toLocaleString('de-DE')} Stück/Monat abgeschlossen.`;
}

/** Monatsabschluss der Verträge: Mindestabnahme sicherstellen (Take-or-Pay) und Laufzeiten prüfen. */
export function processContractsMonthly(state: GameState): void {
  const day = state.time.day;
  for (const contract of state.supply.contracts) {
    if (contract.status !== 'active') continue;
    const shortfall = contract.monthlyMinimum - contract.orderedThisMonth;
    contract.orderedThisMonth = 0;
    if (shortfall > 0) {
      const sku = getSku(state, contract.skuId);
      if (sku && isPurchasable(state, sku)) {
        try {
          const cost = contract.unitPriceEur * shortfall;
          if (state.finance.cash < cost) {
            addTransaction(state, 'fees', -cost * 0.3);
            addNews(state, 'finance', 'negative', 'Vertragsstrafe fällig', `Mindestabnahme für ${sku.name} konnte nicht bezahlt werden – 30 % Strafe (${Math.round(cost * 0.3).toLocaleString('de-DE')} €).`);
          } else {
            placeOrder(state, contract.skuId, shortfall, contract.mode, true);
          }
        } catch (error) {
          if (!(error instanceof CommandError)) throw error;
        }
      }
    }
    if (day >= contract.endDay) {
      contract.status = 'expired';
      const sku = getSku(state, contract.skuId);
      addNews(state, 'company', 'neutral', 'Liefervertrag ausgelaufen', `Der Vertrag für ${sku?.name ?? contract.skuId} ist beendet.`);
    }
  }
  state.supply.contracts = state.supply.contracts.filter((c) => c.status === 'active' || day - c.endDay < 180);
}
