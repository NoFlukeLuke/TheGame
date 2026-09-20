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
// The ~200 sites that read a tuning number do it as `BAL.rich_soil.pips`, and
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
// config (`_resources`, `_exalt`, `_corrupt`, `wheel`, `shop_discount`), and
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
  'mult_per_sleight','mult_per_hand','mult_per_interval','mult_per_pause','mult_per_ace',
  'mult_per_jack','mult_per_match','mult_per_prior','mult_per_nine','mult_per_milestone',
  'mult_per_type','mult_per_event','mult_per_n','mult_per',
  'focus_per_2','focus_per_stock','focus_on_enter','focus_cap',
  'perm_pips','perm_mult','flat_pips','face_pips','worth','extra_mult','per_jack','base',
  'extra_replays','retrigger_count','cap_gain','seconds_per_3','max_seconds','cap_bonus',
  'mult_step','pip_mult_step','pip_mult_per_replay','mult_mult_per_replay',
  'mult_mult_per_card','pip_mult_per_10_credits','pip_mult_per_missing','chance_per',
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
  first_light:    { worth: 10 },        // Aces worth 21; the sheet says +10, not +21
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
};

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
function canImprove(id) { return !!improveStepsFor(id) && entityTierOf(id) < IMPROVE_MAX_TIER; }

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
     if (!e || !BAL_BASE[e.id]) return;
     if (typeof DESC_TEMPLATES !== 'undefined' && DESC_TEMPLATES[e.id]) return;  // generated already
     if (DESC_BASE[e.id] == null) return;
     if (!entityTierOf(e.id)) { e.desc = DESC_BASE[e.id]; return; }
     rewriteDescForTier(e);
  }));
  syncOwnedEntityDescs();
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
    (list || []).forEach(e => { const src = e && from(e.id); if (src && src.desc) e.desc = src.desc; });
  });
}

// Raise one entity's tier. Returns the new tier, or 0 when nothing happened.
function improveEntity(id) {
  if (!canImprove(id)) return 0;
  entityTier[id] = entityTierOf(id) + 1;
  applyEntityTiers();
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
  if (type === 'trick')   list = (typeof trickTray !== 'undefined' && trickTrayMode ? trickTray : acquiredTricks) || [];
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
