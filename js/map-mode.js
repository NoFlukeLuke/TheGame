// ══════════════════════════════════════════════
// MAP MODE (r238) - the run is a board you walk
// ══════════════════════════════════════════════
// EACH QUARTER is a MAP: 4 lanes x MAP_SETS sets of tiles, then a full-width
// boss. Beat it and the quarter closes, a fresh map is drawn, and the run is
// one of those per quarter (r252) - the same shape every act mode has.
// The grid IS the map (the same borrow the shop makes): tiles fall in like a
// deal, you pick one, CONFIRM, the map falls out the bottom, the grid resizes
// back to play size and the round deals in behind the 3-2-1.
//
// ── The rules, as agreed with the owner ──────────────────────────────────────
// - Movement is STRICTLY ORTHOGONAL and every step activates the tile you step
//   on. Within a set you may visit at most 2 tiles (so the two must be
//   vertically adjacent); moving forward enters the next set at your lane.
// - Leaving a set after only ONE visit pays MAP_SKIP_BASE + MAP_SKIP_STEP * n
//   credits (n = how many times you have skipped this run): 6, 8, 10...
// - Set 1 is ALL LEVELS. Sets 2..5 each carry at least one level. The final
//   set is the FUNNEL: non-level tiles only, and how many of its four lanes
//   carry one is a roll (r253). It books TWO like any other slot (r283) - at a
//   two-solid funnel they sit on non-adjacent lanes, so the board is what
//   limits you to one there, not a rule.
// - Two BLANKS somewhere in the middle sets (never set 1). Inert by default -
//   they cannot be stepped on or through. Up to two MYSTERY tiles hide their
//   kind until confirmed (they still count toward the minimums underneath).
// - A rare 2x1 EVENT tile spans two sets lengthways. It charges ONE visit,
//   lands you in its second set with that visit spent, and you can never go
//   back to its first set.
// - Every tile advances the difficulty curve (Guided's load-bearing rule):
//   levels through triggerLevelUp, everything else through guidedAdvanceCurve.
// - The boss goal is FIXED at map build: MAP_BOSS_LEVELS levels of a steeper
//   curve than Classic's, from the level the QUARTER OPENS ON, previewable from
//   the map before you can reach it.
//
// ── DEAD ENDS ARE REFUSED, NOT DISCOVERED ────────────────────────────────────
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
const MAP_SETS  = 6;              // regular sets; the boss column is index MAP_SETS
const MAP_BOSS_SET = MAP_SETS;    // 6
const MAP_SKIP_BASE = 4, MAP_SKIP_STEP = 2;   // skip n pays BASE + STEP*n: 6, 8, 10...
const MAP_MAX_MYSTERY = 2;
// Blanks are a ROLL, not a fixture: about half of maps carry two, the rest one
// or none, so "is there a dead cell in my way" is a thing you read off the map
// rather than a constant you learn once. Index = number of blanks.
const MAP_BLANK_ODDS = [0.12, 0.38, 0.50];
const MAP_BLANKS_MAX = MAP_BLANK_ODDS.length - 1;
// How many of the funnel's four lanes carry a real tile. Two is the old fixed
// shape and is now the least likely; four means no structural blanks at all.
const MAP_FUNNEL_SOLID_ODDS = { 2: 0.25, 3: 0.40, 4: 0.35 };
function mapRollFunnelSolid() {
  let r = Math.random();
  for (const k of [2, 3, 4]) { r -= MAP_FUNNEL_SOLID_ODDS[k]; if (r < 0) return k; }
  return 4;
}
function mapRollBlanks() {
  let r = Math.random();
  for (let i = 0; i < MAP_BLANK_ODDS.length; i++) {
    r -= MAP_BLANK_ODDS[i];
    if (r < 0) return i;
  }
  return MAP_BLANKS_MAX;
}
// The boss quota: MAP_BOSS_LEVELS levels of a curve a notch steeper than
// Classic's GOAL_SCALE (1.35). Computed once at run start so the map can print
// it before the first tile is taken.
const MAP_BOSS_LEVELS = 9;
const MAP_BOSS_SCALE  = 1.40;
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
  if (mapScreenOpen) mapRender();
}
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

