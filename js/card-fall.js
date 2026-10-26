function renderCardAppearance(card, r, c, {
  isSel        = false,
  selIdx       = -1,
  isHandReady  = false,
  isHandValid  = false,
  // r254: this selected card will NOT be part of the hand - the r201 "every card
  // must be load-bearing" rule dropped it, its pips will be SUBTRACTED and the
  // card consumed anyway. Red on the board, priced in the #hand-name label.
  isPenalty    = false,
  isSwapPending = false,
  isReachable  = true,
  isChallenge  = false,
  // The Fog hides ranks on the BOARD. A card in the hand preview or the scoring
  // dance is one you have already committed to, so it is always shown - fogging
  // it there would hide the hand from the animation that is explaining it.
  revealFog       = false,
} = {}) {
  // ── Challenge card (js/challenge-round.js) ──
  if (card._isChallenge) {
    const _q = card.cr || {};
    return { className: 'card stone-card cr-card cr-' + crFamily(_q) + (_q.src === 'flow' ? ' cr-flow' : '') + (_q.done === 'won' ? ' cr-won' : _q.done === 'lost' ? ' cr-lost' : '')
               + (_q.src === 'flow' && !_q.done && _q.timeLeft <= 10 ? ' cr-low' : '')
               + (typeof crCanRaise === 'function' && _q.ladder && crCanRaise(_q) ? ' cr-cleared' : ''),
             innerHTML: crCardFaceHTML(card) };
  }
  // ── Reshuffle card (js/reshuffle-card.js) ──
  if (card._isReshuffle) return { className: 'card stone-card rs-card', innerHTML: reshuffleFaceHTML() };
  // ── Stone (boss obstacle - falls normally, can't be played/discarded) ──
  if (!isChallenge && card._isStone) {
    if (card._curseCard && typeof CURSE_CARD_DEFS !== 'undefined' && CURSE_CARD_DEFS[card._curseCard]) {   // r590: a curse card
      const d = CURSE_CARD_DEFS[card._curseCard];
      return { className: 'card stone-card junk-card curse-card', innerHTML: `<div class="junk-glyph">${d.icon}</div><div class="junk-word">${d.name.toUpperCase()}</div>` };
    }
    if (card._junk) return {   // r576: junk, an empty card that stays in your deck
      className: `card stone-card junk-card${isSwapPending ? ' swap-pending' : ''}`,
      innerHTML: `<div class="junk-glyph">✕</div><div class="junk-word">JUNK</div>`,
    };
    return {
      className: `card stone-card${isSwapPending ? ' swap-pending' : ''}`,
      innerHTML: `<div class="stone-glyph">✦</div>`,
    };
  }

  // ── Sleight card ──
  if (!isChallenge && card._isSleight) {
    const def = SLEIGHT_POOL.find(j => j.id === card.sleightId);
    // An 'adjacent' fixture shows how close it is to paying out (1/2) rather than
    // its charge count, which is the number that actually matters on the board.
    const _maxCh = (typeof sleightMaxCharges === 'function') ? sleightMaxCharges(def) : null;
    const usesStr = def?.activation === 'adjacent'
      ? `${card._adjPlays || 0}/${def.adjacentPlays || 2}`
      : def?.id === 'keeper' ? (typeof keeperModeLabel === 'function' ? keeperModeLabel(card) : '')
      : (card._usesLeft === 'infinite' ? '∞' : (_maxCh ? `${card._usesLeft}/${_maxCh}` : card._usesLeft));
    // An AIM sleight (Reflect / Soul Mirror) is drawn tilted with a direction arrow,
    // and a spent one is greyed. Both used to live ONLY in render()'s own sleight
    // branch, so a sleight animating - falling, dealt in, or shown in the hand preview -
    // came out as a plain tile: the aim arrow and the tilt vanished for the length of
    // the fall and snapped back when it landed. Same markup on both paths now.
    if (AIM_SLEIGHTS.has(def?.id)) {
      const dir = card._aimDir || (card._aimDir = 'up');
      return {
        className: `trick-card sleight-card aim-sleight${sleightIsSpent(card, def) ? ' sleight-spent' : ''}`,
        innerHTML:
          `<div class="sleight-aim-inner" style="transform:perspective(360px) ${AIM_TILT[dir]}">` +
            `<div class="sleight-card-emoji">${emGlyph(def?.emoji || '🪞')}</div>` +
          `</div>` +
          `<div class="aim-arrow aim-${dir}">${AIM_ARROW[dir]}</div>`,
      };
    }
    return {
      className: `trick-card sleight-card${sleightRarityClass(def)}${sleightTierClass(def)}${isSwapPending ? ' swap-pending' : ''}`
               + (sleightIsSpent(card, def) ? ' sleight-spent' : '')
               + (card._inert ? ' sleight-inert' : ''),
      innerHTML: sleightFaceHTML(card, def, usesStr),
    };
  }

  // ── Challenge card ──
  if (isChallenge) {
    return {
      className: `card challenge-card`,
      innerHTML: `<div class="challenge-badge">⚠️</div>`,
    };
  }

  // ── Normal playing card (rank + suit, with all bonus decorations) ──
  const k   = cardId(card);
  const pp  = permPips[k] || 0;
  const pm  = permMult[k] || 0;
  // Scaling buffs (r209): NOT scored - they raise pp/pm by this much per play.
  // Shown as their own marker so a card that grows is distinguishable at a glance
  // from a card with a big fixed bonus, which is the whole point of the split.
  const gp  = permPipsGrow[k] || 0;
  const gm  = permMultGrow[k] || 0;
  // Resolve the curse's DEFINITION here, not inline in the template. A saved run
  // outlives deploys (main auto-deploys to Pages on every commit), so a save can
  // name a curse id this build no longer has - and an unguarded CURSE_DEFS[id].name
  // threw right here, inside render(), which aborted resumeSavedRun() before it
  // started the round clock and left the player on a dead half-drawn board.
  // An unknown curse now simply draws no badge.
  const curse = cardCurses[k];
  const curseDef = curse ? CURSE_DEFS[curse.id] : null;
  const hasPip = pp > 0, hasMult = pm > 0;
  const isCombined = !!card.combined;

  const rcWoodpecker = woodpeckerCell && woodpeckerCell === `${r}-${c}` ? ' rc-woodpecker' : '';
  // The shared "what affected what" highlight (r209, divided in r296 -
  // js/entity-fx.js): a RING around the card in the owning Trick's colour,
  // DIVIDED EVENLY when several marked lines cross this cell rather than naming
  // one of them or blending into a third. It covers all nine line-marking
  // Tricks, where the three per-Trick `rc-pips` / `rc-mult` / `rc-retrigger`
  // tints it replaced covered three - so Perfect Timing, Right Time, Groove,
  // Assembly Line and Overtime marked a line the player could not see.
  // r296 also washed the card FACE and r299 took that back out: the face is the
  // card's own, and it now carries the buff bands below instead.
  // An inner element rather than a class + a CSS variable, because
  // renderCardAppearance returns className and innerHTML only - it has nowhere
  // to hang a per-card custom property.
  const _lineMetas  = (typeof lineMetasForCell === 'function') ? lineMetasForCell(r, c) : [];
  const lineRing    = (typeof lineRingHTMLFor === 'function') ? lineRingHTMLFor(_lineMetas) : '';
  const fxMark      = (typeof cardMarkHTML === 'function') ? cardMarkHTML(r, c) : '';
  // A boss hold greys the card and puts its countdown on it (js/cooldown.js).
  const _cd = (typeof cardCooldownParts === 'function') ? cardCooldownParts(card, r, c) : { cls: '', html: '' };

  const bothClass = hasPip && hasMult ? ' has-both' : hasPip ? ' has-pip' : hasMult ? ' has-mult' : '';
  // Spectrum (numeric) cards: the whole face is the colour and the value sits
  // big in the middle — no suit glyph. Keyed off the CARD, not the mode, so the
  // hand preview, score dance and fall animation all agree. cardColorSuit() is
  // what makes 9/10/11 render white while keeping their own identity underneath.
  const _faceSuit = cardColorSuit(card);
  const isNum = isColorSuit(_faceSuit);
  // A WILD RIDES THE ORDINARY CARD PATH, not an early return like the stone and
  // the Sleight. It is a real deck card: it is selected, swapped, discarded,
  // cursed, buffed and marked like any other, so it wants every decoration this
  // path already draws. Only the face differs - one class and the rank/suit block.
  const isWild = (typeof isWildCard === 'function') && isWildCard(card);
  const _dual = (typeof cardIsDual === 'function') && cardIsDual(card);
  const _coin = (typeof cardCoinHTML === 'function') ? cardCoinHTML(card) : '';
  // r633: the pixel card look draws the face from Jfred's sheet (js/card-face.js); when it
  // has pieces for this card the text rank / suit / wild glyph are hidden by css (.has-pxf).
  const _pxf = (typeof cardFaceSpriteHTML === 'function')
    ? cardFaceSpriteHTML(card, { isWild, isNum, dual: _dual,
        fogged: !isWild && typeof bossFogHides === 'function' && bossFogHides(isSel || revealFog) })
    : '';
  const className = [
    _pxf ? 'has-pxf' : '',
    'card',
    isWild ? 'wild-card' : '',
    isNum ? 'num-card' : '',
    suitClass(_faceSuit),
    isSel        ? 'selected'    : '',
    isHandValid  ? 'hand-valid'  : '',
    isPenalty    ? 'hand-penalty' : '',
    isHandReady  ? 'hand-ready'  : '',
    isSwapPending ? 'swap-pending' : '',
    (!isReachable && !isSel && !isSwapPending) ? 'unreachable' : '',
    curse ? 'cursed' : '',
    (typeof cardIsFodder === 'function' && cardIsFodder(card)) ? (card._fodderTemp && !permFodder[cardId(card)] ? 'fodder fodder-temp' : 'fodder') : '',
    bothClass.trim(),
    rcWoodpecker.trim(),
    _lineMetas.length ? 'rc-on-line' : '', _cd.cls,
    (gp || gm) ? 'card-scaling' : '',
    _dual ? 'card-dual' : '', (_dual && card.rank2) ? 'card-dual-rank' : '', _coin ? 'card-has-coin' : '',
    // Card states + temp cards (r278). `card-temp` is independent of any state:
    // "this will not be here next round" is the thing a player most needs to
    // know before building a plan around the card.
    (typeof cardStateCardClass === 'function') ? cardStateCardClass(card) : '',
    (typeof climbCardClass === 'function') ? climbCardClass(card) : '',
  ].filter(Boolean).join(' ');

  // r392: a dual card draws its second rank/suit on the face itself
  // (cardDualFaceHTML), so the old corner label is gone.
  const combinedLabel = '';

  const innerHTML = `
    ${curseDef ? `<div class="curse-badge" title="${curseDef.name}: ${curseDef.desc}">${curseDef.icon}<span class="curse-left">${curse.left}</span></div>` : ''}
    ${(typeof cardIsFodder === 'function' && cardIsFodder(card)) ? `<div class="fodder-badge" title="Fodder: swap or discard it free${card._fodderTemp && !permFodder[cardId(card)] ? ' (until it leaves the board)' : ''}">♻</div>` : ''}
    ${combinedLabel}${_coin}${_pxf}
    ${isWild
        // The Fog hides RANKS, and a wild has none to hide - so it is drawn in
        // full even under the Fog rather than reading as a '?' the player would
        // have to select to identify.
        ? `<div class="wild-glyph">${WILD_RANK}</div><div class="wild-label">${WILD_NAME.toUpperCase()}</div>`
      : (typeof bossFogHides === 'function' && bossFogHides(isSel || revealFog))
        ? (isNum ? `<div class="rank num-rank fog-rank">?</div>`
                 : `<div class="rank fog-rank">?</div><div class="suit">${card.suit}</div>`)
        : (isNum ? `<div class="rank num-rank${String(card.rank).length > 1 ? ' num-wide' : ''}">${card.rank}</div>`
                 : _dual ? cardDualFaceHTML(card)
                 : `<div class="rank">${card.rank}</div><div class="suit">${card.suit}</div>`)}
    ${(typeof cardBandsHTML === 'function') ? cardBandsHTML(card) : ''}
    ${(gp || gm) ? `<div class="card-grow-mark" title="Scales +${gp ? gp + ' pips' : ''}${gp && gm ? ' and +' : ''}${gm ? gm + ' mult' : ''} each time it's played">\u2197</div>` : ''}
    ${lineRing}
    ${fxMark}
    ${(typeof cardStateBadgeHTML === 'function') ? cardStateBadgeHTML(card) : ''}
    ${_cd.html}
  `;

  return { className, innerHTML };
}

