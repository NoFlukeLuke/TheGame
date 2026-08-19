// ══════════════════════════════════════════════════════════════════════════
// GRID HEARTBEAT — a wave that pulses across the play grid every few seconds.
//
// Every HB_CFG.period seconds the board gives a double thump (lub-dub): two
// quick beats close together, the second softer. The beat does not hit the whole
// grid at once — it STARTS at the left edge, at the middle row(s), and radiates
// outward, so a visible wavefront travels across the board.
//
//   delay(r,c) = c * colStagger + rowDist(r) * rowStagger
//
// rowDist is the distance from the middle: with an odd row count there is one
// middle row, with an even row count the two centre rows both count as distance
// 0. (The owner described this in terms of the column count; row count is what
// actually decides whether a single middle row exists, so that is what is used.)
//
// Like the item float this publishes CSS custom properties rather than writing
// el.style.transform, which matters on the grid: the discard fly-out sets an
// INLINE transform, and an inline style beats a stylesheet declaration — so the
// fly-out keeps working with no special-casing. .card.removing (transform with
// !important) and the .card.score-pop-* keyframes likewise still win.
// ══════════════════════════════════════════════════════════════════════════

const HB_DEFAULTS = {
  dx: 1.5,        // px, pushed away from the origin (rightward)
  dy: 5,          // px of lift
  rot: 0.25,      // degrees
  scale: 3,       // % scale pulse
  period: 5,      // seconds between heartbeats
  beat: 260,      // ms — length of one beat's envelope
  gap: 190,       // ms — lub → dub spacing
  beat2: 0.72,    // second beat's share of the amplitude
  colStagger: 110, // ms per column away from the left edge
  rowStagger: 55,  // ms per row away from the middle
};
let HB_CFG = { ...HB_DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem('hbCfg') || 'null');
  if (saved && typeof saved === 'object') HB_CFG = { ...HB_DEFAULTS, ...saved };
} catch (e) {}

let hbEnabled = localStorage.getItem('hbEnabled') !== 'false';
function saveHbCfg()  { try { localStorage.setItem('hbCfg', JSON.stringify(HB_CFG)); } catch (e) {} }
function setHbParam(k, v) { if (k in HB_CFG) { HB_CFG[k] = +v; saveHbCfg(); } }
function resetHbCfg()  { HB_CFG = { ...HB_DEFAULTS }; saveHbCfg(); }
function setHbEnabled(on) {
  hbEnabled = !!on;
  try { localStorage.setItem('hbEnabled', hbEnabled ? 'true' : 'false'); } catch (e) {}
  if (hbEnabled) startHeartbeat(); else stopHeartbeat();
}

// Distance (in rows) from the grid's middle row, or from the nearer of the two
// centre rows when the row count is even.
function hbRowDist(r, rows) {
  if (rows % 2) return Math.abs(r - (rows - 1) / 2);
  return Math.min(Math.abs(r - (rows / 2 - 1)), Math.abs(r - rows / 2));
}

// One beat's envelope: a single smooth hump, 0 → 1 → 0 across HB_CFG.beat ms.
function hbEnvelope(msSinceStart) {
  if (msSinceStart < 0 || msSinceStart > HB_CFG.beat) return 0;
  return Math.sin(Math.PI * (msSinceStart / HB_CFG.beat));
}

// Combined lub-dub for one card, given how far into the cycle it is.
function hbAmplitude(tInCycle, delay) {
  const a = hbEnvelope(tInCycle - delay);
  const b = hbEnvelope(tInCycle - delay - HB_CFG.gap) * HB_CFG.beat2;
  return Math.max(a, b);
}

let _hbRAF = null;
const HB_SEL = '#grid .card, #grid .trick-card';

function heartbeatRunning() { return _hbRAF !== null; }

function startHeartbeat() {
  stopHeartbeat();
  if (!hbEnabled) return;
  function loop(ms) {
    const periodMs = Math.max(500, HB_CFG.period * 1000);
    const t = ms % periodMs;
    const rows = (typeof gridRows === 'number' && gridRows) ? gridRows : 4;
    document.querySelectorAll(HB_SEL).forEach(el => {
      const r = +el.dataset.row, c = +el.dataset.col;
      if (isNaN(r) || isNaN(c)) return;
      const rowDist = hbRowDist(r, rows);
      const delay = c * HB_CFG.colStagger + rowDist * HB_CFG.rowStagger;
      const e = hbAmplitude(t, delay);
      if (e <= 0.0005) {
        if (el._hbOn) { hbClearEl(el); el._hbOn = false; }
        return;
      }
      el._hbOn = true;
      // Rows above the middle fan one way, rows below the other, so the wave
      // reads as spreading out from the centre rather than everything nodding.
      // (rows-1)/2 is the exact centre line for both odd and even row counts.
      const side = Math.sign(r - (rows - 1) / 2);
      el.style.setProperty('--hbx', (HB_CFG.dx * e).toFixed(2) + 'px');
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
