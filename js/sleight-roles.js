// ══════════════════════════════════════════════════════════════════════════════
// THE SLEIGHT TRIAGE (r739, owner): the rules one pass over every Sleight needed.
// Numbers, sentences and ladders are BAL / DESC_TEMPLATES / IMPROVE_PLAN; this file
// holds what is new behaviour.
// ══════════════════════════════════════════════════════════════════════════════

// ── PLAY ONLY / DISCARD ONLY / FIXED ────────────────────────────────────────
// What a Sleight on the grid may still do, in one word on its face and tooltip.
// 'play' is the r341 INERT (cannot be swapped or discarded, only played), 'discard'
// cannot be swapped or played (Theta), 'none' can do neither (the aim Sleights).
// cardCan (js/data/cards.js) gates 'discard'; playHand refuses a 'discard' card.
const SLEIGHT_ONLY_WORDS = { play: 'Play only', discard: 'Discard only', none: 'Fixed' };
function sleightOnly(card) {
  if (!card || !card._isSleight) return null;
  if (card._only) return card._only;
  if (card._inert) return 'play';
  if (typeof AIM_SLEIGHTS !== 'undefined' && AIM_SLEIGHTS.has(card.sleightId)) return 'none';
  return null;
}
// playHand: a 'discard only' card in the selection refuses the play.
function sleightOnlyRefusePlay(cells) {
  const cd = (cells || []).map(([r, c]) => gridData[r]?.[c]).find(x => sleightOnly(x) === 'discard');
  if (!cd) return false;
  refuse(`${sleightDef(cd)?.name || 'That Sleight'} can only be discarded`);
  return true;
}

// ── Landing marks (top of render() and the round tick, beside ruleSleightsScan) ──
// Board-card fields only: recycleCard drops them, so every landing is fresh.
let recyclerFreeLeft = 0;   // the Recycler's free swaps and discards still to spend (SAVE_VARS)
function sleightTriageScan() {
  if (typeof gridData === 'undefined' || !gridData) return;
  if ((typeof flowrDeckActive === 'function' && flowrDeckActive()) || (typeof mapScreenOpen !== 'undefined' && mapScreenOpen)) return;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._isSleight) continue;
    const id = cd.sleightId;
    if (id === 'capacitor' && !cd._thetaLanded) { cd._thetaLanded = 1; cd._only = 'discard'; cd._thetaBank = 0; cd._thetaSecs = 0; }
    // The Ringer and the Keeper are Play only until an improvement lifts it.
    if (id === 'the_ringer' || id === 'keeper') {
      const want = !!(BAL[id] && BAL[id].inert);
      if (want && !cd._inert) { cd._inert = true; cd._inertRole = 1; }
      else if (!want && cd._inertRole) { delete cd._inert; delete cd._inertRole; }
    }
    if (id === 'recycler' && !cd._recHand) cd._recHand = recyclerRollHand();
  }
}
// The round tick (js/round-timers.js), once a live second.
function sleightTriageTick() {
  sleightTriageScan();
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (cd && cd._isSleight && cd.sleightId === 'capacitor' && cd._thetaLanded) {
      if (++cd._thetaSecs >= BAL.capacitor.seconds) { cd._thetaSecs = 0; cd._thetaBank = (cd._thetaBank || 0) + BAL.capacitor.per; }
    }
  }
  fightPowerCurseSweep();
}

// ── THETA (was Capacitor) ───────────────────────────────────────────────────
// Every BAL.capacitor.seconds on the grid banks BAL.capacitor.per credits on the
// card; discarding it pays the bank (applySleightGridEffect 'capacitor').
function thetaCashOut(card, r, c) {
  const n = (card && card._thetaBank) || 0;
  if (!n) { noteMessage('Theta: nothing banked yet', 'var(--cream-dim)'); return; }
  grantEntityCoins(n, 'sleight', 'capacitor');
  if (typeof entityEffectFX === 'function')
    entityEffectFX('credits', n, { srcEl: document.querySelector(`#grid [data-card-id="${card._id}"]`), id: 'capacitor', source: 'sleight' });
  card._thetaBank = 0;
}

