// ══════════════════════════════════════════════
// TRICK BEHAVIOURS (r785, SCORING_REWORK.md stages 2 and 3; owner: "the full
// rebuild", "align well with Godot").
//
// A Trick is DATA plus a BEHAVIOUR:
//   data        its pool row (js/data/tricks.js), its BAL row, its template and
//               its improvement ladder. Unchanged.
//   behaviour   TRICK_FX[id]: one object, one function per MOMENT it cares
//               about. One file per family in this folder.
//   instance    the tray entry (it already carries its line, rolled ranks,
//               primes and permanent primes). Two copies are two instances.
//
// The runner walks the TRAY, left to right, and asks only the Tricks you own
// (fxLive). calcScore used to ask every Trick in the game "do you own this?".
// A fused Trick (`acts: [a, b]`) and Temp (`acts: [form]`) run their parts'
// behaviours and are billed as themselves, as before.
//
// MOMENTS (the Godot method names are the same words in snake_case):
//   handWhen(h)        does it take part in this hand at all (asked once)
//   card(card, h, at)  { pip, mult } for THIS card on its beat, per replay
//   forced(x)          what ONE forced trigger pays when the Trick's own
//                      condition did not go off (see fxForcedPay below)
// More moments join as their families move over (SCORING_REWORK.md lists them).
// `h` is the hand's facts (calcScore's `_pcCtx`): read-only, computed once.
//
// GODOT: TRICK_FX[id] is a script extending TrickBehaviour with one virtual
// method per moment; the tray entry is a TrickInstance; `h` / `x` are the
// ScoreContext; fxLive is the tray iterating its children. Nothing here reads
// the DOM, so the file ports as written.
// ══════════════════════════════════════════════
const TRICK_FX = {};
function fxDefine(id, def) { TRICK_FX[id] = Object.assign(TRICK_FX[id] || {}, def); return TRICK_FX[id]; }
function fxOf(id) { return TRICK_FX[id] || null; }

// Copies: a second copy of one Trick pays once today (hasTrick is a yes / no).
// Stage 5 turns this on, with the owner's calls on versions and tray order.
const FX_COPIES = false;

// The tray as behaviours, left to right: [{ inst, id }], `id` the behaviour that
// runs (the Trick's own, or each part a fused Trick / Temp stands in for). A Trick
// a boss or a card state has switched off is skipped, as hasTrick skips it.
function fxTrayWalk() {
  const out = [], seen = new Set();
  if (typeof trickTray === 'undefined') return out;
  for (const inst of trickTray) {
    if (!inst || !inst.id) continue;
    const ids = (inst.acts && inst.acts.length) ? [inst.id, ...inst.acts] : [inst.id];
    for (const id of ids) {
      if (!FX_COPIES && seen.has(id)) continue;
      if (!hasTrick(id)) continue;
      seen.add(id); out.push({ inst, id });
    }
  }
  return out;
}
// The behaviours with `moment` that take part in this hand, in tray order.
function fxLive(moment, h) {
  const out = [];
  for (const w of fxTrayWalk()) {
    const fx = TRICK_FX[w.id];
    if (!fx || !fx[moment]) continue;
    if (fx.handWhen && !fx.handWhen(h)) continue;
    out.push({ inst: w.inst, id: w.id, fx });
  }
  return out;
}
// How many copies of a Trick the tray holds (hasTrick's sibling).
function trickCount(id) {
  if (typeof trickTray === 'undefined' || !hasTrick(id)) return 0;
  return trickTray.filter(t => t && (t.id === id || (t.acts && t.acts.includes(id)))).length;
}

