// SHOP SYSTEM
// ══════════════════════════════════════════════

// ── Legacy service infrastructure (kept, buttons hidden) ──
const SHOP_PRICES   = { buy: 4, remove: 3, duplicate: 4, suit: 4, combine: 5, swaps: 10, discards: 10 };
const SHOP_SVC_MAX  = { remove: 3, duplicate: 3, suit: 3, combine: 3, swaps: 1, discards: 1 };
let shopPurchaseCount = { buy: 0, remove: 0, duplicate: 0, suit: 0, combine: 0, swaps: 0, discards: 0 };
function shopPrice(key) { return Math.round(SHOP_PRICES[key] * Math.pow(1.2, shopPurchaseCount[key] || 0)); }
let shopSvcUsed = { remove: 0, duplicate: 0, suit: 0, combine: 0, swaps: 0, discards: 0 };

// Service state machine
let svcMode = null;
let svcStep = 0;
let svcPicked = [];

// ── New shop state ──
const SHOP_TRICK_PRICES    = { common: 5, rare: 8, epic: 12, legendary: 18, mythic: 25 };
const SHOP_KNACK_PRICE  = 10;
const SHOP_SLEIGHT_PRICES = { common: 8, rare: 12, epic: 16, legendary: 22, mythic: 28 };
const SHOP_LIMIT_BASE   = 15; // coins; +5 per upgrade already purchased

let shopItems       = null; // { tricks:[], limits:[], knacks:[], sleights:[] }
let shopPurchased   = new Set();
let shopRerollCount = 0;

function shopLimitPrice(def) {
  return SHOP_LIMIT_BASE + (limits[def.id].current - limits[def.id].base) * 5;
}

