import { getManufacturer, PLAYER_MANUFACTURER_ID } from '@/data/manufacturers';

/**
 * Markenlizenz-Konfiguration. Standardmäßig verwendet das Spiel ausschließlich fiktive
 * Hersteller. Liegt eine gültige Lizenz vor, können Anzeigenamen und Logos einzelner
 * Hersteller überschrieben werden – die Spielmechanik bleibt unverändert.
 */
export interface BrandLicenseEntry {
  displayName: string;
  logoUrl?: string;
}

export interface BrandLicenseConfig {
  licensed: boolean;
  licensee: string;
  validUntil?: string;
  manufacturers: Record<string, BrandLicenseEntry>;
}

const STORAGE_KEY = 'tech-empire:brand-license';
let activeConfig: BrandLicenseConfig | null = null;
let playerBrandName = 'Eigenentwicklung';

export function validateBrandLicense(input: unknown): { config: BrandLicenseConfig | null; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return { config: null, errors: ['Die Datei enthält kein gültiges JSON-Objekt.'] };
  const raw = input as Record<string, unknown>;
  if (raw.licensed !== true) errors.push('Das Feld „licensed“ muss true sein – ohne Lizenz werden nur fiktive Marken verwendet.');
  if (typeof raw.licensee !== 'string' || raw.licensee.trim() === '') errors.push('Das Feld „licensee“ (Lizenznehmer) fehlt.');
  if (typeof raw.validUntil === 'string' && Number.isNaN(Date.parse(raw.validUntil))) errors.push('„validUntil“ ist kein gültiges Datum.');
  if (typeof raw.validUntil === 'string' && Date.parse(raw.validUntil) < Date.now()) errors.push('Die Lizenz ist abgelaufen.');
  const manufacturers: Record<string, BrandLicenseEntry> = {};
  if (!raw.manufacturers || typeof raw.manufacturers !== 'object') {
    errors.push('Das Feld „manufacturers“ fehlt.');
  } else {
    for (const [id, value] of Object.entries(raw.manufacturers as Record<string, unknown>)) {
      if (!getManufacturer(id)) {
        errors.push(`Unbekannte Hersteller-ID „${id}“.`);
        continue;
      }
      const entry = value as Record<string, unknown>;
      if (!entry || typeof entry.displayName !== 'string' || entry.displayName.trim() === '') {
        errors.push(`Für „${id}“ fehlt „displayName“.`);
        continue;
      }
      manufacturers[id] = {
        displayName: entry.displayName.trim(),
        logoUrl: typeof entry.logoUrl === 'string' ? entry.logoUrl : undefined,
      };
    }
  }
  if (errors.length > 0) return { config: null, errors };
  return {
    config: {
      licensed: true,
      licensee: String(raw.licensee),
      validUntil: typeof raw.validUntil === 'string' ? raw.validUntil : undefined,
      manufacturers,
    },
    errors,
  };
}

export function getBrandLicense(): BrandLicenseConfig | null {
  return activeConfig;
}

export function applyBrandLicense(config: BrandLicenseConfig | null, persist = true): void {
  activeConfig = config;
  if (!persist || typeof localStorage === 'undefined') return;
  try {
    if (config) localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Speicher nicht verfügbar – Konfiguration gilt nur für diese Sitzung.
  }
}

export function loadStoredBrandLicense(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const { config } = validateBrandLicense(JSON.parse(raw));
    activeConfig = config;
  } catch {
    activeConfig = null;
  }
}

export function setPlayerBrandName(name: string): void {
  playerBrandName = name;
}

export function getManufacturerName(id: string): string {
  if (id === PLAYER_MANUFACTURER_ID) return playerBrandName;
  const licensed = activeConfig?.manufacturers[id];
  if (licensed) return licensed.displayName;
  return getManufacturer(id)?.name ?? id;
}

export function getManufacturerLogo(id: string): string | undefined {
  return activeConfig?.manufacturers[id]?.logoUrl;
}
