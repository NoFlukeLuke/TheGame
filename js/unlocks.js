// ══ TRICK UNLOCKS (r706, owner) ══════════════════════════════════════════════
// Balatro's rule: a LOCKED Trick is never offered. Its goal (js/data/unlocks.js,
// TRICK_UNLOCKS) is met by playing: lifetime COUNTERS kept here, across runs, in
// `lethe.unlocks.v1`. The Builds record of a locked Trick reads LOCKED with its
// goal and progress (discovery.js `fileState` -> 'classified', `lockTaskFor`).
//
// Two layers, kept apart on purpose:
//   LOCKED       never offered. Goal in TRICK_UNLOCKS; met -> unlocked for good.
//   UNDISCOVERED offered, name hidden until taken once (js/discovery.js).
// A Trick ever taken counts as unlocked (a profile from before r706 keeps what
// it has met), and an id with no row is unlocked: a missing row must never
// remove a Trick from the game.
//
// COUNTER KINDS (the keys are the vocabulary of js/data/unlocks.js):
//   s   lifetime counts           hands, fam:run, replays, discards ...
//   rb  best value in ONE run     read by a rule with `run: 1`
//   m   best value ever           max:handscore, max:streak ...
// Every count comes through ulBump / ulMax. The hand-level ones all come from
// unlockNoteHand (called from scalingCount, once per real hand, after the dance,
// with the board still holding the hand), so one function says what a hand is.
// Paused in the tours and labs and a test drive, so testing never unlocks.

const UL_KEY = 'lethe.unlocks.v1';
let unlockStore = (() => {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(UL_KEY) || 'null'); } catch (e) {}
  o = (o && typeof o === 'object') ? o : {};
  o.s = o.s || {}; o.rb = o.rb || {}; o.m = o.m || {}; o.u = Array.isArray(o.u) ? o.u : [];
  return o;
})();
let _ulUnlocked = new Set(unlockStore.u);
// The current run's counts (SAVE_VARS, so a resumed run keeps its progress).
let unlockRun = {};
let _ulSaveT = 0;
function ulSave() {
  clearTimeout(_ulSaveT);
  _ulSaveT = setTimeout(() => { try { localStorage.setItem(UL_KEY, JSON.stringify(unlockStore)); } catch (e) {} }, 0);
}

// Counting stops in the tours, the labs and a test drive (their hands are not play).
function unlockPaused() {
  try {
    if (typeof location !== 'undefined' && /[?&](tricks|events|evgrid|improve|blank)\b/.test(location.search || '')) return true;
    if (typeof testDriveActive === 'function' && testDriveActive()) return true;
  } catch (e) {}
  return false;
}
// A new run's counts start at nothing (startGame).
function unlockRunReset() { unlockRun = {}; }

function ulBump(key, n) {
  n = (n === undefined) ? 1 : +n;
  if (!key || !(n > 0) || unlockPaused()) return;
  unlockStore.s[key] = (unlockStore.s[key] || 0) + n;
  unlockRun[key] = (unlockRun[key] || 0) + n;
  if (unlockRun[key] > (unlockStore.rb[key] || 0)) unlockStore.rb[key] = unlockRun[key];
  ulSave();
  ulCheckStat(key);
}
function ulMax(key, v) {
  if (!key || !(v > (unlockStore.m[key] || 0)) || unlockPaused()) return;
  unlockStore.m[key] = v;
  ulSave();
  ulCheckStat(key);
}
// The value a rule reads.
function ulValue(rule) {
  if (!rule || !rule.s) return 0;
  if (rule.s.startsWith('max:')) return unlockStore.m[rule.s] || 0;
  return (rule.run ? unlockStore.rb[rule.s] : unlockStore.s[rule.s]) || 0;
}

// ── the lock ────────────────────────────────────────────────────────────────
let unlockAllDev = (() => { try { return localStorage.getItem('lethe.unlockAll.v1') === '1'; } catch (e) { return false; } })();
function trickUnlockRule(id) { return (typeof TRICK_UNLOCKS !== 'undefined' && TRICK_UNLOCKS[id]) || null; }
function trickUnlocked(id) {
  if (!id) return true;
  const rule = trickUnlockRule(id);
  if (!rule || rule.start) return true;
  if (unlockAllDev || (typeof devRevealAll !== 'undefined' && devRevealAll)) return true;
  if (_ulUnlocked.has(id)) return true;
  if (typeof isDiscovered === 'function' && isDiscovered(id)) return true;
  return false;
}
// Locked = has a goal and has not met it. Only Tricks are locked (owner: Tricks first).
// The tours, labs and a Builds test drive lock nothing (unlockPaused).
function trickLocked(id) { return !!trickUnlockRule(id) && !trickUnlocked(id) && !unlockPaused(); }

