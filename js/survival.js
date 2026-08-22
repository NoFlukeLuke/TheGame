// ══════════════════════════════════════════════
// SURVIVAL MODE (r131+)
// ══════════════════════════════════════════════
// Endless escalating-goals poker. Clearing a round's goal shows an on-brand
// PICK-OF-THREE drawn from EVERY entity pool (Tricks, Sleights, Knacks, Limits);
// there is no reward grid and no node/act structure. A shop is available on
// demand from the coins chip for 5 coins. Bosses arrive every 8 clears (stage 2).
//
// Self-contained like js/match3.js / js/dominoes-mode.js: survivalActive() gates
// everything and the hooks in the shared engine are one-liners.

function survivalActive() { return !!ACTIVE_MODE && ACTIVE_MODE.id === 'survival'; }

// ── Tunables (all easy to change) ──
const SURVIVAL_ROUND_SECONDS = 120;   // 2-minute rounds (owner request; was 3)
const SURVIVAL_LEVEL_COINS   = 3;     // flat coins per goal cleared
const SURVIVAL_COINS_PER_10S = 1;     // + this per full 10s left on the goal timer
const SURVIVAL_SHOP_COST     = 5;     // coins to open the shop on demand
const SURVIVAL_BOSS_EVERY     = 8;    // a boss appears every N clears
const SURVIVAL_BOSS_TIME_CAP  = 180;  // banked leftover time feeding the boss, capped
const SURVIVAL_BOSS_MIN_TIME  = 30;   // floor so a low bank can't hand an unwinnable boss
// Pick-3 draw weights (weighted "but not heavily" — Tricks/Sleights lead, the
// permanent Knacks/Limits show up less). Guarantee below overrides droughts.
const SURVIVAL_PICK_WEIGHTS  = { trick: 42, sleight: 30, knack: 16, limit: 12 };
// Guarantee: at least one Limit AND one Knack option every 4 levels. When a type
// has not been OFFERED for this many levels, force it into the next initial draw.
const SURVIVAL_GUARANTEE_GAP = 3;     // 0,1,2 dry → force on the 4th (gap>=3)

// Tricks that stack, so they may be offered even when already owned (mirrors pickTrickOptions).
const SURVIVAL_STACKABLE_TRICKS = ['rich_soil','fertile_ground','rowcol_triple_pips','rowcol_mult','rowcol_retrigger','rowcol_perm_double'];

// ── Per-run state ──
let survivalBossTimeBank      = 0;   // leftover seconds accumulated toward the next boss
let survivalLevelsSinceLimit  = 99;  // start high so the first few levels can front-load a Limit
let survivalLevelsSinceKnack  = 99;
let survivalPickOffered       = null; // the 3 options currently shown
let survivalRerollsUsed       = 0;    // rerolls spent this level (resets each level-up)
let survivalBossPending       = false;// next dealt round is a boss (set every 8 clears)
let survivalPickKicker        = 'GOAL CLEARED'; // header line above the pick (set per context)
const SURVIVAL_FREE_REROLLS   = 2;    // first 2 rerolls are free
const SURVIVAL_REROLL_STEP    = 5;    // then 5, 10, 15… (STEP × paid-index)

// The round clock length for the active mode. Survival runs shorter rounds; every
// other mode keeps the global ROUND_DURATION. (Used by computeRoundResources and
// the clock-bar fill so both agree.)
function currentRoundDuration() { return survivalActive() ? SURVIVAL_ROUND_SECONDS : ROUND_DURATION; }

// Cost of the NEXT reroll this level (0 while free rerolls remain).
function survivalRerollCost() {
  if (survivalRerollsUsed < SURVIVAL_FREE_REROLLS) return 0;
  const paidIndex = survivalRerollsUsed - SURVIVAL_FREE_REROLLS + 1; // 1,2,3…
  return SURVIVAL_REROLL_STEP * paidIndex; // 5,10,15…
}