// Picks `count` sleights using weighted rarity tiers: common 60%, rare 28%, epic 10%, legendary 2%.
// Cascades to lower rarity if the rolled tier has no available sleights.
function pickSleightByRarity(count, excluded) {
  const TIER_ORDER   = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  const TIER_WEIGHTS = [59, 28, 10, 2, 1];
  const result = [];
  const usedIds = new Set(excluded);
  for (let i = 0; i < count; i++) {
    const pool = SLEIGHT_POOL.filter(j => !usedIds.has(j.id));
    if (!pool.length) break;
    const roll = Math.random() * 100;
    let cum = 0, targetIdx = 0;
    for (let ti = 0; ti < TIER_WEIGHTS.length; ti++) {
      cum += TIER_WEIGHTS[ti];
      if (roll < cum) { targetIdx = ti; break; }
    }
    let pick = null;
    for (let ti = targetIdx; ti >= 0 && !pick; ti--) {
      const tp = pool.filter(j => j.rarity === TIER_ORDER[ti]);
      if (tp.length) pick = tp[Math.floor(Math.random() * tp.length)];
    }
    if (!pick) pick = pool[Math.floor(Math.random() * pool.length)];
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

function generateShopItems() {
  const ownedBcIds    = new Set(acquiredTricks.map(b => b.id));
  const ownedKnackIds = new Set(acquiredKnacks.map(t => t.id));
  const grantedSleights = _grantedSleightSet();

  const tricks    = shuffle(TRICK_POOL.filter(b => !ownedBcIds.has(b.id))).slice(0, 3);
  const lims   = pickWeightedLimits(2);
  const knacks = shuffle(KNACK_POOL.filter(t => !ownedKnackIds.has(t.id))).slice(0, 2);
  const sleights = pickSleightByRarity(3, grantedSleights);

  shopItems = { tricks, limits: lims, knacks, sleights };
}

// Reroll: only regenerate unpurchased slots; purchased slots remain as sold.
function rerollShopItems() {
  const ownedBcIds    = new Set(acquiredTricks.map(b => b.id));
  const ownedKnackIds = new Set(acquiredKnacks.map(t => t.id));
  const grantedSleights = _grantedSleightSet();

  // Tricks
  const usedBcIds = new Set(ownedBcIds);
  shopItems.tricks.forEach((trick, i) => { if (trick && shopPurchased.has(`trick-${i}`)) usedBcIds.add(trick.id); });
  const freshTricks = shuffle(TRICK_POOL.filter(b => !usedBcIds.has(b.id)));
  let bi = 0;
  shopItems.tricks = shopItems.tricks.map((trick, i) => shopPurchased.has(`trick-${i}`) ? trick : (freshTricks[bi++] || trick));

  // Limits
  const usedLimIds = new Set();
  shopItems.limits.forEach((d, i) => { if (d && shopPurchased.has(`limit-${i}`)) usedLimIds.add(d.id); });
  const freshLims = pickWeightedLimits(8, LIMITS_DEF.filter(d => limits[d.id].current < limits[d.id].max && !usedLimIds.has(d.id)));
  let li = 0;
  shopItems.limits = shopItems.limits.map((d, i) => shopPurchased.has(`limit-${i}`) ? d : (freshLims[li++] || d));

  // Knacks
  const usedTotIds = new Set(ownedKnackIds);
  shopItems.knacks.forEach((t, i) => { if (t && shopPurchased.has(`knack-${i}`)) usedTotIds.add(t.id); });
  const freshTots = shuffle(KNACK_POOL.filter(t => !usedTotIds.has(t.id)));
  let ti = 0;
  shopItems.knacks = shopItems.knacks.map((t, i) => shopPurchased.has(`knack-${i}`) ? t : (freshTots[ti++] || t));

  // Sleights
  const usedJkIds = new Set(grantedSleights);
  shopItems.sleights.forEach((j, i) => { if (j && shopPurchased.has(`sleight-${i}`)) usedJkIds.add(j.id); });
  const slotsToFill = shopItems.sleights.filter((_, i) => !shopPurchased.has(`sleight-${i}`)).length;
  const freshJks = pickSleightByRarity(slotsToFill, usedJkIds);
  let ji = 0;
  shopItems.sleights = shopItems.sleights.map((j, i) => shopPurchased.has(`sleight-${i}`) ? j : (freshJks[ji++] || j));
}

function triggerShop() {
  clearInterval(roundInterval);
  roundInterval = null;
  gameTimerPaused = true;
  sfxShopOpen();
  shopPurchased   = new Set();
  shopRerollCount = 0;
  shopSvcUsed     = { remove: 0, duplicate: 0, suit: 0, combine: 0, swaps: 0, discards: 0 };
  generateShopItems();
  renderShop();
  document.getElementById('shop-overlay').classList.add('show');
}

function renderShop() {
  document.getElementById('shop-coins-val').textContent = coins;
  if (!shopItems) return;
  renderShopTricks();
  renderShopLimits();
  renderShopKnacks();
  renderShopSleights();
  renderShopFooter();
}

function renderShopTricks() {
  const row = document.getElementById('shop-trick-row');
  if (!row) return;
  row.innerHTML = '';
  shopItems.tricks.forEach((trick, i) => {
    const key = `trick-${i}`;
    const purchased = shopPurchased.has(key);
    const price = SHOP_TRICK_PRICES[trick.tier] || 8;
    const canAfford = coins >= price;
    const tier = trick.tier || 'common';
    const item = document.createElement('div');
    item.className = `shop-item${purchased ? ' purchased' : ''}`;
    item.innerHTML = `
      <div class="shop-trick-card trick-tier-${tier}">
        <div class="trick-tier-label">${tier.toUpperCase()}</div>
        <div class="shop-trick-emoji">${trickEmoji(trick)}</div>
        <div class="trick-name">${trick.name}</div>
      </div>
      <div class="shop-item-price${purchased ? ' purchased' : (!canAfford ? ' cant-afford' : '')}">
        ${purchased ? '\u2713' : '💰' + price}
      </div>`;
    const cardEl = item.querySelector('.shop-trick-card');
    attachHoverHold(cardEl, () => showTrickDescTooltip(trick, cardEl), hideTrickDescTooltip);
    if (!purchased) cardEl.addEventListener('click', () => {
      if (cardEl._lpFired) { cardEl._lpFired = false; return; } // long-press = read, not buy
      hideTrickDescTooltip();
      buyShopTrick(i);
    });
    row.appendChild(item);
  });
}

function renderShopLimits() {
  const row = document.getElementById('shop-limits-row');
  if (!row) return;
  row.innerHTML = '';
  shopItems.limits.forEach((def, i) => {
    const key = `limit-${i}`;
    const purchased = shopPurchased.has(key);
    const maxed = limits[def.id].current >= limits[def.id].max;
    const price = shopLimitPrice(def);
    const canAfford = coins >= price;
    const cur = limits[def.id].current;
    const next = Math.min(cur + 1, limits[def.id].max);
    const item = document.createElement('div');
    item.className = `shop-item${purchased || maxed ? ' purchased' : ''}`;
    item.innerHTML = `
      <div class="shop-limit-card${maxed ? ' maxed' : ''}">
        <div class="shop-limit-icon">${def.icon}</div>
        <div class="shop-limit-label">${def.label}</div>
        <div class="shop-limit-progress">${cur} → ${next}</div>
        <div class="shop-limit-desc">${def.desc}</div>
      </div>
      <div class="shop-item-price${purchased || maxed ? ' purchased' : (!canAfford ? ' cant-afford' : '')}">
        ${maxed ? 'MAXED' : purchased ? '\u2713' : '💰' + price}
      </div>`;
    if (!purchased && !maxed) item.querySelector('.shop-limit-card').addEventListener('click', () => buyShopLimit(i));
    row.appendChild(item);
  });
}

function renderShopKnacks() {
  const row = document.getElementById('shop-knack-row');
  if (!row) return;
  row.innerHTML = '';
  shopItems.knacks.forEach((knack, i) => {
    const key = `knack-${i}`;
    const purchased = shopPurchased.has(key);
    const canAfford = coins >= SHOP_KNACK_PRICE;
    const item = document.createElement('div');
    item.className = `shop-item${purchased ? ' purchased' : ''}`;
    item.innerHTML = `
      <div class="shop-knack-card">
        <div class="shop-knack-emoji">${knack.emoji}</div>
        <div class="shop-knack-name">${knack.name}</div>
        <div class="shop-knack-desc">${knack.desc}</div>
      </div>
      <div class="shop-item-price${purchased ? ' purchased' : (!canAfford ? ' cant-afford' : '')}">
        ${purchased ? '\u2713' : '💰' + SHOP_KNACK_PRICE}
      </div>`;
    if (!purchased) item.querySelector('.shop-knack-card').addEventListener('click', () => buyShopKnack(i));
    row.appendChild(item);
  });
}

function renderShopSleights() {
  const row = document.getElementById('shop-sleight-row');
  if (!row) return;
  row.innerHTML = '';
  shopItems.sleights.forEach((sleight, i) => {
    const key = `sleight-${i}`;
    const purchased = shopPurchased.has(key);
    const price = SHOP_SLEIGHT_PRICES[sleight.rarity] || 12;
    const canAfford = coins >= price;
    const charges = sleight.durability === 'infinite' ? '\u221e' : `${sleight.durability}\u00d7`;
    const item = document.createElement('div');
    item.className = `shop-item${purchased ? ' purchased' : ''}`;
    item.innerHTML = `
      <div class="shop-sleight-card jk-rarity-${sleight.rarity || 'common'}">
        <div class="shop-sleight-emoji">${sleight.emoji || '🃏'}</div>
        <div class="shop-sleight-name">${sleight.name}</div>
        <div class="shop-sleight-desc">${sleight.desc}</div>
        <div class="shop-sleight-charges">${charges}</div>
      </div>
      <div class="shop-item-price${purchased ? ' purchased' : (!canAfford ? ' cant-afford' : '')}">
        ${purchased ? '\u2713' : '💰' + price}
      </div>`;
    if (!purchased) item.querySelector('.shop-sleight-card').addEventListener('click', () => buyShopSleight(i));
    row.appendChild(item);
  });
}

function renderShopFooter() {
  const maxRerolls = limits.reroll ? limits.reroll.current : 3;
  const isDebuff   = shopRerollCount >= maxRerolls;
  const nextCost   = 8 + shopRerollCount * 2;
  const costEl  = document.getElementById('shop-reroll-cost');
  const infoEl  = document.getElementById('shop-reroll-info');
  if (costEl) costEl.textContent = isDebuff ? 'debuff' : nextCost;
  if (infoEl) infoEl.textContent = isDebuff
    ? 'cost: corrupts a grid card'
    : `${maxRerolls - shopRerollCount} reroll${maxRerolls - shopRerollCount !== 1 ? 's' : ''} left`;
  const btn = document.getElementById('shop-reroll-btn');
  if (btn) btn.disabled = isDebuff && !hasGridCardForDebuff();
}

function hasGridCardForDebuff() {
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const card = gridData[r]?.[c];
      if (card && !card._isTrick && !card._isSleight && !card._isStone && card.rank) return true;
    }
  return false;
}

function buyShopTrick(i) {
  const trick = shopItems?.tricks[i];
  const key = `trick-${i}`;
  if (!trick || shopPurchased.has(key)) return;
  const price = SHOP_TRICK_PRICES[trick.tier] || 8;
  if (coins < price) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= price;
  shopPurchased.add(key);
  injectTrickAfterReward(trick);
  renderShop();
  updateCoinsUI();
}

function buyShopLimit(i) {
  const def = shopItems?.limits[i];
  const key = `limit-${i}`;
  if (!def || shopPurchased.has(key)) return;
  if (limits[def.id].current >= limits[def.id].max) return;
  const price = shopLimitPrice(def);
  if (coins < price) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= price;
  shopPurchased.add(key);
  incrementLimit(def.id);
  onLimitChanged(def.id);
  renderShop();
  updateCoinsUI();
  showMessage(`${def.icon} ${def.label} upgraded!`, '#5ad4c0');
}

function buyShopKnack(i) {
  const knack = shopItems?.knacks[i];
  const key = `knack-${i}`;
  if (!knack || shopPurchased.has(key)) return;
  if (coins < SHOP_KNACK_PRICE) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= SHOP_KNACK_PRICE;
  shopPurchased.add(key);
  acquiredKnacks.push({ ...knack });
  updateKnackList();
  renderShop();
  updateCoinsUI();
  showMessage(`${knack.emoji} ${knack.name}!`, '#d4a017');
}

function buyShopSleight(i) {
  const sleight = shopItems?.sleights[i];
  const key = `sleight-${i}`;
  if (!sleight || shopPurchased.has(key)) return;
  const price = SHOP_SLEIGHT_PRICES[sleight.rarity] || 12;
  if (coins < price) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= price;
  shopPurchased.add(key);
  grantSleight(sleight);
  renderShop();
  updateCoinsUI();
  showMessage(`${sleight.emoji} ${sleight.name}!`, '#c07aee');
}

function doShopReroll() {
  const maxRerolls = limits.reroll ? limits.reroll.current : 3;
  const isDebuff   = shopRerollCount >= maxRerolls;
  if (isDebuff) {
    const targets = [];
    for (let r = 0; r < gridRows; r++)
      for (let c = 0; c < gridCols; c++) {
        const card = gridData[r]?.[c];
        if (card && !card._isTrick && !card._isSleight && !card._isStone && card.rank) targets.push([r, c]);
      }
    if (targets.length === 0) { showMessage('No cards to corrupt!', 'var(--red)'); return; }
    const [tr, tc] = targets[Math.floor(Math.random() * targets.length)];
    corruptCard(tr, tc);
    render();
    showMessage('💀 Reroll: a card was corrupted!', '#9b4dca');
    // Debuff reroll fully refills the shop — purchased/empty slots come back stocked
    shopRerollCount++;
    shopPurchased = new Set();
    generateShopItems();
    renderShop();
    return;
  } else {
    const cost = 8 + shopRerollCount * 2;
    if (coins < cost) { showMessage('Not enough credits', 'var(--red)'); return; }
    coins -= cost;
    updateCoinsUI();
  }
  shopRerollCount++;
  rerollShopItems();
  renderShop();
}

document.getElementById('shop-reroll-btn').addEventListener('click', doShopReroll);

function refreshShopAffordability() {
  if (shopItems) renderShop();
}

// ── Build the card picker for services ──
// source: 'deck' | 'grid' | 'both'
// maxSelect: how many cards to pick
function openSvcPicker(title, sub, source, maxSelect, onConfirm) {
  svcPicked = [];
  document.getElementById('svc-picker-title').textContent = title;
  document.getElementById('svc-picker-sub').textContent = sub;
  document.getElementById('svc-suit-choices').style.display = 'none';
  document.getElementById('svc-confirm').disabled = true;

  const grid = document.getElementById('svc-card-grid');
  grid.innerHTML = '';

  const allCards = [];

  // Grid cards (exclude Tricks — they aren't real deck cards)
  if (source === 'grid' || source === 'both') {
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const card = gridData[r][c];
        if (card && !card._isTrick) allCards.push({ ...card, loc: 'grid', r, c });
      }
    }
  }

  // Deck cards (future + past, deduplicated by key)
  if (source === 'deck' || source === 'both') {
    const seen = new Set();
    // Mark grid cards as seen so deck section shows only off-grid cards
    for (let r = 0; r < gridRows; r++)
      for (let c = 0; c < gridCols; c++)
        if (gridData[r][c] && !gridData[r][c]._isTrick) seen.add(cardKey(gridData[r][c].rank, gridData[r][c].suit));
    [...drawPile].forEach(card => {
      const k = cardKey(card.rank, card.suit);
      if (!seen.has(k)) { seen.add(k); allCards.push({ ...card, loc: 'deck' }); }
    });
  }

  const SUIT_ORDER = { '♣': 0, '♦': 1, '♥': 2, '♠': 3 };
  const RANK_ORDER = { 'A':0,'2':1,'3':2,'4':3,'5':4,'6':5,'7':6,'8':7,'9':8,'10':9,'J':10,'Q':11,'K':12 };

  allCards.sort((a, b) => {
    const sd = (SUIT_ORDER[a.suit] ?? 4) - (SUIT_ORDER[b.suit] ?? 4);
    if (sd !== 0) return sd;
    return (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
  });

  let currentSuit = null;
  allCards.forEach((card, idx) => {
    // Insert a full-width suit row label when suit changes
    if (card.suit !== currentSuit) {
      currentSuit = card.suit;
      const row = document.createElement('div');
      row.className = 'svc-suit-row';
      row.style.cssText = 'width:100%;display:flex;align-items:center;gap:4px;margin:2px 0 0;';
      row.innerHTML = `<span class="svc-suit-label ${suitClass(card.suit)}" style="font-size:13px">${card.suit}</span><hr style="flex:1;border:none;border-top:1px solid rgba(255,255,255,0.1)">`;
      grid.appendChild(row);
    }
    const k = cardKey(card.rank, card.suit);
    const pp = permPips[k] || 0;
    const pm = permMult[k] || 0;
    const isCombined = !!card.combined;
    const el = document.createElement('div');
    el.className = `svc-card ${suitClass(card.suit)}${pp && pm ? ' has-both' : pp ? ' has-pip' : pm ? ' has-mult' : ''}`;

    const combinedBadge = isCombined
      ? `<div style="position:absolute;top:2px;right:2px;font-size:7px;color:#9b59b6;font-weight:700">⚭</div>` : '';
    const pipBadge  = pp ? `<div style="position:absolute;bottom:0;left:0;background:#3a6fca;border-radius:0 3px 0 4px;padding:1px 3px;font-size:6px;color:#fff;font-weight:700;font-family:'Cinzel',serif">+${pp}p</div>` : '';
    const multBadge = pm ? `<div style="position:absolute;bottom:0;right:0;background:#c0392b;border-radius:3px 0 4px 0;padding:1px 3px;font-size:6px;color:#fff;font-weight:700;font-family:'Cinzel',serif">+${pm}m</div>` : '';

    const combinedSuit = isCombined ? `<span style="font-size:7px;opacity:0.7">${card.suit2}</span>` : '';

    el.innerHTML = `${combinedBadge}${card.rank}<div class="svc-c-suit">${card.suit}${combinedSuit}</div>${pipBadge}${multBadge}`;
    el.dataset.idx = idx;
    el.addEventListener('click', () => {
      const alreadyIdx = svcPicked.findIndex(p => p.idx === idx);
      if (alreadyIdx > -1) {
        svcPicked.splice(alreadyIdx, 1);
        el.classList.remove('selected-svc');
      } else if (svcPicked.length < maxSelect) {
        svcPicked.push({ ...card, idx });
        el.classList.add('selected-svc');
      }
      document.getElementById('svc-confirm').disabled = svcPicked.length !== maxSelect;
    });
    grid.appendChild(el);
  });

  document.getElementById('svc-confirm').onclick = () => onConfirm(svcPicked);
  document.getElementById('svc-picker').classList.add('show');
}

