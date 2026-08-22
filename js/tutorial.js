// ══════════════════════════════════════════════
// TUTORIAL MODE — LETHE CORP ORIENTATION  (r146)
// ══════════════════════════════════════════════
// A guided first run over an ORDINARY run. MODES.tutorial sets
// `actStructure: true`, so every system is the real one (round → payout →
// reward grid → Mart), and the board is a normal random deal. The tutorial does
// not stack the deck; where it needs a specific card it FINDS one that is
// already there (see tutorialTeachingHand).
//
// Two things are pinned rather than random:
//   1. The run is SEEDED (MODES.tutorial.seed), so orientation is the same
//      experience for everyone and reproducible when something goes wrong.
//   2. The FIRST reward grid is scripted — a Trick, a liability and the Mart
//      destination in a row — because the reward step teaches the path rule by
//      making the player walk one. See tutorialScriptRewardGrid.
//
// ── Why it needs almost no hooks in engine code ──
// The step machine is POLLED, not event-driven: each step declares `when` (hold
// the step back until true) and `until` (auto-advance when true) as predicates
// over globals that already exist — `selected`, `handsPlayed`,
// `goalReachedThisRound`, `rewardSelected`, `martActive`… One rAF loop
// evaluates them. Adding or reordering steps means editing TUTORIAL_STEPS and
// nothing else. Outside this file the total footprint is:
//   · menu.js         — the MODES.tutorial entry + carousel card
//   · game-control.js — one call at the end of startGame()
//   · input.js        — suppress the 2s auto-submit on the "press PLAY" steps
//   · reward-grid.js  — one call to script the first reward grid
//
// ── Why the overlay lives OUTSIDE #stage ──
// #cabinet/#stage carry a CSS `zoom`. Anything inside them inherits it, which
// silently multiplies JS-set pixel coordinates (the bug that pushed the dev
// panel, and the ⏱ Time pop-up, off-screen). The coach-mark layer is appended
// to <body> and positioned from raw getBoundingClientRect() viewport pixels.
//
// ── The dim, the holes, and gating ──
// One full-screen `#tut-dim` whose `clip-path: path(evenodd, …)` cuts N holes
// out of it. Because a clipped-away region is not hit-testable, the holes let
// clicks through and the rest of the dim swallows them — so gating a step to
// one control, or to three specific reward tiles, is the same single mechanism.
// `pointer-events` on the dim is what switches gating on and off.

function tutorialActive() { return !!ACTIVE_MODE && ACTIVE_MODE.tutorial === true; }

let tutorialRunning  = false;
let tutorialStepIdx  = -1;
let tutorialRaf      = null;
let tutorialEls      = null;  // { layer, dim, rings, bubble, arrow, step, title, body, btns }
let _tutShown        = false; // is the current step's bubble on screen (past its `when`)?
let _tutWaitFrom     = 0;     // when the current step started waiting on `when`
let _tutClockHeld    = false; // this file's claim on gameTimerPaused
let tutorialTeachCells = null;  // the hand the board step points at, [[r,c],…]
let tutorialRewardPlan = null;  // { trick:[r,c], debuff:[r,c], dest:[r,c] } for the scripted grid
let _tutLastHoles      = [];    // last non-empty hole set, held across re-render gaps
let tutorialSwapPlan    = null; // { pair:[[r,c],[r,c]], makes:[cells] } — a swap worth making
let tutorialDiscardPlan = null; // [[r,c],…] — cards in no hand, i.e. what a discard is for
let _tutSwapMark        = 0;    // lastSwapTime when the swap step opened
let _tutDiscardMark     = 0;    // cardsDiscardedRound when the discard step opened

// ── Anchor helpers ───────────────────────────────────────────────────────────
// First VISIBLE match wins, so one step can target a landscape widget or its
// portrait equivalent without branching (#vclock → #clock-area).
// IMPORTANT: the landscape layout gives several wrappers `display: contents`
// (#score-panel, #hand-preview-area, #action-col…) — they have no box at all,
// hence the width test, and hence why the steps below anchor the real
// positioned widgets (#score-center, #selected-cards, #btn-discard…).
// NOTE: visibility is tested by the RECT ALONE, deliberately. The obvious check
// (`offsetParent !== null`) is wrong here twice over: it is null for any
// position:fixed element — which is what the Limits pop-up and the Mart's panels
// are — and a `display: contents` wrapper passes it while having no box at all.
// A zero-size rect catches display:none and display:contents together, and lets
// fixed elements through.
function tutEl(...sels) {
  for (const s of sels) {
    const el = document.querySelector(s);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) return el;
  }
  return null;
}
// Several anchors → several holes (not a union), so a step can highlight three
// separate reward tiles or SCORE + GOAL at once.
function tutEls(...sels) {
  const found = sels.map(s => tutEl(s)).filter(Boolean);
  return found.length ? found : null;
}
function tutGridCell(rc) {
  if (!rc) return null;
  return document.querySelector(`#grid [data-row="${rc[0]}"][data-col="${rc[1]}"]`);
}
function tutRewardCell(rc) {
  if (!rc) return null;
  return [...document.querySelectorAll('#grid .reward-cell')].find(e => +e.dataset.r === rc[0] && +e.dataset.c === rc[1]) || null;
}
function tutRewardPicked(rc) {
  return !!rc && rewardSelected.has(`${rc[0]}-${rc[1]}`);
}
function tutMartOpen()   { return typeof martActive !== 'undefined' && martActive; }
// `martActive` flips at the TOP of openMart, but the Mart's DOM is built behind
// the channel-change CRT transition — and mid-transition the markup EXISTS while
// being collapsed to zero size. So readiness is tested with tutEl (which demands
// a real rect), not getElementById; otherwise the first Mart step fires against a
// zero-size anchor and lands centred with no spotlight.
function tutMartReady()  { return tutMartOpen() && !!tutEl('#mart-loadout'); }
function tutRewardOpen() { return document.body.classList.contains('reward-active'); }
function tutPayoutEl()   { return document.getElementById('payout-overlay'); }
// True once every animation/dance has settled — used by `when` so a bubble never
// lands on top of the scoring dance or the round-start deal.
function tutIdle() { return !animating && !falling && !dealPhase && !danceAbortController; }

