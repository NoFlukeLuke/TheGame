// TWO kinds of unusable cell, both funnelled through here so every existing
// select/tap/swipe guard covers both without change:
//   · blockedCells - VOID: no card at all (legacy boss patterns)
//   · nullCells    - QUARANTINED: a card is present but inert (The Quarantine)
// Anything that needs to tell them apart (card refill, render) asks isCellVoid /
// isCellNulled directly.
function isCellBlocked(r, c) {
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return false; // Fight the Power
  if (blockedCells.has(`${r}-${c}`)) return true;
  return typeof nullCells !== 'undefined' && nullCells.has(`${r}-${c}`);
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
  if (typeof renderBossCellOverlays === 'function') renderBossCellOverlays();
  gridEl.querySelectorAll('.blocked-cell').forEach(el => el.remove());
  // Only VOID cells lose their card; quarantined cells (The Quarantine) keep
  // receiving and holding cards, they are just inert.
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
// Bosses no longer carry their own score target (r155, all modes): the win bar is
// simply THIS ROUND'S GOAL, exactly like a normal round. A boss's challenge is its
// modifier - plus, for 'hand' bosses, a hand requirement layered ON TOP of the goal.
function bossGoalMet() { return score >= roundGoal; }

function checkBossObjective(handName, handFinalScore) {
  if (!bossActive || !currentBoss) return;
  const obj = currentBoss.objective;
  if (obj.type === 'hand' && handName === obj.handName) bossObjectiveProgress++;
  const handDone = (obj.type !== 'hand') || (bossObjectiveProgress >= obj.count);
  if (handDone && bossGoalMet()) endBoss(true);
  updateBossObjectiveUI();
}
let bossScoreAtStart = 0;

function updateBossObjectiveUI() {
  if (!bossActive || !currentBoss) return;
  const obj = currentBoss.objective;
  // r171 - there is no separate "score requirement" panel over the board any
  // more, in any mode or orientation. The bar IS the round goal (r155), and the
  // round goal already has a chip on screen; a second panel restating it was
  // both redundant and covering the cards. What the goal chip could NOT say on
  // its own is a hand boss's tally, so that goes underneath it.
  const extra = document.getElementById('boss-goal-extra');
  if (extra) {
    if (obj.type === 'hand') {
      extra.textContent = `${obj.handName.toUpperCase()} ${bossObjectiveProgress}/${obj.count}`;
      extra.classList.toggle('done', bossObjectiveProgress >= obj.count);
      extra.style.display = '';
    } else extra.style.display = 'none';
  }
  // Voidwright: also update the pool display
  const poolEl = document.getElementById('boss-trick-pools');   // lives in the brief now
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
    // The r150 roster lives in js/boss-effects.js; it claims its own modifier
    // ids and returns true, leaving the legacy ones below untouched.
    if (typeof applyBossEffectModifier === 'function' && applyBossEffectModifier(mod, preset.params || {})) return;
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
  if (typeof clearBossEffects === 'function') clearBossEffects();
}

// Hook called every time a card is drawn - biases toward low cards during Famine
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
  if (typeof bossTrickBlackedOut === 'function' && bossTrickBlackedOut(trickId)) return true; // The Censor
  if (bossPhase === 1 && trickPoolA.has(trickId)) return true;
  if (bossPhase === 2 && trickPoolB.has(trickId)) return true;
  return false;
}

// ── Boss trigger / end ──
// The active boss's clock length. Defaults to BOSS_WINDOW_DURATION; Survival passes
// its banked leftover time here (see survivalTriggerBoss) so the boss clock is
// "the time you saved across the last 8 clears, capped at 3 minutes."
let bossWindowDuration = BOSS_WINDOW_DURATION;

// ── Which boss you get (r179) ──
// This used to be BOSS_PRESETS[bossNumber % length] with bossNumber starting at 0
// every run, so the order was FIXED: boss 1 was always The Stone Lord, boss 2
// always The Voidwright, boss 3 always The Hand of Famine. A Classic act run
// fights exactly 3 bosses and Survival/Flow 5, so 11 of the 16 presets - the
// entire r150/r151 roster - could never appear in normal play, and the three you
// always got were the quietest ones on the list. That is the whole reason bosses
// "didn't seem to do anything".
//
// It is a BAG, not a re-roll per boss: shuffle the whole roster, deal from it,
// refill when empty. No repeats inside a run, and every boss is reachable.
let bossBag = [];

