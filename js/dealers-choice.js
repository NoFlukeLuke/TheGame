// ══════════════════════════════════════════════
// DEALER'S CHOICE (r409) - a Sleight that deals you a hand to place
// ══════════════════════════════════════════════
// Double-tap it and three small cards appear, held as a stack:
//   - each takes a RANK from the ranks on the board right now and a random suit
//   - each has a 75% chance (BAL.dealers_choice.buff_chance) to carry a buff
//   - TAP a board card (or a Sleight): it is discarded and the top held card
//     takes its cell. No swap stock; it costs a swap's time and counts as a swap
//     for everything that reads swaps.
//   - DISCARD throws the top held card away. No discard stock; it costs one
//     card's discard time.
// The stack closes when all three are used or the round ends.
//
// THE HELD CARDS ARE TEMP CARDS (r278, js/card-states.js): they are real cards
// on the board but they never enter a pile, so they last this level only and
// the deck audit is untouched. makeCardPermanent() is the seam if that changes.
//
// The stack is a BODY-LEVEL layer in raw viewport px, for the usual reason:
// anything inside #cabinet inherits its CSS zoom. On a mouse it trails the
// cursor like a ribbon and settles into a gentle drift when the cursor stops; on
// touch it docks under the board and only follows a finger while it drags.

let dealerHand = null;   // { cards: [card...], els: [...], pos: [{x,y,vx,vy,rot}...] }
const DEALER_DEFAULTS = { cards: 3, buff_chance: 0.75 };
const DEALER_BUFFS = [   // [enhancement, weight]
  [{ pips: 12 }, 30], [{ mult: 5 }, 30], [{ retrig: 1 }, 12],
  [{ xmult: 1.5 }, 10], [{ coin: 2 }, 10], [{ time: 3 }, 8],
];
const dealerCfg = k => (typeof BAL !== 'undefined' && BAL.dealers_choice && BAL.dealers_choice[k] != null) ? BAL.dealers_choice[k] : DEALER_DEFAULTS[k];

function dealerActive() { return !!(dealerHand && dealerHand.cards.length); }

// Desktop = a real mouse. Touch docks the stack instead of following.
function dealerFollowsCursor() {
  try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return true; }
}

function dealerRollBuff() {
  const total = DEALER_BUFFS.reduce((a, b) => a + b[1], 0);
  let roll = Math.random() * total;
  for (const [e, w] of DEALER_BUFFS) { if ((roll -= w) < 0) return e; }
  return DEALER_BUFFS[0][0];
}

function dealerRollCards() {
  const ranks = new Set();
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd.rank || cd._isSleight || cd._isStone || cd._isTrick) continue;
    if (typeof isWildCard === 'function' && isWildCard(cd)) continue;
    if (ACTIVE_RANKS.includes(cd.rank)) ranks.add(cd.rank);
  }
  const pool = ranks.size ? [...ranks] : [...ACTIVE_RANKS];
  const out = [];
  for (let i = 0; i < dealerCfg('cards'); i++) {
    const card = makeTempCard(pool[Math.floor(Math.random() * pool.length)],
                              ACTIVE_SUITS[Math.floor(Math.random() * ACTIVE_SUITS.length)]);
    if (Math.random() < dealerCfg('buff_chance')) {
      card._dealerBuff = dealerRollBuff();
      enhanceCardKey(cardId(card), card._dealerBuff);
    }
    out.push(card);
  }
  return out;
}

