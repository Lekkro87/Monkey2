import { CommandError, ensure, nextId } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import { chance, pick, randomRange } from '@/simulation/rng';
import type { FundingOffer, GameState, Shareholder } from '@/types';
import { clamp } from '@/utils/math';
import { fundamentalValuation, lastReport, revenueGrowth, trailing } from './accounts';
import { addTransaction } from './ledger';

export const FOUNDER_SHAREHOLDER_ID = 'founder';
export const INITIAL_SHARES = 10_000_000;

const ANGELS = ['Business Angel Dr. Sabine Kraus', 'Angel-Netzwerk Rhein-Main', 'Seed Club Berlin', 'Tech Angels Nord'];
const VCS = ['Northstar Ventures', 'Brightline Capital', 'Atlas Growth Partners', 'Helix Venture Fund', 'Blue Ridge VC'];
const STRATEGIC = ['Globex Telecom', 'Meridian Retail Group', 'Kappa Industrial Holding', 'Sunrise Mobile Networks'];

export function founderShare(state: GameState): number {
  const founder = state.finance.shareholders.find((s) => s.id === FOUNDER_SHAREHOLDER_ID);
  return founder ? founder.shares / state.finance.stock.totalShares : 0;
}

function makeOffer(state: GameState, kind: FundingOffer['kind'], valuation: number): FundingOffer {
  const equityShare =
    kind === 'angel' ? randomRange(state, 0.1, 0.2) : kind === 'vc' ? randomRange(state, 0.15, 0.25) : randomRange(state, 0.12, 0.3);
  const premium = kind === 'vc' ? randomRange(state, 1.1, 1.5) : kind === 'strategic' ? randomRange(state, 1.0, 1.25) : randomRange(state, 0.8, 1.1);
  const preMoney = Math.max(kind === 'angel' ? 400_000 : 3_000_000, valuation * premium);
  const amount = Math.round((preMoney * equityShare) / (1 - equityShare) / 1_000) * 1_000;
  const investor = kind === 'angel' ? pick(state, ANGELS) : kind === 'vc' ? pick(state, VCS) : pick(state, STRATEGIC);
  const note =
    kind === 'angel'
      ? 'Frühphasen-Kapital mit Kontakten in die Branche.'
      : kind === 'vc'
        ? 'Wachstumskapital – erwartet schnelles Umsatzwachstum.'
        : 'Strategischer Partner: stärkt Vertrauen und Vertriebsnetz.';
  return { id: nextId(state, 'offer'), investor, kind, amount, equityShare, expiresDay: state.time.day + 30, note };
}

/** Monatlich: neue Beteiligungsangebote je nach Entwicklungsstand. */
export function processFundingOffers(state: GameState): void {
  const finance = state.finance;
  finance.fundingOffers = finance.fundingOffers.filter((o) => o.expiresDay > state.time.day);
  if (state.time.day < finance.nextFundingCheckDay || finance.stock.isPublic) return;
  finance.nextFundingCheckDay = state.time.day + 30;
  if (finance.fundingOffers.length >= 2) return;
  const report = lastReport(state);
  if (!report) return;
  const valuation = fundamentalValuation(state);
  const growth = revenueGrowth(state);
  const ttm = trailing(state, 12);
  const founder = founderShare(state);
  const stage = state.company.stage;
  if (founder < 0.3) return;
  let offer: FundingOffer | null = null;
  if (stage <= 2 && report.revenue > 5_000 && founder > 0.6 && chance(state, 0.35)) offer = makeOffer(state, 'angel', valuation);
  else if (stage >= 2 && (growth > 0.15 || ttm.revenue > 2_000_000) && chance(state, 0.3)) offer = makeOffer(state, 'vc', valuation);
  else if (stage >= 3 && state.brand.reputation > 55 && chance(state, 0.15)) offer = makeOffer(state, 'strategic', valuation);
  if (offer) {
    finance.fundingOffers.push(offer);
    addNews(
      state,
      'finance',
      'positive',
      `Beteiligungsangebot von ${offer.investor}`,
      `${Math.round(offer.amount).toLocaleString('de-DE')} € für ${(offer.equityShare * 100).toFixed(1).replace('.', ',')} % der Anteile.`,
    );
  }
}

export function acceptFunding(state: GameState, offerId: string): string {
  const offer = state.finance.fundingOffers.find((o) => o.id === offerId);
  if (!offer) throw new CommandError('Das Angebot ist nicht mehr gültig.');
  ensure(!state.finance.stock.isPublic, 'Nach dem Börsengang sind keine privaten Finanzierungsrunden mehr möglich.');
  const stock = state.finance.stock;
  const newShares = Math.round((stock.totalShares * offer.equityShare) / (1 - offer.equityShare));
  stock.totalShares += newShares;
  const holder: Shareholder = {
    id: nextId(state, 'sh'),
    name: offer.investor,
    kind: offer.kind,
    shares: newShares,
    invested: offer.amount,
    day: state.time.day,
  };
  state.finance.shareholders.push(holder);
  addTransaction(state, 'equity_in', offer.amount);
  state.finance.fundingOffers = state.finance.fundingOffers.filter((o) => o.id !== offerId);
  if (offer.kind === 'strategic') state.brand.trust = clamp(state.brand.trust + 5, 0, 100);
  addNews(state, 'finance', 'positive', `${offer.investor} steigt bei ${state.company.name} ein`, `Finanzierungsrunde über ${Math.round(offer.amount).toLocaleString('de-DE')} €.`);
  return `Finanzierung angenommen: +${Math.round(offer.amount).toLocaleString('de-DE')} €.`;
}

export function declineFunding(state: GameState, offerId: string): string {
  state.finance.fundingOffers = state.finance.fundingOffers.filter((o) => o.id !== offerId);
  return 'Angebot abgelehnt.';
}
