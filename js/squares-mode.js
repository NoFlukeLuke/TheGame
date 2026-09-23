// ══════════════════════════════════════════════════════════════════════════
// POKER SQUARES (r303) - js/squares-mode.js
//
// The 1930s solitaire, as a mode. You are dealt POLYOMINO TILES carrying real
// cards, you pack them onto a 5x5 board over four turns, and at the end of the
// round EVERY ROW AND EVERY COLUMN scores as a five-card poker hand. Ten lines,
// worst first. No goal, no clock: ten rounds, one score.
//
// FOUR DECISIONS THAT SHAPE THE WHOLE FILE
//
// 1. IT SCORES THROUGH THE REAL `calcScore`. A line is handed to it with the
//    poker hand it makes, exactly as Match-3 hands it its own hand names, so
//    every Trick, every per-card buff, every row/column mark and the PIPS/MULT
//    chips all work with no code here. What this mode overrides is only the
//    VALUE TABLE (squaresInstallHandValues) and the layering (handComponentsFor
//    returns null while it is live - see the note there).
//
// 2. REAL POKER HANDS ONLY, KICKERS INCLUDED. Flush of 3 / Run of 3 and the
//    other grid-shaped hands the main game invented are zeroed here: a line is
//    five cards, which is a poker hand, so it is scored as one. A pair with
//    three kickers is still One Pair - poker has never billed the kickers as
//    dead cards - so every hand covers the whole line and nothing is subtracted.
//    Measured over 15,000 bot-packed lines the mix lands within half a point of
//    real 5-card poker on every hand.
//
// 3. THE DECK BELONGS TO THE RUN. The pieces are dealt from the game's own
//    `drawPile` and hold REFERENCES to those card objects; the board holds the
//    same objects. That is the whole mechanism behind a consumable being
//    permanent - RE-SUIT mutates the object, the object is the deck's card, and
//    it comes back re-suited next round with no bookkeeping. Each round simply
//    returns the board and reshuffles the lot.
//
// 4. NO FOCUS, NO GOAL, NO CLOCK. Focus is never generated, so its multiplier
//    sits at 1 and the meter is hidden. There is no round goal, so the score
//    panel shows the ROUND instead of a bar. `squaresBeginRun` stops the timers
//    the way `mapBeginRun` does.
// ══════════════════════════════════════════════════════════════════════════

function squaresActive() { return !!(typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.squares); }

// THE BOARD SIZE IS A CHOICE NOW (r311), so this is a `let`. 5 is the original
// Poker Squares; 3 and 4 are the DAILY grids in js/squares-daily.js, which deal
// every tile at once and score without pips x mult. Everything below that reads
// SQ_N - the line list, the fit test, the cell hit-test, the overlays - works at
// any size already; what a daily changes is the TURN STRUCTURE and the SCORING.
let SQ_N = 5;
const SQ_LINES = () => SQ_N * 2;
const SQ_SCHEDULE = [{ n: 3, size: 4 }, { n: 3, size: 3 }, { n: 3, size: 2 }, { n: 3, size: 1 }];
const SQ_ROUNDS      = 10;   // the 5x5's run; a daily grid is SQD_SIZES[n].grids
const SQ_REPORT_LABEL = 13;   // 'best possible', the longest label in a report
const sqRounds = () => (typeof SQD_SIZES !== 'undefined' && SQD_SIZES[SQ_N]) ? SQD_SIZES[SQ_N].grids : SQ_ROUNDS;
const SQ_DISCARDS    = 3;    // per turn
const SQ_KEEP        = 1;    // you may end a turn holding this many
const SQ_FINAL_LINES = 3;    // SELECT SCORE cashes this many on the last turn
const SQ_CONS_CAP    = 5;
const SQ_REROLLS     = 2;
const SQ_HAND_MS     = 1400; // the first line of a tally; each one after is quicker
const SQ_ACCEL       = 5;    // % quicker per line

// The shapes, by cell count. Rotation is done on the offsets, so only one
// orientation of each is listed. Size 4 is I O T S Z J L, in that order - every
// free tetromino there is, so the variety below is a matter of WEIGHT, not of
// adding shapes that do not exist.
const SQ_SHAPES = {
  1: [[[0,0]]],
  2: [[[0,0],[0,1]]],
  3: [[[0,0],[0,1],[0,2]], [[0,0],[0,1],[1,0]]],
  4: [[[0,0],[0,1],[0,2],[0,3]], [[0,0],[0,1],[1,0],[1,1]],
      [[0,0],[0,1],[0,2],[1,1]], [[0,1],[0,2],[1,0],[1,1]],
      [[0,0],[0,1],[1,1],[1,2]], [[0,0],[1,0],[1,1],[1,2]],
      [[0,2],[1,0],[1,1],[1,2]]],
};
// A WEIGHTED BAG, NOT A RE-ROLL (r309). A flat draw gave the straight piece one
// turn in two at size 3 and one in seven at size 4, and - being memoryless - it
// could hand you three of the same shape in a single deal. Each form carries a
// weight (the bars are the lightest: a straight line is the least interesting
// thing to pack, and the one the owner asked to see less of), and the weighted
// list is dealt WITHOUT REPLACEMENT and reshuffled when it runs dry. That is
// what stops a run of identical tiles - a bag cannot repeat what it has spent.
const SQ_SHAPE_W = {
  1: [1],
  2: [1],
  3: [1, 3],                    // I3 is a quarter of the draw, not half
  4: [1, 3, 4, 2, 2, 3, 3],     // I O T S Z J L - I is 1 in 18, was 1 in 7
};
let sqBags = {};
function sqShapeDraw(size, avoid) {
  const forms = SQ_SHAPES[size] || SQ_SHAPES[1];
  if (forms.length < 2) return 0;
  let bag = sqBags[size];
  if (!bag || !bag.length) {
    const w = SQ_SHAPE_W[size] || forms.map(() => 1);
    bag = [];
    forms.forEach((f, i) => { for (let k = 0; k < (w[i] || 1); k++) bag.push(i); });
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    sqBags[size] = bag;
  }
  let idx = bag.shift();
  // A form already dealt twice this turn goes back into the bag at a random
  // depth and the SHALLOWEST DIFFERENT ONE is taken instead. Taking merely the
  // next entry is not enough - a heavy form appears in the bag several times
  // over, so the next one is very often the same form again. Measured at size 3
  // (two shapes, weighted 1:3): the next-entry version left 26% of deals all one
  // shape, the same as no guard at all.
  if (avoid && avoid.has(idx) && bag.length) {
    const at = bag.findIndex(f => !avoid.has(f));
    if (at >= 0) {
      const alt = bag.splice(at, 1)[0];
      bag.splice(Math.floor(Math.random() * (bag.length + 1)), 0, idx);
      idx = alt;
    }
  }
  return idx;
}

// ── THE VALUE TABLE ────────────────────────────────────────────────────────
// Ranked by genuine 5-card frequency and priced against the classic American
// Poker Squares ladder (0/2/5/10/15/20/25/50/75). Relative to a Pair this pays
// 1 / 2.3 / 4.9 / 7.5 / 10.1 / 12.4 / 24.9 against its 1 / 2.5 / 5 / 7.5 / 10 /
// 12.5 / 25. The one deliberate departure is the Straight Flush: the classic
// pays it 1.5x a Four of a Kind while it is genuinely 16x rarer, so here it is
// a jackpot at ~3.5x. Something to hunt.
//
// RUN OF 3 AND RUN OF 4 ARE THE TWO NON-KICKER HANDS (r309, owner's call). Every
// other hand here IS the line, kickers and all; these two use only the cards in
// the run and the cards left over SUBTRACT their pips, which is the owner's
// original rule for a line that only makes a short hand. Priced off their
// measured frequency in a random five-card line - a run of 4 turns up on 4.1% of
// lines (rarer than Two Pair at 4.75%, commoner than Trips at 2.1%) and a run of
// 3 on 19.8% (between Pair at 42% and Two Pair) - then handicapped for the pips
// they forfeit and the penalty they carry.
const SQ_HAND_VALUES = {
  'High Card':       { pips: 0,   mult: 1  },
  'Pair':            { pips: 30,  mult: 2  },
  'Run of 3':        { pips: 40,  mult: 2  },
  'Two Pair':        { pips: 65,  mult: 3  },
  'Run of 4':        { pips: 80,  mult: 4  },
  'Three of a Kind': { pips: 125, mult: 4  },
  'Straight':        { pips: 130, mult: 6  },
  'Flush':           { pips: 155, mult: 7  },
  'Full House':      { pips: 170, mult: 8  },
  'Four of a Kind':  { pips: 240, mult: 12 },
  'Straight Flush':  { pips: 500, mult: 22 },
};
// Everything else in HAND_BASE is a hand this mode does not have. Zeroed rather
// than deleted: a layered component or a stray lookup then pays nothing instead
// of throwing.
function squaresInstallHandValues() {
  if (typeof HAND_BASE === 'undefined') return;
  Object.keys(HAND_BASE).forEach(k => {
    if (SQ_HAND_VALUES[k]) { HAND_BASE[k].pips = SQ_HAND_VALUES[k].pips; HAND_BASE[k].mult = SQ_HAND_VALUES[k].mult; }
    else                   { HAND_BASE[k].pips = 0; HAND_BASE[k].mult = 1; }
  });
  // No Focus in this mode, so nothing may generate it.
  if (typeof HAND_FOCUS !== 'undefined') Object.keys(HAND_FOCUS).forEach(k => { HAND_FOCUS[k] = 0; });
}

const SQ_RANK_ORDER_FALLBACK = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
const sqRank = c => (typeof RANK_ORDER !== 'undefined' && RANK_ORDER[c.rank] != null) ? RANK_ORDER[c.rank] : SQ_RANK_ORDER_FALLBACK[c.rank];

// ── CONSUMABLES ────────────────────────────────────────────────────────────
// A random-direction consumable ROLLS ITS DIRECTION BEFORE IT IS OFFERED, so
// the pick tile reads "ECHO L - the card to the left takes this rank". Rolling
// at use time would make the tile a coin flip rather than a choice.
const SQ_CONS = [
  { id:'swap2',  icon:'🔀', name:'Shuffle',   need:2, d:()=>'Swap two cells on the board.' },
  { id:'clear3', icon:'🧹', name:'Clear Out', need:3, d:()=>'Clear three cells off the board.' },
  { id:'redeal', icon:'🎴', name:'Re-deal',   need:0, d:()=>'Throw this turn’s tiles back and deal again.' },
  { id:'forge',  icon:'⚒',  name:'Forge',     need:1, d:()=>'Turn one card into any card you name. Permanent.' },
  { id:'resuit', icon:'🎨', name:'Re-suit',   need:2, d:()=>'Set the suit of any two cards. Permanent.' },
  { id:'demote', icon:'⬇',  name:'Demote',    need:2, d:()=>'Lower the rank of any two cards. Permanent.' },
  { id:'promote',icon:'⬆',  name:'Promote',   need:2, d:()=>'Raise the rank of any two cards. Permanent.' },
  { id:'bleed',  icon:'💧', name:'Bleed',     need:1, dirs:['LR','UD'],
    d:dir=>`The cards ${dir==='LR'?'left and right':'above and below'} take the picked card’s suit. Permanent.` },
  { id:'echo',   icon:'📡', name:'Echo',      need:1, dirs:['L','R','U','D'],
    d:dir=>`The card ${({L:'to the left',R:'to the right',U:'above',D:'below'})[dir]} takes the picked card’s rank. Permanent.` },
];
const sqConsDef = id => SQ_CONS.find(c => c.id === id);
function sqRollCons(id) {
  const d = sqConsDef(id);
  return { id, dir: d.dirs ? d.dirs[Math.floor(Math.random() * d.dirs.length)] : null };
}

