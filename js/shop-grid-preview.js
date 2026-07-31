// ════════════════════════════════════════════════════════════════════════════
// SHOP-ON-GRID PREVIEW (r114, exploratory)
// ────────────────────────────────────────────────────────────────────────────
// A design preview of "the shop, but on the play grid" — the same on-grid tile
// rendering the reward grid uses, laid out as 4 rows × 4 slots:
//   row 0 = Knacks · row 1 = Tricks · row 2 = Sleights · row 3 = Limit upgrades
// Selecting an orthogonally-CONNECTED group discounts the batch:
//   1 item = full price · 2 = −10% · 3+ = −25%.
// ~10% of grids replace one slot with a "null" (empty) card.
//
// This is a preview, not the live shop: it force-renders a 4×4 board onto #grid,
// then fully restores the real grid dims on close. Trigger with openShopGridPreview()
// (also wired to a dev-panel button).
// ════════════════════════════════════════════════════════════════════════════

let _shopPrevItems = null;          // 4×4 array of payloads (or null for empty slots)
let _shopPrevSel   = new Set();     // "r-c" selection keys
let _shopPrevSaved = null;          // { rows, cols } to restore on close
const SHOP_PREV_ROWS = 4, SHOP_PREV_COLS = 4;

function shopPrevDiscount(n) { return n >= 3 ? 0.25 : n >= 2 ? 0.10 : 0; }

function buildShopGridPreviewItems() {
  const rows = [];

  // Knacks
  const kns = (typeof KNACK_POOL !== 'undefined' ? shuffle(KNACK_POOL.slice()) : []).slice(0, SHOP_PREV_COLS);
  rows[0] = kns.map(k => ({ entity: 'knack', label: k.name, desc: k.desc, emoji: k.emoji,
                            rarity: k.rarity || 'common', price: SHOP_KNACK_PRICE }));
  // Tricks
  const tks = (typeof TRICK_POOL !== 'undefined' ? shuffle(TRICK_POOL.slice()) : []).slice(0, SHOP_PREV_COLS);
  rows[1] = tks.map(t => ({ entity: 'trick', label: t.name, desc: t.desc, emoji: trickEmoji(t),
                            rarity: t.tier || 'common', tier: t.tier || 'common',
                            price: SHOP_TRICK_PRICES[t.tier] || 8 }));
  // Sleights
  const sls = pickSleightByRarity(SHOP_PREV_COLS, new Set());
  rows[2] = sls.map(s => ({ entity: 'sleight', label: s.name, desc: s.desc, emoji: s.emoji || '🃏',
                            uses: s.durability === 'infinite' ? '∞' : `${s.durability}×`,
                            rarity: s.rarity || 'common', price: SHOP_SLEIGHT_PRICES[s.rarity] || 12 }));
  // Limit upgrades
  const lms = shuffle(LIMITS_DEF.filter(d => limits[d.id].current < limits[d.id].max)).slice(0, SHOP_PREV_COLS);
  rows[3] = lms.map(d => {
    const cur = limits[d.id].current, next = Math.min(limits[d.id].max, cur + 1);
    return { _upgrade: true, icon: d.icon, label: d.label, desc: d.desc, sub: `${cur} → ${next}`,
             rarity: 'common', price: shopLimitPrice(d) };
  });

  // Pad every row to 4 slots (in case a pool ran short)
  for (let r = 0; r < SHOP_PREV_ROWS; r++) { rows[r] = rows[r] || []; while (rows[r].length < SHOP_PREV_COLS) rows[r].push(null); }

  // ~10% chance: one random filled slot becomes a null card
  if (Math.random() < 0.10) {
    const filled = [];
    for (let r = 0; r < SHOP_PREV_ROWS; r++) for (let c = 0; c < SHOP_PREV_COLS; c++) if (rows[r][c]) filled.push([r, c]);
    if (filled.length) { const [r, c] = filled[Math.floor(Math.random() * filled.length)]; rows[r][c] = null; }
  }
  return rows;
}

function openShopGridPreview() {
  if (typeof buildShopTileInner !== 'function') return; // shop.js must be loaded
  gameTimerPaused = true;
  _shopPrevItems = buildShopGridPreviewItems();
  _shopPrevSel   = new Set();
  _shopPrevSaved = { rows: gridRows, cols: gridCols };
  gridRows = SHOP_PREV_ROWS; gridCols = SHOP_PREV_COLS;
  recomputeGridMetrics();
  document.getElementById('next-goal-bg')?.classList.remove('show');
  document.body.classList.add('reward-active', 'shop-prev-active');
  ensureShopPrevBanner();
  renderShopGridPreview();
}

