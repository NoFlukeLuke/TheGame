function getNeighbors(r, c) {
  const n = [];
  if (r > 0)            n.push([r-1,c]);
  if (r < gridRows - 1) n.push([r+1,c]);
  if (c > 0)            n.push([r,c-1]);
  if (c < gridCols - 1) n.push([r,c+1]);
  return n;
}

// ── Royal Reach (r358, The Queen) ──
// A card with royal reach is linked to every cell on its row, its column and its
// two diagonals, at any distance - a chess queen's lines. It can join a hand
// with any card on those lines and swap with any of them. The link is mutual:
// the other card reaches the Queen as much as the Queen reaches it.
function hasRoyalReach(card) { return !!card && card._isSleight && !!sleightDef(card)?.royalReach; }
function onQueenLine(r1, c1, r2, c2) { return r1 === r2 || c1 === c2 || Math.abs(r1 - r2) === Math.abs(c1 - c2); }
function royalReachCells() {
  const out = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (hasRoyalReach(gridData[r]?.[c])) out.push([r, c]);
  return out;
}
// getNeighbors plus the royal-reach links. With no royal card on the board this
// is exactly getNeighbors.
function reachNeighbors(r, c, royals) {
  const out = getNeighbors(r, c);
  royals = royals || royalReachCells();
  if (!royals.length) return out;
  const has = (a, b) => out.some(([x, y]) => x === a && y === b);
  if (royals.some(([a, b]) => a === r && b === c)) {
    for (let a = 0; a < gridRows; a++) for (let b = 0; b < gridCols; b++)
      if ((a !== r || b !== c) && onQueenLine(r, c, a, b) && !has(a, b)) out.push([a, b]);
  } else royals.forEach(([a, b]) => { if (onQueenLine(r, c, a, b) && !has(a, b)) out.push([a, b]); });
  return out;
}

function isConnected(cells) {
  if (cells.length <= 1) return true;
  const _royals = royalReachCells();
  const set = new Set(cells.map(([r,c])=>`${r}-${c}`));
  const visited = new Set();
  const stack = [cells[0]];
  while (stack.length) {
    const [r,c] = stack.pop();
    const k = `${r}-${c}`;
    if (visited.has(k)) continue;
    visited.add(k);
    reachNeighbors(r, c, _royals).forEach(([nr,nc]) => {
      if (set.has(`${nr}-${nc}`) && !visited.has(`${nr}-${nc}`)) stack.push([nr,nc]);
    });
  }
  return visited.size === cells.length;
}

function getReachable() {
  if (selected.length === 0) return null; // all reachable
  const reachable = new Set(selected.map(([r,c])=>`${r}-${c}`));
  const _royals = royalReachCells();
  selected.forEach(([r,c]) => reachNeighbors(r, c, _royals).forEach(([nr,nc]) => {
    const card = gridData[nr][nc];
    if (card === null) return;            // empty cells unreachable
    if (isCellBlocked(nr, nc)) return;    // voids unreachable
    if (card._isStone) return;            // stones unreachable for selection
    reachable.add(`${nr}-${nc}`);
  }));
  return reachable;
}

// ── Shape detection helpers ──
function isSquare(cells) {
  if (cells.length !== 4) return false;
  const rows = cells.map(([r]) => r);
  const cols = cells.map(([,c]) => c);
  const minR = Math.min(...rows), maxR = Math.max(...rows);
  const minC = Math.min(...cols), maxC = Math.max(...cols);
  if (maxR - minR !== 1 || maxC - minC !== 1) return false;
  const set = new Set(cells.map(([r,c]) => `${r}-${c}`));
  return set.has(`${minR}-${minC}`) && set.has(`${minR}-${maxC}`) &&
         set.has(`${maxR}-${minC}`) && set.has(`${maxR}-${maxC}`);
}

function isCross(cells) {
  if (cells.length < 3) return false;
  // Find a cell that shares its row with ≥1 other AND its column with ≥1 other
  for (const [cr, cc] of cells) {
    const sameRow = cells.filter(([r,c]) => r === cr && c !== cc);
    const sameCol = cells.filter(([r,c]) => c === cc && r !== cr);
    if (sameRow.length >= 1 && sameCol.length >= 1) {
      // All other cells must be in the same row or same col as center
      const others = cells.filter(([r,c]) => !(r === cr && c === cc));
      if (others.every(([r,c]) => r === cr || c === cc)) return true;
    }
  }
  return false;
}

function isStraightLine(cells) {
  if (cells.length < 2) return false;
  const rows = cells.map(([r]) => r);
  const cols = cells.map(([,c]) => c);
  return new Set(rows).size === 1 || new Set(cols).size === 1;
}

function isSnake(cells) {
  if (cells.length < 3) return false;
  // No more than 2 cards share a row or column
  const rowCounts = {}, colCounts = {};
  for (const [r,c] of cells) {
    rowCounts[r] = (rowCounts[r]||0)+1;
    colCounts[c] = (colCounts[c]||0)+1;
    if (rowCounts[r] > 2 || colCounts[c] > 2) return false;
  }
  // Also verify direction alternates - each consecutive pair alternates row vs col movement
  // We need to find a valid ordered path through the cells
  // Try all orderings of cells as a path (for small hands this is fine)
  function tryPath(path, remaining) {
    if (remaining.length === 0) {
      // Check alternating direction
      for (let i = 1; i < path.length - 1; i++) {
        const dr1 = path[i][0] - path[i-1][0];
        const dc1 = path[i][1] - path[i-1][1];
        const dr2 = path[i+1][0] - path[i][0];
        const dc2 = path[i+1][1] - path[i][1];
        // Consecutive moves must be perpendicular
        if ((dr1 !== 0 && dr2 !== 0) || (dc1 !== 0 && dc2 !== 0)) return false;
      }
      return true;
    }
    const last = path[path.length - 1];
    for (let i = 0; i < remaining.length; i++) {
      const next = remaining[i];
      // Must be orthogonally adjacent
      if (Math.abs(next[0]-last[0]) + Math.abs(next[1]-last[1]) !== 1) continue;
      const rest = remaining.filter((_,j) => j !== i);
      if (tryPath([...path, next], rest)) return true;
    }
    return false;
  }
  for (let start = 0; start < cells.length; start++) {
    const rest = cells.filter((_,i) => i !== start);
    if (tryPath([cells[start]], rest)) return true;
  }
  return false;
}

