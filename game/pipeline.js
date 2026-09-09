import { rollCheck, bodyMod, logRisk, SOFT } from './risk.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Meta-save key — genre tips without exact numbers (localStorage only here). */
export const META_KEY = 'executive_tycoon_meta_v1';

export const FILM_SIZES = {
  small: { budgetM: 3, preH: 120, prodH: 480, postH: 240, unlock: 'small' },
  medium: { budgetM: 8, preH: 180, prodH: 720, postH: 360, unlock: 'medium' },
  large: { budgetM: 20, preH: 240, prodH: 1200, postH: 480, unlock: 'large' },
  blockbuster: { budgetM: 45, preH: 360, prodH: 2000, postH: 720, unlock: 'blockbuster' },
};

/** Map budget in millions → size tier (ceilings from FILM_SIZES). */
export function budgetMToSize(m) {
  const n = +m || 0;
  if (n <= FILM_SIZES.small.budgetM) return 'small';
  if (n <= FILM_SIZES.medium.budgetM) return 'medium';
  if (n <= FILM_SIZES.large.budgetM) return 'large';
  return 'blockbuster';
}

/** Highest unlocked size budget ceiling in millions. */
export function maxUnlockedBudgetM(G) {
  const u = G?.unlockedSizes || { small: true, medium: true };
  if (u.blockbuster === true) return FILM_SIZES.blockbuster.budgetM;
  if (u.large === true) return FILM_SIZES.large.budgetM;
  if (u.medium === true) return FILM_SIZES.medium.budgetM;
  return FILM_SIZES.small.budgetM;
}

/** Clamp a size id down to the highest unlocked tier. */
export function clampSizeToUnlocked(G, size) {
  const order = ['small', 'medium', 'large', 'blockbuster'];
  let s = order.includes(size) ? size : budgetMToSize(FILM_SIZES.medium.budgetM);
  while (s !== 'small' && !sizeUnlocked(G, s)) {
    s = order[Math.max(0, order.indexOf(s) - 1)];
  }
  return s;
}

/** Rough calendar quarters for UI preview from size / budget. */
export function estimateQuartersForBudgetM(m, postProdOwned = false) {
  const size = budgetMToSize(m);
  const base = { small: 2, medium: 3, large: 4, blockbuster: 5 }[size] ?? 3;
  return postProdOwned ? Math.max(1, base - 1) : base;
}

export const PREMIUM_FEATURES = [
  { id: 'stunts', phase: 'prod', quality: 4, costPct: 0.06 },
  { id: 'creature', phase: 'prod', quality: 6, costPct: 0.08 },
  { id: 'vfx_suite', phase: 'post', quality: 8, costPct: 0.1 },
  { id: 'composer', phase: 'post', quality: 5, costPct: 0.04 },
  { id: 'imax', phase: 'post', quality: 3, costPct: 0.05, gross: 0.08 },
];

export const STAFF_ROLES = ['sales', 'analyst', 'marketer', 'executive'];

const GENRES = [
  'Action', 'Drama', 'Comedy', 'Horror', 'Sci-Fi', 'Animation',
  'Thriller', 'Romance', 'Adventure', 'Fantasy', 'Crime', 'Musical',
];

const DEFAULT_ALLOC = { write: 0.15, shoot: 0.55, post: 0.2, mkt: 0.1 };

/** Shared Gaspar / trophy / awards-strip categories. */
export const AWARD_CATS = [
  'Best Picture',
  'Best Director',
  'Best Actor',
  'Best Screenplay',
  'Best Score',
];

function sizeUnlocked(G, size) {
  const u = G.unlockedSizes || {};
  return u[size] === true;
}

/**
 * Phase hours from size + allocation. Soft floors so knobs never delete a phase.
 * postProdOwned shortens post (~15%) to match UI estimate.
 */
