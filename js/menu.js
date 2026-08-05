const BUILD = '2026-08-05 · r122 · Tempo no longer locks limits (sets once on acquire, combos stack)';

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
// MODE SELECT (scroll-sideways carousel off the PLAY button)
// ══════════════════════════════════════════════
// The two shipping modes, shown left→right in the carousel.
const MODE_SELECT_LIST = ['normal', 'sixsuits'];
const MODE_META = {
  normal:   { accent: 'var(--c-yellow)', suits: '♠ ♥ ♦ ♣',
              blurb: 'The original four-suit game. Three Acts of rounds, shops, events and bosses.' },
  sixsuits: { accent: 'var(--c-mint)',   suits: '♠ ♥ ♦ ♣ ★ ▲',
              blurb: 'Two extra suits dilute the deck, so flushes are hard-won. Flush of 3, 4 and 5 are all in play.' },
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
