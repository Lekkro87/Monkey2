import { formatDate } from '@/simulation/calendar';
import { SCHEMA_VERSION } from '@/simulation/initialState';
import type { GameState } from '@/types';
import type { SaveMeta, StorageProvider } from './storage/types';

export const AUTOSAVE_SLOT = 'autosave';
export const MANUAL_SLOTS = ['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'];

export function slotLabel(slotId: string): string {
  if (slotId === AUTOSAVE_SLOT) return 'Automatische Sicherung';
  const index = MANUAL_SLOTS.indexOf(slotId);
  return index >= 0 ? `Spielstand ${index + 1}` : slotId;
}

export class SaveError extends Error {}

type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/** Migrationen je Zielversion (Version n-1 → n). */
const MIGRATIONS: Record<number, Migration> = {};

export function buildMeta(slotId: string, state: GameState, label?: string): SaveMeta {
  return {
    slotId,
    label: label?.trim() || `${state.company.name} – ${formatDate(state.time.day)}`,
    gameId: state.gameId,
    companyName: state.company.name,
    logo: state.company.logo,
    color: state.company.color,
    day: state.time.day,
    cash: state.finance.cash,
    valuation: state.finance.valuation,
    stage: state.company.stage,
    difficulty: state.difficulty,
    status: state.status,
    savedAt: new Date().toISOString(),
    schemaVersion: state.schemaVersion,
  };
}

/** Prüft die Grundstruktur und hebt ältere Spielstände auf die aktuelle Version. */
export function migrateState(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') throw new SaveError('Der Spielstand ist beschädigt.');
  let data = raw as Record<string, unknown>;
  const version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  if (version > SCHEMA_VERSION) throw new SaveError('Dieser Spielstand stammt aus einer neueren Spielversion.');
  for (let v = version + 1; v <= SCHEMA_VERSION; v++) {
    const migration = MIGRATIONS[v];
    if (migration) data = migration(data);
    data.schemaVersion = v;
  }
  const state = data as unknown as GameState;
  const valid =
    typeof state.time?.day === 'number' &&
    typeof state.finance?.cash === 'number' &&
    typeof state.company?.name === 'string' &&
    Array.isArray(state.products) &&
    typeof state.components?.skus === 'object';
  if (!valid) throw new SaveError('Der Spielstand ist unvollständig oder beschädigt.');
  return state;
}

export class SaveService {
  constructor(private provider: StorageProvider) {}

  get backendName(): string {
    return this.provider.name;
  }

  async list(): Promise<SaveMeta[]> {
    const metas = await this.provider.list();
    return metas.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async save(slotId: string, state: GameState, label?: string): Promise<SaveMeta> {
    const meta = buildMeta(slotId, state, label);
    await this.provider.save({ meta, state });
    return meta;
  }

  async load(slotId: string): Promise<GameState> {
    const record = await this.provider.load(slotId);
    if (!record) throw new SaveError('Spielstand nicht gefunden.');
    return migrateState(record.state);
  }

  async remove(slotId: string): Promise<void> {
    await this.provider.remove(slotId);
  }

  exportJson(state: GameState): string {
    return JSON.stringify({ format: 'tech-empire-save', exportedAt: new Date().toISOString(), state });
  }

  importJson(text: string): GameState {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SaveError('Die Datei ist kein gültiges JSON.');
    }
    const container = parsed as { format?: string; state?: unknown };
    const state = container && container.format === 'tech-empire-save' ? container.state : parsed;
    return migrateState(state);
  }
}
