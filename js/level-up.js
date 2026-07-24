function drainLevelUpQueue() {
  triggerLevelUp();
}

// Compute the resource values (discards / swaps / seconds) a new round should start with.
// Single source of truth — used by the round-start reset AND by reward-grid hover projections.
// Folds in limit-breaks, carry-over knacks, round-start knacks, and pending next-round deltas.
function computeRoundResources() {
  const limitDiscardBonus = limits.discards.current   - limits.discards.base;
  const limitSwapBonus    = limits.swaps.current      - limits.swaps.base;
  const limitTimeBonus    = limits.round_time.current - limits.round_time.base;

  const baseDiscards = 4 + limitDiscardBonus + (hasKnack('extra_discards') ? BAL.extra_discards.discards : 0);
  const baseSwaps    = (hasKnack('free_range_t') ? 2 : 3) + limitSwapBonus + (hasKnack('extra_swaps') ? BAL.extra_swaps.swaps : 0);
  // Round-time cap = full duration minus permanent penalties, plus any limit-break trick.
  const baseSeconds  = Math.max(10, (ROUND_DURATION - roundPenaltySeconds) + limitTimeBonus);
  const secCap = Math.max(ROUND_DURATION, limits.round_time.current);

  let d   = Math.min(99, baseDiscards + accumulatedDiscards) + nextRoundDiscardDelta;
  let s   = Math.min(99, baseSwaps    + accumulatedSwaps)    + nextRoundSwapDelta;
  let sec = Math.min(secCap, baseSeconds + accumulatedSeconds + nextRoundSecondsDelta);

  // Round-start knack effects.
  if (hasKnack('time_bank'))      sec = Math.min(secCap, sec + BAL.time_bank.seconds);
  if (hasKnack('extra_swaps'))    s += BAL.extra_swaps.swaps;
  if (hasKnack('extra_discards')) d += BAL.extra_discards.discards;

  return { discards: Math.max(0, d), swaps: Math.max(0, s), seconds: Math.max(1, sec) };
}

