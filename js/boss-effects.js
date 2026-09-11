// ══════════════════════════════════════════════
// BOSS EFFECTS - the r150 roster  (js/data/bosses.js holds the presets)
// ══════════════════════════════════════════════
// Every boss in this roster works the same shape: it does its thing ONCE at
// round start, then again on a fixed interval. `bossSchedule()` is that shape -
// it ARMS the effect, bossStartScheduledEffects() (called when the boss clock
// starts, after the briefing) fires the opening tick and starts the repeat - and
// it is the single place the Contingency Plan knack stretches intervals, so a new
// boss gets the knack interaction for free.
//
// Two kinds of "blocked" cell now exist, and the difference matters:
//   · blockedCells (older, boss.js) - the cell is VOID. Its card is returned to
//     the deck and nothing falls into it.
//   · nullCells (here)              - the cell is QUARANTINED. Cards still fall
//     in and still fill the slot; they are simply inert. Not a null card, a null
//     cell. isCellBlocked() covers both, so selection/tap/swipe blocking comes
//     for free; the refill logic in card-fall.js deliberately consults
//     isCellVoid() instead so quarantined cells keep receiving cards.

// ── State (reset by clearBossEffects) ────────────────────────────────────────
let bossTickIds        = [];         // setInterval handles for the scheduled effects
let bossTimeouts       = [];         // pending setTimeouts (quarantine warnings)
let nullCells          = new Set();  // "r-c" - inert cells; cards still land here
let pendingNullCells   = new Set();  // "r-c" - marked with an X, about to go inert
let dampCells          = new Set();  // "r-c" - half pips, and tricks may not fire
let bossNullRank       = null;       // rank currently recalled out of play
let bossUsedRanks      = new Set();  // ranks already recalled - never picked twice
let bossDisabledTricks = new Map();  // trickId → expiry timestamp (ms)
let bossTimeFromFocus  = false;      // the boss clock runs at the Focus multiplier
let _bossTimeDebt      = 0;          // fractional carry so ×1.4 ticks smoothly
let bossInteractMultV  = 1;          // interact-cost multiplier (The Tollman)
let bossPlayCostAdded  = 0;          // seconds this boss added to the play cost
let bossGoalRatchet    = 0;          // fraction the objective grows per interact (The Ratchet)
let bossInteractFee    = 0;          // credits charged per interact (The Turnstile)
let bossRedactedHand   = null;       // hand type marked down this round (The Redaction)
let bossRedactedMult   = 1;          // what it is multiplied by
let bossMarkEveryN     = 0;          // The Marker: 1 card in N is silently marked (0 = off)
let bossMarkCounter    = 0;          // cards seen since the last mark

// ── The Contingency Plan knack ───────────────────────────────────────────────
// "Boss effects are 10% weaker." Two readings, both applied:
//   magnitudes shrink by 10%  ·  timed effects tick 10% LESS OFTEN.
// A −1 ration cut can't be 10% smaller, so for those the interval stretch is the
// whole benefit - which is why every timed effect goes through bossSchedule.
function bossDampened() { return typeof hasKnack === 'function' && hasKnack('contingency'); }
function bossMagScale()      { return bossDampened() ? 0.9 : 1; }
function bossIntervalScale() { return bossDampened() ? 1 / 0.9 : 1; }

// Scheduled effects are ARMED at boss start but do not fire until the clock does
// (r179). applyBossModifiers runs inside triggerBoss, which is BEFORE the briefing
// panel and its PROCEED button - so the opening tick used to land while the player
// was still reading what the boss does, and every interval tick after it was
// silently dropped (`run` returns early on gameTimerPaused) for as long as the
// briefing sat open. Both read as "the boss did nothing". bossStartScheduledEffects()
// is called from startBossTimer, the one place the boss clock actually starts.
let bossPendingSchedules = [];

function bossSchedule(everySecs, fn) {
  bossPendingSchedules.push({ everySecs, fn });
}
function bossStartScheduledEffects() {
  const pending = bossPendingSchedules;
  bossPendingSchedules = [];
  pending.forEach(({ everySecs, fn }) => {
    const run = () => { if (!bossActive || gameTimerPaused || roundEnded) return; try { fn(); } catch (e) { console.error('[BOSS] effect failed', e); } };
    try { fn(); } catch (e) { console.error('[BOSS] opening effect failed', e); }   // fires as the clock starts
    bossTickIds.push(setInterval(run, Math.round(everySecs * 1000 * bossIntervalScale())));
  });
}
function bossDelay(ms, fn) { bossTimeouts.push(setTimeout(fn, ms)); }

