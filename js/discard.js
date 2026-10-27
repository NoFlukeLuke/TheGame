function doDiscard() {
  if (typeof sweepRunning === 'function' && sweepRunning()) { dbgEvent('info', 'discard ignored (sweep)'); return; }   // r572
  if (typeof logisticsRunning === 'function' && logisticsRunning()) return;   // r647
  if (typeof bossJumpRunning === 'function' && bossJumpRunning()) { dbgEvent('info', 'discard ignored (skipping to the boss)'); return; }   // r606
  // On grid-takeover screens the Discard button is repurposed: CLEAR (reward),
  // and in the shop it is still THE DISCARD BUTTON (r307) - it spends a discard
  // on what is selected. With row labels selected that is a REROLL of those
  // rows; with nothing selected there is nothing to spend one on, so it reads
  // and acts as LEAVE.
  if (typeof shopGridActive !== 'undefined' && shopGridActive) {
    if (typeof shopRerollSelectedRows === 'function' && shopRerollSelectedRows()) return;
    if (typeof shopgSelRows === 'function' && shopgSelRows().length) return;   // refused, not an exit
    // r405: LEAVE is its own button now, so this one never leaves.
    refuse('Select a row label first'); return;
  }
  if (rewardOnGrid) { clearRewardSelection(); return; }
  // Dealer's Choice: while cards are held, DISCARD throws the top one away.
  if (typeof dealerActive === 'function' && dealerActive()) { dealerDiscardTop(); return; }
  // roundEnded FREEZES INPUT for a round that is over, and the Flow deck editor
  // runs inside exactly that window: the goal hand set the flag and only the
  // level-up at the END of the reward chain clears it again. The editor is a
  // deliberate act on a board it owns, so it is exempt (r395); nothing else is.
  const _deckEdit = typeof deckEditFreeInteract === 'function' && deckEditFreeInteract();
  if (roundEnded && !_deckEdit) return;
  // r545: a DISCARD pressed while the board animates (cards leaving before a fall,
  // a swap) is queued with its cards, like PLAY. It used to be dropped without a word,
  // which is how a refused challenge warning could still land.
  if (animating) {
    if (!_deckEdit && selected.length > 0) { pendingAction = 'discard'; pendingDiscardCards = selected.map(([r,c]) => gridData[r]?.[c]).filter(Boolean); dbgEvent('info', 'discard queued (animating)'); scheduleQueuedRetry(); discardLatchSync(); }
    return;
  }
  // Same gate as doSwap - a boss may refuse the discard before it commits.
  if (typeof bossInteractBlocked === 'function' && bossInteractBlocked('discard')) return;
  // A discard pressed mid-fall is queued with the CARDS it was pressed on. Taps
  // still select during a fall, so the selection at the fall's end can be the
  // next hand; discarding that instead was the bug (r539).
  // r661: a discard mid-fall runs at once. The board's data is final from a fall's first
  // frame and every card falls on its own (js/card-fall.js), so the cards it was pressed on
  // are exactly the ones that go; the r539 queue-until-landed is no longer needed.
  if (selected.length === 0) return;
  // A fall-type challenge card locks discards in its line (js/challenge-round.js).
  { const _lock = (typeof crDiscardLocked === 'function') ? crDiscardLocked(selected) : null; if (_lock) { refuse(_lock); return; } }
  if (typeof dragGrace !== 'undefined') dragGrace = false;
  // Guard: block discard when out of discards. Mirrors the swap guard in input.js.
  // Spoiled (id hoarder) is the one bypass - its whole text is "discards no longer count against
  // the discard limit", so it must not be stopped by that limit either.
  // r567: a selection of nothing but Fodder costs no stock, so it is never refused for stock.
  const _freeHand = typeof freeHandActive === 'function' && freeHandActive();   // r571: Free Hand's window
  const _allFodder = _freeHand || (typeof cardIsFodder === 'function' && selected.every(([r, c]) => cardIsFodder(gridData[r]?.[c])));
  if (discards <= 0 && !hasKnack('hoarder') && !_allFodder) {
    const btn = document.getElementById('btn-discard');
    if (btn) { btn.style.borderColor='var(--red)'; btn.style.color='var(--red)'; setTimeout(()=>{btn.style.borderColor='';btn.style.color='';},500); }
    refuse('No discards left');
    return;
  }
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
  // Five for Fodder (r623): any VALID hand pays its size in credits - judged now, while the cards are still on the grid.
  const _fodderHand = hasTrick('five_fodder') && realHandOfSize(selected, selected.length) ? selected.length : 0;
  // Procrastinate (r647): its 8 neighbours join the discard. They are CARRIED: no
  // seconds and no stock of their own, and the discard counts as 2 (discardsUsedRound).
  const _carried = procrastinateCarry(), _procrastinated = _carried.procs > 0;
  const discardedCards = selected.map(([r,c]) => gridData[r][c]);
  // Lucky Sevens: +3 Focus per 7 discarded
  if (hasTrick('lucky_sevens')) { const _sv = discardedCards.filter(c => c?.rank === '7').length; if (_sv) addFocus(_sv * BAL.lucky_sevens.focus, 'lucky_sevens'); }
  // The Vulture: cards discarded during the round's first clock pause gain a permanent "pause on score" buff (stacks)
  // Time buffs do not stack (r342): a card already carrying one is skipped.
  // r625 (owner): a card takes the Vulture's pause once; a time buff from another source does not block it.
  if (hasTrick('vulture') && firstPauseActive) discardedCards.forEach(c => { if (c && !c._vulturePause) c._vulturePause = yokeGain('time', BAL.vulture.pause_seconds); });
  // on_discard sleights fire with their grid position before removal.
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
  // The Sieve (boss): a discarded card does not come back. Hooked HERE, on the
  // player's own discard, rather than inside discardToDrawPile - that function is
  // also how the board returns cards when a boss voids a cell, and those are not
  // the player throwing anything away.
  const _sieve = (typeof bossSieve !== 'undefined') && bossSieve && bossActive
                 && !(typeof bossEffectsIgnored === 'function' && bossEffectsIgnored());
  // A discard-activated Sleight (Cash Out, Last Call, Sandbagger, Fresh Start)
  // cycles back into the deck with its remaining charges (r353). discardToDrawPile
  // deletes every Sleight, so before this their printed charges meant nothing:
  // the first discard was the last. A spent one was already nulled off the board
  // by consumeSleightCharge and is not here to route.
  // A Stopwatch holding the clock frozen is released the moment it is thrown
  // away, not on its own next tick (r377). The ticker's board check below is
  // the backstop for every other way it can leave; this is the one route where
  // a whole second of frozen clock would be visible.
  if (typeof stopwatchActive !== 'undefined' && stopwatchActive && stopwatchCardPos
      && discardedCards.includes(stopwatchCardPos.card)) endStopwatch();
  selected.forEach(([r,c]) => {
    const _dc = gridData[r]?.[c];
    if (!_dc || _sieve) return;
    // Cloud Nine (r539): a 9 thrown away while it is held is destroyed, not reshuffled.
    if (_dc.rank === '9' && !_dc._isSleight && !isWildCard(_dc) && hasTrick('nines_mult')) _dc._nineSpent = true;
    if (_dc._isSleight && sleightDef(_dc)?.activation === 'on_discard') discardToPlayed(_dc);
    else if (shredderVictims.has(_dc)) { expectedDeckTotal--; updateDeckHud(); }   // Shredder (r647): gone for good
    else discardToDrawPile(_dc);
  });
  shredderVictims.clear();
  // Spoiled (id hoarder): discards don't count against limit (but cost 2× time below)
  // r567: Fodder takes no stock either, when every card thrown away is Fodder.
  const _own = discardedCards.filter(c => !_carried.has(c));   // r647: carried cards pay nothing
  const _fodderN = _freeHand ? _own.length : ((typeof cardIsFodder === 'function') ? _own.filter(cardIsFodder).length : 0);
  if (!hasKnack('hoarder') && _fodderN < _own.length) discards--;
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
  // interactTimeCostMult() is 0 when the mode does not bill the clock at all and
  // Flow's half rate when it does, so this site needs no second test (r326).
  // r567: a Fodder card bills no seconds; the others pay their per-card cost.
  const timeCost = usingFreeDiscard ? 0 : Math.round((_own.length - _fodderN) * perCardCost * bossInteractMult() * interactTimeCostMult());
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
  discardsUsedRound += _procrastinated ? 2 : 1;   // r647: Procrastinate counts as 2 discards
  if (_procrastinated && BAL.procrastinate.discards) { discards += BAL.procrastinate.discards; noteMessage(`Procrastinate: +${BAL.procrastinate.discards} discards`); }
  // Five for Fodder: discarding a valid hand grants its size in credits
  if (_fodderHand) {
    const _fc = _fodderHand * BAL.five_fodder.credits_per_card;
    grantEntityCoins(_fc, 'trick', 'five_fodder');
    noteMessage('Five for Fodder! +' + _fc + ' credits', 'var(--gold)');
  }
  // Penny Saved: each 5 discarded adds +5 pips to trick
  if (hasTrick('fives_discard')) {
    const fivesCount = discardedCards.filter(c => c.rank === '5').length;
    bonusMult_fives += fivesCount * BAL.fives_discard.pips_per_five;
  }
  // Perfect Ten: every N cards discarded or played (r624) adds mult
  if (hasTrick('tens_mult')) {
    const prevTens = Math.floor((cardsDiscardedTotal - count + cardsScoredTotal) / BAL.tens_mult.discards_per_milestone);
    const newTens  = Math.floor((cardsDiscardedTotal + cardsScoredTotal) / BAL.tens_mult.discards_per_milestone);
    bonusMult_tens += (newTens - prevTens) * BAL.tens_mult.mult_per_milestone;
  }
  // Down and Back In: discarding ANY card of the grid's top rank (r635, owner: it used to
  // need every card of that rank) grants BAL.grant swaps or discards, alternating, + coins.
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
    if (_hi > 0 && _hiCards.some(hc => discardedCards.includes(hc))) {
      const _g = BAL.down_and_back_in.grant || 1;
      if (_dabiSwapNext) { swaps += _g; noteMessage(`Down and Back In: +${_g} swaps, +${BAL.down_and_back_in.coins} credits`, 'var(--gold)'); }
      else { discards += _g; noteMessage(`Down and Back In: +${_g} discards, +${BAL.down_and_back_in.coins} credits`, 'var(--gold)'); }
      _dabiSwapNext = !_dabiSwapNext;
      grantEntityCoins(BAL.down_and_back_in.coins, 'trick', 'down_and_back_in');
    }
  }
  // Martyr: sacrificing a non-discard Sleight refills 1 charge on every OTHER on-grid Sleight
  if (hasKnack('martyr') && discardedCards.some(c => c?._isSleight && sleightDef(c)?.activation !== 'on_discard')) {
    let _restored = 0;
    for (let _r = 0; _r < gridRows; _r++) for (let _c = 0; _c < gridCols; _c++) {
      const _sc = gridData[_r]?.[_c];
      if (!_sc?._isSleight || discardedCards.includes(_sc) || _sc._usesLeft === 'infinite' || typeof _sc._usesLeft !== 'number') continue;
      const _def = SLEIGHT_POOL.find(j => j.id === _sc.sleightId);
      const _cap = sleightMaxCharges(_def) ?? _sc._usesLeft;
      if (_sc._usesLeft < _cap) { _sc._usesLeft++; _restored++; }
    }
    if (_restored) showMessage(`Martyr: +1 charge to ${_restored} Sleight${_restored > 1 ? 's' : ''}`, 'var(--gold)');
  }
  sfxCardDiscard();          // discarding has its own sound now (r205), not the riffle
  resetFocusDecayTimer();
  // Cull: Focus per 2 swaps+discards still in hand. `discards` has already been
  // decremented above, so this reads what is LEFT after paying for this discard.
  cullPay();
  if (typeof cardStatesTouch === 'function') cardStatesTouch(discardedCards);
  const toRemove = [...selected];
  selected = [];
  // r528: only the player's own DISCARD refuses a marked challenge cell (it used to be any
  // 'discard'-mode fall: a Sleight leaving, a boss taking cards).
  if (typeof crTeleOnDiscard === 'function') crTeleOnDiscard(toRemove);
  removeAndFall(toRemove, 'discard');
}

