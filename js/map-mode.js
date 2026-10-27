// ══════════════════════════════════════════════
// MAP MODE (r238) - the run is a board you walk
// ══════════════════════════════════════════════
// EACH QUARTER is a MAP: 4 lanes x MAP_SETS sets of tiles, then a full-width
// boss. r655 (owner): 4 x 4, the slots read TOP TO BOTTOM in both orientations,
// drawn as a terminal to-do list (mapRender) with its toolbar at the foot. Beat it and the quarter closes, a fresh map is drawn, and the run is
// one of those per quarter (r252) - the same shape every act mode has.
// The grid IS the map (the same borrow the shop makes): tiles fall in like a
// deal, you pick one, CONFIRM, the map falls out the bottom, the grid resizes
// back to play size and the round deals in behind the 3-2-1.
//
// ── The rules, as agreed with the owner ──────────────────────────────────────
// - THE PICK RULE (r648, the default): in each set you take ANY two of its solid
//   tiles, in any order, adjacent or not, and every tile you take happens. Then
//   you move on, and the next set may be entered at ANY lane. `mapPickRule()`.
// - THE OLD RULE (dev -> Schedule -> Adjacent moves, `mapAdjacentRule`):
//   movement is STRICTLY ORTHOGONAL. Within a set you may visit at most 2 tiles
//   (so the two must be vertically adjacent); moving forward enters the next set
//   at your lane. Free branch (below) is a variant of this rule only.
// - Leaving a set after only ONE visit pays the quarter's department's Standard
//   reward, first tier (r673, js/departments.js; it was 6, 8, 10... credits).
// - Set 1 is ALL LEVELS. Sets 2..5 each carry at least one level. The final
//   set is the FUNNEL: non-level tiles only, and how many of its four lanes
//   carry one is a roll (r253). It books TWO like any other slot (r293) - at a
//   two-solid funnel they sit on non-adjacent lanes, so the board is what
//   limits you to one there, not a rule.
// - Two BLANKS somewhere in the middle sets (never set 1). Inert by default -
//   they cannot be stepped on or through. Up to two MYSTERY tiles hide their
//   kind until confirmed (they still count toward the minimums underneath).
// - A rare 2x1 EVENT tile spans two sets lengthways. It charges ONE visit,
//   lands you in its second set with that visit spent, and you can never go
//   back to its first set. Under the pick rule it is taken like any tile of its
//   first set (as that set's first or second pick), and the visit it spends is
//   its second set's, so you have one more pick there.
// - Every tile advances the difficulty curve (Guided's load-bearing rule):
//   levels through triggerLevelUp, everything else through guidedAdvanceCurve.
// - The boss goal is FIXED at map build: MAP_BOSS_LEVELS levels of a steeper
//   curve than Classic's, from the level the QUARTER OPENS ON, previewable from
//   the map before you can reach it.
//
// ── DEAD ENDS ARE REFUSED, NOT DISCOVERED ────────────────────────────────────
// (The old rule. Under the pick rule a set is left for any solid tile of the
// next, so nothing strands; mapPickCanFinish checks it rather than assumes it.
// Generation still validates against the old rule's DP, so every map is safe
// under both and the dev toggle can flip mid-run.)
// Strict orthogonality + inert blanks means a route can strand you: at 2 visits
// you must go forward, and forward can be a blank. mapCanFinishFrom() is a memo
// DP over (lane, set, visits) that answers "can the boss still be reached from
// here"; generation requires it true from all four starts, and mapReachable()
// refuses any move into a doomed state, with the bar saying why. The sacrifice
// stays (tiles you cannot have); the unwinnable run does not.
//
// ── WHAT THIS FILE DELIBERATELY REUSES ───────────────────────────────────────
// guidedAdvanceCurve (the curve bump), guidedPendingChallenge + the apply/settle
// pair (challenge rounds), guidedOpenPickThree (the post-level pick),
// guidedOpenNamedEvent (event tiles), rollChallengeLevel (the challenge table),
// the shop's grid-borrow pattern (openShopGrid), and the interlude/finishInterlude
// seams Guided already cut. The map is routing, not new machinery.

const MAP_LANES = 4;
const MAP_SETS  = 4;              // regular sets (r655: was 6); the boss row is index MAP_SETS
const MAP_BOSS_SET = MAP_SETS;    // 4
// The minimums a map is built and validated against (r655: 2/2/3/2 on the old 4 x 6).
const MAP_MINIMUMS = [['shop', 1], ['challenge', 1], ['event', 2], ['reward', 1]];
// The day the to-do list prints down its left edge: one time per slot, then the review.
const MAP_SLOT_TIMES = ['09:00', '11:00', '13:00', '15:00', '17:00'];
const MAP_MAX_MYSTERY = 2;
// Blanks are a ROLL, not a fixture: about half of maps carry two, the rest one
// or none, so "is there a dead cell in my way" is a thing you read off the map
// rather than a constant you learn once. Index = number of blanks.
const MAP_BLANK_ODDS = [0.12, 0.38, 0.50];
const MAP_BLANKS_MAX = MAP_BLANK_ODDS.length - 1;
// How many of the funnel's four lanes carry a real tile. Two is the old fixed
// shape and is now the least likely; four means no structural blanks at all.
const MAP_FUNNEL_SOLID_ODDS = { 2: 0.25, 3: 0.40, 4: 0.35 };
// What fills the free middle cells once the minimums are placed, by weight.
// Share of the challenge tiles that are an AUDIT (a challenge round) rather than
// a PRIORITY account (r444).
const MAP_AUDIT_SHARE = 0.5;
const MAP_FILL_W = [['level', 30], ['event', 26], ['reward', 20], ['shop', 10], ['challenge', 10], ['limitbreak', 4]];
function mapRollFunnelSolid() {
  // Weights (r409: tunable in dev -> Probabilities), so normalised by the total.
  const tot = [2, 3, 4].reduce((t, k) => t + Math.max(0, MAP_FUNNEL_SOLID_ODDS[k] || 0), 0) || 1;
  let r = Math.random() * tot;
  for (const k of [2, 3, 4]) { r -= Math.max(0, MAP_FUNNEL_SOLID_ODDS[k] || 0); if (r < 0) return k; }
  return 4;
}
function mapRollBlanks() {
  const tot = MAP_BLANK_ODDS.reduce((t, w) => t + Math.max(0, w || 0), 0) || 1;
  let r = Math.random() * tot;
  for (let i = 0; i < MAP_BLANK_ODDS.length; i++) {
    r -= Math.max(0, MAP_BLANK_ODDS[i] || 0);
    if (r < 0) return i;
  }
  return MAP_BLANKS_MAX;
}
// The boss quota: MAP_BOSS_LEVELS levels of a curve a notch steeper than
// Classic's GOAL_SCALE (1.35). Computed once at run start so the map can print
// it before the first tile is taken.
// r655: 9 -> 6.5 for the 4 x 4 map. A quarter is 8 bookings, not 12, so the
// review is met around level 9, not 13 (goal 5,638 at Q1, not 11,000). 9 levels
// would ask 12,000 there (2.1x); 6.5 asks 6,500, about 1.15x the goal of the
// level you meet it on, where 9 asked 1.09x of level 13's. The sim bot wins the
// 4 x 4 at 94-96% between 6 and 7 (tools/sim, an 8-tile walk, handTime 6).
const MAP_BOSS_LEVELS = 6.5;
// r278: 1.40 -> 1.30. A Schedule level advances on every obligation, so its own
// per-level growth (MAP_GOAL_GROWTH, read by mapGoalForLevel in js/goal-tuning.js)
// is much flatter than Classic's - and the review quota has to flatten with it or
// the review dwarfs everything the quarter built toward. Measured in the bot
// sweep: at 18%/level, a 14.8x quota killed 98% of failed runs AT the review;
// 8.2x (1.30^8) splits the deaths between late obligations and the review.
const MAP_BOSS_SCALE  = 1.30;
// The Schedule's per-level goal growth, percent. Its own number because the
// Schedule advances `level` about twice as fast as Classic advances per played
// round (bought obligations move the curve too - the mode's load-bearing rule).
const MAP_GOAL_GROWTH = 18;
// The knack-only pick after a challenge round rolls its rarities as if the
// player held +20 Luck (a temporary luckModifiers bump around the draw - the
// odds shift exactly as 20 real Luck would, and nothing is permanently added).
const MAP_CHALLENGE_LUCK = 20;

function mapActive() { return !!ACTIVE_MODE && ACTIVE_MODE.map === true; }

// ── Run state (all JSON-safe; in SAVE_VARS) ──────────────────────────────────
let mapTiles = [];          // flat list of tile objects
let mapPos = null;          // { lane, set } of the last resolved tile, or null
let mapVisits = 0;          // visits in the current set
// Dev toggle: move out from ANY tile you have already taken, not only the one
// you are standing on. Persisted, because it changes how a whole run navigates.
let mapFreeBranch = false;
try { mapFreeBranch = localStorage.getItem('lethe.map.freeBranch') === '1'; } catch (e) {}
function setMapFreeBranch(on) {
  mapFreeBranch = !!on;
  try { localStorage.setItem('lethe.map.freeBranch', mapFreeBranch ? '1' : '0'); } catch (e) {}
  if (mapScreenOpen) { mapRender(); mapRenderBar(); }
}
// r648 (owner): the default is the PICK rule, any two tiles of a set. The old
// orthogonal walk is a dev option; stored only when on (overrides only).
const MAP_ADJ_KEY = 'lethe.map.adjacent';
let mapAdjacentRule = false;
try { mapAdjacentRule = localStorage.getItem(MAP_ADJ_KEY) === '1'; } catch (e) {}
function setMapAdjacentRule(on) {
  mapAdjacentRule = !!on;
  try { if (mapAdjacentRule) localStorage.setItem(MAP_ADJ_KEY, '1'); else localStorage.removeItem(MAP_ADJ_KEY); } catch (e) {}
  if (mapScreenOpen) { mapSelected = null; mapRender(); mapRenderBar(); }
}
function mapPickRule() { return !mapAdjacentRule; }
// Free branch is a variant of the old rule; under the pick rule it changes nothing.
function mapFreeBranchOn() { return mapAdjacentRule && mapFreeBranch; }
let mapSkips = 0;           // skips paid so far this run
let mapBossGoal = 0;        // fixed quota, computed at run start
let mapBossArmed = false;   // boss tile confirmed; prize grid routes to the win
let mapFirstRoundDone = false; // round 1 rides startGame's own deal, not triggerLevelUp

