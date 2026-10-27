// ══════════════════════════════════════════════════════════════════════════
// FOCUS KNACKS (r571, owner) - what a double-tap on the Focus bar does
// ══════════════════════════════════════════════════════════════════════════
// The Focus bar's double-tap is ONE gesture. Without a Focus knack it opens the
// Reserve (js/reserve.js). A Focus knack REPLACES that while it is owned, and
// while one is owned no other knack of the family is offered (survivalEntityBanned
// asks focusKnackOfferBanned); sell it and the family comes back. The newest
// owned one wins if a save ever holds two.
//
//   free_hand     10 Focus: swaps and discards cost no time and no stock for 10s
//   charged_card  10 Focus: the first card of your next hand takes a deck-editor buff
//   shuffle_up    10 Focus: every card on the board changes place
//   double_down   10 Focus: Focus applies twice for the next 3 hands
//   overdrive     the autoplay: 5 Focus a hand until Focus runs out, hand k scores
//                 x(1 + 0.5k) mult, loud selection, fast scoring until the last
//                 hand, a rising hit per hand, then a 45s cooldown
//
// The state below is run state (SAVE_VARS); the chip on the Focus bar
// (#focus-chip) says what is live. Numbers come from BAL (balance.js).
const FOCUS_KNACK_DEFAULTS = {
  free_hand:    { focus: 10, seconds: 10 },
  charged_card: { focus: 10 },
  shuffle_up:   { focus: 10 },
  double_down:  { focus: 10, hands: 3 },
  overdrive:    { focus_per_hand: 5, mult_step: 0.5, cooldown: 45 },
};
function fkCfg(id, k) { const b = (typeof BAL !== 'undefined' && BAL[id]) || {}; return b[k] != null ? b[k] : FOCUS_KNACK_DEFAULTS[id][k]; }

let freeHandSecs = 0;          // Free Hand: live seconds left
let chargedCardPending = false; // Charged Card: the next hand's first card takes a buff
let focusDoubleHands = 0;      // Double Down: hands left that apply Focus twice
let overdriveCd = 0;           // Overdrive: cooldown seconds left
let _overdriveRun = null;      // { k } while Overdrive plays
let _overdriveMultX = 1;       // the x mult of the hand Overdrive is playing now
let _ovFast = false;           // the dance skips its beats for this hand

function focusKnackOfferBanned(id) {
  if (!FOCUS_TAP_KNACKS[id]) return false;
  return Array.isArray(acquiredKnacks) && acquiredKnacks.some(k => k && FOCUS_TAP_KNACKS[k.id]);
}
function freeHandActive() { return freeHandSecs > 0; }
// Autoplay generates no Focus of its own: no complexity, no speed bonus
// (generateHandFocus). Tricks and Knacks that pay Focus still do.
function autoplayNoFocus() {
  return !!_overdriveRun || (typeof autopilotRunning === 'function' && autopilotRunning())
    || (typeof sweepRunning === 'function' && sweepRunning());   // r572: All Hands's hands
}
function overdriveFastHand() { return _ovFast; }
function overdriveMultX() { return _overdriveRun ? _overdriveMultX : 1; }

function focusKnacksReset() {
  freeHandSecs = 0; chargedCardPending = false; focusDoubleHands = 0; overdriveCd = 0;
  _overdriveRun = null; _overdriveMultX = 1; _ovFast = false;
  document.body.classList.remove('autoplay-loud', 'overdrive-on');
  focusChipSync();
}

// ── Spend ─────────────────────────────────────────────────────────────────
function fkSpend(id) {
  const cost = fkCfg(id, 'focus');
  if (typeof roundEnded !== 'undefined' && roundEnded) return false;
  if (focusNodes < cost) { refuse(`${knackName(id)} needs ${cost} Focus`); return false; }
  removeFocus(cost);
  return true;
}
function knackName(id) { const k = KNACK_POOL.find(x => x.id === id); return k ? k.name : id; }