// The queued discard runs once the fall settles. It throws away only the cards
// it was pressed on, wherever they landed. Cards selected since stay selected:
// carried by identity through the discard's own fall (discardCarryRestore).
let discardCarry = null, discardCarryArm = false;
function cellOfCard(card) {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (gridData[r]?.[c] === card) return [r, c];
  return null;
}
function runQueuedDiscard() {
  const want = pendingDiscardCards; pendingDiscardCards = null;
  if (!want) { doDiscard(); return; }
  const cells = want.map(cellOfCard).filter(Boolean);
  if (!cells.length) return;
  const isOut = ([r,c]) => cells.some(([a,b]) => a === r && b === c);
  const before = selected.map(x => [...x]);
  const keep = before.filter(x => !isOut(x)).map(([r,c]) => gridData[r]?.[c]).filter(Boolean);
  cancelAutoSubmit();
  selected = cells;
  doDiscard();
  if (animating || falling) { discardCarry = keep.length ? keep : null; return; }
  selected = before;   // refused (no discards left, a lock, a boss): nothing moved
  scheduleAutoSubmit(); render();
}
// Called by removeAndFall once the board's data is final, before the fall plays.
// Only the connected run from the first carried card is kept. No render here.
function discardCarryRestore() {
  const keep = discardCarry; discardCarry = null;
  if (!keep || selected.length) return;
  let cells = keep.map(cellOfCard).filter(Boolean)
    .filter(([r,c]) => !isCellBlocked(r, c) && cardCan(gridData[r][c], 'select'));
  while (cells.length > 1 && !isConnected(cells)) cells.pop();
  if (!cells.length) return;
  selected = cells; discardCarryArm = true;
}

