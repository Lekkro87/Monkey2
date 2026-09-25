import { ensure } from '@/simulation/commands';
import type { GameSettings, GameState } from '@/types';

export const AUTOSAVE_OPTIONS = [0, 7, 30, 90] as const;

/** Ändert Spieleinstellungen, die mit dem Spielstand gespeichert werden. */
export function updateSettings(state: GameState, patch: Partial<GameSettings>): string {
  if (patch.autosaveIntervalDays !== undefined) {
    ensure((AUTOSAVE_OPTIONS as readonly number[]).includes(patch.autosaveIntervalDays), 'Ungültiges Speicherintervall.');
    state.settings.autosaveIntervalDays = patch.autosaveIntervalDays;
  }
  if (patch.pauseOnDecision !== undefined) state.settings.pauseOnDecision = patch.pauseOnDecision;
  if (patch.pauseOnCritical !== undefined) state.settings.pauseOnCritical = patch.pauseOnCritical;
  return 'Einstellungen gespeichert.';
}