function focusFreeHand() {
  if (!fkSpend('free_hand')) return;
  freeHandSecs += fkCfg('free_hand', 'seconds');
  showMessage(`Free Hand: swaps and discards are free for ${freeHandSecs}s`, '#8fd0ff');
  focusChipSync();
}
function focusChargedCard() {
  if (chargedCardPending) { refuse('Already charged: play a hand'); return; }
  if (!fkSpend('charged_card')) return;
  chargedCardPending = true;
  showMessage('Charged: the first card of your next hand takes a buff', '#8fd0ff');
  focusChipSync();
}
// playHand, before the hand is scored: the first scoring card of the selection.
function chargedCardApply(handCells) {
  if (!chargedCardPending || !handCells || !handCells.length) return;
  const cells = (typeof scoringOrderCells === 'function') ? scoringOrderCells(handCells) : handCells;
  const cell = cells.find(([r, c]) => { const x = gridData[r]?.[c]; return x && x.rank && !x._isSleight && !x._isStone && !(typeof isWildCard === 'function' && isWildCard(x)); });
  if (!cell) return;
  const card = gridData[cell[0]][cell[1]];
  const e = (typeof rollEditorBuff === 'function') ? rollEditorBuff() : { pips: 10 };
  if (!e) return;
  chargedCardPending = false;
  enhanceCardKey(cardId(card), e);
  noteMessage(`Charged Card: ${card.rank}${card.suit} ${typeof buffOfferName === 'function' ? buffOfferName(e) : ''}`);
  focusChipSync();
}
function focusShuffleUp() {
  if (animating || falling || (typeof dealPhase !== 'undefined' && dealPhase)) { refuse('Wait for the board'); return; }
  if (!fkSpend('shuffle_up')) return;
  const cells = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd.rank || cd._isSleight || cd._isStone || cd._isTrick) continue;
    if (typeof isCellBlocked === 'function' && isCellBlocked(r, c)) continue;
    cells.push([r, c]);
  }
  const cards = cells.map(([r, c]) => gridData[r][c]);
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  cells.forEach(([r, c], i) => { gridData[r][c] = cards[i]; });
  selected = []; swapPending = null;
  if (typeof clearHandCompCache === 'function') clearHandCompCache();
  showMessage('Shuffle Up', '#8fd0ff');
  try { sfxFlipShuffle(); } catch (e) {}
  // The whole board deals in again (the round-start deal), which is the shuffle.
  animating = true;
  startNewRoundDealAnims();
  focusChipSync();
}
function focusDoubleDown() {
  if (!fkSpend('double_down')) return;
  focusDoubleHands += fkCfg('double_down', 'hands');
  showMessage(`Double Down: Focus applies twice for the next ${focusDoubleHands} hands`, '#c07aee');
  focusChipSync();
}
// playHand, after a hand commits.
function focusKnacksAfterHand() {
  if (focusDoubleHands > 0) { focusDoubleHands--; focusChipSync(); }
  _overdriveMultX = 1;
}