// ══════════════════════════════════════════════
// TIME COST FLASH
// ══════════════════════════════════════════════
// The floater by the clock. Red for a cost; rewindTime and pauseRound pass their own colour.
function showTimeCost(label, color = '#e05555') {
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
  el.style.color = color; el.style.textShadow = `0 0 8px ${color}99`;
  el.style.transition = 'none';
  el.style.opacity = '1';
  el.style.top = '-4px';
  void el.offsetWidth;
  el.style.transition = 'top 0.7s ease-out, opacity 0.7s ease-out';
  el.style.top = '-22px';
  el.style.opacity = '0';
}
// The name a time payout is logged under (r552).
function timeSrcName(id) {
  if (!id) return '';
  const e = [...(typeof TRICK_POOL !== 'undefined' ? TRICK_POOL : []), ...(typeof KNACK_POOL !== 'undefined' ? KNACK_POOL : []),
             ...(typeof SLEIGHT_POOL !== 'undefined' ? SLEIGHT_POOL : [])].find(x => x && x.id === id);
  return e ? e.name : '';
}

// ── Rewind: give round seconds back (clock counts down, so rewinding = adding time) ──
// Adds `seconds` to roundSeconds, capped at ROUND_DURATION, and shows a floater/message.
// Returns the seconds actually restored. Bosses run their own timer, so rewinds are ignored there.
// How high a rewind is allowed to push the clock. NOT the bare ROUND_DURATION
// (r183): that constant is Classic's 180, and the clock legitimately sits ABOVE
// it in several ordinary situations -
//   · Survival rounds are 120s and Flow's session clock is 300s
//   · the Starting Time LIMIT can be upgraded past 180, and a round starts at it
//   · Time Bank (+30s at round start) and Clock Tower (carries up to 60s over)
//   · Rain Check (+30s next round)
// against `Math.min(ROUND_DURATION, …)` every one of those made a rewind CUT the
// clock down to 180 and then return 0, so it reported nothing and the player just
// lost the time. In Flow that was 120 seconds destroyed by a single Flush.
//
// `roundStartSeconds` is what this round ACTUALLY began with - startRoundTimer
// records it after computeRoundResources has already folded in the Starting Time
// limit, Time Bank and Clock Tower - so it is the whole answer for those three
// and no separate limits lookup is needed. Reading the limit as well would let a
// 120s Survival round be rewound up to Classic's 180.
//
// `roundSeconds` is in the max too, so the clamp can never move the clock
// backwards: the worst a rewind can now do is nothing.
// THERE IS NO CEILING ON A REWIND (r193, owner spec).
//
// It used to be max(currentRoundDuration, roundStartSeconds, roundSeconds) - i.e.
// you could never bank the clock above what the round STARTED with. That made
// every rewind past the top silently worth nothing: the seconds vanished, the
// floater said nothing, and a time build hit a wall it could not see. The limit
// (renamed "Starting Time" in js/limits.js for exactly this reason) now says what
// you BEGIN a round with; what you can climb to during it is up to your build.
//
// Kept as a function rather than deleted at the call site: it is the one place to
// reintroduce a ceiling if time builds turn out to run away, and rewindTime's
// Math.min still reads correctly against Infinity.
function rewindCeiling() { return Infinity; }

