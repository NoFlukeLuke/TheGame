// Build sweep (r725): one 3-minute round at level 1 under a RANDOM build, many times, then a
// regression of log(score) on each reward type, so each type's lift per unit can be read.
//   node probes/build-sweep.js <samples> <handTime> <jobs>   (from tools/sim)
// Factors per sample: Tricks 0-8 (tray cap lifted), Knacks 0-4, extra rows+cols 0-3, Selection
// +0-3, swaps and discards +0-4, improvements 0-10 (on what is owned), scaling rungs 0-20 (every
// family: +2 mult and +1 pip per card a rung), buffed deck cards 0-15 (deck-editor buffs).
// Sleights are left out: the bot cannot use them. Focus starts at 0 and the round is 180s.
const fs = require('fs'), os = require('os'), { fork } = require('child_process');
const N = +process.argv[2] || 2000, ht = +process.argv[3] || 9;
const jobs = Math.max(1, Math.min(N, +process.argv[4] || os.cpus().length));
function play(n) {
  const H = require(__dirname + '/../harness'); const G = H.load();
  if (G.errors.length) { console.error(G.errors); process.exit(1); }
  G.eval(fs.readFileSync(__dirname + '/../sim-core.js', 'utf8'));
  G.eval(`SIM_CFG.handTime=${ht};
  const ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
  function BS_sample(){
    ACTIVE_MODE=MODES.normal; startGame(); SIM_resetCharges();
    const f={tricks:ri(0,8),knacks:ri(0,4),dims:ri(0,3),sel:ri(0,3),swaps:ri(0,4),discards:ri(0,4),improves:ri(0,10),rungs:ri(0,20),buffs:ri(0,15)};
    limits.trick_slots.current=12;
    for(let i=0;i<f.tricks;i++) SIM_grant('trick',1);
    for(let i=0;i<f.knacks;i++) SIM_grant('knack',1);
    for(let i=0;i<f.dims;i++){ if(Math.random()<0.5) limits.grid_rows.current++; else limits.grid_cols.current++; }
    gridRows=limits.grid_rows.current; gridCols=limits.grid_cols.current;
    limits.selection.current+=f.sel;
    let done=0; for(let i=0;i<f.improves;i++) if(SIM_improveRandomOwned()) done++; f.improves=done;
    nsFamPlays={set:15*f.rungs,run:15*f.rungs,flush:15*f.rungs};
    try{flushPlayedDeck();}catch(e){}
    const deck=drawPile.filter(c=>c&&!c._isSleight&&c.rank!==WILD_RANK); let b=0;
    for(let i=0;i<f.buffs&&deck.length;i++){ const c=deck.splice(Math.floor(Math.random()*deck.length),1)[0]; const e=rollEditorBuff(); if(e){ enhanceCardKey(cardId(c),e); b++; } } f.buffs=b;
    try{initGridData();}catch(e){}
    score=0; roundGoal=1e15; roundSeconds=180; swaps=3+f.swaps; discards=3+f.discards;
    try{resetFocusMeter();}catch(e){}
    const res=SIM_playRound();
    return JSON.stringify({...f,tricksHeld:trickTray.length,score:res.score,hands:res.hands,focus:res.avgFocus,sw:3+f.swaps-swaps,dc:3+f.discards-discards});
  }`);
  const out = []; for (let i = 0; i < n; i++) { try { out.push(JSON.parse(G.eval('BS_sample()'))); } catch (e) { out.push({ err: String(e).slice(0, 120) }); } }
  return out;
}
function regress(rows) {
  const keys = ['tricksHeld', 'knacks', 'dims', 'sel', 'swaps', 'discards', 'improves', 'rungs', 'buffs'];
  const X = rows.map(r => [1, ...keys.map(k => r[k])]), y = rows.map(r => Math.log(Math.max(1, r.score)));
  const p = X[0].length, A = Array.from({ length: p }, () => new Array(p).fill(0)), b = new Array(p).fill(0);
  for (let i = 0; i < X.length; i++) for (let j = 0; j < p; j++) { b[j] += X[i][j] * y[i]; for (let k = 0; k < p; k++) A[j][k] += X[i][j] * X[i][k]; }
  for (let i = 0; i < p; i++) { let mx = i; for (let r = i + 1; r < p; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r; [A[i], A[mx]] = [A[mx], A[i]]; [b[i], b[mx]] = [b[mx], b[i]];
    for (let r = 0; r < p; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let k = 0; k < p; k++) A[r][k] -= f * A[i][k]; b[r] -= f * b[i]; } }
  const coef = b.map((v, i) => v / A[i][i]);
  const mean = k => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  const yhat = X.map(x => x.reduce((a, v, i) => a + v * coef[i], 0)), ybar = y.reduce((a, v) => a + v, 0) / y.length;
  const r2 = 1 - y.reduce((a, v, i) => a + (v - yhat[i]) ** 2, 0) / y.reduce((a, v) => a + (v - ybar) ** 2, 0);
  const out = { samples: rows.length, r2: +r2.toFixed(3), base: Math.round(Math.exp(coef[0])) };
  keys.forEach((k, i) => { out[k] = { perUnit: +((Math.exp(coef[i + 1]) - 1) * 100).toFixed(1) + '%', mean: +mean(k).toFixed(2), liftAtMean: 'x' + Math.exp(coef[i + 1] * mean(k)).toFixed(2) }; });
  return out;
}
if (process.env.BS_WORKER) { process.send(play(N)); }
else {
  const all = []; let left = jobs; const t0 = Date.now();
  for (let j = 0; j < jobs; j++) {
    const n = Math.floor(N / jobs) + (j < N % jobs ? 1 : 0);
    const w = fork(__filename, [String(n), String(ht), '1'], { env: Object.assign({}, process.env, { BS_WORKER: '1' }) });
    w.on('message', res => all.push(...res));
    w.on('exit', () => { if (--left === 0) {
      const ok = all.filter(r => !r.err); fs.writeFileSync('out/build-sweep.json', JSON.stringify(ok));
      console.log(JSON.stringify({ errs: all.length - ok.length, firstErr: all.find(r => r.err)?.err, secs: Math.round((Date.now() - t0) / 1000) }));
      console.log(JSON.stringify(regress(ok), null, 1));
      // medians by level of each factor
      const med = a => { a = [...a].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
      for (const k of ['tricksHeld', 'knacks', 'dims', 'sel', 'improves', 'rungs', 'buffs']) {
        const by = {}; ok.forEach(r => (by[r[k]] = by[r[k]] || []).push(r.score));
        console.log(k, Object.keys(by).sort((a, b) => a - b).map(v => v + ':' + Math.round(med(by[v]))).join(' '));
      }
    } });
  }
}
