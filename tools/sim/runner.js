// node runner.js <classic|schedule|flow> <runs> <schedJson> [handTime] [jobs]
// sched: { native } or { base, roundTo, segments: [[untilLevel, growthPct], ...] },
// plus bossMult / tiles (schedule). 'survival' is read as 'flow' (r683).
// jobs (r683): the runs are split over that many processes, default one per core.
const fs = require('fs');
const os = require('os');
const { fork } = require('child_process');
const H = require('./harness');

const mode = (process.argv[2] || 'classic') === 'survival' ? 'flow' : (process.argv[2] || 'classic');
const runs = parseInt(process.argv[3] || '50', 10);
const sched = JSON.parse(process.argv[4] || '{"native":true}');
const handTime = parseFloat(process.argv[5] || '15');
const jobs = Math.max(1, Math.min(runs, parseInt(process.argv[6] || String(os.cpus().length), 10)));

function playRuns(n) {
  const G = H.load();
  if (G.errors.length) { console.error('load errors', G.errors); process.exit(1); }
  G.eval(fs.readFileSync(__dirname + '/sim-core.js', 'utf8'));
  G.eval(`SIM_CFG.handTime = ${handTime};`);

  // build goalFn inside the context from the schedule (sched.native uses the game's own curve)
  if (sched.native) {
    G.eval('function SIM_goal(lv) { return goalForLevel(lv); }');
  } else G.eval(`
var SIM_SCHED = ${JSON.stringify(sched)};
function SIM_goal(lv) {
  let g = SIM_SCHED.base;
  for (let l = 2; l <= lv; l++) {
    let pct = SIM_SCHED.segments[SIM_SCHED.segments.length - 1][1];
    for (const [until, p] of SIM_SCHED.segments) { if (l <= until) { pct = p; break; } }
    g *= 1 + pct / 100;
  }
  const step = SIM_SCHED.roundTo || 500;
  return lv <= 1 ? SIM_SCHED.base : Math.max(step, Math.round(g / step) * step);
}
`);
  if (sched.tiles) G.eval(`var SIM_SCHED_TILES = ${JSON.stringify(sched.tiles)};`);

  const results = [];
  for (let i = 0; i < n; i++) {
    let r;
    try {
      if (mode === 'classic') r = G.eval('JSON.stringify(SIM_runClassic(SIM_goal, QUARTERS_PER_RUN || 4))');
      else if (mode === 'schedule') r = G.eval(`JSON.stringify(SIM_runSchedule(SIM_goal, QUARTERS_PER_RUN || 4, ${sched.bossMult || 0}))`);
      else if (mode === 'flow') r = G.eval('JSON.stringify(SIM_runFlow(SIM_goal))');
      else throw new Error('unknown mode ' + mode);
      results.push(JSON.parse(r));
    } catch (e) {
      results.push({ err: String(e.message).slice(0, 120) });
    }
  }
  return results;
}

function report(results, ms) {
  const ok = results.filter(r => !r.err);
  const wins = ok.filter(r => r.win).length;
  const errs = results.length - ok.length;
  const losses = ok.filter(r => !r.win);
  const hist = {};
  losses.forEach(r => { hist[r.diedLevel] = (hist[r.diedLevel] || 0) + 1; });
  const diags = losses.filter(r => r.diag).map(r => r.diag);
  const avg = (k) => diags.length ? +(diags.reduce((a, d) => a + (d[k] || 0), 0) / diags.length).toFixed(1) : null;
  const deathDiag = diags.length ? { hands: avg('hands'), dryActs: avg('dryActs'), avgFocus: avg('avgFocus'), scorePct: avg('scorePct'),
    reshuffles: avg('reshuffles'), stalled: diags.filter(d => d.stalled).length } : null;
  const bossDeaths = losses.filter(r => r.boss).length;
  console.log(JSON.stringify({
    mode, sched, handTime, runs: results.length, errs,
    winRate: ok.length ? +(wins / ok.length * 100).toFixed(1) : null,
    bossDeathShare: losses.length ? +(bossDeaths / losses.length * 100).toFixed(0) : null,
    deathLevels: hist, deathDiag,
    msPerRun: +(ms / results.length).toFixed(0), jobs,
    firstErr: results.find(r => r.err)?.err,
  }));
}

if (process.env.SIM_WORKER) {
  process.send(playRuns(runs));
} else {
  const t0 = Date.now();
  if (jobs === 1) report(playRuns(runs), Date.now() - t0);
  else {
    const all = [];
    let left = jobs;
    for (let j = 0; j < jobs; j++) {
      const n = Math.floor(runs / jobs) + (j < runs % jobs ? 1 : 0);
      const args = [process.argv[2] || 'classic', String(n), JSON.stringify(sched), String(handTime), '1'];
      const w = fork(__filename, args, { env: Object.assign({}, process.env, { SIM_WORKER: '1' }) });
      w.on('message', (res) => { all.push(...res); });
      w.on('exit', () => { if (--left === 0) report(all, Date.now() - t0); });
    }
  }
}
