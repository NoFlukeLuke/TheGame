const SUITS = ['♠','♥','♦','♣'];
// Six Suits mode adds two extra suits (Star + Triangle) to dilute the deck so
// flushes become rare. ACTIVE_SUITS is the suit list the current game actually
// uses - set per-mode in startGame(). Classic play leaves it equal to SUITS,
// so nothing about the four-suit game changes.
// The two suits beyond the classic four. Crown and crescent moon: they have to
// read as SUITS at card size, so they are single filled-weight glyphs like the
// other four rather than emoji, which would sit at a different size and weight.
const SUITS_EXTRA = ['♛','☾'];
const SUITS_SIX = [...SUITS, ...SUITS_EXTRA];
// Two more, for the weighted deck's suit knob (r273). Suit count is the flush
// dial - flush difficulty is cards-per-suit - so the editor needs to reach past
// six to bring flushes down to where sets and runs sit.
const SUITS_EXTRA2 = ['★', '▲'];
const SUITS_EIGHT = [...SUITS_SIX, ...SUITS_EXTRA2];
let ACTIVE_SUITS = SUITS;
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED = new Set(['♥','♦']);

// ── SPECTRUM MODE (numeric deck) ──────────────────────────────────────────────
// A deck with no suits and no court cards: seven COLOURS instead of four suits,
// and plain values 1-15 plus a lone 20 instead of A/2-10/J/Q/K.
// The colour is stored in the card's `suit` field and the value in `rank`, so
// every existing system (flush = all one suit, cardKey, curses, saves, the deck
// audit) keeps working untouched - only the CONTENT of the two fields changes.
// Colours are emoji so any UI that just prints the suit character (deck view,
// records, tooltips, the Mart) stays readable with no extra styling.
const COLORS = ['🔴','🟡','🔵','🟢','🟣','🟠','⚫'];
const COLOR_NAMES = { '🔴':'Red', '🟡':'Yellow', '🔵':'Blue', '🟢':'Green', '🟣':'Purple', '🟠':'Orange', '⚫':'Black', '⚪':'White' };
// Face hex for each colour - used by the card face, score particles and chips.
const COLOR_HEX = { '🔴':'#d43b3b', '🟡':'#e0b81c', '🔵':'#2f6fd0', '🟢':'#2f9e54', '🟣':'#8b4bc8', '🟠':'#e07a1f', '⚫':'#23201c', '⚪':'#efe7d6' };
// Two classes: `num-suit` (generic hook - carries the --num-color/--num-ink
// tokens wherever a colour card is drawn) plus the colour's own class.
const COLOR_CLASS = { '🔴':'num-suit col-red', '🟡':'num-suit col-yellow', '🔵':'num-suit col-blue', '🟢':'num-suit col-green', '🟣':'num-suit col-purple', '🟠':'num-suit col-orange', '⚫':'num-suit col-black', '⚪':'num-suit col-white' };
// Values: 0-11, then a lone 15 and a lone 20. The gaps are deliberate - 15 and
// 20 are big-pip loners that can never be part of a run or straight, and the 0
// is a genuine dead card (0 pips) that still counts for sets and colour flushes.
const RANKS_NUMERIC = ['0','1','2','3','4','5','6','7','8','9','10','11','15','20'];
// ── WHITE: the colourless values (r164, reworked r165) ──
// 9, 10 and 11 have no colour of their own — they are drawn WHITE (⚪) and can
// never complete a flush.
//
// Whiteness is DERIVED FROM THE VALUE, never stored on the card. Each card keeps
// the colour its deck slot gave it, so the seven white 9s are seven SEPARATE
// cards with seven separate `cardKey`s — they buff, curse and get tracked
// independently, exactly like any other card. (r164 repainted `suit` to '⚪',
// which collapsed all seven onto the one key '9-⚪' and made a buff on one a buff
// on all seven; this replaces that.) Deriving it also means there is no per-card
// state to preserve through the discard → reshuffle → redraw round trip, which
// rebuilds cards from `{rank, suit}` alone.
//
// Everything the player SEES asks cardColorSuit(); everything that IDENTIFIES a
// card keeps using card.suit.
const WHITE = '⚪';
const WHITE_RANKS = ['9', '10', '11'];
function isWhiteRankValue(rank) { return isNumericMode() && WHITE_RANKS.includes(rank); }
function isWhiteCard(card) { return !!card && isWhiteRankValue(card.rank); }
// The colour a card READS as — white for the colourless values, its own colour
// otherwise. Used by the card face, the deck read-outs, score particles, and the
// colour-COUNT Tricks (a white card counts as the colour "white", not as the
// colour of the slot it came from).
function cardColorSuit(card) { return isWhiteCard(card) ? WHITE : (card ? card.suit : null); }
// True for a card that belongs to the numeric deck — asked of the CARD, not the
// mode, so the hand preview / score dance / saved runs all render it correctly
// wherever they get their cards from.
function isColorSuit(suit) { return !!COLOR_HEX[suit]; }
function isNumericMode() { return !!(typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.numeric); }