// `srcId` / `srcSource` name the entity that caused the rewind, when the caller
// knows it, so the FX can fly the symbol from that entity's tray tile (js/payout-fx.js).
function rewindTime(seconds, label, srcId, srcSource) {
  // The Rerun (boss): a coin flip on every rewind. Not speculative - this is only
  // ever reached from playHand and the round tick, never from calcScore.
  // Overtime's Unreliable clock (r562) misses the same way, on its own coin.
  if (seconds > 0 && ((typeof bossRerunMisses === 'function' && bossRerunMisses())
      || (typeof overtimeClockMisses === 'function' && overtimeClockMisses()))) {
    showMessage('⏪ MISSED', 'var(--red)');
    return 0;
  }
  // Rewinds used to return 0 during a boss, because the boss ran its own clock and
  // roundSeconds was frozen, so there was genuinely nothing to give back. Since r205
  // there is ONE clock and the boss window IS roundSeconds, so a rewind does exactly
  // what it says on a boss round like any other.
  seconds = Math.floor(seconds);
  if (seconds <= 0) return 0;
  const before = roundSeconds;
  roundSeconds = Math.min(rewindCeiling(), roundSeconds + seconds);
  const gained = roundSeconds - before;
  if (gained <= 0) return 0;
  rewoundSecondsRound += gained; // Kingfisher scales on seconds rewound this round
  rewindsThisRound++;            // per-round rewind count (time popup)
  rewindInstanceGame++;          // Hummingbird
  updateClockUI();
  // r391: rewinding out of the boss warmup window ends it at once, not a tick later.
  if (typeof tickBossApproach === 'function') tickBossApproach();
  // Infinity-mirror copies under every card + the reversed swell (js/clock-fx.js)
  if (typeof playRewindFX === 'function') playRewindFX();
  showTimeCost(`⏪ +${gained}s`, '#5aa9e6');
  if (label) noteMessage(label, '#5aa9e6', { icon: '\u23ea' });
  // The symbol flies from the entity that caused it to the clock it changed
  // (js/entity-fx.js). `srcId` is optional - without it the flight still happens,
  // it just starts from the clock rather than from a tray tile.
  // sfx false: playRewindFX above already played the rewind; the plate's copy doubled it (r534).
  if (typeof entityEffectFX === 'function') entityEffectFX('rewind', gained, { id: srcId, source: srcSource, sfx: false });
  return gained;
}

