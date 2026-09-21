// ══════════════════════════════════════════════
// HALLMARK (r234) - one card a round is marked, and scoring it pays
// ══════════════════════════════════════════════
// A rare Knack. At a random moment in every round ONE card on the board is
// marked. Score that card and it takes a random buff off the table below.
//
// It is the answer to "how does a run meaningfully change its deck without a
// shop full of consumables": the deck edits arrive through PLAY. There is no
// screen, no inventory and no node - you are handed a target and the decision is
// whether to build a hand around it before it leaves the board.
//
// ── THE MARK PAYS FORWARD, AND ALL SEVEN OUTCOMES DO ────────────────────────
// It resolves in playHand AFTER the score commits, beside growCardScaling and
// recordNaturalScale, and for the same reason those two sit there: a buff earned
// by a hand pays out on the NEXT one. So the three card buffs land permanently on
// the card and pay from its next play; the prime and the forced fire arm the next
// hand; only the two clock outcomes are instant, because a clock is instant.
// That is one rule for all seven rather than three of them being special.
//
// Resolving it BEFORE the score instead would mean rolling inside calcScore -
// which findBestHand calls once per connected subset and the live PIPS/MULT
// preview calls on every tap. A roll there fires dozens of times a selection.
//
// ── THE MARK IS A CARD ID, NOT A CELL AND NOT A FIELD ON THE CARD ───────────
// A cell would slide onto whatever card fell into the slot - the same trap The
// Hold had to avoid (r209), and the reason r192 re-keyed every per-card buff off
// `cardId`. A field on the card object would need a `DURABLE_CARD_FIELDS` entry
// to survive the deck cycle, and would then need un-marking on three paths.
// One global id compares clean at score time and saves as one string.

// The marked card this round, as a cardId, or null.
let hallmarkCardId = null;
// Seconds of round time at which the mark lands. Rolled per round.
let hallmarkMarkAt = -1;
// Has this round's mark been planted yet? Distinct from `hallmarkCardId != null`,
// which goes back to null the moment the mark is spent - without this the round
// would immediately plant another one.
let hallmarkPlanted = false;

// ── The table ───────────────────────────────────────────────────────────────
// `kind` is what the outcome DOES, which is what decides where it is applied.
// Every number reads out of BAL, so improve.js scales the whole knack by
// touching one entry and the description follows (DESC_TEMPLATES).
function hallmarkOutcomes() {
  const B = (typeof BAL !== 'undefined' && BAL.hallmark) ? BAL.hallmark : {};
  return [
    { kind:'mult',   label:`+${B.mult} mult`,        color:'#c0392b' },
    { kind:'pips',   label:`+${B.pips} pips`,        color:'#3a6fca' },
    { kind:'replay', label:'+1 replay',              color:'#e0ddd0' },
    { kind:'rewind', label:`+${B.seconds}s rewind`,  color:'#5aa9e6' },
    { kind:'pause',  label:`+${B.seconds}s pause`,   color:'#7ec8e3' },
    { kind:'prime',  label:'a trick primed',         color:'#8a5cf0' },
    { kind:'force',  label:'a trick forced',         color:'#d9a129' },
    // r278: a card STATE, which is the only outcome here that pays on a LATER
    // hand rather than on the next one. That fits the rule the rest of the table
    // follows (the mark pays forward) and it is what makes states reachable in
    // ordinary play without a new screen. Hallmark resolves AFTER the states'
    // own spend block in playHand, so a state granted here is not consumed by
    // the hand that earned it.
    { kind:'state',  label:'a card state',           color:'#c9a84c' },
  ];
}

// ── Planting ────────────────────────────────────────────────────────────────
// Called from the round tick. The moment is rolled once per round rather than
// fired on a fixed interval, because "at a random time" is the whole texture of
// the knack: you cannot plan around it, you react to it.
//
// The window stops short of the round's end (`HALLMARK_TAIL_FRACTION`) so a mark
// always lands with time left to actually use it - a mark planted with four
// seconds to go is a mark that reads as the knack not working.
const HALLMARK_TAIL_FRACTION = 0.25;

function hallmarkRollRound() {
  hallmarkCardId = null;
  hallmarkPlanted = false;
  const dur = (typeof roundStartSeconds !== 'undefined' && roundStartSeconds > 0)
    ? roundStartSeconds
    : (typeof currentRoundDuration === 'function' ? currentRoundDuration() : 180);
  hallmarkMarkAt = Math.floor(Math.random() * Math.max(1, dur * (1 - HALLMARK_TAIL_FRACTION)));
}

