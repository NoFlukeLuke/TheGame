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
  // Relative weight of 1..5 rewards. Owner's row, and it sums to 100 - so these
  // ARE the percentages. It is still normalised on read, which costs nothing and
  // means a retune that does not add up still plays the ratios it sets (the dev
  // panel prints what a row actually comes out as).
  // r391: +10 moved from 1 to 2 (owner: "tune up the chances of a second").
  counts: [38, 42, 10, 6, 4],
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

// ── REPEATS WITHIN ONE CHAIN (r374) ──
// Owner: *"the only one i don't want to see repeat is the generic pick three.
// the rest can, but should be pushed away from that trend if possible. not
// worried about it changing the odds on the grid so much."*
//
// So a kind already drawn in THIS chain has its weight multiplied by the damp
// for each time it has been drawn - compounding, so a third is rarer than a
// second - and PICK 3 is damped to nothing. That is the difference between
// "discouraged" and "never", in one mechanism.
//
// IT DOES MOVE THE MARGINALS, which the owner has accepted: weight taken off a
// repeat has to land somewhere, and it lands on the kinds not yet drawn. The
// shift is small because most chains are short (1 or 2 screens, 80% of them) -
// measured in the table at the head of this file.
const FLOWR_NO_REPEAT   = new Set(['pick3']);
const FLOWR_REPEAT_DAMP = 0.3;
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

// The odds for the NEXT slot of a chain, given what it has already paid.
// EVERY KIND ZEROED IS NOT AN ANSWER - it would make flowrRollKind fall back to
// pick3, which is the one kind that must not repeat - so a table that damps to
// nothing hands back the undamped one.
function flowrDampOdds(odds, taken) {
  const out = {};
  let any = false;
  FLOWR_KIND_IDS.forEach(k => {
    const base = odds[k] || 0;
    if (base <= 0) return;
    const t = taken[k] || 0;
    if (t && FLOWR_NO_REPEAT.has(k)) return;
    out[k] = t ? base * Math.pow(FLOWR_REPEAT_DAMP, t) : base;
    if (out[k] > 0) any = true;
  });
  return any ? out : odds;
}

// The viability fallback, as an expression - a kind with nothing to offer shows
// the ordinary pick rather than an empty screen.
function flowrKindViable2(kind) { return flowrKindViable(kind) ? kind : 'pick3'; }

// THE SET WEIGHT IS NOT THE REALISED SHARE once repeats are damped, so the dev
// panel measures rather than prints the table back (r374). Weight taken off a
// repeat lands on the kinds not yet drawn, and pick3 - banned from repeating -
// pays for all of it: measured, a set 30 comes out at 25.2 and every other kind
// gains a little. A quoted number and a delivered number drifting apart is the
// r151 mistake, so the panel shows both.
//
// A Monte Carlo rather than a closed form: the damping compounds per draw and
// the count distribution is a second table on top, so the algebra is worse than
// the simulation. It deliberately re-uses the REAL roll functions, so it cannot
// describe a different game from the one being played.
//
// IT MUST NOT TOUCH THE SEEDED STREAM. js/seed.js REPLACES the global
// Math.random for a seeded run, and these 37,000 draws would advance it - so a
// dev panel opened mid-run would change every deck shuffle, reward grid and
// boss roll after it. This is cosmetic randomness and takes fxRandom(), the
// rule CLAUDE.md states for every animation driver; the swap-and-restore is
// seed.js's own withSeededRng shape, and it is safe because the sim is
// synchronous and nothing can interleave with it.
//
// CACHED on the live table, because flowrDevSync runs on every open and every
// edit and 20k chains is ~75ms - a visible hitch on each keystroke commit. The
// sim only depends on the tables, so a cache key of the tables is exact.
let _flowrSimCache = { key: null, out: null };
function flowrSimShare(trials) {
  const odds = flowrOddsNow();
  const key = JSON.stringify([odds, flowrCfg().counts, trials]);
  if (_flowrSimCache.key === key) return _flowrSimCache.out;
  const prev = Math.random;
  if (typeof fxRandom === 'function') Math.random = fxRandom;
  const out = {}; let screens = 0;
  try {
    for (let i = 0; i < trials; i++) {
      const n = flowrRollCount(), taken = {};
      for (let j = 0; j < n; j++) {
        const k = flowrRollKind(flowrDampOdds(odds, taken));
        taken[k] = (taken[k] || 0) + 1;
        out[k] = (out[k] || 0) + 1; screens++;
      }
    }
  } finally { Math.random = prev; }
  Object.keys(out).forEach(k => { out[k] = out[k] / screens * 100; });
  _flowrSimCache = { key, out };
  return out;
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
  // r380: THE WALKTHROUGH'S FIRST REWARD IS A PLAIN PICK. Flow is the first mode
  // now, so its walkthrough is most players' first reward screen, and its steps
  // describe a pick of three. The chain explains itself later through a tip
  // (js/insights.js, flow_chain) the first time a real one rolls.
  if (typeof tutorialActive === 'function' && tutorialActive()) return false;
  const n = flowrRollCount();
  // EVERY SLOT IS ROLLED ON ITS OWN - a kind's weight is its share of reward
  // screens and says nothing about where it lands - but a kind already drawn in
  // THIS chain is damped (see FLOWR_REPEAT_DAMP), and pick3 to nothing. A kind
  // with nothing to offer falls back to pick3 rather than showing an empty
  // screen; that substitution is COUNTED too, so it cannot sneak a second pick3
  // past the damping either.
  const odds = flowrOddsNow();
  const queue = [], taken = {};
  for (let i = 0; i < n; i++) {
    const k = flowrKindViable2(flowrRollKind(flowrDampOdds(odds, taken)));
    queue.push(k);
    taken[k] = (taken[k] || 0) + 1;
  }
  // One reward and it is the ordinary pick: today's behaviour, no ceremony.
  if (n <= 1 && queue[0] === 'pick3') return false;
  flowrQueue = queue;
  flowrIdx = 0;
  // The COUNT is banked synchronously - it is a run stat read by the dev panel
  // and must not wait on an animation - but nothing is SHOWN until the board is
  // still. See flowrWhenBoardStill.
  if (n > 1) flowrExtraEarned += n - 1;
  // THE TALLY WAITS FOR THIS (r376). The finale awaits flowrIntroWait() right
  // after the winners land in the preview, so the order the player sees is
  // explode -> fly -> counter -> (options deal in AND the tally resumes
  // together). Before this the counter was deferred to whenever the blast
  // happened to settle, which was several beats INTO the score climb - the
  // "the score animation seems interrupted by the level up count" report.
  let _introDone = null;
  flowrIntro = new Promise(res => { _introDone = res; });
  const _release = () => { const f = _introDone; _introDone = null; flowrIntro = null; f && f(); };
  flowrWhenBoardStill(() => {
    if (!flowrQueue) { _release(); return; }   // the run was abandoned while we waited
    if (n > 1) flowrPlayCounter(n, () => { flowrShowStep(); _release(); });
    else { flowrShowStep(); _release(); }
  });
  return true;
}

