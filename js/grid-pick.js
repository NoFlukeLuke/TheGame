// ══════════════════════════════════════════════════════════════════════════
// GRID PICK (r254, resized r255) - the pick-of-three drawn ON the board.
//
// The pick-of-three used to be a small panel floating over the grid: three
// 116px cards over a board they had nothing to do with. This renders the same
// choice INTO #grid-slot - the reward grid's own room - as tiles MEASURED IN
// GRID CELLS, which fall in like cards.
//
// THE HEIGHT IS IN TILE UNITS, and that is the owner's rule (r255): no more
// than 3 of a 4-row board, 4 of a 5-row board, 4 of a 6-row board. So
// `rowsTall = min(4, rows - 1)` - a pick never covers the whole board, which
// is what makes it read as something dealt ONTO the board rather than as a
// panel that replaced it. Width is the board's width shared between the
// options, because three tall thin slivers is not what a choice looks like.
//
// Layout inside a tile: the OBJECT, then the name and the description directly
// UNDER it with a small gap, and any slack left at the BOTTOM (r255 - they
// used to be pushed to the bottom edge by a growing art box, which read as two
// unrelated blocks).
//
// Three rules, all owner spec:
//  - The OBJECT floats (js/float-anim.js, the reward grid's drift); the NAME
//    and DESCRIPTION do not - a drifting paragraph is unreadable.
//  - The description never grows the tile. It clamps, and a clamped one grows
//    a tappable ellipsis; opening it moves the description ENTIRELY into the
//    chip (the tile's copy is hidden while the chip is up, owner's call
//    between that and continuing the text below the chip).
//  - The choices are spaced and neutral-bordered so they read as three
//    distinct things; rarity colour stays on the object, where it means rarity.
//
// It is a SIBLING overlay of #grid (inside #grid-slot), never tiles inside it:
// render() rebuilds #grid's children wholesale (the r248 crossroads leak is
// what happens to markup left in there), and Survival opens its pick while the
// board underneath is still finishing the goal dance - an overlay covers both
// cases with one mechanism, and #sel-count is the precedent for the slot being
// safe ground.
//
// Two consumers:
//  - openGridPick(opts) owns the whole overlay (guided pick-of-three, the map's
//    hard-round knack pick). Tiles are absolutely placed in cell units.
//  - Survival keeps its own overlay (peek / reroll / shop / contributions are
//    its machinery) but builds each choice with gridPickTileHTML and wires it
//    with gridPickAfterRender, so the choices are the same object. Its row is
//    a flex row given the SAME tile height, because its panel also has to fit
//    a footer.
// ══════════════════════════════════════════════════════════════════════════

// The entity object AND the bare icon (a limit has no object) both drift.
const GRID_PICK_FLOAT_SEL = '.gp-art .reward-cell, .gp-art .gp-icon';

const GP_HEAD_H = 30;      // stage px reserved above the tiles for the title

// How the pick is measured against the live board. Read AFTER
// recomputeGridMetrics, so CARD_W/CARD_H/CARD_GAP are this board's.
function gridPickGeom(n) {
  const rows = Math.max(2, (typeof gridRows === 'number' && gridRows) || 4);
  const cols = Math.max(2, (typeof gridCols === 'number' && gridCols) || 4);
  const cw = (typeof CARD_W === 'number' ? CARD_W : 57);
  const ch = (typeof CARD_H === 'number' ? CARD_H : 75);
  const g  = (typeof CARD_GAP === 'number' ? CARD_GAP : 5);
  const pad = (typeof GRID_PAD === 'number' ? GRID_PAD : 0);
  // Owner's rule: 3 of 4, 4 of 5, 4 of 6 - never the whole board.
  const rowsTall = Math.max(2, Math.min(4, rows - 1));
  const innerW = cols * cw + (cols - 1) * g;
  const innerH = rows * ch + (rows - 1) * g;
  const tileH  = rowsTall * (ch + g) - g;
  const GAP    = g * 2;            // visibly apart, so three choices read as three
  const tileW  = Math.floor((innerW - (n - 1) * GAP) / Math.max(1, n));
  const avail  = innerH - GP_HEAD_H;
  const top    = pad + GP_HEAD_H + Math.max(0, (avail - tileH) / 2);
  return { rows, cols, rowsTall, tileW, tileH, GAP, pad, innerW, innerH, top,
           left: i => pad + i * (tileW + GAP) };
}

