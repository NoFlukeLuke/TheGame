// ══════════════════════════════════════════════════════════════════════════════
// CHALLENGE CARDS (r444, reworked r450)
// ══════════════════════════════════════════════════════════════════════════════
// A challenge card sits on the board and asks for one thing. Two ways to meet one:
//
// THE CHALLENGE ROUND (Classic, the Schedule's AUDIT) - `crRound`
//   The full goal plus CR_CARDS (3) cards, one after another. The round cannot end
//   on the goal while a card is unsolved (roundQuotaMet asks crHoldsGoal).
//     all solved + goal              -> the reward is the PRIZE grid
//     clock out, goal met, unsolved  -> cleared, but the PENALTY grid comes first
//     clock out, goal not met        -> an ordinary lost round
//   Each solved card pays CR_CARD_CREDITS on the spot. Classic plays one as node
//   `challengeNode` of every quarter; half the Schedule's challenge tiles are an
//   AUDIT, which adds CR_MAP_BONUS_SECONDS past the round cap.
//
// FLOW (r450, owner spec) - `crFlow`
//   Cards turn up on their own, CR_FLOW_PER_CYCLE per boss cycle, never within a
//   minute of a boss (on either side), with a CR_FLOW_SPICE chance of a second one
//   CR_FLOW_SPICE_DELAY seconds later. Each has its own CR_FLOW_TIME clock that
//   only runs while the round clock does, so it waits out a level-up and resumes.
//   Solved: + credits, + seconds and +1 reward at the next level-up. Timed out:
//   the same amounts taken away, and one fewer reward (never below one). The
//   amounts come from the card's difficulty (CR_DIFFICULTY -> CR_FLOW_STAKES).
//
// THE CARD is a board object, not a hole: { _isStone, _isChallenge, cr }. Its
// requirement, progress and clock live ON it (`cr`), so two can share a board and
// a save carries them with gridData. _isStone buys every "not a real card"
// exclusion the engine already has; cardCan lets it only fall and render.
//
// ARRIVAL: the chosen cell pulses (cr-tele) for a few seconds, its card sinks into
// the table, and the challenge card drops in from above. Increments, solves and
// failures each have their own look and sound per family (slap / tap / thud).

const CR_CARDS = 3;
const CR_CARD_CREDITS = [5, 8, 12];      // challenge round: paid per card solved
const CR_MAP_BONUS_SECONDS = 60;         // the Schedule's audit adds a minute
const CR_TELE_MS = { seq: 3000, flow: 5000 };   // how long the cell pulses first

const CR_FLOW_TIME = 60;                 // a Flow card's own clock
const CR_FLOW_PER_CYCLE = 2;             // cards per boss cycle
const CR_FLOW_SPICE = 0.10;              // chance of a second card...
const CR_FLOW_SPICE_DELAY = 15;          // ...this many seconds after the first
const CR_FLOW_BOSS_GAP = 60;             // no card within a minute of a boss
const CR_FLOW_TIER_W = [45, 40, 15];     // how often a Flow card is tier 1 / 2 / 3
// Difficulty 1-3 per requirement and tier. The owner assigns these after play;
// until then they follow the tier. The key is `${kind}${tier}`.
const CR_DIFFICULTY = {
  touch1: 1, touch2: 2, hand1: 1, hand2: 2, hand3: 3, suit1: 1, suit2: 2,
  size1: 1, size3: 3, big2: 2, big3: 3, types2: 2, types3: 3, touchhand3: 3,
  colfall2: 2, rowhit2: 2,
};
const CR_FLOW_STAKES = { 1: { credits: 5, secs: 10 }, 2: { credits: 8, secs: 15 }, 3: { credits: 12, secs: 20 } };
const CR_FALL_NEEDED = 2;                // falls / hits a fall card needs

var crRound = null;   // `var`: read by name from files above this one (TDZ)
var crFlow  = null;   // { plan:[clock values], spiceAt, rewardDelta } - in SAVE_VARS
let crArmed = null;   // { source, bonusSecs } | null - in SAVE_VARS
let crSeq = 0;        // id counter for cards
let crTele = [];      // pending arrivals: { r, c, src, tier, idx, el, timer }
let crQueue = [];     // ids of solved / failed cards waiting to leave the board
let crFallSnap = null;
let crRecent = [];    // the last hand scores, for "score X in one hand"

function crLive() { return !!(crRound && crRound.started && !crRound.over); }
function crHoldsGoal() { return crLive() && crRound.solved < CR_CARDS; }

// ── Board helpers ───────────────────────────────────────────────────────────
function crCards() {
  const out = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (cd && cd._isChallenge && cd.cr) out.push([r, c, cd]);
  }
  return out;
}
function crFindCard(src) { const h = crCards().find(([, , cd]) => !src || cd.cr.src === src); return h ? [h[0], h[1]] : null; }
function crFindById(id) { const h = crCards().find(([, , cd]) => cd._id === id); return h || null; }
function crCardEl(cd) { return cd ? document.querySelector(`#grid [data-card-id="${cd._id}"]`) : null; }
function crOrdinary(cd) { return !!(cd && cd.rank && !cd._isStone && !cd._isSleight && !cd._isTrick); }
function _crPick(a) { return a[Math.floor(Math.random() * a.length)]; }
function _crRound10(n) { return Math.max(10, Math.round(n / 10) * 10); }

