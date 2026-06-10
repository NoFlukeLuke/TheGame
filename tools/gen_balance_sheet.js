// gen_balance_sheet.js
// Reads the three entity pools (BONUS_POOL, TOTEM_POOL, JOKER_POOL) straight out
// of index.html, classifies each entity, and writes balance_sheet.csv.
//
// WHY THIS EXISTS: the game's numbers live inside the `desc` strings and the
// scoring functions (calcScore / applyJokerGridEffect), not as editable data.
// This sheet is a planning/catalog tool for a balance sweep — edit it, then we
// apply the changes back into index.html in a follow-up pass.
//
// Run:  node tools/gen_balance_sheet.js
// Out:  balance_sheet.csv  (open in Excel / Google Sheets)

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Pull out a `const NAME = [ ... ];` array literal and eval it to a real array.
function extractArray(name) {
  const re = new RegExp('const\\s+' + name + '\\s*=\\s*(\\[[\\s\\S]*?\\n\\]);');
  const m = html.match(re);
  if (!m) throw new Error('could not find ' + name);
  // eslint-disable-next-line no-eval
  return eval(m[1]);
}

const BONUS_POOL = extractArray('BONUS_POOL');
const TOTEM_POOL = extractArray('TOTEM_POOL');
const JOKER_POOL = extractArray('JOKER_POOL');