// ── STATE ──────────────────────────────────────────────────────────────────
let sqRound = 1, sqTurn = 0, sqTotal = 0, sqRoundScore = 0;
let sqHand = [], sqDiscards = 0, sqTentative = null, sqSelected = null;
let sqMode = 'all';                 // 'all' | 'select'
let sqLocked = new Set();           // line indices cashed this round (SELECT SCORE)
let sqPhase = 'idle';               // idle | place | pickline | scoring | between
let sqPickNeed = 0, sqPickSel = [];
let sqCons = [], sqArmed = null, sqPicked = [];
let sqLog = [], sqPieceId = 0;
let sqDragging = null, sqDragEl = null, sqDragPid = null;
// DAILY state. `sqdPlaced` is the undo stack - a puzzle you submit once has to
// be takeable-back, or a mis-drop ends the grid.
let sqdPlaced = [], sqdPar = null, sqdParTotal = 0, sqdParExact = true;

const sqIsRow = i => i < SQ_N;
const sqLineName = i => sqIsRow(i) ? 'ROW ' + (i + 1) : 'COL ' + (i - SQ_N + 1);
const sqLineCells = i => { const a = []; for (let k = 0; k < SQ_N; k++) a.push(sqIsRow(i) ? [i, k] : [k, i - SQ_N]); return a; };
const sqLineCards = i => sqLineCells(i).map(([r, c]) => gridData[r] && gridData[r][c]).filter(Boolean);
// A LOCKED LINE IS CLOSED. In SELECT SCORE a cashed line is out of the round, so
// it no longer takes a card either - which is what makes cashing early a real
// cost instead of a free harvest.
const sqCellLocked = (r, c) => sqMode === 'select' && (sqLocked.has(r) || sqLocked.has(SQ_N + c));
const sqFits = (p, r, c) => p.cells.every(cl => {
  const rr = r + cl.dr, cc = c + cl.dc;
  return rr >= 0 && cc >= 0 && rr < SQ_N && cc < SQ_N && !gridData[rr][cc] && !sqCellLocked(rr, cc);
});
const sqFilled = () => { let n = 0; for (let r = 0; r < SQ_N; r++) for (let c = 0; c < SQ_N; c++) if (gridData[r][c]) n++; return n; };

// ── PIECES ─────────────────────────────────────────────────────────────────
function sqMakePiece(size, avoid) {
  const forms = SQ_SHAPES[size] || SQ_SHAPES[1];
  const fi = sqShapeDraw(size, avoid);
  const f = forms[fi] || forms[0];
  const p = { id: 'sq' + (++sqPieceId), form: fi, cells: f.map(([dr, dc]) => ({ dr, dc, card: sqDraw() })) };
  // A RANDOM RESTING ORIENTATION. Rotation is the player's, but a tray that
  // always deals its L the same way up reads as a much smaller set of shapes
  // than it is - and at size 2 it is the only variety there is to have.
  const turns = Math.floor(Math.random() * 4);
  for (let i = 0; i < turns; i++) sqRotate(p);
  return p;
}
// One turn's tiles, drawn together so the no-triple guard has something to see.
function sqDealPieces(n, size) {
  const seen = new Map(), out = [];
  for (let i = 0; i < n; i++) {
    const avoid = new Set([...seen.entries()].filter(([, v]) => v >= 2).map(([k]) => k));
    const p = sqMakePiece(size, avoid);
    seen.set(p.form, (seen.get(p.form) || 0) + 1);
    out.push(p);
  }
  return out;
}
function sqDraw() {
  if (!drawPile.length) flushPlayedDeck();
  const c = (typeof drawCard === 'function') ? drawCard() : drawPile.shift();
  return c || { rank: '2', suit: (typeof ACTIVE_SUITS !== 'undefined' ? ACTIVE_SUITS[0] : '♠') };
}
function sqRotate(p) {
  const mx = Math.max(...p.cells.map(c => c.dr));
  p.cells = p.cells.map(c => ({ dr: c.dc, dc: mx - c.dr, card: c.card }));
  const mr = Math.min(...p.cells.map(c => c.dr)), mc = Math.min(...p.cells.map(c => c.dc));
  p.cells.forEach(c => { c.dr -= mr; c.dc -= mc; });
}
const sqPW = p => Math.max(...p.cells.map(c => c.dc)) + 1;
const sqPH = p => Math.max(...p.cells.map(c => c.dr)) + 1;
function sqCanPlaceAny() {
  for (const p of sqHand) {
    const save = p.cells.map(c => ({ ...c }));
    for (let rot = 0; rot < 4; rot++) {
      for (let r = 0; r < SQ_N; r++) for (let c = 0; c < SQ_N; c++) if (sqFits(p, r, c)) { p.cells = save; return true; }
      sqRotate(p);
    }
    p.cells = save;
  }
  return false;
}

// ══════════════════════════════════════════════
// RUN / ROUND / TURN
// ══════════════════════════════════════════════
// ── WHERE THE PANELS SIT (r309) ────────────────────────────────────────────
// Three moves, all owner-reported, and all of them DOM moves rather than CSS,
// because the piece hand has to change its place in the PORTRAIT FLOW and the
// consumables have to land in a box that exists in both orientations.
//
//  * THE PIECE HAND GOES BELOW THE BOARD. It lived in #trick-panel, which sits
//    in #top-strip ABOVE #grid-and-buttons, so on a phone you dragged upward
//    from the board to a tray at the top of the screen. It is re-parented into
//    #main between the board and the secondary button row. Landscape is
//    unaffected: #selected-cards is absolutely positioned there, and #main and
//    #hand-preview-area are both `display:contents`, so the box still resolves
//    against #stage wherever it hangs.
//  * THE CONSUMABLES TAKE THE GOAL BOX. They rode #knack-list, which in PORTRAIT
//    shares one half-strip with the hand preview (js/portrait-panel.js) - and
//    this mode pins that strip to the preview, so the consumables were behind a
//    swap button with no reason to press it. They were unreachable on a phone.
//  * ROUND n/10 GOES TO THE TOP BAR, in the slot the game timer would use.
let _sqPanelHome = null, _sqRoundEl = null;
function sqMountPanels() {
  const hp = document.getElementById('hand-preview-area');
  const main = document.getElementById('main');
  const gab = document.getElementById('grid-and-buttons');
  if (hp && main && gab && hp.parentNode !== main) {
    _sqPanelHome = { parent: hp.parentNode, next: hp.nextSibling };
    main.insertBefore(hp, gab.nextSibling);
  }
  const bar = document.getElementById('top-bar');
  if (bar && !document.getElementById('sq-round')) {
    _sqRoundEl = document.createElement('div');
    _sqRoundEl.id = 'sq-round';
    _sqRoundEl.innerHTML = '<span class="sqr-l">ROUND</span><span class="sqr-v">1/10</span>';
    bar.insertBefore(_sqRoundEl, bar.firstChild);
  }
}
function squaresTeardown() {
  const hp = document.getElementById('hand-preview-area');
  if (hp && _sqPanelHome && _sqPanelHome.parent) {
    _sqPanelHome.parent.insertBefore(hp, _sqPanelHome.next);
  }
  _sqPanelHome = null;
  document.getElementById('sq-round')?.remove();
  _sqRoundEl = null;
  const sel = document.getElementById('selected-cards');
  if (sel) { sel.classList.remove('sq-hand'); sel.innerHTML = ''; }
  document.getElementById('sq-cons-row')?.remove();
  // THIS MODE'S OWN CHILDREN OF #grid HAVE TO BE TAKEN OUT BY HAND. `render()`
  // reconciles elements carrying [data-card-id] and leaves anything else alone,
  // so an empty slot, a drop ghost or the line banner survives into the NEXT
  // mode and paints over its board - measured, 9 slots from a 3x3 were still
  // there under Classic's 16 cards. Same shape as the r248 crossroads tiles.
  document.querySelectorAll('#grid .sq-slot, #grid .sq-ghost').forEach(el => el.remove());
  document.getElementById('sq-banner')?.remove();
  sqUnobserveLayout();
  document.body.classList.remove('squares-mode');
  document.getElementById('stage')?.classList.remove('squares-mode', 'squares-daily', 'sq-n3', 'sq-n4');
}

function squaresBeginRun() {
  if (typeof _restoringSave !== 'undefined' && _restoringSave) return;
  if (typeof stopTimers === 'function') stopTimers();
  gameTimerPaused = true;
  document.body.classList.add('squares-mode');
  document.getElementById('stage')?.classList.add('squares-mode');
  sqMountPanels();
  sqObserveLayout();
  sqRound = 1; sqTotal = 0; sqRoundScore = 0; sqCons = []; sqLog = []; sqPieceId = 0;
  sqBags = {}; sqdBoons = []; sqdPlaced = []; sqdPar = null; sqdParTotal = 0; sqdParExact = true;
  sqMode = 'all';
  sqAskSize();
}

// ── THE SIZE IS THE FIRST QUESTION (r311) ─────────────────────────────────
// It has to be asked before anything else, because it decides whether this run
// has turns, Tricks and a pips x mult ladder at all.
function sqAskSize() {
  sqPhase = 'idle';
  const ov = sqOverlay();
  ov.querySelector('.sq-eyebrow').textContent = 'Pick a board';
  ov.querySelector('.sq-title').textContent = 'How big';
  ov.querySelector('.sq-lead').textContent =
    'Every row and every column is scored as a poker hand, so each card is counted twice.';
  ov.querySelector('.sq-body').innerHTML =
    `<div class="sq-opts sq-sizes">
       <div class="sq-opt" data-n="3"><div class="sq-on">3 x 3</div>
         <div class="sq-od"><b>Three grids.</b> Every tile at the start - one 3-tile, three 2-tiles
         and three singles - placed all at once, then submitted. 12 cells of tiles for 9 of board,
         so what you leave out is the puzzle. No Tricks and no multipliers: a hand's base plus the
         value of its cards.</div></div>
       <div class="sq-opt" data-n="4"><div class="sq-on">4 x 4</div>
         <div class="sq-od"><b>Three grids.</b> The same puzzle, bigger: two 3-tiles, four 2-tiles
         and five singles - 19 cells of tiles for 16 of board - and eight lines of four to fill.</div></div>
       <div class="sq-opt" data-n="5"><div class="sq-on">5 x 5</div>
         <div class="sq-od"><b>Ten rounds.</b> The original. Three tiles a turn over four turns, real
         poker hands through the game's own scoring, and a Trick and a consumable between rounds.</div></div>
     </div>`;
  ov.querySelector('.sq-foot').innerHTML = '';
  ov.querySelectorAll('.sq-opt').forEach(o => o.onclick = () => {
    sqSetSize(+o.dataset.n);
    if (typeof sfxRewardSelect === 'function') sfxRewardSelect();
    if (sqDaily()) { sqCloseOverlay(); sqMode = 'all'; sqNewRound(); }
    else sqAskMode();
  });
  sqShowOverlay();
}
// The limits carry the size so a level-up cannot snap the board back to its
// base, which is why js/game-control.js sets them for the 5x5 in the first place.
function sqSetSize(n) {
  SQ_N = n;
  gridRows = SQ_N; gridCols = SQ_N;
  // A CLASS, so the stylesheet can drop the panels a daily has nothing to put
  // in - the Trick tray above all, since a daily takes no Tricks at all.
  const st = document.getElementById('stage');
  if (st) {
    st.classList.toggle('squares-daily', !!SQD_SIZES[n]);
    // The SIZE as a class too, because the tile tray's column count is a
    // property of the inventory (7 tiles or 11) and CSS has no way to count.
    st.classList.remove('sq-n3', 'sq-n4');
    if (SQD_SIZES[n]) st.classList.add('sq-n' + n);
  }
  if (typeof limits !== 'undefined' && limits.grid_rows) {
    limits.grid_rows.current = limits.grid_rows.base = limits.grid_rows.max = n;
    limits.grid_cols.current = limits.grid_cols.base = limits.grid_cols.max = n;
  }
  // A daily scores its own way and never touches HAND_BASE; the 5x5 installs the
  // real-poker table it has always used.
  if (!sqDaily()) squaresInstallHandValues();
  if (typeof recomputeGridMetrics === 'function') recomputeGridMetrics();
}

