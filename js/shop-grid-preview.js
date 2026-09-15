// ════════════════════════════════════════════════════════════════════════════
// SHOP-ON-GRID (r126) - the real shop, played on the board like the reward grid.
// ────────────────────────────────────────────────────────────────────────────
// 4 rows × 4 slots: row0 Knacks · row1 Tricks · row2 Sleights · row3 Limit upgrades.
// Select a CONNECTED group of items and BUY the batch - connected buys are
// discounted (1 = full, 2 = −10%, 3+ = −25%). Reroll refreshes unsold stock;
// Sell mode sells owned items back. ~10% of grids null one slot ("SOLD OUT").
//
// Routed from triggerShop() when USE_ONGRID_SHOP is true; the old overlay shop is
// kept intact as a one-flag fallback. BUY = the Play button, LEAVE = the Discard
// button (mirrors the reward grid's Confirm/Clear repurposing).
// ════════════════════════════════════════════════════════════════════════════

let USE_ONGRID_SHOP = true;    // flip to false to restore the overlay shop
let shopGridActive  = false;
let shopGridItems   = [];      // full board of payloads (or null)
let shopGridSel     = new Set();
let shopGridMode    = 'buy';   // 'buy' | 'sell'
let shopGridSaved   = null;    // { rows, cols } to restore on close

// ── The board (r237) ──
// The shop is the SAME SIZE as the player's board (limits.grid_rows x grid_cols),
// so raising the board raises the shop with it. Row 0 is the COMPANY STORE title,
// full width, and it survives every reroll. Every row below it is a CATEGORY:
// one label cell (col 0) and cols-1 items.
//
// `shopGridItems[r]` is a FULL-WIDTH array with the title and label cells held as
// null. A tile can be WIDER than one cell: the SAME payload object sits in each
// cell it covers, the renderer draws the leftmost and skips the rest, and the
// selection helpers below expand a key to its cells - so adjacency and the
// connected-buy discount see the tile's whole footprint.
function shopgRows() { return Math.max(3, limits.grid_rows?.current || 4); }
function shopgCols() { return Math.max(4, limits.grid_cols?.current || 4); }

// The category registry. `viable` keeps a category off the board when it has
// nothing to sell - an empty row is worse than a different row. Labels resolve
// through the LEXICON (js/labels.js) so the plates follow the wording toggle:
// Utilities / Vendors / Certs / Docs in corporate, the classic set in gamer.
const SHOP_CATS = {
  tricks:   { type: 'trick',   fallback: 'Tricks',   icon: '★' },
  sleights: { type: 'sleight', fallback: 'Sleights', icon: '▶' },
  knacks:   { type: 'knack',   fallback: 'Knacks',   icon: '♦' },
  cards:    { type: 'card',    fallback: 'Cards',    icon: '♠' },
  improve:  { fallback: 'Improve',  icon: '⬆' },
  limits:   { fallback: 'Upgrades', icon: '▲' },
};
function shopgCatLabel(cat) {
  const def = SHOP_CATS[cat];
  if (!def) return cat;
  if (def.type && typeof entityLabel === 'function') return entityLabel(def.type, true);
  return def.fallback;
}
// One entry per category row (board rows 1..R-1): { cat, pinned }. Buying from a
// row PINS its category: the label wears a pin and a reroll keeps that row's
// category (its stock still refills). Unpinned rows reroll their category too.
let shopGridRowMeta = [];
// Rerolls are capped by the swaps you finished the last round holding - captured
// at open, spent by shopGridReroll.
let shopRerollCap = 0;

function shopGridDiscount(n) { return n >= 3 ? 0.25 : n >= 2 ? 0.10 : 0; }

// ── Sell-back values (owner spec) ──
// knacks 30% of price · tricks 60% (floored) · sleights .75 × price × (charges left / max).
function trickSellValue(t)   { return Math.floor((SHOP_TRICK_PRICES[t.tier] || 8) * 0.60); }
function knackSellValue()    { return Math.round(SHOP_KNACK_PRICE * 0.30); }
function sleightSellValue(card, def) {
  const price = SHOP_SLEIGHT_PRICES[def.rarity] || 12;
  const max   = (def.durability === 'infinite' || def.durability == null) ? null : def.durability;
  const frac  = (max && typeof card._usesLeft === 'number') ? (card._usesLeft / max) : 1;
  return Math.max(1, Math.round(0.75 * price * frac));
}

