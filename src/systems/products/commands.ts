import { CATEGORIES } from '@/data/categories';
import { DIFFICULTIES } from '@/data/difficulties';
import { PLAYER_MANUFACTURER_ID } from '@/data/manufacturers';
import { PRODUCT_TEMPLATES } from '@/data/templates';
import { CommandError, ensure, nextId } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import type { ComponentSku, DevBudgetLevel, GameState, Priority, Product, ProductCategoryId, ProductSalesStats, SlotKey } from '@/types';
import { latestSkuForModel } from '@/systems/components/catalog';
import { isCategoryUnlocked, techEffects } from '@/systems/research/effects';
import { departmentCapacity } from '@/systems/workforce/employees';
import { DEV_BUDGET_LEVELS, estimateDevQuality, evaluateDesign } from './design';

export function emptySalesStats(): ProductSalesStats {
  return {
    unitsSold: 0,
    revenue: 0,
    grossProfit: 0,
    unitsLast30: 0,
    revenueLast30: 0,
    daily: [],
    dailyRevenue: [],
    backorders: 0,
    lostSales: 0,
    cancellations: 0,
    installedBase: 0,
    demandToday: 0,
    segmentUnits: {},
    unitsThisMonth: 0,
    bestMonthUnits: 0,
    warrantyPool: 0,
  };
}

export function findProduct(state: GameState, productId: string): Product {
  const product = state.products.find((p) => p.id === productId);
  if (!product) throw new CommandError('Produkt nicht gefunden.');
  return product;
}

/** Löst eine Produktvorlage auf die aktuell verfügbaren Komponenten auf. */
export function resolveTemplateComponents(state: GameState, templateId: string): Partial<Record<SlotKey, string>> {
  const template = PRODUCT_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return {};
  const components: Partial<Record<SlotKey, string>> = {};
  for (const [slot, ref] of Object.entries(template.components) as [SlotKey, string][]) {
    const [familyId, modelKey] = ref.split('.');
    const sku = latestSkuForModel(state, familyId, modelKey);
    if (sku) components[slot] = sku.id;
  }
  return components;
}

export interface ProductDraftInput {
  name: string;
  category: ProductCategoryId;
  components: Partial<Record<SlotKey, string>>;
  price: number;
  devBudgetLevel: DevBudgetLevel;
  templateId?: string;
  predecessorId?: string;
}

function validateDraft(state: GameState, input: ProductDraftInput, ignoreId?: string): void {
  const name = input.name.trim();
  ensure(name.length >= 2, 'Bitte einen Produktnamen mit mindestens 2 Zeichen angeben.');
  ensure(name.length <= 40, 'Der Produktname ist zu lang (max. 40 Zeichen).');
  ensure(
    !state.products.some((p) => p.id !== ignoreId && p.name.toLowerCase() === name.toLowerCase() && p.status !== 'discontinued'),
    'Ein aktives Produkt mit diesem Namen existiert bereits.',
  );
  ensure(isCategoryUnlocked(state, input.category), `${CATEGORIES[input.category].pluralName} müssen zuerst erforscht werden.`);
  ensure(Number.isFinite(input.price) && input.price > 0, 'Bitte einen gültigen Verkaufspreis angeben.');
  const evaluation = evaluateDesign(state, input.category, input.components, estimateDevQuality(state, input.devBudgetLevel));
  if (!evaluation.valid) throw new CommandError(evaluation.errors[0].message);
}

export function createProductDraft(state: GameState, input: ProductDraftInput): string {
  validateDraft(state, input);
  const devQuality = estimateDevQuality(state, input.devBudgetLevel);
  const evaluation = evaluateDesign(state, input.category, input.components, devQuality);
  const predecessor = input.predecessorId ? state.products.find((p) => p.id === input.predecessorId) : undefined;
  const product: Product = {
    id: nextId(state, 'prod'),
    name: input.name.trim(),
    category: input.category,
    components: { ...input.components },
    price: Math.round(input.price * 100) / 100,
    devBudgetLevel: input.devBudgetLevel,
    status: 'draft',
    createdDay: state.time.day,
    development: null,
    devQuality,
    attributes: evaluation.attributes,
    attributesDay: state.time.day,
    specs: evaluation.specs,
    estimatedUnitCost: evaluation.unitCost,
    customerRating: 0,
    sales: emptySalesStats(),
    quality: {
      defectRate: evaluation.defectRate,
      escapedRate: 0,
      producedUnits: 0,
      fieldDefects: 0,
      recallStatus: 'none',
      defectLabel: evaluation.defectLabel,
    },
    buzz: 0,
    version: predecessor ? predecessor.version + 1 : 1,
    predecessorId: predecessor?.id,
    templateId: input.templateId,
    priceHistory: [],
  };
  state.products.push(product);
  return product.id;
}