// ── Arming the challenge round ──────────────────────────────────────────────
function crArmNext(opts) { crArmed = { source: 'node', bonusSecs: 0, ...(opts || {}) }; }
function crMaybeArmForNode(node) {
  const n = ACTIVE_MODE && ACTIVE_MODE.challengeNode;
  if (n && node === n) crArmNext({ source: 'node' });
}
function crOnLevelUp() {
  crRound = null;
  if (!crArmed) return;
  if (typeof bossActive !== 'undefined' && bossActive) { crArmed = null; return; }
  crRound = { source: crArmed.source, bonusSecs: crArmed.bonusSecs || 0, solved: 0,
              started: false, over: false, result: null };
  crArmed = null;
}
function crStartBonus() { return (crRound && !crRound.started) ? (crRound.bonusSecs || 0) : 0; }
function crApplyStartTime() {
  if (crRound && !crRound.started && crRound.bonusSecs > 0) roundSeconds += crRound.bonusSecs;
}
function crOnRoundStart() {
  if (crQueue.length) setTimeout(crDrain, 400);   // a card solved by the last hand of a round
  if (!crRound || crRound.started || crRound.over) return;
  crRound.started = true;
  showMessage(`⚑ Challenge round: ${CR_CARDS} challenge cards, one at a time, and the goal.`, 'var(--c-amber, #ffb347)', { ms: 4200 });
  setTimeout(() => crBeginArrival('seq', 1, 0), 650);
}

// ── Requirements ────────────────────────────────────────────────────────────
function _crHandsByValue() {
  const hs = (typeof achievableHandTypes === 'function' ? achievableHandTypes() : ['Pair'])
    .filter(h => (typeof HAND_BASE === 'undefined' || HAND_BASE[h])
              && (typeof handIsActive !== 'function' || handIsActive(h)));   // switched-on types only
  const v = h => handBasePips(h) * handBaseMult(h);
  return hs.sort((a, b) => v(a) - v(b));
}
function _crHandForTier(t) {
  const hs = _crHandsByValue();
  if (hs.length <= 1) return hs[0] || 'Pair';
  const third = Math.max(1, Math.ceil(hs.length / 3));
  const lo = Math.min(hs.length - 1, (t - 1) * third);
  return _crPick(hs.slice(lo, Math.min(hs.length, lo + third)));
}
// "Score X in one hand", set from what recent hands actually scored rather than
// from the goal, which in Flow climbs far faster than a single hand does.
function _crBigTarget(mult) {
  const r = crRecent.slice(-8).sort((a, b) => a - b);
  const med = r.length ? r[Math.floor(r.length / 2)] : roundGoal * 0.15;
  return _crRound10(Math.max(50, med * mult));
}
function crRollReq(t) {
  const sel = limits.selection.current;
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : ['♠', '♥', '♦', '♣'];
  const nTypes = _crHandsByValue().length;
  const opts = {
    1: [ () => ({ kind: 'touch', n: 1 }),
         () => ({ kind: 'hand', hand: _crHandForTier(1) }),
         () => ({ kind: 'suit', n: Math.min(2, sel), suit: _crPick(suits) }),
         () => ({ kind: 'size', n: Math.min(4, sel) }) ],
    2: [ () => ({ kind: 'touch', n: 2 }),
         () => ({ kind: 'hand', hand: _crHandForTier(2) }),
         () => ({ kind: 'suit', n: Math.min(3, sel), suit: _crPick(suits) }),
         () => ({ kind: 'big', at: _crBigTarget(1.3) }),
         () => ({ kind: 'types', n: Math.min(2, nTypes) }),
         () => ({ kind: 'colfall', n: CR_FALL_NEEDED }),
         () => ({ kind: 'rowhit', n: CR_FALL_NEEDED }) ],
    3: [ () => ({ kind: 'touchhand', hand: _crHandForTier(2) }),
         () => ({ kind: 'hand', hand: _crHandForTier(3) }),
         () => ({ kind: 'big', at: _crBigTarget(1.8) }),
         () => ({ kind: 'size', n: Math.min(5, sel) }),
         () => ({ kind: 'types', n: Math.min(3, nTypes) }) ],
  }[Math.max(1, Math.min(3, t))];
  const q = { ..._crPick(opts)(), tier: t, prog: 0, seen: [] };
  q.diff = CR_DIFFICULTY[q.kind + t] || t;
  return q;
}
// Which family a requirement's effects belong to.
function crFamily(q) {
  if (!q) return 'slap';
  if (q.kind === 'colfall' || q.kind === 'rowhit') return 'thud';
  if (q.kind === 'touch') return 'tap';
  return 'slap';
}
// How many boxes the to-do strip draws, and how many are ticked.
function crBoxes(q) {
  if (!q) return [1, 0];
  if (q.kind === 'touch' || q.kind === 'colfall' || q.kind === 'rowhit') return [q.n, Math.min(q.n, q.prog)];
  if (q.kind === 'types') return [q.n, Math.min(q.n, q.seen.length)];
  return [1, 0];
}
function crReqShort(q) {
  if (!q) return '';
  switch (q.kind) {
    case 'touch':     return q.n > 1 ? `${q.n} HANDS TOUCHING` : 'A HAND TOUCHING';
    case 'hand':      return q.hand.toUpperCase();
    case 'touchhand': return `${q.hand.toUpperCase()} TOUCHING`;
    case 'suit':      return `${q.n}× ${q.suit} IN A HAND`;
    case 'size':      return `${q.n}+ CARD HAND`;
    case 'big':       return `${q.at.toLocaleString()} IN 1 HAND`;
    case 'types':     return `${q.n} HAND TYPES`;
    case 'colfall':   return `FALL ${q.n}×`;
    case 'rowhit':    return `HIT ${q.n}×`;
  }
  return '';
}
function crReqText(q) {
  if (!q) return '';
  switch (q.kind) {
    case 'touch':     return q.n > 1 ? `Score ${q.n} hands that touch this card.` : 'Score a hand that touches this card.';
    case 'hand':      return `Score a ${q.hand}.`;
    case 'touchhand': return `Score a ${q.hand} that touches this card.`;
    case 'suit':      return `Score a hand with ${q.n} or more ${q.suit} cards.`;
    case 'size':      return `Score a hand of ${q.n} or more cards.`;
    case 'big':       return `Score ${q.at.toLocaleString()} or more in one hand.`;
    case 'types':     return `Score ${q.n} different hand types.`;
    case 'colfall':   return `Make this card fall ${q.n} times. No discards in its column.`;
    case 'rowhit':    return `Land ${q.n} falling cards on this card. No discards in its row.`;
  }
  return '';
}
const CR_GLYPH = { touch: '✋', touchhand: '✋', hand: '♠', suit: '♣', size: '▦', big: '★', types: '≡', colfall: '⇩', rowhit: '⤓' };

