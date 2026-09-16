function generateHandFocus(hand, handCells, vultureSec) {
  {
    // Focus is generated from exactly two terms: hand COMPLEXITY (HAND_FOCUS, what
    // the hand is worth) and SPEED (how fast you played it after the last hand).
    // The r180 focus-rate entities scale those two terms rather than adding flat
    // Focus on top, so they multiply every other Focus source in the run instead of
    // stacking beside it. focusRateMods() reads the whole loadout in one place.
    const _fr = focusRateMods();
    const handFocus = Math.round((HAND_FOCUS[hand] || 0) * _fr.complexity);
    const now = Date.now();
    const secondsSinceLast = lastHandTime > 0 ? (now - lastHandTime) / 1000 : Infinity;
    // window > 1 DILATES the speed curve: the clock is read as if less time had
    // passed, so you get the same speed bonus with twice as long to play.
    const speedBonus = Math.floor(speedBonusFromTime(secondsSinceLast / _fr.window) * _fr.speed);
    let totalFocus = handFocus + speedBonus;
    // Rhythm: +1 focus per hand
    totalFocus += 1 * trickFires('rhythm');
    // Kaleidoscope: +4 focus if all 4 suits present in the scoring hand
    if (hasTrick('kaleidoscope')) {
      const handCards = handCells.map(([r,c]) => gridData[r][c]).filter(Boolean);
      const suitsInHand = new Set();
      handCards.forEach(c => {
        if (c.suit) suitsInHand.add(cardColorSuit(c));   // white counts as white
        if (c.combined && c.suit2) suitsInHand.add(c.suit2);
      });
      if (suitsInHand.size >= 4) totalFocus += 4 * trickFires('kaleidoscope');
    }
    // Run focus tricks: Torrent (+1/card), Rogue Wave (+4/card if played in sequence)
    const _isRunHand = ['Run of 3','Run of 4','Straight','Straight Flush'].includes(hand);
    if (_isRunHand) totalFocus += handCells.length * BAL.river_run.focus_per_card * trickFires('river_run');
    // Rogue Wave's fire count is read BEFORE canBeOrderedRun, so the predicate is
    // still short-circuited by ownership. It reads gridData, which is empty between
    // screens, and calling it unconditionally throws there (caught in a browser run).
    if (_isRunHand) {
      const _crf = trickFires('correct_run');
      if (_crf && canBeOrderedRun(handCells)) totalFocus += handCells.length * BAL.correct_run.focus_per_card * _crf;
    }
    // Resonance: Pairs/Two Pairs containing a 2 or 4 add +2 Focus per card
    if ((hand === 'Pair' || hand === 'Two Pair') &&
        handCells.some(([r,c]) => gridData[r]?.[c] && (gridData[r][c].rank === '2' || gridData[r][c].rank === '4'))) {
      totalFocus += handCells.length * BAL.high_pair.focus_per_card * trickFires('high_pair');
    }
    // Gnomes: each rank-5-and-below card scored adds its rank in Focus (Ace = 1)
    {
      const _btf = trickFires('before_the_tide');
      if (_btf) {
        const _rv = { A:1, '2':2, '3':3, '4':4, '5':5 };
        handCells.forEach(([r,c]) => { const cc = gridData[r]?.[c]; if (cc && _rv[cc.rank]) totalFocus += _rv[cc.rank] * _btf; });
      }
    }
    // Lucky Sevens: +3 Focus per 7 scored
    { const _sv = handCells.filter(([r,c]) => gridData[r]?.[c]?.rank === '7').length; if (_sv) totalFocus += _sv * BAL.lucky_sevens.focus * trickFires('lucky_sevens'); }
    // Threepeat: hand pip-sum divisible by 3 → +3 Focus
    { const _ps = handCells.reduce((s,[r,c]) => s + (gridData[r]?.[c] ? cardPips(gridData[r][c].rank) : 0), 0); if (_ps % 3 === 0) totalFocus += BAL.ninesong.focus * trickFires('ninesong'); }
    // The Falcon: hands played while the clock is paused add +10 Focus
    if (pipeTimerPaused) totalFocus += BAL.frozen_moment.focus * trickFires('frozen_moment');
    // Hands of Blue: a 2×2 hand adds Focus. Crossroads: a + shaped hand adds Focus.
    if (isSquare(handCells)) totalFocus += BAL.shape_square.focus * trickFires('shape_square');
    if (isCross(handCells))  totalFocus += BAL.shape_cross.focus  * trickFires('shape_cross');
    // Study Hall (r205): every Nth card scored pays Focus. It used to need a marked
    // row/column AND a once-per-minute gate, which capped it at 3 fires a round for a
    // rare - the counter runs across the whole run instead, so a 5-card hand pays twice.
    // The counter is per CARD and independent of trickFires, so a rehearsed Study Hall
    // multiplies the payout rather than advancing the count faster.
    if (hasTrick('study_hall')) {
      const _prev = studyHallCards;
      studyHallCards += handCells.length;
      const _fires = Math.floor(studyHallCards / BAL.study_hall.every) - Math.floor(_prev / BAL.study_hall.every);
      if (_fires > 0) totalFocus += _fires * BAL.study_hall.focus * trickFires('study_hall');
    }
    // Groove / Overtime: tally cards scored from their marked line this round, then scale.
    if (hasTrick('groove')) {
      markCount_groove += handCells.filter(([r,c]) => cellHasRowColBonus(r, c, 'groove')).length;
      totalFocus += Math.floor(markCount_groove / 2) * BAL.groove.focus_per_2 * trickFires('groove');
    }
    if (hasTrick('overtime')) {
      markCount_overtime += handCells.filter(([r,c]) => cellHasRowColBonus(r, c, 'overtime')).length;
    }
    // 3rd Down: 3-card hands (or Pairs via Three's a Crowd) add Focus
    if (counts3CardHand(hand, handCells)) totalFocus += BAL.third_down.focus * trickFires('third_down');
    // Acorns: grant the trick's accumulated whole-number Focus (grows +0.05 per scored card, post-hand)
    totalFocus += Math.floor(bonusFocus_acorns) * trickFires('acorns');
    // Plan Ahead: every 3rd hand of the round adds Focus = average hands per round so far
    if ((handsPlayedRound + 1) % BAL.plan_ahead.every === 0) {
      totalFocus += Math.max(1, Math.round((handsPlayedGame + 1) / Math.max(1, level))) * trickFires('plan_ahead');
    }
    // ── 4-card-hand family ──
    if (handCells.length === 4) {
      // Four Horse-man: random bonus - Focus/pause halves (pips/mult handled in calcScore)
      {
        const _fhf = trickFires('four_horseman');
        if (_fhf) {
          // One roll, paid once per firing - re-rolling per firing would turn a
          // duplicate into a different Trick (four chances at the good half).
          const _fhm = fourHorsemanRoll(handCells);
          if (_fhm === 2) totalFocus += BAL.four_horseman.focus * _fhf;
          else if (_fhm === 3) pauseRound(BAL.four_horseman.pause * _fhf);
        }
      }
      // Wait Four It: permanently buff the 4th card (scoring order) to pause the clock when scored
      if (hasTrick('wait_four_it')) {
        const _p = scoringOrderCells(handCells)[3];
        const _cd = _p && gridData[_p[0]]?.[_p[1]];
        if (_cd) _cd._vulturePause = (_cd._vulturePause || 0) + BAL.wait_four_it.pause * trickFires('wait_four_it');
      }
    }
    // ── 5-card-hand family ──
    if (handCells.length === 5) {
      totalFocus += handCells.length * BAL.five_stack.focus_per_card * trickFires('five_stack'); // +Focus/card (pips+mult handled in calcScore)
      pauseRound(BAL.five_second.pause_seconds * trickFires('five_second'));                       // Five Second Rule → pause 5s
      if (hasTrick('little_guys') && !handCells.some(([r,c]) => ['J','Q','K'].includes(gridData[r]?.[c]?.rank))) {
        const _lgf = BAL.little_guys.cap_gain * trickFires('little_guys');   // no face cards → +1 max Focus node (permanent)
        focusCapPerm += _lgf;
        showMessage('the little guys! +' + _lgf + ' max Focus', '#a25cd8');
      }
    }
    if (totalFocus > 0) addFocus(totalFocus);
    // Quick Draw: hands played within 3 seconds of the previous permanently add +1 max Focus capacity
    if (lastHandTime > 0 && secondsSinceLast * 1000 < BAL.quick_draw.window_ms) focusCapPerm += 10 * trickFires('quick_draw');
    // Flash Flood: runs of 4+ cards instantly advance focus to the next threshold
    if (_isRunHand && handCells.length >= 4 && hasTrick('ancient_grove')) {
      const _nt = (Math.floor(focusNodes / FOCUS_THRESHOLD) + trickFires('ancient_grove')) * FOCUS_THRESHOLD;
      addFocus(_nt - focusNodes);
    }
    // Collapsing Columns (Full House) / Richter (Four of a Kind): advance focus to next threshold
    {
      const _adv = (hand === 'Full House' ? trickFires('full_house_streak') : 0)
                 + (hand === 'Four of a Kind' ? trickFires('richter') : 0);
      if (_adv > 0) {
        const _nt2 = (Math.floor(focusNodes / FOCUS_THRESHOLD) + _adv) * FOCUS_THRESHOLD;
        addFocus(_nt2 - focusNodes);
      }
    }
    // Double Dutch: 3 pair-hands within 30s → +16 Focus (a non-pair hand breaks the streak)
    if (hasTrick('two_pair_mult')) {
      if (['Pair','Two Pair','Three of a Kind','Four of a Kind','Full House'].includes(hand)) {
        const _ddNow = Date.now();
        _ddPairTimes.push(_ddNow);
        _ddPairTimes = _ddPairTimes.filter(t => _ddNow - t <= BAL.two_pair_mult.window_ms);
        if (_ddPairTimes.length >= BAL.two_pair_mult.need_count) { const _ddf = BAL.two_pair_mult.focus * trickFires('two_pair_mult'); addFocus(_ddf, 'two_pair_mult'); _ddPairTimes = []; showMessage('Double Dutch! +' + _ddf + ' Focus', '#5aa9e6'); }
      } else { _ddPairTimes = []; }
    }
    // Ripple: consume the 30s cooldown if this hand actually had an adjacent-rank pair
    if (hasTrick('ripple') && (Date.now() - _rippleLastFire >= BAL.ripple.cooldown_ms)) {
      const _hc = handCells.map(([r,c]) => gridData[r]?.[c]).filter(Boolean);
      if (_hc.some((c,i) => _hc.some((o,j) => j !== i && _withinOneRank(c.rank, o.rank)))) _rippleLastFire = Date.now();
    }
    // High Water: after 3 Runs this round, each further Run pauses the clock by its card count
    if (_isRunHand && runsPlayedRound >= 3) pauseRound(handCells.length * trickFires('high_water'));
    // Dam Holding…: every Run pauses the clock a flat few seconds
    if (_isRunHand) pauseRound(BAL.dam_holding.pause * trickFires('dam_holding'));
    // Sundial knack: a hand where every card shares a column pauses the clock
    if (hasKnack('sundial') && handCells.length > 0 && handCells.every(([, hc]) => hc === handCells[0][1])) pauseRound(BAL.sundial.seconds);
    // Metronome knack: playing this round's target hand type pauses the clock
    if (hasKnack('metronome') && hand === metronomeHandType) pauseRound(BAL.metronome.seconds);
    // Double Jeopardy: the first time the marked card is scored this round, pause the clock 15s (once per round)
    if (hasTrick('double_jeopardy') && !djUsedThisRound && doubleJeopardyPos && handCells.some(([r,c]) => r === doubleJeopardyPos.r && c === doubleJeopardyPos.c)) {
      pauseRound(BAL.double_jeopardy.pause_seconds * trickFires('double_jeopardy'));
      djUsedThisRound = true;
      doubleJeopardyPos = null; // mark consumed; highlight clears
    }
    // Vulture buff: scored cards carrying the permanent "+Ns pause" buff pause the clock, counting
    // retriggers (each (re)trigger fires the buff). Not gated on hasTrick - the buff lives on the card.
    if (vultureSec) pauseRound(vultureSec);
    console.log('[FOCUS] hand=' + hand + ' base=' + handFocus + ' speedBonus=' + speedBonus + ' total=' + totalFocus + ' t=' + secondsSinceLast.toFixed(2) + 's');
  }

  // Clean Sweep: if this hand + the previous cover a full row or column, advance Focus a threshold
  if (hasTrick('clean_sweep')) {
    const _csCur = handCells.map(([r,c]) => r + '-' + c);
    const _csWin = new Set([..._csCur, ..._cleanSweepPrev]);
    let _csSwept = false;
    for (let r = 0; r < gridRows && !_csSwept; r++) { let _full = true; for (let c = 0; c < gridCols; c++) { if (!_csWin.has(r+'-'+c)) { _full = false; break; } } if (_full) _csSwept = true; }
    for (let c = 0; c < gridCols && !_csSwept; c++) { let _full = true; for (let r = 0; r < gridRows; r++) { if (!_csWin.has(r+'-'+c)) { _full = false; break; } } if (_full) _csSwept = true; }
    if (_csSwept) {
      const _nt = (Math.floor(focusNodes / FOCUS_THRESHOLD) + 1) * FOCUS_THRESHOLD;
      addFocus(_nt - focusNodes);
      showMessage('Clean Sweep! Focus advanced', '#5aa9e6');
      _cleanSweepPrev = [];
    } else {
      _cleanSweepPrev = _csCur;
    }
  }

  // Head Start: the first hand each round adds +5 Focus (flag reset stays in playHand)
  if (firstHandThisRound && hasTrick('first_play')) addFocus(BAL.first_play.focus, 'first_play');
}

