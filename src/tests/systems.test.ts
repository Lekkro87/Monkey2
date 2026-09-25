import { describe, expect, it } from 'vitest';
import { runCommand } from '@/simulation/commands';
import { CATEGORY_IDS } from '@/data/categories';
import { skuId } from '@/systems/components/catalog';
import { lastReport } from '@/systems/finance/accounts';
import { ipoBlockers } from '@/systems/finance/stock';
import { quoteLoan, takeLoan } from '@/systems/finance/loans';
import { clearProductStock, sellComponents } from '@/systems/inventory/inventory';
import { OTHER_OWNER } from '@/systems/market/demand';
import { createProductDraft, resolveTemplateComponents } from '@/systems/products/commands';
import { evaluateDesign } from '@/systems/products/design';
import { configureLine, upgradeWorkshopTools } from '@/systems/production/facilities';
import { techEffects } from '@/systems/research/effects';
import { startResearch } from '@/systems/research/research';
import { updateSettings } from '@/systems/settings/settings';
import { orderComponents } from '@/systems/supply/purchasing';
import { bulkHire, hireCandidate } from '@/systems/workforce/commands';
import type { GameState } from '@/types';
import { annuityPayment } from '@/utils/math';
import { formatDays, formatPercent } from '@/utils/format';
import { advance, advanceUntil, exec, newTestGame, tryExec } from './helpers';

function draftFromTemplate(state: GameState, templateId: string, category: 'desktop' | 'gaming_pc'): { state: GameState; id: string } {
  const components = resolveTemplateComponents(state, templateId);
  let id = '';
  const next = exec(state, (d) => {
    id = createProductDraft(d, { name: 'Testprodukt', category, components, price: 999, devBudgetLevel: 'standard', templateId });
  });
  return { state: next, id };
}

describe('Forschung', () => {
  it('schließt eine Technologie ab und wendet ihre Wirkung an', () => {
    let state = newTestGame('normal', 11);
    expect(techEffects(state).productionEfficiency).toBe(0);
    state = exec(state, (d) => startResearch(d, 'lean_assembly'));
    state = advanceUntil(state, (s) => 'lean_assembly' in s.research.completed, 200);
    expect(state.research.completed.lean_assembly).toBeGreaterThan(0);
    expect(techEffects(state).productionEfficiency).toBeGreaterThan(0);
    expect(state.news.some((n) => n.title.includes('Schlanke Montage'))).toBe(true);
  });

  it('verweigert Technologien mit fehlenden Voraussetzungen mit klarer Meldung', () => {
    const state = newTestGame('normal', 12);
    const result = tryExec(state, (d) => startResearch(d, 'robotics'));
    expect(result.error).toMatch(/Voraussetzung fehlt|Labor|Forschende/);
  });
});

describe('Produktdesign', () => {
  it('erkennt ein zu schwaches Netzteil', () => {
    const state = newTestGame('normal', 21);
    const components = { ...resolveTemplateComponents(state, 'novastation_gaming'), psu: skuId('joltech-psu', 'j450', 1) };
    const evaluation = evaluateDesign(state, 'gaming_pc', components, 55);
    expect(evaluation.valid).toBe(false);
    expect(evaluation.errors.some((e) => e.slot === 'psu' && e.message.includes('Netzteil zu schwach'))).toBe(true);
  });

  it('bewertet die Beispielprodukte als gültig', () => {
    const state = newTestGame('normal', 22);
    for (const [template, category] of [
      ['novastation_basic', 'desktop'],
      ['novastation_gaming', 'gaming_pc'],
      ['novastation_pro', 'gaming_pc'],
    ] as const) {
      const evaluation = evaluateDesign(state, category, resolveTemplateComponents(state, template), 55);
      expect(evaluation.errors, template).toEqual([]);
      expect(evaluation.unitCost).toBeGreaterThan(0);
    }
  });
});

describe('Produktion', () => {
  it('meldet fehlende Komponenten als Stillstandsgrund', () => {
    let state = newTestGame('normal', 31);
    state = exec(state, upgradeWorkshopTools);
    const candidate = state.workforce.candidates.find((c) => c.department === 'production')!;
    state = exec(state, (d) => hireCandidate(d, candidate.id));
    const draft = draftFromTemplate(state, 'novastation_basic', 'desktop');
    // Testabkürzung: Produkt direkt als marktreif markieren.
    state = exec(draft.state, (d) => {
      d.products.find((p) => p.id === draft.id)!.status = 'ready';
    });
    const line = state.production.lines[0];
    state = exec(state, (d) => configureLine(d, line.id, { productId: draft.id, active: true, autoReorder: false }));
    state = advance(state, 2);
    const after = state.production.lines.find((l) => l.id === line.id)!;
    expect(after.status).toBe('stalled');
    expect(after.stallReason).toMatch(/Produktion gestoppt: .* fehlen/);
  });

  it('lehnt Produktionspersonal ohne Werkstattausstattung ab', () => {
    const state = newTestGame('normal', 32);
    const result = tryExec(state, (d) => bulkHire(d, 'production', 1, 'junior'));
    expect(result.error).toContain('Werkzeuge');
  });
});