// ── The face ────────────────────────────────────────────────────────────────
function crCardFaceHTML(card) {
  const q = card && card.cr;
  if (!q) return '';
  const [n, done] = crBoxes(q);
  let boxes = '';
  for (let i = 0; i < n; i++) boxes += `<span class="cr-box${i < done ? ' on' : ''}"></span>`;
  const head = q.src === 'seq' ? `${(q.idx || 0) + 1}/${CR_CARDS}` : `${'◆'.repeat(q.diff || 1)}`;
  const timer = q.src === 'flow'
    ? `<div class="cr-timer${q.timeLeft <= 10 ? ' low' : ''}" style="--crt:${Math.max(0, q.timeLeft / (q.timeMax || CR_FLOW_TIME))}"><b>${q.timeLeft}s</b></div>` : '';
  return `<div class="cr-head">${head}</div>`
       + `<div class="cr-glyph">${CR_GLYPH[q.kind] || '⚑'}</div>`
       + `<div class="cr-req">${crReqShort(q)}</div>`
       + `<div class="cr-boxes">${boxes}</div>` + timer;
}
function crRepaint(cd) {
  const el = crCardEl(cd);
  if (el) { el.innerHTML = crCardFaceHTML(cd); el.classList.toggle('cr-low', !!(cd.cr.src === 'flow' && cd.cr.timeLeft <= 10)); }
}
function crShowInfo(r, c) {
  const cd = (r != null) ? gridData[r]?.[c] : (crCards()[0] || [])[2];
  if (!cd || !cd.cr) return;
  const q = cd.cr, [n, done] = crBoxes(q);
  const extra = (n > 1 ? ` (${done}/${n})` : '') + (q.src === 'flow' ? ` · ${q.timeLeft}s left` : '');
  showMessage(`⚑ ${crReqText(q)}${extra}`, 'var(--c-amber, #ffb347)', { ms: 3200 });
}

// ── Arrival ─────────────────────────────────────────────────────────────────
// Where a card may land. Fall cards have fixed rows: a column card starts at the
// top so it has room to fall, a row card at the bottom so cards can land on it.
// Everything else needs a playable neighbour, or "touch this card" could be
// impossible.
function crSpotsFor(q) {
  const sel = new Set((selected || []).map(([r, c]) => `${r}-${c}`));
  const taken = new Set(crTele.map(t => `${t.r}-${t.c}`));
  const out = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    if (!crOrdinary(gridData[r]?.[c]) || isCellBlocked(r, c) || sel.has(`${r}-${c}`) || taken.has(`${r}-${c}`)) continue;
    if (q.kind === 'colfall' && r !== 0) continue;
    if (q.kind === 'rowhit' && r !== gridRows - 1) continue;
    // no two fall cards locking the same line
    if ((q.kind === 'colfall' || q.kind === 'rowhit') && crCards().some(([cr2, cc2, cd]) =>
        (q.kind === 'colfall' && cd.cr.kind === 'colfall' && cc2 === c) || (q.kind === 'rowhit' && cd.cr.kind === 'rowhit' && cr2 === r))) continue;
    const nb = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].some(([nr, nc]) => nr >= 0 && nc >= 0 && nr < gridRows && nc < gridCols
      && crOrdinary(gridData[nr]?.[nc]) && !isCellBlocked(nr, nc));
    if (!nb) continue;
    out.push([r, c]);
  }
  return out;
}
function crBusy() {
  return animating || falling || dealPhase || roundEnded || gameTimerPaused
      || (typeof bossActive !== 'undefined' && bossActive);
}
// Pick the cell and pulse it. The card is placed when the pulse ends.
function crBeginArrival(src, tier, idx) {
  if (src === 'seq' && (!crLive() || crRound.solved >= CR_CARDS)) return;
  if (crBusy()) { setTimeout(() => crBeginArrival(src, tier, idx), 300); return; }
  let q = crRollReq(tier), spots = crSpotsFor(q);
  for (let k = 0; k < 6 && !spots.length; k++) { q = crRollReq(tier); spots = crSpotsFor(q); }
  if (!spots.length) { setTimeout(() => crBeginArrival(src, tier, idx), 600); return; }
  const [r, c] = _crPick(spots);
  const t = { r, c, src, tier, idx, q };
  crTele.push(t);
  crTelePaint(t);
  sfxChallengeWarn();
  t.timer = setTimeout(() => crLand(t), CR_TELE_MS[src] || 3000);
}
function crTelePaint(t) {
  const g = document.getElementById('grid'); if (!g || typeof cellLeft !== 'function') return;
  const el = document.createElement('div');
  el.className = 'cr-tele';
  el.style.left = cellLeft(t.c) + 'px'; el.style.top = cellTop(t.r) + 'px';
  el.style.setProperty('--cr-tele-ms', (CR_TELE_MS[t.src] || 3000) + 'ms');
  g.appendChild(el); t.el = el;
}
function crTeleDrop(t) { if (t.el) t.el.remove(); crTele = crTele.filter(x => x !== t); clearTimeout(t.timer); }
function crLand(t) {
  if (t.src === 'seq' && (!crLive() || crRound.solved >= CR_CARDS)) { crTeleDrop(t); return; }
  if (t.src === 'flow' && !crFlowMayRun()) { crTeleDrop(t); return; }
  if (crBusy()) { t.timer = setTimeout(() => crLand(t), 250); return; }
  // The cell may have changed while it pulsed; fall back to a fresh spot. Its own
  // pulse comes off first, or crSpotsFor would count the cell as taken.
  crTeleDrop(t);
  if (!crSpotsFor(t.q).some(([r, c]) => r === t.r && c === t.c)) {
    const s = crSpotsFor(t.q);
    if (!s.length) { if (t.src === 'seq') setTimeout(() => crBeginArrival('seq', t.tier, t.idx), 600); return; }
    [t.r, t.c] = _crPick(s);
  }
  const old = gridData[t.r][t.c], oldEl = crCardEl(old);
  const place = () => {
    if (!crOrdinary(gridData[t.r]?.[t.c])) { if (t.src === 'seq') setTimeout(() => crBeginArrival('seq', t.tier, t.idx), 400); return; }
    discardToDrawPile(gridData[t.r][t.c]);
    const q = { ...t.q, src: t.src, idx: t.idx };
    if (t.src === 'flow') { q.timeLeft = CR_FLOW_TIME; q.timeMax = CR_FLOW_TIME; }
    const card = { rank: '?', suit: 'stone', _isStone: true, _isChallenge: true, _id: `cr-${Date.now()}-${++crSeq}`, cr: q };
    gridData[t.r][t.c] = card;
    render();
    crFxLand(card);
    crShowInfo(t.r, t.c);
  };
  // The old card sinks into the table (the animation lab's Sink look), then the
  // challenge card drops in from above.
  if (oldEl && typeof cardAnimRunner === 'function' && cardAnimRunner('discard', 'sink')) {
    cardAnimRunner('discard', 'sink')({ cards: [oldEl] }).catch(() => {}).then(place);
  } else place();
}

