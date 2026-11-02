// ── The four horsemen (r723, owner) ──────────────────────────────────────────
// The curse cards are four: WAR is the boss stone (js/anvil.js, isAnvil: it drops
// a row every 15s and crushes the card under it), and three curse cards
// (CURSE_CARD_DEFS in js/boss.js, `_curseCard`): junk that cannot be selected or
// played and does something while it sits on the board.
//
//   DEATH (scythe): faces a direction. Every HM.death.timer seconds it flies that
//   way to the edge and every card on the way goes to the played pile (the deck
//   editor's cut look). It embeds where it stops (`_fixed`: the fall leaves it in
//   its cell, cards fall past it) and rolls a new direction. Before its first
//   flight it falls and can be swapped; after, neither. Never discarded by hand.
//
//   FAMINE: a 30s clock, reset by swapping it. At 0 one of: a swap or a discard
//   of stock, HM.famine.secs off the clock, a Trick muted for HM.famine.mute
//   seconds, every Sleight on the grid discarded (charges kept). Then it starts
//   again. Can be swapped, never discarded by hand.
//
//   PESTILENCE (draft, owner to settle): every HM.pest.swap seconds it changes
//   places with a random neighbour. A neighbour that has sat still beside it for
//   HM.pest.spread seconds is infected: that card goes to the played pile and a
//   TEMP Pestilence takes its cell (at most HM.pest.max on the board). One that
//   has not spread for HM.pest.life seconds leaves (a deck card to the played
//   pile, a temp one for good). Never swapped or discarded by hand.
//
// Timers live on the board card (`_hmT`, `_dir`, `_flown`, `_fixed`, `_hmSpread`,
// `_hmLast`), so they save with gridData and are dropped by recycleCard when the
// card leaves the board. `horsemenTick` runs from the round tick, counts every
// second and acts only while the board is still (the r213 rule). A boss-spawned
// horseman is `_temp` (never joins the deck, gone at the round's end).
//
// SEVERANCE PACKAGE (legendary Trick): double-tap any curse card or stone to
// discard it for BAL.severance_package.swaps swaps and .discards discards.
const HM = {
  death:  { timer: 30, warn: 5, flyMs: 240 },
  famine: { timer: 30, warn: 5, secs: 20, mute: 20 },
  pest:   { swap: 15, spread: 20, life: 65, max: 4 },
};
const HM_DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];   // up, right, down, left
const HM_ARROW = ['↑', '→', '↓', '←'];

function isHorseman(c) { return !!(c && c._curseCard && (c._curseCard === 'death' || c._curseCard === 'famine' || c._curseCard === 'pest')); }
function hmKind(c) { return isHorseman(c) ? c._curseCard : null; }
// A curse card the player may swap: Famine always, Death until its first flight.
function curseCardSwappable(c) {
  if (!c || !c._curseCard) return false;
  if (c._curseCard === 'famine') return true;
  if (c._curseCard === 'death') return !c._flown;
  return false;
}
// The fall leaves a fixed card in its cell (js/card-fall.js, fillGridHoles).
function cardFixedAt(r, c) { const cd = gridData[r]?.[c]; return !!(cd && cd._fixed); }

// Directions Death can fly from (r, c): at least one cell of room.
function hmDirsFrom(r, c) {
  const out = [];
  HM_DIRS.forEach(([dr, dc], i) => { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < gridRows && cc >= 0 && cc < gridCols && !isCellVoid(rr, cc)) out.push(i); });
  return out;
}
function hmRollDir(cd, r, c) {
  const dirs = hmDirsFrom(r, c);
  cd._dir = dirs.length ? dirs[Math.floor(Math.random() * dirs.length)] : Math.floor(Math.random() * 4);
}
// First sight of a card on the board: its timer and direction.
function hmEnsure(cd, r, c) {
  if (!isHorseman(cd)) return;
  if (cd._curseCard === 'death' && cd._dir == null) hmRollDir(cd, r, c);
  if (cd._hmT == null) cd._hmT = cd._curseCard === 'death' ? HM.death.timer : cd._curseCard === 'famine' ? HM.famine.timer : HM.pest.swap;
  if (cd._curseCard === 'pest' && cd._hmSpread == null) cd._hmSpread = 0;
}

