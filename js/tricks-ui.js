function showTrickChoiceOverlay() {
  const overlay = document.getElementById('trick-choice-overlay');
  const cardsEl = document.getElementById('trick-choice-cards');
  cardsEl.innerHTML = '';
  overlay._pendingChoice = null;

  function renderCards() {
    cardsEl.innerHTML = '';
    trickSelectionOptions.forEach((trick) => {
      const isPending = overlay._pendingChoice === trick;
      const card = document.createElement('div');
      card.className = `trick-choice-card tier-${trick.tier}${isPending ? ' trick-choice-pending' : ''}`;
      card.innerHTML = `
        <div class="trick-choice-tier">${trick.tier}</div>
        <div class="trick-choice-emoji">${trickEmoji(trick)}</div>
        <div class="trick-choice-name">${trick.name}</div>
        ${isPending ? '<div class="trick-choice-confirm">Tap to confirm</div>' : '<div class="trick-choice-hold">hover / hold for details</div>'}
      `;
      attachHoverHold(card, () => showTrickDescTooltip(trick, card), hideTrickDescTooltip);
      card.addEventListener('click', () => {
        if (card._lpFired) { card._lpFired = false; return; } // long-press = read, not select
        hideTrickDescTooltip();
        if (overlay._pendingChoice === trick) {
          // Confirm
          overlay.classList.remove('show');
          document.querySelectorAll('.trick-target-slot').forEach(el => el.remove());
          confirmFullscreenTrickSelection(trick);
        } else {
          overlay._pendingChoice = trick;
          renderCards();
        }
      });
      cardsEl.appendChild(card);
    });
  }

  renderCards();
  overlay.classList.add('show');

  // Skip button — pass on the trick choice
  const skipBtn = document.getElementById('trick-choice-skip');
  if (skipBtn) {
    skipBtn.onclick = () => {
      clearInterval(levelupTimer);
      overlay.classList.remove('show');
      document.querySelectorAll('.trick-target-slot').forEach(el => el.remove());
      trickSelectionPhase = false;
      drainLevelUpQueue();
    };
  }

  startTrickTimer();
}
function startTrickTimer() {
  levelupSeconds = LEVEL_UP_DURATION;
  updateLUClockUI();
  levelupTimer = setInterval(() => {
    levelupSeconds--;
    updateLUClockUI();
    if (levelupSeconds <= 0) {
      clearInterval(levelupTimer);
      // Auto-pick first option
      document.getElementById('trick-choice-overlay')?.classList.remove('show');
      document.querySelectorAll('.trick-target-slot').forEach(el => el.remove());
      confirmFullscreenTrickSelection(trickSelectionOptions[0]);
    }
  }, 1000);
}

function updateLUClockUI() {
  const secEl = document.getElementById('trick-choice-seconds');
  if (secEl) secEl.textContent = levelupSeconds;
  const bar = document.getElementById('trick-choice-timer-bar');
  if (bar) bar.style.width = (levelupSeconds / LEVEL_UP_DURATION * 100) + '%';
  // Legacy overlay fallback
  const luTimer = document.getElementById('lu-timer');
  if (luTimer) luTimer.textContent = levelupSeconds;
  const legacyBar = document.getElementById('levelup-timer-bar');
  if (legacyBar) legacyBar.style.width = (levelupSeconds / LEVEL_UP_DURATION * 100) + '%';
}


function pickTrickOptions(n) {
  const pool = [...TRICK_POOL];
  // Don't offer already acquired bonuses (except stackable ones)
  const stackableIds = ['rich_soil','fertile_ground','rowcol_triple_pips','rowcol_mult','rowcol_retrigger','rowcol_perm_double'];
  const filtered = pool.filter(b => !acquiredTricks.some(a => a.id === b.id && !stackableIds.includes(b.id)));
  const shuffled = shuffle(filtered);
  // Weight: common 9×, rare 3×, legendary 1× 
  const TIER_WEIGHT = { common: 9, rare: 3, legendary: 1 };
  const weighted = [];
  shuffled.forEach(b => {
    const w = TIER_WEIGHT[b.tier] || 1;
    for (let i = 0; i < w; i++) weighted.push(b);
  });
  const picked = [];
  const seen = new Set();
  for (const b of shuffle(weighted)) {
    if (!seen.has(b.id)) { picked.push(b); seen.add(b.id); }
    if (picked.length >= n) break;
  }
  return picked;
}