// One choice. p: { entity, id, emoji/icon, label, desc, rarity/tier, uses, tag }
function gridPickTileHTML(p, i) {
  const rar = (typeof tierId === 'function') ? tierId(p.rarity || p.tier || 'common') : (p.rarity || 'common');
  const isEnt = p.entity === 'trick' || p.entity === 'sleight' || p.entity === 'knack';
  const art = (isEnt && typeof entityTileHTML === 'function')
    ? entityTileHTML({ entity: p.entity, id: p.id, emoji: p.emoji || p.icon, label: p.label, uses: p.uses }, rar,
                     { extraClass: 'gp-obj' })
    : `<div class="gp-icon">${p.icon || p.emoji || '▲'}</div>`;
  const desc = (typeof colorizeKeywords === 'function') ? colorizeKeywords(p.desc || '') : (p.desc || '');
  return `<div class="gp-opt" data-gp="${i}">`
    + (p.tag ? `<div class="gp-tag rar-${rar}">${p.tag}</div>` : '')
    + `<div class="gp-art" data-float-key="gp-${i}-${p.id || p.label || ''}">${art}</div>`
    + `<div class="gp-name">${p.label || ''}</div>`
    + `<div class="gp-body"><div class="gp-desc">${desc}</div>`
    + `<button class="gp-more" type="button" aria-label="Read the rest">…</button></div>`
    + `</div>`;
}

// THE CHIP (r255). A clamped description is not shortened, it is MOVED: while
// the chip is open the tile's own copy is hidden (visibility, so nothing in the
// tile jumps) and the whole description is read in the bubble. The owner's
// call, over continuing the text below the chip.
function gpOpenRead(opt, payload, anchor, interactive) {
  if (typeof showEntityTooltip !== 'function') return;
  opt.classList.add('gp-reading');
  const restore = () => opt.classList.remove('gp-reading');
  if (interactive) {
    showEntityTooltip(anchor, payload, { actions: [{ label: 'GOT IT', onClick: () => { hideEntityTooltip(true); restore(); } }] });
    // The interactive bubble's backdrop dismisses on pointerdown; a capture
    // listener gets there first, so the tile is restored however it is closed.
    document.addEventListener('pointerdown', restore, { capture: true, once: true });
  } else {
    showEntityTooltip(anchor, payload);
    opt._gpRestore = restore;
  }
}

// Wire a container of .gp-opt tiles: choose on click, clamp detection on the
// descriptions, name fitting, and the float driver. Shared with Survival.
function gridPickAfterRender(root, offers, onChoose) {
  root.querySelectorAll('.gp-opt').forEach(opt => {
    const i = +opt.dataset.gp;
    if (onChoose) opt.addEventListener('click', () => onChoose(i, offers[i]));

    const desc = opt.querySelector('.gp-desc');
    const more = opt.querySelector('.gp-more');
    if (desc && more) {
      // Clamp detection needs a laid-out element - callers invoke this after
      // the overlay is visible (a hidden element measures zero, r239's rule).
      requestAnimationFrame(() => {
        if (desc.scrollHeight <= desc.clientHeight + 1) return;
        opt.classList.add('gp-clipped');
        const p = offers[i] || {};
        const payload = { label: p.label, desc: p.desc, rarity: p.rarity || p.tier,
                          type: p.entity, emoji: p.emoji || p.icon, uses: p.uses };
        // Reading the rest must never cost the pick: the tap stops here.
        more.addEventListener('click', e => { e.stopPropagation(); gpOpenRead(opt, payload, more, true); });
        more.addEventListener('pointerdown', e => e.stopPropagation());
        more.addEventListener('mouseenter', () => gpOpenRead(opt, payload, more, false));
        more.addEventListener('mouseleave', () => {
          if (typeof entityTooltipInteractive === 'function' && entityTooltipInteractive()) return;
          hideEntityTooltip(); opt.classList.remove('gp-reading');
        });
      });
    }
  });
  requestAnimationFrame(() => {
    if (typeof fitRewardName === 'function')
      root.querySelectorAll('.gp-art .rwd-name').forEach(nm => fitRewardName(nm));
  });
  if (typeof startFloat === 'function') startFloat('gridpick', GRID_PICK_FLOAT_SEL);
}

