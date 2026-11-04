// ── Difficulty tiers (r727, owner) ──────────────────────────────────────────
// One table, DIFF_TIERS. The tier is chosen in Settings -> Game (and the dev
// panel's Change the game now), stored in `lethe.difficulty.v1` only when it is
// not tier 1, and COPIED INTO THE RUN at startGame (`runDifficulty`, SAVE_VARS),
// so a saved run keeps the tier it was started on whatever the setting says now.
// Every reader asks difficultyTier(); nothing reads the table by hand.
//
// What each tier changes (at most two things a tier; the lower tiers' changes
// stay as you go up). DIFFICULTY.md has the recommendations for the rest.
//   1  horsemen in the deck leave after `hmRounds` rounds on the grid (4);
//      swaps and discards cost no time.
//   2  horsemen last 6 rounds; a swap costs 3s and a discard 5s (flat, not per card).
//   3  horsemen stay until removed; every round starts 30s shorter (Flow: every quarter).
//   4  the run's last boss is THE FOUR HORSEMEN (one of each curse card at the start).
// A round "on the grid" is one in which the card came onto the board at all
// (js/horsemen.js, hmRoundsNote / hmRoundsSettle).
const DIFF_TIERS = [
  { tier: 1, name: 'ENTRY LEVEL', hmRounds: 4,        swapSecs: 0, discardSecs: 0, timeCut: 0,  finalBoss: false },
  { tier: 2, name: 'SENIOR',      hmRounds: 6,        swapSecs: 3, discardSecs: 5, timeCut: 0,  finalBoss: false },
  { tier: 3, name: 'EXECUTIVE',   hmRounds: Infinity, swapSecs: 3, discardSecs: 5, timeCut: 30, finalBoss: false },
  { tier: 4, name: 'C-SUITE',     hmRounds: Infinity, swapSecs: 3, discardSecs: 5, timeCut: 30, finalBoss: true  },
];
const DIFF_KEY = 'lethe.difficulty.v1';
const DIFF_FINAL_BOSS_ID = 'the_four_horsemen';

let runDifficulty = 0;   // the live run's tier (SAVE_VARS); 0 = no run started under this build

function difficultySetting() {
  let v = 1;
  try { v = parseInt(localStorage.getItem(DIFF_KEY) || '1', 10); } catch (e) {}
  return (v >= 1 && v <= DIFF_TIERS.length) ? v : 1;
}
function difficultySet(n) {
  n = Math.max(1, Math.min(DIFF_TIERS.length, parseInt(n, 10) || 1));
  try { n === 1 ? localStorage.removeItem(DIFF_KEY) : localStorage.setItem(DIFF_KEY, String(n)); } catch (e) {}
  // A live run keeps its own tier; the next run reads the setting.
}
// The tier in force: the run's while one is live, else the setting.
function difficultyTier() { return runDifficulty || difficultySetting(); }
function difficultyRow() { return DIFF_TIERS[difficultyTier() - 1] || DIFF_TIERS[0]; }
function difficultyName(n) { const row = DIFF_TIERS[(n || difficultyTier()) - 1]; return row ? row.name : ''; }
// startGame: the run takes the setting.
function difficultyStartRun() { runDifficulty = difficultySetting(); }

// ── The readers ──
// How many rounds a deck horseman lasts (Infinity: until removed).
function difficultyHorsemanRounds() { return difficultyRow().hmRounds; }
// A swap's seconds and a discard's seconds (the discard is FLAT, whatever the
// count). Read by doSwap / doDiscard, the Time pop-up, the held stack and the
// walkthrough through swapSecondsBase() / discardSecondsBase() below.
function difficultySwapSecs() { return difficultyRow().swapSecs; }
function difficultyDiscardSecs() { return difficultyRow().discardSecs; }
// Seconds off every round's Starting Time (Flow: off every session's clock).
function difficultyTimeCut() { return difficultyRow().timeCut; }
// The run's last boss is the final boss.
function difficultyFinalBoss() { return !!difficultyRow().finalBoss; }

// The base figures the five time-cost sites read (BAL._resources.swap_seconds
// and discard_seconds_per_card were the figures before r727; the tier owns
// them now). Steady Hand and Spoiled are multiples of the base, so at a tier
// where the base is 0 they cost 0 too, and their sentences say so.
function swapSecondsBase() { return difficultySwapSecs(); }
function discardSecondsBase() { return difficultyDiscardSecs(); }
function steadyHandSwapSecs() { return swapSecondsBase() * (BAL.steady_hand.swap_mult || 2); }
function hoarderDiscardSecs() { return discardSecondsBase() * (BAL.hoarder.discard_mult || 2); }
// Free Swaps / Free Discards do nothing at a tier where the base is 0: never offered there.
function difficultyOfferBanned(id) {
  if (id === 'free_swaps' && swapSecondsBase() <= 0) return true;
  if (id === 'free_discards' && discardSecondsBase() <= 0) return true;
  return false;
}

// Is the boss about to be drawn the run's LAST? Classic / the Schedule: the
// quarter being dealt is QUARTERS_PER_RUN (not Endless); Flow: boss number
// SURVIVAL_BOSS_COUNT. Each caller says which quarter / boss it is dealing.
function difficultyFinalBossDue(n) {
  if (!difficultyFinalBoss()) return false;
  if (typeof endlessRun !== 'undefined' && endlessRun) return false;
  if (typeof survivalEndless !== 'undefined' && survivalEndless) return false;
  const last = (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.flow) ? SURVIVAL_BOSS_COUNT : QUARTERS_PER_RUN;
  return n === last;
}
function difficultyFinalBossPreset() { return (typeof BOSS_PRESETS !== 'undefined') ? BOSS_PRESETS.find(p => p.id === DIFF_FINAL_BOSS_ID) || null : null; }

// The dev panel's select reads the live value whenever it is built.
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => { const s = document.getElementById('dev-difficulty'); if (s) s.value = String(difficultySetting()); });
