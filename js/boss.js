// TWO kinds of unusable cell, both funnelled through here so every existing
// select/tap/swipe guard covers both without change:
//   · blockedCells - VOID: no card at all (legacy boss patterns)
//   · nullCells    - QUARANTINED: a card is present but inert (The Quarantine)
// Anything that needs to tell them apart (card refill, render) asks isCellVoid /
// isCellNulled directly.
function isCellBlocked(r, c) {
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return false; // Fight the Power
  if (blockedCells.has(`${r}-${c}`)) return true;
  if (typeof nullCells !== 'undefined' && nullCells.has(`${r}-${c}`)) return true;
  // A card on hold (The Hold, r209) is inert wherever it happens to be sitting.
  // Answering it here is the same trick nullCells uses: every select, tap, swipe
  // and reachability guard in the game already asks this one question, so the
  // hold needs no changes in input.js, hand-detect.js, match3.js or tutorial.js.
  if (typeof isCardHeld === 'function' && isCardHeld(gridData[r]?.[c])) return true;
  return false;
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

// Drop `count` stones straight onto live cells, displacing the cards that were
// there back into the deck. Boss-start only (The Stone Lord).
function placeStonesOnGrid(count) {
  const spots = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r]?.[c];
    if (!card || !card.rank || card._isSleight || card._isTrick || card._isStone) continue;
    if (blockedCells.has(`${r}-${c}`)) continue;
    spots.push([r, c]);
  }
  // Never bury the whole board - leave at least half the live cells playable.
  const take = Math.min(count, Math.floor(spots.length / 2));
  for (let i = 0; i < take && spots.length; i++) {
    const [r, c] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    const displaced = gridData[r][c];
    if (displaced && displaced.rank) discardToDrawPile(displaced);
    gridData[r][c] = makeStoneCard();
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
  // Voidwright: refresh the pool display (the phase marker moves at halftime, and
  // the brief can be reopened at any point in the round).
  const poolEl = document.getElementById('boss-trick-pools');   // lives in the brief now
  if (poolEl && currentBoss.modifiers.includes('trick_pool_split')) poolEl.innerHTML = bossTrickPoolsHTML();
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
      case 'inject_stones': {
        // r216: two separate doses, because they do different jobs.
        //
        // 1. STONES ON THE BOARD, NOW. Before this every stone went into the draw
        //    pile, so the boss opened on a perfectly clean board and the player
        //    only met a stone several hands later. The count scales with the
        //    board so a 7x7 is not trivially easy and a 4x4 is not buried:
        //    the average of rows and cols, minus one if either side is 4 or less,
        //    plus one if either is 6 or more (both can apply on a 4x6).
        // 2. STONES IN THE DECK, for the rest of the round - 18% of the real deck.
        const _rows = gridRows, _cols = gridCols;
        let _onBoard = Math.round((_rows + _cols) / 2);
        if (_rows <= 4 || _cols <= 4) _onBoard -= 1;
        if (_rows >= 6 || _cols >= 6) _onBoard += 1;
        _onBoard = Math.max(1, Math.round(_onBoard * (typeof bossMagScale === 'function' ? bossMagScale() : 1)));
        const _deckSize = (typeof everyDeckCard === 'function') ? everyDeckCard().length : drawPile.length;
        const _inDeck = Math.max(1, Math.round(_deckSize * (preset.params.deckStoneFraction || 0.18)
                                 * (typeof bossMagScale === 'function' ? bossMagScale() : 1)));
        placeStonesOnGrid(_onBoard);
        injectStonesIntoDeck(_inDeck);
        break;
      }
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
      // r216: halve BOTH pools rather than shaving one swap. "-50% rounded down"
      // is the amount TAKEN, so an odd pool keeps the larger half: 5 -> 3, 4 -> 2.
      case 'ration_half': {
        const _ds = Math.floor(swaps * 0.5), _dd = Math.floor(discards * 0.5);
        swaps = Math.max(0, swaps - _ds);
        discards = Math.max(0, discards - _dd);
        bossSwapsDelta = -_ds;   // restored by clearBossModifiers like any other cut
        render();
        break;
      }
      case 'low_card_infusion':
        bossLowCardActive = true;
        famineStackDeck(preset.params.lowCardWeight || 0.7);
        break;
      case 'hand_lock':
        bossLockedHand = preset.params.lockedHand || null;
        break;
      case 'trick_pool_split': {
        // The Voidwright (reworked r188). It used to split your WHOLE tray in two
        // and disable half of it per phase, which scaled with how many Tricks you
        // owned - unreadable at 8 Tricks and near-invisible at 2. It now takes a
        // FIXED count per phase (2 by default): two off for the first half of the
        // round, then those two back and a different two off for the second half.
        // Owning more Tricks no longer makes the boss hit harder; it makes it
        // easier, which is the right way round for a reward.
        //
        // The split is decided ONCE, here, and never re-rolled - that is what lets
        // the briefing print both halves up front (bossTrickPoolsHTML).
        const per = Math.max(1, Math.round((preset.params.perPhase || 2) * (typeof bossMagScale === 'function' ? bossMagScale() : 1)));
        const ownedIds = (typeof trickTray !== 'undefined' && trickTrayMode ? trickTray : (acquiredTricks || [])).map(b => b.id);
        const pool = shuffle(ownedIds);
        // Fewer Tricks than two full phases: split what there is evenly rather
        // than putting everything in the first half and nothing in the second.
        const take = Math.min(per * 2, pool.length);
        const first = Math.min(per, Math.ceil(take / 2));
        trickPoolA = new Set(pool.slice(0, first));
        trickPoolB = new Set(pool.slice(first, take));
        break;
      }
      case 'periodic_null': {
        const intervalSecs = preset.params.nullIntervalSecs || 7;
        const count = preset.params.nullCount || 1;
        // THE HOLLOW, rebalanced r213: it CHURNS the board, it does not shred it.
        //
        // It used to null the cell and leave the hole - no gravity, no refill -
        // so holes accumulated until a discard happened to run the fall pass.
        // Measured live at the r211 interval of 6s with the player not acting:
        // 16 cards -> 9 cards and 7 holes by t+39s, at which point the board had
        // fragmented so badly that findBestHand could not return a single legal
        // hand. Left alone it stripped all 16 cells in 96 seconds. That is a boss
        // that can hand you an unwinnable round, and "the board shrinks" is
        // already The Quarantine's job - so this was both dangerous and a
        // duplicate.
        //
        // Going through removeAndFall means the board is always refilled: you
        // lose the CARD you were building a hand around, on a clock, and the
        // board stays playable. That is a mechanic nothing else in the roster
        // has, and it cannot strand the round.
        bossSchedule(intervalSecs, () => {
          // Never fight the player's own animation - removeAndFall takes the
          // falling lock, and starting one on top of a swap or a score cuts that
          // animation short. Skipping a tick is free; the next one is 7s away.
          if (animating || falling) return;
          const candidates = [];
          for (let r = 0; r < gridRows; r++)
            for (let c = 0; c < gridCols; c++) {
              const card = gridData[r]?.[c];
              if (card && !card._isTrick && !card._isSleight && !card._isStone && card.rank)
                candidates.push([r, c]);
            }
          const taken = [];
          for (let k = 0; k < count && candidates.length > 0; k++) {
            const idx = Math.floor(Math.random() * candidates.length);
            taken.push(candidates.splice(idx, 1)[0]);
          }
          if (!taken.length) return;
          // Back into the deck first, exactly as doDiscard does, then let the
          // shared fall pass animate them out and refill behind them.
          taken.forEach(([r, c]) => { const cd = gridData[r]?.[c]; if (cd) discardToDrawPile(cd); });
          selected = selected.filter(([r, c]) => !taken.some(([tr, tc]) => tr === r && tc === c));
          showMessage('The Hollow claims a card', 'var(--red)');
          removeAndFall(taken, 'discard');
        });
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
  // Dead since r211 - The Hollow's timer is a bossSchedule entry now, torn down by
  // clearBossEffects with the rest of the roster. Kept as a no-op guard so an older
  // save or a hand-set interval can still be cleared.
  if (bossNullInterval) { clearInterval(bossNullInterval); bossNullInterval = null; }
  if (typeof clearBossEffects === 'function') clearBossEffects();
}

// ── THE HAND OF FAMINE (r216) - it reorders the DECK, it does not forge cards ──
//
// It used to REWRITE the rank of a card as it was drawn: `{...card, rank: '3'}`.
// That worked, in the sense that low cards appeared - but it invented cards that
// were not in the deck. The RECORDS deck matrix, the "still drawable by rank"
// chart and the deck audit all describe a deck the player was not actually being
// dealt from, and a card could be drawn as a 3, played, and cycle back in as the
// King it really was.
//
// Stacking the draw pile does the same job honestly: the cards are your cards,
// the low ones are just near the top. A weighted sort (low cards get a smaller
// sort key, so they cluster at the front) rather than a hard sort, so the order
// is still unpredictable and the odd high card still comes through early.
//
// "Low" is measured by PIPS, not by a hardcoded 2-6 list, so Spectrum's 0-20
// deck works with no special case.
function famineStackDeck(weight) {
  if (!drawPile || drawPile.length < 2) return;
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return;
  const pips = c => (c && c.rank && typeof cardPips === 'function') ? cardPips(c.rank) : 99;
  const vals = drawPile.filter(c => c && c.rank && !c._isSleight && !c._isStone).map(pips).sort((a, b) => a - b);
  if (!vals.length) return;
  // The cut is the 40th percentile of what is actually in the deck.
  const lowMark = vals[Math.floor(vals.length * 0.4)];
  // bias > 1 pushes high cards back. 0.7 weight -> bias 3.3, i.e. a high card's
  // sort key averages three times a low card's, so the front of the pile is
  // mostly low without being purely low.
  const bias = 1 + Math.max(0, Math.min(0.95, weight)) * 3.3;
  withSeededRng(() => {
    drawPile = drawPile
      .map(c => ({ c, k: Math.random() * ((c && c.rank && pips(c) <= lowMark) ? 1 : bias) }))
      .sort((a, b) => a.k - b.k)
      .map(x => x.c);
  }, 'deck');
  updateDeckHud?.();
}

// Kept as the draw hook's no-op. The bias is applied to the PILE at boss start
// (famineStackDeck) rather than to each card as it is drawn, so there is nothing
// left to do here - but deck-grid.js calls it on every draw, so it must exist.
function maybeFamineDrawSwap(card) { return card; }

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

// ── THE ACT'S BOSS IS DRAWN WHEN THE ACT OPENS, AND HELD (r238) ──────────────
//
// It used to be drawn from the bag at the moment the boss TRIGGERED, which made
// every forward-looking readout a guess: peekBossPreset had to re-derive a
// likely front-runner on each paint, and bossPresetIsLive reads how many Tricks
// you own, so gaining your second Trick could legitimately change the answer
// halfway through a quarter. A loadout cannot be built against a boss that may
// not turn up.
//
// actBossId is the quarter's boss, dealt out of the bag by drawActBoss() the
// moment the quarter opens. The forecast is then a PROMISE, and nextBossPreset
// simply hands it over.
//
// Only ACT modes hold one. Survival and Flow fire bosses off a live-play
// cadence rather than at the end of a structure, so there is no "this act's
// boss" to name and they keep drawing at trigger time.
let actBossId = null;

// Deal the quarter's boss. Called from startGame (quarter 1) and from
// rolloverQuarter (quarters 2 and 3), i.e. the two places a quarter begins.
function drawActBoss() {
  if (typeof isActMode === 'function' && !isActMode()) { actBossId = null; return null; }
  const p = nextBossPreset();
  actBossId = p ? p.id : null;
  if (typeof updateActProgressUI === 'function') updateActProgressUI();
  return p;
}

// A boss whose only modifier can't bite right now is a wasted round. The
// Voidwright splits your owned Tricks in two and disables half; The Censor
// suspends one at a time. With 0 or 1 Tricks owned both are literally no-ops, so
// they are passed over until the player has something to lose.
function bossPresetIsLive(preset) {
  const owned = (typeof acquiredTricks !== 'undefined' ? acquiredTricks : []).length;
  const mods  = preset.modifiers || [];
  if ((mods.includes('trick_pool_split') || mods.includes('trick_blackout')) && owned < 2) return false;
  // The Rota rolls a single suspension. With nothing owned there is nothing to
  // suspend; with one Trick owned it is the same Trick down for the whole boss,
  // which is a harsher and less interesting boss than the one described, so it
  // wants two as well.
  if (mods.includes('trick_rotate') && owned < 2) return false;
  // The Tax Man bills credits per card and ends the round when you cannot pay.
  // Arriving broke would make it a boss you lose on the first hand regardless of
  // how well you play it, which is the one thing a boss may never be - so it
  // wants enough in the account to be a squeeze rather than a verdict.
  if (mods.includes('play_fee_credits') && (typeof coins !== 'undefined' ? coins : 0) < 15) return false;
  // The Drought pays nothing out of Natural Scaling. Before anything has been
  // earned there is nothing to take away and the boss is a plain score round.
  if (mods.includes('no_natural_scaling') && typeof nsBonus !== 'undefined'
      && !Object.keys(nsBonus || {}).some(k => nsBonus[k] && (nsBonus[k].pips || nsBonus[k].mult))) return false;
  return true;
}

// What the NEXT boss will be, WITHOUT dealing it. The run-progress block's hover
// reads this so a player can build a loadout against the boss they are heading
// for, the way Slay the Spire names its act boss from the first room.
//
// It fills the bag when empty, exactly as nextBossPreset does, so the answer is
// stable rather than "unknown until the moment it is dealt". It is still a
// forecast, not a promise IN SURVIVAL AND FLOW: `bossPresetIsLive` reads how many
// Tricks you own, so gaining your second Trick can legitimately change which boss
// is next. That is the same rule the deal uses, so the readout never lies about
// the state it was asked in. In an ACT mode the quarter's boss is already dealt
// and held (r238), and the branch at the top of the function returns it.
function peekBossPreset() {
  // r238: an act mode has already DEALT its boss (drawActBoss), so this is a
  // lookup, not a prediction, and the caveat above no longer applies there. The
  // bag fallback below is for Survival and Flow, and for a save made before
  // r238 that carries no actBossId.
  if (actBossId) {
    const held = BOSS_PRESETS.find(p => p.id === actBossId);
    if (held) return held;
  }
  if (!bossBag.length) bossBag = shuffle(BOSS_PRESETS.map(p => p.id));
  const id = bossBag.find(bid => {
    const p = BOSS_PRESETS.find(x => x.id === bid);
    return p && bossPresetIsLive(p);
  }) || bossBag[0];
  return BOSS_PRESETS.find(p => p.id === id) || null;
}

// The boss that is about to START. Hands over the quarter's held boss if there
// is one - and re-draws only if it has gone DEAD since the quarter opened,
// which is possible in exactly one direction: The Tax Man needs credits at
// trigger time and a player can spend them. Liveness otherwise only improves
// (more Tricks owned), so this is a rare branch and not the normal path.
function takeActBoss() {
  if (!actBossId) return null;
  const held = BOSS_PRESETS.find(p => p.id === actBossId);
  actBossId = null;
  return (held && bossPresetIsLive(held)) ? held : null;
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
  const preset = structuredClone(presetOverride || takeActBoss() || nextBossPreset());
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

  // ── ONE CLOCK (r205) ──────────────────────────────────────────────────────
  // A boss used to freeze `roundSeconds`, park it in savedRoundSeconds and run a
  // SECOND countdown (`bossSecondsLeft` on `bossInterval`). That was a leftover
  // from the old challenge system and it quietly switched off most of the game
  // for the length of every boss: the round tick is where clock-mark Tricks fire
  // (Tick-Tock, Second Hand, Quarter Chime, Minute Hand, Hourglass), where Tempo
  // drips resources back, where the Cuckoo, Compound, Woodpecker and Slow Burn
  // accrue - and, worst of it, swap and discard time costs were billed to the
  // FROZEN clock, so interacting was free during a boss and The Tollman, whose
  // whole gimmick is doubling those costs, did nothing on its own round.
  //
  // The boss now simply sets the round clock to its window and lets the ordinary
  // round timer run. savedRoundSeconds is still taken because the legacy
  // timer-based modes summon a boss in the MIDDLE of a live round and put the
  // player back into it afterwards (see endBoss); no other mode restores it.
  savedRoundSeconds = roundSeconds;
  roundSeconds = bossWindowDuration;
  document.getElementById('clock').classList.add('boss-mode');
  document.getElementById('clock-bar').classList.add('boss-mode');
  document.getElementById('grid').classList.add('boss-active');
  // The sigil itself is applied by updateRunProgressUI (called from
  // updateActProgressUI below) so BOTH progress blocks - landscape and portrait -
  // get it, in every mode that can run a boss.

  updateClockUI();

  // Banner. Guarded: this is cosmetic, and an unguarded lookup here used to abort
  // triggerBoss PART WAY THROUGH - bossActive already true and the modifiers
  // already applied, but no briefing, no PROCEED and no clock. A boss must never
  // fail to start because a decoration is missing.
  const banner = document.getElementById('boss-banner');
  if (banner) {
    const title = banner.querySelector('.boss-banner-title');
    if (title) title.textContent = preset.name;
    const sub = document.getElementById('boss-banner-sub');
    if (sub) sub.textContent = preset.flavor;
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 2400);
  }

  // Objective HUD
  showBossObjectiveHUD(preset);
  // Anything that switches Tricks off (Voidwright, Censor) shows as greyed tiles
  // in the tray - repaint it now so the state is on screen behind the briefing.
  if (typeof renderTrickTray === 'function') renderTrickTray();

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

// ── The Voidwright's tray, printed in the briefing (r188) ────────────────────
// The complaint this answers: a boss that switches Tricks off is invisible if you
// cannot see WHICH, and unplannable if you cannot see WHEN they come back. The
// split is fixed at boss start, so the briefing can show your whole tray sorted
// into three groups - off for the first half, off for the second half, and
// untouched - with the half you are currently in marked LIVE. Reopening the brief
// mid-round (tap the GOAL chip or the act readout) re-renders it against the
// current phase.
//
// Tiles are the shared entity tile (js/entity-tile.js), the same object you see in
// your tray and on the reward grid, so no translation is needed to find the Trick
// this is talking about.
function _bossTrickById(id) {
  const pools = [(typeof trickTray !== 'undefined' ? trickTray : []), (typeof acquiredTricks !== 'undefined' ? acquiredTricks : [])];
  for (const p of pools) { const t = p.find(x => x.id === id); if (t) return t; }
  return null;
}
function _bossTrickTilesHTML(ids) {
  if (!ids.length) return `<div class="btp-none">nothing</div>`;
  return ids.map(id => {
    const t = _bossTrickById(id);
    const rar = t && ['common','rare','epic','legendary','mythic'].includes(t.tier) ? t.tier : 'common';
    const tile = { entity: 'trick', label: t ? t.name : trickIdToName(id),
                   emoji: (t && typeof trickEmoji === 'function') ? trickEmoji(t) : '🃏' };
    return `<div class="btp-tile">${entityTileHTML(tile, rar)}</div>`;
  }).join('');
}
function bossTrickPoolsHTML() {
  const held = (typeof trickTray !== 'undefined' && trickTrayMode ? trickTray : (acquiredTricks || [])).map(t => t.id);
  const a = held.filter(id => trickPoolA.has(id));
  const b = held.filter(id => trickPoolB.has(id));
  const safe = held.filter(id => !trickPoolA.has(id) && !trickPoolB.has(id));
  const p1 = bossPhase === 1;
  const row = (cls, live, label, ids) => `
    <div class="btp-row ${cls}${live ? ' btp-live' : ''}">
      <div class="btp-lab">${label}${live ? ' <b>NOW</b>' : ''}</div>
      <div class="btp-tiles">${_bossTrickTilesHTML(ids)}</div>
    </div>`;
  return `<div class="btp">
    <div class="btp-head">Your Tricks this round</div>
    ${row('btp-off', p1,  'OFF · FIRST HALF',  a)}
    ${row('btp-off', !p1, 'OFF · SECOND HALF', b)}
    ${row('btp-safe', false, 'UNAFFECTED', safe)}
  </div>`;
}

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
    `<div id="boss-trick-pools">${(preset.modifiers || []).includes('trick_pool_split') ? bossTrickPoolsHTML() : ''}</div>` +
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
    beginCountdown();
    for (const n of ['3','2','1']) {
      numEl.textContent = n;
      numEl.style.animation = 'none'; void numEl.offsetWidth;
      numEl.style.animation = 'countdown-pop 500ms ease forwards';
      overlay.classList.add('show');
      await countdownWait(500);   // pausable - see js/interlude.js
    }
    endCountdown();
    overlay.classList.remove('show');
    await new Promise(r => setTimeout(r, 120));
  })();
}

