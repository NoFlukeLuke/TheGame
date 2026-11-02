// ══ MONEY AND SELLING (r722, owner) ══════════════════════════════════════════
// The money Tricks, Knacks and Sleights of MONEY_AND_SELLING.md, as the owner
// set them. One file, so the credit trackers and the sale hooks have one home.
//
// CREDIT FLOW. Every change to `coins` passes the accessor in js/combos-aim.js,
// which calls moneyOnCredits(d). A "round" here is a LEVEL: what moves while a
// level is played, and in the payout, shop and events after it, counts to that
// level; the next level's first change rolls it into `prev`. In Flow a level is
// one level-up's worth of play inside the session clock.
//   moneyFlow.cur / prev  credits gained or spent (both count) this level / last
//   moneyFlow.earnN       how many times credits were GAINED this level
//   fireSaleMult          Firesale's mult: +mult_per for every credit spent or lost
//
// SALES. Two doors sell an entity: the tray (sellTrick / sellKnack, js/shop.js)
// and the shop's SELL board (doShopSell, js/shop-grid-preview.js). Both ask
// moneySalePrice for what a sale pays and call moneyAfterSale after it.
//   Trade In        a Trick sold becomes a Trick one rarity up, for a price
//   King Pawn       Tricks sell for the shop's price (trickSellValue)
//   Nest Egg        a sale mid-round pays more while it is on the grid
//   401             every sale adds x mult or x pips to it
//   Buyback         the last Trick sold waits on the next shop's first shelf

let moneyFlow = { cur: 0, prev: 0, earnN: 0, lv: null };
let fireSaleMult = 0;
let buybackItem = null;   // { id, tier, price }

function moneyResetRun() {
  moneyFlow = { cur: 0, prev: 0, earnN: 0, lv: (typeof level !== 'undefined' ? level : null) };
  fireSaleMult = 0; buybackItem = null;
}
function moneyRoll() {
  const lv = typeof level !== 'undefined' ? level : null;
  if (moneyFlow.lv === lv) return;
  // One level later, this level's flow is "last round"; further than that, nothing carries.
  moneyFlow.prev = (moneyFlow.lv != null && lv === moneyFlow.lv + 1) ? moneyFlow.cur : 0;
  moneyFlow.cur = 0; moneyFlow.earnN = 0; moneyFlow.lv = lv;
}
function moneyOnCredits(d) {
  if (!d || (typeof _ulRunLive !== 'undefined' && !_ulRunLive) || (typeof _restoringSave !== 'undefined' && _restoringSave)) return;
  moneyRoll();
  moneyFlow.cur += Math.abs(d);
  if (d > 0) moneyFlow.earnN++;
  if (d < 0 && typeof hasTrick === 'function' && hasTrick('fire_sale') && BAL.fire_sale) fireSaleMult = Math.round((fireSaleMult + -d * BAL.fire_sale.mult_per) * 100) / 100;
}
function moneyFlowNow() { moneyRoll(); return moneyFlow; }

// Pays an entity's credits with its plate and its contributions row.
function moneyPay(n, source, id, text) {
  n = Math.round(n || 0);
  if (n <= 0) return 0;
  if (typeof grantEntityCoins === 'function') grantEntityCoins(n, source, id); else { coins += n; updateCoinsUI?.(); }
  try { if (typeof entityEffectFX === 'function') entityEffectFX('credits', n, { source, id }); } catch (e) {}
  if (text) noteMessage(text, 'var(--gold)');
  return n;
}

