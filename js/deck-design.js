// ══════════════════════════════════════════════
// DECK DESIGN - what is actually IN the six-suit deck (r234)
// ══════════════════════════════════════════════
// Six Suits used to be the plain cross product 6 suits x 13 ranks = 78 cards,
// which is the one shape that CANNOT give the owner what was asked for: runs a
// little harder, sets a little easier, flushes rare, deck under 60.
//
// ── THE FORMULA ──────────────────────────────────────────────────────────────
// Pick any card on the board and count the cards in the deck that could match it
// three different ways. Those three numbers ARE the difficulty of the three
// shapes, and each has its own knob:
//
//   sets    partners = copies_of_that_rank - 1        <- copies per rank
//   runs    partners = copies at rank-1 + rank+1      <- which ranks are ADJACENT
//   flushes partners = cards_in_that_suit - 1         <- deck size / suit count
//
// In a real deck copies-per-rank IS the suit count (4 suits means 4 of each
// rank), and that single coupling is why "more suits" has always meant a bigger
// deck AND easier sets. Breaking it is the whole idea here: SIX suits, but only
// `deckCopiesPerRank` (4) of each rank, so each rank appears in four of the six.
// Deck size is ranks x copies and has nothing to do with the suit count.
//
// Measured through the REAL engine (handComponentsFor over every connected
// group on 250 fresh 4x4 deals), share of boards offering each shape, against
// Classic 52, AT THE PRE-r270 DEFAULTS (cut 2, courts off the ladder, 4 copies):
//                    Classic   this deck
//   Run of 3            99%       82%
//   Run of 4            72%       36%     <- halved
//   Straight            38%       18%     <- halved
//   Three of a Kind     36%       29%
//   Full House          19%       24%
//   Flush of 3         100%       94%
//   Flush of 4          81%       31%
//   Flush               24%        3%
//
// ── TWO THINGS THE DEFAULT DOES NOT DO, BOTH FIXED BY `deckCopiesPerRank` ────
// 1. SETS ARE NOT EASIER AT 4 COPIES, they are flat. Set difficulty is
//    copies - 1, and 4 copies gives exactly 3, which is Classic's number. The
//    deck being smaller helps a little (a rank collision is 3/47 rather than
//    3/51) and Full House does rise, but Three of a Kind measured DOWN. FIVE
//    COPIES IS THE SHIPPED DEFAULT SINCE r270 for exactly this: sets/card
//    3 -> 4, and the deck lands on 60 cards.
// 2. A STRAIGHT FLUSH IS IMPOSSIBLE AT 4 COPIES. It needs one suit holding five
//    consecutive ladder ranks, and a balanced 4-of-6 assignment cannot produce
//    one: a suit is absent from 4 of the 12 ranks, and spreading those absences
//    evenly (which is what keeps flush difficulty equal across suits) leaves a
//    longest same-suit stretch of four. Checked every rotation step from 1 to 6
//    and NONE is both balanced and straight-flush-capable, so this is structural
//    rather than a bad choice of step. At 5 copies it comes back: 4 combos.
//    That matters because Straight Flush is priced in HAND_BASE and carries a
//    Natural Scaling accumulator, so at 4 copies both sit permanently dead.
//
// ── THE COURTS RUN (r270, owner's call) ──────────────────────────────────────
// `deckCourtsOffLadder` is FALSE now: J/Q/K are part of the run ladder like any
// other rank, and an Ace still plays high, so Q-K-A bridges the two ends.
//
// WHAT THAT COSTS THE CUT RANK, measured at 5 copies x 6 suits over 6000 deals
// a row. Cutting a rank barely touches a SHORT run - Run of 3 is 72-76%
// whichever rank goes, because a thirteen-rung ladder survives losing one rung.
// It only bites on LONG runs, and only when the cut lands in the MIDDLE:
//
//   cut      Run of 3   Run of 4   Straight
//   none        74%        49%        35%
//   2           76%        52%        38%    <- an end cut does almost nothing
//   5           73%        44%        25%
//   8           73%        45%        27%    <- the shipped default
//   10          73%        44%        26%
//   J           72%        43%        30%
//
// Cutting near an END leaves the ladder essentially whole (drop the 2 and
// A-high still reaches back through K), which is why the old default of 2 was
// the worst available choice once the courts started running. 5, 8 and 10 all
// split it into two pieces too short to host a five-card straight and measure
// the same to within noise; 8 is the middle one.
//
// THE REAL LEVER FOR RUNS IS ORDER, NOT COMPOSITION, and it is not implemented.
// Requiring a run to be laid out in sequence grades the difficulty BY LENGTH,
// which no rank cut can do. Measured, no cut, 4x4:
//   today (layout irrelevant)            Run3 75%   Run4 49%   Straight 34%
//   each card touches an earlier one     Run3 64%   Run4 28%   Straight 12%
//   consecutive ranks must touch         Run3 38%   Run4  8%   Straight  1%
// The middle rule is the one that matches the game's own tap rule (a tap must
// be adjacent to the GROUP so far, js/input.js). The strict one is too far:
// a straight at 1% is extinct and a straight flush becomes impossible.
const DECK_COURTS = ['J', 'Q', 'K'];

