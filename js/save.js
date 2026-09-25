// ══════════════════════════════════════════════
// SAVE & RESUME  (r155)
// ══════════════════════════════════════════════
// Saves a run to browser storage so it can be picked up later. Two decisions
// shape everything here:
//
// 1. THE SAVE POINT IS THE START OF A ROUND, never "wherever you happen to be".
//    A snapshot is taken automatically in startRoundTimer() - the one call site
//    every round start funnels through - and SAVE writes that snapshot out. So
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
// The game's globals are top-level `let`, which - unlike `var` - do NOT become
// properties of `window`. `window['score']` is undefined even though `score` is
// a perfectly good global. Indirect eval (`geval`) runs in global scope and can
// see the global lexical environment, so it can read and write them by name.
// That is what lets this file drive a 130-name manifest instead of 260 lines of
// hand-written assignments that would silently rot as the game grows.

const SAVE_KEY     = 'letheSavedRun';
// v2 (r192): the per-card maps are keyed by card id instead of "rank-suit".
// A v1 save is still accepted and migrated on resume (see migrateCardKeysToIds).
const SAVE_VERSION = 2;

const geval = eval; // indirect - evaluates in global scope, sees `let` globals

function _saveRead(name)     { try { return geval(name); } catch (e) { return undefined; } }
function _saveWrite(name, v) {
  try { window.__saveTmp = v; geval(name + ' = window.__saveTmp'); return true; }
  catch (e) { return false; }   // const bindings (limits, C) land here - see _saveMutate
  finally { try { delete window.__saveTmp; } catch (e2) {} }
}