export function computePhaseHours(size, alloc = {}, opts = {}) {
  const spec = FILM_SIZES[size] || FILM_SIZES.medium;
  const a = { ...DEFAULT_ALLOC, ...alloc };
  const writeBias = (a.write - DEFAULT_ALLOC.write) * 2.2;
  const shootBias = (a.shoot - DEFAULT_ALLOC.shoot) * 1.8;
  const postBias = (a.post - DEFAULT_ALLOC.post) * 2.0;
  const mktBias = (a.mkt - DEFAULT_ALLOC.mkt) * 0.8;

  let pre = Math.round(spec.preH * (1 + writeBias));
  let prod = Math.round(spec.prodH * (1 + shootBias));
  let post = Math.round(spec.postH * (1 + postBias - mktBias * 0.35));
  if (opts.postProdOwned) post = Math.round(post * 0.85);

  pre = Math.max(Math.round(spec.preH * 0.55), pre);
  prod = Math.max(Math.round(spec.prodH * 0.55), prod);
  post = Math.max(Math.round(spec.postH * 0.5), post);
  return { pre, prod, post };
}

export function readMetaSave() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : { genreTips: {} };
  } catch {
    return { genreTips: {} };
  }
}

export function writeMetaTip(genre, tip) {
  try {
    const meta = readMetaSave();
    meta.genreTips[genre] = tip;
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* DOM/localStorage optional in tests */
  }
}

export function initMarketHidden(G, rng = Math.random) {
  G.marketHidden = {};
  GENRES.forEach((g) => {
    G.marketHidden[g] = 0.7 + rng() * 0.6;
  });
}

export function initRivals(G, rng = Math.random) {
  const names = ['Orion Films', 'Summit Peak', 'Northgate', 'Velvet Reel'];
  G.rivals = names.map((name) => ({
    name,
    slate: GENRES.sort(() => rng() - 0.5).slice(0, 2).map((genre) => ({
      genre,
      size: rng() > 0.6 ? 'large' : 'medium',
      month: Math.floor(rng() * 12) + 1,
    })),
  }));
}

export function unlockStaffRole(G, role) {
  if (!STAFF_ROLES.includes(role)) return false;
  if (!G.staffRoles) G.staffRoles = {};
  G.staffRoles[role] = true;
  return true;
}

/**
 * Analyst sample: reveal market fog for a genre (capped insight).
 */
export function analystReveal(G, genre, rng = Math.random) {
  if (!G.staffRoles?.analyst) return { ok: false, reason: 'no_analyst' };
  const hidden = G.marketHidden?.[genre] ?? 1;
  const chance = Math.min(SOFT.insightCap, 0.4 + (G.rp ?? 0) / 200);
  const check = rollCheck(chance, rng);
  const reveal = hidden * (check.tier === 'critical' ? 0.9 : check.tier === 'success' ? 0.65 : 0.35);
  logRisk(G, { type: 'analyst', genre, tier: check.tier, reveal });
  writeMetaTip(genre, check.tier === 'critical' ? 'hot' : check.tier === 'success' ? 'warm' : 'cool');
  return { ok: true, tier: check.tier, genre, demandHint: reveal, label: check.tier === 'fail' ? 'foggy' : 'partial' };
}

/**
 * Talent attach attempt with soft cap.
 */
export function attachTalent(G, film, baseChance, rng = Math.random) {
  let chance = baseChance * bodyMod(G);
  if (G.staffRoles?.marketer) chance *= 1.08;
  if (G.staffRoles?.executive) chance *= 1.04;
  chance = Math.min(chance, SOFT.attachCap);
  const check = rollCheck(chance, rng);
  logRisk(G, { type: 'attach', tier: check.tier, chance, talent: film?.pendingTalent });

  if (check.tier === 'fail') {
    return { attached: false, tier: check.tier, chance };
  }

  if (film?.pendingTalent) {
    film.attached = film.attached || [];
    film.attached.push(film.pendingTalent);
    film.pendingTalent = null;
  }
  return { attached: true, tier: check.tier, chance, bonus: check.tier === 'critical' ? 6 : check.tier === 'success' ? 3 : 1 };
}

