/**
 * Bridges realism game systems + modular office into the classic HTML app.
 * Loads after the inline game script; patches window globals.
 */
import * as R from './game/index.js';
import {
  assembleOffice,
  createPostStack,
  detectPathTraceSupport,
  describeGfxMode,
} from './office/index.js';

window.Realism = R;
window.OfficeGfx = { assembleOffice, createPostStack, detectPathTraceSupport, describeGfxMode };

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

let clockTimer = null;
let lastTickMs = 0;
let releaseQueue = [];
let pendingCrisis = null;

function modalBlocksClock() {
  const life = document.getElementById('life-modal');
  const crisis = document.getElementById('crisis-modal');
  const rel = document.getElementById('release-modal');
  return (
    (life && !life.classList.contains('hide')) ||
    (crisis && !crisis.classList.contains('hide')) ||
    (rel && !rel.classList.contains('hide')) ||
    !!pendingCrisis
  );
}

function maybeResumeClock() {
  if (!modalBlocksClock()) resumeClock();
}

function enqueueRelease(f) {
  if (f._releaseQueued) return;
  f._releaseQueued = true;
  releaseQueue.push(f);
  drainReleaseQueue();
}

function drainReleaseQueue() {
  const rel = document.getElementById('release-modal');
  if (rel && !rel.classList.contains('hide')) return;
  if (!releaseQueue.length) return;
  const f = releaseQueue.shift();
  pauseClock();
  showReleaseModal(f);
}

function ensurePlaying() {
  return typeof G === 'object' && G && G.name && !document.getElementById('game-screen')?.classList.contains('hide');
}

function syncPrestigeHud() {
  const p = R.repToPrestige(G.rep);
  G.prestige = p;
  const el = document.getElementById('off-stat-rep');
  if (el) el.textContent = p.toFixed(1);
  const h = document.getElementById('h-rep');
  if (h) h.textContent = p.toFixed(1) + '/5';
}

function updateBodyHud() {
  R.ensureBody(G);
  const b = G.body;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = Math.round(v);
    const bar = document.getElementById(id + '-bar');
    if (bar) bar.style.width = Math.round(clamp01(v)) + '%';
  };
  set('need-energy', b.energy);
  set('need-hygiene', b.hygiene);
  set('need-health', b.health);
  set('need-stress', b.stress);
  const life = document.getElementById('lifestyle-sel');
  if (life && life.value !== G.lifestyle) life.value = G.lifestyle || 'comfortable';
}
window.updateBodyHud = updateBodyHud;

function clamp01(v) {
  return Math.max(0, Math.min(100, v));
}

function updateClockHud() {
  const dateEl = document.getElementById('off-date');
  if (dateEl) {
    dateEl.innerHTML = MONTHS[(G.month || 1) - 1] + '<br>' + String(G.day || 1).padStart(2, '0');
  }
  const clockEl = document.getElementById('off-clock-label');
  if (clockEl) {
    const wd = R.weekday(G);
    const h = String(G.hour ?? 0).padStart(2, '0');
    clockEl.textContent = wd + ' · ' + h + ':00 · ' + (G.year || 1970) + ' · Q' + (G.q || 1);
  }
  const speedEl = document.getElementById('clock-speed-label');
  if (speedEl) {
    if (!G.clockRunning && modalBlocksClock()) {
      speedEl.textContent = 'Paused — resolve modal';
    } else if (!G.clockRunning) {
      speedEl.textContent = (G.clockSpeed || 1) + 'x · paused';
    } else {
      speedEl.textContent = (G.clockSpeed || 1) + 'x';
    }
  }
  const pauseBtn = document.getElementById('btn-clock-pause');
  if (pauseBtn) pauseBtn.classList.toggle('on', !G.clockRunning);
  updateBodyHud();
  syncPrestigeHud();
  const burnEl = document.getElementById('off-burn-day');
  if (burnEl) burnEl.textContent = 'Burn/day ~' + fmtM(R.hourlyBurn(G) * 24);
  if (typeof window.three !== 'undefined' && window.three?.office?.setDayNight) {
    window.three.office.setDayNight(G.hour ?? 12);
  }
}

function fmtM(n) {
  if (typeof window.fmtM === 'function') return window.fmtM(n);
  const a = Math.abs(n);
  return (n < 0 ? '-' : '') + '$' + (a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : Math.round(a).toLocaleString());
}

function pauseClock() {
  G.clockRunning = false;
  updateClockHud();
}

function resumeClock() {
  G.clockRunning = true;
  lastTickMs = performance.now();
  updateClockHud();
}

function setClockSpeed(s) {
  G.clockSpeed = s;
  updateClockHud();
}

function dayTickOpts() {
  return {
    onNewDay: () => {
      const ev = R.maybeLifeEvent(G);
      if (ev) {
        pauseClock();
        showLifeEventModal(ev);
      }
      R.birthdayCheck(G);
      if (G.month === 1 && G.day === 1) {
        const hr = R.healthRoll(G);
        if (hr?.outcome === 'death') handleDeath();
        else if (hr?.outcome === 'scare') toast('❤️ Health scare — rest or see a doctor.', 'b', 4000);
      }
    },
  };
}

