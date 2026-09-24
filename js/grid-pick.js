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
// THE LAYOUT (owner spec, r292) - a 6 x 4 board with NO DEAD ROW:
//
//     rows 0-2 : three options, each 2 CELLS WIDE x 3 CELLS TALL - the ENTITY
//                in the top 2x2, the DESCRIPTION in the block beneath it
//     row 3    : the screen's own action tiles (Survival's reroll / peek /
//                breakdown / shop) in the first 4 cells, then CONFIRM across
//                the last 2; any cell no action claims stays ambience
//
// That closes exactly: 3 x (2x3) = 18 cells, plus 6 below = 24.
//
// r256 opened on a full row of ambience above the options - and the tile's own
// contents did not reach its foot, so the board carried TWO dead bands, one
// above the tiles and one inside every one of them, which the owner read as two
// empty rows. THE FIX IS TO DROP A ROW, NOT TO SPEND ONE. The options keep
// three cells and simply start at row 0, so the board is a row shorter.
//
// THAT IS WHY THE TILE GETS BIGGER, AND IT IS THE ONE COUNTERINTUITIVE PART.
// `recomputeGridMetrics` holds the playing-card aspect, so a cell's width and
// height are locked together and FEWER ROWS IN THE SAME SLOT MEANS A WIDER
// CELL. Measured at 1440x820: 5 rows gives a 49x64 cell and a 198px tile, 4
// rows gives 53x70 and a 214px tile. Asking for MORE rows does the reverse and
// was measured too - at 7 rows (a 2x2 entity over a 2x4 description) the cell
// hits its floors at 40x53, the tile drops to 163px wide, the artwork shrinks
// by 20% and the board overflows its slot by ~117px. A taller tile is a
// narrower tile here, and the description wants width.
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

const GP_COLS = 6, GP_ROWS = 4;   // the board this screen asks for
const GP_OPT_W = 2, GP_OPT_H = 3; // each option, in cells: 2 for the entity, 1 for the words
const GP_OPT_ROW = 0;             // options start at the top - there is no ambience row above them

// CONFIRM owns the last cells of the action row, on EVERY screen that comes
// through here, whether or not the caller brought actions of its own. A control
// that commits has to be in the same place every time it appears - the shop's
// LEAVE and the reward grid's CONFIRM are fixed for the same reason - so the
// cells a caller may fill are whatever is left to the left of it.
const GP_CONFIRM_W = 2;
const GP_ACT_COLS  = GP_COLS - GP_CONFIRM_W;

// ── THE REROLL POOL (r282) - ONE pool, shared by every pick-of-three ─────────
// Survival owned this and the Schedule's pick had no reroll at all. It is RUN
// state, not mode state - a pool of free rerolls that carries between picks and
// grows as you beat bosses - so it lives here, with the screen, and both callers
// read it. A second copy in guided-mode.js is exactly how the two would drift.
//
// FREE FIRST, THEN PRICED. While the pool has any left a reroll costs nothing
// and spends one; after that it costs PICK_REROLL_STEP x (paid rerolls on THIS
// screen), so 5, 10, 15. The escalation resets per screen and the pool does not:
// that is what makes holding a free reroll for a later pick a real decision.
const PICK_REROLLS_START    = 3;   // at the start of a run
const PICK_REROLLS_PER_BOSS = 2;   // every boss beaten, in every mode
const PICK_REROLL_STEP      = 5;   // the price of the 1st, 2nd, 3rd PAID reroll

let pickRerollsLeft = PICK_REROLLS_START;  // the carry-over pool
let pickRerollsUsed = 0;                   // PAID rerolls on the screen that is open

function pickRerollsInit()  { pickRerollsLeft = PICK_REROLLS_START; pickRerollsUsed = 0; }
function pickRerollsGrant() { pickRerollsLeft += PICK_REROLLS_PER_BOSS; }
// Called when a pick OPENS, never when it refreshes - the price climbing within
// one screen is the whole point, and a reroll that reset it would be free.
function pickRerollsNewScreen() { pickRerollsUsed = 0; }
function pickRerollCost() { return pickRerollsLeft > 0 ? 0 : PICK_REROLL_STEP * (pickRerollsUsed + 1); }

// Spend one. Returns false and says why when it cannot, so a caller can simply
// `if (!pickRerollSpend()) return;` before drawing new offers.
function pickRerollSpend() {
  if (pickRerollsLeft > 0) { pickRerollsLeft--; return true; }
  const cost = pickRerollCost();
  if (coins < cost) { showMessage('Not enough credits', 'var(--red)'); return false; }
  coins -= cost;
  if (typeof updateCoinsUI === 'function') updateCoinsUI();
  pickRerollsUsed++;   // only a PAID reroll moves the price
  return true;
}

