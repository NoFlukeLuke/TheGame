// ══════════════════════════════════════════════
// HAND-LEVEL ADDS (r786): the third family moved to TRICK_FX. Each adds pips or
// mult once for the whole hand, after the cards and before any hand-level
// multiply.
//
//   handAdd(x)   { pip, mult } for this hand, or nothing
//   late: true   asked after calcScore's "mult is at least 1" floor (the Tricks
//                that sat below it); the rest are asked above it
//   x: { hand, cells, cards, nat, n, streak, isRun, layers, h }
//      hand    the primary hand's name        cells  the scored cells
//      cards   every scored card              nat    the cards a rank or suit count may see (no wilds)
//      n       the hand's size                streak this hand's place in a same-hand streak (1 = none)
//      layers  the other components' names    h      the per-card families' hand facts
// A Trick whose total is counted up in the card loop (Assembly Line, Five Stack,
// Coin and the Sword, Straight Shot) stays in calcScore until the card loop moves.
// ══════════════════════════════════════════════
// Lie Up (r646, INSEPARABLE: Lie Down + Stand-Up): one row or one column; v6 no more than 2 of either.
// r651 fused Tricks with a rule of their own (the rest stand in for their parts through `acts`).
fxDefine('well_adjusted',  { handAdd: () => ({ pip: BAL.well_adjusted.pips, mult: BAL.well_adjusted.mult }) });
fxDefine('serenity',       { handAdd: x => !handIsLine(x.cells) ? { mult: BAL.serenity.mult } : null });
fxDefine('penny_perfect',  { handAdd: () => { const p = pennyPerfectBonus(); return { pip: p.pips, mult: p.mult }; } });
fxDefine('rising_tide',    { handAdd: () => (risingTideMult > 0 || risingTidePips > 0) ? { pip: risingTidePips || 0, mult: risingTideMult } : null });
fxDefine('middle_man',     { handAdd: () => middleManMult > 0 ? { mult: middleManMult } : null });
// r722 (js/money.js): credits moved this level and last; credits spent, for the run.
fxDefine('expense_account', { handAdd: () => ({ mult: expenseAccountMult() }) });
fxDefine('fire_sale',      { handAdd: () => fireSaleMult > 0 ? { mult: Math.round(fireSaleMult * 100) / 100 } : null });
// Kindling: a same-hand streak scores +mult x the streak count.
fxDefine('kindling',       { handAdd: x => x.streak > 1 ? { mult: TB('kindling').mult_per_streak * x.streak } : null });
// Hummingbird: +mult per clock pause or rewind this game.
fxDefine('hummingbird',    { handAdd: () => ({ mult: (pauseInstanceGame + rewindInstanceGame) * BAL.hummingbird.mult_per_pause }) });
// The Kingfisher: +mult per interval of seconds paused or rewound this round.
fxDefine('kingfisher',     { handAdd: () => ({ mult: Math.floor((pausedSecondsRound + rewoundSecondsRound) / TB('kingfisher').interval_seconds) * TB('kingfisher').mult_per_interval }) });
// The Swift: +mult for every interval of round time gone.
fxDefine('swift',          { handAdd: () => ({ mult: Math.floor(clockElapsed() / TB('swift').interval_seconds) * TB('swift').mult_per_interval }) });
// Eagle Eye: +mult per interval since the last swap (the round's start if none).
fxDefine('still_water',    { handAdd: () => {
  const gone = lastSwapRoundSeconds !== null ? Math.max(0, lastSwapRoundSeconds - roundSeconds) : clockElapsed();
  return { mult: BAL.still_water.mult_per_interval * Math.floor(gone / BAL.still_water.interval_seconds) };
} });
// Ready, Set, Go: a 3-card hand holding one of its ranks.
fxDefine('ready_set_go',   { handAdd: x => (counts3CardHand(x.hand, x.cells) && x.nat.some(cd => cd && rkHas('ready_set_go', cd.rank))) ? { mult: BAL.ready_set_go.mult } : null });
fxDefine('four_eyes',      { handAdd: x => x.n === 4 ? { mult: BAL.four_eyes.mult } : null });
// Four Horse-man: a 4-card hand pays one of four (two at v6); Focus and the pause are paid in playHand.
fxDefine('four_horseman',  { handAdd: x => {
  if (x.n !== 4) return null;
  const p = fourHorsemanPicks(x.cells);
  return { pip: p.includes(0) ? BAL.four_horseman.pips : 0, mult: p.includes(1) ? BAL.four_horseman.mult : 0 };
} });
// Hands of Blue: the 2x2 pays mult as well as Focus (the Focus is paid in generateHandFocus).
fxDefine('shape_square',   { handAdd: x => isSquare(x.cells) ? { mult: BAL.shape_square.mult } : null });
// Wave Amplification: runs in a row score +pips x their place in the streak.
fxDefine('wave_amp',       { handAdd: x => x.isRun ? { pip: BAL.wave_amp.pips_per_streak * (runStreak + 1) } : null });
// Rogue Wave: one of pips / mult / Focus (the Focus outcome is paid in generateHandFocus).
fxDefine('correct_run',    { handAdd: x => {
  if (!x.isRun || !canBeOrderedRun(x.cells)) return null;
  const k = trickPickOne(0, x.cells);
  return k === 0 ? { pip: BAL.correct_run.pips } : k === 1 ? { mult: BAL.correct_run.mult } : null;
} });
// Inclusive: a hand spanning the grid's full width or height.
fxDefine('wide_span_mult', { handAdd: x => { const s = spanStats(x.cells); return (s.colSpan === gridCols || s.rowSpan === gridRows) ? { mult: BAL.wide_span_mult.mult } : null; } });
// Magician (r623, r635): flat pips with no Sleight owned, else mult per Sleight.
fxDefine('magician',       { handAdd: () => magicianNoSleights() ? { pip: BAL.magician.solo_pips } : { mult: ownedSleightCount() * BAL.magician.mult_per_sleight } });
// Landfill (r651): +mult per swapped or discarded card this game, plus what a fusion carried.
fxDefine('landfill',       { handAdd: () => ({ mult: landfillCount() * TB('landfill').mult_per + fusedCarry('landfill', 'mult') }) });
// Compost: +mult per card discarded this round.
fxDefine('discard_pips',   { handAdd: () => ({ mult: cardsDiscardedRound * ((typeof flowActive === 'function' && flowActive()) ? BAL.discard_pips.mult_per_flow : BAL.discard_pips.mult_per) }) });

