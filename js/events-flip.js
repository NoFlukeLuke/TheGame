// ── FLIP EVENTS (r578) ──────────────────────────────────────────────────────
//
// The owner's coin-toss set (EVENTS.md): Keep It, Hot Streak, Prize Ladder,
// Call It and Plinko. Every result is rolled before the coin moves (the toys in
// js/event-toys.js only show it). Prices run through priceOf, so BAL holds half
// of what the screen says.
//
// Rewards that are a SCREEN (a pick of three, a limits pick) are drawn on the
// board after the event panel closes: evRunScreens hides the panel, runs them
// one after another and then ends the event.

function evFlipSide() { return Math.random() < 0.5 ? 'heads' : 'tails'; }
function evBodyEl() { return document.getElementById('event-body'); }
function evConfirmBtn(label, on) {
  const b = document.getElementById('event-confirm');
  if (b) { b.textContent = label; b.disabled = !on; }
}
function evSkipShown(on) { const b = document.getElementById('event-skip'); if (b) b.style.display = on ? 'inline-block' : 'none'; }
function evButton(label, onClick, alt) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'ev-btn' + (alt ? ' evt-alt' : '');
  b.textContent = label; b.addEventListener('click', onClick);
  return b;
}
function evRow(parent) { const d = document.createElement('div'); d.className = 'evt-btnrow'; parent.appendChild(d); return d; }

// ── Board screens after an event ────────────────────────────────────────────
// A step is 'pick3' (the Schedule's pick of three), a Flow chain kind ('limits',
// 'improve', 'tricks', 'sleights', 'knacks') on the shared pick board, or
// 'improve_random': one random owned entity up a tier, run AFTER the screens
// before it so a pick just taken can be the one improved. With nothing to
// improve it becomes a pick of three.
function evToBoard() {
  document.getElementById('event-overlay')?.classList.remove('show');
  document.getElementById('next-goal-bg')?.classList.remove('show');
}
function evRunScreens(steps, done) {
  const list = steps.slice();
  const next = () => {
    const k = list.shift();
    if (!k) { (done || closeEvent)(); return; }
    if (k === 'pick3') guidedOpenPickThree(next);
    else if (k === 'improve_random') {
      const nm = evRandomImprove();
      if (nm) { showMessage(`${nm} improved`, '#e0813a'); setTimeout(next, 700); }
      else guidedOpenPickThree(next);
    }
    else evKindPick(k, next);
  };
  evToBoard();
  next();
}
function evKindPick(kind, done) {
  const offers = flowrBuildOffers(kind);
  if (!offers.length) { done(); return; }
  openGridPick({
    title: FLOWR_KINDS[kind] ? FLOWR_KINDS[kind].label() : 'TAKE ONE', tone: 'reward',
    offers: offers.map(o => ({ entity: o.type === 'improve' ? o.etype : o.type, _improve: o.type === 'improve',
      id: o.id, emoji: o.icon, icon: o.icon, label: o.name, desc: o.desc, rarity: o.rar, tag: o.tag })),
    actions: [],
    onChoose: i => { flowrGrantOffer(offers[i]); done(); },
    onSkip: () => done(),
  });
}
// One random owned entity goes up a tier. Returns its name, or null.
function evRandomImprove() {
  const pool = evImprovables();
  if (!pool.length) return null;
  const e = pool[Math.floor(Math.random() * pool.length)];
  improveEntity(e.id);
  if (typeof syncOwnedEntityDescs === 'function') syncOwnedEntityDescs();
  return e.name;
}