// ── Cell classification ──────────────────────────────────────────────────────
// VOID = no card at all (the old boss patterns). QUARANTINED = card present but
// inert. card-fall.js asks isCellVoid so it keeps filling quarantined cells.
function isCellVoid(r, c) {
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return false;
  return blockedCells.has(`${r}-${c}`);
}
function isCellNulled(r, c) {
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return false;
  return nullCells.has(`${r}-${c}`);
}
function isCellDamped(r, c) {
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return false;
  return dampCells.has(`${r}-${c}`);
}
// A recalled rank is off the board until the next rank is picked.
function isCardRecalled(card) {
  if (!bossNullRank || !card || !card.rank) return false;
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return false;
  return card.rank === bossNullRank;
}
// Cards in a quarantined cell must not count toward "while on the grid" triggers
// (Power Cell's Focus cap, Slow Burn's accrual, hasSleightOnGrid…). Anything that
// scans the grid for live entities should filter through this.
function cellCountsForTriggers(r, c) { return !isCellNulled(r, c) && !isCellVoid(r, c); }

// ── Focus drain (The Undertow) ───────────────────────────────────────────────
// addFocus() deliberately ignores negatives, so draining needs its own path.
function drainFocus(n) {
  const before = focusNodes;
  focusNodes = Math.max(0, focusNodes - Math.round(n));
  if (focusNodes === before) return 0;
  syncFocusMeterState();
  updateFocusMultReadout(false);
  return before - focusNodes;
}

// ── Interact-cost surcharge (The Tollman) ────────────────────────────────────
// Read at both charge sites so the multiplier lands on the real total.
function bossInteractMult() {
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return 1;
  if (bossInteractMultV === 1) return 1;
  // 10% weaker → a ×2 surcharge becomes ×1.9, not ×1.8: the knack shaves the
  // SURCHARGE, not the base cost the player would have paid anyway.
  return 1 + (bossInteractMultV - 1) * bossMagScale();
}

// ── Per-interact effects (The Ratchet, The Turnstile) ────────────────────────
// Called from doSwap and doDiscard for every board interaction.
function bossOnInteract(kind) {
  if (!bossActive) return;
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return;

  // The Ratchet: the bar moves every time you touch the board. Since r155 the boss
  // win bar IS roundGoal (bosses no longer carry their own score target), so this
  // raises roundGoal - the one number checkBossObjective now compares against.
  if (bossGoalRatchet) {
    const rate = bossGoalRatchet * bossMagScale();
    const before = roundGoal;
    roundGoal = Math.round(roundGoal * (1 + rate));
    showMessage(`Objective ${before.toLocaleString()} → ${roundGoal.toLocaleString()}`, 'var(--red)');
    if (typeof updateBossObjectiveUI === 'function') updateBossObjectiveUI();
    if (typeof updateScoreUI === 'function') updateScoreUI();
  }

  // The Turnstile: a flat fee per interaction, floored at zero (no debt).
  if (bossInteractFee) {
    const fee = Math.max(1, Math.round(bossInteractFee * bossMagScale()));
    const paid = Math.min(coins, fee);
    if (paid > 0) { coins -= paid; updateCoinsUI(); showMessage(`−${paid} credits`, 'var(--red)'); }
    else showMessage('No credits to seize', 'var(--cream-dim)');
  }
}

// ── The Redaction: one hand type is marked down for the round ────────────────
// Picked ONCE at boss start and never re-rolled, so the player can plan around it.
function bossRedactedHandMult(handName) {
  if (!bossActive || !bossRedactedHand || handName !== bossRedactedHand) return 1;
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return 1;
  // 10% weaker → the penalty shrinks toward 1, not the score toward 0.
  return 1 - (1 - bossRedactedMult) * bossMagScale();
}

// ── Keeping the tray's grey state honest (r188) ──────────────────────────────
// Two bosses switch Tricks off and neither one has an event for switching them
// back ON: the Voidwright's halves flip on a clock tick, and the Censor's 45s
// suspensions simply expire (bossTrickBlackedOut deletes them lazily, when read).
// So the boss clock calls this every second. It compares the set of switched-off
// ids against the last one and only repaints when it actually changed - a blind
// re-render every second would restart the tray's marquee/fan on every tick.
let _bossTrickOffSig = '';
function bossSyncTrickTrayState() {
  const held = ((typeof trickTrayMode !== 'undefined' && trickTrayMode) ? trickTray : acquiredTricks) || [];
  const sig = held.filter(t => typeof isTrickDisabledByBoss === 'function' && isTrickDisabledByBoss(t.id))
                  .map(t => t.id).sort().join(',');
  if (sig === _bossTrickOffSig) return;
  _bossTrickOffSig = sig;
  if (typeof renderTrickTray === 'function') renderTrickTray();
}

