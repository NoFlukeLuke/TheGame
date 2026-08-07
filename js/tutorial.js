// ══════════════════════════════════════════════
// TUTORIAL MODE  (r123)
// ══════════════════════════════════════════════
// A guided first run. It is NOT a fake sandbox — MODES.tutorial has
// `actStructure: true`, so every system (round → payout → reward grid → shop)
// is the REAL one; the tutorial only (a) rigs the opening board and goal so the
// lesson can't be derailed by a bad deal, and (b) lays coach-marks over the UI.
//
// ── Why it's almost entirely self-contained ──
// The step machine is POLLED, not event-driven: each step declares `when` (wait
// until true before showing) and `until` (auto-advance when true) as predicates
// read off existing globals (`selected`, `handsPlayed`, `goalReachedThisRound`,
// DOM state…). A single rAF loop evaluates them. That means the rest of the
// engine needs almost no tutorial hooks — the only edits outside this file are:
//   · menu.js         — the MODES.tutorial entry + carousel card
//   · game-control.js — one call at the end of startGame()
//   · input.js        — suppress the 2s auto-submit on the "press PLAY" steps
//   · reward-grid.js  — force the destination tile to be the Shop
// Adding or reordering steps means editing TUTORIAL_STEPS and nothing else.
//
// ── Why the overlay lives OUTSIDE #stage ──
// #cabinet/#stage are scaled with CSS `zoom`. An overlay inside them inherits
// that scale (the bug that pushed the dev panel off-screen — see CLAUDE.md), so
// the coach-mark layer is appended to <body> and positioned from raw
// getBoundingClientRect() viewport pixels, which are already post-zoom.

function tutorialActive() { return !!ACTIVE_MODE && ACTIVE_MODE.tutorial === true; }

const TUTORIAL_GOAL  = 500;   // ~3 decent hands at level 1 — a real round, but short
const TUTORIAL_COINS = 14;    // enough to actually buy something in the tutorial shop

let tutorialRunning = false;
let tutorialStepIdx = -1;
let tutorialRaf     = null;
let tutorialEls     = null;   // { layer, spot, bubble, arrow, step, title, body, btns, shut[4] }
let _tutShown       = false;  // is the current step's bubble on screen yet (past its `when`)?
let _tutWaitFrom    = 0;      // when the current step started waiting on its `when`
let _tutClockHeld   = false;  // this file's claim on gameTimerPaused

// ── Anchor helpers ───────────────────────────────────────────────────────────
// First VISIBLE match wins, so one step can target the landscape widget or its
// portrait equivalent without branching (e.g. #vclock vs #clock-area).
// IMPORTANT: the landscape layout gives several wrappers `display: contents`
// (#score-panel, #hand-preview-area, #action-col…). Those have no box at all, so
// they'd spotlight a zero rect — hence the width test, and hence why the steps
// below anchor the REAL positioned widgets (#score-center, #selected-cards, …).
function tutEl(...sels) {
  for (const s of sels) {
    const el = document.querySelector(s);
    if (el && el.offsetParent !== null && el.getBoundingClientRect().width > 2) return el;
  }
  return null;
}
// Union of several anchors — lets one spotlight cover e.g. SCORE + GOAL, which
// the landscape layout positions as two separate boxes.
function tutEls(...sels) {
  const found = sels.map(s => tutEl(s)).filter(Boolean);
  return found.length ? found : null;
}
function tutShopOpen()   { return !!document.getElementById('shop-overlay')?.classList.contains('show'); }
function tutRewardOpen() { return document.body.classList.contains('reward-active'); }
function tutPayoutEl()   { return document.getElementById('payout-overlay'); }
// True once every animation/dance has settled — used by `when` so a bubble never
// pops on top of the scoring dance or the round-start deal.
function tutIdle() {
  return !animating && !falling && !dealPhase && !danceAbortController;
}

