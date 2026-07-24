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
    if (ACTIVE_MODE.id !== 'normal') {
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

document.getElementById('btn-stats').addEventListener('click', () => {
  pauseGame(false); // pause timers but don't hide grid
  showStats();
});

document.getElementById('btn-deck').addEventListener('click', () => {
  pauseGame(false);
  showDeck();
});

// Resume when overlays are closed
document.querySelector('#stats-overlay .overlay-close').addEventListener('click', () => {
  document.getElementById('stats-overlay').classList.remove('show');
  resumeGame();
});

document.querySelector('#deck-overlay .overlay-close').addEventListener('click', () => {
  document.getElementById('deck-overlay').classList.remove('show');
  resumeGame();
});

function startGame() {
  document.getElementById('end-overlay').classList.remove('show');
  document.getElementById('levelup-overlay').classList.remove('show');
  document.getElementById('shop-overlay').classList.remove('show');
  stopTimers();
  if (levelupTimer) { clearInterval(levelupTimer); levelupTimer = null; }

  // Reset deck audit
  expectedDeckTotal = 52;
  dealPhase = false;

  // Reset all state
  score = 0;
  level = 1;
  leaves = 0;
  handsPlayed = 0;
  // Reset limits to base values on new game
  LIMITS_DEF.forEach(def => { limits[def.id] = { current: def.base, base: def.base, max: def.max }; });
  discards = limits.discards.current;
  swaps = limits.swaps.current;
  // Sync playing-grid dimensions from limits and size the cards
  gridRows = limits.grid_rows.current;
  gridCols = limits.grid_cols.current;
  recomputeGridMetrics();
  // Reset focus meter
  focusNodes = 0;
  focusCapacity = 3;
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
  roundSeconds = ROUND_DURATION;
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
  pauseInstanceGame = 0; // Hummingbird's per-game pause counter — reset only here
  stopwatchActive = false; if (stopwatchTimer) { clearInterval(stopwatchTimer); stopwatchTimer = null; } stopwatchCardPos = null;
  if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
  const ALL_HAND_KEYS = ['run3','threeofakind','fourofakind','run4','pair','twopair','straight','flush','fullhouse','straightflush','highcard','blackjack'];
  const BASE_HAND_KEYS = ['run3','threeofakind','twopair','fourofakind'];
  const startKeys = ACTIVE_MODE.id === 'normal' ? ALL_HAND_KEYS : BASE_HAND_KEYS;
  activeHands = new Set(startKeys);
  unlockedHands = new Set(startKeys);
  handsPendingUnlock = [];
  acquiredTricks = [];
  acquiredKnacks  = [];
  trickTray          = [];
  _trickReplaceQueue = [];
  syncTrickTrayUI();   // show the Trick tray (or grid-preview) to match trickTrayMode for the new game
  cardPlayCount   = {};
  cardSwapCount   = {};
  cardDealtCount  = {};
  grantedSleightIds = new Set();
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
  bonusPips_fengshui = 0;   // Feng Shui (per-game permanent scaler)
  _perMinuteFired = {};
  bonusMult_jackpot  = 0;
  jackpotFired       = false;
  safetyNetUsed      = false;
  handsPlayedRound   = 0;
  runsPlayedRound    = 0;
  handTypesRound     = new Set();
  cardsDiscardedTotal = 0;
  freeSwapsLeft    = 2;
  freeDiscardsLeft = 2;
  cardsDiscardedRound = 0;
  cardsScoredTotal = 0;
  nineSecondsCounter = 0;
  highestHandScore = 0;
  highestHandName  = null;
  gameStartTime    = Date.now();
  fullHouseThisRound = 0;
  rowColBonuses = [];
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
  document.getElementById('hand-name').textContent = '—';
  document.getElementById('selected-cards').innerHTML = '';
  selected = [];
  animating = false;
  falling = false;
  pendingAction = null;
  pendingEventOverride = null;
  rewardGridContext = 'interlude';
  skipTrickChoiceOverlay = false;
  rewardSelected = new Set();
  rewardCells = [];
  rewardConfirmed = false;
  actNumber = 1;
  nodeInAct = 0;
  forceBossNextRound = false;
  shopFromNodeFlow = false;
  updateActProgressUI();
  // Clear any leftover card elements from previous game
  document.getElementById('grid').querySelectorAll('.card').forEach(el => el.remove());
  roundGoal = BASE_GOAL;
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
  updateScoreUI();
  updateTrickList();
  updateClockUI();
  render();
  startTimers();
}

// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// CHALLENGE CARD SYSTEM
// ══════════════════════════════════════════════

