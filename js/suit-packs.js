// ══ SUIT PACKS: CROWNS AND CRESCENTS (r709, owner) ══════════════════════════
// The card pack screen (Flow's CARDS reward, js/flow-rewards.js) can offer a pack
// of a NEW suit in place of its last offer, SUIT_PACK_CHANCE of the time: six
// cards, no buff. The suits are the six-suit deck's two extra glyphs, so their
// colour, face and suit class already exist (suitClass: suit-crowns / suit-moons).
//   CROWNS ♛    six random face cards. A Crown scored has CROWN_RANK_UP of
//               raising one card beside it (not in the hand) one rank.
//   CRESCENTS ☾ six random ranks. A Crescent scored has CRESCENT_CREDIT of
//               paying 1 credit and CRESCENT_BUFF of giving one card beside it
//               a random deck-editor buff.
// Rolled per scoring (a replay rolls again), Luck-scaled like every chance, in
// scalingCount (calcScore is read-only). The rule belongs to the suit, so it
// holds in the six-suit deck too. A 4-suit run's flush takes these suits as well
// (flushSuits(); ACTIVE_SUITS is left alone so nothing else starts dealing them).

let SUIT_PACK_CHANCE = 0.25;            // per card pack screen, one offer becomes a suit pack
const SUIT_PACK_CARDS = 6;
const CROWN_SUIT = '♛', CRESCENT_SUIT = '☾';
const SUIT_PACKS = {
  crowns:    { suit: CROWN_SUIT,    name: 'Crowns',    ranks: () => ['J', 'Q', 'K'] },
  crescents: { suit: CRESCENT_SUIT, name: 'Crescents', ranks: () => (ACTIVE_RANKS || []).filter(r => r !== WILD_RANK) },
};
let CROWN_RANK_UP = 0.02, CRESCENT_CREDIT = 0.05, CRESCENT_BUFF = 0.01;

// Every suit a flush may be made of: the run's, plus the two pack suits.
function flushSuits() {
  const base = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : SUITS;
  return base.includes(CROWN_SUIT) ? base : [...base, CROWN_SUIT, CRESCENT_SUIT];
}
// The suits a deck list shows: the run's, plus a pack suit the deck holds.
function deckSuitsShown(cards) {
  const base = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? [...ACTIVE_SUITS] : [...SUITS];
  [CROWN_SUIT, CRESCENT_SUIT].forEach(s => { if (!base.includes(s) && (cards || []).some(c => c && (c.suit === s || c.suit2 === s))) base.push(s); });
  return base;
}

function suitPackRoll() {
  const kind = Math.random() < 0.5 ? 'crowns' : 'crescents';
  const def = SUIT_PACKS[kind], pool = def.ranks();
  const ranks = [];
  for (let i = 0; i < SUIT_PACK_CARDS; i++) ranks.push(pool[Math.floor(Math.random() * pool.length)]);
  const rv = r => (r === 'A' ? 14 : (RANK_ORDER[r] || 0));
  ranks.sort((a, b) => rv(a) - rv(b));
  return { special: kind, suit: def.suit, ranks, op: null, value: 0, label: `6 ${def.name.toUpperCase()}` };
}
function suitPackDesc(pack) {
  const list = pack.ranks.map(r => r + pack.suit).join(', ');
  return pack.special === 'crowns'
    ? `${pack.ranks.length} Crowns join your deck: ${list}. A Crown scored has a ${Math.round(CROWN_RANK_UP * 100)}% chance to raise one card beside it a rank.`
    : `${pack.ranks.length} Crescents join your deck: ${list}. A Crescent scored has a ${Math.round(CRESCENT_CREDIT * 100)}% chance to pay 1 credit and a ${Math.round(CRESCENT_BUFF * 100)}% chance to buff one card beside it.`;
}

// The cards beside (r, c) that stay on the board: ordinary, not in the hand.
function _spNeighbours(r, c, inHand) {
  return getNeighbors(r, c).map(([nr, nc]) => ({ r: nr, c: nc, card: gridData[nr]?.[nc] }))
    .filter(x => x.card && !inHand.has(x.r + '-' + x.c) && !x.card._isSleight && !x.card._isStone && !x.card._temp
      && x.card.rank && !(typeof isWildCard === 'function' && isWildCard(x.card)));
}
// From scalingCount: `cells` is [{ r, c, card, n }] (n = times scored).
function suitPackOnScore(cells) {
  if (!cells || !cells.length) return;
  const inHand = new Set(cells.map(x => x.r + '-' + x.c));
  let credits = 0, ups = 0, buffs = 0, from = null;
  for (const x of cells) {
    const s = x.card.suit, s2 = x.card.suit2;
    const crown = s === CROWN_SUIT || s2 === CROWN_SUIT, moon = s === CRESCENT_SUIT || s2 === CRESCENT_SUIT;
    if (!crown && !moon) continue;
    for (let k = 0; k < (x.n || 1); k++) {
      if (crown && luckRoll(CROWN_RANK_UP) > 0) {
        const nb = _spNeighbours(x.r, x.c, inHand).filter(y => { const i = ACTIVE_RANKS.indexOf(y.card.rank); return i >= 0 && i < ACTIVE_RANKS.length - 1; });
        const y = nb[Math.floor(Math.random() * nb.length)];
        if (y) { y.card.rank = ACTIVE_RANKS[ACTIVE_RANKS.indexOf(y.card.rank) + 1]; ups++;
          if (typeof cardAnimOn === 'function') setTimeout(() => cardAnimOn('buff', cardAnimEls([cardId(y.card)]), { color: '#c98cff' }), 0); }
      }
      if (moon && luckRoll(CRESCENT_CREDIT) > 0) { credits++; from = from || x; }
      if (moon && luckRoll(CRESCENT_BUFF) > 0) {
        const nb = _spNeighbours(x.r, x.c, inHand);
        const y = nb[Math.floor(Math.random() * nb.length)];
        const e = y && typeof rollEditorBuff === 'function' ? rollEditorBuff() : null;
        if (y && e) { enhanceCardKey(cardId(y.card), e); buffs++; }
      }
    }
  }
  if (credits) {
    coins += credits; if (typeof updateCoinsUI === 'function') updateCoinsUI();
    const el = from && document.querySelector(`#grid [data-card-id="${cardId(from.card)}"]`);
    if (el && typeof efxFly === 'function') try { efxFly(el, 'credits', '+' + credits, '#7fe0c8', 'credits'); } catch (e) {}
    noteMessage(`☾ Crescent: +${credits} credit${credits > 1 ? 's' : ''}`);
  }
  if (ups) showMessage(`♛ Crown: ${ups} card${ups > 1 ? 's' : ''} up a rank`, '#c98cff');   // the face redraws with the fall
  if (buffs) showMessage(`☾ Crescent: ${buffs} card${buffs > 1 ? 's' : ''} buffed`, '#7fe0c8');
}