// Reset per-run state at the start of a Survival game (called from startGame).
function survivalInitRun() {
  survivalBossTimeBank     = 0;
  survivalLevelsSinceLimit = 99;
  survivalLevelsSinceKnack = 99;
  survivalRerollsUsed      = 0;
  survivalPickOffered      = null;
  survivalBossPending      = false;
  bossNumber               = 0;
  document.getElementById('stage')?.classList.add('survival-mode');
  updateSurvivalShopBtn();
}

// ══════════════════════════════════════════════
// COIN / TIME / SCORE PAYOUT (called from triggerLevelUp)
// ══════════════════════════════════════════════
// leftover = seconds left on the clock when the goal was cleared. Pays coins and
// banks time toward the next boss. Score carry-over is handled inline in
// triggerLevelUp (overflow above the goal seeds the next round).
function survivalAfterLevelUp(leftover) {
  const gained = SURVIVAL_LEVEL_COINS + Math.floor(Math.max(0, leftover) / 10) * SURVIVAL_COINS_PER_10S;
  coins += gained;
  updateCoinsUI();
  survivalBossTimeBank = Math.min(SURVIVAL_BOSS_TIME_CAP, survivalBossTimeBank + Math.max(0, leftover));
  if (gained > 0) showMessage(`+${gained} 💰`, 'var(--c-yellow, #ffce2b)');
  // Every 8th clear the NEXT dealt round is a boss. `level` has already been
  // incremented (this is the level about to be dealt), so the boss lands on
  // levels 9, 17, 25… i.e. after each run of 8 cleared goals.
  if (level > 1 && (level - 1) % SURVIVAL_BOSS_EVERY === 0) survivalBossPending = true;
}

// ══════════════════════════════════════════════
// PICK-OF-THREE — option pools & draw
// ══════════════════════════════════════════════
function survivalBuildPools() {
  const ownedTrick = new Set(acquiredTricks.map(b => b.id));
  const tricks = TRICK_POOL.filter(b => !ownedTrick.has(b.id) || SURVIVAL_STACKABLE_TRICKS.includes(b.id));
  const ownedKnack = new Set(acquiredKnacks.map(k => k.id));
  const knacks = KNACK_POOL.filter(k => !ownedKnack.has(k.id));
  const grantedSl = _grantedSleightSet();
  const sleights = SLEIGHT_POOL.filter(j => !grantedSl.has(j.id));
  const lims = LIMITS_DEF.filter(d => limits[d.id].current < limits[d.id].max);
  return { trick: tricks, knack: knacks, sleight: sleights, limit: lims };
}

// Wrap a raw pool entry into a uniform option object the UI + granter understand.
function survivalMakeOption(type, data) {
  if (type === 'trick')   return { type, data, id: data.id, name: data.name, icon: (typeof trickEmoji === 'function' ? trickEmoji(data) : '🃏'), desc: data.desc, tag: (data.tier || 'common').toUpperCase() };
  if (type === 'sleight') return { type, data, id: data.id, name: data.name, icon: data.emoji || '🎴', desc: data.desc, tag: (data.rarity || 'common').toUpperCase() };
  if (type === 'knack')   return { type, data, id: data.id, name: data.name, icon: data.emoji || '🧿', desc: data.desc, tag: 'KNACK' };
  if (type === 'limit')   return { type, data, id: data.id, name: data.label, icon: data.icon || '⬆', desc: data.desc, tag: 'LIMIT' };
  return null;
}

// Pick a random unused entry of `type`; mark it used; return an option (or null).
function survivalDrawOne(type, pools, used) {
  const avail = pools[type].filter(d => !used[type].has(d.id));
  if (!avail.length) return null;
  const data = avail[Math.floor(Math.random() * avail.length)];
  used[type].add(data.id);
  return survivalMakeOption(type, data);
}

// Weighted random type among those that still have available entries.
function survivalWeightedType(pools, used) {
  const types = Object.keys(SURVIVAL_PICK_WEIGHTS).filter(t => pools[t].some(d => !used[t].has(d.id)));
  if (!types.length) return null;
  const total = types.reduce((s, t) => s + SURVIVAL_PICK_WEIGHTS[t], 0);
  let rng = Math.random() * total;
  for (const t of types) { rng -= SURVIVAL_PICK_WEIGHTS[t]; if (rng <= 0) return t; }
  return types[types.length - 1];
}

