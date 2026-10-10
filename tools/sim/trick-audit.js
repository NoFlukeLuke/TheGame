// Trick audit driver. Deals random 5-Trick loadouts from Flow's Trick pool and
// scores the same boards and hands with each, through the real game code
// (tools/sim/trick-audit-core.js inside the harness). Every Trick lands in the
// same number of loadouts: the pool is shuffled and dealt five at a time, once
// per deal.
//
//   node tools/sim/trick-audit.js [--deals 30] [--grids 100] [--workers 4]
//                                 [--passes loadouts,focus,time,hold,levels,pairs,steer]
//                                 [--scoring classic|mult_ladder|hand_size] [--steerIds a,b]
//                                 [--out tools/sim/out/trick-audit.json] [--cfg '{"level":12}']
//
// Output: one JSON file with the settings, the pool (live names, rarities and
// descriptions) and one record per loadout (per-Trick Shapley sums for the
// "any hand" and "planned" sets). tools/sim/trick-audit-report.py turns it into
// the spreadsheet.
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const DEFAULTS = {
  seed: 1,
  level: 12,              // mid-run Flow level: base pips x1.1^11
  quarter: 2,             // one boss beaten: QRL lets a card use 2 buffs / 2 replay sources
  rows: 5, cols: 5, maxHand: 5,
  grids: 100, handsPerGrid: 10,
  handsPerLevel: 6,       // hands it takes to clear a level
  sessionSeconds: 300,    // Flow's clock to the boss
  levelStartMin: 45,      // a level starts with 45..300s on that clock
  handSeconds: 6,         // average seconds between hands (README: the owner plays ~5-6s a hand)
  minGap: 1.5,            // fastest hand
  swapChance: 0.25, discardChance: 0.15, cardsPerDiscard: 3,
  focusNodesMax: 20,      // Flow's Focus cap: x1.0..x2.0
  coinsMax: 50,           // credits held, 0..50
  holdHands: 48,          // a scaling Trick has been held for 48 hands (8 levels)
  focusPerHand: 4,        // Focus made per hand (Wellspring's counter); replaced by the measured baseline
  stockHeld: 4,           // swaps + discards in hand (Hoarder House)
  sleightsOwned: 2, sleightChargesMissing: 2,
  baseBuffPips: 4, baseBuffPipsAmt: 10,   // the deck's own buffs: 4 cards +10 pips,
  baseBuffMult: 2, baseBuffMultAmt: 4,    // 2 cards +4 mult
  focusLevels: 8, focusRuns: 150,
  levelUpSeconds: 15,     // time on the reward screens between levels (the speed bonus clock keeps running)
  scoring: 'classic',     // the scoring model: classic / mult_ladder / hand_size
  steerGrids: 100,        // steer pass: boards searched per Trick
  steerSamples: 2,        //   random draws behind each discard
  steerCands: 8,          //   discard groups tried per board
  steerDiscardMax: 3,     //   cards in one discard
};

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

function loadGame(cfg) {
  const H = require('./harness');
  const G = H.load();
  if (G.errors.length) throw new Error('game load errors: ' + JSON.stringify(G.errors));
  G.eval(fs.readFileSync(path.join(__dirname, 'trick-audit-core.js'), 'utf8'));
  G.eval(`AUD_init(${JSON.stringify(cfg)})`);
  return G;
}