// ACTIVE_RANKS is the rank list the current game actually uses (the mirror of
// ACTIVE_SUITS below). Set per-mode in startGame(); classic modes leave it equal
// to RANKS so nothing about the A-K game changes.
let ACTIVE_RANKS = RANKS;

// ── THE WILD CARD (r325) ─────────────────────────────────────────────────────
// A card that TAKES ANY RANK TO COMPLETE A SET, and only a set. It can never be
// part of a run or a flush, it scores no pips of its own, and it fires none of
// the per-card Tricks. It is a shape you were missing and nothing else.
//
// IT IS A RANK, NOT A FLAG, and that is the r165 white-card lesson applied
// again: `recycleCard` rebuilds an ordinary card from `{rank, suit}` plus the
// DURABLE_CARD_FIELDS list every time it leaves the board, so a `_wild` field
// would have to be named there AND kept in step with the save manifest and the
// two pile functions. Deriving it from the rank costs none of that - the wild
// survives the discard -> reshuffle -> redraw round trip for free, cardId and
// cardKey work untouched, and a buff or a curse lands on it like any other card.
//
// WILD_SUIT is a non-suit, deliberately. A wild drawn as a spade that cannot
// complete a spade flush is the more confusing object, and "no rank, no suit" is
// one rule rather than two. It is absent from ACTIVE_SUITS, which is most of why
// the flush exclusion falls out - but both flush sites test isWildCard()
// EXPLICITLY anyway, because r164 relied on absence alone and r165 had to undo it.
const WILD_RANK = '\u2736';   // ✶  six-pointed star
const WILD_SUIT = '\u2733';   // ✳  eight-spoked asterisk
const WILD_NAME = 'Wild';
const WILD_DESC = 'Takes any rank to complete a set. Never part of a run or a flush, scores no pips, and fires no Tricks.';
function isWildRank(rank) { return rank === WILD_RANK; }
function isWildCard(card) { return !!card && card.rank === WILD_RANK; }
// Every hand-level count that reads a rank or a suit asks for these instead of
// the raw hand: a wild is not an even card, not a club, not the lowest rank on
// the board, and not a distinct colour for Rainbow to count.
// Warehouse (r354): a Sleight with NO rank that counts as TWO cards of any suit
// toward a flush and nothing else. Like a wild it scores nothing itself.
function isWarehouseCard(card) { return !!card && card._isSleight && card.sleightId === 'warehouse'; }
function naturalCards(cards) { return (cards || []).filter(c => c && !isWildRank(c.rank) && !isWarehouseCard(c)); }
function countWilds(cards) { return (cards || []).reduce((n, c) => n + (c && isWildRank(c.rank) ? 1 : 0), 0); }

// How many wilds this mode's deck carries. Four by default (owner's number), in
// the classic four-suit deck and the six-suit deck alike - which between them is
// every mode that plays the ordinary grid game.
//
// SPECTRUM IS OUT because its deck is values x colours with its own four payout
// fixtures shuffled in, and a rank that is not a value has no place in it. The
// four modes with their own hand detection are out for a harder reason: Poker
// Squares scores a LINE through its own evaluator (sqScoreLine), Match-3 and Zen
// match their own windows, and Dominoes builds its own two-cell board - none of
// them route through handComponentsFor, so a wild there would be a blank card
// that completes nothing. A daily grid also has to stay comparable between two
// players, which a wild it cannot score would not be.
const WILD_COUNT_DEFAULT = 4;
const WILD_OWN_DETECTION = ['squares', 'match3', 'zen', 'dominoes'];
function wildCardCount() {
  const m = (typeof ACTIVE_MODE !== 'undefined') ? ACTIVE_MODE : null;
  if (!m || m.numeric || WILD_OWN_DETECTION.includes(m.id)) return 0;
  if (m.wilds != null) return Math.max(0, m.wilds | 0);
  // Dev panel -> Deck. A stored value beats the default, which is the whole
  // point of the knob; an unparseable one falls back rather than dealing NaN.
  let n = WILD_COUNT_DEFAULT;
  try { const v = parseInt(localStorage.getItem('lethe.wildCount'), 10); if (Number.isFinite(v)) n = v; } catch (e) {}
  return Math.max(0, Math.min(52, n));
}

