// ══════════════════════════════════════════════════════════════════════════
// THE DAILY GRIDS (r311) - 3x3 and 4x4 Poker Squares
//
// Poker Squares' small siblings, shaped like a daily puzzle rather than a run.
// You are handed EVERY tile at the start, you pack them at your leisure, and
// you submit once. Three grids, and that is the whole game.
//
// Three things are deliberately NOT the 5x5's:
//
//  * NO TURNS. The 5x5 deals 3 tiles four times, so it is a game of reacting to
//    what arrives. These are given whole, which makes them a PUZZLE: full
//    information, one commit, and a right answer that exists.
//  * A SURPLUS OF TILES. 12 cells of tiles for 9 cells of board (3x3) and 19 for
//    16 (4x4). What you leave out is as much of the decision as what you place.
//  * NO PIPS x MULT. A line pays its HAND BASE plus the VALUE of its cards
//    (ace 5, court 3, everything else 1) and nothing multiplies. There are no
//    Tricks here at all, so two people playing the same board are comparable,
//    which is the point of a daily.
//
// See "The daily grids" in CLAUDE.md for the measurements behind the tables.
// ══════════════════════════════════════════════════════════════════════════

// THE INVENTORY IS THE LEVEL. These counts are the owner's, and they are what
// decides whether a board is a packing puzzle or a formality: the surplus is 3
// cells in both, so there is always more than one legal packing and never so
// much slack that the shape stops mattering.
// EVERY GRID GETS AN L AND A BAR (r340, owner's call). The two trominoes ask
// opposite questions - a bar commits three cells of ONE line, an L commits a
// cell to two lines at once - so a deal holding one of each always contains
// both kinds of decision. `forms` indexes SQ_SHAPES[size]: at size 3 that is
// [bar, L]. A row with no `forms` is drawn from the weighted bag as before.
//
// The 3x3 trades a domino and a single for the second tromino, so the CELL
// COUNT and the 3-cell surplus are unchanged.
const SQD_SIZES = {
  3: { grids: 3, inv: [{ size: 3, n: 2, forms: [0, 1] }, { size: 2, n: 2 }, { size: 1, n: 2 }] }, // 12 cells -> 9
  4: { grids: 3, inv: [{ size: 3, n: 2, forms: [0, 1] }, { size: 2, n: 4 }, { size: 1, n: 5 }] }, // 19 cells -> 16
};
const sqdSizes = () => Object.keys(SQD_SIZES).map(Number);
// A DAILY grid is any size the table knows about. The 5x5 is the original mode
// and keeps its turns, its Tricks and its pips x mult.
function sqDaily() { return !!(typeof squaresActive === 'function' && squaresActive() && SQD_SIZES[SQ_N]); }

// ── SETTINGS (r340) - dev panel -> Squares ─────────────────────────────────
// OVERRIDES ONLY, in localStorage, which is the r197 goal-tuner rule: an
// untouched knob tracks whatever this file ships, and setting a field back to
// its shipped value DELETES the override rather than pinning today's number for
// ever. It is TUNING, so it is deliberately not in SAVE_VARS.
const SQ_CFG_KEY = 'lethe.squares.v1';
const SQ_CFG_DEF = {
  cardScore:    'tier',  // 'tier' (A 3 / court 2 / else 1) | 'rank' (pip value) | 'none'
  rankVary:     true,    // the rank window follows SQD_RANK_SCHEDULE, one entry per grid
  rankSpread:   7,       // the flat window width used when rankVary is off
  wildPerGrid:  1,       // how many wilds a grid carries WHEN it carries any
  wildChance:   60,      // % chance a given grid carries one at all
  wildMinRun:   1,       // ... but at least this many grids of a run must
  wildValue:    false,   // does a wild pay a card value of its own
  qualifyLines: 4,       // a qualifying packing scores at least this many lines (0 = off)
  qualifyDeep:  3,       // ... of which this many use THREE cards, not a pair and a spare
  qualifyCover: 67,      // ... and this % of the cards are in a hand that is not a High Card
  qualifyMixes: 2,       // redeal unless this many DIFFERENT qualifying hand mixes exist
  qualifyKinds: 0,       // ... and the best packing makes this many DISTINCT hands (0 = off)
  qualifySpread: 80,     // ... and an ARBITRARY packing is below this % of par (0 = off)
  qualifyTries: 6,       // deals to try before keeping the best one seen
};
// At most this many DISTINCT qualifying mixes are counted. The number only has
// to tell "one way" from "several", so there is no reason to hold more.
const SQD_Q_MIX_CAP = 64;
let sqCfgOver = {};
function sqCfgLoad() { try { sqCfgOver = JSON.parse(localStorage.getItem(SQ_CFG_KEY) || '{}') || {}; } catch (e) { sqCfgOver = {}; } }
function sqCfgSave() { try { localStorage.setItem(SQ_CFG_KEY, JSON.stringify(sqCfgOver)); } catch (e) {} }
function sqCfg(k) { return sqCfgOver[k] !== undefined ? sqCfgOver[k] : SQ_CFG_DEF[k]; }
function sqCfgSet(k, v) { if (v === SQ_CFG_DEF[k]) delete sqCfgOver[k]; else sqCfgOver[k] = v; sqCfgSave(); }
function sqCfgReset() { sqCfgOver = {}; sqCfgSave(); }
sqCfgLoad();

// ── THE RANK WINDOW, PER GRID (r340, rescheduled r342) ─────────────────────
// A daily's cards are drawn from a CONTIGUOUS run of ranks rather than all
// thirteen. That is the cheapest lever on "make a grid likelier to score":
// every hand here is a coincidence between two cards' ranks or suits, and
// narrowing the ranks raises the odds of BOTH a set and a run at once, with no
// redeal loop and nothing to measure. Measured over 200 exhaustively-walked
// 3x3 deals, share that can make four scoring lines: 76% at 13 ranks, 94% at 7,
// 100% at 5.
//
// CONTIGUOUS, NOT A RANDOM SUBSET, and that is load-bearing: a scatter of seven
// ranks would lift sets and KILL runs.
//
// THE WIDTH IS A SCHEDULE NOW (owner's call), one entry per grid, so the three
// grids of a run are three different puzzles rather than three draws from one
// distribution: grid 1 is any width at all, grid 2 is tight, grid 3 is middling.
const SQD_RANK_LADDER = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SQD_WIDTH_MIN = 5, SQD_WIDTH_MAX = 13;
// `any` is EVERY WIDTH EQUALLY - "the other has an equal chance for anything",
// listed beside two entries that name widths, so it is read as a width too. If
// it was meant as "all thirteen ranks", that is `pick: [13]`.
const SQD_RANK_SCHEDULE = [
  { any: true },      // grid 1
  { pick: [5, 7] },   // grid 2
  { pick: [7, 9] },   // grid 3
];
let sqdRanks = null;
function sqdRankWindow() { return sqdRanks && sqdRanks.length ? sqdRanks : SQD_RANK_LADDER; }
// The width this grid is asking for. Off the end of the schedule - or with the
// schedule switched off - every grid takes the flat `rankSpread` knob.
function sqdRankWidth(grid) {
  if (!sqCfg('rankVary')) return sqCfg('rankSpread') | 0;
  const row = SQD_RANK_SCHEDULE[(grid | 0) - 1];
  if (!row) return sqCfg('rankSpread') | 0;
  if (row.pick) return row.pick[Math.floor(Math.random() * row.pick.length)];
  return SQD_WIDTH_MIN + Math.floor(Math.random() * (SQD_WIDTH_MAX - SQD_WIDTH_MIN + 1));
}
// THE NARROWEST WINDOW THIS BOARD CAN ACTUALLY BE DEALT FROM. A window of w
// ranks holds w x suits cards, and a grid needs every cell of its inventory out
// of that - so too narrow a window runs dry mid-deal and `sqDraw` falls through
// to an ordinary draw, which puts a rank on the board the grid was supposed to
// exclude. Measured before this clamp: 21 stray cards in 2,160, all of them at
// the tightest widths. The +2 is slack for the wild swap and for a suit the
// shuffle happens to bury.
function sqdMinWidth() {
  const spec = SQD_SIZES[SQ_N];
  const cells = spec ? spec.inv.reduce((t, r) => t + r.n * r.size, 0) : SQ_N * SQ_N;
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS.length : 4;
  return Math.max(3, Math.ceil((cells + 2) / suits));
}
function sqdRollRankWindow(grid) {
  const n = Math.max(sqdMinWidth(), Math.min(SQD_RANK_LADDER.length, sqdRankWidth(grid)));
  const at = Math.floor(Math.random() * (SQD_RANK_LADDER.length - n + 1));
  return SQD_RANK_LADDER.slice(at, at + n);
}
// Called at the top of every grid. It moves the WINDOW, never the deck.
function sqdNewGridWindow(grid) { sqdRanks = sqdRollRankWindow(grid); return sqdRanks; }

