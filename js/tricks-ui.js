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
// Owner rule: every Trick whose bonus can change always shows its CURRENT value
// in parentheses. Persistent/level/owned-based tricks always have a number.
// Round-scoped tricks (they scale with round time / round counters) can only be
// computed during a live round — in the shop or reward grid they show "(N/A)".
function trickLiveDesc(trick) {
  const base = trick.desc;
  try {
    const B = (typeof BAL !== 'undefined') ? BAL : {};
    const live = (typeof gameTimerPaused === 'undefined') ? true : !gameTimerPaused;
    const el   = Math.max(0, roundStartSeconds - roundSeconds);   // seconds elapsed this round
    const now      = (v) => `${base} (now ${v})`;                 // always-meaningful
    const roundNow = (v) => `${base} ${live ? `(now ${v})` : '(N/A)'}`; // round-scoped
    switch (trick.id) {
      // ── permanent accumulators / level / owned-based (always a number) ──
      case 'fives_discard':  return now(`+${bonusMult_fives || 0} pips`);
      case 'nines_mult':     return now(`+${bonusMult_nines || 0} mult`);
      case 'tens_mult':      return now(`+${bonusMult_tens || 0} mult`);
      case 'compound_mult':  return now(`+${(bonusMult_compound || 0).toFixed(1)} mult`);
      case 'prolific':       return now(`+${bonusPips_prolific || 0} pips`);
      case 'acorns':         return now(`+${Math.floor(bonusFocus_acorns || 0)} Focus/hand · ${(bonusFocus_acorns || 0).toFixed(2)} stored`);
      case 'plan_ahead':     return now(`+${Math.max(1, Math.round((handsPlayedGame || 0) / Math.max(1, level)))} Focus every 3rd hand`);
      case 'more_better':    return now(`+${bonusMult_morebetter || 0} mult`);
      case 'big_win':        return now(`+${bonusMult_jackpot || 0} mult`);
      case 'feng_shui':      return now(`+${bonusPips_fengshui || 0} pips`);
      case 'sapling':        return now(`${level - 1} levels applied`);
      case 'summit':         return now(`level ${level}`);
      case 'rising_tide':    return now(`+${level - 1} mult`);
      case 'veteran_bonus':  return now(`+${(level - 1) * (B.veteran_bonus?.pips_per_level ?? 2)} pips`);
      case 'hummingbird':    return now(`+${(pauseInstanceGame || 0) * (B.hummingbird?.mult_per_pause ?? 2)} mult`);
      case 'magician':       return now(`+${ownedSleightCount() * (B.magician?.mult_per_sleight ?? 3)} mult`);
      case 'stand_up':       return now(`+${sleightChargeInfo().total * (B.stand_up?.pips_per_charge ?? 10)} pips`);
      case 'scalper':        return now(`×${(1 + (B.scalper?.pip_mult_per_missing ?? 0.2) * sleightChargeInfo().missing).toFixed(2)} pips`);
      // ── position-line accumulators (reset each round) ──
      case 'groove':         return roundNow(`+${Math.floor((markCount_groove || 0) / 2)} Focus/hand`);
      case 'overtime':       return roundNow(`+${Math.floor((markCount_overtime || 0) / 3)}s/hand`);
      case 'assembly_line':  return roundNow(`next mark card +${assemblyMarkCount || 0} mult`);
      // ── round-time / round-counter scaling (live round only) ──
      case 'swift':          return roundNow(`+${Math.floor(el / B.swift.interval_seconds) * B.swift.mult_per_interval} mult`);
      case 'sediment':       return roundNow(`+${Math.floor(el / B.sediment.interval_seconds) * B.sediment.pips_per_interval} pips`);
      case 'albatross':      return roundNow(`+${(pausedSecondsRound || 0) * B.albatross.pips_per_second} pips`);
      case 'kingfisher':     return roundNow(`+${Math.floor(((pausedSecondsRound || 0) + (rewoundSecondsRound || 0)) / B.kingfisher.interval_seconds) * B.kingfisher.mult_per_interval} mult`);
      case 'still_water': { const e = (lastSwapRoundSeconds !== null) ? Math.max(0, lastSwapRoundSeconds - roundSeconds) : el; return roundNow(`+${B.still_water.mult_per_interval * Math.floor(e / 10)} mult`); }
      case 'spade_flood':    return roundNow(`+${Math.floor(roundSeconds / B.spade_flood.time_div)} pips`);
      case 'sands_of_time':  return roundNow(`+${Math.floor(roundSeconds / B.sands_of_time.divisor)} pips`);
      case 'discard_pips':   return roundNow(`+${(cardsDiscardedRound || 0) * B.discard_pips.pips_per_discard} pips`);
      case 'landfill':       return roundNow(`+${Math.floor((cardsDiscardedRound || 0) / B.landfill.discards_per) * B.landfill.mult_per_n} mult`);
      case 'escalation':     return roundNow(`+${Math.max(0, (handsPlayedRound || 0) - 5)} mult`);
      case 'combo_score':    return roundNow(`+${(handTypesRound ? handTypesRound.size : 0) * B.combo_score.mult_per_type} mult`);
      default: return base;
    }
  } catch (e) { return base; }
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
  const _sv = (typeof trickSellValue === 'function') ? trickSellValue(trick) : 0;
  const actionBtns = readOnly
    ? `<div class="trick-tooltip-actions"><button class="trick-tooltip-sell" id="trick-tooltip-sell-btn">Sell 💰${_sv}</button>`
      + `<button class="trick-tooltip-discard" id="trick-tooltip-discard-btn">Discard</button></div>`
    : '';
  tip.innerHTML = `<div class="trick-tooltip-name">${trick.name}</div><div class="trick-tooltip-desc">${colorizeKeywords(withSuitHalo(liveDesc))}</div>${hint}${actionBtns}`;
  tip.style.opacity = '0';
  gridEl.appendChild(tip);

  // Wire sell + discard buttons
  if (readOnly) {
    tip.querySelector('#trick-tooltip-sell-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      sellTrick(trick);
    });
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
    list.innerHTML = '';   // empty → faint TRICKS watermark shows through (r95)
    return;
  }
  // Reward-grid-style CRT/neon card tiles inside a scrolling marquee track (r113).
  const RARS = ['common','rare','epic','legendary','mythic'];
  const track = document.createElement('div');
  track.className = 'chip-marquee';
  trickTray.forEach(trick => {
    const chip = document.createElement('div');
    const rar = RARS.includes(trick.tier) ? trick.tier : 'common';
    chip.className = `trick-tray-chip trick-card trick-tier-${trick.tier} rar-${rar}`;
    chip.dataset.trickId = trick.id;
    if (trick.id === 'mirror') {
      const dir = trick._tiltDir; // -1 left, +1 right, undefined = not aimed
      chip.classList.add('trick-mirror');
      chip.innerHTML = `<div class="trick-card-emoji">${dir === -1 ? '◀' : dir === 1 ? '▶' : '◆'}</div>`
                     + `<div class="trick-card-name">${trick.name}</div>`;
      chip.title = trick.name + ' — tap to aim left/right';
      chip.addEventListener('click', e => {           // single tap cycles borrow direction
        e.stopPropagation();
        trick._tiltDir = (trick._tiltDir === -1) ? 1 : -1;
        renderTrickTray();
      });
    } else {
      chip.innerHTML = `<div class="trick-card-emoji">${trickEmoji(trick)}</div>`
                     + `<div class="trick-card-name">${trick.name}</div>`;
      chip.addEventListener('click', e => {
        e.stopPropagation();
        const existing = document.getElementById('trick-tooltip');
        if (existing) { hideTrickTooltip(); return; }
        showTrickTrayTooltip(trick, chip);
      });
    }
    track.appendChild(chip);
  });
  list.appendChild(track);
  // Slow horizontal auto-scroll if the strip overflows (no scroll UI).
  applyChipMarquee(list, track);
  // Hover tooltips for every tile (originals + marquee clones).
  list.querySelectorAll('.trick-tray-chip').forEach(chip => {
    const trick = trickTray.find(t => t.id === chip.dataset.trickId);
    if (trick) attachTrickHover(chip, trick);
  });
}

