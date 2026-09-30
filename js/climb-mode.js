// ══════════════════════════════════════════════════════════════════════════
// CLIMB MODE (r398) - every card that scores goes up one rank.
//
// Classic's four-quarter game on a numeric deck: four real suits and the values
// 1-13, no Aces, no courts, no wilds. Every card that scores in a played hand
// climbs one rank for good (once per HAND, however many times it replays). The
// ceiling is CLIMB_MAX (15). A card that scores while AT the ceiling pays
// CLIMB_TOP_PIPS extra (per score, so a replay pays it again) and then drops
// back to CLIMB_RESET: its original rank, or 1.
//
// The rank changes when the card is REBUILT on leaving the board
// (recycleCard, which every scored card goes through on its way to the played
// pile), so the new rank rides the same `_id` through every pile. The starting
// rank lives in `_climbBase`, which is in DURABLE_CARD_FIELDS; the pending mark
// `_climbPending` deliberately is NOT, so a rebuilt card is not climbed twice.
//
// The climb is applied AFTER playScoreDance at all three dance sites in
// js/play-hand.js, beside runHandPriming/scalingCount: the dance re-scores
// synchronously (r295), so a rank changed above it would animate a different
// hand from the one that was scored.
// ══════════════════════════════════════════════════════════════════════════
const CLIMB_MAX = 15;
const CLIMB_TOP_PIPS = 75;
const CLIMB_RESET = 'original';            // 'original' | '1'
const RANKS_CLIMB = ['1','2','3','4','5','6','7','8','9','10','11','12','13'];

function climbActive() { return !!(typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.climb); }

// A card that climbs: an ordinary numeric card. Wilds, Sleights, stones and
// Tricks carry no climbing rank.
function climbCard(card) {
  if (!card || card._isSleight || card._isStone || card._isTrick || card.trick) return false;
  if (typeof isWildCard === 'function' && isWildCard(card)) return false;
  const n = parseInt(card.rank, 10);
  return Number.isFinite(n) && String(n) === String(card.rank);
}
function climbAtTop(card) { return climbActive() && climbCard(card) && parseInt(card.rank, 10) >= CLIMB_MAX; }

// Read inside calcScore's card loop. Pure: a preview must not climb anything.
function climbTopBonus(card) { return climbAtTop(card) ? CLIMB_TOP_PIPS : 0; }

// Called after the score commits and the dance has taken its ledger.
function climbAfterHand(cells) {
  if (!climbActive() || !cells) return;
  const seen = new Set();
  for (const [r, c] of cells) {
    const card = gridData[r] && gridData[r][c];
    if (!climbCard(card) || seen.has(card)) continue;
    seen.add(card);
    // MARKED, not moved: the rank changes when the card leaves the board
    // (recycleCard -> climbRecycle), so the fly-in clones, the preview and the
    // board all keep showing the rank the hand was scored with.
    card._climbPending = true;
  }
}
// Called from recycleCard, the one place a card is rebuilt on leaving the board.
function climbRecycle(card, out) {
  if (!card || !card._climbPending) return;
  const base = card._climbBase != null ? card._climbBase : card.rank;
  out._climbBase = base;
  const n = parseInt(card.rank, 10);
  out.rank = n >= CLIMB_MAX ? ((CLIMB_RESET === '1') ? '1' : String(base)) : String(n + 1);
}

function climbCardClass(card) { return climbAtTop(card) ? 'climb-top' : ''; }
