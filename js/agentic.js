// ═══════════════════════════════════════════════════════════════════════════
// AGENTIC (r801, owner) - a protocol of Flow and the Schedule
// ═══════════════════════════════════════════════════════════════════════════
// "Basically everything works the same in terms of progression, but hands auto
// play when in straight lines when found... You can still play other hands
// manually."
//
// - A LINE is 3 or more cards side by side in one row or one column, up to the
//   Selection Size, that make a real hand with every card in it (handComponentsFor:
//   the game's own rules, so only hands you could play yourself; no kickers).
//   Sleights, stones and curse cards break a line.
// - When the board is free and nothing is selected, the best line on it is
//   played by a quiet cascade (js/cascade.js: picked, hit, flown to the preview,
//   the board falls). Lines the fall makes go on in the same cascade.
// - THE CHAIN (r802, owner): "when plays cascade, that's what increases the focus
//   application, but every other hand. So first one is normal, second hand gets
//   focus twice, third twice, fourth three" and so on. A chain is the line hands
//   played one after another with nothing done by the player in between: it
//   starts over after a hand played by hand, a swap, a discard, a cancelled
//   wait, or a still board with no line left. Hand n of a chain applies Focus
//   floor(n / 2) more times (focusExtraApplies reads agenticFocusExtra). A line
//   that waits its 1.5s is still part of the chain. A line's hand makes its own
//   Focus, but no speed bonus.
// - Winning a run of Agentic unlocks the Trick Employee of the Month (below).
// - THE WAIT (owner): "when your hand size is more than the size of a found valid
//   hand, it waits for 1.5 seconds before playing, clicking or tapping anywhere
//   during that cancels the autoplay." The line is ringed with a draining bar;
//   a pointerdown or a key anywhere cancels it, and that line is left alone
//   (declined) for as long as its cards sit where they are. Settings -> Controls
//   -> Protocol: Agentic turns the wait off: every line plays at once.
// The wait is NOT part of the cascade: the board stays the player's through it,
// so the tap that cancels is also an ordinary tap.
// ═══════════════════════════════════════════════════════════════════════════

const AGENTIC = {
  minLen: 3,          // a line needs this many cards
  waitMs: 1500,       // a line shorter than the Selection Size waits this long
  settleMs: 220,      // the board is free this long before a line goes
  watchMs: 100,       // how often the board is looked at
  chainEvery: 2,      // every this many hands of a chain, Focus applies one more time
  color: '#5ad1c6',
};

function agenticOn() { return !!ACTIVE_MODE && ACTIVE_MODE.agentic === true; }
function agenticSay() {
  const a = n => 1 + agenticChainExtra(n);
  return `${AGENTIC.minLen} or more cards side by side in a row or column that make a hand play themselves. In a chain the 2nd and 3rd apply Focus ${a(2)} times, the 4th and 5th ${a(4)} times. A hand smaller than your ${agenticSizeWord()} waits ${AGENTIC.waitMs / 1000}s: tap to cancel.`;
}
function agenticSizeWord() { const d = (typeof LIMITS_DEF !== 'undefined') && LIMITS_DEF.find(x => x.id === 'selection'); return (d && d.label) || 'Selection Size'; }

let _agPlaying = false;         // inside playHand for a line's hand
let _agWait = null;             // { cells, ids, key, left, el } while a line waits
let _agDeclined = new Set();    // lines the player cancelled, by cells and card ids
let _agSince = 0, _agLast = 0, _agSig = '', _agFound = null;
let _agChain = 0;               // line hands played so far in the chain

function agenticPlaying() { return _agPlaying; }
// Hand n of a chain applies Focus this many EXTRA times: 0, 1, 1, 2, 2, 3...
function agenticChainExtra(n) { return Math.max(0, Math.floor(n / AGENTIC.chainEvery)); }
function agenticChainNext() { return _agChain + 1; }
function agenticFocusExtra() { return _agPlaying ? agenticChainExtra(agenticChainNext()) : 0; }
function agenticWaitOn() { return !(typeof SETTINGS !== 'undefined' && SETTINGS && SETTINGS.agenticWait === false); }
function agenticWaits(cells) { return agenticWaitOn() && ((limits.selection && limits.selection.current) || 3) > cells.length; }

