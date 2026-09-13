function getNeighbors(r, c) {
  const n = [];
  if (r > 0)            n.push([r-1,c]);
  if (r < gridRows - 1) n.push([r+1,c]);
  if (c > 0)            n.push([r,c-1]);
  if (c < gridCols - 1) n.push([r,c+1]);
  return n;
}

function isConnected(cells) {
  if (cells.length <= 1) return true;
  const set = new Set(cells.map(([r,c])=>`${r}-${c}`));
  const visited = new Set();
  const stack = [cells[0]];
  while (stack.length) {
    const [r,c] = stack.pop();
    const k = `${r}-${c}`;
    if (visited.has(k)) continue;
    visited.add(k);
    getNeighbors(r,c).forEach(([nr,nc]) => {
      if (set.has(`${nr}-${nc}`) && !visited.has(`${nr}-${nc}`)) stack.push([nr,nc]);
    });
  }
  return visited.size === cells.length;
}

function getReachable() {
  if (selected.length === 0) return null; // all reachable
  const reachable = new Set(selected.map(([r,c])=>`${r}-${c}`));
  selected.forEach(([r,c]) => getNeighbors(r,c).forEach(([nr,nc]) => {
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
    const opts = [RANK_ORDER[card.rank]];
    if (card.rank === 'A') opts.push(14);
    if (card.combined && card.rank2) opts.push(RANK_ORDER[card.rank2]);
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
function _rankValsFor(rk) { return rk === 'A' ? [1, 14] : [RANK_ORDER[rk] || 0]; }
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
    const penaltyPips = penaltyCells.reduce((sum, [r,c]) => sum + cardPips(gridData[r][c].rank), 0);
    const rawScore = calcScore(hand, handCells);
    const finalScore = Math.max(0, rawScore - penaltyPips);
    if (!best || finalScore > best.finalScore) {
      best = { hand, handCells, penaltyCells, rawScore, penaltyPips, finalScore };
    }
  }
  restoreWilds();
  return best;
}
// ── Hand shape: every fact the hand tests read, computed once ──
// detectHand (the primary hand) and handMatchesFor (every hand these cards are
// at once) must never disagree about what the cards ARE, so both read this.
function _handShape(cells) {
  const cards = cells.map(([r,c]) => gridData[r][c]);
  const n = cells.length;
  const isSeq = os => { for(let i=1;i<os.length;i++) if(os[i]-os[i-1]!==1) return false; return true; };

  // rankCounts: combined cards contribute both ranks
  const rankCounts = {};
  cards.forEach(c => {
    rankCounts[c.rank] = (rankCounts[c.rank]||0) + 1;
    if (c.combined && c.rank2) rankCounts[c.rank2] = (rankCounts[c.rank2]||0) + 1;
  });
  const counts = Object.values(rankCounts).sort((a,b)=>b-a);

  // Flush check: combined cards count as both suits - check if all cards share a common suit
  // Spectrum's white values (9/10/11) keep the colour of the deck slot they came
  // from - that is their identity - but they READ as colourless, so they can never
  // complete a flush. This explicit test is what enforces that; the cards' own
  // suits would otherwise match like any other colour.
  const _anyWhite = cards.some(c => isWhiteCard(c));
  const allSameSuitStrict = !_anyWhite && ACTIVE_SUITS.some(s =>
    cards.every(c => c.suit === s || (c.combined && c.suit2 === s))
  );

  // Run check: combined cards can use either rank value - try all combos
  const rankOptions = cards.map(c => {
    const opts = [RANK_ORDER[c.rank]];
    if (c.combined && c.rank2) opts.push(RANK_ORDER[c.rank2]);
    // Ace high option
    if (c.rank === 'A') opts.push(14);
    if (c.combined && c.rank2 === 'A') opts.push(14);
    return [...new Set(opts)];
  });
  function tryRunCombos(idx, current) {
    if (idx === rankOptions.length) {
      const sorted = [...current].sort((a,b)=>a-b);
      return new Set(sorted).size === sorted.length && isSeq(sorted);
    }
    for (const v of rankOptions[idx]) {
      if (tryRunCombos(idx+1, [...current, v])) return true;
    }
    return false;
  }
  return { n, counts, allSameSuitStrict, isStr: tryRunCombos(0, []) };
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

// ── TRACK 1: the best ACTIVE set/run this exact group of cards is, or null ──
// Strict: n is exact for every shape, so a component never claims a spare card.
function rankHandForGroup(cells) {
  const n = cells.length;
  if (n < 2 || n > HAND_MAX_CARDS) return null;
  const { counts, allSameSuitStrict, isStr } = _handShape(cells);
  const out = [];
  const add = name => { if (HAND_BASE[name] && handIsActive(name)) out.push(name); };
  if (n === 5 && isStr && allSameSuitStrict) add('Straight Flush');
  if (counts[0] >= n) add(SET_BY_SIZE[n]);                       // n of a kind
  if (n === 5 && counts[0] >= 3 && counts[1] >= 2) add('Full House');
  if (n === 4 && counts[0] >= 2 && counts[1] >= 2) add('Two Pair');
  if (isStr) add(RUN_BY_SIZE[n]);
  if (!out.length) return null;
  let best = out[0];
  for (const h of out) if (handWorth(h) > handWorth(best)) best = h;
  return best;
}

// ── TRACK 2: the biggest same-suit group, as a flush hand ──
// Deliberately NOT gated on activeHands (see the note above). Spectrum's white
// values can never join a flush, which is why isWhiteCard is asked here as well
// as in _handShape.
function flushOverlayFor(cells) {
  const bySuit = {};
  cells.forEach(([r, c]) => {
    const card = gridData[r][c];
    if (!card || isWhiteCard(card)) return;
    const push = s => { if (s) (bySuit[s] = bySuit[s] || []).push([r, c]); };
    push(card.suit);
    if (card.combined && card.suit2) push(card.suit2);
  });
  let best = null;
  Object.keys(bySuit).forEach(s => {
    const group = bySuit[s].slice(0, HAND_MAX_CARDS);
    const name = FLUSH_BY_SIZE[group.length];
    if (group.length < flushOverlayMin || !name || !HAND_BASE[name]) return;
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
function _bestRankPartition(cells) {
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
    let best = solve(mask & ~lowBit);                 // leave the lowest card out
    const rest = mask & ~lowBit;
    // every subset of the remaining cards, joined with the lowest card
    for (let sub = rest; ; sub = (sub - 1) & rest) {
      const g = sub | lowBit;
      const h = handFor(g);
      if (h) {
        const tail = solve(mask & ~g);
        const w = handWorth(h) + tail.worth;
        if (w > best.worth) best = { worth: w, parts: [{ mask: g, name: h }].concat(tail.parts) };
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
function _compKey(cells) {
  return cells.map(([r, c]) => { const k = gridData[r] && gridData[r][c]; return k ? r + ',' + c + ':' + k.rank + k.suit + (k._id || '') : r + ',' + c + ':-'; }).join('|');
}
function handComponentsFor(cells) {
  if (!cells || cells.length < 2 || cells.length > HAND_MAX_CARDS) return null;
  // Keyed on the cards themselves, so a board that moves invalidates its own
  // entries rather than needing anything to remember to clear this.
  // The knack is in the cache key: granting Tagalong mid-run changes the answer
  // for cells whose cards have not moved, so the entries must not be reused.
  const key = (layeredHandsEnabled ? 'L' : 'l') + flushOverlayMin
    + (((typeof hasKnack === 'function') && hasKnack('tagalong')) ? 'T' : 't') + '|' + _compKey(cells);
  if (_compCache.has(key)) return _compCache.get(key);
  if (_compCache.size > 4000) _compCache.clear();

  const part = _bestRankPartition(cells);
  const components = part.parts.map(p => ({
    name: p.name,
    cells: cells.filter((_, i) => p.mask & (1 << i)),
  }));
  // The flush overlay, unless Track 1 already took the hand that IS a flush.
  if (layeredHandsEnabled && !components.some(c => c.name === 'Straight Flush')) {
    const fl = flushOverlayFor(cells);
    if (fl) components.push(fl);
  }
  // ── EVERY CARD MUST BE LOAD-BEARING (r201) ──
  // A hand may not carry a passenger. If the components do not account for every
  // selected card, this subset is not a hand at all - findBestHand then falls
  // back to the smaller subset that IS fully used, and the leftovers become
  // PENALTY cards: their pips are subtracted, and they are consumed anyway
  // (toRemove is the whole selection, not just handCells). So a spare card went
  // from a small bonus to a real cost.
  //
  // The Tagalong knack lifts it, which is the whole reason it is a knack: before
  // r201 this was free and unremarkable, so making it the default and selling it
  // back turns "my hand has a spare in it" into something you paid for.
  const _tagalong = (typeof hasKnack === 'function') && hasKnack('tagalong');
  if (!_tagalong && components.length) {
    const claimed = new Set();
    components.forEach(c => c.cells.forEach(([r, cc]) => claimed.add(r + '-' + cc)));
    if (claimed.size < cells.length) components.length = 0;   // a passenger: not a hand
  }

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
      && cells.length >= minSelection()) {
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
// Exalted:   ♣ +10 pips | ♦ +3 coins | ♥ +2 mult | ♠ +4 time
// Corrupted: ♣ +25 pips/-3 mult | ♦ +5 coins/-20 pips | ♥ +5 mult/-5 time | ♠ +7 time/-8 coins
// ══════════════════════════════════════════════
// BALANCE CONFIG (BAL) - single source of truth for tunable numbers
// ══════════════════════════════════════════════
// Pulled out of calcScore / exaltCorruptTotals so a balance sweep can edit them
// in one place. Defaults EQUAL the original literals (behaviour-preserving).
// Round-trip: tools/gen_balance_sheet.js (BAL→CSV) + tools/apply_balance_sheet.js
// (CSV→BAL). Conditional thresholds/windows stay hardcoded; these are the
// headline magnitudes per bonus. Entities not listed are structural.
