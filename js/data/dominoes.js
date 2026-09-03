// ══════════════════════════════════════════════
// DOMINOES MODE - data + pure logic (no DOM)
// ══════════════════════════════════════════════
// A separate game mode. Nothing here runs unless ACTIVE_MODE.id === 'dominoes'.
// See DOMINOES_MODE.md for the full design spec.

// Values 1–7. No blanks - every half carries a real number.
const DOMINO_VALUES = [1, 2, 3, 4, 5, 6, 7];

// Per-value pip color, continuing the owner's rainbow now that the range is 1–7:
// 1 red, 2 orange, 3 yellow, 4 green, 5 blue, 6 purple, 7 magenta.
// (White was the old blank's colour; it's dropped with the blanks - white pips on
//  the cream tile face would barely read anyway. 7 extends purple into magenta.)
const DOMINO_PIP_COLORS = {
  1: '#e2382f', 2: '#e88a2a', 3: '#ecc72c', 4: '#4cbf5a',
  5: '#3b82e6', 6: '#9b57d3', 7: '#e2439b',
};

// Optional suit plumbing: values 2–5 map to the four suits; 1/6/7 are suitless.
// Suit-based tricks do NOT apply in this mode - this only feeds shared code that
// expects a `suit` field to exist.
const DOMINO_VALUE_SUIT = { 2: '♠', 3: '♥', 4: '♦', 5: '♣' };

// Per-hand base pips / mult. PLACEHOLDERS - balance once the mode is playable.
// (Sizes beyond this table are extrapolated in dominoHandBase().)
const DOMINO_HAND_BASE = {
  'Run of 3': { pips: 20,  mult: 3 },
  'Run of 4': { pips: 28,  mult: 4 },
  'Run of 5': { pips: 40,  mult: 5 },
  'Run of 6': { pips: 60,  mult: 6 },
  'Run of 7': { pips: 90,  mult: 7 },
  'Set of 3': { pips: 30,  mult: 3 },
  'Set of 4': { pips: 60,  mult: 5 },
  'Set of 5': { pips: 100, mult: 7 },
  'Set of 6': { pips: 150, mult: 9 },
};

function dominoHandBase(type, size) {
  const key = (type === 'set' ? 'Set of ' : 'Run of ') + size;
  if (DOMINO_HAND_BASE[key]) return DOMINO_HAND_BASE[key];
  // Extrapolate for larger hands than the table lists.
  const pips = (type === 'set' ? 30 : 20) + (size - 3) * 30;
  const mult = 3 + (size - 3) * 2;
  return { pips, mult };
}

// The 49-tile deck (owner spec): every number 1–7 gets its OWN full set of
// partners 1–7 - the 1s are 1-1…1-7, the 2s are 2-1…2-7, … the 7s are 7-1…7-7.
//
// Read as unordered tiles that means the seven doubles (1-1, 2-2, … 7-7) exist
// once each, while every mixed pair shows up twice (1-2 from the 1s, 2-1 from the
// 2s). So there ARE duplicates, but it is NOT a second copy of the whole set -
// which is exactly the distinction the owner asked for.
function buildDominoDeck() {
  const d = [];
  for (let a = 1; a <= 7; a++)
    for (let b = 1; b <= 7; b++) d.push([a, b]);
  return shuffle(d); // shuffle() lives in deck-grid.js (shared)
}

// Flatten selected tiles into the pool of individual half-values.
function dominoHalves(pairs) {
  const h = [];
  pairs.forEach(([a, b]) => { h.push(a); h.push(b); });
  return h;
}

// Find every scoring hand present in the half-value pool.
//  • Sets  = a value appearing 3+ times (maximal - one Set per value).
//  • Runs  = a maximal consecutive stretch of 3+ distinct present values.
// A value may belong to both a run and a set at once (double-counting is intended).
// Returns [{ type:'set'|'run', name, size, value?, values:[…] }] sorted sets-then-runs.
function dominoDetectComponents(pairs) {
  const halves = dominoHalves(pairs);
  if (halves.length === 0) return [];
  const counts = {};
  halves.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const comps = [];

  // Sets: any value with 3+ copies.
  Object.keys(counts).map(Number).sort((a, b) => a - b).forEach(v => {
    if (counts[v] >= 3) comps.push({ type: 'set', value: v, size: counts[v], values: Array(counts[v]).fill(v), name: 'Set of ' + counts[v] });
  });

  // Runs: maximal consecutive stretches of present distinct values, length 3+.
  const present = Object.keys(counts).map(Number).sort((a, b) => a - b);
  let i = 0;
  while (i < present.length) {
    let j = i;
    while (j + 1 < present.length && present[j + 1] === present[j] + 1) j++;
    const len = j - i + 1;
    if (len >= 3) {
      const values = present.slice(i, j + 1);
      comps.push({ type: 'run', size: len, values, name: 'Run of ' + len });
    }
    i = j + 1;
  }
  return comps;
}
