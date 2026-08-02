const BUILD = '2026-08-02 · r119 · Dominoes mode (beta): two-cell tiles, runs/sets scoring';

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
  dominoes: {
    id: 'dominoes',
    name: 'Dominoes',
    desc: 'Two-value tiles fall in either orientation. Select 3 dominoes; score every run and set of 3+ across their six halves at once.',
    winCondition: 'endless',
    enableBosses: false,
    enableShops: false,
    enableEvents: false,
    autoRefillGrid: true,
    timeIsCurrency: false,
    autoPlayHands: false
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
  document.getElementById('main-menu-overlay').classList.remove('show');
  startGame();
}

// ══════════════════════════════════════════════
// DEBUG EVENT LOG
// ══════════════════════════════════════════════
