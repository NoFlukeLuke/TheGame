function exaltCorruptTotals(cards) {
  let pips = 0, mult = 0, coins = 0, time = 0;
  if (!exaltCorruptEnabled) return { pips, mult, coins, time }; // mechanic paused → no suit buffs
  cards.forEach(c => {
    if (!c) return;
    if (c._exalted) {
      if      (c.suit === '♣') pips  += BAL._exalt.club_pips;          // exalted club:    +10 pips
      else if (c.suit === '♦') coins += BAL._exalt.diamond_coins;           // exalted diamond: +3 coins
      else if (c.suit === '♥') mult  += BAL._exalt.heart_mult;           // exalted heart:   +2 mult
      else if (c.suit === '♠') time  += BAL._exalt.spade_time;           // exalted spade:   +4 time
    }
    if (c._corrupted) {
      if      (c.suit === '♣') { pips  += BAL._corrupt.club_pips; mult  += BAL._corrupt.club_mult;  }  // corrupted club:    +25 pips  -3 mult
      else if (c.suit === '♦') { coins += BAL._corrupt.diamond_coins;  pips  += BAL._corrupt.diamond_pips; }  // corrupted diamond: +5 coins  -20 pips
      else if (c.suit === '♥') { mult  += BAL._corrupt.heart_mult;  time  += BAL._corrupt.heart_time;  }  // corrupted heart:   +5 mult   -5 time
      else if (c.suit === '♠') { time  += BAL._corrupt.spade_time;  coins += BAL._corrupt.spade_coins;  }  // corrupted spade:   +7 time   -8 coins
    }
  });
  return { pips, mult, coins, time };
}

