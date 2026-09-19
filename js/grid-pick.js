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
//     row 4 : the screen's own action tiles (Survival's reroll / peek /
//             breakdown / shop) in the first 4 cells, then CONFIRM across the
//             last 2; any cell no action claims stays ambience
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
//    an ellipsis marking that there is more; the rest is read in the tooltip.
//  - The choices are neutral-bordered; rarity colour stays on the object,
//    where it means rarity.
//
// A TAP SELECTS AND READS; ONLY CONFIRM COMMITS (r280). A tap used to APPLY the
// offer on the spot, which is the one screen in the game where an unrecoverable
// grant was one stray tap away and the description was clamped to three lines
// while you made it. Now a tap marks the tile AND opens its full description,
// and the pick is taken by a CONFIRM tile in the action row - so reading and
// choosing are the same gesture and committing is a separate one.
//
// THE READ IS THE NON-INTERACTIVE TOOLTIP, DELIBERATELY. An interactive bubble
// (one carrying buttons) brings a full-screen backdrop that swallows the
// pointerdown dismissing it (r182), so moving to another option would cost two
// taps on the one screen where comparing three things IS the task. The plain
// bubble is pointer-events:none (css/tooltip.css) and a tap goes straight
// through it to whatever is underneath, CONFIRM included.
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

// CONFIRM owns the last cells of the action row, on EVERY screen that comes
// through here, whether or not the caller brought actions of its own. A control
// that commits has to be in the same place every time it appears - the shop's
// LEAVE and the reward grid's CONFIRM are fixed for the same reason - so the
// cells a caller may fill are whatever is left to the left of it.
const GP_CONFIRM_W = 2;
const GP_ACT_COLS  = GP_COLS - GP_CONFIRM_W;

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

// The payload the tooltip reads. Built here rather than taken from the object's
// own data-et, because a LIMIT has no object at all and would otherwise be the
// one offer on this screen with nothing to read.
function gpTipPayload(p) {
  return { label: p.label, desc: p.desc, rarity: p.rarity || p.tier || 'common',
           type: p.entity, emoji: p.emoji || p.icon, uses: p.uses };
}

// One choice. p: { entity, id, emoji/icon, label, desc, rarity/tier, uses, tag }
function gridPickTileHTML(p, i) {
  const rar = (typeof tierId === 'function') ? tierId(p.rarity || p.tier || 'common') : (p.rarity || 'common');
  const isEnt = p.entity === 'trick' || p.entity === 'sleight' || p.entity === 'knack';
  // tip:false on the OBJECT and data-et on the TILE instead. Both carrying it
  // would re-anchor the bubble every time the pointer crossed between the
  // object and the words under it (the delegated listener keys on the NEAREST
  // [data-et]); one payload on the whole tile is one hover target.
  const art = (isEnt && typeof entityTileHTML === 'function')
    ? entityTileHTML({ entity: p.entity, id: p.id, emoji: p.emoji || p.icon, label: p.label, uses: p.uses }, rar,
                     { extraClass: 'gp-obj', tip: false })
    : `<div class="gp-icon">${p.icon || p.emoji || '\u25b2'}</div>`;
  const desc = (typeof colorizeKeywords === 'function') ? colorizeKeywords(p.desc || '') : (p.desc || '');
  const tip = encodeURIComponent(JSON.stringify(gpTipPayload(p)));
  // The art box is given the OBJECT'S OWN ASPECT (gp-art-<kind>), so the object
  // fills it instead of letterboxing inside a taller box - that slack was the
  // big gap between the icon and the name the owner called out.
  const kind = isEnt ? p.entity : 'plain';
  return `<div class="gp-opt gp-art-${kind}" data-gp="${i}" data-et="${tip}">`
    + (p.tag ? `<div class="gp-tag rar-${rar}">${p.tag}</div>` : '')
    + `<div class="gp-art" data-float-key="gp-${i}-${p.id || p.label || ''}">${art}</div>`
    + `<div class="gp-name">${p.label || ''}</div>`
    + `<div class="gp-body"><div class="gp-desc">${desc}</div>`
    + `<div class="gp-more" aria-hidden="true">\u2026</div></div>`
    + `</div>`;
}

// ── SELECT AND READ ─────────────────────────────────────────────────────────
// One tap does both jobs a player has on this screen: it marks the tile as the
// one they mean, and it opens the full description. Nothing is granted until
// CONFIRM. See the header for why the bubble is the NON-interactive one.
function gpShowRead(opt, p) {
  if (typeof showEntityTooltip !== 'function' || !p) return;
  showEntityTooltip(opt, gpTipPayload(p));
}