function runFilmPipeline(filmHours) {
  if (filmHours < 1) return;
  const films = G.films || [];
  films.forEach((f) => {
    if (!f.hoursLeft) return;
    const r = R.advanceFilmHours(f, filmHours, G);
    if (r.crisis && !pendingCrisis) {
      pendingCrisis = { film: f, crisis: r.crisis };
      pauseClock();
      showCrisisModal(f, r.crisis);
    }
    const left =
      (f.hoursLeft.pre || 0) + (f.hoursLeft.prod || 0) + (f.hoursLeft.post || 0);
    f.ql = left <= 0 ? 0 : Math.max(1, Math.ceil(left / (90 * 24)));
    if (left <= 0 && !f._done) {
      f._done = true;
      f.ql = 0;
    }
  });

  const releasing = (G.films || []).filter(
    (f) =>
      f.hoursLeft &&
      (f.phase === 'done' || f.ql <= 0) &&
      !f._released &&
      !f._releasePending &&
      !f._releaseQueued
  );
  releasing.forEach((f) => {
    f._releasePending = true;
    if (f.dist === 'third' && Math.random() < 0.22) {
      f.phase = 'post';
      f.hoursLeft = f.hoursLeft || { pre: 0, prod: 0, post: 0 };
      f.hoursLeft.post = 72;
      f._done = false;
      f._releasePending = false;
      f.ql = 1;
      toast('📦 Distributor slipped "' + f.title + '" by a few days.', 'b');
      log('Distributor delay on "' + f.title + '"', 'red');
      return;
    }
    if (f.dist === 'self' && Math.random() < 0.18) {
      f.phase = 'post';
      f.hoursLeft = f.hoursLeft || { pre: 0, prod: 0, post: 0 };
      f.hoursLeft.post = 48;
      f._done = false;
      f._releasePending = false;
      f.ql = 1;
      toast('📣 Self-dist marketing push delayed "' + f.title + '".', 'b');
      return;
    }
    enqueueRelease(f);
  });
}

function runNewYearHooks() {
  if (!G._justNewYear) return;
  const tax = R.prepareAndPayYearlyTax(G);
  if (tax.total > 0) {
    log('Taxes paid: ' + fmtM(tax.total) + (tax.audit ? ' (incl. audit)' : ''), 'red');
    toast('🧾 Tax bill ' + fmtM(tax.total) + (tax.audit ? ' · audit' : ''), 'b');
  }
  const inv = R.resolveInvestmentsYear(G);
  inv.forEach((row) => {
    const ret = row.return ?? row.ret ?? 0;
    if (ret < -0.2) toast('📉 Investment hit: ' + row.type, 'b');
    else if (ret > 0.15) toast('📈 Investment gain: ' + row.type, 'g');
  });
  G.inflationShock = Math.random() < 0.12 ? 1.08 + Math.random() * 0.12 : null;
  if (G.inflationShock) {
    toast('💸 Inflation shock — costs climbed (~' + Math.round((G.inflationShock - 1) * 100) + '%).', 'b', 4500);
    log('Inflation shock ×' + G.inflationShock.toFixed(2), 'red');
  }
  G._justNewYear = false;
  R.initRivals(G);
}

function checkEndConditions() {
  const limit = G.campaignMode === 'full' ? 200 : 20;
  if ((G.cash ?? 0) < -5000000) endGameEnhanced('bankruptcy');
  else if (G.campaignMode !== 'full' && (G.totalQ || 0) >= limit) endGameEnhanced('complete');
  else if (G.campaignMode === 'full' && G.year >= 2020) endGameEnhanced('complete');
}

/**
 * Single hub for all game-time advancement (clock, care, week-skip, greenlight).
 * opts.skipBodyDecay — sleep/rest (body already restored)
 * opts.fromCrash — nested sleep after forced crash (no second crash loop)
 * opts.silent — skip HUD/end checks (inner recursion)
 */
function advanceGameHours(hours, opts = {}) {
  const n = Math.floor(+hours || 0);
  if (n < 1) return { advanced: 0 };

  const prevYear = G.year;
  const prevTotalQ = G.totalQ || 0;
  let advanced = 0;
  let yearCrossedHere = false;

  for (let i = 0; i < n; i++) {
    const y0 = G.year;
    R.tickHour(G, 1, dayTickOpts());
    if (G.year !== y0) yearCrossedHere = true;
    if (!opts.skipBodyDecay) R.decayHour(G, true);
    if (!opts.skipCosts) R.applyHourlyCosts(G, 1);
    advanced++;

    if (G.forcedSleep && !opts.fromCrash) {
      G.forcedSleep = false;
      pauseClock();
      toast('😴 You crashed from exhaustion — sleep forced.', 'b', 4500);
      const r = R.sleep(G, 6);
      // Body restored; advance sleep hours once (no double tickHour)
      advanceGameHours(r.slept, { skipBodyDecay: true, fromCrash: true, silent: true });
      break;
    }
  }

  if (yearCrossedHere) G._justNewYear = true;
  runFilmPipeline(advanced);
  runNewYearHooks();

  if (!opts.silent) {
    if ((G.totalQ || 0) > prevTotalQ) onQuarterBoundary();
    updateClockHud();
    if (typeof updateHUD === 'function') updateHUD();
    checkEndConditions();
  }
  return { advanced };
}

function tickClock(dtMs) {
  if (!ensurePlaying() || !G.clockRunning) return;
  const speed = G.clockSpeed || 1;
  const hoursFloat = (dtMs / 1000) * speed;
  G._hourAccum = (G._hourAccum || 0) + hoursFloat;
  const whole = Math.floor(G._hourAccum);
  if (whole < 1) return;
  G._hourAccum -= whole;
  advanceGameHours(whole);
  if (typeof saveGame === 'function') saveGame();
}