// The action tile, built once here so both screens print the same thing: FREE
// with the pool's count while it lasts, then the live price.
function pickRerollAction(onReroll) {
  const free = pickRerollsLeft > 0, cost = pickRerollCost();
  return { icon: '🎲', label: 'Reroll',
           sub: free ? `FREE (${pickRerollsLeft})` : `${cost} \u25c6`,
           disabled: !free && coins < cost,
           onClick: () => { if (pickRerollSpend()) onReroll(); } };
}

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
  // TWO BLOCKS (r292). .gp-head is the top two cells - the entity and its name,
  // nothing else - and .gp-body the two beneath. They are wrappers rather than
  // four loose children because the halves have to be SIZED against the tile
  // (css/grid-pick.css): a flat child list can only be centred as one group,
  // which is what pooled the tile's slack at its foot and read as a dead row.
  return `<div class="gp-opt gp-art-${kind}" data-gp="${i}" data-et="${tip}">`
    + `<div class="gp-head">`
    + (p.tag ? `<div class="gp-tag rar-${rar}">${p.tag}</div>` : '')
    + `<div class="gp-art" data-float-key="gp-${i}-${p.id || p.label || ''}">${art}</div>`
    + `<div class="gp-name">${p.label || ''}</div>`
    + `</div>`
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
  // Portrait: the read opens ABOVE the tile - the side placement always
  // clamped it onto the other two options - and WIDE, so it is short enough to
  // sit in the centred board's top margin (r333; r326 shoved the whole board
  // to the slot's foot instead and the owner read it as the pick sitting too
  // low). Landscape keeps the side placement and the normal width: the board
  // there has real gutters and the bubble lands off the tiles already.
  const portrait = !document.getElementById('stage')?.classList.contains('landscape');
  showEntityTooltip(opt, gpTipPayload(p), portrait ? { prefer: 'above', wide: true } : {});
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
  // Tapping the picked option again UNSELECTS it (owner's ask, r362) and closes
  // its read, so a pick can be taken back without choosing something else.
  if (gridPickState.selected === i) {
    gridPickState.selected = -1;
    if (typeof hideEntityTooltip === 'function') hideEntityTooltip(true);
    gridPickPaintSelection();
    return;
  }
  gridPickState.skipArmedAt = 0;
  gridPickState.selected = i;
  gridPickPaintSelection();
  if (opt) gpShowRead(opt, p);
  if (typeof sfxCardSelect === 'function') { try { sfxCardSelect(); } catch (e) {} }
}

// CONFIRM. The only path that commits.
const GP_SKIP_WINDOW = 3000;
function gridPickConfirm() {
  if (!gridPickState) return;
  const i = gridPickState.selected;
  const p = (gridPickState.offers || [])[i];
  if (!p) {
    if (!gridPickState.onSkip) return;
    if (Date.now() - gridPickState.skipArmedAt < GP_SKIP_WINDOW) { gridPickState.onSkip(); return; }
    gridPickState.skipArmedAt = Date.now();
    const btn = document.querySelector('#grid .gp-confirm');
    if (btn) { btn.classList.remove('gp-act-off'); const sub = btn.querySelector('.gp-act-sub'); if (sub) sub.textContent = 'PRESS AGAIN TO SKIP'; }
    setTimeout(() => { if (gridPickState && gridPickState.selected < 0) gridPickPaintSelection(); }, GP_SKIP_WINDOW);
    return;
  }
  gridPickState.onChoose(i, p);
}

// THE DESCRIPTION FILLS ITS OWN CELLS (r292). The clamp was a fixed 5 lines,
// chosen against the r280 tile of 3 cells; on the 4-cell tile that left a band
// of bare tile under every short description and still cut the long ones early.
// It is MEASURED now - as many whole lines as the block can hold - so the words
// use the room the ambience row gave back.
//
// TWO PASSES, because the ellipsis mark is a line of the block too. The first
// pass fills it; if that overflows, one line is handed back for the mark to sit
// on. Without that the mark is pushed out of a block it exactly fills and the
// tile silently stops saying there is more to read.
//
// The mark is a MARK, not a control: the tap that reads the rest is the tap on
// the tile (css sets pointer-events:none on it), so it can never eat a
// selection.
function gpFitDesc(opt) {
  const body = opt.querySelector('.gp-body');
  const desc = opt.querySelector('.gp-desc');
  if (!body || !desc) return;
  const cs = getComputedStyle(body);
  const lh = parseFloat(getComputedStyle(desc).lineHeight) || 10;
  // clientHeight INCLUDES padding, and the block is padded - measuring against
  // it would promise the text a line and a half of room it does not have.
  const room = body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  if (!(lh > 0) || !(room > 0)) return;   // not laid out yet - leave the CSS default
  let lines = Math.max(2, Math.floor(room / lh));
  desc.style.webkitLineClamp = lines;
  if (desc.scrollHeight > desc.clientHeight + 1 && lines > 2)
    desc.style.webkitLineClamp = lines - 1;
  opt.classList.toggle('gp-clipped', desc.scrollHeight > desc.clientHeight + 1);
}

