const fs=require('fs');const H=require(__dirname + "/../harness");
const G=H.load(); if(G.errors.length){console.error(G.errors);process.exit(1);}
G.eval(fs.readFileSync(__dirname + "/../sim-core.js",'utf8'));
const N=+process.argv[2]||150, ht=+process.argv[3]||6;
G.eval(`SIM_CFG.handTime=${ht};
function M_round(nTricks, secs, nsOff){
  ACTIVE_MODE=MODES.normal; startGame(); SIM_resetCharges();
  limits.grid_rows.current=4; limits.grid_cols.current=4; gridRows=4; gridCols=4;
  try{flushPlayedDeck();initGridData();}catch(e){}
  const ids=[];
  for(let i=0;i<nTricks;i++){ const owned=new Set(trickTray.map(t=>t.id)); const pool=TRICK_POOL.filter(t=>!owned.has(t.id)&&!survivalEntityBanned(t.id)); const p=pickTrickByRarity(pool); if(p){try{ if(trickTray.length>=trickCapacity()) limits.trick_slots.current++; injectTrickAfterReward({...p}); ids.push(p.id+'/'+(p.tier||p.rarity||'c')[0]);}catch(e){}} }
  if(nsOff){ nsHandGrowth=function(){return {step:0,pips:0};}; }
  score=0; roundGoal=1e15; roundSeconds=secs; swaps=3; discards=3;
  try{resetFocusMeter();}catch(e){}
  const res=SIM_playRound();
  return JSON.stringify({ids,score:res.score,hands:res.hands,focus:res.avgFocus});
}`);
const med=a=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
const q=(a,f)=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length*f)];};
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const rows=[];
for(const n of [0,1,2,3,4,5,6,8,10]){ const L=[]; for(let i=0;i<N;i++) L.push(JSON.parse(G.eval(`M_round(${n},180,false)`))); const sc=L.map(r=>r.score); rows.push({n,med:Math.round(med(sc)),q25:Math.round(q(sc,.25)),q75:Math.round(q(sc,.75)),q90:Math.round(q(sc,.9)),avg:Math.round(avg(sc)),focus:+avg(L.map(r=>r.focus)).toFixed(2),hands:+avg(L.map(r=>r.hands)).toFixed(1)}); console.log(JSON.stringify(rows[rows.length-1])); }
