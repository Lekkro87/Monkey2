import type { Day, Id, ProductCategoryId, SegmentId } from './common';
import type { ComponentType } from './components';

export type ModifierTarget =
  | 'componentPrice'
  | 'componentSupply'
  | 'leadTime'
  | 'demand'
  | 'energyPrice'
  | 'rawMaterials'
  | 'shippingDelay'
  | 'factoryCapacity'
  | 'interestRate'
  | 'wages'
  | 'segmentDemand';

export interface ModifierFilter {
  componentTypes?: ComponentType[];
  manufacturerId?: Id;
  categories?: ProductCategoryId[];
  segments?: SegmentId[];
  shippingModes?: ('distributor' | 'truck' | 'ship' | 'air')[];
  factoryId?: Id;
}

export interface ActiveModifier {
  id: Id;
  source: string;
  label: string;
  target: ModifierTarget;
  filter?: ModifierFilter;
  /** Multiplikator (mode 'mul') oder additiver Wert (mode 'add'). */
  value: number;
  mode: 'mul' | 'add';
  startDay: Day;
  endDay: Day;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  cost: number;
}

export interface PendingDecision {
  id: Id;
  kind: 'recall';
  title: string;
  description: string;
  createdDay: Day;
  deadlineDay: Day;
  productId?: Id;
  affectedUnits: number;
  options: DecisionOption[];
  defaultOptionId: string;
}

export type NewsCategory = 'company' | 'market' | 'competitor' | 'economy' | 'event' | 'finance' | 'research' | 'achievement';

export interface NewsItem {
  id: Id;
  day: Day;
  category: NewsCategory;
  tone: 'positive' | 'negative' | 'neutral';
  title: string;
  body?: string;
}

export interface EventLogEntry {
  id: Id;
  eventId: string;
  day: Day;
  title: string;
}

export interface EventsState {
  modifiers: ActiveModifier[];
  decisions: PendingDecision[];
  log: EventLogEntry[];
  /** Frühester Tag, an dem ein Ereignistyp erneut auftreten darf. */
  cooldowns: Record<string, Day>;
  nextEventCheckDay: Day;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
}
