// ══════════════════════════════════════════════
// SEEDED RUNS  (r145)
// ══════════════════════════════════════════════
// The game calls bare `Math.random()` in ~135 places across 24 files. Rather
// than thread a generator through all of them, a seeded run simply REPLACES the
// global `Math.random` with a deterministic stream for the duration of the run.
// Every existing call site is seeded for free; nothing else had to change.
//
// ── The one thing that does need care: cosmetics ──
// A seeded stream is only reproducible if the draws happen in the SAME ORDER
// every time. Animation code draws randomly on rAF/timer callbacks, whose timing
// depends on frame rate, tab focus and how fast the player clicks — so leaving
// those on the seeded stream would shuffle the gameplay draws behind them and
// two runs on one seed would diverge. Cosmetic randomness therefore calls
// `fxRandom()`, which is always the real, unseeded generator: particle angles,
// audio noise buffers, CRT static, tile float phases. They stay lively on a
// replay and, more importantly, they consume nothing.
//
// ── What this does NOT guarantee ──
// Reproducibility still assumes the player takes the same ACTIONS. Two runs on
// one seed diverge the moment a different card is played, because the next draw
// comes off the shared stream. This is a seed, not a replay file. It is enough
// for: sharing a run, reproducing a bug, and pinning the tutorial's first deal.

const _nativeRandom = Math.random.bind(Math);

// Always-unseeded generator for anything purely visual or audible.
function fxRandom() { return _nativeRandom(); }

let runSeed = null;   // the seed this run is playing on; null = unseeded (normal play)

// mulberry32 — small, fast, good enough distribution for a card game.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over the seed string, so seeds can be human-typeable ("LETHE-4F2A").
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str).trim().toUpperCase();
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

function randomSeedString() {
  const n = Math.floor(_nativeRandom() * 0xFFFFF).toString(36).toUpperCase();
  return 'LETHE-' + n.padStart(4, '0');
}

// Install (or remove) the seeded stream. Called from startGame.
function applyRunSeed(seed) {
  if (seed === null || seed === undefined || seed === '') {
    runSeed = null;
    Math.random = _nativeRandom;
    return null;
  }
  runSeed = String(seed).trim().toUpperCase();
  Math.random = mulberry32(hashSeed(runSeed));
  return runSeed;
}

// Set by the dev panel or by a mode (the tutorial pins one); consumed by
// startGame, which is the single point where a run's RNG is established.
let pendingRunSeed = null;
function setPendingRunSeed(seed) { pendingRunSeed = (seed === '' ? null : seed); return pendingRunSeed; }
