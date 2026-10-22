// ══════════════════════════════════════════════
// ENTITY IMPROVEMENT - tiers (r206)
// ══════════════════════════════════════════════
// An owned entity can get BETTER. Every entity carries an improvement TIER
// (0-5), and its tuning numbers in BAL grow with it. See ENTITY_IMPROVEMENTS.md
// for the design sheet: option 1 of every entity is "the number again", which is
// exactly what this file implements, generically, for all of them at once.
//
// ── The ladder (owner's spec) ────────────────────────────────────────────────
// Each improvement adds the entity's STEP, except the 5th which adds 3 steps.
// So a +5 bonus climbs +5, +5, +5, +5, +15:
//
//   tier      0    1    2    3    4    5
//   steps     0    1    2    3    4    7      <- improveSteps()
//   a +5      5   10   15   20   25   40
//
// ── Why this rewrites BAL instead of wrapping every read ─────────────────────
// The ~200 sites that read a tuning number do it as `BAL.rich_soil.mult`, and
// BAL is never written to anywhere in the game (verified). So the cheapest
// correct thing is to keep a pristine copy and RECOMPUTE BAL in place whenever a
// tier changes. Every existing read site then picks the new number up with no
// edit, and there is no per-access cost and no proxy identity surprise.
//
// It also means the PRINTED DESCRIPTION follows for free: applyBalDescriptions()
// rebuilds `desc` from BAL[id] through DESC_TEMPLATES, so an improved entity
// states its real number to the player without a single per-entity string.
//
// ── What may scale, and what must never ──────────────────────────────────────
// An ALLOWLIST of parameter names, not a denylist, and that is deliberate: a
// tuning number added to BAL later must not silently start scaling. Only the
// BONUS AMOUNT grows. Thresholds, intervals, costs, chances, cooldowns and
// requirements are all left alone - those are what option 2 (the looser
// trigger) is for, and doubling `quick_draw.window_ms` or halving a cooldown
// here would be a balance change nobody asked for.
//
// It also only ever touches ids that are REAL ENTITIES. BAL also holds global
// config (`_resources`, `wheel`, `shop_discount`), and
// none of that belongs to anything the player can own.

const IMPROVE_MAX_TIER = 5;

// Cumulative steps at a tier. The 5th improvement is worth 3, so 4 -> 7.
function improveSteps(tier) { return tier >= IMPROVE_MAX_TIER ? 7 : Math.max(0, tier); }

// Bonus amounts. Scaled as `base + step * steps`.
const IMPROVE_ADD = new Set([
  'pips','mult','seconds','focus','coins','credits','swaps','discards',
  'pips_per_card','mult_per_card','focus_per_card',
  'pause','pause_seconds',
  'pips_per_level','pips_per_streak','pips_per_hand','pips_per_discard','pips_per_charge',
  'pips_per_second','pips_per_adj','pips_per_five','pips_per_interval','pips_per',
  'mult_per_sleight','mult_per_hand','mult_per_spade','mult_per_interval','mult_per_pause','mult_per_ace',
  'mult_per_jack','mult_per_match','mult_per_prior','mult_per_nine','mult_per_milestone',
  'mult_per_type','mult_per_event','mult_per_n','mult_per',
  'focus_per_2','focus_per_stock','focus_on_enter','focus_cap',
  'perm_pips','perm_mult','flat_pips','face_pips','worth','extra_mult','per_jack','base',
  'extra_replays','retrigger_count','cap_gain','seconds_per_3','max_seconds','cap_bonus',
  'mult_step','pip_mult_step','pip_mult_per_replay','mult_mult_per_replay',
  'mult_mult_per_card','pip_mult_per_10_credits','pip_mult_per_missing','mult_mult_per_missing','chance_per',
]);

// Multipliers. The bonus is the part ABOVE x1, so x2 pips has a step of 1 and
// climbs x2, x3, x4 - never x2, x4, x8. Matches the sheet, where Aftershock's
// "x2 pips" carries an option 1 of "+1x pips".
const IMPROVE_MUL = new Set([
  'pip_mult','mult_mult','speed_mult','complexity_mult','window_mult',
  'multiplier','mult_x','interest_mult','pip_mult_base',
]);