// The 5x5's second question. Two ways to be paid, one console, the game's own chrome.
function sqAskMode() {
  sqPhase = 'idle';
  const ov = sqOverlay();
  ov.querySelector('.sq-eyebrow').textContent = 'Engagement terms';
  ov.querySelector('.sq-title').textContent = 'How do you want to be paid';
  ov.querySelector('.sq-lead').textContent =
    'Fill a 5x5 board over four turns. Every row and every column is a poker hand.';
  ov.querySelector('.sq-body').innerHTML =
    `<div class="sq-opts">
       <div class="sq-opt" data-m="all"><div class="sq-on">SCORE ALL</div>
         <div class="sq-od">At the end of the round all ten lines pay, worst hand first. Every card
         counts twice, once for its row and once for its column. Nothing to decide, everything to build.</div></div>
       <div class="sq-opt" data-m="select"><div class="sq-on">SELECT SCORE</div>
         <div class="sq-od">Each turn you cash <b>one</b> line. It locks for the rest of the round and
         you cannot place into it again. On the last turn you cash <b>${SQ_FINAL_LINES}</b>. Fewer lines
         pay, so you choose when a line is finished enough to spend.</div></div>
     </div>`;
  ov.querySelector('.sq-foot').innerHTML = '';
  ov.querySelectorAll('.sq-opt').forEach(o => o.onclick = () => {
    sqMode = o.dataset.m;
    sqCloseOverlay();
    if (typeof sfxRewardSelect === 'function') sfxRewardSelect();
    sqNewRound();
  });
  sqShowOverlay();
}

function sqNewRound() {
  // THE WHOLE DECK, EVERY ROUND. Board cards go back to the pile and the lot is
  // reshuffled, so a run's 52 are always all in play and a consumable's edit -
  // which lives on the card object - comes back with them.
  for (let r = 0; r < SQ_N; r++) for (let c = 0; c < SQ_N; c++) {
    if (gridData[r] && gridData[r][c]) { playedPile.push(gridData[r][c]); gridData[r][c] = null; }
  }
  sqHand.forEach(p => p.cells.forEach(cl => playedPile.push(cl.card)));
  sqHand = [];
  flushPlayedDeck();
  gridData = [];
  for (let r = 0; r < SQ_N; r++) { gridData[r] = []; for (let c = 0; c < SQ_N; c++) gridData[r][c] = null; }
  gridRows = SQ_N; gridCols = SQ_N;
  sqTurn = 0; sqLocked = new Set(); sqTentative = null; sqSelected = null;
  sqArmed = null; sqPicked = []; sqRoundScore = 0; sqLog = []; sqdPlaced = []; sqdPar = null;
  if (typeof recomputeGridMetrics === 'function') recomputeGridMetrics();
  sqStartTurn();
}
function sqStartTurn() {
  sqPhase = 'place';
  // A DAILY HAS NO TURNS. Every tile is on the table from the first frame, which
  // is the whole difference: the 5x5 is a game of reacting to what arrives, this
  // is a packing puzzle with full information and one commit.
  if (sqDaily()) {
    sqDiscards = 0; sqdPlaced = [];
    sqHand.push(...sqdDealAll());
    // PAR IS COMPUTED NOW, NOT AT SUBMIT. The board is known the moment it is
    // dealt, and the deal animation is the one place a search can hide.
    sqdPar = sqdComputePar(sqHand);
    sqRenderAll();
    return;
  }
  const sp = SQ_SCHEDULE[sqTurn];
  sqDiscards = SQ_DISCARDS;
  if (sp) sqHand.push(...sqDealPieces(sp.n, sp.size));
  sqRenderAll();
}

async function sqAdvance() {
  sqTurn++;
  // One placing phase, then the tally. There is no second turn to advance to.
  if (sqDaily()) { sqPhase = 'scoring'; sqRenderAll(); await sqRunTally([...Array(SQ_LINES()).keys()]); sqEndRound(); return; }
  if (sqTurn >= SQ_SCHEDULE.length) {
    if (sqMode === 'all') { sqPhase = 'scoring'; sqRenderAll(); await sqRunTally([...Array(SQ_LINES()).keys()]); }
    sqEndRound();
    return;
  }
  sqStartTurn();
}

// ══════════════════════════════════════════════
// SCORING - through the real calcScore
// ══════════════════════════════════════════════
// Name the poker hand a line makes. Kickers are implicit: the hand IS the line.
function sqHandName(cards) {
  if (cards.length < 2) return 'High Card';
  const rs = cards.map(sqRank).sort((a, b) => a - b);
  const full = cards.length >= 5;
  const fl = full && cards.every(c => c.suit === cards[0].suit);
  const consec = a => a.every((v, i) => i === 0 || v === a[i - 1] + 1);
  // A-2-3-4-5 is a straight; test the wheel as well as the natural run.
  const wheel = full && rs[4] === 14 && consec([1, ...rs.slice(0, 4)]);
  const run = full && (consec(rs) || wheel);
  const cnt = {}; cards.forEach(c => cnt[c.rank] = (cnt[c.rank] || 0) + 1);
  const cv = Object.values(cnt).sort((a, b) => b - a);
  if (fl && run)              return 'Straight Flush';
  if (cv[0] >= 4)             return 'Four of a Kind';
  if (cv[0] >= 3 && cv[1] >= 2) return 'Full House';
  if (fl)                     return 'Flush';
  if (run)                    return 'Straight';
  if (cv[0] >= 3)             return 'Three of a Kind';
  if (cv[0] >= 2 && cv[1] >= 2) return 'Two Pair';
  if (cv[0] >= 2)             return 'Pair';
  return 'High Card';
}
// The ladder, in order of what each is WORTH (pips x mult), which is what the
// tally's tiebreak wants. The two runs slot in by measurement: a Run of 3 at 80
// sits just above a Pair at 60, a Run of 4 at 320 between Two Pair and Trips.
const SQ_LADDER = ['High Card','Pair','Run of 3','Two Pair','Run of 4','Three of a Kind',
                   'Straight','Flush','Full House','Four of a Kind','Straight Flush'];
const sqHandRank = n => SQ_LADDER.indexOf(n);

// The longest run of CONSECUTIVE DISTINCT RANKS, 4 then 3, as indices into the
// cards given. The ace is entered twice, low and high, so A-2-3-4 is a run as
// well as J-Q-K-A; a window can never hold both, since that would need thirteen
// consecutive values in five cards.
function sqBestRun(cards) {
  const m = new Map();
  cards.forEach((c, i) => { const v = sqRank(c); if (v != null && !m.has(v)) m.set(v, i); });
  if (m.has(14) && !m.has(1)) m.set(1, m.get(14));
  const vals = [...m.keys()].sort((a, b) => a - b);
  for (let len = 4; len >= 3; len--) {
    for (let s = 0; s + len <= vals.length; s++) {
      let ok = true;
      for (let k = 1; k < len; k++) if (vals[s + k] !== vals[s] + k) { ok = false; break; }
      if (ok) return { len, idx: vals.slice(s, s + len).map(v => m.get(v)) };
    }
  }
  return null;
}

// THE ONE PLACE A LINE'S SCORE IS ASKED FOR. The 5x5 goes through the game's
// real `calcScore`; a daily grid has no pips x mult at all and scores itself.
function sqLineResult(i) { return sqDaily() ? sqdScoreLine(i) : sqScoreLine(i); }

// Score ONE line, read-only. `calcScore` is speculative-safe by contract (it is
// what findBestHand and the live chips call), so this may be run for every line
// to sort them before a single one pays.
function sqScoreLine(i) {
  const all = sqLineCells(i).filter(([r, c]) => gridData[r] && gridData[r][c]);
  const cards = all.map(([r, c]) => gridData[r][c]);
  let best = sqEvalHand(sqHandName(cards), all, []);
  // A SHORT RUN IS A SECOND CANDIDATE, NEVER AN OVERRIDE. It uses only its own
  // cards and bills the rest, so a line is scored as whichever is worth more -
  // the poker hand the whole line makes, or the run inside it minus what it
  // leaves behind. That is the same question findBestHand asks in the main game,
  // and it is why a Run of 3 can never make a line worse than it already was.
  const run = sqBestRun(cards);
  if (run) {
    const inRun = new Set(run.idx);
    const cells = run.idx.map(k => all[k]);
    const left  = all.filter((_, k) => !inRun.has(k)).map(([r, c]) => gridData[r][c]);
    const alt = sqEvalHand('Run of ' + run.len, cells, left);
    if (alt.total > best.total) best = alt;
  }
  return { i, ...best, r: sqHandRank(best.name) };
}
// `calcScore` is speculative-safe by contract (it is what findBestHand and the
// live chips call), so this may be run for every line, twice, to sort them
// before a single one pays.
function sqEvalHand(name, cells, penaltyCards) {
  let total = 0;
  try { total = (typeof calcScore === 'function') ? calcScore(name, cells) : 0; } catch (e) { total = 0; }
  const pen = penaltyCards.reduce((n, c) => n + ((typeof cardPips === 'function') ? (cardPips(c) || 0) : 0), 0);
  return { name, cells, cards: cells.map(([r, c]) => gridData[r][c]), pen,
           total: Math.max(0, Math.round(total - pen)),
           pips: (typeof lastCalcPips === 'number') ? lastCalcPips : 0,
           mult: (typeof lastCalcMult === 'number') ? lastCalcMult : 1 };
}

const sqSleep = ms => new Promise(r => setTimeout(r, ms));

