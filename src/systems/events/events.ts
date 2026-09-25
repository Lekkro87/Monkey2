import { CATEGORIES, CATEGORY_IDS } from '@/data/categories';
import { DIFFICULTIES } from '@/data/difficulties';
import { SEMICONDUCTOR_TYPES } from '@/systems/components/classification';
import { CommandError, nextId } from '@/simulation/commands';
import { addModifier } from '@/simulation/modifiers';
import { addNews } from '@/simulation/news';
import { chance, pick, randomInt, randomRange, weightedPick } from '@/simulation/rng';
import type { GameState, PendingDecision, Product, ProductCategoryId } from '@/types';
import { clamp } from '@/utils/math';
import { delayOrders } from '@/systems/supply/purchasing';
import { launchCompetitorProduct } from '@/systems/competitors/ai';
import { getManufacturerName } from '@/services/brandLicense';
import { addTransaction } from '@/systems/finance/ledger';
import { adjustSentiment } from '@/systems/finance/stock';
import { SEGMENT_IDS } from '@/data/segments';

interface EventDef {
  id: string;
  weight: (state: GameState) => number;
  cooldownDays: number;
  apply: (state: GameState) => void;
}

function playerCategories(state: GameState): ProductCategoryId[] {
  return [...new Set(state.products.filter((p) => p.status === 'on_sale').map((p) => p.category))];
}

function usedManufacturers(state: GameState): string[] {
  const set = new Set<string>();
  for (const product of state.products) {
    if (product.status !== 'on_sale' && product.status !== 'ready' && product.status !== 'development') continue;
    for (const skuId of Object.values(product.components)) {
      const sku = skuId ? state.components.skus[skuId] : undefined;
      if (sku && !sku.inhouseProductId) set.add(sku.manufacturerId);
    }
  }
  return [...set];
}

