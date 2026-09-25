import type { GameState, Ledger, LedgerCategory } from '@/types';

export const LEDGER_CATEGORIES: LedgerCategory[] = [
  'sales',
  'subscriptions',
  'services',
  'cogs',
  'salaries',
  'rent',
  'marketing',
  'research',
  'development',
  'production',
  'energy',
  'maintenance',
  'logistics',
  'warehousing',
  'licenses',
  'support',
  'recruiting',
  'training',
  'warranty',
  'fees',
  'interest',
  'taxes',
  'other',
  'purchases',
  'capex',
  'loan_in',
  'loan_repay',
  'equity_in',
  'dividends',
  'buyback',
  'asset_sale',
];

export const LEDGER_LABELS: Record<LedgerCategory, string> = {
  sales: 'Produktverkäufe',
  subscriptions: 'Abonnements',
  services: 'Dienstleistungen',
  cogs: 'Materialeinsatz',
  salaries: 'Gehälter',
  rent: 'Miete',
  marketing: 'Marketing',
  research: 'Forschung',
  development: 'Entwicklung',
  production: 'Produktion',
  energy: 'Energie',
  maintenance: 'Wartung',
  logistics: 'Transport & Versand',
  warehousing: 'Lager',
  licenses: 'Lizenzen',
  support: 'Kundensupport',
  recruiting: 'Recruiting',
  training: 'Weiterbildung',
  warranty: 'Garantie & Rückrufe',
  fees: 'Gebühren',
  interest: 'Zinsen',
  taxes: 'Steuern',
  other: 'Sonstiges',
  purchases: 'Komponenteneinkauf',
  capex: 'Investitionen',
  loan_in: 'Kreditaufnahme',
  loan_repay: 'Kredittilgung',
  equity_in: 'Eigenkapital',
  dividends: 'Dividenden',
  buyback: 'Aktienrückkauf',
  asset_sale: 'Verkauf von Anlagen',
};

/** Erlöse in der Gewinn- und Verlustrechnung. */
export const REVENUE_CATEGORIES: LedgerCategory[] = ['sales', 'subscriptions', 'services'];

/** Betriebliche Aufwände (ohne Materialeinsatz, Zinsen, Steuern). */
export const OPEX_CATEGORIES: LedgerCategory[] = [
  'salaries',
  'rent',
  'marketing',
  'research',
  'development',
  'production',
  'energy',
  'maintenance',
  'logistics',
  'warehousing',
  'licenses',
  'support',
  'recruiting',
  'training',
  'warranty',
  'fees',
  'other',
];

export const INVESTING_CATEGORIES: LedgerCategory[] = ['capex', 'asset_sale'];
export const FINANCING_CATEGORIES: LedgerCategory[] = ['loan_in', 'loan_repay', 'equity_in', 'dividends', 'buyback'];

export function emptyLedger(): Ledger {
  const ledger = {} as Ledger;
  for (const category of LEDGER_CATEGORIES) ledger[category] = 0;
  return ledger;
}

/**
 * Bucht einen Zahlungsvorgang: positive Beträge sind Einnahmen, negative Ausgaben.
 * Materialeinkäufe werden als 'purchases' gebucht (Bestandsaufbau, nicht GuV-wirksam);
 * der Materialeinsatz ('cogs') wird beim Verkauf separat erfasst.
 */
const PROFIT_CATEGORIES = new Set<LedgerCategory>([
  'sales',
  'subscriptions',
  'services',
  'salaries',
  'rent',
  'marketing',
  'research',
  'development',
  'production',
  'energy',
  'maintenance',
  'logistics',
  'warehousing',
  'licenses',
  'support',
  'recruiting',
  'training',
  'warranty',
  'fees',
  'other',
  'interest',
  'taxes',
]);
const REVENUE_SET = new Set<LedgerCategory>(['sales', 'subscriptions', 'services']);

export function addTransaction(state: GameState, category: LedgerCategory, amount: number): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  state.finance.ledger[category] += amount;
  if (category === 'cogs') return;
  state.finance.cash += amount;
  if (category === 'capex') state.finance.assetBook += -amount;
  if (PROFIT_CATEGORIES.has(category)) {
    state.stats.week.profit += amount;
    state.stats.month.profit += amount;
    if (REVENUE_SET.has(category)) {
      state.stats.week.revenue += amount;
      state.stats.month.revenue += amount;
    }
  }
}

/** Nicht kassenwirksamer Materialeinsatz beim Verkauf (Bestand → Aufwand). */
export function recordCogs(state: GameState, amount: number): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  state.finance.ledger.cogs -= Math.abs(amount);
  state.stats.week.profit -= Math.abs(amount);
  state.stats.month.profit -= Math.abs(amount);
}

export function canAfford(state: GameState, amount: number): boolean {
  return state.finance.cash >= amount;
}

export function ledgerRevenue(ledger: Ledger): number {
  return REVENUE_CATEGORIES.reduce((total, c) => total + ledger[c], 0);
}

export function ledgerOpex(ledger: Ledger): number {
  return -OPEX_CATEGORIES.reduce((total, c) => total + ledger[c], 0);
}