// ── Finding the line ───────────────────────────────────────────────────────
function _agUsable(r, c) {
  const cd = gridData[r]?.[c];
  return !!cd && !!cd.rank && !cd._isSleight && !cd._isStone && !cd._curseCard
    && cardCan(cd, 'select') && !isCellBlocked(r, c);
}
function _agIds(cells) { return cells.map(([r, c]) => gridData[r]?.[c]?._id); }
function _agKey(cells) { return cells.map(([r, c]) => r + '-' + c + ':' + (gridData[r]?.[c]?._id)).join('|'); }
// The best line on the board that was not declined: the most valuable hand, then the longest.
function agenticFind() {
  const cap = Math.max(AGENTIC.minLen, (limits.selection && limits.selection.current) || 3);
  const minN = Math.max(AGENTIC.minLen, (typeof handMinSelection === 'function') ? handMinSelection() : 2);
  let best = null, bestW = -1;
  const consider = cells => {
    if (_agDeclined.has(_agKey(cells))) return;
    const res = handComponentsFor(cells);
    if (!res || !res.playable) return;
    const claimed = new Set();
    res.components.forEach(cp => cp.cells.forEach(cl => claimed.add(cl[0] + '-' + cl[1])));
    if (claimed.size !== cells.length) return;   // every card of the line is in the hand
    const w = res.components.reduce((s, cp) => s + handWorth(cp.name), 0) + cells.length * 0.01;
    if (w > bestW) { bestW = w; best = cells; }
  };
  const walk = (n, m, at) => {   // n lines of m cells; at(i, j) is the cell
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const cells = [];
      for (let k = j; k < m && cells.length < cap; k++) {
        const [r, c] = at(i, k);
        if (!_agUsable(r, c)) break;
        cells.push([r, c]);
        if (cells.length >= minN) consider(cells.map(x => [...x]));
      }
    }
  };
  walk(gridRows, gridCols, (i, k) => [i, k]);
  walk(gridCols, gridRows, (i, k) => [k, i]);
  return best;
}
// The search is repeated only when the board (cards and their faces: a rank can change in place),
// the declined lines or the Selection Size change.
function _agFindCached() {
  let sig = gridRows + 'x' + gridCols + '/' + ((limits.selection && limits.selection.current) || 3) + '/' + _agDeclined.size + '/' + agenticWaitOn();
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) { const cd = gridData[r]?.[c]; sig += ',' + (cd ? cd._id + cd.rank + cd.suit + (cd.rank2 || '') + (cd.suit2 || '') : '') + (isCellBlocked(r, c) ? 'b' : ''); }
  if (sig !== _agSig) { _agSig = sig; _agFound = agenticFind(); }
  return _agFound;
}

// ── When the board is free ─────────────────────────────────────────────────
function _agFree() {
  if (typeof roundEnded === 'undefined' || roundEnded) return false;
  if (animating || falling || isPaused || gameTimerPaused) return false;
  if (typeof dealPhase !== 'undefined' && dealPhase) return false;
  if (typeof sleightSpinLock !== 'undefined' && sleightSpinLock) return false;
  if (selected.length || swapPending) return false;
  if (typeof dealerHand !== 'undefined' && dealerHand) return false;   // cards held on the cursor
  if (typeof cascadeRunning === 'function' && cascadeRunning()) return false;
  if (typeof dncQueueFull === 'function' && dncQueueFull()) return false;
  if (typeof improveAnimRunning === 'function' && improveAnimRunning()) return false;
  if (typeof flowBossFighting !== 'undefined' && flowBossFighting && !bossActive) return false;
  if (typeof bossJumpRunning === 'function' && bossJumpRunning()) return false;
  if (typeof middleManRoundLive === 'function' && !middleManRoundLive()) return false;   // no screen between rounds
  return true;
}

function agenticTick() {
  const now = performance.now(), dt = Math.min(400, now - (_agLast || now));
  _agLast = now;
  if (!agenticOn()) { if (_agWait) _agWaitDrop(); _agChain = 0; return; }
  if (typeof roundEnded !== 'undefined' && roundEnded) _agChain = 0;
  if (_agWait) {
    const w = _agWait;
    if (w.cells.some(([r, c], i) => gridData[r]?.[c]?._id !== w.ids[i]) || roundEnded) { _agWaitDrop(); return; }   // the line is gone
    if (selected.length || swapPending) { agenticCancel(); return; }
    if (!_agFree()) return;   // held: the pause menu, a tip over the board, a fall
    w.left -= dt;
    if (w.el) w.el.style.setProperty('--ag-p', Math.max(0, w.left / AGENTIC.waitMs).toFixed(3));
    if (w.left <= 0) { const cells = w.cells; _agWaitDrop(); _agGo(cells); }
    return;
  }
  if (!_agFree()) { _agSince = 0; return; }
  if (!_agSince) { _agSince = now; return; }
  if (now - _agSince < AGENTIC.settleMs) return;
  const cells = _agFindCached();
  if (!cells) { _agChain = 0; return; }   // a still board with no line: the chain is over
  _agSince = 0;
  if (agenticWaits(cells)) _agWaitStart(cells); else _agGo(cells);
}

