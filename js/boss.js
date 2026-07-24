function isCellBlocked(r, c) {
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return false; // Fight the Power
  return blockedCells.has(`${r}-${c}`);
}

function getVoidPattern(pattern) {
  // Returns a Set of "r-c" keys, scaled to the current grid dimensions
  const s = new Set();
  const lastRow = gridRows - 1;
  const lastCol = gridCols - 1;
  const midRow  = Math.floor(gridRows / 2);
  const midCol  = Math.floor(gridCols / 2);
  switch (pattern) {
    case 'corners':
      s.add(`0-0`); s.add(`0-${lastCol}`); s.add(`${lastRow}-0`); s.add(`${lastRow}-${lastCol}`);
      break;
    case 'edges':
      for (let c = 0; c < gridCols; c++) { s.add(`0-${c}`); s.add(`${lastRow}-${c}`); }
      for (let r = 0; r < gridRows; r++) { s.add(`${r}-0`); s.add(`${r}-${lastCol}`); }
      break;
    case 'center':
      s.add(`${midRow}-${midCol}`);
      if (midRow - 1 >= 0) s.add(`${midRow-1}-${midCol}`);
      if (midRow + 1 < gridRows) s.add(`${midRow+1}-${midCol}`);
      if (midCol - 1 >= 0) s.add(`${midRow}-${midCol-1}`);
      if (midCol + 1 < gridCols) s.add(`${midRow}-${midCol+1}`);
      break;
    case 'diagonal':
      for (let i = 0; i < Math.min(gridRows, gridCols); i++) s.add(`${i}-${i}`);
      break;
    case 'random':
    default: {
      const all = [];
      for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) all.push(`${r}-${c}`);
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      const n = 3 + Math.floor(Math.random() * 3); // 3-5
      all.slice(0, n).forEach(k => s.add(k));
    }
  }
  return s;
}

function renderBlockedCells() {
  const gridEl = document.getElementById('grid');
  gridEl.querySelectorAll('.blocked-cell').forEach(el => el.remove());
  blockedCells.forEach(key => {
    const [r, c] = key.split('-').map(Number);
    const stone = document.createElement('div');
    stone.className = 'blocked-cell';
    stone.dataset.blockedKey = key;
    stone.style.left = cellLeft(c) + 'px';
    stone.style.top  = cellTop(r) + 'px';
    gridEl.appendChild(stone);
  });
}

function clearBlockedCellDOM() {
  document.getElementById('grid').querySelectorAll('.blocked-cell').forEach(el => el.remove());
}

// ── Stone card helpers (the deck-injected type) ──
function makeStoneCard() {
  // Stones are normal card objects with a flag. They have a rank/suit so they
  // can occupy a cell, but `cardCan` will refuse 'play', 'discard', 'select'.
  // They CAN be 'swap' targets (handled in performSwap).
  return { rank: '?', suit: 'stone', _isStone: true };
}

function injectStonesIntoDeck(count) {
  // Insert `count` stone cards at random positions in the drawPile
  for (let i = 0; i < count; i++) {
    const pos = Math.floor(Math.random() * (drawPile.length + 1));
    drawPile.splice(pos, 0, makeStoneCard());
  }
  updateDeckHud();
}

function purgeStonesFromDeck() {
  // Remove all stones from drawPile, playedPile, and grid
  drawPile = drawPile.filter(c => !c._isStone);
  playedPile = playedPile.filter(c => !c._isStone);
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (gridData[r][c] && gridData[r][c]._isStone) {
        gridData[r][c] = drawCard() || null; // refill with a real card
      }
    }
  }
  updateDeckHud();
}

// ── Boss objective checking ──
function checkBossObjective(handName, handFinalScore) {
  if (!bossActive || !currentBoss) return;
  const obj = currentBoss.objective;
  if (obj.type === 'score') {
    // Use total `score` accumulated during this boss (we snapshot at start)
    bossObjectiveProgress = score - bossScoreAtStart;
    if (bossObjectiveProgress >= obj.target) {
      endBoss(true);
    }
  } else if (obj.type === 'hand') {
    if (handName === obj.handName) {
      bossObjectiveProgress++;
      if (bossObjectiveProgress >= obj.count) endBoss(true);
    }
  }
  updateBossObjectiveUI();
}
let bossScoreAtStart = 0;

