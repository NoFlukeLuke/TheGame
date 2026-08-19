function showDeck() {
  const el = document.getElementById('deck-content');

  const SUIT_ORDER = { '♣': 0, '♦': 1, '♥': 2, '♠': 3 };
  const RANK_ORDER = { 'A':0,'2':1,'3':2,'4':3,'5':4,'6':5,'7':6,'8':7,'9':8,'10':9,'J':10,'Q':11,'K':12 };

  function sortCards(cards) {
    return [...cards].sort((a, b) => {
      const sd = (SUIT_ORDER[a.suit] ?? 4) - (SUIT_ORDER[b.suit] ?? 4);
      return sd !== 0 ? sd : (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
    });
  }

  function makeChip(card, state) {
    if (card._isSleight) {
      const def = SLEIGHT_POOL.find(j => j.id === card.sleightId);
      const stateClass = state === 'present' ? ' dc-present' : state === 'past' ? ' dc-past' : '';
      const uses = card._usesLeft === 'infinite' ? '∞' : card._usesLeft;
      return `<span class="deck-chip deck-chip-sleight${stateClass}" title="${def?.name||'Sleight'}: ${def?.desc||''} (${uses} uses)">${def?.emoji||'🃏'}</span>`;
    }
    const k = cardKey(card.rank, card.suit);
    const pp = permPips[k] || 0;
    const pm = permMult[k] || 0;
    const stateClass = state === 'present' ? ' dc-present' : state === 'past' ? ' dc-past' : '';
    const bonusClass = pp && pm ? ' has-pip has-mult' : pp ? ' has-pip' : pm ? ' has-mult' : '';
    const title = `${card.rank}${card.suit}${pp?` +${pp}p`:''}${pm?` +${pm}m`:''}`;
    return `<span class="deck-chip ${suitClass(card.suit)}${stateClass}${bonusClass}" title="${title}">${card.rank}</span>`;
  }

  function makeSectionHtml(cards, state) {
    if (!cards.length) return '<span style="font-size:11px;color:var(--cream-dim)">None</span>';
    const sorted = sortCards(cards);
    // Group by suit
    const bySuit = {};
    sorted.forEach(card => {
      if (!bySuit[card.suit]) bySuit[card.suit] = [];
      bySuit[card.suit].push(card);
    });
    const SUIT_DISPLAY_ORDER = ['♣','♦','♥','♠'];
    return SUIT_DISPLAY_ORDER.filter(s => bySuit[s]).map(s => {
      const chips = bySuit[s].map(c => makeChip(c, state)).join('');
      return `<div class="deck-suit-row">
        <span class="deck-suit-symbol ${suitClass(s)}">${s}</span>${chips}
      </div>`;
    }).join('');
  }

  // Present — on grid (exclude Tricks and sleights)
  const presentCards = [];
  const presentSleights = [];
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const card = gridData[r][c];
      if (card && !card._isTrick && card._isSleight) presentSleights.push(card);
      else if (card && !card._isTrick && !card._isSleight) presentCards.push(card);
    }
  const drawSleights = drawPile.filter(c => c._isSleight);
  const drawNormal = drawPile.filter(c => !c._isSleight);
  const playedSleights = playedPile.filter(c => c._isSleight);
  const playedNormal = playedPile.filter(c => !c._isSleight);
  const allSleights = [...presentSleights, ...drawSleights, ...playedSleights];

  function makeSleightSection() {
    if (!allSleights.length) return '<span style="font-size:11px;color:var(--cream-dim)">None</span>';
    return allSleights.map(card => makeChip(card, presentSleights.includes(card) ? 'present' : playedSleights.includes(card) ? 'past' : 'future')).join('');
  }

  el.innerHTML = `
    <div class="deck-section">
      <span class="deck-section-title">On Grid (${presentCards.length})</span>
      <div class="deck-cards">${makeSectionHtml(presentCards, 'present')}</div>
    </div>
    <div class="deck-section">
      <span class="deck-section-title">Draw Pile (${drawNormal.length})</span>
      <div class="deck-cards">${makeSectionHtml(drawNormal, 'future')}</div>
    </div>
    <div class="deck-section">
      <span class="deck-section-title">Played — Returns Next Round (${playedNormal.length})</span>
      <div class="deck-cards">${makeSectionHtml(playedNormal, 'past')}</div>
    </div>
    ${allSleights.length ? `<div class="deck-section">
      <span class="deck-section-title">Sleights (${allSleights.length})</span>
      <div class="deck-cards">${makeSleightSection()}</div>
    </div>` : ''}
  `;
  document.getElementById('deck-overlay').classList.add('show');
}

// ══════════════════════════════════════════════
// PAUSE SYSTEM
// ══════════════════════════════════════════════
let isPaused = false;