// ── Overdrive ─────────────────────────────────────────────────────────────
function overdriveStart() {
  if (_overdriveRun) return;
  if (typeof roundEnded !== 'undefined' && roundEnded) return;
  if (overdriveCd > 0) { refuse(`Overdrive cooling down: ${overdriveCd}s`); return; }
  const per = fkCfg('overdrive', 'focus_per_hand');
  if (focusNodes < per) { refuse(`Overdrive needs ${per} Focus`); return; }
  if (typeof dealerActive === 'function' && dealerActive()) { refuse('Place or discard the cards you hold first'); return; }
  _overdriveRun = { k: 0, retry: 0 };
  selected = []; swapPending = null;
  if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  document.body.classList.add('autoplay-loud', 'overdrive-on');
  showMessage('OVERDRIVE', '#ff6a52');
  focusChipSync();
  _ovStep();
}
function _ovIdle() {
  return !animating && !falling && !(typeof danceAbortController !== 'undefined' && danceAbortController)
    && !isPaused && !gameTimerPaused && !(typeof sleightSpinLock !== 'undefined' && sleightSpinLock)
    && !(typeof dealPhase !== 'undefined' && dealPhase);
}
function _ovStep() {
  if (!_overdriveRun) return;
  if (roundEnded) { overdriveStop(); return; }
  if (!_ovIdle()) { setTimeout(_ovStep, 150); return; }
  const per = fkCfg('overdrive', 'focus_per_hand');
  if (focusNodes < per) { overdriveStop(); return; }
  const cells = autopilotBestHand();
  if (!cells) {
    if (autopilotBestHand.exhausted && (_overdriveRun.retry = (_overdriveRun.retry || 0) + 1) <= 3) { setTimeout(_ovStep, 100); return; }
    overdriveStop(); return;
  }
  _overdriveRun.retry = 0;
  removeFocus(per);
  const k = ++_overdriveRun.k;
  _overdriveMultX = 1 + fkCfg('overdrive', 'mult_step') * k;
  // The last hand we can pay for scores in full; the ones before it score fast.
  _ovFast = focusNodes >= per;
  selected = cells;
  render();
  sfxCardSelectLoud();
  focusChipSync();
  // A beat to see the selection, then the hit and the play.
  setTimeout(() => {
    if (!_overdriveRun) return;
    try { sfxOverdriveHit(k); } catch (e) {}
    const before = handsPlayed;
    try { playHand(); } catch (e) { if (typeof devMode !== 'undefined' && devMode) console.warn('[OVERDRIVE]', e); }
    if (handsPlayed === before) { _overdriveMultX = 1; overdriveStop(); return; }   // the hand did not go
    if (!_ovFast) { overdriveStop(); return; }
    setTimeout(_ovStep, 200);
  }, 320);
}
function overdriveStop() {
  const run = _overdriveRun;
  _overdriveRun = null; _ovFast = false;
  document.body.classList.remove('autoplay-loud', 'overdrive-on');
  if (!run) return;
  overdriveCd = fkCfg('overdrive', 'cooldown');
  showMessage(`Overdrive off after ${run.k} hand${run.k === 1 ? '' : 's'} · ${overdriveCd}s cooldown`, 'var(--cream-dim)');
  focusChipSync();
}

// ── The chip on the Focus bar ─────────────────────────────────────────────
function focusChipSync() {
  const wrap = document.getElementById('focus-meter-wrap');
  if (!wrap) return;
  let el = document.getElementById('focus-chip');
  const parts = [];
  if (_overdriveRun) parts.push(`OVERDRIVE x${_overdriveMultX.toFixed(1)}`);
  else if (overdriveCd > 0) parts.push(`COOLDOWN ${overdriveCd}`);
  if (freeHandSecs > 0) parts.push(`FREE ${freeHandSecs}s`);
  if (chargedCardPending) parts.push('CHARGED');
  if (focusDoubleHands > 0) parts.push(`x2 ·${focusDoubleHands}`);
  if (typeof crFocusMute !== 'undefined' && crFocusMute > 0) parts.push(`NO FOCUS ·${crFocusMute}`);   // r671: a failed challenge
  if (!parts.length) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'focus-chip'; wrap.appendChild(el); }
  el.textContent = parts.join(' · ');
  el.classList.toggle('fc-hot', !!_overdriveRun);
}
// Round tick (js/round-timers.js).
function focusKnacksTick() {
  let changed = false;
  if (freeHandSecs > 0) { freeHandSecs--; changed = true; if (!freeHandSecs) noteMessage('Free Hand over'); }
  if (overdriveCd > 0 && !_overdriveRun) { overdriveCd--; changed = true; }
  if (changed) focusChipSync();
}

// A selection you cannot miss: the select sound twice at once (+6 dB).
function sfxCardSelectLoud() { try { sfxCardSelect(); sfxCardSelect(); } catch (e) {} }

const FOCUS_TAP_KNACKS = {
  free_hand: focusFreeHand,
  charged_card: focusChargedCard,
  shuffle_up: focusShuffleUp,
  double_down: focusDoubleDown,
  overdrive: overdriveStart,
};
