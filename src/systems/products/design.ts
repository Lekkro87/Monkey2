import { CATEGORIES } from '@/data/categories';
import { FEATURE_INNOVATION, techCurve } from '@/data/componentCatalog';
import { DIFFICULTIES } from '@/data/difficulties';
import { getSoftwareProject } from '@/data/software';
import { getTech } from '@/data/technologies';
import type {
  AttributeKey,
  ComponentSku,
  DevBudgetLevel,
  FeatureId,
  GameState,
  ProductAttributes,
  ProductCategoryDef,
  ProductCategoryId,
  ProductSpecSummary,
  SlotKey,
} from '@/types';
import { clamp } from '@/utils/math';
import { currentGeneration, getSku, skuPriceEur } from '@/systems/components/catalog';
import { materialCostFactor } from '@/systems/supply/purchasing';
import { hasTech, techEffects } from '@/systems/research/effects';
import { departmentCapacity } from '@/systems/workforce/employees';

export interface DesignIssue {
  slot?: SlotKey;
  message: string;
}

export interface CostLine {
  slot: SlotKey;
  skuId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface DesignEvaluation {
  valid: boolean;
  errors: DesignIssue[];
  warnings: DesignIssue[];
  attributes: ProductAttributes;
  specs: ProductSpecSummary;
  materialCost: number;
  licenseCost: number;
  unitCost: number;
  costLines: CostLine[];
  features: FeatureId[];
  defectRate: number;
  defectLabel: string;
}

export const DEV_BUDGET_LEVELS: Record<DevBudgetLevel, { name: string; factor: number; quality: number; speed: number }> = {
  minimal: { name: 'Minimal', factor: 0.5, quality: 35, speed: 1.1 },
  standard: { name: 'Standard', factor: 1, quality: 55, speed: 1 },
  high: { name: 'Hoch', factor: 1.8, quality: 70, speed: 0.95 },
  maximal: { name: 'Maximal', factor: 3, quality: 82, speed: 0.9 },
};

const REFERENCE_POWER: Record<ProductCategoryId, number> = {
  desktop: 220,
  gaming_pc: 480,
  laptop: 70,
  gaming_laptop: 200,
  smartphone: 9,
  tablet: 12,
  monitor: 40,
  graphics_card: 260,
  processor: 120,
  mainboard: 20,
  server: 900,
  smartwatch: 1.3,
};

const HEAT_TYPES = new Set(['cpu', 'gpu', 'soc', 'gpu_chip']);
const MATERIAL_DURABILITY = { plastic: 55, aluminum: 75, premium: 88 } as const;
const MATERIAL_REPAIR = { plastic: 5, aluminum: 0, premium: -10 } as const;
const MATERIAL_COOLING = { plastic: 0.95, aluminum: 1.05, premium: 1.1 } as const;
const CASE_AIRFLOW = { plastic: 300, aluminum: 380, premium: 450 } as const;

const DEFECT_LABELS: Partial<Record<string, string>> = {
  battery: 'Akkudefekt',
  psu: 'Netzteildefekt',
  display: 'Displayfehler',
  mainboard: 'Mainboardfehler',
  storage: 'Speicherausfall',
  ram: 'Arbeitsspeicherfehler',
  cooler: 'Lüfterausfall',
  gpu: 'Grafikfehler',
  gpu_chip: 'Grafikfehler',
  camera: 'Kameradefekt',
  case: 'Gehäuseschaden',
  soc: 'Chipfehler',
  cpu: 'Prozessorfehler',
};

/** Durchschnittliche Technologiekurve der leistungsrelevanten Slots einer Kategorie. */
export function categoryCurve(category: ProductCategoryDef, day: number): number {
  if (category.id === 'processor') return techCurve('cpu', day);
  if (category.id === 'mainboard') return techCurve('chipset', day);
  let total = 0;
  let weight = 0;
  for (const slot of category.slots) {
    const w = category.perfWeights[slot.key];
    if (!w) continue;
    total += w * techCurve(slot.type, day);
    weight += w;
  }
  return weight > 0 ? total / weight : 1;
}

/** Software-Wertung des Unternehmens (dynamisch: Team, Forschung, Softwareprojekte). */
export function companySoftwareScore(state: GameState, category: ProductCategoryId): number {
  const capacity = departmentCapacity(state, 'software');
  let score = 32 + 40 * (1 - Math.exp(-capacity / 15));
  for (const [projectId, project] of Object.entries(state.software.projects)) {
    if (project.completedDay === undefined) continue;
    const def = getSoftwareProject(projectId);
    if (!def) continue;
    const bonus = def.effects.softwareBonus ?? 0;
    const mobileOnly = projectId === 'mobile_os';
    if (mobileOnly && !['smartphone', 'tablet', 'smartwatch'].includes(category)) continue;
    if (projectId === 'os' && ['smartphone', 'tablet', 'smartwatch'].includes(category)) continue;
    score += bonus;
  }
  score += techEffects(state).attributeBonus[category].software ?? 0;
  return clamp(score, 0, 100);
}

export function hasOwnOs(state: GameState, category: ProductCategoryId): boolean {
  for (const [projectId, project] of Object.entries(state.software.projects)) {
    if (project.completedDay === undefined) continue;
    if (getSoftwareProject(projectId)?.effects.removesOsLicense?.includes(category)) return true;
  }
  return false;
}

export function estimateDevQuality(state: GameState, level: DevBudgetLevel): number {
  const engineers = state.workforce.employees.filter((e) => e.department === 'engineering' || e.department === 'hardware');
  const avgSkill = engineers.length > 0 ? engineers.reduce((a, e) => a + e.skill, 0) / engineers.length : 45;
  return clamp(DEV_BUDGET_LEVELS[level].quality + (avgSkill - 50) * 0.3, 10, 98);
}

function resolveComponents(state: GameState, category: ProductCategoryDef, components: Partial<Record<SlotKey, string>>) {
  const resolved = new Map<SlotKey, ComponentSku>();
  const errors: DesignIssue[] = [];
  const warnings: DesignIssue[] = [];
  for (const slot of category.slots) {
    const id = components[slot.key];
    if (!id) {
      if (slot.required) errors.push({ slot: slot.key, message: `${slot.label} fehlt.` });
      continue;
    }
    const sku = getSku(state, id);
    if (!sku) {
      errors.push({ slot: slot.key, message: `${slot.label}: unbekannte Komponente.` });
      continue;
    }
    if (sku.type !== slot.type || !slot.formFactors.includes(sku.formFactor)) {
      errors.push({ slot: slot.key, message: `${sku.name} passt nicht in den Slot „${slot.label}“.` });
      continue;
    }
    if (sku.requiredTech && !hasTech(state, sku.requiredTech)) {
      errors.push({ slot: slot.key, message: `${sku.name} erfordert die Technologie „${getTech(sku.requiredTech)?.name ?? sku.requiredTech}“.` });
    }
    const market = state.components.market[sku.id];
    if (!sku.inhouseProductId && market?.status === 'discontinued') {
      errors.push({ slot: slot.key, message: `${sku.name} wird nicht mehr hergestellt.` });
    } else if (!sku.inhouseProductId && market?.status === 'eol') {
      warnings.push({ slot: slot.key, message: `${sku.name} ist ein Auslaufmodell und bald nicht mehr lieferbar.` });
    }
    resolved.set(slot.key, sku);
  }
  return { resolved, errors, warnings };
}

function performanceIndex(state: GameState, category: ProductCategoryDef, resolved: Map<SlotKey, ComponentSku>): number {
  const effects = techEffects(state);
  if (category.id === 'processor') {
    const wafer = resolved.get('wafer');
    return wafer ? wafer.performance * Math.max(0.3, effects.chipPerformance.cpu) : 0;
  }
  if (category.id === 'mainboard') {
    const chipset = resolved.get('chipset');
    const pcb = resolved.get('pcb');
    if (!chipset) return 0;
    return chipset.performance * (0.85 + effects.chipPerformance.mainboard) * (pcb ? 0.92 + pcb.performance / 1250 : 0.9);
  }
  let index = 0;
  let weightSum = 0;
  for (const [slotKey, weight] of Object.entries(category.perfWeights) as [SlotKey, number][]) {
    const sku = resolved.get(slotKey);
    let perf = sku?.performance ?? 0;
    if (slotKey === 'gpu' && !sku) {
      const cpu = resolved.get('cpu');
      perf = cpu ? cpu.performance * 0.25 : 0;
    }
    index += weight * perf;
    weightSum += weight;
  }
  return weightSum > 0 ? index / weightSum : 0;
}

/** Bewertet ein Produktdesign: Attribute, technische Daten, Kosten und Probleme. */
export function evaluateDesign(
  state: GameState,
  categoryId: ProductCategoryId,
  components: Partial<Record<SlotKey, string>>,
  devQuality: number,
): DesignEvaluation {
  const category = CATEGORIES[categoryId];
  const day = state.time.day;
  const effects = techEffects(state);
  const bonus = effects.attributeBonus[categoryId];
  const { resolved, errors, warnings } = resolveComponents(state, category, components);

  // Leistung & Leistungsaufnahme ---------------------------------------------
  const perfIndex = performanceIndex(state, category, resolved);
  let cpuHeat = 0;
  let gpuHeat = 0;
  let otherPower = 0;
  let displayPower = 0;
  for (const slot of category.slots) {
    const sku = resolved.get(slot.key);
    if (!sku) continue;
    const power = sku.powerDraw * slot.quantity;
    if (HEAT_TYPES.has(sku.type)) {
      if (sku.type === 'gpu' || sku.type === 'gpu_chip') gpuHeat += power;
      else cpuHeat += power;
    } else if (sku.type === 'display') displayPower += power;
    else otherPower += power;
  }
  if (category.slots.some((s) => s.key === 'gpu') && !resolved.get('gpu')) cpuHeat *= 1.1;
  if (categoryId === 'processor') cpuHeat = 40 + perfIndex * 1.1 * (hasTech(state, 'cpu_efficiency') ? 0.85 : 1);
  if (categoryId === 'graphics_card') gpuHeat += otherPower * 0.5;
  const totalPower = cpuHeat + gpuHeat + displayPower + otherPower + category.basePower;

  // Kühlung --------------------------------------------------------------------
  const caseSku = resolved.get('case');
  const material = caseSku?.specs.material ?? 'aluminum';
  const cooler = resolved.get('cooler');
  const coolingCapacity = (cooler?.specs.coolingW ?? 0) * MATERIAL_COOLING[material];
  let loadRatio: number;
  if (category.group === 'pc' && category.id !== 'laptop' && category.id !== 'gaming_laptop') {
    const cpuRatio = coolingCapacity > 0 ? cpuHeat / coolingCapacity : cpuHeat / 120;
    const gpuRatio = gpuHeat > 0 ? (gpuHeat / CASE_AIRFLOW[material]) * 0.9 : 0;
    loadRatio = Math.max(cpuRatio, gpuRatio);
  } else if (coolingCapacity > 0) {
    loadRatio = (cpuHeat + gpuHeat) / coolingCapacity;
  } else if (categoryId === 'processor') {
    loadRatio = cpuHeat / 220;
  } else {
    loadRatio = category.group === 'display' ? 0.35 : 0.4;
  }
  const throttling = loadRatio > 1 ? loadRatio ** -0.6 : 1;
  const mobileScale = category.group === 'mobile' || category.group === 'wearable';
  const temperature = clamp(mobileScale ? 28 + 20 * loadRatio : 32 + 52 * loadRatio, 25, 110);
  const noiseFactor = cooler?.specs.noiseFactor ?? 0;
  let noiseDb = 0;
  if (noiseFactor > 0) noiseDb = 20 + 22 * Math.min(1.6, loadRatio) * noiseFactor;
  if (gpuHeat > 0 && category.group === 'pc' && !['laptop', 'gaming_laptop'].includes(categoryId)) noiseDb = Math.max(noiseDb, 22 + gpuHeat / 25);
  if (categoryId === 'server') noiseDb += 12;

  // Punktwerte -------------------------------------------------------------------
  const curve = categoryCurve(category, day);
  const performance = clamp((perfIndex * throttling) / curve + (bonus.performance ?? 0), 0, 100);

  let priceWeight = 0;
  let qualitySum = 0;
  let reliabilitySum = 0;
  const costLines: CostLine[] = [];
  const materialFactor = materialCostFactor(state);
  let materialCost = 0;
  let componentDefect = 0;
  let worstDefect = { contribution: 0, type: '' };
  const features = new Set<FeatureId>();
  let recencyTotal = 0;
  let recencyCount = 0;
  for (const slot of category.slots) {
    const sku = resolved.get(slot.key);
    if (!sku) continue;
    const unitPrice = skuPriceEur(state, sku) * (sku.inhouseProductId ? 1 : materialFactor);
    const total = unitPrice * slot.quantity;
    materialCost += total;
    costLines.push({ slot: slot.key, skuId: sku.id, name: sku.name, quantity: slot.quantity, unitPrice, total });
    const weight = Math.max(1, total);
    priceWeight += weight;
    qualitySum += sku.quality * weight;
    reliabilitySum += sku.reliability * weight;
    const contribution = (1 - sku.reliability / 100) * 0.018 * slot.quantity;
    componentDefect += contribution;
    if (contribution > worstDefect.contribution) worstDefect = { contribution, type: sku.type };
    for (const feature of sku.features) features.add(feature);
    if (category.perfWeights[slot.key] && !sku.inhouseProductId) {
      const latest = currentGeneration(state, sku.familyId);
      recencyTotal += sku.generation >= latest ? 1 : sku.generation === latest - 1 ? 0.4 : 0;
      recencyCount++;
    }
  }
  const batteryDevice = category.slots.some((s) => s.key === 'battery');
  if (batteryDevice && effects.unlockedFeatures.has('fast_charge')) features.add('fast_charge');
  const componentQuality = priceWeight > 0 ? qualitySum / priceWeight : 50;
  const componentReliability = priceWeight > 0 ? reliabilitySum / priceWeight : 80;

  const quality = clamp(0.65 * componentQuality + 0.35 * devQuality + (bonus.quality ?? 0), 0, 100);
  const thermalPenalty = Math.max(0, loadRatio - 0.85) * 30;
  const durability = clamp(
    0.55 * componentReliability + 0.25 * (caseSku ? MATERIAL_DURABILITY[material] : 70) + 0.2 * devQuality - thermalPenalty + (bonus.durability ?? 0),
    0,
    100,
  );

  const perfPerWatt = Math.max(1, performance) / Math.max(0.05, totalPower);
  const refPerfPerWatt = 60 / REFERENCE_POWER[categoryId];
  const psuRating = resolved.get('psu')?.specs.efficiencyRating ?? '';
  const psuBonus = psuRating.includes('Titanium') ? 8 : psuRating.includes('Platinum') ? 6 : psuRating.includes('Gold') ? 3 : 0;
  const efficiency = clamp(50 + 35 * Math.log2(perfPerWatt / refPerfPerWatt) + psuBonus + (bonus.efficiency ?? 0), 3, 100);
  const acoustics = clamp(100 - Math.max(0, noiseDb - 22) * 2.6 + (bonus.acoustics ?? 0), 0, 100);
  const thermals = clamp(115 - 80 * loadRatio + (bonus.thermals ?? 0), 0, 100);

  const display = resolved.get('display');
  const panel = display?.specs.panel ?? '';
  const panelBonus = panel.includes('LTPO') ? 5 : panel.includes('OLED') ? 4 : panel.includes('Mini-LED') ? 3 : 0;
  const coolerLevel = cooler?.specs.level;
  const thickness = mobileScale || categoryId === 'laptop' || categoryId === 'gaming_laptop' ? (coolerLevel === 'extreme' ? 8 : coolerLevel === 'performance' ? 3 : 0) : 0;
  const caseDesign = caseSku?.performance ?? cooler?.quality ?? 55;
  const premiumPackaging = (resolved.get('packaging')?.performance ?? 0) >= 80 ? 2 : 0;
  const design = clamp(0.6 * caseDesign + 0.25 * devQuality + 12 + panelBonus + premiumPackaging - thickness + (bonus.design ?? 0), 0, 100);

  const repairability = clamp(category.repairabilityBase + (caseSku ? MATERIAL_REPAIR[material] : 0) + (bonus.repairability ?? 0), 0, 100);

  let batteryHours: number | null = null;
  let battery = 0;
  const batterySku = resolved.get('battery');
  if (batterySku) {
    const wh = batterySku.specs.capacityWh ?? 0;
    const averagePower = Math.max(0.01, totalPower * category.averageLoad);
    batteryHours = wh / averagePower;
    battery = clamp((60 * batteryHours) / Math.max(1, category.expectedBatteryHours) + (bonus.battery ?? 0), 0, 100);
  }
  const displayScore = display ? clamp((display.performance / techCurve('display', day)) + (bonus.display ?? 0), 0, 100) : 0;
  const camera = resolved.get('camera');
  const cameraScore = camera ? clamp(camera.performance / techCurve('camera', day) + (bonus.camera ?? 0), 0, 100) : 0;

  let innovation = 15 + (bonus.innovation ?? 0);
  for (const feature of features) innovation += FEATURE_INNOVATION[feature] * 0.8;
  if (recencyCount > 0) innovation += (recencyTotal / recencyCount) * 15;
  innovation = clamp(innovation, 0, 100);

  const attributes: ProductAttributes = {
    performance,
    quality,
    durability,
    efficiency,
    acoustics,
    thermals,
    design,
    repairability,
    battery,
    display: categoryId === 'monitor' ? Math.max(displayScore, performance) : displayScore,
    camera: cameraScore,
    software: companySoftwareScore(state, categoryId),
    innovation,
  };

  // Validierung ------------------------------------------------------------------
  const psu = resolved.get('psu');
  let psuHeadroom: number | null = null;
  if (psu) {
    const wattage = psu.specs.wattage ?? 0;
    const required = totalPower * 1.25;
    psuHeadroom = wattage / Math.max(1, totalPower);
    if (wattage < required) errors.push({ slot: 'psu', message: `Netzteil zu schwach: Es werden mindestens ${Math.ceil(required / 50) * 50} W benötigt.` });
  }
  if (loadRatio > 1.25) warnings.push({ slot: 'cooler', message: `Kühlung überlastet (${Math.round(temperature)} °C) – Leistung wird um ${Math.round((1 - throttling) * 100)} % gedrosselt.` });
  else if (loadRatio > 1) warnings.push({ slot: 'cooler', message: `Kühlung am Limit (${Math.round(temperature)} °C) – leichte Drosselung.` });
  if (batteryHours !== null && batteryHours < category.expectedBatteryHours * 0.5) {
    warnings.push({ slot: 'battery', message: `Sehr kurze Akkulaufzeit (${batteryHours.toFixed(1).replace('.', ',')} h).` });
  }

  const licenseCost = hasOwnOs(state, categoryId) ? 0 : category.licenseCost * state.economy.priceLevel;
  const thermalFactor = 1 + Math.max(0, loadRatio - 0.9) * 2;
  const devFactor = 1.6 - (devQuality / 100) * 1.1;
  const defectRate = clamp(
    componentDefect * thermalFactor * devFactor * DIFFICULTIES[state.difficulty].defectRate * Math.max(0.3, 1 - effects.defectReduction),
    0.001,
    0.25,
  );
  const defectLabel = thermalFactor > 1.3 ? 'Überhitzungsschäden' : (DEFECT_LABELS[worstDefect.type] ?? 'Hardwarefehler');

  const displayLabel = display
    ? `${String(display.specs.sizeInch ?? '').replace('.', ',')}" ${display.specs.resolution ?? ''} ${display.specs.panel ?? ''} ${display.specs.refreshHz ?? ''} Hz`.trim()
    : undefined;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    attributes,
    specs: {
      powerDraw: Math.round(totalPower * 10) / 10,
      heat: Math.round((cpuHeat + gpuHeat) * 10) / 10,
      coolingCapacity: Math.round(coolingCapacity),
      temperature: Math.round(temperature),
      noiseDb: Math.round(noiseDb),
      batteryHours: batteryHours !== null ? Math.round(batteryHours * 10) / 10 : null,
      throttling,
      psuHeadroom,
      perfIndex,
      displayLabel,
      features: [...features],
    },
    materialCost,
    licenseCost,
    unitCost: materialCost + licenseCost,
    costLines,
    features: [...features],
    defectRate,
    defectLabel,
  };
}

