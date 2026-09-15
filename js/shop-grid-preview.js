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
let shopGridItems   = [];      // 4×4 of payloads (or null)
let shopGridSel     = new Set();
let shopGridMode    = 'buy';   // 'buy' | 'sell'
let shopGridSaved   = null;    // { rows, cols } to restore on close
// The BUY board is 4 rows x 5 columns: each row opens with a 3-wide tile naming
// the category, then TWO options. Two, not four - four of everything made the
// shop a wall to read rather than a choice to make, and the wider board is what
// buys the room for the row labels.
//
// `shopGridItems[r]` stays a FULL-WIDTH array of SHOPG_COLS, with the label
// columns held as null. That is deliberate: every existing r/c index - the
// selection keys, the adjacency test, isGroupConnected, the click handler - keeps
// working untouched, and only the renderer has to know about the label.
const SHOPG_ROWS = 4, SHOPG_COLS = 5;
const SHOPG_LABEL_SPAN = 3;            // columns 0-2 are the row's name plate
const SHOPG_OPTIONS = SHOPG_COLS - SHOPG_LABEL_SPAN;   // 2 options a row
const SHOPG_ROW_LABELS = ['Knacks', 'Tricks', 'Sleights', 'Upgrades'];
const SHOPG_ROW_ICONS  = ['♦', '★', '▶', '▲'];

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
function enterGridScreenHud(locLabel, tone) {
  document.body.classList.add('grid-screen');
  const loc = document.getElementById('screen-location');
  if (loc) {
    loc.className = 'tone-' + tone;
    const nm = loc.querySelector('.loc-name'); if (nm) nm.textContent = locLabel;
  }
}
function exitGridScreenHud() {
  document.body.classList.remove('grid-screen');
  const sc = document.getElementById('selected-cards'); if (sc) sc.innerHTML = '';
}

