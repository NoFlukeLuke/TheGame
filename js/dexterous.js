// ══════════════════════════════════════════════
// DEXTEROUS (r741): Sleights as playing cards. Since r747 a PROTOCOL of Flow or
// the Schedule (js/protocols.js adds the `dexterous` flag); the card rules also
// hold under the Ambidextrous Knack (dexCardsOn). Three rules:
//   1. Every Sleight that is not a wildcard, an aim fixture or a Spectrum
//      fixture is dealt a RANK and a SUIT when it is granted (dexEnsureIdentity,
//      the old Tinker bench's sleightAssignIdentity). It then counts as a card
//      of that rank in hand detection and scores its rank's pips. The Queen
//      keeps her rank and takes a suit.
//   2. Sleights are 4x as likely in rewards (2x with Ambidextrous): Flow's
//      reward chain (its `sleights` step), the pick of three (Flow's and the
//      Schedule's), the Balance Sheet's tiles and the shop's shelf roll
//      (dexSleightOfferMult).
//   3. A Sleight PLAYED in a hand does its thing as well as scoring (DEX_PLAY,
//      run from fireSleightsOnPlay): a double_tap effect fires for that hand, an
//      on_discard effect fires as if discarded, an on_swap buff lands on the
//      other scored cards. Hand mults (Amplifier, Legacy, Siphon) are read in
//      calcScore through dexHandMult / dexHandMultX so the preview, the score
//      and the dance agree; their charges and Siphon's Focus are spent in
//      fireSleightsOnPlay after the hand commits. The ones that cannot work from
//      inside a hand are listed in DEX_PLAY_OUT and only score. A Discard-only
//      Sleight (r739, Theta) may be played here: its discard effect fires.
// The board card is drawn as a playing card (dexCardFace): the ordinary face,
// the Sleight's icon bottom middle, its charges bottom left. css/dexterous.css.
// ══════════════════════════════════════════════

const DEX_SLEIGHT_START = 2;      // random common Sleights in the deck at the start of a run
const DEX_SLEIGHT_OFFER_MULT = 4; // Sleights' weight in every reward roll

function dexterousOn() { return !!ACTIVE_MODE && ACTIVE_MODE.dexterous === true; }
// r747: the card rules (a rank and a suit, counted in hands, fired when played)
// hold in the Dexterous protocol and wherever the Ambidextrous Knack is owned.
// The two starting Sleights and the 4x offers are the protocol's alone.
const DEX_KNACK_OFFER_MULT = 2;   // Ambidextrous: Sleights twice as common in rewards
function dexCardsOn() { return dexterousOn() || (typeof ambidextrousOn === 'function' && ambidextrousOn()); }

// Which Sleights take a rank and a suit. Wildcards already have the best identity
// in the game; aim and Spectrum fixtures are not cards that leave the board.
function dexTakesIdentity(def) {
  if (!def) return false;
  if (def.activation === 'wildcard' || def.activation === 'aim' || def.activation === 'adjacent') return false;
  if (typeof SLEIGHT_FIXTURES !== 'undefined' && SLEIGHT_FIXTURES.has(def.id)) return false;
  return true;
}

// Deal the identity once. The fields (rank, suit, _playable) ride through
// discardToPlayed's rebuild and a save, so a Sleight keeps its card for the run.
function dexEnsureIdentity(card) {
  if (!dexCardsOn() || !card || !card._isSleight) return card;
  const def = sleightDef(card);
  if (!dexTakesIdentity(def)) return card;
  if (def.fixedRank) {                                   // The Queen: her rank, a dealt suit
    if (!card.suit) { const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : SUITS; card.suit = suits[Math.floor(Math.random() * suits.length)]; }
    return card;
  }
  if (!card._playable || !card.rank || !card.suit) sleightAssignIdentity(card, card._playable ? card.rank : null, card._playable ? card.suit : null);
  return card;
}

// A Sleight drawn as a playing card on the board (and in the preview).
function dexCardFace(card) {
  return dexCardsOn() && !!card && !!card._isSleight && !!card.rank && !!card.suit
      && typeof sleightIsPlayable === 'function' && sleightIsPlayable(card)
      && dexTakesIdentity(sleightDef(card));
}

