import { FX_START } from '@/systems/components/catalog';
import { DIFFICULTIES } from '@/data/difficulties';
import { getHeadquarters } from '@/data/locations';
import { monthIndex } from '@/simulation/calendar';
import { additive, multiplier } from '@/simulation/modifiers';
import { gaussian, randomRange, type RngHolder } from '@/simulation/rng';
import type { CurrencyCode, EconomyState, GameState } from '@/types';
import { appendCapped, clamp } from '@/utils/math';

const BASE_ENERGY_PRICE = 0.24;

export function createEconomy(rng: RngHolder, headquartersId: string): EconomyState {
  return {
    inflationRate: 0.022,
    priceLevel: 1,
    baseInterestRate: 0.03,
    energyPrice: BASE_ENERGY_PRICE,
    wageIndex: 1,
    rawMaterialIndex: 1,
    chipIndex: 1,
    exchangeRates: { ...FX_START },
    consumerConfidence: 1,
    cyclePhase: randomRange(rng, 0, Math.PI * 2),
    taxRate: getHeadquarters(headquartersId).taxRate,
    history: [],
  };
}

export function updateEconomy(state: GameState): void {
  const eco = state.economy;
  const vol = DIFFICULTIES[state.difficulty].marketVolatility;

  eco.inflationRate = clamp(eco.inflationRate + 0.003 * (0.022 - eco.inflationRate) + gaussian(state, 0, 0.00035 * vol), -0.01, 0.12);
  eco.priceLevel *= (1 + eco.inflationRate) ** (1 / 365);

  const rateTarget = clamp(0.008 + 1.15 * eco.inflationRate, 0, 0.1) + additive(state, 'interestRate');
  eco.baseInterestRate = clamp(eco.baseInterestRate + 0.004 * (rateTarget - eco.baseInterestRate), 0, 0.14);

  eco.wageIndex *= (1 + eco.inflationRate + 0.006) ** (1 / 365);

  const energyTarget = BASE_ENERGY_PRICE * eco.priceLevel * multiplier(state, 'energyPrice');
  eco.energyPrice = Math.max(0.05, eco.energyPrice + 0.02 * (energyTarget - eco.energyPrice) + eco.energyPrice * gaussian(state, 0, 0.004 * vol));

  const rawTarget = multiplier(state, 'rawMaterials');
  eco.rawMaterialIndex = clamp(eco.rawMaterialIndex + 0.01 * (rawTarget - eco.rawMaterialIndex) + gaussian(state, 0, 0.0025 * vol), 0.6, 2.5);

  eco.cyclePhase += (Math.PI * 2) / (365 * 6);
  const chipCycle = 1 + 0.05 * Math.sin(eco.cyclePhase * 1.5);
  eco.chipIndex = clamp(eco.chipIndex + 0.01 * (chipCycle - eco.chipIndex) + gaussian(state, 0, 0.002 * vol), 0.7, 2);

  for (const currency of Object.keys(eco.exchangeRates) as CurrencyCode[]) {
    if (currency === 'EUR') continue;
    const current = eco.exchangeRates[currency];
    const drift = -0.004 * Math.log(current / FX_START[currency]);
    eco.exchangeRates[currency] = current * Math.exp(drift + gaussian(state, 0, 0.0035 * vol));
  }

  eco.consumerConfidence = 1 + 0.05 * Math.sin(eco.cyclePhase);
}

export function recordEconomySnapshot(state: GameState): void {
  const eco = state.economy;
  eco.history = appendCapped(
    eco.history,
    {
      month: monthIndex(state.time.day),
      inflationRate: eco.inflationRate,
      baseInterestRate: eco.baseInterestRate,
      energyPrice: eco.energyPrice,
      rawMaterialIndex: eco.rawMaterialIndex,
      chipIndex: eco.chipIndex,
      consumerConfidence: eco.consumerConfidence * multiplier(state, 'demand'),
      usd: eco.exchangeRates.USD,
    },
    600,
  );
}

/** Lohnniveau am Hauptsitz relativ zum Referenzstandort. */
export function wageLevel(state: GameState): number {
  return state.economy.wageIndex * getHeadquarters(state.company.headquartersId).wageFactor * multiplier(state, 'wages');
}
