// ── MORE EVENTS (r579) ──────────────────────────────────────────────────────
//
// Wild Cards, Trick Gamble, Reschedule, Grid Spinner, Static Bonus and Luck
// Dice (EVENTS.md). Helpers from js/events-flip.js (evBodyEl, evConfirmBtn,
// evSkipShown, evButton, evRow) and the toys in js/event-toys.js.

// ══════════════════════════════════════════════
// WILD CARDS - free the wilds, or double them
// ══════════════════════════════════════════════
// Repeatable. Freeing them (wildsUnbound, js/deck-design.js) is once a run; the
// doubling stops offering itself at WILD_DOUBLE_CAP wilds.
const WILD_DOUBLE_CAP = 16;
function deckWildCount() {
  let n = 0;
  const f = c => { if (c && isWildCard(c)) n++; };
  (drawPile || []).forEach(f); (playedPile || []).forEach(f);
  (gridData || []).forEach(row => (row || []).forEach(f));
  return n;
}
function addWildsToDeck(n) {
  for (let i = 0; i < n; i++) {
    const pos = Math.floor(Math.random() * (drawPile.length + 1));
    drawPile.splice(pos, 0, stampId({ rank: WILD_RANK, suit: WILD_SUIT }));
  }
  expectedDeckTotal += n;
  updateDeckHud();
}
function wildCardsOptions() {
  const n = deckWildCount(), out = [];
  if (!wildsUnbound) out.push({ id: 'free', icon: WILD_RANK, name: 'Wilds run free',
    desc: 'For the rest of the run, wilds also complete runs and flushes.' });
  if (n < WILD_DOUBLE_CAP) out.push({ id: 'double', icon: WILD_RANK + WILD_RANK, name: 'Double the wilds',
    desc: `${n} more wilds go into your deck (${n} → ${n * 2}).` });
  return out;
}
function renderWildCards() {
  const s = eventState, body = evBodyEl();
  s.wcPick = null;
  body.appendChild(evNote(`Your deck holds <b>${deckWildCount()}</b> wilds.`));
  wildCardsOptions().forEach(o => {
    const el = makeChoiceEl({ icon: o.icon, name: o.name, desc: o.desc, cls: 'wc-opt',
      onClick: () => {
        body.querySelectorAll('.wc-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected'); s.wcPick = o.id; setEventConfirm(true);
      } });
    body.appendChild(el);
  });
}
function confirmWildCards() {
  const s = eventState;
  if (s.wcPick === 'free') {
    wildsUnbound = true;
    clearHandCompCache();
    noteMessage('Wilds now complete runs and flushes', 'var(--gold)');
  } else if (s.wcPick === 'double') {
    const n = deckWildCount();
    addWildsToDeck(n);
    noteMessage(`+${n} wilds`, 'var(--gold)');
  }
  closeEvent();
}