// The boss quota is FIXED at map build, and ANCHORED TO THE LEVEL THE QUARTER
// OPENS ON: MAP_BOSS_LEVELS of the steeper curve from here. At Q1 that reads
// goalForLevel(1) = BASE_GOAL and reproduces the r238 figure exactly (17,500);
// Q2 and Q3 open around level 11 and 21, so they ask for what a quarter of
// progress from THERE is worth rather than repeating Q1's number three times.
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
  level:      { icon: '▶', name: 'ACCOUNT',   full: 'Client Account',   cls: 'mk-level',
                blurb: 'An ordinary round. Clear it and take a pick of three.' },
  challenge:  { icon: MAP_ICON_PRIORITY, name: 'PRIORITY', full: 'Priority Account', cls: 'mk-challenge',
                blurb: 'A round with a raised goal and one extra ask. Pays credits and a knack.' },
  shop:       { icon: '🛒', name: 'MART',      full: 'LETHE Mart',       cls: 'mk-shop',
                blurb: 'The company store. Spend credits on anything on the shelves.' },
  reward:     { icon: '▦', name: 'INCENTIVE', full: 'Incentive Program', cls: 'mk-reward',
                blurb: 'A board of rewards. Pick a connected path across it.' },
  event:      { icon: '✧', name: 'MEETING',   full: 'Meeting',          cls: 'mk-event',
                blurb: 'One screen, one decision. The tile names which.' },
  limitbreak: { icon: '▲', name: 'RAISE',     full: 'Raise Request',    cls: 'mk-limit',
                blurb: 'Raise a limit, or trade one away for credits.' },
  blank:      { icon: '',  name: '',          full: 'Not scheduled',    cls: 'mk-blank',
                blurb: 'Nothing booked there, and no way through it.' },
  boss:       { icon: '☠', name: 'REVIEW',    full: 'Manager Review',   cls: 'mk-boss',
                blurb: 'The end of the schedule, on its own quota.' },
};