// ── Clock-mark Tricks: fire as the round clock passes static timestamps ──
// Called once per real second from the round timer with the NEW roundSeconds value.
// Because rewinds add seconds, the clock can pass the same mark more than once - that
// re-fires these bonuses, which is an intended synergy with the rewind entities.
function handleClockMarks(secs) {
  if (secs <= 0) return;
  // Tick-Tock: clock reading ends in a 0 → +2 Focus
  if (secs % 10 === 0 && hasTrick('ticktock')) { addFocus(BAL.ticktock.focus, 'ticktock'); }
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
    if (Math.random() < 0.5) { pendingHandMult += BAL.second_hand.mult; showMessage(`🕐 Second Hand - next hand +${BAL.second_hand.mult} mult`, '#e8c56b'); }
    else { pendingCardPips += BAL.second_hand.pips; showMessage(`🕐 Second Hand - next hand +${BAL.second_hand.pips} pips`, '#e8c56b'); }
  }
  // Minute Hand: every 30s mark charges the next hand with x mult. A fresh mark
  // while charged does not stack.
  if (secs % BAL.minute_hand.interval_seconds === 0 && hasTrick('minute_hand')) {
    minuteHandCharges = 1;
    showMessage(`🕐 Minute Hand - next hand x${BAL.minute_hand.mult_mult} mult`, '#cc88ff');
  }
  // Minute marks (clock reads N:00) → accrue mult / retrigger chance
  if (secs % 60 === 0 || (hasTrick('hourglass') && secs % TB('hourglass').interval_seconds === 0)) {
    // COUNTABLE under Luck: past 100% it grants the retrigger to several cards.
    const _hgN = hasTrick('hourglass') && secs % TB('hourglass').interval_seconds === 0 ? luckRoll(TB('hourglass').chance) : 0;   // r625: the mark moves with improvements
    for (let _hg = 0; _hg < _hgN; _hg++) {
      // Grant one permanent retrigger to a random real card currently on the grid
      const spots = [];
      for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
        const card = gridData[r]?.[c];
        if (card && card.rank && !card._isSleight && !card._isTrick && !card._isStone) spots.push(card);
      }
      if (spots.length) {
        const card = spots[Math.floor(Math.random() * spots.length)];
        const k = cardId(card);
        permRetrig[k] = (permRetrig[k] || 0) + yokeGain('retrig', 1);
        showMessage(`⏳ Hourglass - ${card.rank}${card.suit} gains a retrigger`, '#e8c56b');
        if (!animating && !falling) render();
      }
    }
  }
}

