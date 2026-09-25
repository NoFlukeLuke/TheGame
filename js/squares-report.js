// ══════════════════════════════════════════════════════════════════════════
// THE DAILY SCOREBOARD (r368) - js/squares-report.js
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

// ── THE SCOREBOARD ─────────────────────────────────────────────────────────
function sqdPct(a, b) { return b > 0 ? Math.round(100 * a / b) : 0; }
function sqdShowScoreboard(onDone) {
  const ov = sqOverlay();
  const tot = sqdGrids.reduce((t, g) => t + g.score, 0);
  const par = sqdGrids.reduce((t, g) => t + g.par, 0);
  const exact = sqdGrids.every(g => g.exact);
  ov.querySelector('.sq-eyebrow').textContent = 'Run complete';
  ov.querySelector('.sq-title').textContent = 'Scoreboard';
  ov.querySelector('.sq-lead').textContent = 'Tap a grid to see it against the best packing of the same tiles.';
  ov.querySelector('.sq-body').innerHTML =
    `<table class="sq-sb">
       <thead><tr><th>GRID</th><th>YOURS</th><th>${exact ? 'BEST' : 'BEST FOUND'}</th><th></th><th></th></tr></thead>
       <tbody>${sqdGrids.map((g, i) => {
         const p = sqdPct(g.score, g.par);
         return `<tr class="sq-sbr" data-i="${i}">
           <td class="sq-sbg">${g.round}</td>
           <td class="sq-sbv">${g.score.toLocaleString()}</td>
           <td class="sq-sbp">${g.par.toLocaleString()}</td>
           <td class="sq-sbbarw"><span class="sq-sbbar" style="width:${Math.min(100, p)}%"></span></td>
           <td class="sq-sbpct">${p}%</td></tr>`;
       }).join('')}</tbody>
       <tfoot><tr><td class="sq-sbg">ALL</td><td class="sq-sbv">${tot.toLocaleString()}</td>
         <td class="sq-sbp">${par.toLocaleString()}</td>
         <td class="sq-sbbarw"><span class="sq-sbbar" style="width:${Math.min(100, sqdPct(tot, par))}%"></span></td>
         <td class="sq-sbpct">${sqdPct(tot, par)}%</td></tr></tfoot>
     </table>
     <div class="sq-sbnote">${SQ_N}x${SQ_N} · ${sqdGrids.length} grid${sqdGrids.length === 1 ? '' : 's'}`
     + (sqdRanks ? ` · ranks ${sqdRanks[0]}–${sqdRanks[sqdRanks.length - 1]}` : '')
     + (sqdBoons.filter(b => b.kind !== 'cons').length ? ` · ${sqdBoons.filter(b => b.kind !== 'cons').map(sqdBoonLabel).join(' · ')}` : '')
     + `</div>`;
  ov.querySelector('.sq-foot').innerHTML = `<button class="sq-btn go" id="sq-sb-ok">FINISH</button>`;
  ov.querySelector('#sq-sb-ok').onclick = () => { sqCloseOverlay(); onDone && onDone(); };
  ov.querySelectorAll('.sq-sbr').forEach(tr => tr.onclick = () => {
    if (typeof sfxRewardSelect === 'function') sfxRewardSelect();
    sqdShowCompare(+tr.dataset.i, () => sqdShowScoreboard(onDone));
  });
  sqShowOverlay();
}

// ── ONE GRID, SIDE BY SIDE IN ONE PLACE ────────────────────────────────────
let _sqdCmpShow = 'mine';
function sqdCardHTML(f, mark) {
  if (!f) return `<div class="sq-cc empty"></div>`;
  const wild = (typeof isWildRank === 'function') && isWildRank(f.rank);
  const sc = (typeof sqSuitCls === 'function') ? sqSuitCls(f.suit) : '';
  return `<div class="sq-cc${wild ? ' wild' : ''}${mark ? ' ' + mark : ''}">`
       + `<span class="sq-ccr ${sc}">${f.rank}</span><span class="sq-ccs ${sc}">${f.suit}</span>`
       + (mark === 'bad' ? '<span class="sq-ccm bad">✕</span>' : '')
       + (mark === 'fix' ? '<span class="sq-ccm fix">✓</span>' : '')
       + `</div>`;
}
function sqdCompareBody(g, aligned) {
  const n = g.n, mine = g.mine, opt = aligned.board;
  const showing = _sqdCmpShow === 'mine' ? mine : opt;
  const diff = [];
  for (let i = 0; i < n * n; i++) diff.push(!sqdSameFace(mine[i], opt && opt[i]));
  const wrong = diff.filter(Boolean).length;
  const cells = showing.map((f, i) =>
    sqdCardHTML(f, !diff[i] ? '' : (_sqdCmpShow === 'mine' ? 'bad' : 'fix'))).join('');
  const sc = _sqdCmpShow === 'mine' ? g.score : g.par;
  return `<div class="sq-cmp-head">
            <span class="sq-cmp-who ${_sqdCmpShow}">${_sqdCmpShow === 'mine' ? 'YOUR GRID' : 'BEST PACKING'}</span>
            <span class="sq-cmp-sc">${sc.toLocaleString()}</span>
          </div>
          <div class="sq-cmp-grid ${_sqdCmpShow}" style="grid-template-columns:repeat(${n},1fr)">${cells}</div>
          <div class="sq-cmp-legend">${wrong
            ? `<b>${wrong}</b> of ${n * n} cells differ · <span class="sq-lg bad">✕ yours</span> <span class="sq-lg fix">✓ the best packing</span>`
            : 'Identical — you found the best packing.'}</div>`;
}
function sqdShowCompare(i, back) {
  const g = sqdGrids[i]; if (!g) { back(); return; }
  const aligned = sqdAlignOptimal(g);
  _sqdCmpShow = 'mine';
  const ov = sqOverlay();
  ov.querySelector('.sq-eyebrow').textContent = `Grid ${g.round}`;
  ov.querySelector('.sq-title').textContent = `${g.score.toLocaleString()} of ${g.par.toLocaleString()}`;
  ov.querySelector('.sq-lead').textContent = g.opt
    ? 'The same tiles, packed for the most points. Flip between the two.'
    : 'No best packing was recorded for this grid.';
  const paint = () => {
    ov.querySelector('.sq-body').innerHTML = g.opt ? sqdCompareBody(g, aligned) : '';
    const f = ov.querySelector('#sq-cmp-flip');
    if (f) f.textContent = _sqdCmpShow === 'mine' ? 'SHOW THE BEST PACKING' : 'SHOW YOUR GRID';
  };
  ov.querySelector('.sq-foot').innerHTML =
    (g.opt ? `<button class="sq-btn" id="sq-cmp-flip"></button>` : '')
    + `<button class="sq-btn go" id="sq-cmp-back">BACK</button>`;
  ov.querySelector('#sq-cmp-back').onclick = () => back();
  const flip = ov.querySelector('#sq-cmp-flip');
  if (flip) flip.onclick = () => {
    _sqdCmpShow = _sqdCmpShow === 'mine' ? 'opt' : 'mine';
    if (typeof sfxCardFlip === 'function') sfxCardFlip(); else if (typeof sfxRewardSelect === 'function') sfxRewardSelect();
    paint();
  };
  paint();
  sqShowOverlay();
}
