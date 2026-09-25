import { CATEGORY_IDS } from '@/data/categories';
import { getTech } from '@/data/technologies';
import type { AttributeKey, AutomationLevel, FeatureId, GameState, ProductCategoryId, QcLevelId } from '@/types';

export interface TechEffectsSummary {
  productionEfficiency: number;
  defectReduction: number;
  devSpeed: number;
  devCost: number;
  materialCost: number;
  researchSpeed: number;
  marketingEfficiency: number;
  supportEfficiency: number;
  energyEfficiency: number;
  logisticsCost: number;
  chipPerformance: { cpu: number; gpu: number; soc: number; mainboard: number };
  attributeBonus: Record<ProductCategoryId, Partial<Record<AttributeKey, number>>>;
  unlockedCategories: Set<ProductCategoryId>;
  unlockedFeatures: Set<FeatureId>;
  automation: Set<AutomationLevel>;
  qcLevels: Set<QcLevelId>;
  software: Set<string>;
}

const cache = new Map<string, TechEffectsSummary>();
/**
 * Zusätzlicher Cache über die Objektidentität von `research.completed`.
 * Das Forschungssystem ersetzt das Objekt bei jeder Änderung (nie in-place mutieren!).
 */
const identityCache = new WeakMap<object, TechEffectsSummary>();

function computeEffects(completed: string[]): TechEffectsSummary {
  const summary: TechEffectsSummary = {
    productionEfficiency: 0,
    defectReduction: 0,
    devSpeed: 0,
    devCost: 0,
    materialCost: 0,
    researchSpeed: 0,
    marketingEfficiency: 0,
    supportEfficiency: 0,
    energyEfficiency: 0,
    logisticsCost: 0,
    chipPerformance: { cpu: 0, gpu: 0, soc: 0, mainboard: 0 },
    attributeBonus: Object.fromEntries(CATEGORY_IDS.map((c) => [c, {}])) as TechEffectsSummary['attributeBonus'],
    unlockedCategories: new Set(['desktop', 'gaming_pc']),
    unlockedFeatures: new Set(),
    automation: new Set([0]),
    qcLevels: new Set(['basic', 'sampling']),
    software: new Set(),
  };

  for (const techId of completed) {
    const tech = getTech(techId);
    if (!tech) continue;
    for (const effect of tech.effects) {
      switch (effect.kind) {
        case 'unlockCategory':
          summary.unlockedCategories.add(effect.category);
          break;
        case 'unlockFeature':
          summary.unlockedFeatures.add(effect.feature);
          break;
        case 'attributeBonus': {
          const categories = effect.categories ?? CATEGORY_IDS;
          for (const category of categories) {
            const bonus = summary.attributeBonus[category];
            bonus[effect.attribute] = (bonus[effect.attribute] ?? 0) + effect.amount;
          }
          break;
        }
        case 'productionEfficiency':
          summary.productionEfficiency += effect.amount;
          break;
        case 'unlockAutomation':
          summary.automation.add(effect.level);
          break;
        case 'unlockQc':
          summary.qcLevels.add(effect.level);
          break;
        case 'defectReduction':
          summary.defectReduction += effect.amount;
          break;
        case 'devSpeed':
          summary.devSpeed += effect.amount;
          break;
        case 'devCost':
          summary.devCost += effect.amount;
          break;
        case 'materialCost':
          summary.materialCost += effect.amount;
          break;
        case 'researchSpeed':
          summary.researchSpeed += effect.amount;
          break;
        case 'marketingEfficiency':
          summary.marketingEfficiency += effect.amount;
          break;
        case 'supportEfficiency':
          summary.supportEfficiency += effect.amount;
          break;
        case 'energyEfficiency':
          summary.energyEfficiency += effect.amount;
          break;
        case 'logisticsCost':
          summary.logisticsCost += effect.amount;
          break;
        case 'chipPerformance':
          summary.chipPerformance[effect.target] += effect.amount;
          break;
        case 'unlockSoftware':
          summary.software.add(effect.project);
          break;
      }
    }
  }
  return summary;
}

/** Aggregierte Wirkung aller erforschten Technologien (gecacht). */
export function techEffects(state: GameState): TechEffectsSummary {
  const completedObj = state.research.completed;
  const known = identityCache.get(completedObj);
  if (known) return known;
  const completed = Object.keys(completedObj).sort();
  const key = completed.join('|');
  let summary = cache.get(key);
  if (!summary) {
    summary = computeEffects(completed);
    if (cache.size > 200) cache.clear();
    cache.set(key, summary);
  }
  identityCache.set(completedObj, summary);
  return summary;
}

export function hasTech(state: GameState, techId: string | undefined): boolean {
  return !techId || techId in state.research.completed;
}

export function isCategoryUnlocked(state: GameState, category: ProductCategoryId): boolean {
  return techEffects(state).unlockedCategories.has(category);
}
