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
//   Each card pays its banked tier's credits (CR_FLOW_STAKES). Classic plays one as node
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
//   amounts come from the difficulty of the card's tier (CR_FLOW_STAKES).
//
// LADDERS (r463): every card is a ladder of tiers (see crTypeDefs). Clear a tier
// and the card offers the next one: tap to take, double-tap to raise.
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
const CR_MAP_BONUS_SECONDS = 60;         // the Schedule's audit adds a minute
function crTimed(src) { return src === 'flow' || src === 'spot'; }
const CR_TELE_MS = { seq: 3000, flow: 10000, spot: 10000 };   // how long the cell pulses first
// Flow's warning marks a CELL and counts live seconds (crTick), so it waits out a
// pause. Discarding the card in that cell refuses the challenge: the player
// chooses whether to take it on (owner).

const CR_FLOW_TIME = 60;                 // a Flow card's own clock
const CR_FLOW_PER_CYCLE = 2;             // cards per boss cycle
const CR_FLOW_SPICE = 0.10;              // chance of a second card...
const CR_FLOW_SPICE_DELAY = 15;          // ...this many seconds after the first
const CR_FLOW_BOSS_GAP = 60;             // no card within a minute of a boss
const CR_FLOW_TIER_W = [45, 40, 15];     // how often a Flow card's ladder STARTS at difficulty 1 / 2 / 3
// What a tier is worth by difficulty: credits and seconds in every mode. Taken at
// difficulty 2+ (CR_BONUS_D) it also pays a reward: +1 at Flow's next level-up, a
// free 3x3 mini grid elsewhere. A failed tier takes the same amounts away.
const CR_FLOW_STAKES = { 1: { credits: 4, secs: 10 }, 2: { credits: 9, secs: 16 }, 3: { credits: 15, secs: 24 } };
const CR_BONUS_D = 2;

var crRound = null;   // `var`: read by name from files above this one (TDZ)
var crFlow  = null;   // { plan:[clock values], spiceAt, rewardDelta } - in SAVE_VARS
// A SPOT card: an ordinary round in a node mode (Classic, Guided, the Schedule)
// has CR_SPOT_CHANCE of one challenge card, timed and refusable like Flow's.
// { at: clock value to arrive at | null, minis } - in SAVE_VARS.
var crSpot  = null;
const CR_SPOT_CHANCE = 0.25;
let crArmed = null;   // { source, bonusSecs } | null - in SAVE_VARS
let crSeq = 0;        // id counter for cards
let crTele = [];      // pending arrivals: { r, c, src, tier, idx, el, timer }
let crQueue = [];     // ids of solved / failed cards waiting to leave the board
let crFallSnap = null;
let crRecent = [];    // the last hand scores, for "score X in one hand"

function crLive() { return !!(crRound && crRound.started && !crRound.over); }
function crHoldsGoal() {
  if (!crLive()) return false;
  if (crRound.solved < CR_CARDS) return true;
  // A raised card is a bet still open: the round waits for it.
  return crCards().some(([, , cd]) => cd.cr.src === 'seq' && !cd.cr.done && cd.cr.ladder && cd.cr.banked < cd.cr.tier);
}

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
  // A finished card the queue does not know (a resumed save) leaves too; one still
  // charging its penalty bursts (crFailing) leaves when they end.
  for (const [, , cd] of crCards()) if (cd.cr.done && !crQueue.includes(cd._id) && !crFailing.has(cd._id)) crQueue.push(cd._id);
  if (crQueue.length) setTimeout(crDrain, 400);   // a card solved by the last hand of a round
  if (!crRound) { crSpotRoll(); return; }
  if (crRound.started || crRound.over) return;
  crRound.started = true;
  showMessage(`⚑ Challenge round: ${CR_CARDS} challenge cards, one at a time, and the goal.`, 'var(--c-amber, #ffb347)', { ms: 4200 });
  setTimeout(() => crBeginArrival('seq', 1, 0), 650);
}

