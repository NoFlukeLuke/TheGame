// ══════════════════════════════════════════════
// CRUNCH (r293) - the Schedule, on one clock for the whole quarter
// ══════════════════════════════════════════════
// The Schedule's board, walked against a single act-long clock. You are given
// CRUNCH_ACT_SECONDS at the top of the quarter and that is ALL the time you get:
// every second of every round spends it, every obligation you book that is not a
// round debits a flat fee from it, and the manager review at the end is fought on
// WHATEVER IS LEFT. There is no second timer anywhere. Run it to zero and the run
// is over.
//
// So the whole mode is one question asked over and over: is this obligation worth
// the minutes it will cost me at the review?
//
// ── THE CLOCK IS `roundSeconds`, AND THAT IS THE LOAD-BEARING DECISION ───────
// Flow already proved this out (js/flow-mode.js). About fifteen sites across the
// engine measure "how far into the round are we" as `roundStartSeconds -
// roundSeconds` (The Swift, Sediment, the Cuckoo, the Woodpecker, the exalt
// window, every clock-mark Trick). Keeping a PARALLEL act counter and pinning
// roundSeconds would kill all of them silently. So the act bank simply IS
// roundSeconds; it ticks exactly as it always did, and only three things differ:
//   1. a level-up does NOT refill it (crunchNextRoundSeconds carries it),
//   2. non-round obligations debit it directly (crunchChargeTile),
//   3. the review's window is whatever is left (crunchBossWindow).
// Reaching zero is unchanged: onRoundEnd -> _onRoundEndCore -> score < goal ->
// the ordinary loss. That is already what "you lose" means here, so there is no
// crunch branch in onRoundEnd at all.
//
// ── WHAT THIS REUSES ────────────────────────────────────────────────────────
// EVERYTHING of the Schedule. MODES.crunch carries `map: true`, so mapActive() is
// true and the board, its generation, the dead-end DP, the route drawing, the
// tile routing and the quarter rollover are the Schedule's, untouched. This file
// is the clock and the money, and nothing else.

function crunchActive() { return !!ACTIVE_MODE && ACTIVE_MODE.crunch === true; }

// ── Tunables ────────────────────────────────────────────────────────────────
// The act allowance. Measured against a real Schedule walk: 9.4 obligations a
// quarter, 5 to 6 of them levels, at roughly 100s of play a level plus the fees
// below comes to about 12.5 minutes. 13:00 is therefore a FULL walk with almost
// no slack, which is the intent - what you skip is the mode.
const CRUNCH_ACT_SECONDS = 780;          // 13:00

// A new quarter grants this share of the allowance ON TOP of what you saved, and
// the total is capped at the allowance. So banking time is worth something and is
// worth exactly this much: you can never open a quarter above CRUNCH_ACT_SECONDS,
// and saving more than the shortfall is wasted.
const CRUNCH_CARRY_FRACTION = 0.75;      // 9:45 granted at a fresh quarter

// Par, and the whole credit economy of the mode. The payout's Efficiency line
// reads the round clock, which here is the act bank, so it would pay for time the
// player has not finished spending. It is replaced by PAR: beat 3:00 on a level
// and you are paid for every efficiencySecondsPerCoin() seconds you came in
// under. Flat for every level on purpose while the mode is being tuned.
const CRUNCH_PAR_SECONDS = 180;          // 3:00

// A round you cannot finish. See crunchCheckStuck.
const CRUNCH_STUCK_PENALTY = 60;

// What a booked obligation costs off the act clock. Rounds cost their own play
// time and nothing extra, so they are absent; anything absent from this table is
// free. These are debited at CONFIRM, not ticked, because the clock deliberately
// does not run on a screen you are reading (the shop, an event, the board
// itself) - a mode where studying a tooltip costs you the run is a worse mode.
const CRUNCH_TILE_COST = {
  shop:       45,
  reward:     45,
  event:      35,
  limitbreak: 35,
};

// ── The bank ────────────────────────────────────────────────────────────────
function crunchTileCost(kind) { return CRUNCH_TILE_COST[kind] || 0; }

// Can this obligation be booked at all? Refused rather than discovered, which is
// the rule the Schedule's dead-end DP already works to: a booking that empties
// the bank is not a dramatic loss, it is a tap you did not know was fatal. Held
// one second clear of zero so the refusal and the loss can never be the same
// event.
function crunchCanAfford(t) {
  if (!crunchActive() || !t) return true;
  const cost = crunchTileCost(t.kind);
  return cost <= 0 || roundSeconds > cost;
}