// ── open / close ─────────────────────────────────
function dealerOpen(jcard, r, c) {
  if (dealerActive()) { refuse('You are already holding cards'); return; }
  selected = []; swapPending = null;
  if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  const cards = dealerRollCards();
  // Seed the stack where the Sleight sits, so it visibly comes out of the card.
  const src = document.querySelector(`#grid [data-card-id="${jcard._id}"]`)?.getBoundingClientRect();
  const sx = src ? src.left + src.width / 2 : innerWidth / 2, sy = src ? src.top + src.height / 2 : innerHeight / 2;
  dealerHand = { cards, els: [], pos: cards.map(() => ({ x: sx, y: sy, vx: 0, vy: 0, rot: 0 })), still: 0, t0: performance.now() };
  dealerBuildLayer();
  try { sfxFlipShuffle(); } catch (e) {}
  showMessage(`🃏 Dealer's Choice - tap a card to swap one in, or DISCARD it`, '#8fd0ff');
  discardSleightAfterUse(jcard, r, c);
  dealerStartLoop();
}

function dealerClose(repaint) {
  dealerHand = null;
  const layer = document.getElementById('dealer-layer');
  if (layer) layer.remove();
  if (_dealerRaf) { cancelAnimationFrame(_dealerRaf); _dealerRaf = 0; }
  document.body.classList.remove('dealer-holding');
  if (repaint && typeof render === 'function' && gridData?.[0] && !animating && !falling) { try { render(); } catch (e) {} }
}

// ── the layer ────────────────────────────────────
function dealerCardSize() {
  const g = document.querySelector('#grid .card');
  const rc = g?.getBoundingClientRect();
  const w = rc && rc.width ? rc.width : 60, h = rc && rc.height ? rc.height : 80;
  let k = dealerFollowsCursor() ? 0.55 : 0.6;
  if (!dealerFollowsCursor()) {
    const box = dealerDockBox();
    // The stack (current card at 1.2x plus two steps down) fits the tray's height.
    if (box && box.height) k = Math.min(k, (box.height - 10) / (h * (1.2 + DL_STEP_Y * 2)));
  }
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

function dealerBuildLayer() {
  let layer = document.getElementById('dealer-layer');
  if (!layer) { layer = document.createElement('div'); layer.id = 'dealer-layer'; document.body.appendChild(layer); }
  layer.innerHTML = '';
  if (!dealerHand) return;
  const { w, h } = dealerCardSize();
  layer.style.setProperty('--card-w', w + 'px');
  layer.style.setProperty('--card-h', h + 'px');
  layer.classList.toggle('dl-touch', !dealerFollowsCursor());
  dealerHand.size = { w, h };
  // Drawn back to front so DOM order is paint order: the current card on top.
  dealerHand.els = [];
  for (let i = dealerHand.cards.length - 1; i >= 0; i--) {
    const card = dealerHand.cards[i];
    const wrap = document.createElement('div');
    wrap.className = 'dl-card' + (i === 0 ? ' dl-cur' : '');
    const { className, innerHTML } = renderCardAppearance(card, -1, -1, { revealFog: true });
    wrap.innerHTML = `<div class="${className}">${innerHTML}</div>`;
    layer.appendChild(wrap);
    dealerHand.els[i] = wrap;
  }
  const cap = document.createElement('div');
  cap.className = 'dl-cap';
  const cur = dealerHand.cards[0];
  cap.textContent = `${cur.rank}${typeof cardColorSuit === 'function' ? cardColorSuit(cur) : cur.suit}`
    + (cur._dealerBuff ? ' · ' + buffOfferName(cur._dealerBuff) : '') + `  (${dealerHand.cards.length} left)`;
  layer.appendChild(cap);
  dealerHand.cap = cap;
  document.body.classList.add('dealer-holding');
}

// ── where the stack wants to be ──────────────────
const DL_STEP_X = 0.7, DL_STEP_Y = 0.28;
let _dealerMouse = { x: innerWidth / 2, y: innerHeight / 2 };
let _dealerTouch = null;   // {x,y} while a finger is dragging
document.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') _dealerMouse = { x: e.clientX, y: e.clientY };
  else if (dealerActive() && e.buttons) _dealerTouch = { x: e.clientX, y: e.clientY };
}, { passive: true });
const _dealerLift = e => { if (e.pointerType !== 'mouse') _dealerTouch = null; };
document.addEventListener('pointerup', _dealerLift, { passive: true });
document.addEventListener('pointercancel', _dealerLift, { passive: true });

