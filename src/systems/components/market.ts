import { COMPONENT_FAMILY_TYPES_SEMICONDUCTOR } from './classification';
import { createSku, createSkuMarketState, currentGeneration, getSku, skuPriceEur } from './catalog';
import { COMPONENT_FAMILIES, COMPONENT_TYPE_LABELS } from '@/data/componentCatalog';
import { DIFFICULTIES } from '@/data/difficulties';
import { getManufacturer } from '@/data/manufacturers';
import { isWeekStart } from '@/simulation/calendar';
import { multiplier } from '@/simulation/modifiers';
import { addNews } from '@/simulation/news';
import { gaussian, randomRange } from '@/simulation/rng';
import type { ComponentSku, ComponentType, GameState } from '@/types';
import { clamp, pushCapped } from '@/utils/math';
import { techEffects } from '@/systems/research/effects';
import { getManufacturerName } from '@/services/brandLicense';

const EOL_ORDER_WINDOW_DAYS = 240;

/** Monatliche Menge, die ein Hersteller dem Spieler ohne Aufschlag liefert. */
export function playerAllocation(state: GameState, sku: ComponentSku): number {
  const manufacturer = getManufacturer(sku.manufacturerId);
  const share = manufacturer?.allocationShare ?? 0.03;
  const supply = multiplier(state, 'componentSupply', { componentType: sku.type, manufacturerId: sku.manufacturerId });
  return Math.max(50, sku.monthlySupply * share * supply);
}

function marketIndexFor(state: GameState, type: ComponentType): number {
  if (COMPONENT_FAMILY_TYPES_SEMICONDUCTOR.has(type)) return state.economy.chipIndex;
  if (type === 'display' || type === 'camera') return (state.economy.chipIndex + state.economy.rawMaterialIndex) / 2;
  return state.economy.rawMaterialIndex;
}

function releaseGeneration(state: GameState, familyId: string): void {
  const family = COMPONENT_FAMILIES.find((f) => f.id === familyId);
  if (!family || !family.cadenceDays) return;
  const previous = currentGeneration(state, familyId);
  const generation = previous + 1;
  const day = state.time.day;
  const created: ComponentSku[] = [];
  // Copy-on-Write: der Komponentenkatalog wird zwischen Snapshots geteilt.
  state.components.skus = { ...state.components.skus };
  for (const model of family.models) {
    if ((model.fromGeneration ?? 1) > generation) continue;
    const sku = createSku(family, model, generation, day, state.economy.priceLevel, state);
    state.components.skus[sku.id] = sku;
    state.components.market[sku.id] = createSkuMarketState(sku);
    created.push(sku);
  }
  // Vorgängergeneration wird zum Auslaufmodell und günstiger.
  for (const sku of Object.values(state.components.skus)) {
    if (sku.familyId !== familyId || sku.generation !== previous) continue;
    const market = state.components.market[sku.id];
    if (!market || market.status !== 'active') continue;
    market.status = 'eol';
    market.eolDay = day + EOL_ORDER_WINDOW_DAYS;
    market.price *= 0.88;
  }
  state.components.nextReleaseDay[familyId] = day + Math.round(family.cadenceDays * randomRange(state, 0.85, 1.15));
  if (created.length > 0 && ['cpu', 'gpu', 'soc', 'gpu_chip'].includes(family.type)) {
    const manufacturerName = getManufacturerName(family.manufacturerId);
    const top = created[created.length - 1];
    addNews(
      state,
      'market',
      'neutral',
      `${manufacturerName} stellt neue ${COMPONENT_TYPE_LABELS[family.type]}-Generation vor`,
      `Neu: ${created.map((s) => s.name).join(', ')}. Das Topmodell ${top.name} ist rund ${Math.round(
        (top.performance / family.models[family.models.length - 1].performance - 1) * 100,
      )} % schneller als zum Spielstart. Vorgängermodelle sind noch ${EOL_ORDER_WINDOW_DAYS} Tage bestellbar.`,
    );
  }
}

export function updateComponentMarket(state: GameState): void {
  const day = state.time.day;
  const difficulty = DIFFICULTIES[state.difficulty];
  const volatility = 0.006 * difficulty.priceVolatility;
  const materialFactor = 1 + techEffects(state).materialCost;
  const weekly = isWeekStart(day);

  for (const [familyId, releaseDay] of Object.entries(state.components.nextReleaseDay)) {
    if (day >= releaseDay) releaseGeneration(state, familyId);
  }

  for (const sku of Object.values(state.components.skus)) {
    if (sku.inhouseProductId) continue;
    const market = state.components.market[sku.id];
    if (!market || market.status === 'discontinued') continue;

    if (market.status === 'eol' && market.eolDay !== undefined && day >= market.eolDay) {
      market.status = 'discontinued';
      continue;
    }

    const ageMonths = Math.max(0, (day - sku.releaseDay) / 30.4);
    const lifecycle = Math.max(0.68, 1 - 0.012 * ageMonths);
    const index = marketIndexFor(state, sku.type);
    const eventFactor = multiplier(state, 'componentPrice', { componentType: sku.type, manufacturerId: sku.manufacturerId });
    const allocation = playerAllocation(state, sku);
    const pressure = market.orderedThisMonth / allocation;
    const targetScarcity = 1 + clamp(pressure - 0.8, 0, 2) * 0.25;
    market.scarcity += (targetScarcity - market.scarcity) * 0.1;
    const target = sku.basePrice * lifecycle * index * eventFactor * market.scarcity * (market.status === 'eol' ? 0.88 : 1);
    const noise = gaussian(state, 0, volatility);
    market.price = Math.max(sku.basePrice * 0.3, market.price + (target - market.price) * 0.08 + market.price * noise);

    if (weekly) {
      pushCapped(market.history, Math.round(skuPriceEur(state, sku) * materialFactor * 100) / 100, 78);
      if (market.history.length >= 5) {
        const fx = state.economy.exchangeRates[sku.currency];
        market.price30dAgo = market.history[market.history.length - 5] / Math.max(1e-9, fx * materialFactor);
      }
    }
  }
}

export function resetMonthlyComponentOrders(state: GameState): void {
  for (const market of Object.values(state.components.market)) market.orderedThisMonth = 0;
}

/** Durchschnittliche Preisänderung eines Komponententyps über ~30 Tage (für News). */
export function typePriceTrend(state: GameState, type: ComponentType): number {
  let total = 0;
  let count = 0;
  for (const sku of Object.values(state.components.skus)) {
    if (sku.type !== type || sku.inhouseProductId) continue;
    const market = state.components.market[sku.id];
    if (!market || market.status !== 'active' || market.price30dAgo <= 0) continue;
    total += market.price / market.price30dAgo - 1;
    count++;
  }
  return count === 0 ? 0 : total / count;
}

export function findSku(state: GameState, id: string): ComponentSku {
  const sku = getSku(state, id);
  if (!sku) throw new Error(`Unbekannte Komponente ${id}`);
  return sku;
}
