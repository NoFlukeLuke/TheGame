// ══════════════════════════════════════════════════════════════════════════
// GRID HEARTBEAT - a wave that pulses down the play grid every 10 seconds.
//
// Every HB_CFG.period seconds the board gives one soft swell. It does not hit the
// whole grid at once - it FALLS FROM THE TOP: the top row lifts first and the
// wavefront travels straight down the board, one row after another (r183).
// (A second, softer beat is available via HB_CFG.beat2, off by default.)
//
//   delay(r,c) = r * rowStagger + colDist(c) * colStagger
//
// colDist is the distance from the centre COLUMN, and it only leans the front a
// little - rowStagger is the big number, so the wave reads as a horizontal line
// coming down rather than a diagonal. Set colStagger to 0 for a dead-flat front.
//
// The wave is also the round clock's metronome: every time a new cycle starts,
// pulseClockWithWave() (js/clock-fx.js) gives the timer a gentle swell and a
// quiet tick, so the board and the clock breathe on the same 10-second beat.
//
// Like the item float this publishes CSS custom properties rather than writing
// el.style.transform, which matters on the grid: the discard fly-out sets an
// INLINE transform, and an inline style beats a stylesheet declaration - so the
// fly-out keeps working with no special-casing. .card.removing (transform with
// !important) and the .card.score-pop-* keyframes likewise still win.
// ══════════════════════════════════════════════════════════════════════════

// Toned down in r143 - the first pass read as too busy under the cards. Movement
// is roughly halved and the second beat is off, so the board gives ONE soft swell
// per period instead of a lub-dub. beat2 is still a live knob: raise it above 0 in
// the dev panel to bring the double beat back.
const HB_DEFAULTS = {
  dx: 0.8,        // px, pushed away from the centre column (outward)
  dy: 2.5,        // px of lift
  rot: 0.12,      // degrees
  scale: 1.5,     // % scale pulse
  period: 10,     // seconds between waves (r183: was 5, now matched to the clock tick)
  beat: 300,      // ms - length of the beat's envelope (slightly longer = softer)
  gap: 190,       // ms - spacing to the second beat, when one is enabled
  beat2: 0,       // second beat's share of the amplitude (0 = single wave)
  colStagger: 26,  // ms per column away from the centre column (small = flat front)
  rowStagger: 120, // ms per row down from the top - this is what makes it fall
};
let HB_CFG = { ...HB_DEFAULTS };
// Storage key bumped to hbCfg3 with the top-down rework (r183). A player who had
// ever nudged a slider had the OLD left-edge numbers saved, and a saved value
// beats a default - without the bump they would keep the old wave forever.
try {
  const saved = JSON.parse(localStorage.getItem('hbCfg3') || 'null');
  if (saved && typeof saved === 'object') HB_CFG = { ...HB_DEFAULTS, ...saved };
} catch (e) {}

let hbEnabled = localStorage.getItem('hbEnabled') !== 'false';
function saveHbCfg()  { try { localStorage.setItem('hbCfg3', JSON.stringify(HB_CFG)); } catch (e) {} }
function setHbParam(k, v) { if (k in HB_CFG) { HB_CFG[k] = +v; saveHbCfg(); } }
function resetHbCfg()  { HB_CFG = { ...HB_DEFAULTS }; saveHbCfg(); }
function setHbEnabled(on) {
  hbEnabled = !!on;
  try { localStorage.setItem('hbEnabled', hbEnabled ? 'true' : 'false'); } catch (e) {}
  if (hbEnabled) startHeartbeat(); else stopHeartbeat();
}

// Distance (in columns) from the grid's middle column, or from the nearer of the
// two centre columns when the column count is even. Only used to lean the
// wavefront slightly; the row index is what drives the wave down the board.
function hbColDist(c, cols) {
  if (cols % 2) return Math.abs(c - (cols - 1) / 2);
  return Math.min(Math.abs(c - (cols / 2 - 1)), Math.abs(c - cols / 2));
}

// One beat's envelope: a single smooth hump, 0 → 1 → 0 across HB_CFG.beat ms.
function hbEnvelope(msSinceStart) {
  if (msSinceStart < 0 || msSinceStart > HB_CFG.beat) return 0;
  return Math.sin(Math.PI * (msSinceStart / HB_CFG.beat));
}

// The wave for one card, given how far into the cycle it is. With beat2 at 0 this
// is a single swell; raise beat2 and a softer second beat follows HB_CFG.gap later.
function hbAmplitude(tInCycle, delay) {
  const a = hbEnvelope(tInCycle - delay);
  if (!HB_CFG.beat2) return a;
  return Math.max(a, hbEnvelope(tInCycle - delay - HB_CFG.gap) * HB_CFG.beat2);
}

let _hbRAF = null;
let _hbLastT = 0;           // position in the previous frame's cycle, to spot the wrap
const HB_SEL = '#grid .card, #grid .trick-card';

function heartbeatRunning() { return _hbRAF !== null; }

function startHeartbeat() {
  stopHeartbeat();
  if (!hbEnabled) return;
  _hbLastT = 0;
  function loop(ms) {
    const periodMs = Math.max(500, HB_CFG.period * 1000);
    const t = ms % periodMs;
    // t running backwards means the modulo wrapped: a new wave starts NOW. That
    // is the moment the clock ticks with it (js/clock-fx.js).
    if (t < _hbLastT && typeof pulseClockWithWave === 'function') pulseClockWithWave();
    _hbLastT = t;
    // A frozen clock freezes the board with it - the cards hold whatever offset
    // they had when the pause landed rather than carrying on breathing. Nothing
    // is cleared, so they resume from exactly where they stopped.
    if (typeof clockFrozen !== 'undefined' && clockFrozen) { _hbRAF = requestAnimationFrame(loop); return; }
    const cols = (typeof gridCols === 'number' && gridCols) ? gridCols : 4;
    document.querySelectorAll(HB_SEL).forEach(el => {
      const r = +el.dataset.row, c = +el.dataset.col;
      if (isNaN(r) || isNaN(c)) return;
      const delay = r * HB_CFG.rowStagger + hbColDist(c, cols) * HB_CFG.colStagger;
      const e = hbAmplitude(t, delay);
      if (e <= 0.0005) {
        if (el._hbOn) { hbClearEl(el); el._hbOn = false; }
        return;
      }
      el._hbOn = true;
      // Columns left of centre fan one way, right of centre the other, so the
      // falling wave spreads outward instead of everything nodding together.
      // (cols-1)/2 is the exact centre line for both odd and even column counts.
      const side = Math.sign(c - (cols - 1) / 2);
      el.style.setProperty('--hbx', (HB_CFG.dx * e * (side || 1)).toFixed(2) + 'px');
      el.style.setProperty('--hby', (-HB_CFG.dy * e).toFixed(2) + 'px');
      el.style.setProperty('--hbr', (HB_CFG.rot * e * (side || 1)).toFixed(3) + 'deg');
      el.style.setProperty('--hbs', (1 + (HB_CFG.scale / 100) * e).toFixed(4));
    });
    _hbRAF = requestAnimationFrame(loop);
  }
  _hbRAF = requestAnimationFrame(loop);
}

function hbClearEl(el) {
  el.style.removeProperty('--hbx'); el.style.removeProperty('--hby');
  el.style.removeProperty('--hbr'); el.style.removeProperty('--hbs');
}

function stopHeartbeat() {
  if (_hbRAF) cancelAnimationFrame(_hbRAF);
  _hbRAF = null;
  document.querySelectorAll(HB_SEL).forEach(el => { hbClearEl(el); el._hbOn = false; });
}