// Card i's anchor (its top-left) when the stack is held at point (ax, ay).
// Each card sits below and to the left of the one in front of it, overlapping
// only enough to keep its own corner index visible.
function dealerSlot(i, ax, ay, w, h, curScale) {
  const dx = -w * DL_STEP_X, dy = h * DL_STEP_Y;
  const cw = w * curScale;
  // The current card's top-left is the anchor; the others step from its foot.
  if (i === 0) return { x: ax, y: ay };
  return { x: ax + (cw - w) + dx * i, y: ay + (h * curScale - h) + dy * i };
}

function dealerTarget() {
  const { w, h } = dealerHand.size;
  const follow = dealerFollowsCursor();
  if (follow) return { x: _dealerMouse.x + 16, y: _dealerMouse.y + 18, mode: 'cursor' };
  if (_dealerTouch) return { x: _dealerTouch.x - w * 0.6, y: _dealerTouch.y - h * 1.2 - 34, mode: 'finger' };
  // Docked (touch): in the hand preview's tray, which is empty while cards are
  // held - the right half of the portrait strip, or #selected-cards in
  // landscape. Failing both, just under the board so its bottom row stays clear.
  const n = dealerHand.cards.length - 1;
  const stackW = w * 1.2 + w * DL_STEP_X * n, stackH = h * 1.2 + h * DL_STEP_Y * n;
  const box = dealerDockBox();
  if (box) return { x: box.left + box.width / 2 - stackW / 2 + w * DL_STEP_X * n,
                    y: box.top + Math.max(4, box.height / 2 - stackH / 2), mode: 'dock' };
  const g = document.getElementById('grid')?.getBoundingClientRect();
  if (!g) return { x: innerWidth / 2, y: innerHeight - stackH - 8, mode: 'dock' };
  return { x: g.left + g.width / 2 - stackW / 2 + w * DL_STEP_X * n,
           y: Math.min(g.bottom + 4, innerHeight - stackH - 6), mode: 'dock' };
}
function dealerDockBox() {
  const stage = document.getElementById('stage');
  if (stage && !stage.classList.contains('landscape')) {
    const tp = document.getElementById('trick-panel')?.getBoundingClientRect();
    if (tp && tp.width) return { left: tp.left + tp.width / 2, top: tp.top, width: tp.width / 2, height: tp.height };
  }
  const sc = document.getElementById('selected-cards')?.getBoundingClientRect();
  return sc && sc.width && sc.height ? sc : null;
}

