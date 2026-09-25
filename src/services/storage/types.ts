import type { DifficultyId, GameState, LogoId } from '@/types';

export interface SaveMeta {
  slotId: string;
  label: string;
  gameId: string;
  companyName: string;
  logo: LogoId;
  color: string;
  day: number;
  cash: number;
  valuation: number;
  stage: number;
  difficulty: DifficultyId;
  status: GameState['status'];
  savedAt: string;
  schemaVersion: number;
}

export interface SaveRecord {
  meta: SaveMeta;
  state: GameState;
}

/**
 * Speicher-Backend. Weitere Implementierungen (z. B. Cloud-Speicher) müssen nur diese
 * Schnittstelle erfüllen – der SaveService bleibt unverändert.
 */
export interface StorageProvider {
  readonly name: string;
  list(): Promise<SaveMeta[]>;
  load(slotId: string): Promise<SaveRecord | null>;
  save(record: SaveRecord): Promise<void>;
  remove(slotId: string): Promise<void>;
}
