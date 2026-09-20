// ══════════════════════════════════════════════
// TUTORIAL MODE - LETHE CORP ORIENTATION  (r146)
// ══════════════════════════════════════════════
// A guided first run over an ORDINARY run. MODES.tutorial sets
// `actStructure: true`, so every system is the real one (round → payout →
// reward grid → Shop), and the board is a normal random deal. The tutorial does
// not stack the deck; where it needs a specific card it FINDS one that is
// already there (see tutorialTeachingHand).
//
// Two things are pinned rather than random:
//   1. The run is SEEDED (MODES.tutorial.seed), so orientation is the same
//      experience for everyone and reproducible when something goes wrong.
//   2. The FIRST reward grid is scripted - a Trick, a liability and the Shop
//      destination in a row - because the reward step teaches the path rule by
//      making the player walk one. See tutorialScriptRewardGrid.
//
// ── Why it needs almost no hooks in engine code ──
// The step machine is POLLED, not event-driven: each step declares `when` (hold
// the step back until true) and `until` (auto-advance when true) as predicates
// over globals that already exist - `selected`, `handsPlayed`,
// `goalReachedThisRound`, `rewardSelected`, `shopGridActive`… One rAF loop
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

// ── A WALKTHROUGH BELONGS TO A MODE'S FIRST RUN (r283) ──────────────────────
// Owner: "The first time you select a given mode, the first seed you should play
// should be the tutorial."
//
// So this is no longer one mode called Orientation. `tutorialArmed` is LATCHED in
// startGame, above markModeStarted, because modeNeedsTutorial() means "never
// played" and that line makes it false forever - a live read later in the run
// would always say no. Everything outside this file already asks
// `tutorialActive()` (game-control, save, insights, reward-grid), so reaching
// every mode cost one predicate rather than N call sites.
let tutorialArmed = false;
function tutorialArmForRun() {
  tutorialArmed = !!(ACTIVE_MODE && ACTIVE_MODE.tutorial === true);
  if (tutorialArmed) return;
  // Switched off in Settings -> Help, or already played once.
  if (typeof SETTINGS !== 'undefined' && SETTINGS.walkthrough === false) return;
  if (typeof modeNeedsTutorial === 'function') tutorialArmed = modeNeedsTutorial(ACTIVE_MODE && ACTIVE_MODE.id);
}
function tutorialActive() { return tutorialArmed; }

// One pinned seed per mode, so everyone's first Schedule is the same board.
// A mode absent from the table takes whatever seed the run would otherwise use.
const TUTORIAL_SEEDS = {
  map:      'LETHE-SCHEDULE',
  survival: 'LETHE-SURVIVAL',
  guided:   'LETHE-GUIDED',
  normal:   'LETHE-INDUCTION',
  sixsuits: 'LETHE-SIXSUITS',
  spectrum: 'LETHE-SPECTRUM',
  flow:     'LETHE-FLOW',
};
function tutorialRunSeed() {
  if (!tutorialArmed) return null;
  return TUTORIAL_SEEDS[ACTIVE_MODE && ACTIVE_MODE.id] || null;
}

