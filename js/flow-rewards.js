// ══════════════════════════════════════════════
// FLOW MULTI-REWARD CHAIN (r325)
// ══════════════════════════════════════════════
// A Flow level-up can pay MORE THAN ONE reward screen. On each goal clear the
// count is rolled as a CHAIN - a chance of a 2nd, then (only if you got the
// 2nd) a chance of a 3rd, and so on to a cap of 5 - and each chance is a GOOD
// roll, so Luck multiplies it (luckChance: 30% at luck 10 is 33%).
//
// The count is announced by a COUNTER CARD over the board: it lands on x1 and
// every further reward CUTS IN - a stinger, a shake, the number bumping - so a
// big roll reads as the game interrupting itself with more. While a chain has
// screens left, the TOP EDGES of the queued chips peek out behind the current
// one, staggered, each in its kind's own colour, so "how much is still coming"
// is on screen without a number.
//
// The chain's screens (kinds): pick3 (the ordinary Survival pick), limits,
// deck (the deck-edit takeover below), sleights, improve. Ordering has three
// phases (owner spec):
//   1. until 2 EXTRA rewards have been rolled this run: the fixed dev-tunable
//      order (pick3, limits, deck, sleights, improve).
//   2. after that: shuffled, with slot 1 the ordinary pick3 at exactly 30%.
//   3. after the 2nd inspection is beaten: fully shuffled.
//
// FLOW ONLY. Survival keeps its single pick (the chain leans on Flow having no
// round clock to burn - five screens between Survival's 2:00 rounds is a wall).
// The post-boss prize grid and any bonus pick bypass the chain entirely.
//
// HOW IT HOOKS IN - three one-line seams, nothing else in the engine changes:
//   - survivalShowPick: `flowrMaybeStart()` takes over the goal-clear pick.
//   - survivalChoose:   `flowrAfterStep()` before its triggerLevelUp tail - a
//     mid-chain choose shows the next screen instead of dealing.
//   - finishSurvival (js/reward-grid.js): same guard, for the rare reward-grid
//     offer taken mid-chain.
// The LEVEL-UP RUNS ONCE, at the chain's end (flowrFinish), with the ordinary
// goal-clear carry-over - every screen before it only grants.

const FLOWR_MAX  = 5;

// ══════════════════════════════════════════════
// THE TABLE (r373) - two flat rolls, no chain, no order
// ══════════════════════════════════════════════
// Owner: *"is there a better way to work out the odds for getting more rewards?
// should it just be a certain percent chance that a given amount happens instead
// of a stacked chance?"* and *"the order shouldn't always be consistent ... we
// still want to favor certain options appearing, but not care about when they
// appear."*
//
// So the r325/r371 machinery is gone - the stacked chain, the fixed phase-1
// ORDER, the three phases, the permutation draw. There are now exactly TWO
// rolls, and both are ordinary weighted tables:
//
//   1. HOW MANY rewards this level-up pays - `counts`, a direct distribution
//      over 1..5 rather than a chance-of-one-more compounded four times.
//   2. WHAT EACH ONE IS - `odds`, rolled INDEPENDENTLY PER SLOT (with
//      replacement), so a kind's number is simply its share of every reward
//      screen in the game and says nothing about where it lands.
//
// A STACKED CHAIN COULD NOT EXPRESS THE OWNER'S TABLE. Under it the count and
// the kind were welded together - a kind's frequency was "the chain reached my
// slot" x "the order put me there" - so "cards on 15% of screens" was not a
// number anyone could set. Here it is the number.
//
// INDEPENDENT PER SLOT MEANS A CHAIN CAN REPEAT A KIND, deliberately: deduping
// would quietly make the printed odds wrong, and two pick-3 screens are two
// different sets of offers. Measured below.
const FLOWR_DEF  = {
  on: true,
  // Relative weight of 1..5 rewards. The owner's table is 40/25/10/5/5, which
  // sums to 85 - so it is NORMALISED rather than taken as percentages, which
  // keeps every ratio they chose and spreads the missing 15 proportionally.
  counts: [40, 25, 10, 5, 5],
  // Share of every reward screen. Sums to 100 as given.
  odds: { pick3: 30, cards: 15, deck: 15, sleights: 15, limits: 10, improve: 10, knacks: 2.5, tricks: 2.5 },
  // THE ONLY THING THAT STILL CARES ABOUT WHEN: the opening levels lean toward
  // LIMITS and switch IMPROVE off, because early on there is almost nothing
  // owned worth improving and a limit compounds for the rest of the run. It is
  // an OVERRIDE MAP over `odds`, not a second table, so a kind absent from it
  // keeps its ordinary share. The two moves cancel (+10 / -10), so the table
  // still sums to 100.
  early: { limits: 20, improve: 0 },
};
const FLOWR_EARLY_LEVELS = 5;              // `early` applies while level <= this
const FLOWR_KEY  = 'lethe.flowRewards.v2'; // OVERRIDES ONLY (the goal-tuner rule)

const FLOWR_KINDS = {
  pick3:    { label: () => 'CHOOSE ONE', short: 'PICK 3',   color: '#5ad4c0' },
  cards:    { label: () => 'CARD PACK',  short: 'CARDS',    color: '#7fd45a' },
  deck:     { label: () => 'DECK EDIT',  short: 'DECK',     color: '#4aa3e0' },
  sleights: { label: () => flowrEntityWord('sleight', true),  short: () => flowrEntityWord('sleight', true), color: '#c07aee' },
  limits:   { label: () => 'LIMITS',     short: 'LIMITS',   color: '#d4a017' },
  improve:  { label: () => 'IMPROVE',    short: 'IMPROVE',  color: '#e0813a' },
  knacks:   { label: () => flowrEntityWord('knack', true),    short: () => flowrEntityWord('knack', true),   color: '#ff6fa5' },
  tricks:   { label: () => flowrEntityWord('trick', true),    short: () => flowrEntityWord('trick', true),   color: '#e8dd54' },
};
const FLOWR_KIND_IDS = Object.keys(FLOWR_KINDS);

// The vocabulary, never a typed word - Settings -> Display -> Wording moves
// Tricks/Sleights/Knacks to Utilities/Vendors/Certs and these headings with it
// (r198). `short` is a function for the same reason `label` is, and it is the
// PLURAL: the tab and the location chip name the same screen, and a screen
// offering three of something reading "NOW TRICK" against a chip reading
// "TRICKS" is two names for one thing.
function flowrEntityWord(type, plural) {
  return (typeof entityLabel === 'function' ? entityLabel(type, plural) : type).toUpperCase();
}
function flowrKindShort(kind) {
  const m = FLOWR_KINDS[kind] || FLOWR_KINDS.pick3;
  return (typeof m.short === 'function') ? m.short() : m.short;
}

