import { COMPONENT_FAMILIES, getFamily, techCurve, type ComponentFamilyDef, type ComponentModelDef } from '@/data/componentCatalog';
import { getManufacturer } from '@/data/manufacturers';
import { randomRange, type RngHolder } from '@/simulation/rng';
import type { ComponentSku, ComponentSpecs, CurrencyCode, GameState, SkuMarketState } from '@/types';

/** Wechselkurse zum Spielstart (EUR je Währungseinheit). */
export const FX_START: Record<CurrencyCode, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  JPY: 0.0062,
  CNY: 0.128,
};

export function skuId(familyId: string, modelKey: string, generation: number): string {
  return `${familyId}.${modelKey}.g${generation}`;
}

export function parseSkuId(id: string): { familyId: string; modelKey: string; generation: number } | null {
  const match = /^(.+)\.([^.]+)\.g(\d+)$/.exec(id);
  if (!match) return null;
  return { familyId: match[1], modelKey: match[2], generation: Number(match[3]) };
}

function formatCapacity(gb: number): string {
  if (gb >= 1024) {
    const tb = gb / 1024;
    return `${Number.isInteger(tb) ? tb : tb.toFixed(1).replace('.', ',')} TB`;
  }
  return `${gb} GB`;
}

function specsForGeneration(family: ComponentFamilyDef, model: ComponentModelDef, generation: number): ComponentSpecs {
  const specs: ComponentSpecs = { ...(model.specs ?? {}) };
  if (family.capacityScaling && specs.capacityGb) {
    specs.capacityGb = specs.capacityGb * 2 ** (generation - 1);
    if (family.memoryTypes) specs.memoryType = family.memoryTypes[Math.min(generation - 1, family.memoryTypes.length - 1)];
  }
  if (family.type === 'battery' && generation > 1) {
    const factor = 1.08 ** (generation - 1);
    if (specs.capacityWh) specs.capacityWh = Math.round(specs.capacityWh * factor * 10) / 10;
    if (specs.capacityMah) specs.capacityMah = Math.round((specs.capacityMah * factor) / 50) * 50;
  }
  if (family.type === 'camera' && generation > 1 && specs.cameraMp && specs.cameraMp > 8) {
    specs.cameraMp = Math.round(specs.cameraMp * 1.25 ** (generation - 1));
  }
  if ((family.type === 'cpu' || family.type === 'soc') && specs.cores && generation > 1) {
    specs.cores = Math.round(specs.cores * 1.1 ** (generation - 1));
  }
  return specs;
}

function renderName(family: ComponentFamilyDef, model: ComponentModelDef, generation: number, specs: ComponentSpecs): string {
  const series = (family.seriesStart ?? 1) + (generation - 1) * (family.seriesStep ?? 1);
  let name = model.name.replace('{s}', String(series));
  if (name.includes('{cap}')) name = name.replace('{cap}', formatCapacity(specs.capacityGb ?? 0));
  if (name.includes('{mt}')) name = name.replace('{mt}', specs.memoryType ?? '');
  if (family.type === 'battery' && specs.capacityMah && generation > 1) {
    name = name.replace(/Akku [\d.]+ mAh/, `Akku ${specs.capacityMah.toLocaleString('de-DE')} mAh`);
  }
  if (family.type === 'battery' && specs.capacityWh && !specs.capacityMah && generation > 1) {
    name = name.replace(/Akku [\d.,]+ Wh/, `Akku ${String(specs.capacityWh).replace('.', ',')} Wh`);
  }
  name = name.replace('{rev}', generation > 1 ? ` G${generation}` : '');
  return name.trim();
}

