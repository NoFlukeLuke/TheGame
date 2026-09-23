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

// ══ THE SHOP SPENDS THE ROUND'S LEFTOVER STOCK (r307) ══════════════════════
// A SWAP moves a tile. A DISCARD rerolls a row. There is no separate shop
// currency for either and no cap of their own: what you carried out of the
// round IS the budget, which is the whole reason to finish a round holding
// something back. In the node flow those globals still hold the finished
// round's leftovers when the shop opens (the reset runs later, in
// triggerLevelUp), and on a Survival mid-round visit spending them really does
// cost the rest of the round.
//
// SWAP IS THE BOARD'S OWN GESTURE, deliberately: double-tap to lift a tile,
// tap an orthogonal neighbour to trade them - the same two taps that swap two
// cards during a round (onCardTap in js/input.js), with the same Free Range
// exemption and the same Steady Hand bypass. Routing it through the SELECTION
// instead would have been unreachable: a row label weighs 2 against Selection
// Size (below), so lifting two of them is 4 against a cap that starts at 3.
let shopSwapPending = null;        // "r-c" of the lifted tile, or null
let _shopTapKey = null, _shopTapAt = 0;
const SHOP_DBLTAP_MS = 350;        // DOUBLE_TAP_MS, matched deliberately

// Multi-buy discount: a flat rate per ADDITIONAL item in the connected group.
// BAL.shop_discount.per_item (3%) as shipped; Bulk Buyer raises it to
// bulk_per_item (5%). Selection Size caps the group, so no cap of its own.
function shopGridDiscountRate() {
  const d = (typeof BAL !== 'undefined' && BAL.shop_discount) || { per_item: 3, bulk_per_item: 5 };
  return ((typeof hasKnack === 'function' && hasKnack('bulk_buyer')) ? d.bulk_per_item : d.per_item) / 100;
}
function shopGridDiscount(n) { return Math.max(0, n - 1) * shopGridDiscountRate(); }

