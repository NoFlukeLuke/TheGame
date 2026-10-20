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
// depends on frame rate, tab focus and how fast the player clicks - so leaving
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

// mulberry32 - small, fast, good enough distribution for a card game.
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
  resetSeedStreams();
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

// ── SPLIT STREAMS (r147) ─────────────────────────────────────────────────────
// One shared stream is enough to pin the OPENING deal (the deck is shuffled
// immediately after the seed is installed, before the player can do anything),
// but it cannot pin anything later in the run. Every draw comes off the same
// sequence in call order, so a single extra discard - or a Trick that happens to
// roll a number - shifts every subsequent draw. The 3rd reward grid on one seed
// would depend on exactly how the player had been playing.
//
// The fix is one generator PER DOMAIN, each keyed to its own position in the
// run rather than to a running cursor:
//
//   withSeededRng(fn, 'reward', 3)   → reward grid #3 for this seed, always,
//                                      regardless of what happened before it.
//
// Because the key contains the visit index, these are POSITIONAL, not
// sequential: consuming more or fewer numbers inside one grid cannot shift the
// next one, and gameplay draws cannot shift either. `deck` is a continuing
// stream (a shuffle has to follow from the previous state), but it is now its
// OWN stream, so a boss roll or a Trick proc no longer perturbs the shuffle.
//
// Everything not wrapped still falls through to the shared global stream, so
// nothing regresses - this narrows what can drift, it does not change unseeded
// play at all.
const _seedStreams = {};

// A continuing stream for `name`, created once per run.
function seedStream(name) {
  if (!runSeed) return _nativeRandom;
  return _seedStreams[name] || (_seedStreams[name] = mulberry32(hashSeed(runSeed + '::' + name)));
}

// Run `fn` with Math.random bound to a stream keyed by (seed, ...parts).
// With no numeric part it continues that domain's stream; with one (a visit
// index) it starts fresh at that position, which is what makes "reward grid #N"
// reproducible no matter what the player did in between.
function withSeededRng(fn, ...parts) {
  if (!runSeed) return fn();
  const key = parts.join('::');
  const positional = parts.some(p => typeof p === 'number');
  const gen = positional ? mulberry32(hashSeed(runSeed + '::' + key)) : seedStream(key);
  const prev = Math.random;
  Math.random = gen;
  try { return fn(); }
  finally { Math.random = prev; }
}

// How many reward grids / shops have been generated this run. These are what
// make a seed's Nth grid and Nth shop stable, so they reset with the run.
let rewardVisitIndex = 0;
let shopVisitIndex   = 0;
function resetSeedStreams() {
  Object.keys(_seedStreams).forEach(k => delete _seedStreams[k]);
  rewardVisitIndex = 0;
  shopVisitIndex   = 0;
}
