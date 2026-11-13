// ── All Hands (r572; a cascade since r773) ──────────────────────────────────
//
// A legendary double-tap Sleight with no cost. It reads the board like a page,
// left to right, top to bottom, and at every card it reaches takes the best hand
// that card can anchor out of the cards no earlier hand has claimed. Then it
// plays them all.
//
// r773 (owner: "work like a match 3 game would"): it is a CASCADE (js/cascade.js)
// with the fall HELD (fallHoldOn, js/card-fall.js). Every hand it will play lights
// up in its own hue; then they go one after another, each picked, hit and flown
// to the preview through the real playHand and the scoring queue, while the rest
// of the board stays where it is. When the last one has left, the board falls once
// and fills every hole. The Sleight leaves with that fall.
//
// Owner's rules: the hands count for Tricks and hand families, but they make no
// speed or complexity Focus (autoplayNoFocus). Ringer and Roll Call stand down
// while one of its hands is played (sweepPlaying), since either could pull a card
// another hand had claimed. It does not run in a boss round until its 5th
// improvement and waits for the board to settle. A hand that clears the goal ends
// the round as any hand does; the hands after it are not played.

let _sweepRun = null;       // { card, at:[r,c], hands, ids, i, locked: Map('r-c' -> hand index) } while a sweep is live
let _sweepPlaying = false;  // true while one of its hands is inside playHand

const SWEEP_MAX_HANDS = 12;
const SWEEP_LIGHT_MS = 85;  // the beat between hands lighting up before the first one goes

function sweepRunning() { return !!_sweepRun; }
function sweepPlaying() { return _sweepPlaying; }
function _swHue(i) { return (i * 47 + 40) % 360; }

// ── Finding the hands ──────────────────────────────────────────────────────────
// The best hand anchored on (r0,c0) from the still-free cards: every connected
// shape grown from that cell, kept when every card is load-bearing (one kicker
// allowed, as in play), ranked by summed component worth then by card count.
// Same search as autopilotBestHand, with a fixed start and an exclusion set.
function _sweepBestFrom(r0, c0, usable, cap, allow, minN) {
  const key = cells => cells.map(([r, c]) => r * 100 + c).sort((a, b) => a - b).join(',');
  const seen = new Set();
  let best = null, bestW = -1, budget = 2500;
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
  grow([[r0, c0]]);
  return best;
}

// Every hand the sweep will play, in reading order, each hand's cells in reading order.
function sweepHands() {
  const cap = Math.min(gridRows * gridCols > 30 ? 4 : 5, (limits.selection && limits.selection.current) || 3);
  const minN = Math.max(2, (typeof handMinSelection === 'function') ? handMinSelection() : 2);
  const allow = (typeof tagalongMax === 'function') ? tagalongMax() : 1;
  const used = new Set();
  const usable = (r, c) => r >= 0 && c >= 0 && r < gridRows && c < gridCols
    && !!gridData[r]?.[c] && cardCan(gridData[r][c], 'select') && !isCellBlocked(r, c)
    && !gridData[r][c]._isSleight && !used.has(r + '-' + c);
  const hands = [];
  for (let r = 0; r < gridRows && hands.length < SWEEP_MAX_HANDS; r++)
    for (let c = 0; c < gridCols && hands.length < SWEEP_MAX_HANDS; c++) {
      if (!usable(r, c)) continue;
      const best = _sweepBestFrom(r, c, usable, cap, allow, minN);
      if (!best) continue;
      best.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      best.forEach(([rr, cc]) => used.add(rr + '-' + cc));
      hands.push(best);
    }
  return hands;
}