// Every global that carries run state. Derived from startGame()'s reset block -
// that block IS the definition of "what a run is" - plus the deck/board/seed
// state it sets up afterwards. Deliberately EXCLUDED: transient input and
// animation flags (animating, falling, selected, swapPending, pendingAction,
// dealPhase, focusAnimQueue…). Those are meaningless at a round boundary and
// startGame() has already set them correctly.
const SAVE_VARS = [
  // ── Run progression ──
  'level', 'score', 'totalScore', 'lastRoundScore', 'lastRoundGoal', 'roundGoal', 'coins', 'leaves', 'handsPlayed',
  'runDifficulty', 'goalPenaltyMult', 'focusRatePenalty', 'skipNextPayout', 'pendingEntityLockout',
  'deadCells', 'riderTrickId', 'interestFreezeRounds', 'spotCheckHand', 'spotCheckLeft', 'nextRoundGridShrink',
  'luckModifiers',
  'actNumber', 'nodeInAct', 'rewardGridsSeen', 'forceBossNextRound', 'shopFromNodeFlow',
  // Guided's act state. guidedInStop, guidedCrossroadsOpen and guidedOffers are
  // deliberately NOT saved: a checkpoint is only ever taken at the START OF A
  // ROUND, and a bought stop or an open crossroads never straddles one, so all
  // three are always at rest when a save is written.
  //
  // The rest of it IS saved. startGame() resets every one of these to a
  // fresh-run value and restore lays the save on top, so anything missing here
  // is silently forgotten: without guidedBuysThisAct a resumed run forgets the
  // repeat-purchase surcharge, without guidedSinceLevel the forced-level
  // cadence, without guidedLastKind the no-repeat rule.
  'guidedSlot', 'guidedEventOffers', 'guidedBuysThisAct', 'guidedLastKind', 'guidedSinceLevel',
  // Map mode. mapTiles is plain data by construction - challenges are stored by
  // id and rehydrated from CHALLENGE_DEFS at confirm time.
  'mapTiles', 'mapPos', 'mapVisits', 'mapSkips', 'mapBossGoal', 'mapBossArmed',
  'mapDrawStrokes', 'mapPenColor',
  'mapFirstRoundDone', 'mapPosTileId', 'swapsUsedRound', 'discardsUsedRound',
  // The live challenge survives a save as DATA (JSON drops its test function).
  // guidedRehydrateChallenges re-attaches the test by id on the way in, so an
  // active HARD ROUND resumes as one - without it roundGoal came back raised by
  // guidedApplyPendingChallenge with no predicate to settle against, and the
  // goal stayed up with the bonus unreachable. A mini-boss re-arms from
  // startRoundTimer on resume.
  'guidedPendingChallenge', 'guidedActiveChallenge',
  'pendingEventOverride', 'rewardGridContext', 'skipTrickChoiceOverlay', 'pendingLevelUps',
  'goalReachedThisRound', 'roundEnded', 'suppressScoreDisplay', 'heldBackScore',
  // ── Deck & board ──
  'drawPile', 'playedPile', 'gridData', 'gridRows', 'gridCols', 'expectedDeckTotal', 'ACTIVE_SUITS', 'ACTIVE_RANKS',
  '_cardIdCounter',   // cards carry ids now; without this a resumed run reissues ids already in play
  // ── Clock & resources ──
  'roundSeconds', 'gameSeconds', 'roundStartSeconds', 'swaps', 'discards',
  'clockLevelMarks',            // the level-up lines on a session clock (js/clock-track.js)
  'accumulatedSwaps', 'accumulatedDiscards', 'accumulatedSeconds',
  'roundPenaltySeconds', 'extraPlayCostPerm', 'extraDiscardCostPerm',
  'nextRoundDiscardDelta', 'nextRoundSwapDelta', 'nextRoundSecondsDelta',
  'nextRoundPlayCost', 'nextRoundDiscardCost', 'playHandCostThisRound', 'discardCostThisRound',
  'freeSwapsLeft', 'freeDiscardsLeft', 'pauseSecondsLeft', 'pauseInstanceGame', 'rewindInstanceGame',
  // ── Focus ──
  'focusNodes', 'focusCapBase', 'focusCapPerm', 'focusCapGains', 'focusGenGame', 'focusGenRound',
  'lastCalcMult', 'lastCalcFocus', 'lastPreHandFocus', 'lastPreFocusMult',
  // ── Entities owned ──
  'acquiredTricks', 'acquiredKnacks', 'trickTray', 'trickTrayMode',
  'grantedSleightIds', 'altarEffects', 'sleightCapBonus', 'entityTier',
  // r217: the slot machine's rotating buff cursor, and the event no-repeat memory.
  'slotBuffIdx', 'recentEventIds',
  'sleightNextHandDouble', 'sleightLegacyMult', 'sleightAmplifierMult',
  '_dabiSwapNext', 'sleightFreeSwapPending',
  // ── Permanent card buffs / curses ──
  'permPips', 'permMult', 'permXPips', 'permXMult', 'permRetrig', 'permTime', 'permCoins', 'permFocus',
  'permPipsGrow', 'permMultGrow', 'cardCurses',
  // Card states (r278). cardIdleSecs is deliberately NOT saved: the save point is
  // the START of a round and the fuses reset there anyway, so restoring last
  // round's idle seconds would arm a fuse the resumed round never earned.
  'cardStates',
  'cardPlayCount', 'cardSwapCount', 'cardDealtCount',
  // ── Hands ──
  'activeHands', 'unlockedHands', 'handsPendingUnlock', 'handTypesRound',
  '_comboAnnounced', '_comboHinted',
  // ── Trick / knack accumulators ──
  'bonusMult_fives', 'bonusMult_nines', 'bonusMult_tens', 'bonusMult_compound', 'spadesRelentless',
  'bonusFocus_acorns', 'bonusMult_morebetter', 'bonusPips_fengshui',
  'safetyNetUsed', 'negativeTilesTakenRun',
  '_perMinuteFired', 'handsPlayedGame', 'rowColBonuses', 'positionAxisNext', 'leyLinePos',
  'minuteHandCharges', 'understudyNextMark',
  'hallmarkCardId', 'hallmarkMarkAt', 'hallmarkPlanted', 'forcedTrickIds',
  'nsPlays', 'nsBonus', 'retriggersThisRound', 'woodpeckerActiveBlock', 'woodpeckerCardId', 'doubleJeopardyCells',
  // ── Round/run counters ──
  'handsPlayedRound', 'queenUpgradePending', 'queenBoardSecs', 'studyHallCards', 'runsPlayedRound', 'clubsScoredRound', 'setsPlayedRound', 'runStreak',
  'cardsDiscardedTotal', 'cardsDiscardedRound', 'cardsScoredTotal', 'nineSecondsCounter',
  'highestHandScore', 'highestHandName', 'fullHouseThisRound', 'gameStartTime', 'handLog',
  // The quarter report's books (js/quarter.js). Snapshot marks, not counters:
  // drop them and a resumed run's quarter rows read as the whole run so far.
  'quarterLog', 'qHandsMark', 'qScoreMark', 'qTricksMark', 'qStartTime',
  'qBestName', 'qBestScore', 'qPayouts', 'qBossName',
  'lastHandType', 'streakCount', 'lastHandTime', 'resilience', 'resilienceUsed',
  'firstHandThisRound', 'replaysThisRound', 'timeManipRound', 'roundContributions',
  // ── Reward grid / shop ──
  'rewardSelected', 'rewardCells', 'rewardConfirmed',
  'shopRerollCount', 'shopPurchased', 'shopPurchaseCount', 'nextShopTime',
  // ── Boss ──
  'bossActive', 'bossNumber', 'bossBag', 'actBossId', 'nextActBossId', 'nextBossTime', 'blockedCells', 'nullCells',
  // ── Challenge ──
  'challengeCard', 'challengeActive', 'trickCardPos', 'trickCardTimer',
  // ── Survival ──
  'survivalBossTimeBank', 'survivalBossPending', 'survivalLevelsSinceLimit', 'pickRerollsUsed',
  // The rest of the Survival loop's state. survivalBossesBeaten in particular gates the
  // 5-boss completion screen, so without it a resumed run never finishes.
  'survivalLevelsSinceKnack', 'pickRerollsLeft', 'survivalBossesBeaten',
  'survivalSecondsToBoss', 'survivalEndless', 'survivalEndlessFromLevel',
  // ── Flow (js/flow-mode.js) ──
  'flowBossFighting', 'flowRefillClock',
  // Flow multi-reward chain (js/flow-rewards.js, r325): extra rewards rolled
  // this run - gates the ordering phases, so a resumed run keeps its phase.
  'flowrExtraEarned',
  // ── Seed (keeps future reward grids / shops deterministic) ──
  'runSeed', 'rewardVisitIndex', 'shopVisitIndex', 'earlyLimitDone', 
];

