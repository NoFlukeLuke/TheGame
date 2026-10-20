// ══════════════════════════════════════════════════════════════════════════
// POKER SQUARES · THE 5x5, REDESIGNED (r409) - js/squares-patience.js
//
// The patience rebuild of the 5x5 (owner spec, 10-question survey). The 3x3 and
// 4x4 dailies in js/squares-daily.js are untouched; this file replaces only the
// old turn/polyomino 5x5, and it RIDES squares-mode.js rather than duplicating
// it: the drag machine, the board painters, the line headers, the tally, the
// chip tips and the end-of-run scoreboard are all the shared ones, reached
// through `sqPatActive()` branches at the seams.
//
// THE SHAPE OF A RUN
//   SQP_GRIDS grids, no quota, one high score (daily-friendly). Tricks carry
//   across grids, capped by the tray (trick_slots base 5); a full tray REFUSES
//   a pick until you drop one (r277's rule, done inside the pick popup).
//
// THE SHAPE OF A GRID
//   pick · d1 d2 · pick · d3 d4 · pick → MID TALLY · d5 d6 · pick · d7 d8 ·
//   pick · FINAL (5 cards) · FINAL TALLY
//   - A deal is 3 SINGLE CARDS, dragged onto the board one by one. A dealt card
//     survives ONE extra deal, then expires when NEXT DEAL is pressed.
//   - The MID TALLY is a FULL tally that BANKS (owner's call): every line pays
//     exactly as the final one does, the board stays, and early hands are
//     therefore paid twice. That is the reward for committing to lines early.
//   - 3 swaps and 3 BOARD-ONLY discards per grid, back at the next grid.
//   - 30s per deal (timeout auto-deals, expiring what it expires) and a hard
//     5:00 grid clock that runs through picks too; at zero the grid scores as
//     it stands.
//
// SCORING - best >=3-card hand per line, through the real calcScore
//   A line's hand is the best-paying SUBSET of its cards (3-4-3-7-3 is a Set of
//   3), so empties and junk cards simply don't count - nothing is subtracted.
//   One hand per line; a card is used once horizontally and once vertically by
//   construction. Runs are any-suit; suits matter only for flushes; the
//   Straight Flush is the lone suited-run entry (owner's call), and Two Pair is
//   in (4 cards >= the 3 minimum). The table below is Balatro-shaped pips x
//   mult, rounded to 5s, with every 5-card hand worth more than every 4-card
//   hand worth more than every 3-card hand - the owner's hard rule.
//
// FOCUS - three small generators, one slow drain, multiplies every tally
//   calcScore applies the Focus multiplier at its own step 5, so lines pay
//   x focusMultiplier() with no code here. What this file does is GENERATE it:
//   - CONNECTION STREAKS: a placement orthogonally touching a kindred card
//     (same rank, same suit, or one rank apart) pays +1 (+2 from streak 3).
//     A placement touching nothing kindred resets the streak.
//   - QUICK HANDS: pressing NEXT DEAL with half the deal clock left, having
//     placed something, pays +2.
//   - LINE IGNITION: the moment a line COMPLETES with a paying hand it ignites
//     (+3, a flare), once per line per grid.
//   The drain is 1 node per SQP_DECAY_MS - deliberately slower than the main
//   game's, per the owner: many small sources, slow decay.
//
// THE DRAG (research notes, r409)
//   Grounded in the Balatro feedback writeups (cards tilt toward the cursor,
//   spring-bounce on landing, feedback layers stack): the ghost is the REAL
//   CARD FACE at board scale, it TILTS with horizontal velocity and springs
//   back, the target cell glows softly (no green footprint - you are holding a
//   card, not filling a form), and a landed card takes a settle pop. All of it
//   rides squares-mode's r375 drag machine; a single card is a 1-cell piece.
// ══════════════════════════════════════════════════════════════════════════

function sqPatActive() {
  return typeof squaresActive === 'function' && squaresActive() && SQ_N === 5
      && !(typeof sqDaily === 'function' && sqDaily());
}

// ── Tunables ───────────────────────────────────────────────────────────────
const SQP_GRIDS       = 2;    // grids in a run ("maybe 2-3" - 2 keeps it daily-length)
const SQP_DEALS       = 8;    // 3-card deals per grid; deal 9 is the 5-card final
const SQP_FINAL_CARDS = 5;
const SQP_DEAL_SECS   = 30;   // per-deal timer; timeout deals on
const SQP_GRID_SECS   = 300;  // the hard grid clock
const SQP_SWAPS       = 3;
const SQP_DISCARDS    = 3;    // board-only
const SQP_PICK_N      = 5;    // trick offers per pick
// Focus
const SQP_F_ADJ        = 1;   // kindred placement
const SQP_F_ADJ_HOT    = 2;   // ...at streak >= SQP_F_STREAK_HOT
const SQP_F_STREAK_HOT = 3;
const SQP_F_IGNITE     = 3;   // completing a paying line
const SQP_F_SPEED      = 2;   // NEXT DEAL with half the clock left
const SQP_DECAY_MS     = 9000;

// ── THE VALUE TABLE ────────────────────────────────────────────────────────
// Keys are real HAND_BASE names, so calcScore needs nothing new. Ordered by
// how likely each is under THIS format (a player placing 29 offered cards into
// lines where any >=3 subset counts): flushes are the easiest spot at every
// length (the r178 doctrine - a suit match is a colour match), runs middle,
// sets dearest; Two Pair sits between Flush of 4 and Run of 4; quads top the
// 4s. Every 5-card hand out-worths every 4-card hand out-worths every 3-card
// hand (pips x mult: 40/60/135 · 180/210/280/450 · 500/550/720/1500).
const SQP_HAND_VALUES = {
  'High Card':       { pips: 0,   mult: 1  },
  'Flush of 3':      { pips: 20,  mult: 2  },
  'Run of 3':        { pips: 30,  mult: 2  },
  'Three of a Kind': { pips: 45,  mult: 3  },
  'Flush of 4':      { pips: 60,  mult: 3  },
  'Two Pair':        { pips: 70,  mult: 3  },
  'Run of 4':        { pips: 70,  mult: 4  },
  'Four of a Kind':  { pips: 90,  mult: 5  },
  'Flush':           { pips: 100, mult: 5  },
  'Straight':        { pips: 110, mult: 5  },
  'Full House':      { pips: 120, mult: 6  },
  'Straight Flush':  { pips: 150, mult: 10 },
};
const SQP_LADDER = ['High Card','Flush of 3','Run of 3','Three of a Kind','Flush of 4',
                    'Two Pair','Run of 4','Four of a Kind','Flush','Straight','Full House','Straight Flush'];