// RANK_ORDER / RANK_PIPS carry the numeric ranks too. '2'-'10' already map to
// themselves, so only 1, 11-15 and 20 are new - no classic key changes value.
const RANK_ORDER = {A:1,'0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13,
                    '11':11,'12':12,'13':13,'14':14,'15':15,'20':20};
const RANK_PIPS  = {A:11,J:10,Q:10,K:10, [WILD_RANK]: 0};   // numeric ranks fall through to parseInt (pips = value)
// The wild's 0 has to be EXPLICIT: cardPips falls back to 10 for a rank it does
// not know, so leaving it out would pay every wild a court card's worth. Same
// shape as the Spectrum 0 that `parseInt(rank) || 10` used to turn into a 10.

// Sort helpers - deck view / shop card list. Numeric ranks sort by value; an
// unknown rank sinks to the end.
function rankSortVal(rk) { return RANK_ORDER[rk] ?? (parseInt(rk) || 99); }
function suitSortVal(s)  { const i = ACTIVE_SUITS.indexOf(s); return i < 0 ? 99 : i; }

// Hand values, retuned r178. Two things set the price of a row: how hard the
// shape is to SPOT on the board, and how many cards it costs you.
//
// Difficulty here is not poker difficulty. Hands are built from orthogonally
// connected cards on a small grid, so the odds are nothing like a 5-card draw,
// and the real work is visual. Measured over 1,200 fresh 4x4 deals with every
// hand active, the share of boards offering each shape somewhere:
//
//   Pair 100%  ·  Two Pair 95%  ·  Flush of 3 85%  ·  Run of 3 73%
//   Three of a Kind 60%  ·  Run of 4 48%  ·  Flush of 4 45%  ·  Straight 34%
//   Full House 21%  ·  Flush 17%  ·  Four of a Kind 2.3%  ·  Straight Flush 0.3%
//
// Flushes are the outlier. A suit match is a colour match, so the eye finds one
// without reading a single rank, and a flush of 3 is on 85% of boards. Runs are
// the opposite: they need every rank read and ordered. So flushes are the
// cheapest row per card at every length and runs are the dearest, with sets in
// between, and the old table's four inversions are gone:
//   Two Pair paid the same 40 as a Pair for twice the cards (never worth it).
//   Flush of 3 outpaid Run of 3 despite being easier and more common.
//   Flush outpaid nothing but cost 5 cards while Flush of 4 at 4 cards paid more.
//   Straight, at 5 cards and rarer, paid less than Flush of 4 at 4.
// Total economy is near enough unchanged: weighting each row by how often it is
// the best hand on a board, the average best hand moves about +3%, so round
// goals did not need rescaling.
const HAND_BASE = {
  // Flushes: cheapest per card, and each extra card adds +5 pips and +1 mult.
  'Flush of 3':      { pips:15, mult:2 },   //  30
  'Flush of 4':      { pips:20, mult:3 },   //  60
  'Flush':           { pips:25, mult:4 },   // 100
  // Pairs and sets: middle.
  'Pair':            { pips:20, mult:2 },   //  40
  'Two Pair':        { pips:30, mult:3 },   //  90
  'Three of a Kind': { pips:35, mult:3 },   // 105
  'Full House':      { pips:45, mult:5 },   // 225
  'Four of a Kind':  { pips:60, mult:7 },   // 420
  // Runs: dearest, because every rank has to be read and ordered.
  'Run of 3':        { pips:25, mult:3 },   //  75
  'Run of 4':        { pips:30, mult:4 },   // 120
  'Straight':        { pips:40, mult:5 },   // 200
  'Straight Flush':  { pips:100,mult:8 },   // 800
  // ── Big hands (r199) - only reachable once Selection Size is upgraded past 5,
  // and the sets past four only in Spectrum (7 colours, one card each per value)
  // or with duplicated cards from the shop. Priced to keep each ladder's shape:
  // flushes +5 pips / +1 mult per card, runs steeper, sets steepest.
  'Flush of 6':      { pips:30, mult:5 },   //  150
  'Flush of 7':      { pips:35, mult:6 },   //  210
  'Run of 6':        { pips:55, mult:6 },   //  330
  'Run of 7':        { pips:75, mult:7 },   //  525
  'Five of a Kind':  { pips:85, mult:9 },   //  765
  'Six of a Kind':   { pips:115,mult:11 },  // 1265
  'Seven of a Kind': { pips:150,mult:13 },  // 1950
  // High Card (r200) pays NOTHING of its own - the cards' own pips are the whole
  // score, and HAND_FOCUS gives it 0. It exists so a forced-large selection is
  // always playable; it must never be worth reaching for.
  'High Card':       { pips:0,  mult:1 },   //    0
};

