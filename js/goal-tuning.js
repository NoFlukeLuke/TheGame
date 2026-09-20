// ══════════════════════════════════════════════
// GOAL TUNING (r197)  -  one chokepoint for every round goal
// ══════════════════════════════════════════════
// The round goal was computed in four places (level-up.js, game-control.js,
// dominoes-mode.js, and survival.js's own curve), each spelling out
// `BASE_GOAL * GOAL_SCALE^(level-1)` with its own rounding. Retuning the
// difficulty therefore meant an edit, a reload and a fresh run.
//
// Every one of those sites now calls goalForLevel(). The numbers behind it are
// live tunables that persist in localStorage, so the whole curve can be moved
// from the dev panel mid-run and applied to the round in progress.
//
// The shipped values are NOT copied here. goalTune() falls back to the real
// constants (BASE_GOAL, GOAL_SCALE, SURVIVAL_BASE_GOAL...), so an untouched
// knob always tracks the source of truth and a retune in the data files is
// still the shipped balance. localStorage only ever holds the OVERRIDES.

const GOAL_TUNE_KEY = 'lethe.goalTune.v1';

// Growth is stored as a PERCENT ("35% harder each round"), not as a scale
// factor - it is the number the panel asks for and the one worth typing.
function _goalTuneShipped(key) {
  const scale = (typeof GOAL_SCALE === 'number') ? GOAL_SCALE : 1.35;
  switch (key) {
    case 'globalMult':      return 1;
    case 'classicBase':     return (typeof BASE_GOAL === 'number') ? BASE_GOAL : 1200;
    case 'classicGrowth':   return +((scale - 1) * 100).toFixed(2);
    case 'classicGrowthLate': {
      const late = (typeof GOAL_SCALE_LATE === 'number') ? GOAL_SCALE_LATE : scale;
      return +((late - 1) * 100).toFixed(2);
    }
    case 'classicLateStart': return (typeof GOAL_LATE_START === 'number') ? GOAL_LATE_START : 99;
    case 'classicRoundTo':  return 500;
    // The Schedule advances the level on EVERY obligation, played or bought -
    // about twice as fast as Classic advances per round - so it needs its own,
    // flatter per-level growth or the same curve is a wall (measured: the bot
    // wins 0 of 100 Schedule runs on the classic curve, ~41% at 18%/level).
    case 'mapGrowth':       return (typeof MAP_GOAL_GROWTH === 'number') ? MAP_GOAL_GROWTH : 18;
    case 'survivalBase':    return (typeof SURVIVAL_BASE_GOAL === 'number') ? SURVIVAL_BASE_GOAL : 900;
    case 'survivalGrowth': {
      const s = (typeof SURVIVAL_GOAL_SCALE === 'number') ? SURVIVAL_GOAL_SCALE : scale;
      return +((s - 1) * 100).toFixed(2);
    }
    case 'survivalRoundTo': return (typeof SURVIVAL_GOAL_ROUND_TO === 'number') ? SURVIVAL_GOAL_ROUND_TO : 50;
    case 'endlessAccel':    return (typeof SURVIVAL_ENDLESS_ACCEL === 'number') ? SURVIVAL_ENDLESS_ACCEL : 1.65;
    case 'zenMult':         return 2;
  }
  return 0;
}

let goalTuneStore = {};
try { goalTuneStore = JSON.parse(localStorage.getItem(GOAL_TUNE_KEY) || '{}') || {}; }
catch (e) { goalTuneStore = {}; }

function goalTune(key) {
  const v = goalTuneStore[key];
  return (typeof v === 'number' && isFinite(v)) ? v : _goalTuneShipped(key);
}
function goalTuneIsDefault(key) { return !(typeof goalTuneStore[key] === 'number' && isFinite(goalTuneStore[key])); }
function goalTuneSave() {
  try { localStorage.setItem(GOAL_TUNE_KEY, JSON.stringify(goalTuneStore)); } catch (e) {}
}
function setGoalTune(key, v) {
  if (!isFinite(v)) return;
  // A value back at the shipped one is REMOVED, not stored, so the knob resumes
  // tracking the data files instead of pinning today's number forever.
  if (Math.abs(v - _goalTuneShipped(key)) < 1e-9) delete goalTuneStore[key];
  else goalTuneStore[key] = v;
  goalTuneSave();
}
function resetGoalTune() { goalTuneStore = {}; goalTuneSave(); }
function goalTuneTouched() { return Object.keys(goalTuneStore).length > 0; }