export function updateProductDraft(state: GameState, productId: string, input: ProductDraftInput): string {
  const product = findProduct(state, productId);
  ensure(product.status === 'draft', 'Nur Entwürfe können bearbeitet werden.');
  validateDraft(state, input, productId);
  const devQuality = estimateDevQuality(state, input.devBudgetLevel);
  const evaluation = evaluateDesign(state, input.category, input.components, devQuality);
  product.name = input.name.trim();
  product.category = input.category;
  product.components = { ...input.components };
  product.price = Math.round(input.price * 100) / 100;
  product.devBudgetLevel = input.devBudgetLevel;
  product.devQuality = devQuality;
  product.attributes = evaluation.attributes;
  product.attributesDay = state.time.day;
  product.specs = evaluation.specs;
  product.estimatedUnitCost = evaluation.unitCost;
  product.quality.defectRate = evaluation.defectRate;
  product.quality.defectLabel = evaluation.defectLabel;
  return `Entwurf „${product.name}“ gespeichert.`;
}

export function deleteProductDraft(state: GameState, productId: string): string {
  const product = findProduct(state, productId);
  ensure(product.status === 'draft', 'Nur Entwürfe können gelöscht werden.');
  state.products = state.products.filter((p) => p.id !== productId);
  return `Entwurf „${product.name}“ gelöscht.`;
}

export function setProductPrice(state: GameState, productId: string, price: number): string {
  const product = findProduct(state, productId);
  ensure(Number.isFinite(price) && price > 0, 'Ungültiger Preis.');
  ensure(price < 1_000_000, 'Der Preis ist unrealistisch hoch.');
  ensure(product.status !== 'discontinued', 'Das Produkt ist nicht mehr im Verkauf.');
  const old = product.price;
  product.price = Math.round(price * 100) / 100;
  if (product.status === 'on_sale') {
    product.priceHistory.push({ day: state.time.day, price: product.price });
    if (product.priceHistory.length > 60) product.priceHistory.splice(0, product.priceHistory.length - 60);
  }
  const change = old > 0 ? product.price / old - 1 : 0;
  return `Preis von ${product.name} ${change >= 0 ? 'erhöht' : 'gesenkt'} auf ${product.price.toLocaleString('de-DE')} €.`;
}

export function renameProduct(state: GameState, productId: string, name: string): string {
  const product = findProduct(state, productId);
  const trimmed = name.trim();
  ensure(trimmed.length >= 2 && trimmed.length <= 40, 'Der Name muss 2–40 Zeichen lang sein.');
  ensure(product.status === 'draft' || product.status === 'development', 'Nach dem Entwicklungsabschluss kann der Name nicht mehr geändert werden.');
  product.name = trimmed;
  return 'Produkt umbenannt.';
}

export function launchProduct(state: GameState, productId: string): string {
  const product = findProduct(state, productId);
  ensure(product.status === 'ready', 'Nur fertig entwickelte Produkte können auf den Markt gebracht werden.');
  product.status = 'on_sale';
  product.launchDay = state.time.day;
  product.buzz = Math.max(product.buzz, 0.35);
  product.priceHistory.push({ day: state.time.day, price: product.price });
  state.stats.productsLaunched += 1;
  addNews(state, 'company', 'positive', `${state.company.name} veröffentlicht ${product.name}`, `Neuer ${CATEGORIES[product.category].name} für ${product.price.toLocaleString('de-DE')} €.`);
  return `${product.name} ist jetzt im Handel erhältlich. Erste Testberichte folgen in etwa zwei Wochen.`;
}