// ── ONE SCRIPT, FILTERED BY MODE ────────────────────────────────────────────
// A step may carry `only: 'map'` / `only: ['map','guided']` or `not: [...]`.
// One table rather than a script per mode: the opening two thirds is identical
// everywhere (a board, a hand, the clock, Records) and only the BETWEEN-ROUNDS
// part differs, so composing separate scripts would be three copies of the same
// twelve steps waiting to drift.
//
// **A step is filtered on the MODE, never on what the player might do.** The
// modes reach their screens in an order the script cannot predict - the Schedule
// is a board you navigate - so anything optional is left to the TIPS
// (js/insights.js), which fire on the screen itself whenever it is first
// reached. That split is why this script can stay linear.
//
// ── AND IT FILTERS ON FLAGS, NOT ON THE MODE'S NAME ─────────────────────────
// `only: 'map'` used to mean `ACTIVE_MODE.id === 'map'`, which the PICKER breaks
// by construction: a custom run's id is `custom` whatever it plays like, so a
// player who built a Survival-shaped run would have been walked through the
// reward grid and the shop, neither of which that run ever opens. A picker-built
// mode carries the SAME FLAGS the hand-written modes do (js/picker-mode.js), so
// tagging off the flags classifies it correctly for free.
//
// The tags a step may ask for:
//   map · guided · survival · flow   the mode's own shape, from its flags
//   clocked / noclock                is there a round clock that can end a round
//   picks / crossroads / rewardgrid  WHICH between-rounds screen this run uses
//   payout                           does a cleared round show the payout panel
//   nodes                            the 5-rounds-then-a-review structure
// A mode's own id is a tag too, so `only: 'spectrum'` still works for anything
// that really is about one named mode.
function tutModeTags() {
  const m = ACTIVE_MODE || {};
  const t = new Set([m.id || 'normal']);
  if (m.map)      t.add('map');
  if (m.guided)   t.add('guided');
  if (m.survival) t.add('survival');   // Flow carries this too - see MODES.flow
  if (m.flow)     t.add('flow');

  // A round clock the round can END on. Asked through `roundClockEndsRound()`
  // rather than re-derived here: that is the ONE answer (js/round-timers.js) and
  // it already knows about Flow's countdown-to-the-inspection and about a picker
  // run built with the clock switched off. A second copy of the rule is exactly
  // how the Time pop-up and the charge sites drifted apart before r151. Safe to
  // call at build time - the only case it answers differently is during a boss,
  // and no walkthrough is composed on a boss round.
  let clocked = true;
  try { if (typeof roundClockEndsRound === 'function') clocked = !!roundClockEndsRound(); } catch (e) {}
  t.add(clocked ? 'clocked' : 'noclock');

  // Exactly ONE between-rounds shape. The Schedule pays its cleared levels
  // through the same pick-of-three Survival uses (r281), which is why they
  // share a tag and a step.
  t.add(t.has('guided') ? 'crossroads' : (t.has('map') || t.has('survival')) ? 'picks' : 'rewardgrid');

  // Survival and Flow pay from the level-up and have no payout panel at all.
  if (!t.has('survival')) t.add('payout');
  // The quarter structure: five rounds then a review. The Schedule and Guided
  // are act modes too but present their own shape instead.
  if (m.actStructure && !t.has('map') && !t.has('guided') && !t.has('survival')) t.add('nodes');
  return t;
}
function _tutStepApplies(st, tags) {
  const as = x => Array.isArray(x) ? x : [x];
  if (st.only && !as(st.only).some(v => tags.has(v))) return false;
  if (st.not  &&  as(st.not).some(v => tags.has(v))) return false;
  return true;
}
// CACHED FOR THE RUN, not recomputed per frame. Five sites index into it by
// number, so the array has to be the same array every time they look.
let _tutSteps = [];
function tutorialScript() { return _tutSteps.length ? _tutSteps : TUTORIAL_STEPS; }
function tutorialBuildScript() {
  const tags = tutModeTags();
  _tutSteps = TUTORIAL_STEPS.filter(st => _tutStepApplies(st, tags));
  return _tutSteps;
}

// Prose is stored in the GAMER vocabulary and swapped on the way to the screen
// by infoText() (js/info-hub.js), exactly as every entity description and every
// tip is - so Settings -> Display -> Wording moves the walkthrough too, with no
// second copy of the script. `{trick}` / `{GOAL}` placeholders resolve there.
function tutText(v) {
  const raw = (typeof v === 'function') ? v() : v;
  return (typeof infoText === 'function') ? infoText(raw) : String(raw == null ? '' : raw);
}

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
// r232: the live shop is the on-grid shop (js/shop-grid-preview.js), not the
// Mart overlay. Readiness is tested with tutEl (which demands a real rect) on a
// dealt shop tile, not on the flag alone - the tiles deal in with a fall
// animation and a zero-size anchor lands the bubble centred with no spotlight.
function tutShopOpen()   { return typeof shopGridActive !== 'undefined' && shopGridActive; }
function tutShopReady()  { return tutShopOpen() && !!tutEl('#grid .shop-tile'); }
function tutRewardOpen() { return document.body.classList.contains('reward-active'); }
function tutPayoutEl()   { return document.getElementById('payout-overlay'); }
// True once every animation/dance has settled - used by `when` so a bubble never
// lands on top of the scoring dance or the round-start deal.
function tutIdle() { return !animating && !falling && !dealPhase && !danceAbortController; }