function updateBossObjectiveUI() {
  if (!bossActive || !currentBoss) return;
  const obj = currentBoss.objective;
  const el = document.getElementById('boss-objective-text');
  if (!el) return;
  if (obj.type === 'score') {
    const prog = score - bossScoreAtStart;
    el.textContent = `${Math.max(0, prog).toLocaleString()} / ${obj.target.toLocaleString()}`;
  } else if (obj.type === 'hand') {
    el.textContent = `${obj.handName}: ${bossObjectiveProgress} / ${obj.count}`;
  }
  // Voidwright: also update the pool display
  const poolEl = document.getElementById('boss-trick-pools');
  if (poolEl && currentBoss.modifiers.includes('trick_pool_split')) {
    const phaseAActive = bossPhase === 1;
    const aNames = [...trickPoolA].map(id => trickIdToName(id)).join(', ') || '(none)';
    const bNames = [...trickPoolB].map(id => trickIdToName(id)).join(', ') || '(none)';
    poolEl.innerHTML = `
      <div class="boss-pool ${phaseAActive ? 'pool-active' : 'pool-inactive'}">
        <span class="boss-pool-label">P1 OFF:</span> ${aNames}
      </div>
      <div class="boss-pool ${!phaseAActive ? 'pool-active' : 'pool-inactive'}">
        <span class="boss-pool-label">P2 OFF:</span> ${bNames}
      </div>
    `;
  }
}
function trickIdToName(id) {
  const trick = (acquiredTricks || []).find(b => b.id === id);
  return trick ? trick.name : id;
}

