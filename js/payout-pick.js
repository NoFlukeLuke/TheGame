// ══════════════════════════════════════════════
// THE PICK (r244) - one card operation after every payout
// ══════════════════════════════════════════════
// The deck-manipulation answer that needs no shop, no consumable inventory and
// no node: after the payout, the board you just cleared COMES BACK, you pick one
// card off it, and you do one thing to that card. Boost it, copy it, or cut it.
//
// **Picking off the BOARD is the whole point.** An abstract list of 52 faces is a
// spreadsheet; the board is a card you were just building hands around, so the
// choice carries the round with it. It is also why this sits at the payout: that
// beat already exists, already pauses, and already belongs to the round that
// finished - so the operation costs no node, no slot, no credits and no time.
//
// ── THE UN-EXPLODE ──────────────────────────────────────────────────────────
// The goal finale blows the board apart (js/score-dance.js: outward from the
// grid's centre, 200-340px, +-160deg, scale .82, fading). The cards have to be
// back for a pick, and REVERSING that blast is the one move that reads as the
// round being rewound rather than as a new screen opening. It is the same
// geometry played backwards, on `sfxRewind` - the reversed-envelope sweep r183
// built for exactly this feeling.
//
// **`render()` is what puts the cards back, not this file.** Building card
// elements here would be a second card renderer to keep in step with
// `renderCardAppearance`; this only animates what the renderer produced.
//
// ── SINCE r332 THE BOARD PERSISTS, AND THE SNAPSHOT STILL EARNS ITS KEEP ────
// boardPersists() made the round-end fall presentation only, so gridData really
// does still hold every card when the pick opens: pickRestoreBoard finds each
// cell already filled and no-ops. The snapshot is now a LIST OF CANDIDATES
// rather than a rescue, and Remove lands entirely on its `gridData[r][c] = null`
// - the pile splice finds nothing, because the card is on the board and not in
// a pile. The paragraph below is the pre-r332 reasoning, kept for its trap.
//
// **pickClearBoard MUST ONLY GIVE BACK WHAT THE RESTORE BORROWED (r356).** This
// block used to claim the clear "only nulls cells it put back, so it no-ops
// too", and it did not: the restore fills a cell only when it is null, while the
// clear nulled every cell whose card matched the snapshot - which on a
// persisting board is EVERY CELL, because the card never left. So the pick
// emptied the whole board and those cards went into no pile at all; the next
// round's `fillGridHoles` drew a fresh boardful over the hole. Measured through
// the real payout in Guided AND Classic: **the run's deck went 56 -> 40 cards in
// one round**, with `expectedDeckTotal` still reading 56, so four rounds ran it
// dry. `pickRestored` is the whole fix - the restore records what it actually
// filled and the clear gives back exactly that.
//
// ── THE BOARD WAS REALLY GONE BY THEN, SO THE PICK CARRIES A SNAPSHOT ───────
// The obvious reading - "the finale removes the card DOM while gridData still
// holds every card" - is true of the SCORING FINALE and NOT of the interlude.
// `showLevelUpScreen_fallOnly` runs before the payout and does the real thing:
// `discardToPlayed(card)` on every cell and then `gridData` replaced outright
// with nulls. Measured: 4 rows, **0 candidates**, at the moment the pick opened.
//
// So `pickSnapshot` is taken at the TOP of startInterlude, above the fall, and
// the restore is **presentation only** - the deck accounting already happened in
// the fall and must not happen twice. The cards are restored into `gridData` to
// be looked at and picked, and nulled straight back out when the pick closes, so
// every screen after this one sees exactly the post-fall board it expects.
//
// `_id` is in `DURABLE_CARD_FIELDS`, so the copy now sitting in `playedPile` is
// the same card by identity. That is what lets Boost key off `cardId` and Remove
// splice the pile without either caring which of the two objects it was handed.

// Off by default: this is a real change to the economy, so it ships behind
// Settings -> Motion -> "Card pick after payout" until the owner has played it.
//
// **THE SETTING IS THE ONLY STORE, and this flag deliberately does NOT persist
// itself.** A module that also writes its own localStorage key LOSES to the
// settings system and looks like it is ignoring the toggle: `js/settings.js`
// applies every row's stored value - or its DEFAULT - at load, so an unset row
// calls `apply(false)` on boot and stamps the module's own key back to off.
// Measured: the key read `on`, the reload read `false`. One store, one writer.
let payoutPickEnabled = false;
function setPayoutPickEnabled(on) { payoutPickEnabled = !!on; }

