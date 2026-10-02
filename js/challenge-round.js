// ══════════════════════════════════════════════════════════════════════════════
// CHALLENGE ROUNDS (r444) - three challenge cards on top of the full goal
// ══════════════════════════════════════════════════════════════════════════════
// Owner's spec: a round with the ordinary goal AND three challenge cards, one at
// a time. Each card arrives by throwing a random board card back into the deck
// and rising into its cell. It names one thing to do; doing it solves the card
// and the next one arrives. The round cannot end on the goal while a card is
// still unsolved (roundQuotaMet asks crHoldsGoal), so the goal and the cards are
// both required.
//
//   all three solved, goal met     -> the round's reward is the PRIZE grid
//   clock runs out, goal met       -> the round counts as cleared, but you take
//                                     a PENALTY grid first (pick exactly your
//                                     Selection Size of penalties)
//   clock runs out, goal not met   -> an ordinary failed round
//
// Each solved card also pays credits on the spot (CR_CARD_CREDITS).
//
// Where they appear: the Schedule's challenge tiles are either a PRIORITY
// account or an AUDIT (this, plus CR_MAP_BONUS_SECONDS on the clock), and a mode
// with the `challengeNode` flag (Classic) plays one as that node of every quarter.
//
// THE CARD is a board object, not a hole: { _isStone, _isChallenge, crIdx }.
// _isStone buys every "not a real card" exclusion the engine already has (hand
// detection, Tricks, sweeps, the deck count); cardCan refuses it everything but
// fall and render, so it cannot be selected, swapped or discarded, and it never
// enters a pile. It falls with the board like any card.
//
// `crRound` is plain data (SAVE_VARS): requirements are { kind, ... } records
// read by crReqMet, never closures, so a saved run resumes mid-challenge.

const CR_CARDS = 3;
const CR_CARD_CREDITS = [5, 8, 12];      // paid per card solved, by card
const CR_MAP_BONUS_SECONDS = 60;         // the Schedule's audit adds a minute
const CR_SPAWN_DELAY_MS = 650;           // after the round goes live

var crRound = null;   // `var`: read by name from files above this one (TDZ)

function crLive() { return !!(crRound && crRound.started && !crRound.over); }
// The goal is held open while a card is still unsolved.
function crHoldsGoal() { return crLive() && crRound.solved < CR_CARDS; }

// ── Arming ──────────────────────────────────────────────────────────────────
// Armed BEFORE the round it belongs to is set up; crOnLevelUp turns it into a
// live round once triggerLevelUp has the final goal.
let crArmed = null;   // { source, bonusSecs } | null - in SAVE_VARS
function crArmNext(opts) { crArmed = { source: 'node', bonusSecs: 0, ...(opts || {}) }; }

// From finishInterlude's node advance: a mode with `challengeNode` plays one at
// that node of every quarter.
function crMaybeArmForNode(node) {
  const n = ACTIVE_MODE && ACTIVE_MODE.challengeNode;
  if (n && node === n) crArmNext({ source: 'node' });
}

// triggerLevelUp, after the goal is final.
function crOnLevelUp() {
  crRound = null;
  if (!crArmed) return;
  if (typeof bossActive !== 'undefined' && bossActive) { crArmed = null; return; }
  crRound = { source: crArmed.source, bonusSecs: crArmed.bonusSecs || 0, solved: 0, idx: 0,
              req: null, started: false, over: false, result: null, announced: false };
  crArmed = null;
}
// triggerLevelUp, after roundSeconds is set: the audit's extra minute. Added to
// the round's STARTING time, past the round cap on purpose.
// The same minute, for the countdown's cap (showNextGoalFlash), which would
// otherwise trim it back to the round-time limit.
function crStartBonus() { return (crRound && !crRound.started) ? (crRound.bonusSecs || 0) : 0; }
function crApplyStartTime() {
  if (crRound && !crRound.started && crRound.bonusSecs > 0) roundSeconds += crRound.bonusSecs;
}

// startRoundTimer: the round is live, so the first card can arrive. Resumes and
// pauses come through here too, which is what `started` guards.
function crOnRoundStart() {
  if (!crRound || crRound.started || crRound.over) return;
  crRound.started = true;
  showMessage(`⚑ Challenge round: ${CR_CARDS} challenge cards, one at a time, and the goal.`, 'var(--c-amber, #ffb347)', { ms: 4200 });
  setTimeout(crSpawnWhenFree, CR_SPAWN_DELAY_MS);
}

