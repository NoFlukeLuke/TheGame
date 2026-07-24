function render() {
  const gridEl = document.getElementById('grid');
  const reachable = getReachable();
  const bestHandResult = selected.length >= 2 ? findBestHand(selected) : null;

  // Build map of current DOM card elements by card _id
  const existingEls = {};
  gridEl.querySelectorAll('[data-card-id]').forEach(el => {
    existingEls[el.dataset.cardId] = el;
  });

  const seenIds = new Set();

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const card = gridData[r][c];
      const key = `${r}-${c}`;
      const isChallenge = !!(challengeCard && challengeCard.pos[0]===r && challengeCard.pos[1]===c && card === null);
      if (card === null && !isChallenge) continue;

      // During deal phase, skip rendering cards into the grid — temp-anim elements handle visuals
      if (dealPhase) continue;

      const cardId = isChallenge ? 'challenge' : String(card._id);
      seenIds.add(cardId);

      // ── Stone card path (boss-injected obstacle) ──
      if (!isChallenge && card._isStone) {
        let div = existingEls[cardId];
        if (!div) { div = document.createElement('div'); div.dataset.cardId = cardId; gridEl.appendChild(div); }
        div.dataset.row = r; div.dataset.col = c;
        div.style.left = cellLeft(c) + 'px';
        if (!animating && !falling) div.style.top = cellTop(r) + "px";
        const isSwapPending = swapPending && swapPending[0]===r && swapPending[1]===c;
        const { className, innerHTML } = renderCardAppearance(card, r, c, { isSwapPending });
        div.className = className; div.innerHTML = innerHTML;
        continue;
      }

      // ── Sleight card path ──
      if (!isChallenge && card._isSleight) {
        const def = SLEIGHT_POOL.find(j => j.id === card.sleightId);
        let div = existingEls[cardId];
        if (!div) { div = document.createElement('div'); div.dataset.cardId = cardId; gridEl.appendChild(div); }
        div.dataset.row = r; div.dataset.col = c;
        div.style.left = cellLeft(c) + 'px';
        if (!animating && !falling) div.style.top = cellTop(r) + 'px';
        const isSwapPendingJ = swapPending && swapPending[0]===r && swapPending[1]===c;
        const selIdxJ = selected.findIndex(([sr,sc]) => sr===r && sc===c);
        const usesStr = card._usesLeft === 'infinite' ? '∞' : card._usesLeft;
        const _isAim = AIM_SLEIGHTS.has(def?.id);
        if (_isAim) {
          const dir = card._aimDir || (card._aimDir = 'up');
          div.className = 'trick-card sleight-card aim-sleight' + (selIdxJ >= 0 ? ' selected' : '');
          div.innerHTML =
            `<div class="sleight-aim-inner" style="transform:perspective(360px) ${AIM_TILT[dir]}">` +
              `<div class="sleight-card-emoji">${def?.emoji||'🪞'}</div>` +
              `<div class="sleight-card-name">${def?.name||'Sleight'}</div>` +
            `</div>` +
            `<div class="aim-arrow aim-${dir}">${AIM_ARROW[dir]}</div>`;
          div.onclick = () => onCardTap(r, c);
          attachLongPress(div, r, c);
          continue;
        }
        div.className = 'trick-card sleight-card' + (isSwapPendingJ ? ' swap-pending' : '') + (selIdxJ >= 0 ? ' selected' : '');
        div.innerHTML = `${selIdxJ >= 0 ? `<div class="sel-num">${selIdxJ+1}</div>` : ''}<div class="sleight-card-emoji">${def?.emoji||'🃏'}</div><div class="sleight-card-name">${def?.name||'Sleight'}</div><div class="sleight-card-uses">${usesStr}</div>`;
        div.onclick = () => onCardTap(r, c);
        attachLongPress(div, r, c);
        continue;
      }

      // ── Trick card path ──
      if (!isChallenge && card._isTrick) {
        let div = existingEls[cardId];
        if (!div) { div = document.createElement('div'); div.dataset.cardId = cardId; gridEl.appendChild(div); }
        div.dataset.row = r; div.dataset.col = c;
        div.style.left = cellLeft(c) + 'px';
        if (!animating && !falling) div.style.top = cellTop(r) + "px";
        const isPendingTrick = !!(pendingTrickChoice && pendingTrickChoice.id === card.trick.id);
        const isSwapPending = swapPending && swapPending[0]===r && swapPending[1]===c;
        const { className, innerHTML, isTappable } = renderCardAppearance(card, r, c, { isPendingTrick, isSwapPending });
        div.className = className; div.innerHTML = innerHTML;
        div.onclick = isTappable ? () => onTrickTap(card.trick) : null;
        div.style.cursor = isTappable ? 'pointer' : 'default';
        attachLongPress(div, r, c);
        continue;
      }
      const isReach      = reachable ? reachable.has(key) : true;
      const isSwapPend   = swapPending && swapPending[0]===r && swapPending[1]===c;
      const isSel        = selected.some(([sr,sc])=>sr===r&&sc===c);
      const selIdx       = selected.findIndex(([sr,sc])=>sr===r&&sc===c);
      const isHandReady  = handReadyForSubmit && isSel;
      const isHandValid  = !isHandReady && isSel && !!bestHandResult;

      const { className, innerHTML } = renderCardAppearance(card, r, c, {
        isSel, selIdx, isHandReady, isHandValid,
        isSwapPending: isSwapPend,
        isReachable: isReach,
        isChallenge,
      });

      let div = existingEls[cardId];
      if (!div) {
        div = document.createElement('div');
        div.dataset.cardId = cardId;
        div.dataset.row = r; div.dataset.col = c;
        div.style.left = cellLeft(c) + 'px';
        div.style.top  = cellTop(r) + 'px';
        div.style.opacity = '1';
        gridEl.appendChild(div);
      }
      div.dataset.row = r; div.dataset.col = c;
      div.style.left = cellLeft(c) + 'px';
      if (!animating && !falling) div.style.top = cellTop(r) + "px";
      div.className = className;
      div.innerHTML = innerHTML;
      if (!isChallenge) attachLongPress(div, r, c);

      if (isChallenge) {
        div.addEventListener('click', e => { e.stopPropagation(); toggleChallengeTooltip(div); div.dataset.tooltipPinned = challengeTooltipVisible ? '1' : ''; });
        div.addEventListener('mouseenter', () => { if (!div.dataset.tooltipPinned) showChallengeTooltip(div); });
        div.addEventListener('mouseleave', () => { if (!div.dataset.tooltipPinned) hideChallengeTooltip(); });
      }
    }
  }

  // Remove elements for cards no longer in the grid
  Object.entries(existingEls).forEach(([id, el]) => {
    if (!seenIds.has(id) && !el.classList.contains('removing')) {
      el.remove();
    }
  });

  // Update deck HUD on every render — catches grid mutations from any source
  updateDeckHud();

  // Hand preview
  if (!danceAbortController) {
    // Owner request: the preview no longer reacts to selection — it stays empty (inert)
    // until a hand is SUBMITTED, at which point the scoring dance (playPreviewDance) fills
    // #selected-cards. Selecting cards no longer renders preview cards or a hand name here.
    document.getElementById('hand-name').textContent = '—';
    const cardsEl = document.getElementById('selected-cards');
    cardsEl.innerHTML = '';
    if (bestHandResult) {
      const base = HAND_BASE[bestHandResult.hand];
      if (base) {
        const levelScale = Math.pow(1.1, level - 1);
        const basePips = Math.round(base.pips * levelScale);
        updateDanceSubboxes(basePips, base.mult);
      }
    } else {
      const pipsEl = document.getElementById('pips-val');
      const multEl = document.getElementById('mult-val');
      if (pipsEl) animateDigitEl(pipsEl, 0);
      if (multEl) animateDigitEl(multEl, 0);
    }
    // FOCUS box tracks the live focus multiplier (the multiplier the next hand will START at,
    // before that hand's own Focus is added — see generateHandFocus / the dance's focus beat)
    const _fvEl = document.getElementById('focus-val');
    if (_fvEl) { const _fm = focusMultiplier(); _fvEl.textContent = (_fm === 1) ? '×1' : '×' + _fm.toFixed(1); }
  }

  // Score breakdown
  const breakdownEl = document.getElementById('score-breakdown');
  if (bestHandResult && selected.length >= 2) {
    const { hand, handCells, penaltyCells, rawScore, penaltyPips, finalScore } = bestHandResult;
    const base = HAND_BASE[hand];
    const levelScale = Math.pow(1.1, level - 1);
    const scaledBasePips = Math.round(base.pips * levelScale);
    const cards = handCells.map(([r,c]) => gridData[r][c]);
    const cardPipsTotal = cards.reduce((sum, card) => sum + cardPips(card.rank) + (permPips[cardKey(card.rank,card.suit)]||0), 0);
    const hasTrickCard = trickCardPos && handCells.some(([r,c])=>r===trickCardPos[0]&&c===trickCardPos[1]);

    const bonusLines = [];
    if (hasTrick('rich_soil')) bonusLines.push({ label:'Rich Soil', val:`+${handCells.length} pips`, type:'pip' });
    if (hasTrick('fertile_ground')) bonusLines.push({ label:'Fertile Ground', val:`+${handCells.length*3} pips`, type:'pip' });
    if (hasTrick('court_of_leaves') && cards.some(c=>['J','Q','K'].includes(c.rank))) bonusLines.push({ label:'Court of Leaves', val:'+pips', type:'pip' });
    if (hasTrick('still_water')) {
      const elapsedSinceSwap = lastSwapRoundSeconds !== null
        ? Math.max(0, lastSwapRoundSeconds - roundSeconds)
        : Math.max(0, roundStartSeconds - roundSeconds);
      const swMult = BAL.still_water.mult_per_interval * Math.floor(elapsedSinceSwap / 10);
      if (swMult > 0) bonusLines.push({ label:'Eagle Eye', val:`+${swMult} mult`, type:'mult' });
    }
    if (hasTrick('swift')) { const _e = Math.max(0, roundStartSeconds - roundSeconds); const _sw = Math.floor(_e / BAL.swift.interval_seconds) * BAL.swift.mult_per_interval; if (_sw > 0) bonusLines.push({ label:'The Swift', val:`+${_sw} mult`, type:'mult' }); }
    if (hasTrick('hummingbird') && pauseInstanceGame > 0) bonusLines.push({ label:'Hummingbird', val:`+${pauseInstanceGame*BAL.hummingbird.mult_per_pause} mult`, type:'mult' });
    if (hasTrick('albatross') && pausedSecondsRound > 0) bonusLines.push({ label:'Albatross', val:`+${pausedSecondsRound*BAL.albatross.pips_per_second} pips`, type:'pip' });
    if (hasTrick('sediment')) { const _el = Math.max(0, roundStartSeconds - roundSeconds); const _sp = Math.floor(_el/BAL.sediment.interval_seconds)*BAL.sediment.pips_per_interval; if (_sp > 0) bonusLines.push({ label:'Sediment', val:`+${_sp} pips`, type:'pip' }); }
    if (hasTrick('kingfisher')) { const _km = Math.floor((pausedSecondsRound+rewoundSecondsRound)/BAL.kingfisher.interval_seconds)*BAL.kingfisher.mult_per_interval; if (_km > 0) bonusLines.push({ label:'The Kingfisher', val:`+${_km} mult`, type:'mult' }); }
    if (pendingHandPips > 0) bonusLines.push({ label:'Quarter Chime', val:`+${pendingHandPips} pips`, type:'pip' });
    if (pendingCardPips > 0) bonusLines.push({ label:'Second Hand', val:`+${pendingCardPips} pips`, type:'pip' });
    if (pendingHandMult > 0) bonusLines.push({ label:'Minute Hand', val:`+${pendingHandMult} mult`, type:'mult' });
    const _isRunLine = ['Run of 3','Run of 4','Straight','Straight Flush'].includes(hand);
    const _setMax = (() => { const m = {}; cards.forEach(c => m[c.rank] = (m[c.rank]||0)+1); return Math.max(0, ...Object.values(m)); })();
    if (hasTrick('overgrowth') && _isRunLine) bonusLines.push({ label:'Cascade', val:`+${10*cards.length} pips`, type:'pip' });
    if (hasTrick('kindred') && _setMax >= 2) bonusLines.push({ label:'Quake', val:`+${3*_setMax} mult`, type:'mult' });
    if (hasTrick('trinity') && _setMax >= 2) bonusLines.push({ label:'Shock', val:`+${12*_setMax} pips`, type:'pip' });
    if (hasTrick('long_road') && _isRunLine) bonusLines.push({ label:'Storm', val:`+${2*cards.length} mult`, type:'mult' });
    if (hasTrick('correct_run') && _isRunLine && canBeOrderedRun(handCells)) bonusLines.push({ label:'Rogue Wave', val:`+${80*cards.length} pips`, type:'pip' });
    if (hasTrickCard) bonusLines.push({ label:'⭐ Trick', val:'×2 score', type:'score' });
    if (hasTrick('early_bird') && roundFractionRemaining()>2/3) bonusLines.push({ label:'Early Bird', val:`+${BAL.early_bird.pips_per_card*cards.length} pips`, type:'pip' });
    if (hasTrick('kindling')) {
      const _previewStreak = (lastHandType !== null && hand === lastHandType) ? streakCount + 1 : 1;
      if (_previewStreak > 1) bonusLines.push({ label:`Kindling ×${_previewStreak-1}`, val:`+${4*(_previewStreak-1)} pips`, type:'pip' });
    }

    // Suits neutral by default — preview only shows active Trick effects
    const clubCnt  = cards.filter(c => c.suit==='♣'||(c.combined&&c.suit2==='♣')).length;
    const heartCnt = cards.filter(c => c.suit==='♥'||(c.combined&&c.suit2==='♥')).length;
    if (clubCnt  && hasTrick('club_double'))  bonusLines.push({ label:'♣ Hard Labour', val:`+${5*(Math.pow(2,clubCnt)-1)} pips`, type:'pip' });

    breakdownEl.innerHTML = `
      <div class="sb-row"><span class="sb-label">Base pips (lv${level})</span><span class="sb-value">${scaledBasePips}</span></div>
      <div class="sb-row"><span class="sb-label">Card pips (${handCells.length} cards)</span><span class="sb-value">+${cardPipsTotal}</span></div>
      <div class="sb-row"><span class="sb-label">Base mult</span><span class="sb-value">×${base.mult}</span></div>
      ${bonusLines.map(b => {
        let cls = (b.type==='score') ? 'highlight' : '';
        if (b.type === 'time') cls += ' spade-halo';
        const style = (b.type === 'coin') ? 'style="color:var(--gold)"' : '';
        return `<div class="sb-row"><span class="sb-label">${withSuitHalo(b.label)}</span><span class="sb-value ${cls}" ${style}>${withSuitHalo(b.val)}</span></div>`;
      }).join('')}
      ${penaltyPips > 0 ? `<div class="sb-row"><span class="sb-label" style="color:var(--red)">Penalty (${penaltyCells.length} unused)</span><span class="sb-value" style="color:var(--red)">−${penaltyPips}</span></div>` : ''}
      <div class="sb-divider"></div>
      <div class="sb-total"><span class="sb-label">SCORE</span><span class="sb-value">${finalScore.toLocaleString()}</span></div>
    `;
  } else {
    breakdownEl.innerHTML = '';
  }

  // Buttons
  document.getElementById('btn-play').disabled    = !bestHandResult || (animating && !falling);
  document.getElementById('btn-discard').disabled = selected.length === 0 || (animating && !falling);
  document.getElementById('disc-count').textContent = `(${discards})`;
  document.getElementById('swap-count').textContent  = swaps;
}

