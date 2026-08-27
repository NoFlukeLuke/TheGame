// ══════════════════════════════════════════════════════════════════════════
// ENTITY TOOLTIP - one tooltip for every entity surface (shop, wheel, reward
// grid, trays). Replaces the per-screen tooltips that each had to be wired by
// hand, which is why most of the Mart had none at all.
//
// Two things it does that the old ones didn't:
//
//  1. KEYWORD DEFINITIONS. Mechanic words in the description are coloured
//     (js/keywords.js) and every distinct one gets a definition card beside the
//     tooltip, so the vocabulary is never assumed.
//
//  2. SPACE-AWARE PLACEMENT. It measures the gap on all four sides of the anchor
//     and opens into whichever has the most room - horizontally first, then it
//     clamps vertically. The definition rail goes on the tooltip's outer side,
//     flipping to the other side if that would run off screen.
// ══════════════════════════════════════════════════════════════════════════

let _etEl = null, _etHideTimer = null;

function ensureEntityTooltip() {
  if (_etEl) return _etEl;
  _etEl = document.createElement('div');
  _etEl.id = 'entity-tip';
  _etEl.innerHTML = `<div class="et-card">
      <div class="et-head"><span class="et-name"></span><span class="et-rar"></span></div>
      <div class="et-type"></div>
      <div class="et-desc"></div>
      <div class="et-meta"></div>
    </div>
    <div class="et-defs"></div>`;
  document.body.appendChild(_etEl);
  // No hover-to-keep-alive listeners: the tooltip is pointer-events:none (see
  // css/tooltip.css) precisely so it can never swallow a click meant for a tile
  // underneath it, and an element that takes no pointer events cannot receive
  // pointerenter either. Nothing to bind.
  return _etEl;
}

const ET_RARITY_COLOR = {
  common:'--c-mint', rare:'--c-cyan', epic:'--c-purple',
  legendary:'--c-yellow', mythic:'--c-magenta',
};

// payload: { label/name, desc, rarity/tier, type, emoji, price, uses, meta[] }
function showEntityTooltip(anchorEl, p) {
  if (!anchorEl || !p) return;
  clearTimeout(_etHideTimer);
  const el = ensureEntityTooltip();
  const rar  = ET_RARITY_COLOR[p.rarity] ? p.rarity : (ET_RARITY_COLOR[p.tier] ? p.tier : 'common');
  const desc = p.desc || '';

  el.style.setProperty('--rc', `var(${ET_RARITY_COLOR[rar]})`);
  el.querySelector('.et-name').textContent = p.label || p.name || '';
  el.querySelector('.et-rar').textContent  = rar;
  const typeEl = el.querySelector('.et-type');
  typeEl.textContent = (p.type || p.entity || '').toString().toUpperCase();
  typeEl.style.display = typeEl.textContent ? '' : 'none';
  el.querySelector('.et-desc').innerHTML = highlightKeywords(desc);

  const meta = [];
  if (p.price != null) meta.push(`💰 ${p.price}`);
  if (p.uses  != null) meta.push(`${p.uses} uses`);
  if (Array.isArray(p.meta)) meta.push(...p.meta);
  const metaEl = el.querySelector('.et-meta');
  metaEl.innerHTML = meta.map(m => `<span>${m}</span>`).join('');
  metaEl.style.display = meta.length ? '' : 'none';

  // definition cards for every mechanic word used
  const defs = keywordsIn(desc);
  el.querySelector('.et-defs').innerHTML = defs.map(d =>
    `<div class="et-def"><b class="kw ${d.cls}">${d.name}</b><span>${d.def}</span></div>`).join('');

  el.classList.add('show');
  placeEntityTooltip(anchorEl, el);
}

function hideEntityTooltip() {
  clearTimeout(_etHideTimer);
  _etHideTimer = setTimeout(() => { if (_etEl) _etEl.classList.remove('show'); }, 60);
}