// ── Tricks read by calcScore (read-only) ─────────────────────────────────────
// Expense Account: +mult for every credit gained or spent this level and last.
function expenseAccountMult() {
  const f = moneyFlowNow();
  return Math.floor((f.cur + f.prev) * TB('expense_account').mult_per);
}
// Gold Standard: a diamond scored pays +pips for every `per` credits held.
function goldStandardPips() {
  const B = TB('gold_standard');
  return Math.floor(Math.max(0, coins || 0) / B.per) * B.pips;
}
// Insurance Policy: each card's replay chance, in 0..1: the sell value of your
// Tricks and Sleights, plus per_credit for every credit gained or lost this level.
function insuranceValue() {
  let v = 0;
  (trickTray || []).forEach(t => { if (t && typeof trickSellValue === 'function') v += trickSellValue(t); });
  if (typeof allOwnedSleightCards === 'function' && typeof sleightSellValue === 'function')
    allOwnedSleightCards().forEach(cd => { const def = sleightDef(cd); if (def) v += sleightSellValue(cd, def); });
  return v;
}
function insuranceChance() {
  if (!hasTrick('insurance_policy')) return 0;
  return Math.min(1, (insuranceValue() + moneyFlowNow().cur * TB('insurance_policy').per_credit) / 100);
}
// 401: the x mult and x pips its sales have built.
function fourOhOneFactors() {
  const t = typeof ownedTrickObj === 'function' ? ownedTrickObj('four_oh_one') : null;
  const s = TB('four_oh_one').step;
  return { m: 1 + s * ((t && t._k401m) || 0), p: 1 + s * ((t && t._k401p) || 0) };
}

// The share of the round left, 0..1. In Flow the round is the SESSION (the
// clock between bosses): roundFractionRemaining() restarts at every level-up
// there (startRoundTimer sets roundStartSeconds), so a "last third" read off it
// would need two thirds of the session inside one level.
function moneyRoundLeft() {
  if (typeof flowSessionRunning === 'function' && flowSessionRunning() && typeof flowSessionSeconds === 'function')
    return Math.max(0, roundSeconds / flowSessionSeconds());
  return typeof roundFractionRemaining === 'function' ? roundFractionRemaining() : 1;
}

// ── Paid after the dance (scalingCount, js/play-hand.js) ─────────────────────
const SMALL_CHANGE_RANKS = ['2', '3'];
function moneyOnHand(cells) {
  if (!cells || !cells.length) return;
  const isWild = cd => typeof WILD_RANK !== 'undefined' && cd.rank === WILD_RANK;
  // Small Change: 2s and 3s scored pay `pay` credits (each `chance` of one more).
  if (hasTrick('small_change')) {
    const B = TB('small_change');
    const ranks = SMALL_CHANGE_RANKS.concat(B.fours ? ['4'] : [], B.fives ? ['5'] : []);
    let paid = 0;
    cells.forEach(x => {
      if (!x.card || isWild(x.card) || x.card._isSleight || !ranks.includes(x.card.rank)) return;
      const times = B.replays ? (x.n || 1) : 1;
      for (let k = 0; k < times; k++) paid += B.pay + (B.chance > 0 ? luckRoll(B.chance) * B.extra : 0);
    });
    moneyPay(paid, 'trick', 'small_change', paid ? `Small Change +${creditsTxt(paid)}` : '');
  }
  // Time and a Half: a hand played in the last part of the round pays per card.
  if (hasKnack('time_and_a_half') && moneyRoundLeft() <= BAL.time_and_a_half.window) {
    const B = BAL.time_and_a_half;
    let paid = 0;
    cells.forEach(x => {
      if (!x.card || x.card._isSleight) return;
      const times = B.replays ? (x.n || 1) : 1;
      for (let k = 0; k < times; k++) paid += B.pay + (B.chance > 0 ? luckRoll(B.chance) * B.extra : 0);
    });
    moneyPay(paid, 'knack', 'time_and_a_half', paid ? `Time and a Half +${creditsTxt(paid)}` : '');
  }
}

// ── A level cleared (captureGoalHand and the challenge round's exits) ────────
function moneyOnClear() {
  // Bonus Structure: per10 credits for every 10% the score is over the goal, plus flat.
  if (hasTrick('bonus_structure') && typeof roundGoal !== 'undefined' && roundGoal > 0) {
    const B = TB('bonus_structure');
    const tens = Math.max(0, Math.floor(((score - roundGoal) / roundGoal) * 10 + 1e-9));
    const n = tens * B.per10 + B.flat;
    moneyPay(n, 'trick', 'bonus_structure', n ? `Bonus Structure +${creditsTxt(n)}${tens ? ` (${tens * 10}% over)` : ''}` : '');
  }
  // Hedge Fund: a level cleared without a swap pays pct of the credits held.
  if (hasKnack('hedge_fund') && (typeof swapsUsedRound === 'undefined' || swapsUsedRound === 0)) {
    const n = Math.floor(Math.max(0, coins || 0) * BAL.hedge_fund.pct / 100);
    moneyPay(n, 'knack', 'hedge_fund', n ? `Hedge Fund +${creditsTxt(n)} (no swaps)` : '');
  }
}

