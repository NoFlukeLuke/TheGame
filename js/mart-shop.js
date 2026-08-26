// ══════════════════════════════════════════════════════════════════════════
// LETHE MART — the off-grid shop (r127). Built into the game as a full overlay.
// Routed from triggerShop() when USE_MART_SHOP. The old overlay + on-grid shops
// stay as fallbacks. Fancy features (Spotlight / Wheel / Tools / drag-to-freeze)
// are visible but WIP placeholders for now; core buying/reroll/leave is real.
// ══════════════════════════════════════════════════════════════════════════

let USE_MART_SHOP = true;
let martActive    = false;
let martCats      = [];      // e.g. ['tricks','sleights','limits'] — 3 of 4, tricks always featured
let martStock     = {};      // { tricks:[payload…], sleights:[…], limits:[…], knacks:[…] }
let martCart      = [];      // ['tricks-0', 'sleights-2', …] keys into martStock
let martRerollN   = 0;

// Bundle discount: +rate% per ADDITIONAL item (2 items = 1×rate, 3 = 2×rate, …),
// capped flat. 1 item = 0%, 2 = 5%, 3 = 10%, 4 = 15%, 5+ = 20%. The Bulk Buyer
// knack doubles the rate AND the cap (10%/item, up to 40%).
//
// The cap used to be rate × Selection Size, and the CART was capped at Selection
// Size too — so how many cards you can pick for a poker hand decided how much you
// could buy. Two unrelated things. The cart is uncapped now; only the discount
// stops growing.
function martDiscountRate() {
  return (typeof hasKnack === 'function' && hasKnack('bulk_buyer'))
    ? BAL.shop_discount.bulk_per_item : BAL.shop_discount.per_item;
}
function martDiscountCap() {
  return (typeof hasKnack === 'function' && hasKnack('bulk_buyer'))
    ? BAL.shop_discount.bulk_cap : BAL.shop_discount.cap;
}
function martDiscountPct(n) {
  return Math.max(0, Math.min(martDiscountRate() * (n - 1), martDiscountCap()));
}
// The DISCOUNT rounds down (owner's call), so the total rounds up — the store
// never gives away a fractional credit. Both figures come from here so the
// receipt, the tile prices and the actual charge can never disagree.
function martCartBase(cart) {
  return (cart || martCart).reduce((s,key) => { const [cat,i] = key.split('-'); return s + (martStock[cat]?.[+i]?.price || 0); }, 0);
}
function martCartTotals(cart) {
  const list = cart || martCart;
  const base = martCartBase(list);
  const pct  = martDiscountPct(list.length);
  const off  = Math.floor(base * pct / 100);
  return { base, pct, off, total: base - off };
}

// ── rarity-weighted picking (same odds as sleights), duplicates ALLOWED ──
const MART_PER_SHELF = 3;    // owner's spec: 3 Tricks, 3 Knacks, 3 Sleights (Limits matches)
const MART_TIERS   = ['common','rare','epic','legendary','mythic'];
const MART_WEIGHTS = [59,28,10,2,1];
function martRollTier() { const r = Math.random()*100; let c=0; for (let i=0;i<MART_WEIGHTS.length;i++){ c+=MART_WEIGHTS[i]; if (r<c) return MART_TIERS[i]; } return 'common'; }
function martPick(pool, tierKey, count) {
  const out = []; if (!pool || !pool.length) return out;
  for (let n=0; n<count; n++) {
    let tier = martRollTier(), cands = pool.filter(x => (x[tierKey]||'common') === tier);
    for (let d = MART_TIERS.indexOf(tier); d>=0 && !cands.length; d--) cands = pool.filter(x => (x[tierKey]||'common') === MART_TIERS[d]);
    if (!cands.length) cands = pool;
    out.push(cands[Math.floor(Math.random()*cands.length)]);   // duplicates allowed
  }
  return out;
}

// ── payload builders (label, rarity, price, buy fn) ──
function martTrickPayload(t){ return { type:'trick', ref:t, label:t.name, desc:t.desc, rarity:t.tier||'common', emoji:trickEmoji(t),
  price:SHOP_TRICK_PRICES[t.tier]||8, buy:()=>injectTrickAfterReward(t) }; }
function martSleightPayload(s){ return { type:'sleight', ref:s, label:s.name, desc:s.desc, rarity:s.rarity||'common', emoji:s.emoji||'🃏',
  uses:(s.durability==='infinite'||s.durability==null)?'∞':`${s.durability}×`, suit:ACTIVE_SUITS[Math.floor(Math.random()*ACTIVE_SUITS.length)], rank:ACTIVE_RANKS[Math.floor(Math.random()*ACTIVE_RANKS.length)],
  price:SHOP_SLEIGHT_PRICES[s.rarity]||12, buy:()=>grantSleight(s) }; }
function martKnackPayload(k){ return { type:'knack', ref:k, label:k.name, desc:k.desc, rarity:k.rarity||'common', emoji:k.emoji,
  price:SHOP_KNACK_PRICE, buy:()=>{ acquiredKnacks.push({...k}); if (typeof updateKnackList==='function') updateKnackList(); } }; }