// ── The script ───────────────────────────────────────────────────────────────
// anchor:     () => Element | Element[] | null — what the spotlight rings
// side:       bubble placement vs the anchor: right/left/top/bottom, or
//             'center' (flat veil, centred card) or 'float' (no dim, corner-parked)
// corner:     'left' (default) | 'right' — which corner a float step parks in
// gate:       block every click outside the spotlight (forces the taught action)
// hold:       freeze the round clock while this step is up (read-only steps only)
// noAutoPlay: suppress the 2s auto-submit so the player presses PLAY themselves
// next:       show a NEXT button;  actions: custom buttons instead
// when:       predicate — hold the step back until true (whenTimeoutMs escape hatch)
// until:      predicate — auto-advance when true
// onEnter:    run once when the bubble appears
const TUTORIAL_STEPS = [
  {
    id: 'welcome', side: 'center', hold: true, next: true,
    title: 'Orientation',
    body: `Obliviscore is poker played on a grid.<br><br>Cards that <b>touch</b> — sideways or up and down — can be played together as a hand. Beat the round's <b>goal</b> before the clock runs out, and you move on.<br><br>This takes about two minutes.`,
  },
  {
    id: 'board', anchor: () => tutEl('#grid'), side: 'right', gate: true, hold: true, noAutoPlay: true,
    title: 'The board',
    body: `Tap cards that touch to select them — or press and drag across them.<br><br>There are three <b>Kings</b> waiting for you in there. <b>Select all three.</b>`,
    until: () => selected.length >= 3,
  },
  {
    id: 'reading', anchor: () => tutEl('#score-subboxes'), side: 'bottom',
    gate: true, hold: true, next: true, noAutoPlay: true,
    title: 'Pips × Mult',
    body: `Three Kings makes <b>Three of a Kind</b> — and this row has already priced it.<br><br>Every card adds <b>pips</b>. The hand type sets the <b>mult</b>. Multiply them and that's the score.<br><br>You never have to select cards in the right order — the game always finds the best hand in whatever you've picked.`,
  },
  {
    id: 'play', anchor: () => tutEl('#btn-play'), side: 'left', gate: true, hold: true, noAutoPlay: true,
    title: 'Play it',
    body: `Hit <b>PLAY</b>.`,
    // Safety net: PLAY is disabled without a valid selection, and a gated step
    // only exposes PLAY — so if the selection was lost, re-make it or the player
    // would be stuck staring at a dead button.
    onEnter: () => { if (!(selected.length >= 2 && findBestHand(selected))) tutorialSelectKings(); },
    until: () => handsPlayed >= 1,
  },
  {
    id: 'dance', anchor: () => tutEl('#selected-cards'), side: 'right', hold: true, next: true,
    // Wait for the dance to FINISH (~6s) rather than firing on handsPlayed — the
    // layer stays hidden meanwhile, so the count-up plays out undimmed.
    when: () => tutIdle() && handsPlayed >= 1,
    title: 'The count',
    body: `That was your hand playing out. Each card flies into that panel and scores in turn, and the total climbs as it goes.<br><br>The panel sits empty the rest of the time — it's a stage, not a hand of cards.`,
  },
  {
    id: 'score', anchor: () => tutEls('#score-center', '#score-left'), side: 'bottom', hold: true, next: true,
    when: () => tutIdle(),
    title: 'Score vs goal',
    body: `Your round score, and the <b>goal</b> you have to reach. Hit it and the round ends immediately — there's no bonus for overshooting.<br><br>Score resets every round; the goal climbs.`,
  },
  {
    id: 'focus', anchor: () => tutEl('#focus-meter-wrap'), side: 'right', hold: true, next: true,
    title: 'Focus',
    body: `Focus builds when you play hands <b>quickly</b>, and drains while you sit still.<br><br>It's a third multiplier stacked on pips × mult — so a fast run of hands is worth far more than the same hands played slowly.`,
  },
  {
    id: 'clock', anchor: () => tutEl('#vclock', '#clock-area'), side: 'bottom', hold: true, next: true,
    title: 'The clock',
    body: `Your round timer.<br><br><b>Playing a hand is free.</b> Fixing the board is not — a swap costs <b>4s</b>, a discard <b>3s</b>.<br><br>Whatever's left on the clock is paid out as credits at the end of the round, so time is really money.`,
  },
  {
    id: 'tools', anchor: () => tutEls('#btn-discard', '#swap-indicator'), side: 'left', hold: true, next: true,
    title: 'Swap & discard',
    body: `Dealt a mess? <b>Double-tap</b> a card, then tap a neighbour to trade their places.<br><br>Or select cards you don't want and hit <b>DISCARD</b> to drop them and pull fresh ones in.<br><br>You get a limited number of each per round — the counts are on the buttons.`,
  },
  {
    // 'float' = no spotlight, no dim, bubble parked in a corner. The player has
    // to actually play here, so the board must not be behind a veil.
    id: 'clear', side: 'float',
    title: 'Clear the round',
    body: `The clock is running again. Play hands until you hit the goal — <b>anything counts</b>, so just keep making hands.`,
    until: () => goalReachedThisRound,
  },
  {
    id: 'payout', anchor: () => tutPayoutEl(), side: 'right', next: true,
    // Wait for the "Valued." button to be REVEALED, not just for the overlay to
    // exist — the panel spends ~6s counting interest and efficiency up, and a
    // bubble explaining the numbers before they've appeared explains nothing.
    when: () => !!document.querySelector('#po-valued.show'),
    title: 'Payout',
    body: `Round cleared. Two things pay you:<br><br><b>Interest</b> — 10% of the credits you're sitting on. Hoarding is a strategy.<br><b>Efficiency</b> — 1 credit per 10 seconds you had left on the clock.<br><br>Hit <b>Valued.</b> when you're done reading.`,
    until: () => !tutPayoutEl(),
  },
  {
    id: 'reward', anchor: () => tutEl('#grid'), side: 'right',
    // Let the tiles finish dealing in — `rewardDealing` also gates
    // onRewardCellClick, so showing earlier would invite unregistered taps.
    when: () => tutRewardOpen() && !rewardDealing,
    title: 'Spoils',
    body: `Your reward is a <b>path</b>, not a pick. Select a connected run of tiles — and you take everything on it.<br><br><b>Gold</b> tiles help. <b>Red</b> tiles hurt. The good stuff is usually behind something nasty.<br><br>One tile is a <b>destination</b> 🏪 — it decides where you go next. Include it, then hit <b>CONFIRM</b>.`,
    until: () => !tutRewardOpen(),
  },
  {
    // Float, not a spotlight: the shop fills the screen, so any hole would leave
    // the bubble sitting on top of the shelves it's describing. The right third
    // of every shelf is empty, so that's where it parks.
    id: 'shop', side: 'float', corner: 'right', next: true,
    when: () => tutShopOpen(),
    title: 'The shop',
    body: `Four shelves, four kinds of power:<br><br><b>Tricks</b> — passive scoring buffs. Your build.<br><b>Sleights</b> — real cards that go into your deck and do strange things.<br><b>Knacks</b> — rule-changers that run all game.<br><b>Upgrades</b> — raise your caps: grid size, swaps, discards, round time.<br><br>You've got credits. Spend some.`,
  },
  {
    id: 'shop-leave', anchor: () => tutEl('#shop-footer-row'), side: 'top',
    when: () => tutShopOpen(),
    title: 'Reroll or leave',
    body: `Not tempted? <b>Reroll</b> refreshes everything you haven't bought.<br><br><b>Leave Shop</b> when you're done — the next round deals straight after.`,
    until: () => !tutShopOpen(),
  },
  {
    id: 'outro', side: 'center',
    when: () => !tutShopOpen() && tutIdle(),
    title: 'That\'s the loop',
    body: `<b>Round → payout → spoils → shop</b>, over and over.<br><br>Five nodes and then a <b>boss</b>, three times over. Beat Act 3 and you've won the run.<br><br>Everything else — Tricks, Sleights, Knacks, events — is stacked on top of what you just did.`,
    actions: [
      { label: 'Start a real run', fn: () => { tutorialEnd(); ACTIVE_MODE = MODES.normal; startGame(); } },
      { label: 'Keep playing this one', fn: () => tutorialEnd() },
      { label: 'Main menu', fn: () => { tutorialEnd(); stopTimers(); initMainMenu(); } },
    ],
  },
];

