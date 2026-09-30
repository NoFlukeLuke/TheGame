// ══════════════════════════════════════════════════════════════════════════
// THE SCOREBOARD (r368, restyled and extended r375) - js/squares-report.js
//
// r375 changed three things about it, all owner asks:
//   * IT IS PAPER, NOT A CRT (css/squares-report.css). "Make the final scorecard
//     look way more modern and better, the lines are hard to follow, the colours
//     aren't good, make it feel more like a new york times game overall." A
//     result is READ rather than played: a light sheet, one accent, thin rules,
//     real leading. Every rule is scoped under #sq-card, so the licence to break
//     house style cannot reach the rest of the game.
//   * EVERY LINE IS LABELLED. Each grid is drawn with its hand and its score on
//     the left of every row and above every column, so the board reads like a
//     scored crossword rather than a picture with a total under it.
//   * SUITS ARE COLOURED, because an all-black grid of faces cannot be scanned
//     for the flush you were building. Diamonds is darkened - the board's gold
//     is tuned for a cream card face, not for white paper.
//   * AND THE 5x5 GETS IT TOO. It has no par to compare against, so the par
//     columns simply drop; what it had instead was the plainest block of
//     monospace text in the game.
//
// A run of daily grids ended on a block of monospace text. It now ends on a
// SCOREBOARD: a row per grid, what you scored against the best the board could
// have paid, and a tap on any row to see exactly where the difference was.
//
// THE COMPARISON IS A FLIP, NOT A DIFF (owner's call). Two boards - yours and
// the one that would have paid par - drawn in the same place, with a button
// that switches between them. Your board marks the cells that are wrong with a
// red cross; the optimal board marks those same cells with a green tick, so the
// two halves of "what did I get wrong" and "what should have been there" land
// on the same square in the same place and the eye does the subtraction.
//
// A LIST OF DIFFERENCES WAS THE OTHER OPTION AND IS WORSE. The thing being
// compared is a PICTURE - which cards sit next to which - and reading "R2C3
// should be 7 of hearts" ten times does not reassemble into one.
// ══════════════════════════════════════════════════════════════════════════

// ── ALIGNING THE OPTIMAL BOARD ─────────────────────────────────────────────
// A board's score does not care which way round it is: every row and every
// column is scored the same way, so rotating or reflecting a packing produces a
// different-looking board worth exactly the same. The search returns whichever
// one it happened to find, and comparing a player's board against a mirror of
// itself is a review that shows nine mistakes where there were none.
//
// So all EIGHT symmetries are tried and the one that agrees with the player's
// board in the most cells is kept.
//
// ONLY IF THE SCORE SURVIVES, and that is the catch worth knowing about. A LINE
// BOON is attached to a NUMBERED line - "ROW 2 scores double" - so a transform
// that moves row 2 somewhere else changes what the board is worth. Each
// candidate is therefore re-scored against that grid's own boons and kept only
// when it still pays par. With no boons in play (every grid 1, and every grid
// at all when the roll gives consumables) all eight are always available.
const SQD_SYMS = [
  { id: 'id',   f: (r, c, n) => [r, c] },
  { id: 'r90',  f: (r, c, n) => [c, n - 1 - r] },
  { id: 'r180', f: (r, c, n) => [n - 1 - r, n - 1 - c] },
  { id: 'r270', f: (r, c, n) => [n - 1 - c, r] },
  { id: 'fh',   f: (r, c, n) => [r, n - 1 - c] },
  { id: 'fv',   f: (r, c, n) => [n - 1 - r, c] },
  { id: 'd1',   f: (r, c, n) => [c, r] },
  { id: 'd2',   f: (r, c, n) => [n - 1 - c, n - 1 - r] },
];
function sqdTransform(board, n, sym) {
  const out = new Array(n * n).fill(null);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const [rr, cc] = sym.f(r, c, n);
    out[rr * n + cc] = board[r * n + c];
  }
  return out;
}
const sqdSameFace = (a, b) => !!a && !!b && a.rank === b.rank && a.suit === b.suit;
function sqdMatchCount(a, b) {
  let m = 0;
  for (let i = 0; i < a.length; i++) if (sqdSameFace(a[i], b[i])) m++;
  return m;
}
// The best-aligned optimal board, and how many cells it agrees with.
function sqdAlignOptimal(g) {
  if (!g.opt || !g.mine) return { board: g.opt, sym: 'id', match: 0 };
  const n = g.n, par = g.par;
  let best = null;
  for (const sym of SQD_SYMS) {
    const b = sym.id === 'id' ? g.opt : sqdTransform(g.opt, n, sym);
    // A TRANSFORM THAT COSTS THE BOARD ITS SCORE IS NOT THE SAME BOARD.
    if (sym.id !== 'id') {
      const sc = sqdScoreBoard(b, n, g.boons);
      if (sc.total < par) continue;
    }
    const m = sqdMatchCount(g.mine, b);
    if (!best || m > best.match) best = { board: b, sym: sym.id, match: m };
  }
  return best || { board: g.opt, sym: 'id', match: sqdMatchCount(g.mine, g.opt) };
}