// THE TALLY - worst hand first, each line ~SQ_ACCEL% quicker than the last.
// Worst-first is the escalation: the pitch climbs with BOTH position in the
// tally and the hand's own rank, so a round ENDS on its best line. It also
// TEACHES - the order is a live ranking of which lines this loadout likes.
// How a line's arithmetic READS, which is the one thing the two modes cannot
// share: `160 x 6` and `16 + 7` are different sentences about different games.
function sqTallyText(f) {
  if (!sqDaily()) return `${f.pips} \u00d7 ${f.mult}` + (f.pen ? ` \u2212 ${f.pen}` : '');
  const sum = `${f.base} + ${f.pips}` + (f.bonus ? ` + ${f.bonus}` : '');
  return f.dbl ? `(${sum}) \u00d72` : sum;
}
function sqTallyLog(f) {
  if (!sqDaily()) return `${String(f.pips).padStart(5)} \u00d7 ${String(f.mult).padStart(2)}`
    + `${f.pen ? ' \u2212' + String(f.pen).padStart(3) : '     '} = ${String(f.total).padStart(6)}`;
  return `${String(f.base).padStart(4)} + ${String(f.pips).padStart(3)}`
    + (f.bonus ? ` + ${String(f.bonus).padStart(2)}` : '      ')
    + (f.dbl ? ' x2' : '   ') + ` = ${String(f.total).padStart(5)}`;
}
async function sqRunTally(which) {
  const lines = which.map(sqLineResult).sort((a, b) => a.total - b.total || a.r - b.r);
  let ms = SQ_HAND_MS;
  for (let k = 0; k < lines.length; k++) {
    const L = lines[k];
    sqSetLineBanner(`${sqLineName(L.i)} \u00b7 ${L.name.toUpperCase()}`);
    // Re-score at payout so the chips show what is actually banked.
    const fresh = sqLineResult(L.i);
    sqWave(L.i, ms);
    if (sqDaily()) sqPaintChips(fresh.base, fresh.pips);
    else {
      if (typeof updateScoreUI === 'function') { lastCalcPips = fresh.pips; lastCalcMult = fresh.mult; }
      sqPaintChips(fresh.pips, fresh.mult);
    }
    if (typeof sfxHandScored === 'function') sfxHandScored(300 + k * 42 + L.r * 55);
    await sqSleep(ms * 0.48);
    sqTotal += fresh.total; sqRoundScore += fresh.total;
    sqPaintScore();
    sqFlyChip(L.i, fresh.name, sqTallyText(fresh));
    if (typeof sfxScoreTick === 'function') sfxScoreTick();
    await sqSleep(ms * 0.52);
    sqUnwave(L.i);
    sqLog.push(`  ${sqLineName(L.i).padEnd(6)} ${L.name.padEnd(16)} ${sqTallyLog(fresh)}`);
    ms = Math.max(140, ms * (1 - SQ_ACCEL / 100));
  }
  sqSetLineBanner('');
}

// ══════════════════════════════════════════════
// BETWEEN ROUNDS
// ══════════════════════════════════════════════
function sqEndRound() {
  sqPhase = 'between';
  sqRenderAll();
  if (typeof sfxLevelUp === 'function') sfxLevelUp();
  const cells = SQ_N * SQ_N;
  // A "BEST" THE PLAYER HAS ALREADY BEATEN IS WORSE THAN NO BEST AT ALL - it
  // reads as the feature being broken rather than as the search being honest.
  // The 4x4's figure is a beam search, not a proof, so it is raised to whatever
  // the player actually found; the 3x3's is exhaustive, so being beaten there
  // would be a real bug and it is left alone to say so.
  let par = sqDaily() && sqdPar ? sqdPar.best : 0;
  if (par && !sqdPar.exact && sqRoundScore > par) par = sqRoundScore;
  if (sqDaily()) { sqdParTotal += par; if (!sqdPar || !sqdPar.exact) sqdParExact = false; }
  // ONE LABEL WIDTH for the whole block: "best possible" is 13 characters and
  // every other label is shorter, so anything less puts its value a column
  // right of the rest.
  const lab = t => '  ' + t.padEnd(SQ_REPORT_LABEL) + ' ';
  sqReport(`Grid ${sqRound} scored`,
    lab('this grid') + `${sqRoundScore.toLocaleString()}\n` +
    (par ? lab(sqdPar.exact ? 'best possible' : 'best found') + `${par.toLocaleString()}   (${Math.round(100 * sqRoundScore / par)}%)\n` : '') +
    lab('run total') + `${sqTotal.toLocaleString()}\n` +
    lab('filled') + `${sqFilled()}/${cells}\n\n` + sqLog.join('\n'),
    () => {
      if (sqRound >= sqRounds()) { sqFinish(); return; }
      // A DAILY TAKES NO TRICKS (owner's call). Two people playing the same
      // board have to be comparable, and a Trick is exactly the thing that
      // makes two runs of the same board score differently. What it gets
      // instead is one BOON, rolled and granted with no choice in it.
      if (sqDaily()) { sqdOfferBoon(() => { sqRound++; sqNewRound(); }); return; }
      sqPickTrick(() => sqPickCons(() => { sqRound++; sqNewRound(); }));
    });
}

// The between-grid grant. Rolled, not chosen, and the line boons ACCUMULATE -
// grid 1 is plain, grid 2 carries one and grid 3 carries two, so the run
// escalates without the player steering it.
function sqdOfferBoon(done) {
  const rolled = sqdGrantBoon(sqdRollBoon());
  const ov = sqOverlay();
  ov.querySelector('.sq-eyebrow').textContent = `Before grid ${sqRound + 1}`;
  ov.querySelector('.sq-title').textContent = rolled.kind === 'cons' ? 'A consumable' : 'A line is boosted';
  ov.querySelector('.sq-lead').textContent = '';
  const body = rolled.kind === 'cons'
    ? (rolled.full ? `<div class="sq-boon"><div class="sq-bn">No room</div><div class="sq-bd">You are already holding ${SQ_CONS_CAP} consumables.</div></div>`
      : `<div class="sq-boon"><div class="sq-bi">${rolled.def.icon}</div>`
        + `<div class="sq-bn">${rolled.def.name}${rolled.rolled.dir ? ' ' + rolled.rolled.dir : ''}</div>`
        + `<div class="sq-bd">${rolled.def.d(rolled.rolled.dir)}</div></div>`)
    : `<div class="sq-boon"><div class="sq-bi">${rolled.kind === 'dbl' ? '\u00d72' : '+' + SQD_BOON_PER_CARD}</div>`
      + `<div class="sq-bn">${sqLineName(rolled.line)}</div>`
      + `<div class="sq-bd">${rolled.kind === 'dbl'
          ? 'That row or column scores double for the rest of the run.'
          : `Every card in that row or column is worth ${SQD_BOON_PER_CARD} more, for the rest of the run.`}</div></div>`;
  ov.querySelector('.sq-body').innerHTML = body;
  ov.querySelector('.sq-foot').innerHTML = `<button class="sq-btn go" id="sq-boon-ok">CONTINUE</button>`;
  ov.querySelector('#sq-boon-ok').onclick = () => { sqCloseOverlay(); done(); };
  if (typeof sfxRewardGood === 'function') sfxRewardGood();
  sqShowOverlay();
}

function sqFinish() {
  if (typeof sfxVictory === 'function') sfxVictory();
  const lab = t => '  ' + t.padEnd(SQ_REPORT_LABEL) + ' ';
  sqReport('Run complete',
    lab('FINAL SCORE') + `${sqTotal.toLocaleString()}\n` +
    (sqDaily() && sqdParTotal
      ? lab(sqdParExact ? 'best possible' : 'best found') + `${sqdParTotal.toLocaleString()}   (${Math.round(100 * sqTotal / sqdParTotal)}%)\n`
      : '') +
    lab('board') + `${SQ_N}x${SQ_N}\n` +
    (sqDaily() ? '' : lab('mode') + `${sqMode === 'all' ? 'SCORE ALL' : 'SELECT SCORE'}\n`) +
    lab('grids') + `${sqRounds()}\n` +
    (sqDaily() ? (sqdBoons.length ? lab('boosts') + `${sqdBoons.map(sqdBoonLabel).join(' / ')}\n` : '')
               : lab('tricks') + `${(acquiredTricks || []).map(t => t.name).join(', ') || 'none'}\n`) + `\n` +
    `LAST GRID\n` + sqLog.join('\n'),
    () => {
      totalScore = sqTotal;
      squaresTeardown();
      if (typeof onGameWin === 'function') onGameWin();
    });
}

// The picks ride the SHARED pick-of-three screen (js/grid-pick.js) - the board
// IS the pick, with the reroll pool and the CONFIRM tile every other mode uses.
function sqPickTrick(done) {
  const owned = new Set((acquiredTricks || []).map(t => t.id));
  const pool = (typeof TRICK_POOL !== 'undefined' ? TRICK_POOL : []).filter(t => !owned.has(t.id) && !sqTrickBanned(t));
  if (!pool.length || (typeof trickTrayFull === 'function' && trickTrayFull())) { done(); return; }
  const draw = () => {
    const left = pool.slice(); const out = [];
    for (let i = 0; i < 3 && left.length; i++) {
      const d = (typeof pickEntityByRarity === 'function' && pickEntityByRarity(left, e => e.tier || 'common'))
              || left[Math.floor(Math.random() * left.length)];
      left.splice(left.indexOf(d), 1);
      const em = (typeof trickEmoji === 'function') ? trickEmoji(d) : '★';
      out.push({ entity: 'trick', icon: em, emoji: em, label: d.name,
        desc: (typeof trickLiveDesc === 'function') ? trickLiveDesc(d) : d.desc,
        tier: d.tier || 'common', rarity: d.tier || 'common',
        tag: (typeof tierLabel === 'function') ? tierLabel('trick', d.tier || 'common') : '',
        apply: () => injectTrickAfterReward(d) });
    }
    return out;
  };
  sqOpenPick('TAKE A TRICK', draw, done);
}
function sqPickCons(done) {
  const draw = () => {
    const left = SQ_CONS.slice(); const out = [];
    for (let i = 0; i < 3 && left.length; i++) {
      const d = left.splice(Math.floor(Math.random() * left.length), 1)[0];
      const rolled = sqRollCons(d.id);
      out.push({ entity: 'sleight', icon: d.icon, emoji: d.icon,
        label: d.name + (rolled.dir ? ' ' + rolled.dir : ''),
        desc: d.d(rolled.dir), tier: 'rare', rarity: 'rare', tag: 'CONSUMABLE',
        apply: () => {
          if (sqCons.length >= SQ_CONS_CAP) { showMessage?.('No room for another consumable.', 'var(--red)'); return; }
          sqCons.push(rolled); sqRenderAll();
          showMessage?.('+ ' + d.name, 'var(--gold)');
        } });
    }
    return out;
  };
  sqOpenPick('TAKE A CONSUMABLE', draw, done);
}
function sqOpenPick(title, draw, done) {
  const offers = draw();
  if (!offers.length) { done(); return; }
  if (typeof pickRerollsNewScreen === 'function') pickRerollsNewScreen();
  const redraw = () => {
    const fresh = draw(); if (!fresh.length) return;
    if (typeof sfxShopOpen === 'function') sfxShopOpen();
    gridPickRefresh(fresh, actions());
  };
  const actions = () => (typeof pickRerollAction === 'function') ? [pickRerollAction(redraw)] : [];
  openGridPick({
    title, tone: 'reward', offers, actions: actions(),
    onChoose: (i, p) => { try { p.apply && p.apply(); } catch (e) {} sqAfterPick(done); },
  });
}
function sqAfterPick(done) {
  // openGridPick's own close already released the board; put ours back.
  gridRows = SQ_N; gridCols = SQ_N;
  if (typeof recomputeGridMetrics === 'function') recomputeGridMetrics();
  done();
}

