// ══════════════════════════════════════════════
// PROBABILITY TABLES (r409) - dev panel -> Probabilities
// ══════════════════════════════════════════════
// Every weighted roll in the game, editable live, each with a plain description
// of what it decides and how to tune it. The tables themselves stay where they
// are read (balance.js, survival.js, map-mode.js...); this file only edits them
// IN PLACE, so every reader sees a change with no edit at its site.
//
// Storage holds OVERRIDES ONLY (lethe.probTables.v1, keyed table -> row), the
// goal tuner's rule (r197): a row set back to its shipped value is deleted, so an
// untouched row tracks the code. The shipped values are snapshotted at load,
// BEFORE any override is applied, and that snapshot is what Reset returns to.
//
// Two kinds of table:
//   'w'  weights. Only the RATIOS matter; the share column is the real chance.
//   'p'  independent chances, 0-100%. Each row is rolled on its own.
// The Flow reward chain's tables keep their own editor (js/flow-rewards.js); its
// section is shown on this tab as well as on the Flow tab.

const PROB_KEY = 'lethe.probTables.v1';

// A row is { k, label, get, set }. Built from an object or an array so the
// table and the editor cannot disagree about which keys exist.
function _ptObjRows(obj, labels) {
  return Object.keys(obj).map(k => ({ k, label: (labels && labels[k]) || k,
    get: () => obj[k], set: v => { obj[k] = v; } }));
}
function _ptArrRows(arr, labels, from) {
  const out = [];
  for (let i = from || 0; i < arr.length; i++)
    out.push({ k: String(i), label: (labels && labels[i]) || String(i), get: () => arr[i], set: v => { arr[i] = v; } });
  return out;
}
const _PT_TIERS = ['Common', 'Rare', 'Epic', 'Legendary'];