// ── Shared grid-takeover HUD: location readout (replaces pips/mult chips) ──
// Since r237 the takeover also swaps the CLOCK BAR and the FOCUS BAR out:
//   - the timer bar shrinks away and #grid-topline fades in over the grid,
//     "ROUND TIME m:ss" left-aligned and the credits right-aligned (the clock
//     is frozen on these screens, so a bar implies a countdown that is not
//     running - and the credits are what every one of these screens spends);
//   - the focus bar fades out (nothing here earns Focus) leaving a small
//     "MAX: n" note at its foot, and the grid slides left into the room
//     (body.grid-screen rules in css/style.css).
// All of it is class-driven so the moves ANIMATE via the r230 transitions.
function enterGridScreenHud(locLabel, tone) {
  document.body.classList.add('grid-screen');
  const loc = document.getElementById('screen-location');
  if (loc) {
    loc.className = 'tone-' + tone;
    const nm = loc.querySelector('.loc-name'); if (nm) nm.textContent = locLabel;
  }
  // The topline lives in #stage (it is positioned in stage %), built once.
  let tl = document.getElementById('grid-topline');
  if (!tl) {
    const stage = document.getElementById('stage');
    if (stage) {
      tl = document.createElement('div');
      tl.id = 'grid-topline';
      tl.innerHTML = `<span id="gt-time"></span><span id="gt-coins"></span>`;
      stage.appendChild(tl);
    }
  }
  updateGridTopline();
  // The MAX note at the foot of the (hidden) focus bar.
  const fw = document.getElementById('focus-meter-wrap');
  if (fw && !document.getElementById('focus-max-note')) {
    const note = document.createElement('div');
    note.id = 'focus-max-note';
    fw.appendChild(note);
  }
  const note = document.getElementById('focus-max-note');
  if (note && typeof focusCapNodes === 'function') note.textContent = 'MAX: ' + focusCapNodes();
}
function updateGridTopline() {
  if (!document.body.classList.contains('grid-screen')) return;
  const t = document.getElementById('gt-time');
  if (t && typeof roundSeconds === 'number') {
    const m = Math.floor(Math.max(0, roundSeconds) / 60), sec = Math.max(0, roundSeconds) % 60;
    t.textContent = `ROUND TIME ${m}:${String(sec).padStart(2, '0')}`;
  }
  const c = document.getElementById('gt-coins');
  if (c && typeof coins === 'number') c.textContent = `💰 ${coins}`;
}
function exitGridScreenHud() {
  document.body.classList.remove('grid-screen');
  const sc = document.getElementById('selected-cards'); if (sc) sc.innerHTML = '';
}

// ── Stock generation ──
// A category is only offered when it has something to sell.
function shopgCatViable(cat) {
  try {
    if (cat === 'tricks')   return TRICK_POOL.some(t => !acquiredTricks.some(b => b.id === t.id));
    if (cat === 'knacks')   return KNACK_POOL.some(k => !acquiredKnacks.some(a => a.id === k.id));
    if (cat === 'sleights') return true;
    if (cat === 'limits')   return LIMITS_DEF.some(d => limits[d.id].current < limits[d.id].max);
    if (cat === 'cards')    return typeof everyDeckCard === 'function' && everyDeckCard().length > 0;
    if (cat === 'improve')  return typeof ownedImprovable === 'function'
        && ['trick', 'knack', 'sleight'].some(t => ownedImprovable(t).length > 0);
  } catch (e) { return false; }
  return false;
}

// Deal the category rows. `prev` is the outgoing row meta on a reroll: a PINNED
// row keeps its category; everything else redraws, no category twice on one
// board. The FIRST board of a visit always carries the limits row (bottom, where
// Upgrades has always lived); reroll it away unpinned and it can leave too.
function shopgDrawCats(prev) {
  const nRows = shopgRows() - 1;
  const meta = new Array(nRows).fill(null);
  const taken = new Set();
  for (let i = 0; i < nRows; i++) {
    const p = prev && prev[i];
    if (p && p.pinned && shopgCatViable(p.cat)) { meta[i] = { cat: p.cat, pinned: true }; taken.add(p.cat); }
  }
  if (!prev && !taken.has('limits') && shopgCatViable('limits')) {
    meta[nRows - 1] = { cat: 'limits', pinned: false };
    taken.add('limits');
  }
  for (let i = 0; i < nRows; i++) {
    if (meta[i]) continue;
    const opts = Object.keys(SHOP_CATS).filter(c => !taken.has(c) && shopgCatViable(c));
    const cat = opts.length ? opts[Math.floor(Math.random() * opts.length)]
                            : Object.keys(SHOP_CATS).find(c => !taken.has(c)) || 'tricks';
    meta[i] = { cat, pinned: false };
    taken.add(cat);
  }
  return meta;
}