// The finale's handle on the beat above. Null when no chain is arming, so the
// ordinary single-pick path is untouched and awaits nothing.
let flowrIntro = null;
function flowrIntroWait() { return flowrIntro; }

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
//
// THE WAIT IS CAPPED (r376). Now that the TALLY waits on this beat too, an
// uncapped wait is dead air rather than a beat played under a running score
// climb: at 1x the blast runs ~3.6s past the fly-in. FLOWR_PRE_WAIT is both
// the pacing cap and the insurance against an animation that never resolves,
// and at that point the blast is in its RETURN leg with the cards converging
// on their own cells, which is a fine thing for the counter to land over. At
// 4x and up the blast is already done and the wait is 0.
const FLOWR_PRE_WAIT = 700;
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
    if (still() || Date.now() - t0 > FLOWR_PRE_WAIT) { cb(); return; }
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
  const from = flowrQueue[flowrIdx];   // the tab just chosen - it is what falls
  flowrIdx++;
  flowrRenderStack();
  // 200ms, not 380 (r378). The panel and its tabs stay lit between steps, so
  // this gap is a LIT EMPTY PANEL - and the incoming options then took another
  // 335ms to appear on top of it (see GP_OPT_LEAD). Measured end to end, the
  // hole between one step and the next was 735ms; it is ~265 now.
  // r380: the outgoing board has already left through rewardTransitionOut, so
  // the incoming one only needs a breath, not a pause.
  if (flowrIdx < flowrQueue.length) { flowrHandOver(from, () => flowrShowStep()); return true; }
  flowrFinish();
  return true;
}

// ══════════════════════════════════════════════
// THE TAB HAND-OVER (r394) - the chosen tab is knocked off its own stack
// ══════════════════════════════════════════════
// Owner: *"can we just have the whole tab fall to one side, it falls and rotates
// slightly as it falls off. So the options would explode out, then that tab gets
// the shine effect we're currently giving to the next tab, and when the shine
// wave thing gets close to whichever side it goes toward (make it go either way)
// then the empty tab falls over revealing the next tab. The option behind it
// would not get a fall animation of its own it would just be there already ...
// right now the current tab goes away after a choice and we see a tab the color
// of the next tab get the shine ... I'm saying that shine effect should apply to
// the tab we've just chosen, and the shine is the thing that looks like it knocks
// the current tab off."*
//
// THE SHINE WAS ON THE WRONG OBJECT AND ON THE WRONG STEP. r380 put it on the
// PANEL and fired it from flowrRenderStack on an index change - i.e. after the
// index had already moved, in the INCOMING colour, on a tab that had already been
// swapped. So the thing being polished was the arrival, not the departure, and
// nothing connected the two. It is now: shine the OUTGOING tab, and let the shine
// reaching the edge be what tips it off.
//
// FOUR THINGS THIS ENCODES:
//
// - THE NEW STACK IS DRAWN FIRST, UNDER A GHOST OF THE OLD TAB. The obvious
//   ordering - fall, then re-render - cannot work: flowrRenderStack rebuilds
//   #flowr-stack wholesale, so the element mid-fall would be destroyed. Drawing
//   the new arrangement first and covering its front tab with a free-standing
//   copy of the old one means the fall reveals something that is genuinely
//   already there, which is exactly what was asked for. The queued tabs behind
//   shift 5px and 5% at that instant, which is hidden under the exploding tiles.
//
// - THE PANEL HOLDS THE OLD COLOUR UNTIL THE FALL. flowrRenderStack sets --fc to
//   the incoming colour, so without this the whole panel would cross-fade while
//   the old tab was still sitting on it - the reveal announced before it happens.
//   Writing it back in the same synchronous block means the browser never sees
//   the new value, so there is no transition to interrupt; setting it at the fall
//   is what makes the .28s cross-fade land ON the reveal.
//
// - THE GHOST IS POSITIONED IN DESIGN PX, FROM A RECT DIVIDED BY THE ZOOM. Both
//   #flowr-stack and the ghost live inside #cabinet, which carries the stage
//   zoom, so a rect delta is viewport px and an inline `left` is design px. The
//   r160 Trick-fan trap: measure the ratio off the element itself rather than
//   assuming --stage-zoom, and subtract the host's own border (an absolutely
//   positioned child resolves against the PADDING box).
//
// - THE NEXT SCREEN STARTS AT THE FALL, NOT AFTER IT. The owner asked whether the
//   incoming options should still deal in; they should, and they should do it
//   BEHIND the falling tab. Starting the step at the moment of the knock means
//   the tab tips off the top of the panel while the offers rise into the tray
//   under it - one motion - and the hand-over costs only the shine's lead (about
//   a third of a second) rather than its whole length.
// THE SWEEP'S LENGTH IS THE LEAD, so there is ONE number rather than a duration
// in the JS and a keyframe percentage in the CSS that have to be kept in step.
// The band travels the tab's full width over exactly this, so it arrives at the
// far side on the frame the knock lands - which is the whole of the owner's
// "when the shine wave thing gets close to whichever side it goes toward then
// the empty tab falls over".
const FLOWR_SHINE_MS   = 340;
const FLOWR_TABFALL_MS = 560;

// An element's box in its host's own design px. Returns null when it cannot be
// measured (a display:none ancestor - the deck-edit step hides the tabs).
function flowrBoxIn(el, host) {
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return null;
  const r = el.getBoundingClientRect(), hr = host.getBoundingClientRect();
  const z = r.width / w;
  if (!(z > 0.01)) return null;
  return { left: (r.left - hr.left) / z - (host.clientLeft || 0),
           top:  (r.top  - hr.top ) / z - (host.clientTop  || 0), w, h };
}