// ── Tuner state ──────────────────────────────────────────────────────────────
// Persisted so a tuning session survives a reload, exactly like the Spectrum
// tuner (js/spectrum.js) this is modelled on.
// v2 (r270): the defaults changed, and a STORED value beats a default - anyone
// who had already loaded the game would have kept the 48-card courts-off deck
// for ever. Same reason the heartbeat's config key went to hbCfg3 in r183.
const DECK_DESIGN_KEY = 'lethe.deckDesign.v2';
let deckCutRank        = '8';    // the one rank left out of the deck ('' = none)
let deckCourtsOffLadder = false; // J/Q/K run like any other rank
let deckCopiesPerRank  = 5;      // how many of each rank, spread over the 6 suits
// Set by a toggle, consumed at the next round start. The round being played
// always finishes on the deck it was dealt.
let deckDesignDirty = false;

(function loadDeckDesign() {
  try {
    const raw = localStorage.getItem(DECK_DESIGN_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (typeof o.cut === 'string' && (o.cut === '' || RANKS.includes(o.cut))) deckCutRank = o.cut;
    if (typeof o.courtsOff === 'boolean') deckCourtsOffLadder = o.courtsOff;
    if (typeof o.copies === 'number') deckCopiesPerRank = Math.max(1, Math.min(SUITS_SIX.length, o.copies | 0));
    if (DECK_MODELS.includes(o.model)) deckModel = o.model;
    if (typeof o.wSuits === 'number') deckWeightSuitCount = Math.max(2, Math.min(8, o.wSuits | 0));
    if (o.weights && typeof o.weights === 'object')
      for (const r of DECK_W_RANKS) if (typeof o.weights[r] === 'number') deckWeights[r] = Math.max(0, Math.min(20, o.weights[r] | 0));
  } catch (e) {}
})();
function saveDeckDesign() {
  try {
    localStorage.setItem(DECK_DESIGN_KEY, JSON.stringify({
      cut: deckCutRank, courtsOff: deckCourtsOffLadder, copies: deckCopiesPerRank,
      model: deckModel, wSuits: deckWeightSuitCount, weights: deckWeights,
    }));
  } catch (e) {}
}

// ── Who the six-suit knobs apply to ─────────────────────────────────────────
// deckDesignActive() is defined with the deck-model picker below. Classic is
// the reference balance the whole game is tuned against and is only overridden
// on purpose; Spectrum is never overridden at all.

// The rank list a designed run deals from - always in RANKS order.
function deckDesignRanks() {
  const a = RANKS.filter(r => r !== deckCutRank);
  return a.length ? a : [...RANKS];
}
function deckDesignCopies() { return Math.max(1, Math.min(ACTIVE_SUITS.length || SUITS_SIX.length, deckCopiesPerRank)); }
function deckDesignSize()   { return deckDesignRanks().length * deckDesignCopies(); }

// ── The run ladder ───────────────────────────────────────────────────────────
// `rankRunVals` is the ONE place a rank's run values come from. It returns an
// EMPTY list for a rank that is off the ladder, which is what makes every run
// test fail for free: each of the three run builders loops over these options,
// and a loop over nothing can never succeed. Add a new run test and read this,
// never RANK_ORDER directly, or the courts quietly start running again there.
function rankIsOffLadder(rank) {
  return deckCourtsOffLadder && deckDesignActive() && DECK_COURTS.includes(rank);
}
function rankRunVals(rank) {
  if (rankIsOffLadder(rank)) return [];
  // Ace plays low or high. With the courts off the ladder there is nothing above
  // a 10 for the high Ace to reach, so the 14 simply never matches - harmless,
  // and it stays correct the moment the toggle is turned off.
  return rank === 'A' ? [1, 14] : [RANK_ORDER[rank] ?? 0];
}
// Cheap cache-key fragment. handComponentsFor memoises on the cards, so a toggle
// flipped mid-run would otherwise be served stale answers for cells that have
// not moved - the same trap the Tagalong knack set in r201.
function deckLadderKey() { return (deckCourtsOffLadder ? 'C' : 'c') + (deckDesignActive() ? '6' : '4'); }

// ── THE RUN ORDER RULE (r272) ────────────────────────────────────────────────
// Does a run have to be LAID OUT in sequence on the board, or is it enough that
// the ranks are consecutive wherever they sit? Three settings, each strictly
// tighter than the last:
//
//   'off'   today. Ranks consecutive, layout irrelevant beyond the selection
//           being connected. 4-6-7-5-8 scattered around a blob is a Straight.
//   'grow'  every card except the lowest must TOUCH a card of lower rank. This
//           is the reading that matches the game's own tap rule: js/input.js
//           requires each tap to be adjacent to the GROUP so far, not to the
//           card before it, so "tap them in ascending order" is exactly this.
//   'path'  every card must touch the card ONE RANK BELOW it, so the run is a
//           line you could trace with a finger.
//
// Measured, no rank cut, 4x4, 6 suits x 5 copies:
//            Run of 3   Run of 4   Straight
//   off         75%        49%        34%
//   grow        64%        28%        12%
//   path        38%         8%         1%
//
// It grades difficulty BY LENGTH, which no rank cut can do - a cut moves Run of
// 3 by 2 points whatever it removes. 'path' is deliberately available and
// deliberately not recommended: a straight at 1% is extinct and a straight
// flush becomes impossible.
//
// UNLIKE the deck knobs above this is GLOBAL, not Six Suits only. It is a rule
// about hands, not about what is in the deck, and 'off' reproduces today's
// behaviour exactly in every mode.
let runOrderRule = 'off';
const RUN_ORDER_RULES = ['off', 'grow', 'path'];

// cells: [[r,c],...]  vals: the run value chosen for each cell, same order.
// Called from _handShape once a value combination is known to be consecutive.
function runOrderOK(cells, vals) {
  if (runOrderRule === 'off') return true;
  if (!cells || cells.length < 3) return true;   // two cards are never a run hand
  const seq = cells.map((rc, i) => ({ r: rc[0], c: rc[1], v: vals[i] })).sort((a, b) => a.v - b.v);
  const touch = (a, b) => (Math.abs(a.r - b.r) + Math.abs(a.c - b.c)) === 1;
  for (let i = 1; i < seq.length; i++) {
    if (runOrderRule === 'path') { if (!touch(seq[i - 1], seq[i])) return false; continue; }
    let ok = false;
    for (let j = 0; j < i; j++) if (touch(seq[j], seq[i])) { ok = true; break; }
    if (!ok) return false;
  }
  return true;
}
function runOrderKey() { return runOrderRule[0]; }
function setRunOrderRule(v) {
  if (!RUN_ORDER_RULES.includes(v)) return;
  runOrderRule = v;
  try { localStorage.setItem(RUN_ORDER_KEY, v); } catch (e) {}
  // The components cache is keyed on the rule, so nothing stale is served - but
  // the live board has to be repainted or the hand label keeps its old answer.
  if (typeof _compCache !== 'undefined') _compCache.clear();
  devRenderDeckDesign();
  if (typeof render === 'function' && typeof gridData !== 'undefined' && gridData[0]) render();
}
const RUN_ORDER_KEY = 'lethe.runOrder.v1';
(function loadRunOrder() {
  try { const v = localStorage.getItem(RUN_ORDER_KEY); if (RUN_ORDER_RULES.includes(v)) runOrderRule = v; } catch (e) {}
})();

// ══════════════════════════════════════════════
// WHICH DECK A RUN DEALS FROM (r273)
// ══════════════════════════════════════════════
// A dev override. 'mode' is the default and means "whatever the mode says",
// which is what every run did before this existed. Spectrum is NEVER overridden:
// its deck is welded to `numeric` (white cards, colour faces, the four fixtures),
// so the picker reports it and leaves it alone. Start one from dev -> Modes.
const DECK_MODELS = ['mode', 'classic4', 'six', 'weighted'];
let deckModel = 'mode';

function deckModelNow() {
  if (typeof ACTIVE_MODE === 'undefined' || !ACTIVE_MODE) return 'classic4';
  if (ACTIVE_MODE.numeric) return 'spectrum';
  if (deckModel !== 'mode') return deckModel;
  return ACTIVE_MODE.suitCount === 6 ? 'six' : 'classic4';
}
// The r271 six-suit deck (cut rank + ladder + copies) owns the build.
function deckDesignActive()   { return deckModelNow() === 'six'; }
// The weighted deck owns the build.
function deckWeightedActive() { return deckModelNow() === 'weighted'; }
// Either of the two that build their own deck rather than a rank x suit cross
// product, so expectedDeckTotal must not be stamped over by the generic line.
function deckDesignOwnsDeck() { const m = deckModelNow(); return m === 'six' || m === 'weighted'; }

// ══════════════════════════════════════════════
// THE WEIGHTED DECK (r273) - copies per rank, set by hand
// ══════════════════════════════════════════════
// A set needs k copies of ONE rank; a run needs one copy each of k ADJACENT
// ranks. In a deck where every rank has the same number of copies those two move
// together - C(m,3) and m*m*m both grow like m cubed - which is why every knob
// before this traded sets against runs instead of separating them.
//
// Here the copy count is PER RANK. Make the common ranks never adjacent and
// every run window is forced to contain a scarce rank, which caps runs, while
// the common ranks pile up sets on their own.
//
// The shipped default is the measured one: A, 4, 7 and 10 carry NINE copies,
// 2, 3, 5, 6, 8 and 9 carry TWO, J/Q/K are out. 48 cards, six suits. Measured
// through the real engine against the r271 deck, share of 4x4 boards offering:
//
//                  today   weighted
//   Three of a Kind   35%      78%
//   Full House        29%      83%
//   Four of a Kind     2%      21%
//   Run of 3          93%      67%
//   Run of 4          45%      44%
//   Straight          24%      17%
//   Flush of 3        97%      98%
//
// Sets up two to three times over, runs DOWN or flat everywhere, flushes level.
//
// THE POINT IS NOT THE NUMBERS, IT IS WHERE THE SCARCITY SITS. A run is not hard
// because runs are hard; it is waiting on a specific scarce rank. That is what
// makes deck manipulation worth doing (adding one 2 opens a family that was
// closed) and what gives a Trick keyed on a heavy rank a different job from one
// keyed on a light rank.
//
// KNOWN AND NOT YET DONE: this breaks HAND_BASE pricing. Four of a Kind at 21%
// and Full House at 83% are priced as rare hands and would become bread and
// butter, and BASE_GOAL wants re-checking for the same reason r178 moved it.
// That is why this is a dev toggle and not the default.
const DECK_W_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const DECK_W_PRESETS = {
  balanced: { A:9, '2':2, '3':2, '4':9, '5':2, '6':2, '7':9, '8':2, '9':2, '10':9, J:0, Q:0, K:0 },
  flat5:    { A:5, '2':5, '3':5, '4':5, '5':5, '6':5, '7':5, '8':5, '9':5, '10':5, J:5, Q:5, K:0 },
  classic:  { A:4, '2':4, '3':4, '4':4, '5':4, '6':4, '7':4, '8':4, '9':4, '10':4, J:4, Q:4, K:4 },
};
let deckWeights = { ...DECK_W_PRESETS.balanced };
let deckWeightSuitCount = 6;

function deckWeightedRanks() { return DECK_W_RANKS.filter(r => (deckWeights[r] | 0) > 0); }
function deckWeightedSuits() { return SUITS_EIGHT.slice(0, Math.max(2, Math.min(8, deckWeightSuitCount))); }
function deckWeightedSize()  { return DECK_W_RANKS.reduce((a, r) => a + (deckWeights[r] | 0), 0); }

// ── Suits: as level as the counts allow, and randomly WHICH suit gets a spare ──
// A rank with more copies than there are suits MUST double up on some of them
// (nine copies over six suits is 1,1,1,2,2,2), so "one of each" is not on the
// table. What IS on the table is keeping the per-suit TOTALS level, because
// flush difficulty is cards-per-suit and a lopsided layout would make one suit's
// flushes easy and another's impossible while the deck size said nothing.
//
// Shuffle the suits, then STABLE-sort them by how many cards they are already
// carrying. Among suits on the same count the order is uniformly random, so
// which suit takes a rank's spare copy moves run to run while the totals stay
// level. Sorting with a random comparator instead is NOT a uniform shuffle.
function assignSuitsBalanced(rankCounts, suits) {
  const S = suits.length, load = suits.map(() => 0), out = [];
  for (const [rank, n] of rankCounts) {
    const base = Math.floor(n / S), extra = n % S;
    const order = suits.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
    order.sort((a, b) => load[a] - load[b]);
    const spare = new Set(order.slice(0, extra));
    for (let i = 0; i < S; i++) {
      const m = base + (spare.has(i) ? 1 : 0);
      for (let k = 0; k < m; k++) out.push({ rank, suit: suits[i] });
      load[i] += m;
    }
  }
  return out;
}
function buildWeightedDeck() {
  const suits = deckWeightedSuits();
  const pairs = deckWeightedRanks().map(r => [r, deckWeights[r] | 0]);
  // On the deck's own seeded stream, so a seeded run deals the same layout.
  // freshShuffledDeck runs once per run (startGame), so the layout is fixed for
  // the whole run - a reshuffle recycles cards through flushPlayedDeck and never
  // rebuilds, which is what stops a card's suit moving under the player.
  const cards = withSeededRng(() => assignSuitsBalanced(pairs, suits), 'deck');
  return cards.map(c => stampId({ rank: c.rank, suit: c.suit }));
}

// What the current weights actually produce, as densities per 10,000 random
// draws of that many cards. This is the same closed form the design search used:
//   set-k   = SUM over ranks C(copies, k)
//   run-k   = SUM over windows of k consecutive values, PRODUCT of copies
//   flush-k = SUM over suits C(cards in suit, k)
// The editor prints it live, so the balance is visible while you type.
function deckWeightedStats() {
  const N = deckWeightedSize(), S = deckWeightedSuits().length;
  const C = (n, k) => { if (k > n || k < 0) return 0; let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  const m = {};
  for (const r of DECK_W_RANKS) {
    const n = deckWeights[r] | 0; if (!n) continue;
    const v = RANK_ORDER[r]; m[v] = (m[v] || 0) + n;
    if (r === 'A') m[14] = (m[14] || 0) + n;     // the ace plays high as well
  }
  const setK = k => DECK_W_RANKS.reduce((a, r) => a + C(deckWeights[r] | 0, k), 0);
  const runK = k => Object.keys(m).map(Number).reduce((t, v) => {
    let p = 1; for (let j = 0; j < k; j++) { const c = m[v + j]; if (!c) return t; p *= c; }
    return t + p;
  }, 0);
  const d = (cnt, k) => (N >= k && C(N, k) > 0) ? cnt / C(N, k) * 1e4 : 0;
  return { N, S, perSuit: N / S, ranks: deckWeightedRanks().length,
           set3: d(setK(3), 3), run3: d(runK(3), 3), flush3: d(S * C(N / S, 3), 3),
           run4: d(runK(4), 4), run5: d(runK(5), 5) };
}

// ── Building the deck ────────────────────────────────────────────────────────
// Each rank takes `copies` of the six suits, and the window ROTATES by that many
// suits each rank, which is what keeps the suits balanced: at 4 copies over 6
// suits the offset runs 0,4,2,0,4,2... so every group of three ranks hands each
// suit exactly two cards. 12 ranks gives 8 cards in each of the six suits.
//
// Balance is not cosmetic. Flush difficulty is cards-per-suit, so a lopsided
// assignment would make one suit's flushes easy and another's impossible while
// the printed deck size said nothing about it.
function buildDesignedDeck() {
  const ranks = deckDesignRanks(), copies = deckDesignCopies(), suits = ACTIVE_SUITS;
  const d = [];
  let off = 0;
  for (const r of ranks) {
    for (let i = 0; i < copies; i++) d.push(stampId({ rank: r, suit: suits[(off + i) % suits.length] }));
    off = (off + copies) % suits.length;
  }
  return d;
}

// Called from startGame (a new run picks up the current tuning immediately) and
// from the round-start hook below (a change made mid-round lands at the boundary).
function deckDesignInstallLists() {
  const model = deckModelNow();
  if (model === 'weighted') {
    ACTIVE_SUITS = deckWeightedSuits();
    ACTIVE_RANKS = deckWeightedRanks();
    expectedDeckTotal = deckWeightedSize();
    deckDesignDirty = false;
    return true;
  }
  if (model === 'classic4') { ACTIVE_SUITS = SUITS; ACTIVE_RANKS = RANKS; deckDesignDirty = false; return false; }
  if (model !== 'six') return false;
  ACTIVE_SUITS = SUITS_SIX;
  ACTIVE_RANKS = deckDesignRanks();
  // The deck audit counts what a full deck holds. It is ranks x COPIES here, not
  // ranks x suits - miss this and every designed run reports a third of its deck
  // permanently missing.
  expectedDeckTotal = deckDesignSize();
  deckDesignDirty = false;
  return true;
}

// Round-start hook, called from triggerLevelUp beside the Spectrum one. A change
// made mid-round lands here rather than under the player's hand.
function deckDesignApplyPending() {
  if (!deckDesignDirty) return;
  deckDesignInstallLists();
  if (typeof initGridData === 'function') initGridData();
  if (typeof render === 'function') render();
}

// ── Dev panel (dev panel -> Deck) ────────────────────────────────────────────
function setDeckCutRank(rank) {
  deckCutRank = (deckCutRank === rank) ? '' : rank;   // tapping the live one clears it
  deckDesignDirty = true; saveDeckDesign(); devRenderDeckDesign();
}
function setDeckCourtsOffLadder(on) {
  deckCourtsOffLadder = !!on; deckDesignDirty = true; saveDeckDesign(); devRenderDeckDesign();
  if (typeof render === 'function' && typeof gridData !== 'undefined' && gridData[0]) render();
}
function setDeckCopiesPerRank(n) {
  deckCopiesPerRank = Math.max(1, Math.min(SUITS_SIX.length, n | 0));
  deckDesignDirty = true; saveDeckDesign(); devRenderDeckDesign();
}
function deckDesignApplyNow() {
  const m = deckModelNow();
  if (m === 'spectrum') { showMessage('Spectrum owns its own deck', '#ff6b6b'); return; }
  deckDesignDirty = true; deckDesignApplyPending();
  const n = m === 'weighted' ? deckWeightedSize() : m === 'six' ? deckDesignSize() : 52;
  showMessage('Deck rebuilt · ' + n + ' cards', '#6bcf7f');
}

// ── Setters (dev panel) ─────────────────────────────────────────────────────
function setDeckModel(v) {
  if (!DECK_MODELS.includes(v)) return;
  deckModel = v; deckDesignDirty = true; saveDeckDesign(); devRenderDeckDesign();
}
function setDeckWeight(rank, delta) {
  if (!DECK_W_RANKS.includes(rank)) return;
  deckWeights[rank] = Math.max(0, Math.min(20, (deckWeights[rank] | 0) + delta));
  deckDesignDirty = true; saveDeckDesign(); devRenderDeckDesign();
}
function setDeckWeightSuits(n) {
  deckWeightSuitCount = Math.max(2, Math.min(8, n | 0));
  deckDesignDirty = true; saveDeckDesign(); devRenderDeckDesign();
}
function deckWeightPreset(name) {
  const p = DECK_W_PRESETS[name]; if (!p) return;
  deckWeights = { ...p };
  deckDesignDirty = true; saveDeckDesign(); devRenderDeckDesign();
}

function devRenderDeckDesign() {
  const model = deckModelNow();
  const mo = document.getElementById('dev-deck-model');
  if (mo) mo.innerHTML = [
    ['mode',     'Mode default'],
    ['classic4', '4 suits \u00b7 52'],
    ['six',      '6 suits \u00b7 designed'],
    ['weighted', 'Weighted'],
  ].map(([v, lbl]) =>
    `<button class="dev-spec-chip${deckModel === v ? ' on' : ''}" onclick="setDeckModel('${v}')">${lbl}</button>`).join('')
    + `<span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--cream-dim);margin-left:6px;">now: ${model}</span>`;

  // ── the weighted editor ──
  const wsu = document.getElementById('dev-deck-wsuits');
  if (wsu) wsu.innerHTML = [4,5,6,7,8].map(n =>
    `<button class="dev-spec-chip${deckWeightSuitCount === n ? ' on' : ''}" onclick="setDeckWeightSuits(${n})">${n}</button>`).join('')
    + SUITS_EIGHT.slice(0, deckWeightSuitCount).map(g => `<span style="font-size:14px;margin-left:3px;">${g}</span>`).join('');
  const wp = document.getElementById('dev-deck-wpreset');
  if (wp) wp.innerHTML = [['balanced','Balanced 9/2'],['flat5','Flat 5'],['classic','Classic 4']]
    .map(([k, lbl]) => `<button class="dev-btn" onclick="deckWeightPreset('${k}')">${lbl}</button>`).join('');
  const we = document.getElementById('dev-deck-weights');
  if (we) we.innerHTML = DECK_W_RANKS.map(r => {
    const n = deckWeights[r] | 0;
    return `<div class="dev-wrank${n ? '' : ' off'}">
      <b>${r}</b>
      <button class="dev-wbtn" onclick="setDeckWeight('${r}',-1)">\u2212</button>
      <i>${n}</i>
      <button class="dev-wbtn" onclick="setDeckWeight('${r}',1)">+</button>
    </div>`;
  }).join('');
  const ws = document.getElementById('dev-deck-wstat');
  if (ws) {
    const t = deckWeightedStats();
    const bad = t.N < 24 ? ' <span style="color:var(--c-coral)">too small to deal a board</span>' : '';
    const fm = x => x.toFixed(0);
    ws.innerHTML = `<b>${t.N} cards</b> \u00b7 ${t.ranks} ranks \u00b7 ${t.perSuit.toFixed(1)} per suit${bad}<br>`
      + `per 10k draws \u00b7 <b>set3 ${fm(t.set3)}</b> \u00b7 <b>run3 ${fm(t.run3)}</b> \u00b7 <b>flush3 ${fm(t.flush3)}</b>`
      + ` \u00b7 spread ${(Math.max(t.set3,t.run3,t.flush3) / Math.max(1e-9, Math.min(t.set3,t.run3,t.flush3))).toFixed(2)}x<br>`
      + `run4 ${fm(t.run4)} \u00b7 run5 ${fm(t.run5)}${t.run5 <= 0 ? ' <span style="color:var(--c-coral)">(no straight possible)</span>' : ''}`;
  }

  const rk = document.getElementById('dev-deck-ranks');
  if (rk) rk.innerHTML = RANKS.map(r =>
    `<button class="dev-spec-chip${r === deckCutRank ? '' : ' on'}" onclick="setDeckCutRank('${r}')">${r}</button>`).join('');
  const ct = document.getElementById('dev-deck-courts');
  if (ct) ct.innerHTML = [true, false].map(v =>
    `<button class="dev-spec-chip${deckCourtsOffLadder === v ? ' on' : ''}" onclick="setDeckCourtsOffLadder(${v})">${v ? 'J/Q/K never run' : 'J/Q/K run normally'}</button>`).join('');
  const cp = document.getElementById('dev-deck-copies');
  if (cp) cp.innerHTML = [3, 4, 5, 6].map(n =>
    `<button class="dev-spec-chip${deckCopiesPerRank === n ? ' on' : ''}" onclick="setDeckCopiesPerRank(${n})">${n}</button>`).join('');
  const ro = document.getElementById('dev-deck-order');
  if (ro) ro.innerHTML = [
    ['off',  'Anywhere'],
    ['grow', 'Touch a lower card'],
    ['path', 'Touch the one below'],
  ].map(([v, lbl]) =>
    `<button class="dev-spec-chip${runOrderRule === v ? ' on' : ''}" onclick="setRunOrderRule('${v}')">${lbl}</button>`).join('');
  const st = document.getElementById('dev-deck-status');
  if (st) {
    const ranks = deckDesignRanks(), copies = deckDesignCopies(), S = SUITS_SIX.length;
    const ladder = ranks.filter(r => !(deckCourtsOffLadder && DECK_COURTS.includes(r)));
    st.innerHTML =
      `<b>${ranks.length} ranks x ${copies} copies = ${deckDesignSize()} cards</b> · ${(deckDesignSize() / S).toFixed(1)} per suit<br>`
      + `sets/card ${(copies - 1).toFixed(1)} · flushes/card ${(deckDesignSize() / S - 1).toFixed(1)}<br>`
      + `ladder: ${ladder.join(' ') || '(none)'}<br>`
      + (deckDesignActive() ? '' : '<span style="color:var(--c-coral)">Six Suits only · not the mode in play</span>');
  }
}