function horsemenTick() {
  if (typeof gridData === 'undefined' || !gridData || !gridData.length) return;
  if (typeof mapScreenOpen === 'function' && mapScreenOpen()) return;
  const busy = animating || falling || (typeof roundEnded !== 'undefined' && roundEnded) || (typeof dealPhase !== 'undefined' && dealPhase);
  const fires = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!isHorseman(cd)) continue;
    hmEnsure(cd, r, c);
    if (cd._hmT > 0) cd._hmT--;
    if (cd._curseCard === 'pest') { cd._hmSpread++; pestWatch(cd, r, c); }
    if (cd._hmT <= 0) fires.push([r, c, cd]);
  }
  famineMuteTick();
  if (!busy) {
    for (const [r, c, cd] of fires) {
      if (gridData[r]?.[c] !== cd) continue;   // an earlier strike moved it
      if (cd._curseCard === 'death') { if (deathFly(r, c)) return; }
      else if (cd._curseCard === 'famine') famineFire(r, c);
      else if (cd._curseCard === 'pest') { if (pestAct(r, c)) return; }
    }
  }
  horsemenPaint();
}

// Every face's clock bar and jitter, written in place (render rebuilds faces).
function horsemenPaint() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!isHorseman(cd)) continue;
    const el = gridEl.querySelector(`[data-card-id="${cd._id}"]`);
    if (!el) continue;
    const bar = el.querySelector('.hm-bar');
    if (bar) bar.style.setProperty('--hb', hmBarFrac(cd).toFixed(3));
    el.classList.toggle('hm-jit', hmJittering(cd));
  }
}
function hmBarFrac(cd) {
  const full = cd._curseCard === 'death' ? HM.death.timer : cd._curseCard === 'famine' ? HM.famine.timer : HM.pest.swap;
  return Math.max(0, Math.min(1, (cd._hmT == null ? full : cd._hmT) / full));
}
function hmJittering(cd) {
  if (cd._hmT == null) return false;
  if (cd._curseCard === 'death') return cd._hmT <= HM.death.warn;
  if (cd._curseCard === 'famine') return cd._hmT <= HM.famine.warn;
  return false;
}

// The face (renderCardAppearance, js/card-fall.js). A clock bar drains behind the
// icon; Death's scythe spins (CSS) with an arrow for its direction.
function horsemenFaceHTML(cd) {
  const d = CURSE_CARD_DEFS[cd._curseCard];
  const k = cd._curseCard;
  const bar = `<div class="hm-bar" style="--hb:${hmBarFrac(cd).toFixed(3)}"></div>`;
  const arrow = k === 'death' ? `<div class="hm-arrow hm-d${cd._dir ?? 0}">${HM_ARROW[cd._dir ?? 0]}</div>` : '';
  return `${bar}<div class="hm-ico">${emGlyph(d.icon)}</div>${arrow}<div class="hm-word">${d.name.toUpperCase()}</div>`;
}
function horsemenFaceClass(cd) {
  return ` hm-card hm-${cd._curseCard}${cd._flown ? ' hm-stuck' : ''}${hmJittering(cd) ? ' hm-jit' : ''}`;
}

