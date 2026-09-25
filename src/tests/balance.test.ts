import { describe, expect, it } from 'vitest';
import { OFFICES, WORKSHOP_TOOLS } from '@/data/facilities';
import { PRODUCT_TEMPLATES } from '@/data/templates';
import { runCommand, type Command } from '@/simulation/commands';
import { simulateDays } from '@/simulation/GameSimulation';
import { moveOffice } from '@/systems/company/company';
import { creditLimit, takeLoan } from '@/systems/finance/loans';
import { startCampaign } from '@/systems/marketing/marketing';
import { createProductDraft, createSuccessor, discontinueProduct, launchProduct, resolveTemplateComponents, setProductPrice, startDevelopment } from '@/systems/products/commands';
import { evaluateDesign } from '@/systems/products/design';
import { addProductionLine, buildFactory, configureLine, factoryBuildCost, maxLines, upgradeFactory, upgradeWorkshopTools } from '@/systems/production/facilities';
import { factoryWorkersNeeded } from '@/data/facilities';
import { availableTechnologies, queueResearch, researchBlocker } from '@/systems/research/research';
import { bulkHire, facilityWorkerLimit } from '@/systems/workforce/commands';
import { departmentHeadcount, facilityHeadcount, officeCapacity, officeHeadcount } from '@/systems/workforce/employees';
import type { GameState } from '@/types';
import { newTestGame } from './helpers';

function attempt(state: GameState, command: Command, log?: string[]): GameState {
  const { state: next, result } = runCommand(state, command);
  if (result.ok && result.message && log) log.push(`  Tag ${state.time.day}: ${result.message}`);
  return next;
}

const PLAN = ['novastation_basic', 'novastation_gaming', 'novastation_pro'];