// ══════════════════════════════════════════════
// TRICK GAMBLE - two Tricks, one up two tiers, one gone
// ══════════════════════════════════════════════
function trickGambleChoices() { return (trickTray || []).filter(t => canImprove(t.id)); }
function renderTrickGamble() {
  const s = eventState, body = evBodyEl();
  s.tgPicks = []; s.tgDone = false;
  body.appendChild(evNote('Choose two Tricks. One of them is improved twice, the other is deleted. You do not choose which.'));
  const wrap = document.createElement('div'); wrap.className = 'ev-choice-grid'; body.appendChild(wrap);
  s.tgEls = trickGambleChoices().map(t => {
    const em = (typeof trickEmoji === 'function') ? trickEmoji(t) : '✦';
    const el = makeChoiceEl({ tile: { entity: 'trick', id: t.id, emoji: em, label: t.name }, rarity: t.tier, name: t.name,
      desc: `v${entityTierOf(t.id) + 1}.0 → v${Math.min(IMPROVE_MAX_TIER, entityTierOf(t.id) + 2) + 1}.0`,
      onClick: () => {
        if (s.tgDone) return;
        const at = s.tgPicks.indexOf(t);
        if (at >= 0) s.tgPicks.splice(at, 1);
        else if (s.tgPicks.length < 2) s.tgPicks.push(t);
        s.tgEls.forEach(x => x.el.classList.toggle('selected', s.tgPicks.includes(x.t)));
        setEventConfirm(s.tgPicks.length === 2);
      } });
    wrap.appendChild(el);
    return { t, el };
  });
}
function confirmTrickGamble() {
  const s = eventState;
  if (s.tgDone) { closeEvent(); return; }
  if (s.tgPicks.length !== 2) return;
  s.tgDone = true;
  setEventConfirm(false); evSkipShown(false);
  const win = Math.floor(Math.random() * 2);
  const els = s.tgPicks.map(t => s.tgEls.find(x => x.t === t).el);
  s.tgEls.forEach(x => { if (!s.tgPicks.includes(x.t)) x.el.classList.add('locked'); });
  evReveal(els[0]);
  let k = 0;
  const flips = 8 + win;
  const step = () => {
    els.forEach((e, i) => e.classList.toggle('selected', i === k % 2));
    if (k < flips) { k++; try { sfxClockTick?.(); } catch (e) {} setTimeout(step, 90 + k * 20); return; }
    const W = s.tgPicks[win], L = s.tgPicks[1 - win];
    improveEntity(W.id); if (canImprove(W.id)) improveEntity(W.id);
    if (typeof syncOwnedEntityDescs === 'function') syncOwnedEntityDescs();
    const ti = trickTray.findIndex(t => t.id === L.id); if (ti >= 0) trickTray.splice(ti, 1);
    const ai = acquiredTricks.findIndex(t => t.id === L.id); if (ai >= 0) acquiredTricks.splice(ai, 1);
    renderTrickTray();
    // r590 (owner): the deleted one fades out; the winner redraws with its new art
    // (the tier class gives the disc its bands and colour, the badge its version).
    els[1 - win].classList.add('tg-gone');
    const tile = els[win].querySelector('.ec-tile');
    if (tile && typeof entityTileHTML === 'function') {
      const em = (typeof trickEmoji === 'function') ? trickEmoji(W) : '✦';
      tile.innerHTML = entityTileHTML({ entity: 'trick', id: W.id, emoji: em, label: W.name }, W.tier || 'common');
      tile.classList.remove('tg-up'); void tile.offsetWidth; tile.classList.add('tg-up');
      const nm = tile.querySelector('.rwd-name'); if (nm && typeof fitRewardName === 'function') requestAnimationFrame(() => fitRewardName(nm));
    }
    const desc = els[win].querySelector('.ec-desc'); if (desc) desc.textContent = `v${entityTierOf(W.id) + 1}.0`;
    const n = evNote(`<b>${W.name}</b> is now v${entityTierOf(W.id) + 1}.0. <b>${L.name}</b> is gone.`);
    evBodyEl().appendChild(n); evReveal(n);
    try { sfxRewardGood?.(); } catch (e) {}
    evConfirmBtn('DONE', true);
  };
  step();
}

