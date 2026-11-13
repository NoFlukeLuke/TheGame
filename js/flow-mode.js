// ══════════════════════════════════════════════
// FLOW MODE (r164) - the no-clock Survival variant
// ══════════════════════════════════════════════
// A variant of Survival with the ROUND clock removed. There is no per-round time
// limit and no way to fail a round: you clear a goal, take a pick-of-three, and
// immediately get the next (bigger) goal. Level up as many times as you can - then,
// five minutes in, the inspection arrives and you fight a boss with a real objective
// and a real score bar, exactly like the normal game.
//
// The one clock in the mode is the SESSION clock: five minutes of live play counting
// down to that boss. It is deliberately the SAME variable the round clock always
// used (`roundSeconds`), because ~15 sites across the engine measure "how far into
// the round are we" as `roundStartSeconds - roundSeconds` (The Swift, Sediment, the
// Cuckoo, the Woodpecker, First Wind, clock-mark Tricks…). Pin
// `roundSeconds` to a constant instead and every one of those goes silently dead.
// Letting it tick keeps them all working with no per-site changes; the only two
// things that change are what happens at ZERO (boss, not round-over - see the flow
// branch in onRoundEnd) and the fact that a level-up does NOT refill it.
//
// Flow reuses ALL of Survival's plumbing - survivalActive() is true for both modes,
// so the pick-of-three, the on-demand Mart, the boss cadence, the reward grants and
// the 5-boss completion screen all come for free. See js/survival.js.

// Flag-based for the same reason survivalActive() is (r234). Flow is a package
// of its own on top of Survival's, and only the shipped mode carries the flag -
// the picker reproduces the parts it wants through `clock` instead.
function flowActive() { return !!ACTIVE_MODE && ACTIVE_MODE.flow === true; }

// ── Tunables ──
const FLOW_SESSION_SECONDS = 300;  // live play between inspections (the visible clock)
const FLOW_BOSS_WINDOW     = 120;  // the boss's own clock - Flow banks no leftover time
// Max Focus in Flow. With no round clock, Focus DECAY is the only pressure in the
// mode, so the bar is deliberately short: 20 nodes = a ×2.0 ceiling that has to be
// actively held. This is the BASE cap, not a hard ceiling - Expanse, Power Cell,
// Stimulants, Life Lessons &c. still stack on top, so none of those become dead
// picks. Make it a hard cap by clamping in focusCapNodes() instead.
const FLOW_FOCUS_CAP       = 20;

// Entities whose whole effect is about a ROUND CLOCK that Flow does not have. Same
// idea as SURVIVAL_BANNED_ENTITIES (reward-grid-only entities in a mode with no
// reward grid): rather than special-casing each one wherever it fires, keep it out
// of every offer pool so it can never be owned here.
//   first_wind - "no Focus decay for the first 45s of the round". Flow has no round,
//     and its clock starts ABOVE ROUND_DURATION, so the grace window it measures is
//     nonsense here (it would compute negative elapsed and hold decay off for ~165s
//     of every session). Focus decay is Flow's only pressure - a Trick that switches
//     it off is the one thing the mode can't offer.
//   carry_time  - "bank the round's unused seconds". Flow's clock is not reset by a
//     level-up, so the same seconds would be banked again at every level.
const FLOW_BANNED_ENTITIES = new Set(['first_wind', 'carry_time']);

// ── Per-run state ──
let flowBossFighting = false;  // true from the inspection trigger until endBoss resolves
let flowRefillClock  = true;   // consumed by triggerLevelUp: refill the session clock?

// Reset per-run state (called from startGame, alongside survivalInitRun).
function flowInitRun() {
  flowBossFighting = false;
  // FALSE, not true: startGame fills the clock itself (roundSeconds =
  // currentRoundDuration()). Arming it here would make the run's FIRST goal clear
  // hand back a fresh five minutes on top of the ones already on the clock.
  flowRefillClock  = false;
}

