function pauseGame(hideGrid = true) {
  if (isPaused) return;
  if (!roundInterval && !gameInterval) return; // nothing to pause
  isPaused = true;
  clearInterval(roundInterval); roundInterval = null;
  clearInterval(gameInterval);  gameInterval  = null;
  // Pause boss tick too if active
  if (bossInterval) { clearInterval(bossInterval); bossInterval = null; }
  cancelAutoSubmit();
  if (hideGrid) {
    document.getElementById('pause-overlay').style.display = 'flex';
    document.getElementById('grid').style.visibility = 'hidden';
  }
  document.getElementById('btn-pause').textContent = '▶ Resume';
}

function resumeGame() {
  if (!isPaused) return;
  isPaused = false;
  document.getElementById('pause-overlay').style.display = 'none';
  document.getElementById('grid').style.visibility = '';
  document.getElementById('btn-pause').textContent = '⏸ Pause';
  if (bossActive) {
    startBossTimer(); // resume boss tick instead of round timer
  } else {
    startRoundTimer();
  }
  // Restart game timer
  gameInterval = setInterval(() => {
    if (gameTimerPaused) return;
    gameSeconds--;
    // See startTimers: match-3 and dominoes own their round loops, skip legacy progression.
    if (!isActMode() && !match3Active() && !dominoActive() && !survivalActive()) {
      const m = Math.floor(gameSeconds/60);
      const s = gameSeconds%60;
      document.getElementById('game-timer').textContent = `${m}:${s.toString().padStart(2,'0')}`;
      if (gameSeconds === nextShopTime) {
        if (bossActive) {
          nextShopTime -= 1;
        } else {
          nextShopTime -= 120;
          triggerShop();
        }
      }
      if (gameSeconds === nextBossTime && !bossActive) {
        nextBossTime -= BOSS_LOOP_DURATION;
        triggerBoss();
      }
      if (gameSeconds <= 0) onGameEnd(false);
    }
  }, 1000);
}

document.getElementById('btn-pause').addEventListener('click', () => {
  if (isPaused) resumeGame();
  else pauseGame(true);
});

document.getElementById('btn-resume').addEventListener('click', resumeGame);

// Pause-menu "Home" button - abandon the current run and return to the main menu.
// A full page reload is the cleanest teardown: the game keeps a lot of live state
// (round/game/boss timers, decks, overlays, match-3/dominoes state) and there is no
// single reset function that unwinds all of it, whereas the page boots straight to
// the home menu on load (index.html #main-menu-overlay starts shown; bootstrap.js
// calls initMainMenu()). Guarded by a confirm so a stray tap can't lose a run.
function quitToMainMenu() {
  // A saved run is not lost by quitting - only the progress made since the save
  // point is, so the warning should not claim otherwise.
  const _saved = (typeof savedRunSummary === 'function') ? savedRunSummary() : null;
  const _msg = _saved
    ? `Return to the home screen? You can CONTINUE from your save (Round ${_saved.level}); anything since then is lost.`
    : 'Return to the home screen? Your current run will be lost.';
  if (!confirm(_msg)) return;
  location.reload();
}

// The four secondary chips (Stats / Deck / Time / Limits) were merged into the single
// RECORDS hub in r155 (js/records.js) - a large tabbed pop-up that pauses the round.
// showStats() / showDeck() and the Time + Limits pop-ups are kept: the dev panel and
// the Mart still open them, and the tutorial's Limits step points at Records now.

