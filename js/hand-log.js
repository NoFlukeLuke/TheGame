// ══════════════════════════════════════════════
// HAND LOG  (r160)
// ══════════════════════════════════════════════
// A running record of every hand played this run - what it was, which cards made
// it, and what it scored - surfaced by hovering (or long-pressing) the SCORE box.
//
// The score readout answers "where am I"; it never answered "how did I get here".
// That question comes up constantly mid-round - whether the last Trick actually
// paid, whether a Flush is worth chasing at this Focus, why the total jumped -
// and until now the only record was the payout screen, which arrives after the
// decision it would have informed.
//
// Why the log is written in playHand and not in the dance: the dance is a
// PRESENTATION of a score that has already been computed and added, and it can be
// interrupted, fast-forwarded or cut. The hand is a fact the moment playHand
// commits it, so that is where it is recorded.
//
// The popup lives OUTSIDE #cabinet in index.html for the usual reason: it is
// position:fixed and placed from JS in raw viewport pixels, and inside the stage
// the cabinet's CSS `zoom` multiplies those coordinates.

const HAND_LOG_MAX  = 60;   // entries kept (a long run would otherwise grow forever)
const HAND_LOG_SHOW = 14;   // entries rendered in the popup

let handLog = [];

// Record one played hand. `cells` is the winning hand's grid cells, read for the
// card faces BEFORE removeAndFall clears them.
function logPlayedHand(hand, cells, finalScore, opts) {
  const o = opts || {};
  const faces = (cells || []).map(([r, c]) => {
    const card = gridData?.[r]?.[c];
    if (!card) return '?';
    if (card._isSleight) return '★';
    if (card._isStone)   return '▪';
    return (card.rank || '') + (card.suit || '');
  });
  handLog.push({
    n:     handLog.length + 1,
    hand:  hand,
    score: Math.round(finalScore || 0),
    cards: faces,
    level: (typeof level === 'number') ? level : 0,
    boss:  !!o.boss,
    src:   o.src || 'play',
  });
  if (handLog.length > HAND_LOG_MAX) handLog.shift();
  // Keep an open popup live rather than showing a stale list.
  if (document.getElementById('hand-log-popup')?.classList.contains('show')) renderHandLog();
}

// The one caller that has to take a hand back: playHand's post-goal guard, which
// unwinds a hand submitted after the goal was already met.
function unlogLastHand() { handLog.pop(); }

function resetHandLog() { handLog = []; hideHandLogPopup(); }

function renderHandLog() {
  const body = document.getElementById('hand-log-rows');
  if (!body) return;
  if (!handLog.length) {
    body.innerHTML = '<div class="hl-empty">No hands played yet this run.</div>';
    return;
  }
  const shown = handLog.slice(-HAND_LOG_SHOW).reverse();   // newest first
  let html = '';
  let prevLevel = null;
  shown.forEach(e => {
    // A round boundary is worth marking: scores reset to zero each round, so two
    // adjacent rows from different rounds are not comparable as progress.
    if (prevLevel !== null && e.level !== prevLevel) html += `<div class="hl-sep">Round ${prevLevel}</div>`;
    prevLevel = e.level;
    html += `<div class="hl-r${e.boss ? ' hl-boss' : ''}">` +
              `<span class="hl-name">${e.hand}</span>` +
              `<span class="hl-cards">${e.cards.map(f => `<i class="${_hlSuitClass(f)}">${f}</i>`).join('')}</span>` +
              `<span class="hl-score">${e.score.toLocaleString()}</span>` +
            `</div>`;
  });
  const best = handLog.reduce((b, e) => e.score > b.score ? e : b, handLog[0]);
  html += `<div class="ic-sep"></div>` +
          `<div class="hl-foot"><span>${handLog.length} hand${handLog.length === 1 ? '' : 's'} this run</span>` +
          `<span>best ${best.score.toLocaleString()}</span></div>`;
  body.innerHTML = html;
}

function _hlSuitClass(face) {
  if (face.includes('♥')) return 'hl-h';
  if (face.includes('♦')) return 'hl-d';
  if (face.includes('♠')) return 'hl-s';
  if (face.includes('♣')) return 'hl-c';
  return 'hl-x';
}

// ── Show / hide ──
function hideHandLogPopup() {
  document.getElementById('hand-log-popup')?.classList.remove('show');
}

function showHandLogPopup() {
  const pop = document.getElementById('hand-log-popup');
  const anchor = document.getElementById('score-center');
  if (!pop || !anchor) return;
  const ar = anchor.getBoundingClientRect();
  if (ar.width < 2) return;                 // score box not on screen (menus, overlays)
  renderHandLog();
  pop.classList.add('show');
  // Same placement rule as the ⏱ Time / ▲ Limits bubbles: centred on the anchor,
  // above it when there's room, flipped below when there isn't, clamped on screen.
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = ar.left + ar.width / 2 - pw / 2;
  let top  = ar.bottom + 8;
  left = Math.max(6, Math.min(window.innerWidth - pw - 6, left));
  if (top + ph > window.innerHeight - 6) top = Math.max(6, ar.top - ph - 8);
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}

function toggleHandLogPopup() {
  const pop = document.getElementById('hand-log-popup');
  if (pop?.classList.contains('show')) hideHandLogPopup(); else showHandLogPopup();
}

// ── Wiring ──
// Mouse hovers; touch long-presses. Both land on the same popup.
// A long-press must not also fire the click that follows it on touch, and a
// scroll/drag started on the score box must cancel the press - hence the move
// threshold rather than a bare timer.
(function wireHandLog() {
  const el = document.getElementById('score-center');
  if (!el) return;
  let pressTimer = null, pressX = 0, pressY = 0, longFired = false;
  const clearPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };

  el.addEventListener('mouseenter', e => { if (e.pointerType !== 'touch') showHandLogPopup(); });
  el.addEventListener('mouseleave', () => { if (!longFired) hideHandLogPopup(); });

  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    longFired = false; pressX = e.clientX; pressY = e.clientY;
    clearPress();
    pressTimer = setTimeout(() => { longFired = true; showHandLogPopup(); }, 420);
  });
  el.addEventListener('pointermove', e => {
    if (!pressTimer) return;
    if (Math.abs(e.clientX - pressX) > 10 || Math.abs(e.clientY - pressY) > 10) clearPress();
  });
  el.addEventListener('pointerup',     () => clearPress());
  el.addEventListener('pointercancel', () => { clearPress(); hideHandLogPopup(); });
  el.addEventListener('click', e => {
    // Suppress the synthetic click that trails a long-press; otherwise the popup
    // opens and immediately toggles shut.
    if (longFired) { longFired = false; e.stopPropagation(); return; }
    e.stopPropagation();
    toggleHandLogPopup();
  });
  // Anything else on screen dismisses it.
  document.addEventListener('click', e => {
    if (!e.target.closest('#score-center') && !e.target.closest('#hand-log-popup')) hideHandLogPopup();
  }, true);
})();
