import { describe, expect, it } from 'vitest';
import { simulateDays } from '@/simulation/GameSimulation';
import { advance, newTestGame } from './helpers';

describe('Simulation (Grundlagen)', () => {
  it('läuft zwei Jahre ohne Spieleraktionen stabil', () => {
    const start = performance.now();
    const state = advance(newTestGame('normal', 42), 730, 15);
    const elapsed = performance.now() - start;
    expect(state.time.day).toBe(730);
    expect(Number.isFinite(state.finance.cash)).toBe(true);
    expect(state.finance.months.length).toBe(24);
    // Konkurrenz ist aktiv und veröffentlicht neue Produkte.
    expect(state.competitors.some((c) => c.products.some((p) => p.releaseDay > 0))).toBe(true);
    // Komponenten erhalten neue Generationen.
    expect(Object.values(state.components.skus).some((s) => s.generation > 1)).toBe(true);
    expect(elapsed / 730).toBeLessThan(15);
  });

  it('ist deterministisch – auch nach Speichern und Laden (JSON-Roundtrip)', () => {
    const base = newTestGame('normal', 1234);
    const direct = simulateDays(simulateDays(base, 120), 120);
    const saved = JSON.parse(JSON.stringify(simulateDays(base, 120)));
    const loaded = simulateDays(saved, 120);
    expect(loaded.finance.cash).toBeCloseTo(direct.finance.cash, 6);
    expect(loaded.rng).toBe(direct.rng);
    expect(loaded.news.map((n) => n.title)).toEqual(direct.news.map((n) => n.title));
    expect(JSON.stringify(loaded.competitors)).toBe(JSON.stringify(direct.competitors));
  });

  it('mutiert geteilte (eingefrorene) Zustandsteile nie in-place', () => {
    const deepFreeze = <T,>(value: T): T => {
      if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
      }
      return value;
    };
    let state = newTestGame('normal', 3);
    for (let i = 0; i < 50; i++) state = simulateDays(deepFreeze(state), 12);
    expect(state.time.day).toBe(600);
  });

  it('verändert den Eingabezustand nicht', () => {
    const base = newTestGame('normal', 99);
    const snapshot = JSON.stringify(base);
    simulateDays(base, 45);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