const sqpHandRank = n => SQP_LADDER.indexOf(n);
const sqpWorth = n => { const v = SQP_HAND_VALUES[n]; return v ? v.pips * v.mult : 0; };

// ── State ──────────────────────────────────────────────────────────────────
let sqpGrid = 1, sqpDealNo = 0, sqpSerial = 0;
let sqpSwapsLeft = SQP_SWAPS, sqpDiscLeft = SQP_DISCARDS;
let sqpSel = [];                 // selected PLACED cells [[r,c]..], max 2
let sqpGridClock = SQP_GRID_SECS, sqpDealClock = SQP_DEAL_SECS, sqpTimer = null;
let sqpStreak = 0, sqpIgnited = new Set(), sqpPlacedThisDeal = 0;
let sqpGridOver = false, sqpPickOpen = false;
let _sqpDecayAcc = 0;

const sqpFmt = s => Math.floor(Math.max(0, s) / 60) + ':' + String(Math.max(0, s) % 60).padStart(2, '0');

// ══════════════════════════════════════════════
// SCORING - the best >=3-card subset of a line
// ══════════════════════════════════════════════
const sqpAceLow  = () => (typeof RANK_ORDER !== 'undefined' && RANK_ORDER.A != null) ? RANK_ORDER.A : 1;
const sqpAceHigh = () => sqpAceLow() + 13;

// Name the best hand this EXACT set of cards makes, or null. The set is the
// whole hand - no kickers here, unlike the old 5x5 - so "all" means all.
function sqpNameSet(cards) {
  const n = cards.length;
  if (n < 3 || n > 5) return null;
  const vals = cards.map(sqRank);
  if (vals.some(v => v == null)) return null;
  const cnt = {}; cards.forEach(c => { cnt[c.rank] = (cnt[c.rank] || 0) + 1; });
  const cv = Object.values(cnt).sort((a, b) => b - a);
  const suited = cards.every(c => c.suit === cards[0].suit);
  const distinct = new Set(vals).size === n;
  let run = false;
  if (distinct) {
    const vs = vals.slice().sort((a, b) => a - b);
    const con = a => a.every((v, i) => i === 0 || v === a[i - 1] + 1);
    run = con(vs) || (vs[0] === sqpAceLow() && con([...vs.slice(1), sqpAceHigh()]));
  }
  const names = [];
  if (cv[0] === n && n <= 4)                names.push(n === 3 ? 'Three of a Kind' : 'Four of a Kind');
  if (n === 5 && cv[0] === 3 && cv[1] === 2) names.push('Full House');
  if (n === 4 && cv[0] === 2 && cv[1] === 2) names.push('Two Pair');
  if (run) names.push(n === 3 ? 'Run of 3' : n === 4 ? 'Run of 4' : (suited ? 'Straight Flush' : 'Straight'));
  if (suited) names.push(n === 3 ? 'Flush of 3' : n === 4 ? 'Flush of 4' : 'Flush');
  if (!names.length) return null;
  return names.sort((a, b) => sqpWorth(b) - sqpWorth(a))[0];
}

// Score ONE line: enumerate every >=3-card subset (<=2^5), name each, rank the
// candidates cheaply by table worth + card pips, then run the top few through
// the REAL calcScore so Tricks, buffs and marks decide the winner. Read-only
// and speculative-safe, like sqScoreLine before it.
function sqpScoreLine(i) {
  const all = sqLineCells(i).filter(([r, c]) => gridData[r] && gridData[r][c]);
  // A line with no hand is NOTHING, not a High Card - the headers and the
  // scoreboard would otherwise print "HIGH 0" over every part-filled line.
  const none = { i, name: '', cells: [], cards: [], pen: 0, total: 0, pips: 0, mult: 1, r: 0 };
  if (all.length < 3) return none;
  const n = all.length;
  const pip = ([r, c]) => (typeof cardPips === 'function') ? (cardPips(gridData[r][c]) || 0) : 0;
  const cands = [];
  for (let m = 1; m < (1 << n); m++) {
    let bits = 0; for (let k = 0; k < n; k++) if (m & (1 << k)) bits++;
    if (bits < 3) continue;
    const cells = []; for (let k = 0; k < n; k++) if (m & (1 << k)) cells.push(all[k]);
    const name = sqpNameSet(cells.map(([r, c]) => gridData[r][c]));
    if (!name) continue;
    cands.push({ name, cells, est: sqpWorth(name) + cells.reduce((s, cl) => s + pip(cl), 0) });
  }
  if (!cands.length) return none;
  cands.sort((a, b) => b.est - a.est);
  // Top 4 by the cheap estimate, priced by the REAL calcScore. The estimate
  // (table worth + raw card pips) cannot see tricks, so a heavily buffed
  // off-name candidate could rank low; four covers every cross-name upset a
  // line of five cards can hold, and the whole board still prices in ~2ms.
  let best = null;
  for (const cd of cands.slice(0, 4)) {
    let total = 0;
    try { total = (typeof calcScore === 'function') ? calcScore(cd.name, cd.cells) : 0; } catch (e) { total = 0; }
    const f = { i, name: cd.name, cells: cd.cells, cards: cd.cells.map(([r, c]) => gridData[r][c]),
                pen: 0, total: Math.max(0, Math.round(total)),
                pips: (typeof lastCalcPips === 'number') ? lastCalcPips : 0,
                mult: (typeof lastCalcMult === 'number') ? lastCalcMult : 1,
                r: sqpHandRank(cd.name) };
    if (!best || f.total > best.total) best = f;
  }
  return best || none;
}
function sqpScoringLines() {
  const out = [];
  for (let i = 0; i < SQ_LINES(); i++) { const f = sqLineResult(i); if (f && f.total > 0) out.push(i); }
  return out;
}

