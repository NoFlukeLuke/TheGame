const BUILD = "2026-10-02 · r461 · Hard Labour pays on every club; a card's x pips multiplies the whole pip total";
// ══════════════════════════════════════════════
// MODES & FEATURE FLAGS
// ══════════════════════════════════════════════
const MODES = {
  normal: {
    id: 'normal',
    name: 'Classic',
    desc: 'Four quarters. Play rounds, path through the reward grid, and defeat bosses.',
    winCondition: 'boss_defeat',
    enableBosses: true,
    enableShops: true,
    enableEvents: true,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: false,
    actStructure: true,
    challengeNode: 3,   // a challenge round as node 3 of every quarter (js/challenge-round.js)
    suitCount: 4
  },
  // Guided: an act is GUIDED_SLOTS_PER_ACT slots and then the boss, and every
  // slot is either a round you play or something you buy with it. The reward
  // grid is one of the things for sale, so it is not handed out per round and
  // its destination tile stays suppressed. See js/guided-mode.js.
  guided: {
    id: 'guided',
    name: 'Guided',
    desc: 'The four-quarter game on a set route. Every quarter runs reward grid, shop, reward grid, event, and so on into the boss - then a prize grid and two events.',
    winCondition: 'boss_defeat',
    enableBosses: true,
    enableShops: true,
    enableEvents: true,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: false,
    actStructure: true,
    suitCount: 4,
    guided: true
  },
  // The Schedule (r238, renamed r260): a quarter drawn as a 4-lane board you
  // walk one obligation at a time.
  // See js/map-mode.js for the rules; actStructure keeps the interlude/payout
  // machinery, and the map hooks intercept every routing seam Guided cut.
  map: {
    id: 'map',
    name: 'The Schedule',
    desc: 'Your quarter as a schedule: six time slots of obligations, then a manager review. Two obligations a slot at most, no diagonal moves, and everything you book happens.',
    winCondition: 'boss_defeat',
    enableBosses: true,
    enableShops: true,
    enableEvents: true,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: false,
    actStructure: true,
    suitCount: 4,
    map: true
  },
  // CRUNCH (r293): the Schedule on one act-long clock. Carries map:true, so the
  // board, its generation and every routing seam are the Schedule's untouched;
  // crunch:true is what js/crunch-mode.js reads. See that file for why the act
  // bank is roundSeconds itself rather than a parallel counter.
  crunch: {
    id: 'crunch',
    name: 'Crunch',
    desc: 'The schedule, on one clock. Thirteen minutes for the whole quarter, every obligation you book costs some of it, and the manager review is fought on whatever is left.',
    winCondition: 'boss_defeat',
    enableBosses: true,
    enableShops: true,
    enableEvents: true,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: false,
    actStructure: true,
    suitCount: 4,
    map: true,
    crunch: true
  },
  // r409: Orientation and Six Suits are retired. The walkthrough is armed on
  // every mode's first run (js/tutorial.js) and six suits is a per-mode deck
  // choice (js/deck-design.js, dev panel -> that mode's tab).
  // Spectrum: the same 3-Act game on a deck with no suits and no court cards -
  // seven COLOURS and plain values 1-15 plus a lone 20. Face/Ace Tricks are
  // filtered out of the pool (see applyModeEntityFilter in js/data/tricks.js).
  spectrum: {
    id: 'spectrum',
    name: 'Spectrum',
    desc: 'No suits, no face cards. Seven colours and the values 0-11 plus a lone 15 and 20. Runs, sets and colour flushes only.',
    winCondition: 'boss_defeat',
    enableBosses: true,
    enableShops: true,
    enableEvents: true,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: false,
    actStructure: true,
    suitCount: 7,
    numeric: true
  },
  // Climb (r398): Classic's structure on a numeric deck whose cards go up one
  // rank every time they score. See js/climb-mode.js.
  climb: {
    id: 'climb',
    name: 'Climb',
    desc: 'Four suits, values 1 to 13. Every card that scores goes up one rank, up to 15. A 15 that scores pays a large bonus and returns to its starting rank.',
    winCondition: 'boss_defeat',
    enableBosses: true,
    enableShops: true,
    enableEvents: true,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: false,
    actStructure: true,
    suitCount: 4,
    wilds: 0,
    climb: true
  },
  // Flow: Survival with the ROUND clock removed. No per-round time limit and no way
  // to fail a round - clear a goal, take a pick-of-three, get the next goal, repeat.
  // The only clock is a 5-minute SESSION clock counting down to a boss with a real
  // objective and score bar. Max Focus is 20, so decay is the mode's pressure.
  // survivalActive() is true here, so it runs on the Survival engine in
  // js/survival.js (the pick-of-three, grants, bosses, endless). The Survival
  // MODE entry itself was removed in r416; the engine stays because Flow is it.
  // See js/flow-mode.js.
  flow: {
    id: 'flow',
    name: 'Flow',
    desc: 'No round clock. Clear goals back to back for as many level-ups as you can, then a boss arrives every five minutes. Swaps and discards cost half the usual time off that clock. Max Focus is 20.',
    winCondition: 'endless',
    enableBosses: true,
    enableShops: true,
    enableEvents: false,
    autoRefillGrid: true,
    // r326: Flow bills its clock again, at half rate (interactTimeCostMult,
    // js/round-timers.js). It was the one mode where touching the board was free.
    timeIsCurrency: true,
    autoPlayHands: false,
    survival: true,
    flow: true
  },
  // Match-3 auto-play mode. A full 5×5 board of cards: straight-line flushes,
  // runs, and sets of 3+ AUTO-PLAY the instant they exist, then cascade (candy-
  // crush style). The player only swaps & discards to set matches up - the
  // playing is automatic. Goal + timer progression (Normal's shape). See match3.js.
  // POKER SQUARES - the 1930s solitaire as a mode. The 5x5 is the PATIENCE game
  // (r409, js/squares-patience.js): three cards a deal dragged onto the board,
  // a trick pick between every other deal, a banking mid-tally and a 5-minute
  // clock. The 3x3 and 4x4 dailies (js/squares-daily.js) are unchanged. See
  // js/squares-mode.js for why it borrows the real calcScore rather than
  // carrying a scorer of its own.
  squares: {
    id: 'squares',
    name: 'Poker Squares',
    desc: 'Cards dealt three at a time, placed one by one on a 5x5 board. The best hand in every row and column pays, mid-grid and at the end. Tricks, Focus, a 5-minute clock, one score.',
    winCondition: 'high_score',
    enableBosses: false,
    enableShops: false,
    enableEvents: false,
    autoRefillGrid: false,
    timeIsCurrency: false,
    autoPlayHands: false,
    noWalkthrough: true,   // its own opening console teaches it (see tutorialArmForRun)
    squares: true
  },
  match3: {
    id: 'match3',
    name: 'Match-3 (Auto)',
    desc: 'A 5×5 board where flushes, runs, and sets of 3 auto-play and cascade. You just swap & discard to line them up - the game plays them for you.',
    winCondition: 'goal_timer',
    enableBosses: false,
    enableShops: false,
    enableEvents: false,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: true,
    match3: true
  },
  // Zen: the same Match-3 board with the pressure removed - no round clock and
  // no swap/discard limits. Goals still exist (doubled, see triggerLevelUp) so
  // levelling and the reward grid remain reachable, just at a slower pace.
  zen: {
    id: 'zen',
    name: 'Zen (Match-3)',
    desc: 'Match-3 with no clock and unlimited swaps & discards. Goals are doubled - play at your own pace.',
    winCondition: 'goal_only',
    enableBosses: false,
    enableShops: false,
    enableEvents: false,
    autoRefillGrid: true,
    timeIsCurrency: false,
    autoPlayHands: true,
    match3: true,
    zen: true
  },
};

