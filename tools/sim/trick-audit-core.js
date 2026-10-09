// ── Runs INSIDE the game vm context (loaded after the game, like sim-core.js). ──
// The Trick audit: scores the same hands with every on/off combination of a
// 5-Trick loadout, through the real calcScore, so each Trick's share of the
// score can be split fairly (Shapley values). Driven by tools/sim/trick-audit.js.
//
// Nothing here changes the game. What the sim cannot play out (how far into a
// level a hand lands, what was played before it, how long a scaling Trick has
// been held) is SET from AUD.cfg, and every one of those settings is listed in
// tools/sim/README.md. A Trick whose number rests on one is flagged by the driver.

var AUD = { cfg: null, deck: [], grids: [], stats: null, baseBuff: null, tray: new Set() };

function AUD_rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function AUD_shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}
// Run game code that rolls Math.random (mark placement, Feelin Lucky) on our seed.
function AUD_withSeed(seed, fn) {
  const real = Math.random; Math.random = AUD_rng(seed);
  try { return fn(); } finally { Math.random = real; }
}

const AUD_RUNS = ['Run of 3', 'Run of 4', 'Straight', 'Straight Flush'];
const AUD_SETS = ['Pair', 'Two Pair', 'Three of a Kind', 'Four of a Kind', 'Full House'];
const AUD_PRIMES = ['A', '2', '3', '5', '7'];

// ── Setup ────────────────────────────────────────────────────────────────────
function AUD_init(cfg) {
  AUD.cfg = cfg;
  ACTIVE_MODE = MODES.flow;
  startGame();
  level = cfg.level;
  survivalBossesBeaten = cfg.quarter - 1;          // QRL reads the quarter from this in Flow
  limits.grid_rows.current = cfg.rows; limits.grid_cols.current = cfg.cols;
  limits.selection.current = cfg.maxHand;
  gridRows = cfg.rows; gridCols = cfg.cols;
  bossActive = false;
  gameTimerPaused = false; roundEnded = false; isPaused = false;   // startGame leaves the clock held for the deal
  const seen = new Set(), all = [];
  const add = c => { if (c && c.rank && !c._isSleight && !c._isStone && !seen.has(c._id)) { seen.add(c._id); all.push(c); } };
  gridData.forEach(row => row.forEach(add)); drawPile.forEach(add); playedPile.forEach(add);
  AUD.deck = all;
  // State the sim models as numbers rather than objects.
  // No boss, no suspended entity and no Knacks in the audit, so ownership is a
  // set lookup (calcScore asks ~150 times a hand; the real check is a third of its time).
  hasTrick = id => AUD.tray.has(id);
  hasKnack = () => false;
  // Notices draw on the page and sounds need an AudioContext; the audit has neither.
  showMessage = () => {}; noteMessage = () => {};
  const noop = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : noop), apply: () => noop, construct: () => noop });
  audioCtx = noop; window.AudioContext = function () { return noop; };
  ownedSleightCount = () => cfg.sleightsOwned;
  sleightChargeInfo = () => ({ total: 3, missing: cfg.sleightChargesMissing });
  // Base buffs a mid-run deck carries (fixed for the whole audit).
  const rnd = AUD_rng(cfg.seed ^ 0xB0FF);
  const ids = AUD_shuffle(AUD.deck.filter(c => !isWildCard(c)).map(c => cardId(c)), rnd);
  AUD.baseBuff = { pips: {}, mult: {}, retrig: {} };
  ids.slice(0, cfg.baseBuffPips).forEach(k => { AUD.baseBuff.pips[k] = cfg.baseBuffPipsAmt; });
  ids.slice(cfg.baseBuffPips, cfg.baseBuffPips + cfg.baseBuffMult).forEach(k => { AUD.baseBuff.mult[k] = cfg.baseBuffMultAmt; });
  return { deck: all.length, pool: TRICK_POOL.length };
}

// ── Boards and hands ────────────────────────────────────────────────────────
function AUD_place(cards) {
  const R = AUD.cfg.rows, C = AUD.cfg.cols;
  gridData = [];
  for (let r = 0; r < R; r++) { const row = []; for (let c = 0; c < C; c++) row.push(cards[r * C + c]); gridData.push(row); }
}