// ── worker ──
if (process.argv[2] === 'worker') {
  const cfg = JSON.parse(process.argv[3]);
  const G = loadGame(cfg);
  G.eval('AUD_buildGrids()');
  process.on('message', msg => {
    if (msg.type === 'loadout') {
      const r = JSON.parse(G.eval(`JSON.stringify(AUD_runLoadout(${JSON.stringify(msg.ids)}, ${msg.seed}))`));
      r.idx = msg.idx;
      process.send({ type: 'result', r });
    } else if (msg.type === 'focus') {
      const r = JSON.parse(G.eval(`JSON.stringify(AUD_focusTrick(${JSON.stringify(msg.id)}))`));
      process.send({ type: 'result', r });
    } else if (msg.type === 'time') {
      const r = JSON.parse(G.eval(`JSON.stringify(AUD_timeTrick(${JSON.stringify(msg.id)}))`));
      process.send({ type: 'result', r });
    } else if (msg.type === 'pairs') {
      const r = JSON.parse(G.eval(`JSON.stringify(AUD_pairs(${JSON.stringify(msg.ids)}, ${JSON.stringify(msg.pairs)}))`));
      process.send({ type: 'result', r });
    } else if (msg.type === 'hold') {
      const r = JSON.parse(G.eval(`JSON.stringify(AUD_holdCurve(${JSON.stringify(msg.id)}, ${JSON.stringify(msg.holds)}))`));
      process.send({ type: 'result', r });
    } else if (msg.type === 'levels') {
      const r = JSON.parse(G.eval(`JSON.stringify(AUD_levelCurve(${JSON.stringify(msg.id)}, ${JSON.stringify(msg.levels)}))`));
      process.send({ type: 'result', r });
    } else if (msg.type === 'steer') {
      const r = JSON.parse(G.eval(`JSON.stringify(AUD_steerTrick(${JSON.stringify(msg.id)}))`));
      process.send({ type: 'result', r });
    } else if (msg.type === 'exit') process.exit(0);
  });
  process.send({ type: 'ready' });
  return;
}

// ── main ──
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Run a list of jobs over N workers; resolves with the results in job order.
function runPool(cfg, jobs, nWorkers, label) {
  return new Promise((resolve, reject) => {
    const results = new Array(jobs.length);
    let next = 0, done = 0, started = Date.now();
    const workers = [];
    const feed = w => {
      if (next >= jobs.length) { w.send({ type: 'exit' }); return; }
      const i = next++;
      w._job = i;
      w.send(jobs[i]);
    };
    for (let k = 0; k < Math.min(nWorkers, jobs.length); k++) {
      const w = fork(__filename, ['worker', JSON.stringify(cfg)]);
      workers.push(w);
      w.on('message', msg => {
        if (msg.type === 'ready') return feed(w);
        if (msg.type === 'result') {
          results[w._job] = msg.r; done++;
          if (done % Math.max(1, Math.floor(jobs.length / 20)) === 0 || done === jobs.length) {
            const s = (Date.now() - started) / 1000;
            process.stderr.write(`${label}: ${done}/${jobs.length}  ${s.toFixed(0)}s elapsed, ~${(s / done * (jobs.length - done)).toFixed(0)}s left\n`);
          }
          if (done === jobs.length) resolve(results);
          feed(w);
        }
      });
      w.on('error', reject);
      w.on('exit', code => { if (code && done < jobs.length) reject(new Error('worker exited ' + code)); });
    }
  });
}

