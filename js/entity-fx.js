// ══════════════════════════════════════════════
// ENTITY FX - "what affected what"  (r209)
// ══════════════════════════════════════════════
// One system for the question a player asks constantly and the board never
// answered: WHY is this card different? Two surfaces, one vocabulary.
//
//   1. A marked ROW or COLUMN gets a coloured LINE drawn down the board behind
//      the cards (renderLineMarkers). It animates in when the Trick is acquired
//      and then simply stays there for as long as the Trick is owned.
//   2. A card singled out by a specific Trick gets a small corner MARK in that
//      Trick's colour (cardMarkHTML), so "something is buffed here" reads at a
//      glance and the glyph says which Trick did it.
//
// Before this, 3 of the 9 position Tricks tinted their cards and the other 6
// (Perfect Timing, Right Time, Study Hall, Groove, Assembly Line, Overtime) had
// no indicator at all - the line they marked was a number in a tooltip. The per
// card Tricks each had their own ad-hoc background wash and no way to tell them
// apart. Both are now driven from ONE table.
//
// The table is the extension seam: a new position Trick needs a row in
// LINE_FX_META, a new per-card Trick a row in CARD_MARK_META, and nothing else.

// Colour + glyph per line-marking Trick. The colour is what makes two lines on
// one board distinguishable; the glyph is printed on the line's end cap.
const LINE_FX_META = {
  rowcol_triple_pips: { color: '#3a6fca', glyph: '◆', name: 'Right Place' },
  rowcol_mult:        { color: '#c0392b', glyph: '✕', name: 'Power Line' },
  rowcol_retrigger:   { color: '#e0ddd0', glyph: '↻', name: 'Echo Location' },
  perfect_timing:     { color: '#d9a129', glyph: '↻', name: 'Perfect Timing' },
  right_time:         { color: '#5aa9e6', glyph: '⏸', name: 'Right Time' },
  study_hall:         { color: '#8a5cf0', glyph: '◉', name: 'Study Hall' },
  groove:             { color: '#c86bd8', glyph: '♪', name: 'Groove' },
  assembly_line:      { color: '#3aa76d', glyph: '▲', name: 'Assembly Line' },
  overtime:           { color: '#e07c3a', glyph: '⏮', name: 'Overtime' },
};
function lineFXMeta(id) { return LINE_FX_META[id] || { color: '#c9a84c', glyph: '●', name: id }; }

// Per-card marks: a Trick that has singled out one cell. `covers(r,c)` is a
// predicate rather than a single position because two of these are DERIVED - Ley
// Line and Temporal Rift both fire wherever a row effect crosses a column
// effect, which is a set of cells, not one. `leyLinePos` (js/deck-grid.js) was
// the old single-cell answer and is never assigned by anything, so the
// `.card.rc-leyline` tint it drove had been dead since it was written.
const CARD_MARK_META = {
  // FIRST on purpose: cardMarkHTML returns the first hit, and a mark the player
  // has to spend before the card leaves the board outranks a standing one.
  hallmark:           { color: '#d9a129', glyph: '\ud83d\udd16', name: 'Hallmark',
    covers: (r, c) => typeof hallmarkCardId !== 'undefined' && hallmarkCardId
                      && gridData[r]?.[c] && gridData[r][c].rank
                      && cardId(gridData[r][c]) === hallmarkCardId },
  rowcol_perm_double: { color: '#f0c040', glyph: '\u2726', name: 'Ley Line',
    covers: (r, c) => hasTrick('rowcol_perm_double') && isEffectIntersection(r, c) },
  temporal_rift:      { color: '#7ec8e3', glyph: '\u23f8', name: 'Temporal Rift',
    covers: (r, c) => hasTrick('temporal_rift') && isEffectIntersection(r, c) },
  double_jeopardy:    { color: '#c83c3c', glyph: '\u203c', name: 'Double Jeopardy',
    covers: (r, c) => typeof doubleJeopardyPos !== 'undefined' && doubleJeopardyPos
                      && doubleJeopardyPos.r === r && doubleJeopardyPos.c === c },
  woodpecker:         { color: '#5aaa5a', glyph: '\u26cf', name: 'The Woodpecker',
    covers: (r, c) => typeof woodpeckerPos !== 'undefined' && woodpeckerPos
                      && woodpeckerPos.r === r && woodpeckerPos.c === c },
  // Heartwood's cell is Math.floor(rows/2) x Math.floor(cols/2) - the same
  // expression play-hand.js uses, so the mark can never point at a different
  // cell from the one that actually gets the buff.
  heartwood:          { color: '#b8823a', glyph: '\u2764', name: 'Heartwood',
    covers: (r, c) => hasTrick('heartwood')
                      && r === Math.floor(gridRows / 2) && c === Math.floor(gridCols / 2) },
};