// ── Scoring a hand ──────────────────────────────────────────────────────────
// playHand, after the score is committed and BEFORE the goal check.
function crOnHand(hand, handCells, finalScore) {
  if (finalScore > 0) { crRecent.push(finalScore); if (crRecent.length > 12) crRecent.shift(); }
  const cards = (handCells || []).map(([r, c]) => gridData[r]?.[c]).filter(Boolean);
  const touches = (r0, c0) => (handCells || []).some(([r, c]) => Math.abs(r - r0) + Math.abs(c - c0) === 1);
  for (const [r, c, cd] of crCards()) {
    const q = cd.cr;
    if (q.done) continue;
    let met = false, inc = false;
    switch (q.kind) {
      case 'touch':     if (touches(r, c)) { q.prog++; inc = true; met = q.prog >= q.n; } break;
      case 'hand':      met = hand === q.hand; break;
      case 'touchhand': met = hand === q.hand && touches(r, c); break;
      case 'suit':      met = cards.filter(x => x.suit === q.suit && !isWildCard(x)).length >= q.n; break;
      case 'size':      met = handCells.length >= q.n; break;
      case 'big':       met = finalScore >= q.at; break;
      case 'types':     if (!q.seen.includes(hand)) { q.seen.push(hand); inc = true; } met = q.seen.length >= q.n; break;
      default: continue;   // fall cards count on the board, not on hands
    }
    if (met) crSolve(cd);
    else if (inc) { crRepaint(cd); crFxIncrement(cd); }
  }
}

// ── Fall cards ──────────────────────────────────────────────────────────────
// removeAndFall snapshots the fall cards before it moves anything and compares
// at its tail: a column card that moved down fell once; a row card whose cell
// above holds a different card after the fall was hit once.
function crBeforeFall() {
  crFallSnap = crCards().filter(([, , cd]) => cd.cr.kind === 'colfall' || cd.cr.kind === 'rowhit')
    .map(([r, c, cd]) => ({ id: cd._id, r, c, above: r > 0 ? (gridData[r - 1]?.[c]?._id ?? null) : null }));
}
function crAfterFall() {
  const snap = crFallSnap; crFallSnap = null;
  if (!snap || !snap.length) return;
  for (const s of snap) {
    const h = crFindById(s.id); if (!h) continue;
    const [r, c, cd] = h, q = cd.cr;
    if (q.done) continue;
    let hit = false;
    if (q.kind === 'colfall' && r > s.r) hit = true;
    if (q.kind === 'rowhit' && r > 0) { const now = gridData[r - 1]?.[c]?._id ?? null; hit = now != null && now !== s.above; }
    if (!hit) continue;
    q.prog++;
    if (q.prog >= q.n) crSolve(cd);
    else { crRepaint(cd); crFxIncrement(cd); }
  }
}
// doDiscard: refused while a selected card shares a fall card's locked line.
function crDiscardLocked(cells) {
  const locks = crCards().filter(([, , cd]) => !cd.cr.done && (cd.cr.kind === 'colfall' || cd.cr.kind === 'rowhit'));
  for (const [r0, c0, cd] of locks)
    if ((cells || []).some(([r, c]) => cd.cr.kind === 'colfall' ? c === c0 : r === r0))
      return cd.cr.kind === 'colfall' ? 'No discards in a challenge card’s column' : 'No discards in a challenge card’s row';
  return null;
}
// The locked line, drawn behind the cards. Called from render's tail.
function crPaintLocks() {
  const g = document.getElementById('grid'); if (!g) return;
  g.querySelectorAll('.cr-lock').forEach(e => e.remove());
  if (!g.querySelector('[data-card-id]') || typeof cellLeft !== 'function') return;
  const W = cellLeft(gridCols - 1) + CARD_W - cellLeft(0), H = cellTop(gridRows - 1) + CARD_H - cellTop(0);
  for (const [r, c, cd] of crCards()) {
    if (cd.cr.done || (cd.cr.kind !== 'colfall' && cd.cr.kind !== 'rowhit')) continue;
    const el = document.createElement('div');
    el.className = 'cr-lock cr-lock-' + (cd.cr.kind === 'colfall' ? 'col' : 'row');
    if (cd.cr.kind === 'colfall') { el.style.left = (cellLeft(c) - 3) + 'px'; el.style.top = (cellTop(0) - 3) + 'px'; el.style.width = (CARD_W + 6) + 'px'; el.style.height = (H + 6) + 'px'; }
    else { el.style.left = (cellLeft(0) - 3) + 'px'; el.style.top = (cellTop(r) - 3) + 'px'; el.style.width = (W + 6) + 'px'; el.style.height = (CARD_H + 6) + 'px'; }
    g.appendChild(el);
  }
}