function closeSvcPicker() {
  document.getElementById('svc-picker').classList.remove('show');
  document.getElementById('svc-suit-choices').style.display = 'none';
  svcMode = null;
  svcPicked = [];
  // Deactivate service buttons
  document.querySelectorAll('.svc-btn').forEach(b => b.classList.remove('active-svc'));
}

// ── Service: Remove ──
document.getElementById('svc-remove-btn').addEventListener('click', () => {
  if (coins < shopPrice('remove') || shopSvcUsed.remove >= SHOP_SVC_MAX.remove) return;
  document.getElementById('svc-remove-btn').classList.add('active-svc');
  openSvcPicker(
    'Remove a Card',
    'Choose one card to permanently remove from your deck',
    'both', 1,
    (picked) => {
      if (picked.length !== 1) return;
      coins -= shopPrice('remove');
      shopPurchaseCount.remove++;
      shopSvcUsed.remove++;
      expectedDeckTotal--;
      const { rank, suit, loc, r, c } = picked[0];
      if (loc === 'deck') {
        drawPile = drawPile.filter(card => !(card.rank === rank && card.suit === suit));
        playedPile = playedPile.filter(card => !(card.rank === rank && card.suit === suit));
      } else {
        const drawn = drawCard();
        gridData[r][c] = drawn || gridData[r][c]; // keep existing if deck empty
        render();
      }
      closeSvcPicker();
      renderShop();
      updateCoinsUI();
    }
  );
});

