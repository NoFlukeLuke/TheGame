// r706: every live Trick's unlock rule, as a table. node tools/unlocks/list.js [--md]
const fs = require('fs');
const H = require('../sim/harness');
const G = H.load();
if (G.errors.length) { console.error('load errors', G.errors); process.exit(1); }
const rows = JSON.parse(G.eval(`JSON.stringify(TRICK_POOL_ALL.filter(t => t && !t.retired && !t.fused).map(t => {
  const r = trickUnlockRule(t.id);
  return { id: t.id, name: t.name, tier: t.tier, kind: !r ? 'NO RULE' : r.start ? 'start' : r.buy ? 'license' : r.unique ? 'unique' : 'goal',
    goal: !r || r.start ? '' : r.buy ? 'Licensing event' : unlockGoalText(t.id, false), desc: t.desc };
}))`));
const bad = JSON.parse(G.eval(`JSON.stringify(Object.keys(TRICK_UNLOCKS).filter(id => !TRICK_POOL_ALL.some(t => t.id === id && !t.retired)))`));
const noText = JSON.parse(G.eval(`JSON.stringify(Object.values(TRICK_UNLOCKS).filter(r => r.s && !UL_STAT_TEXT[r.s] && !r.text).map(r => r.s))`));
const order = ['common', 'rare', 'epic', 'legendary'];
rows.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
if (process.argv.includes('--md')) {
  console.log('| Trick | Tier | How | Goal | Verdict |\n|---|---|---|---|---|');
  rows.forEach(r => console.log(`| ${r.name} | ${r.tier} | ${r.kind} | ${r.goal} | |`));
} else {
  const c = {}; rows.forEach(r => { const k = r.tier + ' ' + r.kind; c[k] = (c[k] || 0) + 1; });
  console.log(c); console.log('rules for no live Trick:', bad); console.log('stats with no words:', noText);
  rows.filter(r => r.kind === 'NO RULE').forEach(r => console.log('NO RULE', r.tier, r.id, r.name));
}