const EVENTS: EventDef[] = [
  {
    id: 'chip_shortage',
    cooldownDays: 540,
    weight: () => 1,
    apply: (state) => {
      const days = randomInt(state, 90, 160);
      const endDay = state.time.day + days;
      addModifier(state, { source: 'chip_shortage', label: 'Globaler Chipmangel', target: 'componentPrice', filter: { componentTypes: SEMICONDUCTOR_TYPES }, value: 1.25, mode: 'mul', endDay });
      addModifier(state, { source: 'chip_shortage', label: 'Globaler Chipmangel', target: 'componentSupply', filter: { componentTypes: SEMICONDUCTOR_TYPES }, value: 0.65, mode: 'mul', endDay });
      addModifier(state, { source: 'chip_shortage', label: 'Globaler Chipmangel', target: 'leadTime', filter: { componentTypes: SEMICONDUCTOR_TYPES }, value: 1.5, mode: 'mul', endDay });
      addNews(state, 'event', 'negative', 'Globaler Chipmangel', `Halbleiter werden knapp: Preise für CPUs, GPUs und Speicher steigen um rund 25 %, Lieferzeiten verlängern sich. Dauer: etwa ${Math.round(days / 30)} Monate.`);
    },
  },
  {
    id: 'raw_materials',
    cooldownDays: 400,
    weight: () => 1,
    apply: (state) => {
      const days = randomInt(state, 120, 220);
      addModifier(state, { source: 'raw_materials', label: 'Rohstoffpreise steigen', target: 'rawMaterials', value: randomRange(state, 1.15, 1.3), mode: 'mul', endDay: state.time.day + days });
      addNews(state, 'event', 'negative', 'Rohstoffpreise steigen', 'Aluminium, Kupfer und Lithium verteuern sich deutlich – Gehäuse, Akkus und Kühler werden teurer.');
    },
  },
  {
    id: 'energy_crisis',
    cooldownDays: 700,
    weight: (s) => (s.production.factories.length > 0 ? 1.2 : 0.4),
    apply: (state) => {
      const days = randomInt(state, 120, 260);
      addModifier(state, { source: 'energy_crisis', label: 'Energiekrise', target: 'energyPrice', value: randomRange(state, 1.5, 1.9), mode: 'mul', endDay: state.time.day + days });
      addModifier(state, { source: 'energy_crisis', label: 'Energiekrise', target: 'demand', value: 0.95, mode: 'mul', endDay: state.time.day + days });
      addNews(state, 'event', 'negative', 'Energiekrise', 'Strompreise explodieren. Fabriken mit hohem Energiebedarf geraten unter Druck, die Konsumlaune sinkt leicht.');
    },
  },
  {
    id: 'supplier_outage',
    cooldownDays: 150,
    weight: (s) => (usedManufacturers(s).length > 0 ? 1.4 : 0.3),
    apply: (state) => {
      const used = usedManufacturers(state);
      const manufacturerId = used.length > 0 ? pick(state, used) : pick(state, ['novasilicon', 'titan_graphics', 'memorycore', 'lumina']);
      const days = randomInt(state, 30, 70);
      const endDay = state.time.day + days;
      addModifier(state, { source: 'supplier_outage', label: `Ausfall bei ${getManufacturerName(manufacturerId)}`, target: 'componentSupply', filter: { manufacturerId }, value: 0.2, mode: 'mul', endDay });
      addModifier(state, { source: 'supplier_outage', label: `Ausfall bei ${getManufacturerName(manufacturerId)}`, target: 'leadTime', filter: { manufacturerId }, value: 2, mode: 'mul', endDay });
      addModifier(state, { source: 'supplier_outage', label: `Ausfall bei ${getManufacturerName(manufacturerId)}`, target: 'componentPrice', filter: { manufacturerId }, value: 1.12, mode: 'mul', endDay });
      const delayDays = randomInt(state, 10, 25);
      const affected = delayOrders(state, (o) => state.components.skus[o.skuId]?.manufacturerId === manufacturerId, delayDays, `Produktionsausfall bei ${getManufacturerName(manufacturerId)}`);
      addNews(
        state,
        'event',
        'negative',
        `Zulieferer-Ausfall bei ${getManufacturerName(manufacturerId)}`,
        `Ein Werksausfall legt die Produktion lahm. ${affected > 0 ? `${affected} deiner Lieferungen verzögern sich um ${delayDays} Tage. ` : ''}Neue Bestellungen sind knapp und teurer.`,
      );
    },
  },
  {
    id: 'port_strike',
    cooldownDays: 300,
    weight: () => 0.8,
    apply: (state) => {
      const days = randomInt(state, 20, 45);
      addModifier(state, { source: 'port_strike', label: 'Hafenstreik', target: 'shippingDelay', filter: { shippingModes: ['ship'] }, value: 12, mode: 'add', endDay: state.time.day + days });
      const affected = delayOrders(state, (o) => o.mode === 'ship', 12, 'Hafenstreik');
      addNews(state, 'event', 'negative', 'Streik in den großen Häfen', `Seefracht verzögert sich um rund 12 Tage${affected > 0 ? ` (${affected} deiner Lieferungen betroffen)` : ''}. Luftfracht ist nicht betroffen.`);
    },
  },
  {
    id: 'currency_shock',
    cooldownDays: 365,
    weight: () => 0.8,
    apply: (state) => {
      const currency = pick(state, ['USD', 'CNY', 'JPY'] as const);
      const change = randomRange(state, 0.07, 0.13) * (chance(state, 0.6) ? 1 : -1);
      state.economy.exchangeRates[currency] *= 1 + change;
      const label = currency === 'USD' ? 'US-Dollar' : currency === 'CNY' ? 'Yuan' : 'Yen';
      addNews(
        state,
        'economy',
        change > 0 ? 'negative' : 'positive',
        `Währungsschock: ${label} ${change > 0 ? 'steigt' : 'fällt'} um ${Math.round(Math.abs(change) * 100)} %`,
        change > 0 ? `Komponenten in ${label} werden für europäische Käufer teurer.` : `Komponenten in ${label} werden günstiger.`,
      );
    },
  },
  {
    id: 'gaming_boom',
    cooldownDays: 500,
    weight: () => 0.9,
    apply: (state) => {
      addModifier(state, { source: 'gaming_boom', label: 'Gaming-Boom', target: 'segmentDemand', filter: { segments: ['gamer', 'enthusiast'] }, value: 1.25, mode: 'mul', endDay: state.time.day + randomInt(state, 120, 200) });
      addNews(state, 'event', 'positive', 'Gaming-Boom', 'Ein Blockbuster-Spiel und neue E-Sport-Ligen lassen die Nachfrage von Gamern um 25 % steigen.');
    },
  },
  {
    id: 'crypto_boom',
    cooldownDays: 700,
    weight: () => 0.6,
    apply: (state) => {
      const endDay = state.time.day + randomInt(state, 80, 140);
      addModifier(state, { source: 'crypto_boom', label: 'Krypto-Boom', target: 'componentPrice', filter: { componentTypes: ['gpu', 'gpu_chip', 'vram'] }, value: 1.35, mode: 'mul', endDay });
      addModifier(state, { source: 'crypto_boom', label: 'Krypto-Boom', target: 'demand', filter: { categories: ['graphics_card'] }, value: 1.45, mode: 'mul', endDay });
      addNews(state, 'event', 'neutral', 'Krypto-Boom treibt GPU-Preise', 'Grafikchips werden um 35 % teurer – Grafikkarten sind gefragt wie nie, Gaming-PCs verlieren an Marge.');
    },
  },
  {
    id: 'recession',
    cooldownDays: 1_000,
    weight: (s) => (s.time.day > 365 ? 0.6 : 0),
    apply: (state) => {
      const days = randomInt(state, 180, 320);
      addModifier(state, { source: 'recession', label: 'Konjunkturabschwung', target: 'demand', value: 0.87, mode: 'mul', endDay: state.time.day + days });
      addModifier(state, { source: 'recession', label: 'Konjunkturabschwung', target: 'interestRate', value: -0.012, mode: 'add', endDay: state.time.day + days });
      addNews(state, 'economy', 'negative', 'Konjunkturabschwung', 'Verbraucher halten sich zurück: Die Nachfrage sinkt um rund 13 %. Die Notenbank senkt die Zinsen.');
    },
  },
  {
    id: 'boom',
    cooldownDays: 900,
    weight: (s) => (s.time.day > 200 ? 0.6 : 0),
    apply: (state) => {
      addModifier(state, { source: 'boom', label: 'Konjunkturboom', target: 'demand', value: 1.1, mode: 'mul', endDay: state.time.day + randomInt(state, 150, 260) });
      addNews(state, 'economy', 'positive', 'Konjunkturboom', 'Hohe Beschäftigung und Konsumlaune: Die Nachfrage nach Elektronik steigt um rund 10 %.');
    },
  },
  {
    id: 'new_display_tech',
    cooldownDays: 700,
    weight: () => 0.6,
    apply: (state) => {
      addModifier(state, { source: 'new_display_tech', label: 'Neue Display-Technologie', target: 'demand', filter: { categories: ['smartphone', 'tablet', 'monitor', 'laptop'] }, value: 1.08, mode: 'mul', endDay: state.time.day + 180 });
      addNews(state, 'market', 'positive', 'Neue Display-Technologie begeistert', 'Hellere OLED-Panels sorgen für Kaufinteresse bei Smartphones, Tablets, Laptops und Monitoren (+8 % Nachfrage).');
    },
  },
  {
    id: 'viral_review',
    cooldownDays: 200,
    weight: (s) => (s.products.some((p) => p.status === 'on_sale' && (p.review?.overall ?? 0) >= 7.3) ? 1.3 : 0),
    apply: (state) => {
      const candidates = state.products.filter((p) => p.status === 'on_sale' && (p.review?.overall ?? 0) >= 7.3);
      if (candidates.length === 0) return;
      const product = pick(state, candidates);
      product.buzz = Math.min(1, product.buzz + 0.5);
      const segments = CATEGORIES[product.category].segmentMix;
      const region = state.company.homeRegion;
      for (const segment of SEGMENT_IDS) {
        if (segments[segment] <= 0) continue;
        state.brand.awareness[region][segment] = clamp(state.brand.awareness[region][segment] + 0.04, 0, 0.98);
      }
      adjustSentiment(state, 0.04);
      addNews(state, 'event', 'positive', `Viraler Produkttest: ${product.name}`, 'Ein Video mit Millionen Aufrufen feiert das Produkt – Bekanntheit und Nachfrage steigen sprunghaft.');
    },
  },
  {
    id: 'design_award',
    cooldownDays: 365,
    weight: (s) => (s.products.some((p) => p.status === 'on_sale' && p.attributes.design >= 78) ? 0.7 : 0),
    apply: (state) => {
      const candidates = state.products.filter((p) => p.status === 'on_sale' && p.attributes.design >= 78);
      if (candidates.length === 0) return;
      const product = pick(state, candidates);
      product.buzz = Math.min(1, product.buzz + 0.25);
      state.brand.premium = clamp(state.brand.premium + 4, 0, 100);
      addNews(state, 'event', 'positive', `${product.name} gewinnt Designpreis`, 'Die Jury lobt Materialwahl und Verarbeitung. Das Premium-Image der Marke steigt.');
    },
  },
  {
    id: 'new_competition',
    cooldownDays: 180,
    weight: (s) => (playerCategories(s).length > 0 ? 1.1 : 0.3),
    apply: (state) => {
      const categories = playerCategories(state);
      const categoryId = categories.length > 0 ? pick(state, categories) : 'smartphone';
      const candidates = state.competitors.filter((c) => (c.focus[categoryId] ?? 0) >= 0.3);
      const competitor = candidates.length > 0 ? pick(state, candidates) : pick(state, state.competitors);
      const reference = CATEGORIES[categoryId].referencePrice * state.economy.priceLevel;
      const product = launchCompetitorProduct(state, competitor, categoryId, 'budget', { priceOverride: reference * randomRange(state, 0.45, 0.55) });
      competitor.focus[categoryId] = Math.max(competitor.focus[categoryId] ?? 0, 0.4);
      addNews(state, 'competitor', 'negative', `Neue Konkurrenz: ${competitor.name} bringt günstiges Modell`, `${product.name} kostet nur ${Math.round(product.price).toLocaleString('de-DE')} € und setzt ${CATEGORIES[categoryId].pluralName} unter Preisdruck.`);
    },
  },
  {
    id: 'factory_fire',
    cooldownDays: 500,
    weight: (s) => (s.production.factories.some((f) => f.status === 'operational') ? 0.7 : 0),
    apply: (state) => {
      const factories = state.production.factories.filter((f) => f.status === 'operational');
      if (factories.length === 0) return;
      const factory = pick(state, factories);
      const days = randomInt(state, 25, 60);
      factory.disruptedUntil = state.time.day + days;
      factory.disruptionFactor = randomRange(state, 0.15, 0.4);
      const repair = factory.bookValue * randomRange(state, 0.03, 0.07);
      addTransaction(state, 'maintenance', -repair);
      adjustSentiment(state, -0.05);
      addNews(state, 'event', 'negative', `Fabrikbrand in ${factory.name}`, `Die Produktion läuft ${days} Tage nur eingeschränkt. Reparaturkosten: ${Math.round(repair).toLocaleString('de-DE')} €.`);
    },
  },
  {
    id: 'workshop_short_circuit',
    cooldownDays: 400,
    weight: (s) => (s.production.factories.length === 0 && s.production.workshop.toolLevel > 0 ? 0.5 : 0),
    apply: (state) => {
      const days = randomInt(state, 4, 9);
      addModifier(state, { source: 'workshop_short_circuit', label: 'Kurzschluss in der Werkstatt', target: 'factoryCapacity', filter: { factoryId: 'workshop' }, value: 0, mode: 'mul', endDay: state.time.day + days });
      addTransaction(state, 'maintenance', -1_500 * state.economy.priceLevel);
      addNews(state, 'event', 'negative', 'Kurzschluss in der Werkstatt', `Die Werkstatt steht ${days} Tage still. Reparatur: ${Math.round(1_500 * state.economy.priceLevel).toLocaleString('de-DE')} €.`);
    },
  },
  {
    id: 'talent_poaching',
    cooldownDays: 180,
    weight: (s) => (s.workforce.employees.some((e) => !e.isFounder && (e.level === 'senior' || e.level === 'lead' || e.level === 'director')) ? 0.9 : 0),
    apply: (state) => {
      const candidates = state.workforce.employees.filter((e) => !e.isFounder && (e.level === 'senior' || e.level === 'lead' || e.level === 'director'));
      if (candidates.length === 0) return;
      const victim = weightedPick(state, candidates, (e) => (e.motivation < 60 ? 3 : 1)) ?? candidates[0];
      if (victim.motivation > 80) {
        addNews(state, 'company', 'positive', 'Abwerbeversuch gescheitert', `${victim.firstName} ${victim.lastName} lehnt ein Angebot der Konkurrenz ab – die Motivation im Team stimmt.`);
        return;
      }
      const competitor = pick(state, state.competitors);
      state.workforce.employees = state.workforce.employees.filter((e) => e.id !== victim.id);
      state.workforce.statsDirty = true;
      state.workforce.quitsTotal += 1;
      addNews(state, 'company', 'negative', `${competitor.name} wirbt ${victim.firstName} ${victim.lastName} ab`, 'Gute Leute sind begehrt – faire Gehälter und hohe Motivation schützen vor Abwerbung.');
    },
  },
  {
    id: 'market_trend',
    cooldownDays: 120,
    weight: () => 1,
    apply: (state) => {
      const categoryId = pick(state, CATEGORY_IDS);
      const up = chance(state, 0.6);
      const market = state.markets[categoryId];
      market.growth += up ? randomRange(state, 0.06, 0.12) : -randomRange(state, 0.04, 0.09);
      const name = CATEGORIES[categoryId].pluralName;
      addNews(state, 'market', up ? 'positive' : 'negative', up ? `Nachfrage nach ${name} steigt` : `Nachfrage nach ${name} schwächelt`, up ? 'Analysten erwarten ein kräftiges Wachstum in diesem Segment.' : 'Der Markt kühlt ab – Analysten senken ihre Prognosen.');
    },
  },
  {
    id: 'tax_reform',
    cooldownDays: 1_200,
    weight: (s) => (s.time.day > 500 ? 0.4 : 0),
    apply: (state) => {
      const delta = pick(state, [-0.03, -0.02, 0.02, 0.03]);
      state.economy.taxRate = clamp(state.economy.taxRate + delta, 0.12, 0.4);
      addNews(state, 'economy', delta < 0 ? 'positive' : 'negative', delta < 0 ? 'Steuerreform senkt Unternehmenssteuer' : 'Unternehmenssteuer steigt', `Neuer Steuersatz: ${Math.round(state.economy.taxRate * 100)} %.`);
    },
  },
  {
    id: 'inflation_spike',
    cooldownDays: 800,
    weight: () => 0.5,
    apply: (state) => {
      state.economy.inflationRate = clamp(state.economy.inflationRate + randomRange(state, 0.02, 0.04), -0.01, 0.12);
      addModifier(state, { source: 'inflation_spike', label: 'Lohndruck', target: 'wages', value: 1.03, mode: 'mul', endDay: state.time.day + 365 });
      addNews(state, 'economy', 'negative', 'Inflationsschub', 'Die Teuerung zieht an. Gewerkschaften fordern höhere Löhne, die Notenbank dürfte die Zinsen erhöhen.');
    },
  },
];

