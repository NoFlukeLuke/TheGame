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
// wipes #grid) and a save - but NOT an orientation flip, which transposes the
// board under them (r293, below).
//
// The legend answers the other question and highlights as you read it, the way
// Slay the Spire's does: hover a row and only those obligations stay lit. It is
// a RAIL BESIDE THE BOARD since r293, not a card over it - see mapLegendPlace.

const MAP_PEN_COLORS = ['#f5c042', '#8fd0ff', '#6fd08c', '#ff7a7a', '#ffffff'];
const MAP_PEN_WIDTH = 2.4;

let mapDrawStrokes = [];   // [{ c: colorIndex, o: 'l'|'p', p: [x,y,...] } ] - x/y are 0..1
let mapPenColor = 0;
let mapPenOn = false;      // finger mode: the layer takes every tap

// ── INK BELONGS TO THE ORIENTATION IT WAS DRAWN IN (r293) ────────────────────
// A stroke is normalised to the GRID BOX, which is what carries it through a
// mapRender and a save. It does NOT carry it through an orientation flip: the
// schedule TRANSPOSES there (4 lanes x 7 slots becomes 7 x 4), so a circle round
// slot 2 comes back as a smear across three unrelated obligations. Owner: "if
// you switch between portrait and landscape modes don't carry the drawing over,
// let it just apply to its orientation when it was drawn."
//
// So each stroke is stamped with the orientation it was laid down in and every
// reader filters - paint, undo, clear, and the bar's "is there ink" test, which
// is what decides whether the undo and wipe chips are offered at all. Flipping
// back brings that orientation's ink back with it; it is set aside, not dropped.
//
// A stroke saved before this carries no stamp and is shown in BOTH, because
// nothing records which way the board read when it was drawn and guessing would
// be worse than the one-time carry-over it predates.
function mapInkOrient() { return mapLandscape ? 'l' : 'p'; }
function mapInkHere(s) { return !s.o || s.o === mapInkOrient(); }
function mapInkStrokes() { return mapDrawStrokes.filter(mapInkHere); }
function mapHasInk() { return mapDrawStrokes.some(mapInkHere); }

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
  const here = mapInkStrokes();
  const all = _mapDrawing ? here.concat([_mapDrawing]) : here;
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
        const last = mapInkStrokes().pop();
        if (last && last.p.length <= 2) mapDrawStrokes.splice(mapDrawStrokes.indexOf(last), 1);
        _mapDrawing = null;
        mapPenColor = (mapPenColor + 1) % MAP_PEN_COLORS.length;
        mapDrawPaint(); mapPenSyncChrome();
        try { sfxCardSelect?.(); } catch (err) {}
        return;
      }
    }
    _mapDrawing = { c: mapPenColor, o: mapInkOrient(), p: [] };
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
// Undo and clear act on THIS orientation's ink only - the other one's is set
// aside, not on screen, and taking it back would be undoing something invisible.
function mapDrawUndo() {
  const last = mapInkStrokes().pop();
  if (last) mapDrawStrokes.splice(mapDrawStrokes.indexOf(last), 1);
  mapDrawPaint(); mapRenderBar();
}
function mapDrawClear() {
  mapDrawStrokes = mapDrawStrokes.filter(s => !mapInkHere(s));
  mapDrawPaint(); mapRenderBar();
}

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

// ── THE LEGEND IS A RAIL BESIDE THE BOARD (r293) ─────────────────────────────
// It used to be a .mb-help card above the map bar, and there it did the one
// thing a legend must not: at 396 x 303 on a phone it LAY OVER THE WHOLE BOARD,
// so hovering a row lit up obligations nobody could see. Owner: "the legend was
// just too little down there."
//
// It is now a tall panel in the empty strip to the RIGHT of the schedule - the
// area the owner circled - so the list and the board it is describing are on
// screen together. That strip is the same shape in both orientations, which is
// why one rail covers both: measured at 1440x820 it is 142 x 494, at 1100x620
// 105 x 377, and on a 420-wide phone 116 x 426.
//
// THE ROW IS THE SYMBOL AND THE WORD, AND THE BLURB GOES TO THE BAR. r276's
// rule for the board is "just use the symbols, with the legend showing the
// symbol and word", and a 105px rail has no room for a sentence anyway - nine
// rows of wrapped prose measured over 700px tall against a 377px board. The
// blurb lands in #mb-info instead, which is already the bar's "what is this"
// readout, is as wide as the bar, and is empty whenever nothing is picked.
//
// Body-level and placed in RAW VIEWPORT PX, the same rule #map-bar and the
// tooltips follow: anything inside #cabinet inherits its CSS zoom and would
// have those coordinates multiplied.
const MAP_LEGEND_MIN_W = 88;   // below this the strip cannot hold a row

function mapLegendEl() { return document.getElementById('map-legend'); }
function mapLegendOpen() { return !!mapLegendEl()?.classList.contains('show'); }

