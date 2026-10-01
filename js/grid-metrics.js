const CARD_MIN_W = 40;        // floor - below this cards stop shrinking
const CARD_MIN_H = 53;        // keeps playing-card aspect
const CARD_ASPECT = 75 / 57;  // height / width, preserved on resize

// Measure the real, in-canvas slot the grid occupies (in DESIGN px, i.e. before
// the #stage CSS zoom). The slot is a flex:1 box between the focus meter and the
// action buttons, so its size is stable and independent of the grid's contents.
function measureGridSlot() {
  const slot  = document.getElementById('grid-slot');
  const stage = document.getElementById('stage');
  if (!slot || !stage) return { w: GRID_FOOTPRINT_W, h: GRID_FOOTPRINT_H };
  // MEASURED IN THE SLOT'S OWN LAYOUT UNITS, not from getBoundingClientRect.
  //
  // offsetWidth/offsetHeight already ARE design px and are immune to every
  // transform above them, so the zoom and the camera scale simply do not come
  // into it. The rect needed both divided back out (r180), and that was only ever
  // right while the scene's transforms were plain scales.
  //
  // The r244 photo office broke that: the skew onto the monitor is a PERSPECTIVE
  // map, so the rect is the TRAPEZOID'S BOUNDING BOX and no single divisor can
  // undo it. Measured at 1440x820 - the rect path read the slot as 338 x 462
  // where its real box is 336 x 362, a 28% over-read on the height, and the grid
  // came out 421px tall inside a 420px stage. That is the dark shape that pokes
  // out above and below the monitor, and it means every card was sized off a
  // distorted measurement. Same trap as the r160 Trick fan: never mix the two.
  const w = slot.offsetWidth;
  const h = slot.offsetHeight;
  // Guard against pre-layout / hidden states returning ~0.
  if (w < 40 || h < 40) return { w: GRID_FOOTPRINT_W, h: GRID_FOOTPRINT_H };
  return { w, h };
}

// ── THE GAP IS A SHARE OF THE CARD (r391) ───────────────────────────────────
// Owner: "shrink the card size by a couple of pixels or so so there's a more
// obvious gap between cards". On a board that is FITTED to its slot those are
// the same edit seen from either end - the grid always fills the measured slot,
// so a wider gap IS a smaller card and a smaller card on its own buys no gap at
// all (cellLeft is GRID_PAD + c * (CARD_W + CARD_GAP), so the gutter is CARD_GAP
// and nothing else).
//
// A flat constant is the wrong shape for it, because the gap costs the same
// pixels on a 4x4 board and a 7x7 one and only the 4x4 has them to spare. So the
// gap is a share of the card's WIDTH, floored at the orientation's old value:
// a small board, where the gutter is what you actually look at, gets a generous
// one, and a big board - already sitting on CARD_MIN_W/CARD_MIN_H and spilling
// its slot - is not squeezed any further. Measured: a 7x7 board comes out with
// the same 5px gap it had before this change.
const CARD_GAP_FRAC = 0.13;   // of CARD_W
const CARD_GAP_SPAN = 3;      // how far above the floor it may climb
function gapForCardW(w) {
  const base = (typeof CARD_GAP_BASE === 'number') ? CARD_GAP_BASE : 3;
  return Math.min(base + CARD_GAP_SPAN, Math.max(base, Math.round(w * CARD_GAP_FRAC)));
}

// A BOARD SITTING ON THE CARD FLOOR GETS NEITHER THE WIDER GUTTER NOR THE
// THICKER FRAME. Past CARD_MIN_W/CARD_MIN_H the card cannot shrink to pay for
// them, so every pixel they take comes straight off the slot and the board spills
// further than it already does. Measured on the Schedule's 4x7 board at 420x900,
// which is at the floor the moment a run opens: it overflowed its slot by 6px
// before r391, by 26px with the gap and the frame let through, and by 8px with
// this. The frame giving way exactly where the board needs the room is also why
// the rings step down to the shallow set there (`.grid-tight`, css/style.css) -
// a 5px ring stack inside a 3px frame would sit behind the first row of cards.
const GRID_PAD_BASE = 6, GRID_PAD_TIGHT = 3;

