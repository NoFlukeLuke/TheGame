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
// - The boss goal is FIXED at map build: a set level of the curve for each
//   quarter (MAP_REVIEW_LEVEL, r706), previewable from the map before you can
//   reach it.
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

// r679 (owner): two shapes. WIDE is 4 lanes x 4 slots, two bookings a slot (r655 / r648).
// TALL is 3 lanes x 6 slots, ONE booking a slot (dev -> Schedule, `lethe.map.layout`,
// stored only when tall; takes effect on the next map). The three are written by
// mapApplyLayout from the switch when a map is built, and from the saved tiles on a
// restore (mapRepairShape), so they always describe the tiles on screen.
let MAP_LANES = 4;
let MAP_SETS  = 4;                // regular sets; the boss row is index MAP_SETS
let MAP_BOSS_SET = MAP_SETS;
const MAP_LAYOUT_KEY = 'lethe.map.layout';
let mapLayoutTall = false;
try { mapLayoutTall = localStorage.getItem(MAP_LAYOUT_KEY) === 'tall'; } catch (e) {}
function setMapLayoutTall(on) {
  mapLayoutTall = !!on;
  try { if (on) localStorage.setItem(MAP_LAYOUT_KEY, 'tall'); else localStorage.removeItem(MAP_LAYOUT_KEY); } catch (e) {}
}
function mapApplyLayout(lanes, sets) {
  MAP_LANES = lanes || (mapLayoutTall ? 3 : 4);
  MAP_SETS = sets || (mapLayoutTall ? 6 : 4);
  MAP_BOSS_SET = MAP_SETS;
}
// Bookings a slot holds: two on the wide shape, one on the tall one.
function mapSlotCap() { return MAP_LANES <= 3 ? 1 : 2; }
// The slots that must hold a round: every slot but the funnel on the wide shape;
// slots 1, 3 and 5 on the tall one (owner).
function mapLevelSets() {
  const out = [];
  for (let s = 0; s <= MAP_SETS - 2; s++) if (mapSlotCap() === 2 || s % 2 === 0) out.push(s);
  return out;
}
// r679 (owner): a slot holds at most two of one kind.
const MAP_KIND_CAP = 2;
// r702 (owner): TWO reviews a quarter, each behind a condition, and a hidden third.
// On the wide shape a review owns two lanes and unlocks at `lanes` bookings in
// them; on the tall shape one unlocks at `kinds` rounds booked, the other at
// `kinds` other obligations. Neither unlocked, and neither still reachable: a
// random manager (`hidden`, drawn at build, unnamed until taken).
const MAP_BOSS_NEED = { lanes: 5, kinds: 4 };
function mapBossRule() { return mapSlotCap() === 1 ? 'kinds' : 'lanes'; }
function mapBossTiles() { return mapTiles.filter(t => t.kind === 'boss'); }
function mapTileIsRound(t) { return t.kind === 'level' || t.kind === 'challenge'; }
// Review A is the quarter's held boss (actBossId: Advance Notice and Reschedule
// still speak of it); B and the hidden one carry their own preset.
function mapBossPreset(t) {
  const id = (t.slot === 'a' || !t.slot) ? ((typeof actBossId !== 'undefined' && actBossId) || t.presetId) : t.presetId;
  return (typeof BOSS_PRESETS !== 'undefined' && BOSS_PRESETS.find(p => p.id === id)) || null;
}
// Does a booked obligation count toward this review? On the tall shape a
// mystery counts as an other obligation, and also as a round if it turns out
// to be one (owner, r705). `guess` is for tiles not booked yet: a mystery that
// is still hidden might be a round, so it counts for both (never leaks its kind).
function mapBossCounts(b, t, guess) {
  if (t.kind === 'boss' || t.kind === 'blank') return false;
  if (mapBossRule() === 'lanes') {
    const lanes = b.lanes || [];
    for (let l = t.lane; l < t.lane + (t.cols || 1); l++) if (lanes.includes(l)) return true;
    return false;
  }
  if (t.mystery && (t.revealed || guess)) {
    if (b.slot !== 'a') return true;
    return t.revealed ? mapTileIsRound(t) : true;
  }
  return b.slot === 'a' ? mapTileIsRound(t) : !mapTileIsRound(t);
}
function mapBossNeed(b) { return b.hidden ? 0 : MAP_BOSS_NEED[mapBossRule()]; }
function mapBossProgress(b) { return mapTiles.filter(t => t.visited && mapBossCounts(b, t)).length; }
function mapBossUnlocked(b) { return !b.hidden && (!b.slot || mapBossProgress(b) >= mapBossNeed(b)); }
// Could this review still be unlocked with the bookings left?
function mapBossReachable(b) {
  if (b.hidden) return true;
  if (mapBossUnlocked(b)) return true;
  const cap = mapSlotCap();
  const from = mapPos ? mapPos.set : 0;
  const here = mapPos ? Math.max(0, cap - mapVisits) : cap;
  const left = here + cap * Math.max(0, (MAP_SETS - 1) - from);
  const avail = mapTiles.filter(t => !t.visited && mapBossCounts(b, t, true) && t.set >= from && !(t.set === from && here <= 0)).length;
  return mapBossProgress(b) + Math.min(left, avail) >= mapBossNeed(b);
}
// Which review tiles the funnel may book: the unlocked ones; with none unlocked
// and none still reachable, the hidden one.
function mapBossOffer() {
  const named = mapBossTiles().filter(t => !t.hidden);
  const open = named.filter(mapBossUnlocked);
  if (open.length) return open;
  if (named.some(mapBossReachable)) return [];
  return mapBossTiles().filter(t => t.hidden);
}
function mapBossShowHidden() {
  const named = mapBossTiles().filter(t => !t.hidden);
  return mapBossTiles().some(t => t.hidden) && (!named.length || !named.some(mapBossReachable));
}
function mapBossCondShort(b) {
  if (b.hidden) return 'NEITHER UNLOCKED';
  const n = mapBossProgress(b), need = mapBossNeed(b);
  if (mapBossRule() === 'lanes') return `LANES ${b.lanes.map(l => l + 1).join('-')} · ${Math.min(n, need)}/${need}`;
  return `${b.slot === 'a' ? 'ROUNDS' : 'OTHERS'} · ${Math.min(n, need)}/${need}`;
}
function mapBossCondSay(b) {
  if (b.hidden) return 'Neither review was unlocked, so a random manager holds it.';
  const n = mapBossProgress(b), need = mapBossNeed(b);
  const what = mapBossRule() === 'lanes'
    ? `${need} bookings in lanes ${b.lanes.map(l => l + 1).join(' and ')}`
    : `${need} ${b.slot === 'a' ? 'rounds' : 'obligations that are not rounds (a mystery counts, and counts as a round too if it is one)'}`;
  return mapBossUnlocked(b) ? `Unlocked: ${what}.` : `Unlocks at ${what} (${n} so far${mapBossReachable(b) ? '' : ', out of reach now'}).`;
}
// The minimums a map is built and validated against (r655: 2/2/3/2 on the old 4 x 6).
// r690 (owner): the REWARD tile is the IT department's alone (the department whose
// tile is 'reward'): one at least there, MAP_REWARD_MAX a map at most, a mystery's
// reward board included; elsewhere only a mystery can be one. mapMinimums() is read.
const MAP_MINIMUMS = [['shop', 1], ['challenge', 1], ['event', 2]];
const MAP_REWARD_MAX = 2;
function mapRewardTileOn() { const d = (typeof mapDept === 'function') ? mapDept() : null; return !!d && d.tile === 'reward'; }
function mapMinimums() { return mapRewardTileOn() ? MAP_MINIMUMS.concat([['reward', 1]]) : MAP_MINIMUMS; }
// The day the to-do list prints down its left edge: one time per slot, then the review.
const MAP_SLOT_TIMES_WIDE = ['09:00', '11:00', '13:00', '15:00', '17:00'];
const MAP_SLOT_TIMES_TALL = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '17:30'];
function mapSlotTimes() { return MAP_SETS > 4 ? MAP_SLOT_TIMES_TALL : MAP_SLOT_TIMES_WIDE; }
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
// a PRIORITY account (r444). r690 (owner: priority a little more common, now that
// it is where the reward board is): 0.5 -> 0.4. With the reward cell freed and
// the mysteries' rolls (55% a challenge tile), 3,000 maps a department: priority
// accounts and one-on-ones 1.06-1.36 a map (were 0.60-0.77), audits 0.63-0.86
// (were 0.53-0.79), reward boards 0.15-0.27 outside IT and 1.38 in it (were 1.40-1.63).
const MAP_AUDIT_SHARE = 0.4;
// The reward row fills only in the IT quarter (mapFillWeights).
const MAP_FILL_W = [['level', 30], ['event', 26], ['reward', 20], ['shop', 10], ['challenge', 10], ['limitbreak', 4]];
function mapFillWeights() {
  const W = (typeof deptFillWeights === 'function') ? deptFillWeights(MAP_FILL_W) : MAP_FILL_W;
  return mapRewardTileOn() ? W : W.map(([k, w]) => [k, k === 'reward' ? 0 : w]);
}
// What a MYSTERY turns out to be (r690, owner), rolled at build and hidden until
// you commit: audit / priority are the challenge tile's two faces, mini a priority
// account whose ask is a boss handicap at half strength (CHALLENGE_DEFS' `mini`
// rows, r239), reward the reward board in any quarter (still MAP_REWARD_MAX a map).
// The last slot never rolls a plain round.
const MAP_MYSTERY_W = [['level', 10], ['audit', 20], ['priority', 20], ['event', 20], ['mini', 15], ['reward', 15]];
function _mapRollW(W) {
  const tot = W.reduce((a, [, w]) => a + Math.max(0, w || 0), 0);
  if (!(tot > 0)) return W.length ? W[0][0] : null;
  let r = Math.random() * tot;
  for (const [k, w] of W) { r -= Math.max(0, w || 0); if (r < 0) return k; }
  return W[W.length - 1][0];
}
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
// r706 (owner): a review asks a FIXED level of the curve: quarter q's review is
// level `wide` x q on the 4 x 4 (8, 16, 24, 32) and `tall` x q on the 3 x 6 (7, 14,
// 21, 28), whatever the walk did. Events and tiles that move a review (a Boss goal
// reward, Overtime's tough reviews) still apply on top. `lift` multiplies the goal
// (1 = the plain level goal). Before r706 the quota was the opening level's goal
// x 1.30^5.5, so every booking skipped made every later review cheaper.
const MAP_REVIEW_LEVEL = { wide: 8, tall: 7, lift: 1 };
function mapReviewLevel(q) {
  const per = mapSlotCap() === 1 ? MAP_REVIEW_LEVEL.tall : MAP_REVIEW_LEVEL.wide;
  return per * Math.max(1, q || (typeof actNumber === 'number' ? actNumber : 1));
}
// The Schedule's per-level goal growth, percent. Its own number because the
// Schedule advances `level` about twice as fast as Classic advances per played
// round (bought obligations move the curve too - the mode's load-bearing rule).
const MAP_GOAL_GROWTH = 18;

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
  mapScreenOpen = false; mapSelected = null;
  if (typeof mapDrawStrokes !== 'undefined') { mapDrawStrokes = []; mapPenOn = false; }
  mapApplyLayout();
  mapBossGoal = mapQuarterBossGoal();   // after the layout: the shape picks the review's level
  if (mapActive()) mapGenerate();
}

