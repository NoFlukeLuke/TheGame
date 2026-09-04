const FOCUS_THRESHOLD = 10; // nodes per charge (tick spacing + charge colors)
// Max Focus is measured in raw NODES (was "charges × 10"). Base 30 (= old 3×10),
// hard cap 100. The effective cap = shop Focus Cap limit (base) + permanent per-game
// accumulations (focusCapPerm: Expanse / Quick Draw / the little guys / Life Lessons /
// Core Memories) + live conditional bonuses (Stimulants knack, Power Cell / Slow Burn on grid).
const FOCUS_CAP_HARD = 100;
let focusCapBase = 30;   // set from the Focus Cap shop limit at round/game start
let focusCapPerm = 0;    // permanent per-game accumulations (reset on new game)
function onGridSleightCapBonus() {
  if (typeof gridData === 'undefined' || !gridData) return 0;
  let n = 0;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._isSleight) continue;
    if (cd.sleightId === 'power_cell') n += BAL.power_cell.focus_cap;             // +max Focus while on grid
    if (cd.sleightId === 'slow_burn')  n += Math.floor((cd._slowBurnSecs || 0) / 60); // +1 per minute on grid
  }
  return n;
}
function focusCapNodes() {
  const stim = (typeof hasKnack === 'function' && hasKnack('stimulants')) ? 10 : 0;
  // Trade Winds trades ceiling for income: −10 max Focus, floored at one threshold so
  // the meter is always usable.
  const trade = (typeof hasKnack === 'function' && hasKnack('trade_winds')) ? -BAL.trade_winds.cap_reduction : 0;
  // Growth Spurt permanently erodes the ceiling as you repeatedly max (see onFocusMaxed).
  const gs = (typeof growthSpurtCapPenalty === 'number') ? growthSpurtCapPenalty : 0;
  const cap = focusCapBase + focusCapPerm + stim + trade - gs + onGridSleightCapBonus();
  return Math.min(FOCUS_CAP_HARD, Math.max(FOCUS_THRESHOLD, cap));
}
const FOCUS_COLORS  = ['#54af88','#3a8fbf','#7a50c0','#9a30d0'];

// Focus-gauge feel (tuned in the LETHE gauge mockup, r97).
//   jitter: bar vibrates as it fills - OFF at/below ×1.0, ramps to jitterMaxPx at full
//           along jitterCurve (<1 = climbs fast early then eases → noticeable sooner),
//           and shakes faster the fuller it gets. Respects prefers-reduced-motion.
//   glow:   fill-scaled bloom around the bar, subtle early, up to glowMaxPx at full.
const FOCUS_FX = {
  jitterMaxPx: 5.5,   // amplitude at full fill
  jitterCurve: 0.60,  // ramp shape (<1 = sooner)
  glowMaxPx:   60,    // glow blur at full fill
  glowCurve:   1.3,   // glow ramp (>1 = subtle early)
};
let lastCalcMult   = 0;   // set by calcScore so playHand can generate focus from it
let lastCalcFocus  = 1;   // focus multiplier applied to the last scored hand (FOCUS box) - POST-hand value
let lastPreHandFocus = 1; // focus multiplier when the hand STARTED scoring - the FOCUS box's dance-start value
let lastPreFocusMult = 0; // mult before focus multiplier applied - used by score dance
let focusNodeEls    = [];  // bottom=index 0, top=index 9 (10 per active segment)
let focusAnimQueue  = [];  // pending node indices to animate
let focusAnimRunning = false;

// Focus decay
// Base interval is the dev-tunable starting point. Live focusDecayIntervalMs is computed
// from base + active bonuses (e.g. Meditation adds 1000ms). recomputeFocusDecayInterval()
// updates it and restarts the timer if running.
let focusDecayBaseMs     = parseFloat(localStorage.getItem('focusDecayBaseMs')) || 2000;
let focusDecayIntervalMs = focusDecayBaseMs;
let focusDecayTimerId    = null;   // setInterval id
let focusDecayBuffer     = 0;      // grace ticks held while sitting on a whole-number (x.0) multiplier
let focusBeatDurationMs  = parseFloat(localStorage.getItem('focusBeatDurationMs')) || 300;