// ── Payload factories, one per category. Each returns up to `n` CELLS of items;
// a payload with `_span: 2` covers two cells and counts twice against n. ──
function shopgKnackPayloads(n) {
  const owned = new Set(acquiredKnacks.map(t => t.id));
  return shuffle(KNACK_POOL.filter(t => !owned.has(t.id))).slice(0, n)
    .map(k => ({ entity:'knack', label:k.name, desc:k.desc, emoji:k.emoji, rarity:k.rarity || 'common',
                 price: SHOP_KNACK_PRICE, buy: () => { acquiredKnacks.push({ ...k }); updateKnackList?.(); } }));
}
function shopgTrickPayloads(n) {
  const owned = new Set(acquiredTricks.map(b => b.id));
  return shuffle(TRICK_POOL.filter(b => !owned.has(b.id))).slice(0, n)
    .map(t => ({ entity:'trick', label:t.name, desc:t.desc, emoji:trickEmoji(t), rarity:t.tier || 'common', tier:t.tier || 'common',
                 price: SHOP_TRICK_PRICES[t.tier] || 8, buy: () => injectTrickAfterReward(t) }));
}
function shopgSleightPayloads(n) {
  return pickSleightByRarity(n, _grantedSleightSet())
    .map(s => ({ entity:'sleight', label:s.name, desc:s.desc, emoji:s.emoji || '🃏',
                 uses: s.durability === 'infinite' ? '∞' : `${s.durability}×`, rarity:s.rarity || 'common',
                 price: SHOP_SLEIGHT_PRICES[s.rarity] || 12, buy: () => grantSleight(s) }));
}
function shopgLimitPayloads(n) {
  // `reroll` is excluded: shop rerolls are rationed by leftover swaps now, so
  // the old reroll limit would be a dead purchase here. The sub-line goes
  // through limitUnit/limitGain (r227) so Starting Time reads '180s -> 195s'.
  const elig = LIMITS_DEF.filter(d => d.id !== 'reroll'
    && (typeof limitCanIncrement === 'function' ? limitCanIncrement(d.id) : limits[d.id].current < limits[d.id].max));
  return shuffle(elig).slice(0, n).map(d => {
    const u = (typeof limitUnit === 'function') ? limitUnit(d.id) : '';
    const cur = limits[d.id].current;
    const gain = (typeof limitGain === 'function') ? limitGain(d.id) : (limits[d.id].step || 1);
    return { _upgrade:true, icon:d.icon, label:d.label, desc:d.desc, sub:`${cur}${u} → ${cur + gain}${u}`, rarity:'common',
             price: shopLimitPrice(d), buy: () => { incrementLimit(d.id); onLimitChanged?.(d.id); } };
  });
}
// Buffed cards: a NAMED card from the live deck, carrying one permanent effect.
// The card is re-resolved at apply time (resolveDeckCard) because it can leave
// the run between the board being built and the tile being bought.
function shopgCardPayloads(n) {
  const deck = shuffle(everyDeckCard().slice()).slice(0, n);
  return deck.map(card => {
    const face = `${card.rank}${(typeof cardColorSuit === 'function' ? cardColorSuit(card) : card.suit) || ''}`;
    const roll = Math.random();
    const buff = roll < 0.60 ? { e:{ pips: 12 },     txt:'scores +12 pips when played',                    price: 6  }
               : roll < 0.85 ? { e:{ mult: 5 },      txt:'scores +5 mult when played',                     price: 10 }
                             : { e:{ growMult: 1 },  txt:'scales +1 mult each time it is played',          price: 15 };
    return {
      _cardBuff: true, icon: face, label: face,
      desc: `Buff this exact card in your deck: it ${buff.txt}.`,
      sub: buff.e.pips ? `+${buff.e.pips} pips` : buff.e.mult ? `+${buff.e.mult} mult` : `+${buff.e.growMult} mult/play`,
      rarity: buff.e.growMult ? 'epic' : buff.e.mult ? 'rare' : 'common',
      price: buff.price,
      buy: () => {
        const t = resolveDeckCard(card);
        if (t && typeof enhanceCardKey === 'function') enhanceCardKey(cardId(t), buff.e);
      },
    };
  });
}
// Improvements ride js/improve.js (r206). A RANDOM improvement is one cell; a
// SPECIFIC one - target chosen when the board is built, before/after in the
// tooltip - is worth knowing more about, so it is TWO cells wide and priced up.
function shopgImprovePayloads(n) {
  const out = [];
  let left = n;
  const types = ['trick', 'knack', 'sleight'].filter(t => ownedImprovable(t).length > 0);
  while (left > 0 && types.length) {
    const type = types[Math.floor(Math.random() * types.length)];
    if (left >= 2 && Math.random() < 0.40) {
      const target = pickImproveTarget(type);
      if (target) {
        const prev = improvePreview(target.id);
        out.push({
          _improve: true, _span: 2, icon: '⬆', label: `Improve ${target.name}`,
          desc: prev ? `Raise ${target.name} one tier.<br><b>Now:</b> ${prev.before}<br><b>After:</b> ${prev.after}`
                     : `Raise ${target.name} one tier.`,
          rarity: target.rarity || 'rare', price: 30,
          buy: () => { if (canImprove(target.id)) improveEntity(target.id); },
        });
        left -= 2;
        continue;
      }
    }
    const typeWord = (typeof entityLabel === 'function') ? entityLabel(type) : type;
    out.push({
      _improve: true, icon: '⬆', label: `Random ${typeWord}`,
      desc: `Improve a random owned ${typeWord} one tier. Which one is decided when you buy.`,
      rarity: 'rare', price: 20,
      buy: () => { const t = pickImproveTarget(type); if (t) { improveEntity(t.id); showMessage(`⬆ ${t.name} improved`, 'var(--c-mint)'); } },
    });
    left -= 1;
  }
  return out;
}

function shopgRowPayloads(cat, n) {
  if (cat === 'tricks')   return shopgTrickPayloads(n);
  if (cat === 'knacks')   return shopgKnackPayloads(n);
  if (cat === 'sleights') return shopgSleightPayloads(n);
  if (cat === 'limits')   return shopgLimitPayloads(n);
  if (cat === 'cards')    return shopgCardPayloads(n);
  if (cat === 'improve')  return shopgImprovePayloads(n);
  return [];
}

// Build the whole buy board. `reroll` keeps pinned categories (shopgDrawCats);
// stock always refills - a bought slot comes back as fresh stock, not a ✓.
function buildShopGridStock(reroll) {
  shopGridRowMeta = shopgDrawCats(reroll ? shopGridRowMeta : null);
  const R = shopgRows(), C = shopgCols();
  const rows = [new Array(C).fill(null)];              // row 0: the title
  shopGridRowMeta.forEach(m => {
    const row = [null];                                // col 0: the label
    shopgRowPayloads(m.cat, C - 1).forEach(p => {
      if (!p || row.length >= C) return;
      row.push(p);
      if (p._span === 2 && row.length < C) row.push(p);   // same object = the tile's 2nd cell
    });
    while (row.length < C) row.push(null);
    rows.push(row);
  });
  while (rows.length < R) rows.push(new Array(C).fill(null));
  return rows;
}

