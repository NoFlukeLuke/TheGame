function sfxBonusHand() {
  // Soft, quick rising ping - ducks under the goal-dance audio
  playTone({ freq: 880, type: 'sine', gain: 0.08, attack: 0.005,
             decay: 0.05, sustain: 0.4, release: 0.18, duration: 0.1 });
  playTone({ freq: 1320, type: 'sine', gain: 0.05, attack: 0.005,
             decay: 0.05, sustain: 0.3, release: 0.18, duration: 0.1, delay: 0.05 });
}

function showBonusHandScoreFlash(cells, scoreAmount) {
  // Floating "+N" text above the centroid of played cells
  if (!cells.length) return;
  const gridEl = document.getElementById('grid');
  let avgX = 0, avgY = 0;
  cells.forEach(([r, c]) => { avgX += cellLeft(c) + CARD_W / 2; avgY += cellTop(r) + CARD_H / 2; });
  avgX /= cells.length; avgY /= cells.length;

  const flash = document.createElement('div');
  flash.textContent = `+${scoreAmount.toLocaleString()}`;
  flash.style.cssText = `
    position: absolute;
    left: ${avgX}px;
    top: ${avgY}px;
    transform: translate(-50%, -50%);
    font-family: 'Cinzel', serif;
    font-size: 32px;
    font-weight: 600;
    color: #f5c042;
    text-shadow: 0 0 8px rgba(0,0,0,0.9), 0 0 16px rgba(245,192,66,0.5);
    -webkit-text-stroke: 1.5px rgba(0,0,0,0.85);
    pointer-events: none;
    z-index: 80;
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
  `;
  gridEl.appendChild(flash);
  void flash.offsetWidth;
  flash.style.opacity = '1';
  flash.style.transform = `translate(-50%, calc(-50% - 40px)) scale(1.1)`;
  setTimeout(() => {
    flash.style.opacity = '0';
    flash.style.transform = `translate(-50%, calc(-50% - 60px)) scale(1)`;
  }, 700);
  setTimeout(() => flash.remove(), 1100);
}

// BETWEEN ROUNDS the panel answers two different questions (r217).
//
// During a round it reads SCORE / GOAL, which is the live race. On a
// grid-takeover screen - the reward grid, a shop, an event - there is no live
// race: `score` has already been banked and zeroed by triggerLevelUp, so the
// panel was reading "Score 0" over "GOAL <the next one>" for the whole of every
// between-rounds screen. Zero is not what the round was worth, and it is the
// number the player most wants while deciding what to take.
//
// So on those screens it reads LAST ROUND over what that round scored, and
// NEXT GOAL over the goal about to be asked for. The progress bar is hidden:
// it would sit at 100% and mean nothing.
//
// `body.grid-screen` is the switch, set by enterGridScreenHud() and cleared by
// exitGridScreenHud() (js/shop-grid-preview.js), which is the same class the
// PIPS/MULT/FOCUS -> LOCATION swap already rides - so all three screens get
// this with no per-screen wiring.
function scorePanelIsBetweenRounds() {
  return document.body.classList.contains('grid-screen') && lastRoundGoal > 0;
}

function updateScoreUI() {
  if (suppressScoreDisplay) return; // hold display during goal hand dance
  const between = scorePanelIsBetweenRounds();
  const totalLabel = document.getElementById('score-total-label');
  const goalLabel  = document.getElementById('score-goal-label');
  const barWrap    = document.getElementById('score-progress-bar-wrap');
  if (totalLabel) totalLabel.textContent = between ? 'Last round' : 'Score';
  // lexTerm, never a literal: this label is the one r293 flipped from a
  // hardcoded QUOTA, and hardcoding GOAL instead is the same bug mirrored.
  const goalWord = (typeof lexTerm === 'function') ? lexTerm('goal') : 'GOAL';
  if (goalLabel)  goalLabel.textContent  = between ? ('NEXT ' + goalWord) : goalWord;
  if (barWrap)    barWrap.style.visibility = between ? 'hidden' : '';

  const shownScore = between ? lastRoundScore : score;
  // animateDigitEl rolls the digits; between rounds the number is a finished
  // fact rather than a climbing tally, so it is written straight in.
  if (!between) animateDigitEl(document.getElementById('score-total-num'), shownScore);
  const scoreDisplayEl = document.getElementById('score-total-num');
  if (scoreDisplayEl && scoreDisplayEl.style.visibility !== 'hidden') {
    scoreDisplayEl.textContent = shownScore.toLocaleString();
  }
  const pct = Math.min(score / roundGoal, 1);
  const bar = document.getElementById('score-progress-bar');
  if (bar) bar.style.width = Math.round(pct * 100) + '%';
  document.getElementById('goal-display').textContent = roundGoal.toLocaleString();
  document.getElementById('level-display').textContent = level;
  updateCoinsUI();
  updateRunProgressUI();
}

