import { monthIndex } from '@/simulation/calendar';
import type { GameState, MonthlyReport } from '@/types';
import { pushCapped } from '@/utils/math';
import { balanceSheet, computeCreditRating, updateValuation } from './accounts';
import { addTransaction, emptyLedger, FINANCING_CATEGORIES, INVESTING_CATEGORIES, LEDGER_CATEGORIES, ledgerOpex, ledgerRevenue } from './ledger';

const MONTHLY_DEPRECIATION = 0.005;

/** Schließt den Vormonat ab: Abschreibungen, Steuern, Bericht, Bewertung. */
export function closeMonth(state: GameState): MonthlyReport {
  const finance = state.finance;
  const depreciation = finance.assetBook * MONTHLY_DEPRECIATION;
  finance.assetBook -= depreciation;
  for (const factory of state.production.factories) factory.bookValue *= 1 - MONTHLY_DEPRECIATION;
  finance.depreciationMonth = depreciation;

  const ledger = finance.ledger;
  const revenue = ledgerRevenue(ledger);
  const cogs = -ledger.cogs;
  const grossProfit = revenue - cogs;
  const opex = ledgerOpex(ledger);
  const ebitda = grossProfit - opex;
  const ebit = ebitda - depreciation;
  const interest = -ledger.interest;
  const taxable = ebit - interest;
  let taxes = 0;
  if (taxable > 0) {
    const offset = Math.min(finance.lossCarryforward, taxable);
    finance.lossCarryforward -= offset;
    taxes = (taxable - offset) * state.economy.taxRate;
    if (taxes > 0) addTransaction(state, 'taxes', -taxes);
  } else {
    finance.lossCarryforward += -taxable;
  }
  const netIncome = ebit - interest - taxes;

  let investing = 0;
  for (const c of INVESTING_CATEGORIES) investing += ledger[c];
  let financing = 0;
  for (const c of FINANCING_CATEGORIES) financing += ledger[c];
  let operating = 0;
  for (const c of LEDGER_CATEGORIES) {
    if (c === 'cogs' || INVESTING_CATEGORIES.includes(c) || FINANCING_CATEGORIES.includes(c)) continue;
    operating += ledger[c];
  }

  finance.creditRating = computeCreditRating(state);
  updateValuation(state);
  finance.lastBalance = balanceSheet(state);

  const report: MonthlyReport = {
    month: monthIndex(state.time.day) - 1,
    revenue,
    cogs,
    grossProfit,
    opex,
    ebitda,
    depreciation,
    ebit,
    interest,
    taxes,
    netIncome,
    operatingCashflow: operating,
    investingCashflow: investing,
    financingCashflow: financing,
    cashEnd: finance.cash,
    unitsSold: state.stats.month.unitsSold,
    unitsProduced: state.stats.month.unitsProduced,
    employees: state.workforce.employees.length,
    valuation: finance.valuation,
    ledger: { ...ledger },
  };
  pushCapped(finance.months, report, 600);
  finance.lifetime.revenue += revenue;
  finance.lifetime.netIncome += netIncome;
  finance.ledger = emptyLedger();
  state.stats.month = { revenue: 0, profit: 0, unitsSold: 0, unitsProduced: 0 };
  return report;
}