// Build the "sell" board from currently-owned items (up to 16 shown).
function buildShopSellStock() {
  const items = [];
  (acquiredKnacks || []).forEach((k, idx) => items.push({ entity:'knack', label:k.name, desc:k.desc, emoji:k.emoji, rarity:k.rarity || 'common',
    price: knackSellValue(), sell: () => { const i = acquiredKnacks.findIndex(x => x.id === k.id); if (i >= 0) acquiredKnacks.splice(i, 1); updateKnackList?.(); } }));
  const trickList = (typeof trickTrayMode !== 'undefined' && trickTrayMode) ? trickTray : acquiredTricks;
  (trickList || []).forEach(t => items.push({ entity:'trick', label:t.name, desc:t.desc, emoji:trickEmoji(t), rarity:t.tier || 'common', tier:t.tier || 'common',
    price: trickSellValue(t), sell: () => sellOwnedTrick(t) }));
  ownedSleightInstances().forEach(inst => {
    const def = inst.def;
    items.push({ entity:'sleight', label:def.name, desc:def.desc, emoji:def.emoji || '🃏',
      uses: def.durability === 'infinite' ? '∞' : `${inst.card._usesLeft ?? def.durability}×`, rarity:def.rarity || 'common',
      price: sleightSellValue(inst.card, def), sell: () => sellOwnedSleight(inst) });
  });
  // The SELL board uses the full width and carries no title or labels - what you
  // own is a mixed list, so there is no category for a plate to name.
  const R = shopgRows(), C = shopgCols();
  const rows = [];
  for (let r = 0; r < R; r++) { rows.push([]); for (let c = 0; c < C; c++) rows[r][c] = items[r * C + c] || null; }
  return rows;
}
function ownedSleightInstances() {
  const out = [];
  const push = (card, from, key) => { const def = SLEIGHT_POOL.find(s => s.id === card.sleightId); if (def) out.push({ card, from, key, def }); };
  (drawPile   || []).forEach((c, i) => { if (c._isSleight) push(c, 'draw',   i); });
  (playedPile || []).forEach((c, i) => { if (c._isSleight) push(c, 'played', i); });
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) { const card = gridData[r]?.[c]; if (card?._isSleight) push(card, 'grid', `${r}-${c}`); }
  return out;
}
function sellOwnedTrick(t) {
  if (typeof trickTrayMode !== 'undefined' && trickTrayMode) { const i = trickTray.findIndex(x => x === t || x.id === t.id); if (i >= 0) trickTray.splice(i, 1); }
  const ai = acquiredTricks.findIndex(x => x.id === t.id); if (ai >= 0) acquiredTricks.splice(ai, 1);
  if (typeof renderTrickTray === 'function') renderTrickTray();
}
function sellOwnedSleight(inst) {
  if (inst.from === 'draw')   drawPile.splice(inst.key, 1);
  else if (inst.from === 'played') playedPile.splice(inst.key, 1);
  else { const [r, c] = inst.key.split('-').map(Number); gridData[r][c] = (typeof drawCard === 'function' ? drawCard() : null) || null; }
  if (typeof updateDeckHud === 'function') updateDeckHud();
}

// ── Open / close ──
let _shopPrevPV = null;   // portrait panel view to restore on close
function openShopGrid() {
  shopGridActive = true;
  shopGridMode   = 'buy';
  shopGridSel    = new Set();
  shopSelOrder   = [];
  shopRerollCount = 0;
  // Rerolls are RATIONED by the swaps you were holding when the shop opened -
  // in the node flow that is what the finished round left you (the reset runs
  // later, in triggerLevelUp), and on a Survival mid-round visit it is the live
  // count. Money alone is not enough to spin the stock forever.
  shopRerollCap = Math.max(0, (typeof swaps === 'number' ? swaps : 0));
  gameTimerPaused = true;
  try { sfxShopOpen?.(); } catch (e) {}
  shopGridItems  = buildShopGridStock();
  // The shop board is the PLAYER'S board: same rows and columns, read from the
  // limits (never the live globals - a boss or a penalty can have shrunk those
  // temporarily, and the shop should not inherit the shrink).
  shopGridSaved  = { rows: gridRows, cols: gridCols };
  gridRows = shopgRows(); gridCols = shopgCols();
  recomputeGridMetrics();
  document.getElementById('next-goal-bg')?.classList.remove('show');
  document.body.classList.add('shop-active');
  enterGridScreenHud('SHOP', 'shop');
  enterShopGridButtons();
  // Portrait: flip the shared strip to the hand-preview half so the cost /
  // discount readout (rendered into #selected-cards) is on screen. Restored on
  // close; an auto-swap never overwrites the player's own choice.
  if (typeof setPortraitPanelView === 'function' && typeof portraitPanelView !== 'undefined') {
    _shopPrevPV = portraitPanelView;
    setPortraitPanelView('preview', { auto: true });
  }
  // Survival opens the shop FROM the pick screen, and the pick panel sits
  // centred over the board - which is now the shop. Put it aside with the
  // pick's own peek mechanism (fade + inert); closeShopGrid brings it back.
  // The peek's restore button is hidden while the shop owns the screen
  // (body.shop-active rule in css/survival.css), so it cannot be recalled
  // over the shelves.
  const svPick = document.getElementById('survival-pick-overlay');
  if (svPick && svPick.classList.contains('show')) svPick.classList.add('sv-peek');
  renderShopGrid(true);
}
// Dev-panel + earlier hook both call this name.
function openShopGridPreview() { openShopGrid(); }

