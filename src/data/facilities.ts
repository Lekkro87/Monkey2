import type { AutomationLevel, LabDef, ProductionLineType, QcLevelId, WarehouseKind } from '@/types';

export interface OfficeDef {
  level: number;
  name: string;
  stageName: string;
  maxEmployees: number;
  rentPerMonth: number;
  moveCost: number;
  moveDays: number;
  motivationBonus: number;
  storage: number;
  description: string;
}

export const OFFICES: OfficeDef[] = [
  {
    level: 0,
    name: 'Garage',
    stageName: 'Garage',
    maxEmployees: 5,
    rentPerMonth: 150,
    moveCost: 0,
    moveDays: 0,
    motivationBonus: -4,
    storage: 120,
    description: 'Die Garage der Gründerin bzw. des Gründers – eng, aber günstig.',
  },
  {
    level: 1,
    name: 'Kleines Büro',
    stageName: 'Start-up',
    maxEmployees: 30,
    rentPerMonth: 3_200,
    moveCost: 15_000,
    moveDays: 14,
    motivationBonus: 0,
    storage: 150,
    description: 'Büroetage im Gewerbegebiet für bis zu 30 Leute.',
  },
  {
    level: 2,
    name: 'Bürogebäude',
    stageName: 'Unternehmen',
    maxEmployees: 160,
    rentPerMonth: 18_000,
    moveCost: 180_000,
    moveDays: 30,
    motivationBonus: 3,
    storage: 400,
    description: 'Eigenes Gebäude mit Besprechungsräumen und Kantine.',
  },
  {
    level: 3,
    name: 'Firmenzentrale',
    stageName: 'Konzern',
    maxEmployees: 1_200,
    rentPerMonth: 110_000,
    moveCost: 2_500_000,
    moveDays: 60,
    motivationBonus: 6,
    storage: 1_000,
    description: 'Repräsentative Zentrale mit mehreren Gebäuden.',
  },
  {
    level: 4,
    name: 'Tech-Campus',
    stageName: 'Globaler Technologiekonzern',
    maxEmployees: 15_000,
    rentPerMonth: 700_000,
    moveCost: 30_000_000,
    moveDays: 120,
    motivationBonus: 10,
    storage: 5_000,
    description: 'Weitläufiger Campus mit Laboren, Fitnessstudio und Kinderbetreuung.',
  },
];

export interface ToolLevelDef {
  level: number;
  name: string;
  cost: number;
  speed: number;
  lines: number;
  maxWorkers: number;
  qualityBonus: number;
  description: string;
}

export const WORKSHOP_TOOLS: ToolLevelDef[] = [
  { level: 0, name: 'Keine Ausstattung', cost: 0, speed: 0, lines: 0, maxWorkers: 0, qualityBonus: 0, description: 'Ohne Werkzeug keine Montage.' },
  {
    level: 1,
    name: 'Grundausstattung',
    cost: 2_500,
    speed: 1,
    lines: 1,
    maxWorkers: 4,
    qualityBonus: 0,
    description: 'Werkbank, Schraubendreher, ESD-Matte und Testnetzteil.',
  },
  {
    level: 2,
    name: 'Profi-Werkstatt',
    cost: 14_000,
    speed: 1.25,
    lines: 2,
    maxWorkers: 12,
    qualityBonus: 3,
    description: 'Mehrere Arbeitsplätze, Burn-in-Rack und Messgeräte.',
  },
  {
    level: 3,
    name: 'Montagehalle',
    cost: 60_000,
    speed: 1.5,
    lines: 3,
    maxWorkers: 30,
    qualityBonus: 5,
    description: 'Kleine Montagestraße mit Förderband und Prüfstationen.',
  },
];

export interface FactoryLevelInfo {
  capacityPerMonth: number;
  workers: number;
}

/** Kapazität in Kapazitätseinheiten pro Monat (Level 1 = 1.000, Level 10 = 100.000). */
export function factoryCapacity(level: number): number {
  return Math.round(1_000 * 100 ** ((level - 1) / 9));
}

export function factoryWorkersNeeded(level: number, automation: AutomationLevel): number {
  const base = 14 * (factoryCapacity(level) / 1_000);
  return Math.max(3, Math.round(base * (1 - 0.8 * (automation / 100))));
}

export const FACTORY_BASE_COST = 750_000;
export const FACTORY_BUILD_DAYS = 90;

export function factoryUpgradeCost(currentLevel: number): number {
  return Math.round(600_000 * 1.6 ** (currentLevel - 1));
}