// ── Run setup ────────────────────────────────────────────────────────────────
// Called at the very end of startGame() when the tutorial mode is active.
function tutorialBeginRun() {
  roundGoal = TUTORIAL_GOAL;
  coins     = TUTORIAL_COINS;
  tutorialStackBoard();
  updateCoinsUI();
  updateScoreUI();
  render();
  tutorialStart();
}

// Guarantee an obvious, adjacent Three of a Kind on the opening board so the
// "select three touching cards" step can never be un-completable. Kings are
// MOVED (swapped with whatever occupies the target cell), never minted, so the
// deck audit and card identities stay intact.
function tutorialStackBoard() {
  const targets = [[1, 1], [1, 2], [2, 1]].filter(([r, c]) => r < gridRows && c < gridCols);
  if (targets.length < 3) return;
  const inTargets = new Set(targets.map(([r, c]) => `${r}-${c}`));
  const placed = new Set();
  const wanted = card => card && card.rank === 'K' && !card._isSleight && !card._isStone && !card._isTrick && !placed.has(card._id);

  // Find a King anywhere OUTSIDE the target cells — grid first, then the draw pile.
  function pullKing() {
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
      if (inTargets.has(`${r}-${c}`)) continue;
      if (wanted(gridData[r][c])) return { card: gridData[r][c], grid: [r, c] };
    }
    const i = drawPile.findIndex(wanted);
    return i === -1 ? null : { card: drawPile[i], pile: i };
  }

  targets.forEach(([r, c]) => {
    const cur = gridData[r][c];
    if (wanted(cur)) { placed.add(cur._id); return; }           // already a King — leave it
    const got = pullKing();
    if (!got) return;                                            // ran out (can't happen with 4 suits)
    if (got.grid) gridData[got.grid[0]][got.grid[1]] = cur;      // displaced card takes the King's old cell
    else if (cur) drawPile[got.pile] = cur;
    else drawPile.splice(got.pile, 1);
    gridData[r][c] = got.card;
    placed.add(got.card._id);
  });
}