function closeShopGrid() {
  if (!shopGridActive) return;
  shopGridActive = false;
  hideRewardTooltip();
  document.body.classList.remove('shop-active');
  if (_shopPrevPV && typeof setPortraitPanelView === 'function') { setPortraitPanelView(_shopPrevPV, { auto: true }); _shopPrevPV = null; }
  exitGridScreenHud();
  exitShopGridButtons();
  const gridEl = document.getElementById('grid'); if (gridEl) gridEl.innerHTML = '';
  if (shopGridSaved) { gridRows = shopGridSaved.rows; gridCols = shopGridSaved.cols; shopGridSaved = null; }
  recomputeGridMetrics();
  shopGridItems = []; shopGridSel = new Set();
  gameTimerPaused = false;
  // Continue whatever flow opened the shop. These branches mirror the Mart's
  // closeMart tail plus the legacy #shop-close handler - the grid shop is the
  // LIVE shop (r232), so every route the Mart served has to land here too.
  if (shopFromNodeFlow) { resumeAfterNodeFlowShop(); }
  else if (typeof match3Active === 'function' && match3Active()) {
    // Match-3's between-rounds shop: the board was pre-dealt behind the shop;
    // match3AfterShop reveals it (goal flash + 3-2-1) and unpauses itself.
    gameTimerPaused = true;
    match3AfterShop();
  }
  else if (typeof survivalActive === 'function' && survivalActive() && !bossActive) {
    if (typeof survivalShopFromPick !== 'undefined' && survivalShopFromPick) {
      // Opened from the PICK screen: bring the peeked panel back in front. The
      // pick owns the flow (the round deals when you choose), so stay paused.
      survivalShopFromPick = false;
      gameTimerPaused = true;
      const svPick = document.getElementById('survival-pick-overlay');
      if (svPick) svPick.classList.remove('sv-peek');
      if (typeof survivalUpdateRerollBtn === 'function') survivalUpdateRerollBtn();
      if (typeof render === 'function') render();
      if (typeof survivalSyncPickAudio === 'function') survivalSyncPickAudio();
    } else {
      // Mid-round visit: triggerShop() nulled the round interval, so restart it.
      if (typeof render === 'function') render();
      startRoundTimer();
    }
  }
  else { if (typeof render === 'function') render(); }
}

// ── The squish: the left column narrows while the shop is open ────────────
// One class on #stage does the whole move (css/style.css). The arrow tab puts
// the column back to playing size for as long as you want to read something in
// it, and squeezes it again on a second press - so nothing is ever unreachable,
// it is just smaller by default while you are shopping.
let shopSquished = false;

// Card metrics come from the MEASURED #grid-slot rect, and the class is what
// changes that rect - so a resize of the slot has to be followed by a
// re-measure and a repaint or the tiles keep the old board's geometry and sit
// outside the new one. The CSS transition means the rect is still moving on the
// next frame, so the re-measure waits for the transition rather than a frame.
const SHOPG_SQUISH_MS = 340;
function shopSquishSet(on, opts) {
  const stage = document.getElementById('stage');
  if (!stage) return;
  shopSquished = !!on;
  stage.classList.toggle('shop-squish', shopSquished);
  const tab = document.getElementById('shop-squish-tab');
  if (tab) {
    tab.innerHTML = shopSquished ? '\u25b6' : '\u25c0';
    tab.title = shopSquished ? 'Show the panels full size' : 'Give the shop the room';
    tab.setAttribute('aria-label', tab.title);
    tab.setAttribute('aria-expanded', shopSquished ? 'false' : 'true');
  }
  // `instant` is for open and close, where the board is about to be built or
  // thrown away anyway and there is no point measuring a moving rect.
  const settle = () => {
    if (typeof recomputeGridMetrics === 'function') recomputeGridMetrics();
    if (shopGridActive) renderShopGrid();
  };
  if (opts && opts.instant) {
    // Kill the transition for one layout pass so the rect is at its final size
    // the moment it is measured, then hand the transition back for the tab.
    stage.classList.add('squish-instant');
    void stage.offsetWidth;                  // flush the layout at the new size
    settle();
    requestAnimationFrame(() => stage.classList.remove('squish-instant'));
    return;
  }
  setTimeout(settle, SHOPG_SQUISH_MS);
}

function shopSquishToggle() { shopSquishSet(!shopSquished); }

// The tab is created once and lives inside #stage beside the panels it moves.
// It is NOT body-level: it is positioned as a percentage of the stage like
// every other landscape panel, so it wants the cabinet's zoom rather than raw
// viewport pixels - the opposite of the pop-ups, which are placed from JS.
function ensureShopSquishTab() {
  let tab = document.getElementById('shop-squish-tab');
  if (tab) return tab;
  const stage = document.getElementById('stage');
  if (!stage) return null;
  tab = document.createElement('button');
  tab.id = 'shop-squish-tab';
  tab.type = 'button';
  tab.className = 'squish-avail';
  tab.onclick = shopSquishToggle;
  stage.appendChild(tab);
  return tab;
}