// ── RECYCLER ────────────────────────────────────────────────────────────────
// Names a hand you could make when it lands. Score that hand next to it (anywhere
// at its 5th improvement) and the next BAL.recycler.free swaps or discards cost no
// time and no stock (recyclerFreeLeft, spent in doSwap / doDiscard); then it leaves.
function recyclerRollHand() {
  const t = (typeof achievableHandTypes === 'function') ? achievableHandTypes().filter(h => typeof handIsActive !== 'function' || handIsActive(h)) : ['Pair'];
  return t[Math.floor(Math.random() * t.length)] || 'Pair';
}
// playHand, once the hand has scored: `names` are every layer the hand made.
function recyclerOnHand(names, cells) {
  const has = n => (names || []).includes(n);
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._isSleight || cd.sleightId !== 'recycler' || !cd._recHand || !has(cd._recHand)) continue;
    const near = BAL.recycler.anywhere || (cells || []).some(([hr, hc]) => (hr === r && hc === c) || Math.abs(hr - r) + Math.abs(hc - c) === 1);
    if (!near) continue;
    recyclerFreeLeft += BAL.recycler.free;
    showMessage(`♻️ Recycler: your next ${recyclerFreeLeft} swaps or discards are free`, '#6aaa6a');
    if (!(cells || []).some(([hr, hc]) => hr === r && hc === c)) discardSleightAfterUse(cd, r, c);
  }
}

// ── SEQUENCER (new, working name) ───────────────────────────────────────────
// Photocopier's sibling for runs: picks a card beside it at random; temp cards that
// run up from its rank (x+1, x+2...; past the top they run down from below it)
// replace the cards of its column top to bottom, then of the next column over
// (right, or left at the edge). Replaced cards go to the back of the deck and count
// as discards. Its v4 improvement gives them the picked card's suit.
function sequencerUse(card, r, c) {
  const dim = { color: 'var(--cream-dim)' };
  if (animating || falling || roundEnded) { refuse('Sequencer: let the board settle first', dim); return; }
  const near = getNeighborsOrtho(r, c).filter(([sr, sc]) => {
    const cd = gridData[sr]?.[sc];
    return cd && cd.rank && !cd._isSleight && !cd._isStone && !cd._isTrick && !isCellBlocked(sr, sc) && !isWildCard(cd);
  });
  if (!near.length) { refuse('Sequencer: no card beside it', dim); return; }
  const [sr, sc] = near[Math.floor(Math.random() * near.length)];
  const src = gridData[sr][sc];
  const ladder = ACTIVE_RANKS.filter(rk => !(typeof isWildRank === 'function' && isWildRank(rk))).slice().sort((a, b) => (RANK_ORDER[a] || 0) - (RANK_ORDER[b] || 0));
  const at = ladder.indexOf(src.rank), n = BAL.sequencer.copies, ranks = [];
  for (let i = 1; ranks.length < n && i < ladder.length * 2; i++) {
    const up = at + i, down = at - (i - (ladder.length - 1 - at));
    if (up < ladder.length) ranks.push(ladder[up]); else if (down >= 0) ranks.push(ladder[down]);
  }
  const suitOf = () => BAL.sequencer.suit ? src.suit : ACTIVE_SUITS[Math.floor(Math.random() * ACTIVE_SUITS.length)];
  const cards = ranks.map(rk => makeTempCard(rk, suitOf()));
  const col2 = c + 1 < gridCols ? c + 1 : c - 1, cells = [];
  [c, col2].forEach(cc => { if (cc < 0) return; for (let rr = 0; rr < gridRows; rr++) {
    if ((rr === r && cc === c) || (rr === sr && cc === sc)) continue;
    if (photocopierTakes(rr, cc)) cells.push([rr, cc]);
  } });
  const placed = cells.slice(0, cards.length);
  const gone = placed.map(([rr, cc]) => gridData[rr][cc]).filter(Boolean);
  selected = []; swapPending = null;
  if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  if (typeof cardStatesOnLeave === 'function') cardStatesOnLeave(placed.filter(([rr, cc]) => gridData[rr][cc]));
  gone.forEach(officeGhostToDiscard);
  placed.forEach(([rr, cc], i) => { const old = gridData[rr][cc]; if (old) pierceRoute(old); gridData[rr][cc] = cards[i]; });
  cards.slice(placed.length).forEach(cp => drawPile.splice(Math.floor(Math.random() * (drawPile.length + 1)), 0, cp));
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
  noteMessage(`🪜 Sequencer: ${ranks.join(' ')} from ${src.rank}${cards.length > placed.length ? `, ${cards.length - placed.length} into the deck` : ''}`);
  setTimeout(() => { if (gridData[r]?.[c] === card) discardSleightAfterUse(card, r, c); }, 260 + placed.length * 70);
}

