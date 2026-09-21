// ══════════════════════════════════════════════
// CARD STATES (r278) - what a card carries besides its face
// ══════════════════════════════════════════════
// A card state is a ONE-SHOT charge sitting on one physical card. Two halves:
//
//   USE IT   - play the card and the state pays out, big.
//   IGNORE IT - leave the card alone for `fuse` seconds and the other half of
//               the state fires instead, which may be good OR bad.
//
// That is the whole design. A state is never a flat penalty for doing nothing,
// because a flat penalty is just a tax and the player has no decision to make.
// The idle half is a different outcome, not a worse one, and several of them
// (Deadline deleting itself, Scavenger taking a neighbour with it) are how you
// THIN THE DECK without a shop, which is the point.
//
// ── THE THREE THINGS THIS FILE OWNS ────────────────────────────────────────
//
// 1. THE PER-CARD CLOCK (`cardIdleSecs`). How long each card on the board has
//    gone untouched. Ticked from the round tick, so it stops when the round
//    stops and needs no pause handling of its own. Reset per round, per the
//    owner's spec: the fuse refreshes at every level.
//
// 2. TEMP CARDS (`_temp`). A card that exists for this level only. It is never
//    put into the draw pile or the played pile, so it evaporates the instant it
//    leaves the board and again when the level's board falls out. It IS a real
//    card while it is there: a boss can curse it, a mid-round blessing can buff
//    it, and it scores exactly like anything else. That is the risk of building
//    round one.
//
// 3. THE STATE REGISTRY (`CARD_STATE_DEFS`). One table, so a new state is a row
//    rather than a sixth place to remember.
//
// ── KEYED BY cardId, NEVER BY CELL AND NEVER BY A FIELD ON THE CARD ────────
// The same rule Hallmark follows (r234) and for the same two reasons. A CELL
// slides onto whatever card falls into the slot. A FIELD on the card object is
// destroyed by the deck cycle unless it is named in DURABLE_CARD_FIELDS, and
// would then need clearing on three separate paths. One global keyed by cardId
// compares clean, saves as one object, and is what every other per-card buff in
// the game already does.
//
// `_temp` is the ONE exception and is deliberately a card field: it has to
// travel with the object through discardToPlayed's rebuild so that rebuild can
// refuse it, and a temp card has no meaningful life outside the board anyway.

// ── Storage ─────────────────────────────────────────────────────────────────
// cardId -> { stateId: stacks }. Only `backfill` ever reads a stack above 1;
// everything else is a single charge.
let cardStates = {};
// cardId -> whole seconds this card has sat on the board untouched. Only board
// cards are in here; the tick prunes anything that has left.
let cardIdleSecs = {};
// Column -> queued temp copies waiting for the next fall to carry them in.
// Drained by removeAndFall in place of a deck draw (see cardStatesDrawFor).
let cardStateBackfillQueue = {};

// A state firing its idle half discards or deletes the card itself. That is not
// the player spending a discard, so it costs no STOCK - a card removing itself
// when you are on zero discards must not be a rule that cannot run. It still
// costs the clock at whatever a discard costs right now, because the board did
// lose a card and the round should feel it. Flip this to true to bill the stock
// as well; `interactTimeCostsOn()` already decides the time half, so Flow pays
// nothing either way.
const CARD_SELF_DISCARD_COSTS_STOCK = false;

// ══════════════════════════════════════════════
// TEMP CARDS
// ══════════════════════════════════════════════
function isTempCard(card) { return !!(card && card._temp); }

// A temp duplicate of `card`, with its own identity. It copies the FACE and
// nothing else: permanent pips, mult, curses and counters are all keyed by
// cardId, so a fresh id is a genuinely fresh card wearing the same face. Giving
// it the original's buffs would make a stack of Backfill an infinite money
// printer off one blessed card.
function makeTempCard(rank, suit, states) {
  const c = stampId({ rank, suit, _temp: true });
  if (states) for (const id in states) if (states[id] > 0) addCardState(c, id, states[id]);
  return c;
}

// The seam for a future "this temp card is yours for good" effect. Nothing calls
// it today. It is written now because the rest of the file is built around temp
// cards being convertible: the flag is a single field, the deck accounting is a
// single counter, and both are here rather than scattered through the callers.
function makeCardPermanent(card) {
  if (!isTempCard(card)) return false;
  delete card._temp;
  if (typeof expectedDeckTotal !== 'undefined') expectedDeckTotal++;
  if (typeof updateDeckHud === 'function') updateDeckHud();
  return true;
}

