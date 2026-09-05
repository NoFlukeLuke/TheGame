function doDiscard() {
  // Dominoes mode has its own discard flow (tiles return to the domino deck).
  if (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE.id === 'dominoes') { dominoDiscard(); return; }
  // On grid-takeover screens the Discard button is repurposed: LEAVE (shop) / CLEAR (reward).
  if (typeof shopGridActive !== 'undefined' && shopGridActive) { closeShopGrid(); return; }
  if (rewardOnGrid) { clearRewardSelection(); return; }
  if (roundEnded || animating) return;
  if (falling) { if (selected.length > 0) { pendingAction = 'discard'; dbgEvent('info', 'discard queued (falling)'); } return; }
  if (selected.length === 0) return;
  // Defensive: filter selection down to actually-discardable cards
  const validSelected = selected.filter(([r,c]) => {
    const card = gridData[r]?.[c];
    return card && cardCan(card, 'discard');
  });
  if (validSelected.length === 0) {
    selected = [];
    render();
    return;
  }
  selected = validSelected;
  const discardedCards = selected.map(([r,c]) => gridData[r][c]);
  // Lucky Sevens: +3 Focus per 7 discarded
  if (hasTrick('lucky_sevens')) { const _sv = discardedCards.filter(c => c?.rank === '7').length; if (_sv) addFocus(_sv * BAL.lucky_sevens.focus); }
  // The Vulture: cards discarded during the round's first clock pause gain a permanent "pause on score" buff (stacks)
  if (hasTrick('vulture') && firstPauseActive) discardedCards.forEach(c => { if (c) c._vulturePause = (c._vulturePause || 0) + BAL.vulture.pause_seconds; });
  // ♠ corrupts after being discarded 2×; a swap-pending ♥ counts as "not played" → corrupt.
  // Flags are set on the card object directly since it's leaving the grid (persists in the pile).
  if (exaltCorruptEnabled) // ── discard-driven corruption skipped while the mechanic is paused ──
  discardedCards.forEach(card => {
    if (!card || card._isSleight || card._isTrick || card._isStone || !card.rank) return;
    if (card._exalted || card._corrupted) return;
    if (card.suit === '♠') {
      card._spadeDiscards = (card._spadeDiscards || 0) + 1;
      if (card._spadeDiscards >= 2) { card._exalted = false; card._corrupted = true; showMessage('♠ Spade corrupted - discarded one too many times', '#cc88ff'); }
    } else if (card.suit === '♥' && card._heartSwapPending) {
      card._exalted = false; card._corrupted = true; card._heartSwapPending = false;
      showMessage('♥ Heart corrupted - discarded after a swap', '#cc88ff');
    }
  });
  // on_discard sleights (Not a Friend corrupt) fire with their grid position before removal.
  // Snapshot the non-sleight cards discarded alongside so Sandbagger can check for a low pair.
  _discardContextCards = discardedCards.filter(c => c && c.rank && !c._isSleight);
  selected.forEach(([r,c]) => {
    const card = gridData[r]?.[c];
    if (card?._isSleight) {
      const def = sleightDef(card);
      if (def?.activation === 'on_discard') {
        applySleightGridEffect(def.id, r, c);
        consumeSleightCharge(card, r, c);
      }
    }
  });
  _discardContextCards = null;
  // Adjacency reactions fire while the discarded cards are still in place.
  feedWhetstones(selected.map(([r,c]) => [r,c]));  // Whetstone sharpens on adjacent discards
  juryRigRoll(selected.map(([r,c]) => [r,c]));     // Jury-Rig: charge-restore roll per adjacent Sleight
  selected.forEach(([r,c]) => { if (gridData[r]?.[c]) discardToDrawPile(gridData[r][c]); });
  // Hoarder: discards don't count against limit (but cost 2× time below)
  if (!hasKnack('hoarder')) discards--;
  // Discard time cost - 3s PER CARD (BAL._resources.discard_seconds_per_card).
  // There used to be a flat spendRoundTime(DISCARD_TIME_COST) here as well, so a
  // 1-card discard billed 3 + 3 = 6s while the UI said 3s, and the Free Discards
  // knack ("costs no time") still charged the flat 3s. One charge only now.
  // Reward-grid time penalties add to the per-card cost (unless discards are free).
  let perCardCost = BAL._resources.discard_seconds_per_card;
  if (hasKnack('free_discards')) perCardCost = 0;
  else { if (hasKnack('hoarder')) perCardCost = BAL.hoarder.discard_seconds_per_card; perCardCost += (discardCostThisRound || 0); }
  const usingFreeDiscard = perCardCost > 0 && freeDiscardsLeft > 0;
  if (usingFreeDiscard) freeDiscardsLeft--;
  const timeCost = usingFreeDiscard ? 0 : Math.round(discardedCards.length * perCardCost * bossInteractMult());
  if (timeCost > 0) {
    roundSeconds = Math.max(1, roundSeconds - timeCost);
    showTimeCost(`-${timeCost}s`);
  }
  updateClockUI();
  if (typeof bossOnInteract === 'function') bossOnInteract('discard');
  // Track discard counts
  const count = discardedCards.length;
  cardsDiscardedTotal += count;
  cardsDiscardedRound += count;
  // Five for Fodder: discarding a 5-card hand grants credits
  if (hasTrick('five_fodder') && count === 5) {
    coins += BAL.five_fodder.credits; updateCoinsUI();
    showMessage('Five for Fodder! +' + BAL.five_fodder.credits + ' credits', 'var(--gold)');
  }
  // Penny Saved: each 5 discarded adds +5 pips to trick
  if (hasTrick('fives_discard')) {
    const fivesCount = discardedCards.filter(c => c.rank === '5').length;
    bonusMult_fives += fivesCount * BAL.fives_discard.pips_per_five;
  }
  // Perfect Ten: every 10 total discards adds +1 mult
  if (hasTrick('tens_mult')) {
    const prevTens = Math.floor((cardsDiscardedTotal - count) / BAL.tens_mult.discards_per_milestone);
    const newTens  = Math.floor(cardsDiscardedTotal / BAL.tens_mult.discards_per_milestone);
    bonusMult_tens += (newTens - prevTens) * BAL.tens_mult.mult_per_milestone;
  }
  // Down and Back In: discarding the grid's entire top rank refunds a resource + coins.
  // gridData still holds the discarded cards here (removeAndFall runs last), so the "top
  // rank" is measured against the board as it was when the player chose to discard.
  if (hasKnack('down_and_back_in')) {
    let _hi = -1; const _hiCards = [];
    for (let _r = 0; _r < gridRows; _r++) for (let _c = 0; _c < gridCols; _c++) {
      const _cd = gridData[_r]?.[_c];
      if (!_cd || !_cd.rank || _cd._isSleight || _cd._isStone || _cd._isTrick) continue;
      const _v = rankHighVal(_cd.rank);
      if (_v > _hi) { _hi = _v; _hiCards.length = 0; _hiCards.push(_cd); }
      else if (_v === _hi) _hiCards.push(_cd);
    }
    if (_hi > 0 && _hiCards.length && _hiCards.every(hc => discardedCards.includes(hc))) {
      if (_dabiSwapNext) { swaps++; showMessage(`Down and Back In: +1 swap, +${BAL.down_and_back_in.coins} coins`, 'var(--gold)'); }
      else { discards++; showMessage(`Down and Back In: +1 discard, +${BAL.down_and_back_in.coins} coins`, 'var(--gold)'); }
      _dabiSwapNext = !_dabiSwapNext;
      coins += BAL.down_and_back_in.coins; updateCoinsUI();
    }
  }
  // Martyr: sacrificing a non-discard Sleight refills 1 charge on every OTHER on-grid Sleight
  if (hasKnack('martyr') && discardedCards.some(c => c?._isSleight && sleightDef(c)?.activation !== 'on_discard')) {
    let _restored = 0;
    for (let _r = 0; _r < gridRows; _r++) for (let _c = 0; _c < gridCols; _c++) {
      const _sc = gridData[_r]?.[_c];
      if (!_sc?._isSleight || discardedCards.includes(_sc) || _sc._usesLeft === 'infinite' || typeof _sc._usesLeft !== 'number') continue;
      const _def = SLEIGHT_POOL.find(j => j.id === _sc.sleightId);
      const _cap = _def && typeof _def.durability === 'number' ? _def.durability : _sc._usesLeft;
      if (_sc._usesLeft < _cap) { _sc._usesLeft++; _restored++; }
    }
    if (_restored) showMessage(`Martyr: +1 charge to ${_restored} Sleight${_restored > 1 ? 's' : ''}`, 'var(--gold)');
  }
  sfxFlipShuffle();
  resetFocusDecayTimer();
  // Cull: using a discard adds 1 focus
  if (hasTrick('cull')) addFocus(1);
  const toRemove = [...selected];
  selected = [];
  removeAndFall(toRemove, 'discard');
}