// ══════════════════════════════════════════════
// SCORING MODEL (dev-tunable, r179)
// ══════════════════════════════════════════════
// Three ways a hand type can be worth something, switchable in the dev panel so
// they can be played against each other rather than argued about.
//
//   classic     the shipped table. Each hand type has its own base pips AND its
//               own mult, both from HAND_BASE.
//   mult_ladder base pips are 0 for every hand, so ALL pips come from the cards
//               you actually picked. Hand type still pays immediately, through
//               the mult ladder. This is the real differentiator from the games
//               this resembles, where the hand's flat bonus dominates early and
//               the cards barely register.
//   hand_size   base pips 0 AND mult = the number of cards in the hand. Hand
//               type then affects the immediate score not at all: it is only
//               worth the Focus it gives. Most different, and the most likely to
//               flatten the decision, since 5 cards always beats 4.
//
// Every read of the hand's pips/mult goes through handBasePips/handBaseMult, so
// a model applies everywhere at once: the scorer, findBestHand's comparisons,
// the payout breakdown and the RECORDS Hands tab.
const SCORING_MODELS = ['classic', 'mult_ladder', 'hand_size'];
let scoringModel = localStorage.getItem('scoringModel') || 'classic';
if (!SCORING_MODELS.includes(scoringModel)) scoringModel = 'classic';

// Natural Scaling (r190) rides BOTH of these rather than patching calcScore,
// so it applies under either scoring model and the RECORDS Hands tab - which
// calls the same two functions - quotes the earned value with no extra work.
function handBasePips(handName) {
  const b = (typeof HAND_BASE !== 'undefined') && HAND_BASE[handName];
  if (!b) return 0;
  const ns = (typeof naturalScaleBonus === 'function') ? naturalScaleBonus(handName).pips : 0;
  return (scoringModel === 'classic' ? b.pips : 0) + ns;
}
// cellCount is the size of the hand being scored. Only hand_size reads it, and
// it falls back to the table when a caller has no cells (the Hands tab lists
// values with no hand in play, so it shows the ladder's mult there).
function handBaseMult(handName, cellCount) {
  const b = (typeof HAND_BASE !== 'undefined') && HAND_BASE[handName];
  if (!b) return 0;
  const ns = (typeof naturalScaleBonus === 'function') ? naturalScaleBonus(handName).mult : 0;
  if (scoringModel !== 'hand_size') return b.mult + ns;
  return ((typeof cellCount === 'number' && cellCount > 0) ? cellCount : b.mult) + ns;
}

// Speed bonus formula state (dev-tunable). Persisted to localStorage.
let focusSpeedFormula = localStorage.getItem('focusSpeedFormula') || 'linear';
let focusSpeedParams = JSON.parse(localStorage.getItem('focusSpeedParams') || 'null') || {
  linear:      { max_bonus: 12, slope: 1.5 },
  stepped:     { t1: 2, bonus1: 6, t2: 5, bonus2: 2 },
  exponential: { max_bonus: 8 },
};

function recomputeFocusDecayInterval() {
  let ms = focusDecayBaseMs;
  if (typeof hasTrick === 'function' && hasTrick('meditation')) ms += 1000;
  focusDecayIntervalMs = ms;
  if (focusDecayTimerId !== null) {
    clearInterval(focusDecayTimerId);
    focusDecayTimerId = setInterval(focusDecayTick, focusDecayIntervalMs);
  }
}

// Hand-type focus contribution table
// Focus tracks the same difficulty order as HAND_BASE (see the note there):
// flushes cheapest, runs dearest, sets in between.
const HAND_FOCUS = {
  'Pair': 1,
  'Two Pair': 2,
  'Run of 3': 2,
  'Run of 4': 3,
  'Straight': 4,
  'Flush of 3': 1,
  'Flush of 4': 2,
  'Flush': 3,
  'Three of a Kind': 3,
  'Full House': 4,
  'Four of a Kind': 6,
  'Straight Flush': 8,
  'Royal Flush': 9,
  'Five of a Kind': 10,
  'Flush Five': 12,
  'Flush House': 14,
};

// Speed bonus formula - dev-tunable. Three formulas, params held in focusSpeedParams.
// t = seconds since last play; returns extra focus (pre-floor).
function speedBonusFromTime(t) {
  if (t === Infinity || t < 0) t = 0;
  const p = focusSpeedParams[focusSpeedFormula] || {};
  if (focusSpeedFormula === 'linear') {
    return Math.max(0, (p.max_bonus ?? 12) - (p.slope ?? 1.5) * t);
  }
  if (focusSpeedFormula === 'stepped') {
    const t1 = p.t1 ?? 2, b1 = p.bonus1 ?? 6, t2 = p.t2 ?? 5, b2 = p.bonus2 ?? 2;
    if (t < t1) return b1;
    if (t < t2) return b2;
    return 0;
  }
  if (focusSpeedFormula === 'exponential') {
    if (t <= 0) return p.max_bonus ?? 8;
    return Math.floor((p.max_bonus ?? 8) / t);
  }
  return 0;
}