// ── Button repurposing: Play → BUY, Discard → LEAVE ──
let _shopgPlayHTML = null, _shopgDiscHTML = null;
function enterShopGridButtons() {
  const play = document.getElementById('btn-play');
  const disc = document.getElementById('btn-discard');
  if (play) { if (_shopgPlayHTML === null) _shopgPlayHTML = play.innerHTML; play.classList.add('reward-buy');  play.innerHTML = 'B<br>U<br>Y'; }
  if (disc) { if (_shopgDiscHTML === null) _shopgDiscHTML = disc.innerHTML; disc.classList.add('reward-clear'); disc.innerHTML = 'L<br>E<br>A<br>V<br>E'; disc.disabled = false; }
}
function exitShopGridButtons() {
  const play = document.getElementById('btn-play');
  const disc = document.getElementById('btn-discard');
  if (play && _shopgPlayHTML !== null) { play.classList.remove('reward-buy');  play.innerHTML = _shopgPlayHTML; }
  if (disc && _shopgDiscHTML !== null) { disc.classList.remove('reward-clear'); disc.innerHTML = _shopgDiscHTML; }
}

// ── Render ──
// `animateIn` deals the board: the plates and options FALL in, plate first and
// its two options behind it, so a row reads as a heading with its stock under
// it rather than as four things that appeared together. It is passed ONLY from
// openShopGrid - every other call is a repaint after a pick or a purchase, and
// re-dropping the whole board each time you click a tile would be unreadable.
function renderShopGrid(animateIn = false) {
  const gridEl = document.getElementById('grid'); if (!gridEl || !shopGridItems.length) return;
  recomputeGridMetrics();
  hideRewardTooltip();
  gridEl.innerHTML = '';
  const labelled = (shopGridMode !== 'sell');
  // Row after row, and within a row the plate leads. 90ms a row against 55ms a
  // column, so the board reads as dealing DOWNWARD - the same relationship the
  // board heartbeat uses to make its wave fall rather than sweep sideways.
  const SG_ROW_MS = 90, SG_COL_MS = 55;
  const fallIn = (el, r, c) => {
    if (!animateIn) return;
    el.classList.add('shopg-in');
    el.style.setProperty('--sgd', (r * SG_ROW_MS + c * SG_COL_MS) + 'ms');
  };
  const R = gridRows, C = gridCols;
  for (let r = 0; r < R; r++) {
    // Row 0 of the buy board is the COMPANY STORE title: full width, inert, and
    // it survives every reroll (the reroll only redraws the rows below it).
    if (labelled && r === 0) {
      const tt = document.createElement('div');
      tt.className = 'reward-cell on-grid shop-title-tile unselectable';
      tt.style.left = cellLeft(0) + 'px';
      tt.style.top  = cellTop(0) + 'px';
      tt.style.width  = (C * (CARD_W + CARD_GAP) - CARD_GAP) + 'px';
      tt.style.height = CARD_H + 'px';
      tt.innerHTML = `<span class="stt-name">COMPANY STORE</span>`;
      fallIn(tt, 0, 0);
      gridEl.appendChild(tt);
      continue;
    }
    // Each category row opens with a ONE-CELL label plate. Inert: it is a
    // heading, and making it selectable would let a path route through it.
    // Buying from the row pins its category; the pin lives here.
    if (labelled) {
      const meta = shopGridRowMeta[r - 1];
      const cat  = meta ? SHOP_CATS[meta.cat] : null;
      const catLabel = meta ? shopgCatLabel(meta.cat) : '';
      const lab = document.createElement('div');
      lab.className = 'reward-cell on-grid shop-row-label unselectable' + (meta?.pinned ? ' pinned' : '');
      lab.style.left = cellLeft(0) + 'px';
      lab.style.top  = cellTop(r) + 'px';
      lab.style.width  = CARD_W + 'px';
      lab.style.height = CARD_H + 'px';
      lab.innerHTML = `<span class="srl-icon">${cat?.icon || ''}</span>`
                    + `<span class="srl-name">${catLabel}</span>`
                    + (meta?.pinned ? `<span class="srl-pin" title="Bought from: this category stays on reroll">📌</span>` : '');
      fallIn(lab, r, 0);
      gridEl.appendChild(lab);
    }
    for (let c = labelled ? 1 : 0; c < C; c++) {
      const p = shopGridItems[r]?.[c];
      // A wider tile holds the SAME payload object in each cell it covers; only
      // the leftmost cell draws it.
      if (p && c > (labelled ? 1 : 0) && shopGridItems[r][c - 1] === p) continue;
      const span = (p && shopGridItems[r][c + 1] === p) ? 2 : 1;
      const div = document.createElement('div');
      div.dataset.r = r; div.dataset.c = c;
      div.style.left = cellLeft(c) + 'px'; div.style.top = cellTop(r) + 'px';
      div.style.width = (span * (CARD_W + CARD_GAP) - CARD_GAP) + 'px'; div.style.height = CARD_H + 'px';
      if (!p) {
        // An empty slot is a filler card, never a hole - a hole in a board of
        // cards reads as something failing to load (same rule as Guided's board).
        div.className = 'reward-cell on-grid shop-tile shop-prev-null unselectable';
        div.innerHTML = `<div class="reward-icon">·</div>`;
      } else {
        const rar = p.entity ? rewardRarity(p) : (p.rarity || 'common');
        const sel = shopGridSel.has(`${r}-${c}`);
        div.className = [
          'reward-cell', 'on-grid', 'buff', 'shop-tile',
          p.entity ? 'entity' : '', p.entity ? 'entity-' + p.entity : '',
          p._upgrade ? 'shop-tile-upgrade' : '', p._improve ? 'shop-tile-improve' : '',
          p._cardBuff ? 'shop-tile-card' : '', span === 2 ? 'shop-tile-wide' : '', 'rar-' + rar,
          p._sold ? 'sold' : '', sel ? 'selected' : '',
        ].filter(Boolean).join(' ');
        const chip = p._sold ? '✓' : `💰${p.price}`;
        div.innerHTML = buildShopTileInner(p) + `<div class="shop-price-chip ${p._sold ? 'sold' : (coins < p.price ? 'cant-afford' : '')}">${chip}</div>`;
        if (!p._sold) div.onclick = () => {
          if (div._lpJustFired) { div._lpJustFired = false; return; }   // that tap was a long-press read
          onShopGridClick(r, c);
        };
        if (p.desc) attachRewardTooltip(div, p, 'buff');
      }
      fallIn(div, r, c);
      gridEl.appendChild(div);
      const nm = div.querySelector('.rwd-name'); if (nm) fitRewardName(nm);
    }
  }
  if (typeof restoreRewardTooltip === 'function') restoreRewardTooltip();
  if (typeof updateSelectionUI === 'function') updateSelectionUI();
  renderShopCostReadout();
  updateShopGridButtons();
}