// ── Excursion Fund: an event opened pays ─────────────────────────────────────
function moneyOnEvent() {
  if (!hasKnack('excursion_fund')) return;
  moneyPay(BAL.excursion_fund.credits, 'knack', 'excursion_fund', `Excursion Fund +${creditsTxt(BAL.excursion_fund.credits)}`);
}

// ── Sales ────────────────────────────────────────────────────────────────────
// What a sale pays: Nest Egg adds its bonus to a sale made while a round is live.
function moneySalePrice(base) {
  let v = base;
  const egg = nestEggOn();
  if (egg && typeof middleManRoundLive === 'function' && middleManRoundLive()) v = Math.round(v * (1 + BAL.nest_egg.bonus));
  return v;
}
function moneyAfterSale(kind, ent, paid) {
  // 401 counts every sale but its own.
  const k = typeof ownedTrickObj === 'function' ? ownedTrickObj('four_oh_one') : null;
  if (k && !(ent && ent.id === 'four_oh_one')) {
    const both = TB('four_oh_one').both;
    const m = both || Math.random() < 0.5;
    if (both || m) k._k401m = (k._k401m || 0) + 1;
    if (both || !m) k._k401p = (k._k401p || 0) + 1;
    noteMessage(`401: +x${TB('four_oh_one').step} ${both ? 'mult and pips' : m ? 'mult' : 'pips'}`, 'var(--gold)');
  }
  // Buyback: the Trick waits on the next shop's first shelf at what it sold for.
  if (kind === 'trick' && ent && ent.id !== 'buyback' && hasKnack('buyback') && !ent.fused) {
    buybackItem = { id: ent.id, tier: (typeof entityTierOf === 'function' ? entityTierOf(ent.id) : 0), price: Math.max(0, Math.round((paid || 0) * BAL.buyback.pct / 100)) };
  }
}
// The shop's first Trick shelf (shopgTrickPayloads): the Buyback, if one waits.
function buybackPayload() {
  if (!buybackItem || !hasKnack('buyback')) return null;
  const row = (typeof TRICK_POOL_ALL !== 'undefined' ? TRICK_POOL_ALL : TRICK_POOL).find(t => t.id === buybackItem.id);
  if (!row || (acquiredTricks || []).some(t => t.id === row.id)) return null;
  const it = buybackItem;
  return { entity: 'trick', label: shownEntityName(row, 'trick'), desc: row.desc, emoji: trickEmoji(row), rarity: row.tier || 'common', tier: row.tier || 'common',
    price: it.price, _buyback: true,
    buy: () => {
      if (it.tier > 0) { entityTier[row.id] = it.tier; if (typeof applyEntityTiers === 'function') applyEntityTiers(); }
      buybackItem = null;
      return injectTrickAfterReward({ ...row });
    } };
}