// ── Stock generation (4 of each category, owned items filtered out) ──
function buildShopGridStock() {
  const ownedBc  = new Set(acquiredTricks.map(b => b.id));
  const ownedTot = new Set(acquiredKnacks.map(t => t.id));
  const granted  = _grantedSleightSet();

  const knacks   = shuffle(KNACK_POOL.filter(t => !ownedTot.has(t.id))).slice(0, SHOPG_OPTIONS);
  const tricks   = shuffle(TRICK_POOL.filter(b => !ownedBc.has(b.id))).slice(0, SHOPG_OPTIONS);
  const sleights = pickSleightByRarity(SHOPG_OPTIONS, granted);
  const lims     = shuffle(LIMITS_DEF.filter(d => limits[d.id].current < limits[d.id].max)).slice(0, SHOPG_OPTIONS);

  const rows = [[], [], [], []];
  rows[0] = knacks.map(k => ({ entity:'knack', label:k.name, desc:k.desc, emoji:k.emoji, rarity:k.rarity || 'common',
                               price: SHOP_KNACK_PRICE, buy: () => { acquiredKnacks.push({ ...k }); updateKnackList?.(); } }));
  rows[1] = tricks.map(t => ({ entity:'trick', label:t.name, desc:t.desc, emoji:trickEmoji(t), rarity:t.tier || 'common', tier:t.tier || 'common',
                               price: SHOP_TRICK_PRICES[t.tier] || 8, buy: () => injectTrickAfterReward(t) }));
  rows[2] = sleights.map(s => ({ entity:'sleight', label:s.name, desc:s.desc, emoji:s.emoji || '🃏',
                               uses: s.durability === 'infinite' ? '∞' : `${s.durability}×`, rarity:s.rarity || 'common',
                               price: SHOP_SLEIGHT_PRICES[s.rarity] || 12, buy: () => grantSleight(s) }));
  rows[3] = lims.map(d => {
    const u = limitUnit(d.id), cur = limits[d.id].current;   // step-aware, see js/limits.js
    return { _upgrade:true, icon:d.icon, label:d.label, desc:d.desc, sub:`${cur}${u} → ${cur + limitGain(d.id)}${u}`, rarity:'common',
             price: shopLimitPrice(d), buy: () => { incrementLimit(d.id); onLimitChanged?.(d.id); } };
  });
  // Shift each row right past the label plate and pad to full width, so the
  // options land on columns SHOPG_LABEL_SPAN.. and the label columns are null.
  for (let r = 0; r < SHOPG_ROWS; r++) {
    const opts = (rows[r] || []).slice(0, SHOPG_OPTIONS);
    while (opts.length < SHOPG_OPTIONS) opts.push(null);
    rows[r] = new Array(SHOPG_LABEL_SPAN).fill(null).concat(opts);
  }

  // ~10% chance: one random filled slot becomes a "SOLD OUT" null card
  if (Math.random() < 0.10) {
    const filled = [];
    for (let r = 0; r < SHOPG_ROWS; r++) for (let c = 0; c < SHOPG_COLS; c++) if (rows[r][c]) filled.push([r, c]);
    if (filled.length) { const [r, c] = filled[Math.floor(Math.random() * filled.length)]; rows[r][c] = null; }
  }
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
  // The SELL board uses the full width and carries no row labels - what you own
  // is a mixed list, so there is no category for a plate to name.
  const rows = [[], [], [], []];
  for (let i = 0; i < SHOPG_ROWS * SHOPG_COLS; i++) rows[Math.floor(i / SHOPG_COLS)][i % SHOPG_COLS] = items[i] || null;
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
function openShopGrid() {
  shopGridActive = true;
  shopGridMode   = 'buy';
  shopGridSel    = new Set();
  shopRerollCount = (typeof shopRerollCount !== 'undefined') ? 0 : 0;
  gameTimerPaused = true;
  try { sfxShopOpen?.(); } catch (e) {}
  shopGridItems  = buildShopGridStock();
  shopGridSaved  = { rows: gridRows, cols: gridCols };
  gridRows = SHOPG_ROWS; gridCols = SHOPG_COLS;
  recomputeGridMetrics();
  document.getElementById('next-goal-bg')?.classList.remove('show');
  document.body.classList.add('shop-active');
  enterGridScreenHud('SHOP', 'shop');
  enterShopGridButtons();
  // The left column narrows so the board can take the room (css/style.css).
  // It must be applied BEFORE renderShopGrid: the tiles are positioned from
  // CARD_W/CARD_H, which recomputeGridMetrics reads off the REAL #grid-slot
  // rect - so the slot has to be at its shop width before anything measures it.
  ensureShopSquishTab();
  shopSquishSet(true, { instant: true });
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
  shopSquishSet(false, { instant: true });
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
  for (let r = 0; r < SHOPG_ROWS; r++) {
    // The row's name plate, spanning SHOPG_LABEL_SPAN cells. Inert: it is a
    // heading, and making it selectable would let a path route through it.
    if (labelled) {
      const lab = document.createElement('div');
      lab.className = 'reward-cell on-grid shop-row-label unselectable';
      lab.style.left = cellLeft(0) + 'px';
      lab.style.top  = cellTop(r) + 'px';
      lab.style.width  = (SHOPG_LABEL_SPAN * (CARD_W + CARD_GAP) - CARD_GAP) + 'px';
      lab.style.height = CARD_H + 'px';
      lab.innerHTML = `<span class="srl-icon">${SHOPG_ROW_ICONS[r] || ''}</span>`
                    + `<span class="srl-name">${SHOPG_ROW_LABELS[r] || ''}</span>`;
      fallIn(lab, r, 0);
      gridEl.appendChild(lab);
    }
    for (let c = labelled ? SHOPG_LABEL_SPAN : 0; c < SHOPG_COLS; c++) {
      const p = shopGridItems[r][c];
      const div = document.createElement('div');
      div.dataset.r = r; div.dataset.c = c;
      div.style.left = cellLeft(c) + 'px'; div.style.top = cellTop(r) + 'px';
      div.style.width = CARD_W + 'px'; div.style.height = CARD_H + 'px';
      if (!p) {
        div.className = 'reward-cell on-grid shop-tile shop-prev-null unselectable';
        div.innerHTML = `<div class="reward-icon">∅</div><div class="rwd-name">SOLD OUT</div>`;
      } else {
        const rar = p.entity ? rewardRarity(p) : (p.rarity || 'common');
        const sel = shopGridSel.has(`${r}-${c}`);
        div.className = [
          'reward-cell', 'on-grid', 'buff', 'shop-tile',
          p.entity ? 'entity' : '', p.entity ? 'entity-' + p.entity : '',
          p._upgrade ? 'shop-tile-upgrade' : '', 'rar-' + rar,
          p._sold ? 'sold' : '', sel ? 'selected' : '',
        ].filter(Boolean).join(' ');
        const chip = p._sold ? '✓' : `💰${p.price}`;
        div.innerHTML = buildShopTileInner(p) + `<div class="shop-price-chip ${p._sold ? 'sold' : (coins < p.price ? 'cant-afford' : '')}">${chip}</div>`;
        if (!p._sold) div.onclick = () => onShopGridClick(r, c);
        if (p.desc) attachRewardTooltip(div, p, 'buff');
      }
      fallIn(div, r, c - (labelled ? SHOPG_LABEL_SPAN - 1 : 0));
      gridEl.appendChild(div);
      const nm = div.querySelector('.rwd-name'); if (nm) fitRewardName(nm);
    }
  }
  renderShopCostReadout();
  updateShopGridButtons();
}

function onShopGridClick(r, c) {
  const p = shopGridItems[r]?.[c];
  if (!p || p._sold) return;
  if (shopGridMode === 'sell') { doShopSell(r, c); return; }
  const key = `${r}-${c}`;
  if (shopGridSel.has(key)) {
    const rem = new Set([...shopGridSel].filter(k => k !== key));
    if (rem.size === 0 || isGroupConnected(rem)) { shopGridSel.delete(key); renderShopGrid(); }
    return;
  }
  if (shopGridSel.size >= limits.selection.current) return;             // capped by Selection Size
  if (shopGridSel.size > 0) {
    const adj = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].some(([nr,nc]) => shopGridSel.has(`${nr}-${nc}`));
    if (!adj) return;                                                   // must be connected
  }
  shopGridSel.add(key);
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
    if (p && !p._sold && typeof p.buy === 'function') { try { p.buy(); } catch (e) { console.error('[SHOP] buy failed', e); } p._sold = true; }
  });
  try { sfxRewardGood?.(); } catch (e) {}
  showMessage(`Bought ${shopGridSel.size} - 💰${total}`, 'var(--gold)');
  shopGridSel = new Set();
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