// What a goal says, and how far along it is ("Play 20 runs · 7 / 20").
function unlockGoalText(id, withProgress) {
  const rule = trickUnlockRule(id);
  if (!rule) return '';
  let t = rule.text || (typeof unlockStatPhrase === 'function' ? unlockStatPhrase(rule) : '');
  if (withProgress && rule.s && !rule.buy) {
    const v = Math.min(rule.n, Math.floor(ulValue(rule)));
    t += ` · ${v.toLocaleString()} / ${rule.n.toLocaleString()}`;
  }
  return t;
}

// ── meeting a goal ──────────────────────────────────────────────────────────
let _ulByStat = null;
function _ulIndex() {
  if (_ulByStat) return _ulByStat;
  _ulByStat = {};
  if (typeof TRICK_UNLOCKS !== 'undefined') for (const id in TRICK_UNLOCKS) {
    const r = TRICK_UNLOCKS[id];
    if (r && r.s) (_ulByStat[r.s] = _ulByStat[r.s] || []).push(id);
  }
  return _ulByStat;
}
function ulCheckStat(key) {
  (_ulIndex()[key] || []).forEach(id => {
    if (trickUnlocked(id)) return;
    const r = TRICK_UNLOCKS[id];
    if (ulValue(r) >= r.n) unlockTrick(id);
  });
}
// The one door: a goal met, a license bought, the dev panel.
function unlockTrick(id, quiet) {
  if (!id || _ulUnlocked.has(id)) return false;
  _ulUnlocked.add(id); unlockStore.u = [..._ulUnlocked]; ulSave();
  // the live pool takes it at once (TRICK_POOL drops locked Tricks, js/data/tricks.js)
  if (typeof applyModeEntityFilter === 'function' && typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) { try { applyModeEntityFilter(); } catch (e) {} }
  if (!quiet) unlockAnnounce(id);
  if (typeof dbgEvent === 'function') dbgEvent(`[UNLOCK] ${id}`);
  return true;
}
// One printed line per unlock, gathered for a moment so a hand that meets three
// goals prints one slip. A name the player has not met stays hidden (discovery.js).
let _ulAnnQ = [], _ulAnnT = 0;
function unlockAnnounce(id) {
  _ulAnnQ.push(id);
  clearTimeout(_ulAnnT);
  _ulAnnT = setTimeout(() => {
    const ids = _ulAnnQ.splice(0);
    ids.forEach(x => {
      const def = (typeof TRICK_POOL_ALL !== 'undefined') ? TRICK_POOL_ALL.find(t => t.id === x) : null;
      if (!def) return;
      const hidden = typeof nameHidden === 'function' && nameHidden(def, 'trick');
      const tier = (typeof tierLabel === 'function') ? tierLabel('trick', def.tier) : def.tier;
      const word = (typeof entityLabel === 'function') ? entityLabel('trick', false) : 'Trick';
      const line = hidden ? `UNLOCKED: a new ${tier} ${word}` : `UNLOCKED: ${def.name}`;
      if (typeof showMessage === 'function') showMessage(line, '#7fe0a0');
    });
    if (typeof sfxSuccess === 'function') { try { sfxSuccess(); } catch (e) {} }
  }, 250);
}

