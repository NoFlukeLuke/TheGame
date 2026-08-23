// ══════════════════════════════════════════════
// SAVE & RESUME  (r155)
// ══════════════════════════════════════════════
// Saves a run to browser storage so it can be picked up later. Two decisions
// shape everything here:
//
// 1. THE SAVE POINT IS THE START OF A ROUND, never "wherever you happen to be".
//    A snapshot is taken automatically in startRoundTimer() — the one call site
//    every round start funnels through — and SAVE writes that snapshot out. So
//    the player can hit save at any moment and what lands on disk is a clean
//    board with a full clock, no half-selected hand, no animation mid-flight, no
//    scoring dance to resume. Resuming replays the current round from its start.
//    Serialising a live mid-round would mean capturing timers, the dance, boss
//    schedules and in-flight fall animations for very little gain.
//
// 2. RESTORE REUSES startGame() AS ITS BASELINE. A run touches ~130 globals; if
//    restore only assigned the ones listed below, anything missed would keep the
//    value left over from the PREVIOUS run in this tab. So resume calls
//    startGame() first (which resets all of it to a known-clean run) and then
//    lays the snapshot on top. A variable missing from the manifest costs you
//    that one value, not a corrupt hybrid of two runs.
//
// ── Why indirect eval ───────────────────────────────────────────────────────
// The game's globals are top-level `let`, which — unlike `var` — do NOT become
// properties of `window`. `window['score']` is undefined even though `score` is
// a perfectly good global. Indirect eval (`geval`) runs in global scope and can
// see the global lexical environment, so it can read and write them by name.
// That is what lets this file drive a 130-name manifest instead of 260 lines of
// hand-written assignments that would silently rot as the game grows.

const SAVE_KEY     = 'letheSavedRun';
const SAVE_VERSION = 1;

const geval = eval; // indirect — evaluates in global scope, sees `let` globals

function _saveRead(name)     { try { return geval(name); } catch (e) { return undefined; } }
function _saveWrite(name, v) {
  try { window.__saveTmp = v; geval(name + ' = window.__saveTmp'); return true; }
  catch (e) { return false; }   // const bindings (limits, C) land here — see _saveMutate
  finally { try { delete window.__saveTmp; } catch (e2) {} }
}

