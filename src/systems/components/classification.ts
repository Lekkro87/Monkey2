import type { ComponentType } from '@/types';

/** Komponenten, deren Preise vom Halbleiterindex (Chipmangel) abhängen. */
export const COMPONENT_FAMILY_TYPES_SEMICONDUCTOR = new Set<ComponentType>([
  'cpu',
  'gpu',
  'gpu_chip',
  'soc',
  'ram',
  'vram',
  'storage',
  'chipset',
  'wafer',
  'mainboard',
  'wifi',
  'bluetooth',
]);

export const SEMICONDUCTOR_TYPES: ComponentType[] = [...COMPONENT_FAMILY_TYPES_SEMICONDUCTOR];