// ══════════════════════════════════════════════
// KEEP IT - pick a reward, then flip for it
// ══════════════════════════════════════════════
// Three entities, rare or better. Heads keeps the one you chose. Tails loses it
// unless you pay half your credits (at most keep_cap) to flip again, as often
// as you can pay.
function keepItOffers() {
  const pools = guidedPickPools();
  if (typeof trickTrayFull === 'function' && trickTrayFull()) pools.trick = [];
  const out = [];
  for (let i = 0; i < 3; i++) {
    const type = guidedPickType(pools);
    if (!type) break;
    const tierOf = type === 'trick' ? (e => e.tier || 'common') : (e => e.rarity || 'common');
    const lifted = pools[type].filter(e => tierOf(e) !== 'common');
    const d = pickEntityByRarity(lifted.length ? lifted : pools[type], tierOf);
    if (!d) break;
    pools[type] = pools[type].filter(x => x.id !== d.id);
    const o = guidedPickOffer(type, d);
    if (o) out.push(o);
  }
  return out;
}
function keepItPrice() { return Math.min(priceOf(BAL.flip_events.keep_cap), Math.ceil(coins / 2)); }
function renderKeepIt() {
  const s = eventState, body = evBodyEl();
  s.kiOffers = keepItOffers(); s.kiPick = -1; s.kiPhase = 'pick';
  if (!s.kiOffers.length) { body.innerHTML = evEmptyHTML('Nothing left to offer.'); s.kiNone = true; evConfirmBtn('DONE', true); return; }
  body.appendChild(evNote(`Heads, it is yours. Tails, it is gone, unless you pay half your credits (at most ${priceOf(BAL.flip_events.keep_cap)}) to flip again.`));
  s.kiEls = s.kiOffers.map((o, i) => {
    const el = makeChoiceEl({ tile: { entity: o.entity, emoji: o.emoji, label: o.label }, rarity: o.rarity, name: o.label, desc: o.desc,
      onClick: () => {
        if (s.kiPhase !== 'pick') return;
        s.kiEls.forEach(e => e.classList.remove('selected'));
        el.classList.add('selected'); s.kiPick = i; evConfirmBtn('FLIP', true);
      } });
    body.appendChild(el);
    return el;
  });
  evConfirmBtn('FLIP', false);
}
function confirmKeepIt() {
  const s = eventState;
  if (s.kiNone || s.kiPhase === 'done') { closeEvent(); return; }
  if (s.kiPhase !== 'pick' || s.kiPick < 0) return;
  s.kiEls.forEach((e, i) => { if (i !== s.kiPick) e.classList.add('locked'); });
  s.kiCoin = evCoin(evBodyEl());
  s.kiRow = evRow(evBodyEl());
  keepItFlip(false);
}
function keepItFlip(paid) {
  const s = eventState;
  if (paid) {
    const price = keepItPrice();
    if (price < 1 || coins < price) return;
    coins -= price; updateCoinsUI?.();
  }
  s.kiPhase = 'busy';
  evSkipShown(false); evConfirmBtn('FLIP', false); s.kiRow.innerHTML = '';
  evReveal(s.kiCoin.el);
  const side = evFlipSide();
  s.kiCoin.flip(side).then(() => {
    s.kiPhase = 'done';
    if (side === 'heads') {
      const o = s.kiOffers[s.kiPick];
      try { o.apply(); } catch (e) { console.error('[KEEP IT] apply failed', e); }
      s.kiCoin.caption(`HEADS · ${o.label.toUpperCase()} IS YOURS`, 'win');
      evConfirmBtn('DONE', true);
      return;
    }
    s.kiCoin.caption('TAILS', 'lose');
    const price = keepItPrice();
    if (price >= 1) s.kiRow.appendChild(evButton(`FLIP AGAIN · ${price} credits`, () => keepItFlip(true)));
    evConfirmBtn('WALK AWAY', true);
  });
}