// Build the 3 options. On the initial level-up draw (isReroll=false) it honours the
// 4-level Limit/Knack guarantee and advances the drought counters; rerolls just
// redraw weighted (the guarantee was already satisfied by the initial offer).
function survivalPickOptions(isReroll) {
  const pools = survivalBuildPools();
  const used  = { trick: new Set(), knack: new Set(), sleight: new Set(), limit: new Set() };
  const chosen = [];

  if (!isReroll) {
    if (survivalLevelsSinceLimit >= SURVIVAL_GUARANTEE_GAP && pools.limit.length) { const o = survivalDrawOne('limit', pools, used); if (o) chosen.push(o); }
    if (survivalLevelsSinceKnack >= SURVIVAL_GUARANTEE_GAP && pools.knack.length) { const o = survivalDrawOne('knack', pools, used); if (o) chosen.push(o); }
  }

  let guard = 0;
  while (chosen.length < 3 && guard++ < 80) {
    const type = survivalWeightedType(pools, used);
    if (!type) break;
    const o = survivalDrawOne(type, pools, used);
    if (o) chosen.push(o);
  }

  if (!isReroll) {
    survivalLevelsSinceLimit = chosen.some(o => o.type === 'limit') ? 0 : survivalLevelsSinceLimit + 1;
    survivalLevelsSinceKnack = chosen.some(o => o.type === 'knack') ? 0 : survivalLevelsSinceKnack + 1;
  }
  // Shuffle so the guaranteed Limit/Knack aren't always in the same slots.
  return shuffle(chosen);
}

// ══════════════════════════════════════════════
// PICK UI (centred over the frozen board)
// ══════════════════════════════════════════════
function survivalPickOverlay() {
  let el = document.getElementById('survival-pick-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'survival-pick-overlay';
    el.innerHTML = `<div id="survival-pick-panel">
        <div class="sv-pick-head"><span class="sv-pick-kicker">GOAL CLEARED</span><span class="sv-pick-title">CHOOSE ONE</span></div>
        <div id="sv-pick-cards"></div>
        <button id="sv-pick-reroll" onclick="survivalReroll()"></button>
      </div>`;
    (document.getElementById('stage') || document.body).appendChild(el);
  }
  return el;
}

function survivalRenderPick() {
  const overlay = survivalPickOverlay();
  const kick = overlay.querySelector('.sv-pick-kicker');
  if (kick) kick.textContent = survivalPickKicker || 'GOAL CLEARED';
  const cards = overlay.querySelector('#sv-pick-cards');
  cards.innerHTML = '';
  (survivalPickOffered || []).forEach((opt, i) => {
    const card = document.createElement('div');
    card.className = `sv-pick-card sv-type-${opt.type}`;
    card.style.animationDelay = (i * 70) + 'ms';
    card.innerHTML = `
      <div class="sv-pick-tag">${opt.tag}</div>
      <div class="sv-pick-icon">${opt.icon}</div>
      <div class="sv-pick-name">${opt.name}</div>
      <div class="sv-pick-desc">${typeof colorizeKeywords === 'function' ? colorizeKeywords(opt.desc || '') : (opt.desc || '')}</div>
      <div class="sv-pick-kind">${opt.type}</div>`;
    card.onclick = () => survivalChoose(i);
    cards.appendChild(card);
  });
  survivalUpdateRerollBtn();
}

function survivalUpdateRerollBtn() {
  const btn = document.getElementById('sv-pick-reroll');
  if (!btn) return;
  const cost = survivalRerollCost();
  const free = survivalRerollsUsed < SURVIVAL_FREE_REROLLS;
  const freeLeft = SURVIVAL_FREE_REROLLS - survivalRerollsUsed;
  btn.textContent = free ? `🎲 Reroll — FREE (${freeLeft} left)` : `🎲 Reroll — ${cost} 💰`;
  btn.classList.toggle('sv-cant-afford', !free && coins < cost);
}

