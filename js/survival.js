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

// True for BOTH survival flavours. Flow (js/flow-mode.js) is Survival with the round
// clock removed, and it reuses this whole file - the pick-of-three, the reward grants,
// the on-demand Mart, the boss reward and the 5-boss completion screen. Anything that
// must differ asks flowActive() specifically.
// Flag-based, not an id list (r234). A mode synthesized by the dev picker opts
// into this whole package - the pick-of-three loop, the endless structure, the
// score carry-over, the entity bans - by carrying `survival: true`, exactly as
// Survival and Flow now do. An id list could never see it.
function survivalActive() { return !!ACTIVE_MODE && ACTIVE_MODE.survival === true; }

// ── Tunables (all easy to change) ──
const SURVIVAL_ROUND_SECONDS = 120;   // 2-minute rounds (owner request; was 3)
const SURVIVAL_BASE_GOAL     = 900;   // first goal (lower than Classic's 1200; both rose 20% with the r178 hand retune)
const SURVIVAL_GOAL_ROUND_TO = 50;    // goal rounding step (500 would snap 750 → 1000)
// Endless (post-run) scaling: the per-level GROWTH accelerates 65%, i.e. Classic's
// +35%/level becomes +57.75%/level. Applied only after the 5-boss run is continued.
const SURVIVAL_ENDLESS_ACCEL = 1.65;
const SURVIVAL_LEVEL_COINS   = 3;     // flat coins per goal cleared
const SURVIVAL_COINS_PER_10S = 1;     // + this per EFFICIENCY_SECONDS_PER_COIN left on the goal timer
                                      // (the constant is shared with the payout's Efficiency line - js/data/cards.js)
const SURVIVAL_SHOP_COST     = 5;     // coins to open the shop from the pick screen
const SURVIVAL_BOSS_EVERY_SECONDS = 300; // a boss arrives every 5 minutes of play
const SURVIVAL_BOSS_COUNT     = 5;    // run "completes" after this many bosses beaten
const SURVIVAL_BOSS_TIME_CAP  = 180;  // banked leftover time feeding the boss, capped
const SURVIVAL_BOSS_MIN_TIME  = 30;   // floor so a low bank can't hand an unwinnable boss
// Rerolls are a CARRY-OVER POOL (owner spec): 3 at run start, +2 per boss beaten.
// They do NOT refresh each level; unspent ones roll forward to the next reward.
const SURVIVAL_REROLLS_START  = 3;
const SURVIVAL_REROLLS_PER_BOSS = 2;
// Entities that only do something in the reward grid - survival has no reward grid,
// so they are filtered out of every pool while it is the active mode.
const SURVIVAL_BANNED_ENTITIES = new Set(['greedy_boi', 'more_better', 'rain_check']);
// Pick-3 draw weights (weighted "but not heavily" - Tricks/Sleights lead, the
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
let survivalBonusPick         = false;// true while showing the post-boss BONUS pick (no goal cleared)
let survivalSkipCarryover     = false;// triggerLevelUp flag: boss-reward round doesn't carry score / pay time-coins
let survivalRerollsLeft       = SURVIVAL_REROLLS_START; // carry-over pool (never refreshed per level)
let survivalBossesBeaten      = 0;    // bosses defeated this run
let survivalSecondsToBoss     = SURVIVAL_BOSS_EVERY_SECONDS; // live countdown to the next boss
let survivalEndless           = false;// true after the player continues past the 5-boss run
const SURVIVAL_REROLL_STEP    = 5;    // then 5, 10, 15… (STEP × paid-index)

// The round clock length for the active mode. Survival runs shorter rounds; every
// other mode keeps the global ROUND_DURATION. (Used by computeRoundResources and
// the clock-bar fill so both agree.)
// Flow's clock is the 5-minute SESSION clock counting down to the inspection, not a
// round clock - but it is the same variable, so the bar fill and computeRoundResources
// must size against it too.
function currentRoundDuration() {
  // A boss round's length is its window (r205 - the boss runs on this same clock).
  // Survival banks leftover time into it and Flow uses a flat one, so it is not
  // simply the mode's round length, and the clock bar needs the real denominator.
  if (bossActive) return bossWindowDuration;
  if (typeof flowActive === 'function' && flowActive()) return FLOW_SESSION_SECONDS;
  // A picker-built mode names its own round length, and it is checked BEFORE the
  // survival fallback: a custom pick-of-three run still gets the clock it asked
  // for rather than Survival's 2:00 by virtue of sharing its loop.
  if (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.clock) return pickerRoundSeconds();
  return survivalActive() ? SURVIVAL_ROUND_SECONDS : ROUND_DURATION;
}