async function main() {
  const cfg = Object.assign({}, DEFAULTS, JSON.parse(arg('cfg', '{}')));
  cfg.grids = parseInt(arg('grids', cfg.grids), 10);
  cfg.scoring = arg('scoring', cfg.scoring);
  const deals = parseInt(arg('deals', '30'), 10);
  const nWorkers = parseInt(arg('workers', '4'), 10);
  const out = arg('out', path.join(__dirname, 'out', 'trick-audit.json'));
  const passes = (arg('passes', 'loadouts,focus,time,hold,levels,pairs')).split(',');
  fs.mkdirSync(path.dirname(out), { recursive: true });

  // The pool as Flow offers it, with the live (BAL-regenerated) descriptions.
  const G = loadGame(cfg);
  const pool = JSON.parse(G.eval(`JSON.stringify(TRICK_POOL.filter(t => !survivalEntityBanned(t.id)).map(t => ({ id: t.id, name: t.name, tier: t.tier, desc: t.desc, tags: t.tags || [] })))`));
  const banned = JSON.parse(G.eval(`JSON.stringify(TRICK_POOL.filter(t => survivalEntityBanned(t.id)).map(t => t.id))`));
  const ids = pool.map(t => t.id);
  const result = { cfg, deals, pool, banned, build: G.eval(`typeof BUILD === 'string' ? BUILD : ''`), started: new Date().toISOString() };
  if (fs.existsSync(out)) Object.assign(result, JSON.parse(fs.readFileSync(out, 'utf8')), { cfg, pool, banned });
  const save = () => fs.writeFileSync(out, JSON.stringify(result));

  // Focus at scoring time, by hand position in a level, from a no-Trick run of
  // the Focus pass: the loadout pass draws each hand's Focus from it.
  if (!cfg.focusDist) {
    G.eval(`AUD_buildGrids()`);
    const base = JSON.parse(G.eval(`JSON.stringify(AUD_focusTrick(null))`));
    cfg.focusDist = base.nodesHist;
    cfg.focusPerHand = +base.gen.toFixed(2);
    result.focusBase = { mult: base.mult, byJ: base.byJ, maxed: base.maxed };
    process.stderr.write(`Focus baseline: x${base.mult.toFixed(2)} average, at the cap ${(base.maxed * 100).toFixed(0)}% of hands\n`);
  }
  result.cfg = cfg;

  if (passes.includes('loadouts')) {
    const r = rng(cfg.seed * 31 + 7);
    const jobs = [];
    for (let d = 0; d < deals; d++) {
      const order = ids.slice();
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      for (let k = 0; k < order.length; k += 5) {
        let lo = order.slice(k, k + 5);
        // The deal's last few Tricks are topped up with random others.
        while (lo.length < 5) { const x = ids[Math.floor(r() * ids.length)]; if (!lo.includes(x)) lo.push(x); }
        jobs.push({ type: 'loadout', idx: jobs.length, ids: lo, seed: (cfg.seed * 1000 + jobs.length) * 7 + 3 });
      }
    }
    process.stderr.write(`${jobs.length} loadouts x ${cfg.grids * cfg.handsPerGrid} hands, ${nWorkers} workers\n`);
    result.loadouts = await runPool(cfg, jobs, nWorkers, 'loadouts');
    save();
  }
  if (passes.includes('focus')) {
    const jobs = [null, ...ids].map(id => ({ type: 'focus', id }));
    result.focus = await runPool(cfg, jobs, nWorkers, 'focus');
    save();
  }
  if (passes.includes('time')) {
    const jobs = [null, ...ids].map(id => ({ type: 'time', id }));
    result.time = await runPool(cfg, jobs, nWorkers, 'time');
    save();
  }
  if (passes.includes('hold')) {
    const scaling = arg('holdIds', 'compound_mult,nines_mult,tens_mult,fives_discard,relentless,club_double,wellspring,sapling,first_fruits,sixes_perm,fours_perm,heartwood,hourglass,hummingbird,feng_shui,rising_tide,summit').split(',');
    const holds = [0, 12, 24, 48, 96, 144];
    result.hold = await runPool(cfg, scaling.filter(id => ids.includes(id)).map(id => ({ type: 'hold', id, holds })), nWorkers, 'hold');
    save();
  }
  if (passes.includes('levels')) {
    const levels = [4, 12, 24];
    result.levels = await runPool(cfg, ids.map(id => ({ type: 'levels', id, levels })), nWorkers, 'levels');
    save();
  }
  if (passes.includes('steer')) {
    // Each Trick alone (and no Trick), best hand as dealt / with a swap / with a discard and a swap.
    const only = arg('steerIds', '');
    const sel = only ? only.split(',').filter(id => ids.includes(id)) : ids;
    result.steer = await runPool(cfg, [null, ...sel].map(id => ({ type: 'steer', id })), nWorkers, 'steer');
    save();
  }
  if (passes.includes('pairs')) {
    // Every pair of Tricks, alone together, on the same 200 hands. Chunked.
    const pairs = [];
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) pairs.push([a, b]);
    const lim = parseInt(arg('pairsLimit', '0'), 10);
    if (lim > 0) pairs.length = Math.min(pairs.length, lim);
    const chunk = 400, jobs = [];
    for (let k = 0; k < pairs.length; k += chunk) jobs.push({ type: 'pairs', ids, pairs: pairs.slice(k, k + chunk) });
    const parts = await runPool(cfg, jobs, nWorkers, 'pairs');
    result.pairs = { singles: parts[0].singles, rows: [].concat(...parts.map(p => p.rows)) };
    save();
  }
  result.finished = new Date().toISOString();
  save();
  process.stderr.write('wrote ' + out + '\n');
}

main().catch(e => { console.error(e); process.exit(1); });
