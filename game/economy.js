import { inflationIndexForYear, hourlyBurn } from './clock.js';
import { SOFT, rollCheck, logRisk } from './risk.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function repToPrestige(rep) {
  return clamp(Math.floor((rep ?? 0) / 20), 0, 5);
}

export function prestigeToRep(p) {
  return clamp(p * 20 + 10, 0, 100);
}

export function creditScore(G) {
  const burn = hourlyBurn(G) * 24 * 30;
  const runway = burn > 0 ? (G.cash ?? 0) / burn : 10;
  const prestige = repToPrestige(G.rep ?? 50);
  const debt = (G.loans ?? []).reduce((s, l) => s + (l.principal ?? l.amount ?? 500000), 0);
  const stress = G.body?.stress ?? 0;
  let score = 320 + prestige * 75 + Math.min(220, runway * 4) - debt / 40000 - stress * 0.4;
  return clamp(Math.round(score), 300, 850);
}

/**
 * Apply for a bank loan — approve full / partial / worse terms / deny (soft cap).
 */
export function applyLoan(G, rng = Math.random) {
  const score = creditScore(G);
  let chance = 0.25 + ((score - 300) / 550) * 0.55;
  if (G.staffRoles?.sales) chance += 0.06;
  chance = Math.min(chance, SOFT.loanCap);

  const check = rollCheck(chance, rng);
  logRisk(G, { type: 'loan', tier: check.tier, chance: check.chance, score });

  if (check.tier === 'fail') {
    return { approved: false, tier: check.tier, amount: 0, reason: 'denied' };
  }

  if (check.tier === 'partial') {
    const amount = 250000;
    const int = Math.round(amount * 0.18);
    if (!G.loans) G.loans = [];
    G.loans.push({ principal: amount, int, rem: 4, amount });
    G.cash = (G.cash ?? 0) + amount;
    return { approved: true, tier: check.tier, amount, int, terms: 'partial' };
  }

  const worse = score < 520;
  const amount = check.tier === 'critical' ? 500000 : worse ? 400000 : 500000;
  const rate = check.tier === 'critical' ? 0.12 : worse ? 0.17 : 0.15;
  const int = Math.round(amount * rate);
  if (!G.loans) G.loans = [];
  G.loans.push({ principal: amount, int, rem: 4, amount });
  G.cash = (G.cash ?? 0) + amount;
  return { approved: true, tier: check.tier, amount, int, terms: worse ? 'worse' : 'standard' };
}

/** Arm year profit + soft audit risk, then skim tax. */
export function prepareAndPayYearlyTax(G, rng = Math.random) {
  G.lastYearProfit = Math.max(0, G.yearProfitAccum ?? G.lastYearProfit ?? 0);
  // Soft audit arming — high undeclared-feeling profits raise odds, never certainty
  let auditChance = 0;
  if (G.lastYearProfit > 1_000_000) auditChance += 0.22;
  if (G.lastYearProfit > 5_000_000) auditChance += 0.2;
  if ((G.cash ?? 0) > G.lastYearProfit * 3 && G.lastYearProfit > 500_000) auditChance += 0.15;
  if (G.upgrades?.find((u) => u.id === 'pr' && u.owned)) auditChance *= 0.7;
  G.auditRisk = rng() < Math.min(0.72, auditChance);
  const result = yearlyTax(G, rng);
  G.yearProfitAccum = 0;
  return result;
}

/** Year-end tax skim; audit flag may add penalty. */
export function yearlyTax(G, rng = Math.random) {
  const profit = G.lastYearProfit ?? Math.max(0, G.lastRev ?? 0);
  const rate = 0.22;
  const tax = Math.max(0, Math.round(profit * rate));
  let audit = 0;

  if (G.auditRisk && rng() < 0.65) {
    audit = Math.round(tax * 0.15 + (G.cash ?? 0) * 0.02);
    logRisk(G, { type: 'audit', tax, audit });
  }

  const total = tax + audit;
  G.cash = (G.cash ?? 0) - total;
  G.lastYearProfit = 0;
  G.auditRisk = false;
  return { tax, audit, total };
}

const PORTFOLIO_META = {
  savings: { vol: 0.02, drift: 0.03 },
  index: { vol: 0.12, drift: 0.07 },
  realty: { vol: 0.08, drift: 0.05 },
  venture: { vol: 0.45, drift: -0.02 },
  art: { vol: 0.35, drift: 0.04 },
};

export function invest(G, type, amount) {
  if (!PORTFOLIO_META[type]) return { ok: false, reason: 'invalid_type' };
  if ((G.cash ?? 0) < amount) return { ok: false, reason: 'insufficient_cash' };
  if (!G.portfolio) G.portfolio = [];
  G.cash -= amount;
  G.portfolio.push({ type, amount, year: G.year ?? 1970 });
  return { ok: true, type, amount };
}

export function resolveInvestmentsYear(G, rng = Math.random) {
  if (!G.portfolio) return [];
  const results = [];

  G.portfolio.forEach((p, idx) => {
    const meta = PORTFOLIO_META[p.type];
    let ret = meta.drift + (rng() - 0.5) * meta.vol * 2;

    if (p.type === 'venture' && rng() < 0.18) {
      ret = -0.75 + rng() * 0.15;
    }
    if (p.type === 'savings') {
      ret = Math.max(ret, SOFT.investSafeFloor);
    }

    const newVal = Math.max(0, Math.round(p.amount * (1 + ret)));
    p.amount = newVal;
    results.push({ idx, type: p.type, return: ret, value: newVal });
    logRisk(G, { type: 'invest', portfolioType: p.type, return: ret, value: newVal });
  });

  return results;
}

export function liquidate(G, idx, rng = Math.random) {
  const p = G.portfolio?.[idx];
  if (!p) return null;
  const penalty = 0.02 + rng() * 0.03;
  const proceeds = Math.round(p.amount * (1 - penalty));
  G.cash = (G.cash ?? 0) + proceeds;
  G.portfolio.splice(idx, 1);
  return { proceeds, penalty, type: p.type };
}

export function scaleByInflation(amount, G) {
  let idx = inflationIndexForYear(G.year ?? 1970, G.region);
  if (G.inflationShock) idx *= G.inflationShock;
  return amount * idx;
}

/**
 * Soft-cap ancillary quarterly payouts so catalogs can't idle-win.
 * Caps near ~1.8× quarterly burn; excess decays hard.
 */
export function softCapAncillary(rawAmount, G) {
  const raw = Math.max(0, Math.round(rawAmount || 0));
  if (raw <= 0) return 0;
  const burnQ = hourlyBurn(G) * 24 * 90;
  const softMax = Math.max(200000, burnQ * 1.8);
  if (raw <= softMax) return raw;
  return Math.round(softMax + (raw - softMax) * 0.25);
}

/** Streaming catalog with diminishing per-title yield, then soft cap. */
export function streamingResidual(G) {
  const n = G.released?.length || 0;
  if (n < 1) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += 150000 * Math.max(0.35, 1 - i * 0.04);
  }
  return softCapAncillary(total, G);
}

/** Home-video catalog residual, then soft cap. */
export function homeVideoResidual(G) {
  if (!G.released?.length) return 0;
  let hv = 0;
  G.released.forEach((f) => {
    const age = (G.totalQ || 0) - (f.releasedQ || 0);
    const decay = Math.max(0.2, 1 - age * 0.09);
    let r = f.budget * 0.045 * ((f.quality || 60) / 100 + 0.3);
    if (f.classic) r *= 1.6;
    if (f.cult) r *= 1.5;
    hv += r * decay;
  });
  return softCapAncillary(hv, G);
}