// ⏱ Time - small pop-up showing the time-cost breakdown (like stats/deck/pause,
// but a lightweight bubble anchored above the button). Replaces the old chip.
function hideTimePopup() {
  const pop = document.getElementById('interact-costs');
  if (pop) pop.classList.remove('show');
}
// Fill the time popup with LIVE values: interaction costs (incl. reward-grid
// debuffs), the round's max time, and how many times it's been paused / rewound.
function updateInteractCosts() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  // Flow charges no time for anything - spendRoundTime is a no-op there, because its
  // clock is the countdown to the boss rather than a round budget. Quote that, or the
  // pop-up drifts from reality the way it did before r151.
  if (typeof flowActive === 'function' && flowActive()) {
    set('ic-play', '0s'); set('ic-discard', '0s'); set('ic-swap', '0s');
    set('ic-maxtime', (typeof formatTime === 'function') ? formatTime(FLOW_SESSION_SECONDS) : `${FLOW_SESSION_SECONDS}s`);
    set('ic-paused',  `${pausesThisRound  || 0}×`);
    set('ic-rewound', `${rewindsThisRound || 0}×`);
    return;
  }
  // Play is 0 by default (r50); a "Hands +Ns" debuff makes it cost that much.
  set('ic-play', `${playHandCostThisRound || 0}s`);
  // Discard cost per card: 3 base, 0 with Free Discards, 6 with Hoarder, + reward debuff.
  let disc = (typeof BAL !== 'undefined') ? BAL._resources.discard_seconds_per_card : 3;
  if (typeof hasKnack === 'function' && hasKnack('free_discards')) disc = 0;
  else { if (typeof hasKnack === 'function' && hasKnack('hoarder')) disc = BAL.hoarder.discard_seconds_per_card; disc += (discardCostThisRound || 0); }
  if (typeof bossInteractMult === 'function') disc = Math.round(disc * bossInteractMult());
  set('ic-discard', `${disc}s`);
  // Swap cost: 4 base, 0 with Free Swaps.
  let swap = (typeof BAL !== 'undefined') ? BAL._resources.swap_seconds : 8;
  if (typeof hasKnack === 'function' && hasKnack('free_swaps')) swap = 0;
  else if (typeof hasKnack === 'function' && hasKnack('steady_hand')) swap = BAL.steady_hand.swap_seconds;
  if (typeof bossInteractMult === 'function') swap = Math.round(swap * bossInteractMult());
  set('ic-swap', `${swap}s`);
  // Max time = round cap minus permanent (−5s) penalties.
  const base = (typeof ROUND_DURATION !== 'undefined') ? ROUND_DURATION : 180;
  const cap  = Math.max(base, limits.round_time.current) - (roundPenaltySeconds || 0);
  set('ic-maxtime', (typeof formatTime === 'function') ? formatTime(Math.max(0, cap)) : `${cap}s`);
  set('ic-paused',  `${pausesThisRound  || 0}×`);
  set('ic-rewound', `${rewindsThisRound || 0}×`);
}
function toggleTimePopup() {
  const pop = document.getElementById('interact-costs');
  const btn = document.getElementById('btn-time');
  if (!pop || !btn) return;
  if (pop.classList.contains('show')) { hideTimePopup(); return; }
  updateInteractCosts();                     // refresh live values before showing
  pop.classList.add('show');                 // .show → display:flex (CSS)
  const r = btn.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  let top  = r.top - ph - 8;
  left = Math.max(6, Math.min(window.innerWidth - pw - 6, left));
  if (top < 6) top = r.bottom + 8;
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}
document.getElementById('btn-time')?.addEventListener('click', (e) => {
  e.stopPropagation();
  hideLimitsPopup();
  toggleTimePopup();
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#btn-time') && !e.target.closest('#interact-costs')) hideTimePopup();
}, true);

// ▲ Limits - the same lightweight bubble as ⏱ Time, but for the upgradeable caps.
// Limits are the run's skeleton (how big the board is, how many swaps/discards you
// get, how long a round lasts, how many Tricks you can hold) and until now they were
// only visible inside the Mart. This puts them one tap away during play.
function hideLimitsPopup() { document.getElementById('limits-popup')?.classList.remove('show'); }
function updateLimitsPopup() {
  const rows = document.getElementById('limits-popup-rows');
  if (!rows) return;
  rows.innerHTML = LIMITS_DEF.map(def => {
    const l = limits[def.id];
    const maxed = l.current >= l.max;
    // hideMax limits (Selection Size) have no meaningful ceiling to show.
    const right = def.hideMax ? `${l.current}` : `${l.current}<span class="lp-max">/${l.max}</span>`;
    return `<div class="ic-r lp-r${maxed ? ' lp-maxed' : ''}" title="${def.desc}">` +
           `<span><span class="lp-ico">${def.icon}</span>${def.label}</span>` +
           `<span>${right}</span></div>`;
  }).join('');
}
function toggleLimitsPopup() {
  const pop = document.getElementById('limits-popup');
  const btn = document.getElementById('btn-limits');
  if (!pop || !btn) return;
  if (pop.classList.contains('show')) { hideLimitsPopup(); return; }
  updateLimitsPopup();
  pop.classList.add('show');
  const r = btn.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  let top  = r.top - ph - 8;
  left = Math.max(6, Math.min(window.innerWidth - pw - 6, left));
  if (top < 6) top = r.bottom + 8;
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}
document.getElementById('btn-limits')?.addEventListener('click', (e) => {
  e.stopPropagation();
  hideTimePopup();
  toggleLimitsPopup();
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#btn-limits') && !e.target.closest('#limits-popup')) hideLimitsPopup();
}, true);