// ══════════════════════════════════════════════
// THE REGISTRY
// ══════════════════════════════════════════════
// `use` fires when the card is PLAYED in a scored hand, after the score commits,
// beside growCardScaling and hallmarkResolve and for the same reason: a payout
// earned by a hand lands on the next one, and rolling anything inside calcScore
// would fire it dozens of times per selection.
//
// `fuse` is the seconds of inactivity that arm `idle`, which is run from the
// round tick with the card's own cell.
//
// `once` (the default) means the charge is SPENT either way. That is what makes
// a state a decision rather than a permanent upgrade: a Deadline card that
// forced two Tricks on every single play, forever, is not a card, it is a win
// condition. `backfill` opts out because its whole mechanic is a stack that
// counts itself down.
const CARD_STATE_DEFS = {
  // ── Standalone: no idle half ──────────────────────────────────────────────
  backfill: {
    name: 'Backfill', icon: '⧉', color: '#3aa76d', tier: 'rare',
    // `once: false` only means cardStatesOnUse leaves it alone; `leave` below
    // spends it itself, because a Backfill card is spent by LEAVING the board,
    // which is a discard as much as a play.
    stacks: true, once: false,
    desc: 'When this card leaves the board, a temp copy of it falls in behind. Stacks.',
    // Fires from removeAndFall, so it covers being played AND being discarded.
    //
    // THE CHARGE MOVES TO THE COPY, it does not stay on the original. A stack of
    // 3 therefore means three copies, one after another, and then it is done -
    // which is what "it stacks so it happens multiple times" says. Left on the
    // original it would not be a stack at all, it would be a permanent extra
    // card on every play for the rest of the run; and copied to BOTH it would
    // branch, and a card that doubles every time you play it is not a balance
    // number anyone can reason about.
    leave(ctx) {
      const n = cardStateStacks(ctx.card, 'backfill');
      if (n <= 0) return;
      clearCardState(ctx.card, 'backfill', true);
      const carry = n > 1 ? { backfill: n - 1 } : null;
      const copy = makeTempCard(ctx.card.rank, ctx.card.suit, carry);
      (cardStateBackfillQueue[ctx.c] || (cardStateBackfillQueue[ctx.c] = [])).push(copy);
    },
  },
  fleeting: {
    name: 'Fleeting', icon: '⏳', color: '#d8474b', tier: 'common',
    fuse: 30,
    desc: 'Stays on the board for 30 seconds, then discards itself.',
    idle(ctx) { return { leave: 'discard', note: 'Fleeting - discarded itself' }; },
  },

  // ── The duality states ────────────────────────────────────────────────────
  deadline: {
    name: 'Deadline', icon: '⏱', color: '#e8a13a', tier: 'epic', fuse: 60,
    desc: 'Play it and two random tricks fire. Leave it 60 seconds and it deletes itself.',
    use(ctx) {
      let fired = 0, names = [];
      for (let i = 0; i < 2; i++) {
        const t = (typeof armRandomForcedTrick === 'function') ? armRandomForcedTrick() : null;
        if (!t) break;
        fired++; names.push(t.name);
      }
      if (!fired) return { note: 'Deadline - nothing you own can be forced' };
      if (typeof renderTrickTray === 'function') renderTrickTray();
      return { note: `Deadline - ${names.join(' and ')} forced` };
    },
    idle(ctx) { return { leave: 'delete', note: 'Deadline - the card is gone' }; },
  },

  callback: {
    name: 'Callback', icon: '↻', color: '#8a5cf0', tier: 'epic', fuse: 60,
    // The use half is READ INSIDE calcScore (cardStateCallbackOn), not applied
    // here: it has to change the hand being scored, and the post-commit block is
    // far too late for that. This entry has no `use` for exactly that reason;
    // playHand still spends the charge through the ordinary path.
    desc: 'Play it and every card in the hand replays once. Leave it 60 seconds and it deletes a card beside it.',
    scored: true,
    idle(ctx) {
      const n = cardStateRandomNeighbour(ctx.r, ctx.c);
      if (!n) return { note: 'Callback - nothing beside it to take' };
      cardStateDeleteAt(n[0], n[1]);
      return { note: 'Callback - ate the card beside it' };
    },
  },

  review: {
    name: 'Review', icon: '↗', color: '#d9a129', tier: 'rare', fuse: 60,
    desc: 'Play it for a 1 in 5 chance to improve a trick. Leave it 60 seconds for a 1 in 2 chance to knock a tier off one (luck lowers that).',
    use(ctx) {
      const B = cardStateBal();
      if (luckRoll(B.review_up) <= 0) return { note: 'Review - no change' };
      const t = (typeof pickImproveTarget === 'function') ? pickImproveTarget('trick') : null;
      if (!t || typeof improveEntity !== 'function') return { note: 'Review - nothing left to improve' };
      const tier = improveEntity(t.id);
      if (!tier) return { note: 'Review - nothing left to improve' };
      if (typeof syncOwnedEntityDescs === 'function') syncOwnedEntityDescs();
      if (typeof renderTrickTray === 'function') renderTrickTray();
      return { note: `Review - ${t.name} to v${tier}.0`, color: '#3aa76d' };
    },
    idle(ctx) {
      const B = cardStateBal();
      // luckBadRoll, not luckRoll: this is the one direction Luck runs the other
      // way. A bad outcome has to get RARER as Luck climbs or Luck is a stat that
      // makes half the card worse.
      if (luckBadRoll(B.review_down) <= 0) return { note: 'Review - filed with no change' };
      const t = cardStatePickImproved();
      if (!t) return { note: 'Review - nothing improved to knock back' };
      const tier = downgradeEntity(t.id);
      if (typeof syncOwnedEntityDescs === 'function') syncOwnedEntityDescs();
      if (typeof renderTrickTray === 'function') renderTrickTray();
      return { note: `Review - ${t.name} down to v${tier}.0`, color: '#d8474b' };
    },
  },

  scavenger: {
    name: 'Scavenger', icon: '◆', color: '#c86bd8', tier: 'epic', fuse: 60,
    desc: 'Play it and it swallows a neighbour’s buffs and deletes it. Leave it 60 seconds and it wipes a neighbour’s buffs and deletes itself.',
    use(ctx) {
      // absorbAdjacentInto is Ace Absorb's and Monopoly's own function: the
      // neighbour's permanent bonuses plus its pip value move onto this card and
      // every copy of it is erased from the run.
      if (typeof absorbAdjacentInto !== 'function') return null;
      const scored = new Set((ctx.handCells || []).map(([r, c]) => `${r}-${c}`));
      const before = (permPips[cardId(ctx.card)] || 0);
      absorbAdjacentInto([ctx.r, ctx.c], scored);
      const after = (permPips[cardId(ctx.card)] || 0);
      if (after === before) return { note: 'Scavenger - nothing beside it to take' };
      return { note: `Scavenger - swallowed a neighbour, +${after - before} pips` };
    },
    idle(ctx) {
      const n = cardStateRandomNeighbour(ctx.r, ctx.c);
      if (!n) return { leave: 'delete', note: 'Scavenger - starved' };
      cardStateStripBuffs(gridData[n[0]][n[1]]);
      return { leave: 'delete', note: 'Scavenger - stripped the card beside it and went' };
    },
  },

  roll_call: {
    name: 'Roll Call', icon: '☷', color: '#5aa9e6', tier: 'legendary', fuse: 60,
    // Like Callback, the use half cannot live here: it changes WHICH CARDS the
    // hand is made of, so it runs before the hand is found (rollCallAugment).
    desc: 'Play it and every card of its rank on the board joins the hand. Leave it 60 seconds and every card of its rank scores 15 fewer pips.',
    scored: true,
    idle(ctx) {
      const B = cardStateBal();
      let hit = 0;
      // Targets the RANK, which is the one thing here that is deliberately not
      // per-card: the state says "every card of its rank" and means it, in the
      // piles as well as on the board.
      (typeof everyDeckCard === 'function' ? everyDeckCard() : []).forEach(c => {
        if (c.rank !== ctx.card.rank || c === ctx.card) return;
        const k = cardId(c);
        permPips[k] = (permPips[k] || 0) - B.roll_call_penalty;
        hit++;
      });
      if (!hit) return { note: 'Roll Call - nobody else to call' };
      return { note: `Roll Call - ${hit} card${hit === 1 ? '' : 's'} at -${B.roll_call_penalty} pips`, color: '#d8474b' };
    },
  },
};

