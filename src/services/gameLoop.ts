import { useGameStore } from '@/store/gameStore';

/** Echtzeit pro Spieltag bei Geschwindigkeit 1× (eine Woche ≈ 5,6 Sekunden). */
export const MS_PER_DAY = 800;
const TICK_MS = 100;
const MAX_DAYS_PER_TICK = 6;

let timer: ReturnType<typeof setInterval> | null = null;
let lastTime = 0;
let accumulator = 0;

function tick(): void {
  const now = performance.now();
  const elapsed = Math.min(1_000, now - lastTime);
  lastTime = now;
  const { speed, game, advance } = useGameStore.getState();
  if (!game || speed === 0 || game.status === 'bankrupt') {
    accumulator = 0;
    return;
  }
  accumulator += (elapsed * speed) / MS_PER_DAY;
  const days = Math.min(MAX_DAYS_PER_TICK, Math.floor(accumulator));
  if (days <= 0) return;
  accumulator -= days;
  if (accumulator > MAX_DAYS_PER_TICK) accumulator = 0;
  advance(days);
}

/** Startet die Spielschleife (idempotent). Die Simulation läuft unabhängig vom React-Rendering. */
export function startGameLoop(): void {
  if (timer) return;
  lastTime = performance.now();
  accumulator = 0;
  timer = setInterval(tick, TICK_MS);
}

export function stopGameLoop(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