// Stats / Deck can also be opened from a takeover screen (the Mart shop), where there is
// no round running to resume - resuming there would start the round timer behind the shop.
// screenOwnsClock() is true whenever some other screen owns the clock, and the openers below
// skip pauseGame() in that case, so the close handler must skip resumeGame() to match.
function screenOwnsClock() {
  return (typeof martActive !== 'undefined' && martActive)
      || (typeof shopGridActive !== 'undefined' && shopGridActive)
      || document.getElementById('shop-overlay')?.classList.contains('show')
      || (typeof rewardOnGrid !== 'undefined' && rewardOnGrid);
}
function closeInfoOverlay(id) {
  document.getElementById(id).classList.remove('show');
  if (!screenOwnsClock()) resumeGame();
}
// Resume when overlays are closed
document.querySelector('#stats-overlay .overlay-close').addEventListener('click', () => closeInfoOverlay('stats-overlay'));
document.querySelector('#deck-overlay .overlay-close').addEventListener('click', () => closeInfoOverlay('deck-overlay'));

function startGame() {
  // Dolly the camera in onto the CRT (js/camera.js). A run starting is the only
  // thing that means "we are at the machine now" - the way back out is driven off
  // the menu screens showing, so SETTINGS / HISTORY / BUILDS, which all hide the
  // main menu to open their own screen, can't push the camera in behind them.
  if (typeof camEnterGame === 'function') camEnterGame();
  // Music can differ between the menu and a run (see js/music.js); a track marked
  // 'any' plays through the change, one marked 'menu' hands over here.
  if (typeof musicSetScene === 'function') musicSetScene('game');
  document.getElementById('end-overlay').classList.remove('show');
  document.getElementById('levelup-overlay').classList.remove('show');
  document.getElementById('shop-overlay').classList.remove('show');
  stopTimers();
  if (levelupTimer) { clearInterval(levelupTimer); levelupTimer = null; }

  // Abandoning a run mid-boss would otherwise leave its scheduled effects running
  // - a quarantine cross landing 10 seconds into the NEXT run. Kill them here,
  // where every new run funnels through.
  bossActive = false;
  if (typeof clearBossEffects === 'function') clearBossEffects();
  if (typeof bossInterval !== 'undefined' && bossInterval) { clearInterval(bossInterval); bossInterval = null; }
  document.getElementById('boss-preamble')?.remove();
  document.querySelectorAll('.rp-block').forEach(el => el.classList.remove('boss-sigil'));

  // Install this run's RNG BEFORE any deck is built or shuffled - startGame is
  // the single point where a run's randomness is established (see js/seed.js).
  // A mode may pin a seed (the tutorial does); otherwise the dev panel's seed is
  // used, and with neither the run is plain unseeded.
  applyRunSeed(ACTIVE_MODE.seed || pendingRunSeed || null);

  // Lock in this run's difficulty tier. Copied out of pendingDifficulty here, at
  // the one point a run begins, so nothing the player touches on a menu later can
  // reach the board mid-run (see js/difficulty.js).
  runDifficulty = (typeof pendingDifficulty === 'number') ? pendingDifficulty : 1;

  // Pick the suit + rank lists for this mode BEFORE any deck is built. Six Suits
  // uses the expanded 6-suit list, Spectrum swaps both lists for the numeric
  // colour deck (7 colours × 1-15,20 = 112 cards); every other mode uses the
  // classic four suits and A-K.
  if (ACTIVE_MODE.numeric) {
    // Spectrum reads its lists from the dev tuner (dev panel → Spectrum), which
    // defaults to every value and every colour. See js/spectrum.js.
    spectrumInstallLists();
  } else {
    ACTIVE_SUITS = (ACTIVE_MODE.suitCount === 6) ? SUITS_SIX : SUITS;
    ACTIVE_RANKS = RANKS;
  }
  // Spectrum zeroes the Flush of 3 (see applyModeHandValues); every other mode
  // gets the pristine table back.
  applyModeHandValues();
  // Some Tricks can't exist in this mode's deck (no Ace / no court / no ♠♥♦♣) -
  // rebuild the offerable pool before anything can draw from it.
  if (typeof applyModeEntityFilter === 'function') applyModeEntityFilter();
  // Reset deck audit (a full deck = one of every rank in every active suit)
  expectedDeckTotal = ACTIVE_SUITS.length * ACTIVE_RANKS.length;
  dealPhase = false;

  // Reset all state
  score = 0;
  level = 1;
  leaves = 0;
  handsPlayed = 0;
  // Reset limits to base values on new game
  LIMITS_DEF.forEach(def => { limits[def.id] = { current: def.base, base: def.base, max: def.max }; });
  // Match-3 modes start on a 5×5 board (owner spec). Setting it through `limits`
  // means level-ups keep the size instead of snapping back to the 4×4 base.
  if (match3Active()) {
    limits.grid_rows.current = 5; limits.grid_rows.base = 5;
    limits.grid_cols.current = 5; limits.grid_cols.base = 5;
  }
  // Survival: reset its per-run state and flag the stage (shows the shop button).
  document.getElementById('stage')?.classList.toggle('survival-mode', survivalActive());
  if (survivalActive()) survivalInitRun();
  if (typeof flowInitRun === 'function' && flowActive()) flowInitRun();
  // Flow hook for mode-scoped CSS (it charges no time, so the action buttons must
  // not advertise a second-cost). Separate from .survival-mode, which still does.
  document.getElementById('stage')?.classList.toggle('flow-mode', typeof flowActive === 'function' && flowActive());
  // r175 - the top-left "Game Timer" is the legacy 20-minute run clock. Match-3,
  // Dominoes and Survival/Flow are all excluded from it (see the startTimers
  // guard above and in resumeGame), so in those modes it sat frozen on 20:00
  // forever. Act modes reuse the same slot for the ACT · node readout, and the
  // remaining legacy timer modes genuinely run it - so the slot is hidden for
  // exactly the set that neither uses. Derived from the SAME predicate the timer
  // itself is gated on, so a new mode cannot drift out of sync with it.
  document.getElementById('stage')?.classList.toggle('no-game-clock',
    match3Active() || dominoActive() || survivalActive());
  if (typeof updateSurvivalShopBtn === 'function') updateSurvivalShopBtn();
  discards = limits.discards.current;
  swaps = limits.swaps.current;
  // Sync playing-grid dimensions from limits and size the cards
  gridRows = limits.grid_rows.current;
  gridCols = limits.grid_cols.current;
  if (dominoActive()) { gridRows = DOMINO_ROWS; gridCols = DOMINO_COLS; }
  recomputeGridMetrics();
  // Reset focus meter
  focusNodes = 0;
  growthSpurtCapPenalty = 0;      // reset Growth Spurt's eroded Focus ceiling
  growthSpurtMaxedThisRound = false;
  siphonMultX = 1;               // clear any pending Siphon charge
  // Flow runs a short 20-node Focus bar (decay is that mode's only pressure); every
  // other mode takes the Focus Cap limit as before. See flowFocusCapBase().
  focusCapBase = (typeof flowFocusCapBase === 'function')
               ? flowFocusCapBase()
               : ((typeof limits !== 'undefined' && limits.focus_cap) ? limits.focus_cap.current : 30);
  focusCapPerm = 0;
  focusGenGame = 0; focusGenRound = 0;
  focusAnimQueue = [];
  focusAnimRunning = false;
  lastCalcMult = 0;
  lastCalcFocus = 1;
  lastPreHandFocus = 1;
  lastPreFocusMult = 0;
  buildFocusMeter();
  syncFocusMeterState();
  accumulatedSwaps = 0;
  accumulatedDiscards = 0;
  accumulatedSeconds = 0;
  swapMode = false;
  swapFirst = null;
  swapPending = null;
  lastTapCell = null;
  lastTapTime = 0;
  lastSwapTime = 0;
  roundSeconds = currentRoundDuration();  // Survival runs shorter rounds
  gameSeconds = GAME_DURATION;
  trickCardPos = null;
  trickCardTimer = 0;
  // Reset challenge state
  challengeCard = null;
  challengeActive = false;
  roundPenaltySeconds = 0;
  extraPlayCostPerm = 0; extraDiscardCostPerm = 0;
  nextRoundDiscardDelta = 0; nextRoundSwapDelta = 0; nextRoundSecondsDelta = 0;
  nextRoundPlayCost = 0; nextRoundDiscardCost = 0;
  playHandCostThisRound = 0; discardCostThisRound = 0;
  goalPenaltyMult = 1; focusRatePenalty = 1; skipNextPayout = false;
  pendingEntityLockout = null; entityLockout = null;
  deadCells = new Set(); riderTrickId = null; interestFreezeRounds = 0;
  spotCheckHand = null; spotCheckLeft = 0; nextRoundGridShrink = null;
  clearTimeout(challengeOverlayTimer);
  document.getElementById('challenge-overlay').classList.remove('show');
  // Reset goal/level-up queue
  goalReachedThisRound = false;
  roundEnded = false;
  pendingLevelUps = 0;
  suppressScoreDisplay = false;
  heldBackScore = 0;
  pipeTimerPaused = false;
  pauseSecondsLeft = 0;
  pauseInstanceGame = 0; // Hummingbird's per-game pause counter - reset only here
  stopwatchActive = false; if (stopwatchTimer) { clearInterval(stopwatchTimer); stopwatchTimer = null; } stopwatchCardPos = null;
  if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
  if (typeof resetClockFx === 'function') resetClockFx();  // no frozen/rotated cards carried into a new run
  const ALL_HAND_KEYS = ['run3','threeofakind','fourofakind','run4','pair','twopair','straight','flush','fullhouse','straightflush','highcard','blackjack'];
  const BASE_HAND_KEYS = ['run3','threeofakind','twopair','fourofakind'];
  // Match-3 scores real hand names (Flush, Straight, Straight Flush, Run of 4…),
  // so it needs the full hand set active like the act modes, not the legacy base four.
  const startKeys = [...(isActMode() || match3Active() || survivalActive() ? ALL_HAND_KEYS : BASE_HAND_KEYS)];
  // Six Suits (6) and Spectrum (7 colours) both dilute the deck enough that the
  // short flushes are playable from the start alongside the 5-card Flush.
  if (ACTIVE_MODE.suitCount >= 6) startKeys.push('flush3', 'flush4');
  if (typeof resetNaturalScaling === 'function') resetNaturalScaling();
  activeHands = new Set(startKeys);
  unlockedHands = new Set(startKeys);
  handsPendingUnlock = [];
  acquiredTricks = [];
  acquiredKnacks  = [];
  tempoInitApplied = false;   // Tempo's one-time limit-set can run again for a fresh run
  trickTray          = [];
  _trickReplaceQueue = [];
  syncTrickTrayUI();   // show the Trick tray (or grid-preview) to match trickTrayMode for the new game
  cardPlayCount   = {};
  cardSwapCount   = {};
  cardDealtCount  = {};
  grantedSleightIds = new Set();
  // Mart per-run state: pinned catalog items (r171) and the Tinker bench's fee
  // ladder (r175). Pins hold payload objects with live buy() functions, which is
  // why they are NOT in SAVE_VARS - the Mart is shut at every save point anyway.
  if (typeof martPins   !== 'undefined') martPins   = {};
  if (typeof martTinkerN !== 'undefined') martTinkerN = 0;
  altarEffects    = [];
  sleightNextHandDouble = false;
  sleightLegacyMult    = false;
  sleightAmplifierMult = 0;
  _dabiSwapNext        = false;
  magnetArmed          = null;
  _comboAnnounced      = new Set();
  _comboHinted         = new Set();
  sleightFreeSwapPending = false;
  // Reset all counters
  Object.keys(C).forEach(k => C[k] = (typeof C[k] === 'boolean' ? false : 0));
  permPips = {};
  permMult = {};
  permXPips  = {};
  permXMult  = {};
  permRetrig = {};
  cardCurses = {};
  bonusMult_fives = 0;
  bonusMult_nines = 0;
  bonusMult_tens = 0;
  bonusMult_compound = 0;
  bonusPips_prolific = 0;
  bonusFocus_acorns  = 0;   // Acorns (per-game Focus accumulator)
  handsPlayedGame    = 0;   // Plan Ahead (per-game hand count)
  bonusMult_morebetter = 0; // More Better (per-game reward-grid mult accumulator)
  negativeTilesTakenRun = 0; // Wild Side / Wait For Iiiit / Shady Stimulants (per-run negative-tile tally)
  bonusPips_fengshui = 0;   // Feng Shui (per-game permanent scaler)
  _perMinuteFired = {};
  bonusMult_jackpot  = 0;
  jackpotFired       = false;
  safetyNetUsed      = false;
  handsPlayedRound   = 0;
  runsPlayedRound    = 0;
  setsPlayedRound    = 0;
  runStreak          = 0;
  handTypesRound     = new Set();
  cardsDiscardedTotal = 0;
  freeSwapsLeft    = 2;
  freeDiscardsLeft = 2;
  cardsDiscardedRound = 0;
  focusGenRound = 0;
  cardsScoredTotal = 0;
  nineSecondsCounter = 0;
  highestHandScore = 0;
  highestHandName  = null;
  if (typeof resetHandLog === 'function') resetHandLog();
  gameStartTime    = Date.now();
  fullHouseThisRound = 0;
  rowColBonuses = [];
  _posChooserQueue = []; _posChooserActive = false;
  { const _pc = document.getElementById('pos-chooser'); if (_pc) _pc.remove(); }
  leyLinePos = null;
  lastHandType = null;
  streakCount = 0;
  lastHandTime = 0;
  resilience = false;
  resilienceUsed = false;
  firstHandThisRound = true;
  cancelAutoSubmit();
  cancelDance();
  handReadyForSubmit = false;
  document.getElementById('hand-name').textContent = '';   // empty → "HAND" watermark shows (r99)
  document.getElementById('selected-cards').innerHTML = '';
  selected = [];
  animating = false;
  falling = false;
  pendingAction = null;
  pendingEventOverride = null;
  rewardGridContext = 'interlude';
  skipTrickChoiceOverlay = false;
  rewardSelected = new Set();
  rewardPickOrder = [];
  rewardTipKey = null;
  rewardCells = [];
  rewardConfirmed = false;
  actNumber = 1;
  nodeInAct = 0;
  rewardGridsSeen = 0;
  forceBossNextRound = false;
  shopFromNodeFlow = false;
  updateActProgressUI();
  // Clear any leftover card elements from previous game
  document.getElementById('grid').querySelectorAll('.card').forEach(el => el.remove());
  roundGoal = survivalActive() ? survivalGoalForLevel(1)
            : (match3IsZen() ? BASE_GOAL * 2 : BASE_GOAL); // Zen: doubled goals, no clock
  totalScore = 0;
  coins = 0;
  shopItems = null;
  shopPurchased = new Set();
  shopRerollCount = 0;
  shopPurchaseCount = { buy: 0, remove: 0, duplicate: 0, suit: 0, combine: 0, swaps: 0, discards: 0 };
  svcMode = null;
  svcPicked = [];
  nextShopTime = GAME_DURATION - 120;

  // Reset boss state
  if (bossInterval) { clearInterval(bossInterval); bossInterval = null; }
  bossActive = false;
  bossSecondsLeft = 0;
  blockedCells = new Set();
  bossNumber = 0;
  bossBag = [];              // fresh shuffled boss bag per run (see nextBossPreset)
  savedRoundSeconds = 0;
  nextBossTime = GAME_DURATION - BOSS_LOOP_DURATION;
  document.getElementById('grid').classList.remove('boss-active');
  document.getElementById('clock').classList.remove('boss-mode');
  document.getElementById('clock-bar').classList.remove('boss-mode');
  document.getElementById('boss-banner')?.classList.remove('show');
  document.getElementById('boss-result')?.classList.remove('show');
  document.getElementById('grid').querySelectorAll('.blocked-cell').forEach(el => el.remove());

  isPaused = false;
  document.getElementById('pause-overlay').style.display = 'none';
  document.getElementById('grid').style.visibility = '';
  document.getElementById('btn-pause').textContent = '⏸ Pause';
  document.getElementById('clock').classList.remove('urgent');
  document.getElementById('clock-bar').classList.remove('urgent');

  initGridData();
  // Spectrum: shuffle the four deck fixtures in. AFTER initGridData - it assigns
  // drawPile wholesale, so anything added before this would be thrown away.
  spectrumGrantDeckCards();
  // Match-3: quietly re-draw any matches the deal happened to create, so the
  // player starts from a still board instead of being handed a free cascade.
  if (match3Active()) match3SettleBoard();
  updateScoreUI();
  updateTrickList();
  updateClockUI();
  render();
  startTimers();
  // Zen mode hands out unlimited swaps/discards (see match3ApplyZenResources).
  if (match3Active()) { match3ApplyZenResources(); setTimeout(() => match3Resolve(), 400); }
  // Tutorial mode: rig the opening board + goal, then start the coach-marks.
  // Must run LAST - it overwrites roundGoal/coins and re-renders the stacked grid.
  if (tutorialActive()) tutorialBeginRun();
}

// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// CHALLENGE CARD SYSTEM
// ══════════════════════════════════════════════

