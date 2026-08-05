const CARD_MIN_W = 40;        // floor — below this cards stop shrinking
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
  const rect = slot.getBoundingClientRect();
  const w = rect.width  / zoom;
  const h = rect.height / zoom;
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
  // right — even after rounding. Fixes the "buttons overlap the grid" issue.
  const SLOT_SAFETY = 5;
  const innerW = slot.w - SLOT_SAFETY * 2 - GRID_PAD * 2 - CARD_GAP * (cols - 1);
  const innerH = slot.h - SLOT_SAFETY * 2 - GRID_PAD * 2 - CARD_GAP * (rows - 1);
  let w = Math.floor(innerW / cols);
  let h = Math.floor(innerH / rows);
  // Constrain to playing-card aspect: take whichever dimension is the tighter fit.
  if (h / w > CARD_ASPECT) h = Math.round(w * CARD_ASPECT); // width-bound
  else                     w = Math.round(h / CARD_ASPECT); // height-bound
  // Minimum floor (huge grids may slightly exceed the slot — acceptable, the
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
  const machine = document.getElementById('left-machine');
  const landscape = stage && stage.classList.contains('landscape');
  if (!landscape) {   // portrait: drop any inline overrides so the stacked layout is untouched
    [focus, clockArea, vclock].forEach(e => { if (e) { e.style.left = ''; e.style.width = ''; } });
    if (machine) machine.style.width = '';
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
  // Focus meter: hug the grid's left edge AND match the grid's vertical extent.
  if (focus) {
    const fw = pct(focus.getBoundingClientRect().width);
    focus.style.left   = Math.max(39.5, gLeft - fw - 0.4) + '%';
    focus.style.top    = ((g.top - s.top) / s.height * 100) + '%';   // top % is of stage HEIGHT
    focus.style.height = (g.height / s.height * 100) + '%';
  }
  // Beige panel fills everything to the LEFT of the focus bar (the bar is NOT on
  // the beige). End it just left of the visible bar.
  if (machine) {
    const bar = document.getElementById('focus-bar-outer');
    const rightPct = bar ? pct(bar.getBoundingClientRect().left - s.left) : (gLeft - 5);
    machine.style.width = Math.max(20, rightPct - 0.3) + '%';
  }
}

function cellLeft(c) { return GRID_PAD + c * (CARD_W + CARD_GAP); }
function cellTop(r)  { return GRID_PAD + r * (CARD_H + CARD_GAP); }