// The base max-Focus for the active mode. Flow runs a short bar; every other mode
// takes the Focus Cap limit as before. Upgrades to that limit still apply on top,
// so buying Focus Cap in Flow raises 20 → 21 → 22 rather than snapping to 30.
function flowFocusCapBase() {
  const lim = (typeof limits !== 'undefined' && limits.focus_cap) ? limits.focus_cap : null;
  if (!flowActive()) return lim ? lim.current : 30;
  return FLOW_FOCUS_CAP + (lim ? (lim.current - lim.base) : 0);
}

// True while the session clock is running down toward the inspection (i.e. not
// during the boss itself, which owns the clock and runs its own window).
function flowSessionRunning() { return flowActive() && !bossActive; }

// ══════════════════════════════════════════════
// THE INSPECTION (boss at 0:00)
// ══════════════════════════════════════════════
// Called from onRoundEnd when the session clock hits zero. The boss gets a real
// objective (whatever preset comes up) AND a real score bar: `bossGoalMet()` is
// `score >= roundGoal`, so the quota is set to "what you have now, plus one full
// level's goal". Adding the delta rather than zeroing `score` means no in-progress
// round is thrown away and no state surgery is needed - the bar simply becomes a
// clean "earn this much more, inside the boss window".
// r525 (owner): a Flow boss's goal ignores how many levels were cleared.
// r687 (owner): boss N asks the goal of level FLOW_BOSS_GOAL_LEVELS[N - 1] (was
// 1 + 5N: 6 / 11 / 16 / 21). An Endless boss past the table adds the last step again.
// r754 (owner): the table is 8 / 14 / 20 / 24, and a run already PAST the table's
// level when the review comes is asked its own level's goal instead, and is paid
// FLOW_AHEAD_PAY credits for every level it is ahead (flowBossAheadPay, below).
const FLOW_BOSS_GOAL_LEVELS = [8, 14, 20, 24];
const FLOW_AHEAD_PAY = 10;
// The level the boss table names for the next review (no live-level term).
function flowBossTableLevel() {
  const n = (typeof survivalBossesBeaten === 'number' ? survivalBossesBeaten : 0);
  const t = FLOW_BOSS_GOAL_LEVELS, last = t.length - 1;
  return n <= last ? t[n] : t[last] + (n - last) * (t[last] - t[last - 1]);
}
function flowBossGoalLevel() {
  const lv = (typeof level === 'number' && isFinite(level)) ? level : 1;
  return Math.max(flowBossTableLevel(), lv);
}
// Levels the run is past the review's table level (0 when not ahead).
function flowBossAheadLevels() {
  const lv = (typeof level === 'number' && isFinite(level)) ? level : 1;
  return Math.max(0, lv - flowBossTableLevel());
}
function flowBossAheadPay() {
  const n = flowBossAheadLevels();
  if (!n) return 0;
  const pay = n * FLOW_AHEAD_PAY;
  if (typeof grantEntityCoins === 'function') grantEntityCoins(pay, 'flow_ahead', null); else { coins += pay; if (typeof updateCoinsUI === 'function') updateCoinsUI(); }
  const cr = (typeof creditsTxt === 'function') ? creditsTxt(pay) : pay + ' credits';
  showMessage(`Ahead of schedule: +${cr} (${n} level${n === 1 ? '' : 's'} past the review's level)`, 'var(--gold)');
  return pay;
}

