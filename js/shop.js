// SHOP SYSTEM
// ══════════════════════════════════════════════
// The shop IS the on-grid shop (js/shop-grid-preview.js, r232). What lives here
// is what every shop surface shares: the price tables, selling, the Sleight
// draw, and the tile builder. The pre-r232 overlay shop that used to fill the
// rest of this file (shelves, service picker, reroll ladder) went in r415.
//
// r234: every price table here is scaled ONCE by PRICE_MULT (js/data/balance.js).
// Scaling the table rather than each read is what keeps the derived numbers -
// sell values, the limit step - in step with the buy price.
const SHOP_TRICK_PRICES   = scalePriceTable({ common: 5, rare: 8, epic: 12, legendary: 18 });
const SHOP_KNACK_PRICE    = priceOf(10);
const SHOP_SLEIGHT_PRICES = scalePriceTable({ common: 8, rare: 12, epic: 16, legendary: 22 });
const SHOP_LIMIT_BASE     = priceOf(15);        // coins; + SHOP_LIMIT_STEP per upgrade already purchased
const SHOP_LIMIT_STEP     = priceOf(5);

// ── Selling (r127) ──
// Owner decision: Tricks and Knacks can be sold ANYWHERE (tray / HUD), any time.
// Sleights are NOT sellable - they leave only by being played, discarded, or removed in the shop.
// trickSellValue / knackSellValue live in js/shop-grid-preview.js (owner spec).
function sellTrick(trick) {
  if (!trick) return;
  if (typeof feelinLuckyIntercept === 'function' && feelinLuckyIntercept(trick)) { if (typeof hideTrickTooltip === 'function') hideTrickTooltip(); return; }
  const idx = trickTray.findIndex(b => b.id === trick.id);
  if (idx >= 0) trickTray.splice(idx, 1);
  const aidx = acquiredTricks.findIndex(b => b.id === trick.id);
  if (aidx >= 0) acquiredTricks.splice(aidx, 1);
  const v = trickSellValue(trick);
  coins += v; updateCoinsUI();
  noteMessage(`Sold ${trick.name} · +${v} credits`, 'var(--gold)');
  if (typeof hideTrickTooltip === 'function') hideTrickTooltip();
  if (typeof renderTrickTray === 'function') renderTrickTray();
  render();
}

function sellKnack(knack) {
  if (!knack) return;
  const aidx = acquiredKnacks.findIndex(t => t.id === knack.id);
  if (aidx >= 0) acquiredKnacks.splice(aidx, 1);
  const v = knackSellValue();
  coins += v; updateCoinsUI();
  noteMessage(`Sold ${knack.name} · +${v} credits`, 'var(--gold)');
  if (typeof hideKnackTooltip === 'function') hideKnackTooltip();
  if (typeof updateKnackList === 'function') updateKnackList();
  render();
}

function shopLimitPrice(def) {
  // price scales on number of purchases, not raw units (so a step of 15/3 doesn't over-charge)
  const l = limits[def.id];
  const purchases = (l.current - l.base) / (l.step || 1);
  return SHOP_LIMIT_BASE + purchases * SHOP_LIMIT_STEP;
}

// Picks `count` sleights on the shared rarity table (js/data/balance.js), Luck
// included, cascading DOWN when the rolled tier has nothing left.
//
// It had its own copy of the roll-and-cascade loop, and the copy rolled
// `Math.random() * 100` against a running total of the weights - which is only
// the same thing while they add up to 100. luckTierWeights makes them sum ABOVE
// 100, so at any Luck at all a roll past the total fell through to targetIdx 0
// and handed back a common. It goes through pickEntityByRarity now, which
// normalises by the real total.
function pickSleightByRarity(count, excluded) {
  const result = [];
  const usedIds = new Set(excluded);
  for (let i = 0; i < count; i++) {
    const pool = SLEIGHT_POOL.filter(j => !usedIds.has(j.id) && sleightOfferable(j) && !_shopModeBanned(j.id));
    if (!pool.length) break;
    const pick = pickEntityByRarity(pool, j => (j.rarity || 'common'))
              || pool[Math.floor(Math.random() * pool.length)];
    result.push(pick);
    usedIds.add(pick.id);
  }
  return result;
}

function _grantedSleightSet() {
  const s = new Set();
  [...drawPile, ...playedPile].forEach(c => { if (c._isSleight) s.add(c.sleightId); });
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++)
      if (gridData[r]?.[c]?._isSleight) s.add(gridData[r][c].sleightId);
  return s;
}

// The one mode ban every offer pool reads (see survivalEntityBanned).
function _shopModeBanned(id) { return typeof survivalEntityBanned === 'function' && survivalEntityBanned(id); }

function triggerShop() {
  clearInterval(roundInterval);
  roundInterval = null;
  gameTimerPaused = true;
  openShopGrid();
}

// ── CRT/neon shop tiles (shared visual language with the reward grid) ──
// Each shop tile reuses the reward grid's entity look - rarity = neon border,
// Orbitron name, scanlines, sleight tab, knack diamond - with a price chip
// pinned to the corner. Descriptions live in the shared reward tooltip on hover.
function buildShopTileInner(p) {
  if (p._cardBuff) {
    // A buffed-card offer: the card's face large, the buff as the name band.
    return `<div class="stc-face">${p.icon}</div><div class="rwd-name">${p.sub || ''}</div>`;
  }
  if (p.entity === 'knack') {
    return `<div class="rwd-diamond"><span class="rwd-diamond-emoji">${p.emoji || p.icon}</span></div>`
         + `<div class="rwd-name">${p.label}</div>`;
  }
  if (p.entity === 'trick') {
    // Shop shows the real trick glyph (you're deciding what to buy) rather than
    // the reward grid's mystery placeholder.
    return `<div class="rwd-glyph">✦</div><div class="rwd-art">${p.emoji || '✦'}</div><div class="rwd-name">${p.label}</div>`;
  }
  if (p.entity === 'sleight') {
    return `<div class="rwd-tab">▶</div><div class="rwd-art">${p.emoji || '🃏'}</div><div class="rwd-name">${p.label}</div>`
         + (p.uses != null ? `<div class="rwd-uses">${p.uses}</div>` : '');
  }
  // upgrade / resource tile: icon + name + progress sub-line
  return `<div class="reward-icon">${p.icon}</div><div class="rwd-name">${p.label}</div>`
       + (p.sub ? `<div class="shop-tile-sub">${p.sub}</div>` : '');
}

// Build one purchasable tile. `altLabel` overrides the price chip: '✓' is shown
// when sold, 'MAXED' for maxed upgrades. Sold/maxed tiles dim + ignore clicks.
