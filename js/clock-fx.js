// ══════════════════════════════════════════════════════════════════════════
// CLOCK FX (r183) - everything the round clock does to the board.
//
// Three effects, all of them driven by the clock rather than by scoring:
//
//  1. THE TICK.  Every time the grid heartbeat starts a new wave (once every
//     HB_CFG.period seconds, 10 by default), the timer gives one gentle swell
//     and a quiet clock tick plays. The board's wave and the clock are the same
//     beat, so the room has a pulse instead of two unrelated animations.
//
//  2. THE FREEZE.  Any time the clock is PAUSED - a Trick, a Sleight, the
//     Stopwatch - the timer lights up, a tick-tock plays, and a ripple runs out
//     from the middle of the board rotating every card a few degrees and
//     leaving it there. Cards on the left half turn their outer (left) corner
//     out, cards on the right half turn theirs out, and a dead-centre column
//     alternates row by row so it does not read as a straight line. The board
//     also stops breathing: js/heartbeat.js checks `clockFrozen` and holds
//     whatever offsets the cards had at that instant. When the pause ends the
//     ripple runs again in reverse and the cards settle back.
//
//  3. THE REWIND.  When time is given back, each card spawns two translucent
//     copies stacked directly beneath it - an infinity mirror - and a reversed
//     swell plays. When the effect ends the copies rise back INTO the card they
//     came from, which is what makes it read as "that already happened".
//
// All three are CSS custom properties or throwaway clone elements, never
// el.style.transform on a live card: the discard fly-out sets an inline
// transform and .card.removing sets an !important one, and both still win.
// ══════════════════════════════════════════════════════════════════════════

const CARD_SEL = '#grid .card, #grid .trick-card';

function clockFxReduced() { return document.body.classList.contains('reduced-motion'); }

// ── 1. The tick that rides the heartbeat wave ────────────────────────────────
// Called by js/heartbeat.js the frame a new wave starts. Silent and still while
// anything has the game suspended (menus, shop, payout), and while the clock is
// frozen - a paused clock has its own, louder, sound.
function pulseClockWithWave() {
  if (typeof gameTimerPaused !== 'undefined' && gameTimerPaused) return;
  if (clockFrozen) return;
  if (typeof roundEnded !== 'undefined' && roundEnded) return;
  ['clock', 'vclock'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('clock-wave');
    void el.offsetWidth;              // restart the animation even if it is mid-flight
    el.classList.add('clock-wave');
    setTimeout(() => el.classList.remove('clock-wave'), 1000);
  });
  if (typeof sfxClockTick === 'function') sfxClockTick();
}

// ── 2. The pause freeze ──────────────────────────────────────────────────────
let clockFrozen   = false;
let _frzAngles    = {};    // "r-c" → the degrees that card is being held at
let _frzTimers    = [];    // the ripple's pending setTimeouts, so a fast un-pause can cancel them

// How far a card is from the middle of the board, in cells. The ripple is timed
// off this, so it spreads out from the centre rather than sweeping one way.
function _frzRipple(r, c) {
  const rows = (typeof gridRows === 'number' && gridRows) ? gridRows : 4;
  const cols = (typeof gridCols === 'number' && gridCols) ? gridCols : 4;
  const dr = r - (rows - 1) / 2, dc = c - (cols - 1) / 2;
  return Math.hypot(dr, dc);
}

// Which way this card turns, and how far.
//   left half  → negative (its left corner swings out)
//   right half → positive (its right corner swings out)
//   dead centre column → alternates by row so the middle never lines up
const FRZ_DEG = 3.2;
function _frzAngle(r, c) {
  const cols = (typeof gridCols === 'number' && gridCols) ? gridCols : 4;
  const mid  = (cols - 1) / 2;
  let dir;
  if (c < mid)      dir = -1;
  else if (c > mid) dir =  1;
  else              dir = (r % 2 === 0) ? -1 : 1;   // exact centre column: alternate
  // Cards further from the centre lean a touch harder, so the freeze fans out.
  const lean = 0.62 + 0.38 * (Math.abs(c - mid) / Math.max(1, mid));
  return dir * FRZ_DEG * lean;
}

function _frzSet(el, deg) {
  el.classList.add('clock-frozen');
  el.style.setProperty('--frzr', deg.toFixed(2) + 'deg');
}
function _frzClear(el) {
  el.style.setProperty('--frzr', '0deg');
  // Let the ease-out finish before dropping the transition class.
  setTimeout(() => { el.classList.remove('clock-frozen'); el.style.removeProperty('--frzr'); }, 420);
}
function _frzCancelTimers() { _frzTimers.forEach(clearTimeout); _frzTimers = []; }

// The clock has just been paused (or frozen by a Stopwatch). Safe to call again
// while already frozen - an extended pause must not re-run the ripple.
function beginClockFreeze() {
  if (clockFrozen) return;
  clockFrozen = true;
  document.getElementById('clock')?.classList.add('clock-frozen-lit');
  document.getElementById('vclock')?.classList.add('clock-frozen-lit');
  if (typeof sfxTickTock === 'function') sfxTickTock();
  if (clockFxReduced()) return;      // the light and the sound stay; the board does not turn
  _frzCancelTimers();
  _frzAngles = {};
  document.querySelectorAll(CARD_SEL).forEach(el => {
    const r = +el.dataset.row, c = +el.dataset.col;
    if (isNaN(r) || isNaN(c)) return;
    const deg = _frzAngle(r, c);
    _frzAngles[r + '-' + c] = deg;
    _frzTimers.push(setTimeout(() => _frzSet(el, deg), _frzRipple(r, c) * 55));
  });
}