// ── Flow's level goals: four scales to test (r754, r761, owner) ──
// One number per level. `GOAL_SCALES` holds the owner's four tables (the owner
// ranks Goldilocks first, so it is the shipped one); Settings -> Run or dev ->
// Flow picks one (`lethe.flowGoalScale.v1`, stored only off the default), and
// dev -> Flow's text box can replace the rows with a custom list
// (`lethe.flowGoals.v1`, overrides only). Past the end of a table every level
// grows by its last step ratio. Read through flowGoalBase(lv) by
// survivalGoalForLevel (js/survival.js), which still lays the global multiplier,
// the Endless acceleration, Limitless, the difficulty tier and the rounding over
// it. The Schedule can read the same tables (mapGoalScale, js/goal-tuning.js).
const GOAL_SCALES = {
  goldilocks: { name: 'Goldilocks', rows: [1000, 1750, 2850, 5000, 8750, 15000, 25000, 37500, 50000, 80000, 100000, 130000,
    165000, 210000, 250000, 320000, 400000, 475000, 600000, 800000, 1000000, 1250000, 1500000, 1750000] },
  balatro: { name: 'Balatro-like', rows: [1000, 2000, 3750, 6750, 12500, 20000, 30000, 40000, 50000, 65000, 90000, 115000,
    140000, 165000, 200000, 240000, 265000, 290000, 325000, 360000, 400000, 440000, 485000, 550000] },
  step: { name: '1.5x then 1.25x', rows: [1000, 1500, 2250, 3375, 5000, 7500, 11250, 16875, 25000, 37500, 56250, 85000,
    106250, 133000, 166250, 210000, 262500, 330000, 412500, 515000, 650000, 815000, 1000000, 1250000] },
  taper: { name: 'xN minus 0.1', rows: [1000, 1900, 3600, 6500, 11700, 20000, 34000, 54400, 87000, 130500, 195750, 275000,
    385000, 500500, 650000, 845000, 1000000, 1200000, 1350000, 1600000, 1750000, 1925000, 2150000, 2150000] },
};
const GOAL_SCALE_ORDER = ['goldilocks', 'balatro', 'step', 'taper'];
function goalScaleRows(id) { return (GOAL_SCALES[id] || GOAL_SCALES.goldilocks).rows; }
// The value a table gives a level. Past its end (r762, owner): the first level
// after the table is x1.25 the last row, and every level after multiplies by 0.1
// more than the one before (x1.35, x1.45, x1.55...), whichever table it is.
const GOAL_PAST_BASE = 1.25, GOAL_PAST_STEP = 0.1;
// r765 (owner): the Schedule asks levels to 36, so there a table's end is bridged
// first: x MAP_PAST_MULT a level from 25 to MAP_PAST_UNTIL, and the 1.25 / +0.1 rule
// only past that. `past` = { mult, until } asks for the bridge; Flow passes none.
const MAP_PAST = { mult: 1.15, until: 36 };
function goalTableAt(t, lv, past) {
  const n = t.length;
  lv = Math.max(1, Math.round(lv || 1));
  if (lv <= n) return t[lv - 1];
  let g = t[n - 1], k = n + 1;
  if (past) for (; k <= Math.min(lv, past.until); k++) g *= past.mult;
  const from = k;   // the first level the growing rule applies to
  for (; k <= lv; k++) g *= GOAL_PAST_BASE + GOAL_PAST_STEP * (k - from);
  return g;
}
// The growth rate the Endless and Limitless terms read: the first step past the table.
function goalTableRatio(t, past) { return past ? past.mult : GOAL_PAST_BASE; }
function goalScaleBase(id, lv) { return goalTableAt(goalScaleRows(id), lv); }

