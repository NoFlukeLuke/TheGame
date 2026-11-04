// The scoring golden test (r720, SCORING_REWORK.md stage 1).
//
// Scores a fixed set of hands on a fixed board, with every live Trick alone in
// the tray (at v1 and at v6) and a set of seeded five-Trick trays, through the
// REAL calcScore (tools/sim/harness.js loads the game). Each result is the
// score, the final pips and mult, and a fingerprint of the animation timeline
// and the contributions, so a rework that moves a Trick to the new pipeline can
// prove it scores, bills and animates exactly as before.
//
//   node tools/scoring-golden/golden.js            write baseline.json
//   node tools/scoring-golden/golden.js --check    compare against baseline.json
//   node tools/scoring-golden/golden.js --check --only cascade   one Trick's cases
//   node tools/scoring-golden/golden.js --coverage   which Tricks change nothing in baseline.json
//   node tools/scoring-golden/golden.js --show overgrowth@1a/run3   print one case in full
// Case keys are <trick id>@<version><state>: overgrowth@6b is Cascade at v6 in state b.
//
// A balance change (a BAL number, a Trick's rule) changes the baseline on
// purpose: rerun without --check and commit the new baseline with the change.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const SHOW = args.includes('--show') ? args[args.indexOf('--show') + 1] : null;
const OUT = path.join(__dirname, 'baseline.json');

if (args.includes('--coverage')) {
  const b = JSON.parse(fs.readFileSync(OUT, 'utf8')).cases;
  const moved = new Set(), all = new Set();
  for (const [k, h] of Object.entries(b)) {
    const m = k.match(/^(.*)@(\d)([ab])$/); if (!m) continue;
    all.add(m[1]);
    const none = b['none' + m[3]];
    if (Object.entries(h).some(([hk, v]) => JSON.stringify(v) !== JSON.stringify(none[hk]))) moved.add(m[1]);
  }
  const quiet = [...all].filter(x => !moved.has(x));
  console.log(`${moved.size} of ${all.size} Tricks change a score, a timeline or a contribution somewhere; ${quiet.length} change nothing:`);
  console.log(quiet.join(' '));
  process.exit(0);
}

const G = require('../sim/harness.js').load();
const E = code => G.eval(code);