// A saved run from the 4 x 6 schedule (before r655) holds tiles past this
// shape's review row; its quarter is drawn again on the new shape. Run state
// (skips, the quarter, the curve) is untouched. Called from restoreRun.
function mapRepairShape() {
  if (!mapActive() || !mapTiles.length) return;
  const boss = mapTiles.find(t => t.kind === 'boss');
  // r679: a saved map on either shape is kept as it is; its shape is read off its tiles.
  if (boss && (boss.set === 4 || boss.set === 6) && !mapTiles.some(t => t.set > boss.set)) {
    mapApplyLayout(mapTiles.reduce((n, t) => Math.max(n, t.lane + (t.cols || 1)), 0) || (boss.set === 6 ? 3 : 4), boss.set);
    return;
  }
  const skips = mapSkips;
  mapResetBoard();
  mapSkips = skips;
}

// The boss quota is FIXED at map build: the level mapReviewLevel names, on the
// Schedule's own curve (mapGoalForLevel, Endless's climb included).
function mapQuarterBossGoal() {
  const lv = mapReviewLevel();
  const base = (typeof mapGoalForLevel === 'function') ? mapGoalForLevel(lv) : BASE_GOAL;
  const lift = MAP_REVIEW_LEVEL.lift || 1;
  return lift === 1 ? base : Math.round(base * lift / 500) * 500;
}