// ── Service: Duplicate ──
document.getElementById('svc-duplicate-btn').addEventListener('click', () => {
  if (coins < shopPrice('duplicate') || shopSvcUsed.duplicate >= SHOP_SVC_MAX.duplicate) return;
  document.getElementById('svc-duplicate-btn').classList.add('active-svc');
  openSvcPicker(
    'Duplicate a Card',
    'Choose one card — a copy will be added to your future deck',
    'both', 1,
    (picked) => {
      if (picked.length !== 1) return;
      coins -= shopPrice('duplicate');
      shopPurchaseCount.duplicate++;
      shopSvcUsed.duplicate++;
      expectedDeckTotal++;
      drawPile.push({ rank: picked[0].rank, suit: picked[0].suit });
      drawPile = shuffle(drawPile);
      updateDeckHud();
      closeSvcPicker();
      renderShop();
      updateCoinsUI();
    }
  );
});

// ── Service: Change Suit ──
document.getElementById('svc-suit-btn').addEventListener('click', () => {
  if (coins < shopPrice('suit') || shopSvcUsed.suit >= SHOP_SVC_MAX.suit) return;
  document.getElementById('svc-suit-btn').classList.add('active-svc');
  openSvcPicker(
    'Change Suit — Step 1',
    'Choose 2 cards to change suit',
    'both', 2,
    (picked) => {
      if (picked.length !== 2) return;
      applySuitChange(picked);
    }
  );
});