function onTrickTap(trick) {
  if (!trickSelectionPhase) return;
  // Find the Trick card to check its state
  let trickCard = null;
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++)
      if (gridData[r]?.[c]?._isTrick && gridData[r][c].trick.id === trick.id)
        trickCard = gridData[r][c];
  if (!trickCard) return;
  if (trickCard._trickState !== 'new' && trickCard._trickState !== 'upgradeable') return;

  if (pendingTrickChoice && pendingTrickChoice.id === trick.id) {
    confirmTrickSelection(trick);
  } else {
    pendingTrickChoice = trick;
    showTrickTooltip(trick);
    render();
  }
}

// Returns a live description with current accumulated values for scaling Tricks
function trickLiveDesc(trick) {
  const base = trick.desc;
  switch (trick.id) {
    case 'fives_discard':  return base + (bonusMult_fives  > 0 ? ` [now: +${bonusMult_fives} pips]`  : '');
    case 'nines_mult':     return base + (bonusMult_nines  > 0 ? ` [now: +${bonusMult_nines} mult]`  : '');
    case 'tens_mult':      return base + (bonusMult_tens   > 0 ? ` [now: +${bonusMult_tens} mult]`   : '');
    case 'sapling':        return `Each level, 3 random cards permanently gain +2 pips. [${level - 1} levels applied]`;
    case 'summit':     return `The lowest-ranking card in each hand scores +(its value × level) pips. [level: ${level}]`;
    case 'rising_tide':    return `Base mult increases by +1 for each level reached. [now: +${level - 1} mult]`;
    case 'compound_mult':  return base + (bonusMult_compound > 0 ? ` [now: +${bonusMult_compound.toFixed(1)} mult]` : '');
    case 'prolific':       return base + (bonusPips_prolific > 0 ? ` [now: +${bonusPips_prolific} pips]` : '');
    case 'big_win':        return base + (jackpotFired ? ` [active: +${bonusMult_jackpot} mult]` : '');
    case 'feng_shui':      return base + (bonusPips_fengshui > 0 ? ` [now: +${bonusPips_fengshui} pips]` : '');
    case 'groove':         return base + (markCount_groove   > 0 ? ` [now: +${Math.floor(markCount_groove / 2)} Focus/hand]` : '');
    case 'overtime':       return base + (markCount_overtime > 0 ? ` [now: +${Math.floor(markCount_overtime / 3)}s/hand]` : '');
    case 'assembly_line':  return base + (assemblyMarkCount   > 0 ? ` [now: next mark card +${assemblyMarkCount} mult]` : '');
    case 'veteran_bonus':  return `+2 pips per level reached this run. [now: +${(level - 1) * 2} pips]`;
    default: return base;
  }
}

function showTrickTooltip(trick, readOnly = false) {
  hideTrickTooltip();
  const gridEl = document.getElementById('grid');
  let trickEl = null;
  gridEl.querySelectorAll('.trick-card').forEach(el => {
    const cardId = el.dataset.cardId;
    for (let r = 0; r < gridRows; r++)
      for (let c = 0; c < gridCols; c++)
        if (gridData[r]?.[c]?._isTrick && gridData[r][c].trick.id === trick.id && String(gridData[r][c]._id) === cardId)
          trickEl = el;
  });
  if (!trickEl) return;

  const tip = document.createElement('div');
  tip.id = 'trick-tooltip';
  tip.className = `trick-tooltip trick-tier-${trick.tier}`;
  const hint = readOnly ? '' : `<div class="trick-tooltip-hint">Tap again to pick</div>`;
  const liveDesc = trickLiveDesc(trick);
  const discardBtn = readOnly ? `<button class="trick-tooltip-discard" id="trick-tooltip-discard-btn">Discard Trick</button>` : '';
  tip.innerHTML = `<div class="trick-tooltip-name">${trick.name}</div><div class="trick-tooltip-desc">${colorizeKeywords(withSuitHalo(liveDesc))}</div>${hint}${discardBtn}`;
  tip.style.opacity = '0';
  gridEl.appendChild(tip);

  // Wire discard button
  if (readOnly) {
    tip.querySelector('#trick-tooltip-discard-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      discardTrickFromGrid(trick);
    });
  }

  void tip.offsetWidth;

  // Position using bounding rects — works regardless of animation state
  const gridRect = gridEl.getBoundingClientRect();
  const cardRect = trickEl.getBoundingClientRect();
  const tipW = tip.offsetWidth;
  const tipH = tip.offsetHeight;
  const leftRelative = cardRect.left - gridRect.left + cardRect.width / 2 - tipW / 2;
  const topRelative  = cardRect.top  - gridRect.top  - tipH - 8;
  tip.style.left = Math.max(2, leftRelative) + 'px';
  tip.style.top  = Math.max(2, topRelative) + 'px';
  tip.style.opacity = '1';
}

