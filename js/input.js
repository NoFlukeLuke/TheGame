const DOUBLE_TAP_MS = 350;

let isSwiping = false;
let swipeStopped = false;

// Auto-submit
const AUTO_SUBMIT_DELAY = 2000; // ms
let autoSubmitTimer = null;
let handReadyForSubmit = false; // true once an invalid card is hit mid-swipe

function cancelAutoSubmit() {
  if (autoSubmitTimer) { clearTimeout(autoSubmitTimer); autoSubmitTimer = null; }
  handReadyForSubmit = false;
}

// Watchdog: a play/discard submitted mid-animation is queued (pendingAction), then
// auto-executed here once the animating/falling flags settle. Double-safe with the
// falling-complete flush — whichever fires first clears pendingAction atomically.
let _queuedRetries = 0;
function scheduleQueuedRetry() {
  _queuedRetries = 0;
  (function retry() {
    if (!pendingAction) return;
    if (animating || falling) {
      if (_queuedRetries++ > 60) { dbgEvent('warn', 'queued action timed out', { pendingAction }); pendingAction = null; return; }
      setTimeout(retry, 60); return;
    }
    const q = pendingAction; pendingAction = null;
    dbgEvent('info', 'executing queued ' + q + ' (animation settled)');
    if (q === 'play') playHand();
    else if (q === 'discard') doDiscard();
  })();
}

function scheduleAutoSubmit() {
  cancelAutoSubmit();
  if (danceAbortController) return; // dance in progress, don't schedule
  const result = selected.length >= 2 ? findBestHand(selected) : null;
  if (!result) return; // no valid hand, don't schedule
  handReadyForSubmit = true;
  render(); // trigger pulse immediately
  autoSubmitTimer = setTimeout(() => {
    autoSubmitTimer = null;
    handReadyForSubmit = false;
    if (!animating && !falling && selected.length >= 2) playHand();
  }, AUTO_SUBMIT_DELAY);
}

function cardAt(el) {
  let node = el;
  while (node && node !== document.getElementById('grid')) {
    if (node.classList && (node.classList.contains('card') || node.classList.contains('trick-card')) && node.dataset.row !== undefined)
      return [parseInt(node.dataset.row), parseInt(node.dataset.col)];
    node = node.parentElement;
  }
  return null;
}

