// ══════════════════════════════════════════════
// RUN STATS  (r755)
// ══════════════════════════════════════════════
// The numbers a balance pass needs, kept for the whole run and written into the
// run's history entry when it ends (js/history.js, `entry.stats`). History's
// COPY ALL puts every run's stats on the clipboard as JSON, the run in progress
// included, so a pasted batch shows what each round asked, what it scored, how
// long it took and what the build held at the time.
//
// What is kept:
// - `rows`: one per round (a level; a boss window is its own row). Goal, score,
//   live seconds (only while the round clock can run: no menus, pauses, reward
//   screens or hidden tab), the clock at the start and at the clear, hands,
//   swaps, discards, the Focus peak, credits in and out, and every hand as
//   [seconds into the round, its score, its name, cards, Focus x].
// - `log`: what changed in the loadout and when (by level): a Trick, Knack or
//   Sleight gained or lost (with rarity and improvement tier), an improvement up
//   or down, a limit raised or lowered, a reward screen opened.
// - `end` (written at the run's end, or at a COPY): the loadout, every limit,
//   the deck, hand-family plays, hand-type plays, Trick fire counts.
//
// Gains are found by DIFFING the loadout, never by hooking every grant site:
// there are dozens of those, and a new one would silently go unlogged.
// `runStats` is in SAVE_VARS; the checkpoint is taken at a round's start, after
// rsRoundStart, so a resumed round starts its row clean.

let runStats = null;
const RS_FORMAT = 'lethe-run-stats-1';
let _rsLast = 0;   // performance.now() of the last tick, for live seconds

function rsReset() {
  runStats = { rows: [], log: [], scr: {}, cr: { earned: 0, spent: 0 }, own: null };
  _rsLast = performance.now();
}

function _rsLevel() { return typeof level === 'number' ? level : 0; }
function _rsQuarter() { return typeof qrlQuarter === 'function' ? qrlQuarter() : (typeof actNumber === 'number' ? actNumber : 1); }
function _rsBoss() { return (typeof bossActive !== 'undefined' && bossActive) ? ((typeof currentBoss !== 'undefined' && currentBoss && currentBoss.id) || 'boss') : 0; }
function _rsFx() { return typeof focusMultiplier === 'function' ? Math.round(focusMultiplier() * 100) / 100 : 1; }

// The row for the round being played; made when the level or the boss state changes.
function rsRow(make) {
  if (!runStats) return null;
  const rows = runStats.rows, lv = _rsLevel(), b = _rsBoss();
  let row = rows[rows.length - 1];
  if (row && row.lv === lv && row.boss === b) return row;
  if (!make) return row || null;
  row = { lv, q: _rsQuarter(), boss: b, goal: typeof roundGoal === 'number' ? roundGoal : 0, score: 0, cleared: 0,
          secs: 0, clearSecs: null, clock0: typeof roundSeconds === 'number' ? roundSeconds : 0, clockLeft: null,
          hands: 0, swaps: 0, discards: 0, fxPeak: _rsFx(), earned: 0, spent: 0, hs: [] };
  rows.push(row);
  return row;
}

// Every round start (startRoundTimer, above the save point).
function rsRoundStart() {
  if (!runStats) rsReset();
  const row = rsRow(true);
  if (row && !row.hands) { row.clock0 = roundSeconds; row.goal = roundGoal; }
  if (runStats.own) rsDiff();   // the baseline is taken at the end of startGame
}

// The round clock could tick now (the conditions startRoundTimer's own tick checks).
function rsLive() {
  return !!(runStats && typeof roundInterval !== 'undefined' && roundInterval && !roundEnded
    && !gameTimerPaused && !pipeTimerPaused && !(typeof isPaused !== 'undefined' && isPaused)
    && !(typeof quotaIntroHold !== 'undefined' && quotaIntroHold) && !document.hidden);
}

let _rsTicks = 0;
function rsTick() {
  const now = performance.now(), dt = Math.min(1.5, (now - _rsLast) / 1000);
  _rsLast = now;
  // Once a second the loadout is diffed, so a gain is logged at the level it
  // came in (a reward screen after round 5 is level 5's, not round 6's).
  if (runStats && runStats.own && ++_rsTicks % 4 === 0) rsDiff();
  if (!rsLive()) return;
  const row = rsRow(true);
  if (!row) return;
  row.secs += dt;
  const fx = _rsFx(); if (fx > row.fxPeak) row.fxPeak = fx;
  if (!row.hands) row.goal = roundGoal;
}