// ══════════════════════════════════════════════
// RUN / GRID / DEAL FLOW
// ══════════════════════════════════════════════
function sqpBegin() {
  sqpGrid = 1; sqTotal = 0; sqRoundScore = 0; sqdGrids = []; sqLog = [];
  document.body.classList.add('squares-pat');
  document.getElementById('stage')?.classList.add('squares-pat');
  sqpStartGrid();
}

function sqpStartGrid() {
  sqpSerial++;
  // The whole deck, every grid: board and hand go back and the lot reshuffles,
  // so a card DISCARDED is gone for this grid and back next grid - the deck
  // belongs to the run (squares-mode decision 3).
  for (let r = 0; r < SQ_N; r++) for (let c = 0; c < SQ_N; c++) {
    if (gridData[r] && gridData[r][c]) { playedPile.push(gridData[r][c]); gridData[r][c] = null; }
  }
  sqHand.forEach(p => p.cells.forEach(cl => playedPile.push(cl.card)));
  sqHand = [];
  flushPlayedDeck();
  gridData = [];
  for (let r = 0; r < SQ_N; r++) { gridData[r] = []; for (let c = 0; c < SQ_N; c++) gridData[r][c] = null; }
  gridRows = SQ_N; gridCols = SQ_N;
  sqpDealNo = 0; sqpSwapsLeft = SQP_SWAPS; sqpDiscLeft = SQP_DISCARDS; sqpSel = [];
  sqpStreak = 0; sqpIgnited = new Set(); sqpPlacedThisDeal = 0;
  sqpGridClock = SQP_GRID_SECS; sqpGridOver = false; _sqpDecayAcc = 0;
  sqRoundScore = 0; sqLog = []; sqdPlaced = [];
  sqTentative = null; sqSelected = null;
  // Focus resets per grid (the main game's r397 rule: the meter zeroes at every
  // level); the drain and the three generators give it its shape from there.
  if (typeof resetFocusMeter === 'function') { try { resetFocusMeter(); } catch (e) {} }
  if (typeof recomputeGridMetrics === 'function') recomputeGridMetrics();
  sqpEnsureTimer();
  sqPhase = 'between';
  sqRenderAll();
  const s = sqpSerial;
  sqpOpenPick('Before the first deal', () => { if (s === sqpSerial) sqpServeDeal(); });
}

function sqpServeDeal() {
  if (sqpGridOver) return;
  const n = sqpDealNo + 1;
  // EXPIRY: a card lasts one deal past the one it arrived in. Serving deal N
  // drops anything born before deal N-1 - which is "older cards go away when
  // you next press NEXT DEAL", measured from the deal being served.
  const stale = sqHand.filter(p => (p.bornDeal || 0) < n - 1);
  if (stale.length) {
    stale.forEach(p => p.cells.forEach(cl => playedPile.push(cl.card)));
    sqHand = sqHand.filter(p => (p.bornDeal || 0) >= n - 1);
    showMessage?.(`${stale.length} card${stale.length > 1 ? 's' : ''} left your hand.`, 'var(--cream-dim)');
  }
  sqpDealNo = n;
  const count = n > SQP_DEALS ? SQP_FINAL_CARDS : 3;
  for (let k = 0; k < count; k++) {
    // `fresh` marks the cards of THIS deal for the tray's deal-in animation and
    // is cleared by the first render - without it every repaint (each placement,
    // each resize) replayed the entrance on cards already sitting there.
    sqHand.push({ id: 'sqp' + (++sqPieceId), bornDeal: n, fresh: true, cells: [{ dr: 0, dc: 0, card: sqDraw() }] });
  }
  sqpDealClock = SQP_DEAL_SECS; sqpPlacedThisDeal = 0;
  sqTentative = null; sqSelected = null;
  sqPhase = 'place';
  if (typeof sfxFlipShuffle === 'function') sfxFlipShuffle();
  sqRenderAll();
}

// NEXT DEAL / SCORE - the play button, and the 30s timeout. Debounced: a
// double-tap must not skip a whole deal (serving is synchronous, so the second
// tap of one gesture lands on a live 'place' phase and would advance again).
let _sqpNextAt = 0;
function sqpNextPressed() {
  if (!sqPatActive() || sqPhase !== 'place' || sqDragging || sqpGridOver) return;
  const now = Date.now();
  if (now - _sqpNextAt < 350) return;
  _sqpNextAt = now;
  // QUICK HANDS: moving on with half the clock left, having placed something.
  if (sqpPlacedThisDeal > 0 && sqpDealClock >= SQP_DEAL_SECS / 2) sqpFocus(SQP_F_SPEED);
  if (sqpDealNo > SQP_DEALS) { sqpFinishGrid(); return; }       // the final deal → SCORE
  const d = sqpDealNo, s = sqpSerial;
  const serve = () => { if (s === sqpSerial) sqpServeDeal(); };
  if (d % 2 === 0) {
    // After deals 2/4/6/8 a trick pick; after the SECOND of those (deal 4 - the
    // third trick counting the opener) the MID TALLY banks and play continues.
    sqPhase = 'between'; sqTentative = null; sqSelected = null; sqRenderAll();
    const after = (d === 4) ? () => { if (s === sqpSerial) sqpMidTally(serve); } : serve;
    sqpOpenPick(`After deal ${d}`, after);
  } else serve();
}