function martLimitStock(count){
  const elig = LIMITS_DEF.filter(d => limits[d.id].current < limits[d.id].max);
  return shuffle(elig).slice(0, count).map(d => {
    const cur = limits[d.id].current, next = Math.min(limits[d.id].max, cur + (d.step||1));
    return { type:'limit', ref:d, id:d.id, label:d.label, icon:d.icon, desc:d.desc, rarity:'common', cur, next, max:limits[d.id].max,
      price:shopLimitPrice(d), buy:()=>{ incrementLimit(d.id); if (typeof onLimitChanged==='function') onLimitChanged(d.id); } };
  });
}

// The Mart's stock runs on a POSITIONAL seeded stream keyed by shop-visit index,
// so the Nth shop of a seed always offers the same catalog. Rerolls deliberately
// sit OUTSIDE it (see martReroll) — a reroll is a player action, and rerolling
// into the same shelves would make the button pointless.
function buildMartStock() {
  // Keyed by (visit, reroll count): a reroll is deterministic for a seed but does
  // NOT advance the visit index, so how many times you reroll shop #1 cannot
  // change what shop #2 stocks.
  return withSeededRng(_buildMartStock, 'shop', shopVisitIndex, martRerollN);
}
function _buildMartStock() {
  // All four shelves, every visit, three items each (owner's spec: 3 Tricks,
  // 3 Knacks, 3 Sleights — Limits keeps its shelf on the same count). The old
  // "3 categories out of 4, picked at random" is gone: it made a shelf you were
  // saving up for simply not exist, and it broke pinning, whose keys are
  // <category>-<index>.
  martCats = ['tricks', 'sleights', 'knacks', 'limits'];
  martStock = {};
  // Survival has no reward grid, so reward-grid-only entities are filtered out here
  // too — otherwise the Mart could sell a item that does nothing in this mode.
  const _ok = p => typeof survivalEntityBanned !== 'function' || !survivalEntityBanned(p.id);
  // …and never offer something you already have. The legacy shop always filtered
  // owned Tricks/Knacks and granted Sleights out of its pools; the Mart replaced
  // it without carrying that over, so it would happily sell you a second copy of
  // a Knack — and a Knack is a boolean (hasKnack), so the second copy does
  // literally nothing. Same story for a duplicate Trick.
  const ownedTricks = new Set((acquiredTricks||[]).map(t => t.id));
  const ownedKnacks = new Set((acquiredKnacks||[]).map(k => k.id));
  const ownedSleights = (typeof _grantedSleightSet === 'function') ? _grantedSleightSet()
                      : (typeof grantedSleightIds !== 'undefined' ? grantedSleightIds : new Set());
  martStock.tricks   = martPick(TRICK_POOL.filter(t => _ok(t) && !ownedTricks.has(t.id)), 'tier', MART_PER_SHELF).map(martTrickPayload);
  martStock.sleights = martPick(SLEIGHT_POOL.filter(j => _ok(j) && sleightOfferable(j) && !ownedSleights.has(j.id)), 'rarity', MART_PER_SHELF).map(martSleightPayload);
  martStock.knacks   = martPick(KNACK_POOL.filter(k => _ok(k) && !ownedKnacks.has(k.id)), 'rarity', MART_PER_SHELF).map(martKnackPayload);
  martStock.limits   = martLimitStock(MART_PER_SHELF);
  // A category you have exhausted (every Knack owned, every Limit maxed) filters
  // down to nothing, and an empty shelf is worse than no shelf.
  martCats = martCats.filter(c => (martStock[c] || []).length);
  martApplyPins();
}

// ── PINNING ────────────────────────────────────────────────────────────────
// Replaces the WIP "Freezer". Press PIN, then tap any items you want held; they
// survive a reroll AND leaving and re-entering the shop. The pinned PAYLOAD is
// stored, not just its key, because a rebuild replaces every object in martStock.
let martPinMode = false;
let martPins    = {};        // { 'tricks-0': payload, … } — persists across visits
function martPinCount() { return Object.keys(martPins).length; }
function martIsPinned(key) { return !!martPins[key]; }
function martTogglePin(key) {
  const [cat,i] = key.split('-'); const p = martStock[cat]?.[+i];
  if (!p) return;
  if (martPins[key]) { delete martPins[key]; }
  else if (p._sold) { showMessage('Already purchased', 'var(--cream-dim)'); return; }
  else { martPins[key] = p; }
  renderMart();
}
// Put pinned payloads back into the freshly built stock at the slot they were
// pinned in. Safe because every shelf now always exists and always has the same
// number of slots.
function martApplyPins() {
  Object.keys(martPins).forEach(key => {
    const [cat,i] = key.split('-');
    if (martStock[cat] && martStock[cat][+i]) martStock[cat][+i] = martPins[key];
    else delete martPins[key];        // shelf gone (exhausted) — the pin can't be honoured
  });
}
function martSetPinModeQuiet(on) {
  martPinMode = !!on;
  document.getElementById('mart-overlay')?.classList.toggle('pin-mode', martPinMode);
}
function martSetPinMode(on) {
  martPinMode = !!on;
  document.getElementById('mart-overlay')?.classList.toggle('pin-mode', martPinMode);
  renderMart();
}

