// PAUSE IS THE WAY INTO THE MENU, so it has to work on the screens that have no
// clock to stop - the map, the shop, a reward grid, the crossroads, an event.
// `pauseGame` used to return on `!roundInterval && !gameInterval && !countdownActive`
// ("nothing to pause") and the button silently did nothing on every one of them:
// measured in a real browser, the map / shop / reward grid all left `isPaused` false
// and the overlay hidden. There IS nothing to pause there; there is still a menu to
// open, and that is the button's other job.
//
// So pause now always opens the menu, and RESUME PUTS BACK ONLY WHAT THE PAUSE
// ACTUALLY STOPPED. That is the load-bearing half: resuming unconditionally would
// start the round timer BEHIND the map or the shop, which is the very thing
// screenOwnsClock() exists to prevent.
//
// TWO flags, not one, because the two clocks are independent and the legacy game
// timer is live in every mode - `gameInterval` is started for a Classic run as much
// as for a timer-mode one (its BODY is what `!isActMode()` guards, not its
// existence). Keying the round clock off "either was running" therefore still
// restarted it behind every takeover screen: measured, a reward grid resumed with
// roundInterval back despite having none when it opened.
//
// `roundInterval` is a faithful test for "the round clock is live": every path that
// leaves the round - stopTimers, triggerLevelUp, the goal dance, a takeover screen -
// nulls it. Pausing mid goal-dance therefore no longer restarts the clock of a round
// that has already been won, which the old unconditional startRoundTimer() did.
let pausedRoundClock = false;
let pausedGameClock  = false;

function pauseGame(hideGrid = true) {
  if (isPaused) return;
  // No run has started yet (the main menu), so there is no menu to open either.
  if (!gameStartTime) return;
  // A running 3-2-1 counts as something to pause: the round timer has not started yet,
  // so the old test also made PAUSE a no-op during the deal and the round began
  // underneath the pause menu.
  pausedRoundClock = !!roundInterval;
  pausedGameClock  = !!gameInterval;
  isPaused = true;
  if (countdownActive) {
    countdownPaused = true;
    // The digit's pop is a CSS animation, so it has to be held separately from the wait.
    const _cn = document.getElementById('countdown-321-number');
    if (_cn) _cn.style.animationPlayState = 'paused';
  }
  clearInterval(roundInterval); roundInterval = null;
  clearInterval(gameInterval);  gameInterval  = null;
  cancelAutoSubmit();
  // Hold the scoring dance where it is. It runs on its own clock (js/dance-clock.js)
  // and used to play on - and finish - behind the pause overlay, so the player came
  // back to a score that had moved with nothing left on screen to explain it.
  if (typeof dncSetPaused === 'function') dncSetPaused(true);
  if (hideGrid) {
    document.getElementById('pause-overlay').style.display = 'flex';
    document.getElementById('grid').style.visibility = 'hidden';
  }
  document.getElementById('btn-pause').textContent = '▶ Resume';
}