// Every state that can be handed out at random. `backfill` and `fleeting` are in
// it too: one is pure upside and one is pure fuse, and a table that only ever
// deals the five duality states would make those two unreachable.
function cardStateIds() { return Object.keys(CARD_STATE_DEFS); }
function cardStateDef(id) { return CARD_STATE_DEFS[id] || null; }
function cardStateBal() {
  const B = (typeof BAL !== 'undefined' && BAL.card_states) ? BAL.card_states : {};
  return {
    review_up:          B.review_up          != null ? B.review_up          : 0.2,
    review_down:        B.review_down        != null ? B.review_down        : 0.5,
    roll_call_penalty:  B.roll_call_penalty  != null ? B.roll_call_penalty  : 15,
    fuse_seconds:       B.fuse_seconds       != null ? B.fuse_seconds       : 60,
  };
}

// ══════════════════════════════════════════════
// QUERY / GRANT
// ══════════════════════════════════════════════
function cardStateStacks(card, id) {
  if (!card) return 0;
  const e = cardStates[cardId(card)];
  return (e && e[id]) || 0;
}
function cardHasState(card, id) { return cardStateStacks(card, id) > 0; }

// Everything this card carries, as [{ id, def, n }]. The order of the registry is
// the order they are drawn and fired in.
function cardStateList(card) {
  if (!card) return [];
  const e = cardStates[cardId(card)];
  if (!e) return [];
  const out = [];
  for (const id in CARD_STATE_DEFS) if (e[id] > 0) out.push({ id, def: CARD_STATE_DEFS[id], n: e[id] });
  return out;
}