export function createFilm(G, opts = {}) {
  const size = opts.size || 'medium';
  if (!sizeUnlocked(G, size)) return { ok: false, reason: 'size_locked' };

  const spec = FILM_SIZES[size];
  const budget = opts.budget ?? spec.budgetM * 1e6;
  const alloc = { ...DEFAULT_ALLOC, ...opts.alloc };
  const postProdOwned =
    opts.postProdOwned ?? !!G.upgrades?.find((u) => u.id === 'postprod' && u.owned);
  const hoursLeft = computePhaseHours(size, alloc, { postProdOwned });

  const qualityBase = 35 + spec.budgetM * 1.2 + (opts.talentBoost ?? 0);
  // Alloc soft quality nudge — never pins outcome
  const qNudge = Math.round((alloc.write - DEFAULT_ALLOC.write) * 18 + (alloc.post - DEFAULT_ALLOC.post) * 12);
  const film = {
    id: opts.id ?? Date.now(),
    title: opts.title ?? 'Untitled',
    genre: opts.genre ?? 'Drama',
    theme: opts.theme ?? null,
    size,
    budget,
    alloc,
    phase: 'pre',
    hoursLeft,
    qualityEst: {
      lo: clamp(Math.round(qualityBase - 12 + qNudge * 0.4), 15, 90),
      hi: clamp(Math.round(qualityBase + 14 + qNudge * 0.4), 20, 95),
    },
    qualityTrue: null,
    attached: opts.attached ?? [],
    features: opts.features ?? [],
    crisis: null,
    grossMult: 1,
  };

  if (!G.pipeline) G.pipeline = [];
  G.pipeline.push(film);
  G.films = G.pipeline;
  return { ok: true, film };
}

/** Keep G.films and G.pipeline as the same array reference. */
export function syncSlate(G) {
  const slate = Array.isArray(G.pipeline) ? G.pipeline : Array.isArray(G.films) ? G.films : [];
  G.pipeline = slate;
  G.films = slate;
  return slate;
}

/** Remove films matching pred; re-aliases films === pipeline. */
export function removeFilm(G, pred) {
  const slate = syncSlate(G);
  const next = slate.filter((f) => !pred(f));
  G.pipeline = next;
  G.films = next;
  return next;
}

/** Same window as box-office rival clash (±2 months, matching genre). */
export function rivalClashLikely(G, genre, month) {
  const m = month ?? G.month ?? 6;
  return (G.rivals || []).some((r) =>
    (r.slate || []).some((s) => s.genre === genre && Math.abs((s.month || 6) - m) <= 2)
  );
}

const CRISIS_POOL = [
  { id: 'weather', text: 'Weather shuts down exterior shoot.', payCost: 0.08, pressRep: -4 },
  { id: 'injury', text: 'Lead actor sprains ankle on set.', payCost: 0.12, pressRep: -8 },
  { id: 'leak', text: 'Set photos leak to social media.', payCost: 0.03, pressRep: -10 },
];

/**
 * Advance film production hours; prod phase may trigger pay-vs-press crisis.
 */
export function advanceFilmHours(film, hours, G, rng = Math.random) {
  let remaining = hours;
  const result = { advanced: 0, phaseComplete: null, crisis: null, released: false };

  while (remaining > 0) {
    const phase = film.phase;
    if (!film.hoursLeft[phase] || film.hoursLeft[phase] <= 0) {
      if (phase === 'pre') film.phase = 'prod';
      else if (phase === 'prod') film.phase = 'post';
      else break;
      continue;
    }

    const slice = Math.min(remaining, film.hoursLeft[phase]);
    film.hoursLeft[phase] -= slice;
    remaining -= slice;
    result.advanced += slice;

    if (phase === 'prod' && !film.crisis && rng() < 0.04) {
      const c = CRISIS_POOL[Math.floor(rng() * CRISIS_POOL.length)];
      film.crisis = { ...c, resolved: false };
      result.crisis = film.crisis;
    }

    if (film.hoursLeft[phase] <= 0) {
      result.phaseComplete = phase;
      if (phase === 'pre') film.phase = 'prod';
      else if (phase === 'prod') film.phase = 'post';
      else if (phase === 'post') {
        film.qualityTrue = clamp(
          Math.round((film.qualityEst.lo + film.qualityEst.hi) / 2 + rng() * 12 - 6),
          15,
          98,
        );
        film.phase = 'done';
        result.released = true;
      }
    }
  }

  return result;
}

