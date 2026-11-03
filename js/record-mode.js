// ═══════════════════════════════════════════════════════════════════════════
// RECORD MODE (r725) - the owner plays set rounds and every move is logged
// ═══════════════════════════════════════════════════════════════════════════
// index.html?record starts a Classic run with the walkthrough ended, a 4 x 5
// board, 3 swaps, 3 discards, Focus starting at 10 and no Tricks, on a round
// that never clears (the goal is out of reach). Rounds 1 to 8 are 1:00, 9 to 16
// are 3:00 (the keys change the next round's length). When the clock runs out
// the round ends here, not in the game: NEXT ROUND deals again. Every tap,
// play, swap, discard and Reshuffle is logged with its second on the round
// clock, its cells and card faces, and the board as it stood; COPY LOG puts
// the whole session on the clipboard as JSON (tools/sim reads it, MILESTONES.md
// section 5). Nothing here runs without ?record, and nothing is stored.
(function () {
  if (!/[?&]record\b/.test(location.search)) return;
  const PLAN = [60, 60, 60, 60, 60, 60, 60, 60, 180, 180, 180, 180, 180, 180, 180, 180];
  const ROWS = 4, COLS = 5, STOCK = 3, FOCUS0 = 10;
  let nextLen = null, round = 0, cur = null, rounds = [], ready = false, over = false, panel = null, watch = 0;
  try { window.insightsOn = () => false; } catch (e) {}

  const face = c => !c ? '·' : c._isSleight ? 'SL:' + c.sleightId : c._isReshuffle ? 'RESHUFFLE' : c._isChallenge ? 'CH' : c._isStone ? 'STONE'
    : (c.rank === WILD_RANK ? 'W' : c.rank) + (c.suit || '') + (c.rank2 ? '/' + c.rank2 : '') + (c.suit2 ? '/' + c.suit2 : '');
  const board = () => (gridData || []).map(row => (row || []).map(face));
  const at = cells => (cells || []).map(([r, c]) => face(gridData[r] && gridData[r][c]));
  const sel = () => (selected || []).map(x => x.slice());
  function ev(type, extra) {
    if (!cur || over) return;
    cur.events.push(Object.assign({ t: +((Date.now() - cur.t0) / 1000).toFixed(2), clock: Math.round(roundSeconds), type }, extra || {}));
    paint();
  }
  // A top-level function is a property of the global object, so the wrap replaces
  // what every caller reaches (the chance counts wrap playHand the same way, r624).
  function wrap(name, before, after) {
    const orig = window[name]; if (typeof orig !== 'function') return;
    window[name] = function () {
      let pre = null; try { pre = before ? before.apply(null, arguments) : null; } catch (e) {}
      const r = orig.apply(this, arguments);
      try { if (after) after(pre, r, arguments); } catch (e) {}
      return r;
    };
  }
  function install() {
    wrap('onCardTap', (r, c) => ({ r, c, card: face(gridData[r] && gridData[r][c]) }), (pre) => ev('tap', { r: pre.r, c: pre.c, card: pre.card, selected: sel() }));
    wrap('playHand', () => ({ cells: sel(), cards: at(selected), score0: score, hands0: handsPlayed, board: board() }), (pre) => {
      if (handsPlayed <= pre.hands0) return;
      ev('play', { cells: pre.cells, cards: pre.cards, hand: typeof lastHandType !== 'undefined' ? lastHandType : null,
        pips: typeof lastCalcPips !== 'undefined' ? lastCalcPips : null, mult: typeof lastCalcMult !== 'undefined' ? lastCalcMult : null,
        scored: score - pre.score0, focus: (() => { try { return +focusMultiplier().toFixed(2); } catch (e) { return null; } })(), board: pre.board });
      cur.hands++; cur.focusSum += (() => { try { return focusMultiplier(); } catch (e) { return 1; } })();
    });
    wrap('doSwap', (r1, c1, r2, c2) => ({ a: [r1, c1], b: [r2, c2], ca: face(gridData[r1]?.[c1]), cb: face(gridData[r2]?.[c2]), swaps0: swaps, board: board() }), (pre) => {
      if (swaps >= pre.swaps0) return;
      cur.swaps++; ev('swap', { a: pre.a, b: pre.b, cards: [pre.ca, pre.cb], board: pre.board });
    });
    wrap('doDiscard', () => ({ cells: sel(), cards: at(selected), discards0: discards, board: board() }), (pre) => {
      if (discards >= pre.discards0) return;
      cur.discards++; ev('discard', { cells: pre.cells, cards: pre.cards, board: pre.board });
    });
    wrap('reshuffleTap', () => ({ board: board() }), (pre) => { cur.reshuffles++; ev('reshuffle', { board: pre.board }); });
  }

  function lenFor(n) { return nextLen || PLAN[Math.min(PLAN.length - 1, n - 1)]; }
  function deal() {
    over = false;
    round++;
    const len = lenFor(round); nextLen = null;
    limits.grid_rows.current = ROWS; limits.grid_cols.current = COLS;
    gridRows = ROWS; gridCols = COLS;
    try { trickTray.length = 0; renderTrickTray(); } catch (e) {}
    try { flushPlayedDeck(); initGridData(); } catch (e) {}
    score = 0; roundGoal = 1e12; swaps = STOCK; discards = STOCK;
    roundSeconds = len; roundStartSeconds = len;
    try { resetFocusMeter(); addFocus(FOCUS0, 'record'); } catch (e) {}
    try { recomputeFocusDecayInterval?.(); } catch (e) {}
    try { if (typeof CR_SPOT_CHANCE !== 'undefined') CR_SPOT_CHANCE = 0; } catch (e) {}
    try { recomputeGridMetrics(); _devSafeRender(); updateClockUI(); updateScoreUI(); updateSelectionUI(); } catch (e) {}
    cur = { n: round, len, t0: Date.now(), hands: 0, swaps: 0, discards: 0, reshuffles: 0, focusSum: 0, board0: board(), events: [] };
    gameTimerPaused = false;
    showMessage(`RECORD · round ${round} · ${len / 60}:00`, 'var(--c-mint)');
    paint();
  }
  function finish() {
    if (!cur || over) return;
    over = true;
    gameTimerPaused = true;
    roundSeconds = Math.max(roundSeconds, 5);   // the game's own clock-out must not end the run
    try { updateClockUI(); } catch (e) {}
    rounds.push({ n: cur.n, len: cur.len, score, hands: cur.hands, swaps: cur.swaps, discards: cur.discards, reshuffles: cur.reshuffles,
      avgFocus: cur.hands ? +(cur.focusSum / cur.hands).toFixed(2) : 1, board0: cur.board0, events: cur.events });
    showMessage(`Round ${cur.n} done: ${score.toLocaleString()} · ${cur.hands} hands`, 'var(--gold)');
    paint();
  }
  function tick() {
    if (!ready || !cur || over) return;
    if (roundGoal < 1e12) { roundGoal = 1e12; try { updateScoreUI(); } catch (e) {} }
    if (roundSeconds <= 1) finish();
  }
  function text() {
    return JSON.stringify({ record: 1, build: typeof BUILD !== 'undefined' ? BUILD : null, when: new Date().toISOString(),
      setup: { rows: ROWS, cols: COLS, swaps: STOCK, discards: STOCK, focus0: FOCUS0, scoring: typeof scoringModel !== 'undefined' ? scoringModel : null },
      rounds, live: cur && !over ? { n: cur.n, events: cur.events } : null });
  }
  async function copy() {
    const t = text();
    try { await navigator.clipboard.writeText(t); showMessage('Log copied', 'var(--c-mint)'); return; } catch (e) {}
    const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:8px;top:8px;width:60vw;height:50vh;z-index:99999';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showMessage('Log copied', 'var(--c-mint)'); } catch (e) {}
    setTimeout(() => ta.remove(), 4000);
  }

  function build() {
    const st = document.createElement('style');
    st.textContent = `#rec-panel{position:fixed;left:8px;top:8px;z-index:20000;background:#0b0a08f2;color:#e8dcc0;font:14px/1.3 'VT323 Local',VT323,monospace;padding:8px 10px;border:1px solid #6a5a30;border-radius:4px;min-width:200px}
#rec-panel b{color:#f2c14e}#rec-panel .row{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}#rec-panel button{font:inherit;background:#2a2416;color:#e8dcc0;border:1px solid #8a7a45;padding:3px 8px;cursor:pointer}
#rec-panel button.on{background:#6a5a30;color:#fff}#rec-panel button.next{background:#2d5a2d;border-color:#5fbf5f;color:#fff}#rec-panel small{color:#a89c7c}`;
    document.head.appendChild(st);
    panel = document.createElement('div'); panel.id = 'rec-panel';
    document.body.appendChild(panel);
    panel.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'len') nextLen = +b.dataset.v;
      if (act === 'next') deal();
      if (act === 'end') finish();
      if (act === 'copy') copy();
      paint();
    });
  }
  function paint() {
    if (!panel) return;
    const nl = lenFor(round + 1);
    const live = cur && !over;
    panel.innerHTML = `<div><b>RECORD</b> · round ${round}${round ? ` · ${(cur.len / 60) | 0}:00` : ''}${live ? '' : round ? ' · <b>done</b>' : ''}</div>
      <div><small>${live ? `hands ${cur.hands} · swaps ${cur.swaps} · discards ${cur.discards} · score ${score.toLocaleString()}` : `${rounds.length} rounds logged`}</small></div>
      <div class="row"><small>next round:</small><button data-act="len" data-v="60" class="${nl === 60 ? 'on' : ''}">1:00</button><button data-act="len" data-v="180" class="${nl === 180 ? 'on' : ''}">3:00</button></div>
      <div class="row">${live ? '<button data-act="end">END ROUND</button>' : '<button data-act="next" class="next">NEXT ROUND</button>'}<button data-act="copy">COPY LOG</button></div>`;
  }

  function start() {
    if (ready) return;
    ready = true;
    try { devStartMode('normal'); } catch (e) {}
    setTimeout(() => {
      try { tutorialEnd(); } catch (e) {}
      install();
      build();
      deal();
      watch = setInterval(tick, 250);
    }, 2500);
  }
  window.addEventListener('load', () => setTimeout(start, 1200));
})();