// Where the owner's sheet names a step that is NOT the base value, or names only
// SOME of an entity's numbers. Naming any param here makes it the complete list
// for that entity - nothing else on it scales.
//   ENTITY_IMPROVEMENTS.md, "Improve option 1", is the source of truth.
const IMPROVE_STEP = {
  amplifier:      { mult_per_level: 1 },   // r636: x3 the level, +1x an improvement
  first_light:    { worth: 10 },        // Aces worth 21; the sheet says +10, not +21
  rising_tide:    { mult_min: 1, mult_max: 1 },   // r539: each level's roll, 1-3 -> 2-4 -> ...
  face_value:     { face_pips: 5 },     // face cards 15; the sheet says +5
  king_guard:     { pips: 10 },         // +10 pips is option 1; the +2 mult is option 2
  extra_discards: { max: 1 },           // Harvest grants 2; repeating it whole is too strong
  extra_swaps:    { max: 1 },           // Swap Shop, same
  greedy_boi:     { selection: 1 },     // +2 selection is a big step; the sheet steps by 1
  deja_vu:        { seconds: 2 },
  sundial:        { seconds: 5 },
  metronome:      { seconds: 3 },
  clockmaker:     { seconds: 5 },
  time_bank:      { seconds: 15 },
  carry_time:     { max_seconds: 15 },
  safety_net:     { seconds: 15 },
  free_range_t:   { swaps: 1 },
  long_pause:     { multiplier: 0.2 },  // 1.5x -> 1.7x, not 1.5x -> 2.0x
  coin_toss:      { chance: 0.15 },
  jury_rig:       { chance: 0.15 },
  time_slip:      { chance: 0.10 },
  replay_rewind:  { chance: 0.20 },
  prime_time:     { pips_per_card: 11 }, // owner: +11 per improvement, not +23
  hyper_focus:    { focus_mult: 1 },     // 2x Focus -> 3x -> 4x
  // r624, the owner's rare sheet
  heavy_hand:     { pips_per_card: 10 },
  high_pair:      { focus_per_card: 2 },
  patience_reward:{ mult_per_second: 0.5 },
  first_play:     { focus: 1 },
  quarter_chime:  { pips: 30 },
  // r625, the owner's epic sheet
  rerun:          { pip_mult: 0.25 },
  royal_trio:     { mult_mult: 1 },
  frozen_moment:  { focus: 5 },
  before_the_tide:{ max_rank: 1 },
  kaleidoscope:   { extra: 1 },
  landfill:       { mult_per: 5, mult_per_flow: 3 },
  feelin_lucky:   { mult_mult: 0.75 },
};

