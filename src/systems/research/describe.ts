import { CATEGORIES } from '@/data/categories';
import { FEATURE_LABELS } from '@/data/componentCatalog';
import { QC_LEVELS } from '@/data/facilities';
import { SOFTWARE_PROJECTS } from '@/data/software';
import type { TechEffect } from '@/types';
import { formatPercent } from '@/utils/format';
import { ATTRIBUTE_LABELS } from '@/systems/products/design';

/** Menschlich lesbare Beschreibung einer Technologie-Wirkung. */
export function describeTechEffect(effect: TechEffect): string {
  const pct = (v: number) => formatPercent(Math.abs(v), 0);
  switch (effect.kind) {
    case 'unlockCategory':
      return `Neue Produktkategorie: ${CATEGORIES[effect.category].name}`;
    case 'unlockFeature':
      return `Feature freigeschaltet: ${FEATURE_LABELS[effect.feature]}`;
    case 'attributeBonus': {
      const scope = effect.categories ? ` (${effect.categories.map((c) => CATEGORIES[c].name).join(', ')})` : '';
      return `+${effect.amount} ${ATTRIBUTE_LABELS[effect.attribute]}${scope}`;
    }
    case 'productionEfficiency':
      return `Produktion +${pct(effect.amount)} schneller`;
    case 'unlockAutomation':
      return `Automatisierung ${effect.level} % möglich`;
    case 'unlockQc':
      return `Qualitätskontrolle: ${QC_LEVELS[effect.level].name}`;
    case 'defectReduction':
      return `−${pct(effect.amount)} Fehlerquote`;
    case 'devSpeed':
      return `Entwicklung +${pct(effect.amount)} schneller`;
    case 'devCost':
      return `Entwicklungskosten −${pct(effect.amount)}`;
    case 'materialCost':
      return `Materialkosten −${pct(effect.amount)}`;
    case 'researchSpeed':
      return `Forschung +${pct(effect.amount)} schneller`;
    case 'marketingEfficiency':
      return `Marketing +${pct(effect.amount)} wirksamer`;
    case 'supportEfficiency':
      return `Support +${pct(effect.amount)} effizienter`;
    case 'energyEfficiency':
      return `Energiekosten −${pct(effect.amount)}`;
    case 'logisticsCost':
      return `Logistikkosten −${pct(effect.amount)}`;
    case 'chipPerformance':
      return `Eigene ${effect.target.toUpperCase()}-Leistung +${pct(effect.amount)}`;
    case 'unlockSoftware':
      return `Softwareprojekt: ${SOFTWARE_PROJECTS.find((p) => p.id === effect.project)?.name ?? effect.project}`;
  }
}