/** Attribute eines Produkts zum aktuellen Tag (Alterung durch Technologiefortschritt). */
export function currentAttributes(
  state: GameState,
  categoryId: ProductCategoryId,
  attributes: ProductAttributes,
  attributesDay: number,
  launchDay: number | undefined,
  softwareScore?: number,
): ProductAttributes {
  const day = state.time.day;
  const software = softwareScore ?? companySoftwareScore(state, categoryId);
  if (day === attributesDay) return { ...attributes, software };
  const category = CATEGORIES[categoryId];
  const perfDecay = categoryCurve(category, attributesDay) / categoryCurve(category, day);
  const displayDecay = techCurve('display', attributesDay) / techCurve('display', day);
  const cameraDecay = techCurve('camera', attributesDay) / techCurve('camera', day);
  const monthsOnMarket = Math.max(0, (day - (launchDay ?? attributesDay)) / 30.4);
  return {
    ...attributes,
    performance: attributes.performance * perfDecay,
    display: attributes.display * displayDecay,
    camera: attributes.camera * cameraDecay,
    innovation: Math.max(0, attributes.innovation - monthsOnMarket * 1.3),
    software,
  };
}

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  performance: 'Leistung',
  quality: 'Qualität',
  durability: 'Haltbarkeit',
  efficiency: 'Energieeffizienz',
  acoustics: 'Laufruhe',
  thermals: 'Temperatur',
  design: 'Design',
  repairability: 'Reparierbarkeit',
  battery: 'Akku',
  display: 'Display',
  camera: 'Kamera',
  software: 'Software',
  innovation: 'Innovationsgrad',
};
