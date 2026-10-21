// Loads tags.js then the three data files in one scope and checks every row:
// non-empty tags, every id in TAG_DEFS, exactly one SCOPE tag. Prints counts.
const fs = require('fs');
const R = require('path').join(__dirname, '..') + '/';
const code = ['js/data/tags.js', 'js/data/tricks.js', 'js/data/sleights.js', 'js/data/knacks.js']
  .map(f => fs.readFileSync(R + f, 'utf8')).join('\n');
const stubs = 'const KNACK_BOSS_GROW_PCT = 60; const BASE_GOAL = 0;\n';
const fn = new Function(stubs + code + '\nreturn { TAG_DEFS, TAG_BY_ID, TRICK_POOL, SLEIGHT_POOL, KNACK_POOL };');
const { TAG_DEFS, TAG_BY_ID, TRICK_POOL, SLEIGHT_POOL, KNACK_POOL } = fn();

let bad = 0;
const counts = {};
TAG_DEFS.forEach(d => { counts[d.id] = { tricks: 0, sleights: 0, knacks: 0 }; });
function check(pool, name) {
  pool.forEach(r => {
    const t = r.tags;
    if (!Array.isArray(t) || !t.length) { console.log(`${name}/${r.id}: no tags`); bad++; return; }
    const unknown = t.filter(x => !TAG_BY_ID[x]);
    if (unknown.length) { console.log(`${name}/${r.id}: unknown ${unknown.join(',')}`); bad++; }
    const dup = t.filter((x, i) => t.indexOf(x) !== i);
    if (dup.length) { console.log(`${name}/${r.id}: duplicate ${dup.join(',')}`); bad++; }
    const scope = t.filter(x => TAG_BY_ID[x] && TAG_BY_ID[x].group === 'scope');
    if (scope.length !== 1) { console.log(`${name}/${r.id}: ${scope.length} scope tags (${scope.join(',')})`); bad++; }
    // rule check: pips/mult/xpips/xmult/replay in PAYS => scores in HOW
    const scoring = t.some(x => ['pips', 'mult', 'xpips', 'xmult', 'replay'].includes(x));
    if (scoring && !t.includes("scores")) { console.log(`${name}/${r.id}: scoring PAYS without scores (${t.join(",")})`); bad++; }
    if (!scoring && t.includes("scores")) console.log(`note ${name}/${r.id}: scores with no pips/mult/replay PAYS (${t.join(",")})`);
    t.forEach(x => { if (counts[x]) counts[x][name]++; });
  });
  console.log(`${name}: ${pool.length} rows`);
}
check(TRICK_POOL, 'tricks');
check(SLEIGHT_POOL, 'sleights');
check(KNACK_POOL, 'knacks');
console.log(bad ? `FAIL ${bad}` : 'ALL OK');
console.log('\ntag | tricks | sleights | knacks | total');
let zero = [];
TAG_DEFS.forEach(d => {
  const c = counts[d.id]; const tot = c.tricks + c.sleights + c.knacks;
  console.log(`${d.group}/${d.id} | ${c.tricks} | ${c.sleights} | ${c.knacks} | ${tot}`);
  if (!tot) zero.push(d.id);
});
console.log('zero-row tags:', zero.length ? zero.join(', ') : 'none');
if (process.argv[2] === '--tables') {
  const esc = s => String(s).replace(/\|/g, '\\|');
  const table = (pool, title) => {
    let s = `\n## ${title} (${pool.length})\n\n| id | name | desc (first 70) | tags |\n|---|---|---|---|\n`;
    pool.forEach(r => { s += `| ${r.id}${r.retired ? ' (retired)' : ''} | ${esc(r.name)} | ${esc(r.desc.slice(0, 70))} | ${r.tags.join(' ')} |\n`; });
    return s;
  };
  fs.writeFileSync(process.argv[3], table(TRICK_POOL, 'TRICK_POOL') + table(SLEIGHT_POOL, 'SLEIGHT_POOL') + table(KNACK_POOL, 'KNACK_POOL'));
}
process.exit(bad ? 1 : 0);