function addCardState(card, id, n) {
  const def = CARD_STATE_DEFS[id];
  if (!card || !def) return false;
  const k = cardId(card);
  const e = cardStates[k] || (cardStates[k] = {});
  e[id] = def.stacks ? (e[id] || 0) + (n || 1) : 1;
  // A fresh charge starts a fresh fuse. Granting a state to a card that has been
  // sitting untouched for 55 seconds and having it blow five seconds later is
  // the grant not working.
  cardIdleSecs[k] = 0;
  return true;
}

function clearCardState(card, id, all) {
  const k = cardId(card);
  const e = cardStates[k];
  if (!e || !e[id]) return;
  if (all || !CARD_STATE_DEFS[id]?.stacks) delete e[id];
  else if (--e[id] <= 0) delete e[id];
  if (!Object.keys(e).length) delete cardStates[k];
}

// Wipe every per-card buff off one card. The idle half of Scavenger, and the one
// place that has to know the full list - miss one and "stripped" is a lie.
function cardStateStripBuffs(card) {
  if (!card) return;
  const k = cardId(card);
  [permPips, permMult, permXPips, permXMult, permRetrig, permTime,
   permPipsGrow, permMultGrow].forEach(store => { if (store) delete store[k]; });
  if (typeof card._whetMult !== 'undefined') card._whetMult = 0;
  if (typeof card._vulturePause !== 'undefined') card._vulturePause = 0;
}

function cardStateRandomNeighbour(r, c) {
  if (typeof getNeighbors !== 'function') return null;
  const ok = getNeighbors(r, c).filter(([nr, nc]) => {
    const cd = gridData[nr]?.[nc];
    return cd && cd.rank && !cd._isSleight && !cd._isStone && !cd._isTrick;
  });
  if (!ok.length) return null;
  return ok[Math.floor(Math.random() * ok.length)];
}

// An owned Trick that has actually been improved, for Review's idle half. Nothing
// to knock back is a real outcome and is reported rather than silently skipped.
function cardStatePickImproved() {
  if (typeof trickTray === 'undefined' || typeof entityTierOf !== 'function') return null;
  const pool = (trickTray || []).filter(t => t && t.id && entityTierOf(t.id) > 0);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ══════════════════════════════════════════════
// THE CLOCK
// ══════════════════════════════════════════════
// How long until this card's fuse blows, or null. Read by the board (a ring on
// the card) and by the tick.
function cardStateFuse(card) {
  if (!card) return null;
  let shortest = null;
  cardStateList(card).forEach(({ def }) => {
    if (!def.fuse) return;
    const left = def.fuse - (cardIdleSecs[cardId(card)] || 0);
    if (shortest == null || left < shortest.left) shortest = { left, total: def.fuse };
  });
  // Turnover has no state of its own; it fuses every card on the board.
  if (typeof hasKnack === 'function' && hasKnack('turnover') && card.rank) {
    const t = cardStateTurnoverSeconds();
    const left = t - (cardIdleSecs[cardId(card)] || 0);
    if (shortest == null || left < shortest.left) shortest = { left, total: t };
  }
  return shortest;
}

function cardStateTurnoverSeconds() {
  const B = (typeof BAL !== 'undefined' && BAL.turnover) ? BAL.turnover : {};
  return B.idle_seconds != null ? B.idle_seconds : 60;
}

// Every card on the board, as [card, r, c]. Blocked, held and quarantined cells
// are skipped: a card you are not allowed to touch must not have its fuse run
// down while you are locked out of it.
function cardStateBoardCards() {
  const out = [];
  if (typeof gridData === 'undefined') return out;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd.rank || cd._isSleight || cd._isStone || cd._isTrick) continue;
    if (typeof isCellBlocked === 'function' && isCellBlocked(r, c)) continue;
    out.push([cd, r, c]);
  }
  return out;
}

