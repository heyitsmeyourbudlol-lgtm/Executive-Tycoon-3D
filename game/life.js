import { rollCheck, logRisk, SOFT } from './risk.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const END_REASONS = {
  bankruptcy: 'bankruptcy',
  died_no_heir: 'died_no_heir',
  dynasty: 'dynasty',
  complete: 'complete',
  heir_pass: 'heir_pass',
};

export const LIFE_EVENTS = [
  {
    id: 'tabloid',
    cat: 'press',
    eras: [1970, 2020],
    text: 'Tabloid wants a salacious interview about your personal life.',
    engage: { rep: -3, cash: 50000, stress: 5 },
    defer: { rep: 2, stress: -2 },
    gamble: { chance: 0.45, win: { rep: 12, cash: 80000 }, lose: { rep: -15, stress: 10 } },
  },
  {
    id: 'charity',
    cat: 'social',
    eras: [1970, 2020],
    text: 'Film charity gala invites you as keynote speaker.',
    engage: { rep: 8, cash: -25000, stress: 3 },
    defer: { rep: 0 },
    gamble: { chance: 0.5, win: { rep: 15, cash: 100000 }, lose: { cash: -40000 } },
  },
  {
    id: 'family',
    cat: 'personal',
    eras: [1970, 2020],
    text: 'A relative asks for a loan to start a restaurant.',
    engage: { cash: -80000, stress: 5 },
    defer: { stress: 2 },
    gamble: { chance: 0.35, win: { cash: 200000 }, lose: { cash: -120000, stress: 8 } },
  },
  {
    id: 'rival_offer',
    cat: 'business',
    eras: [1970, 2020],
    text: 'Rival studio floats a merger proposal.',
    engage: { rep: 5, stress: 8 },
    defer: { rep: 1 },
    gamble: { chance: 0.4, win: { cash: 500000, rep: 10 }, lose: { rep: -8, stress: 12 } },
  },
  {
    id: 'health_scare',
    cat: 'health',
    eras: [1970, 2020],
    text: 'Doctor recommends immediate lifestyle changes after executive screening.',
    engage: { health: 15, cash: -5000, stress: -5 },
    defer: { health: -8, stress: 6 },
    gamble: { chance: 0.55, win: { health: 25, stress: -10 }, lose: { health: -20, stress: 15 } },
  },
  {
    id: 'mentor',
    cat: 'career',
    eras: [1970, 1995],
    text: 'Retired mogul offers informal mentorship for a season.',
    engage: { rep: 6, rp: 5, stress: -3 },
    defer: { rep: 0 },
    gamble: { chance: 0.48, win: { rep: 14, rp: 15 }, lose: { stress: 5 } },
  },
  {
    id: 'oil_shock',
    cat: 'macro',
    eras: [1973, 1982],
    text: 'Energy crisis spikes production and lifestyle costs.',
    engage: { cash: -40000, stress: 6 },
    defer: { stress: 10, cash: -20000 },
    gamble: { chance: 0.4, win: { cash: 60000 }, lose: { cash: -90000, stress: 12 } },
  },
  {
    id: 'streaming_wars',
    cat: 'macro',
    eras: [2010, 2020],
    text: 'A streamer offers an exclusive window deal with strings attached.',
    engage: { cash: 120000, rep: -2, stress: 4 },
    defer: { rep: 1 },
    gamble: { chance: 0.42, win: { cash: 400000, rep: 6 }, lose: { rep: -10, stress: 8 } },
  },
];

function applyEffects(G, effects) {
  if (!effects) return;
  if (effects.cash) {
    G.cash = (G.cash ?? 0) + effects.cash;
    if (effects.cash > 0) G.yearProfitAccum = (G.yearProfitAccum ?? 0) + effects.cash;
  }
  if (effects.rep) {
    let rep = effects.rep;
    // PR Department softens bad press — never to zero
    if (rep < 0 && G.upgrades?.find((u) => u.id === 'pr' && u.owned)) {
      rep = Math.round(rep / 2);
    }
    // Marketer softens further residual (still negative if bad)
    if (rep < 0 && G.staffRoles?.marketer) {
      rep = Math.round(rep * 0.85);
    }
    G.rep = clamp((G.rep ?? 50) + rep, 0, 100);
  }
  if (effects.rp) G.rp = (G.rp ?? 0) + effects.rp;
  if (effects.stress && G.body) {
    let stress = effects.stress;
    if (stress > 0 && G.staffRoles?.executive) stress = Math.round(stress * 0.7);
    G.body.stress = clamp(G.body.stress + stress, 0, 100);
  }
  if (effects.health && G.body) G.body.health = clamp(G.body.health + effects.health, 0, 100);
}