// The crossroads' own deal - a tile falls from above the board and settles.
// Shared with the tiled payout (js/interlude.js), which is the same idea.
function gridTileFallIn(el, { delay = 0, dist = 260 } = {}) {
  if (!el.animate) return null;
  const B = 8, S = 0.10;
  return el.animate([
    { opacity: 0, transform: `translateY(${-dist}px) scaleY(1)` },
    { opacity: 1, transform: `translateY(${-dist}px) scaleY(1)`,        offset: 0.06 },
    { opacity: 1, transform: `translateY(${-dist * 0.45}px) scaleY(0.96)`, offset: 0.55, easing: 'ease-in' },
    { opacity: 1, transform: `translateY(${B}px) scaleY(${1 - S})`,     offset: 0.83 },
    { opacity: 1, transform: `translateY(${-B * 0.7}px) scaleY(${1 + S})`, offset: 0.91 },
    { opacity: 1, transform: `translateY(${B * 0.3}px) scaleY(${1 - S * 0.2})`, offset: 0.96 },
    { opacity: 1, transform: 'translateY(0) scaleY(1)' },
  ], { duration: 420, delay, easing: 'ease-in', fill: 'both' });
}

// opts: { kicker, title, offers, onChoose(i, offer), footerHTML }
function openGridPick(opts) {
  const slot = document.getElementById('grid-slot') || document.body;
  let el = document.getElementById('grid-pick');
  if (!el) { el = document.createElement('div'); el.id = 'grid-pick'; }
  slot.appendChild(el);
  if (typeof recomputeGridMetrics === 'function') { try { recomputeGridMetrics(); } catch (e) {} }

  const offers = opts.offers || [];
  const G = gridPickGeom(Math.max(1, offers.length));
  el.innerHTML =
    `<div class="gp-board">`
    + `<div class="gp-head" style="height:${GP_HEAD_H}px">`
    + (opts.kicker ? `<span class="gp-kicker">${opts.kicker}</span>` : '')
    + `<span class="gp-title">${opts.title || 'TAKE ONE'}</span></div>`
    + `<div class="gp-row"></div>`
    + (opts.footerHTML ? `<div class="gp-foot">${opts.footerHTML}</div>` : '')
    + `</div>`;
  const row = el.querySelector('.gp-row');
  row.innerHTML = offers.map((p, i) => gridPickTileHTML(p, i)).join('');
  // Absolute placement in CELL UNITS - the tiles are board furniture, not a
  // flex row that happens to sit over the board.
  row.querySelectorAll('.gp-opt').forEach((o, i) => {
    o.style.cssText = `position:absolute;left:${G.left(i)}px;top:${G.top}px;width:${G.tileW}px;height:${G.tileH}px;`;
    gridTileFallIn(o, { delay: i * 80, dist: G.top + G.tileH + 40 });
  });
  el.classList.add('show');
  gridPickAfterRender(row, offers, (i, offer) => {
    closeGridPick();
    opts.onChoose && opts.onChoose(i, offer);
  });
  return el;
}

function closeGridPick() {
  const el = document.getElementById('grid-pick');
  if (el) { el.classList.remove('show'); el.innerHTML = ''; }
  if (typeof stopFloat === 'function') stopFloat('gridpick');
  if (typeof clearFloatSeeds === 'function') clearFloatSeeds('gp-');
  if (typeof hideEntityTooltip === 'function') hideEntityTooltip(true);
}

// Survival's pick keeps a flex row (its panel also carries a footer), so it is
// handed the SAME tile height the placed tiles would get - the choice is the
// same size wherever it is offered.
function gridPickSizeFlexRow(rowEl, n) {
  if (!rowEl) return;
  if (typeof recomputeGridMetrics === 'function') { try { recomputeGridMetrics(); } catch (e) {} }
  const G = gridPickGeom(Math.max(1, n));
  rowEl.style.setProperty('--gp-tile-h', G.tileH + 'px');
  rowEl.style.setProperty('--gp-tile-w', G.tileW + 'px');
  rowEl.style.setProperty('--gp-gap', G.GAP + 'px');
}