function isCorner(r, c) {
  return (r === 0 || r === gridRows - 1) && (c === 0 || c === gridCols - 1);
}
function cornerCells(cells) { return cells.filter(([r,c]) => isCorner(r, c)); }
function isOnEdge(cells) { return cells.every(([r,c]) => r===0||r===gridRows-1||c===0||c===gridCols-1); }

function canBeOrderedRun(cells) {
  // Get the rank value for each card in selection order
  // For combined cards use the rank that makes it part of the run
  const cards = cells.map(([r,c]) => gridData[r][c]);
  const rankValues = cards.map(card => {
    const opts = [...rankRunVals(card.rank)];
    if (card.combined && card.rank2) opts.push(...rankRunVals(card.rank2));
    return opts;
  });

  // Try all combinations of rank choices (for combined/ace cards)
  function tryCombos(idx, chosen) {
    if (idx === rankValues.length) {
      // Check if the chosen sequence is strictly ascending or strictly descending by 1 each step
      const ascending  = chosen.every((v,i) => i===0 || v === chosen[i-1]+1);
      const descending = chosen.every((v,i) => i===0 || v === chosen[i-1]-1);
      return ascending || descending;
    }
    for (const v of rankValues[idx]) {
      if (tryCombos(idx+1, [...chosen, v])) return true;
    }
    return false;
  }
  return tryCombos(0, []);
}

