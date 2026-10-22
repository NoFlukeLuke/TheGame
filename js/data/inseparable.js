// ══════════════════════════════════════════════════════════════════════════
// INSEPARABLE PAIRS (r646, owner) - content, no logic. js/inseparable.js reads it.
//
// Two Tricks that, once BOTH are in the tray, fuse into ONE Trick carrying both
// effects. The fused Trick is an ordinary TRICK_POOL_ALL row marked `fused: true`
// (never offered; it exists only through its pair), with its own BAL numbers,
// template and improvement ladder like any other Trick.
//   id     the fused Trick's id (its row in js/data/tricks.js)
//   parts  the two Tricks that make it, by id
//   carry  (r651) a SCALING part's earned bonus comes along: the fused Trick
//          starts with HALF the bonus, and a quarter of the count the part had
//          counted goes on under the fused rate (owner's example: +1 per discard
//          at 10 discards, fused at +3: 5 + 2.5 x 3 = 13). `count()` reads the
//          part's count, `bonus()` its bonus, `axis` is where the carried flat
//          bonus is paid, `adj` names the count the fused Trick keeps counting.
// The second half of a pair may be taken with a FULL tray: the fusion frees a
// slot (trickTrayFullFor, js/tricks-ui.js). Suggested further pairs: INSEPARABLE.md.
// ══════════════════════════════════════════════════════════════════════════
const INSEPARABLE_PAIRS = [
  { id: 'lie_up',                 parts: ['row_power', 'stand_up'] },             // Lie Down + Stand-Up
  { id: 'well_adjusted',          parts: ['early_bird', 'night_owl'] },
  { id: 'right_place_time',       parts: ['rowcol_triple_pips', 'right_time'] },
  { id: 'short_circuit',          parts: ['rowcol_mult', 'line_xpips'] },
  { id: 'advanced_interrogation', parts: ['line_xmult', 'obligatory'] },
  { id: 'love_of_money',          parts: ['obsessed', 'interest'] },
  { id: 'penny_perfect',          parts: ['fives_discard', 'tens_mult'],
    carry: [{ part: 'fives_discard', axis: 'pips', bonus: () => bonusMult_fives, count: () => 0 },
            { part: 'tens_mult',     axis: 'mult', bonus: () => bonusMult_tens,  count: () => cardsDiscardedTotal + cardsScoredTotal, adj: 'cards' }] },
  { id: 'hurricane',              parts: ['overgrowth', 'long_road'] },
  { id: 'riptide',                parts: ['tide_table', 'undertow'] },
  { id: 'encore_bang',            parts: ['rerun', 'chorus'] },
  { id: 'lidar',                  parts: ['rowcol_retrigger', 'perfect_timing'] },
  { id: 'erosion',                parts: ['swift', 'sediment'] },
  { id: 'seabird',                parts: ['albatross', 'kingfisher'] },
  { id: 'flood',                  parts: ['dam_holding', 'high_water'] },
  { id: 'relativity',             parts: ['hourglass', 'sands_of_time'] },
  { id: 'men_of_means',           parts: ['king_guard', 'face_value'] },
  { id: 'omega_prime',            parts: ['prime_time', 'prime_times'] },
  { id: 'stranger_still',         parts: ['odd_squad', 'what_odds'] },
  { id: 'can_even',               parts: ['even_score', 'even_better'] },
  { id: 'inferno',                parts: ['kindling', 'wildfire'] },
  { id: 'serenity',               parts: ['shape_square', 'shape_cross'] },
  { id: 'working_class',          parts: ['club_double', 'landfill'],
    carry: [{ part: 'landfill', axis: 'mult', bonus: () => landfillCount() * BAL.landfill.mult_per, count: () => landfillCount(), adj: 'landfill' }] },
];