// ── Boss modifier application ──
function applyBossModifiers(preset) {
  preset.modifiers.forEach(mod => {
    switch (mod) {
      case 'inject_stones':
        injectStonesIntoDeck(preset.params.stoneInjectCount || 5);
        break;
      case 'void_corners':
        blockedCells = getVoidPattern('corners');
        break;
      case 'void_random':
        blockedCells = getVoidPattern('random');
        break;
      case 'void_edges':
        blockedCells = getVoidPattern('edges');
        break;
      case 'void_center':
        blockedCells = getVoidPattern('center');
        break;
      case 'reduce_swaps':
        bossSwapsDelta = preset.params.swapsDelta || -1;
        swaps = Math.max(0, swaps + bossSwapsDelta);
        render();
        break;
      case 'low_card_infusion':
        bossLowCardActive = true;
        break;
      case 'hand_lock':
        bossLockedHand = preset.params.lockedHand || null;
        break;
      case 'trick_pool_split': {
        // Randomly split owned Tricks into two pools
        const ownedIds = (typeof acquiredTricks !== 'undefined' ? acquiredTricks : []).map(b => b.id);
        const shuffled = [...ownedIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const half = Math.ceil(shuffled.length / 2);
        trickPoolA = new Set(shuffled.slice(0, half));
        trickPoolB = new Set(shuffled.slice(half));
        break;
      }
      case 'periodic_null': {
        const intervalSecs = preset.params.nullIntervalSecs || 8;
        const count = preset.params.nullCount || 1;
        bossNullInterval = setInterval(() => {
          if (gameTimerPaused || roundEnded) return;
          // Replace `count` random normal cards (not Tricks/Sleights) with null
          const candidates = [];
          for (let r = 0; r < gridRows; r++)
            for (let c = 0; c < gridCols; c++) {
              const card = gridData[r]?.[c];
              if (card && !card._isTrick && !card._isSleight && !card._isStone && card.rank)
                candidates.push([r, c]);
            }
          for (let k = 0; k < count && candidates.length > 0; k++) {
            const idx = Math.floor(Math.random() * candidates.length);
            const [r, c] = candidates.splice(idx, 1)[0];
            if (gridData[r]?.[c]) {
              const displaced = gridData[r][c];
              if (displaced && displaced.rank) discardToDrawPile(displaced);
              gridData[r][c] = null;
            }
          }
          showMessage('The Hollow claims a card', 'var(--red)');
          render();
        }, intervalSecs * 1000);
        break;
      }
    }
  });
}

function clearBossModifiers() {
  // Restore swaps
  if (bossSwapsDelta !== 0) {
    swaps = Math.max(0, swaps - bossSwapsDelta);
    render();
    bossSwapsDelta = 0;
  }
  // Clear voids
  blockedCells = new Set();
  // Purge stones
  purgeStonesFromDeck();
  // Clear flags
  bossLowCardActive = false;
  bossLockedHand = null;
  trickPoolA = new Set();
  trickPoolB = new Set();
  bossPhase = 1;
  if (bossNullInterval) { clearInterval(bossNullInterval); bossNullInterval = null; }
}

// Hook called every time a card is drawn — biases toward low cards during Famine
function maybeFamineDrawSwap(card) {
  if (!bossLowCardActive) return card;
  if (!card || card._isStone || card._isSleight) return card;
  if (hasSleightOnGrid('fight_power')) return card; // Fight the Power ignores boss effects
  if (Math.random() > (currentBoss?.params?.lowCardWeight || 0.7)) return card;
  // Replace card with a low rank (2–6), same suit
  const lowRanks = ['2','3','4','5','6'];
  return { ...card, rank: lowRanks[Math.floor(Math.random() * lowRanks.length)] };
}

// Is a Trick currently disabled by Voidwright phase?
function isTrickDisabledByBoss(trickId) {
  if (!bossActive) return false;
  if (hasSleightOnGrid('fight_power')) return false; // Fight the Power ignores boss effects
  if (bossPhase === 1 && trickPoolA.has(trickId)) return true;
  if (bossPhase === 2 && trickPoolB.has(trickId)) return true;
  return false;
}

// ── Boss trigger / end ──
function triggerBoss(presetOverride = null) {
  if (bossActive) return;
  // Pick preset (cycle or random; v1 random)
  const preset = presetOverride
    ? structuredClone(presetOverride)
    : structuredClone(BOSS_PRESETS[bossNumber % BOSS_PRESETS.length]);
  currentBoss = preset;
  bossActive = true;
  bossNumber++;
  bossPhase = 1;
  bossObjectiveProgress = 0;
  bossScoreAtStart = score;

  // Apply modifiers
  applyBossModifiers(preset);

  // Any cards sitting on now-void cells: return to draw pile
  blockedCells.forEach(key => {
    const [r, c] = key.split('-').map(Number);
    const card = gridData[r][c];
    if (card && !card._isTrick) {
      if (!card._isStone) discardToDrawPile(card);
      gridData[r][c] = null;
    } else if (card && card._isTrick) {
      gridData[r][c] = null;
    }
  });
  // Clear pending selection over void
  selected = selected.filter(([r, c]) => !isCellBlocked(r, c));

  // Pause round timer (save value for restore)
  savedRoundSeconds = roundSeconds;
  if (roundInterval) { clearInterval(roundInterval); roundInterval = null; }

  // Boss timer + UI
  bossSecondsLeft = BOSS_WINDOW_DURATION;
  document.getElementById('clock').classList.add('boss-mode');
  document.getElementById('clock-bar').classList.add('boss-mode');
  document.getElementById('grid').classList.add('boss-active');

  updateBossClockDisplay();

  // Banner
  const banner = document.getElementById('boss-banner');
  banner.querySelector('.boss-banner-title').textContent = preset.name;
  document.getElementById('boss-banner-sub').textContent = preset.flavor;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 2400);

  // Objective HUD
  showBossObjectiveHUD(preset);

  // Render
  renderBlockedCells();
  render();
  updateActProgressUI();

  // Tick
  startBossTimer();
}

function updateBossClockDisplay() {
  if (!bossActive) return; // never clobber the round clock when no boss is running
  const m = Math.floor(bossSecondsLeft / 60);
  const s = bossSecondsLeft % 60;
  document.getElementById('clock').textContent = `${m}:${s.toString().padStart(2,'0')}`;
  document.getElementById('clock-bar').style.width = (bossSecondsLeft / BOSS_WINDOW_DURATION * 100) + '%';
}