// Called once per round-tick second. Ages every board card, then fires whatever
// came due. PRUNES anything no longer on the board, which is what keeps the map
// from growing for the length of a run and what resets a card's idle time when
// it leaves and comes back.
function cardStatesTick() {
  const board = cardStateBoardCards();
  const live = new Set();
  board.forEach(([card]) => {
    const k = cardId(card);
    live.add(k);
    cardIdleSecs[k] = (cardIdleSecs[k] || 0) + 1;
  });
  for (const k in cardIdleSecs) if (!live.has(k)) delete cardIdleSecs[k];

  // The r213 Hollow lesson: removeAndFall takes the `falling` lock, and starting
  // one on top of a swap, a score or another fall cuts that animation short. A
  // skipped tick costs a second of fuse and nothing else.
  if (animating || falling) return;
  if (typeof roundEnded !== 'undefined' && roundEnded) return;

  cardStateFireDue(board);
}

// What has come due this tick, fired in one batch so several cards leaving
// together are ONE fall rather than a queue of interrupted ones.
function cardStateFireDue(board) {
  const leaving = [];      // [[r,c], ...] cards going to the draw pile
  const deleting = [];     // [[r,c], ...] cards leaving the run entirely
  const notes = [];

  board.forEach(([card, r, c]) => {
    const idle = cardIdleSecs[cardId(card)] || 0;
    cardStateList(card).forEach(({ id, def }) => {
      if (!def.fuse || idle < def.fuse) return;
      let out = null;
      try { out = def.idle({ card, r, c, id }); } catch (e) { if (devMode) console.warn('[CARD STATE] idle threw', id, e); }
      clearCardState(card, id);
      if (out && out.note) notes.push({ text: `${def.icon} ${out.note}`, color: out.color || def.color });
      if (out && out.leave === 'discard') leaving.push([r, c]);
      if (out && out.leave === 'delete')  deleting.push([r, c]);
    });
  });

  if (leaving.length || deleting.length) {
    notes.forEach(n => { if (typeof showMessage === 'function') showMessage(n.text, n.color); });
    cardStateRemove(leaving, deleting);
    return;
  }

  // Turnover: one card per tick, the longest-idle one. NOT the whole board at
  // once - at a round's start every card has aged together, so a sweep would be
  // a board wipe on one tick rather than the churn this is meant to be. One a
  // second trickles them out, and each replacement then ages on its own clock,
  // so the knack self-staggers after the first pass.
  //
  // FREE of both stock AND the clock, which is the knack's whole printed text.
  // That is not a discount being generous: billing it at 3s a card costs a full
  // board about 48 seconds of a 180-second round, so a priced Turnover is not a
  // weaker Turnover, it is an unplayable one.
  if (typeof hasKnack !== 'function' || !hasKnack('turnover')) return;
  const t = cardStateTurnoverSeconds();
  let worst = null, worstIdle = t - 1;
  board.forEach(([card, r, c]) => {
    const idle = cardIdleSecs[cardId(card)] || 0;
    if (idle > worstIdle) { worstIdle = idle; worst = [r, c]; }
  });
  if (!worst) return;
  if (typeof showMessage === 'function') showMessage('♻ Turnover - a stale card is replaced', '#3aa76d');
  cardStateRemove([worst], [], { free: true });
}

