// ══════════════════════════════════════════════
// NATURAL SCALING (r190, reworked r198) - hands get better because you play them
// ══════════════════════════════════════════════
// The goal curve is exponential (GOAL_SCALE 1.35 per level) while base hand pips
// scale at only 1.1, so a run has to close a 1.227x-per-level gap out of its
// loadout alone. Every existing source of that is a DROP - a Trick or Sleight the
// shop happened to offer. Natural Scaling makes the baseline itself grow from
// play: score a hand and that hand gets permanently better.
//
// r198: THE BONUS IS PER HAND TYPE, NOT PER FAMILY. It used to credit the whole
// family - play Pairs and your Four of a Kind improved too - which meant the
// baseline grew no matter which hand in the family you reached for, so reaching
// for the harder one bought you nothing you were not already getting. Per type,
// climbing the ladder is a real decision: a Three of a Kind you have played forty
// times may well out-score a Four of a Kind you have never played.
//
// The family is not gone, it is a PRIZE: the Old Tricks knack lets every hand in
// a family draw on the family's best bonus (see naturalScaleBonus).
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
// hand name -> the families it belongs to (Straight Flush is in two).
// handLayersFor (js/hand-detect.js) reads this too: one layer per family.
const NS_HAND_FAMILIES = {};
Object.entries(NS_FAMILIES).forEach(([fam, names]) =>
  names.forEach(n => { (NS_HAND_FAMILIES[n] = NS_HAND_FAMILIES[n] || []).push(fam); }));

// Tunable from the dev panel (Score group). Persisted, so a tuning session
// survives a reload.
let nsEnabled     = localStorage.getItem('nsEnabled') !== '0';        // default ON
let nsPipsPerHand = parseFloat(localStorage.getItem('nsPipsPerHand'));
let nsMultPerHand = parseFloat(localStorage.getItem('nsMultPerHand'));
let nsEveryHands  = parseInt(localStorage.getItem('nsEveryHands'), 10);
if (!isFinite(nsPipsPerHand)) nsPipsPerHand = 2;   // +pips to the hand type per qualifying hand
if (!isFinite(nsMultPerHand)) nsMultPerHand = 0;   // +mult to the hand type (off by default)
if (!isFinite(nsEveryHands) || nsEveryHands < 1) nsEveryHands = 1;  // buff every Nth hand of that type

// Per-run state, both keyed by hand NAME ('Run of 3'), not by family. nsPlays
// counts hands scored per type (so nsEveryHands can throttle); nsBonus holds the
// granted totals. Both reset on a new game and both are in SAVE_VARS.
let nsPlays = {};
let nsBonus = {};

function resetNaturalScaling() { nsPlays = {}; nsBonus = {}; }

function nsSlot(name) { return nsBonus[name] || (nsBonus[name] = { pips: 0, mult: 0 }); }

// The bonus a hand name currently carries.
// Plain: what THIS hand type has earned, and nothing else.
// With the Old Tricks knack: the best bonus anywhere in the hand's family stands
// in for it. It REPLACES the hand's own rather than adding to it - so a Three of
// a Kind on +50 and a Four of a Kind on +24 both read +50, never +74. (Straight
// Flush is in two families and takes the best of both, for the same reason it
// always has: it is already the top of the table.)
function naturalScaleBonus(handName) {
  if (!nsEnabled) return { pips: 0, mult: 0 };
  const own = nsBonus[handName];
  if (typeof hasKnack !== 'function' || !hasKnack('old_tricks')) return own ? { pips: own.pips, mult: own.mult } : { pips: 0, mult: 0 };
  let pips = own ? own.pips : 0, mult = own ? own.mult : 0;
  (NS_HAND_FAMILIES[handName] || []).forEach(f => NS_FAMILIES[f].forEach(n => {
    const b = nsBonus[n];
    if (b) { pips = Math.max(pips, b.pips); mult = Math.max(mult, b.mult); }
  }));
  return { pips, mult };
}

// Called from playHand once a hand is committed. Credits EVERY LAYER the hand
// paid for (js/hand-detect.js), so a same-suit run advances both the run and the
// flush - it earned both, because it was scored as both.
function recordNaturalScale(handName, cells) {
  if (!nsEnabled) return;
  const names = (cells && typeof handLayersFor === 'function') ? handLayersFor(handName, cells) : [handName];
  names.forEach(name => {
    if (!name || !HAND_BASE[name]) return;
    nsPlays[name] = (nsPlays[name] || 0) + 1;
    if (nsPlays[name] % nsEveryHands !== 0) return;
    const s = nsSlot(name);
    s.pips += nsPipsPerHand;
    s.mult += nsMultPerHand;
  });
}

// A save written before r198 keyed both accumulators by FAMILY. Spread each
// family's total onto every hand in it - which is exactly what that save meant by
// it - so a resumed run keeps what it earned. Called from the restore path; it
// self-detects, so calling it on a fresh or already-migrated run is a no-op.
function migrateNaturalScaleFamilies() {
  const fams = Object.keys(NS_FAMILIES);
  if (!fams.some(f => nsBonus && nsBonus[f])) return;
  const oldB = nsBonus || {}, oldP = nsPlays || {};
  nsBonus = {}; nsPlays = {};
  fams.forEach(f => {
    const b = oldB[f]; if (!b) return;
    NS_FAMILIES[f].forEach(n => {
      const s = nsSlot(n);
      s.pips = Math.max(s.pips, b.pips || 0);
      s.mult = Math.max(s.mult, b.mult || 0);
      nsPlays[n] = Math.max(nsPlays[n] || 0, oldP[f] || 0);
    });
  });
}

// One line per hand type that has been played, for the dev panel and RECORDS.
function naturalScaleSummary() {
  const rows = Object.keys(HAND_BASE)
    .filter(n => nsPlays[n] || (nsBonus[n] && (nsBonus[n].pips || nsBonus[n].mult)))
    .map(n => {
      const b = nsBonus[n] || { pips: 0, mult: 0 };
      return `${n}: +${b.pips} pips / +${b.mult} mult (${nsPlays[n] || 0} played)`;
    });
  if (!rows.length) return 'nothing played yet';
  if (typeof hasKnack === 'function' && hasKnack('old_tricks')) rows.push('Old Tricks: every hand reads its family best');
  return rows.join('\n');
}