// ── BOMB's second use (its 5th improvement) ─────────────────────────────────
// Double-tap: every ordinary card on the grid goes up a rank (the top rank stays).
// Spends a charge; the Bomb stays on the grid.
function bombRankUp(card, r, c) {
  if (animating || falling || roundEnded) { refuse('Bomb: let the board settle first', { color: 'var(--cream-dim)' }); return; }
  if (card._usesLeft !== 'infinite' && !(card._usesLeft > 0)) { refuse('Bomb is out of charges', { color: 'var(--cream-dim)' }); return; }
  const ladder = ACTIVE_RANKS.filter(rk => !(typeof isWildRank === 'function' && isWildRank(rk))).slice().sort((a, b) => (RANK_ORDER[a] || 0) - (RANK_ORDER[b] || 0));
  const keys = [];
  for (let rr = 0; rr < gridRows; rr++) for (let cc = 0; cc < gridCols; cc++) {
    const cd = gridData[rr]?.[cc];
    if (!cd || !cd.rank || cd._isSleight || cd._isStone || cd._isTrick || isWildCard(cd)) continue;
    const i = ladder.indexOf(cd.rank);
    if (i >= 0 && i < ladder.length - 1) { cd.rank = ladder[i + 1]; keys.push(cardId(cd)); }
  }
  spinSleightTile(r, c);
  consumeSleightCharge(card, r, c);
  render();
  if (typeof cardAnimOn === 'function') setTimeout(() => cardAnimOn('buff', cardAnimEls(keys), { color: '#ffd700' }), 0);
  showMessage(`💣 Bomb - ${keys.length} cards up a rank`, '#ffd700');
}

// ── NATURALIST's second buff (from its 3rd improvement) ─────────────────────
// One random buff of the owner's list, not printed on the Sleight: +5 mult, x1.25
// pips or mult, a 2s rewind, one replay.
function naturalistBonusBuff(card) {
  const k = cardId(card);
  const pick = Math.floor(Math.random() * 5);
  if (pick === 0) permMult[k] = (permMult[k] || 0) + yokeGain('mult', 5);
  else if (pick === 1) permXPips[k] = (permXPips[k] || 1) * yokeGain('xpips', 1.25);
  else if (pick === 2) permXMult[k] = (permXMult[k] || 1) * yokeGain('xmult', 1.25);
  else if (pick === 3) { if (!(typeof cardTimeBuffed === 'function' && cardTimeBuffed(card))) permTime[k] = (permTime[k] || 0) + yokeGain('time', 2); else permMult[k] = (permMult[k] || 0) + yokeGain('mult', 5); }
  else permRetrig[k] = (permRetrig[k] || 0) + yokeGain('retrig', 1);
}

