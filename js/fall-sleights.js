// ══════════════════════════════════════════════
// r841 (owner): DRAGGING, and five Sleights
// ══════════════════════════════════════════════
// DRAGGING is a card condition: the card is never in a level's opening deal. A
// Sleight row with `dragging: true` has it (cardDragging). dragDealSweep() runs
// after every deal (initGridData, startNewRoundDealAnims) and trades each
// Dragging card on the board for the next card in the draw pile.
//
// FALL SLEIGHTS (Bogart, Corporate Ladder): removeAndFall brackets its data write
// with fallSleightSnap() / fallSleightAfter(snap). A fall Sleight that ENTERS reads
// the card below it; one that FALLS acts on the cards beside every row it passed
// (the row it lands in included), then reads again. On the bottom row it leaves:
// fallSleightDrain (from the fall's tail) spends a charge and slides it out.
//
// Franchised (on_play), Identity Crisis (on_swap) and Unionize (a replay source in
// calcScore, a charge a hand) are here too. Numbers are BAL rows, ladders IMPROVE_PLAN.

function cardDragging(card) {
  if (!card) return false;
  if (card._dragging) return true;
  if (!card._isSleight && typeof cardHasState === 'function' && cardHasState(card, 'dragging')) return true;
  const d = card._isSleight && typeof sleightDef === 'function' ? sleightDef(card) : null;
  return !!(d && d.dragging);
}
// After a deal: every Dragging card on the board goes back into the draw pile at a
// random place and the pile's next card that is not Dragging takes its cell.
function dragDealSweep() {
  if (typeof gridData === 'undefined' || !gridData || typeof drawPile === 'undefined') return;
  for (let r = 0; r < gridData.length; r++) for (let c = 0; c < (gridData[r] || []).length; c++) {
    const cd = gridData[r][c];
    if (!cardDragging(cd)) continue;
    const i = drawPile.findIndex(x => x && !cardDragging(x) && !(typeof sleightDormant === 'function' && sleightDormant(x)));
    if (i < 0) continue;
    const next = drawPile.splice(i, 1)[0];
    gridData[r][c] = typeof stampId === 'function' ? stampId(next) : next;
    ['_fsRead', '_bogSuit', '_ladRank', '_dragOut'].forEach(f => { delete cd[f]; });
    drawPile.splice(Math.floor(Math.random() * (drawPile.length + 1)), 0, cd);
  }
  eagerDealSweep();
}