// TRICKS THIS MODE CANNOT HONOUR. Six things the main game has and this one does
// not: a clock, Focus, credits, swaps, a `level` that advances, and a HAND you
// choose to play - lines here score themselves, so "your next hand" and "hands
// played this round" name a beat that never happens. A Trick keyed on any of
// them is offered, taken, printed in the tray and pays nothing.
//
// A PREDICATE OVER THE DESCRIPTION, NOT AN ID LIST, and deliberately: an
// allowlist would mean a Trick added later silently never appears here, which is
// the harder failure to notice. Measured over the 177-Trick pool: 62 survive,
// 23 common / 22 rare / 14 epic / 3 legendary, and they are the shape, rank,
// suit, replay and marked-line Tricks - exactly the ones a line of five cards
// can pay.
function sqTrickBanned(t) {
  const d = ((t.desc || '') + ' ' + (t.name || '')).toLowerCase();
  if (/\bsecond|\bminute|clock|pause|rewind|\btime\b|\d+\s*s\b/.test(d)) return true;  // no clock
  if (/focus/.test(d)) return true;                                            // no Focus
  if (/credit|coin|interest/.test(d)) return true;                             // no economy
  if (/\bswap/.test(d)) return true;                                           // no swaps
  if (/\blevel\b/.test(d)) return true;                                        // `level` never advances
  if (/hands? played|\bstreak\b|previous hand|next hand|this hand|each hand|every hand|per hand|first hand|last hand/.test(d)) return true;
  if (/third of the round|this round|per round|each round|round score|goal/.test(d)) return true;
  if (/\b2 cards|two cards|2-card/.test(d)) return true;                        // a line is five
  if (/all cards.*(row|column)|only one (row|column)|same row|same column/.test(d)) return true;
  if (/discard/.test(d)) return true;                                           // discards buy tiles, not score
  if (/reward grid/.test(d)) return true;                                       // no reward grid in this mode
  return false;
}


// ══════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════
// The BOARD is the game's own: real cards in `gridData`, painted by `render()`,
// so every buff, curse, mark and tooltip works untouched. This file only draws
// what the board does not have - the piece hand, the ghost, the line banner.
function sqRenderAll() {
  if (!squaresActive()) return;
  gridRows = SQ_N; gridCols = SQ_N;
  try { if (typeof render === 'function') render(); } catch (e) {}
  sqPaintSlots();
  sqPaintLocked();
  sqPaintGhost();
  sqRenderHand();
  sqRenderCons();
  sqPaintButtons();
  sqPaintHud();
}

// Design px -> the cell under a viewport point. #grid carries the cabinet's CSS
// zoom, so its rect is NOT its own units (the r160 Trick-fan trap); divide the
// delta by the ratio the element itself reports.
function sqCellAt(clientX, clientY) {
  const g = document.getElementById('grid'); if (!g) return null;
  const rect = g.getBoundingClientRect();
  const k = rect.width / (g.offsetWidth || rect.width || 1);
  const x = (clientX - rect.left) / k, y = (clientY - rect.top) / k;
  const pad = (typeof GRID_PAD === 'number') ? GRID_PAD : 0;
  const cw = CARD_W + CARD_GAP, chh = CARD_H + CARD_GAP;
  const c = Math.floor((x - pad) / cw), r = Math.floor((y - pad) / chh);
  if (r < 0 || c < 0 || r >= SQ_N || c >= SQ_N) return null;
  return [r, c];
}

// Empty cells, drawn because `render()` only ever draws CARDS - without these
// a fresh board is a black rectangle with nothing to aim a tile at.
function sqPaintSlots() {
  const g = document.getElementById('grid'); if (!g) return;
  g.querySelectorAll('.sq-slot').forEach(el => el.remove());
  for (let r = 0; r < SQ_N; r++) for (let c = 0; c < SQ_N; c++) {
    if (gridData[r] && gridData[r][c]) continue;
    const d = document.createElement('div');
    d.className = 'sq-slot';
    d.style.cssText = `left:${cellLeft(c)}px;top:${cellTop(r)}px;width:${CARD_W}px;height:${CARD_H}px`;
    g.appendChild(d);
  }
}
function sqPaintLocked() {
  const g = document.getElementById('grid'); if (!g) return;
  g.querySelectorAll('.sq-lock').forEach(el => el.remove());
  if (sqMode !== 'select') return;
  for (let r = 0; r < SQ_N; r++) for (let c = 0; c < SQ_N; c++) {
    if (!sqCellLocked(r, c)) continue;
    const d = document.createElement('div');
    d.className = 'sq-lock';
    d.style.cssText = `left:${cellLeft(c)}px;top:${cellTop(r)}px;width:${CARD_W}px;height:${CARD_H}px`;
    g.appendChild(d);
  }
}
function sqPaintGhost() {
  const g = document.getElementById('grid'); if (!g) return;
  g.querySelectorAll('.sq-ghost').forEach(el => el.remove());
  if (!sqTentative) return;
  const { piece, r, c } = sqTentative, ok = sqFits(piece, r, c);
  piece.cells.forEach(cl => {
    const rr = r + cl.dr, cc = c + cl.dc;
    if (rr < 0 || cc < 0 || rr >= SQ_N || cc >= SQ_N) return;
    const d = document.createElement('div');
    d.className = 'sq-ghost ' + (ok ? 'ok' : 'bad');
    d.style.cssText = `left:${cellLeft(cc)}px;top:${cellTop(rr)}px;width:${CARD_W}px;height:${CARD_H}px`;
    if (ok) d.innerHTML = `<span class="sq-gr">${cl.card.rank}</span><span class="sq-gs">${cl.card.suit}</span>`;
    g.appendChild(d);
  });
}

// ── THE PIECE HAND, in the preview frame ───────────────────────────────────
// #selected-cards is "the hand you are about to play", which is exactly what
// three polyomino tiles are. It is the one panel this mode repurposes.
const SQ_MINI_RATIO = 4 / 3;
function sqPolyHTML(p, boxW, boxH) {
  const w = sqPW(p), h = sqPH(p), gap = 2;
  const mw = Math.max(9, Math.min(38, (boxW - (w - 1) * gap) / w, (boxH - (h - 1) * gap) / h / SQ_MINI_RATIO));
  const mh = mw * SQ_MINI_RATIO, fs = Math.max(5, Math.round(mw * 0.36));
  const map = {}; p.cells.forEach(c => map[c.dr + ',' + c.dc] = c.card);
  let s = `<div class="sq-poly" style="grid-template-columns:repeat(${w},${mw}px);--smw:${mw}px;--smh:${mh}px;--sfs:${fs}px">`;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const cd = map[r + ',' + c];
    // A piece's bounding box has HOLES (an L, an S, a T all do), so the suit
    // class must be read inside the truthy branch - reading it above the ternary
    // threw on every shape with a gap and took the whole hand render with it.
    if (cd) {
      const sc = sqSuitCls(cd.suit);
      s += `<div class="sq-mini"><span class="sq-mr ${sc}">${cd.rank}</span><span class="sq-ms ${sc}">${cd.suit}</span></div>`;
    } else s += `<div class="sq-mini blank"></div>`;
  }
  return s + '</div>';
}
function sqSuitCls(suit) {
  if (typeof suitClass === 'function') { try { return suitClass(suit); } catch (e) {} }
  return '';
}
function sqRenderHand() {
  const host = document.getElementById('selected-cards'); if (!host) return;
  host.innerHTML = '';
  host.classList.add('sq-hand');
  const n = Math.max(1, sqHand.length);
  // MEASURE THE TILE, DO NOT PREDICT IT. clientWidth includes the panel's
  // padding and excludes its border, the tile adds 2px of border on each side,
  // and the flex gap is a third term - guessing all three left the poly 4px
  // wider than the tile it sits in on every viewport. A first pass lays the
  // tiles out and a second fills them from what the layout actually produced.
  let boxW = Math.max(30, (host.clientWidth - 14 - (n - 1) * 6) / n - 6);
  let boxH = Math.max(30, host.clientHeight - 14 - 6);
  sqHand.forEach(p => {
    let inner = '';
    try { inner = sqPolyHTML(p, boxW, boxH); } catch (e) { inner = '<div class="sq-empty">?</div>'; }
    const el = document.createElement('div');
    el.className = 'sq-tile' + (sqSelected === p ? ' sel' : '') + (sqTentative && sqTentative.piece === p ? ' placing' : '');
    el.dataset.pid = p.id;
    el.innerHTML = inner + '<div class="sq-rot" title="rotate">↻</div>';
    host.appendChild(el);
  });
  if (!sqHand.length) { host.innerHTML = '<div class="sq-empty">no tiles left</div>'; return; }
  sqFitHand();
  // AND AGAIN ON THE NEXT FRAME. The fit is a MEASUREMENT, so it is only as good
  // as the layout standing when it runs - and plenty of renders happen before
  // one: the first deal of a round lands while #hand-preview-area is still
  // settling into its new place below the board, and an orientation flip lands
  // before the new stylesheet rules have been applied. Measured in portrait, a
  // 3-tall piece came out 156px tall in an 84px tile on the first pass and 82px
  // on the second. One rAF is the cheapest way to be right in both.
  requestAnimationFrame(sqFitHand);
}
// Refit each poly to the tile's real inner box. UNCONDITIONAL (r309) - it used
// to refit only a poly that OVERFLOWED, which is right on a first render and
// wrong after a layout change: a tile that got WIDER kept the minis it was
// fitted to when it was narrow. Fitting from the measured box every time is the
// same answer in both directions, and it is idempotent, so running it twice
// costs nothing.
function sqFitHand() {
  const host = document.getElementById('selected-cards'); if (!host) return;
  host.querySelectorAll('.sq-tile').forEach(el => {
    const p = sqHand.find(x => x.id === el.dataset.pid); if (!p) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (w < 20 || h < 20) return;
    const poly = el.querySelector('.sq-poly'); if (!poly) return;
    try { poly.outerHTML = sqPolyHTML(p, w - 2, h - 2); } catch (e) {}
  });
}

// ── Consumables live in the GOAL box, which this mode has no use for and which
// is on screen in BOTH orientations - the one thing the knack row was not.
function sqRenderCons() {
  const box = document.getElementById('score-to-go'); if (!box) return;
  let host = document.getElementById('sq-cons-row');
  // APPENDED, NEVER `innerHTML = ''`. #score-to-go owns <span id="goal-display">,
  // which js/hud.js writes on every updateScoreUI - wiping the box here left the
  // NEXT mode's first render throwing on a null, and the span was gone for the
  // rest of the session. The span is hidden by css/squares.css instead.
  if (!host) { host = document.createElement('div'); host.id = 'sq-cons-row'; box.appendChild(host); }
  host.innerHTML = sqCons.map((c, i) => {
    const d = sqConsDef(c.id);
    return `<div class="sq-cons${sqArmed && sqArmed.idx === i ? ' armed' : ''}" data-i="${i}" `
         + `title="${d.name}${c.dir ? ' (' + c.dir + ')' : ''} - ${d.d(c.dir)}">`
         + `<span class="sq-ci">${d.icon}</span>${c.dir ? `<span class="sq-cd">${c.dir}</span>` : ''}</div>`;
  }).join('') || '<div class="sq-empty">no consumables</div>';
}

