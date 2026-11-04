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
  const pool = ((typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS.length) ? ACTIVE_RANKS : RANKS)
    .filter(r => !(typeof WILD_RANK !== 'undefined' && r === WILD_RANK));
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
    if (cd._usesLeft !== 'infinite') cd._usesLeft = Math.max(0, (cd._usesLeft || 0) - 1);
    const def = sleightDef(cd), name = def ? def.name : 'Rule';
    const left = cd._usesLeft === 'infinite' ? '' : cd._usesLeft > 0 ? ` (${cd._usesLeft} left)` : ' (its last)';
    let rule = '';
    if (cd.sleightId === 'rule_ranks') { cd._ruleRanks = ruleRollRanks(BAL.rule_ranks.ranks); rule = `${_ruleRanksText(cd._ruleRanks)} replay once`; }
    if (cd.sleightId === 'rule_evens') rule = `even cards score +${BAL.rule_evens.focus} Focus`;
    if (cd.sleightId === 'rule_faces') rule = `face cards rewind the clock ${BAL.rule_faces.seconds}s`;
    showMessage(`${name} on the board${left}: ${rule} while it stays`, '#cc88ff');
  }
}

// calcScore's card loop: the replays a card takes from rule_ranks.
function ruleRankReplays(rank) {
  const cd = ruleSleightOn('rule_ranks');
  return (cd && cd._ruleRanks && cd._ruleRanks.includes(rank)) ? 1 : 0;
}
// playHand: what the scored cells pay under rule_evens / rule_faces, once per
// scoring (a card that replays pays again). `retrig` is the hand's replay counts by cell.
function _ruleCellsPay(cells, retrig, test) {
  let n = 0;
  (cells || []).forEach(([r, c]) => {
    const cd = gridData[r]?.[c];
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
  if (!ruleSleightOn('rule_faces')) return 0;
  return _ruleCellsPay(cells, retrig, rk => RULE_FACE_RANKS.includes(rk)) * BAL.rule_faces.seconds;
}
