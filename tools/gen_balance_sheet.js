// gen_balance_sheet.js
// Reads the three entity pools (TRICK_POOL, KNACK_POOL, SLEIGHT_POOL) straight
// out of js/data/*.js, classifies each entity, and writes balance_sheet.csv.
//
// WHY THIS EXISTS: the game's numbers live inside the `desc` strings and the
// scoring functions (calcScore / applySleightGridEffect), not as editable data.
// This sheet is a planning/catalog tool for a balance sweep — edit it, then
// apply the changes back into js/data/balance.js in a follow-up pass.
//
// The game used to be one giant index.html; it is now split into many small
// files (see CLAUDE.md "File layout"). The three pools live in
// js/data/tricks.js, js/data/knacks.js, js/data/sleights.js, and the tunable
// numbers (BAL) + rendered descriptions (DESC_TEMPLATES) live in
// js/data/balance.js. This script reads each file directly rather than
// index.html, which is now just the skeleton of <script> tags.
//
// Run:  node tools/gen_balance_sheet.js
// Out:  balance_sheet.csv  (open in Excel / Google Sheets)

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const tricksSrc   = read('js/data/tricks.js');
const knacksSrc   = read('js/data/knacks.js');
const sleightsSrc = read('js/data/sleights.js');
const balanceSrc  = read('js/data/balance.js');