// Re-select the stacked Kings (see tutorialStackBoard). Used as the `play` step's
// safety net when the player wandered off the selection during an earlier step.
function tutorialSelectKings() {
  const kings = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++)
    if (gridData[r]?.[c]?.rank === 'K' && cardCan(gridData[r][c], 'select')) kings.push([r, c]);
  if (kings.length < 2) return;
  selected = [];
  // Add in an order that keeps the running selection connected at every step —
  // tryAddToSelection enforces reachability, so a naive push order can drop cards.
  kings.slice(0, limits.selection.current).forEach(() => {
    const next = kings.find(([r, c]) => !selected.some(([sr, sc]) => sr === r && sc === c) &&
      (selected.length === 0 || selected.some(([sr, sc]) => Math.abs(sr - r) + Math.abs(sc - c) === 1)));
    if (next) selected.push(next);
  });
  render();
}

// Gate for input.js: true while a step wants the player to press PLAY themselves.
function tutorialHoldsAutoSubmit() {
  return tutorialRunning && !!TUTORIAL_STEPS[tutorialStepIdx]?.noAutoPlay;
}

// ── Coach-mark layer ─────────────────────────────────────────────────────────
// Built in JS (not index.html) so the whole tutorial is one file to delete.
function tutorialBuildLayer() {
  if (tutorialEls) return tutorialEls;
  const layer = document.createElement('div');
  layer.id = 'tut-layer';
  layer.innerHTML =
    `<div id="tut-spot"></div>` +
    `<div class="tut-shutter" data-s="t"></div><div class="tut-shutter" data-s="b"></div>` +
    `<div class="tut-shutter" data-s="l"></div><div class="tut-shutter" data-s="r"></div>` +
    `<div id="tut-bubble">` +
      `<div id="tut-arrow"></div>` +
      `<div id="tut-step"></div>` +
      `<div id="tut-title"></div>` +
      `<div id="tut-body"></div>` +
      `<div id="tut-btns"></div>` +
      `<button id="tut-skip">Skip tutorial</button>` +
    `</div>`;
  document.body.appendChild(layer);
  layer.querySelector('#tut-skip').onclick = () => tutorialEnd();
  tutorialEls = {
    layer,
    spot:   layer.querySelector('#tut-spot'),
    bubble: layer.querySelector('#tut-bubble'),
    arrow:  layer.querySelector('#tut-arrow'),
    step:   layer.querySelector('#tut-step'),
    title:  layer.querySelector('#tut-title'),
    body:   layer.querySelector('#tut-body'),
    btns:   layer.querySelector('#tut-btns'),
    shut:   [...layer.querySelectorAll('.tut-shutter')],
  };
  return tutorialEls;
}

// Freeze/unfreeze the round clock. Wrapped so the tutorial only ever RELEASES a
// pause it took itself — the reward grid and shop own gameTimerPaused during
// their own steps and must not be un-paused from under them.
function tutorialHoldClock(on) {
  if (on === _tutClockHeld) return;
  _tutClockHeld = on;
  gameTimerPaused = on;
}

