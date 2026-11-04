// ══════════════════════════════════════════════════════════════════════════
// STACKED (the mode, r730, owner). js/stacked.js is the Stacked KNACK (r685);
// this file is the mode. Mode id `stacks`, flag `stacked: true`.
//
// The whole deck is dealt into the board at once: the first cards fill the
// cells, the rest go UNDER them, so a cell is a stack. Nothing falls and nothing
// refills: when the surface card is played or discarded the card beneath it
// comes up. The under-cards show as a stepped edge behind the surface card and
// as a small list on its lower edge; hovering a stack on a desktop fans them
// down so the whole faces show (a preview only: the fan takes no clicks, so a
// neighbour under it stays clickable), and the mouse wheel over a stack cycles
// it (down: the next card up, the surface to the back). On touch a long press
// fans the stack and a tap on a fanned card brings it up. Surfacing is free. A
// swap moves whole stacks. Played and discarded cards are out for the round;
// the next deal brings everything back.
//
// THE PULL (r731, owner): the cards under a selected cell join the hand when
// that makes a better hand. You pick cells; the hand finder tries every set of
// cards under them and keeps the set with the highest total hand value (the
// table: a Full House over a Two Pair, under a Four of a Kind), fewest pulled on
// a tie, never past the Selection Size, and only when it beats the surface
// cards alone. A pulled card scores as a real card in its cell (its own pips and
// buffs) and leaves its stack with the hand. The preview lights the pulled cards
// on the surface card's list and lifts their faces. A hand still spans two cells
// at least.
//
// The round ends when no hand is left: no hand on the board as it stands, no
// discard that could reveal a card, and no single swap that would make one.
// Timed (5:00) or untimed, chosen on the start screen (stkTimed, in SAVE_VARS).
// Untimed keeps the round tick running (the clock entities still work) but hides
// the clock and never ends the round on it. No Focus: addFocus is a no-op here,
// the gauge is hidden, and the Focus entities are banned. The scoring table
// (scoringModel 'classic') prices the hand type. Hand size 5, 4 swaps, 4
// discards, 5x5, and those limits never rise. Rewards and progression are
// Classic's (reward grid, shop, events, bosses), with card buffs weighted up.
//
// The stacks belong to the CELLS (`stkCells[r][c]`, nearest first, in
// SAVE_VARS), not to the surface card: a boss that drops a horseman onto a
// cell, a Sleight that copies a card in, a Magnet pull or a Death flight all
// write gridData cells directly, and a stack that rode on the card they
// replaced would have left the run with it. A swap moves the two cells' stacks
// (stkOnSwap, from doSwap); a removal surfaces the next card (stkTakeOver);
// the round-end sweep banks every under-card into the played pile (stkSweep).
// ══════════════════════════════════════════════════════════════════════════

let stkTimed = false;   // SAVE_VARS: the start screen's answer for this run
let stkCells = [];      // SAVE_VARS: stkCells[r][c] = the cards under the surface, nearest first
let stkFanId = null;    // card id of the surface card whose stack is fanned open (hover / long press)
let stkNoHandSaid = false;
let stkIn = {};            // cell key -> the cards pulled from under it for the hand under evaluation
let _stkSearching = false; // handComponentsFor re-enters with a pull set (js/hand-detect.js)
const _stkChoice = new Map();   // the search's answer per selection + stacks
const STK_PULL_MAX_COMBOS = 160;
const STK_ROUND_SECONDS = 300;
const STK_FAN_DOWN = 0.8;    // a fanned under-card slides this far (of the card's height) per step, so its rank clears the card above
const STK_PEEK_PX  = 9;      // the strip of each under-card that shows at rest
const STK_PRESS_MS = 500;    // a long press on touch fans the stack

function stackedActive() { return !!(typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.stacked); }
function stkUntimed() { return stackedActive() && !stkTimed; }
function stkUnderAt(r, c) { return (stkCells[r] && Array.isArray(stkCells[r][c])) ? stkCells[r][c] : []; }
function stkDepthAt(r, c) { return (gridData[r]?.[c] ? 1 : 0) + stkUnderAt(r, c).length; }
function stkCellsReset() { stkCells = []; for (let r = 0; r < gridRows; r++) { stkCells[r] = []; for (let c = 0; c < gridCols; c++) stkCells[r][c] = []; } }
function stkCellsConform() { for (let r = 0; r < gridRows; r++) { if (!stkCells[r]) stkCells[r] = []; for (let c = 0; c < gridCols; c++) if (!Array.isArray(stkCells[r][c])) stkCells[r][c] = []; } }
// The cell a surface card sits in, or null.
function stkCellOfCard(card) { if (!card) return null; for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (gridData[r]?.[c] === card) return [r, c]; return null; }