let ACTIVE_MODE = MODES.normal;

// True for the quarter/node modes (Classic, the Schedule, Climb, Custom without
// pick-of-three...). False for the Survival engine (Flow), Match-3/Zen and Poker
// Squares, which each run their own loop.
function isActMode() { return !!ACTIVE_MODE && ACTIVE_MODE.actStructure === true; }

function initMainMenu() {
  ACTIVE_MODE = MODES.normal;
  if (typeof musicSetScene === 'function') musicSetScene('menu');
  document.getElementById('main-menu-overlay').classList.add('show');
  if (typeof updateContinueBtn === 'function') updateContinueBtn();
  if (typeof updateHistoryBtn === 'function') updateHistoryBtn();
}

function switchMenuTab(e, tabId) {
  document.querySelectorAll('.menu-tab').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');
  document.querySelectorAll('.menu-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`menu-content-${tabId}`).classList.add('active');
}

function renderMenuModes() {
  // Legacy tabbed mode list, removed in r100 and superseded by the mode-select
  // carousel (renderModeSelect), so this container no longer exists. Without the
  // guard the null deref threw inside closeDevPanel BEFORE it re-showed the menu,
  // which made Settings → CLOSE from the main menu a dead end.
  const container = document.getElementById('menu-content-modes');
  if (!container) return;
  container.innerHTML = '';
  Object.values(MODES).forEach(mode => {
    const btn = document.createElement('div');
    btn.className = `mode-select-btn ${ACTIVE_MODE.id === mode.id ? 'selected' : ''}`;
    btn.innerHTML = `<div class="mode-name">${mode.name}</div><div class="mode-desc">${mode.desc}</div>`;
    btn.onclick = () => { ACTIVE_MODE = mode; renderMenuModes(); };
    container.appendChild(btn);
  });
}

function startFromMenu() {
  ACTIVE_MODE = MODES.normal;
  document.getElementById('main-menu-overlay').classList.remove('show');
  startGame();
}

// Launch a Match-3 flavour directly ('match3' = goal+timer, 'zen' = no clock).
// The mode-select carousel is the normal route in; this stays as a direct entry
// point (dev console, deep link) now that both modes are listed there.
function startMatch3FromMenu(modeId = 'match3') {
  ACTIVE_MODE = MODES[modeId] || MODES.match3;
  document.getElementById('main-menu-overlay').classList.remove('show');
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  startGame();
}

// ══════════════════════════════════════════════
// MODE SELECT (scroll-sideways carousel off the PLAY button)
// ══════════════════════════════════════════════
// The shipping modes, shown left→right in the carousel.
//
// Match-3, Zen and Dominoes are BUILT but not shown (r197). They are experiments
// on a different loop - Match-3 plays its own matches and has no boss wiring at
// all, Dominoes is beta - and listing them beside the real modes invited a player
// to start one expecting the game the other nine modes are. They are still whole
// and still reachable: the dev panel's MODES group launches any entry in MODES by
// name, which is why the split is two lists rather than a deletion.
// The carousel's ORDER and its unlock chain both live in js/progress-unlock.js,
// which loads before this file. Orientation is no longer a card: every mode's
// FIRST RUN is its tutorial now, so a standalone one would be a second door to
// the same thing. It is still reachable from the dev panel's Modes group.
const MODE_SELECT_LIST = [...MODE_UNLOCK_CHAIN, ...MODE_FINALE_GROUP, ...MODE_EXTRA_LIST];
// Built but NOT in the carousel. Reachable from dev panel -> Modes, which is
// generated from MODES itself so nothing here has to be listed twice.
// `crunch` is here because it is a rough first pass being tuned, not because it
// is an experiment on a different loop the way the other three are.
// `guided` and `spectrum` (r380): dev panel -> Modes, and Spectrum is still
// Custom's colour deck. (Survival's mode entry went in r417, Six Suits' in r416;
// the Survival ENGINE stays because Flow runs on it.)
const MODE_HIDDEN_LIST = ['match3', 'zen', 'crunch', 'guided', 'spectrum'];
const MODE_META = {
  normal:   { accent: 'var(--c-yellow)', suits: '♠ ♥ ♦ ♣',
              blurb: 'Four suits. Four quarters, each five rounds and then a review. Reach each round\'s goal before the clock runs out. Between rounds you pick a path on the reward grid, and some paths lead to the shop or a meeting.' },
  // Crunch is in MODE_HIDDEN_LIST, so this card is not drawn today. Kept ready:
  // promoting the mode is one entry in MODE_FINALE_GROUP and one deletion from
  // the hidden list, with nothing to rewrite.
  crunch:   { accent: '#e8734a',         suits: '13:00 · ONE CLOCK',
              blurb: 'The schedule, played on one clock for the whole quarter. Rounds use it up as you play, and every obligation that is not a round costs a flat amount of time. The review is played on what is left. At zero the run ends.' },
  map:      { accent: '#6fd08c',         suits: '4 × 6 + BOSS',
              blurb: 'Each quarter is a schedule: four lanes, six time slots, then a review. Every step activates the obligation you land on: a round, a shop, a reward grid, a meeting and more. Up to two obligations per slot. Leaving a slot after one pays credits. Clearing a round offers a pick of three.' },
  guided:   { accent: '#c9a0ff',         suits: '8 SLOTS',
              blurb: 'Each quarter is eight slots and then a review. Before each slot you choose from four offers: a round, a hard round, the shop, a reward grid, a pick of three or a meeting. Rounds are free. Most other offers cost credits. The goal rises with every slot.' },
  spectrum: { accent: '#ff9d3c',        suits: '🔴 🟡 🔵 🟢 🟣 🟠 ⚫ ⚪',
              blurb: 'No suits and no face cards. Seven colours, values 0 to 11, plus a single 15 and 20 in each colour. 9s, 10s and 11s are white and never count toward a flush. Four payout cards are in the deck: score two hands next to one and it pays out.' },
  flow:     { accent: '#6fd0ff',         suits: '5:00 · ONE CLOCK',
              blurb: 'You have 5 minutes until the review. Level up as many times as you can before it starts. Each level up offers a pick of three, and you can enter the shop for a fee at any time. Pass the review and the clock refills.' },
  climb:    { accent: '#f2c14e',        suits: '1 → 15',
              blurb: 'Four suits, values 1 to 13, no face cards. Every card that scores goes up one rank, up to 15. A 15 that scores pays +75 pips, then goes back to the rank it started at. Otherwise plays like Classic.' },
  squares:  { accent: '#7fb2ff',        suits: '5 × 5 · 10 LINES',
              blurb: 'Poker Squares. Three cards at a time, placed one by one on a 5x5 board, with a trick pick between every other deal. The best hand of 3+ cards in every row and column pays, once mid-grid and once at the end, times your Focus. Two grids, five minutes each, one score. The 3x3 and 4x4 are quick daily puzzles.' },
  match3:   { accent: '#ff7ad0',         suits: '5 × 5',
              blurb: 'Lines of 3 or more in a row or column score and clear on their own. You swap and discard to set them up.' },
  zen:      { accent: '#7fe3c0',         suits: 'NO CLOCK',
              blurb: 'The auto-playing board with no clock and unlimited swaps and discards. Goals are doubled.' },
  picker:   { accent: '#ff5fa8',         suits: 'BUILD ONE',
              blurb: 'Answer seven questions to build a run: the deck, what happens between rounds, round length, whether actions cost time, bosses, who submits hands, and hand values.' },
};

function openModeSelect() {
  // ON A PHONE THE CAROUSEL GOES FULL SCREEN (r380). While the office photo is up
  // the stage is FORCED landscape (r257) so the menu fits the landscape monitor,
  // which on a portrait phone leaves the mode cards a few centimetres wide.
  // Cutting to the screen here hands the phone its portrait layout, where the
  // modes are a VERTICAL list (css/room.css). Desktop keeps the carousel on the
  // glass (r258).
  if (window.innerHeight > window.innerWidth && typeof officeCutToScreen === 'function') {
    try { officeCutToScreen(); } catch (e) {}
  }
  document.getElementById('main-menu-overlay').classList.remove('show');
  renderModeSelect();
  document.getElementById('mode-select-overlay').classList.add('show');
}

function closeModeSelect() {
  document.getElementById('mode-select-overlay').classList.remove('show');
  document.getElementById('main-menu-overlay').classList.add('show');
}

function scrollModes(dir) {
  const car = document.getElementById('mode-carousel');
  if (!car) return;
  const card = car.querySelector('.mode-card');
  // Portrait stacks the cards (r380), so the arrows scroll down rather than across.
  if (getComputedStyle(car).flexDirection === 'column') {
    car.scrollBy({ top: dir * (card ? card.offsetHeight + 12 : 200), behavior: 'smooth' });
    return;
  }
  const step = card ? card.offsetWidth + 18 : 280;
  car.scrollBy({ left: dir * step, behavior: 'smooth' });
}

function chooseMode(id) {
  ACTIVE_MODE = MODES[id] || MODES.normal;
  // The tier is read off the card being played, not off a global the carousel
  // happens to have left lying around - every card carries its own choice.
  pendingDifficulty = difficultyForMode(id);
  document.getElementById('mode-select-overlay').classList.remove('show');
  startGame();
}

// ── Difficulty picker on a mode card (r193) ─────────────────────────────────
// Three pips under the blurb with a ‹ › either side. The pips are the readout
// (filled up to the chosen tier), the arrows are the control, and the tier's
// name + what it changes are printed beneath so the choice is never a mystery
// number. Only the pip row is re-rendered on a change, so the carousel does not
// scroll-jump under the player's finger mid-choice.
function renderModeTier(card, id) {
  const row = card.querySelector('.mode-tier');
  if (!row) return;
  const n   = difficultyForMode(id);
  const def = difficultyDef(n);
  const max = difficultyUnlockedThrough();
  row.style.setProperty('--tier-accent', def.accent);
  row.innerHTML =
    `<div class="mode-tier-ctl">` +
      `<button class="mode-tier-arrow" data-d="-1" ${n <= 1 ? 'disabled' : ''} aria-label="Lower difficulty">&lsaquo;</button>` +
      `<div class="mode-tier-pips" role="img" aria-label="Tier ${n} of ${max}">` +
        DIFFICULTY_TIERS.map(t =>
          `<span class="mode-tier-pip${t.n <= n ? ' on' : ''}${t.n > max ? ' locked' : ''}"></span>`).join('') +
      `</div>` +
      `<button class="mode-tier-arrow" data-d="1" ${n >= max ? 'disabled' : ''} aria-label="Raise difficulty">&rsaquo;</button>` +
    `</div>` +
    `<div class="mode-tier-name">TIER ${n} · ${def.name}</div>` +
    `<div class="mode-tier-desc">${def.detail}</div>`;
  row.querySelectorAll('.mode-tier-arrow').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      setDifficultyForMode(id, difficultyForMode(id) + parseInt(b.dataset.d, 10));
      renderModeTier(card, id);
    };
  });
}