export function discontinueProduct(state: GameState, productId: string): string {
  const product = findProduct(state, productId);
  ensure(product.status === 'on_sale' || product.status === 'ready', 'Das Produkt ist nicht im Verkauf.');
  product.status = 'discontinued';
  product.discontinuedDay = state.time.day;
  for (const line of state.production.lines) {
    if (line.productId === productId) {
      line.productId = null;
      line.active = false;
      line.status = 'idle';
    }
  }
  if (product.inhouseSkuId) {
    const market = state.components.market[product.inhouseSkuId];
    if (market) market.status = 'discontinued';
  }
  return `${product.name} wurde eingestellt. Restbestände werden nicht mehr verkauft.`;
}

export function startDevelopment(state: GameState, productId: string, priority: Priority = 'normal'): string {
  const product = findProduct(state, productId);
  ensure(product.status === 'draft', 'Die Entwicklung läuft bereits oder ist abgeschlossen.');
  const check = developmentRequirementError(state, product.category);
  if (check) throw new CommandError(check);
  const evaluation = evaluateDesign(state, product.category, product.components, product.devQuality);
  if (!evaluation.valid) throw new CommandError(evaluation.errors[0].message);
  const plan = developmentPlan(state, product);
  const firstPhaseCost = plan.totalBudget * 0.03;
  ensure(state.finance.cash >= firstPhaseCost, `Nicht genügend Kapital. Für den Start werden ${Math.round(firstPhaseCost).toLocaleString('de-DE')} € benötigt.`);
  product.status = 'development';
  product.development = {
    phaseIndex: 0,
    phaseProgress: 0,
    phaseStartedDay: state.time.day,
    phasePaid: false,
    totalEffort: plan.totalEffort,
    totalBudget: plan.totalBudget,
    spent: 0,
    startedDay: state.time.day,
    priority,
  };
  return `Entwicklung von ${product.name} gestartet (Budget ${Math.round(plan.totalBudget).toLocaleString('de-DE')} €).`;
}

export function cancelDevelopment(state: GameState, productId: string): string {
  const product = findProduct(state, productId);
  ensure(product.status === 'development' && product.development, 'Keine laufende Entwicklung.');
  const spent = product.development.spent;
  product.status = 'draft';
  product.development = null;
  return `Entwicklung abgebrochen. Bereits ausgegebene ${Math.round(spent).toLocaleString('de-DE')} € sind verloren.`;
}

export function setDevelopmentPriority(state: GameState, productId: string, priority: Priority): string {
  const product = findProduct(state, productId);
  ensure(product.development, 'Keine laufende Entwicklung.');
  product.development.priority = priority;
  return 'Priorität geändert.';
}

/** Legt eine überarbeitete Version eines Produkts an (aktuelle Komponenten, 45 % Entwicklungsaufwand). */
export function createSuccessor(state: GameState, productId: string): string {
  const product = findProduct(state, productId);
  ensure(product.status !== 'draft' && product.status !== 'development', 'Nur fertige Produkte können überarbeitet werden.');
  const components: Partial<Record<SlotKey, string>> = {};
  for (const [slot, skuIdValue] of Object.entries(product.components) as [SlotKey, string][]) {
    const sku = state.components.skus[skuIdValue];
    if (!sku) continue;
    if (sku.inhouseProductId) {
      components[slot] = sku.id;
      continue;
    }
    const modelKey = sku.id.split('.').slice(-2, -1)[0];
    components[slot] = latestSkuForModel(state, sku.familyId, modelKey)?.id ?? sku.id;
  }
  const baseName = product.name.replace(/\s\(\d{4}\)$/, '');
  const year = 2026 + Math.floor(state.time.day / 365);
  let name = `${baseName} (${year})`;
  let counter = 2;
  while (state.products.some((p) => p.name === name)) name = `${baseName} (${year}) ${counter++}`;
  return createProductDraft(state, {
    name,
    category: product.category,
    components,
    price: product.price,
    devBudgetLevel: product.devBudgetLevel,
    predecessorId: product.id,
    templateId: product.templateId,
  });
}

