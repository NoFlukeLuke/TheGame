const BUILD = '2026-08-03 · r121 · main-menu game picker (Cards / Dominoes)';

// ══════════════════════════════════════════════
// MODES & FEATURE FLAGS
// ══════════════════════════════════════════════
const MODES = {
  normal: {
    id: 'normal',
    name: 'Normal Mode',
    // shipped: appears in the main-menu mode picker. Legacy prototype modes below
    // stay in MODES (dev/testing) but are hidden from the menu.
    shipped: true,
    menuName: 'CARDS',
    menuBlurb: 'The main game — poker hands, 3 Acts, bosses.',
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
    shipped: true,
    menuName: 'DOMINOES',
    menuBlurb: 'Beta — pick 3 touching tiles, score every run & set at once.',
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
  // Mode picker restored (r121) now that Dominoes ships alongside the card game.
  // Keeps whatever mode was last chosen this session; defaults to Normal.
  if (!ACTIVE_MODE || !ACTIVE_MODE.shipped) ACTIVE_MODE = MODES.normal;
  renderMenuModePicker();
  document.getElementById('main-menu-overlay').classList.add('show');
}

// Main-menu game picker: one tile per shipped mode. PLAY launches the selected one.
function renderMenuModePicker() {
  const row = document.getElementById('menu-mode-row');
  if (!row) return;
  row.innerHTML = '';
  Object.values(MODES).filter(m => m.shipped).forEach(mode => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-mode-btn' + (ACTIVE_MODE.id === mode.id ? ' selected' : '');
    btn.innerHTML = `<span class="mm-name">${mode.menuName || mode.name}</span>` +
                    `<span class="mm-blurb">${mode.menuBlurb || ''}</span>`;
    btn.onclick = () => { ACTIVE_MODE = mode; renderMenuModePicker(); };
    row.appendChild(btn);
  });
}

function switchMenuTab(e, tabId) {
  document.querySelectorAll('.menu-tab').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');
  document.querySelectorAll('.menu-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`menu-content-${tabId}`).classList.add('active');
}

// Legacy name kept as an alias: the old tabbed mode list (#menu-content-modes) was
// removed in r100, so this threw whenever it was still called (e.g. closing the dev
// panel from the menu). Now it just draws the current picker.
function renderMenuModes() { renderMenuModePicker(); }

function startFromMenu() {
  document.getElementById('main-menu-overlay').classList.remove('show');
  startGame();
}

// ══════════════════════════════════════════════
// DEBUG EVENT LOG
// ══════════════════════════════════════════════
