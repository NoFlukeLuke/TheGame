// ── Photocopier and Logistics Assistant (r647, owner) ───────────────────────
// Two double-tap Sleights that rearrange the board. Both are dispatched from
// onCardTap's double-tap branch (js/input.js) and leave through
// discardSleightAfterUse, which spends their charge (two, half the time, once
// a 5th improvement sets BAL[id].double_spend).

// ── Photocopier ─────────────────────────────────────────────────────────────
// Picks a card beside it (left or right) at random and makes BAL.photocopier.copies
// temp copies of it, rank, suit and buffs (copyCardBuffs). The copies replace the
// cards of its row left to right, then the nearest rows (below first) left to
// right; the cards they replace are discarded (back of the deck, counted as
// discards for Tricks, no time or stock: magnetCountDiscards). Copies that do not
// fit go into the deck. A wild is copied only while Stand-In is owned. The 5th
// improvement makes BAL.photocopier.permanent of them permanent.
function photocopierTakes(r, c) {
  if (isCellVoid(r, c) || isCellBlocked(r, c)) return false;
  const cd = gridData[r]?.[c];
  return !cd || (!!cd.rank && !cd._isSleight && !cd._isStone && !cd._isTrick && cardCan(cd, 'discard'));
}
function photocopierUse(card, r, c) {
  const dim = { color: 'var(--cream-dim)' };
  if (animating || falling || roundEnded) { refuse('Photocopier: let the board settle first', dim); return; }
  const wildOK = hasKnack('stand_in');
  const sides = [[r, c - 1], [r, c + 1]].filter(([sr, sc]) => {
    const cd = gridData[sr]?.[sc];
    return cd && cd.rank && !cd._isSleight && !cd._isStone && !cd._isTrick && !isCellBlocked(sr, sc) && (wildOK || !isWildCard(cd));
  });
  if (!sides.length) { refuse(wildOK ? 'Photocopier: no card beside it' : 'Photocopier: no card beside it to copy (a wild needs Stand-In)', dim); return; }
  const [sr, sc] = sides[Math.floor(Math.random() * sides.length)];
  const src = gridData[sr][sc];
  const rows = [r];
  for (let d = 1; d < gridRows; d++) { if (r + d < gridRows) rows.push(r + d); if (r - d >= 0) rows.push(r - d); }
  const cells = [];
  rows.forEach(rr => { for (let cc = 0; cc < gridCols; cc++) {
    if ((rr === r && cc === c) || (rr === sr && cc === sc)) continue;
    if (photocopierTakes(rr, cc)) cells.push([rr, cc]);
  } });
  const n = BAL.photocopier.copies, perm = BAL.photocopier.permanent || 0;
  const copies = [];
  for (let i = 0; i < n; i++) {
    const cp = makeTempCard(src.rank, src.suit);
    copyCardBuffs(src, cp);
    if (i < perm) { delete cp._temp; expectedDeckTotal++; }
    copies.push(cp);
  }
  const placed = cells.slice(0, copies.length);
  const gone = placed.map(([rr, cc]) => gridData[rr][cc]).filter(Boolean);
  selected = []; swapPending = null;
  if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  if (typeof cardStatesOnLeave === 'function') cardStatesOnLeave(placed.filter(([rr, cc]) => gridData[rr][cc]));
  gone.forEach(officeGhostToDiscard);
  placed.forEach(([rr, cc], i) => {
    const old = gridData[rr][cc];
    if (old) discardToDrawPile(old);
    gridData[rr][cc] = copies[i];
  });
  copies.slice(placed.length).forEach(cp => drawPile.splice(Math.floor(Math.random() * (drawPile.length + 1)), 0, cp));
  if (typeof magnetCountDiscards === 'function') magnetCountDiscards(gone);
  updateDeckHud();
  render();
  // The copies print in, one after another along the order they took.
  const gridEl = document.getElementById('grid');
  placed.forEach(([rr, cc], i) => {
    const el = gridEl?.querySelector(`[data-card-id="${gridData[rr][cc]._id}"]`);
    if (!el) return;
    el.animate([{ opacity: 0, transform: 'scale(1.25)', filter: 'brightness(2)' }, { opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' }],
      { duration: 260, delay: i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  });
  try { sfxFlipShuffle(); } catch (e) {}
  const extra = copies.length - placed.length;
  const name = isWildCard(src) ? 'a wild' : src.rank + (typeof cardColorSuit === 'function' ? cardColorSuit(src) : src.suit);
  noteMessage(`📠 Photocopier: ${copies.length} copies of ${name}${extra ? `, ${extra} into the deck` : ''}`);
  dbgEvent('info', 'photocopier', { src: name, placed: placed.length, deck: extra, permanent: perm });
  setTimeout(() => { if (gridData[r]?.[c] === card) discardSleightAfterUse(card, r, c); }, 260 + placed.length * 70);
}
// A ghost of a card leaving the board, flown to the DISCARD key (Dealer's Choice's look).
function officeGhostToDiscard(card) {
  const el = document.querySelector(`#grid [data-card-id="${card._id}"]`);
  if (!el) return;
  // Drawn at the board's zoom (r503's rule for a body-level copy of a card).
  const rc = el.getBoundingClientRect(), z = (rc.width / (el.offsetWidth || rc.width)) || 1, g = el.cloneNode(true);
  Object.assign(g.style, { position: 'fixed', left: rc.left / z + 'px', top: rc.top / z + 'px', width: el.offsetWidth + 'px', height: el.offsetHeight + 'px',
                           margin: 0, zIndex: 50, pointerEvents: 'none', transform: 'none', zoom: z });
  document.body.appendChild(g);
  const btn = document.getElementById('btn-discard')?.getBoundingClientRect();
  const dx = (btn ? (btn.left + btn.width / 2) - (rc.left + rc.width / 2) : 0) / z;
  const dy = (btn ? (btn.top + btn.height / 2) - (rc.top + rc.height / 2) : 120) / z;
  g.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.45) rotate(-16deg)`, opacity: 0 }],
    { duration: 480, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });
  setTimeout(() => g.remove(), 560);
}

// ── Logistics Assistant ─────────────────────────────────────────────────────
// Reads the board left to right (by column, then row) for swaps of two
// orthogonally adjacent cards that make a playable hand: the best hand either
// card can anchor after the swap beats the best it could anchor before. Each one
// found is made at once, through doSwap as a free swap (no stock, no time; it
// still counts as a swap for Tricks), then the scan carries on to the right on
// the board as it now is. The cards of each hand it makes are locked, so a
// later swap cannot undo it. At most BAL.logistics_assistant.max_swaps swaps.
// Then it discards itself; the 5th improvement also gives BAL.swaps swaps.
let _logRun = null;
const LOG_BUDGET = 400;   // shapes per anchored search (the sweep's search, smaller)
function logisticsRunning() { return !!_logRun; }
function logisticsReset() { _logRun = null; document.body.classList.remove('autoplay-loud'); }

// The best playable hand anchored on (r0,c0): { w, cells }, w 0 when none.
function _logBestFrom(r0, c0, usable, cap, allow, minN) {
  const key = cells => cells.map(([r, c]) => r * 100 + c).sort((a, b) => a - b).join(',');
  const seen = new Set();
  let best = null, bestW = 0, budget = LOG_BUDGET;
  const grow = cells => {
    if (budget-- <= 0) return;
    if (cells.length >= minN) {
      const k = key(cells);
      if (seen.has(k)) return;
      seen.add(k);
      const res = handComponentsFor(cells);
      if (res && res.playable) {
        const claimed = new Set();
        res.components.forEach(cp => cp.cells.forEach(([r, c]) => claimed.add(r + '-' + c)));
        const spare = cells.length - claimed.size;
        if (spare <= allow) {
          const w = res.components.reduce((s, cp) => s + handWorth(cp.name), 0) * (spare ? 0.8 : 1) + cells.length * 0.01;
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
  if (usable(r0, c0)) grow([[r0, c0]]);
  return { w: bestW, cells: best };
}
// The next swap at or after candidate index `from`, or null. Candidates are the
// pairs (r,c)-(r,c+1) and (r,c)-(r+1,c), ordered by column then row.
function logisticsNextSwap(locked, from) {
  const cap = Math.min(gridRows * gridCols > 30 ? 4 : 5, (limits.selection && limits.selection.current) || 3);
  const minN = Math.max(2, (typeof handMinSelection === 'function') ? handMinSelection() : 2);
  const allow = (typeof tagalongMax === 'function') ? tagalongMax() : 1;
  const open = (r, c) => r >= 0 && c >= 0 && r < gridRows && c < gridCols && !!gridData[r]?.[c] && !isCellBlocked(r, c);
  const usable = (r, c) => open(r, c) && cardCan(gridData[r][c], 'select') && !gridData[r][c]._isSleight;
  const movable = (r, c) => open(r, c) && !locked.has(r + '-' + c) && !gridData[r][c]._isSleight && !gridData[r][c]._isStone && cardCan(gridData[r][c], 'swap');
  const cands = [];
  for (let c = 0; c < gridCols; c++) for (let r = 0; r < gridRows; r++) {
    if (c + 1 < gridCols) cands.push([[r, c], [r, c + 1]]);
    if (r + 1 < gridRows) cands.push([[r, c], [r + 1, c]]);
  }
  const worth = (a, b) => {
    const x = _logBestFrom(a[0], a[1], usable, cap, allow, minN), y = _logBestFrom(b[0], b[1], usable, cap, allow, minN);
    return x.w >= y.w ? x : y;
  };
  for (let i = from; i < cands.length; i++) {
    const [a, b] = cands[i];
    if (!movable(a[0], a[1]) || !movable(b[0], b[1])) continue;
    const ca = gridData[a[0]][a[1]], cb = gridData[b[0]][b[1]];
    if (ca.rank === cb.rank && ca.suit === cb.suit) continue;   // the same face: nothing would change
    const before = worth(a, b);
    gridData[a[0]][a[1]] = cb; gridData[b[0]][b[1]] = ca;
    const after = worth(a, b);
    gridData[a[0]][a[1]] = ca; gridData[b[0]][b[1]] = cb;
    if (after.cells && after.w > before.w + 1e-6) return { a, b, hand: after.cells, next: i + 1 };
  }
  return null;
}
function logisticsStart(card, r, c) {
  if (_logRun) return;
  const dim = { color: 'var(--cream-dim)' };
  const busy = animating || falling || !!danceAbortController || roundEnded
    || (typeof dealerHand !== 'undefined' && dealerHand)
    || (typeof autopilotRunning === 'function' && autopilotRunning())
    || (typeof sweepRunning === 'function' && sweepRunning())
    || (typeof sleightSpinLock !== 'undefined' && sleightSpinLock);
  if (busy) { refuse('Logistics Assistant: let the board settle first', dim); return; }
  const first = logisticsNextSwap(new Set(), 0);
  if (!first) { refuse('Logistics Assistant: no swap makes a hand', dim); return; }
  _logRun = { card, at: [r, c], done: 0, locked: new Set() };
  selected = []; swapPending = null;
  if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  document.body.classList.add('autoplay-loud');
  spinSleightTile(r, c);
  _logRunSwaps(first).catch(e => { console.error(e); _logFinish(); });
}
async function _logRunSwaps(mv) {
  const run = _logRun;
  while (mv && _logRun === run && run.done < BAL.logistics_assistant.max_swaps) {
    const [a, b] = [mv.a, mv.b];
    sleightFreeSwapPending = true;
    const id1 = gridData[a[0]][a[1]]._id;
    doSwap(a[0], a[1], b[0], b[1]);
    if (gridData[b[0]]?.[b[1]]?._id !== id1) { sleightFreeSwapPending = false; break; }   // refused (a boss, say)
    run.done++;
    [a, b, ...mv.hand].forEach(([hr, hc]) => run.locked.add(hr + '-' + hc));
    await wait(((typeof cardSwapMs === 'function') ? cardSwapMs() : 220) + 60);
    _logFlash(mv.hand);
    await wait(320);
    if (_logRun !== run || roundEnded) break;
    mv = logisticsNextSwap(run.locked, mv.next);
  }
  _logFinish();
}
// The hand a swap made glows a beat, so the player sees what it was for.
function _logFlash(cells) {
  const gridEl = document.getElementById('grid');
  cells.forEach(([r, c]) => {
    const el = gridEl?.querySelector(`[data-card-id="${gridData[r]?.[c]?._id}"]`);
    if (el) el.animate([{ boxShadow: '0 0 0 0 rgba(143,208,255,0)' }, { boxShadow: '0 0 0 3px rgba(143,208,255,.95), 0 0 14px rgba(143,208,255,.8)' },
                        { boxShadow: '0 0 0 0 rgba(143,208,255,0)' }], { duration: 420, easing: 'ease-out' });
  });
  try { sfxCardSelectLoud(); } catch (e) {}
}
function _logFinish() {
  const run = _logRun;
  logisticsReset();
  if (!run) return;
  const g = BAL.logistics_assistant.swaps;
  if (g) { swaps += g; noteMessage(`🚚 Logistics Assistant: +${g} swaps`); }
  noteMessage(`🚚 Logistics Assistant: ${run.done} swap${run.done === 1 ? '' : 's'}`);
  dbgEvent('info', 'logistics', { swaps: run.done });
  let at = null;
  for (let r = 0; r < gridRows && !at; r++) for (let c = 0; c < gridCols; c++) if (gridData[r]?.[c] === run.card) { at = [r, c]; break; }
  if (at) discardSleightAfterUse(run.card, at[0], at[1]);
  else render();
}
