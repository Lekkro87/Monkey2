export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Sättigungskurve: 0 → 0, x = ref → 50, x → ∞ → 100. */
export function saturate(x: number, ref: number): number {
  if (x <= 0) return 0;
  return (100 * x) / (x + ref);
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function sumBy<T>(items: readonly T[], fn: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += fn(item);
  return total;
}

export function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

export function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Annuität: monatliche Rate für Kredit mit Jahreszins und Laufzeit in Monaten. */
export function annuityPayment(principal: number, annualRate: number, months: number): number {
  if (months <= 0) return principal;
  const r = annualRate / 12;
  if (r <= 0) return principal / months;
  return (principal * r) / (1 - (1 + r) ** -months);
}

export function pushCapped<T>(list: T[], item: T, cap: number): void {
  list.push(item);
  if (list.length > cap) list.splice(0, list.length - cap);
}

export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || Math.abs(previous) < 1e-9) return null;
  return (current - previous) / Math.abs(previous);
}
