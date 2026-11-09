// Synergy probe (r733): one 3-minute round at level 1 under set builds, many times each.
//   node probes/synergy.js <rounds per condition> <handTime>   (from tools/sim)
// Conditions: 4 random Tricks; 4 Tricks sharing one WHEN tag (set / run / flush / size / rank /
// suit / position; the tag drawn at random each round); 4 random at v3; 4 random with 15 buffed
// deck cards; 4 random with Selection +1 and a row and a column; 4 random at v3 with the buffs and
// the limits. Median and quartiles of the round's score, so each lever can be read against random.
const fs = require('fs');
const N = +process.argv[2] || 150, ht = +process.argv[3] || 9;
const H = require(__dirname + '/../harness'); const G = H.load();
if (G.errors.length) { console.error(G.errors); process.exit(1); }
G.eval(fs.readFileSync(__dirname + '/../sim-core.js', 'utf8'));
G.eval(`SIM_CFG.handTime=${ht};
const SYN_TAGS=['set','run','flush','size','rank','suit','position'];
function SY_round(cond){
  ACTIVE_MODE=MODES.normal; startGame(); SIM_resetCharges();
  limits.trick_slots.current=8;
  let tag=null;
  if(cond.shared){ tag=SYN_TAGS[Math.floor(Math.random()*SYN_TAGS.length)];
    const pool=TRICK_POOL.filter(t=>!survivalEntityBanned(t.id)&&(t.tags||[]).includes(tag));
    for(let i=0;i<4&&pool.length;i++){ const owned=new Set(trickTray.map(t=>t.id)); const p=pickTrickByRarity(pool.filter(t=>!owned.has(t.id))); if(!p) break; try{injectTrickAfterReward({...p});}catch(e){} }
  } else { for(let i=0;i<4;i++) SIM_grant('trick',1); }
  if(cond.tier){ for(const t of trickTray){ try{ for(let k=0;k<cond.tier;k++) improveEntity(t.id); }catch(e){} } }
  if(cond.limits){ limits.selection.current+=1; limits.grid_rows.current++; limits.grid_cols.current++; }
  gridRows=limits.grid_rows.current; gridCols=limits.grid_cols.current;
  try{flushPlayedDeck();}catch(e){}
  if(cond.buffs){ const deck=drawPile.filter(c=>c&&!c._isSleight&&c.rank!==WILD_RANK); for(let i=0;i<cond.buffs&&deck.length;i++){ const c=deck.splice(Math.floor(Math.random()*deck.length),1)[0]; const e=rollEditorBuff(); if(e) enhanceCardKey(cardId(c),e); } }
  try{initGridData();}catch(e){}
  score=0; roundGoal=1e15; roundSeconds=180; swaps=3; discards=3;
  try{resetFocusMeter();}catch(e){}
  const res=SIM_playRound();
  return JSON.stringify({score:res.score,hands:res.hands,focus:res.avgFocus,tricks:trickTray.length,tag});
}`);
const CONDS = [
  ['4 random', {}], ['4 sharing a tag', { shared: 1 }], ['4 random at v3', { tier: 2 }],
  ['4 random + 15 buffed cards', { buffs: 15 }], ['4 random + Selection +1, +1 row, +1 col', { limits: 1 }],
  ['4 random, v3, buffs, limits', { tier: 2, buffs: 15, limits: 1 }],
];
const q = (a, f) => { a = [...a].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * f))]; };
for (const [name, cond] of CONDS) {
  const rows = []; for (let i = 0; i < N; i++) { try { rows.push(JSON.parse(G.eval(`SY_round(${JSON.stringify(cond)})`))); } catch (e) {} }
  const sc = rows.map(r => r.score);
  const byTag = {}; rows.forEach(r => { if (r.tag) (byTag[r.tag] = byTag[r.tag] || []).push(r.score); });
  console.log(JSON.stringify({ cond: name, n: rows.length, q25: q(sc, .25), med: q(sc, .5), q75: q(sc, .75), q90: q(sc, .9), tricks: +(rows.reduce((a, r) => a + r.tricks, 0) / rows.length).toFixed(1),
    byTag: Object.keys(byTag).length ? Object.fromEntries(Object.entries(byTag).map(([k, v]) => [k, q(v, .5) + ' (' + v.length + ')'])) : undefined }));
}
