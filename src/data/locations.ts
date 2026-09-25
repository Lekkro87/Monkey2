import type { FactoryLocationDef, RegionId } from '@/types';

export interface HeadquartersDef {
  id: string;
  city: string;
  country: string;
  region: RegionId;
  wageFactor: number;
  rentFactor: number;
  taxRate: number;
}

export const HEADQUARTERS: HeadquartersDef[] = [
  { id: 'berlin', city: 'Berlin', country: 'Deutschland', region: 'europe', wageFactor: 1, rentFactor: 1, taxRate: 0.3 },
  { id: 'munich', city: 'München', country: 'Deutschland', region: 'europe', wageFactor: 1.1, rentFactor: 1.3, taxRate: 0.3 },
  { id: 'hamburg', city: 'Hamburg', country: 'Deutschland', region: 'europe', wageFactor: 1.03, rentFactor: 1.1, taxRate: 0.3 },
  { id: 'vienna', city: 'Wien', country: 'Österreich', region: 'europe', wageFactor: 0.98, rentFactor: 0.95, taxRate: 0.23 },
  { id: 'zurich', city: 'Zürich', country: 'Schweiz', region: 'europe', wageFactor: 1.45, rentFactor: 1.5, taxRate: 0.2 },
  { id: 'amsterdam', city: 'Amsterdam', country: 'Niederlande', region: 'europe', wageFactor: 1.05, rentFactor: 1.2, taxRate: 0.25 },
  { id: 'warsaw', city: 'Warschau', country: 'Polen', region: 'europe', wageFactor: 0.6, rentFactor: 0.6, taxRate: 0.19 },
  { id: 'stockholm', city: 'Stockholm', country: 'Schweden', region: 'europe', wageFactor: 1.08, rentFactor: 1.1, taxRate: 0.21 },
  { id: 'san_francisco', city: 'San Francisco', country: 'USA', region: 'north_america', wageFactor: 1.6, rentFactor: 1.8, taxRate: 0.28 },
  { id: 'austin', city: 'Austin', country: 'USA', region: 'north_america', wageFactor: 1.3, rentFactor: 1.1, taxRate: 0.21 },
  { id: 'toronto', city: 'Toronto', country: 'Kanada', region: 'north_america', wageFactor: 1.1, rentFactor: 1.15, taxRate: 0.26 },
  { id: 'shenzhen', city: 'Shenzhen', country: 'China', region: 'asia', wageFactor: 0.5, rentFactor: 0.7, taxRate: 0.25 },
  { id: 'taipei', city: 'Taipeh', country: 'Taiwan', region: 'asia', wageFactor: 0.7, rentFactor: 0.8, taxRate: 0.2 },
  { id: 'seoul', city: 'Seoul', country: 'Südkorea', region: 'asia', wageFactor: 0.85, rentFactor: 1, taxRate: 0.24 },
  { id: 'tokyo', city: 'Tokio', country: 'Japan', region: 'asia', wageFactor: 0.95, rentFactor: 1.3, taxRate: 0.3 },
  { id: 'bangalore', city: 'Bangalore', country: 'Indien', region: 'asia', wageFactor: 0.35, rentFactor: 0.45, taxRate: 0.25 },
  { id: 'sao_paulo', city: 'São Paulo', country: 'Brasilien', region: 'south_america', wageFactor: 0.45, rentFactor: 0.6, taxRate: 0.34 },
  { id: 'cape_town', city: 'Kapstadt', country: 'Südafrika', region: 'africa', wageFactor: 0.4, rentFactor: 0.5, taxRate: 0.27 },
  { id: 'sydney', city: 'Sydney', country: 'Australien', region: 'oceania', wageFactor: 1.2, rentFactor: 1.4, taxRate: 0.3 },
];

export function getHeadquarters(id: string): HeadquartersDef {
  return HEADQUARTERS.find((h) => h.id === id) ?? HEADQUARTERS[0];
}

export const FACTORY_LOCATIONS: FactoryLocationDef[] = [
  {
    id: 'de_saxony',
    name: 'Dresden',
    country: 'Deutschland',
    region: 'europe',
    buildCostFactor: 1.25,
    wageFactor: 1.05,
    energyFactor: 1.2,
    logisticsFactor: 0.5,
    qualityFactor: 1.08,
    taxFactor: 1,
    description: 'Hohe Qualität und kurze Wege nach Europa, aber teuer.',
  },
  {
    id: 'cz_brno',
    name: 'Brünn',
    country: 'Tschechien',
    region: 'europe',
    buildCostFactor: 0.95,
    wageFactor: 0.62,
    energyFactor: 1.05,
    logisticsFactor: 0.6,
    qualityFactor: 1.03,
    taxFactor: 0.9,
    description: 'Günstige Löhne mitten in Europa.',
  },
  {
    id: 'us_texas',
    name: 'Austin',
    country: 'USA',
    region: 'north_america',
    buildCostFactor: 1.2,
    wageFactor: 1.25,
    energyFactor: 0.75,
    logisticsFactor: 0.9,
    qualityFactor: 1.04,
    taxFactor: 0.95,
    description: 'Günstige Energie, zollfreier Zugang zum US-Markt.',
  },
  {
    id: 'mx_monterrey',
    name: 'Monterrey',
    country: 'Mexiko',
    region: 'north_america',
    buildCostFactor: 0.8,
    wageFactor: 0.4,
    energyFactor: 0.85,
    logisticsFactor: 1,
    qualityFactor: 0.97,
    taxFactor: 0.9,
    description: 'Nearshoring für Nordamerika mit niedrigen Löhnen.',
  },
  {
    id: 'cn_shenzhen',
    name: 'Shenzhen',
    country: 'China',
    region: 'asia',
    buildCostFactor: 0.7,
    wageFactor: 0.38,
    energyFactor: 0.8,
    logisticsFactor: 1.35,
    qualityFactor: 1,
    taxFactor: 0.95,
    description: 'Direkt bei den Zulieferern – günstig, aber lange Seewege.',
  },
  {
    id: 'vn_hanoi',
    name: 'Hanoi',
    country: 'Vietnam',
    region: 'asia',
    buildCostFactor: 0.6,
    wageFactor: 0.28,
    energyFactor: 0.85,
    logisticsFactor: 1.45,
    qualityFactor: 0.94,
    taxFactor: 0.8,
    description: 'Niedrigste Kosten, Qualität braucht Investitionen.',
  },
  {
    id: 'in_chennai',
    name: 'Chennai',
    country: 'Indien',
    region: 'asia',
    buildCostFactor: 0.62,
    wageFactor: 0.3,
    energyFactor: 0.9,
    logisticsFactor: 1.4,
    qualityFactor: 0.95,
    taxFactor: 0.85,
    description: 'Wachsender Standort mit Förderprogrammen.',
  },
  {
    id: 'br_manaus',
    name: 'Manaus',
    country: 'Brasilien',
    region: 'south_america',
    buildCostFactor: 0.75,
    wageFactor: 0.42,
    energyFactor: 0.95,
    logisticsFactor: 1.5,
    qualityFactor: 0.95,
    taxFactor: 0.7,
    description: 'Freihandelszone – umgeht südamerikanische Importzölle.',
  },
];

export function getFactoryLocation(id: string): FactoryLocationDef {
  return FACTORY_LOCATIONS.find((l) => l.id === id) ?? FACTORY_LOCATIONS[0];
}
