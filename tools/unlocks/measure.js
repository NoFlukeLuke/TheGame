// r706: how much of each unlock counter a normal run produces, through the sim's bot.
// node tools/unlocks/measure.js <classic|flow> <runs> [handTime]  -> JSON of counts per run
const fs = require('fs');
const H = require('../sim/harness');
const mode = process.argv[2] || 'classic', runs = +(process.argv[3] || 20), handTime = +(process.argv[4] || 6);
const G = H.load();
if (G.errors.length) { console.error('load errors', G.errors); process.exit(1); }
G.eval(fs.readFileSync(__dirname + '/../sim/sim-core.js', 'utf8'));
G.eval(`SIM_CFG.handTime = ${handTime}; function SIM_goal(lv) { return goalForLevel(lv); }`);
G.eval('unlockDevReset();');
let wins = 0, levels = 0, errs = 0;
for (let i = 0; i < runs; i++) {
  try {
    const r = JSON.parse(G.eval(mode === 'flow' ? 'JSON.stringify(SIM_runFlow(SIM_goal))' : 'JSON.stringify(SIM_runClassic(SIM_goal, QUARTERS_PER_RUN || 4))'));
    if (r.win) wins++; levels += r.diedLevel || r.level || 0;
  } catch (e) { errs++; }
}
const st = JSON.parse(G.eval('JSON.stringify(unlockStore)'));
const per = {}; Object.keys(st.s).sort().forEach(k => { per[k] = +(st.s[k] / runs).toFixed(2); });
console.log(JSON.stringify({ mode, runs, errs, winRate: wins / runs, perRun: per, max: st.m, bestRun: st.rb }, null, 1));
