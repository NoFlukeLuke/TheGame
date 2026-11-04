// ── Yoked (epic knack) ──────────────────────────────────────────────────────
// While owned, every buff a card GAINS is doubled: a flat buff twice as big, an
// x buff's bonus twice as big (x1.5 -> x2). enhanceCardKey runs every payload
// through yokeBuffs; the sites that write a store directly wrap their number in
// yokeGain. Penalties and the growth a scaling buff adds as it plays are not
// gains (the scaling buff itself was doubled when it landed).
// Improving it grows the buffs cards ALREADY hold (yokedImprove, an IMPROVE_HOOK):
// +25% rounded down (at least 1), x buffs +25% of their bonus, replays +1 at the
// 2nd and 4th improvement; the 5th doubles every buff.
const YOKE_X = { xpips: 1, xmult: 1 };
const _yr2 = v => Math.round(v * 100) / 100;

function yokeGain(kind, v) {
  if (typeof hasKnack !== 'function' || !hasKnack('yoked') || !(v > 0)) return v;
  const k = BAL.yoked.mult;
  if (YOKE_X[kind]) return v > 1 ? _yr2(1 + (v - 1) * k) : v;
  return v * k;
}
function yokeBuffs(e) {
  if (!e || typeof hasKnack !== 'function' || !hasKnack('yoked')) return e;
  const out = Object.assign({}, e);
  for (const kind of ['pips', 'mult', 'growPips', 'growMult', 'xpips', 'xmult', 'retrig', 'time', 'coin', 'focus'])
    if (out[kind]) out[kind] = yokeGain(kind, out[kind]);
  return out;
}

function yokedStores() {
  return [[permPips, 'flat'], [permMult, 'flat'], [permPipsGrow, 'flat'], [permMultGrow, 'flat'],
          [permTime, 'flat'], [permCoins, 'flat'], [permFocus, 'flat'],
          [permXPips, 'x'], [permXMult, 'x'], [permRetrig, 'replay']];
}
function yokedImprove(tier) {
  const dbl = tier >= IMPROVE_MAX_TIER;
  let n = 0;
  yokedStores().forEach(([store, how]) => {
    for (const k in store) {
      const v = store[k];
      if (how === 'x') {
        if (!(v > 1)) continue;
        store[k] = _yr2(1 + (v - 1) * (dbl ? 2 : 1.25));
      } else if (how === 'replay') {
        if (!(v > 0)) continue;
        if (dbl) store[k] = v * 2;
        else if (tier === 2 || tier === 4) store[k] = v + 1;
        else continue;
      } else {
        if (!(v > 0)) continue;
        store[k] = dbl ? v * 2 : v + Math.max(1, Math.floor(v * 0.25));
      }
      n++;
    }
  });
  if (n) noteMessage(`Yoked - ${n} card buff${n === 1 ? '' : 's'} ${dbl ? 'doubled' : 'grown'}`, 'var(--gold)');
}