// ── Span-aware selection helpers ──
// Every cell a payload covers, from any of its keys.
function shopgCellsOf(key) {
  const [r, c] = key.split('-').map(Number);
  const p = shopGridItems[r]?.[c];
  if (!p) return [[r, c]];
  const cells = [];
  for (let cc = 0; cc < (shopGridItems[r] || []).length; cc++) if (shopGridItems[r][cc] === p) cells.push([r, cc]);
  return cells.length ? cells : [[r, c]];
}
// The key a payload is addressed by: its leftmost cell.
function shopgLeadKey(r, c) {
  const p = shopGridItems[r]?.[c];
  if (!p) return null;
  let cc = c;
  while (cc > 0 && shopGridItems[r][cc - 1] === p) cc--;
  return `${r}-${cc}`;
}
// Connectivity over CELLS, so a two-cell tile connects through either half.
function shopGroupConnected(keySet) {
  const cells = new Set();
  keySet.forEach(k => shopgCellsOf(k).forEach(([r, c]) => cells.add(`${r}-${c}`)));
  const arr = [...cells];
  if (arr.length <= 1) return true;
  const seen = new Set([arr[0]]);
  const q = [arr[0]];
  while (q.length) {
    const [r, c] = q.pop().split('-').map(Number);
    [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([nr, nc]) => {
      const k = `${nr}-${nc}`;
      if (cells.has(k) && !seen.has(k)) { seen.add(k); q.push(k); }
    });
  }
  return seen.size === cells.size;
}

// Selection order, so a deselect can hand the pinned tooltip back to the
// previous pick (the same shape the reward grid keeps in rewardPickOrder).
let shopSelOrder = [];
function onShopGridClick(r, c) {
  const p = shopGridItems[r]?.[c];
  if (!p || p._sold) return;
  if (shopGridMode === 'sell') { doShopSell(r, c); return; }
  const key = shopgLeadKey(r, c);
  if (shopGridSel.has(key)) {
    const rem = new Set([...shopGridSel].filter(k => k !== key));
    if (rem.size === 0 || shopGroupConnected(rem)) {
      shopGridSel.delete(key);
      shopSelOrder = shopSelOrder.filter(k => k !== key);
      // Hand the tooltip to the previous pick, exactly as the reward grid does.
      if (typeof rewardTipKey !== 'undefined' && rewardTipKey === key)
        rewardTipKey = shopSelOrder.length ? shopSelOrder[shopSelOrder.length - 1] : null;
      renderShopGrid();
    }
    return;
  }
  if (shopGridSel.size >= limits.selection.current) return;             // capped by Selection Size
  if (shopGridSel.size > 0) {
    // Adjacent to the selection through ANY cell of this tile's footprint.
    const adj = shopgCellsOf(key).some(([tr, tc]) =>
      [[tr-1,tc],[tr+1,tc],[tr,tc-1],[tr,tc+1]].some(([nr, nc]) => {
        const lk = shopgLeadKey(nr, nc);
        return lk && shopGridSel.has(lk);
      }));
    if (!adj) return;                                                   // must be connected
  }
  shopGridSel.add(key);
  shopSelOrder.push(key);
  // The newest pick is the one being explained (r182's reward-grid rule).
  if (typeof rewardTipKey !== 'undefined') rewardTipKey = key;
  renderShopGrid();
}

function shopGridSelectionCost() {
  let base = 0;
  shopGridSel.forEach(k => { const [r, c] = k.split('-').map(Number); const p = shopGridItems[r]?.[c]; if (p && !p._sold) base += p.price; });
  const d = shopGridDiscount(shopGridSel.size);
  return { base, discount: d, total: Math.round(base * (1 - d)) };
}

