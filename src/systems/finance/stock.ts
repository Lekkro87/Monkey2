import { DIFFICULTIES } from '@/data/difficulties';
import { isQuarterStart } from '@/simulation/calendar';
import { CommandError, ensure, nextId } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import { gaussian } from '@/simulation/rng';
import type { GameState } from '@/types';
import { clamp } from '@/utils/math';
import { departmentHeadcount } from '@/systems/workforce/employees';
import { fundamentalValuation, trailing } from './accounts';
import { addTransaction } from './ledger';

export const IPO_REQUIREMENTS = {
  minValuation: 250_000_000,
  minRevenue: 50_000_000,
  minFinanceStaff: 5,
  minStage: 4,
};

export function ipoBlockers(state: GameState): string[] {
  const blockers: string[] = [];
  if (state.finance.stock.isPublic) return ['Das Unternehmen ist bereits börsennotiert.'];
  if (state.company.stage < IPO_REQUIREMENTS.minStage) blockers.push('Unternehmensstufe 4 („Konzern“) erforderlich.');
  const valuation = fundamentalValuation(state);
  if (valuation < IPO_REQUIREMENTS.minValuation * state.economy.priceLevel) blockers.push(`Unternehmenswert von mindestens ${(IPO_REQUIREMENTS.minValuation / 1e6).toFixed(0)} Mio. € erforderlich.`);
  const ttm = trailing(state, 12);
  if (ttm.revenue < IPO_REQUIREMENTS.minRevenue * state.economy.priceLevel) blockers.push(`Jahresumsatz von mindestens ${(IPO_REQUIREMENTS.minRevenue / 1e6).toFixed(0)} Mio. € erforderlich.`);
  if (state.finance.months.slice(-3).some((m) => m.ebitda <= 0)) blockers.push('Positives EBITDA in den letzten drei Monaten erforderlich.');
  if (departmentHeadcount(state, 'finance') < IPO_REQUIREMENTS.minFinanceStaff) blockers.push(`Mindestens ${IPO_REQUIREMENTS.minFinanceStaff} Mitarbeitende in Finanzen erforderlich.`);
  return blockers;
}

export function launchIpo(state: GameState, floatShare: number): string {
  ensure(floatShare >= 0.1 && floatShare <= 0.4, 'Der Streubesitz muss zwischen 10 % und 40 % liegen.');
  const blockers = ipoBlockers(state);
  if (blockers.length > 0) throw new CommandError(blockers[0]);
  const stock = state.finance.stock;
  const valuation = fundamentalValuation(state);
  const newShares = Math.round((stock.totalShares * floatShare) / (1 - floatShare));
  const price = (valuation / stock.totalShares) * 0.9;
  const gross = newShares * price;
  const fees = gross * 0.05;
  stock.totalShares += newShares;
  stock.isPublic = true;
  stock.ipoDay = state.time.day;
  stock.sharePrice = price;
  stock.sentiment = 1.08;
  stock.priceHistory = [{ day: state.time.day, price }];
  state.finance.shareholders.push({ id: nextId(state, 'sh'), name: 'Streubesitz (Börse)', kind: 'public', shares: newShares, invested: gross, day: state.time.day });
  addTransaction(state, 'equity_in', gross);
  addTransaction(state, 'fees', -fees);
  addNews(state, 'finance', 'positive', `Börsengang: ${state.company.name} ist an der Börse`, `Ausgabepreis ${price.toFixed(2).replace('.', ',')} € je Aktie, Emissionserlös ${Math.round(gross / 1e6).toLocaleString('de-DE')} Mio. €.`);
  return `Börsengang erfolgreich! Erlös: ${Math.round(gross).toLocaleString('de-DE')} €.`;
}

export function setDividend(state: GameState, perShareQuarter: number): string {
  ensure(state.finance.stock.isPublic, 'Dividenden setzen einen Börsengang voraus.');
  ensure(Number.isFinite(perShareQuarter) && perShareQuarter >= 0, 'Ungültige Dividende.');
  state.finance.stock.dividendPerShareQuarter = Math.round(perShareQuarter * 100) / 100;
  return perShareQuarter > 0 ? `Quartalsdividende auf ${perShareQuarter.toFixed(2).replace('.', ',')} € je Aktie festgelegt.` : 'Dividende ausgesetzt.';
}