// A boss whose only modifier can't bite right now is a wasted round. The
// Voidwright splits your owned Tricks in two and disables half; The Censor
// suspends one at a time. With 0 or 1 Tricks owned both are literally no-ops, so
// they are passed over until the player has something to lose.
function bossPresetIsLive(preset) {
  const owned = (typeof acquiredTricks !== 'undefined' ? acquiredTricks : []).length;
  const mods  = preset.modifiers || [];
  if ((mods.includes('trick_pool_split') || mods.includes('trick_blackout')) && owned < 2) return false;
  return true;
}

function nextBossPreset() {
  // Two passes: prefer a boss that can actually act; if the bag holds nothing
  // live (very early run, no Tricks yet) take the front of the bag anyway rather
  // than loop forever.
  for (let refill = 0; refill < 2; refill++) {
    if (!bossBag.length) bossBag = shuffle(BOSS_PRESETS.map(p => p.id));
    const liveIdx = bossBag.findIndex(id => {
      const p = BOSS_PRESETS.find(x => x.id === id);
      return p && bossPresetIsLive(p);
    });
    if (liveIdx >= 0) {
      const [id] = bossBag.splice(liveIdx, 1);
      return BOSS_PRESETS.find(p => p.id === id);
    }
    bossBag = [];   // nothing live in this bag - reshuffle and try once more
  }
  return BOSS_PRESETS[Math.floor(Math.random() * BOSS_PRESETS.length)];
}

function triggerBoss(presetOverride = null, windowSeconds = null) {
  if (bossActive) return;
  bossWindowDuration = (typeof windowSeconds === 'number' && windowSeconds > 0) ? windowSeconds : BOSS_WINDOW_DURATION;
  const preset = structuredClone(presetOverride || nextBossPreset());
  currentBoss = preset;
  bossActive = true;
  bossNumber++;
  bossPhase = 1;
  bossObjectiveProgress = 0;
  bossScoreAtStart = score;   // vestigial since r155 (boss bar = roundGoal); kept for save/debug shape

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
  bossSecondsLeft = bossWindowDuration;
  document.getElementById('clock').classList.add('boss-mode');
  document.getElementById('clock-bar').classList.add('boss-mode');
  document.getElementById('grid').classList.add('boss-active');
  // The sigil itself is applied by updateRunProgressUI (called from
  // updateActProgressUI below) so BOTH progress blocks - landscape and portrait -
  // get it, in every mode that can run a boss.

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

  // The clock does NOT start here. The preamble names the boss and explains what
  // it does; only when the player presses PROCEED does the 3-2-1 run and the
  // boss timer start. gameTimerPaused is held for the duration so nothing ticks
  // behind the briefing.
  showBossPreamble(preset, () => {
    showBossCountdown().then(() => { startBossTimer(); });
  });
}

// Boss briefing rendered over the board. `onProceed` fires when dismissed.
//
// r171 - the briefing is REOPENABLE. It is the only place the boss's rules are
// written down, and it used to be a one-shot you could dismiss and never see
// again; now the red GOAL chip and the act/sigil readout are also its handle
// (see bindBossBriefReopen - SCORE is the hand log's, not the brief's).
// Reopening does NOT pause the clock - a pausable rules panel would be a free
// timeout on every boss round.
let _bossBriefPreset = null;