// ══════════════════════════════════════════════
// RESCHEDULE - see the next two bosses, pay to swap them
// ══════════════════════════════════════════════
// This quarter's held boss (actBossId) and the next quarter's (peekNextActBoss,
// the same forecast Advance Notice reads). A reroll deals both again from the bag.
function rescheduleBosses() {
  const out = [];
  if (actBossId) { const p = BOSS_PRESETS.find(x => x.id === actBossId); if (p) out.push({ when: 'THIS QUARTER', p }); }
  const nx = (typeof peekNextActBoss === 'function') ? peekNextActBoss() : null;
  if (nx) out.push({ when: 'NEXT QUARTER', p: nx });
  return out;
}
function reschedulePrice() { return priceOf(BAL.reschedule.price + BAL.reschedule.step * (eventState.rsRolls || 0)); }
function rescheduleDraw(oldId) {
  let p = null;
  for (let k = 0; k < 6; k++) { p = nextBossPreset(); if (p && p.id !== oldId) break; }
  return p;
}
function rescheduleList(body) {
  document.getElementById('rs-list')?.remove();
  const wrap = document.createElement('div'); wrap.id = 'rs-list'; body.appendChild(wrap);
  rescheduleBosses().forEach(b => {
    wrap.appendChild(evLabel(b.when, true));
    wrap.appendChild(makeChoiceEl({ icon: '☠', name: b.p.name, desc: b.p.brief || b.p.flavor || '', cls: 'rs-boss' }));
  });
  return wrap;
}
function renderReschedule() {
  const body = evBodyEl();
  eventState.rsRolls = 0;
  body.appendChild(evNote('Below are your next two bosses. Pay to reroll them or face them as is.'));
  rescheduleList(body);
  rescheduleSync();
}
function rescheduleSync() {
  const s = eventState, left = BAL.reschedule.rolls - s.rsRolls;
  evConfirmBtn(left > 0 ? `REROLL · ${reschedulePrice()}` : 'NO REROLLS LEFT', left > 0 && coins >= reschedulePrice());
}
function confirmReschedule() {
  const s = eventState;
  if (s.rsRolls >= BAL.reschedule.rolls || coins < reschedulePrice()) return;
  coins -= reschedulePrice(); updateCoinsUI?.();
  s.rsRolls++;
  const skip = document.getElementById('event-skip'); if (skip) skip.textContent = 'Done';
  if (actBossId) { const p = rescheduleDraw(actBossId); if (p) actBossId = p.id; }
  if (nextActBossId) { const p = rescheduleDraw(nextActBossId); if (p) nextActBossId = p.id; }
  if (typeof updateActProgressUI === 'function') updateActProgressUI();
  const list = rescheduleList(evBodyEl());
  list.classList.add('evt-fresh'); evReveal(list);
  try { sfxRewardReveal?.(); } catch (e) {}
  rescheduleSync();
}

// ══════════════════════════════════════════════
// GRID SPINNER - stop the light, grow the grid
// ══════════════════════════════════════════════
// Sixteen cards (r590, owner: +1 four, 2 stones, +1 two, +1 three; padded to a
// 4x4 with an Ace and a two): A x4, 2 x5, 3 x3, 4 x2, stone x2. The light
// follows a new pattern every time (evGridPath), 10% faster than before, and
// fades off each card it leaves. The rank you stop on is how many rows and
// columns you add, split as you like; a stone adds nothing. Past the grid's
// maximum, each point left becomes +1 to a random other limit.
const SPINNER_CARDS = ['A', 'A', 'A', 'A', '2', '2', '2', '2', '2', '3', '3', '3', '4', '4', 'stone', 'stone'];
const SPINNER_STEP_MS = 56;
function renderGridSpinner() {
  const s = eventState, body = evBodyEl();
  s.gsLeft = 0; s.gsPhase = 'spin';
  body.appendChild(evNote('Tap to stop the light on a rank. Increase your row and/or column limits that many times.'));
  const deal = evShuffle(SPINNER_CARDS.slice());
  const face = r => r === 'stone' ? '<span class="evt-rank evt-stone">STONE</span>' : `<span class="evt-rank">${r}</span>`;
  evStopper(deal.map(face), body, { cols: 4, stepMs: SPINNER_STEP_MS, order: evGridPath(4, 4) }).then(i => {
    s.gsLeft = deal[i] === 'stone' ? 0 : deal[i] === 'A' ? 1 : +deal[i];
    s.gsPhase = 'grow'; evSkipShown(false);
    s.gsRow = evRow(body);
    s.gsNote = document.createElement('div'); body.appendChild(s.gsNote);
    if (!s.gsLeft) { s.gsRow.innerHTML = '<div class="evt-big lose" style="width:100%">STONE · NOTHING</div>'; s.gsPhase = 'done'; evConfirmBtn('DONE', true); evReveal(s.gsRow); return; }
    spinnerSync();
    evReveal(s.gsRow);
  });
  evConfirmBtn('DONE', false);
}
function spinnerGrow(id) {
  const s = eventState;
  if (s.gsLeft < 1 || !limitCanIncrement(id)) return;
  incrementLimit(id); if (typeof onLimitChanged === 'function') onLimitChanged(id);
  s.gsLeft--;
  spinnerSync();
}
function spinnerSync() {
  const s = eventState;
  const canR = limitCanIncrement('grid_rows'), canC = limitCanIncrement('grid_cols');
  if (s.gsLeft > 0 && !canR && !canC) {
    const got = [];
    for (; s.gsLeft > 0; s.gsLeft--) {
      const pool = LIMITS_DEF.filter(d => d.id !== 'grid_rows' && d.id !== 'grid_cols' && limitCanIncrement(d.id));
      if (!pool.length) break;
      const d = pool[Math.floor(Math.random() * pool.length)];
      got.push(`${limitDeltaText(d.id, 1)} ${d.label}`);
      incrementLimit(d.id); if (typeof onLimitChanged === 'function') onLimitChanged(d.id);
    }
    s.gsLeft = 0;
    if (got.length) s.gsNote.appendChild(evNote(`The grid is at its maximum: ${got.join(', ')}.`));
  }
  s.gsRow.innerHTML = '';
  if (s.gsLeft > 0) {
    const r = evButton(`+1 ROW (${limits.grid_rows.current})`, () => spinnerGrow('grid_rows')); r.disabled = !canR;
    const c = evButton(`+1 COLUMN (${limits.grid_cols.current})`, () => spinnerGrow('grid_cols')); c.disabled = !canC;
    s.gsRow.appendChild(r); s.gsRow.appendChild(c);
    s.gsRow.insertAdjacentHTML('afterbegin', `<div class="evt-big win" style="width:100%">${s.gsLeft} TO PLACE</div>`);
  } else {
    s.gsRow.insertAdjacentHTML('afterbegin', `<div class="evt-big win" style="width:100%">GRID ${limits.grid_rows.current} × ${limits.grid_cols.current}</div>`);
    s.gsPhase = 'done';
  }
  evConfirmBtn('DONE', s.gsPhase === 'done');
}
function confirmGridSpinner() { if (eventState.gsPhase === 'done') closeEvent(); }