// ── The short label the HUD prints beside the hand preview (r198) ──
// Two lines, family over size, because the desktop panel gives it a 6%-wide
// column. A numeric size is printed as "OF N" by handLabelHTML (owner spec,
// r333: "SET / OF 3", "RUN / OF 4", "TWO / PAIR" - words never broken). A
// layered hand prints one of these per layer, stacked. Straight Flush is both
// families at once, so it says so rather than picking one.
const HAND_LABEL = {
  'Run of 3':        { fam:'RUN',   size:'3' },
  'Run of 4':        { fam:'RUN',   size:'4' },
  'Straight':        { fam:'RUN',   size:'5' },
  'Flush of 3':      { fam:'FLUSH', size:'3' },
  'Flush of 4':      { fam:'FLUSH', size:'4' },
  'Flush':           { fam:'FLUSH', size:'5' },
  'Pair':            { fam:'SET',   size:'2' },
  'Two Pair':        { fam:'TWO',   size:'PAIR' },
  'Three of a Kind': { fam:'SET',   size:'3' },
  'Full House':      { fam:'FULL',  size:'HOUSE' },
  'Four of a Kind':  { fam:'SET',   size:'4' },
  'Straight Flush':  { fam:'RUN 5', size:'FLUSH' },
  'Flush of 6':      { fam:'FLUSH', size:'6' },
  'Flush of 7':      { fam:'FLUSH', size:'7' },
  'Run of 6':        { fam:'RUN',   size:'6' },
  'Run of 7':        { fam:'RUN',   size:'7' },
  'Five of a Kind':  { fam:'SET',   size:'5' },
  'Six of a Kind':   { fam:'SET',   size:'6' },
  'Seven of a Kind': { fam:'SET',   size:'7' },
  'High Card':       { fam:'HIGH',  size:'CARD' },
};

// ── Per-mode hand-value overrides (r164) ──
// Spectrum zeroes the Flush of 3: no base pips, no multiplier of its own (×1 is
// the neutral value - calcScore SEEDS mult from this table) and no Focus. With
// white in the deck a flush of 3 is still the second-most-common 3-card hand, so
// it stays legal and countable, it just isn't worth playing for.
// HAND_BASE / HAND_FOCUS are shared by every mode, so the pristine values are kept
// and re-applied whenever a non-Spectrum run starts.
// Pristine copies are taken on FIRST CALL, not at load: HAND_FOCUS lives in
// js/focus-config.js, which loads after this file. By the time startGame runs,
// both tables exist and neither has been touched.
let _handValuesPristine = null;
const NUMERIC_HAND_BASE  = { 'Flush of 3': { pips: 0, mult: 1 } };
const NUMERIC_HAND_FOCUS = { 'Flush of 3': 0 };
function applyModeHandValues() {
  if (!_handValuesPristine) {
    _handValuesPristine = {
      base:  JSON.parse(JSON.stringify(HAND_BASE)),
      focus: { ...HAND_FOCUS },
    };
  }
  const P = _handValuesPristine;
  Object.keys(P.base).forEach(h => { HAND_BASE[h].pips = P.base[h].pips; HAND_BASE[h].mult = P.base[h].mult; });
  Object.keys(P.focus).forEach(h => { HAND_FOCUS[h] = P.focus[h]; });
  // Poker Squares replaces the whole table with the real-poker ladder and zeroes
  // every hand the main game invented for its grid (Flush of 3, Run of 4...): a
  // LINE there is five cards, which is a poker hand, so it is scored as one.
  if (typeof squaresActive === 'function' && squaresActive()) { squaresInstallHandValues(); return; }
  if (!isNumericMode()) return;
  Object.entries(NUMERIC_HAND_BASE).forEach(([h, v]) => { if (HAND_BASE[h]) { HAND_BASE[h].pips = v.pips; HAND_BASE[h].mult = v.mult; } });
  Object.entries(NUMERIC_HAND_FOCUS).forEach(([h, v]) => { HAND_FOCUS[h] = v; });
}

