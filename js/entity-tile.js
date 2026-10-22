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
// The one deliberate difference stays: a reward-grid Trick tile that names no
// Trick yet hides its emoji behind a ✦. That is the `mystery` flag.
//
// r592 (owner): a Trick, Sleight or Knack carries NO NAME. The object is its
// icon, drawn large; the name is in the tooltip, or printed beside the object
// by a screen that has room (the pick's .gp-name, an event's .ec-name).
// Plain resource, debuff and card-face tiles keep their names.
//
// p: { entity/type, label/name, emoji, icon, uses, cardFace }
// ══════════════════════════════════════════════════════════════════════════

// THE GLYPH, NORMALISED (r292). Every emoji this file draws goes through here,
// which is the whole point: the correction is stamped into the string, so the
// reward grid, the tray, the Mart, Records, the events and the pick screens all
// get it without any of them knowing it exists. See emojiInkScale in
// js/fit-text.js for why an emoji's ink is not its font-size.
function emGlyph(g) {
  if (g == null || g === '') return '';
  const s = (typeof emojiInkScale === 'function') ? emojiInkScale(g) : 1;
  // A glyph that needs no correction is emitted without the property rather
  // than with `--egs:1`, so the markup stays quiet in the common case.
  const egs = s === 1 ? '' : `--egs:${s}`;
  // r583: a PIXEL ICON stands in for the emoji (js/data/icons.js, drawn from the
  // sheet by css/px-icons.css). The emoji rides along hidden inside it, so the
  // Entity art setting (js/px-icons.js) can show it again with no re-render.
  const ix = (typeof PX_ICONS !== 'undefined') ? PX_ICONS[g] : undefined;
  // r600: a light icon (cream, white) is outlined, or it vanishes on a light ground.
  const lt = (typeof PX_ICON_LIGHT !== 'undefined' && PX_ICON_LIGHT.includes(ix)) ? ' px-light' : '';
  if (ix != null) return `<span class="rwd-em px-ico${lt}" style="${egs ? egs + ';' : ''}--ix:${ix}"><i>${g}</i></span>`;
  return egs ? `<span class="rwd-em" style="${egs}">${g}</span>` : `<span class="rwd-em">${g}</span>`;
}

function entityTileInner(p, { mystery = false } = {}) {
  const kind  = p.entity || p.type;
  const label = p.label != null ? p.label : (p.name || '');
  const name  = `<div class="rwd-name">${label}</div>`;
  // Improvement tier (r206). Drawn here rather than per surface, so the tray,
  // the Mart strip, Records and the Shift Change slots all gain it at once. It
  // needs the entity's id, which a caller may not pass - absent id, no badge,
  // which is the right answer for a resource or debuff tile anyway.
  const _tier = (p.id && typeof entityTierOf === 'function') ? entityTierOf(p.id) : 0;
  // A VERSION STAMP, not a count (r267). It used to read `+2`, which is the
  // shape every live count in the game uses - and priming now owns `+N` on the
  // opposite corner, so two different meanings would have worn one costume.
  // `v2.0` reads as a property of the object; `+2` reads as something pending.
  // THE STAMP IS A VERSION, SO AN UNIMPROVED ENTITY IS v1 AND THE FIRST
  // IMPROVEMENT IS v2 (r376, owner's call). `entityTier` counts improvements
  // APPLIED, so the printed version is that count plus one - it was printing
  // the count, which read as a twice-improved Trick being "v2".
  const tierBadge = _tier > 0 ? `<div class="rwd-tier" title="Improved ${_tier}x">v${_tier + 1}.0</div>` : '';

  if (kind === 'knack')
    return `<div class="rwd-diamond"><span class="rwd-diamond-emoji">${emGlyph(p.emoji || p.icon || '♛')}</span></div>` + tierBadge;

  if (kind === 'trick') {
    // r646: a fused (INSEPARABLE) Trick wears both parts' icons (js/inseparable.js).
    const fd = (!mystery && p.id && typeof inseparableDef === 'function') ? inseparableDef(p.id) : null;
    const art = fd
      ? `<span class="rwd-fused">${fd.parts.map(id => emGlyph(trickEmoji(typeof inseparableRow === 'function' ? inseparableRow(id) : null))).join('')}</span>`
      : emGlyph(mystery ? '✦' : (p.emoji || p.icon || '✦'));
    return `<div class="rwd-glyph">✦</div>`
         + `<div class="rwd-art${mystery ? ' rwd-art-ph' : ''}">${art}</div>`
         + tierBadge;
  }

  if (kind === 'sleight')
    return `<div class="rwd-tab">▶</div><div class="rwd-art">${emGlyph(p.emoji || p.icon || '🃏')}</div>`
         + (p.uses != null ? `<div class="rwd-uses">${p.uses}</div>` : '') + tierBadge;

  // Card-face tiles (blessed / cursed / cull): mini playing card + name. The
  // explanation lives in the tooltip like every other tile.
  if (p.cardFace)
    return `<div class="reward-face ${suitClass(p.cardFace.suit)}">`
         + `<span class="reward-face-rank">${p.cardFace.rank}</span>`
         + `<span class="reward-face-suit">${p.cardFace.suit}</span></div>` + name;

  // Plain resource / debuff / dest / mystery tile: icon + name.
  return `<div class="reward-icon">${emGlyph(p.icon || p.emoji || '▲')}</div>` + name;
}