// ── The script ───────────────────────────────────────────────────────────────
// anchor:     () => Element | Element[] | null — each element gets its own hole
// side:       bubble placement: right/left/top/bottom, 'center' (veil + centred
//             card) or 'float' (no dim at all, bubble parked in a corner)
// corner:     'left' (default) | 'right' — which corner a float step parks in
// gate:       block every click outside the holes (forces the taught action)
// hold:       freeze the round clock while this step is up (read-only steps)
// noAutoPlay: suppress the 2s auto-submit so the player presses PLAY themselves
// next:       show a CONTINUE button;  actions: custom buttons instead
// when:       predicate — hold the step back until true (whenTimeoutMs escape)
// until:      predicate — auto-advance when true
// onEnter:    run once when the bubble appears
//
// VOICE: LETHE Corp staff orientation. Flat, procedural, faintly indifferent to
// the employee. No mascot, no exclamation marks, no second-person enthusiasm.
const TUTORIAL_STEPS = [
  {
    id: 'welcome', side: 'center', hold: true, next: true,
    eyebrow: 'Induction',
    title: 'Welcome, Associate',
    body: `You have been assigned to an <b>OBLIVISCORE</b> terminal.<br><br>The work is straightforward: form hands from the cards on the board, meet the quota before the clock expires, and proceed to the next assignment.<br><br>This orientation covers terminal operation and takes approximately three minutes. It may be terminated at any point, though we would prefer that it were not.`,
  },
  {
    id: 'board',
    anchor: () => tutorialTeachCells ? tutorialTeachCells.map(tutGridCell).filter(Boolean) : tutEl('#grid'),
    side: 'left', gate: true, hold: true, noAutoPlay: true,
    eyebrow: 'Module 01',
    title: 'Selecting a hand',
    body: `Cards are selected by tapping them, or by dragging across them.<br><br>Selected cards must be <b>adjacent</b> — sharing an edge. Diagonals are not recognised by the terminal.<br><br>The cards highlighted here already form a valid hand. <b>Select them.</b>`,
    onEnter: () => { selected = []; render(); },
    until: () => selected.length >= 2 && !!findBestHand(selected),
  },
  {
    id: 'valuation', anchor: () => tutEl('#score-subboxes'), side: 'bottom',
    gate: true, hold: true, next: true, noAutoPlay: true,
    eyebrow: 'Module 02',
    title: 'Valuation',
    body: `<b>PIPS</b> is drawn from the cards themselves — their face values, added up.<br><br><b>MULT</b> is set by the hand those cards form. Bigger and rarer hands multiply harder.<br><br><b>FOCUS</b> is applied on top of both.<br><br>The three are multiplied together. That product is the hand's score.`,
  },
  {
    id: 'play', anchor: () => tutEl('#btn-play'), side: 'left', gate: true, hold: true, noAutoPlay: true,
    eyebrow: 'Module 02',
    title: 'Submission',
    body: `Press <b>PLAY</b> to submit the hand for valuation.<br><br>A valid selection also submits itself after two seconds of inactivity. The terminal does not wait indefinitely.`,
    // PLAY is disabled without a valid selection and a gated step exposes only
    // PLAY — so if the selection was lost, restore it rather than strand the
    // player on a dead button.
    onEnter: () => { if (!(selected.length >= 2 && findBestHand(selected))) tutorialSelectTeachingHand(); },
    until: () => handsPlayed >= 1,
  },
  {
    id: 'focus', anchor: () => tutEl('#focus-meter-wrap'), side: 'right', hold: true, next: true,
    // Wait for the scoring dance (~6s) to finish. The layer stays hidden
    // meanwhile, so the count-up plays out undimmed.
    when: () => tutIdle() && handsPlayed >= 1,
    eyebrow: 'Module 03',
    title: 'Focus',
    body: `Focus accrues every time you submit a hand. Two factors set how much:<br><br>— the <b>complexity</b> of the hand submitted<br>— the <b>speed</b> at which you submitted it after the last one<br><br>It drains while the terminal sits idle. Sustained output is rewarded; deliberation is not.`,
  },
  {
    id: 'quota', anchor: () => tutEls('#score-center', '#score-left'), side: 'bottom', hold: true, next: true,
    eyebrow: 'Module 04',
    title: 'Quota',
    body: `Your score for the round, and the <b>quota</b> you are required to reach.<br><br>Meeting it ends the round at once. There is no premium for exceeding it, and no partial credit for approaching it.<br><br>Score resets each round. The quota does not.`,
  },
  {
    id: 'clock', anchor: () => tutEl('#vclock', '#clock-area'), side: 'bottom', hold: true, next: true,
    eyebrow: 'Module 05',
    title: 'The clock',
    body: `Submitting hands is free of charge.<br><br>Corrective action is not: a swap is billed <b>4s</b>, a discard <b>3s</b>.<br><br>Time remaining at the end of a round is converted to credits. Unused time is not wasted — it is banked.`,
  },
  {
    // Interactive. The board was audited at deal time to guarantee an exchange
    // worth making exists (see tutorialQualifyBoard), and the plan is recomputed
    // on entry because the first hand has since changed the board.
    id: 'swap',
    anchor: () => tutorialSwapPlan ? tutorialSwapPlan.pair.map(tutGridCell).filter(Boolean) : tutEl('#grid'),
    side: 'left', gate: true, hold: true, noAutoPlay: true,
    eyebrow: 'Module 05',
    title: 'Corrective action — swap',
    body: `Two cards may be exchanged if they are adjacent. <b>Double-tap</b> the first, then <b>tap</b> the second.<br><br>These two are highlighted because trading them puts a scoring hand on the board that is not there now.<br><br>A swap is billed <b>4s</b> and draws on your swap allowance.`,
    onEnter: () => {
      selected = []; swapPending = null;
      tutorialSwapPlan = tutorialFindSwap();
      _tutSwapMark = lastSwapTime;
      render();
    },
    until: () => lastSwapTime !== _tutSwapMark,
  },
  {
    // Interactive. Points at a card that is in no hand at all — which is the
    // honest case for spending a discard.
    id: 'discard',
    anchor: () => {
      const cards = (tutorialDiscardPlan || []).slice(0, 2).map(tutGridCell).filter(Boolean);
      const btn = tutEl('#btn-discard');
      return cards.length ? [...cards, btn].filter(Boolean) : tutEls('#grid', '#btn-discard');
    },
    side: 'left', gate: true, hold: true, noAutoPlay: true,
    eyebrow: 'Module 05',
    title: 'Corrective action — discard',
    body: `Cards that contribute to nothing can be returned and replaced.<br><br>The highlighted cards are in no hand on this board. <b>Select one, then press DISCARD.</b> Replacements fall in from above.<br><br>A discarded card goes to the <b>back of the deck</b> and you will see it again this round. A card you <b>score</b> is held out until the round ends. Discarding is recycling; scoring is spending.<br><br>Billed per card. Swaps and discards are both rationed per round — the remaining allowance is printed on each control.`,
    onEnter: () => {
      selected = []; swapPending = null;
      tutorialDiscardPlan = tutorialFindDeadCards();
      _tutDiscardMark = cardsDiscardedRound;
      render();
    },
    until: () => cardsDiscardedRound > _tutDiscardMark,
  },
  {
    id: 'limits-btn', anchor: () => tutEl('#btn-limits'), side: 'top', gate: true, hold: true,
    eyebrow: 'Module 06',
    title: 'Operating limits',
    body: `Every ration you have just been issued is a <b>limit</b>.<br><br>Open the <b>LIMITS</b> panel.`,
    until: () => document.getElementById('limits-popup')?.classList.contains('show'),
  },
  {
    id: 'limits-panel', anchor: () => tutEl('#limits-popup'), side: 'right', hold: true, next: true,
    eyebrow: 'Module 06',
    title: 'Your allowances',
    body: `Board size, swaps, discards, round length, Trick slots, rerolls, Focus capacity.<br><br>These are fixed for the run unless raised — purchased at the Mart, or awarded by a <b>Limit Break</b>.<br><br>Associates consistently undervalue them. A raised limit compounds across every remaining round; a single item does not.`,
    onExit: () => hideLimitsPopup(),
  },
  {
    id: 'progress', anchor: () => tutEl('#run-progress'), side: 'left', hold: true, next: true,
    eyebrow: 'Module 07',
    title: 'Assignment schedule',
    body: `Your position in the current contract.<br><br>Five assignments, then a <b>supervisor review</b>. Three acts of the same. Complete the third and your contract is fulfilled.<br><br>Quotas rise at every step. This is not negotiable.`,
  },
  {
    // Float: no dim at all. The associate has to actually work here, so the
    // board cannot sit behind a veil.
    id: 'clear', side: 'float',
    eyebrow: 'Module 08',
    title: 'Proceed',
    body: `The clock is running. Meet the quota — any hands will do.`,
    until: () => goalReachedThisRound,
  },
  {
    id: 'payout', anchor: () => tutPayoutEl(), side: 'right', next: true,
    // Wait for the "Valued." button to be REVEALED, not merely for the overlay
    // to exist: the panel spends ~6s counting up, and a bubble explaining
    // figures that have not appeared yet explains nothing.
    when: () => !!document.querySelector('#po-valued.show'),
    eyebrow: 'Module 09',
    title: 'Remuneration',
    body: `<b>Interest</b> — 10% of the credits you are holding. Balances are rewarded for existing.<br><br><b>Efficiency</b> — 1 credit for every 10 seconds left on the clock.<br><br>Acknowledge the statement to continue.`,
    until: () => !tutPayoutEl(),
  },
  {
    id: 'reward-intro', anchor: () => tutEl('#grid'), side: 'left', next: true,
    // Let the tiles finish dealing in — `rewardDealing` also gates
    // onRewardCellClick, so showing earlier would invite taps that do nothing.
    when: () => tutRewardOpen() && !rewardDealing,
    eyebrow: 'Module 10',
    title: 'Spoils',
    body: `You are not selecting an item. You are selecting a <b>path</b>.<br><br>Choose a connected run of tiles and you receive <b>everything on it</b> — including what you would rather not.<br><br>Gold assists. Red does not. Placement is not accidental: desirable material is sited behind undesirable material as a matter of policy.`,
  },
  {
    id: 'reward-types', anchor: () => tutEl('#grid'), side: 'left', next: true,
    eyebrow: 'Module 10',
    title: 'Inventory classes',
    body: `<b>Tricks</b> — permanent scoring modifiers. Your build.<br><b>Sleights</b> — physical cards inserted into your deck.<br><b>Knacks</b> — rule changes that run for the whole contract.<br><b>Limits</b> — a permanent raise to one allowance.<br><br><b>Liabilities</b> — curses, rationing, stones on the board, theft.<br><br>One tile is a <b>destination</b>. It sets your next assignment: the <b>Mart</b>, or an <b>Event</b> — a single one-off decision screen with no shopping.<br><br>Declining the grid entirely pays a flat <b>SKIP</b> fee.`,
  },
  {
    id: 'pick-trick', anchor: () => tutRewardCell(tutorialRewardPlan?.trick), side: 'left', gate: true,
    eyebrow: 'Module 10',
    title: 'Select the Trick',
    body: `Begin the path here.`,
    until: () => tutRewardPicked(tutorialRewardPlan?.trick),
  },
  {
    id: 'pick-debuff', anchor: () => tutRewardCell(tutorialRewardPlan?.debuff), side: 'left', gate: true,
    eyebrow: 'Module 10',
    title: 'The liability',
    body: `The path runs through this tile. There is no route around it.<br><br>Select it. The cost is part of the offer.`,
    until: () => tutRewardPicked(tutorialRewardPlan?.debuff),
  },
  {
    id: 'pick-dest', anchor: () => tutRewardCell(tutorialRewardPlan?.dest), side: 'left', gate: true,
    eyebrow: 'Module 10',
    title: 'Destination',
    body: `And your next assignment: the <b>Mart</b>.<br><br>Note that three tiles is your entire allowance — <b>Selection Size</b> caps the path, here and on the board.`,
    until: () => tutRewardPicked(tutorialRewardPlan?.dest),
  },
  {
    id: 'reward-confirm', anchor: () => tutEl('#btn-play'), side: 'left', gate: true,
    eyebrow: 'Module 10',
    title: 'Confirm',
    body: `Submit the path.`,
    until: () => !tutRewardOpen(),
  },
  {
    // Float over the Mart: it is a full-screen takeover, so a hole would leave
    // the bubble sitting on top of the shelves it is describing.
    id: 'mart-loadout', anchor: () => tutEl('#mart-loadout'), side: 'right', next: true,
    when: () => tutMartReady(),
    eyebrow: 'Module 11',
    title: 'The Mart — your loadout',
    body: `Everything currently issued to you: Knacks, Sleights in deck, Tricks, and your limits.<br><br>Note the Trick counter. Trick slots are finite; acquiring one beyond your allowance requires disposing of another.`,
  },
  {
    id: 'mart-catalog', side: 'float', corner: 'right', next: true,
    when: () => tutMartReady(),
    eyebrow: 'Module 11',
    title: 'Catalog',
    body: `<b>Three of the four categories</b> are stocked each visit — Tricks are always featured, the rest rotate.<br><br>Each shelf shows a slot count. Limit upgrades are priced by how far the limit has already been raised.<br><br>Prices do not fall while you deliberate.`,
  },
  {
    id: 'mart-wheel', anchor: () => tutEl('#mart-spin'), side: 'bottom', next: true,
    when: () => tutMartReady(),
    eyebrow: 'Module 11',
    title: 'Spin the Wheel',
    body: `A fixed fee buys one spin. <b>Drag the wheel</b> to throw it — release speed sets the throw, and the terminal adds a random force, so it cannot be aimed.<br><br>One space is a <b>BUST</b>. One is a jackpot. You may not leave the Mart while the wheel is turning.`,
  },
  {
    id: 'mart-checkout', anchor: () => tutEl('#mart-checkout'), side: 'left', next: true,
    when: () => tutMartReady(),
    eyebrow: 'Module 11',
    title: 'Checkout',
    body: `Click an item, or drag it, to add it to the cart.<br><br><b>Bundle discount:</b> every item after the first takes a further percentage off the whole cart, to a cap. Buying three at once is materially cheaper than buying three one at a time.<br><br>The cart is capped at your <b>Selection Size</b> — the same limit that caps a hand and a reward path.`,
  },
  {
    id: 'mart-leave', anchor: () => tutEls('#mart-reroll', '#mart-leave'), side: 'top',
    when: () => tutMartReady(),
    eyebrow: 'Module 11',
    title: 'Reroll, or leave',
    body: `<b>Reroll</b> restocks the catalog at an escalating fee.<br><br><b>Leave</b> when your business is concluded. The next round deals immediately.`,
    until: () => !tutMartOpen(),
  },
  {
    id: 'outro', side: 'center',
    when: () => !tutMartOpen() && tutIdle(),
    eyebrow: 'Induction complete',
    title: 'You are cleared for work',
    body: `<b>Round → payout → spoils → Mart</b>, repeating.<br><br>Everything not covered here — Sleights on the board, Events, supervisor reviews — is assembled from the same parts you have just used.<br><br>LETHE Corp thanks you for your attention. Please continue playing until further notice.`,
    actions: [
      { label: 'Continue this run', fn: () => tutorialEnd() },
      { label: 'Start a fresh run', fn: () => { tutorialEnd(); ACTIVE_MODE = MODES.normal; startGame(); } },
      { label: 'Main menu', fn: () => { tutorialEnd(); stopTimers(); initMainMenu(); } },
    ],
  },
];

