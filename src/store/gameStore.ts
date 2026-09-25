import { create } from 'zustand';
import { runCommand, type Command, type CommandResult } from '@/simulation/commands';
import { simulateDays } from '@/simulation/GameSimulation';
import { createNewGame } from '@/simulation/initialState';
import { SaveService, AUTOSAVE_SLOT } from '@/services/saveService';
import { createDefaultStorageProvider } from '@/services/storage/providers';
import { setPlayerBrandName } from '@/services/brandLicense';
import type { GameSpeed, GameState, NewGameSetup } from '@/types';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface GameStore {
  game: GameState | null;
  speed: GameSpeed;
  resumeSpeed: GameSpeed;
  toasts: Toast[];
  saveService: SaveService;
  lastAutosaveDay: number;
  saving: boolean;
  startNewGame: (setup: NewGameSetup) => void;
  loadState: (state: GameState) => void;
  quitToMenu: () => void;
  setSpeed: (speed: GameSpeed) => void;
  togglePause: () => void;
  execute: (command: Command, options?: { silent?: boolean }) => CommandResult;
  advance: (days: number) => void;
  pushToast: (kind: Toast['kind'], message: string) => void;
  dismissToast: (id: number) => void;
  saveGame: (slotId: string, label?: string) => Promise<boolean>;
}

let toastCounter = 0;

function applyAccent(state: GameState | null): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--accent', state?.company.color ?? '#6366f1');
  if (state) setPlayerBrandName(state.company.name);
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  speed: 0,
  resumeSpeed: 1,
  toasts: [],
  saveService: new SaveService(createDefaultStorageProvider()),
  lastAutosaveDay: 0,
  saving: false,

  startNewGame: (setup) => {
    const game = createNewGame(setup);
    applyAccent(game);
    set({ game, speed: 0, resumeSpeed: 1, lastAutosaveDay: 0 });
  },

  loadState: (state) => {
    applyAccent(state);
    set({ game: state, speed: 0, resumeSpeed: 1, lastAutosaveDay: state.time.day });
  },

  quitToMenu: () => {
    applyAccent(null);
    set({ game: null, speed: 0 });
  },

  setSpeed: (speed) => {
    const game = get().game;
    if (!game || game.status === 'bankrupt') return;
    set({ speed, resumeSpeed: speed === 0 ? get().resumeSpeed : speed });
  },

  togglePause: () => {
    const { speed, resumeSpeed } = get();
    get().setSpeed(speed === 0 ? resumeSpeed || 1 : 0);
  },

  execute: (command, options) => {
    const game = get().game;
    if (!game) return { ok: false, error: 'Kein Spiel aktiv.' };
    const { state, result } = runCommand(game, command);
    if (result.ok) {
      set({ game: state });
      if (result.message && !options?.silent) get().pushToast('success', result.message);
    } else if (!options?.silent) {
      get().pushToast('error', result.error);
    }
    return result;
  },

  advance: (days) => {
    const game = get().game;
    if (!game || days <= 0) return;
    const decisionsBefore = game.events.decisions.length;
    const insolvencyBefore = game.insolvency.stage;
    const next = simulateDays(game, days);
    const patch: Partial<GameStore> = { game: next };
    if (next.status === 'bankrupt') patch.speed = 0;
    if (next.settings.pauseOnDecision && next.events.decisions.length > decisionsBefore) {
      patch.speed = 0;
      get().pushToast('warning', 'Eine wichtige Entscheidung wartet – das Spiel wurde pausiert.');
    }
    if (next.settings.pauseOnCritical && next.insolvency.stage !== insolvencyBefore && next.insolvency.stage !== 'ok') {
      patch.speed = 0;
      get().pushToast('warning', next.insolvency.stage === 'warning' ? 'Das Konto ist im Minus!' : 'Restrukturierung eingeleitet – handle jetzt!');
    }
    set(patch);
    const interval = next.settings.autosaveIntervalDays;
    if (interval > 0 && next.time.day - get().lastAutosaveDay >= interval && next.status !== 'bankrupt') {
      set({ lastAutosaveDay: next.time.day });
      void get().saveService.save(AUTOSAVE_SLOT, next).catch(() => get().pushToast('error', 'Automatisches Speichern fehlgeschlagen.'));
    }
  },

  pushToast: (kind, message) => {
    const id = ++toastCounter;
    set({ toasts: [...get().toasts.slice(-4), { id, kind, message }] });
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 6_000 : 4_000);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  saveGame: async (slotId, label) => {
    const game = get().game;
    if (!game) return false;
    set({ saving: true });
    try {
      await get().saveService.save(slotId, game, label);
      get().pushToast('success', 'Spielstand gespeichert.');
      return true;
    } catch (error) {
      get().pushToast('error', error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
      return false;
    } finally {
      set({ saving: false });
    }
  },
}));

/** Selektor-Hook für den aktiven Spielstand (nur innerhalb des Spiels verwenden). */
export function useGame<T>(selector: (game: GameState) => T): T {
  return useGameStore((store) => selector(store.game as GameState));
}