// Build a temp-anim element for a card falling or entering at (finalR, finalC).
// Calls renderCardAppearance with no interaction state, then adds temp-anim class.
// Future-proof: any new card type added to renderCardAppearance is automatically
// handled here at no extra cost.
function buildCardAnimEl(card, finalR, finalC) {
  const el = document.createElement('div');
  const { className, innerHTML } = renderCardAppearance(card, finalR, finalC);
  el.className = className + ' temp-anim';
  el.dataset.row = finalR; el.dataset.col = finalC;   // its cell's margin (r642 even gaps)
  el.innerHTML = innerHTML;
  el.style.position       = 'absolute';
  // r659: the DRAWN card's size, not the cell's (r641): a cell-wide copy fell wide
  // and the card snapped thin when the board re-rendered.
  el.style.width          = ((typeof CARD_VIS_W === 'number' && CARD_VIS_W) || CARD_W) + 'px';
  el.style.height         = ((typeof CARD_VIS_H === 'number' && CARD_VIS_H) || CARD_H) + 'px';
  el.style.pointerEvents  = 'none';
  el.style.zIndex         = '10';
  return el;
}

// ── r661 (owner): EVERY CARD FALLS ON ITS OWN ───────────────────────────────
// "Every card should be able to animate its fall independent of whatever else
// is going on around it." The fall used to be one event: a 300ms slide-out that
// locked every tap (`animating`), then temp copies of the moving cards drawn
// over hidden real ones, then a tail that threw every element away and drew
// the board again. A second removal mid-fall had to snap the first one flat
// (r652's fallSettleNow), which is the hitch the owner saw.
//
// Now the board's REAL card elements move. gridData is written at once (as
// before), render() puts every element on its final cell, and each card that
// has to travel gets a WAAPI animation on the standalone `translate` property
// from where it was drawn a moment ago to rest (0). A card still in the air
// when another fall needs it is simply re-aimed: its live animation is
// cancelled, its current drawn position read, and a new animation started from
// there. Cards no fall touches are never redrawn, hidden or rebuilt. Removed
// cards lose their card id (render() no longer knows them), slide out on their
// own and are dropped when their slide ends; nothing waits on them and no
// `animating` lock is taken for a fall.
//
// `falling` is true while ANY card is in the air (the registry below is not
// empty). The board tail (the drains, a queued PLAY / DISCARD, the next
// challenge card) runs once when the last card lands, whichever fall it came
// from. A fall's own promise resolves when ITS cards have landed, so a caller
// that awaits one (Autopilot, All Hands, Match-3) carries on as before.
const _cardFalls = new Map();   // card id -> { anim, el }
let _fallLive = null;           // kept for readers; the registry above is the truth
const FALL_LEAVE_MS = 280;      // a removed card's slide-out
// A card's drawn top inside #grid, in design px, its live translate included.
function _fallVisTop(el, gr, z) { return (el.getBoundingClientRect().top - gr.top) / z; }
function _fallGridScale(gridEl) { const gr = gridEl.getBoundingClientRect(); return { gr, z: (gr.width / (gridEl.offsetWidth || 1)) || 1 }; }
function _fallForget(id, a) {
  const rec = _cardFalls.get(id);
  if (!rec || (a && rec.anim !== a)) return;
  _cardFalls.delete(id);
  if (rec.el) { rec.el.style.zIndex = ''; }
  if (_cardFalls.size || !falling) return;
  // The board was torn down under the last card (a round end's sweep, a new deal):
  // nothing to settle, and the tail's render and drains belong to no board now.
  if (rec.el && !rec.el.isConnected) { falling = false; return; }
  _fallTail();
}
// Every card snaps to its cell, nothing else runs (a new run, a screen that
// takes the board). The tail is NOT run: the caller is tearing the board down.
function fallCancelAll() {
  _cardFalls.forEach(({ anim, el }) => { try { anim.cancel(); } catch (e) {} if (el) el.style.zIndex = ''; });
  _cardFalls.clear(); falling = false;
}
// Every card snaps to its cell NOW and the board's tail runs (the drains, a
// queued action). For code that needs the board at rest this instant.
function fallSettleNow() {
  if (!_cardFalls.size) { if (falling) { falling = false; } return; }
  _cardFalls.forEach(({ anim, el }) => { try { anim.cancel(); } catch (e) {} if (el) el.style.zIndex = ''; });
  _cardFalls.clear();
  dbgEvent('info', '[FALL] settled early');
  _fallTail();
}
function _fallTail() {
  falling = false;
  console.log('[FALL] complete');
  const queued = pendingAction;
  pendingAction = null;
  render();
  // A Spectrum deck fixture that just paid out leaves the board HERE, not at the
  // moment it paid: it pays inside playHand, above the dance, and the dance's own
  // removeAndFall holds the falling lock until this point. Drained before the
  // queued action so "it paid, then it left" is one beat rather than a card
  // vanishing behind the next hand. (js/spectrum.js)
  if (typeof spectrumDrainFixtureExits === 'function') spectrumDrainFixtureExits();
  if (typeof freshStartDrain === 'function') freshStartDrain();
  if (typeof crAfterFall === 'function') crAfterFall();   // falls / hits on fall-type challenge cards
  if (typeof crDrain === 'function') crDrain();   // a solved challenge card leaves, the next arrives
  if (queued === 'play') { dbgEvent('info', 'executing queued play'); playHand(); }
  else if (queued === 'discard') { dbgEvent('info', 'executing queued discard'); runQueuedDiscard(); }
  else if (discardCarryArm) { discardCarryArm = false; if (selected.length) scheduleAutoSubmit(); }
}
// One card's trip to rest: from `fromY` design px above (negative) or below its
// cell to 0, with the landing bounce. A live trip on the same card is re-aimed.
function _fallLaunch(el, id, fromY, delay, dur, fadeIn) {
  const BOUNCE_PX = 8, SQUISH = 0.10;
  const prev = _cardFalls.get(id);
  if (prev) { try { prev.anim.cancel(); } catch (e) {} }
  const dist = -fromY;   // how far it still has to go (down is positive)
  const tr = y => `0 ${(fromY + y).toFixed(2)}px`;
  const frames = fadeIn ? [
    { opacity: 0, translate: tr(0), scale: '1 1',                                        offset: 0 },
    { opacity: 1, translate: tr(0), scale: '1 1',                                        offset: 0.06 },
    { opacity: 1, translate: tr(dist * 0.55), scale: '1 0.96',                           offset: 0.55, easing: 'ease-in' },
    { opacity: 1, translate: tr(dist + BOUNCE_PX), scale: `1 ${1 - SQUISH}`,             offset: 0.83 },
    { opacity: 1, translate: tr(dist - BOUNCE_PX * 0.7), scale: `1 ${1 + SQUISH}`,       offset: 0.91 },
    { opacity: 1, translate: tr(dist + BOUNCE_PX * 0.3), scale: `1 ${1 - SQUISH * 0.2}`, offset: 0.96 },
    { opacity: 1, translate: '0 0px', scale: '1 1',                                      offset: 1 },
  ] : [
    { translate: tr(0), scale: '1 1',                                        offset: 0 },
    { translate: tr(dist * 0.6), scale: '1 0.96',                            offset: 0.5, easing: 'ease-in' },
    { translate: tr(dist + BOUNCE_PX), scale: `1 ${1 - SQUISH}`,             offset: 0.82 },
    { translate: tr(dist - BOUNCE_PX * 0.7), scale: `1 ${1 + SQUISH}`,       offset: 0.91 },
    { translate: tr(dist + BOUNCE_PX * 0.3), scale: `1 ${1 - SQUISH * 0.2}`, offset: 0.96 },
    { translate: '0 0px', scale: '1 1',                                      offset: 1 },
  ];
  el.style.zIndex = '10';
  // `backwards`: the card holds its start through its column's stagger. No
  // forward fill: at the end `translate` is the stylesheet's (none), which IS
  // the cell, so a finished trip leaves nothing on the element to clean up.
  const a = el.animate(frames, { duration: dur, delay, easing: 'ease-in', fill: 'backwards' });
  _cardFalls.set(id, { anim: a, el });
  falling = true;
  const done = () => _fallForget(id, a);
  a.finished.then(done, done);
  return a;
}
async function removeAndFall(removingCells, mode = 'play') {
  // Something else holds the board (a swap look, a boss fizzle, Match-3's own
  // step): wait for it rather than drop the cards (r652).
  if (animating) {
    console.log('[FALL] waiting on animating', { mode, cells: removingCells.length });
    let _w = 0;
    while (animating && _w++ < 60) await new Promise(res => setTimeout(res, 30));
    if (animating) { console.log('[FALL] BLOCKED by animating flag', { mode, cells: removingCells.length }); return; }
  }
  console.log('[FALL] start', { mode, cells: removingCells.length, inAir: _cardFalls.size });
  // The fall-type challenge cards' snapshot is of the board BEFORE the first of
  // any overlapping falls; the tail counts once when the last card lands.
  if (typeof crBeforeFall === 'function' && !(typeof crFallSnap !== 'undefined' && crFallSnap)) crBeforeFall();

  const challengeKey = challengeCard ? `${challengeCard.pos[0]}-${challengeCard.pos[1]}` : null;
  removingCells = removingCells.filter(([r,c]) => `${r}-${c}` !== challengeKey);
  const removing = new Set(removingCells.map(([r,c])=>`${r}-${c}`));
  // Clear swap mode if the pending card is about to be removed
  if (swapPending && removing.has(`${swapPending[0]}-${swapPending[1]}`)) swapPending = null;

  // Card states that fire on LEAVING the board (r278, js/card-states.js). Called
  // here, while gridData still holds the cards and before anything is nulled:
  // Backfill queues a temp copy for this column, and by the time the fall plan
  // below has packed the column the hole it wanted to fill is gone.
  if (typeof cardStatesOnLeave === 'function') cardStatesOnLeave(removingCells);

  // Only play mode routes cards to the played pile.
  // Discard mode: the caller (doDiscard) already pushed cards to the back of the draw pile.
  if (mode === 'play') {
    removingCells.forEach(([r,c]) => discardToPlayed(gridData[r][c]));
  } else if (mode === 'match3') {
    // Match-3 cascade. Finite deck (default) behaves like a normal play - scored
    // cards are held out until round end. The infinite-deck dev toggle instead
    // requeues them to the BACK of the draw pile so the board never runs dry.
    removingCells.forEach(([r,c]) => {
      const card = gridData[r][c];
      if (match3InfiniteDeck) discardToDrawPile(card);
      else                    discardToPlayed(card);
    });
  }

  const gridEl = document.getElementById('grid');
  const { gr, z } = _fallGridScale(gridEl);

  // ── The removed cards leave on their own. They lose their card id first, so
  //    render() (called below, and by every tap) neither moves nor keeps them;
  //    their slide runs beside the fall and they are dropped when it ends. ──
  const targetId = mode === 'discard' ? 'btn-discard' : 'btn-records';
  const targetEl = document.getElementById(targetId);
  const targetRect = targetEl ? targetEl.getBoundingClientRect() : null;
  const leaving = [];
  removingCells.forEach(([r,c]) => {
    const card = gridData[r][c]; if (!card) return;
    const el = gridEl.querySelector(`[data-card-id="${card._id}"]`); if (!el) return;
    const live = _cardFalls.get(String(card._id));
    if (live) { try { live.anim.cancel(); } catch (e) {} _cardFalls.delete(String(card._id)); }
    el.removeAttribute('data-card-id'); el.removeAttribute('data-row'); el.removeAttribute('data-col');
    el.classList.add('card-leaving'); el.style.pointerEvents = 'none';
    leaving.push(el);
  });
  // Already hidden (its copy flew to the preview, js/score-dance.js): gone at once.
  const visibleLeaving = leaving.filter(el => { const o = el.style.opacity; if (o !== '' && +o === 0) { el.remove(); return false; } return true; });
  let leaveMs = 0;
  if (visibleLeaving.length) {
    if (mode === 'discard' && typeof cardAnimExit === 'function') {
      visibleLeaving.forEach(el => { el.style.transition = 'none'; });
      leaveMs = 200;
      Promise.resolve(cardAnimExit('discard', visibleLeaving, targetRect)).catch(() => {}).then(() => visibleLeaving.forEach(el => el.remove()));
    } else {
      leaveMs = targetRect ? FALL_LEAVE_MS : 200;
      visibleLeaving.forEach(el => {
        if (targetRect) {
          const cardRect = el.getBoundingClientRect();
          const dx = (targetRect.left + targetRect.width/2) - (cardRect.left + cardRect.width/2);
          const dy = (targetRect.top + targetRect.height/2) - (cardRect.top + cardRect.height/2);
          el.style.transition = 'none';
          el.style.zIndex = '20';
          void el.offsetWidth;
          el.style.transition = 'transform 0.28s cubic-bezier(0.4,0,1,1), opacity 0.28s ease-in';
          el.style.transform = `translate(${dx}px, ${dy}px) scale(0.3)`;
          el.style.opacity = '0';
        } else el.style.opacity = '0';
        setTimeout(() => el.remove(), leaveMs + 40);
      });
    }
  }

  // ── The plan (data only), computed from the board as it is now. Voids
  //    ("blocked cells") are skipped: cards stack to the bottom-most non-void
  //    rows, new cards fill the top-most. ──
  const fallPlan = [];
  const newCards = [];
  for (let col = 0; col < gridCols; col++) {
    const playableRows = [];
    for (let r = 0; r < gridRows; r++) if (!isCellVoid(r, col)) playableRows.push(r);
    if (playableRows.length === 0) continue;
    const survivors = [];
    for (const r of playableRows) {
      if (!removing.has(`${r}-${col}`) && gridData[r][col] !== null) survivors.push({ origRow: r, card: gridData[r][col] });
    }
    const removedCount = playableRows.length - survivors.length;
    survivors.forEach((entry, i) => {
      const targetRow = playableRows[playableRows.length - survivors.length + i];
      if (targetRow !== entry.origRow) {
        fallPlan.push({ row: entry.origRow, col, fallBy: targetRow - entry.origRow, card: entry.card });
        if (challengeCard && challengeCard.pos[0] === entry.origRow && challengeCard.pos[1] === col) challengeCard.pos = [targetRow, col];
      }
    });
    // New cards fill the holes left above the packed survivors. A queued
    // Backfill copy fills the hole BEFORE the deck does (js/card-states.js).
    // Drawn first, then stacked: when the deck runs dry the cards that did come
    // sit on the survivors and the empty cells stay at the TOP of the column.
    const drawn = [];
    for (let i = 0; i < removedCount; i++) {
      const _bf = (typeof cardStatesDrawFor === 'function') ? cardStatesDrawFor(col) : null;
      const card = _bf || drawCard() || null;
      if (card) drawn.push(card);
    }
    drawn.forEach((card, j) => {
      const finalRow = playableRows[removedCount - drawn.length + j];
      newCards.push({ col, finalRow, fromAbove: drawn.length - j, card });
    });
  }

  // Where every moving card is DRAWN right now (its live trip included), read
  // before the data and the elements change under it.
  const visTopById = {};
  fallPlan.forEach(({ card }) => {
    const el = gridEl.querySelector(`[data-card-id="${card._id}"]`);
    if (el) visTopById[card._id] = _fallVisTop(el, gr, z);
  });

  // The selection and a pending swap FOLLOW THEIR CARDS through the fall (r661): a card
  // picked before this fall may move to another cell, and a cell may be left empty.
  const _selCards = selected.map(([r,c]) => gridData[r]?.[c] || null);
  const _swapCard = swapPending ? (gridData[swapPending[0]]?.[swapPending[1]] || null) : null;
  // Update gridData NOW so selection during the fall is accurate
  removingCells.forEach(([r,c]) => { gridData[r][c] = null; });
  for (let col = 0; col < gridCols; col++) {
    const playableRows = [];
    for (let r = 0; r < gridRows; r++) if (!isCellVoid(r, col)) playableRows.push(r);
    const survivors = [];
    for (const r of playableRows) {
      if (gridData[r][col] !== null) survivors.push(gridData[r][col]);
      gridData[r][col] = null;
    }
    survivors.forEach((card, i) => { gridData[playableRows[playableRows.length - survivors.length + i]][col] = card; });
    newCards.filter(n => n.col === col).forEach(({ finalRow, card }) => {
      if (card && !isCellVoid(finalRow, col)) gridData[finalRow][col] = card;
    });
  }

  // Deck dry and the board thin: the Reshuffle card drops into a hole the deck could not fill.
  if (mode !== 'match3' && typeof reshuffleMaybeDeal === 'function') { const _rs = reshuffleMaybeDeal(); if (_rs) newCards.push(_rs); }

  // Settle challenge card into the first empty cell of its column (data is now final)
  if (challengeCard) {
    for (let col = 0; col < gridCols; col++) {
      if (challengeCard.pos[1] === col) {
        for (let r = 0; r < gridRows; r++) { if (gridData[r][col] === null) { challengeCard.pos = [r, col]; break; } }
      }
    }
  }
  {
    const _at = card => { if (!card) return null; for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (gridData[r]?.[c] === card) return [r, c]; return null; };
    const _sel = _selCards.map(_at).filter(Boolean);
    if (_sel.length !== selected.length || _sel.some((rc, i) => rc[0] !== selected[i][0] || rc[1] !== selected[i][1])) { selected = _sel; if (typeof cancelAutoSubmit === 'function' && !_sel.length) cancelAutoSubmit(); }
    if (swapPending) swapPending = _at(_swapCard);
  }
  if (typeof discardCarryRestore === 'function') discardCarryRestore();   // a queued discard's leftover selection

  // ── Every element onto its final cell (render() creates the new cards there),
  //    with the moving cards' live trips cancelled first so the rest position
  //    can be read without a translate on it. All synchronous: no frame paints
  //    between the cancel and the new trip that starts from the same spot. ──
  fallPlan.forEach(({ card }) => { const live = _cardFalls.get(String(card._id)); if (live) { try { live.anim.cancel(); } catch (e) {} _cardFalls.delete(String(card._id)); } });
  newCards.forEach(({ card }) => { if (!card) return; const live = _cardFalls.get(String(card._id)); if (live) { try { live.anim.cancel(); } catch (e) {} _cardFalls.delete(String(card._id)); } });
  render();

  const FALL_DUR = 420;
  const COL_OFFSET = 60;
  const activeCols = new Set(removingCells.map(([,c]) => c));
  const minActiveCol = activeCols.size > 0 ? Math.min(...activeCols) : 0;
  const colReadyAt = {};
  const myAnims = [];

  // Survivors fall from where they were drawn to where they now rest.
  const sortedFallPlan = [...fallPlan].sort((a, b) => a.col !== b.col ? a.col - b.col : b.row - a.row);
  sortedFallPlan.forEach(({ row, col, fallBy, card }) => {
    if (!card) return;
    const el = gridEl.querySelector(`[data-card-id="${card._id}"]`);
    if (!el) return;
    const restTop = _fallVisTop(el, gr, z);
    const from = (visTopById[card._id] !== undefined) ? visTopById[card._id] : (restTop - fallBy * CARD_STEP);
    const fromY = from - restTop;
    if (Math.abs(fromY) < 0.5) return;
    const colBase = leaveMs + (col - minActiveCol) * COL_OFFSET;
    const startAt = Math.max(colBase, colReadyAt[col] || colBase);
    colReadyAt[col] = startAt + FALL_DUR * 0.6;
    myAnims.push(_fallLaunch(el, String(card._id), fromY, startAt, FALL_DUR, false));
  });

  // New cards come in from above the board, one card height per card queued above them.
  const sortedNewCards = [...newCards].sort((a, b) => a.col !== b.col ? a.col - b.col : b.finalRow - a.finalRow);
  sortedNewCards.forEach(({ col, finalRow, fromAbove, card }) => {
    if (!card) return;
    const el = gridEl.querySelector(`[data-card-id="${card._id}"]`);
    if (!el) return;
    const minStart = Math.max(fromAbove, finalRow + 1);
    const fromY = -(minStart - finalRow) * CARD_STEP - cellTop(finalRow);
    const colBase = leaveMs + (col - minActiveCol) * COL_OFFSET;
    const entryStart = Math.max(colBase, colReadyAt[col] || colBase);
    colReadyAt[col] = entryStart + FALL_DUR * 0.6;
    myAnims.push(_fallLaunch(el, String(card._id), fromY, entryStart, FALL_DUR, true));
  });

  if (!myAnims.length) {
    // Nothing moved and nothing came (an empty deck, a bottom row played). The
    // board is at rest unless another fall is still in the air.
    if (!_cardFalls.size) { await new Promise(res => setTimeout(res, leaveMs)); if (!_cardFalls.size) _fallTail(); }
  } else {
    // allSettled, not all: a CANCELLED animation's `finished` REJECTS (a re-aim,
    // a screen change, a background tab), and a rejection here threw out of
    // removeAndFall with `falling` stuck true (r470).
    await Promise.allSettled(myAnims.map(a => a.finished));
  }

  // Match-3: the settled board may have created new matches (e.g. after the
  // player discarded). match3Resolve() self-guards, so a cascade already in
  // flight - which awaits this call - is unaffected.
  if (mode !== 'match3' && match3Active() && !roundEnded && !_cardFalls.size) match3Resolve();
}


// ══════════════════════════════════════════════
// SCORE FLASH
// ══════════════════════════════════════════════