// ══════════════════════════════════════════════
// TIME COST FLASH
// ══════════════════════════════════════════════
function showTimeCost(label) {
  let el = document.getElementById('time-cost-flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'time-cost-flash';
    el.style.cssText = `
      position:absolute; pointer-events:none; z-index:300;
      font-family:'Cinzel',serif; font-size:13px; font-weight:700;
      color:#e05555; text-shadow:0 0 8px rgba(224,85,85,0.6);
      left:50%; transform:translateX(-50%);
      opacity:0;
    `;
    document.getElementById('clock-area')?.appendChild(el);
  }
  el.textContent = label;
  el.style.transition = 'none';
  el.style.opacity = '1';
  el.style.top = '-4px';
  void el.offsetWidth;
  el.style.transition = 'top 0.7s ease-out, opacity 0.7s ease-out';
  el.style.top = '-22px';
  el.style.opacity = '0';
}

// ── Rewind: give round seconds back (clock counts down, so rewinding = adding time) ──
// Adds `seconds` to roundSeconds, capped at ROUND_DURATION, and shows a floater/message.
// Returns the seconds actually restored. Bosses run their own timer, so rewinds are ignored there.
// How high a rewind is allowed to push the clock. NOT the bare ROUND_DURATION
// (r183): that constant is Classic's 180, and the clock legitimately sits ABOVE
// it in several ordinary situations -
//   · Survival rounds are 120s and Flow's session clock is 300s
//   · the Round Time LIMIT can be upgraded past 180, and a round starts at it
//   · Time Bank (+30s at round start) and Clock Tower (carries up to 60s over)
//   · Rain Check (+30s next round)
// against `Math.min(ROUND_DURATION, …)` every one of those made a rewind CUT the
// clock down to 180 and then return 0, so it reported nothing and the player just
// lost the time. In Flow that was 120 seconds destroyed by a single Flush.
//
// `roundStartSeconds` is what this round ACTUALLY began with - startRoundTimer
// records it after computeRoundResources has already folded in the Round Time
// limit, Time Bank and Clock Tower - so it is the whole answer for those three
// and no separate limits lookup is needed. Reading the limit as well would let a
// 120s Survival round be rewound up to Classic's 180.
//
// `roundSeconds` is in the max too, so the clamp can never move the clock
// backwards: the worst a rewind can now do is nothing.
function rewindCeiling() {
  const dur = (typeof currentRoundDuration === 'function') ? currentRoundDuration() : ROUND_DURATION;
  return Math.max(dur, roundStartSeconds || 0, roundSeconds);
}