// ── THE SHEET ──────────────────────────────────────────────────────────────
// One body-level surface for both screens, for the usual #cabinet CSS-zoom
// reason. It is NOT `sqOverlay()`: that is the mode's CRT console, and the
// whole point of this pass is that a result is not one.
function sqcSheet() {
  let el = document.getElementById('sq-card');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sq-card';
    el.innerHTML = '<div class="sqc-sheet"><div class="sqc-inner"></div>'
                 + '<div class="sqc-foot"></div></div>';
    document.body.appendChild(el);
  }
  return el;
}
function sqcPaint(innerHTML, footHTML) {
  // A TIP ALREADY ON SCREEN HAS TO GO. `insightsBlocked` stops a NEW one landing
  // here (js/insights.js), but one opened during the last grid stays up until it
  // is dismissed - and on a phone it covers most of the sheet.
  if (typeof dismissInsight === 'function') { try { dismissInsight(); } catch (e) {} }
  const el = sqcSheet();
  el.querySelector('.sqc-inner').innerHTML = innerHTML;
  el.querySelector('.sqc-foot').innerHTML = footHTML;
  el.querySelector('.sqc-sheet').scrollTop = 0;
  el.classList.add('show');
  return el;
}
const sqcClose = () => document.getElementById('sq-card')?.classList.remove('show');
function sqdPct(a, b) { return b > 0 ? Math.round(100 * a / b) : 0; }

// The four glyph suits get a class; anything else (Spectrum's colour deck) is
// left in the sheet's own ink rather than guessed at.
const SQC_SUIT = { '♥': 'h', '♦': 'd', '♠': 's', '♣': 'c' };
function sqcFaceHTML(f, mark) {
  if (!f) return `<div class="sqc-cell empty"></div>`;
  const wild = (typeof isWildRank === 'function') && isWildRank(f.rank);
  return `<div class="sqc-cell ${SQC_SUIT[f.suit] || ''}${wild ? ' wild' : ''}${mark ? ' ' + mark : ''}">`
       + `<span class="sqc-r">${f.rank}</span><span class="sqc-s">${f.suit}</span>`
       + (mark === 'bad' ? '<span class="sqc-mark bad">✕</span>' : '')
       + (mark === 'fix' ? '<span class="sqc-mark fix">✓</span>' : '')
       + `</div>`;
}
// THE BOARD AND ITS LABELS ARE ONE CSS GRID of (N+1)x(N+1): the corner, the
// column headers, then each row headed by its own. A header can then never
// drift off its line at any board size, with nothing measured.
//
// `lines` is the snapshot's own list (js/squares-mode.js) - the board it
// describes has long since gone back into the deck, so nothing here can be
// re-scored. The OPTIMAL board has no line list of its own and passes none,
// which is why the labels are drawn only for the player's.
function sqcGridHTML(n, faces, lines, marks) {
  const at = i => (lines && lines[i]) || null;
  let h = `<div class="sqc-grid${lines ? '' : ' bare'}" style="--sqcn:${n}">`;
  if (lines) {
    h += `<div class="sqc-corner"></div>`;
    for (let c = 0; c < n; c++) {
      const f = at(n + c);
      h += `<div class="sqc-hdr col"><span class="sqc-hn">${f ? sqHandShort(f.name) : ''}</span>`
         + `<span class="sqc-hv">${f ? Math.round(f.total).toLocaleString() : ''}</span></div>`;
    }
  }
  for (let r = 0; r < n; r++) {
    if (lines) {
      const f = at(r);
      h += `<div class="sqc-hdr row"><span class="sqc-hn">${f ? sqHandShort(f.name) : ''}</span>`
         + `<span class="sqc-hv">${f ? Math.round(f.total).toLocaleString() : ''}</span></div>`;
    }
    for (let c = 0; c < n; c++) {
      const k = r * n + c;
      h += sqcFaceHTML(faces[k], marks ? marks[k] : '');
    }
  }
  return h + '</div>';
}