function discardTrickFromGrid(trick) {
  hideTrickTooltip();
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const card = gridData[r]?.[c];
      if (card?._isTrick && card.trick.id === trick.id) {
        gridData[r][c] = drawCard() || null;
        const idx = acquiredTricks.findIndex(b => b.id === trick.id);
        if (idx >= 0) acquiredTricks.splice(idx, 1);
        showMessage(`Discarded: ${trick.name}`, 'var(--cream-dim)');
        render();
        return;
      }
    }
  }
}
function hideTrickTooltip() {
  const tip = document.getElementById('trick-tooltip');
  if (tip) tip.remove();
}

// ── Overlay Trick tooltip (reward-pick & shop) ──────────────────────────────
// A standalone bubble positioned next to an arbitrary anchor element (not the
// grid), so the full description can live in a tooltip on those screens.
let _descTipTimer = null;
function showTrickDescTooltip(trick, anchorEl) {
  hideTrickDescTooltip();
  if (!trick || !anchorEl) return;
  const tip = document.createElement('div');
  tip.id = 'trick-desc-tooltip';
  tip.className = `trick-tooltip trick-tier-${trick.tier}`;
  tip.style.position = 'fixed';
  tip.style.zIndex = '2000';
  tip.style.maxWidth = '260px';
  tip.style.minWidth = '150px';
  tip.style.pointerEvents = 'none';
  tip.innerHTML = `<div class="trick-tooltip-name">${trick.name}</div>`
                + `<div class="trick-tooltip-desc">${withSuitHalo(trickLiveDesc(trick))}</div>`;
  tip.style.opacity = '0';
  document.body.appendChild(tip);
  void tip.offsetWidth;
  const aRect = anchorEl.getBoundingClientRect();
  const tipW = tip.offsetWidth, tipH = tip.offsetHeight;
  let left = aRect.left + aRect.width / 2 - tipW / 2;
  left = Math.max(6, Math.min(window.innerWidth - tipW - 6, left));
  let top = aRect.top - tipH - 8;
  if (top < 6) top = aRect.bottom + 8;  // flip below if no room above
  tip.style.left = left + 'px';
  tip.style.top  = top + 'px';
  tip.style.opacity = '1';
  clearTimeout(_descTipTimer);
  _descTipTimer = setTimeout(hideTrickDescTooltip, 6000); // auto-dismiss safety
}
function hideTrickDescTooltip() {
  clearTimeout(_descTipTimer);
  document.getElementById('trick-desc-tooltip')?.remove();
}

// Wire hover (desktop) + tap-and-hold (mobile) on an element to show/hide a
// tooltip. Sets el._lpFired after a touch long-press so the click handler can
// skip its normal action (so "hold to read" doesn't also buy/select).
function attachHoverHold(el, showFn, hideFn) {
  let timer = null;
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && e.buttons === 0) showFn(); });
  el.addEventListener('pointerleave', e => { cancel(); if (e.pointerType === 'mouse') hideFn(); });
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return; // desktop uses hover
    el._lpFired = false;
    cancel();
    timer = setTimeout(() => { el._lpFired = true; showFn(); }, 400);
  });
  el.addEventListener('pointermove', cancel);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
}

