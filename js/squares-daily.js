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
const SQD_SIZES = {
  3: { grids: 3, inv: [{ size: 3, n: 1 }, { size: 2, n: 3 }, { size: 1, n: 3 }] }, // 12 cells -> 9
  4: { grids: 3, inv: [{ size: 3, n: 2 }, { size: 2, n: 4 }, { size: 1, n: 5 }] }, // 19 cells -> 16
};
const sqdSizes = () => Object.keys(SQD_SIZES).map(Number);
// A DAILY grid is any size the table knows about. The 5x5 is the original mode
// and keeps its turns, its Tricks and its pips x mult.
function sqDaily() { return !!(typeof squaresActive === 'function' && squaresActive() && SQD_SIZES[SQ_N]); }

// ── CARD VALUE ─────────────────────────────────────────────────────────────
// Ace 5 · court 3 · everything else 1 (owner's rule). Every line adds these on
// top of its hand base, so even a line that makes nothing still pays something:
// that floor is what stops a dead row reading as a wasted row.
function sqdCardValue(rank) {
  if (rank === 'A') return 5;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 3;
  return 1;
}

// ── THE HAND TABLES ────────────────────────────────────────────────────────
// PRICED BY POKER (r312, owner: "Make the values based on poker not this
// grid"). These are the RATIOS of the two published pay tables for the real
// games at these hand sizes - Three Card Poker's PAIR PLUS and Four Card
// Poker's ACES UP - so the ladder is one a poker player already knows rather
// than one derived from how a packing puzzle happens to deal.
//
// Exact counts, brute-forced over a real deck:
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
// TWO THINGS THAT SURPRISE PEOPLE, and both are real poker rather than
// anything this game invented:
//  * ON THREE CARDS A STRAIGHT BEATS A FLUSH (720 against 1,096) and TRIPS
//    BEATS A STRAIGHT. That inversion is exactly why three-card poker has its
//    own ranking and does not reuse the five-card one.
//  * ON FOUR CARDS FOUR OF A KIND BEATS A STRAIGHT FLUSH - 13 hands against
//    44, because a fourth card of a rank is scarcer than a fourth card of a
//    run. The five-card game is the other way round.
//
// STRAIGHT, TWO PAIR AND FLUSH ARE A THREE-WAY TIE ON FOUR CARDS (2,772 /
// 2,808 / 2,816 - a 1.6% spread), so the counts cannot order them. The
// published table's order is taken instead, which is the five-card one and the
// one a player expects.
const SQD_PAY = {
  3: { 'High Card': 0, 'Pair': 1, 'Flush of 3': 4, 'Run of 3': 6,
       'Three of a Kind': 30, 'Straight Flush': 40 },
  4: { 'High Card': 0, 'Pair': 1, 'Two Pair': 3, 'Run of 4': 4, 'Flush of 4': 6,
       'Three of a Kind': 9, 'Straight Flush': 40, 'Four of a Kind': 50 },
};
// The pay table is ODDS ON A BET; a line here pays PIPS. One number turns one
// into the other, and it is the only part of this that is not poker's.
const SQD_PAY_SCALE = 10;
const SQD_BASE = (() => {
  const out = {};
  for (const n of Object.keys(SQD_PAY)) {
    out[n] = {};
    for (const [h, v] of Object.entries(SQD_PAY[n])) out[n][h] = v * SQD_PAY_SCALE;
  }
  return out;
})();
// The ladder, weakest first, for the tally's worst-to-best order. DERIVED from
// the pay table rather than written out beside it, so the order a line is read
// in can never disagree with what it paid.
const SQD_LADDER = (() => {
  const out = {};
  for (const n of Object.keys(SQD_PAY)) {
    out[n] = Object.keys(SQD_PAY[n]).sort((a, b) => SQD_PAY[n][a] - SQD_PAY[n][b]);
  }
  return out;
})();

