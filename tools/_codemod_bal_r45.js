// One-off codemod: extract calcScore + exalt/corrupt literals into a BAL config
// on the r45 codebase. Fail-safe: every find must match EXACTLY once or the
// script aborts without writing. Run once: node tools/_codemod_bal_r45.js
const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const BAL = `// ══════════════════════════════════════════════
// BALANCE CONFIG (BAL) — single source of truth for tunable numbers
// ══════════════════════════════════════════════
// Pulled out of calcScore / exaltCorruptTotals so a balance sweep can edit them
// in one place. Defaults EQUAL the original literals (behaviour-preserving).
// Round-trip: tools/gen_balance_sheet.js (BAL→CSV) + tools/apply_balance_sheet.js
// (CSV→BAL). Conditional thresholds/windows stay hardcoded; these are the
// headline magnitudes per bonus. Entities not listed are structural.
const BAL = {
  // ── per-card pips ──
  rich_soil:{ pips:2 }, fertile_ground:{ pips:3 }, court_of_leaves:{ pips:3 },
  low_tide:{ pips:6 }, first_light:{ pips:5 }, power_two:{ pips:4 },
  ten_strong:{ pips:7 }, king_guard:{ pips:8 }, dark_matter:{ pips:5 },
  face_value:{ face_pips:15 }, humble_roots:{ pip_mult:3 }, summit:{ pips_per_level:4 },
  before_the_tide:{ extra_mult:5 }, knave_power:{ run_mult:2 }, rowcol_triple_pips:{ pip_mult:3 },
  // ── flat pips ──
  hidden_pair:{ pips:12 }, twin_sprouts:{ pips:15 }, worn_path:{ pips:20 }, enriched:{ pips:15 },
  overgrowth:{ pips:20 }, triple_threat:{ pips:20 }, early_bird:{ pips:20 },
  kindling:{ pips_per_streak:4 }, spade_flood:{ time_mult:2 }, sands_of_time:{ divisor:2 },
  discard_pips:{ pips_per_discard:3 }, edge_pips:{ pips_per_card:15 }, veteran_bonus:{ pips_per_level:2 },
  high_pair:{ pips_per_card:5 }, pair_pips:{ pips_per_card:3 }, heavy_hand:{ pips_per_card:6 },
  quick_draw:{ pips_per_card:3 }, flow_state:{ pips_per_card:10 },
  club_double:{ club_pips:10 },
  // ── mult ──
  steady_pace:{ mult:1 }, momentum:{ mult:2 }, night_owl:{ mult:3 }, wildfire:{ mult:2 },
  deep_roots:{ mult:2 }, kindred:{ mult:1 }, tidal_force:{ mult:4 }, rare_bloom:{ mult:12 },
  two_pair_mult:{ mult:5 }, threes_run:{ mult:9 }, lucky_three:{ mult:2 }, light_touch:{ mult:5 },
  closing_time:{ mult:5 }, patience_reward:{ mult:3 }, first_play:{ mult:2 }, monochrome:{ mult:3 },
  full_color:{ mult:4 }, balanced_diet:{ mult:2 }, number_crunch:{ mult:2 }, even_score:{ mult:3 },
  odd_squad:{ mult:3 }, long_road:{ mult_per_card:2 }, shape_snake:{ mult_per_card:2 },
  still_water:{ mult_per_interval:5 }, wild_heart:{ mult_per_ace:2 }, jack_mult:{ mult_per_jack:2 },
  same_kind:{ mult_per_match:2 }, column_rush:{ mult_per_card:2 }, row_power:{ mult_per_card:2 },
  combo_score:{ mult_per_type:2 }, heart_double:{ heart_mult:1 },
  // ── ×score multipliers ──
  last_stand:{ score_mult:2 }, echo_hand:{ score_mult:1.5 }, full_house_streak:{ score_base:1.5 },
  blackjack_bonus:{ score_mult:3 }, ancient_grove:{ score_mult:2 }, trinity:{ score_mult:2 },
  double_bloom:{ score_mult:2 }, river_run:{ score_mult:2 }, torrent:{ run4_mult:2, big_mult:4 },
  deluge:{ score_mult:2 }, perfect_storm:{ score_mult:5 }, extinction:{ score_mult:2 },
  lucky_sevens:{ score_mult:2 }, ninesong:{ score_mult:3 }, frozen_moment:{ score_mult:2 },
  royal_trio:{ score_mult:2 }, prime_time:{ score_mult:2 }, shape_square:{ score_mult:4 },
  shape_cross:{ score_mult:3 }, two_corners:{ score_mult:4 }, correct_run:{ score_mult:2 },
  // ── system: exalt / corrupt per-suit ──
  _exalt:{ club_pips:10, diamond_coins:3, heart_mult:2, spade_time:4 },
  _corrupt:{ club_pips:25, club_mult:-3, diamond_coins:5, diamond_pips:-20, heart_mult:5, heart_time:-5, spade_time:7, spade_coins:-8 },
};

`;

