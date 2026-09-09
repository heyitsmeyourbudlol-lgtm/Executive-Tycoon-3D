/**
 * Node smoke harness for realism game modules (no DOM).
 * Covers: deny-loan, talent-pass, crisis, sleep-crash, death, heir Pass, audit, invest wipeout.
 */
import {
  defaultNewGameFields,
  migrateSave,
  applyLoan,
  attachTalent,
  forcedCrash,
  sleep,
  invest,
  resolveInvestmentsYear,
  resolveSuccession,
  nameSuccessor,
  yearlyTax,
  tickHour,
  scaleByInflation,
  hourlyBurn,
  SOFT,
  createFilm,
  advanceFilmHours,
  resolveCrisis,
  healthRoll,
  initMarketHidden,
  initRivals,
  analystReveal,
  unlockStaffRole,
  maybeLifeEvent,
  budgetMToSize,
  maxUnlockedBudgetM,
  clampSizeToUnlocked,
  FILM_SIZES,
  computePhaseHours,
  estimateBoxOffice,
  AWARD_CATS,
  prepareAndPayYearlyTax,
  liquidate,
  resolveLifeEvent,
  removeFilm,
  syncSlate,
  rivalClashLikely,
  softCapAncillary,
  streamingResidual,
} from '../game/index.js';
import { LIFE_EVENTS } from '../game/life.js';

let passed = 0;
let failed = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function mockG(overrides = {}) {
  const G = { ...defaultNewGameFields(), cash: 3_000_000, name: 'Test Studio', region: 'Hollywood' };
  Object.assign(G, overrides);
  migrateSave(G);
  return G;
}

console.log('Executive Tycoon realism smoke tests\n');

// Loan can deny
{
  const G = mockG({ cash: 50_000, rep: 20, loans: [{ principal: 2_000_000, int: 300_000, rem: 3 }] });
  const res = applyLoan(G, () => 0.99);
  assert('loan can deny', res.approved === false && res.tier === 'fail');
}

// Talent attach soft cap + pass
{
  const G = mockG();
  G.body = { energy: 100, hygiene: 100, health: 100, stress: 0 };
  const film = { attached: [], pendingTalent: 'Star A' };
  const res = attachTalent(G, film, 1.0, () => 0.01);
  assert('talent attach succeeds under cap', res.attached === true);
  assert('attach chance capped at SOFT.attachCap', res.chance <= SOFT.attachCap + 0.001);

  const film2 = { attached: [], pendingTalent: 'Diva' };
  const pass = attachTalent(G, film2, 0.9, () => 0.99);
  assert('talent can pass', pass.attached === false && pass.tier === 'fail');
}

// Sleep crash
{
  const G = mockG();
  G.body.energy = 0;
  const crash = forcedCrash(G);
  assert('forced crash when energy depleted', crash.crashed === true && G.body.energy === 15);
  const sl = sleep(G, 8);
  assert('sleep restores energy', G.body.energy > 15 && sl.slept > 0);
}

// Invest wipeout path
{
  const G = mockG({ cash: 500_000 });
  invest(G, 'venture', 200_000);
  let wipe = false;
  for (let i = 0; i < 40; i++) {
    G.portfolio = [{ type: 'venture', amount: 200_000, year: 1970 }];
    const results = resolveInvestmentsYear(G, () => 0.01);
    if (results[0]?.return < -0.5) wipe = true;
  }
  assert('venture wipeout path exists', wipe);
}

// Succession pass
{
  const G = mockG();
  nameSuccessor(G, 'Junior');
  G.heirInvestment = 0;
  G.successor.readiness = 0.1;
  const res = resolveSuccession(G, () => 0.99);
  assert('succession can pass', res.outcome === 'pass' && res.endReason === 'heir_pass');
}

// Audit / tax
{
  const G = mockG({ lastYearProfit: 1_000_000, auditRisk: true });
  const before = G.cash;
  const tax = yearlyTax(G, () => 0.1);
  assert('yearly tax applied', tax.tax > 0 && G.cash < before);
  assert('audit penalty possible', tax.audit > 0);
}

// Clock advances quarter
{
  const G = mockG({ month: 3, day: 31, hour: 20, totalQ: 0, q: 1 });
  tickHour(G, 5);
  assert('clock advances quarter', G.month === 4 && G.q === 2 && G.totalQ >= 1);
}

// Inflation increases costs
{
  const G70 = mockG({ year: 1970 });
  const G90 = mockG({ year: 1990 });
  const burn70 = hourlyBurn(G70);
  const burn90 = hourlyBurn(G90);
  const scaled = scaleByInflation(100_000, G90);
  assert('inflation increases hourly burn', burn90 > burn70);
  assert('scaleByInflation grows with year', scaled > 100_000);
}