function doSwap(r1, c1, r2, c2) {
  // Pivot: if either card is a Pivot sleight, this swap is free + buffs both cards.
  const cardA = gridData[r1]?.[c1], cardB = gridData[r2]?.[c2];
  const isPivotSwap = (cardA?._isSleight && sleightDef(cardA)?.id === 'pivot') ||
                      (cardB?._isSleight && sleightDef(cardB)?.id === 'pivot');
  const freeThisSwap = isPivotSwap || sleightFreeSwapPending;

  // Guard: block swap when out of swaps (Steady Hand or a free swap bypasses limit)
  if (swaps <= 0 && !hasKnack('steady_hand') && !freeThisSwap) {
    const btn = document.getElementById('btn-swap');
    if (btn) { btn.style.borderColor='var(--red)'; btn.style.color='var(--red)'; setTimeout(()=>{btn.style.borderColor='';btn.style.color='';},500); }
    swapPending = null; render(); return;
  }
  const notAdjacent = Math.abs(r1-r2) + Math.abs(c1-c2) !== 1;
  if (notAdjacent && !hasTrick('free_range')) {
    const btn = document.getElementById('btn-swap');
    if (btn) { btn.style.borderColor = 'var(--red)'; btn.style.color = 'var(--red)';
      setTimeout(() => { btn.style.borderColor = ''; btn.style.color = ''; }, 500); }
    swapPending = null;
    render();
    return;
  }
  // Capture card IDs and old positions for FLIP animation (before data swap)
  const _swId1 = gridData[r1]?.[c1]?._id;
  const _swId2 = gridData[r2]?.[c2]?._id;
  const _swDx = cellLeft(c2) - cellLeft(c1);
  const _swDy = cellTop(r2) - cellTop(r1);

  const tmp = gridData[r1][c1];
  gridData[r1][c1] = gridData[r2][c2];
  gridData[r2][c2] = tmp;

  // Pivot: buff both swapped (non-sleight) cards with +5 permanent mult
  if (isPivotSwap) {
    [[r1,c1],[r2,c2]].forEach(([r,c]) => {
      const card = gridData[r][c];
      if (card && !card._isSleight && card.rank) {
        const k = cardKey(card.rank, card.suit);
        permMult[k] = (permMult[k] || 0) + BAL.pivot.mult;
      }
    });
  }

  // Swap charge — skipped on a free swap; Steady Hand bypasses the limit
  if (!hasKnack('steady_hand') && !freeThisSwap) swaps--;
  if (!freeThisSwap) spendRoundTime(SWAP_TIME_COST);   // swaps cost time (free swaps exempt)
  if (sleightFreeSwapPending) sleightFreeSwapPending = false;
  // Swap time cost — 0s for first 2 swaps/round, 0s with Free Swaps, 20s with Steady Hand, else 10s
  let swapTimeCost = BAL._resources.swap_seconds;
  if (freeThisSwap || hasKnack('free_swaps')) swapTimeCost = 0;
  else if (freeSwapsLeft > 0) { freeSwapsLeft--; swapTimeCost = 0; }
  else if (hasKnack('steady_hand')) swapTimeCost = BAL.steady_hand.swap_seconds;
  if (swapTimeCost > 0) {
    roundSeconds = Math.max(1, roundSeconds - swapTimeCost);
    showTimeCost(`-${swapTimeCost}s`);
  }
  updateClockUI();
  lastSwapTime = Date.now();
  lastSwapRoundSeconds = roundSeconds; // for Eagle Eye
  resetFocusDecayTimer();
  // Restless: swapping adds 1 focus
  if (hasTrick('restless')) addFocus(1);
  // ♥ corruption: a swapped heart goes "on probation" — it must appear in the next scored
  // hand or it corrupts (resolved in playHand; also corrupts if discarded). Re-swapping
  // just re-arms the flag (fresh chance). Already-locked hearts are unaffected.
  if (exaltCorruptEnabled) [[r1,c1],[r2,c2]].forEach(([_r,_c]) => {
    const _card = gridData[_r]?.[_c];
    if (!_card || _card.suit !== '♥' || _card._exalted || _card._corrupted) return;
    _card._heartSwapPending = true;
  });
  selected = [];
  swapPending = null;
  // on_swap sleights (Dazed reshuffle, Pivot charge/message) fire after the swap
  fireSleightsOnSwap(r1, c1, r2, c2);
  render();
  // FLIP swap animation: snap to new position in render(), then animate back from old
  if (_swDx * _swDx + _swDy * _swDy > 0) {
    const _swGridEl = document.getElementById('grid');
    const _el1 = _swId1 ? _swGridEl.querySelector(`[data-card-id="${_swId1}"]`) : null;
    const _el2 = _swId2 ? _swGridEl.querySelector(`[data-card-id="${_swId2}"]`) : null;
    const _dur = 220, _ease = 'cubic-bezier(0.25,0.46,0.45,0.94)';
    if (_el1) _el1.animate([{ transform:`translate(${-_swDx}px,${-_swDy}px) scale(1.09)`,offset:0 },{ transform:'translate(0,0) scale(1)',offset:1 }], { duration: _dur, easing: _ease });
    if (_el2) _el2.animate([{ transform:`translate(${_swDx}px,${_swDy}px) scale(1.09)`,offset:0 },{ transform:'translate(0,0) scale(1)',offset:1 }], { duration: _dur, easing: _ease });
  }
}

