// Trick sheet dump (r620). Loads the shipped game through the sim harness and
// writes one JSON record per Trick of a tier: id, name, tier, category, the
// live description (BAL applied), every number in BAL with its template, tags.
// tools/trick-sheet.py turns it into the spreadsheet for a balance pass.
//
//   node tools/trick-sheet.js [common|rare|epic|legendary|all] [--out file.json]
const fs = require('fs');
const path = require('path');
const { load } = require('./sim/harness');

const args = process.argv.slice(2);
const tier = args.find(a => !a.startsWith('--')) || 'common';
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args[outAt + 1] : path.join(__dirname, 'sim', 'out', `tricks-${tier}.json`);

const G = load();
if (G.errors.length) { console.error('game load errors', G.errors); process.exit(1); }
try { G.eval('applyEntityTiers()'); } catch (e) {}

// A word for each category row of TRICK_CATEGORIES (keyed by its emoji).
const CAT_WORD = { '🪜': 'Runs', '👯': 'Pairs / sets', '🎴': 'Flush / hand shape', '👑': 'Rank', '🌱': 'Per-card pips',
  '⏱️': 'Timing', '🔥': 'Streaks', '🎨': 'Suits', '🔢': 'Numbers', '🌈': 'Rank spread', '📍': 'Position', '📈': 'Level',
  '🧮': 'Accumulating', '🎲': 'Situational', '🔀': 'Variety', '🎯': 'Focus', '⭐': 'Misc', '💎': 'Multipliers',
  '🐦': 'Birds (timing)', '3️⃣': '3-card hands', '4️⃣': '4-card hands', '5️⃣': '5-card hands', '🪄': 'Sleights', '🗑️': 'Discards' };

const rows = G.eval(`(() => {
  const list = TRICK_POOL_ALL.filter(t => t && !t.retired && (${JSON.stringify(tier)} === 'all' || t.tier === ${JSON.stringify(tier)}));
  return list.map(t => {
    const b = (typeof BAL_BASE !== 'undefined' && BAL_BASE[t.id]) || null;
    const nums = b ? Object.keys(b).filter(k => typeof b[k] === 'number').map(k => ({ key: k, value: b[k] })) : [];
    return { id: t.id, name: t.name, tier: t.tier, emoji: trickEmoji(t), desc: t.desc,
      template: (typeof DESC_TEMPLATES !== 'undefined' && DESC_TEMPLATES[t.id]) || '', tags: t.tags || [], nums };
  });
})()`);
rows.forEach(r => { r.category = CAT_WORD[r.emoji] || 'Misc'; });
const build = G.eval('typeof BUILD !== "undefined" ? BUILD : ""');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ build, tier, tricks: rows }, null, 1));
console.log(`wrote ${out}: ${rows.length} ${tier} Tricks, ${rows.reduce((n, r) => n + r.nums.length, 0)} numbers`);
