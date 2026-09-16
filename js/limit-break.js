// ══════════════════════════════════════════════
// LIMIT BREAK - two stages, not one screen (r227)
// ══════════════════════════════════════════════
// It used to show three offers, a free pick, an optional second pick, and a
// sacrifice list of EVERY limit, Trick and Knack you owned - all at once, all
// undoable until you pressed Confirm. Three things were wrong with that:
//
//   1. THE MYSTERY WAS FREE TO READ. Tapping the blind offer revealed it, and
//      tapping it again put it back. So it was never a gamble: you opened it,
//      looked, and picked something else if you did not like it.
//   2. THE SACRIFICE WAS A SHOPPING LIST. Every eligible thing you owned was on
//      screen, so "give something up" meant "find your least useful limit",
//      which on most boards costs nothing you care about.
//   3. NOTHING SAID THE SECOND PICK HAD A PRICE until you had already taken it.
//
// So: stage 1 is the free pick and nothing else, and the button says LOCK IN.
// Locking in commits it - the mystery reveals THERE, once it is too late to
// change your mind. Stage 2 then drops the two you did not take into a second
// row under the one you did, headed with the price, and offers three sacrifices
// ROLLED FROM A TABLE rather than the whole inventory. You can always walk away
// with just the free one.
const LB_SACRIFICE_OPTIONS = 3;