export function buybackShares(state: GameState, amount: number): string {
  const stock = state.finance.stock;
  ensure(stock.isPublic, 'Aktienrückkäufe setzen einen Börsengang voraus.');
  ensure(amount >= 100_000, 'Mindestvolumen: 100.000 €.');
  ensure(state.finance.cash >= amount, 'Nicht genügend Kapital.');
  const publicHolder = state.finance.shareholders.find((s) => s.kind === 'public');
  ensure(publicHolder, 'Kein Streubesitz vorhanden.');
  const price = stock.sharePrice * 1.02;
  const shares = Math.min(publicHolder.shares * 0.5, Math.floor(amount / price));
  ensure(shares > 0, 'Betrag zu gering.');
  publicHolder.shares -= shares;
  stock.totalShares -= shares;
  addTransaction(state, 'buyback', -shares * price);
  stock.sentiment = clamp(stock.sentiment + 0.03, 0.5, 1.6);
  return `${Math.round(shares).toLocaleString('de-DE')} Aktien zurückgekauft.`;
}

export function issueShares(state: GameState, share: number): string {
  const stock = state.finance.stock;
  ensure(stock.isPublic, 'Kapitalerhöhungen setzen einen Börsengang voraus.');
  ensure(share >= 0.02 && share <= 0.2, 'Zwischen 2 % und 20 % neue Aktien möglich.');
  const newShares = Math.round(stock.totalShares * share);
  const price = stock.sharePrice * 0.95;
  const proceeds = newShares * price;
  const publicHolder = state.finance.shareholders.find((s) => s.kind === 'public');
  if (publicHolder) publicHolder.shares += newShares;
  stock.totalShares += newShares;
  addTransaction(state, 'equity_in', proceeds);
  addTransaction(state, 'fees', -proceeds * 0.03);
  stock.sentiment = clamp(stock.sentiment - 0.05, 0.5, 1.6);
  addNews(state, 'finance', 'neutral', `${state.company.name} beschließt Kapitalerhöhung`, `${(share * 100).toFixed(0)} % neue Aktien bringen ${Math.round(proceeds / 1e6).toLocaleString('de-DE')} Mio. €.`);
  return `Kapitalerhöhung: +${Math.round(proceeds).toLocaleString('de-DE')} €.`;
}

export function adjustSentiment(state: GameState, delta: number): void {
  const stock = state.finance.stock;
  if (!stock.isPublic) return;
  stock.sentiment = clamp(stock.sentiment + delta, 0.5, 1.6);
}

export function updateStockDaily(state: GameState): void {
  const stock = state.finance.stock;
  if (!stock.isPublic) return;
  const fundamental = fundamentalValuation(state) / stock.totalShares;
  const target = Math.max(0.01, fundamental * stock.sentiment);
  const volatility = 0.016 * DIFFICULTIES[state.difficulty].marketVolatility;
  const drift = 0.03 * Math.log(target / stock.sharePrice);
  stock.sharePrice = Math.max(0.01, stock.sharePrice * Math.exp(drift + gaussian(state, 0, volatility)));
  stock.sentiment += (1 - stock.sentiment) * 0.01;
  stock.priceHistory.push({ day: state.time.day, price: stock.sharePrice });
  if (stock.priceHistory.length > 1_100) stock.priceHistory.splice(0, stock.priceHistory.length - 1_100);

  if (isQuarterStart(state.time.day)) {
    const quarter = state.finance.months.slice(-3);
    const netIncome = quarter.reduce((a, m) => a + m.netIncome, 0);
    const eps = netIncome / stock.totalShares;
    if (stock.lastQuarterEps !== 0) {
      const surprise = eps - stock.lastQuarterEps;
      const tone = surprise >= 0 ? 'positive' : 'negative';
      adjustSentiment(state, clamp(surprise / Math.max(0.01, Math.abs(stock.lastQuarterEps)), -1, 1) * 0.08);
      addNews(state, 'finance', tone, surprise >= 0 ? 'Quartalszahlen übertreffen die Erwartungen' : 'Quartalszahlen enttäuschen Anleger', `Gewinn je Aktie: ${eps.toFixed(2).replace('.', ',')} € (Vorquartal ${stock.lastQuarterEps.toFixed(2).replace('.', ',')} €).`);
    }
    stock.lastQuarterEps = eps;
    if (stock.dividendPerShareQuarter > 0) {
      const total = stock.dividendPerShareQuarter * stock.totalShares;
      if (state.finance.cash >= total) {
        addTransaction(state, 'dividends', -total);
        stock.lastDividendDay = state.time.day;
        const yieldRate = (stock.dividendPerShareQuarter * 4) / stock.sharePrice;
        adjustSentiment(state, Math.min(0.05, yieldRate * 0.8));
      } else {
        stock.dividendPerShareQuarter = 0;
        adjustSentiment(state, -0.1);
        addNews(state, 'finance', 'negative', 'Dividende gestrichen', 'Die Liquidität reicht nicht für die geplante Ausschüttung.');
      }
    }
  }
}
