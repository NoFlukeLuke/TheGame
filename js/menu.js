const BUILD = "2026-09-19 · r276 · mode unlock chain: The Schedule first, the rest open one run at a time";

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
  // Guided first run. Mechanically IDENTICAL to Classic (actStructure: true) -
  // an ordinary seeded run with coach-marks over it. See js/tutorial.js.
  tutorial: {
    id: 'tutorial',
    name: 'Orientation',
    desc: 'A guided first run - a normal Classic run with the terminal explaining itself as you go. Play a round, take the payout, walk a reward path, visit the shop.',
    // Pinned seed: orientation is the same experience for everyone, and a bug
    // report against it is reproducible. The board is still a normal random
    // deal - the tutorial finds a hand on it rather than stacking one.
    seed: 'LETHE-INDUCTION',
    winCondition: 'boss_defeat',
    enableBosses: true,
    enableShops: true,
    enableEvents: true,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: false,
    actStructure: true,
    suitCount: 4,
    tutorial: true
  },
  sixsuits: {
    id: 'sixsuits',
    name: 'Six Suits',
    desc: 'Same four-quarter game, but six suits with only five of each rank, so the deck is 60 cards rather than 78. One rank is cut out of the middle, which leaves the ladder too short for long runs. Flushes are rare and sets come a little easier.',
    winCondition: 'boss_defeat',
    enableBosses: true,
    enableShops: true,
    enableEvents: true,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: false,
    actStructure: true,
    suitCount: 6
  },
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
  survival: {
    id: 'survival',
    name: 'Survival',
    desc: 'Endless escalating goals. Clear a goal to pick from three rewards (Trick, Sleight, Knack or Limit). Miss one and the run ends.',
    winCondition: 'endless',
    enableBosses: true,
    enableShops: true,
    enableEvents: false,
    autoRefillGrid: true,
    // TRUE, corrected in r234. This said false while the flag was read by nothing,
    // and the two sites that actually charge (js/input.js, js/discard.js) billed
    // Survival's 2:00 clock for every swap and discard regardless. interactTimeCostsOn()
    // now reads this flag, so leaving it false would have made interacting free in a
    // shipped mode as a side effect of wiring up the picker. It describes what
    // Survival does: the clock is a deadline AND a budget, same as Classic.
    // Flow is the mode that genuinely charges nothing, and it says so on its own entry.
    timeIsCurrency: true,
    autoPlayHands: false,
    survival: true
  },
  // Flow: Survival with the ROUND clock removed. No per-round time limit and no way
  // to fail a round - clear a goal, take a pick-of-three, get the next goal, repeat.
  // The only clock is a 5-minute SESSION clock counting down to a boss with a real
  // objective and score bar. Max Focus is 20, so decay is the mode's pressure.
  // survivalActive() is true here too, so it reuses Survival's whole flow.
  // See js/flow-mode.js.
  flow: {
    id: 'flow',
    name: 'Flow',
    desc: 'No round clock. Clear goals back to back for as many level-ups as you can, then a boss arrives every five minutes. Max Focus is 20 - decay is the only pressure.',
    winCondition: 'endless',
    enableBosses: true,
    enableShops: true,
    enableEvents: false,
    autoRefillGrid: true,
    timeIsCurrency: false,
    autoPlayHands: false,
    survival: true,
    flow: true
  },
  tetris: {
    id: 'tetris',
    name: 'Clear the Board',
    desc: 'Cards do not refill automatically. Clear the grid before the time forces a drop.',
    winCondition: 'clear_grid',
    enableBosses: false,
    enableShops: true,
    enableEvents: false,
    autoRefillGrid: false,
    timeIsCurrency: true,
    autoPlayHands: false
  },
  autoplay: {
    id: 'autoplay',
    name: 'Auto-Match',
    desc: 'Correctly ordered hands automatically play themselves. Fast-paced chaining.',
    winCondition: 'boss_defeat',
    enableBosses: true,
    enableShops: true,
    enableEvents: true,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: true
  },
  // Match-3 auto-play mode. A full 5×5 board of cards: straight-line flushes,
  // runs, and sets of 3+ AUTO-PLAY the instant they exist, then cascade (candy-
  // crush style). The player only swaps & discards to set matches up - the
  // playing is automatic. Goal + timer progression (Normal's shape). See match3.js.
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
  // Dominoes: two-value tiles that occupy TWO grid cells and fall as one rigid
  // piece in either orientation (leaving natural gaps). Select 3 adjacent tiles;
  // every run and set of 3+ across their six half-values scores at once.
  // See js/data/dominoes.js + js/dominoes-mode.js, and DOMINOES_MODE.md.
  dominoes: {
    id: 'dominoes',
    name: 'Dominoes',
    desc: 'Two-value tiles fall in either orientation. Select 3 adjacent dominoes; score every run and set of 3+ across their six halves at once.',
    winCondition: 'endless',
    enableBosses: false,
    enableShops: false,
    enableEvents: false,
    autoRefillGrid: true,
    timeIsCurrency: false,
    autoPlayHands: false,
    dominoes: true
  }
};

