const LIMITS_DEF = [
  { id: 'selection',   label: 'Selection Size',  icon: '✋', desc: 'Max cards selectable at once (play grid AND reward grid)', base: 3, max: 9, hideMax: true },
  { id: 'grid_rows',   label: 'Grid Rows',       icon: '⬍', desc: 'Rows in the playing grid (and reward grid)',    base: 4,   max: 7 },
  { id: 'grid_cols',   label: 'Grid Columns',    icon: '⬌', desc: 'Columns in the playing grid (and reward grid)', base: 4,   max: 7 },
  { id: 'swaps',       label: 'Swaps/Round',      icon: '🔄', desc: 'Swaps granted at round start',      base: 3,   max: 8 },
  { id: 'discards',    label: 'Discards/Round',   icon: '🗑', desc: 'Discards granted at round start',   base: 3,   max: 8 },
  { id: 'round_time',  label: 'Starting Time',    icon: '⏱', desc: 'Seconds you START each round with (rewinds can carry you above it)', base: 180, max: 300, step: 15 },
  { id: 'trick_slots', label: 'Trick Slots',      icon: '✦', desc: 'Max Tricks you can keep at once',   base: 5,   max: 10, weight: 0.4 },
  { id: 'reroll',      label: 'Shop Rerolls',     icon: '🎲', desc: 'Rerolls available per shop visit',  base: 3,   max: 6 },
  { id: 'focus_cap',   label: 'Focus Cap',        icon: '⚡', desc: 'Maximum Focus (nodes)',            base: 30,  max: 60, step: 3, weight: 0.5 },
  // Luck 10 is a nudge, 100 doubles every chance effect. Step 5 so a single pick
  // is felt without one upgrade being the whole stat, and weight 0.6 because it
  // touches every entity offer in the game - it should be a chase, not a staple.
  { id: 'luck',        label: 'Luck',             icon: '🍀', desc: 'Good chance effects fire more often, and better entities turn up', base: 0, max: 100, step: 10, weight: 0.6 },
];
const limits = {};
LIMITS_DEF.forEach(def => {
  limits[def.id] = { current: def.base, base: def.base, max: def.max, step: def.step || 1 };
});