// Every connected selection of 2..maxHand cells that is a real hand with every
// card load-bearing (no kicker), High Card excluded.
function AUD_enumHands() {
  const R = gridRows, C = gridCols, N = R * C, maxN = AUD.cfg.maxHand;
  const nb = [];
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / C), c = i % C, o = [];
    if (r > 0) o.push(i - C); if (r < R - 1) o.push(i + C); if (c > 0) o.push(i - 1); if (c < C - 1) o.push(i + 1);
    nb.push(o);
  }
  const seen = new Set(), out = [];
  let frontier = [];
  for (let i = 0; i < N; i++) frontier.push(1 << i);
  for (let size = 2; size <= maxN; size++) {
    const next = [];
    for (const m of frontier) {
      for (let i = 0; i < N; i++) {
        if (!(m & (1 << i))) continue;
        for (const j of nb[i]) {
          if (m & (1 << j)) continue;
          const nm = m | (1 << j);
          if (seen.has(nm)) continue;
          seen.add(nm); next.push(nm);
        }
      }
    }
    for (const m of next) {
      const cells = [];
      for (let i = 0; i < N; i++) if (m & (1 << i)) cells.push([Math.floor(i / C), i % C]);
      if (cells.some(([r, c]) => !gridData[r][c])) continue;
      let comps = null;
      try { comps = handComponentsFor(cells); } catch (e) { comps = null; }
      if (!comps || !comps.playable) continue;
      const claimed = new Set();
      comps.components.forEach(k => k.cells.forEach(([r, c]) => claimed.add(r * 100 + c)));
      if (claimed.size < cells.length) continue;
      const name = comps.primary;
      if (!name || name === 'High Card' || !HAND_BASE[name]) continue;
      out.push(AUD_handInfo(cells, name, m));
    }
    frontier = next;
  }
  return out;
}
// A run is tapped in rank order when the board allows it (each tap touching the
// selection so far): that is what Rogue Wave's "correct sequential order" reads.
function AUD_orderRun(cells) {
  const val = (cell, hi) => { const v = rankRunVals(gridData[cell[0]][cell[1]].rank); return hi ? Math.max(...v) : Math.min(...v); };
  const touches = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  for (const hi of [false, true]) for (const dir of [1, -1]) {
    const o = cells.slice().sort((a, b) => dir * (val(a, hi) - val(b, hi)));
    if (!o.every((cell, i) => i === 0 || o.slice(0, i).some(p => touches(p, cell)))) continue;
    try { if (canBeOrderedRun(o)) return o; } catch (e) {}
  }
  return cells;
}
function AUD_handInfo(cells, name, mask) {
  if (AUD_RUNS.includes(name)) cells = AUD_orderRun(cells);
  const cards = cells.map(([r, c]) => gridData[r][c]);
  const nat = cards.filter(c => !isWildCard(c));
  const cnt = (f) => nat.reduce((n, c) => n + (f(c) ? 1 : 0), 0);
  return {
    cells, name, mask, n: cells.length,
    isRun: AUD_RUNS.includes(name), isSet: AUD_SETS.includes(name), isFlush: name === 'Flush',
    real5: realHandOfSize(cells, 5), real4: cells.length === 4,
    clubs: nat.reduce((n, c) => n + (c.suit === '♣') + (c.suit2 === '♣'), 0),
    spades: nat.reduce((n, c) => n + (c.suit === '♠') + (c.suit2 === '♠'), 0),
    nines: cnt(c => c.rank === '9'), fives: cnt(c => c.rank === '5'),
    ace: nat.some(c => c.rank === 'A'), prime: nat.some(c => AUD_PRIMES.includes(c.rank)),
    pipSum: cards.reduce((s, c) => s + cardPips(c.rank), 0),
  };
}

// Build the shared boards: the SAME boards, hands and round states for every
// loadout (common random numbers), so two loadouts differ only in their Tricks.
function AUD_buildGrids() {
  const cfg = AUD.cfg;
  AUD.grids = [];
  for (let g = 0; g < cfg.grids; g++) {
    const rnd = AUD_rng(cfg.seed * 1000003 + g * 7919 + 17);
    const cards = AUD_shuffle(AUD.deck.slice(), rnd).slice(0, cfg.rows * cfg.cols);
    AUD_place(cards);
    const hands = AUD_enumHands();
    const bySize = {};
    hands.forEach((h, i) => { (bySize[h.n] = bySize[h.n] || []).push(i); });
    const sizes = Object.keys(bySize).map(Number).sort((a, b) => a - b);
    const pickAny = () => { const s = sizes[Math.floor(rnd() * sizes.length)]; const l = bySize[s]; return l[Math.floor(rnd() * l.length)]; };
    const any = [], ctx = [];
    for (let i = 0; i < cfg.handsPerGrid; i++) { any.push(pickAny()); ctx.push(AUD_makeCtx(rnd, pickAny)); }
    const djCells = AUD_shuffle([...Array(cfg.rows * cfg.cols).keys()], rnd).slice(0, 2).map(i => [Math.floor(i / cfg.cols), i % cfg.cols]);
    const wpCell = [Math.floor(rnd() * cfg.rows), Math.floor(rnd() * cfg.cols)];
    AUD.grids.push({ cards, hands, any, ctx, djCells, wpCell, sizes: Object.fromEntries(sizes.map(s => [s, bySize[s].length])) });
  }
  AUD_poolStats();
  return AUD.grids.map(g => g.hands.length);
}

// One hand's round state. How far into the level it lands, what was played
// before it, how the clock and Focus stand.
function AUD_makeCtx(rnd, pickAny) {
  const cfg = AUD.cfg;
  const j = Math.floor(rnd() * cfg.handsPerLevel);
  const S0 = cfg.levelStartMin + rnd() * (cfg.sessionSeconds - cfg.levelStartMin);
  const gap = () => cfg.minGap + -Math.log(1 - rnd()) * (cfg.handSeconds - cfg.minGap);
  const prev = [], times = [];
  let t = 0;
  for (let k = 0; k < j; k++) { t += gap(); times.push(t); prev.push(pickAny()); }
  const curGap = gap(); t += curGap;
  const last = j > 0 ? prev[j - 1] : pickAny();
  const before = [pickAny(), pickAny()];        // the two hands before `last`, for streaks that cross levels
  const swapsAt = [], discards = [];
  for (let k = 0; k < j; k++) { if (rnd() < cfg.swapChance) swapsAt.push(k); if (rnd() < cfg.discardChance) discards.push(k); }
  const marks10 = [];
  for (let k = 0; k < 8; k++) marks10.push(rnd() < 0.5 ? 'mult' : 'pips');
  return {
    j, S0, times, prev, last, before, curGap, elapsed: t,
    clock: Math.max(1, S0 - t), prevClock: Math.max(1, S0 - (j > 0 ? times[j - 1] : 0)),
    swapsAt, discards,
    focus: AUD_focusDraw(j, rnd),
    coins: Math.floor(rnd() * (cfg.coinsMax + 1)),
    marks10, u: rnd(),
  };
}

// Focus at the moment a hand scores. From the Focus pass's no-Trick baseline by
// hand position in the level (cfg.focusDist), else flat over Flow's 0..20.
function AUD_focusDraw(j, rnd) {
  const cfg = AUD.cfg, d = cfg.focusDist && cfg.focusDist[j];
  if (!d) return Math.floor(rnd() * (cfg.focusNodesMax + 1));
  let tot = 0; for (const k in d) tot += d[k];
  let u = rnd() * tot;
  for (const k in d) { u -= d[k]; if (u <= 0) return +k; }
  return 0;
}