// ── The line markers ────────────────────────────────────────────────────────
// Absolutely-positioned siblings of the cards, the same shape renderBlockedCells
// and renderBossCellOverlays use, so nothing about a card element changes. They
// carry z-index 1 against the cards' 2 (css/entity-fx.css) - DOM order would not
// be enough, because render() appends new cards after these.
//
// Several Tricks may mark the SAME line (the District knack allows it). Their
// lines are drawn side by side across the card's width rather than on top of
// each other, so a doubled line still reads as two things.
// Teardown on its own, so the screens that take the #grid away from the play
// board (the reward grid, a dominoes board) can drop the lines without the draw
// path having to know about them. Called from the top of render().
function clearLineMarkers() {
  const gridEl = document.getElementById('grid');
  if (gridEl) gridEl.querySelectorAll('.rc-line').forEach(el => el.remove());
}

// The board a line is being drawn onto. The play grid is the default; the reward
// grid passes its own, because it can be a DIFFERENT SIZE from the play board -
// a prize grid is two rows and columns smaller - and it is centred with an
// offset rather than anchored at the board's top-left corner.
function lineGridGeom(opts) {
  return {
    rows: opts && opts.rows != null ? opts.rows : gridRows,
    cols: opts && opts.cols != null ? opts.cols : gridCols,
    offX: (opts && opts.offX) || 0,
    offY: (opts && opts.offY) || 0,
  };
}

function renderLineMarkers(opts) {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  gridEl.querySelectorAll('.rc-line').forEach(el => el.remove());
  if (typeof rowColBonuses === 'undefined' || !rowColBonuses.length) return;
  const GEO = lineGridGeom(opts);
  // A line marks a LINE OF CARDS, so with nothing on the board there is nothing
  // to mark - lines hanging in an empty well read as a glitch. The test is the
  // DOM, not gridData, because those two disagree exactly when it matters: the
  // interlude animates the cards off the board while gridData still holds them.
  // This is why the call sits at the END of render() - run before the card loop,
  // the DOM it is asking about would be a render behind. It does NOT cover the
  // interlude itself, which removes the cards without rendering again; that
  // teardown calls clearLineMarkers directly (js/interlude.js).
  // A reward tile is not a card and carries no data-card-id, but it IS a filled
  // board - the lines stay put while you pick your rewards on top of them.
  if (!gridEl.querySelector('[data-card-id], .reward-cell')) return;

  // Group by line so co-located marks can share the width. The index is CLAMPED
  // to the board being drawn, not to the stored one: a line on column 5 of a
  // 6-wide play board has nowhere to sit on a 4-wide prize grid, so it is shown
  // on the highest column that exists. This is a DISPLAY clamp only - it never
  // writes back to rowColBonuses, or a visit to a smaller grid would
  // permanently move a line the play board still has room for. The stored index
  // is clamped separately, and only by a real limits change
  // (clampRowColBonuses, js/scoring.js).
  const byLine = new Map();
  rowColBonuses.forEach(b => {
    const span = b.axis === 'row' ? GEO.rows : GEO.cols;
    const idx  = Math.max(0, Math.min(b.index, span - 1));
    const k = `${b.axis}-${idx}`;
    if (!byLine.has(k)) byLine.set(k, []);
    byLine.get(k).push({ b, idx });
  });

  byLine.forEach((entries, key) => {
    const axis = entries[0].b.axis, index = entries[0].idx;
    const n = entries.length;
    entries.forEach(({ b }, i) => {
      const meta = lineFXMeta(b.id);
      const el = document.createElement('div');
      el.className = 'rc-line rc-line-' + (axis === 'row' ? 'row' : 'col');
      el.dataset.lineKey = key + ':' + b.id;
      el.style.setProperty('--rcl', meta.color);
      // N lines on one row or column are spaced EVENLY ACROSS THE CARD at
      // (i+1)/(n+1) of its width: one line down the middle, two at a third and
      // two thirds, three at a quarter, a half and three quarters. Dividing the
      // card into n bands and centring in each (the first version) puts two
      // lines at 25% and 75% and three at 17/50/83, which reads as lines
      // hugging the card's edges rather than as an evenly divided lane.
      const frac = (i + 1) / (n + 1);
      if (axis === 'row') {
        el.style.left   = (cellLeft(0) + GEO.offX) + 'px';
        el.style.top    = (cellTop(index) + GEO.offY + CARD_H * frac) + 'px';
        el.style.width  = (cellLeft(GEO.cols - 1) + CARD_W - cellLeft(0)) + 'px';
      } else {
        el.style.left   = (cellLeft(index) + GEO.offX + CARD_W * frac) + 'px';
        el.style.top    = (cellTop(0) + GEO.offY) + 'px';
        el.style.height = (cellTop(GEO.rows - 1) + CARD_H - cellTop(0)) + 'px';
      }
      el.innerHTML = `<span class="rc-line-cap">${meta.glyph}</span><span class="rc-line-cap rc-line-cap2">${meta.glyph}</span>`;
      el.title = `${meta.name} · ${axis === 'row' ? 'row' : 'column'} ${index + 1}`;
      // A line the player has not seen yet sweeps in once. _rcSeen is on the
      // registry entry, so a re-render (which happens on every card fall) does
      // not replay the animation.
      if (!b._rcSeen) { el.classList.add('rc-line-in'); b._rcSeen = true; }
      gridEl.appendChild(el);
    });
  });
}

