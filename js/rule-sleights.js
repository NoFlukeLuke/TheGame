// ══════════════════════════════════════════════════════════════════════════════
// RULE SLEIGHTS (r675, owner; CHALLENGE_REWARDS.md section 1)
// ══════════════════════════════════════════════════════════════════════════════
// A Sleight that changes how the game works while it sits on the board:
//   rule_ranks  two random ranks, named when it lands, replay once (a QRL replay
//               source, `rule` in calcScore's card loop);
//   rule_evens  even-ranked cards score +Focus when scored (playHand);
//   rule_faces  face cards rewind the clock when scored (playHand).
// It lands INERT (the r341 word: cannot be swapped or discarded, only played),
// and each landing spends one of its charges; the one that spends the last is in
// force for that stay, and the card leaves the deck when it goes. It leaves the
// board in a played hand (it rides along, taking a Selection slot) or at the
// round's end, and the rule goes with it. Landing is noticed by ruleSleightsScan,
// from the top of render() and the round tick. The landing marks live on the
// board card only (`_ruleLanded`, `_ruleRanks`): recycleCard drops them, so every
// landing is fresh.

const RULE_SLEIGHT_IDS = new Set(['rule_ranks', 'rule_evens', 'rule_faces']);
const RULE_FACE_RANKS = ['J', 'Q', 'K'];

// The live rule card of an id: on the grid and landed.
function ruleSleightOn(id) {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (cd && cd._isSleight && cd.sleightId === id && cd._ruleLanded) return cd;
  }
  return null;
}
const RULE_RANK_WORD = { A: 'Aces', J: 'Jacks', Q: 'Queens', K: 'Kings' };
function _ruleRanksText(ranks) {
  const w = ranks.map(r => RULE_RANK_WORD[r] || r + 's');
  return w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : w[0];
}
function ruleRollRanks(n) {
  // r739 (owner): the ranks are chosen from the deck (ranks some deck card holds).
  const inDeck = new Set((typeof everyDeckCard === 'function' ? everyDeckCard() : []).filter(c => c && c.rank && !c._isSleight && !c._isStone).map(c => c.rank));
  const pool = ((typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS.length) ? ACTIVE_RANKS : RANKS)
    .filter(r => !(typeof WILD_RANK !== 'undefined' && r === WILD_RANK) && (!inDeck.size || inDeck.has(r)));
  const a = pool.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, Math.max(1, Math.min(a.length, n || 2)));
}
function ruleSleightsScan() {
  if (typeof gridData === 'undefined' || !gridData) return;
  if ((typeof flowrDeckActive === 'function' && flowrDeckActive()) || (typeof mapScreenOpen !== 'undefined' && mapScreenOpen)
      || (typeof squaresActive === 'function' && squaresActive())) return;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._isSleight || !RULE_SLEIGHT_IDS.has(cd.sleightId) || cd._ruleLanded) continue;
    cd._ruleLanded = true;
    cd._inert = true;
    // r859 (owner): In Your Face spends a charge per face card played, not on landing.
    if (cd._usesLeft !== 'infinite' && cd.sleightId !== 'rule_faces') cd._usesLeft = Math.max(0, (cd._usesLeft || 0) - 1);
    if (cd.sleightId === 'rule_faces') cd._ruleLife = BAL.rule_faces.life || 60;
    const def = sleightDef(cd), name = def ? def.name : 'Rule';
    const left = cd._usesLeft === 'infinite' ? '' : cd._usesLeft > 0 ? ` (${cd._usesLeft} left)` : ' (its last)';
    let rule = '';
    if (cd.sleightId === 'rule_ranks') { cd._ruleRanks = ruleRollRanks(BAL.rule_ranks.ranks); rule = `${_ruleRanksText(cd._ruleRanks)} replay ${BAL.rule_ranks.replays > 1 ? BAL.rule_ranks.replays + 'x' : 'once'}`; }
    if (cd.sleightId === 'rule_evens') rule = `even cards score +${BAL.rule_evens.focus} Focus${BAL.rule_evens.credits ? ` and ${BAL.rule_evens.credits} credits` : ''}`;
    if (cd.sleightId === 'rule_faces') rule = `face cards rewind the clock ${BAL.rule_faces.seconds}s for ${BAL.rule_faces.life || 60}s`;
    showMessage(`${name} on the board${left}: ${rule} while it stays`, '#cc88ff');
  }
}