// Averages over every board's "any hand" picks: what a held-for-a-while
// scaling Trick has collected (9s scored, spades scored, Focus made...).
function AUD_poolStats() {
  let n = 0; const s = { cards: 0, nines: 0, fives: 0, spades: 0, clubs: 0, four: 0, quad: 0, center: 0, focus: 0, run: 0, five: 0 };
  const mid = [Math.floor(AUD.cfg.rows / 2), Math.floor(AUD.cfg.cols / 2)];
  AUD.grids.forEach(g => g.any.forEach(i => {
    const h = g.hands[i]; n++;
    s.cards += h.n; s.nines += h.nines; s.fives += h.fives; s.spades += h.spades; s.clubs += h.clubs;
    s.four += h.n === 4 ? 1 : 0; s.quad += h.name === 'Four of a Kind' ? 1 : 0; s.run += h.isRun ? 1 : 0; s.five += h.real5 ? 1 : 0;
    s.center += h.cells.some(([r, c]) => r === mid[0] && c === mid[1]) ? 1 : 0;
    s.focus += (HAND_FOCUS[h.name] || 0);
  }));
  Object.keys(s).forEach(k => { s[k] /= Math.max(1, n); });
  AUD.stats = s;
  return s;
}

// ── A loadout ────────────────────────────────────────────────────────────────
// Fresh Trick objects, their marked lines, their rolled ranks, and the card
// buffs a scaling Trick would have handed out over the hold period.
function AUD_makeLoadout(ids, seed) {
  const cfg = AUD.cfg;
  const tricks = ids.map(id => Object.assign({}, TRICK_POOL_ALL.find(t => t.id === id)));
  trickTray = tricks.slice();
  AUD.tray = new Set(ids);
  acquiredTricks = tricks.slice();
  rowColBonuses = [];
  positionAxisNext = 'row';
  AUD_withSeed(seed, () => {
    resetPositionMarks();
    tricks.forEach(t => { try { assignPositionMark(t); } catch (e) {} });
    tricks.forEach(t => { if (t.id === 'feelin_lucky' && !t._luckyRanks) feelinLuckyRoll(t); });
  });
  const marks = rowColBonuses.map(b => Object.assign({}, b, { k: ids.indexOf(b.id) })).filter(b => b.k >= 0);
  const rnd = AUD_rng(seed ^ 0x5CA1E);
  const deckIds = AUD.deck.filter(c => !isWildCard(c)).map(c => cardId(c));
  const pick = () => deckIds[Math.floor(rnd() * deckIds.length)];
  const H = cfg.holdHands, lv = H / cfg.handsPerLevel, st = AUD.stats;
  const pois = (mu) => { let L = Math.exp(-mu), k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };
  const overlays = tricks.map(t => {
    const o = { pips: {}, mult: {}, retrig: {} };
    const addP = (k, v) => { o.pips[k] = (o.pips[k] || 0) + v; };
    const addM = (k, v) => { o.mult[k] = (o.mult[k] || 0) + v; };
    switch (t.id) {
      case 'sapling':      for (let i = 0; i < Math.round(3 * lv); i++) addP(pick(), 5); break;
      case 'first_fruits': for (let i = 0; i < Math.round(lv * st.cards); i++) addP(pick(), BAL.first_fruits.pips); break;
      case 'rare_bloom':   for (let q = pois(H * st.quad); q > 0; q--) for (let i = 0; i < 4; i++) addP(pick(), BAL.rare_bloom.perm_pips); break;
      case 'fours_perm':   for (let i = 0; i < Math.round(H * st.four); i++) addP(pick(), BAL.fours_perm.pips); break;
      case 'sixes_perm':   for (let i = 0; i < Math.round(H * st.cards / BAL.sixes_perm.interval); i++) addP(pick(), 1 + Math.floor(rnd() * 6)); break;
      case 'heartwood':    for (let i = 0; i < Math.round(H * st.center); i++) { const k = pick(); addP(k, BAL.heartwood.pips); addM(k, BAL.heartwood.mult); } break;
      case 'hourglass':    for (let i = 0; i < Math.round(H * cfg.handSeconds / 60 * BAL.hourglass.chance); i++) { const k = pick(); o.retrig[k] = (o.retrig[k] || 0) + 1; } break;
      case 'rowcol_perm_double': for (let i = 0; i < Math.round(H * st.cards / (cfg.rows * cfg.cols)); i++) addM(pick(), BAL.rowcol_perm_double.perm_mult); break;
    }
    return o;
  });
  const L = { ids, tricks, marks, overlays, maps: {}, pause: {}, seed };
  return L;
}

// Board-wide card buffs for one on/off combination: the deck's own buffs plus
// those handed out by the Tricks that are on. Ley Line only pays where a row
// effect and a column effect cross, so it needs a marked row AND column on.
function AUD_maps(L, mask) {
  if (L.maps[mask]) return L.maps[mask];
  const pips = Object.assign({}, AUD.baseBuff.pips), mult = Object.assign({}, AUD.baseBuff.mult), retrig = {};
  const rowOn = L.marks.some(b => (mask & (1 << b.k)) && b.axis === 'row');
  const colOn = L.marks.some(b => (mask & (1 << b.k)) && b.axis === 'col');
  L.overlays.forEach((o, k) => {
    if (!(mask & (1 << k))) return;
    if (L.ids[k] === 'rowcol_perm_double' && !(rowOn && colOn)) return;
    for (const id in o.pips) pips[id] = (pips[id] || 0) + o.pips[id];
    for (const id in o.mult) mult[id] = (mult[id] || 0) + o.mult[id];
    for (const id in o.retrig) retrig[id] = (retrig[id] || 0) + o.retrig[id];
  });
  return (L.maps[mask] = { pips, mult, retrig });
}