// ── Requirements ────────────────────────────────────────────────────────────
// Tier = which card (1, 2, 3). Each roll states exact numbers so the card can
// print them.
function _crPick(a) { return a[Math.floor(Math.random() * a.length)]; }
function _crHandsByValue() {
  const hs = (typeof achievableHandTypes === 'function' ? achievableHandTypes() : ['Pair'])
    .filter(h => typeof HAND_BASE === 'undefined' || HAND_BASE[h]);
  const v = h => handBasePips(h) * handBaseMult(h);
  return hs.sort((a, b) => v(a) - v(b));
}
function _crHandForTier(t) {
  const hs = _crHandsByValue();
  if (hs.length <= 1) return hs[0] || 'Pair';
  const third = Math.max(1, Math.ceil(hs.length / 3));
  const lo = Math.min(hs.length - 1, (t - 1) * third);
  return _crPick(hs.slice(lo, Math.min(hs.length, lo + third)) );
}
function crRollReq(t) {
  const sel = limits.selection.current;
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : ['♠', '♥', '♦', '♣'];
  const opts = {
    1: [ () => ({ kind: 'touch', n: 1 }),
         () => ({ kind: 'hand', hand: _crHandForTier(1) }),
         () => ({ kind: 'suit', n: Math.min(2, sel), suit: _crPick(suits) }),
         () => ({ kind: 'size', n: Math.min(4, sel) }) ],
    2: [ () => ({ kind: 'touch', n: 2 }),
         () => ({ kind: 'hand', hand: _crHandForTier(2) }),
         () => ({ kind: 'suit', n: Math.min(3, sel), suit: _crPick(suits) }),
         () => ({ kind: 'big', at: _crRound10(roundGoal * 0.20) }),
         () => ({ kind: 'types', n: 2 }) ],
    3: [ () => ({ kind: 'touchhand', hand: _crHandForTier(2) }),
         () => ({ kind: 'hand', hand: _crHandForTier(3) }),
         () => ({ kind: 'big', at: _crRound10(roundGoal * 0.35) }),
         () => ({ kind: 'size', n: Math.min(5, sel) }),
         () => ({ kind: 'types', n: 3 }) ],
  }[Math.max(1, Math.min(3, t))];
  return { ..._crPick(opts)(), prog: 0, seen: [] };
}
function _crRound10(n) { return Math.max(10, Math.round(n / 10) * 10); }

// What the card prints (short) and what the info line says (full).
function crReqShort(q) {
  if (!q) return '';
  switch (q.kind) {
    case 'touch':     return q.n > 1 ? `${q.n} HANDS TOUCHING` : 'A HAND TOUCHING';
    case 'hand':      return q.hand.toUpperCase();
    case 'touchhand': return `${q.hand.toUpperCase()} TOUCHING`;
    case 'suit':      return `${q.n}× ${q.suit}`;
    case 'size':      return `${q.n}+ CARDS`;
    case 'big':       return `${q.at.toLocaleString()} IN 1 HAND`;
    case 'types':     return `${q.n} HAND TYPES`;
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
  }
  return '';
}
// Counted requirements show how far along they are.
function crReqProgress(q) {
  if (!q) return '';
  if (q.kind === 'touch' && q.n > 1) return `${q.prog}/${q.n}`;
  if (q.kind === 'types') return `${q.seen.length}/${q.n}`;
  return '';
}

// ── The card on the board ───────────────────────────────────────────────────
function crFindCard() {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++)
    if (gridData[r]?.[c]?._isChallenge) return [r, c];
  return null;
}
function crTouches(cells) {
  const at = crFindCard();
  if (!at) return false;
  return (cells || []).some(([r, c]) => Math.abs(r - at[0]) + Math.abs(c - at[1]) === 1);
}
function crCardFaceHTML(card) {
  const q = crRound && crRound.req;
  const prog = crReqProgress(q);
  return `<div class="cr-head">CHALLENGE ${(card.crIdx || 0) + 1}/${CR_CARDS}</div>`
       + `<div class="cr-glyph">⚑</div>`
       + `<div class="cr-req">${crReqShort(q)}</div>`
       + (prog ? `<div class="cr-prog">${prog}</div>` : '');
}
function crShowInfo() {
  if (!crRound || !crRound.req) return;
  const p = crReqProgress(crRound.req);
  showMessage(`⚑ ${crReqText(crRound.req)}${p ? ` (${p})` : ''}`, 'var(--c-amber, #ffb347)', { ms: 3200 });
}

