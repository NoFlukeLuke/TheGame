// ── The Anvil (r722, owner) ─────────────────────────────────────────────────
// The boss stone, renamed and given a job. It is still a stone card
// ({ rank '?', suit 'stone', _isStone }, makeStoneCard in js/boss.js), so every
// stone rule holds: it falls, renders and can be swapped, never selected, played
// or discarded by hand. What is new:
//   - every ANVIL_CFG.drop seconds it drops one row and crushes the card under
//     it (that card goes to the played pile, as a played card does);
//   - the card under it jitters for the last ANVIL_CFG.warn seconds, harder as
//     the drop nears (anvilPaint, `.anvil-doom` + `--doom` 0..1);
//   - at the bottom it rests ANVIL_CFG.rest seconds, then falls out of the
//     board and is gone (a boss's card; it never joins the deck).
// It waits on a card it cannot crush (another anvil, a challenge card, the
// Reshuffle card, a fixture). Timers live on the board card (`_anvT` seconds to
// the next drop, `_anvRest` seconds left at the bottom), so they ride gridData
// into a save and follow the anvil through a swap or a fall. Ticked once a
// second from the round tick (js/round-timers.js), acting only when the board
// is still (the r213 rule).
//
// Also here: the PIERCE rule (owner). A Sleight that discards cards takes the
// ones a curse or a boss holds in place: anvils, junk and curse cards, Snared
// and Recalled cards, held and quarantined cells. `pierceCanTake` is the test,
// `pierceRoute` where each one goes.
const ANVIL_CFG = { drop: 15, warn: 10, rest: 30 };
const ANVIL_ICON = '⚒';   // drawn as the pixel anvil (tools/icons/manifest.js, lorc/anvil)

function isAnvil(c) { return !!(c && c._isStone && c.suit === 'stone' && !c._junk && !c._isChallenge && !c._isReshuffle && !c._isTrick); }

// The next row down this anvil falls into (voids are skipped, as the fall skips
// them), or -1 at the bottom.
function anvilBelow(r, c) {
  for (let rr = r + 1; rr < gridRows; rr++) if (!isCellVoid(rr, c)) return rr;
  return -1;
}
// What an anvil can crush: any card but another anvil, a challenge card, the
// Reshuffle card, an aim fixture. An empty cell (a dry deck) it simply drops into.
function anvilCrushable(cd) {
  if (!cd) return true;
  if (isAnvil(cd) || cd._isChallenge || cd._isReshuffle || cd._isTrick) return false;
  if (cd._isSleight && typeof AIM_SLEIGHTS !== 'undefined' && AIM_SLEIGHTS.has(sleightDef(cd)?.id)) return false;
  return true;
}

function anvilTick() {
  if (typeof gridData === 'undefined' || !gridData || !gridData.length) return;
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return;   // Fight the Power holds them
  if (typeof mapScreenOpen === 'function' && mapScreenOpen()) return;
  const crush = [], out = [], drop = [];
  for (let r = gridRows - 1; r >= 0; r--) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!isAnvil(cd)) continue;
    const br = anvilBelow(r, c);
    if (br < 0) {
      cd._anvT = null;
      if (cd._anvRest == null) cd._anvRest = ANVIL_CFG.rest;
      if (cd._anvRest > 0) cd._anvRest--;
      if (cd._anvRest <= 0) out.push([r, c]);
      continue;
    }
    cd._anvRest = null;
    const v = gridData[br]?.[c];
    if (!anvilCrushable(v)) { cd._anvT = ANVIL_CFG.drop; continue; }
    if (cd._anvT == null) cd._anvT = ANVIL_CFG.drop;
    if (cd._anvT > 0) cd._anvT--;
    if (cd._anvT <= 0) (v ? crush : drop).push({ r, c, br, v });
  }
  const busy = animating || falling || (typeof roundEnded !== 'undefined' && roundEnded) || (typeof dealPhase !== 'undefined' && dealPhase);
  if (!busy && (crush.length || out.length || drop.length)) anvilStrike(crush, out, drop);
  anvilPaint();
}

function anvilStrike(crush, out, drop) {
  // An empty cell under it (the deck ran dry): it just moves down.
  drop.forEach(({ r, c, br }) => { const a = gridData[r][c]; gridData[br][c] = a; gridData[r][c] = null; a._anvT = ANVIL_CFG.drop; });
  const cells = [];
  crush.forEach(({ r, c, br, v }) => {
    anvilToPlayed(v);
    gridData[r][c]._anvT = ANVIL_CFG.drop;
    cells.push([br, c]);
  });
  out.forEach(([r, c]) => cells.push([r, c]));   // the anvil leaves the run
  if (typeof dbgEvent === 'function') dbgEvent('info', 'anvil', { crushed: crush.length, out: out.length });
  if (crush.length || out.length) { try { if (typeof sfxChallengeThud === 'function') sfxChallengeThud(); } catch (e) {} }
  if (cells.length) removeAndFall(cells, 'anvil');
  else render();
}