// Pause and rewind seconds a hand produces, from the pause Tricks that are on.
// A simplified copy of the per-hand sources in play-hand.js (Cuckoo and the
// card time buffs are left out).
function AUD_handPause(L, mask, h, runsSoFar, k, onLine) {
  const on = id => { const i = L.ids.indexOf(id); return i >= 0 && (mask & (1 << i)); };
  let p = 0, rw = 0;
  if (h.isRun && on('dam_holding')) p += BAL.dam_holding.pause;
  if (h.isRun && on('high_water')) p += BAL.high_water.pause_per_run * (runsSoFar + 1);
  if (h.real5 && on('five_second')) p += BAL.five_second.pause_seconds;
  if (h.real4 && on('four_horseman') && ((k + h.cells[0][0] * 3 + h.cells[0][1] * 5) % 4) === 3) p += BAL.four_horseman.pause;
  if (on('right_time')) p += BAL.right_time.pause_seconds * onLine('right_time', h);
  if (h.isFlush && on('deluge')) rw += BAL.deluge.seconds;
  if (on('ninesong') && h.pipSum % 3 === 0 && ((Math.imul(h.mask, 2654435761) >>> 0) % 3) === 0) rw += BAL.ninesong.seconds;
  if (on('magpie')) rw += Math.floor(AUD.cfg.stockHeld / BAL.magpie.actions_per_second);
  if (on('overtime')) rw += Math.floor(onLine('overtime', h) / 3) * BAL.overtime.seconds_per_3;
  return [p, rw];
}

// ── Apply one on/off combination and one round state, then score ───────────
function AUD_apply(L, mask, g, h, ctx) {
  const cfg = AUD.cfg;
  const on = id => { const i = L.ids.indexOf(id); return i >= 0 && !!(mask & (1 << i)); };
  trickTray = L.tricks.filter((t, k) => mask & (1 << k));
  AUD.tray = new Set(trickTray.map(t => t.id));
  trickTray.forEach(t => { t._primed = 0; t._primeSrc = []; });
  rowColBonuses = L.marks.filter(b => mask & (1 << b.k));
  const mp = AUD_maps(L, mask);
  permPips = mp.pips; permMult = mp.mult; permRetrig = mp.retrig;
  // Mirror aims at a neighbour that is on (right first).
  trickTray.forEach((t, i) => { if (t.id === 'mirror') t._tiltDir = (trickTray[i + 1] && trickTray[i + 1].id !== 'mirror') ? 1 : -1; });
  const prevH = ctx.prev.map(i => g.hands[i]);
  const lastH = g.hands[ctx.last];
  // Primes from the previous hand: Inspirato (an Ace scored) and Prime Times (a prime rank scored).
  if (on('wild_heart') && lastH.ace && trickTray.length) {
    trickTray[0]._primed++; const e = trickTray[trickTray.length - 1]; if (e !== trickTray[0]) e._primed++;
  }
  if (on('prime_times') && lastH.prime) { const t = trickTray.find(x => x.id !== 'prime_times'); if (t) t._primed++; }
  // The level so far.
  level = cfg.level;
  roundStartSeconds = ctx.S0; roundSeconds = ctx.clock;
  handsPlayedRound = ctx.j; handsPlayedGame = cfg.holdHands;
  runsPlayedRound = prevH.filter(x => x.isRun).length;
  setsPlayedRound = prevH.filter(x => x.isSet).length;
  handTypesRound = new Set(prevH.map(x => x.name));
  clubsScoredRound = prevH.reduce((n, x) => n + x.clubs, 0);
  // Streaks run back from the last hand (through the hands before it).
  const chain = [lastH, ...(ctx.j > 1 ? prevH.slice(0, -1).reverse() : []), ...ctx.before.map(i => g.hands[i])];
  lastHandType = lastH.name; streakCount = 1;
  for (let k = 1; k < chain.length && chain[k].name === lastH.name; k++) streakCount++;
  runStreak = 0; for (let k = 0; k < chain.length && chain[k].isRun; k++) runStreak++;
  coins = ctx.coins; focusNodes = ctx.focus;
  swapsUsedRound = ctx.swapsAt.length; discardsUsedRound = ctx.discards.length;
  cardsDiscardedRound = ctx.discards.length * cfg.cardsPerDiscard;
  lastSwapRoundSeconds = ctx.swapsAt.length ? Math.max(1, ctx.S0 - ctx.times[ctx.swapsAt[ctx.swapsAt.length - 1]]) : null;
  lastHandRoundSeconds = ctx.j > 0 ? ctx.prevClock : null;
  // Held-for-a-while scaling Tricks (cfg.holdHands hands).
  const H = cfg.holdHands, st = AUD.stats;
  bonusMult_compound = Math.round(H * BAL.compound_mult.mult_per_hand * 10) / 10;
  bonusMult_nines = BAL.nines_mult.mult_per_nine * Math.min(AUD.deck.filter(c => c.rank === '9').length, Math.round(H * st.nines));   // each 9 is forgotten once scored
  bonusMult_tens = BAL.tens_mult.mult_per_milestone * Math.floor(H * cfg.discardChance * cfg.cardsPerDiscard / BAL.tens_mult.discards_per_milestone);
  bonusMult_fives = BAL.fives_discard.pips_per_five * Math.round(H * (st.fives + cfg.discardChance * cfg.cardsPerDiscard * 4 / 52));
  focusGenGame = Math.round((cfg.level - 1) * cfg.handsPerLevel * cfg.focusPerHand);   // Wellspring counts the whole run
  spadesRelentless = Math.round(H * st.spades);
  negativeTilesTakenRun = 0;                      // Flow opens no reward grid
  // Marked lines this level.
  const lineOf = id => rowColBonuses.filter(b => b.id === id);
  const onLine = (id, x) => { const ls = lineOf(id); return x.cells.filter(([r, c]) => ls.some(b => (b.axis === 'row' ? b.index === r : b.index === c))).length; };
  assemblyMarkCount = on('assembly_line') ? prevH.reduce((n, x) => n + onLine('assembly_line', x), 0) : 0;
  const anyLine = x => x.cells.some(([r, c]) => rowColBonuses.some(b => (b.axis === 'row' ? b.index === r : b.index === c)));
  if (on('feng_shui')) {
    const key = 'fs' + mask;
    if (L.pause[key] === undefined) { let n = 0, t = 0; AUD.grids.slice(0, 20).forEach(gg => gg.any.forEach(i => { t++; if (anyLine(gg.hands[i])) n++; })); L.pause[key] = n / Math.max(1, t); }
    bonusPips_fengshui = BAL.feng_shui.pips_per_hand * Math.round(H * L.pause[key]);
  } else bonusPips_fengshui = 0;
  // Clock marks passed since the last hand (between prevClock and clock).
  const marks = step => { let n = 0; for (let s = Math.ceil(ctx.clock); s < ctx.prevClock; s++) if (s > 0 && s % step === 0) n++; return n; };
  pendingHandPips = on('quarter_chime') ? BAL.quarter_chime.pips * marks(15) : 0;
  pendingHandMult = 0; pendingCardPips = 0;
  if (on('second_hand')) { const m = marks(10); for (let k = 0; k < m; k++) { if (ctx.marks10[k % 8] === 'mult') pendingHandMult += BAL.second_hand.mult; else pendingCardPips += BAL.second_hand.pips; } }
  minuteHandCharges = on('minute_hand') && marks(BAL.minute_hand.interval_seconds) > 0 ? 1 : 0;
  woodpeckerCardId = on('woodpecker') ? cardId(gridData[g.wpCell[0]][g.wpCell[1]]) : null;
  doubleJeopardyCells = on('double_jeopardy') ? g.djCells.map(([r, c]) => ({ r, c })) : [];
  // Pauses and rewinds this level, from the pause Tricks that are on.
  let pLeft = 0, pSec = 0, pN = 0, rN = 0, rSec = 0, runs = 0;
  for (let k = 0; k < ctx.j; k++) {
    const x = prevH[k];
    const [p, rw] = AUD_handPause(L, mask, x, runs, k, onLine);
    if (x.isRun) runs++;
    if (p > 0) { pN++; pLeft += p; }
    if (rw > 0) { rN++; rSec += rw; }
    const gapNext = (k + 1 < ctx.j ? ctx.times[k + 1] - ctx.times[k] : ctx.curGap);
    const used = Math.min(pLeft, gapNext); pSec += used; pLeft -= used;
  }
  pipeTimerPaused = pLeft > 0; pauseSecondsLeft = pLeft;
  pausesThisRound = pN; rewindsThisRound = rN; pausedSecondsRound = Math.round(pSec); rewoundSecondsRound = rSec;
  const rk = 'r' + mask;
  if (L.pause[rk] === undefined) {
    let tp = 0, tr = 0, t = 0;
    AUD.grids.slice(0, 20).forEach(gg => gg.any.forEach(i => { const [p, rw] = AUD_handPause(L, mask, gg.hands[i], 0, t, onLine); t++; if (p > 0) tp++; if (rw > 0) tr++; }));
    L.pause[rk] = [tp / Math.max(1, t), tr / Math.max(1, t)];
  }
  pauseInstanceGame = Math.round(H * L.pause[rk][0]); rewindInstanceGame = Math.round(H * L.pause[rk][1]);
  // Nothing else on: no boss, no Sleight effects armed, no forced fires.
  forcedTrickIds = []; siphonMultX = 1; sleightLegacyMult = false; sleightNextHandDouble = false;
  sleightAmplifierMult = 0; spotCheckHand = null;
}