// Ladders that are not "the number again" (r624, the owner's rare sheet). A
// function of the tier returning the values to write over the pristine row;
// an undefined value leaves that number alone. An entity listed here takes no
// generic step at all. Index = tier 0..5.
const IMPROVE_PLAN = {
  // a second replay chance, rolled only after the first succeeds; the 5th sets both to 77%
  ripple:           t => ({ chance: t >= 5 ? 0.77 : undefined, chance2: [0, 0.33, 0.44, 0.55, 0.66, 0.77][t] }),
  rowcol_retrigger: t => ({ chance: t >= 5 ? 0.77 : undefined, chance2: [0, 0.33, 0.44, 0.55, 0.66, 0.77][t] }),
  // +1 swap, +1 discard, -4 Focus lost, round and round; the 5th does all three
  release_valve:    t => ({ swaps: 1 + [0, 1, 1, 1, 2, 3][t], discards: 1 + [0, 0, 1, 1, 1, 2][t], focus_drop: 16 - 4 * [0, 0, 0, 1, 1, 2][t] }),
  // +5 pips, then one more hand, alternating; the 5th does both
  first_fruits:     t => ({ pips: 5 + 5 * [0, 1, 1, 2, 2, 3][t], hands: 1 + [0, 0, 1, 1, 2, 3][t] }),
  // +2 mult, then 2s less, alternating: +10 every 6s at tier 4; the 5th does both
  swift:            t => ({ mult_per_interval: 6 + 2 * [0, 1, 1, 2, 2, 3][t], interval_seconds: 10 - 2 * [0, 0, 1, 1, 2, 3][t] }),
  // r646 (owner): 44% +16% an improvement, capped at 100%; the 5th adds Queens
  four_by_four:     t => ({ chance: Math.min(1, 0.44 + 0.16 * Math.min(t, 4)), queens: t >= 5 ? 1 : 0 }),
  // r646 (owner): one more replay, then a Luck-free chance of one more every time, alternating; 2 replays (3 plays) to start
  woodpecker:       t => ({ retrigger_count: [2, 3, 3, 4, 4, 4][t], chance_extra: [0, 0, 0.25, 0.25, 0.33, 0.5][t] }),
  // r646 (owner): +2 swaps, +2 discards, alternating; the 5th does both
  bellhop:          t => ({ swaps: 2 + 2 * [0, 1, 1, 2, 2, 3][t], discards: 2 + 2 * [0, 0, 1, 1, 2, 3][t] }),
  // r646 line Tricks (owner): +0.2x / +10% a tier for four tiers; the 5th marks a SECOND line at the base value (line2 / chance2)
  line_xpips:       t => ({ pip_mult: 1.2 + 0.2 * Math.min(4, t), line2: t >= 5 ? 1.2 : 0 }),
  line_xmult:       t => ({ mult_mult: 1.2 + 0.2 * Math.min(4, t), line2: t >= 5 ? 1.2 : 0 }),
  obligatory:       t => ({ chance: 0.25 + 0.1 * Math.min(4, t), chance2: t >= 5 ? 0.25 : 0 }),
  suggestive:       t => ({ chance: 0.35 + 0.1 * Math.min(4, t), chance2: t >= 5 ? 0.35 : 0 }),
  // both chances +10%, then the credit share +15%, alternating; the 5th adds the second line at the base odds
  coin_sword:       t => ({ credit_chance: 0.1 + 0.1 * [0, 1, 1, 2, 2, 2][t], mult_chance: 0.2 + 0.1 * [0, 1, 1, 2, 2, 2][t], credit_pct: 0.25 + 0.15 * [0, 0, 1, 1, 2, 2][t], line2: t >= 5 ? 1 : 0 }),
  // Assembly Line (r646): +2 a tier (+1 in Flow); the 5th adds a second line
  assembly_line:    t => ({ mult_per_prior: 2 + 2 * Math.min(4, t), mult_per_flow: 1 + Math.min(4, t), lines: t >= 5 ? 2 : 1 }),
  // Lie Up (r646, INSEPARABLE): +16 mult a tier; the 5th loosens the shape to no more than 2 rows or 2 columns
  lie_up:           t => ({ mult: 24 + 16 * t, span: t >= 5 ? 2 : 1 }),
  // ── r625, the owner's epic sheet ──
  // one more prime, then one more rolled rank, alternating; the 5th does both
  wild_heart:       t => ({ primes: 1 + [0, 1, 1, 2, 2, 3][t], extra_ranks: [0, 0, 1, 1, 2, 3][t] }),
  // +10s a tier; from the 3rd a hit also primes a random Trick
  double_jeopardy:  t => ({ pause_seconds: 15 + 10 * [0, 1, 2, 3, 4, 7][t], prime_random: t >= 3 ? 1 : 0 }),
  // +10% chance, then 10s sooner, alternating; the 5th does both
  hourglass:        t => ({ chance: 0.5 + 0.1 * [0, 1, 1, 2, 2, 3][t], interval_seconds: 60 - 10 * [0, 0, 1, 1, 2, 3][t] }),
  // +5 credits, +10 mult, 2s cheaper, round and round; the 5th does all three
  monochrome:       t => ({ coins: 5 + 5 * [0, 1, 1, 1, 2, 3][t], mult: 25 + 10 * [0, 0, 1, 1, 1, 2][t], seconds: 10 - 2 * [0, 0, 0, 1, 1, 2][t] }),
  // doubles one of the three in turn; the 5th doubles all three and lifts the silent all-three chance
  ninesong:         t => ({ seconds: 9 * [1, 2, 2, 2, 4, 8][t], mult: 27 * [1, 1, 2, 2, 2, 4][t], focus: 9 * [1, 1, 1, 2, 2, 4][t], all_chance: t >= 5 ? 0.35 : 0.2 }),
  // a second replay chance, +33% a tier (past 100% a third); the 5th adds a second marked line
  perfect_timing:   t => ({ chance2: [0, 0.33, 0.66, 0.99, 1, 1][t], extra_line: t >= 5 ? 1 : 0 }),   // r631 (owner): capped at a sure second replay
  // +8 mult, +4 Focus, alternating; the 5th does both
  shape_square:     t => ({ mult: 24 + 8 * [0, 1, 1, 2, 2, 3][t], focus: 16 + 4 * [0, 0, 1, 1, 2, 3][t] }),
  // improves only twice: the first jumps to tier 3 (buffed pips count), the second to tier 5 (6 rows + columns count)
  shape_line:       t => ({ buffs: t >= 3 ? 1 : 0, span6: t >= 5 ? 1 : 0 }),
  // +4 Focus, +4 credits, alternating; the 5th does both
  clean_sweep:      t => ({ focus: 8 + 4 * [0, 1, 1, 2, 2, 3][t], credits: 4 + 4 * [0, 0, 1, 1, 2, 3][t] }),
  // +2 mult per 9 and 3 more 9s a tier (the 9s land through IMPROVE_HOOKS); the 5th stops it deleting itself
  nines_mult:       t => ({ mult_per_nine: 2 + 2 * t, added: 9 + 3 * t, no_delete: t >= 5 ? 1 : 0 }),
  // clubs join at the 1st, x0.5 more time a tier from the 2nd, any club or spade at the 5th
  spade_flood:      t => ({ suits: t >= 5 ? 2 : t >= 1 ? 1 : 0, time_mult: [1, 1, 1.5, 2, 2.5, 2.5][t] }),
  // +3% a tier of a second force trigger per card
  temporal_rift:    t => ({ chance_extra: 0.03 * t }),
  // +10 pips, +10 mult, alternating; the 5th does both and adds a second secret cell
  heartwood:        t => ({ pips: 5 + 10 * [0, 1, 1, 2, 2, 3][t], mult: 5 + 10 * [0, 0, 1, 1, 2, 3][t], cells: t >= 5 ? 2 : 1 }),
  // each number by its base in turn; the 5th does all four and pays two of them
  four_horseman:    t => ({ pips: 24 * (1 + [0, 1, 1, 1, 1, 2][t]), mult: 24 * (1 + [0, 0, 1, 1, 1, 2][t]), focus: 8 * (1 + [0, 0, 0, 1, 1, 2][t]), pause: 8 * (1 + [0, 0, 0, 0, 1, 2][t]), picks: t >= 5 ? 2 : 1 }),
  // improves once, straight to tier 5
  undue_influence:  t => ({ faces: t >= 1 ? 1 : 0 }),
  // +0.75 a tier; the 5th extends to 3 rolled ranks (rolled through IMPROVE_HOOKS)
  patient_rulers:   t => ({ mult_mult: 1.5 + 0.75 * t, extra_ranks: t >= 5 ? 3 : 0 }),
  // +11% chance, +0.4x, alternating; the 5th does both and even cards replay
  even_better:      t => ({ chance: 0.66 + 0.11 * [0, 1, 1, 2, 2, 3][t], pip_mult: 2.25 + 0.4 * [0, 0, 1, 1, 2, 3][t], replay: t >= 5 ? 1 : 0 }),
  what_odds:        t => ({ mult_mult: 1.7 + 0.35 * t, replay: t >= 5 ? 1 : 0 }),
  critical:         t => ({ mult_mult: 5 + t, extra_family: t >= 5 ? 1 : 0 }),
  twinners:         t => ({ pip_mult: 3 + t, replay: t >= 5 ? 1 : 0 }),
  // one more application, then flushes, then more applications; sets at the 5th
  marathon:         t => ({ extra: [1, 2, 2, 3, 4, 4][t], flush: t >= 2 ? 1 : 0, sets: t >= 5 ? 1 : 0 }),
};

