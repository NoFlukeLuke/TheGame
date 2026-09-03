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

  if (kind === 'knack')
    return `<div class="rwd-diamond"><span class="rwd-diamond-emoji">${p.emoji || p.icon || '♛'}</span></div>` + name;

  if (kind === 'trick')
    return `<div class="rwd-glyph">✦</div>`
         + `<div class="rwd-art${mystery ? ' rwd-art-ph' : ''}">${mystery ? '✦' : (p.emoji || p.icon || '✦')}</div>`
         + name;

  if (kind === 'sleight')
    return `<div class="rwd-tab">▶</div><div class="rwd-art">${p.emoji || p.icon || '🃏'}</div>` + name
         + (p.uses != null ? `<div class="rwd-uses">${p.uses}</div>` : '');

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

// A complete tile, frame and all - for surfaces that have no frame of their own
// (the tray, the cart). Surfaces that DO own the frame (reward grid, Mart) build
// their own element and call entityTileInner into it.
function entityTileHTML(p, rarity, { mystery = false, extraClass = '' } = {}) {
  return `<div class="${entityTileClass(p, rarity, extraClass)}">${entityTileInner(p, { mystery })}</div>`;
}