const RECALL_THRESHOLD = 0.016;

function recallOptions(state: GameState, product: Product, affected: number): PendingDecision['options'] {
  const priceLevel = state.economy.priceLevel;
  const unitCost = state.inventory.products[product.id]?.avgCost ?? product.estimatedUnitCost;
  return [
    { id: 'ignore', label: 'Problem ignorieren', description: 'Keine direkten Kosten, aber Vertrauen, Bewertungen und Aktienkurs leiden deutlich.', cost: 0 },
    {
      id: 'repair_program',
      label: 'Reparaturprogramm',
      description: 'Betroffene Geräte werden auf Anfrage kostenlos repariert. Moderater Imageschaden.',
      cost: Math.round(affected * 0.55 * (product.price * 0.08 + 20 * priceLevel)),
    },
    {
      id: 'recall',
      label: 'Rückruf',
      description: 'Alle betroffenen Geräte werden zurückgerufen, 14 Tage Verkaufsstopp. Ursache wird behoben.',
      cost: Math.round(affected * 0.75 * (product.price * 0.12 + 30 * priceLevel)),
    },
    {
      id: 'replacement',
      label: 'Kostenlose Ersatzgeräte',
      description: 'Jeder Betroffene erhält ein neues Gerät. Teuer, stärkt aber das Vertrauen.',
      cost: Math.round(affected * 0.7 * unitCost * 1.1),
    },
  ];
}