function tutorialStart() {
  if (tutorialRunning) return;
  tutorialBuildLayer();
  tutorialRunning = true;
  tutorialStepIdx = -1;
  tutorialAdvance();
  tutorialLoop();
}

function tutorialAdvance() {
  const prev = TUTORIAL_STEPS[tutorialStepIdx];
  if (prev && prev.onExit) prev.onExit();
  tutorialStepIdx++;
  _tutShown = false;
  _tutWaitFrom = performance.now();
  if (tutorialStepIdx >= TUTORIAL_STEPS.length) { tutorialEnd(); return; }
  tutorialEls.layer.classList.remove('show');   // hidden until the step's `when` passes
  tutorialHoldClock(false);
}

// Paint the current step into the bubble (once, when its `when` first passes).
function tutorialShowStep() {
  const st = TUTORIAL_STEPS[tutorialStepIdx];
  const E  = tutorialEls;
  _tutShown = true;
  E.step.textContent  = `Step ${tutorialStepIdx + 1} / ${TUTORIAL_STEPS.length}`;
  E.title.textContent = st.title;
  E.body.innerHTML    = st.body;
  E.btns.innerHTML    = '';
  (st.actions || (st.next ? [{ label: 'Next ›', fn: () => tutorialAdvance() }] : [])).forEach(a => {
    const b = document.createElement('button');
    b.className = 'tut-btn';
    b.textContent = a.label;
    b.onclick = a.fn;
    E.btns.appendChild(b);
  });
  E.layer.classList.toggle('gated', !!st.gate);
  E.layer.classList.add('show');
  if (st.hold) tutorialHoldClock(true);
  if (st.onEnter) st.onEnter();
  tutorialPosition();
}

// Per-frame: run the state machine and keep the spotlight glued to its anchor.
function tutorialLoop() {
  if (!tutorialRunning) return;
  tutorialRaf = requestAnimationFrame(tutorialLoop);
  const st = TUTORIAL_STEPS[tutorialStepIdx];
  if (!st) return;
  // Waiting on `when`. The escape hatch matters: a step whose predicate never
  // flips (an animation that stalls in a background tab, an overlay that closed
  // in an unexpected order) would otherwise leave the tutorial silently dead —
  // and the player with no idea it was ever running. Show it anyway after a beat.
  if (!_tutShown) {
    const waited = performance.now() - _tutWaitFrom;
    if (!st.when || st.when() || waited > (st.whenTimeoutMs || 20000)) tutorialShowStep();
    return;
  }
  if (st.until && st.until()) { tutorialAdvance(); return; }
  tutorialPosition();
}