// ══════════════════════════════════════════════
// THE LADDER - Hot Streak and Prize Ladder share it
// ══════════════════════════════════════════════
// Up to four flips. Each heads climbs a rung; stop whenever and take every rung
// you hold. A tails loses them all. A tails on the FIRST flip (nothing held)
// can be flipped again for `reflip` credits, as often as you pay, but once a
// heads has landed no flip can be bought back.
function evLadder(cfg) {
  const body = evBodyEl();
  const L = eventState.ladder = { n: 0, busy: false, over: false, reflipOpen: false, lost: false, after: [], cfg };
  body.appendChild(evNote(cfg.note));
  L.ladder = document.createElement('div'); L.ladder.className = 'evt-ladder'; body.appendChild(L.ladder);
  cfg.rungs.forEach((r, i) => {
    const d = document.createElement('div'); d.className = 'evt-rung';
    d.innerHTML = `<b>${i + 1}</b>${r}`;
    L.ladder.appendChild(d);
  });
  L.coin = evCoin(body);
  L.row = evRow(body);
  L.result = document.createElement('div'); body.appendChild(L.result);
  ladderSync();
}
function ladderPrice() { return priceOf(BAL.flip_events.reflip); }
function ladderSync() {
  const L = eventState.ladder; if (!L) return;
  [...L.ladder.children].forEach((d, i) => {
    d.classList.toggle('on', !L.lost && i < L.n);
    d.classList.toggle('lost', L.lost && i < L.lostAt);
    d.classList.toggle('next', !L.over && !L.reflipOpen && i === L.n);
  });
  L.row.innerHTML = '';
  if (L.busy) { evConfirmBtn('FLIP', false); return; }
  if (L.over) { evConfirmBtn(L.after.length ? 'TAKE THEM' : 'DONE', true); return; }
  if (L.reflipOpen) {
    const b = evButton(`FLIP AGAIN · ${ladderPrice()} credits`, () => ladderFlip(true));
    b.disabled = coins < ladderPrice();
    L.row.appendChild(b);
    evConfirmBtn('WALK AWAY', true);
    return;
  }
  if (L.n > 0) L.row.appendChild(evButton(`STOP · TAKE ${L.n === 1 ? 'RUNG 1' : `RUNGS 1-${L.n}`}`, ladderCash, true));
  evConfirmBtn('FLIP', true);
}
function ladderFlip(paid) {
  const L = eventState.ladder;
  if (!L || L.busy || (L.over && !paid)) return;
  if (paid) {
    if (!L.reflipOpen || coins < ladderPrice()) return;
    coins -= ladderPrice(); updateCoinsUI?.();
  }
  L.reflipOpen = false; L.busy = true;
  evSkipShown(false); ladderSync();
  evReveal(L.coin.el);
  const side = evFlipSide();
  L.coin.flip(side).then(() => {
    L.busy = false;
    if (side === 'heads') {
      L.n++;
      L.coin.caption(`HEADS · RUNG ${L.n}`, 'win');
      if (L.n >= L.cfg.rungs.length) { ladderCash(); return; }
    } else if (L.n === 0) {
      L.reflipOpen = true;
      L.coin.caption('TAILS', 'lose');
    } else {
      L.lost = true; L.lostAt = L.n; L.over = true;
      L.coin.caption('TAILS · ALL LOST', 'lose');
      if (typeof sfxRewardBad === 'function') try { sfxRewardBad(); } catch (e) {}
    }
    ladderSync();
  });
}
function ladderCash() {
  const L = eventState.ladder; if (!L || L.over || L.n < 1) return;
  L.over = true;
  const lines = [];
  L.after = L.cfg.cash(L.n, lines) || [];
  if (lines.length) { const n = evNote(lines.join('<br>')); L.result.appendChild(n); evReveal(n); }
  if (typeof sfxRewardGood === 'function') try { sfxRewardGood(); } catch (e) {}
  ladderSync();
}
function confirmLadder() {
  const L = eventState.ladder;
  if (!L) { closeEvent(); return; }
  if (L.busy) return;
  if (L.over) { if (L.after.length) evRunScreens(L.after); else closeEvent(); return; }
  if (L.reflipOpen) { closeEvent(); return; }   // WALK AWAY
  ladderFlip(false);
}

// ── HOT STREAK: each heads adds a pick of three ──
function renderHotStreak() {
  evLadder({
    note: 'Each heads adds a pick of three. Stop any time and keep them. Tails loses them all.',
    rungs: ['1 pick', '2 picks', '3 picks', '4 picks'],
    cash: (n, lines) => { lines.push(`<b>${n}</b> ${n === 1 ? 'pick' : 'picks'} of three, one after another.`); return Array(n).fill('pick3'); },
  });
}