// Transient (never saved)
let mapScreenOpen = false;
let mapGridSaved = null;    // { rows, cols } to restore on close
let mapSelected = null;     // tile id currently picked, pending CONFIRM
let mapLandscape = true;    // orientation captured at open
let mapLastWasChallenge = false;

function mapResetRun() {
  // A run abandoned with the map open must not leak its screen into the next
  // one - the bar and body class are body-level and survive a startGame.
  if (mapScreenOpen) mapCloseScreen();
  document.getElementById('map-bar')?.classList.remove('show');
  document.body.classList.remove('map-active');
  mapFirstRoundDone = false;
  if (typeof deptReset === 'function') deptReset();   // r673: a new run draws its departments afresh
  mapResetBoard();
}

// Everything a FRESH MAP needs, and nothing a fresh RUN needs. The two are not
// the same thing since r252: a run is QUARTERS_PER_RUN quarters and each one draws
// its own map, so `mapFirstRoundDone` (round 1 rides startGame's own deal) is reset
// by mapResetRun ALONE and never here - every later quarter opens on a level-up.
function mapResetBoard() {
  mapTiles = []; mapPos = null; mapVisits = 0; mapSkips = 0;
  mapBossArmed = false; mapPosTileId = null;
  mapScreenOpen = false; mapSelected = null; mapLastWasChallenge = false;
  mapBossGoal = mapQuarterBossGoal();
  if (typeof mapDrawStrokes !== 'undefined') { mapDrawStrokes = []; mapPenOn = false; }
  if (mapActive()) mapGenerate();
}

// A saved run from the 4 x 6 schedule (before r655) holds tiles past this
// shape's review row; its quarter is drawn again on the new shape. Run state
// (skips, the quarter, the curve) is untouched. Called from restoreRun.
function mapRepairShape() {
  if (!mapActive() || !mapTiles.length) return;
  const boss = mapTiles.find(t => t.kind === 'boss');
  if (boss && boss.set === MAP_BOSS_SET && !mapTiles.some(t => t.set > MAP_BOSS_SET)) return;
  const skips = mapSkips;
  mapResetBoard();
  mapSkips = skips;
}

// The boss quota is FIXED at map build, and ANCHORED TO THE LEVEL THE QUARTER
// OPENS ON: MAP_BOSS_LEVELS of the steeper curve from here. At Q1 that reads
// goalForLevel(1) = BASE_GOAL (1500 -> a 12,000 quota since the r278 retune;
// the pre-r278 numbers were 1200 x 1.40^8 = 17,500). Q2 and Q3 open around
// level 11 and 21, so they ask for what a quarter of progress from THERE is
// worth rather than repeating Q1's number three times.
function mapQuarterBossGoal() {
  const base = (typeof goalForLevel === 'function')
    ? goalForLevel(Math.max(1, level || 1))
    : BASE_GOAL;
  return Math.round(base * Math.pow(MAP_BOSS_SCALE, MAP_BOSS_LEVELS - 1) / 500) * 500;
}

// ── Tile helpers ─────────────────────────────────────────────────────────────
let _mapTileId = 0;
let mapPosTileId = null;   // the tile the player is standing on (for the ring)
// The tile occupying a cell, treating a 2x1's tail as its head.
function mapCellTile(lane, set) {
  for (const t of mapTiles) {
    if (t.lane === lane && t.set === set) return t;
    if (t.span === 2 && t.lane === lane && t.set + 1 === set) return t;
  }
  return null;
}
function mapCellSolid(lane, set) {           // a real, steppable tile lives here
  const t = mapCellTile(lane, set);
  return !!t && t.kind !== 'blank';
}

// A TILE IS ITS SYMBOL (r276, owner's call). `name` is the short chip and
// `full` the name in full, and both are read in the BAR and the LEGEND - the
// board itself carries only the glyph, so a schedule reads at a glance.
// Schedule vocabulary (r261): an obligation is a piece of work on your day.
//
// A hard round is a PLAY SYMBOL WITH A ! IN IT, which no character in Unicode
// is, so it is a tiny inline SVG. The bang is a HOLE (`fill-rule:evenodd`,
// one path) rather than a second shape in the tile's colour - a hole works on
// the wash, the watermark and the legend chip alike, and `currentColor` +
// `1em` let it sit anywhere the emoji do.
const MAP_ICON_PRIORITY =
  '<svg class="mk-svg" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd">' +
  '<path d="M4 3 L20 12 L4 21 Z M8.3 7.4 h2.3 v6.3 h-2.3 z M8.3 15.1 h2.3 v2.3 h-2.3 z"/></svg>';
const MAP_KIND_META = {
  level:      { icon: '▶\uFE0E', name: 'ACCOUNT',   full: 'Client Account',   cls: 'mk-level',
                blurb: 'An ordinary round. Clear it and take a pick of three.' },
  challenge:  { icon: MAP_ICON_PRIORITY, name: 'PRIORITY', full: 'Priority Account', cls: 'mk-challenge',
                blurb: 'A round with a raised goal and one extra ask. Pays credits and a knack.' },
  // r444: half the challenge tiles are an AUDIT instead - a challenge round
  // (js/challenge-round.js). Same tile kind; `t.audit` picks the face.
  audit:      { icon: '⚑\uFE0E', name: 'AUDIT', full: 'Audit', cls: 'mk-audit',
                blurb: `A round with ${CR_CARDS} challenge cards on top of the goal, and an extra minute. Each card solved pays its reward; run out of time and you pick penalties.` },
  shop:       { icon: '$', name: 'MART',      full: 'LETHE Mart',       cls: 'mk-shop',
                blurb: 'The company store. Spend credits on anything on the shelves.' },
  reward:     { icon: '▦', name: 'INCENTIVE', full: 'Incentive Program', cls: 'mk-reward',
                blurb: 'A board of rewards. Pick a connected path across it.' },
  event:      { icon: '✧', name: 'EVENT',     full: 'Event',            cls: 'mk-event',
                blurb: 'One screen, one decision. The tile names which.' },
  limitbreak: { icon: '▲', name: 'RAISE',     full: 'Raise Request',    cls: 'mk-limit',
                blurb: 'Raise a limit, or trade one away for credits.' },
  blank:      { icon: '',  name: '',          full: 'Not scheduled',    cls: 'mk-blank',
                blurb: 'Nothing booked there, and no way through it.' },
  boss:       { icon: '☠\uFE0E', name: 'REVIEW',    full: 'Manager Review',   cls: 'mk-boss',
                blurb: 'The end of the schedule, on its own quota.' },
};

function mapTileFace(t) {
  // What the PLAYER sees - a mystery hides its kind until confirmed.
  if (t.mystery && !t.revealed) return { icon: '?', name: '???', full: 'Unconfirmed', cls: 'mk-mystery' };
  const m = MAP_KIND_META[t.audit ? 'audit' : t.kind] || MAP_KIND_META.event;
  if (t.kind === 'event' && t.eventName) return { ...m, name: t.eventName };
  return m;
}
// `legalIds` (the ids bookable now) lets the stakes say "if booked next"; without
// it they are worked out here.
function mapTileDesc(t, legalIds) {
  if (t.mystery && !t.revealed) return 'Unconfirmed until you commit to it.';
  const G = mapGoalWord();
  const st = mapTileStake(t, legalIds || mapLegalIds());
  const goal = st && st.goal ? ` ${G} ${st.goal.toLocaleString()}${st.k > 1 ? ' or more' : ''}.` : '';
  switch (t.kind) {
    case 'level':      return `Play a round.${goal} Clear it for the payout and a pick of three.`;
    case 'challenge':  if (t.audit) return MAP_KIND_META.audit.blurb + goal;
                       return (t.challenge ? t.challenge.label + ' ' : '')
      + `${G} +${Math.round(((t.challenge?.goalMult || 1.2) - 1) * 100)}%.${goal} Pays +${t.challenge?.credits || 0} credits and a knack pick.`;
    case 'shop':       return `The company store. Buy Tricks, Sleights, Knacks and upgrades. You hold ${coins} credits.`;
    case 'reward':     return `A ${limits.grid_rows.current}x${limits.grid_cols.current} board of rewards. Take a connected path of up to ${mapRewardPath()} tiles.`;
    case 'event':      return t.eventFlavor || 'Something happens.';
    case 'limitbreak': return 'Raise a limit, or trade one away for credits.';
    case 'boss': {
      const b = peekBossPresetSafe();
      return (b ? b.name + '. ' : '') + (b?.brief || 'The end of the schedule.') + ` ${G}: ${mapReviewGoalShown().toLocaleString()}.`;
    }
  }
  return '';
}