function recomputeGridMetrics() {
  const cols = gridCols, rows = gridRows;
  // Fit cards to the MEASURED slot so the grid always fills the available area
  // without ever overflowing onto the action buttons (any orientation/size).
  const slot   = measureGridSlot();
  // POKER SQUARES RESERVES A BAND for its line headers (js/squares-mode.js), and
  // it has to come off the MEASURED slot rather than being drawn over the board:
  // the headers name the hand each row and column is making, so they are read
  // beside the cards, not on top of them. #grid-slot carries the matching
  // padding, which is what puts the freed room on the left and the top rather
  // than splitting it evenly around a centred board.
  if (typeof sqSlotInset === 'function') {
    const ins = sqSlotInset();
    if (ins) { slot.w = Math.max(60, slot.w - ins.x); slot.h = Math.max(60, slot.h - ins.y); }
  }
  // Reserve a small safety margin on every side so the grid never touches (and
  // never spills onto) the focus meter on the left or the action buttons on the
  // right - even after rounding. Fixes the "buttons overlap the grid" issue.
  const SLOT_SAFETY = 5;
  GRID_PAD = GRID_PAD_BASE;   // the tight fallback below is decided by the fit
  // Fit the cards into whatever the frame and the gutters leave.
  const fit = (gap, pad) => {
    const frame = SLOT_SAFETY * 2 + pad * 2 + GRID_BORDER * 2;
    return { w: Math.floor((slot.w - frame - gap * (cols - 1)) / cols),
             h: Math.floor((slot.h - frame - gap * (rows - 1)) / rows) };
  };
  let box = fit(CARD_GAP_BASE, GRID_PAD);
  let w = box.w, h = box.h;
  // Constrain to playing-card aspect: take whichever dimension is the tighter fit.
  const shape = () => {
    if (h / w > CARD_ASPECT) h = Math.round(w * CARD_ASPECT); // width-bound
    else                     w = Math.round(h / CARD_ASPECT); // height-bound
    // Minimum floor (huge grids may slightly exceed the slot - acceptable, the
    // slot has overflow:visible so they just spill a touch, not onto buttons).
    w = Math.max(w, CARD_MIN_W);
    h = Math.max(h, CARD_MIN_H);
  };
  shape();
  // TWO PASSES, because the gap depends on the card and the card depends on the
  // gap. The first solve is only there to learn roughly how big a card this board
  // holds; the gap it implies is then what the board is really built with. A
  // third pass buys nothing - measured, every board size the game can produce is
  // already converged (or one px off, which is a rounding step, not a wobble).
  const floored = () => (w <= CARD_MIN_W || h <= CARD_MIN_H);
  let gap = floored() ? CARD_GAP_BASE : gapForCardW(w);
  if (floored()) GRID_PAD = GRID_PAD_TIGHT;
  if (gap !== CARD_GAP_BASE || GRID_PAD !== GRID_PAD_BASE) {
    box = fit(gap, GRID_PAD); w = box.w; h = box.h; shape();
    // The second solve can reach the floor the first one cleared - a board one
    // step off it pays the wider gutter and lands on it. Take the room back.
    if (floored() && (gap !== CARD_GAP_BASE || GRID_PAD !== GRID_PAD_TIGHT)) {
      gap = CARD_GAP_BASE; GRID_PAD = GRID_PAD_TIGHT;
      box = fit(gap, GRID_PAD); w = box.w; h = box.h; shape();
    }
  }

  CARD_GAP = gap;
  CARD_W = w;
  CARD_H = h;
  CARD_STEP = CARD_H + CARD_GAP;

  applyGridMetricsToDOM();
}