// Order cards are scored in. Default: reading order (top→bottom, left→right).
// A future Knack ('selection_scoring') flips this back to selection (tap) order.
function scoringOrderCells(cells) {
  if (hasKnack('selection_scoring')) return cells.slice();
  return cells.slice().sort((a,b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);
}

// Rank values for adjacency (Ace counts as both low=1 and high=14). Used by Ripple.
function _rankValsFor(rk) { return rankRunVals(rk); }
function _withinOneRank(a, b) {
  // exactly adjacent in rank (Ace counts next to both 2 and K); same rank does NOT count
  const av = _rankValsFor(a), bv = _rankValsFor(b);
  return av.some(x => bv.some(y => Math.abs(x - y) === 1));
}

// Fraction of THIS round's clock still remaining (1.0 at start → 0 at end). Dynamic so
// "first/middle/last third" language tracks the actual round length, not a constant.
function roundFractionRemaining() { return roundStartSeconds > 0 ? Math.max(0, roundSeconds / roundStartSeconds) : 0; }

function spanStats(cells) {
  const rows = [...new Set(cells.map(([r])=>r))];
  const cols = [...new Set(cells.map(([,c])=>c))];
  return { rowSpan: rows.length, colSpan: cols.length };
}
// Find all valid subsets of selected cells, score each,
// return { hand, handCells, penaltyCells, score }
// ══════════════════════════════════════════════
// Wild-sleight assignment heuristics - pick rank/suit that best helps the hand.
// TBD: optimal run-completion; current picks modal rank/suit (completes pairs/flushes).
function bestWildRank(normalCards) {
  if (normalCards.length === 0) return ACTIVE_RANKS[0];
  const counts = {};
  normalCards.forEach(c => { if (c.rank) counts[c.rank] = (counts[c.rank]||0)+1; });
  let best = null, bestN = -1;
  Object.entries(counts).forEach(([rank, n]) => {
    if (n > bestN || (n === bestN && cardPips(rank) > cardPips(best))) { best = rank; bestN = n; }
  });
  return best || normalCards[0].rank || ACTIVE_RANKS[0];
}
function bestWildSuit(normalCards) {
  if (normalCards.length === 0) return ACTIVE_SUITS[0];
  const counts = {};
  normalCards.forEach(c => { if (c.suit) counts[c.suit] = (counts[c.suit]||0)+1; });
  let best = null, bestN = -1;
  Object.entries(counts).forEach(([suit, n]) => { if (n > bestN) { best = suit; bestN = n; } });
  return best || ACTIVE_SUITS[0];
}

function findBestHand(cells) {
  // Filter out any null cells (challenge card position)
  cells = cells.filter(([r,c]) => gridData[r][c] !== null);
  if (cells.length < 2) return null;

  // Sleights: wild sleights get a temporary rank/suit and join detection; a
  // TINKERED sleight (given a real identity at the Mart's Tinker bench, r175)
  // joins as an ordinary card; every other sleight rides along, excluded from
  // the poker combination with no penalty.
  // A tinkered sleight counts as a normal card for the wilds to read off, too -
  // it has a real rank and suit, so a wild should be able to match it.
  const normalCards = cells.map(([r,c]) => gridData[r][c])
    .filter(card => !card._isSleight || (typeof sleightIsPlayable === 'function' && sleightIsPlayable(card)));
  const wildAssignments = [];
  const detectionCells = [];
  for (const [r, c] of cells) {
    const card = gridData[r][c];
    if (!card._isSleight) { detectionCells.push([r, c]); continue; }
    const def = sleightDef(card);
    if (typeof sleightIsPlayable === 'function' && sleightIsPlayable(card)) {
      detectionCells.push([r, c]);      // a tinkered sleight is just a card here
      continue;
    }
    // Warehouse joins as itself - no borrowed rank or suit. _handShape and the
    // flush overlay read it directly, so the score, the preview and the dance's
    // own re-score all see the same hand (a temporary identity would be gone by
    // the time playHand and the dance ask again).
    if (isWarehouseCard(card)) { detectionCells.push([r, c]); continue; }
    if (def?.activation === 'wildcard') {
      const orig = { rank: card.rank, suit: card.suit };
      if (def.wild === 'rank' || def.wild === 'both') card.rank = bestWildRank(normalCards);
      if (def.wild === 'suit' || def.wild === 'both') card.suit = bestWildSuit(normalCards);
      if (card.rank == null) card.rank = bestWildRank(normalCards);
      if (card.suit == null) card.suit = bestWildSuit(normalCards);
      wildAssignments.push({ card, orig });
      detectionCells.push([r, c]);
    }
    // non-wild sleights: omitted from detectionCells
  }
  const restoreWilds = () => wildAssignments.forEach(({ card, orig }) => { card.rank = orig.rank; card.suit = orig.suit; });

  if (detectionCells.length < 2) { restoreWilds(); return null; }

  // ── WHAT YOU SELECTED IS WHAT YOU PLAY (r293) ──
  // Owner: "if you select cards to play a certain type of hand, then that's the
  // hand that should play, always."
  //
  // The search below picks the highest-SCORING connected subset, which is not
  // the same question. Once Natural Scaling has made a short hand out-earn the
  // longer one it lives inside (OPEN_DECISIONS 7), the winner of that contest
  // can be a SMALLER subset - so selecting A-2-3-4 paid a Run of 3 and billed
  // the 4 as a penalty. It was the right answer to the wrong question: the
  // player had already said which hand they were making.
  //
  // So if the WHOLE selection is a hand, that is the hand. No search, no
  // comparison, no dropped card. It can score less than some subset would and
  // that is the point - predictable beats optimal, and the optimal play is
  // still available by selecting those cards instead.
  //
  // HIGH CARD IS THE ONE EXCLUSION, and it is load-bearing. It is the r200
  // escape valve: 0 pips, x1 mult, and it covers every cell BY DEFINITION, so
  // treating it as "the whole selection is a hand" would make it the answer for
  // every selection that carries a passenger - a Pair beside three big cards
  // would score 30 as High Card instead of 52 as a Pair with three penalties.
  // It is never a hand anyone SELECTED, so it stays what it has always been:
  // the thing a selection falls back to when the search finds nothing better.
  const _whole = detectionCells.length >= 2 && detectionCells.length <= HAND_MAX_CARDS
    ? handComponentsFor(detectionCells) : null;
  if (_whole && !(_whole.components.length === 1 && _whole.components[0].name === 'High Card')) {
    const hand = _whole.primary;
    const rawScore = calcScore(hand, detectionCells);
    restoreWilds();
    return _withTagalongs({ hand, handCells: detectionCells, penaltyCells: [],
                            rawScore, penaltyPips: 0, finalScore: Math.max(0, rawScore) });
  }

  // Generate all connected subsets of 2 to HAND_MAX_CARDS cards. The cap used to
  // be 5, which is why Selection Size (max 9) bought nothing past the fifth card:
  // the extra cards could never be in the hand and were billed as penalty pips.
  const subsets = [];
  const n = detectionCells.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset = detectionCells.filter((_, i) => mask & (1 << i));
    if (subset.length < 2 || subset.length > HAND_MAX_CARDS) continue;
    if (!isConnected(subset)) continue;
    const hand = detectHand(subset);
    if (hand) subsets.push({ hand, handCells: subset });
  }

  if (subsets.length === 0) { restoreWilds(); return null; }

  // Score each valid subset with bonuses, pick highest
  let best = null;
  for (const { hand, handCells } of subsets) {
    const penaltyCells = detectionCells.filter(c => !handCells.some(([r,col]) => r===c[0] && col===c[1]));
    const penaltyPips = penaltyCells.reduce((sum, [r,c]) => sum + (isWarehouseCard(gridData[r][c]) ? 0 : cardPips(gridData[r][c].rank)), 0);
    const rawScore = calcScore(hand, handCells);
    // A subset's own passengers are billed here too, or the search would happily
    // prefer a subset that carries three of them over one that carries none -
    // they cost the same pips whether they sit inside the hand or outside it.
    const tagPips = handTagalongCells(handCells).reduce((n, [r, c]) => n + cardPips(gridData[r][c].rank), 0);
    const finalScore = Math.max(0, rawScore - penaltyPips - tagPips);
    if (!best || finalScore > best.finalScore) {
      best = { hand, handCells, penaltyCells, rawScore, penaltyPips, finalScore };
    }
  }
  restoreWilds();
  return _withTagalongs(best);
}