// ── DEATH ──
// Flies from (r, c) in its direction. Every card on the way to the edge goes to
// the played pile; a card it cannot take (another horseman, a challenge card,
// the Reshuffle card, a fixture) stops it short. Returns true when it flew.
function deathFly(r, c) {
  const cd = gridData[r][c];
  const [dr, dc] = HM_DIRS[cd._dir] || HM_DIRS[0];
  const crushed = []; let fr = r, fc = c;
  for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < gridRows && cc >= 0 && cc < gridCols; rr += dr, cc += dc) {
    if (isCellVoid(rr, cc)) break;
    const v = gridData[rr][cc];
    if (v && (!anvilCrushable(v) || v._fixed)) break;
    fr = rr; fc = cc; if (v) crushed.push([rr, cc]);
  }
  if (fr === r && fc === c) { hmRollDir(cd, r, c); cd._hmT = HM.death.timer; return false; }
  const gridEl = document.getElementById('grid');
  const cards = crushed.map(([rr, cc]) => gridData[rr][cc]);
  // The boss's rule: a card the scythe takes costs half its rank in seconds.
  const secs = deathBossSeconds(cards);
  // The cut cards leave through the deck editor's cut look; they lose their id first
  // so render() neither moves nor keeps them (removeAndFall's own rule).
  const els = [];
  crushed.forEach(([rr, cc]) => {
    const v = gridData[rr][cc];
    const el = gridEl?.querySelector(`[data-card-id="${v._id}"]`);
    if (el) { const live = _cardFalls.get(String(v._id)); if (live) { try { live.anim.cancel(); } catch (e) {} _cardFalls.delete(String(v._id)); }
      el.removeAttribute('data-card-id'); el.removeAttribute('data-row'); el.removeAttribute('data-col'); el.classList.add('card-leaving'); el.style.pointerEvents = 'none'; els.push(el); }
    anvilToPlayed(v);
    gridData[rr][cc] = null;
  });
  if (typeof cardStatesOnLeave === 'function') try { cardStatesOnLeave(crushed); } catch (e) {}
  if (selected.length) selected = selected.filter(([sr, sc]) => !crushed.some(([rr, cc]) => rr === sr && cc === sc));
  // Where it was drawn, before the data moves it.
  const oldLeft = cellLeft(c) + cardColOffset(c), oldTop = cellTop(r) + cardRowOffset(r);
  gridData[r][c] = null;
  gridData[fr][fc] = cd;
  cd._flown = true; cd._fixed = true;
  hmRollDir(cd, fr, fc); cd._hmT = HM.death.timer;
  if (typeof dbgEvent === 'function') dbgEvent('info', 'death flew', { from: [r, c], to: [fr, fc], cut: crushed.length, secs });
  try { if (typeof sfxChallengeSlap === 'function') sfxChallengeSlap(); } catch (e) {}
  // The flight: render puts it on its new cell, then it is flipped back and flown.
  removeAndFall([], 'anvil');
  const el = gridEl?.querySelector(`[data-card-id="${cd._id}"]`);
  if (el) {
    const dx = oldLeft - (cellLeft(fc) + cardColOffset(fc)), dy = oldTop - (cellTop(fr) + cardRowOffset(fr));
    el.style.zIndex = '25';
    const a = el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: HM.death.flyMs, easing: 'cubic-bezier(.5,0,.9,.4)' });
    a.onfinish = () => { el.style.zIndex = ''; };
  }
  if (els.length) {
    const p = (typeof cardAnimExit === 'function') ? cardAnimExit('cut', els, null) : Promise.resolve();
    Promise.resolve(p).catch(() => {}).then(() => els.forEach(e => e.remove()));
    setTimeout(() => els.forEach(e => e.remove()), 2400);
  }
  if (secs > 0) { roundSeconds = Math.max(1, roundSeconds - secs); showTimeCost(`-${secs}s`); updateClockUI(); }
  return true;
}
// THE REAPER (js/data/bosses.js, modifier inject_death): the cards the scythe takes cost half their rank in seconds.
function deathBossSeconds(cards) {
  if (typeof bossActive === 'undefined' || !bossActive || !currentBoss || !(currentBoss.modifiers || []).includes('inject_death')) return 0;
  if (typeof bossEffectsIgnored === 'function' && bossEffectsIgnored()) return 0;
  let s = 0;
  cards.forEach(v => { if (v && v.rank && !v._isSleight && !v._isStone && typeof rankHighVal === 'function') s += rankHighVal(v.rank) / 2; });
  return Math.round(s);
}

