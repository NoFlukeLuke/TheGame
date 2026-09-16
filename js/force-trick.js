// ══════════════════════════════════════════════
// FORCED TRICK FIRES (r234) - going off with the "if" removed
// ══════════════════════════════════════════════
// The game already had one way to make a Trick fire again: PRIMING. A primed
// Trick (Inspirato, Prime Times, Rehearsal's permanent `_rank`, the Understudy
// knack) replays the pip/mult DELTA it reported this hand - `_cp[id]` / `_cm[id]`
// in calcScore. That is what makes priming generic across all 177 Tricks with no
// code in any of them.
//
// **And it is exactly why priming cannot do this job.** The replay loop opens
// with `if (!_pd && !_md) return;` - a Trick that did not fire has no delta to
// duplicate, so priming a Trick whose condition was not met does NOTHING AT ALL.
// Prime Rich Soil on a hand with no clubs and you get nothing; prime it twice
// and you get nothing twice.
//
// A FORCED fire is the other half: it ignores the Trick's condition entirely and
// pays it anyway. "Three of a kind or better" did not happen, "at least 3 clubs"
// did not happen - it pays regardless.
//
// ── HOW IT PAYS, AND WHY IT IS NOT PER-TRICK CODE ───────────────────────────
// A Trick's condition lives inline in calcScore as `if (hasTrick('x') && cond)`,
// 177 times over. There is no seam to switch off, and writing a forced payout
// for each one by hand is 177 numbers that would drift from BAL the first time
// anything was retuned.
//
// So a forced fire pays the Trick's NOMINAL payout, read live out of `BAL[id]`
// through the same parameter vocabulary `js/improve.js` already uses to decide
// what an improvement scales. That file's rule was "only the bonus amount grows";
// the same set of names is "only the bonus amount pays", which is the same
// question asked twice. A retune in BAL moves both, and an entity improved to
// tier 3 forces at its tier-3 value for free, because `applyEntityTiers()`
// rewrites BAL in place.
//
// **This is an approximation and it is a deliberate one.** A forced Rogue Wave
// pays what Rogue Wave is worth; it does not re-run Rogue Wave's geometry. Two
// consequences worth knowing:
//   - A Trick whose payout is not in BAL at all (its numbers are typed into the
//     description) forces for nothing. `trickCanForce(id)` reports that, and the
//     callers draw only from Tricks that can actually pay.
//   - NON-SCORING side effects do not fire. A forced Tick-Tock pays no seconds.
//     That is the same limit priming has had since it was written (see the
//     "TBD" on Move as One), and the same reason `trickFires()` had to exist.
//
// ── IT IS ARMED OUTSIDE calcScore AND SPENT IN playHand ─────────────────────
// calcScore is called SPECULATIVELY - by findBestHand for every connected subset,
// and by the live PIPS/MULT preview on every tap. Anything that consumes a charge
// there fires dozens of times per selection. So `forcedTrickIds` is READ ONLY
// inside calcScore and cleared in playHand once the hand is committed, which is
// the rule `siphonMultX` and `minuteHandCharges` already follow.

// Trick ids to fire unconditionally on the NEXT scored hand. Armed by whatever
// grants a forced fire (today: the Hallmark knack), spent in playHand.
let forcedTrickIds = [];

// ── The BAL parameter vocabulary ────────────────────────────────────────────
// Classified by what the number IS, not by which Trick owns it. Names are taken
// from IMPROVE_ADD / IMPROVE_MUL in js/improve.js - the same allowlist, split by
// whether the number lands on pips or on mult.
//
// An ALLOWLIST, for the reason improve.js gives: a tuning number added to BAL
// later must not silently start paying out. Thresholds, intervals, costs,
// chances, cooldowns and requirements are all absent on purpose - forcing a
// Trick must never pay its `interval_seconds` as pips.
const FORCE_PIP_ADD = new Set([
  'pips', 'flat_pips', 'face_pips', 'perm_pips', 'worth', 'base',
  'pips_per_card', 'pips_per_level', 'pips_per_streak', 'pips_per_hand',
  'pips_per_discard', 'pips_per_charge', 'pips_per_second', 'pips_per_adj',
  'pips_per_five', 'pips_per_interval', 'pips_per',
]);
const FORCE_MULT_ADD = new Set([
  'mult', 'extra_mult', 'perm_mult', 'per_jack',
  'mult_per_card', 'mult_per_sleight', 'mult_per_hand', 'mult_per_interval',
  'mult_per_pause', 'mult_per_ace', 'mult_per_jack', 'mult_per_match',
  'mult_per_prior', 'mult_per_nine', 'mult_per_milestone', 'mult_per_type',
  'mult_per_event', 'mult_per_n', 'mult_per', 'mult_step',
]);
// A STEP is an increment, never a factor. `undertow` is the whole lesson:
// `{ pip_mult_base: 1.5, pip_mult_step: 0.5 }` is "x1.5 pips, plus x0.5 more per
// card beyond 3". Treating the step as a second factor multiplied 1.5 by 0.5 and
// produced **x0.75 - a forced fire that REDUCED the score by a quarter**, which
// is the one thing a bonus may never do. Measured before the fix. The base is
// the factor; the step belongs to a per-card ramp a forced fire does not re-run.
const FORCE_PIP_MUL  = new Set(['pip_mult', 'pip_mult_base']);
const FORCE_MULT_MUL = new Set(['mult_mult', 'multiplier', 'mult_x']);