// ── open / close ──
function ensureMartOverlay() {
  let el = document.getElementById('mart-overlay');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'mart-overlay';
  el.innerHTML = `<div class="mart-grid">
    <div class="mart-loadout" id="mart-loadout"></div>
    <div class="mart-main" id="mart-main"></div>
    <div class="mart-checkout" id="mart-checkout"></div>
  </div>`;
  document.body.appendChild(el);
  // limit tooltip element
  const tt = document.createElement('div'); tt.id = 'mart-ltip'; tt.className = 'm-ltip'; tt.style.position='fixed';
  el.appendChild(tt);
  return el;
}
// Entering the Mart is a channel change (the shop is CH 02 on the cabinet's CRT).
// The overlay is revealed at the collapse, hidden inside the flash.
function openMart() {
  martActive = true; martCart = []; martRerollN = 0;
  martSetPinModeQuiet(false);             // pins persist across visits; pin MODE does not
  shopVisitIndex++;                       // this is shop visit N for the run's seed
  gameTimerPaused = true;
  try { sfxShopOpen && sfxShopOpen(); } catch(e){}
  buildMartStock();
  const el = ensureMartOverlay();
  renderMart();
  channelChange(() => { el.classList.add('show'); }, { channel: 'CH 02 · MART' })
    .then(() => { startMartFloat(); martMeasureDrawer(); });   // measurable only once shown
}
function closeMart() {
  if (!martActive) return;
  martActive = false;
  stopMartFloat();
  channelChange(() => {
    document.getElementById('mart-overlay')?.classList.remove('show');
    gameTimerPaused = false;
    if (shopFromNodeFlow) { shopFromNodeFlow = false; drainLevelUpQueue(); }
    else if (typeof survivalActive === 'function' && survivalActive() && !bossActive) {
      if (typeof survivalShopFromPick !== 'undefined' && survivalShopFromPick) {
        // Opened from the PICK screen: the pick is still up behind the Mart and owns
        // the flow (the round deals when you choose). Stay paused, just refresh prices.
        survivalShopFromPick = false;
        gameTimerPaused = true;
        if (typeof survivalUpdateRerollBtn === 'function') survivalUpdateRerollBtn();
      } else {
        // Mid-round visit: triggerShop() nulled the round interval, so restart it
        // (closeMart only unpauses the flag).
        if (typeof render === 'function') render();
        startRoundTimer();
      }
    }
    else if (typeof render === 'function') render();
  }, { channel: 'CH 01' });
}

// ── render ──
const martRar = p => (MART_TIERS.includes(p.rarity) ? p.rarity : 'common');

// The catalog speaks the REWARD GRID's visual language (r170). Before this the
// Mart had its own private set of tile designs, so the same Trick looked like
// one thing on the reward grid and a different thing in the shop. These tiles
// now reuse the reward grid's own classes — .reward-cell.entity plus the
// entity-<type> and rar-<rarity> modifiers — which is what carries the neon
// rarity border, the scanline overlay, the top glare and the knack diamond.
//
// It is NOT buildRewardTileInner(): the reward grid deliberately hides a Trick's
// emoji behind a ✦ placeholder (you are picking a mystery off a board), whereas
// in a shop you are choosing what to buy and need to see the thing. Same shell,
// different contents.
function martEntityInner(p) {
  if (p.type === 'knack')
    return `<div class="rwd-diamond"><span class="rwd-diamond-emoji">${p.emoji || '♛'}</span></div>`
         + `<div class="rwd-name">${p.label}</div>`;
  if (p.type === 'trick')
    return `<div class="rwd-glyph">✦</div><div class="rwd-art">${p.emoji}</div><div class="rwd-name">${p.label}</div>`;
  if (p.type === 'sleight')
    return `<div class="rwd-tab">▶</div><div class="rwd-art">${p.emoji}</div><div class="rwd-name">${p.label}</div>`
         + `<div class="rwd-uses">${p.uses}</div>`;
  return `<div class="reward-icon">${p.icon || '▲'}</div><div class="rwd-name">${p.label}</div>`;
}

// Can this item still be added? Measured against what the cart has ALREADY
// committed, and against the total the cart WOULD cost with this item in it —
// so the discount an extra item unlocks counts in its favour rather than the
// tile showing red for a price you can actually afford.
function martCantAfford(p, key) {
  if (martCart.includes(key)) return false;
  const withIt = martCartTotals(martCart.concat(key)).total;
  return coins < withIt;
}
function martTileHTML(p, key) {
  const inCart = martCart.includes(key);
  const cant = martCantAfford(p, key);
  // A star + pulse if this entity is on the filed requisition (Builds screen).
  const wanted = (typeof isRequisitioned === 'function') && p.ref && isRequisitioned(p.ref.id);
  const pinned = martIsPinned(key);
  const cls = ['m-item', 'm-'+p.type, 'r-'+martRar(p), inCart?'in-cart':'', p._sold?'sold':'',
               pinned?'pinned':'', cant&&!inCart&&!p._sold?'cant-afford':'', wanted?'requisitioned':''].filter(Boolean).join(' ');
  const price = `<div class="price ${cant&&!inCart?'cant':''}">${p._sold?'✓':'💰'+p.price}</div>`;
  const tick  = `<div class="m-tick">✓</div>`;   // shown by .in-cart — see mart.css
  const pin   = `<div class="m-pin">📌</div>`;   // shown by .pinned
  let inner;
  if (p.type === 'limit') {
    // A Limit is a numeric upgrade, not a collectible, so it keeps its own wide
    // bar shape — but on the reward grid's palette rather than its own.
    inner = `<div class="limit reward-cell entity rar-common"><span class="ico">▲</span>`
          + `<div class="body"><span class="lname">${p.label}</span><span class="lprog">${p.cur} → ${p.next}</span></div></div>`;
  } else {
    inner = `<div class="reward-cell entity entity-${p.type} rar-${martRar(p)}">${martEntityInner(p)}</div>`;
  }
  return `<div class="${cls}" data-key="${key}">${inner}${price}${tick}${pin}</div>`;
}