// ── Run setup ────────────────────────────────────────────────────────────────
// Called at the very end of startGame() when the tutorial mode is active. The
// board is whatever the seed dealt — nothing is stacked. The only preparation
// is finding a hand on it to point at.
function tutorialBeginRun() {
  tutorialRewardPlan = null;
  const audit = tutorialQualifyBoard();
  // Prefer a 3-card hand for the opening lesson — a bare pair under-sells it.
  tutorialTeachCells = (audit.big[0] || audit.hands[0] || null);
  tutorialSwapPlan    = audit.swap;
  tutorialDiscardPlan = audit.dead;
  dbgEvent('info', `tutorial board ready after ${audit.tries} deal(s)`,
    { hands: audit.hands.length, threeCard: audit.big.length, dead: audit.dead.length, swap: !!audit.swap });
  render();
  tutorialStart();
}

// ── Board audit + qualification (r148) ───────────────────────────────────────
// The tutorial teaches three board actions — play a hand, swap, discard — and
// each needs the board to actually AFFORD it. Rather than stack the deck, the
// opening board is AUDITED and, if it falls short, re-dealt. Re-dealing runs off
// the seeded deck stream, so "attempt 3 of seed X" is still the same board every
// time; the run stays reproducible and the deck stays a real 52-card deck.
const TUT_BOARD_MIN_HANDS = 3;   // distinct playable hands somewhere on the board
const TUT_BOARD_TRIES     = 30;  // re-deals before giving up and taking what's there

