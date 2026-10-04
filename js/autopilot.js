// ═══════════════════════════════════════════════════════════════════════════
// AUTOPILOT (r474) - a Sleight that takes the board for a while
// ═══════════════════════════════════════════════════════════════════════════
// Owner: "30 seconds after landing on the grid it auto plays all available hands
// and continues doing so until no valid hand exists (this means it waits for
// cards to fall, then tries again). ... starting with the second hand that it
// auto plays it applies focus a second time, the third hand 3 times, etc." and
// "at a default it lowers your focus by 5 when it comes onto the grid."
//
// - Lands: -5 Focus (BAL.autopilot.focus_cost).
// - After BAL.autopilot.delay_seconds on the board (a countdown ring on the
//   card, sleightLifeLeft), it ENGAGES: the best hand on the board is selected
//   and played, the board settles, and it goes again.
// - Hand k of the run applies the Focus multiplier k times (focusExtraApplies
//   reads autopilotFocusExtra(), which is k-1 only while an autopilot hand is
//   being played).
// - It stops when the board offers no hand, the round ends, or after
//   BAL.autopilot.max_hands (a safety cap; 0 = no cap). Then it discards itself
//   and cycles back into the deck, like Whetstone.
//
// The run ticks off its own 250ms poller rather than the round tick, because it
// has to wait out each hand's dance and fall, which the round tick knows nothing
// about. The 30s countdown rides the round tick (autopilotTick) so it stops with
// the round, the pause menu and RECORDS.
// ═══════════════════════════════════════════════════════════════════════════

let autopilotRun = null;      // { card, k } while a run is in progress
let _autopilotHandK = 0;      // the run's hand number while that hand is being played

function autopilotFocusExtra() { return _autopilotHandK > 1 ? _autopilotHandK - 1 : 0; }
function autopilotRunning() { return !!autopilotRun; }

function _apCfg() { return BAL.autopilot || { delay_seconds: 30, focus_cost: 5, max_hands: 0 }; }

function _apFind(card) {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++)
    if (gridData[r]?.[c] === card) return [r, c];
  return null;
}

// Countdown ring on the card (js/cooldown.js asks sleightLifeLeft).
function autopilotLifeLeft(card) {
  if (card?.sleightId !== 'autopilot' || card._apEngaged) return null;
  const total = _apCfg().delay_seconds;
  return { left: Math.max(0, total - (card._apSecs || 0)), total };
}

// Round tick: the landing cost, the countdown, the engage.
function autopilotTick() {
  if (roundEnded || bossApproachBusy()) return;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r]?.[c];
    if (!card?._isSleight || card.sleightId !== 'autopilot') continue;
    if (!card._apLanded) {
      card._apLanded = true;
      const cost = _apCfg().focus_cost || 0;
      if (cost > 0 && typeof removeFocus === 'function' && focusNodes > 0) removeFocus(cost);
      showMessage(`Autopilot on the board: -${cost} Focus. Engages in ${_apCfg().delay_seconds}s`, 'var(--cream-dim)');
    }
    if (card._apEngaged) continue;
    card._apSecs = (card._apSecs || 0) + 1;
    if (card._apSecs >= _apCfg().delay_seconds && !autopilotRun) autopilotEngage(card);
  }
}
function bossApproachBusy() {
  return (typeof flowBossFighting !== 'undefined' && flowBossFighting && !bossActive);
}

function autopilotEngage(card) {
  card._apEngaged = true;
  autopilotRun = { card, k: 0 };
  selected = [];
  showMessage('AUTOPILOT ENGAGED', 'var(--c-cyan, #16c8d8)');
  document.body.classList.add('autopilot-on');
  _apPoll();
}

function _apIdle() {
  return !animating && !falling && !danceAbortController && !isPaused && !gameTimerPaused
    && !(typeof sleightSpinLock !== 'undefined' && sleightSpinLock);
}

function _apPoll() {
  if (!autopilotRun) return;
  if (roundEnded || !_apFind(autopilotRun.card)) { autopilotStop(); return; }
  if (!_apIdle()) { setTimeout(_apPoll, 250); return; }
  const cap = _apCfg().max_hands || 0;
  if (cap && autopilotRun.k >= cap) { autopilotStop(); return; }
  const cells = autopilotBestHand();
  if (!cells) {
    // A search that ran out of budget has not proven the board empty: try again.
    if (autopilotBestHand.exhausted && (autopilotRun.retry = (autopilotRun.retry || 0) + 1) <= 3) { setTimeout(_apPoll, 100); return; }
    autopilotStop(); return;
  }
  autopilotRun.retry = 0;
  autopilotRun.k++;
  _autopilotHandK = autopilotRun.k;
  selected = cells;
  try { render(); playHand(); } finally { _autopilotHandK = 0; }
  if (autopilotRun) setTimeout(_apPoll, 350);
}