// ── the loop: a ribbon of springs ────────────────
let _dealerRaf = 0, _dealerLast = 0;
function dealerStartLoop() {
  if (_dealerRaf) return;
  _dealerLast = performance.now();
  const step = now => {
    _dealerRaf = 0;
    if (!dealerHand) return;
    // The round is over (or the run is): the held cards were this level's only.
    if (roundEnded || !gameStartTime) { dealerClose(); return; }
    const dt = Math.min(0.05, (now - _dealerLast) / 1000); _dealerLast = now;
    if (dealerHand.pendingAt && !animating && !falling) { const [pr, pc] = dealerHand.pendingAt; dealerPlaceAt(pr, pc); if (!dealerHand) return; }
    const layer = document.getElementById('dealer-layer');
    if (layer) layer.style.visibility = (typeof isPaused !== 'undefined' && isPaused) ? 'hidden' : '';
    const { w, h } = dealerHand.size;
    const tgt = dealerTarget();
    const touch = layer?.classList.contains('dl-touch');
    const curScale = touch ? 1.2 : 1;
    let speed = 0;
    dealerHand.cards.forEach((card, i) => {
      const p = dealerHand.pos[i], el = dealerHand.els[i];
      if (!p || !el) return;
      const s = dealerSlot(i, tgt.x, tgt.y, w, h, curScale);
      // Each card further back is a looser spring, so the stack trails.
      const k = 170 / (1 + i * 0.9), damp = 2 * Math.sqrt(k) * 0.82;
      p.vx += ((s.x - p.x) * k - p.vx * damp) * dt;
      p.vy += ((s.y - p.y) * k - p.vy * damp) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      // Lean toward where it is being pulled.
      const want = Math.max(-26, Math.min(26, p.vx * 0.035 + p.vy * 0.01));
      p.rot += (want - p.rot) * Math.min(1, dt * 12);
      speed = Math.max(speed, Math.hypot(p.vx, p.vy));
      // At rest: the reward grid's float, smaller.
      const settle = dealerHand.still;
      const ph = (now / 1000) * (2 * Math.PI / 6) + i * 1.9;
      const fx = Math.sin(ph) * 1.0 * settle, fy = Math.cos(ph * 0.8) * 1.6 * settle, fr = Math.sin(ph * 1.3) * 0.4 * settle;
      const sc = i === 0 ? curScale : 1;
      el.style.transform = `translate(${p.x + fx}px, ${p.y + fy}px) rotate(${p.rot + fr}deg) scale(${sc})`;
    });
    // `still` eases in once the stack has slowed, so the drift starts gently.
    dealerHand.still = speed < 40 ? Math.min(1, dealerHand.still + dt * 1.5) : Math.max(0, dealerHand.still - dt * 6);
    if (dealerHand.cap) {
      const p0 = dealerHand.pos[0];
      const cw = dealerHand.cap.offsetWidth || 0;
      const cx = Math.max(4, Math.min(p0.x, innerWidth - cw - 4));
      dealerHand.cap.style.transform = `translate(${cx}px, ${p0.y + h * curScale + 4}px)`;
    }
    _dealerRaf = requestAnimationFrame(step);
  };
  _dealerRaf = requestAnimationFrame(step);
}

// ── costs ────────────────────────────────────────
function dealerSwapSeconds() {
  let t = BAL._resources.swap_seconds;
  if (hasKnack('free_swaps')) t = 0;
  else if (hasKnack('steady_hand')) t = BAL.steady_hand.swap_seconds;
  return Math.round(t * bossInteractMult() * interactTimeCostMult());
}
function dealerDiscardSeconds() {
  let t = BAL._resources.discard_seconds_per_card;
  if (hasKnack('free_discards')) t = 0;
  else { if (hasKnack('hoarder')) t = BAL.hoarder.discard_seconds_per_card; t += (discardCostThisRound || 0); }
  return Math.round(t * bossInteractMult() * interactTimeCostMult());
}
function dealerBill(sec) {
  if (sec > 0) { roundSeconds = Math.max(1, roundSeconds - sec); showTimeCost(`-${sec}s`); }
  updateClockUI();
}

// The top card leaves the stack; the rest step up.
function dealerShift() {
  dealerHand.cards.shift(); dealerHand.pos.shift();
  if (!dealerHand.cards.length) { dealerClose(true); return; }
  dealerBuildLayer();
}