// Every case starts from the same state: a seeded Classic run, then the fixed
// board and counters below. Math.random is seeded per case, so a Trick that
// rolls at pickup (Feelin Lucky's ranks, a line) rolls the same every time.
E(`
var __gsSeed = 1;
var __gsRand = () => { __gsSeed = (__gsSeed + 0x6D2B79F5) | 0; let t = Math.imul(__gsSeed ^ (__gsSeed >>> 15), 1 | __gsSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
Math.random = __gsRand;
printToast = () => {};   // notices are page furniture the headless game lacks; scoring never reads them
try { if (typeof tutorialArmForRun === 'function') tutorialArmForRun = () => false; } catch (e) {}
ACTIVE_MODE = MODES.normal;
var __gsC = (rank, suit, id) => ({ rank, suit, _id: id });
// 5 x 5. Rows: three 7s + 8, a heart flush (K 3 Q 8 9), a spade straight flush
// 2-6, A A 4 4 9, a run 5 6 7 8 9 of mixed suits.
var __gsBoard = () => [
  ['7','♥'],['7','♠'],['7','♦'],['8','♣'],['9','♣'],
  ['K','♥'],['3','♥'],['Q','♥'],['8','♥'],['9','♥'],
  ['2','♠'],['3','♠'],['4','♠'],['5','♠'],['6','♠'],
  ['A','♦'],['A','♣'],['4','♦'],['4','♣'],['9','♦'],
  ['5','♥'],['6','♦'],['7','♣'],['8','♦'],['9','♠'],
].reduce((g, [r, s], i) => { (g[Math.floor(i / 5)] = g[Math.floor(i / 5)] || []).push(__gsC(r, s, 9000 + i)); return g; }, []);
var __gsHands = {
  pair:   [[3,0],[3,1]],
  set3:   [[0,0],[0,1],[0,2]],
  run3:   [[4,0],[4,1],[4,2]],
  run4:   [[4,0],[4,1],[4,2],[4,3]],
  twopair:[[3,0],[3,1],[3,2],[3,3]],
  full:   [[0,0],[0,1],[0,2],[0,3],[1,3]],
  flush:  [[1,0],[1,1],[1,2],[1,3],[1,4]],
  straight:[[4,0],[4,1],[4,2],[4,3],[4,4]],
  sflush: [[2,0],[2,1],[2,2],[2,3],[2,4]],
  pairk:  [[3,1],[3,0],[2,0]],
};
function __gsSetup(seed) {
  __gsSeed = seed;
  try { if (typeof fallCancelAll === 'function') fallCancelAll(); } catch (e) {}
  startGame();
  Math.random = __gsRand;   // startGame hands Math.random back to the native one on an unseeded run
  trickTray.length = 0; acquiredTricks.length = 0; acquiredKnacks.length = 0;
  Object.keys(entityTier || {}).forEach(k => delete entityTier[k]);
  applyEntityTiers();
  gridRows = 5; gridCols = 5; gridData = __gsBoard();
  [permPips, permMult, permXPips, permXMult, permRetrig].forEach(m => Object.keys(m).forEach(k => delete m[k]));
  activeHands = new Set(Object.values(HAND_NAME_TO_KEY));
  if (limits.trick_slots) limits.trick_slots.current = 8;   // room for a five-Trick tray
}
// Counters a Trick may read, set AFTER the Tricks are given (a pickup resets some).
// State 'a' is mid-round and plain; state 'b' is the first hand of a round on a
// buffed board with the clock paused and every counter up, so the Tricks that
// wait for a replay, a pause, a first hand or a built-up bonus have something to pay on.
function __gsState(v) {
  const T = (k, f) => { try { f(); } catch (e) {} };
  level = 5; roundStartSeconds = 180;
  T(0, () => { pauseInstanceGame = 1; rewindInstanceGame = 1; pausedSecondsRound = 4; });
  T(0, () => { handTypesRound = new Set(['Pair', 'Three of a Kind']); });
  T(0, () => { focusGenGame = 90; });
  if (v === 'a') {
    coins = 30; roundSeconds = 120;
    streakCount = 1; lastHandType = 'Pair'; handsPlayedRound = 2; cardsDiscardedRound = 3;
    return;
  }
  coins = 80; roundSeconds = 20;
  streakCount = 0; lastHandType = null; handsPlayedRound = 0; cardsDiscardedRound = 9;
  T(0, () => { pipeTimerPaused = true; });
  const id = (r, c) => cardId(gridData[r][c]);
  permRetrig[id(0, 0)] = 1; permRetrig[id(2, 0)] = 1; permRetrig[id(4, 0)] = 1; permRetrig[id(3, 0)] = 1;
  permPips[id(0, 1)] = 5; permMult[id(3, 1)] = 3; permXMult[id(4, 2)] = 1.5; permXPips[id(1, 0)] = 2;
  T(0, () => { bonusMult_nines = 6; bonusMult_tens = 6; bonusMult_compound = 4; bonusMult_morebetter = 4; bonusMult_fives = 4; });
  T(0, () => { negativeTilesTakenRun = 2; minuteHandCharges = 1; risingTideMult = 5; middleManMult = 6; });
}
function __gsGive(id, tier) {
  const t = (TRICK_POOL_ALL || TRICK_POOL).find(x => x.id === id);
  if (!t) return false;
  injectTrickAfterReward({ ...t });   // the reward path (tray, take, fusion of a pair) on a copy: a pickup writes its line and rolls onto the row
  for (let i = 0; i < tier; i++) { try { improveEntity(id); } catch (e) {} }
  try { if (typeof syncOwnedEntityDescs === 'function') syncOwnedEntityDescs(); } catch (e) {}
  return true;
}
function __gsScore() {
  const out = {};
  for (const [hk, cells] of Object.entries(__gsHands)) {
    selected = cells.slice();
    const comp = handComponentsFor(cells);
    const hand = comp ? comp.primary : null;
    if (!hand) { out[hk] = null; continue; }
    if (typeof resetTrickFires === 'function') resetTrickFires();
    const contrib = [], ledger = {};
    let score;
    try { score = calcScore(hand, cells, contrib, ledger); }
    catch (e) { out[hk] = { err: String(e && e.message || e) }; continue; }
    const r4 = v => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);
    const tl = (ledger.timeline || []).map(e => [e.id, e.op, r4(e.value), e.card, e.from, e.scope || '', e.replay ? 1 : 0, e.once ? 1 : 0]);
    const cb = contrib.map(x => [x.id, x.source, r4(x.pips || 0), r4(x.mult || 0)]).sort((a, b) => String(a).localeCompare(String(b)));
    out[hk] = { hand, score, pips: r4(ledger.finalPips), mult: r4(ledger.finalMult), tl, cb };
  }
  return JSON.stringify(out);
}
`);