// Every global that carries run state. Derived from startGame()'s reset block —
// that block IS the definition of "what a run is" — plus the deck/board/seed
// state it sets up afterwards. Deliberately EXCLUDED: transient input and
// animation flags (animating, falling, selected, swapPending, pendingAction,
// dealPhase, focusAnimQueue…). Those are meaningless at a round boundary and
// startGame() has already set them correctly.
const SAVE_VARS = [
  // ── Run progression ──
  'level', 'score', 'totalScore', 'roundGoal', 'coins', 'leaves', 'handsPlayed',
  'actNumber', 'nodeInAct', 'rewardGridsSeen', 'forceBossNextRound', 'shopFromNodeFlow',
  'pendingEventOverride', 'rewardGridContext', 'skipTrickChoiceOverlay', 'pendingLevelUps',
  'goalReachedThisRound', 'roundEnded', 'suppressScoreDisplay', 'heldBackScore',
  // ── Deck & board ──
  'drawPile', 'playedPile', 'gridData', 'gridRows', 'gridCols', 'expectedDeckTotal', 'ACTIVE_SUITS',
  // ── Clock & resources ──
  'roundSeconds', 'gameSeconds', 'roundStartSeconds', 'swaps', 'discards',
  'accumulatedSwaps', 'accumulatedDiscards', 'accumulatedSeconds',
  'roundPenaltySeconds', 'extraPlayCostPerm', 'extraDiscardCostPerm',
  'nextRoundDiscardDelta', 'nextRoundSwapDelta', 'nextRoundSecondsDelta',
  'nextRoundPlayCost', 'nextRoundDiscardCost', 'playHandCostThisRound', 'discardCostThisRound',
  'freeSwapsLeft', 'freeDiscardsLeft', 'pauseSecondsLeft', 'pauseInstanceGame',
  // ── Focus ──
  'focusNodes', 'focusCapBase', 'focusCapPerm', 'focusGenGame', 'focusGenRound',
  'lastCalcMult', 'lastCalcFocus', 'lastPreHandFocus', 'lastPreFocusMult',
  // ── Entities owned ──
  'acquiredTricks', 'acquiredKnacks', 'trickTray', '_trickReplaceQueue', 'trickTrayMode',
  'grantedSleightIds', 'altarEffects',
  'sleightNextHandDouble', 'sleightLegacyMult', 'sleightAmplifierMult',
  '_dabiSwapNext', 'sleightFreeSwapPending',
  // ── Permanent card buffs / curses ──
  'permPips', 'permMult', 'permXPips', 'permXMult', 'permRetrig', 'cardCurses',
  'cardPlayCount', 'cardSwapCount', 'cardDealtCount',
  // ── Hands ──
  'activeHands', 'unlockedHands', 'handsPendingUnlock', 'handTypesRound',
  '_comboAnnounced', '_comboHinted',
  // ── Trick / knack accumulators ──
  'bonusMult_fives', 'bonusMult_nines', 'bonusMult_tens', 'bonusMult_compound',
  'bonusPips_prolific', 'bonusFocus_acorns', 'bonusMult_morebetter', 'bonusPips_fengshui',
  'bonusMult_jackpot', 'jackpotFired', 'safetyNetUsed', 'negativeTilesTakenRun',
  '_perMinuteFired', 'handsPlayedGame', 'rowColBonuses', 'leyLinePos',
  'cuckooNextMinute', 'retriggersThisRound', 'woodpeckerActiveBlock', 'woodpeckerPos',
  // ── Round/run counters ──
  'handsPlayedRound', 'runsPlayedRound', 'setsPlayedRound', 'runStreak',
  'cardsDiscardedTotal', 'cardsDiscardedRound', 'cardsScoredTotal', 'nineSecondsCounter',
  'highestHandScore', 'highestHandName', 'fullHouseThisRound', 'gameStartTime',
  'lastHandType', 'streakCount', 'lastHandTime', 'resilience', 'resilienceUsed',
  'firstHandThisRound', 'replaysThisRound', 'timeManipRound', 'roundContributions',
  // ── Reward grid / shop ──
  'rewardSelected', 'rewardCells', 'rewardConfirmed',
  'shopRerollCount', 'shopPurchased', 'shopPurchaseCount', 'nextShopTime',
  // ── Boss ──
  'bossActive', 'bossNumber', 'nextBossTime', 'blockedCells', 'nullCells',
  // ── Challenge ──
  'challengeCard', 'challengeActive', 'trickCardPos', 'trickCardTimer',
  // ── Survival ──
  'survivalBossTimeBank', 'survivalBossPending', 'survivalLevelsSinceLimit', 'survivalRerollsUsed',
  // ── Seed (keeps future reward grids / shops deterministic) ──
  'runSeed', 'rewardVisitIndex', 'shopVisitIndex',
];

// `const` objects can't be reassigned, so their CONTENTS are copied instead.
const SAVE_MUTATE = ['limits', 'C'];