function applySuitChange(pickedCards) {
  let cardIndex = 0;
  const newSuits = [];

  function promptSuit() {
    const card = pickedCards[cardIndex];
    document.getElementById('svc-picker-title').textContent =
      `Choose new suit for ${card.rank}${card.suit}`;
    document.getElementById('svc-picker-sub').textContent = '';
    document.getElementById('svc-card-grid').innerHTML = '';
    document.getElementById('svc-confirm').disabled = true;

    const suitChoices = document.getElementById('svc-suit-choices');
    suitChoices.style.display = 'flex';
    suitChoices.innerHTML = '';
    SUITS.forEach(s => {
      if (s === card.suit) return;
      const btn = document.createElement('div');
      btn.className = 'suit-choice';
      btn.textContent = s;
      btn.style.color = { '♥':'var(--suit-hearts)', '♦':'var(--suit-diamonds)', '♠':'var(--suit-spades)', '♣':'var(--suit-clubs)' }[s] || 'var(--cream)';
      btn.style.background = '#f5efe0';
      btn.addEventListener('click', () => {
        newSuits[cardIndex] = s;
        cardIndex++;
        if (cardIndex < pickedCards.length) {
          promptSuit();
        } else {
          coins -= shopPrice('suit');
          shopPurchaseCount.suit++;
          shopSvcUsed.suit++;
          pickedCards.forEach((card, i) => {
            const newSuit = newSuits[i];
            if (card.loc === 'grid') {
              gridData[card.r][card.c] = { ...gridData[card.r][card.c], suit: newSuit };
            } else {
              const updateInDeck = (deck) => deck.map(c =>
                c.rank === card.rank && c.suit === card.suit ? { ...c, suit: newSuit } : c
              );
              drawPile = updateInDeck(drawPile);
            }
          });
          render();
          closeSvcPicker();
          renderShop();
          updateCoinsUI();
        }
      });
      suitChoices.appendChild(btn);
    });
  }
  promptSuit();
}