function _tutUsable(r, c) {
  return r >= 0 && c >= 0 && r < gridRows && c < gridCols &&
         !!gridData[r]?.[c] && cardCan(gridData[r][c], 'select') && !isCellBlocked(r, c);
}
const _tutKey = cells => cells.map(([r, c]) => r * 100 + c).sort((a, b) => a - b).join(',');

// Is every card in this shape actually PULLING ITS WEIGHT?
// The obvious test — findBestHand().handCells.length === cells.length — does not
// work: detectHand happily calls {5♣ 7♠ 7♥} a "Pair", so the 5♣ is inside
// handCells while contributing nothing. Highlighting that during a lesson
// teaches precisely the wrong thing.
// Instead: a shape is clean when dropping ANY one card changes what the hand is.
// {7♠ 7♥ 5♣} → drop the 5♣ and it is still a Pair, so the 5♣ is padding.
// {7♠ 7♥ 7♦} → every 2-card subset is only a Pair, so all three are load-bearing.
// Deriving it this way needs no table of hand sizes to keep in sync.
function _tutHandIsClean(cells, handName) {
  if (cells.length <= 2) return true;
  for (let i = 0; i < cells.length; i++) {
    const sub = cells.filter((_, j) => j !== i);
    if (!isConnected(sub)) continue;
    if (detectHand(sub) === handName) return false;   // that card was doing nothing
  }
  return true;
}