// ── Trick blackout (The Censor) ──────────────────────────────────────────────
function bossTrickBlackedOut(trickId) {
  if (!bossDisabledTricks.size) return false;
  const until = bossDisabledTricks.get(trickId);
  if (!until) return false;
  if (Date.now() >= until) { bossDisabledTricks.delete(trickId); return false; }
  return true;
}

// ── The effects themselves ───────────────────────────────────────────────────
function bossQuarantineTick() {
  // Pick a cell that is not already inert or spoken for, flag it, and take it out
  // of play 10 seconds later. The warning window is the whole point - the player
  // gets time to spend what is standing there.
  const free = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const k = `${r}-${c}`;
    if (!nullCells.has(k) && !pendingNullCells.has(k) && !blockedCells.has(k)) free.push(k);
  }
  if (!free.length) return;
  const key = free[Math.floor(Math.random() * free.length)];
  pendingNullCells.add(key);
  render();
  bossDelay(Math.round(10000 * bossIntervalScale()), () => {
    pendingNullCells.delete(key);
    if (!bossActive) return;
    nullCells.add(key);
    const [r, c] = key.split('-').map(Number);
    selected = selected.filter(([sr, sc]) => !(sr === r && sc === c));
    if (swapPending && swapPending[0] === r && swapPending[1] === c) swapPending = null;
    showMessage('A cell goes dark', 'var(--red)');
    render();
  });
}

function bossBlightTick(count) {
  const free = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const k = `${r}-${c}`;
    if (!dampCells.has(k) && !nullCells.has(k) && !blockedCells.has(k)) free.push(k);
  }
  for (let i = 0; i < count && free.length; i++) {
    dampCells.add(free.splice(Math.floor(Math.random() * free.length), 1)[0]);
  }
  showMessage('Cells contaminated', 'var(--red)');
  render();
}

function bossCensorTick(holdSecs) {
  const owned = (typeof acquiredTricks !== 'undefined' ? acquiredTricks : []).map(t => t.id);
  const free = owned.filter(id => !bossTrickBlackedOut(id));
  if (!free.length) return;
  const id = free[Math.floor(Math.random() * free.length)];
  bossDisabledTricks.set(id, Date.now() + holdSecs * 1000 * bossIntervalScale());
  showMessage(`${trickIdToName(id)} suspended`, 'var(--red)');
  renderTrickTray?.();
}

function bossRecallTick() {
  // Restore the previous rank, then take a NEW one - never one already used, so
  // the boss works through the deck rather than hammering the same rank.
  const pool = ACTIVE_RANKS.filter(r => !bossUsedRanks.has(r));
  if (!pool.length) return;                        // every rank has had its turn
  const pick = pool[Math.floor(Math.random() * pool.length)];
  bossUsedRanks.add(pick);
  bossNullRank = pick;
  selected = selected.filter(([r, c]) => !isCardRecalled(gridData[r]?.[c]));
  showMessage(`${pick}s recalled`, 'var(--red)');
  render();
}

function bossRationTick() {
  // Alternate-ish: cut whichever pool still has something in it.
  const canDiscard = discards > 0, canSwap = swaps > 0;
  if (!canDiscard && !canSwap) return;
  const cutDiscard = canDiscard && (!canSwap || Math.random() < 0.5);
  if (cutDiscard) { discards = Math.max(0, discards - 1); showMessage('−1 discard', 'var(--red)'); }
  else            { swaps    = Math.max(0, swaps - 1);    showMessage('−1 swap', 'var(--red)'); }
  render();
}

// ── THE MARKER (r197) ────────────────────────────────────────────────────────
// One card in every ten is silently marked. Nothing on the card, in the tray or in
// Records says so - that is the whole boss. Play a marked card and it is discarded
// instead of scored, taking every other marked card in the same hand with it, and
// the hand does not score.
//
// The mark rides `card._discardCursed`, a plain flag on the card object. It is
// deliberately NOT in DURABLE_CARD_FIELDS: a card discarded back into the deck is
// rebuilt from that list, so a marked card that leaves play comes back clean and
// takes a fresh 1-in-10 roll next time it is drawn. That is the behaviour we want,
// and it means nothing has to un-mark the piles.
//
// The counter is exact rather than a 10% dice roll - "one in every ten" should not
// clump three into one hand and then none for a minute.
function bossMarkerConsider(card) {
  if (!bossMarkEveryN || !card) return card;
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return card;
  if (card._isSleight || card._isStone || card._isTrick || !card.rank) return card;
  if (++bossMarkCounter >= bossMarkEveryN) { bossMarkCounter = 0; card._discardCursed = true; }
  return card;
}
// The board for a boss round is dealt BEFORE triggerBoss runs, so the cards already
// on it never passed through drawCard while the boss was live. Feed them through the
// same counter at boss start or the first tenth of the round is free.
function bossMarkerSeedBoard() {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) bossMarkerConsider(gridData[r]?.[c]);
}
function bossMarkerClearAll() {
  bossMarkEveryN = 0; bossMarkCounter = 0;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r]?.[c]; if (card) delete card._discardCursed;
  }
  [drawPile, playedPile].forEach(pile => (pile || []).forEach(card => { if (card) delete card._discardCursed; }));
}

