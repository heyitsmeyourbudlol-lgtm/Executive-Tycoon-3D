import { tickHour } from './clock.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const DEFAULT_BODY = { energy: 100, hygiene: 100, health: 100, stress: 10 };

export function ensureBody(G) {
  if (!G.body) G.body = { ...DEFAULT_BODY };
  return G.body;
}

export function decayHour(G, awake = true) {
  const b = ensureBody(G);
  if (!awake) return b;
  b.energy = clamp(b.energy - 2.5, 0, 100);
  b.hygiene = clamp(b.hygiene - 1.2, 0, 100);
  b.stress = clamp(b.stress + 0.8, 0, 100);
  if (b.energy <= 0) forcedCrash(G);
  return b;
}

/**
 * Restore energy from sleep. Poor recovery after all-nighter streaks (soft ceiling).
 * @returns {{ hoursNeeded: number, quality: number, slept: number }}
 */
export function sleep(G, hours = 7) {
  const b = ensureBody(G);
  const deficit = 100 - b.energy;
  const hoursNeeded = Math.min(hours, Math.max(1, Math.ceil(deficit / 12)));
  const slept = Math.min(hours, hoursNeeded);

  let quality = slept >= 7 ? 1 : slept >= 5 ? 0.72 : 0.45;
  if ((G.poorSleepStreak ?? 0) >= 2) quality *= 0.55;

  b.energy = clamp(b.energy + slept * 12 * quality, 0, 100);
  b.stress = clamp(b.stress - slept * 2, 0, 100);

  if (slept < 5) G.poorSleepStreak = (G.poorSleepStreak ?? 0) + 1;
  else G.poorSleepStreak = 0;

  return { hoursNeeded, quality, slept };
}

export function shower(G) {
  const b = ensureBody(G);
  const cost = 150;
  G.cash = (G.cash ?? 0) - cost;
  b.hygiene = clamp(b.hygiene + 35, 0, 100);
  return { cost, hours: 1 };
}

export function doctor(G) {
  const b = ensureBody(G);
  const cost = 2500;
  G.cash = (G.cash ?? 0) - cost;
  b.health = clamp(b.health + 40, 0, 100);
  b.stress = clamp(b.stress - 5, 0, 100);
  return { cost, hours: 2 };
}

export function forcedCrash(G) {
  const b = ensureBody(G);
  b.energy = 15;
  b.stress = clamp(b.stress + 15, 0, 100);
  G.forcedSleep = true;
  G.crashCount = (G.crashCount ?? 0) + 1;
  return { crashed: true };
}

export function devDrain(G, intensity = 1) {
  const b = ensureBody(G);
  b.energy = clamp(b.energy - 4 * intensity, 0, 100);
  b.stress = clamp(b.stress + 3 * intensity, 0, 100);
  if (b.energy <= 0) forcedCrash(G);
  return b;
}

/** Advance clock after body actions that cost time. */
export function advanceBodyHours(G, hours) {
  tickHour(G, hours);
}