// ── The pull ────────────────────────────────────────────────────────────────
function stkPullOn() { return stackedActive(); }
function stkInAt(r, c) { if (!stackedActive()) return []; const v = stkIn[r + '-' + c]; return Array.isArray(v) ? v : []; }
function stkInCells(cells) { if (!stackedActive()) return []; const out = []; cells.forEach(([r, c]) => stkInAt(r, c).forEach(u => out.push(u))); return out; }
// The part of a hand's cache key that is the cell's stack and what is pulled from it.
function stkKeyPart(r, c) {
  if (!stackedActive()) return '';
  const under = stkUnderAt(r, c);
  if (!under.length) return '';
  return '[' + under.map(u => u._id).join(',') + '>' + stkInAt(r, c).map(u => u._id).join(',') + ']';
}
function _stkWorthOf(res) {
  if (!res || !res.components) return -1;
  return res.components.reduce((a, c) => a + (c.name === 'High Card' ? 0 : handWorth(c.name)), 0);
}
// Which under-cards could matter to these cells: a rank already in the hand, a
// rank within two of one (a run), or the suit every surface card shares.
function _stkRelevant(cells, u) {
  if (!u || !u.rank || u._isStone || u._isSleight || u._isChallenge) return false;
  if (typeof isWildCard === 'function' && isWildCard(u)) return false;
  const surf = cells.map(([r, c]) => gridData[r]?.[c]).filter(x => x && x.rank);
  const vals = new Set(); surf.forEach(x => (typeof rankRunVals === 'function' ? rankRunVals(x.rank) : []).forEach(v => vals.add(v)));
  if (surf.some(x => x.rank === u.rank || x.rank2 === u.rank)) return true;
  const uv = (typeof rankRunVals === 'function') ? rankRunVals(u.rank) : [];
  if (uv.some(v => [...vals].some(w => Math.abs(w - v) <= 2 && w !== v))) return true;
  if (surf.length && surf.every(x => x.suit === u.suit || x.suit2 === u.suit)) return true;
  return false;
}
// Every set of cards that could be pulled from this cell: the subsets of its
// relevant under-cards, the empty one first.
function _stkSubsets(list) {
  const out = [[]];
  list.forEach(u => { const n = out.length; for (let i = 0; i < n; i++) out.push(out[i].concat([u])); });
  return out;
}
// handComponentsFor's Stacked front: tries every pull, keeps the best, leaves
// it set in `stkIn` for calcScore and the preview, and returns that answer.
function stkPullSearch(cells) {
  const keys = cells.map(([r, c]) => r + '-' + c);
  const setIn = choice => keys.forEach((k, i) => { stkIn[k] = choice[i] || []; });
  const run = () => { _stkSearching = true; try { return handComponentsFor(cells); } finally { _stkSearching = false; } };
  const cap = (typeof limits !== 'undefined' && limits.selection) ? limits.selection.current : 5;
  const room = cap - cells.length;
  const none = cells.map(() => []);
  setIn(none);
  const base = run();
  if (room <= 0) return base;
  const kb = cells.map(([r, c]) => { const k = gridData[r]?.[c]; return r + ',' + c + ':' + (k ? k._id : '-') + stkKeyPart(r, c).split('>')[0]; }).join('|') + '#' + cap;
  if (_stkChoice.has(kb)) {
    const ids = _stkChoice.get(kb);
    setIn(cells.map(([r, c]) => stkUnderAt(r, c).filter(u => ids.has(String(u._id)))));
    return run();
  }
  const per = cells.map(([r, c]) => _stkSubsets(stkUnderAt(r, c).filter(u => _stkRelevant(cells, u))));
  let combos = per.reduce((a, l) => a * l.length, 1);
  // Too many: one card a cell at most.
  const lists = combos > STK_PULL_MAX_COMBOS ? per.map(l => l.filter(x => x.length <= 1)) : per;
  let best = base, bestW = _stkWorthOf(base), bestN = 0, bestChoice = none;
  const idx = lists.map(() => 0);
  let guard = 0;
  while (guard++ < STK_PULL_MAX_COMBOS * 2) {
    // next combo (odometer), skipping the empty one (the base)
    let i = 0;
    while (i < idx.length) { idx[i]++; if (idx[i] < lists[i].length) break; idx[i] = 0; i++; }
    if (i >= idx.length) break;
    const choice = idx.map((x, j) => lists[j][x]);
    const n = choice.reduce((a, l) => a + l.length, 0);
    if (n === 0 || n > room) continue;
    setIn(choice);
    const res = run();
    const w = _stkWorthOf(res);
    if (w > bestW || (w === bestW && w > 0 && n < bestN && bestN > 0)) { best = res; bestW = w; bestN = n; bestChoice = choice; }
  }
  setIn(bestChoice);
  _stkChoice.set(kb, new Set(bestChoice.flat().map(u => String(u._id))));
  if (_stkChoice.size > 2000) _stkChoice.clear();
  return bestN ? run() : base;
}
// The hand is a fact: the pulled cards leave their stacks, scored, to the played pile.
function stkCommit(cells) {
  if (!stackedActive()) return;
  let n = 0;
  (cells || []).forEach(([r, c]) => {
    const pulled = stkInAt(r, c); if (!pulled.length) return;
    const under = stkUnderAt(r, c);
    pulled.forEach(u => { const i = under.indexOf(u); if (i >= 0) { under.splice(i, 1); discardToPlayed(u); n++; } });
    stkIn[r + '-' + c] = [];
  });
  if (n) { _stkChoice.clear(); if (typeof dbgEvent === 'function') dbgEvent('info', `stacked: ${n} card(s) pulled into the hand`); }
}