// A param naming a RATE ("+2 mult per even card") pays once per card in the
// hand, because that is what the Trick would have paid had its condition held.
// A flat param pays once. `_per_card` is the only rate this can resolve from the
// hand alone - every other `_per_*` counts something the forced fire has no
// business re-deriving (streaks, credits held, prior hands), so those pay their
// rate ONCE rather than guessing at a multiplier.
function _forceIsPerCard(k) { return k === 'pips_per_card' || k === 'mult_per_card' || k === 'focus_per_card'; }

// What forcing this Trick would pay, given a hand of `cardCount` cards.
// Returns { pips, mult, pipX, multX } - the multiplies kept separate from the
// adds so calcScore can apply each at its own site and the dance can show a
// "x2" as a multiply rather than as a meaningless delta (r220).
function trickForcedPayout(id, cardCount) {
  const out = { pips: 0, mult: 0, pipX: 1, multX: 1 };
  const B = (typeof BAL !== 'undefined') ? BAL[id] : null;
  if (!B || typeof B !== 'object') return out;
  const n = Math.max(1, cardCount || 1);
  for (const k in B) {
    const v = B[k];
    if (typeof v !== 'number' || !isFinite(v)) continue;
    const per = _forceIsPerCard(k) ? n : 1;
    if      (FORCE_PIP_ADD.has(k))  out.pips += v * per;
    else if (FORCE_MULT_ADD.has(k)) out.mult += v * per;
    else if (FORCE_PIP_MUL.has(k))  out.pipX  *= v;
    else if (FORCE_MULT_MUL.has(k)) out.multX *= v;
  }
  // `force_scale` is the owner's one dial on how hard a forced fire hits, with no
  // code change: forcing pays the Trick's real value, and a Trick's real value
  // spans two orders of magnitude (measured below). Only the ADDS are scaled -
  // a multiplier is the Trick's identity ("x1.5 pips") and scaling it would make
  // the forced version a different effect rather than a smaller one.
  const sc = (typeof BAL !== 'undefined' && BAL.hallmark && BAL.hallmark.force_scale != null)
    ? BAL.hallmark.force_scale : 1;
  out.pips = Math.round(out.pips * sc);
  out.mult = Math.round(out.mult * sc * 10) / 10;
  // A forced fire is a BONUS. It may pay nothing (a Trick whose payout is not in
  // BAL) but it may never cost - see the undertow note above for how a stray
  // multiplier gets below 1 without anyone intending it.
  out.pipX  = Math.max(1, out.pipX);
  out.multX = Math.max(1, out.multX);
  return out;
}

// Can this Trick be forced to any effect at all? A Trick with no BAL entry - or
// one whose entry holds only thresholds and intervals - would force for a
// visible message and zero score, which reads as the effect being broken. Every
// caller draws from `forceableTrickIds()` instead of from the whole tray.
function trickCanForce(id) {
  const p = trickForcedPayout(id, 5);
  return p.pips !== 0 || p.mult !== 0 || p.pipX !== 1 || p.multX !== 1;
}

// The Tricks you own that a forced fire could actually pay for. Excludes any a
// boss has switched off - a suspended Trick is suspended, and routing round that
// would make the Censor and the Voidwright optional.
function forceableTrickIds() {
  if (typeof trickTray === 'undefined' || !trickTrayMode) return [];
  return trickTray
    .filter(t => t && t.id && trickCanForce(t.id))
    .filter(t => !(typeof isTrickDisabledByBoss === 'function' && isTrickDisabledByBoss(t.id)))
    .map(t => t.id);
}

// Arm a forced fire for the next scored hand. Stacks: forcing the same Trick
// twice pays it twice, exactly as two prime stacks would.
function armForcedTrick(id) {
  if (!id) return false;
  forcedTrickIds.push(id);
  return true;
}

// Arm one at random from what you own. Returns the Trick, or null if nothing you
// hold can be forced to any effect.
function armRandomForcedTrick() {
  const ids = forceableTrickIds();
  if (!ids.length) return null;
  const id = ids[Math.floor(Math.random() * ids.length)];
  armForcedTrick(id);
  return (typeof trickTray !== 'undefined') ? trickTray.find(t => t.id === id) || null : null;
}
