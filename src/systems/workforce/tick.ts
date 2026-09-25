import { DEPARTMENTS, LEVELS } from '@/data/departments';
import { OFFICES } from '@/data/facilities';
import { addNews } from '@/simulation/news';
import { chance, gaussian } from '@/simulation/rng';
import type { Employee, GameState } from '@/types';
import { clamp } from '@/utils/math';
import { addTransaction } from '@/systems/finance/ledger';
import { employeeName, expectedSalary, officeCapacity, officeHeadcount, recomputeWorkforceStats } from './employees';
import { refreshCandidates } from './candidates';

export function payDailySalaries(state: GameState): void {
  if (state.workforce.statsDirty) recomputeWorkforceStats(state);
  const payroll = state.workforce.totalPayroll;
  if (payroll > 0) addTransaction(state, 'salaries', (-payroll * 12) / 365);
}

function motivationTarget(state: GameState, employee: Employee, context: MotivationContext): number {
  if (employee.isFounder) return 85;
  const expected = expectedSalary(state, employee.department, employee.level, employee.skill, employee.facilityId);
  const payRatio = employee.salary / Math.max(1, expected);
  let target = 58;
  target += clamp((payRatio - 1) * 70, -28, 16);
  target += context.officeBonus;
  target += (state.brand.reputation - 50) * 0.12;
  target += context.layoffPenalty;
  target += context.crisisPenalty;
  if (context.overcrowded) target -= 10;
  if (employee.bonusBoostUntil !== undefined && employee.bonusBoostUntil > state.time.day) target += 8;
  if (employee.lastRaiseDay !== undefined && state.time.day - employee.lastRaiseDay < 90) target += 4;
  if (context.teamPlayers.has(employee.department)) target += 3;
  if (employee.traits.includes('ambitious') && state.time.day - (employee.lastRaiseDay ?? employee.hiredDay) > 540) target -= 8;
  return clamp(target, 5, 98);
}

interface MotivationContext {
  officeBonus: number;
  layoffPenalty: number;
  crisisPenalty: number;
  overcrowded: boolean;
  teamPlayers: Set<string>;
  mentors: Set<string>;
}

export function weeklyWorkforceUpdate(state: GameState): void {
  const workforce = state.workforce;
  const day = state.time.day;
  if (workforce.lastLayoffDay !== null && day - workforce.lastLayoffDay > 90) {
    workforce.layoffsLast90 = 0;
    workforce.lastLayoffDay = null;
  }
  const context: MotivationContext = {
    officeBonus: (OFFICES[state.company.officeLevel] ?? OFFICES[0]).motivationBonus,
    layoffPenalty: workforce.lastLayoffDay !== null ? -Math.min(15, 3 + workforce.layoffsLast90 * 1.5) : 0,
    crisisPenalty: state.insolvency.stage === 'ok' ? 0 : state.insolvency.stage === 'warning' ? -6 : -14,
    overcrowded: officeHeadcount(state) > officeCapacity(state),
    teamPlayers: new Set(workforce.employees.filter((e) => e.traits.includes('team_player')).map((e) => e.department)),
    mentors: new Set(workforce.employees.filter((e) => e.traits.includes('mentor')).map((e) => e.department)),
  };

  const quitters: Employee[] = [];
  // Copy-on-Write: die Personalliste wird zwischen Snapshots geteilt.
  workforce.employees = workforce.employees.map((e) => ({ ...e }));
  for (const employee of workforce.employees) {
    const target = motivationTarget(state, employee, context);
    employee.motivation = clamp(employee.motivation + (target - employee.motivation) * 0.22 + gaussian(state, 0, 1.2), 0, 100);
    const learning = (employee.traits.includes('fast_learner') ? 2 : 1) * (context.mentors.has(employee.department) ? 1.25 : 1);
    employee.experience += (7 / 365) * learning;
    employee.skill = clamp(employee.skill + 0.05 * learning * (1 - employee.skill / 110), 0, 99);
    employee.age += 7 / 365;

    if (employee.isFounder) continue;
    let quitChance = 0.0012 + Math.max(0, 42 - employee.motivation) * 0.0011;
    const expected = expectedSalary(state, employee.department, employee.level, employee.skill, employee.facilityId);
    if (employee.skill >= 78 && employee.salary < expected * 0.95) quitChance += 0.006;
    if (employee.traits.includes('loyal')) quitChance *= 0.4;
    if (employee.age >= 66) quitChance += 0.05;
    if (chance(state, quitChance)) quitters.push(employee);
  }

  if (quitters.length > 0) {
    const ids = new Set(quitters.map((q) => q.id));
    workforce.employees = workforce.employees.filter((e) => !ids.has(e.id));
    workforce.quitsTotal += quitters.length;
    const notable = quitters.filter((q) => q.level !== 'junior' && q.level !== 'professional');
    for (const q of notable.slice(0, 3)) {
      const reason = q.age >= 66 ? 'geht in den Ruhestand' : q.motivation < 40 ? 'kündigt aus Unzufriedenheit' : 'wechselt zur Konkurrenz';
      addNews(state, 'company', 'negative', `${employeeName(q)} ${reason}`, `${LEVELS[q.level].name} in ${DEPARTMENTS[q.department].name}.`);
    }
    if (quitters.length >= 5) {
      addNews(state, 'company', 'negative', `${quitters.length} Kündigungen in dieser Woche`, 'Niedrige Motivation und zu geringe Gehälter treiben die Fluktuation.');
    }
  }
  workforce.statsDirty = true;
  recomputeWorkforceStats(state);
  if (day >= workforce.recruiting.nextCandidateRefreshDay) refreshCandidates(state);
}