// ── The wait ───────────────────────────────────────────────────────────────
function _agCardEl(cell) {
  const cd = gridData[cell[0]]?.[cell[1]]; if (!cd) return null;
  return document.getElementById('grid')?.querySelector(`[data-card-id="${cd._id}"]`) || null;
}
function _agWaitStart(cells) {
  const g = document.getElementById('grid'); if (!g) return;
  const w = _agWait = { cells, ids: _agIds(cells), key: _agKey(cells), left: AGENTIC.waitMs, el: null };
  const els = cells.map(_agCardEl).filter(Boolean);
  if (els.length) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    els.forEach(el => { x0 = Math.min(x0, el.offsetLeft); y0 = Math.min(y0, el.offsetTop); x1 = Math.max(x1, el.offsetLeft + el.offsetWidth); y1 = Math.max(y1, el.offsetTop + el.offsetHeight); });
    const d = document.createElement('div'); d.id = 'ag-wait';
    d.style.cssText = `left:${x0 - 4}px;top:${y0 - 4}px;width:${x1 - x0 + 8}px;height:${y1 - y0 + 8}px;--ag-p:1;--ag-c:${AGENTIC.color};`;
    d.innerHTML = '<div class="ag-word">AUTO · TAP TO CANCEL</div><div class="ag-bar"><i></i></div>';
    g.appendChild(d); w.el = d;
  }
  agenticPaint();
  try { if (typeof sfxCascadePick === 'function') sfxCascadePick(0); } catch (e) {}
  document.addEventListener('pointerdown', _agOnInput, true);
  document.addEventListener('keydown', _agOnInput, true);
  dbgEvent('info', 'agentic: a line of ' + cells.length + ' waits');
}
function _agOnInput() { agenticCancel(); }
function _agWaitDrop() {
  const w = _agWait; _agWait = null;
  document.removeEventListener('pointerdown', _agOnInput, true);
  document.removeEventListener('keydown', _agOnInput, true);
  if (w && w.el) w.el.remove();
  document.querySelectorAll('#grid .ag-pending').forEach(el => el.classList.remove('ag-pending'));
}
// A click, a tap or a key anywhere: the line is not played, and is left alone.
function agenticCancel() {
  const w = _agWait; if (!w) return;
  _agDeclined.add(w.key);
  if (_agDeclined.size > 200) _agDeclined = new Set([w.key]);
  _agWaitDrop();
  _agChain = 0;
  try { if (typeof sfxKeyClick === 'function') sfxKeyClick('up'); } catch (e) {}
  if (typeof noteMessage === 'function') noteMessage('Auto-play cancelled');
  dbgEvent('info', 'agentic: wait cancelled');
}
// From render()'s tail: the waiting line keeps its ring through a redraw.
function agenticPaint() {
  const w = _agWait; if (!w) return;
  w.cells.forEach(cell => { const el = _agCardEl(cell); if (el) el.classList.add('ag-pending'); });
}

// ── Playing it: a quiet cascade ────────────────────────────────────────────
function _agGo(first) {
  if (typeof cascadeStart !== 'function') return;
  const ids = _agIds(first);
  let cur = null;
  cascadeStart({
    name: 'agentic', title: 'AGENTIC', color: AGENTIC.color, quiet: true,
    next: k => {
      if (!agenticOn()) return null;
      if (k === 1 && first.every(([r, c], i) => gridData[r]?.[c]?._id === ids[i])) return (cur = first);
      const cells = agenticFind();
      // A short line found mid-cascade ends it: the watcher gives it its wait.
      return (cur = (cells && !agenticWaits(cells)) ? cells : null);
    },
    // A line the game refused to play is left alone, or the watcher would find it again for ever.
    after: (k, played) => { if (!played && cur) { _agDeclined.add(_agKey(cur)); return false; } },
    tag: () => `AGENTIC · CHAIN ${agenticChainNext()}`,
    label: () => { const x = agenticChainExtra(agenticChainNext()); return x ? `FOCUS x${1 + x}` : `CHAIN ${agenticChainNext()}`; },
    play: () => { _agPlaying = true; try { playHand(); } finally { _agPlaying = false; } },
    end: () => { _agSince = 0; _agSig = ''; },
  });
}