function applyGridMetricsToDOM() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  // THE BORDER IS COUNTED (r391). A card is absolutely positioned and so anchors
  // to #grid's PADDING box - inside the border - at GRID_PAD + c * (W + GAP). The
  // box is sized border-box, so leaving the border out of this left the padding
  // box 2px short and the board's frame came out GRID_PAD on the left and
  // GRID_PAD - 2 on the right. At a 3px frame that was invisible; at the 6px one
  // the rings are drawn in it is a visibly lopsided chasm.
  const totalW = gridCols * CARD_W + (gridCols - 1) * CARD_GAP + GRID_PAD * 2 + GRID_BORDER * 2;
  const totalH = gridRows * CARD_H + (gridRows - 1) * CARD_GAP + GRID_PAD * 2 + GRID_BORDER * 2;
  gridEl.style.width  = totalW + 'px';
  gridEl.style.height = totalH + 'px';
  // A 5px ring stack inside a 3px frame would sit behind the first row of cards
  // and show only through the gutters, which reads as stray lines rather than as
  // a chasm - so a tight board takes the shallow set (css/style.css).
  gridEl.classList.toggle('grid-tight', GRID_PAD < GRID_PAD_BASE);
  // Push live card size to CSS custom props so .card / fonts can react
  document.documentElement.style.setProperty('--card-w', CARD_W + 'px');
  document.documentElement.style.setProperty('--card-h', CARD_H + 'px');
  // The grid's real footprint, so anything anchored in the EMPTY MARGIN of
  // #grid-slot can size itself against it in CSS alone. #grid is centred in the
  // slot, so that margin is (slot - grid) / 2 on each side - which is where the
  // selection readout lives (#sel-count). Without these it would have to be
  // measured from JS on every resize.
  document.documentElement.style.setProperty('--grid-w', totalW + 'px');
  document.documentElement.style.setProperty('--grid-h', totalH + 'px');
  replaceGridCells();
  syncSidebarsToGrid();
}

// A CARD'S SIZE FOLLOWS A RECOMPUTE AND ITS POSITION DID NOT (r391).
// `--card-w`/`--card-h` are CSS, so every card on the board resizes the instant
// this runs - but `top`/`left` are inline px written by render(), and nothing
// rewrites them until the next render(). So any recompute that is not followed by
// one leaves the board laid out to the PREVIOUS card size, and there is a real
// path that does exactly that: the office photograph forces the stage landscape
// (r257) and hands a phone its portrait layout back through applyStageLayout,
// which recomputes and does not repaint. Measured on a 420x900 phone before this:
// a pitch of 67 against a 70px cell, i.e. **every card overlapping its neighbour
// by a pixel**, for the whole round. It is pre-existing and r391 only makes it
// plainer, because the gutter moves now as well as the card.
//
// `dataset.row`/`dataset.col` are on every card render() builds, so re-placing is
// exact and needs no state of its own. It stands down while the board is moving -
// the fall animation writes `top` itself, and the discard fly-out an inline
// transform - and a render() is coming at the end of either anyway.
function replaceGridCells() {
  if ((typeof animating !== 'undefined' && animating) ||
      (typeof falling   !== 'undefined' && falling)) return;
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  gridEl.querySelectorAll('[data-card-id][data-row]').forEach(el => {
    const r = +el.dataset.row, c = +el.dataset.col;
    if (!Number.isFinite(r) || !Number.isFinite(c)) return;
    el.style.left = cellLeft(c) + 'px';
    el.style.top  = cellTop(r)  + 'px';
  });
}

// Landscape only: the playing grid centers inside its slot, so its real footprint
// depends on card size + column count. Pin the focus meter to the grid's LEFT edge
// and stretch the clock readout + timer bar across the grid's WIDTH, so both track
// the grid and scale as it grows (more columns → wider grid → wider clock bar).
// Where the left column's outer edge sits, as a percentage of the stage. The
// playing layout runs it to 39.3% (1.56% + 37.74%). Anything that has to sit
// clear of the column asks here rather than carrying its own copy of the number.
// (The r230 shop squish that narrowed it is gone, r412.)
const LCOL_RIGHT_PLAY = 39.3;
function leftColumnRightPct() { return LCOL_RIGHT_PLAY; }