// ── Config (dev -> Rewards). Overrides only; an untouched knob tracks FLOWR_DEF. ──
// THE KEY IS v2. The v1 shape held `chances`/`steps`/`weights`, none of which
// exist any more, and a stored order is not translatable into a per-slot odds
// table - so it is left behind rather than half-read (the r183 hbCfg2 -> hbCfg3
// rule: a saved value beats a default, and anyone who had tuned the old chain
// would otherwise keep a table this version cannot honour).
function flowrCfg() {
  let ov = {};
  try { ov = JSON.parse(localStorage.getItem(FLOWR_KEY) || '{}') || {}; } catch (e) {}
  return {
    on: (typeof ov.on === 'boolean') ? ov.on : FLOWR_DEF.on,
    counts: Array.isArray(ov.counts) && ov.counts.length === FLOWR_MAX ? ov.counts : FLOWR_DEF.counts.slice(),
    // Both maps MERGE over the defaults, so an override for one kind survives a
    // new kind landing beside it.
    odds:  flowrMerge(FLOWR_DEF.odds,  ov.odds),
    early: flowrMerge(FLOWR_DEF.early, ov.early),
  };
}
// Merge an override map over the defaults. A stored NULL is how "the owner
// cleared a key the shipped table sets" is written down: without it, blanking
// EARLY's limits or improve could not be saved at all, because the merge would
// hand the default straight back on the next read.
function flowrMerge(def, ov) {
  const out = Object.assign({}, def, (ov && typeof ov === 'object') ? ov : {});
  Object.keys(out).forEach(k => { if (out[k] === null) delete out[k]; });
  return out;
}
function flowrSaveCfg(cfg) {
  const ov = {};
  if (cfg.on !== FLOWR_DEF.on) ov.on = cfg.on;
  if (cfg.counts.join() !== FLOWR_DEF.counts.join()) ov.counts = cfg.counts;
  // A key the default sets and the live map no longer has was CLEARED, and is
  // stored as null (see flowrMerge) rather than silently reverting.
  const diff = (live, def) => {
    const o = {};
    Object.keys(live).forEach(k => { if (live[k] !== def[k]) o[k] = live[k]; });
    Object.keys(def).forEach(k => { if (!(k in live)) o[k] = null; });
    return Object.keys(o).length ? o : null;
  };
  const od = diff(cfg.odds, FLOWR_DEF.odds);   if (od) ov.odds = od;
  const ed = diff(cfg.early, FLOWR_DEF.early); if (ed) ov.early = ed;
  try {
    if (Object.keys(ov).length) localStorage.setItem(FLOWR_KEY, JSON.stringify(ov));
    else localStorage.removeItem(FLOWR_KEY);
  } catch (e) {}
}

// ── Run state ────────────────────────────────────────────────────────────────
let flowrQueue        = null;  // ['pick3','limits',...] for the level-up in progress
let flowrIdx          = 0;
let flowrExtraEarned  = 0;     // extra rewards rolled this RUN - a dev-panel stat. In SAVE_VARS.
let _flowrBypass      = false; // survivalShowPick called BY the chain (its own pick3 step)

function flowrResetRun() { flowrQueue = null; flowrIdx = 0; flowrExtraEarned = 0; flowrClearStack(); }
function flowrChainActive() { return !!flowrQueue; }
// True while a chain screen that is NOT the ordinary pick is up - what stops
// survivalUpdateRerollBtn stamping survival's four actions over this step's row.
function flowrOwnsScreen() { return !!flowrQueue && flowrQueue[flowrIdx] !== 'pick3'; }

// ── The two rolls ────────────────────────────────────────────────────────────
// A weighted pick over parallel key/weight arrays. One helper, both rolls, so
// "how the odds are read" is written once.
function flowrPickWeighted(keys, weights) {
  const total = weights.reduce((s, x) => s + Math.max(0, x || 0), 0);
  if (!(total > 0)) return keys[0];
  let r = Math.random() * total;
  for (let i = 0; i < keys.length; i++) {
    r -= Math.max(0, weights[i] || 0);
    if (r <= 0) return keys[i];
  }
  return keys[keys.length - 1];
}

// HOW MANY reward screens this level-up pays. A direct distribution over 1..5,
// NORMALISED - the shipped row sums to 85, and dividing by the real total keeps
// every ratio the owner set instead of inventing where the missing 15 goes.
//
// LUCK LEANS IT UP rather than multiplying a chance, because there is no chance
// left to multiply: every count above 1 is scaled by luckScale(), which is the
// shape flowrQtyRoll in this same file already uses for the deck editor's
// quantity. At 0 luck it is exactly the printed table.
function flowrRollCount() {
  const w = flowrCfg().counts.slice(0, FLOWR_MAX);
  const ls = (typeof luckScale === 'function') ? luckScale() : 1;
  const keys = w.map((_, i) => i + 1);
  return flowrPickWeighted(keys, w.map((v, i) => Math.max(0, v || 0) * (i > 0 ? ls : 1)));
}

// True while the opening levels' override map applies.
function flowrEarly() {
  return (typeof level !== 'undefined' ? level : 1) <= FLOWR_EARLY_LEVELS;
}

// The live odds table: the ordinary one, with `early` laid over it while
// flowrEarly(). A kind absent from `early` keeps its ordinary share.
function flowrOddsNow() {
  const cfg = flowrCfg();
  const o = Object.assign({}, cfg.odds);
  if (flowrEarly()) Object.assign(o, cfg.early);
  return o;
}

// WHAT ONE SLOT IS. Rolled independently of every other slot, so a kind's
// weight is its share of reward screens and nothing about ordering.
function flowrRollKind(odds) {
  const keys = FLOWR_KIND_IDS.filter(k => (odds[k] || 0) > 0);
  if (!keys.length) return 'pick3';
  return flowrPickWeighted(keys, keys.map(k => odds[k]));
}

// A kind with nothing to offer substitutes pick3 rather than showing an empty
// screen (the reward-grid "an event you cannot use is never offered" rule).
function flowrKindViable(kind) {
  try {
    if (kind === 'limits')   return LIMITS_DEF.some(d => limits[d.id].current < limits[d.id].max);
    if (kind === 'sleights') {
      const granted = _grantedSleightSet();
      return SLEIGHT_POOL.some(j => !survivalEntityBanned(j.id) && !granted.has(j.id) && sleightOfferable(j));
    }
    if (kind === 'improve')  return ['trick', 'knack', 'sleight'].some(t => ownedImprovable(t).length);
    if (kind === 'deck')     return true; // the board always holds ordinary cards
    if (kind === 'cards')    return flowrPackRanks().length > 0;
    if (kind === 'knacks')   return survivalBuildPools().knack.length > 0;
    // The tray is a HARD CAP (r277) - a Trick you have no room for is REFUSED,
    // so a whole screen of them with a full tray is a screen you cannot spend.
    if (kind === 'tricks')   return !(typeof trickTrayFull === 'function' && trickTrayFull())
                                 && flowrTrickPool().length > 0;
  } catch (e) {}
  return kind === 'pick3';
}

