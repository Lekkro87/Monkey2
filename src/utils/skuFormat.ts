import { COMPONENT_TYPE_LABELS } from '@/data/componentCatalog';
import type { ComponentSku, Tier } from '@/types';

export const TIER_LABELS: Record<Tier, string> = {
  budget: 'Einstieg',
  mainstream: 'Mittelklasse',
  performance: 'Oberklasse',
  enthusiast: 'High-End',
};

export const TIER_ORDER: Record<Tier, number> = { budget: 0, mainstream: 1, performance: 2, enthusiast: 3 };

function capacity(gb: number | undefined): string {
  if (!gb) return '';
  return gb >= 1024 ? `${(gb / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} TB` : `${gb} GB`;
}

/** Kurzbeschreibung der wichtigsten technischen Daten einer Komponente. */
export function skuSpecLabel(sku: ComponentSku): string {
  const s = sku.specs;
  switch (sku.type) {
    case 'cpu':
      return [s.cores ? `${s.cores} Kerne` : '', s.clockGhz ? `${s.clockGhz.toLocaleString('de-DE')} GHz` : '', `${sku.powerDraw} W`].filter(Boolean).join(' · ');
    case 'gpu':
    case 'gpu_chip':
      return [s.capacityGb ? capacity(s.capacityGb) : '', `${Math.round(sku.powerDraw)} W`].filter(Boolean).join(' · ');
    case 'soc':
      return `${sku.powerDraw.toLocaleString('de-DE')} W`;
    case 'ram':
    case 'vram':
    case 'storage':
      return [capacity(s.capacityGb), s.memoryType].filter(Boolean).join(' · ');
    case 'display':
      return [s.sizeInch ? `${String(s.sizeInch).replace('.', ',')}"` : '', s.resolution, s.panel, s.refreshHz ? `${s.refreshHz} Hz` : ''].filter(Boolean).join(' · ');
    case 'battery':
      return [s.capacityMah ? `${s.capacityMah.toLocaleString('de-DE')} mAh` : '', s.capacityWh ? `${s.capacityWh.toLocaleString('de-DE')} Wh` : ''].filter(Boolean).join(' · ');
    case 'camera':
      return s.cameraMp ? `${s.cameraMp} MP` : '';
    case 'cooler':
      return [s.level === 'standard' ? 'Standard' : s.level === 'performance' ? 'Performance' : s.level === 'extreme' ? 'Extreme' : '', s.coolingW ? `${s.coolingW} W Kühlleistung` : ''].filter(Boolean).join(' · ');
    case 'case':
      return s.material === 'plastic' ? 'Kunststoff' : s.material === 'aluminum' ? 'Aluminium' : s.material === 'premium' ? 'Premium' : '';
    case 'psu':
      return [s.wattage ? `${s.wattage} W` : '', s.efficiencyRating].filter(Boolean).join(' · ');
    case 'wifi':
    case 'bluetooth':
      return s.standard ?? '';
    case 'wafer':
      return s.processNm ? `${s.processNm} nm` : '';
    case 'pcb':
      return s.layers ? `${s.layers} Lagen` : '';
    default:
      return COMPONENT_TYPE_LABELS[sku.type];
  }
}

/** Filterbare Spezifikationswerte je Komponententyp. */
export function skuFilterKeys(sku: ComponentSku): Record<string, string> {
  const s = sku.specs;
  const keys: Record<string, string> = {};
  if (s.capacityGb && (sku.type === 'ram' || sku.type === 'storage' || sku.type === 'vram')) keys['Kapazität'] = capacity(s.capacityGb);
  if (s.sizeInch) keys['Größe'] = `${String(s.sizeInch).replace('.', ',')}"`;
  if (s.resolution) keys['Auflösung'] = s.resolution;
  if (s.refreshHz) keys['Bildrate'] = `${s.refreshHz} Hz`;
  if (s.panel) keys['Panel'] = s.panel;
  if (s.level) keys['Stufe'] = s.level === 'standard' ? 'Standard' : s.level === 'performance' ? 'Performance' : 'Extreme';
  if (s.material) keys['Material'] = s.material === 'plastic' ? 'Kunststoff' : s.material === 'aluminum' ? 'Aluminium' : 'Premium';
  return keys;
}