export function factoryUpgradeDays(currentLevel: number): number {
  return 30 + currentLevel * 8;
}

export interface LineTypeDef {
  id: ProductionLineType;
  name: string;
  cost: number;
  requiredTech?: string;
  description: string;
}

export const LINE_TYPES: Record<ProductionLineType, LineTypeDef> = {
  pc_assembly: { id: 'pc_assembly', name: 'PC-Montage', cost: 80_000, description: 'Desktop- und Gaming-PCs.' },
  server: { id: 'server', name: 'Server-Montage', cost: 150_000, requiredTech: 'server_systems', description: 'Rack-Server mit Burn-in-Tests.' },
  notebook: { id: 'notebook', name: 'Notebook-Linie', cost: 400_000, requiredTech: 'notebook_engineering', description: 'Laptops und Gaming-Laptops.' },
  mobile: {
    id: 'mobile',
    name: 'SMT-/Mobile-Linie',
    cost: 900_000,
    requiredTech: 'smt_manufacturing',
    description: 'Bestückungsautomaten für Smartphones, Tablets und Wearables.',
  },
  display: { id: 'display', name: 'Display-Montage', cost: 350_000, requiredTech: 'monitor_assembly', description: 'Monitore.' },
  pcb: { id: 'pcb', name: 'Platinenfertigung', cost: 600_000, requiredTech: 'smt_manufacturing', description: 'Grafikkarten und Mainboards.' },
  chip: {
    id: 'chip',
    name: 'Chip-Packaging & Test',
    cost: 25_000_000,
    requiredTech: 'cpu_design',
    description: 'Packaging und Test eigener Prozessoren (Wafer von Foundries).',
  },
};

export interface AutomationDef {
  level: AutomationLevel;
  name: string;
  costFactor: number;
  speed: number;
  quality: number;
  energy: number;
  requiredTech?: string;
}

export const AUTOMATION_LEVELS: AutomationDef[] = [
  { level: 0, name: 'Manuell', costFactor: 0, speed: 1, quality: 0, energy: 1 },
  { level: 25, name: 'Teilautomatisiert', costFactor: 0.35, speed: 1.12, quality: 2, energy: 1.1, requiredTech: 'automation_basics' },
  { level: 50, name: 'Automatisiert', costFactor: 0.8, speed: 1.25, quality: 4, energy: 1.2, requiredTech: 'automation_basics' },
  { level: 75, name: 'Robotergestützt', costFactor: 1.5, speed: 1.4, quality: 6, energy: 1.3, requiredTech: 'robotics' },
  { level: 100, name: 'Vollautomatisch', costFactor: 2.6, speed: 1.6, quality: 8, energy: 1.45, requiredTech: 'lights_out_factory' },
];

export interface QcLevelDef {
  id: QcLevelId;
  name: string;
  description: string;
  costPerUnit: number;
  detection: number;
  speed: number;
  qualityBonus: number;
  requiredTech?: string;
}

export const QC_LEVELS: Record<QcLevelId, QcLevelDef> = {
  basic: { id: 'basic', name: 'Sichtprüfung', description: 'Einschalten und Sichtkontrolle.', costPerUnit: 0, detection: 0.35, speed: 1, qualityBonus: 0 },
  sampling: {
    id: 'sampling',
    name: 'Stichproben & menschliche Kontrolle',
    description: 'Geschulte Prüfer testen jedes zehnte Gerät intensiv.',
    costPerUnit: 1.5,
    detection: 0.55,
    speed: 0.98,
    qualityBonus: 2,
  },
  automated: {
    id: 'automated',
    name: 'Automatische Tests',
    description: 'Jedes Gerät durchläuft einen automatisierten Funktionstest.',
    costPerUnit: 3,
    detection: 0.75,
    speed: 0.96,
    qualityBonus: 4,
    requiredTech: 'quality_automation',
  },
  stress: {
    id: 'stress',
    name: 'Belastungstests',
    description: 'Burn-in unter Last und Temperaturzyklen.',
    costPerUnit: 6,
    detection: 0.88,
    speed: 0.92,
    qualityBonus: 6,
    requiredTech: 'stress_testing',
  },
  safety: {
    id: 'safety',
    name: 'Sicherheitsprüfungen',
    description: 'Zusätzliche Akku-, Brand- und Elektroprüfungen.',
    costPerUnit: 9,
    detection: 0.95,
    speed: 0.9,
    qualityBonus: 8,
    requiredTech: 'safety_certification',
  },
};

