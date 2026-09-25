import type { DifficultyId } from '@/types';

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  description: string;
  highlights: string[];
  startingCash: number;
  productionCost: number;
  demand: number;
  eventFrequency: number;
  competitorAggression: number;
  priceVolatility: number;
  interestSpread: number;
  developmentCost: number;
  defectRate: number;
  /** Tage negativer Liquidität bis zur Insolvenz; null = keine Insolvenz (Rettung durch Gründerkapital). */
  insolvencyGraceDays: number | null;
  emergencyLoan: boolean;
  marketVolatility: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: 'Einfach',
    description: 'Viel Spielraum zum Ausprobieren.',
    highlights: ['150.000 € Startkapital', '10 % geringere Produktionskosten', 'höhere Nachfrage', 'weniger Ereignisse', 'keine Insolvenz'],
    startingCash: 150_000,
    productionCost: 0.9,
    demand: 1.2,
    eventFrequency: 0.6,
    competitorAggression: 0.75,
    priceVolatility: 0.6,
    interestSpread: -0.01,
    developmentCost: 0.85,
    defectRate: 0.7,
    insolvencyGraceDays: null,
    emergencyLoan: true,
    marketVolatility: 0.7,
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    description: 'Ausbalancierte Wirtschaft – so ist das Spiel gedacht.',
    highlights: ['50.000 € Startkapital', 'ausgewogene Märkte', 'Insolvenz nach Restrukturierungsphase'],
    startingCash: 50_000,
    productionCost: 1,
    demand: 1,
    eventFrequency: 1,
    competitorAggression: 1,
    priceVolatility: 1,
    interestSpread: 0,
    developmentCost: 1,
    defectRate: 1,
    insolvencyGraceDays: 120,
    emergencyLoan: true,
    marketVolatility: 1,
  },
  hard: {
    id: 'hard',
    name: 'Schwer',
    description: 'Knappe Mittel, harte Konkurrenz, schwankende Preise.',
    highlights: ['30.000 € Startkapital', 'hohe Konkurrenz', 'volatile Komponentenpreise', 'höhere Kreditzinsen', 'aufwendigere Entwicklung'],
    startingCash: 30_000,
    productionCost: 1.05,
    demand: 0.9,
    eventFrequency: 1.2,
    competitorAggression: 1.3,
    priceVolatility: 1.6,
    interestSpread: 0.02,
    developmentCost: 1.2,
    defectRate: 1.15,
    insolvencyGraceDays: 90,
    emergencyLoan: true,
    marketVolatility: 1.3,
  },
  hardcore: {
    id: 'hardcore',
    name: 'Hardcore',
    description: 'Realistische Probleme, geringe Fehlertoleranz.',
    highlights: ['20.000 € Startkapital', 'Insolvenz nach 30 Tagen Zahlungsunfähigkeit', 'starke Marktschwankungen', 'realistische Produktionsprobleme', 'kein Notkredit'],
    startingCash: 20_000,
    productionCost: 1.1,
    demand: 0.85,
    eventFrequency: 1.5,
    competitorAggression: 1.5,
    priceVolatility: 2,
    interestSpread: 0.03,
    developmentCost: 1.35,
    defectRate: 1.5,
    insolvencyGraceDays: 30,
    emergencyLoan: false,
    marketVolatility: 1.8,
  },
};

export const DIFFICULTY_LIST = Object.values(DIFFICULTIES);