// ── Solved / failed ─────────────────────────────────────────────────────────
function crSolve(cd) {
  const q = cd.cr; q.done = 'won';
  crRepaint(cd); crFxSolve(cd);
  if (q.src === 'seq' && crRound) {
    const pay = CR_CARD_CREDITS[Math.min(CR_CARD_CREDITS.length - 1, crRound.solved)] || 0;
    crRound.solved++;
    if (pay > 0) { coins += pay; updateCoinsUI(); }
    const left = CR_CARDS - crRound.solved;
    showMessage(left > 0 ? `⚑ Challenge ${crRound.solved}/${CR_CARDS} solved · +${pay} credits`
                         : `⚑ All ${CR_CARDS} challenges solved · +${pay} credits · prize grid earned`, 'var(--gold)');
  } else if (q.src === 'flow') {
    const st = CR_FLOW_STAKES[q.diff] || CR_FLOW_STAKES[2];
    coins += st.credits; updateCoinsUI();
    if (typeof rewindTime === 'function') rewindTime(st.secs, `⚑ Challenge - +${st.secs}s`);
    crFlowState().rewardDelta++;
    showMessage(`⚑ Challenge solved · +${st.credits} credits · +${st.secs}s · +1 reward next level-up`, 'var(--gold)');
  }
  crQueue.push(cd._id);
  // A hand's own fall drains this from its tail. A fall card is solved AT that
  // tail, and the goal hand never falls (crSettle lifts the card instead).
  setTimeout(crDrain, 700);
}
function crFail(cd) {
  const q = cd.cr; q.done = 'lost';
  crRepaint(cd); crFxFail(cd);
  const st = CR_FLOW_STAKES[q.diff] || CR_FLOW_STAKES[2];
  coins = Math.max(0, coins - st.credits); updateCoinsUI();
  roundSeconds = Math.max(1, roundSeconds - st.secs); updateClockUI();
  if (typeof showTimeCost === 'function') showTimeCost(`-${st.secs}s`);
  crFlowState().rewardDelta--;
  showMessage(`⚑ Challenge failed · -${st.credits} credits · -${st.secs}s · one fewer reward next level-up`, 'var(--red)');
  crQueue.push(cd._id);
  setTimeout(crDrain, 900);
}
// The card leaves (a fresh card takes its cell); in a challenge round the next
// one is sent for. Never on top of a live fall.
function crDrain() {
  if (!crQueue.length) return;
  if (animating || falling) return;   // the fall's tail calls back
  // A round that is over (the goal hand's finale, a level-up screen) keeps the
  // card until play resumes; crOnRoundStart drains it then.
  if (roundEnded || gameTimerPaused || dealPhase) { setTimeout(crDrain, 500); return; }
  const ids = crQueue.splice(0);
  let nextSeq = false;
  for (const id of ids) {
    const h = crFindById(id);
    if (h) {
      const [r, c, cd] = h;
      crFxLeave(cd).then(() => {
        const again = crFindById(id);
        if (again) { gridData[again[0]][again[1]] = drawCard() || null; render(); }
      });
      if (cd.cr.src === 'seq') nextSeq = true;
    }
  }
  if (nextSeq && crLive() && crRound.solved < CR_CARDS) setTimeout(() => crBeginArrival('seq', crRound.solved + 1, crRound.solved), 700);
}

// ── The clock ───────────────────────────────────────────────────────────────
// The round tick, once per second of live clock. Flow cards count down; the Flow
// spawner reads the session clock.
function crTick() {
  for (const [, , cd] of crCards()) {
    const q = cd.cr;
    if (q.src !== 'flow' || q.done) continue;
    q.timeLeft = Math.max(0, (q.timeLeft || 0) - 1);
    crRepaint(cd);
    if (q.timeLeft <= 5 && q.timeLeft > 0) sfxChallengeTick();
    if (q.timeLeft <= 0) crFail(cd);
  }
  crFlowTick();
}

