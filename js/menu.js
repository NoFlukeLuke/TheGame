const BUILD = '2026-08-22 · r158 · Storage safety shim, save/resume a run, portrait strip rework (Knacks + hand preview share a swap button), portrait score panel split, PIPS·MULT·FOCUS fuse animation';

// ══════════════════════════════════════════════
// MODES & FEATURE FLAGS
// ══════════════════════════════════════════════
const MODES = {
  normal: {
    id: 'normal',
    name: 'Classic',
    desc: '3-Act structure. Play rounds, path through the reward grid, and defeat bosses.',
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
  // Guided first run. Mechanically IDENTICAL to Classic (actStructure: true) —
  // an ordinary seeded run with coach-marks over it. See js/tutorial.js.
  tutorial: {
    id: 'tutorial',
    name: 'Orientation',
    desc: 'A guided first run — a normal Classic run with the terminal explaining itself as you go. Play a round, take the payout, walk a reward path, visit the Mart.',
    // Pinned seed: orientation is the same experience for everyone, and a bug
    // report against it is reproducible. The board is still a normal random
    // deal — the tutorial finds a hand on it rather than stacking one.
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
    desc: 'Same 3-Act game, but the deck has six suits — flushes are far rarer, so Flush of 3, 4, and 5 are all playable.',
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
  survival: {
    id: 'survival',
    name: 'Survival',
    desc: 'Endless escalating goals. Clear a goal to pick from three rewards (Trick, Sleight, Knack or Limit). Miss one and the run ends.',
    winCondition: 'endless',
    enableBosses: true,
    enableShops: true,
    enableEvents: false,
    autoRefillGrid: true,
    timeIsCurrency: false,
    autoPlayHands: false,
    survival: true
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
  // crush style). The player only swaps & discards to set matches up — the
  // playing is automatic. Goal + timer progression (Normal's shape). See match3.js.
  match3: {
    id: 'match3',
    name: 'Match-3 (Auto)',
    desc: 'A 5×5 board where flushes, runs, and sets of 3 auto-play and cascade. You just swap & discard to line them up — the game plays them for you.',
    winCondition: 'goal_timer',
    enableBosses: false,
    enableShops: false,
    enableEvents: false,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: true,
    match3: true
  },
  // Zen: the same Match-3 board with the pressure removed — no round clock and
  // no swap/discard limits. Goals still exist (doubled, see triggerLevelUp) so
  // levelling and the reward grid remain reachable, just at a slower pace.
  zen: {
    id: 'zen',
    name: 'Zen (Match-3)',
    desc: 'Match-3 with no clock and unlimited swaps & discards. Goals are doubled — play at your own pace.',
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
// Six Suits plays exactly like Classic — only the deck's suits differ.
function isActMode() { return !!ACTIVE_MODE && ACTIVE_MODE.actStructure === true; }

function initMainMenu() {
  ACTIVE_MODE = MODES.normal;
  document.getElementById('main-menu-overlay').classList.add('show');
  if (typeof updateContinueBtn === 'function') updateContinueBtn();
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
const MODE_SELECT_LIST = ['tutorial', 'normal', 'sixsuits', 'survival', 'match3', 'zen', 'dominoes'];
const MODE_META = {
  tutorial: { accent: '#8fd0ff',         suits: 'START HERE',
              blurb: 'LETHE Corp staff orientation. A normal Classic run with the terminal explaining each control as you reach it — scoring, Focus, limits, the reward path, the Mart. About three minutes.' },
  normal:   { accent: 'var(--c-yellow)', suits: '♠ ♥ ♦ ♣',
              blurb: 'The original four-suit game. Three Acts of rounds, shops, events and bosses.' },
  sixsuits: { accent: 'var(--c-mint)',   suits: '♠ ♥ ♦ ♣ ★ ▲',
              blurb: 'Two extra suits dilute the deck, so flushes are hard-won. Flush of 3, 4 and 5 are all in play.' },
  survival: { accent: 'var(--c-coral)',  suits: 'ENDLESS',
              blurb: 'Clear escalating goals on a 2-minute clock. Each clear: pick one of three rewards from every pool. Overflow score and leftover time carry forward. Miss a goal and the run is over.' },
  match3:   { accent: '#ff7ad0',         suits: '5 × 5',
              blurb: 'Matches play themselves. Line up 3+ in a row or column and it scores and cascades — you just swap and discard to set them up.' },
  zen:      { accent: '#7fe3c0',         suits: 'NO CLOCK',
              blurb: 'The same auto-playing board with the pressure off: no timer, unlimited swaps and discards. Goals are doubled.' },
  dominoes: { accent: '#9b57d3',         suits: 'VALUES 1–7',
              blurb: 'Beta. Two-value tiles fall sideways or upright and leave gaps. Pick 3 touching tiles — every run and set of 3+ across their six halves scores at once.' },
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
  document.getElementById('mode-select-overlay').classList.remove('show');
  startGame();
}

function renderModeSelect() {
  const car = document.getElementById('mode-carousel');
  if (!car) return;
  car.innerHTML = '';
  MODE_SELECT_LIST.forEach(id => {
    const m = MODES[id]; if (!m) return;
    const meta = MODE_META[id] || {};
    const card = document.createElement('div');
    card.className = 'mode-card';
    card.style.setProperty('--mode-accent', meta.accent || 'var(--c-yellow)');
    card.innerHTML =
      `<div class="mode-card-name">${m.name}</div>` +
      `<div class="mode-card-suits">${meta.suits || ''}</div>` +
      `<div class="mode-card-blurb">${meta.blurb || m.desc}</div>` +
      `<button class="mode-card-play">PLAY</button>`;
    card.querySelector('.mode-card-play').onclick = () => chooseMode(id);
    car.appendChild(card);
  });
}

// ══════════════════════════════════════════════
// DEBUG EVENT LOG
// ══════════════════════════════════════════════
