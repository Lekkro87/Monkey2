import type { Day, Id } from './common';
import type { FacilityId } from './production';

export type DepartmentId =
  | 'management'
  | 'engineering'
  | 'hardware'
  | 'software'
  | 'research'
  | 'production'
  | 'marketing'
  | 'sales'
  | 'logistics'
  | 'support'
  | 'finance';

export type EmployeeLevel = 'junior' | 'professional' | 'senior' | 'lead' | 'director';

export type TraitId =
  | 'perfectionist'
  | 'fast_learner'
  | 'team_player'
  | 'loyal'
  | 'ambitious'
  | 'creative'
  | 'efficient'
  | 'mentor';

export interface Employee {
  id: Id;
  firstName: string;
  lastName: string;
  age: number;
  department: DepartmentId;
  level: EmployeeLevel;
  skill: number;
  experience: number;
  salary: number;
  motivation: number;
  hiredDay: Day;
  facilityId?: FacilityId;
  trainingUntil?: Day;
  bonusBoostUntil?: Day;
  lastRaiseDay?: Day;
  traits: TraitId[];
  isFounder?: boolean;
}

export interface Candidate {
  id: Id;
  firstName: string;
  lastName: string;
  age: number;
  department: DepartmentId;
  level: EmployeeLevel;
  skill: number;
  experience: number;
  salaryExpectation: number;
  traits: TraitId[];
  expiresDay: Day;
}

export interface DepartmentStats {
  headcount: number;
  /** Effektive Vollzeitkapazität (Köpfe × Produktivität). */
  capacity: number;
  avgSkill: number;
  avgMotivation: number;
  payroll: number;
}

export interface RecruitingState {
  /** Offene Stellenausschreibung je Abteilung (Anzahl gewünschter Einstellungen). */
  openings: Partial<Record<DepartmentId, number>>;
  nextCandidateRefreshDay: Day;
}

export interface FacilityWorkforce {
  headcount: number;
  capacity: number;
}

export interface WorkforceState {
  employees: Employee[];
  candidates: Candidate[];
  stats: Record<DepartmentId, DepartmentStats>;
  /** Produktionspersonal je Standort ('workshop' oder Fabrik-ID). */
  facilityStats: Record<string, FacilityWorkforce>;
  totalPayroll: number;
  statsDirty: boolean;
  recruiting: RecruitingState;
  /** Tag der letzten Entlassung (senkt die Motivation aller). */
  lastLayoffDay: Day | null;
  layoffsLast90: number;
  quitsTotal: number;
}