// ── What the passengers cost (r326) ──────────────────────────────────────────
// A tagalong card is INSIDE the hand (it is in handCells and it is consumed with
// the rest) and in none of its components. A penalty card is OUTSIDE the hand.
// Both bill their pips; only a tagalong bills the clock, because only a tagalong
// is something the knack let you choose to carry.
//
// They are kept as separate fields rather than folded into penaltyCells because
// the two say different things to the player - "the hand refused this" against
// "this is riding along and here is the bill" - and only one of them is a thing
// the player asked for.
function _withTagalongs(res) {
  if (!res) return res;
  const tag = handTagalongCells(res.handCells);
  res.tagalongCells   = tag;
  res.tagalongPips    = tag.reduce((n, [r, c]) => n + ((gridData[r] && gridData[r][c] && gridData[r][c].rank) ? cardPips(gridData[r][c].rank) : 0), 0);
  res.tagalongSeconds = (typeof tagalongSecondsFor === 'function') ? tagalongSecondsFor(tag) : 0;
  res.finalScore = Math.max(0, res.rawScore - (res.penaltyPips || 0) - res.tagalongPips);
  return res;
}
// ── Hand shape: every fact the hand tests read, computed once ──
// detectHand (the primary hand) and handMatchesFor (every hand these cards are
// at once) must never disagree about what the cards ARE, so both read this.
function _handShape(cells) {
  const cards = cells.map(([r,c]) => gridData[r][c]);
  const n = cells.length;
  const isSeq = os => { for(let i=1;i<os.length;i++) if(os[i]-os[i-1]!==1) return false; return true; };

  // WILDS ARE COUNTED SEPARATELY AND NEVER APPEAR IN rankCounts (r325). A wild
  // has no rank, so it cannot be a rank's own tally - it is a slot that one of
  // the real ranks may claim, which is what _wildFitsPattern decides.
  const wilds = (typeof countWilds === 'function') ? countWilds(cards) : 0;

  // rankCounts: combined cards contribute both ranks
  const rankCounts = {};
  cards.forEach(c => {
    if (wilds && isWildCard(c)) return;
    if (isWarehouseCard(c)) return;
    rankCounts[c.rank] = (rankCounts[c.rank]||0) + 1;
    if (c.combined && c.rank2) rankCounts[c.rank2] = (rankCounts[c.rank2]||0) + 1;
  });
  const counts = Object.values(rankCounts).sort((a,b)=>b-a);

  // Flush check: combined cards count as both suits - check if all cards share a common suit
  // Spectrum's white values (9/10/11) keep the colour of the deck slot they came
  // from - that is their identity - but they READ as colourless, so they can never
  // complete a flush. This explicit test is what enforces that; the cards' own
  // suits would otherwise match like any other colour.
  // A WILD CAN NEVER COMPLETE A FLUSH either, and it is tested explicitly for
  // exactly the reason the white cards are: WILD_SUIT is absent from
  // ACTIVE_SUITS, so `cards.every` would already fail today - but r164 leaned on
  // absence alone for white and r165 had to unpick it, so the rule is stated
  // rather than inherited from a list that a mode could change.
  const _anyWhite = cards.some(c => isWhiteCard(c));
  const _anyWild  = wilds > 0;
  const allSameSuitStrict = !_anyWhite && !_anyWild && ACTIVE_SUITS.some(s =>
    cards.every(c => isWarehouseCard(c) || c.suit === s || (c.combined && c.suit2 === s))
  );

  // Run check: combined cards can use either rank value - try all combos
  // rankRunVals (js/deck-design.js) is the one source of a rank's run values and
  // returns NOTHING for a rank that is off the ladder, so the loop below can
  // never place it in a run. Ace-high lives in there too.
  const rankOptions = cards.map(c => {
    if (isWarehouseCard(c)) return [];
    const opts = [...rankRunVals(c.rank)];
    if (c.combined && c.rank2) opts.push(...rankRunVals(c.rank2));
    return [...new Set(opts)];
  });
  function tryRunCombos(idx, current) {
    if (idx === rankOptions.length) {
      const sorted = [...current].sort((a,b)=>a-b);
      if (new Set(sorted).size !== sorted.length || !isSeq(sorted)) return false;
      // The ranks line up. Does the LAYOUT have to as well? runOrderOK is 'off'
      // by default and then this is exactly the old test. `current` is the value
      // chosen for each cell in cells order, which is what lets it sort them.
      return runOrderOK(cells, current);
    }
    for (const v of rankOptions[idx]) {
      if (tryRunCombos(idx+1, [...current, v])) return true;
    }
    return false;
  }
  return { n, counts, allSameSuitStrict, isStr: tryRunCombos(0, []), wilds };
}

// What a hand is worth under the ACTIVE scoring model, not the printed table:
// with base pips zeroed (mult_ladder / hand_size) a pips x mult comparison is 0
// for everything, so the pips term is floored at 1 and the mults decide.
function handWorth(h) { return HAND_BASE[h] ? Math.max(handBasePips(h), 1) * handBaseMult(h) : 0; }

// ══════════════════════════════════════════════
// HAND COMPONENTS (r199) - a hand is a LIST of shapes, not one shape
// ══════════════════════════════════════════════
// Phase 10 rules, on a grid. A played hand is broken into COMPONENTS, and every
// component pays its own printed base pips and base mult, earns its own Natural
// Scaling, and names itself in the HUD. Two tracks build the list:
//
//   TRACK 1 - the RANK PARTITION. Sets and runs, carved out of the selection as
//   DISJOINT pieces, chosen to pay the most. This is what makes "a Run of 4 AND
//   a Set of 3" one seven-card hand, and two Sets of 3 another. Straight Flush
//   is a candidate here too, because it is a run that is paid extra for being
//   suited - not a run with a flush stacked on it.
//
//   TRACK 2 - the FLUSH OVERLAY. The biggest same-suit GROUP in the hand, three
//   cards or more, added on top of whatever Track 1 found. It overlaps rather
//   than partitions: the same cards can be in a set and in the flush at once.
//   Skipped when Track 1 already took a Straight Flush, which is that hand.
//
// A card in more than one component REPLAYS - once per extra component it is in.
// So a Fullest House (Set of 4 + Set of 3) where five of the seven share a suit
// pays 4oK + 3oK + Flush of 5, and exactly those five cards score twice.
//
// **`activeHands` gates what you may PLAY, not what a hand may LAYER.** The rank
// partition only ever takes an active hand, so a mode that has not unlocked
// Flush of 3 still cannot let you play three suited cards as a hand. The flush
// OVERLAY ignores activeHands entirely: play a suited Run of 3 in Classic and
// you are paid the Flush of 3 as well. That is the whole point of the split -
// the flush is never the thing you chose to build, so unlocking it is about
// being allowed to build it on purpose. (Short Suit still does exactly that.)
//
// COMPONENTS ARE STRICT; UNCLAIMED CARDS STILL SCORE THEIR PIPS. A component
// must use every one of its cards - a Pair is exactly two cards, never two cards
// and a spare. The spare stays in `handCells` and scores its own pips exactly as
// it always did, it just adds no base value. That is what keeps every pre-r199
// hand scoring what it used to: {5C 7S 7H} is still a three-card Pair.
let layeredHandsEnabled = localStorage.getItem('layeredHands') !== '0';   // default ON
// The biggest same-suit group that still pays a flush overlay. Raise it to 4 or
// 5 to make the overlay rare again; a 5-card hand very often holds three of one
// suit, so at 3 the overlay is close to universal - which is the intent.
let flushOverlayMin = parseInt(localStorage.getItem('flushOverlayMin'), 10);
if (!isFinite(flushOverlayMin) || flushOverlayMin < 3) flushOverlayMin = 3;
// Hands cap at seven cards. Selection Size goes to nine, so cards past the
// seventh stay outside the hand and are billed as penalty pips by findBestHand.
const HAND_MAX_CARDS = 7;