// ── LINE ITEMS (r656, owner's pick: SCHEDULE_IDEAS.md idea 1) ─────────────────
// Every line prints its stakes: a round the goal it will ask, the store what you
// can spend, a reward board the path you take. The goal is read the way
// triggerLevelUp writes it (the curve, Quota Revision, a hard round's raise, The
// Investment's cut) for the next booking. A line further down cannot be reached
// sooner than one booking a slot, so it prints the least it can ask, with a "+".
function mapGoalWord() { return (typeof lexTerm === 'function') ? lexTerm('goal') : 'GOAL'; }
function mapLegalIds() { return new Set(mapLegalMoves().filter(m => !m.doomed).map(m => m.tile.id)); }
function mapRewardPath() { return (typeof rewardSelectionCap === 'function') ? rewardSelectionCap() : limits.selection.current; }
// tickAltarEffects at the next level-up: an effect not yet started starts, a
// started one counts down first. The goal cut that is live after it applies.
function mapAltarNextMult() {
  const live = (typeof altarEffects !== 'undefined' ? altarEffects : [])
    .filter(e => e.started ? e.roundsLeft - 1 > 0 : e.roundsLeft > 0);
  const eff = live.find(e => e.type === 'goal_reduce');
  return eff ? eff.value : 1;
}
// Bookings from now until this tile, at the soonest: 1 if it is bookable now,
// otherwise one for each slot in between (a slot cannot be skipped). Null for a
// tile behind you.
function mapTileSoonest(t, legalIds) {
  if (legalIds && legalIds.has(t.id)) return 1;
  if (t.visited) return null;
  if (!mapPos) return t.set + 1;
  return t.set > mapPos.set + 1 ? t.set - mapPos.set : null;
}
// The goal a round tile asks if it is your k-th booking from now. Round 1 rides
// startGame's own deal, so the run's first booking does not level up.
function mapGoalPreview(t, k) {
  if (!mapFirstRoundDone && k === 1) return roundGoal;
  const lv = level + k - (mapFirstRoundDone ? 0 : 1);
  let g = goalForLevel(lv);
  if (goalPenaltyMult > 1) g = Math.round(g * goalPenaltyMult / 50) * 50;
  const gm = (t.kind === 'challenge' && !t.audit) ? (t.challenge?.goalMult || 1) : 1;
  if (gm !== 1) g = Math.round(g * gm / 50) * 50;
  if (k === 1) { const a = mapAltarNextMult(); if (a !== 1) g = Math.max(50, Math.round(g * a / 50) * 50); }
  return g;
}
function mapNum(n) {
  return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'
       : n >= 1e4 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K'
       : n.toLocaleString();
}
// The short stake a line prints under its word, or null.
function mapTileStake(t, legalIds) {
  if (t.kind === 'blank' || t.kind === 'boss' || t.visited || (t.mystery && !t.revealed)) return null;
  const k = mapTileSoonest(t, legalIds);
  if (!k) return null;
  switch (t.kind) {
    case 'level': case 'challenge': {
      const g = mapGoalPreview(t, k);
      return { short: `${mapGoalWord()} ${mapNum(g)}${k > 1 ? '+' : ''}`, goal: g, k };
    }
    case 'shop':       return { short: `◆ ${coins}` };
    case 'reward':     return { short: `PATH OF ${mapRewardPath()}` };
    case 'limitbreak': return { short: '+1 LIMIT' };
  }
  return null;
}
function peekBossPresetSafe() {
  try { return (typeof peekBossPreset === 'function') ? peekBossPreset() : null; }
  catch (e) { return null; }
}

// ══════════════════════════════════════════════
// GENERATION - random fill, then validate-or-retry
// ══════════════════════════════════════════════
// Constraint fix-ups are a swamp; a fresh roll is not. Fill randomly under the
// guarantees, then test EVERY structural rule at once and re-roll the whole map
// if any fails - the same validate-and-redeal shape tutorialQualifyBoard uses.
function mapGenerate() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const tiles = _mapBuildOnce();
    if (tiles && _mapValidate(tiles)) { mapTiles = tiles; return; }
  }
  // 80 straight failures means a rule is unsatisfiable - keep the last build
  // rather than an empty map, and say so in dev.
  mapTiles = _mapBuildOnce() || [];
  console.warn('[MAP] generation fell back past validation');
}

function _mapBuildOnce() {
  _mapTileId = 0;
  const tiles = [];
  const put = (lane, set, kind, extra) => {
    const t = { id: 'mt' + (++_mapTileId), lane, set, kind, span: 1, visited: false, ...(extra || {}) };
    tiles.push(t); return t;
  };

  // Set 1: all levels - the guaranteed clean start.
  for (let l = 0; l < MAP_LANES; l++) put(l, 0, 'level');

  // The boss: one tile spanning every lane past the funnel.
  put(0, MAP_BOSS_SET, 'boss');

  // The funnel (last set): non-level tiles, and you take exactly ONE of them
  // whatever is there - mapLegalMoves offers only the boss once you are in it.
  // So how many lanes are solid is free to be a ROLL rather than a fixture: it
  // was always two solid and two structural blanks, which made the last choice
  // before the boss the same shape every map and cost the set before it a
  // second visit whenever your lane's funnel cell was one of the holes.
  const fsolid = mapRollFunnelSolid();
  const funnelKinds = _mapShuffle(['shop', 'reward', 'event', 'challenge', 'limitbreak']);
  // At two solid they sit on NON-ADJACENT lanes, which is the original funnel
  // shape: two options as far apart as the board allows.
  const flanes = fsolid === 2
    ? [[0, 2], [0, 3], [1, 3]][Math.floor(Math.random() * 3)]
    : _mapPickN([0, 1, 2, 3], fsolid);
  for (let l = 0; l < MAP_LANES; l++) {
    const i = flanes.indexOf(l);
    if (i >= 0) put(l, MAP_SETS - 1, funnelKinds[i % funnelKinds.length]);
    else put(l, MAP_SETS - 1, 'blank');
  }

  // Middle sets (1 .. MAP_SETS-2): 0-2 blanks in distinct sets, one level per
  // set, minimums topped up, the rest drawn by weight. Fewer blanks FREES cells,
  // so the minimums only ever get easier to satisfy.
  const midSets = [];
  for (let s = 1; s <= MAP_SETS - 2; s++) midSets.push(s);
  const blankSets = _mapPickN(midSets, mapRollBlanks());
  const free = [];   // [lane, set] cells still to fill
  midSets.forEach(s => {
    const lanes = [0, 1, 2, 3];
    if (blankSets.includes(s)) {
      const bl = lanes.splice(Math.floor(Math.random() * lanes.length), 1)[0];
      put(bl, s, 'blank');
    }
    const lv = lanes.splice(Math.floor(Math.random() * lanes.length), 1)[0];
    put(lv, s, 'level');
    lanes.forEach(l => free.push([l, s]));
  });

  // Top the minimums up, counting what the funnel already placed.
  const count = k => tiles.filter(t => t.kind === k).length;
  for (const [k, min] of MAP_MINIMUMS) {
    let missing = min - count(k);
    while (missing-- > 0 && free.length) {
      const [l, s] = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      put(l, s, k);
    }
  }
  // The rest by weight. r673: the quarter's department makes its own kind likelier.
  const W = (typeof deptFillWeights === 'function') ? deptFillWeights(MAP_FILL_W) : MAP_FILL_W;
  const wTotal = W.reduce((a, [, w]) => a + w, 0);
  while (free.length) {
    const [l, s] = free.pop();
    let r = Math.random() * wTotal;
    let kind = 'level';
    for (const [k, w] of W) { r -= w; if (r <= 0) { kind = k; break; } }
    put(l, s, kind);
  }

  // Mysteries: up to MAP_MAX_MYSTERY, never in set 1, never a blank. They keep
  // their real kind underneath - which is what lets them count toward the
  // minimums, and lets a tryhard guess at what is hidden.
  const mysteryable = tiles.filter(t => t.set > 0 && t.kind !== 'blank' && t.kind !== 'boss');
  const _mMax = (typeof deptMysteryMax === 'function') ? deptMysteryMax(MAP_MAX_MYSTERY) : MAP_MAX_MYSTERY;
  _mapPickN(mysteryable, Math.floor(Math.random() * (_mMax + 1)))
    .forEach(t => { t.mystery = true; });

  // One 2x1 event, half the time: an event in sets 2..4 absorbs the cell ahead
  // of it. Refused when the absorbed cell is a blank, a mystery, or the only
  // level of its set (validation would catch it, but this keeps the retry rate
  // sane).
  if (Math.random() < 0.5) {
    const heads = tiles.filter(t => t.kind === 'event' && !t.mystery && t.set >= 1 && t.set <= MAP_SETS - 3);
    _mapShuffle(heads);
    for (const h of heads) {
      const ahead = tiles.find(t => t.lane === h.lane && t.set === h.set + 1);
      if (!ahead || ahead.kind === 'blank' || ahead.mystery) continue;
      if (ahead.kind === 'level'
          && tiles.filter(t => t.set === ahead.set && t.kind === 'level').length < 2) continue;
      tiles.splice(tiles.indexOf(ahead), 1);
      h.span = 2;
      break;
    }
  }

  // Names: distinct event ids, and each challenge tile rolls its requirement
  // now, so the map can print it before the tile is taken. The stored challenge
  // is DATA ONLY (no test function) - it is rehydrated from CHALLENGE_DEFS by
  // id at confirm time, which is what keeps mapTiles JSON-safe for SAVE_VARS.
  // Events that can do something, only (js/events-core.js) - a map tile is one of
  // twelve free slots and a dead event spends one of them.
  const evPool = (typeof EVENT_META !== 'undefined')
    ? _mapShuffle((typeof eligibleEventIds === 'function')
        ? eligibleEventIds(Object.keys(EVENT_META)) : Object.keys(EVENT_META).slice())
    : [];
  let ei = 0;
  const evUsed = new Set(), auditShare = (typeof deptAuditShare === 'function') ? deptAuditShare(MAP_AUDIT_SHARE) : MAP_AUDIT_SHARE;
  tiles.forEach(t => {
    if (t.kind === 'event') {
      // r673: the department's own events come up DEPT_CFG.eventPct of the time.
      const id = (typeof deptEventPick === 'function') ? deptEventPick(evPool, evUsed) : (evPool.length ? evPool[ei++ % evPool.length] : null);
      if (id) evUsed.add(id);
      t.eventId = id;
      t.eventName = id ? EVENT_META[id].name : 'Event';
      t.eventFlavor = id ? EVENT_META[id].flavor : '';
    }
    if (t.kind === 'challenge' && Math.random() < auditShare) { t.audit = true; return; }
    if (t.kind === 'challenge') {
      const ch = rollChallengeLevel();
      t.challenge = { id: ch.id, label: ch.label, goalMult: ch.goalMult, credits: ch.credits };
    }
  });
  return tiles;
}