// The improvement tier as a CLASS (r274). The disc draws its bands and its
// shutter material from it (css/style.css) - see that block for why both have
// to be background layers rather than elements.
//
// CLAMPED at TIER_ART_MAX: 5 and up are iridescent, so the ladder's length is
// the stylesheet's length and nothing here has to know the cap twice.
//
// It has to land on the .reward-cell ITSELF, because a custom property set by
// a child cannot reach the parent's ::before. Most surfaces get it through
// entityTileClass below; the two that build their own cell from
// entityTileInner - the reward grid and the Mart - call this directly.
const TIER_ART_MAX = 5;
function entityTierClass(p) {
  const kind = p && (p.entity || p.type);
  // Tricks AND Sleights (r275): the disc and the business card both draw the
  // bands. A Knack has no object yet, so it is left out rather than guessed at.
  if ((kind !== 'trick' && kind !== 'sleight') || !p.id || typeof entityTierOf !== 'function') return '';
  const t = entityTierOf(p.id) || 0;
  return t > 0 ? 'tier-' + Math.min(t, TIER_ART_MAX) : '';
}

// The class list for the .reward-cell that entityTileInner fills. Kept beside the
// builder so a surface can never pair the markup with the wrong modifiers.
function entityTileClass(p, rarity, extra) {
  const kind = p.entity || p.type;
  return ['reward-cell', 'entity', kind ? 'entity-' + kind : '', 'rar-' + (rarity || 'common'),
          entityTierClass(p), (kind === 'trick' && p.id && typeof inseparableDef === 'function' && inseparableDef(p.id)) ? 'fused' : '', extra].filter(Boolean).join(' ');
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
  // r651: a rare or epic Trick not yet taken in any run shows no name (js/discovery.js).
  const shown = (kind === 'trick' && typeof shownEntityName === 'function') ? shownEntityName({ id: p.id, name: label, tier: rar }, 'trick') : label;
  return { label: shown, desc, rarity: rar || 'common', type: kind, emoji: p.emoji || p.icon, uses: p.uses };
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
  // r634: a tracked build (BUILDS -> TRACK IN RUNS) stars its entities on every
  // offer. Owned ones carry no star: the tray is not an offer.
  if (!mystery && p.id && typeof isRequisitioned === 'function' && isRequisitioned(p.id) && !entityOwnedNow(p.id))
    extraClass = (extraClass ? extraClass + ' ' : '') + 'requisitioned';
  // r651: an offer that would complete an INSEPARABLE pair the player has made before jitters (js/inseparable.js).
  if (!mystery && p.id && (p.entity || p.type) === 'trick' && typeof inseparableHint === 'function' && inseparableHint(p.id))
    extraClass = (extraClass ? extraClass + ' ' : '') + 'ins-hint';
  let tipAttr = '';
  if (tip && !mystery) {
    const tp = entityTipPayloadFor(p, rarity);
    if (tp) tipAttr = ` data-et="${encodeURIComponent(JSON.stringify(tp))}"`;
  }
  return `<div class="${entityTileClass(p, rarity, extraClass)}"${tipAttr}>${entityTileInner(p, { mystery })}</div>`;
}

// Owned in the live run, any type (r634). Read by the requisition star.
function entityOwnedNow(id) {
  try {
    if (typeof hasTrick === 'function' && hasTrick(id)) return true;
    if (typeof hasKnack === 'function' && hasKnack(id)) return true;
    if (typeof grantedSleightIds !== 'undefined' && grantedSleightIds.has(id)) return true;
  } catch (e) {}
  return false;
}