// ── PRIZE LADDER: a different prize on every rung ──
function renderPrizeLadder() {
  const f = BAL.flip_events.ladder_focus;
  evLadder({
    note: 'Each heads adds the next prize. Get two heads and secure the first two rewards. Getting tails loses any unsecured rewards.',
    rungs: [`+${f} Focus limit`, 'A limit, then a pick of three', 'A random improvement', 'All three again'],
    cash: (n, lines) => {
      const twice = n >= 4 ? 2 : 1;
      focusCapPerm += f * twice;
      if (typeof syncFocusMeterState === 'function') try { syncFocusMeterState(); } catch (e) {}
      lines.push(`+${f * twice} Focus limit.`);
      const steps = [];
      if (n >= 2) for (let k = 0; k < twice; k++) steps.push('limits', 'pick3');
      if (n >= 3) for (let k = 0; k < twice; k++) steps.push('improve_random');
      if (n >= 2) lines.push(twice > 1 ? 'Then two limits, two picks of three and two random improvements.'
                                       : n >= 3 ? 'Then a limit, a pick of three and a random improvement.' : 'Then a limit and a pick of three.');
      return steps;
    },
  });
}

// ══════════════════════════════════════════════
// CALL IT - a reward grid you flip for
// ══════════════════════════════════════════════
// The grid is openCallItGrid (js/reward-grid.js); confirming a path calls
// callItAsk, which borrows this panel for the call and the flip.
function renderCallIt() {
  const body = evBodyEl();
  const n = limits.selection.current;
  body.appendChild(evNote(`A reward grid. Take a path of exactly <b>${n}</b> tiles, no skipping. Then call heads or tails: right, and you get every reward on the path. Wrong, and you get every penalty.`));
  evConfirmBtn('OPEN THE GRID', true);
}
function confirmCallIt() {
  evToBoard();
  openCallItGrid(() => closeEvent());
}
// Resolves true when the call is right. Rolled before the coin is shown.
function callItAsk() {
  if (typeof hideRewardTooltip === 'function') hideRewardTooltip();
  return new Promise(res => {
    const ov = document.getElementById('event-overlay');
    document.getElementById('event-name').textContent = 'Call It';
    document.getElementById('event-flavor').textContent = 'Right: every reward on your path. Wrong: every penalty.';
    const body = evBodyEl(); body.innerHTML = '';
    evSkipShown(false);
    const confirm = document.getElementById('event-confirm'); if (confirm) confirm.style.display = 'none';
    const coin = evCoin(body);
    coin.caption('HEADS OR TAILS?');
    const row = evRow(body);
    const call = pick => {
      row.innerHTML = '';
      const side = evFlipSide();
      coin.flip(side).then(() => {
        const won = side === pick;
        coin.caption(`${side.toUpperCase()} · ${won ? 'REWARDS' : 'PENALTIES'}`, won ? 'win' : 'lose');
        setTimeout(() => {
          ov.classList.remove('show');
          if (confirm) confirm.style.display = '';
          res(won);
        }, 1100);
      });
    };
    row.appendChild(evButton('HEADS', () => call('heads')));
    row.appendChild(evButton('TAILS', () => call('tails')));
    ov.classList.add('show');
    const panel = document.getElementById('event-panel'); if (panel) panel.scrollTop = 0;
  });
}