// Survival's goal curve: same growth rate as Classic from a lower start, and
// rounded to 50 (Classic rounds to 500, which would snap the 750 opener to 1000).
// In endless mode the per-level growth accelerates (see SURVIVAL_ENDLESS_ACCEL);
// levels before the switch keep the normal curve so the jump isn't retroactive.
// The four numbers below come from goalTune() (js/goal-tuning.js), which falls
// back to the constants above unless the dev panel's Goals group has moved them.
function survivalGoalForLevel(lv) {
  const step  = Math.max(1, goalTune('survivalRoundTo'));
  const scale = 1 + goalTune('survivalGrowth') / 100;
  const base  = Math.pow(scale, Math.min(lv, survivalEndlessFromLevel) - 1);
  let g = goalTune('survivalBase') * goalTune('globalMult') * base;
  if (survivalEndless && lv > survivalEndlessFromLevel) {
    const fast = 1 + (scale - 1) * goalTune('endlessAccel');
    g *= Math.pow(fast, lv - survivalEndlessFromLevel);
  }
  return Math.max(step, Math.round(g / step) * step);
}
let survivalEndlessFromLevel = Infinity; // level at which endless acceleration begins

// Cost of the NEXT reroll. Free while the carry-over pool has any left; after that
// the usual escalating price within this pick (5, 10, 15…).
function survivalRerollCost() {
  if (survivalRerollsLeft > 0) return 0;
  return SURVIVAL_REROLL_STEP * (survivalRerollsUsed + 1); // 5,10,15…
}

// Reset per-run state at the start of a Survival game (called from startGame).
function survivalInitRun() {
  survivalBossTimeBank     = 0;
  survivalLevelsSinceLimit = 99;
  survivalLevelsSinceKnack = 99;
  survivalRerollsUsed      = 0;
  survivalPickOffered      = null;
  survivalBossPending      = false;
  survivalRerollsLeft      = SURVIVAL_REROLLS_START;
  survivalBossesBeaten     = 0;
  survivalSecondsToBoss    = SURVIVAL_BOSS_EVERY_SECONDS;
  survivalEndless          = false;
  survivalEndlessFromLevel = Infinity;
  bossNumber               = 0;
  bossBag                  = [];
  actBossId                = null;   // Survival/Flow draw at trigger time (r238)
  document.getElementById('stage')?.classList.add('survival-mode');
  updateSurvivalShopBtn();
}

// ══════════════════════════════════════════════
// COIN / TIME / SCORE PAYOUT (called from triggerLevelUp)
// ══════════════════════════════════════════════
// leftover = seconds left on the clock when the goal was cleared. Pays coins and
// banks time toward the next boss. Score carry-over is handled inline in
// triggerLevelUp (overflow above the goal seeds the next round).
function survivalAfterLevelUp(leftover, unspentActions = 0) {
  // Flow: the session clock is NOT spent by clearing a goal (it spans every goal in
  // the 5 minutes), so there is no "leftover" to pay out and no time to bank - its
  // boss runs a fixed window. Flat coins only.
  const _flow = (typeof flowActive === 'function' && flowActive());
  // Survival and Flow skip the payout screen, so the unspent-actions credits
  // (r218) are folded into their own coin step instead - the rule is every mode.
  const unspent = Math.max(0, unspentActions) * BAL._resources.unspent_credits;
  const gained = unspent + (_flow ? SURVIVAL_LEVEL_COINS
                       : SURVIVAL_LEVEL_COINS + Math.floor(Math.max(0, leftover) / EFFICIENCY_SECONDS_PER_COIN) * SURVIVAL_COINS_PER_10S);
  coins += gained;
  updateCoinsUI();
  if (!_flow) survivalBossTimeBank = Math.min(SURVIVAL_BOSS_TIME_CAP, survivalBossTimeBank + Math.max(0, leftover));
  if (gained > 0) showMessage(`+${gained} 💰`, 'var(--c-yellow, #ffce2b)');
}