async function sqpMidTally(done) {
  sqPhase = 'scoring'; sqpSel = []; sqRenderAll();
  const lines = sqpScoringLines();
  if (lines.length) await sqRunTally(lines);
  showMessage?.('Mid payout banked. The board plays on.', 'var(--gold)');
  if (typeof sfxLevelUp === 'function') sfxLevelUp();
  done();
}

async function sqpFinishGrid() {
  if (sqpGridOver) return;
  sqpGridOver = true; sqpPickOpen = false;
  sqCloseOverlay();
  sqpHideDrag();
  sqPhase = 'scoring'; sqTentative = null; sqSelected = null; sqpSel = [];
  sqRenderAll();
  const lines = sqpScoringLines();
  if (lines.length) await sqRunTally(lines);
  sqdRecordGrid(0);
  sqPhase = 'between'; sqRenderAll();
  if (sqpGrid >= SQP_GRIDS) { sqpRunDone(); return; }
  if (typeof sfxLevelUp === 'function') sfxLevelUp();
  sqReport(`Grid ${sqpGrid} banked`,
    `  SCORE SO FAR   ${sqTotal.toLocaleString()}\n\n` +
    `  Grid ${sqpGrid + 1} of ${SQP_GRIDS}. Fresh deck, fresh board, fresh clock.\n` +
    `  Swaps and discards are back to ${SQP_SWAPS}. Your tricks ride along.`,
    () => { sqpGrid++; sqpStartGrid(); });
}
function sqpRunDone() {
  sqpStopTimer();
  if (typeof sfxVictory === 'function') sfxVictory();
  if (typeof sqdShowScoreboard === 'function' && sqdGrids.length) { sqdShowScoreboard(sqdDone); return; }
  sqdDone();
}
// A drag in flight when the grid is forced over must be put down, or the ghost
// stays glued to the screen through the tally.
function sqpHideDrag() {
  if (!sqDragging) return;
  if (typeof sqReleaseDrag === 'function') sqReleaseDrag();
  sqDragging = null; sqLiftRec = null; sqTentative = null;
}

// ── The clock(s) ───────────────────────────────────────────────────────────
function sqpEnsureTimer() { if (!sqpTimer) sqpTimer = setInterval(sqpTick, 1000); }
function sqpStopTimer()   { if (sqpTimer) { clearInterval(sqpTimer); sqpTimer = null; } }
function sqpTick() {
  if (!sqPatActive()) { sqpStopTimer(); return; }
  if (typeof isPaused !== 'undefined' && isPaused) return;
  if (sqPhase === 'scoring' || sqpGridOver) return;             // the tally's time is free
  // THE GRID CLOCK RUNS THROUGH THE PICKS TOO - that is what makes 5:00 a hard
  // ceiling rather than arithmetic the deal clocks already guarantee.
  sqpGridClock--;
  if (sqpGridClock <= 0) {
    showMessage?.('Time. The grid scores as it stands.', 'var(--red)');
    sqpFinishGrid();
    return;
  }
  if (sqPhase === 'place') {
    sqpDealClock--;
    _sqpDecayAcc += 1000;
    if (_sqpDecayAcc >= SQP_DECAY_MS) {
      _sqpDecayAcc = 0;
      if (typeof focusNodes === 'number' && focusNodes > 0 && typeof removeFocus === 'function') removeFocus(1);
    }
    // Timeout deals on - held while a drag is mid-air, fired the next tick.
    if (sqpDealClock <= 0 && !sqDragging) {
      if (sqpDealNo > SQP_DEALS) { sqpFinishGrid(); return; }
      showMessage?.('Dealt on.', 'var(--cream-dim)');
      sqpNextPressed();
      return;
    }
  }
  sqpTickUI();
}
// The per-second repaint, without a render: the two clock readouts only.
function sqpTickUI() {
  document.querySelectorAll('.sqp-clock').forEach(el => {
    el.textContent = sqpFmt(sqpGridClock);
    el.classList.toggle('hot', sqpGridClock <= 30);
  });
  document.querySelectorAll('.sqp-dealclock').forEach(d => {
    d.textContent = Math.max(0, sqpDealClock) + 's';
    d.classList.toggle('hot', sqpDealClock <= 8);
  });
}

// ══════════════════════════════════════════════
// FOCUS - the three generators
// ══════════════════════════════════════════════
function sqpFocus(n) {
  if (n > 0 && typeof addFocus === 'function') { try { addFocus(n); } catch (e) {} }
}
const SQP_ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
function sqpKindred(a, b) {
  if (!a || !b) return false;
  if (a.rank === b.rank || a.suit === b.suit) return true;
  const va = sqRank(a), vb = sqRank(b);
  return va != null && vb != null && Math.abs(va - vb) === 1;
}
// Called from sqConfirm the moment a card lands, before the render.
function sqpOnPlaced(piece, r, c) {
  sqpPlacedThisDeal++;
  const card = piece.cells[0] && piece.cells[0].card;
  // CONNECTION STREAK
  let kin = false;
  for (const [dr, dc] of SQP_ORTH) {
    const nb = gridData[r + dr] && gridData[r + dr][c + dc];
    if (nb && sqpKindred(card, nb)) { kin = true; break; }
  }
  if (kin) { sqpStreak++; sqpFocus(sqpStreak >= SQP_F_STREAK_HOT ? SQP_F_ADJ_HOT : SQP_F_ADJ); }
  else sqpStreak = 0;
  // LINE IGNITION - the row and the column this card completed, if it did.
  [r, SQ_N + c].forEach(i => {
    if (sqpIgnited.has(i)) return;
    if (!sqLineCells(i).every(([rr, cc]) => gridData[rr] && gridData[rr][cc])) return;
    const f = sqpScoreLine(i);
    if (!f || f.total <= 0) return;
    sqpIgnited.add(i);
    sqpFocus(SQP_F_IGNITE);
    sqWave(i, 700);
    setTimeout(() => sqUnwave(i), 1100);
    if (typeof sfxRewardGood === 'function') sfxRewardGood();
    showMessage?.(`${sqLineName(i)} lit · ${f.name}`, 'var(--gold)');
  });
  // The settle pop, after the render that sqConfirm is about to run.
  const id = (typeof cardId === 'function' && card) ? cardId(card) : null;
  requestAnimationFrame(() => {
    if (id == null) return;
    const el = document.querySelector(`#grid [data-card-id="${id}"]`);
    if (!el) return;
    el.classList.add('sqp-land'); if (kin) el.classList.add('sqp-kin');
    setTimeout(() => { el.classList.remove('sqp-land', 'sqp-kin'); }, 650);
  });
}