let ACTIVE_MODE = MODES.normal;

// True for the 3-Act "board" modes (Classic + Six Suits). Legacy timer modes
// (survival/tetris/autoplay) are false. Gates all the 3-Act-vs-timer branches so
// Six Suits plays exactly like Classic - only the deck's suits differ.
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
const MODE_SELECT_LIST = [...MODE_UNLOCK_CHAIN, ...MODE_FINALE_GROUP];
const MODE_HIDDEN_LIST = ['match3', 'zen', 'dominoes'];
const MODE_META = {
  tutorial: { accent: '#8fd0ff',         suits: 'START HERE',
              blurb: 'LETHE Corp staff orientation. A normal Classic run with the terminal explaining each control as you reach it - scoring, Focus, limits, the reward path, the shop. About three minutes.' },
  normal:   { accent: 'var(--c-yellow)', suits: '♠ ♥ ♦ ♣',
              blurb: 'The original four-suit game. Three Acts of rounds, shops, events and bosses.' },
  map:      { accent: '#6fd08c',         suits: '4 × 6 + BOSS',
              blurb: 'The run is a board. Four lanes, six sets of tiles - rounds, hard rounds, shops, reward grids, events, a couple of blanks and mysteries - then a full-width boss with a fixed quota you can read from the start. Orthogonal moves only, at most two tiles per set, and moving on early pays credits.' },
  guided:   { accent: '#c9a0ff',         suits: '8 SLOTS',
              blurb: 'Each act is eight slots and then the boss. Every slot is either a round you play or something you buy with it - the shop, a reward grid, or one of two events on offer. Buying power always costs a round you will not get to play, and the goal climbs either way, so the question is how much of the act you spend getting stronger rather than getting further.' },
  sixsuits: { accent: 'var(--c-mint)',   suits: '♠ ♥ ♦ ♣ ♛ ☾',
              blurb: 'Six suits with five of each rank, so the deck is 60 cards and a suit holds only ten. The crown and the moon join the four you know. One rank is cut out of the middle of the ladder, so a four-card run or a straight is a good deal harder to find than in Classic, while sets come a little easier and flushes are hard-won.' },
  spectrum: { accent: '#ff9d3c',        suits: '🔴 🟡 🔵 🟢 🟣 🟠 ⚫ ⚪',
              blurb: 'The deck loses its suits and its court. Seven colours and the values 0 to 11, plus a lone 15 and 20. The 9s, 10s and 11s are WHITE - colourless, and they can never complete a flush. Four payout cards are shuffled in: score two hands beside one and it pays.' },
  survival: { accent: 'var(--c-coral)',  suits: 'ENDLESS',
              blurb: 'Clear escalating goals on a 2-minute clock. Each clear: pick one of three rewards from every pool. Overflow score and leftover time carry forward. Miss a goal and the run is over.' },
  flow:     { accent: '#6fd0ff',         suits: 'NO CLOCK',
              blurb: 'Survival with the round clock taken off. Nothing forces a goal, so you clear one after another for as many level-ups as you can hold together - but Focus caps at 20 and decays the moment you slow down. Five minutes of play and the inspection arrives: a boss with an objective and a quota, on its own clock.' },
  match3:   { accent: '#ff7ad0',         suits: '5 × 5',
              blurb: 'Matches play themselves. Line up 3+ in a row or column and it scores and cascades - you just swap and discard to set them up.' },
  zen:      { accent: '#7fe3c0',         suits: 'NO CLOCK',
              blurb: 'The same auto-playing board with the pressure off: no timer, unlimited swaps and discards. Goals are doubled.' },
  picker:   { accent: '#ff5fa8',         suits: 'BUILD ONE',
              blurb: 'Answer seven questions and the run is assembled from your answers: which deck, what happens between rounds, how long a round is, whether interacting costs time, bosses or none, who submits the hands, and what a hand type is worth. Every other mode in this list is one fixed set of those answers.' },
  dominoes: { accent: '#9b57d3',         suits: 'VALUES 1–7',
              blurb: 'Beta. Two-value tiles fall sideways or upright and leave gaps. Pick 3 touching tiles - every run and set of 3+ across their six halves scores at once.' },
};

function openModeSelect() {
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
    `<div class="mode-card-blurb">${meta.blurb || MODES[id].desc}</div>` +
    (open ? `<div class="mode-tier"></div><button class="mode-card-play">${isPicker ? 'BUILD' : 'PLAY'}</button>`
          : `<div class="mode-lock-note">Finish a run of <b>${modeDisplayName(modeUnlockedBy(id))}</b> to unlock</div>`);
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
