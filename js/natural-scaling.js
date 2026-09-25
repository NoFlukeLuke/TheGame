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
  set:   ['Pair', 'Two Pair', 'Three of a Kind', 'Full House', 'Four of a Kind', 'Five of a Kind', 'Six of a Kind', 'Seven of a Kind'],
  run:   ['Run of 3', 'Run of 4', 'Straight', 'Run of 6', 'Run of 7', 'Straight Flush'],
  flush: ['Flush of 3', 'Flush of 4', 'Flush', 'Flush of 6', 'Flush of 7', 'Straight Flush'],
};
// hand name -> the families it belongs to (Straight Flush is in two).
// handLayersFor (js/hand-detect.js) reads this too: one layer per family.
const NS_HAND_FAMILIES = {};
Object.entries(NS_FAMILIES).forEach(([fam, names]) =>
  names.forEach(n => { (NS_HAND_FAMILIES[n] = NS_HAND_FAMILIES[n] || []).push(fam); }));

let nsEnabled = localStorage.getItem('nsEnabled') !== '0';        // default ON

// ══════════════════════════════════════════════
// THE RATE TABLE (r282) - every hand type earns at its OWN rate
// ══════════════════════════════════════════════
// It used to be three global sliders - pips per hand, mult per hand, every N
// hands - applied to all nineteen hand types alike. That could not express the
// thing the design actually needs, which is that **Natural Scaling rewards
// FREQUENCY and short hands are by far the most frequent**, so one flat rate
// grows the bottom of the ladder fastest and the ordering reliably inverts
// (measured in OPEN_DECISIONS 7: eight Runs of 3 out-worth a Run of 4).
//
// Each hand type now carries its own row:
//
//   { pips, mult, every, alt }
//
//   every  - the grant fires on every Nth play of THAT hand type
//   alt    - false: each grant pays the pips AND the mult
//            true:  each grant pays ONE of them, alternating, pips first
//
// THE ALTERNATION NEEDS NO STORED CURSOR. A grant only fires when
// `plays % every === 0`, so the grant NUMBER is `plays / every`, and odd/even on
// that decides the side. `nsPlays` is already in SAVE_VARS, so the alternation
// survives a save and a resume for free and there is no second counter that
// could drift out of step with it.
//
// ── How the shipped numbers were chosen ──
// For a pips-only rate the growth in a hand's own WORTH (base pips x base mult)
// is simply `pipsPerPlay / basePips` - the mult term cancels - so the rates are
// set to make **%-growth-per-play roughly inverse to how available the hand is**
// (the r178 board survey: Pair 100%, Run of 3 73%, Straight 34%, Flush 17%...).
// A hand you can play on every board grows at about 1% of its worth per play; a
// hand you reach for twice a run grows at 8-10%. That is what keeps the harder
// hand ahead of the easy one nested inside it.
//
// Measured on this table - plays of the SHORT hand before it out-worths the LONG
// one it lives inside, from a standing start:
//
//   Run of 4 -> Straight 35 · Flush of 4 -> Flush 35 · Run of 3 -> Run of 4 40
//   3oK -> Full House 63 · Flush of 3 -> Flush of 4 80 · Two Pair -> Full House 115
//   Pair -> Two Pair 130 · Pair -> 3oK 165 · Pair -> Full House never
//
// and over a simulated 18-round run (4 hands a round, hands picked by what the
// board offers) the hands actually played finish at **x1.0 to x1.6** of their
// starting worth. These are DELIBERATELY LOW - a conservative floor to tune up
// from, not a balance proposal.
const NS_RATE_DEFAULTS = {
  'Pair':            { pips: 1,  mult: 0,    every: 5, alt: false },
  'Two Pair':        { pips: 2,  mult: 0,    every: 5, alt: false },
  'Three of a Kind': { pips: 2,  mult: 0,    every: 3, alt: false },
  'Full House':      { pips: 5,  mult: 0.3,  every: 2, alt: true  },
  'Four of a Kind':  { pips: 6,  mult: 0.5,  every: 1, alt: true  },
  'Five of a Kind':  { pips: 8,  mult: 0.6,  every: 1, alt: true  },
  'Six of a Kind':   { pips: 11, mult: 0.8,  every: 1, alt: true  },
  'Seven of a Kind': { pips: 14, mult: 1,    every: 1, alt: true  },
  'Run of 3':        { pips: 2,  mult: 0,    every: 5, alt: false },
  'Run of 4':        { pips: 3,  mult: 0,    every: 5, alt: false },
  'Straight':        { pips: 4,  mult: 0.3,  every: 2, alt: true  },
  'Run of 6':        { pips: 5,  mult: 0.4,  every: 1, alt: true  },
  'Run of 7':        { pips: 7,  mult: 0.5,  every: 1, alt: true  },
  'Flush of 3':      { pips: 1,  mult: 0,    every: 5, alt: false },
  'Flush of 4':      { pips: 2,  mult: 0,    every: 5, alt: false },
  'Flush':           { pips: 3,  mult: 0.3,  every: 2, alt: true  },
  'Flush of 6':      { pips: 3,  mult: 0.3,  every: 1, alt: true  },
  'Flush of 7':      { pips: 3,  mult: 0.4,  every: 1, alt: true  },
  'Straight Flush':  { pips: 9,  mult: 0.7,  every: 1, alt: true  },
};
// A hand type with no row of its own (a new one added to HAND_BASE, or a mode's
// invention) scales at the quietest rate in the table rather than at nothing -
// silently not scaling is the harder failure to notice.
const NS_RATE_FALLBACK = { pips: 1, mult: 0, every: 5, alt: false };