// ══════════════════════════════════════════════
// SWAP · DISCARD · SELECTION (board-only, 3 each per grid)
// ══════════════════════════════════════════════
function sqpBoardTap(r, c) {
  if (sqPhase !== 'place' || sqpGridOver) return;
  if (!gridData[r] || !gridData[r][c]) return;
  const at = sqpSel.findIndex(p => p[0] === r && p[1] === c);
  if (at >= 0) sqpSel.splice(at, 1);
  else { sqpSel.push([r, c]); if (sqpSel.length > 2) sqpSel.shift(); }
  if (typeof sfxCardSelect === 'function') sfxCardSelect();
  sqpPaintSelRings();
  sqpPaintButtons();
}
function sqpSwapPressed() {
  if (!sqPatActive() || sqPhase !== 'place') return;
  if (sqpSwapsLeft <= 0)    { refuse?.('No swaps left this grid.'); return; }
  if (sqpSel.length !== 2)  { refuse?.('Pick two placed cards to swap.'); return; }
  const [a, b] = sqpSel;
  const t = gridData[a[0]][a[1]];
  gridData[a[0]][a[1]] = gridData[b[0]][b[1]];
  gridData[b[0]][b[1]] = t;
  sqpSwapsLeft--; sqpSel = []; sqpStreak = 0;
  if (typeof sfxCardPop === 'function') sfxCardPop(t && t.suit);
  sqRenderAll();
  [a, b].forEach(([r, c]) => {
    const cd = gridData[r][c]; if (!cd) return;
    const el = document.querySelector(`#grid [data-card-id="${cardId(cd)}"]`);
    if (el) { el.classList.add('sqp-land'); setTimeout(() => el.classList.remove('sqp-land'), 650); }
  });
}
function sqpDiscardPressed() {
  if (!sqPatActive() || sqPhase !== 'place') return;
  if (sqpDiscLeft <= 0)    { refuse?.('No discards left this grid.'); return; }
  if (sqpSel.length !== 1) { refuse?.('Pick one placed card to discard.'); return; }
  const [r, c] = sqpSel[0];
  const cd = gridData[r][c]; if (!cd) { sqpSel = []; return; }
  playedPile.push(cd);
  gridData[r][c] = null;
  sqpDiscLeft--; sqpSel = []; sqpStreak = 0;
  if (typeof sfxCardDiscard === 'function') sfxCardDiscard();
  sqRenderAll();
}