// Wire a container of .gp-opt tiles: select on click, description fitting,
// name fitting, and the float driver.
function gridPickAfterRender(root, offers, onChoose) {
  root.querySelectorAll('.gp-opt').forEach(opt => {
    const i = +opt.dataset.gp;
    if (onChoose) opt.addEventListener('click', () => gridPickSelect(i));

  });
  // Measuring needs laid-out elements - callers invoke this after the tiles are
  // on the board (a hidden element measures zero, r239).
  //
  // NAMES BEFORE DESCRIPTIONS, in one frame: a name that shrinks or wraps
  // changes the head block's height, and the description's line count is
  // measured off what is left. Two frames would show the first answer first.
  requestAnimationFrame(() => {
    if (typeof fitRewardName === 'function')
      root.querySelectorAll('.gp-art .rwd-name').forEach(nm => fitRewardName(nm));
    // The tile's own name is 11px since r292 and the tile is two cells wide, so
    // the long single-word names (Kaleidoscope, Syncopation) no longer fit on a
    // line. r182's rule: a name is never broken mid-word - it shrinks, and only
    // truncates as a last resort. Without this they would simply be clipped by
    // the tile's overflow:hidden.
    if (typeof fitEntityName === 'function')
      root.querySelectorAll('.gp-name').forEach(nm => fitEntityName(nm, { maxLines: 2, minPx: 7 }));
    root.querySelectorAll('.gp-opt').forEach(opt => gpFitDesc(opt));
  });
  if (typeof startFloat === 'function') startFloat('gridpick', GRID_PICK_FLOAT_SEL);
}

// The crossroads' own deal - a tile falls from above the board and settles.
// Shared with the tiled payout (js/interlude.js), which is the same idea.
function gridTileFallIn(el, { delay = 0, dist = 260 } = {}) {
  if (!el.animate) return null;
  const B = 8, S = 0.10;
  const anim = el.animate([
    { opacity: 0, transform: `translateY(${-dist}px) scaleY(1)` },
    { opacity: 1, transform: `translateY(${-dist}px) scaleY(1)`,        offset: 0.06 },
    { opacity: 1, transform: `translateY(${-dist * 0.45}px) scaleY(0.96)`, offset: 0.55, easing: 'ease-in' },
    { opacity: 1, transform: `translateY(${B}px) scaleY(${1 - S})`,     offset: 0.83 },
    { opacity: 1, transform: `translateY(${-B * 0.7}px) scaleY(${1 + S})`, offset: 0.91 },
    { opacity: 1, transform: `translateY(${B * 0.3}px) scaleY(${1 - S * 0.2})`, offset: 0.96 },
    { opacity: 1, transform: 'translateY(0) scaleY(1)' },
  ], { duration: 420, delay, easing: 'ease-in', fill: 'both' });
  // RELEASE THE TRANSFORM WHEN THE FALL ENDS (r281). `fill: 'both'` is what
  // holds the tile offset and invisible through its DELAY, and it is also what
  // makes the animation OUTLIVE the fall: a filling WAAPI animation owns
  // `transform` for good, so any CSS transform the tile takes afterwards is
  // silently ignored - which is why .gp-sel's lift and swell did nothing here
  // while a selected reward tile lifted fine. The reward grid gets away with it
  // by rebuilding its tiles on every click; this screen deliberately does not
  // redraw (r280), so the animation has to hand the property back itself. The
  // last keyframe IS the tile's resting place, so cancelling on finish is
  // visually identical. The second handler swallows the AbortError a cancel
  // from anywhere else would reject with.
  if (anim.finished) anim.finished.then(() => { try { anim.cancel(); } catch (e) {} }, () => {});
  return anim;
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
    // r362: a screen that may be SKIPPED passes onSkip. CONFIRM with nothing
    // selected arms it ('PRESS AGAIN TO SKIP'); a second press inside
    // GP_SKIP_WINDOW takes nothing.
    onSkip: opts.onSkip ? () => { closeGridPick(); opts.onSkip(); } : null, skipArmedAt: 0,
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