function AUD_score(L, mask, g, h, ctx) {
  AUD_apply(L, mask, g, h, ctx);
  const calc = () => { try { return [calcScore(h.name, h.cells), lastCalcPips, lastCalcMult]; } catch (e) { AUD.lastErr = String(e && e.stack || e).slice(0, 300); return [NaN, 0, 0]; } };
  // Mirror is tilted at whichever neighbour pays more this hand, as a player would.
  const mi = trickTray.findIndex(t => t.id === 'mirror');
  if (mi >= 0) {
    const dirs = [1, -1].filter(d => trickTray[mi + d] && trickTray[mi + d].id !== 'mirror');
    let best = null;
    for (const d of dirs) { trickTray[mi]._tiltDir = d; const r = calc(); if (!best || r[0] > best[0]) best = r; }
    if (best) return best;
  }
  return calc();
}

// ── Shapley values over the 2^n on/off combinations ─────────────────────────
function AUD_fact(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
function AUD_popcount(m) { let c = 0; while (m) { c += m & 1; m >>>= 1; } return c; }
function AUD_shapley(v, n) {
  const w = []; for (let s = 0; s < n; s++) w.push(AUD_fact(s) * AUD_fact(n - s - 1) / AUD_fact(n));
  const phi = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const b = 1 << i;
    for (let m = 0; m < (1 << n); m++) { if (m & b) continue; phi[i] += w[AUD_popcount(m)] * (v[m | b] - v[m]); }
  }
  return phi;
}

