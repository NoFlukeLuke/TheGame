// ══════════════════════════════════════════════════════════════════════════
// MODE UNLOCKS + FIRST RUNS (r276)
//
// Two facts about a mode, both persisted across runs:
//
//   STARTED  - has this mode ever been played? Its FIRST run is its tutorial.
//   FINISHED - has a run in it ended, won OR lost? That is what unlocks the next.
//
// **FINISHING is the gate, not winning** (owner's call). A mode you lost is a
// mode you have seen, and gating on a win would wall a new player out of the
// rest of the game behind the one mode they cannot beat yet.
//
// Persisted like js/discovery.js - a collection log, not run state - so a
// tutorial cannot replay and an unlock cannot be lost by abandoning a run.
// ══════════════════════════════════════════════════════════════════════════

// The chain, in carousel order. The first is unlocked from a cold install;
// every one after it opens when the one before it has had a run finish.
const MODE_UNLOCK_CHAIN = ['map', 'flow', 'guided', 'sixsuits'];

// Everything else opens AT ONCE when the chain is done, and is drawn as a
// single stacked card until then - one locked object to work toward rather
// than four identical padlocks.
const MODE_FINALE_GROUP = ['normal', 'spectrum', 'picker'];

// Appended AFTER the finale group and NOT gated. `modeUnlocked` already answers
// true for anything in neither list, so a mode here is playable from a cold
// install - which is what "add it to the end and unlock it" asks for.
const MODE_EXTRA_LIST = ['squares'];

// The id the carousel uses for the stack itself. Not a mode; never reaches MODES.
const MODE_STACK_ID = '__stack__';

let modesStarted = new Set();
let modesFinished = new Set();
// Set for ONE render when a finish opens the finale group, so the carousel can
// fan the stack out. Transient by design: a reload shows them already fanned.
let modeFanPending = false;

function _loadModeSet(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch (e) { return new Set(); }
}
function _saveModeSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch (e) {}
}
modesStarted  = _loadModeSet('lethe.modesStarted.v1');
modesFinished = _loadModeSet('lethe.modesDone.v1');

// WALKTHROUGH STEPS ALREADY SHOWN, in ANY mode (r310). A mode's first run only
// teaches what this set does not hold, so the second mode you play skips the
// board, the hand, swapping and discarding and covers only what is new to it.
let tutStepsSeen = _loadModeSet('lethe.tutSeen.v1');
function markTutStepSeen(id) {
  if (!id || tutStepsSeen.has(id)) return;
  tutStepsSeen.add(id);
  _saveModeSet('lethe.tutSeen.v1', tutStepsSeen);
}

// The carousel calls the custom-run door 'picker'; a run built through it has
// ACTIVE_MODE.id === 'custom'. One id, or the card could never unlock itself.
function modeProgressId(id) { return id === 'custom' ? 'picker' : id; }

function modeStarted(id)  { return modesStarted.has(modeProgressId(id)); }
function modeFinished(id) { return modesFinished.has(modeProgressId(id)); }

// A mode's first run is its tutorial. Read at startGame, BEFORE markModeStarted.
function modeNeedsTutorial(id) { return !!id && !modesStarted.has(modeProgressId(id)); }

function markModeStarted(id) {
  id = modeProgressId(id);
  if (!id || modesStarted.has(id)) return;
  modesStarted.add(id);
  _saveModeSet('lethe.modesStarted.v1', modesStarted);
}

// Called when a run ENDS, either way. Returns true if this opened something new.
function markModeFinished(id) {
  id = modeProgressId(id);
  if (!id || modesFinished.has(id)) return false;
  const before = modeSelectList();
  modesFinished.add(id);
  _saveModeSet('lethe.modesDone.v1', modesFinished);
  const after = modeSelectList();
  // The finale arriving is the only change worth animating - the chain's cards
  // are already on the board, they just stop being greyed.
  if (before.includes(MODE_STACK_ID) && !after.includes(MODE_STACK_ID)) modeFanPending = true;
  return after.length !== before.length || modeFanPending;
}

// r310, owner's call: every mode is open from a cold install again. The chain
// and the finale group now only set the CAROUSEL ORDER; nothing is locked.
const MODE_LOCKS_ON = false;

function finaleUnlocked() {
  if (!MODE_LOCKS_ON) return true;
  return modesFinished.has(MODE_UNLOCK_CHAIN[MODE_UNLOCK_CHAIN.length - 1]);
}

function modeUnlocked(id) {
  if (!id) return false;
  if (!MODE_LOCKS_ON) return true;
  const i = MODE_UNLOCK_CHAIN.indexOf(id);
  if (i === 0) return true;                       // the opening mode, always
  if (i > 0) return modesFinished.has(MODE_UNLOCK_CHAIN[i - 1]);
  if (MODE_FINALE_GROUP.includes(id)) return finaleUnlocked();
  return true;                                    // anything not in either list
}

// Which mode has to finish before `id` opens, for the locked card's line.
function modeUnlockedBy(id) {
  const i = MODE_UNLOCK_CHAIN.indexOf(id);
  if (i > 0) return MODE_UNLOCK_CHAIN[i - 1];
  if (MODE_FINALE_GROUP.includes(id)) return MODE_UNLOCK_CHAIN[MODE_UNLOCK_CHAIN.length - 1];
  return null;
}

// What the carousel draws, in order: the chain, then either the four modes or
// the one stack standing in for them.
function modeSelectList() {
  return finaleUnlocked()
    ? [...MODE_UNLOCK_CHAIN, ...MODE_FINALE_GROUP, ...MODE_EXTRA_LIST]
    : [...MODE_UNLOCK_CHAIN, MODE_STACK_ID, ...MODE_EXTRA_LIST];
}

// ── Dev ─────────────────────────────────────────────────────────────────────
// Both are needed to TEST this: without a reset a tutorial can only ever be
// seen once per browser.
function devUnlockAllModes() {
  [...MODE_UNLOCK_CHAIN, ...MODE_FINALE_GROUP, ...MODE_EXTRA_LIST].forEach(id => {
    modesStarted.add(id); modesFinished.add(id);
  });
  _saveModeSet('lethe.modesStarted.v1', modesStarted);
  _saveModeSet('lethe.modesDone.v1', modesFinished);
  modeFanPending = false;
  if (typeof renderModeSelect === 'function') renderModeSelect();
}

// Settings -> Help. Clears only the FIRST-RUN marks, never the UNLOCKS: a player
// asking to see the walkthroughs again is not asking to have their modes locked
// again. devResetModeProgress below clears both, which is what testing wants.
function resetWalkthroughs() {
  modesStarted = new Set();
  tutStepsSeen = new Set(); _saveModeSet('lethe.tutSeen.v1', tutStepsSeen);
  _saveModeSet('lethe.modesStarted.v1', modesStarted);
  if (typeof showMessage === 'function') showMessage('Each mode will walk you through it again.', 'var(--c-mint)');
}

function devResetModeProgress() {
  modesStarted = new Set(); modesFinished = new Set(); modeFanPending = false;
  tutStepsSeen = new Set(); _saveModeSet('lethe.tutSeen.v1', tutStepsSeen);
  _saveModeSet('lethe.modesStarted.v1', modesStarted);
  _saveModeSet('lethe.modesDone.v1', modesFinished);
  if (typeof renderModeSelect === 'function') renderModeSelect();
}
