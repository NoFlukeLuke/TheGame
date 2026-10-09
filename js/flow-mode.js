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
// r525 (owner): a Flow boss's goal ignores how many levels were cleared. Boss N is
// set as though exactly FLOW_BOSS_GOAL_LEVELS level-ups came before it each cycle:
// boss 1 = level 6's goal, boss 2 = level 11's, and so on.
const FLOW_BOSS_GOAL_LEVELS = 5;
function flowBossGoalLevel() {
  return 1 + FLOW_BOSS_GOAL_LEVELS * ((typeof survivalBossesBeaten === 'number' ? survivalBossesBeaten : 0) + 1);
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
  roundGoal = goalForLevel(flowBossGoalLevel());
  // Held while the wipe animates the OLD number down to the new zero - the state
  // above is already correct, so an abort can't strand a half-reset run.
  suppressScoreDisplay = true;
  showMessage('⚠ BOSS', 'var(--red)');
  if (typeof crFlowCancel === 'function') crFlowCancel();   // no challenge card overlaps a boss
  // The boss opens on a full deck: the level's played cards go back in, as at a
  // level-up. Flow's boss comes mid-level, so nothing else would return them.
  flushPlayedDeck();
  const _go = () => triggerBoss(null, FLOW_BOSS_WINDOW);
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
  return Math.max(30, FLOW_SESSION_SECONDS + bonus);
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
