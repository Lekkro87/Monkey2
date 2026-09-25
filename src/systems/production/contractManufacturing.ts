import { CATEGORIES } from '@/data/categories';
import { CONTRACT_MANUFACTURERS } from '@/data/channels';
import { LINE_TYPES } from '@/data/facilities';
import { ensure, nextId } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import type { ContractManufacturer, GameState, Product } from '@/types';
import { addTransaction } from '@/systems/finance/ledger';
import { consumeComponent } from '@/systems/inventory/inventory';
import { billOfMaterials, componentShortages, recordProduction } from './production';

export function contractManufacturer(id: string): ContractManufacturer | undefined {
  return CONTRACT_MANUFACTURERS.find((c) => c.id === id);
}

export interface ContractQuote {
  unitFee: number;
  totalFee: number;
  productionDays: number;
  shippingDays: number;
  readyInDays: number;
}

export function quoteContractManufacturing(state: GameState, manufacturer: ContractManufacturer, product: Product, quantity: number): ContractQuote {
  const category = CATEGORIES[product.category];
  const unitFee = manufacturer.feePerCapacityUnit * category.capacityUnits * state.economy.priceLevel;
  const productionDays = Math.ceil(4 + (manufacturer.productionDaysPer1000 * quantity) / 1_000);
  const shippingDays = manufacturer.region === state.company.homeRegion ? 4 : manufacturer.shippingDays;
  return { unitFee, totalFee: unitFee * quantity, productionDays, shippingDays, readyInDays: productionDays + shippingDays };
}

export function orderContractManufacturing(state: GameState, manufacturerId: string, productId: string, quantity: number): string {
  const manufacturer = contractManufacturer(manufacturerId);
  ensure(manufacturer, 'Unbekannter Auftragsfertiger.');
  const product = state.products.find((p) => p.id === productId);
  ensure(product, 'Produkt nicht gefunden.');
  ensure(product.status === 'ready' || product.status === 'on_sale', 'Nur fertig entwickelte Produkte können gefertigt werden.');
  const category = CATEGORIES[product.category];
  ensure(
    manufacturer.lineTypes.includes(category.lineType),
    `${manufacturer.name} bietet keine ${LINE_TYPES[category.lineType].name} an.`,
  );
  const qty = Math.floor(quantity);
  ensure(qty >= manufacturer.minOrder, `Mindestbestellmenge: ${manufacturer.minOrder.toLocaleString('de-DE')} Stück.`);
  const shortages = componentShortages(state, product, qty);
  if (shortages.length > 0) {
    const first = shortages[0];
    ensure(false, `Produktion kann nicht gestartet werden. ${first.missing.toLocaleString('de-DE')} × ${first.sku.name} fehlen.`);
  }
  const quote = quoteContractManufacturing(state, manufacturer, product, qty);
  ensure(state.finance.cash >= quote.totalFee, `Nicht genügend Kapital. Der Auftrag kostet ${Math.round(quote.totalFee).toLocaleString('de-DE')} €.`);
  addTransaction(state, 'production', -quote.totalFee);
  let materialValue = 0;
  for (const item of billOfMaterials(state, product)) materialValue += consumeComponent(state, item.sku, item.quantity * qty);
  state.supply.cmOrders.push({
    id: nextId(state, 'cm'),
    manufacturerId,
    productId,
    quantity: qty,
    unitFee: quote.unitFee,
    materialCostPerUnit: materialValue / qty,
    orderDay: state.time.day,
    readyDay: state.time.day + quote.readyInDays,
    status: 'in_production',
  });
  return `${qty.toLocaleString('de-DE')} × ${product.name} bei ${manufacturer.name} beauftragt – Lieferung in ${quote.readyInDays} Tagen.`;
}

export function processContractManufacturing(state: GameState): void {
  const day = state.time.day;
  let changed = false;
  for (const order of state.supply.cmOrders) {
    if (order.status !== 'in_production' || day < order.readyDay) continue;
    order.status = 'delivered';
    changed = true;
    const product = state.products.find((p) => p.id === order.productId);
    const manufacturer = contractManufacturer(order.manufacturerId);
    if (!product) continue;
    recordProduction(state, product, null, order.quantity, order.materialCostPerUnit * order.quantity, manufacturer?.qualityBonus ?? 0);
    addNews(state, 'company', 'neutral', `Lieferung vom Auftragsfertiger: ${order.quantity.toLocaleString('de-DE')} × ${product.name}`, manufacturer ? `Gefertigt von ${manufacturer.name}.` : undefined);
  }
  if (changed) {
    state.supply.cmOrders = [
      ...state.supply.cmOrders.filter((o) => o.status === 'delivered').slice(-30),
      ...state.supply.cmOrders.filter((o) => o.status !== 'delivered'),
    ];
  }
}
