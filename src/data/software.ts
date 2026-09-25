import type { SoftwareProjectDef } from '@/types';

export const SOFTWARE_PROJECTS: SoftwareProjectDef[] = [
  {
    id: 'drivers',
    name: 'Treiber-Suite',
    description: 'Eigene Treiber- und Update-Software für alle Geräte.',
    requiredTech: 'driver_suite',
    effort: 700,
    cost: 8_000,
    phases: ['Analyse', 'Entwicklung', 'Tests'],
    minDevelopers: 1,
    effects: { softwareBonus: 6 },
  },
  {
    id: 'backup',
    name: 'Backup-System',
    description: 'Automatische Datensicherung als Abo („Backup Plus“).',
    requiredTech: 'software_platform',
    effort: 2_200,
    cost: 30_000,
    phases: ['Konzept', 'Entwicklung', 'Beta', 'Release'],
    minDevelopers: 2,
    effects: {
      softwareBonus: 2,
      supportEfficiency: 0.05,
      subscription: { name: 'Backup Plus', pricePerMonth: 2.99, adoption: 0.03, categories: ['desktop', 'laptop', 'gaming_laptop', 'gaming_pc', 'smartphone', 'tablet'] },
    },
  },
  {
    id: 'launcher',
    name: 'Gaming-Launcher',
    description: 'Spielebibliothek mit Game-Pass-Abo für Gaming-Kunden.',
    requiredTech: 'software_platform',
    effort: 3_200,
    cost: 50_000,
    phases: ['Konzept', 'Entwicklung', 'Beta', 'Release'],
    minDevelopers: 3,
    effects: {
      softwareBonus: 2,
      innovationBonus: 2,
      subscription: { name: 'Gaming-Pass', pricePerMonth: 4.99, adoption: 0.05, categories: ['gaming_pc', 'gaming_laptop', 'graphics_card'] },
    },
  },
  {
    id: 'cloud',
    name: 'Cloud-Dienst',
    description: 'Cloud-Speicher und Gerätesynchronisation mit Abo-Modell.',
    requiredTech: 'cloud_services',
    effort: 14_000,
    cost: 450_000,
    phases: ['Architektur', 'Rechenzentrum', 'Entwicklung', 'Beta', 'Release'],
    minDevelopers: 8,
    effects: {
      softwareBonus: 3,
      innovationBonus: 3,
      subscription: {
        name: 'Cloud+',
        pricePerMonth: 3.99,
        adoption: 0.06,
        categories: ['desktop', 'gaming_pc', 'laptop', 'gaming_laptop', 'smartphone', 'tablet', 'smartwatch'],
      },
    },
  },
  {
    id: 'os',
    name: 'Eigenes Betriebssystem',
    description: 'Ein eigenes Desktop-Betriebssystem – spart Lizenzkosten und verbessert die Software.',
    requiredTech: 'os_kernel',
    effort: 120_000,
    cost: 20_000_000,
    phases: ['Kernel', 'Treiber', 'UI', 'App-System', 'Security', 'Cloud', 'Updates'],
    minDevelopers: 30,
    effects: {
      softwareBonus: 10,
      innovationBonus: 6,
      removesOsLicense: ['desktop', 'gaming_pc', 'laptop', 'gaming_laptop'],
      subscription: { name: 'App-Store-Umsatz', pricePerMonth: 0.6, adoption: 0.5, categories: ['desktop', 'gaming_pc', 'laptop', 'gaming_laptop'] },
    },
  },
  {
    id: 'mobile_os',
    name: 'Smartphone-Betriebssystem',
    description: 'Eigenes Mobile-OS mit App-Store für Smartphones, Tablets und Wearables.',
    requiredTech: 'mobile_os',
    effort: 150_000,
    cost: 30_000_000,
    phases: ['Kernel', 'Treiber', 'UI', 'App-System', 'Security', 'Cloud', 'Updates'],
    minDevelopers: 40,
    effects: {
      softwareBonus: 12,
      innovationBonus: 8,
      subscription: { name: 'Mobile-App-Store', pricePerMonth: 0.45, adoption: 0.6, categories: ['smartphone', 'tablet', 'smartwatch'] },
    },
  },
];

export function getSoftwareProject(id: string): SoftwareProjectDef | undefined {
  return SOFTWARE_PROJECTS.find((p) => p.id === id);
}
