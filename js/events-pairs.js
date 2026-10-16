// ── EVENT: PAIRS (r573) ──────────────────────────────────────────────────────
//
// Sixteen cards face down in a 4x4. Eight pairs:
//   4 RANK pairs: two cards of one rank, random suits, two buffs each (rows and
//     values from the deck editor's buff table). A match is the RANK: suit and
//     buffs may differ. Both cards join the deck with their buffs.
//   2 OP pairs: a rarer deck op (Stamp, x mult, x pips, Replay, Second Suit,
//     Second Rank), applied to random deck cards on a match.
//   2 PENALTY pairs, A and B, which match only like with like: A puts a curse
//     on a random deck card (a board card if the deck is empty); B puts two
//     stones into the draw pile (they leave at the next boss).
//
// Two forms (owner): 30% FREE - keep flipping until a penalty pair matches, or
// leave between pairs. 70% THREE TRIES - three pairs of flips, leave after any
// completed pair. Never mid-pair. A pair that does not match flips back.
// Having turned a penalty card first, the second flip must be a card not yet
// seen, or a known card of the same penalty: a known safe card is refused.

const PAIRS_FREE_CHANCE = 0.30;
const PAIRS_TRIES = 3;
const PAIRS_FLIP_MS = 420;
const PAIRS_BACK_MS = 900;
const PAIRS_RARE_OPS = ['copy', 'xmult', 'xpips', 'replay', 'suit2', 'rank2'];

function _pairsRankCard(rank) {
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : ['♠', '♥', '♦', '♣'];
  const suit = suits[Math.floor(Math.random() * suits.length)];
  const rows = FLOWR_DECK_OPS.filter(o => o.buff);
  const ops = (typeof flowrDrawOps === 'function') ? flowrDrawOps(2, rows) : rows.slice(0, 2);
  const buffs = ops.map(op => ({ op, v: flowrValRoll(op.buff.range) }));
  return { rank, suit, buffs };
}

function _pairsBuild() {
  const ranks = ((typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS.length) ? ACTIVE_RANKS : ['2','3','4','5','6','7','8','9','10','J','Q','K','A']).slice();
  for (let i = ranks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ranks[i], ranks[j]] = [ranks[j], ranks[i]]; }
  const ops = (typeof flowrDrawOps === 'function')
    ? flowrDrawOps(2, FLOWR_DECK_OPS.filter(o => PAIRS_RARE_OPS.includes(o.id)))
    : FLOWR_DECK_OPS.filter(o => PAIRS_RARE_OPS.includes(o.id)).slice(0, 2);
  const curseIds = Object.keys(CURSE_DEFS);
  const curse = curseIds[Math.floor(Math.random() * curseIds.length)];
  const tiles = [];
  ranks.slice(0, 4).forEach(rank => { for (let k = 0; k < 2; k++) tiles.push({ kind: 'rank', key: 'rank:' + rank, card: _pairsRankCard(rank) }); });
  ops.forEach(op => { for (let k = 0; k < 2; k++) tiles.push({ kind: 'op', key: 'op:' + op.id, op }); });
  for (let k = 0; k < 2; k++) tiles.push({ kind: 'pen', key: 'pen:A', pen: 'A', curse });
  for (let k = 0; k < 2; k++) tiles.push({ kind: 'pen', key: 'pen:B', pen: 'B' });
  for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
  tiles.forEach((t, i) => { t.i = i; t.seen = false; t.up = false; t.done = false; });
  return tiles;
}

function _pairsBuffText(b) {
  return (typeof flowrBuffLabel === 'function') ? flowrBuffLabel(b.op.buff, b.v) : `${b.op.icon} ${b.v}`;
}

function _pairsFaceHTML(t) {
  if (t.kind === 'rank') {
    const red = ['♥', '♦'].includes(t.card.suit);
    return `<div class="mt-rank${red ? ' red' : ''}">${t.card.rank}<span class="mt-suit">${t.card.suit}</span></div>` +
      `<div class="mt-buffs">${t.card.buffs.map(b => `<div>${_pairsBuffText(b)}</div>`).join('')}</div>`;
  }
  if (t.kind === 'op') return `<div class="mt-ico">${t.op.icon}</div><div class="mt-name">${t.op.name}</div>`;
  if (t.pen === 'A') { const d = CURSE_DEFS[t.curse]; return `<div class="mt-ico">${d.icon}</div><div class="mt-name">${d.name}</div><div class="mt-pen">A</div>`; }
  return `<div class="mt-ico">🪨</div><div class="mt-name">Stones</div><div class="mt-pen">B</div>`;
}

function _pairsPayText(t) {
  if (t.kind === 'rank') return `${t.card.rank}${t.card.suit} and its match join the deck, buffs and all`;
  if (t.kind === 'op') return `${t.op.name} lands on your deck`;
  if (t.pen === 'A') return `${CURSE_DEFS[t.curse].name} on one of your cards`;
  return 'Two stones in your deck until the next boss';
}