// ══════════════════════════════════════════════
// PLAY HAND
// ══════════════════════════════════════════════
function playHand() {
  // Dominoes mode has its own play flow.
  if (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE.id === 'dominoes') { dominoPlay(); return; }
  // On grid-takeover screens the Play button is repurposed: BUY (shop) / CONFIRM (reward).
  if (typeof shopGridActive !== 'undefined' && shopGridActive) { shopGridBuySelection(); return; }
  if (rewardOnGrid) { confirmRewardPath(); return; }
  // Match-3: the board plays its own matches (match3Resolve). Manual play is off.
  if (match3Active()) { dbgEvent('info', 'play ignored (match-3 auto-plays)'); return; }
  if (roundEnded) { dbgEvent('warn', 'play ignored (round ended)'); return; }
  if (falling)   { pendingAction = 'play'; dbgEvent('info', 'play queued (falling)'); return; }
  if (animating) { pendingAction = 'play'; dbgEvent('info', 'play queued (animating)'); scheduleQueuedRetry(); return; }
  // r200: the minimum selection is a rule, not just a disabled button - keyboard
  // and queued-action paths reach here without going past the button's state.
  if (typeof minSelection === 'function' && selected.length < minSelection()) {
    dbgEvent('warn', 'play: below minimum selection', { selected: selected.length, min: minSelection() });
    return;
  }
  cancelAutoSubmit();
  console.log('[PLAY] entry', { score, goal: roundGoal, goalReachedThisRound, bonusWindowActive, animating, hasDance: !!danceAbortController });
  let result = findBestHand(selected);
  if (!result) { dbgEvent('warn', 'play: no valid hand', { selected: selected.length, animating, falling, roundEnded, dance: !!danceAbortController, swapPending: !!swapPending, swiping: isSwiping }); console.log('[PLAY] no result, exiting'); return; }
  // Abort any prior in-flight score dance ONLY now that we have a real hand to play.
  // (A spurious double-fire of Play on a now-empty selection must NOT cancel the
  //  in-progress dance - that was the "cards wiggle but never score" bug.)
  cancelDance();

  // The Marker: a marked card is discarded instead of played, and takes every other
  // marked card in the same hand with it. Checked here - after we know there is a
  // real hand, before anything is scored or mutated - so a fizzled hand leaves no
  // trace in the contributions, the hand log or handsPlayedRound.
  if (typeof bossMarkerIntercept === 'function' && bossMarkerIntercept([...selected])) return;

  // The Ringer (js/sleights-runtime.js): pull in one more card off the board when
  // that makes a better hand. Runs HERE rather than inside findBestHand, which
  // also feeds the live preview and the auto-submit - augmenting there would
  // promise a card before the player had committed to the hand. It runs AFTER the
  // Marker intercept on purpose: a hand that is about to fizzle must not spend a
  // Ringer charge. The added cell joins `selected` so it is removed with the rest,
  // and joins handCells so the dance flies it into the preview.
  const _ringer = (typeof ringerAugment === 'function') ? ringerAugment(result, selected) : null;
  if (_ringer) {
    result = _ringer.result;
    selected = [...selected, _ringer.cell];
  }

  const playedCells = [...selected]; // capture before any path clears selection (for on_play sleights)
  const { hand, handCells, penaltyCells, penaltyPips } = result;
  // Snapshot contribution breakdown now, from pristine pre-mutation state.
  // Folded into the round tally at the commit points below (goal / normal).
  const _contribSnapshot = captureRoundContrib(result);
  // Cuckoo: tally this hand's retriggers (captureRoundContrib just ran calcScore on the real hand).
  if (hasTrick('cuckoo')) retriggersThisRound += _lastHandRetrigs;
  // General replay tally for the Contributions view (all hands, not just Cuckoo).
  if (_lastHandRetrigs > 0) replaysThisRound += _lastHandRetrigs;
  // Rewound Echo knack: each card replay this hand has a chance to rewind 2 seconds.
  if (hasKnack('replay_rewind') && _lastHandRetrigs > 0) {
    let _rw = 0;
    // COUNTABLE: each replay rolls, and past 100% one replay can pay twice.
    for (let i = 0; i < _lastHandRetrigs; i++) _rw += luckRoll(BAL.replay_rewind.chance) * BAL.replay_rewind.seconds;
    if (_rw > 0) rewindTime(_rw, `🔂 Rewound Echo - rewound ${_rw}s`);
  }
  // Vulture: retrigger-aware pause-seconds from buffed cards in this hand (same fresh snapshot).
  const _vultureSec = _lastHandVultureSeconds;

  // ── Focus applies to THIS hand (r95) ──
  // Generate the Focus this hand earns BEFORE locking in its score, so the Focus the hand
  // builds up is the multiplier that scores it (previously that Focus only helped the NEXT hand).
  // lastPreHandFocus = the multiplier the hand STARTED at (dance shows this first), then the
  // recompute below sets lastCalcFocus = the multiplier AFTER this hand's Focus (dance beats up to it).
  lastPreHandFocus = focusMultiplier();
  generateHandFocus(hand, handCells, _vultureSec);
  // Re-score the winning hand now that Focus reflects this hand's own gains.
  const finalScore = Math.max(0, calcScore(hand, handCells) - penaltyPips);
  result.finalScore = finalScore; // keep result in sync for the dance / downstream reads
  // Snapshot this hand's replay counts NOW (a later calcScore elsewhere could overwrite the global).
  const _handRetrigByCell = { ..._lastRetrigByCell };
  // Card Market time cards: seconds carried by the individual cards in this hand.
  // Routed through rewindTime, never a raw `roundSeconds +=` - that is what keeps
  // the ceiling, the floater and the Kingfisher tally honest (see CLAUDE.md,
  // "Every rewind now goes through rewindTime()").
  if (typeof permTime !== 'undefined') {
    let _cardSecs = 0;
    handCells.forEach(([r, c]) => {
      const _cd = gridData[r]?.[c];
      if (_cd && _cd.rank) _cardSecs += (permTime[cardId(_cd)] || 0);
    });
    if (_cardSecs > 0) rewindTime(_cardSecs, `⏪ +${_cardSecs}s from your cards`);
  }

  dbgEvent('ok', 'play ' + hand, { finalScore, cards: handCells.length });
  console.log('[PLAY] hand result', { hand, finalScore, scoreAfterAdd: score + finalScore });
  const scoreBeforeHand = score;
  score += finalScore;
  // Echo and Legacy both used to be applied here, at SCORE level. Both moved (r193):
  // Echo is now a per-card replay (js/scoring.js retrigger block) because its text is
  // "each card replays twice", and Legacy is now a ×mult so the MULT chip shows it.
  // Both flags are cleared below, after calcScore has read them.
  sleightNextHandDouble = false;
  sleightLegacyMult = false;
  // Reflect is once per round, and only calcScore knows whether it actually
  // replayed anything - so the lock is taken here, on the committed hand, never
  // inside calcScore (which findBestHand runs over every candidate).
  if (typeof reflectSpendForRound === 'function') reflectSpendForRound(handCells);
  // Rider (reward-grid penalty): the ridden Trick still works, it just bills you
  // for every proc. Billed HERE, off _lastHandProcs, because calcScore is run
  // over every candidate hand by findBestHand - charging inside it would empty
  // the clock on hover. A Trick that has left you carries the Rider away with it.
  if (riderTrickId) {
    if (!hasTrick(riderTrickId) && !(acquiredTricks || []).some(t => t.id === riderTrickId)) {
      riderTrickId = null;
    } else {
      const _procs = (_lastHandProcs || {})[riderTrickId] || 0;
      if (_procs > 0) {
        const _cost = _procs * BAL.rider.seconds_per_proc;
        roundSeconds = Math.max(1, roundSeconds - _cost);
        showTimeCost(`-${_cost}s`);
        updateClockUI();
      }
    }
  }
  // Spot Check (reward-grid penalty): playing the flagged hand is what clears it.
  if (spotCheckHand && spotCheckLeft > 0 && hand === spotCheckHand) {
    spotCheckLeft--;
    if (spotCheckLeft <= 0) { spotCheckHand = null; showMessage('Spot check cleared', 'var(--gold)'); }
    else showMessage(`Spot check: ${spotCheckLeft} more`, 'var(--cream-dim)');
  }
  // Compound (mythic): pay out everything banked since the last hand, then clear.
  // Added at SCORE level (not as pips or mult) on purpose - it is a copy of score
  // already earned, so running it back through mult × Focus would multiply it twice.
  if (compoundBanked > 0) {
    score += compoundBanked;
    showMessage('Compound! +' + compoundBanked.toLocaleString(), '#d8a13a');
    compoundBanked = 0;
  }
  if (sleightAmplifierMult) sleightAmplifierMult = 0;
  if (siphonMultX > 1) siphonMultX = 1;   // Siphon's ×3 is spent on this hand
  // Clock-mark Tricks: the pending pip/mult bonuses were already folded into finalScore - clear them now.
  pendingHandPips = 0; pendingHandMult = 0; pendingCardPips = 0;
  // Minute Hand spends ONE of its primed hands (r209). Decremented here rather
  // than inside calcScore because calcScore is also called speculatively by
  // findBestHand and by the live PIPS/MULT preview, which must not consume it.
  if (minuteHandCharges > 0 && hasTrick('minute_hand')) {
    minuteHandCharges--;
    if (minuteHandCharges === 0) showMessage('🕐 Minute Hand spent', 'var(--cream-dim)');
  }
  // Scaling card buffs: a card carrying permMultGrow / permPipsGrow raises its
  // own FLAT bonus now, so the growth shows on its next play (js/deck-grid.js).
  if (typeof growCardScaling === 'function') growCardScaling(result.handCells.map(([r, c]) => gridData[r]?.[c]));
  // Hallmark (r234): this round's marked card, if the hand scored it. After the
  // score commits, exactly like growCardScaling above and recordNaturalScale
  // below - a buff earned by a hand pays out on the NEXT one. Rolling it inside
  // calcScore would fire on every speculative re-score instead.
  if (typeof hallmarkResolve === 'function') hallmarkResolve(result.handCells.map(([r, c]) => gridData[r]?.[c]));
  // Forced Trick fires are spent by the hand they paid for (js/force-trick.js).
  // Cleared here rather than in calcScore for the speculative-re-score reason
  // given there.
  if (typeof forcedTrickIds !== 'undefined' && forcedTrickIds.length) forcedTrickIds = [];
  // Natural Scaling: credit every hand type this play paid for - the primary and
  // any other family it layered (a same-suit run earns both). After the score is
  // committed, so the buff lands on the NEXT hand of that type, not this one.
  if (typeof recordNaturalScale === 'function') recordNaturalScale(hand, handCells);
  handsPlayed++;
  // Record the hand for the SCORE-box hand log. Written here, not in the dance:
  // the dance is a presentation that can be interrupted or cut, whereas this is
  // the point the hand becomes a fact. handCells is read for card faces before
  // removeAndFall clears them.
  if (typeof logPlayedHand === 'function') logPlayedHand(hand, handCells, finalScore, { boss: bossActive });

  // Boss objective progress.
  // Snapshot boss state BEFORE checkBossObjective - a boss-winning hand calls endBoss(),
  // which flips bossActive to false; without this snapshot the normal goal-reach below
  // would then also fire, double-running the interlude (boss grid + payout + new grid).
  const _bossThisHand = bossActive;
  if (_bossThisHand) checkBossObjective(hand, finalScore);

  // Lucky Seven knack: every 7th hand grants +1 swap
  if (hasKnack('lucky_seven') && handsPlayed % BAL.lucky_seven.interval_hands === 0) {
    swaps = Math.min(99, swaps + BAL.lucky_seven.swaps);
    showMessage('🎯 LUCKY SEVEN - +1 SWAP', '#c9a84c');
  }
  if (finalScore > highestHandScore) { highestHandScore = finalScore; highestHandName = hand; }
  // The quarter keeps its own best, for the run report's per-quarter row.
  if (typeof recordQuarterBest === 'function') recordQuarterBest(hand, finalScore);
  if (hand === 'Full House' && hasTrick('full_house_streak')) fullHouseThisRound++;

  // Check challenge progress
  if (challengeActive) checkChallengeAfterHand(result, handCells);

  // on_play sleights (Good Friend exalt, Shortcut challenge-complete) fire when played
  fireSleightsOnPlay(playedCells, handCells, hand);
  // Spectrum deck fixtures: count this hand against any fixture it scored beside.
  if (typeof fireAdjacentSleights === 'function') fireAdjacentSleights(handCells);

  updateCounters(hand, handCells);
  checkUnlocks();

  // ── Check goal immediately after scoring ──
  // Suppressed during/just-after a boss: the boss objective system + post-boss reward
  // grid handle progression. (_bossThisHand catches the boss-winning hand, where endBoss
  // already set bossActive=false above.)
  if (!_bossThisHand && !bossActive && score >= roundGoal && !goalReachedThisRound) {
    console.log('[GOAL] reached', { score, goal: roundGoal, finalScore });
    goalReachedThisRound = true;
    roundEnded = true; // freeze input immediately
    // Stop the round clock the instant the goal is met (unless a challenge is
    // still pending - that path keeps its own timer running). This freezes the
    // clock as a clear "goal reached" signal AND prevents a late timer tick from
    // firing the legacy level-up flow mid-dance - the double level-up / stray-
    // trick bug that surfaced when the clock hit 0 during the win animation.
    if (!challengeActive) { clearInterval(roundInterval); roundInterval = null; }
    const toRemove = [...selected];
    selected = [];
    commitRoundContrib(_contribSnapshot); // goal-clearing hand counts toward the tally
    // Run the score animation; goal interlude fires at end of dance via isGoalHand path
    playScoreDance(result, toRemove, true /* goalHand */);
    return;
  }

  // ── Goal already reached - input is frozen, this shouldn't fire ──
  if (goalReachedThisRound) {
    console.log('[POST-GOAL] hand attempted after goal - ignoring');
    score -= finalScore;
    handsPlayed--;
    if (typeof unlogLastHand === 'function') unlogLastHand();   // the hand is being unwound
    if (finalScore > highestHandScore) { highestHandScore -= finalScore; }
    if (hand === 'Full House' && hasTrick('full_house_streak')) fullHouseThisRound--;
    return;
  }

  // (Animating is guarded at the top of playHand now - a hand submitted mid-animation
  //  is queued and auto-executed once the animation settles, instead of silently failing.)

  // ── Focus for this hand was already generated above (generateHandFocus), so it could
  //    multiply THIS hand's score. Just reset the decay countdown now. ──
  resetFocusDecayTimer();

  // ── THE LAST THREE RAW `roundSeconds +=` SITES, converted (r183) ──────────
  // Deluge, Threepeat and Blood Diamonds were rewinds in everything but name.
  // Writing roundSeconds directly skipped ALL FOUR of the things rewindTime()
  // does: the ROUND_DURATION cap, the ⏪ floater, the rewoundSecondsRound /
  // rewindsThisRound tallies that The Kingfisher and the Time pop-up read, and
  // the boss guard (a boss runs its own clock, so adding to roundSeconds during
  // one did nothing you could see). They now go through the same door as every
  // other rewind, which is also what makes them count for Kingfisher.
  //
  // rewindTime() adds to rewoundSecondsRound itself, so these no longer touch
  // timeManipRound - doing both would double-count them in the payout's
  // "Time manipulation" row (scoring.js sums the two).
  // Deluge: Flushes rewind the clock
  if (hand === 'Flush') { const _dl = BAL.deluge.seconds * trickFires('deluge'); if (_dl > 0) rewindTime(_dl, `🌊 Deluge - rewound ${_dl}s`); }
  // Overtime (r182): a REWIND, and now routed through the real rewind path.
  // It used to add raw seconds straight onto roundSeconds, which meant it was a
  // rewind that the game did not know was a rewind - it never showed the ⏪
  // floater, never counted toward Kingfisher or the round's rewind tally, and
  // was not capped at the round length. rewindTime() does all four, and returns
  // 0 during a boss (bosses run their own clock), which is the correct no-op.
  {
    const _os = Math.floor(markCount_overtime / 3) * BAL.overtime.seconds_per_3 * trickFires('overtime');
    if (_os > 0) rewindTime(_os, `⏱ Overtime - rewound ${_os}s`);
  }
  // Right Time: each card scored in its marked line pauses the clock (rewind conversion pending, task #10)
  { const _rt = handCells.filter(([r,c]) => cellHasRowColBonus(r, c, 'right_time')).length; if (_rt > 0) pauseRound(BAL.right_time.pause_seconds * _rt * trickFires('right_time')); }
  // Threepeat: hand pip-sum divisible by 3 → rewind (r183)
  {
    const _ps = handCells.reduce((s,[r,c]) => s + (gridData[r]?.[c] ? cardPips(gridData[r][c].rank) : 0), 0);
    const _ns = BAL.ninesong.seconds * trickFires('ninesong');
    if (_ps % 3 === 0 && _ns > 0) rewindTime(_ns, `🔁 Threepeat - rewound ${_ns}s`);
  }
  // Blood Diamonds: a hand with at least one heart AND one diamond grants +1 coin and +10s
  if (hasTrick('monochrome')) {
    const _bdc = handCells.map(([r,c]) => gridData[r]?.[c]).filter(Boolean);
    const _hasHeart = _bdc.some(c => c.suit === '♥' || (c.combined && c.suit2 === '♥'));
    const _hasDia   = _bdc.some(c => c.suit === '♦' || (c.combined && c.suit2 === '♦'));
    if (_hasHeart && _hasDia) {
      const _bdf = trickFires('monochrome');
      const _bdCoins = BAL.monochrome.coins * _bdf, _bdSecs = BAL.monochrome.seconds * _bdf;
      grantEntityCoins(_bdCoins, 'trick', 'monochrome');
      rewindTime(_bdSecs, `💎 Blood Diamonds - +${_bdCoins} credit, rewound ${_bdSecs}s`);
    }
  }

  // ── Playing a hand is free by default (owner request, r50) - base cost is 0. ──
  // BUT a reward-grid "Hands +Ns" debuff sets playHandCostThisRound > 0; when it does,
  // that penalty is now live (owner: "make sure that debuff works"). No debuff → 0 → free.
  if (playHandCostThisRound > 0) {
    roundSeconds = Math.max(1, roundSeconds - playHandCostThisRound);
    if (typeof showTimeCost === 'function') showTimeCost(`-${playHandCostThisRound}s`);
    updateClockUI();
  }

  // ── Boss bookkeeping, deliberately HERE ───────────────────────────────────
  // This is after `score += finalScore` and after checkBossObjective, which is the
  // same ordering The Tollman's time charge uses and for the same reason: a hand
  // you cannot afford still counts if it is the hand that wins the round.
  if (bossActive) {
    // The Grind: remember what was played, so the next one of these pays less.
    if (typeof bossGrindPush === 'function') bossGrindPush(hand);
    // The Inspector: the hand it asked for has been seen.
    if (typeof bossInspectHand !== 'undefined' && bossInspectHand && hand === bossInspectHand) bossInspectDone = true;
    // The Tax Man: credits per card. Run dry and the round is lost.
    const _fee = (typeof bossPlayFeeFor === 'function') ? bossPlayFeeFor(handCells.length) : 0;
    if (_fee > 0) {
      if (coins < _fee) {
        coins = 0; updateCoinsUI();
        showMessage('OUT OF CREDITS', 'var(--red)');
        if (typeof endBoss === 'function') { endBoss(false); return; }
      }
      coins -= _fee; updateCoinsUI();
      showMessage(`-${_fee} credits`, 'var(--red)');
    }
  }

  // Streak tracking
  const now = Date.now();
  if (hand === lastHandType) {
    streakCount++;
    // The Starling: every 2nd hand of an unbroken same-type streak grants +1 discard
    if (hasTrick('starling') && streakCount % 2 === 0) {
      discards = Math.min(99, discards + 1);
      showMessage('📋 Type A - +1 discard', '#8fc98f');
    }
    // Re-arming progress for Combo Keeper
    if (!streakSaveArmed) {
      streakSaveProgress++;
      if (streakSaveProgress >= 2) { streakSaveArmed = true; streakSaveProgress = 0; }
    }
  } else {
    // Different hand type - would normally break the streak
    if (hasKnack('combo_keeper') && streakSaveArmed && lastHandType !== null) {
      // Save the streak: consume the save, leave streakCount + lastHandType intact
      streakSaveArmed = false;
      streakSaveProgress = 0;
    } else {
      streakCount = 1;
      lastHandType = hand;
      // Off-type hand without an active save resets re-arm progress too
      streakSaveProgress = 0;
    }
  }
  lastHandTime = now;
  lastHandRoundSeconds = roundSeconds; // for The Heron, snapshotted AFTER this hand's own check above

  // Traveler: a hand that doesn't extend a same-type streak (streakCount stays at 1) counts;
  // every 3 such "no-streak" hands grants +1 swap. Feeds resource-hoarding Tricks (Hoarder House).
  if (hasTrick('mockingbird') && streakCount === 1) {
    _altSwapCount++;
    if (_altSwapCount >= 3) { _altSwapCount = 0; swaps = Math.min(99, swaps + 1); showMessage('🧳 Traveler - +1 swap', '#8fbfd9'); }
  }

  // Hoarder House: playing a hand rewinds the clock 1s per 2 unspent manipulate actions (swaps + discards).
  {
    const _sec = Math.floor((swaps + discards) / BAL.magpie.actions_per_second) * trickFires('magpie');
    if (_sec > 0) rewindTime(_sec, `🏚️ Hoarder House - rewound ${_sec}s`);
  }

  // Clockmaker knack: a single hand scoring ≥30% of the round goal rewinds the clock.
  if (hasKnack('clockmaker') && roundGoal > 0 && finalScore >= roundGoal * BAL.clockmaker.goal_fraction) {
    rewindTime(BAL.clockmaker.seconds, `⏱️ Clockmaker - big hand, rewound ${BAL.clockmaker.seconds}s`);
  }

  // Déjà Vu knack: playing the same ranks in two hands in a row rewinds the clock.
  {
    const _ranks = handCells.map(([r,c]) => gridData[r]?.[c]).filter(cc => cc && cc.rank && !cc._isSleight).map(cc => cc.rank).sort();
    const _rankKey = _ranks.join(',');
    if (hasKnack('deja_vu') && lastHandRankKey !== null && _rankKey !== '' && _rankKey === lastHandRankKey) {
      rewindTime(BAL.deja_vu.seconds, `🔁 Déjà Vu - rewound ${BAL.deja_vu.seconds}s`);
    }
    lastHandRankKey = _rankKey;
  }

  // ── Accumulating Trick effects (post-hand) ──
  handsPlayedRound++;
  handsPlayedGame++;   // Plan Ahead: cumulative hand count (per game)
  handTypesRound.add(hand);
  if (['Run of 3','Run of 4','Straight','Straight Flush'].includes(hand)) { runsPlayedRound++; runStreak++; }
  else runStreak = 0; // Wave Amplification: a non-Run breaks the consecutive-Run streak
  // Set counters (Undue Influence / Shaky Foundation). Increment AFTER scoring so calcScore saw the pre-hand count.
  if (isSetHand(hand)) {
    setsPlayedRound++;
    // Undue Influence: a Set with a face card grants credits = Sets played this round (incl. this one)
    if (handCells.some(([r,c]) => ['J','Q','K'].includes(gridData[r]?.[c]?.rank))) {
      const _ui = setsPlayedRound * trickFires('undue_influence');
      if (_ui > 0) { grantEntityCoins(_ui, 'trick', 'undue_influence'); showMessage('Undue Influence +' + _ui + ' credits', 'var(--gold)'); }
    }
  }
  // ── Priming (Inspirato / Prime Times) ──
  if (trickTrayMode) {
    // Consume primes that contributed this hand (their extra trigger already fired in scoring)
    if (trickTray.some(t => t._primed > 0)) {
      const _pc = []; calcScore(hand, handCells, _pc);
      const _ids = new Set(_pc.map(e => e.id));
      const _mm = hasKnack('muscle_memory'); // primes last one extra hand
      trickTray.forEach(t => {
        if (t._primed > 0 && _ids.has(t.id)) {
          if (_mm && !t._primeHeld) { t._primeHeld = true; } // skip this consumption once
          else { t._primed = Math.max(0, t._primed - 1); t._primeHeld = false; }
        }
      });
    }
    // Inspirato: a scored Ace primes the first and last tray Tricks
    if (hasTrick('wild_heart') && trickTray.length && handCells.some(([r,c]) => gridData[r]?.[c]?.rank === 'A')) {
      trickTray[0]._primed = (trickTray[0]._primed || 0) + 1;
      const _last = trickTray[trickTray.length - 1];
      if (_last !== trickTray[0]) _last._primed = (_last._primed || 0) + 1;
    }
    // Prime Times: a scored prime rank primes the next Trick, cycling tray positions 1st→2nd→3rd→5th→7th
    if (hasTrick('prime_times') && trickTray.length && handCells.some(([r,c]) => ['A','2','3','5','7'].includes(gridData[r]?.[c]?.rank))) {
      const _cyc = [0,1,2,4,6];
      const _tt = trickTray[_cyc[_primeTimesCursor % _cyc.length]];
      _primeTimesCursor = (_primeTimesCursor + 1) % _cyc.length;
      if (_tt) _tt._primed = (_tt._primed || 0) + 1;
    }
  }
  if (hasTrick('compound_mult')) bonusMult_compound = Math.round((bonusMult_compound + BAL.compound_mult.mult_per_hand) * 10) / 10;
  if (hasTrick('prolific')) bonusPips_prolific += BAL.prolific.pips_per_hand;
  // Acorns: each card scored this hand grows the trick's stored Focus by 0.05 (per game)
  if (hasTrick('acorns')) bonusFocus_acorns += handCells.length * BAL.acorns.focus_per_card;
  // Feng Shui: grow its permanent pips when another position trick fired this hand
  if (hasTrick('feng_shui') && _lastHandPositionFired) bonusPips_fengshui += BAL.feng_shui.pips_per_hand;
  // Assembly Line: commit this hand's mark tally (incl. replays) to the round counter
  if (hasTrick('assembly_line')) assemblyMarkCount = _lastHandAssemblyEnd;
  // Ley Line: a card scored where a row effect and a column effect cross gains permanent +mult, once per minute
  if (hasTrick('rowcol_perm_double')) {
    const _lc = handCells.find(([r,c]) => isEffectIntersection(r, c));
    if (_lc && firesThisMinute('rowcol_perm_double')) {
      const _lcc = gridData[_lc[0]]?.[_lc[1]];
      if (_lcc && _lcc.rank) { const _lk = cardId(_lcc); permMult[_lk] = (permMult[_lk] || 0) + BAL.rowcol_perm_double.perm_mult; showMessage('Ley Line! +' + BAL.rowcol_perm_double.perm_mult + ' mult', '#a25cd8'); }
    }
  }
  // Temporal Rift: a card scored at a row×column effect intersection permanently gains a "pause
  // when scored" buff (reuses The Vulture's _vulturePause pipeline). Once per minute, and it skips
  // any card that already carries a time buff - no stacking from this trick. Mirrors Ley Line.
  if (hasTrick('temporal_rift')) {
    const _tr = handCells.find(([r,c]) => isEffectIntersection(r, c) && gridData[r]?.[c] && gridData[r][c].rank && !gridData[r][c]._vulturePause);
    if (_tr && firesThisMinute('temporal_rift')) {
      const _trc = gridData[_tr[0]]?.[_tr[1]];
      if (_trc) { _trc._vulturePause = (_trc._vulturePause || 0) + BAL.temporal_rift.pause; showMessage('Temporal Rift! +' + BAL.temporal_rift.pause + 's pause when scored', '#5aa9e6'); }
    }
  }
  // (Clean Sweep's Focus advance now fires in generateHandFocus, before scoring, so it helps this hand.)
  if (hasTrick('big_win') && !jackpotFired && finalScore >= BAL.big_win.score_threshold) { jackpotFired = true; bonusMult_jackpot += BAL.big_win.mult; showMessage('Jackpot! +5 mult permanently', 'var(--gold)'); }
  if (hasTrick('snowball') && lastCalcPips >= BAL.snowball.score_threshold) {
    result.handCells.forEach(([r,c]) => {
      const card = gridData[r]?.[c]; if (!card || !card.rank) return;
      const k = cardId(card);
      permPips[k] = (permPips[k]||0) + BAL.snowball.pips;
    });
    showMessage('Snowball! +2 pips to scored cards', '#e8c56b');
  }

  // ── Card curses: apply per-score effects and work them off ──
  // Each scored cursed card ticks its curse down; at 0 the curse lifts.
  result.handCells.forEach(([r, c]) => {
    const card = gridData[r]?.[c];
    if (!card || !card.rank || card._isSleight || card._isStone) return;
    const k = cardId(card);
    const curse = cardCurses[k];
    if (!curse) return;
    if (curse.id === 'taxing') {
      roundSeconds = Math.max(1, roundSeconds - 3);
      updateClockUI();
      showTimeCost('-3s');
    }
    curse.left--;
    if (curse.left <= 0) {
      delete cardCurses[k];
      showMessage(`Curse lifted: ${card.rank}${card.suit}`, '#54af88');
      // Scavenger: farm lifted curses for coins + a discard next round
      if (hasKnack('scavenger')) {
        grantEntityCoins(BAL.scavenger.coins, 'knack', 'scavenger');
        nextRoundDiscardDelta += 1;
        showMessage(`Scavenger: +${BAL.scavenger.coins} coins, +1 discard next round`, 'var(--gold)');
      }
    }
  });

  // Bedrock: Four of a Kind permanently buffs its 4 cards
  if (hand === 'Four of a Kind' && hasTrick('rare_bloom')) {
    result.handCells.forEach(([r,c]) => { const card = gridData[r]?.[c]; if (!card || !card.rank) return; const k = cardId(card); permPips[k] = (permPips[k]||0) + BAL.rare_bloom.perm_pips; });
    showMessage('Bedrock! +' + BAL.rare_bloom.perm_pips + ' pips to those cards', '#e8c56b');
  }

  // First hand this round
  if (firstHandThisRound) {
    if (hasTrick('first_fruits')) {
      handCells.forEach(([r,c]) => {
        const k = cardId(gridData[r][c]);
        permPips[k] = (permPips[k]||0) + BAL.first_fruits.pips;
      });
    }
    // (Head Start's +5 Focus now fires in generateHandFocus, before scoring, so it helps this hand.)
    firstHandThisRound = false;
  }

  // Heartwood - dead center card
  const _hwR = Math.floor(gridRows / 2), _hwC = Math.floor(gridCols / 2);
  if (hasTrick('heartwood') && handCells.some(([r,c])=>r===_hwR&&c===_hwC)) {
    const k = cardId(gridData[_hwR][_hwC]);
    permPips[k] = (permPips[k]||0) + BAL.heartwood.pips;
    permMult[k] = (permMult[k]||0) + BAL.heartwood.mult;
  }

  // ── Suit effects (applied per scoring card) ──
  const scoringCards = result.handCells.map(([r,c]) => gridData[r][c]);

  // Suits are neutral by default - effects only via exalt/corrupt or Tricks.
  // (♥ and ♣ Tricks handled in calcScore; ♦/♠ base effects removed with neutral suits)

  // Spade Flood Trick still needs allSpades flag (computed in calcScore via spade_flood)

  // ── Exalt / Corrupt - coins & time (pips & mult applied in calcScore) ──
  // Replay-weighted: a card that replayed fires its exalt/corrupt coin/time once per (re)play,
  // matching the pip/mult side in calcScore. `_lastRetrigByCell` is from the finalScore calcScore above.
  const _ecReps = result.handCells.map(([r,c]) => _handRetrigByCell[r + '-' + c] || 1);
  const _ecPlay = exaltCorruptTotals(scoringCards, _ecReps);
  // ── Exalt / Corrupt triggers (per scored card; state is permanent + mutually exclusive) ──
  // Counters live ON the card object so they track the individual card and survive deck
  // cycling. ♣ exalt = in a 3+-club hand 2×; ♣ corrupt = lone club in a hand 2×.
  // ♥ exalt = only heart in a hand 2× (♥ corrupt is swap-driven, resolved below + on discard).
  // ♠ exalt = played within first 30s of the round 2× (♠ corrupt is discard-driven).
  // ♦ exalt = played while coins < 5, 2×; ♦ corrupt = played while coins > 65, 2×.
  if (exaltCorruptEnabled) { // ── triggers skipped entirely while the mechanic is paused ──
  const coinsAtPlay   = coins; // snapshot before payout
  const _clubsInHand  = handCells.reduce((n,[r,c]) => n + (gridData[r]?.[c]?.suit === '♣' ? 1 : 0), 0);
  const _heartsInHand = handCells.reduce((n,[r,c]) => n + (gridData[r]?.[c]?.suit === '♥' ? 1 : 0), 0);
  const _spadeEarly   = (roundStartSeconds - roundSeconds) < 30; // within first 30s of the round timer
  handCells.forEach(([_r,_c]) => {
    const _card = gridData[_r]?.[_c];
    if (!_card || _card._isSleight || _card._isTrick || _card._isStone || !_card.rank) return;
    if (_card._exalted || _card._corrupted) return; // already locked
    if (_card.suit === '♣') {
      if (_clubsInHand >= 3) {
        _card._clubPackPlays = (_card._clubPackPlays || 0) + 1;
        if (_card._clubPackPlays >= 2) { exaltCard(_r, _c); showMessage('♣ Club exalted - strength in numbers!', '#ffd700'); }
      } else if (_clubsInHand === 1) {
        _card._clubSoloPlays = (_card._clubSoloPlays || 0) + 1;
        if (_card._clubSoloPlays >= 2) { corruptCard(_r, _c); showMessage('♣ Club corrupted - solo glory!', '#cc88ff'); }
      }
    } else if (_card.suit === '♥') {
      if (_heartsInHand === 1) {
        _card._heartSoloPlays = (_card._heartSoloPlays || 0) + 1;
        if (_card._heartSoloPlays >= 2) { exaltCard(_r, _c); showMessage('♥ Heart exalted - stood alone!', '#ffd700'); }
      }
    } else if (_card.suit === '♠') {
      if (_spadeEarly) {
        _card._spadeEarlyPlays = (_card._spadeEarlyPlays || 0) + 1;
        if (_card._spadeEarlyPlays >= 2) { exaltCard(_r, _c); showMessage('♠ Spade exalted - early strike!', '#ffd700'); }
      }
    } else if (_card.suit === '♦') {
      if (coinsAtPlay < 5) {
        _card._diaPoorPlays = (_card._diaPoorPlays || 0) + 1;
        if (_card._diaPoorPlays >= 2) { exaltCard(_r, _c); showMessage('♦ Diamond exalted - scarcity!', '#ffd700'); }
      } else if (coinsAtPlay > 65) {
        _card._diaRichPlays = (_card._diaRichPlays || 0) + 1;
        if (_card._diaRichPlays >= 2) { corruptCard(_r, _c); showMessage('♦ Diamond corrupted - excess!', '#cc88ff'); }
      }
    }
  });
  // ♥ corruption resolution: a swap-pending heart must appear in THIS scored hand or it sours.
  for (let _hr = 0; _hr < gridRows; _hr++) for (let _hc = 0; _hc < gridCols; _hc++) {
    const _h = gridData[_hr]?.[_hc];
    if (!_h || _h.suit !== '♥' || !_h._heartSwapPending) continue;
    const _inHand = handCells.some(([r,c]) => r === _hr && c === _hc);
    _h._heartSwapPending = false; // resolved either way
    if (!_inHand && !_h._exalted && !_h._corrupted) {
      corruptCard(_hr, _hc);
      showMessage('♥ Heart corrupted - swapped, then left behind', '#cc88ff');
    }
  }
  } // end exaltCorruptEnabled trigger block
  // Exalt/corrupt credits are floored at 0 (no debt), so the tally records what was
  // actually paid rather than the raw delta.
  if (_ecPlay.coins !== 0) {
    const _ecPaid = Math.max(0, coins + _ecPlay.coins) - coins;
    coins += _ecPaid; updateCoinsUI();
    foldContribution(contribDisplayName('exalt'), 'coin', _ecPaid);
  }
  if (_ecPlay.time !== 0) {
    roundSeconds = Math.max(1, Math.min(roundSeconds + _ecPlay.time, ROUND_DURATION));
    updateClockUI();
  }

  // ── Card value effects (after scoring) ──
  const scoringRanks = scoringCards.map(c => c.rank);

  // Ley Line redesigned (r77): now a permanent +mult at the intersection of two grid effects,
  // handled in the post-hand block below. The old self-marked pip-doubling is gone.


  // Penny Saved: 5s scored also count
  if (hasTrick('fives_discard')) {
    const fivesPlayed = scoringCards.filter(c => c.rank === '5').length;
    bonusMult_fives += fivesPlayed * BAL.fives_discard.pips_per_five;
  }

  // Cloud Nine: each 9 scored is forgotten, adds +9 to trick mult
  if (hasTrick('nines_mult')) {
    scoringCards.forEach(card => {
      if (card.rank === '9') {
        bonusMult_nines += BAL.nines_mult.mult_per_nine;
        // Remove this specific card from future/past decks
        let removed = false;
        drawPile = drawPile.filter(c => {
          if (!removed && c.rank === '9' && c.suit === card.suit) { removed = true; return false; }
          return true;
        });
        if (!removed) playedPile = playedPile.filter(c => {
          if (!removed && c.rank === '9' && c.suit === card.suit) { removed = true; return false; }
          return true;
        });
        if (removed) expectedDeckTotal--;
      }
    });
  }

  // Fours perm: 4-card hand permanently gives 4th card +4 pips
  if (hasTrick('fours_perm') && result.handCells.length === 4) {
    const fourthCell = result.handCells[3];
    const k = cardId(gridData[fourthCell[0]][fourthCell[1]]);
    permPips[k] = (permPips[k] || 0) + BAL.fours_perm.pips;
  }

  // Track cards scored for Lucky Roll (sixes_perm)
  if (hasTrick('sixes_perm')) {
    scoringCards.forEach(card => {
      cardsScoredTotal++;
      if (cardsScoredTotal % BAL.sixes_perm.interval === 0) {
        const roll = Math.floor(Math.random() * (BAL.sixes_perm.roll_max - BAL.sixes_perm.roll_min + 1)) + BAL.sixes_perm.roll_min;
        const k = cardId(card);
        permPips[k] = (permPips[k] || 0) + roll;
      }
    });
  } else {
    cardsScoredTotal += scoringCards.length;
  }

  // Queen/King post-score: shift adjacent non-scored cards' ranks
  const scoredSet = new Set(result.handCells.map(([r,c]) => `${r}-${c}`));
  result.handCells.forEach(([r,c]) => {
    const card = gridData[r][c];
    const isQueen = card.rank === 'Q' || (card.combined && card.rank2 === 'Q');
    const isKing  = card.rank === 'K' || (card.combined && card.rank2 === 'K');
    if ((isQueen && hasTrick('queens_upgrade')) || (isKing && hasTrick('kings_downgrade'))) {
      getNeighbors(r, c).forEach(([nr, nc]) => {
        if (!scoredSet.has(`${nr}-${nc}`) && gridData[nr][nc]) {
          const adj = gridData[nr][nc];
          const curIdx = ACTIVE_RANKS.indexOf(adj.rank);
          if (curIdx === -1) return;
          let newIdx;
          if (isQueen && hasTrick('queens_upgrade')) {
            newIdx = curIdx === ACTIVE_RANKS.length - 1 ? 1 : curIdx + 1; // K wraps to 2
          } else {
            newIdx = curIdx === 0 ? ACTIVE_RANKS.length - 1 : curIdx - 1; // A wraps to K (2 wraps to A)
          }
          gridData[nr][nc] = { ...adj, rank: ACTIVE_RANKS[newIdx] };
        }
      });
    }
  });

  // Ace Absorb: when an Ace scores, one random adjacent non-scored card is forgotten and its bonuses added to the Ace.
  // Monopoly (Spectrum) is the same effect on a 15 or a 20 - Spectrum has no Aces, so it gets its own trigger rank set.
  const _absorbCell = hasTrick('aces_absorb') && scoringRanks.includes('A')
        ? result.handCells.find(([r,c]) => gridData[r][c].rank === 'A')
        : hasTrick('monopoly') && scoringRanks.some(rk => MONOPOLY_RANKS.includes(rk))
        ? result.handCells.find(([r,c]) => MONOPOLY_RANKS.includes(gridData[r][c].rank))
        : null;
  if (_absorbCell) absorbAdjacentInto(_absorbCell, scoredSet);

  // Clear trick card
  trickCardPos = null;
  trickCardTimer = 0;

  const toRemove = [...selected];
  selected = [];

  commitRoundContrib(_contribSnapshot); // committed (non-goal) hand counts toward the tally
  // Kick off the score dance - it handles updateScoreUI, removeAndFall, levelUp
  playScoreDance(result, toRemove);
}