function autopilotStop() {
  const run = autopilotRun;
  autopilotRun = null; _autopilotHandK = 0;
  document.body.classList.remove('autopilot-on');
  if (!run) return;
  showMessage(`Autopilot off after ${run.k} hand${run.k === 1 ? '' : 's'}`, 'var(--cream-dim)');
  // It leaves the board and cycles back with its charges, like Whetstone. If the
  // round has ended the board is mid-interlude, so it simply waits there spent
  // and leaves on the first idle tick of the next round.
  run.card._apSpent = true;
  _apLeave(run.card);
}
function _apLeave(card) {
  if (roundEnded || !_apIdle()) { setTimeout(() => _apLeave(card), 400); return; }
  const at = _apFind(card);
  if (!at) return;
  const [r, c] = at;
  spinSleightTile(r, c, () => {
    if (gridData[r]?.[c] !== card) return;
    discardToPlayed(card);
    removeAndFall([[r, c]], 'discard');
  });
}

// The best hand anywhere on the board: every connected shape up to the
// Selection Size (capped at 5 for cost), kept only when every card is load-
// bearing, ranked by the summed worth of its components, then by card count.
function autopilotBestHand() {
  // Capped at 5 cards, and at 4 on a big board, where five-card shapes run to
  // the tens of thousands and the search would hitch a frame per hand.
  const cap = Math.min(gridRows * gridCols > 30 ? 4 : 5, (limits.selection && limits.selection.current) || 3);
  const usable = (r, c) => r >= 0 && c >= 0 && r < gridRows && c < gridCols
    && !!gridData[r]?.[c] && cardCan(gridData[r][c], 'select') && !isCellBlocked(r, c)
    && !gridData[r][c]._isSleight;
  const key = cells => cells.map(([r, c]) => r * 100 + c).sort((a, b) => a - b).join(',');
  const seen = new Set();
  const allow = (typeof tagalongMax === 'function') ? tagalongMax() : 1;
  let best = null, bestW = -1, budget = 2500;
  const grow = cells => {
    if (budget-- <= 0) return;
    if (cells.length >= 2) {
      const k = key(cells);
      if (seen.has(k)) return;
      seen.add(k);
      const res = handComponentsFor(cells);
      if (res && res.playable) {
        const claimed = new Set();
        res.components.forEach(cp => cp.cells.forEach(([r, c]) => claimed.add(r + '-' + c)));
        // A kicker (an unclaimed card) is allowed up to the hand's allowance -
        // it is how two pairs a card apart become one hand - but it costs pips
        // and time, so a hand carrying one ranks below the same hand without.
        const spare = cells.length - claimed.size;
        if (spare <= allow) {
          const w = res.components.reduce((s, cp) => s + handWorth(cp.name), 0)
            * (spare ? 0.8 : 1) + cells.length * 0.01;
          if (w > bestW) { bestW = w; best = [...cells]; }
        }
      }
    }
    if (cells.length >= cap) return;
    for (const [cr, cc] of cells)
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nr = cr + dr, nc = cc + dc;
        if (!usable(nr, nc) || cells.some(([a, b]) => a === nr && b === nc)) continue;
        grow([...cells, [nr, nc]]);
      }
  };
  // Starts are visited in a shuffled order so a search that runs out of budget
  // on a big board has not simply ignored its bottom rows (fxRandom: cosmetic
  // stream, never the seeded one).
  const starts = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (usable(r, c)) starts.push([r, c]);
  for (let i = starts.length - 1; i > 0; i--) { const j = Math.floor(fxRandom() * (i + 1)); [starts[i], starts[j]] = [starts[j], starts[i]]; }
  starts.forEach(st => grow([st]));
  autopilotBestHand.exhausted = budget <= 0;
  return best;
}

// A new run (startGame) clears any run in flight.
function autopilotReset() { autopilotRun = null; _autopilotHandK = 0; document.body.classList.remove('autopilot-on'); }
