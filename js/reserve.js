// ══════════════════════════════════════════════════════════════════════════
// THE RESERVE (r569, owner) - double-tap the Focus bar to buy placeable cards
// ══════════════════════════════════════════════════════════════════════════
// Double-tap the Focus bar: BAL.reserve.open (10) Focus buys BAL.reserve.cards (3)
// fresh TEMP cards, held in the Dealer's Choice stack (js/dealers-choice.js:
// the top card hangs from the cursor on a mouse, docks in the preview tray on
// touch). Tap a board card: the top held card takes its cell and the old card
// goes to the back of the draw pile, as a discard would, but it is NOT a
// discard or a swap to anything: no time, no stock, no hook, no count. DISCARD
// throws the top held card away for free. A temp card leaves the run when it is
// played or discarded (js/card-states.js). Each card has BAL.reserve.buff_chance
// (75%) of one buff from the deck editor's own buff rows (FLOWR_DECK_OPS), at
// the editor's odds and values. While cards are still held, a double-tap buys
// ONE more for BAL.reserve.more (5) Focus. Under the cost it refuses.
//
// THE FOCUS BAR'S DOUBLE-TAP IS ONE GESTURE. The Reserve is its default; a Focus
// knack (FOCUS_TAP_KNACKS, js/focus-knacks.js) replaces it while owned.
const RESERVE_DEFAULTS = { open: 10, more: 5, cards: 3, buff_chance: 0.75 };
const reserveCfg = k => (typeof BAL !== 'undefined' && BAL.reserve && BAL.reserve[k] != null) ? BAL.reserve[k] : RESERVE_DEFAULTS[k];
const FOCUS_TAP_MS = 350;
let _focusTapAt = 0;

function reserveActive() { return typeof dealerActive === 'function' && dealerActive() && dealerHand.mode === 'reserve'; }

// One buff off the deck editor's own buff rows, at the editor's odds and values.
// Shared with the Charged Card knack (js/focus-knacks.js).
function rollEditorBuff() {
  const ops = (typeof FLOWR_DECK_OPS !== 'undefined') ? FLOWR_DECK_OPS.filter(o => o.buff) : [];
  if (!ops.length) return null;
  const op = (typeof flowrDrawOps === 'function') ? flowrDrawOps(1, ops)[0] : ops[Math.floor(Math.random() * ops.length)];
  if (!op) return null;
  const v = (typeof flowrValRoll === 'function') ? flowrValRoll(op.buff.range) : op.buff.range[0];
  return { [op.buff.key]: v };
}
// Fresh random cards; most carry one deck-editor buff.
function reserveRollCards(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const card = makeTempCard(ACTIVE_RANKS[Math.floor(Math.random() * ACTIVE_RANKS.length)],
                              ACTIVE_SUITS[Math.floor(Math.random() * ACTIVE_SUITS.length)]);
    if (Math.random() < reserveCfg('buff_chance')) {
      const e = rollEditorBuff();
      if (e) { card._dealerBuff = e; enhanceCardKey(cardId(card), e); }
    }
    out.push(card);
  }
  return out;
}

function reserveMayOpen() {
  if (typeof roundEnded !== 'undefined' && roundEnded) return false;
  if (typeof gameStartTime === 'undefined' || !gameStartTime) return false;
  const b = document.body.classList;
  if (b.contains('grid-screen') || b.contains('pick-active') || b.contains('map-active') || b.contains('flowr-deck')) return false;
  if (typeof isPaused !== 'undefined' && isPaused) return false;
  if (typeof dealPhase !== 'undefined' && dealPhase) return false;
  return true;
}

function reserveOpen() {
  if (!reserveMayOpen()) return;
  if (typeof dealerActive === 'function' && dealerActive() && dealerHand.mode !== 'reserve') { refuse('You are already holding cards'); return; }
  const more = reserveActive();
  const cost = more ? reserveCfg('more') : reserveCfg('open');
  if (focusNodes < cost) { refuse(`Reserve needs ${cost} Focus`); return; }
  removeFocus(cost);
  const cards = reserveRollCards(more ? 1 : reserveCfg('cards'));
  const src = document.getElementById('focus-bar-outer')?.getBoundingClientRect();
  const sx = src ? src.left + src.width / 2 : innerWidth / 2, sy = src ? src.top + src.height / 2 : innerHeight / 2;
  if (more) {
    cards.forEach(c => { dealerHand.cards.push(c); dealerHand.pos.push({ x: sx, y: sy, vx: 0, vy: 0, rot: 0 }); });
    dealerBuildLayer();
    noteMessage(`Reserve: +1 card for ${cost} Focus`);
  } else {
    selected = []; swapPending = null;
    if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
    dealerHand = { mode: 'reserve', cards, els: [], pos: cards.map(() => ({ x: sx, y: sy, vx: 0, vy: 0, rot: 0 })), still: 0, t0: performance.now() };
    dealerBuildLayer();
    if (!reserveOpen._told) { reserveOpen._told = true; showMessage('Reserve: tap a card to swap one in, or DISCARD it. Double-tap the Focus bar for one more', '#8fd0ff'); }
    dealerStartLoop();
  }
  try { sfxFlipShuffle(); } catch (e) {}
  if (typeof dbgEvent === 'function') dbgEvent('info', `reserve ${more ? '+1' : 'open'} (-${cost} Focus)`);
}

// ── The Focus bar's double-tap ──────────────────────────────────────────────
// A Focus knack that names a handler takes the gesture; otherwise the Reserve.
function focusTapHandler() {
  if (typeof FOCUS_TAP_KNACKS !== 'undefined' && Array.isArray(acquiredKnacks)) {
    for (let i = acquiredKnacks.length - 1; i >= 0; i--) {
      const id = acquiredKnacks[i] && acquiredKnacks[i].id;
      if (id && FOCUS_TAP_KNACKS[id]) return FOCUS_TAP_KNACKS[id];
    }
  }
  return reserveOpen;
}
// Hit-tested by rectangle at document level: the bar sits under #grid-slot's box in
// some layouts (the slot is a later sibling), so a listener on the bar itself can
// be shadowed. A tap on a card or a button is never a bar tap.
function focusBarTap(e) {
  if (e && e.target && e.target.closest && e.target.closest('button, .card, .trick-card, #dev-panel')) return;
  const wrap = document.getElementById('focus-meter-wrap');
  if (!wrap || !e) return;
  const r = wrap.getBoundingClientRect();
  if (!(r.width && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)) return;
  const now = performance.now();
  if (now - _focusTapAt < FOCUS_TAP_MS) { _focusTapAt = 0; try { focusTapHandler()(); } catch (err) { if (typeof devMode !== 'undefined' && devMode) console.warn('[FOCUS TAP]', err); } }
  else _focusTapAt = now;
}
document.addEventListener('pointerup', focusBarTap, true);
