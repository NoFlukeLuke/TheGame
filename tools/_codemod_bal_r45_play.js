// One-off codemod #2: wire the play/round-side numbers into BAL on r45.
// Accumulators, permanent gains, joker effects, totems, base time costs.
// Fail-safe: every find must match EXACTLY once or it aborts without writing.
const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

// new BAL entries inserted before the _exalt system row
const newEntries = `  // ── play/round-side: accumulators & permanent gains ──
  snowball: { pips: 2, score_threshold: 500 },
  first_fruits: { pips: 2 },
  heartwood: { pips: 5, mult: 1 },
  fours_perm: { pips: 4 },
  fives_discard: { pips_per_five: 5 },
  nines_mult: { mult_per_nine: 9 },
  tens_mult: { mult_per_milestone: 1, discards_per_milestone: 10 },
  sixes_perm: { roll_min: 1, roll_max: 6, interval: 6 },
  compound_mult: { mult_per_hand: 0.1 },
  prolific: { pips_per_hand: 1 },
  big_win: { mult: 5, score_threshold: 10000 },
  // ── jokers ──
  pivot: { mult: 5 },
  idol: { interest_mult: 3 },
  the_legacy: { extra_mult: 2 },
  the_naturalist: { pips: 2 },
  lightning_rod: { pips: 5 },
  the_catalyst: { mult: 1 },
  the_bomb: { pips: 3 },
  bellhop: { swaps: 2, discards: 1 },
  cash_out: { coins: 10 },
  the_wanderer: { swaps: 1 },
  amplifier: { mult: 5 },
  time_keeper: { seconds: 20 },
  piggy_bank: { coins: 5 },
  // ── totems ──
  time_bank: { seconds: 30 },
  inheritance: { coins: 5 },
  lucky_seven: { interval_hands: 7, swaps: 1 },
  steady_hand: { swap_seconds: 20 },
  hoarder: { discard_seconds_per_card: 6 },
  extra_swaps: { swaps: 2 },
  extra_discards: { discards: 2 },
  carry_swaps: { max: 8 },
  carry_discards: { max: 8 },
  carry_time: { max_seconds: 60 },
  // ── system: base resource time costs ──
  _resources: { swap_seconds: 10, discard_seconds_per_card: 3 },
`;
const exaltLine = `  _exalt: { club_pips: 10, diamond_coins: 3, heart_mult: 2, spade_time: 4 },`;
if (html.indexOf(exaltLine) === -1) { console.error('BAL _exalt anchor not found'); process.exit(1); }
html = html.replace(exaltLine, newEntries + exaltLine);

