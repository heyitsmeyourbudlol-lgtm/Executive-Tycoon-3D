/** Soft probability ceilings — nothing is guaranteed. */
export const SOFT = {
  loanCap: 0.88,
  attachCap: 0.85,
  insightCap: 0.75,
  successorCap: 0.82,
  investSafeFloor: 0.08,
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Roll against a probability. Lower roll = better outcome.
 * @returns {{ tier: 'critical'|'success'|'partial'|'fail', roll: number, chance: number }}
 */
export function rollCheck(chance, rng = Math.random) {
  const c = clamp(chance, 0, 1);
  const roll = rng();
  let tier;
  if (roll <= c * 0.2) tier = 'critical';
  else if (roll <= c) tier = 'success';
  else if (roll <= c + 0.12) tier = 'partial';
  else tier = 'fail';
  return { tier, roll, chance: c };
}

export function oddsLabel(chance) {
  if (chance >= 0.55) return 'Likely';
  if (chance >= 0.3) return 'Uncertain';
  return 'Long shot';
}

/** Multiplier from body meters — low energy/hygiene/health and high stress hurt performance. */
export function bodyMod(G) {
  const b = G.body || {};
  const energy = b.energy ?? 100;
  const hygiene = b.hygiene ?? 100;
  const health = b.health ?? 100;
  const stress = b.stress ?? 0;
  const avg = (energy + hygiene + health) / 300;
  const stressPenalty = 1 - (stress / 100) * 0.35;
  return clamp(0.35 + avg * 0.65 * stressPenalty, 0.35, 1.15);
}

export function logRisk(G, entry) {
  if (!G.riskLog) G.riskLog = [];
  G.riskLog.push({ ...entry, ts: entry.ts ?? Date.now() });
  if (G.riskLog.length > 40) G.riskLog.splice(0, G.riskLog.length - 40);
}
