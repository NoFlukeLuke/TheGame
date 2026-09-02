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