function resumeGame() {
  if (!isPaused) return;
  isPaused = false;
  if (typeof dncSetPaused === 'function') dncSetPaused(false);
  document.getElementById('pause-overlay').style.display = 'none';
  document.getElementById('grid').style.visibility = '';
  document.getElementById('btn-pause').textContent = '⏸ Pause';
  // Released mid-countdown: hand the count back, but do NOT start the round/boss timer -
  // the clock would run while the 3-2-1 is still on screen. The countdown's own
  // continuation starts it at the right moment. The game timer below still restarts,
  // since pauseGame cleared it and nothing else would put it back.
  if (countdownActive) {
    countdownPaused = false;
    const _cn = document.getElementById('countdown-321-number');
    if (_cn) _cn.style.animationPlayState = '';
  }
  // One clock (r205): startBossTimer re-arms any scheduled effects still pending
  // and then starts the same round timer everything else uses.
  // Guarded: paused from the map / shop / reward grid / an event there was no round
  // clock running, and starting one now would run the round behind that screen.
  else if (pausedRoundClock) { if (bossActive) startBossTimer(); else startRoundTimer(); }
  pausedRoundClock = false;
  if (!pausedGameClock) return;
  pausedGameClock = false;
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

// The one toggle. The in-stage PAUSE button uses it, and so do the pause chips on
// the three screens that COVER that button, which fixing pauseGame alone could not
// reach: an event and a Limit Break are full-screen panels over the whole stage
// (#event-bar / #lb-bar in index.html), and the map's own bottom strip is body-level
// and grows across the button row the moment an obligation is picked (#mb-pause,
// js/map-mode.js). A chip goes in the one part of each screen that never scrolls
// away - its bar.
function togglePauseMenu() {
  if (isPaused) resumeGame();
  else pauseGame(true);
}
document.getElementById('btn-pause').addEventListener('click', togglePauseMenu);

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
  // Read the SAME predicate the two charge sites read (js/round-timers.js), so
  // the quoted cost and the billed cost cannot drift. Before r234 this branch was
  // keyed on flowActive() while the charges were keyed on nothing at all, which is
  // how Flow came to display 0s and bill 8s.
  if (typeof interactTimeCostsOn === 'function' && !interactTimeCostsOn()) {
    set('ic-play', `${playHandCostThisRound || 0}s`); set('ic-discard', '0s'); set('ic-swap', '0s');
    const _dur = (typeof currentRoundDuration === 'function') ? currentRoundDuration() : ROUND_DURATION;
    set('ic-maxtime', (typeof formatTime === 'function') ? formatTime(_dur) : `${_dur}s`);
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
    // Shown value folds in luckModifiers (see limitShownValue); the /max stays on
    // the LIMIT, which is the part that can actually be maxed out.
    const shown = limitShownValue(def.id), dl = limitShownDelta(def.id);
    const dlStr = dl ? ` <span class="lp-max" style="color:${dl > 0 ? 'var(--gold)' : 'var(--red)'}">${dl > 0 ? '+' : ''}${dl}</span>` : '';
    const right = def.hideMax ? `${shown}${dlStr}` : `${shown}${dlStr}<span class="lp-max">/${l.max}</span>`;
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
  return (typeof shopGridActive !== 'undefined' && shopGridActive)
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
  // ARM THE WALKTHROUGH BEFORE markModeStarted, AND THAT ORDER IS THE WHOLE
  // MECHANISM (r283). modeNeedsTutorial() is "this mode has never been played",
  // and the very next line makes that false forever - so a live read anywhere
  // later in the run would say no. It is latched here, once, and tutorialActive()
  // reads the latch (js/tutorial.js).
  if (typeof tutorialArmForRun === 'function') tutorialArmForRun();
  // Record that this mode has been played (js/progress-unlock.js).
  if (typeof markModeStarted === 'function') markModeStarted(ACTIVE_MODE && ACTIVE_MODE.id);
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
  document.getElementById('boss-preamble')?.remove();
  document.querySelectorAll('.rp-block').forEach(el => el.classList.remove('boss-sigil'));

  // Install this run's RNG BEFORE any deck is built or shuffled - startGame is
  // the single point where a run's randomness is established (see js/seed.js).
  // A mode may pin a seed; a mode's FIRST run pins its own walkthrough seed, so
  // everyone's first Schedule is the same board and a bug report against it is
  // reproducible. Otherwise the dev panel's seed is used, and with neither the
  // run is plain unseeded.
  applyRunSeed(ACTIVE_MODE.seed
    || ((typeof tutorialRunSeed === 'function') ? tutorialRunSeed() : null)
    || pendingRunSeed || null);

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
    // Six Suits deals a DESIGNED deck (js/deck-design.js): the cut rank comes out
    // of ACTIVE_RANKS here, and expectedDeckTotal becomes ranks x copies rather
    // than ranks x suits. It must run AFTER ACTIVE_SUITS is set - the suit list
    // is what the copies are spread across.
    if (typeof deckDesignInstallLists === 'function') deckDesignInstallLists();
  }
  // A picker-built mode may name a scoring model. It is installed into the live
  // global only, never into localStorage: the dev panel's own choice is what a
  // mode WITHOUT one falls back to, so a custom run cannot leave its model behind
  // for the next Classic run. startGame is the single point both are set from.
  scoringModel = ACTIVE_MODE.scoringModel
              || (localStorage.getItem('scoringModel') || 'classic');
  // Spectrum zeroes the Flush of 3 (see applyModeHandValues); every other mode
  // gets the pristine table back.
  applyModeHandValues();
  // Some Tricks can't exist in this mode's deck (no Ace / no court / no ♠♥♦♣) -
  // rebuild the offerable pool before anything can draw from it.
  if (typeof applyModeEntityFilter === 'function') applyModeEntityFilter();
  // Reset deck audit (a full deck = one of every rank in every active suit)
  // A model that builds its own deck has already written the real total; a rank
  // x suit cross product is not what it deals, so the generic line must not run.
  if (!(typeof deckDesignOwnsDeck === 'function' && deckDesignOwnsDeck())) expectedDeckTotal = ACTIVE_SUITS.length * ACTIVE_RANKS.length;
  expectedDeckTotal += (typeof wildCardCount === 'function') ? wildCardCount() : 0;   // r325
  dealPhase = false;

  // Reset all state
  score = 0;
  level = 1;
  leaves = 0;
  handsPlayed = 0;
  // Reset limits to base values on new game.
  //
  // THROUGH makeLimitRow (js/limits.js), never spelled out here. This rebuild
  // used to write the row by hand and it dropped `step`, so from the first frame
  // of every run round_time.step and focus_cap.step were undefined and
  // incrementLimit's `(l.step || 1)` fell back to 1 - the real reason a Round Time
  // upgrade granted ONE SECOND instead of 15, everywhere it could be bought (the
  // shop, the reward grid, Limit Break, Growth Spurt, the Survival pick). r211
  // fixed the field; r227 removed the second copy that let it happen.
  LIMITS_DEF.forEach(def => { limits[def.id] = makeLimitRow(def); });
  // Match-3 modes start on a 5×5 board (owner spec). Setting it through `limits`
  // means level-ups keep the size instead of snapping back to the 4×4 base.
  if (match3Active()) {
    limits.grid_rows.current = 5; limits.grid_rows.base = 5;
    limits.grid_cols.current = 5; limits.grid_cols.base = 5;
  }
  // Poker Squares is a 5x5 board by definition - ten lines of five. Set through
  // `limits` for match3's reason: a level-up then keeps the size instead of
  // snapping back to the 4x4 base.
  if (typeof squaresActive === 'function' && squaresActive()) {
    limits.grid_rows.current = 5; limits.grid_rows.base = 5; limits.grid_rows.max = 5;
    limits.grid_cols.current = 5; limits.grid_cols.base = 5; limits.grid_cols.max = 5;
  }
  // Poker Squares moves two panels in the DOM (the piece hand below the board,
  // the round readout into the top bar), so a run that starts as ANY other mode
  // has to put them back. No-ops when nothing was moved.
  if (typeof squaresTeardown === 'function' && !(typeof squaresActive === 'function' && squaresActive())) squaresTeardown();
  // Survival: reset its per-run state and flag the stage (shows the shop button).
  document.getElementById('stage')?.classList.toggle('survival-mode', survivalActive());
  if (typeof pickRerollsInit === 'function') pickRerollsInit();  // the pick-of-three reroll pool (js/grid-pick.js)
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
  slotBuffIdx = 0;               // the slot machines' rotating buff cursor (js/events-slots.js)
  recentEventIds = [];           // the event no-repeat memory is per run, not per session
  // Flow runs a short 20-node Focus bar (decay is that mode's only pressure); every
  // other mode takes the Focus Cap limit as before. See flowFocusCapBase().
  focusCapBase = (typeof flowFocusCapBase === 'function')
               ? flowFocusCapBase()
               : ((typeof limits !== 'undefined' && limits.focus_cap) ? limits.focus_cap.current : 30);
  focusCapPerm = 0;
  focusCapGains = {}; queenUpgradePending = new Set(); queenBoardSecs = {};
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
  luckModifiers = 0;
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
  pauseInstanceGame = 0; rewindInstanceGame = 0; // Hummingbird's per-game pause counter - reset only here
  stopwatchActive = false; if (stopwatchTimer) { clearInterval(stopwatchTimer); stopwatchTimer = null; } stopwatchCardPos = null;
  if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
  if (typeof resetClockFx === 'function') resetClockFx();  // no frozen/rotated cards carried into a new run
  // The big hands (r199) are always in the list - they need Selection Size past 5
  // to be reachable at all, which is gate enough. flush3/flush4 stay OUT: they are
  // still not something you may PLAY here, only something a hand may LAYER.
  const ALL_HAND_KEYS = ['run3','threeofakind','fourofakind','run4','pair','twopair','straight','flush','fullhouse','straightflush','highcard','blackjack',
                         'run6','run7','flush6','flush7','fiveofakind','sixofakind','sevenofakind'];
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
  earlyLimitDone = false;     // early-limit guidance re-arms for the new run (js/limits.js)
  trickTray          = [];
  syncTrickTrayUI();   // show the Trick tray (or grid-preview) to match trickTrayMode for the new game
  cardPlayCount   = {};
  cardSwapCount   = {};
  cardDealtCount  = {};
  grantedSleightIds = new Set();
  // Mart per-run state: pinned catalog items (r171) and the Tinker bench's fee
  // ladder (r175). Pins hold payload objects with live buy() functions, which is
  // why they are NOT in SAVE_VARS - the Mart is shut at every save point anyway.
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
  permTime   = {};
  permCoins  = {};
  permFocus  = {};
  permPipsGrow = {}; permMultGrow = {};
  cardCurses = {};
  if (typeof cardStatesResetRun === 'function') cardStatesResetRun();   // r278
  bonusMult_fives = 0;
  bonusMult_nines = 0;
  bonusMult_tens = 0;
  bonusMult_compound = 0;
  spadesRelentless = 0;
  goalHandCards = null; goalHandHeld = [];
  bonusFocus_acorns  = 0;   // Acorns (per-game Focus accumulator)
  handsPlayedGame    = 0;   // Plan Ahead (per-game hand count)
  bonusMult_morebetter = 0; // More Better (per-game reward-grid mult accumulator)
  negativeTilesTakenRun = 0; // Wild Side / Wait For Iiiit / Shady Stimulants (per-run negative-tile tally)
  bonusPips_fengshui = 0;   // Feng Shui (per-game permanent scaler)
  _perMinuteFired = {};
  safetyNetUsed      = false;
  handsPlayedRound   = 0;
  studyHallCards     = 0;   // Study Hall's every-2nd-card counter runs for the whole run
  runsPlayedRound    = 0;
  clubsScoredRound   = 0;
  setsPlayedRound    = 0;
  runStreak          = 0;
  handTypesRound     = new Set();
  cardsDiscardedTotal = 0;
  freeSwapsLeft    = 2;
  freeDiscardsLeft = 2;
  cardsDiscardedRound = 0;
  swapsUsedRound = 0;
  discardsUsedRound = 0;
  focusGenRound = 0;
  cardsScoredTotal = 0;
  nineSecondsCounter = 0;
  highestHandScore = 0;
  highestHandName  = null;
  if (typeof resetQuarterLog === 'function') resetQuarterLog();   // js/quarter.js
  if (typeof hideQuarterCard === 'function') hideQuarterCard();
  if (typeof resetHandLog === 'function') resetHandLog();
  gameStartTime    = Date.now();
  fullHouseThisRound = 0;
  rowColBonuses = [];
  // The alternating row/column cursor (r296, js/scoring.js). Per RUN, so every
  // run's first position Trick marks a row; left alone it would carry whatever
  // the last run finished on.
  positionAxisNext = 'row';
  // ...and the per-Trick `_posAssigned` guard with it, or the pool objects the
  // grant paths hand out carry the last run's assignment and every position
  // Trick granted from here on silently marks nothing (js/scoring.js).
  resetPositionMarks();
  _posChooserQueue = []; _posChooserActive = false;
  { const _pc = document.getElementById('pos-chooser'); if (_pc) _pc.remove(); }
  leyLinePos = null;
  minuteHandCharges = 0;
  // Seeded to the first interval, not 0: `_elapsedRound >= 0` is already true on
  // the round's first tick, which would prime a Trick one second into the run.
  understudyNextMark = BAL.understudy.interval_seconds;
  hallmarkCardId = null; hallmarkMarkAt = -1; hallmarkPlanted = false;
  forcedTrickIds = [];
  lastHandType = null;
  streakCount = 0;
  lastHandTime = 0;
  resilience = false;
  resilienceUsed = false;
  firstHandThisRound = true;
  cancelAutoSubmit();
  cancelDance();
  handReadyForSubmit = false;
  updateHandNameLabel(null);   // clears the label AND its cache (js/hud.js)
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
  nodeFlowAfterShop = null;
  if (typeof guidedResetRun === 'function') guidedResetRun();  // Guided's slot counter + event offers
  if (typeof mapResetRun === 'function') mapResetRun();        // Map mode: generate the board (js/map-mode.js)
  recentEventIds = [];
  sleightCapBonus = {};   // Workshop's raised charge ceilings are per run
  // Improvement tiers are per run. resetEntityTiers() also rewrites BAL back to
  // its printed values - clearing the map alone would leave the previous run's
  // improved numbers live for the whole of this one.
  if (typeof resetEntityTiers === 'function') resetEntityTiers();
  updateActProgressUI();
  // Clear any leftover card elements from previous game
  document.getElementById('grid').querySelectorAll('.card').forEach(el => el.remove());
  roundGoal = goalForLevel(1);  // js/goal-tuning.js: per-mode curve + Zen's doubling
  totalScore = 0;
  lastRoundScore = 0; lastRoundGoal = 0;
  coins = 0;
  shopItems = null;
  shopPurchased = new Set();
  shopRerollCount = 0;
  shopPurchaseCount = { buy: 0, remove: 0, duplicate: 0, suit: 0, combine: 0, swaps: 0, discards: 0 };
  svcMode = null;
  svcPicked = [];
  nextShopTime = GAME_DURATION - 120;

  // Reset boss state
  bossActive = false;
  blockedCells = new Set();
  bossNumber = 0;
  bossBag = [];              // fresh shuffled boss bag per run (see nextBossPreset)
  actBossId = null;          // quarter 1's boss is dealt below, once the mode is set
  nextActBossId = null;      // and nothing has looked into the quarter after it yet
  savedRoundSeconds = 0;
  nextBossTime = GAME_DURATION - BOSS_LOOP_DURATION;
  document.getElementById('grid').classList.remove('boss-active');
  document.getElementById('clock').classList.remove('boss-mode');
  document.getElementById('clock-bar').classList.remove('boss-mode');
  document.getElementById('boss-banner')?.classList.remove('show');
  document.getElementById('boss-result')?.classList.remove('show');
  document.getElementById('grid').querySelectorAll('.blocked-cell').forEach(el => el.remove());

  isPaused = false;
  pausedRoundClock = pausedGameClock = false;
  document.getElementById('pause-overlay').style.display = 'none';
  document.getElementById('grid').style.visibility = '';
  document.getElementById('btn-pause').textContent = '⏸ Pause';
  document.getElementById('clock').classList.remove('urgent');
  document.getElementById('clock-bar').classList.remove('urgent');

  // r238: deal QUARTER 1's boss. After the seed is installed (so it is part of
  // the seeded run) and BEFORE initGridData, so it cannot perturb the deck
  // draw order - bosses and the deck are separate seeded streams, but the draw
  // still has to happen at a fixed point or "seed X, quarter 1" stops meaning
  // one thing. isActMode() is already settled here, so Survival and Flow
  // correctly hold nothing.
  drawActBoss();

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
  // Map mode: freeze the round startTimers just armed and put the map over it.
  // The first level tile confirmed resumes exactly this round (js/map-mode.js).
  if (typeof mapActive === 'function' && mapActive()) mapBeginRun();
  // Poker Squares: same shape as the map's hook - stop the round startTimers
  // just armed (there is no clock here) and take the board over.
  if (typeof squaresActive === 'function' && squaresActive()) squaresBeginRun();
}

// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// CHALLENGE CARD SYSTEM
// ══════════════════════════════════════════════

