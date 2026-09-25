import { CATEGORIES, CATEGORY_IDS } from '@/data/categories';
import { DEPARTMENT_IDS } from '@/data/departments';
import { DIFFICULTIES } from '@/data/difficulties';
import { getHeadquarters } from '@/data/locations';
import { REGION_IDS } from '@/data/regions';
import { SEGMENT_IDS } from '@/data/segments';
import type {
  BrandState,
  CategoryMarketState,
  DepartmentStats,
  GameState,
  NewGameSetup,
  ProductCategoryId,
  RegionId,
  RegionState,
  SegmentId,
} from '@/types';
import { buildInitialCatalog } from '@/systems/components/catalog';
import { createCompetitors } from '@/systems/competitors/ai';
import { createEconomy, recordEconomySnapshot } from '@/systems/economy/economy';
import { emptyLedger } from '@/systems/finance/ledger';
import { FOUNDER_SHAREHOLDER_ID, INITIAL_SHARES } from '@/systems/finance/investors';
import { initialCandidates } from '@/systems/workforce/candidates';
import { recomputeWorkforceStats } from '@/systems/workforce/employees';
import { addNews } from './news';
import { createSeed } from './rng';

export const SCHEMA_VERSION = 1;

function emptyMarket(category: ProductCategoryId): CategoryMarketState {
  return {
    category,
    trend: 1,
    growth: CATEGORIES[category].annualGrowth,
    monthUnits: {},
    lastMonthUnits: {},
    share: {},
    rolling: {},
    dailyDemand: 0,
    history: [],
    averagePrice: CATEGORIES[category].referencePrice,
  };
}

function initialBrand(homeRegion: RegionId): BrandState {
  const awareness = {} as Record<RegionId, Record<SegmentId, number>>;
  for (const region of REGION_IDS) {
    awareness[region] = {} as Record<SegmentId, number>;
    for (const segment of SEGMENT_IDS) awareness[region][segment] = region === homeRegion ? (segment === 'business' ? 0.005 : 0.008) : 0;
  }
  return { awareness, trust: 42, premium: 30, innovation: 35, gaming: 25, business: 22, reputation: 50, satisfaction: 60 };
}

function emptyDepartmentStats(): Record<string, DepartmentStats> {
  return Object.fromEntries(DEPARTMENT_IDS.map((d) => [d, { headcount: 0, capacity: 0, avgSkill: 0, avgMotivation: 0, payroll: 0 }]));
}

