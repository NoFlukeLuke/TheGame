// ══════════════════════════════════════════════════════════════════════════
// GRID PICK (r254, rebuilt r256) - the pick-of-three IS the board.
//
// The first two passes drew a panel OVER the grid. This one INHABITS it, the
// way the shop and the crossroads do: the board is re-laid for the screen, the
// real cards are cleared, and every cell is either an option tile or an inert
// black ambience card. There is no backdrop and nothing outside the grid's
// footprint, because there is nothing to put one behind - the tiles ARE what
// is on the board.
//
// THE LAYOUT (owner spec, r256) - a 6 x 5 board:
//
//     row 0 : 6 ambience cards
//     rows 1-3 : three options, each 2 CELLS WIDE x 3 CELLS TALL
//     row 4 : action tiles (Survival's reroll / peek / breakdown / shop),
//             then ambience cards for whatever is left
//
// That closes exactly: 3 x (2x3) = 18 cells, plus 6 above and 6 below = 30.
//
// The title is NOT on the board - every cell is spoken for. It goes in the HUD
// through enterGridScreenHud, the same readout the shop and the crossroads use.
//
// Three rules carried forward:
//  - The OBJECT floats (js/float-anim.js, the reward grid's drift); the NAME
//    and DESCRIPTION do not - a drifting paragraph is unreadable.
//  - The description never grows the tile. It clamps, and a clamped one grows
//    a tappable ellipsis; opening it moves the description ENTIRELY into the
//    chip (the tile's copy is hidden while the chip is up, owner's call
//    between that and continuing the text below the chip).
//  - The choices are neutral-bordered; rarity colour stays on the object,
//    where it means rarity.
//
// TILES LIVE IN #grid AND MUST BE REMOVED BY HAND. render() only reconciles
// elements carrying [data-card-id], so anything else left in there is never
// cleaned up - that is the r248 crossroads leak, and closeGridPick is what
// stops this repeating it.
// ══════════════════════════════════════════════════════════════════════════

// The entity object AND the bare icon (a limit has no object) both drift.
const GRID_PICK_FLOAT_SEL = '.gp-art .reward-cell, .gp-art .gp-icon';

const GP_COLS = 6, GP_ROWS = 5;   // the board this screen asks for
const GP_OPT_W = 2, GP_OPT_H = 3; // each option, in cells
const GP_OPT_ROW = 1;             // options sit under the top ambience row

let gridScreenSaved = null;       // { rows, cols } to restore on close
let gridPickState = null;         // { offers, actions, onChoose } for a re-render

// ── THE BOARD TAKEOVER, shared by every screen that IS the board ────────────
// The shop's borrow (openShopGrid), generalised: save the player's board size,
// re-lay the grid at whatever size this screen wants, and clear the real cards
// so nothing shows between the tiles. Used by the pick-of-three here and by the
// tiled payout in js/interlude.js.
//
// NOTHING PUT IN #grid IS CLEANED UP FOR YOU. render() only reconciles elements
// carrying [data-card-id], so a screen's tiles must be removed by hand - that is
// the r248 crossroads leak, and gridScreenRelease is what stops it repeating.
function gridScreenTakeover(rows, cols) {
  // The x/y selection readout means nothing on a board screen (there is no hand
  // being built) and it sits in the slot margin right beside the grid. Hidden
  // for the length of any takeover. The SHOP is untouched by this - it does not
  // come through here, because it repurposes that readout for its own count.
  document.body.classList.add('gp-active');
  if (!gridScreenSaved) gridScreenSaved = { rows: gridRows, cols: gridCols };
  gridRows = rows; gridCols = cols;
  if (typeof recomputeGridMetrics === 'function') recomputeGridMetrics();
  const gridEl = document.getElementById('grid');
  if (gridEl) gridEl.innerHTML = '';
  return gridEl;
}

function gridScreenRelease() {
  document.body.classList.remove('gp-active');
  const gridEl = document.getElementById('grid');
  if (gridEl) gridEl.querySelectorAll('.gp-opt, .gp-amb, .gp-act, #payout-overlay').forEach(el => el.remove());
  if (gridScreenSaved) { gridRows = gridScreenSaved.rows; gridCols = gridScreenSaved.cols; gridScreenSaved = null; }
  if (typeof recomputeGridMetrics === 'function') recomputeGridMetrics();
}

function gridPickTakeover() { return gridScreenTakeover(GP_ROWS, GP_COLS); }
function gridPickRelease()  { gridScreenRelease(); }

// A cell box in the live board's own units. Shared with the tiled payout:
// every screen that inhabits the board places its tiles through this.
function gpBox(r, c, w, h) {
  const cw = (typeof CARD_W === 'number' ? CARD_W : 57);
  const ch = (typeof CARD_H === 'number' ? CARD_H : 75);
  const g  = (typeof CARD_GAP === 'number' ? CARD_GAP : 5);
  return `left:${cellLeft(c)}px;top:${cellTop(r)}px;`
       + `width:${w * cw + (w - 1) * g}px;height:${h * ch + (h - 1) * g}px;`;
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
  // The art box is given the OBJECT'S OWN ASPECT (gp-art-<kind>), so the object
  // fills it instead of letterboxing inside a taller box - that slack was the
  // big gap between the icon and the name the owner called out.
  const kind = isEnt ? p.entity : 'plain';
  return `<div class="gp-opt gp-art-${kind}" data-gp="${i}">`
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
  }
}

