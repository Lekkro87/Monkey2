import { OFFICES } from '@/data/facilities';
import { insolvencyDaysLeft } from '@/systems/finance/insolvency';
import { officeHeadcount } from '@/systems/workforce/employees';
import type { GameState } from '@/types';
import { useGameSelector, rowsEqual } from './useGameSelectors';

export interface GameAlert {
  id: string;
  tone: 'bad' | 'warn' | 'info';
  title: string;
  text: string;
  link?: string;
}

export function computeAlerts(game: GameState): GameAlert[] {
  const alerts: GameAlert[] = [];
  const ins = game.insolvency;
  if (ins.stage === 'restructuring') {
    alerts.push({
      id: 'insolvency',
      tone: 'bad',
      title: 'Restrukturierung – Insolvenz droht',
      text: `Noch ${insolvencyDaysLeft(game) ?? 0} Tage, um das Konto ins Plus zu bringen: Kosten senken, Lager abverkaufen, Kredit oder Investor suchen.`,
      link: 'finance',
    });
  } else if (ins.stage === 'warning') {
    alerts.push({ id: 'overdraft', tone: 'bad', title: 'Konto im Minus', text: 'Der Dispokredit kostet 12 % Zinsen. Nach 30 Tagen beginnt die Restrukturierung.', link: 'finance' });
  }
  if (game.events.decisions.length > 0) {
    alerts.push({ id: 'decisions', tone: 'warn', title: 'Entscheidung erforderlich', text: game.events.decisions[0].title });
  }
  const stalled = game.production.lines.filter((l) => l.active && l.status === 'stalled');
  if (stalled.length > 0) {
    alerts.push({ id: 'stalled', tone: 'warn', title: `${stalled.length} Produktionslinie${stalled.length > 1 ? 'n' : ''} gestoppt`, text: stalled[0].stallReason ?? 'Produktion steht still.', link: 'production' });
  }
  const ready = game.products.filter((p) => p.status === 'ready');
  if (ready.length > 0) {
    alerts.push({ id: 'ready', tone: 'info', title: `${ready[0].name} ist marktreif`, text: 'Produktion einplanen und Markteinführung starten.', link: `products/${ready[0].id}` });
  }
  const blocked = game.products.find((p) => p.development?.blockedReason);
  if (blocked) alerts.push({ id: 'dev-blocked', tone: 'warn', title: `Entwicklung von ${blocked.name} stockt`, text: blocked.development!.blockedReason!, link: `products/${blocked.id}` });
  const eolParts = new Set<string>();
  for (const product of game.products) {
    if (product.status !== 'on_sale' && product.status !== 'ready') continue;
    for (const skuId of Object.values(product.components)) {
      const market = skuId ? game.components.market[skuId] : undefined;
      if (market && market.status !== 'active' && !game.components.skus[skuId!]?.inhouseProductId) eolParts.add(product.name);
    }
  }
  if (eolParts.size > 0) {
    alerts.push({ id: 'eol', tone: 'warn', title: 'Auslaufende Komponenten', text: `${[...eolParts].join(', ')} nutzt Auslaufmodelle. Entwickle eine Nachfolgeversion.`, link: 'products' });
  }
  const office = OFFICES[game.company.officeLevel];
  if (officeHeadcount(game) >= office.maxEmployees) {
    alerts.push({ id: 'office', tone: 'info', title: 'Büro voll', text: `${office.name}: maximal ${office.maxEmployees} Personen. Ein Umzug schafft Platz.`, link: 'company' });
  }
  const backorders = game.products.reduce((a, p) => a + p.sales.backorders, 0);
  if (backorders > 50) alerts.push({ id: 'backorders', tone: 'warn', title: `${backorders.toLocaleString('de-DE')} offene Kundenbestellungen`, text: 'Kunden warten – mehr Produktion oder höhere Preise verhindern Stornos.', link: 'production' });
  if (game.finance.fundingOffers.length > 0) alerts.push({ id: 'funding', tone: 'info', title: 'Investorenangebot liegt vor', text: game.finance.fundingOffers[0].investor, link: 'finance' });
  return alerts;
}

export function useAlerts(): GameAlert[] {
  return useGameSelector(computeAlerts, rowsEqual);
}