// ── what a hand counts ──────────────────────────────────────────────────────
// Called from scalingCount (js/play-hand.js) for every real hand, after the dance,
// board intact. `reps` is replays by 'r-c' (1 = scored once). The sim calls it too
// (tools/sim), which is how the goals' sizes were measured.
const UL_SUIT = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
let _ulLastHand = null;   // { score, pips, mult } of the hand just banked (playHand)
// Seconds of round clock used so far (a falling clock, so elapsed = start - left).
function ulClockNow() {
  try { return (typeof roundStartSeconds === 'number' && typeof roundSeconds === 'number') ? roundStartSeconds - roundSeconds : 0; } catch (e) { return 0; }
}
let _ulRound = { lv: -1, runs: 0, pairT: [] };
// A round that paused or rewound the clock (Patient Rulers' goal), counted when it clears.
let _ulRoundTimed = false;
function unlockTimeTouched(secs) { _ulRoundTimed = true; ulBump('timesecs', secs); }
function unlockRoundCleared() {
  ulBump('rounds');
  if (typeof roundSeconds === 'number') ulMax('max:secsleft', Math.floor(roundSeconds));
  if (_ulRoundTimed) ulBump('timedrounds');
  _ulRoundTimed = false;
}
function unlockNoteHand(hand, cells, reps) {
  if (unlockPaused() || !cells || !cells.length) return;
  const n = (r, c) => (reps && reps[r + '-' + c]) || 1;
  ulBump('hands');
  // the hand and its layers (a same-suit run is a run AND a flush)
  const layers = (typeof handLayersFor === 'function') ? (handLayersFor(hand, cells) || [hand]) : [hand];
  const fams = new Set();
  layers.forEach(h => {
    if (!h) return;
    ulBump('h:' + h);
    ((typeof NS_HAND_FAMILIES !== 'undefined' && NS_HAND_FAMILIES[h]) || []).forEach(f => fams.add(f));
  });
  fams.forEach(f => ulBump('fam:' + f));
  ulBump('size:' + cells.length);
  // the cards
  let replays = 0, corners = 0, crosses = 0;
  const suits = new Set();
  cells.forEach(([r, c]) => {
    const card = gridData[r] && gridData[r][c];
    if (!card) return;
    const k = n(r, c);
    replays += k - 1;
    if (typeof WILD_RANK !== 'undefined' && card.rank === WILD_RANK) { ulBump('wilds'); return; }
    if (card._isSleight || card._isStone) return;
    ulBump('cards', k);
    const rank = card.rank;
    if (rank) {
      ulBump('rank:' + rank, k);
      if (['J', 'Q', 'K'].includes(rank)) ulBump('faces', k);
      if (typeof _rankIsOddRank === 'function' && _rankIsOddRank(rank)) ulBump('odd', k);
      if (typeof _rankIsEvenRank === 'function' && _rankIsEvenRank(rank)) ulBump('even', k);
      if (['A', '2', '3', '5', '7'].includes(rank)) ulBump('primes', k);
      if (['2', '3', '4', '5', '6'].includes(String(rank))) ulBump('low', k);
    }
    if (UL_SUIT[card.suit]) { ulBump('suit:' + UL_SUIT[card.suit], k); suits.add(card.suit); }
    if (card.suit2 && UL_SUIT[card.suit2]) suits.add(card.suit2);
    if (r === 0 || c === 0 || r === gridRows - 1 || c === gridCols - 1) ulBump('edge', k);
    if (typeof isCorner === 'function' && isCorner(r, c)) { ulBump('corner', k); corners++; }
    if (typeof rowColBonuses !== 'undefined') {
      const onRow = rowColBonuses.some(b => b.axis === 'row' && b.index === r), onCol = rowColBonuses.some(b => b.axis === 'col' && b.index === c);
      if (onRow || onCol) ulBump('linecards', k);
      if (onRow && onCol) crosses += k;
    }
    try { if (typeof cardBuffLines === 'function' && cardBuffLines(cardId(card), card).length) ulBump('buffed', k); } catch (e) {}
  });
  if (replays) ulBump('replays', replays);
  if (crosses) ulBump('crosscards', crosses);
  if (corners >= 2) ulBump('twocorner');
  if (suits.size >= 4) ulBump('foursuit');
  if (suits.size === 2 && suits.has('♥') && suits.has('♦')) ulBump('redhands');
  if (fams.has('run') && cells.length >= 4) ulBump('longruns');
  try { if (typeof clockPausedForHand === 'function' && clockPausedForHand()) ulBump('pausedhands'); } catch (e) {}
  // runs in one round (the most, best ever), and pair hands three inside 30s
  const lv = (typeof level !== 'undefined') ? level : 0;
  if (_ulRound.lv !== lv) _ulRound = { lv, runs: 0, pairT: [] };
  if (fams.has('run')) ulMax('max:roundruns', ++_ulRound.runs);
  const pairish = layers.some(h => h === 'Pair' || h === 'Two Pair' || h === 'Full House');
  if (pairish) {
    const t = ulClockNow();
    _ulRound.pairT = _ulRound.pairT.filter(x => t - x <= 30); _ulRound.pairT.push(t);
    if (_ulRound.pairT.length >= 3) { ulBump('pairburst'); _ulRound.pairT = []; }
  }
  ulMax('max:handreplays', replays);
  // shapes
  try {
    if (typeof isSquare === 'function' && isSquare(cells)) ulBump('shapes:square');
    if (typeof isCross === 'function' && isCross(cells)) ulBump('shapes:cross');
    if (cells.length === 5 && (new Set(cells.map(x => x[0])).size === 1 || new Set(cells.map(x => x[1])).size === 1)) ulBump('shapes:line5');
  } catch (e) {}
  // the hand's numbers
  if (_ulLastHand) {
    ulMax('max:handscore', Math.floor(_ulLastHand.score || 0));
    ulMax('max:handpips', Math.floor(_ulLastHand.pips || 0));
    ulMax('max:handmult', Math.floor(_ulLastHand.mult || 0));
    if (pairish) ulMax('max:pairhandscore', Math.floor(_ulLastHand.score || 0));
    _ulLastHand = null;
  }
  try { if (typeof streakCount !== 'undefined') { ulMax('max:streak', streakCount); if (streakCount === 3) ulBump('streak3'); } } catch (e) {}
  try { if (typeof handsPlayedRound !== 'undefined') ulMax('max:handsinround', handsPlayedRound); } catch (e) {}
  try { if (typeof focusMultiplier === 'function') ulMax('max:focusmult', Math.round(focusMultiplier() * 100) / 100); } catch (e) {}
}