function _mapPickN(arr, n) {
  const a = arr.slice(); _mapShuffle(a); return a.slice(0, Math.max(0, n));
}
function _mapShuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function _mapValidate(tiles) {
  // The minimums, re-checked HERE and not only at build: the 2x1 absorb removes
  // the cell ahead of its head, which can silently eat a shop or event the
  // build placed to satisfy them. Measured before this check: 12% of maps
  // shipped short of a minimum.
  const count = k => tiles.filter(t => t.kind === k).length;
  if (MAP_MINIMUMS.some(([k, min]) => count(k) < min)) return false;
  for (let s = 1; s <= MAP_SETS - 2; s++)
    if (!tiles.some(t => t.set === s && t.kind === 'level')) return false;
  const kindAt = (l, s) => {
    for (const t of tiles) {
      if (t.lane === l && t.set === s) return t.kind;
      if (t.span === 2 && t.lane === l && t.set + 1 === s) return t.kind;
    }
    return null;
  };
  // No 2x2 window of one kind (blanks and empty cells never match each other).
  for (let l = 0; l < MAP_LANES - 1; l++) for (let s = 0; s < MAP_SETS - 1; s++) {
    const k = kindAt(l, s);
    if (!k || k === 'blank') continue;
    if (kindAt(l + 1, s) === k && kindAt(l, s + 1) === k && kindAt(l + 1, s + 1) === k) return false;
  }
  // A level should not sit with 3+ orthogonal level neighbours (owner's
  // "levels not surrounded by levels" rule).
  for (const t of tiles) {
    if (t.kind !== 'level') continue;
    let n = 0;
    [[t.lane - 1, t.set], [t.lane + 1, t.set], [t.lane, t.set - 1], [t.lane, t.set + 1]]
      .forEach(([l, s]) => { if (kindAt(l, s) === 'level') n++; });
    if (n >= 3) return false;
  }
  // The boss must be reachable from EVERY set-1 start under the real movement
  // rules - this is the rule that makes strict orthogonality safe to ship.
  const saved = mapTiles; mapTiles = tiles;
  const ok = [0, 1, 2, 3].every(l => mapCanFinishFrom(l, 0, 1));
  mapTiles = saved;
  return ok;
}

// ══════════════════════════════════════════════
// MOVEMENT - legality, and the no-dead-end DP
// ══════════════════════════════════════════════
// "Can the boss still be reached from (lane, set) with `visits` spent there?"
// Visited flags in the CURRENT set matter (a vertical neighbour already taken
// cannot be revisited); sets ahead are always fresh, so the recursion only
// needs the tuple.
function mapCanFinishFrom(lane, set, visits) {
  if (set >= MAP_SETS - 1) {
    // In the funnel, forward is always the boss.
    if (set === MAP_BOSS_SET) return true;
    return true;
  }
  const fwd = (l) => {
    const t = mapCellTile(l, set + 1);
    if (!t || t.kind === 'blank' || t.visited) return false;
    // A 2x1's TAIL (head one set behind) is not enterable - the head is the
    // tile, and it is behind you. Treating the tail as a steppable set+1 tile
    // here is exactly the overpromise that stranded 1.4% of measured walks.
    if (t.set !== set + 1) return false;
    if (t.span === 2) return mapCanFinishFrom(l, set + 2, 1);
    return mapCanFinishFrom(l, set + 1, 1);
  };
  if (fwd(lane)) return true;
  if (visits < 2) {
    for (const dl of [-1, 1]) {
      const nl = lane + dl;
      const nt = mapCellTile(nl, set);
      if (!nt || nt.kind === 'blank' || nt.visited) continue;
      if (nt.set !== set) continue;   // a tail again: not this set's tile
      if (nt.span === 2) { if (mapCanFinishFrom(nl, set + 1, 1)) return true; continue; }
      if (fwd(nl)) return true;
    }
  }
  return false;
}

// Every tile the player may step on RIGHT NOW, with the doomed ones filtered.
//
// Every move carries `from` as well as `after`, because the skip payout asks
// "did you leave a set having visited it once" and under free branching the
// set you are leaving is not necessarily the one `mapPos` names.
function mapVisitsInSet(s) {
  return mapTiles.filter(t => t.visited && t.set === s).length;
}
// Where a visited tile actually LEAVES you: a 2x1 head spans its set and the
// next one, and taking it moves you on.
function _mapStandsAt(t) {
  return { lane: t.lane, set: t.set + (t.span === 2 ? 1 : 0) };
}
// The places a move may originate from. Normally just where you are; with the
// free-branch toggle on, anywhere you have already been.
function mapOrigins() {
  if (!mapFreeBranchOn()) return mapPos ? [{ lane: mapPos.lane, set: mapPos.set }] : [];
  const seen = new Set(), out = [];
  const add = (o) => { const k = o.lane + ',' + o.set; if (!seen.has(k)) { seen.add(k); out.push(o); } };
  mapTiles.forEach(t => { if (t.visited && t.kind !== 'boss') add(_mapStandsAt(t)); });
  if (mapPos) add({ lane: mapPos.lane, set: mapPos.set });
  return out;
}
// How many visits a set will hold once you step into it. Under free branching
// a FORWARD step can land in a set you have already been in, so it is not
// always 1 - and handing the dead-end DP a 1 there is exactly what let a
// measured walk strand itself.
function _mapArriveVisits(set) {
  return mapFreeBranchOn() ? mapVisitsInSet(set) + 1 : 1;
}
function mapLegalMoves() {
  const out = [];
  const byId = new Map();
  const push = (m) => {
    const prev = byId.get(m.tile.id);
    // A tile reachable from two origins keeps the move that is not doomed.
    if (prev) { if (prev.doomed && !m.doomed) Object.assign(prev, m); return; }
    byId.set(m.tile.id, m); out.push(m);
  };
  // The dead-end DP is applied UNCHANGED under free branching: a move is legal
  // only if the linear walk from where it lands can still reach the boss.
  // Loosening it to "some other origin can still finish" was tried and
  // measured at 86 strands in 4,000 walks - free branching adds ORIGINS, and
  // making it also add risk is not the trade. Stricter than necessary is the
  // right side to err on when the cost is a lost run.
  const canFinishAfter = (t, after) => mapCanFinishFrom(after.lane, after.set, after.visits);
  const consider = (t, after, from) => {
    if (!t || t.visited || t.kind === 'blank') return;
    if (t.kind !== 'boss' && !canFinishAfter(t, after)) { push({ tile: t, from, doomed: true }); return; }
    push({ tile: t, after, from });
  };
  if (!mapPos) {
    // Off-map: any solid tile in set 1.
    mapTiles.filter(t => t.set === 0 && t.kind !== 'blank' && !t.visited)
      .forEach(t => consider(t, { lane: t.lane, set: t.span === 2 ? 1 : 0, visits: 1 }, null));
    return out;
  }
  if (mapPickRule()) { mapPickMoves(push); return out; }
  for (const o of mapOrigins()) {
    const { lane, set } = o;
    const visits = mapFreeBranchOn() ? mapVisitsInSet(set) : mapVisits;
    const from = { lane, set, visits };
    // THE LAST SLOT BOOKS TWO LIKE EVERY OTHER SLOT (r293, owner's call).
    // It used to return the review and nothing else, which made the funnel the
    // one slot in the schedule with its own rule. Forward is still always the
    // review - there is no set beyond this one - so the only thing added is the
    // ordinary sideways move. The dead-end DP needs no change: mapCanFinishFrom
    // answers TRUE for every funnel cell already, because the review is
    // reachable from all four lanes.
    if (set === MAP_SETS - 1) {
      if (visits < 2) {
        for (const dl of [-1, 1]) {
          const t = mapCellTile(lane + dl, set);
          if (t && t.set === set) consider(t, { lane: t.lane, set, visits: visits + 1 }, from);
        }
      }
      const boss = mapTiles.find(t => t.kind === 'boss');
      if (boss && !boss.visited) push({ tile: boss, after: { lane, set: MAP_BOSS_SET, visits: 1 }, from });
      continue;
    }
    // Vertical, while the set has room.
    if (visits < 2) {
      for (const dl of [-1, 1]) {
        const t = mapCellTile(lane + dl, set);
        if (t && t.set === set)  // a 2x1 tail cell is set+1's business, not this set's
          consider(t, t.span === 2
            ? { lane: t.lane, set: set + 1, visits: _mapArriveVisits(set + 1) }
            : { lane: t.lane, set, visits: visits + 1 }, from);
      }
    }
    // Forward, always. A 2x1's tail is refused for the same reason the DP
    // refuses it: the head is the tile, and it is behind you.
    const f = mapCellTile(lane, set + 1);
    if (f) {
      if (f.kind === 'boss') push({ tile: f, after: { lane, set: MAP_BOSS_SET, visits: 1 }, from });
      else if (f.set === set + 1) consider(f, f.span === 2
        ? { lane: f.lane, set: set + 2, visits: _mapArriveVisits(set + 2) }
        : { lane: f.lane, set: set + 1, visits: _mapArriveVisits(set + 1) }, from);
    }
  }
  return out;
}