// ── THE SCOREBOARD ─────────────────────────────────────────────────────────
function sqdShowScoreboard(onDone) {
  const tot = sqdGrids.reduce((t, g) => t + g.score, 0);
  const par = sqdGrids.reduce((t, g) => t + g.par, 0);
  const exact = sqdGrids.every(g => g.exact);
  const daily = sqdGrids.length ? sqdGrids[0].daily !== false : true;
  const best = sqdGrids.reduce((m, g) => Math.max(m, g.score), 0);
  const stat = (k, v, sub) => `<div class="sqc-stat"><span class="sqc-k">${k}</span>`
    + `<span class="sqc-v">${v}</span>${sub ? `<span class="sqc-sub2">${sub}</span>` : ''}</div>`;

  let extra = '';
  const lb = sqdBoons.filter(b => b.kind !== 'cons');
  if (daily && lb.length) extra = `<span>Boosts</span>${lb.map(sqdBoonLabel).join(' &middot; ')}`;
  else if (!daily) {
    const tn = (acquiredTricks || []).map(t => t.name).join(' &middot; ');
    if (tn) extra = `<span>Tricks</span>${tn}`;
  }

  sqcPaint(
    `<div class="sqc-eyebrow">Poker Squares &middot; ${SQ_N} &times; ${SQ_N}`
      + (daily ? '' : ` &middot; ${sqMode === 'all' ? 'Score all' : 'Select score'}`)
      + (daily && typeof sqdRanks !== 'undefined' && sqdRanks ? ` &middot; ${sqdRanks[0]}–${sqdRanks[sqdRanks.length - 1]}` : '') + `</div>
     <div class="sqc-total">${tot.toLocaleString()}</div>
     <div class="sqc-sub">${sqdGrids.length} grid${sqdGrids.length === 1 ? '' : 's'} played</div>
     <div class="sqc-stats">
       ${par ? stat(exact ? 'Best possible' : 'Best found', par.toLocaleString(), sqdPct(tot, par) + '% reached') : ''}
       ${stat('Best grid', best.toLocaleString())}
       ${stat('Per grid', sqdGrids.length ? Math.round(tot / sqdGrids.length).toLocaleString() : '0')}
     </div>
     ${extra ? `<div class="sqc-extra">${extra}</div>` : ''}
     <div class="sqc-rule"></div>
     ${sqdGrids.map(sqcGridBlock).join('')}`,
    `<button class="sqc-done" id="sq-sb-ok">FINISH</button>`);

  document.getElementById('sq-sb-ok').onclick = () => { sqcClose(); onDone && onDone(); };
  document.querySelectorAll('#sq-card .sqc-cmpbtn').forEach(b => b.onclick = () => {
    if (typeof sfxRewardSelect === 'function') sfxRewardSelect();
    sqdShowCompare(+b.dataset.i, () => sqdShowScoreboard(onDone));
  });
}