// ══════════════════════════════════════════════
// RENDER - the patience pieces of sqRenderAll
// ══════════════════════════════════════════════
// The hand: real card faces, one per dealt card, newest deal first. A card from
// the PREVIOUS deal is marked LAST CALL - it expires at the next NEXT DEAL.
function sqpRenderHand() {
  const host = document.getElementById('selected-cards'); if (!host) return;
  host.classList.add('sq-hand', 'sqp-hand');
  host.innerHTML = '';
  if (!sqHand.length) {
    host.innerHTML = `<div class="sq-empty">${sqPhase === 'place' ? 'nothing in hand' : ''}</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  let freshIdx = 0;
  sqHand.forEach(p => {
    const card = p.cells[0].card;
    const stale = (p.bornDeal || 0) < sqpDealNo;
    const el = document.createElement('div');
    el.className = 'sq-tile sqp-card' + (stale ? ' sqp-stale' : '')
      + (p.fresh ? ' sqp-in' : '')
      + (sqSelected === p ? ' sel' : '')
      + ((sqTentative && sqTentative.piece === p) || sqDragging === p ? ' placing' : '');
    // The stagger is written inline off the FRESH index, not nth-child - the
    // holdover cards render first and must not eat the new cards' delays.
    if (p.fresh) { el.style.animationDelay = (freshIdx++ * 0.05) + 's'; p.fresh = false; }
    el.dataset.pid = p.id;
    el.innerHTML = sqpFaceHTML(card) + (stale ? '<span class="sqp-last">LAST CALL</span>' : '');
    frag.appendChild(el);
  });
  host.appendChild(frag);
  sqpFitHand();
  requestAnimationFrame(sqpFitHand);   // the r309 second pass: measure a settled layout
}
function sqpFaceHTML(card, w, h) {
  let a = null;
  try { a = (typeof renderCardAppearance === 'function') ? renderCardAppearance(card, 0, 0, {}) : null; } catch (e) {}
  const size = (w && h) ? ` style="--card-w:${w}px;--card-h:${h}px"` : '';
  if (!a) return `<div class="sqp-face-fallback"${size}>${card.rank}${card.suit}</div>`;
  return `<div class="sqp-facebox"${size}><div class="${a.className} sqp-face">${a.innerHTML}</div></div>`;
}
// Size the faces to the measured tray: one row up to 3 cards, two rows past it
// (fresh deal above, holdovers below, which is what the wrap gives for free).
function sqpFitHand() {
  const host = document.getElementById('selected-cards'); if (!host) return;
  const cards = host.querySelectorAll('.sqp-card'); if (!cards.length) return;
  const W = host.clientWidth - 16, H = host.clientHeight - 14;
  if (W < 40 || H < 40) return;
  const n = cards.length;
  const rows = n > 3 ? 2 : 1, perRow = Math.ceil(n / rows);
  let ch = Math.floor(H / rows) - 8 - (rows > 1 ? 14 : 0);
  let cw = Math.round(ch * 0.74);
  const maxW = Math.floor(W / perRow) - 8;
  if (cw > maxW) { cw = maxW; ch = Math.round(cw / 0.74); }
  cw = Math.max(30, cw); ch = Math.max(40, ch);
  cards.forEach(el => {
    el.style.width = (cw + 6) + 'px'; el.style.height = (ch + 6) + 'px';
    const box = el.querySelector('.sqp-facebox');
    if (box) { box.style.setProperty('--card-w', cw + 'px'); box.style.setProperty('--card-h', ch + 'px'); }
  });
}

// The stock, in the goal box: swaps and discards as pips, plus the live streak.
function sqpRenderStock() {
  const box = document.getElementById('score-to-go'); if (!box) return;
  let host = document.getElementById('sq-cons-row');
  if (!host) { host = document.createElement('div'); host.id = 'sq-cons-row'; box.appendChild(host); }
  const pips = (left, max) => {
    let s = '<span class="sqp-pips">';
    for (let i = 0; i < max; i++) s += `<i class="${i < left ? 'on' : ''}"></i>`;
    return s + '</span>';
  };
  host.innerHTML =
    `<div class="sqp-stock"><span class="sqp-sl">SWAP</span>${pips(sqpSwapsLeft, SQP_SWAPS)}</div>` +
    `<div class="sqp-stock"><span class="sqp-sl">DROP</span>${pips(sqpDiscLeft, SQP_DISCARDS)}</div>` +
    (sqpStreak >= 2 ? `<div class="sqp-streak" title="connection streak">⚡${sqpStreak}</div>` : '');
}

function sqpPaintButtons() {
  sqEnterButtons();
  const play = document.getElementById('btn-play'), disc = document.getElementById('btn-discard'),
        swap = document.getElementById('swap-indicator');
  const placing = sqPhase === 'place' && !sqpGridOver;
  const finalServed = sqpDealNo > SQP_DEALS;
  if (play) {
    play.disabled = !placing;
    play.innerHTML = finalServed
      ? `SCORE<small>the grid pays out</small>`
      : placing
        ? `NEXT DEAL<small><span class="sqp-dealclock${sqpDealClock <= 8 ? ' hot' : ''}">${Math.max(0, sqpDealClock)}s</span></small>`
        : `NEXT DEAL<small>·</small>`;
  }
  if (disc) {
    disc.disabled = !(placing && sqpSel.length === 1 && sqpDiscLeft > 0);
    disc.innerHTML = `DISCARD<small>${sqpDiscLeft} left · board</small>`;
  }
  if (swap) {
    const can = placing && sqpSel.length === 2 && sqpSwapsLeft > 0;
    swap.classList.toggle('sq-off', !can);
    swap.classList.toggle('sqp-armed', can);
    swap.innerHTML = `<span class="sq-endw">SWAP</span><span class="sq-ends">${sqpSwapsLeft} left</span>`;
  }
}

function sqpPaintHud() {
  sqPaintScore();
  const rd = document.getElementById('sq-round');
  if (rd) {
    const v = rd.querySelector('.sqr-v'); if (v) v.textContent = `${sqpGrid}/${SQP_GRIDS}`;
    const l = rd.querySelector('.sqr-l'); if (l) l.textContent = 'GRID';
  }
  const pl = document.querySelector('#pips-box .subbox-label'),
        ml = document.querySelector('#mult-box .subbox-label'),
        tx = document.querySelector('#score-subboxes .subbox-times');
  if (pl) pl.textContent = (typeof lexTerm === 'function') ? lexTerm('pips') : 'PIPS';
  if (ml) ml.textContent = (typeof lexTerm === 'function') ? lexTerm('mult') : 'MULT';
  if (tx) tx.textContent = '×';
  const gl = document.getElementById('score-goal-label');
  if (gl) gl.textContent = 'STOCK';
  const tl = document.getElementById('score-total-label');
  if (tl) tl.textContent = 'SCORE';
  sqpSetBanner();
  if (sqPhase === 'place') sqPaintLiveChips();
}

// The banner: the grid clock, the deal counter, and the pay-table handle.
function sqpSetBanner() {
  const slot = document.getElementById('grid-slot'); if (!slot) return;
  let b = document.getElementById('sq-banner');
  if (!b) { b = document.createElement('div'); b.id = 'sq-banner'; slot.appendChild(b); }
  if (sqPhase === 'scoring') return;                 // the tally owns the banner
  const deal = sqpDealNo === 0 ? ''
    : sqpDealNo > SQP_DEALS ? 'FINAL DEAL'
    : `DEAL ${sqpDealNo}/${SQP_DEALS}`;
  // The deal countdown rides the banner as well as the play button - in
  // portrait the button's <small> has no room, and the banner is on screen in
  // both orientations.
  const dc = sqPhase === 'place'
    ? ` · <span class="sqp-dealclock${sqpDealClock <= 8 ? ' hot' : ''}">${Math.max(0, sqpDealClock)}s</span>` : '';
  b.innerHTML =
    `<span class="sq-btext"><span class="sqp-clock${sqpGridClock <= 30 ? ' hot' : ''}">${sqpFmt(sqpGridClock)}</span>`
    + (deal ? ` · ${deal}` : '') + dc + `</span>`
    + `<span class="sq-bhelp" title="The scoring ladder">▤</span>`;
  b.classList.add('on', 'sq-btap');
  b.onclick = e => { e.stopPropagation(); sqpPayTip(b); };
}
function sqpPayTip(anchor) {
  const rows = SQP_LADDER.filter(n => n !== 'High Card').map(n => {
    const v = SQP_HAND_VALUES[n];
    return `<tr><td>${n}</td><td class="n">${v.pips} × ${v.mult}</td></tr>`;
  }).join('');
  sqShowTip('sqp-pay',
    `<div class="sqt-h">The ladder</div>`
    + `<table class="sqt-t">${rows}</table>`
    + `<div class="sqt-foot">Best hand of 3+ cards per row and column · plus the cards' own pips · × Focus</div>`,
    anchor.getBoundingClientRect());
}