// ── The curves ──
// The global multiplier is folded in BEFORE rounding, so a scaled goal still
// lands on the rounding step rather than on some number ending in 37.
// Round 1 is deliberately NOT rounded to the step. startGame set the opening goal
// to a bare BASE_GOAL (1200) while the level-up formula rounded to the nearest
// 500 - so the shipped round-1 goal is 1200, and rounding it here would quietly
// drop it to 1000. Round 1 never goes through the level-up path, so the two
// cases never disagreed and both are reproduced exactly.
// Two growth segments (r278): levels up to classicLateStart-1 grow at
// classicGrowth per level, everything from classicLateStart on at
// classicGrowthLate. One rate is the special case where the two are equal.
function classicGoalForLevel(lv) {
  const step  = Math.max(1, goalTune('classicRoundTo'));
  const early = 1 + goalTune('classicGrowth') / 100;
  const late  = 1 + goalTune('classicGrowthLate') / 100;
  const shift = Math.max(2, Math.round(goalTune('classicLateStart')));
  const e1 = Math.max(0, Math.min(lv, shift - 1) - 1);   // steps at the early rate
  const e2 = Math.max(0, lv - (shift - 1));              // steps at the late rate
  const g = goalTune('classicBase') * goalTune('globalMult') * Math.pow(early, e1) * Math.pow(late, e2);
  if (lv <= 1) return Math.max(1, Math.round(g));
  return Math.max(step, Math.round(Math.round(g) / step) * step);
}

// The Schedule's own curve: Classic's base, its own flat per-level growth,
// because a Schedule level is advanced by every obligation rather than only by
// played rounds. Same rounding rules as the classic curve.
function mapGoalForLevel(lv) {
  const step  = Math.max(1, goalTune('classicRoundTo'));
  const scale = 1 + goalTune('mapGrowth') / 100;
  const g = goalTune('classicBase') * goalTune('globalMult') * Math.pow(scale, Math.max(0, lv - 1));
  if (lv <= 1) return Math.max(1, Math.round(g));
  return Math.max(step, Math.round(Math.round(g) / step) * step);
}

// Every mode's goal for a given round. Survival and Flow have their own curve
// (survivalGoalForLevel, which reads the same tunables); Zen multiplies the
// classic one, exactly as it did inline - after rounding, so Zen goals stay on
// a clean multiple of the classic step.
function goalForLevel(lv) {
  if (typeof survivalActive === 'function' && survivalActive()) return survivalGoalForLevel(lv);
  if (typeof mapActive === 'function' && mapActive()) return mapGoalForLevel(lv);
  let g = classicGoalForLevel(lv);
  if (typeof match3IsZen === 'function' && match3IsZen()) g = Math.round(g * goalTune('zenMult'));
  return g;
}

// Move the CURRENT round's bar to the retuned curve. Refused during a boss:
// the boss is being fought against this number right now, and The Ratchet has
// been raising it, so recomputing would both move the goalposts mid-fight and
// throw that away. Returns a short line for the panel to print.
function applyGoalTuneLive() {
  if (typeof gridData === 'undefined' || !Array.isArray(gridData) || !gridData.length) return 'no run in progress';
  if (typeof level !== 'number') return 'no run in progress';
  if (typeof currentBoss !== 'undefined' && currentBoss) return 'boss in progress - applies at the next round';
  const was = roundGoal;
  roundGoal = goalForLevel(level);
  if (typeof updateScoreUI === 'function') updateScoreUI();
  return `round ${level}: ${(+was).toLocaleString()} -> ${roundGoal.toLocaleString()}`;
}