// ── Entry: called from the top of survivalShowPick (goal-clear only) ─────────
function flowrMaybeStart() {
  if (_flowrBypass) return false;
  if (typeof flowActive !== 'function' || !flowActive()) return false;
  if (!flowrCfg().on) return false;
  if (flowrQueue) return false;
  const n = flowrRollCount();
  // EVERY SLOT IS ROLLED ON ITS OWN, with replacement, so a chain can legitimately
  // repeat a kind - see the table's header. A kind with nothing to offer falls
  // back to pick3 rather than showing an empty screen.
  const odds = flowrOddsNow();
  const queue = [];
  for (let i = 0; i < n; i++) {
    const k = flowrRollKind(odds);
    queue.push(flowrKindViable(k) ? k : 'pick3');
  }
  // One reward and it is the ordinary pick: today's behaviour, no ceremony.
  if (n <= 1 && queue[0] === 'pick3') return false;
  flowrQueue = queue;
  flowrIdx = 0;
  // The COUNT is banked synchronously - it is a run stat read by the dev panel
  // and must not wait on an animation - but nothing is SHOWN until the board is
  // still. See flowrWhenBoardStill.
  if (n > 1) flowrExtraEarned += n - 1;
  flowrWhenBoardStill(() => {
    if (!flowrQueue) return;                 // the run was abandoned while we waited
    if (n > 1) flowrPlayCounter(n, () => flowrShowStep());
    else flowrShowStep();
  });
  return true;
}

// ── Wait for the win finale to let go of the board ──────────────────────────
// THE COUNT REVEAL MUST NOT RUN UNDER THE BLAST (r371). survivalShowPick is
// called from the goal dance the moment the winning cards have flown into the
// preview - about 3.3s into the finale - and the r280 blast is still in flight
// for another ~1.3s at the default 2x (and ~3.6s at 1x): the surrounding cards
// are flung to the corners, over the HUD, and on their way home. The counter
// card landed in the middle of that, so the one beat the whole chain is built
// around was competing with fifteen cards in flight. Measured at 1440x820: the
// counter opened at t=3366ms against a blast that settled at t=4627ms.
//
// Waiting costs nothing anyone can feel, because the TALLY is running through
// it - the score climb, the chips and the particles are all in the left column,
// which is where the player is looking while the board comes home. At high
// scoring speeds the blast is already over by 3.3s and there is no wait at all.
//
// dncSettleBlast() is the ONE release point - it runs when the animations
// finish, on a fast-forward and on an abort (js/score-dance.js) - so polling
// dncBlast cannot outlive the blast. The cap is insurance against an animation
// that never resolves, not a timeout any real path should reach.
const FLOWR_BOARD_WAIT_MAX = 12000;
function flowrWhenBoardStill(cb) {
  // `dncBlast` is a top-level `let` in another file: same global scope, but a
  // read before that file has been evaluated is a temporal-dead-zone THROW
  // rather than `undefined` (the r228 / r296 trap), so it is guarded.
  const still = () => {
    try { return !(typeof dncBlast !== 'undefined' && dncBlast && dncBlast.length); }
    catch (e) { return true; }
  };
  if (still()) { cb(); return; }
  const t0 = Date.now();
  const tick = () => {
    if (still() || Date.now() - t0 > FLOWR_BOARD_WAIT_MAX) { cb(); return; }
    setTimeout(tick, 60);
  };
  setTimeout(tick, 60);
}

function flowrShowStep() {
  if (!flowrQueue) return;
  animating = false;
  if (typeof trickSelectionPhase !== 'undefined') trickSelectionPhase = false;
  const kind = flowrQueue[flowrIdx];
  flowrRenderStack();
  if (kind === 'pick3') {
    _flowrBypass = true;
    try { survivalShowPick(false); } finally { _flowrBypass = false; }
    return;
  }
  if (kind === 'deck')  { flowrShowDeckPick(); return; }
  if (kind === 'cards') { flowrShowCardsPick(); return; }
  flowrShowEntityStep(kind);
}

// Called after ANY chain screen resolves (survivalChoose's tail, finishSurvival,
// and this file's own onChoose handlers). True = the chain took it - the caller
// must NOT run its own level-up.
function flowrAfterStep() {
  if (!flowrQueue) return false;
  flowrIdx++;
  flowrRenderStack();
  if (flowrIdx < flowrQueue.length) { setTimeout(() => flowrShowStep(), 380); return true; }
  flowrFinish();
  return true;
}

function flowrFinish() {
  flowrQueue = null; flowrIdx = 0;
  flowrClearStack();
  // The chain only ever starts on a GOAL CLEAR, so the level-up carries the
  // score overflow and pays the time credits exactly as a single pick would.
  survivalGridPickCarry = false;
  survivalBonusPick = false;
  survivalSkipCarryover = false;
  triggerLevelUp();
  survivalSkipCarryover = false;
}

// ══════════════════════════════════════════════
// THE COUNTER CARD (option A) - "hold up, there's more"
// ══════════════════════════════════════════════
function flowrPlayCounter(n, done) {
  const host = document.getElementById('grid-slot') || document.getElementById('stage') || document.body;
  document.getElementById('flowr-counter')?.remove();
  const el = document.createElement('div');
  el.id = 'flowr-counter';
  el.innerHTML = `<div class="fc-kick">GOAL CLEARED</div><div class="fc-num">&times;1</div><div class="fc-sub">REWARD</div>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  try { sfxLevelUp?.(); } catch (e) {}
  let k = 1;
  const num = el.querySelector('.fc-num'), sub = el.querySelector('.fc-sub');
  const bump = () => {
    k++;
    num.textContent = '×' + k;
    sub.textContent = 'REWARDS';
    // restart the pop (the r277 pulse rule: remove, reflow, re-add)
    el.classList.remove('fc-pop'); void el.offsetWidth; el.classList.add('fc-pop');
    try { (k >= 4 ? sfxWinExplode : sfxSuccess)?.(); } catch (e) { try { sfxSuccess?.(); } catch (e2) {} }
    if (k < n) setTimeout(bump, 620);
    else setTimeout(finish, 850);
  };
  const finish = () => {
    el.classList.remove('show');
    setTimeout(() => { el.remove(); done && done(); }, 260);
  };
  if (n > 1) setTimeout(bump, 700);
  else setTimeout(finish, 900);
}

// ══════════════════════════════════════════════
// THE STACK (option C) - queued chips peeking out behind the current one
// ══════════════════════════════════════════════
function flowrRenderStack() {
  const host = document.getElementById('grid-slot');
  document.getElementById('flowr-stack')?.remove();
  document.getElementById('flowr-bg')?.remove();
  if (!host || !flowrQueue) return;
  const rest = flowrQueue.slice(flowrIdx);
  const cur  = FLOWR_KINDS[rest[0]] || FLOWR_KINDS.pick3;

  // ── THE PANEL (r373) ──
  // Owner: *"if we're going to use these title cards, then the background of the
  // whole pick three should match the color of the title card. so not the
  // options themselves, but the negative space around each of the options and
  // buttons. that way it doesn't look like the title is jutting into the
  // option."*
  //
  // The chips were already drawn as TABS - `border-radius: 7px 7px 0 0` and
  // `border-bottom: none` - and there was no panel for them to be tabs ON, so
  // the current one read as a label stuck to the top of the first option tile.
  // This is that panel: the board's own box, padded out, washed in the current
  // step's colour, behind every tile and button.
  //
  // IT IS SIZED IN PURE CSS FROM `--grid-w` / `--grid-h` (js/grid-metrics.js,
  // published on documentElement) and centred, because `#grid` is centred in
  // `#grid-slot` on BOTH axes - measured at 1440x820 and 420x820. So there is no
  // JS measurement and no resize handler, the same way `#sel-count` is placed
  // (r216). It is a SIBLING of `#grid`, not a child: the pick empties `#grid` on
  // every render and a child would be destroyed with the tiles.
  const bg = document.createElement('div');
  bg.id = 'flowr-bg';
  bg.style.setProperty('--fc', cur.color);
  host.appendChild(bg);

  // THE CURRENT TAB IS THE TITLE CARD, so it is drawn even when it is the only
  // one: a one-step chain (a lone CARD PACK, say) would otherwise get a coloured
  // panel with nothing naming it. Only the QUEUE behind it is conditional.
  const el = document.createElement('div');
  el.id = 'flowr-stack';
  el.style.setProperty('--fst-n', rest.length);
  // Furthest-back first, so DOM order is paint order (the rewind-ghost rule):
  // the current step's chip goes in last and sits lowest and on top.
  // ONLY THE CURRENT CHIP IS LABELLED (r371). The chips are stacked a few px
  // apart and each is far taller than that band, so an 8px label on a queued one
  // came out cut through the middle of its own glyphs - a rendering fault rather
  // than a card peeking out from behind another. The colour is what the queued
  // chips were always meant to carry ("how much is still coming is on screen
  // without a number").
  el.innerHTML = rest.slice().reverse().map((kind, i) => {
    const meta = FLOWR_KINDS[kind] || FLOWR_KINDS.pick3;
    const depth = rest.length - 1 - i;              // 0 = current
    return `<div class="fst-chip" style="--fst-c:${meta.color}; --fst-d:${depth}">`
      + (depth === 0 ? `<span>NOW ${flowrKindShort(kind)}</span>` : '') + `</div>`;
  }).join('');
  host.appendChild(el);
}
function flowrClearStack() {
  document.getElementById('flowr-stack')?.remove();
  document.getElementById('flowr-bg')?.remove();
}