// Trade In: selling another common or rare Trick costs `cost` credits and puts a
// Trick one rarity higher in its slot. An epic (no legendaries) or a sale you
// cannot pay for sells as usual. Returns true when it took the sale.
const TRADE_IN_NEXT = { common: 'rare', rare: 'epic' };
function tradeInIntercept(trick) {
  if (!trick || trick.id === 'trade_in' || !hasTrick('trade_in') || trick.fused) return false;
  const next = TRADE_IN_NEXT[trick.tier || 'common'];
  const cost = TB('trade_in').cost;
  if (!next || (coins || 0) < cost) return false;
  const owned = new Set((acquiredTricks || []).map(t => t.id));
  const pool = TRICK_POOL.filter(t => t.tier === next && !t.retired && !t.fused && !owned.has(t.id) && t.id !== trick.id
    && !(typeof offerBannedGlobal === 'function' && offerBannedGlobal(t.id)));
  if (!pool.length) return false;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const idx = trickTray.findIndex(t => t === trick || t.id === trick.id);
  if (typeof ulBump === 'function') ulBump('sells');
  if (typeof sellOwnedTrick === 'function') sellOwnedTrick(trick);
  if (cost) { coins -= cost; updateCoinsUI?.(); }
  const copy = { ...pick };
  if (injectTrickAfterReward(copy) && idx >= 0) {
    const at = trickTray.indexOf(copy);
    if (at >= 0 && at !== idx) { trickTray.splice(at, 1); trickTray.splice(Math.min(idx, trickTray.length), 0, copy); renderTrickTray?.(); }
  }
  moneyAfterSale('trick', trick, 0);
  showMessage(`Trade In: ${trick.name} for a ${next} Trick${cost ? ` · -${creditsTxt(cost)}` : ''}`, 'var(--gold)');
  return true;
}

// ── Sleights ─────────────────────────────────────────────────────────────────
// Nest Egg and Loan Shark land INERT (the rule Sleights' word) and are noticed by
// moneySleightsScan from render() and the round tick, beside ruleSleightsScan.
// The landing marks are board-card fields, dropped by recycleCard, so every
// landing is fresh. `_eggValue` / `_loanFrom` are durable (DURABLE_CARD_FIELDS).
const MONEY_SLEIGHT_IDS = new Set(['nest_egg', 'loan_shark']);
function moneySleightOn(id) {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (cd && cd._isSleight && cd.sleightId === id && cd._mnyLanded) return cd;
  }
  return null;
}
function nestEggOn() { return typeof gridData !== 'undefined' && !!moneySleightOn('nest_egg'); }
function moneySleightsScan() {
  if (typeof gridData === 'undefined' || !gridData) return;
  if ((typeof flowrDeckActive === 'function' && flowrDeckActive()) || (typeof mapScreenOpen !== 'undefined' && mapScreenOpen)
      || (typeof squaresActive === 'function' && squaresActive()) || (typeof shopGridActive !== 'undefined' && shopGridActive)) return;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._isSleight || !MONEY_SLEIGHT_IDS.has(cd.sleightId) || cd._mnyLanded) continue;
    cd._mnyLanded = true;
    cd._inert = true;
    if (cd.sleightId === 'nest_egg') {
      cd._eggValue = (cd._eggValue || 0) + BAL.nest_egg.gain;
      noteMessage(`Nest Egg +${BAL.nest_egg.gain}: it sells for ${creditsTxt(nestEggValue(cd))}`, 'var(--gold)');
    }
    if (cd.sleightId === 'loan_shark') {
      const n = Math.max(0, (typeof level !== 'undefined' ? level : 0) - (cd._loanFrom || 0));
      const due = n + BAL.loan_shark.cost_add;
      const take = Math.min(due, Math.max(0, coins || 0));
      if (take > 0) { coins -= take; updateCoinsUI?.(); }
      showMessage(`Loan Shark takes ${creditsTxt(take)}${take < due ? ` (owed ${due})` : ''}`, '#ff6a52');
    }
  }
}
function nestEggValue(card) {
  const def = SLEIGHT_POOL.find(s => s.id === 'nest_egg');
  const price = (typeof SHOP_SLEIGHT_PRICES !== 'undefined' && SHOP_SLEIGHT_PRICES[def ? def.rarity : 'rare']) || 12;
  return Math.round(0.75 * price) + (card._eggValue || 0) + (BAL.nest_egg.flat || 0);
}
// Read by sleightSellValue: a money Sleight's own sell value, or null for the usual one.
function moneySleightSellValue(card) {
  if (!card) return null;
  if (card.sleightId === 'nest_egg') return nestEggValue(card);
  if (card.sleightId === 'loan_shark') return 0;
  return null;
}
// grantSleight: Loan Shark pays its loan and remembers the level it was taken at.
function moneySleightGranted(card) {
  if (!card || card.sleightId !== 'loan_shark') return;
  card._loanFrom = typeof level !== 'undefined' ? level : 0;
  const n = BAL.loan_shark.grant;
  coins += n; updateCoinsUI?.();
  showMessage(`Loan Shark: +${creditsTxt(n)} now`, 'var(--gold)');
}
// calcScore: what Loan Shark adds while it is on the grid.
function loanSharkAdds() {
  return moneySleightOn('loan_shark') ? { pips: BAL.loan_shark.pips, mult: BAL.loan_shark.mult } : null;
}