// ── TAP: swap the top card in for a board card ───
function dealerPlaceAt(r, c) {
  if (!dealerActive()) return;
  // Mid-fall the board is still moving under the tap; hold it and place it the
  // moment the board settles (the loop below drains it), rather than ignore it.
  if (animating || falling) { dealerHand.pendingAt = [r, c]; return; }
  dealerHand.pendingAt = null;
  const old = gridData[r]?.[c];
  if (!old) return;
  if (isCellBlocked(r, c) || old._isStone || old._isTrick || !cardCan(old, 'discard')) {
    refuse('That card cannot be replaced'); return;
  }
  if (typeof bossInteractBlocked === 'function' && bossInteractBlocked('swap')) return;
  const card = dealerHand.cards[0];
  const fromEl = dealerHand.els[0], from = fromEl?.getBoundingClientRect();
  // Ghost the leaving card off to the discard button (the Magnet's language).
  const oldEl = document.querySelector(`#grid [data-card-id="${old._id}"]`);
  if (oldEl) {
    const rc = oldEl.getBoundingClientRect(), g = oldEl.cloneNode(true);
    Object.assign(g.style, { position: 'fixed', left: rc.left + 'px', top: rc.top + 'px', width: rc.width + 'px', height: rc.height + 'px', margin: 0, zIndex: 50, pointerEvents: 'none', transform: 'none' });
    document.body.appendChild(g);
    const btn = document.getElementById('btn-discard')?.getBoundingClientRect();
    const dx = btn ? (btn.left + btn.width / 2) - (rc.left + rc.width / 2) : 0;
    const dy = btn ? (btn.top + btn.height / 2) - (rc.top + rc.height / 2) : 120;
    g.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.45) rotate(-16deg)`, opacity: 0 }],
      { duration: 480, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });
    setTimeout(() => g.remove(), 560);
  }
  // The board card leaves exactly as a discarded one would; a Sleight keeps its
  // charges (it is cycled, not consumed - it was not used, just moved aside).
  if (typeof cardStatesOnLeave === 'function') cardStatesOnLeave([[r, c]]);
  if (old._isSleight) discardToPlayed(old); else discardToDrawPile(old);
  gridData[r][c] = card;
  // Counts as a swap: time, the round's swap tally, and the swap hooks. No stock.
  swapsUsedRound++;
  dealerBill(dealerSwapSeconds());
  if (typeof bossOnInteract === 'function') bossOnInteract('swap');
  lastSwapTime = Date.now();
  lastSwapRoundSeconds = roundSeconds;
  resetFocusDecayTimer();
  if (typeof cullPay === 'function') cullPay();
  if (typeof cardStatesTouchCells === 'function') cardStatesTouchCells([[r, c]]);
  if (typeof feedWhetstones === 'function') feedWhetstones([[r, c]]);
  if (typeof juryRigRoll === 'function') juryRigRoll([[r, c]]);
  try { sfxCardSelect(); } catch (e) {}
  selected = [];
  dealerShift();
  render();
  // The new card flies in from where it was held.
  const el = document.querySelector(`#grid [data-card-id="${card._id}"]`);
  if (el && from) {
    const to = el.getBoundingClientRect(), z = (to.width / (el.offsetWidth || to.width)) || 1;
    const dx = (from.left + from.width / 2 - (to.left + to.width / 2)) / z;
    const dy = (from.top + from.height / 2 - (to.top + to.height / 2)) / z;
    const s0 = from.width / (to.width || 1);
    el.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s0}) rotate(-8deg)` }, { transform: 'none' }],
      { duration: 300, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' });
  }
}

// ── DISCARD: throw the top card away ─────────────
function dealerDiscardTop() {
  if (!dealerActive() || animating) return;
  if (typeof bossInteractBlocked === 'function' && bossInteractBlocked('discard')) return;
  const el = dealerHand.els[0];
  if (el) {
    const rc = el.getBoundingClientRect(), g = el.cloneNode(true);
    Object.assign(g.style, { position: 'fixed', left: 0, top: 0, transform: `translate(${rc.left}px,${rc.top}px)`, pointerEvents: 'none', zIndex: 900 });
    document.body.appendChild(g);
    g.animate([{ transform: `translate(${rc.left}px,${rc.top}px)`, opacity: 1 },
               { transform: `translate(${rc.left - 30}px,${rc.top + 90}px) rotate(-28deg) scale(.7)`, opacity: 0 }],
      { duration: 380, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });
    setTimeout(() => g.remove(), 420);
  }
  dealerBill(dealerDiscardSeconds());
  if (typeof bossOnInteract === 'function') bossOnInteract('discard');
  try { sfxCardDiscard(); } catch (e) {}
  dealerShift();
}