// Each shelf is its own colour-coded panel (r170). They used to be four barely
// distinguishable dark rectangles on a dark page; --sc drives the header, the
// rule under it, the left edge and the panel wash, so the categories separate at
// a glance instead of having to be read.
const MART_SEC_META = {
  tricks:   { label:'TRICKS',         glyph:'✦', sc:'var(--phosphor)', note:'scoring buffs · side tray' },
  sleights: { label:'SLEIGHTS',       glyph:'▶', sc:'var(--c-cyan)',   note:'cards that live in your deck' },
  knacks:   { label:'KNACKS',         glyph:'◆', sc:'var(--c-yellow)', note:'permanent rule changes' },
  limits:   { label:'LIMIT UPGRADES', glyph:'▲', sc:'var(--c-mint)',   note:'raise a cap for the run' },
};
function martSectionHTML(cat) {
  const stock = martStock[cat] || [];
  const meta = MART_SEC_META[cat];
  const items = stock.map((p,i) => martTileHTML(p, `${cat}-${i}`)).join('');
  const left = stock.filter(p => !p._sold).length;
  // Tricks are the one category with a hard cap you can already be sitting on,
  // and buying past it ambushes you with a replace-picker. Say so on the shelf.
  let notice = '';
  if (cat === 'tricks') {
    const held = (typeof trickTrayMode !== 'undefined' && trickTrayMode ? (trickTray||[]) : (acquiredTricks||[])).length;
    const cap  = (typeof trickCapacity === 'function') ? trickCapacity() : 5;
    if (held >= cap) notice = `<div class="m-sec-notice">⚠ TRICK ALLOCATION FULL — ${held}/${cap} · a purchase requires a replacement</div>`;
  }
  return `<div class="m-sec m-sec-${cat}" style="--sc:${meta.sc}">
    <div class="m-sh"><span class="m-sh-l"><i class="m-sh-g">${meta.glyph}</i>${meta.label}</span>`
    + `<span class="m-sh-note">${meta.note}</span>`
    + `<span class="slots">${left} left</span></div>${notice}
    <div class="m-rowc" data-cat="${cat}">${items}</div></div>`;
}

function renderMart() {
  syncDiscoveredFromOwned();
  renderMartLoadout();
  renderMartMain();
  renderMartCheckout();
  bindMartItems();
  // Names must never clip on a tile — hyphenate/shrink to fit (js/fit-text.js).
  // The selector follows the reward grid's markup now that the tiles do.
  fitEntityNames(document.getElementById('mart-main'), '.m-item .rwd-name', { maxLines: 3 });
  fitEntityNames(document.getElementById('mart-main'), '.m-item .lname', { maxLines: 2 });
}

function renderMartLoadout() {
  const el = document.getElementById('mart-loadout'); if (!el) return;
  const rc = r => 'var(--c-'+({common:'mint',rare:'cyan',epic:'purple',legendary:'yellow',mythic:'magenta'}[r]||'mint')+')';
  const knacks = (acquiredKnacks||[]).map(k => `<div class="mini-knack" style="--rc:${rc(k.rarity||'common')}"><span>${k.emoji||'♛'}</span></div>`).join('') || '<span class="m-empty">none yet</span>';
  const sleights = (typeof ownedSleightInstances==='function' ? ownedSleightInstances() : []).map(inst => {
    const d = inst.def; return `<div class="mini-sleight r-${MART_TIERS.includes(d.rarity)?d.rarity:'common'}"><span class="c">${d.emoji||'🃏'}</span></div>`;
  }).join('') || '<span class="m-empty">none in deck</span>';
  const trickList = (typeof trickTrayMode!=='undefined' && trickTrayMode) ? (trickTray||[]) : (acquiredTricks||[]);
  const tricks = trickList.map(t => `<div class="mini-trick r-${MART_TIERS.includes(t.tier)?t.tier:'common'}"><span class="a">${trickEmoji(t)}</span></div>`).join('') || '<span class="m-empty">none yet</span>';
  const trickCap = (typeof trickCapacity==='function') ? trickCapacity() : 5;
  // Current caps, so you can see what you're upgrading without leaving the shop —
  // and so a bought Limit has somewhere to fly to at checkout.
  const limitChips = LIMITS_DEF.map(d => {
    const l = limits[d.id], maxed = l.current >= l.max;
    return `<span class="m-lim${maxed?' max':''}" title="${d.label}: ${l.current}${d.hideMax?'':' / '+l.max}">${d.icon}<b>${l.current}</b></span>`;
  }).join('');
  el.innerHTML = `
    <div class="m-panel p-knacks"><div class="m-pt"><span>Knacks</span><span class="cnt">${(acquiredKnacks||[]).length}</span></div><div class="m-row">${knacks}</div></div>
    <div class="m-panel p-sleights"><div class="m-pt"><span>Sleights · in deck</span><span class="cnt">${(typeof ownedSleightInstances==='function'?ownedSleightInstances().length:0)}</span></div><div class="m-row">${sleights}</div></div>
    <div class="m-panel p-tricks"><div class="m-pt"><span>Tricks</span><span class="cnt">${trickList.length} / ${trickCap}</span></div><div class="m-row">${tricks}</div></div>
    <div class="m-panel p-limits"><div class="m-pt"><span>Limits</span></div><div class="m-row m-limrow">${limitChips}</div></div>
    <div class="m-settings">
      <div class="m-schip" data-act="stats">📊 Stats</div><div class="m-schip" data-act="deck">🃏 Deck</div>
      <div class="m-schip" data-act="time">⏱ Time</div><div class="m-schip" data-act="wip">⚙ More·WIP</div>
    </div>`;
  // Stats / Deck work in here now: their overlays sit at z-index 260, above the Mart's 250,
  // and closeInfoOverlay() skips resumeGame() while a takeover screen owns the clock — so
  // closing one returns to the shop instead of starting the round behind it.
  el.querySelectorAll('.m-schip').forEach(chip => chip.onclick = () => {
    const a = chip.dataset.act;
    if      (a==='stats' && typeof showStats==='function') showStats();
    else if (a==='deck'  && typeof showDeck==='function')  showDeck();
    else if (a==='time'  && typeof toggleTimePopup==='function') toggleTimePopup();
    else showMessage('That panel is WIP in the shop', 'var(--cream-dim)');
  });
}