// ── THE DECK IS THE WHOLE LADDER, AND THE WINDOW IS A FILTER ON THE DRAW ───
// The window varies per grid and the deck must NOT, because "the deck belongs
// to the run" is what makes a consumable's edit permanent: the board holds the
// same card OBJECTS the piles do, so rebuilding the deck between grids would
// throw away every re-suit and every forge. Installing all thirteen ranks once
// and letting `sqDraw` skip what this grid's window excludes keeps every object
// alive and costs one scan of the pile per card.
function sqdInstallDeck() {
  sqdNewGridWindow(1);
  // THE BOARD `startGame` DEALT IS NOT PART OF THIS DECK. `sqNewRound` returns
  // every occupied cell to the played pile and flushes, so leaving the opening
  // 5x5 board in place would tip a handful of full-deck cards into it.
  if (typeof gridData !== 'undefined' && Array.isArray(gridData))
    for (let r = 0; r < gridData.length; r++)
      if (gridData[r]) for (let c = 0; c < gridData[r].length; c++) gridData[r][c] = null;
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : ['♠','♥','♦','♣'];
  const stamp = (typeof stampId === 'function') ? stampId : (c => c);
  const d = [];
  for (const s of suits) for (const r of SQD_RANK_LADDER) d.push(stamp({ rank: r, suit: s }));
  // The wild lives in the DECK, not beside it, so every pile function, the deck
  // audit and the HUD count keep working untouched. Whether a GRID gets one is
  // `sqdWildsThisGrid`'s roll and `sqdForceWilds`'s job at deal time.
  for (let i = 0; i < Math.max(0, sqCfg('wildPerGrid') | 0); i++) d.push(stamp({ rank: WILD_RANK, suit: WILD_SUIT }));
  drawPile = (typeof deckShuffle === 'function') ? deckShuffle(d) : d;
  playedPile = [];
  sqdWildGrids = 0;
  if (typeof expectedDeckTotal !== 'undefined') expectedDeckTotal = d.length;
  if (typeof updateDeckHud === 'function') updateDeckHud();
}
// Is this card one this grid may be dealt? A wild is always allowed - it has no
// rank to be outside the window.
function sqdInWindow(card) {
  if (!card) return false;
  if (sqdIsWild(card)) return true;
  return sqdRankWindow().indexOf(card.rank) >= 0;
}
// THE WINDOW-AWARE DRAW. Cards outside the window are SET ASIDE and put back
// after the deal, never discarded - they are the run's own cards and a later
// grid will want them. Falls through to an ordinary draw if the window somehow
// cannot be satisfied, because a deal that stops half way is worse than a deal
// with one stray rank in it.
function sqdDrawInWindow() {
  const aside = [];
  let card = null;
  for (let pass = 0; pass < 2 && !card; pass++) {
    while (drawPile.length) {
      const c = drawPile.shift();
      if (sqdInWindow(c)) { card = c; break; }
      aside.push(c);
    }
    if (!card && typeof flushPlayedDeck === 'function' && playedPile.length) flushPlayedDeck();
  }
  while (aside.length) drawPile.push(aside.pop());
  if (!card) return null;
  if (typeof stampId === 'function') card = stampId(card);
  if (typeof updateDeckHud === 'function') updateDeckHud();
  return card;
}

// ── HOW OFTEN A GRID CARRIES A WILD (r342) ─────────────────────────────────
// Owner: "give it only a 60% chance of appearing in any single grid, with one
// grid minimum across the 3". So it is a roll per grid, plus a floor: if the
// last grid comes round and none has turned up, that one gets it. The floor
// fires on 0.4^3 = 6.4% of runs.
let sqdWildGrids = 0;
function sqdWildsThisGrid(grid) {
  const per = Math.max(0, sqCfg('wildPerGrid') | 0);
  if (!per) return 0;
  const grids = (SQD_SIZES[SQ_N] && SQD_SIZES[SQ_N].grids) || 3;
  if (Math.random() * 100 < (sqCfg('wildChance') | 0)) return per;
  // The floor: last grid of the run and the wild has not been seen yet.
  if (sqCfg('wildMinRun') && sqdWildGrids < (sqCfg('wildMinRun') | 0) && grid >= grids) return per;
  return 0;
}
const sqdIsWild = c => !!(c && typeof isWildCard === 'function' && isWildCard(c));

// ── CARD VALUE ─────────────────────────────────────────────────────────────
// Three modes, dev-switchable. A line pays its hand base PLUS these, so even a
// line that makes nothing still pays something - that floor is what stops a
// dead row reading as a wasted row, and turning it off (`none`) is what makes
// the grid purely about the hands.
//
//  tier  A 3 / court 2 / everything else 1   (the default)
//  rank  the card's own pip value            (2-10, court 10, ace 11)
//  none  nothing at all
//
// A WILD PAYS NOTHING by default. It already completes a hand in its ROW and
// its COLUMN at once, which is two payouts from one cell; paying it a value on
// top is a third. `wildValue` turns it on at the top tier.
function sqdCardValue(rank) {
  if (typeof isWildRank === 'function' && isWildRank(rank)) return sqCfg('wildValue') ? 3 : 0;
  const m = sqCfg('cardScore');
  if (m === 'none') return 0;
  if (m === 'rank') {
    const p = (typeof RANK_PIPS !== 'undefined' && RANK_PIPS[rank] != null) ? RANK_PIPS[rank] : parseInt(rank, 10);
    return Number.isFinite(p) ? p : 10;
  }
  if (rank === 'A') return 3;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 2;
  return 1;
}

// ── THE HAND TABLES ────────────────────────────────────────────────────────
// COMPRESSED, IN POKER'S ORDER (r340, owner's call). The r312 table was the
// published PAIR PLUS / ACES UP pay tables x10, which is the right ORDER and
// the wrong SPREAD for a board this small: trips at 300 against a pair at 10
// meant one lucky line was most of a grid, and the tally stopped being a
// readable ladder. These are the same ORDER - so a three-card straight still
// beats a three-card flush, and on four cards Three of a Kind still outranks
// Run of 4, both of which are real poker rather than anything this game
// invented - at numbers a player can hold in their head.
//
// The order comes from exact counts over a real deck:
//
//   3 CARDS, C(52,3) = 22,100      4 CARDS, C(52,4) = 270,725
//   Straight Flush     48 (1:460)  Four of a Kind     13 (1:20,825)
//   Three of a Kind    52 (1:425)  Straight Flush     44 (1:6,153)
//   Straight          720 (1:31)   Three of a Kind 2,496 (1:108)
//   Flush           1,096 (1:20)   Straight        2,772 (1:98)
//   Pair            3,744 (1:6)    Two Pair        2,808 (1:96)
//                                  Flush           2,816 (1:96)
//                                  Pair           82,368 (1:3)
//
// THE FOUR-CARD TABLE ALSO PRICES THE SHORT HANDS. A 4-line that makes only a
// three-card run or flush scores it, and the fourth card scores NOTHING - no
// value, no penalty (owner's call). They are priced BELOW the four-card version
// of the same shape, which is what stops a short hand ever being the thing you
// aim at.
//
// EACH SHORT HAND IS PRICED BELOW THE FOUR-CARD VERSION OF ITS OWN SHAPE, which
// is what stops one ever being the thing you aim at: a Flush of 3 is 5 against
// a Flush of 4's 15, a Run of 3 is 10 against a Run of 4's 20. They are an
// escape valve for a line that did not come together, not a target.
//
// A THREE-CARD SUBSET THAT IS BOTH A RUN AND A FLUSH IS PAID AS A RUN, not as a
// Straight Flush: the 120 on that row is the price of a FOUR-card straight
// flush, and handing it to three suited cards inside a 4-line would make the
// jackpot of the mode its commonest big hand.
const SQD_PAY = {
  3: { 'High Card': 0, 'Pair': 5, 'Flush of 3': 10, 'Run of 3': 15,
       'Three of a Kind': 25, 'Straight Flush': 50 },
  4: { 'High Card': 0, 'Pair': 5, 'Flush of 3': 5, 'Two Pair': 10, 'Run of 3': 10,
       'Flush of 4': 15, 'Run of 4': 20, 'Three of a Kind': 25,
       'Four of a Kind': 80, 'Straight Flush': 120 },
};
// The numbers ARE the numbers now - the r312 x10 scale is gone with the spread
// it existed to create.
const SQD_BASE = SQD_PAY;
// The ladder, weakest first, for the tally's worst-to-best order. DERIVED from
// the pay table rather than written out beside it, so the order a line is read
// in can never disagree with what it paid. Ties break by name so the order is
// stable between loads.
const SQD_LADDER = (() => {
  const out = {};
  for (const n of Object.keys(SQD_PAY)) {
    out[n] = Object.keys(SQD_PAY[n]).sort((a, b) => (SQD_PAY[n][a] - SQD_PAY[n][b]) || a.localeCompare(b));
  }
  return out;
})();
// Which hands a board of this size can actually make, weakest first - what the
// pay-table pop-up prints and what the report's hand mix is read against.
const sqdPayRows = n => (SQD_LADDER[n] || []).map(h => ({ name: h, base: SQD_PAY[n][h] }));

// ── NAMING A LINE ──────────────────────────────────────────────────────────
// NOT `sqHandName`, which gates runs and flushes on `cards.length >= 5` -
// correct for the 5x5, and it would call every line here a High Card.
//
// `sqdNameNatural` is the whole-line namer for cards with no wild in them.
function sqdNameNatural(cards) {
  const n = cards.length;
  if (n < 2) return 'High Card';
  const vs = cards.map(sqRank).sort((a, b) => a - b);
  const fl = cards.every(c => c.suit === cards[0].suit);
  const con = a => a.every((v, i) => i === 0 || v === a[i - 1] + 1);
  const distinct = new Set(vs).size === n;
  // THE ACE RUNS BOTH WAYS, and until r340 it never did. `sqRank` reads the
  // game's own RANK_ORDER, where an ace is 1, so the `=== 14` these lines used
  // to test for could not fire and Q-K-A came out a Flush of 3. A-2-3 works on
  // the 1, so it is only the HIGH ace that has to be put back by hand.
  let run = distinct && con(vs);
  if (!run && distinct && vs[0] === sqAceLow()) run = con([...vs.slice(1), sqAceHigh()]);
  const cnt = {}; cards.forEach(c => cnt[c.rank] = (cnt[c.rank] || 0) + 1);
  const cv = Object.values(cnt).sort((a, b) => b - a);
  if (fl && run)  return 'Straight Flush';
  if (cv[0] >= 4) return 'Four of a Kind';
  if (cv[0] >= 3) return 'Three of a Kind';
  if (run)        return 'Run of ' + n;
  if (fl)         return 'Flush of ' + n;
  if (cv[0] >= 2 && cv[1] >= 2) return 'Two Pair';
  if (cv[0] >= 2) return 'Pair';
  return 'High Card';
}
// The ace's two faces, read off the live table rather than written down - the
// r340 bug was exactly a hardcoded 14 disagreeing with RANK_ORDER.
const sqAceLow  = () => (typeof RANK_ORDER !== 'undefined' && RANK_ORDER.A != null) ? RANK_ORDER.A : 1;
const sqAceHigh = () => sqAceLow() + SQD_RANK_LADDER.length;