// Called once per second from the round tick (live play time only - the clock is
// paused during picks, the shop and menus, so this measures real playing time).
// When the 5-minute timer runs out the NEXT dealt round is a boss.
function survivalTickBossClock() {
  // Flow counts down to its boss on the VISIBLE clock (roundSeconds); onRoundEnd
  // fires the inspection at zero. This hidden cadence would be a second, competing
  // boss timer, so it sits out.
  if (typeof flowActive === 'function' && flowActive()) return;
  if (typeof bossesEnabled === 'function' && !bossesEnabled()) return;
  if (!survivalActive() || bossActive || survivalBossPending) return;
  survivalSecondsToBoss--;
  if (survivalSecondsToBoss <= 0) {
    survivalSecondsToBoss = SURVIVAL_BOSS_EVERY_SECONDS;
    survivalBossPending = true;
    showMessage('⚠ BOSS INCOMING', 'var(--red)');
  }
}

// ══════════════════════════════════════════════
// PICK-OF-THREE - option pools & draw
// ══════════════════════════════════════════════
// True for entities whose whole effect is about the reward grid - survival has no
// reward grid, so offering them would be a dead pick. Also used to filter the Mart.
// Also the chokepoint for Flow's own ban list (clock entities in a mode with no round
// clock) - every offer pool already routes through here, so one test covers both.
function survivalEntityBanned(id) {
  // The reward-grid-only entities are dead picks wherever there is no reward
  // grid, which is exactly the pick-of-three loop.
  if (survivalActive() && SURVIVAL_BANNED_ENTITIES.has(id)) return true;
  // The clock entities assume a round clock that REFILLS: First Wind measures its
  // grace window against ROUND_DURATION, and Carry Time banks the round's unused
  // seconds. Flow is the shipped mode with neither, and a picker-built run that
  // answered "no limit" is the other - which is why this is asked of the CLOCK
  // (modeHasNoRoundClock) and not of the mode, and why it is no longer behind the
  // survivalActive() early return: a custom no-clock run played on reward grids
  // is not survivalActive() at all.
  if (typeof modeHasNoRoundClock === 'function' && modeHasNoRoundClock()
      && typeof FLOW_BANNED_ENTITIES !== 'undefined' && FLOW_BANNED_ENTITIES.has(id)) return true;
  return false;
}

function survivalBuildPools() {
  const ownedTrick = new Set(acquiredTricks.map(b => b.id));
  const tricks = TRICK_POOL.filter(b => !survivalEntityBanned(b.id) && (!ownedTrick.has(b.id) || SURVIVAL_STACKABLE_TRICKS.includes(b.id)));
  const ownedKnack = new Set(acquiredKnacks.map(k => k.id));
  const knacks = KNACK_POOL.filter(k => !survivalEntityBanned(k.id) && !ownedKnack.has(k.id));
  const grantedSl = _grantedSleightSet();
  const sleights = SLEIGHT_POOL.filter(j => !survivalEntityBanned(j.id) && !grantedSl.has(j.id) && sleightOfferable(j));
  const lims = LIMITS_DEF.filter(d => limits[d.id].current < limits[d.id].max);
  return { trick: tricks, knack: knacks, sleight: sleights, limit: lims };
}

// Wrap a raw pool entry into a uniform option object the UI + granter understand.
function survivalMakeOption(type, data) {
  if (type === 'trick')   return { type, data, id: data.id, name: data.name, icon: (typeof trickEmoji === 'function' ? trickEmoji(data) : '🃏'), desc: data.desc, tag: tierLabel('trick', data.tier).toUpperCase(), rar: data.tier };
  if (type === 'sleight') return { type, data, id: data.id, name: data.name, icon: data.emoji || '🎴', desc: data.desc, tag: tierLabel('sleight', data.rarity).toUpperCase(), rar: data.rarity };
  if (type === 'knack')   return { type, data, id: data.id, name: data.name, icon: data.emoji || '🧿', desc: data.desc, tag: tierLabel('knack', data.rarity).toUpperCase(), rar: data.rarity };
  // Say how much, not just which - Starting Time moves by 15 and Focus Cap by 3,
  // and a card reading only 'Starting Time' promised the same as a +1. See
  // limitDeltaText in js/limits.js, which also handles the clamp near the cap.
  if (type === 'limit')   return { type, data, id: data.id, name: `${data.label} ${limitDeltaText(data.id, 1)}`, icon: data.icon || '⬆', desc: data.desc, tag: 'LIMIT', rar: 'common' };
  return null;
}