// What an improvement DOES beyond its numbers (r625): a tier jump, a roll kept on
// the owned Trick, cards into the deck. Run by improveEntity after the tiers are
// applied, with the tier just reached. The owned Trick object (if any) is passed.
const IMPROVE_HOOKS = {
  shape_line: (tier, t) => { if (tier === 1 || tier === 2) return 3; if (tier === 4) return 5; },   // two improvements: 3, then 5
  undue_influence: tier => (tier >= 1 && tier < 5) ? 5 : undefined,
  nines_mult: () => { if (typeof cloudNineAddNines === 'function') cloudNineAddNines(3); },
  wild_heart: (tier, t) => { if (t) rollExtraRanks(t, '_heartRanks', BAL.wild_heart.extra_ranks, ['A']); },
  patient_rulers: (tier, t) => { if (t) rollExtraRanks(t, '_prRanks', BAL.patient_rulers.extra_ranks, ['J', 'Q', 'K']); },
  critical: (tier, t) => { if (t && BAL.critical.extra_family && !t._critFamily) t._critFamily = Math.random() < 0.5 ? 'set' : 'run'; },
  perfect_timing: () => { if (BAL.perfect_timing.extra_line && typeof markExtraLine === 'function') markExtraLine('perfect_timing'); },
  // r646: the line Tricks' 5th improvement marks a second line (js/scoring.js markExtraLine)
  line_xpips:    () => { if (BAL.line_xpips.line2 && typeof markExtraLine === 'function') markExtraLine('line_xpips'); },
  line_xmult:    () => { if (BAL.line_xmult.line2 && typeof markExtraLine === 'function') markExtraLine('line_xmult'); },
  obligatory:    () => { if (BAL.obligatory.chance2 && typeof markExtraLine === 'function') markExtraLine('obligatory'); },
  suggestive:    () => { if (BAL.suggestive.chance2 && typeof markExtraLine === 'function') markExtraLine('suggestive'); },
  coin_sword:    () => { if (BAL.coin_sword.line2 && typeof markExtraLine === 'function') markExtraLine('coin_sword'); },
  assembly_line: () => { if (BAL.assembly_line.lines > 1 && typeof markExtraLine === 'function') markExtraLine('assembly_line'); },
};
// `n` distinct ranks, none in `not`, kept on the Trick under `key` (rolled once
// per count, so an earlier roll stays when the count grows).
function rollExtraRanks(t, key, n, not) {
  const have = t[key] || [];
  if (have.length >= n) { if (have.length > n) t[key] = have.slice(0, n); return; }
  const pool = Object.keys(RANK_ORDER).filter(r => RANK_ORDER[r] >= 1 && RANK_ORDER[r] <= 13 && r !== '1' && !not.includes(r) && !have.includes(r));
  while (have.length < n && pool.length) have.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  t[key] = have;
}
function ownedTrickObj(id) { return (typeof trickTray !== 'undefined' && trickTray.find(t => t && t.id === id)) || null; }

// Pristine BAL, captured at load before anything can have improved. One level
// deep is enough - every BAL entry is a flat object of numbers.
const BAL_BASE = {};
for (const id in BAL) { if (BAL[id] && typeof BAL[id] === 'object') BAL_BASE[id] = Object.assign({}, BAL[id]); }