function onQuarterBoundary() {
  calcOH?.();
  // Legacy overhead already in hourly; skip double-charging full oh
  G.loans = (G.loans || []).filter((l) => {
    l.rem--;
    return l.rem > 0;
  });
  let rpGain = 3 + (G.films?.length || 0);
  if (G.upgrades?.find((u) => u.id === 'analytics' && u.owned)) rpGain += 3;
  G.rp = (G.rp || 0) + rpGain;
  if ((G.totalQ || 0) % 2 === 0 && typeof refreshMarket === 'function') refreshMarket();

  // Time-gated ancillaries (soft-capped)
  const year = G.year || 1970;
  if (year >= 1980 && G.upgrades?.find((u) => u.id === 'homevideo' && u.owned) && G.released?.length) {
    const hv = R.homeVideoResidual(G);
    if (hv > 0) {
      G.cash += hv;
      G.lastRev = (G.lastRev || 0) + hv;
      G.yearProfitAccum = (G.yearProfitAccum || 0) + hv;
      log('Home-video residuals: ' + fmtM(hv), 'green');
    }
  }
  if (year >= 2008 && G.upgrades?.find((u) => u.id === 'streaming' && u.owned) && G.released?.length) {
    const sr = R.streamingResidual(G);
    if (sr > 0) {
      G.cash += sr;
      G.yearProfitAccum = (G.yearProfitAccum || 0) + sr;
      log('Streaming residuals: ' + fmtM(sr), 'green');
    }
  }

  // Yearly Gaspars — nomination night once per year (Q4)
  if (G.q === 4) runYearlyGaspars();

  G.activeMkt = [];
  log('Quarter tick. Cash: ' + fmtM(G.cash));
}

function runYearlyGaspars() {
  const pool = (G.released || []).filter((f) => (f.releasedYear || G.year) >= G.year - 1);
  const cats = R.AWARD_CATS || ['Best Picture', 'Best Director', 'Best Actor', 'Best Screenplay', 'Best Score'];
  const awardsCampaign =
    G.awardsCampaignYear === G.year || (G.activeMkt || []).includes('awards');
  pool.forEach((f) => {
    const aq = (f.quality || 60) + (f.critic >= 8 ? 10 : 0);
    if (aq < 70) return;
    let chance = Math.min(0.55, (aq - 70) / 60);
    if (awardsCampaign) chance = Math.min(0.66, chance * 1.2);
    if (G.staffRoles?.marketer) chance = Math.min(0.7, chance * 1.1);
    cats.forEach((cat) => {
      if (Math.random() >= chance * 0.35) return;
      if (!G.awards) G.awards = [];
      if (G.awards.some((a) => a.film === f.title && a.cat === cat && a.yr === (G.year || G.yr))) return;
      G.awards.push({ cat, film: f.title, yr: G.year || G.yr });
      f.awards = f.awards || [];
      if (!f.awards.includes(cat)) f.awards.push(cat);
      G.rep = Math.max(0, Math.min(100, (G.rep || 50) + 5));
      toast('🏆 Gaspar: "' + f.title + '" — ' + cat, 'a', 5000);
      log('"' + f.title + '" won ' + cat + '!', 'green');
    });
  });
}

function startClockLoop() {
  if (clockTimer) cancelAnimationFrame(clockTimer);
  lastTickMs = performance.now();
  const loop = (now) => {
    const dt = Math.min(250, now - lastTickMs);
    lastTickMs = now;
    try {
      tickClock(dt);
    } catch (e) {
      console.error(e);
    }
    clockTimer = requestAnimationFrame(loop);
  };
  clockTimer = requestAnimationFrame(loop);
}

function showCrisisModal(film, crisis) {
  let modal = document.getElementById('crisis-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'crisis-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="modal-card">
      <h3>Production crisis</h3>
      <p><strong>${film.title}</strong> — ${crisis.text}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-p" id="crisis-pay">Spend to fix</button>
        <button class="btn btn-r" id="crisis-press">Press on</button>
      </div>
    </div>`;
  modal.classList.remove('hide');
  document.getElementById('crisis-pay').onclick = () => {
    R.resolveCrisis(G, film, 'pay');
    modal.classList.add('hide');
    pendingCrisis = null;
    toast('Paid to stabilize production.', 'i');
    maybeResumeClock();
    saveGame?.();
  };
  document.getElementById('crisis-press').onclick = () => {
    const r = R.resolveCrisis(G, film, 'press');
    modal.classList.add('hide');
    pendingCrisis = null;
    toast('Pressed on — dice are rolling.', r?.ok === false ? 'b' : 'i');
    maybeResumeClock();
    saveGame?.();
  };
}

function showLifeEventModal(ev) {
  let modal = document.getElementById('life-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'life-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="modal-card">
      <h3>Life event</h3>
      <p>${ev.text || ev.name || 'Something happens…'}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-p" data-act="engage">Engage</button>
        <button class="btn" data-act="defer">Defer</button>
        <button class="btn btn-g" data-act="gamble">Gamble</button>
      </div>
    </div>`;
  modal.classList.remove('hide');
  modal.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = () => {
      const act = btn.getAttribute('data-act');
      const res = R.resolveLifeEvent(G, act);
      modal.classList.add('hide');
      const bad = (res?.applied?.rep ?? 0) < 0 || (res?.applied?.cash ?? 0) < 0;
      toast('Life event: ' + act + (res?.tier ? ' (' + res.tier + ')' : ''), bad ? 'b' : 'g');
      updateClockHud();
      maybeResumeClock();
      saveGame?.();
    };
  });
}

