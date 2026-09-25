// ══════════════════════════════════════════════════════════════════════════
// THE POKER SQUARES SCORECARD (r326) - js/squares-card.js + css/squares-card.css
//
// The end of a run, as a puzzle result rather than as a terminal dump. What it
// replaces was a monospace block inside the mode's CRT console: correct, and
// unreadable as a RESULT - every grid's arithmetic in one column of fixed-width
// text, in the one place a player wants to look at what they built.
//
// THREE DECISIONS, and the first one is why this file exists at all.
//
// 1. IT IS NOT THE GAME'S CHROME, deliberately (owner's call: "if that means
//    ditching some of the css from the rest of the game that's fine"). A result
//    screen is read, not played: it wants a light surface, real leading and one
//    accent, not an indigo CRT with scanlines over it. Everything here is
//    scoped under #sq-card so none of it can reach the rest of the game.
//
// 2. EVERY GRID IS SHOWN, WITH ITS LINES LABELLED. A row's or column's hand and
//    what it paid sit BESIDE the line, on the left and above, so the board reads
//    like a scored crossword: the thing you look at is the board, and the number
//    is where the eye already is.
//
// 3. SUITS ARE COLOURED. Ranks and suits on this card take the game's own suit
//    hues, because an all-black grid of faces cannot be scanned for the flush
//    you were building. Diamonds is darkened - the board's gold is tuned for a
//    cream card face, not for white paper.
// ══════════════════════════════════════════════════════════════════════════

// A header has one cell of width (about 54px) or one row of height, so the full
// name does not fit and wrapping "THREE OF A KIND" to three lines is worse than
// naming it the way a player says it out loud.
const SQ_HAND_SHORT = {
  'High Card': 'HIGH', 'Pair': 'PAIR', 'Two Pair': '2 PAIR',
  'Three of a Kind': 'TRIPS', 'Four of a Kind': 'QUADS',
  'Full House': 'FULL HSE', 'Straight': 'STRAIGHT', 'Straight Flush': 'STR FLUSH',
  'Flush': 'FLUSH', 'Flush of 3': 'FLUSH', 'Flush of 4': 'FLUSH',
  'Run of 3': 'RUN 3', 'Run of 4': 'RUN 4', 'Run': 'RUN',
};
const sqHandShort = n => SQ_HAND_SHORT[n] || (n || '').toUpperCase();

// The four glyph suits get a class; anything else (Spectrum's colour deck) is
// left in the card's own ink rather than guessed at.
const SQ_SUIT_CLS = { '♥': 'h', '♦': 'd', '♠': 's', '♣': 'c' };
const sqCardSuitCls = s => SQ_SUIT_CLS[s] || '';

function sqCardEl() {
  let el = document.getElementById('sq-card');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sq-card';
    el.innerHTML = '<div class="sqc-sheet"><div class="sqc-inner"></div>'
                 + '<div class="sqc-foot"><button class="sqc-done">DONE</button></div></div>';
    document.body.appendChild(el);   // BODY LEVEL: anything inside #cabinet takes its CSS zoom
  }
  return el;
}

// ── ONE GRID ───────────────────────────────────────────────────────────────
// A CSS grid of (N+1) x (N+1): the corner, the column headers, then each row
// headed by its own. The board and its labels are therefore ONE grid rather
// than three boxes lined up by eye, which is what keeps a header on its line at
// every board size with no measuring.
function sqcBoardHTML(g) {
  const N = g.n, L = g.lines;
  const row = i => L[i] || { name: 'High Card', total: 0 };
  let h = `<div class="sqc-grid" style="--sqcn:${N}">`;
  h += `<div class="sqc-corner"></div>`;
  for (let c = 0; c < N; c++) {
    const f = row(N + c);
    h += `<div class="sqc-hdr col"><span class="sqc-hn">${sqHandShort(f.name)}</span>`
       + `<span class="sqc-hv">${Math.round(f.total).toLocaleString()}</span></div>`;
  }
  for (let r = 0; r < N; r++) {
    const f = row(r);
    h += `<div class="sqc-hdr row"><span class="sqc-hn">${sqHandShort(f.name)}</span>`
       + `<span class="sqc-hv">${Math.round(f.total).toLocaleString()}</span></div>`;
    for (let c = 0; c < N; c++) {
      const cd = g.board[r] && g.board[r][c];
      if (!cd) { h += `<div class="sqc-cell empty"></div>`; continue; }
      h += `<div class="sqc-cell ${sqCardSuitCls(cd.suit)}">`
         + `<span class="sqc-r">${cd.rank}</span><span class="sqc-s">${cd.suit}</span></div>`;
    }
  }
  return h + '</div>';
}

function sqcPct(a, b) { return b ? Math.round(100 * a / b) : 0; }

function sqcGridBlock(g, idx) {
  const pct = g.par ? sqcPct(g.score, g.par) : 0;
  return `<section class="sqc-block">
      <header class="sqc-bh">
        <h3>Grid ${idx + 1}</h3>
        <div class="sqc-bs"><b>${Math.round(g.score).toLocaleString()}</b>`
      + (g.par ? `<span>${pct}% of ${Math.round(g.par).toLocaleString()}</span>` : '')
      + `</div>
      </header>
      ${g.par ? `<div class="sqc-meter"><i style="width:${Math.min(100, pct)}%"></i></div>` : ''}
      ${sqcBoardHTML(g)}
    </section>`;
}

function sqShowScorecard(onDone) {
  const el = sqCardEl();
  const inner = el.querySelector('.sqc-inner');
  const grids = sqGrids.slice();
  const par = (typeof sqdParTotal === 'number') ? sqdParTotal : 0;
  const exact = !!sqdParExact;
  const daily = grids.length ? grids[0].daily : sqDaily();
  const best = grids.reduce((m, g) => Math.max(m, g.score), 0);
  const stat = (k, v, s) => `<div class="sqc-stat"><span class="sqc-k">${k}</span>`
    + `<span class="sqc-v">${v}</span>${s ? `<span class="sqc-s2">${s}</span>` : ''}</div>`;

  let extra = '';
  if (daily && sqdBoons.length) extra = sqdBoons.map(sqdBoonLabel).join(' &middot; ');
  else if (!daily) extra = (acquiredTricks || []).map(t => t.name).join(' &middot; ');

  inner.innerHTML =
    `<div class="sqc-eyebrow">Poker Squares &middot; ${SQ_N} &times; ${SQ_N}`
      + (daily ? '' : ` &middot; ${sqMode === 'all' ? 'Score all' : 'Select score'}`) + `</div>
     <div class="sqc-total">${Math.round(sqTotal).toLocaleString()}</div>
     <div class="sqc-sub">${grids.length} grid${grids.length === 1 ? '' : 's'} played</div>
     <div class="sqc-stats">
       ${par ? stat(exact ? 'Best possible' : 'Best found', Math.round(par).toLocaleString(), sqcPct(sqTotal, par) + '% reached') : ''}
       ${stat('Best grid', Math.round(best).toLocaleString())}
       ${stat('Per grid', grids.length ? Math.round(sqTotal / grids.length).toLocaleString() : '0')}
     </div>
     ${extra ? `<div class="sqc-extra"><span>${daily ? 'Boosts' : 'Tricks'}</span>${extra}</div>` : ''}
     <div class="sqc-rule"></div>
     ${grids.map(sqcGridBlock).join('')}`;

  el.querySelector('.sqc-done').onclick = () => { el.classList.remove('show'); onDone && onDone(); };
  el.querySelector('.sqc-sheet').scrollTop = 0;
  el.classList.add('show');
}