// ══════════════════════════════════════════════
// ENTITY STEPS - limits / sleights / improve, on the shared pick board
// ══════════════════════════════════════════════
let _flowrStepOffers = null;

// RARE OR BETTER. The owner asked for "uncommon or better"; this game's tiers
// are common / rare / epic / legendary (r197 merged mythic into legendary and
// there has never been an uncommon), so the rung above common is RARE.
// SURVIVAL_GRID_OFFER is excluded: it rides the trick pool for its odds and is
// not a Trick (js/survival.js says so in as many words).
function flowrTrickPool() {
  try {
    return survivalBuildPools().trick.filter(t =>
      !t._gridPick && (typeof tierId === 'function' ? tierId(t.tier) : t.tier) !== 'common');
  } catch (e) { return []; }
}

// Three distinct entries of a pool, drawn through the SHARED rarity table so
// Luck tilts these exactly as it tilts every other offer (js/luck.js). A flat
// pool[random] here would silently opt out of both.
function flowrDrawThree(pool, tierOf) {
  const out = [], used = new Set();
  for (let i = 0; i < 3 && used.size < pool.length; i++) {
    const avail = pool.filter(e => !used.has(e.id));
    const pick = (typeof pickEntityByRarity === 'function' ? pickEntityByRarity(avail, tierOf) : null) || avail[0];
    if (!pick) break;
    used.add(pick.id);
    out.push(pick);
  }
  return out;
}

function flowrBuildOffers(kind) {
  const out = [];
  try {
    if (kind === 'limits') {
      const pool = LIMITS_DEF.filter(d => limits[d.id].current < limits[d.id].max);
      shuffle(pool.slice()).slice(0, 3).forEach(d => out.push(survivalMakeOption('limit', d)));
    } else if (kind === 'sleights') {
      const granted = _grantedSleightSet();
      const pool = SLEIGHT_POOL.filter(j => !survivalEntityBanned(j.id) && !granted.has(j.id) && sleightOfferable(j));
      const used = new Set();
      for (let i = 0; i < 3 && used.size < pool.length; i++) {
        const avail = pool.filter(j => !used.has(j.id));
        const pick = pickEntityByRarity(avail, j => j.rarity || 'common') || avail[0];
        if (!pick) break;
        used.add(pick.id);
        out.push(survivalMakeOption('sleight', pick));
      }
    } else if (kind === 'knacks') {
      flowrDrawThree(survivalBuildPools().knack, k => k.rarity || 'common')
        .forEach(k => out.push(survivalMakeOption('knack', k)));
    } else if (kind === 'tricks') {
      flowrDrawThree(flowrTrickPool(), t => t.tier || 'rare')
        .forEach(t => out.push(survivalMakeOption('trick', t)));
    } else if (kind === 'improve') {
      // Owned, improvable, all three types - the same draw the improve reward
      // tiles use, so Luck tilts which of your own things is offered.
      const pool = [];
      ['trick', 'knack', 'sleight'].forEach(t => ownedImprovable(t).forEach(e => pool.push({ ...e, etype: t })));
      const used = new Set();
      for (let i = 0; i < 3 && used.size < pool.length; i++) {
        const avail = pool.filter(e => !used.has(e.id));
        const pick = pickEntityByRarity(avail, e => e.rarity || 'common') || avail[0];
        if (!pick) break;
        used.add(pick.id);
        const delta = (typeof improveDeltaFor === 'function' ? improveDeltaFor(pick.id) : null)
                   || (typeof improvePreview === 'function' ? (improvePreview(pick.id) || {}).after : '') || '';
        out.push({ type: 'improve', id: pick.id, etype: pick.etype, name: pick.name,
                   icon: '⬆', desc: delta, rar: pick.rarity,
                   tag: 'v' + ((typeof entityTierOf === 'function' ? entityTierOf(pick.id) : 0) + 1) + '.0' });
      }
    }
  } catch (e) {}
  return out.filter(Boolean);
}

function flowrShowEntityStep(kind) {
  const offers = flowrBuildOffers(kind);
  if (!offers.length) { flowrAfterStep(); return; }
  _flowrStepOffers = offers;
  if (typeof pickRerollsNewScreen === 'function') pickRerollsNewScreen(); // price ladder restarts per screen
  const meta = FLOWR_KINDS[kind];
  openGridPick({
    title: meta.label(),
    tone: 'reward',
    offers: offers.map(o => ({
      entity: o.type === 'improve' ? o.etype : o.type,   // improve shows the real owned object
      id: o.id, emoji: o.icon, icon: o.icon,
      label: o.name, desc: o.desc, rarity: o.rar, tag: o.tag,
    })),
    actions: [pickRerollAction(() => {
      const fresh = flowrBuildOffers(kind);
      if (fresh.length) { _flowrStepOffers = fresh; gridPickRefresh(fresh.map(o => ({
        entity: o.type === 'improve' ? o.etype : o.type, id: o.id, emoji: o.icon, icon: o.icon,
        label: o.name, desc: o.desc, rarity: o.rar, tag: o.tag })), null); }
    })],
    onChoose: (i) => { flowrGrantOffer(_flowrStepOffers[i]); _flowrStepOffers = null; flowrAfterStep(); },
    onSkip: () => { _flowrStepOffers = null; rainCheckPay(); flowrAfterStep(); },
  });
  try { sfxShopOpen?.(); } catch (e) {}
}