// ── FORCED TRIGGERS OF WHAT IS NOT PIPS OR MULT (r785, owner: "make forced
// resources still work") ─────────────────────────────────────────────────────
// A forced trigger pays the Trick once whether or not its condition was met.
// Pips and mult are written into the hand's timeline (calcPrimePass). Everything
// else a Trick pays (Focus, seconds, a pause, credits, swaps, discards) is paid
// by its own site in playHand, which a failed condition never reaches. So after
// those sites have run, fxForcedSettle pays every forced Trick that did not go
// off: its behaviour's `forced(x)` if it has one, else the DEFAULT, which reads
// the Trick's BAL row the way trickForcedPayout reads it for pips and mult: the
// listed value, once. The Trick's primes go off with it (primeExtraFor) and are
// spent by runHandPriming, which already counts a forced Trick as fired.
// FX_RES maps a BAL key to what it pays. A key not listed pays nothing.
const FX_RES = [
  [/^focus(_per_card|_per_2)?$/,            'focus'],
  [/^(seconds|rewind_seconds|rewind)$/,     'rewind'],
  [/^(pause|pause_seconds|pause_per_set)$/, 'pause'],
  [/^(credits|coins|credits_per_card)$/,    'credits'],
  [/^swaps$/,                               'swaps'],
  [/^discards$/,                            'discards'],
];
// A listed number that is a cost, not a payout.
const FX_FORCE_SKIP = new Set(['severance_package']);
function fxForcedPlan(id, cardCount) {
  const out = { focus: 0, rewind: 0, pause: 0, credits: 0, swaps: 0, discards: 0 };
  if (FX_FORCE_SKIP.has(id)) return out;
  const B = (typeof TB === 'function') ? TB(id) : (typeof BAL !== 'undefined' ? BAL[id] : null);
  if (!B || typeof B !== 'object') return out;
  const n = Math.max(1, cardCount || 1);
  for (const k in B) {
    const v = B[k]; if (typeof v !== 'number' || !isFinite(v) || !(v > 0)) continue;
    const row = FX_RES.find(r => r[0].test(k)); if (!row) continue;
    out[row[1]] += v * (/_per_card$/.test(k) ? n : 1);
  }
  return out;
}
function fxForcedHasPay(id) {
  const fx = TRICK_FX[id];
  if (fx && fx.forced) return true;
  const p = fxForcedPlan(id, 5);
  return Object.keys(p).some(k => p[k] > 0);
}
// Pay `n` triggers of one Trick's listed values. `x`: { cells } (the hand).
function fxForcedPay(id, n, x) {
  if (!(n > 0)) return null;
  const fx = TRICK_FX[id];
  if (fx && fx.forced) return fx.forced(Object.assign({ id, n }, x || {}));
  const p = fxForcedPlan(id, x && x.cells ? x.cells.length : 1), name = (typeof trickNameOf === 'function') ? trickNameOf(id) : id;
  if (p.focus > 0 && typeof addFocus === 'function') addFocus(p.focus * n, id);
  if (p.rewind > 0 && typeof rewindTime === 'function') rewindTime(p.rewind * n, `${name} - rewound ${p.rewind * n}s`, id, 'trick');
  if (p.pause > 0 && typeof pauseRound === 'function') pauseRound(p.pause * n, id, 'trick');
  if (p.credits > 0 && typeof grantEntityCoins === 'function') grantEntityCoins(Math.round(p.credits * n), 'trick', id);
  if (p.swaps > 0 && typeof swaps !== 'undefined') { swaps += Math.round(p.swaps * n); if (typeof updateSelectionUI === 'function') updateSelectionUI(); }
  if (p.discards > 0 && typeof discards !== 'undefined') { discards += Math.round(p.discards * n); if (typeof updateSelectionUI === 'function') updateSelectionUI(); }
  return p;
}
// After the hand's own sites: every forced Trick that neither scored (it is in
// the hand's contributions) nor went off at its own site (trickFires recorded
// it) is paid here. `forced`: the banked ledger's forcedIds; `fired`: has(id).
function fxForcedSettle(forced, fired, x) {
  if (!forced || !forced.length) return;
  const count = {};
  forced.forEach(id => { count[id] = (count[id] || 0) + 1; });
  Object.keys(count).forEach(id => {
    if (fired(id) || !fxForcedHasPay(id)) return;
    const t = (typeof trickTray !== 'undefined') ? trickTray.find(b => b && b.id === id) : null;
    const n = count[id] + (t && typeof primeExtraFor === 'function' ? primeExtraFor(t) : 0);
    fxForcedPay(id, n, x);
    if (typeof _trickFiredThisHand !== 'undefined') _trickFiredThisHand.add(id);
    if (typeof entityPing === 'function') entityPing('trick', id);
    if (typeof noteMessage === 'function') noteMessage(`${(typeof trickNameOf === 'function') ? trickNameOf(id) : id} was force-triggered${n > 1 ? ' x' + n : ''}`, '#cf8cff');
  });
}
