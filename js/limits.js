// `min` is the FLOOR a limit can be drained to (default 0). Anything that takes
// a limit away - a Limit Break sacrifice, the reward grid's limit-drain debuff -
// goes through decrementLimit, which floored at 0 and nothing else. At 0 rows,
// 0 columns or a selection of 0 the game is not hard, it is broken, and the
// random sacrifice table (r227) can put the same limit in front of you again and
// again. Where no floor is stated the limit really can go to nothing: swaps,
// discards and rerolls are all playable at 0.
// NO `reroll` LIMIT (r307): the shop's reroll is bought with DISCARDS you
// carried in, one per row, so a cap on "rerolls per visit" had nothing left to
// cap. It was already filtered out of the shop's own Upgrades row as dead
// stock; this removes it from the reward grid, Limit Break, Records and the
// Survival pick as well. An old save carrying limits.reroll is harmless - the
// contents are copied key by key and nothing reads it.
const LIMITS_DEF = [
  { id: 'selection',   label: 'Selection Size',  icon: '✋', desc: 'Cards selectable at once (play grid AND reward grid). Raising it also raises the MINIMUM you must play: min = max - 2.', base: 3, max: 9, min: 3, hideMax: true },
  { id: 'grid_rows',   label: 'Grid Rows',       icon: '⬍', desc: 'Rows in the playing grid (and reward grid)',    base: 4,   max: 7, min: 3 },
  { id: 'grid_cols',   label: 'Grid Columns',    icon: '⬌', desc: 'Columns in the playing grid (and reward grid)', base: 4,   max: 7, min: 3 },
  { id: 'swaps',       label: 'Swaps/Round',      icon: '🔄', desc: 'Swaps granted at round start',      base: 3,   max: 8 },
  { id: 'discards',    label: 'Discards/Round',   icon: '🗑', desc: 'Discards granted at round start',   base: 3,   max: 8 },
  { id: 'round_time',  label: 'Starting Time',    icon: '⏱', desc: 'Seconds you START each round with (rewinds can carry you above it)', base: 180, max: 300, min: 60, step: 15 },
  { id: 'trick_slots', label: 'Trick Slots',      icon: '✦', desc: 'Max Tricks you can keep at once',   base: 5,   max: 10, min: 1, weight: 0.4 },
  { id: 'focus_cap',   label: 'Focus Cap',        icon: '⚡', desc: 'Maximum Focus (nodes)',            base: 30,  max: 60, min: 10, step: 3, weight: 0.5 },
  // Luck 10 is a nudge, 100 doubles every chance effect. Step 5 so a single pick
  // is felt without one upgrade being the whole stat, and weight 0.6 because it
  // touches every entity offer in the game - it should be a chase, not a staple.
  { id: 'luck',        label: 'Luck',             icon: '🍀', desc: 'Good chance effects fire more often, and better entities turn up', base: 0, max: 100, step: 10, weight: 0.6 },
];
// ══════════════════════════════════════════════
// MINIMUM SELECTION (r200) - raising your hand size raises the FLOOR too
// ══════════════════════════════════════════════
// Selection Size is a maximum, and a maximum alone is pure upside: you take the
// upgrade and keep playing pairs. Tying a minimum to it makes the upgrade a real
// decision - you must commit that many cards to every hand, so you cannot lean
// on a two-card Pair to tick the board over or use one as a free discard.
//
// min = limit - 2, floored at 1. Limit 3 -> 1 (no constraint in practice, a hand
// needs two cards anyway), 5 -> 3, 7 -> 5, 9 -> 7. At the top limit the minimum
// meets HAND_MAX_CARDS exactly, so a 9-card selection can still be one 7-card
// hand plus two penalty cards, and nothing is unplayable.
//
// It applies to the PLAY GRID ONLY. `limits.selection` also caps the reward grid
// and the shop pickers, and a minimum there would force you to take seven tiles.
const MIN_SELECTION_GAP = 2;
function minSelection() {
  const cap = (typeof limits !== 'undefined' && limits.selection) ? limits.selection.current : 3;
  return Math.max(1, cap - MIN_SELECTION_GAP);
}
// Does the minimum actually bite? Below 3 it cannot - two cards is the floor for
// a hand regardless - and High Card is gated on this, so the early game (and the
// tutorial, which runs at limit 3) is untouched.
function minSelectionBinds() { return minSelection() > 2; }

const limits = {};
// ONE builder for a limit's row, because there are TWO places that build it -
// here and the reset in startGame - and they have already drifted once: r211
// found that the startGame copy had never carried `step`, so from the first
// frame of every run a Round Time upgrade granted 1 second instead of 15 and
// nothing read LIMITS_DEF again to notice. `min` (r227) would have been the
// second field to go the same way. Add a field here and both sites get it.
function makeLimitRow(def) {
  return { current: def.base, base: def.base, max: def.max, min: def.min || 0, step: def.step || 1 };
}
LIMITS_DEF.forEach(def => { limits[def.id] = makeLimitRow(def); });