function openLimitBreakEvent(onClose) {
  gameTimerPaused = true;
  lbOnClose = onClose || null;   // reward-grid flow passes a continuation; standalone opens don't
  lbPrimaryPick = null;
  lbSecondPick  = null;
  lbSacrifice   = null;
  lbConfirmed   = false;
  lbStage       = 1;
  lbSacPool     = null;
  lbRevealing   = false;

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

// The locked-in pick, as a RECEIPT rather than a tile. It used to be drawn as a
// full .lb-offer at the top of stage 2, which is the wrong weight for it: at
// 150px tall it pushed the two real choices and the whole sacrifice row below
// the sticky footer, so the screen opened on the one thing already decided and
// you had to scroll to find the decision. It is one line now.
function lbTakenBarHTML(i) {
  const offer = lbOffers[i];
  const def = LIMITS_DEF.find(d => d.id === offer.id);
  const u = limitUnit(offer.id);
  return `<span class="lb-tk-check">✓</span><span class="lb-tk-tag">TAKEN</span>`
       + `<span class="lb-tk-icon">${def.icon}</span><span class="lb-tk-name">${def.label}</span>`
       + `<span class="lb-tk-gain">+${offer._gain}${u}</span>`
       + `<span class="lb-tk-prog">${offer._from}${u} → ${limits[offer.id].current}${u}</span>`;
}

// One offer tile. `taken` draws the locked-in pick full size - used only for the
// reveal beat after a BLIND second pick, where the tile is the whole payoff.
function lbOfferEl(i, taken) {
  const offer = lbOffers[i];
  const def = LIMITS_DEF.find(d => d.id === offer.id);
  const isSel = (lbPrimaryPick === i || lbSecondPick === i);
  // A blind offer stays blind while it can still be swapped out. Selecting it is
  // not what reveals it - CONFIRMING is (see confirmLimitBreak / lbLockIn).
  const showBlind = offer.blind && !offer.revealed;

  const div = document.createElement('div');
  div.className = `lb-offer ${offer.blind ? 'blind' : ''} ${isSel ? 'selected' : ''} ${taken ? 'taken' : ''}`.trim();

  if (showBlind) {
    div.innerHTML = `
      <div class="lb-offer-tag">?</div>
      <div class="lb-offer-icon">❓</div>
      <div class="lb-offer-label">UNKNOWN</div>
      <div class="lb-offer-desc">You find out which limit it was once you lock it in.</div>
    `;
  } else {
    // Say HOW MUCH, not just which - and say what it is really worth, which is
    // not the same as the step once the limit is near its ceiling. See the
    // limitDeltaText / limitProgressStr note in js/limits.js.
    // A TAKEN tile has to report the raise it JUST gave you, not the next one:
    // the limit has already moved, so limitDeltaText/limitProgressStr would be
    // quoting a second upgrade the player has not been offered. `_gain`/`_from`
    // are stamped at lock-in for exactly this.
    const gainTxt = taken ? `+${offer._gain}${limitUnit(offer.id)}` : limitDeltaText(offer.id, 1);
    const progTxt = taken
      ? `${offer._from}${limitUnit(offer.id)} → ${limits[offer.id].current}${limitUnit(offer.id)}`
      : limitProgressStr(offer.id, true);
    div.innerHTML = `
      <div class="lb-offer-tag">${taken ? 'TAKEN' : (offer.blind ? '?' : '')}</div>
      <div class="lb-offer-icon">${def.icon}</div>
      <div class="lb-offer-label">${def.label}</div>
      <div class="lb-offer-gain">${gainTxt}</div>
      <div class="lb-offer-desc">${colorizeKeywords(def.desc)}</div>
      <div class="lb-offer-prog">${progTxt}</div>
    `;
  }
  if (!taken) div.onclick = () => onLbOfferClick(i);
  return div;
}

function renderLimitBreak() {
  const offersEl = document.getElementById('lb-offers');
  const takenEl  = document.getElementById('lb-taken');
  const sub      = document.getElementById('lb-sub');
  const secTitle = document.getElementById('lb-second-title');
  const confirm  = document.getElementById('lb-confirm');
  const done     = document.getElementById('lb-done');

  offersEl.innerHTML = '';
  takenEl.innerHTML = '';
  // Stage 2 has four things to show at once - the receipt, the two remaining
  // offers, the price heading and three sacrifices - where stage 1 has one. The
  // class tightens the header (which by then is repeating itself) so the
  // sacrifice row sits above the sticky footer instead of under it.
  document.getElementById('lb-panel').classList.toggle('stage2', lbStage === 2);

  if (lbStage === 1) {
    takenEl.className = '';
    takenEl.style.display = 'none';
    secTitle.style.display = 'none';
    sub.textContent = 'Pick one. It is free.';
    lbOffers.forEach((_, i) => offersEl.appendChild(lbOfferEl(i, false)));
    done.style.display = 'none';
    confirm.style.display = '';
    confirm.disabled = lbPrimaryPick === null;
    confirm.textContent = lbPrimaryPick === null ? 'Pick one'
      : `Lock in ${lbOffers[lbPrimaryPick].revealed || !lbOffers[lbPrimaryPick].blind
          ? LIMITS_DEF.find(d => d.id === lbOffers[lbPrimaryPick].id).label : 'the unknown'}`;
    renderLbSacrifice();
    return;
  }

  // ── stage 2 ──────────────────────────────────────────────────────────────
  takenEl.style.display = '';
  if (lbRevealing) { takenEl.className = 'lb-reveal'; takenEl.appendChild(lbOfferEl(lbPrimaryPick, true)); }
  else             { takenEl.className = 'lb-bar';    takenEl.innerHTML = lbTakenBarHTML(lbPrimaryPick); }
  secTitle.style.display = '';
  sub.textContent = 'You can take one more, but it costs you something.';

  const rest = lbOffers.map((_, i) => i).filter(i => i !== lbPrimaryPick);
  rest.forEach(i => offersEl.appendChild(lbOfferEl(i, false)));

  renderLbSacrifice();

  done.style.display = '';
  confirm.style.display = '';
  const needsSac = lbSacPool && lbSacPool.length > 0;
  confirm.disabled = lbSecondPick === null || (needsSac && !lbSacrifice);
  confirm.textContent = lbSecondPick === null ? 'Take another?'
    : (needsSac && !lbSacrifice) ? 'Choose what you give up' : 'Trade';
}

function onLbOfferClick(i) {
  if (lbConfirmed) return;
  if (lbStage === 1) {
    lbPrimaryPick = (lbPrimaryPick === i) ? null : i;   // tap again to change your mind
    renderLimitBreak();
    return;
  }
  if (i === lbPrimaryPick) return;                       // already yours
  lbSecondPick = (lbSecondPick === i) ? null : i;
  renderLimitBreak();
}

// Stage 1 -> stage 2. This is where the free pick is APPLIED and where a blind
// offer reveals: by the time you can see what it was, it is already yours.
function lbLockIn() {
  if (lbPrimaryPick === null) return;
  const offer = lbOffers[lbPrimaryPick];
  const id = offer.id;
  // Read BEFORE the increment moves it - limitGain is a function of `current`.
  offer._from = limits[id].current;
  offer._gain = limitGain(id);
  const say = `${limitDeltaText(id, 1)} ${LIMITS_DEF.find(d => d.id === id).label}`;
  incrementLimit(id);
  offer.revealed = true;
  showMessage(say, 'var(--gold)');

  // Roll the sacrifice table ONCE, here, and keep it: re-rolling it whenever the
  // player changed their second pick would let them shop for a cheap price.
  lbSacPool = rollLbSacrifices();
  lbStage = 2;

  // Nothing left to take - the second row would be empty, so the screen is done.
  if (lbOffers.length < 2) { lbConfirmed = true; closeLimitBreak(); return; }
  renderLimitBreak();
}

// THREE options, drawn flat from everything that can actually be given up.
// Flat is the point: a weighted table would make the cheap thing the likely one.
// All three OFFERS are excluded, not just the one already taken - the table has
// to stay fixed while the player chooses their second limit, so it must not be
// able to name something they are about to be given.
function rollLbSacrifices() {
  const offered = new Set(lbOffers.map(o => o.id));
  const pool = [];
  LIMITS_DEF.forEach(def => {
    if (offered.has(def.id) || !limitCanDecrement(def.id)) return;
    // The sub-line is the NUMBERS only: limitChangeText repeats the limit's name,
    // which the line above it has already said, and the repeat wrapped the button
    // to three lines in the stage-2 column.
    const u = limitUnit(def.id), cur = limits[def.id].current;
    pool.push({ type: 'limit', id: def.id,
      label: `${limitDeltaText(def.id, -1)} ${def.icon} ${def.label}`,
      sub: `${cur}${u} → ${cur - limitLoss(def.id)}${u}` });
  });
  (acquiredTricks || []).forEach((b, idx) => {
    pool.push({ type: 'trick', id: idx, label: `✖ ${trickEmoji?.(b.id) || '✦'} ${b.name}`, sub: 'lose this Trick' });
  });
  (acquiredKnacks || []).forEach((t, idx) => {
    pool.push({ type: 'knack', id: idx, label: `✖ ${t.emoji || '♛'} ${t.name}`, sub: 'lose this Knack' });
  });
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, LB_SACRIFICE_OPTIONS);
}

