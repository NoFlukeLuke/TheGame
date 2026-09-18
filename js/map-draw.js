// ══════════════════════════════════════════════
// THE SCHEDULE'S PEN AND LEGEND (r263)
// ══════════════════════════════════════════════
// Two things you can do to the schedule without changing it: DRAW on it, and
// ask what the obligations ARE.
//
// The pen is a canvas laid over the board inside #grid. Right-click dragging
// draws with no mode to enter (desktop), double right-click cycles the colour,
// and the pen chip in the bar turns drawing on for a finger. Strokes are
// stored NORMALISED to the grid box, so they survive every mapRender (which
// wipes #grid), an orientation flip and a save.
//
// The legend answers the other question and highlights as you read it, the way
// Slay the Spire's does: hover a row and only those obligations stay lit.

const MAP_PEN_COLORS = ['#f5c042', '#8fd0ff', '#6fd08c', '#ff7a7a', '#ffffff'];
const MAP_PEN_WIDTH = 2.4;

let mapDrawStrokes = [];   // [{ c: colorIndex, p: [x,y,...] } ] - x/y are 0..1
let mapPenColor = 0;
let mapPenOn = false;      // finger mode: the layer takes every tap

let _mapDrawing = null;    // the stroke being laid down
let _mapLastRightAt = 0;   // for the double right-click colour cycle
let _mapDrawBound = false;

function mapPenHex() { return MAP_PEN_COLORS[mapPenColor % MAP_PEN_COLORS.length]; }

// A pen in the CURRENT colour, as the cursor. The hotspot is the nib, bottom
// left, so the ink starts where the tip is rather than where the middle is.
function mapPenCursor(hex) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">` +
    `<path d="M3 19l1.4-4.2L15.1 4.1a1.9 1.9 0 0 1 2.7 0l.1.1a1.9 1.9 0 0 1 0 2.7L7.2 17.6z" ` +
    `fill="${hex}" stroke="#1a1430" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M3 19l1.4-4.2 2.8 2.8z" fill="#1a1430"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 2 20, crosshair`;
}

// ── The layer ───────────────────────────────────────────────────────────────
// Mounted from the END of mapRender, because that function clears #grid: the
// canvas is a child so it goes with the tiles and has to be put back. The
// STROKES are not in the DOM, so nothing is lost by that.
function mapDrawMount(gridEl) {
  if (!gridEl) return;
  const w = gridEl.offsetWidth, h = gridEl.offsetHeight;
  if (!w || !h) return;
  let cv = document.createElement('canvas');
  cv.className = 'map-draw-layer' + (mapPenOn ? ' pen-on' : '');
  cv.id = 'map-draw-layer';
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.cssText = `left:0;top:0;width:${w}px;height:${h}px;`;
  if (mapPenOn) cv.style.cursor = mapPenCursor(mapPenHex());
  gridEl.appendChild(cv);
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  mapDrawPaint();
  mapDrawBind(gridEl);
}