// Helper: increment a limit by its step, returns true if successful
function incrementLimit(id) {
  const l = limits[id];
  if (!l || l.current >= l.max) return false;
  l.current = Math.min(l.max, l.current + (l.step || 1));
  onLimitChanged(id);
  return true;
}
// Helper: decrement a limit by its step (for sacrifice), returns true if successful
function decrementLimit(id) {
  const l = limits[id];
  if (!l || l.current <= 0) return false;
  l.current = Math.max(0, l.current - (l.step || 1));
  onLimitChanged(id);
  return true;
}
// ── Displaying a limit (r197) ────────────────────────────────────────────────
// Every limit but Luck is exactly its `current`. Luck also carries luckModifiers
// - the Fortune / Jinx reward tiles, which move Luck WITHOUT moving the limit so
// that they can stack past the ceiling and, in Jinx's case, take you below zero
// (decrementLimit floors at 0, so a limit could never do that).
//
// Both readouts - the in-play Limits pop-up and the RECORDS tab - used to print
// `limits[id].current` directly, which would have made those tiles invisible on
// the one screen that exists to tell you what your limits are.
function limitShownValue(id) {
  const cur = limits[id].current;
  return (id === 'luck' && typeof luckModifiers === 'number') ? cur + luckModifiers : cur;
}
function limitShownDelta(id) {
  return (id === 'luck' && typeof luckModifiers === 'number') ? luckModifiers : 0;
}
// Returns the display string for a limit's progress, respecting hideMax
function limitProgressStr(id, showNext) {
  const def = LIMITS_DEF.find(d => d.id === id);
  const l = limits[id];
  const next = Math.min(l.max, l.current + (l.step || 1));
  if (def && def.hideMax) {
    return showNext ? `${l.current} → ${next}` : `${l.current}`;
  }
  return showNext ? `${l.current} → ${next} / ${l.max}` : `${l.current} / ${l.max}`;
}
// Called after any limit change - applies immediate side effects
function onLimitChanged(id) {
  if (id === 'round_time') {
    // No clamp. This limit is the round's STARTING time, not a live ceiling, so
    // changing it must never reach in and cut the clock you are currently playing
    // - which is what the old Math.min did every time the limit moved.
    updateClockUI();
  }
  if (id === 'swaps' || id === 'discards') {
    render();
  }
  if (id === 'focus_cap') {
    // New baseline max Focus. In Flow the baseline is the mode's short bar plus the
    // upgrades bought so far, so a Focus Cap pick raises 20 → 21 rather than snapping
    // the bar out to Classic's 30.
    focusCapBase = (typeof flowFocusCapBase === 'function') ? flowFocusCapBase() : limits.focus_cap.current;
    if (typeof buildFocusMeter === 'function') { buildFocusMeter(); syncFocusMeterState(); }
  }
  // grid_rows / grid_cols take effect at next round start (see grid sizing work)
}
// Weighted sample WITHOUT replacement from limit defs (respects def.weight, default 1).
// Used by the shop, the Limit Break event, and reward-grid limit tiles so rare
// limits (e.g. trick_slots at 0.4) show up proportionally less often.
function pickWeightedLimits(n, pool) {
  const src = [...(pool || LIMITS_DEF.filter(d => limits[d.id].current < limits[d.id].max))];
  const out = [];
  while (src.length && out.length < n) {
    const total = src.reduce((s, d) => s + (d.weight ?? 1), 0);
    let rng = Math.random() * total, idx = src.length - 1;
    for (let i = 0; i < src.length; i++) { rng -= (src[i].weight ?? 1); if (rng <= 0) { idx = i; break; } }
    out.push(src.splice(idx, 1)[0]);
  }
  return out;
}
// ── Tempo knack: sets the swap/discard limits to 2, ONCE, when it's acquired ──
// Like every other limit-changing entity, Tempo imposes its value on top of whatever the
// limits were, then gets out of the way - it does NOT lock them. Later increases (shop
// upgrades, Swap Shop / Harvest, events, other knacks) stack on top of the 2 exactly as
// they would on the base, so wild combos stay open. The per-round drip (round-timers.js)
// refills up to the *current* limit, so raising the limit also raises where the drip tops
// out. The one-shot flag (tempoInitApplied) makes sure repeated updateKnackList() calls
// from later acquisitions don't re-slam the limit back to 2. Reset on new game.
function applyTempoLimitOnce() {
  if (typeof hasKnack !== 'function' || !hasKnack('tempo') || tempoInitApplied) return;
  tempoInitApplied = true;
  const n = BAL.tempo.limit;
  limits.swaps.current    = n;
  limits.discards.current = n;
  if (typeof swaps    === 'number') swaps    = Math.min(swaps, n);
  if (typeof discards === 'number') discards = Math.min(discards, n);
}

// Short Suit (knack): unlocks Flush of 3 and Flush of 4 in the modes that don't
// start with them. startGame only seeds flush3/flush4 when ACTIVE_MODE.suitCount
// >= 6 (Six Suits, Spectrum), because on a 4-suit deck short flushes are common
// enough to trivialise the board - so this is a real trade in Classic and a dead
// pick everywhere they are already active (hence the has() guard, not a mode check).
// Called from updateKnackList() for the same reason Tempo is: it is the one place
// every grant path funnels through, so a future grant path gets this free.
function applyShortSuitOnce() {
  if (typeof hasKnack !== 'function' || !hasKnack('short_suit')) return;
  if (typeof activeHands === 'undefined' || !activeHands) return;
  ['flush3', 'flush4'].forEach(k => { activeHands.add(k); if (typeof unlockedHands !== 'undefined' && unlockedHands) unlockedHands.add(k); });
}

// Trick tray capacity (the trick_slots limit). Enforced in injectTrickAfterReward.
function trickCapacity() {
  return (limits.trick_slots?.current ?? 5) + ((typeof hasKnack === 'function' && hasKnack('curator')) ? 1 : 0);
}

// Raise a random non-maxed limit by its step (Growth Spurt). Uses the shop's weighted
// picker so rare limits (trick_slots, focus_cap) show up proportionally less often.
function grantRandomLimit(label) {
  const pool = LIMITS_DEF.filter(d => limits[d.id].current < limits[d.id].max);
  if (pool.length === 0) { showMessage(`${label || 'Limit up'} - all limits maxed!`, 'var(--cream-dim)'); return; }
  const pick = pickWeightedLimits(1, pool)[0];
  if (!pick) return;
  const step = pick.step || 1;
  incrementLimit(pick.id);
  showMessage(`${label || 'Limit up'} - ${pick.label} +${step}`, 'var(--gold)');
}

