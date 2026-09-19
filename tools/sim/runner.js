// node runner.js <mode> <runs> <schedJson> [handTime]
// sched: { base, roundTo, segments: [[untilLevel, growthPct], ...], bossMult }
const fs = require('fs');
const H = require('./harness');

const mode = process.argv[2] || 'classic';
const runs = parseInt(process.argv[3] || '50', 10);
const sched = JSON.parse(process.argv[4] || '{"base":1200,"roundTo":500,"segments":[[99,35]],"bossMult":14.76}');
const handTime = parseFloat(process.argv[5] || '15');

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
if (sched.native) {} // no-op, SIM_goal already defined


const results = [];
const t0 = Date.now();
for (let i = 0; i < runs; i++) {
  let r;
  try {
    if (mode === 'classic') r = G.eval('JSON.stringify(SIM_runClassic(SIM_goal, QUARTERS_PER_RUN || 4))');
    else if (mode === 'schedule') r = G.eval(`JSON.stringify(SIM_runSchedule(SIM_goal, QUARTERS_PER_RUN || 4, ${sched.bossMult || 14.76}))`);
    else r = G.eval(`JSON.stringify(SIM_runSurvival(SIM_goal, ${sched.bossEvery || 300}))`);
    results.push(JSON.parse(r));
  } catch (e) {
    results.push({ err: String(e.message).slice(0, 120) });
  }
}
const ms = Date.now() - t0;
const ok = results.filter(r => !r.err);
const wins = ok.filter(r => r.win).length;
const errs = results.length - ok.length;
const losses = ok.filter(r => !r.win);
const hist = {};
losses.forEach(r => { hist[r.diedLevel] = (hist[r.diedLevel] || 0) + 1; });
const bossDeaths = losses.filter(r => r.boss).length;
console.log(JSON.stringify({
  mode, sched, handTime, runs: results.length, errs,
  winRate: ok.length ? +(wins / ok.length * 100).toFixed(1) : null,
  bossDeathShare: losses.length ? +(bossDeaths / losses.length * 100).toFixed(0) : null,
  deathLevels: hist,
  msPerRun: +(ms / runs).toFixed(0),
  firstErr: results.find(r => r.err)?.err,
}));