// ── Trick Tray: render chips for all tray Tricks ──
function renderTrickTray() {
  const list = document.getElementById('trick-tray-list');
  if (!list) return;
  const countEl = document.getElementById('trick-tray-count');
  if (countEl) {
    countEl.textContent = `${trickTray.length}/${trickCapacity()}`;
    countEl.style.color = trickTray.length >= trickCapacity() ? 'var(--red)' : 'var(--gold-dim)';
  }
  list.innerHTML = '';
  if (trickTray.length === 0) {
    list.innerHTML = '<span style="font-size:11px;color:var(--cream-dim)">No tricks</span>';
    return;
  }
  trickTray.forEach(trick => {
    const chip = document.createElement('div');
    if (trick.id === 'mirror') {
      const dir = trick._tiltDir; // -1 left, +1 right, undefined = not aimed
      chip.className = `trick-tray-chip trick-tier-${trick.tier} trick-mirror`;
      chip.textContent = dir === -1 ? '◀' : dir === 1 ? '▶' : '◆';
      chip.style.transform = dir === -1 ? 'skewX(10deg)' : dir === 1 ? 'skewX(-10deg)' : 'none';
      chip.dataset.trickId = trick.id;
      chip.title = trick.name + ' — tap to aim left/right';
      chip.addEventListener('click', e => {           // single tap cycles borrow direction
        e.stopPropagation();
        trick._tiltDir = (trick._tiltDir === -1) ? 1 : -1;
        renderTrickTray();
      });
      let lpTimer = null;                              // long-press shows tooltip / discard
      const startLP = () => { lpTimer = setTimeout(() => { hideTrickTooltip(); showTrickTrayTooltip(trick, chip); }, 450); };
      const cancelLP = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
      chip.addEventListener('touchstart', startLP, { passive:true });
      chip.addEventListener('touchend', cancelLP);
      chip.addEventListener('mousedown', startLP);
      chip.addEventListener('mouseup', cancelLP);
      chip.addEventListener('mouseleave', cancelLP);
      list.appendChild(chip);
      return;
    }
    chip.className = `trick-tray-chip trick-tier-${trick.tier}`;
    chip.textContent = trick.tier.charAt(0).toUpperCase();
    chip.dataset.trickId = trick.id;
    chip.title = trick.name;
    chip.addEventListener('click', e => {
      e.stopPropagation();
      const existing = document.getElementById('trick-tooltip');
      if (existing) { hideTrickTooltip(); return; }
      showTrickTrayTooltip(trick, chip);
    });
    list.appendChild(chip);
  });
}

function showTrickTrayTooltip(trick, anchorEl) {
  hideTrickTooltip();
  const tip = document.createElement('div');
  tip.id = 'trick-tooltip';
  tip.className = `trick-tooltip trick-tier-${trick.tier}`;
  const liveDesc = trickLiveDesc(trick);
  tip.innerHTML = `<div class="trick-tooltip-name">${trick.name}</div><div class="trick-tooltip-desc">${colorizeKeywords(withSuitHalo(liveDesc))}</div><button class="trick-tooltip-discard" id="trick-tooltip-discard-btn">Discard Trick</button>`;
  tip.style.cssText = 'position:fixed;opacity:0;z-index:300;';
  document.body.appendChild(tip);
  tip.querySelector('#trick-tooltip-discard-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    discardTrickFromTray(trick);
  });
  void tip.offsetWidth;
  const ar = anchorEl.getBoundingClientRect();
  const tipW = tip.offsetWidth || 180;
  const tipH = tip.offsetHeight || 80;
  let left = ar.left + ar.width / 2 - tipW / 2;
  let top  = ar.top - tipH - 8;
  left = Math.max(4, Math.min(window.innerWidth - tipW - 4, left));
  if (top < 4) top = ar.bottom + 8;
  tip.style.left = left + 'px';
  tip.style.top  = top + 'px';
  tip.style.opacity = '1';
}

function discardTrickFromTray(trick) {
  hideTrickTooltip();
  const idx = trickTray.findIndex(b => b.id === trick.id);
  if (idx >= 0) trickTray.splice(idx, 1);
  const aidx = acquiredTricks.findIndex(b => b.id === trick.id);
  if (aidx >= 0) acquiredTricks.splice(aidx, 1);
  showMessage(`Discarded: ${trick.name}`, 'var(--cream-dim)');
  renderTrickTray();
}

