import { SALES_CHANNEL_IDS, SALES_CHANNELS } from '@/data/channels';
import { SEGMENT_IDS } from '@/data/segments';
import { ensure } from '@/simulation/commands';
import { addNews } from '@/simulation/news';
import type { GameState, ProductCategoryId, SalesChannelId, SegmentId } from '@/types';
import { addTransaction } from '@/systems/finance/ledger';
import { departmentHeadcount } from '@/systems/workforce/employees';

export function isChannelActive(state: GameState, channel: SalesChannelId): boolean {
  return state.company.salesChannels[channel] !== undefined;
}

export function channelRequirementError(state: GameState, channelId: SalesChannelId): string | null {
  const channel = SALES_CHANNELS[channelId];
  if (state.company.stage < channel.minStage) return `Erst ab Unternehmensstufe ${channel.minStage} verfügbar.`;
  if (state.brand.reputation < channel.minReputation) return `Händler verlangen eine Reputation von mindestens ${channel.minReputation} (aktuell ${Math.round(state.brand.reputation)}).`;
  const sales = departmentHeadcount(state, 'sales');
  if (sales < channel.minSalesStaff) return `Es werden mindestens ${channel.minSalesStaff} Vertriebsmitarbeitende benötigt (aktuell ${sales}).`;
  return null;
}

export function openSalesChannel(state: GameState, channelId: SalesChannelId): string {
  const channel = SALES_CHANNELS[channelId];
  ensure(channel, 'Unbekannter Vertriebskanal.');
  ensure(!isChannelActive(state, channelId), 'Dieser Vertriebskanal ist bereits aktiv.');
  const error = channelRequirementError(state, channelId);
  ensure(!error, error ?? '');
  const cost = channel.setupCost * state.economy.priceLevel;
  ensure(state.finance.cash >= cost, 'Nicht genügend Kapital.');
  addTransaction(state, 'fees', -cost);
  state.company.salesChannels[channelId] = state.time.day;
  addNews(state, 'company', 'positive', `${state.company.name} startet Vertrieb über ${channel.name}`, channel.description);
  return `${channel.name} ist jetzt aktiv.`;
}

export function closeSalesChannel(state: GameState, channelId: SalesChannelId): string {
  ensure(isChannelActive(state, channelId), 'Dieser Vertriebskanal ist nicht aktiv.');
  const active = SALES_CHANNEL_IDS.filter((id) => isChannelActive(state, id));
  ensure(active.length > 1, 'Mindestens ein Vertriebskanal muss aktiv bleiben.');
  delete state.company.salesChannels[channelId];
  return `${SALES_CHANNELS[channelId].name} wurde beendet.`;
}

export function processChannelCosts(state: GameState): void {
  let monthly = 0;
  for (const id of SALES_CHANNEL_IDS) if (isChannelActive(state, id)) monthly += SALES_CHANNELS[id].monthlyCost;
  if (monthly > 0) addTransaction(state, 'fees', (-monthly * state.economy.priceLevel * 12) / 365);
}

export interface ChannelMix {
  /** Reichweite des Spielers im Segment (0–1). */
  coverage: number;
  /** Gewichteter Händlerabschlag. */
  marginCut: number;
  /** Gewichteter Anteil der Endkunden-Versandkosten, die der Spieler trägt. */
  fulfillmentShare: number;
  /** Absatzanteile je Kanal. */
  weights: Partial<Record<SalesChannelId, number>>;
}

/** Reichweite und Konditionen der aktiven Vertriebskanäle für ein Segment. */
export function channelMix(state: GameState, category: ProductCategoryId, segment: SegmentId): ChannelMix {
  let miss = 1;
  let total = 0;
  let margin = 0;
  let fulfillment = 0;
  const weights: Partial<Record<SalesChannelId, number>> = {};
  for (const id of SALES_CHANNEL_IDS) {
    if (!isChannelActive(state, id)) continue;
    const channel = SALES_CHANNELS[id];
    if (channel.categories && !channel.categories.includes(category)) continue;
    const coverage = channel.coverage[segment];
    miss *= 1 - coverage;
    total += coverage;
    margin += coverage * channel.marginCut;
    fulfillment += coverage * channel.fulfillmentShare;
    weights[id] = coverage;
  }
  if (total <= 0) return { coverage: 0, marginCut: 0, fulfillmentShare: 1, weights };
  for (const key of Object.keys(weights) as SalesChannelId[]) weights[key] = (weights[key] ?? 0) / total;
  return { coverage: 1 - miss, marginCut: margin / total, fulfillmentShare: fulfillment / total, weights };
}

export function allChannelMixes(state: GameState, category: ProductCategoryId): Record<SegmentId, ChannelMix> {
  return Object.fromEntries(SEGMENT_IDS.map((s) => [s, channelMix(state, category, s)])) as Record<SegmentId, ChannelMix>;
}
