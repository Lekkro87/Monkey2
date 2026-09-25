import { describe, expect, it } from 'vitest';
import type { GameState } from '@/types';
import { launchProduct, createProductDraft, resolveTemplateComponents, startDevelopment } from '@/systems/products/commands';
import { hireCandidate } from '@/systems/workforce/commands';
import { upgradeWorkshopTools, configureLine } from '@/systems/production/facilities';
import { billOfMaterials } from '@/systems/production/production';
import { orderComponents } from '@/systems/supply/purchasing';
import { startResearch } from '@/systems/research/research';
import { advance, advanceUntil, exec, newTestGame } from './helpers';

function hireFirst(state: GameState, department: string, count: number): GameState {
  let current = state;
  for (let i = 0; i < count; i++) {
    const candidate = current.workforce.candidates.find((c) => c.department === department);
    if (!candidate) break;
    current = exec(current, (d) => hireCandidate(d, candidate.id));
  }
  return current;
}

function orderBom(state: GameState, productId: string, units: number): GameState {
  const product = state.products.find((p) => p.id === productId)!;
  let current = state;
  for (const item of billOfMaterials(state, product)) {
    current = exec(current, (d) => orderComponents(d, item.sku.id, item.quantity * units, 'distributor'));
  }
  return current;
}

describe('MVP-Durchlauf', () => {
  it('gründen → einstellen → entwickeln → produzieren → verkaufen → Gewinn', () => {
    let state = newTestGame('normal', 7);
    state = hireFirst(state, 'engineering', 1);
    state = exec(state, upgradeWorkshopTools);
    state = exec(state, (d) => startResearch(d, 'lean_assembly'));

    const templateComponents = resolveTemplateComponents(state, 'novastation_basic');
    let productId = '';
    state = exec(state, (d) => {
      productId = createProductDraft(d, {
        name: 'NovaStation Basic',
        category: 'desktop',
        components: templateComponents,
        price: 599,
        devBudgetLevel: 'standard',
        templateId: 'novastation_basic',
      });
    });
    state = exec(state, (d) => startDevelopment(d, productId));
    const devStart = state.time.day;
    state = advanceUntil(state, (s) => s.products.find((p) => p.id === productId)!.status === 'ready', 200);
    const product = state.products.find((p) => p.id === productId)!;
    console.log('Entwicklung fertig nach Tagen:', state.time.day - devStart, 'Qualität', product.devQuality.toFixed(0), 'Cash', Math.round(state.finance.cash));
    expect(product.status).toBe('ready');

    state = hireFirst(state, 'production', 2);
    state = orderBom(state, productId, 40);
    const line = state.production.lines.find((l) => l.facilityId === 'workshop')!;
    state = exec(state, (d) => configureLine(d, line.id, { productId, active: true, autoReorder: true, reorderDays: 21 }));
    state = exec(state, (d) => launchProduct(d, productId));

    const log: string[] = [];
    for (let month = 0; month < 8; month++) {
      state = advance(state, 30);
      const p = state.products.find((x) => x.id === productId)!;
      const lineNow = state.production.lines.find((l) => l.id === line.id)!;
      log.push(
        `M${month + 1} Tag ${state.time.day}: Cash ${Math.round(state.finance.cash)} | verkauft ${p.sales.unitsSold} (30T: ${p.sales.unitsLast30}) | Nachfrage/Tag ${p.sales.demandToday.toFixed(1)} | Rückstand ${p.sales.backorders} | Lager ${state.inventory.products[productId]?.qty ?? 0} | Linie ${lineNow.status} ${lineNow.stallReason ?? ''} | Bekanntheit ${(state.brand.awareness.europe.mainstream * 100).toFixed(1)}% | Review ${p.review?.overall ?? '-'} | Rating ${p.customerRating.toFixed(2)} | Anteil ${((state.markets.desktop.share.player ?? 0) * 100).toFixed(3)}%`,
      );
    }
    console.log(log.join('\n'));
    const reports = state.finance.months.map((m) => `Monat ${m.month}: Umsatz ${Math.round(m.revenue)} EBITDA ${Math.round(m.ebitda)} Netto ${Math.round(m.netIncome)} Stück ${m.unitsSold}`);
    console.log(reports.join('\n'));
    const m3 = state.finance.months[3];
    if (m3) console.log('Ledger M3', JSON.stringify(Object.fromEntries(Object.entries(m3.ledger).filter(([, v]) => Math.abs(v) > 1).map(([k, v]) => [k, Math.round(v)]))));
    const final = state.products.find((p) => p.id === productId)!;
    expect(final.sales.unitsSold).toBeGreaterThan(100);
    expect(state.finance.lifetime.revenue).toBeGreaterThan(50_000);
    expect(state.finance.months.some((m) => m.netIncome > 0)).toBe(true);
  });
});