// r854: EAGER (a card state). After a deal, every Eager card still in the draw pile
// changes places with a random ordinary card on the board that is not Eager.
function eagerDealSweep() {
  if (typeof gridData === 'undefined' || !gridData || typeof drawPile === 'undefined' || typeof cardHasState !== 'function') return;
  const eager = cd => !!cd && !!cd.rank && !cd._isSleight && cardHasState(cd, 'eager') && !cardDragging(cd);
  const spots = [];
  for (let r = 0; r < gridData.length; r++) for (let c = 0; c < (gridData[r] || []).length; c++) {
    const cd = gridData[r][c];
    if (_fsOrdinary(cd) && !eager(cd) && !cd._temp) spots.push([r, c]);
  }
  for (let i = drawPile.length - 1; i >= 0 && spots.length; i--) {
    if (!eager(drawPile[i])) continue;
    const [r, c] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    const out = gridData[r][c], inn = drawPile[i];
    gridData[r][c] = typeof stampId === 'function' ? stampId(inn) : inn;
    drawPile[i] = out;
  }
}
// r854: PINNED (a card state). A Pinned card that is played stays in its cell: it is
// taken out of the cells a play removes (removeAndFall, 'play') and shown again.
function pinnedKeep(cells) {
  if (typeof cardHasState !== 'function') return cells;
  const grid = document.getElementById('grid');
  return (cells || []).filter(([r, c]) => {
    const cd = gridData[r]?.[c];
    if (!cd || !cd.rank || cd._isSleight || !cardHasState(cd, 'pinned')) return true;
    const el = grid && grid.querySelector(`[data-card-id="${cd._id}"]`);
    if (el) { el.style.opacity = ''; el.style.pointerEvents = ''; el.style.visibility = ''; }
    return false;
  });
}
// r854: MENTOR (a card state). Each Trick a Mentor card triggered in the banked hand is
// primed once per trigger. Read off the timeline; called after the hand's primes are spent.
function mentorPrime(handCells, ledger) {
  if (!ledger || !ledger.timeline || typeof cardHasState !== 'function') return;
  const got = {};
  ledger.timeline.forEach(e => {
    if (!e || e.source !== 'trick' || !(e.card >= 0) || e.prime || e.forced) return;
    const cl = handCells[e.card], cd = cl && (typeof cellCard === 'function' ? cellCard(cl) : gridData[cl[0]]?.[cl[1]]);
    if (!cd || !cardHasState(cd, 'mentor')) return;
    const t = typeof ownedTrickObj === 'function' ? ownedTrickObj(e.id) : null;
    if (!t) return;
    primeTrick(t, 1, { src: 'mentor' });
    got[t.name] = (got[t.name] || 0) + 1;
  });
  const names = Object.keys(got);
  if (names.length) { noteMessage(`Mentor primed ${names.map(k => got[k] > 1 ? `${k} ×${got[k]}` : k).join(', ')}`, '#b48cff'); if (typeof renderTrickTray === 'function') renderTrickTray(); }
}

