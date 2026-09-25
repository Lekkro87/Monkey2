import { CATEGORIES } from '@/data/categories';
import { HOURS_PER_DAY } from '@/data/departments';
import { addNews } from '@/simulation/news';
import { gaussian } from '@/simulation/rng';
import type { DepartmentId, GameState, Product } from '@/types';
import { clamp } from '@/utils/math';
import { addTransaction } from '@/systems/finance/ledger';
import { techEffects } from '@/systems/research/effects';
import { departmentCapacity } from '@/systems/workforce/employees';
import { DEV_BUDGET_LEVELS, evaluateDesign } from './design';
import { DEV_PHASES } from './phases';
import { registerInhouseComponent } from './commands';

type DevDepartment = 'engineering' | 'hardware' | 'software';
const DEV_DEPARTMENTS: DevDepartment[] = ['engineering', 'hardware', 'software'];
const PRIORITY_WEIGHT = { low: 0.5, normal: 1, high: 2 } as const;

/** Anteile je Abteilung; nicht besetzte, nicht zwingende Anteile übernimmt das Engineering. */
function effectiveMix(product: Product, capacity: Record<DevDepartment, number>): Record<DevDepartment, number> {
  const category = CATEGORIES[product.category];
  const mix = { ...category.devDepartmentMix };
  for (const dept of DEV_DEPARTMENTS) {
    if (mix[dept] <= 0 || capacity[dept] > 0) continue;
    if (category.devRequirements[dept]) continue;
    const fallback: DevDepartment = dept === 'engineering' ? 'hardware' : 'engineering';
    mix[fallback] += mix[dept] / 0.7;
    mix[dept] = 0;
  }
  return mix;
}

function phaseCost(product: Product, phaseIndex: number): number {
  const development = product.development!;
  return development.totalBudget * DEV_PHASES[phaseIndex].budgetShare;
}

function completeDevelopment(state: GameState, product: Product): void {
  const engineers = state.workforce.employees.filter((e) => e.department === 'engineering' || e.department === 'hardware');
  const avgSkill = engineers.length > 0 ? engineers.reduce((a, e) => a + e.skill, 0) / engineers.length : 45;
  const perfectionists = engineers.filter((e) => e.traits.includes('perfectionist')).length;
  const creatives = engineers.filter((e) => e.traits.includes('creative')).length;
  const devQuality = clamp(
    DEV_BUDGET_LEVELS[product.devBudgetLevel].quality + (avgSkill - 50) * 0.3 + Math.min(6, perfectionists * 2) + Math.min(4, creatives) + gaussian(state, 0, 4),
    10,
    98,
  );
  product.devQuality = devQuality;
  const evaluation = evaluateDesign(state, product.category, product.components, devQuality);
  product.attributes = evaluation.attributes;
  product.attributesDay = state.time.day;
  product.specs = evaluation.specs;
  product.estimatedUnitCost = evaluation.unitCost;
  product.quality.defectRate = evaluation.defectRate;
  product.quality.defectLabel = evaluation.defectLabel;
  product.status = 'ready';
  product.readyDay = state.time.day;
  product.development = null;
  registerInhouseComponent(state, product);
  addNews(
    state,
    'company',
    'positive',
    `Entwicklung von ${product.name} abgeschlossen`,
    `Entwicklungsqualität ${Math.round(devQuality)}/100. Das Produkt kann jetzt produziert und auf den Markt gebracht werden.`,
  );
}