// ── Flow spawning ───────────────────────────────────────────────────────────
function crFlowState() { return crFlow || (crFlow = { plan: null, spiceAt: null, rewardDelta: 0 }); }
// May a Flow card arrive or keep pulsing right now? Never in a boss, the
// walkthrough, or within a minute of either end of one.
function crFlowMayRun() {
  if (typeof flowActive !== 'function' || !flowActive()) return false;
  if (typeof bossActive !== 'undefined' && bossActive) return false;
  if (typeof tutorialActive === 'function' && tutorialActive()) return false;
  return roundSeconds >= CR_FLOW_TIME + CR_FLOW_BOSS_GAP;
}
// A plan is two session-clock values to arrive at, drawn once per boss cycle
// from the stretch that leaves a minute after the last boss and a full card
// plus a minute before the next.
function crFlowPlanCycle() {
  const S = (typeof flowSessionSeconds === 'function') ? flowSessionSeconds() : 300;
  const hi = Math.min(roundSeconds, S) - CR_FLOW_BOSS_GAP, lo = CR_FLOW_TIME + CR_FLOW_BOSS_GAP + 5;
  const st = crFlowState();
  st.plan = [];
  if (hi <= lo) return;
  // Spaced so a planned card never lands while the one before it is still on
  // its clock: each slot is drawn from what is left after reserving a full card
  // (plus a beat) for every slot still to come.
  const gap = CR_FLOW_TIME + 5;
  let top = hi;
  for (let i = 0; i < CR_FLOW_PER_CYCLE; i++) {
    const room = top - lo - gap * (CR_FLOW_PER_CYCLE - 1 - i);
    if (room < 0) break;
    const t = Math.round(top - Math.random() * room);
    st.plan.push(t);
    top = t - gap;
  }
  st.spiceAt = null;
}
function crFlowTick() {
  if (typeof flowActive !== 'function' || !flowActive()) return;
  if (typeof bossActive !== 'undefined' && bossActive) return;   // never plan off the boss clock
  const st = crFlowState();
  if (!st.plan) crFlowPlanCycle();
  if (!crFlowMayRun() || roundEnded) return;
  const live = crCards().filter(([, , cd]) => cd.cr.src === 'flow' && !cd.cr.done).length + crTele.filter(t => t.src === 'flow').length;
  if (st.spiceAt != null && roundSeconds <= st.spiceAt) {
    st.spiceAt = null;
    if (live < 2) crFlowSpawn(false);
    return;
  }
  if (st.plan.length && roundSeconds <= st.plan[0]) {
    st.plan.shift();
    if (live < 2) crFlowSpawn(true);
  }
}
function crFlowSpawn(mayChain) {
  const w = CR_FLOW_TIER_W, tot = w.reduce((a, b) => a + b, 0);
  let x = Math.random() * tot, tier = 1;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) { tier = i + 1; break; } }
  crBeginArrival('flow', tier, 0);
  // A little spice: now and then a second card follows, if it still fits.
  if (mayChain && Math.random() < CR_FLOW_SPICE && roundSeconds - CR_FLOW_SPICE_DELAY >= CR_FLOW_TIME + CR_FLOW_BOSS_GAP)
    crFlowState().spiceAt = roundSeconds - CR_FLOW_SPICE_DELAY;
}
// flowTriggerBoss: nothing overlaps a boss. Cards on the board leave quietly.
function crFlowCancel() {
  crTele.filter(t => t.src === 'flow').forEach(crTeleDrop);
  for (const [r, c, cd] of crCards()) if (cd.cr.src === 'flow') gridData[r][c] = drawCard() || null;
  const st = crFlowState(); st.plan = []; st.spiceAt = null;
}
// flowEndBoss: the next cycle draws a fresh plan once the clock refills.
function crFlowNewCycle() { crFlowState().plan = null; }
// flowrArm: what this level-up's reward count gains or loses. Spent once.
function crTakeFlowRewardDelta() {
  const st = crFlowState(), d = st.rewardDelta || 0;
  st.rewardDelta = 0;
  return d;
}

// ── The challenge round's clock and settlement ──────────────────────────────
function crOnClockOut() {
  if (!crHoldsGoal()) return false;
  crRound.over = true;
  if (!roundQuotaMet()) { crRound.over = false; return false; }
  crRound.result = 'lost';
  goalReachedThisRound = true;
  roundEnded = true;
  clearInterval(roundInterval); roundInterval = null;
  gameTimerPaused = true;
  frozenRoundSeconds = roundSeconds;
  crTele.filter(t => t.src === 'seq').forEach(crTeleDrop);
  const at = crCards().find(([, , cd]) => cd.cr.src === 'seq' && !cd.cr.done);
  if (at) { at[2].cr.done = 'lost'; crRepaint(at[2]); crFxFail(at[2]); }
  showMessage(`⚑ Out of time · ${crRound.solved}/${CR_CARDS} challenges solved`, 'var(--red)');
  if (typeof flashRoundEnd === 'function') flashRoundEnd();
  setTimeout(() => startInterlude(), 900);
  return true;
}
function crSettle() {
  if (!crRound) return Promise.resolve();
  crTele.filter(t => t.src === 'seq').forEach(crTeleDrop);
  for (const [r, c, cd] of crCards()) if (cd.cr.src === 'seq') gridData[r][c] = drawCard() || null;
  crQueue = [];
  if (!crRound.result) crRound.result = crRound.solved >= CR_CARDS ? 'won' : 'lost';
  crRound.over = true;
  if (crRound.result !== 'lost') return Promise.resolve();
  return new Promise(res => openPenaltyGrid(res));
}
function crTakePrize() {
  const won = !!(crRound && crRound.result === 'won');
  if (crRound && crRound.result) crRound = null;
  return won;
}
function crReset() {
  crTele.forEach(t => { if (t.el) t.el.remove(); clearTimeout(t.timer); });
  crRound = null; crArmed = null; crFlow = null; crTele = []; crQueue = []; crRecent = []; crFallSnap = null;
}