const FLUSH_BY_SIZE = { 3:'Flush of 3', 4:'Flush of 4', 5:'Flush', 6:'Flush of 6', 7:'Flush of 7' };
const SET_BY_SIZE   = { 2:'Pair', 3:'Three of a Kind', 4:'Four of a Kind', 5:'Five of a Kind', 6:'Six of a Kind', 7:'Seven of a Kind' };
const RUN_BY_SIZE   = { 3:'Run of 3', 4:'Run of 4', 5:'Straight', 6:'Run of 6', 7:'Run of 7' };
// name -> the activeHands key that unlocks PLAYING it
const HAND_NAME_TO_KEY = {};
(function () {
  const m = { 'Flush of 3':'flush3','Flush of 4':'flush4','Flush':'flush','Flush of 6':'flush6','Flush of 7':'flush7',
              'Pair':'pair','Two Pair':'twopair','Three of a Kind':'threeofakind','Full House':'fullhouse',
              'Four of a Kind':'fourofakind','Five of a Kind':'fiveofakind','Six of a Kind':'sixofakind','Seven of a Kind':'sevenofakind',
              'Run of 3':'run3','Run of 4':'run4','Straight':'straight','Run of 6':'run6','Run of 7':'run7','Straight Flush':'straightflush' };
  Object.keys(m).forEach(n => { HAND_NAME_TO_KEY[n] = m[n]; });
})();
function handIsActive(name) { const k = HAND_NAME_TO_KEY[name]; return !k || activeHands.has(k); }

// What a hand is worth under the ACTIVE scoring model, not the printed table:
// with base pips zeroed (mult_ladder / hand_size) a pips x mult comparison is 0
// for everything, so the pips term is floored at 1 and the mults decide.
function handWorth(h) { return HAND_BASE[h] ? Math.max(handBasePips(h), 1) * handBaseMult(h) : 0; }

// ── CAN w WILDS FILL THIS PATTERN OF RANK GROUPS? (r325) ──
// `naturalCounts` is the group's real ranks, descending; `pattern` is the shape
// being tested, also descending - [n] for n-of-a-kind, [3,2] for a full house,
// [2,2] for two pair. The group is EXACTLY sum(pattern) cards, so the wilds have
// to land exactly and the only real question is whether each natural rank fits
// in a slot of its own.
//
// Greedy biggest-to-biggest is provably right for that: both lists are
// descending, so if the i-th largest natural group will not fit the i-th largest
// slot, no pairing exists (any other assignment gives it a slot that is smaller
// still). More distinct ranks than slots is an immediate no.
//
// AT w = 0 THIS REDUCES TO THE THREE TESTS IT REPLACED, EXACTLY. The group size
// is fixed, so `counts[0] >= n` was only ever true for a single rank, a full
// house was only ever [3,2] and two pair only ever [2,2] - each of which is what
// the fit test answers. Verified over real boards: 0 hands move with no wild in
// play (see the r325 note in CLAUDE.md).
function _wildFitsPattern(naturalCounts, w, pattern) {
  if (naturalCounts.length > pattern.length) return false;
  let need = 0;
  for (let i = 0; i < pattern.length; i++) {
    const have = naturalCounts[i] || 0;
    if (have > pattern[i]) return false;
    need += pattern[i] - have;
  }
  return need === w;
}

// ── TRACK 1: the best ACTIVE set/run this exact group of cards is, or null ──
// Strict: n is exact for every shape, so a component never claims a spare card.
function rankHandForGroup(cells) {
  const n = cells.length;
  if (n < 2 || n > HAND_MAX_CARDS) return null;
  const { counts, allSameSuitStrict, isStr, wilds } = _handShape(cells);
  const out = [];
  const add = name => { if (HAND_BASE[name] && handIsActive(name)) out.push(name); };
  // A SET NEEDS AT LEAST ONE REAL CARD TO NAME ITS RANK. "Takes any rank to
  // complete a set" means there is a set to complete; three blank cards paying
  // Three of a Kind reads as a bug, and at a 7x7 board three wilds landing
  // together is not rare enough to leave to chance. This is also what stops the
  // whole-group degenerate case without needing a rule inside _wildFitsPattern.
  const _setOK = counts.length > 0;
  const _fits = pattern => _setOK && _wildFitsPattern(counts, wilds, pattern);
  if (n === 5 && isStr && allSameSuitStrict) add('Straight Flush');
  if (_fits([n])) add(SET_BY_SIZE[n]);                           // n of a kind
  if (n === 5 && _fits([3, 2])) add('Full House');
  if (n === 4 && _fits([2, 2])) add('Two Pair');
  if (isStr) add(RUN_BY_SIZE[n]);
  if (!out.length) return null;
  let best = out[0];
  for (const h of out) if (handWorth(h) > handWorth(best)) best = h;
  return best;
}