// Sync the Trick tray / hand-preview panel visibility to the current trickTrayMode (no card migration).
function syncTrickTrayUI() {
  const trayArea = document.getElementById('trick-tray-area');
  const previewArea = document.getElementById('hand-preview-area');
  if (trayArea) trayArea.style.display = trickTrayMode ? 'flex' : 'none';
  if (previewArea) previewArea.style.display = trickTrayMode ? 'none' : 'flex';
  renderTrickTray();
}

// ── Toggle Trick Tray mode (dev panel) ──
function toggleTrickTrayMode(on) {
  trickTrayMode = on;
  const trayArea = document.getElementById('trick-tray-area');
  const previewArea = document.getElementById('hand-preview-area');
  if (trayArea) trayArea.style.display = on ? 'flex' : 'none';
  if (previewArea) previewArea.style.display = on ? 'none' : 'flex';
  if (on) {
    // Move all existing grid Tricks into the tray
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const cell = gridData[r][c];
        if (cell?._isTrick) {
          trickTray.push(cell.trick);
          gridData[r][c] = drawCard() || null;
        }
      }
    }
    renderTrickTray();
    render();
  } else {
    // Move tray Tricks back onto the grid
    const toInject = [...trickTray];
    trickTray = [];
    // Remove from acquiredTricks temporarily (injectTrickAfterReward -> selectTrick re-adds)
    toInject.forEach(b => {
      const idx = acquiredTricks.findIndex(ab => ab.id === b.id);
      if (idx >= 0) acquiredTricks.splice(idx, 1);
    });
    toInject.forEach(b => injectTrickAfterReward(b));
    renderTrickTray();
  }
}

async function confirmFullscreenTrickSelection(trick) {
  clearInterval(levelupTimer);
  trickSelectionPhase = false;
  hideTrickTooltip();

  const gridEl = document.getElementById('grid');

  // Place chosen Trick into its pre-assigned target cell in gridData
  const targetRow = trick._targetRow;
  const targetCol = trick._targetCol;
  const trickIdCounter = 90000 + (level * 10) + trickSelectionOptions.indexOf(trick);
  const chosenTrick = {
    rank: null, suit: null, _isTrick: true, _selectable: false,
    _trickState: 'acquired', trick, _id: trickIdCounter
  };
  // ── Salvage any normal card sitting at the target cell back into the draw pile ──
  // (Without this, the card would be silently dropped — a slow leak to the deck.)
  const displaced = gridData[targetRow][targetCol];
  if (displaced && !displaced._isTrick && displaced.rank) {
    drawPile.push({ rank: displaced.rank, suit: displaced.suit });
  }
  gridData[targetRow][targetCol] = chosenTrick;

  // Apply trick
  selectTrick(trick, true);

  // (Card speed-up deferred to 3-2-1 countdown so cards keep falling slowly throughout interlude)

  // Animate chosen Trick falling into its target cell (joins the cascade)
  const destX = cellLeft(targetCol);
  const destY = cellTop(targetRow);
  const fromAbove = 5;
  const dropDist = fromAbove * CARD_STEP;

  const flyEl = document.createElement('div');
  flyEl.className = `trick-card trick-tier-${trick.tier} temp-anim`;
  flyEl.innerHTML = `<div class="trick-tier-label">${trick.tier.charAt(0).toUpperCase()}</div><div class="trick-name">${trick.name}</div>`;
  flyEl.dataset.cardId = String(trickIdCounter);
  flyEl.style.cssText = `position:absolute;width:${CARD_W}px;height:${CARD_H}px;left:${destX}px;top:${destY - dropDist}px;opacity:0;pointer-events:none;z-index:20;`;
  gridEl.appendChild(flyEl);

  const FALL_DUR = 520;
  const BOUNCE_PX = 8;
  const SQUISH = 0.10;
  const trickAnim = flyEl.animate([
    { opacity: 0, transform: 'translateY(0) scaleY(1)' },
    { opacity: 1, transform: 'translateY(0) scaleY(1)',                                                    offset: 0.06 },
    { opacity: 1, transform: `translateY(${dropDist * 0.55}px) scaleY(0.96)`,                             offset: 0.55, easing: 'ease-in' },
    { opacity: 1, transform: `translateY(${dropDist + BOUNCE_PX}px) scaleY(${1 - SQUISH})`,               offset: 0.83 },
    { opacity: 1, transform: `translateY(${dropDist - BOUNCE_PX * 0.7}px) scaleY(${1 + SQUISH})`,         offset: 0.91 },
    { opacity: 1, transform: `translateY(${dropDist + BOUNCE_PX * 0.3}px) scaleY(${1 - SQUISH * 0.2})`,   offset: 0.96 },
    { opacity: 1, transform: `translateY(${dropDist}px) scaleY(1)` },
  ], { duration: FALL_DUR, easing: 'ease-in', fill: 'forwards' });

  await trickAnim.finished;
  flyEl.remove();

  // Render so the Trick appears in its grid cell (also cleans up any leftover temp-anim elements)
  document.getElementById('grid').querySelectorAll('.temp-anim').forEach(el => el.remove());
  render();

  if (pendingLevelUps > 0) {
    pendingLevelUps--;
    setTimeout(() => drainLevelUpQueue(), 400);
  } else {
    showNextGoalFlash().then(() => show321Countdown()).then(() => {
      gameTimerPaused = false;
      sfxRoundStart();
      startRoundTimer();
      updateClockUI();
      render();
    });
  }
}