/** Once per day roll — may surface a life event card (era-filtered). */
export function maybeLifeEvent(G, rng = Math.random) {
  if (rng() > 0.22) return null;
  const year = G.year ?? 1970;
  const pool = LIFE_EVENTS.filter((ev) => {
    const [a, b] = ev.eras || [1970, 2020];
    return year >= a && year <= b;
  });
  if (!pool.length) return null;
  const ev = pool[Math.floor(rng() * pool.length)];
  G.pendingLifeEvent = { ...ev };
  return G.pendingLifeEvent;
}

export function resolveLifeEvent(G, choice, rng = Math.random) {
  const ev = G.pendingLifeEvent;
  if (!ev) return null;

  let result = { id: ev.id, choice, applied: {} };

  if (choice === 'engage') {
    applyEffects(G, ev.engage);
    result.applied = ev.engage;
  } else if (choice === 'defer') {
    applyEffects(G, ev.defer);
    result.applied = ev.defer;
  } else if (choice === 'gamble' && ev.gamble) {
    const check = rollCheck(ev.gamble.chance, rng);
    const effects = check.tier === 'fail' || check.tier === 'partial' ? ev.gamble.lose : ev.gamble.win;
    applyEffects(G, effects);
    result.applied = effects;
    result.tier = check.tier;
    logRisk(G, { type: 'life_gamble', event: ev.id, tier: check.tier });
  }

  G.pendingLifeEvent = null;
  G.lifeEventLog = G.lifeEventLog || [];
  G.lifeEventLog.push(result);
  return result;
}

export function birthdayCheck(G) {
  if (!G.birthMonth) G.birthMonth = G.month ?? 1;
  if (!G.birthDay) G.birthDay = G.day ?? 1;
  if (G.month === G.birthMonth && G.day === G.birthDay) {
    G.age = (G.age ?? 30) + 1;
    return { birthday: true, age: G.age };
  }
  return { birthday: false, age: G.age ?? 30 };
}

/** Annual health roll — scare, recovery, or death without heir. */
export function healthRoll(G, rng = Math.random) {
  const age = G.age ?? 30;
  const health = G.body?.health ?? 100;
  const baseDeath = age > 65 ? (age - 65) * 0.04 : 0;
  const healthMod = health < 40 ? 0.12 : health < 60 ? 0.05 : 0;

  if (rng() < baseDeath + healthMod) {
    if (!G.successor) {
      G.endReason = END_REASONS.died_no_heir;
      return { outcome: 'death', endReason: END_REASONS.died_no_heir };
    }
    return { outcome: 'death', needsSuccession: true };
  }

  if (rng() < 0.25) {
    if (G.body) G.body.health = clamp(G.body.health - 12, 0, 100);
    return { outcome: 'scare', health: G.body?.health };
  }

  if (G.body) G.body.health = clamp(G.body.health + 5, 0, 100);
  return { outcome: 'rest', health: G.body?.health };
}

export function nameSuccessor(G, name) {
  G.successor = { name, readiness: 0.3 };
  return G.successor;
}

export function investInHeir(G, amount) {
  if ((G.cash ?? 0) < amount) return { ok: false };
  G.cash -= amount;
  G.heirInvestment = (G.heirInvestment ?? 0) + amount;
  if (G.successor) {
    G.successor.readiness = clamp(G.successor.readiness + amount / 500000 * 0.15, 0, 1);
  }
  return { ok: true, total: G.heirInvestment };
}

/**
 * Succession resolution: Accept / Counter / Pass (soft cap).
 */
export function resolveSuccession(G, rng = Math.random) {
  const readiness = G.successor?.readiness ?? 0;
  const investBoost = Math.min(0.35, (G.heirInvestment ?? 0) / 800000);
  let chance = 0.25 + readiness * 0.45 + investBoost;
  chance = Math.min(chance, SOFT.successorCap);

  const check = rollCheck(chance, rng);
  logRisk(G, { type: 'succession', tier: check.tier, chance });

  if (check.tier === 'critical' || check.tier === 'success') {
    G.endReason = END_REASONS.dynasty;
    return { outcome: 'accept', tier: check.tier, endReason: END_REASONS.dynasty };
  }
  if (check.tier === 'partial') {
    return { outcome: 'counter', tier: check.tier, demand: Math.round((G.cash ?? 0) * 0.15) };
  }

  G.endReason = END_REASONS.heir_pass;
  return { outcome: 'pass', tier: check.tier, endReason: END_REASONS.heir_pass };
}
