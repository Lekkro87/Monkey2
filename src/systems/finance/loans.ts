import { DIFFICULTIES } from '@/data/difficulties';
import { CommandError, ensure, nextId } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import type { GameState, Loan, LoanKind } from '@/types';
import { annuityPayment, clamp } from '@/utils/math';
import { departmentCapacity } from '@/systems/workforce/employees';
import { balanceSheet, RATING_SPREAD, totalDebt, trailing } from './accounts';
import { addTransaction } from './ledger';

export const LOAN_TERMS = [12, 36, 60, 120] as const;

/** Maximaler Gesamtkreditrahmen. */
export function creditLimit(state: GameState): number {
  const balance = balanceSheet(state);
  const ttm = trailing(state, 12);
  const base = 25_000 * state.economy.priceLevel;
  const capacity = base + Math.max(0, ttm.ebitda) * 3 + balance.fixedAssets * 0.5 + balance.inventory * 0.3 + ttm.revenue * 0.15;
  return Math.max(0, capacity - totalDebt(state));
}

export function financeDiscount(state: GameState): number {
  return Math.min(0.01, departmentCapacity(state, 'finance') * 0.002);
}

export function loanRate(state: GameState, termMonths: number, kind: LoanKind = 'bank'): number {
  const spread = RATING_SPREAD[state.finance.creditRating];
  const termPremium = Math.max(0, termMonths / 12 - 1) * 0.002;
  const emergency = kind === 'emergency' ? 0.06 : 0;
  return clamp(
    state.economy.baseInterestRate + spread + termPremium + DIFFICULTIES[state.difficulty].interestSpread + emergency - financeDiscount(state),
    0.01,
    0.35,
  );
}

export interface LoanQuote {
  amount: number;
  termMonths: number;
  annualRate: number;
  monthlyPayment: number;
  totalInterest: number;
}

export function quoteLoan(state: GameState, amount: number, termMonths: number, kind: LoanKind = 'bank'): LoanQuote {
  const annualRate = loanRate(state, termMonths, kind);
  const monthlyPayment = annuityPayment(amount, annualRate, termMonths);
  return { amount, termMonths, annualRate, monthlyPayment, totalInterest: monthlyPayment * termMonths - amount };
}

export function takeLoan(state: GameState, amount: number, termMonths: number): string {
  ensure(LOAN_TERMS.includes(termMonths as (typeof LOAN_TERMS)[number]), 'Ungültige Laufzeit.');
  ensure(Number.isFinite(amount) && amount >= 5_000, 'Mindestbetrag: 5.000 €.');
  ensure(state.finance.creditRating !== 'D', 'Im Restrukturierungsverfahren vergibt keine Bank neue Kredite.');
  const limit = creditLimit(state);
  ensure(amount <= limit, `Die Bank gewährt höchstens ${Math.floor(limit).toLocaleString('de-DE')} € (Kreditrahmen).`);
  const quote = quoteLoan(state, amount, termMonths);
  const loan: Loan = {
    id: nextId(state, 'loan'),
    kind: 'bank',
    principal: amount,
    remaining: amount,
    annualRate: quote.annualRate,
    termMonths,
    monthlyPayment: quote.monthlyPayment,
    startDay: state.time.day,
    monthsPaid: 0,
  };
  state.finance.loans.push(loan);
  addTransaction(state, 'loan_in', amount);
  return `Kredit über ${Math.round(amount).toLocaleString('de-DE')} € aufgenommen (${(quote.annualRate * 100).toFixed(1).replace('.', ',')} % p. a., Rate ${Math.round(quote.monthlyPayment).toLocaleString('de-DE')} €/Monat).`;
}

export function takeEmergencyLoan(state: GameState): string {
  ensure(DIFFICULTIES[state.difficulty].emergencyLoan, 'Auf diesem Schwierigkeitsgrad gibt es keine Notkredite.');
  ensure(state.insolvency.stage !== 'ok', 'Ein Notkredit ist nur bei Zahlungsschwierigkeiten möglich.');
  ensure(!state.finance.loans.some((l) => l.kind === 'emergency'), 'Es läuft bereits ein Notkredit.');
  const amount = Math.max(20_000 * state.economy.priceLevel, -state.finance.cash * 1.5 + trailing(state, 3).revenue * 0.05);
  const quote = quoteLoan(state, amount, 36, 'emergency');
  state.finance.loans.push({
    id: nextId(state, 'loan'),
    kind: 'emergency',
    principal: amount,
    remaining: amount,
    annualRate: quote.annualRate,
    termMonths: 36,
    monthlyPayment: quote.monthlyPayment,
    startDay: state.time.day,
    monthsPaid: 0,
  });
  addTransaction(state, 'loan_in', amount);
  addNews(state, 'finance', 'negative', `${state.company.name} erhält Notkredit`, `${Math.round(amount).toLocaleString('de-DE')} € zu ${(quote.annualRate * 100).toFixed(1).replace('.', ',')} % Zinsen sollen die Zahlungsfähigkeit sichern.`);
  return `Notkredit über ${Math.round(amount).toLocaleString('de-DE')} € erhalten.`;
}

export function repayLoan(state: GameState, loanId: string): string {
  const loan = state.finance.loans.find((l) => l.id === loanId);
  if (!loan) throw new CommandError('Kredit nicht gefunden.');
  const fee = loan.remaining * 0.01;
  ensure(state.finance.cash >= loan.remaining + fee, 'Nicht genügend Kapital für die Sondertilgung.');
  addTransaction(state, 'loan_repay', -loan.remaining);
  addTransaction(state, 'fees', -fee);
  state.finance.loans = state.finance.loans.filter((l) => l.id !== loanId);
  return `Kredit vorzeitig getilgt (Vorfälligkeitsentschädigung ${Math.round(fee).toLocaleString('de-DE')} €).`;
}

/** Monatliche Annuitäten: Zins- und Tilgungsanteil. */
export function processLoansMonthly(state: GameState): void {
  const finished: string[] = [];
  for (const loan of state.finance.loans) {
    const interest = loan.remaining * (loan.annualRate / 12);
    const payment = Math.min(loan.monthlyPayment, loan.remaining + interest);
    const principal = payment - interest;
    addTransaction(state, 'interest', -interest);
    addTransaction(state, 'loan_repay', -principal);
    loan.remaining = Math.max(0, loan.remaining - principal);
    loan.monthsPaid += 1;
    if (loan.remaining <= 0.5 || loan.monthsPaid >= loan.termMonths) finished.push(loan.id);
  }
  if (finished.length > 0) {
    state.finance.loans = state.finance.loans.filter((l) => !finished.includes(l.id));
    addNews(state, 'finance', 'positive', finished.length === 1 ? 'Kredit vollständig getilgt' : `${finished.length} Kredite vollständig getilgt`);
  }
}

/** Dispozinsen auf negativen Kontostand (täglich). */
export function processOverdraft(state: GameState): void {
  if (state.finance.cash >= 0) return;
  const rate = 0.12 + state.economy.baseInterestRate + DIFFICULTIES[state.difficulty].interestSpread;
  addTransaction(state, 'interest', (state.finance.cash * rate) / 365);
}