// ── Tile helpers ─────────────────────────────────────────────────────────────
let _mapTileId = 0;
let mapPosTileId = null;   // the tile the player is standing on (for the ring)
// The tile occupying a cell, treating a 2x1's tail as its head.
function mapCellTile(lane, set) {
  for (const t of mapTiles) {
    if (t.lane === lane && t.set === set) return t;
    if (t.span === 2 && t.lane === lane && t.set + 1 === set) return t;
    // r679: a WIDE tile (cols 2 or the whole row) owns every lane it covers.
    if (t.cols > 1 && t.set === set && lane > t.lane && lane < t.lane + t.cols) return t;
  }
  return null;
}
// Bookings a wide tile spends: a whole-row opener fills its slot, a 2-wide is one.
function mapTileBookings(t) { return (t.cols || 1) >= MAP_LANES ? mapSlotCap() : 1; }
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
                blurb: 'A round with a raised goal and one extra ask. Pays credits and a reward grid.' },
  // r690: a priority account whose ask is a boss handicap (CHALLENGE_DEFS' `mini`).
  mini:       { icon: '⚔\uFE0E', name: '1-ON-1', full: 'One-on-One', cls: 'mk-mini',
                blurb: 'A round with a raised goal and a review\u2019s handicap at half strength. Pays credits and a reward grid.' },
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
  const m = MAP_KIND_META[mapTileMetaKey(t)] || MAP_KIND_META.event;
  if (t.kind === 'event' && t.eventName) return { ...m, name: t.eventName };
  return m;
}
// A challenge tile's face: audit, one-on-one (a mini def) or priority.
function mapTileIsMini(t) {
  if (!t || t.kind !== 'challenge' || t.audit || !t.challenge) return false;
  const d = (typeof CHALLENGE_DEFS !== 'undefined') ? CHALLENGE_DEFS.find(x => x.id === t.challenge.id) : null;
  return !!(d && d.mini);
}
function mapTileMetaKey(t) { return t.audit ? 'audit' : mapTileIsMini(t) ? 'mini' : t.kind; }
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
      + `${G} +${Math.round(((t.challenge?.goalMult || 1.2) - 1) * 100)}%.${goal} Pays +${t.challenge?.credits || 0} credits and a reward grid (a path of up to ${mapRewardPath()}).`;
    case 'shop':       return `The company store. Buy Tricks, Sleights, Knacks and upgrades. You hold ${coins} credits.`;
    case 'reward':     return `A ${limits.grid_rows.current}x${limits.grid_cols.current} board of rewards. Take a connected path of up to ${mapRewardPath()} tiles.`;
    case 'event':      return t.eventFlavor || 'Something happens.';
    case 'limitbreak': return 'Raise a limit, or trade one away for credits.';
    case 'boss': {
      const b = (t.hidden && !t.visited) ? null : mapBossPreset(t);
      return (b ? b.name + '. ' : '') + (b?.brief || 'The end of the schedule.') + ` ${G}: ${mapReviewGoalShown().toLocaleString()}.`
        + (t.slot ? ' ' + mapBossCondSay(t) : '');
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
// r706: leaving a slot early still moves the curve one step for each booking left
// in it, so every slot passed is worth mapSlotCap() levels whatever was booked.
function mapTileSoonest(t, legalIds) {
  if (t.visited) return null;
  const cap = mapSlotCap(), legal = !!(legalIds && legalIds.has(t.id));
  if (!mapPos) return (legalIds && !legal && t.set === 0) ? null : t.set * cap + 1;
  if (t.set <= mapPos.set) return legal ? 1 : null;
  if (t.set === mapPos.set + 1 && legalIds && !legal) return null;
  return Math.max(0, cap - mapVisits) + (t.set - mapPos.set - 1) * cap + 1;
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
      // r690: a priority account (and a one-on-one) pays the reward board; its line says how long a path.
      const path = (t.kind === 'challenge' && !t.audit) ? `PATH OF ${mapRewardPath()}` : null;
      return { short: `${mapGoalWord()} ${mapNum(g)}${k > 1 ? '+' : ''}`, path, goal: g, k };
    }
    case 'shop':       return { short: creditsTxt(coins) };
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
  // r679: Q1's opener shape is rolled ONCE here, so a shape the validator refuses
  // more often (four separate rounds fail the 2x2 rule more) is not drawn less.
  const q1 = (typeof actNumber !== 'number') || actNumber <= 1;
  const shapes = mapSlotCap() === 2 ? ['lanes', 'row', 'pairs'] : ['lanes', 'row'];
  const opener = q1 ? shapes[Math.floor(Math.random() * shapes.length)] : null;
  // r702: the second review and the hidden third are dealt from the bag once per
  // map (review A is the quarter's held boss, actBossId).
  const bosses = mapDrawReviewPresets();
  for (let attempt = 0; attempt < 80; attempt++) {
    const tiles = _mapBuildOnce(opener, bosses);
    if (tiles && _mapValidate(tiles)) { mapTiles = tiles; return; }
  }
  // 80 straight failures means a rule is unsatisfiable - keep the last build
  // rather than an empty map, and say so in dev.
  mapTiles = _mapBuildOnce(opener, bosses) || [];
  console.warn('[MAP] generation fell back past validation');
}