// BAL holds the tunable numbers (see index.html). params_json column.
function extractBAL() {
  const m = html.match(/const BAL = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error('could not find BAL');
  // eslint-disable-next-line no-eval
  return eval('(' + m[1] + ')');
}
const BAL = extractBAL();

// Render the same templated descriptions the game shows at runtime, so the
// sheet's description column matches in-game text.
let DESC_TEMPLATES = {};
const dtMatch = html.match(/const DESC_TEMPLATES = (\{[\s\S]*?\n\});/);
if (dtMatch) DESC_TEMPLATES = eval('(' + dtMatch[1] + ')'); // eslint-disable-line no-eval
function renderDesc(id, fallback) {
  if (DESC_TEMPLATES[id] && BAL[id]) {
    return DESC_TEMPLATES[id].replace(/\{(\w+)\}/g, (m, k) => (k in BAL[id] ? BAL[id][k] : m));
  }
  return fallback;
}

const paramsJson = id => (id in BAL) ? JSON.stringify(BAL[id]) : '';
const usedBalKeys = new Set();
function pj(id) { if (id in BAL) usedBalKeys.add(id); return paramsJson(id); }

// ── Suggested base cost by rarity/tier (a starting point for the sweep) ──
const COST_BY_TIER = { common: 3, rare: 6, legendary: 9 };

// ── Heuristic classifiers ─────────────────────────────────────────────────
// buffType = the PRIMARY mechanical effect (what the number does).
// We look at tags first, then keywords in the description.
function classifyBuffType(desc, tags) {
  const d = desc.toLowerCase();
  const t = new Set(tags || []);
  if (t.has('wildrank') || t.has('wildsuit') || /\bwild (rank|suit)\b/.test(d)) return 'wildcard';
  if (t.has('exalt') || t.has('corrupt') || /exalt|corrupt/.test(d)) return 'exalt/corrupt';
  if (t.has('boss') || /boss effects/.test(d)) return 'boss';
  if (t.has('challenge') || /challenge/.test(d)) return 'challenge';
  if (t.has('retrigger') || /retrigger|trigger their effects|trigger .* twice|once more/.test(d)) return 'retrigger';
  if (/×\s*\d|x\d|multipl(y|ies) score|double their pips|÷ 2|score ×|×their|× their/.test(d)) return 'score-multiplier';
  if (t.has('mult') || /\bmult\b/.test(d)) return 'mult';
  if (t.has('pips') || /\bpip/.test(d)) return 'pips';
  if (t.has('coins') || /\bcoin|interest/.test(d)) return 'coins';
  if (t.has('focus') || /\bfocus\b/.test(d)) return 'focus';
  if (t.has('resource') || /\bswap|\bdiscard/.test(d)) return 'resource';
  if (t.has('time') || /second|timer|pause/.test(d)) return 'time';
  return 'utility';
}

// trigger = WHAT causes the effect to fire / what it keys off of.
// Rank words only (no bare digits — avoids matching "2× time" etc.).
const RANK_RE = /\b(aces?|jacks?|queens?|kings?|face cards?|sevens?|sixes?|fives?|fours?|threes?|twos?|nines?|eights?|tens?|7s|9s|8s|6s|5s)\b/;
function classifyTrigger(desc, tags, activation) {
  const d = desc.toLowerCase();
  const t = new Set(tags || []);
  if (t.has('position') || t.has('shape') || t.has('grid') ||
      /\brow\b|column|corner|edge|adjacent|center|2×2|cross|grid|intersection|spanning/.test(d)) return 'spatial';
  if (t.has('suit') || /♠|♥|♦|♣|each suit|all-♠|spade|heart|diamond|club/.test(d)) return 'suit-specific';
  if (RANK_RE.test(d)) return 'card-specific';
  // specific hand types
  if (/run of|straight|flush|full house|two pair|three of a kind|four of a kind|\bpair\b|sandwich|high card|royal|blackjack|total exactly 21/.test(d)) return 'hand-type';
  if (/\d-card|cards total|hand size|4-card|5-card|each card in/.test(d)) return 'hand-size';
  if (/streak|same hand|in a row|consecutive|twice in a row/.test(d)) return 'streak';
  if (/\bswap/.test(d)) return 'on-swap';
  if (/\bdiscard/.test(d)) return 'on-discard';
  if (/first \d+s|last \d+s|seconds elapsed|every \d+ seconds|timer|round time|round start|start (each|of every) round/.test(d)) return 'time-based';
  if (activation) return activation; // jokers: wildcard / on_play / on_draw etc.
  return 'always / passive';
}

// Category flags — a card can belong to several. These are the "couple of
// columns" for slicing the sweep. 1 = applies, blank = doesn't.
const CATEGORIES = [
  'hand_type', 'hand_size', 'spatial', 'card_specific', 'suit_specific',
  'time', 'money', 'discard_swap', 'play', 'focus', 'scaling', 'retrigger',
];
function classifyCategories(desc, tags) {
  const d = desc.toLowerCase();
  const t = new Set(tags || []);
  const c = {};
  c.hand_type     = /run of|straight|flush|full house|two pair|three of a kind|four of a kind|\bpair\b|sandwich|high card|royal|blackjack|21/.test(d) || t.has('hand') ? 1 : '';
  c.hand_size     = /\d-card|hand size|cards total|all-♠ hands|run of [45]/.test(d) ? 1 : '';
  c.spatial       = t.has('position') || t.has('shape') || t.has('grid') || /row|column|corner|edge|adjacent|center|grid|intersection|spanning|2×2/.test(d) ? 1 : '';
  c.card_specific = /\b(ace|jack|queen|king|face card|sevens?|7s|sixes?|fives?|fours?|threes?|twos?|nines?|eights?|tens?)\b/.test(d) || t.has('value') ? 1 : '';
  c.suit_specific = t.has('suit') || /♠|♥|♦|♣|spade|heart|diamond|club/.test(d) ? 1 : '';
  c.time          = t.has('time') || t.has('focus') === false && /second|timer|pause|\b\d+s\b|elapsed/.test(d) ? 1 : '';
  c.money         = t.has('coins') || /\bcoin|interest|♦ scored earns/.test(d) ? 1 : '';
  c.discard_swap  = t.has('resource') || /swap|discard|reserves/.test(d) ? 1 : '';
  c.play          = /each hand played|hand played|per hand|when .* scored|every hand/.test(d) ? 1 : '';
  c.focus         = t.has('focus') ? 1 : '';
  c.scaling       = t.has('scaling') || /permanently|each level|streak|carry over|stack/.test(d) ? 1 : '';
  c.retrigger     = t.has('retrigger') || /retrigger/.test(d) ? 1 : '';
  return c;
}

// ── CSV assembly ────────────────────────────────────────────────────────────
const headers = [
  'entity_type', 'id', 'name', 'params_json', 'rarity', 'base_cost',
  'buff_type', 'trigger', 'activation', 'charges',
  ...CATEGORIES.map(c => 'cat_' + c),
  'tags', 'description', 'notes',
];

function esc(v) {
  if (v === undefined || v === null) v = '';
  v = String(v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

const rows = [];

const STRUCTURAL = 'structural — no tunable value';

BONUS_POOL.forEach(b => {
  const cats = classifyCategories(b.desc, b.tags);
  const p = pj(b.id);
  rows.push([
    'Bonus Card', b.id, b.name, p, b.tier, COST_BY_TIER[b.tier] ?? '',
    classifyBuffType(b.desc, b.tags), classifyTrigger(b.desc, b.tags, null), '', '',
    ...CATEGORIES.map(c => cats[c]),
    (b.tags || []).join(' '), renderDesc(b.id, b.desc), p ? '' : STRUCTURAL,
  ]);
});

JOKER_POOL.forEach(j => {
  const cats = classifyCategories(j.desc, j.tags);
  const p = pj(j.id);
  const note = [p ? '' : STRUCTURAL, j.needsResolve ? 'needsResolve / TBD' : ''].filter(Boolean).join('; ');
  rows.push([
    'Joker', j.id, j.name, p, j.rarity, COST_BY_TIER[j.rarity] ?? '',
    classifyBuffType(j.desc, j.tags), classifyTrigger(j.desc, j.tags, j.activation),
    j.activation, j.durability,
    ...CATEGORIES.map(c => cats[c]),
    (j.tags || []).join(' '), renderDesc(j.id, j.desc), note,
  ]);
});

TOTEM_POOL.forEach(t => {
  const cats = classifyCategories(t.desc, t.tags);
  const p = pj(t.id);
  rows.push([
    'Totem', t.id, t.name, p, '', '',
    classifyBuffType(t.desc, t.tags), classifyTrigger(t.desc, t.tags, null), '', 'persistent',
    ...CATEGORIES.map(c => cats[c]),
    (t.tags || []).join(' '), renderDesc(t.id, t.desc), p ? '' : STRUCTURAL,
  ]);
});

// System knobs in BAL not tied to a pool entity (suit defaults, exalt/corrupt,
// resource time costs, plus any phantom bonuses referenced only in code).
const SYSTEM_DESC = {
  _suit_defaults: 'Default per-suit effects when no bonus is active',
  _resources:     'Base time costs: swap, discard/card, hand play',
  _exalt:         'Exalted-card per-suit effects',
  _corrupt:       'Corrupted-card per-suit effects',
  tidal_force:    'Flush +mult (not in current pool)',
  extinction:     'Four of a Kind ×score (not in current pool)',
};
Object.keys(BAL).filter(id => !usedBalKeys.has(id)).forEach(id => {
  const blank = CATEGORIES.map(() => '');
  rows.push([
    'System', id, id.replace(/^_/, '').replace(/_/g, ' '), JSON.stringify(BAL[id]), '', '',
    '', '', '', '',
    ...blank,
    '', SYSTEM_DESC[id] || '', '',
  ]);
});

const csv = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n') + '\n';
fs.writeFileSync(path.join(root, 'balance_sheet.csv'), csv);
console.log(`Wrote balance_sheet.csv — ${rows.length} entities ` +
  `(${BONUS_POOL.length} BCs, ${JOKER_POOL.length} jokers, ${TOTEM_POOL.length} totems).`);