function bossBriefHTML(preset, intro) {
  const obj = preset.objective;
  // The bar is THIS ROUND'S GOAL (r155). objective.target is vestigial for score
  // bosses, and quoting it here was showing a number nothing compares against.
  const objText = (obj.type === 'hand')
    ? `OBJECTIVE - REACH THE GOAL, AND PLAY ${obj.count} × ${obj.handName.toUpperCase()}`
    : `OBJECTIVE - REACH THE GOAL (${roundGoal.toLocaleString()})`;
  return `<button class="bp-x" aria-label="Close briefing">&#10005;</button>` +
    `<div class="bp-sigil">&#9760;</div>` +
    `<div class="bp-eyebrow">Boss round</div>` +
    `<div class="bp-name">${preset.name}</div>` +
    `<div class="bp-flavor">${preset.flavor || ''}</div>` +
    `<div class="bp-brief">${preset.brief || 'Survive the review.'}</div>` +
    `<div class="bp-obj">${objText}</div>` +
    `<div id="boss-trick-pools"></div>` +
    (intro ? `<button class="bp-go">PROCEED</button>`
           : `<div class="bp-hint">the clock is still running</div>`);
}

function showBossPreamble(preset, onProceed) {
  // Mounted on #grid (not #grid-slot) so the briefing covers the board exactly;
  // the slot is wider and the panel spilled past the cards.
  const slot = document.getElementById('grid');
  if (!slot) { onProceed(); return; }
  document.getElementById('boss-preamble')?.remove();
  _bossBriefPreset = preset;
  const el = document.createElement('div');
  el.id = 'boss-preamble';
  el.innerHTML = bossBriefHTML(preset, true);
  slot.appendChild(el);
  _bossPreambleHeld = true;
  gameTimerPaused = true;
  // The briefing grows out of the boss sigil in the run-progress block and, on
  // close, shrinks back into it - so the mark that sits there for the whole round
  // is visibly where the boss came from. Falls back to the plain fade if the
  // sigil isn't on screen (no anchor to fly from).
  //
  // The ENTRY is a Web Animation, not the CSS transition the return flight uses.
  // Setting the start transform inline and clearing it a frame later gets
  // coalesced into one style recalc, so the transition never has two values to
  // interpolate between and the panel just fades in at full size (verified: the
  // measured width never left 407px). Forcing layout doesn't help either -
  // transform doesn't affect layout, so there is nothing for offsetWidth to
  // flush. el.animate() states both ends explicitly and can't be coalesced away.
  // The return flight is a genuine change on a settled element, so the CSS
  // transition handles that one correctly.
  const fly = _bossPreambleFlyTransform(el);
  el.classList.add('show');
  if (fly && typeof el.animate === 'function') {
    el.animate([{ transform: fly, opacity: 0 }, { transform: 'none', opacity: 1 }],
               { duration: 400, easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
  // Both the ✕ and PROCEED start the round - the briefing is the gate, and
  // closing it must never leave the boss un-started.
  const go = () => {
    const back = _bossPreambleFlyTransform(el);
    if (back) el.style.transform = back;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 420);
    if (_bossPreambleHeld) { gameTimerPaused = false; _bossPreambleHeld = false; }
    onProceed();
  };
  el.querySelector('.bp-go').onclick = go;
  el.querySelector('.bp-x').onclick  = go;
}

// Re-open the briefing mid-boss as a reference. No pause, no PROCEED.
function reopenBossBrief() {
  if (!bossActive || !_bossBriefPreset) return;
  const existing = document.getElementById('boss-preamble');
  if (existing) { existing.classList.remove('show'); setTimeout(() => existing.remove(), 320); return; }
  const slot = document.getElementById('grid');
  if (!slot) return;
  const el = document.createElement('div');
  el.id = 'boss-preamble';
  el.className = 'bp-reopened';
  el.innerHTML = bossBriefHTML(_bossBriefPreset, false);
  slot.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  el.querySelector('.bp-x').onclick = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 320);
  };
  if (typeof updateBossObjectiveUI === 'function') updateBossObjectiveUI();
}

// The alarming SCORE / GOAL chips double as the way back to the briefing, plus
// the act/level readout in the top bar. Bound once at load; each handler checks
// bossActive, so they are inert the rest of the time.
function bindBossBriefReopen() {
  // NOT #score-center (r177): that chip belongs to the hand log, which is a
  // whole-run reference the player wants during a boss as much as outside one.
  // The GOAL chip beside it is in the same alarm state and sits right there, and
  // the act/sigil readout is the other natural "what am I fighting" handle, so
  // the brief loses nothing by giving up SCORE.
  // run-progress-pt is the portrait copy of the progress block (r176). In act
  // mode / on a boss it is what shows there and game-timer-stat is hidden, so
  // without it portrait would lose the top-bar handle entirely.
  ['score-left', 'game-timer-stat', 'run-progress', 'run-progress-pt'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el._bossBriefBound) return;
    el._bossBriefBound = true;
    el.addEventListener('click', () => { if (bossActive) reopenBossBrief(); });
  });
}