// Called from playHand before anything is scored or mutated. Returns true if the
// hand was eaten, in which case playHand must return without scoring it.
function bossMarkerIntercept(cells) {
  if (!bossMarkEveryN || !bossActive || !Array.isArray(cells)) return false;
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return false;
  const marked = cells.filter(([r, c]) => gridData[r]?.[c]?._discardCursed);
  if (!marked.length) return false;

  animating = true;                       // hold input for the length of the fizzle
  cancelAutoSubmit?.();
  sfxCardDiscard(true);                   // the forced discard is the loud one
  showMessage(marked.length > 1 ? `${marked.length} marked cards - discarded` : 'Marked card - discarded', 'var(--red)');
  bossMarkerFizzleFX(cells, marked).then(() => {
    marked.forEach(([r, c]) => { const card = gridData[r]?.[c]; if (card) discardToDrawPile(card); });
    selected = [];
    swapPending = null;
    animating = false;
    removeAndFall(marked, 'discard');     // slides them out and gravity-refills
  });
  return true;
}

// The cards fall out of the hand preview: the whole submitted hand is drawn into
// #selected-cards exactly as the scoring dance draws it (renderCardAppearance, same
// .dnc-* skeleton, so the sizing and the portrait overlap rules apply for free), the
// marked ones drop out of the bottom and the rest fade.
function bossMarkerFizzleFX(cells, marked) {
  const stage = document.getElementById('selected-cards');
  if (!stage) return Promise.resolve();
  const markedKeys = new Set(marked.map(([r, c]) => `${r}-${c}`));
  stage.classList.add('dnc-active'); stage.innerHTML = '';
  const row = document.createElement('div'); row.className = 'dnc-row hand';
  const lab = document.createElement('div'); lab.className = 'dnc-lab'; lab.textContent = 'Hand';
  const items = document.createElement('div'); items.className = 'dnc-items';
  const track = document.createElement('div'); track.className = 'dnc-track';
  items.appendChild(track); row.appendChild(lab); row.appendChild(items); stage.appendChild(row);
  const outers = cells.map(([r, c]) => {
    const card = gridData[r]?.[c];
    const outer = document.createElement('div'); outer.className = 'dnc-outer';
    if (card) {
      const d = document.createElement('div');
      const { className, innerHTML } = renderCardAppearance(card, r, c);
      d.className = className + ' preview-card'; d.innerHTML = innerHTML;
      outer.appendChild(d);
    }
    track.appendChild(outer);
    return { outer, marked: markedKeys.has(`${r}-${c}`) };
  });
  if (typeof fitPortraitPreviewCards === 'function') fitPortraitPreviewCards();
  return new Promise(resolve => {
    setTimeout(() => {
      outers.forEach(({ outer, marked: isMarked }, i) => {
        if (isMarked) {
          outer.animate([
            { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            { transform: 'translateY(10px) rotate(-4deg)', opacity: 1, offset: 0.18 },
            { transform: 'translateY(150px) rotate(26deg)', opacity: 0 }
          ], { duration: 620, delay: i * 60, easing: 'cubic-bezier(0.45,0,0.9,0.55)', fill: 'forwards' });
        } else {
          outer.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 400, fill: 'forwards' });
        }
      });
      setTimeout(() => {
        stage.classList.remove('dnc-active'); stage.innerHTML = '';
        resolve();
      }, 620 + outers.length * 60 + 120);
    }, 260);   // a beat with the hand on screen first, so the drop reads as a reaction
  });
}