// ── Descriptions that are not generated ─────────────────────────────────────
// Only 91 of the 196 entities carrying tuning numbers have a DESC_TEMPLATES
// entry; the other 105 have their description typed out in the data file with
// the number written into the sentence. Those would improve SILENTLY - Enriched
// would score +80 pips while still reading "Flushes score +40 pips", which is
// worse than not improving at all, because the sheet in front of the player
// would be wrong.
//
// So for those, the number is substituted into the printed text. Only a base
// value that appears EXACTLY ONCE is touched: "Sets score +3 mult per card in
// the largest set" has one 3, but a description mentioning its number twice (or
// mentioning another number equal to it) cannot be rewritten safely and is left
// alone rather than guessed at. Measured: 86 of the 105 rewrite cleanly, 10 are
// ambiguous and 9 never print their number at all.
//
// Always rewritten from the PRISTINE text, never from the last rewrite, or two
// improvements in a row would compound the substitution.
const DESC_BASE = {};
function captureDescBase() {
  [typeof TRICK_POOL !== 'undefined' ? TRICK_POOL : [],
   typeof KNACK_POOL !== 'undefined' ? KNACK_POOL : [],
   typeof SLEIGHT_POOL !== 'undefined' ? SLEIGHT_POOL : []].forEach(p =>
     p.forEach(e => { if (e && e.desc != null && DESC_BASE[e.id] == null) DESC_BASE[e.id] = e.desc; }));
}

// A number, not part of a longer number. Lookbehind is supported everywhere the
// game runs (the CRT shell is already ES2020+).
function _numRe(v) { return new RegExp('(?<![0-9.])' + String(v).replace('.', '\\.') + '(?![0-9.])', 'g'); }

function rewriteDescForTier(e) {
  const base = DESC_BASE[e.id];
  if (base == null) return;
  const plan = improveStepsFor(e.id), src = BAL_BASE[e.id];
  if (!plan || !src) return;
  let out = base;
  for (const k in plan) {
    const from = src[k], to = BAL[e.id][k];
    if (from === to) continue;
    const hits = base.match(_numRe(from));
    if (!hits || hits.length !== 1) continue;   // ambiguous - leave the sentence alone
    out = out.replace(_numRe(from), String(to));
  }
  e.desc = out;
}

// id -> tier. Per run; in SAVE_VARS.
let entityTier = {};
function entityTierOf(id) { return (entityTier && entityTier[id]) || 0; }

// Every id the player can actually own. Rebuilt on demand rather than cached,
// because the mode entity filter rewrites TRICK_POOL in place at startGame.
function improvableIds() {
  const out = new Set();
  [typeof TRICK_POOL !== 'undefined' ? TRICK_POOL : [],
   typeof KNACK_POOL !== 'undefined' ? KNACK_POOL : [],
   typeof SLEIGHT_POOL !== 'undefined' ? SLEIGHT_POOL : []].forEach(p => p.forEach(e => out.add(e.id)));
  return out;
}

// What one improvement adds to each of an entity's numbers, and how.
// Returns { param: [step, isMultiplier] } or null when nothing on it can grow.
function improveStepsFor(id) {
  const base = BAL_BASE[id];
  if (!base) return null;
  const over = IMPROVE_STEP[id];
  const out = {};
  for (const k in base) {
    const v = base[k];
    if (typeof v !== 'number') continue;
    if (over) { if (!(k in over)) continue; out[k] = [over[k], IMPROVE_MUL.has(k)]; continue; }
    if (IMPROVE_ADD.has(k)) out[k] = [v, false];
    else if (IMPROVE_MUL.has(k)) out[k] = [v - 1, true];
  }
  return Object.keys(out).length ? out : null;
}

// True when improving this entity would actually change a number.
function canImprove(id) { return (!!IMPROVE_PLAN[id] || !!improveStepsFor(id)) && entityTierOf(id) < IMPROVE_MAX_TIER; }

// Recompute every entity's numbers from the pristine table. Called whenever a
// tier changes, and on restore.
function applyEntityTiers() {
  const ids = improvableIds();
  ids.forEach(id => {
    const base = BAL_BASE[id];
    if (!base || !BAL[id]) return;
    const steps = improveSteps(entityTierOf(id));
    const plan  = improveStepsFor(id);
    for (const k in base) BAL[id][k] = base[k];          // reset first, so a tier can go down
    if (IMPROVE_PLAN[id]) {                               // r624: a ladder of its own, no generic step
      const v = IMPROVE_PLAN[id](Math.min(IMPROVE_MAX_TIER, entityTierOf(id)));
      for (const k in v) if (v[k] !== undefined) BAL[id][k] = typeof v[k] === 'number' ? Math.round(v[k] * 1000) / 1000 : v[k];
      return;
    }
    if (!steps || !plan) return;
    for (const k in plan) {
      const [step] = plan[k];
      BAL[id][k] = Math.round((base[k] + step * steps) * 1000) / 1000;
    }
  });
  // Descriptions are generated from BAL, so an improved entity states its real
  // number with no per-entity string anywhere.
  if (typeof applyBalDescriptions === 'function') applyBalDescriptions();
  // applyBalDescriptions only rewrites the 91 templated entities. The rest keep
  // whatever string they were last given, so they are restored from pristine and
  // then re-substituted - which also puts a de-improved entity back correctly.
  [typeof TRICK_POOL !== 'undefined' ? TRICK_POOL : [],
   typeof KNACK_POOL !== 'undefined' ? KNACK_POOL : [],
   typeof SLEIGHT_POOL !== 'undefined' ? SLEIGHT_POOL : []].forEach(p => p.forEach(e => {
     if (e) v6NameApply(e);
     if (!e || !BAL_BASE[e.id]) return;
     if (typeof DESC_TEMPLATES !== 'undefined' && DESC_TEMPLATES[e.id]) return;  // generated already
     if (DESC_BASE[e.id] == null) return;
     if (!entityTierOf(e.id)) { e.desc = DESC_BASE[e.id]; return; }
     rewriteDescForTier(e);
  }));
  syncOwnedEntityDescs();
}