function syncSidebarsToGrid() {
  const stage = document.getElementById('stage');
  const focus = document.getElementById('focus-meter-wrap');
  const clockArea = document.getElementById('clock-area');
  const vclock = document.getElementById('vclock');
  const landscape = stage && stage.classList.contains('landscape');
  if (!landscape) {   // portrait: drop any inline overrides so the stacked layout is untouched
    [focus, clockArea, vclock].forEach(e => { if (e) { e.style.left = ''; e.style.width = ''; } });
    if (focus) { focus.style.top = ''; focus.style.height = ''; }
    return;
  }
  const grid = document.getElementById('grid');
  if (!grid) return;
  const s = stage.getBoundingClientRect();
  const g = grid.getBoundingClientRect();
  if (s.width < 10 || g.width < 10) return;
  const pct  = px => px / s.width  * 100;
  const pctH = px => px / s.height * 100;
  const gLeft  = pct(g.left  - s.left);
  const gWidth = pct(g.width);
  // ── The focus meter is placed FIRST, because the clock reads over it (r377) ──
  // It sits right against the grid's left edge - but never back far enough to
  // crowd the left column. That floor is the COLUMN'S OWN right edge, not a
  // constant: the shop squeezes the column to 25% of the stage (r230), and a
  // hardcoded 39.5 pinned the meter out over the board while the column it was
  // avoiding had moved 13% to the left.
  //
  // IT ALSO TAKES THE GRID'S HEIGHT. It used to run 1.39% -> 98.06% of the
  // stage whatever the board was - measured at 780px against a 670px grid - so
  // the gauge started most of a card above the top row and meant nothing at
  // either end. The grid's own top and height are right here, so this is exact
  // and needs no second measurement; the ×1.0 readout drops below the bar
  // (css/clock-track.css) rather than eating into it.
  let fLeft = null, fw = 0;
  if (focus) {
    fw = pct(focus.getBoundingClientRect().width);
    // r380: a takeover board (and Flow's deck edit) is drawn on a panel padded
    // ~9 design px (1.2%) past the grid, so the meter has to clear that too or the
    // panel's edge sits over it.
    const b = document.body.classList;
    const gap = (b.contains('gp-active') || b.contains('flowr-hold') || b.contains('flowr-deck')) ? 1.6 : 0.4;
    fLeft = Math.max(leftColumnRightPct() + 0.2, gLeft - fw - gap);
    focus.style.left   = fLeft + '%';
    focus.style.top    = pctH(g.top - s.top) + '%';
    focus.style.height = pctH(g.height) + '%';
  }
  // ── The clock reads over the focus column; the bar runs from there to the
  //    grid's right edge ──
  // The digits used to sit ON the grid's left edge, which put them beside the
  // focus bar rather than above it and started the track a seventh of the way
  // across the board. Centred on the focus column they cost the track nothing,
  // so the bar is a good deal longer and ends where the board does - which in
  // Flow is where the review mark sits.
  if (clockArea && vclock) {
    const readoutW = 7;
    const cLeft = fLeft === null ? gLeft
                : Math.max(leftColumnRightPct() + 0.1, fLeft + fw / 2 - readoutW / 2);
    clockArea.style.left  = cLeft + '%';
    clockArea.style.width = readoutW + '%';
    const barLeft = Math.max(cLeft + readoutW + 0.6, gLeft);
    vclock.style.left  = barLeft + '%';
    vclock.style.width = Math.max(6, (gLeft + gWidth) - barLeft) + '%';
  }
}

function cellLeft(c) { return GRID_PAD + c * (CARD_W + CARD_GAP); }
function cellTop(r)  { return GRID_PAD + r * (CARD_H + CARD_GAP); }