// Paint the selection onto tiles that are already on the board. Never a redraw:
// the options deal in once per screen and re-running that for a tap would
// replay the fall and restart every object's drift.
function gridPickPaintSelection() {
  const gridEl = document.getElementById('grid');
  if (!gridEl || !gridPickState) return;
  const sel = gridPickState.selected;
  gridEl.querySelectorAll('.gp-opt').forEach(el => {
    el.classList.toggle('gp-sel', +el.dataset.gp === sel);
  });
  const btn = gridEl.querySelector('.gp-confirm');
  if (!btn) return;
  const p = (gridPickState.offers || [])[sel];
  btn.classList.toggle('gp-act-off', !p);
  const sub = btn.querySelector('.gp-act-sub');
  if (sub) sub.textContent = p ? (p.label || '') : 'TAP AN OPTION';
}

// A tap on an option. Tapping the one already picked closes the read and keeps
// the selection - the bubble is a reference, not the choice, so dismissing it
// must never cost the pick you had made.
function gridPickSelect(i) {
  if (!gridPickState) return;
  const p = (gridPickState.offers || [])[i];
  if (!p) return;
  const gridEl = document.getElementById('grid');
  const opt = gridEl && gridEl.querySelector(`.gp-opt[data-gp="${i}"]`);
  if (gridPickState.selected === i) {
    if (typeof entityTooltipOpen === 'function' && entityTooltipOpen()) { hideEntityTooltip(true); return; }
    if (opt) gpShowRead(opt, p);
    return;
  }
  gridPickState.selected = i;
  gridPickPaintSelection();
  if (opt) gpShowRead(opt, p);
  if (typeof sfxCardSelect === 'function') { try { sfxCardSelect(); } catch (e) {} }
}

// CONFIRM. The only path that commits.
function gridPickConfirm() {
  if (!gridPickState) return;
  const i = gridPickState.selected;
  const p = (gridPickState.offers || [])[i];
  if (!p) return;
  gridPickState.onChoose(i, p);
}

// Wire a container of .gp-opt tiles: select on click, clamp detection on the
// descriptions, name fitting, and the float driver.
function gridPickAfterRender(root, offers, onChoose) {
  root.querySelectorAll('.gp-opt').forEach(opt => {
    const i = +opt.dataset.gp;
    if (onChoose) opt.addEventListener('click', () => gridPickSelect(i));

    const desc = opt.querySelector('.gp-desc');
    const more = opt.querySelector('.gp-more');
    if (desc && more) {
      // Clamp detection needs a laid-out element - callers invoke this after
      // the tiles are on the board (a hidden element measures zero, r239).
      // The ellipsis is a MARK, not a control: it says there is more to read
      // and the tap that reads it is the tap on the tile (css sets
      // pointer-events:none on it), so it can never eat a selection.
      requestAnimationFrame(() => {
        opt.classList.toggle('gp-clipped', desc.scrollHeight > desc.clientHeight + 1);
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
  // reroll is a tile on the board, not a button under a panel) in the cells to
  // the LEFT of CONFIRM, then ambience for the cells no action claimed.
  const acts = (actions || []).slice(0, GP_ACT_COLS);
  for (let c = 0; c < GP_ACT_COLS; c++) {
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

  // CONFIRM, across the last cells of the row. Drawn disabled and lit by
  // gridPickPaintSelection - which is also what writes the chosen name into it,
  // so the tile that commits always says what it is about to commit to.
  const conf = put(
    `<div class="gp-act gp-confirm gp-act-off">`
    + `<div class="gp-act-icon">\u2713</div>`
    + `<div class="gp-act-label">Confirm</div>`
    + `<div class="gp-act-sub">TAP AN OPTION</div>`
    + `</div>`, gpBox(GP_ROWS - 1, GP_ACT_COLS, GP_CONFIRM_W, 1), 500 + GP_ACT_COLS * 45);
  conf.addEventListener('click', e => { e.stopPropagation(); gridPickConfirm(); });

  gridPickAfterRender(gridEl, offers, onChoose);
  gridPickPaintSelection();
}

// opts: { kicker, title, tone, offers, actions, onChoose(i, offer) }
function openGridPick(opts) {
  const offers = opts.offers || [];
  gridPickState = {
    offers, actions: opts.actions || [], selected: -1,
    onChoose: (i, offer) => { closeGridPick(); opts.onChoose && opts.onChoose(i, offer); },
  };
  gameTimerPaused = true;
  if (typeof enterGridScreenHud === 'function') enterGridScreenHud(opts.title || 'TAKE ONE', opts.tone || 'reward');
  gridPickRender(true);
}

// Re-draw without re-dealing (a reroll swapped the offers under us).
function gridPickRefresh(offers, actions) {
  if (!gridPickState) return;
  // NEW OFFERS DROP THE SELECTION. A reroll swaps what is on the board out from
  // under it, so index 1 is a different entity afterwards and holding the mark
  // there would arm CONFIRM on something the player never read. An actions-only
  // refresh (Survival repainting affordability as credits move) keeps it.
  if (offers)  { gridPickState.offers = offers; gridPickState.selected = -1;
                 if (typeof hideEntityTooltip === 'function') hideEntityTooltip(true); }
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
