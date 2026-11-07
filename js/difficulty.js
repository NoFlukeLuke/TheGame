// ── Difficulty tiers (r727, r728, owner) ────────────────────────────────────
// One table, DIFF_TIERS, eight tiers. Each MODE has its own tier, chosen on its
// card in the mode carousel (sideways buttons, a $ per tier; js/menu.js) and
// stored in `lethe.difficulty.v2` ({ modeId: tier }, a mode at tier 1 is left
// out). A tier is unlocked for a mode by WINNING a run of that mode at the tier
// below it (`lethe.difficultyMax.v1`, { modeId: highest unlocked }). startGame
// copies the mode's tier into the run (`runDifficulty`, SAVE_VARS), so a saved
// run keeps the tier it was started on. Every reader asks difficultyTier().
// Every tier keeps the tiers' changes below it. DIFFICULTY.md is the write-up.
// r740: tier 3 is the penalty picks and tier 4 the 30s cut (swapped); tiers 5+ cost 5s / 7s.
//
//   hmDraws   how many DRAWS a horseman curse card in the deck lasts (Infinity:
//             until removed). A draw is the card coming onto the grid.
//   startCurse  a random horseman curse card goes into the deck at the start
//   swapSecs / discardSecs  what a swap / a discard costs (a discard is flat)
//   timeCut   seconds off every round (Flow: off every quarter's session)
//   penalties forced penalty picks: a Flow chain step (penaltyFlow %), a pick
//             after a Schedule round's pick of three (penaltyMap %)
//   harsh     penalties are all permanent and the serious ones weigh double;
//             Flow's chance of more than one reward is `multiCut` lower
//   goalMult  every goal is multiplied
//   finalBoss the run's last boss is THE FOUR HORSEMEN
const DIFF_TIERS = [
  { tier: 1, name: 'INTERN',         hmDraws: 4,        startCurse: false, swapSecs: 0, discardSecs: 0, timeCut: 0,  penalties: false, harsh: false, goalMult: 1,    finalBoss: false,
    say: 'No modifiers.' },
  { tier: 2, name: 'ENTRY LEVEL',    hmDraws: 4,        startCurse: true,  swapSecs: 3, discardSecs: 5, timeCut: 0,  penalties: false, harsh: false, goalMult: 1,    finalBoss: false,
    say: 'You start with a curse card. It goes away after 4 draws. Swaps cost 3s, discards cost 5s.' },
  { tier: 3, name: 'SPECIALIST',     hmDraws: 4,        startCurse: true,  swapSecs: 3, discardSecs: 5, timeCut: 0,  penalties: true,  harsh: false, goalMult: 1,    finalBoss: false,
    say: 'Forced penalties can appear in rewards.' },
  { tier: 4, name: 'MIDDLE MANAGER', hmDraws: 4,        startCurse: true,  swapSecs: 3, discardSecs: 5, timeCut: 30, penalties: true,  harsh: false, goalMult: 1,    finalBoss: false,
    say: 'Every round starts with 30 fewer seconds.', sayFlow: 'Every quarter starts with 30 fewer seconds.' },
  { tier: 5, name: 'SENIOR MANAGER', hmDraws: 6,        startCurse: true,  swapSecs: 5, discardSecs: 7, timeCut: 30, penalties: true,  harsh: false, goalMult: 1,    finalBoss: false,
    say: 'The starting curse card lasts 6 draws. Swaps cost 5s, discards cost 7s.' },
  { tier: 6, name: 'EXECUTIVE',      hmDraws: 6,        startCurse: true,  swapSecs: 5, discardSecs: 7, timeCut: 30, penalties: true,  harsh: true,  goalMult: 1,    finalBoss: false,
    say: 'Penalties are more punishing.', flowExtra: 'The chance of more than one reward is reduced.' },
  { tier: 7, name: 'C-SUITE',        hmDraws: Infinity, startCurse: true,  swapSecs: 5, discardSecs: 7, timeCut: 30, penalties: true,  harsh: true,  goalMult: 1.15, finalBoss: false,
    say: 'The starting curse card lasts until removed. Score requirements are higher.' },
  { tier: 8, name: 'THE BOARD',      hmDraws: Infinity, startCurse: true,  swapSecs: 5, discardSecs: 7, timeCut: 30, penalties: true,  harsh: true,  goalMult: 1.3,  finalBoss: true,
    say: 'Score requirements are higher. Face the final boss.' },
];
const DIFF_KEY = 'lethe.difficulty.v2';
const DIFF_MAX_KEY = 'lethe.difficultyMax.v1';
const DIFF_FINAL_BOSS_ID = 'the_four_horsemen';
const DIFF_PENALTY_FLOW = 15;   // % of Flow level-ups that add a forced penalty step (tier 4+)
const DIFF_PENALTY_MAP = 20;    // % chance of a forced penalty pick after a Schedule round's pick of three (tier 4+)
const DIFF_MULTI_CUT = 10;      // percentage points off Flow's chance of 2+ rewards (tier 6+)

