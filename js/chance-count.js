// ═══════════════════════════════════════════════════════════════════════════
// CHANCE COUNTS (r624) - how many times a chance Trick went off, on its chip
// ═══════════════════════════════════════════════════════════════════════════
// Owner: "for tricks that have a chance to go off, a little number on them that
// increments each time it succeeds, lasts during the preview, and stays for 3
// seconds after the hand finishes scoring. If another hand plays before it
// fades, it resets to 0 and starts over."
//
// The count is the Trick's proc count from the last calcScore (`_lastHandProcs`,
// js/combos-aim.js): the preview's while a hand is selected, the banked hand's
// from the moment PLAY is pressed until CC_HOLD_MS after the tally ends. A new
// selection or a new hand replaces it. Only Tricks in CHANCE_TRICK_IDS wear a
// count; the rest of the tray is untouched.
const CHANCE_TRICK_IDS = new Set(['ripple', 'rowcol_retrigger', 'wait_for_it', 'even_better']);
const CC_HOLD_MS = 3000;
let _ccHold = null;   // { counts, until }: the banked hand's counts; until is Infinity while the tally runs

function chanceCountPaint() {
  const list = document.getElementById('trick-tray-list');
  if (!list) return;
  // The tally itself holds no board flag; its abort controller is up while it runs.
  const busy = (typeof animating !== 'undefined' && animating) || (typeof falling !== 'undefined' && falling)
    || (typeof danceAbortController !== 'undefined' && !!danceAbortController);
  let counts;
  if (_ccHold) {
    if (_ccHold.until === Infinity && !busy) _ccHold.until = performance.now() + CC_HOLD_MS;   // the tally is over: start the hang
    if (performance.now() < _ccHold.until) counts = _ccHold.counts; else _ccHold = null;
  }
  if (!counts) counts = (typeof selected !== 'undefined' && selected.length >= 2 && typeof _lastHandProcs !== 'undefined') ? _lastHandProcs : {};
  list.querySelectorAll('.trick-tray-chip').forEach(chip => {
    const id = chip.dataset.trickId;
    if (!CHANCE_TRICK_IDS.has(id)) return;
    const n = counts[id] || 0;
    let b = chip.querySelector('.ch-count');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.className = 'ch-count'; chip.appendChild(b); }
    if (b.textContent !== String(n)) { b.textContent = n; b.classList.remove('ch-bump'); void b.offsetWidth; b.classList.add('ch-bump'); }
  });
}
// PLAY banks the hand: its counts hold through the tally and CC_HOLD_MS after.
// playHand is wrapped rather than edited: the banked calcScore runs inside it,
// and handsPlayed goes up on the call only when a hand is really scored.
(function () {
  if (typeof playHand !== 'function' || playHand._ccWrapped) return;
  const orig = playHand;
  const wrapped = function () {
    const before = typeof handsPlayed !== 'undefined' ? handsPlayed : 0;
    const out = orig.apply(this, arguments);
    if (typeof handsPlayed !== 'undefined' && handsPlayed > before && typeof _lastHandProcs !== 'undefined') {
      _ccHold = { counts: Object.assign({}, _lastHandProcs), until: Infinity };
      chanceCountPaint();
    }
    return out;
  };
  wrapped._ccWrapped = true;
  playHand = wrapped;
  setInterval(chanceCountPaint, 250);   // the tray is rebuilt by many hands; the hang ends on a clock
})();