// insert BAL just before exaltCorruptTotals
const anchor = 'function exaltCorruptTotals(cards) {';
if (html.indexOf(anchor) === -1) { console.error('anchor not found'); process.exit(1); }
html = html.replace(anchor, BAL + anchor);

const repls = [
  // exalt
  [`'♣') pips  += 10;`, `'♣') pips  += BAL._exalt.club_pips;`],
  [`'♦') coins += 3;`, `'♦') coins += BAL._exalt.diamond_coins;`],
  [`'♥') mult  += 2;`, `'♥') mult  += BAL._exalt.heart_mult;`],
  [`'♠') time  += 4;`, `'♠') time  += BAL._exalt.spade_time;`],
  // corrupt
  [`'♣') { pips  += 25; mult  -= 3;  }`, `'♣') { pips  += BAL._corrupt.club_pips; mult  += BAL._corrupt.club_mult;  }`],
  [`'♦') { coins += 5;  pips  -= 20; }`, `'♦') { coins += BAL._corrupt.diamond_coins;  pips  += BAL._corrupt.diamond_pips; }`],
  [`'♥') { mult  += 5;  time  -= 5;  }`, `'♥') { mult  += BAL._corrupt.heart_mult;  time  += BAL._corrupt.heart_time;  }`],
  [`'♠') { time  += 7;  coins -= 8;  }`, `'♠') { time  += BAL._corrupt.spade_time;  coins += BAL._corrupt.spade_coins;  }`],
  // per-card pips (inline)
  [`cp += 2; bPip('rich_soil', 2);`, `cp += BAL.rich_soil.pips; bPip('rich_soil', BAL.rich_soil.pips);`],
  [`cp += 3; bPip('fertile_ground', 3);`, `cp += BAL.fertile_ground.pips; bPip('fertile_ground', BAL.fertile_ground.pips);`],
  [`cp += 3; bPip('court_of_leaves', 3);`, `cp += BAL.court_of_leaves.pips; bPip('court_of_leaves', BAL.court_of_leaves.pips);`],
  [`cp += 6; bPip('low_tide', 6);`, `cp += BAL.low_tide.pips; bPip('low_tide', BAL.low_tide.pips);`],
  [`cp += 5; bPip('first_light', 5);`, `cp += BAL.first_light.pips; bPip('first_light', BAL.first_light.pips);`],
  [`cp += 4; bPip('power_two', 4);`, `cp += BAL.power_two.pips; bPip('power_two', BAL.power_two.pips);`],
  [`cp += 7; bPip('ten_strong', 7);`, `cp += BAL.ten_strong.pips; bPip('ten_strong', BAL.ten_strong.pips);`],
  [`cp += 8; bPip('king_guard', 8);`, `cp += BAL.king_guard.pips; bPip('king_guard', BAL.king_guard.pips);`],
  [`cp += 5; bPip('dark_matter', 5);`, `cp += BAL.dark_matter.pips; bPip('dark_matter', BAL.dark_matter.pips);`],
  // face_value
  [`hasBonus('face_value') && ['J','Q','K'].includes(baseRank) ? 15 : _origPips`, `hasBonus('face_value') && ['J','Q','K'].includes(baseRank) ? BAL.face_value.face_pips : _origPips`],
  // _a/_b expression ones
  [`const _b = rawPips; rawPips *= 3;`, `const _b = rawPips; rawPips *= BAL.humble_roots.pip_mult;`],
  [`const _b = level * 4;`, `const _b = level * BAL.summit.pips_per_level;`],
  [`const _a = cardPips(baseRank) * 5;`, `const _a = cardPips(baseRank) * BAL.before_the_tide.extra_mult;`],
  [`const _b = totalPips; totalPips *= 2;`, `const _b = totalPips; totalPips *= BAL.knave_power.run_mult;`],
  [`'rowcol_triple_pips')) cp *= 3;`, `'rowcol_triple_pips')) cp *= BAL.rowcol_triple_pips.pip_mult;`],
  // flat pips
  [`totalPips += 12; bPip('hidden_pair', 12);`, `totalPips += BAL.hidden_pair.pips; bPip('hidden_pair', BAL.hidden_pair.pips);`],
  [`totalPips += 15; bPip('twin_sprouts', 15);`, `totalPips += BAL.twin_sprouts.pips; bPip('twin_sprouts', BAL.twin_sprouts.pips);`],
  [`totalPips += 20; bPip('worn_path', 20);`, `totalPips += BAL.worn_path.pips; bPip('worn_path', BAL.worn_path.pips);`],
  [`totalPips += 15; bPip('enriched', 15);`, `totalPips += BAL.enriched.pips; bPip('enriched', BAL.enriched.pips);`],
  [`totalPips += 20; bPip('overgrowth', 20);`, `totalPips += BAL.overgrowth.pips; bPip('overgrowth', BAL.overgrowth.pips);`],
  [`totalPips += 20; bPip('triple_threat', 20);`, `totalPips += BAL.triple_threat.pips; bPip('triple_threat', BAL.triple_threat.pips);`],
  [`totalPips += 20; bPip('early_bird', 20);`, `totalPips += BAL.early_bird.pips; bPip('early_bird', BAL.early_bird.pips);`],
  [`const _a = 4 * streakCount; totalPips += _a; bPip('kindling'`, `const _a = BAL.kindling.pips_per_streak * streakCount; totalPips += _a; bPip('kindling'`],
  [`totalPips += clubCount * 10; bPip('club_double', clubCount * 10);`, `totalPips += clubCount * BAL.club_double.club_pips; bPip('club_double', clubCount * BAL.club_double.club_pips);`],
  [`const _a = roundSeconds * 2; totalPips += _a; bPip('spade_flood'`, `const _a = roundSeconds * BAL.spade_flood.time_mult; totalPips += _a; bPip('spade_flood'`],
  [`const _a = Math.floor(roundSeconds / 2); totalPips += _a; bPip('sands_of_time'`, `const _a = Math.floor(roundSeconds / BAL.sands_of_time.divisor); totalPips += _a; bPip('sands_of_time'`],
  [`const _a = cardsDiscardedRound * 3; totalPips += _a; bPip('discard_pips'`, `const _a = cardsDiscardedRound * BAL.discard_pips.pips_per_discard; totalPips += _a; bPip('discard_pips'`],
  [`const _a = cells.length * 15; totalPips += _a; bPip('edge_pips'`, `const _a = cells.length * BAL.edge_pips.pips_per_card; totalPips += _a; bPip('edge_pips'`],
  [`const _a = (level - 1) * 2; totalPips += _a; bPip('veteran_bonus'`, `const _a = (level - 1) * BAL.veteran_bonus.pips_per_level; totalPips += _a; bPip('veteran_bonus'`],
  [`_hpCount * 5; bPip('high_pair', _hpCount * 5);`, `_hpCount * BAL.high_pair.pips_per_card; bPip('high_pair', _hpCount * BAL.high_pair.pips_per_card);`],
  [`handName === 'Two Pair') { const _a = cells.length * 3;`, `handName === 'Two Pair') { const _a = cells.length * BAL.pair_pips.pips_per_card;`],
  [`const _a = cells.length * 6; totalPips += _a; bPip('heavy_hand'`, `const _a = cells.length * BAL.heavy_hand.pips_per_card; totalPips += _a; bPip('heavy_hand'`],
  [`< 3000) { const _a = cells.length * 3;`, `< 3000) { const _a = cells.length * BAL.quick_draw.pips_per_card;`],
  [`const _a = 10 * cards.length; totalPips += _a; bPip('flow_state'`, `const _a = BAL.flow_state.pips_per_card * cards.length; totalPips += _a; bPip('flow_state'`],
  // mult (inline)
  [`mult += 1; bMult('steady_pace', 1);`, `mult += BAL.steady_pace.mult; bMult('steady_pace', BAL.steady_pace.mult);`],
  [`mult += 2; bMult('momentum', 2);`, `mult += BAL.momentum.mult; bMult('momentum', BAL.momentum.mult);`],
  [`mult += 3; bMult('night_owl', 3);`, `mult += BAL.night_owl.mult; bMult('night_owl', BAL.night_owl.mult);`],
  [`mult += 2; bMult('wildfire', 2);`, `mult += BAL.wildfire.mult; bMult('wildfire', BAL.wildfire.mult);`],
  [`mult += 2; bMult('deep_roots', 2);`, `mult += BAL.deep_roots.mult; bMult('deep_roots', BAL.deep_roots.mult);`],
  [`mult += 1; bMult('kindred', 1);`, `mult += BAL.kindred.mult; bMult('kindred', BAL.kindred.mult);`],
  [`mult += 4; bMult('tidal_force', 4);`, `mult += BAL.tidal_force.mult; bMult('tidal_force', BAL.tidal_force.mult);`],
  [`mult += 12; bMult('rare_bloom', 12);`, `mult += BAL.rare_bloom.mult; bMult('rare_bloom', BAL.rare_bloom.mult);`],
  [`mult += 5; bMult('two_pair_mult', 5);`, `mult += BAL.two_pair_mult.mult; bMult('two_pair_mult', BAL.two_pair_mult.mult);`],
  [`mult += 9; bMult('threes_run', 9);`, `mult += BAL.threes_run.mult; bMult('threes_run', BAL.threes_run.mult);`],
  [`mult += 2; bMult('lucky_three', 2);`, `mult += BAL.lucky_three.mult; bMult('lucky_three', BAL.lucky_three.mult);`],
  [`mult += 5; bMult('light_touch', 5);`, `mult += BAL.light_touch.mult; bMult('light_touch', BAL.light_touch.mult);`],
  [`mult += 5; bMult('closing_time', 5);`, `mult += BAL.closing_time.mult; bMult('closing_time', BAL.closing_time.mult);`],
  [`mult += 3; bMult('patience_reward', 3);`, `mult += BAL.patience_reward.mult; bMult('patience_reward', BAL.patience_reward.mult);`],
  [`mult += 2; bMult('first_play', 2);`, `mult += BAL.first_play.mult; bMult('first_play', BAL.first_play.mult);`],
  [`mult += 3; bMult('monochrome', 3);`, `mult += BAL.monochrome.mult; bMult('monochrome', BAL.monochrome.mult);`],
  [`mult += 4; bMult('full_color', 4);`, `mult += BAL.full_color.mult; bMult('full_color', BAL.full_color.mult);`],
  [`mult += 2; bMult('balanced_diet', 2);`, `mult += BAL.balanced_diet.mult; bMult('balanced_diet', BAL.balanced_diet.mult);`],
  [`mult += 2; bMult('number_crunch', 2);`, `mult += BAL.number_crunch.mult; bMult('number_crunch', BAL.number_crunch.mult);`],
  [`mult += 3; bMult('even_score', 3);`, `mult += BAL.even_score.mult; bMult('even_score', BAL.even_score.mult);`],
  [`mult += 3; bMult('odd_squad', 3);`, `mult += BAL.odd_squad.mult; bMult('odd_squad', BAL.odd_squad.mult);`],
  // mult (_a expr)
  [`const _a = 2 * cells.length; mult += _a; bMult('long_road'`, `const _a = BAL.long_road.mult_per_card * cells.length; mult += _a; bMult('long_road'`],
  [`isSnake(cells)) { const _a = cells.length * 2;`, `isSnake(cells)) { const _a = cells.length * BAL.shape_snake.mult_per_card;`],
  [`const _a = 5 * Math.floor(elapsed / 10);`, `const _a = BAL.still_water.mult_per_interval * Math.floor(elapsed / 10);`],
  [`const _a = 5 * Math.floor(secsSinceSwap / 10);`, `const _a = BAL.still_water.mult_per_interval * Math.floor(secsSinceSwap / 10);`],
  [`const _a = _aceCount * 2;`, `const _a = _aceCount * BAL.wild_heart.mult_per_ace;`],
  [`const _a = _jackCount2 * 2;`, `const _a = _jackCount2 * BAL.jack_mult.mult_per_jack;`],
  [`const _a = _maxCount * 2;`, `const _a = _maxCount * BAL.same_kind.mult_per_match;`],
  [`_allSameCol) { const _a = cells.length * 2;`, `_allSameCol) { const _a = cells.length * BAL.column_rush.mult_per_card;`],
  [`_allSameRow) { const _a = cells.length * 2;`, `_allSameRow) { const _a = cells.length * BAL.row_power.mult_per_card;`],
  [`const _a = handTypesRound.size * 2;`, `const _a = handTypesRound.size * BAL.combo_score.mult_per_type;`],
  [`mult += heartCount * 1; bMult('heart_double', heartCount * 1);`, `mult += heartCount * BAL.heart_double.heart_mult; bMult('heart_double', heartCount * BAL.heart_double.heart_mult);`],
  // ×score multipliers
  [`hasBonus('last_stand') && score < roundGoal) s *= 2;`, `hasBonus('last_stand') && score < roundGoal) s *= BAL.last_stand.score_mult;`],
  [`hasBonus('echo_hand') && streakCount >= 2) s *= 1.5;`, `hasBonus('echo_hand') && streakCount >= 2) s *= BAL.echo_hand.score_mult;`],
  [`s *= Math.pow(1.5, fullHouseThisRound);`, `s *= Math.pow(BAL.full_house_streak.score_base, fullHouseThisRound);`],
  [`if (faceTotal === 21) s *= 3;`, `if (faceTotal === 21) s *= BAL.blackjack_bonus.score_mult;`],
  [`hasBonus('ancient_grove')) s *= 2;`, `hasBonus('ancient_grove')) s *= BAL.ancient_grove.score_mult;`],
  [`hasBonus('trinity')) s *= 2;`, `hasBonus('trinity')) s *= BAL.trinity.score_mult;`],
  [`if (hasPair) s *= 2;`, `if (hasPair) s *= BAL.double_bloom.score_mult;`],
  [`hasBonus('river_run')) s *= 2;`, `hasBonus('river_run')) s *= BAL.river_run.score_mult;`],
  [`s *= (handName === 'Run of 4') ? 2 : 4;`, `s *= (handName === 'Run of 4') ? BAL.torrent.run4_mult : BAL.torrent.big_mult;`],
  [`hasBonus('deluge')) s *= 2;`, `hasBonus('deluge')) s *= BAL.deluge.score_mult;`],
  [`hasBonus('perfect_storm')) s *= 5;`, `hasBonus('perfect_storm')) s *= BAL.perfect_storm.score_mult;`],
  [`hasBonus('extinction')) s *= 2;`, `hasBonus('extinction')) s *= BAL.extinction.score_mult;`],
  [`c.rank==='7')) s *= 2;`, `c.rank==='7')) s *= BAL.lucky_sevens.score_mult;`],
  [`totalPips % 9 === 0) s *= 3;`, `totalPips % 9 === 0) s *= BAL.ninesong.score_mult;`],
  [`hasBonus('frozen_moment')) s *= 2;`, `hasBonus('frozen_moment')) s *= BAL.frozen_moment.score_mult;`],
  [`c.rank==='J')) s *= 2;`, `c.rank==='J')) s *= BAL.royal_trio.score_mult;`],
  [`.includes(c.rank))) s *= 2;`, `.includes(c.rank))) s *= BAL.prime_time.score_mult;`],
  [`isSquare(cells)) s *= 4;`, `isSquare(cells)) s *= BAL.shape_square.score_mult;`],
  [`isCross(cells))  s *= 3;`, `isCross(cells))  s *= BAL.shape_cross.score_mult;`],
  [`cornerCells(cells).length >= 2) s *= 4;`, `cornerCells(cells).length >= 2) s *= BAL.two_corners.score_mult;`],
  [`canBeOrderedRun(cells)) s *= 2;`, `canBeOrderedRun(cells)) s *= BAL.correct_run.score_mult;`],
  // contrib club display
  [`hasBonus('club_double')?10:5`, `hasBonus('club_double')?BAL.club_double.club_pips:5`],
];

let failures = [];
for (const [find, replace] of repls) {
  const n = html.split(find).length - 1;
  if (n !== 1) { failures.push(`(${n}×) ${find}`); continue; }
  html = html.replace(find, replace);
}
if (failures.length) {
  console.error('ABORT — these finds did not match exactly once:\n' + failures.join('\n'));
  process.exit(1);
}
fs.writeFileSync(file, html);
console.log(`Applied BAL + ${repls.length} literal swaps.`);