// ── TRACK 2: the whole hand as a flush, when EVERY card shares one suit ──
// Deliberately NOT gated on activeHands (see the note above). Spectrum's white
// values can never join a flush, which is why isWhiteCard is asked here as well
// as in _handShape.
//
// ALL OR NOTHING (owner call): the overlay only pays when the ENTIRE selection
// shares one suit. It used to take the biggest same-suit GROUP of
// flushOverlayMin+ cards, so a 4-card hand with 3 of one suit paid a Flush of 3
// on top and replayed those three cards - the owner's rule is that a partial
// suit match is not a flush layer. A group covering every cell is also,
// incidentally, always coverage-safe for the r281 rescue below.
function flushOverlayFor(cells) {
  const bySuit = {};
  const _wh = cells.filter(([r, c]) => isWarehouseCard(gridData[r][c]));
  cells.forEach(([r, c]) => {
    const card = gridData[r][c];
    if (isWarehouseCard(card)) return;
    // isWildCard is load-bearing HERE in a way it is not in _handShape: this
    // function groups cards BY THEIR OWN SUIT rather than testing against
    // ACTIVE_SUITS, so three wilds would form a WILD_SUIT group of their own and
    // pay a Flush of 3 off cards that are not a suit at all.
    if (!card || isWhiteCard(card) || isWildCard(card)) return;
    const push = s => { if (s) (bySuit[s] = bySuit[s] || []).push([r, c]); };
    push(card.suit);
    if (card.combined && card.suit2) push(card.suit2);
  });
  let best = null;
  Object.keys(bySuit).forEach(s => {
    const group = [...bySuit[s], ..._wh].slice(0, HAND_MAX_CARDS);
    if (group.length < cells.length) return;   // a card sits outside this suit - no overlay
    // A Warehouse is one cell and two cards of the flush.
    const size = Math.min(HAND_MAX_CARDS, group.length + _wh.length);
    const name = FLUSH_BY_SIZE[size];
    if (size < flushOverlayMin || !name || !HAND_BASE[name]) return;
    if (!best || handWorth(name) > handWorth(best.name)) best = { name, cells: group };
  });
  return best;
}

// ── The rank partition ──
// Carve `cells` into disjoint groups, each a valid rank hand, worth as much as
// possible. Cards may be left unclaimed (they still score their pips).
// Standard set-partition recursion on a bitmask: always decide the LOWEST unused
// card first, either by dropping it or by putting it in a group with some subset
// of what is left. Memoised per mask, so the whole search is 3^n and n caps at 7.
//
// `mustCover` (r281) FORBIDS the drop branch, so the answer is the best partition
// that claims EVERY card, or null when there is no such partition. It is what
// the load-bearing rule (r201, below) needs, and the reason is that the two
// rules were fighting:
//
//   The partition maximises handWorth, and handWorth reads handBasePips /
//   handBaseMult - which include the NATURAL SCALING accumulator (r190/r198).
//   So once a SHORT hand has out-scaled the longer hand it lives inside, the
//   partition preferred "take the short hand and leave a card unclaimed" - and
//   the load-bearing rule, which runs afterwards and knows nothing about why
//   the partition chose what it chose, then threw the WHOLE component list away
//   because a card was unclaimed. The selection stopped being a hand at all,
//   findBestHand fell back to the smaller subset, and the spare card was billed
//   as a penalty.
//
//   Owner's report: three 7s scoring as a Pair with the third seven dropped,
//   and A-2-3-4 scoring as a Run of 3 with the 4 dropped. On the flat +2 pips a
//   hand that shipped at the time that needed 8 Runs of 3 to kill every Run of
//   4, 11 Runs of 4 to kill the Straight and 17 Pairs to kill Three of a Kind -
//   not an exotic tuning corner, most of the way through an ordinary run.
//   (r282 replaced that flat rate with a PER-HAND-TYPE table tuned to push those
//   thresholds out to 35-180 plays, but the table is tunable and this guard is
//   what stops any setting of it voiding a hand outright.)
//
// Preferring full cover does NOT take the short hand away: findBestHand scores
// every connected subset on its own, so "play just the Pair and eat the penalty"
// is still on the table and still wins when it really does pay more. The fix
// only stops a partition the game is about to reject from vetoing the one it
// would have accepted.
function _bestRankPartition(cells, mustCover) {
  const n = cells.length;
  const memo = new Map();
  const groupCache = new Map();
  const handFor = mask => {
    if (groupCache.has(mask)) return groupCache.get(mask);
    const g = []; for (let i = 0; i < n; i++) if (mask & (1 << i)) g.push(cells[i]);
    const h = rankHandForGroup(g);
    groupCache.set(mask, h);
    return h;
  };
  const solve = mask => {
    if (!mask) return { worth: 0, parts: [] };
    if (memo.has(mask)) return memo.get(mask);
    let low = 0; while (!(mask & (1 << low))) low++;
    const lowBit = 1 << low;
    // Under mustCover the lowest card has to go in a group, so the drop branch
    // is skipped and `best` starts as null - an unsolvable mask returns null and
    // every caller below has to survive that.
    let best = mustCover ? null : solve(mask & ~lowBit);   // leave the lowest card out
    const rest = mask & ~lowBit;
    // every subset of the remaining cards, joined with the lowest card
    for (let sub = rest; ; sub = (sub - 1) & rest) {
      const g = sub | lowBit;
      const h = handFor(g);
      if (h) {
        const tail = solve(mask & ~g);
        if (tail) {
          const w = handWorth(h) + tail.worth;
          if (!best || w > best.worth) best = { worth: w, parts: [{ mask: g, name: h }].concat(tail.parts) };
        }
      }
      if (sub === 0) break;
    }
    memo.set(mask, best);
    return best;
  };
  return solve((1 << n) - 1);
}