// From logPlayedHand (js/hand-log.js): the hand is committed and `score` holds it.
function rsHand(hand, cells, finalScore) {
  if (!runStats) return;
  const row = rsRow(true);
  if (!row) return;
  const fx = _rsFx();
  row.hands++;
  row.hs.push([Math.round(row.secs * 10) / 10, Math.round(finalScore || 0), hand || '?', (cells || []).length, fx]);
  row.score = Math.round(score);
  row.goal = roundGoal;
  if (fx > row.fxPeak) row.fxPeak = fx;
  if (!row.cleared && roundGoal > 0 && score >= roundGoal) {
    row.cleared = 1; row.clearSecs = Math.round(row.secs * 10) / 10; row.clockLeft = roundSeconds;
  }
}
// playHand's post-goal guard takes a hand back.
function rsUnhand() {
  const row = rsRow(false);
  if (!row || !row.hs.length) return;
  const h = row.hs.pop(); row.hands--; row.score = Math.max(0, row.score - h[1]);
}

// A swap or a discard action (js/input.js, js/discard.js).
function rsNote(kind) {
  const row = rsRow(true);
  if (row) row[kind === 'swap' ? 'swaps' : 'discards']++;
}

// Every change to credits (the `coins` setter, js/combos-aim.js).
function rsCredits(d) {
  if (!runStats || !d || (typeof _restoringSave !== 'undefined' && _restoringSave)) return;
  const k = d > 0 ? 'earned' : 'spent', v = Math.abs(d);
  runStats.cr[k] += v;
  const row = rsRow(false);
  if (row) row[k] += v;
}

// A reward screen opened: 'pick' (pick of three / a reward chain step), 'grid'
// (Balance Sheet, Benefits Package...), 'shop', 'event'.
function rsScreen(kind) {
  if (!runStats) return;
  rsDiff();
  runStats.scr[kind] = (runStats.scr[kind] || 0) + 1;
  runStats.log.push({ lv: _rsLevel(), e: 'screen', s: kind });
}

// ── The loadout and its diff ──
function rsOwned() {
  const own = {};
  const add = (k, id, r) => {
    if (!id) return;
    const key = k + ':' + id;
    if (own[key]) { own[key].n++; return; }
    own[key] = { k, id, r: r || '', n: 1, v: (typeof entityTier !== 'undefined' && entityTier[id]) || 0 };
  };
  (typeof trickTray !== 'undefined' ? trickTray : []).forEach(t => t && add('trick', t.id, t.tier || t.rarity));
  (typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []).forEach(k => k && add('knack', k.id, k.rarity || k.tier));
  if (typeof allOwnedSleightCards === 'function') allOwnedSleightCards().forEach(c => {
    const d = typeof sleightDef === 'function' ? sleightDef(c) : null;
    add('sleight', c.sleightId, d && d.rarity);
  });
  const lim = {};
  if (typeof LIMITS_DEF !== 'undefined') LIMITS_DEF.forEach(d => { if (limits[d.id]) lim[d.id] = limits[d.id].current; });
  return { e: own, lim };
}

function rsDiff() {
  if (!runStats || typeof trickTray === 'undefined') return;
  let now;
  try { now = rsOwned(); } catch (e) { return; }
  const was = runStats.own, lv = _rsLevel(), log = runStats.log;
  runStats.own = now;
  if (!was) {   // the first look: what the run started with
    Object.values(now.e).forEach(o => log.push({ lv, e: 'start', k: o.k, id: o.id, r: o.r, v: o.v, n: o.n }));
    log.push({ lv, e: 'limits', lim: now.lim });
    return;
  }
  for (const key in now.e) {
    const o = now.e[key], p = was.e[key];
    const gained = o.n - (p ? p.n : 0);
    for (let i = 0; i < gained; i++) log.push({ lv, e: '+', k: o.k, id: o.id, r: o.r, v: o.v });
    if (p && gained < 0) for (let i = 0; i < -gained; i++) log.push({ lv, e: '-', k: o.k, id: o.id, r: o.r, v: o.v });
    if (p && o.v !== p.v) log.push({ lv, e: o.v > p.v ? 'up' : 'down', k: o.k, id: o.id, r: o.r, v: o.v, from: p.v });
  }
  for (const key in was.e) if (!now.e[key]) {
    const p = was.e[key];
    for (let i = 0; i < p.n; i++) log.push({ lv, e: '-', k: p.k, id: p.id, r: p.r, v: p.v });
  }
  for (const id in now.lim) if (was.lim[id] !== undefined && now.lim[id] !== was.lim[id])
    log.push({ lv, e: 'limit', id, from: was.lim[id], to: now.lim[id] });
}

