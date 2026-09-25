import { DEPARTMENT_IDS, DEPARTMENTS, LEVELS } from '@/data/departments';
import { getFactoryLocation } from '@/data/locations';
import { OFFICES } from '@/data/facilities';
import type { DepartmentId, DepartmentStats, Employee, EmployeeLevel, FacilityWorkforce, GameState } from '@/types';
import { clamp } from '@/utils/math';
import { wageLevel } from '@/systems/economy/economy';

export const FOUNDER_FILL_PER_DEPARTMENT = 0.5;
export const FOUNDER_FILL_TOTAL = 1.5;

/** Marktübliches Monatsgehalt für eine Stelle (inkl. Lohnniveau des Standorts). */
export function expectedSalary(state: GameState, department: DepartmentId, level: EmployeeLevel, skill: number, facilityId?: string): number {
  const skillFactor = 0.75 + 0.5 * (skill / 100);
  let locationFactor = wageLevel(state);
  if (department === 'production' && facilityId && facilityId !== 'workshop') {
    const factory = state.production.factories.find((f) => f.id === facilityId);
    if (factory) locationFactor = state.economy.wageIndex * getFactoryLocation(factory.locationId).wageFactor;
  }
  return Math.round(DEPARTMENTS[department].baseSalary * LEVELS[level].salaryFactor * skillFactor * locationFactor);
}

export function employeeProductivity(employee: Employee, day: number): number {
  if (employee.trainingUntil !== undefined && employee.trainingUntil > day) return 0;
  const level = LEVELS[employee.level].productivity;
  const skill = 0.5 + employee.skill / 100;
  const motivation = 0.6 + 0.8 * (employee.motivation / 100);
  let traits = 1;
  if (employee.traits.includes('efficient')) traits += 0.1;
  if (employee.traits.includes('ambitious')) traits += 0.05;
  if (employee.traits.includes('perfectionist')) traits -= 0.05;
  return level * skill * motivation * traits;
}

function emptyStats(): DepartmentStats {
  return { headcount: 0, capacity: 0, avgSkill: 0, avgMotivation: 0, payroll: 0 };
}

export function recomputeWorkforceStats(state: GameState): void {
  const stats = Object.fromEntries(DEPARTMENT_IDS.map((d) => [d, emptyStats()])) as Record<DepartmentId, DepartmentStats>;
  const facilityStats: Record<string, FacilityWorkforce> = {};
  const day = state.time.day;
  let totalPayroll = 0;
  for (const employee of state.workforce.employees) {
    const s = stats[employee.department];
    const productivity = employeeProductivity(employee, day);
    s.headcount += 1;
    s.capacity += productivity;
    s.avgSkill += employee.skill;
    s.avgMotivation += employee.motivation;
    s.payroll += employee.salary;
    totalPayroll += employee.salary;
    if (employee.department === 'production') {
      const facility = employee.facilityId ?? 'workshop';
      const entry = (facilityStats[facility] ??= { headcount: 0, capacity: 0 });
      entry.headcount += 1;
      entry.capacity += productivity;
    }
  }
  for (const s of Object.values(stats)) {
    if (s.headcount > 0) {
      s.avgSkill /= s.headcount;
      s.avgMotivation /= s.headcount;
    }
  }
  state.workforce.stats = stats;
  state.workforce.facilityStats = facilityStats;
  state.workforce.totalPayroll = totalPayroll;
  state.workforce.statsDirty = false;
}

/** Effizienzverlust, wenn zu wenige Führungskräfte zu viele Mitarbeitende koordinieren. */
export function managementEfficiency(state: GameState): number {
  const stats = state.workforce.stats;
  const management = Math.max(0.5, stats.management.capacity);
  const others = state.workforce.employees.length - stats.management.headcount;
  const ratio = others / (management * 12);
  if (ratio <= 1) return 1;
  return clamp(1 / (1 + 0.35 * (ratio - 1)), 0.55, 1);
}

/**
 * Solange die Firma klein ist, übernimmt die Gründerin/der Gründer unbesetzte Aufgaben
 * mit reduzierter Kapazität.
 */
export function founderFill(state: GameState): Partial<Record<DepartmentId, number>> {
  const fill: Partial<Record<DepartmentId, number>> = {};
  if (state.company.stage > 2) return fill;
  const stats = state.workforce.stats;
  const developing = state.products.some((p) => p.status === 'development');
  const producing = state.production.lines.some((l) => l.active && l.productId && l.facilityId === 'workshop');
  const researching = state.research.active !== null;
  const priorities: { dept: DepartmentId; needed: boolean }[] = [
    { dept: 'engineering', needed: developing },
    { dept: 'production', needed: producing },
    { dept: 'research', needed: researching },
    { dept: 'support', needed: true },
    { dept: 'sales', needed: true },
    { dept: 'marketing', needed: true },
    { dept: 'logistics', needed: true },
  ];
  let budget = FOUNDER_FILL_TOTAL;
  for (const { dept, needed } of priorities) {
    if (!needed || stats[dept].headcount > 0 || budget <= 0) continue;
    const amount = Math.min(FOUNDER_FILL_PER_DEPARTMENT, budget);
    fill[dept] = amount;
    budget -= amount;
  }
  return fill;
}

/** Effektive Kapazität (FTE × Produktivität) einer Abteilung inkl. Management-Effizienz. */
export function departmentCapacity(state: GameState, department: DepartmentId): number {
  const base = state.workforce.stats[department].capacity + (founderFill(state)[department] ?? 0);
  return base * (department === 'management' ? 1 : managementEfficiency(state));
}

export function departmentHeadcount(state: GameState, department: DepartmentId): number {
  return state.workforce.stats[department].headcount;
}

export function facilityCapacity(state: GameState, facilityId: string): number {
  const base = state.workforce.facilityStats[facilityId]?.capacity ?? 0;
  const fill = facilityId === 'workshop' ? (founderFill(state).production ?? 0) : 0;
  return (base + fill) * managementEfficiency(state);
}

export function facilityHeadcount(state: GameState, facilityId: string): number {
  return state.workforce.facilityStats[facilityId]?.headcount ?? 0;
}

/** Mitarbeitende, die Platz im Büro benötigen (alle außer Fabrikpersonal). */
export function officeHeadcount(state: GameState): number {
  let count = 0;
  for (const employee of state.workforce.employees) {
    if (employee.department === 'production' && employee.facilityId && employee.facilityId !== 'workshop') continue;
    count++;
  }
  return count;
}

export function officeCapacity(state: GameState): number {
  return (OFFICES[state.company.officeLevel] ?? OFFICES[0]).maxEmployees;
}

export function employeeName(employee: { firstName: string; lastName: string }): string {
  return `${employee.firstName} ${employee.lastName}`;
}
