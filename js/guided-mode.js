// ══════════════════════════════════════════════
// GUIDED MODE (r218) - eight slots an act, and you buy what fills them
// ══════════════════════════════════════════════
// r191's Guided fixed the route: every act ran the same spine, so the Mart was
// guaranteed. That solved the economy problem and removed the decision with it.
// This replaces it. An act is **GUIDED_SLOTS_PER_ACT slots** and then the boss,
// and every slot is filled by one of two kinds of thing:
//
//   - a LEVEL: play a round. Free, and how you earn credits.
//   - a STOP: the Mart, a reward grid, or one of two offered events. Costs
//     credits, and costs the slot.
//
// **The slots are the real currency, not the credits.** Buying power always
// costs a round you will not get to play, so the question an act asks is how
// much of your run you are willing to spend on getting stronger rather than on
// getting further. Credits are only the second constraint.
//
// ── EVERY SLOT ADVANCES THE DIFFICULTY CURVE, BOUGHT OR PLAYED ───────────────
// This is the load-bearing rule and the mode does not work without it. The goal
// curve is driven by `level`, and `level++` lives in triggerLevelUp - which only
// runs when a ROUND starts. So if a bought slot left the curve alone, a player
// could buy six stops and meet the boss at level 2 holding a level-8 loadout.
// That is not a strategy, it is the dominant strategy, and it would be the whole
// mode within one run of finding it.
//
// So guidedAdvanceCurve() bumps `level` when a stop is bought, exactly as
// finishing a round would. The bar you eventually face is set by how far through
// the act you are, never by how you got there - and buying is still worth it,
// because the goal climbs at GOAL_SCALE while base pips climb at only 1.1 and
// the loadout you bought is what covers the difference.

const GUIDED_SLOTS_PER_ACT = 8;
const GUIDED_EVENT_OFFERS  = 2;   // how many events are on the board at once

function guidedActive() { return !!ACTIVE_MODE && ACTIVE_MODE.guided === true; }

// Slots filled this act (0 .. GUIDED_SLOTS_PER_ACT). At the cap, the boss.
let guidedSlot = 0;
// The two events currently for sale, as { id, name, flavor, price }. Rolled once
// per crossroads so the offer is a real decision rather than a fresh gamble each
// time the screen repaints.
let guidedEventOffers = [];
// Set while a bought stop is running, so its close handler knows to come back
// here rather than to the ordinary next-round path.
let guidedInStop = false;

function guidedResetRun() {
  guidedSlot = 0; guidedInStop = false;
  guidedOffers = []; guidedLastKind = null; guidedSinceLevel = 0;
  guidedBuysThisAct = {};
  guidedPendingChallenge = null; guidedActiveChallenge = null;
  miniBossActive = false;   // startGame's own boss teardown clears the effects
  guidedCrossroadsOpen = false;
}

// ── Pricing ────────────────────────────────────────────────────────────────
// Base price per kind from BAL.guided, plus GUIDED_REPEAT_STEP for each time you
// have already bought that kind THIS ACT. Buying the Mart twice in an act is
// allowed and costs more the second time, which self-balances the "just buy the
// Mart every slot" line without a hard rule against it. The counter resets with
// the act, not with the run.
const GUIDED_REPEAT_STEP = 3;
let guidedBuysThisAct = {};

function guidedStopPrice(kind, id) {
  const B = BAL.guided;
  const base = kind === 'shop'   ? B.price_shop
             : kind === 'reward' ? B.price_reward
             : kind === 'event'  ? B.price_event
             :                     0;          // level, elite and pick3 are free
  if (!base) return 0;
  return base + GUIDED_REPEAT_STEP * (guidedBuysThisAct[kind] || 0);
}