function flowrGrantOffer(opt) {
  if (!opt) return;
  if (opt.type === 'improve') {
    const tier = improveEntity(opt.id);
    if (typeof syncOwnedEntityDescs === 'function') syncOwnedEntityDescs();
    showMessage(`⬆ ${opt.name} improved to v${tier}.0`, '#e0813a');
    try { sfxSuccess?.(); } catch (e) {}
    return;
  }
  survivalGrant(opt);   // limit / sleight rows are survival's own option shape
}

// ══════════════════════════════════════════════
// DECK EDIT - the takeover step
// ══════════════════════════════════════════════
// A pick of three drawn from the op table below; choosing one hands you the
// REAL BOARD with the HUD swapped to a DECK EDIT chip and a banner over the
// slot, so it reads as an editor and not the game. Every op works through ONE
// SELECTED CARD: the adjacency ops fire on its orthogonal neighbours, the buff
// ops on up to 3 cards you pick yourself.
//
// The buff quantity is rolled AT COMMIT, weighted low (the owner's .43/.36/.21),
// and revealed one card at a time - a selected card flashes green with its
// number when the buff lands on it and grey when it passes. Selecting fewer
// cards concentrates the roll (a rolled 3 clamps to what you selected);
// deliberately NOT explained anywhere in-game (owner's call).

const FLOWR_DECK_OPS = [
  { id: 'suit', adj: true, max: 4, luckMax: true, icon: '♠', name: 'Suit Spread',
    desc: 'Select a card. Up to 4 adjacent cards change to its suit.' },
  { id: 'rank', adj: true, max: 4, luckMax: true, icon: '⇅', name: 'Rank Pull',
    desc: 'Select a card. Up to 4 adjacent cards move one rank toward it.' },
  { id: 'del', adj: true, max: 3, icon: '✂', name: 'Cut',
    desc: 'Select a card. 1-3 adjacent cards leave the run for good.' },
  { id: 'copy', adj: true, max: 3, icon: '⧉', name: 'Stamp',
    desc: 'Select a card. 1-3 adjacent cards become copies of it.' },
  { id: 'pips',   buff: { key: 'pips',   range: [10, 15, 1],    word: 'pips'   }, icon: '➕', name: 'Pip Buff',
    desc: 'Pick up to 3 cards. Buffed cards score +10 to +15 pips.' },
  { id: 'mult',   buff: { key: 'mult',   range: [8, 12, 1],     word: 'mult'   }, icon: '✖', name: 'Mult Buff',
    desc: 'Pick up to 3 cards. Buffed cards score +8 to +12 mult.' },
  { id: 'focus',  buff: { key: 'focus',  range: [1, 2, 1],      word: 'Focus'  }, icon: '◉', name: 'Focus Buff',
    desc: 'Pick up to 3 cards. Buffed cards grant +1 to +2 Focus when they score.' },
  { id: 'time',   buff: { key: 'time',   range: [1, 5, 1],      word: 's'      }, icon: '⏱', name: 'Time Buff',
    desc: 'Pick up to 3 cards. Buffed cards put +1 to +5 seconds back on the clock when they score.' },
  { id: 'replay', buff: { key: 'retrig', range: [1, 2, 1],      word: 'replay' }, icon: '↻', name: 'Replay Buff',
    desc: 'Pick up to 3 cards. Buffed cards replay +1 to +2 times.' },
  { id: 'xmult',  buff: { key: 'xmult',  range: [1.5, 3, 0.5],  word: '× mult', x: true }, icon: '⨉', name: '×Mult Buff',
    desc: 'Pick up to 3 cards. Buffed cards multiply the mult by ×1.5 to ×3.' },
  { id: 'xpips',  buff: { key: 'xpips',  range: [1.25, 2, 0.25], word: '× pips', x: true }, icon: '∗', name: '×Pips Buff',
    desc: 'Pick up to 3 cards. Buffed cards multiply their pips by ×1.25 to ×2.' },
];

let _flowrDeckOp = null, _flowrDeckSel = [], _flowrDeckBusy = false;
let _flowrPlayHTML = null;
// render()'s button guard asks this (the r247 takeover rule): while the deck
// edit is up, PLAY is the APPLY button and render must not write over it.
function flowrDeckActive() { return !!_flowrDeckOp; }

function flowrShowDeckPick() {
  const ops = shuffle(FLOWR_DECK_OPS.slice()).slice(0, 3);
  openGridPick({
    title: 'DECK EDIT', tone: 'reward',
    offers: ops.map(op => ({ entity: 'deckop', id: op.id, icon: op.icon, emoji: op.icon,
                             label: op.name, desc: op.desc, rarity: 'rare', tag: 'DECK' })),
    actions: [],
    onChoose: (i) => flowrDeckBegin(ops[i]),
    onSkip: () => { rainCheckPay(); flowrAfterStep(); },
  });
}

function flowrDeckBegin(op) {
  _flowrDeckOp = op;
  _flowrDeckSel = [];
  _flowrDeckBusy = false;
  gameTimerPaused = true;
  if (typeof enterGridScreenHud === 'function') enterGridScreenHud('DECK EDIT', 'reward');
  document.body.classList.add('flowr-deck');
  // The cards come back. In Flow the goal hand's cards are still in gridData
  // (only their DOM left with the dance), so the FULL board is editable - those
  // cards are real deck cards and a buff on one persists through the deal.
  try { render(); } catch (e) {}
  flowrDeckBanner();
  // The board's own action column is the editor's: PLAY becomes APPLY for the
  // buff ops (the shop's BUY pattern - save the markup, restore on exit).
  // render()'s button guard skips its disabled writes while flowrDeckActive().
  const play = document.getElementById('btn-play');
  if (play) {
    if (_flowrPlayHTML === null) _flowrPlayHTML = play.innerHTML;
    play.classList.add('reward-buy');
    play.innerHTML = 'A<br>P<br>P<br>L<br>Y';
    play.disabled = true;   // buff ops enable it once a card is picked
  }
  const disc = document.getElementById('btn-discard');
  if (disc) disc.disabled = true;
  const gridEl = document.getElementById('grid');
  // CAPTURE PHASE, the squares rule: input.js binds its own pointerdown here and
  // a tap means "select into a hand", which this screen does not have.
  gridEl?.addEventListener('pointerdown', flowrDeckTap, true);
}

// The APPLY press: a capture listener on the play button, the Poker Squares
// pattern. The tricks-ui playHand listener on the same button no-ops with
// nothing selected, so it cannot double-fire underneath.
document.getElementById('btn-play')?.addEventListener('click', e => {
  if (!_flowrDeckOp || !_flowrDeckOp.buff) return;
  e.stopPropagation();
  flowrBuffConfirm();
}, true);