function flowrHandOver(fromKind, next) {
  const skip = (typeof skipOn === 'function' && skipOn('transitions'));
  const host = document.getElementById('grid-slot');
  const cur0 = document.getElementById('flowr-stack')?.querySelector('.fst-cur');
  // Measured BEFORE the rebuild below destroys it.
  const box = (!skip && host && cur0) ? flowrBoxIn(cur0, host) : null;
  const label = cur0 ? cur0.innerHTML : '';
  const bg0 = document.getElementById('flowr-bg');
  const oldColor = bg0 ? bg0.style.getPropertyValue('--fc') : '';

  flowrRenderStack();                       // the new arrangement, underneath
  const bg = document.getElementById('flowr-bg');
  const newColor = bg ? bg.style.getPropertyValue('--fc') : '';

  // No tab to knock off (the deck-edit takeover hides the ladder, and a skipped
  // transition wants none of this): the panel says it instead, as it did before.
  if (!box) {
    if (bg && !skip) { bg.classList.remove('fbg-turn'); void bg.offsetWidth; bg.classList.add('fbg-turn'); }
    setTimeout(next, skip ? 0 : 140);
    return;
  }
  if (bg && oldColor) bg.style.setProperty('--fc', oldColor);   // hold the wash

  const meta = FLOWR_KINDS[fromKind] || FLOWR_KINDS.pick3;
  // EITHER WAY (owner's words). fxRandom, never Math.random - a seeded run
  // replaces the global and this would advance the deck and reward streams.
  const dir = ((typeof fxRandom === 'function' ? fxRandom() : Math.random()) < 0.5) ? -1 : 1;
  const g = document.createElement('div');
  g.id = 'flowr-tabfall';
  g.className = 'fst-chip fst-cur';
  g.style.cssText = `left:${box.left}px;top:${box.top}px;right:auto;bottom:auto;`
    + `width:${box.w}px;height:${box.h}px;`;
  g.style.setProperty('--fst-c', meta.color);
  g.style.setProperty('--fst-d', 0);
  g.style.setProperty('--fst-dir', dir);
  g.style.setProperty('--fst-shine-ms', FLOWR_SHINE_MS + 'ms');
  g.style.setProperty('--fst-fall-ms', FLOWR_TABFALL_MS + 'ms');
  g.innerHTML = label + '<i class="fst-shine"></i>';
  host.appendChild(g);
  requestAnimationFrame(() => g.classList.add('shining'));

  setTimeout(() => {
    if (bg) {
      if (newColor) bg.style.setProperty('--fc', newColor);
      bg.classList.remove('fbg-settle'); void bg.offsetWidth; bg.classList.add('fbg-settle');
    }
    g.classList.add('falling');
    try { sfxFlipShuffle?.(); } catch (e) {}
    next();                                  // the offers deal in behind it
    setTimeout(() => g.remove(), FLOWR_TABFALL_MS + 120);
  }, FLOWR_SHINE_MS);
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

// A one-shot wash over the board behind the counter. Its own element rather
// than a class on #grid-slot: that element is the positioning context for the
// board, the stack and the counter, and a filter or animation on it would make
// it the containing block for every fixed descendant (the r180 trap).
function flowrFlash() {
  const host = document.getElementById('grid-slot');
  if (!host) return;
  document.getElementById('flowr-flash')?.remove();
  const f = document.createElement('div');
  f.id = 'flowr-flash';
  host.appendChild(f);
  setTimeout(() => f.remove(), 700);
}

// ══════════════════════════════════════════════
// THE COUNTER CARD (option A) - "hold up, there's more"
// ══════════════════════════════════════════════
// ── HOW LONG THE COUNTER HOLDS BEFORE IT JUMPS (r380) ──────────────────────
// Owner: "the delay between one reward vs 2 or more needs 2 changes, it should
// take slightly longer to reveal the subsequent rewards, and the amount of time
// it takes should be slightly variable such that it genuinely feels surprising
// when multiple rewards trigger."
//
// THE SURPRISE IS AT THE FIRST BUMP, so that is the gap that got the length and
// most of the jitter: the card lands on x1, you read it as the ordinary one
// reward, and only then does it jump. A FIXED gap is learnable in about three
// level-ups - you stop reading the x1 and just wait out the beat - which is
// exactly the thing being asked for here. Later bumps are quicker and jittered
// less, so a run of them reads as one cascade rather than as the suspense beat
// played over again.
//
// fxRandom, NEVER Math.random: js/seed.js REPLACES the global for a seeded run,
// so rolling here would advance the deck, reward and boss streams by however
// many rewards a level-up happened to pay.
const FLOWR_BUMP_FIRST = 950, FLOWR_BUMP_FIRST_JIT = 520;
const FLOWR_BUMP_NEXT  = 620, FLOWR_BUMP_NEXT_JIT  = 300;
function flowrBumpGap(first) {
  const rnd = (typeof fxRandom === 'function') ? fxRandom() : Math.random();
  return first ? FLOWR_BUMP_FIRST + rnd * FLOWR_BUMP_FIRST_JIT
               : FLOWR_BUMP_NEXT  + rnd * FLOWR_BUMP_NEXT_JIT;
}

// ── THE REWARD CHIP'S LOOK (r380) ──────────────────────────────────────────
// Owner: "could we also give the reward chip some more options, like give me a
// few options for both how it appears and what it looks like. don't just vary
// the color of it, get 4 genuinely different looks."
//
// FIVE LOOKS, AND EACH ONE IS A DIFFERENT OBJECT WITH A DIFFERENT ENTRANCE -
// not one card in five palettes. The entrance is half of what a look IS: a
// stamp SLAMS, a receipt FEEDS, a marquee BOUNCES, a reel DROPS AND SPINS. All
// five are pure CSS over the same markup, so the JS below is unchanged by the
// choice and a sixth is a stylesheet block plus a row in this table.
//
// The style is a class on #flowr-counter AND on <body>, because the tab ladder
// is a separate element and the two are one object on screen - the counter
// lands over the panel the tabs hang off.
const FLOWR_CHIPS = [
  { id: 'stamp',   name: 'Stamp',   note: 'A rubber stamp that slams down askew, with a shockwave ring.' },
  { id: 'ticket',  name: 'Receipt', note: 'A perforated paper slip that feeds in from the top, dot-matrix.' },
  { id: 'marquee', name: 'Marquee', note: 'An arcade marquee with chase bulbs; bounces in and sweeps.' },
  { id: 'reel',    name: 'Reel',    note: 'A slot payout window that drops on a spring; the number spins up.' },
  { id: 'plate',   name: 'Plate',   note: 'The r376 card: a dark slab that fades and scales up.' },
];
// THE DEFAULT IS THE PLATE AGAIN (r394). Owner: "make the level up chip what it
// was at first visually, and add an explosion of colored particles underneath
// it." The other four stay in the picker - they are whole, and the dev panel's
// preview is where they are compared - but the slab is what ships.
//
// THE KEY IS BUMPED TO v2, the r183 hbCfg2 -> hbCfg3 rule: a stored value beats
// a default, so anyone who had already been shown the stamp would have kept it
// for ever.
const FLOWR_CHIP_KEY = 'lethe.flowrChip.v2';
let flowrChipStyle = (() => {
  try { const v = localStorage.getItem(FLOWR_CHIP_KEY);
        if (v && FLOWR_CHIPS.some(c => c.id === v)) return v; } catch (e) {}
  return 'plate';
})();
function setFlowrChipStyle(id) {
  if (!FLOWR_CHIPS.some(c => c.id === id)) return;
  flowrChipStyle = id;
  try { localStorage.setItem(FLOWR_CHIP_KEY, id); } catch (e) {}
  flowrApplyChipStyle();
}
function flowrApplyChipStyle() {
  FLOWR_CHIPS.forEach(c => document.body.classList.toggle('fcs-' + c.id, c.id === flowrChipStyle));
}
// Show the chip on its own, at a given count, so the four can be compared
// without playing a run. Dev panel -> Rewards.
function flowrPreviewChip(n) {
  flowrApplyChipStyle();
  flowrPlayCounter(Math.max(1, n || 3), null);
}

// ══════════════════════════════════════════════
// THE CONFETTI (r394) - one burst per reward, in that reward's TIER colour
// ══════════════════════════════════════════════
// Owner: *"add an explosion of colored particles underneath it. The color of the
// particles changes for each additional reward, first its the color of common,
// then rare, etc. for the 5th reward, it explodes all the colors. So no matter
// how many there are, the first is always common color, second rare, etc. The
// exploded bits should be like confetti, mostly squares of slightly varying size
// and rotation, and the color can vary by a few shades to add a little depth.
// The confetti should launch in all directions under the level up chip and over
// the grid."*
//
// THE COLOUR IS THE RARITY LADDER, AND IT IS KEYED TO THE COUNT, NOT TO THE ROLL.
// Burst 1 is always mint, 2 cyan, 3 purple, 4 magenta, 5 all four - so a x3 is
// recognisably further up the same ladder as a x2 rather than a different colour
// each time. They are read off the live CSS custom properties rather than typed
// here, so a palette change moves them (the hex is only the fallback).
//
// A PIECE IS A PLAIN DIV, NOT A CANVAS. There are at most ~54 of them for about
// a second, they want the same z-index seam everything else in #grid-slot uses,
// and a canvas would need its own sizing, its own zoom handling and its own
// clear-down. Each one animates itself with WAAPI and removes itself.
const FLOWR_CONF_N     = 38;   // pieces per burst
const FLOWR_CONF_N_ALL = 68;   // the fifth, which throws every colour
const FLOWR_CONF_MS    = 1150;
const FLOWR_CONF_TIERS = [
  ['--c-mint',    '#35d59b'],
  ['--c-cyan',    '#16c8d8'],
  ['--c-purple',  '#9a6cff'],
  ['--c-magenta', '#ff2f8e'],
];
function flowrTierColor(i) {
  const [v, fb] = FLOWR_CONF_TIERS[Math.max(0, Math.min(FLOWR_CONF_TIERS.length - 1, i))];
  let c = '';
  try { c = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); } catch (e) {}
  return c || fb;
}
// A few shades either side of the tier colour, so a burst has depth rather than
// being one flat fill repeated thirty times. Mixing k% toward white or black is
// linear in the channels, which is all the variation this needs.
function flowrShade(hex, amt) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (ch) => {
    const t = amt >= 0 ? 255 : 0, k = Math.abs(amt);
    return Math.round(ch + (t - ch) * k);
  };
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `rgb(${r},${g},${b})`;
}