// ── THE WILD (r340) ────────────────────────────────────────────────────────
// One per grid. On EVERY line it sits in it takes whatever rank and suit make
// that line worth most - independently for its row and for its column, because
// the two lines are scored as separate hands and nothing says a card must mean
// the same thing in both.
//
// SUITS DO NOT NEED ENUMERATING, AND THAT IS WHAT MAKES THIS CHEAP. A suit only
// ever enters a hand's name through "are they all the same", so the wild's best
// suit is the naturals' shared suit when they have one and is irrelevant when
// they do not. So the search is over RANKS alone - at most the rank window, 7
// by default - rather than over ranks x suits.
function sqdNameWithWild(cards, n) {
  const nat = cards.filter(c => !sqdIsWild(c));
  const w = cards.length - nat.length;
  if (!w) return sqdNameNatural(cards);
  const suit = (nat.length && nat.every(c => c.suit === nat[0].suit)) ? nat[0].suit
             : (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS[0]) || '♠';
  const tbl = SQD_BASE[n] || {};
  let best = null, bestV = -1;
  // THE WHOLE LADDER, not this grid's window. A wild "takes any rank", and at
  // the window's edge the only rank that completes a run can be one outside it
  // - so searching the window would make the wild quietly weaker on some boards
  // and not others. Thirteen iterations instead of seven; nothing notices.
  for (const r of SQD_RANK_LADDER) {
    const fill = []; for (let k = 0; k < w; k++) fill.push({ rank: r, suit });
    const name = sqdNameNatural(nat.concat(fill));
    const v = tbl[name] || 0;
    if (v > bestV) { bestV = v; best = name; }
  }
  return best || 'High Card';
}

// THE SHORT HANDS. On a 4-line only: the best three-card run and the best
// three-card flush inside it, each paying its own base plus the value of ITS
// OWN THREE CARDS. The fourth card contributes nothing either way.
//
// A LINE TAKES WHICHEVER IS WORTH MOST - the whole-line hand or a short one -
// so a short hand can never make a line worse than it already was. Same
// question `sqScoreLine` asks on the 5x5 and the same one `findBestHand` asks
// in the main game.
function sqdShortHands(cards, n) {
  const out = [];
  if (n < 4 || cards.length < 4) return out;
  const tbl = SQD_BASE[n] || {};
  if (!tbl['Run of 3'] && !tbl['Flush of 3']) return out;
  const idx = cards.map((_, i) => i);
  // every 3-subset of a 4-line is four subsets; enumerating beats being clever
  for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) for (let c = b + 1; c < idx.length; c++) {
    const sub = [cards[a], cards[b], cards[c]];
    const name = sqdNameWithWild(sub, 3);
    // Only the two SHORT shapes; a pair or trips inside a 4-line is already
    // named by the whole-line hand, and taking it here would only ever throw
    // the fourth card's value away for nothing.
    let pay = null;
    if (name === 'Run of 3' || name === 'Straight Flush') pay = 'Run of 3';
    else if (name === 'Flush of 3') pay = 'Flush of 3';
    if (!pay || !tbl[pay]) continue;
    out.push({ name: pay, cards: sub });
  }
  return out;
}

function sqdHandName(cards) { return sqdNameWithWild(cards, cards.length); }
const sqdHandRank = (n, name) => (SQD_LADDER[n] || []).indexOf(name);

// ── BOONS ──────────────────────────────────────────────────────────────────
// Between grids you are GRANTED one at random (owner's call - no choice, no
// picking the line). They ACCUMULATE, so grid 1 is plain, grid 2 carries one
// and grid 3 carries two: the run escalates without the player steering it.
let sqdBoons = [];                 // [{ kind:'dbl'|'plus2', line }]
const SQD_BOON_PER_CARD = 2;
// THE BOON LIST IS A PARAMETER (r340). It defaults to the live one, which is
// every caller in play - but the end-of-run report re-scores a grid that was
// played two boons ago, and reading the live list there would score grid 1
// under grid 3's boosts and quietly disagree with the number it printed at the
// time. Each grid therefore snapshots its own.
function sqdBoonsOn(i, boons) {
  const src = boons || sqdBoons;
  const b = { dbl: false, perCard: 0 };
  src.forEach(x => { if (x.line !== i) return;
    if (x.kind === 'dbl') b.dbl = true; else b.perCard += SQD_BOON_PER_CARD; });
  return b;
}
function sqdBoonLabel(b) {
  if (b.kind === 'cons') return 'A consumable';
  const where = sqLineName(b.line);
  return b.kind === 'dbl' ? `${where} scores DOUBLE` : `${where}: every card +${SQD_BOON_PER_CARD}`;
}
// Rolled fresh each time. A line boon never lands on a line that already has
// one of its own kind - stacking two doubles on one row is a much bigger swing
// than the roll is meant to be, and it reads as the game repeating itself.
function sqdRollBoon() {
  const kinds = ['dbl', 'plus2', 'cons'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  if (kind === 'cons') return { kind: 'cons' };
  const taken = new Set(sqdBoons.filter(b => b.kind === kind).map(b => b.line));
  const free = [];
  for (let i = 0; i < SQ_N * 2; i++) if (!taken.has(i)) free.push(i);
  const line = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * SQ_N * 2);
  return { kind, line };
}
function sqdGrantBoon(b) {
  if (b.kind === 'cons') {
    if (sqCons.length >= SQ_CONS_CAP) return { ...b, full: true };
    const d = SQ_CONS[Math.floor(Math.random() * SQ_CONS.length)];
    const rolled = sqRollCons(d.id);
    sqCons.push(rolled);
    return { ...b, def: d, rolled };
  }
  sqdBoons.push(b);
  return b;
}

// ── SCORING ────────────────────────────────────────────────────────────────
// Base + card values, then the line's boons. `+N per card` lands INSIDE the
// doubling, because a boon on a doubled line should be worth double too - that
// is the only reading under which the two boons compose rather than fight.
function sqdScoreCards(cards, i, boons) {
  const n = SQ_N;
  const tbl = SQD_BASE[n] || {};
  const val = cs => cs.reduce((t, c) => t + sqdCardValue(c.rank), 0);
  // The whole line, kickers and all.
  let best = { name: sqdNameWithWild(cards, cards.length), used: cards };
  best.base = tbl[best.name] || 0;
  best.pips = val(cards);
  // A SHORT HAND IS A SECOND CANDIDATE, NEVER AN OVERRIDE. It pays its own base
  // plus the value of its own cards; the cards it leaves out score nothing and
  // are not billed either.
  for (const alt of sqdShortHands(cards, n)) {
    const cand = { name: alt.name, used: alt.cards, base: tbl[alt.name] || 0, pips: val(alt.cards) };
    if (cand.base + cand.pips > best.base + best.pips) best = cand;
  }
  const b = sqdBoonsOn(i, boons);
  const bonus = b.perCard * best.used.length;
  const total = (best.base + best.pips + bonus) * (b.dbl ? 2 : 1);
  return { name: best.name, base: best.base, pips: best.pips, bonus, dbl: b.dbl,
           used: best.used, short: best.used.length < cards.length, total };
}
function sqdScoreLine(i, boons) {
  const cells = sqLineCells(i).filter(([r, c]) => gridData[r] && gridData[r][c]);
  const cards = cells.map(([r, c]) => gridData[r][c]);
  if (!cards.length) return { i, name: 'High Card', base: 0, pips: 0, bonus: 0, dbl: false, total: 0, cells, cards, r: 0 };
  const sc = sqdScoreCards(cards, i, boons);
  return { i, ...sc, cells, cards, r: sqdHandRank(SQ_N, sc.name) };
}
// Score a FLAT BOARD (row-major array of cards or nulls) the way the tally
// would. One function, so the par search, the end-of-run report and the
// comparison view can never disagree about what a board was worth.
function sqdScoreBoard(board, n, boons) {
  let total = 0; const lines = [];
  for (let i = 0; i < n * 2; i++) {
    const cards = [];
    for (let k = 0; k < n; k++) {
      const c = i < n ? board[i * n + k] : board[k * n + (i - n)];
      if (c) cards.push(c);
    }
    if (!cards.length) { lines.push({ i, name: 'High Card', total: 0 }); continue; }
    const sc = sqdScoreCards(cards, i, boons);
    total += sc.total; lines.push({ i, ...sc });
  }
  return { total, lines };
}

// ── THE DEAL ───────────────────────────────────────────────────────────────
// Every tile at once, from the run's own deck, through the 5x5's weighted shape
// bag - so the straight piece stays the rarest 3-tile here too.
function sqdDealAll() {
  const spec = SQD_SIZES[SQ_N]; if (!spec) return [];
  const out = [];
  spec.inv.forEach(row => {
    if (row.forms) for (let i = 0; i < row.n; i++) out.push(sqMakePiece(row.size, null, row.forms[i % row.forms.length]));
    else out.push(...sqDealPieces(row.n, row.size));
  });
  // THE TRAY REMEMBERS WHERE EACH TILE SAT. Playing one used to slide every
  // tile after it along, so the tile you were about to reach for moved out from
  // under your finger - and on a puzzle you solve by looking at the whole hand
  // at once, a hand that reshuffles itself every move is a hand you have to
  // re-read every move. A slot is fixed until the player moves it.
  out.forEach((p, i) => { p.slot = i; });
  return out;
}
// Hand a rejected deal back. The cards go to the PLAYED pile and are reshuffled
// in, which is also what gives the next attempt a different draw. A wild goes
// back to the RESERVE instead - see sqdQualifiedDeal.
function sqdReturnPieces(pieces, reserve) {
  pieces.forEach(p => p.cells.forEach(cl => {
    if (!cl.card) return;
    if (reserve && sqdIsWild(cl.card)) reserve.push(cl.card); else playedPile.push(cl.card);
  }));
  if (typeof flushPlayedDeck === 'function') flushPlayedDeck();
}

