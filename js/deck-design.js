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
  } catch (e) {}
})();
function saveDeckDesign() {
  try {
    localStorage.setItem(DECK_DESIGN_KEY, JSON.stringify({
      cut: deckCutRank, courtsOff: deckCourtsOffLadder, copies: deckCopiesPerRank,
    }));
  } catch (e) {}
}

// ── Who this applies to ──────────────────────────────────────────────────────
// The SIX-SUIT mode only. Classic is the reference balance the whole game is
// tuned against and is deliberately untouched; Spectrum has its own tuner and
// its own lists, and `numeric` is what keeps this off it.
function deckDesignActive() {
  return !!(typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE
            && !ACTIVE_MODE.numeric && ACTIVE_MODE.suitCount === 6);
}

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
  if (!deckDesignActive()) return false;
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
  if (!deckDesignDirty || !deckDesignActive()) { deckDesignDirty = false; return; }
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
  if (!deckDesignActive()) { showMessage('Six Suits only', '#ff6b6b'); return; }
  deckDesignDirty = true; deckDesignApplyPending();
  showMessage('Deck rebuilt · ' + deckDesignSize() + ' cards', '#6bcf7f');
}

function devRenderDeckDesign() {
  const rk = document.getElementById('dev-deck-ranks');
  if (rk) rk.innerHTML = RANKS.map(r =>
    `<button class="dev-spec-chip${r === deckCutRank ? '' : ' on'}" onclick="setDeckCutRank('${r}')">${r}</button>`).join('');
  const ct = document.getElementById('dev-deck-courts');
  if (ct) ct.innerHTML = [true, false].map(v =>
    `<button class="dev-spec-chip${deckCourtsOffLadder === v ? ' on' : ''}" onclick="setDeckCourtsOffLadder(${v})">${v ? 'J/Q/K never run' : 'J/Q/K run normally'}</button>`).join('');
  const cp = document.getElementById('dev-deck-copies');
  if (cp) cp.innerHTML = [3, 4, 5, 6].map(n =>
    `<button class="dev-spec-chip${deckCopiesPerRank === n ? ' on' : ''}" onclick="setDeckCopiesPerRank(${n})">${n}</button>`).join('');
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