export function developmentPlan(state: GameState, product: Pick<Product, 'category' | 'devBudgetLevel' | 'predecessorId'>): { totalEffort: number; totalBudget: number } {
  return computeDevelopmentPlan(state, product.category, product.devBudgetLevel, !!product.predecessorId);
}

export function computeDevelopmentPlan(state: GameState, categoryId: ProductCategoryId, level: DevBudgetLevel, iteration: boolean): { totalEffort: number; totalBudget: number } {
  const category = CATEGORIES[categoryId];
  const difficulty = DIFFICULTIES[state.difficulty].developmentCost;
  const effects = techEffects(state);
  const iterationFactor = iteration ? 0.45 : 1;
  const totalEffort = category.devEffort * difficulty * iterationFactor;
  const totalBudget =
    (category.devBudget * DEV_BUDGET_LEVELS[level].factor * iterationFactor + category.toolingCost * (iteration ? 0.3 : 1) + category.certificationCost) *
    difficulty *
    Math.max(0.5, 1 + effects.devCost) *
    state.economy.priceLevel;
  return { totalEffort, totalBudget };
}

const REQUIREMENT_LABELS = {
  engineering: 'Ingenieur:innen (Engineering)',
  hardware: 'Hardware-Entwickler:innen',
  software: 'Software-Entwickler:innen',
} as const;

/** Prüft die Mindestbesetzung für eine Entwicklung. Liefert eine Fehlermeldung oder null. */
export function developmentRequirementError(state: GameState, categoryId: ProductCategoryId): string | null {
  const category = CATEGORIES[categoryId];
  for (const [dept, min] of Object.entries(category.devRequirements) as ['engineering' | 'hardware' | 'software', number][]) {
    const headcount = state.workforce.stats[dept].headcount;
    const effective = headcount > 0 ? headcount : departmentCapacity(state, dept) > 0 || (dept === 'engineering' && state.company.stage <= 2) ? 0.5 : 0;
    if (min <= 1 && effective > 0) continue;
    if (headcount < min) {
      return `Für diese Entwicklung werden mindestens ${min} ${REQUIREMENT_LABELS[dept]} benötigt (aktuell ${headcount}).`;
    }
  }
  return null;
}

/** Registriert ein fertiges Eigenbauteil (Grafikkarte, CPU, Mainboard) als verbaubare Komponente. */
export function registerInhouseComponent(state: GameState, product: Product): void {
  const mapping: Partial<Record<ProductCategoryId, { type: ComponentSku['type']; volume: number }>> = {
    graphics_card: { type: 'gpu', volume: 0.4 },
    processor: { type: 'cpu', volume: 0.05 },
    mainboard: { type: 'mainboard', volume: 0.25 },
  };
  const info = mapping[product.category];
  if (!info) return;
  const id = `inhouse.${product.id}`;
  const sku: ComponentSku = {
    id,
    type: info.type,
    manufacturerId: PLAYER_MANUFACTURER_ID,
    familyId: `inhouse-${product.id}`,
    name: product.name,
    formFactor: 'desktop',
    tier: product.attributes.performance >= 85 ? 'enthusiast' : product.attributes.performance >= 65 ? 'performance' : product.attributes.performance >= 45 ? 'mainstream' : 'budget',
    generation: product.version,
    releaseDay: state.time.day,
    basePrice: product.estimatedUnitCost,
    currency: 'EUR',
    performance: product.specs.perfIndex,
    quality: Math.round(product.attributes.quality),
    reliability: Math.round(Math.min(99, 100 - product.quality.defectRate * 400)),
    powerDraw: product.specs.heat,
    volume: info.volume,
    specs: {},
    features: [...product.specs.features],
    monthlySupply: 0,
    leadTimeDays: 0,
    inhouseProductId: product.id,
  };
  state.components.skus[id] = sku;
  state.components.market[id] = { price: sku.basePrice, price30dAgo: sku.basePrice, scarcity: 1, orderedThisMonth: 0, status: 'active', history: [] };
  product.inhouseSkuId = id;
}

export function templateById(templateId: string) {
  return PRODUCT_TEMPLATES.find((t) => t.id === templateId);
}