// Called from finalizePositionMark the moment a position Trick is acquired: a
// pulse runs the length of the line it just claimed, so the grant is visibly
// connected to the line rather than being a silent registry write. The line
// itself is what stays; this is only the arrival.
function animateLineGrant(trick) {
  if (typeof trick !== 'object' || trick._posAxis == null) return;
  // The board may not be up (a Trick bought in the Mart, a reward grid still on
  // the #grid). renderLineMarkers runs from render() either way, so the line
  // appears with its sweep the first time the board is next drawn.
  renderLineMarkers();
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  const el = gridEl.querySelector(`.rc-line[data-line-key="${trick._posAxis}-${trick._posIndex}:${trick.id}"]`);
  if (!el) return;
  el.classList.remove('rc-line-in');
  void el.offsetWidth;                    // restart the sweep
  el.classList.add('rc-line-in', 'rc-line-grant');
  setTimeout(() => el.classList.remove('rc-line-grant'), 1400);
}

// ── The per-card mark ───────────────────────────────────────────────────────
// Returns the corner mark for whatever Trick owns this cell, or ''. One mark at
// a time by design: two glyphs in one corner of a 57px card is noise, and the
// tooltip lists the rest.
function cardMarkHTML(r, c) {
  for (const id in CARD_MARK_META) {
    const m = CARD_MARK_META[id];
    let hit = false;
    try { hit = !!m.covers(r, c); } catch (e) { hit = false; }
    if (hit) return `<div class="card-fx-mark" style="--cfm:${m.color}" title="${m.name}">${m.glyph}</div>`;
  }
  return '';
}

// EVERY line-marking Trick covering this cell, in registry order. A card can sit
// on several at once - trivially at a row/column crossing, and the District
// knack allows more than one Trick on a single line - so this returns a list
// rather than the first hit. The ring below is what divides between them.
function lineMetasForCell(r, c) {
  if (typeof rowColBonuses === 'undefined') return [];
  const out = [], seen = new Set();
  rowColBonuses.forEach(b => {
    if (!((b.axis === 'row' && b.index === r) || (b.axis === 'col' && b.index === c))) return;
    // Two Tricks of the same id cannot mark two lines through one cell in any
    // way that a second identical wedge would communicate - dedupe by colour so
    // a doubled colour never eats half the ring for nothing.
    const meta = lineFXMeta(b.id);
    if (seen.has(meta.color)) return;
    seen.add(meta.color);
    out.push(meta);
  });
  return out;
}

// Kept as the single-answer form: the first line covering a cell. Nothing in the
// game reads it now that the ring takes the whole list, but it is the obvious
// question to ask and re-deriving it wrong is easy.
function cellOnMarkedLine(r, c) {
  const m = lineMetasForCell(r, c);
  return m.length ? m[0] : null;
}