// ── SAY WHAT YOU ACTUALLY DO (r227) ─────────────────────────────
// A limit moves by its `step` and then CLAMPS, so the step is not the same thing
// as the gain: Starting Time steps by 15, and at 295/300 raising it gives 5. The
// screens that move a limit printed the step and let the clamp quietly take the
// difference - the reward grid's limit tile and its drain debuff, and the Limit
// Break's offers, sacrifice list and toasts. These helpers are the one place the
// printed number is decided, so what a screen promises is what the player gets.
// Call limitGain / limitLoss BEFORE the change - they read the live `current`.
function limitStep(id)  { const l = limits[id]; return (l && l.step) || 1; }
function limitUnit(id)  { return id === 'round_time' ? 's' : ''; }
// What raising / lowering this limit is REALLY worth right now. 0 = at the rail.
function limitGain(id)  { const l = limits[id]; if (!l) return 0; return Math.min(l.max, l.current + limitStep(id)) - l.current; }
function limitLoss(id)  { const l = limits[id]; if (!l) return 0; return l.current - Math.max(l.min || 0, l.current - limitStep(id)); }
function limitCanIncrement(id) { return limitGain(id) > 0; }
function limitCanDecrement(id) { return limitLoss(id) > 0; }
// The printed delta, e.g. '+15s' / '−5s'. dir is 1 to raise, -1 to lower.
function limitDeltaText(id, dir) {
  const n = dir < 0 ? limitLoss(id) : limitGain(id);
  return `${dir < 0 ? '−' : '+'}${n}${limitUnit(id)}`;
}
// 'Starting Time: 285s → 300s' - the before and after, already clamped.
function limitChangeText(id, dir) {
  const l = limits[id], u = limitUnit(id);
  const to = dir < 0 ? l.current - limitLoss(id) : l.current + limitGain(id);
  const def = LIMITS_DEF.find(d => d.id === id);
  return `${def ? def.label : id}: ${l.current}${u} → ${to}${u}`;
}

// ── Early-limit guidance (r278, owner spec) ─────────────────────────────────
// A run's opening should VERY LIKELY offer a Selection Size or grid-size limit
// before the first quarter is out. ONE shared flag across every offer surface,
// so the chances cannot stack: each surface REPLACES one of its own slots with
// the boosted limit while the flag is live, it never adds weight on top. The
// boost ends the moment the player TAKES one of the two - or beats the FIRST
// boss - whichever comes first. Wired into the shop's Upgrades stock
// (js/shop-grid-preview.js) and the Survival/Flow pick (js/survival.js); the
// reward grid's first-5-grids guarantee (r189) already covers it there.
// In SAVE_VARS; reset for a fresh run in startGame beside tempoInitApplied.
let earlyLimitDone = false;
const EARLY_LIMIT_IDS = ['selection', 'grid_rows', 'grid_cols'];
function earlyLimitOfferId() {
  if (earlyLimitDone || typeof limits === 'undefined') return null;
  const open = EARLY_LIMIT_IDS.filter(id => limits[id] && limits[id].current < limits[id].max);
  return open.length ? open[Math.floor(Math.random() * open.length)] : null;
}

// Helper: increment a limit by its step, returns true if successful
function incrementLimit(id) {
  const l = limits[id];
  if (!l || l.current >= l.max) return false;
  l.current = Math.min(l.max, l.current + (l.step || 1));
  if (EARLY_LIMIT_IDS.includes(id)) earlyLimitDone = true;   // guidance satisfied
  onLimitChanged(id);
  return true;
}
// Helper: decrement a limit by its step (for sacrifice), returns true if
// successful. Floors at the limit's own `min`, not at 0 - see the LIMITS_DEF note.
function decrementLimit(id) {
  const l = limits[id];
  const floor = l ? (l.min || 0) : 0;
  if (!l || l.current <= floor) return false;
  l.current = Math.max(floor, l.current - (l.step || 1));
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
  // A smaller board can strand a Trick's marked row or column off the edge of
  // it. This is the one place a limit actually changes, so it is the one place
  // the marks need re-checking (js/scoring.js). Growing needs nothing.
  if (id === 'grid_rows' || id === 'grid_cols') {
    if (typeof clampRowColBonuses === 'function') clampRowColBonuses();
  }
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
    const cap = sleightMaxCharges(def) ?? cur;
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
// Unspent swaps + discards at the moment the round ended, captured by
// triggerLevelUp before the base reset overwrites them. The payout reads this.
let frozenUnspentActions = 0;
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