function mapLegendToggle() {
  if (mapLegendOpen()) return mapLegendClose();
  mapLegendBuild();
  mapLegendEl()?.classList.add('show');
  mapLegendPlace();
  mapRenderBar();          // the chip lights while the rail is up
  // Armed only while it IS open - a standing document listener on something
  // rebuilt this often stacks one copy per build (the bar's own rule).
  setTimeout(() => document.addEventListener('click', function off(ev) {
    const el = mapLegendEl();
    if (!el || !el.classList.contains('show')) { document.removeEventListener('click', off); return; }
    if (el.contains(ev.target) || document.getElementById('map-bar')?.contains(ev.target)) return;
    mapLegendClose();
    document.removeEventListener('click', off);
  }), 0);
}
function mapLegendClose() {
  mapLegendEl()?.classList.remove('show');
  mapLegendHighlight(null, null);
  mapLegendBlurb(null);
  mapRenderBar();
}

function mapLegendBuild() {
  let el = mapLegendEl();
  if (!el) { el = document.createElement('div'); el.id = 'map-legend'; document.body.appendChild(el); }
  const rows = (typeof mapLegendRows === 'function') ? mapLegendRows() : [];
  el.innerHTML =
    `<div class="ml-head"><span>LEGEND</span>` +
      `<button class="ml-x" id="ml-close" title="Close">&#10005;</button></div>` +
    `<div class="ml-list">` +
      rows.map(r =>
        `<div class="ml-row ${r.cls}" data-cls="${r.cls}" title="${r.full || r.name}">` +
          `<span class="ml-chip">${r.icon || '&nbsp;'}</span>` +
          `<b>${r.name || r.full}</b>` +
        `</div>`).join('') +
    `</div>`;
  el.querySelector('#ml-close').onclick = (e) => { e.stopPropagation(); mapLegendClose(); };
  el.querySelectorAll('.ml-row').forEach(row => {
    const cls = row.dataset.cls;
    const meta = rows.find(r => r.cls === cls);
    row.onmouseenter = () => { mapLegendHighlight(cls); if (!mapLegendLatch) mapLegendBlurb(meta); };
    row.onmouseleave = () => { mapLegendHighlight(null); if (!mapLegendLatch) mapLegendBlurb(null); };
    row.onclick = (e) => {
      e.stopPropagation();
      const next = (mapLegendLatch === cls) ? null : cls;   // tap again to release
      mapLegendHighlight(next, next);
      mapLegendBlurb(next ? meta : null);
    };
  });
}

// The row's sentence, in the bar's own info line. Clearing it hands the line
// back to whatever the player has picked, which is what mapRenderBar restores.
function mapLegendBlurb(meta) {
  const el = document.getElementById('mb-info');
  if (!el) return;
  if (meta) {
    el.innerHTML = `<b>${meta.full || meta.name}</b> ${meta.blurb || ''}`;
    return;
  }
  el.innerHTML = '';
  if (mapSelected) {
    const t = mapTiles.find(x => x.id === mapSelected);
    if (t) mapBarInfo(t, mapMoveFor(mapSelected));
  }
}

// Dock it in the strip beside the board, top-aligned with the board and no
// taller than it. A strip too narrow to hold a row falls back to a centred card
// over the board - worse, but never nothing.
function mapLegendPlace() {
  const el = mapLegendEl();
  if (!el || !el.classList.contains('show')) return;
  const g = document.getElementById('grid')?.getBoundingClientRect();
  if (!g || !g.width) return;
  const stage = document.getElementById('stage')?.getBoundingClientRect();
  const gap = 8;
  const right = Math.min(stage ? stage.right : window.innerWidth, window.innerWidth) - gap;
  const w = right - (g.right + gap);
  if (w >= MAP_LEGEND_MIN_W) {
    el.classList.remove('ml-float');
    el.style.left = Math.round(g.right + gap) + 'px';
    el.style.width = Math.round(w) + 'px';
    el.style.top = Math.round(g.top) + 'px';
    el.style.maxHeight = Math.round(Math.min(g.height, window.innerHeight - g.top - gap)) + 'px';
  } else {
    el.classList.add('ml-float');
    el.style.left = el.style.width = el.style.top = '';
    el.style.maxHeight = Math.round(g.height) + 'px';
  }
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

// The board moved (a render, a resize, an orientation flip), so the rail beside
// it has to move with it.
function mapLegendReplace() {
  if (typeof mapLegendPlace === 'function') mapLegendPlace();
}

// A plain resize moves the board without redrawing it - map-mode.js only
// re-renders when the ORIENTATION changes - so the rail needs its own listener
// or it stays where the old board was.
window.addEventListener('resize', () => {
  if (typeof mapScreenOpen !== 'undefined' && mapScreenOpen) setTimeout(mapLegendReplace, 0);
});