// The one place a state takes a card off the board.
//   `recycle` - an ordinary discard: the card goes to the back of the draw pile.
//   `destroy` - the card leaves the run. This is the deck thinning the duality
//               states are FOR, so it is a real removal, not a discard.
// A temp card evaporates either way: discardToDrawPile refuses it.
function cardStateRemove(recycle, destroy, opts) {
  const cells = [...recycle, ...destroy];
  if (!cells.length) return;
  recycle.forEach(([r, c]) => { const cd = gridData[r]?.[c]; if (cd) discardToDrawPile(cd); });
  destroy.forEach(([r, c]) => {
    const cd = gridData[r]?.[c];
    if (cd && !isTempCard(cd) && typeof expectedDeckTotal !== 'undefined') expectedDeckTotal--;
  });
  // Time is billed once for the whole batch, at whatever a discard costs right
  // now. The player's discard STOCK is deliberately untouched (see the constant
  // at the top of this file). `opts.free` is the Turnover knack, which pays
  // neither - see the note at its call site.
  if (!(opts && opts.free)) cardStateBillSelfDiscard(cells.length);
  if (typeof sfxCardDiscard === 'function') { try { sfxCardDiscard(); } catch (e) {} }
  removeAndFall(cells, 'discard');
}

function cardStateBillSelfDiscard(n) {
  if (!n) return;
  if (CARD_SELF_DISCARD_COSTS_STOCK && typeof discards !== 'undefined') discards = Math.max(0, discards - 1);
  if (typeof interactTimeCostsOn === 'function' && !interactTimeCostsOn()) return;
  let per = (typeof BAL !== 'undefined' && BAL._resources) ? BAL._resources.discard_seconds_per_card : 3;
  if (typeof hasKnack === 'function' && hasKnack('free_discards')) per = 0;
  const cost = Math.round(n * per * (typeof bossInteractMult === 'function' ? bossInteractMult() : 1));
  if (cost <= 0) return;
  roundSeconds = Math.max(1, roundSeconds - cost);
  if (typeof showTimeCost === 'function') showTimeCost(`-${cost}s`);
  if (typeof updateClockUI === 'function') updateClockUI();
}

// Delete one cell's card outright, leaving a hole for the caller's fall to fill.
// Used by Callback's idle half, which eats a neighbour without leaving itself.
function cardStateDeleteAt(r, c) {
  const cd = gridData[r]?.[c];
  if (!cd) return;
  if (!isTempCard(cd) && typeof expectedDeckTotal !== 'undefined') expectedDeckTotal--;
  const k = cardId(cd);
  delete cardStates[k];
  delete cardIdleSecs[k];
  gridData[r][c] = drawCard() || null;
}

// ══════════════════════════════════════════════
// THE HOOKS
// ══════════════════════════════════════════════
// TOUCH - play, discard or swap. Resets the fuse and nothing else.
//
// A SWAP counts, and that is a real lever rather than an accident: moving a card
// buys it another full fuse, at the cost of a swap and eight seconds. It is the
// only way to hold a charged card you are not ready to spend.
function cardStatesTouch(cards) {
  (cards || []).forEach(card => { if (card && card.rank) cardIdleSecs[cardId(card)] = 0; });
}
function cardStatesTouchCells(cells) {
  cardStatesTouch((cells || []).map(([r, c]) => gridData[r]?.[c]));
}

// USE - the cards a scored hand actually played. Called from playHand once the
// score has committed. Fires each state's `use` half and spends the charge.
//
// `scored: true` on a def means its payout was already applied earlier in the
// hand (Callback inside calcScore, Roll Call before the hand was found); the
// charge is still spent here, so there is one place that does that.
function cardStatesOnUse(cards, handCells) {
  (cards || []).forEach(card => {
    if (!card || !card.rank) return;
    cardStateList(card).forEach(({ id, def }) => {
      if (!def.use && !def.scored) return;
      let out = null;
      if (def.use) {
        const pos = cardStateFindCell(card);
        try { out = def.use({ card, r: pos ? pos[0] : -1, c: pos ? pos[1] : -1, id, handCells }); }
        catch (e) { if (devMode) console.warn('[CARD STATE] use threw', id, e); }
      }
      if (def.once !== false) clearCardState(card, id);
      if (out && out.note && typeof showMessage === 'function') showMessage(`${def.icon} ${out.note}`, out.color || def.color);
    });
  });
}

function cardStateFindCell(card) {
  if (typeof gridData === 'undefined' || !card) return null;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++)
    if (gridData[r]?.[c] === card) return [r, c];
  return null;
}