function checkRecalls(state: GameState): void {
  for (const product of state.products) {
    if (product.quality.recallStatus !== 'none' || product.sales.unitsSold < 50) continue;
    if (product.quality.escapedRate < RECALL_THRESHOLD || product.quality.fieldDefects < 15) continue;
    if (!chance(state, 0.3)) continue;
    const affectedRate = product.quality.escapedRate * 1.5;
    const affected = Math.max(1, Math.round(product.sales.installedBase * affectedRate));
    product.quality.recallStatus = 'pending_decision';
    const percent = (affectedRate * 100).toFixed(1).replace('.', ',');
    state.events.decisions.push({
      id: nextId(state, 'dec'),
      kind: 'recall',
      title: `Serienfehler bei ${product.name}`,
      description: `${percent} % der Geräte haben einen ${product.quality.defectLabel ?? 'Hardwarefehler'}. Rund ${affected.toLocaleString('de-DE')} Kundinnen und Kunden sind betroffen. Wie reagierst du?`,
      createdDay: state.time.day,
      deadlineDay: state.time.day + 14,
      productId: product.id,
      affectedUnits: affected,
      options: recallOptions(state, product, affected),
      defaultOptionId: 'ignore',
    });
    addNews(state, 'company', 'negative', `Serienfehler bei ${product.name} entdeckt`, `${percent} % der Geräte betroffen (${product.quality.defectLabel ?? 'Hardwarefehler'}).`);
  }
}