// Every ordinary card currently on the board that could take a mark. Sleights,
// stones and Tricks are not cards you score, and a blocked cell cannot be played
// at all - marking any of them would be a mark you are unable to spend.
function hallmarkCandidates() {
  const out = [];
  if (typeof gridData === 'undefined') return out;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r]?.[c];
    if (!card || !card.rank) continue;
    if (card._isSleight || card._isStone || card._isTrick) continue;
    if (typeof isCellBlocked === 'function' && isCellBlocked(r, c)) continue;
    out.push(card);
  }
  return out;
}

function hallmarkTick(elapsedRound) {
  if (typeof hasKnack !== 'function' || !hasKnack('hallmark')) return;
  if (hallmarkPlanted || hallmarkMarkAt < 0) return;
  if (elapsedRound < hallmarkMarkAt) return;
  const pool = hallmarkCandidates();
  // No legal card on the board right now (mid-fall, a fully blocked board): do
  // not burn the round's mark on nothing - try again on the next tick.
  if (!pool.length) return;
  hallmarkPlanted = true;
  const card = pool[Math.floor(Math.random() * pool.length)];
  hallmarkCardId = cardId(card);
  if (typeof showMessage === 'function') showMessage('🔖 Hallmark - a card is marked', '#d9a129');
  if (typeof sfxCoin === 'function') { try { sfxCoin(); } catch (e) {} }
  if (typeof render === 'function') render();
}

// ── Resolving ───────────────────────────────────────────────────────────────
// Called from playHand once the score has committed, with the cards the hand
// actually scored. Returns the outcome applied, or null.
function hallmarkResolve(cards) {
  if (!hallmarkCardId) return null;
  if (typeof hasKnack !== 'function' || !hasKnack('hallmark')) return null;
  const hit = (cards || []).find(c => c && c.rank && cardId(c) === hallmarkCardId);
  if (!hit) return null;

  const B = (typeof BAL !== 'undefined' && BAL.hallmark) ? BAL.hallmark : {};
  const table = hallmarkOutcomes();
  const pick  = table[Math.floor(Math.random() * table.length)];
  const k     = cardId(hit);
  let note    = pick.label;

  switch (pick.kind) {
    case 'mult':   permMult[k]   = (permMult[k]   || 0) + B.mult; break;
    case 'pips':   permPips[k]   = (permPips[k]   || 0) + B.pips; break;
    case 'replay': permRetrig[k] = (permRetrig[k] || 0) + 1;      break;
    // Through rewindTime / pauseRound, never a raw `roundSeconds +=` - that is
    // what keeps the ⏪ floater, the Kingfisher and Albatross tallies and the
    // payout-FX particle honest (r183, r220).
    case 'rewind': if (typeof rewindTime === 'function') rewindTime(B.seconds, 'Hallmark', 'hallmark', 'knack'); break;
    case 'pause':  if (typeof pauseRound === 'function') pauseRound(B.seconds, 'hallmark', 'knack'); break;
    case 'prime': {
      const pool = (typeof trickTray !== 'undefined' ? trickTray : []).filter(t =>
        !(typeof isTrickDisabledByBoss === 'function' && isTrickDisabledByBoss(t.id)));
      if (!pool.length) { note = '+' + B.pips + ' pips'; permPips[k] = (permPips[k] || 0) + B.pips; break; }
      const t = pool[Math.floor(Math.random() * pool.length)];
      primeTrick(t);
      note = `${t.name} primed`;
      if (typeof renderTrickTray === 'function') renderTrickTray();
      break;
    }
    case 'state': {
      if (typeof cardStateIds !== 'function' || typeof addCardState !== 'function') {
        note = '+' + B.pips + ' pips'; permPips[k] = (permPips[k] || 0) + B.pips; break;
      }
      const ids = cardStateIds();
      const sid = ids[Math.floor(Math.random() * ids.length)];
      addCardState(hit, sid, 1);
      note = cardStateDef(sid).name;
      break;
    }
    case 'force': {
      // The forced fire (js/force-trick.js): the Trick's condition is ignored
      // and it pays anyway on your next hand. Falls back to the pip buff when
      // nothing you own can be forced to an effect, rather than rolling a
      // visible outcome worth zero.
      const t = (typeof armRandomForcedTrick === 'function') ? armRandomForcedTrick() : null;
      if (!t) { note = '+' + B.pips + ' pips'; permPips[k] = (permPips[k] || 0) + B.pips; break; }
      note = `${t.name} forced`;
      if (typeof renderTrickTray === 'function') renderTrickTray();
      break;
    }
  }

  hallmarkCardId = null;
  if (typeof showMessage === 'function') showMessage(`🔖 Hallmark · ${note}`, pick.color);
  return pick;
}