// ── The start screen: timed or not ─────────────────────────────────────────
function stkOpenStart() {
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  const ov = document.getElementById('picker-overlay'); if (!ov) { stkStart(false); return; }
  ov.classList.add('show');
  const title = document.getElementById('picker-title'), sub = document.getElementById('picker-sub');
  if (title) title.textContent = 'STACKED';
  if (sub) sub.textContent = 'The whole deck on the board · nothing falls';
  const rail = document.getElementById('picker-rail'), body = document.getElementById('picker-body'), foot = document.getElementById('picker-foot');
  rail.innerHTML = `<button class="pk-rail-step on"><span class="pk-rail-n">1</span><span class="pk-rail-l">CLOCK</span></button>`;
  const opts = [
    { id: 'untimed', name: 'No clock',  tag: 'UNTIMED', desc: 'Play until the goal is met or no hand is left. The cards are the limit.' },
    { id: 'timed',   name: '5:00',      tag: 'TIMED',   desc: 'A five minute round. Miss the goal before it runs out and the run ends. Swaps and discards cost no time.' },
  ];
  const paint = () => {
    body.innerHTML = `<div class="pk-q">Is there a clock?</div>` +
      `<div class="pk-note">Hand size 5, four swaps, four discards, a 5x5 board. Nothing falls: the card beneath comes up. No Focus.</div>` +
      `<div class="pk-opts">` + opts.map(o => `<button class="pk-opt${(stkTimed ? 'timed' : 'untimed') === o.id ? ' on' : ''}" data-opt="${o.id}">` +
        `<div class="pk-opt-head"><span class="pk-opt-name">${o.name}</span><span class="pk-opt-tag">${o.tag}</span></div><div class="pk-opt-desc">${o.desc}</div></button>`).join('') + `</div>`;
    body.querySelectorAll('.pk-opt').forEach(b => { b.onclick = () => { stkTimed = b.dataset.opt === 'timed'; paint(); }; });
  };
  paint();
  foot.innerHTML = `<button class="pk-btn pk-back">CANCEL</button><div class="pk-sum">Stacked · ${stkTimed ? '5:00' : 'no clock'}</div><button class="pk-btn pk-next go">START RUN</button>`;
  foot.querySelector('.pk-back').onclick = () => { ov.classList.remove('show'); if (title) title.textContent = 'BUILD A MODE'; document.getElementById('mode-select-overlay')?.classList.add('show'); };
  foot.querySelector('.pk-next').onclick = () => { ov.classList.remove('show'); if (title) title.textContent = 'BUILD A MODE'; stkStart(stkTimed); };
}
function stkStart(timed) {
  stkTimed = !!timed;
  ACTIVE_MODE = MODES.stacks;
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  document.getElementById('picker-overlay')?.classList.remove('show');
  startGame();
}

// ── Run start ───────────────────────────────────────────────────────────────
// From startGame, after the limits are rebuilt and before the deal.
function stkSetupRun() {
  if (!stackedActive()) return;
  const fix = (id, v) => { const l = limits[id]; if (!l) return; l.current = v; l.base = v; l.max = v; if (l.min > v) l.min = v; };
  fix('grid_rows', 5); fix('grid_cols', 5); fix('selection', 5);
  fix('swaps', 4); fix('discards', 4);
  // Starting Time never rises here: there is nothing for it to buy in an untimed
  // round, and the timed round is the five minutes.
  { const l = limits.round_time; if (l) { l.current = STK_ROUND_SECONDS; l.base = STK_ROUND_SECONDS; l.max = STK_ROUND_SECONDS; } }
  stkFanId = null; stkNoHandSaid = false;
  stkCellsReset(); stkIn = {}; _stkChoice.clear();
}
function stkStageClasses() {
  const st = document.getElementById('stage'); if (!st) return;
  st.classList.toggle('stk-mode', stackedActive());
  st.classList.toggle('stk-noclock', stkUntimed());
  st.classList.toggle('stk-nofocus', stackedActive());
}

// ── The deal ────────────────────────────────────────────────────────────────
// Every card still in the draw pile goes under a surface card, round robin
// from the top-left, so the stacks differ in depth by one at most.
function stkDealRest() {
  if (!stackedActive()) return;
  stkCellsConform();
  const cells = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (cd && !cd._isStone && !cd._isChallenge) cells.push(stkCells[r][c]);
  }
  if (!cells.length) return;
  // Straight off the pile (not drawCard: its audit runs per card and the under
  // count is not in place until the loop ends). A dormant Sleight stays in the pile.
  let i = 0;
  const keep = [];
  while (drawPile.length) {
    const card = drawPile.shift();
    if (typeof sleightDormant === 'function' && sleightDormant(card)) { keep.push(card); continue; }
    cells[i % cells.length].push(stampId(card));
    i++;
  }
  drawPile = keep;
  if (typeof updateDeckHud === 'function') updateDeckHud();
}

