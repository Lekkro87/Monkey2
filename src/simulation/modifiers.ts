import type { ActiveModifier, ComponentType, GameState, ModifierFilter, ModifierTarget, ProductCategoryId, SegmentId } from '@/types';
import { nextId } from './commands';

export interface ModifierContext {
  componentType?: ComponentType;
  manufacturerId?: string;
  category?: ProductCategoryId;
  segment?: SegmentId;
  shippingMode?: 'distributor' | 'truck' | 'ship' | 'air';
  factoryId?: string;
}

function matches(filter: ModifierFilter | undefined, ctx: ModifierContext): boolean {
  if (!filter) return true;
  if (filter.componentTypes && (!ctx.componentType || !filter.componentTypes.includes(ctx.componentType))) return false;
  if (filter.manufacturerId && filter.manufacturerId !== ctx.manufacturerId) return false;
  if (filter.categories && (!ctx.category || !filter.categories.includes(ctx.category))) return false;
  if (filter.segments && (!ctx.segment || !filter.segments.includes(ctx.segment))) return false;
  if (filter.shippingModes && (!ctx.shippingMode || !filter.shippingModes.includes(ctx.shippingMode))) return false;
  if (filter.factoryId && filter.factoryId !== ctx.factoryId) return false;
  return true;
}

/** Kombinierter Multiplikator aller aktiven Modifikatoren eines Ziels. */
export function multiplier(state: GameState, target: ModifierTarget, ctx: ModifierContext = {}): number {
  let value = 1;
  for (const mod of state.events.modifiers) {
    if (mod.target === target && mod.mode === 'mul' && matches(mod.filter, ctx)) value *= mod.value;
  }
  return value;
}

/** Summe aller additiven Modifikatoren eines Ziels. */
export function additive(state: GameState, target: ModifierTarget, ctx: ModifierContext = {}): number {
  let value = 0;
  for (const mod of state.events.modifiers) {
    if (mod.target === target && mod.mode === 'add' && matches(mod.filter, ctx)) value += mod.value;
  }
  return value;
}

export function addModifier(state: GameState, modifier: Omit<ActiveModifier, 'id' | 'startDay'>): ActiveModifier {
  const created: ActiveModifier = { ...modifier, id: nextId(state, 'mod'), startDay: state.time.day };
  state.events.modifiers.push(created);
  return created;
}

export function expireModifiers(state: GameState): void {
  const day = state.time.day;
  if (state.events.modifiers.some((m) => m.endDay <= day)) {
    state.events.modifiers = state.events.modifiers.filter((m) => m.endDay > day);
  }
}