// Hover → show tooltip; a short grace on leave lets the pointer reach the
// tooltip (and its Discard button) before it hides.
let _trickHoverTimer = null;
function cancelTrickHoverHide() { if (_trickHoverTimer) { clearTimeout(_trickHoverTimer); _trickHoverTimer = null; } }
function scheduleTrickHoverHide() { cancelTrickHoverHide(); _trickHoverTimer = setTimeout(hideTrickTooltip, 160); }
function attachTrickHover(chip, trick) {
  chip.addEventListener('mouseenter', () => { cancelTrickHoverHide(); showTrickTrayTooltip(trick, chip); });
  chip.addEventListener('mouseleave', scheduleTrickHoverHide);
}

function showTrickTrayTooltip(trick, anchorEl) {
  hideTrickTooltip();
  const tip = document.createElement('div');
  tip.id = 'trick-tooltip';
  tip.className = `trick-tooltip trick-tier-${trick.tier}`;
  const liveDesc = trickLiveDesc(trick);
  const _sv = (typeof trickSellValue === 'function') ? trickSellValue(trick) : 0;
  tip.innerHTML = `<div class="trick-tooltip-name">${trick.name}</div><div class="trick-tooltip-desc">${colorizeKeywords(withSuitHalo(liveDesc))}</div>`
                + `<div class="trick-tooltip-actions"><button class="trick-tooltip-sell" id="trick-tooltip-sell-btn">Sell 💰${_sv}</button>`
                + `<button class="trick-tooltip-discard" id="trick-tooltip-discard-btn">Discard</button></div>`;
  tip.style.cssText = 'position:fixed;opacity:0;z-index:300;';
  document.body.appendChild(tip);
  tip.querySelector('#trick-tooltip-sell-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    sellTrick(trick);
  });
  tip.querySelector('#trick-tooltip-discard-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    discardTrickFromTray(trick);
  });
  // Keep the bubble open while the pointer is over it (so Discard is clickable).
  tip.addEventListener('mouseenter', cancelTrickHoverHide);
  tip.addEventListener('mouseleave', scheduleTrickHoverHide);
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

  // Positional bonuses get an axis+index at pick time — steered by the position knacks
  // (Surveyor/Leveler/Alignment/District). See assignPositionMark() in scoring.js.
  assignPositionMark(trick);

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
  if (isActMode()) {
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