// `const` objects can't be reassigned, so their CONTENTS are copied instead.
const SAVE_MUTATE = ['limits', 'C'];

// ── (de)serialisation ────────────────────────────────────────────────────────
// Sets are everywhere in this codebase (activeHands, blockedCells, …) and JSON
// turns them into `{}`, so they get an explicit tag. Everything else in the
// manifest is already plain data - verified: no entity in any pool carries a
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
  // The ORIENTATION MODE is a scripted run and not worth saving. A first run of
  // any OTHER mode is an ordinary run that happens to carry a walkthrough, and
  // `tutorialActive()` is cleared the moment that walkthrough ends anyway.
  if (ACTIVE_MODE && ACTIVE_MODE.tutorial === true) return;
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
      // A picker-built mode is not in MODES when the page next loads - it is
      // assembled from the answers, so the ANSWERS are what has to be saved.
      // Without this the restore below falls back to Classic and the run resumes
      // as a different game to the one that was saved.
      picker: ACTIVE_MODE.picker ? { ...ACTIVE_MODE.picker } : null,
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
  if (!runCheckpoint) return { ok: false, msg: 'No round checkpoint yet - start a round first.' };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(runCheckpoint));
  } catch (e) {
    return { ok: false, msg: 'Storage unavailable - this browser is blocking saved data.' };
  }
  if (window.LETHE_STORAGE_OK === false)
    return { ok: true, msg: 'Saved for this session only - this browser blocks stored data.' };
  const m = runCheckpoint.meta;
  return { ok: true, msg: `Saved - ${m.modeName}, Round ${m.level}.` };
}