// Show the pick panel over the (already spread + frozen) board.
function showSurvivalPickScreen(kicker = 'GOAL CLEARED') {
  animating = false;
  trickSelectionPhase = false;
  survivalPickKicker = kicker;
  survivalRerollsUsed = 0;             // free rerolls refresh every level-up
  survivalPickOffered = survivalPickOptions(false);
  if (typeof sfxLevelUp === 'function') sfxLevelUp();
  survivalRenderPick();
  survivalPickOverlay().classList.add('show');
}

function survivalReroll() {
  const cost = survivalRerollCost();
  const free = survivalRerollsUsed < SURVIVAL_FREE_REROLLS;
  if (!free) {
    if (coins < cost) { showMessage('Not enough 💰', 'var(--red)'); return; }
    coins -= cost; updateCoinsUI();
  }
  survivalRerollsUsed++;
  survivalPickOffered = survivalPickOptions(true);
  if (typeof sfxShopOpen === 'function') sfxShopOpen();
  survivalRenderPick();
}

// Grant the chosen option, hide the panel, and deal the next round.
function survivalChoose(i) {
  const opt = (survivalPickOffered || [])[i];
  if (!opt) return;
  survivalGrant(opt);
  survivalPickOffered = null;
  survivalPickOverlay().classList.remove('show');
  survivalDealNext();
}

// Route each option type to the existing grant primitive.
function survivalGrant(opt) {
  switch (opt.type) {
    case 'trick':   injectTrickAfterReward(opt.data); break;
    case 'sleight': grantSleight(opt.data); showMessage(`${opt.icon} ${opt.name}!`, '#c07aee'); break;
    case 'knack':   acquiredKnacks.push({ ...opt.data }); updateKnackList?.(); showMessage(`${opt.icon} ${opt.name}!`, '#d4a017'); break;
    case 'limit':   incrementLimit(opt.data.id); showMessage(`${opt.icon} ${opt.name} upgraded!`, '#5ad4c0'); break;
  }
}

// ══════════════════════════════════════════════
// BOARD ANIMATION — spread/freeze on goal, deal on pick
// ══════════════════════════════════════════════
// Goal reached: nudge every card outward from the board centre (~20%) and freeze
// it there (fill:forwards) so the pick panel reads as opening "inside" the board.
function survivalSpreadFreeze() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  const els = [...gridEl.querySelectorAll('[data-card-id]')];
  if (!els.length) return;
  const gr = gridEl.getBoundingClientRect();
  const cx = gr.left + gr.width / 2, cy = gr.top + gr.height / 2;
  els.forEach(el => {
    const r = el.getBoundingClientRect();
    const dx = (r.left + r.width / 2) - cx, dy = (r.top + r.height / 2) - cy;
    el.style.zIndex = '5';
    el.animate([
      { transform: 'translate(0,0)' },
      { transform: `translate(${dx * 0.2}px, ${dy * 0.2}px)` }
    ], { duration: 340, easing: 'cubic-bezier(.25,.7,.35,1)', fill: 'forwards' });
  });
}

// Move current board cards back into the deck so a fresh deal can't deplete it.
function survivalRecycleBoard() {
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const card = gridData[r]?.[c];
      if (!card) continue;
      if (card._isSleight || card._isStone) playedPile.push(card);      // preserve identity/charges
      else if (card.rank) playedPile.push({ rank: card.rank, suit: card.suit });
      gridData[r][c] = null;
    }
  flushPlayedDeck(); // reshuffle everything back into the draw pile
}