function renderMartMain() {
  const el = document.getElementById('mart-main'); if (!el) return;
  // The top strip used to hold Spotlight (WIP, inert), SPIN and the Freezer
  // (WIP, inert) — two thirds of the most valuable space on the screen doing
  // nothing. It is now the PIN control, which is real, and SPIN has moved down
  // into Tools where the other services live.
  const pinned = martPinCount();
  const feat = `<div class="m-feat">
    <div class="m-pinbar ${martPinMode?'on':''}" id="mart-pin-toggle">
      <span class="pb-ico">📌</span>
      <span class="pb-body">
        <span class="pb-title">${martPinMode ? 'PIN MODE — TAP ITEMS TO HOLD' : 'PIN ITEMS'}</span>
        <span class="pb-sub">${martPinMode ? 'tap PIN again when you are done' : 'held through rerolls and between visits'}</span>
      </span>
      <span class="pb-count">${pinned ? pinned + ' held' : ''}</span>
    </div>
  </div>`;
  const sections = martCats.map(martSectionHTML).join('');
  const canSpin = coins >= BAL.wheel.cost;
  const tools = `<div class="m-sec m-sec-tools" style="--sc:var(--c-coral)">
    <div class="m-sh"><span class="m-sh-l"><i class="m-sh-g">🛠</i>TOOLS</span><span class="m-sh-note">services, not stock</span></div>
    <div class="m-rowc">
    <div class="m-tool m-tool-spin ${canSpin?'':'cant'}" id="mart-spin"><div class="tt"><span>◎ Spin the Wheel</span><span>💰${BAL.wheel.cost}</span></div>
      <div class="td"><span class="m-wheel"></span>Win any item · 1-in-10 jackpot.</div></div>
    <div class="m-tool"><div class="tt"><span>⚡ Recharge Bay</span><span>WIP</span></div><div class="td">Recharge sleights (built later).</div></div>
    <div class="m-tool"><div class="tt"><span>✦ Trick Tinker</span><span>WIP</span></div><div class="td">Improve a Trick you own (built later).</div></div>
  </div></div>`;
  el.innerHTML = feat + sections + tools;
  document.getElementById('mart-pin-toggle').onclick = () => martSetPinMode(!martPinMode);
}