// A crushed card goes to the played pile, as a played card does. A card that
// refuses the pile's door (Snared, Recalled) is let through: being crushed is
// not a discard the curse can refuse.
function anvilToPlayed(cd) {
  if (!cd) return;
  if (cd._isSleight || cardCan(cd, 'discard')) { discardToPlayed(cd); return; }
  if (cd._temp) return;
  playedPile.push(recycleCard(cd)); updateDeckHud();
}

// The card under each anvil shakes in its last ANVIL_CFG.warn seconds. Run from
// the tick and from render()'s tail (render rewrites a card's class list).
function anvilPaint() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  const doomed = new Map();
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const a = gridData[r]?.[c];
    if (!isAnvil(a) || a._anvT == null || a._anvT > ANVIL_CFG.warn) continue;
    const br = anvilBelow(r, c), v = br >= 0 ? gridData[br]?.[c] : null;
    if (!v || !anvilCrushable(v)) continue;
    doomed.set(String(v._id), (ANVIL_CFG.warn + 1 - a._anvT) / (ANVIL_CFG.warn + 1));
  }
  gridEl.querySelectorAll('.anvil-doom').forEach(el => {
    if (doomed.has(el.dataset.cardId)) return;
    el.classList.remove('anvil-doom'); el.style.removeProperty('--doom');
  });
  doomed.forEach((k, id) => {
    const el = gridEl.querySelector(`[data-card-id="${id}"]`);
    if (!el) return;
    el.classList.add('anvil-doom');
    el.style.setProperty('--doom', k.toFixed(2));
  });
}

// The exit look of removeAndFall's 'anvil' mode: the crushed card is pressed
// flat into its cell; an anvil leaving drops out of the bottom of the board.
function anvilExit(el) {
  if (el.classList.contains('anvil-card')) {
    const h = el.offsetHeight || 80;
    el.style.zIndex = '20';
    el.animate([{ translate: '0 0', opacity: 1 }, { translate: `0 ${h * 1.6}px`, opacity: 1, offset: 0.8 }, { translate: `0 ${h * 2}px`, opacity: 0 }],
      { duration: 520, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' });
    return 560;
  }
  el.classList.remove('anvil-doom');
  el.style.transformOrigin = '50% 100%';
  el.animate([{ scale: '1 1', filter: 'brightness(1)', opacity: 1 }, { scale: '1.12 0.12', filter: 'brightness(.5)', opacity: 1, offset: 0.7 }, { scale: '1.2 0.04', filter: 'brightness(.3)', opacity: 0 }],
    { duration: 300, easing: 'cubic-bezier(.6,0,.9,.5)', fill: 'forwards' });
  return 340;
}

// ── PIERCE (r722, owner) ──
function pierceCanTake(cd, r, c) {
  if (!cd || cd._isChallenge || cd._isReshuffle || cd._isTrick) return false;
  if (typeof isCellVoid === 'function' && r != null && isCellVoid(r, c)) return false;
  if (cd._isSleight) return !(typeof AIM_SLEIGHTS !== 'undefined' && AIM_SLEIGHTS.has(sleightDef(cd)?.id));
  return !!(cd._isStone || cd.rank);
}
// Where a pierced card goes: an anvil is gone (it is the boss's), junk and curse
// cards and held, Snared or Recalled cards to the back of the draw pile (where a
// discard sends a card), a Sleight cycles with its charges.
function pierceRoute(cd) {
  if (!cd) return;
  if (isAnvil(cd)) return;
  if (cd._isSleight) { discardToPlayed(cd); return; }
  if (cd._temp) return;
  if (cardCan(cd, 'discard')) { discardToDrawPile(cd); return; }
  drawPile.push(recycleCard(cd)); updateDeckHud();
}

// ── Bomb (r722, owner): every card on the grid gains its pips (the Sleight's
// effect, applySleightGridEffect), then the WHOLE board goes with the discard:
// cards, Sleights, anvils, junk and curse cards. Called from doDiscard before
// anything is routed; returns the set of cards it carried (they cost no time or
// stock and are routed by pierceRoute).
function bombCarry() {
  const out = new Set(); out.procs = 0;
  const live = selected.filter(([r, c]) => { const cd = gridData[r]?.[c]; return cd && cd.sleightId === 'the_bomb' && (cd._usesLeft === 'infinite' || cd._usesLeft > 0); });
  if (!live.length) return out;
  out.procs = live.length;
  const inSel = new Set(selected.map(([r, c]) => r + '-' + c));
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const k = r + '-' + c, cd = gridData[r]?.[c];
    if (inSel.has(k) || !pierceCanTake(cd, r, c)) continue;
    inSel.add(k); selected.push([r, c]); out.add(cd);
  }
  return out;
}