// ── What is on offer ───────────────────────────────────────────────────────
// FOUR tiles, drawn independently by weight, so a crossroads is a hand you were
// dealt rather than the same menu every time. The weights are the owner's:
// a round is nearly always there, a grid usually, the Mart half the time, and
// the rare ones are what make a particular crossroads worth remembering.
const GUIDED_TILE_COUNT = 4;
const GUIDED_ODDS = [
  { kind: 'level',  chance: 0.90 },
  { kind: 'reward', chance: 0.75 },
  { kind: 'shop',   chance: 0.50 },
  { kind: 'elite',  chance: 0.25 },
  { kind: 'pick3',  chance: 0.20 },
];
// Events are the filler: whatever the rolls leave empty, so the board is always
// full and a quiet draw still offers something to do.

// The kind taken last time - never offered twice running, so a crossroads can
// never be the same decision you just made.
let guidedLastKind = null;
// Choices since the last round was played. At GUIDED_LEVEL_EVERY - 1 the next
// crossroads is forced to carry a level, so a run cannot buy its way past
// actually playing.
const GUIDED_LEVEL_EVERY = 3;
let guidedSinceLevel = 0;
// The tiles currently on the board: { kind, id, name, desc, price }.
let guidedOffers = [];

function guidedRollOffers() {
  const forcedLevel = guidedSinceLevel >= GUIDED_LEVEL_EVERY - 1;
  const kinds = [];
  GUIDED_ODDS.forEach(o => {
    // The kind just taken is out, EXCEPT a level that is now compulsory - the
    // forced level has to win, or the rule that you must play could be blocked
    // by the rule that you must not repeat.
    if (o.kind === guidedLastKind && !(o.kind === 'level' && forcedLevel)) return;
    if (o.kind === 'level' && forcedLevel) { kinds.push(o.kind); return; }
    if (Math.random() < o.chance) kinds.push(o.kind);
  });
  // Trim from the BACK, which is the low-probability end, so a crowded roll
  // keeps the staples rather than dropping them for a novelty.
  while (kinds.length > GUIDED_TILE_COUNT) kinds.pop();

  const out = kinds.map(k => guidedMakeOffer(k)).filter(Boolean);
  // Events fill whatever is left. Drawn fresh each crossroads and filtered
  // against recentEventIds, so the pair on the board is never one you just saw.
  const used = new Set(out.map(o => o.id).filter(Boolean));
  const pool = (typeof EVENT_META !== 'undefined') ? Object.keys(EVENT_META) : [];
  const fresh = pool.filter(id => !used.has(id)
    && !(typeof recentEventIds !== 'undefined' && recentEventIds.includes(id)));
  const draw = (typeof evShuffle === 'function' ? evShuffle(fresh.length ? fresh : pool) : (fresh.length ? fresh : pool).slice());
  let di = 0;
  while (out.length < GUIDED_TILE_COUNT && di < draw.length) {
    const id = draw[di++];
    out.push({ kind:'event', id, name: EVENT_META[id].name, desc: EVENT_META[id].flavor,
               icon:'✧', price: guidedStopPrice('event', id) });
  }
  guidedOffers = out;
}

function guidedMakeOffer(kind) {
  const P = k => guidedStopPrice(k);
  if (kind === 'level')  return { kind, icon:'▶', name:'Play a round',
    desc:'Clear the goal and take the payout. This is how you earn.', price:0 };
  if (kind === 'reward') return { kind, icon:'▦', name:'Reward grid',
    desc:'Pick a path across the board and take everything on it.', price:P('reward') };
  if (kind === 'shop')   return { kind, icon:'🛒', name:'The Shop',
    desc:'Buy Tricks, Sleights, Knacks and limit upgrades.', price:P('shop') };
  if (kind === 'pick3')  return { kind, icon:'✦', name:'Take your pick',
    desc:'Three rewards on the table. Take one, no charge.', price:0 };
  if (kind === 'elite') {
    const ch = rollChallengeLevel();
    return { kind, icon:'⚠', name:'Hard round', challenge: ch,
             desc:`${ch.label} Goal is ${Math.round((ch.goalMult - 1) * 100)}% higher, and it pays ${ch.rewardText}.`,
             price:0 };
  }
  return null;
}