// Every connected shape of 2..cap cells that forms a hand in which every card is
// load-bearing.
function tutorialScanHands(cap) {
  cap = cap || Math.min(3, limits.selection.current);
  const seen = new Set(), out = [];
  const grow = (cells) => {
    if (cells.length >= 2) {
      const k = _tutKey(cells);
      if (seen.has(k)) return;          // this shape (and its expansions) already walked
      seen.add(k);
      const hand = detectHand(cells);
      if (hand && _tutHandIsClean(cells, hand)) out.push([...cells]);
    }
    if (cells.length >= cap) return;
    for (const [cr, cc] of cells)
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nr = cr + dr, nc = cc + dc;
        if (!_tutUsable(nr, nc) || cells.some(([a, b]) => a === nr && b === nc)) continue;
        grow([...cells, [nr, nc]]);
      }
  };
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (_tutUsable(r, c)) grow([[r, c]]);
  return out;
}

// Cards that appear in NO clean hand — dead weight, and therefore exactly what a
// discard is for. This is what the discard lesson points at.
function tutorialFindDeadCards(hands) {
  const inHand = new Set();
  (hands || tutorialScanHands()).forEach(cells => cells.forEach(([r, c]) => inHand.add(`${r}-${c}`)));
  const dead = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++)
    if (_tutUsable(r, c) && !inHand.has(`${r}-${c}`)) dead.push([r, c]);
  return dead;
}