// ── Requirements: LADDERS (r463, owner spec) ────────────────────────────────
// Every challenge is a ladder of tiers, each { d: difficulty 1-3, n: target }.
// The card starts on its first tier. Clearing a tier BANKS it; if a higher tier
// exists the card offers it: tap to take the banked payout, double-tap to raise
// to the next tier (no extra time). A raise that fails loses everything banked
// and takes the raised tier's penalty. Unanswered, a cleared card takes its
// payout by itself after CR_CLEAR_HOLD live seconds. Counts carry across tiers.
const CR_CLEAR_HOLD = 6;
const CR_HANDS_LOW = ['Pair', 'Run of 3', 'Three of a Kind'];
const CR_HANDS_MID = ['Two Pair', 'Run of 4', 'Straight'];
const CR_HANDS_TOP = ['Flush', 'Full House', 'Straight Flush', 'Four of a Kind'];
function _crCanMake() {
  return new Set((typeof achievableHandTypes === 'function' ? achievableHandTypes() : ['Pair'])
    .filter(h => (typeof HAND_BASE === 'undefined' || HAND_BASE[h]) && (typeof handIsActive !== 'function' || handIsActive(h))));
}
// "Score X in one hand", set from what recent hands actually scored rather than
// from the goal, which in Flow climbs far faster than a single hand does.
function _crBigTarget(mult) {
  const r = crRecent.slice(-8).sort((a, b) => a - b);
  const med = r.length ? r[Math.floor(r.length / 2)] : roundGoal * 0.15;
  return _crRound10(Math.max(50, med * mult));
}
const _crL = (...p) => p.map(([d, n]) => ({ d, n }));
// Every type the board can actually support right now, with its ladder.
function crTypeDefs() {
  const sel = limits.selection.current, can = _crCanMake(), out = [];
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : ['♠', '♥', '♦', '♣'];
  const named = (list, ladderOf) => list.filter(h => can.has(h)).forEach(h => out.push({ kind: 'hand', hand: h, ladder: ladderOf(h) }));
  out.push({ kind: 'touch', ladder: _crL([1, 4], [2, 5], [3, 8]) });
  named(CR_HANDS_LOW, () => _crL([1, 3], [2, 5], [3, 7]));
  named(CR_HANDS_MID, h => h === 'Straight' ? _crL([2, 2], [3, 4]) : _crL([2, 3], [3, 5]));
  named(CR_HANDS_TOP, h => h === 'Four of a Kind' ? _crL([3, 1]) : _crL([2, 1], [3, 2]));
  if (sel >= 3) out.push({ kind: 'suit', suit: _crPick(suits), per: 3, ladder: _crL([sel === 3 ? 3 : 2, 1]) });
  if (sel >= 4) out.push({ kind: 'size', per: 4, ladder: _crL([1, 2], [3, 5]) });
  if (can.size >= 3) out.push({ kind: 'types', ladder: can.size >= 5 ? _crL([2, 3], [3, 5]) : _crL([2, 3], [3, can.size]).filter((t, i, a) => i === 0 || t.n > a[0].n) });
  out.push({ kind: 'big', ladder: _crL([2, _crBigTarget(1.3)], [3, _crBigTarget(1.8)]) });
  out.push({ kind: 'colfall', ladder: _crL([1, 2], [2, 3], [3, 5]) });
  out.push({ kind: 'rowhit', ladder: _crL([1, 2], [2, 3], [3, 5]) });
  return out;
}
// A card whose ladder STARTS at difficulty `b` (1-3); the nearest lower start if
// none does.
function crRollReq(b) {
  const defs = crTypeDefs();
  let pool = [];
  for (let k = Math.max(1, Math.min(3, b)); k >= 1 && !pool.length; k--) pool = defs.filter(t => t.ladder[0].d === k);
  if (!pool.length) pool = defs;
  return { ..._crPick(pool), tier: 0, banked: -1, prog: 0, seen: [] };
}
function crTarget(q) { return q.ladder[q.tier].n; }
function crDiff(q) { return q.ladder[q.tier].d; }
function crCanRaise(q) { return !q.done && q.banked === q.tier && q.tier < q.ladder.length - 1; }
function crCleared(q) { return !q.done && q.banked === q.tier; }
// Which family a requirement's effects belong to.
function crFamily(q) {
  if (!q) return 'slap';
  if (q.kind === 'colfall' || q.kind === 'rowhit') return 'thud';
  if (q.kind === 'touch') return 'tap';
  return 'slap';
}
function crReqShort(q) {
  if (!q) return '';
  const n = crTarget(q);
  switch (q.kind) {
    case 'touch':   return `${n} HANDS TOUCHING`;
    case 'hand':    return n > 1 ? `${n}× ${q.hand.toUpperCase()}` : q.hand.toUpperCase();
    case 'suit':    return `${q.per}${q.suit} IN A HAND`;
    case 'size':    return `${n}× ${q.per}+ CARDS`;
    case 'big':     return `${n.toLocaleString()} IN 1 HAND`;
    case 'types':   return `${n} HAND TYPES`;
    case 'colfall': return `FALL ${n}×`;
    case 'rowhit':  return `HIT ${n}×`;
  }
  return '';
}
function crReqText(q, tier) {
  if (!q) return '';
  const n = q.ladder[tier == null ? q.tier : tier].n;
  switch (q.kind) {
    case 'touch':   return `Score ${n} hands that touch this card.`;
    case 'hand':    return n > 1 ? `Score ${n} ${q.hand}s.` : `Score a ${q.hand}.`;
    case 'suit':    return `Score a hand with ${q.per} or more ${q.suit} cards.`;
    case 'size':    return `Score ${n} hands of ${q.per} or more cards.`;
    case 'big':     return `Score ${n.toLocaleString()} or more in one hand.`;
    case 'types':   return `Score ${n} different hand types.`;
    case 'colfall': return `Make this card fall ${n} times. No discards in its column.`;
    case 'rowhit':  return `Land ${n} falling cards on this card. No discards in its row.`;
  }
  return '';
}
// Progress toward the CURRENT tier, as [done, of].
function crProg(q) {
  const n = crTarget(q);
  if (q.kind === 'big') return [Math.min(n, q.prog), n];
  return [Math.min(n, q.prog), n];
}
const CR_GLYPH = { touch: '✋', hand: '♠', suit: '♣', size: '▦', big: '★', types: '≡', colfall: '⇩', rowhit: '⤓' };
// What a tier pays (and costs): credits always; in Flow also seconds and a reward.
function crStake(d) { return CR_FLOW_STAKES[d] || CR_FLOW_STAKES[2]; }