// One grid: its score, how close to par it came, the board with every line
// priced, and - where there is a par to compare against - the way in to it.
function sqcGridBlock(g, idx) {
  const pct = g.par ? sqdPct(g.score, g.par) : 0;
  return `<section class="sqc-block">
      <header class="sqc-bh">
        <h3>Grid ${g.round}</h3>
        <div class="sqc-bs"><b>${g.score.toLocaleString()}</b>`
      + (g.par ? `<span>${pct}% of ${g.par.toLocaleString()}</span>` : '')
      + `</div>
      </header>
      ${g.par ? `<div class="sqc-meter"><i style="width:${Math.min(100, pct)}%"></i></div>` : ''}
      ${sqcGridHTML(g.n, g.mine, g.lines)}
      ${g.opt ? `<button class="sqc-cmpbtn" data-i="${idx}">Compare with the best packing</button>` : ''}
    </section>`;
}

// ── ONE GRID, SIDE BY SIDE IN ONE PLACE ────────────────────────────────────
let _sqdCmpShow = 'mine';
function sqdShowCompare(i, back) {
  const g = sqdGrids[i]; if (!g) { back(); return; }
  const aligned = sqdAlignOptimal(g);
  _sqdCmpShow = 'mine';
  const paint = () => {
    const n = g.n, mine = g.mine, opt = aligned.board;
    const diff = [];
    for (let k = 0; k < n * n; k++) diff.push(!sqdSameFace(mine[k], opt && opt[k]));
    const wrong = diff.filter(Boolean).length;
    const showMine = _sqdCmpShow === 'mine';
    const marks = diff.map(d => !d ? '' : (showMine ? 'bad' : 'fix'));
    // THE OPTIMAL BOARD IS LABELLED TOO, and it has to be re-scored to be: the
    // snapshot carries the line list for the board that was PLAYED and nothing
    // for the one that was not. `sqdScoreBoard` is the same function the
    // symmetry check already runs, against this grid's own boons, so the labels
    // cannot disagree with the par the row quotes. A 5x5 has no `opt` at all,
    // so this is only ever reached on a daily.
    let optLines = null;
    if (!showMine) {
      try { optLines = sqdScoreBoard(opt, n, g.boons).lines; } catch (e) { optLines = null; }
    }
    sqcPaint(
      `<div class="sqc-eyebrow">Grid ${g.round}</div>
       <div class="sqc-total">${(showMine ? g.score : g.par).toLocaleString()}</div>
       <div class="sqc-sub">${showMine ? 'your grid' : 'the best packing of the same tiles'}</div>
       <div class="sqc-rule"></div>
       <section class="sqc-block">
         ${sqcGridHTML(n, showMine ? mine : opt, showMine ? g.lines : optLines, marks)}
         <div class="sqc-legend">${wrong
           ? `<b>${wrong}</b> of ${n * n} cells differ &middot; <span class="lg bad">✕ yours</span> <span class="lg fix">✓ the best packing</span>`
           : 'Identical — you found the best packing.'}</div>
       </section>`,
      `<button class="sqc-done ghost" id="sq-cmp-flip">${showMine ? 'SHOW THE BEST PACKING' : 'SHOW YOUR GRID'}</button>`
      + `<button class="sqc-done" id="sq-cmp-back">BACK</button>`);
    document.getElementById('sq-cmp-back').onclick = () => back();
    document.getElementById('sq-cmp-flip').onclick = () => {
      _sqdCmpShow = showMine ? 'opt' : 'mine';
      if (typeof sfxCardFlip === 'function') sfxCardFlip(); else if (typeof sfxRewardSelect === 'function') sfxRewardSelect();
      paint();
    };
  };
  paint();
}