// Called from dance to update live pips/mult sub-boxes
function updateDanceSubboxes(pips, mult) {
  const pipsEl = document.getElementById('pips-val');
  const multEl = document.getElementById('mult-val');
  const prevPips = parseFloat(pipsEl.dataset.displayVal) || 0;
  const prevMult = parseFloat(multEl.dataset.displayVal) || 0;
  if (pips !== prevPips) { animateDigitEl(pipsEl, Math.round(pips)); popSubbox('pips-box'); }
  if (mult !== prevMult) { animateDigitEl(multEl, parseFloat(mult.toFixed(1))); popSubbox('mult-box'); }
}

// ── Selection readouts (r197, split r214) ──
// TWO readouts, deliberately answering different questions:
//   #sel-display (top bar, beside the coins) is STATIC - the Selection Size limit
//     itself. It is a property of the run, so it only moves when the limit is
//     upgraded, and it is readable at a glance without tracking a live count.
//   #sel-count (in the board's own margin) is the LIVE tally, x/y, where x is what
//     is in hand right now and y is the most this screen will take. On the reward
//     grid that is picked tiles over the pick cap.
// Both are written here so they can never disagree about the cap.
function updateSelectionUI() {
  const onReward = (typeof rewardOnGrid !== 'undefined' && rewardOnGrid);
  const onShop   = (typeof shopGridActive !== 'undefined' && shopGridActive);
  // The shop counts WEIGHT, not tiles: a row label takes two of your picks
  // (r307), so the x/y has to agree with the cap that refused the third.
  const n   = onShop ? (shopGridMode === 'buy' ? shopgSelWeight() : 0)
            : onReward ? rewardSelected.size : selected.length;
  const cap = (onShop || !onReward) ? limits.selection.current : rewardSelectionCap();
  const min = onShop ? 1
            : onReward ? (typeof rewardMinPicks === 'function' ? rewardMinPicks() : 1)
                       : (typeof handMinSelection === 'function' ? handMinSelection() : 1);

  // Top bar: the limit, not the count.
  const el = document.getElementById('sel-display');
  if (el) {
    el.textContent = `✋ ${limits.selection.current}`;
    el.classList.remove('sel-full');
  }
  const st = document.getElementById('sel-stat');
  if (st) st.classList.remove('sel-active');

  // Board margin: the live tally.
  const cEl = document.getElementById('sel-count');
  const vEl = document.getElementById('sel-count-val');
  if (!cEl || !vEl) return;
  // Only where a selection means something (r255). This used to be "gridData has
  // rows", which is true of a board of NULLS and of every screen that merely
  // BORROWS the grid - so the readout hung over the map, the crossroads, the
  // payout pick and the interlude, saying 0/3 about nothing. The three screens
  // where a number of picks is a real decision are the shop, the reward grid and
  // a live round; everywhere else it is noise.
  const body = document.body.classList;
  const boardLive = !body.contains('map-active') && !body.contains('pick-active')
    && !body.contains('grid-screen')
    && typeof gridData !== 'undefined' && Array.isArray(gridData)
    && gridData.some(row => row && row.some(c => c));
  const live = onReward || onShop || boardLive;
  cEl.classList.toggle('on', !!live);
  if (!live) return;
  vEl.textContent = `${n}/${cap}`;
  cEl.classList.toggle('below', n > 0 && n < min);
  cEl.classList.toggle('full',  n >= cap);
}

