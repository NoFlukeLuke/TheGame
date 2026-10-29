// ══════════════════════════════════════════════════════════════════════════════
// DEPARTMENTS (r673, owner; CHALLENGE_REWARDS.md section 2)
// ══════════════════════════════════════════════════════════════════════════════
// Each quarter of the Schedule belongs to ONE department, drawn when the quarter
// opens (deptForQuarter): its favourite quarter weighs DEPT_CFG.favMult, and a
// run never draws the same one twice. It leans the whole quarter's map, gently:
//   - its tile kind is DEPT_CFG.tileMult as likely in the map's free cells;
//   - DEPT_CFG.eventPct of the map's events come from its pool;
//   - DEPT_CFG.leanPct of entity offers (after the rarity roll) are drawn from
//     the Tricks, Knacks and Sleights carrying its focus tags (deptLean, from
//     pickEntityByRarity);
//   - its challenge cards pay its Standard / Hard reward (deptChallengePay,
//     js/challenge-rewards.js), and leaving a slot early pays its Standard
//     reward's first tier.
// The name is on the LOCATION screen while the schedule is up, and on the
// quarter card.

const DEPARTMENTS = [
  { id: 'sales', lunch: 'improve',      name: 'Sales',      tile: 'level',      fav: 2, focus: ['run', 'set', 'flush', 'size', 'streak'], focusWord: 'hand types',
    pay: { std: 'credits', hard: 'growth' },   events: ['hot_streak', 'prize_ladder', 'keep_it', 'static_bonus', 'rehearsal'] },
  { id: 'marketing', lunch: 'cardbuff',  name: 'Marketing',  tile: 'event',      fav: 1, focus: ['focus'], focusWord: 'Focus',
    pay: { std: 'focus2', hard: 'focus' },     events: ['plinko', 'the_draw', 'confluence', 'merchant', 'luck_dice'] },
  { id: 'accounting', lunch: 'credits', name: 'Accounting', tile: 'shop',       fav: 4, focus: ['credits', 'held', 'shop'], focusWord: 'credits',
    pay: { std: 'interest', hard: 'boss' },    events: ['altar', 'market', 'deck_trim', 'pairs'] },
  { id: 'hr', lunch: 'charges',         name: 'HR',         tile: 'limitbreak', fav: 3, focus: ['tricks', 'sleights', 'charges'], focusWord: 'your loadout',
    pay: { std: 'charges', hard: 'limit' },    events: ['reassignment', 'shift_change', 'trick_gamble', 'merchant', 'restructure'] },
  { id: 'legal', lunch: 'pick',      name: 'Legal',      tile: 'audit',      fav: 4, focus: ['time', 'clock', 'pause'], focusWord: 'time',
    pay: { std: 'time', hard: 'knacks' },      events: ['overtime', 'reschedule', 'clean_slate', 'call_it'] },
  { id: 'operations', lunch: 'stock', name: 'Operations', tile: 'priority',   fav: 2, focus: ['stock', 'swap', 'discard'], focusWord: 'swaps and discards',
    pay: { std: 'stock', hard: 'sleights' },   events: ['workshop', 'line_shift', 'spring'] },
  { id: 'rnd', lunch: 'permaprime',        name: 'R&D',        tile: 'mystery',    fav: 1, focus: ['scaling'], focusWord: 'growth',
    pay: { std: 'prime', hard: 'improve' },  events: ['forge', 'rewire', 'state_change', 'gamble', 'wild_cards'] },
  { id: 'it', lunch: 'path',         name: 'IT',         tile: 'reward',     fav: 3, focus: ['position', 'line', 'board'], focusWord: 'the board and its lines',
    pay: { std: 'cardbuff', hard: 'tricks' },      events: ['grid_spinner', 'the_payline', 'the_floor', 'line_shift'] },
];
// Tuned live from dev -> Probabilities (js/prob-tables.js).
// lunchMult (r707): the department's own Long Lunch perk is this many times as likely (js/skip-perks.js).
const DEPT_CFG = { tileMult: 1.5, favMult: 2, eventPct: 60, leanPct: 33, lunchMult: 4 };
// The words a department's tile kind goes by (MAP_KIND_META names, read at draw time).
const DEPT_TILE_KIND = { level: 'level', event: 'event', shop: 'shop', limitbreak: 'limitbreak', reward: 'reward',
                         audit: 'audit', priority: 'challenge', mystery: null };

var mapDepts = {};   // quarter -> department id - SAVE_VARS
function deptReset() { mapDepts = {}; }
function deptById(id) { return DEPARTMENTS.find(d => d.id === id) || null; }