// ── The un-explode, tuned in payout-pick-preview.html ────────────────────────
// Keep this block and the preview's dump byte-identical: a preview that
// disagrees with the game is worse than not having one (r233).
const PICK_CFG = {
  dist:    200,   // px the card starts out from its cell, along the centre ray
  distVar: 140,   // extra random distance on top
  spin:    160,   // max degrees it starts rotated by, either way
  scale:   0.82,  // how small it starts
  dur:     760,   // ms of flight
  stagger: 26,    // ms between cards, nearest the centre first
  easing:  'cubic-bezier(.2,.75,.3,1)',
};

// Where a card at rect `r` starts from, given the board's centre. The SAME ray
// the explode used, so a card comes back along the line it left on.
function pickBlastVector(r, cx, cy) {
  let ax = (r.left + r.width / 2) - cx, ay = (r.top + r.height / 2) - cy;
  const len = Math.hypot(ax, ay) || 1;
  return { x: ax / len, y: ay / len, d: len };
}

// Bring the board back. Resolves when the last card has landed.
function pickUnexplode() {
  return new Promise(resolve => {
    const gridEl = document.getElementById('grid');
    if (!gridEl) { resolve(); return; }
    const els = [...gridEl.querySelectorAll('[data-card-id]')];
    if (!els.length) { resolve(); return; }
    const gr = gridEl.getBoundingClientRect();
    const cx = gr.left + gr.width / 2, cy = gr.top + gr.height / 2;
    // Nearest the centre lands first, so the board fills OUTWARD from the middle -
    // the exact reverse of a blast, and what makes it read as a rewind rather
    // than as a deal.
    const rows = els.map(el => {
      const r = el.getBoundingClientRect();
      return { el, v: pickBlastVector(r, cx, cy) };
    }).sort((a, b) => a.v.d - b.v.d);

    if (typeof sfxRewind === 'function') { try { sfxRewind(); } catch (e) {} }
    let last = 0;
    rows.forEach((row, i) => {
      const dist = PICK_CFG.dist + fxRandom() * PICK_CFG.distVar;
      const rot  = (fxRandom() * 2 - 1) * PICK_CFG.spin;
      const delay = i * PICK_CFG.stagger;
      last = Math.max(last, delay + PICK_CFG.dur);
      row.el.style.zIndex = '30';
      row.el.animate([
        { transform: `translate(${row.v.x * dist}px, ${row.v.y * dist}px) rotate(${rot}deg) scale(${PICK_CFG.scale})`, opacity: 0 },
        { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      ], { duration: PICK_CFG.dur, delay, easing: PICK_CFG.easing, fill: 'backwards' });
    });
    setTimeout(() => { rows.forEach(r => { r.el.style.zIndex = ''; }); resolve(); }, last + 40);
  });
}

// ── The operations ──────────────────────────────────────────────────────────
// Three verbs, deliberately distinct: make this card better, have another of it,
// or never see it again. Each rides a seam that already exists - the first two
// are the Card Market's, the third is the one `drawCard()` already covers by
// refilling an empty cell at round start (js/level-up.js).
const PICK_OPS = [
  { id:'boost',  icon:'✦', name:'Boost',  color:'#3a6fca',
    line: () => `+${BAL.payout_pick.pips} pips, permanently`,
    apply: (card) => {
      enhanceCardKey(cardId(card), { pips: BAL.payout_pick.pips });
      return `+${BAL.payout_pick.pips} pips`;
    } },
  { id:'copy',   icon:'⧉', name:'Copy',   color:'#3aa76d',
    line: () => 'a second one, shuffled into the deck',
    apply: (card) => { copyCardToDeck(card); return 'copied into the deck'; } },
  { id:'remove', icon:'✕', name:'Remove', color:'#c0392b',
    line: () => 'gone from the run for good',
    apply: (card, pos) => {
      // The card is in playedPile by now - the round-end fall put it there - so
      // the removal is a splice out of the PILES by identity, never a null on the
      // board. Nulling the cell would only hide it for one screen: the cell is
      // cleared again when the pick closes and the card would still be in the
      // pile, back in the deck at the next flushPlayedDeck.
      const id = card._id;
      for (const pile of [playedPile, drawPile]) {
        const i = pile.findIndex(c => c && c._id === id);
        if (i >= 0) { pile.splice(i, 1); break; }
      }
      // And off the BOARD. Dropping it from the snapshot alone was not enough and
      // is the bug this comment exists for: `pickClearBoard` only nulls cells it
      // finds in the snapshot, so a card filtered out of the snapshot was left
      // sitting in `gridData` - out of the piles but still on the board, and
      // therefore dealt straight back into the next round. Measured: the board
      // failed to empty on remove and on nothing else.
      if (pos) gridData[pos[0]][pos[1]] = null;
      pickSnapshot = pickSnapshot.filter(e => e.card._id !== id);
      pickRestored = pickRestored.filter(e => e.card._id !== id);
      if (typeof expectedDeckTotal !== 'undefined') expectedDeckTotal--;
      updateDeckHud?.();
      return 'removed from the deck';
    } },
];

let pickActive = false, pickCard = null, pickPos = null, pickDone = null;
// THE ONE ANSWER TO "IS THE PICK DRIVING THE BOARD RIGHT NOW", read by the grid's
// pointer guards in js/input.js. The r244 note says the tap intercept sits above
// onCardTap's `animating` check - true, and not enough: the guard that actually
// decided was one level up, on the grid's own pointerdown, and r254 added
// `roundEnded` to it. The pick runs inside the interlude, which is by definition
// after the round ended, so from r254 to r356 EVERY tap on the board was
// swallowed before onCardTap could run and the bar sat on PICK A CARD for ever.
// Measured through the real click path in Guided: pickCard null, 0 op tiles.
function pickOwnsBoard() { return pickActive; }
// [{ r, c, card }] of the board as it stood before the round-end fall.
let pickSnapshot = [];

// Called from the TOP of startInterlude, above showLevelUpScreen_fallOnly - the
// last moment the board still exists. Ordinary cards only: a Sleight, a stone or
// a Trick is not a deck card and none of the three operations means anything
// applied to one.
function pickTakeSnapshot() {
  pickSnapshot = [];
  if (!payoutPickEnabled || typeof gridData === 'undefined') return;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r]?.[c];
    if (!card || !card.rank) continue;
    if (card._isSleight || card._isStone || card._isTrick) continue;
    pickSnapshot.push({ r, c, card });
  }
}