// Pick a random unused entry of `type`; mark it used; return an option (or null).
function survivalDrawOne(type, pools, used) {
  const avail = pools[type].filter(d => !used[type].has(d.id));
  if (!avail.length) return null;
  // r201: SURVIVAL_PICK_WEIGHTS only ever chose the TYPE. Which ENTITY came out
  // was a flat pick, so the pick-of-three ignored rarity entirely.
  // SURVIVAL_PICK_WEIGHTS only ever chose the TYPE; which ENTITY came out was a
  // flat pick, so the pick-of-three ignored rarity (and Luck) entirely.
  const data = pickEntityByRarity(avail, d => (type === 'trick' ? d.tier : d.rarity) || 'common') || avail[0];
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
    // r256: the pick IS the board now (js/grid-pick.js) - the head, the three
    // choices and the reroll / peek / breakdown / shop buttons are all TILES in
    // the grid. What is left over here is the breakdown READER (a text list,
    // which is a panel by nature) and the button that brings a peeked pick
    // back. The overlay itself is inert; only those two take pointer events.
    el.innerHTML = `<div id="sv-pick-contrib"></div>
      <button id="sv-peek-restore" onclick="survivalTogglePeek()">CHOOSE ONE &#8250;</button>`;
    (document.getElementById('grid-slot') || document.getElementById('stage') || document.body).appendChild(el);
  }
  return el;
}

// Survival's own controls, as the bottom row of the board. Padded with nulls so
// the four sit in the middle four cells and the two ends stay ambience.
function survivalPickActions() {
  const cost = survivalRerollCost();
  const free = survivalRerollsLeft > 0;
  return [
    null,
    { icon: '🎲', label: 'Reroll', sub: free ? `FREE (${survivalRerollsLeft})` : `${cost} ◆`,
      disabled: !free && coins < cost, onClick: () => survivalReroll() },
    { icon: '👁', label: 'Peek', sub: 'watch', onClick: () => survivalTogglePeek() },
    { icon: '📊', label: 'Round', sub: 'breakdown', onClick: () => survivalToggleContrib() },
    { icon: '🛒', label: 'Shop', sub: `${SURVIVAL_SHOP_COST} ◆`, cls: 'gp-act-buy',
      disabled: coins < SURVIVAL_SHOP_COST, onClick: () => survivalOpenShop() },
    null,
  ];
}

function survivalRenderPick() {
  survivalPickOverlay();
  // The choices are the shared on-board tiles (js/grid-pick.js): the object,
  // the name and the description, laid into the grid as 2x3 cell tiles with
  // ambience cards above and the controls below. A limit keeps the bare icon -
  // there is no object to show (gridPickTileHTML handles that case).
  const offers = (survivalPickOffered || []).map(opt => ({
    entity: opt.type, id: opt.id, emoji: opt.icon, icon: opt.icon,
    label: opt.name, desc: opt.desc, rarity: opt.rar, tag: opt.tag,
    uses: opt.type === 'sleight'
      ? (opt.data.durability === 'infinite' ? '\u221e' : opt.data.durability + 'x') : undefined,
  }));
  const actions = survivalPickActions();
  // A reroll swaps the offers under a board that is already dealt, so it
  // REDRAWS rather than re-dealing - the cards should not fall in twice for one
  // screen.
  if (typeof gridPickState !== 'undefined' && gridPickState) gridPickRefresh(offers, actions);
  else openGridPick({
    title: survivalPickKicker === 'BOSS DEFEATED' ? 'BOSS REWARD' : 'CHOOSE ONE',
    tone: 'reward', offers, actions,
    onChoose: (i) => survivalChoose(i),
  });
}

function survivalUpdateRerollBtn() {
  // The reroll and shop controls are TILES on the board now (r256), so keeping
  // their affordability live is a redraw of the action row rather than a class
  // on a button. Called from js/hud.js, the Mart and the shop whenever credits
  // move while the pick is up.
  if (typeof gridPickState === 'undefined' || !gridPickState) return;
  gridPickRefresh(null, survivalPickActions());
}

