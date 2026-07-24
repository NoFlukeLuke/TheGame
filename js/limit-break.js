function openLimitBreakEvent() {
  gameTimerPaused = true;
  lbPrimaryPick = null;
  lbSecondPick  = null;
  lbSacrifice   = null;
  lbConfirmed   = false;

  // Eligible = limits not yet maxed; weighted pick so rare limits show up less
  const chosen = pickWeightedLimits(3);

  // Last one is "blind" if we have a full set of 3
  lbOffers = chosen.map((def, i) => ({
    id: def.id,
    blind: chosen.length === 3 && i === 2,
    revealed: false,
  }));

  renderLimitBreak();
  document.getElementById('limitbreak-overlay').classList.add('show');
}

function renderLimitBreak() {
  const offersEl = document.getElementById('lb-offers');
  offersEl.innerHTML = '';
  lbOffers.forEach((offer, i) => {
    const def = LIMITS_DEF.find(d => d.id === offer.id);
    const l = limits[offer.id];
    const isSel = (lbPrimaryPick === i || lbSecondPick === i);
    const showBlind = offer.blind && !offer.revealed && !isSel;

    const div = document.createElement('div');
    div.className = `lb-offer ${offer.blind ? 'blind' : ''} ${isSel ? 'selected' : ''}`.trim();

    if (showBlind) {
      div.innerHTML = `
        <div class="lb-offer-tag">?</div>
        <div class="lb-offer-icon">❓</div>
        <div class="lb-offer-label">MYSTERY</div>
        <div class="lb-offer-desc">A hidden limit. Revealed on pick.</div>
      `;
    } else {
      const prog = limitProgressStr(offer.id, true);
      div.innerHTML = `
        <div class="lb-offer-tag">${offer.blind ? '?' : ''}</div>
        <div class="lb-offer-icon">${def.icon}</div>
        <div class="lb-offer-label">${def.label}</div>
        <div class="lb-offer-desc">${colorizeKeywords(def.desc)}</div>
        <div class="lb-offer-prog">${prog}</div>
      `;
    }
    div.onclick = () => onLbOfferClick(i);
    offersEl.appendChild(div);
  });

  renderLbSacrifice();

  const canConfirm = lbPrimaryPick !== null;
  document.getElementById('lb-confirm').disabled = !canConfirm;
}

function onLbOfferClick(i) {
  if (lbConfirmed) return;
  const offer = lbOffers[i];

  // First pick (free)
  if (lbPrimaryPick === null) {
    lbPrimaryPick = i;
    if (offer.blind) offer.revealed = true;
    renderLimitBreak();
    return;
  }
  // Clicking the primary pick again deselects it (and clears second pick + sacrifice)
  if (lbPrimaryPick === i) {
    lbPrimaryPick = null;
    lbSecondPick = null;
    lbSacrifice = null;
    renderLimitBreak();
    return;
  }
  // Second pick requires a sacrifice — toggle selection, sacrifice chosen below
  if (lbSecondPick === i) {
    lbSecondPick = null;
    lbSacrifice = null;
    renderLimitBreak();
    return;
  }
  lbSecondPick = i;
  if (offer.blind) offer.revealed = true;
  lbSacrifice = null; // must re-choose sacrifice for the new second pick
  renderLimitBreak();
}