export const QC_ORDER: QcLevelId[] = ['basic', 'sampling', 'automated', 'stress', 'safety'];

export interface WarehouseDef {
  kind: WarehouseKind;
  name: string;
  capacity: number;
  rentPerMonth: number;
  setupCost: number;
  buildDays: number;
  minStage: number;
  description: string;
}

export const WAREHOUSE_TYPES: WarehouseDef[] = [
  {
    kind: 'storage_unit',
    name: 'Lagerraum',
    capacity: 400,
    rentPerMonth: 350,
    setupCost: 500,
    buildDays: 2,
    minStage: 1,
    description: 'Angemieteter Lagerraum in der Nähe.',
  },
  {
    kind: 'warehouse',
    name: 'Lagerhalle',
    capacity: 10_000,
    rentPerMonth: 6_500,
    setupCost: 25_000,
    buildDays: 14,
    minStage: 2,
    description: 'Halle mit Regalsystem und Laderampe.',
  },
  {
    kind: 'logistics_center',
    name: 'Logistikzentrum',
    capacity: 100_000,
    rentPerMonth: 48_000,
    setupCost: 600_000,
    buildDays: 45,
    minStage: 3,
    description: 'Automatisiertes Hochregallager.',
  },
  {
    kind: 'mega_hub',
    name: 'Mega-Hub',
    capacity: 1_000_000,
    rentPerMonth: 320_000,
    setupCost: 12_000_000,
    buildDays: 120,
    minStage: 4,
    description: 'Kontinentales Verteilzentrum mit Robotik.',
  },
];

/** Tägliche Gebühr pro Lagereinheit über der Kapazität (externes Zwischenlager). */
export const OVERFLOW_FEE_PER_UNIT_DAY = 1.2;

export const LABS: LabDef[] = [
  {
    level: 0,
    name: 'Kein Labor',
    cost: 0,
    monthlyCost: 0,
    maxResearchers: 3,
    speedMultiplier: 0.6,
    buildDays: 0,
    description: 'Forschung am Küchentisch – langsam und begrenzt.',
  },
  {
    level: 1,
    name: 'Kleines Labor',
    cost: 500_000,
    monthlyCost: 20_000,
    maxResearchers: 15,
    speedMultiplier: 1,
    buildDays: 45,
    description: 'Messtechnik, Prototypenbau und Platz für 15 Forschende.',
  },
  {
    level: 2,
    name: 'Mittleres Labor',
    cost: 5_000_000,
    monthlyCost: 150_000,
    maxResearchers: 60,
    speedMultiplier: 1.3,
    buildDays: 90,
    description: 'Reinraum, Klimakammern und eigene Testlinien.',
  },
  {
    level: 3,
    name: 'Großes Forschungszentrum',
    cost: 50_000_000,
    monthlyCost: 1_000_000,
    maxResearchers: 300,
    speedMultiplier: 1.7,
    buildDays: 180,
    description: 'Weltklasse-Forschung mit eigener Chip-Entwicklung.',
  },
];

export interface SupportLevelDef {
  id: 'basic' | 'phone' | 'premium' | 'onsite';
  name: string;
  description: string;
  costPerTicket: number;
  satisfactionBonus: number;
  subscriptionPrice: number;
  requiredTech?: string;
}

export const SUPPORT_LEVELS: SupportLevelDef[] = [
  { id: 'basic', name: 'E-Mail-Support', description: 'Antwort innerhalb von 48 Stunden.', costPerTicket: 4, satisfactionBonus: 0, subscriptionPrice: 0 },
  { id: 'phone', name: 'Telefon-Support', description: 'Hotline zu Geschäftszeiten.', costPerTicket: 9, satisfactionBonus: 5, subscriptionPrice: 0 },
  {
    id: 'premium',
    name: 'Premium-Support',
    description: '24/7-Hotline; Kunden können ein Premium-Abo abschließen.',
    costPerTicket: 14,
    satisfactionBonus: 9,
    subscriptionPrice: 6.99,
    requiredTech: 'premium_support',
  },
  {
    id: 'onsite',
    name: 'Vor-Ort-Service',
    description: 'Techniker kommen zu Business-Kunden.',
    costPerTicket: 22,
    satisfactionBonus: 13,
    subscriptionPrice: 12.99,
    requiredTech: 'onsite_service',
  },
];

/** Tickets, die eine Support-Vollzeitkraft pro Monat bearbeitet. */
export const TICKETS_PER_AGENT = 320;