// ══════════════════════════════════════════════════════════════════════════════
// LOOKS. WAAPI on the standalone translate / scale / rotate properties, so they
// compose with the heartbeat's transform, and every animation cancels on finish.
// ══════════════════════════════════════════════════════════════════════════════
function _crAnim(el, frames, opts) {
  if (!el || typeof el.animate !== 'function') return Promise.resolve();
  const a = el.animate(frames, opts);
  return a.finished.catch(() => {}).then(() => a.cancel());
}
// Small particles in #grid at a card's centre.
function crBurst(cd, n, cls, spread) {
  const el = crCardEl(cd), g = document.getElementById('grid');
  if (!el || !g) return;
  const x = el.offsetLeft + el.offsetWidth / 2, y = el.offsetTop + el.offsetHeight / 2;
  const rnd = typeof fxRandom === 'function' ? fxRandom : Math.random;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'cr-p ' + cls;
    p.style.left = x + 'px'; p.style.top = y + 'px';
    g.appendChild(p);
    const ang = (cls === 'cr-dust') ? (Math.PI * (0.05 + 0.9 * rnd())) : rnd() * Math.PI * 2;
    const d = spread * (0.5 + rnd() * 0.6);
    const dx = Math.cos(ang) * d * (cls === 'cr-dust' ? 1 : 1), dy = (cls === 'cr-dust' ? -Math.abs(Math.sin(ang)) * d * 0.35 + el.offsetHeight * 0.4 : Math.sin(ang) * d);
    p.animate([{ translate: '0px 0px', scale: '1', opacity: 1 }, { translate: `${dx}px ${dy}px`, scale: '0.3', opacity: 0 }],
      { duration: 480 + rnd() * 260, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.catch(() => {}).then(() => p.remove());
  }
}
// Dropped in from above: big and high, then it lands with a squash.
function crFxLand(cd) {
  sfxChallengeLand();
  const el = crCardEl(cd);
  _crAnim(el, [
    { translate: '0px -140px', scale: '1.6', rotate: '-8deg', opacity: 0, filter: 'drop-shadow(0 40px 14px rgba(0,0,0,.6))' },
    { translate: '0px -40px', scale: '1.2', rotate: '-3deg', opacity: 1, offset: 0.55 },
    { translate: '0px 3px', scale: '1.12 0.84', rotate: '0deg', offset: 0.8, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.6))' },
    { translate: '0px -2px', scale: '0.96 1.05', offset: 0.9 },
    { translate: '0px 0px', scale: '1', opacity: 1 } ], { duration: 620, easing: 'cubic-bezier(.45,0,.4,1)' });
  setTimeout(() => crBurst(cd, 10, 'cr-dust', 46), 480);
}
function crFxIncrement(cd) {
  const el = crCardEl(cd), fam = crFamily(cd.cr);
  if (fam === 'slap') {
    sfxChallengeSlap();
    _crAnim(el, [ { scale: '1', rotate: '0deg' }, { scale: '1.18 0.82', rotate: '-4deg', offset: 0.25 },
                  { scale: '0.94 1.06', rotate: '3deg', offset: 0.55 }, { scale: '1', rotate: '0deg' } ], { duration: 360, easing: 'ease-out' });
    crBurst(cd, 6, 'cr-spark', 34);
  } else if (fam === 'tap') {
    sfxChallengeTap();
    _crAnim(el, [ { scale: '1' }, { scale: '1.08', offset: 0.3 }, { scale: '1' } ], { duration: 300, easing: 'ease-out' });
    crBurst(cd, 8, 'cr-ring', 30);
  } else {
    sfxChallengeThud();
    _crAnim(el, [ { translate: '0px -10px', scale: '1' }, { translate: '0px 2px', scale: '1.16 0.8', offset: 0.35 },
                  { translate: '0px -3px', scale: '0.95 1.06', offset: 0.65 }, { translate: '0px 0px', scale: '1' } ], { duration: 420, easing: 'ease-out' });
    crBurst(cd, 12, 'cr-dust', 52);
  }
  const b = el && el.querySelector('.cr-box.on:last-of-type');
  if (b) _crAnim(b, [{ scale: '1.9' }, { scale: '1' }], { duration: 320, easing: 'cubic-bezier(.3,1.6,.5,1)' });
}
function crFxSolve(cd) {
  sfxChallengeSolve();
  const el = crCardEl(cd); if (!el) return;
  el.classList.add('cr-won');
  _crAnim(el, [ { scale: '1', rotate: '0deg' }, { scale: '1.25', rotate: '6deg', offset: 0.35 }, { scale: '1', rotate: '0deg' } ], { duration: 520, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  crBurst(cd, 16, 'cr-spark', 60);
}
function crFxFail(cd) {
  sfxChallengeExpire();
  const el = crCardEl(cd); if (!el) return;
  el.classList.add('cr-lost');
  _crAnim(el, [ { translate: '0px 0px' }, { translate: '-5px 0px', offset: 0.15 }, { translate: '5px 0px', offset: 0.3 },
                { translate: '-4px 0px', offset: 0.45 }, { translate: '3px 0px', offset: 0.6 }, { translate: '0px 0px' } ], { duration: 520 });
}
function crFxLeave(cd) {
  const el = crCardEl(cd);
  if (!el) return Promise.resolve();
  const won = cd.cr.done === 'won';
  return _crAnim(el, won
    ? [ { translate: '0px 0px', scale: '1', opacity: 1 }, { translate: '0px -60px', scale: '0.6', opacity: 0 } ]
    : [ { translate: '0px 0px', scale: '1', rotate: '0deg', opacity: 1 }, { translate: '0px 30px', scale: '0.5', rotate: '18deg', opacity: 0 } ],
    { duration: 380, easing: won ? 'cubic-bezier(.4,0,.2,1)' : 'ease-in' });
}

// ── Sounds (synthesised; catalogued in js/audio-assets.js, group Challenge) ──
function _crVoice(build) {
  const v = (typeof sfxVolume === 'function') ? sfxVolume() : 1; if (v <= 0) return;
  try { const ctx = getAudioCtx(); build(ctx, v, ctx.currentTime, sfxOut(ctx)); } catch (e) {}
}
function _crNoise(ctx, sec, shape) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * sec)), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  const rnd = typeof fxRandom === 'function' ? fxRandom : Math.random;
  for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * shape(i / n);
  return b;
}
function _crHit(ctx, out, t, buf, gain, type, freq, q) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q || 0.8; g.gain.value = gain;
  s.connect(f).connect(g).connect(out); s.start(t);
}
function _crTone(ctx, out, t, f0, f1, dur, gain, type) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
// The cell starts to pulse: a soft rising siren of three pings.
function sfxChallengeWarn() {
  _crVoice((ctx, v, t, out) => { [0, 0.18, 0.36].forEach((d, i) => _crTone(ctx, out, t + d, 620 + i * 140, 700 + i * 140, 0.16, 0.06 * v, 'triangle')); });
}
// Dropped from above: a falling whoosh into a thump.
function sfxChallengeLand() {
  _crVoice((ctx, v, t, out) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = _crNoise(ctx, 0.36, p => Math.sin(p * Math.PI)); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.34); g.gain.value = 0.10 * v;
    s.connect(f).connect(g).connect(out); s.start(t);
    _crTone(ctx, out, t + 0.33, 140, 48, 0.28, 0.22 * v, 'sine');
    _crHit(ctx, out, t + 0.33, _crNoise(ctx, 0.12, p => 1 - p), 0.12 * v, 'lowpass', 600);
  });
}
// A hand counted toward a card: a flat-palm slap.
function sfxChallengeSlap() {
  _crVoice((ctx, v, t, out) => {
    _crHit(ctx, out, t, _crNoise(ctx, 0.07, p => Math.pow(1 - p, 3)), 0.30 * v, 'bandpass', 1500, 0.7);
    _crHit(ctx, out, t, _crNoise(ctx, 0.05, p => Math.pow(1 - p, 2)), 0.18 * v, 'highpass', 3800, 0.6);
    _crTone(ctx, out, t, 210, 120, 0.09, 0.12 * v, 'sine');
  });
}
// A touching hand: a light wooden tap.
function sfxChallengeTap() {
  _crVoice((ctx, v, t, out) => { _crTone(ctx, out, t, 880, 760, 0.09, 0.10 * v, 'triangle'); _crHit(ctx, out, t, _crNoise(ctx, 0.03, p => 1 - p), 0.08 * v, 'bandpass', 2600, 2); });
}
// A fall card falls, or is landed on: a heavy stone thud with grit.
function sfxChallengeThud() {
  _crVoice((ctx, v, t, out) => {
    _crTone(ctx, out, t, 96, 38, 0.36, 0.30 * v, 'sine');
    _crTone(ctx, out, t, 180, 70, 0.14, 0.10 * v, 'triangle');
    _crHit(ctx, out, t, _crNoise(ctx, 0.22, p => Math.pow(1 - p, 1.5)), 0.16 * v, 'lowpass', 900);
    _crHit(ctx, out, t + 0.03, _crNoise(ctx, 0.18, p => (1 - p) * (0.4 + 0.6 * Math.abs(Math.sin(p * 40)))), 0.07 * v, 'bandpass', 2200, 1.2);
  });
}
// Solved: a stamp, then a bright rising chime.
function sfxChallengeSolve() {
  _crVoice((ctx, v, t, out) => {
    _crTone(ctx, out, t, 160, 80, 0.12, 0.18 * v, 'sine');
    [659.3, 830.6, 987.8, 1318.5].forEach((f, i) => _crTone(ctx, out, t + 0.06 + i * 0.07, f, f, 0.32, 0.09 * v, 'triangle'));
  });
}
// Failed: a sagging buzz that crumbles.
function sfxChallengeExpire() {
  _crVoice((ctx, v, t, out) => {
    _crTone(ctx, out, t, 330, 110, 0.55, 0.10 * v, 'sawtooth');
    _crTone(ctx, out, t, 220, 74, 0.55, 0.08 * v, 'square');
    _crHit(ctx, out, t + 0.35, _crNoise(ctx, 0.3, p => (1 - p) * (p * 30 % 1 < 0.4 ? 1 : 0.2)), 0.10 * v, 'lowpass', 1400);
  });
}
// The last five seconds of a Flow card.
function sfxChallengeTick() {
  _crVoice((ctx, v, t, out) => _crTone(ctx, out, t, 1240, 1240, 0.05, 0.05 * v, 'square'));
}

// Dev panel: the next round is a challenge round; drop a Flow card now.
function devArmChallengeRound() {
  crArmNext({ source: 'dev' });
  showMessage('Next round is a challenge round', 'var(--gold)');
}
function devFlowChallengeNow(tier) {
  if (typeof closeDevPanel === 'function') closeDevPanel();
  if (typeof flowActive !== 'function' || !flowActive()) { showMessage('Flow only', 'var(--red)'); return; }
  crBeginArrival('flow', tier || 2, 0);
}
