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

// ── The card-side highlight: A RING, AND ONLY A RING (r296, cut back r299) ──
// A 2px band of the line's colour around the card's own edge, masked down to the
// border. There is deliberately NO WASH over the card face.
//
// r296 added one, because the per-Trick tints it replaced had been washing the
// face since r209 and covered three of the nine line-marking Tricks - so half
// the marked cells on a board had a highlight and half did not. Dividing the
// face between its lines fixed the crossing; it also spent the card's whole face
// on a fact the ring already states. Owner's call: "the outline is sufficient,
// and that leaves more legibility on the card to put its buffs" - which is
// exactly what r299 then put there (the corner bands, js/deck-grid.js). The ring
// still covers all nine Tricks, which was the real gap.
//
// SEVERAL COLOURS ARE EQUAL WEDGES WITH HARD STOPS, NEVER A BLEND. A card on a
// marked row and a marked column reads HALF AND HALF; one on three lines reads
// in thirds, and so on for as many as cover it. A blend is a colour that belongs
// to nothing - which is what the card had before r296: the old tints painted
// Right Place (blue) crossing Power Line (red) as a flat PURPLE card.
//
// Near-white needs no correction here, and that is the reason the wash was the
// expensive half. Echo Location's #e0ddd0 was invisible as a face tint over a
// cream card at any alpha (measured: rgb(240,231,212) over rgb(244,234,213)) and
// had to be darkened to register. On the card's EDGE, against the dark board, it
// is the most legible of the nine - so the ring takes every colour exactly as
// the table gives it and the whole luminance correction goes with the wash.
function lineRingPaint(metas) {
  if (!metas.length) return '';
  if (metas.length === 1) return metas[0].color;
  const n = metas.length, step = 100 / n;
  const stops = metas.map((m, i) => `${m.color} ${(i * step).toFixed(3)}% ${((i + 1) * step).toFixed(3)}%`);
  // `from -45deg` so TWO colours split on the card's own diagonal - one straight
  // line corner to corner - rather than on the vertical, which reads as a seam.
  return `conic-gradient(from -45deg, ${stops.join(', ')})`;
}

// From an already-resolved meta list. renderCardAppearance works out the list
// once and builds the ring from it; the (r, c) form below is for any caller that
// has a cell and not a list. Built here rather than in renderCardAppearance so
// the reward grid and any future surface can draw the same ring by asking one
// function.
function lineRingHTMLFor(metas) {
  if (!metas.length) return '';
  const title = metas.map(m => m.name).join(' · ');
  return `<div class="rc-line-ring" style="--rcl-ring:${lineRingPaint(metas)}" title="${title}"></div>`;
}
function lineRingHTML(r, c) { return lineRingHTMLFor(lineMetasForCell(r, c)); }