// Kept as a thin alias: there is one clock now (r205) and updateClockUI draws it,
// reading bossWindowDuration as the bar's denominator while a boss is running.
function updateBossClockDisplay() { updateClockUI(); }

// The boss runs on the ONE round clock (r205). This starts the scheduled effects
// (armed by applyBossModifiers, held back so their opening tick lands with the
// clock rather than behind the briefing panel - see bossSchedule) and then hands
// the countdown to startRoundTimer like any other round. The boss-specific parts
// of the tick - the Metronome's variable step, the halftime phase flip, the
// switched-off-Trick repaint and running out of time - live in that one tick.
function startBossTimer() {
  if (typeof bossStartScheduledEffects === 'function') bossStartScheduledEffects();
  startRoundTimer();
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
  // The boss shares the round clock now (r205), so stop it here. Without this the
  // tick that ran the window out would keep firing at roundSeconds 0 and, with
  // bossActive already false, fall straight through onRoundEnd's boss guard into
  // the ordinary missed-goal path a second later.
  if (roundInterval) { clearInterval(roundInterval); roundInterval = null; }
  if (typeof stopFocusDecay === 'function') stopFocusDecay();
  if (typeof stopHeartbeat === 'function') stopHeartbeat();

  // Clean up modifiers (must happen BEFORE render)
  clearBossModifiers();
  clearBlockedCellDOM();
  hideBossObjectiveHUD();
  if (typeof renderTrickTray === 'function') renderTrickTray();  // un-grey anything the boss had switched off
  document.getElementById('grid').classList.remove('boss-active');
  document.getElementById('boss-preamble')?.remove();
  _bossBriefPreset = null;
  if (_bossPreambleHeld) { gameTimerPaused = false; _bossPreambleHeld = false; }
  document.getElementById('clock').classList.remove('boss-mode');
  document.getElementById('clock-bar').classList.remove('boss-mode');
  updateActProgressUI();

  // Result flash. A WIN no longer uses it: the goal-clear banner below says the same
  // thing better (it names the boss, and it is the same stamp every other cleared
  // round gets), and two captions over one board is one too many. A LOSS keeps it.
  const _beaten = success ? (currentBoss && currentBoss.name) : null;
  if (!success) {
    const resultEl = document.getElementById('boss-result');
    const resultText = document.getElementById('boss-result-text');
    resultText.className = 'boss-result-text loss';
    resultText.textContent = 'DEFEATED';
    resultEl.classList.add('show');
    setTimeout(() => resultEl.classList.remove('show'), 1500);
  }

  if (success) {
    render();
    // A cleared boss is a cleared round, and is now marked like one: the QUOTA
    // CLEARED stamp (carrying the boss's name as its kicker) and the clock locking
    // mint. js/goal-clear.js; `force` because Survival suppresses the banner for
    // its pick-of-three, which a boss win does not open.
    frozenRoundSeconds = roundSeconds;   // the payout's Efficiency line reads this
    if (typeof goalClearPresent === 'function') goalClearPresent({ kicker: _beaten, force: true });
    if (typeof recordQuarterBoss === 'function') recordQuarterBoss(_beaten);   // run report row
    if (survivalActive()) {
      // Survival: no reward grid - a bonus pick-of-three, then back to normal rounds.
      // The banked time was spent on this boss, so reset it for the next 8-clear cycle.
      // (No payout here: Survival has no payout screen at all, by design.)
      survivalBossTimeBank = 0;
      setTimeout(() => survivalPostBossReward(), 1100);
    } else if (isActMode()) {
      // Node-based: a boss round ends EXACTLY like any other cleared round - cards
      // fall, the payout counts up, and only then the grid. It used to jump straight
      // to the prize grid, and since credits are awarded inside showPayoutUI (interest
      // and leftover-time), that meant the hardest round of the act paid nothing at all.
      // The prize grid still replaces the ordinary reward grid; startInterlude's
      // `prize` option is the whole difference. nodeInAct stays at 5 so
      // closeRewardGrid's finishInterlude resets it and advances actNumber.
      gameTimerPaused = true;
      setTimeout(() => startInterlude({ prize: true }), 900);
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
let rewardGridContext = 'interlude'; // 'interlude' | 'boss' | 'survival' - determines what closeRewardGrid does
let skipTrickChoiceOverlay = false;    // set before drainLevelUpQueue when reward grid is the reward screen
let rewardGridsSeen = 0;               // how many reward grids opened this run (for first-5 guaranteed upgrades)



// ══════════════════════════════════════════════
// WHAT IS COMING (r229) - the boss, named, on the progress block
// ══════════════════════════════════════════════
// The act boss used to be a surprise you met at the last node, which makes every
// purchase before it general accumulation rather than preparation. Hovering the
// run-progress block (or long-pressing it on touch) now names the boss you are
// heading for and says what it does, so a loadout can be built against it.
//
// It reads `peekBossPreset()`, which does NOT deal from the bag. Since r238 an
// act mode has already DEALT the quarter's boss (drawActBoss), so in those modes
// this is the boss you WILL fight, not the likely one - the note below says which
// of the two you are reading. Survival and Flow still draw at trigger time and
// still get the forecast wording.
// During a live boss the brief itself is the better answer, so this stands down.
function bossPeekHTML() {
  if (typeof bossActive !== 'undefined' && bossActive) return '';
  if (typeof isActMode === 'function' && !isActMode() && !(typeof survivalActive === 'function' && survivalActive())) return '';
  const p = (typeof peekBossPreset === 'function') ? peekBossPreset() : null;
  if (!p) return '';
  return `<div class="tp-title">Next boss</div>`
       + `<div class="bp-name">${p.name || ''}</div>`
       + (p.flavor ? `<div class="bp-flavor">${p.flavor}</div>` : '')
       + (p.brief  ? `<div class="bp-brief">${p.brief}</div>`   : '')
       + `<div class="bp-note">${(typeof actBossId !== 'undefined' && actBossId && p.id === actBossId)
            ? 'Locked in for this quarter.'
            : 'Forecast. Gaining Tricks can change which boss is next.'}</div>`;
}

function showBossPeek(anchor) {
  const pop = document.getElementById('boss-peek-popup');
  if (!pop || !anchor) return;
  const html = bossPeekHTML();
  if (!html) return;
  const ar = anchor.getBoundingClientRect();
  if (ar.width < 2) return;                 // block not on screen in this orientation
  pop.innerHTML = html;
  pop.style.display = '';
  pop.classList.add('show');
  // Same placement rule as the hand log and the Time / Limits bubbles: centred on
  // the anchor, below it when there is room, flipped above when there is not,
  // clamped on screen. Placed in raw viewport px - it lives outside #cabinet.
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = ar.left + ar.width / 2 - pw / 2;
  let top  = ar.bottom + 8;
  left = Math.max(6, Math.min(window.innerWidth - pw - 6, left));
  if (top + ph > window.innerHeight - 6) top = Math.max(6, ar.top - ph - 8);
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}
function hideBossPeek() {
  const pop = document.getElementById('boss-peek-popup');
  if (pop) { pop.classList.remove('show'); pop.style.display = 'none'; }
}

// Bound to BOTH run-progress blocks - landscape has one and portrait the other,
// and updateRunProgressUI already fills every .rp-block for the same reason.
function bindBossPeek() {
  document.querySelectorAll('.rp-block').forEach(el => {
    if (el._bossPeekBound) return;
    el._bossPeekBound = true;
    el.addEventListener('mouseenter', () => showBossPeek(el));
    el.addEventListener('mouseleave', hideBossPeek);
    let t = null;
    el.addEventListener('touchstart', () => { t = setTimeout(() => showBossPeek(el), 420); }, { passive: true });
    ['touchend', 'touchcancel', 'touchmove'].forEach(ev =>
      el.addEventListener(ev, () => { clearTimeout(t); hideBossPeek(); }, { passive: true }));
  });
}