function toggleShopSellMode() {
  shopGridMode = shopGridMode === 'buy' ? 'sell' : 'buy';
  shopGridSel = new Set();
  shopGridItems = shopGridMode === 'sell' ? buildShopSellStock() : (shopGridItems.length ? shopGridItems : buildShopGridStock());
  if (shopGridMode === 'buy') shopGridItems = buildShopGridStock();   // fresh buy board (owned items changed)
  enterGridScreenHud(shopGridMode === 'sell' ? 'SELL' : 'SHOP', 'shop');
  renderShopGrid();
}

function shopGridReroll() {
  if (shopGridMode !== 'buy') return;
  const maxRerolls = limits.reroll ? limits.reroll.current : 3;
  if (shopRerollCount >= maxRerolls) { showMessage('No rerolls left', 'var(--red)'); return; }
  const cost = 8 + shopRerollCount * 2;
  if (coins < cost) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= cost; updateCoinsUI();
  shopRerollCount++;
  // Regenerate a fresh board, preserving already-sold slots.
  const fresh = buildShopGridStock();
  for (let r = 0; r < SHOPG_ROWS; r++) for (let c = 0; c < SHOPG_COLS; c++) if (shopGridItems[r][c]?._sold) fresh[r][c] = shopGridItems[r][c];
  shopGridItems = fresh;
  shopGridSel = new Set();
  renderShopGrid();
}

function updateShopGridButtons() {
  const play = document.getElementById('btn-play');
  if (play) play.disabled = (shopGridMode !== 'buy') || shopGridSel.size === 0 || coins < shopGridSelectionCost().total;
}

// Cost / discount readout rendered INTO the hand-preview slot (#selected-cards).
function renderShopCostReadout() {
  const sc = document.getElementById('selected-cards'); if (!sc) return;
  const maxRerolls = limits.reroll ? limits.reroll.current : 3;
  const rerollCost = 8 + shopRerollCount * 2;
  const rerollLeft = Math.max(0, maxRerolls - shopRerollCount);
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
        `<button id="sc-reroll" ${shopGridMode==='sell'||rerollLeft<=0?'disabled':''}>🎲 ${rerollLeft>0?rerollCost:'·'}</button>` +
        `<button id="sc-sell" class="${shopGridMode==='sell'?'sc-sell-on':''}">${shopGridMode==='sell'?'Back':'Sell'}</button>` +
      `</div>` +
    `</div>`;
  const rb = sc.querySelector('#sc-reroll'); if (rb) rb.onclick = (e) => { e.stopPropagation(); shopGridReroll(); };
  const sb = sc.querySelector('#sc-sell');   if (sb) sb.onclick = (e) => { e.stopPropagation(); toggleShopSellMode(); };
}