let _bossPreambleHeld = false;

// The on-screen rect of the boss sigil - the mark inside whichever .rp-block the
// current layout is showing (landscape's #run-progress, portrait's top-bar copy).
function _bossSigilAnchorRect() {
  for (const b of document.querySelectorAll('.rp-block.boss-sigil')) {
    const r = b.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;           // the other orientation's copy
    const sr = b.querySelector('.rp-sigil')?.getBoundingClientRect();
    return (sr && sr.width > 1) ? sr : r;
  }
  return null;
}

// The transform that puts `el` over the sigil, shrunk to its size.
//
// Both rects come from getBoundingClientRect, i.e. real viewport pixels - but a
// `transform: translate()` on an element INSIDE #cabinet is in that element's own
// CSS pixels, which the cabinet's `zoom` then scales. So the measured delta has
// to be divided by the effective zoom, read off the element itself (rect width vs
// layout width) rather than assumed from --stage-zoom.
function _bossPreambleFlyTransform(el) {
  const a = _bossSigilAnchorRect();
  if (!a) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const zoom = r.width / (el.offsetWidth || r.width);
  if (!(zoom > 0)) return null;
  const scale = Math.max(0.05, Math.min(1, a.width / r.width));
  const dx = (a.left + a.width  / 2 - (r.left + r.width  / 2)) / zoom;
  const dy = (a.top  + a.height / 2 - (r.top  + r.height / 2)) / zoom;
  return `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(${scale.toFixed(3)})`;
}

// The round-start 3-2-1 (show321Countdown) also deals cards and refills the
// clock; a boss needs neither. This is just the numbers.
function showBossCountdown() {
  const overlay = document.getElementById('countdown-321-overlay');
  const numEl   = document.getElementById('countdown-321-number');
  if (!overlay || !numEl) return Promise.resolve();
  if (typeof sfxCountdown321 === 'function') sfxCountdown321();
  return (async () => {
    for (const n of ['3','2','1']) {
      numEl.textContent = n;
      numEl.style.animation = 'none'; void numEl.offsetWidth;
      numEl.style.animation = 'countdown-pop 500ms ease forwards';
      overlay.classList.add('show');
      await new Promise(r => setTimeout(r, 500));
    }
    overlay.classList.remove('show');
    await new Promise(r => setTimeout(r, 120));
  })();
}

function updateBossClockDisplay() {
  if (!bossActive) return; // never clobber the round clock when no boss is running
  const m = Math.floor(bossSecondsLeft / 60);
  const s = bossSecondsLeft % 60;
  document.getElementById('clock').textContent = `${m}:${s.toString().padStart(2,'0')}`;
  document.getElementById('clock-bar').style.width = (bossSecondsLeft / bossWindowDuration * 100) + '%';
}

// Single source of truth for the boss countdown. Clears any existing boss interval first
// (so it can't be double-started) and self-terminates if bossActive ever goes false (so an
// orphaned timer can't keep writing the clock - the cause of the "clock flickers to 0" bug).
function startBossTimer() {
  if (bossInterval) { clearInterval(bossInterval); bossInterval = null; }
  // The r150/r151 roster's timed effects are armed by applyBossModifiers but held
  // until here, so their opening tick lands with the clock rather than behind the
  // briefing panel (see bossSchedule).
  if (typeof bossStartScheduledEffects === 'function') bossStartScheduledEffects();
  bossInterval = setInterval(() => {
    if (!bossActive) { clearInterval(bossInterval); bossInterval = null; return; }
    if (gameTimerPaused) return;
    bossSecondsLeft -= (typeof bossClockStep === 'function') ? bossClockStep() : 1;
    if (bossSecondsLeft < 0) bossSecondsLeft = 0;
    updateBossClockDisplay();
    if (bossPhase === 1 && bossSecondsLeft === Math.floor(bossWindowDuration / 2)) {
      bossPhase = 2;
      updateBossObjectiveUI();
      showMessage('PHASE 2', 'var(--red)');
    }
    if (bossSecondsLeft <= 0) endBoss(false);
  }, 1000);
}

