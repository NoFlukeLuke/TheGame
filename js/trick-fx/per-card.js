// ══════════════════════════════════════════════
// PER-CARD FLAT ADDS (r785): the first family moved to TRICK_FX. These were
// calcScore's PER_CARD_PAYERS rows (r226): a rate times the cards that qualify,
// paid on each card's beat, once per replay.
//
//   handWhen(h)        the hand-level condition, asked once per hand
//   card(card, h, at)  { pip, mult } for this card, or nothing; `at` is [r, c]
//
// `h` (calcScore's hand facts): cardCount, real5, isRun, orderedRun, earlyThird,
// lateThird, suitCount, allSameCol, allSameRow, isFlush, rankCount, primeCount,
// focusMult, evenCount, oddCount, maxCount, topRanks.
// A dual card's ghost re-pays a row only when the row reads the card's rank or
// suit (calcScore checks by asking again with a blank identity).
// ══════════════════════════════════════════════
fxDefine('early_bird',    { handWhen: h => h.earlyThird,        card: () => ({ pip:  BAL.early_bird.pips_per_card }) });
fxDefine('night_owl',     { handWhen: h => h.lateThird,         card: () => ({ mult: BAL.night_owl.mult_per_card }) });
fxDefine('overgrowth',    { handWhen: h => h.isRun,             card: () => ({ pip:  TB('overgrowth').pips_per_card }) });
fxDefine('long_road',     { handWhen: h => h.isRun,             card: () => ({ mult: TB('long_road').mult_per_card }) });
fxDefine('edge_pips',     {                                     card: (c, h, at) => isOnEdge([at]) ? ({ pip: BAL.edge_pips.pips_per_card }) : null });   // r609
fxDefine('balanced_diet', { handWhen: h => h.suitCount === 2,   card: () => ({ mult: BAL.balanced_diet.mult_per_card }) });
fxDefine('column_rush',   { handWhen: h => h.allSameCol,        card: () => ({ mult: BAL.column_rush.mult_per_card }) });
fxDefine('row_power',     { handWhen: h => h.allSameRow,        card: () => ({ mult: BAL.row_power.mult_per_card }) });
fxDefine('stand_up',      { handWhen: h => h.allSameCol,        card: () => ({ mult: BAL.stand_up.mult_per_card }) });
fxDefine('rich_soil',     {                                     card: () => ({ mult: BAL.rich_soil.mult }) });
fxDefine('tidal_force',   { handWhen: h => h.isFlush,           card: () => ({ mult: BAL.tidal_force.mult_per_card }) });
fxDefine('number_crunch', { handWhen: h => h.rankCount >= 4,    card: () => ({ mult: BAL.number_crunch.mult_per_card }) });
fxDefine('heavy_hand',    { handWhen: h => h.real5,             card: () => ({ pip:  BAL.heavy_hand.pips_per_card }) });
fxDefine('prime_time',    {                                     card: c => ['A', '2', '3', '5', '7'].includes(c.rank) ? ({ pip: TB('prime_time').pips_per_card }) : null });
// Hyper Focus: mult per card = focus_mult x the Focus multiplier (x1.5 Focus, 2x -> +3 mult).
// Hyper Focus (r817): no longer a per-card payer; it applies Focus again (focusExtraApplies, js/scoring.js).
// Flow State (r238): an ordinary additive per-card pip, so the x pips Tricks multiply it.
fxDefine('flow_state',    { handWhen: h => h.focusMult >= 1.5,  card: () => ({ pip:  BAL.flow_state.pips_per_card }) });
// These count only the cards that qualify, with no minimum (r226, owner's call).
fxDefine('even_score',    {                                     card: c => _rankIsEvenRank(c.rank) ? ({ pip:  TB('even_score').pips_per_card }) : null });
fxDefine('odd_squad',     {                                     card: c => _rankIsOddRank(c.rank)  ? ({ mult: TB('odd_squad').mult_per_card })  : null });
fxDefine('gold_standard', {                                     card: c => c.suit === '♦' ? (n => n > 0 ? ({ pip: n }) : null)(goldStandardPips()) : null });   // r722 (js/money.js)
fxDefine('men_of_means',  {                                     card: c => rkHas('men_of_means', c.rank) ? ({ pip: BAL.men_of_means.pips, mult: BAL.men_of_means.mult }) : null });   // r651 fused
// Quake / Shock pay per card in the LARGEST matching rank group.
fxDefine('kindred',       { handWhen: h => h.maxCount >= 2,     card: (c, h) => h.topRanks.has(c.rank) ? ({ mult: BAL.kindred.mult_per_card }) : null });
