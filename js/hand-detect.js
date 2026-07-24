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
  // Also verify direction alternates — each consecutive pair alternates row vs col movement
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
// Wild-sleight assignment heuristics — pick rank/suit that best helps the hand.
// TBD: optimal run-completion; current picks modal rank/suit (completes pairs/flushes).
function bestWildRank(normalCards) {
  if (normalCards.length === 0) return 'A';
  const counts = {};
  normalCards.forEach(c => { if (c.rank) counts[c.rank] = (counts[c.rank]||0)+1; });
  let best = null, bestN = -1;
  Object.entries(counts).forEach(([rank, n]) => {
    if (n > bestN || (n === bestN && cardPips(rank) > cardPips(best))) { best = rank; bestN = n; }
  });
  return best || normalCards[0].rank || 'A';
}
function bestWildSuit(normalCards) {
  if (normalCards.length === 0) return '♠';
  const counts = {};
  normalCards.forEach(c => { if (c.suit) counts[c.suit] = (counts[c.suit]||0)+1; });
  let best = null, bestN = -1;
  Object.entries(counts).forEach(([suit, n]) => { if (n > bestN) { best = suit; bestN = n; } });
  return best || '♠';
}

function findBestHand(cells) {
  // Filter out any null cells (challenge card position)
  cells = cells.filter(([r,c]) => gridData[r][c] !== null);
  if (cells.length < 2) return null;

  // Sleights: wild sleights get a temporary rank/suit and join detection;
  // non-wild sleights ride along (excluded from the poker combination, no penalty).
  const normalCards = cells.filter(([r,c]) => !gridData[r][c]._isSleight).map(([r,c]) => gridData[r][c]);
  const wildAssignments = [];
  const detectionCells = [];
  for (const [r, c] of cells) {
    const card = gridData[r][c];
    if (!card._isSleight) { detectionCells.push([r, c]); continue; }
    const def = sleightDef(card);
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

  // Generate all subsets of size 2-5 that are orthogonally connected
  const subsets = [];
  const n = detectionCells.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset = detectionCells.filter((_, i) => mask & (1 << i));
    if (subset.length < 2 || subset.length > 5) continue;
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
function detectHand(cells) {
  if (cells.length < 2) return null;
  const cards = cells.map(([r,c]) => gridData[r][c]);
  const ranks = cards.map(c => c.rank);
  const n = cells.length;
  const isSeq = os => { for(let i=1;i<os.length;i++) if(os[i]-os[i-1]!==1) return false; return true; };

  // rankCounts: combined cards contribute both ranks
  const rankCounts = {};
  cards.forEach(c => {
    rankCounts[c.rank] = (rankCounts[c.rank]||0) + 1;
    if (c.combined && c.rank2) rankCounts[c.rank2] = (rankCounts[c.rank2]||0) + 1;
  });
  const counts = Object.values(rankCounts).sort((a,b)=>b-a);

  // Flush check: combined cards count as both suits — check if all cards share a common suit
  const allSameSuitStrict = SUITS.some(s =>
    cards.every(c => c.suit === s || (c.combined && c.suit2 === s))
  );

  // Run check: combined cards can use either rank value — try all combos
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
  const isStr = tryRunCombos(0, []);
  const ordersLow = ranks.map(r => RANK_ORDER[r]).sort((a,b)=>a-b);
  const ordersHigh = ranks.map(r => r==='A'?14:RANK_ORDER[r]).sort((a,b)=>a-b);
  const allUnique = new Set(ranks).size === n;

  if (activeHands.has('straightflush') && n===5 && allSameSuitStrict && isStr) return 'Straight Flush';
  if (activeHands.has('fourofakind') && n>=4 && counts[0]>=4) return 'Four of a Kind';
  if (activeHands.has('fullhouse') && n===5 && counts[0]>=3 && counts[1]>=2) return 'Full House';
  if (activeHands.has('flush') && n===5 && allSameSuitStrict) return 'Flush';
  if (activeHands.has('straight') && n===5 && isStr) return 'Straight';
  if (activeHands.has('threeofakind') && counts[0]>=3 && (n===3||n===5)) return 'Three of a Kind';
  if (activeHands.has('twopair') && n>=4 && counts[0]>=2 && counts[1]>=2) return 'Two Pair';
  if (activeHands.has('run4') && n===4 && isStr) return 'Run of 4';
  if (activeHands.has('run3') && n===3 && isStr) return 'Run of 3';
  if (activeHands.has('pair') && n===2 && counts[0]>=2) return 'Pair';
  if (activeHands.has('pair') && n>=3 && counts[0]>=2 && counts[1]>=1 && n<=5) return 'Pair';
  return null;
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
// BALANCE CONFIG (BAL) — single source of truth for tunable numbers
// ══════════════════════════════════════════════
// Pulled out of calcScore / exaltCorruptTotals so a balance sweep can edit them
// in one place. Defaults EQUAL the original literals (behaviour-preserving).
// Round-trip: tools/gen_balance_sheet.js (BAL→CSV) + tools/apply_balance_sheet.js
// (CSV→BAL). Conditional thresholds/windows stay hardcoded; these are the
// headline magnitudes per bonus. Entities not listed are structural.