// Selection rings over the two picked cells - siblings of the cards, class
// cleaned by squaresTeardown like every other mode-owned child of #grid.
function sqpPaintSelRings() {
  const g = document.getElementById('grid'); if (!g) return;
  g.querySelectorAll('.sqp-ring').forEach(el => el.remove());
  if (!sqPatActive() || sqPhase !== 'place') return;
  sqpSel.forEach(([r, c]) => {
    if (!gridData[r] || !gridData[r][c]) return;
    const d = document.createElement('div');
    d.className = 'sqp-ring';
    d.style.cssText = `left:${cellLeft(c)}px;top:${cellTop(r)}px;width:${CARD_W}px;height:${CARD_H}px`;
    g.appendChild(d);
  });
}
// The extra painters sqRenderAll calls for this mode.
function sqpPaintExtras() {
  // A selection can point at a cell a discard or swap has since emptied.
  sqpSel = sqpSel.filter(([r, c]) => gridData[r] && gridData[r][c]);
  sqpPaintSelRings();
}

// ══════════════════════════════════════════════
// THE TRICK PICK - 1 of 5, its own popup
// ══════════════════════════════════════════════
// A full tray REFUSES the take (r277); the popup shows what you own with a
// DROP on each, so freeing the slot happens on the same screen.
//
// WHAT IS OFFERABLE: the old 5x5's description-predicate (sqTrickBanned) still
// answers for everything this mode lacks - a main-game clock, credits, the
// swap/discard stocks, levels, "hands played". The ONE difference is Focus:
// this mode HAS it, but Focus-GRANTING tricks pay through playHand, which never
// runs here, so the ban stays - except for the two that merely READ the
// multiplier inside calcScore, which genuinely work.
const SQP_TRICK_ALLOW = new Set(['flow_state', 'redline']);
// Dead by MECHANISM, not by wording: these pass the description predicate but
// grant through playHand (permanent card buffs, priming), which never runs in
// squares. Audited mechanically - allowed tricks whose id appears nowhere in
// js/scoring.js - plus wild_side, whose counter (negative reward tiles taken)
// never moves here. Re-run that audit if the pool grows.
const SQP_TRICK_DENY = new Set(['rare_bloom', 'wild_heart', 'rowcol_perm_double',
  'sixes_perm', 'fours_perm', 'prime_times', 'heartwood', 'wild_side']);
function sqpTrickBanned(t) {
  if (SQP_TRICK_ALLOW.has(t.id)) return false;
  if (SQP_TRICK_DENY.has(t.id)) return true;
  const d = ((t.desc || '') + ' ' + (t.name || '')).toLowerCase();
  if (/reward tile/.test(d)) return true;            // no reward grid here
  if (/sleight|knack/.test(d)) return true;          // neither is ever granted here
  return sqTrickBanned(t);
}
function sqpDropTrick(id) {
  const i = trickTray.findIndex(t => t.id === id);
  if (i < 0) return;
  const t = trickTray[i];
  trickTray.splice(i, 1);
  const ai = acquiredTricks.findIndex(x => x.id === id);
  if (ai >= 0) acquiredTricks.splice(ai, 1);
  if (typeof sfxCardDiscard === 'function') sfxCardDiscard();
  showMessage?.(`Dropped ${t.name}.`, 'var(--cream-dim)');
  if (typeof renderTrickTray === 'function') renderTrickTray();
}

