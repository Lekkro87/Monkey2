import type { DevPhaseId } from '@/types';

export interface DevPhaseDef {
  id: DevPhaseId;
  name: string;
  description: string;
  effortShare: number;
  budgetShare: number;
  minDays: number;
}

export const DEV_PHASES: DevPhaseDef[] = [
  { id: 'idea', name: 'Idee', description: 'Marktanalyse und Zielgruppe festlegen.', effortShare: 0.05, budgetShare: 0.03, minDays: 2 },
  { id: 'concept', name: 'Konzept', description: 'Pflichtenheft, Komponentenauswahl, Kalkulation.', effortShare: 0.12, budgetShare: 0.1, minDays: 4 },
  { id: 'prototype', name: 'Prototyp', description: 'Erste Funktionsmuster bauen.', effortShare: 0.25, budgetShare: 0.27, minDays: 6 },
  {
    id: 'engineering_sample',
    name: 'Engineering Sample',
    description: 'Seriennahe Muster mit finalem Design.',
    effortShare: 0.25,
    budgetShare: 0.25,
    minDays: 6,
  },
  { id: 'testing', name: 'Tests', description: 'Belastungs-, Temperatur- und Langzeittests.', effortShare: 0.2, budgetShare: 0.2, minDays: 5 },
  { id: 'certification', name: 'Zertifizierung', description: 'CE-, Funk- und Sicherheitszertifikate.', effortShare: 0.03, budgetShare: 0.05, minDays: 0 },
  {
    id: 'mass_production',
    name: 'Massenproduktion',
    description: 'Werkzeuge, Fertigungsprozesse und Serienfreigabe.',
    effortShare: 0.1,
    budgetShare: 0.1,
    minDays: 3,
  },
];

/** Anzeige-Schritte inkl. Verkaufsstart (erfolgt durch den Spieler). */
export const LIFECYCLE_STEPS = [...DEV_PHASES.map((p) => p.name), 'Verkaufsstart'];