// ── Wiring: called from applyBossModifiers for the new modifier ids ──────────
function applyBossEffectModifier(mod, params) {
  switch (mod) {
    case 'time_scales_with_focus':
      bossTimeFromFocus = true; _bossTimeDebt = 0;
      return true;
    case 'interact_surcharge':
      bossInteractMultV = params.costMult || 2;
      bossPlayCostAdded = Math.round((params.playCostAdd || 3) * bossMagScale());
      playHandCostThisRound = (playHandCostThisRound || 0) + bossPlayCostAdded;
      return true;
    case 'focus_drain':
      bossSchedule(params.everySecs || 15, () => {
        const lost = drainFocus((params.amount || 10) * bossMagScale());
        if (lost) showMessage(`−${lost} Focus`, '#ff7bb0');
      });
      return true;
    case 'cell_quarantine':
      bossSchedule(params.everySecs || 15, bossQuarantineTick);
      return true;
    case 'trick_blackout':
      bossSchedule(params.everySecs || 35, () => bossCensorTick(params.holdSecs || 45));
      return true;
    case 'cell_blight':
      bossSchedule(params.everySecs || 20, () => bossBlightTick(Math.max(1, Math.round((params.count || 3) * bossMagScale()))));
      return true;
    case 'rank_recall':
      bossSchedule(params.everySecs || 45, bossRecallTick);
      return true;
    case 'ration_cut':
      bossSchedule(params.everySecs || 30, bossRationTick);
      return true;
    case 'goal_ratchet':
      bossGoalRatchet = params.rate || 0.05;
      return true;
    case 'interact_fee':
      bossInteractFee = params.fee || 3;
      return true;
    case 'discard_curse':
      bossMarkEveryN = Math.max(2, Math.round((params.everyNthCard || 10) / bossMagScale()));
      bossMarkCounter = 0;
      bossMarkerSeedBoard();
      return true;
    case 'redact_hand': {
      // Only hand types the player can actually make are worth marking down -
      // redacting Straight Flush on a 4×4 board would be a free round.
      const pool = (typeof achievableHandTypes === 'function' ? achievableHandTypes() : null)
                || Object.keys(HAND_BASE);
      const usable = pool.filter(h => HAND_BASE[h]);
      bossRedactedHand = usable.length ? usable[Math.floor(Math.random() * usable.length)] : null;
      bossRedactedMult = params.mult || 0.4;
      if (bossRedactedHand) showMessage(`${bossRedactedHand} redacted`, 'var(--red)');
      return true;
    }
  }
  return false;   // not ours - boss.js handles the legacy modifiers
}

function clearBossEffects() {
  bossPendingSchedules = [];
  _bossTrickOffSig = '';
  bossTickIds.forEach(clearInterval); bossTickIds = [];
  bossTimeouts.forEach(clearTimeout);  bossTimeouts = [];
  nullCells = new Set(); pendingNullCells = new Set(); dampCells = new Set();
  bossNullRank = null; bossUsedRanks = new Set();
  bossDisabledTricks = new Map();
  bossTimeFromFocus = false; _bossTimeDebt = 0;
  if (bossPlayCostAdded) { playHandCostThisRound = Math.max(0, (playHandCostThisRound || 0) - bossPlayCostAdded); bossPlayCostAdded = 0; }
  bossInteractMultV = 1;
  bossGoalRatchet = 0; bossInteractFee = 0;
  bossRedactedHand = null; bossRedactedMult = 1;
  bossMarkerClearAll();
}

// How many whole seconds the boss clock should consume this tick. Normally 1;
// under The Metronome it runs at the live Focus multiplier, with a fractional
// carry so ×1.4 doesn't round away to ×1.
function bossClockStep() {
  if (!bossTimeFromFocus) return 1;
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return 1;
  const raw = (typeof focusMultiplier === 'function') ? focusMultiplier() : 1;
  const eff = 1 + Math.max(0, raw - 1) * bossMagScale();
  _bossTimeDebt += eff;
  const whole = Math.floor(_bossTimeDebt);
  _bossTimeDebt -= whole;
  return Math.max(0, whole);
}

// ── Render overlays ──────────────────────────────────────────────────────────
// Drawn as absolutely-positioned siblings of the cards, the same way
// renderBlockedCells does, so nothing about the card elements has to change.
function renderBossCellOverlays() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  gridEl.querySelectorAll('.null-cell,.null-warn,.damp-cell').forEach(el => el.remove());
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return;
  const place = (key, cls) => {
    const [r, c] = key.split('-').map(Number);
    const d = document.createElement('div');
    d.className = cls;
    d.style.left = cellLeft(c) + 'px';
    d.style.top  = cellTop(r) + 'px';
    gridEl.appendChild(d);
  };
  dampCells.forEach(k => place(k, 'damp-cell'));
  pendingNullCells.forEach(k => place(k, 'null-warn'));
  nullCells.forEach(k => place(k, 'null-cell'));
}