function sqPaintChips(pips, mult) {
  const p = document.getElementById('pips-val'), m = document.getElementById('mult-val');
  if (p) p.textContent = (typeof fmtNum === 'function') ? fmtNum(pips) : pips;
  if (m) m.textContent = (typeof fmtM === 'function') ? fmtM(mult) : mult;
}
function sqPaintScore() {
  const el = document.getElementById('score-total-num');
  if (el) el.textContent = sqTotal.toLocaleString();
}
function sqPaintHud() {
  sqPaintScore();
  const rd = document.getElementById('sq-round');
  if (rd) { const v = rd.querySelector('.sqr-v'); if (v) v.textContent = `${sqRound}/${sqRounds()}`;
            const l = rd.querySelector('.sqr-l'); if (l) l.textContent = sqDaily() ? 'GRID' : 'ROUND'; }
  // THE CHIPS MEAN SOMETHING ELSE IN A DAILY. There is no mult, so PIPS x MULT
  // becomes HAND + CARDS - the hand's base and the value of the cards in it.
  const pl = document.querySelector('#pips-box .subbox-label'),
        ml = document.querySelector('#mult-box .subbox-label'),
        tx = document.querySelector('#score-subboxes .subbox-times');
  if (pl) pl.textContent = sqDaily() ? 'HAND'  : (typeof lexTerm === 'function' ? lexTerm('pips') : 'PIPS');
  if (ml) ml.textContent = sqDaily() ? 'CARDS' : (typeof lexTerm === 'function' ? lexTerm('mult') : 'MULT');
  if (tx) tx.textContent = sqDaily() ? '+' : '\u00d7';
  const gl = document.getElementById('score-goal-label');
  if (gl) gl.textContent = 'ITEMS';
  const tl = document.getElementById('score-total-label');
  if (tl) tl.textContent = 'SCORE';
  // A DAILY HAS NO TURNS, so the banner says the thing that IS true of it: how
  // much of the board is down, and how many cells of tiles it will not need.
  sqSetLineBanner(sqPhase === 'pickline'
    ? `PICK ${sqPickNeed - sqPickSel.length} LINE${sqPickNeed - sqPickSel.length === 1 ? '' : 'S'}`
    : sqPhase !== 'place' ? ''
    : sqDaily() ? `${sqFilled()}/${SQ_N * SQ_N} PLACED · ${sqdSpare()} SPARE`
    : `TURN ${Math.min(sqTurn + 1, 4)}/4 · ${SQ_SCHEDULE[sqTurn] ? SQ_SCHEDULE[sqTurn].n + '×' + SQ_SCHEDULE[sqTurn].size : ''}`);
  sqPaintLineButtons();
}
function sqSetLineBanner(text) {
  const slot = document.getElementById('grid-slot'); if (!slot) return;
  let b = document.getElementById('sq-banner');
  if (!b) { b = document.createElement('div'); b.id = 'sq-banner'; slot.appendChild(b); }
  b.textContent = text || '';
  b.classList.toggle('on', !!text);
}
// THE CHIP NAMES THE HAND (r309). The banner above the board says it too, but
// the banner is one line for the whole tally and the chip is the one thing sat
// on the line that just paid - which is where the player is looking.
function sqFlyChip(i, name, text) {
  const g = document.getElementById('grid'); if (!g) return;
  const cells = sqLineCells(i);
  const a = cells[0], z = cells[cells.length - 1];
  const el = document.createElement('div');
  el.className = 'sq-schip';
  el.innerHTML = `<span class="sq-scn"></span><span class="sq-scv"></span>`;
  el.querySelector('.sq-scn').textContent = name;
  el.querySelector('.sq-scv').textContent = text;
  el.style.left = ((cellLeft(a[1]) + cellLeft(z[1]) + CARD_W) / 2) + 'px';
  el.style.top  = ((cellTop(a[0]) + cellTop(z[0]) + CARD_H) / 2 - 12) + 'px';
  g.appendChild(el);
  el.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
              { transform: 'translate(-50%,-160%) scale(.7)', opacity: 0 }],
             { duration: 720, easing: 'cubic-bezier(.4,0,.6,1)' }).onfinish = () => el.remove();
}
function sqWave(i, ms) {
  const g = document.getElementById('grid'); if (!g) return;
  sqLineCells(i).forEach(([r, c], pos) => {
    const cd = gridData[r] && gridData[r][c]; if (!cd) return;
    const el = g.querySelector(`[data-card-id="${cardId(cd)}"]`); if (!el) return;
    setTimeout(() => el.classList.add('sq-wave'), pos * (ms * 0.055));
  });
}
function sqUnwave(i) {
  const g = document.getElementById('grid'); if (!g) return;
  g.querySelectorAll('.sq-wave').forEach(el => el.classList.remove('sq-wave'));
}

// ── The three buttons, repurposed exactly as the shop repurposes them ──────
let _sqPlayHTML = null, _sqDiscHTML = null, _sqSwapHTML = null;
function sqEnterButtons() {
  const play = document.getElementById('btn-play'), disc = document.getElementById('btn-discard'),
        swap = document.getElementById('swap-indicator');
  if (play) { if (_sqPlayHTML === null) _sqPlayHTML = play.innerHTML; play.classList.add('sq-confirm'); }
  if (disc) { if (_sqDiscHTML === null) _sqDiscHTML = disc.innerHTML; disc.classList.add('sq-discard'); }
  if (swap) {
    if (_sqSwapHTML === null) _sqSwapHTML = swap.innerHTML;
    swap.classList.add('sq-end');
    swap.onclick = e => { e.stopPropagation(); sqEndTurn(); };
  }
}
function sqExitButtons() {
  const play = document.getElementById('btn-play'), disc = document.getElementById('btn-discard'),
        swap = document.getElementById('swap-indicator');
  if (play && _sqPlayHTML !== null) { play.classList.remove('sq-confirm'); play.innerHTML = _sqPlayHTML; }
  if (disc && _sqDiscHTML !== null) { disc.classList.remove('sq-discard'); disc.innerHTML = _sqDiscHTML; }
  if (swap && _sqSwapHTML !== null) { swap.classList.remove('sq-end'); swap.innerHTML = _sqSwapHTML; swap.onclick = null; }
}
function sqPaintButtons() {
  sqEnterButtons();
  const play = document.getElementById('btn-play'), disc = document.getElementById('btn-discard'),
        swap = document.getElementById('swap-indicator');
  const placing = sqPhase === 'place';
  const canPlace = placing && sqTentative && sqFits(sqTentative.piece, sqTentative.r, sqTentative.c);
  // THE VALVE. Normally you place or discard down to the keep limit. A hand that
  // fits nowhere with no discards left would be a soft lock, so END TURN opens
  // anyway - unreachable at three discards a turn, and here because a locked
  // board in SELECT SCORE can genuinely refuse every tile.
  // A DAILY REPURPOSES THE SAME THREE BUTTONS AGAIN. There are no discards here
  // - a tile you do not want is simply one you never place - so the middle slot
  // becomes TAKE BACK, which a one-commit puzzle cannot do without.
  if (sqDaily()) {
    const left = SQ_N * SQ_N - sqFilled();
    if (play) { play.disabled = !canPlace; play.innerHTML = `CONFIRM<small>place the tile</small>`; }
    if (disc) { disc.disabled = !(placing && sqdPlaced.length);
                disc.innerHTML = `TAKE<br>BACK<small>${sqdPlaced.length} placed</small>`; }
    if (swap) { swap.classList.toggle('sq-off', !(placing && left === 0));
                swap.innerHTML = `<span class="sq-endw">SUBMIT</span><span class="sq-ends">`
                  + (left === 0 ? 'board full' : `${left} to fill`) + `</span>`; }
    return;
  }
  const stuck = placing && sqHand.length > SQ_KEEP && sqDiscards <= 0 && !sqCanPlaceAny();
  const canEnd = placing && (sqHand.length <= SQ_KEEP || stuck);
  if (play) { play.disabled = !canPlace; play.innerHTML = `CONFIRM<small>place the tile</small>`; }
  if (disc) { disc.disabled = !(placing && sqSelected && sqDiscards > 0);
              disc.innerHTML = `DISCARD<small>${sqDiscards} left</small>`; }
  if (swap) { swap.classList.toggle('sq-off', !canEnd);
              swap.innerHTML = `<span class="sq-endw">END TURN</span><span class="sq-ends">`
                + (sqHand.length <= SQ_KEEP ? 'ready' : (stuck ? 'nothing fits' : `${sqHand.length - SQ_KEEP} to place`)) + `</span>`; }
}