function updateCoinsUI() {
  document.getElementById('coins-display').textContent = '💰 ' + coins;
  if (typeof updateGridTopline === 'function') updateGridTopline();
  const scc = document.getElementById('sel-count-coins'); if (scc) scc.textContent = '💰' + coins;
  const cg = document.getElementById('ci-gold'); if (cg) cg.textContent = coins;
  if (document.getElementById('shop-overlay').classList.contains('show')) refreshShopAffordability();
  if (typeof updateSurvivalShopBtn === 'function') updateSurvivalShopBtn();
  if (typeof survivalUpdateRerollBtn === 'function' && document.getElementById('survival-pick-overlay')?.classList.contains('show')) survivalUpdateRerollBtn();
}

// Run-progress block (ACT n + node pips, or the boss sigil).
//
// There are TWO of these in the DOM and they carry the same content: #run-progress
// (the landscape box at the top-right) and #run-progress-pt (the portrait top-bar
// copy, which as of r160 replaces the old "Progress / ACT 1 · 0/5" text). Both
// carry `.rp-block`, so this fills whichever one the layout is showing and neither
// orientation needs its own update path.
//
// The BOSS SIGIL is set here rather than at the boss's own call sites, so it can
// never drift out of sync with the block it lives in: render() → updateScoreUI()
// → here repaints it, which matters because a boss round is exactly when the HUD
// is being rewritten constantly.
function updateRunProgressUI() {
  const bossOn = (typeof bossActive !== 'undefined') && bossActive;
  const actMode = (typeof isActMode === 'function') && isActMode();
  document.querySelectorAll('.rp-block').forEach(rp => {
    rp.classList.toggle('boss-sigil', bossOn);
    const act = rp.querySelector('.rp-act');
    // Outside the quarter structure (Survival) "Qn" is meaningless, but a boss
    // still needs a name over its mark.
    if (act) act.textContent = actMode ? ('Q' + actNumber) : (bossOn ? 'BOSS' : '');
    rp.querySelectorAll('.rp-nodes span:not(.boss)').forEach((s, i) => {
      s.classList.toggle('on', i < nodeInAct);
      s.classList.toggle('cur', i === nodeInAct);
    });
  });
  // Portrait: the block takes the top-left slot whenever it has something to say
  // - an act-mode run, or ANY mode's boss round. Otherwise that slot stays the
  // legacy game timer.
  if (typeof bindBossPeek === 'function') bindBossPeek();
  const live = actMode || bossOn;
  document.getElementById('run-progress-pt')?.classList.toggle('rp-live', live);
  document.getElementById('game-timer-stat')?.classList.toggle('rp-yielded', live);
}

let _knackCountShown = 0;
function updateKnackList() {
  applyTempoLimitOnce();   // Tempo sets the swap/discard limits to 2 the first time it's owned
  applyShortSuitOnce();    // Short Suit turns on Flush of 3 / Flush of 4 where they aren't already active
  const el = document.getElementById('knack-list');
  if (!el) return;
  // A newly GAINED Knack should land somewhere the player can see. In portrait
  // the Knacks row shares its box with the hand preview, so flip back to Knacks
  // when the count grows. Hooking the count here rather than the nine separate
  // acquiredKnacks.push sites means a future grant path gets this for free.
  // Update the tally BEFORE flipping the view: setPortraitPanelView re-runs this
  // function to re-measure the marquee, so a stale tally here recurses forever.
  const _knackGrew = acquiredKnacks.length > _knackCountShown;
  _knackCountShown = acquiredKnacks.length;
  if (_knackGrew && typeof portraitShowKnacks === 'function') portraitShowKnacks();
  // r254: losing Advance Notice VOIDS the reveal, so the next quarter re-draws
  // its boss. Hooked here for the same reason the flip above is: this is the
  // one function every removal path already calls (sellKnack, the grid shop's
  // sell board, the Limit Break sacrifice, the event that takes a knack), and
  // four call sites would have been four chances to miss one. It also covers
  // selling it and buying it back, which should name a different boss.
  if (typeof forgetNextActBoss === 'function'
      && typeof hasKnack === 'function' && !hasKnack('advance_notice')) forgetNextActBoss();
  if (acquiredKnacks.length === 0) {
    el.innerHTML = '';   // empty → faint KNACKS watermark shows through (r95)
    return;
  }
  // Chips live in a marquee track so the row can slowly auto-scroll when it
  // overflows (no arrows / no scrollbar - r113).
  el.innerHTML = `<div class="chip-marquee">${acquiredKnacks.map(t =>
    `<div class="knack-chip" data-knack-id="${t.id}" tabindex="0" role="button" aria-label="${t.name}">${emGlyph(t.emoji)}</div>`
  ).join('')}</div>`;
  const track = el.firstElementChild;
  // Landscape scrolls the row by hand (no scrollbar - css) since r237; the
  // marquee's duplicated chips would read as owning everything twice there.
  // Portrait keeps the marquee.
  const _stg = document.getElementById('stage');
  if (!(_stg && _stg.classList.contains('landscape'))) applyChipMarquee(el, track);
  // Wire interactions on every chip (originals + marquee clones)
  el.querySelectorAll('.knack-chip').forEach(chip => {
    const id = chip.dataset.knackId;
    chip.addEventListener('mouseenter', () => { cancelKnackHoverHide(); showKnackTooltip(chip, id); });
    chip.addEventListener('mouseleave', () => scheduleKnackHoverHide());
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const tt = document.getElementById('knack-tooltip');
      if (tt && tt.dataset.knackId === id && tt.classList.contains('show')) hideKnackTooltip();
      else showKnackTooltip(chip, id);
    });
  });
}