// LEAVE - called from the TOP of removeAndFall, while gridData still holds the
// cards. This is Backfill's hook, and it has to be here rather than after the
// fall: by then gravity has packed the column and the hole is gone.
function cardStatesOnLeave(cells) {
  (cells || []).forEach(([r, c]) => {
    const card = gridData[r]?.[c];
    if (!card || !card.rank) return;
    cardStateList(card).forEach(({ id, def }) => {
      if (!def.leave) return;
      try { def.leave({ card, r, c, id }); } catch (e) { if (devMode) console.warn('[CARD STATE] leave threw', id, e); }
    });
  });
}

// A queued Backfill copy for this column, or null. removeAndFall asks for one
// BEFORE it calls drawCard, so a backfilled hole costs the deck nothing: no card
// is drawn, the Marker's one-in-ten counter does not advance, and the deck audit
// stays balanced because a temp card is not counted as a deck card at all.
function cardStatesDrawFor(col) {
  const q = cardStateBackfillQueue[col];
  if (!q || !q.length) return null;
  return q.shift() || null;
}

// ══════════════════════════════════════════════
// CALLBACK - read inside calcScore
// ══════════════════════════════════════════════
// True if any card in this hand carries Callback. A pure READ: calcScore runs
// once per connected subset inside findBestHand and again on every tap of the
// live PIPS/MULT preview, so anything here that consumed a charge would spend it
// dozens of times a selection. The charge is spent in playHand like every other
// state. Same rule siphonMultX and minuteHandCharges follow.
function cardStateCallbackOn(cards) {
  if (!cards || !cards.length) return false;
  for (const c of cards) if (c && c.rank && cardHasState(c, 'callback')) return true;
  return false;
}

// ══════════════════════════════════════════════
// ROLL CALL - read before the hand is found
// ══════════════════════════════════════════════
// Every OTHER board cell holding the same rank as a selected Roll Call card.
// Pure, so the minimum-selection guard can ask what the pull will be worth
// before deciding whether the selection is legal.
function rollCallPullCells(selCells) {
  if (typeof gridData === 'undefined' || !selCells || !selCells.length) return [];
  const ranks = new Set();
  selCells.forEach(([r, c]) => {
    const cd = gridData[r]?.[c];
    if (cd && cd.rank && cardHasState(cd, 'roll_call')) ranks.add(cd.rank);
  });
  if (!ranks.size) return [];
  const taken = new Set(selCells.map(([r, c]) => `${r}-${c}`));
  const out = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    if (taken.has(`${r}-${c}`)) continue;
    const cd = gridData[r]?.[c];
    if (!cd || !cd.rank || cd._isSleight || cd._isStone || cd._isTrick) continue;
    if (typeof isCellBlocked === 'function' && isCellBlocked(r, c)) continue;
    if (typeof cardCan === 'function' && !cardCan(cd, 'select')) continue;
    if (ranks.has(cd.rank)) out.push([r, c]);
  }
  return out;
}
function rollCallPullCount(selCells) { return rollCallPullCells(selCells).length; }