// ── Service: Combine ──
document.getElementById('svc-combine-btn').addEventListener('click', () => {
  if (coins < shopPrice('combine') || shopSvcUsed.combine >= SHOP_SVC_MAX.combine) return;
  document.getElementById('svc-combine-btn').classList.add('active-svc');
  openSvcPicker(
    'Combine 2 Cards',
    'Choose 2 cards from the same pool (both grid or both deck)',
    'both', 2,
    (picked) => {
      if (picked.length !== 2) return;
      if (picked[0].loc !== picked[1].loc) {
        document.getElementById('svc-picker-sub').textContent =
          '⚠ Both cards must be from the same pool (grid or deck). Try again.';
        document.querySelectorAll('.svc-card.selected-svc').forEach(el => el.classList.remove('selected-svc'));
        svcPicked = [];
        document.getElementById('svc-confirm').disabled = true;
        return;
      }
      coins -= shopPrice('combine');
      shopPurchaseCount.combine++;
      shopSvcUsed.combine++;
      expectedDeckTotal--;
      const [a, b] = picked;
      const combined = { rank: a.rank, suit: a.suit, rank2: b.rank, suit2: b.suit, combined: true };
      if (a.loc === 'grid') {
        gridData[a.r][a.c] = combined;
        gridData[b.r][b.c] = drawCard() || null;
        render();
      } else {
        let removedA = false, removedB = false;
        drawPile = drawPile.filter(c => {
          if (!removedA && c.rank === a.rank && c.suit === a.suit) { removedA = true; return false; }
          if (!removedB && c.rank === b.rank && c.suit === b.suit) { removedB = true; return false; }
          return true;
        });
        if (!removedA) playedPile = playedPile.filter(c => {
          if (c.rank === a.rank && c.suit === a.suit) { removedA = true; return false; }
          return true;
        });
        if (!removedB) playedPile = playedPile.filter(c => {
          if (c.rank === b.rank && c.suit === b.suit) { removedB = true; return false; }
          return true;
        });
        drawPile.push(combined);
        drawPile = shuffle(drawPile);
      }
      closeSvcPicker();
      renderShop();
      updateCoinsUI();
    }
  );
});