// One loadout: the "any hand" set (the same hands for every loadout) and the
// "planned" set (on each board, the hand this loadout scores best, scored in
// each of the board's round states). Returns per-Trick sums for the driver.
function AUD_runLoadout(ids, seed) {
  const L = AUD_makeLoadout(ids, seed);
  const n = ids.length, full = (1 << n) - 1;
  const mk = () => ({ hands: 0, pts: new Array(n).fill(0), pts2: new Array(n).fill(0), pips: new Array(n).fill(0), mult: new Array(n).fill(0),
    log: new Array(n).fill(0), solo: new Array(n).fill(0), last: new Array(n).fill(0), fired: new Array(n).fill(0), max: new Array(n).fill(0),
    vL: 0, v0: 0, lvL: 0, lv0: 0, types: {} });
  const out = { ids, any: mk(), planned: mk(), err: null };
  const tally = (acc, g, h, ctx) => {
    const v = [], p = [], m = [], lv = [];
    for (let k = 0; k <= full; k++) { const r = AUD_score(L, k, g, h, ctx); v.push(r[0]); p.push(r[1]); m.push(r[2]); lv.push(Math.log(Math.max(1, r[0]))); }
    if (v.some(x => !isFinite(x))) { out.err = AUD.lastErr || 'non-finite score'; return; }
    const fv = AUD_shapley(v, n), fp = AUD_shapley(p, n), fm = AUD_shapley(m, n), fl = AUD_shapley(lv, n);
    acc.hands++; acc.vL += v[full]; acc.v0 += v[0]; acc.lvL += lv[full]; acc.lv0 += lv[0];
    acc.types[h.name] = (acc.types[h.name] || 0) + 1;
    for (let i = 0; i < n; i++) {
      acc.pts[i] += fv[i]; acc.pts2[i] += fv[i] * fv[i]; acc.pips[i] += fp[i]; acc.mult[i] += fm[i]; acc.log[i] += fl[i];
      acc.solo[i] += v[1 << i] - v[0]; acc.last[i] += v[full] - v[full & ~(1 << i)];
      if (Math.abs(fv[i]) > 1e-6) acc.fired[i]++;
      if (fv[i] > acc.max[i]) acc.max[i] = fv[i];
    }
  };
  for (let gi = 0; gi < AUD.grids.length; gi++) {
    const g = AUD.grids[gi];
    AUD_place(g.cards);
    for (let i = 0; i < g.any.length; i++) tally(out.any, g, g.hands[g.any[i]], g.ctx[i]);
    // Planned: the best hand on this board for the whole loadout, picked in the board's first round state.
    let best = -1, bestS = -Infinity;
    for (let hi = 0; hi < g.hands.length; hi++) { const s = AUD_score(L, full, g, g.hands[hi], g.ctx[0])[0]; if (s > bestS) { bestS = s; best = hi; } }
    if (best >= 0) for (let i = 0; i < g.ctx.length; i++) tally(out.planned, g, g.hands[best], g.ctx[i]);
  }
  return out;
}

// ── Focus over whole levels (every Trick, for its Focus side) ────────────────
// Plays cfg.focusLevels levels of cfg.handsPerLevel hands, cfg.focusRuns times,
// through the real generateHandFocus / addFocus / onFocusMaxed / focusDecayTick,
// with one Trick held (or none), on the same seeded hands and gaps for every
// Trick. Returns the Focus multiplier each hand was scored at, by hand position.
function AUD_focusTrick(id) {
  const cfg = AUD.cfg, seed = cfg.seed * 7717 + 1;
  AUD.lastErr = null;
  const L = id ? AUD_makeLoadout([id], 99) : AUD_makeLoadout([], 99);
  trickTray = L.tricks.slice(); acquiredTricks = L.tricks.slice(); AUD.tray = new Set(L.ids);
  rowColBonuses = L.marks.slice();
  const realST = setTimeout, realNow = Date.now, deferred = [];
  setTimeout = (fn, ms) => { if (ms === 260) deferred.push(fn); return 0; };
  let fake = 1e12; Date.now = () => fake;
  const H = cfg.handsPerLevel, byJ = Array.from({ length: H }, () => ({ n: 0, mult: 0, nodes: 0 }));
  const nodesHist = Array.from({ length: H }, () => ({}));
  let gen = 0, hands = 0, capSum = 0, maxed = 0;
  try {
    for (let run = 0; run < cfg.focusRuns; run++) {
      const rnd = AUD_rng(seed + run * 104729);
      focusCapGains = {}; focusCapPerm = 0; focusCapBase = flowFocusCapBase();
      studyHallCards = 0; bonusFocus_acorns = 0; _ddPairTimes = []; focusGenGame = 0; _cleanSweepPrev = [];
      handsPlayedGame = (cfg.level - 1) * H;
      recomputeFocusDecayInterval();
      let lastName = null, streak = 0;
      for (let lv = 0; lv < cfg.focusLevels; lv++) {
        // triggerLevelUp: Life Lessons, the meter reset, Tunnel Vision.
        if (lv > 0 && hasTrick('life_lessons')) focusCapPerm += BAL.life_lessons.cap_gain;
        focusNodes = 0; focusDecayBuffer = 0; focusAnimRunning = false; focusAnimQueue = [];
        handsPlayedRound = 0; runsPlayedRound = 0; markCount_groove = 0; markCount_overtime = 0; _cleanSweepPrev = [];
        pipeTimerPaused = false; pauseSecondsLeft = 0; pausedSecondsRound = 0; pausesThisRound = 0;
        doubleJeopardyCells = []; swaps = 2; discards = 2;
        if (hasTrick('tunnel_vision')) addFocus(5);
        let clock = cfg.levelStartMin + rnd() * (cfg.sessionSeconds - cfg.levelStartMin);
        for (let k = 0; k < H; k++) {
          const gap = cfg.minGap + -Math.log(1 - rnd()) * (cfg.handSeconds - cfg.minGap);
          const pausedPart = Math.min(pauseSecondsLeft, gap);
          pauseSecondsLeft -= pausedPart; pausedSecondsRound += Math.round(pausedPart);
          if (pauseSecondsLeft <= 0) { pauseSecondsLeft = 0; pipeTimerPaused = false; }
          const running = gap - pausedPart;
          const ticks = Math.floor(running * 1000 / focusDecayIntervalMs);
          for (let t = 0; t < ticks; t++) { focusAnimRunning = false; focusDecayTick(); }
          const newClock = clock - running;
          for (let s = Math.ceil(newClock); s <= Math.floor(clock); s++) if (s > 0 && s % 10 === 0 && hasTrick('ticktock')) addFocus(BAL.ticktock.focus);
          clock = newClock;
          if (rnd() < cfg.swapChance + cfg.discardChance) cullPay();
          const g = AUD.grids[Math.floor(rnd() * AUD.grids.length)];
          AUD_place(g.cards);
          const h = g.hands[g.any[Math.floor(rnd() * g.any.length)]];
          fake += gap * 1000;
          // The time since your last hand runs on through the reward screens, so a
          // level's first hand earns no speed bonus.
          if (k === 0) lastHandTime = fake - (gap + cfg.levelUpSeconds) * 1000;
          lastHandType = lastName; streakCount = streak;
          _lastRetrigByCell = {}; _lastHandRetrigs = 0;
          const g0 = focusGenGame;
          focusAnimRunning = false;
          try { generateHandFocus(h.name, h.cells, 0); } catch (e) { AUD.lastErr = String(e && e.stack || e).slice(0, 300); }
          focusAnimRunning = false; focusAnimQueue = [];
          while (deferred.length) { try { deferred.shift()(); } catch (e) {} }
          focusAnimRunning = false;
          gen += focusGenGame - g0; hands++;
          const fm = focusMultiplier();
          byJ[k].n++; byJ[k].mult += fm; byJ[k].nodes += focusNodes;
          nodesHist[k][focusNodes] = (nodesHist[k][focusNodes] || 0) + 1;
          capSum += focusCapNodes(); if (focusNodes >= focusCapNodes()) maxed++;
          // After the hand (playHand / scalingCount).
          lastHandTime = fake;
          handsPlayedRound++; handsPlayedGame++; if (h.isRun) runsPlayedRound++;
          if (hasTrick('acorns')) bonusFocus_acorns += h.n * BAL.acorns.focus_per_card;
          streak = (h.name === lastName) ? streak + 1 : 1; lastName = h.name;
        }
      }
    }
  } finally { setTimeout = realST; Date.now = realNow; }
  return { id, hands, gen: gen / hands, cap: capSum / hands, maxed: maxed / hands,
    mult: byJ.reduce((a, b) => a + b.mult, 0) / hands,
    byJ: byJ.map(b => ({ mult: b.mult / b.n, nodes: b.nodes / b.n })), nodesHist, err: AUD.lastErr || null };
}