// BOGO (double-tap): copies of a random card beside it replace cards in its row.
// How many: credits / per_credits or the times you gained credits this level,
// whichever is more (at least 1), plus `extra`. The copies are temp cards.
function bogoCount() {
  const f = moneyFlowNow();
  return Math.max(1, Math.floor(Math.max(0, coins || 0) / BAL.bogo.per_credits), f.earnN) + (BAL.bogo.extra || 0);
}
function bogoUse(card, r, c) {
  const dim = { color: 'var(--cream-dim)' };
  if (animating || falling || roundEnded) { refuse('BOGO: let the board settle first', dim); return; }
  const wildOK = typeof hasKnack === 'function' && hasKnack('stand_in');
  const sides = getNeighbors(r, c).filter(([sr, sc]) => {
    const cd = gridData[sr]?.[sc];
    return cd && cd.rank && !cd._isSleight && !cd._isStone && !cd._isTrick && !isCellBlocked(sr, sc) && (wildOK || !isWildCard(cd));
  });
  if (!sides.length) { refuse('BOGO: no card beside it to copy', dim); return; }
  const [sr, sc] = sides[Math.floor(Math.random() * sides.length)];
  const src = gridData[sr][sc];
  const cells = [];
  for (let cc = 0; cc < gridCols; cc++) {
    if (cc === c || (r === sr && cc === sc)) continue;
    if (typeof photocopierTakes === 'function' ? photocopierTakes(r, cc) : true) {
      const cd = gridData[r][cc];
      if (cd && cd.rank === src.rank && cd.suit === src.suit) continue;   // already the card
      cells.push([r, cc]);
    }
  }
  const want = bogoCount();
  const placed = cells.slice(0, want);
  if (!placed.length) { refuse('BOGO: nothing in its row to replace', dim); return; }
  const copies = placed.map(() => { const cp = makeTempCard(src.rank, src.suit); copyCardBuffs(src, cp); return cp; });
  const gone = placed.map(([rr, cc]) => gridData[rr][cc]).filter(Boolean);
  selected = []; swapPending = null;
  if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  if (typeof cardStatesOnLeave === 'function') cardStatesOnLeave(placed.filter(([rr, cc]) => gridData[rr][cc]));
  if (typeof officeGhostToDiscard === 'function') gone.forEach(officeGhostToDiscard);
  placed.forEach(([rr, cc], i) => { const old = gridData[rr][cc]; if (old) discardToDrawPile(old); gridData[rr][cc] = copies[i]; });
  if (typeof magnetCountDiscards === 'function') magnetCountDiscards(gone);
  updateDeckHud();
  render();
  const gridEl = document.getElementById('grid');
  placed.forEach(([rr, cc], i) => {
    const el = gridEl?.querySelector(`[data-card-id="${gridData[rr][cc]._id}"]`);
    if (el) el.animate([{ opacity: 0, transform: 'scale(1.25)', filter: 'brightness(2)' }, { opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' }],
      { duration: 260, delay: i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  });
  try { sfxFlipShuffle(); } catch (e) {}
  const name = isWildCard(src) ? 'a wild' : src.rank + (typeof cardColorSuit === 'function' ? cardColorSuit(src) : src.suit);
  noteMessage(`🎁 BOGO: ${placed.length} cop${placed.length > 1 ? 'ies' : 'y'} of ${name}`);
  setTimeout(() => { if (gridData[r]?.[c] === card) discardSleightAfterUse(card, r, c); }, 260 + placed.length * 70);
}