// ══════════════════════════════════════════════
// PLINKO - edit your cards, or three are cursed
// ══════════════════════════════════════════════
// Seven bins, green and red alternating with green on both edges and in the
// middle: on a binomial board that is exactly even odds. Green opens a card
// editor (one of three buffs at the ordinary card-editor strength, on up to
// three cards you choose). Red curses three random cards.
const PLINKO_BINS = [1, 0, 1, 0, 1, 0, 1];
const PLINKO_SAMPLE = 8, PLINKO_CARDS = 3, PLINKO_CURSES = 3;
function renderPlinko() {
  const s = eventState, body = evBodyEl();
  s.plPhase = 'drop';
  s.plBoard = evPlinko(PLINKO_BINS.map(g => ({ label: g ? 'EDIT' : 'CURSE', cls: g ? 'good' : 'bad' })), body);
  evConfirmBtn('DROP', true);
}
function confirmPlinko() {
  const s = eventState;
  if (s.plPhase === 'done') { closeEvent(); return; }
  if (s.plPhase === 'edit') { plinkoApply(); return; }
  if (s.plPhase !== 'drop') return;
  s.plPhase = 'busy';
  evSkipShown(false); evConfirmBtn('DROP', false);
  const bin = evPlinkoRoll(PLINKO_BINS.length);
  s.plBoard.drop(bin).then(() => setTimeout(() => (PLINKO_BINS[bin] ? plinkoEditor() : plinkoCurse()), 350));
}
function plinkoCurse() {
  const s = eventState, body = evBodyEl();
  const hit = [];
  for (let k = 0; k < PLINKO_CURSES; k++) { const c = curseRandomCard(); if (c) hit.push(c); }
  body.appendChild(evLabel('CURSED', true));
  const n = evNote(hit.length
    ? hit.map(h => `<b>${h.rank}${h.suit}</b> · ${CURSE_DEFS[h.curse].name}: ${CURSE_DEFS[h.curse].desc}`).join('<br>')
    : 'Every card is already cursed.');
  body.appendChild(n); evReveal(n);
  if (typeof sfxRewardBad === 'function') try { sfxRewardBad(); } catch (e) {}
  s.plPhase = 'done'; evConfirmBtn('DONE', true);
}
function plinkoEditor() {
  const s = eventState, body = evBodyEl();
  body.innerHTML = '';
  document.getElementById('event-flavor').textContent = 'Card editor: pick a buff, then the cards it goes on.';
  s.plPhase = 'edit'; s.plBuff = null; s.plCards = [];
  s.plBuffs = rollBuffs(3);
  body.appendChild(evLabel('1 · THE BUFF'));
  s.plBuffs.forEach(b => {
    const el = makeChoiceEl({ icon: b.op.icon, name: b.op.name, desc: b.label, cls: 'pl-buff',
      onClick: () => {
        if (s.plPhase !== 'edit') return;
        body.querySelectorAll('.pl-buff').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected'); s.plBuff = b;
        s.plCards = s.plCards.filter(c => !plinkoFull(c));
        plinkoSync();
      } });
    body.appendChild(el);
  });
  body.appendChild(evLabel(`2 · UP TO ${PLINKO_CARDS} CARDS`));
  const pool = allDeckCards().filter(c => !(typeof isWildCard === 'function' && isWildCard(c)));
  const chips = document.createElement('div'); chips.className = 'ev-cardchips'; chips.id = 'pl-chips';
  evShuffle(pool).slice(0, PLINKO_SAMPLE).forEach(card => {
    const chip = document.createElement('span');
    chip.className = 'ev-cardchip' + (['♥', '♦'].includes(card.suit) ? ' red' : '');
    chip.textContent = (typeof cardLabel === 'function') ? cardLabel(card) : `${card.rank}${card.suit}`;
    chip._card = card;
    chip.addEventListener('click', () => {
      if (s.plPhase !== 'edit') return;
      if (plinkoFull(card)) { refuse('Quarter resource limit (QRL) reached'); return; }
      const at = s.plCards.indexOf(card);
      if (at >= 0) s.plCards.splice(at, 1);
      else if (s.plCards.length < PLINKO_CARDS) s.plCards.push(card);
      plinkoSync();
    });
    chips.appendChild(chip);
  });
  body.appendChild(chips);
  evConfirmBtn('APPLY', false);
  if (typeof sfxRewardGood === 'function') try { sfxRewardGood(); } catch (e) {}
}
function plinkoFull(card) {
  const b = eventState.plBuff;
  return !!b && typeof qrlCardFull === 'function' && qrlCardFull(card, qrlPayloadKind(b.e));
}
function plinkoSync() {
  const s = eventState;
  document.querySelectorAll('#pl-chips .ev-cardchip').forEach(ch => {
    ch.classList.toggle('picked', s.plCards.includes(ch._card));
    ch.classList.toggle('qrl-full', plinkoFull(ch._card));
  });
  evConfirmBtn('APPLY', !!s.plBuff && s.plCards.length > 0);
}
function plinkoApply() {
  const s = eventState;
  if (!s.plBuff || !s.plCards.length) return;
  s.plCards.forEach(card => { const t = resolveDeckCard(card); if (t) enhanceCardKey(cardId(t), s.plBuff.e); });
  const names = s.plCards.map(c => `${c.rank}${c.suit}`).join(', ');
  noteMessage(`${s.plBuff.label}: ${names}`, 'var(--gold)');
  s.plPhase = 'done';
  closeEvent();
}