// ══════════════════════════════════════════════
// STATIC BONUS - flat pips or mult on every hand
// ══════════════════════════════════════════════
// Added to the hand's base before anything fires (calcScore's starting pips and
// mult, and the ledger the dance seeds from), for the rest of the run. The amount
// is the quarter x 4, 5 or 6 for mult; pips get three times that, which under the
// card ladder is about the same score.
// staticPips / staticMult are declared in js/scoring.js, which reads them.
const STATIC_STEPS = [4, 5, 6];
// The type wheel (r590, owner): mostly a plus, one blank (the event ends there)
// and one minus (the amount is taken off every hand).
const STATIC_KINDS = [
  { kind: 'pips', sign: 1,  label: '+PIPS', color: '#4d8dff' },
  { kind: 'mult', sign: 1,  label: '+MULT', color: '#ff5a4e' },
  { kind: 'pips', sign: 1,  label: '+PIPS', color: '#3f74d6' },
  { kind: 'mult', sign: 1,  label: '+MULT', color: '#d9483e' },
  { kind: null,   sign: 0,  label: 'BLANK', color: '#3a3552' },
  { kind: 'pips', sign: -1, label: '−PIPS', color: '#1d1a2c' },
];
function staticQuarter() { return (typeof qrlQuarter === 'function') ? qrlQuarter() : 1; }
function staticAmount(kind, step) { return staticQuarter() * step * (kind === 'pips' ? 3 : 1); }
function staticAdd(kind, n) { if (kind === 'pips') staticPips += n; else staticMult += n; }
function renderStaticBonus() {
  const s = eventState, body = evBodyEl();
  s.sbPhase = 'spin';
  body.appendChild(evNote(`Two wheels: what buff and how much. Every hand gets this bonus moving forward.${staticPips || staticMult ? ` You have <b>${fmtSigned(staticPips)} pips</b> and <b>${fmtSigned(staticMult)} mult</b> now.` : ''}`));
  const row = document.createElement('div'); row.className = 'evt-pair'; body.appendChild(row);
  s.sbKind = evWheel(STATIC_KINDS.map(k => ({ label: k.label, color: k.color, ink: '#fff' })), row, { title: 'What buff' });
  s.sbRow = row;
  s.sbOut = document.createElement('div'); body.appendChild(s.sbOut);
  evConfirmBtn('SPIN', true);
}
function confirmStaticBonus() {
  const s = eventState;
  if (s.sbPhase === 'done') { closeEvent(); return; }
  if (s.sbPhase !== 'spin') return;
  s.sbPhase = 'busy'; evSkipShown(false); evConfirmBtn('SPIN', false);
  const kindIdx = Math.floor(Math.random() * STATIC_KINDS.length), K = STATIC_KINDS[kindIdx];
  const stepIdx = Math.floor(Math.random() * 6), step = STATIC_STEPS[stepIdx % 3];
  evReveal(s.sbRow);
  s.sbKind.spin(kindIdx).then(() => {
    if (!K.kind) {
      const res = document.createElement('div'); res.className = 'evt-big'; res.textContent = 'NOTHING';
      s.sbOut.appendChild(res); evReveal(res);
      s.sbPhase = 'done'; evConfirmBtn('DONE', true);
      return;
    }
    const sg = K.sign > 0 ? '+' : '−';
    const segs = [0, 1, 2, 0, 1, 2].map(i => ({ label: `${sg}${staticAmount(K.kind, STATIC_STEPS[i])}`,
      color: K.sign > 0 ? ['#2a6b5a', '#35d59b', '#1f8f6a'][i] : ['#5c1d1d', '#8f2b2b', '#6e2222'][i], ink: '#fff' }));
    const amt = evWheel(segs, s.sbRow, { title: `How much ${K.kind}` });
    return _etWait(350).then(() => amt.spin(stepIdx)).then(() => {
      const n = K.sign * staticAmount(K.kind, step);
      staticAdd(K.kind, n);
      const res = document.createElement('div');
      const paint = v => { res.className = 'evt-big ' + (v > 0 ? 'win' : 'lose'); res.textContent = `${fmtSigned(v)} ${K.kind.toUpperCase()} ON EVERY HAND`; };
      paint(n);
      s.sbOut.appendChild(res); evReveal(res);
      try { (n > 0 ? sfxRewardGood : sfxRewardBad)?.(); } catch (e) {}
      s.sbPhase = 'done'; evConfirmBtn('DONE', true);
      evDoubleOrFlip(s.sbOut, n, d => { staticAdd(K.kind, d); }, paint);
    });
  });
}