// ── asked below the floor ──
// Trinity Run: a run holding a 3, 6 or 9.
fxDefine('threes_run',     { late: true, handAdd: x => (x.isRun && x.nat.some(c => ['3', '6', '9'].includes(c.rank))) ? { mult: BAL.threes_run.mult } : null });
fxDefine('nines_mult',     { late: true, handAdd: () => ({ mult: bonusMult_nines }) });
fxDefine('tens_mult',      { late: true, handAdd: () => ({ mult: bonusMult_tens }) });
fxDefine('lucky_three',    { late: true, handAdd: x => x.nat.some(c => c.rank === '3') ? { mult: BAL.lucky_three.mult } : null });
fxDefine('light_touch',    { late: true, handAdd: x => realHandOfSize(x.cells, 2) ? { mult: BAL.light_touch.mult } : null });
// The Heron (r624): mult per second since the last hand.
fxDefine('patience_reward', { late: true, handAdd: () => ({ mult: heronMult() }) });
// Crossroads (r624): the + shape pays mult as well as Focus.
fxDefine('shape_cross',    { late: true, handAdd: x => (isCross(x.cells) && realHandOfSize(x.cells, 5)) ? { mult: BAL.shape_cross.mult } : null });
// Shaky Foundation: every other Set.
fxDefine('shaky_foundation', { late: true, handAdd: x => (isSetHand(x.hand) && ((setsPlayedRound + 1) % 2 === 0)) ? { mult: BAL.shaky_foundation.mult } : null });
// Threepeat: one of rewind / mult / Focus; the mult outcome lands here.
fxDefine('ninesong',       { late: true, handAdd: x => (x.cards.reduce((s, c) => s + cardPips(c.rank), 0) % 3 === 0 && ninesongPays(1, x.cells)) ? { mult: BAL.ninesong.mult } : null });
fxDefine('compound_mult',  { late: true, handAdd: () => bonusMult_compound > 0 ? { mult: bonusMult_compound } : null });
fxDefine('more_better',    { late: true, handAdd: () => bonusMult_morebetter > 0 ? { mult: bonusMult_morebetter } : null });
fxDefine('wild_side',      { late: true, handAdd: () => negativeTilesTakenRun > 0 ? { mult: negativeTilesTakenRun * BAL.wild_side.mult_per } : null });
fxDefine('feng_shui',      { late: true, handAdd: () => bonusPips_fengshui > 0 ? { pip: bonusPips_fengshui } : null });
// Wellspring: +mult per so much Focus made this game.
fxDefine('wellspring',     { late: true, handAdd: () => { const w = Math.floor(focusGenGame / BAL.wellspring.per_focus) * BAL.wellspring.mult_per; return w > 0 ? { mult: w } : null; } });
fxDefine('triple_threat',  { late: true, handAdd: x => x.hand === 'Full House' ? { pip: BAL.triple_threat.pips } : null });
// Combo Score: +mult per distinct hand type played this round.
fxDefine('combo_score',    { late: true, handAdd: () => handTypesRound.size > 0 ? { mult: handTypesRound.size * BAL.combo_score.mult_per_type } : null });
