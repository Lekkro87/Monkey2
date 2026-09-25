import clsx from 'clsx';
import { ArrowUpCircle, GraduationCap, Gift, Search, UserMinus, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEPARTMENT_IDS, DEPARTMENTS, LEVELS, RECRUITING_FEE_FACTOR, TRAINING_COST_PER_DAY, TRAITS } from '@/data/departments';
import { OFFICES } from '@/data/facilities';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { Field, NumberInput, Segmented, Select, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/Progress';
import { KeyValue, StatCard } from '@/components/ui/Stat';
import {
  adjustDepartmentSalaries,
  assignFacility,
  bulkHire,
  facilityWorkerLimit,
  fireEmployee,
  hireCandidate,
  nextLevel,
  payBonus,
  promoteEmployee,
  setRecruitingOpenings,
  setSalary,
  startTraining,
  trainDepartment,
} from '@/systems/workforce/commands';
import { employeeName, expectedSalary, facilityHeadcount, managementEfficiency, officeCapacity, officeHeadcount } from '@/systems/workforce/employees';
import { useGameStore } from '@/store/gameStore';
import type { Candidate, DepartmentId, Employee, EmployeeLevel, GameState } from '@/types';
import { formatMoney, formatNumber, formatPercent } from '@/utils/format';

type Tab = 'departments' | 'candidates' | 'staff';

const PAGE_SIZE = 40;

function facilityLabel(game: GameState, facilityId: string | undefined): string {
  if (!facilityId || facilityId === 'workshop') return 'Werkstatt';
  return game.production.factories.find((f) => f.id === facilityId)?.name ?? 'Fabrik';
}

/** Produktionsstandorte, an die Personal vermittelt werden kann. */
function productionFacilities(game: GameState): { id: string; name: string; used: number; limit: number }[] {
  const list = [{ id: 'workshop', name: 'Werkstatt', used: facilityHeadcount(game, 'workshop'), limit: facilityWorkerLimit(game, 'workshop') }];
  for (const factory of game.production.factories) {
    list.push({ id: factory.id, name: factory.name, used: facilityHeadcount(game, factory.id), limit: facilityWorkerLimit(game, factory.id) });
  }
  return list;
}

function motivationTone(value: number): 'good' | 'accent' | 'warn' | 'bad' {
  return value >= 70 ? 'good' : value >= 50 ? 'accent' : value >= 35 ? 'warn' : 'bad';
}

function TraitBadges({ traits }: { traits: Employee['traits'] }) {
  if (traits.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {traits.map((t) => (
        <Badge key={t} tone="info" title={TRAITS[t].description}>
          {TRAITS[t].name}
        </Badge>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Agentur-Einstellung
// ---------------------------------------------------------------------------

function BulkHireModal({ initialDepartment, onClose }: { initialDepartment: DepartmentId; onClose: () => void }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const [department, setDepartment] = useState<DepartmentId>(initialDepartment);
  const [level, setLevel] = useState<EmployeeLevel>('junior');
  const [count, setCount] = useState(1);
  const facilities = productionFacilities(game);
  const [facilityId, setFacilityId] = useState(facilities.find((f) => f.limit > f.used)?.id ?? 'workshop');

  const baseSkill = level === 'junior' ? 40 : level === 'professional' ? 50 : 62;
  const placement = department === 'production' ? facilityId : undefined;
  const salary = expectedSalary(game, department, level, baseSkill, placement);
  const fee = salary * (RECRUITING_FEE_FACTOR + 0.15) * count;
  const freeOffice = officeCapacity(game) - officeHeadcount(game);
  const facility = facilities.find((f) => f.id === facilityId);
  const freeSlots = department === 'production' && facility ? (facility.id === 'workshop' ? Math.min(facility.limit - facility.used, freeOffice) : facility.limit - facility.used) : freeOffice;

  const submit = () => {
    const result = execute((d) => bulkHire(d, department, count, level, placement));
    if (result.ok) onClose();
  };

  return (
    <Modal
      open
      title="Personal über Agentur einstellen"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-sm text-muted">
            Agenturgebühr: <strong className="text-ink tabular">{formatMoney(fee)}</strong>
          </span>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={submit} disabled={count < 1 || count > freeSlots}>
            {count} einstellen
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">Die Agentur besetzt Stellen sofort, aber mit durchschnittlicher Qualität und ohne besondere Eigenschaften. Für Spitzenkräfte lohnt sich der Blick in die Bewerbungen.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Abteilung">
          <Select value={department} onChange={(e) => setDepartment(e.target.value as DepartmentId)}>
            {DEPARTMENT_IDS.map((d) => (
              <option key={d} value={d}>
                {DEPARTMENTS[d].name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Karrierestufe">
          <Select value={level} onChange={(e) => setLevel(e.target.value as EmployeeLevel)}>
            <option value="junior">Junior</option>
            <option value="professional">Professional</option>
            <option value="senior" disabled={game.company.stage < 3}>
              Senior{game.company.stage < 3 ? ' (ab Stufe 3)' : ''}
            </option>
          </Select>
        </Field>
        <Field label="Anzahl" hint={`Freie Plätze: ${formatNumber(Math.max(0, freeSlots))}`}>
          <NumberInput value={count} min={1} max={5000} step={1} onChange={(v) => setCount(Math.max(1, Math.floor(v)))} />
        </Field>
        {department === 'production' && (
          <Field label="Standort">
            <Select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.used}/{f.limit})
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="mt-4 rounded-lg border border-line/60 bg-surface/40 px-3 py-2">
        <KeyValue label="Gehalt je Person (ca.)" value={`${formatMoney(salary)}/Monat`} />
        <KeyValue label="Zusätzliche Personalkosten" value={`${formatMoney(salary * count)}/Monat`} />
        <KeyValue label="Kasse" value={formatMoney(game.finance.cash)} />
      </div>
      {count > freeSlots && (
        <p className="mt-3 text-sm text-red-400">
          {department === 'production' && facility && facility.limit === 0
            ? 'Die Werkstatt hat noch keine Ausstattung – kaufe zuerst Werkzeuge (Produktion).'
            : `Nicht genug Platz: nur ${Math.max(0, freeSlots)} freie Arbeitsplätze.`}
        </p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Abteilungen
// ---------------------------------------------------------------------------

function BonusModal({ target, onClose }: { target: { department?: DepartmentId; employee?: Employee }; onClose: () => void }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const [amount, setAmount] = useState(500);
  const recipients = target.employee ? 1 : game.workforce.employees.filter((e) => e.department === target.department).length;
  const label = target.employee ? employeeName(target.employee) : DEPARTMENTS[target.department!].name;
  const submit = () => {
    const result = execute((d) => payBonus(d, target.employee ? { employeeId: target.employee.id } : { department: target.department }, amount));
    if (result.ok) onClose();
  };
  return (
    <Modal
      open
      width="sm"
      title={`Bonus: ${label}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={submit} disabled={amount <= 0 || recipients === 0}>
            {formatMoney(amount * recipients)} auszahlen
          </Button>
        </>
      }
    >
      <Field label="Bonus je Person" hint="Ein Bonus hebt die Motivation sofort und hält sie 60 Tage lang höher.">
        <NumberInput value={amount} min={50} step={50} suffix="€" onChange={(v) => setAmount(Math.max(0, Math.round(v)))} />
      </Field>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[250, 500, 1_000, 2_500, 5_000].map((v) => (
          <Button key={v} size="xs" variant={amount === v ? 'primary' : 'secondary'} onClick={() => setAmount(v)}>
            {formatMoney(v)}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        Empfänger:innen: <strong className="text-ink">{recipients}</strong>
      </p>
    </Modal>
  );
}

function DepartmentsTab({ onHire }: { onHire: (department: DepartmentId) => void }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const [bonusFor, setBonusFor] = useState<DepartmentId | null>(null);
  const stats = game.workforce.stats;
  return (
    <Card title="Abteilungen" subtitle="Kapazität = Köpfe × Produktivität (Skill, Motivation, Stufe). Die Gründerin/der Gründer springt in kleinen Firmen ein." bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Abteilung</th>
              <th className="px-3 py-2 text-right font-medium">Köpfe</th>
              <th className="px-3 py-2 text-right font-medium">Kapazität</th>
              <th className="px-3 py-2 text-right font-medium">Ø Skill</th>
              <th className="px-3 py-2 text-left font-medium">Ø Motivation</th>
              <th className="px-3 py-2 text-right font-medium">Kosten/Monat</th>
              <th className="px-3 py-2 text-left font-medium">Ausschreibung</th>
              <th className="px-3 py-2 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {DEPARTMENT_IDS.map((id) => {
              const s = stats[id];
              const opening = game.workforce.recruiting.openings[id] ?? 0;
              const trainCost = TRAINING_COST_PER_DAY * 5 * game.economy.priceLevel * s.headcount;
              return (
                <tr key={id} className="border-t border-line/50 align-middle">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: DEPARTMENTS[id].color }} />
                      <span className="font-medium">{DEPARTMENTS[id].name}</span>
                    </div>
                    <div className="mt-0.5 max-w-xs text-xs text-muted">{DEPARTMENTS[id].description}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">{s.headcount}</td>
                  <td className="px-3 py-2.5 text-right tabular">{formatNumber(s.capacity, 1)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{s.headcount ? formatNumber(s.avgSkill) : '–'}</td>
                  <td className="px-3 py-2.5">
                    {s.headcount ? (
                      <div className="w-24">
                        <div className="mb-0.5 text-xs tabular">{formatNumber(s.avgMotivation)}</div>
                        <ProgressBar value={s.avgMotivation} max={100} tone={motivationTone(s.avgMotivation)} height="h-1.5" />
                      </div>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">{formatMoney(s.payroll)}</td>
                  <td className="px-3 py-2.5">
                    <div className="w-20" title="Gezielte Stellenausschreibung: mehr Bewerbungen für diese Abteilung">
                      <NumberInput value={opening} min={0} max={50} step={1} className="py-1" onChange={(v) => execute((d) => setRecruitingOpenings(d, id, Math.max(0, Math.min(50, Math.floor(v)))), { silent: true })} aria-label={`Ausschreibung ${DEPARTMENTS[id].name}`} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="xs" icon={<UserPlus size={13} />} onClick={() => onHire(id)}>
                        Einstellen
                      </Button>
                      <Button size="xs" variant="ghost" icon={<GraduationCap size={13} />} disabled={s.headcount === 0} title={`5 Tage Schulung für alle (${formatMoney(trainCost)})`} onClick={() => execute((d) => trainDepartment(d, id, 5))}>
                        Schulung
                      </Button>
                      <Button size="xs" variant="ghost" icon={<Gift size={13} />} disabled={s.headcount === 0} onClick={() => setBonusFor(id)}>
                        Bonus
                      </Button>
                      <Button size="xs" variant="ghost" disabled={s.headcount === 0} title="Alle Gehälter +5 %" onClick={() => execute((d) => adjustDepartmentSalaries(d, id, 1.05))}>
                        +5 %
                      </Button>
                      <Button size="xs" variant="ghost" disabled={s.headcount === 0} title="Alle Gehälter −5 % (senkt die Motivation deutlich)" onClick={() => execute((d) => adjustDepartmentSalaries(d, id, 0.95))}>
                        −5 %
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {bonusFor && <BonusModal target={{ department: bonusFor }} onClose={() => setBonusFor(null)} />}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Bewerbungen
// ---------------------------------------------------------------------------

function CandidateRow({ candidate }: { candidate: Candidate }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const facilities = candidate.department === 'production' ? productionFacilities(game) : [];
  const [facilityId, setFacilityId] = useState(facilities.find((f) => f.limit > f.used)?.id ?? 'workshop');
  const fee = candidate.salaryExpectation * RECRUITING_FEE_FACTOR;
  const daysLeft = candidate.expiresDay - game.time.day;
  return (
    <tr className="border-t border-line/50">
      <td className="px-4 py-2.5">
        <div className="font-medium">{employeeName(candidate)}</div>
        <div className="text-xs text-muted">
          {candidate.age} Jahre · {formatNumber(candidate.experience, 1)} J. Erfahrung
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: DEPARTMENTS[candidate.department].color }} />
          {DEPARTMENTS[candidate.department].name}
        </div>
        <div className="text-xs text-muted">{LEVELS[candidate.level].name}</div>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className={clsx('font-semibold tabular', candidate.skill >= 75 ? 'text-emerald-300' : candidate.skill < 40 && 'text-muted')}>{candidate.skill}</span>
      </td>
      <td className="px-3 py-2.5">
        <TraitBadges traits={candidate.traits} />
      </td>
      <td className="px-3 py-2.5 text-right tabular">
        {formatMoney(candidate.salaryExpectation)}
        <div className="text-[11px] text-muted">Gebühr {formatMoney(fee)}</div>
      </td>
      <td className={clsx('px-3 py-2.5 text-right text-xs tabular', daysLeft <= 5 ? 'text-amber-300' : 'text-muted')}>{daysLeft} T.</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          {facilities.length > 1 && (
            <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)} className="rounded border border-line bg-surface px-1.5 py-1 text-xs" aria-label="Standort">
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.used}/{f.limit})
                </option>
              ))}
            </select>
          )}
          <Button size="xs" variant="primary" icon={<UserPlus size={13} />} onClick={() => execute((d) => hireCandidate(d, candidate.id, candidate.department === 'production' ? facilityId : undefined))}>
            Einstellen
          </Button>
        </div>
      </td>
    </tr>
  );
}

function CandidatesTab() {
  const game = useGameStore((s) => s.game!);
  const [filter, setFilter] = useState<DepartmentId | 'all'>('all');
  const candidates = game.workforce.candidates
    .filter((c) => filter === 'all' || c.department === filter)
    .slice()
    .sort((a, b) => a.department.localeCompare(b.department) || b.skill - a.skill);
  const nextRefresh = Math.max(0, game.workforce.recruiting.nextCandidateRefreshDay - game.time.day);
  return (
    <Card
      title={`Bewerbungen (${game.workforce.candidates.length})`}
      subtitle={`Neue Bewerbungen treffen wöchentlich ein (nächste in ${nextRefresh} Tagen). Ruf und Unternehmensstufe bestimmen, wie erfahren die Bewerber:innen sind.`}
      actions={
        <Select value={filter} onChange={(e) => setFilter(e.target.value as DepartmentId | 'all')} className="w-auto py-1.5 text-xs" aria-label="Abteilung filtern">
          <option value="all">Alle Abteilungen</option>
          {DEPARTMENT_IDS.map((d) => (
            <option key={d} value={d}>
              {DEPARTMENTS[d].name}
            </option>
          ))}
        </Select>
      }
      bodyClassName="p-0"
    >
      {candidates.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<Users size={26} />} title="Keine passenden Bewerbungen" description="Schreibe unter „Abteilungen“ Stellen aus, um gezielt Bewerbungen zu erhalten – oder stelle über eine Agentur ein." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Abteilung</th>
                <th className="px-3 py-2 text-right font-medium">Skill</th>
                <th className="px-3 py-2 text-left font-medium">Eigenschaften</th>
                <th className="px-3 py-2 text-right font-medium">Gehaltswunsch</th>
                <th className="px-3 py-2 text-right font-medium">Frist</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <CandidateRow key={c.id} candidate={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Belegschaft
// ---------------------------------------------------------------------------

function SalaryModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const [salary, setSalaryValue] = useState(employee.salary);
  const market = expectedSalary(game, employee.department, employee.level, employee.skill, employee.facilityId);
  const submit = () => {
    const result = execute((d) => setSalary(d, employee.id, salary));
    if (result.ok) onClose();
  };
  return (
    <Modal
      open
      width="sm"
      title={`Gehalt: ${employeeName(employee)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={submit}>
            Übernehmen
          </Button>
        </>
      }
    >
      <Field label="Monatsgehalt (brutto)" hint="Gehaltserhöhungen ab 3 % motivieren; Kürzungen demotivieren stark.">
        <NumberInput value={salary} min={0} step={50} suffix="€" onChange={(v) => setSalaryValue(Math.max(0, v))} />
      </Field>
      <div className="mt-3 rounded-lg border border-line/60 bg-surface/40 px-3 py-2">
        <KeyValue label="Aktuell" value={formatMoney(employee.salary)} />
        <KeyValue label="Marktüblich" value={formatMoney(market)} />
        <KeyValue label="Verhältnis zum Markt" value={formatPercent(salary / Math.max(1, market), 0)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="xs" onClick={() => setSalaryValue(Math.round(market / 10) * 10)}>
          Marktüblich
        </Button>
        <Button size="xs" onClick={() => setSalaryValue(Math.round((employee.salary * 1.05) / 10) * 10)}>
          +5 %
        </Button>
        <Button size="xs" onClick={() => setSalaryValue(Math.round((employee.salary * 1.1) / 10) * 10)}>
          +10 %
        </Button>
      </div>
    </Modal>
  );
}

function FireModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const tenureYears = (game.time.day - employee.hiredDay) / 365;
  const severance = employee.salary * (1 + Math.min(6, tenureYears * 0.5));
  const submit = () => {
    const result = execute((d) => fireEmployee(d, employee.id));
    if (result.ok) onClose();
  };
  return (
    <Modal
      open
      width="sm"
      title={`${employeeName(employee)} entlassen?`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="danger" onClick={submit}>
            Entlassen
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">Entlassungen senken die Motivation der Abteilung und – bei mehreren Kündigungen – die Stimmung im ganzen Unternehmen.</p>
      <div className="mt-3 rounded-lg border border-line/60 bg-surface/40 px-3 py-2">
        <KeyValue label="Betriebszugehörigkeit" value={`${formatNumber(tenureYears, 1)} Jahre`} />
        <KeyValue label="Abfindung" value={formatMoney(severance)} />
        <KeyValue label="Ersparnis pro Monat" value={formatMoney(employee.salary)} />
      </div>
    </Modal>
  );
}

function EmployeeRow({ employee, onSalary, onFire, onBonus }: { employee: Employee; onSalary: () => void; onFire: () => void; onBonus: () => void }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const training = employee.trainingUntil !== undefined && employee.trainingUntil > game.time.day;
  const target = nextLevel(employee.level);
  const promotable = target !== null && employee.skill >= LEVELS[target].minSkill && employee.experience >= LEVELS[target].minExperience;
  const facilities = employee.department === 'production' && game.production.factories.length > 0 ? productionFacilities(game) : [];
  return (
    <tr className="border-t border-line/50">
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5 font-medium">
          {employeeName(employee)}
          {employee.isFounder && <Badge tone="accent">Gründer:in</Badge>}
          {training && <Badge tone="info">Schulung bis Tag {employee.trainingUntil}</Badge>}
        </div>
        <div className="mt-0.5">
          <TraitBadges traits={employee.traits} />
        </div>
      </td>
      <td className="px-3 py-2">
        <div>{DEPARTMENTS[employee.department].name}</div>
        <div className="text-xs text-muted">
          {LEVELS[employee.level].name}
          {employee.department === 'production' && ` · ${facilityLabel(game, employee.facilityId)}`}
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular">{formatNumber(employee.skill)}</td>
      <td className="px-3 py-2 text-right tabular">{formatNumber(employee.experience, 1)}</td>
      <td className="px-3 py-2">
        <div className="w-20">
          <div className="mb-0.5 text-xs tabular">{formatNumber(employee.motivation)}</div>
          <ProgressBar value={employee.motivation} max={100} tone={motivationTone(employee.motivation)} height="h-1.5" />
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular">
        <button type="button" className="hover:underline disabled:no-underline" onClick={onSalary} disabled={employee.isFounder}>
          {formatMoney(employee.salary)}
        </button>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center justify-end gap-1">
          {facilities.length > 0 && (
            <select
              value={employee.facilityId ?? 'workshop'}
              onChange={(e) => execute((d) => assignFacility(d, employee.id, e.target.value))}
              className="rounded border border-line bg-surface px-1.5 py-1 text-xs"
              aria-label="Standort"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          {target && !employee.isFounder && (
            <Button
              size="xs"
              variant="ghost"
              icon={<ArrowUpCircle size={13} />}
              disabled={!promotable}
              title={promotable ? `Zu ${LEVELS[target].name} befördern` : `${LEVELS[target].name}: Skill ≥ ${LEVELS[target].minSkill}, Erfahrung ≥ ${LEVELS[target].minExperience} J.`}
              onClick={() => execute((d) => promoteEmployee(d, employee.id))}
            >
              Befördern
            </Button>
          )}
          <Button size="xs" variant="ghost" icon={<GraduationCap size={13} />} disabled={training} title={`10 Tage Weiterbildung (${formatMoney(TRAINING_COST_PER_DAY * 10 * game.economy.priceLevel)})`} onClick={() => execute((d) => startTraining(d, employee.id, 10))}>
            Schulung
          </Button>
          <Button size="xs" variant="ghost" icon={<Gift size={13} />} onClick={onBonus} aria-label="Bonus" />
          {!employee.isFounder && <Button size="xs" variant="ghost" icon={<UserMinus size={13} />} onClick={onFire} aria-label="Entlassen" className="hover:text-red-300" />}
        </div>
      </td>
    </tr>
  );
}

type SortKey = 'name' | 'skill' | 'motivation' | 'salary';

function StaffTab() {
  const game = useGameStore((s) => s.game!);
  const [filter, setFilter] = useState<DepartmentId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('skill');
  const [page, setPage] = useState(0);
  const [salaryFor, setSalaryFor] = useState<Employee | null>(null);
  const [fireFor, setFireFor] = useState<Employee | null>(null);
  const [bonusFor, setBonusFor] = useState<Employee | null>(null);
  const employees = game.workforce.employees;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = employees.filter((e) => (filter === 'all' || e.department === filter) && (!q || employeeName(e).toLowerCase().includes(q)));
    const sorter: Record<SortKey, (a: Employee, b: Employee) => number> = {
      name: (a, b) => a.lastName.localeCompare(b.lastName),
      skill: (a, b) => b.skill - a.skill,
      motivation: (a, b) => a.motivation - b.motivation,
      salary: (a, b) => b.salary - a.salary,
    };
    return list.sort(sorter[sort]);
  }, [employees, filter, query, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  // Aktuelle Objekte für Modals nachschlagen (Werte ändern sich im Spielverlauf).
  const fresh = (e: Employee | null) => (e ? (employees.find((x) => x.id === e.id) ?? null) : null);
  const salaryEmployee = fresh(salaryFor);
  const fireEmployeeCurrent = fresh(fireFor);
  const bonusEmployee = fresh(bonusFor);

  return (
    <Card
      title={`Belegschaft (${formatNumber(employees.length)})`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <TextInput value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Name suchen" className="w-40 py-1.5 pl-7 text-xs" aria-label="Name suchen" />
          </div>
          <Select value={filter} onChange={(e) => { setFilter(e.target.value as DepartmentId | 'all'); setPage(0); }} className="w-auto py-1.5 text-xs" aria-label="Abteilung filtern">
            <option value="all">Alle Abteilungen</option>
            {DEPARTMENT_IDS.map((d) => (
              <option key={d} value={d}>
                {DEPARTMENTS[d].name}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto py-1.5 text-xs" aria-label="Sortierung">
            <option value="skill">Nach Skill</option>
            <option value="motivation">Geringste Motivation zuerst</option>
            <option value="salary">Nach Gehalt</option>
            <option value="name">Nach Name</option>
          </Select>
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Abteilung</th>
              <th className="px-3 py-2 text-right font-medium">Skill</th>
              <th className="px-3 py-2 text-right font-medium">Erfahrung</th>
              <th className="px-3 py-2 text-left font-medium">Motivation</th>
              <th className="px-3 py-2 text-right font-medium">Gehalt</th>
              <th className="px-3 py-2 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <EmployeeRow key={e.id} employee={e} onSalary={() => setSalaryFor(e)} onFire={() => setFireFor(e)} onBonus={() => setBonusFor(e)} />
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="p-4 text-sm text-muted">Keine Mitarbeitenden gefunden.</p>}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line/60 px-4 py-2 text-xs text-muted">
          <span>
            {current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)} von {formatNumber(filtered.length)}
          </span>
          <div className="flex gap-1">
            <Button size="xs" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Zurück
            </Button>
            <Button size="xs" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Weiter
            </Button>
          </div>
        </div>
      )}
      {salaryEmployee && <SalaryModal employee={salaryEmployee} onClose={() => setSalaryFor(null)} />}
      {fireEmployeeCurrent && <FireModal employee={fireEmployeeCurrent} onClose={() => setFireFor(null)} />}
      {bonusEmployee && <BonusModal target={{ employee: bonusEmployee }} onClose={() => setBonusFor(null)} />}
    </Card>
  );
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const game = useGameStore((s) => s.game!);
  const [tab, setTab] = useState<Tab>('departments');
  const [hireFor, setHireFor] = useState<DepartmentId | null>(null);
  const workforce = game.workforce;
  const headcount = officeHeadcount(game);
  const capacity = officeCapacity(game);
  const avgMotivation = workforce.employees.length ? workforce.employees.reduce((a, e) => a + e.motivation, 0) / workforce.employees.length : 0;
  const efficiency = managementEfficiency(game);
  const openings = Object.values(workforce.recruiting.openings).reduce((a, b) => a + (b ?? 0), 0);
  const office = OFFICES[game.company.officeLevel];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mitarbeiter"
        description="Einstellen, entwickeln, motivieren – Menschen sind die wichtigste Ressource."
        icon={<Users size={20} />}
        actions={
          <Button variant="primary" icon={<UserPlus size={15} />} onClick={() => setHireFor('production')}>
            Agentur-Einstellung
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Belegschaft" value={formatNumber(workforce.employees.length)} hint={`Rekord ${formatNumber(game.stats.peakEmployees)}`} />
        <StatCard label="Büroplätze" value={`${headcount}/${capacity}`} hint={office?.name} tone={headcount >= capacity ? 'warn' : 'default'} onClick={() => navigate('/game/company')} />
        <StatCard label="Personalkosten" value={formatMoney(workforce.totalPayroll)} hint="pro Monat" />
        <StatCard label="Ø Motivation" value={formatNumber(avgMotivation)} tone={avgMotivation < 45 ? 'bad' : avgMotivation < 55 ? 'warn' : 'default'} hint={`${workforce.quitsTotal} Kündigungen gesamt`} />
        <StatCard label="Führungseffizienz" value={formatPercent(efficiency, 0)} tone={efficiency < 0.85 ? 'warn' : 'default'} hint={openings > 0 ? `${openings} Stellen ausgeschrieben` : 'max. 12 Personen je Führungskraft'} />
      </div>

      {headcount >= capacity && (
        <Alert tone="warn" title="Das Büro ist voll" action={<Button size="xs" onClick={() => navigate('/game/company')}>Umziehen</Button>}>
          Neue Büro-Mitarbeitende brauchen mehr Platz. Ein Umzug in ein größeres Büro erhöht auch die Motivation.
        </Alert>
      )}
      {efficiency < 0.85 && (
        <Alert tone="warn" title="Zu wenige Führungskräfte">
          Jede Management-Kapazität koordiniert etwa 12 Personen. Ohne mehr Management verlieren alle Abteilungen {formatPercent(1 - efficiency, 0)} Effizienz.
        </Alert>
      )}

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'departments', label: 'Abteilungen' },
          { value: 'candidates', label: `Bewerbungen (${workforce.candidates.length})` },
          { value: 'staff', label: `Belegschaft (${formatNumber(workforce.employees.length)})` },
        ]}
      />

      {tab === 'departments' && <DepartmentsTab onHire={setHireFor} />}
      {tab === 'candidates' && <CandidatesTab />}
      {tab === 'staff' && <StaffTab />}

      {hireFor && <BulkHireModal initialDepartment={hireFor} onClose={() => setHireFor(null)} />}
    </div>
  );
}