const PROB_TABLES = [
  { id: 'tier', group: 'Rarity', type: 'w', title: 'Entity rarity',
    desc: 'The tier of every Trick, Sleight and Knack offered by the shop, the reward grid, every pick of three and the events. A tier is rolled first, then an entity of that tier is picked at random.',
    how: 'Only the ratios matter. Raise Legendary to see top-tier offers more often; lower Common to thin out the cheap ones. If the rolled tier has nothing left to offer, the roll steps down a tier, so the top tiers deliver a little under their share.',
    rows: () => _ptArrRows(ENTITY_TIER_W, _PT_TIERS) },
  { id: 'prize', group: 'Rarity', type: 'w', title: 'Prize grid rarity',
    desc: 'The same tier roll for the prize grid that follows a manager review. It is its own table so a review can pay better than an ordinary round.',
    how: 'Rare is the point of a prize grid; keep it the biggest share. Raise Epic/Legendary to make reviews feel more rewarding.',
    rows: () => _ptArrRows(PRIZE_TIER_W, _PT_TIERS) },
  { id: 'luck', group: 'Rarity', type: 'n', title: 'Luck tilt per tier',
    desc: 'How hard the Luck stat pushes the two rarity tables above. At L Luck, each tier\'s weight is multiplied by 1 + (L / 100) x this number. Common is always 0, so it is what everything shifts away from.',
    how: 'A bigger number makes Luck matter more for that tier. At 1.5, 100 Luck makes Legendary 2.5x as likely as at 0. Keep the numbers rising from Rare to Legendary or Luck starts favouring the middle.',
    rows: () => _ptArrRows(LUCK_TIER_STEP, _PT_TIERS, 1) },

  { id: 'svpick', group: 'Pick of three', type: 'w', title: 'Flow / Survival pick of three',
    desc: 'The TYPE of each of the three offers on a Flow or Survival level-up pick. Each offer rolls its type on its own, so three Tricks in one pick is normal.',
    how: 'Ratios. Raise Limit to see Limits more often. A type with nothing left to offer is skipped, so the pick always shows three.',
    rows: () => _ptObjRows(SURVIVAL_PICK_WEIGHTS, { trick: 'Trick', sleight: 'Sleight', knack: 'Knack', limit: 'Limit' }) },
  { id: 'guidedpick', group: 'Pick of three', type: 'w', title: 'Schedule / Guided pick of three',
    desc: 'The type of each offer on the Schedule\'s pick of three (after a cleared round) and Guided\'s free pick. Rolled per offer, like the Flow table.',
    how: 'Ratios. There is no Limit row here: the Schedule sells limits through its Raise obligation instead.',
    rows: () => _ptObjRows(GUIDED_PICK_WEIGHTS, { trick: 'Trick', sleight: 'Sleight', knack: 'Knack' }) },

  { id: 'rgbuff', group: 'Reward grid', type: 'w', title: 'Reward grid tiles',
    desc: 'What each buff tile on an ordinary reward grid is. Every buff cell rolls this table. Tricks are also guaranteed a minimum count per grid, so their real share is higher than the raw weight.',
    how: 'Ratios. Raise a row to see that tile more often. improve_* tiles fall back to a Trick when there is nothing to improve.',
    rows: () => REWARD_BUFF_CATS.map(c => ({ k: c.kind, label: c.kind, get: () => c.weight, set: v => { c.weight = v; } })) },
  { id: 'rgprize', group: 'Reward grid', type: 'w', title: 'Prize grid tiles',
    desc: 'The same roll for the prize grid after a review. No common resource tiles here: entities and permanent upgrades only.',
    how: 'Ratios. Limit tiles are also capped at 3 per prize grid whatever this says.',
    rows: () => REWARD_PRIZE_CATS.map(c => ({ k: c.kind, label: c.kind, get: () => c.weight, set: v => { c.weight = v; } })) },

  { id: 'deckops', group: 'Deck editing', type: 'w', title: 'Deck edit operations',
    desc: 'Which card operations the Flow deck editor offers (three are drawn without repeats), and which card tiles the reward grid offers. suit2/rank2 are the dual cards.',
    how: 'Ratios. A higher weight means that operation shows up more often among the three. Operations missing from the table count as 8.',
    rows: () => _ptObjRows(FLOWR_OP_WEIGHTS) },
  { id: 'dual', group: 'Deck editing', type: 'p1', title: 'Dual card chance',
    desc: 'When a Second Suit or Second Rank operation is applied, the chance each selected card actually takes it. Luck raises it.',
    how: '100% means every selected card always takes it. Lower it to make dual cards rarer.',
    rows: () => [{ k: 'v', label: 'Chance per card', get: () => FLOWR_DUAL_CHANCE, set: v => { FLOWR_DUAL_CHANCE = v; } }] },

  { id: 'leveltype', group: 'Levels', type: 'p1', title: 'Flow shaped level chance',
    desc: 'From level 3, the chance a Flow level is Line Quotas (marked lines, each with its own goal; clearing it pays at least 3 rewards) or a Relay (three goals in a row) instead of a plain goal. Rolled once per level, Line Quotas first.',
    how: '0% switches that shape off in Flow. The two together are the share of shaped levels.',
    rows: () => [{ k: 'lines', label: 'Line Quotas', get: () => LEVEL_TYPE_LINES_CHANCE, set: v => { LEVEL_TYPE_LINES_CHANCE = v; } },
                 { k: 'relay', label: 'Relay', get: () => LEVEL_TYPE_RELAY_CHANCE, set: v => { LEVEL_TYPE_RELAY_CHANCE = v; } }] },

  { id: 'mapfill', group: 'Schedule map', type: 'w', title: 'Schedule obligation mix',
    desc: 'What fills the free cells of a Schedule map once the minimums are placed (2 shops, 2 hard rounds, 3 meetings, 2 reward grids).',
    how: 'Ratios. Raise a row to see more of that obligation on the board. Maps that fail validation are re-rolled, so extreme numbers just cost generation time.',
    rows: () => MAP_FILL_W.map(e => ({ k: e[0], label: e[0], get: () => e[1], set: v => { e[1] = v; } })) },
  { id: 'mapblank', group: 'Schedule map', type: 'w', title: 'Blank cells per map',
    desc: 'How many dead (blank) cells a Schedule map carries in its middle slots.',
    how: 'Ratios. Fewer blanks means more obligations to choose from.',
    rows: () => _ptArrRows(MAP_BLANK_ODDS, ['0 blanks', '1 blank', '2 blanks']) },
  { id: 'mapfunnel', group: 'Schedule map', type: 'w', title: 'Last slot width',
    desc: 'How many of the four lanes in the last slot before the review hold a real obligation.',
    how: 'Ratios. More solid lanes means more ways into the review.',
    rows: () => _ptObjRows(MAP_FUNNEL_SOLID_ODDS, { 2: '2 lanes', 3: '3 lanes', 4: '4 lanes' }) },

  { id: 'guidedx', group: 'Guided', type: 'p', title: 'Guided crossroads offers',
    desc: 'Guided only. Each kind is rolled on its own for the four-tile crossroads; anything left empty becomes a meeting.',
    how: 'Each row is an independent chance. Raising several above 50% crowds the board and the later rows get trimmed.',
    rows: () => GUIDED_ODDS.map(o => ({ k: o.kind, label: o.kind, get: () => o.chance, set: v => { o.chance = v; } })) },

  { id: 'sqshape3', group: 'Poker Squares', type: 'w', title: 'Squares 3-cell shapes',
    desc: 'How often each 3-cell tile shape is dealt. Shapes come from a bag, so a shape is not repeated until the bag empties.',
    how: 'Ratios. I is the straight bar.',
    rows: () => _ptArrRows(SQ_SHAPE_W[3], ['I', 'L']), after: () => { if (typeof sqBags !== 'undefined') sqBags = {}; } },
  { id: 'sqshape4', group: 'Poker Squares', type: 'w', title: 'Squares 4-cell shapes',
    desc: 'How often each 4-cell tile shape is dealt, from the same bag.',
    how: 'Ratios. I is the straight bar and is kept light on purpose.',
    rows: () => _ptArrRows(SQ_SHAPE_W[4], ['I', 'O', 'T', 'S', 'Z', 'J', 'L']), after: () => { if (typeof sqBags !== 'undefined') sqBags = {}; } },
];