// ── The board ──────────────────────────────────────────────────────────────
// Drawn ON THE GRID as four big tiles, each about a quarter of the board, and
// dealt in with the reward grid's own fall animation - because that is exactly
// what this screen is: a board of things to take. Leftover cells (an odd row or
// column count) are filled with inert black cards rather than left as holes.
function guidedOpenCrossroads() {
  if (!guidedOffers.length) guidedRollOffers();
  gameTimerPaused = true;
  guidedCrossroadsOpen = true;
  if (typeof enterGridScreenHud === 'function') enterGridScreenHud('CROSSROADS', 'shop');
  guidedRenderCrossroads(true);
  guidedRenderCrossBar();
}

let guidedCrossroadsOpen = false;

function guidedRenderCrossroads(animateIn) {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  if (typeof recomputeGridMetrics === 'function') recomputeGridMetrics();
  gridEl.innerHTML = '';

  // A quarter of the board each. floor() so an odd board leaves a rim rather
  // than overflowing it; the rim becomes filler.
  const R = Math.max(2, gridRows), C = Math.max(2, gridCols);
  const hR = Math.floor(R / 2), hC = Math.floor(C / 2);
  const span = (n) => n * (CARD_W + CARD_GAP) - CARD_GAP;
  const spanV = (n) => n * (CARD_H + CARD_GAP) - CARD_GAP;
  const spots = [[0, 0], [0, hC], [hR, 0], [hR, hC]];
  const covered = new Set();
  spots.forEach(([r0, c0]) => {
    for (let r = r0; r < r0 + hR; r++) for (let c = c0; c < c0 + hC; c++) covered.add(r + '-' + c);
  });

  const anims = [];
  const FALL_DUR = 420, BOUNCE = 8, SQUISH = 0.10;

  // Filler first, so a real tile always paints over it.
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (covered.has(r + '-' + c)) continue;
    const f = document.createElement('div');
    f.className = 'gx-filler';
    f.style.cssText = `left:${cellLeft(c)}px;top:${cellTop(r)}px;width:${CARD_W}px;height:${CARD_H}px;`;
    gridEl.appendChild(f);
  }

  guidedOffers.forEach((off, i) => {
    const [r0, c0] = spots[i] || spots[0];
    const afford = coins >= off.price;
    const div = document.createElement('div');
    div.className = 'reward-cell on-grid gx-tile gx-' + off.kind + (afford ? '' : ' gx-locked');
    div.style.cssText = `left:${cellLeft(c0)}px;top:${cellTop(r0)}px;width:${span(hC)}px;height:${spanV(hR)}px;`;
    div.innerHTML =
      `<div class="gx-t-icon">${off.icon}</div>` +
      `<div class="gx-t-name">${off.name}</div>` +
      `<div class="gx-t-desc">${off.desc}</div>` +
      `<div class="gx-t-price">${off.price ? off.price + ' ◆' : 'FREE'}</div>`;
    if (afford) div.onclick = () => guidedChoose(off);
    gridEl.appendChild(div);

    if (animateIn) {
      const dropDist = (R - r0) * (CARD_H + CARD_GAP);
      const delay = c0 * 70 + r0 * 40;
      anims.push(div.animate([
        { opacity: 0, transform: `translateY(${-dropDist}px) scaleY(1)` },
        { opacity: 1, transform: `translateY(${-dropDist}px) scaleY(1)`,                      offset: 0.06 },
        { opacity: 1, transform: `translateY(${-dropDist * 0.45}px) scaleY(0.96)`,            offset: 0.55, easing: 'ease-in' },
        { opacity: 1, transform: `translateY(${BOUNCE}px) scaleY(${1 - SQUISH})`,             offset: 0.83 },
        { opacity: 1, transform: `translateY(${-BOUNCE * 0.7}px) scaleY(${1 + SQUISH})`,      offset: 0.91 },
        { opacity: 1, transform: `translateY(${BOUNCE * 0.3}px) scaleY(${1 - SQUISH * 0.2})`, offset: 0.96 },
        { opacity: 1, transform: 'translateY(0) scaleY(1)' },
      ], { duration: FALL_DUR, delay, easing: 'ease-in', fill: 'both' }));
    }
  });
}

