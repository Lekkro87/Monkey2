import { DEPARTMENTS, LEVELS, LEVEL_ORDER, RECRUITING_FEE_FACTOR, TRAINING_COST_PER_DAY } from '@/data/departments';
import { factoryWorkersNeeded, WORKSHOP_TOOLS } from '@/data/facilities';
import { FIRST_NAMES, LAST_NAMES } from '@/data/names';
import { CommandError, ensure, nextId } from '@/simulation/commands';
import { gaussian, pick, randomRange } from '@/simulation/rng';
import type { DepartmentId, Employee, EmployeeLevel, GameState } from '@/types';
import { clamp } from '@/utils/math';
import { addTransaction } from '@/systems/finance/ledger';
import { employeeName, expectedSalary, facilityHeadcount, officeCapacity, officeHeadcount } from './employees';

function findEmployee(state: GameState, employeeId: string): Employee {
  const employee = state.workforce.employees.find((e) => e.id === employeeId);
  if (!employee) throw new CommandError('Mitarbeiter:in nicht gefunden.');
  return employee;
}

/** Maximale Belegschaft eines Produktionsstandorts. */
export function facilityWorkerLimit(state: GameState, facilityId: string): number {
  if (facilityId === 'workshop') return WORKSHOP_TOOLS[state.production.workshop.toolLevel]?.maxWorkers ?? 0;
  const factory = state.production.factories.find((f) => f.id === facilityId);
  if (!factory) return 0;
  return Math.ceil(factoryWorkersNeeded(factory.level, factory.automation) * 1.25);
}

function checkPlacement(state: GameState, department: DepartmentId, facilityId: string | undefined, count: number): string | undefined {
  if (department === 'production') {
    const facility = facilityId ?? 'workshop';
    if (facility !== 'workshop') {
      ensure(
        state.production.factories.some((f) => f.id === facility),
        'Fabrik nicht gefunden.',
      );
    }
    const limit = facilityWorkerLimit(state, facility);
    if (facility === 'workshop' && limit === 0) throw new CommandError('Die Werkstatt hat noch keine Ausstattung. Kaufe zuerst Werkzeuge.');
    ensure(facilityHeadcount(state, facility) + count <= limit, `Maximal ${limit} Arbeitsplätze an diesem Standort.`);
    if (facility !== 'workshop') return facility;
  }
  const free = officeCapacity(state) - officeHeadcount(state);
  ensure(free >= count, free <= 0 ? 'Das Büro ist voll. Ziehe in ein größeres Büro um.' : `Im Büro ist nur noch Platz für ${free} Personen.`);
  return department === 'production' ? 'workshop' : undefined;
}

export function hireCandidate(state: GameState, candidateId: string, facilityId?: string): string {
  const candidate = state.workforce.candidates.find((c) => c.id === candidateId);
  ensure(candidate, 'Die Bewerbung ist nicht mehr verfügbar.');
  const placement = checkPlacement(state, candidate.department, facilityId, 1);
  const fee = candidate.salaryExpectation * RECRUITING_FEE_FACTOR;
  ensure(state.finance.cash >= fee, 'Nicht genügend Kapital.');
  addTransaction(state, 'recruiting', -fee);
  state.workforce.employees.push({
    id: nextId(state, 'emp'),
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    age: candidate.age,
    department: candidate.department,
    level: candidate.level,
    skill: candidate.skill,
    experience: candidate.experience,
    salary: candidate.salaryExpectation,
    motivation: 72,
    hiredDay: state.time.day,
    facilityId: placement,
    traits: [...candidate.traits],
  });
  state.workforce.candidates = state.workforce.candidates.filter((c) => c.id !== candidateId);
  const opening = state.workforce.recruiting.openings[candidate.department];
  if (opening) state.workforce.recruiting.openings[candidate.department] = Math.max(0, opening - 1);
  state.workforce.statsDirty = true;
  return `${employeeName(candidate)} (${DEPARTMENTS[candidate.department].name}) wurde eingestellt.`;
}