// ── Double or flip (r590, owner): after a Static Bonus or Luck Dice result, pay a
// quarter of your credits (the amount is printed, never the fraction) to flip a
// coin: heads doubles the result, tails turns it the other way round.
function doubleFlipPrice() { return Math.max(1, Math.round(coins / 4)); }
function evDoubleOrFlip(parent, n, add, paint) {
  if (!n || coins < 1) return;
  const price = doubleFlipPrice();
  const row = evRow(parent);
  const btn = evButton(`FLIP FOR IT · ${price} credits`, () => {
    if (coins < price) return;
    coins -= price; updateCoinsUI?.();
    row.innerHTML = '';
    evConfirmBtn('DONE', false);
    const coin = evCoin(parent);
    evReveal(coin.el);
    const side = Math.random() < 0.5 ? 'heads' : 'tails';
    coin.flip(side).then(() => {
      const now = side === 'heads' ? 2 * n : -n;
      add(now - n);
      coin.caption(side === 'heads' ? 'HEADS · DOUBLED' : 'TAILS · TURNED', side === 'heads' ? 'win' : 'lose');
      if (paint) paint(now);
      try { (now > 0 ? sfxRewardGood : sfxRewardBad)?.(); } catch (e) {}
      evConfirmBtn('DONE', true);
    });
  }, true);
  row.appendChild(btn);
}

