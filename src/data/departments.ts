import type { DepartmentId, EmployeeLevel, TraitId } from '@/types';

export interface DepartmentDef {
  id: DepartmentId;
  name: string;
  description: string;
  /** Monatsgehalt eines Professionals (Skill 50) in EUR beim Standort-Faktor 1. */
  baseSalary: number;
  /** Anteil, der in Büroflächen arbeitet (Produktion arbeitet in Werkstatt/Fabrik). */
  officeBased: boolean;
  color: string;
}

export const DEPARTMENTS: Record<DepartmentId, DepartmentDef> = {
  management: {
    id: 'management',
    name: 'Management',
    description: 'Koordination – ohne genug Führungskräfte sinkt die Effizienz aller Abteilungen.',
    baseSalary: 6_500,
    officeBased: true,
    color: '#a78bfa',
  },
  engineering: {
    id: 'engineering',
    name: 'Engineering',
    description: 'Produktentwicklung: Konstruktion, Thermik, Integration.',
    baseSalary: 5_000,
    officeBased: true,
    color: '#60a5fa',
  },
  hardware: {
    id: 'hardware',
    name: 'Hardware',
    description: 'Elektronik- und Chipdesign für komplexe Produkte.',
    baseSalary: 5_400,
    officeBased: true,
    color: '#38bdf8',
  },
  software: {
    id: 'software',
    name: 'Software',
    description: 'Firmware, Treiber, Apps und Betriebssysteme. Verbessert die Software-Wertung.',
    baseSalary: 5_200,
    officeBased: true,
    color: '#34d399',
  },
  research: {
    id: 'research',
    name: 'Forschung',
    description: 'Erzeugt Forschungspunkte für den Technologiebaum.',
    baseSalary: 5_600,
    officeBased: true,
    color: '#f472b6',
  },
  production: {
    id: 'production',
    name: 'Produktion',
    description: 'Montage in der Werkstatt und Personal der Fabriken.',
    baseSalary: 2_900,
    officeBased: false,
    color: '#fbbf24',
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing',
    description: 'Erhöht die Wirkung von Kampagnen und die Markenbekanntheit.',
    baseSalary: 4_300,
    officeBased: true,
    color: '#fb7185',
  },
  sales: {
    id: 'sales',
    name: 'Vertrieb',
    description: 'Voraussetzung für Händler, Elektronikmärkte und Großkunden.',
    baseSalary: 4_200,
    officeBased: true,
    color: '#f97316',
  },
  logistics: {
    id: 'logistics',
    name: 'Logistik',
    description: 'Senkt Versandkosten und hält Lieferungen pünktlich.',
    baseSalary: 3_400,
    officeBased: true,
    color: '#a3e635',
  },
  support: {
    id: 'support',
    name: 'Support',
    description: 'Beantwortet Kundenanfragen – entscheidend für die Zufriedenheit.',
    baseSalary: 3_100,
    officeBased: true,
    color: '#2dd4bf',
  },
  finance: {
    id: 'finance',
    name: 'Finanzen',
    description: 'Senkt Verwaltungs- und Kreditkosten, nötig für Investoren und Börsengang.',
    baseSalary: 4_800,
    officeBased: true,
    color: '#94a3b8',
  },
};

export const DEPARTMENT_IDS = Object.keys(DEPARTMENTS) as DepartmentId[];

export interface LevelDef {
  id: EmployeeLevel;
  name: string;
  salaryFactor: number;
  productivity: number;
  minSkill: number;
  minExperience: number;
}

export const LEVELS: Record<EmployeeLevel, LevelDef> = {
  junior: { id: 'junior', name: 'Junior', salaryFactor: 0.75, productivity: 0.8, minSkill: 0, minExperience: 0 },
  professional: { id: 'professional', name: 'Professional', salaryFactor: 1, productivity: 1, minSkill: 40, minExperience: 2 },
  senior: { id: 'senior', name: 'Senior', salaryFactor: 1.35, productivity: 1.2, minSkill: 60, minExperience: 5 },
  lead: { id: 'lead', name: 'Lead', salaryFactor: 1.75, productivity: 1.35, minSkill: 72, minExperience: 8 },
  director: { id: 'director', name: 'Director', salaryFactor: 2.4, productivity: 1.5, minSkill: 84, minExperience: 12 },
};

export const LEVEL_ORDER: EmployeeLevel[] = ['junior', 'professional', 'senior', 'lead', 'director'];

export interface TraitDef {
  id: TraitId;
  name: string;
  description: string;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  perfectionist: { id: 'perfectionist', name: 'Perfektionist', description: 'Etwas langsamer, aber höhere Qualität.' },
  fast_learner: { id: 'fast_learner', name: 'Schnelllerner', description: 'Sammelt doppelt so schnell Erfahrung.' },
  team_player: { id: 'team_player', name: 'Teamplayer', description: 'Hebt die Motivation der Abteilung.' },
  loyal: { id: 'loyal', name: 'Loyal', description: 'Kündigt selten, auch bei geringer Motivation.' },
  ambitious: { id: 'ambitious', name: 'Ehrgeizig', description: 'Produktiv, erwartet aber Beförderungen.' },
  creative: { id: 'creative', name: 'Kreativ', description: 'Bessere Designs und Forschungsideen.' },
  efficient: { id: 'efficient', name: 'Effizient', description: '+10 % Produktivität.' },
  mentor: { id: 'mentor', name: 'Mentor', description: 'Kollegen sammeln schneller Erfahrung.' },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

/** Effektive Arbeitsstunden pro Kalendertag einer Vollzeitkraft (5-Tage-Woche). */
export const HOURS_PER_DAY = 8 * (5 / 7);

/** Kosten einer Weiterbildung pro Tag (EUR). */
export const TRAINING_COST_PER_DAY = 250;
export const RECRUITING_FEE_FACTOR = 0.35;