function policy(state: GameState, log: string[]): GameState {
  let s = state;
  const cash = () => s.finance.cash;

  // Liquidität sichern
  if (cash() < 6_000 && s.finance.loans.length < 3 && creditLimit(s) >= 10_000) {
    s = attempt(s, (d) => takeLoan(d, Math.min(40_000, Math.floor(creditLimit(d) / 1000) * 1000), 36), log);
  }

  // Preise nach Lieferfähigkeit steuern
  for (const p of s.products.filter((x) => x.status === 'on_sale')) {
    const template = PRODUCT_TEMPLATES.find((t) => t.id === p.templateId);
    const base = template?.price ?? p.price;
    const perDay = Math.max(0.5, p.sales.unitsLast30 / 30);
    const stock = s.inventory.products[p.id]?.qty ?? 0;
    if (p.sales.backorders > Math.max(15, perDay * 5) && p.price < base * 1.5) s = attempt(s, (d) => setProductPrice(d, p.id, Math.round(p.price * 1.04)));
    else if (stock > perDay * 25 && p.sales.backorders === 0 && p.price > base * 0.8) s = attempt(s, (d) => setProductPrice(d, p.id, Math.round(p.price * 0.97)));
  }

  // Büro vergrößern
  const office = OFFICES[s.company.officeLevel + 1];
  if (office && !s.company.officeMove && officeHeadcount(s) >= officeCapacity(s) - 1 && cash() > office.moveCost * 2 + 20_000) s = attempt(s, moveOffice, log);

  // Werkstatt ausbauen
  const tools = WORKSHOP_TOOLS[s.production.workshop.toolLevel + 1];
  if (tools && facilityHeadcount(s, 'workshop') >= facilityWorkerLimit(s, 'workshop') && cash() > tools.cost * 2.5) s = attempt(s, upgradeWorkshopTools, log);

  // Produktionspersonal bei Lieferrückstand
  const backorders = s.products.reduce((a, p) => a + p.sales.backorders, 0);
  if (backorders > 40 && cash() > 20_000 && facilityHeadcount(s, 'workshop') < facilityWorkerLimit(s, 'workshop') && officeHeadcount(s) < officeCapacity(s)) {
    s = attempt(s, (d) => bulkHire(d, 'production', 1, 'junior'), log);
  }

  // Vertrieb & Support mit wachsender Größe
  if (s.stats.unitsSoldTotal > 300 && departmentHeadcount(s, 'support') < 1 && cash() > 25_000 && officeHeadcount(s) < officeCapacity(s)) s = attempt(s, (d) => bulkHire(d, 'support', 1, 'junior'), log);
  if (s.company.officeLevel >= 1 && departmentHeadcount(s, 'sales') < 1 && cash() > 30_000 && officeHeadcount(s) < officeCapacity(s)) s = attempt(s, (d) => bulkHire(d, 'sales', 1, 'junior'), log);

  // Marketing
  const activeCampaign = s.marketing.campaigns.some((c) => c.endDay > s.time.day);
  if (!activeCampaign && cash() > 25_000 && s.products.some((p) => p.status === 'on_sale')) {
    s = attempt(s, (d) => startCampaign(d, 'online_ads', d.company.homeRegion, Math.min(600, Math.round(cash() / 150)), 30), log);
  }

  // Forschung
  if (!s.research.active && s.research.queue.length === 0) {
    const next = availableTechnologies(s)
      .filter((t) => !researchBlocker(s, t))
      .sort((a, b) => a.cost - b.cost)[0];
    if (next) s = attempt(s, (d) => queueResearch(d, next.id), log);
  }

  // Produktportfolio erweitern
  const developing = s.products.some((p) => p.status === 'development');
  const nextTemplate = PLAN.find((id) => !s.products.some((p) => p.templateId === id));
  if (!developing && nextTemplate && (s.products.length === 0 || cash() > 70_000)) {
    const template = PRODUCT_TEMPLATES.find((t) => t.id === nextTemplate)!;
    const components = resolveTemplateComponents(s, template.id);
    if (evaluateDesign(s, template.category, components, 55).valid) {
      let id = '';
      s = attempt(s, (d) => {
        id = createProductDraft(d, { name: template.name, category: template.category, components, price: template.price, devBudgetLevel: 'standard', templateId: template.id });
      });
      if (id) s = attempt(s, (d) => startDevelopment(d, id), log);
    }
  }
  if (developing && departmentHeadcount(s, 'engineering') < 2 && cash() > 45_000 && officeHeadcount(s) < officeCapacity(s)) s = attempt(s, (d) => bulkHire(d, 'engineering', 1, 'professional'), log);

  // Auslaufende Komponenten: Nachfolger entwickeln
  if (!s.products.some((p) => p.status === 'development')) {
    for (const p of s.products.filter((x) => x.status === 'on_sale')) {
      const aging = Object.values(p.components).some((id) => id && s.components.market[id] && s.components.market[id].status !== 'active');
      if (!aging || s.products.some((x) => x.predecessorId === p.id)) continue;
      let id = '';
      s = attempt(s, (d) => {
        id = createSuccessor(d, p.id);
      });
      if (id) s = attempt(s, (d) => startDevelopment(d, id), log);
      break;
    }
  }

  // Eigene Fabrik, sobald die Werkstatt ausgelastet ist
  const lastTools = s.production.workshop.toolLevel >= WORKSHOP_TOOLS.length - 1;
  if (lastTools && s.company.officeLevel >= 1 && s.production.factories.length === 0 && cash() > factoryBuildCost(s, 'cz_brno', 'pc_assembly') * 1.6) {
    s = attempt(s, (d) => buildFactory(d, 'cz_brno', 'pc_assembly'), log);
  }
  for (const factory of s.production.factories) {
    if (factory.status !== 'operational') continue;
    const needed = factoryWorkersNeeded(factory.level, factory.automation);
    const have = facilityHeadcount(s, factory.id);
    if (have < needed && cash() > 50_000) s = attempt(s, (d) => bulkHire(d, 'production', Math.min(needed - have, 60), 'junior', factory.id), log);
    const lines = s.production.lines.filter((l) => l.facilityId === factory.id);
    const onSale = s.products.filter((p) => (p.status === 'on_sale' || p.status === 'ready') && (p.category === 'desktop' || p.category === 'gaming_pc'));
    for (const p of onSale) {
      if (lines.some((l) => l.productId === p.id)) continue;
      if (lines.length >= maxLines(s, factory.id)) break;
      s = attempt(s, (d) => addProductionLine(d, factory.id));
      const line = s.production.lines.find((l) => l.facilityId === factory.id && !l.productId);
      if (line) s = attempt(s, (d) => configureLine(d, line.id, { productId: p.id, active: true, autoReorder: true, shippingMode: 'truck', reorderDays: 30 }), log);
    }
    if (s.stats.utilization > 0.85 && factory.level < 6 && cash() > 3_000_000) s = attempt(s, (d) => upgradeFactory(d, factory.id), log);
  }

  // Fertige Produkte einplanen und einführen
  for (const p of s.products.filter((x) => x.status === 'ready')) {
    let line = s.production.lines.find((l) => l.productId === p.id);
    if (!line) {
      line = s.production.lines.find((l) => !l.productId && l.facilityId === 'workshop');
      if (!line && s.production.lines.filter((l) => l.facilityId === 'workshop').length < maxLines(s, 'workshop')) {
        s = attempt(s, (d) => addProductionLine(d, 'workshop'));
        line = s.production.lines.find((l) => !l.productId && l.facilityId === 'workshop');
      }
      if (line) {
        const lineId = line.id;
        s = attempt(s, (d) => configureLine(d, lineId, { productId: p.id, active: true, autoReorder: true }), log);
      }
    }
    s = attempt(s, (d) => launchProduct(d, p.id), log);
    // Vorgänger ablösen: Linien übernehmen und Vorgänger einstellen
    if (p.predecessorId) {
      const predecessorId = p.predecessorId;
      for (const line of s.production.lines.filter((l) => l.productId === predecessorId)) {
        s = attempt(s, (d) => configureLine(d, line.id, { productId: p.id, active: true }));
      }
      s = attempt(s, (d) => discontinueProduct(d, predecessorId), log);
    }
  }
  // Produkte im Verkauf ohne Linie einplanen
  for (const p of s.products.filter((x) => x.status === 'on_sale' && !s.production.lines.some((l) => l.productId === x.id))) {
    if (s.production.lines.filter((l) => l.facilityId === 'workshop').length < maxLines(s, 'workshop')) s = attempt(s, (d) => addProductionLine(d, 'workshop'));
    const free = s.production.lines.find((l) => !l.productId && l.facilityId === 'workshop');
    if (free) s = attempt(s, (d) => configureLine(d, free.id, { productId: p.id, active: true, autoReorder: true }), log);
  }
  return s;
}