// Slow horizontal auto-scroll for an overflowing chip row (knacks / tricks).
// `list` clips; `track` holds the chips. If the track is wider than the list we
// duplicate its contents and animate translateX 0 → -50% for a seamless loop.
// Duration scales with width (~26px/s) so it always crawls. No scroll UI.
// Synchronous (forces one reflow) so the caller can wire listeners to the
// cloned chips right after this returns.
function applyChipMarquee(list, track) {
  if (!list || !track) return;
  track.classList.remove('scrolling');
  track.style.removeProperty('--marquee-dur');
  const listW = list.clientWidth;
  if (listW <= 0) return;                       // not laid out yet - leave static
  const oneSet = track.scrollWidth;
  if (oneSet <= listW + 2) return;              // fits - no scroll needed
  track.innerHTML += track.innerHTML;           // duplicate for a seamless loop
  const dur = Math.max(12, Math.round(oneSet / 26));
  track.style.setProperty('--marquee-dur', dur + 's');
  track.classList.add('scrolling');
}

// Back-compat alias - older call sites updateTrickList() still re-render the rack
function updateTrickList() { updateKnackList(); }

// Grace-delay hide so the pointer can travel from the chip to the tooltip's Sell button.
let _knackHoverTimer = null;
function cancelKnackHoverHide() { if (_knackHoverTimer) { clearTimeout(_knackHoverTimer); _knackHoverTimer = null; } }
function scheduleKnackHoverHide() { cancelKnackHoverHide(); _knackHoverTimer = setTimeout(hideKnackTooltip, 160); }

// A knack's description as the player should read it RIGHT NOW (r254).
//
// The mirror of trickLiveDesc, and it exists for the same reason: the pool's
// `desc` is what a knack does, and some knacks also have something to SAY. It
// is used by the HUD tooltip and by RECORDS Owned, both of which only ever
// draw a knack you hold - so "only after it is purchased" falls out of where
// this is called rather than needing a test. The shop tile reads the pool's
// plain desc and therefore never spoils the reveal.
function knackLiveDesc(k) {
  if (!k) return '';
  const base = k.desc || '';
  if (k.id !== 'advance_notice') return base;
  // Belt and braces: the dev panel can put a chip on screen for a knack the
  // run does not own, and an unowned Advance Notice must not reveal anything.
  if (typeof hasKnack === 'function' && !hasKnack('advance_notice')) return base;
  const p = (typeof peekNextActBoss === 'function') ? peekNextActBoss() : null;
  if (!p) {
    const last = (typeof isActMode === 'function' && isActMode() && typeof actNumber === 'number' && actNumber >= QUARTERS_PER_RUN);
    return base + `<div class="kn-reveal kn-reveal-none">${last
      ? 'This is the last quarter. There is no next boss to name.'
      : 'This mode has no next quarter to look into.'}</div>`;
  }
  const q = (typeof actNumber === 'number') ? actNumber + 1 : 2;
  return base
    + `<div class="kn-reveal"><span class="kn-reveal-q">Q${q} BOSS</span>`
    + `<b>${p.name || ''}</b>`
    + (p.brief ? `<span>${p.brief}</span>` : '')
    + `</div>`;
}