function renderLbSacrifice() {
  const wrap   = document.getElementById('lb-sacrifice');
  const hint   = document.getElementById('lb-sacrifice-hint');
  const optsEl = document.getElementById('lb-sacrifice-options');

  if (lbStage === 1) { wrap.style.display = 'none'; optsEl.innerHTML = ''; return; }
  wrap.style.display = '';

  if (!lbSacPool || !lbSacPool.length) {
    hint.style.display = '';
    hint.textContent = 'You have nothing left to give up, so the second one is free.';
    optsEl.innerHTML = '';
    return;
  }
  // The column is already headed WHAT YOU GIVE UP, so a second line saying the
  // same thing is 22px the third sacrifice button needs. It only earns its place
  // while there is no second pick yet, when it is the instruction.
  hint.style.display = lbSecondPick === null ? '' : 'none';
  hint.textContent = 'Take one of the two and give up one of these.';

  optsEl.innerHTML = '';
  lbSacPool.forEach((opt, i) => {
    const btn = document.createElement('button');
    const isActive = lbSacrifice && lbSacrifice._i === i;
    btn.className = `lb-sac-btn ${isActive ? 'active' : ''}`.trim();
    btn.innerHTML = `<span class="lb-sac-main">${opt.label}</span><span class="lb-sac-sub">${opt.sub}</span>`;
    btn.onclick = () => { lbSacrifice = { ...opt, _i: i }; renderLimitBreak(); };
    optsEl.appendChild(btn);
  });
}