// ── Seconds, credits and stock per hand (time and economy Tricks) ────────────
// The pause / rewind rules from AUD_handPause on the "any" hands, plus the
// per-Trick rules the hand loop does not see (card time buffs, Double
// Jeopardy's cells, Rain Check, the credit and stock Tricks). Seconds are
// counted whether they pause or rewind: both are time the session clock keeps.
function AUD_timeTrick(id) {
  const cfg = AUD.cfg, st = AUD.stats;
  const L = id ? AUD_makeLoadout([id], 99) : AUD_makeLoadout([], 99);
  rowColBonuses = L.marks.slice(); trickTray = L.tricks.slice(); AUD.tray = new Set(L.ids);
  const onLine = (tid, x) => { const ls = L.marks.filter(b => b.id === tid); return x.cells.filter(([r, c]) => ls.some(b => (b.axis === 'row' ? b.index === r : b.index === c))).length; };
  let n = 0, pause = 0, rewind = 0, credits = 0, swapsG = 0, discardsG = 0, fires = 0;
  AUD.grids.forEach(g => g.any.forEach((hi, s) => {
    const h = g.hands[hi], ctx = g.ctx[s];
    const runsSoFar = ctx.prev.filter(i => g.hands[i].isRun).length;
    const [p, rw] = id ? AUD_handPause(L, 1, h, runsSoFar, ctx.j, onLine) : [0, 0];
    n++; pause += p; rewind += rw; if (p > 0 || rw > 0) fires++;
    const lastH = g.hands[ctx.last];
    const cards = h.cells.map(([r, c]) => g.cards[r * cfg.cols + c]);
    const face = cards.some(c => ['J', 'Q', 'K'].includes(c.rank));
    switch (id) {
      case 'monochrome': if (cards.every(c => c.suit === '♥' || c.suit === '♦')) { credits += BAL.monochrome.coins; rewind -= BAL.monochrome.seconds; fires++; } break;
      case 'undue_influence': if (h.isSet && face) { credits += ctx.prev.filter(i => g.hands[i].isSet).length + 1; fires++; } break;
      case 'mockingbird': if (lastH.name !== h.name) swapsG += 1 / 4; break;
      case 'starling': if (lastH.name === h.name) discardsG += 1 / 2; break;
      case 'five_fodder': credits += BAL.five_fodder.credits * cfg.discardChance * st.five; break;
    }
  }));
  const per = x => x / Math.max(1, n);
  const out = { id, hands: n, pause: per(pause), rewind: per(rewind), credits: per(credits), swaps: per(swapsG), discards: per(discardsG), fire: per(fires) };
  const H = cfg.handsPerLevel;
  switch (id) {
    // Each level: 2 secret cells pay 15s the first time a hand scores from them.
    case 'double_jeopardy': { const pCell = st.cards / (cfg.rows * cfg.cols); const hit = 1 - Math.pow(1 - pCell, H);
      out.pause = BAL.double_jeopardy.cells * hit * BAL.double_jeopardy.pause_seconds / H; out.fire = BAL.double_jeopardy.cells * hit / H; break; }
    // 4-card hands buff their 4th card +2s pause; after holdHands hands that many
    // deck cards carry it, and each one scored pauses (buffs do not stack).
    case 'wait_four_it': { const buffed = Math.min(AUD.deck.length, cfg.holdHands * st.four); const per = st.cards * buffed / AUD.deck.length;
      out.pause = per * BAL.wait_four_it.pause; out.fire = Math.min(1, per); break; }
    // A skipped pick adds 30s (Flow: to the timer). One skip a level, at the cost of that reward.
    case 'rain_check': out.rewind = BAL.rain_check.seconds / H; out.fire = 1 / H; out.note = 'costs one reward a level'; break;
    // Intersection cards gain +3s rewind; needs a marked row AND column from other Tricks.
    case 'temporal_rift': out.note = 'needs a marked row and column from other Tricks'; break;
    case 'vulture': out.note = 'needs a pause source; buffs cards discarded during the first pause'; break;
    case 'cuckoo': out.note = 'needs replay sources'; break;
    case 'clean_sweep': out.note = 'two hands covering a whole row or column'; break;
    case 'buried_treasure': out.note = 'scales your credits by x1.1 per diamond at a Luck-based chance'; break;
    case 'release_valve': out.note = '+1 swap +1 discard each time Focus maxes'; break;
  }
  return out;
}