const repls = [
  // ── accumulators / perm gains ──
  [`const card = gridData[r]?.[c]; if (!card || !card.rank) return;\n      const k = cardKey(card.rank, card.suit);\n      permPips[k] = (permPips[k]||0) + 2;`,
   `const card = gridData[r]?.[c]; if (!card || !card.rank) return;\n      const k = cardKey(card.rank, card.suit);\n      permPips[k] = (permPips[k]||0) + BAL.snowball.pips;`],
  [`const k = cardKey(gridData[r][c].rank, gridData[r][c].suit);\n        permPips[k] = (permPips[k]||0) + 2;`,
   `const k = cardKey(gridData[r][c].rank, gridData[r][c].suit);\n        permPips[k] = (permPips[k]||0) + BAL.first_fruits.pips;`],
  [`permPips[k] = (permPips[k]||0) + 5;\n    permMult[k] = (permMult[k]||0) + 1;`,
   `permPips[k] = (permPips[k]||0) + BAL.heartwood.pips;\n    permMult[k] = (permMult[k]||0) + BAL.heartwood.mult;`],
  [`bonusMult_fives += fivesPlayed * 5;`, `bonusMult_fives += fivesPlayed * BAL.fives_discard.pips_per_five;`],
  [`bonusMult_fives += fivesCount * 5;`, `bonusMult_fives += fivesCount * BAL.fives_discard.pips_per_five;`],
  [`bonusMult_nines += 9;`, `bonusMult_nines += BAL.nines_mult.mult_per_nine;`],
  [`bonusMult_tens += (newTens - prevTens);`, `bonusMult_tens += (newTens - prevTens) * BAL.tens_mult.mult_per_milestone;`],
  [`const prevTens = Math.floor((cardsDiscardedTotal - count) / 10);`, `const prevTens = Math.floor((cardsDiscardedTotal - count) / BAL.tens_mult.discards_per_milestone);`],
  [`const newTens  = Math.floor(cardsDiscardedTotal / 10);`, `const newTens  = Math.floor(cardsDiscardedTotal / BAL.tens_mult.discards_per_milestone);`],
  [`const k = cardKey(gridData[fourthCell[0]][fourthCell[1]].rank, gridData[fourthCell[0]][fourthCell[1]].suit);\n    permPips[k] = (permPips[k] || 0) + 4;`,
   `const k = cardKey(gridData[fourthCell[0]][fourthCell[1]].rank, gridData[fourthCell[0]][fourthCell[1]].suit);\n    permPips[k] = (permPips[k] || 0) + BAL.fours_perm.pips;`],
  [`if (cardsScoredTotal % 6 === 0) {\n        const roll = Math.floor(Math.random() * 6) + 1;`,
   `if (cardsScoredTotal % BAL.sixes_perm.interval === 0) {\n        const roll = Math.floor(Math.random() * (BAL.sixes_perm.roll_max - BAL.sixes_perm.roll_min + 1)) + BAL.sixes_perm.roll_min;`],
  [`bonusMult_compound = Math.round((bonusMult_compound + 0.1) * 10) / 10;`, `bonusMult_compound = Math.round((bonusMult_compound + BAL.compound_mult.mult_per_hand) * 10) / 10;`],
  [`if (hasBonus('prolific')) bonusPips_prolific++;`, `if (hasBonus('prolific')) bonusPips_prolific += BAL.prolific.pips_per_hand;`],
  [`&& finalScore >= 10000) { jackpotFired = true; bonusMult_jackpot += 5;`, `&& finalScore >= BAL.big_win.score_threshold) { jackpotFired = true; bonusMult_jackpot += BAL.big_win.mult;`],
  [`if (hasBonus('snowball') && lastCalcPips >= 500) {`, `if (hasBonus('snowball') && lastCalcPips >= BAL.snowball.score_threshold) {`],
  // ── jokers ──
  [`if (card && !card._isJoker && card.rank) {\n        const k = cardKey(card.rank, card.suit);\n        permMult[k] = (permMult[k] || 0) + 5;`,
   `if (card && !card._isJoker && card.rank) {\n        const k = cardKey(card.rank, card.suit);\n        permMult[k] = (permMult[k] || 0) + BAL.pivot.mult;`],
  [`interestMult = 3;`, `interestMult = BAL.idol.interest_mult;`],
  [`score += finalScore * 2; jokerLegacyMult = false;`, `score += finalScore * BAL.the_legacy.extra_mult; jokerLegacyMult = false;`],
  [`const k = cardKey(hc2.rank, hc2.suit);\n          permPips[k] = (permPips[k] || 0) + 2;`,
   `const k = cardKey(hc2.rank, hc2.suit);\n          permPips[k] = (permPips[k] || 0) + BAL.the_naturalist.pips;`],
  [`const k = cardKey(other.rank, other.suit);\n        permPips[k] = (permPips[k] || 0) + 5;`,
   `const k = cardKey(other.rank, other.suit);\n        permPips[k] = (permPips[k] || 0) + BAL.lightning_rod.pips;`],
  [`const k = cardKey(other.rank, other.suit);\n        permMult[k] = (permMult[k] || 0) + 1;`,
   `const k = cardKey(other.rank, other.suit);\n        permMult[k] = (permMult[k] || 0) + BAL.the_catalyst.mult;`],
  [`permPips[_k] = (_k in permPips ? permPips[_k] : 0) + 3;`, `permPips[_k] = (_k in permPips ? permPips[_k] : 0) + BAL.the_bomb.pips;`],
  [`swaps += 2; discards = Math.min(99, discards + 1); render();`, `swaps += BAL.bellhop.swaps; discards = Math.min(99, discards + BAL.bellhop.discards); render();`],
  [`coins += 10; updateCoinsUI();`, `coins += BAL.cash_out.coins; updateCoinsUI();`],
  [`swaps = Math.min(99, swaps + 1); render();\n      showMessage('🧭 Wanderer`, `swaps = Math.min(99, swaps + BAL.the_wanderer.swaps); render();\n      showMessage('🧭 Wanderer`],
  [`jokerAmplifierMult += 5;`, `jokerAmplifierMult += BAL.amplifier.mult;`],
  [`roundSeconds = Math.min(roundSeconds + 20, ROUND_DURATION); updateClockUI();\n      showMessage('⏱️ Time Keeper`, `roundSeconds = Math.min(roundSeconds + BAL.time_keeper.seconds, ROUND_DURATION); updateClockUI();\n      showMessage('⏱️ Time Keeper`],
  [`coins += 5; updateCoinsUI();\n      showMessage('🐷 Piggy Bank`, `coins += BAL.piggy_bank.coins; updateCoinsUI();\n      showMessage('🐷 Piggy Bank`],
  // ── totems & base time costs ──
  [`hasTotem('lucky_seven') && handsPlayed % 7 === 0) {\n    swaps = Math.min(99, swaps + 1);`, `hasTotem('lucky_seven') && handsPlayed % BAL.lucky_seven.interval_hands === 0) {\n    swaps = Math.min(99, swaps + BAL.lucky_seven.swaps);`],
  [`let swapTimeCost = 10;`, `let swapTimeCost = BAL._resources.swap_seconds;`],
  [`else if (hasTotem('steady_hand')) swapTimeCost = 20;`, `else if (hasTotem('steady_hand')) swapTimeCost = BAL.steady_hand.swap_seconds;`],
  [`let perCardCost = 3;`, `let perCardCost = BAL._resources.discard_seconds_per_card;`],
  [`if (hasTotem('hoarder')) perCardCost = 6;`, `if (hasTotem('hoarder')) perCardCost = BAL.hoarder.discard_seconds_per_card;`],
  [`sec = Math.min(secCap, sec + 30)`, `sec = Math.min(secCap, sec + BAL.time_bank.seconds)`],
  [`(hasTotem('extra_discards') ? 2 : 0)`, `(hasTotem('extra_discards') ? BAL.extra_discards.discards : 0)`],
  [`(hasTotem('extra_swaps') ? 2 : 0)`, `(hasTotem('extra_swaps') ? BAL.extra_swaps.swaps : 0)`],
  [`extra_swaps'))    s += 2;`, `extra_swaps'))    s += BAL.extra_swaps.swaps;`],
  [`extra_discards')) d += 2;`, `extra_discards')) d += BAL.extra_discards.discards;`],
  [`accumulatedSwaps    = Math.min(8, accumulatedSwaps    + swaps)`, `accumulatedSwaps    = Math.min(BAL.carry_swaps.max, accumulatedSwaps    + swaps)`],
  [`accumulatedDiscards = Math.min(8, accumulatedDiscards + discards)`, `accumulatedDiscards = Math.min(BAL.carry_discards.max, accumulatedDiscards + discards)`],
  [`accumulatedSeconds  = Math.min(60, accumulatedSeconds + roundSeconds)`, `accumulatedSeconds  = Math.min(BAL.carry_time.max_seconds, accumulatedSeconds + roundSeconds)`],
  [`if (hasTotem('inheritance')) { coins += 5; updateCoinsUI(); }`, `if (hasTotem('inheritance')) { coins += BAL.inheritance.coins; updateCoinsUI(); }`],
];

let failures = [];
for (const [find, replace] of repls) {
  const n = html.split(find).length - 1;
  if (n !== 1) { failures.push(`(${n}×) ${JSON.stringify(find.slice(0, 60))}`); continue; }
  html = html.replace(find, replace);
}
if (failures.length) { console.error('ABORT — finds not matching exactly once:\n' + failures.join('\n')); process.exit(1); }
fs.writeFileSync(file, html);
console.log(`Applied ${newEntries.split('\n').filter(l=>/^\s+\w/.test(l)).length} BAL entries + ${repls.length} literal swaps.`);