// Single source of truth for the boss countdown. Clears any existing boss interval first
// (so it can't be double-started) and self-terminates if bossActive ever goes false (so an
// orphaned timer can't keep writing the clock — the cause of the "clock flickers to 0" bug).
function startBossTimer() {
  if (bossInterval) { clearInterval(bossInterval); bossInterval = null; }
  bossInterval = setInterval(() => {
    if (!bossActive) { clearInterval(bossInterval); bossInterval = null; return; }
    if (gameTimerPaused) return;
    bossSecondsLeft--;
    if (bossSecondsLeft < 0) bossSecondsLeft = 0;
    updateBossClockDisplay();
    if (bossPhase === 1 && bossSecondsLeft === Math.floor(BOSS_WINDOW_DURATION / 2)) {
      bossPhase = 2;
      updateBossObjectiveUI();
      showMessage('PHASE 2', 'var(--red)');
    }
    if (bossSecondsLeft <= 0) endBoss(false);
  }, 1000);
}

function showBossObjectiveHUD(preset) {
  let hud = document.getElementById('boss-objective-hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'boss-objective-hud';
    document.getElementById('grid').appendChild(hud);
  }
  const obj = preset.objective;
  const label = obj.type === 'score' ? 'OBJECTIVE: SCORE' : `OBJECTIVE: ${obj.handName.toUpperCase()}`;
  hud.innerHTML = `
    <div class="boss-objective-label">${label}</div>
    <div class="boss-objective-progress" id="boss-objective-text"></div>
    <div id="boss-trick-pools"></div>
  `;
  hud.classList.add('show');
  updateBossObjectiveUI();
}

function hideBossObjectiveHUD() {
  const hud = document.getElementById('boss-objective-hud');
  if (hud) hud.classList.remove('show');
}

function endBoss(success) {
  if (!bossActive) return;
  bossActive = false;
  if (bossInterval) { clearInterval(bossInterval); bossInterval = null; }

  // Clean up modifiers (must happen BEFORE render)
  clearBossModifiers();
  clearBlockedCellDOM();
  hideBossObjectiveHUD();
  document.getElementById('grid').classList.remove('boss-active');
  document.getElementById('clock').classList.remove('boss-mode');
  document.getElementById('clock-bar').classList.remove('boss-mode');
  updateActProgressUI();

  // Result flash
  const resultEl = document.getElementById('boss-result');
  const resultText = document.getElementById('boss-result-text');
  resultText.className = 'boss-result-text ' + (success ? 'win' : 'loss');
  resultText.textContent = success ? 'VICTORY' : 'DEFEATED';
  resultEl.classList.add('show');
  setTimeout(() => resultEl.classList.remove('show'), 1500);

  if (success) {
    render();
    if (ACTIVE_MODE.id === 'normal') {
      // Node-based: post-boss reward grid is an interlude that starts the next act.
      // nodeInAct stays at 5 so closeRewardGrid knows to reset it and advance actNumber.
      setTimeout(() => { rewardGridContext = 'interlude'; openRewardGrid(); }, 1000);
    } else {
      // Timer-based modes: restore round timer and resume the interrupted round
      roundSeconds = savedRoundSeconds;
      updateClockUI();
      setTimeout(() => { rewardGridContext = 'boss'; openRewardGrid(); }, 1000);
    }
  } else {
    setTimeout(() => onGameEnd(true), 1200);
  }

  currentBoss = null;
}

// ══════════════════════════════════════════════
// BOSS REWARD GRID (post-boss path-pick)
// ══════════════════════════════════════════════
// ── REWARD GRID ──
// All cells are rewards (buff / debuff / dest). Player selects any orthogonally
// connected group, then confirms. The reward grid mirrors the PLAY grid: its
// shape comes from limits.grid_rows/grid_cols and the number of picks is capped
// by limits.selection — so upgrading play-grid limits upgrades rewards too.

let rewardSelected = new Set(); // "r-c" keys
let rewardCells    = [];        // NxN array of { kind, payload }
let rewardConfirmed = false;
let rewardGridContext = 'interlude'; // 'interlude' | 'boss' — determines what closeRewardGrid does
let skipTrickChoiceOverlay = false;    // set before drainLevelUpQueue when reward grid is the reward screen