// ── The public answer ──
// { components: [{name, cells}], primary, playable } or null when there is no
// hand here at all. `playable` is what gates PLAY: at least one component has to
// be a hand this mode has unlocked, so a bare Flush of 3 in Classic is still not
// a hand even though its overlay would have paid.
const _compCache = new Map();
// The cache is keyed on the CARDS, which is right for a board that moves and
// wrong for a rule that moves under a board that has not. Two things change the
// answer for cells whose cards are exactly where they were:
//   - activeHands, when Short Suit turns on flush3/flush4 mid-run (js/limits.js)
//     or a mode unlocks a hand (js/hands-meta.js). Its SIZE is a sound
//     fingerprint: nothing ever removes a key, so a change is always a growth,
//     and startGame replaces the Set wholesale with a differently-sized one.
//   - NATURAL SCALING, which handWorth reads through handBasePips/handBaseMult -
//     so the partition the cache is holding can be one the live rates would no
//     longer choose. That only moves when a hand is PLAYED, so playHand empties
//     the cache rather than every entry carrying a version stamp.
function clearHandCompCache() { _compCache.clear(); }
function _compKey(cells) {
  return cells.map(([r, c]) => { const k = gridData[r] && gridData[r][c]; return k ? r + ',' + c + ':' + k.rank + k.suit + (k._id || '') : r + ',' + c + ':-'; }).join('|');
}
// r339: "an N-card hand" is a REAL hand of exactly N cards - one component the
// recognition names (a Straight, a Flush, a Full House, a Set of 3...), never N
// cells that happen to include a smaller hand plus spares, and never High Card.
// Owner's rule (the 9.24 sheet, Five for Fodder / the little guys notes): every
// entity whose printed text says "N-card hand" reads THIS predicate, so they
// cannot drift. Safe inside calcScore: handComponentsFor is memoised and never
// calls back into scoring. A throw reads as false - the entity simply does not
// fire - never as a broken hand.
function realHandOfSize(cells, n) {
  try {
    // Three's a Crowd (knack, r361): a hand counts as one card bigger, but only
    // when every card in it is part of the hand - a passenger carried by
    // Tagalong never makes a Pair into a 3-card hand.
    if (cells && typeof hasKnack === 'function' && hasKnack('threes_crowd_k') && cells.length + 1 === n) {
      const comps = handComponentsFor(cells);
      if (!comps || !comps.components) return false;
      const real = comps.components.filter(c => c.name !== 'High Card');
      if (!real.length) return false;
      const claimed = new Set(); real.forEach(c => c.cells.forEach(([r, cc]) => claimed.add(r + '-' + cc)));
      return cells.every(([r, cc]) => claimed.has(r + '-' + cc));
    }
    if (!cells || cells.length !== n) return false;
    const comps = handComponentsFor(cells);
    if (!comps || !comps.components) return false;
    return comps.components.some(c => c.name !== 'High Card' && c.cells.length === n);
  } catch (e) { return false; }
}

function handComponentsFor(cells) {
  // POKER SQUARES NAMES ITS OWN HANDS AND LAYERS NOTHING. A line there is five
  // cards scored as one real poker hand, kickers included, so a component list
  // would both pay for the same cards twice (the flush overlay ignores
  // activeHands) and hand them a replay nothing asked for. Returning null is
  // what calcScore already does when there is no component list at all.
  if (typeof squaresActive === 'function' && squaresActive()) return null;
  if (!cells || cells.length < 2 || cells.length > HAND_MAX_CARDS) return null;
  // Keyed on the cards themselves, so a board that moves invalidates its own
  // entries rather than needing anything to remember to clear this.
  // The knack is in the cache key: granting Tagalong mid-run changes the answer
  // for cells whose cards have not moved, so the entries must not be reused.
  // The run LADDER is in the key for the same reason the knack is: turning the
  // courts off the ladder changes the answer for cells whose cards have not moved.
  const _maxTag = (typeof tagalongMax === 'function') ? tagalongMax() : 0;
  const key = (layeredHandsEnabled ? 'L' : 'l') + flushOverlayMin
    + 'T' + (_maxTag === Infinity ? '*' : _maxTag)
    + 'A' + ((typeof activeHands !== 'undefined' && activeHands) ? activeHands.size : 0)
    + deckLadderKey() + runOrderKey() + '|' + _compKey(cells);
  if (_compCache.has(key)) return _compCache.get(key);
  if (_compCache.size > 4000) _compCache.clear();

  // The partition, plus the flush overlay unless Track 1 already took the hand
  // that IS a flush. Built as a function because r281 may have to build it twice.
  // HOW MANY PASSENGERS THIS HAND MAY CARRY. 0 without the knack, which is r201
  // exactly; the knack's own cap otherwise (Infinity when uncapped, the shipped
  // default). One number, so the load-bearing rule and the cap are one test.
  const _maxTagalong = _maxTag;
  const buildFrom = part => {
    if (!part) return null;
    const comps = part.parts.map(p => ({
      name: p.name,
      cells: cells.filter((_, i) => p.mask & (1 << i)),
    }));
    if (layeredHandsEnabled && !comps.some(c => c.name === 'Straight Flush')) {
      const fl = flushOverlayFor(cells);
      if (fl) comps.push(fl);
    }
    return comps;
  };
  // COVERAGE IS ASKED OF THE WHOLE LIST, OVERLAY INCLUDED - a card the rank
  // partition left alone is still load-bearing if the flush claims it. That is
  // why the second attempt below is a LAST resort and not the first: constraining
  // the partition on its own refuses partitions the overlay would have rescued,
  // which changed 1 hand in 2,400 with no Natural Scaling in play at all.
  const coversAll = comps => {
    const claimed = new Set();
    comps.forEach(c => c.cells.forEach(([r, cc]) => claimed.add(r + '-' + cc)));
    return claimed.size >= cells.length;
  };
  const unclaimedCount = comps => {
    const claimed = new Set();
    comps.forEach(c => c.cells.forEach(([r, cc]) => claimed.add(r + '-' + cc)));
    return Math.max(0, cells.length - claimed.size);
  };
  let components = buildFrom(_bestRankPartition(cells, false)) || [];
  // ── r281: only when today's answer is about to be thrown away ──
  // See the note on _bestRankPartition. The unrestricted partition maximises
  // handWorth, handWorth includes the Natural Scaling accumulator, and so a
  // short hand that has out-scaled the longer hand it lives inside made the
  // partition leave a card unclaimed - which the load-bearing rule below then
  // punished by voiding the ENTIRE hand. Asking for a covering partition at that
  // point recovers the hand the player was obviously building. Preferring the
  // unrestricted answer whenever it is already valid is what keeps this a
  // strict no-op everywhere the bug was not firing.
  if (components.length && unclaimedCount(components) > _maxTagalong) {
    const alt = buildFrom(_bestRankPartition(cells, true));
    components = (alt && coversAll(alt)) ? alt : components;
  }
  // ── EVERY CARD MUST BE LOAD-BEARING (r201) ──
  // A hand may not carry a passenger. If the components do not account for every
  // selected card, this subset is not a hand at all - findBestHand then falls
  // back to the smaller subset that IS fully used, and the leftovers become
  // PENALTY cards: their pips are subtracted, and they are consumed anyway
  // (toRemove is the whole selection, not just handCells). So a spare card went
  // from a small bonus to a real cost.
  //
  // The Tagalong knack RAISES the allowance rather than removing the rule (r326),
  // which is what lets a cap exist at all: 0 passengers is r201 unchanged,
  // Infinity is Tagalong as shipped, and any number between is the cap. A hand
  // over its allowance is not a hand, exactly as before - findBestHand then falls
  // back to the smaller subset that is within it.
  //
  // Being ALLOWED a passenger is not the same as it being free. The cards that
  // ride along are reported by handTagalongCells and billed by findBestHand: their
  // pips come off the hand, and playHand charges their pip value in seconds.
  if (components.length && unclaimedCount(components) > _maxTagalong) components.length = 0;

  // High Card (r200): the escape valve. It covers EVERY cell by definition, so it
  // is also what a selection falls back to when the rule above rejects a hand
  // with a passenger - "play them all for their pips and nothing else" beats
  // "score the pair and eat five penalty cards" more often than not, and
  // findBestHand picks whichever actually pays more.
  // Only offered once the minimum actually bites (limit 5+), so the early game
  // and the tutorial keep their "there is no hand here" state - which the
  // tutorial's dead-card lesson depends on, since with High Card live no card is
  // ever dead. 0 base pips and 0 Focus, so it is never worth reaching for.
  if (!components.length && activeHands.has('highcard')
      && typeof minSelectionBinds === 'function' && minSelectionBinds()
      && cells.length >= handMinSelection()) {
    components.push({ name: 'High Card', cells: cells.slice() });
  }
  let res = null;
  if (components.length) {
    let primary = components[0].name;
    components.forEach(c => { if (handWorth(c.name) > handWorth(primary)) primary = c.name; });
    res = { components, primary, playable: components.some(c => handIsActive(c.name)) };
    if (!res.playable) res = null;
  }
  _compCache.set(key, res);
  return res;
}