// ── ONE WILD IN EVERY GRID (r340) ──────────────────────────────────────────
// The wild is an ordinary member of the deck, so whether it is DEALT is luck.
// "One per grid" is not luck, so a deal short of its quota pulls a wild out of
// the piles and swaps it in for an ordinary dealt card, which goes back. Net
// effect on the deck is zero and every pile function is untouched.
function sqdForceWilds(pieces, reserve, want) {
  if (want == null) want = Math.max(0, sqCfg('wildPerGrid') | 0);
  const cells = [];
  pieces.forEach(p => p.cells.forEach(cl => cells.push(cl)));
  let have = cells.filter(cl => sqdIsWild(cl.card)).length;
  // A WILD CAN ALSO ARRIVE BY LUCK, and a quota is a quota in both directions.
  // The wild is an ordinary member of the deck, so a grid that rolled NO wild
  // could still be dealt one - measured at 88% of grids carrying one against a
  // 60% roll. Over the quota it is swapped back out for an ordinary card.
  while (have > want) {
    const at = cells.find(cl => sqdIsWild(cl.card));
    const sub = sqdDrawInWindow();
    if (!sub) break;                       // nothing to swap in; leave it be
    if (reserve) reserve.push(at.card); else playedPile.push(at.card);
    at.card = sub;
    have--;
  }
  if (!want) return;
  while (have < want) {
    const w = (reserve && reserve.length) ? reserve.shift() : sqdTakeWildFromPiles();
    if (!w) break;
    const plain = cells.filter(cl => !sqdIsWild(cl.card));
    if (!plain.length) { if (reserve) reserve.push(w); else playedPile.push(w); break; }
    const at = plain[Math.floor(Math.random() * plain.length)];
    playedPile.push(at.card);
    at.card = w;
    have++;
  }
}
function sqdTakeWildFromPiles() {
  let i = drawPile.findIndex(c => sqdIsWild(c));
  if (i >= 0) return drawPile.splice(i, 1)[0];
  i = playedPile.findIndex(c => sqdIsWild(c));
  if (i >= 0) return playedPile.splice(i, 1)[0];
  return null;
}

// ── QUALIFYING THE DEAL (r340) ─────────────────────────────────────────────
// The rank window makes a deal likelier to score; this catches the tail it
// cannot. Deal, run par, and ask what the BEST PACKING ACTUALLY MADE - which
// the search already reports - then throw the deal away and try again unless it
// offers enough different hands to be a decision rather than a formality.
//
// IT COSTS ALMOST NOTHING NEW, and that is why it is worth having: par is
// computed at deal time either way (r311 - the deal animation is the one place
// a ~100ms search can hide), so a rejected attempt is one extra par search.
//
// THE LOSER IS RETURNED, THE LEADER IS HELD. Each attempt draws most of the
// deck, so two attempts cannot be in hand at once - the running best stays in
// hand and everything else goes back before the next deal.
function sqdKindCount(lines) {
  if (!lines || !lines.length) return 0;
  return new Set(lines.filter(n => n && n !== 'High Card')).size;
}

// ── WHAT MAKES A DEAL WORTH PLAYING (r340) ─────────────────────────────────
// Owner, on a 3x3 that could not make a single run: "ensure somewhere in the
// grid is a choice the user has to make about whether to score this type or
// that". That is the right thing to constrain and the reason the obvious fix -
// forcing the L's own three cards to carry adjacent ranks - was not taken: it
// constrains the CONTENT of a tile rather than the SHAPE OF THE DECISION, and
// it would make every L feel the same.
//
// The L is genuinely the culprit, though, and it is worth writing down WHY,
// because it is structural rather than bad luck. An L's corner card shares its
// ROW with one of its two mates and its COLUMN with the other. On a 3x3 a line
// is three cells, so the corner's row is {corner, mate, one free cell} - there
// is exactly ONE card left to choose, in both of its lines at once. A card in
// the middle of a bar is not constrained that way at all: the bar takes a whole
// line, and its other two lines each have two free cells.
//
// FOUR GATES, all read off the search that runs at deal time anyway:
//
//  REACH   some packing makes at least N lines score at all. This is the
//          owner's "can this grid score 4 three-card lines? If not, move on",
//          and it is the one that would have thrown out the reported board.
//  KINDS   the best packing makes at least N DIFFERENT hands, so the grid is
//          not one shape repeated.
//  SPREAD  an ARBITRARY packing is meaningfully below par. If any old
//          arrangement scores nearly as well as the best one, where you put the
//          tiles does not matter and the grid is not a puzzle.
//  MIXES   several near-par packings make DIFFERENT hands. This is the "this or
//          that" one: two ways to score well that are not the same way.
//
// WHAT THIS CANNOT DO, said plainly. On a 3x3 the walk is exhaustive, so all
// four are exact. On a 4x4 there are over eight million packings and the search
// is a beam: REACH, KINDS and MIXES are read from the boards the beam actually
// finished, which are the GOOD end of the space, so REACH can only under-report
// (a board it rejects might have made another line some packing it never
// visited) and MIXES is a sample. SPREAD needs an unbiased baseline and gets
// its own short random walk. A 4x4 is also far less likely to be starved: eight
// lines of four, with 19 cells of tiles for 16 of board.
function sqdRandomMean(N, pieces, n) {
  // An ARBITRARY legal packing, several times over - the baseline SPREAD is
  // measured against. Deliberately not the beam's boards: those are the ones a
  // search chose, and comparing par against a sample of near-par boards would
  // say every grid is a formality.
  // A SMALL LEAF CAP, not a long budget: the budget is only tested BETWEEN
  // restarts, so one uncapped 4x4 restart can outrun it several times over.
  const r = sqdSearchPar(N, pieces, { budgetMs: 40, leafCap: 400 });
  return { mean: r.mean || 0, max: r.best || 0, maxScoring: r.maxScoring || 0 };
}
function sqdGates(par, N, pieces) {
  const g = {
    qual:   par.qual || 0,          // arrangements that clear all three at once
    lines:  par.maxScoring || 0,    // reported, not gated - the best reach seen
    kinds:  sqdKindCount(par.lines),
    mixes:  par.mixes || 0,         // DISTINCT hand mixes among the qualifying ones
    spread: 0,
  };
  if (par.best > 0) {
    const mean = par.surveyed ? par.mean : sqdRandomMean(N, pieces).mean;
    g.spread = Math.round(100 * (1 - mean / par.best));
  }
  g.wantKinds  = sqCfg('qualifyKinds')  | 0;
  g.wantMixes  = Math.max(1, sqCfg('qualifyMixes') | 0);
  g.wantSpread = 100 - (sqCfg('qualifySpread') | 0);   // "an arbitrary packing is below 80% of par"
  g.ok = g.qual >= 1 && g.mixes >= g.wantMixes
      && g.kinds >= g.wantKinds && g.spread >= g.wantSpread;
  // ONE NUMBER TO RANK BY, for the case where no attempt passes and the best of
  // a bad lot has to be kept. Each gate contributes how far it got, capped at
  // what was asked for, so overshooting one does not pay for missing another.
  const cap = (v, w) => w > 0 ? Math.min(v, w) / w : 1;
  g.rank = cap(g.qual, 1) + cap(g.mixes, g.wantMixes)
         + cap(g.kinds, g.wantKinds) + cap(g.spread, g.wantSpread);
  return g;
}

function sqdQualifiedDeal() {
  const tries = Math.max(1, sqCfg('qualifyTries') | 0);
  // THE WILDS ARE HELD ASIDE FOR THE WHOLE LOOP, and that is not a tidiness
  // measure. The leading attempt stays IN HAND while the next one is dealt, so
  // a wild forced into attempt 1 is in neither pile when attempt 2 asks for
  // one - attempt 2 gets none, and if it then wins, the grid has no wild at
  // all. Measured: grid 3 of a real run dealt with zero. A reserve every
  // attempt draws from and every rejected attempt hands back cannot lose one.
  // ROLLED ONCE FOR THE GRID, NOT PER ATTEMPT - a coin flipped six times is not
  // a 60% chance, it is a 95% one.
  const wilds = sqdWildsThisGrid(sqRound);
  const reserve = [];
  for (let i = 0; i < wilds; i++) { const w = sqdTakeWildFromPiles(); if (w) reserve.push(w); }
  // FIRST ACCEPTABLE, NOT BEST OF N, and the reason is the rank window rather
  // than taste. Holding a leading attempt in hand while the next is dealt means
  // TWO deals are out of the pile at once - and a 5-rank window is only 20
  // cards, against two 3x3 deals of 12. The second deal ran the window dry and
  // `sqDraw` fell through to an ordinary draw: measured, 45 cards came out with
  // ranks the grid was supposed to exclude. Returning each rejected attempt
  // BEFORE the next one is dealt keeps the window whole, and costs almost
  // nothing - the gates pass 84% of 3x3 deals and 93% of 4x4 ones, so the
  // search ends on the first or second attempt either way.
  let lead = null, n = 0;
  for (let t = 0; t < tries; t++) {
    n = t + 1;
    const pieces = sqdDealAll();
    sqdForceWilds(pieces, reserve, wilds);
    const par = sqdComputePar(pieces);
    const g = sqdGates(par, SQ_N, pieces);
    lead = { pieces, par, g };
    if (g.ok || t === tries - 1) break;    // the last one is kept whatever it is
    sqdReturnPieces(pieces, reserve);
    lead = null;
  }
  // THE WINNER GETS THE WILD, WHOEVER WON. Holding the leader in hand while the
  // next attempt is dealt means an attempt can only take a wild the leader is
  // not already holding - so the attempt that ends up winning may be one that
  // was dealt none. Measured on two real runs: one grid in three came out with
  // no wild in it. Topping the winner up afterwards is the only arrangement
  // that cannot lose one, and it costs one more par search on the grids where
  // it actually fires, because a wild is worth a lot of par and the figure the
  // scoreboard quotes has to be the one this hand can really reach.
  // The winner was dealt under its own quota, so there is nothing left to top
  // up - only the run's tally of which grids carried one, which is what the
  // "at least one grid in three" floor reads.
  if (lead && lead.pieces.some(p => p.cells.some(cl => sqdIsWild(cl.card)))) sqdWildGrids++;
  // Anything the winner did not use goes back into the deck.
  while (reserve.length) playedPile.push(reserve.shift());
  if (typeof flushPlayedDeck === 'function') flushPlayedDeck();
  if (lead) lead.tries = n;
  if (lead && typeof devMode !== 'undefined' && devMode)
    console.log('[SQD] deal', n, 'tries ·', lead.g.ok ? 'passed' : 'BEST OF A BAD LOT',
      `qualifying packings ${lead.g.qual} · reach ${lead.g.lines} · mixes ${lead.g.mixes}/${lead.g.wantMixes}`,
      `· spread ${lead.g.spread}%/${lead.g.wantSpread}%`);
  return lead || { pieces: [], par: { best: 0, exact: false }, g: {}, tries: 0 };
}