// r747: one-shot move of Flow's and the Schedule's own tiers onto the Standard
// protocol (the higher of the two; Dexterous already had its own key). Writes back.
(function difficultyProtocolMigrate() {
  try {
    if (localStorage.getItem('lethe.difficultyProto.v1')) return;
    [DIFF_MAX_KEY, DIFF_KEY].forEach(key => {
      const all = JSON.parse(localStorage.getItem(key) || '{}') || {};
      const v = Math.max(all.flow || 0, all.map || 0);
      if (v > 1 && !all.standard) all.standard = v;
      if (Object.keys(all).length) localStorage.setItem(key, JSON.stringify(all));
    });
    localStorage.setItem('lethe.difficultyProto.v1', '1');
  } catch (e) {}
})();

let runDifficulty = 0;   // the live run's tier (SAVE_VARS); 0 = no run started under this build

function _diffRead(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; } }
function _diffWrite(key, obj) { try { Object.keys(obj).length ? localStorage.setItem(key, JSON.stringify(obj)) : localStorage.removeItem(key); } catch (e) {} }
// The carousel's 'picker' card is the Custom mode.
// r747: a Flow or Schedule run keys by its PROTOCOL ('standard', 'dexterous',
// 'precision'; js/protocols.js), shared by both, so a win in either counts for
// both. The protocol screen asks with 'proto:<id>'.
function difficultyModeId(id) {
  if (id === 'picker') return 'custom';
  if (typeof id === 'string' && id.startsWith('proto:')) return id.slice(6);
  if (id) return id;
  const m = (typeof ACTIVE_MODE !== 'undefined') ? ACTIVE_MODE : null;
  if (m && typeof PROTOCOL_BASES !== 'undefined' && PROTOCOL_BASES.includes(m.id)) return m.protocol || 'standard';
  return m ? m.id : 'normal';
}
function _diffClamp(n) { n = parseInt(n, 10); return (n >= 1 && n <= DIFF_TIERS.length) ? n : 1; }

// The tier a mode is set to (1 when nothing is stored).
function difficultySetting(modeId) { return _diffClamp(_diffRead(DIFF_KEY)[difficultyModeId(modeId)] || 1); }
function difficultySet(n, modeId) {
  n = Math.min(_diffClamp(n), difficultyMax(modeId));
  const all = _diffRead(DIFF_KEY), id = difficultyModeId(modeId);
  if (n === 1) delete all[id]; else all[id] = n;
  _diffWrite(DIFF_KEY, all);
  return n;
}
// The highest tier a mode has unlocked: 1, plus one for every tier won.
function difficultyMax(modeId) { return _diffClamp(_diffRead(DIFF_MAX_KEY)[difficultyModeId(modeId)] || 1); }
function difficultyUnlockTo(n, modeId) {
  n = _diffClamp(n);
  const all = _diffRead(DIFF_MAX_KEY), id = difficultyModeId(modeId);
  if (n <= 1) delete all[id]; else all[id] = Math.max(all[id] || 1, n);
  _diffWrite(DIFF_MAX_KEY, all);
}
// The dev select: every mode to tier n, unlocked to it.
function _diffAllIds() { return [...Object.keys(MODES || {}), ...((typeof PROTOCOLS !== 'undefined') ? PROTOCOLS.map(p => 'proto:' + p.id) : [])]; }
function difficultySetAll(n) { n = _diffClamp(n); _diffAllIds().forEach(id => { difficultyUnlockTo(n, id); difficultySet(n, id); }); }
function difficultyUnlockAll() { DIFF_TIERS.length && _diffAllIds().forEach(id => difficultyUnlockTo(DIFF_TIERS.length, id)); }
// A won run unlocks the next tier for its mode (onGameWin). Tours, labs and test
// drives never count (unlockPaused, js/unlocks.js).
function difficultyOnWin() {
  if (!runDifficulty) return;
  if (typeof unlockPaused === 'function' && unlockPaused()) return;
  if (runDifficulty >= difficultyMax()) difficultyUnlockTo(runDifficulty + 1);
}