// ── The face ────────────────────────────────────────────────────────────────
function crCardFaceHTML(card) {
  const q = card && card.cr;
  if (!q || !q.ladder) return '';
  const pips = q.ladder.map((t, i) => `<span class="cr-pip d${t.d}${i <= q.banked ? ' on' : ''}${i === q.tier ? ' cur' : ''}"></span>`).join('');
  const [done, of] = crProg(q);
  let prog;
  if (q.kind === 'big') prog = `<div class="cr-num">${done >= of ? '✓' : 'best ' + done.toLocaleString()}</div>`;
  else if (of <= 5) { prog = '<div class="cr-boxes">'; for (let i = 0; i < of; i++) prog += `<span class="cr-box${i < done ? ' on' : ''}"></span>`; prog += '</div>'; }
  else prog = `<div class="cr-num">${done}/${of}</div>`;
  const head = (q.src === 'seq' ? `<span class="cr-idx">${(q.idx || 0) + 1}/${CR_CARDS}</span>` : '') + `<span class="cr-pips">${pips}</span>`;
  const timer = crTimed(q.src) && !q.done
    ? `<div class="cr-timer${q.timeLeft <= 10 ? ' low' : ''}" style="--crt:${Math.max(0, q.timeLeft / (q.timeMax || CR_FLOW_TIME))}"><b>${q.timeLeft}s</b></div>` : '';
  const more = crCanRaise(q) ? `<div class="cr-more">▲ MORE?<i>tap take · 2× raise</i></div>` : '';
  return `<div class="cr-head">${head}</div>`
       + `<div class="cr-glyph">${CR_GLYPH[q.kind] || '⚑'}</div>`
       + `<div class="cr-req">${crReqShort(q)}</div>`
       + prog + more + timer;
}
function crRepaint(cd) {
  const el = crCardEl(cd);
  if (!el) return;
  el.innerHTML = crCardFaceHTML(cd);
  el.classList.toggle('cr-low', !!(crTimed(cd.cr.src) && !cd.cr.done && cd.cr.timeLeft <= 10));
  el.classList.toggle('cr-cleared', crCanRaise(cd.cr));
}
function crShowInfo(r, c) {
  const cd = (r != null) ? gridData[r]?.[c] : (crCards()[0] || [])[2];
  if (!cd || !cd.cr || !cd.cr.ladder) return;
  const q = cd.cr, [done, of] = crProg(q);
  const ladder = q.ladder.length > 1 ? ` Tier ${q.tier + 1} of ${q.ladder.length}.` : '';
  const extra = (q.kind !== 'big' && of > 1 ? ` (${done}/${of})` : '') + (crTimed(q.src) ? ` · ${q.timeLeft}s left` : '');
  showMessage(`⚑ ${crReqText(q)}${extra}${ladder}`, 'var(--c-amber, #ffb347)', { ms: 3200 });
}
// A tap on a challenge card (input.js). On a cleared card: tap takes the banked
// payout, double-tap raises. Otherwise it reads out what the card asks.
let _crTapAt = 0, _crTapId = null, _crTapTimer = null;
function crTap(r, c) {
  const cd = gridData[r]?.[c];
  if (!cd || !cd.cr) return;
  if (!crCanRaise(cd.cr)) { crShowInfo(r, c); return; }
  const now = Date.now();
  if (_crTapId === cd._id && now - _crTapAt < 350) {
    clearTimeout(_crTapTimer); _crTapId = null;
    crRaise(cd);
    return;
  }
  _crTapAt = now; _crTapId = cd._id;
  clearTimeout(_crTapTimer);
  _crTapTimer = setTimeout(() => { _crTapId = null; const h = crFindById(cd._id); if (h && crCanRaise(h[2].cr)) crCollect(h[2]); }, 360);
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
  if (crTimed(src)) {
    t.left = Math.round(CR_TELE_MS[src] / 1000);
    const st = src === 'flow' ? crFlowState() : crSpotState();
    if ((st.hints || 0) < 2) {
      st.hints = (st.hints || 0) + 1;
      showMessage(`⚑ A challenge card lands on the marked cell in ${t.left}s. Discard the card there to refuse it.`, 'var(--c-amber, #ffb347)', { ms: 4600 });
    }
  }
  crTelePaint(t);
  sfxChallengeWarn();
  if (!crTimed(src)) t.timer = setTimeout(() => crLand(t), CR_TELE_MS[src] || 3000);
}
// Flow's warning MARKS A CELL (owner, r463). Plays and falls do not move it:
// whatever card sits there when the count ends is the one the challenge card
// replaces. Discarding the card IN that cell refuses the challenge
// (crTeleOnDiscard, from removeAndFall's 'discard' mode). This only keeps the
// pulse drawn - a takeover screen empties #grid and takes it with it.
function crTeleTrack() {
  for (const t of crTele) {
    if (!t.el || !t.el.isConnected) crTelePaint(t);
    else if (typeof cellLeft === 'function') { t.el.style.left = cellLeft(t.c) + 'px'; t.el.style.top = cellTop(t.r) + 'px'; }
  }
}
function crTeleOnDiscard(cells) {
  for (const t of crTele.slice()) {
    if (!crTimed(t.src)) continue;
    if (!(cells || []).some(([r, c]) => r === t.r && c === t.c)) continue;
    crTeleDrop(t);
    sfxChallengeDodge();
    noteMessage('⚑ Challenge refused');
  }
}
function crTelePaint(t) {
  const g = document.getElementById('grid'); if (!g || typeof cellLeft !== 'function') return;
  const el = document.createElement('div');
  el.className = 'cr-tele';
  el.style.left = cellLeft(t.c) + 'px'; el.style.top = cellTop(t.r) + 'px';
  el.style.setProperty('--cr-tele-ms', (CR_TELE_MS[t.src] || 3000) + 'ms');
  if (crTimed(t.src)) {
    el.classList.add('cr-tele-flow');
    const total = CR_TELE_MS[t.src] / 1000;
    el.style.setProperty('--cr-tp', String(1 - (t.left ?? total) / total));
    el.innerHTML = `<b>${t.left ?? total}</b>`;
  }
  if (t.el && t.el.isConnected) t.el.remove();
  g.appendChild(el); t.el = el;
}
function crTeleDrop(t) { if (t.el) t.el.remove(); crTele = crTele.filter(x => x !== t); clearTimeout(t.timer); }
function crLand(t) {
  if (t.src === 'seq' && (!crLive() || crRound.solved >= CR_CARDS)) { crTeleDrop(t); return; }
  if (t.src === 'flow' && !crFlowMayRun()) { crTeleDrop(t); return; }
  if (t.src === 'spot' && !crSpotMayRun()) { crTeleDrop(t); return; }
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
    if (crTimed(t.src)) { q.timeLeft = CR_FLOW_TIME; q.timeMax = CR_FLOW_TIME; }
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
    if (q.done || !q.ladder) continue;
    let inc = false;
    switch (q.kind) {
      case 'touch': if (touches(r, c)) { q.prog++; inc = true; } break;
      case 'hand':  if (hand === q.hand) { q.prog++; inc = true; } break;
      case 'suit':  if (cards.filter(x => x.suit === q.suit && !isWildCard(x)).length >= q.per) { q.prog++; inc = true; } break;
      case 'size':  if (handCells.length >= q.per) { q.prog++; inc = true; } break;
      case 'big':   if (finalScore > q.prog) { q.prog = Math.round(finalScore); inc = true; } break;
      case 'types': if (!q.seen.includes(hand)) { q.seen.push(hand); q.prog = q.seen.length; inc = true; } break;
      default: continue;   // fall cards count on the board, not on hands
    }
    if (inc) crAdvance(cd);
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
    crAdvance(cd);
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
  if (crTele.length && g.querySelector('[data-card-id]')) crTeleTrack();
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

// ── Clear, raise, collect, fail ─────────────────────────────────────────────
// After any progress: has the current tier been reached?
function crAdvance(cd) {
  const q = cd.cr;
  if (q.done) return;
  if (q.prog >= crTarget(q) && q.banked < q.tier) {
    q.banked = q.tier;
    if (q.src === 'seq' && crRound && !q.counted) { q.counted = true; crRound.solved++; }
    if (q.tier >= q.ladder.length - 1) { crCollect(cd); return; }
    q.hold = CR_CLEAR_HOLD;
    crRepaint(cd); crFxClear(cd);
    const st = crStake(crDiff(q)), up = crStake(q.ladder[q.tier + 1].d);
    showMessage(`⚑ Cleared · tap to take +${st.credits}, double-tap to raise: ${crReqText(q, q.tier + 1)} (+${up.credits})`, 'var(--gold)', { ms: 4200 });
    return;
  }
  crRepaint(cd); crFxIncrement(cd);
}
function crRaise(cd) {
  const q = cd.cr;
  if (!crCanRaise(q)) return;
  q.tier++; q.hold = null;
  crRepaint(cd); crFxRaise(cd);
  noteMessage(`⚑ Raised: ${crReqText(q)}`);
  if (q.prog >= crTarget(q)) crAdvance(cd);   // already there: banks at once
}
// Take the banked tier's payout. In a challenge round the next card follows.
function crCollect(cd) {
  const q = cd.cr;
  if (q.done || q.banked < 0) return;
  q.done = 'won';
  const d = q.ladder[q.banked].d, st = crStake(d);
  coins += st.credits; updateCoinsUI();
  crRepaint(cd); crFxSolve(cd);
  if (typeof rewindTime === 'function') rewindTime(st.secs, `⚑ Challenge - +${st.secs}s`);
  const bonus = d >= CR_BONUS_D;
  if (q.src === 'seq' && crRound) {
    if (bonus) crRound.minis = (crRound.minis || 0) + 1;
    const left = CR_CARDS - crRound.solved;
    const pay = `+${st.credits} credits · +${st.secs}s${bonus ? ' · +1 mini grid' : ''}`;
    showMessage(left > 0 ? `⚑ Challenge ${crRound.solved}/${CR_CARDS} done · ${pay}`
                         : `⚑ All ${CR_CARDS} challenges done · ${pay} · prize grid earned`, 'var(--gold)');
  } else if (q.src === 'flow') {
    if (bonus) crFlowState().rewardDelta++;
    showMessage(`⚑ Challenge done · +${st.credits} credits · +${st.secs}s${bonus ? ' · +1 reward next level-up' : ''}`, 'var(--gold)');
  } else if (q.src === 'spot') {
    if (bonus) crSpotState().minis++;
    showMessage(`⚑ Challenge done · +${st.credits} credits · +${st.secs}s${bonus ? ' · +1 mini grid after the round' : ''}`, 'var(--gold)');
  }
  crQueue.push(cd._id);
  setTimeout(crDrain, 700);
}
// The card's clock ran out short of its current tier. A raised card loses what
// it had banked; either way the current tier's penalty is taken.
// r490 (owner): the card STAYS on the board and charges the penalty one burst at
// a time: each flies from the card to the readout it costs (-Ns to the clock,
// -N to the credits, -1 reward to the level in Flow) and is charged when it
// lands, with a hit sound. The card leaves after the last one. crFailGen guards
// the timers against a new run (crReset).
let crFailGen = 0;
const crFailing = new Set();   // ids of failed cards still charging
const CR_FAIL_LEAD = 560, CR_FAIL_STEP = 640;   // ms: the fail shake, then one burst each
function crFail(cd) {
  const q = cd.cr;
  q.done = 'lost';
  crRepaint(cd); crFxFail(cd);
  const st = crStake(crDiff(q));
  const bonus = q.src === 'flow' && crDiff(q) >= CR_BONUS_D;
  // The reward is taken at once: a level-up during the bursts must already see it.
  if (bonus) crFlowState().rewardDelta--;
  const msg = `⚑ Challenge failed${q.banked >= 0 ? ' · banked tier lost' : ''} · -${st.credits} credits · -${st.secs}s${bonus ? ' · one fewer reward next level-up' : ''}`;
  const hits = [
    { to: 'time', label: `-${st.secs}s`, pay: () => { roundSeconds = Math.max(1, roundSeconds - st.secs); updateClockUI(); } },
    { to: 'credits', label: `-${st.credits}`, pay: () => { coins = Math.max(0, coins - st.credits); updateCoinsUI(); } },
  ];
  if (bonus) hits.push({ to: 'level', label: '-1 reward' });
  const gen = crFailGen, id = cd._id;
  crFailing.add(id);
  hits.forEach((h, i) => setTimeout(() => { if (gen === crFailGen) crFxPenalty(id, h, i); }, CR_FAIL_LEAD + i * CR_FAIL_STEP));
  // The notice prints after the bursts: printed first, it hung over the clock the
  // seconds burst flies into.
  setTimeout(() => { if (gen !== crFailGen) return; crFailing.delete(id); showMessage(msg, 'var(--red)'); crQueue.push(id); crDrain(); },
    CR_FAIL_LEAD + (hits.length - 1) * CR_FAIL_STEP + CR_FAIL_FLY + 260);
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
  for (const t of crTele.slice()) {
    if (!crTimed(t.src) || t.left == null) continue;
    t.left--;
    if (t.el) { t.el.style.setProperty('--cr-tp', String(1 - t.left / (CR_TELE_MS[t.src] / 1000))); const b = t.el.querySelector('b'); if (b) b.textContent = Math.max(0, t.left); }
    if (t.left <= 3 && t.left > 0) sfxChallengeTick();
    if (t.left <= 0) { t.left = null; crLand(t); }
  }
  for (const [, , cd] of crCards()) {
    const q = cd.cr;
    if (q.done || !q.ladder) continue;
    // A cleared card nobody answered takes its payout by itself.
    if (crCanRaise(q) && q.hold != null) { if (--q.hold <= 0) { crCollect(cd); continue; } }
    if (!crTimed(q.src)) continue;
    q.timeLeft = Math.max(0, (q.timeLeft || 0) - 1);
    crRepaint(cd);
    if (q.timeLeft <= 5 && q.timeLeft > 0 && !crCleared(q)) sfxChallengeTick();
    if (q.timeLeft <= 0) { if (crCleared(q)) crCollect(cd); else crFail(cd); }
  }
  crFlowTick();
  crSpotTick();
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

// ── Spot cards (r482) ───────────────────────────────────────────────────────
function crSpotState() { return crSpot || (crSpot = { at: null, minis: 0, hints: 0 }); }
function crSpotMayRun() {
  if (typeof isActMode !== 'function' || !isActMode()) return false;
  if (typeof survivalActive === 'function' && survivalActive()) return false;
  if (typeof bossActive !== 'undefined' && bossActive) return false;
  if (typeof tutorialActive === 'function' && tutorialActive()) return false;
  if (crRound) return false;   // a challenge round has its own cards
  return !roundEnded && roundSeconds > CR_FLOW_TIME + 5;
}
// Rolled once per round at its start: maybe one card, arriving at a random point
// that leaves the card its full clock plus a beat.
function crSpotRoll() {
  const st = crSpotState();
  // startRoundTimer also runs on resumes (pause, dev panel, a shop): one roll a level.
  if (st.rolled === level) return;
  st.rolled = level; st.at = null;
  if (!crSpotMayRun() || Math.random() >= CR_SPOT_CHANCE) return;
  const hi = roundSeconds - 15, lo = CR_FLOW_TIME + 10;
  if (hi <= lo) return;
  st.at = Math.round(lo + Math.random() * (hi - lo));
}
function crSpotTick() {
  const st = crSpot;
  if (!st || st.at == null || roundSeconds > st.at) return;
  st.at = null;
  if (!crSpotMayRun()) return;
  const w = CR_FLOW_TIER_W, tot = w.reduce((a, b) => a + b, 0);
  let x = Math.random() * tot, tier = 1;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) { tier = i + 1; break; } }
  crBeginArrival('spot', tier, 0);
}
// The round is over: a spot card still pulsing never lands, one on the board
// leaves (a banked tier is paid, an open one costs nothing), and each mini grid
// it earned opens.
function crSpotSettle() {
  const st = crSpotState();
  st.at = null;
  crTele.filter(t => t.src === 'spot').forEach(crTeleDrop);
  for (const [r, c, cd] of crCards()) {
    if (cd.cr.src !== 'spot') continue;
    if (crCleared(cd.cr)) {
      const d = cd.cr.ladder[cd.cr.banked].d, k = crStake(d);
      coins += k.credits; updateCoinsUI();
      if (d >= CR_BONUS_D) st.minis++;
    }
    gridData[r][c] = drawCard() || null;
  }
  crQueue = crQueue.filter(id => crFindById(id));
  const n = st.minis; st.minis = 0;
  let p = Promise.resolve();
  for (let i = 0; i < n; i++) p = p.then(() => new Promise(res => openMiniGrid(res)));
  return p;
}

