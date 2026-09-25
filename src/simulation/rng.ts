/**
 * Deterministischer Zufallsgenerator (Mulberry32). Der Zustand liegt im GameState,
 * damit geladene Spielstände exakt gleich weiterlaufen.
 */
export interface RngHolder {
  rng: number;
}

export function createSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}

export function random(holder: RngHolder): number {
  holder.rng = (holder.rng + 0x6d2b79f5) | 0;
  let t = holder.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomRange(holder: RngHolder, min: number, max: number): number {
  return min + (max - min) * random(holder);
}

export function randomInt(holder: RngHolder, min: number, maxInclusive: number): number {
  return Math.floor(randomRange(holder, min, maxInclusive + 1));
}

export function chance(holder: RngHolder, probability: number): boolean {
  return random(holder) < probability;
}

/** Normalverteilte Zufallszahl (Box-Muller). */
export function gaussian(holder: RngHolder, mean = 0, stdDev = 1): number {
  const u = Math.max(random(holder), 1e-9);
  const v = random(holder);
  return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function pick<T>(holder: RngHolder, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() auf leerer Liste');
  return items[Math.floor(random(holder) * items.length)];
}

export function weightedPick<T>(holder: RngHolder, items: readonly T[], weight: (item: T) => number): T | undefined {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  if (total <= 0) return undefined;
  let roll = random(holder) * total;
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/** Rundet stochastisch: 2,3 → 2 (70 %) oder 3 (30 %). Hält Erwartungswerte bei kleinen Mengen korrekt. */
export function stochasticRound(holder: RngHolder, value: number): number {
  const base = Math.floor(value);
  return base + (random(holder) < value - base ? 1 : 0);
}

/** Wählt `count` verschiedene Elemente zufällig aus. */
export function pickDistinct<T>(holder: RngHolder, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  while (result.length < count && pool.length > 0) {
    const index = Math.floor(random(holder) * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}