export function progressDevelopment(state: GameState): void {
  const projects = state.products.filter((p) => p.status === 'development' && p.development);
  if (projects.length === 0) return;
  const effects = techEffects(state);
  const speed = 1 + effects.devSpeed;
  const capacity: Record<DevDepartment, number> = {
    engineering: departmentCapacity(state, 'engineering'),
    hardware: departmentCapacity(state, 'hardware'),
    software: departmentCapacity(state, 'software'),
  };
  // Software-Projekte teilen sich die Softwareabteilung mit Produktentwicklungen.
  const activeSoftware = Object.values(state.software.projects).filter((p) => p.completedDay === undefined).length;
  const softwareShareForProducts = activeSoftware > 0 ? 0.5 : 1;

  const mixes = new Map<string, Record<DevDepartment, number>>();
  const weightTotals: Record<DevDepartment, number> = { engineering: 0, hardware: 0, software: 0 };
  for (const product of projects) {
    const development = product.development!;
    const mix = effectiveMix(product, capacity);
    mixes.set(product.id, mix);
    for (const dept of DEV_DEPARTMENTS) weightTotals[dept] += PRIORITY_WEIGHT[development.priority] * mix[dept];
  }

  for (const product of projects) {
    const development = product.development!;
    const category = CATEGORIES[product.category];
    const phase = DEV_PHASES[development.phaseIndex];

    if (!development.phasePaid) {
      const cost = phaseCost(product, development.phaseIndex);
      if (state.finance.cash < cost) {
        development.blockedReason = `Kapital fehlt: Phase „${phase.name}“ benötigt ${Math.round(cost).toLocaleString('de-DE')} €.`;
        continue;
      }
      addTransaction(state, 'development', -cost);
      development.spent += cost;
      development.phasePaid = true;
      development.phaseStartedDay = state.time.day;
      development.blockedReason = undefined;
    }

    const mix = mixes.get(product.id) ?? effectiveMix(product, capacity);
    const weight = PRIORITY_WEIGHT[development.priority];
    let progressHours = Infinity;
    let missing: DepartmentId | null = null;
    for (const dept of DEV_DEPARTMENTS) {
      if (mix[dept] <= 0) continue;
      const deptCapacity = capacity[dept] * (dept === 'software' ? softwareShareForProducts : 1);
      const hours = weightTotals[dept] > 0 ? (deptCapacity * HOURS_PER_DAY * weight * mix[dept]) / weightTotals[dept] : 0;
      const equivalent = hours / mix[dept];
      if (equivalent < progressHours) {
        progressHours = equivalent;
        if (hours <= 0) missing = dept;
      }
    }
    if (!Number.isFinite(progressHours)) progressHours = 0;
    progressHours *= speed * DEV_BUDGET_LEVELS[product.devBudgetLevel].speed;

    if (phase.id === 'certification') {
      const elapsed = state.time.day - development.phaseStartedDay + 1;
      development.phaseProgress = Math.min(1, elapsed / Math.max(1, category.certificationDays));
      development.blockedReason = undefined;
    } else {
      if (progressHours <= 0) {
        development.blockedReason = missing
          ? `Keine Kapazität in ${missing === 'engineering' ? 'Engineering' : missing === 'hardware' ? 'Hardware' : 'Software'} – Entwicklung steht still.`
          : 'Keine Entwicklungskapazität.';
        continue;
      }
      development.blockedReason = undefined;
      const phaseEffort = Math.max(1, development.totalEffort * phase.effortShare);
      development.phaseProgress = Math.min(1, development.phaseProgress + progressHours / phaseEffort);
    }

    const minDaysReached = state.time.day - development.phaseStartedDay + 1 >= phase.minDays;
    if (development.phaseProgress >= 1 && minDaysReached) {
      if (development.phaseIndex >= DEV_PHASES.length - 1) {
        completeDevelopment(state, product);
      } else {
        development.phaseIndex += 1;
        development.phaseProgress = 0;
        development.phasePaid = false;
        development.phaseStartedDay = state.time.day;
      }
    }
  }
}

/** Geschätzte Resttage einer Entwicklung bei aktueller Kapazität. */
export function estimateRemainingDays(state: GameState, product: Product): number | null {
  const development = product.development;
  if (!development) return null;
  const category = CATEGORIES[product.category];
  const effects = techEffects(state);
  const capacity: Record<DevDepartment, number> = {
    engineering: departmentCapacity(state, 'engineering'),
    hardware: departmentCapacity(state, 'hardware'),
    software: departmentCapacity(state, 'software'),
  };
  const mix = effectiveMix(product, capacity);
  const concurrent = Math.max(1, state.products.filter((p) => p.status === 'development').length);
  let rate = Infinity;
  for (const dept of DEV_DEPARTMENTS) {
    if (mix[dept] <= 0) continue;
    rate = Math.min(rate, (capacity[dept] * HOURS_PER_DAY) / concurrent / mix[dept]);
  }
  if (!Number.isFinite(rate) || rate <= 0) return null;
  rate *= (1 + effects.devSpeed) * DEV_BUDGET_LEVELS[product.devBudgetLevel].speed;
  let days = 0;
  for (let i = development.phaseIndex; i < DEV_PHASES.length; i++) {
    const phase = DEV_PHASES[i];
    const remainingShare = i === development.phaseIndex ? 1 - development.phaseProgress : 1;
    if (phase.id === 'certification') days += category.certificationDays * remainingShare;
    else days += Math.max(phase.minDays * remainingShare, (development.totalEffort * phase.effortShare * remainingShare) / rate);
  }
  return Math.ceil(days);
}
