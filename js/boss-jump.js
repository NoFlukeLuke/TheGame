// ══════════════════════════════════════════════
// SKIP TO THE BOSS (r606, owner)
// ══════════════════════════════════════════════
// Flow only. Double-tap the skull at the end of the session clock (#vclock-boss /
// #clock-boss, bound in js/boss.js) and the clock runs out fast: the seconds drain
// off it, every animation on screen runs BOSS_JUMP_SPEED times as fast, and at 0:00
// the boss arrives exactly as it would have (flowTriggerBoss).
//
// The skipped seconds are simply gone. The round tick is stopped for the drain, so
// nothing that hangs off it runs (Tempo, challenge clocks, clock marks, Understudy),
// and the board takes no input (bossJumpRunning() is asked by onCardTap, the grid's
// pointerdown, playHand, doDiscard, doSwap and the Focus bar). A pause or Stopwatch
// holding the clock is let go first: at 0:00 the boss starts on an unfrozen clock.
//
// The last BOSS_APPROACH_CFG.warnSeconds drain at BOSS_JUMP_SPEED, so the approach
// (colour drain, count, heartbeat) is seen; anything above them drains in at most
// BOSS_JUMP_FAST_MS. The pause menu (isPaused) or a menu that suspends the game
// (gameTimerPaused) opened mid-drain holds it.
const BOSS_JUMP_SPEED   = 8;
const BOSS_JUMP_FAST_MS = 1500;
let _bjRun = null;   // { left, fastRate, last, raf, anims: Map (animation -> its own rate), stopSfx }

function bossJumpRunning() { return !!_bjRun; }
// The heartbeat's pace (js/boss-approach.js) reads this, so it quickens with the clock.
function bossJumpPace() { return _bjRun ? BOSS_JUMP_SPEED : 1; }

// Why the skip cannot start now: '' = it can, null = say nothing (not Flow, or the
// boss is already here).
function bossJumpRefusal() {
  if (typeof flowActive !== 'function' || !flowActive()) return null;
  if (bossActive || flowBossFighting || _bjRun) return null;
  if (roundEnded || gameTimerPaused || !roundInterval
      || (typeof gridScreenOwnsBoard === 'function' && gridScreenOwnsBoard())) return 'The clock is not running';
  if (animating || falling || dealPhase
      || (typeof autopilotRunning === 'function' && autopilotRunning())
      || (typeof sweepRunning === 'function' && sweepRunning())
      || (typeof _overdriveRun !== 'undefined' && _overdriveRun)) return 'Wait for the board';
  return '';
}

function bossJumpStart() {
  const why = bossJumpRefusal();
  if (why === null) return;
  if (why) { refuse(why, { color: 'var(--cream-dim)' }); return; }
  clearInterval(roundInterval); roundInterval = null;
  bossJumpReleaseClock();
  if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  selected = []; swapPending = null;
  render();
  const warn = BOSS_APPROACH_CFG.warnSeconds;
  const left = Math.max(0, roundSeconds);
  const fastRate = Math.max(BOSS_JUMP_SPEED, (left - warn) / (BOSS_JUMP_FAST_MS / 1000));
  _bjRun = { left, fastRate, last: performance.now(), raf: 0, anims: new Map(), stopSfx: null };
  dbgEvent('info', `boss jump: ${left}s skipped`);
  document.getElementById('stage')?.classList.add('boss-jump');
  bossJumpOsd(true);
  if (typeof sfxBossJump === 'function') _bjRun.stopSfx = sfxBossJump(bossJumpSecsLeft(_bjRun)) || null;
  _bjRun.raf = requestAnimationFrame(bossJumpFrame);
}

// How long the drain has left to run, in real seconds.
function bossJumpSecsLeft(j) {
  const warn = BOSS_APPROACH_CFG.warnSeconds;
  return Math.max(0, j.left - warn) / j.fastRate + Math.min(j.left, warn) / BOSS_JUMP_SPEED;
}