// ── Service: +1 Swap ──
document.getElementById('svc-swaps-btn').addEventListener('click', () => {
  if (coins < shopPrice('swaps') || shopSvcUsed.swaps >= SHOP_SVC_MAX.swaps) return;
  coins -= shopPrice('swaps');
  shopPurchaseCount.swaps++;
  shopSvcUsed.swaps++;
  swaps++;
  updateCoinsUI();
  renderShop();
  showMessage('+1 SWAP THIS ROUND', '#c9a84c');
});

// ── Service: +1 Discard ──
document.getElementById('svc-discards-btn').addEventListener('click', () => {
  if (coins < shopPrice('discards') || shopSvcUsed.discards >= SHOP_SVC_MAX.discards) return;
  coins -= shopPrice('discards');
  shopPurchaseCount.discards++;
  shopSvcUsed.discards++;
  discards++;
  updateCoinsUI();
  renderShop();
  showMessage('+1 DISCARD THIS ROUND', '#c9a84c');
});

document.getElementById('svc-cancel').addEventListener('click', () => {
  closeSvcPicker();
});

document.getElementById('shop-close').addEventListener('click', () => {
  document.getElementById('shop-overlay').classList.remove('show');
  closeSvcPicker();
  shopItems = null;
  gameTimerPaused = false;
  if (shopFromNodeFlow) {
    shopFromNodeFlow = false;
    drainLevelUpQueue(); // continue to next round (node-based flow)
  } else {
    startRoundTimer();
  }
});

// ══════════════════════════════════════════════
// HAND UNLOCK SYSTEM
// ══════════════════════════════════════════════