// Haggler: 5% off every shop price. Read live (the knack can be bought in this
// very shop), and only on the BUY side - sell-back values are what YOU are paid.
function shopEffPrice(p) {
  const off = (typeof hasKnack === 'function' && hasKnack('haggler')) ? 0.05 : 0;
  return Math.max(1, Math.round(p.price * (1 - off)));
}

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
//
// r310: WHILE THE GOAL HAND'S TALLY IS STILL PLAYING, THE SWAP WAITS. Survival
// and Flow open their pick-of-three DURING the goal dance (right after the fly,
// js/score-dance.js), and this function is what that pick opens through - so the
// location chip landed on top of the score chips while the final hand was still
// counting up, and the one readout explaining the hand was covered by a label.
// The takeover HUD is stashed instead and applied when the dance completes, is
// SKIPPED (dncFF - a skipped hand is not being watched, so the location may
// come up at once), or aborts. Only the HUD swap is deferred: the tiles, the
// pause and everything else about the screen open exactly as before.
let _gridHudPending = null;
function applyPendingGridHud() {
  if (!_gridHudPending) return;
  const p = _gridHudPending; _gridHudPending = null;
  enterGridScreenHud(p.locLabel, p.tone);
}
function enterGridScreenHud(locLabel, tone) {
  if (typeof dncGoalLive !== 'undefined' && dncGoalLive
      && !(typeof dncFF !== 'undefined' && dncFF)) {
    _gridHudPending = { locLabel, tone };
    return;
  }
  _gridHudPending = null;
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
  // A pending swap belongs to the screen that is closing - a late apply would
  // put grid-screen back on over a live round.
  _gridHudPending = null;
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
  const picked = shuffle(elig).slice(0, n);
  // Early-limit guidance (js/limits.js): while live, the first Upgrades slot IS
  // the boosted limit - a replacement, not an added chance, so nothing stacks.
  const _el = (typeof earlyLimitOfferId === 'function') ? earlyLimitOfferId() : null;
  if (_el && picked.length && !picked.some(d => d.id === _el)) {
    const def = LIMITS_DEF.find(d => d.id === _el);
    if (def) picked[0] = def;
  }
  return picked.map(d => {
    const u = (typeof limitUnit === 'function') ? limitUnit(d.id) : '';
    const cur = limits[d.id].current;
    const gain = (typeof limitGain === 'function') ? limitGain(d.id) : (limits[d.id].step || 1);
    // flyTo aims the purchase flight: time at the clock, swaps/discards at their
    // own readouts, everything else at the Records chip (where Limits lives).
    const flyTo = d.id === 'round_time' ? 'clock' : d.id === 'swaps' ? 'swaps' : d.id === 'discards' ? 'discards' : 'deck';
    return { _upgrade:true, icon:d.icon, label:d.label, desc:d.desc, sub:`${cur}${u} → ${cur + gain}${u}`, rarity:'common', flyTo,
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
    const buff = roll < 0.60 ? { e:{ pips: 12 },    price: 6  }
               : roll < 0.85 ? { e:{ mult: 5 },     price: 10 }
                             : { e:{ growMult: 1 }, price: 15 };
    return {
      _cardBuff: true, icon: face, label: face,
      // buffOfferLine / buffOfferName (js/deck-grid.js) - the shop said "scores
      // +12 pips when played" beside the Forge's "scores +30 pips every time it
      // is played" for the same kind of buff (r294).
      desc: buffOfferLine(buff.e, `this ${face} in your deck`, false),
      sub: buffOfferName(buff.e),
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
        // r281: one sentence with the number that moves marked in place.
        const delta = (prev && prev.after !== prev.before && typeof improveDeltaHTML === 'function')
                        ? improveDeltaHTML(prev.before, prev.after) : null;
        out.push({
          _improve: true, _span: 2, icon: '⬆', label: `Improve ${target.name}`,
          desc: delta ? `Raise ${target.name} one tier.<br>${delta}`
              : prev  ? `Raise ${target.name} one tier.<br><b>Now:</b> ${prev.before}<br><b>After:</b> ${prev.after}`
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
// ONE row of stock, label cell included. Shared by the board build and the
// per-row reroll (r307) so the two can never fill a row differently.
function shopgFillRow(cat, C) {
  const row = [null];                                  // col 0: the label
  shopgRowPayloads(cat, C - 1).forEach(p => {
    if (!p || row.length >= C) return;
    row.push(p);
    if (p._span === 2 && row.length < C) row.push(p);   // same object = the tile's 2nd cell
  });
  while (row.length < C) row.push(null);
  return row;
}
function buildShopGridStock(reroll) {
  shopGridRowMeta = shopgDrawCats(reroll ? shopGridRowMeta : null);
  const R = shopgRows(), C = shopgCols();
  const rows = [new Array(C).fill(null)];              // row 0: the title
  shopGridRowMeta.forEach(m => rows.push(shopgFillRow(m.cat, C)));
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

// ── What you already own, per shop category (r237) ──────────────────────────
//
// Each category row's plate prints how many you hold and opens the list.
// Keyed by the CATEGORY KEY from SHOP_CATS ('tricks', 'sleights', ...), not by
// a row index: rows carry a rolled category and can be pinned, so row 2 is not
// always Sleights.
//
// SLEIGHTS are the reason this exists: a Sleight works by SITTING ON THE GRID,
// and the shop has taken the grid, so while you are deciding whether to buy one
// there is no way at all to see the ones you already have. allOwnedSleightCards
// is the right source rather than the grid - it covers the board, the draw pile
// and the played pile, which is genuinely "what you own".
//
// Returns { name, desc, emoji, id, entity, rarity, uses } so the panel can draw
// each one with the SHARED entity tile, exactly as the shelf draws what is for
// sale. Owning something and being offered it should not look like two things.
function shopOwnedOfKind(cat) {
  if (cat === 'knacks')
    return (acquiredKnacks || []).map(k => ({ ...k, entity: 'knack', rarity: k.tier || k.rarity || 'common' }));

  if (cat === 'tricks')
    return (trickTray || []).map(t => ({ ...t, entity: 'trick',
      emoji: (typeof trickEmoji === 'function' ? trickEmoji(t.id) : t.emoji),
      desc:  (typeof trickLiveDesc === 'function' ? trickLiveDesc(t) : t.desc),
      rarity: t.tier || t.rarity || 'common' }));

  if (cat === 'sleights') {
    const seen = {};
    (typeof allOwnedSleightCards === 'function' ? allOwnedSleightCards() : []).forEach(card => {
      const def = sleightDef(card); if (!def) return;
      // Several physical copies of one Sleight are ONE row with a charge total -
      // a list that repeats the same name three times is not an inventory.
      const e = seen[def.id] || (seen[def.id] = { ...def, entity: 'sleight', rarity: def.rarity || 'common', uses: 0, copies: 0 });
      e.copies++;
      if (card._usesLeft === 'infinite' || def.durability === 'infinite') e.infinite = true;
      else e.uses += (card._usesLeft ?? 0);
    });
    return Object.values(seen);
  }

  // CARDS: the deck is 52 rows of nothing to decide about, so what is worth
  // listing is the cards you have INVESTED in - the ones a card service would
  // be changing. cardBuffLines is the same wording the grid tooltip uses.
  if (cat === 'cards')
    return (typeof buffedDeckCards === 'function' ? buffedDeckCards() : []).map(c => ({
      name: `${c.rank}${c.suit}`, entity: null, icon: c.suit, rarity: 'common',
      cardFace: { rank: c.rank, suit: c.suit },
      desc: cardBuffLines(cardId(c)).join(' \u00b7 ') }));

  // IMPROVE: everything you own that still has a tier left to buy.
  if (cat === 'improve')
    return (typeof ownedImprovable === 'function'
      ? ['trick', 'knack', 'sleight'].flatMap(t => ownedImprovable(t) || [])
      : []).map(e => ({ ...e, rarity: e.tier || e.rarity || 'common' }));

  // UPGRADES: the limits are always all owned, so what matters is where each
  // one currently stands rather than how many there are.
  return (typeof LIMITS_DEF !== 'undefined' ? LIMITS_DEF : []).map(d => {
    const l = limits[d.id] || {};
    return { id: d.id, name: d.name, entity: null, icon: '\u25b2', rarity: 'common',
             desc: `${l.current ?? '\u00b7'} of a possible ${l.max ?? '\u00b7'}` };
  });
}

function openShopOwnedPanel(cat) {
  const items = shopOwnedOfKind(cat);
  const kind  = String((typeof shopgCatLabel === 'function' ? shopgCatLabel(cat) : cat) ?? '');
  let el = document.getElementById('shop-owned-panel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'shop-owned-panel';
    // Body-level, outside #cabinet, for the usual reason: anything inside it
    // inherits the cabinet's CSS zoom and a panel sized in px paints at about
    // twice the number written.
    document.body.appendChild(el);
    el.onclick = (e) => { if (e.target === el || e.target.classList.contains('sop-close')) closeShopOwnedPanel(); };
  }
  el.innerHTML = `<div class="sop-box">`
    + `<div class="sop-bar"><span>YOU OWN · ${kind.toUpperCase()}</span><button class="sop-close">✕</button></div>`
    + `<div class="sop-list">`
    + (items.length
        ? items.map(it => `<div class="sop-row">`
            + `<div class="sop-tile">${entityTileHTML(it, it.rarity)}</div>`
            + `<div class="sop-text"><b>${it.name || ''}</b>`
            + (it.copies > 1 ? `<i class="sop-copies">x${it.copies}</i>` : '')
            + `<span>${it.desc || ''}</span>`
            + (it.entity === 'sleight' ? `<span class="sop-uses">${it.infinite ? '∞ charges' : it.uses + ' charges left'}</span>` : '')
            + `</div></div>`).join('')
        : `<div class="sop-empty">You hold none.</div>`)
    + `</div></div>`;
  el.classList.add('show');
}
function closeShopOwnedPanel() { document.getElementById('shop-owned-panel')?.classList.remove('show'); }

// Press-and-hold a row label to see what you already own of that category. The
// same 430ms the Trick tray uses (attachTrickSellHold, r182), and the same
// `_lpJustFired` latch the shop tiles use, so the click that ends the hold does
// not also select the row.
const SHOP_LABEL_HOLD_MS = 430;
function shopAttachLabelHold(el, cat) {
  let timer = null, sx = 0, sy = 0;
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    sx = e.clientX; sy = e.clientY; el._lpJustFired = false; cancel();
    timer = setTimeout(() => {
      timer = null; el._lpJustFired = true;
      openShopOwnedPanel(cat);
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
    }, SHOP_LABEL_HOLD_MS);
  });
  el.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) cancel(); });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', () => { cancel(); el._lpJustFired = false; });
  el.addEventListener('pointerleave', cancel);
}

// ── Open / close ──
let _shopPrevPV = null;   // portrait panel view to restore on close
function openShopGrid() {
  shopGridActive = true;
  shopGridMode   = 'buy';
  shopGridSel    = new Set();
  shopSelOrder   = [];
  shopRerollCount = 0;
  shopSwapPending = null;
  _shopTapKey = null; _shopTapAt = 0;
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

// The stock FALLS OUT when you leave (r237), the mirror of the deal-in.
//
// closeShopGrid is SYNCHRONOUS - every caller's continuation runs on the same
// tick - so the tiles cannot animate inside #grid, which is emptied immediately
// and then rebuilt by the next round's board. They are MOVED into a throwaway
// layer laid exactly over #grid instead, which keeps their left/top meaningful
// (same coordinate space, same zoom) and lets the real board come back
// underneath while the shop is still falling off it.
//
// Bottom row first, so it unbuilds in the reverse of the order it was dealt.
function shopGridFallOut() {
  const gridEl = document.getElementById('grid');
  const host   = gridEl?.parentElement;
  if (!gridEl || !host) return;
  const tiles = [...gridEl.children];
  if (!tiles.length) return;
  const layer = document.createElement('div');
  layer.className = 'shopg-exit-layer';
  layer.style.cssText = `position:absolute;left:${gridEl.offsetLeft}px;top:${gridEl.offsetTop}px;`
                      + `width:${gridEl.offsetWidth}px;height:${gridEl.offsetHeight}px;pointer-events:none;z-index:7;`;
  const OUT_MS = 300;
  const rows = shopgRows();       // the board is sized off the player's board
  tiles.forEach(el => {
    const r = +(el.dataset.r ?? 0);
    el.classList.remove('shopg-in');
    el.style.setProperty('--sgd', ((rows - 1 - r) * 55) + 'ms');
    el.classList.add('shopg-out');
    layer.appendChild(el);                 // moves it, so #grid is left empty
  });
  host.appendChild(layer);
  setTimeout(() => layer.remove(), OUT_MS + rows * 55 + 80);
}

function closeShopGrid() {
  if (!shopGridActive) return;
  shopGridActive = false;
  hideRewardTooltip();
  closeShopOwnedPanel();
  document.body.classList.remove('shop-active');
  if (_shopPrevPV && typeof setPortraitPanelView === 'function') { setPortraitPanelView(_shopPrevPV, { auto: true }); _shopPrevPV = null; }
  exitGridScreenHud();
  exitShopGridButtons();
  shopGridFallOut();
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
// The SWAP cap becomes REROLL for the length of the shop (r237), exactly as the
// reward grid repurposes it into SKIP. Swaps are a BOARD action and there is no
// board here, so the cap was sitting dead above two live buttons - and the
// reroll it replaces was a 9px chip tucked in the cost readout, which is not
// where a player looks for an action.
//
// Three lines and no more: the word, the number of rerolls you have left (the
// thing you are actually rationing), and the price of the next one. The
// remaining-count is the big figure because it is the decision; the price is a
// footnote in the same place the other two caps print their time cost.
let _shopgSwapHTML = null;
// The action column mirrors the board's, which is the point: the same three
// controls spend the same three things.
//   swap slot  - a READOUT of the swaps you have left (the gesture is on the
//                board itself, double-tap then tap, so this is not a button)
//   discard    - REROLL the selected rows, or LEAVE when nothing is selected
//   play       - BUY
// The discard button is contextual rather than split in two because it is the
// DISCARD button in both places: on the board it spends a discard on what is
// selected, and here it does exactly that. LEAVE is what it reads when there is
// nothing selected to spend one on, which is the state you are in when you are
// done - and there is a second, permanent Leave in the cost readout, so the
// exit is never sitting behind a deselect.
function shopSwapChipHTML() {
  const inf = (typeof hasKnack === 'function' && hasKnack('steady_hand'));
  const left = inf ? '\u221e' : (typeof swaps === 'number' ? swaps : 0);
  return `<span class="srr-word">SWAP</span>`
       + `<span class="srr-left">${left}</span>`
       + `<span class="srr-cost">move</span>`;   // short enough for the box; 'rearrange' wraps
}
function syncShopActionChips() {
  const swap = document.getElementById('swap-indicator');
  if (swap && shopGridActive) {
    swap.innerHTML = shopSwapChipHTML();
    swap.title = 'Double-tap a tile to lift it, then tap a neighbour to trade them. Two row labels trade their whole rows.';
    swap.classList.toggle('srr-spent', shopGridMode === 'sell' || !shopSwapsLeft());
  }
  const disc = document.getElementById('btn-discard');
  if (disc && shopGridActive) {
    const rows = shopgSelRows().length;
    const have = (typeof discards === 'number') ? discards : 0;
    disc.classList.toggle('shop-reroll-btn', rows > 0);
    disc.innerHTML = rows > 0 ? 'R<br>E<br>R<br>O<br>L<br>L' : 'L<br>E<br>A<br>V<br>E';
    disc.title = rows > 0
      ? `Reroll ${rows === 1 ? 'this row' : rows + ' rows'} \u00b7 ${rows} discard${rows === 1 ? '' : 's'} (you have ${have})`
      : 'Leave the shop';
    disc.disabled = rows > 0 && have < rows;
  }
}
function enterShopGridButtons() {
  const play = document.getElementById('btn-play');
  const disc = document.getElementById('btn-discard');
  const swap = document.getElementById('swap-indicator');
  if (play) { if (_shopgPlayHTML === null) _shopgPlayHTML = play.innerHTML; play.classList.add('reward-buy');  play.innerHTML = 'B<br>U<br>Y'; }
  if (disc) { if (_shopgDiscHTML === null) _shopgDiscHTML = disc.innerHTML; disc.classList.add('reward-clear'); disc.disabled = false; }
  if (swap) {
    if (_shopgSwapHTML === null) _shopgSwapHTML = swap.innerHTML;
    swap.classList.add('shop-swapchip');
    swap.onclick = null;                    // a readout, not a control
  }
  syncShopActionChips();
}
function exitShopGridButtons() {
  const play = document.getElementById('btn-play');
  const disc = document.getElementById('btn-discard');
  const swap = document.getElementById('swap-indicator');
  if (play && _shopgPlayHTML !== null) { play.classList.remove('reward-buy');  play.innerHTML = _shopgPlayHTML; }
  if (disc && _shopgDiscHTML !== null) {
    disc.classList.remove('reward-clear', 'shop-reroll-btn');
    disc.innerHTML = _shopgDiscHTML; disc.disabled = false; disc.title = '';
  }
  if (swap && _shopgSwapHTML !== null) {
    swap.classList.remove('shop-swapchip', 'srr-spent');
    swap.innerHTML = _shopgSwapHTML; swap.onclick = null; swap.title = '';
    // The saved markup carries #swap-count back with it; render() refills it.
  }
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
      const labKey = `${r}-0`;
      lab.dataset.r = r; lab.dataset.c = 0;
      lab.className = 'reward-cell on-grid shop-row-label' + (meta?.pinned ? ' pinned' : '')
                    + (shopGridSel.has(labKey) ? ' selected' : '')
                    + (shopSwapPending === labKey ? ' shop-lifted' : '');
      lab.style.left = cellLeft(0) + 'px';
      lab.style.top  = cellTop(r) + 'px';
      lab.style.width  = CARD_W + 'px';
      lab.style.height = CARD_H + 'px';
      lab.innerHTML = `<span class="srl-icon">${cat?.icon || ''}</span>`
                    + `<span class="srl-name">${catLabel}</span>`
                    + (meta?.pinned ? `<span class="srl-pin" title="Bought from: this category stays on reroll">📌</span>` : '')
                    + `<span class="srl-own">${meta ? (shopOwnedOfKind(meta.cat).length || '') : ''}</span>`;
      // r307: the plate is a REAL CELL now. A tap selects the row (the discard
      // button then rerolls it), a double-tap lifts the whole row for a swap.
      //
      // WHAT YOU ALREADY OWN of that category moved to a LONG PRESS, which is
      // this game's "read more" gesture everywhere else (r182). It has to stay
      // reachable: Sleights sit on the board, so once the shop has taken the
      // board over there is no other way to see what you are holding while
      // deciding whether to buy another.
      lab.classList.add('srl-openable');
      lab.onclick = () => {
        if (lab._lpJustFired) { lab._lpJustFired = false; return; }
        onShopGridClick(r, 0);
      };
      shopAttachLabelHold(lab, meta?.cat);
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
        div.className = 'reward-cell on-grid shop-tile shop-prev-null unselectable'
                      + (shopSwapPending ? ' shop-drop-target' : '');
        div.innerHTML = `<div class="reward-icon">·</div>`;
        // An empty slot is inert EXCEPT while a tile is lifted, when it is a
        // place to put it down. onShopGridClick tests the lift before it tests
        // the payload, so this handler is safe to leave attached.
        div.onclick = () => { if (shopSwapPending) onShopGridClick(r, c); };
      } else {
        const rar = p.entity ? rewardRarity(p) : (p.rarity || 'common');
        const sel = shopGridSel.has(`${r}-${c}`);
        div.className = [
          'reward-cell', 'on-grid', 'buff', 'shop-tile',
          p.entity ? 'entity' : '', p.entity ? 'entity-' + p.entity : '',
          p._upgrade ? 'shop-tile-upgrade' : '', p._improve ? 'shop-tile-improve' : '',
          p._cardBuff ? 'shop-tile-card' : '', span === 2 ? 'shop-tile-wide' : '', 'rar-' + rar,
          p._sold ? 'sold' : '', sel ? 'selected' : '',
          shopSwapPending === shopgLeadKey(r, c) ? 'shop-lifted' : '',
          shopSwapPending ? 'shop-drop-target' : '',
        ].filter(Boolean).join(' ');
        const chip = p._sold ? '✓' : `💰${(shopGridMode === 'sell') ? p.price : shopEffPrice(p)}`;
        div.innerHTML = buildShopTileInner(p) + `<div class="shop-price-chip ${p._sold ? 'sold' : (coins < ((shopGridMode === 'sell') ? p.price : shopEffPrice(p)) ? 'cant-afford' : '')}">${chip}</div>`;
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
  syncShopActionChips();
}

// ── Span-aware selection helpers ──
// A ROW LABEL is a real, selectable cell since r307 - that is how a reroll
// names its row and how a whole row is lifted for a swap. Row 0 is the COMPANY
// STORE banner and stays inert; the sell board has no labels at all.
function shopgIsLabel(r, c) {
  return shopGridMode !== 'sell' && c === 0 && r >= 1 && !!shopGridRowMeta[r - 1];
}
// A row label weighs TWO against Selection Size (owner's call). It is not a
// purchase - it commands a whole row - and the weight is what decides how many
// rows one REROLL press can take: one at Selection Size 3 or 4, two at 5 or 6.
const SHOP_LABEL_WEIGHT = 2;
function shopgKeyWeight(key) {
  const [r, c] = key.split('-').map(Number);
  return shopgIsLabel(r, c) ? SHOP_LABEL_WEIGHT : 1;
}
function shopgSelWeight() { let w = 0; shopGridSel.forEach(k => { w += shopgKeyWeight(k); }); return w; }
// The selected rows, in board order - what a REROLL press will take.
function shopgSelRows() {
  return [...shopGridSel]
    .map(k => k.split('-').map(Number))
    .filter(([r, c]) => shopgIsLabel(r, c))
    .map(([r]) => r).sort((a, b) => a - b);
}
function shopgSelHasItems() {
  return [...shopGridSel].some(k => { const [r, c] = k.split('-').map(Number); return !shopgIsLabel(r, c); });
}

// Every cell a payload covers, from any of its keys.
function shopgCellsOf(key) {
  const [r, c] = key.split('-').map(Number);
  if (shopgIsLabel(r, c)) return [[r, c]];
  const p = shopGridItems[r]?.[c];
  if (!p) return [[r, c]];
  const cells = [];
  for (let cc = 0; cc < (shopGridItems[r] || []).length; cc++) if (shopGridItems[r][cc] === p) cells.push([r, cc]);
  return cells.length ? cells : [[r, c]];
}
// The key a payload is addressed by: its leftmost cell. A label is its own key.
function shopgLeadKey(r, c) {
  if (shopgIsLabel(r, c)) return `${r}-0`;
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
  // A lifted tile is waiting for its partner, so this tap is the SWAP - not a
  // pick, and not a read. Checked first, above the empty-cell guard: sliding a
  // tile into a gap is the most useful move on a board with a short row.
  if (shopSwapPending) { shopResolveSwap(r, c); return; }
  const isLabel = shopgIsLabel(r, c);
  const p = shopGridItems[r]?.[c];
  if (!isLabel && (!p || p._sold)) return;
  if (shopGridMode === 'sell') { doShopSell(r, c); return; }
  // Double-tap lifts the tile, exactly as it does on the play board.
  const key = shopgLeadKey(r, c);
  if (!key) return;
  const now = Date.now();
  if (_shopTapKey === key && now - _shopTapAt < SHOP_DBLTAP_MS) {
    _shopTapKey = null; _shopTapAt = 0;
    shopArmSwap(r, c);
    return;
  }
  _shopTapKey = key; _shopTapAt = now;
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
  // A selection is EITHER a purchase or a reroll, never both - otherwise BUY and
  // REROLL are live over one selection and neither says what it would take.
  // Crossing over CLEARS rather than refuses: there is no CLEAR button on this
  // screen, so a refusal would strand the player on a pick they cannot drop.
  if (isLabel ? shopgSelHasItems() : shopgSelRows().length > 0) {
    shopGridSel = new Set(); shopSelOrder = [];
    if (typeof rewardTipKey !== 'undefined') rewardTipKey = null;
  }
  if (shopgSelWeight() + shopgKeyWeight(key) > limits.selection.current) return;   // capped by Selection Size
  if (shopGridSel.size > 0) {
    // Adjacent to the selection through ANY cell of this tile's footprint.
    const adj = shopgCellsOf(key).some(([tr, tc]) =>
      [[tr-1,tc],[tr+1,tc],[tr,tc-1],[tr,tc+1]].some(([nr, nc]) => {
        const lk = shopgLeadKey(nr, nc);
        return lk && shopGridSel.has(lk);
      }));
    if (!adj) return;                                                   // must be connected
  }
  // Same rule the reward grid follows: a Trick you have no room for is refused
  // before it can be selected, let alone paid for.
  if (p && p.entity === 'trick' && trickTrayFull()) { refuseTrickCapacity(); return; }
  shopGridSel.add(key);
  shopSelOrder.push(key);
  // The newest pick is the one being explained (r182's reward-grid rule).
  if (typeof rewardTipKey !== 'undefined') rewardTipKey = key;
  renderShopGrid();
}

function shopGridSelectionCost() {
  let base = 0, n = 0;
  shopGridSel.forEach(k => {
    const [r, c] = k.split('-').map(Number);
    if (shopgIsLabel(r, c)) return;                 // a row label is not merchandise
    const p = shopGridItems[r]?.[c];
    if (p && !p._sold) { base += shopEffPrice(p); n++; }
  });
  const d = shopGridDiscount(n);
  return { base, discount: d, total: Math.round(base * (1 - d)), n };
}

// Play button → BUY the selected connected group (discounted).
function shopGridBuySelection() {
  if (shopGridMode === 'sell') return;
  const { total, n } = shopGridSelectionCost();
  if (n === 0) return;                      // label-only pick: that is a reroll, not a purchase
  if (coins < total) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= total;
  updateCoinsUI();
  const bought = [];
  [...shopGridSel].forEach(k => {
    const [r, c] = k.split('-').map(Number);
    const p = shopGridItems[r]?.[c];
    if (p && !p._sold && typeof p.buy === 'function') {
      try { p.buy(); } catch (e) { console.error('[SHOP] buy failed', e); }
      p._sold = true; bought.push([r, c, p]);
      // Buying from a row PINS its category: a reroll keeps the row, refills it.
      if (r >= 1 && shopGridRowMeta[r - 1]) shopGridRowMeta[r - 1].pinned = true;
    }
  });
  showMessage(`Bought ${bought.length} - 💰${total}`, 'var(--gold)');
  shopGridSel = new Set();
  shopSelOrder = [];
  if (typeof rewardTipKey !== 'undefined') rewardTipKey = null;
  shopGridFlyPurchases(bought);
}

// Each bought tile flies to the loadout panel it just landed in - the reward
// grid's own flight and target map (flyRewardTile / rewardTargetKey, globals in
// js/reward-grid.js). Sequential, one after another, so a multi-buy reads as
// items being handed over in order. State is applied BEFORE the flights start;
// this is presentation only, and the re-render at the tail repaints the sold
// ticks whether or not every flight ran (the shop can close mid-flight).
async function shopGridFlyPurchases(bought) {
  const gridEl = document.getElementById('grid');
  for (const [r, c, p] of bought) {
    if (!shopGridActive || !gridEl) break;
    const tile = gridEl.querySelector(`.shop-tile[data-r="${r}"][data-c="${c}"]`);
    if (!tile) continue;
    tile.onclick = null;
    try { await flyRewardTile(tile, p, true); } catch (e) { break; }
  }
  if (shopGridActive) renderShopGrid();
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

// ══ SWAP: rearrange the board ══════════════════════════════════════════════
// Double-tap lifts a tile; the next tap trades it with an orthogonal neighbour.
// Tapping the lifted tile again puts it back down.
function shopArmSwap(r, c) {
  if (shopGridMode !== 'buy') return;
  const isLabel = shopgIsLabel(r, c);
  if (!isLabel && !shopGridItems[r]?.[c]) { showMessage('Nothing to lift', 'var(--cream-dim)'); return; }
  if (!shopSwapsLeft()) { showMessage('No swaps left', 'var(--red)'); try { sfxNoSwaps?.(); } catch (e) {} return; }
  shopSwapPending = shopgLeadKey(r, c);
  // The lift DROPS the selection: what you are about to do is move things, and
  // a pick left standing would be pointing at cells that are about to change.
  shopGridSel = new Set(); shopSelOrder = [];
  if (typeof rewardTipKey !== 'undefined') { rewardTipKey = null; hideRewardTooltip(); }
  try { sfxCardSelect?.(); } catch (e) {}
  renderShopGrid();
}
// Steady Hand bypasses the swap limit on the board, so it bypasses it here too.
function shopSwapsLeft() {
  if (typeof hasKnack === 'function' && hasKnack('steady_hand')) return true;
  return (typeof swaps === 'number' ? swaps : 0) > 0;
}

function shopResolveSwap(r, c) {
  const key = shopSwapPending;
  shopSwapPending = null;
  const [pr, pc] = key.split('-').map(Number);
  if (pr === r && pc === c) { renderShopGrid(); return; }        // tapped itself: put it down
  shopSwapTiles(pr, pc, r, c);
  renderShopGrid();
}

// The trade itself. Returns false (with a reason) rather than half-doing it.
function shopSwapTiles(r1, c1, r2, c2) {
  if (shopGridMode !== 'buy') return false;
  // Adjacency is the board's rule, and Free Range lifts it here for the same
  // reason it lifts it there.
  const adj = Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
  if (!adj && !(typeof hasKnack === 'function' && hasKnack('free_range_t'))) {
    showMessage('Trade with a tile it touches', 'var(--cream-dim)'); return false;
  }
  if (!shopSwapsLeft()) { showMessage('No swaps left', 'var(--red)'); try { sfxNoSwaps?.(); } catch (e) {} return false; }
  const l1 = shopgIsLabel(r1, c1), l2 = shopgIsLabel(r2, c2);
  if (l1 !== l2) { showMessage('A row label only trades with another row label', 'var(--cream-dim)'); return false; }

  if (l1) {
    // TWO LABELS: the WHOLE ROWS trade - stock, category, pin and all. That is
    // the move worth having, because a connected pick cannot cross the board:
    // bringing two categories next to each other is what lets one purchase
    // cover both, at the multi-buy rate.
    const a = shopGridItems[r1]; shopGridItems[r1] = shopGridItems[r2]; shopGridItems[r2] = a;
    const m = shopGridRowMeta[r1 - 1]; shopGridRowMeta[r1 - 1] = shopGridRowMeta[r2 - 1]; shopGridRowMeta[r2 - 1] = m;
  } else {
    // TWO ITEM TILES. A 2-wide tile cannot trade with a 1-wide one - there is
    // nowhere for the spare cell to go - so that pairing is refused rather than
    // silently reshuffling the row around it. An empty cell IS a valid partner:
    // sliding a tile into a gap is a move, and on a short row it is the move.
    const A = shopgCellsOf(`${r1}-${c1}`), B = shopgCellsOf(`${r2}-${c2}`);
    if (A.length !== B.length) { showMessage('Those two are different widths', 'var(--cream-dim)'); return false; }
    const pa = shopGridItems[r1][c1], pb = shopGridItems[r2][c2];
    if (!pa && !pb) return false;                                 // two gaps: nothing moved
    A.forEach(([rr, cc]) => { shopGridItems[rr][cc] = pb; });
    B.forEach(([rr, cc]) => { shopGridItems[rr][cc] = pa; });
  }

  // The charge. No TIME cost and no `swapsUsedRound` bump, deliberately: the
  // clock on this screen belongs to a round that is already over, and the No
  // Takebacks challenge counts what you did during a ROUND.
  if (!(typeof hasKnack === 'function' && hasKnack('steady_hand'))) swaps = Math.max(0, swaps - 1);
  // The board moved under the selection, so the selection goes - the same rule
  // a rerolled pick screen follows (js/grid-pick.js).
  shopGridSel = new Set(); shopSelOrder = [];
  if (typeof rewardTipKey !== 'undefined') { rewardTipKey = null; hideRewardTooltip(); }
  try { sfxCardSelect?.(); } catch (e) {}
  return true;
}

// ══ REROLL: discards buy new stock, one row at a time ══════════════════════
// Select a row's LABEL and press the discard button. One discard a row, and no
// credit cost at all: the discard IS the price, which is what makes carrying
// stock out of a round worth something here.
function shopRerollSelectedRows() {
  if (shopGridMode !== 'buy') return false;
  const rows = shopgSelRows();
  if (!rows.length) return false;
  const have = (typeof discards === 'number') ? discards : 0;
  if (have < rows.length) {
    showMessage(rows.length > 1 ? `Needs ${rows.length} discards` : 'No discards left', 'var(--red)');
    try { sfxNoSwaps?.(); } catch (e) {}
    return false;
  }
  discards -= rows.length;
  rows.forEach(shopgRerollRow);
  shopGridSel = new Set(); shopSelOrder = [];
  shopSwapPending = null;
  if (typeof rewardTipKey !== 'undefined') { rewardTipKey = null; hideRewardTooltip(); }
  showMessage(rows.length > 1 ? `Rerolled ${rows.length} rows` : 'Row rerolled', 'var(--c-mint)');
  try { sfxShopOpen?.(); } catch (e) {}
  renderShopGrid();
  return true;
}

// One row, redrawn. A PINNED row (you bought from it) keeps its category and
// only refills its stock - the promise the pin has always made. An unpinned row
// draws a NEW category, never one already on the board and never the one it
// just had, so a reroll always visibly changes something.
function shopgRerollRow(r) {
  const meta = shopGridRowMeta[r - 1];
  if (!meta) return;
  if (!meta.pinned) {
    const taken = new Set(shopGridRowMeta.filter(m => m && m !== meta).map(m => m.cat));
    const opts = Object.keys(SHOP_CATS).filter(c => !taken.has(c) && c !== meta.cat && shopgCatViable(c));
    if (opts.length) meta.cat = opts[Math.floor(Math.random() * opts.length)];
  }
  shopGridItems[r] = shopgFillRow(meta.cat, shopgCols());
}

function updateShopGridButtons() {
  const play = document.getElementById('btn-play');
  // `n`, not shopGridSel.size: a selection of ROW LABELS is a reroll, and there
  // is nothing in it to buy. Sizing this off the Set left BUY lit over a
  // label-only pick, where pressing it paid 0 for 0 items.
  if (play) {
    const { total, n } = shopGridSelectionCost();
    play.disabled = (shopGridMode !== 'buy') || n === 0 || coins < total;
  }
}

// Cost / discount readout rendered INTO the hand-preview slot (#selected-cards).
function renderShopCostReadout() {
  const sc = document.getElementById('selected-cards'); if (!sc) return;
  let costLine;
  if (shopGridMode === 'sell') {
    costLine = `<div class="sc-line"><span>SELL MODE</span><span class="sc-off">tap to sell</span></div>`
             + `<div class="sc-line"><span>Wallet</span><b>💰${coins}</b></div>`;
  } else {
    const { base, discount, total, n } = shopGridSelectionCost();
    const rows = shopgSelRows().length;
    costLine = rows > 0
      // Labels selected: this is a reroll, so price it in the thing it spends.
      ? `<div class="sc-line"><span>${rows === 1 ? '1 row' : rows + ' rows'}</span><b>${rows} ♻</b></div>`
        + `<div class="sc-line"><span>Discards</span><b>${(typeof discards === 'number') ? discards : 0}</b></div>`
      : n === 0
      ? `<div class="sc-line"><span>Select connected items</span></div><div class="sc-line"><span>−${Math.round(shopGridDiscountRate()*100)}% per extra item</span></div>`
      : (discount > 0
          ? `<div class="sc-line"><span>${n} items</span><span><s>💰${base}</s> <b>💰${total}</b> <span class="sc-off">(−${Math.round(discount*100)}%)</span></span></div>`
          : `<div class="sc-line"><span>${n} item</span><b>💰${total}</b></div>`)
        + `<div class="sc-line"><span>Wallet</span><b>💰${coins}</b></div>`;
  }
  sc.innerHTML =
    `<div class="shop-cost">${costLine}` +
      // Leave lives here as well as on the discard button, because that button
      // reads REROLL whenever a row is selected - the way out must not depend
      // on what you happen to have picked.
      `<div class="sc-actions">` +
        `<button id="sc-sell" class="${shopGridMode==='sell'?'sc-sell-on':''}">${shopGridMode==='sell'?'Back':'Sell'}</button>` +
        `<button id="sc-leave">Leave</button>` +
      `</div>` +
    `</div>`;
  const sb = sc.querySelector('#sc-sell');   if (sb) sb.onclick = (e) => { e.stopPropagation(); toggleShopSellMode(); };
  const lv = sc.querySelector('#sc-leave');  if (lv) lv.onclick = (e) => { e.stopPropagation(); closeShopGrid(); };
}