// How many cells of tiles this board will NOT need - the surplus, which is the
// whole decision. Counts what is still in hand plus what is already down.
function sqdSpare() {
  const spec = SQD_SIZES[SQ_N]; if (!spec) return 0;
  return spec.inv.reduce((t, r) => t + r.n * r.size, 0) - SQ_N * SQ_N;
}

// ══════════════════════════════════════════════════════════════════════════
// PAR - the best the board could have paid
// ══════════════════════════════════════════════════════════════════════════
// Filling the first empty cell in row-major order and trying every unused
// piece that can cover it is the standard exact-cover walk, and it is what
// makes this tractable at all. Measured placement counts:
//
//   3x3: ~30,000 packings. EXHAUSTIVE, and it runs in about 20ms.
//   4x4: over 8 MILLION. Not enumerable in a frame, so the 4x4 takes the best
//        of many RANDOMISED restarts inside a time budget and is reported as
//        "best found" rather than as a proven ceiling.
//
// Randomising the ORDER pieces and placements are tried in is what makes the
// restarts worth anything: a truncated walk in a fixed order explores one
// narrow corner of the space however long you give it.
const SQD_PAR_BUDGET_MS = 260;   // the 4x4's whole search
const SQD_PAR_RESTART    = 9000; // leaves per randomised restart
const SQD_BEAM_WIDTH     = 2000; // partial boards kept per level (4x4)
const SQD_EXACT_TOP      = 48;   // completions re-scored by the real scorer, best-heuristic first