function showKnackTooltip(chip, id) {
  const knack = KNACK_POOL.find(t => t.id === id);
  if (!knack) return;
  let tt = document.getElementById('knack-tooltip');
  if (!tt) return;
  const _sv = (typeof knackSellValue === 'function') ? knackSellValue() : 0;
  // The live part is built separately and appended: colorizeKeywords rewrites
  // prose and would chew through the reveal's own markup.
  const _live = knackLiveDesc(knack);
  const _reveal = _live.slice((knack.desc || '').length);
  tt.innerHTML = `
    <button class="tt-close" aria-label="Close">✕</button>${kwMoreHTML(knack.desc)}
    <div class="knack-tooltip-name">${knack.emoji} ${knack.name}</div>
    <div class="knack-tooltip-desc">${colorizeKeywords(knack.desc)}${_reveal}</div>
    ${kwDefsHTML(knack.desc)}
    <div class="knack-tooltip-actions"><button class="knack-tooltip-sell" id="knack-tooltip-sell-btn">Sell 💰${_sv}</button></div>
  `;
  // r288 - the + is the only way to the definitions, on every tooltip.
  tt.classList.remove('kw-open');
  tt.dataset.knackId = id;
  // Keep the bubble open while the pointer is over it (so Sell is clickable); wire once via props.
  tt.onmouseenter = cancelKnackHoverHide;
  tt.onmouseleave = scheduleKnackHoverHide;
  // Same confirm the Trick tray uses, through the same helper, so the two
  // cannot drift into asking differently (r278).
  tt.querySelector('#knack-tooltip-sell-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    tipConfirmAction(tt.querySelector('.knack-tooltip-actions'), {
      question: `Sell for 💰${_sv}?`, confirmLabel: 'Sell',
      onYes: () => sellKnack(knack), onCancel: () => showKnackTooltip(chip, id),
    });
  });
  tt.querySelector('.tt-close')?.addEventListener('click', e => { e.stopPropagation(); hideKnackTooltip(); });
  wireKwMore(tt, tt, () => placeTipSmart(chip, tt, { gap: 8 }));
  // Opens into whichever side of the chip has the most room (was hardcoded to
  // above). One frame's wait so the bubble has been laid out and can be measured.
  tt.classList.add('show');
  requestAnimationFrame(() => placeTipSmart(chip, tt, { gap: 8 }));
}
function hideKnackTooltip() {
  const tt = document.getElementById('knack-tooltip');
  if (tt) { tt.classList.remove('show'); tt.dataset.knackId = ''; }
}
// Tap anywhere else dismisses tooltip
document.addEventListener('click', (e) => {
  if (!e.target.closest('.knack-chip') && !e.target.closest('#knack-tooltip')) hideKnackTooltip();
}, true);

// ══════════════════════════════════════════════
// HAND-TYPE LABEL (r198) - #hand-name, beside the hand preview
// ══════════════════════════════════════════════
// What you are about to play, named. The preview CARDS are deliberately inert
// until a hand is submitted (r99 - the preview is the scoring stage, not a live
// readout), but the NAME is the one thing you want before you commit, and with
// layered hands it is now the only place the second hand is visible at all.
//
// Two lines per layer, family over size ("RUN / 3"), because the desktop panel
// gives this a 6%-wide column. Portrait flattens the same markup onto one line
// with CSS - one renderer, no per-orientation branch.
let _handNameKey = null;   // last markup written, so render() does not thrash the DOM

// r234: the label is HELD for the length of a scoring dance.
//
// updateHandNameLabel runs from render(), and the dance calls render() several
// times (removeAndFall repaints, the board refills) with the selection already
// cleared - so the one moment the player most wants to know what they played,
// the label went blank. Holding it is the whole fix and it costs no space: the
// name is already sitting in the 44px column beside the preview, so it stays
// legible right through the tally, including the second component of a layered
// hand ("RUN 3 + FLUSH 3") which is the part that was surprising people.
//
// A hold is released by whichever path ends the dance - the normal tail and
// dncFinishAbort - never left to time out.
let _handNameHeld = false;
function holdHandNameLabel(on) { _handNameHeld = !!on; }