function closeShopGridPreview() {
  document.body.classList.remove('reward-active', 'shop-prev-active');
  const banner = document.getElementById('shop-prev-banner'); if (banner) banner.remove();
  const gridEl = document.getElementById('grid'); if (gridEl) gridEl.innerHTML = '';
  if (_shopPrevSaved) { gridRows = _shopPrevSaved.rows; gridCols = _shopPrevSaved.cols; _shopPrevSaved = null; }
  recomputeGridMetrics();
  _shopPrevItems = null; _shopPrevSel = new Set();
  gameTimerPaused = false;
  if (typeof render === 'function') render();
}

function renderShopGridPreview() {
  const gridEl = document.getElementById('grid'); if (!gridEl || !_shopPrevItems) return;
  recomputeGridMetrics();
  gridEl.innerHTML = '';
  for (let r = 0; r < SHOP_PREV_ROWS; r++) {
    for (let c = 0; c < SHOP_PREV_COLS; c++) {
      const p = _shopPrevItems[r][c];
      const div = document.createElement('div');
      div.dataset.r = r; div.dataset.c = c;
      div.style.left = cellLeft(c) + 'px'; div.style.top = cellTop(r) + 'px';
      div.style.width = CARD_W + 'px'; div.style.height = CARD_H + 'px';

      if (!p) {
        div.className = 'reward-cell on-grid shop-prev-null unselectable';
        div.innerHTML = `<div class="reward-icon">∅</div><div class="rwd-name">SOLD OUT</div>`;
      } else {
        const rar = p.entity ? rewardRarity(p) : (p.rarity || 'common');
        const sel = _shopPrevSel.has(`${r}-${c}`);
        div.className = [
          'reward-cell', 'on-grid', 'buff', 'shop-tile',
          p.entity ? 'entity' : '', p.entity ? 'entity-' + p.entity : '',
          p._upgrade ? 'shop-tile-upgrade' : '', 'rar-' + rar,
          sel ? 'selected' : '',
        ].filter(Boolean).join(' ');
        div.innerHTML = buildShopTileInner(p) + `<div class="shop-price-chip">💰${p.price}</div>`;
        div.onclick = () => toggleShopPrevSel(r, c);
      }
      gridEl.appendChild(div);
      const nm = div.querySelector('.rwd-name'); if (nm) fitRewardName(nm);
    }
  }
  updateShopPrevBanner();
}

function toggleShopPrevSel(r, c) {
  const key = `${r}-${c}`;
  if (_shopPrevSel.has(key)) {
    // Deselect only if the remaining group stays connected
    const rem = new Set([..._shopPrevSel].filter(k => k !== key));
    if (rem.size === 0 || isGroupConnected(rem)) { _shopPrevSel.delete(key); renderShopGridPreview(); }
    return;
  }
  if (_shopPrevSel.size >= limits.selection.current) return;           // capped by Selection Size
  if (_shopPrevSel.size > 0) {
    const adj = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].some(([nr,nc]) => _shopPrevSel.has(`${nr}-${nc}`));
    if (!adj) return;                                                   // must be connected
  }
  _shopPrevSel.add(key);
  renderShopGridPreview();
}

function ensureShopPrevBanner() {
  let banner = document.getElementById('shop-prev-banner');
  if (banner) return banner;
  banner = document.createElement('div');
  banner.id = 'shop-prev-banner';
  banner.innerHTML =
    `<div id="shop-prev-title">SHOP · connected buys are discounted</div>` +
    `<div id="shop-prev-total">Select connected items — 2 = −10%, 3+ = −25%</div>` +
    `<div id="shop-prev-actions">` +
      `<button id="shop-prev-clear">Clear</button>` +
      `<button id="shop-prev-close">Close Preview</button>` +
    `</div>`;
  document.body.appendChild(banner);
  banner.querySelector('#shop-prev-clear').onclick = () => { _shopPrevSel = new Set(); renderShopGridPreview(); };
  banner.querySelector('#shop-prev-close').onclick = () => closeShopGridPreview();
  return banner;
}

function updateShopPrevBanner() {
  const totalEl = document.getElementById('shop-prev-total');
  if (!totalEl) return;
  const n = _shopPrevSel.size;
  if (n === 0) { totalEl.textContent = 'Select connected items — 2 = −10%, 3+ = −25%'; return; }
  let base = 0;
  _shopPrevSel.forEach(k => { const [r, c] = k.split('-').map(Number); const p = _shopPrevItems[r][c]; if (p) base += p.price; });
  const d = shopPrevDiscount(n);
  const total = Math.round(base * (1 - d));
  totalEl.innerHTML = d > 0
    ? `${n} items · <s>💰${base}</s> → <b>💰${total}</b> <span class="shop-prev-off">(−${Math.round(d*100)}%)</span>`
    : `${n} item · <b>💰${total}</b>`;
}