function sqdOrients(p) {
  // Functional rotations - `sqRotate` mutates the piece, which the live hand owns.
  let cells = p.cells.map(c => ({ dr: c.dr, dc: c.dc, card: c.card }));
  const out = [], seen = new Set();
  for (let t = 0; t < 4; t++) {
    const mr = Math.min(...cells.map(c => c.dr)), mc = Math.min(...cells.map(c => c.dc));
    const n = cells.map(c => ({ dr: c.dr - mr, dc: c.dc - mc, card: c.card }));
    const key = n.map(c => c.dr + ',' + c.dc).sort().join('|');
    if (!seen.has(key)) { seen.add(key); out.push(n); }
    const mx = Math.max(...cells.map(c => c.dr));
    cells = cells.map(c => ({ dr: c.dc, dc: mx - c.dr, card: c.card }));
  }
  return out;
}
function sqdPlacements(N, pieces) {
  return pieces.map(p => {
    const list = [];
    for (const o of sqdOrients(p)) {
      const h = Math.max(...o.map(c => c.dr)) + 1, w = Math.max(...o.map(c => c.dc)) + 1;
      for (let br = 0; br + h <= N; br++) for (let bc = 0; bc + w <= N; bc++) {
        let m = 0; const cl = [];
        for (const c of o) { const idx = (br + c.dr) * N + (bc + c.dc); m |= 1 << idx; cl.push([idx, c.card]); }
        list.push({ m, cl });
      }
    }
    return list;
  });
}
// `exhaustive` is the 3x3's real answer. The RANDOMISED branch below is no
// longer used in play - the beam beat it everywhere - and is kept as the
// MEASURING STICK the beam was validated against, which is the only way to
// re-check that claim if the tables or the inventory ever move.
function sqdSearchPar(N, pieces, opts = {}) {
  if (!pieces || !pieces.length) return { best: 0, exact: true, leaves: 0, ms: 0 };
  const full = (1 << (N * N)) - 1;
  const plc = sqdPlacements(N, pieces);
  const board = new Array(N * N).fill(null);
  const exhaustive = !!opts.exhaustive;
  const budget = opts.budgetMs || SQD_PAR_BUDGET_MS;
  const t0 = Date.now();
  let best = 0, leaves = 0, cutShort = false, bestBoard = null;
  // THE SURVEY (r340). The walk already visits every packing, so the three
  // questions a qualifier wants to ask cost almost nothing to answer on the way
  // past: how many lines can be made to score AT ALL, what an ARBITRARY packing
  // is worth (which is what says whether placement matters), and how many
  // DIFFERENT hands the good packings make (which is what says there is a
  // choice rather than one right answer).
  let maxScoring = 0, sum = 0, qual = 0, qualMix = new Set();

  const scoreBoard = () => sqdScoreBoard(board, N).total;
  const order = plc.map((_, i) => i);
  const run = (cap, shuffleOrder) => {
    if (shuffleOrder) {
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      plc.forEach(l => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } });
    }
    let n = 0;
    const go = (occ, used) => {
      if (occ === full) {
        leaves++;
        const res = sqdScoreBoard(board, N);
        const s = res.total;
        sum += s;
        const m = sqdMetricsFrom(res, N * N);
        if (m.scoring > maxScoring) maxScoring = m.scoring;
        // THE GATES ARE ASKED OF EACH ARRANGEMENT, not of the deal's best-ever
        // figures - see sqdQualifies. `qualMix` is what answers "more than one
        // way", because two packings that make the same hands in the same
        // places are one way twice.
        if (sqdQualifies(m)) { qual++; if (qualMix.size < SQD_Q_MIX_CAP) qualMix.add(m.mix); }
        if (s > best || !bestBoard) { best = s; bestBoard = board.slice(); }
        // A MIX IS COLLECTED AGAINST A MOVING TARGET, so it is over-collected
        // here and filtered against the FINAL best at the end. Capped, because
        // the count only has to distinguish "one answer" from "several".
        return ++n >= cap;
      }
      let e = 0; while (occ & (1 << e)) e++;
      const bit = 1 << e;
      for (const pi of order) {
        if (used & (1 << pi)) continue;
        for (const pl of plc[pi]) {
          if (!(pl.m & bit) || (pl.m & occ)) continue;
          for (const [idx, card] of pl.cl) board[idx] = card;
          const bail = go(occ | pl.m, used | (1 << pi));
          for (const [idx] of pl.cl) board[idx] = null;
          if (bail) return true;
        }
      }
      return false;
    };
    return go(0, 0);
  };

  if (exhaustive) { run(Infinity, false); }
  else {
    let restarts = 0;
    const cap = opts.leafCap || SQD_PAR_RESTART;
    do { if (run(cap, restarts > 0)) cutShort = true; restarts++; }
    while (Date.now() - t0 < budget && restarts < 400);
  }
  const lines = bestBoard ? sqdScoreBoard(bestBoard, N).lines.map(l => l.name) : null;
  return { best, exact: exhaustive && !cutShort, leaves, ms: Date.now() - t0, board: bestBoard, lines,
           maxScoring, mean: leaves ? sum / leaves : 0, qual, mixes: qualMix.size, surveyed: exhaustive };
}
// ── THE 4x4 IS A BEAM SEARCH, NOT A LONGER RANDOM WALK ─────────────────────
// Randomised restarts were the first answer and they are a bad one here: the
// space is over 8 million packings, so any number of 9,000-leaf samples is a
// rounding error. Measured against a 12-SECOND random search on the same four
// deals, a 260ms random search returned 157/147/136/140 where the long one
// found 183/159/166/164 - about 15% short, which is the one failure mode this
// feature cannot have. A player who BEATS the "best possible" line reads it as
// broken.
//
// So the 4x4 walks the same forced exact-cover order (always fill the first
// empty cell) but keeps the best SQD_BEAM_WIDTH partial boards at each level
// instead of one path. Three things make that work:
//
//  * ROW-MAJOR FILLING MAKES ROWS EXACT EARLY. By the time the frontier is in
//    row 3, rows 1 and 2 are finished and their scores are final, so most of
//    the estimate is real rather than guessed.
//  * A PARTIAL LINE IS SCORED AS IF IT WERE THE WHOLE LINE. A column holding
//    two hearts already reads as a flush, which is exactly the bias wanted -
//    it steers the beam toward columns that are going somewhere. It is not an
//    upper bound and is not trying to be; nothing is pruned on it.
//  * NO DEDUPE IS NEEDED. Filling the first empty cell means the ORDER of
//    placements is forced by the board, so every distinct board is reached by
//    exactly one path.
//
// A child's estimate is its parent's with only the LINES THE PIECE TOUCHES
// rescored - at most 3 rows and 3 columns - which is what keeps a 20,000-child
// level inside a frame.
const SQD_H = { HIGH: 0, PAIR: 1, TWO: 2, TRIP: 3, QUAD: 4, FLUSH: 5, RUN: 6, SF: 7 };
const SQD_H_NAME = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Four of a Kind', 'Flush', 'Run', 'Straight Flush'];
function sqdBaseTable(N) {
  const t = SQD_BASE[N] || {};
  return [t['High Card'] || 0, t['Pair'] || 0, t['Two Pair'] || 0, t['Three of a Kind'] || 0,
          t['Four of a Kind'] || 0, t['Flush of ' + N] || 0, t['Run of ' + N] || 0, t['Straight Flush'] || 0];
}
// The two SHORT hands, for the heuristic only - the exact re-score below is
// what the returned number actually comes from.
function sqdShortTable(N) {
  const t = SQD_BASE[N] || {};
  return { run3: t['Run of 3'] || 0, flush3: t['Flush of 3'] || 0 };
}
function sqdBeamPar(N, pieces, opts = {}) {
  const cells = N * N, L = N * 2, W = opts.width || SQD_BEAM_WIDTH;
  const budget = opts.budgetMs || SQD_PAR_BUDGET_MS;
  const t0 = Date.now();

  // ONE INDEX PER CARD, so the board is a typed array and scoring never touches
  // an object. V rank, S suit, P the card's point value.
  // A MAP, NOT A FIELD ON THE CARD. Stamping `_sqdI` on the card object works
  // and has one failure mode that is very hard to see: a throw between the
  // stamping and the clean-up leaves a stale index on a real deck card, and the
  // next search then skips filling V/S/P for it and scores it as undefined.
  const V = [], S = [], P = [], WLD = [], cardOf = [], suitIdx = {}, idxOf = new Map();
  const pl = pieces.map(p => {
    const list = [];
    for (const o of sqdOrients(p)) {
      const h = Math.max(...o.map(c => c.dr)) + 1, w = Math.max(...o.map(c => c.dc)) + 1;
      for (let br = 0; br + h <= N; br++) for (let bc = 0; bc + w <= N; bc++) {
        let m = 0; const at = [], ci = [];
        for (const c of o) {
          const card = c.card;
          if (!idxOf.has(card)) {
            idxOf.set(card, V.length); V.push(sqRank(card)); P.push(sqdCardValue(card.rank));
            WLD.push(sqdIsWild(card) ? 1 : 0); cardOf.push(card);
            if (suitIdx[card.suit] == null) suitIdx[card.suit] = Object.keys(suitIdx).length;
            S.push(suitIdx[card.suit]);
          }
          const idx = (br + c.dr) * N + (bc + c.dc);
          m |= 1 << idx; at.push(idx); ci.push(idxOf.get(card));
        }
        list.push({ m, at, ci });
      }
    }
    return list;
  });

  const BASE = sqdBaseTable(N);
  const EXACT_TOP = opts.exactTop || SQD_EXACT_TOP;
  const dbl = new Uint8Array(L), per = new Int16Array(L);
  for (let i = 0; i < L; i++) { const b = sqdBoonsOn(i); dbl[i] = b.dbl ? 1 : 0; per[i] = b.perCard; }

  // Allocation-free naming of one line. n <= 4, so counting beats sorting.
  //
  // THIS IS THE BEAM'S HEURISTIC, NOT THE ANSWER (r340). It runs on the order
  // of two million times a search, so it stays a typed-array loop - but that
  // makes it a SECOND implementation of the scoring rules, and a second
  // implementation drifts. So it is only ever used to ORDER the frontier: every
  // board that actually completes is re-scored by `sqdScoreBoard`, the same
  // function the tally and the report use, and THAT is the number returned. A
  // heuristic that is slightly off therefore costs a slightly worse search and
  // can never report a par the rules do not agree with.
  const SHORT = sqdShortTable(N);
  const ACE_LO = sqAceLow(), ACE_HI = sqAceHigh();
  const sv = new Int16Array(8), ss = new Int16Array(8), sp = new Int16Array(8);
  let lastH = 0;                       // the hand `lineScore` just named

  // Is there a run of `need` distinct values in `sv[0..nat)` once `wilds` cards
  // may fill any gaps? The ace is entered a second time HIGH, because sqRank
  // gives it 1 and a hand ending K-A is a run too.
  function runFits(nat, wilds, need) {
    if (nat + wilds < need) return false;
    let m = 0;
    for (let i = 0; i < nat; i++) m |= 1 << (sv[i] - 1);
    if (m & (1 << (ACE_LO - 1))) m |= 1 << (ACE_HI - 1);
    for (let lo = 1; lo + need - 1 <= ACE_HI; lo++) {
      let have = 0;
      for (let k = 0; k < need; k++) if (m & (1 << (lo + k - 1))) have++;
      if (have + wilds >= need && have > 0) return true;
    }
    return false;
  }

  function lineScore(board, base, line) {
    let n = 0, pips = 0, fl = 1, s0 = -1, wilds = 0, nat = 0;
    for (let k = 0; k < N; k++) {
      const idx = line < N ? base + line * N + k : base + k * N + (line - N);
      const ci = board[idx]; if (ci < 0) continue;
      pips += P[ci]; n++;
      if (WLD[ci]) { wilds++; continue; }          // a wild joins no suit and no rank
      if (s0 < 0) s0 = S[ci]; else if (S[ci] !== s0) fl = 0;
      ss[nat] = S[ci]; sp[nat] = P[ci]; sv[nat++] = V[ci];
    }
    if (!n) return 0;
    for (let i = 1; i < nat; i++) { const x = sv[i], y = ss[i], z = sp[i]; let j = i - 1;
      while (j >= 0 && sv[j] > x) { sv[j + 1] = sv[j]; ss[j + 1] = ss[j]; sp[j + 1] = sp[j]; j--; }
      sv[j + 1] = x; ss[j + 1] = y; sp[j + 1] = z; }
    let top = 0, second = 0, runLen = 0;
    if (nat) {
      top = 1; runLen = 1;
      for (let i = 1; i < nat; i++) {
        if (sv[i] === sv[i - 1]) runLen++;
        else { if (runLen > top) { second = top; top = runLen; } else if (runLen > second) second = runLen; runLen = 1; }
      }
      if (runLen > top) { second = top; top = runLen; } else if (runLen > second) second = runLen;
    }
    // A WILD IS A CARD OF WHATEVER IS WANTED: one more of the biggest rank
    // group, one more of the flush, and a gap in a run filled - all at once,
    // which over-counts a little and is exactly the bias a frontier wants.
    top += wilds;
    const run = runFits(nat, wilds, n);
    let h;
    if (fl && run && n >= 3) h = SQD_H.SF;
    else if (top >= 4)       h = SQD_H.QUAD;
    else if (top >= 3)       h = SQD_H.TRIP;
    else if (run && n >= 3)  h = SQD_H.RUN;
    else if (fl && n >= 3)   h = SQD_H.FLUSH;
    else if (top >= 2 && second >= 2) h = SQD_H.TWO;
    else if (top >= 2)       h = SQD_H.PAIR;
    else                     h = SQD_H.HIGH;
    // A SHORT LINE MAY NOT CLAIM THE LINE'S OWN HAND. Three cards of a 4-line
    // are not a Flush of 4, and letting them read as one makes the beam chase a
    // hand it cannot finish. Since r340 a FULL 4-line may claim a three-card
    // run or flush instead, so the demotion applies only while it is short.
    if (n < N && (h === SQD_H.FLUSH || h === SQD_H.RUN || h === SQD_H.SF)) h = SQD_H.HIGH;
    lastH = h;
    let base3 = BASE[h], drop = 0;
    if (n === N && N >= 4 && h <= SQD_H.PAIR) {
      let c0 = 0, c1 = 0, c2 = 0, c3 = 0;
      for (let i = 0; i < nat; i++) { const q = ss[i]; if (q === 0) c0++; else if (q === 1) c1++; else if (q === 2) c2++; else c3++; }
      if (Math.max(c0, c1, c2, c3) + wilds >= 3 && SHORT.flush3 > base3) base3 = SHORT.flush3;
      if (SHORT.run3 > base3 && runFits(nat, wilds, 3)) base3 = SHORT.run3;
      // A SHORT HAND LEAVES A CARD OUT AND THAT CARD'S VALUE GOES WITH IT. The
      // heuristic has to drop one too or it systematically over-rates a short
      // hand against the whole-line hand it is competing with, which is the one
      // place this loop can push the frontier somewhere the exact pass will not
      // follow. Which card is left out is not known here, so the CHEAPEST is
      // assumed - an under-estimate of the loss, never an over-estimate.
      if (base3 > BASE[h]) { let lo = 99; for (let i = 0; i < nat; i++) if (sp[i] < lo) lo = sp[i]; drop = lo === 99 ? 0 : lo; }
    }
    return (base3 + pips - drop + per[line] * n) * (dbl[line] ? 2 : 1);
  }

  // THE FILL ORDER IS THE BEAM'S BIAS. Row-major finishes ROWS first, so their
  // scores are exact while every column is still a guess; column-major is the
  // mirror of that. Running both and taking the better is the cheapest
  // diversity available here, and it is worth more than a wider beam: measured
  // over six deals, w2000 and w40000 returned the SAME number on five of them.
  const ord = new Int32Array(cells);
  for (let k = 0; k < cells; k++) ord[k] = opts.colMajor ? (k % N) * N + ((k / N) | 0) : k;

  let curN = 1;
  let board = new Int8Array(W * cells).fill(-1);
  let occ = new Int32Array(W), used = new Int32Array(W);
  let ls = new Int16Array(W * L), est = new Int32Array(W);
  let nb = new Int8Array(W * cells), nocc = new Int32Array(W), nused = new Int32Array(W);
  let nls = new Int16Array(W * L), nest = new Int32Array(W);
  const full = (1 << cells) - 1;
  const touched = new Uint8Array(L);
  let best = 0, expanded = 0, bestLines = null, bestBoard = null;
  // THE BEAM'S SURVEY IS A SAMPLE, NOT A CENSUS, and it is a BIASED one: these
  // are the boards the frontier liked, so they are the good end of the space.
  // That is the right sample for "how many different hands do the good packings
  // make" and the WRONG one for "what is an arbitrary packing worth" - the
  // 4x4's baseline comes from a separate random walk instead.
  let maxScoring = 0, qual = 0, qualMix = new Set();
  // THE EXACT PASS. A board that completes is re-scored by `sqdScoreBoard` -
  // the same function the tally and the report use - and THAT is what the
  // record is kept on. The heuristic above only decides which boards get to
  // complete, so it can be approximate without the returned par ever being a
  // number the rules disagree with.
  const exact = (buf, off) => {
    const cds = new Array(cells);
    for (let k = 0; k < cells; k++) { const ci = buf[off + k]; cds[k] = ci >= 0 ? cardOf[ci] : null; }
    return { cards: cds, res: sqdScoreBoard(cds, N) };
  };

  while (curN) {
    if (occ[0] === full) break;                       // every survivor is complete
    const kids = [];
    for (let s = 0; s < curN; s++) {
      const bb = s * cells;
      if (occ[s] === full) continue;
      let oi = 0; while (occ[s] & (1 << ord[oi])) oi++;
      const bit = 1 << ord[oi];
      for (let pi = 0; pi < pl.length; pi++) {
        if (used[s] & (1 << pi)) continue;
        const list = pl[pi];
        for (let qi = 0; qi < list.length; qi++) {
          const q = list[qi];
          if (!(q.m & bit) || (q.m & occ[s])) continue;
          for (let k = 0; k < q.at.length; k++) board[bb + q.at[k]] = q.ci[k];
          touched.fill(0);
          for (let k = 0; k < q.at.length; k++) { const idx = q.at[k]; touched[(idx / N) | 0] = 1; touched[N + (idx % N)] = 1; }
          let v = est[s];
          for (let i = 0; i < L; i++) if (touched[i]) v += lineScore(board, bb, i) - ls[s * L + i];
          for (let k = 0; k < q.at.length; k++) board[bb + q.at[k]] = -1;
          kids.push({ s, pi, qi, v });
          expanded++;
        }
      }
    }
    if (!kids.length) break;
    kids.sort((a, b) => b.v - a.v);
    const take = Math.min(W, kids.length);
    for (let i = 0; i < take; i++) {
      const k = kids[i], src = k.s * cells, dst = i * cells, q = pl[k.pi][k.qi];
      nb.set(board.subarray(src, src + cells), dst);
      for (let j = 0; j < q.at.length; j++) nb[dst + q.at[j]] = q.ci[j];
      nocc[i] = occ[k.s] | q.m; nused[i] = used[k.s] | (1 << k.pi);
      for (let j = 0; j < L; j++) nls[i * L + j] = ls[k.s * L + j];
      touched.fill(0);
      for (let j = 0; j < q.at.length; j++) { const idx = q.at[j]; touched[(idx / N) | 0] = 1; touched[N + (idx % N)] = 1; }
      for (let j = 0; j < L; j++) if (touched[j]) nls[i * L + j] = lineScore(nb, dst, j);
      nest[i] = k.v;
      // WHAT THE BEST PACKING ACTUALLY MADE, not just what it was worth - which
      // is what lets the mix of hands be measured rather than assumed, and what
      // the end-of-run comparison draws.
      // ONLY THE TOP OF THE FRONTIER IS RE-SCORED EXACTLY. `kids` is already
      // sorted by the heuristic, so the true best is in the leading handful;
      // scoring all 2,000 completions the slow way costs most of a second and
      // has never once changed the answer.
      if (nocc[i] === full && (i < EXACT_TOP || !bestBoard)) {
        const e = exact(nb, dst);
        const m = sqdMetricsFrom(e.res, cells);
        if (m.scoring > maxScoring) maxScoring = m.scoring;
        if (sqdQualifies(m)) { qual++; if (qualMix.size < SQD_Q_MIX_CAP) qualMix.add(m.mix); }
        if (e.res.total > best || !bestBoard) {
          best = e.res.total; bestBoard = e.cards;
          bestLines = e.res.lines.map(l => l.name);
        }
      }
    }
    let t;
    t = board; board = nb; nb = t;
    t = occ; occ = nocc; nocc = t;
    t = used; used = nused; nused = t;
    t = ls; ls = nls; nls = t;
    t = est; est = nest; nest = t;
    curN = take;
    if (Date.now() - t0 > budget * 3) break;          // a hard stop, never the plan
  }
  return { best, exact: false, leaves: expanded, ms: Date.now() - t0, lines: bestLines, board: bestBoard,
           maxScoring, qual, mixes: qualMix.size, surveyed: false };
}