export function createSku(
  family: ComponentFamilyDef,
  model: ComponentModelDef,
  generation: number,
  releaseDay: number,
  priceLevel: number,
  rng: RngHolder | null,
): ComponentSku {
  const manufacturer = getManufacturer(family.manufacturerId);
  const currency = manufacturer?.currency ?? 'USD';
  const jitterPerf = rng && generation > 1 ? randomRange(rng, 0.97, 1.04) : 1;
  const jitterPrice = rng && generation > 1 ? randomRange(rng, 0.97, 1.05) : 1;
  const curve = generation > 1 ? techCurve(family.type, releaseDay) : 1;
  const specs = specsForGeneration(family, model, generation);
  const priceEur = model.priceEur * priceLevel * (1 + 0.02 * (generation - 1)) * jitterPrice;
  return {
    id: skuId(family.id, model.key, generation),
    type: family.type,
    manufacturerId: family.manufacturerId,
    familyId: family.id,
    name: renderName(family, model, generation, specs),
    formFactor: family.formFactor,
    tier: model.tier,
    generation,
    releaseDay,
    basePrice: Math.round((priceEur / FX_START[currency]) * 100) / 100,
    currency,
    performance: Math.round(model.performance * curve * jitterPerf * 10) / 10,
    quality: Math.min(100, model.quality + (generation - 1)),
    reliability: Math.min(99, model.reliability + Math.floor((generation - 1) / 2)),
    powerDraw: Math.round((model.powerDraw ?? 0) * (generation > 1 ? 0.99 ** (generation - 1) : 1) * 100) / 100,
    volume: family.volume,
    specs,
    features: [...(model.features ?? [])],
    requiredTech: model.requiredTech,
    monthlySupply: family.monthlySupply,
    leadTimeDays: family.leadTimeDays,
  };
}

export function createSkuMarketState(sku: ComponentSku): SkuMarketState {
  return {
    price: sku.basePrice,
    price30dAgo: sku.basePrice,
    scarcity: 1,
    orderedThisMonth: 0,
    status: 'active',
    history: [],
  };
}

/** Erzeugt den Startkatalog (Generation 1 aller Familien) und plant Generationswechsel. */
export function buildInitialCatalog(state: GameState): void {
  for (const family of COMPONENT_FAMILIES) {
    for (const model of family.models) {
      if ((model.fromGeneration ?? 1) > 1) continue;
      const sku = createSku(family, model, 1, 0, 1, null);
      state.components.skus[sku.id] = sku;
      state.components.market[sku.id] = createSkuMarketState(sku);
    }
    if (family.cadenceDays) {
      state.components.nextReleaseDay[family.id] = Math.round(family.cadenceDays * randomRange(state, 0.35, 1));
    }
  }
}

export function getSku(state: GameState, id: string | undefined): ComponentSku | undefined {
  return id ? state.components.skus[id] : undefined;
}

export function currentGeneration(state: GameState, familyId: string): number {
  let generation = 0;
  for (const sku of Object.values(state.components.skus)) {
    if (sku.familyId === familyId && sku.generation > generation) generation = sku.generation;
  }
  return generation;
}

/** Neueste kaufbare SKU eines Modells (für Produktvorlagen). */
export function latestSkuForModel(state: GameState, familyId: string, modelKey: string): ComponentSku | undefined {
  const family = getFamily(familyId);
  if (!family) return undefined;
  let best: ComponentSku | undefined;
  for (let generation = currentGeneration(state, familyId); generation >= 1; generation--) {
    const sku = state.components.skus[skuId(familyId, modelKey, generation)];
    const market = sku ? state.components.market[sku.id] : undefined;
    if (sku && market && market.status === 'active') return sku;
    if (sku && !best) best = sku;
  }
  return best;
}

export function isPurchasable(state: GameState, sku: ComponentSku): boolean {
  if (sku.inhouseProductId) return false;
  const market = state.components.market[sku.id];
  return !!market && market.status !== 'discontinued';
}

/** Aktueller Listenpreis in EUR (vor Rabatten). */
export function skuPriceEur(state: GameState, sku: ComponentSku): number {
  if (sku.inhouseProductId) {
    const stock = state.inventory.products[sku.inhouseProductId];
    const product = state.products.find((p) => p.id === sku.inhouseProductId);
    return stock && stock.qty > 0 ? stock.avgCost : (product?.estimatedUnitCost ?? 0);
  }
  const market = state.components.market[sku.id];
  const price = market ? market.price : sku.basePrice;
  return price * state.economy.exchangeRates[sku.currency];
}

export function skuTrend(state: GameState, sku: ComponentSku): number {
  const market = state.components.market[sku.id];
  if (!market || market.price30dAgo <= 0) return 0;
  return market.price / market.price30dAgo - 1;
}