const FLOW_GOAL_SCALE_DEFAULT = 'goldilocks';
const FLOW_GOAL_SCALE_KEY = 'lethe.flowGoalScale.v1';
let flowGoalScaleStore = null;
try { const v = localStorage.getItem(FLOW_GOAL_SCALE_KEY); if (v && GOAL_SCALES[v]) flowGoalScaleStore = v; } catch (e) {}
function flowGoalScale() { return flowGoalScaleStore || FLOW_GOAL_SCALE_DEFAULT; }
// Picking a scale drops a custom list (the list was written against another scale).
function setFlowGoalScale(id) {
  if (!GOAL_SCALES[id]) return;
  flowGoalScaleStore = id === FLOW_GOAL_SCALE_DEFAULT ? null : id;
  try { if (flowGoalScaleStore) localStorage.setItem(FLOW_GOAL_SCALE_KEY, id); else localStorage.removeItem(FLOW_GOAL_SCALE_KEY); } catch (e) {}
  flowGoalsStore = null; try { localStorage.removeItem(FLOW_GOALS_KEY); } catch (e) {}
}
const FLOW_GOALS_KEY = 'lethe.flowGoals.v1';
let flowGoalsStore = null;
try { const v = JSON.parse(localStorage.getItem(FLOW_GOALS_KEY) || 'null'); if (Array.isArray(v) && v.length >= 2 && v.every(n => typeof n === 'number' && n > 0)) flowGoalsStore = v; } catch (e) { flowGoalsStore = null; }
function flowGoalTable() { return flowGoalsStore || goalScaleRows(flowGoalScale()); }
function flowGoalTableIsDefault() { return !flowGoalsStore; }
function flowGoalBase(lv) { return goalTableAt(flowGoalTable(), lv); }
// Dev: a comma or line separated list. Blank, or the chosen scale's own list, clears the override.
function setFlowGoalsText(text) {
  const nums = String(text || '').split(/[\s,]+/).map(x => parseFloat(x)).filter(x => isFinite(x) && x > 0).map(x => Math.round(x));
  if (nums.length < 2 || nums.join() === goalScaleRows(flowGoalScale()).join()) { flowGoalsStore = null; try { localStorage.removeItem(FLOW_GOALS_KEY); } catch (e) {} return; }
  flowGoalsStore = nums;
  try { localStorage.setItem(FLOW_GOALS_KEY, JSON.stringify(nums)); } catch (e) {}
}

// ── The Schedule's goal scale (r761, owner: "maybe applicable to schedule") ──
// 'curve' is the 18%-a-level curve (mapGoalForLevel); a scale id reads the same
// table as Flow, by the tile's level. Stored only when not the curve.
const MAP_GOAL_SCALE_KEY = 'lethe.mapGoalScale.v1';
let mapGoalScaleStore = null;
try { const v = localStorage.getItem(MAP_GOAL_SCALE_KEY); if (v && GOAL_SCALES[v]) mapGoalScaleStore = v; } catch (e) {}
function mapGoalScale() { return mapGoalScaleStore || 'curve'; }
function setMapGoalScale(id) {
  mapGoalScaleStore = GOAL_SCALES[id] ? id : null;
  try { if (mapGoalScaleStore) localStorage.setItem(MAP_GOAL_SCALE_KEY, id); else localStorage.removeItem(MAP_GOAL_SCALE_KEY); } catch (e) {}
}
function flowTriggerBoss() {
  if (bossActive || flowBossFighting) return;
  flowBossFighting = true;
  // The clock can reach zero mid-dance. triggerBoss re-renders the board and returns
  // cards sitting on newly-void cells to the deck, so a dance still in flight has to
  // be torn down first - same teardown _onRoundEndCore does when any other mode's
  // clock expires mid-animation, including folding back the score it was holding.
  if (typeof cancelDance === 'function') cancelDance();
  suppressScoreDisplay = false;
  if (heldBackScore > 0) { score += heldBackScore; heldBackScore = 0; }
  animating = false;
  roundEnded = false;                    // the session clock hitting 0 is not a round end here
  goalReachedThisRound = false;
  selected = [];
  // ── The slate is wiped, visibly (r177) ──
  // This used to read `roundGoal = score + survivalGoalForLevel(level)`: the score
  // carried into the boss and the quota was raised to match, so the bar opened
  // part-full at some arbitrary fraction and the player had to work out that the
  // DELTA was what mattered. The delta is identical either way, so it is banked
  // and zeroed instead and the boss starts from a clean 0 / quota - which is what
  // every other mode's boss looks like, and what the wipe animation can show.
  // Banked into totalScore exactly as triggerLevelUp does, so the lifetime
  // display-only counter doesn't lose the round.
  const _wiped = score;
  totalScore += Math.max(0, score);
  score = 0;
  _limBossGoal = true;   // r749: Limitless reads the boss table's level (js/protocols.js)
  try { roundGoal = goalForLevel(flowBossGoalLevel()); } finally { _limBossGoal = false; }
  flowBossAheadPay();   // r754: a run past the review's level is paid for every level ahead
  // Held while the wipe animates the OLD number down to the new zero - the state
  // above is already correct, so an abort can't strand a half-reset run.
  suppressScoreDisplay = true;
  showMessage('⚠ BOSS', 'var(--red)');
  if (typeof crFlowCancel === 'function') crFlowCancel();   // no challenge card overlaps a boss
  // The boss opens on a full deck: the level's played cards go back in, as at a
  // level-up. Flow's boss comes mid-level, so nothing else would return them.
  flushPlayedDeck();
  // r727: at the top difficulty the fourth boss is THE FOUR HORSEMEN.
  const _final = (typeof difficultyFinalBossDue === 'function' && difficultyFinalBossDue(survivalBossesBeaten + 1)) ? difficultyFinalBossPreset() : null;
  const _go = () => triggerBoss(_final, FLOW_BOSS_WINDOW);
  if (typeof bossApproachWipe === 'function') bossApproachWipe(_wiped).then(_go);
  else { suppressScoreDisplay = false; updateScoreUI(); _go(); }
}