// An adjacent exchange that CREATES a hand which is not available right now —
// i.e. a swap that is worth the 4 seconds. Returns { pair, makes } or null.
// Simulates each swap against the live gridData and restores it; findBestHand
// only reads gridData, so this is safe as long as the restore always runs.
function tutorialFindSwap() {
  const before = new Set(tutorialScanHands().map(_tutKey));
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    if (!_tutUsable(r, c)) continue;
    for (const [dr, dc] of [[0, 1], [1, 0]]) {          // right + down covers every pair once
      const nr = r + dr, nc = c + dc;
      if (!_tutUsable(nr, nc)) continue;
      const a = gridData[r][c], b = gridData[nr][nc];
      gridData[r][c] = b; gridData[nr][nc] = a;
      let made = null;
      try {
        made = tutorialScanHands().find(cells =>
          !before.has(_tutKey(cells)) &&
          cells.some(([hr, hc]) => (hr === r && hc === c) || (hr === nr && hc === nc)));
      } finally {
        gridData[r][c] = a; gridData[nr][nc] = b;       // restore no matter what
      }
      if (made) return { pair: [[r, c], [nr, nc]], makes: made };
    }
  }
  return null;
}

// Audit the current board against everything the lesson needs.
function tutorialAuditBoard() {
  const hands = tutorialScanHands();
  // Best 3-card hand first, so the opening lesson shows a Run of 3 or a Three of
  // a Kind when the board has one rather than settling for a Pair.
  const big = hands.filter(h => h.length >= 3)
    .sort((a, b) => (HAND_BASE[detectHand(b)]?.mult || 0) - (HAND_BASE[detectHand(a)]?.mult || 0));
  const dead  = tutorialFindDeadCards(hands);
  // The swap search is the expensive one (it re-scans per candidate pair), so it
  // only runs once the cheap criteria are already satisfied.
  const cheapOk = hands.length >= TUT_BOARD_MIN_HANDS && big.length >= 1 && dead.length >= 1;
  const swap = cheapOk ? tutorialFindSwap() : null;
  return { hands, big, dead, swap, ok: cheapOk && !!swap };
}

// Re-deal until the board can carry the lesson. Deterministic for a seed.
function tutorialQualifyBoard() {
  let audit = tutorialAuditBoard();
  let tries = 1;
  while (!audit.ok && tries < TUT_BOARD_TRIES) {
    initGridData();
    audit = tutorialAuditBoard();
    tries++;
  }
  audit.tries = tries;
  // If nothing qualified in TUT_BOARD_TRIES the lesson still runs — the swap and
  // discard steps fall back to "perform the action anywhere" rather than
  // pointing at a specific pair. Better a vaguer lesson than a stuck one.
  return audit;
}

// Re-select the highlighted hand (the PLAY step's safety net).
function tutorialSelectTeachingHand() {
  if (!tutorialTeachCells) return;
  selected = tutorialTeachCells.filter(([r, c]) => gridData[r]?.[c]);
  render();
}

// Gate for input.js: true while a step wants the player to press PLAY themselves.
function tutorialHoldsAutoSubmit() {
  return tutorialRunning && !!TUTORIAL_STEPS[tutorialStepIdx]?.noAutoPlay;
}

// ── Scripted first reward grid ───────────────────────────────────────────────
// Called from generateRewardContent. The reward step teaches the path rule by
// making the associate walk one, so the first grid guarantees a row of
// Trick → liability → Mart destination. The checkerboard already alternates
// buff/debuff by (r+c) parity, so [0,0] [0,1] [0,2] is exactly buff/debuff/buff:
// the plan drops straight into the existing layout without breaking it.
// Every later grid is generated normally.
function tutorialScriptRewardGrid(grid) {
  if (!tutorialActive() || tutorialRewardPlan) return grid;   // first grid only
  if (!grid[0] || grid[0].length < 3) return grid;            // tiny grid, leave it alone

  // The generator places exactly one destination somewhere random; demote it so
  // the grid does not end up with two.
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) {
    if (grid[r][c]?.kind === 'dest' && !(r === 0 && c === 2)) grid[r][c] = { kind: 'buff', payload: makeRewardTrickPayload() };
  }
  grid[0][0] = { kind: 'buff', payload: makeRewardTrickPayload() };
  grid[0][2] = { kind: 'dest', payload: { icon: '🏪', label: 'Next: Shop', tier: 'dest', apply: () => { pendingEventOverride = 'shop'; } } };
  // [0,1] is already a debuff slot by parity — leave whatever the generator rolled.
  tutorialRewardPlan = { trick: [0, 0], debuff: [0, 1], dest: [0, 2] };
  return grid;
}