async function confirmTrickSelection(trick) {
  if (!trickSelectionPhase) return;
  clearInterval(levelupTimer);
  trickSelectionPhase = false;
  pendingTrickChoice = null;
  hideTrickTooltip();

  // Only remove NEW unchosen Tricks — acquired/upgradeable/upgraded stay in the grid
  const unchosenCells = [];
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const cell = gridData[r][c];
      if (cell?._isTrick && cell._trickState === 'new' && cell.trick.id !== trick.id)
        unchosenCells.push([r, c]);
    }

  // Mark chosen Trick settled — acquired or upgraded depending on prior state
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const cell = gridData[r][c];
      if (!cell?._isTrick || cell.trick.id !== trick.id) continue;
      cell._selectable = false;
      cell._trickState = cell._trickState === 'upgradeable' ? 'upgraded' : 'acquired';
    }

  // Apply trick (stack if upgrading — option 4)
  const isUpgrade = (() => {
    for (let r = 0; r < gridRows; r++)
      for (let c = 0; c < gridCols; c++)
        if (gridData[r][c]?._isTrick && gridData[r][c].trick.id === trick.id && gridData[r][c]._trickState === 'upgraded')
          return true;
    return false;
  })();

  // Apply trick (stack on upgrade — apply twice)
  selectTrick(trick, true);
  if (isUpgrade) selectTrick(trick, true);

  // Let gravity handle unchosen Trick removal + card settling
  if (unchosenCells.length > 0) {
    await removeAndFall(unchosenCells, 'discard');
  }

  render();

  if (pendingLevelUps > 0) {
    // More level-ups queued — chain into next one
    pendingLevelUps--;
    setTimeout(() => drainLevelUpQueue(), 400);
  } else {
    // All done — 3-2-1 then start round
    show321Countdown().then(() => {
      sfxRoundStart();
      startRoundTimer();
      updateClockUI();
      render();
    });
  }
}


function selectTrick(trick, fromTrickFlow = false) {
  clearInterval(levelupTimer);
  acquiredTricks.push(trick);

  // Positional bonuses get a randomly assigned axis+index at pick time
  const positionalIds = ['rowcol_triple_pips','rowcol_mult','rowcol_retrigger','perfect_timing','right_time','study_hall','groove','assembly_line','overtime'];
  if (positionalIds.includes(trick.id)) {
    const axis = Math.random() < 0.5 ? 'row' : 'col';
    const index = Math.floor(Math.random() * (axis === 'row' ? gridRows : gridCols));
    rowColBonuses.push({ id: trick.id, axis, index });
    trick.desc = trick.desc.replace('a specific row or column', `${axis} ${index + 1}`)
                            .replace('a marked row or column', `${axis} ${index + 1}`)
                            .replace('a specific grid intersection', `(${axis === 'row' ? 'row' : 'col'} ${index + 1})`);
  }

  updateTrickList();
  const lvlOverlay = document.getElementById('levelup-overlay');
  if (lvlOverlay) lvlOverlay.classList.remove('show');

  if (fromTrickFlow) return; // confirmTrickSelection handles timer + render

  if (pendingLevelUps > 0) {
    // More levels queued — show next trick screen after a short pause
    pendingLevelUps--;
    setTimeout(() => drainLevelUpQueue(), 400);
  } else {
    // All done — resume round
    startRoundTimer();
    updateClockUI();
    render();
    // Spawn challenge card only on a real level-up pick, not a challenge reward pick
    if (!isChallengeTrickPick && level % 3 === 0) setTimeout(spawnChallengeCard, 500);
    isChallengeTrickPick = false;
  }
}