// ══════════════════════════════════════════════
// INTERACTION
// ══════════════════════════════════════════════
// One delegated listener set, installed once. Everything is gated on
// squaresActive() so no other mode can be reached through it.
function sqInstallInput() {
  if (sqInstallInput._done) return; sqInstallInput._done = true;

  document.addEventListener('pointerdown', e => {
    if (!squaresActive()) return;
    const consEl = e.target.closest && e.target.closest('.sq-cons');
    if (consEl) { e.preventDefault(); sqArmCons(+consEl.dataset.i); return; }
    if (sqPhase !== 'place') return;
    const rot = e.target.closest && e.target.closest('.sq-rot');
    const tile = e.target.closest && e.target.closest('.sq-tile');
    if (!tile) return;
    const p = sqHand.find(x => x.id === tile.dataset.pid); if (!p) return;
    if (rot) { sqRotate(p); if (typeof sfxCardSelect === 'function') sfxCardSelect(); sqRenderAll(); return; }
    sqSelected = p; sqDragging = p;
    // THE DRAG DIED AT THE EDGE OF THE TRAY ON A PHONE, and the cause is
    // `touch-action` (css/squares.css), not anything in here: with it left at
    // `auto` the browser claims the first movement as a page scroll and fires
    // pointercancel. Measured through real touch events on a 420x900 phone -
    // with touch-action none the drag survives all fourteen moves from the tray
    // to the board with 0 cancels, and with it back at auto it is cancelled on
    // the first move, every time.
    //
    // The two lines below are insurance rather than the fix, and worth keeping:
    // a touch pointer is IMPLICITLY CAPTURED by the element it landed on, and
    // `sqRenderAll()` rebuilds #selected-cards' children wholesale - so the tile
    // the finger is holding is destroyed on the first frame of the drag. Chrome
    // retargets rather than cancelling (measured: 0 cancels either way), but
    // capturing onto the BODY, which no render ever touches, and painting the
    // selection by toggling classes instead of re-rendering, mean the drag does
    // not depend on that being true.
    sqSetSelClasses();
    try { document.body.setPointerCapture(e.pointerId); sqDragPid = e.pointerId; } catch (_) { sqDragPid = null; }
    sqDragEl = document.getElementById('sq-drag');
    if (!sqDragEl) { sqDragEl = document.createElement('div'); sqDragEl.id = 'sq-drag'; document.body.appendChild(sqDragEl); }
    sqDragEl.style.display = 'block';
    sqDragEl.innerHTML = `<div class="sq-tile drag">${sqPolyHTML(p, 96, 96)}</div>`;
    sqMoveDrag(e);
    e.preventDefault();
  }, true);

  window.addEventListener('pointermove', e => {
    if (!squaresActive() || !sqDragging) return;
    sqMoveDrag(e);
    const cell = sqCellAt(e.clientX, e.clientY);
    if (cell) { sqTentative = { piece: sqDragging, r: cell[0], c: cell[1] }; sqPaintGhost(); sqPaintButtons(); sqSetSelClasses(); }
  });

  // A cancelled pointer (the OS taking the gesture, a context menu) must put the
  // drag down rather than leave the ghost stuck to the screen.
  window.addEventListener('pointercancel', () => {
    if (!squaresActive() || !sqDragging) return;
    sqReleaseDrag(); sqDragging = null; sqRenderAll();
  });

  window.addEventListener('pointerup', e => {
    if (!squaresActive()) return;
    sqReleaseDrag();
    if (!sqDragging) return;
    const overDisc = !!(e.target.closest && document.elementFromPoint(e.clientX, e.clientY)?.closest('#btn-discard'));
    const p = sqDragging; sqDragging = null;
    if (overDisc && !sqDaily() && sqDiscards > 0) { sqDoDiscard(p); return; }
    sqRenderAll();
  });

  // THE BOARD, IN THE CAPTURE PHASE, AND THAT IS NOT OPTIONAL. js/input.js binds
  // its own pointerdown on #grid and calls setPointerCapture on the first card
  // it hits - a tap there is "select this card into a hand", which is a gesture
  // this mode does not have. Listening in the bubble phase left the consumable
  // pick receiving nothing at all. Capture runs first, and stopping the event
  // is what keeps a board card from being selected.
  const gridEl = document.getElementById('grid');
  if (gridEl) gridEl.addEventListener('pointerdown', e => {
    if (!squaresActive()) return;
    e.stopPropagation();
    const cell = sqCellAt(e.clientX, e.clientY); if (!cell) return;
    if (sqArmed) { sqConsPick(cell[0], cell[1]); return; }
    if (sqPhase !== 'place' || !sqSelected) return;
    // A tap places the selected tile, for a pointer that cannot drag.
    sqTentative = { piece: sqSelected, r: cell[0], c: cell[1] };
    sqRenderAll();
  }, true);

  document.getElementById('btn-play')?.addEventListener('click', e => {
    if (!squaresActive()) return;
    e.stopPropagation(); sqConfirm();
  }, true);
  document.getElementById('btn-discard')?.addEventListener('click', e => {
    if (!squaresActive()) return;
    e.stopPropagation();
    if (sqDaily()) { sqdTakeBack(); return; }
    if (sqSelected) sqDoDiscard(sqSelected);
  }, true);
  window.addEventListener('keydown', e => {
    if (!squaresActive()) return;
    if (e.key === 'Escape' && sqArmed) { sqArmed = null; sqPicked = []; sqRenderAll(); }
    if (e.key.toLowerCase() === 'r' && sqSelected && sqPhase === 'place') { sqRotate(sqSelected); sqRenderAll(); }
  });
}
function sqMoveDrag(e) {
  if (!sqDragEl) return;
  sqDragEl.style.left = (e.clientX - 48) + 'px';
  sqDragEl.style.top  = (e.clientY - 48) + 'px';
}
function sqReleaseDrag() {
  if (sqDragEl) { sqDragEl.style.display = 'none'; sqDragEl.innerHTML = ''; }
  if (sqDragPid != null) { try { document.body.releasePointerCapture(sqDragPid); } catch (_) {} sqDragPid = null; }
}
// The selection state WITHOUT a re-render - see the drag note above.
function sqSetSelClasses() {
  document.querySelectorAll('#selected-cards .sq-tile').forEach(el => {
    const p = sqHand.find(x => x.id === el.dataset.pid);
    el.classList.toggle('sel', !!p && sqSelected === p);
    el.classList.toggle('placing', !!p && !!sqTentative && sqTentative.piece === p);
  });
}

function sqConfirm() {
  if (sqPhase !== 'place' || !sqTentative) return;
  const { piece, r, c } = sqTentative;
  if (!sqFits(piece, r, c)) { if (typeof sfxNoSwaps === 'function') sfxNoSwaps(); return; }
  // THE BOARD HOLDS THE DECK'S OWN CARD OBJECT, not a copy. That reference is
  // the whole of "a consumable's change is permanent".
  if (sqDaily()) sqdPlaced.push({ piece, at: sqHand.indexOf(piece),
    shape: piece.cells.map(cl => ({ dr: cl.dr, dc: cl.dc, card: cl.card })),
    cells: piece.cells.map(cl => [r + cl.dr, c + cl.dc]) });
  piece.cells.forEach(cl => { gridData[r + cl.dr][c + cl.dc] = cl.card; });
  sqHand = sqHand.filter(x => x !== piece);
  sqTentative = null; sqSelected = null;
  if (typeof sfxCardPop === 'function') sfxCardPop(piece.cells[0].card.suit);
  sqRenderAll();
}
function sqDoDiscard(p) {
  if (sqDiscards <= 0) { if (typeof sfxNoSwaps === 'function') sfxNoSwaps(); return; }
  sqDiscards--;
  p.cells.forEach(cl => playedPile.push(cl.card));
  sqHand = sqHand.filter(x => x !== p);
  if (sqTentative && sqTentative.piece === p) sqTentative = null;
  if (sqSelected === p) sqSelected = null;
  if (typeof sfxCardDiscard === 'function') sfxCardDiscard();
  sqRenderAll();
}
// The board is only submittable once every cell is filled - a daily has a
// surplus of tiles, so a gap is always something you can still close.
const sqdBoardFull = () => sqFilled() === SQ_N * SQ_N;
function sqdTakeBack() {
  if (sqPhase !== 'place' || !sqdPlaced.length) { if (typeof sfxNoSwaps === 'function') sfxNoSwaps(); return; }
  const last = sqdPlaced.pop();
  last.cells.forEach(([r, c]) => { gridData[r][c] = null; });
  // BACK WHERE IT WAS IN THE HAND, and in the ROTATION it was placed in: a tile
  // that comes back turned is a second mistake to undo.
  last.piece.cells = last.shape.map(c => ({ dr: c.dr, dc: c.dc, card: c.card }));
  sqHand.splice(Math.min(last.at, sqHand.length), 0, last.piece);
  sqTentative = null; sqSelected = last.piece;
  if (typeof sfxCardDiscard === 'function') sfxCardDiscard();
  sqRenderAll();
}
function sqEndTurn() {
  if (sqPhase !== 'place') return;
  if (sqDaily()) {
    if (!sqdBoardFull()) { if (typeof sfxNoSwaps === 'function') sfxNoSwaps();
      showMessage?.(`${SQ_N * SQ_N - sqFilled()} cells still empty.`, 'var(--red)'); return; }
    sqTentative = null; sqSelected = null;
    sqAdvance();
    return;
  }
  const stuck = sqHand.length > SQ_KEEP && sqDiscards <= 0 && !sqCanPlaceAny();
  if (sqHand.length > SQ_KEEP && !stuck) { if (typeof sfxNoSwaps === 'function') sfxNoSwaps(); return; }
  sqTentative = null; sqSelected = null;
  if (sqMode === 'select') {
    sqPickNeed = Math.min((sqTurn === SQ_SCHEDULE.length - 1) ? SQ_FINAL_LINES : 1, SQ_LINES() - sqLocked.size);
    if (sqPickNeed > 0) { sqPhase = 'pickline'; sqPickSel = []; sqRenderAll(); return; }
  }
  sqAdvance();
}

// ── SELECT SCORE's line buttons, drawn in the board's own margin ───────────
function sqPaintLineButtons() {
  const g = document.getElementById('grid'); if (!g) return;
  g.querySelectorAll('.sq-lbtn').forEach(el => el.remove());
  if (sqPhase !== 'pickline') return;
  for (let i = 0; i < SQ_LINES(); i++) {
    const b = document.createElement('div');
    b.className = 'sq-lbtn' + (sqLocked.has(i) ? ' off' : '') + (sqPickSel.includes(i) ? ' sel' : '');
    b.textContent = sqIsRow(i) ? 'R' + (i + 1) : 'C' + (i - SQ_N + 1);
    if (sqIsRow(i)) { b.style.left = '-22px'; b.style.top = (cellTop(i) + CARD_H / 2 - 8) + 'px'; }
    else            { b.style.top  = '-20px'; b.style.left = (cellLeft(i - SQ_N) + CARD_W / 2 - 11) + 'px'; }
    if (!sqLocked.has(i)) b.onclick = ev => { ev.stopPropagation(); sqToggleLine(i); };
    g.appendChild(b);
  }
}
function sqToggleLine(i) {
  if (sqPhase !== 'pickline') return;          // the pick is already committed
  if (sqPickSel.includes(i)) sqPickSel = sqPickSel.filter(x => x !== i);
  else if (sqPickSel.length < sqPickNeed) sqPickSel.push(i);
  else return;
  if (typeof sfxRewardSelect === 'function') sfxRewardSelect();
  if (sqPickSel.length < sqPickNeed) { sqRenderAll(); return; }
  // COMMIT SYNCHRONOUSLY. Leaving the phase on 'pickline' for the beat below
  // would let a further click arm a SECOND tally-and-advance and skip a turn.
  sqPhase = 'scoring'; sqRenderAll();
  setTimeout(async () => {
    const picked = sqPickSel.slice();
    await sqRunTally(picked);
    picked.forEach(k => sqLocked.add(k));
    sqAdvance();
  }, 220);
}