function rewindTime(seconds, label) {
  if (bossActive) return 0;
  seconds = Math.floor(seconds);
  if (seconds <= 0) return 0;
  const before = roundSeconds;
  roundSeconds = Math.min(rewindCeiling(), roundSeconds + seconds);
  const gained = roundSeconds - before;
  if (gained <= 0) return 0;
  rewoundSecondsRound += gained; // Kingfisher scales on seconds rewound this round
  rewindsThisRound++;            // per-round rewind count (time popup)
  updateClockUI();
  // Infinity-mirror copies under every card + the reversed swell (js/clock-fx.js)
  if (typeof playRewindFX === 'function') playRewindFX();
  const el = document.getElementById('time-cost-flash') ||
    (() => { const e = document.createElement('div'); e.id = 'time-cost-flash'; e.style.cssText =
      `position:absolute; pointer-events:none; z-index:300; font-family:'Cinzel',serif; font-size:13px; font-weight:700;
       color:#5aa9e6; text-shadow:0 0 8px rgba(90,169,230,0.6); left:50%; transform:translateX(-50%); opacity:0;`;
      document.getElementById('clock-area')?.appendChild(e); return e; })();
  el.style.color = '#5aa9e6'; el.style.textShadow = '0 0 8px rgba(90,169,230,0.6)';
  el.textContent = `⏪ +${gained}s`;
  el.style.transition = 'none'; el.style.opacity = '1'; el.style.top = '-4px';
  void el.offsetWidth;
  el.style.transition = 'top 0.7s ease-out, opacity 0.7s ease-out';
  el.style.top = '-22px'; el.style.opacity = '0';
  if (label) showMessage(label, '#5aa9e6');
  return gained;
}

