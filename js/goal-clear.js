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
        <div class="gb-title"></div>
        <div class="gb-num" id="goal-banner-num"></div>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

// Wording note: the title is WRITTEN PER SHOW from lexTerm('goal'), never baked
// into the markup goalBannerEl() caches - the element outlives a wording change,
// so a title set at build time would keep whichever vocabulary was live the first
// time a round was cleared. r293 flipped this from a hardcoded QUOTA CLEARED; a
// hardcoded GOAL CLEARED is the same bug pointing the other way.
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
// r680 (owner): in console mode the banner is a command line ON THE GRID: a strip
// across the board's middle (a child of #grid, like the boss jump's OSD), typing
// "> GOAL CLEARED  1,500" (or the boss's name over it). It leaves the way the
// board screens do. The body-level banner below stays for the other skins.
let _gbGridTimer = null;
function goalBannerGrid(opts) {
  const grid = document.getElementById('grid'); if (!grid) return false;
  let el = document.getElementById('gb-grid');
  if (!el) { el = document.createElement('div'); el.id = 'gb-grid'; grid.appendChild(el); }
  else if (el.parentElement !== grid) grid.appendChild(el);
  const goalWord = (typeof lexTerm === 'function') ? lexTerm('goal') : 'GOAL';
  const num = (typeof roundGoal === 'number') ? roundGoal.toLocaleString() : '';
  el.className = opts.kicker ? 'gb-boss' : '';
  el.innerHTML = `<div class="gbg-k">${opts.kicker ? opts.kicker : 'ROUND'}</div><div class="gbg-l">&gt; ${goalWord} CLEARED${num ? '  ' + num : ''}</div>`;
  const line = el.querySelector('.gbg-l');
  if (typeof bsType === 'function') bsType(line, {});
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(_gbGridTimer);
  _gbGridTimer = setTimeout(() => el.classList.remove('show'), 1700);
  return true;
}
function showGoalBanner(opts) {
  opts = opts || {};
  if (!opts.force && typeof survivalActive === 'function' && survivalActive()) return;
  if (typeof trayMachineOn === 'function' && trayMachineOn() && goalBannerGrid(opts)) {
    if (typeof sfxSuccess === 'function') sfxSuccess();
    return;
  }
  if (document.body.classList.contains('reduced-motion')) { /* still show it, just no burst */ }

  const el = goalBannerEl();
  const kick = el.querySelector('.gb-kicker');
  if (kick) kick.textContent = opts.kicker || 'ROUND';
  const ttl = el.querySelector('.gb-title');
  if (ttl) ttl.textContent = ((typeof lexTerm === 'function') ? lexTerm('goal') : 'GOAL') + ' CLEARED';
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
  clearTimeout(_goalBannerTimer); clearTimeout(_gbGridTimer);
  document.getElementById('gb-grid')?.classList.remove('show');
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