// The ONE place time leaves the bank outside the round tick, so every debit is
// announced the same way and the floor is applied once.
function crunchSpend(sec, label) {
  if (!crunchActive() || !sec || sec <= 0) return 0;
  const paid = Math.min(sec, Math.max(0, roundSeconds));
  roundSeconds = Math.max(0, roundSeconds - sec);
  if (typeof updateClockUI === 'function') updateClockUI();
  if (label && typeof showMessage === 'function')
    showMessage(`${label} · -${formatTime(paid)}`, 'var(--red)');
  return paid;
}

// Charge a confirmed tile. Called from mapConfirm for every kind; the table
// decides, so a level, a priority account and the review pay nothing.
function crunchChargeTile(t) {
  if (!crunchActive() || !t) return;
  const cost = crunchTileCost(t.kind);
  if (cost > 0) crunchSpend(cost, mapTileFace(t)?.name || 'Booked');
}

// A level-up does NOT refill the clock: the allowance spans the whole quarter.
// Called from triggerLevelUp in place of the computed round length, the same
// seam flowNextRoundSeconds uses.
function crunchNextRoundSeconds(currentSeconds) {
  return Math.max(1, currentSeconds);
}

// A fresh quarter. Called from the top of mapBeginQuarter, which is the one place
// a later quarter opens (Q1 is seeded by startGame through currentRoundDuration).
function crunchBeginQuarter() {
  if (!crunchActive()) return;
  const grant = Math.round(CRUNCH_ACT_SECONDS * CRUNCH_CARRY_FRACTION);
  const before = Math.max(0, roundSeconds);
  roundSeconds = Math.min(CRUNCH_ACT_SECONDS, before + grant);
  if (typeof updateClockUI === 'function') updateClockUI();
  if (typeof showMessage === 'function')
    showMessage(`New quarter · ${formatTime(roundSeconds)} on the clock`, 'var(--gold)');
}

// The review is fought on what is left. Passed to triggerBoss as its explicit
// window, so the boss's own clock and the act bank are the same number and there
// is never a second countdown to keep in step. Floored so a review reached on
// fumes is still a fight rather than an instant loss.
function crunchBossWindow() {
  if (!crunchActive()) return null;
  return Math.max(30, Math.round(roundSeconds));
}

// ── Clock ceilings written for a ROUND clock ────────────────────────────────
// A cap of ROUND_DURATION or limits.round_time.current means something only
// where the clock is a ROUND's. The act bank opens at 13:00 against a 3:00
// round-time limit, so every one of those caps would silently destroy ten
// minutes - which is exactly the bug r183 had to take out of rewindCeiling,
// where a Flush in Flow cut the session clock from 290 to 180 and reported
// nothing. Wrapped at the three sites that ADD time to the clock against a
// ceiling (the Altar's boon, the spade exalt payout, the dev slider); outside
// Crunch it returns the cap untouched, so every other mode is unchanged.
//
// The fourth site, the round-start countdown, is NOT a gain and is handled
// inline in js/interlude.js - there the round-cap penalty still has to bite.
function crunchNoRoundCap(cap) { return crunchActive() ? Infinity : cap; }

// ── Par, and the payout ─────────────────────────────────────────────────────
// How long THIS round took. roundStartSeconds is written by startRoundTimer and
// frozenRoundSeconds by the goal dance, and the payout runs between the two, so
// the difference is this round and not the act. It includes swap and discard
// charges on purpose: interacting eats your par exactly as playing does.
function crunchRoundElapsed() {
  if (typeof roundStartSeconds !== 'number' || typeof frozenRoundSeconds !== 'number') return 0;
  return Math.max(0, roundStartSeconds - frozenRoundSeconds);
}
function crunchUnderPar() { return Math.max(0, CRUNCH_PAR_SECONDS - crunchRoundElapsed()); }

// Credits for beating par, at the same rate leftover time always paid - so the
// Time and a Half knack still doubles it without knowing this mode exists.
function crunchParCredits() {
  return Math.floor(crunchUnderPar() / efficiencySecondsPerCoin());
}

// What the payout's clock counts DOWN from, and what its label says. Both read
// through one function each so the animation and the figure cannot drift.
function payoutClockSeconds() {
  return crunchActive() ? crunchUnderPar() : frozenRoundSeconds;
}
function payoutEfficiencyName() { return crunchActive() ? 'Under Par' : 'Efficiency'; }
function payoutEfficiencyDesc() {
  return crunchActive()
    ? `1 per ${efficiencySecondsPerCoin()}s under par (${formatTime(CRUNCH_PAR_SECONDS)})`
    : `1 per ${efficiencySecondsPerCoin()}s remaining`;
}