// Boss resolved (win or loss). Survival's post-boss path takes it from here; this
// just clears the guard and arms the session clock to refill on the next deal.
function flowEndBoss() {
  flowBossFighting = false;
  flowRefillClock  = true;
  if (typeof crFlowNewCycle === 'function') crFlowNewCycle();   // fresh challenge plan for the next cycle
}

// The session clock is NOT refilled by an ordinary level-up - five minutes spans as
// many goals as the player can clear. It refills only at the start of a run and
// after an inspection. triggerLevelUp calls this to decide.
function flowNextRoundSeconds(currentSeconds) {
  if (!flowRefillClock) return Math.max(1, currentSeconds);
  flowRefillClock = false;
  return flowSessionSeconds();
}

// r399: the session clock a refill hands out. The Starting Time limit was dead in
// Flow - the refill was a flat FLOW_SESSION_SECONDS - so a round-time pick bought
// nothing at all. Every step bought above the limit's base now lengthens every
// later session, and roundTimeLimitGained pays the same step onto the live one.
function flowSessionSeconds() {
  const bonus = (typeof limits !== 'undefined' && limits.round_time)
    ? limits.round_time.current - limits.round_time.base : 0;
  // r727: the difficulty tier takes seconds off every session (a quarter).
  // r748: Precision adds two minutes to every quarter (js/protocols.js).
  const _pr = (typeof precisionClockBonus === 'function') ? precisionClockBonus() : 0;
  return Math.max(30, FLOW_SESSION_SECONDS + bonus + _pr - difficultyTimeCut());
}

// r399: Survival and Flow pay a Starting Time pick NOW as well as later. Owner:
// "+15 seconds now and +15 seconds on subsequent" clocks. Flow's clock carries
// across levels, so without this a pick changed nothing until the next review;
// Survival already builds every later round from the limit, so it only needs the
// "now" half, and only when a round is actually live (between rounds the next
// round's computeRoundResources already includes it - adding here too would pay
// it twice). The seconds go onto roundStartSeconds as well, so every Trick that
// measures elapsed time (roundStartSeconds - roundSeconds) sees the round as
// longer rather than as younger. A raw write, deliberately NOT rewindTime: this
// is a limit grant, and a rewind would count toward the Kingfisher and every
// rewind tally.
function roundTimeLimitGained(sec) {
  if (!sec || sec <= 0) return;
  if (typeof survivalActive !== 'function' || !survivalActive()) return;
  if (typeof bossActive !== 'undefined' && bossActive) return;
  const _flow = typeof flowActive === 'function' && flowActive();
  const _live = _flow || (typeof roundInterval !== 'undefined' && roundInterval && !goalReachedThisRound);
  if (!_live) return;
  roundSeconds += sec;
  if (typeof roundStartSeconds === 'number') roundStartSeconds += sec;
  if (typeof updateClockUI === 'function') updateClockUI();
}