// Every under-card on the board goes to the played pile (the round is over).
// `goalHandCards` are still in their cells at this point (the finale leaves
// them), so walking the board covers them.
function stkSweep() {
  if (!stackedActive()) return;
  (stkCells || []).forEach(row => (row || []).forEach(list => { (list || []).forEach(u => discardToPlayed(u)); if (list) list.length = 0; }));
  stkFanId = null;
}
// A swap moves whole stacks (from doSwap, after the data swap).
function stkOnSwap(r1, c1, r2, c2) {
  if (!stackedActive()) return;
  stkCellsConform();
  const t = stkCells[r1][c1]; stkCells[r1][c1] = stkCells[r2][c2]; stkCells[r2][c2] = t;
}

// A card leaving its cell hands its stack to the card beneath, which surfaces.
function stkTakeOver(r, c) {
  const under = stkUnderAt(r, c);
  if (!under.length) { gridData[r][c] = null; return null; }
  const next = under.shift();
  gridData[r][c] = next;
  return next;
}

// removeAndFall's stacked branch: the removed cards have already been routed
// to their piles and their elements are sliding out. No column packs, nothing
// is drawn: the card beneath each removed one surfaces in place.
async function stkAfterRemove(removingCells, leaveMs) {
  const removed = new Set(removingCells.map(([r, c]) => `${r}-${c}`));
  const surfaced = [];
  removingCells.forEach(([r, c]) => { const n = stkTakeOver(r, c); if (n) surfaced.push(n); });
  selected = selected.filter(([r, c]) => !removed.has(`${r}-${c}`));
  if (swapPending && removed.has(`${swapPending[0]}-${swapPending[1]}`)) swapPending = null;
  if (!selected.length && typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  if (typeof discardCarryRestore === 'function') discardCarryRestore();
  if (stkFanId && removed.size) stkFanId = null;
  render();
  // The surfaced cards rise into place from where their strip was.
  const gridEl = document.getElementById('grid');
  const _as = typeof animSlow === 'function' ? animSlow() : 1;
  surfaced.forEach(card => {
    const el = gridEl.querySelector(`[data-card-id="${card._id}"]`); if (!el) return;
    try {
      el.animate([
        { translate: `0 ${STK_PEEK_PX}px`, scale: '0.96 0.96', opacity: 0.6 },
        { translate: '0 0', scale: '1 1', opacity: 1 },
      ], { duration: 240 * _as, delay: Math.max(0, leaveMs - 60), easing: 'ease-out', fill: 'backwards' });
    } catch (e) {}
  });
  await new Promise(res => setTimeout(res, leaveMs + 20));
  if (typeof _cardFalls !== 'undefined' && _cardFalls.size) return;
  _fallTail();
  stkScheduleCheck();
}

// ── The peeks and the fan ───────────────────────────────────────────────────
// Inside the surface card: a small list of what is beneath it (`.stk-list`,
// nearest first), appended by renderCardAppearance. Beside it on the board: one
// `.stk-peek` element per under-card, a full card face drawn as a DIRECT CHILD
// of #grid at the stack's cell with a negative z-index, so it paints under every
// surface card whatever the DOM order (#grid isolates in this mode). At rest
// each is stepped a few px down and right, so the stack shows its depth in the
// gaps. The fan (`stkFanId`) slides them down a card-height step each (up when
// the board has no room below), raised above the neighbours, with the surface
// card raised above them; a tap on one brings it to the surface.
function stkPeekHTML(card, r, c) {
  if (!stackedActive() || !card || gridData[r]?.[c] !== card) return '';
  const under = stkUnderAt(r, c);
  if (!under.length) return '';
  const sel = selected.some(([sr, sc]) => sr === r && sc === c);
  const pulled = sel ? stkInAt(r, c) : [];
  const idx = u => {
    if (!u) return '';
    const on = pulled.includes(u) ? ' in' : '';
    if (typeof isWildCard === 'function' && isWildCard(u)) return `<b class="sk-w${on}">${typeof WILD_RANK !== 'undefined' ? WILD_RANK : '★'}</b>`;
    if (u._isStone) return `<b class="${on.trim()}">✕</b>`;
    const cls = (typeof suitClass === 'function') ? suitClass(u.suit) : '';
    return `<b class="${cls}${on}">${u.rank}<i>${u.suit || ''}</i></b>`;
  };
  return `<div class="stk-list${pulled.length ? ' stk-has-in' : ''}" data-n="${under.length}">${under.map(idx).join('')}</div>`;
}
function stkPeekFace(u, r, c) {
  if (u._isStone || u._isChallenge || u._isReshuffle) return { className: 'card stone-card', innerHTML: `<div class="junk-glyph">✕</div>` };
  try { return renderCardAppearance(u, r, c, { revealFog: true }); } catch (e) { return { className: 'card', innerHTML: `<div class="rank">${u.rank || ''}</div><div class="suit">${u.suit || ''}</div>` }; }
}
// Every under-card's element, created, moved or dropped to match the board.
function stkPaint() {
  if (!stackedActive()) return;
  const gridEl = document.getElementById('grid'); if (!gridEl) return;
  const seen = new Set();
  const have = {};
  gridEl.querySelectorAll(':scope > .stk-peek').forEach(el => { have[el.dataset.stkId] = el; });
  if (!(typeof dealPhase !== 'undefined' && dealPhase) && !(typeof mapScreenOpen !== 'undefined' && mapScreenOpen)
      && !(typeof rewardOnGrid !== 'undefined' && rewardOnGrid) && !(typeof shopGridActive !== 'undefined' && shopGridActive)
      && !(typeof gridPickState !== 'undefined' && gridPickState)) {
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
      const under = stkUnderAt(r, c);
      if (!under.length) continue;
      const sel = selected.some(([sr, sc]) => sr === r && sc === c);
      const pulled = sel ? stkInAt(r, c) : [];
      under.forEach((u, i) => {
        const id = String(u._id); seen.add(id);
        let el = have[id];
        const inHand = pulled.includes(u);
        const key = `${r}-${c}-${i}-${under.length}-${sel ? 1 : 0}-${inHand ? 1 : 0}`;
        if (!el) { el = document.createElement('div'); el.dataset.stkId = id; gridEl.insertBefore(el, gridEl.firstChild); have[id] = el; }
        if (el.dataset.stkKey !== key) {
          const face = stkPeekFace(u, r, c);
          el.className = face.className.replace(/\b(selected|hand-valid|hand-ready|unreachable|swap-pending)\b/g, '') + ' stk-peek' + (sel ? ' stk-sel' : '') + (inHand ? ' stk-in' : '');
          el.innerHTML = face.innerHTML;
          el.dataset.row2 = r; el.dataset.col2 = c; el.dataset.i = i; el.dataset.stkKey = key;
          el.style.setProperty('--si', i + 1);
          el.style.setProperty('--sn', under.length);
          el.style.zIndex = String(-1 - i);
        }
        el.style.left = cellLeft(c) + 'px'; el.style.top = cellTop(r) + 'px';
        el.style.marginLeft = (typeof cardColOffset === 'function' ? cardColOffset(c) : 0) + 'px';
        el.style.marginTop = (typeof cardRowOffset === 'function' ? cardRowOffset(r) : 0) + 'px';
      });
    }
  }
  Object.keys(have).forEach(id => { if (!seen.has(id)) have[id].remove(); });
  stkFanPaint();
}
function stkPeeksOf(cardId) {
  const gridEl = document.getElementById('grid');
  const el = gridEl.querySelector(`[data-card-id="${cardId}"]`); if (!el) return [];
  const r = parseInt(el.dataset.row, 10), c = parseInt(el.dataset.col, 10);
  return stkUnderAt(r, c).map(u => gridEl.querySelector(`:scope > .stk-peek[data-stk-id="${u._id}"]`)).filter(Boolean);
}
function stkFanOpen(card) {
  const at = stkCellOfCard(card);
  if (!at || !stkUnderAt(at[0], at[1]).length) { stkFanClose(); return; }
  if (stkFanId === String(card._id)) return;
  stkFanClose();
  stkFanId = String(card._id);
  stkFanPaint();
}
function stkFanClose() {
  if (!stkFanId) return;
  const el = document.querySelector(`#grid [data-card-id="${stkFanId}"]`);
  if (el) { el.classList.remove('stk-fanned'); el.style.zIndex = ''; }
  stkPeeksOf(stkFanId).forEach((p, i) => { p.classList.remove('stk-out', 'stk-out-up'); p.style.zIndex = String(-1 - i); p.style.removeProperty('--stk-fan'); });
  stkFanId = null;
}
// Lays the fan out (and again after a render, which rebuilds the card's class list).
function stkFanPaint() {
  if (!stkFanId) return;
  const gridEl = document.getElementById('grid');
  const el = gridEl.querySelector(`[data-card-id="${stkFanId}"]`);
  const peeks = stkPeeksOf(stkFanId);
  if (!el || !peeks.length) { stkFanId = null; return; }
  const r = parseInt(el.dataset.row, 10);
  const H = (typeof CARD_VIS_H === 'number' && CARD_VIS_H) || CARD_H;
  const fan = STK_FAN_DOWN * H, n = peeks.length;
  const down = cellTop(r) + fan * n + H <= gridEl.offsetHeight - 2;
  el.classList.add('stk-fanned'); el.style.zIndex = '50';
  peeks.forEach((p, i) => {
    p.classList.add('stk-out'); p.classList.toggle('stk-out-up', !down);
    p.style.setProperty('--stk-fan', (fan * (i + 1) * (down ? 1 : -1)).toFixed(1) + 'px');
    p.style.zIndex = String(40 + (n - i));
  });
}
// A different card of the stack to the surface: `next` comes up, `under` is the
// stack it will hold (nearest first). Free; the cell's selection is let go.
function stkSetSurface(r, c, next, under) {
  const cd = gridData[r]?.[c]; if (!cd || !next) return false;
  if (animating || roundEnded) return false;
  stkCellsConform();
  stkCells[r][c] = under;
  gridData[r][c] = next;
  if (selected.some(([sr, sc]) => sr === r && sc === c)) { selected = selected.filter(([sr, sc]) => !(sr === r && sc === c)); if (!selected.length && typeof cancelAutoSubmit === 'function') cancelAutoSubmit(); }
  if (swapPending && swapPending[0] === r && swapPending[1] === c) swapPending = null;
  const fanned = stkFanId === String(cd._id);
  stkFanClose();
  if (typeof sfxCardSelect === 'function') sfxCardSelect();
  render();
  const el = document.querySelector(`#grid [data-card-id="${next._id}"]`);
  if (el) { try { el.animate([{ translate: `0 ${Math.round(STK_PEEK_PX * 2)}px`, opacity: 0.6 }, { translate: '0 0', opacity: 1 }], { duration: 180, easing: 'ease-out' }); } catch (e) {} }
  if (fanned) stkFanOpen(next);
  if (typeof dbgEvent === 'function') dbgEvent('info', `stack surfaced [${r},${c}] ${next.rank || ''}${next.suit || ''}`);
  return true;
}
// Tap on a fanned under-card (touch): it comes up, the surface takes its place.
function stkSurface(r, c, i) {
  const cd = gridData[r]?.[c]; const under = stkUnderAt(r, c).slice();
  if (!cd || i < 0 || i >= under.length) return false;
  const next = under[i]; under[i] = cd;
  return stkSetSurface(r, c, next, under);
}
// The wheel over a stack: down brings the next card up and sends the surface to
// the back; up brings the deepest card up and puts the surface just beneath.
function stkCycle(r, c, dir) {
  const cd = gridData[r]?.[c]; const under = stkUnderAt(r, c).slice();
  if (!cd || !under.length) return false;
  let next;
  if (dir > 0) { next = under.shift(); under.push(cd); }
  else { next = under.pop(); under.unshift(cd); }
  return stkSetSurface(r, c, next, under);
}

