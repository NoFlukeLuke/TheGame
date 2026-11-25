// ══════════════════════════════════════════════
// HAND-LEVEL MULTIPLIERS (r786): the fourth family moved to TRICK_FX. Each
// multiplies the hand's pips or its mult once, after every add.
//
//   handX(x)   { pipX, multX } for this hand, or nothing (`x` as in hand-add.js,
//              plus x.maxAll: the largest same-rank group among all scored cards)
//   xOrder     the Trick's place in the chain. A multiply rounds as it lands
//              (pips to a whole number, mult to one decimal), so the ORDER can
//              move a score by a rounding step. Until the owner's call on tray
//              order (SCORING_REWORK.md) the chain keeps the order calcScore had.
//   xLate      asked after the Sleights' pip multipliers (Legacy), as before.
// ══════════════════════════════════════════════
// Twinners (r359): a hand with a set in it, primary or layered.
fxDefine('twinners',        { xOrder: 10,  handX: x => handHasFamily([x.hand, ...x.layers], 'set') ? { pipX: BAL.twinners.pip_mult } : null });
fxDefine('undertow',        { xOrder: 20,  handX: x => x.isRun ? { pipX: TB('undertow').pip_mult_base + TB('undertow').pip_mult_step * Math.max(0, x.n - 3) } : null });
// Tide Table (r625): grows with every Run already scored this round.
fxDefine('tide_table',      { xOrder: 30,  handX: x => x.isRun ? { multX: TB('tide_table').mult_base + TB('tide_table').mult_step * runsPlayedRound } : null });
fxDefine('pair_pips',       { xOrder: 40,  handX: x => x.hand === 'Two Pair' ? { pipX: BAL.pair_pips.pip_mult } : null });
fxDefine('double_bloom',    { xOrder: 50,  handX: x => x.maxAll >= 2 ? { multX: BAL.double_bloom.mult_mult } : null });
fxDefine('richter',         { xOrder: 60,  handX: x => x.hand === 'Four of a Kind' ? { multX: BAL.richter.mult_mult } : null });
fxDefine('royal_trio',      { xOrder: 70,  handX: x => rkRoyalTrioMet(x.cards) ? { multX: BAL.royal_trio.mult_mult } : null });
// Jackpot: per card of its rank on the GRID.
fxDefine('knave_power',     { xOrder: 80,  handX: () => {
  let n = 0;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) { const cd = gridData[r]?.[c]; if (cd && !cd._isSleight && !cd._isTrick && rkHas('knave_power', cd.rank)) n++; }
  return n > 0 ? { pipX: Math.pow(BAL.knave_power.per_jack, n) } : null;
} });
// Scalper: per missing Sleight charge.
fxDefine('scalper',         { xOrder: 90,  handX: () => { const m = sleightChargeInfo().missing; return m > 0 ? { multX: 1 + BAL.scalper.mult_mult_per_missing * m } : null; } });
// Minute Hand: charged by the clock's marks, read here, spent in playHand.
fxDefine('minute_hand',     { xOrder: 100, handX: () => minuteHandCharges > 0 ? { multX: BAL.minute_hand.mult_mult } : null });
// Twenty-One: the cards' face values total exactly 21.
fxDefine('blackjack_bonus', { xOrder: 110, handX: x => {
  const total = x.cards.reduce((s, c) => { const v = c.rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(c.rank) ? 10 : parseInt(c.rank); return s + (isNaN(v) ? 0 : v); }, 0);
  return total === 21 ? { pipX: BAL.blackjack_bonus.pip_mult } : null;
} });
fxDefine('perfect_storm',   { xOrder: 120, handX: x => (x.hand === 'Straight Flush' || (x.hand === 'Straight' && x.layers && x.layers.includes('Flush'))) ? { pipX: BAL.perfect_storm.pip_mult } : null });
fxDefine('extinction',      { xOrder: 130, handX: x => x.hand === 'Four of a Kind' ? { multX: BAL.extinction.mult_mult } : null });
// Deep Breath: while the clock is paused.
fxDefine('deep_breath',     { xOrder: 140, handX: () => clockPausedForHand() ? { pipX: BAL.deep_breath.pip_mult } : null });

// ── asked after the Sleights' pip multipliers ──
fxDefine('interest',        { xLate: true, xOrder: 150, handX: () => {
  if (!(coins > 0)) return null;
  const m = Math.min(TB('interest').max_pip_mult, 1 + Math.floor(coins / 10) * TB('interest').pip_mult_per_10_credits);
  return m > 1 ? { pipX: m } : null;
} });
// 401 (r722, js/money.js): grows with every sale.
fxDefine('four_oh_one',     { xLate: true, xOrder: 160, handX: () => { const f = fourOhOneFactors(); return { pipX: f.p > 1 ? f.p : null, multX: f.m > 1 ? f.m : null }; } });
// Portfolio: per card on the grid holding a +pips or +mult buff.
fxDefine('portfolio',       { xLate: true, xOrder: 170, handX: () => {
  let n = 0;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c]; if (!cd || cd._isSleight || cd._isTrick || cd._isStone) continue;
    const k = cardId(cd); if ((permPips[k] || 0) > 0 || (permMult[k] || 0) > 0) n++;
  }
  return n > 0 ? { multX: 1 + BAL.portfolio.mult_mult_per_card * n } : null;
} });
// inflation (r851): at v6 every hand's pips are multiplied by the quarter (x4 in Q4).
fxDefine('rising_tide',     { xOrder: 145, handX: () => { if (!TB('rising_tide').xpips) return null; const q = runQuarterNow(); return q > 1 ? { pipX: q } : null; } });