// The clock is running again. The ripple runs a second time, outward from the
// centre as before, so the board unwinds the way it wound up.
function endClockFreeze() {
  if (!clockFrozen) return;
  clockFrozen = false;
  document.getElementById('clock')?.classList.remove('clock-frozen-lit');
  document.getElementById('vclock')?.classList.remove('clock-frozen-lit');
  _frzCancelTimers();
  document.querySelectorAll(CARD_SEL).forEach(el => {
    const r = +el.dataset.row, c = +el.dataset.col;
    const d = (isNaN(r) || isNaN(c)) ? 0 : _frzRipple(r, c) * 45;
    _frzTimers.push(setTimeout(() => _frzClear(el), d));
  });
  // Cards dealt in while frozen are not in the loop above; sweep the rest clean.
  _frzTimers.push(setTimeout(() => {
    document.querySelectorAll('.clock-frozen').forEach(el => {
      el.classList.remove('clock-frozen'); el.style.removeProperty('--frzr');
    });
    _frzAngles = {};
  }, 900));
}

// render() rebuilds and reuses card elements, so a card that fell in during a
// freeze arrives untilted. Called at the end of render() to put it in line.
function reapplyClockFreeze() {
  if (!clockFrozen || clockFxReduced()) return;
  document.querySelectorAll(CARD_SEL).forEach(el => {
    const r = +el.dataset.row, c = +el.dataset.col;
    if (isNaN(r) || isNaN(c)) return;
    const key = r + '-' + c;
    if (_frzAngles[key] === undefined) _frzAngles[key] = _frzAngle(r, c);
    _frzSet(el, _frzAngles[key]);
  });
}

// Hard reset - a new round or a new game must never inherit a frozen board.
function resetClockFx() {
  _frzCancelTimers();
  clockFrozen = false;
  _frzAngles = {};
  document.getElementById('clock')?.classList.remove('clock-frozen-lit', 'clock-wave');
  document.getElementById('vclock')?.classList.remove('clock-frozen-lit', 'clock-wave');
  document.querySelectorAll('.clock-frozen').forEach(el => {
    el.classList.remove('clock-frozen'); el.style.removeProperty('--frzr');
  });
  clearRewindMirror();
}

// ── 3. The rewind mirror ─────────────────────────────────────────────────────
// Two translucent copies per card, stacked straight down like an infinity
// mirror, then absorbed back up into the original. The copies are clones with
// their ids and data stripped: nothing on the board is moved or re-rendered, so
// a rewind landing mid-fall cannot disturb the fall.
const REWIND_COPIES = 2;
const REWIND_HOLD   = 620;     // ms the mirror is held before it absorbs
let _rwTimers = [];

function clearRewindMirror() {
  _rwTimers.forEach(clearTimeout); _rwTimers = [];
  document.querySelectorAll('.rewind-ghost').forEach(el => el.remove());
  document.getElementById('grid')?.classList.remove('rewinding');
}

function playRewindFX() {
  if (typeof sfxRewind === 'function') sfxRewind();
  if (clockFxReduced()) return;
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  clearRewindMirror();
  const cards = [...gridEl.querySelectorAll(CARD_SEL)];
  if (!cards.length) return;
  const ghosts = [];
  cards.forEach(src => {
    const h = src.offsetHeight || 75;
    for (let i = 1; i <= REWIND_COPIES; i++) {
      const g = src.cloneNode(true);
      g.className = src.className.replace(/\bselected\b/g, '') + ' rewind-ghost';
      g.removeAttribute('id');
      g.removeAttribute('data-card-id');
      g.removeAttribute('data-row');
      g.removeAttribute('data-col');
      // Each copy sits a little further down, fainter and slightly smaller, so
      // the stack recedes. Kept TIGHT on purpose: at a bigger drop the copies
      // reach the row below and the board reads as columns of cards rather than
      // one card with its own reflections under it.
      g.style.setProperty('--rw-drop', (h * 0.13 * i).toFixed(1) + 'px');
      g.style.setProperty('--rw-fade', (0.30 / i).toFixed(3));
      g.style.setProperty('--rw-shrink', (1 - 0.055 * i).toFixed(3));
      g.style.setProperty('--rw-blur', (0.5 * i).toFixed(2) + 'px');
      g.style.zIndex = String(2 - i);   // 1 then 0; real cards are lifted to 3 below
      gridEl.appendChild(g);
      ghosts.push(g);
    }
  });
  // The ghosts are appended last, so without this they would paint OVER the real
  // card in the row below them. .rewinding lifts every live card above them for
  // the length of the effect and is taken off again with them.
  gridEl.classList.add('rewinding');
  // One frame later the copies slide out to their offsets; the class change has
  // to land after they are in the DOM or the transition has nothing to run from.
  requestAnimationFrame(() => ghosts.forEach(g => g.classList.add('out')));
  // Absorb: back to zero offset and zero opacity, i.e. up into the original.
  _rwTimers.push(setTimeout(() => ghosts.forEach(g => g.classList.remove('out')), REWIND_HOLD));
  _rwTimers.push(setTimeout(() => {
    ghosts.forEach(g => g.remove());
    gridEl.classList.remove('rewinding');
  }, REWIND_HOLD + 460));
}