// ══════════════════════════════════════════════
// CONSUMABLES
// ══════════════════════════════════════════════
function sqArmCons(i) {
  if (sqPhase !== 'place') { showMessage?.('Consumables are for the placing phase.', 'var(--red)'); return; }
  if (sqArmed && sqArmed.idx === i) { sqArmed = null; sqPicked = []; sqRenderAll(); return; }
  const c = sqCons[i]; if (!c) return;
  const d = sqConsDef(c.id);
  sqArmed = { idx: i, id: c.id, dir: c.dir, need: d.need }; sqPicked = [];
  if (d.need === 0) { sqApplyCons(); return; }
  showMessage?.(`${d.name}: pick ${d.need} card${d.need > 1 ? 's' : ''} on the board.`, 'var(--gold)');
  sqRenderAll();
}
function sqConsPick(r, c) {
  if (!sqArmed || !gridData[r] || !gridData[r][c]) return;
  const at = sqPicked.findIndex(p => p[0] === r && p[1] === c);
  if (at >= 0) sqPicked.splice(at, 1);
  else if (sqPicked.length < sqArmed.need) sqPicked.push([r, c]);
  sqRenderAll();
  if (sqPicked.length === sqArmed.need) setTimeout(sqApplyCons, 120);
}
function sqConsSpend() {
  sqCons.splice(sqArmed.idx, 1); sqArmed = null; sqPicked = [];
  if (typeof sfxRewardGood === 'function') sfxRewardGood();
  sqRenderAll();
}
// A DIRECTIONAL CONSUMABLE REFUSES A CELL WITH NOTHING TO POINT AT. The
// direction is printed on the tile before you take it, so pointing it off the
// edge is a mistake the player can see coming, and spending the charge for
// nothing would make it a trap rather than a choice.
function sqConsRefuse(msg) {
  sqPicked = []; showMessage?.(msg + ' Pick another card.', 'var(--red)');
  if (typeof sfxNoSwaps === 'function') sfxNoSwaps();
  sqRenderAll();
}
function sqRankStep(rank, d) {
  const list = (typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS.length) ? ACTIVE_RANKS : RANKS;
  const i = list.indexOf(rank);
  return list[Math.max(0, Math.min(list.length - 1, i + d))];
}
function sqApplyCons() {
  const id = sqArmed.id, dir = sqArmed.dir, P = sqPicked.slice();
  const at = ([r, c]) => gridData[r][c];
  switch (id) {
    case 'redeal': {
      sqHand.forEach(p => p.cells.forEach(cl => playedPile.push(cl.card)));
      sqHand = [];
      const sp = SQ_SCHEDULE[sqTurn];
      if (sp) sqHand.push(...sqDealPieces(sp.n, sp.size));
      sqTentative = null; sqSelected = null;
      showMessage?.('Re-dealt.', 'var(--gold)'); sqConsSpend(); return;
    }
    case 'swap2': {
      const [a, b] = P; const t = gridData[a[0]][a[1]];
      gridData[a[0]][a[1]] = gridData[b[0]][b[1]]; gridData[b[0]][b[1]] = t;
      showMessage?.('Swapped.', 'var(--gold)'); sqConsSpend(); return;
    }
    case 'clear3':
      P.forEach(([r, c]) => { playedPile.push(gridData[r][c]); gridData[r][c] = null; });
      showMessage?.('Cleared.', 'var(--gold)'); sqConsSpend(); return;
    case 'demote': case 'promote': {
      const d = id === 'promote' ? 1 : -1;
      P.forEach(p => { const c = at(p); c.rank = sqRankStep(c.rank, d); });
      showMessage?.(id === 'promote' ? 'Raised, permanently.' : 'Lowered, permanently.', 'var(--gold)');
      sqConsSpend(); return;
    }
    case 'bleed': {
      const [r, c] = P[0], suit = gridData[r][c].suit;
      const ds = dir === 'LR' ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
      const hit = ds.map(([dr, dc]) => [r + dr, c + dc])
                    .filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < SQ_N && cc < SQ_N && gridData[rr][cc]);
      if (!hit.length) return sqConsRefuse('No card ' + (dir === 'LR' ? 'beside' : 'above or below') + ' that one.');
      hit.forEach(([rr, cc]) => gridData[rr][cc].suit = suit);
      showMessage?.(`Suit bled onto ${hit.length} card${hit.length > 1 ? 's' : ''}, permanently.`, 'var(--gold)');
      sqConsSpend(); return;
    }
    case 'echo': {
      const [r, c] = P[0], rank = gridData[r][c].rank;
      const d = { L: [0, -1], R: [0, 1], U: [-1, 0], D: [1, 0] }[dir];
      const rr = r + d[0], cc = c + d[1];
      if (!(rr >= 0 && cc >= 0 && rr < SQ_N && cc < SQ_N && gridData[rr][cc]))
        return sqConsRefuse('No card ' + ({ L: 'to the left of', R: 'to the right of', U: 'above', D: 'below' })[dir] + ' that one.');
      gridData[rr][cc].rank = rank;
      showMessage?.('Echoed, permanently.', 'var(--gold)'); sqConsSpend(); return;
    }
    case 'forge':  sqOpenForge(P[0]); return;
    case 'resuit': sqOpenSuit(P); return;
  }
}
function sqOpenForge(cell) {
  let rank = null, suit = null;
  const ov = sqOverlay();
  ov.querySelector('.sq-eyebrow').textContent = 'Forge';
  ov.querySelector('.sq-title').textContent = 'Forge a card';
  ov.querySelector('.sq-lead').textContent = 'Pick a rank and a suit. That card becomes this, permanently, in your deck.';
  const ranks = (typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS.length) ? ACTIVE_RANKS : RANKS;
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : SUITS;
  const paint = () => {
    ov.querySelector('.sq-body').innerHTML =
      `<div class="sq-suitrow">${suits.map(s => `<div class="sq-sbtn ${sqSuitCls(s)}${suit === s ? ' on' : ''}" data-s="${s}">${s}</div>`).join('')}</div>` +
      `<div class="sq-rankgrid">${ranks.map(r => `<div class="sq-rbtn${rank === r ? ' on' : ''}" data-r="${r}">${r}</div>`).join('')}</div>`;
    ov.querySelector('.sq-body').onclick = e => {
      const s = e.target.closest('.sq-sbtn'), r = e.target.closest('.sq-rbtn');
      if (s) suit = s.dataset.s; if (r) rank = r.dataset.r;
      if (s || r) { paint(); ov.querySelector('#sq-forge-ok').disabled = !(rank && suit); }
    };
  };
  paint();
  ov.querySelector('.sq-foot').innerHTML =
    `<button class="sq-btn go" id="sq-forge-ok" disabled>MAKE IT</button><button class="sq-btn" id="sq-forge-no">CANCEL</button>`;
  ov.querySelector('#sq-forge-ok').onclick = () => {
    const cd = gridData[cell[0]][cell[1]];
    cd.rank = rank; cd.suit = suit;
    sqCloseOverlay(); showMessage?.('Forged, permanently.', 'var(--gold)'); sqConsSpend();
  };
  ov.querySelector('#sq-forge-no').onclick = () => { sqCloseOverlay(); sqArmed = null; sqPicked = []; sqRenderAll(); };
  sqShowOverlay();
}
function sqOpenSuit(cells) {
  const ov = sqOverlay();
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : SUITS;
  ov.querySelector('.sq-eyebrow').textContent = 'Re-suit';
  ov.querySelector('.sq-title').textContent = 'Choose a suit';
  ov.querySelector('.sq-lead').textContent = 'Both picked cards become this suit, permanently, in your deck.';
  ov.querySelector('.sq-body').innerHTML =
    `<div class="sq-suitrow">${suits.map(s => `<div class="sq-sbtn ${sqSuitCls(s)}" data-s="${s}">${s}</div>`).join('')}</div>`;
  ov.querySelector('.sq-body').onclick = e => {
    const b = e.target.closest('.sq-sbtn'); if (!b) return;
    cells.forEach(([r, c]) => gridData[r][c].suit = b.dataset.s);
    sqCloseOverlay(); showMessage?.('Re-suited, permanently.', 'var(--gold)'); sqConsSpend();
  };
  ov.querySelector('.sq-foot').innerHTML = `<button class="sq-btn" id="sq-suit-no">CANCEL</button>`;
  ov.querySelector('#sq-suit-no').onclick = () => { sqCloseOverlay(); sqArmed = null; sqPicked = []; sqRenderAll(); };
  sqShowOverlay();
}

// ══════════════════════════════════════════════
// THE CONSOLE - #event-panel's own chrome, built once
// ══════════════════════════════════════════════
function sqOverlay() {
  let ov = document.getElementById('sq-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'sq-overlay';
    ov.innerHTML =
      `<div class="sq-panel">
         <div class="sq-bar"><span class="sq-eyebrow"></span>
           <span class="sq-lamps"><i></i><i></i><i></i></span></div>
         <div class="sq-title"></div>
         <div class="sq-lead"></div>
         <div class="sq-body"></div>
         <div class="sq-foot"></div>
       </div>`;
    document.body.appendChild(ov);   // BODY LEVEL: anything inside #cabinet takes its CSS zoom
  }
  return ov;
}
const sqShowOverlay = () => sqOverlay().classList.add('show');
const sqCloseOverlay = () => sqOverlay().classList.remove('show');
function sqReport(title, body, onOk) {
  const ov = sqOverlay();
  ov.querySelector('.sq-eyebrow').textContent = title;
  ov.querySelector('.sq-title').textContent = title;
  ov.querySelector('.sq-lead').textContent = '';
  ov.querySelector('.sq-body').innerHTML = `<pre class="sq-report"></pre>`;
  ov.querySelector('.sq-report').textContent = body;
  ov.querySelector('.sq-foot').innerHTML = `<button class="sq-btn go" id="sq-ok">CONTINUE</button>`;
  ov.querySelector('#sq-ok').onclick = () => { sqCloseOverlay(); onOk && onOk(); };
  sqShowOverlay();
}

  // A LAYOUT CHANGE HAS TO RE-RUN THE FIT. A poly is sized from the tile's
  // MEASURED inner box, so an orientation flip or a window resize leaves every
  // tile fitted to a box that no longer exists - which is the owner's "the
  // Tetris piece went over the card boundary". Deferred by a tick for map
  // mode's reason: js/bootstrap.js is the LAST script, so the handler that
  // toggles `.landscape` is registered after this one and runs after it.
// ── A LAYOUT CHANGE HAS TO RE-RUN BOTH FITS (r309) ─────────────────────────
// The board is sized from the MEASURED slot and a poly from its tile's MEASURED
// inner box, so an orientation flip leaves every one of them fitted to a box
// that no longer exists - the owner's "the Tetris piece went over the card
// boundary".
//
// A `resize` LISTENER IS NOT ENOUGH, and the reason is the office photograph.
// While it is on screen the stage is forced LANDSCAPE whatever the device is
// (r257), and the channel change hands a phone back its portrait layout behind
// the flash by calling applyStageLayout DIRECTLY - no resize event, no
// orientationchange. Measured on a 420x900 phone: the first deal fitted its
// tiles to a 278x217 landscape host and nothing ever re-measured them.
//
// So the trigger is a ResizeObserver on the two boxes themselves, which cannot
// miss a cause it has not been told about. `_sqLastBox` is what stops a loop: a
// render is only run when a box has genuinely changed size.
let _sqRO = null, _sqLastBox = '', _sqResizeT = null;
function sqBoxKey() {
  const a = document.getElementById('grid-slot'), b = document.getElementById('selected-cards');
  return (a ? a.offsetWidth + 'x' + a.offsetHeight : '') + '|' + (b ? b.offsetWidth + 'x' + b.offsetHeight : '');
}
function sqSyncLayout(force) {
  if (!squaresActive()) return;
  const key = sqBoxKey();
  if (!force && key === _sqLastBox) return;
  _sqLastBox = key;
  gridRows = SQ_N; gridCols = SQ_N;
  if (typeof recomputeGridMetrics === 'function') recomputeGridMetrics();
  sqRenderAll();
}
function sqObserveLayout() {
  if (typeof ResizeObserver === 'undefined') return;
  if (_sqRO) _sqRO.disconnect();
  _sqRO = new ResizeObserver(() => sqSyncLayout());
  ['grid-slot', 'selected-cards'].forEach(id => { const el = document.getElementById(id); if (el) _sqRO.observe(el); });
  _sqLastBox = sqBoxKey();
}
function sqUnobserveLayout() { if (_sqRO) { _sqRO.disconnect(); _sqRO = null; } _sqLastBox = ''; }
function _sqOnResize() {
  if (!squaresActive()) return;
  clearTimeout(_sqResizeT);
  _sqResizeT = setTimeout(() => sqSyncLayout(true), 140);
}
window.addEventListener('resize', _sqOnResize);
window.addEventListener('orientationchange', _sqOnResize);

sqInstallInput();