// r171 - no panel. A boss puts the SCORE and GOAL chips into alarm state (red,
// pulsing) so the two numbers that decide the round are the two that shout, and
// hangs the hand-tally line under the goal.
function showBossObjectiveHUD(preset) {
  document.getElementById('boss-objective-hud')?.remove();
  bossSetAlarm(true);
  ensureBossGoalExtra();
  updateBossObjectiveUI();
}

function hideBossObjectiveHUD() {
  document.getElementById('boss-objective-hud')?.remove();
  bossSetAlarm(false);
  const extra = document.getElementById('boss-goal-extra');
  if (extra) extra.style.display = 'none';
}

// The alarm lives on the two chips themselves so it follows them into either
// orientation - landscape positions #score-center / #score-left absolutely and
// portrait grids them, but both keep the elements.
function bossSetAlarm(on) {
  ['score-center', 'score-left'].forEach(id =>
    document.getElementById(id)?.classList.toggle('boss-alarm', !!on));
  document.getElementById('score-panel')?.classList.toggle('boss-alarm-panel', !!on);
}

// A hand boss's tally, parked under the goal number. Created once and reused.
function ensureBossGoalExtra() {
  let el = document.getElementById('boss-goal-extra');
  if (el) return el;
  const host = document.getElementById('score-left');
  if (!host) return null;
  el = document.createElement('div');
  el.id = 'boss-goal-extra';
  host.appendChild(el);
  return el;
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
  document.getElementById('boss-preamble')?.remove();
  _bossBriefPreset = null;
  if (_bossPreambleHeld) { gameTimerPaused = false; _bossPreambleHeld = false; }
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
    if (survivalActive()) {
      // Survival: no reward grid - a bonus pick-of-three, then back to normal rounds.
      // The banked time was spent on this boss, so reset it for the next 8-clear cycle.
      survivalBossTimeBank = 0;
      setTimeout(() => survivalPostBossReward(), 1100);
    } else if (isActMode()) {
      // Node-based: the post-boss grid is an interlude that starts the next act.
      // nodeInAct stays at 5 so closeRewardGrid knows to reset it and advance actNumber.
      // Since r179 that grid is the PRIZE grid - smaller, all rewards, no commons -
      // and it REPLACES the ordinary reward grid rather than following it.
      setTimeout(() => { rewardGridContext = 'interlude'; openPrizeGrid(); }, 1000);
    } else {
      // Timer-based modes: restore round timer and resume the interrupted round
      roundSeconds = savedRoundSeconds;
      updateClockUI();
      setTimeout(() => { rewardGridContext = 'boss'; openPrizeGrid(); }, 1000);
    }
  } else {
    if (typeof flowEndBoss === 'function') flowEndBoss();
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
// by limits.selection - so upgrading play-grid limits upgrades rewards too.

let rewardSelected = new Set(); // "r-c" keys
// The order tiles were picked in, and which tile's tooltip is pinned. Together
// they keep "the most recently picked tile is the one being explained" true even
// after a deselect (js/reward-grid.js, r182).
let rewardPickOrder = [];
let rewardCells    = [];        // NxN array of { kind, payload }
let rewardConfirmed = false;
let rewardOnGrid   = false;     // true while the reward grid is rendered onto the play #grid (r100+)
let rewardDealing  = false;     // true while reward tiles are dealing in / resolving (blocks clicks)
let rewardGridContext = 'interlude'; // 'interlude' | 'boss' - determines what closeRewardGrid does
let skipTrickChoiceOverlay = false;    // set before drainLevelUpQueue when reward grid is the reward screen
let rewardGridsSeen = 0;               // how many reward grids opened this run (for first-5 guaranteed upgrades)

