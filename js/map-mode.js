// ══════════════════════════════════════════════
// MAP MODE (r238) - the run is a board you walk
// ══════════════════════════════════════════════
// One act as a MAP: 4 lanes x MAP_SETS sets of tiles, then a full-width boss.
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
//   set is the FUNNEL: exactly two non-level tiles on non-adjacent lanes, so
//   you take exactly one of them before the boss.
// - Two BLANKS somewhere in the middle sets (never set 1). Inert by default -
//   they cannot be stepped on or through. Up to two MYSTERY tiles hide their
//   kind until confirmed (they still count toward the minimums underneath).
// - A rare 2x1 EVENT tile spans two sets lengthways. It charges ONE visit,
//   lands you in its second set with that visit spent, and you can never go
//   back to its first set.
// - Every tile advances the difficulty curve (Guided's load-bearing rule):
//   levels through triggerLevelUp, everything else through guidedAdvanceCurve.
// - The boss goal is FIXED at map build: MAP_BOSS_LEVELS levels of a steeper
//   curve than Classic's, previewable from the map before you can reach it.
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
const MAP_BLANKS = 2;
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
  mapTiles = []; mapPos = null; mapVisits = 0; mapSkips = 0;
  mapBossArmed = false; mapFirstRoundDone = false; mapPosTileId = null;
  mapScreenOpen = false; mapSelected = null; mapLastWasChallenge = false;
  mapBossGoal = Math.round(BASE_GOAL * Math.pow(MAP_BOSS_SCALE, MAP_BOSS_LEVELS - 1) / 500) * 500;
  if (mapActive()) mapGenerate();
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

const MAP_KIND_META = {
  level:      { icon: '▶', name: 'Round',       cls: 'mk-level' },
  challenge:  { icon: '⚠', name: 'Hard Round',  cls: 'mk-challenge' },
  shop:       { icon: '🛒', name: 'Shop',        cls: 'mk-shop' },
  reward:     { icon: '▦', name: 'Reward Grid', cls: 'mk-reward' },
  event:      { icon: '✧', name: 'Event',       cls: 'mk-event' },
  limitbreak: { icon: '▲', name: 'Limit Break', cls: 'mk-limit' },
  blank:      { icon: '',  name: '',            cls: 'mk-blank' },
  boss:       { icon: '☠', name: 'BOSS',        cls: 'mk-boss' },
};