function handLabelHTML(runs) {
  return runs.map(({ n, k }) => {
    const l = HAND_LABEL[n];
    const x = k > 1 ? `<u>x${k}</u>` : '';
    // A numeric size reads "OF N" (owner spec, r333): SET / OF 3, RUN / OF 4.
    // Word sizes (TWO / PAIR, FULL / HOUSE, HIGH / CARD) print as they are -
    // the break is always between whole words, never inside one.
    const sz = l && /^\d/.test(l.size) ? 'OF ' + l.size : (l && l.size);
    return l ? `<span class="hn-l"><b>${l.fam}</b><i>${sz}${x}</i></span>`
             : `<span class="hn-l"><b>${n}</b>${x}</span>`;
  }).join('<span class="hn-plus">+</span>');
}

function updateHandNameLabel(result) {
  if (_handNameHeld) return;         // a dance owns this label until it ends
  const el = document.getElementById('hand-name');
  if (!el) return;
  // handLayersFor is what calcScore pays for, so the label can never name a hand
  // the score did not count (or miss one it did).
  // r200: below the minimum selection the label states the requirement instead of
  // naming a hand. The player is looking right here to find out what they have,
  // so it is where "you cannot play this yet, and why" belongs.
  if (result && result.short) {
    const html = `<span class="hn-l hn-need"><b>NEED</b><i>${result.short}</i></span>`;
    if (html !== _handNameKey || el.innerHTML !== html) { _handNameKey = html; el.innerHTML = html; }
    el.classList.remove('hn-layered');
    return;
  }
  let names = (result && result.hand)
    ? ((typeof handLayersFor === 'function') ? handLayersFor(result.hand, result.handCells) : [result.hand])
    : [];
  // Repeats are real (two Sets of 3), but printing SET 3 + SET 3 in a 44px column
  // is not - so a repeat collapses to a count: SET 3 x2.
  const runs = [];
  names.forEach(n => { const last = runs[runs.length - 1]; if (last && last.n === n) last.k++; else runs.push({ n, k: 1 }); });
  names = runs;
  let html = names.length ? handLabelHTML(names) : '';
  // r254: the best hand DROPS some of the selection (r201's load-bearing rule).
  // Those cards are red on the board; here is the bill - N cards, minus their
  // pips - stated in the one place the player is already reading before commit.
  const _pen = (result && result.penaltyCells && result.penaltyCells.length) || 0;
  if (html && _pen > 0) {
    html += `<span class="hn-plus">−</span>`
          + `<span class="hn-l hn-drop"><b>DROP</b><i>${_pen} · −${result.penaltyPips || 0}</i></span>`;
  }
  // r326: the TAGALONGS, which only the knack permits. They are separate from
  // DROP on purpose - a dropped card is the hand refusing a passenger, a tagalong
  // is the hand carrying one because you paid to be allowed to. Both are red and
  // both are a bill; only this one also quotes the clock.
  //
  // Stating it here is the whole answer to "it kept saying RUN 3 x2 when the hand
  // wasn't even a run": the label was naming the components and saying nothing
  // about the two or three cards riding along beside them. Measured at Selection
  // Size 7 with Tagalong owned, 73% of hands were carrying at least one.
  const _tag = (result && result.tagalongCells && result.tagalongCells.length) || 0;
  if (html && _tag > 0) {
    const _ts = result.tagalongSeconds || 0;
    html += `<span class="hn-plus">−</span>`
          + `<span class="hn-l hn-drop"><b>TAG</b><i>${_tag} · −${result.tagalongPips || 0}${_ts > 0 ? ` · −${_ts}s` : ''}</i></span>`;
  }
  // Also compare the live DOM: other screens (Dominoes) write this element
  // directly, and a cache hit would then leave their text standing.
  if (html === _handNameKey && el.innerHTML === html) return;
  _handNameKey = html;
  el.innerHTML = html;
  el.classList.toggle('hn-layered', names.length > 1);   // two or more components: step the type down
}

// ══════════════════════════════════════════════
// CARD INTERACTION - tap or swipe to select, double-tap to swap
// ══════════════════════════════════════════════

let swapPending = null;   // [r,c] of first card in pending swap
let lastTapCell = null;
let lastTapTime = 0;
