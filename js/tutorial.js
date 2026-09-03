// ══════════════════════════════════════════════
// TUTORIAL MODE - LETHE CORP ORIENTATION  (r146)
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
//   2. The FIRST reward grid is scripted - a Trick, a liability and the Mart
//      destination in a row - because the reward step teaches the path rule by
//      making the player walk one. See tutorialScriptRewardGrid.
//
// ── Why it needs almost no hooks in engine code ──
// The step machine is POLLED, not event-driven: each step declares `when` (hold
// the step back until true) and `until` (auto-advance when true) as predicates
// over globals that already exist - `selected`, `handsPlayed`,
// `goalReachedThisRound`, `rewardSelected`, `martActive`… One rAF loop
// evaluates them. Adding or reordering steps means editing TUTORIAL_STEPS and
// nothing else. Outside this file the total footprint is:
//   · menu.js         - the MODES.tutorial entry + carousel card
//   · game-control.js - one call at the end of startGame()
//   · input.js        - suppress the 2s auto-submit on the "press PLAY" steps
//   · reward-grid.js  - one call to script the first reward grid
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
// clicks through and the rest of the dim swallows them - so gating a step to
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
let tutorialSwapPlan    = null; // { pair:[[r,c],[r,c]], makes:[cells] } - a swap worth making
let tutorialDiscardPlan = null; // [[r,c],…] - cards in no hand, i.e. what a discard is for
let _tutSwapMark        = 0;    // lastSwapTime when the swap step opened
let _tutDiscardMark     = 0;    // cardsDiscardedRound when the discard step opened

// ── Anchor helpers ───────────────────────────────────────────────────────────
// First VISIBLE match wins, so one step can target a landscape widget or its
// portrait equivalent without branching (#vclock → #clock-area).
// IMPORTANT: the landscape layout gives several wrappers `display: contents`
// (#score-panel, #hand-preview-area, #action-col…) - they have no box at all,
// hence the width test, and hence why the steps below anchor the real
// positioned widgets (#score-center, #selected-cards, #btn-discard…).
// NOTE: visibility is tested by the RECT ALONE, deliberately. The obvious check
// (`offsetParent !== null`) is wrong here twice over: it is null for any
// position:fixed element - which is what the Limits pop-up and the Mart's panels
// are - and a `display: contents` wrapper passes it while having no box at all.
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
// the channel-change CRT transition - and mid-transition the markup EXISTS while
// being collapsed to zero size. So readiness is tested with tutEl (which demands
// a real rect), not getElementById; otherwise the first Mart step fires against a
// zero-size anchor and lands centred with no spotlight.
function tutMartReady()  { return tutMartOpen() && !!tutEl('#mart-loadout'); }
function tutRewardOpen() { return document.body.classList.contains('reward-active'); }
function tutPayoutEl()   { return document.getElementById('payout-overlay'); }
// True once every animation/dance has settled - used by `when` so a bubble never
// lands on top of the scoring dance or the round-start deal.
function tutIdle() { return !animating && !falling && !dealPhase && !danceAbortController; }