// What the run holds now, plus everything kept so far. Read at the run's end
// (recordRunToHistory) and by COPY ALL for the run in progress.
function rsFinal() {
  if (!runStats) return null;
  rsDiff();
  const tier = id => (typeof entityTier !== 'undefined' && entityTier[id]) || 0;
  const deck = typeof everyDeckCard === 'function' ? everyDeckCard() : [];
  const buffed = typeof tuCardBuffed === 'function' ? deck.filter(c => { try { return tuCardBuffed(c); } catch (e) { return false; } }).length : null;
  const end = {
    tricks:   (typeof trickTray !== 'undefined' ? trickTray : []).filter(Boolean).map(t => ({ id: t.id, name: t.name, r: t.tier || t.rarity, v: tier(t.id), fused: t.fused ? 1 : 0 })),
    knacks:   (typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []).filter(Boolean).map(k => ({ id: k.id, name: k.name, r: k.rarity || k.tier, v: tier(k.id) })),
    sleights: (typeof allOwnedSleightCards === 'function' ? allOwnedSleightCards() : []).map(c => {
      const d = typeof sleightDef === 'function' ? sleightDef(c) : null;
      return { id: c.sleightId, name: d ? d.name : c.sleightId, r: d ? d.rarity : '', v: tier(c.sleightId), uses: c._usesLeft };
    }),
    limits:   runStats.own ? runStats.own.lim : {},
    deck:     deck.length,
    buffedCards: buffed,
    credits:  typeof coins === 'number' ? coins : 0,
    familyPlays: typeof nsFamPlays !== 'undefined' ? { ...nsFamPlays } : null,
    handPlays:   typeof crHandPlays !== 'undefined' ? { ...crHandPlays } : null,
    trickFires:  typeof trickFireTotals !== 'undefined' ? { ...trickFireTotals } : null,
    quarters:    typeof quarterLog !== 'undefined' ? quarterLog.slice() : null,
  };
  return {
    format: RS_FORMAT,
    build: typeof BUILD === 'string' ? (BUILD.split('·')[1] || '').trim() : '',
    mode: (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) ? ACTIVE_MODE.id : '',
    protocol: (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.protocol) || 'standard',
    difficulty: typeof difficultyTier === 'function' ? difficultyTier() : 1,
    scoring: { model: typeof scoringModel !== 'undefined' ? scoringModel : '', ns: typeof nsModel !== 'undefined' ? nsModel : '' },
    handKey: '[seconds into round, score, hand, cards, Focus x]',
    rows: runStats.rows.map(r => ({ ...r, secs: Math.round(r.secs * 10) / 10 })),
    log: runStats.log, screens: runStats.scr, credits: runStats.cr, end,
  };
}

// A short readable summary of a stats object, for History's STATS fold.
function rsSummary(st) {
  if (!st || !st.rows) return null;
  const rows = st.rows.filter(r => r.hands || r.secs > 1);
  const hands = rows.reduce((n, r) => n + r.hands, 0);
  const secs  = rows.reduce((n, r) => n + (r.cleared ? r.clearSecs : r.secs), 0);
  const gains = { trick: {}, knack: {}, sleight: {} };
  let ups = 0;
  (st.log || []).forEach(l => {
    if (l.e === '+' && gains[l.k]) gains[l.k][l.r || '?'] = (gains[l.k][l.r || '?'] || 0) + 1;
    if (l.e === 'up') ups += (l.v - (l.from || 0));
  });
  const limits = {};
  (st.log || []).forEach(l => { if (l.e === 'limit') limits[l.id] = (limits[l.id] || 0) + (l.to - l.from); });
  return { rows, hands, secs, perHand: hands ? secs / hands : 0, gains, ups, limits };
}

if (typeof window !== 'undefined') setInterval(rsTick, 250);