// Open into whichever side has the most room. Horizontal first - the definition
// rail makes the tooltip wide, so left/right is the decision that matters - then
// clamp vertically, preferring to centre on the anchor.
function placeEntityTooltip(anchorEl, el) {
  const GAP = 12, PAD = 8;
  const a = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;

  // Measure at natural size before positioning.
  el.style.left = '0px'; el.style.top = '0px';
  el.classList.remove('flip');
  const w = el.offsetWidth, h = el.offsetHeight;

  const spaceRight = vw - a.right, spaceLeft = a.left;
  const openRight  = spaceRight >= spaceLeft;
  // The definition rail sits on the OUTER side, so it flips with the tooltip:
  // opening leftwards puts the rail left of the card too.
  el.classList.toggle('flip', !openRight);

  let x = openRight ? a.right + GAP : a.left - GAP - w;
  x = Math.max(PAD, Math.min(x, vw - w - PAD));

  // Vertically: centre on the anchor, then clamp. If the anchor is very tall or
  // the tooltip very long, fall back to whichever of above/below has more room.
  let y = a.top + a.height / 2 - h / 2;
  if (y < PAD || y + h > vh - PAD) {
    const spaceBelow = vh - a.bottom, spaceAbove = a.top;
    y = (spaceBelow >= spaceAbove) ? a.bottom + GAP - h * 0 : a.top - GAP - h;
    if (spaceBelow >= spaceAbove) y = Math.min(a.top, vh - h - PAD);
  }
  y = Math.max(PAD, Math.min(y, vh - h - PAD));

  el.style.left = Math.round(x) + 'px';
  el.style.top  = Math.round(y) + 'px';
}

// Convenience: wire hover (and long-press on touch) for one element.
function attachEntityTooltip(el, payloadOrFn) {
  if (!el) return;
  const get = () => (typeof payloadOrFn === 'function' ? payloadOrFn() : payloadOrFn);
  el.addEventListener('pointerenter', () => showEntityTooltip(el, get()));
  el.addEventListener('pointerleave', hideEntityTooltip);
  // Touch: the tooltip follows a tap-and-hold, and any scroll/lift dismisses it.
  let lp = null;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    lp = setTimeout(() => showEntityTooltip(el, get()), 380);
  });
  const clearLp = () => { if (lp) { clearTimeout(lp); lp = null; } };
  el.addEventListener('pointerup', clearLp);
  el.addEventListener('pointercancel', clearLp);
}


// ── shared placement for the OTHER tooltips ─────────────────────────────────
// The trick-tray / knack / reward tooltips keep their own markup (they carry
// buttons), but they should still obey the same rule: open into whichever side
// has the most room, horizontally and vertically. Anchors a plain fixed-position
// bubble beside an element.
function placeTipSmart(anchorEl, tip, opts = {}) {
  const GAP = opts.gap != null ? opts.gap : 10, PAD = 6;
  const a = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = tip.offsetWidth || 180, h = tip.offsetHeight || 80;

  // Prefer the side of the ANCHOR with more room. If neither side fits the
  // bubble, fall back to above/below and centre horizontally instead.
  const spaceRight = vw - a.right, spaceLeft = a.left;
  const spaceBelow = vh - a.bottom, spaceAbove = a.top;
  let x, y;
  if (Math.max(spaceRight, spaceLeft) >= w + GAP + PAD) {
    x = (spaceRight >= spaceLeft) ? a.right + GAP : a.left - GAP - w;
    y = a.top + a.height / 2 - h / 2;
  } else {
    x = a.left + a.width / 2 - w / 2;
    y = (spaceBelow >= spaceAbove) ? a.bottom + GAP : a.top - GAP - h;
  }
  tip.style.left = Math.round(Math.max(PAD, Math.min(x, vw - w - PAD))) + 'px';
  tip.style.top  = Math.round(Math.max(PAD, Math.min(y, vh - h - PAD))) + 'px';
}