function triggerLevelUp() {
  // During a boss, the legacy goal-based level-up flow is suppressed.
  // The new XP-grid level-up (Step 2) will replace this entirely; for now,
  // we just skip the old round-reset to avoid disrupting the boss.
  if (bossActive) return;
  clearInterval(roundInterval);
  roundInterval = null;
  goalReachedThisRound = false;
  roundEnded = false;

  // Apply any pending grid-size changes for the new round, then resize cards.
  // Must happen before Trick re-placement and the deal animation populate gridData.
  gridRows = limits.grid_rows.current;
  gridCols = limits.grid_cols.current;
  recomputeGridMetrics();
  // Structurally conform gridData to the new dimensions, preserving in-bounds cells.
  // (Out-of-bounds cells from a shrunk grid are simply dropped; their cards are
  //  effectively returned via flushPlayedDeck on the next cycle.)
  {
    const newGrid = [];
    for (let r = 0; r < gridRows; r++) {
      newGrid[r] = [];
      for (let c = 0; c < gridCols; c++) {
        newGrid[r][c] = (gridData[r] && gridData[r][c] !== undefined) ? gridData[r][c] : null;
      }
    }
    gridData = newGrid;
  }

  level++;
  // This round's score target, from zero
  roundGoal = Math.round(Math.round(BASE_GOAL * Math.pow(GOAL_SCALE, level - 1)) / 500) * 500;
  totalScore += score; // bank the completed round's score for the end-of-run display
  score = 0;           // fresh round, fresh score

  // Reset round
  flushPlayedDeck(); // played cards rejoin the pool for the new round

  // Bank unused resources before resetting
  if (hasKnack('carry_swaps'))    accumulatedSwaps    = Math.min(BAL.carry_swaps.max, accumulatedSwaps    + swaps);
  if (hasKnack('carry_discards')) accumulatedDiscards = Math.min(BAL.carry_discards.max, accumulatedDiscards + discards);
  if (hasKnack('carry_time'))     accumulatedSeconds  = Math.min(BAL.carry_time.max_seconds, accumulatedSeconds + roundSeconds);

  // Base reset — resource values computed by computeRoundResources() (single source of truth).
  const _rr = computeRoundResources();
  discards     = _rr.discards;
  swaps        = _rr.swaps;
  roundSeconds = _rr.seconds;
  // Per-action time-cost debuffs active this round = permanent + next-round-only.
  playHandCostThisRound = extraPlayCostPerm    + nextRoundPlayCost;
  discardCostThisRound  = extraDiscardCostPerm + nextRoundDiscardCost;
  // Next-round-only deltas have now been folded in — clear them.
  nextRoundDiscardDelta = 0; nextRoundSwapDelta = 0; nextRoundSecondsDelta = 0;
  nextRoundPlayCost = 0; nextRoundDiscardCost = 0;

  // ── Knack effects at round start ──
  if (hasKnack('inheritance')) { coins += BAL.inheritance.coins; updateCoinsUI(); }
  // Reset Combo Keeper state each round (knack starts each round armed)
  streakSaveArmed = true;
  streakSaveProgress = 0;

  // Clear accumulators now that they've been applied
  if (hasKnack('carry_discards')) accumulatedDiscards = 0;
  if (hasKnack('carry_swaps'))    accumulatedSwaps    = 0;
  if (hasKnack('carry_time'))     accumulatedSeconds  = 0;
  lastSwapTime = 0;
  lastSwapRoundSeconds = null;
  lastHandRoundSeconds = null;
  firstHandThisRound = true;
  freeSwapsLeft    = 2;
  freeDiscardsLeft = 2;
  cardsDiscardedRound = 0;
  handsPlayedRound = 0;
  runsPlayedRound  = 0;
  handTypesRound   = new Set();
  assemblyMarkCount = 0;   // Assembly Line
  markCount_groove  = 0;   // Groove
  markCount_overtime = 0;  // Overtime
  _cleanSweepPrev   = [];  // Clean Sweep
  _perMinuteFired   = {};  // once-per-minute gate (Study Hall, Ley Line)
  fullHouseThisRound = 0;
  roundContributions = {};
  roundHandsScored = 0;
  tickAltarEffects();
  // Reset the once-per-round activation lock on double_tap / on_swap sleights
  for (let _jr = 0; _jr < gridRows; _jr++) for (let _jc = 0; _jc < gridCols; _jc++) {
    const _jcard = gridData[_jr][_jc];
    if (_jcard?._isSleight) _jcard._usedThisRound = false;
  }
  // Coin Toss: each owned Sleight has a 50% chance to regain 1 charge at round start
  if (hasKnack('coin_toss')) {
    let _refilled = 0;
    ownedSleightCards().forEach(card => {
      if (card._usesLeft === 'infinite' || typeof card._usesLeft !== 'number') return;
      const def = SLEIGHT_POOL.find(j => j.id === card.sleightId);
      const cap = (def && typeof def.durability === 'number') ? def.durability : card._usesLeft;
      if (card._usesLeft < cap && Math.random() < 0.5) { card._usesLeft++; _refilled++; }
    });
    if (_refilled) showMessage(`Coin Toss: ${_refilled} Sleight${_refilled > 1 ? 's' : ''} regained a charge`, 'var(--gold)');
  }
  setTimeout(checkComboMilestones, 600); // combo legibility toast (after the deal settles)
  fireSleightsAtRoundStart();
  // (♠ exalt/corrupt is now play/discard-driven — handled in playHand and doDiscard, not at deal)
  fireSleightsOnDraw();
  // Reset focus meter at start of every round (chunk 2 will add notch-fall animation)
  focusNodes = 0;
  focusAnimQueue = [];
  focusAnimRunning = false;
  syncFocusMeterState();
  updateFocusMultReadout(false);
  // Recompute decay interval (Meditation may be acquired/lost between rounds)
  recomputeFocusDecayInterval();
  // Tunnel Vision: start each round with 5 focus
  if (hasTrick('tunnel_vision')) addFocus(5);
  // ── Timing/Streak batch: pause-themed Trick state, reset each round ──
  pausedSecondsRound = 0;
  rewoundSecondsRound = 0;
  retriggersThisRound = 0;
  cuckooNextMinute = BAL.cuckoo.interval_seconds;
  // Clock-mark Tricks + Déjà Vu: pending bonuses and rank-history reset each round
  pendingHandPips = 0; pendingHandMult = 0; pendingCardPips = 0;
  lastHandRankKey = null;
  _altSwapCount = 0;
  doubleJeopardyPos = hasTrick('double_jeopardy') ? { r: Math.floor(Math.random() * gridRows), c: Math.floor(Math.random() * gridCols) } : null;
  djUsedThisRound = false;
  firstPauseStartedRound = false;
  firstPauseActive = false;
  woodpeckerPos = null;
  woodpeckerActiveBlock = -1;
  // Metronome knack: pick this round's target hand type from those the player can actually make.
  if (hasKnack('metronome')) {
    const _ach = achievableHandTypes();
    metronomeHandType = _ach[Math.floor(Math.random() * _ach.length)] || null;
    if (metronomeHandType) showMessage('🥁 Metronome: ' + metronomeHandType, '#5aa9e6');
  } else metronomeHandType = null;
  // Shady Tree sleight: pick this round's "shady" column.
  shadyColumn = Math.floor(Math.random() * gridCols);
  // Stopwatch: clear any lingering freeze/timer from the previous round.
  stopwatchActive = false;
  if (stopwatchTimer) { clearInterval(stopwatchTimer); stopwatchTimer = null; }
  stopwatchCardPos = null;
  trickCardPos = null;
  trickCardTimer = 0;
  selected = [];

  // Sapling trick — give perm pips to 3 distinct normal cards
  if (hasTrick('sapling')) {
    const eligible = [];
    for (let r = 0; r < gridRows; r++)
      for (let c = 0; c < gridCols; c++) {
        const card = gridData[r]?.[c];
        if (card && !card._isTrick && !card._isSleight && !card._isStone && card.rank)
          eligible.push(card);
      }
    // supplement with draw pile if not enough on grid
    drawPile.forEach(card => { if (card && !card._isTrick && !card._isSleight && !card._isStone && card.rank) eligible.push(card); });
    for (let i = eligible.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [eligible[i],eligible[j]]=[eligible[j],eligible[i]]; }
    eligible.slice(0, 3).forEach(card => {
      const k = cardKey(card.rank, card.suit);
      permPips[k] = (permPips[k]||0) + 2;
    });
  }

  updateScoreUI();

  // Mark whether a challenge should spawn when the round starts (after all bonuses picked)
  challengeActive = false;
  challengeCard = null;

  showLevelUpScreen();
}