// THE PICK RULE (r648): any unvisited solid tile of the set you are in while it has
// room (2 a set), or of the next set, at any lane. A 2x1 head is a tile of its
// FIRST set and lands you in its second with that visit spent (its tail cell is
// never a tile of its own). The funnel's forward is the boss.
function mapPickMoves(push) {
  const { lane, set } = mapPos;
  const from = { lane, set, visits: mapVisits };
  const memo = {};
  const add = (t, after) => {
    if (!t || t.visited || t.kind === 'blank') return;
    if (!mapPickCanFinish(after.set, memo)) { push({ tile: t, from, doomed: true }); return; }
    push({ tile: t, after, from });
  };
  const tilesOf = s => mapTiles.filter(t => t.set === s && t.kind !== 'boss');
  if (mapVisits < 2) tilesOf(set).forEach(t => add(t, t.span === 2
    ? { lane: t.lane, set: set + 1, visits: 1 }
    : { lane: t.lane, set, visits: mapVisits + 1 }));
  if (set >= MAP_SETS - 1) {
    const boss = mapTiles.find(t => t.kind === 'boss');
    if (boss && !boss.visited) push({ tile: boss, after: { lane, set: MAP_BOSS_SET, visits: 1 }, from });
  } else {
    tilesOf(set + 1).forEach(t => add(t, t.span === 2
      ? { lane: t.lane, set: set + 2, visits: 1 }
      : { lane: t.lane, set: set + 1, visits: 1 }));
  }
}
// Can the boss be reached from `set` under the pick rule? Some solid tile of the
// next set must lead on. Every generated map passes (each middle set holds a level,
// the funnel at least two solid tiles); it is checked so a later generation rule
// cannot strand a run without the bar saying so.
function mapPickCanFinish(set, memo) {
  if (set >= MAP_SETS - 1) return true;
  if (memo && set in memo) return memo[set];
  const ok = mapTiles.some(t => t.set === set + 1 && t.kind !== 'blank' && t.kind !== 'boss' && !t.visited
    && mapPickCanFinish(t.span === 2 ? set + 2 : set + 1, memo));
  if (memo) memo[set] = ok;
  return ok;
}

function mapMoveFor(tileId) {
  return mapLegalMoves().find(m => m.tile.id === tileId) || null;
}

// ══════════════════════════════════════════════
// THE SCREEN - the grid borrowed, tiles dealt in
// ══════════════════════════════════════════════
function mapOpen() {
  if (mapScreenOpen) { mapRender(true); mapRenderBar(); return; }
  mapScreenOpen = true;
  mapSelected = null;
  gameTimerPaused = true;
  mapLandscape = !!document.getElementById('stage')?.classList.contains('landscape');
  mapGridSaved = { rows: gridRows, cols: gridCols };
  gridRows = MAP_SETS + 1; gridCols = MAP_LANES;   // r655: the slots read top to bottom everywhere
  recomputeGridMetrics();
  document.getElementById('next-goal-bg')?.classList.remove('show');
  document.body.classList.add('map-active');
  // r673: the LOCATION screen names the quarter's department.
  const _d = (typeof mapDept === 'function') ? mapDept() : null;
  if (typeof enterGridScreenHud === 'function') enterGridScreenHud(_d ? _d.name.toUpperCase() : 'SCHEDULE', 'shop');
  try { sfxShopOpen?.(); } catch (e) {}
  mapRender(true);
  mapRenderBar();
  // A save point (r660, owner): saving or leaving the app here resumes on the
  // schedule. The round-start checkpoint before it would replay a round already
  // cleared, or, on a new run, skip the schedule for round 1.
  if (typeof captureRunCheckpoint === 'function') captureRunCheckpoint();
}

// The map fills its box in both orientations (js/grid-metrics.js asks this):
// it is a screen of text, not a board of card-shaped cells.
function mapWantsFill() { return mapScreenOpen; }

// THE ORIENTATION IS RE-READ ON EVERY RENDER, not just captured at open.
// `mapLandscape` decides which way the schedule reads - left to right on a
// desktop, top to bottom on a phone - and it was read ONCE in mapOpen. So any
// change after that (a window resized across the threshold, or a first layout
// pass that decided portrait before the office photo settled) left the board
// reading the wrong way for the whole quarter, with no way back.
function mapSyncOrientation() {
  const ls = !!document.getElementById('stage')?.classList.contains('landscape');
  if (ls === mapLandscape) return false;
  mapLandscape = ls;
  gridRows = MAP_SETS + 1; gridCols = MAP_LANES;
  recomputeGridMetrics();
  return true;
}
// A resize does not repaint the map on its own (bootstrap's update only
// re-sizes the cards), so the board has to be redrawn when the way it reads
// changes underneath it. Registered once, and inert unless the map is up.
// DEFERRED BY A TICK, and that is the whole trick: js/bootstrap.js is the LAST
// script, so its own resize handler - the one that toggles .landscape - is
// registered after this one and runs after it. Reading the class here
// synchronously reads the PREVIOUS orientation, which flips the board one
// resize late (measured: a desktop -> phone resize left it reading left to
// right, and the resize back flipped it top down).
window.addEventListener('resize', () => {
  if (!mapScreenOpen) return;
  setTimeout(() => {
    if (mapScreenOpen && mapSyncOrientation()) { mapRender(false); mapRenderBar(); }
  }, 0);
});

function mapRender(animateIn) {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  if (mapScreenOpen) mapSyncOrientation();
  gridEl.innerHTML = '';
  const legal = mapLegalMoves();
  const legalIds  = new Set(legal.filter(m => !m.doomed).map(m => m.tile.id));
  const doomedIds = new Set(legal.filter(m => m.doomed).map(m => m.tile.id));
  // The slot the player is in: its row is lit and its gutter says how full it is.
  const curSet = mapPos ? Math.min(mapPos.set, MAP_SETS) : 0;

  // ── THE SCREEN (r655, owner): the schedule is a TO-DO LIST on a terminal ──
  // One amber glass over the whole board box, laid out by CSS grid rather than
  // the card cells: a gutter of times down the left (09:00 ... 17:00), one row
  // per time slot read TOP TO BOTTOM in both orientations, the review last, and
  // the toolbar (#map-bar) along the foot. A tile is a to-do item: a checkbox,
  // its glyph and its word. A two-slot event spans two rows like a calendar block.
  const term = document.createElement('div');
  term.className = 'map-term' + (mapLandscape ? ' mtm-land' : ' mtm-port');
  const list = document.createElement('div');
  list.className = 'mtm-list';
  term.appendChild(list);
  for (let s = 0; s <= MAP_SETS; s++) {
    const isReview = s === MAP_SETS;
    const row = document.createElement('div');
    row.className = 'mtm-row' + (s === curSet && !mapBossArmed ? ' now' : '') + (isReview ? ' mtm-review' : '');
    row.style.gridRow = String(s + 1);
    list.appendChild(row);
    const time = document.createElement('div');
    time.className = 'mtm-time' + (s === curSet ? ' now' : '');
    time.style.gridRow = String(s + 1);
    const booked = (s === curSet && mapPos && !isReview) ? `<i>${mapVisits}/2</i>` : '';
    time.innerHTML = `<b>${MAP_SLOT_TIMES[s] || ''}</b><span>${isReview ? 'REVIEW' : 'SLOT ' + (s + 1)}</span>${booked}`;
    list.appendChild(time);
  }

  const drawTile = (t) => {
    const face = mapTileFace(t);
    const isBoss = t.kind === 'boss';
    const legalT = legalIds.has(t.id), doomed = doomedIds.has(t.id);
    const missed = !t.visited && !legalT && !doomed && t.kind !== 'blank' && !isBoss && t.set <= curSet && !!mapPos;
    const box = t.visited ? 'x' : mapSelected === t.id ? '>' : doomed ? '!' : missed ? '-' : ' ';
    const div = document.createElement('div');
    div.className = 'map-tile ' + face.cls
      + (t.visited ? ' mt-visited' : '')
      + (legalT ? ' mt-legal' : '')
      + (doomed ? ' mt-doomed' : '')
      + (missed ? ' mt-missed' : '')
      + (mapSelected === t.id ? ' mt-selected' : '')
      + (mapPosTileId === t.id ? ' mt-here' : '')
      + (t.span === 2 ? ' mt-span' : '');
    div.style.gridRow = (t.set + 1) + (t.span === 2 ? ' / span 2' : '');
    div.style.gridColumn = isBoss ? '2 / -1' : String(t.lane + 2);
    const hidden = t.mystery && !t.revealed;
    // An event's line is its own name; every other line is its kind's word.
    const isEv = t.kind === 'event' && t.eventName && !hidden;
    const word = hidden ? '???' : isEv ? t.eventName : (MAP_KIND_META[t.audit ? 'audit' : t.kind] || MAP_KIND_META.event).name;
    const stake = mapTileStake(t, legalIds);
    const boss = isBoss ? peekBossPresetSafe() : null;
    div.innerHTML = t.kind === 'blank'
      ? `<span class="mt-free">· · ·</span>`
      : isBoss
      ? `<span class="mt-box">[${box}]</span><span class="mt-icon">${face.icon}</span>`
        + `<span class="mt-bcol"><span class="mt-name">${face.full}</span>${boss ? `<span class="mt-sub">${boss.name}</span>` : ''}</span>`
        + `<span class="mt-goal">${mapGoalWord()} ${mapReviewGoalShown().toLocaleString()}</span>`
      : `<span class="mt-line"><span class="mt-box">[${box}]</span><span class="mt-icon">${face.icon}</span></span>`
        + `<span class="mt-name${isEv ? ' mt-ev' : ''}">${word}</span>`
        + (stake ? `<span class="mt-stake${stake.k > 1 ? ' mt-proj' : ''}">${stake.short}</span>` : '');
    const desc = mapTileDesc(t, legalIds);
    if (face.full) div.title = (isEv ? t.eventName : face.full) + (desc ? ' - ' + desc : '');
    if (t.kind !== 'blank') {
      div.onclick = () => mapTileTap(t);
      div.onmouseenter = () => { if (!mapSelected) mapBarInfo(t, mapMoveFor(t.id)); };
      div.onmouseleave = () => { if (!mapSelected) mapBarInfo(null); };
    }
    list.appendChild(div);
    // The list PRINTS IN, a row at a time, the way a terminal draws a file. The
    // animation fills BACKWARDS only: a fill that outlives it would own opacity
    // for good, and the states above are opacity.
    if (animateIn) div.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 140, delay: t.set * 90 + (isBoss ? 0 : t.lane * 28), easing: 'steps(3, end)', fill: 'backwards' });
  };
  mapTiles.forEach(drawTile);

  // The toolbar: built empty here, filled by mapRenderBar (which every caller runs next).
  const bar = document.createElement('div');
  bar.id = 'map-bar';
  term.appendChild(bar);
  gridEl.appendChild(term);
  if (animateIn) term.animate([{ clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0 0 0 0)' }],
    { duration: 220, easing: 'ease-out', fill: 'backwards' });

  // The pen's canvas is a CHILD of #grid, which this function just emptied, so
  // it is put back here; the strokes themselves live in mapDrawStrokes and are
  // repainted onto it (js/map-draw.js).
  if (typeof mapDrawMount === 'function') mapDrawMount(gridEl);
  // The legend rail is measured off #grid, and #grid has just moved (a flip, a
  // resize, a redraw at a different size), so it is re-placed against it.
  if (typeof mapLegendReplace === 'function') mapLegendReplace();
}