function readSavedRun() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || !s.state || !s.meta) return null;
    if (s.v !== SAVE_VERSION && s.v !== 1) return null;   // v1 is migrated on resume
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

  // Rebuild a picker-built mode from its saved answers before the lookup, so
  // MODES.custom exists to be found. pickerBuildMode is pure, so this reproduces
  // the exact mode the run was started with.
  if (save.meta.picker && typeof pickerBuildMode === 'function') {
    MODES.custom = pickerBuildMode(save.meta.picker);
  }
  ACTIVE_MODE = MODES[save.meta.mode] || MODES.normal;
  // Re-pin the run's seed so reward grids and shops still follow the same
  // sequence after resuming (they key off runSeed + visit index - see seed.js).
  if (typeof setPendingRunSeed === 'function') setPendingRunSeed(save.state.runSeed || null);

  _restoringSave = true;
  startGame();                    // clean baseline: every global at a known value
  applySavedState(save.state);
  if (save.v < 2) migrateCardKeysToIds();
  // Natural Scaling was keyed by FAMILY before r198 and is keyed by hand type now.
  // Self-detecting, so it is safe to call on every restore.
  if (typeof migrateNaturalScaleFamilies === 'function') migrateNaturalScaleFamilies();
  // entityTier is just a map of numbers; the BONUSES it buys live in BAL, which
  // is recomputed from it. Without this a resumed run restores the tiers and
  // plays at base values.
  if (typeof applyEntityTiers === 'function') applyEntityTiers();
  dropUnknownCurses();
  // Guided's challenges lost their predicate to the JSON round trip - see the
  // note beside them in SAVE_VARS.
  if (typeof guidedRehydrateChallenges === 'function') guidedRehydrateChallenges();
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

// A save written before r192 keys every per-card map by "rank-suit". Re-key them
// onto the cards themselves. Where a face has more than one card (a duplicate), all
// of them inherit the buff, which is exactly what the old save meant by it - so a
// resumed run loses nothing and nothing gets worse.
// A save outlives deploys - main auto-deploys to Pages on every commit - so it can
// name a curse this build no longer defines. Such an entry has no meaning left, and
// every site that reads one assumes CURSE_DEFS has it, so drop it on the way in
// rather than leaving a live landmine in cardCurses.
function dropUnknownCurses() {
  if (typeof cardCurses !== 'object' || !cardCurses) return;
  Object.keys(cardCurses).forEach(k => {
    const c = cardCurses[k];
    if (!c || !CURSE_DEFS[c.id]) delete cardCurses[k];
  });
}

function migrateCardKeysToIds() {
  const maps = [permPips, permMult, permXPips, permXMult, permRetrig, permCoins, permFocus,
                permPipsGrow, permMultGrow,
                cardCurses, cardPlayCount, cardSwapCount, cardDealtCount];
  const olds = maps.map(m => ({ ...m }));
  maps.forEach(m => Object.keys(m).forEach(k => delete m[k]));
  everyDeckCard().forEach(card => {
    const face = cardKey(card.rank, card.suit);
    const id   = cardId(card);
    maps.forEach((m, i) => { if (face in olds[i]) m[id] = olds[i][face]; });
  });
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
  // A restore that throws part-way leaves the worst possible state: the menu is gone,
  // the round clock never started and the board is whatever the startGame baseline
  // dealt - the "blank screen on resume" report. There is no way to finish restoring
  // at that point, so hand the player back the menu and say so, instead of stranding
  // them on a dead board with a CONTINUE button that fails the same way every time.
  try {
    resumeSavedRun();
  } catch (e) {
    console.error('[save] resume failed', e);
    document.getElementById('main-menu-overlay').classList.add('show');
    if (typeof stopTimers === 'function') stopTimers();
    alert('That saved run could not be loaded - it was saved by a different version of the game. Starting a new run instead.');
    clearSavedRun();
  }
}

// A finished run's save is stale, but only if the save actually belongs to the
// run that just ended - a player may have saved run A, started run B, and died
// in B. `gameStartTime` is stamped once per run in startGame, so it identifies
// the run cheaply.
function retireSavedRunIfCurrent() {
  const s = readSavedRun();
  if (!s) return;
  if (typeof gameStartTime === 'number' && s.state && s.state.gameStartTime === gameStartTime) clearSavedRun();
  runCheckpoint = null;
}