async function showLevelUpScreen() {
  animating = true;
  selected = [];
  const gridEl = document.getElementById('grid');

  // ── Collect existing Tricks ──
  const returningTricks = [];
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++)
      if (gridData[r][c]?._isTrick)
        returningTricks.push({ ...gridData[r][c], _trickState: gridData[r][c]._trickState || 'acquired', savedRow: r, savedCol: c });

  // ── Pick Trick options + pre-assign target positions ──
  sfxLevelUp();
  trickSelectionPhase = true;

  // Re-place returning Tricks at saved positions
  returningTricks.forEach(trick => {
    gridData[trick.savedRow][trick.savedCol] = {
      rank: null, suit: null, _isTrick: true, _selectable: false,
      _trickState: trick._trickState, trick: trick.trick, _id: trick._id
    };
  });

  // Mark upgradeable — Tricks in the middle row's inner columns qualify
  const _trickMidRow = Math.floor(gridRows / 2);
  const _trickInnerCols = Array.from({length: Math.max(0, gridCols - 2)}, (_, i) => i + 1);
  returningTricks.forEach(trick => {
    if (trick.savedRow === _trickMidRow && _trickInnerCols.includes(trick.savedCol)) {
      const cell = gridData[trick.savedRow][trick.savedCol];
      if (cell._trickState === 'acquired') cell._trickState = 'upgradeable';
    }
  });

  // Determine available slots for new Tricks (middle row, inner columns)
  const spawnSlots = _trickInnerCols.filter(c => !gridData[_trickMidRow][c]);
  trickSelectionOptions = pickTrickOptions(spawnSlots.length);
  let trickIdCounter = 90000 + (level * 10);

  // Pre-assign random target grid positions for new Tricks (excluding middle row inner cols)
  const occupiedByReturning = new Set(returningTricks.map(trick => `${trick.savedRow}-${trick.savedCol}`));
  const spawnExcluded = new Set(_trickInnerCols.map(c => `${_trickMidRow}-${c}`));
  const candidateCells = [];
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++)
      if (!occupiedByReturning.has(`${r}-${c}`) && !spawnExcluded.has(`${r}-${c}`))
        candidateCells.push([r, c]);
  // Shuffle candidates
  for (let i = candidateCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidateCells[i], candidateCells[j]] = [candidateCells[j], candidateCells[i]];
  }

  // Assign target positions to new Trick options
  trickSelectionOptions.forEach((trick, i) => {
    const [targetRow, targetCol] = candidateCells[i] || [0, i];
    trick._targetRow = targetRow;
    trick._targetCol = targetCol;
  });

  // Don't place new Tricks into gridData yet — they live in the overlay during selection
  // Fill ALL cells with regular cards for now (Tricks will be placed after pick)
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++)
      if (!gridData[r][c]) gridData[r][c] = drawCard() || null;

  // ── Hide grid visually until 3-2-1 fires — deal anims handle the reveal ──
  dealPhase = true;
  // Remove all card DOM elements from the previous round immediately
  const _gridEl = document.getElementById('grid');
  _gridEl?.querySelectorAll('[data-card-id]').forEach(el => el.remove());
  // Defensive: scrub any leftover boss visual state so a post-boss round starts clean
  // (blocked-cell overlays, stray temp-anim clones, boss-active styling).
  _gridEl?.querySelectorAll('.blocked-cell, .temp-anim').forEach(el => el.remove());
  _gridEl?.classList.remove('boss-active');

  // ── Grid is now populated; deal animations start in show321Countdown ──
  dealAnims = [];

  animating = false; // allow Trick taps immediately

  if (skipTrickChoiceOverlay) {
    // Reward grid already handled rewards — skip Trick pick, go straight to new round
    skipTrickChoiceOverlay = false;
    trickSelectionPhase = false;
    showNextGoalFlash().then(() => show321Countdown()).then(() => {
      gameTimerPaused = false;
      sfxRoundStart();
      updateClockUI();
      render();
      if (forceBossNextRound) {
        forceBossNextRound = false;
        triggerBoss(); // boss takes over timing — do NOT call startRoundTimer()
      } else {
        startRoundTimer();
      }
    });
  } else {
    // ── Show target slot glow on grid for each new Trick ──
    trickSelectionOptions.forEach(trick => {
      const slot = document.createElement('div');
      slot.className = 'trick-target-slot';
      slot.dataset.trickId = trick.id;
      slot.style.cssText = `width:${CARD_W}px;height:${CARD_H}px;left:${cellLeft(trick._targetCol)}px;top:${cellTop(trick._targetRow)}px;`;
      gridEl.appendChild(slot);
    });

    // ── Show Trick choice overlay immediately (cards deal slowly behind it) ──
    showTrickChoiceOverlay();
  }
}