// OVERRIDES ONLY, exactly as the goal tuner does it (r197): an untouched row
// tracks whatever this file ships, and setting a field back to its shipped value
// DELETES the override rather than pinning today's number into storage forever.
const NS_RATES_KEY = 'lethe.nsRates.v1';
let nsRates = {};
(function loadNsRates() {
  try {
    const o = JSON.parse(localStorage.getItem(NS_RATES_KEY) || '{}');
    if (o && typeof o === 'object') nsRates = o;
  } catch (e) { nsRates = {}; }
})();
function saveNsRates() { try { localStorage.setItem(NS_RATES_KEY, JSON.stringify(nsRates)); } catch (e) {} }

// The live rate for a hand type: the shipped row with any override laid on top.
function nsRate(name) {
  return Object.assign({}, NS_RATE_DEFAULTS[name] || NS_RATE_FALLBACK, nsRates[name] || {});
}
function nsRateDefault(name) { return NS_RATE_DEFAULTS[name] || NS_RATE_FALLBACK; }

// Per-run state, both keyed by hand NAME ('Run of 3'), not by family. nsPlays
// counts hands scored per type (which is what the rate table's `every` throttles
// against, and what the alternation is derived from); nsBonus holds the
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
  // The Drought (boss): everything this run has earned counts for nothing until
  // the round is over. The accumulator is untouched - it simply stops paying.
  if (typeof bossNoScaling !== 'undefined' && bossNoScaling && bossActive
      && !(typeof bossEffectsIgnored === 'function' && bossEffectsIgnored())) return { pips: 0, mult: 0 };
  const own = nsBonus[handName];
  if (typeof hasKnack !== 'function' || !hasKnack('old_tricks')) return own ? { pips: own.pips, mult: own.mult } : { pips: 0, mult: 0 };
  let pips = own ? own.pips : 0, mult = own ? own.mult : 0;
  (NS_HAND_FAMILIES[handName] || []).forEach(f => NS_FAMILIES[f].forEach(n => {
    const b = nsBonus[n];
    if (b) { pips = Math.max(pips, b.pips); mult = Math.max(mult, b.mult); }
  }));
  return { pips, mult };
}