// ── The card-side highlight ────────────────────────────────────────────────
// ONE geometry, two strengths. The WASH is the card face tinted in the line's
// colour; the RING is the same paint solid, masked down to the border. They are
// built from the same conic on purpose - the ring's blue half has to sit over
// the wash's blue half, or a crossing reads as two unrelated decorations.
//
// SEVERAL COLOURS ARE EQUAL WEDGES WITH HARD STOPS, NEVER A BLEND (r296). A card
// on a marked row and a marked column reads HALF AND HALF; one on three lines
// reads in thirds, and so on for as many as cover it. A blend is a colour that
// belongs to nothing - which is exactly what the card had before this: the
// pre-r296 per-Trick tints in css/style.css painted Right Place (blue) crossing
// Power Line (red) as a flat PURPLE card, and Power Line crossing Echo Location
// as a dark red-brown one. Those tints are gone; this is what replaced them.
//
// They also covered THREE of the nine line-marking Tricks. Perfect Timing, Right
// Time, Groove, Assembly Line and Overtime tinted nothing at all, so half the
// marked cells on a board had a highlight and half did not. This is driven off
// lineMetasForCell, so every line-marking Trick gets the same treatment for free
// - which is what r209 set out to do and only did for the ring.
const LINE_WASH_ALPHA = 22;      // % of the line's colour, laid over the card face

// A LIGHT LINE COLOUR HAS NOTHING TO SAY ON A CARD FACE, and one of the nine is
// light: Echo Location's #e0ddd0 is near-white, so at any alpha at all its wash
// lands within a couple of points of the cream card it is tinting (measured:
// rgb(240,231,212) over a face of rgb(244,234,213) - invisible). The LINE, its
// end caps and the RING keep the colour exactly as the table gives it - they sit
// on the dark board or on the card's own edge, which is where near-white reads
// best of all - and only the WASH darkens one that is too light to register.
// Same idea as _ptLighten deriving the score particle's border from its plate.
//
// Perceived luminance is LINEAR in the channels, so mixing k% of the colour with
// black scales it by exactly k - which is what makes "bring it down to
// LINE_WASH_TARGET_L" one multiplication rather than a search. Only a colour
// above LINE_WASH_MAX_L is touched at all; the other eight are left alone
// (gold, the lightest of them, measures 0.64).
const LINE_WASH_MAX_L    = 0.72;   // a wash colour lighter than this is darkened
const LINE_WASH_TARGET_L = 0.55;   // ...down to this
function lineColorLuma(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return 0;                                  // not a hex colour: leave it alone
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
function lineWashInk(hex, pct) {
  const L = lineColorLuma(hex);
  const base = (L > LINE_WASH_MAX_L)
    ? `color-mix(in srgb, ${hex} ${(100 * LINE_WASH_TARGET_L / L).toFixed(1)}%, #000)`
    : hex;
  return `color-mix(in srgb, ${base} ${pct}%, transparent)`;
}

// pct null = solid (the ring). A number = that much of the colour over whatever
// is behind it (the wash).
function lineWedgePaint(metas, pct) {
  if (!metas.length) return '';
  const ink = m => (pct == null ? m.color : lineWashInk(m.color, pct));
  if (metas.length === 1) return ink(metas[0]);
  const n = metas.length, step = 100 / n;
  const stops = metas.map((m, i) => `${ink(m)} ${(i * step).toFixed(3)}% ${((i + 1) * step).toFixed(3)}%`);
  // `from -45deg` so TWO colours split on the card's own diagonal - one straight
  // line corner to corner - rather than on the vertical, which reads as a seam.
  return `conic-gradient(from -45deg, ${stops.join(', ')})`;
}
function lineRingPaint(metas) { return lineWedgePaint(metas, null); }
function lineWashPaint(metas) { return lineWedgePaint(metas, LINE_WASH_ALPHA); }

// The two elements, from an already-resolved meta list. renderCardAppearance
// works out the list once and builds both from it; the (r, c) forms below are
// for any caller that has a cell and not a list.
// Built here rather than in renderCardAppearance so the reward grid and any
// future surface can draw the same highlight by asking one function.
function lineRingHTMLFor(metas) {
  if (!metas.length) return '';
  const title = metas.map(m => m.name).join(' \u00b7 ');
  return `<div class="rc-line-ring" style="--rcl-ring:${lineRingPaint(metas)}" title="${title}"></div>`;
}
function lineWashHTMLFor(metas) {
  if (!metas.length) return '';
  return `<div class="rc-line-wash" style="--rcl-wash:${lineWashPaint(metas)}"></div>`;
}
function lineRingHTML(r, c) { return lineRingHTMLFor(lineMetasForCell(r, c)); }
function lineWashHTML(r, c) { return lineWashHTMLFor(lineMetasForCell(r, c)); }