// V6 names (r635, owner; js/data/v6-names.js): at tier 5 an entity listed there
// takes its v6 name, below it the base name (captured the first time it is seen,
// so a later rename in the pool row is still the base).
const NAME_BASE = {};
function v6NameApply(e) {
  if (typeof V6_NAMES === 'undefined' || !V6_NAMES[e.id]) return;
  if (!(e.id in NAME_BASE)) NAME_BASE[e.id] = e.name;
  e.name = entityTierOf(e.id) >= IMPROVE_MAX_TIER ? V6_NAMES[e.id] : NAME_BASE[e.id];
}

// The pools hold the canonical entity; what the player OWNS are copies made at
// grant time ({...pick}), so a regenerated desc has to be pushed onto them or
// the tray and the Knack row keep quoting the pre-improvement number.
function syncOwnedEntityDescs() {
  const from = id => {
    for (const p of [typeof TRICK_POOL !== 'undefined' ? TRICK_POOL : [],
                     typeof KNACK_POOL !== 'undefined' ? KNACK_POOL : [],
                     typeof SLEIGHT_POOL !== 'undefined' ? SLEIGHT_POOL : []]) {
      const hit = p.find(e => e.id === id);
      if (hit) return hit;
    }
    return null;
  };
  [typeof acquiredTricks !== 'undefined' ? acquiredTricks : [],
   typeof trickTray      !== 'undefined' ? trickTray      : [],
   typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []].forEach(list => {
    // The name too (r561): a renamed entity in a saved run shows its current name.
    (list || []).forEach(e => {
      const src = e && from(e.id); if (src && src.desc) e.desc = src.desc; if (src && src.name) e.name = src.name;
      // r646: a marked Trick's description names its line; the regenerated sentence says "a marked row or column"
      // again, so the label is put back from the registry (it used to be lost at every improvement).
      if (e && e._posAxis != null && typeof positionDescApply === 'function') { e._posDescBase = e.desc; positionDescApply(e); }
    });
  });
}

// Raise one entity's tier. Returns the new tier, or 0 when nothing happened.
function improveEntity(id) {
  if (!canImprove(id)) return 0;
  const _was = entityTierOf(id), _descWas = _impDescOf(id);
  entityTier[id] = _was + 1;
  applyEntityTiers();
  // r625: a hook may jump the tier (Straight Shot, Undue Influence) or roll
  // something onto the owned Trick; the tiers are applied again after a jump.
  const hook = IMPROVE_HOOKS[id];
  if (hook) {
    const jump = hook(entityTier[id], ownedTrickObj(id));
    if (typeof jump === 'number' && jump > entityTier[id]) { entityTier[id] = Math.min(IMPROVE_MAX_TIER, jump); applyEntityTiers(); hook(entityTier[id], ownedTrickObj(id)); }
  }
  improveRepaintArt();
  // r627: the improvement animation (js/improve-anim.js) plays from a queue, so a
  // many-tiered grant is one scene and a sequence can hold it until its end.
  if (typeof improveAnimNote === 'function') improveAnimNote(id, _was, entityTier[id], _descWas, _impDescOf(id));
  if (entityTier[id] >= IMPROVE_MAX_TIER) markTierSeen(id, IMPROVE_MAX_TIER);
  return entityTier[id];
}
// The printed sentence of an entity as the player sees it (the owned copy, else the pool's).
function _impDescOf(id) {
  const o = (typeof ownedTrickObj === 'function' && ownedTrickObj(id))
    || (typeof acquiredKnacks !== 'undefined' && acquiredKnacks.find(k => k && k.id === id));
  if (o && o.desc) return o.desc;
  for (const p of [typeof TRICK_POOL_ALL !== 'undefined' ? TRICK_POOL_ALL : [], typeof KNACK_POOL !== 'undefined' ? KNACK_POOL : [], typeof SLEIGHT_POOL !== 'undefined' ? SLEIGHT_POOL : []]) {
    const e = p.find(x => x && x.id === id); if (e) return e.desc || '';
  }
  return '';
}

