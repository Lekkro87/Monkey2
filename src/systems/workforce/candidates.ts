import { DEPARTMENT_IDS, LEVELS, LEVEL_ORDER, TRAIT_IDS } from '@/data/departments';
import { FIRST_NAMES, LAST_NAMES } from '@/data/names';
import { nextId } from '@/simulation/commands';
import { chance, gaussian, pick, randomInt, randomRange, weightedPick } from '@/simulation/rng';
import type { Candidate, DepartmentId, EmployeeLevel, GameState, TraitId } from '@/types';
import { clamp } from '@/utils/math';
import { expectedSalary } from './employees';

const DEPARTMENT_WEIGHTS: Record<DepartmentId, number> = {
  management: 0.6,
  engineering: 1.4,
  hardware: 0.9,
  software: 1,
  research: 0.9,
  production: 1.6,
  marketing: 0.8,
  sales: 0.8,
  logistics: 0.7,
  support: 0.9,
  finance: 0.6,
};

const LEVEL_BASE_SKILL: Record<EmployeeLevel, number> = {
  junior: 38,
  professional: 52,
  senior: 66,
  lead: 76,
  director: 86,
};

const LEVEL_EXPERIENCE: Record<EmployeeLevel, [number, number]> = {
  junior: [0, 2],
  professional: [2, 6],
  senior: [5, 12],
  lead: [8, 18],
  director: [12, 25],
};

/** Verfügbare Karrierestufen hängen von Größe und Ruf des Unternehmens ab. */
function levelWeights(state: GameState): Record<EmployeeLevel, number> {
  const stage = state.company.stage;
  const reputation = state.brand.reputation;
  return {
    junior: 4,
    professional: 4,
    senior: stage >= 2 || reputation > 55 ? 2.2 : 0.8,
    lead: stage >= 3 || reputation > 65 ? 1.2 : 0.15,
    director: stage >= 4 ? 0.7 : stage >= 3 ? 0.2 : 0,
  };
}

function randomTraits(state: GameState): TraitId[] {
  const traits: TraitId[] = [];
  const count = weightedPick(state, [0, 1, 2], (n) => (n === 0 ? 5 : n === 1 ? 4 : 1)) ?? 0;
  while (traits.length < count) {
    const trait = pick(state, TRAIT_IDS);
    if (!traits.includes(trait)) traits.push(trait);
  }
  return traits;
}

export function generateCandidate(state: GameState, department?: DepartmentId, level?: EmployeeLevel): Candidate {
  const dept = department ?? weightedPick(state, DEPARTMENT_IDS, (d) => DEPARTMENT_WEIGHTS[d] * (1 + (state.workforce.recruiting.openings[d] ?? 0))) ?? 'engineering';
  const weights = levelWeights(state);
  const lvl = level ?? weightedPick(state, LEVEL_ORDER, (l) => weights[l]) ?? 'junior';
  const [minExp, maxExp] = LEVEL_EXPERIENCE[lvl];
  const experience = Math.round(randomRange(state, minExp, maxExp) * 10) / 10;
  const reputationBonus = (state.brand.reputation - 50) * 0.1;
  const skill = Math.round(clamp(gaussian(state, LEVEL_BASE_SKILL[lvl] + reputationBonus, 8), Math.max(15, LEVELS[lvl].minSkill - 8), 98));
  const age = Math.round(21 + experience + randomRange(state, 0, 8));
  const base = expectedSalary(state, dept, lvl, skill);
  const salaryExpectation = Math.round((base * randomRange(state, 0.92, 1.15)) / 50) * 50;
  return {
    id: nextId(state, 'cand'),
    firstName: pick(state, FIRST_NAMES),
    lastName: pick(state, LAST_NAMES),
    age,
    department: dept,
    level: lvl,
    skill,
    experience,
    salaryExpectation,
    traits: randomTraits(state),
    expiresDay: state.time.day + randomInt(state, 14, 35),
  };
}

const TARGET_POOL = 18;

/** Entfernt abgelaufene Bewerbungen und füllt den Pool wöchentlich auf. */
export function refreshCandidates(state: GameState): void {
  const day = state.time.day;
  state.workforce.candidates = state.workforce.candidates.filter((c) => c.expiresDay > day);
  const openings = Object.values(state.workforce.recruiting.openings).reduce((a, b) => a + (b ?? 0), 0);
  const target = TARGET_POOL + Math.min(12, openings * 2);
  let missing = target - state.workforce.candidates.length;
  const newCount = Math.min(missing, randomInt(state, 3, 7) + Math.min(6, openings));
  for (let i = 0; i < newCount; i++) {
    state.workforce.candidates.push(generateCandidate(state));
    missing--;
  }
  // Ausgeschriebene Stellen erhalten gezielt Bewerbungen.
  for (const [dept, count] of Object.entries(state.workforce.recruiting.openings) as [DepartmentId, number][]) {
    if (!count) continue;
    const existing = state.workforce.candidates.filter((c) => c.department === dept).length;
    if (existing < Math.min(6, count + 1) && chance(state, 0.8)) state.workforce.candidates.push(generateCandidate(state, dept));
  }
  state.workforce.recruiting.nextCandidateRefreshDay = day + 7;
}

export function initialCandidates(state: GameState): Candidate[] {
  const list: Candidate[] = [];
  const guaranteed: DepartmentId[] = ['engineering', 'engineering', 'production', 'production', 'research', 'marketing', 'sales', 'support'];
  for (const dept of guaranteed) list.push(generateCandidate(state, dept, chance(state, 0.6) ? 'junior' : 'professional'));
  for (let i = 0; i < 8; i++) list.push(generateCandidate(state));
  return list;
}