// The banner sits OVER THE CHIPS ROW, never over the board (owner's call - it
// was covering the top cards). It mounts on #stage: in landscape it takes the
// left column's chip band (the .score-subbox row is display:none on every
// grid-screen and #screen-location says DECK EDIT, so the space is free), and
// in portrait the top-bar band. CSS owns the placement; stage px throughout.
function flowrDeckBanner() {
  const host = document.getElementById('stage') || document.body;
  document.getElementById('flowr-banner')?.remove();
  const op = _flowrDeckOp;
  const el = document.createElement('div');
  el.id = 'flowr-banner';
  if (op.buff) {
    el.innerHTML = `<b>${op.name}</b><span id="fb-note">Pick up to 3 cards, then press APPLY · <i id="fb-count">0/3</i></span>`;
  } else {
    el.innerHTML = `<b>${op.name}</b><span id="fb-note">${op.desc.split('.')[0]}.</span>`;
  }
  host.appendChild(el);
}

function flowrDeckFindCell(el) {
  const id = el?.dataset?.cardId;
  if (id == null) return null;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (cd && String(cd._id) === String(id)) return [r, c, cd];
  }
  return null;
}

function flowrDeckOrdinary(cd) {
  return !!cd && !!cd.rank && !cd._isSleight && !cd._isStone && !cd.trick && !cd.challengeCard;
}

function flowrDeckTap(e) {
  // The whole board is the editor's while this listener exists: every tap stops
  // here, so input.js's select/swap gestures can never fire underneath.
  e.stopPropagation(); e.preventDefault();
  if (_flowrDeckBusy) return;
  const cardEl = e.target.closest('[data-card-id]');
  if (!cardEl) return;
  const hit = flowrDeckFindCell(cardEl);
  if (!hit) return;
  const [r, c, cd] = hit;
  if (!flowrDeckOrdinary(cd)) { showMessage('Pick an ordinary card', '#e05a5a'); return; }
  const op = _flowrDeckOp;
  if (op.adj) { flowrAdjApply(r, c, cd); return; }
  // buff op: toggle selection, cap 3
  const i = _flowrDeckSel.findIndex(s => s.id === String(cd._id));
  if (i >= 0) { _flowrDeckSel.splice(i, 1); cardEl.classList.remove('flowr-sel'); }
  else if (_flowrDeckSel.length < 3) { _flowrDeckSel.push({ id: String(cd._id), r, c, cd, el: cardEl }); cardEl.classList.add('flowr-sel'); }
  const n = _flowrDeckSel.length;
  const cnt = document.getElementById('fb-count'); if (cnt) cnt.textContent = n + '/3';
  const btn = document.getElementById('btn-play'); if (btn) btn.disabled = n === 0;
  try { sfxCardSelect?.(); } catch (e2) {}
}

// Weighted-low roll over [1..max]: the owner's .43/.36/.21 at max 3, the same
// descending-linear shape at other maxes. Luck multiplies the weight of every
// count above 1, so a lucky run leans higher without a new formula.
function flowrQtyRoll(max) {
  const ls = (typeof luckScale === 'function') ? luckScale() : 1;
  const base3 = [0.43, 0.36, 0.21];
  const w = [];
  for (let k = 1; k <= max; k++) {
    let wk = (max === 3) ? base3[k - 1] : (max - k + 1);
    if (k > 1) wk *= ls;
    w.push(wk);
  }
  const total = w.reduce((s, x) => s + x, 0);
  let rng = Math.random() * total;
  for (let k = 0; k < w.length; k++) { rng -= w[k]; if (rng <= 0) return k + 1; }
  return max;
}

// Weighted-low roll over an inclusive numeric range with a step.
function flowrValRoll(range) {
  const [lo, hi, step] = range;
  const vals = [];
  for (let v = lo; v <= hi + 1e-9; v += step) vals.push(Math.round(v * 100) / 100);
  const w = vals.map((_, i) => vals.length - i);        // descending linear
  const total = w.reduce((s, x) => s + x, 0);
  let rng = Math.random() * total;
  for (let i = 0; i < vals.length; i++) { rng -= w[i]; if (rng <= 0) return vals[i]; }
  return vals[vals.length - 1];
}

// ── Adjacency ops: fire the moment a card is selected ────────────────────────
function flowrAdjApply(r, c, sel) {
  const op = _flowrDeckOp;
  const neigh = (typeof getNeighborsOrtho === 'function' ? getNeighborsOrtho(r, c) : [])
    .filter(([nr, nc]) => flowrDeckOrdinary(gridData[nr]?.[nc])
      && !(typeof isCellBlocked === 'function' && isCellBlocked(nr, nc)));
  if (!neigh.length) { showMessage('No ordinary card next to that one', '#e05a5a'); return; }
  _flowrDeckBusy = true;
  let count = flowrQtyRoll(op.max);
  count = Math.min(neigh.length, count);
  const targets = shuffle(neigh.slice()).slice(0, count);
  const gridEl = document.getElementById('grid');
  const elOf = (rr, cc) => {
    const cd = gridData[rr]?.[cc];
    return cd ? gridEl?.querySelector(`[data-card-id="${cd._id}"]`) : null;
  };
  elOf(r, c)?.classList.add('flowr-src');
  const summaries = [];
  targets.forEach(([tr, tc], i) => {
    setTimeout(() => {
      const t = gridData[tr]?.[tc];
      const tEl = elOf(tr, tc);
      tEl?.classList.add('flowr-hit');
      try { sfxCardPop?.(); } catch (e) {}
      if (!t) return;
      if (op.id === 'suit') { t.suit = sel.suit; summaries.push('suit'); }
      else if (op.id === 'rank') {
        const order = (typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS) ? ACTIVE_RANKS : RANKS;
        const si = order.indexOf(sel.rank), ti = order.indexOf(t.rank);
        if (si >= 0 && ti >= 0 && si !== ti) t.rank = order[ti + (si > ti ? 1 : -1)];
      }
      else if (op.id === 'copy') { t.rank = sel.rank; t.suit = sel.suit; }
      else if (op.id === 'del') {
        if (typeof expectedDeckTotal !== 'undefined') expectedDeckTotal--;
        gridData[tr][tc] = (typeof drawCard === 'function' ? drawCard() : null) || null;
      }
    }, 380 * (i + 1));
  });
  setTimeout(() => {
    try { render(); } catch (e) {}
    if (typeof updateDeckHud === 'function') updateDeckHud();
    showMessage(`${op.icon} ${op.name}: ${count} card${count === 1 ? '' : 's'}`, '#4aa3e0');
    flowrDeckEnd();
  }, 380 * (targets.length + 1) + 420);
}

// ── Buff ops: selection then APPLY, with a one-by-one reveal ─────────────────
function flowrBuffConfirm() {
  if (_flowrDeckBusy || !_flowrDeckSel.length) return;
  _flowrDeckBusy = true;
  const op = _flowrDeckOp, b = op.buff;
  const q = Math.min(_flowrDeckSel.length, flowrQtyRoll(3));
  const winners = new Set(shuffle(_flowrDeckSel.slice()).slice(0, q).map(s => s.id));
  const v = flowrValRoll(b.range);
  const label = flowrBuffLabel(b, v);   // shared with the card packs - one wording
  const _pb = document.getElementById('btn-play'); if (_pb) _pb.disabled = true;
  _flowrDeckSel.forEach((s, i) => {
    setTimeout(() => {
      const won = winners.has(s.id);
      s.el?.classList.remove('flowr-sel');
      s.el?.classList.add(won ? 'flowr-won' : 'flowr-miss');
      if (won) {
        enhanceCardKey(cardId(s.cd), { [b.key]: v });
        try { sfxCoin?.(); } catch (e2) {}
      } else { try { sfxNoSwaps?.(); } catch (e2) {} }
    }, 480 * (i + 1));
  });
  setTimeout(() => {
    try { render(); } catch (e) {}
    showMessage(`${op.icon} ${label} on ${q} card${q === 1 ? '' : 's'}`, '#5ad4c0');
    flowrDeckEnd();
  }, 480 * (_flowrDeckSel.length + 1) + 420);
}