// The shipped values, taken before any override lands.
const _ptShipped = {};
PROB_TABLES.forEach(t => { _ptShipped[t.id] = {}; t.rows().forEach(r => { _ptShipped[t.id][r.k] = r.get(); }); });

let probOverrides = (() => { try { return JSON.parse(localStorage.getItem(PROB_KEY) || '{}') || {}; } catch (e) { return {}; } })();
function _ptSave() { try { localStorage.setItem(PROB_KEY, JSON.stringify(probOverrides)); } catch (e) {} }
// Apply stored overrides now.
PROB_TABLES.forEach(t => {
  const o = probOverrides[t.id]; if (!o) return;
  t.rows().forEach(r => { if (typeof o[r.k] === 'number') r.set(o[r.k]); });
  if (t.after) t.after();
});

function probSet(tid, k, v) {
  const t = PROB_TABLES.find(x => x.id === tid); if (!t) return;
  const r = t.rows().find(x => x.k === k); if (!r) return;
  let n = parseFloat(v); if (!Number.isFinite(n)) return;
  // Chances are typed as percent.
  if (t.type === 'p' || t.type === 'p1') n = n / 100;
  n = Math.max(0, n);
  if (t.type === 'p' || t.type === 'p1') n = Math.min(1, n);
  r.set(n);
  const shipped = _ptShipped[t.id][k];
  probOverrides[t.id] = probOverrides[t.id] || {};
  if (Math.abs(n - shipped) < 1e-9) delete probOverrides[t.id][k]; else probOverrides[t.id][k] = n;
  if (!Object.keys(probOverrides[t.id]).length) delete probOverrides[t.id];
  _ptSave();
  if (t.after) t.after();
  devRenderProbTables(tid);
}
function probResetTable(tid) {
  const t = PROB_TABLES.find(x => x.id === tid); if (!t) return;
  t.rows().forEach(r => r.set(_ptShipped[t.id][r.k]));
  delete probOverrides[t.id]; _ptSave();
  if (t.after) t.after();
  devRenderProbTables();
}
function probResetAll() { PROB_TABLES.forEach(t => probResetTable(t.id)); }
function probTablesTuned() { return Object.keys(probOverrides).length; }

// ── The editor ──
function _ptTableHTML(t) {
  const rows = t.rows();
  const tot = rows.reduce((a, r) => a + Math.max(0, r.get()), 0) || 1;
  const tuned = probOverrides[t.id] || {};
  const pct = t.type === 'p' || t.type === 'p1';
  const body = rows.map(r => {
    const v = r.get();
    const shown = pct ? +(v * 100).toFixed(2) : +(+v).toFixed(3);
    const share = t.type === 'w' ? `${(Math.max(0, v) / tot * 100).toFixed(1)}%` : '';
    const mark = (r.k in tuned) ? ' dev-pt-tuned' : '';
    return `<label class="dev-pt-row${mark}" title="shipped: ${pct ? (+(_ptShipped[t.id][r.k] * 100).toFixed(2)) + '%' : _ptShipped[t.id][r.k]}">
      <span class="dev-pt-k">${r.label}</span>
      <input type="number" min="0" step="${pct ? 1 : (t.type === 'n' ? 0.1 : 0.5)}" value="${shown}"
        onchange="probSet('${t.id}','${r.k}',this.value)">${pct ? '<i>%</i>' : ''}
      <span class="dev-pt-share">${share}</span>
    </label>`;
  }).join('');
  const kind = t.type === 'w' ? 'weights: the share column is the real chance'
             : t.type === 'n' ? 'multipliers' : 'independent chances';
  return `<div class="dev-pt" data-pt="${t.id}">
    <div class="dev-pt-head"><b>${t.title}</b> <span class="dev-pt-kind">${kind}</span>
      <button class="dev-btn dev-pt-reset" onclick="probResetTable('${t.id}')">Reset</button></div>
    <div class="dev-note">${t.desc}</div>
    <div class="dev-note dev-pt-how"><b>Tuning:</b> ${t.how}</div>
    <div class="dev-pt-rows">${body}</div>
  </div>`;
}
function devRenderProbTables(onlyId) {
  const host = document.getElementById('dev-prob-tables'); if (!host) return;
  if (onlyId) {
    const el = host.querySelector(`[data-pt="${onlyId}"]`);
    const t = PROB_TABLES.find(x => x.id === onlyId);
    if (el && t) { el.outerHTML = _ptTableHTML(t); return; }
  }
  let html = '', grp = '';
  PROB_TABLES.forEach(t => {
    if (t.group !== grp) { grp = t.group; html += `<div class="dev-pt-group">${grp}</div>`; }
    html += _ptTableHTML(t);
  });
  host.innerHTML = html;
}