// The tier in force: the run's while one is live, else the active mode's setting.
function difficultyTier() { return runDifficulty || difficultySetting(); }
function difficultyRow(n) { return DIFF_TIERS[(n || difficultyTier()) - 1] || DIFF_TIERS[0]; }
function difficultyName(n) { return difficultyRow(n).name; }
function difficultyDollars(n) { return '$'.repeat(n || difficultyTier()); }
// What a tier says on a mode's card: Flow has its own wording where it differs.
function difficultySay(n, modeId) {
  const row = difficultyRow(n), flow = difficultyModeId(modeId) === 'flow';
  let s = (flow && row.sayFlow) ? row.sayFlow : row.say;
  if (flow && row.flowExtra) s += ' ' + row.flowExtra;
  return s;
}
// startGame: the run takes its mode's tier, then its starting curse card (after the deck is built).
function difficultyStartRun() { runDifficulty = difficultySetting(); }
function difficultyRunSetup() {
  if (!difficultyRow().startCurse) return;
  if (typeof unlockPaused === 'function' && unlockPaused()) return;
  if (typeof addCurseCardsToDeck !== 'function' || typeof drawPile === 'undefined') return;
  addCurseCardsToDeck(1);
}

// ── The readers ──
// How many draws a deck horseman lasts (Infinity: until removed).
function difficultyHorsemanDraws() { return difficultyRow().hmDraws; }
// A swap's seconds and a discard's seconds (the discard is FLAT, whatever the
// count). Read by doSwap / doDiscard, the Time pop-up, the held stack and the
// walkthrough through swapSecondsBase() / discardSecondsBase() below.
function difficultySwapSecs() { return difficultyRow().swapSecs; }
function difficultyDiscardSecs() { return difficultyRow().discardSecs; }
// Seconds off every round's Starting Time (Flow: off every session's clock).
function difficultyTimeCut() { return difficultyRow().timeCut; }
// Forced penalty picks are on (tier 4+).
function difficultyPenaltiesOn() { return !!difficultyRow().penalties; }
// Penalties are all permanent and the serious ones weigh double (tier 6+).
function difficultyPenaltiesHarsh() { return !!difficultyRow().harsh; }
// Percentage points off Flow's chance of 2+ rewards (tier 6+).
function difficultyMultiCut() { return difficultyRow().harsh ? DIFF_MULTI_CUT : 0; }
// Every goal is multiplied (tiers 7 and 8).
function difficultyGoalMult() { return difficultyRow().goalMult || 1; }
// The run's last boss is the final boss (tier 8).
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

// ── The forced penalty pick (tier 4+) ──
// Three penalties from the Balance Sheet's own table (rewardDebuffList,
// js/reward-grid.js), one must be taken, no skip. Flow: a chain step
// ('penalty', DIFF_PENALTY_FLOW % of level-ups); the Schedule: DIFF_PENALTY_MAP %
// of the time after a round's pick of three (mapAfterLevel).
function openPenaltyPick(done) {
  let rows = [];
  try { rows = (typeof rewardDebuffList === 'function') ? rewardDebuffList().filter(d => d.tier === 'penalty' && !d._mystery) : []; } catch (e) { rows = []; }
  if (rows.length < 2) { done && done(); return; }
  const pool = rows.slice(), offers = [];
  while (offers.length < 3 && pool.length) {
    const tot = pool.reduce((s, d) => s + (d.weight || 1), 0);
    let r = Math.random() * tot, k = 0;
    for (; k < pool.length; k++) { r -= (pool[k].weight || 1); if (r <= 0) break; }
    const d = pool.splice(Math.min(k, pool.length - 1), 1)[0];
    // A pick tile reads label / rarity / icon / desc / tag (gridPickTileHTML, js/grid-pick.js).
    offers.push({ type: 'penalty', data: d, id: 'pen_' + offers.length, label: d.label, name: d.label, icon: d.icon, desc: d.desc, tag: 'PENALTY', rarity: 'penalty', artKind: 'plain' });
  }
  showMessage('Forced penalty: take one', 'var(--red)');
  openGridPick({
    offers, actions: [], title: 'PENALTY', tone: 'penalty',
    onChoose: (i, o) => {
      try { o.data.apply(); } catch (e) { console.error('[DIFF] penalty failed', e); }
      if (typeof ulBump === 'function') ulBump('penalties', 1);
      done && done();
    },
  });
}
// The Schedule's roll: after a round's pick of three, DIFF_PENALTY_MAP % of the time.
function difficultyPenaltyMaybe(done) {
  if (difficultyPenaltiesOn() && Math.random() * 100 < DIFF_PENALTY_MAP) { openPenaltyPick(done); return true; }
  done && done();
  return false;
}
// Flow's roll: does this level-up's chain get a penalty step?
function difficultyPenaltyStepRolled() { return difficultyPenaltiesOn() && Math.random() * 100 < DIFF_PENALTY_FLOW; }

// The dev panel's select reads the live value whenever it is built.
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => { const s = document.getElementById('dev-difficulty'); if (s) s.value = String(difficultySetting()); });