/** Massenrekrutierung über eine Personalagentur: sofort, aber durchschnittliche Qualität. */
export function bulkHire(state: GameState, department: DepartmentId, count: number, level: EmployeeLevel, facilityId?: string): string {
  ensure(Number.isInteger(count) && count >= 1 && count <= 5_000, 'Bitte zwischen 1 und 5.000 Personen angeben.');
  ensure(level === 'junior' || level === 'professional' || state.company.stage >= 3, 'Erfahrene Fachkräfte lassen sich erst ab Stufe 3 in großer Zahl gewinnen.');
  const placement = checkPlacement(state, department, facilityId, count);
  const baseSkill = level === 'junior' ? 40 : level === 'professional' ? 50 : 62;
  const salary = expectedSalary(state, department, level, baseSkill, placement);
  const fee = salary * (RECRUITING_FEE_FACTOR + 0.15) * count;
  ensure(state.finance.cash >= fee, `Nicht genügend Kapital. Die Agentur verlangt ${Math.round(fee).toLocaleString('de-DE')} €.`);
  addTransaction(state, 'recruiting', -fee);
  for (let i = 0; i < count; i++) {
    const skill = Math.round(clamp(gaussian(state, baseSkill, 7), 20, 90));
    state.workforce.employees.push({
      id: nextId(state, 'emp'),
      firstName: pick(state, FIRST_NAMES),
      lastName: pick(state, LAST_NAMES),
      age: Math.round(randomRange(state, 20, 45)),
      department,
      level,
      skill,
      experience: level === 'junior' ? randomRange(state, 0, 2) : randomRange(state, 2, 7),
      salary: expectedSalary(state, department, level, skill, placement),
      motivation: 65,
      hiredDay: state.time.day,
      facilityId: placement,
      traits: [],
    });
  }
  state.workforce.statsDirty = true;
  return `${count} ${DEPARTMENTS[department].name}-Mitarbeitende eingestellt (Agenturgebühr ${Math.round(fee).toLocaleString('de-DE')} €).`;
}

export function fireEmployee(state: GameState, employeeId: string): string {
  const employee = findEmployee(state, employeeId);
  ensure(!employee.isFounder, 'Die Gründerin bzw. der Gründer kann nicht entlassen werden.');
  const tenureYears = (state.time.day - employee.hiredDay) / 365;
  const severance = employee.salary * (1 + Math.min(6, tenureYears * 0.5));
  addTransaction(state, 'salaries', -severance);
  state.workforce.employees = state.workforce.employees.filter((e) => e.id !== employeeId);
  state.workforce.lastLayoffDay = state.time.day;
  state.workforce.layoffsLast90 += 1;
  for (const other of state.workforce.employees) {
    if (other.department === employee.department) other.motivation = clamp(other.motivation - 3, 0, 100);
  }
  state.workforce.statsDirty = true;
  return `${employeeName(employee)} wurde entlassen (Abfindung ${Math.round(severance).toLocaleString('de-DE')} €).`;
}

export function fireMany(state: GameState, employeeIds: string[]): string {
  ensure(employeeIds.length > 0, 'Keine Mitarbeitenden ausgewählt.');
  let total = 0;
  for (const id of employeeIds) {
    fireEmployee(state, id);
    total++;
  }
  return `${total} Mitarbeitende entlassen.`;
}

export function setSalary(state: GameState, employeeId: string, salary: number): string {
  const employee = findEmployee(state, employeeId);
  ensure(Number.isFinite(salary) && salary >= 0, 'Ungültiges Gehalt.');
  ensure(salary <= 1_000_000, 'Das Gehalt ist unrealistisch hoch.');
  const rounded = Math.round(salary / 10) * 10;
  const change = employee.salary > 0 ? rounded / employee.salary - 1 : 1;
  if (!employee.isFounder) {
    if (change >= 0.03) {
      employee.motivation = clamp(employee.motivation + Math.min(15, change * 60), 0, 100);
      employee.lastRaiseDay = state.time.day;
    } else if (change < -0.01) {
      employee.motivation = clamp(employee.motivation - Math.min(30, 10 + Math.abs(change) * 80), 0, 100);
    }
  }
  employee.salary = rounded;
  state.workforce.statsDirty = true;
  return `Gehalt von ${employeeName(employee)} auf ${rounded.toLocaleString('de-DE')} € angepasst.`;
}

export function adjustDepartmentSalaries(state: GameState, department: DepartmentId, factor: number): string {
  ensure(factor > 0.5 && factor < 2, 'Ungültige Anpassung.');
  let count = 0;
  for (const employee of state.workforce.employees) {
    if (employee.department !== department || employee.isFounder) continue;
    setSalary(state, employee.id, employee.salary * factor);
    count++;
  }
  ensure(count > 0, 'In dieser Abteilung arbeitet niemand.');
  return `Gehälter in ${DEPARTMENTS[department].name} um ${Math.round((factor - 1) * 100)} % angepasst (${count} Personen).`;
}

export function payBonus(state: GameState, target: { employeeId?: string; department?: DepartmentId }, amountPerPerson: number): string {
  ensure(amountPerPerson > 0, 'Der Bonus muss größer als 0 sein.');
  const recipients = state.workforce.employees.filter((e) =>
    target.employeeId ? e.id === target.employeeId : target.department ? e.department === target.department : true,
  );
  ensure(recipients.length > 0, 'Keine Empfänger:innen gefunden.');
  const total = amountPerPerson * recipients.length;
  ensure(state.finance.cash >= total, 'Nicht genügend Kapital.');
  addTransaction(state, 'salaries', -total);
  for (const employee of recipients) {
    const boost = clamp((amountPerPerson / Math.max(500, employee.salary)) * 25, 1, 18);
    employee.motivation = clamp(employee.motivation + boost, 0, 100);
    employee.bonusBoostUntil = state.time.day + 60;
  }
  state.workforce.statsDirty = true;
  return `Bonus an ${recipients.length} Personen ausgezahlt (${Math.round(total).toLocaleString('de-DE')} €).`;
}