export function createNewGame(setup: NewGameSetup): GameState {
  const seed = (setup.seed ?? createSeed()) >>> 0;
  const hq = getHeadquarters(setup.headquartersId);
  const difficulty = DIFFICULTIES[setup.difficulty];
  const rngHolder = { rng: seed };
  const regions = Object.fromEntries(
    REGION_IDS.map((r) => [r, { id: r, status: r === hq.region ? 'open' : 'closed' } satisfies RegionState]),
  ) as Record<RegionId, RegionState>;

  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    gameId: `game-${seed.toString(36)}-${Date.now().toString(36)}`,
    seed,
    rng: seed,
    idCounter: 0,
    createdAt: new Date().toISOString(),
    difficulty: setup.difficulty,
    settings: { autosaveIntervalDays: 30, pauseOnDecision: true, pauseOnCritical: true },
    time: { day: 0 },
    status: 'running',
    company: {
      name: setup.companyName.trim(),
      ceoName: setup.ceoName.trim(),
      logo: setup.logo,
      color: setup.color,
      headquartersId: hq.id,
      homeRegion: hq.region,
      foundedDay: 0,
      stage: 1,
      officeLevel: 0,
      officeMove: null,
      salesChannels: { online_shop: 0 },
      regions,
      support: { level: 'basic', ticketsLastMonth: 0, serviceLevel: 1 },
      distributionCenters: [],
    },
    economy: createEconomy(rngHolder, hq.id),
    components: { skus: {}, market: {}, nextReleaseDay: {} },
    supply: { orders: [], contracts: [], cmOrders: [] },
    inventory: { components: {}, products: {} },
    warehouses: [],
    products: [],
    production: { workshop: { toolLevel: 0, qcLevel: 'basic' }, factories: [], lines: [] },
    workforce: {
      employees: [],
      candidates: [],
      stats: emptyDepartmentStats() as GameState['workforce']['stats'],
      facilityStats: {},
      totalPayroll: 0,
      statsDirty: true,
      recruiting: { openings: {}, nextCandidateRefreshDay: 7 },
      lastLayoffDay: null,
      layoffsLast90: 0,
      quitsTotal: 0,
    },
    research: { completed: {}, active: null, partialProgress: {}, queue: [], labLevel: 0, labConstruction: null, pointsToday: 0, totalPoints: 0 },
    software: { projects: {}, subscribers: {} },
    marketing: { campaigns: [], spentTotal: 0 },
    brand: initialBrand(hq.region),
    markets: Object.fromEntries(CATEGORY_IDS.map((c) => [c, emptyMarket(c)])) as Record<ProductCategoryId, CategoryMarketState>,
    competitors: [],
    finance: {
      cash: difficulty.startingCash,
      ledger: emptyLedger(),
      assetBook: 0,
      depreciationMonth: 0,
      months: [],
      loans: [],
      lossCarryforward: 0,
      creditRating: 'BBB',
      shareholders: [{ id: FOUNDER_SHAREHOLDER_ID, name: setup.ceoName.trim(), kind: 'founder', shares: INITIAL_SHARES, invested: difficulty.startingCash, day: 0 }],
      fundingOffers: [],
      nextFundingCheckDay: 60,
      stock: {
        isPublic: false,
        ipoDay: null,
        totalShares: INITIAL_SHARES,
        sharePrice: 0,
        priceHistory: [],
        sentiment: 1,
        dividendPerShareQuarter: 0,
        lastQuarterEps: 0,
        lastDividendDay: null,
      },
      lifetime: { revenue: 0, netIncome: 0, unitsSold: 0, peakValuation: difficulty.startingCash, peakCash: difficulty.startingCash },
      valuation: difficulty.startingCash,
      lastBalance: null,
    },
    events: { modifiers: [], decisions: [], log: [], cooldowns: {}, nextEventCheckDay: 7 },
    news: [],
    achievements: {},
    history: [],
    stats: {
      unitsProducedTotal: 0,
      unitsSoldTotal: 0,
      productsLaunched: 0,
      peakEmployees: 1,
      peakMarketShare: 0,
      week: { revenue: 0, profit: 0, unitsSold: 0, unitsProduced: 0 },
      month: { revenue: 0, profit: 0, unitsSold: 0, unitsProduced: 0 },
      producedToday: 0,
      utilization: 0,
      demandIndex: 1,
    },
    insolvency: { stage: 'ok', negativeSinceDay: null, restructuringUntil: null, bailoutUsed: false },
    tutorialDismissed: false,
  };
  state.rng = rngHolder.rng;

  buildInitialCatalog(state);
  state.competitors = createCompetitors(state);
  state.workforce.employees.push({
    id: 'founder',
    firstName: setup.ceoName.trim().split(' ')[0] ?? setup.ceoName,
    lastName: setup.ceoName.trim().split(' ').slice(1).join(' ') || '(Gründung)',
    age: 29,
    department: 'management',
    level: 'lead',
    skill: 60,
    experience: 6,
    salary: 0,
    motivation: 90,
    hiredDay: 0,
    traits: ['ambitious'],
    isFounder: true,
  });
  state.workforce.candidates = initialCandidates(state);
  recomputeWorkforceStats(state);
  recordEconomySnapshot(state);
  addNews(
    state,
    'company',
    'positive',
    `${state.company.name} wird in ${hq.city} gegründet`,
    `${state.company.ceoName} startet mit ${difficulty.startingCash.toLocaleString('de-DE')} € Startkapital in einer Garage. Das Ziel: ein globaler Technologiekonzern.`,
  );
  return state;
}