// Remove a card from selection, then keep only the largest connected component.
// Ties broken by keeping the component containing the lowest selection index.
function deselect(r, c) {
  const idx = selected.findIndex(([sr,sc]) => sr===r && sc===c);
  if (idx === -1) return;

  const remaining = selected.filter((_,i) => i !== idx);
  if (remaining.length === 0) { selected = []; render(); return; }

  // Find connected components among remaining
  const inRemaining = new Set(remaining.map(([r,c]) => `${r}-${c}`));
  const visited = new Set();
  const components = [];

  for (const cell of remaining) {
    const k = `${cell[0]}-${cell[1]}`;
    if (visited.has(k)) continue;
    // BFS
    const comp = [];
    const queue = [cell];
    while (queue.length) {
      const [cr,cc] = queue.shift();
      const ck = `${cr}-${cc}`;
      if (visited.has(ck)) continue;
      visited.add(ck);
      comp.push([cr,cc]);
      getNeighbors(cr,cc).forEach(([nr,nc]) => {
        if (inRemaining.has(`${nr}-${nc}`) && !visited.has(`${nr}-${nc}`))
          queue.push([nr,nc]);
      });
    }
    components.push(comp);
  }

  // Keep largest; tie-break by lowest original selection index
  let best = components[0];
  for (const comp of components) {
    if (comp.length > best.length) { best = comp; continue; }
    if (comp.length === best.length) {
      const bestMinIdx = Math.min(...best.map(([r,c]) => selected.findIndex(([sr,sc])=>sr===r&&sc===c)));
      const compMinIdx = Math.min(...comp.map(([r,c]) => selected.findIndex(([sr,sc])=>sr===r&&sc===c)));
      if (compMinIdx < bestMinIdx) best = comp;
    }
  }

  // Preserve original selection order for the winning component
  const bestSet = new Set(best.map(([r,c]) => `${r}-${c}`));
  selected = selected.filter(([r,c]) => bestSet.has(`${r}-${c}`));
  scheduleAutoSubmit();
  render();
}

function tryAddToSelection(r, c) {
  const _card = gridData[r]?.[c];
  const _cs = _card ? `${_card.rank}${_card.suit}` : 'null';
  if (selected.length >= limits.selection.current) { dbgEvent('warn', `add blocked: selection full [${r},${c}] ${_cs}`); return false; }
  if (isCellBlocked(r, c)) { dbgEvent('warn', `add blocked: cell blocked [${r},${c}]`); return false; }
  if (!cardCan(gridData[r]?.[c], 'select')) { dbgEvent('warn', `add blocked: cardCan=false [${r},${c}] ${_cs}`); return false; }
  const key = `${r}-${c}`;
  if (selected.some(([sr,sc]) => sr===r && sc===c)) return false;
  const reachable = getReachable();
  if (reachable && !reachable.has(key)) { dbgEvent('warn', `add blocked: not reachable [${r},${c}]`); return false; }
  selected.push([r, c]);
  dbgEvent('info', `selected [${r},${c}] ${_cs} (total:${selected.length})`);
  sfxCardSelect();
  scheduleAutoSubmit();
  render();
  return true;
}

