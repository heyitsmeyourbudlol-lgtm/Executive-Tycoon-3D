export const START_YEAR = 1970;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function daysInMonth(month, year) {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function syncDerived(G) {
  G.q = Math.floor((G.month - 1) / 3) + 1;
  G.yr = G.year - START_YEAR + 1;
}

export function seasonFromMonth(m) {
  const q = Math.floor((clamp(m, 1, 12) - 1) / 3);
  return ['Winter', 'Spring', 'Summer', 'Fall'][q];
}

export function weekday(G) {
  let days = 0;
  for (let y = START_YEAR; y < G.year; y++) {
    days += y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365;
  }
  for (let m = 1; m < G.month; m++) days += daysInMonth(m, G.year);
  days += G.day - 1;
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][days % 7];
}

export function formatClock(G) {
  const h = String(G.hour ?? 0).padStart(2, '0');
  return `${G.month}/${G.day}/${G.year} ${h}:00`;
}

/**
 * Baseline inflation curve from 1970 + optional shock multiplier on G.inflationShock.
 */
export function inflationIndexForYear(year, region = 'Hollywood') {
  const years = Math.max(0, year - START_YEAR);
  let idx = 1 + years * 0.028;
  if (region === 'Chinawood') idx *= 0.92;
  return idx;
}

export function currentInflationIndex(G) {
  let idx = inflationIndexForYear(G.year ?? START_YEAR, G.region);
  if (G.inflationShock) idx *= G.inflationShock;
  return idx;
}

const LIFESTYLE_BURN = { frugal: 800, comfortable: 2200, mogul: 6500 };
const MIN_PERSONAL_FLOOR = 400; // never fully escape living costs

function studioHourly(G) {
  const quarterHours = 90 * 24;
  let base = 50000;
  if (G.roster) base += G.roster.reduce((s, t) => s + (t.sal || 0), 0);
  if (G.loans) base += G.loans.reduce((s, l) => s + (l.int || 0), 0);
  if (G.oh) base = G.oh;
  return base / quarterHours;
}

/** Studio + personal hourly burn (lifestyle scales personal). */
export function hourlyBurn(G) {
  const lifestyle = G.lifestyle || 'comfortable';
  let personal = LIFESTYLE_BURN[lifestyle] ?? LIFESTYLE_BURN.comfortable;
  const infl = currentInflationIndex(G);
  personal = Math.max(MIN_PERSONAL_FLOOR, personal) * (0.5 + infl * 0.5);
  return studioHourly(G) + personal;
}

export function applyHourlyCosts(G, hours) {
  const burn = hourlyBurn(G);
  const cost = burn * hours;
  G.cash = (G.cash ?? 0) - cost;
  return cost;
}

/**
 * Advance game time by n hours. Rolls day/month/year/quarter.
 * opts.onNewDay(G) fires once per crossed midnight.
 */
export function tickHour(G, n = 1, opts = {}) {
  const prevDay = G.day;
  let prevQ = G.q ?? 1;

  for (let i = 0; i < n; i++) {
    G.hour = (G.hour ?? 0) + 1;
    if (G.hour >= 24) {
      G.hour = 0;
      G.day = (G.day ?? 1) + 1;
      const dim = daysInMonth(G.month ?? 1, G.year ?? START_YEAR);
      if (G.day > dim) {
        G.day = 1;
        G.month = (G.month ?? 1) + 1;
        if (G.month > 12) {
          G.month = 1;
          G.year = (G.year ?? START_YEAR) + 1;
        }
      }
    }
  }

  syncDerived(G);

  if (G.q !== prevQ) {
    G.totalQ = (G.totalQ ?? 0) + 1;
  }

  if (opts.onNewDay && G.day !== prevDay) opts.onNewDay(G);

  return G;
}