// Called from playHand once a hand is committed. Credits EVERY COMPONENT the hand
// paid for (js/hand-detect.js), so a same-suit run advances both the run and the
// flush - it earned both, because it was scored as both. A hand holding two Sets
// of 3 credits Three of a Kind twice, for the same reason.
function recordNaturalScale(handName, cells) {
  if (!nsEnabled) return;
  const names = (cells && typeof handLayersFor === 'function') ? handLayersFor(handName, cells) : [handName];
  // The components cache is keyed on the CARDS, and these accumulators are read
  // through handWorth (handBasePips / handBaseMult) by the partition that builds
  // those components - so a board whose cards have not moved would keep being
  // served the partition the OLD rates chose. This is the one function that moves
  // them mid-round, so it is the one place that has to say so (r326).
  if (typeof clearHandCompCache === 'function') clearHandCompCache();
  names.forEach(name => {
    if (!name || !HAND_BASE[name]) return;
    // High Card has no family and must never scale - it is the escape valve.
    if (!NS_HAND_FAMILIES[name]) return;
    nsPlays[name] = (nsPlays[name] || 0) + 1;
    const r = nsRate(name);
    const every = Math.max(1, r.every | 0);
    if (nsPlays[name] % every !== 0) return;
    const s = nsSlot(name);
    if (!r.alt) { s.pips += (r.pips || 0); s.mult += (r.mult || 0); return; }
    // ALTERNATING: one side per grant, pips first. The grant number is derived
    // from nsPlays rather than counted separately - see the note on the table.
    const grant = nsPlays[name] / every;
    if (grant % 2 === 1) s.pips += (r.pips || 0); else s.mult += (r.mult || 0);
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

// ── Dev-panel editing (r201) ──
// Set a hand type's EARNED bonus directly, so a balance question ("what does a
// run of 3 at +50 feel like?") can be answered by playing it rather than by
// grinding forty hands first. Writes the accumulator, not the per-hand rate -
// the rate sliders decide how fast it grows, this decides where it is now.
function setNaturalScaleBonus(handName, field, value) {
  if (!HAND_BASE[handName] || !NS_HAND_FAMILIES[handName]) return;
  const v = Math.max(0, parseFloat(value) || 0);
  const s = nsSlot(handName);
  if (field === 'pips') s.pips = v; else if (field === 'mult') s.mult = v;
}
// ── The RATE editor (r282) ──
// Writes the per-hand rate, not the accumulator: this is how fast the hand grows
// from here, `setNaturalScaleBonus` is where it is now. A value equal to the
// shipped one deletes the override, so a row the owner has put back is genuinely
// back on the table's number rather than pinned to a copy of it.
function setNaturalScaleRate(handName, field, value) {
  if (!HAND_BASE[handName] || !NS_HAND_FAMILIES[handName]) return;
  if (!['pips', 'mult', 'every', 'alt'].includes(field)) return;
  let v;
  if (field === 'alt')        v = !!value;
  else if (field === 'every') v = Math.max(1, Math.min(99, parseInt(value, 10) || 1));
  else                        v = Math.max(0, parseFloat(value) || 0);
  const row = nsRates[handName] || (nsRates[handName] = {});
  if (v === nsRateDefault(handName)[field]) delete row[field]; else row[field] = v;
  if (!Object.keys(row).length) delete nsRates[handName];
  saveNsRates();
}
// Back to the shipped table - the accumulators a run has already earned are NOT
// touched, which is the whole reason this is separate from resetNaturalScaling.
function resetNaturalScaleRates() { nsRates = {}; saveNsRates(); }

// What one play of a hand type is worth to that hand's own (pips x mult) value,
// as a percentage. This is the number the table is actually tuned on, and it is
// only meaningful next to the hand's availability - see the note on the table.
function nsGrowthPerPlay(name) {
  const b = HAND_BASE[name]; if (!b || !b.pips || !b.mult) return 0;
  const r = nsRate(name);
  const every = Math.max(1, r.every | 0);
  const span = r.alt ? every * 2 : every;     // plays it takes to pay both sides
  const pipsPer = (r.pips || 0) / span, multPer = (r.mult || 0) / span;
  return (pipsPer / b.pips + multPer / b.mult) * 100;
}

// Every hand type Natural Scaling can touch: its RATE, what it has EARNED, and
// how many times it has been played. Drawn from HAND_BASE so a new hand type
// shows up in the editor for free; High Card is absent because it has no family
// and can never scale.
function naturalScaleRows() {
  return Object.keys(HAND_BASE).filter(n => NS_HAND_FAMILIES[n]).map(n => {
    const b = nsBonus[n] || { pips: 0, mult: 0 };
    const r = nsRate(n);
    return {
      name: n, pips: b.pips, mult: b.mult, plays: nsPlays[n] || 0,
      rate: r, tuned: !!nsRates[n], growth: nsGrowthPerPlay(n),
    };
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
