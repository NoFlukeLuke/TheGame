const fs=require('fs');const H=require(__dirname + "/../harness");
const G=H.load(); if(G.errors.length){console.error(G.errors);process.exit(1);}
G.eval(fs.readFileSync(__dirname + "/../sim-core.js",'utf8'));
const N=+process.argv[2]||40, ht=+process.argv[3]||6, nsOff=process.argv[4]==='nsoff';
G.eval(`SIM_CFG.handTime=${ht};
function SIM_goal(lv){return goalForLevel(lv);}
function MS_run(){
  ACTIVE_MODE = MODES.map || MODES.normal; startGame(); SIM_resetCharges();
  if (typeof mapScreenOpen !== 'undefined' && mapScreenOpen) mapCloseScreen();
  ${nsOff ? "nsHandGrowth=function(){return {step:0,pips:0};};" : ""}
  const out=[]; let ents=0, tricks=0;
  const tiles=['level','level','level','hard','shop','event','level','event'];
  const qlen = mapQuarterLen();
  const cnt=()=>{ents=trickTray.length+acquiredKnacks.length; tricks=trickTray.length;};
  for (let q=1;q<=4;q++){
    for (let k=0;k<tiles.length;k++){
      const t=tiles[k];
      if (t==='level'||t==='hard'||t==='audit'){
        const lv=(q-1)*qlen+1+2*Math.floor(k/2)+(Math.random()<0.5?1:0);
        const goal=SIM_goal(lv)*(t==='hard'?1.25:1);
        roundGoal=1e15; const res=SIM_playRound(); cnt();
        out.push({lv,goal:Math.round(goal),score:res.score,focus:res.avgFocus,hands:res.hands,ents,tricks,nsStep:Math.max(nsFamStep('set'),nsFamStep('run'),nsFamStep('flush')),kind:t});
        roundGoal=goal; // level-up banks min(score,goal)
        if (t==='level') SIM_grantWeighted({ trick: 55, knack: 20, sleight: 25 }, 3);
        if (t==='hard') { SIM_grantWeighted({ trick: 55, knack: 15, sleight: 10, limit: 20 }); SIM_grantWeighted({ trick: 55, knack: 15, sleight: 10, limit: 20 }); }
        SIM_levelUp(SIM_goal);
      } else {
        if (t==='shop') { SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 }); SIM_improveRandomOwned(); }
        if (t==='event') { SIM_grantWeighted({ trick: 60, knack: 20, sleight: 20 }); }
        level++; roundGoal=SIM_goal(level);
      }
    }
    const lv=mapReviewLevel(q); const goal=SIM_goal(lv);
    roundGoal=1e15; const res=SIM_playRound(); cnt();
    out.push({lv,goal,score:res.score,focus:res.avgFocus,hands:res.hands,ents,tricks,nsStep:Math.max(nsFamStep('set'),nsFamStep('run'),nsFamStep('flush')),kind:'review'});
    roundGoal=goal;
    SIM_grantWeighted({ trick: 60, knack: 20, sleight: 20 }); SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 });
    SIM_levelUp(SIM_goal);
  }
  return JSON.stringify(out);
}`);
const runs=[]; for(let i=0;i<N;i++){ try{ runs.push(JSON.parse(G.eval('MS_run()'))); }catch(e){ console.error('run err',String(e).slice(0,200)); } }
fs.writeFileSync(process.argv[5]||'sched-miles.json', JSON.stringify(runs));
// per round index: median score, q25, q75, goal, clear %
const n=runs[0].length; const med=a=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];}; const q=(a,f)=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length*f)];};
for(let i=0;i<n;i++){ const R=runs.map(r=>r[i]).filter(Boolean); const sc=R.map(r=>r.score); const g=med(R.map(r=>r.goal)); console.log(JSON.stringify({i,kind:R[0].kind,lv:med(R.map(r=>r.lv)),goal:g,q25:Math.round(q(sc,.25)),med:Math.round(med(sc)),q75:Math.round(q(sc,.75)),clear:Math.round(100*R.filter(r=>r.score>=r.goal).length/R.length),ents:+(R.reduce((a,r)=>a+r.ents,0)/R.length).toFixed(1),tricks:+(R.reduce((a,r)=>a+r.tricks,0)/R.length).toFixed(1),focus:+(R.reduce((a,r)=>a+r.focus,0)/R.length).toFixed(2),ns:+(R.reduce((a,r)=>a+r.nsStep,0)/R.length).toFixed(1)})); }