// Pointer wiring: hover fans on a mouse, a long press fans on touch, a tap on a
// fanned under-card surfaces it. Capture phase on #grid, so the grid's own
// pointerdown (which would start a select) never sees the tap on a fanned card.
(function stkBind() {
  const g = document.getElementById('grid'); if (!g) return;
  let pressT = null, hoverT = null, wheelAt = 0;
  const cardOf = t => (t && t.closest) ? t.closest('#grid .card[data-card-id], #grid .trick-card[data-card-id]') : null;
  const peekOf = t => (t && t.closest) ? t.closest('#grid > .stk-peek') : null;
  const cellOf = el => [parseInt(el.dataset.row ?? el.dataset.row2, 10), parseInt(el.dataset.col ?? el.dataset.col2, 10)];
  const cardObj = el => { const [r, c] = cellOf(el); return gridData[r]?.[c] || null; };
  const stackOf = el => { const [r, c] = cellOf(el); return stkUnderAt(r, c); };
  // Hover: the fan is a preview of the stack under the pointer; it closes the
  // moment the pointer is over anything else (the fanned faces take no pointer
  // events on a mouse, so a neighbour under the fan is what gets hovered).
  g.addEventListener('mouseover', e => {
    if (!stackedActive() || (typeof animating !== 'undefined' && animating)) return;
    const el = cardOf(e.target);
    const cd = el ? cardObj(el) : null;
    clearTimeout(hoverT); hoverT = null;
    if (cd && stackOf(el).length) { if (stkFanId === String(cd._id)) return; hoverT = setTimeout(() => { hoverT = null; stkFanOpen(cd); }, 110); }
    else if (stkFanId && !g.classList.contains('stk-touchfan')) stkFanClose();
  });
  g.addEventListener('mouseleave', () => { clearTimeout(hoverT); hoverT = null; if (stackedActive() && !g.classList.contains('stk-touchfan')) stkFanClose(); });
  // The wheel cycles the stack under the pointer.
  g.addEventListener('wheel', e => {
    if (!stackedActive() || animating || roundEnded) return;
    const el = cardOf(e.target); if (!el) return;
    const cd = cardObj(el); if (!cd || !stackOf(el).length) return;
    e.preventDefault();
    const now = Date.now(); if (now - wheelAt < 140) return; wheelAt = now;
    const [r, c] = cellOf(el);
    stkCycle(r, c, e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  g.addEventListener('pointerdown', e => {
    if (!stackedActive()) return;
    const peek = peekOf(e.target);
    if (peek && peek.classList.contains('stk-out')) {
      e.stopPropagation(); e.preventDefault();
      const [r, c] = cellOf(peek);
      g.classList.remove('stk-touchfan');
      stkSurface(r, c, parseInt(peek.dataset.i, 10));
      return;
    }
    const el = cardOf(e.target);
    if (e.pointerType === 'touch') {
      if (stkFanId && !(el && cardObj(el) && String(cardObj(el)._id) === stkFanId)) { g.classList.remove('stk-touchfan'); stkFanClose(); }
      const cd = el ? cardObj(el) : null;
      if (cd && stackOf(el).length) {
        clearTimeout(pressT);
        pressT = setTimeout(() => {
          pressT = null;
          if (typeof _longPressActive !== 'undefined') _longPressActive = true;
          if (stkFanId === String(cd._id)) { g.classList.remove('stk-touchfan'); stkFanClose(); }
          else { g.classList.add('stk-touchfan'); stkFanOpen(cd); }
        }, STK_PRESS_MS);
      }
    }
  }, true);
  const cancel = () => { if (pressT) { clearTimeout(pressT); pressT = null; } };
  g.addEventListener('pointerup', cancel, true);
  g.addEventListener('pointercancel', cancel, true);
  g.addEventListener('pointermove', e => { if (pressT && e.pointerType === 'touch') cancel(); }, true);
  document.addEventListener('pointerdown', e => {
    if (!stackedActive() || !stkFanId) return;
    if (e.target && e.target.closest && e.target.closest('#grid')) return;
    g.classList.remove('stk-touchfan'); stkFanClose();
  });
})();

// ── Is any hand left? ───────────────────────────────────────────────────────
// `opts[r][c]` is every card the cell can present (the surface and its stack)
// that may be selected. A hand exists if any two touching cells can both show
// one rank (a Pair), any connected three can show three ranks in a row (a Run
// of 3), or any connected five can all show one suit (a Flush). Every larger
// hand contains one of those, so this is the whole test. A wild matches any
// rank (and any run value only when wilds may join runs).
function stkCellOptions() {
  const opts = [];
  for (let r = 0; r < gridRows; r++) {
    opts[r] = [];
    for (let c = 0; c < gridCols; c++) {
      const cd = gridData[r]?.[c];
      if (!cd || (typeof isCellBlocked === 'function' && isCellBlocked(r, c))) { opts[r][c] = []; continue; }
      const list = [cd, ...stkUnderAt(r, c)].filter(u => u && !u._isStone && !u._isChallenge && !u._isTrick && u.rank && cardCan(u, 'select'));
      opts[r][c] = list;
    }
  }
  return opts;
}
function _stkRanksOf(list) {
  const out = { ranks: new Set(), wild: false, vals: new Set(), suits: new Set() };
  list.forEach(u => {
    const wild = typeof isWildCard === 'function' && isWildCard(u);
    if (wild) { out.wild = true; if (typeof wildsRunOn === 'function' && wildsRunOn()) out.anyVal = true; return; }
    out.ranks.add(u.rank); if (u.rank2) out.ranks.add(u.rank2);
    (typeof rankRunVals === 'function' ? rankRunVals(u.rank) : []).forEach(v => out.vals.add(v));
    if (u.rank2 && typeof rankRunVals === 'function') rankRunVals(u.rank2).forEach(v => out.vals.add(v));
    if (u.suit) out.suits.add(u.suit); if (u.suit2) out.suits.add(u.suit2);
  });
  return out;
}
function stkAnyHand(opts) {
  opts = opts || stkCellOptions();
  const R = gridRows, C = gridCols;
  const info = [];
  for (let r = 0; r < R; r++) { info[r] = []; for (let c = 0; c < C; c++) info[r][c] = _stkRanksOf(opts[r][c]); }
  const live = (r, c) => opts[r]?.[c] && opts[r][c].length > 0;
  const nb = (r, c) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C && live(a, b));
  const _active = k => (typeof activeHands === 'undefined') || activeHands.has(k);
  // Pairs (any set hand needs one): across two touching cells, or inside one
  // stack beside any live cell (the pull brings the second card up, r731).
  if (_active('pair') || _active('threeofakind')) {
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (!live(r, c)) continue;
      const a = info[r][c];
      const ns = nb(r, c);
      if (ns.length) {
        const cnt = {}; opts[r][c].forEach(u => { if (u.rank && !(typeof isWildCard === 'function' && isWildCard(u))) { cnt[u.rank] = (cnt[u.rank] || 0) + 1; if (u.rank2) cnt[u.rank2] = (cnt[u.rank2] || 0) + 1; } });
        if (Object.values(cnt).some(v => v >= 2)) return 'pair';
      }
      for (const [nr, nc] of ns) {
        if (nr < r || (nr === r && nc < c)) continue;   // each pair once
        const b = info[nr][nc];
        if ((a.wild && b.ranks.size) || (b.wild && a.ranks.size)) return 'pair';
        for (const k of a.ranks) if (b.ranks.has(k)) return 'pair';
      }
    }
  }
  // Runs of 3: with the pull a run may come from the union of two touching
  // stacks (r731), or from a centre cell and two of its neighbours.
  if (_active('run3')) {
    const union = cs => { const all = new Set(); let any = false; cs.forEach(ci => { ci.vals.forEach(v => all.add(v)); if (ci.anyVal) any = true; }); if (any) for (let v = 0; v <= 20; v++) all.add(v); return all; };
    const hasRun = (cs, vmin) => { const all = union(cs); const vals = []; cs.forEach(ci => ci.vals.forEach(v => vals.push(v))); const multi = {}; vals.forEach(v => { multi[v] = (multi[v] || 0) + 1; }); for (const v of all) if (all.has(v + 1) && all.has(v + 2)) return true; return false; };
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (!live(r, c)) continue;
      const ns = nb(r, c);
      for (const [nr, nc] of ns) { if ((nr > r || (nr === r && nc > c)) && hasRun([info[r][c], info[nr][nc]])) return 'run'; }
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
        if (hasRun([info[r][c], info[ns[i][0]][ns[i][1]], info[ns[j][0]][ns[j][1]]])) return 'run';
      }
    }
  }
  // Flushes: a connected component of `n` cells that can all show one suit.
  const flushN = _active('flush3') ? 3 : _active('flush4') ? 4 : _active('flush') ? 5 : 0;
  if (flushN) {
    const suits = new Set(); for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) info[r][c].suits.forEach(s => suits.add(s));
    for (const s of suits) {
      const ok = (r, c) => live(r, c) && (info[r][c].suits.has(s) || info[r][c].wild);
      const seen = new Set();
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (!ok(r, c) || seen.has(`${r}-${c}`)) continue;
        let n = 0; const q = [[r, c]]; seen.add(`${r}-${c}`);
        while (q.length) { const [a, b] = q.pop(); n++; for (const [nr, nc] of nb(a, b)) { const k = `${nr}-${nc}`; if (!seen.has(k) && ok(nr, nc)) { seen.add(k); q.push([nr, nc]); } } }
        if (n >= flushN) return 'flush';
      }
    }
  }
  return null;
}
// Could one swap of two touching stacks make a hand?
function stkAnySwapMakesHand() {
  const opts = stkCellOptions();
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    if (!opts[r][c].length) continue;
    for (const [nr, nc] of [[r + 1, c], [r, c + 1]]) {
      if (nr >= gridRows || nc >= gridCols || !opts[nr][nc].length) continue;
      const t = opts[r][c]; opts[r][c] = opts[nr][nc]; opts[nr][nc] = t;
      const h = stkAnyHand(opts);
      opts[nr][nc] = opts[r][c]; opts[r][c] = t;
      if (h) return true;
    }
  }
  return false;
}
let _stkCheckT = null;
function stkScheduleCheck(ms) {
  if (!stackedActive()) return;
  clearTimeout(_stkCheckT);
  _stkCheckT = setTimeout(stkCheckEnd, ms || 350);
}
// The round is over when nothing can make a hand. Waits for a quiet board.
function stkCheckEnd() {
  _stkCheckT = null;
  if (!stackedActive() || roundEnded || goalReachedThisRound) return;
  if (typeof dealPhase !== 'undefined' && dealPhase) return;
  if (animating || falling || (typeof danceAbortController !== 'undefined' && danceAbortController) || pendingAction) { stkScheduleCheck(400); return; }
  if (gameTimerPaused || (typeof isPaused !== 'undefined' && isPaused)) { stkScheduleCheck(600); return; }
  if (typeof sweepRunning === 'function' && sweepRunning()) { stkScheduleCheck(400); return; }
  if (!roundInterval && !bossActive) return;   // no round is live
  if (stkAnyHand()) { stkNoHandSaid = false; return; }
  const deep = (() => { for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (stkDepthAt(r, c) > 1) return true; return false; })();
  const canReveal = discards > 0 && deep;
  const canSwap = swaps > 0 && stkAnySwapMakesHand();
  if (canReveal || canSwap) {
    if (!stkNoHandSaid) { stkNoHandSaid = true; showMessage(canSwap ? 'No hand on the board. A swap could make one.' : 'No hand on the board. A discard could turn one up.', 'var(--cream-dim)'); }
    return;
  }
  stkNoHandSaid = false;
  if (typeof dbgEvent === 'function') dbgEvent('info', 'stacked: no hand left, the round ends');
  showMessage('No hands left', 'var(--red)');
  stkEndRound();
}
function stkEndRound() {
  if (roundEnded) return;
  if (typeof onRoundEnd === 'function') onRoundEnd();
}