// index: which reward this burst is for, 0-based. At FLOWR_CONF_TIERS.length and
// beyond every colour is thrown at once - the owner's "for the 5th reward, it
// explodes all the colors".
function flowrConfetti(index) {
  if (typeof skipOn === 'function' && skipOn('transitions')) return;
  if (document.body.classList.contains('reduced-motion')) return;
  const host = document.getElementById('grid-slot');
  const card = document.getElementById('flowr-counter');
  if (!host) return;
  let layer = document.getElementById('flowr-confetti');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'flowr-confetti';
    host.appendChild(layer);
  }
  // UNDER THE CHIP AND OVER THE BOARD: the layer sits at z-index 39 against the
  // counter's 40 (css/flow-rewards.css), in the same stacking context.
  const all = index >= FLOWR_CONF_TIERS.length;
  const palette = all ? FLOWR_CONF_TIERS.map((_, i) => flowrTierColor(i)) : [flowrTierColor(index)];
  const n = all ? FLOWR_CONF_N_ALL : FLOWR_CONF_N;
  // The chip's own centre, in the slot's design px. Falls back to the slot's
  // centre when the chip has not been laid out yet (the dev-panel preview).
  const box = card ? flowrBoxIn(card, host) : null;
  const ox = box ? box.left + box.w / 2 : host.offsetWidth / 2;
  const oy = box ? box.top + box.h / 2 : host.offsetHeight / 2;
  const rnd = () => (typeof fxRandom === 'function' ? fxRandom() : Math.random());
  for (let i = 0; i < n; i++) {
    const a  = rnd() * Math.PI * 2;                 // all directions
    const sp = 90 + rnd() * 165;
    const dx = Math.cos(a) * sp, dy = Math.sin(a) * sp;
    const drop = 120 + rnd() * 130;                 // gravity, applied at the end
    // MOSTLY SQUARES: one side is the base, the other within a fifth of it.
    const w = 4.5 + rnd() * 6, h = w * (0.82 + rnd() * 0.36);
    const col = palette[(rnd() * palette.length) | 0];
    const p = document.createElement('i');
    p.className = 'fcf';
    p.style.cssText = `left:${(ox - w / 2).toFixed(1)}px;top:${(oy - h / 2).toFixed(1)}px;`
      + `width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;`
      + `background:${flowrShade(col, (rnd() - 0.45) * 0.34)};`;
    layer.appendChild(p);
    const r0 = rnd() * 360, spin = (rnd() - 0.5) * 900;
    const dur = FLOWR_CONF_MS * (0.72 + rnd() * 0.5);
    try {
      p.animate([
        { transform: `translate(0,0) rotate(${r0}deg)`, opacity: 1 },
        { transform: `translate(${(dx * 0.72).toFixed(1)}px,${(dy * 0.72 + drop * 0.12).toFixed(1)}px) rotate(${(r0 + spin * 0.55).toFixed(0)}deg)`,
          opacity: 1, offset: 0.5 },
        { transform: `translate(${dx.toFixed(1)}px,${(dy + drop).toFixed(1)}px) rotate(${(r0 + spin).toFixed(0)}deg)`, opacity: 0 },
      ], { duration: Math.round(dur), easing: 'cubic-bezier(.16,.66,.44,1)', fill: 'forwards' })
        .finished.then(() => p.remove(), () => p.remove());
    } catch (e) { p.remove(); }
  }
}
function flowrClearConfetti() { document.getElementById('flowr-confetti')?.remove(); }