function renderMartCheckout() {
  const el = document.getElementById('mart-checkout'); if (!el) return;
  const lines = martCart.map(key => {
    const [cat,i] = key.split('-'); const p = martStock[cat][+i];
    return `<div class="m-rline" data-key="${key}"><span>${p.emoji||p.icon||'•'} ${p.label}</span><span>💰${p.price} <span class="x">✕</span></span></div>`;
  }).join('') || '';
  // Two hints, one shown per input type (css/mart.css): there is no drag on
  // touch, so the drop zone must not promise one.
  const drop = `<div class="m-drop" id="mart-drop"><span class="m-drop-tap">tap an item to add it</span>`
             + `<span class="m-drop-drag">click an item to add it<br><small>or drag one here</small></span></div>`;
  const { base, pct, off, total } = martCartTotals();
  const afford = coins >= total && martCart.length>0;
  const maxR = limits.reroll ? limits.reroll.current : 3;
  const rerollsLeft = Math.max(0, maxR - martRerollN);
  const rerollCost = 8 + martRerollN*2;
  el.innerHTML = `
    <div class="m-brand">LETHE MART<small>AUTHORIZED TERMINAL</small></div>
    <div class="m-wallet">💰 ${coins}</div>
    <div class="m-ch" id="mart-cart-handle"><span>🧾 CHECKOUT</span><small>${martCart.length} item${martCart.length!==1?'s':''}</small><span class="m-ch-wallet">💰 ${coins}</span></div>
    <div class="m-rcpt">${lines}${drop}</div>
    <div class="m-sum">
      <div class="srow"><span>subtotal</span><span>💰${base}</span></div>
      <div class="srow disc"><span>bundle −${pct}%${pct>=martDiscountCap()?' (max)':` · +${martDiscountRate()}% per extra item`}</span><span>−💰${off}</span></div>
      <div class="grand"><span>total</span><span>${pct>0?`<s>💰${base}</s> `:''}<b>💰${total}</b></span></div>
      <div class="m-buy ${afford?'':'disabled'}" id="mart-buy">CHECKOUT</div>
      <div class="m-foot">
        <div class="m-fbtn ${rerollsLeft?'':'spent'}" id="mart-reroll">🎲 Reroll 💰${rerollCost}<br><small>${rerollsLeft} left</small></div>
        <div class="m-fbtn leave" id="mart-leave">⏻ Leave</div>
      </div>
    </div>`;
  el.querySelectorAll('.m-rline').forEach(l => l.onclick = () => martToggleCart(l.dataset.key));
  el.querySelector('#mart-buy').onclick = martCheckout;
  el.querySelector('#mart-reroll').onclick = martReroll;
  el.querySelector('#mart-leave').onclick = closeMart;
  // The narrow layout turns this panel into a bottom drawer whose header is the
  // handle. Harmless on desktop, where the receipt is always open anyway.
  el.querySelector('#mart-cart-handle').onclick = () => {
    document.getElementById('mart-overlay')?.classList.toggle('cart-open');
    martMeasureDrawer();
  };
  martMeasureDrawer();
}

// The drawer is position:fixed, so the catalog behind it has to be told how much
// of the bottom of the screen is covered or its last shelf sits under the drawer
// and cannot be scrolled into view.
function martMeasureDrawer() {
  const ov = document.getElementById('mart-overlay');
  const co = document.getElementById('mart-checkout');
  if (!ov || !co) return;
  requestAnimationFrame(() => {
    ov.style.setProperty('--mart-drawer', Math.round(co.getBoundingClientRect().height) + 'px');
  });
}

function bindMartItems() {
  const main = document.getElementById('mart-main'); if (!main) return;
  const spin = document.getElementById('mart-spin');
  if (spin) spin.onclick = openWheel;
  // EVERY tile gets a tooltip now. Previously only Limits did, which meant three
  // of the four catalog categories — nearly everything you browse — had none.
  main.querySelectorAll('.m-item').forEach(it => {
    const key = it.dataset.key;
    const [cat,i] = key.split('-'); const p = martStock[cat][+i];
    if (!p) return;
    attachMartTileGesture(it, key, p);
  });
}

// ── one gesture handler per tile: tap / hover / long-press / drag ────────────
// This used to be TWO overlapping systems — an `onclick` that added to the cart,
// plus attachEntityTooltip()'s own pointer listeners, plus a drag handler — all
// on the same element, each unaware of the others. That is what made the shop
// feel finicky. Now one handler owns the whole gesture and decides at pointerup
// what it was.
//
// MOUSE: hover → tooltip. click → toggle cart. drag past the slop → ghost to the
// checkout. `preventDefault` on pointerdown is what stops a drag from selecting
// the tile's text instead of moving the card.
//
// TOUCH: tap → toggle cart. press-and-hold → tooltip. Dragging is deliberately
// NOT wired on touch: the catalog scrolls, so the browser claims any touch that
// moves and fires pointercancel at us — the old drag could not work on a phone
// and silently did nothing. Forcing it would need touch-action:none on every
// tile, which costs you the ability to scroll the catalog by swiping a tile.
// Tap is one gesture and always works, so that is the route on touch.
const MART_DRAG_SLOP = 6;
const MART_LONGPRESS_MS = 420;