// ── WHICH SCREEN IS UP (r283) ───────────────────────────────────────────────
// The shared round steps have to WAIT for a live board, because the modes do not
// all open on one. The Schedule puts its map over the dealt board before a card
// is played (mapBeginRun), so without this the "select these cards" step would
// land on the map. One predicate on the shared steps makes the linear script
// self-sequencing on every mode instead of needing a script per mode.
function tutMapOpen()  { return document.body.classList.contains('map-active'); }
// `gp-active` means THE BOARD IS TAKEN OVER, not "the pick-of-three is up" - the
// TILED PAYOUT goes through the same gridScreenTakeover (js/grid-pick.js), so it
// carries the class for the whole of its count-up. Testing the class for the
// pick made Classic's payout read as a pick, which held every reward-grid step
// back behind a screen that was never going to open. The pick is its own tiles.
function tutBoardTaken() { return document.body.classList.contains('gp-active'); }
function tutPickOpen()   { return !!document.querySelector('#grid .gp-opt'); }
function tutRoundLive() {
  if (tutMapOpen() || tutBoardTaken()) return false;
  if (document.body.classList.contains('grid-screen')) return false;   // reward grid / shop / crossroads
  if (typeof gridData === 'undefined' || !gridData.length) return false;
  if (!gridData.some(row => (row || []).some(c => c && !c._isTrick))) return false;
  return tutIdle();
}
// The interact costs are read from BAL, never typed into the prose. r151's whole
// lesson: the quoted cost and the charged cost must come from one place or they
// drift, and they already did once (the popup said 3s while the charge was 6s).
function tutSwapCost()    { return (BAL._resources && BAL._resources.swap_seconds) || 8; }
function tutDiscardCost() { return (BAL._resources && BAL._resources.discard_seconds_per_card) || 3; }
// Selection Size, both ends of it. Read live for the same reason the costs are:
// a limit upgrade can land before this step is reached (the reward grid's first
// five grids guarantee one), and a quoted cap that is already stale is worse
// than none. `minSelection()` is the one place the floor is worked out (r200).
function tutSelCap() { try { return limits.selection.current; } catch (e) { return 3; } }
function tutSelMin() { try { return minSelection(); } catch (e) { return 1; } }

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
  // ══ THE OPENING - every mode ══════════════════════════════════════════════
  {
    id: 'welcome', side: 'center', hold: true, next: true,
    eyebrow: 'Getting started',
    title: () => `${(ACTIVE_MODE && ACTIVE_MODE.name) || 'The game'}: first run`,
    body: `Cards fall onto a board. Select cards that touch each other, make a shape, and score it.<br><br>Reach the {GOAL} before the clock runs out. The next round asks for more.<br><br>This walkthrough runs once, on your first go at this mode.`,
  },

  // ══ THE SCHEDULE - map mode opens on its board, before a card is played ════
  {
    id: 'schedule-board', only: 'map', side: 'float', corner: 'right', next: true,
    when: () => tutMapOpen(),
    eyebrow: 'The schedule',
    title: 'Your schedule',
    body: `You work left to right through six <b>time slots</b>. Each tile is one <b>obligation</b>: a round, a shop, a meeting, a reward board.<br><br>The column at the end is the <b>manager review</b>.`,
  },
  {
    id: 'schedule-legend', only: 'map', anchor: () => tutEl('#mb-key'), side: 'top', gate: true,
    when: () => tutMapOpen() && !!tutEl('#mb-key'),
    eyebrow: 'The schedule',
    title: 'The symbols',
    body: `<b>Press the key.</b><br><br>Hovering a row lights every obligation of that kind. Tapping a tile puts its name on the bar.`,
    until: () => !!document.querySelector('#map-legend.show'),
  },
  {
    id: 'schedule-move', only: 'map', anchor: () => tutEls('#map-bar'), side: 'top', next: true,
    when: () => tutMapOpen(),
    eyebrow: 'The schedule',
    title: 'Two stops a slot',
    body: `Move up, down or forward. Never diagonal. <b>Every step you take happens.</b><br><br>You can take two obligations in one time slot if they sit next to each other. Take only one and you pay a fee to move on, and the fee rises each time.<br><br>A move that would strand you is refused.`,
  },
  {
    id: 'schedule-go', only: 'map', anchor: () => tutEls('#grid .map-tile', '#mb-confirm'), side: 'top', next: true,
    when: () => tutMapOpen(),
    eyebrow: 'The schedule',
    title: 'Pick your first stop',
    body: `Tap an obligation you can reach, then <b>CONFIRM</b>.<br><br>The first slot is all rounds.`,
    until: () => !tutMapOpen(),
  },

  // ══ THE BOARD - every mode, once a round is actually live ═════════════════
  {
    id: 'board',
    anchor: () => tutorialTeachCells ? tutorialTeachCells.map(tutGridCell).filter(Boolean) : tutEl('#grid'),
    side: 'left', gate: true, hold: true, noAutoPlay: true,
    when: () => tutRoundLive(),
    eyebrow: 'Basics',
    title: 'Selecting cards',
    body: `Tap cards to select them, or drag across them.<br><br>Selected cards must touch edge to edge. Diagonals do not connect. Tap order does not matter.<br><br>The highlighted cards make a hand. <b>Select them.</b>`,
    onEnter: () => { selected = []; render(); },
    until: () => selected.length >= 2 && !!findBestHand(selected),
  },
  {
    // r284: the owner's framing. All 19 hand types are three families, and the
    // flush OVERLAY is the one rule a new player cannot guess at.
    id: 'hands', anchor: () => tutEls('#hand-name', '#selected-cards'), side: 'bottom',
    gate: true, hold: true, next: true, noAutoPlay: true,
    eyebrow: 'Basics',
    title: 'What you can play',
    body: `<b>Set</b> - cards of the same rank. A pair counts.<br><b>Run</b> - three or more ranks in a row.<br><b>Flush</b> - five cards of one suit.<br><br>Three or four cards of one suit is not a hand on its own. Play them inside another hand and they add a flush on top, and every card in that flush scores twice.`,
  },
  {
    id: 'valuation', anchor: () => tutEl('#score-subboxes'), side: 'bottom',
    gate: true, hold: true, next: true, noAutoPlay: true,
    eyebrow: 'Scoring',
    title: 'How a hand scores',
    body: `<b>{PIPS}</b> - your cards' values added up, plus a bonus for the shape. Ace is 11, face cards are 10.<br><br><b>{MULT}</b> - set by the shape. Bigger shapes multiply more.<br><br><b>{FOCUS}</b> - multiplies on top.<br><br>{PIPS} x {MULT} x {FOCUS} is your score for the hand.`,
  },
  {
    id: 'play', anchor: () => tutEl('#btn-play'), side: 'left', gate: true, hold: true, noAutoPlay: true,
    eyebrow: 'Scoring',
    title: 'Playing a hand',
    body: `Press <b>PLAY</b>.<br><br>A valid selection also plays itself after two seconds if you leave it alone.`,
    // PLAY is disabled without a valid selection and a gated step exposes only
    // PLAY - so if the selection was lost, restore it rather than strand the
    // player on a dead button.
    onEnter: () => { if (!(selected.length >= 2 && findBestHand(selected))) tutorialSelectTeachingHand(); },
    until: () => handsPlayed >= 1,
  },
  {
    id: 'passengers', anchor: () => tutEls('#hand-name', '#selected-cards'), side: 'bottom',
    hold: true, next: true,
    when: () => tutRoundLive(),
    eyebrow: 'Basics',
    title: 'Every card must be used',
    body: `Select five cards where only four make a shape and the fifth is <b>dropped</b>. You lose its pips and the card.<br><br>A card about to be dropped turns red on the board, and the label beside the hand shows what it costs.`,
  },
  {
    // r284: Selection Size is a cap AND a floor, and nothing on screen says so
    // until the floor bites.
    id: 'selection', anchor: () => tutEls('#sel-count', '#sel-display', '#hand-name'), side: 'bottom',
    hold: true, next: true,
    when: () => tutRoundLive(),
    eyebrow: 'Basics',
    title: 'Selection Size',
    body: () => {
      const cap = tutSelCap(), min = tutSelMin();
      return `Your Selection Size is <b>${cap}</b>. That is the most cards you can put in one hand.<br><br>`
           + (min > 2
              ? `It carries a floor with it: you must commit at least <b>${min}</b>. Under that the hand label reads NEED.<br><br>`
              : `Raising it also raises a floor - the most you can select, minus two - so bigger hands become the minimum as well as the maximum.<br><br>`)
           + `The count beside the board is what you have selected over what this screen will take.`;
    },
  },
  {
    id: 'focus', anchor: () => tutEl('#focus-meter-wrap'), side: 'right', hold: true, next: true,
    eyebrow: 'Focus',
    title: 'The {FOCUS} meter',
    body: `{FOCUS} multiplies every hand you score.<br><br>It goes up when you play a bigger shape, and when you play soon after the last hand.<br><br>It drains while you sit still.`,
  },
  {
    id: 'quota', anchor: () => tutEls('#score-center', '#score-left'), side: 'bottom', hold: true, next: true,
    eyebrow: 'Scoring',
    title: 'Score and goal',
    body: `Your score this round, and the {GOAL} you need.<br><br>Hit the {GOAL} and the round ends at once. Miss it and the run is over.<br><br>Score resets every round. The {GOAL} goes up.`,
  },
  {
    id: 'clock', anchor: () => tutEl('#vclock', '#clock-area'), side: 'bottom', hold: true, next: true,
    not: 'noclock',
    eyebrow: 'The clock',
    title: 'The clock',
    body: () => `Playing a hand is free.<br><br>A swap costs <b>${tutSwapCost()}s</b>. A discard costs <b>${tutDiscardCost()}s</b> per card.<br><br>Time left when you clear the round is paid out in credits.`,
  },
  {
    // Interactive. The board was audited at deal time to guarantee an exchange
    // worth making exists (see tutorialQualifyBoard), and the plan is recomputed
    // on entry because the first hand has since changed the board.
    id: 'swap',
    anchor: () => tutorialSwapPlan ? tutorialSwapPlan.pair.map(tutGridCell).filter(Boolean) : tutEl('#grid'),
    side: 'left', gate: true, hold: true, noAutoPlay: true,
    when: () => tutRoundLive(),
    eyebrow: 'The clock',
    title: 'Swapping two cards',
    body: () => `Two touching cards can trade places. <b>Double-tap</b> the first, then <b>tap</b> the second.<br><br>Swap the two highlighted cards. It makes a hand that is not on the board yet.<br><br>Costs <b>${tutSwapCost()}s</b> and one swap.`,
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
    when: () => tutRoundLive(),
    eyebrow: 'The clock',
    title: 'Discarding cards',
    body: () => `The highlighted cards are in no hand on this board. <b>Select one and press DISCARD.</b> Replacements fall in from above.<br><br>A discarded card goes to the back of the deck and comes round again this round. A card you score is set aside until the round ends.<br><br>Costs <b>${tutDiscardCost()}s</b> per card. The number you have left is printed on each button.`,
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
    id: 'tooltips', anchor: () => tutEl('#grid'), side: 'left', hold: true, next: true,
    eyebrow: 'Reading the game',
    title: 'Reading anything on screen',
    body: `Hover with a mouse, or tap on a phone. That works on a {trick} in your tray, a {knack} chip, and any tile on a reward board or in the shop.<br><br>On the play board a tap selects a card, so press and hold there instead.`,
  },
  {
    // r284: limits are where most upgrades land, and the word meant nothing.
    id: 'limits', anchor: () => tutEls('#btn-records', '#swap-indicator'), side: 'left',
    hold: true, next: true,
    eyebrow: 'What you own',
    title: 'Limits',
    body: `Limits are your allowances for the run. Most upgrades you buy raise one:<br><br><b>Selection Size</b> - cards per hand<br><b>Grid Rows</b> and <b>Grid Columns</b> - the size of the board<br><b>Swaps</b> and <b>Discards</b> - your stock each round<br><b>Starting Time</b> - seconds on the clock<br><b>{Trick} Slots</b> - how many you can hold<br><b>{FOCUS} Cap</b> - how high {FOCUS} goes<br><b>Luck</b> - how often rarer things are offered<br><br>RECORDS &rsaquo; Limits lists every one with its ceiling.`,
  },
  {
    id: 'tricks-cap', anchor: () => tutEls('#trick-tray-count', '#trick-tray-list'), side: 'left',
    hold: true, next: true,
    eyebrow: 'What you own',
    title: '{Trick} slots',
    body: `{Tricks} are permanent scoring bonuses. They sit in the tray, not on the board.<br><br>The count beside the tray is how many you hold over how many you can hold. When it is full, a new {trick} is refused.<br><br>To make room, tap a {trick} in the tray and sell it.`,
  },
  {
    id: 'records-open', anchor: () => tutEl('#btn-records'), side: 'top', gate: true, hold: true,
    eyebrow: 'Records',
    title: 'Open RECORDS',
    body: `<b>Press RECORDS.</b> The clock stops while it is open.`,
    until: () => !!recordsOpen,
  },
  {
    // ONE step for all six tabs (owner's call): point at the row, name what is
    // behind it, do not walk through them. The handbook is the long version.
    id: 'records-tabs', anchor: () => tutEls('#records-tabs', '#records-panel'), side: 'left',
    hold: true, next: true,
    eyebrow: 'Records',
    title: 'Six tabs',
    body: `<b>Deck</b> - every card and where it is.<br><b>Hands</b> - what each shape pays.<br><b>Owned</b> - your {tricks}, {sleights} and {knacks}.<br><b>Limits</b>, <b>Time</b> and <b>Performance</b> - your allowances, where the clock went, and how the run is going.<br><br>Have a look, then close it.`,
    onExit: () => { if (recordsOpen) closeRecords(); },
  },
  {
    id: 'progress', anchor: () => tutEl('#run-progress', '#run-progress-pt'), side: 'left', hold: true, next: true,
    only: 'nodes',
    eyebrow: 'The run',
    title: 'Where you are',
    body: () => `Five rounds, then a <b>manager review</b>. ${(typeof QUARTERS_PER_RUN === 'number') ? QUARTERS_PER_RUN : 4} sets of that wins the run.<br><br>The {GOAL} goes up every round.`,
  },
  {
    id: 'progress-endless', only: 'survival', side: 'float', next: true,
    eyebrow: 'The run',
    title: 'No last round',
    body: `Clear a {GOAL}, take a reward, get a bigger {GOAL}.<br><br>It keeps going until you miss one. A review arrives every few minutes.`,
  },
  {
    id: 'clear', side: 'float',
    eyebrow: 'Your turn',
    title: 'Go',
    body: `Reach the {GOAL}. Any hands will do.`,
    until: () => goalReachedThisRound,
  },

  // ══ BETWEEN ROUNDS ════════════════════════════════════════════════════════
  {
    // Survival and Flow have no payout screen at all - they pay from the level-up.
    id: 'payout', anchor: () => tutPayoutEl(), side: 'right', next: true,
    only: 'payout',
    // Wait for the "Valued." button to be REVEALED, not merely for the overlay
    // to exist: the panel spends ~6s counting up, and a bubble explaining
    // figures that have not appeared yet explains nothing.
    when: () => !!document.querySelector('#po-valued.show'),
    eyebrow: 'Payout',
    title: 'End of round pay',
    body: () => `<b>Interest</b> - 10% of the credits you are holding.<br><br><b>Efficiency</b> - 1 credit for every <b>${(typeof efficiencySecondsPerCoin === 'function') ? efficiencySecondsPerCoin() : EFFICIENCY_SECONDS_PER_COIN} seconds</b> left on the clock.<br><br><b>Unspent</b> - every swap and discard you did not use.`,
    until: () => !tutPayoutEl(),
  },
  {
    // r284, owner's call: take a beat on the first reward screen and name the
    // three things you can own. Placed before BOTH reward screens - the reward
    // grid and the pick-of-three are mutually exclusive in a composed script,
    // so one step covers whichever this mode uses.
    // Guided has neither reward screen in its linear script, so it takes the
    // beat on the CROSSROADS - the screen where it first spends on an entity.
    id: 'entities', only: ['rewardgrid', 'picks', 'crossroads'],
    anchor: () => tutEl('#grid'), side: 'left', next: true,
    when: () => tutPickOpen()
             || (tutRewardOpen() && !rewardDealing)
             || (tutModeTags().has('crossroads')
                 && document.body.classList.contains('grid-screen') && tutIdle()),
    eyebrow: 'Rewards',
    title: 'Three things you can own',
    body: `<b>{Tricks}</b> usually raise your score. They sit in the tray and fire on their own.<br><br><b>{Knacks}</b> are permanent rule changes for the rest of the run.<br><br><b>{Sleights}</b> are part of your deck and fall onto the board like cards. They give all sorts of bonuses, and most need something done to them: played in a hand, double-tapped, swapped or discarded.`,
  },
  {
    // The pick-of-three is the reward loop in the Schedule, Survival and Flow.
    id: 'pick-three', only: 'picks',
    anchor: () => tutEls('#grid .gp-opt'), side: 'top', next: true,
    when: () => tutPickOpen(),
    eyebrow: 'Rewards',
    title: 'Take your pick',
    body: `Three offers. You take one.<br><br>A tap reads an option. Press <b>CONFIRM</b> to take it.<br><br>Rerolls come out of a pool you carry for the whole run.`,
    until: () => !tutPickOpen(),
  },
  {
    id: 'crossroads', only: 'crossroads', anchor: () => tutEl('#grid'), side: 'left', next: true,
    when: () => document.body.classList.contains('grid-screen') && tutIdle(),
    eyebrow: 'Between rounds',
    title: 'You choose what comes next',
    body: `Four tiles. You take one.<br><br>A <b>round</b> is free, and it is how you earn credits. Everything else costs credits and the slot.<br><br>The {GOAL} goes up either way.`,
  },
  {
    id: 'reward-intro', anchor: () => tutEl('#grid'), side: 'left', next: true,
    only: 'rewardgrid',
    // Let the tiles finish dealing in - `rewardDealing` also gates
    // onRewardCellClick, so showing earlier would invite taps that do nothing.
    when: () => tutRewardOpen() && !rewardDealing,
    eyebrow: 'Rewards',
    title: 'You are picking a path',
    body: `Choose a connected run of tiles and you get <b>every tile on it</b>.<br><br>Gold tiles help you. Red tiles hurt.<br><br>Tap any tile to read it. Tapping one you cannot reach costs you nothing.`,
  },
  {
    id: 'pick-trick', anchor: () => tutRewardCell(tutorialRewardPlan?.trick), side: 'left', gate: true,
    only: 'rewardgrid',
    eyebrow: 'Rewards',
    title: 'Start here',
    body: `<b>Tap this tile.</b>`,
    until: () => tutRewardPicked(tutorialRewardPlan?.trick),
  },
  {
    id: 'pick-debuff', anchor: () => tutRewardCell(tutorialRewardPlan?.debuff), side: 'left', gate: true,
    only: 'rewardgrid',
    eyebrow: 'Rewards',
    title: 'The bad tile',
    body: `The path has to run through this one. <b>Tap it.</b>`,
    until: () => tutRewardPicked(tutorialRewardPlan?.debuff),
  },
  {
    id: 'pick-dest', anchor: () => tutRewardCell(tutorialRewardPlan?.dest), side: 'left', gate: true,
    only: 'rewardgrid',
    eyebrow: 'Rewards',
    title: 'Where you go next',
    body: `This tile sends you to the <b>shop</b>. <b>Tap it.</b><br><br>Your Selection Size caps how many tiles one path can take.`,
    until: () => tutRewardPicked(tutorialRewardPlan?.dest),
  },
  {
    id: 'reward-confirm', anchor: () => tutEl('#btn-play'), side: 'left', gate: true,
    only: 'rewardgrid',
    eyebrow: 'Rewards',
    title: 'Confirm',
    body: `Press <b>CONFIRM</b> to take the path.`,
    until: () => !tutRewardOpen(),
  },
  {
    // The shop is the board itself: category rows dealt onto the grid.
    id: 'shop-board', anchor: () => tutEl('#grid'), side: 'left', next: true,
    only: 'rewardgrid',
    when: () => tutShopReady(),
    eyebrow: 'The shop',
    title: 'The shop',
    body: `The shop is a board too. Each row is a category: {knacks}, {tricks}, {sleights}, card upgrades and limit upgrades.<br><br>Tap a tile to read it. Tiles that touch each other are cheaper bought together.`,
  },
  {
    id: 'shop-leave', anchor: () => tutEls('#btn-play', '#btn-discard'), side: 'left',
    only: 'rewardgrid',
    when: () => tutShopReady(),
    eyebrow: 'The shop',
    title: 'Buy, then leave',
    body: `Select what you want and press <b>BUY</b>.<br><br>Reroll refreshes the shelves for a rising price. SELL flips the board to what you own.<br><br>Press <b>LEAVE</b> when you are done.`,
    until: () => !tutShopOpen(),
  },

  // ══ DONE ══════════════════════════════════════════════════════════════════
  {
    id: 'outro', side: 'center',
    when: () => !tutShopOpen() && !tutBoardTaken() && tutIdle(),
    eyebrow: 'Done',
    title: 'That is everything',
    body: `The rest of the game is built out of the parts you just used. New things explain themselves the first time they turn up.<br><br>The full handbook is in <b>Settings &rsaquo; Help</b>.`,
    actions: [
      { label: 'Play on', fn: () => tutorialEnd() },
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
  return tutorialRunning && !!tutorialScript()[tutorialStepIdx]?.noAutoPlay;
}

// ── Scripted first reward grid ───────────────────────────────────────────────
// Called from generateRewardContent. The reward step teaches the path rule by
// making the associate walk one, so the first grid guarantees a row of
// Trick → liability → Shop destination. The checkerboard already alternates
// buff/debuff by (r+c) parity, so [0,0] [0,1] [0,2] is exactly buff/debuff/buff:
// the plan drops straight into the existing layout without breaking it.
// Every later grid is generated normally.
// The scripted Trick -> liability -> destination row only makes sense where the
// walkthrough actually WALKS it. Map mode excludes destination tiles from its
// reward grids outright (r252), and Guided/Survival/Flow never run the reward
// steps, so scripting their grid would plant a tile the script never points at
// and, on the map, one whose effect is discarded unread.
// Only a run whose between-rounds screen IS the reward grid, asked the same way
// the script asks it (tutModeTags) rather than by a second list of mode names.
function tutorialScriptRewardGrid(grid) {
  if (!tutorialActive() || tutorialRewardPlan) return grid;   // first grid only
  if (!tutModeTags().has('rewardgrid')) return grid;
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
      `<button id="tut-skip">Skip the walkthrough</button>` +
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
// pause it took itself - the reward grid and the Shop own gameTimerPaused during
// their own steps and must not be un-paused from under them.
function tutorialHoldClock(on) {
  if (on === _tutClockHeld) return;
  _tutClockHeld = on;
  gameTimerPaused = on;
}

function tutorialStart() {
  if (tutorialRunning) return;
  tutorialBuildScript();
  tutorialBuildLayer();
  tutorialRunning = true;
  tutorialStepIdx = -1;
  tutorialAdvance();
  tutorialLoop();
}

function tutorialAdvance() {
  const prev = tutorialScript()[tutorialStepIdx];
  if (prev && prev.onExit) { try { prev.onExit(); } catch (e) { console.error('[TUT] onExit', e); } }
  tutorialStepIdx++;
  _tutShown = false;
  _tutWaitFrom = performance.now();
  _tutLastHoles = [];
  if (tutorialStepIdx >= tutorialScript().length) { tutorialEnd(); return; }
  tutorialEls.layer.classList.remove('show');   // hidden until this step's `when` passes
  tutorialHoldClock(false);
}

function tutorialShowStep() {
  const st = tutorialScript()[tutorialStepIdx];
  const E  = tutorialEls;
  _tutShown = true;
  E.eyebrow.textContent = st.eyebrow || '';
  E.step.textContent    = `${tutorialStepIdx + 1}/${tutorialScript().length}`;
  E.title.textContent   = tutText(st.title);
  E.body.innerHTML      = tutText(st.body);
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
  const st = tutorialScript()[tutorialStepIdx];
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
  const st = tutorialScript()[tutorialStepIdx];
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
  // DISARM (r283). `tutorialActive()` gates the scripted reward grid and, in
  // js/insights.js, every tip - so leaving it armed after the walkthrough ends
  // would script a grid for a player who skipped at step 1 and would silence
  // the tips for the whole of that first run, which is exactly the run they
  // are most useful in. The seed is read once, in startGame, well above this.
  tutorialArmed = false;
  if (tutorialRaf) { cancelAnimationFrame(tutorialRaf); tutorialRaf = null; }
  tutorialHoldClock(false);
  tutorialEls?.layer.classList.remove('show', 'gated', 'nodim');
  tutorialStepIdx = -1;
  _tutShown = false;
}