function mapDrawPaint() {
  const cv = document.getElementById('map-draw-layer');
  if (!cv) return;
  const w = cv.clientWidth, h = cv.clientHeight;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const all = _mapDrawing ? mapDrawStrokes.concat([_mapDrawing]) : mapDrawStrokes;
  for (const s of all) {
    if (!s || !s.p || s.p.length < 2) continue;
    ctx.strokeStyle = MAP_PEN_COLORS[s.c % MAP_PEN_COLORS.length];
    ctx.lineWidth = MAP_PEN_WIDTH;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2;
    ctx.beginPath();
    ctx.moveTo(s.p[0] * w, s.p[1] * h);
    if (s.p.length === 2) ctx.lineTo(s.p[0] * w + 0.1, s.p[1] * h + 0.1);
    for (let i = 2; i < s.p.length; i += 2) ctx.lineTo(s.p[i] * w, s.p[i + 1] * h);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

// #grid is never REPLACED, only emptied, so one binding outlives every render.
// The events are taken on #grid rather than on the canvas because with the pen
// off the canvas is pointer-events:none - a right-drag has to keep working
// over a tile, which is where you actually want to circle something.
function mapDrawBind(gridEl) {
  if (_mapDrawBound) return;
  _mapDrawBound = true;
  gridEl.addEventListener('contextmenu', (e) => { if (mapScreenOpen) e.preventDefault(); });
  gridEl.addEventListener('pointerdown', (e) => {
    if (!mapScreenOpen) return;
    const right = e.button === 2;
    if (!right && !(mapPenOn && e.button === 0)) return;
    e.preventDefault();
    if (right) {
      // Double right-click cycles the colour. The first click of the pair has
      // already opened a stroke; if it never moved it is a dot nobody asked
      // for, so it is taken back rather than left on the board.
      // THE WINDOW IS STAMPED BY A CLICK, NEVER BY A DRAG (see the `up` below):
      // a drag that ends and a click that follows it are two separate marks,
      // and treating them as a pair made the click after every quick circle
      // cycle the colour instead of drawing.
      if (performance.now() - _mapLastRightAt < 350) {
        _mapLastRightAt = 0;
        const last = mapDrawStrokes[mapDrawStrokes.length - 1];
        if (last && last.p.length <= 2) mapDrawStrokes.pop();
        _mapDrawing = null;
        mapPenColor = (mapPenColor + 1) % MAP_PEN_COLORS.length;
        mapDrawPaint(); mapPenSyncChrome();
        try { sfxCardSelect?.(); } catch (err) {}
        return;
      }
    }
    _mapDrawing = { c: mapPenColor, p: [] };
    _mapDrawAdd(e);
    const move = (ev) => { if (_mapDrawing) { _mapDrawAdd(ev); mapDrawPaint(); } };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const dot = !!_mapDrawing && _mapDrawing.p.length <= 2;
      if (_mapDrawing && _mapDrawing.p.length >= 2) mapDrawStrokes.push(_mapDrawing);
      _mapDrawing = null;
      if (right) _mapLastRightAt = dot ? performance.now() : 0;
      mapDrawPaint(); mapRenderBar();
      gridEl.style.cursor = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    if (right) gridEl.style.cursor = mapPenCursor(mapPenHex());
  });
}

// The cabinet carries CSS `zoom`, so a rect is in ZOOMED px while the canvas
// draws in its own design px. Divide the delta by rect/offset, never assume
// --stage-zoom (the same trap the r160 Trick fan hit).
function _mapDrawAdd(e) {
  const gridEl = document.getElementById('grid');
  if (!gridEl || !_mapDrawing) return;
  const r = gridEl.getBoundingClientRect();
  const k = (r.width && gridEl.offsetWidth) ? r.width / gridEl.offsetWidth : 1;
  const x = (e.clientX - r.left) / k / gridEl.offsetWidth;
  const y = (e.clientY - r.top)  / k / gridEl.offsetHeight;
  const p = _mapDrawing.p;
  if (p.length >= 2 && Math.abs(p[p.length - 2] - x) < 0.0015
                    && Math.abs(p[p.length - 1] - y) < 0.0015) return;
  p.push(x, y);
}

function mapPenToggle() {
  mapPenOn = !mapPenOn;
  const cv = document.getElementById('map-draw-layer');
  if (cv) {
    cv.classList.toggle('pen-on', mapPenOn);
    cv.style.cursor = mapPenOn ? mapPenCursor(mapPenHex()) : '';
  }
  mapRenderBar();
}
function mapPenCycle() {
  mapPenColor = (mapPenColor + 1) % MAP_PEN_COLORS.length;
  mapPenSyncChrome();
}
function mapPenSyncChrome() {
  const cv = document.getElementById('map-draw-layer');
  if (cv && mapPenOn) cv.style.cursor = mapPenCursor(mapPenHex());
  const dot = document.getElementById('mb-sw-dot');
  if (dot) dot.style.background = mapPenHex();
  const pen = document.getElementById('mb-pen');
  if (pen) pen.style.color = mapPenHex();
}
function mapDrawUndo() { mapDrawStrokes.pop(); mapDrawPaint(); mapRenderBar(); }
function mapDrawClear() { mapDrawStrokes = []; mapDrawPaint(); mapRenderBar(); }

// ── The legend ──────────────────────────────────────────────────────────────
// Only the kinds actually on THIS schedule, in the table's order, so the card
// never explains something that is not on the board. A mystery is listed by
// its FACE, because that is all the player can see.
function mapLegendRows() {
  const seen = new Set();
  for (const t of mapTiles) {
    const face = mapTileFace(t);
    if (!face || !face.cls || face.cls === 'mk-blank') { if (t.kind === 'blank') seen.add('mk-blank'); continue; }
    seen.add(face.cls);
  }
  const rows = [];
  for (const k of Object.keys(MAP_KIND_META)) {
    const m = MAP_KIND_META[k];
    if (!seen.has(m.cls)) continue;
    rows.push({ cls: m.cls, icon: m.icon || '·', name: m.name || m.full, full: m.full, blurb: m.blurb || '' });
  }
  if (seen.has('mk-mystery')) rows.push({ cls: 'mk-mystery', icon: '?', name: '???', full: 'Unconfirmed', blurb: 'You find out when you commit to it.' });
  return rows;
}

// Slay the Spire's move: the named kind stays lit and everything else drops
// back. Written straight onto the live tiles - no render, so it cannot disturb
// a selection or replay the deal-in.
let mapLegendLatch = null;   // a tapped row stays lit; hover alone does not

function mapLegendHighlight(cls, latch) {
  if (latch !== undefined) mapLegendLatch = latch;
  if (mapLegendLatch && latch === undefined) return;   // a latched row owns the board
  if (mapLegendLatch) cls = mapLegendLatch;
  const tiles = document.querySelectorAll('#grid .map-tile');
  tiles.forEach(el => {
    el.classList.remove('mt-lit', 'mt-dim');
    if (!cls) return;
    el.classList.add(el.classList.contains(cls) ? 'mt-lit' : 'mt-dim');
  });
  document.querySelectorAll('#map-legend .ml-row').forEach(r => {
    r.classList.toggle('on', !!cls && r.dataset.cls === cls);
  });
}