// ── Deal animations: called from show321Countdown when 3-2-1 starts ──
// Cards fall in at normal speed while dark bg fades out.
function startNewRoundDealAnims() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;

  // Clear any existing real card elements so only temp-anims are visible
  gridEl.querySelectorAll('[data-card-id]:not(.temp-anim)').forEach(el => el.remove());

  dealPhase = true; // suppress render() from placing real cards until anims finish

  const FALL_DUR   = 420;
  const COL_OFFSET = 60;
  const BOUNCE_PX  = 8;
  const SQUISH     = 0.10;
  const colReadyAt = {};
  dealAnims = [];

  for (let c = 0; c < gridCols; c++) {
    for (let r = gridRows - 1; r >= 0; r--) {
      const card = gridData[r][c];
      if (!card) continue;
      const isTrick  = card._isTrick;
      const trick = isTrick ? card.trick : null;

      const destX      = cellLeft(c);
      const destY      = cellTop(r);
      const fromAbove  = (gridRows - r);
      const startY     = destY - fromAbove * CARD_STEP;
      const dropDist   = fromAbove * CARD_STEP;
      const colBase    = c * COL_OFFSET;
      const entryStart = Math.max(colBase, colReadyAt[c] || colBase);
      colReadyAt[c]    = entryStart + FALL_DUR * 0.6;

      const tempEl = buildCardAnimEl(card, r, c);
      tempEl.style.left    = destX + 'px';
      tempEl.style.top     = startY + 'px';
      tempEl.style.opacity = '0';
      tempEl.dataset.cardId = String(card._id);
      tempEl.dataset.row    = r;
      tempEl.dataset.col    = c;
      tempEl.style.cssText  = `position:absolute;width:${CARD_W}px;height:${CARD_H}px;left:${destX}px;top:${startY}px;opacity:0;pointer-events:none;z-index:10;`;
      gridEl.appendChild(tempEl);

      dealAnims.push(tempEl.animate([
        { opacity: 0, transform: 'translateY(0) scaleY(1)' },
        { opacity: 1, transform: 'translateY(0) scaleY(1)',                                              offset: 0.06 },
        { opacity: 1, transform: `translateY(${dropDist * 0.55}px) scaleY(0.96)`,                       offset: 0.55, easing: 'ease-in' },
        { opacity: 1, transform: `translateY(${dropDist + BOUNCE_PX}px) scaleY(${1 - SQUISH})`,         offset: 0.83 },
        { opacity: 1, transform: `translateY(${dropDist - BOUNCE_PX * 0.7}px) scaleY(${1 + SQUISH})`,   offset: 0.91 },
        { opacity: 1, transform: `translateY(${dropDist + BOUNCE_PX * 0.3}px) scaleY(${1 - SQUISH * 0.2})`, offset: 0.96 },
        { opacity: 1, transform: `translateY(${dropDist}px) scaleY(1)` },
      ], { duration: FALL_DUR, delay: entryStart, easing: 'ease-in', fill: 'forwards' }));
    }
  }

  Promise.all(dealAnims.map(a => a.finished)).then(() => {
    gridEl.querySelectorAll('.temp-anim').forEach(el => el.remove());
    dealAnims = [];
    dealPhase = false; // re-enable normal render
    animating = false;
    if (!trickSelectionPhase) render();
  });
}