// A random ordinary card goes back into the deck and the challenge card rises
// into its cell. Held until the board is still.
function crSpawnWhenFree() {
  if (!crLive() || crRound.solved >= CR_CARDS || crFindCard()) return;
  if (animating || falling || dealPhase || roundEnded || gameTimerPaused) { setTimeout(crSpawnWhenFree, 250); return; }
  const sel = new Set((selected || []).map(([r, c]) => `${r}-${c}`));
  const spots = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd.rank || cd._isStone || cd._isSleight || cd._isTrick) continue;
    if (isCellBlocked(r, c) || sel.has(`${r}-${c}`)) continue;
    if (crRound.lastAt && crRound.lastAt[0] === r && crRound.lastAt[1] === c) continue;
    spots.push([r, c]);
  }
  if (!spots.length) { setTimeout(crSpawnWhenFree, 400); return; }
  const [r, c] = _crPick(spots);
  discardToDrawPile(gridData[r][c]);
  crRound.idx = crRound.solved;
  crRound.req = crRollReq(crRound.idx + 1);
  gridData[r][c] = { rank: '?', suit: 'stone', _isStone: true, _isChallenge: true,
                     crIdx: crRound.idx, _id: `cr-${Date.now()}-${crRound.idx}` };
  render();
  crAnimate(r, c, 'in');
  if (typeof sfxChallengeAppear === 'function') { try { sfxChallengeAppear(); } catch (e) {} }
  crShowInfo();
}

function crCardEl(r, c) {
  const cd = gridData[r]?.[c];
  return cd ? document.querySelector(`#grid [data-card-id="${cd._id}"]`) : null;
}
// 'in' rises out from under the cell; 'out' flips away. WAAPI, cancelled on
// finish so it never owns the transform afterwards.
function crAnimate(r, c, dir) {
  const el = crCardEl(r, c);
  if (!el || typeof el.animate !== 'function') return;
  const frames = dir === 'in'
    ? [ { transform: 'translateY(70%) scale(0.55)', opacity: 0, clipPath: 'inset(0 0 100% 0)' },
        { transform: 'translateY(-6%) scale(1.04)', opacity: 1, clipPath: 'inset(0 0 0 0)', offset: 0.7 },
        { transform: 'translateY(0) scale(1)', opacity: 1, clipPath: 'inset(0 0 0 0)' } ]
    : [ { transform: 'scale(1) rotateY(0deg)', opacity: 1 },
        { transform: 'scale(1.15) rotateY(90deg)', opacity: 0 } ];
  const a = el.animate(frames, { duration: dir === 'in' ? 520 : 300, easing: 'ease-out' });
  a.onfinish = () => a.cancel();
}

// ── Scoring a hand ──────────────────────────────────────────────────────────
// playHand, after the score is committed and BEFORE the goal check, so a hand
// that solves the last card and crosses the goal ends the round itself.
function crOnHand(hand, handCells, finalScore) {
  if (!crLive() || crRound.solved >= CR_CARDS || !crRound.req || !crFindCard()) return;
  const q = crRound.req;
  const cards = (handCells || []).map(([r, c]) => gridData[r]?.[c]).filter(Boolean);
  let met = false;
  switch (q.kind) {
    case 'touch':     if (crTouches(handCells)) { q.prog++; met = q.prog >= q.n; } break;
    case 'hand':      met = hand === q.hand; break;
    case 'touchhand': met = hand === q.hand && crTouches(handCells); break;
    case 'suit':      met = cards.filter(cd => cd.suit === q.suit && !isWildCard(cd)).length >= q.n; break;
    case 'size':      met = handCells.length >= q.n; break;
    case 'big':       met = finalScore >= q.at; break;
    case 'types':     if (!q.seen.includes(hand)) q.seen.push(hand); met = q.seen.length >= q.n; break;
  }
  if (!met) { crRepaint(); return; }
  crSolve();
}