// Play button → BUY the selected connected group (discounted).
function shopGridBuySelection() {
  if (shopGridMode === 'sell') return;
  if (shopGridSel.size === 0) return;
  const { total } = shopGridSelectionCost();
  if (coins < total) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= total;
  updateCoinsUI();
  [...shopGridSel].forEach(k => {
    const [r, c] = k.split('-').map(Number);
    const p = shopGridItems[r]?.[c];
    if (p && !p._sold && typeof p.buy === 'function') {
      try { p.buy(); } catch (e) { console.error('[SHOP] buy failed', e); }
      p._sold = true;
      // Buying from a row PINS its category: a reroll keeps the row, refills it.
      if (r >= 1 && shopGridRowMeta[r - 1]) shopGridRowMeta[r - 1].pinned = true;
    }
  });
  try { sfxRewardGood?.(); } catch (e) {}
  showMessage(`Bought ${shopGridSel.size} - 💰${total}`, 'var(--gold)');
  shopGridSel = new Set();
  shopSelOrder = [];
  if (typeof rewardTipKey !== 'undefined') rewardTipKey = null;
  renderShopGrid();
}

// Sell (sell mode): tap an owned item to sell it back.
function doShopSell(r, c) {
  const p = shopGridItems[r]?.[c];
  if (!p || typeof p.sell !== 'function') return;
  coins += p.price; updateCoinsUI();
  try { p.sell(); } catch (e) { console.error('[SHOP] sell failed', e); }
  try { sfxRewardGood?.(); } catch (e) {}
  showMessage(`Sold ${p.label} - +💰${p.price}`, 'var(--gold)');
  shopGridItems = buildShopSellStock();   // refresh owned view
  renderShopGrid();
}

let _shopBuyCache = null;
function toggleShopSellMode() {
  shopGridMode = shopGridMode === 'buy' ? 'sell' : 'buy';
  shopGridSel = new Set();
  shopSelOrder = [];
  if (typeof rewardTipKey !== 'undefined') { rewardTipKey = null; hideRewardTooltip(); }
  if (shopGridMode === 'sell') {
    _shopBuyCache = shopGridItems;          // Back must not be a free reroll
    shopGridItems = buildShopSellStock();
  } else {
    shopGridItems = _shopBuyCache && _shopBuyCache.length ? _shopBuyCache : buildShopGridStock(true);
    _shopBuyCache = null;
  }
  enterGridScreenHud(shopGridMode === 'sell' ? 'SELL' : 'SHOP', 'shop');
  renderShopGrid();
}

function shopGridReroll() {
  if (shopGridMode !== 'buy') return;
  if (shopRerollCount >= shopRerollCap) { showMessage('No rerolls left · 1 per unused swap', 'var(--red)'); return; }
  const cost = 10 + shopRerollCount * 5;
  if (coins < cost) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= cost; updateCoinsUI();
  shopRerollCount++;
  // Pinned rows keep their category; everything refills fresh - a bought slot
  // comes back as new stock rather than a ✓ (buildShopGridStock, reroll=true).
  shopGridItems = buildShopGridStock(true);
  shopGridSel = new Set();
  shopSelOrder = [];
  if (typeof rewardTipKey !== 'undefined') rewardTipKey = null;
  renderShopGrid();
}

function updateShopGridButtons() {
  const play = document.getElementById('btn-play');
  if (play) play.disabled = (shopGridMode !== 'buy') || shopGridSel.size === 0 || coins < shopGridSelectionCost().total;
}

// Cost / discount readout rendered INTO the hand-preview slot (#selected-cards).
function renderShopCostReadout() {
  const sc = document.getElementById('selected-cards'); if (!sc) return;
  const rerollCost = 10 + shopRerollCount * 5;
  const rerollLeft = Math.max(0, shopRerollCap - shopRerollCount);
  let costLine;
  if (shopGridMode === 'sell') {
    costLine = `<div class="sc-line"><span>SELL MODE</span><span class="sc-off">tap to sell</span></div>`
             + `<div class="sc-line"><span>Wallet</span><b>💰${coins}</b></div>`;
  } else {
    const { base, discount, total } = shopGridSelectionCost();
    const n = shopGridSel.size;
    costLine = n === 0
      ? `<div class="sc-line"><span>Select connected items</span></div><div class="sc-line"><span>2 = −10% · 3+ = −25%</span></div>`
      : (discount > 0
          ? `<div class="sc-line"><span>${n} items</span><span><s>💰${base}</s> <b>💰${total}</b> <span class="sc-off">(−${Math.round(discount*100)}%)</span></span></div>`
          : `<div class="sc-line"><span>${n} item</span><b>💰${total}</b></div>`)
        + `<div class="sc-line"><span>Wallet</span><b>💰${coins}</b></div>`;
  }
  sc.innerHTML =
    `<div class="shop-cost">${costLine}` +
      `<div class="sc-actions">` +
        `<button id="sc-reroll" title="Rerolls left: ${rerollLeft} (1 per unused swap)" ${shopGridMode==='sell'||rerollLeft<=0?'disabled':''}>🎲 ${rerollLeft>0?`${rerollCost} (${rerollLeft})`:'·'}</button>` +
        `<button id="sc-sell" class="${shopGridMode==='sell'?'sc-sell-on':''}">${shopGridMode==='sell'?'Back':'Sell'}</button>` +
      `</div>` +
    `</div>`;
  const rb = sc.querySelector('#sc-reroll'); if (rb) rb.onclick = (e) => { e.stopPropagation(); shopGridReroll(); };
  const sb = sc.querySelector('#sc-sell');   if (sb) sb.onclick = (e) => { e.stopPropagation(); toggleShopSellMode(); };
}
