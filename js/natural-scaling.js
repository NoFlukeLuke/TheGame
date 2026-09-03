// ══════════════════════════════════════════════
// NATURAL SCALING (r181) - hands get better because you play them
// ══════════════════════════════════════════════
// The goal curve is exponential (GOAL_SCALE 1.35 per level) while base hand pips
// scale at only 1.1, so a run has to close a 1.227x-per-level gap out of its
// loadout alone. Every existing source of that is a DROP - a Trick or Sleight the
// shop happened to offer. Natural Scaling makes the baseline itself grow from
// play: score a hand and its whole FAMILY gets permanently better.
//
// Families, not single hand types, so the buff follows how people actually play:
// a run of Pairs improves Three of a Kind and Full House too. Straight Flush sits
// in BOTH the run and flush families and collects from either.
//
// This is a per-run accumulator layered ON TOP of HAND_BASE, never a mutation of
// it. HAND_BASE is global and modes overwrite it (applyModeHandValues zeroes
// Spectrum's Flush of 3), so writing into it would leak across runs and fight the
// mode overrides. calcScore reads the bonus and adds it; the Hands tab in RECORDS
// reads the same function to show the live rate card.
const NS_FAMILIES = {
  set:   ['Pair', 'Two Pair', 'Three of a Kind', 'Full House', 'Four of a Kind'],
  run:   ['Run of 3', 'Run of 4', 'Straight', 'Straight Flush'],
  flush: ['Flush of 3', 'Flush of 4', 'Flush', 'Straight Flush'],
};
// hand name -> the families it belongs to (Straight Flush is in two)
const NS_HAND_FAMILIES = {};
Object.entries(NS_FAMILIES).forEach(([fam, names]) =>
  names.forEach(n => { (NS_HAND_FAMILIES[n] = NS_HAND_FAMILIES[n] || []).push(fam); }));

// Tunable from the dev panel (Score group). Persisted, so a tuning session
// survives a reload.
let nsEnabled     = localStorage.getItem('nsEnabled') !== '0';        // default ON
let nsPipsPerHand = parseFloat(localStorage.getItem('nsPipsPerHand'));
let nsMultPerHand = parseFloat(localStorage.getItem('nsMultPerHand'));
let nsEveryHands  = parseInt(localStorage.getItem('nsEveryHands'), 10);
if (!isFinite(nsPipsPerHand)) nsPipsPerHand = 2;   // +pips to the family per qualifying hand
if (!isFinite(nsMultPerHand)) nsMultPerHand = 0;   // +mult to the family (off by default)
if (!isFinite(nsEveryHands) || nsEveryHands < 1) nsEveryHands = 1;  // buff every Nth hand of that family

// Per-run state. nsPlays counts hands scored per family (so nsEveryHands can
// throttle); nsBonus holds the granted totals. Both reset on a new game and both
// are in SAVE_VARS.
let nsPlays = { set: 0, run: 0, flush: 0 };
let nsBonus = { set: { pips: 0, mult: 0 }, run: { pips: 0, mult: 0 }, flush: { pips: 0, mult: 0 } };

function resetNaturalScaling() {
  nsPlays = { set: 0, run: 0, flush: 0 };
  nsBonus = { set: { pips: 0, mult: 0 }, run: { pips: 0, mult: 0 }, flush: { pips: 0, mult: 0 } };
}

// The bonus a hand name currently carries. A hand in two families takes the BEST
// of them rather than the sum - otherwise Straight Flush, already the top of the
// table, would scale twice as fast as everything else.
function naturalScaleBonus(handName) {
  if (!nsEnabled) return { pips: 0, mult: 0 };
  const fams = NS_HAND_FAMILIES[handName];
  if (!fams) return { pips: 0, mult: 0 };
  let pips = 0, mult = 0;
  fams.forEach(f => { pips = Math.max(pips, nsBonus[f].pips); mult = Math.max(mult, nsBonus[f].mult); });
  return { pips, mult };
}

// Called from playHand once a hand is committed. Credits every family the hand
// belongs to, so a Straight Flush advances both run and flush.
function recordNaturalScale(handName) {
  if (!nsEnabled) return;
  const fams = NS_HAND_FAMILIES[handName];
  if (!fams) return;
  fams.forEach(f => {
    nsPlays[f]++;
    if (nsPlays[f] % nsEveryHands !== 0) return;
    nsBonus[f].pips += nsPipsPerHand;
    nsBonus[f].mult += nsMultPerHand;
  });
}

// One-line summary per family, for the dev panel and the RECORDS Hands tab.
function naturalScaleSummary() {
  return Object.keys(NS_FAMILIES).map(f =>
    `${f}: +${nsBonus[f].pips} pips / +${nsBonus[f].mult} mult (${nsPlays[f]} played)`).join('\n');
}