// ══════════════════════════════════════════════
// LUCK DICE - two dice, multiplied, onto Luck
// ══════════════════════════════════════════════
// Moves luckModifiers, like Fortune and Jinx, so it can take Luck below zero.
const LUCK_DIE_A = [-1, -2, -3, 1, 2, 3];
const LUCK_DIE_B = [-1, -2, 3, 4, 5, 6];
function renderLuckDice() {
  const s = eventState, body = evBodyEl();
  s.ldPhase = 'roll';
  body.appendChild(evNote(`Luck is <b>${luckTotal()}</b>.`));
  const row = document.createElement('div'); row.className = 'evt-pair'; body.appendChild(row);
  s.ldA = evDie(LUCK_DIE_A, row, 'Faces:'); s.ldB = evDie(LUCK_DIE_B, row, 'Faces:');
  s.ldOut = document.createElement('div'); body.appendChild(s.ldOut);
  evConfirmBtn('ROLL', true);
}
function confirmLuckDice() {
  const s = eventState;
  if (s.ldPhase === 'done') { closeEvent(); return; }
  if (s.ldPhase !== 'roll') return;
  s.ldPhase = 'busy'; evSkipShown(false); evConfirmBtn('ROLL', false);
  const a = LUCK_DIE_A[Math.floor(Math.random() * 6)], b = LUCK_DIE_B[Math.floor(Math.random() * 6)];
  Promise.all([s.ldA.roll(a), _etWait(120).then(() => s.ldB.roll(b))]).then(() => {
    const was = luckTotal(), n = a * b;
    luckModifiers += n;
    const res = document.createElement('div'); res.className = 'evt-big ' + (n > 0 ? 'win' : 'lose');
    res.textContent = `${a > 0 ? a : `(${a})`} × ${b > 0 ? b : `(${b})`} = ${n > 0 ? '+' : ''}${n} LUCK`;
    s.ldOut.appendChild(res);
    const line = evNote(`Luck ${was} → ${luckTotal()}`);
    s.ldOut.appendChild(line);
    evReveal(res);
    try { (n > 0 ? sfxRewardGood : sfxRewardBad)?.(); } catch (e) {}
    s.ldPhase = 'done'; evConfirmBtn('DONE', true);
    evDoubleOrFlip(s.ldOut, n, d => { luckModifiers += d; }, v => {
      res.className = 'evt-big ' + (v > 0 ? 'win' : 'lose'); res.textContent = `${fmtSigned(v)} LUCK`;
      line.innerHTML = `Luck ${was} → ${luckTotal()}`;
    });
  });
}

// ══════════════════════════════════════════════
// THE STRUCTURAL EVENTS (r580) - owner: structural buffs are event-only
// ══════════════════════════════════════════════
// Two events pay the structural families (EVENTS.md, the card-buff value
// split): State Change sells a card state for credits; Rewire pays a replay, a
// second suit or a second rank and costs junk cards in the deck.

const evFace = c => `${c.rank}${c.suit}`;

// ── STATE CHANGE: a card state, bought for credits ──
function stateChangePrice(def) { return priceOf(BAL.state_change[def.tier] || BAL.state_change.rare); }
function stateChangeOffers() {
  let pool = Object.keys(CARD_STATE_DEFS).filter(id => id !== 'fleeting').map(id => ({ id, ...CARD_STATE_DEFS[id] }));
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const d = pickEntityByRarity(pool, x => x.tier || 'common');
    out.push(d); pool = pool.filter(x => x.id !== d.id);
  }
  return out;
}
function renderStateChange() {
  const s = eventState, body = evBodyEl();
  s.scState = null;
  body.appendChild(evLabel('1 · THE STATE'));
  stateChangeOffers().forEach(d => {
    const price = stateChangePrice(d);
    const el = makeChoiceEl({ icon: d.icon, rarity: d.tier, name: d.name, desc: d.desc, cost: `${price} credits`, cls: 'sc-opt',
      onClick: () => {
        if (coins < price) return;
        body.querySelectorAll('.sc-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected'); s.scState = d; stateChangeSync();
      } });
    if (coins < price) el.classList.add('locked');
    body.appendChild(el);
  });
  body.appendChild(evLabel('2 · THE CARD'));
  s.picker = evDeckPicker(body, { max: 1, onChange: stateChangeSync });
  stateChangeSync();
}
function stateChangeSync() {
  const s = eventState;
  setEventConfirm(!!s.scState && s.picker.picks.length === 1 && coins >= stateChangePrice(s.scState));
}
function confirmStateChange() {
  const s = eventState;
  if (!s.scState || s.picker.picks.length !== 1) return;
  const price = stateChangePrice(s.scState);
  if (coins < price) return;
  const t = resolveDeckCard(s.picker.picks[0]);
  if (!t) { closeEvent(); return; }
  coins -= price; updateCoinsUI?.();
  addCardState(t, s.scState.id, 1);
  noteMessage(`${evFace(t)} is ${s.scState.name}`, 'var(--gold)');
  closeEvent();
}