// ── Coach-mark layer ─────────────────────────────────────────────────────────
// Built in JS (not index.html) so the whole tutorial is one file to delete.
function tutorialBuildLayer() {
  if (tutorialEls) return tutorialEls;
  const layer = document.createElement('div');
  layer.id = 'tut-layer';
  layer.innerHTML =
    `<div id="tut-dim"></div>` +
    `<div id="tut-rings"></div>` +
    `<div id="tut-bubble">` +
      `<div id="tut-arrow"></div>` +
      `<div id="tut-head"><span id="tut-eyebrow"></span><span id="tut-step"></span></div>` +
      `<div id="tut-title"></div>` +
      `<div id="tut-body"></div>` +
      `<div id="tut-btns"></div>` +
      `<button id="tut-skip">End orientation</button>` +
    `</div>`;
  document.body.appendChild(layer);
  layer.querySelector('#tut-skip').onclick = () => tutorialEnd();
  tutorialEls = {
    layer,
    dim:     layer.querySelector('#tut-dim'),
    rings:   layer.querySelector('#tut-rings'),
    bubble:  layer.querySelector('#tut-bubble'),
    arrow:   layer.querySelector('#tut-arrow'),
    eyebrow: layer.querySelector('#tut-eyebrow'),
    step:    layer.querySelector('#tut-step'),
    title:   layer.querySelector('#tut-title'),
    body:    layer.querySelector('#tut-body'),
    btns:    layer.querySelector('#tut-btns'),
  };
  return tutorialEls;
}

// Freeze/unfreeze the round clock. Wrapped so the tutorial only ever RELEASES a
// pause it took itself — the reward grid and the Mart own gameTimerPaused during
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
  if (prev && prev.onExit) { try { prev.onExit(); } catch (e) { console.error('[TUT] onExit', e); } }
  tutorialStepIdx++;
  _tutShown = false;
  _tutWaitFrom = performance.now();
  _tutLastHoles = [];
  if (tutorialStepIdx >= TUTORIAL_STEPS.length) { tutorialEnd(); return; }
  tutorialEls.layer.classList.remove('show');   // hidden until this step's `when` passes
  tutorialHoldClock(false);
}

function tutorialShowStep() {
  const st = TUTORIAL_STEPS[tutorialStepIdx];
  const E  = tutorialEls;
  _tutShown = true;
  E.eyebrow.textContent = st.eyebrow || '';
  E.step.textContent    = `${tutorialStepIdx + 1}/${TUTORIAL_STEPS.length}`;
  E.title.textContent   = st.title;
  E.body.innerHTML      = st.body;
  E.btns.innerHTML      = '';
  (st.actions || (st.next ? [{ label: 'Continue', fn: () => tutorialAdvance() }] : [])).forEach(a => {
    const b = document.createElement('button');
    b.className = 'tut-btn';
    b.textContent = a.label;
    b.onclick = a.fn;
    E.btns.appendChild(b);
  });
  E.layer.classList.toggle('gated', !!st.gate);
  E.layer.classList.add('show');
  if (st.hold) tutorialHoldClock(true);
  if (st.onEnter) { try { st.onEnter(); } catch (e) { console.error('[TUT] onEnter', e); } }
  tutorialPosition();
}

// Per-frame: run the state machine and keep the holes glued to their anchors.
function tutorialLoop() {
  if (!tutorialRunning) return;
  tutorialRaf = requestAnimationFrame(tutorialLoop);
  const st = TUTORIAL_STEPS[tutorialStepIdx];
  if (!st) return;
  // Waiting on `when`. The escape hatch matters: a predicate that never flips
  // (an animation stalled in a background tab, an overlay closed in an
  // unexpected order) would otherwise leave the orientation silently dead with
  // the player unaware it was ever running. Show it anyway after a beat.
  if (!_tutShown) {
    const waited = performance.now() - _tutWaitFrom;
    if (!st.when || st.when() || waited > (st.whenTimeoutMs || 20000)) tutorialShowStep();
    return;
  }
  if (st.until && st.until()) { tutorialAdvance(); return; }
  tutorialPosition();
}

// ── Placement ────────────────────────────────────────────────────────────────
// All maths is in viewport px (getBoundingClientRect is already post-zoom), so
// nothing here has to know about --stage-zoom.
const TUT_PAD = 7, TUT_GAP = 16, TUT_MARGIN = 12;

