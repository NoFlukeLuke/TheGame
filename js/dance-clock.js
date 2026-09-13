// ══════════════════════════════════════════════
// DANCE CLOCK (r197) - the scoring dance's own pausable, accelerating clock
// ══════════════════════════════════════════════
// The dance was a chain of bare setTimeouts, and a setTimeout can neither be
// paused nor re-timed once it is armed. Two wanted behaviours both come down to
// that one fact, so they share one file:
//
// 1. PAUSE. Opening the pause menu - or RECORDS, which pauses too - stopped the
//    round clock and hid the board while the dance carried on running behind the
//    overlay, and finished there. The player came back to a score that had moved
//    with nothing left on screen to explain it.
// 2. ACCELERATION. Every tick the dance pays out (a card's pips, a Trick's pips
//    or mult, a Sleight firing) speeds the REST of the dance up by
//    DNC_ACCEL_STEP, compounding. A two-card Pair plays at its normal pace; a
//    five-card hand through a full tray winds itself into a blur.
//
// THE PAUSE PREDICATE IS `isPaused`, DELIBERATELY NOT `gameTimerPaused`. The
// goal-hand dance sets gameTimerPaused ITSELF to freeze the round clock while it
// plays (js/score-dance.js) - keying off that would deadlock the very dance that
// set it.

function dancePaused() { return typeof isPaused !== 'undefined' && !!isPaused; }

// ── The pausable wait ───────────────────────────────────────────────────────
// Polls a real-time accumulator and only spends it while unpaused, so a wait
// can never resolve early: `left` is decremented by MEASURED elapsed time, never
// by the sleep it asked for. When the remainder is under DNC_TICK the last sleep
// is exactly the remainder, so an unpaused wait keeps setTimeout's precision.
const DNC_TICK = 60;   // ms between checks while a wait is running or held
let _dncWaits = new Set();

function dncWait(ms, signal) {
  return new Promise((res, rej) => {
    if (signal?.aborted) return rej(new DOMException('aborted'));
    let left = Math.max(0, ms), last = performance.now(), id = 0;
    const rec = { stop: () => { clearTimeout(id); _dncWaits.delete(rec); } };
    const onAbort = () => { rec.stop(); rej(new DOMException('aborted')); };
    const step = () => {
      const now = performance.now();
      if (!dancePaused()) left -= (now - last);
      last = now;
      if (left <= 0) {
        rec.stop();
        signal?.removeEventListener('abort', onAbort);
        res();
        return;
      }
      id = setTimeout(step, dancePaused() ? DNC_TICK : Math.max(8, Math.min(left, DNC_TICK)));
    };
    _dncWaits.add(rec);
    signal?.addEventListener('abort', onAbort, { once: true });
    id = setTimeout(step, Math.max(8, Math.min(left, DNC_TICK)));
  });
}

// A pausable setTimeout for the dance's fire-and-forget work (removing a spent
// particle, clearing a pop class). Returns a handle with .cancel().
function dncTimeout(fn, ms) {
  let live = true;
  dncWait(ms).then(() => { if (live) fn(); }).catch(() => {});
  return { cancel: () => { live = false; } };
}

// ── Animation registry ──────────────────────────────────────────────────────
// Every WAAPI animation the dance starts is registered here so a pause can hold
// it at the frame it is on. A plain `el.animate()` would keep flying behind the
// pause overlay and land on a board the player cannot see.
let _dncAnims = [];

function dncAnimate(el, frames, opts) {
  if (!el) return null;
  const a = el.animate(frames, opts);
  _dncAnims.push(a);
  if (dancePaused()) { try { a.pause(); } catch (e) {} }
  // Drop finished animations rather than growing the list for a whole run.
  a.finished?.then(() => { const i = _dncAnims.indexOf(a); if (i >= 0) _dncAnims.splice(i, 1); }).catch(() => {});
  return a;
}

function dncClearAnims() { _dncAnims = []; }

// Called from pauseGame / resumeGame (js/game-control.js). The CSS class is what
// holds the class-driven keyframes - jitter, pop, pulse, flash - which are not
// WAAPI animations and so are not in the registry.
function dncSetPaused(on) {
  document.body.classList.toggle('dance-paused', !!on);
  _dncAnims.forEach(a => { try { on ? a.pause() : a.play(); } catch (e) {} });
}

// ── Acceleration ────────────────────────────────────────────────────────────
// Compounding, so the wind-up is felt rather than merely measured: at +5% a
// tick, 43 payouts reach the 8x ceiling. An ordinary hand pays out a handful of
// ticks and barely moves; a long one through a full tray runs away, which is the
// point.
const DNC_ACCEL_STEP = 0.05;  // +5% of the CURRENT pace per payout tick
const DNC_ACCEL_MAX  = 8;     // ceiling, as a multiple of this dance's base pace
let dncAccel = 1;

function dncResetAccel() { dncAccel = 1; }
function dncBumpAccel(n = 1) {
  if (!(n > 0)) return;
  dncAccel = Math.min(DNC_ACCEL_MAX, dncAccel * Math.pow(1 + DNC_ACCEL_STEP, n));
}
// The live pace: this dance's base speed times everything it has paid out so far.
// Every duration in the dance divides by THIS, never by dncSpeed directly.
function dncPace() { return (typeof dncSpeed === 'number' ? dncSpeed : 1) * dncAccel; }