function flowrPlayCounter(n, done) {
  // Settings -> Skip -> Reward count-up (r380). The number is still worth
  // saying, so it is a toast rather than nothing; the tabs above the board show
  // the chain either way.
  if (typeof skipOn === 'function' && skipOn('rewardCount')) {
    showMessage(`GOAL CLEARED · ×${n} REWARDS`, '#7fd45a');
    done && done();
    return;
  }
  const host = document.getElementById('grid-slot') || document.getElementById('stage') || document.body;
  document.getElementById('flowr-counter')?.remove();
  flowrApplyChipStyle();
  const el = document.createElement('div');
  el.id = 'flowr-counter';
  el.className = 'fc-s-' + flowrChipStyle;
  // .fc-deco and .fc-pips are always emitted and are used by some looks and
  // not others - a look is a stylesheet block, never a second markup builder.
  el.innerHTML = `<i class="fc-deco"></i><div class="fc-kick">GOAL CLEARED</div>`
    + `<div class="fc-num"><b>&times;</b><em>1</em></div><div class="fc-sub">REWARD</div>`
    + `<i class="fc-pips"></i>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  // ONE SOUND WITH A TAIL (r378), not sfxLevelUp + sfxSuccess stacked. Owner:
  // "can we make the sound... have longer or bigger tails? So the interruption
  // feels more substantial?" sfxRewardCount rings on past its own attack and
  // takes a `step` so the run of bumps climbs; the four packs each carry their
  // own with a real reverb send. See js/audio.js.
  try { sfxRewardCount?.(0); } catch (e) {}
  // LOUD (r376): the beat the whole chain is built around, and the tally is
  // now held for it, so it gets a flash over the board and a shake of its own.
  flowrFlash();
  flowrConfetti(0);        // burst 1 is always the common colour
  let k = 1;
  const num = el.querySelector('.fc-num em'), sub = el.querySelector('.fc-sub');
  el.style.setProperty('--fc-k', 1);
  const bump = () => {
    k++;
    num.textContent = k;
    sub.textContent = 'REWARDS';
    // The count as a NUMBER too, so a look can react to it (the marquee lights
    // one bulb per reward) without reading the text back out of the DOM.
    el.style.setProperty('--fc-k', k);
    // restart the pop (the r277 pulse rule: remove, reflow, re-add)
    el.classList.remove('fc-pop'); void el.offsetWidth; el.classList.add('fc-pop');
    // The same sound one step up, so the run reads as one thing escalating.
    // sfxWinExplode joins it on the big ones, where the card is already
    // claiming the screen.
    try { sfxRewardCount?.(k - 1); } catch (e) {}
    if (k >= 4) { try { sfxWinExplode?.(); } catch (e) {} }
    flowrConfetti(k - 1);  // 2nd = rare, 3rd = epic, 4th = legendary, 5th = all
    if (k < n) setTimeout(bump, flowrBumpGap(false));
    else setTimeout(finish, 900);
  };
  const finish = () => {
    el.classList.remove('show');
    setTimeout(() => { el.remove(); flowrClearConfetti(); done && done(); }, 260);
  };
  if (n > 1) setTimeout(bump, flowrBumpGap(true));
  else setTimeout(finish, 900);
  // The goal hand's SKIP cuts this too, or pressing it would leave the player
  // watching a counter they have just asked to skip past.
  try {
    if (typeof dncFFRegister === 'function') dncFFRegister(() => {
      if (!el.isConnected) return;
      k = n; num.textContent = n; el.style.setProperty('--fc-k', n);
      sub.textContent = n > 1 ? 'REWARDS' : 'REWARD';
      finish();
    });
  } catch (e) {}
}

// ══════════════════════════════════════════════
// THE STACK (option C) - queued chips peeking out behind the current one
// ══════════════════════════════════════════════
function flowrRenderStack() {
  const host = document.getElementById('grid-slot');
  document.getElementById('flowr-stack')?.remove();
  // THE PANEL IS REUSED, NOT REBUILT (r378). It carries a .28s transition on
  // its background and border so the step's colour CROSS-FADES; removing and
  // re-appending it started a fresh element every time, so the transition had
  // nothing to transition from and the colour snapped.
  const existing = document.getElementById('flowr-bg');
  if (!flowrQueue) { existing?.remove(); }
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
  const bg = existing || document.createElement('div');
  bg.id = 'flowr-bg';
  bg.style.setProperty('--fc', cur.color);
  if (!existing) host.appendChild(bg);

  // ── THE PANEL TURNS OVER BETWEEN STEPS (r380) ──
  // Owner: "the animation between choices could use some more va va voom, it
  // feels real empty and boring currently." The gap was a lit empty panel and
  // a colour cross-fade, which is not an event. On a real step change the
  // panel now takes a bright band ACROSS IT in the incoming colour and a short
  // squash, so the screen visibly turns over rather than quietly restocking.
  //
  // IT FIRES ON A STEP CHANGE AND NOTHING ELSE. flowrRenderStack is called from
  // flowrShowStep AND flowrAfterStep - twice per step - and from every redraw,
  // so keying it off the call would sweep two or three times for one turn.
  // r394: THE HAND-OVER OWNS THIS NOW. It used to fire from here on an index
  // change, which is after the index has already moved - so the wipe ran in the
  // INCOMING colour on a tab that had already been swapped, polishing the arrival
  // instead of the departure. flowrHandOver fires the squash at the moment the
  // outgoing tab is knocked off, and the wipe only where there is no tab to knock
  // (the deck-edit step, which hides the ladder). _flowrLastIdx is kept because
  // flowrRenderStack is called twice per step and neither may double-fire.
  if (_flowrLastIdx !== flowrIdx) _flowrLastIdx = flowrIdx;

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
    return `<div class="fst-chip${depth === 0 ? ' fst-cur' : ''}" style="--fst-c:${meta.color}; --fst-d:${depth}">`
      + (depth === 0 ? `<span>${flowrKindShort(kind)}</span>` : '') + `</div>`;
  }).join('');
  host.appendChild(el);
}
let _flowrLastIdx = -1;
function flowrClearStack() {
  document.getElementById('flowr-stack')?.remove();
  document.getElementById('flowr-bg')?.remove();
  document.getElementById('flowr-tabfall')?.remove();
  _flowrLastIdx = -1;
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
                   tag: 'v' + ((typeof entityTierOf === 'function' ? entityTierOf(pick.id) : 0) + 2) + '.0' });
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
// slot, so it reads as an editor and not the game. Every op works through
// SELECTED CARDS: the adjacency ops through one card, firing on its orthogonal
// neighbours; the buff ops through up to 3 cards you pick yourself.
//
// ── EVERY OP IS CONFIRMED, AND NOTHING FIRES ON A TAP (r378) ────────────────
// Owner: *"all the card buff options should need to be confirmed before
// happening. Select whatever amount of cards, then press select, then you find
// out."* The buff ops already worked that way; the four ADJACENCY ops fired the
// instant a card was touched, so the one screen in the game whose whole purpose
// is a permanent change to the deck was also the one where a stray tap
// committed it. Selecting is now selecting on every op and APPLY is the only
// thing that commits.
//
// ── THE SELECTION MUST BE CONNECTED (r378) ──────────────────────────────────
// Owner: *"Card selections for the card buffs should probably need to be
// adjacent. To be able to use the leftover swaps and discards for the last
// round to organize the board for that purpose."* So a buff op's cards are one
// orthogonally connected group, exactly as a hand is - which turns the last
// round's unspent swaps and discards into preparation for this screen rather
// than into nothing.
//
// ── THE REVEAL ──────────────────────────────────────────────────────────────
// The quantity is rolled AT COMMIT, weighted low (the owner's .43/.36/.21), and
// revealed one card at a time: every candidate JIGGLES as its result lands, a
// hit goes green on sfxRewardGood and a miss goes grey on sfxRewardBad. The
// adjacency ops reveal their losers too - the neighbours the roll passed over -
// so what the roll actually did is on screen rather than implied by what
// changed. Selecting fewer cards concentrates the roll (a rolled 3 clamps to
// what you selected); deliberately NOT explained anywhere in-game (owner's
// call).
//
// A MISS IS NOT A REFUSAL, and the two must not share a sound. sfxNoSwaps is
// now the game's one "you may not do that" (refuse(), js/round-timers.js); a
// card the roll passed over is an OUTCOME, so it takes sfxRewardBad.

const FLOWR_DECK_OPS = [
  { id: 'suit', adj: true, max: 4, luckMax: true, icon: '♠', name: 'Suit Spread',
    desc: 'Select a card, then APPLY. Up to 4 cards next to it change to its suit.' },
  { id: 'rank', adj: true, max: 4, luckMax: true, icon: '⇅', name: 'Rank Pull',
    desc: 'Select a card, then APPLY. Up to 4 cards next to it move one rank toward it.' },
  { id: 'del', adj: true, max: 3, icon: '✂', name: 'Cut',
    desc: 'Select a card, then APPLY. 1-3 cards next to it leave the run for good.' },
  { id: 'copy', adj: true, max: 3, icon: '⧉', name: 'Stamp',
    desc: 'Select a card, then APPLY. 1-3 cards next to it become copies of it.' },
  { id: 'pips',   buff: { key: 'pips',   range: [10, 15, 1],    word: 'pips'   }, icon: '➕', name: 'Pip Buff',
    desc: 'Pick up to 3 touching cards, then APPLY. Buffed cards score +10 to +15 pips.' },
  { id: 'mult',   buff: { key: 'mult',   range: [8, 12, 1],     word: 'mult'   }, icon: '✖', name: 'Mult Buff',
    desc: 'Pick up to 3 touching cards, then APPLY. Buffed cards score +8 to +12 mult.' },
  { id: 'focus',  buff: { key: 'focus',  range: [1, 2, 1],      word: 'Focus'  }, icon: '◉', name: 'Focus Buff',
    desc: 'Pick up to 3 touching cards, then APPLY. Buffed cards grant +1 to +2 Focus when they score.' },
  { id: 'time',   buff: { key: 'time',   range: [1, 5, 1],      word: 's'      }, icon: '⏱', name: 'Time Buff',
    desc: 'Pick up to 3 touching cards, then APPLY. Buffed cards put +1 to +5 seconds back on the clock when they score.' },
  { id: 'replay', buff: { key: 'retrig', range: [1, 2, 1],      word: 'replay' }, icon: '↻', name: 'Replay Buff',
    desc: 'Pick up to 3 touching cards, then APPLY. Buffed cards replay +1 to +2 times.' },
  { id: 'xmult',  buff: { key: 'xmult',  range: [1.5, 3, 0.5],  word: '× mult', x: true }, icon: '⨉', name: '×Mult Buff',
    desc: 'Pick up to 3 touching cards, then APPLY. Buffed cards multiply the mult by ×1.5 to ×3.' },
  { id: 'xpips',  buff: { key: 'xpips',  range: [1.25, 2, 0.25], word: '× pips', x: true }, icon: '∗', name: '×Pips Buff',
    desc: 'Pick up to 3 touching cards, then APPLY. Buffed cards multiply their pips by ×1.25 to ×2.' },
  // r392: the card that SCORES CREDITS (the gold coin face).
  { id: 'coins',  buff: { key: 'coin',   range: [1, 3, 1],      word: 'credits' }, icon: '🪙', name: 'Coin Buff',
    desc: 'Pick up to 3 touching cards, then APPLY. Buffed cards pay +1 to +3 credits when they score.' },
  // r392: THE RAREST TWO. Each of up to 4 touching cards has a chance to take a
  // second suit / rank from another card in the group (js/deck-grid.js).
  { id: 'suit2', dual: 'suit', icon: '♠♥', name: 'Second Suit',
    desc: 'Pick up to 4 touching cards, then APPLY. Each may take a SECOND SUIT from another card in the group - it counts for either suit in a flush (both, if it doubles one) and fires Tricks for both.' },
  { id: 'rank2', dual: 'rank', icon: '7/8', name: 'Second Rank',
    desc: 'Pick up to 4 touching cards, then APPLY. Each may take a SECOND RANK from another card in the group - it fills two ranks in a run or a set, and fires Tricks for both.' },
];

// r392 HOW OFTEN EACH OP IS OFFERED (owner's tiers, pending the full table in
// TODO.md). Rarest: the two dual ops. Then Stamp and the x buffs; then Focus and
// Time; then the flat buffs and Suit Spread. Rank Pull, Cut, Replay and Coin are
// placed by guess. Read by the deck-edit pick AND the reward grid's card tiles.
const FLOWR_OP_WEIGHTS = {
  suit2: 2, rank2: 2,
  copy: 6, xmult: 6, xpips: 6, replay: 6,
  focus: 10, time: 10, coins: 10, rank: 10, del: 10,
  pips: 16, mult: 16, suit: 16,
};
function flowrOpWeight(op) { return FLOWR_OP_WEIGHTS[op.id] ?? 8; }
// Weighted draw of n DIFFERENT ops, optionally from a filtered list.
function flowrDrawOps(n, list) {
  const pool = (list || FLOWR_DECK_OPS).slice(), out = [];
  while (out.length < n && pool.length) {
    const tot = pool.reduce((t, o) => t + flowrOpWeight(o), 0);
    let x = Math.random() * tot, k = 0;
    for (; k < pool.length - 1; k++) { x -= flowrOpWeight(pool[k]); if (x <= 0) break; }
    out.push(pool.splice(k, 1)[0]);
  }
  return out;
}
const FLOWR_DUAL_MAX = 4;
const FLOWR_DUAL_CHANCE = 0.5;   // per card, luck-scaled
function flowrSelMax(op) { return op && op.dual ? FLOWR_DUAL_MAX : FLOWR_BUFF_MAX; }

let _flowrDeckOp = null, _flowrDeckSel = [], _flowrDeckBusy = false;
let _flowrPlayHTML = null;
// render()'s button guard asks this (the r247 takeover rule): while the deck
// edit is up, PLAY is the APPLY button and render must not write over it.
function flowrDeckActive() { return !!_flowrDeckOp; }

function flowrShowDeckPick() {
  const ops = flowrDrawOps(3);   // r392: weighted by FLOWR_OP_WEIGHTS
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
  if (!_flowrDeckOp) return;
  e.stopPropagation();
  flowrDeckConfirm();
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
  if (op.buff || op.dual) {
    el.innerHTML = `<b>${op.name}</b><span id="fb-note">Pick up to ${flowrSelMax(op)} touching cards, then press APPLY · <i id="fb-count">0/${flowrSelMax(op)}</i></span>`;
  } else {
    el.innerHTML = `<b>${op.name}</b><span id="fb-note">Select a card, then press APPLY · <i id="fb-count">none</i></span>`;
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

// A WILD IS NOT AN ORDINARY CARD HERE (r378), and every op breaks on one:
//  - Suit Spread from a wild gives its neighbours WILD_SUIT, a suit the mode
//    does not have. That is the one thing js/data/cards.js says never to do -
//    inventing a face puts a card into play the deck cannot hold.
//  - Stamp from a wild MINTS WILDS, past whatever wildCardCount() set.
//  - Rank Pull toward a wild is a dud: WILD_RANK is not in ACTIVE_RANKS, so the
//    index lookup fails and nothing moves.
//  - A pip, mult or replay buff ON a wild is worth nothing - calcScore returns
//    on a wild before any per-card bookkeeping (r325).
// One clause closes all four, on both the source and the target side.
function flowrDeckOrdinary(cd) {
  if (typeof isWildCard === 'function' && isWildCard(cd)) return false;
  return !!cd && !!cd.rank && !cd._isSleight && !cd._isStone && !cd.trick && !cd.challengeCard;
}

// THE BUFF SELECTION IS ONE ORTHOGONALLY CONNECTED GROUP (r378), the same rule
// a hand follows - which is what makes the round's leftover swaps and discards
// worth spending on the shape of the board rather than on nothing.
//
// A DESELECT THAT WOULD SPLIT THE GROUP IS REFUSED rather than silently pruning
// the cards it stranded. Removing a card the player did not tap is the worse
// surprise, and with a cap of 3 the only breaking case is the middle of a line,
// where either end works instead.
const FLOWR_BUFF_MAX = 3;
// One beat per card, shared by both apply paths so the two cannot drift. The
// jiggle is 420ms, so this leaves the card still moving as the next one starts -
// a run of results rather than a queue of them.
const FLOWR_REVEAL_MS = 420;
function _flowrAdjacent(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1; }
function _flowrConnected(sel) {
  if (sel.length < 2) return true;
  const seen = new Set([0]); const stack = [0];
  while (stack.length) {
    const i = stack.pop();
    sel.forEach((o, j) => { if (!seen.has(j) && _flowrAdjacent(sel[i], o)) { seen.add(j); stack.push(j); } });
  }
  return seen.size === sel.length;
}

function flowrDeckSyncUI() {
  const op = _flowrDeckOp; if (!op) return;
  const n = _flowrDeckSel.length;
  const cnt = document.getElementById('fb-count');
  if (cnt) cnt.textContent = (op.buff || op.dual) ? `${n}/${flowrSelMax(op)}`
                                     : (n ? `${_flowrDeckSel[0].cd.rank}${_flowrDeckSel[0].cd.suit}` : 'none');
  const btn = document.getElementById('btn-play'); if (btn) btn.disabled = n === 0;
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
  if (!flowrDeckOrdinary(cd)) { refuse('Pick an ordinary card'); return; }
  const op = _flowrDeckOp;
  const id = String(cd._id);
  const i = _flowrDeckSel.findIndex(x => x.id === id);

  // ── ADJACENCY OPS: ONE source card, and a tap MOVES it. It no longer fires.
  if (op.adj) {
    if (i >= 0) { _flowrDeckSel = []; cardEl.classList.remove('flowr-src'); }
    else {
      document.querySelectorAll('#grid .card.flowr-src').forEach(el => el.classList.remove('flowr-src'));
      _flowrDeckSel = [{ id, r, c, cd, el: cardEl }];
      cardEl.classList.add('flowr-src');
    }
    flowrDeckSyncUI();
    try { sfxCardSelect?.(); } catch (e2) {}
    return;
  }

  // ── BUFF OPS: a connected group, capped at FLOWR_BUFF_MAX.
  if (i >= 0) {
    const rest = _flowrDeckSel.filter((_, k) => k !== i);
    if (!_flowrConnected(rest)) { refuse('That would split the group'); return; }
    _flowrDeckSel = rest; cardEl.classList.remove('flowr-sel');
  } else {
    if (_flowrDeckSel.length >= flowrSelMax(op)) { refuse(`Up to ${flowrSelMax(op)} cards`); return; }
    const cand = { id, r, c, cd, el: cardEl };
    if (_flowrDeckSel.length && !_flowrDeckSel.some(o => _flowrAdjacent(o, cand))) {
      refuse('Pick a card touching the ones you have'); return;
    }
    _flowrDeckSel.push(cand); cardEl.classList.add('flowr-sel');
  }
  flowrDeckSyncUI();
  try { sfxCardSelect?.(); } catch (e2) {}
}

// APPLY. One entry point for both kinds, so the button cannot end up wired to
// one of them (the whole reason the adjacency ops fired on a tap).
function flowrDeckConfirm() {
  if (_flowrDeckBusy || !_flowrDeckOp || !_flowrDeckSel.length) return;
  if (_flowrDeckOp.adj) { const s0 = _flowrDeckSel[0]; flowrAdjApply(s0.r, s0.c, s0.cd); }
  else if (_flowrDeckOp.dual) flowrDualConfirm();
  else flowrBuffConfirm();
}

// r392 SECOND SUIT / SECOND RANK. Each selected card rolls; a hit takes the
// suit (or rank) of ANOTHER card in the group, chosen at random - which can be
// its own suit again, making a double suit (two hearts), or its own rank (7/7).
function flowrDualConfirm() {
  if (_flowrDeckBusy || !_flowrDeckSel.length) return;
  const op = _flowrDeckOp;
  if (_flowrDeckSel.length < 2) { refuse('Pick at least 2 touching cards'); return; }
  _flowrDeckBusy = true;
  const _pb = document.getElementById('btn-play'); if (_pb) _pb.disabled = true;
  const p = (typeof luckChance === 'function') ? luckChance(FLOWR_DUAL_CHANCE) : FLOWR_DUAL_CHANCE;
  const sel = _flowrDeckSel.slice();
  let hits = 0;
  sel.forEach((s, i) => {
    const won = Math.random() < p;
    let donor = null;
    if (won) { const others = sel.filter(o => o !== s); donor = others[Math.floor(Math.random() * others.length)]; }
    setTimeout(() => {
      flowrRevealCard(s.el, won);
      if (!won || !donor) return;
      hits++;
      if (op.dual === 'suit') s.cd.suit2 = donor.cd.suit; else s.cd.rank2 = donor.cd.rank;
      if (typeof clearHandCompCache === 'function') clearHandCompCache();
    }, FLOWR_REVEAL_MS * (i + 1));
  });
  setTimeout(() => {
    try { render(); } catch (e) {}
    showMessage(`${op.icon} ${op.name} on ${hits} card${hits === 1 ? '' : 's'}`, '#e8b0ff');
    flowrDeckEnd();
  }, FLOWR_REVEAL_MS * (sel.length + 1) + 420);
}

// ── THE REVEAL (r378) ───────────────────────────────────────────────────────
// One card's result. Every candidate jiggles as its number lands, so a miss is
// something the player WATCHES rather than something they infer from a card
// that did not change. The classes carry the colour; .flowr-jig carries the
// movement and is removed after it so a second reveal on the same card - a
// board that a later step edits again - restarts it.
function flowrRevealCard(el, won) {
  if (!el) return;
  el.classList.remove('flowr-sel', 'flowr-src', 'flowr-jig');
  void el.offsetWidth;
  el.classList.add(won ? 'flowr-won' : 'flowr-miss', 'flowr-jig');
  setTimeout(() => el.classList.remove('flowr-jig'), 420);
  try { (won ? sfxRewardGood : sfxRewardBad)?.(); } catch (e) {}
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

// ── Adjacency ops: APPLY rolls, then every NEIGHBOUR reveals ─────────────────
// EVERY eligible neighbour is revealed, not just the ones the roll took. A card
// the roll passed over used to do nothing at all and look no different from a
// card that was never a candidate, so "1-3 adjacent cards" was a promise the
// screen never showed the player being kept.
function flowrAdjApply(r, c, sel) {
  const op = _flowrDeckOp;
  const neigh = (typeof getNeighborsOrtho === 'function' ? getNeighborsOrtho(r, c) : [])
    .filter(([nr, nc]) => flowrDeckOrdinary(gridData[nr]?.[nc])
      && !(typeof isCellBlocked === 'function' && isCellBlocked(nr, nc)));
  if (!neigh.length) { refuse('No ordinary card next to that one'); return; }
  _flowrDeckBusy = true;
  const _pb = document.getElementById('btn-play'); if (_pb) _pb.disabled = true;
  const count = Math.min(neigh.length, flowrQtyRoll(op.max));
  const order = shuffle(neigh.slice());
  const won = new Set(order.slice(0, count).map(([nr, nc]) => nr + ',' + nc));
  const gridEl = document.getElementById('grid');
  const elOf = (rr, cc) => {
    const cd = gridData[rr]?.[cc];
    return cd ? gridEl?.querySelector(`[data-card-id="${cd._id}"]`) : null;
  };
  // The reveal walks the neighbours in BOARD order, not in roll order - the
  // roll's own order would leak which ones won before their card moved.
  neigh.forEach(([tr, tc], i) => {
    setTimeout(() => {
      const hitIt = won.has(tr + ',' + tc);
      flowrRevealCard(elOf(tr, tc), hitIt);
      if (!hitIt) return;
      const t = gridData[tr]?.[tc];
      if (!t) return;
      if (op.id === 'suit') { t.suit = sel.suit; }
      else if (op.id === 'rank') {
        const ord = (typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS) ? ACTIVE_RANKS : RANKS;
        const si = ord.indexOf(sel.rank), ti = ord.indexOf(t.rank);
        if (si >= 0 && ti >= 0 && si !== ti) t.rank = ord[ti + (si > ti ? 1 : -1)];
      }
      else if (op.id === 'copy') { t.rank = sel.rank; t.suit = sel.suit; }
      else if (op.id === 'del') {
        if (typeof expectedDeckTotal !== 'undefined') expectedDeckTotal--;
        gridData[tr][tc] = (typeof drawCard === 'function' ? drawCard() : null) || null;
      }
    }, FLOWR_REVEAL_MS * (i + 1));
  });
  setTimeout(() => {
    try { render(); } catch (e) {}
    if (typeof updateDeckHud === 'function') updateDeckHud();
    showMessage(`${op.icon} ${op.name}: ${count} card${count === 1 ? '' : 's'}`, '#4aa3e0');
    flowrDeckEnd();
  }, FLOWR_REVEAL_MS * (neigh.length + 1) + 420);
}

// ── Buff ops: selection then APPLY, with a one-by-one reveal ─────────────────
function flowrBuffConfirm() {
  if (_flowrDeckBusy || !_flowrDeckSel.length) return;
  _flowrDeckBusy = true;
  const op = _flowrDeckOp, b = op.buff;
  const q = Math.min(_flowrDeckSel.length, flowrQtyRoll(FLOWR_BUFF_MAX));
  const winners = new Set(shuffle(_flowrDeckSel.slice()).slice(0, q).map(s => s.id));
  const v = flowrValRoll(b.range);
  const label = flowrBuffLabel(b, v);   // shared with the card packs - one wording
  const _pb = document.getElementById('btn-play'); if (_pb) _pb.disabled = true;
  _flowrDeckSel.forEach((s, i) => {
    setTimeout(() => {
      const won = winners.has(s.id);
      flowrRevealCard(s.el, won);
      if (won) enhanceCardKey(cardId(s.cd), { [b.key]: v });
    }, FLOWR_REVEAL_MS * (i + 1));
  });
  setTimeout(() => {
    try { render(); } catch (e) {}
    showMessage(`${op.icon} ${label} on ${q} card${q === 1 ? '' : 's'}`, '#5ad4c0');
    flowrDeckEnd();
  }, FLOWR_REVEAL_MS * (_flowrDeckSel.length + 1) + 420);
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
  document.querySelectorAll('.flowr-sel, .flowr-src, .flowr-hit, .flowr-won, .flowr-miss, .flowr-jig')
    .forEach(el => el.classList.remove('flowr-sel', 'flowr-src', 'flowr-hit', 'flowr-won', 'flowr-miss', 'flowr-jig'));
  if (typeof exitGridScreenHud === 'function') exitGridScreenHud();
  _flowrDeckOp = null; _flowrDeckSel = []; _flowrDeckBusy = false;
  // r380: THE REVEAL GETS A BEAT, then the board explodes out. It used to cut
  // straight to the next screen the moment the last card turned - the owner's
  // "too jumpy". The cards removed here are rebuilt by whatever comes next: a
  // takeover empties #grid anyway, and the chain's level-up deals the board in.
  // r393: a reward-grid dual tile runs this editor on the round's own board and
  // hands back to the round instead of the Flow chain.
  if (flowrDeckDone) { const cb = flowrDeckDone; flowrDeckDone = null; try { render(); } catch (e) {} setTimeout(cb, 700); return; }
  if (typeof rewardTransitionOut === 'function') rewardTransitionOut(() => flowrAfterStep(), { breathe: 800 });
  else flowrAfterStep();
}
let flowrPendingDual = null, flowrDeckDone = null;
// Called at the top of startRoundTimer: true = the editor took over first.
function flowrMaybeRunPendingDual() {
  if (!flowrPendingDual || (typeof bossActive !== 'undefined' && bossActive)) return false;
  if (!gridData.some(row => row && row.some(c => c && !c._isSleight))) return false;
  const op = flowrPendingDual; flowrPendingDual = null;
  flowrDeckDone = () => { gameTimerPaused = false; startRoundTimer(); };
  flowrDeckBegin(op);
  return true;
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
// THE CHIP PICKER IS BUILT FROM FLOWR_CHIPS, so a new look is one row in that
// table and nothing here. Built once and then only written - a rebuild would
// reset the select while it is open (the r282 NS-editor rule).
// r394: it lives in the AESTHETICS group now (owner: "for this type of stuff it
// can all go in aesthetics"), so it is its own function rather than a block
// inside the chain's sync - one picker, whichever group opens it.
function flowrSyncChipPicker() {
  const chip = document.getElementById('dev-flowr-chip');
  if (!chip) return;
  if (!chip.options.length) chip.innerHTML = FLOWR_CHIPS
    .map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if (document.activeElement !== chip) chip.value = flowrChipStyle;
  const note = document.getElementById('dev-flowr-chip-note');
  if (note) note.textContent = (FLOWR_CHIPS.find(c => c.id === flowrChipStyle) || {}).note || '';
}

function flowrDevSync() {
  const cfg = flowrCfg();
  flowrSyncChipPicker();
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
  const sim  = flowrSimShare(20000);      // what the damping actually delivers
  FLOWR_KIND_IDS.forEach(k => {
    const eo = document.getElementById('dev-flowr-odds-' + k);
    if (eo && document.activeElement !== eo) eo.value = cfg.odds[k];
    const pc = eo && eo.parentElement.querySelector('.dev-flowr-pct');
    // The MEASURED share, not the weight normalised - see flowrSimShare.
    if (pc) pc.textContent = ' \u2192' + (sim[k] || 0).toFixed(1) + '%';
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