const GAME_DURATION = 1200; // 20 minutes in seconds
const ROUND_DURATION = 180;
// Leftover clock -> credits, the payout's "Efficiency" line (js/interlude.js) and
// Survival's per-clear bonus (js/survival.js). ONE constant so the two economies
// cannot drift. r213 doubled it to 5; r278 puts it back to 10 (owner's call - the
// player was ending runs drowning in credits, and this paid in every mode). The
// Time and a Half knack halves the interval, i.e. doubles the payout.
const EFFICIENCY_SECONDS_PER_COIN = 10;
// Every reader goes through this, never the raw constant, so the knack reaches
// the payout figure, the printed labels, the count-up tick and Survival at once.
function efficiencySecondsPerCoin() {
  return (typeof hasKnack === 'function' && hasKnack('time_and_a_half'))
    ? EFFICIENCY_SECONDS_PER_COIN / 2 : EFFICIENCY_SECONDS_PER_COIN;
}
// Unused swaps and discards -> credits, the payout's "Unused stock" line
// (js/interlude.js) and its Survival/Flow mirror (js/survival.js). Same rule as
// efficiencySecondsPerCoin above: ONE function, so the two economies and the
// PRINTED label cannot drift - which is exactly what happened to the interact
// costs in r151 and is why they are quoted from one place now.
//
// r304 took the rate 3 -> 2 and CAPPED THE LINE at BAL._resources.unspent_cap
// (owner's call - runs were ending drowning in credits). r305 took the cap
// 16 -> 10 and capped INTEREST as well. The cap is what does the work late: the
// rate alone is linear in a stock that grows all run, so at 12 held actions the
// pre-r304 line paid 36 and this one pays 10.
function unspentPayout(actions) {
  const R = _payoutRes();
  const rate = R.unspent_credits != null ? R.unspent_credits : 2;
  return _payoutCapped(Math.max(0, actions) * rate, R.unspent_cap);
}

// ── INTEREST, and why the cap lands on the BASE rather than the line (r305) ──
// The runaway is `floor(coins/10)`: it COMPOUNDS, so a hoarded bank grows itself
// every round with no ceiling, and measured over an 18-round run it was the
// largest single source of credits in the game by a distance (340 against 208
// from unused stock and 72 from leftover time).
//
// The Idol's x3 is applied AFTER the cap, deliberately. Capping the finished
// line instead would make the Idol pay nothing at all above 4 credits held -
// a Sleight whose whole printed effect is "x3 interest", silently doing nothing
// for the entire second half of every run. Capped base x Idol reads as what it
// is: the line pays at most 10, and the Idol triples that.
function interestPayout(credits, mult) {
  const R = _payoutRes();
  const base = _payoutCapped(Math.floor(Math.max(0, credits) / 10), R.interest_cap);
  return base * (mult || 1);
}