// Wire a container of .gp-opt tiles: choose on click, clamp detection on the
// descriptions, name fitting, and the float driver.
function gridPickAfterRender(root, offers, onChoose) {
  root.querySelectorAll('.gp-opt').forEach(opt => {
    const i = +opt.dataset.gp;
    if (onChoose) opt.addEventListener('click', () => onChoose(i, offers[i]));

    const desc = opt.querySelector('.gp-desc');
    const more = opt.querySelector('.gp-more');
    if (desc && more) {
      // Clamp detection needs a laid-out element - callers invoke this after
      // the tiles are on the board (a hidden element measures zero, r239).
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

// Draw (or redraw) the taken-over board from gridPickState.
function gridPickRender(animateIn) {
  const gridEl = gridPickTakeover();
  if (!gridEl) return;
  const { offers, actions, onChoose } = gridPickState;
  const dist = (typeof CARD_H === 'number' ? CARD_H : 75) * GP_ROWS;
  const put = (html, style, delay) => {
    const d = document.createElement('div');
    d.innerHTML = html;
    const el = d.firstElementChild;
    el.style.cssText += style;
    gridEl.appendChild(el);
    if (animateIn) gridTileFallIn(el, { delay, dist });
    return el;
  };

  // The options are CENTRED: two offers (the map's knack pick) is 4 cells of a
  // 6-wide board, and starting them at the left edge would leave a bare column
  // rather than a board. Everything they do not cover is ambience, so no cell
  // is ever empty.
  const span = offers.length * GP_OPT_W;
  const startCol = Math.max(0, Math.floor((GP_COLS - span) / 2));

  // AMBIENCE FIRST, every cell not taken by an option, so a real tile always
  // paints over it rather than the other way round.
  for (let r = 0; r < GP_ROWS - 1; r++) {
    for (let c = 0; c < GP_COLS; c++) {
      const inOpt = r >= GP_OPT_ROW && r < GP_OPT_ROW + GP_OPT_H
                 && c >= startCol && c < startCol + span;
      if (inOpt) continue;
      put('<div class="gp-amb"></div>', gpBox(r, c, 1, 1), (r * GP_COLS + c) * 30);
    }
  }

  // The options themselves, 2 cells wide and 3 tall.
  offers.forEach((p, i) => {
    put(gridPickTileHTML(p, i), gpBox(GP_OPT_ROW, startCol + i * GP_OPT_W, GP_OPT_W, GP_OPT_H), 220 + i * 90);
  });

  // Row 4: the screen's own actions as TILES (owner spec r256 - Survival's
  // reroll is a tile on the board, not a button under a panel), then ambience
  // for the cells no action claimed.
  const acts = (actions || []).slice(0, GP_COLS);
  for (let c = 0; c < GP_COLS; c++) {
    const a = acts[c];
    const delay = 500 + c * 45;
    if (!a) { put('<div class="gp-amb"></div>', gpBox(GP_ROWS - 1, c, 1, 1), delay); continue; }
    const el = put(
      `<div class="gp-act${a.cls ? ' ' + a.cls : ''}${a.disabled ? ' gp-act-off' : ''}">`
      + `<div class="gp-act-icon">${a.icon || ''}</div>`
      + `<div class="gp-act-label">${a.label || ''}</div>`
      + (a.sub ? `<div class="gp-act-sub">${a.sub}</div>` : '')
      + `</div>`, gpBox(GP_ROWS - 1, c, 1, 1), delay);
    if (!a.disabled && a.onClick) el.addEventListener('click', e => { e.stopPropagation(); a.onClick(); });
  }

  gridPickAfterRender(gridEl, offers, onChoose);
}

// opts: { kicker, title, tone, offers, actions, onChoose(i, offer) }
function openGridPick(opts) {
  const offers = opts.offers || [];
  gridPickState = {
    offers, actions: opts.actions || [],
    onChoose: (i, offer) => { closeGridPick(); opts.onChoose && opts.onChoose(i, offer); },
  };
  gameTimerPaused = true;
  if (typeof enterGridScreenHud === 'function') enterGridScreenHud(opts.title || 'TAKE ONE', opts.tone || 'reward');
  gridPickRender(true);
}

// Re-draw without re-dealing (a reroll swapped the offers under us).
function gridPickRefresh(offers, actions) {
  if (!gridPickState) return;
  if (offers)  gridPickState.offers  = offers;
  if (actions) gridPickState.actions = actions;
  gridPickRender(false);
}

// Put the board back without ending the pick (Survival's peek), and bring it
// back again. The offers are held in gridPickState, so this is a redraw.
function gridPickSetShown(on) {
  if (!gridPickState) return;
  if (on) { gridPickRender(false); }
  else {
    gridPickRelease();
    if (typeof stopFloat === 'function') stopFloat('gridpick');
    if (typeof render === 'function') { try { render(); } catch (e) {} }
  }
}

function closeGridPick() {
  gridPickRelease();
  gridPickState = null;
  if (typeof stopFloat === 'function') stopFloat('gridpick');
  if (typeof clearFloatSeeds === 'function') clearFloatSeeds('gp-');
  if (typeof hideEntityTooltip === 'function') hideEntityTooltip(true);
  if (typeof exitGridScreenHud === 'function') exitGridScreenHud();
}