// The quarter's department, drawn the first time it is asked for.
function deptForQuarter(q) {
  if (!mapDepts) mapDepts = {};
  if (mapDepts[q] && deptById(mapDepts[q])) return deptById(mapDepts[q]);
  const used = new Set(Object.values(mapDepts));
  let pool = DEPARTMENTS.filter(d => !used.has(d.id));
  if (!pool.length) pool = DEPARTMENTS.slice();
  const w = pool.map(d => (d.fav === q ? DEPT_CFG.favMult : 1));
  let r = Math.random() * w.reduce((a, b) => a + b, 0), pick = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { pick = pool[i]; break; } }
  mapDepts[q] = pick.id;
  return pick;
}
// The live quarter's department: the Schedule only.
function mapDept() {
  if (typeof mapActive !== 'function' || !mapActive()) return null;
  return deptForQuarter(typeof actNumber === 'number' ? actNumber : 1);
}
function deptChallengePay(cls) { const d = mapDept(); return d ? d.pay[cls] : null; }

// ── The map ─────────────────────────────────────────────────────────────────
// The free cells' weights, the department's kind made tileMult as likely. A
// hard round and an audit are both 'challenge' cells: the challenge weight takes
// half the lift and the audit share moves, so the focused one ends tileMult as likely.
function deptFillWeights(W) {
  const d = mapDept(); if (!d) return W;
  const kind = d.tile === 'audit' || d.tile === 'priority' ? 'challenge' : d.tile;
  const m = kind === 'challenge' ? 1 + (DEPT_CFG.tileMult - 1) / 2 : DEPT_CFG.tileMult;
  return W.map(([k, w]) => [k, k === kind ? w * m : w]);
}
function deptAuditShare(base) {
  const d = mapDept(); if (!d || (d.tile !== 'audit' && d.tile !== 'priority')) return base;
  const cm = 1 + (DEPT_CFG.tileMult - 1) / 2;
  const audit = d.tile === 'audit' ? base * DEPT_CFG.tileMult / cm : 1 - (1 - base) * DEPT_CFG.tileMult / cm;
  return Math.max(0, Math.min(1, audit));
}
function deptMysteryMax(base) { const d = mapDept(); return d && d.tile === 'mystery' ? Math.round(base * DEPT_CFG.tileMult) : base; }
// An event tile's event: eventPct of them from the department's pool (each at
// most once a map), the rest from every event. `pool` is the shuffled eligible
// list, `used` the ids already on this map.
function deptEventPick(pool, used) {
  const d = mapDept();
  if (d && Math.random() * 100 < DEPT_CFG.eventPct) {
    const own = (typeof _mapShuffle === 'function' ? _mapShuffle(d.events.slice()) : d.events.slice())
      .find(id => pool.includes(id) && !used.has(id));
    if (own) return own;
  }
  return pool.find(id => !used.has(id)) || pool[0] || null;
}

// ── Offers: pickEntityByRarity, after the tier is rolled ─────────────────────
function deptLean(list) {
  const d = mapDept();
  if (!d || !list || list.length < 2 || Math.random() * 100 >= DEPT_CFG.leanPct) return list;
  const tags = new Set(d.focus);
  const own = list.filter(x => x && Array.isArray(x.tags) && x.tags.some(t => tags.has(t)));
  return own.length ? own : list;
}

// ── Words ───────────────────────────────────────────────────────────────────
function deptTileWord(d) {
  const k = DEPT_TILE_KIND[d.tile];
  return k && typeof MAP_KIND_META !== 'undefined' && MAP_KIND_META[k] ? MAP_KIND_META[k].name : '???';
}
// The schedule's ? card: what this quarter's department does. States it and stops.
function deptHelpRow() {
  const d = mapDept(); if (!d || typeof crrSay !== 'function') return null;
  // r690: the reward tile is IT's alone, so IT's line says it appears rather than "more".
  const tiles = d.tile === 'reward' && typeof MAP_REWARD_MAX !== 'undefined'
    ? `Up to ${MAP_REWARD_MAX} ${deptTileWord(d)} obligations` : `More ${deptTileWord(d)} obligations`;
  return [d.name, `This quarter's department. ${tiles}, and offers lean to ${d.focusWord}. `
    + `Challenge cards: ${crrSay(d.pay.std, 0)}. Hard ones: ${crrSay(d.pay.hard, 0)}.`
    + (mapSlotCap() > 1 && typeof lunchLikely === 'function' && lunchLikely() ? ` Long lunch: ${lunchLikely().say} is its own perk.` : '')];
}