describe('Finanzen', () => {
  it('berechnet Annuitätenkredite korrekt und bucht Zins und Tilgung', () => {
    let state = newTestGame('normal', 41);
    const cashBefore = state.finance.cash;
    const quote = quoteLoan(state, 20_000, 36);
    expect(quote.monthlyPayment).toBeCloseTo(annuityPayment(20_000, quote.annualRate, 36), 6);
    state = exec(state, (d) => takeLoan(d, 20_000, 36));
    expect(state.finance.cash).toBeCloseTo(cashBefore + 20_000, 6);
    const loan = state.finance.loans[0];
    state = advanceUntil(state, (s) => s.finance.months.length >= 1, 40);
    const updated = state.finance.loans[0];
    const interest = 20_000 * (loan.annualRate / 12);
    expect(updated.remaining).toBeCloseTo(20_000 - (loan.monthlyPayment - interest), 4);
    // Die Rate wird zu Monatsbeginn fällig und im laufenden Monat verbucht.
    expect(state.finance.ledger.interest).toBeLessThan(0);
    expect(lastReport(state)).toBeDefined();
  });

  it('begrenzt Kredite auf den Kreditrahmen', () => {
    const state = newTestGame('normal', 42);
    const result = tryExec(state, (d) => takeLoan(d, 50_000_000, 60));
    expect(result.error).toContain('Kreditrahmen');
  });

  it('verkauft überschüssige Komponenten mit Abschlag', () => {
    let state = newTestGame('normal', 43);
    const sku = skuId('joltech-psu', 'j450', 1);
    state = exec(state, (d) => orderComponents(d, sku, 100, 'distributor'));
    state = advance(state, 5);
    const stock = state.inventory.components[sku];
    expect(stock.qty).toBe(100);
    const cash = state.finance.cash;
    state = exec(state, (d) => sellComponents(d, sku, 40));
    expect(state.inventory.components[sku].qty).toBe(60);
    const proceeds = state.finance.cash - cash;
    expect(proceeds).toBeGreaterThan(0);
    expect(proceeds).toBeLessThan(40 * stock.avgCost);
    expect(state.finance.ledger.cogs).toBeLessThan(0);
    expect(tryExec(state, (d) => sellComponents(d, sku, 1_000)).error).toContain('auf Lager');
  });

  it('verkauft Fertigwaren als Restposten', () => {
    let state = newTestGame('normal', 44);
    const draft = draftFromTemplate(state, 'novastation_basic', 'desktop');
    state = exec(draft.state, (d) => {
      d.inventory.products[draft.id] = { qty: 10, avgCost: 400 };
    });
    const revenueBefore = state.finance.ledger.sales;
    state = exec(state, (d) => clearProductStock(d, draft.id, 10));
    expect(state.inventory.products[draft.id].qty).toBe(0);
    expect(state.finance.ledger.sales - revenueBefore).toBeCloseTo(10 * 999 * 0.45, 6);
    expect(state.finance.ledger.cogs).toBeCloseTo(-4_000, 6);
  });

  it('nennt die Voraussetzungen für den Börsengang', () => {
    const state = newTestGame('normal', 45);
    expect(ipoBlockers(state).length).toBeGreaterThan(2);
  });
});

describe('Markt', () => {
  it('simuliert auch Kategorien ohne Angebote (Nachfrage geht an andere Hersteller)', () => {
    const state = advance(newTestGame('normal', 51), 3);
    for (const category of CATEGORY_IDS) {
      expect(state.markets[category].dailyDemand, category).toBeGreaterThan(0);
    }
    expect(state.markets.processor.rolling[OTHER_OWNER]).toBeGreaterThan(0);
  });
});

describe('Einstellungen & Formatierung', () => {
  it('validiert Einstellungen', () => {
    const state = newTestGame('normal', 61);
    expect(runCommand(state, (d) => updateSettings(d, { autosaveIntervalDays: 13 })).result.ok).toBe(false);
    const next = exec(state, (d) => updateSettings(d, { autosaveIntervalDays: 7, pauseOnDecision: false }));
    expect(next.settings.autosaveIntervalDays).toBe(7);
    expect(next.settings.pauseOnDecision).toBe(false);
  });

  it('formatiert kleine Anteile und Tage verständlich', () => {
    expect(formatPercent(0.00001, 2)).toBe('< 0,01 %');
    expect(formatPercent(0.0004)).toBe('< 0,1 %');
    expect(formatPercent(0.25, 0)).toBe('25 %');
    expect(formatDays(1)).toBe('1 Tag');
    expect(formatDays(12)).toBe('12 Tage');
  });
});