export function startTraining(state: GameState, employeeId: string, days: number): string {
  const employee = findEmployee(state, employeeId);
  ensure([5, 10, 20].includes(days), 'Ungültige Dauer.');
  ensure(!employee.trainingUntil || employee.trainingUntil <= state.time.day, 'Bereits in einer Weiterbildung.');
  ensure(employee.skill < 97, 'Mehr kann diese Person nicht lernen.');
  const cost = TRAINING_COST_PER_DAY * days * state.economy.priceLevel;
  ensure(state.finance.cash >= cost, 'Nicht genügend Kapital.');
  addTransaction(state, 'training', -cost);
  employee.trainingUntil = state.time.day + days;
  const gain = days === 5 ? 3 : days === 10 ? 6 : 11;
  employee.skill = clamp(employee.skill + gain * (employee.traits.includes('fast_learner') ? 1.5 : 1), 0, 99);
  employee.motivation = clamp(employee.motivation + 4, 0, 100);
  state.workforce.statsDirty = true;
  return `${employeeName(employee)} ist ${days} Tage in Weiterbildung.`;
}

export function trainDepartment(state: GameState, department: DepartmentId, days: number): string {
  const members = state.workforce.employees.filter((e) => e.department === department && (!e.trainingUntil || e.trainingUntil <= state.time.day) && e.skill < 97);
  ensure(members.length > 0, 'Niemand in dieser Abteilung kann gerade geschult werden.');
  const cost = TRAINING_COST_PER_DAY * days * state.economy.priceLevel * members.length;
  ensure(state.finance.cash >= cost, 'Nicht genügend Kapital.');
  for (const member of members) startTraining(state, member.id, days);
  return `${members.length} Personen aus ${DEPARTMENTS[department].name} in Weiterbildung (${Math.round(cost).toLocaleString('de-DE')} €).`;
}

export function nextLevel(level: EmployeeLevel): EmployeeLevel | null {
  const index = LEVEL_ORDER.indexOf(level);
  return index >= 0 && index < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[index + 1] : null;
}

export function promoteEmployee(state: GameState, employeeId: string): string {
  const employee = findEmployee(state, employeeId);
  const target = nextLevel(employee.level);
  ensure(target, 'Bereits auf der höchsten Stufe.');
  const def = LEVELS[target];
  ensure(employee.skill >= def.minSkill, `Für ${def.name} wird ein Skill von mindestens ${def.minSkill} benötigt.`);
  ensure(employee.experience >= def.minExperience, `Für ${def.name} werden mindestens ${def.minExperience} Jahre Erfahrung benötigt.`);
  employee.level = target;
  const newSalary = Math.max(employee.salary * 1.1, expectedSalary(state, employee.department, target, employee.skill, employee.facilityId));
  employee.salary = Math.round(newSalary / 10) * 10;
  employee.motivation = clamp(employee.motivation + 12, 0, 100);
  employee.lastRaiseDay = state.time.day;
  state.workforce.statsDirty = true;
  return `${employeeName(employee)} wurde zum/zur ${def.name} befördert.`;
}

export function assignFacility(state: GameState, employeeId: string, facilityId: string): string {
  const employee = findEmployee(state, employeeId);
  ensure(employee.department === 'production', 'Nur Produktionspersonal kann Standorten zugewiesen werden.');
  if ((employee.facilityId ?? 'workshop') === facilityId) return 'Keine Änderung.';
  const limit = facilityWorkerLimit(state, facilityId);
  ensure(facilityHeadcount(state, facilityId) < limit, `Maximal ${limit} Arbeitsplätze an diesem Standort.`);
  if (facilityId === 'workshop') {
    ensure(officeHeadcount(state) < officeCapacity(state), 'Das Büro ist voll.');
  }
  employee.facilityId = facilityId;
  employee.salary = Math.max(employee.salary, expectedSalary(state, 'production', employee.level, employee.skill, facilityId) * 0.9);
  state.workforce.statsDirty = true;
  return `${employeeName(employee)} arbeitet jetzt am neuen Standort.`;
}

export function setRecruitingOpenings(state: GameState, department: DepartmentId, count: number): string {
  ensure(count >= 0 && count <= 50, 'Ungültige Anzahl.');
  state.workforce.recruiting.openings[department] = count;
  return count > 0 ? `Stellenausschreibung für ${DEPARTMENTS[department].name} aktiv.` : 'Stellenausschreibung beendet.';
}
