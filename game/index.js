import { SOFT, rollCheck, oddsLabel, bodyMod, logRisk } from './risk.js';
import {
  START_YEAR,
  tickHour,
  seasonFromMonth,
  formatClock,
  weekday,
  inflationIndexForYear,
  currentInflationIndex,
  hourlyBurn,
  applyHourlyCosts,
} from './clock.js';
import {
  DEFAULT_BODY,
  ensureBody,
  decayHour,
  sleep,
  shower,
  doctor,
  forcedCrash,
  devDrain,
  advanceBodyHours,
} from './body.js';
import {
  repToPrestige,
  prestigeToRep,
  creditScore,
  applyLoan,
  yearlyTax,
  prepareAndPayYearlyTax,
  invest,
  resolveInvestmentsYear,
  liquidate,
  scaleByInflation,
  softCapAncillary,
  streamingResidual,
  homeVideoResidual,
} from './economy.js';
import {
  END_REASONS,
  LIFE_EVENTS,
  maybeLifeEvent,
  resolveLifeEvent,
  birthdayCheck,
  healthRoll,
  nameSuccessor,
  investInHeir,
  resolveSuccession,
} from './life.js';
import {
  META_KEY,
  FILM_SIZES,
  PREMIUM_FEATURES,
  STAFF_ROLES,
  AWARD_CATS,
  budgetMToSize,
  maxUnlockedBudgetM,
  clampSizeToUnlocked,
  estimateQuartersForBudgetM,
  computePhaseHours,
  readMetaSave,
  writeMetaTip,
  initMarketHidden,
  initRivals,
  unlockStaffRole,
  analystReveal,
  attachTalent,
  createFilm,
  advanceFilmHours,
  resolveCrisis,
  applyPremiumFeature,
  estimateBoxOffice,
  syncSlate,
  removeFilm,
  rivalClashLikely,
} from './pipeline.js';

export {
  SOFT,
  rollCheck,
  oddsLabel,
  bodyMod,
  logRisk,
  START_YEAR,
  tickHour,
  seasonFromMonth,
  formatClock,
  weekday,
  inflationIndexForYear,
  currentInflationIndex,
  hourlyBurn,
  applyHourlyCosts,
  DEFAULT_BODY,
  ensureBody,
  decayHour,
  sleep,
  shower,
  doctor,
  forcedCrash,
  devDrain,
  advanceBodyHours,
  repToPrestige,
  prestigeToRep,
  creditScore,
  applyLoan,
  yearlyTax,
  prepareAndPayYearlyTax,
  invest,
  resolveInvestmentsYear,
  liquidate,
  scaleByInflation,
  softCapAncillary,
  streamingResidual,
  homeVideoResidual,
  END_REASONS,
  LIFE_EVENTS,
  maybeLifeEvent,
  resolveLifeEvent,
  birthdayCheck,
  healthRoll,
  nameSuccessor,
  investInHeir,
  resolveSuccession,
  META_KEY,
  FILM_SIZES,
  PREMIUM_FEATURES,
  STAFF_ROLES,
  AWARD_CATS,
  budgetMToSize,
  maxUnlockedBudgetM,
  clampSizeToUnlocked,
  estimateQuartersForBudgetM,
  computePhaseHours,
  readMetaSave,
  writeMetaTip,
  initMarketHidden,
  initRivals,
  unlockStaffRole,
  analystReveal,
  attachTalent,
  createFilm,
  advanceFilmHours,
  resolveCrisis,
  applyPremiumFeature,
  estimateBoxOffice,
  syncSlate,
  removeFilm,
  rivalClashLikely,
};

export function defaultNewGameFields() {
  return {
    saveVersion: 4,
    year: START_YEAR,
    month: 1,
    day: 1,
    hour: 8,
    q: 1,
    yr: 1,
    totalQ: 0,
    body: { ...DEFAULT_BODY },
    lifestyle: 'comfortable',
    riskLog: [],
    portfolio: [],
    pipeline: [],
    films: [],
    unlockedSizes: { small: true, medium: true, large: false, blockbuster: false },
    features: [],
    staffRoles: { sales: false, analyst: false, marketer: false, executive: false },
    marketHidden: {},
    rivals: [],
    heirInvestment: 0,
    successor: null,
    age: 32,
    birthMonth: 1,
    birthDay: 1,
    inflationShock: null,
    poorSleepStreak: 0,
    lastYearProfit: 0,
    yearProfitAccum: 0,
    auditRisk: false,
    endReason: null,
    pendingLifeEvent: null,
    lifeEventLog: [],
    crashCount: 0,
    forcedSleep: false,
    loans: [],
    roster: [],
    cash: 0,
    rep: 50,
    rp: 0,
  };
}

/** Merge v4 realism defaults into legacy saves. */
export function migrateSave(G) {
  const defaults = defaultNewGameFields();
  for (const [key, val] of Object.entries(defaults)) {
    if (G[key] === undefined || G[key] === null) {
      G[key] = typeof val === 'object' && !Array.isArray(val) ? structuredClone(val) : val;
    }
  }

  if (!G.year) G.year = START_YEAR + (G.yr ?? 1) - 1;
  if (!G.month) G.month = ((G.q ?? 1) - 1) * 3 + 1;
  if (!G.day) G.day = 1;
  if (G.hour === undefined) G.hour = 8;

  if (!G.body) G.body = { ...DEFAULT_BODY };
  if (!G.unlockedSizes) G.unlockedSizes = defaults.unlockedSizes;
  if (!G.staffRoles) G.staffRoles = { ...defaults.staffRoles };
  if (!G.pipeline && G.films?.length) G.pipeline = G.films;
  if (!G.films) G.films = G.pipeline ?? [];
  // Always re-alias so cancel/release can't leave ghosts
  G.films = G.pipeline = G.pipeline || G.films || [];
  if (!G.marketHidden || Object.keys(G.marketHidden).length === 0) initMarketHidden(G);
  if (!G.rivals?.length) initRivals(G);

  G.saveVersion = 4;
  return G;
}
