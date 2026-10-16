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
  body.appendChild(evNote('Choose two. One of them improves twice; the other is deleted. You do not choose which.'));
  const wrap = document.createElement('div'); wrap.className = 'ev-choice-grid'; body.appendChild(wrap);
  s.tgEls = trickGambleChoices().map(t => {
    const em = (typeof trickEmoji === 'function') ? trickEmoji(t) : '✦';
    const el = makeChoiceEl({ tile: { entity: 'trick', id: t.id, emoji: em, label: t.name }, rarity: t.tier, name: t.name,
      desc: `v${entityTierOf(t.id) + 1}.0 → v${Math.min(IMPROVE_MAX_TIER, entityTierOf(t.id) + 2) + 1}.0 if it wins`,
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
    els[1 - win].classList.add('locked');
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
function reschedulePrice() { return priceOf(BAL.reschedule.price); }
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
  eventState.rsDone = false;
  body.appendChild(evNote(`Reroll both for ${reschedulePrice()} credits. The new ones are drawn from the bosses you have not met.`));
  rescheduleList(body);
  evConfirmBtn(`REROLL · ${reschedulePrice()}`, coins >= reschedulePrice());
}
function confirmReschedule() {
  const s = eventState;
  if (s.rsDone) { closeEvent(); return; }
  if (coins < reschedulePrice()) return;
  coins -= reschedulePrice(); updateCoinsUI?.();
  s.rsDone = true; evSkipShown(false);
  if (actBossId) { const p = rescheduleDraw(actBossId); if (p) actBossId = p.id; }
  if (nextActBossId) { const p = rescheduleDraw(nextActBossId); if (p) nextActBossId = p.id; }
  if (typeof updateActProgressUI === 'function') updateActProgressUI();
  const list = rescheduleList(evBodyEl());
  list.classList.add('evt-fresh'); evReveal(list);
  try { sfxRewardReveal?.(); } catch (e) {}
  evConfirmBtn('DONE', true);
}

// ══════════════════════════════════════════════
// GRID SPINNER - stop the light, grow the grid
// ══════════════════════════════════════════════
// Nine rank cards, A A A 2 2 2 3 3 4, shuffled, under a fast light. The rank you
// stop on is how many rows and columns you add, split as you like. Past the
// grid's maximum, each point left becomes +1 to a random other limit.
const SPINNER_RANKS = ['A', 'A', 'A', '2', '2', '2', '3', '3', '4'];
function renderGridSpinner() {
  const s = eventState, body = evBodyEl();
  s.gsLeft = 0; s.gsPhase = 'spin';
  body.appendChild(evNote('Tap to stop the light. Its rank is how many rows and columns your grid grows by. At the maximum grid, each one left becomes +1 to a random limit.'));
  const deal = evShuffle(SPINNER_RANKS.slice());
  evStopper(deal.map(r => `<span class="evt-rank">${r}</span>`), body, { stepMs: 62 }).then(i => {
    s.gsLeft = deal[i] === 'A' ? 1 : +deal[i];
    s.gsPhase = 'grow'; evSkipShown(false);
    s.gsRow = evRow(body);
    s.gsNote = document.createElement('div'); body.appendChild(s.gsNote);
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
function staticQuarter() { return (typeof qrlQuarter === 'function') ? qrlQuarter() : 1; }
function staticAmount(kind, step) { return staticQuarter() * step * (kind === 'pips' ? 3 : 1); }
function renderStaticBonus() {
  const s = eventState, body = evBodyEl();
  s.sbPhase = 'spin';
  body.appendChild(evNote(`Every hand starts with it, for the rest of the run.${staticPips || staticMult ? ` You have <b>+${staticPips} pips</b> and <b>+${staticMult} mult</b> now.` : ''}`));
  const row = document.createElement('div'); row.className = 'evt-pair'; body.appendChild(row);
  s.sbKind = evWheel(['PIPS', 'MULT', 'PIPS', 'MULT', 'PIPS', 'MULT'].map(l => ({ label: l, color: l === 'PIPS' ? '#4d8dff' : '#ff5a4e', ink: '#fff' })), row, { title: 'Pips or mult' });
  s.sbRow = row;
  s.sbOut = document.createElement('div'); body.appendChild(s.sbOut);
  evConfirmBtn('SPIN', true);
}
function confirmStaticBonus() {
  const s = eventState;
  if (s.sbPhase === 'done') { closeEvent(); return; }
  if (s.sbPhase !== 'spin') return;
  s.sbPhase = 'busy'; evSkipShown(false); evConfirmBtn('SPIN', false);
  const kindIdx = Math.floor(Math.random() * 6), kind = kindIdx % 2 ? 'mult' : 'pips';
  const stepIdx = Math.floor(Math.random() * 6), step = STATIC_STEPS[stepIdx % 3];
  evReveal(s.sbRow);
  s.sbKind.spin(kindIdx).then(() => {
    const segs = [0, 1, 2, 0, 1, 2].map(i => ({ label: `+${staticAmount(kind, STATIC_STEPS[i])}`,
      color: ['#2a6b5a', '#35d59b', '#1f8f6a'][i], ink: '#fff' }));
    const amt = evWheel(segs, s.sbRow, { title: `How much ${kind}` });
    return _etWait(350).then(() => amt.spin(stepIdx));
  }).then(() => {
    const n = staticAmount(kind, step);
    if (kind === 'pips') staticPips += n; else staticMult += n;
    const res = document.createElement('div'); res.className = 'evt-big win';
    res.textContent = `+${n} ${kind.toUpperCase()} ON EVERY HAND`;
    s.sbOut.appendChild(res); evReveal(res);
    try { sfxRewardGood?.(); } catch (e) {}
    s.sbPhase = 'done'; evConfirmBtn('DONE', true);
  });
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
  s.ldA = evDie(LUCK_DIE_A, row); s.ldB = evDie(LUCK_DIE_B, row);
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
    s.ldOut.appendChild(evNote(`Luck ${was} → ${luckTotal()}`));
    evReveal(res);
    try { (n > 0 ? sfxRewardGood : sfxRewardBad)?.(); } catch (e) {}
    s.ldPhase = 'done'; evConfirmBtn('DONE', true);
  });
}