// ── credits: the coins accessor (js/combos-aim.js) sees every change ────────
// A run's opening balance and a restored save are not earnings.
let _ulRunLive = false;
function unlockCoinsChanged(d, v) {
  if (!_ulRunLive || (typeof _restoringSave !== 'undefined' && _restoringSave)) return;
  if (d > 0) ulBump('credits', d);
  ulMax('max:creditsheld', v);
}
function unlockRunStarted() { unlockRunReset(); unlockRun.c0 = collectionCounts(); _ulRunLive = true; }
// Once per run: a won run continued into Endless ends again later, and is still one run.
function unlockRunEnded(won) {
  if (unlockRun.ended) return;
  unlockRun.ended = 1;
  ulBump('runs');
  if (won) ulBump('wins');
}

// ── meta flags (r706): the parked meta shop's switches, one store ─────────────
// legendary_find: legendaries are easier to find (js/luck.js reads it).
const META_KEY = 'lethe.meta.v1';
let metaStore = (() => { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch (e) { return {}; } })();
function metaFlag(id) { return !!metaStore[id]; }
function metaSet(id, on) {
  if (on) metaStore[id] = 1; else delete metaStore[id];
  try { localStorage.setItem(META_KEY, JSON.stringify(metaStore)); } catch (e) {}
}

// ── dev ─────────────────────────────────────────────────────────────────────
function unlockDevAll(on) {
  unlockAllDev = !!on;
  try { if (on) localStorage.setItem('lethe.unlockAll.v1', '1'); else localStorage.removeItem('lethe.unlockAll.v1'); } catch (e) {}
  if (typeof applyModeEntityFilter === 'function' && typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) { try { applyModeEntityFilter(); } catch (e) {} }
}
function unlockDevReset() {
  unlockStore = { s: {}, rb: {}, m: {}, u: [] }; _ulUnlocked = new Set(); unlockRun = {};
  try { localStorage.removeItem(UL_KEY); } catch (e) {}
  if (typeof applyModeEntityFilter === 'function' && typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) { try { applyModeEntityFilter(); } catch (e) {} }
}
// Counts for the dev panel and Builds: unlocked / total per tier.
function unlockCounts() {
  const out = {};
  if (typeof TRICK_POOL_ALL === 'undefined') return out;
  TRICK_POOL_ALL.filter(t => t && !t.retired && !t.fused).forEach(t => {
    const o = out[t.tier] = out[t.tier] || { open: 0, all: 0 };
    o.all++; if (trickUnlocked(t.id)) o.open++;
  });
  return out;
}

// ── the collection (r706, owner): Builds' bar and the finale print it ───────
// Tricks found (taken at least once) and unlocked, out of the live pool (not
// retired, not fused); fused Tricks are the Inseparable count, made at least once.
function collectionCounts() {
  const out = { found: 0, unlocked: 0, all: 0, pairs: 0, pairsAll: 0 };
  if (typeof TRICK_POOL_ALL === 'undefined') return out;
  TRICK_POOL_ALL.forEach(t => {
    if (!t || t.retired) return;
    if (t.fused) { out.pairsAll++; if (typeof inseparableSeenSet === 'function' && inseparableSeenSet().has(t.id)) out.pairs++; return; }
    out.all++;
    if (typeof isDiscovered === 'function' && isDiscovered(t.id)) out.found++;
    if (trickUnlocked(t.id)) out.unlocked++;
  });
  return out;
}
function collectionLine() {
  const c = collectionCounts();
  return `TRICKS FOUND ${c.found} / ${c.all} · UNLOCKED ${c.unlocked} / ${c.all}` + (c.pairs ? ` · INSEPARABLE ${c.pairs} / ${c.pairsAll}` : '');
}
// What this run added: found, unlocked, pairs since it started (unlockRun.c0, in SAVE_VARS).
function collectionGained() {
  const now = collectionCounts(), was = (unlockRun && unlockRun.c0) || now;
  return { now, found: now.found - was.found, unlocked: now.unlocked - was.unlocked, pairs: now.pairs - was.pairs };
}

// ── the words for a goal (the phrases live in js/data/unlocks.js) ──────────
function unlockStatPhrase(rule) {
  const t = (typeof UL_STAT_TEXT !== 'undefined' && UL_STAT_TEXT[rule.s]) || null;
  const n = (rule.n || 0).toLocaleString();
  let line = t ? t.replace('{n}', n) : `${rule.s} ${n}`;
  if (rule.run) line += ' in one run';
  return line;
}
