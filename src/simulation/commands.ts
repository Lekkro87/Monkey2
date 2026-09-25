import { produce } from 'immer';
import type { GameState } from '@/types';

/**
 * Fachlicher Fehler einer Spieleraktion (z. B. „Nicht genügend Kapital.“).
 * Wird innerhalb eines Commands geworfen; Immer verwirft dann alle Änderungen.
 */
export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandError';
  }
}

export type CommandResult = { ok: true; message?: string } | { ok: false; error: string };

/** Ein Command verändert den Draft und liefert optional eine Erfolgsmeldung. */
export type Command = (draft: GameState) => string | void;

export function runCommand(state: GameState, command: Command): { state: GameState; result: CommandResult } {
  let message: string | void = undefined;
  try {
    const next = produce(state, (draft) => {
      message = command(draft as GameState);
    });
    return { state: next, result: { ok: true, message: message ?? undefined } };
  } catch (error) {
    if (error instanceof CommandError) {
      return { state, result: { ok: false, error: error.message } };
    }
    throw error;
  }
}

export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CommandError(message);
}

export function nextId(state: GameState, prefix: string): string {
  state.idCounter += 1;
  return `${prefix}-${state.idCounter.toString(36)}`;
}