// Show the pick panel beside the preview. Called from the goal dance (after the
// cards fly into the preview) and from the post-boss reward. Does NOT advance the
// level - the deal happens when the player chooses (survivalChoose).
function survivalShowPick(bonus = false, kicker) {
  animating = false;
  trickSelectionPhase = false;
  survivalBonusPick = !!bonus;
  survivalPickKicker = kicker || (bonus ? 'BOSS DEFEATED' : 'GOAL CLEARED');
  survivalRerollsUsed = 0;             // free rerolls refresh every pick
  survivalPickOffered = survivalPickOptions(false);
  if (typeof sfxLevelUp === 'function') sfxLevelUp();
  survivalRenderPick();
  const ov = survivalPickOverlay();
  ov.classList.add('show');
  ov.classList.remove('sv-peek');   // a fresh pick always opens in front
  survivalHideContrib(); // start collapsed
  survivalSyncPickAudio();
  // The goal hand's score panel isn't refreshed by the (skipped) interlude - sync it
  // so the SCORE total reflects the cleared goal while the preview dance climbs.
  if (typeof updateScoreUI === 'function') updateScoreUI();
}

// ── Contributions breakdown (the payout's Contributions view, surfaced on the pick
//    because survival skips the payout). Reads the live round tally, which is still
//    populated here - triggerLevelUp (which resets it) only runs once you choose. ──
function survivalToggleContrib() {
  const panel = document.getElementById('sv-pick-contrib');
  if (!panel) return;
  if (panel.classList.contains('show')) { survivalHideContrib(); return; }
  panel.innerHTML = (typeof roundContributionRowsHTML === 'function')
    ? roundContributionRowsHTML() : '<div class="contrib-empty">No breakdown.</div>';
  panel.classList.add('show');
  document.getElementById('sv-pick-contrib-btn')?.classList.add('sv-open');
}
function survivalHideContrib() {
  const panel = document.getElementById('sv-pick-contrib');
  if (panel) { panel.classList.remove('show'); panel.innerHTML = ''; }
  document.getElementById('sv-pick-contrib-btn')?.classList.remove('sv-open');
}

// ── PEEK (r197) ──────────────────────────────────────────────────────────────
// The pick opens DURING the goal dance - that is deliberate, the score count-up
// and the choosing happen together - but the panel lands on top of the finale
// that is still playing, and in portrait it is centred right over the board. So
// the panel can be put aside: peek hides it and hands the screen back, and one
// button brings it straight back. Nothing is decided or timed by this; the deal
// still waits on survivalChoose either way.
//
// The button that restores it lives OUTSIDE #survival-pick-panel, because the
// panel itself is pointer-events:none while peeking - a restore button inside it
// would be unreachable.
function survivalTogglePeek() {
  const ov = survivalPickOverlay();
  if (!ov.classList.contains('show')) return;
  ov.classList.toggle('sv-peek');
  const peeking = ov.classList.contains('sv-peek');
  if (peeking) survivalHideContrib();
  // r256: peek is no longer "hide a panel" - the pick IS the board, so peeking
  // hands the BOARD back (the real cards are re-rendered at the play size) and
  // restoring re-takes it over. gridPickState holds the offers across both.
  if (typeof gridPickSetShown === 'function') gridPickSetShown(!peeking);
  survivalSyncPickAudio();
}

// The board is still scoring underneath the panel, so it stays audible - just
// muffled, the way it would sound through the thing covering it. Peeking pulls
// the panel away, so the mix opens back up. One function owns the rule, and
// every path that changes what is on screen calls it (show, choose, peek, and
// the Mart's return in js/mart-shop.js).
function survivalSyncPickAudio() {
  if (typeof sfxSetMuffle !== 'function') return;
  const ov = document.getElementById('survival-pick-overlay');
  const covering = !!ov && ov.classList.contains('show') && !ov.classList.contains('sv-peek');
  sfxSetMuffle(covering);
}

function survivalReroll() {
  const cost = survivalRerollCost();
  if (survivalRerollsLeft > 0) {
    survivalRerollsLeft--;              // spend from the carry-over pool
  } else {
    if (coins < cost) { showMessage('Not enough 💰', 'var(--red)'); return; }
    coins -= cost; updateCoinsUI();
    survivalRerollsUsed++;              // only paid rerolls escalate the price
  }
  survivalPickOffered = survivalPickOptions(true);
  if (typeof sfxShopOpen === 'function') sfxShopOpen();
  survivalRenderPick();
}