// ── Tap handler (called on pointerup when pointer didn't move) ──
function onCardTap(r, c) {
  if (_longPressActive) { _longPressActive = false; return; }
  const _card = gridData[r]?.[c];
  const _cardStr = _card ? `${_card.rank}${_card.suit}` : 'null';
  dbgEvent('info', `tap [${r},${c}] ${_cardStr}`, { animating, trickPhase: trickSelectionPhase, swapPending: !!swapPending, selected: selected.length });
  if (animating) { dbgEvent('warn', `tap blocked: animating`); return; }
  // ── Magnet: armed and waiting for a target-rank tap ──
  if (magnetArmed) {
    // Tapping Magnet itself (or its cell) cancels the arming.
    if (magnetArmed.r === r && magnetArmed.c === c) {
      magnetArmed = null; showMessage('Magnet cancelled', 'var(--cream-dim)'); render(); return;
    }
    const _t = gridData[r]?.[c];
    if (!_t || !_t.rank || _t._isSleight || _t._isStone || _t._isTrick) {
      showMessage('Tap a normal card to pull its rank', 'var(--cream-dim)'); return;
    }
    const _m = magnetArmed; magnetArmed = null;
    const _moved = magnetCluster(_m.r, _m.c, _t.rank);
    lockSleightForRound(_m.card); // spends a charge / locks for the round
    showMessage(_moved ? `🧲 Magnet pulled ${_moved} ${_t.rank}${_moved > 1 ? 's' : ''} in` : `🧲 No ${_t.rank}s to pull`, _moved ? '#8fd0ff' : 'var(--cream-dim)');
    render();
    return;
  }
  // Block null cells
  if (gridData[r][c] === null) { dbgEvent('warn', `tap blocked: null cell [${r},${c}]`); return; }
  // Block boss-obstructed cells
  if (isCellBlocked(r, c)) { dbgEvent('warn', `tap blocked: cell blocked [${r},${c}]`); return; }
  // Block challenge card taps
  if (challengeActive && challengeCard && challengeCard.pos[0]===r && challengeCard.pos[1]===c) { dbgEvent('warn', `tap blocked: challenge card`); return; }
  // Block non-swappable cards entirely (e.g. challenge card)
  // Aim sleights (Reflect, Soul Mirror): a single tap rotates aim; no select/swap.
  {
    const _ac = gridData[r]?.[c];
    if (_ac?._isSleight && AIM_SLEIGHTS.has(sleightDef(_ac)?.id)) {
      cycleSleightAim(_ac);
      render();
      return;
    }
  }
  if (!cardCan(gridData[r]?.[c], 'select') && !cardCan(gridData[r]?.[c], 'swap')) { dbgEvent('warn', `tap blocked: cardCan=false`, { card: _cardStr }); return; }

  const now = Date.now();
  const isDoubleTap = lastTapCell &&
    lastTapCell[0] === r && lastTapCell[1] === c &&
    (now - lastTapTime) < DOUBLE_TAP_MS;

  // Sleights select/swap like normal cards (tooltip shown via long-press).
  // double_tap-activated sleights (none in current pool) would intercept here:
  if (!trickSelectionPhase && gridData[r]?.[c]?._isSleight) {
    const jdef = sleightDef(gridData[r][c]);
    if (jdef?.activation === 'double_tap' && isDoubleTap) {
      const jcard = gridData[r][c];
      lastTapTime = 0; lastTapCell = null;
      // Stopwatch: custom freeze (not the once-per-round-locked charge model). Double-tap toggles.
      if (jdef.id === 'stopwatch') {
        hideSleightGridTooltip();
        if (stopwatchActive && stopwatchCardPos && stopwatchCardPos.card === jcard) {
          endStopwatch(); showMessage('⏱️ Stopwatch — stopped', 'var(--cream-dim)');
        } else if (!stopwatchActive) {
          if (jcard._usesLeft !== 'infinite' && jcard._usesLeft <= 0) showMessage('Stopwatch is spent', 'var(--cream-dim)');
          else startStopwatch(jcard, r, c);
        }
        return;
      }
      if (!sleightCanActivateThisRound(jcard)) {
        showMessage(`${jdef.name} already used this round`, 'var(--cream-dim)');
        return;
      }
      hideSleightGridTooltip();
      // Magnet: don't fire yet — arm it and wait for the player to tap a target card.
      // (Lock/charge are spent when the cluster actually happens, in the intercept below.)
      if (jdef.id === 'magnet') {
        magnetArmed = { r, c, card: jcard };
        showMessage('Magnet armed — tap a card to pull its rank', '#8fd0ff');
        render();
        return;
      }
      applySleightGridEffect(jdef.id, r, c);
      lockSleightForRound(jcard);
      return;
    }
    // otherwise fall through to normal selection/swap handling below
  }

  // Trick during normal play — double-tap enters swap; long-press shows tooltip
  if (!trickSelectionPhase && gridData[r]?.[c]?._isTrick) {
    if (isDoubleTap) {
      hideCardTooltip();
      cancelAutoSubmit();
      swapPending = [r, c];
      selected = [];
      lastTapTime = 0; lastTapCell = null;
      render();
      return;
    }
    lastTapCell = [r, c]; lastTapTime = now;
    return;
  }

  // Handle swap-pending
  if (swapPending) {
    const [pr, pc] = swapPending;
    if (r === pr && c === pc) {
      // Same card — cancel swap
      swapPending = null;
      render();
    } else {
      doSwap(pr, pc, r, c);
    }
    lastTapTime = 0; lastTapCell = null;
    return;
  }

  // Double-tap → enter swap mode
  if (isDoubleTap) {
    cancelAutoSubmit();
    swapPending = [r, c];
    selected = [];
    lastTapTime = 0; lastTapCell = null;
    render();
    return;
  }

  // Already selected → deselect with component logic
  if (selected.some(([sr,sc]) => sr===r && sc===c)) {
    deselect(r, c);
  } else {
    // Try to add; if not reachable, clear and start fresh
    const reachable = getReachable();
    const key = `${r}-${c}`;
    if (reachable && !reachable.has(key)) {
      cancelAutoSubmit();
      selected = [[r, c]];
      sfxCardSelect();
      scheduleAutoSubmit();
      render();
    } else {
      tryAddToSelection(r, c);
    }
  }

  lastTapCell = [r, c];
  lastTapTime = now;
}

// ── Pointer event handlers on the grid ──
const gridEl2 = document.getElementById('grid');

