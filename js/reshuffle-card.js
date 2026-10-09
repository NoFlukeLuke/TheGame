/* r517 (owner): the Reshuffle card. When the deck runs dry and the board is thin, the game
   deals one card that reads RESHUFFLE? -30s. Double-tap it: Starting Time (the round_time
   limit) loses RESHUFFLE_CAP_CUT, the played cards go back into the deck, the card leaves
   and every hole on the board refills. r527 (owner): the cost is the time cap, not the
   clock, because it is usually needed late in a round: the clock you are playing keeps its
   seconds and every LATER round starts shorter (Flow: the next session).

   - Dealt only by removeAndFall, after every deck card of that fall is placed, into a
     hole the deck could not fill: it never takes a deck card's place. Conditions: the
     draw pile is empty, there are played cards to shuffle back, fewer than
     RESHUFFLE_BOARD_MAX cards are on the board, and none is on the board already.
   - A board object like the challenge card ({ _isStone, _isReshuffle }): it falls and
     renders, nothing else (cardCan). `_temp`, so no sweep can put it in a pile.
   - fillGridHoles drops it once the deck has cards again (a level-up reshuffles). */
const RESHUFFLE_CAP_CUT = 30, RESHUFFLE_BOARD_MAX = 18;

function reshuffleOnBoard() {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++)
    if (gridData[r]?.[c]?._isReshuffle) return [r, c, gridData[r][c]];
  return null;
}

// removeAndFall, once its data is final: deal the card into the lowest hole of the column
// with the most holes (it rests on that column's cards). Returns a newCards entry or null.
function reshuffleMaybeDeal() {
  if (drawPile.length || !playedPile.some(c => c && !c._temp) || reshuffleOnBoard()) return null;
  if ((typeof roundEnded !== 'undefined' && roundEnded) || (typeof match3Active === 'function' && match3Active())) return null;
  let cards = 0, best = null;
  for (let c = 0; c < gridCols; c++) {
    let holes = 0, low = -1;
    for (let r = 0; r < gridRows; r++) {
      if (isCellVoid(r, c)) continue;
      if (gridData[r][c]) cards++;
      else if (!isCellBlocked(r, c)) { holes++; low = r; }
    }
    if (low >= 0 && (!best || holes > best.holes)) best = { c, r: low, holes };
  }
  if (!best || cards >= RESHUFFLE_BOARD_MAX) return null;
  const card = { rank: '?', suit: 'stone', _isStone: true, _isReshuffle: true, _temp: true, _id: `rs-${Date.now()}` };
  gridData[best.r][best.c] = card;
  dbgEvent?.('info', `reshuffle card dealt [${best.r},${best.c}], ${cards} cards on the board`);
  return { col: best.c, finalRow: best.r, fromAbove: 1, card };
}

// fillGridHoles: a deck with cards in it has no use for the card.
function reshuffleClearIfStocked() {
  if (!drawPile.length) return;
  const h = reshuffleOnBoard(); if (h) gridData[h[0]][h[1]] = null;
}

function reshuffleFaceHTML() {
  return `<div class="rs-glyph">🔀</div><div class="rs-name">RESHUFFLE?</div><div class="rs-cost">−${RESHUFFLE_CAP_CUT}s</div>`;
}

// onCardTap: one tap says what it does, a double tap does it.
function reshuffleTap(r, c) {
  const now = Date.now();
  const dbl = lastTapCell && lastTapCell[0] === r && lastTapCell[1] === c && (now - lastTapTime) < DOUBLE_TAP_MS;
  if (!dbl) { lastTapTime = now; lastTapCell = [r, c]; return; }
  lastTapTime = 0; lastTapCell = null;
  if (animating || falling || roundEnded) return;
  const lt = limits.round_time, cut = Math.min(RESHUFFLE_CAP_CUT, lt.current - (lt.min || 0));
  if (cut <= 0) { refuse('Starting Time is at its lowest'); return; }
  lt.current -= cut;   // no clamp of the live clock: this is a later round's starting time (js/limits.js)
  updateClockUI();
  const n = playedPile.length;
  flushPlayedDeck();
  showMessage(`Reshuffled ${n} cards · Starting Time −${cut}s`, 'var(--c-mint)');
  selected = []; swapPending = null;
  removeAndFall([[r, c]], 'discard');   // the card leaves; every hole refills from the new deck
}
