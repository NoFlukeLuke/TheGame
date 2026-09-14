// ══════════════════════════════════════════════════════════════════════════
// RARITY ROLLS (r201) - the ONE place an offer's tier is decided.
//
// Before this there were THREE live distributions and most of the game used
// none of them. Measured over 200k draws:
//
//   weight table [58,28,11,3]   58 / 28 / 11 / 3    Mart, shop Sleights
//   UNIFORM over the pool       28 / 38 / 28 / 7    reward-grid Tricks, shop
//                                                   Tricks, the pick-of-three
//   a stale 3-tier bag          63 / 28 / 7 / 2     pickTrickOptions
//
// The uniform paths had no weighting at all - `pool[random * pool.length]` -
// so the POOL COMPOSITION was the drop rate. The pool is 49/66/50/12, which is
// why "common" was rarer than "rare" and a run saw ~2.0 Deluxe Utilities
// against 0.54 Partner Vendors for the same named tier.
//
// Everything now calls pickByRarity(). That is also what makes LUCK work
// everywhere by construction rather than by remembering to add it at N sites.
// ══════════════════════════════════════════════════════════════════════════

// Low to high. Must match TIER_IDS in js/labels.js.
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

// The standard offer spread: shops, the Mart, reward grids, the pick-of-three.
const RARITY_WEIGHTS = { common: 71, rare: 22, epic: 5.5, legendary: 1.5 };

// The PRIZE grid (post-boss) is deliberately top-heavy and centred on rare.
// NOTE: this table includes common, which means the prize grid no longer
// strips commons out of its pools - see the r201 note in js/reward-grid.js.
const PRIZE_RARITY_WEIGHTS = { common: 36, rare: 51, epic: 10, legendary: 3 };

// ── LUCK ───────────────────────────────────────────────────────────────────
// One number, applied to every roll. 0 is the shipped balance.
//
// The shape is a GEOMETRIC TILT: each tier above common is multiplied by
// (1 + LUCK_TILT*luck) once more than the tier below it, then the whole thing
// is renormalised. That is the right shape for luck because it is monotonic
// (more luck never makes a better tier less likely), it cannot produce a
// negative weight the way a flat subtraction can, and it scales the TOP tier
// hardest - which is what a player means by lucky.
let runLuck = 0;
const LUCK_TILT = 0.25;

function luckedWeights(base, luck) {
  const L = (luck === undefined) ? runLuck : luck;
  const t = 1 + LUCK_TILT * L;
  const out = {};
  RARITY_ORDER.forEach((id, i) => { out[id] = (base[id] || 0) * Math.pow(t, i); });
  return out;
}

// Roll a tier id. `base` defaults to the standard spread.
function rollRarity(base, luck) {
  const w = luckedWeights(base || RARITY_WEIGHTS, luck);
  let total = 0; RARITY_ORDER.forEach(id => { total += w[id]; });
  if (total <= 0) return 'common';
  let r = Math.random() * total;
  for (const id of RARITY_ORDER) { r -= w[id]; if (r <= 0) return id; }
  return RARITY_ORDER[RARITY_ORDER.length - 1];
}

// ── the universal picker ───────────────────────────────────────────────────
// Roll a tier, then pick uniformly from the pool entries at that tier.
//
// `key` is 'tier' for Tricks and 'rarity' for everything else - the two data
// pools disagree and always have, which is exactly the kind of detail that
// should live in one function rather than at every call site.
//
// CASCADE: a filtered pool often has no entry at the rolled tier (owned Tricks
// removed, a mode ban list, a prize grid). It then steps DOWN to the next tier
// that has something, and only if nothing below exists does it step UP. Down
// first, because stepping up would hand out a rarer entity than the roll said.
function pickByRarity(pool, opts = {}) {
  if (!pool || !pool.length) return null;
  const key = opts.key || 'rarity';
  const buckets = {};
  RARITY_ORDER.forEach(id => { buckets[id] = []; });
  pool.forEach(e => {
    const t = (typeof tierId === 'function') ? tierId(e[key]) : (e[key] || 'common');
    (buckets[t] || buckets.common).push(e);
  });
  const rolled = rollRarity(opts.weights, opts.luck);
  const at = RARITY_ORDER.indexOf(rolled);
  for (let i = at; i >= 0; i--) { const b = buckets[RARITY_ORDER[i]]; if (b.length) return b[Math.floor(Math.random() * b.length)]; }
  for (let i = at + 1; i < RARITY_ORDER.length; i++) { const b = buckets[RARITY_ORDER[i]]; if (b.length) return b[Math.floor(Math.random() * b.length)]; }
  return pool[Math.floor(Math.random() * pool.length)];
}

// n distinct entries, weighted. Used where a screen offers several at once.
function pickManyByRarity(pool, n, opts = {}) {
  const out = [], seen = new Set();
  let guard = n * 12;
  while (out.length < n && guard-- > 0) {
    const left = pool.filter(e => !seen.has(e.id));
    if (!left.length) break;
    const p = pickByRarity(left, opts);
    if (!p) break;
    seen.add(p.id); out.push(p);
  }
  return out;
}

// ── dev tuner (dev panel -> Score -> Luck) ─────────────────────────────────
function devSetLuck(v) {
  runLuck = Math.max(-4, Math.min(12, Math.round(v || 0)));
  const el = document.getElementById('dev-luck-val');
  if (el) el.textContent = runLuck;
  const pv = document.getElementById('dev-luck-preview');
  if (pv) {
    const w = luckedWeights(RARITY_WEIGHTS);
    let t = 0; RARITY_ORDER.forEach(id => { t += w[id]; });
    pv.textContent = RARITY_ORDER.map(id =>
      `${tierLabel('trick', id)} ${(w[id] / t * 100).toFixed(1)}%`).join('  ·  ');
  }
  return runLuck;
}
