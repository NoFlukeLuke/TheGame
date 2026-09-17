// ══════════════════════════════════════════════════════════════════════════
// ENTITY TILE - the ONE way an entity is drawn, everywhere (r182).
//
// A Trick used to look like three different objects depending on where you met
// it: a neon CRT card on the reward grid, a slightly different neon card in the
// Mart, and a small hand-styled chip with an ellipsised name in your own tray.
// Same thing, three costumes. This builder is now the single source: every
// surface wraps its own frame around .reward-cell.entity and fills it from here,
// so the tile you picked up is the tile you own is the tile you see for sale.
//
// The one deliberate difference stays: on the REWARD GRID a Trick hides its
// emoji behind a ✦ (you are picking a mystery off a board). Everywhere you
// already know what the thing is, the emoji shows. That is the `mystery` flag.
//
// p: { entity/type, label/name, emoji, icon, uses, cardFace }
// ══════════════════════════════════════════════════════════════════════════

function entityTileInner(p, { mystery = false } = {}) {
  const kind  = p.entity || p.type;
  const label = p.label != null ? p.label : (p.name || '');
  const name  = `<div class="rwd-name">${label}</div>`;
  // Improvement tier (r206). Drawn here rather than per surface, so the tray,
  // the Mart strip, Records and the Shift Change slots all gain it at once. It
  // needs the entity's id, which a caller may not pass - absent id, no badge,
  // which is the right answer for a resource or debuff tile anyway.
  const _tier = (p.id && typeof entityTierOf === 'function') ? entityTierOf(p.id) : 0;
  const tierBadge = _tier > 0 ? `<div class="rwd-tier" title="Improved ${_tier}x">+${_tier}</div>` : '';

  if (kind === 'knack')
    return `<div class="rwd-diamond"><span class="rwd-diamond-emoji">${p.emoji || p.icon || '♛'}</span></div>` + name + tierBadge;

  if (kind === 'trick')
    return `<div class="rwd-glyph">✦</div>`
         + `<div class="rwd-art${mystery ? ' rwd-art-ph' : ''}">${mystery ? '✦' : (p.emoji || p.icon || '✦')}</div>`
         + name + tierBadge;

  if (kind === 'sleight')
    return `<div class="rwd-tab">▶</div><div class="rwd-art">${p.emoji || p.icon || '🃏'}</div>` + name
         + (p.uses != null ? `<div class="rwd-uses">${p.uses}</div>` : '') + tierBadge;

  // Card-face tiles (blessed / cursed / cull): mini playing card + name. The
  // explanation lives in the tooltip like every other tile.
  if (p.cardFace)
    return `<div class="reward-face ${suitClass(p.cardFace.suit)}">`
         + `<span class="reward-face-rank">${p.cardFace.rank}</span>`
         + `<span class="reward-face-suit">${p.cardFace.suit}</span></div>` + name;

  // Plain resource / debuff / dest / mystery tile: icon + name.
  return `<div class="reward-icon">${p.icon || p.emoji || '▲'}</div>` + name;
}

// The class list for the .reward-cell that entityTileInner fills. Kept beside the
// builder so a surface can never pair the markup with the wrong modifiers.
function entityTileClass(p, rarity, extra) {
  const kind = p.entity || p.type;
  return ['reward-cell', 'entity', kind ? 'entity-' + kind : '', 'rar-' + (rarity || 'common'), extra]
    .filter(Boolean).join(' ');
}

// ── The tooltip payload a tile carries with it (r254) ───────────────────────
// Tooltips used to be something each surface remembered to wire, which is why
// the map's knack pick, the boss briefing's pools and the Shift Change slots
// had none at all. The tile now DESCRIBES ITSELF: entityTileHTML stamps a
// data-et attribute on the frame, and one delegated listener in
// js/entity-tooltip.js opens showEntityTooltip for any hovered or long-pressed
// element carrying it. A new surface gets the tooltip by drawing the tile.
//
// Callers rarely pass a desc, so it is RESOLVED from the pools by id (or name,
// for the callers that pass only a label). TRICK_POOL is mode-filtered in
// place (r160), so an owned Trick can be absent from it - TRICK_POOL_ALL is
// the pristine fallback. No desc found means no attribute, never a blank
// bubble.
function entityTipPayloadFor(p, rarity) {
  const kind = p.entity || p.type;
  if (kind !== 'trick' && kind !== 'sleight' && kind !== 'knack') return null;
  const label = p.label != null ? p.label : (p.name || '');
  let desc = p.desc, rar = rarity;
  if (!desc) {
    const pools = kind === 'trick'
      ? [typeof TRICK_POOL !== 'undefined' && TRICK_POOL, typeof TRICK_POOL_ALL !== 'undefined' && TRICK_POOL_ALL]
      : kind === 'knack' ? [typeof KNACK_POOL !== 'undefined' && KNACK_POOL]
      : [typeof SLEIGHT_POOL !== 'undefined' && SLEIGHT_POOL];
    let def = null;
    for (const pool of pools) {
      if (!pool) continue;
      def = (p.id && pool.find(e => e.id === p.id)) || pool.find(e => e.name === label);
      if (def) break;
    }
    if (def) {
      desc = (kind === 'trick' && typeof trickLiveDesc === 'function') ? trickLiveDesc(def) : def.desc;
      rar = rar || def.tier || def.rarity;
    }
  }
  if (!desc) return null;
  return { label, desc, rarity: rar || 'common', type: kind, emoji: p.emoji || p.icon, uses: p.uses };
}

// A complete tile, frame and all - for surfaces that have no frame of their own
// (the tray, the cart). Surfaces that DO own the frame (reward grid, Mart) build
// their own element and call entityTileInner into it (and wire their own richer
// tooltips - attachRewardTooltip and the Mart's pin/cart bubble).
//
// `tip: false` opts a surface out of the self-describing tooltip - the Trick
// tray uses it, because its tap already opens its own bubble with SELL/DISCARD
// and two bubbles on one chip is one too many.
function entityTileHTML(p, rarity, { mystery = false, extraClass = '', tip = true } = {}) {
  let tipAttr = '';
  if (tip && !mystery) {
    const tp = entityTipPayloadFor(p, rarity);
    if (tp) tipAttr = ` data-et="${encodeURIComponent(JSON.stringify(tp))}"`;
  }
  return `<div class="${entityTileClass(p, rarity, extraClass)}"${tipAttr}>${entityTileInner(p, { mystery })}</div>`;
}