function crSolve() {
  const at = crFindCard();
  const pay = CR_CARD_CREDITS[Math.min(CR_CARD_CREDITS.length - 1, crRound.solved)] || 0;
  crRound.solved++;
  crRound.req = null;
  if (pay > 0) { coins += pay; updateCoinsUI(); }
  const left = CR_CARDS - crRound.solved;
  showMessage(left > 0 ? `⚑ Challenge ${crRound.solved}/${CR_CARDS} solved · +${pay} credits`
                       : `⚑ All ${CR_CARDS} challenges solved · +${pay} credits · prize grid earned`, 'var(--gold)');
  if (typeof sfxChallengeWin === 'function') { try { sfxChallengeWin(); } catch (e) {} }
  if (at) crRound.lastAt = at;
  // Every non-goal hand ends in a fall, and the step drains from that fall's
  // tail. The goal hand never falls: its board is taken down, and crSettle
  // lifts the card off at the interlude.
  crPendingStep = true;
}

// The solved card leaves (a fresh card takes its cell) and the next one arrives.
// Drained from removeAndFall's tail - never on top of a live fall.
let crPendingStep = false;
function crDrain() {
  if (!crPendingStep || animating || falling) return;
  crPendingStep = false;
  if (!crRound) return;
  const at = crFindCard();
  if (at) {
    crAnimate(at[0], at[1], 'out');
    setTimeout(() => {
      const still = crFindCard();
      if (still) { gridData[still[0]][still[1]] = drawCard() || null; render(); }
      if (crLive() && crRound.solved < CR_CARDS) setTimeout(crSpawnWhenFree, 250);
    }, 300);
  } else if (crLive() && crRound.solved < CR_CARDS) setTimeout(crSpawnWhenFree, 250);
}

function crRepaint() {
  const at = crFindCard();
  if (!at) return;
  const el = crCardEl(at[0], at[1]);
  if (el) el.innerHTML = crCardFaceHTML(gridData[at[0]][at[1]]);
}

// ── The clock runs out ──────────────────────────────────────────────────────
// onRoundEnd, before anything else. With the goal met and a card unsolved the
// round is CLEARED and failed: it ends the way a goal hand ends it, and the
// interlude runs the penalty grid (crSettle). Without the goal it is an
// ordinary lost round, so this returns false and the normal path runs.
function crOnClockOut() {
  if (!crHoldsGoal()) return false;
  crRound.over = true;   // releases the hold, so roundQuotaMet is the plain test again
  // Goal not met: an ordinary lost round. The hold goes back on, so a second
  // chance (Safety Net, Second Chance) keeps the challenge running.
  if (!roundQuotaMet()) { crRound.over = false; return false; }
  crRound.result = 'lost';
  goalReachedThisRound = true;
  roundEnded = true;
  clearInterval(roundInterval); roundInterval = null;
  gameTimerPaused = true;
  frozenRoundSeconds = roundSeconds;
  showMessage(`⚑ Out of time · ${crRound.solved}/${CR_CARDS} challenges solved`, 'var(--red)');
  if (typeof sfxChallengeFail === 'function') { try { sfxChallengeFail(); } catch (e) {} }
  // The interlude expects the victory duck the dance sets up.
  try {
    const ctx = getAudioCtx();
    sfxDuckGain = sfxDuckGain || ctx.createGain();
    sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime);
    if (!sfxDuckGain.connected) { sfxDuckGain.connect(ctx.destination); sfxDuckGain.connected = true; }
  } catch (e) {}
  if (typeof flashRoundEnd === 'function') flashRoundEnd();
  setTimeout(() => startInterlude(), 600);
  return true;
}

// ── After the payout ────────────────────────────────────────────────────────
// startInterlude, after the payout pick. Takes the card off the board, and on a
// failed round opens the penalty grid and waits for it. The result is kept for
// crTakePrize, which the reward step reads.
function crSettle() {
  if (!crRound) return Promise.resolve();
  const at = crFindCard();
  if (at) gridData[at[0]][at[1]] = drawCard() || null;
  crPendingStep = false;
  if (!crRound.result) crRound.result = crRound.solved >= CR_CARDS ? 'won' : 'lost';
  crRound.over = true;
  if (crRound.result !== 'lost') return Promise.resolve();
  return new Promise(res => openPenaltyGrid(res));
}
// One read: true once, for a round that solved every card.
function crTakePrize() {
  const won = !!(crRound && crRound.result === 'won');
  if (crRound && crRound.result) crRound = null;
  return won;
}
function crReset() { crRound = null; crArmed = null; crPendingStep = false; }

// Dev panel: the next round is a challenge round.
function devArmChallengeRound() {
  crArmNext({ source: 'dev' });
  showMessage('Next round is a challenge round', 'var(--gold)');
}