// The act readout above the board: where you are, and what it is costing you.
function guidedRenderCrossBar() {
  let bar = document.getElementById('gx-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'gx-bar';
    document.body.appendChild(bar);
  }
  const left = GUIDED_SLOTS_PER_ACT - guidedSlot;
  const due  = GUIDED_LEVEL_EVERY - 1 - guidedSinceLevel;
  bar.innerHTML =
    `<span class="gxb-act">Q${actNumber}</span>` +
    `<span class="gxb-slots">SLOT ${guidedSlot + 1} / ${GUIDED_SLOTS_PER_ACT}</span>` +
    `<span class="gxb-note">${left === 1 ? 'Boss next' : due <= 0 ? 'A round is due' : `${left} to the boss`}</span>` +
    `<span class="gxb-coins">${coins} ◆</span>`;
  bar.classList.add('show');
}
function guidedCloseCrossroads() {
  guidedCrossroadsOpen = false;
  document.getElementById('gx-bar')?.classList.remove('show');
  if (typeof exitGridScreenHud === 'function') exitGridScreenHud();
}

function guidedChoose(off) {
  if (!off || coins < off.price) return;
  if (off.price) { coins -= off.price; updateCoinsUI?.(); guidedBuysThisAct[off.kind] = (guidedBuysThisAct[off.kind] || 0) + 1; }
  guidedLastKind = off.kind;
  guidedOffers = [];                 // re-roll for the next crossroads
  guidedCloseCrossroads();

  if (off.kind === 'level' || off.kind === 'elite') {
    guidedSinceLevel = 0;
    // An elite arms its extra requirement for the round that is about to deal.
    guidedPendingChallenge = (off.kind === 'elite') ? off.challenge : null;
    drainLevelUpQueue();
    return;
  }
  guidedSinceLevel++;

  // A bought stop costs the same step on the curve a played round would.
  guidedAdvanceCurve();
  guidedInStop = true;

  if (off.kind === 'shop') {
    shopFromNodeFlow  = true;
    nodeFlowAfterShop = () => guidedAfterSlot();
    triggerShop();
  } else if (off.kind === 'reward') {
    // 'interlude', not a context of its own: that is the only value whose
    // continuation reaches finishInterlude, where the guided return lives.
    rewardGridContext = 'interlude';
    openRewardGrid();
  } else if (off.kind === 'pick3') {
    guidedOpenPickThree(() => guidedAfterSlot());
  } else {
    shopFromNodeFlow = false;
    guidedOpenNamedEvent(off.id, () => guidedAfterSlot());
  }
}

// openEvent draws from its own pool; the crossroads has already chosen. This is
// the same open sequence with the draw replaced, so the no-repeat memory is still
// fed and every other event behaviour is unchanged.
function guidedOpenNamedEvent(id, afterFn) {
  afterEventFn = afterFn || (() => drainLevelUpQueue());
  activeEventId = id;
  recentEventIds.push(id);
  if (recentEventIds.length > EVENT_NO_REPEAT) recentEventIds.shift();
  eventState = {};
  renderEventShell(id);
  document.getElementById('event-overlay').classList.add('show');
}

// The act readout's next stop, for the HUD.
function guidedNextStopLabel() {
  if (!guidedActive()) return '';
  return guidedSlot >= GUIDED_SLOTS_PER_ACT ? 'BOSS'
       : `SLOT ${guidedSlot + 1}/${GUIDED_SLOTS_PER_ACT}`;
}

