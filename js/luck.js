// ══════════════════════════════════════════════
// LUCK (r196)
// ══════════════════════════════════════════════
// One stat that makes good things happen more often. Two effects, and nothing
// else in the game may roll a chance or draw a rarity without coming through
// here - see the chokepoint note below, which is the whole reason this file is
// a file and not four lines in balance.js.
//
// ── 1. Chance effects ────────────────────────────────────────────────────────
//   effective = printed x (1 + luck/100)
// Luck 10 is a nudge, luck 100 doubles every chance, and the result is ALLOWED
// PAST 100%: at 125% you get the effect once for certain and then a 25% roll for
// a second. That is why luckRoll returns a COUNT rather than a boolean, and it
// is the owner's spec - "a 125% to get +10 mult would mean you definitely get
// +10 mult, then a 25% you get an additional 10 mult."
//
// The formula is deliberately LINEAR. An odds-multiplier (p/(1-p) scaled) has
// nicer diminishing returns but asymptotes at 100% and can never reach the
// overflow above, so it was ruled out. The diminishing returns live in the
// PRICE instead - each point of Luck costs more than the last (shopLimitPrice
// scales on purchases) - which is a much easier thing to retune later than a
// formula every description depends on.
//
// ── 2. Rarity ────────────────────────────────────────────────────────────────
// luckTierWeights() shifts ENTITY_TIER_W up the ladder. See it for the shape.
//
// ── LUCK NEVER TOUCHES A ROLL AGAINST YOU ────────────────────────────────────
// Owner's call, and it is a rule rather than a default: Luck only makes good
// things happen MORE, never bad things happen LESS. The five rolls in the game
// that go against the player are deliberately NOT wired to this file:
//
//   1. The Blight muting a card's Tricks       (js/scoring.js, 20%)
//   2. The Hand of Famine swapping a draw low  (js/boss.js, 70%)
//   3. Dark Mystery resolving badly            (js/reward-grid.js, 70%)
//   4. The Gamble event's doors                (js/events.js, 60% win)
//   5. The Gamble event's stake                (js/events.js, variable)
//
// If you are adding luck to a new roll, ask which way it points first. A roll
// that decides WHICH bad thing happens rather than WHETHER one does (the
// Auditor choosing between a swap and a discard, Suspension choosing an entity)
// is not a luck roll at all - there is nothing there to improve.

// Modifiers stack on top of the limit, and unlike the limit they may go
// NEGATIVE - which is what makes a cursed-luck penalty tile possible later.
let luckModifiers = 0;

// The number every formula below reads. Floored at -100 so a chance can never
// come out negative and a rarity weight can never invert the ladder.
function luckTotal() {
  const base = (typeof limits !== 'undefined' && limits.luck) ? limits.luck.current : 0;
  return Math.max(-100, base + luckModifiers);
}
// Luck as a plain multiplier on a chance: 1.0 at luck 0, 2.0 at luck 100.
function luckScale() { return 1 + luckTotal() / 100; }

// The effective chance of a GOOD effect. May exceed 1 - that is the overflow,
// not a bug. Callers that cannot repeat should print Math.min(1, ...) instead.
function luckChance(p) { return Math.max(0, p * luckScale()); }

// HOW MANY TIMES a good effect fires. floor() of the effective chance is
// guaranteed, and the fractional remainder is one more roll.
//   0.25 -> 0 usually, 1 a quarter of the time
//   1.25 -> 1 always, 2 a quarter of the time
// A site that CANNOT repeat (a pause becoming a rewind; one outcome out of two)
// asks `luckRoll(p) > 0` and simply wastes anything above 100%. A site that CAN
// repeat loops on the count. Which one a site is is a design fact about that
// effect, so it is decided at the call site rather than guessed at here.
function luckRoll(p) {
  const eff = luckChance(p);
  let n = Math.floor(eff);
  if (Math.random() < eff - n) n++;
  return n;
}

// The same thing, DETERMINISTIC, for the two sites that must not call
// Math.random(): findBestHand scores every candidate hand through calcScore, so
// a real roll there would give the preview a different answer than the score.
// Both keep their existing hash and compare it against the luck-scaled
// threshold, so luck moves the threshold and the preview still matches.
function luckRollDet(p, id, salt) {
  const eff = luckChance(p);
  let n = Math.floor(eff);
  if (_detReplayRand(id, salt) < eff - n) n++;
  return n;
}

// ── Rarity ───────────────────────────────────────────────────────────────────
// Weight-shift: each tier above common is scaled by (1 + luck/100 x step), so
// the ladder tilts upward and renormalises itself through the existing weighted
// pick. Common is untouched at 1.0 - it is the tier everything falls back to,
// and scaling it as well would just cancel out.
//
// At luck 100 the table goes 59/28/10/2/1 -> 59/42/20/5/3, i.e. mythic roughly
// triples and common drops from 59% to about 46% of the draw once renormalised.
const LUCK_TIER_STEP = [0, 0.5, 1, 1.5, 2];   // common, rare, epic, legendary, mythic

function luckTierWeights(weights) {
  const L = luckTotal();
  if (!L) return weights;
  return weights.map((w, i) => Math.max(0, w * (1 + (L / 100) * (LUCK_TIER_STEP[i] ?? 0))));
}

// What the player would see if we printed it: the live table as percentages.
// Used by the RECORDS Limits tab so Luck is a number with a visible consequence
// rather than a stat you have to take on faith.
function luckTierPercents() {
  const w = luckTierWeights(ENTITY_TIER_W);
  const t = w.reduce((a, b) => a + b, 0) || 1;
  return w.map(x => Math.round((x / t) * 1000) / 10);
}