// ── SLOW BURN ───────────────────────────────────────────────────────────────
function slowBurnEarned(card) {
  return Math.min(BAL.slow_burn.cap, Math.floor(((card && card._slowBurnSecs) || 0) / BAL.slow_burn.seconds_per) * (BAL.slow_burn.per || 1));
}
// Sold at its 5th improvement, the Focus limit it had earned stays for the run.
function slowBurnSold(card) {
  if (!card || card.sleightId !== 'slow_burn' || !BAL.slow_burn.keep) return;
  const n = slowBurnEarned(card);
  if (!n) return;
  focusCapPerm += n;
  if (typeof buildFocusMeter === 'function') { buildFocusMeter(); syncFocusMeterState(); }
  showMessage(`🕯️ Slow Burn: +${n} Focus limit kept`, '#cc88ff');
}

// ── FIGHT THE POWER: curses discard themselves when drawn ──────────────────
// While a live one is on the grid (or its Knack is owned), a curse card on the
// board leaves for the back of the deck, one a tick, waiting out a fall.
function fightPowerCurseSweep() {
  if (!(liveFightPower() || hasKnack('fight_power_k')) || animating || falling) return;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._curseCard) continue;
    pierceRoute(cd);
    noteMessage('⚔️ Fight the Power: a curse card discards itself', 'var(--cream-dim)');
    removeAndFall([[r, c]], 'discard');
    return;
  }
}

// ── KEEPER: paid and improving (its 5th and 6th tiers) ─────────────────────
// Called from triggerLevelUp beside Green Station, before the board is swept.
function keeperRoundEnd() {
  const k = typeof boardKeeper === 'function' ? boardKeeper() : null;
  if (!k) return;
  if (BAL.keeper.pay) {
    let n = 0;
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) { const cd = gridData[r]?.[c]; if (cd && cd !== k && boardKeepsCard(cd)) n++; }
    if (n) { grantEntityCoins(n, 'sleight', 'keeper'); noteMessage(`📌 Keeper: +${n} credits for what it kept`, 'var(--gold)'); }
  }
  if (BAL.keeper.improve && typeof improveEntity === 'function') {
    const ids = [...new Set([].concat(...gridData.map(row => (row || []).filter(cd => cd && cd._isSleight && cd !== k).map(cd => cd.sleightId))))].filter(id => canImprove(id));
    const id = ids[Math.floor(Math.random() * ids.length)];
    if (id) { improveEntity(id); noteMessage(`📌 Keeper improved ${SLEIGHT_POOL.find(s => s.id === id)?.name || id}`, 'var(--gold)'); }
  }
}

// ── ROLE CHANGE: a Sleight's 5th improvement makes it a Knack ───────────────
// In Your Face, Fight the Power, Wanderer, The Ringer (IMPROVE_HOOKS, js/improve.js).
// Every copy leaves the run (board, both piles), and `<id>_k` joins the Knacks at
// v6. The Knack reads the Sleight's own BAL row where it needs a number.
function sleightRoleChange(id) {
  const kid = id + '_k', k = KNACK_POOL.find(x => x.id === kid);
  if (!k || (typeof hasKnack === 'function' && hasKnack(kid))) return;
  let cells = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (gridData[r]?.[c]?._isSleight && gridData[r][c].sleightId === id) { gridData[r][c] = null; cells.push([r, c]); }
  drawPile = drawPile.filter(cd => !(cd && cd._isSleight && cd.sleightId === id));
  playedPile = playedPile.filter(cd => !(cd && cd._isSleight && cd.sleightId === id));
  if (typeof grantedSleightIds !== 'undefined') grantedSleightIds.delete(id);
  entityTier[kid] = IMPROVE_MAX_TIER;
  acquiredKnacks.push({ ...k });
  if (typeof applyEntityTiers === 'function') applyEntityTiers();
  if (typeof updateKnackList === 'function') updateKnackList();
  if (typeof updateDeckHud === 'function') updateDeckHud();
  showMessage(`${k.name} changes role: it is a Knack now`, '#cc88ff');
  if (cells.length && !roundEnded) { try { removeAndFall(cells, 'discard'); } catch (e) { render(); } }
}

