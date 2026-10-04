// ── QUARTER RESOURCE LIMITS (QRL, r477) ─────────────────────────────────────
//
// Owner's rule. In quarter N a card may have N buffs working, take replays from
// N sources, and a Trick may hold primes from N sources. Q1 = 1, Q4 = 4. Flow's
// quarters are its four bosses (bosses beaten + 1).
//
//   BUFFS: a card can HOLD any number of buff kinds (events may grant past the
//   limit: "early resource expansion"). When it scores, only `limit` of them
//   work, picked at random per hand (`qrlActiveKinds`, deterministic on qrlSeed
//   so the preview, the score and the payouts after it agree). Pickers that let
//   the player choose the card grey out a full card (`qrlCardFull`) - the ONLY
//   place QRL is explained.
//   REPLAYS: a card keeps its `limit` biggest replay sources (calcScore). A
//   source worth 2 replays still pays 2. Layered-hand replays are not a source.
//   PRIMES: a Trick holds primes from at most `limit` sources (primeTrick).
//
// Applies to quarter modes (actStructure) and Flow. Dev -> Change the game now
// switches it off (`lethe.qrl.v1`, stored only when off).

let qrlSeed = 0;
let _lastHandQrlReplayCut = false;   // calcScore's snapshot: a replay source was cut (read in playHand)   // +1 per played hand, at the end of scalingCount (after the dance)
let qrlEnabled = (() => { try { return localStorage.getItem('lethe.qrl.v1') !== '0'; } catch (e) { return true; } })();
function qrlSetEnabled(on) {
  qrlEnabled = !!on;
  try { on ? localStorage.removeItem('lethe.qrl.v1') : localStorage.setItem('lethe.qrl.v1', '0'); } catch (e) {}
}
// The dev checkbox reads the live value whenever the panel is built.
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => { const cb = document.getElementById('dev-qrl'); if (cb) cb.checked = qrlEnabled; });
function qrlOn() {
  if (!qrlEnabled || !ACTIVE_MODE) return false;
  return ACTIVE_MODE.actStructure === true || !!ACTIVE_MODE.flow;
}
function qrlQuarter() {
  if (ACTIVE_MODE && ACTIVE_MODE.flow) return Math.min(4, (typeof survivalBossesBeaten === 'number' ? survivalBossesBeaten : 0) + 1);
  return Math.max(1, Math.min(4, actNumber || 1));
}
// The one number. Infinity when QRL does not apply.
function qrlLimit() { return qrlOn() ? qrlQuarter() : Infinity; }

// A card's buff KINDS. Scaling pips/mult belong to their flat kind (what they
// grow into). Only gains count: a minus-pips penalty always applies.
const QRL_BUFF_KINDS = [
  ['pips',  k => (permPips[k] || 0) > 0 || (permPipsGrow[k] || 0) > 0],
  ['mult',  k => (permMult[k] || 0) > 0 || (permMultGrow[k] || 0) > 0],
  ['xpips', k => (permXPips[k] || 1) > 1],
  ['xmult', k => (permXMult[k] || 1) > 1],
  ['retrig',k => (permRetrig[k] || 0) > 0],
  ['time',  k => (permTime[k] || 0) > 0],
  ['coins', k => (permCoins[k] || 0) > 0],
  ['focus', k => (permFocus[k] || 0) > 0],
];
function qrlKindsOfKey(k) { return k == null ? [] : QRL_BUFF_KINDS.filter(([, has]) => has(k)).map(([id]) => id); }
function qrlBuffKinds(card) { return (card && card.rank) ? qrlKindsOfKey(cardId(card)) : []; }
// The kinds working on this card this hand, or null when all of them are.
function qrlActiveKinds(card) {
  const kinds = qrlBuffKinds(card), L = qrlLimit();
  if (kinds.length <= L) return null;
  const id = card._id | 0;
  const order = kinds.map((kd, i) => ({ kd, r: _detReplayRand(id * 31 + QRL_BUFF_KINDS.findIndex(x => x[0] === kd) * 7919 + 4241, qrlSeed) }))
    .sort((a, b) => a.r - b.r);
  return new Set(order.slice(0, L).map(o => o.kd));
}
function qrlBuffOn(card, kind) {
  const a = qrlActiveKinds(card);
  return !a || a.has(kind) || !qrlBuffKinds(card).includes(kind);
}
// For a card picker: would giving this card `kind` add a buff past the limit?
// Adding to a kind it already has never does.
function qrlCardFull(card, kind) {
  if (!qrlOn() || !card || !card.rank) return false;
  const kinds = qrlBuffKinds(card);
  return kinds.length >= qrlLimit() && !(kind && kinds.includes(kind));
}
// The enhanceCardKey payload's keys -> QRL kinds.
const QRL_PAYLOAD_KIND = { pips: 'pips', mult: 'mult', growPips: 'pips', growMult: 'mult', xpips: 'xpips', xmult: 'xmult',
                           retrig: 'retrig', time: 'time', coin: 'coins', focus: 'focus' };
function qrlPayloadKind(e) { for (const key in (e || {})) if (QRL_PAYLOAD_KIND[key]) return QRL_PAYLOAD_KIND[key]; return null; }

const _qrlS = n => n === 1 ? '' : 's';
const QRL_TEXT = {
  buff:      () => { const L = qrlLimit(); return `Only ${L} buff${_qrlS(L)} per card permitted in Q${qrlQuarter()} due to QRL`; },
  replay:    () => { const L = qrlLimit(); return `Replays are limited to ${L} source${_qrlS(L)} in Q${qrlQuarter()} due to QRL`; },
  prime:     () => { const L = qrlLimit(); return `Tricks are limited to ${L} prime source${_qrlS(L)} in Q${qrlQuarter()} due to QRL`; },
  full:      () => 'Quarter resource limit (QRL) reached',
  fullWhy:   () => { const L = qrlLimit(); return `Q${qrlQuarter()} allows ${L} buff${_qrlS(L)} per card. Each quarter allows one more.`; },
  clearance: () => 'Clearance granted for early resource expansion',
};
// Printed once per round per kind.
const _qrlSaid = {};
function qrlNotice(kind) {
  const key = level + ':' + kind;
  if (_qrlSaid[kind] === key) return;
  _qrlSaid[kind] = key;
  if (typeof showMessage === 'function') showMessage(QRL_TEXT[kind](), 'var(--gold)');
}