function mapDrawReviewPresets() {
  const a = (typeof actBossId !== 'undefined' && actBossId) || null;
  const draw = (not) => {
    if (typeof nextBossPreset !== 'function') return null;
    let p = null;
    for (let k = 0; k < 8; k++) { p = nextBossPreset(); if (p && !not.includes(p.id)) break; }
    return p ? p.id : null;
  };
  const b = draw([a]);
  const x = draw([a, b]);
  return { a, b, x };
}
function _mapBuildOnce(opener, bosses) {
  _mapTileId = 0;
  const tiles = [];
  const put = (lane, set, kind, extra) => {
    const t = { id: 'mt' + (++_mapTileId), lane, set, kind, span: 1, visited: false, ...(extra || {}) };
    tiles.push(t); return t;
  };

  // Slot 1 (r679, owner): in Q1 it is all rounds, in one of three shapes: a round
  // a lane, one round across the whole row (one booking fills the slot), or two
  // 2-wide rounds (wide shape only). Q2 on, slot 1 is a row like any other.
  if (opener === 'row') put(0, 0, 'level', { cols: MAP_LANES });
  else if (opener === 'pairs') { put(0, 0, 'level', { cols: 2 }); put(2, 0, 'level', { cols: 2 }); }
  else if (opener === 'lanes') for (let l = 0; l < MAP_LANES; l++) put(l, 0, 'level');

  // The reviews (r702): two named managers past the funnel, each owning half the
  // lanes (the wide shape) or a kind of booking (the tall shape), and a hidden third.
  const half = Math.ceil(MAP_LANES / 2);
  const lanesA = [], lanesB = [];
  for (let l = 0; l < MAP_LANES; l++) (l < half ? lanesA : lanesB).push(l);
  const bz = bosses || {};
  put(0, MAP_BOSS_SET, 'boss', { slot: 'a', lanes: lanesA, presetId: bz.a || null });
  put(half, MAP_BOSS_SET, 'boss', { slot: 'b', lanes: lanesB, presetId: bz.b || null });
  put(0, MAP_BOSS_SET, 'boss', { slot: 'x', hidden: true, presetId: bz.x || null });

  // The funnel (last set): non-level tiles, and you take exactly ONE of them
  // whatever is there - mapLegalMoves offers only the boss once you are in it.
  // So how many lanes are solid is free to be a ROLL rather than a fixture: it
  // was always two solid and two structural blanks, which made the last choice
  // before the boss the same shape every map and cost the set before it a
  // second visit whenever your lane's funnel cell was one of the holes.
  const fsolid = Math.min(MAP_LANES, mapRollFunnelSolid());
  const funnelKinds = _mapShuffle(['shop', 'event', 'challenge', 'limitbreak'].concat(mapRewardTileOn() ? ['reward'] : []));
  // At two solid they sit on NON-ADJACENT lanes, which is the original funnel
  // shape: two options as far apart as the board allows.
  const allLanes = Array.from({ length: MAP_LANES }, (_, i) => i);
  const flanes = fsolid === 2
    ? (MAP_LANES === 3 ? [0, 2] : [[0, 2], [0, 3], [1, 3]][Math.floor(Math.random() * 3)])
    : _mapPickN(allLanes, fsolid);
  for (let l = 0; l < MAP_LANES; l++) {
    const i = flanes.indexOf(l);
    if (i >= 0) put(l, MAP_SETS - 1, funnelKinds[i % funnelKinds.length]);
    else put(l, MAP_SETS - 1, 'blank');
  }

  // The open sets (slot 1 from Q2 on, and 2 .. MAP_SETS-1): 0-2 blanks in distinct
  // middle sets, a level in every set mapLevelSets names, minimums topped up, the
  // rest drawn by weight. Fewer blanks FREES cells, so the minimums only ever get
  // easier to satisfy. r679: no slot takes more than MAP_KIND_CAP of one kind.
  const midSets = [];
  for (let s = (opener ? 1 : 0); s <= MAP_SETS - 2; s++) midSets.push(s);
  const blankSets = _mapPickN(midSets.filter(s => s > 0), mapRollBlanks());
  const levelSets = mapLevelSets();
  const free = [];   // [lane, set] cells still to fill
  midSets.forEach(s => {
    const lanes = allLanes.slice();
    if (blankSets.includes(s)) {
      const bl = lanes.splice(Math.floor(Math.random() * lanes.length), 1)[0];
      put(bl, s, 'blank');
    }
    if (levelSets.includes(s)) {
      const lv = lanes.splice(Math.floor(Math.random() * lanes.length), 1)[0];
      put(lv, s, 'level');
    }
    lanes.forEach(l => free.push([l, s]));
  });

  const inSet = (k, s) => tiles.filter(t => t.set === s && t.kind === k).length;
  const roomFor = (k, s) => inSet(k, s) < MAP_KIND_CAP;
  // Top the minimums up, counting what the funnel already placed.
  const count = k => tiles.filter(t => t.kind === k).length;
  const mins = mapMinimums();
  for (const [k, min] of mins) {
    let missing = min - count(k);
    while (missing-- > 0 && free.length) {
      const ok = free.filter(([, s]) => roomFor(k, s));
      if (!ok.length) break;
      const cell = ok[Math.floor(Math.random() * ok.length)];
      free.splice(free.indexOf(cell), 1);
      put(cell[0], cell[1], k);
    }
  }
  // The rest by weight. r673: the quarter's department makes its own kind likelier.
  // r690: no reward row outside IT, and none past MAP_REWARD_MAX. r679: a kind
  // already at MAP_KIND_CAP in the slot is left out of the roll.
  const W = mapFillWeights();
  while (free.length) {
    const [l, s] = free.pop();
    const full = count('reward') >= MAP_REWARD_MAX;
    const open = W.filter(([k]) => roomFor(k, s) && !(full && k === 'reward'));
    put(l, s, _mapRollW(open.length ? open : W.filter(([k]) => roomFor(k, s))) || 'level');
  }

  // Mysteries: up to MAP_MAX_MYSTERY, never in set 1, never a blank. r690 (owner):
  // the kind under one is ROLLED from MAP_MYSTERY_W, not the cell's own. A tile a
  // minimum or a slot's one round stands on is never taken, so what the map
  // promises is on its visible tiles.
  const _mMax = (typeof deptMysteryMax === 'function') ? deptMysteryMax(MAP_MAX_MYSTERY) : MAP_MAX_MYSTERY;
  const needed = t => {
    const vis = k => tiles.filter(x => x.kind === k && !x.mystery).length;
    if (t.kind === 'level' && t.set >= 1 && t.set <= MAP_SETS - 2
        && tiles.filter(x => x.set === t.set && x.kind === 'level' && !x.mystery).length < 2) return true;
    const m = mins.find(([k]) => k === t.kind);
    return !!m && vis(t.kind) <= m[1];
  };
  let mLeft = Math.floor(Math.random() * (_mMax + 1));
  for (const t of _mapShuffle(tiles.filter(t => t.set > 0 && t.kind !== 'blank' && t.kind !== 'boss'))) {
    if (mLeft <= 0) break;
    if (needed(t)) continue;
    mLeft--;
    const MW = MAP_MYSTERY_W.filter(([k]) => !(k === 'level' && t.set === MAP_SETS - 1)
      && !(k === 'reward' && t.kind !== 'reward' && count('reward') >= MAP_REWARD_MAX));
    const k = _mapRollW(MW) || 'event';
    t.mystery = true;
    t.kind = (k === 'audit' || k === 'priority' || k === 'mini') ? 'challenge' : k;
    if (t.kind === 'challenge') t._mx = k;   // read by the naming pass below
  }

  // One 2x1 event, half the time: an event in sets 2..4 absorbs the cell ahead
  // of it. Refused when the absorbed cell is a blank, a mystery, or the only
  // level of its set (validation would catch it, but this keeps the retry rate
  // sane).
  if (Math.random() < 0.5) {
    const heads = tiles.filter(t => t.kind === 'event' && !t.mystery && !t.cols && t.set >= 1 && t.set <= MAP_SETS - 3);
    _mapShuffle(heads);
    for (const h of heads) {
      const ahead = tiles.find(t => t.lane === h.lane && t.set === h.set + 1);
      if (!ahead || ahead.kind === 'blank' || ahead.mystery) continue;
      if (ahead.cols > 1) continue;
      if (ahead.kind === 'level' && levelSets.includes(ahead.set)
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
    if (t.kind !== 'challenge') return;
    // A mystery's roll decides the face (r690); any other challenge tile rolls the audit share.
    const mx = t._mx; delete t._mx;
    if (mx ? mx === 'audit' : Math.random() < auditShare) { t.audit = true; return; }
    const ch = mapRollChallenge(mx === 'mini' ? 'mini' : mx === 'priority' ? 'task' : null);
    t.challenge = { id: ch.id, label: ch.label, goalMult: ch.goalMult, credits: ch.credits };
  });
  return tiles;
}

// A priority account's ask: any CHALLENGE_DEFS row, or only the boss handicaps
// (`mini`) or only the rest (`task`). Falls back to the whole table.
function mapRollChallenge(want) {
  if (!want) return rollChallengeLevel();
  const ok = d => { try { return !d.avail || d.avail(); } catch (e) { return false; } };
  const pool = CHALLENGE_DEFS.filter(d => ok(d) && (want === 'mini' ? !!d.mini : !d.mini));
  if (!pool.length) return rollChallengeLevel();
  const d = pool[Math.floor(Math.random() * pool.length)];
  return { ...d, rewardText: `+${d.credits} credits` };
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
  if (mapMinimums().some(([k, min]) => count(k) < min)) return false;
  if (count('reward') > MAP_REWARD_MAX) return false;
  for (const s of mapLevelSets())
    if (!tiles.some(t => t.set === s && t.kind === 'level')) return false;
  // r679: at most MAP_KIND_CAP of one kind in a slot (a wide tile counts once).
  for (let s = 0; s < MAP_SETS; s++) {
    const inS = tiles.filter(t => t.set === s && t.kind !== 'blank');
    if (s === 0 && inS.every(t => t.kind === 'level')) continue;   // Q1's all-rounds opener
    const n = {};
    for (const t of inS) { n[t.kind] = (n[t.kind] || 0) + 1; if (n[t.kind] > MAP_KIND_CAP) return false; }
  }
  const kindAt = (l, s) => {
    for (const t of tiles) {
      if (t.lane === l && t.set === s) return t.kind;
      if (t.span === 2 && t.lane === l && t.set + 1 === s) return t.kind;
      if (t.cols > 1 && t.set === s && l > t.lane && l < t.lane + t.cols) return t.kind;
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
  // r679: the tall shape (one booking a slot) is validated under the pick rule only;
  // the old walk cannot turn sideways there, so it would refuse every map with a blank.
  const ok = mapSlotCap() === 1 ? mapPickCanFinish(0, {})
    : Array.from({ length: MAP_LANES }, (_, l) => l).every(l => mapCanFinishFrom(l, 0, 1)) && mapPickCanFinish(0, {});
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
  if (visits < mapSlotCap()) {
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
  // r679: under the pick rule the start is judged by the pick rule's own DP (the
  // walk's DP read a whole-row opener as "lane 0 only" and called it doomed).
  const canFinishAfter = (t, after) => mapPickRule() ? mapPickCanFinish(after.set, {}) : mapCanFinishFrom(after.lane, after.set, after.visits);
  const consider = (t, after, from) => {
    if (!t || t.visited || t.kind === 'blank') return;
    if (t.kind !== 'boss' && !canFinishAfter(t, after)) { push({ tile: t, from, doomed: true }); return; }
    push({ tile: t, after, from });
  };
  if (!mapPos) {
    // Off-map: any solid tile in set 1.
    mapTiles.filter(t => t.set === 0 && t.kind !== 'blank' && !t.visited)
      .forEach(t => consider(t, { lane: t.lane, set: t.span === 2 ? 1 : 0, visits: mapTileBookings(t) }, null));
    return out;
  }
  if (mapPickRule()) { mapPickMoves(push); return out; }
  const origins = [];
  for (const o of mapOrigins()) {
    const w = mapCellTile(o.lane, o.set);
    if (w && w.cols > 1 && w.set === o.set) for (let l = w.lane; l < w.lane + w.cols; l++) origins.push({ lane: l, set: o.set });
    else origins.push(o);
  }
  for (const o of origins) {
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
      if (visits < mapSlotCap()) {
        for (const dl of [-1, 1]) {
          const t = mapCellTile(lane + dl, set);
          if (t && t.set === set) consider(t, { lane: t.lane, set, visits: visits + 1 }, from);
        }
      }
      mapBossOffer().forEach(b => { if (!b.visited) push({ tile: b, after: { lane, set: MAP_BOSS_SET, visits: 1 }, from }); });
      continue;
    }
    // Vertical, while the set has room.
    if (visits < mapSlotCap()) {
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
  if (mapVisits < mapSlotCap()) tilesOf(set).forEach(t => add(t, t.span === 2
    ? { lane: t.lane, set: set + 1, visits: 1 }
    : { lane: t.lane, set, visits: mapVisits + mapTileBookings(t) }));
  if (set >= MAP_SETS - 1) {
    mapBossOffer().forEach(b => { if (!b.visited) push({ tile: b, after: { lane, set: MAP_BOSS_SET, visits: 1 }, from }); });
  } else {
    tilesOf(set + 1).forEach(t => add(t, t.span === 2
      ? { lane: t.lane, set: set + 2, visits: 1 }
      : { lane: t.lane, set: set + 1, visits: mapTileBookings(t) }));
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
  // r679: the list's shape is the map's (3 x 6 or 4 x 4). Rows never go under
  // --ml-min; when they would, the list scrolls (overflow-y, css/map-mode.css).
  list.style.setProperty('--ml-lanes', String(MAP_LANES));
  list.style.setProperty('--ml-sets', String(MAP_SETS));
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
    const booked = (s === curSet && mapPos && !isReview && mapSlotCap() > 1) ? `<i>${mapVisits}/${mapSlotCap()}</i>` : '';
    // r702: the review row's gutter carries the quota (the two review tiles have no room for it).
    const quota = isReview ? `<i>${mapNum(mapReviewGoalShown())}</i>` : '';
    time.innerHTML = `<b>${mapSlotTimes()[s] || ''}</b><span>${isReview ? 'REVIEW' : 'SLOT ' + (s + 1)}</span>${booked}${quota}`;
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
      + (t.span === 2 ? ' mt-span' : '')
      + (t.cols > 1 ? ((t.cols >= MAP_LANES) ? ' mt-wide' : ' mt-pair') : '');
    div.style.gridRow = (t.set + 1) + (t.span === 2 ? ' / span 2' : '');
    div.style.gridColumn = isBoss ? '2 / -1' : (t.lane + 2) + (t.cols > 1 ? ' / span ' + t.cols : '');
    const hidden = t.mystery && !t.revealed;
    // An event's line is its own name; every other line is its kind's word.
    const isEv = t.kind === 'event' && t.eventName && !hidden;
    const word = hidden ? '???' : isEv ? t.eventName : (MAP_KIND_META[mapTileMetaKey(t)] || MAP_KIND_META.event).name;
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
        + (stake ? `<span class="mt-stake${stake.k > 1 ? ' mt-proj' : ''}">${stake.short}</span>` : '')
        + (stake && stake.path ? `<span class="mt-stake">${stake.path}</span>` : '');
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
  mapTiles.forEach(t => { if (t.kind !== 'boss') drawTile(t); });
  // r702: the review row holds the two named managers side by side, each with
  // what unlocks it; once neither can be unlocked, the hidden third alone.
  const revs = document.createElement('div');
  revs.className = 'mtm-reviews';
  revs.style.gridRow = String(MAP_SETS + 1);
  const showHidden = mapBossShowHidden();
  const shown = mapBossTiles().filter(t => showHidden ? t.hidden : !t.hidden);
  shown.forEach(t => {
    const legalT = legalIds.has(t.id);
    const open = mapBossUnlocked(t), reach = mapBossReachable(t);
    const box = t.visited ? 'x' : mapSelected === t.id ? '>' : (open || t.hidden) ? ' ' : reach ? ' ' : '-';
    const p = (t.hidden && !t.visited) ? null : mapBossPreset(t);
    const div = document.createElement('div');
    div.className = 'map-tile mk-boss mt-review'
      + (t.visited ? ' mt-visited' : '')
      + (legalT ? ' mt-legal' : '')
      + (mapSelected === t.id ? ' mt-selected' : '')
      + (!t.hidden && !open && !t.visited ? (reach ? ' mt-locked' : ' mt-missed') : '')
      + (t.hidden ? ' mt-hidden' : '');
    div.innerHTML =
      `<span class="mt-line"><span class="mt-box">[${box}]</span><span class="mt-icon">${MAP_KIND_META.boss.icon}</span>`
      + `<span class="mt-name">${p ? p.name : '???'}</span></span>`
      + `<span class="mt-cond">${mapBossCondShort(t)}</span>`;
    div.title = 'Manager Review - ' + mapTileDesc(t, legalIds);
    div.onclick = () => mapTileTap(t);
    div.onmouseenter = () => { if (!mapSelected) mapBarInfo(t, mapMoveFor(t.id)); };
    div.onmouseleave = () => { if (!mapSelected) mapBarInfo(null); };
    revs.appendChild(div);
    if (animateIn) div.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 140, delay: MAP_SETS * 90, easing: 'steps(3, end)', fill: 'backwards' });
  });
  list.appendChild(revs);

  // The toolbar: built empty here, filled by mapRenderBar (which every caller runs next).
  const bar = document.createElement('div');
  bar.id = 'map-bar';
  term.appendChild(bar);
  gridEl.appendChild(term);
  mapListScrollSync();
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

// A list taller than its box scrolls; the slot you are in is kept in view, and in
// the last slot (or with the review armed) the reviews are what matters, so the end.
// Run after the toolbar is filled too: the bar is a flex sibling, so the list only
// overflows once the bar has its height.
function mapListScrollSync() {
  const list = document.querySelector('#grid .mtm-list');
  const nowRow = list && list.querySelector('.mtm-row.now');
  if (!list || list.scrollHeight <= list.clientHeight + 1) return;
  const curSet = mapPos ? Math.min(mapPos.set, MAP_SETS) : 0;
  const top = (curSet >= MAP_SETS - 1 || mapBossArmed || !nowRow) ? list.scrollHeight
    : nowRow.offsetTop - Math.max(0, (list.clientHeight - nowRow.offsetHeight) / 2);
  list.scrollTop = Math.max(0, top);
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
  ['Long lunch', 'Leaving a slot after only one obligation is a long lunch: a perk, most often the department\u2019s (tap LONG LUNCH on the bar). The goal still moves on as if you had booked.'],
  ['Last slot', 'Book it like any other, then the review.'],
  ['Blocked out', 'Nothing scheduled there, and no way through.'],
];
// r648: the pick rule's card (the default). MAP_HELP is the old rule's.
const MAP_HELP_PICK = [
  ['Pick', 'Take any lit obligation in this time slot or the next. Everything you take happens.'],
  ['Two a slot', 'Book any two obligations in a slot, next to each other or not. Then move on.'],
  ['Moving on', 'You can start the next slot on any obligation in it.'],
  ['Long lunch', 'Leaving a slot after only one obligation is a long lunch: a perk, most often the department\u2019s (tap LONG LUNCH on the bar). The goal still moves on as if you had booked.'],
  ['Last slot', 'Book it like any other, then the review.'],
  ['Blocked out', 'Nothing scheduled there.'],
];
// r679: the tall shape's card, one booking a slot.
const MAP_HELP_ONE = [
  ['Pick', 'Take any lit obligation in this time slot. Everything you take happens.'],
  ['One a slot', 'Book one obligation in each slot, then the next slot opens.'],
  ['Blocked out', 'Nothing scheduled there.'],
];
function mapHelpRows() {
  const rows = (mapSlotCap() < 2 ? MAP_HELP_ONE : mapPickRule() ? MAP_HELP_PICK : MAP_HELP).slice();
  // r702: the two reviews.
  rows.push(['Two reviews', mapBossRule() === 'lanes'
    ? `Each review unlocks at ${MAP_BOSS_NEED.lanes} bookings in its two lanes. Neither unlocked: a random manager.`
    : `One review unlocks at ${MAP_BOSS_NEED.kinds} rounds booked, the other at ${MAP_BOSS_NEED.kinds} other obligations. A mystery counts as another obligation, and as a round too if it is one. Neither: a random manager.`]);
  const d = (typeof deptHelpRow === 'function') ? deptHelpRow() : null;   // r673: this quarter's department
  if (d) rows.unshift(d);
  return rows;
}
// r673 (owner): leaving a slot early pays the department's Standard reward, first tier.
// r706: leaving early is a LONG LUNCH (js/skip-perks.js). The bar names it and,
// on a tap or a hover, the department's most likely perk; never the whole table.
function mapSkipShort() { return 'LONG LUNCH'; }
function mapSkipSay() { return (typeof lunchLikelySay === 'function') ? lunchLikelySay() : 'Long lunch: a random perk.'; }
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
    : `BOOKED ${mapPos ? (mapFreeBranchOn() ? mapVisitsInSet(mapPos.set) : mapVisits) : 0}/${mapSlotCap()}${mapFreeBranchOn() ? ' FREE' : ''}`;
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
      (crunch || mapSlotCap() < 2 ? '' : `<span class="mb-skip" id="mb-skip" title="${mapSkipSay()}">${mapSkipShort()}</span>`) +
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
  // The LONG LUNCH chip: a tap (or a hover) prints the department's likely perk on the info line.
  const lunch = document.getElementById('mb-skip');
  if (lunch) {
    const show = () => { const el = document.getElementById('mb-info'); if (el) el.innerHTML = mapSkipSay(); };
    lunch.onclick = e => { e.stopPropagation(); show(); };
    lunch.onmouseenter = show;
    lunch.onmouseleave = () => { const sel = mapSelected && mapTiles.find(x => x.id === mapSelected); mapBarInfo(sel || null, sel ? mapMoveFor(mapSelected) : null); };
  }
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
  mapListScrollSync();
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
      : mapSlotCap() < 2 ? 'Book one in each slot. Everything you book happens.'
      : mapPickRule() ? 'Book any two in a slot, in any order. Everything you book happens.'
      : 'Move up, down or forward. Everything you book happens.';
    return;
  }
  let s = mapTileDesc(t);
  if (move && !move.doomed) {
    // Crunch pays nothing for a skip (js/crunch-mode.js), so it must not be
    // advertised here either - a bar promising credits the confirm will not pay
    // is worse than saying nothing.
    if (move.from && move.after.set > move.from.set && move.from.visits < mapSlotCap()
        && !(typeof crunchActive === 'function' && crunchActive()))
      s += ` <i>leaving now is a long lunch</i>`;
    if (t.span === 2) s += ` <i>runs over two slots</i>`;
    if ((t.cols || 1) >= MAP_LANES && mapSlotCap() > 1) s += ` <i>fills the slot</i>`;
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
  else if (t.kind === 'boss') { if (t.slot && !mapBossUnlocked(t) && !t.hidden) s += ' <i>locked</i>'; }
  else s += ' <i>not reachable from here</i>';
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
  // r706 (owner): leaving early still moves the curve, one step a booking left
  // behind, so a skip never lowers a later goal (Crunch included).
  if (move.from && move.after.set > move.from.set && move.from.visits < mapSlotCap()) {
    for (let n = mapSlotCap() - move.from.visits; n > 0; n--) guidedAdvanceCurve();
  }
  if (move.from && move.after.set > move.from.set && move.from.visits < mapSlotCap()
      && !(typeof crunchActive === 'function' && crunchActive())) {
    mapSkips++;
    // r706 (owner): a long lunch, one perk from js/skip-perks.js, the department's
    // own most often (r673 paid the department's Standard reward).
    const said = (typeof longLunch === 'function') ? longLunch() : (coins += 10, updateCoinsUI?.(), '+10 credits');
    showMessage(`Long lunch · ${said}`, 'var(--gold)');
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
      // r702: the review you booked is the one you face (takeActBoss hands it over).
      if (t.presetId && typeof actBossId !== 'undefined' && (t.slot !== 'a' || !actBossId)) actBossId = t.presetId;
      if (t.hidden) { const hp = mapBossPreset(t); if (hp) showMessage(`The review: ${hp.name}`, 'var(--gold)'); }
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

// The boss quota is FIXED (MAP_REVIEW_LEVEL) whatever level the walk reached. Hooked from triggerLevelUp right after
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
// r690 (owner): what the round pays is its tile's (mapPosTileId, saved, so a
// resumed round pays the same). A round: the pick of three. A priority account
// or a one-on-one: the reward board (the r684 brief's REWARD tile, folded in; its
// knack pick of two and the pick of three are gone). An audit: its cards, nothing
// more. The reward board closes back to the map (finishInterludeRoute).
function mapAfterLevel() {
  const done = () => mapOpen();
  if (!mapPos) { done(); return; }   // resumed pre-map edge: straight back to the map
  const t = mapTiles.find(x => x.id === mapPosTileId);
  // An audit (js/challenge-round.js) pays no prize grid (owner, r666). crTakePrize
  // is still called so the round's state is cleared.
  if (typeof crTakePrize === 'function') crTakePrize();
  if (t && t.kind === 'challenge' && !t.audit) { rewardGridContext = 'interlude'; openRewardGrid(); return; }
  if (t && t.kind === 'challenge') { done(); return; }
  guidedOpenPickThree(done);
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