// ── Readers hooked from the engine ──────────────────────────────────────────
// Entities that cannot do anything here: Focus (there is none), the clock's
// pause / rewind family in an untimed round, and the pieces that need the draw
// pile or a fall.
const STK_BANNED = new Set(['card_counter', 'keeper', 'fresh_start', 'backfill', 'first_wind', 'carry_time', 'tempo', 'reserve', 'quick_draw', 'expanse']);
function _stkEntityRow(id) {
  const find = pool => (pool || []).find(e => e && e.id === id);
  return find(typeof TRICK_POOL_ALL !== 'undefined' ? TRICK_POOL_ALL : (typeof TRICK_POOL !== 'undefined' ? TRICK_POOL : []))
      || find(typeof KNACK_POOL !== 'undefined' ? KNACK_POOL : []) || find(typeof SLEIGHT_POOL !== 'undefined' ? SLEIGHT_POOL : []) || null;
}
function stkEntityBanned(id) {
  if (!stackedActive()) return false;
  if (STK_BANNED.has(id)) return true;
  const row = _stkEntityRow(id);
  const tags = (row && Array.isArray(row.tags)) ? row.tags : [];
  if (tags.includes('focus')) return true;
  if (stkUntimed() && (tags.includes('clock') || tags.includes('pause') || tags.includes('time'))) return true;
  return false;
}
// Reward tiles: no Starting Time tile in an untimed run, card buffs three times as often.
function stkRewardCats(cats) {
  if (!stackedActive()) return cats;
  return cats.map(c => {
    if (c.kind === 'time' && stkUntimed()) return { ...c, weight: 0 };
    if (c.kind === 'blessed') return { ...c, weight: c.weight * 3 };
    return c;
  }).filter(c => c.weight > 0);
}