// Rank value with Ace HIGH (=14). Shared by knacks that care about the grid's
// highest/lowest rank (High and Mighty, Low and Behold, Down and Back In).
function rankHighVal(rk) { return rk === 'A' ? 14 : (RANK_ORDER[rk] || 0); }

// ── Sleight-charge economy (Magician / Stand-Up / Scalper / Coin Toss / Martyr) ──
// Every Sleight the player owns, wherever it currently sits (deck, played pile, grid),
// deduped by _id so a card is counted once.
function ownedSleightCards() {
  const out = [], seen = new Set();
  const push = c => { if (c && c._isSleight && !seen.has(c._id)) { seen.add(c._id); out.push(c); } };
  (drawPile || []).forEach(push);
  (playedPile || []).forEach(push);
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) push(gridData[r]?.[c]);
  return out;
}
function ownedSleightCount() { return ownedSleightCards().length; }
// total = charges remaining (infinite counts as 1, owner decision); missing = capacity − current
// (infinite is always "full" → 0 missing).
function sleightChargeInfo() {
  let total = 0, missing = 0;
  ownedSleightCards().forEach(card => {
    if (card._usesLeft === 'infinite') { total += 1; return; }
    const def = SLEIGHT_POOL.find(j => j.id === card.sleightId);
    const cur = Math.max(0, card._usesLeft || 0);
    const cap = (def && typeof def.durability === 'number') ? def.durability : cur;
    total += cur;
    missing += Math.max(0, cap - cur);
  });
  return { total, missing };
}
// ── END LIMITS SYSTEM ──
let accumulatedSwaps = 0;    // banked unused swaps (Reserves: Swaps)
let accumulatedDiscards = 0; // banked unused discards (Reserves: Discards)
let accumulatedSeconds = 0;  // banked unused round seconds (Reserves: Time)
let swapMode = false;
let swapFirst = null;

let roundSeconds = ROUND_DURATION;
let roundStartSeconds = ROUND_DURATION; // roundSeconds value when this round's timer started (♠ "first 30s" exalt window)
let gameSeconds = GAME_DURATION;
let roundInterval = null;
let gameInterval = null;
let gameTimerPaused = false; // true during interlude and shop - game timer doesn't tick down
let trickCardTimer = 0;
let trickCardPos = null; // [row,col]
let trickStar = null;

let pipeTimerPaused = false;
let pauseSecondsLeft = 0;
let pauseTimer = null;

let activeHands = new Set(['run3','threeofakind','twopair','fourofakind']);
let unlockedHands = new Set(['run3','threeofakind','twopair','fourofakind']);
let handsPendingUnlock = []; // queue of hands to show unlock screen for

// ── PER-GAME COUNTERS ──
const C = {
  run3: 0, run4: 0, pair: 0, twopair: 0,
  threeofakind: 0, fourofakind: 0, straight: 0, flush3: 0, flush4: 0, flush: 0,
  fullhouse: 0, straightflush: 0, blackjack: 0,
  flow3: 0, flow4: 0,
  // card value counters
  twos: 0, fours: 0, aces: 0, faces: 0, hearts: 0,
  // suit-as-hand counters (same-suit hands before flush unlocked)
  sameSuitHands: 0,
  // misc
  goalInLastSecond: false,
  handsThisRound: 0,
};
let acquiredTricks = [];
let acquiredKnacks = [];
let trickTrayMode = true;   // default: Tricks live in the side tray, NOT on the grid (dev toggle re-enables grid placement)
// Per-card-type tracking for exalt/corrupt triggers (key: cardKey(rank,suit))
let cardPlayCount  = {};   // times scored this run
let cardSwapCount  = {};   // times swapped this run
let cardDealtCount = {};   // times dealt onto grid this run   // dev toggle: Tricks live in the panel tray instead of grid cells
let trickTray = [];          // trick objects currently in the tray

// Knacks - persistent UI bonuses (third entity alongside Tricks and Sleights).
// Acquired via shop (TBD); for now grantable via dev mode.