function renderPairs() {
  const s = eventState;
  s.free = Math.random() < PAIRS_FREE_CHANCE;   // rolled first: one roll, before the build's own
  s.tiles = _pairsBuild();
  s.tries = s.free ? Infinity : PAIRS_TRIES;
  s.open = null;      // the one tile face up mid-pair
  s.busy = false;
  s.over = false;
  const body = document.getElementById('event-body');
  body.appendChild(evLabel(s.free ? 'MATCH PAIRS UNTIL A PENALTY PAIR TURNS UP' : `MATCH PAIRS · ${PAIRS_TRIES} TRIES`));
  const grid = document.createElement('div'); grid.className = 'mt-grid'; grid.id = 'mt-grid';
  s.tiles.forEach(t => {
    const el = document.createElement('div'); el.className = 'mt-tile'; el.dataset.i = t.i;
    el.innerHTML = `<div class="mt-inner"><div class="mt-face mt-front"><span>?</span></div><div class="mt-face mt-back mt-${t.kind}${t.kind === 'pen' ? ' mt-pen-' + t.pen : ''}">${_pairsFaceHTML(t)}</div></div>`;
    el.addEventListener('click', () => _pairsFlip(t.i));
    grid.appendChild(el);
  });
  body.appendChild(grid);
  const note = evNote('Rank pairs match on the rank alone. <b>A</b> matches A and <b>B</b> matches B: a curse, or stones.'); note.id = 'mt-note'; body.appendChild(note);
  const confirm = document.getElementById('event-confirm'); if (confirm) confirm.style.display = 'none';
  _pairsSync();
  _pairsFit();
  requestAnimationFrame(_pairsFit);
}

// Tiles sized to the room the panel has: four rows must show without a scroll,
// under the title and over the sticky buttons, at every menu zoom.
function _pairsFit() {
  const panel = document.getElementById('event-panel'), grid = document.getElementById('mt-grid'),
        actions = document.getElementById('event-actions'), note = document.getElementById('mt-note');
  if (!panel || !grid) return;
  const gap = 5;
  // offsetTop chains: #event-body is positioned, so the grid's own offsetTop is from the body.
  let top = 0; for (let el = grid; el && el !== panel; el = el.offsetParent) top += el.offsetTop;
  const avail = panel.clientHeight - top - (actions ? actions.offsetHeight : 0) - (note ? note.offsetHeight + 9 : 0) - 12;
  const h = Math.max(40, Math.min(86, Math.floor((avail - 3 * gap) / 4)));
  grid.style.setProperty('--mt-h', h + 'px');
  grid.style.setProperty('--mt-w', Math.round(h * 0.74) + 'px');
  grid.style.setProperty('--mt-k', (h / 86).toFixed(3));
}

function _pairsNote(html) { const n = document.getElementById('mt-note'); if (n) n.innerHTML = html; }

function _pairsSync() {
  const s = eventState, skip = document.getElementById('event-skip');
  if (!skip) return;
  const left = s.free ? '' : ` · ${s.tries} ${s.tries === 1 ? 'try' : 'tries'} left`;
  skip.textContent = (s.over ? 'Done' : 'Leave') + (s.over ? '' : left);
  skip.disabled = !!s.open || s.busy;
}

function _pairsEl(i) { return document.querySelector(`#mt-grid .mt-tile[data-i="${i}"]`); }
function _pairsShake(i) {
  const el = _pairsEl(i); if (!el) return;
  el.classList.remove('mt-shake'); void el.offsetWidth; el.classList.add('mt-shake');
  if (typeof refuse === 'function') refuse('That card is known safe: flip a new one, or its match', { color: 'var(--cream-dim)' });
}

function _pairsFlip(i) {
  const s = eventState, t = s.tiles[i];
  if (!t || s.busy || s.over || t.up || t.done) return;
  if (s.tries <= 0) return;
  // Second flip after a penalty: unseen, or a seen card of the same penalty.
  if (s.open && s.open.kind === 'pen' && t.seen && t.key !== s.open.key) { _pairsShake(i); return; }
  t.up = true; t.seen = true;
  const el = _pairsEl(i); if (el) el.classList.add('mt-up');
  if (typeof sfxCardSelect === 'function') try { sfxCardSelect(); } catch (e) {}
  if (!s.open) { s.open = t; _pairsSync(); return; }
  // Second card: resolve after the flip.
  const a = s.open; s.open = null; s.busy = true; _pairsSync();
  if (!s.free) s.tries--;
  setTimeout(() => {
    if (a.key === t.key) _pairsMatch(a, t);
    else {
      [a, t].forEach(x => { x.up = false; const e = _pairsEl(x.i); if (e) e.classList.remove('mt-up'); });
      if (typeof sfxFlipShuffle === 'function') try { sfxFlipShuffle(); } catch (e) {}
      _pairsNote('No match.');
      _pairsAfterPair();
    }
  }, PAIRS_FLIP_MS + PAIRS_BACK_MS);
}

