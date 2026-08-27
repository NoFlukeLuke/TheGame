// ══════════════════════════════════════════════
// BOSS APPROACH  (r177)
// ══════════════════════════════════════════════
// Dread, then a clean slate, for a boss that arrives with NO screen in front of it.
//
// In Classic the boss is announced by the architecture: you finish a round, the
// payout counts up, the reward grid deals, you walk a path to a node marked with a
// skull. By the time the briefing appears you have had three screens of warning.
// Flow has none of that - its five-minute session clock simply reaches zero and a
// boss lands on the board you were mid-hand on. The clock was the only warning and
// it reads like an ordinary round timer right up to the moment it isn't.
//
// So the last 30 seconds are staged: the colour drains out of the machine, a
// heartbeat starts and accelerates, the last ten seconds count down over the board,
// and at zero a wipe visibly clears the score to zero and stamps the boss quota in
// its place. Everything is driven off the ONE-SECOND ROUND TICK plus the element's
// own CSS transitions, so it costs nothing to run and cannot drift.
//
// ── Which modes get this ──
// bossApproachSecondsLeft() is the single question - "how many seconds until a boss
// starts, or null if that isn't a thing here". Only Flow answers it today, because
// only Flow summons a boss from a clock with nothing in between. Survival's boss is
// deliberately NOT wired: its boss fires on the next DEAL after the cadence elapses,
// so a countdown would hit zero and then sit there through however long the current
// goal takes - a countdown that lies is worse than none. If Survival ever gains a
// hard boss deadline, teach it to this function and the rest follows.

const BOSS_APPROACH_CFG = {
  warnSeconds: 30,     // when the colour starts to go
  countFrom:   10,     // when the big numbers appear over the board
  beatSlowMs:  1900,   // gap between heartbeats at T-warnSeconds…
  beatFastMs:  420,    // …and at T-0
  drainMax:    0.9,    // peak desaturation (1 = fully grey)
  wipeMs:      1150,   // the score-clearing animation at zero
};

let bossApproachOn = false;
let _baBeatTimer   = null;
let _baLastShown   = -1;

// Seconds until a boss starts, or null if this mode doesn't summon one on a clock.
function bossApproachSecondsLeft() {
  if (typeof bossActive !== 'undefined' && bossActive) return null;
  if (typeof flowActive === 'function' && flowActive()) {
    if (typeof flowBossFighting !== 'undefined' && flowBossFighting) return null;
    return Math.max(0, roundSeconds);          // the session clock IS the countdown
  }
  return null;
}

// Called once per round tick, after roundSeconds has decremented.
function tickBossApproach() {
  const left = bossApproachSecondsLeft();
  if (left === null || left > BOSS_APPROACH_CFG.warnSeconds) { endBossApproach(); return; }
  if (!bossApproachOn) beginBossApproach();
  _baPaint(left);
}

function beginBossApproach() {
  bossApproachOn = true;
  _baLastShown = -1;
  document.getElementById('stage')?.classList.add('boss-approach');
  document.getElementById('boss-approach-fx')?.classList.add('ba-on');
  _baScheduleBeat();
}

// Idempotent - the tick calls it on every ordinary second, and the wipe calls it
// again before the briefing so the boss round itself is not played in greyscale.
function endBossApproach() {
  if (_baBeatTimer) { clearTimeout(_baBeatTimer); _baBeatTimer = null; }
  if (!bossApproachOn) return;
  bossApproachOn = false;
  document.getElementById('stage')?.classList.remove('boss-approach');
  document.documentElement.style.removeProperty('--ba-t');
  const fx = document.getElementById('boss-approach-fx');
  fx?.classList.remove('ba-on', 'ba-count-on', 'ba-wipe');
}

