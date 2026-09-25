import { useRef, useSyncExternalStore } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types';

/**
 * Selektor mit eigener Gleichheitsfunktion: liefert die vorherige Referenz, solange
 * `isEqual` wahr ist. Verhindert unnötige Re-Renders bei abgeleiteten Daten.
 */
export function useGameSelector<T>(selector: (game: GameState) => T, isEqual: (a: T, b: T) => boolean): T {
  const cache = useRef<{ value: T } | null>(null);
  const getSnapshot = () => {
    const next = selector(useGameStore.getState().game as GameState);
    if (cache.current && isEqual(cache.current.value, next)) return cache.current.value;
    cache.current = { value: next };
    return next;
  };
  return useSyncExternalStore(useGameStore.subscribe, getSnapshot, getSnapshot);
}

export function shallowArrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

export function shallowObjectEqual<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const keysA = Object.keys(a) as (keyof T)[];
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) if (!Object.is(a[key], b[key])) return false;
  return true;
}

/** Vergleicht Arrays aus flachen Objekten elementweise und feldweise. */
export function rowsEqual<T extends object>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!shallowObjectEqual(a[i], b[i])) return false;
  return true;
}