function _pairsAfterPair() {
  const s = eventState;
  s.busy = false;
  if (!s.free && s.tries <= 0) { s.over = true; _pairsNote((document.getElementById('mt-note').innerHTML || '') + ' No tries left.'); }
  if (s.tiles.every(t => t.done)) s.over = true;
  _pairsSync();
}

function _pairsMatch(a, t) {
  const s = eventState;
  [a, t].forEach(x => { x.done = true; const e = _pairsEl(x.i); if (e) e.classList.add('mt-done', x.kind === 'pen' ? 'mt-bad' : 'mt-good'); });
  _pairsPay(a, t);
  if (a.kind === 'pen') {
    if (typeof sfxChallengeExpire === 'function') try { sfxChallengeExpire(); } catch (e) {}
    _pairsNote(`<span class="mt-loss">${_pairsPayText(a)}.</span>`);
    if (s.free) { s.over = true; s.busy = false; _pairsSync(); return; }
  } else {
    if (typeof sfxHandScored === 'function') try { sfxHandScored(60); } catch (e) {}
    _pairsNote(`<span class="mt-win">${_pairsPayText(a)}.</span>`);
  }
  _pairsAfterPair();
}

// What a matched pair does. Deck cards for the ops and the curse: the piles
// first, the board only when the piles are empty (owner).
function _pairsDeckCards() {
  const piles = [...drawPile, ...playedPile].filter(c => c && c.rank && !c._isSleight && !c._isStone && !(typeof isWildCard === 'function' && isWildCard(c)));
  if (piles.length) return piles;
  const grid = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) { const cd = gridData[r]?.[c]; if (cd && cd.rank && !cd._isSleight && !cd._isStone) grid.push(cd); }
  return grid;
}
function _pairsPickCards(n, filter) {
  const pool = _pairsDeckCards().filter(filter || (() => true));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

function _pairsPay(a, t) {
  if (a.kind === 'rank') {
    [a, t].forEach(x => {
      const made = copyCardToDeck({ rank: x.card.rank, suit: x.card.suit });
      if (!made) return;
      const e = {}; x.card.buffs.forEach(b => { e[b.op.buff.key] = b.v; });
      enhanceCardKey(cardId(made), e);
    });
    noteMessage(`Pairs: ${a.card.rank}${a.card.suit} and ${t.card.rank}${t.card.suit} join the deck`, 'var(--gold)');
    return;
  }
  if (a.kind === 'op') {
    const op = a.op;
    if (op.id === 'copy') {
      const src = _pairsPickCards(1)[0];
      if (src) { for (let k = 0; k < 2; k++) copyCardToDeck(src); noteMessage(`Pairs: two more ${src.rank}${src.suit} in the deck`, 'var(--gold)'); }
    } else if (op.dual) {
      const picks = _pairsPickCards(2);
      picks.forEach(cd => {
        if (op.dual === 'suit') {
          const suits = ((typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS) || ['♠', '♥', '♦', '♣']).filter(x => x !== cd.suit);
          if (suits.length) cd.suit2 = suits[Math.floor(Math.random() * suits.length)];
        } else {
          const rk = (typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS) || [];
          const i = rk.indexOf(cd.rank);
          const opts = [rk[i - 1], rk[i + 1]].filter(Boolean);
          if (opts.length) cd.rank2 = opts[Math.floor(Math.random() * opts.length)];
        }
      });
      if (typeof clearHandCompCache === 'function') clearHandCompCache();
      noteMessage(`Pairs: ${op.name} on ${picks.length} card${picks.length === 1 ? '' : 's'}`, '#e8b0ff');
    } else if (op.buff) {
      const v = flowrValRoll(op.buff.range);
      const picks = _pairsPickCards(2);
      picks.forEach(cd => enhanceCardKey(cardId(cd), { [op.buff.key]: v }));
      noteMessage(`Pairs: ${flowrBuffLabel(op.buff, v)} on ${picks.length} card${picks.length === 1 ? '' : 's'}`, 'var(--gold)');
    }
    return;
  }
  if (a.pen === 'A') {
    const cd = _pairsPickCards(1, c => !cardCurses[cardId(c)])[0];
    if (cd) { cardCurses[cardId(cd)] = { id: a.curse, left: CURSE_DEFS[a.curse].liftAfter }; noteMessage(`Pairs: ${CURSE_DEFS[a.curse].name} on ${cd.rank}${cd.suit}`, 'var(--red)'); }
    return;
  }
  if (typeof injectStonesIntoDeck === 'function') { injectStonesIntoDeck(2); noteMessage('Pairs: two stones in the deck', 'var(--red)'); }
}

function confirmPairs() { closeEvent(); }