// ══════════════════════════════════════════════
// CHALLENGE LEVELS (r229) - Guided's elite
// ══════════════════════════════════════════════
// A round with a raised goal AND one extra requirement, paying better for both.
// This is the "elite" every roguelike map has: the optional harder node you take
// because the reward is worth the risk.
//
// **The requirement must be readable from counters the round already keeps**, or
// every one of them needs its own hook in playHand. All four below read state
// that exists: handsPlayedRound, handTypesRound, and the hand log. That is the
// whole reason this is cheap.
//
// **Failing the challenge is NOT failing the round.** Clear the raised goal and
// the round passes as normal; meet the requirement as well and you also take the
// bonus. A node that can end a run on a technicality is not an elite, it is a
// trap, and a player would simply never take one.
// This round's own hand-log entries. Entries carry `level`, NOT `round` - the
// first version of `big` tested h.round, which no entry has, so it never fired.
function _chRoundHands() {
  return (handLog || []).filter(h => h.level === level && h.src === 'play');
}
const CHALLENGE_DEFS = [
  { id:'types',  goalMult:1.25, credits:25,
    label:'Score three different hand types.',
    test: () => (handTypesRound?.size || 0) >= 3 },
  { id:'hands',  goalMult:1.20, credits:20,
    label:'Score at least five hands.',
    test: () => (handsPlayedRound || 0) >= 5 },
  { id:'big',    goalMult:1.30, credits:30,
    label:'Score two hands of four or more cards, back to back.',
    test: () => { const hs = _chRoundHands();
      for (let i = 1; i < hs.length; i++)
        if ((hs[i - 1].cards?.length || 0) >= 4 && (hs[i].cards?.length || 0) >= 4) return true;
      return false; } },
  { id:'lean',   goalMult:1.15, credits:22,
    label:'Clear it in three hands or fewer.',
    test: () => (handsPlayedRound || 0) <= 3 },
  { id:'haymaker', goalMult:1.25, credits:28,
    label:'Score one hand worth a third of the goal.',
    test: () => _chRoundHands().some(h => (h.score || 0) >= roundGoal / 3) },
  { id:'clean',  goalMult:1.20, credits:24,
    label:'Use no discards.',
    test: () => (cardsDiscardedRound || 0) === 0 },
  { id:'notakebacks', goalMult:1.20, credits:24,
    label:'Use no swaps.',
    test: () => (swapsUsedRound || 0) === 0 },
  { id:'sprinter', goalMult:1.25, credits:28,
    label:'Clear with 45 seconds or more on the clock.',
    test: () => (roundSeconds || 0) >= 45 },
  { id:'specialist', goalMult:1.20, credits:22,
    label:'Score the same hand type three times.',
    test: () => { const n = {};
      for (const h of _chRoundHands()) { n[h.hand] = (n[h.hand] || 0) + 1; if (n[h.hand] >= 3) return true; }
      return false; } },
  // Gated on Selection Size >= 5 (avail), the same liveness idea as
  // bossPresetIsLive: a requirement that cannot be met must not be offered.
  { id:'widenet', goalMult:1.35, credits:35,
    label:'Score a run, a set and a flush.',
    avail: () => (limits?.selection?.current || 0) >= 5,
    test: () => { const fams = new Set();
      for (const h of _chRoundHands())
        (NS_HAND_FAMILIES[h.hand] || []).forEach(f => fams.add(f));
      return fams.has('run') && fams.has('set') && fams.has('flush'); } },

  // ── MINI-BOSSES (r239) - the second challenge kind ─────────────────────────
  // No task to complete: the HANDICAP is the challenge, a boss modifier at half
  // strength running inside an ordinary round, and clearing the (raised) goal
  // pays the credits. They ride the real boss-effect machinery through
  // bossFxLive() (js/boss-effects.js) - armed by miniBossMaybeStart when the
  // round's clock starts, torn down by miniBossClear at the settle.
  // test: () => true because the settle only ever runs on a cleared round.
  { id:'mini_stones', goalMult:1.20, credits:26, mini: { modifier: '_stones' },
    label:'Stones bury part of the board.',
    test: () => true },
  { id:'mini_toll',   goalMult:1.20, credits:24,
    mini: { modifier: 'interact_surcharge', params: { costMult: 1.5, playCostAdd: 2 } },
    label:'Swaps and discards cost half again, playing +2s.',
    test: () => true },
  { id:'mini_tide',   goalMult:1.20, credits:26,
    mini: { modifier: 'focus_drain', params: { everySecs: 20, amount: 5 } },
    label:'Lose 5 Focus every 20 seconds.',
    test: () => true },
  { id:'mini_hold',   goalMult:1.20, credits:26,
    mini: { modifier: 'card_hold', params: { everySecs: 25, holdSecs: 15, count: 1 } },
    label:'A card is frozen every 25 seconds.',
    test: () => true },
  { id:'mini_sip',    goalMult:1.25, credits:28,
    mini: { modifier: 'suit_markdown', params: { count: 1, mult: 0.6, holdSecs: 60 } },
    label:'One suit pays 60%, rotating each minute.',
    test: () => true },
  { id:'mini_fog',    goalMult:1.25, credits:28, mini: { modifier: '_fog', params: { secs: 60 } },
    label:'Ranks hidden for the first minute.',
    test: () => true },
];