export function resolveDecision(state: GameState, decisionId: string, optionId: string): string {
  const decision = state.events.decisions.find((d) => d.id === decisionId);
  if (!decision) throw new CommandError('Entscheidung nicht gefunden.');
  const option = decision.options.find((o) => o.id === optionId);
  if (!option) throw new CommandError('Ungültige Option.');
  const product = state.products.find((p) => p.id === decision.productId);
  if (option.cost > 0) addTransaction(state, 'warranty', -option.cost);
  const brand = state.brand;
  if (product) {
    switch (optionId) {
      case 'ignore':
        product.quality.recallStatus = 'ignored';
        brand.trust = clamp(brand.trust - 12, 0, 100);
        brand.reputation = clamp(brand.reputation - 6, 0, 100);
        product.customerRating = clamp(product.customerRating - 0.6, 1, 5);
        product.buzz = Math.max(0, product.buzz - 0.3);
        adjustSentiment(state, -0.12);
        addNews(state, 'company', 'negative', `Kritik an ${state.company.name}: Serienfehler wird ignoriert`, 'Verbraucherschützer und Medien kritisieren das Schweigen des Herstellers.');
        break;
      case 'repair_program':
        product.quality.recallStatus = 'repair_program';
        brand.trust = clamp(brand.trust - 3, 0, 100);
        product.customerRating = clamp(product.customerRating - 0.15, 1, 5);
        product.quality.escapedRate *= 0.7;
        adjustSentiment(state, -0.04);
        addNews(state, 'company', 'neutral', `Reparaturprogramm für ${product.name}`, 'Betroffene Geräte werden kostenlos instand gesetzt.');
        break;
      case 'recall':
        product.quality.recallStatus = 'recall';
        product.quality.recallDay = state.time.day;
        product.quality.salesHaltUntil = state.time.day + 14;
        product.quality.defectRate *= 0.6;
        product.quality.escapedRate *= 0.3;
        brand.reputation = clamp(brand.reputation - 3, 0, 100);
        brand.trust = clamp(brand.trust + 2, 0, 100);
        adjustSentiment(state, -0.06);
        addNews(state, 'company', 'neutral', `${state.company.name} ruft ${product.name} zurück`, 'Der Hersteller reagiert konsequent – Verkaufsstopp für 14 Tage.');
        break;
      case 'replacement':
        product.quality.recallStatus = 'replacement';
        product.quality.defectRate *= 0.7;
        product.quality.escapedRate *= 0.2;
        brand.trust = clamp(brand.trust + 5, 0, 100);
        product.customerRating = clamp(product.customerRating + 0.2, 1, 5);
        adjustSentiment(state, -0.02);
        addNews(state, 'company', 'positive', `${state.company.name} tauscht alle defekten ${product.name} aus`, 'Kundinnen und Kunden loben den vorbildlichen Service.');
        break;
    }
  }
  state.events.decisions = state.events.decisions.filter((d) => d.id !== decisionId);
  return `Entscheidung umgesetzt: ${option.label}.`;
}

export function processDecisionDeadlines(state: GameState): void {
  for (const decision of [...state.events.decisions]) {
    if (state.time.day >= decision.deadlineDay) resolveDecision(state, decision.id, decision.defaultOptionId);
  }
}

/** Wöchentliche Ereignisprüfung. */
export function checkEvents(state: GameState): void {
  const day = state.time.day;
  checkRecalls(state);
  if (day < state.events.nextEventCheckDay) return;
  state.events.nextEventCheckDay = day + 7;
  if (day < 45) return;
  const frequency = DIFFICULTIES[state.difficulty].eventFrequency;
  if (!chance(state, 0.11 * frequency)) return;
  const eligible = EVENTS.filter((e) => (state.events.cooldowns[e.id] ?? 0) <= day && e.weight(state) > 0);
  const event = weightedPick(state, eligible, (e) => e.weight(state));
  if (!event) return;
  event.apply(state);
  state.events.cooldowns[event.id] = day + event.cooldownDays;
  state.events.log.unshift({ id: nextId(state, 'evt'), eventId: event.id, day, title: state.news[0]?.title ?? event.id });
  if (state.events.log.length > 100) state.events.log.length = 100;
}