// Intensity 0→1 across the warning window drives everything in CSS; the countdown
// digit is the only thing written from here.
function _baPaint(left) {
  const cfg = BOSS_APPROACH_CFG;
  const t = Math.min(1, Math.max(0, 1 - left / cfg.warnSeconds));
  // On :root, not on #stage - the FX overlay is a SIBLING of #stage (see
  // index.html), so a property set on #stage would never reach it.
  document.documentElement.style.setProperty('--ba-t', t.toFixed(3));
  const fx = document.getElementById('boss-approach-fx');
  if (!fx) return;
  const counting = left <= cfg.countFrom;
  fx.classList.toggle('ba-count-on', counting);
  if (counting && left !== _baLastShown) {
    _baLastShown = left;
    const el = document.getElementById('ba-count');
    if (el) {
      el.textContent = String(Math.max(0, left));
      // Restart the pop: it's a CSS animation, so it needs a reflow to re-fire.
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    }
  }
}

// The heartbeat reschedules itself, accelerating as the intensity climbs. A single
// self-rescheduling timeout rather than a fixed interval is what lets the gap
// shorten smoothly instead of stepping once per second.
function _baScheduleBeat() {
  if (_baBeatTimer) { clearTimeout(_baBeatTimer); _baBeatTimer = null; }
  if (!bossApproachOn) return;
  const cfg  = BOSS_APPROACH_CFG;
  const left = bossApproachSecondsLeft();
  if (left === null) return;
  const t = Math.min(1, Math.max(0, 1 - left / cfg.warnSeconds));
  const gap = cfg.beatSlowMs + (cfg.beatFastMs - cfg.beatSlowMs) * t;
  _baBeatTimer = setTimeout(() => {
    // gameTimerPaused covers the Mart, the pick screen and the pause menu - the
    // dread should not thump away behind a menu.
    if (bossApproachOn && !gameTimerPaused && typeof sfxHeartbeat === 'function') {
      sfxHeartbeat(0.5 + 0.7 * t);
    }
    _baScheduleBeat();
  }, Math.max(200, Math.round(gap)));
}

// ══════════════════════════════════════════════
// THE WIPE
// ══════════════════════════════════════════════
// Called by flowTriggerBoss once the score has ALREADY been banked and zeroed and
// roundGoal is already the boss quota - this is presentation only, so an abort or a
// missing element can never leave the run in a half-reset state.
//
// suppressScoreDisplay is held for the duration for the same reason the scoring
// dance holds it: the real `score` is 0 from the first frame, and the number ticking
// down on screen is a picture of what is being taken away.
function bossApproachWipe(fromScore) {
  const cfg = BOSS_APPROACH_CFG;
  const fx  = document.getElementById('boss-approach-fx');
  const num = document.getElementById('score-total-num');
  const bar = document.getElementById('score-progress-bar');
  if (fx) { fx.classList.add('ba-on', 'ba-wipe'); fx.classList.remove('ba-count-on'); }
  if (typeof sfxHeartbeat === 'function') sfxHeartbeat(1.2);

  return new Promise(resolve => {
    const t0 = performance.now();
    const from = Math.max(0, fromScore || 0);
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / cfg.wipeMs);
      // Ease-out so the number dives immediately and settles on zero.
      const e = 1 - Math.pow(1 - p, 3);
      if (num) num.textContent = Math.round(from * (1 - e)).toLocaleString();
      if (bar) bar.style.width = Math.round((1 - e) * 100) + '%';
      if (p < 1) requestAnimationFrame(step);
      else {
        endBossApproach();                    // colour back, before the briefing
        suppressScoreDisplay = false;
        if (typeof updateScoreUI === 'function') updateScoreUI();
        // Stamp the new quota: the GOAL chip pops so the replacement is seen.
        const goal = document.getElementById('score-left');
        if (goal) { goal.classList.remove('ba-goal-pop'); void goal.offsetWidth; goal.classList.add('ba-goal-pop');
                    setTimeout(() => goal.classList.remove('ba-goal-pop'), 700); }
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}
