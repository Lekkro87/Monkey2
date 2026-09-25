import { DIFFICULTIES } from '@/data/difficulties';
import { addNews } from '@/simulation/news';
import type { GameState } from '@/types';
import { clamp } from '@/utils/math';
import { creditLimit } from './loans';
import { addTransaction } from './ledger';
import { FOUNDER_SHAREHOLDER_ID } from './investors';

/** Tage mit negativem Kontostand, bevor die Restrukturierung beginnt. */
export const WARNING_DAYS = 30;

export function insolvencyDaysLeft(state: GameState): number | null {
  const ins = state.insolvency;
  if (ins.stage !== 'restructuring' || ins.restructuringUntil === null) return null;
  return Math.max(0, ins.restructuringUntil - state.time.day);
}

function founderBailout(state: GameState): void {
  const amount = Math.max(50_000, -state.finance.cash + 30_000) * state.economy.priceLevel;
  addTransaction(state, 'equity_in', amount);
  const founder = state.finance.shareholders.find((s) => s.id === FOUNDER_SHAREHOLDER_ID);
  if (founder) {
    const newShares = Math.round(state.finance.stock.totalShares * 0.1);
    state.finance.shareholders.push({ id: `bailout-${state.time.day}`, name: 'Sanierungsinvestor', kind: 'angel', shares: newShares, invested: amount, day: state.time.day });
    state.finance.stock.totalShares += newShares;
  }
  state.brand.reputation = clamp(state.brand.reputation - 10, 0, 100);
  state.insolvency = { stage: 'ok', negativeSinceDay: null, restructuringUntil: null, bailoutUsed: true };
  addNews(state, 'finance', 'negative', 'Rettung in letzter Minute', `Ein Sanierungsinvestor schießt ${Math.round(amount).toLocaleString('de-DE')} € nach – gegen 10 % der Anteile.`);
}

export function checkInsolvency(state: GameState): void {
  const ins = state.insolvency;
  const day = state.time.day;
  const difficulty = DIFFICULTIES[state.difficulty];
  if (state.status === 'bankrupt') return;

  if (state.finance.cash >= 0) {
    if (ins.stage !== 'ok') {
      addNews(state, 'finance', 'positive', 'Liquidität gesichert', 'Das Konto ist wieder im Plus. Die Restrukturierung ist beendet.');
    }
    ins.stage = 'ok';
    ins.negativeSinceDay = null;
    ins.restructuringUntil = null;
    return;
  }

  if (ins.negativeSinceDay === null) ins.negativeSinceDay = day;
  const overdraftLimit = Math.max(20_000 * state.economy.priceLevel, creditLimit(state) * 0.25);
  const negativeDays = day - ins.negativeSinceDay;

  if (ins.stage === 'ok') {
    ins.stage = 'warning';
    addNews(state, 'finance', 'negative', 'Warnung: Konto im Minus', `Das Unternehmen nutzt den Dispositionskredit (12 % Zinsen). Nach ${WARNING_DAYS} Tagen beginnt die Restrukturierung.`);
  }
  if (ins.stage === 'warning' && (negativeDays >= WARNING_DAYS || state.finance.cash < -overdraftLimit)) {
    ins.stage = 'restructuring';
    const grace = difficulty.insolvencyGraceDays ?? 90;
    ins.restructuringUntil = day + grace;
    addNews(
      state,
      'finance',
      'negative',
      `${state.company.name} in der Restrukturierung`,
      `Ohne Besserung droht in ${grace} Tagen die Insolvenz. Kosten senken, Bestände verkaufen oder frisches Kapital beschaffen!`,
    );
  }
  if (ins.stage === 'restructuring' && ins.restructuringUntil !== null && day >= ins.restructuringUntil) {
    if (difficulty.insolvencyGraceDays === null) {
      founderBailout(state);
      return;
    }
    ins.stage = 'insolvent';
    state.status = 'bankrupt';
    addNews(state, 'finance', 'negative', `${state.company.name} meldet Insolvenz an`, 'Die Zahlungsunfähigkeit konnte nicht abgewendet werden.');
  }
}
