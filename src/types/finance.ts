import type { Day, Id } from './common';

/** Kassenwirksame Buchungskategorien. */
export type LedgerCategory =
  | 'sales'
  | 'subscriptions'
  | 'services'
  | 'cogs'
  | 'salaries'
  | 'rent'
  | 'marketing'
  | 'research'
  | 'development'
  | 'production'
  | 'energy'
  | 'maintenance'
  | 'logistics'
  | 'warehousing'
  | 'licenses'
  | 'support'
  | 'recruiting'
  | 'training'
  | 'warranty'
  | 'fees'
  | 'interest'
  | 'taxes'
  | 'other'
  | 'purchases'
  | 'capex'
  | 'loan_in'
  | 'loan_repay'
  | 'equity_in'
  | 'dividends'
  | 'buyback'
  | 'asset_sale';

export type Ledger = Record<LedgerCategory, number>;

export interface MonthlyReport {
  /** Monatsindex seit Spielbeginn (0 = Januar 2026). */
  month: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  interest: number;
  taxes: number;
  netIncome: number;
  operatingCashflow: number;
  investingCashflow: number;
  financingCashflow: number;
  cashEnd: number;
  unitsSold: number;
  unitsProduced: number;
  employees: number;
  valuation: number;
  ledger: Ledger;
}

export type LoanKind = 'bank' | 'emergency';

export interface Loan {
  id: Id;
  kind: LoanKind;
  principal: number;
  remaining: number;
  annualRate: number;
  termMonths: number;
  monthlyPayment: number;
  startDay: Day;
  monthsPaid: number;
}

export type CreditRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'D';

export interface Shareholder {
  id: Id;
  name: string;
  kind: 'founder' | 'angel' | 'vc' | 'strategic' | 'public';
  shares: number;
  invested: number;
  day: Day;
}

export interface FundingOffer {
  id: Id;
  investor: string;
  kind: 'angel' | 'vc' | 'strategic';
  amount: number;
  equityShare: number;
  expiresDay: Day;
  note: string;
}

export interface StockState {
  isPublic: boolean;
  ipoDay: Day | null;
  totalShares: number;
  sharePrice: number;
  /** Tägliche Kursverlauf (begrenzt). */
  priceHistory: { day: Day; price: number }[];
  sentiment: number;
  dividendPerShareQuarter: number;
  lastQuarterEps: number;
  lastDividendDay: Day | null;
}

export interface FinanceState {
  cash: number;
  ledger: Ledger;
  /** Buchwert aller Investitionen (Anlagevermögen). */
  assetBook: number;
  depreciationMonth: number;
  months: MonthlyReport[];
  loans: Loan[];
  lossCarryforward: number;
  creditRating: CreditRating;
  shareholders: Shareholder[];
  fundingOffers: FundingOffer[];
  nextFundingCheckDay: Day;
  stock: StockState;
  lifetime: {
    revenue: number;
    netIncome: number;
    unitsSold: number;
    peakValuation: number;
    peakCash: number;
  };
  valuation: number;
  /** Geschätzte Buchwerte zum letzten Monatsabschluss. */
  lastBalance: BalanceSheet | null;
}

export interface BalanceSheet {
  cash: number;
  inventory: number;
  fixedAssets: number;
  totalAssets: number;
  debt: number;
  overdraft: number;
  totalLiabilities: number;
  equity: number;
}