// Grant the chosen option, then run the level-up → deal. Because the grant happens
// BEFORE triggerLevelUp, the new limit values are already in place when triggerLevelUp
// sizes the board and computes swaps/discards/time - so a picked Limit applies to the
// very next round with no special-casing.
function survivalChoose(i) {
  const opt = (survivalPickOffered || [])[i];
  if (!opt) return;
  if (typeof cancelDance === 'function') cancelDance(); // stop the score count-up if still running
  survivalHideContrib();
  survivalPickOverlay().classList.remove('show', 'sv-peek');
  if (typeof closeGridPick === 'function') closeGridPick();
  survivalPickOffered = null;
  survivalSyncPickAudio();
  survivalGrant(opt);
  // Post-boss BONUS pick doesn't carry score or pay the time-coins (no goal was cleared).
  survivalSkipCarryover = survivalBonusPick;
  survivalBonusPick = false;
  triggerLevelUp(); // → showLevelUpScreen (survival) → survivalDealNext
  survivalSkipCarryover = false;
}

// Route each option type to the existing grant primitive.
function survivalGrant(opt) {
  switch (opt.type) {
    case 'trick':   injectTrickAfterReward(opt.data); break;
    case 'sleight': grantSleight(opt.data); showMessage(`${opt.icon} ${opt.name}!`, '#c07aee'); break;
    case 'knack':   acquiredKnacks.push({ ...opt.data }); updateKnackList?.(); showMessage(`${opt.icon} ${opt.name}!`, '#d4a017'); break;
    case 'limit': { const _say = `${opt.icon} ${limitDeltaText(opt.data.id, 1)} ${opt.data.label}`;   // before the increment moves it
                    incrementLimit(opt.data.id); showMessage(_say, '#5ad4c0'); break; }
  }
}

// ══════════════════════════════════════════════
// BOARD ANIMATION - spread/freeze on goal, deal on pick
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
  // 2) Recycle the old board (iterate the CURRENT/old dims to recover every card),
  //    then apply any grid-size Limit picked this level and rebuild to the new dims.
  survivalRecycleBoard();
  gridRows = limits.grid_rows.current;
  gridCols = limits.grid_cols.current;
  recomputeGridMetrics();
  gridData = [];
  for (let r = 0; r < gridRows; r++) {
    gridData[r] = [];
    for (let c = 0; c < gridCols; c++) gridData[r][c] = drawCard() || null;
  }
  // 3) New cards drop in slightly after the old ones start leaving - reuse the
  //    shared deal-in animation, which clears leftover real cards and repaints.
  dealPhase = true;
  setTimeout(() => {
    gameTimerPaused = false;           // the goal dance froze the clock; the new round is live
    startNewRoundDealAnims();          // builds temp cards from gridData, drops them, clears dealPhase
    updateClockUI();
    if (survivalBossPending) {
      // This dealt board is a BOSS round - trigger it once the cards settle
      // instead of starting a normal goal timer.
      survivalBossPending = false;
      setTimeout(() => survivalTriggerBoss(), 950);
    } else {
      startRoundTimer();               // 120s round (roundSeconds set by computeRoundResources)
    }
  }, 90);
}

// ══════════════════════════════════════════════
// BOSS ROUND (every 8 clears) - uses the banked leftover time as its clock
// ══════════════════════════════════════════════
function survivalTriggerBoss() {
  const t = Math.max(SURVIVAL_BOSS_MIN_TIME, Math.min(SURVIVAL_BOSS_TIME_CAP, Math.round(survivalBossTimeBank)));
  triggerBoss(null, t);  // boss objective is checked in playHand (survival plays real hands)
}

// Boss defeated: grant carry-over rerolls, then either finish the run (after the
// 5th boss) or hand out a bonus pick and continue.
// (endBoss already cleared modifiers/blocked cells and zeroed the time bank.)
function survivalPostBossReward() {
  if (typeof flowEndBoss === 'function') flowEndBoss(); // Flow: refill the session clock on the next deal
  survivalBossesBeaten++;
  survivalRerollsLeft += SURVIVAL_REROLLS_PER_BOSS;
  survivalSecondsToBoss = SURVIVAL_BOSS_EVERY_SECONDS; // restart the 5-minute cadence
  survivalSpreadFreeze();
  if (!survivalEndless && survivalBossesBeaten >= SURVIVAL_BOSS_COUNT) {
    setTimeout(() => showSurvivalCompleteScreen(), 420);
    return;
  }
  // r188: the post-boss reward is the PRIZE GRID, not the pick-of-three. Same
  // occasion, but the grid is what every other mode's boss pays out in, and it
  // hands out several things off one connected path instead of one. The
  // 'survival' context in closeRewardGrid runs survivalChoose's own tail.
  showMessage(`BOSS ${survivalBossesBeaten}/${SURVIVAL_BOSS_COUNT} DEFEATED · +${SURVIVAL_REROLLS_PER_BOSS} REROLLS`, 'var(--gold)');
  setTimeout(() => { rewardGridContext = 'survival'; openPrizeGrid(); }, 320);
}

