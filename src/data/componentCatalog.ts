import type { ComponentSpecs, ComponentType, FeatureId, FormFactor, Tier } from '@/types';

/**
 * Datengetriebener Komponentenkatalog. Jede Produktfamilie eines Herstellers enthält
 * Modelle (Leistungsklassen). Familien mit `cadenceDays` erhalten im Spielverlauf neue
 * Generationen (siehe systems/components/generations.ts).
 */
export interface ComponentModelDef {
  key: string;
  /** Namensmuster: {s} = Serie, {cap} = Kapazität, {mt} = Speichertyp, {rev} = Revision. */
  name: string;
  tier: Tier;
  /** Listenpreis in EUR zum Spielstart (wird in Herstellerwährung umgerechnet). */
  priceEur: number;
  performance: number;
  quality: number;
  reliability: number;
  powerDraw?: number;
  specs?: ComponentSpecs;
  features?: FeatureId[];
  requiredTech?: string;
  /** Erst ab dieser Generation verfügbar. */
  fromGeneration?: number;
}

export interface ComponentFamilyDef {
  id: string;
  manufacturerId: string;
  type: ComponentType;
  formFactor: FormFactor;
  volume: number;
  leadTimeDays: number;
  monthlySupply: number;
  cadenceDays?: number;
  seriesStart?: number;
  seriesStep?: number;
  /** Speicherkapazität verdoppelt sich je Generation. */
  capacityScaling?: boolean;
  memoryTypes?: string[];
  models: ComponentModelDef[];
}

/** Jährliches Leistungswachstum je Komponententyp (Technologiekurve). */
export const TECH_GROWTH: Partial<Record<ComponentType, number>> = {
  cpu: 0.15,
  gpu: 0.18,
  gpu_chip: 0.18,
  soc: 0.16,
  ram: 0.12,
  vram: 0.12,
  storage: 0.12,
  display: 0.05,
  camera: 0.07,
  battery: 0.04,
  mainboard: 0.06,
  chipset: 0.08,
  wafer: 0.15,
};

export function techCurve(type: ComponentType, day: number): number {
  const growth = TECH_GROWTH[type] ?? 0;
  return (1 + growth) ** (day / 365);
}

const m = (
  key: string,
  name: string,
  tier: Tier,
  priceEur: number,
  performance: number,
  quality: number,
  reliability: number,
  extra: Partial<ComponentModelDef> = {},
): ComponentModelDef => ({ key, name, tier, priceEur, performance, quality, reliability, ...extra });