// Place the spotlight over the anchor and the bubble beside it. All maths is in
// viewport px (getBoundingClientRect is already post-zoom), so nothing here has
// to know about --stage-zoom.
function tutorialPosition() {
  const st = TUTORIAL_STEPS[tutorialStepIdx];
  const E  = tutorialEls;
  const anchor = st.anchor ? st.anchor() : null;
  const PAD = 7, GAP = 16, M = 12;
  const vw = window.innerWidth, vh = window.innerHeight;

  // 'float' — no anchor, no spotlight and NO dim: the bubble just parks out of
  // the way while the player uses the whole screen normally. `corner` picks the
  // emptiest side of the layout for that step.
  if (st.side === 'float') {
    E.spot.classList.add('hidden');
    E.layer.classList.remove('veiled');
    E.arrow.style.display = 'none';
    const bw = E.bubble.offsetWidth, bh = E.bubble.offsetHeight;
    E.bubble.style.left = (st.corner === 'right' ? Math.round(vw - bw - M) : M) + 'px';
    E.bubble.style.top  = (st.corner === 'right' ? Math.round((vh - bh) / 2) : Math.round(vh - bh - M)) + 'px';
    E.shut.forEach(s => { s.style.width = '0'; s.style.height = '0'; });
    return;
  }

  if (!anchor) {                                   // centre card — no cut-out, flat dim
    E.spot.classList.add('hidden');
    E.layer.classList.add('veiled');
    E.arrow.style.display = 'none';
    const bw = E.bubble.offsetWidth, bh = E.bubble.offsetHeight;
    E.bubble.style.left = Math.round((vw - bw) / 2) + 'px';
    E.bubble.style.top  = Math.round((vh - bh) / 2) + 'px';
    E.shut.forEach(s => { s.style.left = '0'; s.style.top = '0'; s.style.width = '100%'; s.style.height = '100%'; });
    return;
  }

  // An anchor may be one element or several — several are unioned into one hole
  // (SCORE + GOAL are separate boxes in the landscape layout, for instance).
  const rects = (Array.isArray(anchor) ? anchor : [anchor]).map(e => e.getBoundingClientRect());
  const r = {
    left:   Math.min(...rects.map(b => b.left)),
    top:    Math.min(...rects.map(b => b.top)),
    right:  Math.max(...rects.map(b => b.right)),
    bottom: Math.max(...rects.map(b => b.bottom)),
  };
  r.width = r.right - r.left; r.height = r.bottom - r.top;
  const hx = r.left - PAD, hy = r.top - PAD, hw = r.width + PAD * 2, hh = r.height + PAD * 2;
  E.spot.classList.remove('hidden');
  E.layer.classList.remove('veiled');
  E.spot.style.left = hx + 'px'; E.spot.style.top = hy + 'px';
  E.spot.style.width = hw + 'px'; E.spot.style.height = hh + 'px';

  // Shutters ring the hole; they're the only pointer-event catchers, so a gated
  // step blocks the whole screen EXCEPT the highlighted control.
  const S = [
    { left: 0, top: 0, width: vw, height: Math.max(0, hy) },                                  // top
    { left: 0, top: hy + hh, width: vw, height: Math.max(0, vh - hy - hh) },                  // bottom
    { left: 0, top: hy, width: Math.max(0, hx), height: hh },                                 // left
    { left: hx + hw, top: hy, width: Math.max(0, vw - hx - hw), height: hh },                 // right
  ];
  E.shut.forEach((el, i) => { const s = S[i]; el.style.left = s.left + 'px'; el.style.top = s.top + 'px'; el.style.width = s.width + 'px'; el.style.height = s.height + 'px'; });

  // Bubble placement: preferred side, flipped if it would run off-screen.
  const bw = E.bubble.offsetWidth, bh = E.bubble.offsetHeight;
  let side = st.side || 'right';
  if (side === 'right'  && hx + hw + GAP + bw > vw - M) side = 'left';
  if (side === 'left'   && hx - GAP - bw < M)           side = (hx + hw + GAP + bw <= vw - M) ? 'right' : 'bottom';
  if (side === 'bottom' && hy + hh + GAP + bh > vh - M) side = 'top';
  if (side === 'top'    && hy - GAP - bh < M)           side = 'bottom';

  let bx, by;
  if (side === 'right')       { bx = hx + hw + GAP; by = hy + hh / 2 - bh / 2; }
  else if (side === 'left')   { bx = hx - GAP - bw; by = hy + hh / 2 - bh / 2; }
  else if (side === 'bottom') { bx = hx + hw / 2 - bw / 2; by = hy + hh + GAP; }
  else                        { bx = hx + hw / 2 - bw / 2; by = hy - GAP - bh; }
  bx = Math.max(M, Math.min(vw - bw - M, bx));
  by = Math.max(M, Math.min(vh - bh - M, by));
  E.bubble.style.left = Math.round(bx) + 'px';
  E.bubble.style.top  = Math.round(by) + 'px';

  // Arrow sits on the bubble edge facing the anchor, tracking the anchor centre
  // so it still points correctly after the bubble has been clamped.
  E.arrow.style.display = '';
  E.arrow.className = 'a-' + side;
  if (side === 'right' || side === 'left') {
    E.arrow.style.top  = Math.round(Math.max(12, Math.min(bh - 12, hy + hh / 2 - by))) + 'px';
    E.arrow.style.left = '';
  } else {
    E.arrow.style.left = Math.round(Math.max(12, Math.min(bw - 12, hx + hw / 2 - bx))) + 'px';
    E.arrow.style.top  = '';
  }
}

// Tear down. Safe to call at any point (skip button, outro, mode change) — the
// run itself keeps going, it just stops being narrated.
function tutorialEnd() {
  if (!tutorialRunning) return;
  tutorialRunning = false;
  if (tutorialRaf) { cancelAnimationFrame(tutorialRaf); tutorialRaf = null; }
  tutorialHoldClock(false);
  tutorialEls?.layer.classList.remove('show', 'gated', 'veiled');
  tutorialStepIdx = -1;
  _tutShown = false;
}