// Pull out a `const NAME = [ ... ];` array literal (or `{ ... }` object
// literal) and eval it to a real value.
function extract(src, name, open, close) {
  const re = new RegExp('const\\s+' + name + '\\s*=\\s*(' +
    open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?\\n' +
    close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\s*;');
  const m = src.match(re);
  if (!m) throw new Error('could not find ' + name);
  // eslint-disable-next-line no-eval
  return eval('(' + m[1] + ')');
}
const extractArray  = (src, name) => extract(src, name, '[', ']');
const extractObject = (src, name) => extract(src, name, '{', '}');

const TRICK_POOL   = extractArray(tricksSrc, 'TRICK_POOL');
const KNACK_POOL   = extractArray(knacksSrc, 'KNACK_POOL');
const SLEIGHT_POOL = extractArray(sleightsSrc, 'SLEIGHT_POOL');

// BAL holds the tunable numbers (js/data/balance.js). params_json column.
// Tolerant of a missing BAL (e.g. before the round-trip refactor is applied).
function extractBAL() {
  try { return extractObject(balanceSrc, 'BAL'); } catch (e) { return {}; }
}
const BAL = extractBAL();

// Render the same templated descriptions the game shows at runtime, so the
// sheet's description column matches in-game text. Mirrors fillDescTemplate
// in js/data/balance.js: {key} prints the raw value, {key_pct} prints it as a
// percentage.
let DESC_TEMPLATES = {};
try { DESC_TEMPLATES = extractObject(balanceSrc, 'DESC_TEMPLATES'); } catch (e) { /* left empty */ }
function fillDescTemplate(t, p) {
  return t.replace(/\{(\w+)\}/g, (m, k) => {
    if (k in p) return p[k];
    if (k.endsWith('_pct')) { const b = k.slice(0, -4); if (b in p) return Math.round(p[b] * 100); }
    return m;
  });
}
function renderDesc(id, fallback) {
  if (DESC_TEMPLATES[id] && BAL[id]) return fillDescTemplate(DESC_TEMPLATES[id], BAL[id]);
  return fallback;
}

const paramsJson = id => (id in BAL) ? JSON.stringify(BAL[id]) : '';
const usedBalKeys = new Set();
function pj(id) { if (id in BAL) usedBalKeys.add(id); return paramsJson(id); }

// ── Suggested base cost by rarity/tier (a starting point for the sweep) ──
const COST_BY_TIER = { common: 3, rare: 6, epic: 9, legendary: 12 };

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
  if (t.has('retrigger') || /retrigger|trigger their effects|trigger .* twice|once more|replays?\b/.test(d)) return 'retrigger';
  if (/×\s*\d|x\d|multipl(y|ies) score|double their pips|÷ 2|score ×|×their|× their/.test(d)) return 'score-multiplier';
  if (t.has('mult') || /\bmult\b/.test(d)) return 'mult';
  if (t.has('pips') || /\bpip/.test(d)) return 'pips';
  if (t.has('coins') || /\bcoin|interest|credits?\b/.test(d)) return 'coins';
  if (t.has('focus') || /\bfocus\b/.test(d)) return 'focus';
  if (t.has('resource') || /\bswap|\bdiscard/.test(d)) return 'resource';
  if (t.has('time') || /second|timer|pause|clock/.test(d)) return 'time';
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
  if (activation) return activation; // sleights: wildcard / on_play / on_draw etc.
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
  c.time          = t.has('time') || /second|timer|pause|\b\d+s\b|elapsed|clock/.test(d) ? 1 : '';
  c.money         = t.has('coins') || /\bcoin|interest|credits?\b/.test(d) ? 1 : '';
  c.discard_swap  = t.has('resource') || /swap|discard|reserves/.test(d) ? 1 : '';
  c.play          = /each hand played|hand played|per hand|when .* scored|every hand/.test(d) ? 1 : '';
  c.focus         = t.has('focus') ? 1 : '';
  c.scaling       = t.has('scaling') || /permanently|each level|streak|carry over|stack|scales?\b/.test(d) ? 1 : '';
  c.retrigger     = t.has('retrigger') || /retrigger|replays?\b/.test(d) ? 1 : '';
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

// Tricks (formerly "Bonus Cards") carry `tier`; Sleights and Knacks (formerly
// "Jokers" / "Totems") carry `rarity`. See CLAUDE.md "Rarity: four tiers,
// three ladders" — the ids are frozen but which field holds the tier differs
// by pool, and that has not changed since the r197 rename.
TRICK_POOL.forEach(b => {
  const cats = classifyCategories(b.desc, b.tags);
  const p = pj(b.id);
  rows.push([
    'Trick', b.id, b.name, p, b.tier, COST_BY_TIER[b.tier] ?? '',
    classifyBuffType(b.desc, b.tags), classifyTrigger(b.desc, b.tags, null), '', '',
    ...CATEGORIES.map(c => cats[c]),
    (b.tags || []).join(' '), renderDesc(b.id, b.desc), p ? '' : STRUCTURAL,
  ]);
});

SLEIGHT_POOL.forEach(j => {
  const cats = classifyCategories(j.desc, j.tags);
  const p = pj(j.id);
  const note = [p ? '' : STRUCTURAL, j.needsResolve ? 'needsResolve / TBD' : ''].filter(Boolean).join('; ');
  rows.push([
    'Sleight', j.id, j.name, p, j.rarity, COST_BY_TIER[j.rarity] ?? '',
    classifyBuffType(j.desc, j.tags), classifyTrigger(j.desc, j.tags, j.activation),
    j.activation, j.durability,
    ...CATEGORIES.map(c => cats[c]),
    (j.tags || []).join(' '), renderDesc(j.id, j.desc), note,
  ]);
});

KNACK_POOL.forEach(t => {
  const cats = classifyCategories(t.desc, t.tags);
  const p = pj(t.id);
  rows.push([
    'Knack', t.id, t.name, p, t.rarity, COST_BY_TIER[t.rarity] ?? '',
    classifyBuffType(t.desc, t.tags), classifyTrigger(t.desc, t.tags, null), '', 'persistent',
    ...CATEGORIES.map(c => cats[c]),
    (t.tags || []).join(' '), renderDesc(t.id, t.desc), p ? '' : STRUCTURAL,
  ]);
});

// System / event knobs in BAL not tied to a pool entity: suit exalt/corrupt
// effects, base interact time costs, and per-event tuning blocks (Rehearsal,
// the Card Market, the Schedule's cadence, etc.) that live in BAL alongside
// the entity numbers but have no TRICK_POOL/SLEIGHT_POOL/KNACK_POOL id.
const SYSTEM_DESC = {
  _resources: 'Base interact costs and unspent-action/interest payout caps',
  _exalt:     'Exalted-card per-suit effects (paused by default - see exaltCorruptEnabled)',
  _corrupt:   'Corrupted-card per-suit effects (paused by default - see exaltCorruptEnabled)',
};
Object.keys(BAL).filter(id => !usedBalKeys.has(id)).forEach(id => {
  const blank = CATEGORIES.map(() => '');
  rows.push([
    'System', id, id.replace(/^_/, '').replace(/_/g, ' '), JSON.stringify(BAL[id]), '', '',
    '', '', '', '',
    ...blank,
    '', SYSTEM_DESC[id] || '', SYSTEM_DESC[id] ? '' : 'event/system tuning block, not an entity',
  ]);
});

const csv = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n') + '\n';
fs.writeFileSync(path.join(root, 'balance_sheet.csv'), csv);
console.log(`Wrote balance_sheet.csv — ${rows.length} entities ` +
  `(${TRICK_POOL.length} tricks, ${SLEIGHT_POOL.length} sleights, ${KNACK_POOL.length} knacks).`);