// ══════════════════════════════════════════════
// RUN COMPLETE (5 bosses) - retire, or continue into accelerated endless
// ══════════════════════════════════════════════
function survivalCompleteOverlay() {
  let el = document.getElementById('survival-complete-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'survival-complete-overlay';
    el.innerHTML = `<div id="sv-complete-panel">
        <div class="sv-c-kicker">CONTRACT FULFILLED</div>
        <div class="sv-c-title">RUN COMPLETE</div>
        <div id="sv-complete-stats"></div>
        <div class="sv-c-btns">
          <button id="sv-c-retire" class="sv-c-btn sv-c-ghost" onclick="survivalRetire()">⏻ Retire - bank the run</button>
          <button id="sv-c-continue" class="sv-c-btn sv-c-primary" onclick="survivalContinueEndless()">↯ Continue - Endless</button>
        </div>
        <div class="sv-c-note">Endless: goals escalate <b>65% faster</b> from here. There is no second exit.</div>
      </div>`;
    (document.getElementById('stage') || document.body).appendChild(el);
  }
  return el;
}

function showSurvivalCompleteScreen() {
  gameTimerPaused = true;
  if (roundInterval) { clearInterval(roundInterval); roundInterval = null; }
  const el = survivalCompleteOverlay();
  const stats = el.querySelector('#sv-complete-stats');
  if (stats) stats.innerHTML =
    `<div class="sv-c-row"><span>Bosses defeated</span><b>${survivalBossesBeaten}</b></div>` +
    `<div class="sv-c-row"><span>Goals cleared</span><b>${Math.max(0, level - 1)}</b></div>` +
    `<div class="sv-c-row"><span>Total score</span><b>${(totalScore + score).toLocaleString()}</b></div>` +
    `<div class="sv-c-row"><span>Credits</span><b>💰 ${coins}</b></div>`;
  el.classList.add('show');
  if (typeof sfxVictory === 'function') sfxVictory();
}

// Retire: end the run as a WIN (the end screen's normal stats readout).
function survivalRetire() {
  survivalCompleteOverlay().classList.remove('show');
  if (typeof onGameWin === 'function') onGameWin();
  else onGameEnd(false);
}

// Continue: goals accelerate from the NEXT level onward; rounds resume as normal.
function survivalContinueEndless() {
  survivalEndless = true;
  survivalEndlessFromLevel = level;   // levels beyond this one use the faster curve
  survivalCompleteOverlay().classList.remove('show');
  showMessage('↯ ENDLESS - quotas accelerated', 'var(--c-coral, #ff6a3c)');
  rewardGridContext = 'survival'; openPrizeGrid();   // the payout the 5th boss earned
}

// ══════════════════════════════════════════════
// ON-DEMAND SHOP (button by the coins chip)
// ══════════════════════════════════════════════
// Opened from the PICK screen (owner request, r155) - the pick stays open behind the
// Mart, so leaving the shop returns you to your three options.
function survivalOpenShop() {
  if (!survivalActive()) return;
  if (martActive || (typeof shopGridActive !== 'undefined' && shopGridActive)
      || document.getElementById('shop-overlay')?.classList.contains('show')) return;
  if (coins < SURVIVAL_SHOP_COST) { showMessage(`Entry fee is ${SURVIVAL_SHOP_COST} 💰`, 'var(--red)'); return; }
  coins -= SURVIVAL_SHOP_COST;
  updateCoinsUI();
  survivalShopFromPick = survivalPickOverlay().classList.contains('show');
  if (typeof sfxSetMuffle === 'function') sfxSetMuffle(false);
  triggerShop();
}
let survivalShopFromPick = false;

// Legacy no-op: the shop button used to live by the coins chip. It now lives on the
// pick screen, so this only keeps the old chip buttons hidden.
function updateSurvivalShopBtn() {
  document.querySelectorAll('.survival-shop-btn').forEach(btn => btn.classList.remove('sv-on'));
}
