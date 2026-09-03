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
  const zoom = parseFloat(getComputedStyle(stage).getPropertyValue('--stage-zoom')) || 1;
  // The camera (r180) can also be scaling the whole scene - it is at the wide
  // "cabinet on a desk" framing whenever a menu is up, and mid-dolly on the way
  // into a run. getBoundingClientRect sees that too, so both scales come out or
  // the cards get sized for a board 40% smaller than the one being played on.
  const cam  = (typeof camScale === 'function') ? camScale() : 1;
  const rect = slot.getBoundingClientRect();
  const w = rect.width  / zoom / cam;
  const h = rect.height / zoom / cam;
  // Guard against pre-layout / hidden states returning ~0.
  if (w < 40 || h < 40) return { w: GRID_FOOTPRINT_W, h: GRID_FOOTPRINT_H };
  return { w, h };
}

function recomputeGridMetrics() {
  const cols = gridCols, rows = gridRows;
  // Fit cards to the MEASURED slot so the grid always fills the available area
  // without ever overflowing onto the action buttons (any orientation/size).
  const slot   = measureGridSlot();
  // Reserve a small safety margin on every side so the grid never touches (and
  // never spills onto) the focus meter on the left or the action buttons on the
  // right - even after rounding. Fixes the "buttons overlap the grid" issue.
  const SLOT_SAFETY = 5;
  const innerW = slot.w - SLOT_SAFETY * 2 - GRID_PAD * 2 - CARD_GAP * (cols - 1);
  const innerH = slot.h - SLOT_SAFETY * 2 - GRID_PAD * 2 - CARD_GAP * (rows - 1);
  let w = Math.floor(innerW / cols);
  let h = Math.floor(innerH / rows);
  // Dominoes: a cell is only HALF a tile, so the playing-card aspect ratio and the
  // card-size minimums below don't apply - enforcing them on an 8×8 board pushed
  // the grid past its slot (tiles drew over the clock bar and off the bottom).
  // Fit the board to the measured slot instead.
  if (typeof dominoActive === 'function' && dominoActive()) {
    CARD_W = Math.max(12, w);
    CARD_H = Math.max(12, h);
    CARD_STEP = CARD_H + CARD_GAP;
    applyGridMetricsToDOM();
    return;
  }
  // Constrain to playing-card aspect: take whichever dimension is the tighter fit.
  if (h / w > CARD_ASPECT) h = Math.round(w * CARD_ASPECT); // width-bound
  else                     w = Math.round(h / CARD_ASPECT); // height-bound
  // Minimum floor (huge grids may slightly exceed the slot - acceptable, the
  // slot has overflow:visible so they just spill a touch, not onto buttons).
  w = Math.max(w, CARD_MIN_W);
  h = Math.max(h, CARD_MIN_H);

  CARD_W = w;
  CARD_H = h;
  CARD_STEP = CARD_H + CARD_GAP;

  applyGridMetricsToDOM();
}

function applyGridMetricsToDOM() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  const totalW = gridCols * CARD_W + (gridCols - 1) * CARD_GAP + GRID_PAD * 2;
  const totalH = gridRows * CARD_H + (gridRows - 1) * CARD_GAP + GRID_PAD * 2;
  gridEl.style.width  = totalW + 'px';
  gridEl.style.height = totalH + 'px';
  // Push live card size to CSS custom props so .card / fonts can react
  document.documentElement.style.setProperty('--card-w', CARD_W + 'px');
  document.documentElement.style.setProperty('--card-h', CARD_H + 'px');
  syncSidebarsToGrid();
}

// Landscape only: the playing grid centers inside its slot, so its real footprint
// depends on card size + column count. Pin the focus meter to the grid's LEFT edge
// and stretch the clock readout + timer bar across the grid's WIDTH, so both track
// the grid and scale as it grows (more columns → wider grid → wider clock bar).
function syncSidebarsToGrid() {
  const stage = document.getElementById('stage');
  const focus = document.getElementById('focus-meter-wrap');
  const clockArea = document.getElementById('clock-area');
  const vclock = document.getElementById('vclock');
  const landscape = stage && stage.classList.contains('landscape');
  if (!landscape) {   // portrait: drop any inline overrides so the stacked layout is untouched
    [focus, clockArea, vclock].forEach(e => { if (e) { e.style.left = ''; e.style.width = ''; } });
    return;
  }
  const grid = document.getElementById('grid');
  if (!grid) return;
  const s = stage.getBoundingClientRect();
  const g = grid.getBoundingClientRect();
  if (s.width < 10 || g.width < 10) return;
  const pct = px => px / s.width * 100;
  const gLeft  = pct(g.left  - s.left);
  const gWidth = pct(g.width);
  // Clock readout (fixed slice at the grid's left) + timer bar fill the grid width.
  if (clockArea && vclock) {
    const readoutW = 7;
    clockArea.style.left  = gLeft + '%';
    clockArea.style.width = readoutW + '%';
    vclock.style.left  = (gLeft + readoutW + 0.6) + '%';
    vclock.style.width = Math.max(6, gWidth - readoutW - 0.6) + '%';
  }
  // Focus meter sits right against the grid's left edge - but never back far
  // enough to crowd the left column (its right edge is ~39.3% of the stage).
  if (focus) {
    const fw = pct(focus.getBoundingClientRect().width);
    focus.style.left = Math.max(39.5, gLeft - fw - 0.4) + '%';
  }
}

function cellLeft(c) { return GRID_PAD + c * (CARD_W + CARD_GAP); }
function cellTop(r)  { return GRID_PAD + r * (CARD_H + CARD_GAP); }
