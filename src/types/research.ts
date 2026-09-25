import type { Day, ProductCategoryId } from './common';
import type { FeatureId } from './components';
import type { AttributeKey } from './products';
import type { AutomationLevel, QcLevelId } from './production';

export type TechCategory = 'cpu' | 'gpu' | 'mobile' | 'battery' | 'display' | 'manufacturing' | 'software' | 'business';

export type TechEffect =
  | { kind: 'unlockCategory'; category: ProductCategoryId }
  | { kind: 'unlockFeature'; feature: FeatureId }
  | { kind: 'attributeBonus'; attribute: AttributeKey; amount: number; categories?: ProductCategoryId[] }
  | { kind: 'productionEfficiency'; amount: number }
  | { kind: 'unlockAutomation'; level: AutomationLevel }
  | { kind: 'unlockQc'; level: QcLevelId }
  | { kind: 'defectReduction'; amount: number }
  | { kind: 'devSpeed'; amount: number }
  | { kind: 'devCost'; amount: number }
  | { kind: 'materialCost'; amount: number }
  | { kind: 'researchSpeed'; amount: number }
  | { kind: 'marketingEfficiency'; amount: number }
  | { kind: 'supportEfficiency'; amount: number }
  | { kind: 'energyEfficiency'; amount: number }
  | { kind: 'logisticsCost'; amount: number }
  | { kind: 'chipPerformance'; target: 'cpu' | 'gpu' | 'soc' | 'mainboard'; amount: number }
  | { kind: 'unlockSoftware'; project: string };

export interface TechnologyDef {
  id: string;
  name: string;
  description: string;
  category: TechCategory;
  tier: 1 | 2 | 3 | 4 | 5;
  cost: number;
  prerequisites: string[];
  minResearchers: number;
  minLabLevel: number;
  effects: TechEffect[];
}

export interface ActiveResearch {
  techId: string;
  progress: number;
  startedDay: Day;
}

export interface ResearchState {
  /** Wird bei Änderungen immer ersetzt (nie in-place mutiert), siehe research/effects.ts. */
  completed: Record<string, Day>;
  active: ActiveResearch | null;
  /** Bereits erarbeitete Punkte pausierter Projekte. */
  partialProgress: Record<string, number>;
  queue: string[];
  labLevel: number;
  labConstruction: { targetLevel: number; readyDay: Day } | null;
  pointsToday: number;
  totalPoints: number;
}

export interface LabDef {
  level: number;
  name: string;
  cost: number;
  monthlyCost: number;
  maxResearchers: number;
  speedMultiplier: number;
  buildDays: number;
  description: string;
}

export interface SoftwareProjectDef {
  id: string;
  name: string;
  description: string;
  requiredTech?: string;
  effort: number;
  cost: number;
  phases: string[];
  minDevelopers: number;
  effects: {
    softwareBonus?: number;
    innovationBonus?: number;
    removesOsLicense?: ProductCategoryId[];
    subscription?: { name: string; pricePerMonth: number; adoption: number; categories: ProductCategoryId[] };
    supportEfficiency?: number;
  };
}

export interface SoftwareProjectState {
  projectId: string;
  progress: number;
  phaseIndex: number;
  startedDay: Day;
  completedDay?: Day;
  /** Versionsstand; Updates halten die Software aktuell. */
  version: number;
}

export interface SoftwareState {
  projects: Record<string, SoftwareProjectState>;
  subscribers: Record<string, number>;
}