// ── (de)serialisation ────────────────────────────────────────────────────────
// Sets are everywhere in this codebase (activeHands, blockedCells, …) and JSON
// turns them into `{}`, so they get an explicit tag. Everything else in the
// manifest is already plain data — verified: no entity in any pool carries a
// function, so tricks/knacks/sleights survive a JSON round-trip intact.
function _saveEncode(v) {
  if (v instanceof Set) return { __t: 'set', v: [...v].map(_saveEncode) };
  if (v instanceof Map) return { __t: 'map', v: [...v].map(([k, x]) => [k, _saveEncode(x)]) };
  if (Array.isArray(v))  return v.map(_saveEncode);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) { const e = _saveEncode(v[k]); if (e !== undefined) o[k] = e; }
    return o;
  }
  if (typeof v === 'function' || v === undefined) return undefined;
  return v;
}
function _saveDecode(v) {
  if (v && typeof v === 'object') {
    if (v.__t === 'set') return new Set(v.v.map(_saveDecode));
    if (v.__t === 'map') return new Map(v.v.map(([k, x]) => [k, _saveDecode(x)]));
    if (Array.isArray(v)) return v.map(_saveDecode);
    const o = {};
    for (const k of Object.keys(v)) o[k] = _saveDecode(v[k]);
    return o;
  }
  return v;
}

// ── Checkpoint ───────────────────────────────────────────────────────────────
// Held in memory and refreshed at every round start; SAVE writes it to storage.
let runCheckpoint  = null;
let _restoringSave = false;   // suppresses the checkpoint while resume deals its board

function captureRunCheckpoint() {
  if (_restoringSave) return;               // mid-restore: don't snapshot the throwaway board
  if (typeof ACTIVE_MODE === 'undefined') return;
  if (tutorialActive && tutorialActive()) return;  // orientation is a scripted run, not worth saving
  const state = {};
  for (const name of SAVE_VARS) {
    const v = _saveRead(name);
    if (v === undefined) continue;
    const e = _saveEncode(v);
    if (e !== undefined) state[name] = e;
  }
  for (const name of SAVE_MUTATE) {
    const v = _saveRead(name);
    if (v !== undefined) state[name] = _saveEncode(v);
  }
  runCheckpoint = {
    v: SAVE_VERSION,
    build: typeof BUILD !== 'undefined' ? BUILD : '',
    savedAt: Date.now(),
    meta: {
      mode:  ACTIVE_MODE.id,
      modeName: ACTIVE_MODE.name,
      level: typeof level === 'number' ? level : 1,
      act:   typeof actNumber === 'number' ? actNumber : 1,
      node:  typeof nodeInAct === 'number' ? nodeInAct : 0,
      totalScore: typeof totalScore === 'number' ? totalScore : 0,
      coins: typeof coins === 'number' ? coins : 0,
      tricks: (typeof trickTray !== 'undefined' && trickTray) ? trickTray.length : 0,
      knacks: (typeof acquiredKnacks !== 'undefined' && acquiredKnacks) ? acquiredKnacks.length : 0,
    },
    state,
  };
}

// ── Storage ──────────────────────────────────────────────────────────────────
function saveRunToStorage() {
  if (!runCheckpoint) return { ok: false, msg: 'No round checkpoint yet — start a round first.' };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(runCheckpoint));
  } catch (e) {
    return { ok: false, msg: 'Storage unavailable — this browser is blocking saved data.' };
  }
  if (window.LETHE_STORAGE_OK === false)
    return { ok: true, msg: 'Saved for this session only — this browser blocks stored data.' };
  const m = runCheckpoint.meta;
  return { ok: true, msg: `Saved — ${m.modeName}, Round ${m.level}.` };
}

function readSavedRun() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || s.v !== SAVE_VERSION || !s.state || !s.meta) return null;
    return s;
  } catch (e) { return null; }
}

function hasSavedRun()   { return !!readSavedRun(); }
function clearSavedRun() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} runCheckpoint = null; updateContinueBtn(); }

function savedRunSummary() {
  const s = readSavedRun();
  if (!s) return null;
  const m = s.meta;
  const when = new Date(s.savedAt);
  const ago  = Math.floor((Date.now() - s.savedAt) / 60000);
  const whenStr = ago < 1 ? 'just now'
                : ago < 60 ? `${ago} min ago`
                : ago < 1440 ? `${Math.floor(ago / 60)} hr ago`
                : when.toLocaleDateString();
  return { ...m, whenStr, savedAt: s.savedAt };
}