// ── The script ───────────────────────────────────────────────────────────────
// anchor:     () => Element | Element[] | null - each element gets its own hole
// side:       bubble placement: right/left/top/bottom, 'center' (veil + centred
//             card) or 'float' (no dim at all, bubble parked in a corner)
// corner:     'left' (default) | 'right' - which corner a float step parks in
// gate:       block every click outside the holes (forces the taught action)
// hold:       freeze the round clock while this step is up (read-only steps)
// noAutoPlay: suppress the 2s auto-submit so the player presses PLAY themselves
// next:       show a CONTINUE button;  actions: custom buttons instead
// when:       predicate - hold the step back until true (whenTimeoutMs escape)
// until:      predicate - auto-advance when true
// onEnter:    run once when the bubble appears
//
// VOICE: plain and direct. Say what the thing does and what it costs, in the
// fewest words that stay accurate. No in-world corporate framing, no em dashes.
const TUTORIAL_STEPS = [
  {
    id: 'welcome', side: 'center', hold: true, next: true,
    eyebrow: 'Getting started',
    title: 'How this works',
    body: `Make poker hands out of cards on the board. Reach the score goal before the clock runs out, then do it again with a bigger goal.<br><br>This walkthrough takes about three minutes and covers the whole game. You can quit it any time.`,
  },
  {
    id: 'board',
    anchor: () => tutorialTeachCells ? tutorialTeachCells.map(tutGridCell).filter(Boolean) : tutEl('#grid'),
    side: 'left', gate: true, hold: true, noAutoPlay: true,
    eyebrow: 'Basics',
    title: 'Selecting cards',
    body: `Tap cards to select them, or drag across them.<br><br>Selected cards have to touch edge to edge. Diagonals do not count.<br><br>The highlighted cards already make a hand. <b>Select them.</b>`,
    onEnter: () => { selected = []; render(); },
    until: () => selected.length >= 2 && !!findBestHand(selected),
  },
  {
    id: 'valuation', anchor: () => tutEl('#score-subboxes'), side: 'bottom',
    gate: true, hold: true, next: true, noAutoPlay: true,
    eyebrow: 'Scoring',
    title: 'How a hand scores',
    body: `<b>PIPS</b> is your cards' face values added up, plus a bonus for the hand type. Ace is 11, face cards are 10.<br><br><b>MULT</b> comes from the hand type. Harder hands multiply more.<br><br><b>FOCUS</b> multiplies on top of both.<br><br>Score is pips x mult x focus.`,
  },
  {
    id: 'play', anchor: () => tutEl('#btn-play'), side: 'left', gate: true, hold: true, noAutoPlay: true,
    eyebrow: 'Scoring',
    title: 'Playing a hand',
    body: `Press <b>PLAY</b> to score the cards you selected.<br><br>A valid selection also plays itself after two seconds if you leave it alone.`,
    // PLAY is disabled without a valid selection and a gated step exposes only
    // PLAY - so if the selection was lost, restore it rather than strand the
    // player on a dead button.
    onEnter: () => { if (!(selected.length >= 2 && findBestHand(selected))) tutorialSelectTeachingHand(); },
    until: () => handsPlayed >= 1,
  },
  {
    id: 'focus', anchor: () => tutEl('#focus-meter-wrap'), side: 'right', hold: true, next: true,
    // Wait for the scoring dance (~6s) to finish. The layer stays hidden
    // meanwhile, so the count-up plays out undimmed.
    when: () => tutIdle() && handsPlayed >= 1,
    eyebrow: 'Focus',
    title: 'The Focus meter',
    body: `Focus is a multiplier on everything you score. It builds each time you play a hand, based on two things:<br><br>the hand type, since harder hands give more Focus<br>how quickly you played it after the last one<br><br>It drains while you sit still, so keep playing.`,
  },
  {
    id: 'quota', anchor: () => tutEls('#score-center', '#score-left'), side: 'bottom', hold: true, next: true,
    eyebrow: 'Scoring',
    title: 'Score and goal',
    body: `Your score this round, and the goal you need to hit.<br><br>Reaching the goal ends the round straight away. Going over it earns you nothing extra, and falling short earns you nothing at all.<br><br>Score resets to zero each round. The goal gets bigger.`,
  },
  {
    id: 'clock', anchor: () => tutEl('#vclock', '#clock-area'), side: 'bottom', hold: true, next: true,
    eyebrow: 'The clock',
    title: 'Time is the cost',
    body: `Playing a hand is free.<br><br>Fixing the board is not. A swap costs <b>8s</b>. A discard costs <b>3s</b> per card.<br><br>Time still on the clock when you finish a round is paid out as credits, so finishing fast is worth money.`,
  },
  {
    // Interactive. The board was audited at deal time to guarantee an exchange
    // worth making exists (see tutorialQualifyBoard), and the plan is recomputed
    // on entry because the first hand has since changed the board.
    id: 'swap',
    anchor: () => tutorialSwapPlan ? tutorialSwapPlan.pair.map(tutGridCell).filter(Boolean) : tutEl('#grid'),
    side: 'left', gate: true, hold: true, noAutoPlay: true,
    eyebrow: 'The clock',
    title: 'Swapping two cards',
    body: `Two touching cards can trade places. <b>Double-tap</b> the first, then <b>tap</b> the second.<br><br>These two are highlighted because swapping them creates a hand that is not on the board right now.<br><br>Costs <b>8s</b> and one of your swaps for this round.`,
    onEnter: () => {
      selected = []; swapPending = null;
      tutorialSwapPlan = tutorialFindSwap();
      _tutSwapMark = lastSwapTime;
      render();
    },
    until: () => lastSwapTime !== _tutSwapMark,
  },
  {
    // Interactive. Points at a card that is in no hand at all - which is the
    // honest case for spending a discard.
    id: 'discard',
    anchor: () => {
      const cards = (tutorialDiscardPlan || []).slice(0, 2).map(tutGridCell).filter(Boolean);
      const btn = tutEl('#btn-discard');
      return cards.length ? [...cards, btn].filter(Boolean) : tutEls('#grid', '#btn-discard');
    },
    side: 'left', gate: true, hold: true, noAutoPlay: true,
    eyebrow: 'The clock',
    title: 'Discarding cards',
    body: `Cards you cannot use can be thrown back. The highlighted ones are in no hand on this board. <b>Select one, then press DISCARD.</b> Replacements fall in from above.<br><br>A discarded card goes to the <b>back of the deck</b>, so you will see it again this round. A card you <b>score</b> is set aside until the round ends. Discarding recycles a card, scoring spends it.<br><br>Costs <b>3s</b> per card. You get a limited number of swaps and discards each round, and the number left is printed on each button.`,
    onEnter: () => {
      selected = []; swapPending = null;
      tutorialDiscardPlan = tutorialFindDeadCards();
      _tutDiscardMark = cardsDiscardedRound;
      render();
    },
    until: () => cardsDiscardedRound > _tutDiscardMark,
  },
  {
    // Nothing on the board explains itself until you ask it to, and the ask is
    // not obvious - so it gets its own step rather than a line buried in another.
    // Anchored on the board because that is where the gesture is least guessable.
    id: 'tooltips', anchor: () => tutEl('#grid'), side: 'left', hold: true, next: true,
    eyebrow: 'Reading the game',
    title: 'How to pull up a tooltip',
    body: `Anything you do not recognise will tell you what it does.<br><br>On a <b>phone or tablet</b>: press and hold it for half a second. That works on a card, a Trick or a Sleight on the board, a Trick in your tray, and the Knack chips along the top.<br><br>On a <b>computer</b>: just hover the mouse over it.<br><br>On the shop shelves and the reward grid, a single <b>tap opens the tooltip</b> instead of picking the tile, and the buttons to pin or buy live inside the tooltip. Tap anywhere else to close it.<br><br>Every tooltip also explains the coloured words inside it, so you never have to know the vocabulary first.`,
  },
  {
    id: 'limits-btn', anchor: () => tutEl('#btn-records'), side: 'top', gate: true, hold: true,
    eyebrow: 'Records',
    title: 'Open Records',
    body: `Everything you might need to look up is in one place.<br><br>Open <b>RECORDS</b> for your deck, what each hand pays, what you own, your limits and your stats. The clock stops while it is open.`,
    until: () => !!recordsOpen,
  },
  {
    id: 'limits-panel', anchor: () => tutEl('#records-panel'), side: 'left', hold: true, next: true,
    eyebrow: 'Records',
    title: 'Limits',
    body: `The <b>LIMITS</b> tab: board size, swaps, discards, round length, Trick slots, rerolls, Focus capacity.<br><br>These stay fixed for the whole run unless you raise them, either by buying an upgrade at the Mart or getting a <b>Limit Break</b>.<br><br>They are easy to underrate. A raised limit helps in every round you play after it. A single item usually does not.`,
    onEnter: () => { if (recordsOpen) recordsSwitchTab('limits'); },
  },
  {
    // Records stays OPEN across these three steps - they are three tabs of one
    // screen, so closing and reopening between them would read as three errands.
    // Only the last one closes it.
    id: 'hands-panel', anchor: () => tutEl('#records-panel'), side: 'left', hold: true, next: true,
    eyebrow: 'Records',
    title: 'What each hand is worth',
    body: `The <b>HANDS</b> tab answers "what should I be looking for".<br><br>It lists every hand type: <b>Pair</b>, <b>Two Pair</b>, <b>Three</b> and <b>Four of a Kind</b>, <b>Runs of 3 and 4</b>, a <b>Straight</b>, <b>Flushes of 3, 4 and 5</b>, a <b>Full House</b> and a <b>Straight Flush</b>. Rows marked <b>Unavailable</b> do not score in this mode.<br><br>Flushes pay least, because same suit is easy to spot without reading a single rank. Runs pay most, because you have to read every rank and put them in order. Pairs and sets sit between the two.<br><br>The <b>Score</b> column is pips x mult, and it is the number to compare. Your own cards' pips, your Tricks and your Focus all build on top of it.`,
    onEnter: () => { if (recordsOpen) recordsSwitchTab('hands'); },
  },
  {
    id: 'personnel-panel', anchor: () => tutEl('#records-panel'), side: 'left', hold: true, next: true,
    eyebrow: 'Records',
    title: 'What you own',
    body: `The <b>OWNED</b> tab lists every Trick, Sleight and Knack you have, with its full description.<br><br>Descriptions update as you play, so a Trick that grows during a run shows what it is actually paying right now, not what it said when you picked it up.<br><br>You will end up holding more of these than you can keep in your head. Check here.`,
    onEnter: () => { if (recordsOpen) recordsSwitchTab('personnel'); },
    onExit: () => closeRecords(),
  },
  {
    // Two progress blocks since r160 - landscape's box and the portrait top-bar
    // copy. tutEl takes the first VISIBLE one, so no orientation branch is needed.
    id: 'progress', anchor: () => tutEl('#run-progress', '#run-progress-pt'), side: 'left', hold: true, next: true,
    eyebrow: 'The run',
    title: 'Where you are',
    body: `Five rounds, then a <b>boss</b>. Three sets of that, and you win the run.<br><br>The goal goes up every round.`,
  },
  {
    // Float: no dim at all. The associate has to actually work here, so the
    // board cannot sit behind a veil.
    id: 'clear', side: 'float',
    eyebrow: 'Your turn',
    title: 'Go',
    body: `The clock is running. Reach the goal. Any hands will do.`,
    until: () => goalReachedThisRound,
  },
  {
    id: 'payout', anchor: () => tutPayoutEl(), side: 'right', next: true,
    // Wait for the "Valued." button to be REVEALED, not merely for the overlay
    // to exist: the panel spends ~6s counting up, and a bubble explaining
    // figures that have not appeared yet explains nothing.
    when: () => !!document.querySelector('#po-valued.show'),
    eyebrow: 'Payout',
    title: 'End of round pay',
    body: `<b>Interest</b> pays 10% of the credits you are holding, so saving up is worth something.<br><br><b>Efficiency</b> pays 1 credit for every 10 seconds left on the clock.`,
    until: () => !tutPayoutEl(),
  },
  {
    id: 'reward-intro', anchor: () => tutEl('#grid'), side: 'left', next: true,
    // Let the tiles finish dealing in - `rewardDealing` also gates
    // onRewardCellClick, so showing earlier would invite taps that do nothing.
    when: () => tutRewardOpen() && !rewardDealing,
    eyebrow: 'Rewards',
    title: 'You are picking a path',
    body: `This is not a pick-one screen. You choose a connected run of tiles and you get <b>everything on it</b>, including the parts you do not want.<br><br>Gold tiles help you. Red tiles hurt. The good ones are deliberately placed behind the bad ones, so most paths cost you something.`,
  },
  {
    id: 'reward-types', anchor: () => tutEl('#grid'), side: 'left', next: true,
    eyebrow: 'Rewards',
    title: 'What is on the grid',
    body: `<b>Tricks</b> are permanent scoring bonuses. They are most of your build.<br><b>Sleights</b> are special cards shuffled into your deck.<br><b>Knacks</b> change the rules for the rest of the run.<br><b>Limits</b> permanently raise one of your allowances.<br><br><b>Red tiles</b> are the downside: curses, fewer swaps or discards, stones stuck on the board, stolen credits.<br><br>One tile is a <b>destination</b> and decides where you go next, either the <b>Mart</b> to shop or an <b>Event</b>, which is a one-off choice screen.<br><br>You can skip the grid entirely for a flat payment.`,
  },
  {
    id: 'pick-trick', anchor: () => tutRewardCell(tutorialRewardPlan?.trick), side: 'left', gate: true,
    eyebrow: 'Rewards',
    title: 'Start here',
    body: `Tap this tile to start the path.`,
    until: () => tutRewardPicked(tutorialRewardPlan?.trick),
  },
  {
    id: 'pick-debuff', anchor: () => tutRewardCell(tutorialRewardPlan?.debuff), side: 'left', gate: true,
    eyebrow: 'Rewards',
    title: 'The bad tile',
    body: `The path has to run through this one. There is no way around it.<br><br>Tap it. Taking the downside is what pays for the tile after it.`,
    until: () => tutRewardPicked(tutorialRewardPlan?.debuff),
  },
  {
    id: 'pick-dest', anchor: () => tutRewardCell(tutorialRewardPlan?.dest), side: 'left', gate: true,
    eyebrow: 'Rewards',
    title: 'Where you go next',
    body: `This tile sends you to the <b>Mart</b>.<br><br>Three tiles is all you get. <b>Selection Size</b> caps the path here, and it caps how many cards you can put in a hand.`,
    until: () => tutRewardPicked(tutorialRewardPlan?.dest),
  },
  {
    id: 'reward-confirm', anchor: () => tutEl('#btn-play'), side: 'left', gate: true,
    eyebrow: 'Rewards',
    title: 'Confirm',
    body: `Press <b>CONFIRM</b> to take the path.`,
    until: () => !tutRewardOpen(),
  },
  {
    // Float over the Mart: it is a full-screen takeover, so a hole would leave
    // the bubble sitting on top of the shelves it is describing.
    id: 'mart-loadout', anchor: () => tutEl('#mart-loadout'), side: 'right', next: true,
    when: () => tutMartReady(),
    eyebrow: 'The Mart',
    title: 'What you are carrying',
    body: `This column is everything you own: Knacks, Sleights in your deck, Tricks, and your limits.<br><br>Watch the Trick counter. Trick slots are limited, and taking one more than you can hold means selling one first.`,
  },
  {
    id: 'mart-catalog', side: 'float', corner: 'right', next: true,
    when: () => tutMartReady(),
    eyebrow: 'The Mart',
    title: 'The shelves',
    body: `Three of the four categories are stocked each visit. Tricks are always there and the rest rotate.<br><br>Limit upgrades cost more the more times you have already raised that limit.`,
  },
  {
    id: 'mart-wheel', anchor: () => tutEl('#mart-spin'), side: 'bottom', next: true,
    when: () => tutMartReady(),
    eyebrow: 'The Mart',
    title: 'The wheel',
    body: `A flat fee buys one spin. <b>Drag the wheel</b> to throw it. How fast you release sets the spin, plus a random amount on top, so you cannot aim it.<br><br>One space is a <b>BUST</b> and one is a jackpot. You cannot leave the Mart while it is spinning.`,
  },
  {
    id: 'mart-checkout', anchor: () => tutEl('#mart-checkout'), side: 'left', next: true,
    when: () => tutMartReady(),
    eyebrow: 'The Mart',
    title: 'Buying',
    body: `Click an item, or drag it, to put it in the cart.<br><br>Every item after the first takes a further percentage off the <i>whole</i> cart, up to a cap. Buying three at once is genuinely cheaper than buying three one at a time.<br><br>The cart holds up to your <b>Selection Size</b>, the same limit that caps a hand and a reward path.`,
  },
  {
    id: 'mart-leave', anchor: () => tutEls('#mart-reroll', '#mart-leave'), side: 'top',
    when: () => tutMartReady(),
    eyebrow: 'The Mart',
    title: 'Reroll or leave',
    body: `<b>Reroll</b> restocks the shelves. It costs more each time you do it.<br><br><b>Leave</b> when you are done. The next round deals straight away.`,
    until: () => !tutMartOpen(),
  },
  {
    id: 'outro', side: 'center',
    when: () => !tutMartOpen() && tutIdle(),
    eyebrow: 'Done',
    title: 'That is the whole game',
    body: `The loop is <b>round, payout, reward grid, Mart</b>, over and over, with the goal rising each time.<br><br>What this did not cover (Sleights sitting on the board, Events, boss rounds) is built out of the same parts you just used.<br><br>Have fun.`,
    actions: [
      { label: 'Continue this run', fn: () => tutorialEnd() },
      { label: 'Start a fresh run', fn: () => { tutorialEnd(); ACTIVE_MODE = MODES.normal; startGame(); } },
      { label: 'Main menu', fn: () => { tutorialEnd(); stopTimers(); initMainMenu(); } },
    ],
  },
];