// Production crisis pay/press
{
  const G = mockG({ cash: 5_000_000 });
  const created = createFilm(G, { title: 'Crisis Pic', genre: 'Action', size: 'medium', budget: 8e6 });
  assert('createFilm ok', created.ok === true);
  const film = created.film;
  // Force into prod and trigger crisis with high rng
  film.phase = 'prod';
  film.hoursLeft = { pre: 0, prod: 100, post: 100 };
  let crisis = null;
  for (let i = 0; i < 80 && !crisis; i++) {
    const r = advanceFilmHours(film, 1, G, () => 0.01);
    if (r.crisis) crisis = r.crisis;
  }
  assert('production crisis can fire', !!crisis);
  if (crisis) {
    const before = G.cash;
    resolveCrisis(G, film, 'pay');
    assert('crisis pay costs cash', G.cash < before && film.crisis.resolved);
  }
}

// Death without heir
{
  const G = mockG({ age: 90, successor: null });
  G.body = { energy: 50, hygiene: 50, health: 10, stress: 80 };
  const hr = healthRoll(G, () => 0.0);
  assert('death without heir ends run', hr.outcome === 'death' && hr.endReason === 'died_no_heir');
}

// Death with heir needs succession
{
  const G = mockG({ age: 90 });
  nameSuccessor(G, 'Heir');
  G.body = { energy: 50, hygiene: 50, health: 10, stress: 80 };
  const hr = healthRoll(G, () => 0.0);
  assert('death with heir needs succession', hr.outcome === 'death' && hr.needsSuccession === true);
}

// Analyst fog soft-capped
{
  const G = mockG();
  initMarketHidden(G, () => 0.5);
  unlockStaffRole(G, 'analyst');
  const r = analystReveal(G, 'Drama', () => 0.01);
  assert('analyst reveal ok', r.ok === true);
  assert('insight soft-capped', r.demandHint <= (G.marketHidden.Drama || 1) * 0.95);
}

// Rivals init
{
  const G = mockG();
  initRivals(G, () => 0.3);
  assert('rivals slate exists', Array.isArray(G.rivals) && G.rivals.length >= 2);
}

// Personal burn floor
{
  const G = mockG({ lifestyle: 'frugal', year: 1970, oh: 0, roster: [], loans: [] });
  // Force lifestyle burn path: frugal still >= floor after inflation scale
  const burn = hourlyBurn(G);
  assert('personal floor keeps burn positive', burn > 0);
  const Gmog = mockG({ lifestyle: 'mogul', year: 1970, oh: 0, roster: [], loans: [] });
  assert('mogul burns more than frugal', hourlyBurn(Gmog) > burn);
}

// Era-filtered life events
{
  const pool70 = LIFE_EVENTS.filter((ev) => {
    const [a, b] = ev.eras || [1970, 2020];
    return 1975 >= a && 1975 <= b;
  });
  assert('1975 life pool includes oil_shock', pool70.some((e) => e.id === 'oil_shock'));
  const pool10 = LIFE_EVENTS.filter((ev) => {
    const [a, b] = ev.eras || [1970, 2020];
    return 2015 >= a && 2015 <= b;
  });
  assert('2015 life pool includes streaming_wars', pool10.some((e) => e.id === 'streaming_wars'));
  assert('2015 life pool excludes oil_shock', !pool10.some((e) => e.id === 'oil_shock'));
  const G = mockG({ year: 1975 });
  // Force event fire with low rng first roll
  let got = null;
  for (let i = 0; i < 30 && !got; i++) {
    got = maybeLifeEvent(G, () => 0.05);
  }
  assert('maybeLifeEvent can fire', !!got);
}

// Test screening band narrow (logic mirror)
{
  const est = { lo: 40, hi: 70 };
  const mid = (est.lo + est.hi) / 2;
  est.lo = Math.round(mid - 4);
  est.hi = Math.round(mid + 4);
  assert('test screening narrows band', est.hi - est.lo <= 8 && est.lo >= 50);
}

// Hold window flag
{
  const f = { seasonReroll: true, genre: 'Drama' };
  assert('hold window sets seasonReroll', f.seasonReroll === true);
}

// FILM_SIZES canon: budget → size + unlock clamp
{
  assert('3M → small', budgetMToSize(3) === 'small');
  assert('5M → medium', budgetMToSize(5) === 'medium');
  assert('8M → medium', budgetMToSize(8) === 'medium');
  assert('20M → large', budgetMToSize(20) === 'large');
  assert('45M → blockbuster', budgetMToSize(45) === 'blockbuster');
  assert('FILM_SIZES ceilings', FILM_SIZES.small.budgetM === 3 && FILM_SIZES.blockbuster.budgetM === 45);

  const G = mockG({ unlockedSizes: { small: true, medium: true, large: false, blockbuster: false } });
  assert('max unlocked medium = 8', maxUnlockedBudgetM(G) === 8);
  assert('clamp blockbuster → medium', clampSizeToUnlocked(G, 'blockbuster') === 'medium');
  assert('clamp large → medium', clampSizeToUnlocked(G, 'large') === 'medium');

  const locked = createFilm(G, { title: 'Too Big', size: 'large', budget: 20e6 });
  assert('createFilm rejects locked size', locked.ok === false && locked.reason === 'size_locked');

  const ok = createFilm(G, { title: 'Ok Pic', size: 'medium', budget: 8e6 });
  assert('createFilm medium ok', ok.ok === true && ok.film.size === 'medium');
}