function mapTileTap(t) {
  const move = mapMoveFor(t.id);
  if (move && !move.doomed) {
    mapSelected = (mapSelected === t.id) ? null : t.id;
    mapRender(false);
    mapRenderBar();
    if (mapSelected) mapBarInfo(t, move);
  } else {
    // Not reachable (or doomed): inspect only. This is also how the boss is
    // previewed from anywhere on the map.
    mapSelected = null;
    mapRender(false);
    mapRenderBar();
    mapBarInfo(t, move);
  }
}

// ── The bar: where you are, what is picked, CONFIRM ──────────────────────────
// ONE compact strip. The standing "how the map works" prose used to sit here as
// a permanent two-line block, which is a tutorial you cannot dismiss; it lives
// behind the ? chip now and the bar carries only what changes: where you are,
// what you have picked, and the button.
// The schedule's vocabulary (r260, owner's): the board is your SCHEDULE, a
// column is a TIME SLOT, a tile is an OBLIGATION and the boss is a MANAGER
// REVIEW. Ids are frozen - only what the player reads changes (TERMINOLOGY.md).
const MAP_HELP = [
  ['Move', 'Take a lit obligation touching where you stand. Everything you take happens.'],
  ['Two a slot', 'A time slot will book you for two obligations at most.'],
  ['Leaving early', 'Leaving a slot after only one obligation pays the department\u2019s reward (on the bar).'],
  ['Last slot', 'Book it like any other, then the review.'],
  ['Blocked out', 'Nothing scheduled there, and no way through.'],
];
// r648: the pick rule's card (the default). MAP_HELP is the old rule's.
const MAP_HELP_PICK = [
  ['Pick', 'Take any lit obligation in this time slot or the next. Everything you take happens.'],
  ['Two a slot', 'Book any two obligations in a slot, next to each other or not. Then move on.'],
  ['Moving on', 'You can start the next slot on any obligation in it.'],
  ['Leaving early', 'Leaving a slot after only one obligation pays the department\u2019s reward (on the bar).'],
  ['Last slot', 'Book it like any other, then the review.'],
  ['Blocked out', 'Nothing scheduled there.'],
];
function mapHelpRows() {
  const rows = (mapPickRule() ? MAP_HELP_PICK : MAP_HELP).slice();
  const d = (typeof deptHelpRow === 'function') ? deptHelpRow() : null;   // r673: this quarter's department
  if (d) rows.unshift(d);
  return rows;
}
// r673 (owner): leaving a slot early pays the department's Standard reward, first tier.
function mapSkipShort() { return (typeof crrShort === 'function' && typeof deptSkipPay === 'function') ? crrShort(deptSkipPay(), 0) : '+8 \u25c6'; }
function mapSkipSay() { return (typeof crrSay === 'function' && typeof deptSkipPay === 'function') ? crrSay(deptSkipPay(), 0) : '+8 credits'; }
function mapRenderBar() {
  // r655: the toolbar is the foot of the to-do screen (mapRender builds it empty),
  // not a body-level strip over the stage's own buttons.
  const bar = document.getElementById('map-bar');
  if (!bar) return;
  const setNo = mapPos ? Math.min(mapPos.set + 1, MAP_SETS) : 1;
  const done = mapPos ? Math.min(mapPos.set, MAP_SETS) : 0;
  const crunch = (typeof crunchActive === 'function') && crunchActive();
  // Every slot books two, the last one included (r293) - so the cap is flat.
  const visits = mapBossArmed ? 'REVIEW NEXT'
    : `BOOKED ${mapPos ? (mapFreeBranchOn() ? mapVisitsInSet(mapPos.set) : mapVisits) : 0}/2${mapFreeBranchOn() ? ' FREE' : ''}`;
  const pips = Array.from({ length: MAP_SETS }, (_, i) =>
    `<i class="${i < done ? 'on' : i === done && !mapBossArmed ? 'cur' : ''}"></i>`).join('');
  const inked = (typeof mapHasInk === 'function') && mapHasInk();
  // r662 (owner): the pen, its colour, undo and the legend are the right-hand keys now
  // (mapKeysSync below). One tool is left in the gutter: the rules card, or with the pen
  // out and ink on the list, WIPE.
  bar.innerHTML =
    `<span class="mb-tools">` +
      (mapPenOn
        ? (inked ? `<button class="mb-q mb-big" id="mb-wipe" title="Clear all ink">&#10005;</button>` : '')
        : `<button class="mb-q mb-big" id="mb-q" title="How the schedule works">?</button>`) +
    `</span>` +
    // While the pen is on, every tap on the list draws, so the two status lines
    // give way to one big key that ends it (owner: the 16px chip was too small).
    (mapPenOn ? `<button class="mb-done" id="mb-pen-done">&#9998; DONE DRAWING</button>` :
    `<div class="mb-l1">` +
      `<span class="mb-set">SLOT ${setNo}/${MAP_SETS}</span>` +
      `<span class="mb-pips">${pips}</span>` +
      `<span class="mb-visits">${visits}</span>` +
      (crunch ? '' : `<span class="mb-skip" title="Leaving a slot after one obligation pays ${mapSkipSay()}">LEAVE EARLY ${mapSkipShort()}</span>`) +
    `</div>` +
    `<div class="mb-l2">` +
      `<span class="mb-cmd" id="mb-cmd"></span>` +
    `</div>`) +
    `<div class="mb-info" id="mb-info"></div>` +
    `<div class="mb-help" id="mb-help">` +
      mapHelpRows().map(([k, v]) => `<div class="mb-hrow"><b>${k}</b><span>${v}</span></div>`).join('') +
    `</div>`;
  // The legend is NOT in here (r294): it is a body-level panel (docked on the empty
  // screens since r662), so it survives this rebuild instead of being destroyed by it.
  bar.classList.add('show');
  const doneBtn = document.getElementById('mb-pen-done');
  if (doneBtn) doneBtn.onclick = () => mapPenToggle();
  // One card open at a time, and a one-shot outside-click close armed only
  // while one IS open - a standing document listener on a bar that is rebuilt
  // every render would stack one copy per render.
  const cardToggle = (id, onClose) => (e) => {
    e.stopPropagation();
    const h = document.getElementById(id);
    if (!h) return;
    bar.querySelectorAll('.mb-help').forEach(c => { if (c !== h) c.classList.remove('show'); });
    const open = h.classList.toggle('show');
    if (!open && onClose) onClose();
    if (open) setTimeout(() => document.addEventListener('click', function off(ev) {
      if (bar.contains(ev.target)) return;
      h.classList.remove('show');
      if (onClose) onClose();
      document.removeEventListener('click', off);
    }), 0);
  };
  const helpBtn = document.getElementById('mb-q');
  if (helpBtn) helpBtn.onclick = cardToggle('mb-help');
  const wipeBtn = document.getElementById('mb-wipe');
  if (wipeBtn) wipeBtn.onclick = () => mapDrawClear();
  mapKeysTake();
  // A legend row lights its own kind and writes its sentence into this bar's
  // own info line; both live with the rail now (js/map-draw.js).
  if (typeof mapPenSyncChrome === 'function') mapPenSyncChrome();
  const sel = mapSelected && mapTiles.find(x => x.id === mapSelected);
  mapBarInfo(sel || null, sel ? mapMoveFor(mapSelected) : null);
  // The x/y selection readout hides on the map (r255), and nothing else repaints
  // it while the map is up - the class goes on without a render behind it.
  if (typeof updateSelectionUI === 'function') updateSelectionUI();
}

// The command line names the obligation you are about to clock in on (owner,
// r655); the info line under it says what it is. Nothing picked: the prompt waits.
function mapBarCommand(t, move) {
  const el = document.getElementById('mb-cmd');
  if (!el) return;
  const cur = `<span class="mb-cur"></span>`;
  if (!t) {
    el.innerHTML = `<span class="mb-verb">&gt;</span> <span class="mb-wait">${mapPos ? 'PICK ONE' : 'PICK A START'}</span>${cur}`;
    el.title = '';
    return;
  }
  // The name beside CLOCK IN is the whole point of the line, so no verb eats it.
  const face = mapTileFace(t);
  const name = (t.kind === 'event' && t.eventName && !(t.mystery && !t.revealed)) ? t.eventName : (face.full || face.name);
  const can = !!move && !move.doomed;
  el.innerHTML = `<span class="mb-verb">&gt;</span> <b class="mb-name">${name}</b>${can ? cur : ''}`;
  el.title = name;
}