const live = JSON.parse(E(`JSON.stringify((TRICK_POOL_ALL || TRICK_POOL).filter(t => !t.retired).map(t => t.id))`));
const cases = [];
for (const st of ['a', 'b']) {
  cases.push(['none' + st, [], 0, st]);
  live.forEach(id => { cases.push([id + '@1' + st, [id], 0, st]); cases.push([id + '@6' + st, [id], 5, st]); });
}
// Seeded five-Trick trays: interactions (x mult order, primes, Mirror, forced fires).
let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let i = 0; i < 40; i++) {
  const pick = new Set(); while (pick.size < 5) pick.add(live[Math.floor(rnd() * live.length)]);
  cases.push(['tray' + String(i).padStart(2, '0'), [...pick], 0, i % 2 ? 'b' : 'a']);
}

const hash = o => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 12);
const results = {};
const full = {};
const t0 = Date.now();
cases.forEach(([key, ids, tier, st], i) => {
  if (ONLY && !key.startsWith(ONLY + '@') && key !== ONLY) return;
  if (SHOW && !SHOW.startsWith(key + '/')) return;
  E(`__gsSetup(${1000 + i})`);   // the seed is the case's place in the full list, so --only / --show score alike
  ids.forEach(id => E(`__gsGive(${JSON.stringify(id)}, ${tier})`));
  E(`__gsState('${st}')`);
  const res = JSON.parse(E(`__gsScore()`));
  results[key] = {};
  for (const [hk, r] of Object.entries(res)) {
    if (!r) { results[key][hk] = null; continue; }
    if (r.err) { results[key][hk] = { err: r.err }; continue; }
    results[key][hk] = [r.hand, r.score, r.pips, r.mult, hash(r.tl), hash(r.cb)];
    full[key + '/' + hk] = r;
  }
});
const ms = Date.now() - t0;

if (SHOW) {
  const r = full[SHOW];
  if (!r) { console.log('no case', SHOW); process.exit(1); }
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
}
if (!CHECK) {
  fs.writeFileSync(OUT, JSON.stringify({ build: E('BUILD'), cases: results }, null, 0).replace(/\],"/g, '],\n"') + '\n');
  console.log(`wrote ${Object.keys(results).length} cases (${live.length} Tricks) to ${path.relative(process.cwd(), OUT)} in ${ms}ms`);
  process.exit(0);
}
const base = JSON.parse(fs.readFileSync(OUT, 'utf8')).cases;
const diffs = [];
for (const [key, hands] of Object.entries(results)) {
  const b = base[key];
  if (!b) { diffs.push(`${key}: not in the baseline`); continue; }
  for (const [hk, r] of Object.entries(hands)) {
    const a = b[hk];
    if (JSON.stringify(a) === JSON.stringify(r)) continue;
    const what = !a || !r ? 'present / absent' : (a.err || r.err) ? `error ${r.err || ''}`
      : a[1] !== r[1] ? `score ${a[1]} -> ${r[1]}` : a[2] !== r[2] || a[3] !== r[3] ? `pips/mult ${a[2]}/${a[3]} -> ${r[2]}/${r[3]}`
      : a[4] !== r[4] ? 'animation timeline differs' : 'contributions differ';
    diffs.push(`${key}/${hk}: ${what}`);
  }
}
if (!ONLY) Object.keys(base).forEach(k => { if (!results[k]) diffs.push(`${k}: in the baseline, not run now`); });
console.log(`${Object.keys(results).length} cases in ${ms}ms: ${diffs.length ? diffs.length + ' differ' : 'all match'}`);
diffs.slice(0, 60).forEach(d => console.log('  ' + d));
process.exit(diffs.length ? 1 : 0);