function attachMartTileGesture(tile, key, p) {
  const payload = () => martTooltipPayload(p);

  // Hover tooltip — mouse only. pointerenter fires for touch too, which used to
  // pop the tooltip on every tap.
  tile.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') showEntityTooltip(tile, payload()); });
  tile.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') hideEntityTooltip(); });

  tile.addEventListener('pointerdown', e => {
    if (martCheckingOut || p._sold) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const touch = e.pointerType === 'touch';
    // Mouse: kill the native text selection a drag would otherwise start.
    if (!touch) e.preventDefault();
    else hideEntityTooltip();          // a fresh touch dismisses a previous bubble

    const st = { x: e.clientX, y: e.clientY, id: e.pointerId, ghost: null, moved: false, held: false, ox: 0, oy: 0 };
    let lp = null;
    if (touch) lp = setTimeout(() => { st.held = true; showEntityTooltip(tile, payload()); }, MART_LONGPRESS_MS);
    const clearLp = () => { if (lp) { clearTimeout(lp); lp = null; } };

    // Listen on the DOCUMENT, not the tile: once the pointer leaves the tile the
    // tile stops receiving pointermove, so tile-level listeners never see the
    // rest of the gesture.
    const onMove = ev => {
      if (ev.pointerId !== st.id) return;
      const dx = ev.clientX - st.x, dy = ev.clientY - st.y;
      if (!st.moved && Math.hypot(dx, dy) < MART_DRAG_SLOP) return;
      clearLp();                              // moved — this is not a long-press
      if (touch) return;                      // touch never drags (see note above)
      if (!st.moved) {
        st.moved = true;
        const r = tile.getBoundingClientRect();
        const g = tile.cloneNode(true);
        g.classList.add('m-dragging');
        g.style.cssText += `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;
          margin:0;z-index:420;pointer-events:none;--fx:0px;--fy:0px;--fr:0deg;--fs:1;`;
        document.body.appendChild(g);
        st.ghost = g; st.ox = r.left; st.oy = r.top;
        tile.classList.add('m-drag-src');
        hideEntityTooltip();
        document.getElementById('mart-checkout')?.classList.add('m-drop-armed');
      }
      st.ghost.style.left = (st.ox + dx) + 'px';
      st.ghost.style.top  = (st.oy + dy) + 'px';
      document.getElementById('mart-checkout')?.classList
        .toggle('m-drop-hot', martOverCheckout(ev.clientX, ev.clientY));
    };

    const finish = ev => {
      if (ev.pointerId !== st.id) return;
      clearLp();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', onCancel);
      tile.classList.remove('m-drag-src');
      document.getElementById('mart-checkout')?.classList.remove('m-drop-armed', 'm-drop-hot');
      if (st.ghost) st.ghost.remove();

      if (st.moved) {                                     // a drag
        if (martOverCheckout(ev.clientX, ev.clientY)) {
          if (!martCart.includes(key)) martToggleCart(key);
          else showMessage('Already in the cart', 'var(--cream-dim)');
        }
        return;
      }
      if (st.held) return;                                // a long-press: tooltip only
      // A tap / click. Confirm the pointer actually lifted on this tile — the
      // browser's own click event would not fire if it had not, and we are
      // standing in for that click.
      const r = tile.getBoundingClientRect();
      if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom)
        martToggleCart(key);
    };
    // A cancelled pointer (the browser took the gesture for a scroll) must tear
    // down exactly like a lift, but must never count as a tap.
    const onCancel = ev => { st.moved = true; finish(ev); };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', onCancel);
  });
}
function martOverCheckout(x, y) {
  const co = document.getElementById('mart-checkout');
  if (!co) return false;
  const r = co.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

// Shape a catalog payload for the shared tooltip. Limits keep their "now → next"
// readout as a meta chip, since that's the number that matters when buying one.
function martTooltipPayload(p) {
  const meta = [];
  if (p.type === 'limit') { meta.push(`now ${p.cur} → ${p.next}`, `max ${p.max}`); }
  return {
    label: p.label, desc: p.desc, rarity: p.rarity, type: p.type,
    price: p.price, uses: p.type === 'sleight' ? p.uses : null, meta,
  };
}
function placeMartTip(e, tt) {
  const pad=14, w=tt.offsetWidth, h=tt.offsetHeight;
  let x=e.clientX+pad, y=e.clientY+pad;
  if (x+w>window.innerWidth-8) x=e.clientX-w-pad;
  if (y+h>window.innerHeight-8) y=e.clientY-h-pad;
  tt.style.left=Math.max(8,x)+'px'; tt.style.top=Math.max(8,y)+'px';
}

// ── cart ──
function martToggleCart(key) {
  if (martPinMode) { martTogglePin(key); return; }
  const [cat,i] = key.split('-'); const p = martStock[cat]?.[+i];
  if (!p || p._sold) return;
  const at = martCart.indexOf(key);
  if (at >= 0) martCart.splice(at,1);
  else {
    // No cart cap. It used to stop at your Selection Size (3 at run start) — how
    // many CARDS you can pick for a poker hand, which has nothing to do with
    // shopping and meant you could never buy a fourth thing in one visit. Only
    // the DISCOUNT stops growing now; the cart itself is limited by your wallet.
    const after = martCartTotals(martCart.concat(key)).total;
    if (coins < after) { martRejectPurchase(key); return; }
    martCart.push(key);
  }
  renderMart();
}

// Not enough credits: say so loudly and do nothing. Nothing is charged and
// nothing enters the cart — the wallet and the offending price both pop, so the
// refusal points at the two numbers that caused it.
function martRejectPurchase(key) {
  try { sfxRewardBad && sfxRewardBad(); } catch(e){}
  const pop = el => { if (!el) return; el.classList.remove('m-deny'); void el.offsetWidth; el.classList.add('m-deny');
                      setTimeout(() => el.classList.remove('m-deny'), 620); };
  pop(document.querySelector('#mart-checkout .m-wallet'));
  pop(document.querySelector('#mart-checkout .m-ch-wallet'));
  if (key) pop(document.querySelector(`#mart-main .m-item[data-key="${key}"] .price`));
  showMessage('Insufficient credits', 'var(--red)');
}

// Where a bought item lands in the loadout column — the same idea as the reward
// grid's rewardTargetEl, pointed at the Mart's own panels.
function martTargetEl(p) {
  const q = sel => document.querySelector('#mart-loadout ' + sel);
  switch (p.type) {
    case 'trick':   return q('.p-tricks');
    case 'sleight': return q('.p-sleights');
    case 'knack':   return q('.p-knacks');
    case 'limit':   return q('.p-limits');
  }
  return q('.p-tricks');
}

// Fly a clone of the tile to its loadout panel. A CLONE, positioned fixed on the
// body, because renderMart() rebuilds the catalog and would otherwise yank the
// element out mid-flight.
function flyMartTile(tileEl, p) {
  const target = martTargetEl(p);
  if (!tileEl || !target) return Promise.resolve();
  const a = tileEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const ghost = tileEl.cloneNode(true);
  ghost.classList.add('m-ghost');
  ghost.style.cssText += `position:fixed;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;
    margin:0;z-index:400;pointer-events:none;--fx:0px;--fy:0px;--fr:0deg;--fs:1;`;
  document.body.appendChild(ghost);
  tileEl.style.visibility = 'hidden';
  const dx = (b.left + b.width/2) - (a.left + a.width/2);
  const dy = (b.top  + b.height/2) - (a.top  + a.height/2);
  return ghost.animate([
    { transform:'translate(0,0) scale(1)', opacity:1 },
    { transform:`translate(${dx*0.55}px, ${dy*0.55}px) scale(0.6)`, opacity:1, offset:0.6 },
    { transform:`translate(${dx}px, ${dy}px) scale(0.12)`, opacity:0 },
  ], { duration: 400, easing:'cubic-bezier(0.5,0,0.85,1)', fill:'forwards' }).finished
    .then(() => {
      ghost.remove();
      target.classList.remove('m-landed'); void target.offsetWidth; target.classList.add('m-landed');
      setTimeout(() => target.classList.remove('m-landed'), 520);
      try { sfxRewardGood && sfxRewardGood(); } catch(e){}
    });
}

let martCheckingOut = false;
async function martCheckout() {
  if (!martCart.length || martCheckingOut) return;
  // The discount is applied ONCE, to the whole cart — not per item as it lands.
  // Cleaner arithmetic (one rounding, on the total) and it matches the receipt
  // the player just read.
  const { total } = martCartTotals();
  if (coins < total) { martRejectPurchase(null); return; }
  martCheckingOut = true;
  coins -= total; updateCoinsUI();

  // One at a time, each flying to where it actually goes — the reward grid's
  // resolve reads as "the board hands you your winnings", and checkout should
  // read the same way. The buy fires as the item lands, so the loadout panel
  // updates on impact.
  const bought = martCart.slice();
  let refund = 0;
  for (const key of bought) {
    const [cat,i] = key.split('-');
    const p = martStock[cat][+i];
    if (!p || p._sold) continue;
    const tile = document.querySelector(`#mart-main .m-item[data-key="${key}"]`);
    await flyMartTile(tile, p);
    // A grant that throws used to be logged to the console and forgotten — you
    // had paid and received nothing, silently. Refund that item's share instead.
    let ok = true;
    if (typeof p.buy === 'function') { try { p.buy(); } catch(e){ ok = false; console.error('[MART] buy failed', e); } }
    if (!ok) { refund += p.price; showMessage(`${p.label} unavailable — refunded`, 'var(--red)'); continue; }
    p._sold = true;
    delete martPins[key];                      // a bought item no longer needs holding
    renderMartLoadout();                       // panel reflects the new item immediately
    await new Promise(r => setTimeout(r, 90)); // beat between items
  }
  if (refund) { coins += refund; updateCoinsUI(); }

  showMessage(`Bought ${bought.length - (refund?1:0)} — 💰${total - refund}`, 'var(--gold)');
  martCart = [];
  martCheckingOut = false;
  renderMart();
  // Checking out no longer ends the visit. With the cart uncapped you may well
  // want a second basket, and being ejected the moment you buy anything was the
  // other half of the "you can only buy three things" problem.
  showMessage('Still open — press Leave when you are done', 'var(--cream-dim)');
}
function martReroll() {
  if (martCheckingOut) return;
  const maxR = limits.reroll ? limits.reroll.current : 3;
  if (martRerollN >= maxR) { showMessage('No rerolls left this visit', 'var(--red)'); return; }
  const cost = 8 + martRerollN*2;
  if (coins < cost) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= cost; updateCoinsUI(); martRerollN++;
  const sold = {}; Object.keys(martStock).forEach(cat => martStock[cat].forEach((p,i)=>{ if(p._sold) sold[`${cat}-${i}`]=p; }));
  buildMartStock();                                   // re-applies pins itself
  Object.keys(sold).forEach(key => { const [cat,i]=key.split('-'); if (martStock[cat]) martStock[cat][+i]=sold[key]; });
  martCart = martCart.filter(k => { const [cat,i]=k.split('-'); return martStock[cat] && martStock[cat][+i] && !martStock[cat][+i]._sold; });
  renderMart();
}

// ── slow, slight float on every shop item — shared driver, see js/float-anim.js.
// Frozen and sold tiles hold still (a frozen item stopping its drift is the tell).
const MART_FLOAT_SEL = '#mart-overlay .m-item';
function startMartFloat() { startFloat('mart', MART_FLOAT_SEL, el => el.classList.contains('frozen') || el.classList.contains('sold')); }
function stopMartFloat()  { stopFloat('mart'); clearFloat(MART_FLOAT_SEL); }