// ── REWIRE: replay, second suit or second rank, for junk; up to three times ──
const REWIRE_OPS = [
  { id: 'replay', icon: '↻', name: 'Replay', desc: 'Both cards replay once more when they score.' },
  { id: 'suit2',  icon: '♠♥', name: 'Second Suit', desc: 'The first card takes the second card’s suit as a second suit.' },
  { id: 'rank2',  icon: '7/8', name: 'Second Rank', desc: 'The first card takes the second card’s rank as a second rank.' },
];
const REWIRE_TIMES = 3;
function renderRewire() {
  const s = eventState, body = evBodyEl();
  s.rwOp = null; s.rwDone = 0;
  body.appendChild(evNote(`(${BAL.rewire.junk} junk cards are added to your deck.)`));
  body.appendChild(evLabel('1 · THE CHANGE'));
  REWIRE_OPS.forEach(o => {
    const el = makeChoiceEl({ icon: o.icon, rarity: 'epic', name: o.name, desc: o.desc, cls: 'rw-opt',
      onClick: () => {
        body.querySelectorAll('.rw-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected'); s.rwOp = o.id;
        const keep = s.picker.picks.filter(c => !rewireFull(c)); s.picker.picks.length = 0; s.picker.picks.push(...keep);
        s.picker.sync(); rewireSync();
      } });
    body.appendChild(el);
  });
  s.rwLabel = evLabel(''); body.appendChild(s.rwLabel);
  s.rwSlot = document.createElement('div'); body.appendChild(s.rwSlot);
  s.rwNote = document.createElement('div'); body.appendChild(s.rwNote);
  rewireBuildPicker();
}
// Rebuilt after each use: a card that just took a second suit or rank leaves the offer.
function rewireBuildPicker() {
  const s = eventState;
  s.rwSlot.innerHTML = '';
  s.rwLabel.textContent = `2 · TWO CARDS, IN ORDER${s.rwDone ? ` · ${s.rwDone} OF ${REWIRE_TIMES} DONE` : ''}`;
  s.picker = evDeckPicker(s.rwSlot, { max: 2, ordered: true, onChange: rewireSync,
    cards: everyDeckCard().filter(c => !isWildCard(c) && !c.suit2 && !c.rank2),
    blocked: c => rewireFull(c) ? 'Quarter resource limit (QRL) reached' : '' });
  rewireSync();
}
function rewireFull(card) {
  const s = eventState;
  return s.rwOp === 'replay' && typeof qrlCardFull === 'function' && qrlCardFull(card, 'retrig');
}
function rewireSync() {
  const s = eventState, p = s.picker.picks;
  s.rwNote.innerHTML = p.length ? `<div class="ev-note">${p.map((c, i) => `${i ? 'Second' : 'First'}: <b>${evFace(c)}</b>`).join(' · ')}</div>` : '';
  evConfirmBtn('REWIRE', !!s.rwOp && p.length === 2);
}
function confirmRewire() {
  const s = eventState;
  if (!s.rwOp || s.picker.picks.length !== 2) return;
  const [a, b] = s.picker.picks.map(c => resolveDeckCard(c));
  if (!a || !b) { closeEvent(); return; }
  if (s.rwOp === 'replay') { enhanceCardKey(cardId(a), { retrig: 1 }); enhanceCardKey(cardId(b), { retrig: 1 }); }
  else if (s.rwOp === 'suit2') a.suit2 = b.suit;
  else a.rank2 = b.rank;
  clearHandCompCache();
  addJunkToDeck(BAL.rewire.junk);
  noteMessage(s.rwOp === 'replay' ? `${evFace(a)} and ${evFace(b)} replay` : `${evFace(a)} is now ${s.rwOp === 'suit2' ? `${a.suit}/${a.suit2}` : `${a.rank}/${a.rank2}`}`, 'var(--gold)');
  s.rwDone++;
  if (s.rwDone >= REWIRE_TIMES) { closeEvent(); return; }
  const skip = document.getElementById('event-skip'); if (skip) skip.textContent = 'Done';
  rewireBuildPicker();
}
