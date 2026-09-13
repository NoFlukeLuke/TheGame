// ══════════════════════════════════════════════
// GOAL CLEAR PRESENTATION (r197) - js/goal-clear.js + css/goal-clear.css
// ══════════════════════════════════════════════
// Two things happen the instant the score crosses the round goal, and until now
// the game said neither out loud:
//
//   1. THE ROUND IS WON. The only signal was the grid flash in flashRoundEnd()
//      and the score number quietly passing a figure printed somewhere else on
//      the panel. The win finale (jitter -> explode -> fly) plays about two
//      seconds EARLIER, on the hand being played, so by the time the tally
//      actually crosses the line there is nothing marking the moment.
//   2. THE CLOCK STOPS MATTERING. It froze mid-count and just sat there looking
//      like a running round clock for the whole payout.
//
// Both are presentation only. The state is already correct before either of
// these runs, so an abort mid-animation can never strand the run.

// ── The banner ──────────────────────────────────────────────────────────────
// Body-level and position:fixed, placed from JS in raw viewport px - the same
// rule the Time / Limits pop-ups and the hand log follow, because anything
// inside #cabinet inherits its CSS zoom and the coordinates get multiplied.
// It is centred on the GRID rather than the viewport so it lands on the board
// the player is looking at in both orientations with no per-orientation rule.
let _goalBannerTimer = null;

function goalBannerEl() {
  let el = document.getElementById('goal-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'goal-banner';
    el.innerHTML = `<div class="gb-ring"></div>
      <div class="gb-body">
        <div class="gb-kicker">ROUND</div>
        <div class="gb-title">QUOTA CLEARED</div>
        <div class="gb-num" id="goal-banner-num"></div>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

// Wording note: "QUOTA CLEARED" is the owner's explicit call and is a deliberate
// exception to the r178 voice rule that pulled the corporate framing out of every
// player-facing surface. It is the one place the word survives.
//
// Called from flashRoundEnd() - the one place that already means "the tally just
// crossed the goal". Wiring it there rather than at the dance's two call sites
// means both the preview dance and the legacy dance get it, and a future caller
// does too.
// `opts.kicker` replaces the small word above the title - a boss win passes the
// boss's NAME, so the one stamp both marks the clear and says what you beat.
// `opts.force` shows it even in Survival/Flow: their pick-of-three normally opens
// on this same beat carrying its own GOAL CLEARED kicker (two banners in one place
// is one too many), but a boss win there opens the prize grid instead, so there is
// nothing else saying it.
function showGoalBanner(opts) {
  opts = opts || {};
  if (!opts.force && typeof survivalActive === 'function' && survivalActive()) return;
  if (document.body.classList.contains('reduced-motion')) { /* still show it, just no burst */ }

  const el = goalBannerEl();
  const kick = el.querySelector('.gb-kicker');
  if (kick) kick.textContent = opts.kicker || 'ROUND';
  el.classList.toggle('gb-boss', !!opts.kicker);
  const num = document.getElementById('goal-banner-num');
  if (num) num.textContent = (typeof roundGoal === 'number' ? roundGoal.toLocaleString() : '');

  // Centre on the board. Falls back to the viewport centre if the grid has no box
  // (a mode with the board taken over by an overlay).
  const grid = document.getElementById('grid');
  const r = grid ? grid.getBoundingClientRect() : null;
  const cx = (r && r.width) ? r.left + r.width / 2 : window.innerWidth / 2;
  const cy = (r && r.height) ? r.top + r.height / 2 : window.innerHeight / 2;
  el.style.left = cx + 'px';
  el.style.top = cy + 'px';

  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  if (typeof sfxSuccess === 'function') sfxSuccess();

  clearTimeout(_goalBannerTimer);
  _goalBannerTimer = setTimeout(() => el.classList.remove('show'), 1500);
}

function hideGoalBanner() {
  clearTimeout(_goalBannerTimer);
  document.getElementById('goal-banner')?.classList.remove('show');
}

// ── The clock's cleared state ───────────────────────────────────────────────
// The round clock freezes at the goal (the dance tail clears roundInterval and
// sets gameTimerPaused). The NUMBER is kept rather than wound to zero: Carry
// Time banks it, Clock Tower carries it, and a clock that runs itself down after
// you have already won reads as a penalty. What changes is that it stops looking
// like a live countdown - it turns mint and locks, and the bar stops.
//
// Flow is excluded on purpose. Its clock is a SESSION clock counting down to the
// inspection, not a round clock: it does not stop at a goal clear and it is not
// yours to keep, so marking it cleared would be a lie.
function markClockCleared() {
  if (typeof flowActive === 'function' && flowActive()) return;
  document.getElementById('clock')?.classList.add('clock-cleared');
  document.getElementById('clock-bar')?.classList.add('clock-cleared');
  document.getElementById('vclock')?.classList.add('clock-cleared');
  document.getElementById('vclock-fill')?.classList.add('clock-cleared');
}

function clearClockCleared() {
  ['clock', 'clock-bar', 'vclock', 'vclock-fill']
    .forEach(id => document.getElementById(id)?.classList.remove('clock-cleared'));
}

// One entry point, so a new goal-clear path only has to call this.
function goalClearPresent(opts) {
  showGoalBanner(opts);
  markClockCleared();
}