function renderLbSacrifice() {
  const wrap = document.getElementById('lb-sacrifice');
  const hint = document.getElementById('lb-sacrifice-hint');
  const optsEl = document.getElementById('lb-sacrifice-options');

  // Sacrifice section only relevant once a primary pick exists
  if (lbPrimaryPick === null) {
    wrap.style.opacity = '0.4';
    hint.textContent = 'Choose your free pick first.';
    optsEl.innerHTML = '';
    return;
  }
  wrap.style.opacity = '1';

  if (lbSecondPick === null) {
    hint.textContent = 'Tap a second limit above, then choose what to sacrifice for it.';
    optsEl.innerHTML = '';
    return;
  }

  hint.textContent = 'Sacrifice one of these to break your second limit:';

  const options = [];
  // Limit sacrifices: any limit above 0 that isn't one of the two being broken
  LIMITS_DEF.forEach(def => {
    const l = limits[def.id];
    const isBeingBroken = (lbOffers[lbPrimaryPick]?.id === def.id) || (lbOffers[lbSecondPick]?.id === def.id);
    if (l.current > 0 && !isBeingBroken) {
      options.push({ type: 'limit', id: def.id, label: `−1 ${def.icon} ${def.label}` });
    }
  });
  // Trick sacrifices
  (acquiredTricks || []).forEach((b, idx) => {
    options.push({ type: 'trick', id: idx, label: `✖ Trick: ${b.name}` });
  });
  // Knack sacrifices
  (acquiredKnacks || []).forEach((t, idx) => {
    options.push({ type: 'knack', id: idx, label: `✖ ${t.emoji || '♛'} ${t.name}` });
  });

  if (options.length === 0) {
    hint.textContent = 'Nothing left to sacrifice — your second pick is free!';
    lbSacrifice = { type: 'none' };
    optsEl.innerHTML = '';
    return;
  }

  optsEl.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    const isActive = lbSacrifice && lbSacrifice.type === opt.type && lbSacrifice.id === opt.id;
    btn.className = `lb-sac-btn ${isActive ? 'active' : ''}`.trim();
    btn.textContent = opt.label;
    btn.onclick = () => {
      lbSacrifice = { type: opt.type, id: opt.id };
      renderLimitBreak();
    };
    optsEl.appendChild(btn);
  });
}

function confirmLimitBreak() {
  if (lbConfirmed || lbPrimaryPick === null) return;

  // If a second pick is selected, it requires a valid sacrifice
  if (lbSecondPick !== null && !lbSacrifice) {
    showMessage('Choose a sacrifice for your second pick', 'var(--red)');
    return;
  }

  lbConfirmed = true;

  // Apply primary (free)
  const primaryId = lbOffers[lbPrimaryPick].id;
  incrementLimit(primaryId);
  showMessage(`↑ ${LIMITS_DEF.find(d=>d.id===primaryId).label}`, 'var(--gold)');

  // Apply second pick + sacrifice
  if (lbSecondPick !== null && lbSacrifice) {
    if (lbSacrifice.type === 'limit') {
      decrementLimit(lbSacrifice.id);
    } else if (lbSacrifice.type === 'trick') {
      const lost = acquiredTricks.splice(lbSacrifice.id, 1)[0];
      if (lost) showMessage(`✖ ${lost.name}`, 'var(--red)');
    } else if (lbSacrifice.type === 'knack') {
      const lost = acquiredKnacks.splice(lbSacrifice.id, 1)[0];
      if (lost) showMessage(`✖ ${lost.name}`, 'var(--red)');
    }
    const secondId = lbOffers[lbSecondPick].id;
    incrementLimit(secondId);
    showMessage(`↑ ${LIMITS_DEF.find(d=>d.id===secondId).label}`, 'var(--gold)');
  }

  closeLimitBreak();
}

function closeLimitBreak() {
  document.getElementById('limitbreak-overlay').classList.remove('show');
  lbOffers = [];
  lbPrimaryPick = null;
  lbSecondPick = null;
  lbSacrifice = null;
  gameTimerPaused = false;
  startRoundTimer();
  render();
}

(function wireLimitBreak() {
  const btn = document.getElementById('lb-confirm');
  if (btn) btn.addEventListener('click', confirmLimitBreak);
})();

// ══════════════════════════════════════════════
// SLEIGHT SYSTEM — physical deck cards
// ══════════════════════════════════════════════
// Sleights live in the deck as special cards (_isSleight:true).
// They fall onto the grid and can be swapped/discarded/selected/played.
// LONG-PRESS: show tooltip (sleights may need single-tap to select for a hand).
// Activation depends on def.activation (see SLEIGHT_POOL header).

let sleightFreeSwapPending = false; // pivot: next swap costs no swap-charge/time