// ── Resume ───────────────────────────────────────────────────────────────────
function resumeSavedRun() {
  const save = readSavedRun();
  if (!save) return false;

  ACTIVE_MODE = MODES[save.meta.mode] || MODES.normal;
  // Re-pin the run's seed so reward grids and shops still follow the same
  // sequence after resuming (they key off runSeed + visit index — see seed.js).
  if (typeof setPendingRunSeed === 'function') setPendingRunSeed(save.state.runSeed || null);

  _restoringSave = true;
  startGame();                    // clean baseline: every global at a known value
  applySavedState(save.state);
  _restoringSave = false;

  // The board came out of the save, so the grid has to be re-measured (a saved
  // run may have bought grid-size limits since) and repainted.
  gridRows = limits.grid_rows.current;
  gridCols = limits.grid_cols.current;
  recomputeGridMetrics();

  // Rebuild every HUD surface from the restored numbers.
  buildFocusMeter();
  syncFocusMeterState();
  syncTrickTrayUI();
  updateTrickList();
  if (typeof renderTrickTray  === 'function') renderTrickTray();
  if (typeof updateKnackList  === 'function') updateKnackList();
  if (typeof updateCoinsUI    === 'function') updateCoinsUI();
  if (typeof updateActProgressUI === 'function') updateActProgressUI();
  if (typeof updateRunProgressUI === 'function') updateRunProgressUI();
  if (typeof updateInteractCosts === 'function') updateInteractCosts();
  updateScoreUI();
  updateClockUI();
  render();

  // Restart the round clock so roundStartSeconds tracks the resumed round, then
  // take a fresh checkpoint of exactly what the player is now looking at.
  startRoundTimer();
  captureRunCheckpoint();
  return true;
}

function applySavedState(state) {
  for (const name of SAVE_VARS) {
    if (!(name in state)) continue;
    _saveWrite(name, _saveDecode(state[name]));
  }
  // const-bound objects: copy contents in place rather than reassigning.
  for (const name of SAVE_MUTATE) {
    if (!(name in state)) continue;
    const target = _saveRead(name);
    const src    = _saveDecode(state[name]);
    if (!target || !src) continue;
    Object.keys(target).forEach(k => { if (!(k in src)) delete target[k]; });
    Object.keys(src).forEach(k => { target[k] = src[k]; });
  }
  // runSeed is written above, but the live Math.random stream has to be
  // re-installed to match it or the restored run would draw off the wrong one.
  if (state.runSeed && typeof applyRunSeed === 'function') {
    applyRunSeed(state.runSeed);
    _saveWrite('rewardVisitIndex', _saveDecode(state.rewardVisitIndex || 0));
    _saveWrite('shopVisitIndex',   _saveDecode(state.shopVisitIndex   || 0));
  }
}

// ── Menu button ──────────────────────────────────────────────────────────────
function updateContinueBtn() {
  const btn = document.getElementById('menu-continue-btn');
  if (!btn) return;
  const s = savedRunSummary();
  if (!s) { btn.style.display = 'none'; return; }
  btn.style.display = '';
  btn.innerHTML = `CONTINUE<span class="menu-continue-sub">${s.modeName} · Round ${s.level} · ${s.whenStr}</span>`;
}

function continueSavedRun() {
  if (!hasSavedRun()) { updateContinueBtn(); return; }
  maybeAutoFullscreen();
  document.getElementById('main-menu-overlay').classList.remove('show');
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  resumeSavedRun();
}

// A finished run's save is stale, but only if the save actually belongs to the
// run that just ended — a player may have saved run A, started run B, and died
// in B. `gameStartTime` is stamped once per run in startGame, so it identifies
// the run cheaply.
function retireSavedRunIfCurrent() {
  const s = readSavedRun();
  if (!s) return;
  if (typeof gameStartTime === 'number' && s.state && s.state.gameStartTime === gameStartTime) clearSavedRun();
  runCheckpoint = null;
}