// ══════════════════════════════════════════════
// GAME END
// ══════════════════════════════════════════════
function updateActProgressUI() {
  const labelEl = document.getElementById('game-timer-label');
  const valEl   = document.getElementById('game-timer');
  if (!labelEl || !valEl) return;
  if (ACTIVE_MODE.id === 'normal') {
    labelEl.textContent = 'Progress';
    if (bossActive) {
      valEl.textContent  = `ACT ${actNumber} · BOSS`;
      valEl.style.color  = '#ff6b6b';
    } else {
      valEl.textContent  = `ACT ${actNumber} · ${nodeInAct}/5`;
      valEl.style.color  = '';
    }
  } else {
    labelEl.textContent = 'Game Timer';
    valEl.style.color   = '';
    // Timer loop keeps the value up to date in non-Normal modes
  }
}

function onGameWin() {
  stopTimers();
  const overlay = document.getElementById('end-overlay');
  const title   = document.getElementById('end-title');
  title.textContent = 'VICTORY';
  title.className   = 'victory';

  const secondsPlayed = Math.floor((Date.now() - gameStartTime) / 1000);
  const m = Math.floor(secondsPlayed / 60);
  const s = secondsPlayed % 60;
  document.getElementById('end-stats').innerHTML = `
    Run Complete: <strong>3 Acts</strong><br>
    Total Score: <strong>${(totalScore + score).toLocaleString()}</strong><br>
    Time Played: <strong>${m}:${s.toString().padStart(2,'0')}</strong><br>
    Levels Cleared: <strong>${level}</strong><br>
    Hands Played: <strong>${handsPlayed}</strong><br>
    Best Hand: <strong>${highestHandName ? `${highestHandName} (${highestHandScore.toLocaleString()})` : '—'}</strong>
  `;
  overlay.classList.add('show');
}

function onGameEnd(gameover) {
  stopTimers();
  const overlay = document.getElementById('end-overlay');
  const title = document.getElementById('end-title');
  title.textContent = gameover ? 'GAME OVER' : "TIME'S UP";
  title.className = gameover ? 'gameover' : 'timeup';

  const secondsPlayed = Math.floor((Date.now() - gameStartTime) / 1000);
  const m = Math.floor(secondsPlayed / 60);
  const s = secondsPlayed % 60;
  const timePlayed = `${m}:${s.toString().padStart(2,'0')}`;

  document.getElementById('end-stats').innerHTML = `
    Total Score: <strong>${(totalScore + score).toLocaleString()}</strong><br>
    Time Lasted: <strong>${timePlayed}</strong><br>
    Level Reached: <strong>${level}</strong><br>
    Hands Played: <strong>${handsPlayed}</strong><br>
    Best Hand: <strong>${highestHandName ? `${highestHandName} (${highestHandScore.toLocaleString()})` : '—'}</strong><br>
    Tricks: <strong>${acquiredTricks.length}</strong>
  `;
  overlay.classList.add('show');
}

// ══════════════════════════════════════════════
// BUTTON EVENTS
// ══════════════════════════════════════════════
let _lastPlayClick = 0;
document.getElementById('btn-play').addEventListener('click', () => {
  // Debounce: mobile taps can fire the click twice ~150-200ms apart, and the second
  // call would abort the first hand's score animation. Ignore a 2nd press within 250ms.
  const _now = Date.now();
  if (_now - _lastPlayClick < 250) { dbgEvent('info', 'play double-click ignored'); return; }
  _lastPlayClick = _now;
  cancelAutoSubmit();
  playHand();
});
document.getElementById('btn-discard').addEventListener('click', doDiscard);

// ══════════════════════════════════════════════