// ── FAMINE ──
let famineMuted = {};   // trick id -> seconds of mute left (js/boss.js isTrickDisabledByBoss reads it)
function famineMuteTick() {
  let changed = false;
  for (const id in famineMuted) { famineMuted[id]--; if (famineMuted[id] <= 0) { delete famineMuted[id]; changed = true; } }
  if (changed && typeof renderTrickTray === 'function') renderTrickTray();
}
function famineMutedTrick(id) { return !!famineMuted[id]; }
function famineFire(r, c) {
  const cd = gridData[r][c];
  cd._hmT = HM.famine.timer;
  const can = [];
  if (swaps > 0 || discards > 0) can.push('stock');
  can.push('time');
  const live = (trickTray || []).filter(t => t && !famineMuted[t.id]);
  if (live.length) can.push('trick');
  const sl = [];
  for (let rr = 0; rr < gridRows; rr++) for (let cc = 0; cc < gridCols; cc++) { const v = gridData[rr]?.[cc]; if (v && v._isSleight && pierceCanTake(v, rr, cc)) sl.push([rr, cc]); }
  if (sl.length) can.push('sleights');
  const pick = can[Math.floor(Math.random() * can.length)];
  const d = CURSE_CARD_DEFS.famine;
  if (pick === 'stock') {
    const both = swaps > 0 && discards > 0, takeSwap = both ? Math.random() < 0.5 : swaps > 0;
    if (takeSwap) { swaps--; showMessage(`${d.icon} Famine: -1 swap`, 'var(--red)'); } else { discards--; showMessage(`${d.icon} Famine: -1 discard`, 'var(--red)'); }
    render();
  } else if (pick === 'time') {
    roundSeconds = Math.max(1, roundSeconds - HM.famine.secs); showTimeCost(`-${HM.famine.secs}s`); updateClockUI();
    showMessage(`${d.icon} Famine: -${HM.famine.secs}s`, 'var(--red)');
  } else if (pick === 'trick') {
    const t = live[Math.floor(Math.random() * live.length)];
    famineMuted[t.id] = HM.famine.mute;
    showMessage(`${d.icon} Famine: ${t.name} is off for ${HM.famine.mute}s`, 'var(--red)');
    if (typeof renderTrickTray === 'function') renderTrickTray();
  } else if (pick === 'sleights') {
    sl.forEach(([rr, cc]) => pierceRoute(gridData[rr][cc]));
    showMessage(`${d.icon} Famine: ${sl.length} Sleight${sl.length > 1 ? 's' : ''} discarded`, 'var(--red)');
    removeAndFall(sl, 'discard');
  }
  if (typeof dbgEvent === 'function') dbgEvent('info', 'famine', { pick });
  try { if (typeof sfxChallengeThud === 'function') sfxChallengeThud(); } catch (e) {}
}
// A swap by the player resets Famine's clock (doSwap, js/input.js).
function horsemenOnSwap(cells) {
  (cells || []).forEach(([r, c]) => { const cd = gridData[r]?.[c]; if (cd && cd._curseCard === 'famine') cd._hmT = HM.famine.timer; });
}