function flowrDeckEnd() {
  document.getElementById('grid')?.removeEventListener('pointerdown', flowrDeckTap, true);
  document.getElementById('flowr-banner')?.remove();
  document.body.classList.remove('flowr-deck');
  // Hand the play button back (the exitShopGridButtons shape); render() paints
  // the real disabled state on the next repaint.
  const play = document.getElementById('btn-play');
  if (play && _flowrPlayHTML !== null) {
    play.classList.remove('reward-buy');
    play.innerHTML = _flowrPlayHTML;
    play.disabled = true;
  }
  document.querySelectorAll('.flowr-sel, .flowr-src, .flowr-hit, .flowr-won, .flowr-miss')
    .forEach(el => el.classList.remove('flowr-sel', 'flowr-src', 'flowr-hit', 'flowr-won', 'flowr-miss'));
  if (typeof exitGridScreenHud === 'function') exitGridScreenHud();
  _flowrDeckOp = null; _flowrDeckSel = []; _flowrDeckBusy = false;
  flowrAfterStep();
}

// ══════════════════════════════════════════════
// CARD PACK (r371) - three cards that JOIN the deck
// ══════════════════════════════════════════════
// Owner: "an option for a level up that offers you a pick three between three
// groups of cards. the choices should each contain 3 cards, adjacent in rank,
// matching in suit, and each group has a different buff on it already. in the
// late game i was running out of cards."
//
// So each offer is a RUN OF THREE IN ONE SUIT, already carrying one buff, and
// taking it puts those three cards into the draw pile for good. It is the only
// reward in the game that makes the deck BIGGER, which is the point: every
// other card reward edits or removes what you already hold, and a long Flow run
// thins itself out through Cut, Monopoly and the card states until there is not
// enough deck left to fill a grown board.
//
// THE THREE CARDS ARE A RUN IN A SUIT, so a pack is not just deck size - it is
// a Straight Flush of 3 posted straight into the deck, and the flush OVERLAY
// (r199) pays it inside any hand those cards land in.
//
// THE BUFF TABLE IS THE DECK EDITOR'S (FLOWR_DECK_OPS). One table, two
// consumers - r151's rule, after a quoted cost and a charged cost drifted
// apart. A retune there moves both, and a new buff op is offered by both with
// no second edit.

const FLOWR_PACK_SIZE   = 3;   // cards per pack - also the run length
const FLOWR_PACK_OFFERS = 3;

// +5 pips / x1.5 mult / +2s - the one place a buff op's VALUE is put into
// words, read by the pack tiles AND by the deck editor's own reveal.
function flowrBuffLabel(b, v) {
  if (!b) return '';
  if (b.x) return `×${v} ${String(b.word).replace('× ', '')}`;
  return `+${v}${b.word === 's' ? 's' : ' ' + b.word}`;
}

// The ranks and suits a pack may be built from are the ones THE RUN'S DECK
// ACTUALLY HOLDS, never ACTIVE_RANKS x ACTIVE_SUITS. That is r211's Card Market
// rule: inventing a face is the one way to put a card into play that the mode
// does not have - Spectrum has no courts, the Spectrum tuner can switch a value
// off, and the r318 weighted deck ships nine ranks of thirteen, where an
// off-ladder rank is a card that can never be part of a run (rankRunVals
// returns [] for it).
// A WILD IS NOT A FACE. everyDeckCard() returns wilds - they are ordinary deck
// cards carrying WILD_RANK / WILD_SUIT - and WILD_SUIT is "a non-suit,
// deliberately" (js/data/cards.js), absent from ACTIVE_SUITS. Left in, the
// builder offered a pack of A✳ 2✳ 3✳: three ORDINARY cards wearing the wild's
// suit, which is in no flush and is a suit the mode does not have. Measured on
// a real Flow board before the fix.
//
// isWildCard() is tested EXPLICITLY and the suits are then intersected with
// ACTIVE_SUITS, which is the rule that file states in as many words: r164
// relied on the wild's absence from ACTIVE_SUITS alone and r165 had to undo it,
// so both flush sites test the predicate as well. Same here.
function flowrPackFaces() {
  const ranks = new Set(), suits = new Set();
  const legal = new Set((typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS) ? ACTIVE_SUITS : SUITS);
  try {
    (typeof everyDeckCard === 'function' ? everyDeckCard() : []).forEach(cd => {
      if (!cd || !cd.rank) return;
      if (typeof isWildCard === 'function' && isWildCard(cd)) return;
      ranks.add(cd.rank);
      const s = (typeof cardColorSuit === 'function') ? cardColorSuit(cd) : cd.suit;
      if (s && legal.has(s)) suits.add(s);
    });
  } catch (e) {}
  return { ranks, suits };
}

// Every window of FLOWR_PACK_SIZE CONSECUTIVE entries of the live rank ladder
// whose every rank is in the deck. Returns the windows themselves, so the
// viability test and the builder cannot disagree about what is available.
function flowrPackRanks() {
  const order = (typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS && ACTIVE_RANKS.length)
    ? ACTIVE_RANKS : (typeof RANKS !== 'undefined' ? RANKS : []);
  const have = flowrPackFaces().ranks;
  const out = [];
  for (let i = 0; i + FLOWR_PACK_SIZE <= order.length; i++) {
    const win = order.slice(i, i + FLOWR_PACK_SIZE);
    if (win.every(r => have.has(r))) out.push(win);
  }
  return out;
}

function flowrBuildPacks() {
  const windows = flowrPackRanks();
  if (!windows.length) return [];
  const faces = flowrPackFaces();
  const suitPool = shuffle([...faces.suits]);
  const buffPool = shuffle(FLOWR_DECK_OPS.filter(o => o.buff).slice());
  const winPool  = shuffle(windows.slice());
  const out = [];
  for (let i = 0; i < FLOWR_PACK_OFFERS && buffPool.length; i++) {
    // Each pool WRAPS rather than running short, so three offers are built even
    // on a deck down to one suit or one legal run (the Forge's rule, r294).
    const suit = suitPool.length ? suitPool[i % suitPool.length] : (ACTIVE_SUITS || SUITS)[0];
    const win  = winPool[i % winPool.length];
    const op   = buffPool[i];                 // DIFFERENT buff per group, by spec
    const v    = flowrValRoll(op.buff.range);
    out.push({ suit, ranks: win.slice(), op, value: v, label: flowrBuffLabel(op.buff, v) });
  }
  return out;
}