function finalizeRelease(f) {
  f._released = true;
  f._releasePending = false;
  f._releaseQueued = false;
  R.removeFilm(G, (x) => x === f || x.id === f.id);
  if (f.qualityTrue != null) f.quality = f.qualityTrue;
  else {
    const mid = ((f.qualityEst?.lo || 50) + (f.qualityEst?.hi || 70)) / 2;
    f.quality = Math.round(mid + (Math.random() * 10 - 5));
  }
  if (f._testScreened && f.qualityEst) {
    const mid = (f.qualityEst.lo + f.qualityEst.hi) / 2;
    f.quality = Math.round(mid + (Math.random() * 4 - 2));
  }
  f.releasedYear = G.year;
  if (typeof releaseFilm === 'function') releaseFilm(f);
  const modal = document.getElementById('release-modal');
  if (modal) modal.classList.add('hide');
  updateAll?.();
  saveGame?.();
  drainReleaseQueue();
  maybeResumeClock();
}

function showReleaseModal(f) {
  let modal = document.getElementById('release-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'release-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  const band =
    f.qualityEst ? f.qualityEst.lo + '–' + f.qualityEst.hi : String(f.qualityTrue || f.quality || '?');
  modal.innerHTML = `
    <div class="modal-card">
      <h3>Ready to release</h3>
      <p><strong>${f.title}</strong> is out of post. Quality band ${band}. Choose carefully — commit then reveal.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-p" id="rel-now">Release now</button>
        <button class="btn" id="rel-test">Test screening ($80k · 24h)</button>
        <button class="btn" id="rel-hold">Hold for window ($ overhead · 7d)</button>
      </div>
    </div>`;
  modal.classList.remove('hide');
  document.getElementById('rel-now').onclick = () => {
    modal.classList.add('hide');
    finalizeRelease(f);
  };
  document.getElementById('rel-test').onclick = () => {
    const cost = R.scaleByInflation(80000, G);
    if (G.cash < cost) {
      toast('Need ' + fmtM(cost) + ' for screening.', 'b');
      return;
    }
    G.cash -= cost;
    advanceGameHours(24);
    // Narrow estimate band (residual remains)
    if (f.qualityEst) {
      const mid = (f.qualityEst.lo + f.qualityEst.hi) / 2;
      f.qualityEst.lo = Math.round(mid - 4);
      f.qualityEst.hi = Math.round(mid + 4);
    }
    if (f.qualityTrue != null) {
      f.qualityTrue = Math.round(
        (f.qualityTrue + (f.qualityEst.lo + f.qualityEst.hi) / 2) / 2
      );
    }
    f._testScreened = true;
    toast('🎞 Test screening narrowed the band.', 'g');
    modal.classList.add('hide');
    showReleaseModal(f); // re-open with tighter band
  };
  document.getElementById('rel-hold').onclick = () => {
    advanceGameHours(24 * 7);
    f.seasonReroll = true;
    toast('📅 Held for a better window.', 'i');
    modal.classList.add('hide');
    finalizeRelease(f);
  };
}

function handleDeath() {
  pauseClock();
  if (!G.successor) {
    endGameEnhanced('died_no_heir');
    return;
  }
  const r = R.resolveSuccession(G);
  if (r?.outcome === 'accept') {
    toast('👑 Successor accepts the chair.', 'a', 5000);
    G.generation = (G.generation || 1) + 1;
    G.age = 28;
    R.ensureBody(G);
    G.body = { energy: 80, hygiene: 80, health: 90, stress: 25 };
    G.endReason = null;
    log('Dynasty continues — generation ' + G.generation, 'green');
    resumeClock();
    saveGame?.();
  } else if (r?.outcome === 'counter') {
    const pay = r.demand || Math.round((G.cash || 0) * 0.15);
    G.cash -= pay;
    toast('Successor counters — paid ' + fmtM(pay) + ' for loyalty.', 'i');
    G.generation = (G.generation || 1) + 1;
    G.age = 30;
    G.endReason = null;
    resumeClock();
  } else {
    endGameEnhanced('heir_pass');
  }
}

function endGameEnhanced(reason) {
  pauseClock();
  G.endReason = reason;
  if (typeof endGame === 'function') {
    const map = {
      bankruptcy: 'bankruptcy',
      complete: 'complete',
      died_no_heir: 'bankruptcy',
      heir_pass: 'bankruptcy',
      dynasty: 'complete',
    };
    // Customize end screen after
    endGame(map[reason] || 'complete');
    const sub = document.getElementById('e-sub');
    if (sub) {
      const labels = {
        died_no_heir: 'Died without an heir — the studio fragments.',
        heir_pass: 'The heir refused the chair — empire sold off.',
        complete: G.campaignMode === 'full' ? 'Reached the modern era.' : 'Short campaign complete.',
        bankruptcy: 'Ran out of runway.',
      };
      sub.textContent = (labels[reason] || sub.textContent) + ' Score: ' + (typeof calcScore === 'function' ? calcScore() : 0);
    }
  }
}

// —— Care actions ——
window.doSleep = function doSleep() {
  if (!ensurePlaying()) return;
  const wasRunning = !!G.clockRunning;
  pauseClock();
  const r = R.sleep(G, 7);
  advanceGameHours(r.slept, { skipBodyDecay: true });
  toast('😴 Slept ' + r.slept + 'h', 'i');
  if (wasRunning) maybeResumeClock();
  else updateClockHud();
  saveGame?.();
};
window.doShower = function doShower() {
  if (!ensurePlaying()) return;
  const wasRunning = !!G.clockRunning;
  pauseClock();
  const r = R.shower(G);
  advanceGameHours(r.hours);
  R.devDrain(G, 0.3);
  toast('🚿 Freshened up (−' + fmtM(r.cost) + ')', 'i');
  if (wasRunning) maybeResumeClock();
  else updateClockHud();
  saveGame?.();
};
window.doDoctor = function doDoctor() {
  if (!ensurePlaying()) return;
  const wasRunning = !!G.clockRunning;
  pauseClock();
  const r = R.doctor(G);
  advanceGameHours(r.hours);
  toast('🩺 Doctor visit (−' + fmtM(r.cost) + ')', 'i');
  if (wasRunning) maybeResumeClock();
  else updateClockHud();
  saveGame?.();
};
window.setLifestyle = function setLifestyle(v) {
  G.lifestyle = v;
  toast('Lifestyle: ' + v, 'i');
  saveGame?.();
};
window.pauseGameClock = pauseClock;
window.resumeGameClock = resumeClock;
window.setGameSpeed = setClockSpeed;

window.nameSuccessorUI = function nameSuccessorUI() {
  const name = prompt('Successor name?', G.successor?.name || 'Alex Rivera');
  if (!name) return;
  R.nameSuccessor(G, name);
  toast('Named successor: ' + name, 'g');
  saveGame?.();
};
window.mentorHeir = function mentorHeir() {
  if (!G.successor) {
    toast('Name a successor first.', 'b');
    return;
  }
  const inv = R.investInHeir(G, 50000);
  if (inv && inv.ok === false) {
    toast('Need cash to mentor heir.', 'b');
    return;
  }
  R.devDrain(G, 1.2);
  advanceGameHours(4);
  toast('Mentored heir (4h).', 'g');
  saveGame?.();
};

window.retireCEO = function retireCEO() {
  if (!ensurePlaying()) return;
  if ((G.age || 32) < 50 && (G.prestige || R.repToPrestige(G.rep)) < 3) {
    toast('Too early to retire — build prestige or age into it.', 'b');
    return;
  }
  pauseClock();
  toast('🕶 Retirement — handing off the studio…', 'i');
  handleDeath(); // same succession path
};

window.applyForLoan = function applyForLoan() {
  if ((G.loans || []).length >= 2) {
    toast('Max 2 loans.', 'b');
    return;
  }
  R.devDrain(G, 0.8);
  const res = R.applyLoan(G);
  if (!res.approved) {
    toast('🏦 Loan denied. (' + R.oddsLabel(0.4) + ')', 'b');
    log('Loan denied.', 'red');
  } else {
    toast('🏦 Loan ' + res.terms + ': +' + fmtM(res.amount), 'g');
    log('Loan approved (' + res.terms + '): ' + fmtM(res.amount), 'green');
  }
  updateHUD?.();
  renderStudio?.();
  saveGame?.();
};

window.doInvest = function doInvest(type) {
  const amount = type === 'venture' || type === 'art' ? 200000 : 100000;
  const r = R.invest(G, type, amount);
  if (!r.ok) {
    toast('Cannot invest: ' + r.reason, 'b');
    return;
  }
  toast('Invested ' + fmtM(amount) + ' in ' + type, 'g');
  updateHUD?.();
  renderStudio?.();
  saveGame?.();
};

window.doLiquidate = function doLiquidate(idx) {
  const r = R.liquidate(G, +idx);
  if (!r) {
    toast('No position to liquidate.', 'b');
    return;
  }
  toast('Liquidated ' + r.type + ' → ' + fmtM(r.proceeds) + ' (−' + Math.round(r.penalty * 100) + '% exit)', 'i');
  updateHUD?.();
  renderStudio?.();
  saveGame?.();
};

window.sampleMarket = function sampleMarket() {
  if (!G.staffRoles?.analyst) {
    toast('Need Analytics Dept (Research) to sample market.', 'b');
    return;
  }
  const genre = GENRES?.[0] || 'Drama';
  const pick = G.films?.[0]?.genre || genre;
  R.devDrain(G, 1);
  advanceGameHours(8);
  const r = R.analystReveal(G, pick);
  toast('Analyst: ' + pick + ' feels ' + (r.label || 'foggy'), 'i');
  updateTrendsFog();
  saveGame?.();
};

function updateTrendsFog() {
  const meta = R.readMetaSave();
  const genres = Object.keys(G.marketHidden || {});
  let known = 0;
  genres.forEach((g) => {
    if (meta.genreTips?.[g]) known++;
  });
  const pct = genres.length ? Math.round((known / genres.length) * 80) : 0; // soft cap visual
  const gEl = document.getElementById('off-trend-genres-pct');
  const gBar = document.getElementById('off-trend-genres-bar');
  if (gEl) gEl.textContent = pct + '% tips';
  if (gBar) gBar.style.width = pct + '%';

  // Theme unlock progress (not genre tips)
  const totalThemes = typeof THEMES !== 'undefined' ? THEMES.length : 14;
  const writers = !!G.upgrades?.find((u) => u.id === 'writers' && u.owned);
  const knownThemes = writers ? totalThemes : (G.themes || []).length;
  const tPct = Math.min(100, Math.round((knownThemes / totalThemes) * 100));
  const tEl = document.getElementById('off-trend-themes-pct');
  const tBar = document.getElementById('off-trend-themes-bar');
  if (tEl) tEl.textContent = knownThemes + '/' + totalThemes;
  if (tBar) tBar.style.width = tPct + '%';
}
window.updateTrendsFog = updateTrendsFog;

window.setGfxPreset = function setGfxPreset(p) {
  G.gfxPreset = p;
  window.three?.office?.applyQuality?.(p);
  window.three?.postFx?.setPreset?.(p);
  localStorage.setItem('et_gfx_preset', p);
  toast('Graphics: ' + p, 'i');
};
window.setGfxMode = function setGfxMode(m) {
  G.gfxMode = m;
  if (m === 'pathtrace' && !detectPathTraceSupport()) {
    toast('RT-look needs WebGPU — using Cinematic.', 'b');
    m = 'cinematic';
    G.gfxMode = m;
  }
  if (m === 'pathtrace') window.three?.postFx?.enablePathTraceStub?.();
  else if (m === 'cinematic') window.three?.postFx?.setPreset?.('cinematic');
  else window.three?.postFx?.setPreset?.(G.gfxPreset || 'medium');
  toast(describeGfxMode(m), 'i');
  localStorage.setItem('et_gfx_mode', m);
};

// Patch takeLoan
window.takeLoan = function () {
  window.applyForLoan();
};

// Patch endQuarter → advance one week (works while paused)
window.endQuarter = function endQuarterPatched() {
  if (!ensurePlaying()) return;
  const wasRunning = !!G.clockRunning;
  pauseClock();
  advanceGameHours(24 * 7);
  toast('⏭ Advanced ~1 week', 'i');
  if (wasRunning) maybeResumeClock();
  else updateClockHud();
  saveGame?.();
};

// Patch greenlight
window.doGreenlight = function doGreenlightPatched() {
  if (G.films.length >= 3) {
    toast('Already at max 3 films in production.', 'b');
    return;
  }
  const title = document.getElementById('gl-title').value.trim() || 'Untitled';
  const genre = document.getElementById('gl-genre').value;
  const theme = document.getElementById('gl-theme').value;
  const rating = RATINGS.find((r) => r.name === document.getElementById('gl-rating').value) || RATINGS[2];
  const dist = document.getElementById('gl-dist').value;
  let budgetM = +document.getElementById('gl-budget').value;
  const maxM = R.maxUnlockedBudgetM(G);
  if (budgetM > maxM) {
    budgetM = maxM;
    document.getElementById('gl-budget').value = maxM;
  }
  let budget = R.scaleByInflation(budgetM * 1e6, G);
  if (G.upgrades?.find((u) => u.id === 'anim' && u.owned) && genre === 'Animation') {
    budget = Math.round(budget * 0.75);
  }
  const distCost = dist === 'self' ? Math.round(budget * 0.08) : 0;
  const sequelOfTitle = document.getElementById('gl-sequel').value;
  const sequelOf = sequelOfTitle ? G.released.find((f) => f.title === sequelOfTitle) : null;

  // Size unlock — clamp to unlocked (thresholds from FILM_SIZES)
  let size = R.clampSizeToUnlocked(G, R.budgetMToSize(budgetM));

  // Allocation (normalize)
  let aw = +document.getElementById('gl-alloc-write')?.value || 15;
  let as_ = +document.getElementById('gl-alloc-shoot')?.value || 55;
  let ap = +document.getElementById('gl-alloc-post')?.value || 20;
  let am = +document.getElementById('gl-alloc-mkt')?.value || 10;
  const sum = aw + as_ + ap + am || 1;
  const alloc = { write: aw / sum, shoot: as_ / sum, post: ap / sum, mkt: am / sum };

  const need = budget + distCost;
  if (G.cash < need) {
    toast(
      'Need ' +
        fmtM(need) +
        ' (have ' +
        fmtM(G.cash) +
        '). Lower budget or take a loan.',
      'b',
      5000
    );
    return;
  }

  R.devDrain(G, 1.5);
  advanceGameHours(3);

  // Talent attach rolls
  const attached = [];
  let talentBoost = 0;
  let grossMult = 1;
  ['gl-dir', 'gl-actor', 'gl-writer', 'gl-producer'].forEach((id) => {
    const n = document.getElementById(id).value;
    if (!n) return;
    const t = G.roster.find((x) => x.name === n);
    if (!t) return;
    const base = 0.55 + (G.rep || 50) / 250 + (t.q || 70) / 400;
    const filmStub = { pendingTalent: n };
    const att = R.attachTalent(G, filmStub, base);
    if (!att.attached) {
      toast(n + ' passed on the package.', 'b');
      log(n + ' passed.', 'red');
      return;
    }
    if (att.tier === 'partial') {
      const sweet = Math.round(t.sal * 0.5);
      G.cash -= sweet;
      toast(n + ' countered — sweetener ' + fmtM(sweet), 'i');
    }
    attached.push(n);
    t.busy = true;
    if (t.boost?.q) {
      let b = t.boost.q;
      if (t.genre === genre) b = Math.round(b * 1.3);
      talentBoost += b;
    }
    if (t.boost?.gross) grossMult += t.boost.gross;
    if (t.boost?.eff) budget = Math.round(budget * (1 - t.boost.eff));
  });

  const created = R.createFilm(G, {
    title,
    genre,
    theme,
    size,
    budget,
    alloc,
    attached,
    talentBoost: talentBoost + (rating.quality || 0) + themeSynergy(theme, genre) * 5,
  });
  if (!created.ok) {
    toast('Cannot greenlight: ' + created.reason, 'b');
    return;
  }
  const film = created.film;
  film.rating = rating.name;
  film.dist = dist;
  film.grossMult = grossMult;
  film.totalQ = 3;
  film.ql = 3;
  film.awards = [];
  film.franchise = sequelOf ? sequelOf.franchise || sequelOf.title : title;
  film.installment = sequelOf ? (sequelOf.installment || 1) + 1 : 1;
  film.sequelOf = sequelOf ? sequelOf.title : null;
  film.quality = Math.round((film.qualityEst.lo + film.qualityEst.hi) / 2);

  // Premium features
  document.querySelectorAll('#gl-premium input[data-premium]:checked').forEach((cb) => {
    const id = cb.getAttribute('data-premium');
    const r = R.applyPremiumFeature(G, film, id);
    if (r?.ok) toast('Premium: ' + id, 'g');
  });

  G.cash -= budget + distCost;
  if (!G.films.includes(film)) G.films.push(film);

  log(
    'Greenlighted "' +
      title +
      '" (est Q ' +
      film.qualityEst.lo +
      '–' +
      film.qualityEst.hi +
      ', ' +
      size +
      ')',
    'blue'
  );
  toast('🎬 "' + title + '" in ' + film.phase + ' · est ' + film.qualityEst.lo + '–' + film.qualityEst.hi, 'g');
  closeGL?.();
  updateAll?.();
  saveGame?.();
};

// Quality preview → band
window.glQualityPreview = function glQualityPreviewPatched() {
  const budgetM = +document.getElementById('gl-budget')?.value || 5;
  const genre = document.getElementById('gl-genre')?.value;
  const theme = document.getElementById('gl-theme')?.value;
  const rating = RATINGS.find((r) => r.name === document.getElementById('gl-rating')?.value) || RATINGS[2];
  let base = 40 + budgetM * 1.4;
  base += (rating?.quality || 0) + themeSynergy(theme, genre) * 5;
  if (G.upgrades?.find((u) => u.id === 'sound' && u.owned)) base += 6;
  if (G.upgrades?.find((u) => u.id === 'script' && u.owned)) base += 4;
  if (G.upgrades?.find((u) => u.id === 'vfx' && u.owned) && (genre === 'Sci-Fi' || genre === 'Action')) base += 10;
  const body = R.bodyMod(G);
  base *= 0.92 + body * 0.08;
  const lo = Math.round(clamp(base - 10, 15, 90));
  const hi = Math.round(clamp(base + 12, 20, 95));
  const scaled = R.scaleByInflation(budgetM * 1e6, G);
  const clash = R.rivalClashLikely(G, genre, G.month);
  const el = document.getElementById('gl-quality-preview');
  if (el) {
    el.innerHTML =
      'Est. quality band: <strong>' +
      lo +
      '–' +
      hi +
      '</strong> (uncertain until post)<br>' +
      '<span style="color:var(--color-text-secondary)">Inflated budget: ' +
      fmtM(scaled) +
      ' · ' +
      R.oddsLabel(0.55 * body) +
      '</span>' +
      (clash
        ? '<br><span style="color:#C0453B">Rival collision likely this window — opening may soften.</span>'
        : '');
  }
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// Enhance startGame — set realism fields before 3D so lighting/gfx apply
const _startGame = window.startGame;
window.startGame = function startGamePatched() {
  const name = document.getElementById('sname').value.trim() || 'Apex Pictures';
  let cash = +document.getElementById('sdiff').value;
  const regionEl = document.getElementById('sregion');
  const region = regionEl ? regionEl.value : 'Hollywood';
  if (region === 'Chinawood') cash = Math.round(cash * 1.5);
  const themeCount = cash >= 5000000 ? 8 : cash >= 3500000 ? 6 : 5;
  const themePool = THEMES.map((t) => t.name)
    .sort(() => Math.random() - 0.5)
    .slice(0, themeCount);

  G = Object.assign(R.defaultNewGameFields(), {
    name,
    region,
    cash,
    rep: region === 'Chinawood' ? 45 : 50,
    rp: 0,
    q: 1,
    yr: 1,
    totalQ: 0,
    totalGross: 0,
    lastRev: 0,
    oh: 0,
    films: [],
    released: [],
    roster: [],
    upgrades: JSON.parse(JSON.stringify(UPGRADES)),
    activeMkt: [],
    awards: [],
    market: [],
    loans: [],
    streamRes: [],
    themes: themePool,
    franchises: {},
    year: 1970,
    month: 1,
    day: 1,
    hour: 9,
    age: 32,
    lifestyle: 'comfortable',
    campaignMode: document.getElementById('scampaign')?.value || 'short',
    clockRunning: false,
    clockSpeed: (document.getElementById('scampaign')?.value || 'short') === 'short' ? 2 : 1,
    gfxPreset: localStorage.getItem('et_gfx_preset') || 'medium',
    gfxMode: localStorage.getItem('et_gfx_mode') || 'raster',
  });
  R.migrateSave(G);
  R.initMarketHidden(G);
  R.initRivals(G);
  refreshMarket();
  hide('start-screen');
  show('game-screen');
  enterPlayingUI();
  updateAll();
  log('Studio founded. Welcome to Hollywood.', 'blue');
  toast('🎬 ' + name + ' is open — clock paused. Press play when ready.', 'i', 5000);
  window.three = null;
  init3D();
  goHome();
  updateClockHud();
  updateTrendsFog();
  startClockLoop();
  saveGame?.();
};

const _continueGame = window.continueGame;
window.continueGame = function continueGamePatched() {
  _continueGame();
  R.migrateSave(G);
  G.clockRunning = true;
  updateClockHud();
  updateTrendsFog();
  startClockLoop();
};

// Save / load v4 (with v3 fallback)
const SAVE_KEY_V4 = 'executive_tycoon_save_v4';
window.loadSavedGame = function () {
  try {
    let raw = localStorage.getItem(SAVE_KEY_V4);
    if (!raw) raw = localStorage.getItem('executive_tycoon_save_v3');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
window.saveGame = function () {
  try {
    G.saveVersion = 4;
    localStorage.setItem(SAVE_KEY_V4, JSON.stringify(G));
  } catch (e) {}
};

// —— 3D office patch ——
const _init3D = window.init3D;
window.init3D = function init3DPatched() {
  if (window.three) return;
  const canvas = document.getElementById('c3d');
  const wrap = document.getElementById('sw');
  const W = Math.max(wrap.clientWidth || 680, 320);
  const H = Math.max(wrap.clientHeight || window.innerHeight || 700, 400);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    logarithmicDepthBuffer: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x1a2832, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.physicallyCorrectLights = true;
  if (THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a2832);
  scene.fog = new THREE.Fog(0x1a2832, 28, 55);

  const asp = W / H,
    VS = 13;
  const camera = new THREE.OrthographicCamera(-VS * asp / 2, VS * asp / 2, VS / 2, -VS / 2, 0.5, 120);
  let theta = Math.PI / 4;
  const PHI = 0.6155,
    Rcam = 22;
  function setCam() {
    camera.position.set(
      Rcam * Math.cos(PHI) * Math.sin(theta),
      Rcam * Math.sin(PHI),
      Rcam * Math.cos(PHI) * Math.cos(theta)
    );
    camera.lookAt(0, 2, 0);
    camera.updateProjectionMatrix();
  }
  setCam();

  const office = assembleOffice(THREE, scene, {
    quality: G.gfxPreset || 'medium',
  });
  const postFx = createPostStack(THREE, renderer, scene, camera, G.gfxPreset || 'medium');
  if (G.gfxMode === 'pathtrace') postFx.enablePathTraceStub?.();
  else if (G.gfxMode === 'cinematic') postFx.setPreset?.('cinematic');
  office.setDayNight(G.hour ?? 9);
  office.applyQuality?.(G.gfxPreset || 'medium');

  const ray = new THREE.Raycaster(),
    mp = new THREE.Vector2();
  canvas.addEventListener('click', function (e) {
    const r = canvas.getBoundingClientRect();
    mp.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mp.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mp, camera);
    const hits = ray.intersectObjects(office.clickables || [], true);
    const selEl = document.getElementById('off-sel');
    if (hits.length) {
      const o = hits[0].object;
      let cur = o;
      let awardIdx;
      let filmRef;
      while (cur) {
        if (awardIdx === undefined) {
          awardIdx = cur.userData?.awardIdx ?? cur._awardIdx;
        }
        if (!filmRef) filmRef = cur.userData?.film || cur._film;
        if (awardIdx !== undefined || filmRef) break;
        cur = cur.parent;
      }
      if (awardIdx !== undefined) {
        const cats = R.AWARD_CATS || office.awardCats || [];
        const cat = cats[awardIdx] || 'Award';
        const won = G.awards?.find((a) => a.cat === cat);
        selEl.textContent = won ? '🏆 ' + cat + ' — "' + won.film + '"' : cat + ' — not yet earned';
      } else if (filmRef) {
        selEl.textContent = filmRef.title + ' · ' + fmtM(filmRef.gross || 0);
      } else selEl.textContent = o.name || 'Object';
    }
  });

  let dragging = false,
    lastX = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    theta -= (e.clientX - lastX) * 0.005;
    lastX = e.clientX;
    setCam();
  });

  function setSize() {
    const w = Math.max(wrap.clientWidth || 680, 320);
    const h = Math.max(wrap.clientHeight || window.innerHeight || 700, 400);
    if (w === renderer.domElement.width && h === renderer.domElement.height) return;
    renderer.setSize(w, h, false);
    const a = w / h;
    camera.left = (-VS * a) / 2;
    camera.right = (VS * a) / 2;
    camera.top = VS / 2;
    camera.bottom = -VS / 2;
    camera.updateProjectionMatrix();
  }

  function render() {
    requestAnimationFrame(render);
    if (postFx?.render) postFx.render();
    else renderer.render(scene, camera);
  }
  render();

  window.three = {
    renderer,
    scene,
    camera,
    office,
    postFx,
    posterFrames: office.posterMeshes || [],
    setSize,
    setCam,
    refreshPosters() {},
  };
  if (typeof refresh3D === 'function') refresh3D();
};

// Keep rolling panel → resume
document.addEventListener('click', (e) => {
  if (e.target.closest?.('#off-keeprolling')) {
    resumeClock();
  }
});

// Wire HUD buttons once DOM ready
function wireHud() {
  const pause = document.getElementById('btn-clock-pause');
  const play = document.getElementById('btn-clock-play');
  if (pause) pause.onclick = () => pauseClock();
  if (play) play.onclick = () => resumeClock();
  document.querySelectorAll('[data-speed]').forEach((btn) => {
    btn.onclick = () => setClockSpeed(+btn.getAttribute('data-speed'));
  });
}

wireHud();
updateStartMeta?.();

console.info(
  '[Executive Tycoon] Realism + office modules loaded. WebGPU path-trace:',
  detectPathTraceSupport()
);