// Build the augmented hand. Follows ringerAugment's shape exactly, and for the
// same two reasons:
//
//  - IT IGNORES SELECTION SIZE. The cards are added after the player has
//    committed, so a selection limit of 3 can still submit five of a kind.
//  - IT IGNORES ADJACENCY. findBestHand only ever builds orthogonally connected
//    subsets, and the other three 7s are never next to each other. detectHand
//    does NOT check connectivity, so the augmented hand is assembled directly
//    and handed to it.
//
// The pull is UNCONDITIONAL: every card of that rank joins whether or not it
// helps, which is the owner's spec and the whole risk. HAND_MAX_CARDS is 7, so a
// big pull can push cards out of the hand and into the penalty column, and they
// are consumed either way.
function rollCallAugment(result, selCells) {
  const pull = rollCallPullCells(selCells);
  if (!pull.length) return null;
  const key = ([r, c]) => `${r}-${c}`;
  const base = (result && result.handCells) ? result.handCells : (selCells || []);
  const rcCell = (selCells || []).find(([r, c]) => {
    const cd = gridData[r]?.[c];
    return cd && cd.rank && cardHasState(cd, 'roll_call');
  });

  // THREE TRIES, and the fallbacks are the spec rather than defensiveness. The
  // pull is UNCONDITIONAL - every card of that rank joins whether or not it
  // helps - but handComponentsFor refuses a hand of more than HAND_MAX_CARDS (7)
  // and refuses one carrying a card no component claims. So a pull that cannot
  // be part of the hand is still taken; it is just taken as PENALTY CARDS, which
  // is the engine's existing word for "committed, consumed, and billed".
  //
  //  1. the whole union - the good case, a Four of a Kind alongside a Run of 3
  //  2. the rank group alone - what Roll Call actually promises, with the rest of
  //     the selection paying as penalties
  //  3. the hand you already had, with the pull paying as penalties
  const tries = [];
  const union = [...base];
  const seen = new Set(union.map(key));
  pull.forEach(cell => { if (!seen.has(key(cell))) { union.push(cell); seen.add(key(cell)); } });
  tries.push(union);
  if (rcCell) tries.push([rcCell, ...pull]);

  let handCells = null, hand = null;
  for (const cells of tries) {
    const h = (typeof detectHand === 'function') ? detectHand(cells) : null;
    if (h) { hand = h; handCells = cells; break; }
  }
  if (!hand) {
    if (!result || !result.hand) return null;   // no hand either way: leave it alone
    hand = result.hand; handCells = result.handCells;
  }

  // Everything committed that the hand does not use. `selected` is extended by
  // the caller, so these are consumed with the rest.
  const used = new Set(handCells.map(key));
  const all = [...base, ...pull];
  const penaltyCells = [];
  const pseen = new Set();
  all.forEach(cell => {
    const k = key(cell);
    if (used.has(k) || pseen.has(k)) return;
    pseen.add(k); penaltyCells.push(cell);
  });
  const penaltyPips = penaltyCells.reduce((sum, [r, c]) => {
    const cd = gridData[r]?.[c];
    return sum + (cd && typeof cardPips === 'function' ? cardPips(cd.rank) : 0);
  }, 0);

  const rank = gridData[pull[0][0]][pull[0][1]].rank;
  if (typeof showMessage === 'function')
    showMessage(`\u2637 Roll Call - ${pull.length} more ${rank}${pull.length === 1 ? '' : 's'} join the hand`, '#5aa9e6');

  const rawScore = (typeof calcScore === 'function') ? calcScore(hand, handCells) : 0;
  return {
    cells: pull,
    result: { ...(result || {}), hand, handCells, penaltyCells, penaltyPips,
              rawScore, finalScore: Math.max(0, rawScore - penaltyPips) },
  };
}

// ══════════════════════════════════════════════
// LIFECYCLE
// ══════════════════════════════════════════════
// Per ROUND. The owner's spec: the fuse refreshes at every level, so a card you
// were sitting on does not blow up the instant the next round deals.
//
// Temp cards are gone by now anyway (the level-clear fall runs discardToPlayed
// on every cell and that refuses them), but their state and idle entries are
// keyed by an id nothing will ever hold again, so they are swept here.
function cardStatesResetRound() {
  cardIdleSecs = {};
  cardStateBackfillQueue = {};
}

// Per RUN.
function cardStatesResetRun() {
  cardStates = {};
  cardStatesResetRound();
}

// ══════════════════════════════════════════════
// THE CARD FACE
// ══════════════════════════════════════════════
// The badge drawn on a card carrying a state. Emitted by renderCardAppearance,
// so it survives render() rewriting a card's innerHTML wholesale and rides the
// fall animation and the hand preview for free.
function cardStateBadgeHTML(card) {
  const list = cardStateList(card);
  if (!list.length) return '';
  // One badge, like the per-card FX mark: two glyphs in a corner of a 57px card
  // is noise, and the tooltip lists the rest. The first in registry order wins.
  const { def, n } = list[0];
  const stack = n > 1 ? `<span class="cs-n">${n}</span>` : '';
  const title = list.map(s => `${s.def.name}: ${s.def.desc}`).join('\n');
  return `<div class="card-state-badge" style="--csc:${def.color}" title="${title.replace(/"/g, '&quot;')}">${def.icon}${stack}</div>`;
}

// The class list a state adds to the card element. `card-temp` is independent of
// any state: a temp card has to look temporary whether or not it carries one,
// because "this will not be here next round" is the thing the player most needs
// to know before building a plan around it.
function cardStateCardClass(card) {
  const out = [];
  if (isTempCard(card)) out.push('card-temp');
  const list = cardStateList(card);
  if (list.length) { out.push('card-stated'); list.forEach(s => out.push('cs-' + s.id)); }
  return out.join(' ');
}