// ── Fall Sleights ───────────────────────────────────────────────────────────
const FALL_SLEIGHT_IDS = new Set(['bogart', 'corp_ladder']);
function _fsLive(cd) { return !!cd && cd._isSleight && FALL_SLEIGHT_IDS.has(cd.sleightId) && (cd._usesLeft === 'infinite' || cd._usesLeft > 0); }
function _fsOrdinary(cd) { return !!cd && !!cd.rank && !cd._isSleight && !cd._isStone && !cd._isTrick && !(typeof isWildCard === 'function' && isWildCard(cd)); }
function _fsBottomRow(c) {
  for (let r = gridRows - 1; r >= 0; r--)
    if (!(typeof isCellVoid === 'function' && isCellVoid(r, c)) && !(typeof cardFixedAt === 'function' && cardFixedAt(r, c))) return r;
  return gridRows - 1;
}
function fallSleightSnap() {
  const m = new Map();
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (_fsLive(cd)) m.set(cd._id, [r, c]);
  }
  return m;
}
// What it reads when it lands: the card under it.
function _fsRead(cd, r, c) {
  const below = gridData[r + 1]?.[c];
  cd._fsRead = true;
  cd._bogSuit = (_fsOrdinary(below) && below.suit) ? below.suit : null;
  cd._ladRank = _fsOrdinary(below) ? below.rank : null;
}
function fallSleightAfter(snap) {
  if (!snap) return;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!_fsLive(cd)) continue;
    const p = snap.get(cd._id);
    if (p && p[1] === c && r > p[0] && cd._fsRead) {
      if (cd.sleightId === 'bogart') bogartPass(cd, p[0], r, c);
      else corpLadderPass(cd, p[0], r, c);
    }
    if (!p || r !== p[0] || !cd._fsRead) _fsRead(cd, r, c);
    if (r >= _fsBottomRow(c)) cd._dragOut = true;
  }
}
// Bogart: each card beside a row it passed has `chance` to take the suit it read.
function bogartPass(cd, r0, r1, c) {
  const suit = cd._bogSuit; if (!suit) return;
  const b = BAL.bogart, hit = [];
  // r854 (owner): the rows it LEAVES are passed; the row it lands in is not.
  for (let r = r0; r < r1; r++) [c - 1, c + 1].forEach(cc => {
    const x = gridData[r]?.[cc];
    if (!_fsOrdinary(x) || x.suit === suit) return;
    if (!(typeof luckRoll === 'function' ? luckRoll(b.chance) : Math.random() < b.chance)) return;
    x.suit = suit; if (x.suit2 === suit) delete x.suit2;
    hit.push(x);
  });
  if (!hit.length) return;
  noteMessage(`${sleightDef(cd)?.name || 'Bogart'}: ${hit.length} card${hit.length === 1 ? '' : 's'} now ${suit}`);
  _fsStamp(hit);
}
// Corporate Ladder: the cards beside each row it passed become buffed temp cards, one
// rank a row from the rank it read: upward, or downward when upward would run out.
function corpLadderPass(cd, r0, r1, c) {
  const b = BAL.corp_ladder, ranks = (ACTIVE_RANKS || []).filter(x => !(typeof isWildRank === 'function' && isWildRank(x)));
  const i0 = ranks.indexOf(cd._ladRank); if (i0 < 0) return;
  const n = r1 - r0;
  const dir = (i0 + n - 1 <= ranks.length - 1) ? 1 : (i0 - (n - 1) >= 0 ? -1 : 1);
  const made = [];
  for (let k = 0; k < n; k++) {
    const rank = ranks[i0 + dir * k]; if (!rank) continue;
    const r = r0 + k;   // r854: not the row it lands in
    for (let d = 1; d <= (b.reach || 1); d++) [c - d, c + d].forEach(cc => {
      const old = gridData[r]?.[cc];
      if (!_fsOrdinary(old)) return;
      const nu = makeTempCard(rank, old.suit), id = cardId(nu);
      const y = (kind, v) => (typeof yokeGain === 'function' ? yokeGain(kind, v) : v);
      permPips[id] = y('pips', b.buff); permMult[id] = y('mult', b.buff);
      gridData[r][cc] = nu;
      discardToDrawPile(old);
      made.push(nu);
    });
  }
  if (!made.length) return;
  noteMessage(`${sleightDef(cd)?.name || 'Corporate Ladder'}: ${made.length} card${made.length === 1 ? '' : 's'} replaced`);
  _fsStamp(made);
}
function _fsStamp(cards) {
  if (typeof cardAnimOn !== 'function' || typeof cardAnimEls !== 'function') return;
  setTimeout(() => { try { cardAnimOn('buff', cardAnimEls(cards.map(cardId)), { color: '#e8b0ff' }); } catch (e) {} }, 60);
}
// From the fall's tail: a fall Sleight on the bottom row spends a charge and slides out.
function fallSleightDrain() {
  if (typeof gridData === 'undefined' || !gridData || roundEnded) return;
  const out = [];
  for (let c = 0; c < gridCols; c++) {
    const r = _fsBottomRow(c), cd = gridData[r]?.[c];
    if (cd && cd._isSleight && cd._dragOut && FALL_SLEIGHT_IDS.has(cd.sleightId)) out.push([r, c, cd]);
  }
  if (!out.length) return;
  setTimeout(() => {
    const cells = out.filter(([r, c, cd]) => gridData[r]?.[c] === cd && !roundEnded);
    if (!cells.length) return;
    cells.forEach(([, , cd]) => {
      delete cd._dragOut;
      if (typeof cd._usesLeft === 'number') { cd._usesLeft = Math.max(0, cd._usesLeft - 1); if (typeof sleightChargeSpent === 'function') sleightChargeSpent(cd); }
      discardToPlayed(cd);
    });
    removeAndFall(cells.map(([r, c]) => [r, c]), 'dragout');
  }, 0);
}
// The board card's corner note: what it read.
function fallSleightNote(card) {
  if (!card || !FALL_SLEIGHT_IDS.has(card.sleightId)) return '';
  if (card.sleightId === 'bogart') return card._bogSuit ? `<div class="sleight-rule">${card._bogSuit}</div>` : '';
  return card._ladRank ? `<div class="sleight-rule">${card._ladRank}</div>` : '';
}