function mapTileFace(t) {
  // What the PLAYER sees - a mystery hides its kind until confirmed.
  if (t.mystery && !t.revealed) return { icon: '?', name: '???', full: 'Unconfirmed', cls: 'mk-mystery' };
  const m = MAP_KIND_META[t.kind] || MAP_KIND_META.event;
  if (t.kind === 'event' && t.eventName) return { ...m, name: t.eventName };
  return m;
}
function mapTileDesc(t) {
  if (t.mystery && !t.revealed) return 'Unconfirmed until you commit to it.';
  switch (t.kind) {
    case 'level':      return 'Play a round. Clear the goal, take the payout and a pick of three.';
    case 'challenge':  return (t.challenge ? t.challenge.label + ' ' : '')
      + `Goal +${Math.round(((t.challenge?.goalMult || 1.2) - 1) * 100)}%, pays +${t.challenge?.credits || 0} credits, plus a knack pick.`;
    case 'shop':       return 'The company store. Buy Tricks, Sleights, Knacks and upgrades.';
    case 'reward':     return 'Pick a path across a board of rewards.';
    case 'event':      return t.eventFlavor || 'Something happens.';
    case 'limitbreak': return 'Raise a limit, or trade one away for credits.';
    case 'boss':       return (peekBossPresetSafe()?.brief || 'The end of the schedule.')
      + ` Quota: ${mapBossGoal}.`;
  }
  return '';
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
  const needs = [['shop', 2], ['challenge', 2], ['event', 3], ['reward', 2]];
  for (const [k, min] of needs) {
    let missing = min - count(k);
    while (missing-- > 0 && free.length) {
      const [l, s] = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      put(l, s, k);
    }
  }
  // The rest by weight.
  const W = [['level', 30], ['event', 26], ['reward', 20], ['shop', 10], ['challenge', 10], ['limitbreak', 4]];
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
  _mapPickN(mysteryable, Math.floor(Math.random() * (MAP_MAX_MYSTERY + 1)))
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
  tiles.forEach(t => {
    if (t.kind === 'event') {
      const id = evPool.length ? evPool[ei++ % evPool.length] : null;
      t.eventId = id;
      t.eventName = id ? EVENT_META[id].name : 'Event';
      t.eventFlavor = id ? EVENT_META[id].flavor : '';
    }
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
  if (count('shop') < 2 || count('challenge') < 2 || count('event') < 3 || count('reward') < 2) return false;
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
  if (!mapFreeBranch) return mapPos ? [{ lane: mapPos.lane, set: mapPos.set }] : [];
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
  return mapFreeBranch ? mapVisitsInSet(set) + 1 : 1;
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
  for (const o of mapOrigins()) {
    const { lane, set } = o;
    const visits = mapFreeBranch ? mapVisitsInSet(set) : mapVisits;
    const from = { lane, set, visits };
    // THE LAST SLOT BOOKS TWO LIKE EVERY OTHER SLOT (r283, owner's call).
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
  if (mapLandscape) { gridRows = MAP_LANES; gridCols = MAP_SETS + 1; }
  else              { gridRows = MAP_SETS + 1; gridCols = MAP_LANES; }
  recomputeGridMetrics();
  document.getElementById('next-goal-bg')?.classList.remove('show');
  document.body.classList.add('map-active');
  if (typeof enterGridScreenHud === 'function') enterGridScreenHud('SCHEDULE', 'shop');
  try { sfxShopOpen?.(); } catch (e) {}
  mapRender(true);
  mapRenderBar();
}

// lane/set -> pixel cell, honouring orientation. In landscape the run reads
// left to right; in portrait, top to bottom.
function _mapCellXY(lane, set) {
  return mapLandscape
    ? { x: cellLeft(set), y: cellTop(lane) }
    : { x: cellLeft(lane), y: cellTop(set) };
}

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
  if (ls) { gridRows = MAP_LANES; gridCols = MAP_SETS + 1; }
  else    { gridRows = MAP_SETS + 1; gridCols = MAP_LANES; }
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

  const spanW = (n) => n * (CARD_W + CARD_GAP) - CARD_GAP;
  const spanH = (n) => n * (CARD_H + CARD_GAP) - CARD_GAP;
  const FALL_DUR = 380, BOUNCE = 6, SQUISH = 0.08;

  // ── The board under the tiles ──────────────────────────────────────────────
  // One backdrop, one band per set, and the route: faint rails between sets
  // plus the BRIGHT line of where you have actually walked. All of it is
  // absolutely-positioned siblings behind the tiles (z-index 1 against their 2),
  // drawn from the same cell metrics, so nothing here needs to know which way
  // round the board reads.
  const boardW = mapLandscape ? spanW(MAP_SETS + 1) : spanW(MAP_LANES);
  const boardH = mapLandscape ? spanH(MAP_LANES)    : spanH(MAP_SETS + 1);
  const PAD = 8;
  const bg = document.createElement('div');
  bg.className = 'map-board' + (mapLandscape ? ' mb-land' : ' mb-port');
  bg.style.cssText = `left:${cellLeft(0) - PAD}px;top:${cellTop(0) - PAD}px;`
                   + `width:${boardW + PAD * 2}px;height:${boardH + PAD * 2}px;`;
  gridEl.appendChild(bg);

  // A band per set, numbered, so the six-stop structure reads before any tile does.
  for (let sIdx = 0; sIdx < MAP_SETS; sIdx++) {
    const here = mapPos ? mapPos.set === sIdx : sIdx === 0;
    const band = document.createElement('div');
    band.className = 'map-band' + (sIdx % 2 ? ' mb-odd' : '') + (here ? ' mb-now' : '');
    const a = _mapCellXY(0, sIdx);
    band.style.cssText = mapLandscape
      ? `left:${a.x - 2}px;top:${cellTop(0) - PAD + 2}px;width:${CARD_W + 4}px;height:${boardH + PAD * 2 - 4}px;`
      : `left:${cellLeft(0) - PAD + 2}px;top:${a.y - 2}px;width:${boardW + PAD * 2 - 4}px;height:${CARD_H + 4}px;`;
    band.innerHTML = `<span class="mbd-no">${sIdx + 1}</span>`;
    gridEl.appendChild(band);
  }

  // The route. A rail is drawn between every pair of set-adjacent solid cells;
  // the segments you actually walked are drawn again, lit, on top of them.
  const centreOf = (lane, set) => {
    const { x, y } = _mapCellXY(lane, set);
    return { x: x + CARD_W / 2, y: y + CARD_H / 2 };
  };
  // A 2x1 tile occupies TWO cells, so the route has to run STRAIGHT THROUGH it
  // and only then turn: you enter at its head and leave from its tail. Drawing
  // it as one node at the head instead put a single diagonal from the head to
  // whatever you took next, which reads as a 45 degree short cut across a tile
  // you actually walked the length of. Hence entry and exit rather than centre.
  const entryOf = (t) => centreOf(t.lane, t.set);
  const exitOf  = (t) => centreOf(t.lane, t.set + (t.span === 2 ? 1 : 0));
  const drawSeg = (p1, p2, cls) => {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ln = document.createElement('div');
    ln.className = 'map-link ' + cls;
    ln.style.cssText = `left:${p1.x}px;top:${p1.y}px;width:${len}px;`
                     + `transform:rotate(${Math.atan2(dy, dx)}rad);`;
    gridEl.appendChild(ln);
  };
  // The spine of a 2x1: the straight run from its head to its tail.
  const drawSpine = (t, cls) => { if (t.span === 2) drawSeg(entryOf(t), exitOf(t), cls); };
  for (const t of mapTiles) {
    if (t.kind === 'blank' || t.kind === 'boss') continue;
    drawSpine(t, 'ml-rail');
    const fwd = t.set + (t.span === 2 ? 2 : 1);
    if (fwd > MAP_SETS) continue;
    for (let l = 0; l < MAP_LANES; l++) {
      const n = mapCellTile(l, fwd);
      if (!n || n.kind === 'blank') continue;
      if (n.kind === 'boss' && l !== t.lane) continue;     // the boss is one tile
      if (Math.abs(l - t.lane) > 1) continue;              // only a lane you could reach
      drawSeg(exitOf(t), centreOf(n.kind === 'boss' ? t.lane : l, fwd), 'ml-rail');
    }
  }
  const walked = mapTiles.filter(t => t.visited && t.step).sort((a, b) => a.step - b.step);
  walked.forEach(t => drawSpine(t, 'ml-walked'));
  for (let i = 1; i < walked.length; i++)
    drawSeg(exitOf(walked[i - 1]), entryOf(walked[i]), 'ml-walked');

  const drawTile = (t) => {
    const face = mapTileFace(t);
    const { x, y } = _mapCellXY(t.lane, t.set);
    const isBoss = t.kind === 'boss';
    let w = CARD_W, h = CARD_H;
    if (isBoss) { if (mapLandscape) h = spanH(MAP_LANES); else w = spanW(MAP_LANES); }
    else if (t.span === 2) { if (mapLandscape) w = spanW(2); else h = spanH(2); }

    const div = document.createElement('div');
    div.className = 'map-tile ' + face.cls
      + (t.visited ? ' mt-visited' : '')
      + (legalIds.has(t.id) ? ' mt-legal' : '')
      + (doomedIds.has(t.id) ? ' mt-doomed' : '')
      + (mapSelected === t.id ? ' mt-selected' : '')
      + (mapPosTileId === t.id ? ' mt-here' : '');
    div.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;
    // NO NAME ON THE BOARD (r276). The glyph is the whole label; the bar names
    // what you hover or pick, the ? legend lists every symbol with its word,
    // and the tile's `title` still carries both for a desktop tooltip.
    div.innerHTML =
      `<div class="mt-wash"></div>` +
      `<div class="mt-ghost">${face.icon}</div>` +
      `<div class="mt-icon">${face.icon}</div>` +
      (t.visited ? `<div class="mt-stamp">DONE</div>` : '');
    if (face.full) div.title = face.full + (mapTileDesc(t) ? ' - ' + mapTileDesc(t) : '');
    div.onclick = () => mapTileTap(t);
    div.onmouseenter = () => { if (!mapSelected) mapBarInfo(t, mapMoveFor(t.id)); };
    div.onmouseleave = () => { if (!mapSelected) mapBarInfo(null); };
    gridEl.appendChild(div);
    if (animateIn) {
      const rows = mapLandscape ? MAP_LANES : MAP_SETS + 1;
      const r = mapLandscape ? t.lane : t.set;
      const c = mapLandscape ? t.set : t.lane;
      const dropDist = (rows - r) * (CARD_H + CARD_GAP);
      div.animate([
        { opacity: 0, transform: `translateY(${-dropDist}px) scaleY(1)` },
        { opacity: 1, transform: `translateY(${-dropDist}px) scaleY(1)`, offset: 0.06 },
        { opacity: 1, transform: `translateY(${-dropDist * 0.45}px) scaleY(0.96)`, offset: 0.55, easing: 'ease-in' },
        { opacity: 1, transform: `translateY(${BOUNCE}px) scaleY(${1 - SQUISH})`, offset: 0.85 },
        { opacity: 1, transform: `translateY(${-BOUNCE * 0.6}px) scaleY(${1 + SQUISH})`, offset: 0.93 },
        { opacity: 1, transform: 'translateY(0) scaleY(1)' },
      ], { duration: FALL_DUR, delay: c * 60 + r * 35, easing: 'ease-in', fill: 'both' });
    }
  };

  mapTiles.forEach(drawTile);

  // The pen's canvas is a CHILD of #grid, which this function just emptied, so
  // it is put back here; the strokes themselves live in mapDrawStrokes and are
  // repainted onto it (js/map-draw.js).
  if (typeof mapDrawMount === 'function') mapDrawMount(gridEl);
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
  ['Leaving early', 'Leaving a slot after only one obligation pays you credits.'],
  ['Last slot', 'Book it like any other, then the review.'],
  ['Blocked out', 'Nothing scheduled there, and no way through.'],
];
function mapRenderBar() {
  let bar = document.getElementById('map-bar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'map-bar'; document.body.appendChild(bar); }
  const setNo = mapPos ? Math.min(mapPos.set + 1, MAP_SETS) : 1;
  const skipNext = MAP_SKIP_BASE + MAP_SKIP_STEP * (mapSkips + 1);
  // Every slot books two, the last one included (r283) - so the cap is flat.
  const visits = mapPos
    ? `${mapFreeBranch ? mapVisitsInSet(mapPos.set) : mapVisits}/2${mapFreeBranch ? ' FREE' : ''}`
    : 'PICK A START';
  const inked = (typeof mapDrawStrokes !== 'undefined') && mapDrawStrokes.length > 0;
  bar.innerHTML =
    `<span class="mb-set">SLOT ${setNo}/${MAP_SETS}</span>` +
    `<span class="mb-visits">${visits}</span>` +
    `<button class="mb-q" id="mb-q" title="How the schedule works">?</button>` +
    `<button class="mb-q" id="mb-key" title="What the obligations are">▤</button>` +
    `<button class="mb-q mb-pen${mapPenOn ? ' on' : ''}" id="mb-pen" ` +
      `title="Draw on the schedule (right-drag works without this; double right-click changes colour)">✎</button>` +
    `<button class="mb-q mb-sw" id="mb-pen-sw" title="Pen colour"><i id="mb-sw-dot"></i></button>` +
    (inked ? `<button class="mb-q" id="mb-undo" title="Undo the last stroke">↶</button>` +
             `<button class="mb-q" id="mb-wipe" title="Clear all ink">✕</button>` : '') +
    `<span class="mb-info" id="mb-info"></span>` +
    `<span class="mb-skip">SKIP ${skipNext}</span>` +
    `<span class="mb-coins">${coins} ◆</span>` +
    `<button id="mb-confirm" disabled>CONFIRM</button>` +
    `<div class="mb-help" id="mb-help">` +
      MAP_HELP.map(([k, v]) => `<div class="mb-hrow"><b>${k}</b><span>${v}</span></div>`).join('') +
    `</div>` +
    `<div class="mb-help" id="map-legend">` +
      (typeof mapLegendRows === 'function' ? mapLegendRows().map(r =>
        `<div class="ml-row ${r.cls}" data-cls="${r.cls}">` +
          `<span class="ml-chip">${r.icon}</span>` +
          `<b>${r.name || r.full}</b><span class="ml-txt">${r.blurb}</span>` +
        `</div>`).join('') : '') +
    `</div>`;
  bar.classList.add('show');
  const btn = document.getElementById('mb-confirm');
  btn.onclick = () => mapConfirm();
  btn.disabled = !mapSelected;
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
  document.getElementById('mb-q').onclick = cardToggle('mb-help');
  document.getElementById('mb-key').onclick = cardToggle('map-legend', () => mapLegendHighlight(null, null));
  document.getElementById('mb-pen').onclick = () => mapPenToggle();
  document.getElementById('mb-pen-sw').onclick = () => mapPenCycle();
  const undoBtn = document.getElementById('mb-undo');
  if (undoBtn) undoBtn.onclick = () => mapDrawUndo();
  const wipeBtn = document.getElementById('mb-wipe');
  if (wipeBtn) wipeBtn.onclick = () => mapDrawClear();
  // A legend row lights its own kind on the board and drops everything else.
  // Hover for a mouse, tap for a finger; the tap latches so it can be read.
  bar.querySelectorAll('#map-legend .ml-row').forEach(row => {
    const cls = row.dataset.cls;
    row.onmouseenter = () => mapLegendHighlight(cls);
    row.onmouseleave = () => mapLegendHighlight(null);
    row.onclick = (e) => {
      e.stopPropagation();
      const next = (mapLegendLatch === cls) ? null : cls;   // tap again to release
      mapLegendHighlight(next, next);
    };
  });
  if (typeof mapPenSyncChrome === 'function') mapPenSyncChrome();
  if (mapSelected) { const t = mapTiles.find(x => x.id === mapSelected); if (t) mapBarInfo(t, mapMoveFor(mapSelected)); }
  // The x/y selection readout hides on the map (r255), and nothing else repaints
  // it while the map is up - the class goes on without a render behind it.
  if (typeof updateSelectionUI === 'function') updateSelectionUI();
}

function mapBarInfo(t, move) {
  const el = document.getElementById('mb-info');
  if (!el) return;
  if (!t) { el.innerHTML = ''; return; }
  const face = mapTileFace(t);
  const full = face.full && face.full.toUpperCase() !== face.name ? `<span class="mb-full">${face.full}</span> ` : '';
  let s = `<b>${face.name}</b> ${full}${mapTileDesc(t)}`;
  if (move && !move.doomed) {
    if (move.from && move.after.set > move.from.set && move.from.visits === 1)
      s += ` <i>leaving now pays ${MAP_SKIP_BASE + MAP_SKIP_STEP * (mapSkips + 1)} ◆</i>`;
    if (t.span === 2) s += ` <i>runs over two slots</i>`;
  } else if (t.visited) s += ' <i>already taken</i>';
  else if (move && move.doomed) s += ' <i>dead-ends before the review</i>';
  else if (t.kind !== 'boss') s += ' <i>not reachable from here</i>';
  el.innerHTML = s;
}

function mapCloseScreen() {
  mapScreenOpen = false;
  mapSelected = null;
  if (typeof mapLegendHighlight === 'function') mapLegendHighlight(null, null);
  document.getElementById('map-bar')?.classList.remove('show');
  document.body.classList.remove('map-active');
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

  // Mystery reveals AT COMMIT - that is the gamble it is.
  if (t.mystery && !t.revealed) {
    t.revealed = true;
    showMessage(`It was: ${mapTileFace(t).name}`, 'var(--gold)');
  }

  // Skip payout: leaving a set after exactly one visit. Checked BEFORE the
  // position moves. THE STEP INTO THE REVIEW PAYS IT TOO (r283): the funnel
  // books two like every other slot now, so walking out of it after one is the
  // same decision the help card describes, and excluding it would leave the
  // last slot special in the one way the player can still feel.
  if (move.from && move.after.set > move.from.set && move.from.visits === 1) {
    mapSkips++;
    const pay = MAP_SKIP_BASE + MAP_SKIP_STEP * mapSkips;
    coins += pay;
    updateCoinsUI?.();
    showMessage(`Left the slot early · +${pay} credits`, 'var(--gold)');
  }

  t.visited = true;
  // The walked route is drawn from this (mapRender's trail), so the tile has to
  // remember WHEN it was taken. A plain number keeps mapTiles JSON-safe.
  t.step = (mapTiles.reduce((n, x) => Math.max(n, x.step || 0), 0)) + 1;
  mapPosTileId = t.id;
  mapPos = { lane: move.after.lane, set: move.after.set };
  mapVisits = move.after.visits;
  mapLastWasChallenge = (t.kind === 'challenge');

  switch (t.kind) {
    case 'level':
      mapFallOutAndClose(() => mapStartRound(null));
      return;
    case 'challenge': {
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
      showMessage(`+ ${k.name}`, 'var(--gold)');
      done();
    },
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