function mapBarInfo(t, move) {
  mapBarCommand(t, move);
  const el = document.getElementById('mb-info');
  if (!el) return;
  if (!t) {
    el.innerHTML = mapPenOn ? 'Drag on the schedule to draw.'
      : mapPickRule() ? 'Book any two in a slot, in any order. Everything you book happens.'
      : 'Move up, down or forward. Everything you book happens.';
    return;
  }
  let s = mapTileDesc(t);
  if (move && !move.doomed) {
    // Crunch pays nothing for a skip (js/crunch-mode.js), so it must not be
    // advertised here either - a bar promising credits the confirm will not pay
    // is worse than saying nothing.
    if (move.from && move.after.set > move.from.set && move.from.visits === 1
        && !(typeof crunchActive === 'function' && crunchActive()))
      s += ` <i>leaving now pays ${mapSkipSay()}</i>`;
    if (t.span === 2) s += ` <i>runs over two slots</i>`;
    // Crunch prices the booking. The fee is the decision in that mode, so it is
    // read off the board rather than discovered after confirming.
    if (typeof crunchActive === 'function' && crunchActive()) {
      const _cost = crunchTileCost(t.kind);
      if (_cost > 0) s += crunchCanAfford(t)
        ? ` <i>booking costs ${_cost}s</i>`
        : ` <i>costs ${_cost}s · not enough time</i>`;
    }
  } else if (t.visited) s += ' <i>done</i>';
  else if (move && move.doomed) s += ' <i>dead-ends before the review</i>';
  else if (t.kind !== 'boss') s += ' <i>not reachable from here</i>';
  el.innerHTML = s;
}

// ── THE KEYS ARE THE SCHEDULE'S TOOLS (r662, owner) ─────────────────────────
// "I don't think there's a time mid map you need play, swap or discard", and the
// toolbar's chips were tiny. While the schedule is on screen PLAY is CLOCK IN, SWAP
// is the PEN and DISCARD is the LEGEND; with the pen out the three are the pen's own
// tools: DONE, COLOUR and UNDO. The keys' own words stay in them, hidden, under the
// schedule's label, and come back when the schedule closes; render() keeps off them
// (its _takeover guard reads mapScreenOpen), and capture listeners bound at load stop
// the board's own handlers (playHand, doDiscard, doSwap) for as long as the keys are
// held. They act only while the toolbar is up, so a press during the fall-out is lost.
const MAP_KEY_IDS = ['btn-play', 'btn-discard', 'swap-indicator'];
let _mapKeysSaved = null;
function mapKeyEls() { return MAP_KEY_IDS.map(id => document.getElementById(id)); }
function mapKeysLive() {
  return !!_mapKeysSaved && mapScreenOpen && !!document.getElementById('map-bar')?.classList.contains('show');
}
// A glyph over the word, one letter a line like the keys' own words (PLAY is P/L/A/Y);
// a second word sits a short gap below the first.
function mapKeyHTML(ico, word) {
  const stack = w => `<span class="mapk-w">${[...w].join('\n')}</span>`;
  return `<span class="mapk"><span class="mapk-ico">${ico}</span><span class="mapk-word">${word.split(' ').map(stack).join('')}</span></span>`;
}
function mapKeysTake() {
  const els = mapKeyEls();
  if (els.some(el => !el)) return;
  if (!_mapKeysSaved) {
    // The play words stay in the key, hidden in place (a display:contents wrapper), and
    // the schedule's label is laid over it, so every key keeps the exact size it has in
    // play in both orientations, and giving it back is unwrapping.
    _mapKeysSaved = els.map(el => {
      const keep = document.createElement('span'); keep.className = 'mapk-keep';
      while (el.firstChild) keep.appendChild(el.firstChild);
      el.appendChild(keep);
      const lab = document.createElement('span'); lab.className = 'mapk'; el.appendChild(lab);
      return { title: el.title, disabled: el.disabled };
    });
    document.body.classList.add('map-keys');
  }
  mapKeysSync();
}
function mapKeysSync() {
  if (!_mapKeysSaved) return;
  const [play, disc, swap] = mapKeyEls();
  if (!play || !disc || !swap) return;
  // A key the schedule cannot use right now keeps its colour (r100: the keys never grey
  // out) and dims its word; a tool that is on (the legend up, the pen out) stays down.
  const set = (el, html, title, on, off) => {
    const lab = el.querySelector(':scope > .mapk');
    if (lab && lab._html !== html) { lab.innerHTML = html; lab._html = html; }
    el.title = title; el.disabled = false;
    el.classList.toggle('mapk-on', !!on);
    el.classList.toggle('mapk-off', !!off);
  };
  if (mapPenOn) {
    set(swap, mapKeyHTML('&#9998;', 'DONE'), 'Stop drawing', true, false);
    set(disc, mapKeyHTML('<i class="mapk-sw"></i>', 'COLOUR'), 'Pen colour', false, false);
    set(play, mapKeyHTML('&#8630;', 'UNDO'), 'Undo the last stroke', false, !mapHasInk());
  } else {
    const move = mapSelected ? mapMoveFor(mapSelected) : null;
    const can = !!move && !move.doomed;
    set(swap, mapKeyHTML('&#9998;', 'PEN'), 'Draw on the schedule (right-drag works without this; double right-click changes colour)', false, false);
    set(disc, mapKeyHTML('&#8801;', 'LEGEND'), 'What the obligations are', mapLegendOpen(), false);
    set(play, mapKeyHTML('&#9654;', 'CLOCK IN'), can ? 'Clock in on the picked obligation' : 'Pick an obligation first', false, !can);
  }
  const sw = disc.querySelector('.mapk-sw'); if (sw) sw.style.background = mapPenHex();
  const pi = swap.querySelector('.mapk .mapk-ico'); if (pi) pi.style.color = mapPenOn ? mapPenHex() : '';
}
function mapKeysReturn() {
  if (!_mapKeysSaved) return;
  mapKeyEls().forEach((el, i) => {
    if (!el) return;
    el.querySelector(':scope > .mapk')?.remove();
    const keep = el.querySelector(':scope > .mapk-keep');
    if (keep) { while (keep.firstChild) el.insertBefore(keep.firstChild, keep); keep.remove(); }
    const sv = _mapKeysSaved[i];
    el.title = sv.title; el.disabled = sv.disabled;
    el.classList.remove('mapk-on', 'mapk-off');
  });
  _mapKeysSaved = null;
  document.body.classList.remove('map-keys');
}
function mapKeyPress(i) {
  if (!mapKeysLive()) return;
  if (i === 0) {                      // PLAY: CLOCK IN, or UNDO with the pen out
    if (mapPenOn) { if (mapHasInk()) mapDrawUndo(); else refuse(); return; }
    const move = mapSelected ? mapMoveFor(mapSelected) : null;
    if (!move || move.doomed) { refuse(); return; }
    mapConfirm();
  } else if (i === 1) {               // DISCARD: the LEGEND, or the pen's COLOUR
    if (mapPenOn) mapPenCycle(); else mapLegendToggle();
  } else mapPenToggle();              // SWAP: the PEN, or DONE
}
MAP_KEY_IDS.forEach((id, i) => document.getElementById(id)?.addEventListener('click', e => {
  if (!_mapKeysSaved) return;
  e.stopImmediatePropagation(); e.preventDefault();
  mapKeyPress(i);
}, true));

function mapCloseScreen() {
  mapScreenOpen = false;
  mapSelected = null;
  // Hidden directly rather than through mapLegendClose, which re-renders the
  // bar - and the bar is being taken down two lines below.
  if (typeof mapLegendEl === 'function') mapLegendEl()?.classList.remove('show');
  // The rail slides the board left to make room for itself (r298). #grid is the
  // PLAY board too, so a stale offset would leave every later round off-centre.
  if (typeof mapLegendSlide === 'function') mapLegendSlide(0);
  if (typeof mapLegendHighlight === 'function') mapLegendHighlight(null, null);
  document.getElementById('map-bar')?.classList.remove('show');
  document.body.classList.remove('map-active');
  mapKeysReturn();
  if (typeof updateSelectionUI === 'function') updateSelectionUI();
  if (typeof exitGridScreenHud === 'function') exitGridScreenHud();
  const gridEl = document.getElementById('grid');
  if (gridEl) gridEl.innerHTML = '';
  if (mapGridSaved) { gridRows = mapGridSaved.rows; gridCols = mapGridSaved.cols; mapGridSaved = null; }
  recomputeGridMetrics();
}