// A running pause or Stopwatch would freeze the boss's clock, which a clock that
// reached zero on its own can never do.
function bossJumpReleaseClock() {
  if (typeof endStopwatch === 'function') endStopwatch();
  if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
  pauseSecondsLeft = 0;
  firstPauseActive = false;
  pipeTimerPaused = false;
  document.getElementById('clock')?.classList.remove('clock-paused');
  if (typeof endClockFreeze === 'function') endClockFreeze();
}

function bossJumpFrame(now) {
  const j = _bjRun; if (!j) return;
  // A frame's timestamp can be earlier than the performance.now() the drain began
  // at (the r511 tally dip), so dt is clamped at 0 or the clock would tick UP.
  const dt = Math.max(0, Math.min(0.1, (now - j.last) / 1000)); j.last = Math.max(j.last, now);
  if (gameTimerPaused || isPaused) {
    if (j.stopSfx) { j.stopSfx(); j.stopSfx = null; }
    j.held = true;
  } else {
    if (j.held) { j.held = false; if (typeof sfxBossJump === 'function') j.stopSfx = sfxBossJump(bossJumpSecsLeft(j)) || null; }
    // Above the warning the clock runs at fastRate, but never past the warning's
    // first second in one frame, or the count over the board would start low.
    const warn = BOSS_APPROACH_CFG.warnSeconds;
    let next = j.left - dt * (j.left > warn ? j.fastRate : BOSS_JUMP_SPEED);
    if (j.left > warn && next < warn) next = warn;
    j.left = Math.max(0, next);
    const secs = Math.ceil(j.left);
    if (secs !== roundSeconds) {
      roundSeconds = secs;
      updateClockUI();
      if (typeof tickBossApproach === 'function') tickBossApproach();
    }
  }
  bossJumpSpeedAnims();
  if (j.left <= 0) { bossJumpFinish(); return; }
  j.raf = requestAnimationFrame(bossJumpFrame);
}

// Every animation in the document (CSS animations and transitions, WAAPI) runs at
// BOSS_JUMP_SPEED. Asked every frame, so one that starts mid-drain is caught on
// its first frame. The map keeps each one's own rate, which goes back at the end.
function bossJumpSpeedAnims() {
  const j = _bjRun; if (!j || !document.getAnimations) return;
  for (const a of document.getAnimations()) {
    if (j.anims.has(a)) continue;
    j.anims.set(a, a.playbackRate);
    const tg = a.effect && a.effect.target;
    if (tg && tg.closest && tg.closest('#bj-osd')) continue;   // the mark itself keeps its own pace
    a.playbackRate = a.playbackRate * BOSS_JUMP_SPEED;
  }
}
function bossJumpRestoreAnims(j) {
  j.anims.forEach((rate, a) => { try { a.playbackRate = rate; } catch (e) {} });
  j.anims.clear();
}

// A VCR's fast-forward over the board: the two-triangle mark blinking in the
// corner and a tracking band rolling down. A child of #grid, which render() leaves
// alone (it reconciles card elements only), so it is removed here by hand.
function bossJumpOsd(on) {
  document.getElementById('bj-osd')?.remove();
  if (!on) return;
  const g = document.getElementById('grid'); if (!g) return;
  const el = document.createElement('div');
  el.id = 'bj-osd';
  el.innerHTML = '<svg class="bj-mark" viewBox="-1 -1 22 14" aria-hidden="true"><path d="M0 0l10 6-10 6zM10 0l10 6-10 6z"/></svg><div class="bj-track"></div>';
  g.appendChild(el);
}

function bossJumpEnd() {
  const j = _bjRun; if (!j) return;
  cancelAnimationFrame(j.raf);
  if (j.stopSfx) j.stopSfx();
  bossJumpRestoreAnims(j);
  _bjRun = null;
  document.getElementById('stage')?.classList.remove('boss-jump');
  bossJumpOsd(false);
}

function bossJumpFinish() {
  bossJumpEnd();
  roundSeconds = 0;
  updateClockUI();
  // The same call the round tick makes at 0:00 (onRoundEnd's Flow branch).
  if (typeof flowActive === 'function' && flowActive() && !bossActive) flowTriggerBoss();
}

// A new run, Home or a quit mid-drain: stop without summoning anything.
function bossJumpReset() { bossJumpEnd(); }