// ── Pairs: every two Tricks alone together on the same hands ────────────────
// For each pair: v(none), v(a), v(b), v(both) on 200 shared hands. The
// interaction is what the pair makes beyond each one alone.
function AUD_pairs(ids, pairs) {
  const nH = Math.min(200, AUD.grids.length * AUD.cfg.handsPerGrid);
  if (!AUD.pairCache) {
    const hs = [];
    for (let k = 0; k < nH; k++) { const g = AUD.grids[Math.floor(k / AUD.cfg.handsPerGrid)], s = k % AUD.cfg.handsPerGrid; hs.push([g, g.hands[g.any[s]], g.ctx[s]]); }
    const base = hs.map(([g, h, ctx]) => { AUD_place(g.cards); return AUD_score(AUD_makeLoadout([], 1), 0, g, h, ctx)[0]; });
    const singles = ids.map((id, i) => {
      const L = AUD_makeLoadout([id], 1000 + i);
      let s = 0; hs.forEach(([g, h, ctx], k) => { AUD_place(g.cards); s += Math.log(Math.max(1, AUD_score(L, 1, g, h, ctx)[0])) - Math.log(Math.max(1, base[k])); });
      return s / nH;
    });
    AUD.pairCache = { hs, base, singles };
  }
  const { hs, base, singles } = AUD.pairCache;
  const rows = pairs.map(([a, b]) => {
    const L = AUD_makeLoadout([ids[a], ids[b]], 5000 + a * 997 + b);
    let iLog = 0, iPts = 0, both = 0, ptsBoth = 0, pts0 = 0;
    hs.forEach(([g, h, ctx], k) => {
      AUD_place(g.cards);
      const va = AUD_score(L, 1, g, h, ctx)[0], vb = AUD_score(L, 2, g, h, ctx)[0], vab = AUD_score(L, 3, g, h, ctx)[0], v0 = base[k];
      const lg = x => Math.log(Math.max(1, x));
      iLog += lg(vab) - lg(va) - lg(vb) + lg(v0); iPts += vab - va - vb + v0;
      both += lg(vab) - lg(v0); ptsBoth += vab; pts0 += v0;
    });
    return [a, b, iLog / nH, iPts / nH, both / nH, ptsBoth / nH, pts0 / nH];
  });
  return { singles, rows };
}

// ── Scaling Tricks: value alone by hours held, and by hand position in a level ──
function AUD_holdCurve(id, holds) {
  const cfg = AUD.cfg, keep = cfg.holdHands, out = { id, holds: [], byJ: [] };
  const run = () => {
    const L = AUD_makeLoadout([id], 77);
    let pts = 0, lg = 0, n = 0; const byJ = Array.from({ length: cfg.handsPerLevel }, () => [0, 0]);
    AUD.grids.forEach(g => { AUD_place(g.cards); g.any.forEach((hi, s) => {
      const h = g.hands[hi], ctx = g.ctx[s];
      const v0 = AUD_score(L, 0, g, h, ctx)[0], v1 = AUD_score(L, 1, g, h, ctx)[0];
      pts += v1 - v0; lg += Math.log(Math.max(1, v1)) - Math.log(Math.max(1, v0)); n++;
      byJ[ctx.j][0] += v1 - v0; byJ[ctx.j][1]++;
    }); });
    return { pts: pts / n, mult: Math.exp(lg / n), byJ: byJ.map(([s, c]) => c ? s / c : 0) };
  };
  try {
    for (const H of holds) { cfg.holdHands = H; const r = run(); out.holds.push({ H, pts: r.pts, mult: r.mult }); }
    cfg.holdHands = keep; out.byJ = run().byJ;
  } finally { cfg.holdHands = keep; }
  return out;
}

// ── Each Trick alone at several levels (flat pips fade as base pips grow) ────
function AUD_levelCurve(id, levels) {
  const cfg = AUD.cfg, keep = cfg.level, out = { id, levels: [] };
  try {
    for (const lv of levels) {
      cfg.level = lv;
      const L = AUD_makeLoadout([id], 77);
      let lg = 0, n = 0, pts = 0;
      AUD.grids.forEach(g => { AUD_place(g.cards); g.any.forEach((hi, s) => {
        const h = g.hands[hi], ctx = g.ctx[s];
        const v0 = AUD_score(L, 0, g, h, ctx)[0], v1 = AUD_score(L, 1, g, h, ctx)[0];
        lg += Math.log(Math.max(1, v1)) - Math.log(Math.max(1, v0)); pts += v1 - v0; n++;
      }); });
      out.levels.push({ level: lv, mult: Math.exp(lg / n), pts: pts / n });
    }
  } finally { cfg.level = keep; level = keep; }
  return out;
}