function sqpOpenPick(subtitle, done) {
  const owned = new Set((acquiredTricks || []).map(t => t.id));
  const pool = (typeof TRICK_POOL !== 'undefined' ? TRICK_POOL : [])
    .filter(t => !owned.has(t.id) && !sqpTrickBanned(t));
  if (!pool.length) { done(); return; }
  const offers = [];
  const left = pool.slice();
  for (let i = 0; i < SQP_PICK_N && left.length; i++) {
    const d = (typeof pickEntityByRarity === 'function' && pickEntityByRarity(left, e => e.tier || 'common'))
            || left[Math.floor(Math.random() * left.length)];
    left.splice(left.indexOf(d), 1);
    offers.push(d);
  }
  sqpPickOpen = true;
  let sel = -1;
  const ov = sqOverlay();
  ov.classList.add('sqp-pick');
  ov.querySelector('.sq-eyebrow').textContent = subtitle;
  ov.querySelector('.sq-title').textContent = 'Take a trick';
  ov.querySelector('.sq-lead').innerHTML =
    `One of five. It pays on every line it touches, this grid and the next. · <span class="sqp-clock">${sqpFmt(sqpGridClock)}</span>`;
  const tier = t => t.tier || 'common';
  const tileHTML = (t, i) => {
    const em = (typeof trickEmoji === 'function') ? trickEmoji(t) : '★';
    const pay = { entity: 'trick', icon: em, emoji: em, label: t.name, name: t.name,
                  desc: '', tier: tier(t), rarity: tier(t) };
    const tile = (typeof entityTileHTML === 'function')
      ? entityTileHTML(pay, tier(t), { tip: false })
      : `<div class="sqp-tilefall">${em}</div>`;
    const desc = (typeof trickLiveDesc === 'function') ? trickLiveDesc(t) : (t.desc || '');
    const tag = (typeof tierLabel === 'function') ? tierLabel('trick', tier(t)) : tier(t);
    return `<div class="sqp-offer rar-${tier(t)}" data-i="${i}">`
      + `<div class="sqp-tilebox">${tile}</div>`
      + `<div class="sqp-on">${t.name}</div>`
      + `<div class="sqp-tier">${tag}</div>`
      + `<div class="sqp-od">${desc}</div></div>`;
  };
  const ownedHTML = () => (trickTray || []).map(t =>
    `<div class="sqp-ownitem"><span class="sqp-oe">${(typeof trickEmoji === 'function') ? trickEmoji(t) : '★'}</span>`
    + `<i>${t.name}</i><b class="sqp-dropbtn" data-id="${t.id}" title="drop it">✕</b></div>`).join('')
    || '<span class="sqp-ownnone">none yet</span>';
  const cap = (typeof trickCapacity === 'function') ? trickCapacity() : 5;
  const paintOwn = () => {
    const bar = ov.querySelector('.sqp-ownbar'); if (!bar) return;
    bar.querySelector('.sqp-owned').innerHTML = ownedHTML();
    const n = bar.querySelector('#sqp-owncount'); if (n) n.textContent = `${trickTray.length}/${cap}`;
  };
  ov.querySelector('.sq-body').innerHTML =
    `<div class="sqp-offers">${offers.map(tileHTML).join('')}</div>`
    + `<div class="sqp-ownbar"><span class="sqp-ownlab">YOURS <b id="sqp-owncount">${trickTray.length}/${cap}</b></span>`
    + `<div class="sqp-owned">${ownedHTML()}</div></div>`;
  ov.querySelector('.sq-foot').innerHTML =
    `<button class="sq-btn go" id="sqp-take" disabled>TAKE IT</button>`
    + `<button class="sq-btn" id="sqp-skip">SKIP</button>`;
  const body = ov.querySelector('.sq-body');
  body.onclick = e => {
    const drop = e.target.closest && e.target.closest('.sqp-dropbtn');
    if (drop) { sqpDropTrick(drop.dataset.id); paintOwn(); return; }
    const off = e.target.closest && e.target.closest('.sqp-offer');
    if (!off) return;
    sel = +off.dataset.i;
    body.querySelectorAll('.sqp-offer').forEach(el => el.classList.toggle('sel', +el.dataset.i === sel));
    const take = ov.querySelector('#sqp-take');
    if (take) { take.disabled = false; take.textContent = `TAKE ${offers[sel].name.toUpperCase()}`; }
    if (typeof sfxRewardSelect === 'function') sfxRewardSelect();
  };
  const close = cb => {
    sqpPickOpen = false;
    ov.classList.remove('sqp-pick');
    sqCloseOverlay();
    cb && cb();
  };
  ov.querySelector('#sqp-take').onclick = () => {
    if (sel < 0) return;
    if (typeof trickTrayFull === 'function' && trickTrayFull()) {
      refuse?.('No room. Drop one of yours first.');
      const bar = ov.querySelector('.sqp-ownbar');
      if (bar) { bar.classList.remove('pulse'); void bar.offsetWidth; bar.classList.add('pulse'); }
      return;
    }
    const ok = (typeof injectTrickAfterReward === 'function') ? injectTrickAfterReward(offers[sel]) : false;
    if (!ok) { refuse?.('No room. Drop one of yours first.'); return; }
    if (typeof sfxRewardGood === 'function') sfxRewardGood();
    close(done);
  };
  ov.querySelector('#sqp-skip').onclick = () => close(done);
  sqShowOverlay();
  // Fit the disc labels AFTER the panel shows - a hidden element measures a
  // zero rect and the fitter leaves a long name to clip (the r239 rule).
  requestAnimationFrame(() => {
    if (typeof fitEntityName !== 'function') return;
    ov.querySelectorAll('.sqp-tilebox .rwd-name').forEach(el => { try { fitEntityName(el); } catch (e) {} });
  });
}

// ══════════════════════════════════════════════
// THE DRAG FEEL - ghost tilt (see the header's research notes)
// ══════════════════════════════════════════════
let _sqpTiltX = 0, _sqpTiltT = 0, _sqpTilt = 0, _sqpTiltTimer = null;
function sqpGhostHTML(p) {
  const k = (typeof sqBoardScale === 'function') ? sqBoardScale() : 1;
  const w = Math.round(CARD_W * k), h = Math.round(CARD_H * k);
  _sqpTiltX = 0; _sqpTiltT = 0; _sqpTilt = 0;
  return `<div class="sqp-ghostcard" style="width:${w}px;height:${h}px">${sqpFaceHTML(p.cells[0].card, w, h)}</div>`;
}
// Velocity → a few degrees of tilt toward the direction of travel, springing
// back to upright when the hand stops. The transition on .sqp-ghostcard does
// the spring; this only feeds it an angle.
function sqpGhostTilt(e) {
  const gc = sqDragEl && sqDragEl.querySelector('.sqp-ghostcard');
  if (!gc) return;
  const now = performance.now();
  if (_sqpTiltT) {
    const dt = Math.max(8, now - _sqpTiltT);
    const vx = (e.clientX - _sqpTiltX) / dt;             // px per ms
    const target = Math.max(-11, Math.min(11, vx * 26));
    _sqpTilt = _sqpTilt * 0.6 + target * 0.4;
    gc.style.setProperty('--sqp-tilt', _sqpTilt.toFixed(2) + 'deg');
  }
  _sqpTiltX = e.clientX; _sqpTiltT = now;
  clearTimeout(_sqpTiltTimer);
  _sqpTiltTimer = setTimeout(() => {
    _sqpTilt = 0;
    const g2 = sqDragEl && sqDragEl.querySelector('.sqp-ghostcard');
    if (g2) g2.style.setProperty('--sqp-tilt', '0deg');
  }, 90);
}

// ── Teardown ───────────────────────────────────────────────────────────────
function sqpTeardown() {
  sqpStopTimer();
  sqpPickOpen = false; sqpGridOver = false; sqpSel = [];
  document.body.classList.remove('squares-pat');
  document.getElementById('stage')?.classList.remove('squares-pat');
  document.getElementById('sq-overlay')?.classList.remove('sqp-pick');
}
