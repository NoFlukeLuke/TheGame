// ══════════════════════════════════════════════════════════════════════════
// GRID PICK (r254) - the pick-of-three drawn ON the board.
//
// The pick-of-three used to be a small panel floating over the grid: three
// 116px cards over a board they had nothing to do with. This renders the same
// choice INTO #grid-slot - the reward grid's own room - as choices as large as
// the board affords, each one the shared entity object (js/entity-tile.js) with
// its name and description stationary beneath it.
//
// Three rules, all owner spec:
//  - The OBJECT floats (js/float-anim.js, the reward grid's drift); the NAME
//    and DESCRIPTION do not - a drifting paragraph is unreadable.
//  - The description never grows the tile. It clamps with an ellipsis, and a
//    clamped description brings the rest up in a tooltip to the side on
//    hover / tap (the tap is a read, never a pick - it stops propagation).
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
//    hard-round knack pick).
//  - Survival keeps its own overlay (peek / reroll / shop / contributions are
//    its machinery) but builds each choice with gridPickTileHTML and wires it
//    with gridPickAfterRender, so the choices themselves are the same object.
// ══════════════════════════════════════════════════════════════════════════

// The entity object AND the bare icon (a limit has no object) both drift.
const GRID_PICK_FLOAT_SEL = '.gp-art .reward-cell, .gp-art .gp-icon';

// One choice. p: { entity, id, emoji/icon, label, desc, rarity/tier, uses, tag }
function gridPickTileHTML(p, i) {
  const rar = (typeof tierId === 'function') ? tierId(p.rarity || p.tier || 'common') : (p.rarity || 'common');
  const isEnt = p.entity === 'trick' || p.entity === 'sleight' || p.entity === 'knack';
  const art = (isEnt && typeof entityTileHTML === 'function')
    ? entityTileHTML({ entity: p.entity, id: p.id, emoji: p.emoji || p.icon, label: p.label, uses: p.uses }, rar,
                     { extraClass: 'gp-obj' })
    : `<div class="gp-icon">${p.icon || p.emoji || '▲'}</div>`;
  const desc = (typeof colorizeKeywords === 'function') ? colorizeKeywords(p.desc || '') : (p.desc || '');
  return `<div class="gp-opt" data-gp="${i}" style="animation-delay:${i * 90}ms">`
    + (p.tag ? `<div class="gp-tag rar-${rar}">${p.tag}</div>` : '')
    + `<div class="gp-art" data-float-key="gp-${i}-${p.id || p.label || ''}">${art}</div>`
    + `<div class="gp-name">${p.label || ''}</div>`
    + `<div class="gp-desc">${desc}</div>`
    + `</div>`;
}

// Wire a container of .gp-opt tiles: choose on click, clamp detection on the
// descriptions, name fitting, and the float driver. Shared with Survival.
function gridPickAfterRender(root, offers, onChoose) {
  root.querySelectorAll('.gp-opt').forEach(opt => {
    const i = +opt.dataset.gp;
    if (onChoose) opt.addEventListener('click', () => onChoose(i, offers[i]));

    const desc = opt.querySelector('.gp-desc');
    if (desc) {
      // Clamp detection needs a laid-out element - callers invoke this after
      // the overlay is visible (a hidden element measures zero, r239's rule).
      requestAnimationFrame(() => {
        if (desc.scrollHeight > desc.clientHeight + 1) {
          desc.classList.add('gp-clip');
          const p = offers[i] || {};
          const payload = { label: p.label, desc: p.desc, rarity: p.rarity || p.tier,
                            type: p.entity, emoji: p.emoji || p.icon, uses: p.uses };
          // Reading the rest must never cost the pick: the tap stops here.
          desc.addEventListener('click', e => { e.stopPropagation(); showEntityTooltip(desc, payload); });
          desc.addEventListener('mouseenter', () => showEntityTooltip(desc, payload));
          desc.addEventListener('mouseleave', () => hideEntityTooltip());
        }
      });
    }
  });
  requestAnimationFrame(() => {
    if (typeof fitRewardName === 'function')
      root.querySelectorAll('.gp-art .rwd-name').forEach(nm => fitRewardName(nm));
  });
  if (typeof startFloat === 'function') startFloat('gridpick', GRID_PICK_FLOAT_SEL);
}

// opts: { kicker, title, offers, onChoose(i, offer), footerHTML }
// onChoose is responsible for calling closeGridPick() (or it is closed for it
// if it returns nothing) - kept explicit so a caller can chain screens.
function openGridPick(opts) {
  const slot = document.getElementById('grid-slot') || document.body;
  let el = document.getElementById('grid-pick');
  if (!el) { el = document.createElement('div'); el.id = 'grid-pick'; }
  slot.appendChild(el);
  el.innerHTML =
    `<div class="gp-head">`
    + (opts.kicker ? `<span class="gp-kicker">${opts.kicker}</span>` : '')
    + `<span class="gp-title">${opts.title || 'TAKE ONE'}</span></div>`
    + `<div class="gp-row"></div>`
    + (opts.footerHTML ? `<div class="gp-foot">${opts.footerHTML}</div>` : '');
  const row = el.querySelector('.gp-row');
  row.innerHTML = (opts.offers || []).map((p, i) => gridPickTileHTML(p, i)).join('');
  el.classList.add('show');
  gridPickAfterRender(row, opts.offers || [], (i, offer) => {
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