// The icon and the charges laid over the playing-card face.
function dexFaceExtraHTML(card, def, usesStr) {
  return `<div class="dex-ico">${emGlyph(def?.emoji || '🃏')}</div>`
       + `<div class="dex-uses">${usesStr}</div>`
       + (card && card._ruleRanks ? `<div class="sleight-rule dex-rule">${card._ruleRanks.join(' ')}</div>` : '')
       + (card && card._thetaLanded ? `<div class="sleight-rule dex-rule">L¢${card._thetaBank || 0}</div>` : '')   // r739: Theta's bank
       + (card && card._floater ? `<div class="sleight-float">${emGlyph('🌀')}</div>` : '');
}

// Every Sleight in the deck and on the board takes its identity (a resumed
// pre-r741 save, or a card granted by a path that does not call grantSleight).
function dexSweepIdentities() {
  if (!dexCardsOn()) return;
  const seen = new Set();
  const take = cd => { if (cd && cd._isSleight && !seen.has(cd)) { seen.add(cd); dexEnsureIdentity(cd); } };
  (drawPile || []).forEach(take); (playedPile || []).forEach(take);
  for (let r = 0; r < (gridData || []).length; r++) for (let c = 0; c < (gridData[r] || []).length; c++) take(gridData[r][c]);
}

// Two random common Sleights, shuffled into the deck at the start of a run
// (startGame, after initGridData has dealt the deck).
function dexGrantStart() {
  if (!dexterousOn()) return;
  const pool = SLEIGHT_POOL.filter(j => (j.rarity || 'common') === 'common' && sleightOfferable(j) && dexTakesIdentity(j)
                                      && !(typeof survivalEntityBanned === 'function' && survivalEntityBanned(j.id)));
  const picks = [];
  for (let i = 0; i < DEX_SLEIGHT_START && pool.length; i++) {
    const j = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    picks.push(j);
    grantSleight(j);
  }
  if (typeof deckShuffle === 'function') drawPile = deckShuffle(drawPile);
  if (picks.length) noteMessage(`Dexterous: ${picks.map(j => j.name).join(' and ')} in the deck`, '#c07aee');
}

// 4x in every reward roll (the chain step, the pick of three, the shop shelf).
function dexSleightOfferMult() { return dexterousOn() ? DEX_SLEIGHT_OFFER_MULT : (typeof ambidextrousOn === 'function' && ambidextrousOn()) ? DEX_KNACK_OFFER_MULT : 1; }

