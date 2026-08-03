const BUILD = '2026-08-03 · r115 · Match-3 auto-play mode';

// ══════════════════════════════════════════════
// MODES & FEATURE FLAGS
// ══════════════════════════════════════════════
const MODES = {
  normal: {
    id: 'normal',
    name: 'Normal Mode',
    desc: '3-Act structure. Play rounds, path through the reward grid, and defeat bosses.',
    winCondition: 'boss_defeat',
    enableBosses: true,
    enableShops: true,
    enableEvents: true,
    autoRefillGrid: true,
    timeIsCurrency: true,
    autoPlayHands: false
  },
  survival: {
    id: 'survival',
    name: 'Survival Mode',
    desc: 'The original prototype. Survive escalating goals for 20 minutes.',
    winCondition: 'survive_20_min',
    enableBosses: false,
    enableShops: false,
    enableEvents: false,
    autoRefillGrid: true,
    timeIsCurrency: false,
    autoPlayHands: false
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
  }
};

let ACTIVE_MODE = MODES.normal;

function initMainMenu() {
  // Mode selector removed (r100): only Normal mode ships, so the menu is just Play + Settings.
  ACTIVE_MODE = MODES.normal;
  document.getElementById('main-menu-overlay').classList.add('show');
}

function switchMenuTab(e, tabId) {
  document.querySelectorAll('.menu-tab').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');
  document.querySelectorAll('.menu-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`menu-content-${tabId}`).classList.add('active');
}

function renderMenuModes() {
  const container = document.getElementById('menu-content-modes');
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

// Launch a Match-3 flavour from the main menu ('match3' = goal+timer, 'zen' = no clock).
function startMatch3FromMenu(modeId = 'match3') {
  ACTIVE_MODE = MODES[modeId] || MODES.match3;
  document.getElementById('main-menu-overlay').classList.remove('show');
  startGame();
}

// ══════════════════════════════════════════════
// DEBUG EVENT LOG
// ══════════════════════════════════════════════