// ── PESTILENCE ──
// Each neighbour's time sat still beside this card, by card id (board-local).
function pestWatch(cd, r, c) {
  const w = cd._hmLast || (cd._hmLast = {});
  const seen = new Set();
  HM_DIRS.forEach(([dr, dc]) => {
    const rr = r + dr, cc = c + dc, v = gridData[rr]?.[cc];
    if (!v || !v.rank || v._isStone || v._isSleight || v._isTrick || isCellBlocked(rr, cc)) return;
    const k = String(v._id); seen.add(k);
    const pos = rr * 1000 + cc;
    if (!w[k] || w[k].pos !== pos) w[k] = { pos, secs: 0 };
    w[k].secs++;
  });
  for (const k in w) if (!seen.has(k)) delete w[k];
}
function pestCount() { let n = 0; for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (gridData[r]?.[c]?._curseCard === 'pest') n++; return n; }
// Its moment: spread onto a neighbour that sat still long enough, else swap with a
// neighbour; leave after HM.pest.life seconds without a spread. Returns true when
// the board moved (a fall started).
function pestAct(r, c) {
  const cd = gridData[r][c];
  cd._hmT = HM.pest.swap;
  const d = CURSE_CARD_DEFS.pest;
  // Spread.
  const w = cd._hmLast || {};
  const ripe = [];
  HM_DIRS.forEach(([dr, dc]) => { const rr = r + dr, cc = c + dc, v = gridData[rr]?.[cc]; if (v && w[String(v._id)] && w[String(v._id)].secs >= HM.pest.spread && anvilCrushable(v) && !v._isStone) ripe.push([rr, cc]); });
  if (ripe.length && pestCount() < HM.pest.max) {
    const [rr, cc] = ripe[Math.floor(Math.random() * ripe.length)];
    const v = gridData[rr][cc];
    anvilToPlayed(v);
    const nc = makeCurseCard('pest'); nc._temp = true;
    gridData[rr][cc] = nc; hmEnsure(nc, rr, cc);
    cd._hmSpread = 0; delete w[String(v._id)];
    showMessage(`${d.icon} Pestilence spreads`, 'var(--red)');
    if (typeof dbgEvent === 'function') dbgEvent('info', 'pestilence spread', { at: [rr, cc] });
    render();
    const el = document.querySelector(`#grid [data-card-id="${nc._id}"]`);
    if (el) el.animate([{ scale: '1.25', filter: 'brightness(2.2)' }, { scale: '1', filter: 'brightness(1)' }], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
    try { if (typeof sfxChallengeTap === 'function') sfxChallengeTap(); } catch (e) {}
    return false;
  }
  // Leave.
  if (cd._hmSpread >= HM.pest.life) {
    if (!cd._temp) playedPile.push(recycleCard(cd));
    gridData[r][c] = null;
    showMessage(`${d.icon} Pestilence leaves`, 'var(--cream-dim)');
    removeAndFall([], 'anvil');
    return true;
  }
  // Swap places with a neighbour.
  const near = [];
  HM_DIRS.forEach(([dr, dc]) => { const rr = r + dr, cc = c + dc, v = gridData[rr]?.[cc]; if (v && !v._fixed && !v._isChallenge && !v._isReshuffle && !v._isTrick && !isCellBlocked(rr, cc) && !isCellVoid(rr, cc) && !(v._isSleight && AIM_SLEIGHTS.has(sleightDef(v)?.id))) near.push([rr, cc]); });
  if (!near.length) return false;
  const [rr, cc] = near[Math.floor(Math.random() * near.length)];
  const v = gridData[rr][cc];
  const dx = cellLeft(cc) + cardColOffset(cc) - cellLeft(c) - cardColOffset(c);
  const dy = cellTop(rr) + cardRowOffset(rr) - cellTop(r) - cardRowOffset(r);
  gridData[r][c] = v; gridData[rr][cc] = cd;
  // The watch follows the card: the neighbour it just changed places with is not "still".
  if (cd._hmLast) delete cd._hmLast[String(v._id)];
  selected = selected.map(([sr, sc]) => (sr === r && sc === c) ? [rr, cc] : (sr === rr && sc === cc) ? [r, c] : [sr, sc]);
  if (swapPending && swapPending[0] === rr && swapPending[1] === cc) swapPending = [r, c];
  render();
  const g = document.getElementById('grid');
  const e1 = g?.querySelector(`[data-card-id="${cd._id}"]`), e2 = g?.querySelector(`[data-card-id="${v._id}"]`);
  if (e1 && e2 && typeof cardAnimSwap === 'function') cardAnimSwap(e1, e2, dx, dy);
  return false;
}

// ── SEVERANCE PACKAGE (legendary Trick) ──
// Double-tap a curse card or a stone: spend the swaps and discards, it is discarded.
let _sevLast = null;
function severanceTap(r, c) {
  if (typeof hasTrick !== 'function' || !hasTrick('severance_package')) return false;
  const cd = gridData[r]?.[c];
  if (!cd || !cd._isStone || cd._isChallenge || cd._isReshuffle) return false;
  const now = Date.now();
  const dbl = _sevLast && _sevLast.r === r && _sevLast.c === c && _sevLast.id === cd._id && (now - _sevLast.t) < (typeof DOUBLE_TAP_MS !== 'undefined' ? DOUBLE_TAP_MS : 350);
  _sevLast = dbl ? null : { r, c, id: cd._id, t: now };
  if (!dbl) return false;
  const B = BAL.severance_package;
  if (animating || falling || (typeof roundEnded !== 'undefined' && roundEnded)) { refuse('Severance Package: let the board settle first'); return true; }
  if (swaps < B.swaps || discards < B.discards) { refuse(`Severance Package needs ${B.swaps} swap and ${B.discards} discard`); return true; }
  swaps -= B.swaps; discards -= B.discards;
  const name = cd._curseCard ? CURSE_CARD_DEFS[cd._curseCard]?.name : isAnvil(cd) ? 'War' : 'junk';
  pierceRoute(cd);
  selected = selected.filter(([sr, sc]) => !(sr === r && sc === c));
  if (swapPending && swapPending[0] === r && swapPending[1] === c) swapPending = null;
  showMessage(`Severance Package: ${name} discarded`, 'var(--gold)');
  if (typeof trayFxTrigger === 'function') try { trayFxTrigger('severance_package'); } catch (e) {}
  if (typeof ulBump === 'function') ulBump('discards', 1);
  removeAndFall([[r, c]], 'discard');
  return true;
}

// ── The bosses' spawns (js/boss.js applyBossModifiers) ──
// A horseman placed by a boss is TEMP: it never joins the deck and goes at the round's end.
function hmSpawnAt(kind, r, c) {
  const old = gridData[r]?.[c];
  if (old && old.rank) { if (old._isSleight) discardToPlayed(old); else if (!old._isStone) discardToDrawPile(old); }
  const nc = makeCurseCard(kind); nc._temp = true;
  gridData[r][c] = nc; hmEnsure(nc, r, c);
  return nc;
}
function hmFreeCells(opts = {}) {
  const out = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const v = gridData[r]?.[c];
    if (!v || !v.rank || v._isSleight || v._isTrick || v._isStone || isCellBlocked(r, c) || isCellVoid(r, c)) continue;
    if (opts.notSelected && selected.some(([sr, sc]) => sr === r && sc === c)) continue;
    out.push([r, c]);
  }
  return out;
}
// One horseman on a random live cell. From a boss tick: only while the board is still.
function hmSpawnRandom(kind) {
  if (animating || falling) return false;
  const cells = hmFreeCells({ notSelected: true });
  if (!cells.length) return false;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  const nc = hmSpawnAt(kind, r, c);
  render();
  const el = document.querySelector(`#grid [data-card-id="${nc._id}"]`);
  if (el) el.animate([{ scale: '1.3', filter: 'brightness(2.4)', opacity: 0 }, { scale: '1', filter: 'brightness(1)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  showMessage(`${CURSE_CARD_DEFS[kind].icon} ${CURSE_CARD_DEFS[kind].name} lands`, 'var(--red)');
  return true;
}
// Pestilence's opening: two, in opposite corners (the nearest free cells to them).
function hmSpawnCorners(kind) {
  const cells = hmFreeCells();
  if (!cells.length) return;
  const pairs = [[[0, 0], [gridRows - 1, gridCols - 1]], [[0, gridCols - 1], [gridRows - 1, 0]]];
  const [a, b] = pairs[Math.floor(Math.random() * 2)];
  const near = (t, taken) => cells.filter(x => !taken.some(y => y[0] === x[0] && y[1] === x[1])).sort((p, q) => (Math.abs(p[0] - t[0]) + Math.abs(p[1] - t[1])) - (Math.abs(q[0] - t[0]) + Math.abs(q[1] - t[1])))[0];
  const ca = near(a, []); if (!ca) return;
  const cb = near(b, [ca]);
  hmSpawnAt(kind, ca[0], ca[1]); if (cb) hmSpawnAt(kind, cb[0], cb[1]);
  render();
}