// ── What a played Sleight does ──────────────────────────────────────────────
// Scores as a card always. These also fire their effect. Keyed by id; a Sleight
// with no row and no `on_play` activation only scores.
const DEX_PLAY_OUT = new Set([
  'magnet', 'photocopier', 'logistics_assistant', 'keeper', 'lockbox', 'dealers_choice',
  'all_hands', 'stopwatch', 'bogo', 'procrastinate', 'shredder', 'idol', 'sequencer',
]);
// Hand mults read by calcScore: a Sleight among the scored cells adds (+) or
// multiplies (x) the hand's mult. Siphon needs its Focus; the read is the same
// in the preview and the score, and fireSleightsOnPlay spends it.
function dexSiphonCanPay() { return typeof focusNodes !== 'undefined' && focusNodes >= BAL.siphon.focus_cost; }
function dexPlaySleights(cells) {
  if (!dexCardsOn() || !cells) return [];
  const out = [];
  cells.forEach(([r, c]) => {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._isSleight || !dexCardFace(cd)) return;
    const def = sleightDef(cd);
    if (!def || def.activation === 'on_play' || DEX_PLAY_OUT.has(def.id)) return;
    if (typeof entitySuspended === 'function' && entitySuspended('sleight', def.id)) return;
    if (cd._usesLeft !== 'infinite' && !(cd._usesLeft > 0)) return;
    out.push({ card: cd, def, r, c });
  });
  return out;
}
// Additive mult for this hand (Amplifier). Read-only.
function dexHandMult(cells) {
  let m = 0;
  dexPlaySleights(cells).forEach(({ def }) => {
    if (def.id === 'amplifier') m += Math.max(1, level || 1) * BAL.amplifier.mult_per_level;
  });
  return m;
}
// x pips events for this hand (Legacy, r739: x pips; its 5th improvement adds an x mult). Read-only.
function dexHandPipsX(cells) {
  const out = [];
  dexPlaySleights(cells).forEach(({ def }) => {
    if (def.id === 'the_legacy' && BAL.the_legacy.pips_x > 1) out.push({ id: 'the_legacy', x: BAL.the_legacy.pips_x });
  });
  return out;
}
// x mult events for this hand (Legacy's v6 mult, Siphon), in the order they are applied. Read-only.
function dexHandMultX(cells) {
  const out = [];
  dexPlaySleights(cells).forEach(({ def }) => {
    if (def.id === 'the_legacy' && BAL.the_legacy.mult_x > 1) out.push({ id: 'the_legacy', x: BAL.the_legacy.mult_x });
    if (def.id === 'siphon' && dexSiphonCanPay()) out.push({ id: 'siphon', x: BAL.siphon.mult });
  });
  return out;
}
// After the hand commits: the effects that are not a hand mult, then the charge.
// `handCells` are the scored cells; the Sleight is among them.
function dexFireOnPlay(playedCells, handCells, hand) {
  if (!dexCardsOn()) return;
  dexPlaySleights(playedCells).forEach(({ card, def, r, c }) => {
    const others = handCells.map(([hr, hc]) => gridData[hr]?.[hc]).filter(o => o && o !== card && !o._isSleight && !o._isTrick && !o._isStone && o.rank);
    let fired = true;
    switch (def.id) {
      case 'amplifier': case 'the_legacy':
        break;                                                // read in calcScore
      case 'siphon':
        if (!dexSiphonCanPay()) { fired = false; break; }
        removeFocus(BAL.siphon.focus_cost); break;            // the x4 was read in calcScore
      case 'lightning_rod':                                   // the buff lands on every other scored card
        others.forEach(o => { const k = cardId(o); permPips[k] = (permPips[k] || 0) + yokeGain('pips', BAL.lightning_rod.pips); });
        if (others.length) showMessage(`⚡ Lightning Rod - ${others.length} card${others.length > 1 ? 's' : ''} +${BAL.lightning_rod.pips} pips`, '#ffd700');
        break;
      case 'the_catalyst':
        others.forEach(o => { const k = cardId(o); permMult[k] = (permMult[k] || 0) + yokeGain('mult', BAL.the_catalyst.mult); });
        if (others.length) showMessage(`🧪 Catalyst - ${others.length} card${others.length > 1 ? 's' : ''} +${BAL.the_catalyst.mult} mult`, '#cc88ff');
        break;
      case 'the_bomb': {                                      // the pips; the board stays (the clear is the discard's)
        let n = 0;
        for (let gr = 0; gr < gridRows; gr++) for (let gc = 0; gc < gridCols; gc++) {
          const g = gridData[gr]?.[gc];
          if (g && !g._isSleight && !g._isTrick && !g._isStone && g.rank && !handCells.some(([hr, hc]) => hr === gr && hc === gc)) {
            const k = cardId(g); permPips[k] = (permPips[k] || 0) + yokeGain('pips', BAL.the_bomb.pips); n++;
          }
        }
        showMessage(`💣 Bomb - ${n} cards +${BAL.the_bomb.pips} pips`, '#ffd700');
        break;
      }
      case 'sandbag': {                                       // a pair in the hand
        const _prev = _discardContextCards; _discardContextCards = others;
        applySleightGridEffect('sandbag', r, c); _discardContextCards = _prev;
        break;
      }
      default:
        applySleightGridEffect(def.id, r, c);                 // Snooze, Piggy Bank, Cash Out, Last Call, Fresh Start, Theta's bank...
    }
    if (!fired) return;
    if (typeof spinSleightTile === 'function') spinSleightTile(r, c);
    // No cell: the hand's own removal takes the card off the board (a spent one is
    // dropped by discardToPlayed). Nulling the cell here left updateCounters,
    // which reads the hand's cells after this, a hole to trip on.
    consumeSleightCharge(card, -1, -1);
  });
}