// ── CHARGES BACK: Trickle Charge and Perpetual Motion (knacks) ──────────────
// sleightChargeSpent(card) is called wherever a Sleight spends a charge
// (consumeSleightCharge, discardSleightAfterUse, lockSleightForRound, a timed
// drain, Wanderer and Logistics). A charge it gives back never calls it again.
let _chargeBackBusy = false;
function _gridSleightsBelowCap(not) {
  const out = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._isSleight || cd === not || typeof cd._usesLeft !== 'number') continue;
    const cap = sleightCapOf(cd);
    if (cap != null && cd._usesLeft < cap) out.push(cd);
  }
  return out;
}
function _chargeGive(card, n) {
  const cap = sleightCapOf(card);
  if (cap == null || typeof card._usesLeft !== 'number') return 0;
  const was = card._usesLeft; card._usesLeft = Math.min(cap, card._usesLeft + n);
  return card._usesLeft - was;
}
function sleightChargeSpent(card) {
  if (_chargeBackBusy || !card) return;
  _chargeBackBusy = true;
  try {
    if (hasKnack('trickle_charge') && luckRoll(BAL.trickle_charge.chance) > 0) {
      const pool = shuffle(_gridSleightsBelowCap(null));
      let got = 0; const names = [];
      pool.slice(0, BAL.trickle_charge.two ? 2 : 1).forEach(cd => { const g = _chargeGive(cd, BAL.trickle_charge.amount); if (g) { got += g; names.push(sleightDef(cd)?.name); } });
      if (got) noteMessage(`🔌 Trickle Charge: ${names.join(' and ')} +${got} charge${got > 1 ? 's' : ''}`, '#6aaa6a');
    }
    if (hasKnack('perpetual_motion') && BAL.perpetual_motion.spend && Math.random() < BAL.perpetual_motion.spend && _chargeGive(card, 1))
      noteMessage(`🔄 Perpetual Motion: ${sleightDef(card)?.name || 'Sleight'} +1 charge`, '#6aaa6a');
  } finally { _chargeBackBusy = false; }
}
// Perpetual Motion: each replay (playHand, the hand's replay count) or, from its
// 5th tier, each pause or rewind rolls for every passive Sleight on the grid.
function perpetualMotionRoll(times) {
  if (!hasKnack('perpetual_motion') || !(times > 0)) return;
  let got = 0;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._isSleight || sleightDef(cd)?.activation !== 'passive') continue;
    for (let i = 0; i < times; i++) if (luckRoll(BAL.perpetual_motion.chance) > 0) got += _chargeGive(cd, BAL.perpetual_motion.amount);
  }
  if (got) noteMessage(`🔄 Perpetual Motion: +${got} charge${got > 1 ? 's' : ''}`, '#6aaa6a');
}
function perpetualMotionOnTime() { if (BAL.perpetual_motion && BAL.perpetual_motion.time) perpetualMotionRoll(1); }

// ── SYNCOPATION (a Knack now) ───────────────────────────────────────────────
// A hand of a different FAMILY (set / run / flush) than the hand before pauses the
// clock. playHand calls this with the hand's name and the previous one's.
function syncopationOnHand(hand, prev) {
  if (!hasKnack('syncopation') || !prev || !hand) return;
  const fam = h => (typeof NS_HAND_FAMILIES !== 'undefined' && NS_HAND_FAMILIES[h]) || [];
  const a = fam(hand), b = fam(prev);
  if (!a.length || !b.length || a.some(f => b.includes(f))) return;
  pauseRound(BAL.syncopation.seconds, 'syncopation', 'knack');
}

// Templates for the knacks this pass added (applyBalDescriptions ran before this
// file loaded, and only over rows with a BAL row; the role Knack reads its own).
(function () {
  ['syncopation', 'trickle_charge', 'perpetual_motion', 'rule_faces_k'].forEach(id => {
    const k = KNACK_POOL.find(x => x.id === id);
    if (k && DESC_TEMPLATES[id] && BAL[id]) k.desc = fillDescTemplate(DESC_TEMPLATES[id], BAL[id]);
  });
})();

// Per-run state.
function sleightTriageReset() { recyclerFreeLeft = 0; }