// ── The mini-boss harness ────────────────────────────────────────────────────
// One flag, read by bossFxLive() in js/boss-effects.js, which is what lets the
// real boss schedules, pip scale, fog and suit markdown run in a normal round.
let miniBossActive = false;

// Called from startRoundTimer - the one place every round's clock starts - so a
// mini arms exactly when its round becomes live (and on a resumed round, since
// resume also lands there). Never during a real boss: that round has its own
// effects and triggerLevelUp never armed a challenge for it anyway.
function miniBossMaybeStart() {
  if (miniBossActive || bossActive) return;
  const m = guidedActiveChallenge && guidedActiveChallenge.mini;
  if (!m) return;
  miniBossActive = true;
  if (m.modifier === '_stones') {
    // Stone Lord Jr: half the real boss's count, no deck rubble.
    placeStonesOnGrid(Math.max(2, Math.round((gridRows + gridCols) / 4)));
    if (typeof render === 'function') render();
  } else if (m.modifier === '_fog') {
    // Light Fog: ranks hidden, but only for the opening stretch.
    bossFog = true;
    bossDelay((m.params?.secs || 60) * 1000, () => {
      bossFog = false;
      if (typeof render === 'function' && gridData && gridData[0]) render();
    });
    if (typeof render === 'function') render();
  } else {
    applyBossEffectModifier(m.modifier, m.params || {});
  }
  // The real boss path fires this from startBossTimer; a mini's round has no
  // boss timer, so it fires here. Schedules tick behind bossFxLive().
  bossStartScheduledEffects();
}

// Torn down wherever the round stops mattering: the settle (cleared round), a
// failed round's game-over via the next startGame (guidedResetRun), and any
// real boss teardown (clearBossEffects is shared, so state can never leak).
function miniBossClear() {
  if (!miniBossActive) return;
  miniBossActive = false;
  clearBossEffects();
  if (typeof render === 'function' && gridData && gridData[0]) { try { render(); } catch (e) {} }
}

// Armed by taking an elite tile; consumed when the round deals.
let guidedPendingChallenge = null;
// The challenge the CURRENT round is running, or null.
let guidedActiveChallenge  = null;

function rollChallengeLevel() {
  // `avail` gates a requirement that cannot currently be met (Wide Net below
  // Selection Size 5) - the same liveness idea as bossPresetIsLive.
  const pool = CHALLENGE_DEFS.filter(d => { try { return !d.avail || d.avail(); } catch (e) { return false; } });
  const d = pool[Math.floor(Math.random() * pool.length)] || CHALLENGE_DEFS[0];
  return { ...d, rewardText: `+${d.credits} credits` };
}

// Called from triggerLevelUp AFTER roundGoal is set, so the multiplier lands on
// the real goal for this level rather than on a stale one.
function guidedApplyPendingChallenge() {
  guidedActiveChallenge = null;
  // Map mode's challenge tiles ride the same pending/active/settle machinery.
  const _live = guidedActive() || (typeof mapActive === 'function' && mapActive());
  if (!_live || !guidedPendingChallenge) return;
  guidedActiveChallenge = guidedPendingChallenge;
  guidedPendingChallenge = null;
  roundGoal = Math.round(roundGoal * guidedActiveChallenge.goalMult / 50) * 50;
}