// A new run (startGame).
function agenticReset() { _agWaitDrop(); _agDeclined = new Set(); _agSince = 0; _agSig = ''; _agFound = null; _agPlaying = false; _agChain = 0; eotm = { n: 0, disc: 0, swap: 0, lv: 0 }; }

// ═══════════════════════════════════════════════════════════════════════════
// EMPLOYEE OF THE MONTH (r802, owner) - the Trick a won Agentic run unlocks
// ═══════════════════════════════════════════════════════════════════════════
// "Every other subsequent hand played without using a swap or discard applies the
// focus multiplier an additional time. So 2nd hand gets it twice, third hand gets
// it once, 4th hand gets it 3 times, etc." Any run, any protocol, by hand or not.
// The count is hands played in a row this round with no swap and no discard
// (`eotm.n`, SAVE_VARS; it starts over each level, eotmSync). Ladder (IMPROVE_PLAN):
//   v2 one discard between two hands does not break it (`discards`)
//   v3 the 3rd, 5th... take the bonus of the hand before them (`carry`)
//   v4 one swap between two hands does not break it (`swaps`)
//   v5 a hand that takes the every-other bonus has `prime_chance` to prime a random Trick
//   v6 every hand adds one: the 2nd twice, the 3rd 3 times (`every`)
// calcScore is read-only, so the count moves in eotmAfterHand (end of scalingCount).
let eotm = { n: 0, disc: 0, swap: 0, lv: 0 };
function eotmSync() { if (eotm.lv !== level) eotm = { n: 0, disc: 0, swap: 0, lv: level }; return eotm; }
// EXTRA Focus applications for the n-th hand of the streak.
function eotmExtraAt(n) {
  const B = TB('employee_month');
  if (n < 2) return 0;
  if (B.every) return n - 1;
  if (B.carry) return Math.floor(n / 2);
  return n % 2 ? 0 : n / 2;
}
function eotmFocusExtra() { return hasTrick('employee_month') ? eotmExtraAt(eotmSync().n + 1) : 0; }
// A swap or a discard (doSwap, doSwapMulti, doDiscard): the Agentic chain starts over, and so does
// the streak unless the Trick allows this one.
function agenticNote(kind) {
  _agChain = 0;
  const e = eotmSync(), B = (typeof BAL !== 'undefined' && BAL.employee_month) || {};
  const key = kind === 'swap' ? 'swap' : 'disc', allow = (kind === 'swap' ? B.swaps : B.discards) || 0;
  if (hasTrick('employee_month') && e[key] < allow) { e[key]++; return; }
  e.n = 0; e.disc = 0; e.swap = 0;
}
// A hand was played (the end of scalingCount, after its score is banked).
function agenticAfterHand() {
  if (_agPlaying) _agChain++; else _agChain = 0;
  const e = eotmSync(), n = e.n + 1;
  e.n = n; e.disc = 0; e.swap = 0;
  if (!hasTrick('employee_month')) return;
  const B = TB('employee_month');
  // v5: the hands the every-other rule pays (every hand from the 2nd at v6) may prime a random Trick.
  if (B.prime_chance > 0 && n >= 2 && (B.every || n % 2 === 0) && luckRoll(B.prime_chance)) {
    const pool = trickTray.filter(t => t.id !== 'employee_month' && !t.acts?.includes('employee_month') && !(typeof isTrickDisabledByBoss === 'function' && isTrickDisabledByBoss(t.id)));
    if (pool.length) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      if (primeTrick(t, 1, { src: 'employee_month' })) {
        if (typeof entityPing === 'function') entityPing('trick', 'employee_month');
        noteMessage(`+ ${trickNameOf('employee_month')} primed ${t.name}`, '#cf8cff');
        if (typeof renderTrickTray === 'function') renderTrickTray();
      }
    }
  }
}

setInterval(() => { try { agenticTick(); } catch (e) { if (typeof devMode !== 'undefined' && devMode) console.warn('[AGENTIC]', e); } }, AGENTIC.watchMs);