// ── ONE predicate, read by both lines AND by both printed labels ────────────
// Gross Pay (knack) lifts every payout ceiling. It is asked here rather than at
// each site so a line and the label above it can never disagree about whether
// the cap is on - the r151 lesson, where a quoted cost and a charged cost drifted
// apart because they were worked out in two places.
function payoutCapsLifted() {
  return typeof hasKnack === 'function' && hasKnack('gross_pay');
}
function _payoutRes() {
  return (typeof BAL !== 'undefined' && BAL._resources) ? BAL._resources : {};
}
function _payoutCapped(n, cap) {
  return (cap == null || payoutCapsLifted()) ? n : Math.min(cap, n);
}
// What the payout screen and the Time pop-up say each line pays. Quoted from the
// same numbers that are paid, never typed alongside them.
function unspentPayoutDesc() {
  const R = _payoutRes();
  const rate = R.unspent_credits != null ? R.unspent_credits : 2;
  return `${rate} per unused swap or discard` + _payoutCapNote(R.unspent_cap);
}
function interestPayoutDesc(credits, mult, creditsHTML) {
  const R = _payoutRes();
  const shown = creditsHTML != null ? creditsHTML : credits;
  return `10% of ${shown}` + ((mult || 1) > 1 ? ` × ${mult} (Idol)` : '')
       + _payoutCapNote(R.interest_cap, (mult || 1) > 1 ? ' before the Idol' : '');
}
function _payoutCapNote(cap, extra) {
  if (cap == null) return '';
  return payoutCapsLifted() ? ' · uncapped' : ` · max ${cap}${extra || ''}`;
}
const LEVEL_UP_DURATION = 45;
// 1200, raised from 1000 with the r178 hand retune. That retune moved value into
// the hands players actually make (Straights, Full Houses, Two Pair) and out of
// the ones they were making because they were overpriced (flushes), which lifted
// the average best hand on a fresh 4x4 board from 274 to 328, about +20%.
// Measured over 800 deals each way. Left at 1000 the first round would clear in
// ~3.0 best hands instead of ~3.6, i.e. the whole game would quietly get easier
// as a side effect of fixing the price list. 1200 holds the old pace.
// r278: retuned from the Monte Carlo bot sweep (tools/sim, SCORE_SCALING.md).
// Base 1500 opens a touch firmer, growth runs 32% a round through round 12 and
// then 45% a round from GOAL_LATE_START on, so the run gets a forgiving first
// half and a back half that can actually kill it. The greedy bot wins ~37% at
// these numbers against ~57% at 1500/30%; a real player lands well above both.
const BASE_GOAL = 1500;
const GOAL_SCALE = 1.32;
const GOAL_SCALE_LATE = 1.45;  // growth once the late curve takes over
const GOAL_LATE_START = 13;    // first level that grows at GOAL_SCALE_LATE
const TRICK_CARD_INTERVAL = 20; // seconds

function suitClass(suit) {
  return COLOR_CLASS[suit]
      || { '♥':'suit-hearts', '♦':'suit-diamonds', '♠':'suit-spades', '♣':'suit-clubs', '♛':'suit-crowns', '☾':'suit-moons',
           '★':'suit-stars', '▲':'suit-triangles' }[suit] || '';
}

// Central card capability gate - add new card types here, nowhere else
function cardCan(card, action) {
  if (!card) return false;
  if (card._isStone) {
    // Stones can be drawn, fall, render, and be swapped. Nothing else.
    return action === 'fall' || action === 'render' || action === 'swap' || action === 'draw';
  }
  if (card._isTrick) {
    // Tricks fall, render, and swap like normal cards - but can't be selected, scored, or discarded
    return action === 'fall' || action === 'render' || action === 'swap';
  }
  if (card._isSleight) {
    // Aim sleights are fixtures: fall & render only - never swapped, discarded, or selected
    // (so a single tap is free to rotate aim).
    if (AIM_SLEIGHTS.has(sleightDef(card)?.id)) return action === 'fall' || action === 'render';
    // INERT (r341): a used Piggy Bank / Capacitor stays on the grid and can no longer
    // be swapped or discarded. Selecting it into a hand is its one way off the board.
    if (card._inert) return action === 'fall' || action === 'render' || action === 'select';
    return action === 'fall' || action === 'render' || action === 'swap' || action === 'select' || action === 'discard';
  }
  if (card.isChallenge) {
    return action === 'render';
  }
  // Snared curse: the card is stuck - no swapping or discarding until it lifts
  if (card.rank && typeof cardCurses !== 'undefined' && cardCurses[cardKey(card.rank, card.suit)]?.id === 'snared'
      && (action === 'swap' || action === 'discard')) return false;
  // The Recall: cards of the withdrawn rank sit on the board doing nothing.
  if (typeof isCardRecalled === 'function' && isCardRecalled(card)) return action === 'fall' || action === 'render';
  // Normal cards can do everything
  return true;
}

// ── TRICK POOL (subset for prototype) ──
