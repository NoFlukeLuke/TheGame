const fs=require('fs');const H=require(__dirname + "/../harness");
const G=H.load(); if(G.errors.length){console.error(G.errors);process.exit(1);}
G.eval(fs.readFileSync(__dirname + "/../sim-core.js",'utf8'));
const N=+process.argv[2]||40, ht=+process.argv[3]||6;
G.eval(`SIM_CFG.handTime=${ht};
function SIM_goal(lv){return goalForLevel(lv);}
function FM_run(){
  ACTIVE_MODE = MODES.flow; startGame(); SIM_resetCharges();
  roundGoal=SIM_goal(1); const out=[]; let bossesLog=[];
  for (let guard=0; guard<400; guard++){
    const t0=roundSeconds; const res=SIM_playRound();
    if (res.cleared && roundSeconds>0){
      let n=1; try{n=flowrRollCount();}catch(e){}
      const kinds=[]; for(let i=0;i<n;i++){ let k='pick3'; try{k=flowrRollKind(flowrOddsNow());}catch(e){} kinds.push(k); SIM_flowReward(k); }
      out.push({lv:level,goal:roundGoal,secs:t0-roundSeconds,hands:res.hands,focus:res.avgFocus,rewards:kinds,tricks:trickTray.length,knacks:acquiredKnacks.length,sel:limits.selection.current,rows:limits.grid_rows.current,cols:limits.grid_cols.current});
      SIM_levelUp(SIM_goal); continue;
    }
    score=0; roundGoal=SIM_goal(flowBossGoalLevel());
    const rr=computeRoundResources(); swaps=rr.swaps; discards=rr.discards; roundSeconds=FLOW_BOSS_WINDOW;
    try{resetFocusMeter();}catch(e){} try{flushPlayedDeck();initGridData();}catch(e){}
    const boss=SIM_playRound();
    bossesLog.push({boss:survivalBossesBeaten+1,atLevel:level,goal:roundGoal,score:boss.score,cleared:boss.cleared,tricks:trickTray.length,nsStep:Math.max(nsFamStep('set'),nsFamStep('run'),nsFamStep('flush'))});
    if(!boss.cleared) break;
    survivalBossesBeaten++; if(survivalBossesBeaten>=SURVIVAL_BOSS_COUNT) break;
    SIM_grantWeighted({ trick: 60, knack: 20, sleight: 20 }); SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 });
    flowRefillClock=true; SIM_levelUp(SIM_goal);
  }
  return JSON.stringify({levels:out,bosses:bossesLog,win:survivalBossesBeaten>=SURVIVAL_BOSS_COUNT});
}`);
const runs=[]; for(let i=0;i<N;i++){ try{ runs.push(JSON.parse(G.eval('FM_run()'))); }catch(e){ console.error('run err',String(e).slice(0,200)); } }
fs.writeFileSync('flow-miles.json', JSON.stringify(runs));
const med=a=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
console.log('wins',runs.filter(r=>r.win).length,'/',runs.length);
for(let b=1;b<=4;b++){ const B=runs.map(r=>r.bosses.find(x=>x.boss===b)).filter(Boolean); if(!B.length) continue; console.log(JSON.stringify({boss:b,reached:B.length,atLevel:med(B.map(x=>x.atLevel)),goal:med(B.map(x=>x.goal)),medScore:Math.round(med(B.map(x=>x.score))),clear:Math.round(100*B.filter(x=>x.cleared).length/B.length),tricks:med(B.map(x=>x.tricks)),ns:med(B.map(x=>x.nsStep))})); }
for(let lv=1;lv<=30;lv++){ const L=runs.map(r=>r.levels.find(x=>x.lv===lv)).filter(Boolean); if(L.length<5) continue; const rw={}; L.forEach(x=>x.rewards.forEach(k=>rw[k]=(rw[k]||0)+1)); console.log(JSON.stringify({lv,n:L.length,goal:med(L.map(x=>x.goal)),secs:med(L.map(x=>x.secs)),hands:med(L.map(x=>x.hands)),focus:med(L.map(x=>x.focus)),tricks:med(L.map(x=>x.tricks)),knacks:med(L.map(x=>x.knacks)),sel:med(L.map(x=>x.sel)),rewardsPer:+(L.reduce((a,x)=>a+x.rewards.length,0)/L.length).toFixed(2),rw})); }
