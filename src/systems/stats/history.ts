import { CATEGORIES, CATEGORY_IDS } from '@/data/categories';
import { COMPONENT_TYPE_LABELS } from '@/data/componentCatalog';
import { addNews } from '@/simulation/news';
import type { ComponentType, GameState } from '@/types';
import { appendCapped } from '@/utils/math';
import { typePriceTrend } from '@/systems/components/market';
import { updateValuation } from '@/systems/finance/accounts';
import { overallPlayerShare, PLAYER_OWNER } from '@/systems/market/demand';

const MAX_HISTORY = 520;

export function recordWeeklySnapshot(state: GameState): void {
  updateValuation(state);
  const stats = state.stats;
  const share = overallPlayerShare(state);
  if (share > stats.peakMarketShare) stats.peakMarketShare = share;
  if (state.workforce.employees.length > stats.peakEmployees) stats.peakEmployees = state.workforce.employees.length;
  if (state.finance.cash > state.finance.lifetime.peakCash) state.finance.lifetime.peakCash = state.finance.cash;
  const demandIndex = CATEGORY_IDS.reduce((a, c) => a + state.markets[c].trend * CATEGORIES[c].baseMonthlyUnits, 0) / CATEGORY_IDS.reduce((a, c) => a + CATEGORIES[c].baseMonthlyUnits, 0);
  stats.demandIndex = demandIndex;
  state.history = appendCapped(
    state.history,
    {
      day: state.time.day,
      cash: state.finance.cash,
      revenue: stats.week.revenue,
      profit: stats.week.profit,
      unitsSold: stats.week.unitsSold,
      unitsProduced: stats.week.unitsProduced,
      valuation: state.finance.valuation,
      employees: state.workforce.employees.length,
      reputation: state.brand.reputation,
      marketShare: share,
      sharePrice: state.finance.stock.isPublic ? state.finance.stock.sharePrice : null,
      demandIndex,
    },
    MAX_HISTORY,
  );
  stats.week = { revenue: 0, profit: 0, unitsSold: 0, unitsProduced: 0 };
}

const PRICE_NEWS_TYPES: ComponentType[] = ['gpu', 'cpu', 'ram', 'storage', 'display', 'battery', 'soc'];
const SHARE_MILESTONES = [0.01, 0.05, 0.1, 0.25, 0.5];

/** Wöchentliche Marktnachrichten aus tatsächlichen Spieldaten. */
export function generateMarketNews(state: GameState): void {
  const day = state.time.day;
  const cooldowns = state.events.cooldowns;
  for (const type of PRICE_NEWS_TYPES) {
    const key = `news-price-${type}`;
    if ((cooldowns[key] ?? 0) > day) continue;
    const trend = typePriceTrend(state, type);
    if (Math.abs(trend) < 0.08) continue;
    cooldowns[key] = day + 60;
    const label = COMPONENT_TYPE_LABELS[type];
    const percent = Math.round(Math.abs(trend) * 100);
    addNews(
      state,
      'market',
      trend > 0 ? 'negative' : 'positive',
      trend > 0 ? `${label}-Preise steigen weltweit (+${percent} %)` : `${label}-Preise fallen deutlich (−${percent} %)`,
      trend > 0 ? 'Höhere Einkaufspreise drücken auf die Margen. Verträge können Preise absichern.' : 'Gute Gelegenheit, Lagerbestände aufzubauen.',
    );
  }
  for (const categoryId of CATEGORY_IDS) {
    const share = state.markets[categoryId].share[PLAYER_OWNER] ?? 0;
    for (const milestone of SHARE_MILESTONES) {
      const key = `share-${categoryId}-${milestone}`;
      if (share < milestone || cooldowns[key] !== undefined) continue;
      cooldowns[key] = day;
      addNews(
        state,
        'market',
        'positive',
        `${state.company.name} erreicht ${Math.round(milestone * 100)} % Marktanteil bei ${CATEGORIES[categoryId].pluralName}`,
        'Der Marktanteil bezieht sich auf die weltweiten Verkäufe der letzten 30 Tage.',
      );
    }
  }
}