// ── Run setup ────────────────────────────────────────────────────────────────
// Called at the very end of startGame() when the tutorial mode is active. The
// board is whatever the seed dealt - nothing is stacked. The only preparation
// is finding a hand on it to point at.
function tutorialBeginRun() {
  tutorialRewardPlan = null;
  const audit = tutorialQualifyBoard();
  // Prefer a 3-card hand for the opening lesson - a bare pair under-sells it.
  tutorialTeachCells = (audit.big[0] || audit.hands[0] || null);
  tutorialSwapPlan    = audit.swap;
  tutorialDiscardPlan = audit.dead;
  dbgEvent('info', `tutorial board ready after ${audit.tries} deal(s)`,
    { hands: audit.hands.length, threeCard: audit.big.length, dead: audit.dead.length, swap: !!audit.swap });
  render();
  tutorialStart();
}

// ── Board audit + qualification (r148) ───────────────────────────────────────
// The tutorial teaches three board actions - play a hand, swap, discard - and
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
// The obvious test - findBestHand().handCells.length === cells.length - does not
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

// Cards that appear in NO clean hand - dead weight, and therefore exactly what a
// discard is for. This is what the discard lesson points at.
function tutorialFindDeadCards(hands) {
  const inHand = new Set();
  (hands || tutorialScanHands()).forEach(cells => cells.forEach(([r, c]) => inHand.add(`${r}-${c}`)));
  const dead = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++)
    if (_tutUsable(r, c) && !inHand.has(`${r}-${c}`)) dead.push([r, c]);
  return dead;
}

// An adjacent exchange that CREATES a hand which is not available right now -
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
  // If nothing qualified in TUT_BOARD_TRIES the lesson still runs - the swap and
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
  // [0,1] is already a debuff slot by parity - leave whatever the generator rolled.
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
// pause it took itself - the reward grid and the Mart own gameTimerPaused during
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

  // 'float' - no dim at all: the player uses the whole screen normally and the
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

  // Anchors can vanish for a frame or two mid-re-render - the Mart rebuilds its
  // whole DOM behind the channel-change transition, for instance. Without this
  // the spotlight would collapse and the bubble would snap to screen centre and
  // back. A step that HAS an anchor keeps its last known holes through the gap;
  // only a step with no anchor at all falls through to the centred card.
  if (!holes.length && st.anchor && _tutLastHoles.length) holes = _tutLastHoles;
  if (holes.length) _tutLastHoles = holes;

  // The dim is one element; its holes are cut with an evenodd clip-path. A
  // clipped-away region is not hit-testable, so the holes pass clicks through
  // and the remaining dim swallows them - which is the whole gating mechanism.
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

// Tear down. Safe at any point (skip button, outro, mode change) - the run
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