function mapTileFace(t) {
  // What the PLAYER sees - a mystery hides its kind until confirmed.
  if (t.mystery && !t.revealed) return { icon: '?', name: '???', cls: 'mk-mystery' };
  const m = MAP_KIND_META[t.kind] || MAP_KIND_META.event;
  if (t.kind === 'event' && t.eventName) return { ...m, name: t.eventName };
  return m;
}
function mapTileDesc(t) {
  if (t.mystery && !t.revealed) return 'Unknown until you commit to it.';
  switch (t.kind) {
    case 'level':      return 'Play a round. Clear the goal, take the payout and a pick of three.';
    case 'challenge':  return (t.challenge ? t.challenge.label + ' ' : '')
      + `Goal +${Math.round(((t.challenge?.goalMult || 1.2) - 1) * 100)}%, pays +${t.challenge?.credits || 0} credits, plus a knack pick.`;
    case 'shop':       return 'Buy Tricks, Sleights, Knacks and upgrades.';
    case 'reward':     return 'Pick a path across a board of rewards.';
    case 'event':      return t.eventFlavor || 'Something happens.';
    case 'limitbreak': return 'Raise a limit - or trade one away for credits.';
    case 'boss':       return (peekBossPresetSafe()?.brief || 'The end of the map.')
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

  // The funnel (last set): two non-level tiles on non-adjacent lanes; the other
  // two lanes are structural blanks (they do not count toward MAP_BLANKS).
  const funnelPairs = [[0, 2], [0, 3], [1, 3]];
  const fp = funnelPairs[Math.floor(Math.random() * funnelPairs.length)];
  const funnelKinds = ['shop', 'reward', 'event', 'challenge', 'limitbreak'];
  const fk1 = funnelKinds[Math.floor(Math.random() * funnelKinds.length)];
  let fk2 = funnelKinds[Math.floor(Math.random() * funnelKinds.length)];
  if (fk2 === fk1) fk2 = funnelKinds[(funnelKinds.indexOf(fk1) + 1) % funnelKinds.length];
  for (let l = 0; l < MAP_LANES; l++) {
    if (l === fp[0]) put(l, MAP_SETS - 1, fk1);
    else if (l === fp[1]) put(l, MAP_SETS - 1, fk2);
    else put(l, MAP_SETS - 1, 'blank');
  }

  // Middle sets (1 .. MAP_SETS-2): two blanks in distinct sets, one level per
  // set, minimums topped up, the rest drawn by weight.
  const midSets = [];
  for (let s = 1; s <= MAP_SETS - 2; s++) midSets.push(s);
  const blankSets = _mapPickN(midSets, MAP_BLANKS);
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
  const needs = [['shop', 2], ['challenge', 2], ['event', 3], ['reward', 1]];
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
  const evPool = (typeof EVENT_META !== 'undefined') ? _mapShuffle(Object.keys(EVENT_META).slice()) : [];
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
  if (count('shop') < 2 || count('challenge') < 2 || count('event') < 3 || count('reward') < 1) return false;
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
function mapLegalMoves() {
  const out = [];
  const consider = (t, after) => {
    if (!t || t.visited || t.kind === 'blank') return;
    // Refuse a move that strands the run (see the DP note above).
    if (t.kind !== 'boss' && !mapCanFinishFrom(after.lane, after.set, after.visits)) {
      out.push({ tile: t, doomed: true });
      return;
    }
    out.push({ tile: t, after });
  };
  if (!mapPos) {
    // Off-map: any solid tile in set 1.
    mapTiles.filter(t => t.set === 0 && t.kind !== 'blank' && !t.visited)
      .forEach(t => consider(t, { lane: t.lane, set: t.span === 2 ? 1 : 0, visits: 1 }));
    return out;
  }
  const { lane, set } = mapPos;
  if (set === MAP_SETS - 1) {           // funnel: only the boss remains
    const boss = mapTiles.find(t => t.kind === 'boss');
    if (boss && !boss.visited) out.push({ tile: boss, after: { lane, set: MAP_BOSS_SET, visits: 1 } });
    return out;
  }
  // Vertical, while the set has room.
  if (mapVisits < 2) {
    for (const dl of [-1, 1]) {
      const t = mapCellTile(lane + dl, set);
      if (t && t.set === set)   // a 2x1 tail cell is set+1's business, not this set's
        consider(t, t.span === 2
          ? { lane: t.lane, set: set + 1, visits: 1 }
          : { lane: t.lane, set, visits: mapVisits + 1 });
    }
  }
  // Forward, always. A 2x1's tail is refused for the same reason the DP
  // refuses it: the head is the tile, and it is behind you.
  const f = mapCellTile(lane, set + 1);
  if (f) {
    if (f.kind === 'boss') out.push({ tile: f, after: { lane, set: MAP_BOSS_SET, visits: 1 } });
    else if (f.set === set + 1) consider(f, f.span === 2
      ? { lane: f.lane, set: set + 2, visits: 1 }
      : { lane: f.lane, set: set + 1, visits: 1 });
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
  if (typeof enterGridScreenHud === 'function') enterGridScreenHud('THE MAP', 'shop');
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

function mapRender(animateIn) {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';
  const legal = mapLegalMoves();
  const legalIds  = new Set(legal.filter(m => !m.doomed).map(m => m.tile.id));
  const doomedIds = new Set(legal.filter(m => m.doomed).map(m => m.tile.id));

  const spanW = (n) => n * (CARD_W + CARD_GAP) - CARD_GAP;
  const spanH = (n) => n * (CARD_H + CARD_GAP) - CARD_GAP;
  const FALL_DUR = 380, BOUNCE = 6, SQUISH = 0.08;

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
    div.innerHTML =
      `<div class="mt-icon">${face.icon}</div>` +
      `<div class="mt-name">${face.name}</div>` +
      (t.visited ? `<div class="mt-stamp">DONE</div>` : '');
    div.onclick = () => mapTileTap(t);
    div.onmouseenter = () => { if (!mapSelected) mapBarInfo(t); };
    gridEl.appendChild(div);
    // Long event names on a card-width tile: shrink, never break mid-word
    // (js/fit-text.js - the same fitter every entity tile uses).
    // Not the boss: its name is vertical in landscape and the fitter measures
    // horizontally, which shrank BOSS to nothing.
    const nm = div.querySelector('.mt-name');
    if (nm && !isBoss && typeof fitEntityName === 'function') fitEntityName(nm, { maxLines: 2, minPx: 4 });

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
function mapRenderBar() {
  let bar = document.getElementById('map-bar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'map-bar'; document.body.appendChild(bar); }
  const setNo = mapPos ? Math.min(mapPos.set + 1, MAP_SETS) : 1;
  const skipNext = MAP_SKIP_BASE + MAP_SKIP_STEP * (mapSkips + 1);
  bar.innerHTML =
    `<div class="mb-top">` +
      `<span class="mb-set">SET ${setNo} / ${MAP_SETS}</span>` +
      `<span class="mb-visits">${mapPos ? `VISITS ${mapVisits}/2` : 'CHOOSE A START'}</span>` +
      `<span class="mb-skip">skip pays ${skipNext} ◆</span>` +
      `<span class="mb-coins">${coins} ◆</span>` +
    `</div>` +
    `<div class="mb-info" id="mb-info">Pick a lit tile. Moving on after one visit pays credits.</div>` +
    `<div class="mb-actions"><button id="mb-confirm" disabled>CONFIRM</button></div>`;
  bar.classList.add('show');
  const btn = document.getElementById('mb-confirm');
  btn.onclick = () => mapConfirm();
  btn.disabled = !mapSelected;
}

function mapBarInfo(t, move) {
  const el = document.getElementById('mb-info');
  if (!el) return;
  const face = mapTileFace(t);
  let s = `<b>${face.name}</b> · ${mapTileDesc(t)}`;
  if (move && !move.doomed) {
    if (mapPos && move.after.set > mapPos.set && mapVisits === 1 && t.kind !== 'boss')
      s += ` <i>Moving on now pays ${MAP_SKIP_BASE + MAP_SKIP_STEP * (mapSkips + 1)} ◆.</i>`;
    if (t.span === 2) s += ` <i>Spans two sets - taking it moves you on.</i>`;
  } else if (t.visited) s += ' <i>Already taken.</i>';
  else if (move && move.doomed) s += ' <i>That path dead-ends before the boss.</i>';
  else if (t.kind !== 'boss') s += ' <i>Not reachable from here.</i>';
  el.innerHTML = s;
}

function mapCloseScreen() {
  mapScreenOpen = false;
  mapSelected = null;
  document.getElementById('map-bar')?.classList.remove('show');
  document.body.classList.remove('map-active');
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
  // position moves; the boss step never pays (the funnel is one visit by design).
  if (mapPos && t.kind !== 'boss' && move.after.set > mapPos.set && mapVisits === 1) {
    mapSkips++;
    const pay = MAP_SKIP_BASE + MAP_SKIP_STEP * mapSkips;
    coins += pay;
    updateCoinsUI?.();
    showMessage(`Moved on early · +${pay} credits`, 'var(--gold)');
  }

  t.visited = true;
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

  let el = document.getElementById('map-knack-pick');
  if (!el) { el = document.createElement('div'); el.id = 'map-knack-pick'; document.body.appendChild(el); }
  el.innerHTML = `<div class="g3-panel"><div class="g3-title">Hard round bonus · take a knack</div><div class="g3-row"></div></div>`;
  const row = el.querySelector('.g3-row');
  offers.forEach(k => {
    const p = { entity: 'knack', icon: k.emoji || '♦', emoji: k.emoji || '♦', label: k.name,
      desc: k.desc, tier: k.rarity || 'common', rarity: k.rarity || 'common' };
    const t = document.createElement('div');
    t.className = 'g3-opt';
    t.innerHTML = (typeof entityTileHTML === 'function') ? entityTileHTML(p)
      : `<div class="reward-cell entity"><div class="rwd-name">${k.name}</div></div>`;
    t.onclick = () => {
      acquiredKnacks.push({ ...k });
      updateKnackList?.();
      showMessage(`+ ${k.name}`, 'var(--gold)');
      el.classList.remove('show');
      done();
    };
    row.appendChild(t);
    const nm = t.querySelector('.rwd-name');
    if (nm && typeof fitRewardName === 'function') fitRewardName(nm);
  });
  el.classList.add('show');
}

// ── Run entry ────────────────────────────────────────────────────────────────
// Called from the very end of startGame. The board for round 1 is already dealt
// and its clock started; freeze both and put the map over it. The first level
// confirm resumes exactly this round (mapStartRound above).
function mapBeginRun() {
  if (typeof _restoringSave !== 'undefined' && _restoringSave) return;  // resume replays its round first
  if (typeof stopTimers === 'function') stopTimers();
  gameTimerPaused = true;
  if (typeof dealAnims !== 'undefined' && dealAnims) { dealAnims.forEach(a => { try { a.cancel(); } catch (e) {} }); dealAnims = []; }
  mapOpen();
}