function renderModeSelect() {
  const car = document.getElementById('mode-carousel');
  if (!car) return;
  car.innerHTML = '';
  // Consumed here, not read: the fan plays on the ONE render that follows the
  // unlock. Re-opening the carousel afterwards shows them already fanned.
  const fan = modeFanPending; modeFanPending = false;
  modeSelectList().forEach(id => {
    const card = (id === MODE_STACK_ID) ? buildModeStackCard() : buildModeCard(id);
    if (!card) return;
    // Only the cards that just APPEARED fan. The chain's four were already on
    // screen and sliding them too reads as the whole carousel reloading.
    const gi = MODE_FINALE_GROUP.indexOf(id);
    if (fan && gi >= 0) { card.classList.add('fan-in'); card.style.setProperty('--fan-i', gi); }
    car.appendChild(card);
  });
}

// A mode's display name. 'picker' is NOT an entry in MODES - it is the door to
// one - so it cannot be looked up there, and a locked card still has to name it.
function modeDisplayName(id) {
  return id === 'picker' ? 'Custom' : (MODES[id] ? MODES[id].name : id);
}

function buildModeCard(id) {
  const meta = MODE_META[id] || {};
  const open = modeUnlocked(id);
  // 'picker' carries the same tier control as the rest (the tier is a property
  // of the RUN, not of the mode); PLAY opens the questions instead of starting.
  const isPicker = id === 'picker';
  if (!isPicker && !MODES[id]) return null;
  const card = document.createElement('div');
  card.className = 'mode-card' + (open ? '' : ' mode-locked');
  card.style.setProperty('--mode-accent', meta.accent || 'var(--c-yellow)');
  card.innerHTML =
    `<div class="mode-card-name">${modeDisplayName(id)}</div>` +
    `<div class="mode-card-suits">${open ? (meta.suits || '') : '\u{1F512}'}</div>` +
    `<div class="mode-card-blurb">${meta.blurb || MODES[id].desc}` +
      (typeof infoTopic === 'function' && infoTopic('mode_' + id)
        ? ` <a class="mode-card-more" href="#">Read more in the handbook.</a>` : '') +
    `</div>` +
    (open ? `<div class="mode-tier"></div><button class="mode-card-play">${isPicker ? 'BUILD' : 'PLAY'}</button>`
          : `<div class="mode-lock-note">Finish a run of <b>${modeDisplayName(modeUnlockedBy(id))}</b> to unlock</div>`);
  const more = card.querySelector('.mode-card-more');
  if (more) more.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openInfoHub('mode_' + id); };
  if (open) {
    renderModeTier(card, isPicker ? 'custom' : id);
    card.querySelector('.mode-card-play').onclick = () => isPicker ? openPickerMode() : chooseMode(id);
  }
  return card;
}

// One card standing in for the whole finale group, with two backing layers so
// it reads as a stack. Four identical padlocks say nothing four times.
function buildModeStackCard() {
  const names = MODE_FINALE_GROUP.map(modeDisplayName);
  const card = document.createElement('div');
  card.className = 'mode-card mode-locked mode-stack';
  card.style.setProperty('--mode-accent', 'var(--c-yellow)');
  card.innerHTML =
    `<div class="mode-card-name">+${names.length} More</div>` +
    `<div class="mode-card-suits">\u{1F512}</div>` +
    `<div class="mode-card-blurb">${names.join(' \u00b7 ')}<br><br>The rest of the game, and they all open at once.</div>` +
    `<div class="mode-lock-note">Finish a run of <b>${modeDisplayName(MODE_UNLOCK_CHAIN[MODE_UNLOCK_CHAIN.length - 1])}</b> to unlock</div>`;
  return card;
}

// ══════════════════════════════════════════════
// DEBUG EVENT LOG
// ══════════════════════════════════════════════