// ── Clock-mark Tricks: fire as the round clock passes static timestamps ──
// Called once per real second from the round timer with the NEW roundSeconds value.
// Because rewinds add seconds, the clock can pass the same mark more than once - that
// re-fires these bonuses, which is an intended synergy with the rewind entities.
function handleClockMarks(secs) {
  if (secs <= 0) return;
  // Tick-Tock: clock reading ends in a 0 → +2 Focus
  if (secs % 10 === 0 && hasTrick('ticktock')) { addFocus(BAL.ticktock.focus); }
  // Quarter Chime: clock reads a multiple of 15 → +45 pips to the next hand
  if (secs % 15 === 0 && hasTrick('quarter_chime')) {
    pendingHandPips += BAL.quarter_chime.pips;
    showMessage(`🔔 Quarter Chime - next hand +${BAL.quarter_chime.pips} pips`, '#e8c56b');
  }
  // Second Hand: the SECOND hand of a clock sweeps - it now fires on every
  // 10-second mark, not on the minute (r183). It used to share Minute Hand's
  // trigger and pay +5 pips against Minute Hand's +3 mult, which on measured
  // boards is 43 score a round against 464 - the same trigger for a tenth of the
  // payout, and the weakest Trick in the game by a distance. The number is
  // unchanged; only the hand it rides on. 17 fires a round instead of 2 puts it
  // at ~360, an ordinary common, and makes it the Trick that rewinding pays best:
  // any rewind of 10s or more buys a guaranteed extra fire.
  if (secs % 10 === 0 && hasTrick('second_hand')) {
    pendingCardPips += BAL.second_hand.pips;
    showMessage(`🕐 Second Hand - next hand +${BAL.second_hand.pips} pips`, '#e8c56b');
  }
  // Minute marks (clock reads N:00) → accrue mult / retrigger chance
  if (secs % 60 === 0) {
    if (hasTrick('minute_hand'))  { pendingHandMult += BAL.minute_hand.mult; showMessage(`🕐 Minute Hand - next hand +${BAL.minute_hand.mult} mult`, '#cc88ff'); }
    if (hasTrick('hourglass') && Math.random() < BAL.hourglass.chance) {
      // Grant one permanent retrigger to a random real card currently on the grid
      const spots = [];
      for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
        const card = gridData[r]?.[c];
        if (card && card.rank && !card._isSleight && !card._isTrick && !card._isStone) spots.push(card);
      }
      if (spots.length) {
        const card = spots[Math.floor(Math.random() * spots.length)];
        const k = cardId(card);
        permRetrig[k] = (permRetrig[k] || 0) + 1;
        showMessage(`⏳ Hourglass - ${card.rank}${card.suit} gains a retrigger`, '#e8c56b');
        if (!animating && !falling) render();
      }
    }
  }
}

function pauseRound(seconds) {
  // Time Slip knack: whenever the clock WOULD pause, a chance to rewind that many seconds instead
  if (hasKnack('time_slip') && Math.random() < BAL.time_slip.chance) {
    rewindTime(seconds, '⏮️ Time Slip - rewound instead of paused!');
    return;
  }
  // Long Pause knack: all pauses are 1.5x longer
  if (hasKnack('long_pause')) seconds *= BAL.long_pause.multiplier;
  pauseInstanceGame++; // Hummingbird (counts every pause triggered this game)
  pausesThisRound++;   // per-round pause count (time popup)
  // The Vulture: mark the start of the round's FIRST continuous pause stretch. An extension
  // landing while already paused does NOT start a new stretch (pipeTimerPaused is still true).
  if (!pipeTimerPaused && !firstPauseStartedRound) { firstPauseStartedRound = true; firstPauseActive = true; }
  // Pauses always stack - an active pause is extended, not reset.
  pauseSecondsLeft += seconds;
  pipeTimerPaused = true;
  const clockEl = document.getElementById('clock');
  if (clockEl) clockEl.classList.add('clock-paused');
  // Lit clock, tick-tock, and the ripple that turns and holds every card
  // (js/clock-fx.js). Idempotent - an extension of a live pause does nothing.
  if (typeof beginClockFreeze === 'function') beginClockFreeze();
  if (pauseTimer) clearTimeout(pauseTimer);
  // count down pause
  const tick = () => {
    pauseSecondsLeft--;
    pausedSecondsRound++; // Albatross
    if (pauseSecondsLeft <= 0) {
      pauseSecondsLeft = 0;
      firstPauseActive = false; // the first continuous pause stretch is over (Vulture)
      // Don't unfreeze if a Stopwatch is still holding the clock frozen.
      if (!stopwatchActive) {
        pipeTimerPaused = false;
        if (clockEl) clockEl.classList.remove('clock-paused');
        if (typeof endClockFreeze === 'function') endClockFreeze();
      }
      updateClockUI();
    } else {
      pauseTimer = setTimeout(tick, 1000);
    }
  };
  pauseTimer = setTimeout(tick, 1000);
}

