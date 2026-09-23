// apply_balance_sheet.js
// Reads balance_sheet.csv and writes the edited params_json values back into the
// BAL config block in js/data/balance.js. The other half of the round-trip with
// gen_balance_sheet.js.
//
// It only touches values inside `const BAL = { ... }`. It preserves the block's
// order and comments — each entity's `{ ... }` is rewritten in place. Rows whose
// params_json is blank (structural entities) are skipped, as are ids not present
// in BAL.
//
// Run:  node tools/apply_balance_sheet.js
// Then validate + commit js/data/balance.js as usual (see the syntax-check
// command in CLAUDE.md "Workflow").

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const balPath = path.join(root, 'js/data/balance.js');
const csvPath = path.join(root, 'balance_sheet.csv');

let bal = fs.readFileSync(balPath, 'utf8');
const csv = fs.readFileSync(csvPath, 'utf8');

// ── tiny RFC-4180 CSV parser (handles quotes, escaped "", commas/newlines) ──
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\r') { /* ignore */ }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const table = parseCSV(csv).filter(r => r.length > 1 && r.some(c => c !== ''));
const header = table.shift();
const idIdx = header.indexOf('id');
const pjIdx = header.indexOf('params_json');
if (idIdx === -1 || pjIdx === -1) { console.error('CSV missing id/params_json columns'); process.exit(1); }

// id → params object (only rows that carry params)
const edits = {};
for (const r of table) {
  const id = r[idIdx];
  const raw = (r[pjIdx] || '').trim();
  if (!id || !raw) continue;
  try { edits[id] = JSON.parse(raw); }
  catch (e) { console.error(`Bad params_json for "${id}": ${raw}`); process.exit(1); }
}

// ── locate the BAL block ──
const balMatch = bal.match(/const BAL = \{[\s\S]*?\n\};/);
if (!balMatch) { console.error('could not find BAL block in js/data/balance.js'); process.exit(1); }
let balBlock = balMatch[0];

// current values (for change reporting)
// eslint-disable-next-line no-eval
const curBAL = eval('(' + balBlock.replace(/^const BAL = /, '').replace(/;\s*$/, '') + ')');

// serialize { k: v, ... } in JS-literal style (unquoted keys, raw numbers)
function serialize(obj) {
  return '{ ' + Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ') + ' }';
}

let changed = 0, skipped = [], notFound = [];
for (const [id, params] of Object.entries(edits)) {
  const re = new RegExp('(^\\s*' + id.replace(/[^A-Za-z0-9_]/g, '') + ':\\s*)\\{[^}]*\\}', 'm');
  if (!re.test(balBlock)) { notFound.push(id); continue; }
  const before = JSON.stringify(curBAL[id]);
  const after = JSON.stringify(params);
  if (before === after) { continue; }                     // no change
  balBlock = balBlock.replace(re, (_, lead) => lead + serialize(params));
  console.log(`  ${id}: ${before} → ${after}`);
  changed++;
}

if (changed > 0) {
  bal = bal.replace(balMatch[0], balBlock);
  fs.writeFileSync(balPath, bal);
}

console.log(`\nApplied ${changed} value change(s) to BAL in js/data/balance.js.`);
if (notFound.length) console.log(`Skipped (not in BAL / structural): ${notFound.join(', ')}`);
if (changed === 0) console.log('Nothing to update — sheet matches code.');
