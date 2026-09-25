import type { CompetitorStrategy, ProductCategoryId, RegionId } from '@/types';

export interface CompetitorDef {
  id: string;
  name: string;
  shortName: string;
  color: string;
  strategy: CompetitorStrategy;
  description: string;
  cash: number;
  techLead: number;
  marketingPower: number;
  priceAggression: number;
  awareness: Partial<Record<RegionId, number>>;
  brand: { trust: number; premium: number; innovation: number; gaming: number; business: number };
  focus: Partial<Record<ProductCategoryId, number>>;
  factories: number;
  employees: number;
  productPrefix: Partial<Record<ProductCategoryId, string>>;
}

export const STRATEGY_LABELS: Record<CompetitorStrategy, { name: string; description: string }> = {
  budget: { name: 'Billiganbieter', description: 'Niedrige Preise, große Stückzahlen.' },
  premium: { name: 'Premium', description: 'Hohe Preise, hohe Qualität und starkes Design.' },
  gaming: { name: 'Gaming', description: 'Fokus auf Spielerinnen und Spieler.' },
  business: { name: 'Business', description: 'Zuverlässige Geräte für Unternehmen.' },
  innovation: { name: 'Innovation', description: 'Hohe Forschungsinvestitionen, neue Technologien zuerst.' },
};

export const COMPETITORS: CompetitorDef[] = [
  {
    id: 'apex',
    name: 'Apex Technologies',
    shortName: 'Apex',
    color: '#f43f5e',
    strategy: 'premium',
    description: 'Premium-Marke mit ikonischem Design und treuer Kundschaft.',
    cash: 40_000_000_000,
    techLead: 0.3,
    marketingPower: 0.9,
    priceAggression: 0.6,
    awareness: { europe: 0.85, north_america: 0.9, asia: 0.75, south_america: 0.7, africa: 0.55, oceania: 0.85 },
    brand: { trust: 78, premium: 90, innovation: 72, gaming: 30, business: 55 },
    focus: { smartphone: 1, laptop: 0.8, tablet: 0.9, smartwatch: 0.8, desktop: 0.4, monitor: 0.3 },
    factories: 14,
    employees: 90_000,
    productPrefix: { smartphone: 'aPhone', laptop: 'ApexBook', tablet: 'aPad', smartwatch: 'Apex Watch', desktop: 'Apex Studio', monitor: 'Apex Display' },
  },
  {
    id: 'orion',
    name: 'Orion Electronics',
    shortName: 'Orion',
    color: '#f59e0b',
    strategy: 'budget',
    description: 'Günstige Geräte in riesigen Stückzahlen – der Preisbrecher.',
    cash: 8_000_000_000,
    techLead: -0.6,
    marketingPower: 0.6,
    priceAggression: 1.35,
    awareness: { europe: 0.7, north_america: 0.6, asia: 0.85, south_america: 0.8, africa: 0.8, oceania: 0.55 },
    brand: { trust: 55, premium: 22, innovation: 35, gaming: 30, business: 40 },
    focus: { smartphone: 0.9, laptop: 0.8, desktop: 0.8, tablet: 0.7, monitor: 0.8, smartwatch: 0.5 },
    factories: 20,
    employees: 120_000,
    productPrefix: { smartphone: 'Orion Go', laptop: 'OrionBook', desktop: 'Orion PC', tablet: 'Orion Tab', monitor: 'Orion View', smartwatch: 'Orion Band' },
  },
  {
    id: 'titan_systems',
    name: 'Titan Systems',
    shortName: 'Titan',
    color: '#10b981',
    strategy: 'gaming',
    description: 'Gaming-Spezialist mit RGB, Power und E-Sport-Präsenz.',
    cash: 3_000_000_000,
    techLead: 0.1,
    marketingPower: 0.7,
    priceAggression: 0.9,
    awareness: { europe: 0.55, north_america: 0.65, asia: 0.55, south_america: 0.45, africa: 0.25, oceania: 0.5 },
    brand: { trust: 62, premium: 55, innovation: 58, gaming: 92, business: 20 },
    focus: { gaming_pc: 1, gaming_laptop: 1, graphics_card: 0.8, monitor: 0.6, mainboard: 0.7, desktop: 0.3 },
    factories: 5,
    employees: 14_000,
    productPrefix: {
      gaming_pc: 'Titan Forge',
      gaming_laptop: 'Titan Blade',
      graphics_card: 'Titan Arcflow',
      monitor: 'Titan Vision',
      mainboard: 'Titan Board',
      desktop: 'Titan Core',
    },
  },
  {
    id: 'vertex',
    name: 'Vertex Computing',
    shortName: 'Vertex',
    color: '#3b82f6',
    strategy: 'business',
    description: 'Solide Business-Hardware, Server und Rundum-Service.',
    cash: 12_000_000_000,
    techLead: 0,
    marketingPower: 0.55,
    priceAggression: 0.8,
    awareness: { europe: 0.7, north_america: 0.8, asia: 0.55, south_america: 0.5, africa: 0.4, oceania: 0.65 },
    brand: { trust: 85, premium: 55, innovation: 45, gaming: 15, business: 92 },
    focus: { desktop: 1, laptop: 0.9, server: 1, monitor: 0.6, tablet: 0.3 },
    factories: 9,
    employees: 60_000,
    productPrefix: { desktop: 'Vertex OptiLine', laptop: 'Vertex Latitude', server: 'Vertex PowerRack', monitor: 'Vertex UltraView', tablet: 'Vertex Slate' },
  },
  {
    id: 'helios',
    name: 'Helios Devices',
    shortName: 'Helios',
    color: '#a855f7',
    strategy: 'innovation',
    description: 'Technologietreiber – bringt neue Features zuerst auf den Markt.',
    cash: 6_000_000_000,
    techLead: 0.5,
    marketingPower: 0.65,
    priceAggression: 0.85,
    awareness: { europe: 0.5, north_america: 0.55, asia: 0.7, south_america: 0.4, africa: 0.35, oceania: 0.45 },
    brand: { trust: 65, premium: 68, innovation: 92, gaming: 45, business: 40 },
    focus: { smartphone: 0.8, smartwatch: 0.9, tablet: 0.6, laptop: 0.5, gaming_laptop: 0.35, monitor: 0.3 },
    factories: 7,
    employees: 35_000,
    productPrefix: { smartphone: 'Helios X', smartwatch: 'Helios Pulse', tablet: 'Helios Canvas', laptop: 'Helios Air', gaming_laptop: 'Helios Nova', monitor: 'Helios Prism' },
  },
];
