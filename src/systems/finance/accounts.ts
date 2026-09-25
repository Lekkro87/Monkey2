import type { BalanceSheet, CreditRating, GameState, MonthlyReport } from '@/types';
import { clamp } from '@/utils/math';
import { inventoryValue } from '@/systems/inventory/inventory';
import { ledgerOpex, ledgerRevenue } from './ledger';

export function totalDebt(state: GameState): number {
  return state.finance.loans.reduce((a, l) => a + l.remaining, 0);
}

export function balanceSheet(state: GameState): BalanceSheet {
  const cash = Math.max(0, state.finance.cash);
  const overdraft = Math.max(0, -state.finance.cash);
  const inventory = inventoryValue(state);
  const inventoryTotal = inventory.components + inventory.products;
  const fixedAssets = state.finance.assetBook;
  const totalAssets = cash + inventoryTotal + fixedAssets;
  const debt = totalDebt(state);
  const totalLiabilities = debt + overdraft;
  return { cash, inventory: inventoryTotal, fixedAssets, totalAssets, debt, overdraft, totalLiabilities, equity: totalAssets - totalLiabilities };
}

export interface TrailingFigures {
  revenue: number;
  ebitda: number;
  netIncome: number;
  months: number;
}

/** Kennzahlen der letzten n abgeschlossenen Monate (annualisiert, falls weniger vorhanden). */
export function trailing(state: GameState, months = 12, annualize = true): TrailingFigures {
  const reports = state.finance.months.slice(-months);
  const count = reports.length;
  const revenue = reports.reduce((a, r) => a + r.revenue, 0);
  const ebitda = reports.reduce((a, r) => a + r.ebitda, 0);
  const netIncome = reports.reduce((a, r) => a + r.netIncome, 0);
  if (!annualize || count === 0 || count >= months) return { revenue, ebitda, netIncome, months: count };
  const factor = months / count;
  return { revenue: revenue * factor, ebitda: ebitda * factor, netIncome: netIncome * factor, months: count };
}

/** Umsatz/EBITDA des laufenden Monats (noch nicht abgeschlossen). */
export function currentMonthFigures(state: GameState): { revenue: number; ebitda: number; grossProfit: number } {
  const ledger = state.finance.ledger;
  const revenue = ledgerRevenue(ledger);
  const grossProfit = revenue + ledger.cogs;
  return { revenue, grossProfit, ebitda: grossProfit - ledgerOpex(ledger) };
}

export function revenueGrowth(state: GameState): number {
  const reports = state.finance.months;
  if (reports.length < 6) return 0;
  const recent = reports.slice(-3).reduce((a, r) => a + r.revenue, 0);
  const previous = reports.slice(-6, -3).reduce((a, r) => a + r.revenue, 0);
  if (previous <= 0) return recent > 0 ? 0.5 : 0;
  return clamp(recent / previous - 1, -0.8, 2);
}

/** Fundamentaler Unternehmenswert (ohne Börsenstimmung). */
export function fundamentalValuation(state: GameState): number {
  const balance = balanceSheet(state);
  const ttm = trailing(state, 12);
  const growth = revenueGrowth(state);
  const multiple = clamp(7 + growth * 12, 3, 20);
  const brand = state.brand.reputation / 100;
  const value = Math.max(0, balance.equity) * 0.85 + Math.max(0, ttm.ebitda) * multiple + ttm.revenue * (0.25 + 0.25 * brand);
  return Math.max(value, balance.equity, 0);
}

export function updateValuation(state: GameState): void {
  const stock = state.finance.stock;
  const valuation = stock.isPublic ? stock.sharePrice * stock.totalShares : fundamentalValuation(state);
  state.finance.valuation = valuation;
  if (valuation > state.finance.lifetime.peakValuation) state.finance.lifetime.peakValuation = valuation;
}

const RATING_ORDER: CreditRating[] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'D'];

export function computeCreditRating(state: GameState): CreditRating {
  if (state.insolvency.stage === 'restructuring') return 'D';
  const balance = balanceSheet(state);
  const ttm = trailing(state, 12);
  const netDebt = balance.debt + balance.overdraft - balance.cash;
  if (balance.equity < 0 && state.finance.cash < 0) return 'CCC';
  let index: number;
  if (netDebt <= 0) index = 1;
  else if (ttm.ebitda <= 0) index = balance.equity > netDebt ? 4 : 5;
  else {
    const leverage = netDebt / ttm.ebitda;
    index = leverage < 0.5 ? 0 : leverage < 1.5 ? 2 : leverage < 2.5 ? 3 : leverage < 4 ? 4 : leverage < 6 ? 5 : 6;
  }
  if (ttm.revenue < 1_000_000) index = Math.max(index, 3);
  else if (ttm.revenue < 50_000_000) index = Math.max(index, 2);
  if (state.finance.cash < 0) index = Math.max(index, 5);
  return RATING_ORDER[Math.min(index, RATING_ORDER.length - 1)];
}

export const RATING_SPREAD: Record<CreditRating, number> = {
  AAA: 0.005,
  AA: 0.008,
  A: 0.012,
  BBB: 0.02,
  BB: 0.035,
  B: 0.055,
  CCC: 0.09,
  D: 0.15,
};

export function lastReport(state: GameState): MonthlyReport | undefined {
  return state.finance.months[state.finance.months.length - 1];
}
