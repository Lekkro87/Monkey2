import { runCommand, type Command } from '@/simulation/commands';
import { simulateDays } from '@/simulation/GameSimulation';
import { createNewGame } from '@/simulation/initialState';
import type { DifficultyId, GameState } from '@/types';

export function newTestGame(difficulty: DifficultyId = 'normal', seed = 42): GameState {
  return createNewGame({ companyName: 'NovaTech', ceoName: 'Alex Berg', logo: 'cpu', color: '#6366f1', headquartersId: 'berlin', difficulty, seed });
}

/** Führt einen Command aus und wirft bei fachlichen Fehlern. */
export function exec(state: GameState, command: Command): GameState {
  const { state: next, result } = runCommand(state, command);
  if (!result.ok) throw new Error(`Command fehlgeschlagen: ${result.error}`);
  return next;
}

export function tryExec(state: GameState, command: Command): { state: GameState; error?: string } {
  const { state: next, result } = runCommand(state, command);
  return result.ok ? { state: next } : { state, error: result.error };
}

export function advance(state: GameState, days: number, step = 10): GameState {
  let current = state;
  let remaining = days;
  while (remaining > 0) {
    const chunk = Math.min(step, remaining);
    current = simulateDays(current, chunk);
    remaining -= chunk;
  }
  return current;
}

/** Simuliert, bis die Bedingung erfüllt ist (max. `limit` Tage). */
export function advanceUntil(state: GameState, predicate: (s: GameState) => boolean, limit = 400): GameState {
  let current = state;
  for (let i = 0; i < limit && !predicate(current); i++) current = simulateDays(current, 1);
  return current;
}