// Cull (r351): +focus per `per` swaps+discards left, on every swap AND discard.
function cullPay() {
  if (!hasTrick('cull')) return;
  const _n = Math.floor((Math.max(0, swaps) + Math.max(0, discards)) / BAL.cull.per) * BAL.cull.focus_per_stock;
  if (_n > 0) addFocus(_n * trickFires('cull'), 'cull', 'trick');
}

// A hand ends every pause (r635, owner). The default; dev -> Change the game now
// switches it off (`lethe.pauseEnds.v1`, stored only when off). Rewinds keep
// their seconds; a pause now lasts until its time runs out OR the next hand.
// The hand that ends a pause still counts as played during it: everything that
// asks "is the clock paused" while scoring asks clockPausedForHand(), which stays
// true for the rest of that playHand (cleared on the next microtask). A pause
// this hand grants starts after the end, so it runs into the next hand.
// The Stopwatch is untouched: it already holds until the hand's tally settles.
let pauseEndsOnPlay = (() => { try { return localStorage.getItem('lethe.pauseEnds.v1') !== '0'; } catch (e) { return true; } })();
function pauseEndsSetEnabled(on) {
  pauseEndsOnPlay = !!on;
  try { on ? localStorage.removeItem('lethe.pauseEnds.v1') : localStorage.setItem('lethe.pauseEnds.v1', '0'); } catch (e) {}
}
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => { const cb = document.getElementById('dev-pause-ends'); if (cb) cb.checked = pauseEndsOnPlay; });
let _handPlayedInPause = false;
function clockPausedForHand() { return pipeTimerPaused || _handPlayedInPause; }
// Called by playHand once the hand is committed, before anything is scored.
function endPausesForPlay() {
  if (!pauseEndsOnPlay) return;
  if (pipeTimerPaused && !_handPlayedInPause) { _handPlayedInPause = true; Promise.resolve().then(() => { _handPlayedInPause = false; }); }
  if (!(pauseSecondsLeft > 0)) return;
  if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
  pauseSecondsLeft = 0;
  firstPauseActive = false;   // the first continuous pause stretch is over (Vulture)
  if (stopwatchActive) return;
  pipeTimerPaused = false;
  const clockEl = document.getElementById('clock');
  if (clockEl) clockEl.classList.remove('clock-paused');
  if (typeof endClockFreeze === 'function') endClockFreeze();
  updateClockUI();
}