// The mini playing cards the tile is made of - the .ev-cardchip vocabulary the
// events already use for "your real cards", so a screen about the deck is made
// of cards rather than of an icon standing in for them.
function flowrPackArtHTML(pack) {
  return `<div class="flowr-pack-art">`
    + pack.ranks.map(r =>
        `<span class="ev-cardchip flowr-pack-card${['♥', '♦'].includes(pack.suit) ? ' red' : ''}">`
        + `${r}${pack.suit}</span>`).join('')
    + `</div>`;
}

let _flowrPacks = null;

function flowrShowCardsPick() {
  const packs = flowrBuildPacks();
  if (!packs.length) { flowrAfterStep(); return; }
  _flowrPacks = packs;
  if (typeof pickRerollsNewScreen === 'function') pickRerollsNewScreen();
  const tiles = () => _flowrPacks.map((p, i) => ({
    entity: 'cardpack', id: 'pack' + i, artKind: 'pack', artHTML: flowrPackArtHTML(p),
    icon: p.suit, emoji: p.suit, rarity: 'rare', tag: 'CARDS',
    label: `${p.ranks[0]}-${p.ranks[p.ranks.length - 1]} ${p.suit}`,
    desc: `${p.ranks.length} cards join your deck: ${p.ranks.map(r => r + p.suit).join(', ')}. `
        + `Each one scores ${p.label}.`,
  }));
  openGridPick({
    title: FLOWR_KINDS.cards.label(), tone: 'reward',
    offers: tiles(),
    actions: [pickRerollAction(() => {
      const fresh = flowrBuildPacks();
      if (fresh.length) { _flowrPacks = fresh; gridPickRefresh(tiles(), null); }
    })],
    onChoose: (i) => { flowrGrantPack(_flowrPacks[i]); _flowrPacks = null; flowrAfterStep(); },
    onSkip: () => { _flowrPacks = null; rainCheckPay(); flowrAfterStep(); },
  });
  try { sfxShopOpen?.(); } catch (e) {}
}

function flowrGrantPack(pack) {
  if (!pack) return;
  let made = 0;
  pack.ranks.forEach(rank => {
    // copyCardToDeck stamps a fresh _id, pushes to the draw pile, reshuffles and
    // bumps expectedDeckTotal - so the deck audit balances with no bookkeeping
    // here. The buff is keyed off THAT card's id (r192), never off its face: the
    // deck can legitimately hold another 7 of spades and this must not buff it.
    const card = (typeof copyCardToDeck === 'function') ? copyCardToDeck({ rank, suit: pack.suit }) : null;
    if (!card) return;
    try { enhanceCardKey(cardId(card), { [pack.op.buff.key]: pack.value }); } catch (e) {}
    made++;
  });
  if (typeof updateDeckHud === 'function') updateDeckHud();
  showMessage(`🃏 ${made} card${made === 1 ? '' : 's'} joined the deck · ${pack.label}`, '#7fd45a');
  try { sfxCoin?.(); } catch (e) {}
}

// ══════════════════════════════════════════════
// DEV PANEL (dev -> Rewards) - the chain's knobs
// ══════════════════════════════════════════════
function flowrDevSync() {
  const cfg = flowrCfg();
  const on = document.getElementById('dev-flowr-on'); if (on) on.checked = cfg.on;
  cfg.counts.forEach((v, i) => {
    const el = document.getElementById('dev-flowr-c' + i);
    if (el && document.activeElement !== el) el.value = v;
  });
  // The counts are WEIGHTS and are normalised, so the panel prints what they
  // actually come out as - the shipped row sums to 85 and would otherwise read
  // as five percentages that do not add up.
  const cOut = document.getElementById('dev-flowr-counts-out');
  if (cOut) {
    const t = cfg.counts.reduce((s2, x) => s2 + Math.max(0, x || 0), 0) || 1;
    cOut.textContent = '= ' + cfg.counts.map(v => (Math.max(0, v || 0) / t * 100).toFixed(1) + '%').join(' / ');
  }
  // Both rows are built from the KIND TABLE, so a new kind gets its knobs for
  // free. Built ONCE and then only written - a full rebuild would tear the field
  // being typed in out from under the caret (the r282 NS-editor rule).
  const mk = (host, field, placeholder) => {
    if (!host) return;
    if (!host.children.length) {
      host.innerHTML = FLOWR_KIND_IDS.map(k =>
        `<label>${flowrKindShort(k)} <input id="dev-flowr-${field}-${k}" type="number" min="0" max="100"`
        + ` step="0.5" style="width:46px;" placeholder="${placeholder}"`
        + ` onchange="flowrDevSet('${field}', this.value, '${k}')"><span class="dev-flowr-pct"></span></label>`).join('');
    }
  };
  mk(document.getElementById('dev-flowr-odds'),  'odds',  '');
  mk(document.getElementById('dev-flowr-early'), 'early', '-');

  const live = flowrOddsNow();
  const total = FLOWR_KIND_IDS.reduce((s2, k) => s2 + Math.max(0, cfg.odds[k] || 0), 0) || 1;
  FLOWR_KIND_IDS.forEach(k => {
    const eo = document.getElementById('dev-flowr-odds-' + k);
    if (eo && document.activeElement !== eo) eo.value = cfg.odds[k];
    const pc = eo && eo.parentElement.querySelector('.dev-flowr-pct');
    if (pc) pc.textContent = ' ' + (Math.max(0, cfg.odds[k] || 0) / total * 100).toFixed(1) + '%';
    const ee = document.getElementById('dev-flowr-early-' + k);
    // BLANK means "no override", which is not the same as 0 ("never") - so an
    // absent key writes an empty field rather than a zero the owner never set.
    if (ee && document.activeElement !== ee) ee.value = (cfg.early[k] == null) ? '' : cfg.early[k];
  });

  const ph = document.getElementById('dev-flowr-phase');
  if (ph) ph.textContent = `${flowrEarly() ? 'EARLY table (level <= ' + FLOWR_EARLY_LEVELS + ')' : 'standard table'}`
    + ` \u00b7 level ${typeof level !== 'undefined' ? level : '?'} \u00b7 ${flowrExtraEarned} extra earned`
    + ` \u00b7 live: ` + FLOWR_KIND_IDS.filter(k => (live[k] || 0) > 0).map(k => flowrKindShort(k) + ' ' + live[k]).join(', ');
}
function flowrDevSet(field, value, i) {
  const cfg = flowrCfg();
  if (field === 'on')    cfg.on = !!value;
  if (field === 'count') cfg.counts[i] = Math.max(0, Math.min(999, parseFloat(value) || 0));
  if (field === 'odds')  cfg.odds[i]   = Math.max(0, Math.min(100, parseFloat(value) || 0));   // i is the kind id
  if (field === 'early') {
    const raw = String(value).trim();
    if (raw === '') delete cfg.early[i];                                                       // blank = no override
    else cfg.early[i] = Math.max(0, Math.min(100, parseFloat(raw) || 0));
  }
  flowrSaveCfg(cfg);
  flowrDevSync();
}
function flowrDevReset() { try { localStorage.removeItem(FLOWR_KEY); } catch (e) {} flowrDevSync(); }
