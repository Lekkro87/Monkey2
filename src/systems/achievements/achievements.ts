import { addNews } from '@/simulation/news';
import type { AchievementDef, GameState } from '@/types';
import { openRegions } from '@/systems/market/regions';

interface AchievementRule extends AchievementDef {
  check: (state: GameState) => boolean;
}

export const ACHIEVEMENTS: AchievementRule[] = [
  { id: 'first_product', title: 'Marktreif', description: 'Das erste eigene Produkt ist im Handel.', icon: 'package', check: (s) => s.stats.productsLaunched >= 1 },
  { id: 'first_sale', title: 'Erstes Produkt verkauft', description: 'Die erste Kundin, der erste Kunde!', icon: 'shopping-cart', check: (s) => s.stats.unitsSoldTotal >= 1 },
  { id: 'first_profit', title: 'Schwarze Zahlen', description: 'Erster Monat mit Gewinn.', icon: 'trending-up', check: (s) => s.finance.months.some((m) => m.netIncome > 0) },
  { id: 'first_research', title: 'Forschergeist', description: 'Erste Technologie erforscht.', icon: 'flask', check: (s) => Object.keys(s.research.completed).length >= 1 },
  { id: 'revenue_1m', title: '1 Mio. € Umsatz', description: 'Kumulierter Umsatz von einer Million Euro.', icon: 'euro', check: (s) => s.finance.lifetime.revenue >= 1_000_000 },
  { id: 'startup', title: 'Raus aus der Garage', description: 'Stufe 2: Start-up erreicht.', icon: 'building', check: (s) => s.company.stage >= 2 },
  { id: 'first_factory', title: 'Erste Fabrik', description: 'Eine eigene Fabrik ist in Betrieb.', icon: 'factory', check: (s) => s.production.factories.some((f) => f.status !== 'construction') },
  { id: 'units_10k', title: '10.000 Geräte', description: '10.000 verkaufte Geräte.', icon: 'boxes', check: (s) => s.stats.unitsSoldTotal >= 10_000 },
  { id: 'employees_100', title: 'Hundertschaft', description: '100 Mitarbeitende.', icon: 'users', check: (s) => s.workforce.employees.length >= 100 },
  { id: 'research_lab', title: 'Labor eröffnet', description: 'Das erste eigene Forschungslabor.', icon: 'microscope', check: (s) => s.research.labLevel >= 1 },
  { id: 'company', title: 'Unternehmen', description: 'Stufe 3: Unternehmen erreicht.', icon: 'briefcase', check: (s) => s.company.stage >= 3 },
  { id: 'first_global', title: 'Erster globaler Markt', description: 'Eine zweite Weltregion erschlossen.', icon: 'globe', check: (s) => openRegions(s).length >= 2 },
  { id: 'market_leader', title: 'Marktführer', description: '25 % Marktanteil in einer Kategorie.', icon: 'crown', check: (s) => Object.values(s.markets).some((m) => (m.share.player ?? 0) >= 0.25) },
  { id: 'employees_1000', title: '1.000 Mitarbeitende', description: 'Ein echter Großbetrieb.', icon: 'users', check: (s) => s.workforce.employees.length >= 1_000 },
  { id: 'units_1m', title: 'Millionenseller', description: '1 Mio. verkaufte Geräte.', icon: 'boxes', check: (s) => s.stats.unitsSoldTotal >= 1_000_000 },
  { id: 'konzern', title: 'Konzern', description: 'Stufe 4: Konzern erreicht.', icon: 'landmark', check: (s) => s.company.stage >= 4 },
  { id: 'ipo', title: 'Börsengang', description: 'Das Unternehmen ist börsennotiert.', icon: 'line-chart', check: (s) => s.finance.stock.isPublic },
  { id: 'own_chip', title: 'Eigene Chips', description: 'Ein eigener Prozessor ist im Handel.', icon: 'cpu', check: (s) => s.products.some((p) => p.category === 'processor' && p.launchDay !== undefined) },
  { id: 'valuation_1b', title: '1 Mrd. € Unternehmenswert', description: 'Ein Einhorn!', icon: 'gem', check: (s) => s.finance.lifetime.peakValuation >= 1_000_000_000 },
  { id: 'own_os', title: 'Eigenes Betriebssystem', description: 'Ein eigenes Betriebssystem wurde veröffentlicht.', icon: 'monitor', check: (s) => s.software.projects.os?.completedDay !== undefined || s.software.projects.mobile_os?.completedDay !== undefined },
  { id: 'units_100m', title: '100 Mio. verkaufte Geräte', description: 'Hundert Millionen Kundinnen und Kunden.', icon: 'rocket', check: (s) => s.stats.unitsSoldTotal >= 100_000_000 },
  { id: 'tech_corp', title: 'Technologiekonzern', description: 'Stufe 5: Globaler Technologiekonzern.', icon: 'trophy', check: (s) => s.company.stage >= 5 },
];

export function checkAchievements(state: GameState): void {
  for (const achievement of ACHIEVEMENTS) {
    if (state.achievements[achievement.id] !== undefined) continue;
    if (!achievement.check(state)) continue;
    state.achievements = { ...state.achievements, [achievement.id]: state.time.day };
    addNews(state, 'achievement', 'positive', `Erfolg freigeschaltet: ${achievement.title}`, achievement.description);
  }
}