function calcScore(handName, cells, contrib = null) {
  const base = HAND_BASE[handName];
  if (!base) return 0;
  const _scoreCells = scoringOrderCells(cells);
  const cards = _scoreCells.map(([r,c]) => gridData[r][c]);
  const hasTrickCard = trickCardPos && cells.some(([r,c]) => r===trickCardPos[0] && c===trickCardPos[1]);
  // Predicted post-update streak count for THIS hand (playHand updates streakCount/lastHandType
  // only after calcScore runs, so reading streakCount directly here is one hand stale).
  const _effStreak = (lastHandType !== null && handName === lastHandType) ? streakCount + 1 : 1;

  // 1. Base pips (scaled by level) + card pips
  const levelScale = Math.pow(1.1, level - 1);
  let totalPips = Math.round(base.pips * levelScale);

  // Rising Tide: +1 base mult per level
  const risingTideBonus = hasTrick('rising_tide') ? (level - 1) : 0;

  // ── contrib tracking: accumulate per-Trick pip/mult deltas ──
  const _cp = {}, _cm = {};  // per-Trick pip/mult deltas (always tracked so Mirror can duplicate them)
  const bPip  = (id, d) => { if (d) _cp[id] = (_cp[id]||0)+d; };
  const bMult = (id, d) => { if (d) _cm[id] = (_cm[id]||0)+d; };

  // Process cards sequentially so Knave Power can multiply running total
  const _handMinRankVal = hasTrick('summit')
    ? Math.min(...cells.map(([_r,_c]) => RANK_ORDER[gridData[_r][_c]?.rank] || 99)) : -1;
  // Eye of the Storm: in the round's middle third, the highest-ranked card(s) retrigger
  const _eyeFrac = roundFractionRemaining();
  const _eyeStorm = hasTrick('eye_of_storm') && _eyeFrac > 1/3 && _eyeFrac <= 2/3;
  const _rankHigh = rk => rk === 'A' ? 14 : (RANK_ORDER[rk] || 0);
  const _eyeMax = _eyeStorm ? Math.max(...cards.map(c => _rankHigh(c.rank))) : -1;
  // High and Mighty (knack): the hand's highest-ranked card(s) all replay once
  const _hnmOn  = hasKnack('high_and_mighty');
  const _hnmMax = _hnmOn ? Math.max(...cards.map(c => _rankHigh(c.rank))) : -1;
  // Ripple: once per 30s, cards within one rank of another card in the hand retrigger
  const _rippleReady = hasTrick('ripple') && (Date.now() - _rippleLastFire >= BAL.ripple.cooldown_ms);
  const _rippleSet = new Set();
  if (_rippleReady) {
    _scoreCells.forEach(([_rr,_cc]) => {
      const _c0 = gridData[_rr][_cc]; if (!_c0) return;
      if (_scoreCells.some(([_r2,_c2]) => (_r2!==_rr||_c2!==_cc) && gridData[_r2][_c2] && _withinOneRank(_c0.rank, gridData[_r2][_c2].rank))) _rippleSet.add(`${_rr}-${_cc}`);
    });
  }
  let _clubHits = 0; // Hard Labour: counts club scoring hits, including retriggers
  let _handRetrigs = 0; // Cuckoo: extra retriggers in this hand (committed to retriggersThisRound in playHand)
  let _vultureFires = 0; // Vulture: total buff-seconds fired this hand, counting retriggers
  const _eightCount = hasTrick('eights_retrigger') ? cards.filter(c => c.rank === '8').length : 0;
  // Huddle: set of scored cells for in-hand adjacency. Assembly Line: running mark counter
  // (starts from this round's persistent count; simulated locally so calcScore stays pure).
  const _cellSet = new Set(_scoreCells.map(([_hr,_hc]) => _hr + '-' + _hc));
  const _asmOn = hasTrick('assembly_line');
  let _asmK = _asmOn ? assemblyMarkCount : 0;
  let _asmMult = 0;
  // Straight Shot: capture the modified pip value of the line's first & last card
  const _slFirstKey = _scoreCells.length ? _scoreCells[0][0] + '-' + _scoreCells[0][1] : '';
  const _slLastKey  = _scoreCells.length ? _scoreCells[_scoreCells.length-1][0] + '-' + _scoreCells[_scoreCells.length-1][1] : '';
  let _slFirstPips = 0, _slLastPips = 0;
  _scoreCells.forEach(([r, c]) => {
    const card = gridData[r][c];
    const baseRank = card.rank;
    const _origPips = cardPips(baseRank);
    let rawPips = _origPips;
    if (hasTrick('face_value') && ['J','Q','K'].includes(baseRank)) { rawPips = BAL.face_value.face_pips; bPip('face_value', rawPips - _origPips); }
    else if (hasTrick('first_light') && baseRank === 'A') { rawPips = BAL.first_light.worth; bPip('first_light', rawPips - _origPips); }
    if (hasTrick('humble_roots') && ['A','2','3','4','5'].includes(baseRank)) { const _b = rawPips; rawPips *= BAL.humble_roots.pip_mult; bPip('humble_roots', rawPips - _b); }
    if (hasTrick('summit') && (RANK_ORDER[baseRank] || 0) === _handMinRankVal) { const _b = cardPips(baseRank) * level; rawPips += _b; bPip('summit', _b); }
    let cp = rawPips;
    if (hasTrick('rich_soil')) { cp += BAL.rich_soil.pips; bPip('rich_soil', BAL.rich_soil.pips); }
    if (hasTrick('fertile_ground')) { cp += BAL.fertile_ground.pips; bPip('fertile_ground', BAL.fertile_ground.pips); }
    if (hasTrick('court_of_leaves') && ['J','Q','K'].includes(baseRank)) { cp += BAL.court_of_leaves.pips; bPip('court_of_leaves', BAL.court_of_leaves.pips); }
    if (hasTrick('power_two') && baseRank === '2') { cp += BAL.power_two.pips; bPip('power_two', BAL.power_two.pips); }
    if (hasTrick('ten_strong') && baseRank === '10') { cp += BAL.ten_strong.pips; bPip('ten_strong', BAL.ten_strong.pips); }
    if (hasTrick('king_guard') && (baseRank === 'K' || baseRank === 'J')) { cp += BAL.king_guard.pips; bPip('king_guard', BAL.king_guard.pips); }
    if (hasTrick('dark_matter') && card._corrupted) { cp += BAL.dark_matter.pips; bPip('dark_matter', BAL.dark_matter.pips); }
    const _eKey = cardKey(card.rank, card.suit);
    const _pp = permPips[_eKey] || 0;
    cp += _pp;
    bPip('sapling', _pp);
    // Huddle: +pips per orthogonally-adjacent card/sleight also in this hand
    if (hasTrick('huddle')) {
      let _adj = 0;
      if (_cellSet.has((r-1)+'-'+c)) _adj++;
      if (_cellSet.has((r+1)+'-'+c)) _adj++;
      if (_cellSet.has(r+'-'+(c-1))) _adj++;
      if (_cellSet.has(r+'-'+(c+1))) _adj++;
      if (_adj) { const _hb = _adj * BAL.huddle.pips_per_adj; cp += _hb; bPip('huddle', _hb); }
    }
    // Permanent ×pips enhancement (The Forge / Bargain / Wager events)
    const _xp = permXPips[_eKey] || 1;
    if (_xp !== 1) { const _preXp = cp; cp *= _xp; bPip('sapling', cp - _preXp); }
    // Right Place: marked row/column cards score +flat pips
    if (cellHasRowColBonus(r, c, 'rowcol_triple_pips')) { cp += BAL.rowcol_triple_pips.flat_pips; bPip('rowcol_triple_pips', BAL.rowcol_triple_pips.flat_pips); }
    // Leaden curse: this card contributes no pips at all (applied last so it wins)
    if (cardCurses[_eKey]?.id === 'leaden') cp = 0;
    // Straight Shot: remember the first/last line card's modified pips (post-buff, post-curse, pre-replay)
    const _cKey = r + '-' + c;
    if (_cKey === _slFirstKey) _slFirstPips = cp;
    if (_cKey === _slLastKey)  _slLastPips = cp;
    // Retrigger / replay: certain conditions score this card's pips an extra time
    let _retrig = 1;
    const _r2 = false; // Double Take redesigned — now duplicates a Trick, not the 2 card
    const _r8 = hasTrick('eights_retrigger') && baseRank === '8';
    const _rc = false; // Cornered redesigned — now a post-loop pip multiplier, not a replay
    const _rl = cellHasRowColBonus(r, c, 'rowcol_retrigger') && (((card._id || 0) + handsPlayedRound) % 2 === 0); // Echo Location: deterministic 50%
    const _pt = cellHasRowColBonus(r, c, 'perfect_timing'); // Perfect Timing: guaranteed replay
    const _res = _eyeStorm && _rankHigh(baseRank) === _eyeMax;
    const _rip = _rippleReady && _rippleSet.has(`${r}-${c}`);
    const _refl = reflectAimsAt(r, c);
    const _soul = soulMirrorRankCount(baseRank);
    const _re = permRetrig[_eKey] || 0;  // permanent per-card retrigger (events)
    const _rne = hasTrick('closing_time') && roundFractionRemaining() < 0.25; // Near Extinction
    const _hnm = _hnmOn && _rankHigh(baseRank) === _hnmMax; // High and Mighty: top-rank card(s)
    const _ech = hasTrick('echo_hand') && _effStreak >= 2; // Echoes
    const _wp = hasTrick('woodpecker') && woodpeckerPos && r === woodpeckerPos.r && c === woodpeckerPos.c; // Woodpecker
    if (_r2) _retrig++; if (_r8) _retrig += (_eightCount - 1); if (_rc) _retrig++; if (_rl) _retrig++; if (_pt) _retrig++;
    if (_res) _retrig++; if (_rip) _retrig++;
    if (_refl) _retrig++; _retrig += _soul;
    _retrig += _re;
    if (_rne) _retrig++; if (_ech) _retrig++; if (_wp) _retrig += BAL.woodpecker.retrigger_count;
    if (_hnm) _retrig++;
    if (hasTrick('club_double') && (card.suit === '♣' || (card.combined && card.suit2 === '♣'))) _clubHits += _retrig;
    if (card._vulturePause) _vultureFires += card._vulturePause * _retrig; // Vulture buff fires once per (re)trigger
    // Assembly Line: each (re)play of a mark card earns the running counter, then increments it
    if (_asmOn && cellHasRowColBonus(r, c, 'assembly_line')) {
      for (let _ai = 0; _ai < _retrig; _ai++) { _asmMult += _asmK; _asmK++; }
    }
    if (_retrig > 1) {
      const _pre = cp; cp *= _retrig;
      const _extra = cp - _pre;
      _handRetrigs += (_retrig - 1); // Cuckoo counts retriggers this round
      if (_r2) bPip('twos_retrigger', _pre);
      else if (_r8) bPip('eights_retrigger', _pre);
      else if (_rc) bPip('corner_retrigger', _pre);
      else if (_rl) bPip('rowcol_retrigger', _pre);
      else if (_pt) bPip('perfect_timing', _pre);
      else if (_res) bPip('eye_of_storm', _pre);
      else if (_rip) bPip('ripple', _pre);
      else if (_refl) bPip('reflect', _pre);
      else if (_soul) bPip('soul_mirror', _pre);
      else if (_re) bPip('sapling', _extra);
      else if (_hnm) bPip('high_and_mighty', _pre);
      else if (_rne) bPip('closing_time', _pre);
      else if (_ech) bPip('echo_hand', _pre);
      else if (_wp) bPip('woodpecker', _extra);
    }
    totalPips += cp;
  });
  _lastHandRetrigs = _handRetrigs; // snapshot for Cuckoo (read after captureRoundContrib in playHand)
  _lastHandVultureSeconds = _vultureFires; // snapshot for Vulture (retrigger-aware pause seconds)

  // Hidden pair trick
  const rankCounts = {};
  cards.forEach(c => rankCounts[c.rank] = (rankCounts[c.rank]||0)+1);
  const hasPairInHand = Object.values(rankCounts).some(v => v >= 2);
  if (hasTrick('hidden_pair') && hasPairInHand) { totalPips += BAL.hidden_pair.pips; bPip('hidden_pair', BAL.hidden_pair.pips); }
  if (hasTrick('twin_sprouts') && handName === 'Pair')   { totalPips += BAL.twin_sprouts.pips; bPip('twin_sprouts', BAL.twin_sprouts.pips); }
  if (hasTrick('worn_path')    && handName === 'Straight'){ totalPips += BAL.worn_path.pips; bPip('worn_path', BAL.worn_path.pips); }
  if (hasTrick('enriched')     && handName === 'Flush')   { totalPips += BAL.enriched.pips; bPip('enriched', BAL.enriched.pips); }

  // Early bird: first third of the round, +pips per card
  if (hasTrick('early_bird') && roundFractionRemaining() > 2/3) { const _a = BAL.early_bird.pips_per_card * cells.length; totalPips += _a; bPip('early_bird', _a); }

  // Kindling streak: +pips per streak hand beyond the first
  if (hasTrick('kindling') && _effStreak > 1) { const _a = BAL.kindling.pips_per_streak * (_effStreak - 1); totalPips += _a; bPip('kindling', _a); }

  // Albatross: +5 pips for every second the clock has spent paused this round
  if (hasTrick('albatross') && pausedSecondsRound > 0) { const _a = pausedSecondsRound * BAL.albatross.pips_per_second; totalPips += _a; bPip('albatross', _a); }

  // Sediment: +10 pips per 10 seconds of round time elapsed (grows as the round runs down)
  if (hasTrick('sediment')) {
    const _elapsed = Math.max(0, roundStartSeconds - roundSeconds);
    const _a = Math.floor(_elapsed / BAL.sediment.interval_seconds) * BAL.sediment.pips_per_interval;
    if (_a) { totalPips += _a; bPip('sediment', _a); }
  }

  // Clubs: neutral by default; +10 pips each with Hard Labour Trick
  const clubCount = cards.filter(c => c.suit === '♣' || (c.combined && c.suit2 === '♣')).length;
  if (hasTrick('club_double') && _clubHits > 0) { const _a = BAL.club_double.base * (Math.pow(2, _clubHits) - 1); totalPips += _a; bPip('club_double', _a); }

  // Spade Flood: all-Spade hand of 4+ adds roundSeconds x 2 as pips
  const allSpadesCalc = cards.every(c => c.suit === '♠' || (c.combined && c.suit2 === '♠'));
  if (hasTrick('spade_flood') && allSpadesCalc) { const _a = Math.floor(roundSeconds / BAL.spade_flood.time_div); totalPips += _a; bPip('spade_flood', _a); }

  // Sands of Time: remaining round seconds / 2 as trick pips
  if (hasTrick('sands_of_time')) { const _a = Math.floor(roundSeconds / BAL.sands_of_time.divisor); totalPips += _a; bPip('sands_of_time', _a); }

  // Compost: +3 pips per card discarded this round
  if (hasTrick('discard_pips')) { const _a = cardsDiscardedRound * BAL.discard_pips.pips_per_discard; totalPips += _a; bPip('discard_pips', _a); }
  // Stand-Up: +10 pips per charge remaining across all owned Sleights
  if (hasTrick('stand_up')) { const _a = sleightChargeInfo().total * BAL.stand_up.pips_per_charge; if (_a) { totalPips += _a; bPip('stand_up', _a); } }

  // Penny Saved: accumulated trick pips from discarded 5s
  if (hasTrick('fives_discard')) { totalPips += bonusMult_fives; bPip('fives_discard', bonusMult_fives); }

  // Clock-mark Tricks: pending pip bonuses accrued as the clock passed timestamps (consumed in playHand)
  if (pendingHandPips > 0) { totalPips += pendingHandPips; bPip('quarter_chime', pendingHandPips); }
  if (pendingCardPips > 0) { totalPips += pendingCardPips; bPip('second_hand', pendingCardPips); }

  // Trinity Run: +9 mult for runs with 3/6/9 (added to mult section below)
  const hasTrinityRank = (['Run of 3','Run of 4','Straight','Straight Flush'].includes(handName)) &&
    cards.some(c => ['3','6','9'].includes(c.rank));

  // 2. Base mult + bonuses
  let mult = base.mult + sleightAmplifierMult;

  // Assembly Line: apply the mult accumulated in the per-card loop; snapshot the round counter
  if (_asmMult > 0) { mult += _asmMult * BAL.assembly_line.mult_per_prior; bMult('assembly_line', _asmMult * BAL.assembly_line.mult_per_prior); }
  if (_asmOn) _lastHandAssemblyEnd = _asmK;

  if (risingTideBonus > 0) { mult += risingTideBonus; bMult('rising_tide', risingTideBonus); }
  // Minute Hand: pending mult accrued as the clock passed minute marks (consumed in playHand)
  if (pendingHandMult > 0) { mult += pendingHandMult; bMult('minute_hand', pendingHandMult); }
  // Night owl: last third of the round, +mult per card
  if (hasTrick('night_owl') && roundFractionRemaining() <= 1/3) { const _a = BAL.night_owl.mult_per_card * cells.length; mult += _a; bMult('night_owl', _a); }
  // Wildfire: 3+ same hands in a row
  if (hasTrick('wildfire') && _effStreak >= 3) { mult += BAL.wildfire.mult; bMult('wildfire', BAL.wildfire.mult); }
  // Hummingbird: +mult per clock pause triggered this game (uncapped)
  if (hasTrick('hummingbird') && pauseInstanceGame > 0) { const _a = pauseInstanceGame * BAL.hummingbird.mult_per_pause; mult += _a; bMult('hummingbird', _a); }
  // The Kingfisher: +1 mult per 5 seconds paused OR rewound this round (the rewind-aware amplifier)
  if (hasTrick('kingfisher')) {
    const _manip = pausedSecondsRound + rewoundSecondsRound;
    const _a = Math.floor(_manip / BAL.kingfisher.interval_seconds) * BAL.kingfisher.mult_per_interval;
    if (_a) { mult += _a; bMult('kingfisher', _a); }
  }
  // The Swift: +mult for every N seconds of round time elapsed
  if (hasTrick('swift')) { const _e = Math.max(0, roundStartSeconds - roundSeconds); const _a = Math.floor(_e / BAL.swift.interval_seconds) * BAL.swift.mult_per_interval; if (_a) { mult += _a; bMult('swift', _a); } }
  // Eagle Eye: +mult per 10 round-seconds elapsed since the last swap (or round start if none yet)
  if (hasTrick('still_water')) {
    const elapsedSinceSwap = lastSwapRoundSeconds !== null
      ? Math.max(0, lastSwapRoundSeconds - roundSeconds)
      : Math.max(0, roundStartSeconds - roundSeconds);
    const _a = BAL.still_water.mult_per_interval * Math.floor(elapsedSinceSwap / 10);
    if (_a) { mult += _a; bMult('still_water', _a); }
  }

  // Hand-specific mult
  const isRun = ['Run of 3','Run of 4','Straight','Straight Flush'].includes(handName);
  if (hasTrick('overgrowth') && isRun) { const _a = BAL.overgrowth.pips_per_card * cells.length; totalPips += _a; bPip('overgrowth', _a); }
  if (hasTrick('long_road') && isRun) { const _a = BAL.long_road.mult_per_card * cells.length; mult += _a; bMult('long_road', _a); }
  if (hasTrick('correct_run') && isRun && canBeOrderedRun(cells)) {
    const _ap = BAL.correct_run.pips_per_card * cells.length; totalPips += _ap; bPip('correct_run', _ap);
    const _am = BAL.correct_run.mult_per_card * cells.length; mult += _am; bMult('correct_run', _am);
  }
  if (handName === 'Flush') {
    if (hasTrick('tidal_force')) { mult += BAL.tidal_force.mult; bMult('tidal_force', BAL.tidal_force.mult); }
  }
  // Row/col +2 mult per affected card
  cells.forEach(([r, c]) => {
    const matches = rowColBonuses.filter(b => b.id === 'rowcol_mult' && ((b.axis === 'row' && b.index === r) || (b.axis === 'col' && b.index === c)));
    mult += matches.length * 2;
  });

  // Shape: straight line — add first + last card pip values to mult
  // Straight Shot: a 5-card hand in a straight line adds its first+last card's modified pips to mult
  if (hasTrick('shape_line') && cells.length === 5 && isStraightLine(cells)) {
    const _a = _slFirstPips + _slLastPips; mult += _a; bMult('shape_line', _a);
  }

  // Batch C — positional conditions
  if (hasTrick('edge_pips') && isOnEdge(cells)) { const _a = cells.length * BAL.edge_pips.pips_per_card; totalPips += _a; bPip('edge_pips', _a); }
  const { rowSpan, colSpan } = spanStats(cells);
  // Inclusive: a hand spanning the full width or full height of the grid scores +mult
  if (hasTrick('wide_span_mult') && (colSpan === gridCols || rowSpan === gridRows)) {
    mult += BAL.wide_span_mult.mult; bMult('wide_span_mult', BAL.wide_span_mult.mult);
  }

  // Perm mult
  cards.forEach(card => {
    const _pm = permMult[cardKey(card.rank, card.suit)] || 0;
    mult += _pm;
    bMult('perm_mult', _pm);
  });
  // Permanent ×mult enhancement (The Forge / Bargain / Wager events)
  cards.forEach(card => {
    const _xm = permXMult[cardKey(card.rank, card.suit)] || 1;
    if (_xm !== 1) { const _preXm = mult; mult *= _xm; bMult('perm_mult', mult - _preXm); }
  });
  // Old Growth: each scored card also adds its permanent pip bonus to mult
  if (hasTrick('old_growth')) {
    cards.forEach(card => { const _og = permPips[cardKey(card.rank, card.suit)] || 0; if (_og) { mult += _og; bMult('old_growth', _og); } });
  }
  // Magician: +3 mult per Sleight owned
  if (hasTrick('magician')) { const _a = ownedSleightCount() * BAL.magician.mult_per_sleight; if (_a) { mult += _a; bMult('magician', _a); } }
  // Landfill: +1 mult per 5 cards discarded this round
  if (hasTrick('landfill')) { const _a = Math.floor(cardsDiscardedRound / BAL.landfill.discards_per) * BAL.landfill.mult_per_n; if (_a) { mult += _a; bMult('landfill', _a); } }

  // Hearts: neutral by default; +1 mult each with Devoted Trick
  const heartCount = cards.filter(c => c.suit === '♥' || (c.combined && c.suit2 === '♥')).length;
  if (hasTrick('heart_double') && heartCount > 0) { mult += heartCount * BAL.heart_double.heart_mult; bMult('heart_double', heartCount * BAL.heart_double.heart_mult); }

  // Exalt / Corrupt — pip & mult contributions (coins & time applied in playHand)
  const _ec = exaltCorruptTotals(cards);
  totalPips += _ec.pips;
  mult += _ec.mult;
  if (mult < 1) mult = 1; // corruption can't drop mult below 1

  // Trinity Run: +9 mult for runs with 3/6/9
  if (hasTrick('threes_run') && hasTrinityRank) { mult += BAL.threes_run.mult; bMult('threes_run', BAL.threes_run.mult); }

  // Cloud Nine: accumulated mult from forgotten 9s
  if (hasTrick('nines_mult')) { mult += bonusMult_nines; bMult('nines_mult', bonusMult_nines); }

  // Perfect Ten: accumulated mult from discard milestones
  if (hasTrick('tens_mult')) { mult += bonusMult_tens; bMult('tens_mult', bonusMult_tens); }

  // ── New Trick mult bonuses ──
  // Per-rank mult
  const _aceCount   = cards.filter(c => c.rank === 'A').length;
  const _jackCount2 = cards.filter(c => c.rank === 'J').length;
  const _threeCount = cards.filter(c => c.rank === '3').length;
  if (hasTrick('jack_mult')  && _jackCount2) { const _a = _jackCount2 * BAL.jack_mult.mult_per_jack;  mult += _a; bMult('jack_mult', _a); }
  if (hasTrick('lucky_three') && _threeCount){ mult += BAL.lucky_three.mult; bMult('lucky_three', BAL.lucky_three.mult); }
  // Hand-size
  if (hasTrick('light_touch') && cells.length === 2) { mult += BAL.light_touch.mult; bMult('light_touch', BAL.light_touch.mult); }
  // Timing mult — Near Extinction's retrigger is handled in the per-card loop above.
  // The Heron: hands played 15+ round-seconds after the previous score +mult
  if (hasTrick('patience_reward') && lastHandRoundSeconds !== null && (lastHandRoundSeconds - roundSeconds) >= BAL.patience_reward.seconds) { mult += BAL.patience_reward.mult; bMult('patience_reward', BAL.patience_reward.mult); }
  // Suit conditions
  const _allRed   = cards.every(c => c.suit === '♥' || c.suit === '♦');
  const _allBlack = cards.every(c => c.suit === '♣' || c.suit === '♠');
  const _suitSet = new Set(cards.map(c => c.suit));
  if (hasTrick('full_color') && _suitSet.size === 4) { const _ap = BAL.full_color.pips_per_card * cells.length; totalPips += _ap; bPip('full_color', _ap); const _am = BAL.full_color.mult_per_card * cells.length; mult += _am; bMult('full_color', _am); }
  if (hasTrick('balanced_diet') && _suitSet.size === 2) { const _a = BAL.balanced_diet.mult_per_card * cells.length; mult += _a; bMult('balanced_diet', _a); }
  // Rank diversity
  const _rankSet = new Set(cards.map(c => c.rank));
  if (hasTrick('number_crunch') && _rankSet.size >= 4) { mult += BAL.number_crunch.mult; bMult('number_crunch', BAL.number_crunch.mult); }
  // Same-kind trick
  const _rankCounts2 = {};
  cards.forEach(c => _rankCounts2[c.rank] = (_rankCounts2[c.rank]||0)+1);
  const _maxCount = Math.max(...Object.values(_rankCounts2));
  // Sets — Quake (mult) / Shock (pips), scaling with the largest matching group
  if (_maxCount >= 2) {
    if (hasTrick('kindred')) { const _a = _maxCount * BAL.kindred.mult_per_card; mult += _a; bMult('kindred', _a); }
    if (hasTrick('trinity')) { const _a = _maxCount * BAL.trinity.pips_per_card; totalPips += _a; bPip('trinity', _a); }
  }
  // Even/odd rank
  const _rankIsEven = r => ['2','4','6','8','10'].includes(r);
  const _rankIsOdd  = r => ['A','3','5','7','9'].includes(r);
  if (hasTrick('even_score') && cards.filter(c => _rankIsEven(c.rank)).length >= 3) { const _a = cells.length * BAL.even_score.mult_per_card; mult += _a; bMult('even_score', _a); }
  if (hasTrick('odd_squad')  && cards.filter(c => _rankIsOdd(c.rank)).length >= 3)  { const _a = cells.length * BAL.odd_squad.mult_per_card; mult += _a; bMult('odd_squad', _a); }
  if (hasTrick('king_guard')) { const _kj = cards.filter(c => c.rank === 'K' || c.rank === 'J').length; if (_kj) { const _a = _kj * BAL.king_guard.mult; mult += _a; bMult('king_guard', _a); } }
  if (hasTrick('ninesong')) { const _ps = cards.reduce((s,c) => s + cardPips(c.rank), 0); if (_ps % 3 === 0) { mult += BAL.ninesong.mult; bMult('ninesong', BAL.ninesong.mult); } }
  // Position: column/row
  const _allSameCol = cells.every(([, cc]) => cc === cells[0][1]);
  const _allSameRow = cells.every(([rr]) => rr === cells[0][0]);
  if (hasTrick('column_rush') && _allSameCol) { const _a = cells.length * BAL.column_rush.mult_per_card; mult += _a; bMult('column_rush', _a); }
  if (hasTrick('row_power')   && _allSameRow) { const _a = cells.length * BAL.row_power.mult_per_card; mult += _a; bMult('row_power', _a); }
  // Level scaling
  if (hasTrick('veteran_bonus')) { const _a = (level - 1) * BAL.veteran_bonus.pips_per_level; totalPips += _a; bPip('veteran_bonus', _a); }
  // Accumulating scalers
  if (hasTrick('compound_mult') && bonusMult_compound > 0) { mult += bonusMult_compound; bMult('compound_mult', bonusMult_compound); }
  if (hasTrick('prolific') && bonusPips_prolific > 0) { totalPips += bonusPips_prolific; bPip('prolific', bonusPips_prolific); }
  if (hasTrick('feng_shui') && bonusPips_fengshui > 0) { totalPips += bonusPips_fengshui; bPip('feng_shui', bonusPips_fengshui); }
  if (hasTrick('big_win') && bonusMult_jackpot > 0) { mult += bonusMult_jackpot; bMult('big_win', bonusMult_jackpot); }
  // Hand type: pair-based pip bonuses
  // Hand type: specific pip bonuses
  if (hasTrick('triple_threat') && handName === 'Full House') { totalPips += BAL.triple_threat.pips; bPip('triple_threat', BAL.triple_threat.pips); }
  if (hasTrick('heavy_hand') && cells.length === 5) { const _a = cells.length * BAL.heavy_hand.pips_per_card; totalPips += _a; bPip('heavy_hand', _a); }
  if (hasTrick('prime_time')) { const _pc = cards.filter(c => ['A','2','3','5','7'].includes(c.rank)).length; if (_pc >= 3) { const _a = cells.length * BAL.prime_time.pips_per_card; totalPips += _a; bPip('prime_time', _a); } }
  // Escalation: +1 mult per hand beyond 5th
  if (hasTrick('escalation') && handsPlayedRound >= 5) { const _a = handsPlayedRound - 5; mult += _a; bMult('escalation', _a); }
  // Combo score: +2 mult per distinct hand type played this round
  if (hasTrick('combo_score') && handTypesRound.size > 0) { const _a = handTypesRound.size * BAL.combo_score.mult_per_type; mult += _a; bMult('combo_score', _a); }

  // Run multipliers (epic) — applied after additive pip/mult bonuses
  if (isRun && hasTrick('undertow')) {
    const _um = BAL.undertow.pip_mult_base + BAL.undertow.pip_mult_step * Math.max(0, cells.length - 3);
    const _pre = totalPips; totalPips = Math.round(totalPips * _um); bPip('undertow', totalPips - _pre);
  }
  if (isRun && hasTrick('tide_table')) {
    const _tm = 1 + BAL.tide_table.mult_step * (runsPlayedRound + 1);
    const _pre = mult; mult = Math.round(mult * _tm * 10) / 10; bMult('tide_table', mult - _pre);
  }
  // Set multipliers (epic) — applied after additive bonuses
  if (handName === 'Two Pair' && hasTrick('pair_pips')) { const _pre = totalPips; totalPips = Math.round(totalPips * BAL.pair_pips.pip_mult); bPip('pair_pips', totalPips - _pre); }
  if (_maxCount >= 2 && hasTrick('double_bloom')) { const _pre = mult; mult = Math.round(mult * BAL.double_bloom.mult_mult * 10) / 10; bMult('double_bloom', mult - _pre); }
  if (handName === 'Four of a Kind' && hasTrick('richter')) { const _pre = mult; mult = Math.round(mult * BAL.richter.mult_mult * 10) / 10; bMult('richter', mult - _pre); }
  // Rank multipliers
  if (hasTrick('royal_trio') && cards.some(c=>c.rank==='K') && cards.some(c=>c.rank==='Q') && cards.some(c=>c.rank==='J')) { const _pre = mult; mult = Math.round(mult * BAL.royal_trio.mult_mult * 10) / 10; bMult('royal_trio', mult - _pre); }
  if (hasTrick('knave_power')) { let _jg = 0; for (let _gr=0; _gr<gridRows; _gr++) for (let _gc=0; _gc<gridCols; _gc++) { const _cc = gridData[_gr]?.[_gc]; if (_cc && !_cc._isSleight && !_cc._isTrick && _cc.rank === 'J') _jg++; } if (_jg > 0) { const _pre = totalPips; totalPips = Math.round(totalPips * Math.pow(BAL.knave_power.per_jack, _jg)); bPip('knave_power', totalPips - _pre); } }
  // Cornered: corner cards multiply the running pips by the whole minutes left (per corner card)
  if (hasTrick('corner_retrigger')) {
    const _minsLeft = Math.floor(roundSeconds / 60);
    const _nc = cornerCells(cells).length;
    if (_minsLeft >= 1 && _nc > 0) { const _pre = totalPips; totalPips = Math.round(totalPips * Math.pow(_minsLeft, _nc)); bPip('corner_retrigger', totalPips - _pre); }
  }
  // Stretch: when a hand has 2+ corner cells, each corner card multiplies the running mult ×2
  if (hasTrick('two_corners')) {
    const _nc = cornerCells(cells).length;
    if (_nc >= 2) { const _pre = mult; mult = Math.round(mult * Math.pow(BAL.two_corners.mult_mult, _nc) * 10) / 10; bMult('two_corners', mult - _pre); }
  }
  // Scalper: ×(1 + 0.2 per missing Sleight charge) to total pips — figured once, now
  if (hasTrick('scalper')) { const _miss = sleightChargeInfo().missing; if (_miss > 0) { const _m = 1 + BAL.scalper.pip_mult_per_missing * _miss; const _pre = totalPips; totalPips = Math.round(totalPips * _m); bPip('scalper', totalPips - _pre); } }
  // Phoenix: while paused, the Focus multiplier applies twice — handled at the Focus step below.
  // Mirror (Blueprint): duplicate each borrowed Trick's pip/mult contribution (incl. the multipliers above)
  mirroredTrickIds().forEach(mid => {
    if (_cp[mid]) { const _d = _cp[mid]; totalPips += _d; bPip('mirror', _d); }
    if (_cm[mid]) { const _d = _cm[mid]; mult += _d; bMult('mirror', _d); }
  });
  // Primed Tricks (Inspirato / Prime Times): a primed Trick fires its effect an extra time
  // per prime stack the hand it naturally contributes. Stacks are consumed in playHand.
  if (trickTrayMode) trickTray.forEach(t => {
    if (!t._primed || t._primed <= 0) return;
    const _pd = _cp[t.id] || 0, _md = _cm[t.id] || 0;
    if (!_pd && !_md) return;
    for (let k = 0; k < t._primed; k++) { if (_pd) { totalPips += _pd; bPip('primed', _pd); } if (_md) { mult += _md; bMult('primed', _md); } }
  });
  // Double Take: each scored 2 duplicates your most recently acquired Trick's contribution
  if (hasTrick('twos_retrigger') && trickTrayMode) {
    const _t2 = cards.filter(c => c.rank === '2').length;
    if (_t2 > 0) {
      let _mr = null;
      for (let i = trickTray.length - 1; i >= 0; i--) { const _tk = trickTray[i]; if (_tk.id !== 'twos_retrigger' && _tk.id !== 'mirror') { _mr = _tk; break; } }
      if (_mr) { const _pd = _cp[_mr.id] || 0, _md = _cm[_mr.id] || 0; for (let k = 0; k < _t2; k++) { if (_pd) { totalPips += _pd; bPip('twos_retrigger', _pd); } if (_md) { mult += _md; bMult('twos_retrigger', _md); } } }
    }
  }

  // Feng Shui: did another position trick contribute pips/mult this hand? (snapshot for playHand)
  _lastHandPositionFired = POSITION_TRICK_IDS.some(id => (_cp[id] || 0) > 0 || (_cm[id] || 0) > 0);

  // 3. Base score
  const fMult = focusMultiplier();
  // Flow State: +10 pips per card scored while focus mult >= 1.5
  if (hasTrick('flow_state') && fMult >= 1.5) {
    const _a = BAL.flow_state.pips_per_card * cards.length; totalPips += _a; bPip('flow_state', _a);
  }
  // MULT stays "pure" — Focus is a SEPARATE third multiplier applied at the end (see below).
  lastPreFocusMult = mult;   // kept for dance compatibility (now == pure mult)
  lastCalcMult = mult;       // pure mult for the MULT box
  lastCalcPips = totalPips;
  // focus multiplier for the FOCUS box — Phoenix (paused) applies it twice, so show the doubled value
  lastCalcFocus = (hasTrick('phoenix') && pipeTimerPaused && fMult > 1) ? fMult * 2 : fMult;

  if (totalPips < 0) totalPips = 0; // corrupt costs can't push a hand into score debt

  let s = totalPips * mult;

  // 4. x score multipliers
  if (hasTrick('last_stand') && score < roundGoal) s *= BAL.last_stand.score_mult;
  // Echoes: same hand type as the previous hand retriggers each card (handled in the per-card loop above).
  // Blackjack: raw face values total exactly 21
  if (hasTrick('blackjack_bonus')) {
    const faceTotal = cards.reduce((sum, c) => {
      const v = c.rank === 'A' ? 11 : ['J','Q','K'].includes(c.rank) ? 10 : parseInt(c.rank);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    if (faceTotal === 21) s *= BAL.blackjack_bonus.score_mult;
  }
  if (handName === 'Straight Flush' && hasTrick('perfect_storm')) s *= BAL.perfect_storm.score_mult;
  if (handName === 'Four of a Kind' && hasTrick('extinction')) s *= BAL.extinction.score_mult;
  // The Falcon: Focus-doubling while paused is handled in playHand's focus-generation block.
  // Shape bonuses
  // Hands of Blue (2×2) and Crossroads (+ shape) now add Focus in playHand; Stretch is a ×mult above.

  if (hasTrickCard) s *= 2;

  // Low and Behold (knack): a hand containing the grid's lowest rank replays whole (×2)
  if (hasKnack('low_and_behold')) {
    let _gmin = 99;
    for (let _gr = 0; _gr < gridRows; _gr++) for (let _gc = 0; _gc < gridCols; _gc++) {
      const _gc0 = gridData[_gr]?.[_gc];
      if (_gc0 && _gc0.rank && !_gc0._isSleight && !_gc0._isStone && !_gc0._isTrick) _gmin = Math.min(_gmin, _rankHigh(_gc0.rank));
    }
    if (_gmin < 99 && cards.some(c => _rankHigh(c.rank) === _gmin)) s *= 2;
  }

  // 5. Focus multiplier — separate third element, applied at the very end of the sequence
  if (fMult > 1) s *= fMult;
  // Phoenix: while the clock is paused, the Focus multiplier applies a second time
  if (hasTrick('phoenix') && pipeTimerPaused && fMult > 1) s *= fMult;

  // Push accumulated contrib entries (pip then mult, skip zeros)
  if (contrib !== null) {
    if (_cp) Object.entries(_cp).forEach(([id, d]) => { if (d > 0) contrib.push({type:'pip',source:'trick',id,delta:d}); });
    if (_cm) Object.entries(_cm).forEach(([id, d]) => { if (d > 0) contrib.push({type:'mult',source:'trick',id,delta:Math.round(d*10)/10}); });
    if (_ec.pips > 0) contrib.push({type:'pip',source:'exalt',id:'_exalt',delta:_ec.pips});
    if (_ec.mult > 0) contrib.push({type:'mult',source:'exalt',id:'_exalt',delta:Math.round(_ec.mult*10)/10});
    // Sleight scoring contribution: Amplifier's carried-over mult (folded into base mult above).
    // NOTE: Knacks and other Sleights are rule/resource/wildcard effects — they add no pips/mult
    // during scoring, so nothing else is attributable here. Any future scoring Knack/Sleight can
    // push {type,source:'knack'|'sleight',id,delta} and the dance will render it automatically.
    if (typeof sleightAmplifierMult === 'number' && sleightAmplifierMult > 0)
      contrib.push({type:'mult',source:'sleight',id:'amplifier',delta:Math.round(sleightAmplifierMult*10)/10});
  }

  return Math.round(s);
}

// ══════════════════════════════════════════════
// PER-ROUND CONTRIBUTION TALLY (Payout > Contributions tab)
// Reuses calcScore's built-in `contrib` output (per-Trick + exalt pip/mult
// deltas) — no separate scoring math, so it can't drift from the real score.
// ══════════════════════════════════════════════
function contribDisplayName(source, id) {
  if (source === 'exalt') return 'Exalt / Corrupt';
  const def = TRICK_POOL.find(t => t.id === id);
  return def ? def.name : id;
}

function foldContribution(label, kind, amount) {
  if (!amount) return;
  const key = label + '|' + kind;
  let e = roundContributions[key];
  if (!e) e = roundContributions[key] = { label, kind, amount: 0, count: 0 };
  e.amount += amount;
  e.count++;
}

// Snapshot a hand's contribution rows from PRISTINE state (call early in playHand,
// before per-hand mutations like Ripple cooldown / Snowball permPips change the
// numbers). Returns rows to fold later; does not touch the tally yet.
function captureRoundContrib(result) {
  if (!result) return null;
  const { hand, handCells } = result;
  const rows = [];
  // Bonus-entity contributions (Tricks + exalt) straight from calcScore.
  const contrib = [];
  calcScore(hand, handCells, contrib);
  contrib.forEach(e => rows.push({ label: contribDisplayName(e.source, e.id), kind: e.type, amount: e.delta }));
  // Base + raw card pips (everything not attributed to a bonus entity).
  const base = HAND_BASE[hand];
  if (base) {
    const levelScale = Math.pow(1.1, level - 1);
    let cardPipsTotal = Math.round(base.pips * levelScale);
    handCells.forEach(([r, c]) => { const card = gridData[r]?.[c]; if (card?.rank) cardPipsTotal += cardPips(card.rank); });
    rows.push({ label: 'Base + card pips', kind: 'pip', amount: cardPipsTotal });
  }
  return rows;
}

// Fold a captured snapshot into the round tally (call once, at a commit point).
function commitRoundContrib(rows) {
  if (!rows) return;
  roundHandsScored++;
  rows.forEach(r => foldContribution(r.label, r.kind, r.amount));
}

function fmtContribution(e) {
  const r1 = n => (Math.round(n * 10) / 10);
  switch (e.kind) {
    case 'pip':  return `+${Math.round(e.amount)} pips`;
    case 'mult': return `+${r1(e.amount)} mult`;
    default:     return String(e.amount);
  }
}

// Build the per-round contribution breakdown as HTML rows, grouped by kind.
function roundContributionRowsHTML() {
  const entries = Object.values(roundContributions);
  if (!entries.length || roundHandsScored === 0) {
    return `<div class="contrib-empty">No hands scored this round.</div>`;
  }
  let html = '';
  [{ kind: 'pip', title: 'Pips' }, { kind: 'mult', title: 'Mult' }].forEach(g => {
    const rows = entries.filter(e => e.kind === g.kind).sort((a, b) => b.amount - a.amount);
    if (!rows.length) return;
    html += `<div class="contrib-group-title">${g.title}</div>`;
    rows.forEach(e => {
      const note = e.count > 1 ? `<span class="contrib-count">${e.count} hands</span>` : '';
      html += `<div class="contrib-row">
        <span class="contrib-label">${withSuitHalo(e.label)}${note}</span>
        <span class="contrib-val contrib-${e.kind}">${fmtContribution(e)}</span>
      </div>`;
    });
  });
  return html;
}

function hasTrick(id) {
  if (isTrickDisabledByBoss(id)) return false;
  if (trickTrayMode && trickTray.some(b => b.id === id)) return true;
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const cell = gridData[r][c];
      if (cell?._isTrick && cell.trick?.id === id) return true;
    }
  return false;
}
// For dedup only — checks acquiredTricks (Trick was ever granted, may not be on grid)
function ownsTrick(id) { return acquiredTricks.some(b => b.id === id); }
function hasKnack(id) { return acquiredKnacks.some(t => t.id === id); }
// Mirror Trick: borrows the effect of the tray Trick on its tilted side (-1 left / +1 right).
// Mirror Trick (Blueprint-style): ids of tray Tricks currently borrowed by a Mirror — the
// neighbour on its tilted side (-1 left / +1 right). Each borrowed trick's pip/mult
// contribution this hand is duplicated in calcScore. Multiple Mirrors stack.
function mirroredTrickIds() {
  const ids = [];
  if (!trickTrayMode) return ids;
  for (let i = 0; i < trickTray.length; i++) {
    const t = trickTray[i];
    if (t.id !== 'mirror') continue;
    const dir = (t._lockedDir != null) ? t._lockedDir : t._tiltDir;
    if (!dir) continue;
    const n = trickTray[i + dir];
    if (!n || n.id === 'mirror') continue;
    ids.push(n.id);
  }
  return ids;
}

// Returns all row/col bonus entries matching this card position
function getRowColBonusesForCell(r, c) {
  return rowColBonuses.filter(b => (b.axis === 'row' && b.index === r) || (b.axis === 'col' && b.index === c));
}

function cellHasRowColBonus(r, c, id) {
  return rowColBonuses.some(b => b.id === id && ((b.axis === 'row' && b.index === r) || (b.axis === 'col' && b.index === c)));
}

// A cell sits at the intersection of two grid effects if some trick marks its row AND some trick marks its column.
function isEffectIntersection(r, c) {
  return rowColBonuses.some(b => b.axis === 'row' && b.index === r) &&
         rowColBonuses.some(b => b.axis === 'col' && b.index === c);
}

// Once-per-minute gate (round-time minutes). Rewind (task #10) will re-arm these by re-crossing
// minute boundaries. Returns true (and marks fired) at most once per whole round-minute per id.
function firesThisMinute(id) {
  const minute = Math.floor((roundStartSeconds - roundSeconds) / 60);
  if (_perMinuteFired[id] === minute) return false;
  _perMinuteFired[id] = minute;
  return true;
}

// ══════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════
