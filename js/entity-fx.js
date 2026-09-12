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

function renderLineMarkers() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  gridEl.querySelectorAll('.rc-line').forEach(el => el.remove());
  if (typeof rowColBonuses === 'undefined' || !rowColBonuses.length) return;
  // A line marks a LINE OF CARDS, so with nothing on the board there is nothing
  // to mark - lines hanging in an empty well read as a glitch. The test is the
  // DOM, not gridData, because those two disagree exactly when it matters: the
  // interlude animates the cards off the board while gridData still holds them.
  // This is why the call sits at the END of render() - run before the card loop,
  // the DOM it is asking about would be a render behind. It does NOT cover the
  // interlude itself, which removes the cards without rendering again; that
  // teardown calls clearLineMarkers directly (js/interlude.js).
  if (!gridEl.querySelector('[data-card-id]')) return;

  // Group by line so co-located marks can share the width.
  const byLine = new Map();
  rowColBonuses.forEach(b => {
    const k = `${b.axis}-${b.index}`;
    if (!byLine.has(k)) byLine.set(k, []);
    byLine.get(k).push(b);
  });

  byLine.forEach((entries, key) => {
    const axis = entries[0].axis, index = entries[0].index;
    const n = entries.length;
    entries.forEach((b, i) => {
      const meta = lineFXMeta(b.id);
      const el = document.createElement('div');
      el.className = 'rc-line rc-line-' + (axis === 'row' ? 'row' : 'col');
      el.dataset.lineKey = key + ':' + b.id;
      el.style.setProperty('--rcl', meta.color);
      if (axis === 'row') {
        const band = CARD_H / n;
        el.style.left   = cellLeft(0) + 'px';
        el.style.top    = (cellTop(index) + band * i + band / 2) + 'px';
        el.style.width  = (cellLeft(gridCols - 1) + CARD_W - cellLeft(0)) + 'px';
      } else {
        const band = CARD_W / n;
        el.style.left   = (cellLeft(index) + band * i + band / 2) + 'px';
        el.style.top    = cellTop(0) + 'px';
        el.style.height = (cellTop(gridRows - 1) + CARD_H - cellTop(0)) + 'px';
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

// Does any line-marking Trick cover this cell? Used for the shared "this card
// is on a marked line" ring, which is what gives the 6 position Tricks that
// never had a card indicator one for free.
function cellOnMarkedLine(r, c) {
  if (typeof rowColBonuses === 'undefined') return null;
  const hit = rowColBonuses.find(b => (b.axis === 'row' && b.index === r) || (b.axis === 'col' && b.index === c));
  return hit ? lineFXMeta(hit.id) : null;
}
