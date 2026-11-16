// ══════════════════════════════════════════════
// PER-CARD x MULT (r785): the second family moved to TRICK_FX. Each multiplies
// the running mult on the card's own beat, once per replay, after the card's
// adds (calcScore's `_xl` list, r359).
//
//   cardXMult(x)   the factor for this card (a number), { f, replay: true } for
//                  one that fires only on a REPLAY of the card, or nothing.
//   x: { card, rank, ghost, at: [r, c], reps, h }
//      `ghost`: this pass is a dual card's second rank or suit; a behaviour
//      about position or the whole hand stands down for it (it already paid).
// A muted or Leaden card fires none of them (calcScore's check).
// ══════════════════════════════════════════════
fxDefine('what_odds',      { cardXMult: x => _rankIsOddRank(x.rank) ? TB('what_odds').mult_mult : null });
// Rainbow (r539): a four-suit hand, x mult on each card.
fxDefine('full_color',     { cardXMult: x => (!x.ghost && x.h.suitCount === 4 && !isWildCard(x.card)) ? BAL.full_color.mult_mult : null });
// Patient Rulers: its ranks (and the three rolled at its 5th improvement) once the clock has been paused or rewound this round.
fxDefine('patient_rulers', { cardXMult: x => ((rkHas('patient_rulers', x.rank) || (ownedTrickObj('patient_rulers')?._prRanks || []).includes(x.rank))
  && (pausesThisRound > 0 || rewindsThisRound > 0)) ? BAL.patient_rulers.mult_mult : null });
fxDefine('obsessed',       { cardXMult: x => (x.card.suit === '♥' && coins > 0) ? 1 + coins / TB('obsessed').per_credits : null });
// Relentless (r367): x(0.05 per spade scored since taking it), never below x1.
fxDefine('relentless',     { cardXMult: x => {
  if (x.card.suit !== '♠') return null;
  const f = Math.round(spadesRelentless * BAL.relentless.mult_per_spade * 100) / 100;
  return f > 1 ? f : null;
} });
fxDefine('feelin_lucky',   { cardXMult: x => { const rk = ownedTrickObj('feelin_lucky')?._luckyRanks; return (rk && rk.includes(x.rank)) ? BAL.feelin_lucky.mult_mult : null; } });
// Ornery (r607): a card in a corner cell.
fxDefine('two_corners',    { cardXMult: x => (!x.ghost && isCorner(x.at[0], x.at[1])) ? TB('two_corners').mult_mult : null });
// Chorus (r637): on each REPLAY of the card, not its first scoring.
fxDefine('chorus',         { cardXMult: x => (!x.ghost && x.reps > 1) ? { f: TB('chorus').mult_mult, replay: true } : null });
// High Voltage (r646): a card in its marked line; the second line pays the base value.
fxDefine('line_xmult',     { cardXMult: x => {
  if (x.ghost) return null;
  const k = markedLineKind(x.at[0], x.at[1], 'line_xmult'); if (!k) return null;
  const f = k === 'main' ? TB('line_xmult').mult_mult : TB('line_xmult').line2;
  return (f > 0 && f !== 1) ? f : null;
} });