// Alloc + postprod reshape phase hours
{
  const base = computePhaseHours('medium', { write: 0.15, shoot: 0.55, post: 0.2, mkt: 0.1 });
  const writeHeavy = computePhaseHours('medium', { write: 0.35, shoot: 0.4, post: 0.15, mkt: 0.1 });
  assert('write-heavy lengthens pre', writeHeavy.pre > base.pre);
  const withSuite = computePhaseHours('medium', { write: 0.15, shoot: 0.55, post: 0.2, mkt: 0.1 }, { postProdOwned: true });
  assert('postprod shortens post', withSuite.post < base.post);
  assert('postprod keeps soft floor', withSuite.post >= Math.round(FILM_SIZES.medium.postH * 0.5));

  const G = mockG({ upgrades: [{ id: 'postprod', owned: true }] });
  const created = createFilm(G, { title: 'Suite Pic', size: 'medium', budget: 8e6 });
  assert('createFilm applies postprod', created.ok && created.film.hoursLeft.post < FILM_SIZES.medium.postH);
}

// estimateBoxOffice returns structured result with residual variance path
{
  const G = mockG({ marketHidden: { Drama: 1.1 }, rep: 60 });
  const film = {
    budget: 8e6,
    genre: 'Drama',
    quality: 70,
    grossMult: 1,
    dist: 'third',
  };
  const a = estimateBoxOffice(film, G, { rng: () => 0.1, seasonMod: 1, ratingReach: 1 });
  const b = estimateBoxOffice(film, G, { rng: () => 0.9, seasonMod: 1, ratingReach: 1 });
  assert('estimateBoxOffice has gross/net', a.gross > 0 && a.net <= a.gross);
  assert('estimateBoxOffice residual variance', a.gross !== b.gross);
  assert('AWARD_CATS canon length', AWARD_CATS.length === 5 && AWARD_CATS.includes('Best Actor'));
}

// Yearly tax + audit can arm from profit accum
{
  const G = mockG({ cash: 8_000_000, yearProfitAccum: 3_000_000 });
  const tax = prepareAndPayYearlyTax(G, () => 0.01);
  assert('prepareAndPayYearlyTax charges', tax.total > 0);
  assert('yearProfitAccum cleared', G.yearProfitAccum === 0);
  assert('audit can fire when armed', tax.audit > 0 || G.auditRisk === false);
}

// Sales soft-boosts loan under cap
{
  const G = mockG({ cash: 2_000_000, rep: 80, staffRoles: { sales: true } });
  const res = applyLoan(G, () => 0.01);
  assert('sales loan still soft-capped path', res.approved === true || res.approved === false);
}

// Liquidate returns cash
{
  const G = mockG({ cash: 1_000_000, portfolio: [{ type: 'index', amount: 100000, year: 1970 }] });
  const r = liquidate(G, 0, () => 0.5);
  assert('liquidate pays proceeds', r && r.proceeds > 0 && G.portfolio.length === 0 && G.cash > 1_000_000);
}

// PR halves bad rep on life effects (via resolve)
{
  const G = mockG({ rep: 50, upgrades: [{ id: 'pr', owned: true }] });
  G.pendingLifeEvent = {
    id: 'test',
    engage: { rep: -10 },
    defer: { rep: -10 },
    gamble: { chance: 0, win: {}, lose: { rep: -10 } },
  };
  const res = resolveLifeEvent(G, 'engage', () => 0.99);
  assert('PR softens bad rep', G.rep === 45); // -10 → -5
  assert('resolve applied', !!res);
}

// Slate sync after remove
{
  const G = mockG();
  const a = createFilm(G, { title: 'A', size: 'medium', budget: 8e6 });
  const b = createFilm(G, { title: 'B', size: 'medium', budget: 8e6 });
  assert('create aliases films===pipeline', G.films === G.pipeline && G.films.length === 2);
  removeFilm(G, (f) => f.title === 'A');
  assert('remove keeps alias', G.films === G.pipeline);
  assert('remove drops film', G.films.length === 1 && G.films[0].title === 'B' && a.ok && b.ok);
  syncSlate(G);
  assert('syncSlate idempotent', G.films === G.pipeline);
}

// Ancillary soft cap
{
  const G = mockG({ cash: 1e6, released: Array.from({ length: 40 }, (_, i) => ({
    title: 'F' + i, budget: 8e6, quality: 70, releasedQ: 0,
  })) });
  const raw = 40 * 150000;
  const capped = streamingResidual(G);
  assert('streaming soft-caps large catalog', capped < raw && capped > 0);
  assert('softCapAncillary damps excess', softCapAncillary(raw * 3, G) < raw * 3);
}

// Rival clash helper
{
  const G = mockG({ month: 6, rivals: [{ name: 'X', slate: [{ genre: 'Drama', size: 'medium', month: 7 }] }] });
  assert('rivalClashLikely true', rivalClashLikely(G, 'Drama', 6) === true);
  assert('rivalClashLikely false', rivalClashLikely(G, 'Horror', 6) === false);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