// After a pick: old cards fall out while the new board falls in (concurrent).
function survivalDealNext() {
  const gridEl = document.getElementById('grid');
  // 1) Old frozen cards fall out (down + fade).
  const oldEls = [...(gridEl?.querySelectorAll('[data-card-id]') || [])];
  oldEls.forEach((el, i) => {
    el.style.zIndex = '4';
    el.animate([
      { transform: el.style.transform || 'translate(0,0)', opacity: 1 },
      { transform: 'translateY(220px)', opacity: 0 }
    ], { duration: 380, delay: (i % 6) * 20, easing: 'cubic-bezier(.4,0,.9,.5)', fill: 'forwards' });
  });
  // 2) Recycle + deal a fresh board into gridData (kept hidden until the drop anim).
  survivalRecycleBoard();
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++)
      gridData[r][c] = drawCard() || null;
  // 3) New cards drop in slightly after the old ones start leaving — reuse the
  //    shared deal-in animation, which clears leftover real cards and repaints.
  dealPhase = true;
  setTimeout(() => {
    startNewRoundDealAnims();          // builds temp cards from gridData, drops them, clears dealPhase
    updateClockUI();
    if (survivalBossPending) {
      // This dealt board is a BOSS round — trigger it once the cards settle
      // instead of starting a normal goal timer.
      survivalBossPending = false;
      setTimeout(() => survivalTriggerBoss(), 950);
    } else {
      startRoundTimer();               // 120s round (roundSeconds set by computeRoundResources)
    }
  }, 90);
}

// ══════════════════════════════════════════════
// BOSS ROUND (every 8 clears) — uses the banked leftover time as its clock
// ══════════════════════════════════════════════
function survivalTriggerBoss() {
  const t = Math.max(SURVIVAL_BOSS_MIN_TIME, Math.min(SURVIVAL_BOSS_TIME_CAP, Math.round(survivalBossTimeBank)));
  triggerBoss(null, t);  // boss objective is checked in playHand (survival plays real hands)
}

// Boss defeated: a bonus pick-of-three over the board, then back to normal rounds.
// (endBoss already cleared modifiers/blocked cells and zeroed the time bank.)
function survivalPostBossReward() {
  survivalSpreadFreeze();
  setTimeout(() => { dealPhase = true; showSurvivalPickScreen('BOSS DEFEATED'); }, 320);
}

// ══════════════════════════════════════════════
// GOAL HAND HAND-OFF (called from playPreviewDance's isGoalHand branch)
// ══════════════════════════════════════════════
// Skip the normal explode/fly-to-preview finale. Just clean up the (unused)
// preview stage, spread+freeze the board, then run the level-up machinery which
// pays out and opens the pick panel.
function survivalGoalHandoff(stage) {
  try { if (stage) { stage.classList.remove('dnc-active'); stage.innerHTML = ''; } } catch (e) {}
  if (typeof dncCleanupReal === 'function') dncCleanupReal();
  if (typeof dncRestoreHiddenGridEls === 'function') dncRestoreHiddenGridEls();
  updateScoreUI();
  survivalSpreadFreeze();
  // Let the spread read for a beat, then reset state + show the pick.
  setTimeout(() => triggerLevelUp(), 360);
}

// ══════════════════════════════════════════════
// ON-DEMAND SHOP (button by the coins chip)
// ══════════════════════════════════════════════
function survivalOpenShop() {
  if (!survivalActive()) return;
  if (document.getElementById('shop-overlay').classList.contains('show')) return;
  if (isPaused || interludeActive || bossActive) return;
  if (survivalPickOverlay().classList.contains('show')) return; // not during a pick
  if (coins < SURVIVAL_SHOP_COST) { showMessage(`Shop costs ${SURVIVAL_SHOP_COST} 💰`, 'var(--red)'); return; }
  coins -= SURVIVAL_SHOP_COST;
  updateCoinsUI();
  triggerShop(); // pauses the round clock; the shop-close handler resumes it (else-branch)
}

// Show the shop button (and its live cost/affordability) only in Survival.
// Visibility is a class toggle (not inline display) so the CSS default stays hidden.
function updateSurvivalShopBtn() {
  const on = survivalActive();
  document.querySelectorAll('.survival-shop-btn').forEach(btn => {
    btn.classList.toggle('sv-on', on);
    if (on) btn.classList.toggle('sv-cant-afford', coins < SURVIVAL_SHOP_COST);
  });
}