// calcScore's card loop: the replays a card takes from rule_ranks.
function ruleRankReplays(rank) {
  const cd = ruleSleightOn('rule_ranks');
  return (cd && cd._ruleRanks && cd._ruleRanks.includes(rank)) ? (BAL.rule_ranks.replays || 1) : 0;
}
// playHand: what the scored cells pay under rule_evens / rule_faces, once per
// scoring (a card that replays pays again). `retrig` is the hand's replay counts by cell.
function _ruleCellsPay(cells, retrig, test) {
  let n = 0;
  (cells || []).forEach(cell => {
    const [r, c] = cell;
    const cd = (typeof cellCard === 'function') ? cellCard(cell) : gridData[r]?.[c];   // r859: the hand's own card (r772)
    if (!cd || !cd.rank || cd._isSleight || cd._isStone || (typeof isWildCard === 'function' && isWildCard(cd))) return;
    if (test(cd.rank)) n += (retrig && retrig[r + '-' + c]) || 1;
  });
  return n;
}
function ruleEvenFocus(cells, retrig) {
  if (!ruleSleightOn('rule_evens')) return 0;
  return _ruleCellsPay(cells, retrig, rk => typeof _rankIsEvenRank === 'function' && _rankIsEvenRank(rk)) * BAL.rule_evens.focus;
}
function ruleFaceSeconds(cells, retrig) {
  // r739: the 5th improvement makes it a Knack (rule_faces_k): the rule always holds.
  const _k = typeof hasKnack === 'function' && hasKnack('rule_faces_k');
  if (!_k && !ruleSleightOn('rule_faces')) return 0;
  return _ruleCellsPay(cells, retrig, rk => RULE_FACE_RANKS.includes(rk)) * (_k ? BAL.rule_faces_k.seconds : BAL.rule_faces.seconds);
}
// r739: Even Keel's 5th improvement pays credits for even cards as well.
function ruleEvenCredits(cells, retrig) {
  if (!BAL.rule_evens.credits || !ruleSleightOn('rule_evens')) return 0;
  return _ruleCellsPay(cells, retrig, rk => typeof _rankIsEvenRank === 'function' && _rankIsEvenRank(rk)) * BAL.rule_evens.credits;
}

// ── In Your Face's charges and its 60 seconds (r859, owner) ─────────────────
// A charge for every face card PLAYED (a replay spends nothing); it leaves the grid
// after BAL.rule_faces.life live seconds, or once its charges are gone. The leave
// waits for a still board (the round tick), never inside playHand.
function ruleFacesSpend(cells) {
  const cd = ruleSleightOn('rule_faces');
  if (!cd || cd._usesLeft === 'infinite') return;
  const n = _ruleCellsPay(cells, null, rk => RULE_FACE_RANKS.includes(rk));
  if (!n) return;
  cd._usesLeft = Math.max(0, (cd._usesLeft || 0) - n);
  if (typeof sleightChargeSpent === 'function') for (let i = 0; i < n; i++) sleightChargeSpent(cd);
  if (cd._usesLeft <= 0) cd._ruleOut = true;
}
function ruleFacesTick() {
  if (typeof gridData === 'undefined' || !gridData) return;
  const still = !(typeof falling !== 'undefined' && falling) && !(typeof animating !== 'undefined' && animating)
    && !(typeof roundEnded !== 'undefined' && roundEnded) && !(typeof mapScreenOpen !== 'undefined' && mapScreenOpen)
    && !(typeof cascadeRunning === 'function' && cascadeRunning());
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._isSleight || cd.sleightId !== 'rule_faces' || !cd._ruleLanded) continue;
    if (!cd._ruleOut) { cd._ruleLife = (cd._ruleLife ?? (BAL.rule_faces.life || 60)) - 1; if (cd._ruleLife <= 0) cd._ruleOut = true; }
    if (cd._ruleOut && still) {
      const name = sleightDef(cd)?.name || 'In Your Face';
      noteMessage(`${name} leaves the grid`, '#cc88ff');
      if (typeof discardToPlayed === 'function') discardToPlayed(cd);
      removeAndFall([[r, c]], 'discard');
      return;   // one fall at a time
    }
  }
}
