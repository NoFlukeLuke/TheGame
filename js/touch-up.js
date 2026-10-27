// ══════════════════════════════════════════════════════════════════════════════
// TOUCH-UP (r677, owner; working name). A knack.
// ══════════════════════════════════════════════════════════════════════════════
// When a level is cleared (touchUpOnClear, from captureGoalHand and the challenge
// round's two goal exits), if the grid holds no more than BAL.touch_up.max buffed
// cards, BAL.touch_up.cards cards on it each take one random buff, unbuffed cards
// first. The goal hand's cards are leaving the board, so they are not counted or
// buffed. The buffs are the deck editor's own rows and values (FLOWR_DECK_OPS):
//   kinds 1: +pips or +mult
//   kinds 2: and x pips, x mult
//   kinds 3: and a second rank, a second suit
// every kind on the list equally likely (owner: no regard for rarity). A buffed
// card is one with any buff line (cardBuffLines) or a second rank / suit.
// The ladder (IMPROVE_PLAN, js/improve.js): v2 x buffs, v3 6 cards, v4 up to 3
// buffed cards allowed, v5 second rank and suit, v6 8 cards and up to 6 allowed.

const TU_KINDS = ['pips', 'mult', 'xpips', 'xmult', 'suit2', 'rank2'];

function tuCardBuffed(c) {
  return !!c && ((typeof cardBuffLines === 'function' && cardBuffLines(cardId(c), c).length > 0) || (typeof cardIsDual === 'function' && cardIsDual(c)));
}
// An ordinary card of the deck: not a Sleight, stone, junk, challenge or temp card, not a wild.
function tuCanTake(c) {
  return !!(c && c.rank && !c._isSleight && !c._isStone && !c._isChallenge && !c.isChallenge && !c._isReshuffle
    && !c._isTrick && !c._temp && !(typeof isWildCard === 'function' && isWildCard(c)));
}
function tuKindsFor(c) {
  const n = { 1: 2, 2: 4, 3: 6 }[BAL.touch_up.kinds] || 2;
  return TU_KINDS.slice(0, n).filter(k => {
    if (k === 'suit2') return !c.suit2 && ((typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS) || []).some(s => s !== c.suit);
    if (k === 'rank2') return !c.rank2 && tuNextRanks(c).length > 0;
    return true;
  });
}
function tuNextRanks(c) {
  const rk = (typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS) || [];
  const i = rk.indexOf(c.rank);
  return i < 0 ? [] : [rk[i - 1], rk[i + 1]].filter(r => r && !(typeof isWildRank === 'function' && isWildRank(r)));
}
// One buff on one card. Returns the words for it ("+12 pips").
function tuBuffCard(c) {
  const kinds = tuKindsFor(c); if (!kinds.length) return null;
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  if (k === 'suit2') {
    const s = ACTIVE_SUITS.filter(x => x !== c.suit); c.suit2 = s[Math.floor(Math.random() * s.length)];
    if (typeof cardAnimOn === 'function') setTimeout(() => cardAnimOn('buff', cardAnimEls([cardId(c)]), { color: '#e8b0ff' }), 0);
    return `second suit ${c.suit2}`;
  }
  if (k === 'rank2') {
    const r = tuNextRanks(c); c.rank2 = r[Math.floor(Math.random() * r.length)];
    if (typeof cardAnimOn === 'function') setTimeout(() => cardAnimOn('buff', cardAnimEls([cardId(c)]), { color: '#e8b0ff' }), 0);
    return `second rank ${c.rank2}`;
  }
  const op = FLOWR_DECK_OPS.find(o => o.id === k);
  const v = (typeof flowrValRoll === 'function') ? flowrValRoll(op.buff.range) : op.buff.range[0];
  enhanceCardKey(cardId(c), { [op.buff.key]: v });
  return op.buff.x ? `×${v} ${k === 'xpips' ? 'pips' : 'mult'}` : `+${v} ${op.buff.word}`;
}
// `leaving`: the goal hand's cells, gone from the board at the round's end.
function touchUpOnClear(leaving) {
  if (typeof hasKnack !== 'function' || !hasKnack('touch_up') || !BAL.touch_up) return;
  const out = new Set((leaving || []).map(([r, c]) => gridData[r]?.[c]).filter(Boolean));
  const cards = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) { const cd = gridData[r]?.[c]; if (cd && !out.has(cd) && cd.rank && !cd._isSleight && !cd._isStone) cards.push(cd); }
  if (cards.filter(tuCardBuffed).length > BAL.touch_up.max) return;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ok = cards.filter(c => tuCanTake(c) && tuKindsFor(c).length);
  const pick = shuffle(ok.filter(c => !tuCardBuffed(c))).concat(shuffle(ok.filter(tuCardBuffed))).slice(0, BAL.touch_up.cards);
  if (!pick.length) return;
  const said = pick.map(c => { const w = tuBuffCard(c); return w ? `${cardLabel(c)} ${w}` : null; }).filter(Boolean);
  if (typeof clearHandCompCache === 'function') clearHandCompCache();
  if (!(typeof gridScreenOwnsBoard === 'function' && gridScreenOwnsBoard())) { try { render(); } catch (e) {} }
  const tray = document.getElementById('knack-list');
  if (tray && typeof trayFxTrigger === 'function') trayFxTrigger(tray);
  const k = acquiredKnacks.find(x => x && x.id === 'touch_up');
  showMessage(`${k ? k.name : 'Touch-Up'}: ${said.join(', ')}`, '#e8c04a');
}