/** Resolve production crisis: pay (cash) vs press (rep hit). */
export function resolveCrisis(G, film, choice) {
  if (!film?.crisis || film.crisis.resolved) return null;
  const c = film.crisis;
  if (choice === 'pay') {
    const cost = Math.round(film.budget * c.payCost);
    G.cash = (G.cash ?? 0) - cost;
    film.budget += cost;
    c.resolved = true;
    return { choice: 'pay', cost };
  }
  G.rep = clamp((G.rep ?? 50) + c.pressRep, 0, 100);
  if (G.body) G.body.stress = clamp(G.body.stress + 6, 0, 100);
  c.resolved = true;
  return { choice: 'press', rep: c.pressRep };
}

export function applyPremiumFeature(G, film, featureId) {
  const feat = PREMIUM_FEATURES.find((f) => f.id === featureId);
  if (!feat) return { ok: false };
  if (!G.features?.includes(featureId)) return { ok: false, reason: 'not_unlocked' };
  if (film.features.includes(featureId)) return { ok: false, reason: 'already_applied' };

  const cost = Math.round(film.budget * feat.costPct);
  if ((G.cash ?? 0) < cost) return { ok: false, reason: 'insufficient_cash' };
  G.cash -= cost;
  film.budget += cost;
  film.features.push(featureId);
  film.qualityEst.lo = clamp(film.qualityEst.lo + feat.quality - 2, 10, 95);
  film.qualityEst.hi = clamp(film.qualityEst.hi + feat.quality, 15, 99);
  if (feat.gross) film.grossMult += feat.gross;
  return { ok: true, feature: featureId, cost };
}

/**
 * Commit-then-reveal box office. Residual RNG always remains (soft ceiling).
 * @returns {{ gross: number, net: number, distCut: number, cutRate: number, reachNote: string }}
 */
export function estimateBoxOffice(film, G, opts = {}) {
  const rng = opts.rng || Math.random;
  const seasonMod = opts.seasonMod ?? 1;
  const ratingReach = opts.ratingReach ?? 1;
  const q =
    film.qualityTrue ??
    film.quality ??
    ((film.qualityEst?.lo ?? 50) + (film.qualityEst?.hi ?? 70)) / 2;
  const demand = G.marketHidden?.[film.genre] ?? 1;

  let base = film.budget * (0.5 + (q / 100) * 2.8);
  base *= film.grossMult || 1;
  base *= 0.7 + ((G.rep ?? 50) / 100) * 0.6;
  base *= seasonMod;
  if (film.seasonReroll) base *= 0.85 + rng() * 0.4;
  base *= ratingReach;
  if (film.dist === 'self') base *= 0.85;
  if (G.region === 'Chinawood') base *= 1.1;
  if (G.upgrades?.find((u) => u.id === 'marketing' && u.owned)) base *= 1.1;
  if (G.upgrades?.find((u) => u.id === 'intl' && u.owned)) base *= 1.2;
  if (G.activeMkt?.includes('trailer')) base *= 1.25;
  if (G.activeMkt?.includes('intlpromo')) base *= 1.12;
  base *= 0.8 + rng() * 0.4;
  base *= demand;

  // Rival slate collision — soft, never a hard wipe
  const clash = rivalClashLikely(G, film.genre, G.month);
  if (clash) base *= 0.88 + rng() * 0.06;

  let reachNote = '';
  if (film.dist === 'self') {
    const reach = 0.72 + rng() * 0.2;
    base *= reach;
    reachNote = ' · reach ' + Math.round(reach * 100) + '%';
  }

  // Sales staff softens third-party cut slightly (never removes cut)
  let cutRate = film.dist === 'self' ? 0 : 0.2 + rng() * 0.15;
  if (film.dist !== 'self' && G.staffRoles?.sales) cutRate = Math.max(0.16, cutRate - 0.03);

  const gross = Math.round(base);
  const distCut = film.dist === 'self' ? 0 : Math.round(gross * cutRate);
  return { gross, net: gross - distCut, distCut, cutRate, reachNote, rivalClash: !!clash };
}
