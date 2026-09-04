// ══════════════════════════════════════════════
// DIFFICULTY TIERS (r193)
// ══════════════════════════════════════════════
// Every mode is playable at one of three tiers, picked on its carousel card
// before the run starts. Tier 1 is the game as it shipped; 2 and 3 are the
// ascension ladder above it.
//
// ── The one rule this file exists to enforce ──
// A tier NEVER changes what an entity does, what a hand is worth, or how the
// goal curve grows. It only changes THE OFFER: what the reward grid puts in
// front of you, where it puts it, and what it costs to reach. That is deliberate
// - a Trick has to mean the same thing at every tier or a build learned at tier 1
// is worthless at tier 3, and the balance sheet stops describing the game.
//
// So every knob below is read by js/reward-grid.js at generation time and by
// nothing else. If a future tier needs to touch scoring, it wants a different
// mechanism than this one.
//
// ── Unlocking ──
// Tiers are NOT gated on beating the tier below yet (owner: "so that I can
// experiment just make it so that you can choose"). `difficultyUnlockedThrough()`
// is the single place that decision lives, so gating it later is one function.

const DIFFICULTY_TIERS = [
  {
    n: 1, id: 'standard', name: 'STANDARD', accent: 'var(--c-mint)',
    blurb: 'The baseline game.',
    detail: 'Reward grids as designed: half the board pays, half of it costs.',
    // debuffShare: the fraction of grid cells that are penalty tiles. null = keep
    // the checkerboard exactly as it is (alternating by (r+c) parity).
    debuffShare: null,
    // permWeightMult: how much heavier PERMANENT penalties are weighted against
    // temporary ones in the debuff draw.
    permWeightMult: 1,
    // edgeBiasRarities: buff tiles of these rarities are pushed to an edge or
    // corner cell, so the best things on the board are the awkward ones to reach.
    edgeBiasRarities: [],
    // permNeighbors: of the (up to 4) penalty tiles orthogonally touching a tile
    // of an edgeBias rarity, how many are forced to be PERMANENT penalties.
    permNeighbors: 0,
  },
  {
    n: 2, id: 'pressure', name: 'PRESSURE', accent: 'var(--c-yellow)',
    blurb: 'The good stuff sits where it is hard to reach.',
    detail: 'Epic and better tiles are pushed to the edges and corners of the reward grid, and two of the penalties beside each one are PERMANENT. Same number of penalties as Standard - they just hurt for longer, and they stand between you and the tile you want.',
    debuffShare: null,
    permWeightMult: 2,
    edgeBiasRarities: ['epic', 'legendary', 'mythic'],
    permNeighbors: 2,
  },
  {
    n: 3, id: 'audit', name: 'AUDIT', accent: 'var(--c-coral)',
    blurb: 'Everything in PRESSURE, and the board turns against you.',
    detail: 'The reward grid stops being an even checkerboard: about three cells in five are penalties, so a five-tile path can no longer be walked clean. Permanent penalties are the norm rather than the exception.',
    debuffShare: 0.6,
    permWeightMult: 3,
    edgeBiasRarities: ['epic', 'legendary', 'mythic'],
    permNeighbors: 2,
  },
];

// The tier the NEXT run will start on. Set from the mode-select card; read by
// startGame, which copies it into the run (see runDifficulty in SAVE_VARS).
let pendingDifficulty = 1;
let runDifficulty     = 1;   // the tier the run in progress is being played at

const DIFFICULTY_STORE_KEY = 'lethe.difficulty.v1';

// Highest tier the player may pick. Deliberately every tier for now - see the
// unlocking note at the top of this file.
function difficultyUnlockedThrough() { return DIFFICULTY_TIERS.length; }

function difficultyDef(n) {
  return DIFFICULTY_TIERS.find(t => t.n === n) || DIFFICULTY_TIERS[0];
}
// The tier the RUN is being played at. Everything downstream asks this, never
// pendingDifficulty - so changing the picker mid-run could not reach the board
// even if a screen let you.
function difficultyTier() { return difficultyDef(runDifficulty); }

// The picker remembers a choice per mode: someone grinding Classic at tier 3 has
// no reason to be dropped back to 1 because they looked at Zen.
function loadDifficultyPrefs() {
  try { return JSON.parse(localStorage.getItem(DIFFICULTY_STORE_KEY) || '{}') || {}; }
  catch (e) { return {}; }
}
function difficultyForMode(modeId) {
  const v = loadDifficultyPrefs()[modeId];
  const n = parseInt(v, 10);
  return (n >= 1 && n <= difficultyUnlockedThrough()) ? n : 1;
}
function setDifficultyForMode(modeId, n) {
  n = Math.max(1, Math.min(difficultyUnlockedThrough(), n | 0));
  const prefs = loadDifficultyPrefs();
  prefs[modeId] = n;
  try { localStorage.setItem(DIFFICULTY_STORE_KEY, JSON.stringify(prefs)); } catch (e) {}
  return n;
}

// ── What the reward grid asks ────────────────────────────────────────────────
// Each of these is a question with a plain answer, so the grid reads as prose
// rather than as a chain of tier comparisons.

// Should a buff tile of this rarity be pushed to an edge/corner cell?
function diffWantsEdge(rarity) {
  return difficultyTier().edgeBiasRarities.includes(String(rarity || '').toLowerCase());
}
// How many of the penalties touching a high-rarity tile must be permanent?
function diffPermNeighborCount() { return difficultyTier().permNeighbors; }
// How much heavier permanent penalties weigh in the debuff draw.
function diffPermWeightMult() { return difficultyTier().permWeightMult; }
// Fraction of the grid that should be penalty tiles, or null to keep the
// checkerboard. Prize grids ignore this - they have no penalty half at all.
function diffDebuffShare() { return difficultyTier().debuffShare; }
// True at any tier above the baseline. Used only for wording, never for maths.
function diffIsElevated() { return runDifficulty > 1; }
