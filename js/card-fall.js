function renderCardAppearance(card, r, c, {
  isSel        = false,
  selIdx       = -1,
  isHandReady  = false,
  isHandValid  = false,
  isSwapPending = false,
  isReachable  = true,
  isChallenge  = false,
  isPendingTrick  = false,
} = {}) {
  // ── Stone (boss obstacle — falls normally, can't be played/discarded) ──
  if (!isChallenge && card._isStone) {
    return {
      className: `card stone-card${isSwapPending ? ' swap-pending' : ''}`,
      innerHTML: `<div class="stone-glyph">✦</div>`,
    };
  }

  // ── Sleight card ──
  if (!isChallenge && card._isSleight) {
    const def = SLEIGHT_POOL.find(j => j.id === card.sleightId);
    const usesStr = card._usesLeft === 'infinite' ? '∞' : card._usesLeft;
    return {
      className: `trick-card sleight-card${isSwapPending ? ' swap-pending' : ''}`,
      innerHTML: `<div class="sleight-card-emoji">${def?.emoji||'🃏'}</div><div class="sleight-card-name">${def?.name||'Sleight'}</div><div class="sleight-card-uses">${usesStr}</div>`,
    };
  }

  // ── Blessing Card (Trick) ──
  if (!isChallenge && card._isTrick) {
    const stateClass  = card._trickState === 'upgradeable' ? ' trick-upgradeable'
                      : card._trickState === 'upgraded'    ? ' trick-upgraded' : '';
    const upgradeLabel = card._trickState === 'upgradeable'
      ? '<div class="trick-upgrade-indicator">U</div>' : '';
    return {
      className: `trick-card trick-tier-${card.trick.tier}${isPendingTrick ? ' trick-pending' : ''}${stateClass}`,
      innerHTML: `<div class="trick-tier-label">${card.trick.tier.charAt(0).toUpperCase()}</div>`
               + `<div class="trick-name">${card.trick.name}</div>${upgradeLabel}`,
      isTappable: card._trickState === 'new' || card._trickState === 'upgradeable',
    };
  }

  // ── Challenge card ──
  if (isChallenge) {
    return {
      className: `card challenge-card`,
      innerHTML: `<div class="challenge-badge">⚠️</div>`,
    };
  }

  // ── Normal playing card (rank + suit, with all bonus decorations) ──
  const k   = cardKey(card.rank, card.suit);
  const pp  = permPips[k] || 0;
  const pm  = permMult[k] || 0;
  const curse = cardCurses[k];
  const hasPip = pp > 0, hasMult = pm > 0;
  const isCombined = !!card.combined;
  const isTrick = trickCardPos && trickCardPos[0] === r && trickCardPos[1] === c;

  const rcPips      = cellHasRowColBonus(r, c, 'rowcol_triple_pips') ? ' rc-pips'      : '';
  const rcMult      = cellHasRowColBonus(r, c, 'rowcol_mult')        ? ' rc-mult'      : '';
  const rcRetrigger = cellHasRowColBonus(r, c, 'rowcol_retrigger')   ? ' rc-retrigger' : '';
  const rcLeyline   = leyLinePos && leyLinePos.r === r && leyLinePos.c === c ? ' rc-leyline' : '';
  const rcJeopardy  = doubleJeopardyPos && doubleJeopardyPos.r === r && doubleJeopardyPos.c === c ? ' rc-jeopardy' : '';
  const rcWoodpecker = woodpeckerPos && woodpeckerPos.r === r && woodpeckerPos.c === c ? ' rc-woodpecker' : '';

  const bothClass = hasPip && hasMult ? ' has-both' : hasPip ? ' has-pip' : hasMult ? ' has-mult' : '';
  const className = [
    'card',
    suitClass(card.suit),
    isSel        ? 'selected'    : '',
    isHandValid  ? 'hand-valid'  : '',
    isHandReady  ? 'hand-ready'  : '',
    isSwapPending ? 'swap-pending' : '',
    (!isReachable && !isSel && !isSwapPending) ? 'unreachable' : '',
    isTrick ? 'trick-card' : '',
    (exaltCorruptEnabled && card._exalted) ? 'exalted' : '',
    (exaltCorruptEnabled && card._corrupted) ? 'corrupted' : '',
    curse ? 'cursed' : '',
    bothClass.trim(),
    rcPips.trim(), rcMult.trim(), rcRetrigger.trim(), rcLeyline.trim(), rcJeopardy.trim(), rcWoodpecker.trim(),
  ].filter(Boolean).join(' ');

  const combinedLabel = isCombined
    ? `<div style="position:absolute;top:2px;right:3px;font-size:7px;font-family:'Cinzel',serif;color:#9b59b6;font-weight:700">${card.rank2}${card.suit2}</div>`
    : '';

  const innerHTML = `
    ${isSel ? `<div class="sel-num">${selIdx + 1}</div>` : ''}
    ${isTrick ? `<div class="trick-star">⭐</div>` : ''}
    ${curse ? `<div class="curse-badge" title="${CURSE_DEFS[curse.id].name}: ${CURSE_DEFS[curse.id].desc}">${CURSE_DEFS[curse.id].icon}<span class="curse-left">${curse.left}</span></div>` : ''}
    ${combinedLabel}
    <div class="rank">${card.rank}</div>
    <div class="suit">${card.suit}</div>
    ${pp ? `<div style="position:absolute;bottom:2px;left:3px;font-size:8px;font-family:'Cinzel',serif;color:#3a6fca;font-weight:700">+${pp}p</div>` : ''}
    ${pm ? `<div style="position:absolute;bottom:2px;right:3px;font-size:8px;font-family:'Cinzel',serif;color:#c0392b;font-weight:700">+${pm}m</div>` : ''}
    ${buffBandHTML('tl', pp, '#3a6fca')}
    ${buffBandHTML('tr', pm, '#c0392b')}
    ${buffBandHTML('br', card._vulturePause || 0, '#111')}
  `;

  return { className, innerHTML };
}

