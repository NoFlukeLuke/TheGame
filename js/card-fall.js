function renderCardAppearance(card, r, c, {
  isSel        = false,
  selIdx       = -1,
  isHandReady  = false,
  isHandValid  = false,
  // r254: this selected card will NOT be part of the hand - the r201 "every card
  // must be load-bearing" rule dropped it, its pips will be SUBTRACTED and the
  // card consumed anyway. Red on the board, priced in the #hand-name label.
  isPenalty    = false,
  isSwapPending = false,
  isReachable  = true,
  isChallenge  = false,
  isPendingTrick  = false,
  // The Fog hides ranks on the BOARD. A card in the hand preview or the scoring
  // dance is one you have already committed to, so it is always shown - fogging
  // it there would hide the hand from the animation that is explaining it.
  revealFog       = false,
} = {}) {
  // ── Stone (boss obstacle - falls normally, can't be played/discarded) ──
  if (!isChallenge && card._isStone) {
    return {
      className: `card stone-card${isSwapPending ? ' swap-pending' : ''}`,
      innerHTML: `<div class="stone-glyph">✦</div>`,
    };
  }

  // ── Sleight card ──
  if (!isChallenge && card._isSleight) {
    const def = SLEIGHT_POOL.find(j => j.id === card.sleightId);
    // An 'adjacent' fixture shows how close it is to paying out (1/2) rather than
    // its charge count, which is the number that actually matters on the board.
    const usesStr = def?.activation === 'adjacent'
      ? `${card._adjPlays || 0}/${def.adjacentPlays || 2}`
      : (card._usesLeft === 'infinite' ? '∞' : card._usesLeft);
    // An AIM sleight (Reflect / Soul Mirror) is drawn tilted with a direction arrow,
    // and a spent one is greyed. Both used to live ONLY in render()'s own sleight
    // branch, so a sleight animating - falling, dealt in, or shown in the hand preview -
    // came out as a plain tile: the aim arrow and the tilt vanished for the length of
    // the fall and snapped back when it landed. Same markup on both paths now.
    if (AIM_SLEIGHTS.has(def?.id)) {
      const dir = card._aimDir || (card._aimDir = 'up');
      return {
        className: `trick-card sleight-card aim-sleight${sleightIsSpent(card, def) ? ' sleight-spent' : ''}`,
        innerHTML:
          `<div class="sleight-aim-inner" style="transform:perspective(360px) ${AIM_TILT[dir]}">` +
            `<div class="sleight-card-emoji">${emGlyph(def?.emoji || '🪞')}</div>` +
            `<div class="sleight-card-name">${def?.name || 'Sleight'}</div>` +
          `</div>` +
          `<div class="aim-arrow aim-${dir}">${AIM_ARROW[dir]}</div>`,
      };
    }
    return {
      className: `trick-card sleight-card${sleightRarityClass(def)}${isSwapPending ? ' swap-pending' : ''}`
               + (sleightIsSpent(card, def) ? ' sleight-spent' : ''),
      innerHTML: sleightFaceHTML(card, def, usesStr),
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
      innerHTML: `<div class="trick-tier-label">${tierInitial('trick', card.trick.tier)}</div>`
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
  const k   = cardId(card);
  const pp  = permPips[k] || 0;
  const pm  = permMult[k] || 0;
  // Scaling buffs (r209): NOT scored - they raise pp/pm by this much per play.
  // Shown as their own marker so a card that grows is distinguishable at a glance
  // from a card with a big fixed bonus, which is the whole point of the split.
  const gp  = permPipsGrow[k] || 0;
  const gm  = permMultGrow[k] || 0;
  // Resolve the curse's DEFINITION here, not inline in the template. A saved run
  // outlives deploys (main auto-deploys to Pages on every commit), so a save can
  // name a curse id this build no longer has - and an unguarded CURSE_DEFS[id].name
  // threw right here, inside render(), which aborted resumeSavedRun() before it
  // started the round clock and left the player on a dead half-drawn board.
  // An unknown curse now simply draws no badge.
  const curse = cardCurses[k];
  const curseDef = curse ? CURSE_DEFS[curse.id] : null;
  const hasPip = pp > 0, hasMult = pm > 0;
  const isCombined = !!card.combined;
  const isTrick = trickCardPos && trickCardPos[0] === r && trickCardPos[1] === c;

  const rcLeyline   = leyLinePos && leyLinePos.r === r && leyLinePos.c === c ? ' rc-leyline' : '';
  const rcJeopardy  = doubleJeopardyPos && doubleJeopardyPos.r === r && doubleJeopardyPos.c === c ? ' rc-jeopardy' : '';
  const rcWoodpecker = woodpeckerPos && woodpeckerPos.r === r && woodpeckerPos.c === c ? ' rc-woodpecker' : '';
  // The shared "what affected what" highlight (r209, divided in r296 -
  // js/entity-fx.js): a RING around the card in the owning Trick's colour,
  // DIVIDED EVENLY when several marked lines cross this cell rather than naming
  // one of them or blending into a third. It covers all nine line-marking
  // Tricks, where the three per-Trick `rc-pips` / `rc-mult` / `rc-retrigger`
  // tints it replaced covered three - so Perfect Timing, Right Time, Groove,
  // Assembly Line and Overtime marked a line the player could not see.
  // r296 also washed the card FACE and r299 took that back out: the face is the
  // card's own, and it now carries the buff bands below instead.
  // An inner element rather than a class + a CSS variable, because
  // renderCardAppearance returns className and innerHTML only - it has nowhere
  // to hang a per-card custom property.
  const _lineMetas  = (typeof lineMetasForCell === 'function') ? lineMetasForCell(r, c) : [];
  const lineRing    = (typeof lineRingHTMLFor === 'function') ? lineRingHTMLFor(_lineMetas) : '';
  const fxMark      = (typeof cardMarkHTML === 'function') ? cardMarkHTML(r, c) : '';
  // A boss hold greys the card and puts its countdown on it (js/cooldown.js).
  const _cd = (typeof cardCooldownParts === 'function') ? cardCooldownParts(card, r, c) : { cls: '', html: '' };

  const bothClass = hasPip && hasMult ? ' has-both' : hasPip ? ' has-pip' : hasMult ? ' has-mult' : '';
  // Spectrum (numeric) cards: the whole face is the colour and the value sits
  // big in the middle — no suit glyph. Keyed off the CARD, not the mode, so the
  // hand preview, score dance and fall animation all agree. cardColorSuit() is
  // what makes 9/10/11 render white while keeping their own identity underneath.
  const _faceSuit = cardColorSuit(card);
  const isNum = isColorSuit(_faceSuit);
  const className = [
    'card',
    isNum ? 'num-card' : '',
    suitClass(_faceSuit),
    isSel        ? 'selected'    : '',
    isHandValid  ? 'hand-valid'  : '',
    isPenalty    ? 'hand-penalty' : '',
    isHandReady  ? 'hand-ready'  : '',
    isSwapPending ? 'swap-pending' : '',
    (!isReachable && !isSel && !isSwapPending) ? 'unreachable' : '',
    isTrick ? 'trick-card' : '',
    (exaltCorruptEnabled && card._exalted) ? 'exalted' : '',
    (exaltCorruptEnabled && card._corrupted) ? 'corrupted' : '',
    curse ? 'cursed' : '',
    bothClass.trim(),
    rcLeyline.trim(), rcJeopardy.trim(), rcWoodpecker.trim(),
    _lineMetas.length ? 'rc-on-line' : '', _cd.cls,
    (gp || gm) ? 'card-scaling' : '',
    // Card states + temp cards (r278). `card-temp` is independent of any state:
    // "this will not be here next round" is the thing a player most needs to
    // know before building a plan around the card.
    (typeof cardStateCardClass === 'function') ? cardStateCardClass(card) : '',
  ].filter(Boolean).join(' ');

  const combinedLabel = isCombined
    ? `<div style="position:absolute;top:2px;right:3px;font-size:7px;font-family:'Cinzel',serif;color:#9b59b6;font-weight:700">${card.rank2}${card.suit2}</div>`
    : '';

  const innerHTML = `
    ${isSel ? `<div class="sel-num">${selIdx + 1}</div>` : ''}
    ${isTrick ? `<div class="trick-star">⭐</div>` : ''}
    ${curseDef ? `<div class="curse-badge" title="${curseDef.name}: ${curseDef.desc}">${curseDef.icon}<span class="curse-left">${curse.left}</span></div>` : ''}
    ${combinedLabel}
    ${(typeof bossFogHides === 'function' && bossFogHides(isSel || revealFog))
        ? (isNum ? `<div class="rank num-rank fog-rank">?</div>`
                 : `<div class="rank fog-rank">?</div><div class="suit">${card.suit}</div>`)
        : (isNum ? `<div class="rank num-rank${String(card.rank).length > 1 ? ' num-wide' : ''}">${card.rank}</div>`
                 : `<div class="rank">${card.rank}</div><div class="suit">${card.suit}</div>`)}
    ${(typeof cardBandsHTML === 'function') ? cardBandsHTML(card) : ''}
    ${(gp || gm) ? `<div class="card-grow-mark" title="Scales +${gp ? gp + ' pips' : ''}${gp && gm ? ' and +' : ''}${gm ? gm + ' mult' : ''} each time it's played">\u2197</div>` : ''}
    ${lineRing}
    ${fxMark}
    ${(typeof cardStateBadgeHTML === 'function') ? cardStateBadgeHTML(card) : ''}
    ${_cd.html}
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

  // Card states that fire on LEAVING the board (r278, js/card-states.js). Called
  // here, while gridData still holds the cards and before anything is nulled:
  // Backfill queues a temp copy for this column, and by the time the fall plan
  // below has packed the column the hole it wanted to fill is gone.
  if (typeof cardStatesOnLeave === 'function') cardStatesOnLeave(removingCells);

  // Only play mode routes cards to the played pile.
  // Discard mode: the caller (doDiscard) already pushed cards to the back of the draw pile.
  if (mode === 'play') {
    removingCells.forEach(([r,c]) => discardToPlayed(gridData[r][c]));
  } else if (mode === 'match3') {
    // Match-3 cascade. Finite deck (default) behaves like a normal play - scored
    // cards are held out until round end. The infinite-deck dev toggle instead
    // requeues them to the BACK of the draw pile so the board never runs dry.
    removingCells.forEach(([r,c]) => {
      const card = gridData[r][c];
      if (match3InfiniteDeck) discardToDrawPile(card);
      else                    discardToPlayed(card);
    });
  }

  const gridEl = document.getElementById('grid');

  // Slide removed cards toward target icon
  const targetId = mode === 'discard' ? 'btn-discard' : 'btn-records';
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
      if (!isCellVoid(r, col)) playableRows.push(r);
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
        // Capture the card NOW - gridData is updated below (pre-animation), so the
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
      // A queued Backfill copy fills the hole BEFORE the deck does, so a
      // backfilled cell costs the deck nothing: no card is drawn, the Marker's
      // one-in-ten counter does not advance, and the audit stays balanced
      // because a temp card is not counted as a deck card (js/card-states.js).
      const _bf = (typeof cardStatesDrawFor === 'function') ? cardStatesDrawFor(col) : null;
      newCards.push({ col, finalRow, fromAbove: removedCount - i, card: _bf || drawCard() || null });
    }
  }

  // Update gridData NOW (before animations) so selection during fall is accurate
  removingCells.forEach(([r,c]) => { gridData[r][c] = null; });
  for (let col = 0; col < gridCols; col++) {
    const playableRows = [];
    for (let r = 0; r < gridRows; r++) if (!isCellVoid(r, col)) playableRows.push(r);
    const survivors = [];
    for (const r of playableRows) {
      if (gridData[r][col] !== null) survivors.push(gridData[r][col]);
      gridData[r][col] = null;
    }
    survivors.forEach((card, i) => {
      gridData[playableRows[playableRows.length - survivors.length + i]][col] = card;
    });
    newCards.filter(n => n.col === col).forEach(({ finalRow, card }) => {
      if (card && !isCellVoid(finalRow, col)) gridData[finalRow][col] = card;
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

  // Transition: slide-out done, now entering fall phase - allow selection
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

  // gridData was already updated before animations - just clear selection and finish
  falling = false;
  console.log('[FALL] complete');

  const queued = pendingAction;
  pendingAction = null;
  render();

  // A Spectrum deck fixture that just paid out leaves the board HERE, not at the
  // moment it paid: it pays inside playHand, above the dance, and the dance's own
  // removeAndFall holds the falling lock until this point. Drained before the
  // queued action so "it paid, then it left" is one beat rather than a card
  // vanishing behind the next hand. (js/spectrum.js)
  if (typeof spectrumDrainFixtureExits === 'function') spectrumDrainFixtureExits();

  if (queued === 'play') { dbgEvent('info', 'executing queued play'); playHand(); }
  else if (queued === 'discard') { dbgEvent('info', 'executing queued discard'); doDiscard(); }

  // Match-3: the settled board may have created new matches (e.g. after the
  // player discarded). match3Resolve() self-guards, so a cascade already in
  // flight - which awaits this call - is unaffected.
  if (mode !== 'match3' && match3Active() && !roundEnded) match3Resolve();
}


// ══════════════════════════════════════════════
// SCORE FLASH
// ══════════════════════════════════════════════