// ── Stopwatch sleight ─────────────────────────────────────────────────────────
// Freezes the clock (a NORMAL pause, so Phoenix/Falcon etc. still apply) until the
// next played hand's scoring animation settles. Swaps/discards/selection keep it
// frozen. Drains its 60-second budget (_usesLeft) 1 per frozen second; destroyed at 0.
function startStopwatch(card, r, c) {
  if (stopwatchActive || !card) return;
  if (card._usesLeft !== 'infinite' && card._usesLeft <= 0) return;
  stopwatchActive = true;
  stopwatchCardPos = { card, r, c };
  pipeTimerPaused = true;
  const clockEl = document.getElementById('clock');
  if (clockEl) clockEl.classList.add('clock-paused');
  if (typeof beginClockFreeze === 'function') beginClockFreeze();
  showMessage('⏱️ Stopwatch - clock frozen', '#5aa9e6');
  if (stopwatchTimer) clearInterval(stopwatchTimer);
  stopwatchTimer = setInterval(() => {
    if (!stopwatchActive) { clearInterval(stopwatchTimer); stopwatchTimer = null; return; }
    if (gameTimerPaused) return; // don't drain while a menu/shop/event has the game suspended
    if (card._usesLeft === 'infinite') return;
    card._usesLeft--;
    pausedSecondsRound++; // Albatross counts frozen seconds
    if (card._usesLeft <= 0) {
      // budget spent → destroy the sleight (find it by reference; a discard-fall may have moved it) and release
      for (let rr = 0; rr < gridRows; rr++) for (let cc = 0; cc < gridCols; cc++) if (gridData[rr]?.[cc] === card) gridData[rr][cc] = null;
      endStopwatch();
      showMessage('Stopwatch consumed', 'var(--cream-dim)');
      render();
    }
  }, 1000);
}
function endStopwatch() {
  if (!stopwatchActive && !stopwatchTimer) return;
  stopwatchActive = false;
  stopwatchCardPos = null;
  if (stopwatchTimer) { clearInterval(stopwatchTimer); stopwatchTimer = null; }
  // Only actually release the clock if no normal pause is still counting down.
  if (pauseSecondsLeft <= 0) {
    pipeTimerPaused = false;
    const clockEl = document.getElementById('clock');
    if (clockEl) clockEl.classList.remove('clock-paused');
    if (typeof endClockFreeze === 'function') endClockFreeze();
    updateClockUI();
  }
}

// ══════════════════════════════════════════════
// GRAVITY ANIMATION (from gravity-test.html)
// ══════════════════════════════════════════════

// Permanent-buff corner indicators: diagonal tally bands (thin = 1, thick = 5),
// stacked inward from a corner. pips=blue/top-left, mult=red/top-right,
// time=black/bottom-right, coins=gold/bottom-left.
function buffBandHTML(corner, count, color) {
  if (!count || count <= 0) return '';
  const segs = [];
  for (let i = 0; i < Math.floor(count / 5); i++) segs.push('bb-thick');
  for (let i = 0; i < count % 5; i++) segs.push('bb-thin');
  const edge = { tl:'top', tr:'top', br:'bottom', bl:'bottom' }[corner];
  const side = { tl:'left', tr:'right', br:'right', bl:'left' }[corner];
  return segs.map((cls, i) => {
    const o = 2 + i * 3; // px inward from the corner along the diagonal
    return `<div class="buff-band bb-${corner} ${cls}" style="${edge}:${o}px;${side}:${o}px;background:${color};"></div>`;
  }).join('');
}

// ── Single source of truth for card visual appearance ──────────────────────────
// Returns { className, innerHTML } describing how a card looks at position (r,c).
// Both render() and fall-animation paths call this - add a new card type here
// once and both static and animated rendering automatically pick it up.
//
// Interaction state (isSel, isSwapPending, etc.) defaults to "no interaction"
// so it's safe to call with just (card, r, c) from animation paths.