// Name a 3- or 4-card line. NOT `sqHandName`, which gates runs and flushes on
// `cards.length >= 5` - correct for the 5x5, and it would call every line here
// a High Card.
function sqdHandName(cards) {
  const n = cards.length;
  if (n < 2) return 'High Card';
  const vs = cards.map(sqRank).sort((a, b) => a - b);
  const fl = cards.every(c => c.suit === cards[0].suit);
  const con = a => a.every((v, i) => i === 0 || v === a[i - 1] + 1);
  const distinct = new Set(vs).size === n;
  // The ace runs both ways: A-2-3 and Q-K-A are both runs.
  let run = distinct && con(vs);
  if (!run && distinct && vs[n - 1] === 14) run = con([1, ...vs.slice(0, n - 1)]);
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
const sqdHandRank = (n, name) => (SQD_LADDER[n] || []).indexOf(name);

// ── BOONS ──────────────────────────────────────────────────────────────────
// Between grids you are GRANTED one at random (owner's call - no choice, no
// picking the line). They ACCUMULATE, so grid 1 is plain, grid 2 carries one
// and grid 3 carries two: the run escalates without the player steering it.
let sqdBoons = [];                 // [{ kind:'dbl'|'plus2', line }]
const SQD_BOON_PER_CARD = 2;
function sqdBoonsOn(i) {
  const b = { dbl: false, perCard: 0 };
  sqdBoons.forEach(x => { if (x.line !== i) return;
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
function sqdScoreCards(cards, i) {
  const name = sqdHandName(cards);
  const base = (SQD_BASE[SQ_N] || {})[name] || 0;
  const pips = cards.reduce((s, c) => s + sqdCardValue(c.rank), 0);
  const b = sqdBoonsOn(i);
  const bonus = b.perCard * cards.length;
  const total = (base + pips + bonus) * (b.dbl ? 2 : 1);
  return { name, base, pips, bonus, dbl: b.dbl, total };
}
function sqdScoreLine(i) {
  const cells = sqLineCells(i).filter(([r, c]) => gridData[r] && gridData[r][c]);
  const cards = cells.map(([r, c]) => gridData[r][c]);
  if (!cards.length) return { i, name: 'High Card', base: 0, pips: 0, bonus: 0, dbl: false, total: 0, cells, cards, r: 0 };
  const s = sqdScoreCards(cards, i);
  return { i, ...s, cells, cards, r: sqdHandRank(SQ_N, s.name) };
}

// ── THE DEAL ───────────────────────────────────────────────────────────────
// Every tile at once, from the run's own deck, through the 5x5's weighted shape
// bag - so the straight piece stays the rarest 3-tile here too.
function sqdDealAll() {
  const spec = SQD_SIZES[SQ_N]; if (!spec) return [];
  const out = [];
  spec.inv.forEach(row => out.push(...sqDealPieces(row.n, row.size)));
  return out;
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
  let best = 0, leaves = 0, cutShort = false;

  const scoreBoard = () => {
    let t = 0;
    for (let i = 0; i < N * 2; i++) {
      const cards = i < N ? Array.from({ length: N }, (_, c) => board[i * N + c])
                          : Array.from({ length: N }, (_, r) => board[r * N + (i - N)]);
      t += sqdScoreCards(cards, i).total;
    }
    return t;
  };
  const order = plc.map((_, i) => i);
  const run = (cap, shuffleOrder) => {
    if (shuffleOrder) {
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      plc.forEach(l => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } });
    }
    let n = 0;
    const go = (occ, used) => {
      if (occ === full) { leaves++; const s = scoreBoard(); if (s > best) best = s; return ++n >= cap; }
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
    do { if (run(SQD_PAR_RESTART, restarts > 0)) cutShort = true; restarts++; }
    while (Date.now() - t0 < budget && restarts < 400);
  }
  return { best, exact: exhaustive && !cutShort, leaves, ms: Date.now() - t0 };
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
  const V = [], S = [], P = [], suitIdx = {}, idxOf = new Map();
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
  const dbl = new Uint8Array(L), per = new Int16Array(L);
  for (let i = 0; i < L; i++) { const b = sqdBoonsOn(i); dbl[i] = b.dbl ? 1 : 0; per[i] = b.perCard; }

  // Allocation-free naming of one line. n <= 4, so counting beats sorting.
  const sv = new Int16Array(8);
  let lastH = 0;                       // the hand `lineScore` just named
  function lineScore(board, base, line) {
    let n = 0, pips = 0, fl = 1, s0 = -1;
    for (let k = 0; k < N; k++) {
      const idx = line < N ? base + line * N + k : base + k * N + (line - N);
      const ci = board[idx]; if (ci < 0) continue;
      if (s0 < 0) s0 = S[ci]; else if (S[ci] !== s0) fl = 0;
      sv[n++] = V[ci]; pips += P[ci];
    }
    if (!n) return 0;
    // insertion sort, n <= 4
    for (let i = 1; i < n; i++) { const x = sv[i]; let j = i - 1; while (j >= 0 && sv[j] > x) { sv[j + 1] = sv[j]; j--; } sv[j + 1] = x; }
    let top = 1, second = 0, runLen = 1, distinct = 1;
    for (let i = 1; i < n; i++) {
      if (sv[i] === sv[i - 1]) { runLen++; }
      else { distinct++; if (runLen > top) { second = top; top = runLen; } else if (runLen > second) second = runLen; runLen = 1; }
    }
    if (runLen > top) { second = top; top = runLen; } else if (runLen > second) second = runLen;
    let run = distinct === n;
    if (run) { for (let i = 1; i < n && run; i++) if (sv[i] !== sv[i - 1] + 1) run = false; }
    if (!run && distinct === n && sv[n - 1] === 14) {   // the ace runs low too
      run = sv[0] === 2; for (let i = 1; i < n - 1 && run; i++) if (sv[i] !== sv[i - 1] + 1) run = false;
    }
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
    // are not a Flush of 4, and letting them read as one would make the beam
    // chase a hand it cannot finish.
    if (n < N && (h === SQD_H.FLUSH || h === SQD_H.RUN || h === SQD_H.SF)) h = SQD_H.HIGH;
    lastH = h;
    return (BASE[h] + pips + per[line] * n) * (dbl[line] ? 2 : 1);
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
  let best = 0, expanded = 0, bestLines = null;

  while (curN) {
    if (occ[0] === full) break;                       // every survivor is complete
    const kids = [];
    for (let s = 0; s < curN; s++) {
      const bb = s * cells;
      if (occ[s] === full) { if (est[s] > best) best = est[s]; continue; }
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
      // WHAT THE BEST PACKING ACTUALLY MADE, not just what it was worth. It is
      // one pass over a finished board, taken only when the record moves, and
      // it is what lets the mix of hands be measured rather than assumed.
      if (nocc[i] === full && k.v > best) {
        best = k.v; bestLines = [];
        for (let j = 0; j < L; j++) { lineScore(nb, dst, j); bestLines.push(SQD_H_NAME[lastH]); }
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
  return { best, exact: false, leaves: expanded, ms: Date.now() - t0, lines: bestLines };
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
    return { best: w.best, exact: false, lines: w.lines,
             leaves: a.leaves + b.leaves, ms: Date.now() - t0 };
  } catch (e) {
    if (typeof devMode !== 'undefined' && devMode) console.warn('[SQD] par search failed', e);
    return { best: 0, exact: false, leaves: 0, ms: 0 };
  }
}