// ── Focus RATE (r180) ────────────────────────────────────────────────────────
// Every Focus entity before this raised the CEILING (focusCapNodes). Nothing
// touched how fast Focus accrues, which is the term that actually multiplies a
// run's output - the cap only decides where it stops.
//
// generateHandFocus builds Focus from two terms, and these are the two knobs:
//   complexity - HAND_FOCUS[hand], what the hand itself is worth
//   speed      - speedBonusFromTime(t), how fast you played after the last hand
//   window     - a DILATION on t: window 2 reads the clock as half-speed, so you
//                get the same speed bonus with twice as long to play. Distinct
//                from `speed`, which pays more for the same timing.
// Each is a product, so several entities stack multiplicatively.
function focusRateMods() {
  const m = { complexity: 1, speed: 1, window: 1 };
  // Red Tape (reward-grid penalty) divides `complexity`, so it scales down the
  // hand's own Focus value and leaves the speed bonus alone. That is the harsher
  // of the two on purpose: speed is something you can play around by hurrying,
  // whereas the hand's listed Focus is the floor you cannot out-run.
  if (typeof focusRatePenalty === 'number' && focusRatePenalty > 1) m.complexity /= focusRatePenalty;
  if (typeof hasTrick === 'function') {
    if (hasTrick('overclock'))     m.speed      *= BAL.overclock.speed_mult;
    if (hasTrick('second_nature')) m.complexity *= BAL.second_nature.complexity_mult;
  }
  if (typeof hasKnack === 'function') {
    if (hasKnack('long_fuse')) m.window     *= BAL.long_fuse.window_mult;
    if (hasKnack('shorthand')) m.complexity *= BAL.shorthand.complexity_mult;
  }
  // Sleights work by SITTING on the grid, so they are scanned rather than owned.
  // Quarantined/void cells are excluded the same way every other "while on the
  // grid" trigger excludes them.
  if (typeof gridData !== 'undefined' && gridData) {
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
      const cd = gridData[r]?.[c];
      if (!cd || !cd._isSleight) continue;
      if (typeof cellCountsForTriggers === 'function' && !cellCountsForTriggers(r, c)) continue;
      if (cd.sleightId === 'flywheel') m.speed  *= BAL.flywheel.speed_mult;
      if (cd.sleightId === 'governor') m.window *= BAL.governor.window_mult;
    }
  }
  return m;
}


// Current focus multiplier: x1.0 until `focusMultStartNodes`, then + per node.
// These are separate tunables rather than FOCUS_THRESHOLD itself, because that
// constant also sets the meter's node colouring and charge spacing - retuning
// the multiplier should not redraw the bar.
let focusMultStartNodes = parseFloat(localStorage.getItem('focusMultStartNodes'));
if (!isFinite(focusMultStartNodes)) focusMultStartNodes = FOCUS_THRESHOLD;
let focusMultPerNode = parseFloat(localStorage.getItem('focusMultPerNode'));
if (!isFinite(focusMultPerNode)) focusMultPerNode = 0.1;

function focusMultiplier() {
  return 1 + Math.max(0, focusNodes - focusMultStartNodes) * focusMultPerNode;
}
let lastCalcPips   = 0;   // set by calcScore for animation

let leaves = 0;
let handsPlayed = 0;
let discards = 4;
let swaps = 3;

// ── LIMITS SYSTEM ──
// Each limit has a current value, a base (starting) value, and a max cap.
// Incrementing via Limit Break event or shop raises `current` by 1 up to `max`.
// The game reads limits.X.current wherever it previously used a hard-coded cap.
// hideMax: don't surface the max anywhere in UI (limit feels "open-ended").
// `weight` (default 1) sets how often a limit is offered in the shop / Limit
// Break / reward-grid limit tiles - lower = rarer. Picked via pickWeightedLimits.
// Grid rows/cols also drive the REWARD grid's shape (reward grid = play grid).