// Tiers the player has REACHED, across runs (r634, owner): the Builds screen
// prints an entity's v2 to v5 freely and its v6 only once it has been taken
// there in a run. A collection log like js/discovery.js, not run state.
const TIER_SEEN_KEY = 'lethe.tierSeen.v1';
let _tierSeen = null;
function _tierSeenMap() {
  if (_tierSeen) return _tierSeen;
  try { _tierSeen = JSON.parse(localStorage.getItem(TIER_SEEN_KEY) || '{}') || {}; } catch (e) { _tierSeen = {}; }
  return _tierSeen;
}
function markTierSeen(id, tier) {
  const m = _tierSeenMap();
  if ((m[id] || 0) >= tier) return;
  m[id] = tier;
  try { localStorage.setItem(TIER_SEEN_KEY, JSON.stringify(m)); } catch (e) {}
}
function improveTierSeen(id, tier) { return (_tierSeenMap()[id] || 0) >= tier; }

// THE ART FOLLOWS THE TIER AT ONCE (r612, owner). The tray chips carry the tier's
// bands and badge, and they were only redrawn by callers that remembered to (the
// reward grid did; the shop, events, Flow's improve step and the Review state did
// not), so an improved Trick kept its old art until something else repainted the
// tray. Every improve and downgrade now repaints here. Coalesced to one paint per
// task, so a multi-step grant (The Draw) still paints once, before the next frame.
let _improveRepaintQueued = false;
function improveRepaintArt() {
  if (_improveRepaintQueued) return;
  _improveRepaintQueued = true;
  queueMicrotask(() => {
    _improveRepaintQueued = false;
    if (typeof renderTrickTray === 'function') renderTrickTray();
    if (typeof updateKnackList === 'function') updateKnackList();
    if (typeof sleightBoardRetier === 'function') sleightBoardRetier();   // r613: board Sleights wear bands
  });
}

// Knock one tier OFF. The counterpart to improveEntity, and the first thing in
// the game that can move a tier down (the Review card state's idle half). It
// goes through applyEntityTiers exactly as improveEntity does, so BAL is
// rewritten and the printed description follows the number back down - a Trick
// that silently kept quoting its improved value would be worse than not
// downgrading at all. Floors at 0; returns the new tier.
function downgradeEntity(id) {
  const cur = entityTierOf(id);
  if (cur <= 0) return 0;
  entityTier[id] = cur - 1;
  applyEntityTiers();
  improveRepaintArt();
  return entityTier[id];
}

function resetEntityTiers() { entityTier = {}; applyEntityTiers(); }

// ── Which of your entities gets improved ─────────────────────────────────────
// Owned, improvable, not already maxed. Drawn through the SHARED rarity draw
// (pickEntityByRarity, js/luck.js), so it reads the same probability table as
// every other entity draw and Luck tilts it the same way. Owning three commons
// and one rare therefore favours a common twice over: once because there are
// three of them, and again because the table itself leans common.
function ownedImprovable(type) {
  const rar = e => e.tier || e.rarity || 'common';
  let list = [];
  if (type === 'trick')   list = trickTray;
  if (type === 'knack')   list = (typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []) || [];
  if (type === 'sleight') list = (typeof allOwnedSleightCards === 'function')
      ? dedupeById(allOwnedSleightCards().map(c => (typeof sleightDef === 'function' ? sleightDef(c) : null)).filter(Boolean))
      : [];
  return list.filter(e => e && canImprove(e.id)).map(e => ({ id: e.id, name: e.name, rarity: rar(e) }));
}

function dedupeById(list) {
  const seen = new Set(), out = [];
  list.forEach(e => { if (e && !seen.has(e.id)) { seen.add(e.id); out.push(e); } });
  return out;
}