function pauseRound(seconds, srcId, srcSource) {
  // A pause of no length is not a pause. Callers multiply their seconds by
  // trickFires(), which is 0 for a Trick you do not own, so this is the normal way
  // an unowned Trick's pause arrives here - and without this guard it would still
  // count toward Hummingbird (+mult per pause triggered) and the Time popup's tally.
  if (!seconds || seconds <= 0) return;
  // The Rerun (boss): a coin flip on every pause, rolled before Time Slip so a
  // missed pause cannot become a rewind through the back door.
  if ((typeof bossRerunMisses === 'function' && bossRerunMisses())
      || (typeof overtimeClockMisses === 'function' && overtimeClockMisses())) {
    showMessage('⏸ MISSED', 'var(--red)');
    return;
  }
  // Time Slip knack: whenever the clock WOULD pause, a chance to rewind that many seconds instead
  // BINARY under Luck: a pause cannot become two rewinds, so anything above
  // 100% is wasted here on purpose. Its tooltip caps the printed figure to match.
  if (hasKnack('time_slip') && luckRoll(BAL.time_slip.chance) > 0) {
    rewindTime(seconds, '⏮️ Time Slip - rewound instead of paused!', 'time_slip', 'knack');
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
  // Lit clock, click click, and the ripple that turns and holds every card
  // (js/clock-fx.js). Idempotent - an extension of a live pause does nothing.
  const _wasFrozen = typeof clockFrozen !== 'undefined' && clockFrozen;
  if (typeof beginClockFreeze === 'function') beginClockFreeze();
  // One click click per pause (r534): beginClockFreeze plays it when the clock stops,
  // so the plate only plays it for an extension of a pause already running.
  if (typeof entityEffectFX === 'function') entityEffectFX('pause', Math.round(seconds), { id: srcId, source: srcSource, sfx: _wasFrozen });
  // Like a rewind (r552): a floater by the clock and a quiet line in the notice log.
  showTimeCost(`⏸ ${Math.round(seconds)}s`, '#c6f26b');
  const _pn = timeSrcName(srcId);
  noteMessage(`⏸ ${_pn ? _pn + ' - paused' : 'Clock paused'} ${Math.round(seconds)}s`, '#c6f26b');
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
// PAUSES the clock until the next played hand's scoring animation settles.
// Swaps/discards/selection keep it paused. 60s of use as 10 charges of 6s each
// (timed charges, r356); spent at 0. It is a pause like any other (r549, owner):
// The Rerun can miss it, Time Slip can rewind its seconds instead, Long Pause makes
// each charge last 1.5x as long, and it counts for Hummingbird, Patient Rulers, The
// Vulture's first pause and the pause tallies. It skips pauseRound only because its
// length is open-ended.
function stopwatchSecsLeft(card) {
  const def = sleightDef(card);
  return Math.max(0, card._usesLeft * def.secsPerCharge - (card._chargeSecsUsed || 0));
}
function startStopwatch(card, r, c) {
  if (stopwatchActive || !card) return;
  if (card._usesLeft !== 'infinite' && card._usesLeft <= 0) return;
  if ((typeof bossRerunMisses === 'function' && bossRerunMisses())
      || (typeof overtimeClockMisses === 'function' && overtimeClockMisses())) { showMessage('⏸ MISSED', 'var(--red)'); return; }
  // Time Slip: rewind the seconds this Stopwatch holds, and it is spent.
  if (card._usesLeft !== 'infinite' && hasKnack('time_slip') && luckRoll(BAL.time_slip.chance) > 0) {
    rewindTime(stopwatchSecsLeft(card), '⏮️ Time Slip - rewound instead of paused!', 'time_slip', 'knack');
    card._usesLeft = 1; card._chargeSecsUsed = sleightDef(card).secsPerCharge;
    sleightTimedDrain(card, 0);
    return;
  }
  pauseInstanceGame++; pausesThisRound++;
  if (!pipeTimerPaused && !firstPauseStartedRound) { firstPauseStartedRound = true; firstPauseActive = true; }
  stopwatchActive = true;
  stopwatchCardPos = { card, r, c };
  pipeTimerPaused = true;
  const clockEl = document.getElementById('clock');
  if (clockEl) clockEl.classList.add('clock-paused');
  const _wasFrozen = typeof clockFrozen !== 'undefined' && clockFrozen;
  if (typeof beginClockFreeze === 'function') beginClockFreeze();
  if (typeof entityEffectFX === 'function') entityEffectFX('pause', null, { id: 'stopwatch', source: 'sleight', sfx: _wasFrozen });
  showTimeCost('⏸', '#c6f26b');
  showMessage('⏱️ Stopwatch - clock paused until your next hand', '#5aa9e6');
  if (stopwatchTimer) clearInterval(stopwatchTimer);
  stopwatchTimer = setInterval(() => {
    if (!stopwatchActive) { clearInterval(stopwatchTimer); stopwatchTimer = null; return; }
    // THE CARD CAN LEAVE THE BOARD WHILE IT IS HOLDING THE CLOCK (r377). A
    // Stopwatch is an ordinary deck card - discard it, play it in a hand, have
    // a boss eat it - and nothing released the freeze: the owner's "if you
    // discard stopwatch sleight it stays paused". Every one of those routes is
    // "it is no longer in gridData", so that is what is asked rather than
    // hooking each of them.
    if (!stopwatchOnBoard()) { endStopwatch(); return; }
    if (gameTimerPaused) return; // don't drain while a menu/shop/event has the game suspended
    if (card._usesLeft === 'infinite') return;
    pausedSecondsRound++; // Albatross counts frozen seconds
    // Timed charges (r356): every 6 paused seconds spend one charge (9 with Long
    // Pause); the helper takes a spent Stopwatch off the board wherever a fall has moved it.
    if (!sleightTimedDrain(card, hasKnack('long_pause') ? 1 / BAL.long_pause.multiplier : 1)) endStopwatch();
  }, 1000);
}
// Is the active Stopwatch still on the board? By IDENTITY, not by cell - a
// fall moves it, which is the r192 rule and the same reason sleightTimedDrain
// sweeps for the card rather than trusting a remembered position.
function stopwatchOnBoard() {
  const card = stopwatchCardPos && stopwatchCardPos.card;
  if (!card) return false;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++)
    if (gridData[r]?.[c] === card) return true;
  return false;
}
function endStopwatch() {
  if (!stopwatchActive && !stopwatchTimer) return;
  stopwatchActive = false;
  stopwatchCardPos = null;
  if (stopwatchTimer) { clearInterval(stopwatchTimer); stopwatchTimer = null; }
  // Only actually release the clock if no normal pause is still counting down.
  if (pauseSecondsLeft <= 0) {
    pipeTimerPaused = false;
    firstPauseActive = false;   // the first continuous pause stretch is over (Vulture)
    const clockEl = document.getElementById('clock');
    if (clockEl) clockEl.classList.remove('clock-paused');
    if (typeof endClockFreeze === 'function') endClockFreeze();
    updateClockUI();
  }
}

// ══════════════════════════════════════════════
// GRAVITY ANIMATION (from gravity-test.html)
// ══════════════════════════════════════════════

// The permanent-buff corner tally that used to live here is now cardBandsHTML in
// js/deck-grid.js (r299), beside cardBuffLines - see the note there. It covered
// pips, mult and The Vulture's pause and nothing else, so a card carrying rewind
// seconds or a replay looked unbuffed.

// ── Single source of truth for card visual appearance ──────────────────────────
// Returns { className, innerHTML } describing how a card looks at position (r,c).
// Both render() and fall-animation paths call this - add a new card type here
// once and both static and animated rendering automatically pick it up.
//
// Interaction state (isSel, isSwapPending, etc.) defaults to "no interaction"
// so it's safe to call with just (card, r, c) from animation paths.

// ── Procrastinate (r647, Sleight) ───────────────────────────────────────────
// A live Procrastinate in the selection pulls in the 8 cells around it: ordinary
// cards that can be discarded, are not blocked or locked by a fall challenge. A
// Sleight beside it stays (a discarded Sleight is deleted). Mutates `selected`;
// returns the carried cards, with `procs` = how many Procrastinates fired.
function procrastinateCarry() {
  const out = new Set(); out.procs = 0;
  const live = selected.filter(([r, c]) => { const cd = gridData[r]?.[c]; return cd && cd.sleightId === 'procrastinate' && (cd._usesLeft === 'infinite' || cd._usesLeft > 0); });
  if (!live.length) return out;
  out.procs = live.length;
  const inSel = new Set(selected.map(([r, c]) => r + '-' + c));
  live.forEach(([pr, pc]) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const r = pr + dr, c = pc + dc, k = r + '-' + c, cd = gridData[r]?.[c];
      if ((!dr && !dc) || inSel.has(k) || !cd || cd._isSleight || !cardCan(cd, 'discard') || isCellBlocked(r, c)) continue;
      if (typeof crDiscardLocked === 'function' && crDiscardLocked([[r, c]])) continue;
      inSel.add(k); selected.push([r, c]); out.add(cd);
    }
  });
  return out;
}
// ── Shredder (r647, Sleight) ─────────────────────────────────────────────────
// It picks its victims when it fires (applySleightGridEffect), at random from the
// ordinary cards discarded with it (real cards before temp ones, which would leave
// anyway); doDiscard's routing then drops them instead of returning them.
const shredderVictims = new Set();
function shredderPick(cards) {
  const pool = (cards || []).filter(c => c && c.rank && !c._isSleight && !c._isStone && !shredderVictims.has(c));
  const real = shuffle(pool.filter(c => !c._temp)), temp = shuffle(pool.filter(c => c._temp));
  const take = [...real, ...temp].slice(0, BAL.shredder.deletes);
  take.forEach(c => shredderVictims.add(c));
  const names = take.filter(c => !c._temp).map(c => (isWildCard(c) ? 'a wild' : c.rank + (typeof cardColorSuit === 'function' ? cardColorSuit(c) : c.suit)));
  if (names.length) showMessage(`📃 Shredder: ${names.join(', ')} deleted`, '#e86a5a');
  else noteMessage('📃 Shredder: nothing to delete');
}