// ── The sweep ──────────────────────────────────────────────────────────────────
function sweepStart(card, r, c) {
  if (_sweepRun) return;
  const dim = 'var(--cream-dim)';
  if (bossActive && !BAL.all_hands.boss) { refuse('All Hands cannot run in a boss round', { color: dim }); return; }   // r739: its 5th improvement lifts this
  const busy = animating || falling || !!danceAbortController || roundEnded
    || (typeof dealerHand !== 'undefined' && dealerHand)
    || (typeof cascadeRunning === 'function' && cascadeRunning())
    || (typeof sleightSpinLock !== 'undefined' && sleightSpinLock);
  if (busy) { refuse('All Hands: let the board settle first', { color: dim }); return; }
  const hands = sweepHands();
  if (!hands.length) { refuse('All Hands: no hand on the board', { color: dim }); return; }
  // The charge is spent now; the card itself leaves with the fall at the end,
  // because a fall before then would move every card the sweep has picked.
  card._usedThisRound = true;
  if (card._usesLeft !== 'infinite') card._usesLeft = Math.max(0, card._usesLeft - 1);
  const run = _sweepRun = { card, at: [r, c], hands, i: 0, locked: new Map(),
    ids: hands.map(h => h.map(([rr, cc]) => gridData[rr]?.[cc]?._id)) };
  document.body.classList.add('sweep-on');
  spinSleightTile(r, c);
  showMessage(`ALL HANDS: ${hands.length} hand${hands.length === 1 ? '' : 's'}`, 'var(--gold)');
  dbgEvent('info', 'sweep start', { hands: hands.length, cards: hands.reduce((s, h) => s + h.length, 0) });
  fallHoldOn();
  const ok = cascadeStart({
    name: 'all_hands', title: 'ALL HANDS', color: '#f5c042', holdFall: true,
    sub: () => `${hands.length} HAND${hands.length === 1 ? '' : 'S'}`,
    // Every hand it will play lights up in its own hue, one beat each.
    intro: async () => {
      for (let i = 0; i < hands.length; i++) {
        if (_sweepRun !== run || roundEnded) return;
        hands[i].forEach(([rr, cc]) => run.locked.set(rr + '-' + cc, i));
        render();
        if (typeof sfxCascadePick === 'function') sfxCascadePick(i);
        await dncWait(SWEEP_LIGHT_MS);
      }
      await dncWait(160);
    },
    // The next planned hand whose cards are still where they were and still make a hand.
    next: () => {
      while (_sweepRun === run && run.i < hands.length) {
        const i = run.i++, h = hands[i];
        const same = h.every(([rr, cc], j) => { const cd = gridData[rr]?.[cc]; return cd && cd._id === run.ids[i][j] && cardCan(cd, 'select') && !isCellBlocked(rr, cc); });
        const res = same ? handComponentsFor(h) : null;
        h.forEach(([rr, cc]) => { run.locked.delete(rr + '-' + cc); const cd = gridData[rr]?.[cc]; if (cd) document.querySelector(`#grid [data-card-id="${cd._id}"]`)?.classList.remove('sweep-locked'); });
        if (res && res.playable) { run.cur = i; return h; }
        dbgEvent('warn', 'sweep: a planned hand is gone', { i });
      }
      return null;
    },
    hue: () => _swHue(run.cur || 0),
    label: k => `${k} / ${hands.length}`,
    play: () => { _sweepPlaying = true; try { playHand(); } finally { _sweepPlaying = false; } },
    end: () => _sweepFinish(),
  });
  if (!ok) _sweepFinish();
}

// The run is over: the hold lets go, the board falls once and fills every hole,
// and the Sleight leaves with that fall (play mode: into the played pile with
// its charges; at 0 charges discardToPlayed drops it for good).
function _sweepFinish() {
  const run = _sweepRun;
  _sweepRun = null; _sweepPlaying = false;
  document.body.classList.remove('sweep-on');
  if (!run) return;
  run.locked.clear();
  document.querySelectorAll('#grid .sweep-locked').forEach(el => el.classList.remove('sweep-locked'));
  const [sr, sc] = run.at;
  const cells = (gridData[sr]?.[sc] === run.card) ? [[sr, sc]] : [];
  if (!cells.length) dbgEvent('warn', 'sweep: Sleight moved; not removed');
  if (!roundEnded && typeof sfxFlipShuffle === 'function') sfxFlipShuffle();
  fallHoldOff(cells);
  dbgEvent('ok', 'sweep done', { hands: run.i });
}

// From render()'s tail: the hands still waiting keep their mark on the board.
function sweepPaint() {
  const run = _sweepRun;
  const gridEl = document.getElementById('grid'); if (!gridEl) return;
  if (!run || !run.locked.size) return;
  run.locked.forEach((hi, k) => {
    const [r, c] = k.split('-').map(Number);
    const card = gridData[r]?.[c]; if (!card) return;
    const el = gridEl.querySelector(`[data-card-id="${card._id}"]`); if (!el) return;
    el.classList.add('sweep-locked');
    el.style.setProperty('--sw-h', String(_swHue(hi)));
  });
}

// A new run (startGame) drops any sweep in flight, with no fall.
function sweepReset() {
  _sweepRun = null; _sweepPlaying = false;
  document.body.classList.remove('sweep-on');
  if (typeof fallHoldDrop === 'function') fallHoldDrop();
}