// ── Franchised (on_play) ────────────────────────────────────────────────────
// Each other card in the hand has `chance` to become a copy of the first card picked
// (face and buffs). The hand has already scored. v6 (`stacked`): a temp copy of the
// Sleight takes the hole it leaves (Backfill's queue, js/card-states.js); the copy
// makes no copy of its own.
function franchisedFire(card, r, c, cells) {
  const b = BAL.franchised;
  const at = cl => (typeof cellCard === 'function' ? cellCard(cl) : gridData[cl[0]]?.[cl[1]]);
  const cards = (cells || []).map(at).filter(cd => cd && cd.rank && !cd._isSleight && !cd._isStone);
  const src = cards[0];
  let n = 0;
  if (src) cards.slice(1).forEach(cd => {
    if (!(typeof luckRoll === 'function' ? luckRoll(b.chance) : Math.random() < b.chance)) return;
    cd.rank = src.rank; cd.suit = src.suit;
    delete cd.rank2; delete cd.suit2;
    if (typeof copyCardBuffs === 'function') copyCardBuffs(src, cd);
    n++;
  });
  noteMessage(`${sleightDef(card)?.name || 'Franchised'}: ${n ? n + ' card' + (n === 1 ? '' : 's') + ' became ' + src.rank + src.suit : 'no card changed'}`);
  if (typeof entityPing === 'function' && n) entityPing('sleight', 'franchised');
  if (b.stacked && !card._temp && typeof cardStateBackfillQueue !== 'undefined') {
    const left = card._usesLeft === 'infinite' ? 'infinite' : (card._usesLeft || 0) - 1;
    if (left === 'infinite' || left > 0) {
      const copy = stampId({ _isSleight: true, sleightId: card.sleightId, rank: card.rank, suit: card.suit, _usesLeft: left,
                             _faceMark: card._faceMark, _playable: card._playable, _temp: true });
      (cardStateBackfillQueue[c] || (cardStateBackfillQueue[c] = [])).push(copy);
    }
  }
}