function tutorialPosition() {
  const st = TUTORIAL_STEPS[tutorialStepIdx];
  const E  = tutorialEls;
  const vw = window.innerWidth, vh = window.innerHeight;
  const bw = E.bubble.offsetWidth, bh = E.bubble.offsetHeight;

  // 'float' — no dim at all: the player uses the whole screen normally and the
  // bubble parks in whichever corner that screen leaves empty.
  if (st.side === 'float') {
    E.dim.style.clipPath = 'none';
    E.layer.classList.add('nodim');
    E.rings.innerHTML = '';
    E.arrow.style.display = 'none';
    E.bubble.style.left = (st.corner === 'right' ? Math.round(vw - bw - TUT_MARGIN) : TUT_MARGIN) + 'px';
    E.bubble.style.top  = (st.corner === 'right' ? Math.round((vh - bh) / 2) : Math.round(vh - bh - TUT_MARGIN)) + 'px';
    return;
  }
  E.layer.classList.remove('nodim');

  const anchor = st.anchor ? st.anchor() : null;
  const list = anchor ? (Array.isArray(anchor) ? anchor : [anchor]) : [];
  let holes = list.map(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left - TUT_PAD, y: r.top - TUT_PAD, w: r.width + TUT_PAD * 2, h: r.height + TUT_PAD * 2 };
  }).filter(h => h.w > 4 && h.h > 4);

  // Anchors can vanish for a frame or two mid-re-render — the Mart rebuilds its
  // whole DOM behind the channel-change transition, for instance. Without this
  // the spotlight would collapse and the bubble would snap to screen centre and
  // back. A step that HAS an anchor keeps its last known holes through the gap;
  // only a step with no anchor at all falls through to the centred card.
  if (!holes.length && st.anchor && _tutLastHoles.length) holes = _tutLastHoles;
  if (holes.length) _tutLastHoles = holes;

  // The dim is one element; its holes are cut with an evenodd clip-path. A
  // clipped-away region is not hit-testable, so the holes pass clicks through
  // and the remaining dim swallows them — which is the whole gating mechanism.
  if (!holes.length) {
    E.dim.style.clipPath = 'none';
    E.rings.innerHTML = '';
    E.arrow.style.display = 'none';
    E.bubble.style.left = Math.round((vw - bw) / 2) + 'px';
    E.bubble.style.top  = Math.round((vh - bh) / 2) + 'px';
    return;
  }
  const outer = `M0 0 H${vw} V${vh} H0 Z`;
  const cut = holes.map(h => `M${h.x} ${h.y} H${h.x + h.w} V${h.y + h.h} H${h.x} Z`).join(' ');
  E.dim.style.clipPath = `path(evenodd, '${outer} ${cut}')`;

  // Rings are purely decorative outlines over each hole (border-radius + glow,
  // which a clip-path cannot give you). Rebuilt only when the count changes.
  if (E.rings.children.length !== holes.length) {
    E.rings.innerHTML = holes.map(() => '<div class="tut-ring"></div>').join('');
  }
  holes.forEach((h, i) => {
    const el = E.rings.children[i];
    el.style.left = h.x + 'px'; el.style.top = h.y + 'px';
    el.style.width = h.w + 'px'; el.style.height = h.h + 'px';
  });

  // Bubble goes beside the bounding box of all the holes, flipped if it would
  // run off-screen.
  const bx0 = Math.min(...holes.map(h => h.x)), by0 = Math.min(...holes.map(h => h.y));
  const bx1 = Math.max(...holes.map(h => h.x + h.w)), by1 = Math.max(...holes.map(h => h.y + h.h));
  const hw = bx1 - bx0, hh = by1 - by0;

  let side = st.side || 'right';
  if (side === 'right'  && bx1 + TUT_GAP + bw > vw - TUT_MARGIN) side = 'left';
  if (side === 'left'   && bx0 - TUT_GAP - bw < TUT_MARGIN)      side = (bx1 + TUT_GAP + bw <= vw - TUT_MARGIN) ? 'right' : 'bottom';
  if (side === 'bottom' && by1 + TUT_GAP + bh > vh - TUT_MARGIN) side = 'top';
  if (side === 'top'    && by0 - TUT_GAP - bh < TUT_MARGIN)      side = 'bottom';

  let x, y;
  if (side === 'right')       { x = bx1 + TUT_GAP;            y = by0 + hh / 2 - bh / 2; }
  else if (side === 'left')   { x = bx0 - TUT_GAP - bw;       y = by0 + hh / 2 - bh / 2; }
  else if (side === 'bottom') { x = bx0 + hw / 2 - bw / 2;    y = by1 + TUT_GAP; }
  else                        { x = bx0 + hw / 2 - bw / 2;    y = by0 - TUT_GAP - bh; }
  x = Math.max(TUT_MARGIN, Math.min(vw - bw - TUT_MARGIN, x));
  y = Math.max(TUT_MARGIN, Math.min(vh - bh - TUT_MARGIN, y));
  E.bubble.style.left = Math.round(x) + 'px';
  E.bubble.style.top  = Math.round(y) + 'px';

  // Arrow sits on the bubble edge facing the anchor, tracking the anchor centre
  // so it still points correctly after the bubble has been clamped.
  E.arrow.style.display = '';
  E.arrow.className = 'a-' + side;
  if (side === 'right' || side === 'left') {
    E.arrow.style.top  = Math.round(Math.max(14, Math.min(bh - 14, by0 + hh / 2 - y))) + 'px';
    E.arrow.style.left = '';
  } else {
    E.arrow.style.left = Math.round(Math.max(14, Math.min(bw - 14, bx0 + hw / 2 - x))) + 'px';
    E.arrow.style.top  = '';
  }
}

// Tear down. Safe at any point (skip button, outro, mode change) — the run
// itself keeps going, it just stops being narrated.
function tutorialEnd() {
  if (!tutorialRunning) return;
  tutorialRunning = false;
  if (tutorialRaf) { cancelAnimationFrame(tutorialRaf); tutorialRaf = null; }
  tutorialHoldClock(false);
  tutorialEls?.layer.classList.remove('show', 'gated', 'nodim');
  tutorialStepIdx = -1;
  _tutShown = false;
}