// The 3x3 is small enough to prove; the 4x4 is not, and saying so is the whole
// difference between a par and a claim.
function sqdComputePar(pieces) {
  try {
    if (SQ_N <= 3) return sqdSearchPar(SQ_N, pieces, { exhaustive: true });
    // BOTH FILL ORDERS, AND NOTHING ELSE. Measured over 12 deals: a 180ms
    // random restart phase on top of these beat them on 0 of 12, so it was
    // taken out rather than left in to cost 180ms a grid. The two orders do
    // genuinely disagree - row-major alone was better on 2, column-major alone
    // on 5, and they tied on 5 - which is what makes running both worth 40ms.
    // Against an EIGHT-SECOND random search the pair wins or ties 10 of 12.
    const t0 = Date.now();
    const a = sqdBeamPar(SQ_N, pieces, {});
    const b = sqdBeamPar(SQ_N, pieces, { colMajor: true });
    const w = a.best >= b.best ? a : b;
    // THE SURVEY IS THE UNION OF BOTH FILL ORDERS. They explore different
    // corners (row-major finishes rows first, column-major columns), so the
    // reach and the mix count are both better read across the pair - and
    // dropping these three fields is exactly what made every 4x4 deal fail its
    // gates and burn all six attempts.
    return { best: w.best, exact: false, lines: w.lines, board: w.board,
             maxScoring: Math.max(a.maxScoring || 0, b.maxScoring || 0),
             qual: (a.qual || 0) + (b.qual || 0),
             mixes: Math.max(a.mixes || 0, b.mixes || 0), surveyed: false,
             leaves: a.leaves + b.leaves, ms: Date.now() - t0 };
  } catch (e) {
    if (typeof devMode !== 'undefined' && devMode) console.warn('[SQD] par search failed', e);
    return { best: 0, exact: false, leaves: 0, ms: 0, board: null, lines: null };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// WHAT IS BOOSTED, ON THE BOARD (r340)
// ══════════════════════════════════════════════════════════════════════════
// A line boon was applied and then INVISIBLE. It is stored in `sqdBoons` and
// read only by the scorer, so after the grant card closed there was nothing on
// screen saying which row scored double - the owner's "the buffed line item
// didn't show in the inventory". It is a property of the BOARD, so it is drawn
// on the board: a tinted bar down the line, behind the cards, with what it does
// on its end cap.
//
// BEHIND THE CARDS, which is z-index 1 against the cards' 2 (css/entity-fx.css
// sets those, and a reward tile had to be added to that list in r294 for
// exactly this reason). A SIBLING of the cards, never a child - `render()`
// rebuilds `#grid`'s children and a child would be destroyed on the next
// repaint, which is the r216 lesson that moved #boss-banner out of #grid.
function sqdPaintBoons() {
  const g = document.getElementById('grid'); if (!g) return;
  g.querySelectorAll('.sq-bline').forEach(el => el.remove());
  if (!sqDaily() || !sqdBoons.length) return;
  const n = SQ_N;
  const seen = new Map();
  sqdBoons.forEach(b => {
    if (b.kind === 'cons' || b.line == null) return;
    const cur = seen.get(b.line) || { dbl: false, per: 0 };
    if (b.kind === 'dbl') cur.dbl = true; else cur.per += SQD_BOON_PER_CARD;
    seen.set(b.line, cur);
  });
  seen.forEach((v, i) => {
    const row = i < n, k = row ? i : i - n;
    const d = document.createElement('div');
    d.className = 'sq-bline' + (row ? ' row' : ' col') + (v.dbl ? ' dbl' : '');
    const L = cellLeft(row ? 0 : k), T = cellTop(row ? k : 0);
    const Wd = row ? (cellLeft(n - 1) + CARD_W - cellLeft(0)) : CARD_W;
    const Ht = row ? CARD_H : (cellTop(n - 1) + CARD_H - cellTop(0));
    d.style.cssText = `left:${L}px;top:${T}px;width:${Wd}px;height:${Ht}px`;
    const tag = [v.dbl ? '×2' : '', v.per ? '+' + v.per : ''].filter(Boolean).join(' ');
    d.innerHTML = `<span class="sq-btag">${tag}</span>`;
    g.appendChild(d);
  });
}

// ── THE PAY TABLE, one tap away (r340) ─────────────────────────────────────
// The whole ladder, what a card is worth, and any line that is boosted. BODY
// LEVEL and placed in raw viewport px, the `.time-popup` rule: anything inside
// #cabinet inherits its CSS zoom and the coordinates get multiplied.
function sqdPayTableHTML() {
  const n = SQ_N, rows = sqdPayRows(n);
  const mode = sqCfg('cardScore');
  const cardLine = mode === 'none' ? 'cards score nothing'
    : mode === 'rank' ? 'every card scores its own pips'
    : 'ace 3 · court 2 · everything else 1';
  const boons = sqdBoons.filter(b => b.kind !== 'cons' && b.line != null);
  return `<div class="sq-pt-h">${n} CARDS TO A LINE</div>`
    + `<table class="sq-pt">${rows.slice().reverse().map(r =>
        `<tr><td>${r.name}</td><td>${r.base}</td></tr>`).join('')}</table>`
    + `<div class="sq-pt-n"><b>Plus the cards.</b> ${cardLine}.</div>`
    + (n >= 4 ? `<div class="sq-pt-n"><b>Short hands.</b> A line that only makes a three-card run or flush scores it; the fourth card scores nothing.</div>` : '')
    + (sqCfg('wildPerGrid') ? `<div class="sq-pt-n"><b>The wild.</b> One a grid. It takes whatever rank and suit each line needs - its row and its column separately${sqCfg('wildValue') ? '' : ', and scores no value of its own'}.</div>` : '')
    + (boons.length ? `<div class="sq-pt-n"><b>Boosted.</b> ${boons.map(sqdBoonLabel).join(' · ')}.</div>` : '');
}
function sqdTogglePayTable(anchor) {
  let el = document.getElementById('sq-paytable');
  if (el && el.classList.contains('show')) { el.classList.remove('show'); return; }
  if (!el) { el = document.createElement('div'); el.id = 'sq-paytable'; el.className = 'time-popup'; document.body.appendChild(el); }
  el.innerHTML = sqdPayTableHTML();
  el.classList.add('show');
  // Placed under the anchor, then clamped to the viewport on both axes - the
  // pop-up cap every body-level bubble in this game carries.
  const r = anchor ? anchor.getBoundingClientRect() : { left: 20, bottom: 20, width: 0 };
  el.style.visibility = 'hidden'; el.style.left = '0px'; el.style.top = '0px';
  const w = el.offsetWidth, h = el.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
  if (y + h > innerHeight - 10) y = Math.max(10, r.top - h - 8);
  x = Math.max(10, Math.min(x, innerWidth - w - 10));
  y = Math.max(10, Math.min(y, innerHeight - h - 10));
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.visibility = '';
}
function sqdHidePayTable() { document.getElementById('sq-paytable')?.classList.remove('show'); }

// ── THE TRAY'S SLOTS (r340) ────────────────────────────────────────────────
// What the hand renders, in order, with a null for a slot whose tile is down.
// The 5x5 has no slots and simply gets its live hand back, so one renderer
// covers both.
function sqdTraySlots() {
  if (!sqDaily()) return sqHand.slice();
  let max = -1;
  sqHand.forEach(p => { if (p.slot == null) p.slot = ++max; else if (p.slot > max) max = p.slot; });
  // The tray never shrinks below the row it was dealt at, so the last tile of a
  // grid sits where it has sat all along rather than jumping to the front.
  const spec = SQD_SIZES[SQ_N];
  const want = spec ? spec.inv.reduce((t, r) => t + r.n, 0) : max + 1;
  const out = new Array(Math.max(want, max + 1)).fill(null);
  sqHand.forEach(p => { out[p.slot] = p; });
  return out;
}
// Move a tile to another slot, the way a phone moves an app icon: the tiles
// between the two shuffle up or down by one and nothing else moves.
function sqdTrayMove(piece, to) {
  const slots = sqdTraySlots();
  const from = piece.slot;
  if (from == null || to == null || to === from || to < 0 || to >= slots.length) return false;
  const step = to > from ? 1 : -1;
  for (let i = from; i !== to; i += step) { const q = slots[i + step]; if (q) q.slot = i; }
  piece.slot = to;
  return true;
}

// ── WHICH CARDS CAME DOWN TOGETHER (r340) ──────────────────────────────────
// Once a tile is placed its cards are indistinguishable from any other card on
// the board, so a board reads as nine loose cards rather than as the four tiles
// it was built from - and "which of these can I still move" becomes something
// you have to remember. Each placed group gets an outline, drawn as a border
// segment per cell on the sides that face OUT of the group: a single is a full
// box, an L is an L. One rule covers every shape, present and future, with no
// per-shape geometry.
//
// ABOVE the cards, unlike the boon lines - it is an edge ON the tile rather
// than a wash behind it - and `pointer-events: none`, because the board's own
// capture-phase handler is what turns a tap into a lift.
function sqdPaintGroups() {
  const g = document.getElementById('grid'); if (!g) return;
  g.querySelectorAll('.sq-grp').forEach(el => el.remove());
  if (!sqDaily() || sqPhase !== 'place') return;
  sqdPlaced.forEach((pl, gi) => {
    const set = new Set(pl.cells.map(([r, c]) => r + ',' + c));
    const solo = pl.cells.length === 1;
    pl.cells.forEach(([r, c]) => {
      const out = (dr, dc) => set.has((r + dr) + ',' + (c + dc)) ? '0' : '2px';
      const d = document.createElement('div');
      d.className = 'sq-grp' + (solo ? ' solo' : '');
      d.style.cssText = `left:${cellLeft(c)}px;top:${cellTop(r)}px;width:${CARD_W}px;height:${CARD_H}px;`
        + `border-top-width:${out(-1, 0)};border-bottom-width:${out(1, 0)};`
        + `border-left-width:${out(0, -1)};border-right-width:${out(0, 1)}`;
      d.dataset.grp = gi;
      g.appendChild(d);
    });
  });
}

// Which tray slot is under a viewport point, or null. Reads the slots' real
// rects rather than computing a grid: the tray is a CSS grid whose column count
// comes from a class (#stage.sq-n3 / .sq-n4) and whose gaps are the
// stylesheet's, so measuring is the only way to stay right when either moves.
function sqdSlotAt(x, y) {
  const host = document.getElementById('selected-cards'); if (!host) return null;
  const hr = host.getBoundingClientRect();
  if (x < hr.left || x > hr.right || y < hr.top || y > hr.bottom) return null;
  let best = null, bestD = Infinity;
  host.querySelectorAll('[data-slot]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = +el.dataset.slot; }
  });
  return best;
}
// PAINTED BY CLASS, NEVER BY A RENDER. sqRenderAll rebuilds the tray's children
// wholesale, and the tile the finger is holding is one of them (r309) - so the
// drop target is marked by toggling a class on what is already there.
function sqdMarkDrop(slot) {
  const host = document.getElementById('selected-cards'); if (!host) return;
  host.querySelectorAll('[data-slot]').forEach(el =>
    el.classList.toggle('sq-drop', slot != null && +el.dataset.slot === slot));
}

// ══════════════════════════════════════════════════════════════════════════
// WHICH CARDS ARE ACTUALLY IN THE HAND (r341)
// ══════════════════════════════════════════════════════════════════════════
// `used` is the cards a line's hand was PRICED over, and for a whole-line hand
// that is the whole line - a Pair on a 3-line lists all three, because a pair
// with a kicker is what a Pair here means. That is right for scoring and wrong
// for the question the deal qualifier now asks, which is whether a card is
// carrying its weight: the kicker beside a pair is a passenger, and a grid full
// of passengers is a grid where most of your cards did not matter.
//
// So this is the MATERIAL subset - the cards the hand would stop being without.
// High Card has none, a Pair has two whatever the line's length, a run or a
// flush has all of its own.
function sqdMaterialCards(line) {
  const name = line && line.name, used = (line && line.used) || [];
  if (!name || name === 'High Card') return [];
  if (/^(Run|Flush) of|^Straight Flush$/.test(name)) return used.slice();
  const want = name === 'Pair' ? 2 : name === 'Two Pair' ? 4
             : name === 'Three of a Kind' ? 3 : name === 'Four of a Kind' ? 4 : used.length;
  // Take the biggest rank groups first, and let a wild join the biggest - it is
  // standing in for that rank, which is what made the hand in the first place.
  const wilds = used.filter(sqdIsWild), nat = used.filter(c => !sqdIsWild(c));
  const by = new Map();
  nat.forEach(c => { const a = by.get(c.rank) || []; a.push(c); by.set(c.rank, a); });
  const groups = [...by.values()].sort((a, b) => b.length - a.length);
  const out = [];
  for (const g of groups) { for (const c of g) { if (out.length < want) out.push(c); } if (out.length >= want) break; }
  for (const w of wilds) if (out.length < want) out.push(w);
  return out;
}
// A "THREE-CARD HAND" IS ONE THAT USES THREE CARDS (owner's wording). On a
// 3-line that separates a Run of 3 / Flush of 3 / Three of a Kind - which spend
// the whole line - from a Pair, which spends two of it and carries a spare.
const sqdLineDepth = line => sqdMaterialCards(line).length;

// ── WHAT A FINISHED BOARD IS WORTH ASKING ABOUT (r341) ─────────────────────
// The three things the qualifier reads, measured on ONE packing rather than
// each maximised separately - "a grid that could be configured in more than one
// way such that there are 4 scoring lines" is a statement about a single
// arrangement being good, not about three different arrangements each being
// good at one thing.
function sqdBoardMetrics(board, n, boons) {
  let cells = 0; for (const c of board) if (c) cells++;
  return sqdMetricsFrom(sqdScoreBoard(board, n, boons), cells);
}
// The same thing from a board that has ALREADY been scored - the par walk has
// the line results in hand and must not pay for them twice.
function sqdMetricsFrom(res, cells) {
  let scoring = 0, deep = 0;
  const covered = new Set();
  for (const l of res.lines) {
    if (!l.name || l.name === 'High Card') continue;
    scoring++;
    const mat = sqdMaterialCards(l);
    if (mat.length >= 3) deep++;
    for (const c of mat) covered.add(c);
  }
  return { total: res.total, scoring, deep, cover: covered.size, cells,
           coverFrac: cells ? covered.size / cells : 0,
           mix: res.lines.map(l => l.name).sort().join('|') };
}

// ── DOES THIS ONE ARRANGEMENT CLEAR THE BAR (r341) ─────────────────────────
// ALL THREE AT ONCE, ON ONE PACKING. Owner: "a grid that could be configured in
// more than one way such that there are 4 scoring lines that aren't high card.
// At least 3 lines should be 3 card hands. And 2/3 of cards are scored in a non
// high card hand." Maximising the three separately would pass a grid whose four
// scoring lines and whose three real hands are in different arrangements - that
// is three promises, one of which you get to keep.
function sqdQualifies(m) {
  const need = Math.ceil((m.cells || 0) * (sqCfg('qualifyCover') | 0) / 100);
  return m.scoring >= (sqCfg('qualifyLines') | 0)
      && m.deep    >= (sqCfg('qualifyDeep')  | 0)
      && m.cover   >= need;
}