function confirmLimitBreak() {
  if (lbConfirmed) return;
  if (lbStage === 1) { lbLockIn(); return; }

  if (lbSecondPick === null) return;
  if (lbSacPool && lbSacPool.length && !lbSacrifice) {
    showMessage('Pick what you are giving up', 'var(--red)');
    return;
  }
  lbConfirmed = true;

  if (lbSacrifice) {
    if (lbSacrifice.type === 'limit') {
      const say = `${limitDeltaText(lbSacrifice.id, -1)} ${LIMITS_DEF.find(d => d.id === lbSacrifice.id).label}`;
      decrementLimit(lbSacrifice.id);
      showMessage(say, 'var(--red)');
    } else if (lbSacrifice.type === 'trick') {
      const lost = acquiredTricks.splice(lbSacrifice.id, 1)[0];
      // acquiredTricks is the ever-owned list; the TRAY is what scores.
      if (lost && typeof trickTray !== 'undefined') {
        const ti = trickTray.findIndex(t => t.id === lost.id);
        if (ti >= 0) trickTray.splice(ti, 1);
        renderTrickTray?.();
      }
      if (lost) showMessage(`✖ ${lost.name}`, 'var(--red)');
    } else if (lbSacrifice.type === 'knack') {
      const lost = acquiredKnacks.splice(lbSacrifice.id, 1)[0];
      updateKnackList?.();
      if (lost) showMessage(`✖ ${lost.name}`, 'var(--red)');
    }
  }

  const second = lbOffers[lbSecondPick];
  const secondId = second.id;
  const secondSay = `${limitDeltaText(secondId, 1)} ${LIMITS_DEF.find(d => d.id === secondId).label}`;
  const wasBlind = second.blind && !second.revealed;
  second._from = limits[secondId].current;
  second._gain = limitGain(secondId);
  second.revealed = true;
  incrementLimit(secondId);
  showMessage(secondSay, 'var(--gold)');

  // If the second pick was the gamble, hold the screen open long enough to SHOW
  // what it turned out to be. Closing on the same frame would mean the mystery
  // was only ever named by a toast, which is a poor payoff for taking it blind.
  if (wasBlind) {
    lbRevealing = true;
    lbPrimaryPick = lbSecondPick;    // draw it in the TAKEN slot, revealed
    lbSecondPick = null;
    renderLimitBreak();
    // Strip the screen back to just that one tile - everything else on it is a
    // choice, and there are none left to make.
    document.getElementById('lb-offers').innerHTML = '';
    document.getElementById('lb-second-title').style.display = 'none';
    document.getElementById('lb-sacrifice').style.display = 'none';
    document.getElementById('lb-sub').textContent = 'It was ' + LIMITS_DEF.find(d => d.id === secondId).label + '.';
    document.getElementById('lb-confirm').disabled = true;
    document.getElementById('lb-done').style.display = 'none';
    setTimeout(closeLimitBreak, 1200);
    return;
  }
  closeLimitBreak();
}

// "Just the one" - stage 2's way out. The free pick has already been applied.
function lbDone() {
  if (lbConfirmed) return;
  lbConfirmed = true;
  closeLimitBreak();
}

function closeLimitBreak() {
  document.getElementById('limitbreak-overlay').classList.remove('show');
  lbOffers = [];
  lbPrimaryPick = null;
  lbSecondPick = null;
  lbSacrifice = null;
  lbSacPool = null;
  lbStage = 1;
  lbRevealing = false;
  gameTimerPaused = false;
  // Reward-grid flow: hand back to its continuation (which starts the next round /
  // shop / event itself) instead of starting the round here.
  const cb = lbOnClose; lbOnClose = null;
  if (cb) { render(); cb(); return; }
  startRoundTimer();
  render();
}

(function wireLimitBreak() {
  const btn = document.getElementById('lb-confirm');
  if (btn) btn.addEventListener('click', confirmLimitBreak);
  const dn = document.getElementById('lb-done');
  if (dn) dn.addEventListener('click', lbDone);
})();

// ══════════════════════════════════════════════
// SLEIGHT SYSTEM - physical deck cards
// ══════════════════════════════════════════════
// Sleights live in the deck as special cards (_isSleight:true).
// They fall onto the grid and can be swapped/discarded/selected/played.
// LONG-PRESS: show tooltip (sleights may need single-tap to select for a hand).
// Activation depends on def.activation (see SLEIGHT_POOL header).

let sleightFreeSwapPending = false; // pivot: next swap costs no swap-charge/time