function pickCandidates() { return pickSnapshot; }

// The cells pickRestoreBoard ACTUALLY filled. Never the snapshot: a snapshot
// entry says "this card was here", not "this pick put it here", and the clear
// has to give back only what it borrowed. On a persisting board this stays
// empty and the clear is a genuine no-op.
let pickRestored = [];

// Put the snapshot back on the board to be looked at. PRESENTATION ONLY - on a
// non-persisting board these cards are already in playedPile and their
// accounting is done; on a persisting one they never left and nothing is filled.
function pickRestoreBoard() {
  pickRestored = [];
  pickSnapshot.forEach(({ r, c, card }) => {
    if (gridData[r] && gridData[r][c] === null) { gridData[r][c] = card; pickRestored.push({ r, c, card }); }
  });
}

// And take back off exactly the cells the restore filled, so the reward grid,
// the level-up refill and the deck audit all see the board the fall left.
function pickClearBoard() {
  pickRestored.forEach(({ r, c, card }) => {
    if (gridData[r] && gridData[r][c] === card) gridData[r][c] = null;
  });
  pickRestored = [];
  pickSnapshot = [];
}

function pickBar() {
  let bar = document.getElementById('pick-bar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'pick-bar'; document.body.appendChild(bar); }
  return bar;
}

// Body-level and placed in RAW VIEWPORT PX, the same rule the goal banner, the
// map bar and the Time pop-up follow: anything inside #cabinet inherits its CSS
// zoom and these coordinates would be multiplied by it.
//
// **It MEASURES the bar and flips below the board when it does not fit above.**
// The bar changes height when a card is picked - one line becomes three option
// tiles - and the gap above the board is only about 100px on a 1440x820 desktop,
// so the first version ran the options straight off the top of the screen with
// no way to reach them. Measured, then fixed. Same class of bug as the r-cap on
// `.time-popup`: a pop-up placed in viewport px has to be clamped to one.
const PICK_BAR_GAP = 14, PICK_BAR_EDGE = 8;
function pickPlaceBar(bar) {
  const gridEl = document.getElementById('grid');
  const r = gridEl ? gridEl.getBoundingClientRect() : null;
  if (!r || !r.width) return;
  bar.style.left = Math.round(r.left + r.width / 2) + 'px';
  // Height is only readable once it is laid out, which `.show` has already done.
  const h = bar.offsetHeight || 0;
  const above = r.top - PICK_BAR_GAP - h >= PICK_BAR_EDGE;
  if (above) {
    bar.classList.remove('pk-below');
    bar.style.top = Math.round(r.top - PICK_BAR_GAP) + 'px';
  } else {
    bar.classList.add('pk-below');
    // Clamped at the bottom too, so a tall bar on a short viewport still lands
    // fully on screen rather than half under the edge.
    const top = Math.min(r.bottom + PICK_BAR_GAP, window.innerHeight - h - PICK_BAR_EDGE);
    bar.style.top = Math.round(Math.max(PICK_BAR_EDGE, top)) + 'px';
  }
}

function pickRenderBar() {
  const bar = pickBar();
  if (!pickCard) {
    bar.innerHTML = `<span class="pk-title">PICK A CARD</span>`
      + `<span class="pk-sub">one card off this board, one thing done to it</span>`
      + `<button class="pk-skip" id="pk-skip">SKIP</button>`;
  } else {
    const face = `${pickCard.rank}${(typeof cardColorSuit === 'function') ? cardColorSuit(pickCard) : pickCard.suit}`;
    bar.innerHTML = `<span class="pk-title">${face}</span>`
      + `<span class="pk-ops">` + PICK_OPS.map(o =>
          `<button class="pk-op" data-op="${o.id}" style="--pko:${o.color}">`
          + `<b>${o.icon} ${o.name}</b><i>${o.line()}</i></button>`).join('') + `</span>`
      + `<button class="pk-skip" id="pk-skip">SKIP</button>`;
    bar.querySelectorAll('.pk-op').forEach(b => {
      b.onclick = () => pickApply(PICK_OPS.find(o => o.id === b.dataset.op));
    });
  }
  bar.querySelector('#pk-skip').onclick = () => pickFinish();
  bar.classList.add('show');
  pickPlaceBar(bar);
}

function pickSelect(r, c) {
  if (!pickActive) return;
  const card = gridData[r]?.[c];
  if (!card || !card.rank) return;
  pickCard = card; pickPos = [r, c];
  const gridEl = document.getElementById('grid');
  gridEl?.querySelectorAll('.pk-chosen').forEach(el => el.classList.remove('pk-chosen'));
  gridEl?.querySelector(`[data-card-id="${card._id}"]`)?.classList.add('pk-chosen');
  if (typeof sfxCardSelect === 'function') { try { sfxCardSelect(); } catch (e) {} }
  pickRenderBar();
}

function pickApply(op) {
  if (!op || !pickCard) return;
  let note = '';
  // An operation that throws must not look like an operation that did nothing.
  // A bare `catch { note = '' }` here swallowed a ReferenceError in the Remove
  // op and the screen carried on as if the card had been removed - the pile was
  // spliced, the deck count was not, and only a deck audit two rounds later
  // would have said so. Dev mode gets the reason, the same way the dance logs a
  // timeline drift.
  try {
    note = op.apply(pickCard, pickPos) || '';
  } catch (e) {
    if (typeof devMode !== 'undefined' && devMode) console.error('[PICK] ' + op.id + ' threw:', e);
    showMessage('That did not take', 'var(--red)');
    pickFinish();
    return;
  }
  const face = `${pickCard.rank}${(typeof cardColorSuit === 'function') ? cardColorSuit(pickCard) : pickCard.suit}`;
  showMessage(`${face} · ${note}`, op.color);
  if (typeof sfxCoin === 'function') { try { sfxCoin(); } catch (e) {} }
  // Repaint so a removed card leaves and a boosted one shows its new badge
  // before the board falls away again.
  try { render(); } catch (e) {}
  pickFinish();
}

function pickFinish() {
  pickActive = false; pickCard = null; pickPos = null;
  pickClearBoard();
  try { render(); } catch (e) {}
  document.getElementById('pick-bar')?.classList.remove('show');
  document.getElementById('grid')?.querySelectorAll('.pk-chosen').forEach(el => el.classList.remove('pk-chosen'));
  document.body.classList.remove('pick-active');
  if (typeof updateSelectionUI === 'function') updateSelectionUI();
  const done = pickDone; pickDone = null;
  if (done) done();
}

// The whole beat, awaited by startInterlude. Resolves when the player has chosen
// or skipped; resolves IMMEDIATELY when there is nothing to pick from, so a
// caller never has to test for that.
function runPayoutPick() {
  return new Promise(resolve => {
    if (!payoutPickEnabled || !pickCandidates().length) { pickSnapshot = []; resolve(); return; }
    pickActive = true; pickDone = resolve;
    document.body.classList.add('pick-active');
    // The payout panel is rendered INTO #grid and is still there at this point -
    // render() reconciles [data-card-id] elements and would leave it sitting over
    // the board it is about to repopulate.
    document.getElementById('payout-panel')?.remove();
    pickRestoreBoard();
    try { render(); } catch (e) { pickFinish(); return; }
    pickUnexplode().then(() => { if (pickActive) pickRenderBar(); });
  });
}