// Called at the goal clear, before the round's counters are reset.
function guidedSettleChallenge() {
  const ch = guidedActiveChallenge;
  guidedActiveChallenge = null;
  miniBossClear();
  if (!ch) return;
  let met = false;
  // A challenge restored from a save is DATA - JSON dropped its test function -
  // so the test is always read from CHALLENGE_DEFS by id, never off the object.
  const def = CHALLENGE_DEFS.find(d => d.id === ch.id);
  try { met = !!(def || ch).test(); } catch (e) {}
  if (met) {
    coins += ch.credits;
    updateCoinsUI?.();
    showMessage(`Challenge met · +${ch.credits} credits`, 'var(--gold)');
  } else {
    showMessage('Challenge missed', 'var(--cream-dim)');
  }
}

// ══════════════════════════════════════════════
// TAKE YOUR PICK (r229) - the free pick-of-three
// ══════════════════════════════════════════════
// Three rewards, take one, no charge. It is the BASE reward of the mode: every
// other tile costs a slot AND credits, so this is the one that simply pays.
//
// Drawn through the reward grid's own payload factories, so a Trick offered here
// is the same object, at the same rarity odds, with the same ban filtering as one
// offered anywhere else - and it renders with the shared entity tile.
function guidedPickThreeOffers() {
  const banned = id => (typeof survivalEntityBanned === 'function') && survivalEntityBanned(id);
  const out = [];

  // A Trick. Drawn through pickEntityByRarity (js/luck.js) - the SHARED rarity
  // draw every other offer path uses - so Luck tilts this the same way and the
  // odds are not a second table that can drift.
  const ownedT = new Set((acquiredTricks || []).map(t => t.id));
  const tricks = TRICK_POOL.filter(t => !ownedT.has(t.id) && !banned(t.id));
  const t = tricks.length
    ? ((typeof pickEntityByRarity === 'function' && pickEntityByRarity(tricks, e => e.tier || 'common'))
       || tricks[Math.floor(Math.random() * tricks.length)])
    : null;
  if (t) out.push({ entity:'trick', icon: (typeof trickEmoji === 'function') ? trickEmoji(t) : '★',
    emoji: (typeof trickEmoji === 'function') ? trickEmoji(t) : '★',
    label: t.name, desc: (typeof trickLiveDesc === 'function') ? trickLiveDesc(t) : t.desc,
    tier: t.tier || 'common', rarity: t.tier || 'common',
    apply: () => injectTrickAfterReward(t) });

  // A Sleight. pickSleightByRarity IS global (js/shop.js) and already filters the
  // fixtures and the granted set.
  const sl = (typeof pickSleightByRarity === 'function')
    ? (pickSleightByRarity(1, grantedSleightIds) || [])[0] : null;
  if (sl && !banned(sl.id)) out.push({ entity:'sleight', icon: sl.emoji || '🃏', emoji: sl.emoji || '🃏',
    label: sl.name, desc: sl.desc, tier: sl.rarity || 'common', rarity: sl.rarity || 'common',
    uses: sl.durability === 'infinite' ? '∞' : `${sl.durability}x`,
    apply: () => grantSleight(sl) });

  // A Knack.
  const ownedK = new Set((acquiredKnacks || []).map(k => k.id));
  const knacks = KNACK_POOL.filter(k => !ownedK.has(k.id) && !banned(k.id));
  const k = knacks.length
    ? ((typeof pickEntityByRarity === 'function' && pickEntityByRarity(knacks, e => e.rarity || 'common'))
       || knacks[Math.floor(Math.random() * knacks.length)])
    : null;
  if (k) out.push({ entity:'knack', icon: k.emoji || '♦', emoji: k.emoji || '♦',
    label: k.name, desc: k.desc, tier: k.rarity || 'common', rarity: k.rarity || 'common',
    apply: () => { acquiredKnacks.push({ ...k }); updateKnackList?.(); showMessage(`+ ${k.name}`, 'var(--gold)'); } });

  return out;
}