// The hand's NAME: the best-paying component. It is no longer the whole payout
// (every component pays), but it is what the hand's Focus, its streak, the hand
// log and the boss Redaction are counted as.
function detectHand(cells) {
  const r = handComponentsFor(cells);
  return r ? r.primary : null;
}

// Back-compat shim: the names this hand pays for, primary first. Callers that
// only want the list (Natural Scaling, the HUD label) use this; calcScore wants
// the cells too and calls handComponentsFor directly.
function handLayersFor(primary, cells) {
  const r = handComponentsFor(cells);
  if (!r) return primary ? [primary] : [];
  // NOT deduped: two Sets of 3 is two components and two payouts, and collapsing
  // them to one name would under-credit Natural Scaling and mis-label the hand.
  // The primary's own entry is moved to the front; the rest keep partition order.
  const names = r.components.map(c => c.name);
  const i = names.indexOf(r.primary);
  if (i > 0) names.splice(0, 0, names.splice(i, 1)[0]);
  return names;
}

// The PASSENGERS of a hand: cells inside it that no component claims. Without
// Tagalong this is always empty - the rule above voids such a hand outright - so
// it is exactly "what the knack let you get away with", and it is what the board
// paints red, the label prices and playHand bills the clock for.
function handTagalongCells(cells) {
  const r = handComponentsFor(cells);
  if (!r) return [];
  const claimed = new Set();
  r.components.forEach(c => c.cells.forEach(([rr, cc]) => claimed.add(rr + '-' + cc)));
  return cells.filter(([rr, cc]) => !claimed.has(rr + '-' + cc));
}

// How many EXTRA times each cell scores: one per component past the first that
// contains it. Keyed 'r-c', read by calcScore's per-card loop.
function handReplayMap(cells) {
  const r = handComponentsFor(cells);
  const map = {};
  if (!r) return map;
  r.components.forEach(c => c.cells.forEach(([rr, cc]) => {
    const k = rr + '-' + cc;
    map[k] = (map[k] || 0) + 1;
  }));
  Object.keys(map).forEach(k => { map[k] = Math.max(0, map[k] - 1); });
  return map;
}

// ══════════════════════════════════════════════
// SCORING
// ══════════════════════════════════════════════
// ── Exalt / Corrupt suit effects ──
// Per-card flags _exalted / _corrupted grant enhanced suit effects.
// Returns { pips, mult, coins, time } totals across the given cards.
// Exalted:   ♣ +10 pips | ♦ +3 coins | ♥ +4 mult | ♠ +4 time
// Corrupted: ♣ +25 pips/-3 mult | ♦ +5 coins/-20 pips | ♥ +5 mult/-5 time | ♠ +7 time/-8 coins
// ══════════════════════════════════════════════
// BALANCE CONFIG (BAL) - single source of truth for tunable numbers
// ══════════════════════════════════════════════
// Pulled out of calcScore / exaltCorruptTotals so a balance sweep can edit them
// in one place. Defaults EQUAL the original literals (behaviour-preserving).
// Round-trip: tools/gen_balance_sheet.js (BAL→CSV) + tools/apply_balance_sheet.js
// (CSV→BAL). Conditional thresholds/windows stay hardcoded; these are the
// headline magnitudes per bonus. Entities not listed are structural.