gridEl2.addEventListener('pointerdown', e => {
  if (animating || roundEnded) { dbgEvent('warn', 'grid input blocked', { animating, roundEnded, falling, dance: !!danceAbortController }); return; }
  const cell = cardAt(e.target);
  if (!cell) { dbgEvent('warn', 'tap missed a card (overlay covering grid?)', { tgt: String(e.target?.id || e.target?.className || e.target?.tagName || '?').slice(0,48) }); return; }
  gridEl2.setPointerCapture(e.pointerId);
  isSwiping = false;
  swipeStopped = false;
  gridEl2._pointerStart = { r: cell[0], c: cell[1], moved: false };
});

gridEl2.addEventListener('pointermove', e => {
  if (animating || roundEnded || !gridEl2._pointerStart) return;
  const cell = cardAt(document.elementFromPoint(e.clientX, e.clientY));
  if (!cell) return;
  const [r, c] = cell;
  const ps = gridEl2._pointerStart;

  // Detect movement
  if (r !== ps.r || c !== ps.c) {
    if (!ps.moved) {
      // First movement — officially start swipe, add the origin card first
      ps.moved = true;
      isSwiping = true;
      swipeStopped = false;
      // Guard: don't start a swipe on a stone, Trick, or void cell
      const originCard = gridData[ps.r]?.[ps.c];
      if (isCellBlocked(ps.r, ps.c) || !originCard || !cardCan(originCard, 'select')) {
        swipeStopped = true;
        return;
      }
      // Only start fresh if no selection yet, or origin isn't part of selection
      const originKey = `${ps.r}-${ps.c}`;
      if (!selected.some(([sr,sc]) => sr===ps.r && sc===ps.c)) {
        // Origin not in selection — check if it's reachable
        const reachable = getReachable();
        if (reachable && !reachable.has(originKey)) {
          // Not adjacent to existing selection — start fresh
          selected = [[ps.r, ps.c]];
        } else {
          tryAddToSelection(ps.r, ps.c);
        }
      }
    }

    if (isSwiping && !swipeStopped) {
      const key = `${r}-${c}`;
      if (selected.some(([sr,sc]) => sr===r && sc===c)) {
        // Swiped over already-selected card — ignore (don't deselect during swipe)
        return;
      }
      // Skip non-selectable cells (stones, Tricks, voids)
      if (isCellBlocked(r, c)) return;
      const cardAtCell = gridData[r]?.[c];
      if (!cardAtCell || !cardCan(cardAtCell, 'select')) return;
      const reachable = getReachable();
      if (reachable && !reachable.has(key)) {
        // Not reachable — stop swipe here, don't add
        swipeStopped = true;
        return;
      }
      if (selected.length < limits.selection.current) {
        selected.push([r, c]);
        dbgEvent('info', `swipe-add [${r},${c}] (total:${selected.length})`);
        sfxCardSelect();
        scheduleAutoSubmit();
        render();
      }
    }
  }
});

gridEl2.addEventListener('pointerup', e => {
  const ps = gridEl2._pointerStart;
  if (ps && !ps.moved) {
    // If in Trick selection phase and tapped a non-Trick cell, dismiss tooltip
    if (trickSelectionPhase && !gridData[ps.r]?.[ps.c]?._isTrick) {
      pendingTrickChoice = null;
      hideTrickTooltip();
      render();
      return;
    }
    // During normal play, dismiss any card tooltip if tapping a non-Trick cell
    if (!trickSelectionPhase && !gridData[ps.r]?.[ps.c]?._isTrick) {
      hideCardTooltip();
    }
    onCardTap(ps.r, ps.c);
  }
  isSwiping = false;
  swipeStopped = false;
  gridEl2._pointerStart = null;
});

gridEl2.addEventListener('pointercancel', () => {
  isSwiping = false;
  swipeStopped = false;
  gridEl2._pointerStart = null;
});

gridEl2.addEventListener('contextmenu', e => e.preventDefault());

// ══════════════════════════════════════════════
// FOCUS GENERATION (r95)
// ══════════════════════════════════════════════
// All the Focus a hand EARNS — hand-type value, speed bonus, and every focus Trick.
// Called from playHand BEFORE the hand's score is locked in, so the Focus the hand builds
// up multiplies THIS hand (previously a hand's Focus only kicked in on the NEXT hand).
// `vultureSec` is the retrigger-aware Vulture pause snapshot captured in playHand.