// ══════════════════════════════════════════════
// SCORE DANCE
// ══════════════════════════════════════════════
let danceAbortController = null;
let dncGen = 0; // bumped when a new preview-dance starts; a superseded dance bails without touching shared UI

// Ace Absorb / Monopoly: the card at `cell` swallows one random adjacent card
// that wasn't part of the hand - the neighbour's permanent bonuses plus its pip
// value transfer over, and every copy of it is erased from the deck.
const MONOPOLY_RANKS = ['15', '20'];
function absorbAdjacentInto(cell, scoredSet) {
  const [ar, ac] = cell;
  const eater = gridData[ar]?.[ac];
  if (!eater) return;
  const eligibleNeighbors = getNeighbors(ar, ac).filter(([nr,nc]) =>
    !scoredSet.has(`${nr}-${nc}`) && gridData[nr][nc] && gridData[nr][nc].rank
  );
  if (!eligibleNeighbors.length) return;
  const [tr, tc] = eligibleNeighbors[Math.floor(Math.random() * eligibleNeighbors.length)];
  const target = gridData[tr][tc];
  const tk = cardId(target);
  const ak = cardId(eater);
  // Transfer perm bonuses to the eater
  permPips[ak] = (permPips[ak] || 0) + (permPips[tk] || 0) + cardPips(target.rank);
  permMult[ak] = (permMult[ak] || 0) + (permMult[tk] || 0);
  delete permPips[tk]; delete permMult[tk];
  // Forget from deck - count how many we actually erase, plus the target itself on grid
  const beforeCount = drawPile.length + playedPile.length;
  drawPile   = drawPile.filter(c => !(c.rank === target.rank && c.suit === target.suit));
  playedPile = playedPile.filter(c => !(c.rank === target.rank && c.suit === target.suit));
  const afterCount = drawPile.length + playedPile.length;
  expectedDeckTotal -= (1 + (beforeCount - afterCount)); // 1 for target (on grid), rest from pools
  // Replace on grid with new drawn card
  gridData[tr][tc] = drawCard() || null;
}