// ---------------------------------------------------------------------------
// Prozessoren
// ---------------------------------------------------------------------------
const CPU_FAMILIES: ComponentFamilyDef[] = [
  {
    id: 'arcadia-desktop',
    manufacturerId: 'arcadia',
    type: 'cpu',
    formFactor: 'desktop',
    volume: 0.05,
    leadTimeDays: 10,
    monthlySupply: 900_000,
    cadenceDays: 540,
    seriesStart: 3,
    seriesStep: 1,
    models: [
      m('a3', 'A3 {s}200', 'budget', 89, 40, 60, 82, { powerDraw: 65, specs: { cores: 6, clockGhz: 4.2 } }),
      m('a5', 'A5 {s}400', 'mainstream', 159, 58, 64, 82, { powerDraw: 95, specs: { cores: 8, clockGhz: 4.6 } }),
    ],
  },
  {
    id: 'novasilicon-desktop',
    manufacturerId: 'novasilicon',
    type: 'cpu',
    formFactor: 'desktop',
    volume: 0.05,
    leadTimeDays: 12,
    monthlySupply: 1_400_000,
    cadenceDays: 450,
    seriesStart: 7,
    seriesStep: 1,
    models: [
      m('n3', 'Nova Core 3 {s}100', 'budget', 109, 46, 72, 90, { powerDraw: 65, specs: { cores: 6, clockGhz: 4.4 } }),
      m('n5', 'Nova Core 5 {s}600', 'mainstream', 199, 64, 76, 91, { powerDraw: 95, specs: { cores: 8, clockGhz: 5.0 } }),
      m('n7', 'Nova Core 7 {s}700', 'performance', 339, 82, 80, 91, { powerDraw: 125, specs: { cores: 12, clockGhz: 5.3 } }),
      m('n9', 'Nova Core 9 {s}900', 'enthusiast', 549, 95, 83, 90, { powerDraw: 150, specs: { cores: 16, clockGhz: 5.6 } }),
    ],
  },
  {
    id: 'quantumcore-desktop',
    manufacturerId: 'quantumcore',
    type: 'cpu',
    formFactor: 'desktop',
    volume: 0.05,
    leadTimeDays: 14,
    monthlySupply: 1_100_000,
    cadenceDays: 400,
    seriesStart: 8,
    seriesStep: 1,
    models: [
      m('q5', 'Q5 {s}500X', 'mainstream', 229, 69, 79, 88, { powerDraw: 105, specs: { cores: 8, clockGhz: 5.2 } }),
      m('q7', 'Q7 {s}700X', 'performance', 369, 87, 82, 88, { powerDraw: 140, specs: { cores: 12, clockGhz: 5.5 } }),
      m('q9', 'Q9 {s}950X', 'enthusiast', 599, 100, 86, 87, { powerDraw: 170, specs: { cores: 16, clockGhz: 5.8 }, features: ['ai_accel'] }),
    ],
  },
  {
    id: 'arcadia-mobile',
    manufacturerId: 'arcadia',
    type: 'cpu',
    formFactor: 'mobile',
    volume: 0.03,
    leadTimeDays: 10,
    monthlySupply: 1_500_000,
    cadenceDays: 540,
    seriesStart: 3,
    seriesStep: 1,
    models: [
      m('a3m', 'A3 {s}200U', 'budget', 99, 38, 60, 82, { powerDraw: 25, specs: { cores: 6, clockGhz: 4.0 } }),
      m('a5m', 'A5 {s}400U', 'mainstream', 149, 54, 64, 82, { powerDraw: 28, specs: { cores: 8, clockGhz: 4.3 } }),
    ],
  },
  {
    id: 'novasilicon-mobile',
    manufacturerId: 'novasilicon',
    type: 'cpu',
    formFactor: 'mobile',
    volume: 0.03,
    leadTimeDays: 12,
    monthlySupply: 2_500_000,
    cadenceDays: 450,
    seriesStart: 7,
    seriesStep: 1,
    models: [
      m('n3m', 'Nova Core 3 {s}100U', 'budget', 119, 44, 72, 90, { powerDraw: 28, specs: { cores: 6, clockGhz: 4.3 } }),
      m('n5m', 'Nova Core 5 {s}600H', 'mainstream', 209, 64, 76, 91, { powerDraw: 45, specs: { cores: 8, clockGhz: 4.8 } }),
      m('n7m', 'Nova Core 7 {s}700H', 'performance', 319, 80, 80, 91, { powerDraw: 45, specs: { cores: 12, clockGhz: 5.0 } }),
      m('n9m', 'Nova Core 9 {s}900HX', 'enthusiast', 499, 95, 82, 90, { powerDraw: 55, specs: { cores: 16, clockGhz: 5.3 } }),
    ],
  },
  {
    id: 'quantumcore-mobile',
    manufacturerId: 'quantumcore',
    type: 'cpu',
    formFactor: 'mobile',
    volume: 0.03,
    leadTimeDays: 14,
    monthlySupply: 1_800_000,
    cadenceDays: 400,
    seriesStart: 8,
    seriesStep: 1,
    models: [
      m('q5m', 'Q5 {s}500HS', 'mainstream', 229, 67, 79, 88, { powerDraw: 35, specs: { cores: 8, clockGhz: 5.0 } }),
      m('q7m', 'Q7 {s}700HS', 'performance', 349, 85, 82, 88, { powerDraw: 45, specs: { cores: 12, clockGhz: 5.2 }, features: ['ai_accel'] }),
      m('q9m', 'Q9 {s}950HX', 'enthusiast', 559, 100, 85, 87, { powerDraw: 65, specs: { cores: 16, clockGhz: 5.5 }, features: ['ai_accel'] }),
    ],
  },
  {
    id: 'arcadia-server',
    manufacturerId: 'arcadia',
    type: 'cpu',
    formFactor: 'server',
    volume: 0.08,
    leadTimeDays: 21,
    monthlySupply: 120_000,
    cadenceDays: 600,
    seriesStart: 3,
    seriesStep: 1,
    models: [m('as16', 'A-Server {s}016', 'mainstream', 690, 50, 70, 88, { powerDraw: 150, specs: { cores: 16 }, features: ['ecc'] })],
  },
  {
    id: 'novasilicon-server',
    manufacturerId: 'novasilicon',
    type: 'cpu',
    formFactor: 'server',
    volume: 0.08,
    leadTimeDays: 21,
    monthlySupply: 200_000,
    cadenceDays: 540,
    seriesStart: 5,
    seriesStep: 1,
    models: [
      m('ns32', 'Nova Server {s}032', 'performance', 1_290, 72, 82, 94, { powerDraw: 200, specs: { cores: 32 }, features: ['ecc'] }),
      m('ns64', 'Nova Server {s}064', 'enthusiast', 2_690, 90, 85, 94, { powerDraw: 280, specs: { cores: 64 }, features: ['ecc'] }),
    ],
  },
  {
    id: 'quantumcore-server',
    manufacturerId: 'quantumcore',
    type: 'cpu',
    formFactor: 'server',
    volume: 0.08,
    leadTimeDays: 21,
    monthlySupply: 160_000,
    cadenceDays: 500,
    seriesStart: 4,
    seriesStep: 1,
    models: [
      m('qs48', 'QX {s}048', 'performance', 1_890, 82, 85, 92, { powerDraw: 240, specs: { cores: 48 }, features: ['ecc'] }),
      m('qs96', 'QX {s}096', 'enthusiast', 3_990, 100, 88, 92, { powerDraw: 360, specs: { cores: 96 }, features: ['ecc', 'ai_accel'] }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Grafik
// ---------------------------------------------------------------------------
const GPU_FAMILIES: ComponentFamilyDef[] = [
  {
    id: 'prism-desktop',
    manufacturerId: 'prism',
    type: 'gpu',
    formFactor: 'desktop',
    volume: 0.4,
    leadTimeDays: 12,
    monthlySupply: 500_000,
    cadenceDays: 600,
    seriesStart: 5,
    seriesStep: 1,
    models: [
      m('p5', 'P{s}50', 'budget', 169, 26, 62, 80, { powerDraw: 115, specs: { capacityGb: 8 } }),
      m('p6', 'P{s}70', 'mainstream', 279, 40, 64, 80, { powerDraw: 170, specs: { capacityGb: 12 } }),
    ],
  },
  {
    id: 'vector-desktop',
    manufacturerId: 'vector_gpu',
    type: 'gpu',
    formFactor: 'desktop',
    volume: 0.4,
    leadTimeDays: 14,
    monthlySupply: 800_000,
    cadenceDays: 520,
    seriesStart: 7,
    seriesStep: 1,
    models: [
      m('v6', 'VX {s}600', 'budget', 219, 34, 74, 88, { powerDraw: 130, specs: { capacityGb: 8 } }),
      m('v7', 'VX {s}700', 'mainstream', 369, 50, 76, 88, { powerDraw: 190, specs: { capacityGb: 12 } }),
      m('v9', 'VX {s}900', 'performance', 649, 72, 79, 87, { powerDraw: 290, specs: { capacityGb: 20 }, features: ['raytracing'] }),
    ],
  },
  {
    id: 'titan-desktop',
    manufacturerId: 'titan_graphics',
    type: 'gpu',
    formFactor: 'desktop',
    volume: 0.45,
    leadTimeDays: 14,
    monthlySupply: 1_200_000,
    cadenceDays: 480,
    seriesStart: 4,
    seriesStep: 1,
    models: [
      m('t6', 'TG {s}60', 'mainstream', 349, 47, 82, 92, { powerDraw: 150, specs: { capacityGb: 8 }, features: ['raytracing'] }),
      m('t7', 'TG {s}70', 'performance', 629, 68, 84, 92, { powerDraw: 220, specs: { capacityGb: 12 }, features: ['raytracing', 'ai_accel'] }),
      m('t8', 'TG {s}80', 'enthusiast', 999, 84, 86, 91, { powerDraw: 300, specs: { capacityGb: 16 }, features: ['raytracing', 'ai_accel'] }),
      m('t9', 'TG {s}90', 'enthusiast', 1_699, 100, 88, 90, { powerDraw: 420, specs: { capacityGb: 24 }, features: ['raytracing', 'ai_accel'] }),
    ],
  },
  {
    id: 'prism-mobile',
    manufacturerId: 'prism',
    type: 'gpu',
    formFactor: 'mobile',
    volume: 0.04,
    leadTimeDays: 12,
    monthlySupply: 400_000,
    cadenceDays: 600,
    seriesStart: 5,
    seriesStep: 1,
    models: [m('p5m', 'P{s}50M', 'budget', 149, 30, 62, 80, { powerDraw: 60 })],
  },
  {
    id: 'vector-mobile',
    manufacturerId: 'vector_gpu',
    type: 'gpu',
    formFactor: 'mobile',
    volume: 0.04,
    leadTimeDays: 14,
    monthlySupply: 600_000,
    cadenceDays: 520,
    seriesStart: 7,
    seriesStep: 1,
    models: [
      m('v7m', 'VX {s}700M', 'mainstream', 329, 52, 76, 88, { powerDraw: 100 }),
      m('v9m', 'VX {s}900M', 'performance', 569, 74, 79, 87, { powerDraw: 140, features: ['raytracing'] }),
    ],
  },
  {
    id: 'titan-mobile',
    manufacturerId: 'titan_graphics',
    type: 'gpu',
    formFactor: 'mobile',
    volume: 0.04,
    leadTimeDays: 14,
    monthlySupply: 900_000,
    cadenceDays: 480,
    seriesStart: 4,
    seriesStep: 1,
    models: [
      m('t6m', 'TG {s}60 Mobile', 'mainstream', 359, 50, 82, 92, { powerDraw: 90, features: ['raytracing'] }),
      m('t7m', 'TG {s}70 Mobile', 'performance', 559, 70, 84, 92, { powerDraw: 115, features: ['raytracing', 'ai_accel'] }),
      m('t9m', 'TG {s}90 Mobile', 'enthusiast', 949, 100, 87, 90, { powerDraw: 150, features: ['raytracing', 'ai_accel'] }),
    ],
  },
  {
    id: 'prism-chip',
    manufacturerId: 'prism',
    type: 'gpu_chip',
    formFactor: 'chip',
    volume: 0.01,
    leadTimeDays: 21,
    monthlySupply: 300_000,
    cadenceDays: 600,
    seriesStart: 5,
    seriesStep: 1,
    models: [m('p5c', 'P{s}50 Chip', 'budget', 75, 26, 62, 80, { powerDraw: 110, requiredTech: 'gpu_board_partner' })],
  },
  {
    id: 'vector-chip',
    manufacturerId: 'vector_gpu',
    type: 'gpu_chip',
    formFactor: 'chip',
    volume: 0.01,
    leadTimeDays: 21,
    monthlySupply: 400_000,
    cadenceDays: 520,
    seriesStart: 7,
    seriesStep: 1,
    models: [
      m('v7c', 'VX {s}700 Chip', 'mainstream', 170, 50, 76, 88, { powerDraw: 180, requiredTech: 'gpu_board_partner' }),
      m('v9c', 'VX {s}900 Chip', 'performance', 310, 72, 79, 87, { powerDraw: 275, requiredTech: 'gpu_board_partner', features: ['raytracing'] }),
    ],
  },
  {
    id: 'titan-chip',
    manufacturerId: 'titan_graphics',
    type: 'gpu_chip',
    formFactor: 'chip',
    volume: 0.01,
    leadTimeDays: 21,
    monthlySupply: 500_000,
    cadenceDays: 480,
    seriesStart: 4,
    seriesStep: 1,
    models: [
      m('t6c', 'TG {s}60 Chip', 'mainstream', 165, 47, 82, 92, { powerDraw: 140, requiredTech: 'gpu_board_partner', features: ['raytracing'] }),
      m('t7c', 'TG {s}70 Chip', 'performance', 300, 68, 84, 92, {
        powerDraw: 210,
        requiredTech: 'gpu_board_partner',
        features: ['raytracing', 'ai_accel'],
      }),
      m('t9c', 'TG {s}90 Chip', 'enthusiast', 820, 100, 88, 90, {
        powerDraw: 400,
        requiredTech: 'gpu_board_partner',
        features: ['raytracing', 'ai_accel'],
      }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Mobile Chips
// ---------------------------------------------------------------------------
const SOC_FAMILIES: ComponentFamilyDef[] = [
  {
    id: 'lumen-phone',
    manufacturerId: 'lumen',
    type: 'soc',
    formFactor: 'phone',
    volume: 0.005,
    leadTimeDays: 10,
    monthlySupply: 30_000_000,
    cadenceDays: 400,
    seriesStart: 5,
    seriesStep: 1,
    models: [
      m('l5', 'Lumen L{s}5', 'budget', 32, 28, 64, 84, { powerDraw: 5 }),
      m('l7', 'Lumen L{s}7', 'mainstream', 49, 40, 66, 84, { powerDraw: 5.5 }),
    ],
  },
  {
    id: 'kestrel-phone',
    manufacturerId: 'kestrel',
    type: 'soc',
    formFactor: 'phone',
    volume: 0.005,
    leadTimeDays: 12,
    monthlySupply: 45_000_000,
    cadenceDays: 380,
    seriesStart: 9,
    seriesStep: 1,
    models: [
      m('k6', 'K{s}600', 'budget', 48, 38, 74, 90, { powerDraw: 5.5 }),
      m('k8', 'K{s}800', 'mainstream', 92, 58, 78, 90, { powerDraw: 6.5 }),
      m('k10', 'K{s}990', 'performance', 175, 88, 82, 89, { powerDraw: 8.5, features: ['ai_accel'] }),
    ],
  },
  {
    id: 'nova-mobile-phone',
    manufacturerId: 'nova_mobile',
    type: 'soc',
    formFactor: 'phone',
    volume: 0.005,
    leadTimeDays: 14,
    monthlySupply: 40_000_000,
    cadenceDays: 365,
    seriesStart: 3,
    seriesStep: 1,
    models: [
      m('nm7', 'NM Core Gen {s}', 'mainstream', 85, 56, 80, 92, { powerDraw: 6.5 }),
      m('nm8', 'NM Pro Gen {s}', 'performance', 145, 78, 84, 92, { powerDraw: 7.5, features: ['ai_accel'] }),
      m('nm9', 'NM Elite Gen {s}', 'enthusiast', 209, 100, 88, 91, { powerDraw: 9, features: ['ai_accel'] }),
    ],
  },
  {
    id: 'kestrel-wearable',
    manufacturerId: 'kestrel',
    type: 'soc',
    formFactor: 'wearable',
    volume: 0.002,
    leadTimeDays: 12,
    monthlySupply: 8_000_000,
    cadenceDays: 540,
    seriesStart: 3,
    seriesStep: 1,
    models: [m('kw', 'Kestrel W{s}', 'mainstream', 18, 60, 76, 90, { powerDraw: 0.8 })],
  },
  {
    id: 'nova-mobile-wearable',
    manufacturerId: 'nova_mobile',
    type: 'soc',
    formFactor: 'wearable',
    volume: 0.002,
    leadTimeDays: 14,
    monthlySupply: 6_000_000,
    cadenceDays: 500,
    seriesStart: 2,
    seriesStep: 1,
    models: [m('nmw', 'NM Watch Gen {s}', 'performance', 29, 100, 86, 92, { powerDraw: 1, features: ['ai_accel'] })],
  },
  {
    id: 'lumen-wearable',
    manufacturerId: 'lumen',
    type: 'soc',
    formFactor: 'wearable',
    volume: 0.002,
    leadTimeDays: 10,
    monthlySupply: 10_000_000,
    cadenceDays: 600,
    seriesStart: 1,
    seriesStep: 1,
    models: [m('lw', 'Lumen W{s}', 'budget', 11, 40, 62, 84, { powerDraw: 0.7 })],
  },
];

// ---------------------------------------------------------------------------
// Speicher
// ---------------------------------------------------------------------------
interface MemoryVendor {
  manufacturerId: string;
  priceFactor: number;
  quality: number;
  reliability: number;
  perfFactor: number;
  supplyFactor: number;
}

const MEMORY_VENDORS: MemoryVendor[] = [
  { manufacturerId: 'memorycore', priceFactor: 1, quality: 80, reliability: 90, perfFactor: 1, supplyFactor: 1 },
  { manufacturerId: 'kairo', priceFactor: 1.14, quality: 90, reliability: 96, perfFactor: 1.04, supplyFactor: 0.6 },
  { manufacturerId: 'stratos', priceFactor: 0.84, quality: 66, reliability: 82, perfFactor: 0.96, supplyFactor: 1.3 },
];

function memoryFamilies(
  suffix: string,
  type: ComponentType,
  formFactor: FormFactor,
  volume: number,
  memoryTypes: string[],
  tiers: { key: string; capacityGb: number; priceEur: number; performance: number; tier: Tier; power: number }[],
  monthlySupply: number,
  extraFeatures: FeatureId[] = [],
): ComponentFamilyDef[] {
  return MEMORY_VENDORS.map((vendor) => ({
    id: `${vendor.manufacturerId}-${suffix}`,
    manufacturerId: vendor.manufacturerId,
    type,
    formFactor,
    volume,
    leadTimeDays: 10,
    monthlySupply: Math.round(monthlySupply * vendor.supplyFactor),
    cadenceDays: 1_100,
    capacityScaling: true,
    memoryTypes,
    models: tiers.map((t) =>
      m(t.key, '{mt} {cap}', t.tier, Math.round(t.priceEur * vendor.priceFactor * 100) / 100, Math.round(t.performance * vendor.perfFactor), vendor.quality, vendor.reliability, {
        powerDraw: t.power,
        specs: { capacityGb: t.capacityGb, memoryType: memoryTypes[0] },
        features: extraFeatures,
      }),
    ),
  }));
}

const MEMORY_FAMILIES: ComponentFamilyDef[] = [
  ...memoryFamilies(
    'ram-desktop',
    'ram',
    'desktop',
    0.02,
    ['DDR5', 'DDR6', 'DDR7', 'DDR8'],
    [
      { key: 'r8', capacityGb: 8, priceEur: 27, performance: 38, tier: 'budget', power: 3 },
      { key: 'r16', capacityGb: 16, priceEur: 49, performance: 56, tier: 'mainstream', power: 4 },
      { key: 'r32', capacityGb: 32, priceEur: 92, performance: 78, tier: 'performance', power: 6 },
      { key: 'r64', capacityGb: 64, priceEur: 179, performance: 100, tier: 'enthusiast', power: 9 },
    ],
    3_000_000,
  ),
  ...memoryFamilies(
    'ram-mobile',
    'ram',
    'mobile',
    0.01,
    ['LPDDR5X', 'LPDDR6', 'LPDDR7', 'LPDDR8'],
    [
      { key: 'rm8', capacityGb: 8, priceEur: 29, performance: 38, tier: 'budget', power: 2 },
      { key: 'rm16', capacityGb: 16, priceEur: 52, performance: 56, tier: 'mainstream', power: 2.5 },
      { key: 'rm32', capacityGb: 32, priceEur: 98, performance: 78, tier: 'performance', power: 3.5 },
      { key: 'rm64', capacityGb: 64, priceEur: 190, performance: 100, tier: 'enthusiast', power: 5 },
    ],
    4_000_000,
  ),
  ...memoryFamilies(
    'ram-phone',
    'ram',
    'phone',
    0.001,
    ['LPDDR5', 'LPDDR6', 'LPDDR7', 'LPDDR8'],
    [
      { key: 'rp6', capacityGb: 6, priceEur: 17, performance: 50, tier: 'budget', power: 0.3 },
      { key: 'rp8', capacityGb: 8, priceEur: 22, performance: 62, tier: 'mainstream', power: 0.35 },
      { key: 'rp12', capacityGb: 12, priceEur: 33, performance: 80, tier: 'performance', power: 0.45 },
      { key: 'rp16', capacityGb: 16, priceEur: 45, performance: 100, tier: 'enthusiast', power: 0.55 },
    ],
    60_000_000,
  ),
  ...memoryFamilies(
    'ram-server',
    'ram',
    'server',
    0.02,
    ['DDR5 ECC', 'DDR6 ECC', 'DDR7 ECC', 'DDR8 ECC'],
    [
      { key: 'rs32', capacityGb: 32, priceEur: 140, performance: 45, tier: 'budget', power: 5 },
      { key: 'rs64', capacityGb: 64, priceEur: 260, performance: 62, tier: 'mainstream', power: 7 },
      { key: 'rs128', capacityGb: 128, priceEur: 510, performance: 80, tier: 'performance', power: 10 },
      { key: 'rs256', capacityGb: 256, priceEur: 990, performance: 100, tier: 'enthusiast', power: 14 },
    ],
    800_000,
    ['ecc'],
  ),
  ...memoryFamilies(
    'vram',
    'vram',
    'gpu_board',
    0.005,
    ['GDDR6', 'GDDR7', 'GDDR8', 'GDDR9'],
    [
      { key: 'v8', capacityGb: 8, priceEur: 28, performance: 45, tier: 'budget', power: 12 },
      { key: 'v12', capacityGb: 12, priceEur: 40, performance: 62, tier: 'mainstream', power: 16 },
      { key: 'v16', capacityGb: 16, priceEur: 55, performance: 80, tier: 'performance', power: 20 },
      { key: 'v24', capacityGb: 24, priceEur: 85, performance: 100, tier: 'enthusiast', power: 28 },
    ],
    1_500_000,
  ),
  ...memoryFamilies(
    'ssd',
    'storage',
    'm2',
    0.02,
    ['NVMe', 'NVMe Gen5', 'NVMe Gen6', 'NVMe Gen7'],
    [
      { key: 's256', capacityGb: 256, priceEur: 25, performance: 30, tier: 'budget', power: 3 },
      { key: 's512', capacityGb: 512, priceEur: 36, performance: 48, tier: 'budget', power: 3.5 },
      { key: 's1t', capacityGb: 1024, priceEur: 58, performance: 66, tier: 'mainstream', power: 4.5 },
      { key: 's2t', capacityGb: 2048, priceEur: 105, performance: 84, tier: 'performance', power: 5.5 },
      { key: 's4t', capacityGb: 4096, priceEur: 205, performance: 100, tier: 'enthusiast', power: 7 },
    ],
    5_000_000,
  ),
  ...memoryFamilies(
    'ufs',
    'storage',
    'ufs',
    0.001,
    ['UFS 4.0', 'UFS 5.0', 'UFS 6.0', 'UFS 7.0'],
    [
      { key: 'u128', capacityGb: 128, priceEur: 12, performance: 45, tier: 'budget', power: 0.3 },
      { key: 'u256', capacityGb: 256, priceEur: 20, performance: 62, tier: 'mainstream', power: 0.35 },
      { key: 'u512', capacityGb: 512, priceEur: 36, performance: 80, tier: 'performance', power: 0.4 },
      { key: 'u1t', capacityGb: 1024, priceEur: 68, performance: 100, tier: 'enthusiast', power: 0.5 },
    ],
    60_000_000,
  ),
];

// ---------------------------------------------------------------------------
// Displays
// ---------------------------------------------------------------------------
type Panel = 'IPS' | 'VA' | 'LCD' | 'OLED' | 'LTPO-OLED' | 'Mini-LED';
interface PanelSpec {
  key: string;
  size: number;
  res: 'HD' | 'FHD' | 'FHD+' | 'QHD' | 'QHD+' | 'UWQHD' | 'UHD';
  hz: number;
  panel: Panel;
}

const RES_INFO: Record<PanelSpec['res'], { label: string; mp: number; score: number; price: number; power: number }> = {
  HD: { label: '1366x768', mp: 1.05, score: 20, price: 0.8, power: 0.9 },
  FHD: { label: '1920x1080', mp: 2.07, score: 40, price: 1, power: 1 },
  'FHD+': { label: '2400x1080', mp: 2.59, score: 42, price: 1, power: 1 },
  QHD: { label: '2560x1440', mp: 3.69, score: 60, price: 1.5, power: 1.15 },
  'QHD+': { label: '3120x1440', mp: 4.49, score: 62, price: 1.55, power: 1.2 },
  UWQHD: { label: '3440x1440', mp: 4.95, score: 64, price: 1.9, power: 1.25 },
  UHD: { label: '3840x2160', mp: 8.29, score: 75, price: 2.2, power: 1.4 },
};

const PANEL_INFO: Record<Panel, { score: number; price: number; power: number; features: FeatureId[]; tech?: string }> = {
  LCD: { score: -4, price: 0.9, power: 1.05, features: [] },
  IPS: { score: 0, price: 1, power: 1, features: [] },
  VA: { score: -2, price: 0.95, power: 1, features: [] },
  OLED: { score: 18, price: 1.9, power: 0.8, features: ['oled'], tech: 'oled_integration' },
  'LTPO-OLED': { score: 24, price: 2.4, power: 0.65, features: ['oled', 'ltpo'], tech: 'ltpo_displays' },
  'Mini-LED': { score: 14, price: 1.7, power: 1.2, features: ['miniled'], tech: 'miniled_integration' },
};

function refreshScore(hz: number): number {
  if (hz >= 240) return 22;
  if (hz >= 165) return 18;
  if (hz >= 144) return 15;
  if (hz >= 120) return 12;
  if (hz >= 90) return 7;
  if (hz >= 75) return 3;
  return 0;
}

function refreshPrice(hz: number): number {
  if (hz >= 240) return 1.45;
  if (hz >= 165) return 1.25;
  if (hz >= 144) return 1.2;
  if (hz >= 120) return 1.15;
  if (hz >= 90) return 1.08;
  return 1;
}

function displayFamily(
  id: string,
  manufacturerId: string,
  formFactor: FormFactor,
  baseScore: number,
  pricePerInch: number,
  powerPerInch: number,
  vendor: { quality: number; reliability: number; priceFactor: number; scoreBonus: number },
  volume: number,
  panels: PanelSpec[],
  techRequiredFor: Panel[] = ['OLED', 'LTPO-OLED', 'Mini-LED'],
): ComponentFamilyDef {
  return {
    id,
    manufacturerId,
    type: 'display',
    formFactor,
    volume,
    leadTimeDays: 14,
    monthlySupply: formFactor === 'phone' ? 20_000_000 : formFactor === 'monitor' ? 1_500_000 : 3_000_000,
    cadenceDays: 730,
    models: panels.map((p) => {
      const res = RES_INFO[p.res];
      const panel = PANEL_INFO[p.panel];
      const score = Math.min(100, baseScore + res.score + refreshScore(p.hz) + panel.score + vendor.scoreBonus);
      const price = p.size * pricePerInch * res.price * refreshPrice(p.hz) * panel.price * vendor.priceFactor;
      const power = p.size * powerPerInch * res.power * (1 + (p.hz - 60) / 400) * panel.power;
      const sizeLabel = String(p.size).replace('.', ',');
      const hzLabel = p.hz >= 90 ? ` ${p.hz} Hz` : ` ${p.hz} Hz`;
      const tier: Tier = score >= 90 ? 'enthusiast' : score >= 72 ? 'performance' : score >= 52 ? 'mainstream' : 'budget';
      const features = [...panel.features];
      if (p.hz >= 144) features.push('high_refresh');
      return m(p.key, `${sizeLabel}" ${p.res} ${p.panel}${hzLabel}{rev}`, tier, Math.round(price * 100) / 100, score, vendor.quality, vendor.reliability, {
        powerDraw: Math.round(power * 100) / 100,
        specs: { sizeInch: p.size, resolution: res.label, megapixels: res.mp, refreshHz: p.hz, panel: p.panel },
        features,
        requiredTech: techRequiredFor.includes(p.panel) ? panel.tech : undefined,
      });
    }),
  };
}

const LUMINA = { quality: 70, reliability: 86, priceFactor: 0.85, scoreBonus: -5 };
const CLEARVIEW = { quality: 86, reliability: 92, priceFactor: 1.1, scoreBonus: 3 };
const AURORA = { quality: 90, reliability: 90, priceFactor: 1.15, scoreBonus: 5 };

const DISPLAY_FAMILIES: ComponentFamilyDef[] = [
  displayFamily('lumina-laptop', 'lumina', 'mobile', 5, 2.7, 0.4, LUMINA, 0.3, [
    { key: 'l14f', size: 14, res: 'FHD', hz: 60, panel: 'IPS' },
    { key: 'l156f', size: 15.6, res: 'FHD', hz: 60, panel: 'IPS' },
    { key: 'l156f144', size: 15.6, res: 'FHD', hz: 144, panel: 'IPS' },
    { key: 'l16q120', size: 16, res: 'QHD', hz: 120, panel: 'IPS' },
    { key: 'l173f144', size: 17.3, res: 'FHD', hz: 144, panel: 'IPS' },
    { key: 'l16q240', size: 16, res: 'QHD', hz: 240, panel: 'IPS' },
  ]),
  displayFamily('clearview-laptop', 'clearview', 'mobile', 5, 2.7, 0.4, CLEARVIEW, 0.3, [
    { key: 'c14f', size: 14, res: 'FHD', hz: 60, panel: 'IPS' },
    { key: 'c14q120', size: 14, res: 'QHD', hz: 120, panel: 'IPS' },
    { key: 'c156f144', size: 15.6, res: 'FHD', hz: 144, panel: 'IPS' },
    { key: 'c16q144', size: 16, res: 'QHD', hz: 144, panel: 'IPS' },
    { key: 'c16q240', size: 16, res: 'QHD', hz: 240, panel: 'IPS' },
    { key: 'c16u120', size: 16, res: 'UHD', hz: 120, panel: 'IPS' },
    { key: 'c173q240', size: 17.3, res: 'QHD', hz: 240, panel: 'IPS' },
  ]),
  displayFamily('aurora-laptop', 'aurora', 'mobile', 5, 2.7, 0.4, AURORA, 0.3, [
    { key: 'a14qo', size: 14, res: 'QHD', hz: 120, panel: 'OLED' },
    { key: 'a16qo240', size: 16, res: 'QHD', hz: 240, panel: 'OLED' },
    { key: 'a16uo', size: 16, res: 'UHD', hz: 120, panel: 'OLED' },
    { key: 'a16qm240', size: 16, res: 'QHD', hz: 240, panel: 'Mini-LED' },
    { key: 'a173um', size: 17.3, res: 'UHD', hz: 144, panel: 'Mini-LED' },
  ]),
  displayFamily('lumina-phone', 'lumina', 'phone', 18, 1.9, 0.12, LUMINA, 0.02, [
    { key: 'lp64', size: 6.4, res: 'FHD+', hz: 60, panel: 'LCD' },
    { key: 'lp64h', size: 6.4, res: 'FHD+', hz: 90, panel: 'LCD' },
    { key: 'lp67h', size: 6.7, res: 'FHD+', hz: 90, panel: 'LCD' },
  ], ['LTPO-OLED']),
  displayFamily('clearview-phone', 'clearview', 'phone', 18, 1.9, 0.12, CLEARVIEW, 0.02, [
    { key: 'cp61o', size: 6.1, res: 'FHD+', hz: 120, panel: 'OLED' },
    { key: 'cp67o', size: 6.7, res: 'FHD+', hz: 120, panel: 'OLED' },
  ], ['LTPO-OLED']),
  displayFamily('aurora-phone', 'aurora', 'phone', 18, 1.9, 0.12, AURORA, 0.02, [
    { key: 'ap61o', size: 6.1, res: 'FHD+', hz: 120, panel: 'OLED' },
    { key: 'ap67o', size: 6.7, res: 'FHD+', hz: 120, panel: 'OLED' },
    { key: 'ap67l', size: 6.7, res: 'QHD+', hz: 120, panel: 'LTPO-OLED' },
  ], ['LTPO-OLED']),
  displayFamily('lumina-tablet', 'lumina', 'tablet', 12, 1.9, 0.35, LUMINA, 0.05, [
    { key: 'lt109', size: 10.9, res: 'FHD', hz: 60, panel: 'LCD' },
    { key: 'lt11q', size: 11, res: 'QHD', hz: 120, panel: 'LCD' },
  ], ['LTPO-OLED']),
  displayFamily('clearview-tablet', 'clearview', 'tablet', 12, 1.9, 0.35, CLEARVIEW, 0.05, [
    { key: 'ct11q', size: 11, res: 'QHD', hz: 120, panel: 'IPS' },
    { key: 'ct13q', size: 13, res: 'QHD', hz: 120, panel: 'IPS' },
  ], ['LTPO-OLED']),
  displayFamily('aurora-tablet', 'aurora', 'tablet', 12, 1.9, 0.35, AURORA, 0.05, [
    { key: 'at11o', size: 11, res: 'QHD', hz: 120, panel: 'OLED' },
    { key: 'at13o', size: 13, res: 'QHD', hz: 120, panel: 'OLED' },
    { key: 'at13m', size: 13, res: 'QHD', hz: 120, panel: 'Mini-LED' },
  ]),
  displayFamily('lumina-monitor', 'lumina', 'monitor', 5, 1.9, 1, LUMINA, 1, [
    { key: 'lm24f75', size: 24, res: 'FHD', hz: 75, panel: 'VA' },
    { key: 'lm24f165', size: 24, res: 'FHD', hz: 165, panel: 'IPS' },
    { key: 'lm27q75', size: 27, res: 'QHD', hz: 75, panel: 'IPS' },
    { key: 'lm27q165', size: 27, res: 'QHD', hz: 165, panel: 'IPS' },
    { key: 'lm34uw', size: 34, res: 'UWQHD', hz: 165, panel: 'VA' },
  ]),
  displayFamily('clearview-monitor', 'clearview', 'monitor', 5, 1.9, 1, CLEARVIEW, 1, [
    { key: 'cm27q165', size: 27, res: 'QHD', hz: 165, panel: 'IPS' },
    { key: 'cm27u60', size: 27, res: 'UHD', hz: 60, panel: 'IPS' },
    { key: 'cm27u144', size: 27, res: 'UHD', hz: 144, panel: 'IPS' },
    { key: 'cm32u144', size: 32, res: 'UHD', hz: 144, panel: 'IPS' },
  ]),
  displayFamily('aurora-monitor', 'aurora', 'monitor', 5, 1.9, 1, AURORA, 1, [
    { key: 'am27qo', size: 27, res: 'QHD', hz: 240, panel: 'OLED' },
    { key: 'am32uo', size: 32, res: 'UHD', hz: 240, panel: 'OLED' },
    { key: 'am32um', size: 32, res: 'UHD', hz: 144, panel: 'Mini-LED' },
  ]),
  displayFamily('lumina-wearable', 'lumina', 'wearable', 30, 3.2, 0.2, LUMINA, 0.005, [
    { key: 'lw18', size: 1.8, res: 'HD', hz: 60, panel: 'LCD' },
  ], ['LTPO-OLED']),
  displayFamily('clearview-wearable', 'clearview', 'wearable', 30, 3.2, 0.2, CLEARVIEW, 0.005, [
    { key: 'cw19', size: 1.9, res: 'HD', hz: 60, panel: 'OLED' },
  ], ['LTPO-OLED']),
  displayFamily('aurora-wearable', 'aurora', 'wearable', 30, 3.2, 0.2, AURORA, 0.005, [
    { key: 'aw19', size: 1.9, res: 'HD', hz: 60, panel: 'LTPO-OLED' },
  ], ['LTPO-OLED']),
];

// ---------------------------------------------------------------------------
// Akkus & Kameras
// ---------------------------------------------------------------------------
interface CellVendor {
  manufacturerId: string;
  pricePerWh: number;
  quality: number;
  reliability: number;
  perfBonus: number;
}

const CELL_VENDORS: CellVendor[] = [
  { manufacturerId: 'voltaris', pricePerWh: 0.55, quality: 70, reliability: 84, perfBonus: 0 },
  { manufacturerId: 'ionix', pricePerWh: 0.8, quality: 88, reliability: 96, perfBonus: 3 },
  { manufacturerId: 'nordcell', pricePerWh: 0.85, quality: 86, reliability: 94, perfBonus: 2 },
];

function batteryFamilies(
  suffix: string,
  formFactor: FormFactor,
  volume: number,
  sizes: { key: string; wh: number; mah?: number }[],
  maxWh: number,
  priceBase: number,
  priceFactor: number,
): ComponentFamilyDef[] {
  return CELL_VENDORS.map((vendor) => ({
    id: `${vendor.manufacturerId}-${suffix}`,
    manufacturerId: vendor.manufacturerId,
    type: 'battery' as const,
    formFactor,
    volume,
    leadTimeDays: 12,
    monthlySupply: formFactor === 'phone' ? 25_000_000 : 3_000_000,
    cadenceDays: 900,
    models: sizes.map((s) => {
      const perf = Math.min(100, Math.round((s.wh / maxWh) * 100) + vendor.perfBonus);
      const label = s.mah ? `${s.mah.toLocaleString('de-DE')} mAh` : `${s.wh} Wh`;
      const tier: Tier = perf >= 92 ? 'enthusiast' : perf >= 78 ? 'performance' : perf >= 60 ? 'mainstream' : 'budget';
      return m(s.key, `Akku ${label}{rev}`, tier, Math.round((priceBase + s.wh * vendor.pricePerWh * priceFactor) * 100) / 100, perf, vendor.quality, vendor.reliability, {
        specs: { capacityWh: s.wh, capacityMah: s.mah },
      });
    }),
  }));
}

const phoneWh = (mah: number) => Math.round(mah * 3.87) / 1000;

const BATTERY_FAMILIES: ComponentFamilyDef[] = [
  ...batteryFamilies(
    'laptop',
    'mobile',
    0.05,
    [
      { key: 'b45', wh: 45 },
      { key: 'b56', wh: 56 },
      { key: 'b70', wh: 70 },
      { key: 'b80', wh: 80 },
      { key: 'b99', wh: 99 },
    ],
    99,
    0,
    1,
  ),
  ...batteryFamilies(
    'phone',
    'phone',
    0.01,
    [3500, 4000, 4500, 5000, 5500].map((mah) => ({ key: `p${mah}`, wh: phoneWh(mah), mah })),
    phoneWh(5500),
    2,
    0.65,
  ),
  ...batteryFamilies(
    'tablet',
    'tablet',
    0.02,
    [6000, 8000, 10000].map((mah) => ({ key: `t${mah}`, wh: phoneWh(mah), mah })),
    phoneWh(10000),
    3,
    0.6,
  ),
  ...batteryFamilies(
    'wearable',
    'wearable',
    0.002,
    [300, 400, 500].map((mah) => ({ key: `w${mah}`, wh: phoneWh(mah), mah })),
    phoneWh(500),
    2.2,
    0.9,
  ),
];

const CAMERA_FAMILIES: ComponentFamilyDef[] = [
  {
    id: 'optiq-phone',
    manufacturerId: 'optiq',
    type: 'camera',
    formFactor: 'phone',
    volume: 0.002,
    leadTimeDays: 14,
    monthlySupply: 15_000_000,
    cadenceDays: 730,
    models: [
      m('o12', '12 MP Sensor{rev}', 'mainstream', 9, 55, 84, 94, { specs: { cameraMp: 12 }, powerDraw: 0.2 }),
      m('o50', '50 MP Sensor{rev}', 'performance', 18, 80, 90, 94, { specs: { cameraMp: 50 }, powerDraw: 0.25 }),
      m('o200', '200 MP Periskop-System{rev}', 'enthusiast', 34, 100, 94, 92, { specs: { cameraMp: 200 }, powerDraw: 0.35, features: ['periscope'] }),
    ],
  },
  {
    id: 'pixelforge-phone',
    manufacturerId: 'pixelforge',
    type: 'camera',
    formFactor: 'phone',
    volume: 0.002,
    leadTimeDays: 10,
    monthlySupply: 25_000_000,
    cadenceDays: 730,
    models: [
      m('p13', '13 MP Sensor{rev}', 'budget', 5, 40, 66, 86, { specs: { cameraMp: 13 }, powerDraw: 0.2 }),
      m('p48', '48 MP Sensor{rev}', 'mainstream', 9, 60, 70, 86, { specs: { cameraMp: 48 }, powerDraw: 0.25 }),
      m('p108', '108 MP Sensor{rev}', 'performance', 15, 72, 72, 85, { specs: { cameraMp: 108 }, powerDraw: 0.3 }),
    ],
  },
  {
    id: 'pixelforge-webcam',
    manufacturerId: 'pixelforge',
    type: 'camera',
    formFactor: 'mobile',
    volume: 0.002,
    leadTimeDays: 10,
    monthlySupply: 10_000_000,
    models: [m('w720', 'Webcam 720p', 'budget', 3, 30, 62, 88, { specs: { cameraMp: 1 } })],
  },
  {
    id: 'optiq-webcam',
    manufacturerId: 'optiq',
    type: 'camera',
    formFactor: 'mobile',
    volume: 0.002,
    leadTimeDays: 14,
    monthlySupply: 6_000_000,
    models: [
      m('w1080', 'Webcam 1080p', 'mainstream', 6, 60, 84, 94, { specs: { cameraMp: 2 } }),
      m('w1440', 'Webcam 1440p mit IR', 'performance', 11, 85, 90, 94, { specs: { cameraMp: 4 } }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Plattform: Mainboards, Chipsätze, Wafer, Platinen
// ---------------------------------------------------------------------------
const PLATFORM_FAMILIES: ComponentFamilyDef[] = [
  {
    id: 'boardworks-desktop',
    manufacturerId: 'boardworks',
    type: 'mainboard',
    formFactor: 'desktop',
    volume: 0.25,
    leadTimeDays: 10,
    monthlySupply: 1_500_000,
    cadenceDays: 540,
    seriesStart: 6,
    seriesStep: 1,
    models: [
      m('bb', 'B{s}10M', 'budget', 69, 70, 70, 86, { powerDraw: 8 }),
      m('bm', 'B{s}50', 'mainstream', 119, 80, 76, 88, { powerDraw: 10 }),
      m('bp', 'B{s}70 Pro', 'performance', 189, 90, 80, 89, { powerDraw: 12, features: ['pcie5'] }),
    ],
  },
  {
    id: 'circuitra-desktop',
    manufacturerId: 'circuitra',
    type: 'mainboard',
    formFactor: 'desktop',
    volume: 0.25,
    leadTimeDays: 14,
    monthlySupply: 700_000,
    cadenceDays: 540,
    seriesStart: 6,
    seriesStep: 1,
    models: [
      m('cm', 'C{s}60', 'mainstream', 139, 82, 84, 93, { powerDraw: 10 }),
      m('ce', 'C{s}80 Elite', 'enthusiast', 299, 100, 92, 94, { powerDraw: 14, features: ['pcie5', 'wifi7'] }),
    ],
  },
  {
    id: 'boardworks-mobile',
    manufacturerId: 'boardworks',
    type: 'mainboard',
    formFactor: 'mobile',
    volume: 0.05,
    leadTimeDays: 14,
    monthlySupply: 2_000_000,
    cadenceDays: 540,
    seriesStart: 6,
    seriesStep: 1,
    models: [
      m('nbb', 'Notebook-Board NB{s}', 'budget', 65, 75, 72, 87, { powerDraw: 3 }),
      m('nbp', 'Notebook-Board NB{s} Pro', 'performance', 110, 90, 80, 89, { powerDraw: 4 }),
    ],
  },
  {
    id: 'circuitra-mobile',
    manufacturerId: 'circuitra',
    type: 'mainboard',
    formFactor: 'mobile',
    volume: 0.05,
    leadTimeDays: 14,
    monthlySupply: 900_000,
    cadenceDays: 540,
    seriesStart: 6,
    seriesStep: 1,
    models: [m('nbx', 'NB-X{s} Elite', 'enthusiast', 150, 100, 90, 94, { powerDraw: 4 })],
  },
  {
    id: 'boardworks-server',
    manufacturerId: 'boardworks',
    type: 'mainboard',
    formFactor: 'server',
    volume: 0.35,
    leadTimeDays: 21,
    monthlySupply: 200_000,
    cadenceDays: 600,
    seriesStart: 3,
    seriesStep: 1,
    models: [m('sb', 'Server-Board SB{s}', 'mainstream', 290, 80, 80, 92, { powerDraw: 25 })],
  },
  {
    id: 'circuitra-server',
    manufacturerId: 'circuitra',
    type: 'mainboard',
    formFactor: 'server',
    volume: 0.35,
    leadTimeDays: 21,
    monthlySupply: 120_000,
    cadenceDays: 600,
    seriesStart: 3,
    seriesStep: 1,
    models: [m('sbx', 'SB-X{s} Enterprise', 'enthusiast', 420, 100, 92, 96, { powerDraw: 30 })],
  },
  {
    id: 'arcadia-chipset',
    manufacturerId: 'arcadia',
    type: 'chipset',
    formFactor: 'desktop',
    volume: 0.002,
    leadTimeDays: 14,
    monthlySupply: 800_000,
    cadenceDays: 540,
    seriesStart: 5,
    seriesStep: 1,
    models: [m('ac', 'A{s}20 Chipsatz', 'budget', 12, 60, 64, 84, { powerDraw: 5, requiredTech: 'mainboard_design' })],
  },
  {
    id: 'novasilicon-chipset',
    manufacturerId: 'novasilicon',
    type: 'chipset',
    formFactor: 'desktop',
    volume: 0.002,
    leadTimeDays: 14,
    monthlySupply: 1_200_000,
    cadenceDays: 450,
    seriesStart: 7,
    seriesStep: 1,
    models: [m('nc', 'N{s}70 Chipsatz', 'mainstream', 28, 82, 78, 91, { powerDraw: 7, requiredTech: 'mainboard_design' })],
  },
  {
    id: 'quantumcore-chipset',
    manufacturerId: 'quantumcore',
    type: 'chipset',
    formFactor: 'desktop',
    volume: 0.002,
    leadTimeDays: 14,
    monthlySupply: 900_000,
    cadenceDays: 400,
    seriesStart: 8,
    seriesStep: 1,
    models: [m('qc', 'Q{s}90 Chipsatz', 'enthusiast', 38, 100, 84, 89, { powerDraw: 8, requiredTech: 'mainboard_design', features: ['pcie5'] })],
  },
  {
    id: 'eurofab-wafer',
    manufacturerId: 'eurofab',
    type: 'wafer',
    formFactor: 'chip',
    volume: 0.001,
    leadTimeDays: 60,
    monthlySupply: 600_000,
    cadenceDays: 900,
    models: [m('e7', '7-nm-Fertigung (pro Chip){rev}', 'mainstream', 28, 55, 80, 90, { specs: { processNm: 7 }, requiredTech: 'cpu_design' })],
  },
  {
    id: 'silica-wafer',
    manufacturerId: 'silica_foundry',
    type: 'wafer',
    formFactor: 'chip',
    volume: 0.001,
    leadTimeDays: 75,
    monthlySupply: 900_000,
    cadenceDays: 730,
    models: [
      m('s5', '5-nm-Fertigung (pro Chip){rev}', 'performance', 45, 78, 88, 93, { specs: { processNm: 5 }, requiredTech: 'cpu_design' }),
      m('s3', '3-nm-Fertigung (pro Chip){rev}', 'enthusiast', 70, 100, 92, 92, { specs: { processNm: 3 }, requiredTech: 'advanced_nodes' }),
    ],
  },
  {
    id: 'boardworks-pcb',
    manufacturerId: 'boardworks',
    type: 'pcb',
    formFactor: 'gpu_board',
    volume: 0.05,
    leadTimeDays: 10,
    monthlySupply: 3_000_000,
    models: [
      m('pg8', 'Grafikkarten-PCB 8 Lagen', 'mainstream', 18, 70, 74, 88, { specs: { layers: 8 } }),
      m('pg12', 'Grafikkarten-PCB 12 Lagen', 'enthusiast', 32, 95, 84, 92, { specs: { layers: 12 } }),
    ],
  },
  {
    id: 'boardworks-pcb-desktop',
    manufacturerId: 'boardworks',
    type: 'pcb',
    formFactor: 'desktop',
    volume: 0.05,
    leadTimeDays: 10,
    monthlySupply: 3_000_000,
    models: [
      m('pd6', 'Mainboard-PCB 6 Lagen', 'budget', 15, 65, 72, 88, { specs: { layers: 6 } }),
      m('pd8', 'Mainboard-PCB 8 Lagen', 'mainstream', 26, 82, 78, 90, { specs: { layers: 8 } }),
    ],
  },
  {
    id: 'circuitra-pcb-desktop',
    manufacturerId: 'circuitra',
    type: 'pcb',
    formFactor: 'desktop',
    volume: 0.05,
    leadTimeDays: 14,
    monthlySupply: 1_000_000,
    models: [m('pd10', 'Mainboard-PCB 10 Lagen', 'enthusiast', 40, 100, 92, 95, { specs: { layers: 10 } })],
  },
];

// ---------------------------------------------------------------------------
// Standardteile
// ---------------------------------------------------------------------------
function simpleFamily(
  id: string,
  manufacturerId: string,
  type: ComponentType,
  formFactor: FormFactor,
  volume: number,
  models: ComponentModelDef[],
  monthlySupply = 5_000_000,
  leadTimeDays = 7,
): ComponentFamilyDef {
  return { id, manufacturerId, type, formFactor, volume, leadTimeDays, monthlySupply, models };
}

const psu = (key: string, watt: number, rating: string, price: number, quality: number, reliability: number, tier: Tier) =>
  m(key, `${watt} W ${rating}`, tier, price, 50, quality, reliability, { specs: { wattage: watt, efficiencyRating: rating } });

const cooler = (
  key: string,
  label: string,
  level: 'standard' | 'performance' | 'extreme',
  coolingW: number,
  noiseFactor: number,
  price: number,
  quality: number,
  reliability: number,
  features: FeatureId[] = [],
) =>
  m(key, label, level === 'standard' ? 'budget' : level === 'performance' ? 'performance' : 'enthusiast', price, 50, quality, reliability, {
    specs: { level, coolingW, noiseFactor },
    features,
  });

const casing = (key: string, label: string, material: 'plastic' | 'aluminum' | 'premium', price: number, design: number, quality: number, reliability: number) =>
  m(key, label, material === 'plastic' ? 'budget' : material === 'aluminum' ? 'mainstream' : 'enthusiast', price, design, quality, reliability, {
    specs: { material },
  });

const STANDARD_FAMILIES: ComponentFamilyDef[] = [
  simpleFamily('joltech-psu', 'joltech', 'psu', 'desktop', 0.3, [
    psu('j450', 450, '80+ Bronze', 32, 64, 82, 'budget'),
    psu('j550', 550, '80+ Bronze', 38, 64, 82, 'budget'),
    psu('j650', 650, '80+ Gold', 55, 70, 85, 'mainstream'),
    psu('j750', 750, '80+ Gold', 62, 70, 85, 'mainstream'),
  ], 3_000_000),
  simpleFamily('stromfeld-psu', 'stromfeld', 'psu', 'desktop', 0.3, [
    psu('s650', 650, '80+ Gold', 79, 88, 95, 'mainstream'),
    psu('s850', 850, '80+ Gold', 109, 88, 95, 'performance'),
    psu('s1000', 1000, '80+ Platinum', 159, 92, 96, 'enthusiast'),
    psu('s1200', 1200, '80+ Platinum', 199, 92, 96, 'enthusiast'),
  ], 1_500_000),
  simpleFamily('joltech-psu-server', 'joltech', 'psu', 'server', 0.3, [psu('js1000', 1000, '80+ Platinum', 120, 74, 88, 'mainstream')], 400_000),
  simpleFamily('stromfeld-psu-server', 'stromfeld', 'psu', 'server', 0.3, [psu('ss1600', 1600, '80+ Titanium', 210, 92, 97, 'enthusiast')], 300_000),
  simpleFamily('polarflow-desktop', 'polarflow', 'cooler', 'desktop', 0.4, [
    cooler('pfs', 'Tower-Luftkühler (Standard)', 'standard', 150, 1.1, 18, 66, 86),
    cooler('pfp', 'Doppelturm-Kühler (Performance)', 'performance', 250, 0.9, 42, 72, 88),
  ]),
  simpleFamily('frostline-desktop', 'frostline', 'cooler', 'desktop', 0.4, [
    cooler('fls', 'Silent Tower (Standard)', 'standard', 160, 0.8, 29, 84, 94),
    cooler('flp', 'Dual Tower Silent (Performance)', 'performance', 260, 0.7, 65, 88, 95),
    cooler('fle', 'AIO-Wasserkühlung 360 mm (Extreme)', 'extreme', 420, 0.75, 119, 88, 90, ['liquid_cooling']),
  ]),
  simpleFamily('polarflow-mobile', 'polarflow', 'cooler', 'mobile', 0.05, [
    cooler('pms', 'Heatpipe-Kühlung (Standard)', 'standard', 45, 1.15, 12, 66, 88),
    cooler('pmp', 'Dual-Fan-Kühlung (Performance)', 'performance', 95, 1, 24, 72, 88),
    cooler('pme', 'Vapor Chamber (Extreme)', 'extreme', 150, 0.95, 42, 76, 88),
  ]),
  simpleFamily('frostline-mobile', 'frostline', 'cooler', 'mobile', 0.05, [
    cooler('fmp', 'Silent Dual-Fan (Performance)', 'performance', 90, 0.8, 32, 86, 94),
    cooler('fme', 'Vapor Chamber Pro (Extreme)', 'extreme', 170, 0.8, 58, 88, 94),
  ]),
  simpleFamily('polarflow-phone', 'polarflow', 'cooler', 'phone', 0.001, [
    cooler('pps', 'Graphitfolie (Standard)', 'standard', 6, 0, 1.2, 70, 96),
    cooler('ppp', 'Vapor Chamber (Performance)', 'performance', 9, 0, 3.5, 80, 96),
    cooler('ppe', 'Vapor Chamber XL (Extreme)', 'extreme', 12, 0, 6, 84, 95),
  ]),
  simpleFamily('polarflow-tablet', 'polarflow', 'cooler', 'tablet', 0.002, [
    cooler('pts', 'Graphitfolie (Standard)', 'standard', 8, 0, 2, 70, 96),
    cooler('ptp', 'Vapor Chamber (Performance)', 'performance', 12, 0, 5, 80, 96),
  ]),
  simpleFamily('polarflow-gpu', 'polarflow', 'cooler', 'gpu_board', 0.15, [
    cooler('pgd', 'Dual-Fan-Kühler (Standard)', 'standard', 220, 1.05, 22, 68, 86),
    cooler('pgt', 'Triple-Fan-Kühler (Performance)', 'performance', 350, 0.95, 38, 74, 88),
  ]),
  simpleFamily('frostline-gpu', 'frostline', 'cooler', 'gpu_board', 0.15, [
    cooler('fgt', 'Triple-Fan Silent (Performance)', 'performance', 380, 0.75, 55, 88, 94),
    cooler('fgh', 'Hybrid-Wasserkühlung (Extreme)', 'extreme', 500, 0.7, 95, 88, 90, ['liquid_cooling']),
  ]),
  simpleFamily('polarflow-server', 'polarflow', 'cooler', 'server', 0.2, [cooler('psv', 'Server-Kühlkörper 2U', 'standard', 400, 1.3, 35, 76, 92)]),
  simpleFamily('frostline-server', 'frostline', 'cooler', 'server', 0.2, [cooler('fsv', 'High-Flow-Serverkühlung', 'performance', 600, 1.1, 65, 88, 95)]),
  simpleFamily('shellcraft-desktop', 'shellcraft', 'case', 'desktop', 1, [
    casing('scp', 'Midi-Tower Kunststoff', 'plastic', 39, 45, 62, 86),
    casing('sca', 'Midi-Tower Aluminium', 'aluminum', 89, 66, 72, 90),
  ]),
  simpleFamily('formwerk-desktop', 'formwerk', 'case', 'desktop', 1, [
    casing('fwa', 'Silent Tower Aluminium', 'aluminum', 119, 72, 86, 94),
    casing('fwp', 'Premium-Tower Aluminium/Glas', 'premium', 189, 88, 90, 94),
  ]),
  simpleFamily('shellcraft-laptop', 'shellcraft', 'case', 'mobile', 0.2, [
    casing('slp', 'Notebook-Chassis Kunststoff', 'plastic', 28, 44, 60, 84),
    casing('sla', 'Notebook-Chassis Aluminium', 'aluminum', 62, 66, 72, 88),
  ]),
  simpleFamily('formwerk-laptop', 'formwerk', 'case', 'mobile', 0.2, [
    casing('fla', 'Aluminium-Unibody', 'aluminum', 79, 74, 86, 93),
    casing('flm', 'Magnesium-Unibody Premium', 'premium', 139, 90, 90, 93),
  ]),
  simpleFamily('shellcraft-phone', 'shellcraft', 'case', 'phone', 0.01, [
    casing('spp', 'Smartphone-Gehäuse Kunststoff', 'plastic', 6, 44, 60, 86),
    casing('spa', 'Smartphone-Rahmen Aluminium', 'aluminum', 14, 66, 72, 90),
  ]),
  simpleFamily('formwerk-phone', 'formwerk', 'case', 'phone', 0.01, [
    casing('fpa', 'Aluminium-Glas-Gehäuse', 'aluminum', 18, 74, 84, 92),
    casing('fpt', 'Titanrahmen mit Keramikglas', 'premium', 38, 92, 92, 94),
  ]),
  simpleFamily('shellcraft-tablet', 'shellcraft', 'case', 'tablet', 0.03, [
    casing('stp', 'Tablet-Gehäuse Kunststoff', 'plastic', 9, 44, 60, 86),
    casing('sta', 'Tablet-Gehäuse Aluminium', 'aluminum', 22, 66, 72, 90),
  ]),
  simpleFamily('formwerk-tablet', 'formwerk', 'case', 'tablet', 0.03, [casing('ftp', 'Tablet-Unibody Premium', 'premium', 45, 90, 90, 93)]),
  simpleFamily('shellcraft-monitor', 'shellcraft', 'case', 'monitor', 0.5, [
    casing('smp', 'Monitorgehäuse Kunststoff', 'plastic', 15, 44, 62, 88),
    casing('sma', 'Monitorgehäuse Aluminium', 'aluminum', 32, 66, 74, 91),
  ]),
  simpleFamily('formwerk-monitor', 'formwerk', 'case', 'monitor', 0.5, [casing('fmm', 'Design-Monitorgehäuse Premium', 'premium', 62, 88, 90, 94)]),
  simpleFamily('shellcraft-server', 'shellcraft', 'case', 'server', 1.2, [casing('ssr', 'Rack-Gehäuse 2U', 'aluminum', 110, 50, 76, 92)]),
  simpleFamily('formwerk-server', 'formwerk', 'case', 'server', 1.2, [casing('fsr', 'Rack-Gehäuse 2U Premium', 'premium', 180, 62, 90, 96)]),
  simpleFamily('shellcraft-wearable', 'shellcraft', 'case', 'wearable', 0.003, [
    casing('swp', 'Kunststoffgehäuse mit Silikonband', 'plastic', 4, 44, 60, 86),
    casing('swa', 'Aluminiumgehäuse mit Sportband', 'aluminum', 9, 68, 74, 90),
  ]),
  simpleFamily('formwerk-wearable', 'formwerk', 'case', 'wearable', 0.003, [casing('fwt', 'Titangehäuse mit Lederband', 'premium', 24, 90, 92, 94)]),
  simpleFamily('sonora-speakers-laptop', 'sonora', 'speakers', 'mobile', 0.005, [
    m('slap', 'Stereo-Lautsprecher', 'budget', 4, 50, 66, 92),
    m('slapp', 'Premium-Soundsystem (4 Treiber)', 'performance', 10, 85, 82, 92),
  ]),
  simpleFamily('sonora-speakers-phone', 'sonora', 'speakers', 'phone', 0.001, [
    m('sph', 'Mono-Lautsprecher', 'budget', 1.5, 40, 64, 94),
    m('spst', 'Stereo-Lautsprecher', 'mainstream', 3, 70, 78, 94),
  ]),
  simpleFamily('sonora-speakers-monitor', 'sonora', 'speakers', 'monitor', 0.02, [m('smon', 'Monitor-Lautsprecher 2×3 W', 'budget', 6, 50, 68, 94)]),
  simpleFamily('sonora-mic', 'sonora', 'microphone', 'universal', 0.001, [
    m('mstd', 'Mikrofon Standard', 'budget', 0.8, 45, 66, 96),
    m('marr', 'Beamforming-Mikrofonarray', 'performance', 2.5, 85, 84, 96),
  ], 50_000_000),
  simpleFamily('skylane-wifi', 'skylane', 'wifi', 'universal', 0.001, [
    m('wf6', 'WLAN 6', 'budget', 8, 50, 76, 94, { specs: { standard: 'Wi-Fi 6' } }),
    m('wf6e', 'WLAN 6E', 'mainstream', 11, 70, 80, 94, { specs: { standard: 'Wi-Fi 6E' } }),
    m('wf7', 'WLAN 7', 'performance', 16, 95, 84, 93, { specs: { standard: 'Wi-Fi 7' }, features: ['wifi7'] }),
  ], 30_000_000),
  simpleFamily('skylane-bt', 'skylane', 'bluetooth', 'universal', 0.001, [
    m('bt53', 'Bluetooth 5.3', 'budget', 2.5, 60, 78, 95, { specs: { standard: 'BT 5.3' } }),
    m('bt54', 'Bluetooth 5.4 LE Audio', 'mainstream', 3.5, 85, 82, 95, { specs: { standard: 'BT 5.4' } }),
  ], 40_000_000),
  simpleFamily('kabelwerk-desktop', 'kabelwerk', 'cables', 'desktop', 0.05, [m('cdt', 'Kabelsatz Desktop', 'budget', 5, 50, 74, 96)]),
  simpleFamily('kabelwerk-mobile', 'kabelwerk', 'cables', 'mobile', 0.1, [
    m('cnb65', 'USB-C-Netzteil 65 W', 'mainstream', 14, 50, 76, 94),
    m('cnb140', 'Netzteil 240 W (Gaming)', 'performance', 24, 60, 78, 93),
  ]),
  simpleFamily('kabelwerk-phone', 'kabelwerk', 'cables', 'phone', 0.01, [m('cph', 'USB-C-Kabel', 'budget', 1.5, 50, 74, 97)], 60_000_000),
  simpleFamily('kabelwerk-monitor', 'kabelwerk', 'cables', 'monitor', 0.06, [m('cmo', 'Kabelsatz Monitor (DP/HDMI/Strom)', 'budget', 5, 50, 74, 97)]),
  simpleFamily('kabelwerk-server', 'kabelwerk', 'cables', 'server', 0.08, [m('csv', 'Kabelsatz Server', 'budget', 12, 50, 78, 97)]),
  simpleFamily('boxline-desktop', 'boxline', 'packaging', 'desktop', 0.5, [
    m('pkd', 'Versandkarton Desktop', 'budget', 8, 45, 70, 99),
    m('pkdp', 'Premium-Box Desktop', 'performance', 14, 85, 86, 99),
  ]),
  simpleFamily('boxline-mobile', 'boxline', 'packaging', 'mobile', 0.15, [
    m('pkn', 'Notebook-Karton', 'budget', 4, 45, 70, 99),
    m('pknp', 'Premium-Box Notebook', 'performance', 7, 85, 86, 99),
  ]),
  simpleFamily('boxline-phone', 'boxline', 'packaging', 'phone', 0.03, [
    m('pkp', 'Smartphone-Box', 'budget', 1.8, 45, 70, 99),
    m('pkpp', 'Premium-Box Smartphone', 'performance', 3.5, 88, 88, 99),
  ], 60_000_000),
  simpleFamily('boxline-tablet', 'boxline', 'packaging', 'tablet', 0.05, [m('pkt', 'Tablet-Box', 'budget', 2.5, 55, 76, 99)]),
  simpleFamily('boxline-monitor', 'boxline', 'packaging', 'monitor', 0.4, [m('pkm', 'Monitor-Karton', 'budget', 6, 50, 72, 99)]),
  simpleFamily('boxline-gpu', 'boxline', 'packaging', 'gpu_board', 0.1, [m('pkg', 'Retail-Box Hardware', 'budget', 3, 60, 76, 99)]),
  simpleFamily('boxline-chip', 'boxline', 'packaging', 'chip', 0.005, [m('pkc', 'Prozessor-Blister & Box', 'budget', 1, 60, 76, 99)]),
  simpleFamily('boxline-server', 'boxline', 'packaging', 'server', 0.6, [m('pks', 'Server-Transportverpackung', 'budget', 10, 50, 80, 99)]),
  simpleFamily('boxline-wearable', 'boxline', 'packaging', 'wearable', 0.02, [m('pkw', 'Wearable-Box', 'budget', 1.5, 70, 80, 99)]),
];

export const COMPONENT_FAMILIES: ComponentFamilyDef[] = [
  ...CPU_FAMILIES,
  ...GPU_FAMILIES,
  ...SOC_FAMILIES,
  ...MEMORY_FAMILIES,
  ...DISPLAY_FAMILIES,
  ...BATTERY_FAMILIES,
  ...CAMERA_FAMILIES,
  ...PLATFORM_FAMILIES,
  ...STANDARD_FAMILIES,
];

const FAMILY_MAP = new Map(COMPONENT_FAMILIES.map((f) => [f.id, f]));

export function getFamily(id: string): ComponentFamilyDef | undefined {
  return FAMILY_MAP.get(id);
}

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  cpu: 'Prozessor',
  gpu: 'Grafik',
  soc: 'Mobile-Chip',
  ram: 'RAM',
  storage: 'Speicher',
  display: 'Display',
  battery: 'Akku',
  camera: 'Kamera',
  mainboard: 'Mainboard',
  psu: 'Netzteil',
  cooler: 'Kühlung',
  case: 'Gehäuse',
  speakers: 'Lautsprecher',
  microphone: 'Mikrofon',
  wifi: 'WLAN',
  bluetooth: 'Bluetooth',
  cables: 'Kabel',
  packaging: 'Verpackung',
  gpu_chip: 'GPU-Chip',
  vram: 'VRAM',
  pcb: 'Platine',
  chipset: 'Chipsatz',
  wafer: 'Wafer',
};

export const FORM_FACTOR_LABELS: Record<FormFactor, string> = {
  desktop: 'Desktop',
  mobile: 'Notebook',
  server: 'Server',
  phone: 'Smartphone',
  tablet: 'Tablet',
  wearable: 'Wearable',
  monitor: 'Monitor',
  gpu_board: 'Grafikkarte',
  chip: 'Chip',
  m2: 'M.2',
  ufs: 'UFS',
  universal: 'Universal',
};

export const FEATURE_LABELS: Record<FeatureId, string> = {
  raytracing: 'Raytracing',
  ai_accel: 'KI-Beschleunigung',
  oled: 'OLED',
  miniled: 'Mini-LED',
  ltpo: 'LTPO',
  high_refresh: 'Hohe Bildrate',
  wifi7: 'Wi-Fi 7',
  fast_charge: 'Schnellladen',
  periscope: 'Periskop-Zoom',
  liquid_cooling: 'Wasserkühlung',
  ecc: 'ECC',
  pcie5: 'PCIe 5.0',
};

/** Innovationspunkte je Feature (für das Innovationsattribut). */
export const FEATURE_INNOVATION: Record<FeatureId, number> = {
  raytracing: 8,
  ai_accel: 12,
  oled: 12,
  miniled: 10,
  ltpo: 8,
  high_refresh: 6,
  wifi7: 5,
  fast_charge: 8,
  periscope: 10,
  liquid_cooling: 5,
  ecc: 2,
  pcie5: 4,
};
