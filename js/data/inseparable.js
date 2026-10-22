// ══════════════════════════════════════════════════════════════════════════
// INSEPARABLE PAIRS (r646, owner) - content, no logic. js/inseparable.js reads it.
//
// Two Tricks that, once BOTH are in the tray, fuse into ONE Trick carrying both
// effects. The fused Trick is an ordinary TRICK_POOL_ALL row marked `fused: true`
// (never offered; it exists only through its pair), with its own BAL numbers,
// template and improvement ladder like any other Trick.
//   id     the fused Trick's id (its row in js/data/tricks.js)
//   parts  the two Tricks that make it, by id
// The second half of a pair may be taken with a FULL tray: the fusion frees a
// slot (trickTrayFullFor, js/tricks-ui.js). Suggested further pairs: INSEPARABLE.md.
// ══════════════════════════════════════════════════════════════════════════
const INSEPARABLE_PAIRS = [
  { id: 'lie_up', parts: ['row_power', 'stand_up'] },   // Lie Down + Stand-Up
];
