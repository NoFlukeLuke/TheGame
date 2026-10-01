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

// ── r409: the six-suit deck is FIXED at its shipped shape ────────────────────
// Six Suits stopped being a mode (it is a per-mode deck choice now, below) and
// its tuning block was retired with the weighted deck (owner's call). The numbers
// are the r270 defaults the measurements above were taken at.
const deckCutRank         = '8';    // the one rank left out of the deck
const deckCourtsOffLadder = false;  // J/Q/K run like any other rank
const deckCopiesPerRank   = 5;      // how many of each rank, spread over the 6 suits
// Set when a deck setting changes, consumed at the next round start. The round
// being played always finishes on the deck it was dealt.
let deckDesignDirty = false;

// The rank list a designed run deals from - always in RANKS order.
function deckDesignRanks() {
  const a = RANKS.filter(r => r !== deckCutRank);
  return a.length ? a : [...RANKS];
}
function deckDesignCopies() { return Math.max(1, Math.min(ACTIVE_SUITS.length || SUITS_SIX.length, deckCopiesPerRank)); }
function deckDesignSize()   { return deckDesignRanks().length * deckDesignCopies(); }

// ══════════════════════════════════════════════
// WHICH DECK A MODE DEALS FROM (r409)
// ══════════════════════════════════════════════
// Every mode that plays the ordinary deck can be switched, per mode, to the
// six-suit deck instead (dev panel -> that mode's tab). 'normal' is the 52-card
// deck plus its wilds; 'six' is the designed six-suit deck plus its wilds.
const MODE_DECK_KEY = 'lethe.modeDeck.v1';
let modeDeckChoices = (() => {
  try { const o = JSON.parse(localStorage.getItem(MODE_DECK_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; }
  catch (e) { return {}; }
})();
// A mode that owns its own deck (Spectrum's colours, Climb's 1-13, the modes
// with their own hand detection) and a picker-built one (it asks the question
// itself) are never switched.
function modeDeckSwitchable(id) {
  const m = (typeof MODES !== 'undefined') && MODES[id];
  if (!m || m.numeric || m.climb || id === 'custom' || id === 'picker') return false;
  if (typeof WILD_OWN_DETECTION !== 'undefined' && WILD_OWN_DETECTION.includes(id)) return false;
  return (m.suitCount || 4) === 4;
}
function modeDeckChoice(id) { return modeDeckSwitchable(id) && modeDeckChoices[id] === 'six' ? 'six' : 'normal'; }
function setModeDeckChoice(id, v) {
  if (!modeDeckSwitchable(id)) return;
  if (v === 'six') modeDeckChoices[id] = 'six'; else delete modeDeckChoices[id];
  try { localStorage.setItem(MODE_DECK_KEY, JSON.stringify(modeDeckChoices)); } catch (e) {}
}
// The suit count THIS run plays with. Every reader that used to ask
// ACTIVE_MODE.suitCount asks this, so the per-mode switch reaches the deck build,
// the short-flush unlock and the Trick filter at once.
function runSuitCount() {
  if (typeof ACTIVE_MODE === 'undefined' || !ACTIVE_MODE) return 4;
  if (modeDeckChoice(ACTIVE_MODE.id) === 'six') return 6;
  return ACTIVE_MODE.suitCount || 4;
}

// ══════════════════════════════════════════════
// WILD CARDS (r409) - how many, and whether they run
// ══════════════════════════════════════════════
// The count is PER SUIT, so the normal deck carries 4 and the six-suit deck 6
// with one setting. wildCardCount() (js/data/cards.js) reads it.
const WILD_PER_SUIT_KEY = 'lethe.wildPerSuit.v1';
const WILD_RUNS_KEY     = 'lethe.wildRuns.v1';
let wildsPerSuit = (() => { try { const v = parseFloat(localStorage.getItem(WILD_PER_SUIT_KEY)); return Number.isFinite(v) ? Math.max(0, Math.min(4, v)) : 1; } catch (e) { return 1; } })();
let wildsInRuns  = (() => { try { return localStorage.getItem(WILD_RUNS_KEY) === '1'; } catch (e) { return false; } })();
try { localStorage.removeItem('lethe.wildCount'); localStorage.removeItem('lethe.deckDesign.v3'); localStorage.removeItem('lethe.runOrder.v1'); } catch (e) {}
function setWildsPerSuit(n) {
  wildsPerSuit = Math.max(0, Math.min(4, +n || 0));
  try { if (wildsPerSuit === 1) localStorage.removeItem(WILD_PER_SUIT_KEY); else localStorage.setItem(WILD_PER_SUIT_KEY, String(wildsPerSuit)); } catch (e) {}
  devRenderDeckDesign();
}
function setWildsInRuns(on) {
  wildsInRuns = !!on;
  try { if (on) localStorage.setItem(WILD_RUNS_KEY, '1'); else localStorage.removeItem(WILD_RUNS_KEY); } catch (e) {}
  if (typeof clearHandCompCache === 'function') clearHandCompCache();
  else if (typeof _compCache !== 'undefined') _compCache.clear();
  devRenderDeckDesign();
  if (typeof _devSafeRender === 'function') _devSafeRender();
}

// ── Off the ladder ──
// A card off the ladder can never be part of a run. rankRunVals is what makes
// every run test fail for free: each of the three run builders loops over these
// options, and a loop over nothing can never succeed. Add a new run test and read
// this, never RANK_ORDER directly.
function rankIsOffLadder(rank) {
  return deckCourtsOffLadder && deckDesignActive() && DECK_COURTS.includes(rank);
}
// Every run value the live deck's ranks can take - what a wild may stand in for
// when wilds run. Cached on the ACTIVE_RANKS array it was built from.
let _wildRunVals = null, _wildRunValsFor = null;
function wildRunVals() {
  if (_wildRunValsFor !== ACTIVE_RANKS) {
    const s = new Set();
    (ACTIVE_RANKS || []).forEach(r => { if (!isWildRank(r)) rankRunVals(r).forEach(v => s.add(v)); });
    _wildRunVals = [...s].sort((a, b) => a - b); _wildRunValsFor = ACTIVE_RANKS;
  }
  return _wildRunVals;
}
function rankRunVals(rank) {
  // A WILD IS NOT A RANK. By default it has no run value, so the loop in
  // _handShape's tryRunCombos has nothing to place it at - "never part of a
  // run". With wilds-in-runs on (dev -> Deck) it may stand in for any value the
  // deck holds. Tested HERE and not left to RANK_ORDER: the line below ends
  // `?? 0`, so an unknown rank would come back as [0].
  if (typeof isWildRank === 'function' && isWildRank(rank)) return wildsInRuns ? wildRunVals() : [];
  if (rankIsOffLadder(rank)) return [];
  return rank === 'A' ? [1, 14] : [RANK_ORDER[rank] ?? 0];
}
// Cheap cache-key fragment. handComponentsFor memoises on the cards, so a toggle
// flipped mid-run would otherwise be served stale answers.
function deckLadderKey() { return (deckCourtsOffLadder ? 'C' : 'c') + (deckDesignActive() ? '6' : '4') + (wildsInRuns ? 'W' : 'w'); }

// ── THE RUN ORDER RULE (r272) ── retired from the dev panel in r409; 'off' is
// the game. The test stays so _handShape's call site does not change.
const runOrderRule = 'off';
function runOrderOK(cells, vals) { return true; }
function runOrderKey() { return 'o'; }

// Which deck the run deals from. Spectrum and Climb own theirs; everything else
// is the normal four-suit deck or, by the mode's switch, the six-suit one.
function deckModelNow() {
  if (typeof ACTIVE_MODE === 'undefined' || !ACTIVE_MODE) return 'classic4';
  if (ACTIVE_MODE.numeric) return 'spectrum';
  if (ACTIVE_MODE.climb) return 'climb';
  return runSuitCount() === 6 ? 'six' : 'classic4';
}
function deckDesignActive()   { return deckModelNow() === 'six'; }
// The six-suit deck builds itself rather than a rank x suit cross product, so
// expectedDeckTotal must not be stamped over by the generic line.
function deckDesignOwnsDeck() { return deckDesignActive(); }

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

// Called from startGame (a new run picks up the current setting immediately) and
// from the round-start hook below (a change made mid-round lands at the boundary).
function deckDesignInstallLists() {
  const model = deckModelNow();
  if (model === 'classic4') { ACTIVE_SUITS = SUITS; ACTIVE_RANKS = RANKS; deckDesignDirty = false; return false; }
  if (model !== 'six') return false;
  ACTIVE_SUITS = SUITS_SIX;
  ACTIVE_RANKS = deckDesignRanks();
  // The deck audit counts what a full deck holds. It is ranks x COPIES here, not
  // ranks x suits.
  expectedDeckTotal = deckDesignSize();
  expectedDeckTotal += (typeof wildCardCount === 'function') ? wildCardCount() : 0;   // r325
  deckDesignDirty = false;
  return true;
}

// Round-start hook, called from triggerLevelUp beside the Spectrum one.
function deckDesignApplyPending() {
  if (!deckDesignDirty) return;
  deckDesignInstallLists();
  if (typeof initGridData === 'function') initGridData();
  if (typeof render === 'function') render();
}

// ── Dev panel (dev panel -> Deck): the wild settings ──
function devRenderDeckDesign() {
  const wp = document.getElementById('dev-deck-wilds');
  if (wp) wp.innerHTML = [0, 0.5, 1, 1.5, 2, 3].map(n =>
    `<button class="dev-spec-chip${wildsPerSuit === n ? ' on' : ''}" onclick="setWildsPerSuit(${n})">${n}</button>`).join('');
  const wr = document.getElementById('dev-deck-wildruns');
  if (wr) wr.innerHTML = [[false, 'Sets only'], [true, 'Sets and runs']].map(([v, l]) =>
    `<button class="dev-spec-chip${wildsInRuns === v ? ' on' : ''}" onclick="setWildsInRuns(${v})">${l}</button>`).join('');
  const st = document.getElementById('dev-deck-wildstat');
  if (st) {
    const n4 = Math.round(wildsPerSuit * 4), n6 = Math.round(wildsPerSuit * 6);
    const live = (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) ? ACTIVE_MODE : null;
    const wc = (typeof wildCardCount === 'function') ? wildCardCount() : 0;
    st.innerHTML = `normal deck: <b>${n4}</b> wilds &middot; six-suit deck: <b>${n6}</b> wilds`
      + (live ? `<br>this mode (<b>${live.name || live.id}</b>) deals <b>${wc}</b>`
         + (wc ? '' : ' &middot; it owns its deck or its hand detection') : '')
      + `<br>applies from the next run`;
  }
}