function guidedOpenPickThree(done) {
  // The reward grid's OWN payload factories (makeTrickPayload and friends) are
  // NOT globals - they are nested inside _generateRewardContent, the same scoping
  // trap `shuffled()` set for the r194 events. Calling them here produced three
  // silent nulls and an empty panel. This draws its own, through the same shared
  // rarity table and the same ban filter.
  const mk = guidedPickThreeOffers();
  if (!mk.length) { done(); return; }

  let el = document.getElementById('guided-pick3');
  if (!el) { el = document.createElement('div'); el.id = 'guided-pick3'; document.body.appendChild(el); }
  el.innerHTML = `<div class="g3-panel"><div class="g3-title">Take one</div><div class="g3-row"></div></div>`;
  const row = el.querySelector('.g3-row');
  mk.forEach(p => {
    const t = document.createElement('div');
    t.className = 'g3-opt';
    t.innerHTML = (typeof entityTileHTML === 'function')
      ? entityTileHTML(p)
      : `<div class="reward-cell entity"><div class="rwd-name">${p.label}</div></div>`;
    t.onclick = () => {
      try { p.apply?.(); } catch (e) {}
      el.classList.remove('show');
      done();
    };
    row.appendChild(t);
    const nm = t.querySelector('.rwd-name');
    if (nm && typeof fitRewardName === 'function') fitRewardName(nm);
  });
  el.classList.add('show');
}

// ══════════════════════════════════════════════
// ROUTING (r234) - the three functions the rest of the mode calls
// ══════════════════════════════════════════════
// These were referenced from four places (guidedChoose x3, interlude.js's guided
// branch, reward-grid.js's finishInterludeRoute) and DEFINED NOWHERE, so Guided
// threw on the first crossroads choice and guidedOpenCrossroads - the screen the
// whole mode is - was never called at all. Written here to the contract the rest
// of the file already assumes.

// A bought stop costs the same step on the difficulty curve a played round would.
// This is the load-bearing rule at the top of this file: without it a player buys
// six stops and meets the boss at level 2 holding a level-8 loadout.
//
// It is deliberately NOT triggerLevelUp. That function also banks the score,
// flushes the deck, resets the round resources and deals a board - none of which
// has happened, because no round was played. Only the two lines that ARE the
// curve are reproduced (level++ and the goal recompute, penalty included, in the
// same order level-up.js applies them), so a bought slot moves the bar and
// nothing else.
function guidedAdvanceCurve() {
  level++;
  roundGoal = goalForLevel(level);
  if (goalPenaltyMult > 1) roundGoal = Math.round(roundGoal * goalPenaltyMult / 50) * 50;
  updateScoreUI?.();
  updateActProgressUI?.();
}

// The single place that decides "another slot, or the boss", so no caller has to
// know how long an act is. Every route through a slot ends here: a played level
// (via startInterlude's guided branch), a bought shop, reward grid, pick-three or
// event (via their own continuations).
function guidedAfterSlot() {
  guidedInStop = false;
  guidedSlot++;
  // nodeInAct is kept in step with the slot count purely for the HUD's pips and
  // the boss sigil - Guided routes off guidedSlot, never off the node index.
  nodeInAct = Math.min(5, Math.round(guidedSlot * 5 / GUIDED_SLOTS_PER_ACT));
  updateActProgressUI?.();

  if (guidedSlot >= GUIDED_SLOTS_PER_ACT) {
    // The act is full. Arm the boss and deal into it - the same two lines the
    // node modes use, so the boss arrives through the ordinary path.
    nodeInAct = 5;
    if (typeof bossesEnabled !== 'function' || bossesEnabled()) forceBossNextRound = true;
    updateActProgressUI?.();
    drainLevelUpQueue();
    return;
  }
  guidedOpenCrossroads();
}

// After the post-boss PRIZE grid: close the quarter's books, advance, and open
// the new act on a LEVEL rather than on the crossroads - an act you have just
// fought a boss to reach should start by letting you play.
//
// rolloverQuarter (js/quarter.js) is the ONE rollover site; a won run never comes
// back from it (actNumber > 3 goes to onGameWin and the run report).
function guidedAfterPrizeGrid() {
  guidedInStop = false;
  guidedSlot = 0;
  guidedBuysThisAct = {};
  guidedLastKind = null;
  guidedSinceLevel = 0;
  guidedOffers = [];
  rolloverQuarter(() => drainLevelUpQueue());
}
