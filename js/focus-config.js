const FOCUS_THRESHOLD = 10; // nodes per charge
let focusCapacity   = 3;   // max charges (modifiable by Expanse bonus)
const FOCUS_COLORS  = ['#54af88','#3a8fbf','#7a50c0','#9a30d0'];
let lastCalcMult   = 0;   // set by calcScore so playHand can generate focus from it
let lastCalcFocus  = 1;   // focus multiplier applied to the last scored hand (FOCUS box) — POST-hand value
let lastPreHandFocus = 1; // focus multiplier when the hand STARTED scoring — the FOCUS box's dance-start value
let lastPreFocusMult = 0; // mult before focus multiplier applied — used by score dance
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
const HAND_FOCUS = {
  'Pair': 1,
  'Two Pair': 1,
  'Run of 3': 1,
  'Run of 4': 2,
  'Straight': 3,
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

// Speed bonus formula — dev-tunable. Three formulas, params held in focusSpeedParams.
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

// Current focus multiplier: 1.0 until 10 nodes, then +0.1 per node above 10
function focusMultiplier() {
  return 1 + Math.max(0, focusNodes - FOCUS_THRESHOLD) * 0.1;
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
// Break / reward-grid limit tiles — lower = rarer. Picked via pickWeightedLimits.
// Grid rows/cols also drive the REWARD grid's shape (reward grid = play grid).