// Build a temp-anim element for a card falling or entering at (finalR, finalC).
// Calls renderCardAppearance with no interaction state, then adds temp-anim class.
// Future-proof: any new card type added to renderCardAppearance is automatically
// handled here at no extra cost.
function buildCardAnimEl(card, finalR, finalC) {
  const el = document.createElement('div');
  const { className, innerHTML } = renderCardAppearance(card, finalR, finalC);
  el.className = className + ' temp-anim';
  el.innerHTML = innerHTML;
  el.style.position       = 'absolute';
  el.style.width          = CARD_W + 'px';
  el.style.height         = CARD_H + 'px';
  el.style.pointerEvents  = 'none';
  el.style.zIndex         = '10';
  return el;
}

async function removeAndFall(removingCells, mode = 'play') {
  // Guard against re-entry while a fall is in progress
  if (animating) {
    console.log('[FALL] BLOCKED by animating flag', { mode, cells: removingCells.length });
    return;
  }
  console.log('[FALL] start', { mode, cells: removingCells.length });
  animating = true;

  const challengeKey = challengeCard ? `${challengeCard.pos[0]}-${challengeCard.pos[1]}` : null;
  removingCells = removingCells.filter(([r,c]) => `${r}-${c}` !== challengeKey);
  const removing = new Set(removingCells.map(([r,c])=>`${r}-${c}`));
  // Clear swap mode if the pending card is about to be removed
  if (swapPending && removing.has(`${swapPending[0]}-${swapPending[1]}`)) swapPending = null;

  // Only play mode routes cards to the played pile.
  // Discard mode: the caller (doDiscard) already pushed cards to the back of the draw pile.
  if (mode === 'play') {
    removingCells.forEach(([r,c]) => discardToPlayed(gridData[r][c]));
  }

  const gridEl = document.getElementById('grid');

  // Slide removed cards toward target icon
  const targetId = mode === 'discard' ? 'btn-discard' : 'btn-deck';
  const targetEl = document.getElementById(targetId);
  const targetRect = targetEl ? targetEl.getBoundingClientRect() : null;

  const slidePromises = [];
  removingCells.forEach(([r,c]) => {
    const card = gridData[r][c];
    if (!card) return;
    const el = gridEl.querySelector(`[data-card-id="${card._id}"]`);
    if (!el) return;
    if (targetRect) {
      const cardRect = el.getBoundingClientRect();
      const dx = (targetRect.left + targetRect.width/2) - (cardRect.left + cardRect.width/2);
      const dy = (targetRect.top + targetRect.height/2) - (cardRect.top + cardRect.height/2);
      el.style.transition = 'none';
      el.style.zIndex = '20';
      void el.offsetWidth;
      el.style.transition = 'transform 0.28s cubic-bezier(0.4,0,1,1), opacity 0.28s ease-in';
      el.style.transform = `translate(${dx}px, ${dy}px) scale(0.3)`;
      el.style.opacity = '0';
      slidePromises.push(new Promise(res => setTimeout(res, 300)));
    } else {
      el.style.opacity = '0';
      slidePromises.push(new Promise(res => setTimeout(res, 200)));
    }
  });
  await Promise.all(slidePromises);

  // Remove slid-out elements
  gridEl.querySelectorAll('.card[style*="scale(0.3)"]').forEach(el => el.remove());
  removingCells.forEach(([r,c]) => {
    const card = gridData[r][c];
    if (card) {
      const el = gridEl.querySelector(`[data-card-id="${card._id}"]`);
      if (el) el.remove();
    }
  });

  // Build fall plan BEFORE touching gridData
  // Voids ("blocked cells") are skipped entirely in the column. Cards stack to the
  // bottom-most non-void rows; new cards fill the top-most non-void rows.
  const fallPlan = [];
  const newCards = [];
  for (let col = 0; col < gridCols; col++) {
    // Playable rows in this column, ordered TOP-to-BOTTOM
    const playableRows = [];
    for (let r = 0; r < gridRows; r++) {
      if (!isCellBlocked(r, col)) playableRows.push(r);
    }
    if (playableRows.length === 0) continue;

    // Surviving cards in original top-to-bottom order
    const survivors = [];
    for (const r of playableRows) {
      if (!removing.has(`${r}-${col}`) && gridData[r][col] !== null) {
        survivors.push({ origRow: r, card: gridData[r][col] });
      }
    }
    const removedCount = playableRows.length - survivors.length;

    // Survivors pack to bottom of playableRows, preserving top-to-bottom order
    // i.e. survivors[i] goes to playableRows[playableRows.length - survivors.length + i]
    survivors.forEach((entry, i) => {
      const targetRow = playableRows[playableRows.length - survivors.length + i];
      if (targetRow !== entry.origRow) {
        const fallBy = targetRow - entry.origRow;
        // Capture the card NOW — gridData is updated below (pre-animation), so the
        // fall loop can no longer look it up by old position.
        fallPlan.push({ row: entry.origRow, col, fallBy, card: entry.card });
        if (challengeCard && challengeCard.pos[0] === entry.origRow && challengeCard.pos[1] === col) {
          challengeCard.pos = [targetRow, col];
        }
      }
    });

    // New cards fill the top `removedCount` rows of playableRows
    for (let i = 0; i < removedCount; i++) {
      const finalRow = playableRows[i];
      newCards.push({ col, finalRow, fromAbove: removedCount - i, card: drawCard() || null });
    }
  }

  // Update gridData NOW (before animations) so selection during fall is accurate
  removingCells.forEach(([r,c]) => { gridData[r][c] = null; });
  for (let col = 0; col < gridCols; col++) {
    const playableRows = [];
    for (let r = 0; r < gridRows; r++) if (!isCellBlocked(r, col)) playableRows.push(r);
    const survivors = [];
    for (const r of playableRows) {
      if (gridData[r][col] !== null) survivors.push(gridData[r][col]);
      gridData[r][col] = null;
    }
    survivors.forEach((card, i) => {
      gridData[playableRows[playableRows.length - survivors.length + i]][col] = card;
    });
    newCards.filter(n => n.col === col).forEach(({ finalRow, card }) => {
      if (card && !isCellBlocked(finalRow, col)) gridData[finalRow][col] = card;
    });
  }

  // Settle challenge card into the first empty cell of its column (data is now final)
  if (challengeCard) {
    for (let col = 0; col < gridCols; col++) {
      if (challengeCard.pos[1] === col) {
        for (let r = 0; r < gridRows; r++) {
          if (gridData[r][col] === null) { challengeCard.pos = [r, col]; break; }
        }
      }
    }
  }

  // Transition: slide-out done, now entering fall phase — allow selection
  animating = false;
  falling = true;

  // Hide only the persistent elements for cards that will be animated as temp elements
  const fallingIds = new Set();
  fallPlan.forEach(({ row, col, fallBy }) => {
    const destCard = gridData[row + fallBy]?.[col];
    if (destCard && destCard._id) fallingIds.add(String(destCard._id));
  });
  gridEl.querySelectorAll('[data-card-id]').forEach(el => {
    if (fallingIds.has(el.dataset.cardId)) el.style.visibility = 'hidden';
  });

  const FALL_DUR = 420;
  const COL_OFFSET = 60;
  const BOUNCE_PX = 8;
  const SQUISH = 0.10;
  const activeCols = new Set(removingCells.map(([,c]) => c));
  const minActiveCol = activeCols.size > 0 ? Math.min(...activeCols) : 0;

  const colReadyAt = {};

  // Animate existing cards falling down as temp elements
  const fallAnims = [];
  const sortedFallPlan = [...fallPlan].sort((a, b) => a.col !== b.col ? a.col - b.col : b.row - a.row);

  sortedFallPlan.forEach(({ row, col, fallBy, card }) => {
    if (!card) return;
    const startX = cellLeft(col);
    const startY = cellTop(row);
    const dist = fallBy * CARD_STEP;
    const colBase = (col - minActiveCol) * COL_OFFSET;
    const startAt = Math.max(colBase, colReadyAt[col] || colBase);
    colReadyAt[col] = startAt + FALL_DUR * 0.6;

    const tempEl = buildCardAnimEl(card, row + fallBy, col);
    tempEl.style.left = startX + 'px';
    tempEl.style.top  = startY + 'px';
    // Make falling cards selectable mid-air: tag with destination + enable hits
    tempEl.dataset.row = row + fallBy;
    tempEl.dataset.col = col;
    tempEl.dataset.cardId = String(card._id);
    tempEl.style.pointerEvents = 'auto';
    gridEl.appendChild(tempEl);

    fallAnims.push(tempEl.animate([
      { transform: 'translateY(0px) scaleY(1)',                                          offset: 0 },
      { transform: `translateY(${dist * 0.6}px) scaleY(0.96)`,                          offset: 0.5, easing: 'ease-in' },
      { transform: `translateY(${dist + BOUNCE_PX}px) scaleY(${1 - SQUISH})`,           offset: 0.82 },
      { transform: `translateY(${dist - BOUNCE_PX * 0.7}px) scaleY(${1 + SQUISH})`,     offset: 0.91 },
      { transform: `translateY(${dist + BOUNCE_PX * 0.3}px) scaleY(${1 - SQUISH * 0.2})`, offset: 0.96 },
      { transform: `translateY(${dist}px) scaleY(1)`,                                   offset: 1 },
    ], { duration: FALL_DUR, delay: startAt, easing: 'ease-in', fill: 'forwards' }));
  });

  // Animate new cards entering from above
  const enterAnims = [];
  const sortedNewCards = [...newCards].sort((a, b) => a.col !== b.col ? a.col - b.col : b.finalRow - a.finalRow);

  sortedNewCards.forEach(({ col, finalRow, fromAbove, card }) => {
    if (!card) return;
    const destX = cellLeft(col);
    const destY = cellTop(finalRow);
    const minStart = Math.max(fromAbove, finalRow + 1);
    const startY = -(minStart - finalRow) * CARD_STEP;
    const dropDist = destY - startY;
    const colBase = (col - minActiveCol) * COL_OFFSET;
    const entryStart = Math.max(colBase, colReadyAt[col] || colBase);
    colReadyAt[col] = entryStart + FALL_DUR * 0.6;

    const tempEl = buildCardAnimEl(card, finalRow, col);
    tempEl.style.left    = destX + 'px';
    tempEl.style.top     = startY + 'px';
    tempEl.style.opacity = '0';
    // Make entering cards selectable mid-air: tag with destination + enable hits
    tempEl.dataset.row = finalRow;
    tempEl.dataset.col = col;
    tempEl.dataset.cardId = String(card._id);
    tempEl.style.pointerEvents = 'auto';
    gridEl.appendChild(tempEl);

    enterAnims.push(tempEl.animate([
      { opacity: 0, transform: 'translateY(0) scaleY(1)' },
      { opacity: 1, transform: 'translateY(0) scaleY(1)',                                    offset: 0.06 },
      { opacity: 1, transform: `translateY(${dropDist * 0.55}px) scaleY(0.96)`,             offset: 0.55, easing: 'ease-in' },
      { opacity: 1, transform: `translateY(${dropDist + BOUNCE_PX}px) scaleY(${1 - SQUISH})`,         offset: 0.83 },
      { opacity: 1, transform: `translateY(${dropDist - BOUNCE_PX * 0.7}px) scaleY(${1 + SQUISH})`,   offset: 0.91 },
      { opacity: 1, transform: `translateY(${dropDist + BOUNCE_PX * 0.3}px) scaleY(${1 - SQUISH * 0.2})`, offset: 0.96 },
      { opacity: 1, transform: `translateY(${dropDist}px) scaleY(1)` },
    ], { duration: FALL_DUR, delay: entryStart, easing: 'ease-in', fill: 'forwards' }));
  });

  await Promise.all([...fallAnims, ...enterAnims].map(a => a.finished));
  gridEl.querySelectorAll('.temp-anim').forEach(el => el.remove());
  gridEl.querySelectorAll('[data-card-id]').forEach(el => el.remove());

  // gridData was already updated before animations — just clear selection and finish
  falling = false;
  console.log('[FALL] complete');

  const queued = pendingAction;
  pendingAction = null;
  render();

  if (queued === 'play') { dbgEvent('info', 'executing queued play'); playHand(); }
  else if (queued === 'discard') { dbgEvent('info', 'executing queued discard'); doDiscard(); }
}


// ══════════════════════════════════════════════
// SCORE FLASH
// ══════════════════════════════════════════════