// ── Identity Crisis (on_swap) ───────────────────────────────────────────────
// Swapped with a card: `chance` to give it a second rank, a second suit, or both
// (unprinted: 40 / 40 / 20). A charge a swap. v4 (`entity`): the suit is the one your
// oldest Trick, Knack or Sleight names. v6 (`above`): the rank is the next one up.
const SUIT_WORDS = [['♠', /♠|\bspades?\b/i], ['♥', /♥|\bhearts?\b/i], ['♦', /♦|\bdiamonds?\b/i], ['♣', /♣|\bclubs?\b/i]];
function identitySuit() {
  const descs = [];
  (typeof trickTray !== 'undefined' ? trickTray : []).forEach(t => descs.push(t && t.desc));
  (typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []).forEach(k => descs.push(k && k.desc));
  (typeof ownedSleightCards === 'function' ? ownedSleightCards() : []).forEach(s => { const d = sleightDef(s); if (d && d.id !== 'identity_crisis') descs.push(d.desc); });
  for (const d of descs) {
    if (!d) continue;
    const txt = String(d).replace(/<[^>]*>/g, '');
    const hit = SUIT_WORDS.find(([, re]) => re.test(txt));
    if (hit) return hit[0];
  }
  return null;
}
function identityCrisisFire(card, r, c, other) {
  if (!_fsOrdinary(other)) return;
  const b = BAL.identity_crisis;
  if (typeof card._usesLeft === 'number') { card._usesLeft = Math.max(0, card._usesLeft - 1); if (typeof sleightChargeSpent === 'function') sleightChargeSpent(card); }
  const said = [];
  if (typeof luckRoll === 'function' ? luckRoll(b.chance) : Math.random() < b.chance) {
    const x = Math.random(), doRank = x < 0.6, doSuit = x < 0.2 || x >= 0.6;
    if (doSuit) {
      const pool = (typeof ACTIVE_SUITS !== 'undefined' ? ACTIVE_SUITS : ['♠', '♥', '♦', '♣']).filter(s => s !== other.suit);
      const want = b.entity ? identitySuit() : null;
      const s = (want && want !== other.suit) ? want : pool[Math.floor(Math.random() * pool.length)];
      if (s) { other.suit2 = s; said.push(`second suit ${s}`); }
    }
    if (doRank) {
      const rk = (ACTIVE_RANKS || []).filter(q => !(typeof isWildRank === 'function' && isWildRank(q)));
      const i = rk.indexOf(other.rank);
      // r854 (owner): one above its own; the top rank takes the one below.
      const q = i < 0 ? null : (rk[i + 1] || rk[i - 1]);
      if (q) { other.rank2 = q; said.push(`second rank ${q}`); }
    }
  }
  const name = sleightDef(card)?.name || 'Identity Crisis';
  if (said.length) { showMessage(`${name}: ${other.rank}${other.suit} took a ${said.join(' and a ')}`, '#e8b0ff'); _fsStamp([other]); }
  else noteMessage(`${name}: nothing changed`);
  if (typeof render === 'function') render();
  // Spent: it leaves once the swap has settled.
  if (typeof card._usesLeft === 'number' && card._usesLeft <= 0 && !(typeof greenStationKeeps === 'function' && greenStationKeeps())) {
    setTimeout(() => {
      for (let rr = 0; rr < gridRows; rr++) for (let cc = 0; cc < gridCols; cc++)
        if (gridData[rr]?.[cc] === card) { discardToPlayed(card); removeAndFall([[rr, cc]], 'discard'); return; }
    }, (typeof cardSwapMs === 'function' ? cardSwapMs() : 240) + 80);
  }
}

// ── Unionize (passive; id org_chart) ─────────────────────────────────────────────────────
// A card scored in the same row or column as an Unionize replays once for every
// Sleight on the grid, this one included. A hand it replayed in spends a charge.
function _orgOn(r, c) {
  for (let rr = 0; rr < gridRows; rr++) for (let cc = 0; cc < gridCols; cc++) {
    const cd = gridData[rr]?.[cc];
    if (!cd || !cd._isSleight || cd.sleightId !== 'org_chart' || !(cd._usesLeft === 'infinite' || cd._usesLeft > 0)) continue;
    if ((rr === r || cc === c) && !(rr === r && cc === c)) return cd;
  }
  return null;
}
// r854 (owner): Unionize. `plus` (v6) adds one to the count; `extra` (v4) is the chance of
// one more replay, rolled by the caller with `roll` (deterministic inside calcScore).
function orgChartReplays(r, c, roll) {
  if (!_orgOn(r, c)) return 0;
  const b = BAL.org_chart;
  let n = b.plus || 0;
  for (let rr = 0; rr < gridRows; rr++) for (let cc = 0; cc < gridCols; cc++) if (gridData[rr]?.[cc]?._isSleight) n++;
  if (b.extra > 0 && roll && roll() < b.extra) n++;
  return n;
}
function orgChartSpend(cells) {
  const used = new Set();
  (cells || []).forEach(([r, c]) => { const cd = gridData[r]?.[c]; if (!_fsOrdinary(cd) && !(cd && cd.rank && !cd._isSleight)) return; const o = _orgOn(r, c); if (o) used.add(o); });
  used.forEach(o => {
    if (typeof o._usesLeft !== 'number') return;
    o._usesLeft = Math.max(0, o._usesLeft - 1);
    if (typeof sleightChargeSpent === 'function') sleightChargeSpent(o);
    if (o._usesLeft <= 0) noteMessage(`${sleightDef(o)?.name || 'Unionize'} is out of charges`);
  });
}