describe('Balancing (skriptgesteuerter Spieler)', () => {
  it('wächst auf „Normal“ in drei Jahren profitabel bis zur Stufe „Unternehmen“', () => {
    let state = newTestGame('normal', 2024);
    const log: string[] = [];
    state = attempt(state, upgradeWorkshopTools, log);
    state = attempt(state, (d) => bulkHire(d, 'engineering', 1, 'junior'), log);
    state = attempt(state, (d) => bulkHire(d, 'production', 2, 'junior'), log);
    for (let week = 1; week <= 52 * 3; week++) {
      state = simulateDays(state, 7);
      state = policy(state, log);
      expect(state.status).toBe('running');
      expect(Number.isFinite(state.finance.cash)).toBe(true);
    }
    const lastHalfYear = state.finance.months.slice(-6);
    expect(state.company.stage).toBeGreaterThanOrEqual(3);
    expect(lastHalfYear.reduce((a, m) => a + m.netIncome, 0)).toBeGreaterThan(0);
    expect(state.products.some((p) => p.status === 'on_sale' && p.sales.unitsLast30 > 0)).toBe(true);
    // Nachfolgemodelle lösen Produkte mit auslaufenden Komponenten ab.
    expect(state.products.some((p) => p.predecessorId && p.status === 'on_sale')).toBe(true);
    expect(state.production.factories.length).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