// ── The stuck round ─────────────────────────────────────────────────────────
// No swaps, no discards and no hand on the board. The round cannot be finished
// and the clock would simply run out, which in this mode is the run - so it is
// closed out instead: you are charged UP TO par plus a flat penalty, and paid
// nothing. Playing badly costs you the quarter's time; it does not end the run.
//
// NOTE it is only reachable at a small Selection Size. Past a minimum selection
// of 3, High Card is live (r200) and detectHand answers for any two cards, so
// there is essentially always something submittable and this never fires.
function _crunchUsable(r, c) {
  return r >= 0 && c >= 0 && r < gridRows && c < gridCols &&
         !!gridData[r]?.[c] && cardCan(gridData[r][c], 'select') && !isCellBlocked(r, c);
}

// Is ANY connected selection a hand? Bounded at 4 cards: the scan is 3^n and a
// board with no 2-to-4 card hand on it has nothing bigger either in practice.
function crunchAnyHand() {
  const cap = Math.max(2, Math.min(4, limits?.selection?.current || 3));
  const seen = new Set();
  let found = false;
  const key = cells => cells.map(([r, c]) => r * 100 + c).sort((a, b) => a - b).join(',');
  const grow = (cells) => {
    if (found) return;
    if (cells.length >= 2) {
      const k = key(cells);
      if (seen.has(k)) return;
      seen.add(k);
      try { if (detectHand(cells)) { found = true; return; } } catch (e) {}
    }
    if (cells.length >= cap) return;
    for (const [cr, cc] of cells)
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nr = cr + dr, nc = cc + dc;
        if (!_crunchUsable(nr, nc) || cells.some(([a, b]) => a === nr && b === nc)) continue;
        grow([...cells, [nr, nc]]);
        if (found) return;
      }
  };
  for (let r = 0; r < gridRows && !found; r++)
    for (let c = 0; c < gridCols && !found; c++)
      if (_crunchUsable(r, c)) grow([[r, c]]);
  return found;
}

let crunchStuckDone = false;   // one close-out per round

// Called from the round tick. The cheap tests come first on purpose: the board
// scan only runs on the rare tick where both stocks are actually empty.
function crunchCheckStuck() {
  if (!crunchActive() || crunchStuckDone) return;
  if (bossActive || roundEnded || goalReachedThisRound) return;
  if (animating || falling) return;                  // a settling board is not a stuck one
  if (swaps > 0 || discards > 0) return;
  if (crunchAnyHand()) return;
  crunchStuckDone = true;
  crunchStuckOut();
}

// Close the round out. Charges the REMAINDER of par (so a round you got stuck in
// after 40 seconds still costs the full 3:00) plus the penalty, then routes
// through the ordinary end-of-round path with the payout withheld.
function crunchStuckOut() {
  const owed = Math.max(0, CRUNCH_PAR_SECONDS - crunchRoundElapsedLive()) + CRUNCH_STUCK_PENALTY;
  if (typeof stopTimers === 'function') stopTimers();
  crunchSpend(owed, 'No hand, no swaps, no discards');
  if (roundSeconds <= 0) { onRoundEnd(); return; }   // the charge finished the run
  frozenRoundSeconds  = roundSeconds;
  frozenRoundElapsedForPar();
  skipNextPayout      = true;   // the screen still shows, with its figures zeroed
  // The routing flag for "this round is over and the interlude owns the
  // transition" - the same one the goal dance sets, and what stops a late timer
  // tick firing the legacy level-up path on top of the interlude.
  goalReachedThisRound = true;
  gameTimerPaused = true;
  if (typeof showMessage === 'function') showMessage('Round written off', 'var(--red)');
  startInterlude();
}

// Elapsed while the round is still LIVE (frozenRoundSeconds has not been written
// yet, so crunchRoundElapsed would read the previous round's).
function crunchRoundElapsedLive() {
  if (typeof roundStartSeconds !== 'number') return 0;
  return Math.max(0, roundStartSeconds - Math.max(0, roundSeconds));
}

// A written-off round must report par as UNBEATEN, whatever the clock says. The
// charge above pushes elapsed to par by construction, so this is belt and braces
// against a future change to the charge.
function frozenRoundElapsedForPar() {
  if (typeof roundStartSeconds === 'number')
    roundStartSeconds = frozenRoundSeconds + CRUNCH_PAR_SECONDS;
}

// ── Run state ───────────────────────────────────────────────────────────────
function crunchInitRun() { crunchStuckDone = false; }
function crunchNewRound() { crunchStuckDone = false; }