// ── The challenge round's clock and settlement ──────────────────────────────
function crOnClockOut() {
  // A cleared, unanswered round card takes its payout; a raised one is lost and
  // no longer counts as done.
  for (const [, , cd] of crCards()) {
    const q = cd.cr;
    if (q.src !== 'seq' || q.done || !q.ladder) continue;
    if (crCleared(q)) crCollect(cd);
    else if (q.counted && crRound) { q.counted = false; crRound.solved--; }
  }
  // Goal met and every card done, but no hand ended the round (the last card
  // cleared by a fall): end it through the interlude so the prize and mini grids
  // are paid, not the legacy level-up path.
  if (!crHoldsGoal()) {
    if (!crRound || crRound.over || goalReachedThisRound || !roundQuotaMet()) return false;
    crRound.over = true;
    goalReachedThisRound = true; roundEnded = true;
    clearInterval(roundInterval); roundInterval = null;
    gameTimerPaused = true; frozenRoundSeconds = roundSeconds;
    if (typeof flashRoundEnd === 'function') flashRoundEnd();
    setTimeout(() => startInterlude(), 900);
    return true;
  }
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
  const spot = crSpotSettle();
  if (!crRound) return spot;
  return spot.then(crSettleRound);
}
function crSettleRound() {
  crTele.filter(t => t.src === 'seq').forEach(crTeleDrop);
  for (const [r, c, cd] of crCards()) {
    if (cd.cr.src !== 'seq') continue;
    // Cleared but never taken: paid as if taken (no clock left to add seconds to).
    if (crCleared(cd.cr)) {
      const d = cd.cr.ladder[cd.cr.banked].d, st = crStake(d);
      coins += st.credits; updateCoinsUI();
      if (d >= CR_BONUS_D) crRound.minis = (crRound.minis || 0) + 1;
    }
    gridData[r][c] = drawCard() || null;
  }
  crQueue = [];
  if (!crRound.result) crRound.result = crRound.solved >= CR_CARDS ? 'won' : 'lost';
  crRound.over = true;
  // Penalty grid first (a lost round), then one free mini grid per card taken at
  // difficulty 2+, then the ordinary rewards.
  const minis = crRound.minis || 0; crRound.minis = 0;
  let p = crRound.result === 'lost' ? new Promise(res => openPenaltyGrid(res)) : Promise.resolve();
  for (let i = 0; i < minis; i++) p = p.then(() => new Promise(res => openMiniGrid(res)));
  return p;
}
function crTakePrize() {
  const won = !!(crRound && crRound.result === 'won');
  if (crRound && crRound.result) crRound = null;
  return won;
}
function crReset() {
  crFailGen++; crFailing.clear();   // drops a failed card's penalty bursts still to come
  crTele.forEach(t => { if (t.el) t.el.remove(); clearTimeout(t.timer); });
  crRound = null; crArmed = null; crFlow = null; crSpot = null; crTele = []; crQueue = []; crRecent = []; crFallSnap = null;
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
// A tier cleared: a stamp, and the card lifts and glows while it waits for an answer.
function crFxClear(cd) {
  sfxChallengeClear();
  const el = crCardEl(cd); if (!el) return;
  _crAnim(el, [ { scale: '1' }, { scale: '1.14', offset: 0.3 }, { scale: '0.97', offset: 0.6 }, { scale: '1' } ], { duration: 460, easing: 'ease-out' });
  crBurst(cd, 10, 'cr-spark', 44);
}
// Raised: a spring upward and a rising sweep.
function crFxRaise(cd) {
  sfxChallengeRaise();
  const el = crCardEl(cd); if (!el) return;
  _crAnim(el, [ { translate: '0px 0px', scale: '1' }, { translate: '0px -16px', scale: '1.1', offset: 0.4 }, { translate: '0px 3px', scale: '0.96 1.04', offset: 0.75 }, { translate: '0px 0px', scale: '1' } ], { duration: 520, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  crBurst(cd, 8, 'cr-ring', 40);
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
// One penalty burst (r490): the card kicks and flashes red, a red plate flies to
// the readout, and on landing the readout jolts, the cost is charged and the hit
// sounds. The plate is the payout plate (efxFly, js/payout-fx.js). A card already
// gone (the round ended under it) fires from the readout itself.
const CR_FAIL_FLY = 620;   // efxFly's flight, for the leave timer; the landing reads efxFly's own return
const CR_FAIL_PLATE = 1.7;   // the penalty plate's size against an ordinary payout plate
const CR_FAIL_TARGETS = { time: 'time', credits: 'credits', level: 'level' };
function crFxPenalty(id, h, i) {
  const at = crFindById(id), el = at && crCardEl(at[2]);
  if (el) {
    _crAnim(el, [ { scale: '1', filter: 'brightness(1)' }, { scale: '1.12 0.9', filter: 'brightness(1.6) saturate(1.6)', offset: 0.25 },
                  { scale: '0.97 1.03', offset: 0.6 }, { scale: '1', filter: 'brightness(1)' } ], { duration: 340, easing: 'ease-out' });
    crBurst(at[2], 6, 'cr-spark', 30);
  }
  sfxChallengePenaltyFire(i);
  const fly = (typeof efxFly === 'function' && efxFly(el, CR_FAIL_TARGETS[h.to], h.label, '#ff4d4d', 'loss', CR_FAIL_PLATE)) || 0;
  setTimeout(() => {
    if (h.pay) h.pay();
    sfxChallengePenalty(i);
    const t = typeof efxTargetEl === 'function' && efxTargetEl(CR_FAIL_TARGETS[h.to]);
    if (t) { t.classList.remove('cr-loss-hit'); void t.offsetWidth; t.classList.add('cr-loss-hit'); setTimeout(() => t.classList.remove('cr-loss-hit'), 520); }
  }, fly);
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
// A penalty burst leaves the card: a short falling whip.
function sfxChallengePenaltyFire(i) {
  _crVoice((ctx, v, t, out) => { _crTone(ctx, out, t, 520 - (i || 0) * 60, 180, 0.16, 0.06 * v, 'sawtooth'); });
}
// A penalty lands on its readout: a heavy low hit and a sour buzz, each one lower.
function sfxChallengePenalty(i) {
  const k = Math.pow(0.84, i || 0);
  _crVoice((ctx, v, t, out) => {
    _crTone(ctx, out, t, 150 * k, 42 * k, 0.42, 0.30 * v, 'sine');
    _crTone(ctx, out, t, 233 * k, 110 * k, 0.32, 0.07 * v, 'square');
    _crTone(ctx, out, t + 0.01, 247 * k, 116 * k, 0.32, 0.06 * v, 'sawtooth');
    _crHit(ctx, out, t, _crNoise(ctx, 0.2, p => Math.pow(1 - p, 2)), 0.16 * v, 'lowpass', 700);
  });
}
// A tier cleared: two bright notes.
function sfxChallengeClear() {
  _crVoice((ctx, v, t, out) => { _crTone(ctx, out, t, 784, 784, 0.14, 0.09 * v, 'triangle'); _crTone(ctx, out, t + 0.1, 1175, 1175, 0.22, 0.09 * v, 'triangle'); });
}
// Raised to the next tier: a rising sweep with a click.
function sfxChallengeRaise() {
  _crVoice((ctx, v, t, out) => {
    _crTone(ctx, out, t, 300, 1200, 0.32, 0.08 * v, 'sawtooth');
    _crTone(ctx, out, t + 0.02, 450, 1800, 0.3, 0.05 * v, 'triangle');
    _crHit(ctx, out, t + 0.3, _crNoise(ctx, 0.03, p => 1 - p), 0.1 * v, 'bandpass', 3000, 2);
  });
}
// A marked card discarded: the challenge is refused - a short falling swish.
function sfxChallengeDodge() {
  _crVoice((ctx, v, t, out) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = _crNoise(ctx, 0.22, p => Math.sin(p * Math.PI)); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.2); g.gain.value = 0.08 * v;
    s.connect(f).connect(g).connect(out); s.start(t);
    _crTone(ctx, out, t, 520, 300, 0.18, 0.05 * v, 'triangle');
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
function devSpotChallengeNow(tier) {
  if (typeof closeDevPanel === 'function') closeDevPanel();
  if (!crSpotMayRun()) { showMessage('Ordinary rounds of a node mode only', 'var(--red)'); return; }
  crBeginArrival('spot', tier || 2, 0);
}
function devFlowChallengeNow(tier) {
  if (typeof closeDevPanel === 'function') closeDevPanel();
  if (typeof flowActive !== 'function' || !flowActive()) { showMessage('Flow only', 'var(--red)'); return; }
  crBeginArrival('flow', tier || 2, 0);
}