function pickImproveTarget(type) {
  const pool = ownedImprovable(type);
  if (!pool.length) return null;
  if (typeof pickEntityByRarity === 'function') {
    const hit = pickEntityByRarity(pool, e => e.rarity);
    if (hit) return hit;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// What one more improvement would read as, without leaving anything changed.
// Temporarily bumping and restoring is safe here: applyEntityTiers is pure over
// entityTier + BAL_BASE, and JS is single-threaded so nothing observes the gap.
function improvePreview(id) {
  const src = () => {
    for (const p of [typeof TRICK_POOL !== 'undefined' ? TRICK_POOL : [],
                     typeof KNACK_POOL !== 'undefined' ? KNACK_POOL : [],
                     typeof SLEIGHT_POOL !== 'undefined' ? SLEIGHT_POOL : []]) {
      const hit = p.find(e => e.id === id);
      if (hit) return hit;
    }
    return null;
  };
  const e = src();
  if (!e) return null;
  const before = e.desc, was = entityTierOf(id);
  if (!canImprove(id)) return { before, after: before, tier: was };
  entityTier[id] = was + 1;
  applyEntityTiers();
  const after = src().desc;
  entityTier[id] = was;
  applyEntityTiers();
  return { before, after, tier: was + 1 };
}

// ── THE DELTA, IN ONE SENTENCE (r281) ───────────────────────────────────────
// An improve offer used to print the WHOLE description TWICE - the old one, an
// arrow, the new one. On a 120px reward tile that is two paragraphs of nearly
// identical prose with the one thing that actually changed buried in the middle
// of each. Owner's call: print the sentence ONCE and mark the number that moves
// where it stands, "+5 (-> +10)".
//
// IT WORKS BECAUSE THE TWO SENTENCES ARE THE SAME SENTENCE. applyBalDescriptions
// regenerates `desc` from BAL through one template, and the typed descriptions
// are rewritten by substituting the number into the pristine text - so before
// and after are word-for-word identical apart from their numbers. Splitting both
// on digit runs and walking them in parallel therefore pairs each number with
// its counterpart.
//
// IF THAT STOPS BEING TRUE THE WALK BAILS AND RETURNS null, and every caller
// falls back to printing both descriptions. A different number COUNT, or any
// difference in the words between two numbers - a template that rewords itself,
// a hand-typed sentence that says "double" at one tier and "triple" at the next
// - means we are not looking at one sentence with a number in it, and a delta
// drawn over two different sentences would be a lie the player cannot check.
const _IMP_NUM_SPLIT = /(\d+(?:\.\d+)?)/;

// The sign or multiplier glued to a number reads as PART of the number, so it
// has to travel with it: "+5", "x1.5", "+x0.75", "2x", "25%", "3s". Left behind,
// the parenthetical says "5 (-> 10)" next to a stranded +.
function _impIsMulCh(ch) { return ch === '×' || ch === 'x' || ch === 'X'; }
function _impTakePrefix(lit) {
  let i = lit.length, pre = '';
  // A bare x is only a multiplier when it is not the tail of a word ("max 60s").
  if (i > 0 && _impIsMulCh(lit[i - 1]) &&
      (lit[i - 1] === '×' || !/[A-Za-z]/.test(lit[i - 2] || ''))) { pre = lit[i - 1] + pre; i--; }
  // ...and a sign is only a sign when it is not the dash of a range ("3-5").
  if (i > 0 && (lit[i - 1] === '+' || lit[i - 1] === '-') && !/\d/.test(lit[i - 2] || '')) { pre = lit[i - 1] + pre; i--; }
  return [lit.slice(0, i), pre];
}
function _impTakeSuffix(lit) {
  const c = lit[0];
  if (c === '%' || c === '×') return [c, lit.slice(1)];
  // "2x mult" / "3s of clock" - but never "15 seconds", where the s opens a word.
  if ((c === 'x' || c === 'X' || c === 's') && !/[A-Za-z]/.test(lit[1] || '')) return [c, lit.slice(1)];
  return ['', lit];
}

// The description, once, with every number that moves marked in place.
// Returns null when the two are not the same sentence - see above.
function improveDeltaHTML(before, after) {
  const a = before == null ? '' : String(before);
  const b = after  == null ? '' : String(after);
  if (!a || a === b) return null;
  const pa = a.split(_IMP_NUM_SPLIT), pb = b.split(_IMP_NUM_SPLIT);
  if (pa.length !== pb.length) return null;

  const lits = [], nums = [], numsB = [];
  for (let i = 0; i < pa.length; i++) {
    if (i % 2 === 0) { if (pa[i] !== pb[i]) return null; lits.push(pa[i]); }
    else { nums.push(pa[i]); numsB.push(pb[i]); }
  }
  const marks = [];
  let moved = 0;
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] === numsB[i]) { marks.push(null); continue; }
    // Left to right, and the two takes work on OPPOSITE ends of a literal, so a
    // literal sitting between two changed numbers can safely give up both.
    const pre = _impTakePrefix(lits[i]);
    lits[i] = pre[0];
    const suf = _impTakeSuffix(lits[i + 1]);
    lits[i + 1] = suf[1];
    marks.push({ pre: pre[1], suf: suf[0] });
    moved++;
  }
  if (!moved) return null;

  let out = lits[0];
  for (let i = 0; i < nums.length; i++) {
    const m = marks[i];
    out += m
      ? `<b class="imp-was">${m.pre}${nums[i]}${m.suf}</b> <b class="imp-now">(→ ${m.pre}${numsB[i]}${m.suf})</b>`
      : nums[i];
    out += lits[i + 1];
  }
  return out;
}

// What an improve offer should print: the sentence with its deltas marked, or
// null when that cannot be done honestly. One helper so the reward grid, the
// shop, the events and the dev panel cannot drift apart on the fallback.
function improveDeltaFor(id) {
  const pv = (typeof improvePreview === 'function') ? improvePreview(id) : null;
  if (!pv || pv.after === pv.before) return null;
  return improveDeltaHTML(pv.before, pv.after);
}


// Snapshot the printed text before anything can have improved. balance.js has
// already run applyBalDescriptions() by the time this file loads, so what is
// captured here is the real base wording for both templated and typed entities.
captureDescBase();