// The owner's transition: everything falls out the bottom, THEN the grid snaps
// back to play size and the round deals in behind the 3-2-1.
function mapFallOutAndClose(next) {
  const gridEl = document.getElementById('grid');
  const tiles = gridEl ? [...gridEl.querySelectorAll('.map-tile')] : [];
  document.getElementById('map-bar')?.classList.remove('show');
  const anims = tiles.map((el, i) => el.animate([
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(420px)' },
  ], { duration: 360, delay: (tiles.length - i) * 18, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' }));
  try { sfxCardDiscard?.(); } catch (e) {}
  Promise.all(anims.map(a => a.finished)).catch(() => {}).then(() => {
    mapCloseScreen();
    next();
  });
}

// ══════════════════════════════════════════════
// RESOLUTION - a confirmed tile becomes a screen
// ══════════════════════════════════════════════
function mapConfirm() {
  const move = mapSelected ? mapMoveFor(mapSelected) : null;
  if (!move || move.doomed) return;
  const t = move.tile;

  // Crunch: refused, not discovered - the Schedule's own rule for dead ends. A
  // booking that would empty the act bank is a tap the player could not have
  // known was fatal, so it is turned away and the bar says why.
  if (typeof crunchCanAfford === 'function' && !crunchCanAfford(t)) {
    refuse('Not enough time on the clock');
    return;
  }

  // Mystery reveals AT COMMIT - that is the gamble it is.
  if (t.mystery && !t.revealed) {
    t.revealed = true;
    showMessage(`It was: ${mapTileFace(t).name}`, 'var(--gold)');
  }

  // Skip payout: leaving a set after exactly one visit. Checked BEFORE the
  // position moves. THE STEP INTO THE REVIEW PAYS IT TOO (r293): the funnel
  // books two like every other slot now, so walking out of it after one is the
  // same decision the help card describes, and excluding it would leave the
  // last slot special in the one way the player can still feel.
  // In Crunch the skip pays nothing at all: moving on early already saves you
  // the obligation's time fee, which is the whole currency of that mode, and
  // paying credits as well would reward the same decision twice.
  if (move.from && move.after.set > move.from.set && move.from.visits === 1
      && !(typeof crunchActive === 'function' && crunchActive())) {
    mapSkips++;
    // r673 (owner): the department's Standard reward, first tier (CHALLENGE_REWARDS.md),
    // paid off the clock: time, swaps, discards and Focus wait for the next round.
    const said = (typeof crrGrant === 'function' && typeof deptSkipPay === 'function')
      ? crrGrant(deptSkipPay(), 0, { live: false })
      : (coins += 8, updateCoinsUI?.(), '+8 credits');
    showMessage(`Left the slot early · ${said}`, 'var(--gold)');
  }

  // Crunch: the obligation's time fee, debited at CONFIRM. A level, a priority
  // account and the review are free - they cost their own play time instead.
  if (typeof crunchChargeTile === 'function') crunchChargeTile(t);

  t.visited = true;
  // The walked route is drawn from this (mapRender's trail), so the tile has to
  // remember WHEN it was taken. A plain number keeps mapTiles JSON-safe.
  t.step = (mapTiles.reduce((n, x) => Math.max(n, x.step || 0), 0)) + 1;
  mapPosTileId = t.id;
  mapPos = { lane: move.after.lane, set: move.after.set };
  mapVisits = move.after.visits;
  mapLastWasChallenge = (t.kind === 'challenge' && !t.audit);   // a priority account's knack pick

  switch (t.kind) {
    case 'level':
      mapFallOutAndClose(() => mapStartRound(null));
      return;
    case 'challenge': {
      if (t.audit) {
        crArmNext({ source: 'map', bonusSecs: CR_MAP_BONUS_SECONDS });
        mapFallOutAndClose(() => mapStartRound(null));
        return;
      }
      // Rehydrate the test function from CHALLENGE_DEFS by id - the stored
      // challenge is data only (JSON-safe for saves).
      const def = CHALLENGE_DEFS.find(d => d.id === t.challenge?.id) || CHALLENGE_DEFS[0];
      mapFallOutAndClose(() => mapStartRound({ ...def, rewardText: `+${def.credits} credits` }));
      return;
    }
    case 'boss':
      mapBossArmed = true;
      nodeInAct = 5; updateActProgressUI?.();
      if (typeof bossesEnabled !== 'function' || bossesEnabled()) forceBossNextRound = true;
      mapFallOutAndClose(() => mapStartRound(null));
      return;
    case 'shop':
      guidedAdvanceCurve();
      mapFallOutAndClose(() => {
        shopFromNodeFlow = true;
        nodeFlowAfterShop = () => mapAfterTile();
        triggerShop();
      });
      return;
    case 'reward':
      guidedAdvanceCurve();
      mapFallOutAndClose(() => { rewardGridContext = 'interlude'; openRewardGrid(); });
      return;
    case 'limitbreak':
      guidedAdvanceCurve();
      mapFallOutAndClose(() => openLimitBreakEvent(() => mapAfterTile()));
      return;
    case 'event':
    default:
      guidedAdvanceCurve();
      mapFallOutAndClose(() => {
        shopFromNodeFlow = false;
        guidedOpenNamedEvent(t.eventId || 'gamble', () => mapAfterTile());
      });
      return;
  }
}

// A level/challenge/boss tile starts a ROUND. Round 1 is special: startGame
// already dealt the board and armed the clock (then mapBeginRun froze it), so
// the first confirm resumes that round rather than levelling up past it -
// triggerLevelUp would bump the curve to 2 before a hand was played.
function mapStartRound(challenge) {
  guidedPendingChallenge = challenge || null;
  const hudPips = Math.min(5, Math.round(((mapPos?.set || 0) * 5) / MAP_SETS));
  if (!mapBossArmed) { nodeInAct = hudPips; updateActProgressUI?.(); }
  if (!mapFirstRoundDone) {
    mapFirstRoundDone = true;
    // Round 1 has no pending-challenge seam (guidedApplyPendingChallenge runs in
    // triggerLevelUp), so a set-1 challenge - impossible by generation, set 1 is
    // all levels - would be silently dropped. Levels only up front, by design.
    render();
    showNextGoalFlash().then(() => show321Countdown()).then(() => {
      gameTimerPaused = false;
      sfxRoundStart?.();
      updateClockUI();
      render();
      startRoundTimer();
    });
    return;
  }
  drainLevelUpQueue();
}

// The boss quota is FIXED - MAP_BOSS_LEVELS of the steeper curve - whatever
// level the walk actually reached. Hooked from triggerLevelUp right after
// guidedApplyPendingChallenge, i.e. after goalForLevel has written roundGoal.
// The review's goal as printed: a challenge's Boss goal reward or penalty moves it (r671).
function mapReviewGoalShown() {
  const g = Number(mapBossGoal || 0);
  return (g && typeof crrBossGoalShown === 'function') ? crrBossGoalShown(g) : g;
}
function mapApplyPendingGoal() {
  if (!mapActive()) return;
  if (mapBossArmed) roundGoal = mapBossGoal;
}

// ── Continuations back to the map ────────────────────────────────────────────
// After a bought/landed screen (shop, reward grid, event, limit break).
function mapAfterTile() {
  mapOpen();
}

// After a cleared LEVEL: payout has run (startInterlude), challenge settled.
// Pick of three, the challenge's knack pick when earned, then the map.
function mapAfterLevel() {
  const wasChallenge = mapLastWasChallenge;
  mapLastWasChallenge = false;
  const done = () => mapOpen();
  if (!mapPos) { done(); return; }   // resumed pre-map edge: straight back to the map
  // An audit (js/challenge-round.js) pays no prize grid (owner, r666): its cards
  // paid their credits during the round and the pick of three is the round's
  // reward. crTakePrize is still called so the round's state is cleared.
  if (typeof crTakePrize === 'function') crTakePrize();
  guidedOpenPickThree(() => {
    if (wasChallenge) mapKnackPickTwo(done);
    else done();
  });
}

// The challenge bonus pick: TWO knacks, drawn as if the player held +20 Luck.
// The luck bump is a temporary window around the draw - the shared rarity table
// is read through luckTierWeights exactly as any other draw, so "odds as if"
// is literally true rather than approximated.
function mapKnackPickTwo(done) {
  const banned = id => (typeof survivalEntityBanned === 'function') && survivalEntityBanned(id);
  const ownedK = new Set((acquiredKnacks || []).map(k => k.id));
  let pool = KNACK_POOL.filter(k => !ownedK.has(k.id) && !banned(k.id));
  const offers = [];
  luckModifiers += MAP_CHALLENGE_LUCK;
  try {
    for (let i = 0; i < 2 && pool.length; i++) {
      const k = (typeof pickEntityByRarity === 'function' && pickEntityByRarity(pool, e => e.rarity || 'common'))
        || pool[Math.floor(Math.random() * pool.length)];
      if (!k) break;
      pool = pool.filter(x => x.id !== k.id);
      offers.push(k);
    }
  } finally {
    luckModifiers -= MAP_CHALLENGE_LUCK;
  }
  if (!offers.length) { done(); return; }

  // Drawn ON the board (js/grid-pick.js, r254), the same overlay the free
  // pick-of-three uses - name and description under the object, and a tooltip
  // wherever the description clamps. This screen had no tooltips at all before.
  openGridPick({
    title: 'TAKE A KNACK', tone: 'reward',
    offers: offers.map(k => ({ entity: 'knack', icon: k.emoji || '♦', emoji: k.emoji || '♦',
      id: k.id, label: k.name, desc: k.desc, rarity: k.rarity || 'common',
      tag: (typeof tierLabel === 'function') ? tierLabel('knack', k.rarity || 'common') : '' })),
    onChoose: (i) => {
      const k = offers[i];
      acquiredKnacks.push({ ...k });
      updateKnackList?.();
      noteMessage(`+ ${k.name}`, 'var(--gold)');
      done();
    },
    onSkip: () => done(),
  });
}

// ── Run entry ────────────────────────────────────────────────────────────────
// Called from the very end of startGame. The board for round 1 is already dealt
// and its clock started; freeze both and put the map over it. The first level
// confirm resumes exactly this round (mapStartRound above).
// A new QUARTER (r252). The boss just fell, the prize grid has closed and
// rolloverQuarter has advanced actNumber and shown its card. Draw a fresh map
// and walk it. The curve is NOT touched here - the quarter's levels carry it,
// exactly as Q1's did - and mapFirstRoundDone stays true, so the first level of
// Q2 goes through drainLevelUpQueue like any other rather than trying to resume
// a round startGame dealt two quarters ago.
function mapBeginQuarter() {
  // Crunch tops the act bank up BEFORE the board is drawn, so the first tile is
  // priced against the quarter's real allowance rather than last quarter's
  // remainder. (js/crunch-mode.js)
  if (typeof crunchBeginQuarter === 'function') crunchBeginQuarter();
  mapResetBoard();
  if (typeof stopTimers === 'function') stopTimers();
  gameTimerPaused = true;
  mapOpen();
}

function mapBeginRun() {
  if (typeof _restoringSave !== 'undefined' && _restoringSave) return;  // resume replays its round first
  if (typeof stopTimers === 'function') stopTimers();
  gameTimerPaused = true;
  if (typeof dealAnims !== 'undefined' && dealAnims) { dealAnims.forEach(a => { try { a.cancel(); } catch (e) {} }); dealAnims = []; }
  mapOpen();
}
