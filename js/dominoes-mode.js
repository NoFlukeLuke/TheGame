// ══════════════════════════════════════════════
// DOMINOES MODE — runtime subsystem
// ══════════════════════════════════════════════
// Fully isolated from Normal mode. The shared entry points (render, playHand,
// doDiscard, initGridData, startGame grid-sizing) route here when
// ACTIVE_MODE.id === 'dominoes'; otherwise none of this runs.
//
// Board model (separate from Normal's gridData):
//   dominoGrid[r][c] = pieceId | null      — cell occupancy, for gravity/gaps
//   dominoPieces[id] = { id, a, b, orient:'h'|'v', cells:[[r,c],[r,c]] }
//     - cells[0] is the top/left half (shows value `a`); cells[1] shows `b`.
// One <div data-domino-id> is rendered per piece, spanning its two cells.

let dominoGrid     = [];
let dominoPieces   = {};
let dominoDeck     = [];
let dominoSelected = [];   // piece ids, max 3
let _dpieceId      = 0;

const DOMINO_ROWS = 8;
const DOMINO_COLS = 8;

function _domWait(ms) { return new Promise(res => setTimeout(res, ms)); }

// ── Deck ──
function dominoDrawTile() {
  if (dominoDeck.length === 0) dominoDeck = buildDominoDeck();
  const t = dominoDeck.pop();
  // Randomly flip halves so identical tiles don't all read the same way.
  return Math.random() < 0.5 ? [t[1], t[0]] : [t[0], t[1]];
}

// ── Cell helpers ──
function dominoInBounds(r, c) { return r >= 0 && r < gridRows && c >= 0 && c < gridCols; }
function dominoCellEmpty(r, c) { return dominoInBounds(r, c) && dominoGrid[r][c] == null; }

function dominoPlace(a, b, cells, orient) {
  const id = ++_dpieceId;
  const p = { id, a, b, orient, cells };
  dominoPieces[id] = p;
  cells.forEach(([r, c]) => { dominoGrid[r][c] = id; });
  return p;
}

function dominoRemovePiece(id) {
  const p = dominoPieces[id];
  if (!p) return;
  p.cells.forEach(([r, c]) => { if (dominoGrid[r][c] === id) dominoGrid[r][c] = null; });
  delete dominoPieces[id];
}

// ── Gravity (rigid pieces, natural gaps) ──
function dominoMaxRow(p) { return Math.max(p.cells[0][0], p.cells[1][0]); }

function dominoCanDrop(p) {
  for (const [r, c] of p.cells) {
    const nr = r + 1;
    if (nr >= gridRows) return false;
    const occ = dominoGrid[nr][c];
    if (occ != null && occ !== p.id) return false; // blocked by another piece
  }
  return true;
}

function dominoMovePiece(p, dr) {
  p.cells.forEach(([r, c]) => { if (dominoGrid[r][c] === p.id) dominoGrid[r][c] = null; });
  p.cells = p.cells.map(([r, c]) => [r + dr, c]);
  p.cells.forEach(([r, c]) => { dominoGrid[r][c] = p.id; });
}

// Drop every piece as far as it will go. Bottom-most pieces settle first.
function dominoSettle() {
  let moved = true, guard = 0;
  while (moved && guard++ < 500) {
    moved = false;
    const ps = Object.values(dominoPieces).sort((a, b) => dominoMaxRow(b) - dominoMaxRow(a));
    for (const p of ps) {
      if (dominoCanDrop(p)) { dominoMovePiece(p, 1); moved = true; }
    }
  }
}

// Find an empty placement in the top row to spawn a new piece into.
function dominoFindSpawnSpot() {
  const cols = shuffle([...Array(gridCols).keys()]);
  const tryV = () => { for (const c of cols) if (dominoCellEmpty(0, c) && dominoCellEmpty(1, c)) return { orient: 'v', r: 0, c }; return null; };
  const tryH = () => { for (const c of cols) if (c + 1 < gridCols && dominoCellEmpty(0, c) && dominoCellEmpty(0, c + 1)) return { orient: 'h', r: 0, c }; return null; };
  const wantV = Math.random() < 0.5;
  return wantV ? (tryV() || tryH()) : (tryH() || tryV());
}

// Fill the board by spawning pieces at the top and settling, until nothing more fits.
// Leftover un-fillable cells become natural gaps.
function dominoRefill() {
  let guard = 0;
  while (guard++ < 300) {
    const spot = dominoFindSpawnSpot();
    if (!spot) break;
    const [a, b] = dominoDrawTile();
    if (spot.orient === 'h') dominoPlace(a, b, [[spot.r, spot.c], [spot.r, spot.c + 1]], 'h');
    else                     dominoPlace(a, b, [[spot.r, spot.c], [spot.r + 1, spot.c]], 'v');
    dominoSettle();
  }
}

function dominoInitBoard() {
  gridRows = DOMINO_ROWS; gridCols = DOMINO_COLS;
  if (typeof recomputeGridMetrics === 'function') recomputeGridMetrics();
  dominoGrid = Array.from({ length: gridRows }, () => new Array(gridCols).fill(null));
  // Keep a null gridData of matching dims so any stray shared access is safe.
  gridData = Array.from({ length: gridRows }, () => new Array(gridCols).fill(null));
  dominoPieces = {}; dominoSelected = []; _dpieceId = 0;
  dominoDeck = buildDominoDeck();
  dominoRefill();
}

// ── Rendering ──
// Classic domino pip patterns on a 3×3 grid (index 0=TL … 8=BR).
const DOMINO_PIP_PATTERN = {
  0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
function dominoPipHTML(value) {
  const on = new Set(DOMINO_PIP_PATTERN[value] || []);
  const color = DOMINO_PIP_COLORS[value] || '#fff';
  let cells = '';
  for (let i = 0; i < 9; i++) cells += `<span class="dom-pip${on.has(i) ? ' on' : ''}"${on.has(i) ? ` style="background:${color}"` : ''}></span>`;
  return `<div class="dom-face">${cells}</div>`;
}

function dominoRenderBoard() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  // Clear any Normal-mode leftovers.
  gridEl.querySelectorAll('.card[data-card-id], .trick-card').forEach(el => el.remove());

  const seen = new Set();
  Object.values(dominoPieces).forEach(p => {
    seen.add(String(p.id));
    let div = gridEl.querySelector(`[data-domino-id="${p.id}"]`);
    if (!div) {
      div = document.createElement('div');
      div.dataset.dominoId = p.id;
      div.onclick = () => dominoTapPiece(p.id);
      gridEl.appendChild(div);
    }
    const rTop = Math.min(p.cells[0][0], p.cells[1][0]);
    const cLeft = Math.min(p.cells[0][1], p.cells[1][1]);
    const sel = dominoSelected.indexOf(p.id);
    div.className = 'domino ' + (p.orient === 'h' ? 'dom-h' : 'dom-v') + (sel >= 0 ? ' selected' : '');
    if (p.orient === 'h') { div.style.width = (2 * CARD_W + CARD_GAP) + 'px'; div.style.height = CARD_H + 'px'; }
    else                  { div.style.width = CARD_W + 'px'; div.style.height = (2 * CARD_H + CARD_GAP) + 'px'; }
    div.style.left = cellLeft(cLeft) + 'px';
    div.style.top  = cellTop(rTop) + 'px';
    div.innerHTML =
      (sel >= 0 ? `<div class="dom-selnum">${sel + 1}</div>` : '') +
      `<div class="dom-body">${dominoPipHTML(p.a)}<div class="dom-divider"></div>${dominoPipHTML(p.b)}</div>`;
  });
  gridEl.querySelectorAll('[data-domino-id]').forEach(el => { if (!seen.has(el.dataset.dominoId)) el.remove(); });

  dominoUpdatePreview();
}

// ── Selection + live preview ──
function dominoTapPiece(id) {
  if (animating) return;
  const i = dominoSelected.indexOf(id);
  if (i >= 0) dominoSelected.splice(i, 1);
  else {
    if (dominoSelected.length >= 3) { showMessage('Max 3 dominoes', 'var(--cream-dim)'); return; }
    dominoSelected.push(id);
  }
  dominoRenderBoard();
}

function dominoScoreBreakdown(pairs) {
  const comps  = dominoDetectComponents(pairs);
  const halves = dominoHalves(pairs);
  const used   = new Array(halves.length).fill(false);
  const levelScale = Math.pow(1.1, (typeof level === 'number' ? level : 1) - 1);
  let subtotal = 0;
  const lines = [];

  comps.forEach(comp => {
    const base = dominoHandBase(comp.type, comp.size);
    let faceSum = 0;
    if (comp.type === 'set') {
      halves.forEach((v, idx) => { if (v === comp.value) { used[idx] = true; faceSum += v; } });
    } else {
      comp.values.forEach(val => {
        let idx = halves.findIndex((v, k) => v === val && !used[k]);
        if (idx < 0) idx = halves.findIndex(v => v === val);
        if (idx >= 0) { used[idx] = true; faceSum += val; }
      });
    }
    const basePips = Math.round(base.pips * levelScale);
    const handScore = (basePips + faceSum) * base.mult;
    subtotal += handScore;
    lines.push({ name: comp.name, basePips, faceSum, mult: base.mult, handScore, comp });
  });

  let loose = 0;
  halves.forEach((v, idx) => { if (!used[idx]) loose += v; });
  subtotal += loose;

  const focus = (typeof focusMultiplier === 'function') ? focusMultiplier() : 1;
  const total = Math.round(subtotal * focus);
  return { comps: lines, loose, subtotal, focus, total };
}

function dominoUpdatePreview() {
  const pairs = dominoSelected.map(id => [dominoPieces[id].a, dominoPieces[id].b]);
  const comps = pairs.length ? dominoDetectComponents(pairs) : [];
  const nameEl = document.getElementById('hand-name');
  const bdEl   = document.getElementById('score-breakdown');
  const playBtn = document.getElementById('btn-play');
  const discBtn = document.getElementById('btn-discard');

  if (comps.length) {
    const bd = dominoScoreBreakdown(pairs);
    if (nameEl) nameEl.textContent = comps.map(c => c.name).join(' + ');
    if (bdEl) bdEl.innerHTML =
      bd.comps.map(l => `<div class="sb-row"><span class="sb-label">${l.name} (×${l.mult})</span><span class="sb-value">${l.handScore.toLocaleString()}</span></div>`).join('') +
      (bd.loose ? `<div class="sb-row"><span class="sb-label">Loose pips</span><span class="sb-value">+${bd.loose}</span></div>` : '') +
      (bd.focus !== 1 ? `<div class="sb-row"><span class="sb-label">Focus</span><span class="sb-value">×${bd.focus.toFixed(1)}</span></div>` : '') +
      `<div class="sb-divider"></div><div class="sb-total"><span class="sb-label">SCORE</span><span class="sb-value">${bd.total.toLocaleString()}</span></div>`;
    if (playBtn) playBtn.disabled = false;
  } else {
    if (nameEl) nameEl.textContent = '';
    if (bdEl) bdEl.innerHTML = '';
    if (playBtn) playBtn.disabled = true;
  }
  if (discBtn) discBtn.disabled = dominoSelected.length === 0;
}

// ── Play ──
function dominoPlay() {
  if (animating) return;
  if (dominoSelected.length < 3) { showMessage('Select 3 dominoes', 'var(--cream-dim)'); return; }
  const pairs = dominoSelected.map(id => [dominoPieces[id].a, dominoPieces[id].b]);
  const comps = dominoDetectComponents(pairs);
  if (comps.length === 0) { showMessage('No run or set', 'var(--red)'); return; }

  const bd  = dominoScoreBreakdown(pairs);
  const ids = [...dominoSelected];
  dominoSelected = [];
  score += bd.total;
  if (typeof updateScoreUI === 'function') updateScoreUI();

  dominoAnimateScore(bd, () => {
    ids.forEach(id => dominoRemovePiece(id));
    dominoSettle();
    dominoRefill();
    dominoRenderBoard();
    if (typeof roundGoal === 'number' && score >= roundGoal) dominoAdvanceLevel();
  });
}

// Cycle the hand-type label through each component, one at a time.
async function dominoAnimateScore(bd, done) {
  animating = true;
  const label = document.getElementById('hand-name');
  const preview = document.getElementById('selected-cards');
  for (const line of bd.comps) {
    if (label) {
      label.textContent = line.name + '  +' + line.handScore.toLocaleString();
      label.style.animation = 'none'; void label.offsetWidth; label.style.animation = 'val-tick 0.25s ease';
    }
    if (preview) { preview.classList.add('dnc-active'); }
    await _domWait(650);
  }
  if (bd.loose && label) { label.textContent = 'Loose +' + bd.loose; await _domWait(400); }
  if (preview) preview.classList.remove('dnc-active');
  if (label) setTimeout(() => { if (document.getElementById('hand-name')) document.getElementById('hand-name').textContent = ''; }, 350);
  animating = false;
  done();
}

// ── Round / level advance (minimal, isolated from Normal's level-up flow) ──
function dominoAdvanceLevel() {
  if (typeof roundInterval !== 'undefined' && roundInterval) { clearInterval(roundInterval); roundInterval = null; }
  if (typeof totalScore === 'number') totalScore += score;
  level++;
  roundGoal = Math.round(Math.round(BASE_GOAL * Math.pow(GOAL_SCALE, level - 1)) / 500) * 500;
  score = 0;
  if (typeof focusNodes !== 'undefined') focusNodes = 0;
  if (typeof syncFocusMeterState === 'function') syncFocusMeterState();
  const lv = document.getElementById('level-display'); if (lv) lv.textContent = level;
  if (typeof updateScoreUI === 'function') updateScoreUI();
  showMessage('Round ' + level + ' — goal ' + roundGoal.toLocaleString(), 'var(--gold)');
  dominoInitBoard();
  dominoRenderBoard();
  const rr = (typeof computeRoundResources === 'function') ? computeRoundResources() : { seconds: ROUND_DURATION };
  roundSeconds = rr.seconds || ROUND_DURATION;
  if (typeof updateClockUI === 'function') updateClockUI();
  if (typeof startRoundTimer === 'function') startRoundTimer();
}

// ── Discard (v1 stub — full domino discard is a follow-up) ──
function dominoDiscard() {
  showMessage('Discard is coming to Dominoes soon', 'var(--cream-dim)');
}

// ── Launch ──
function startDominoes() {
  ACTIVE_MODE = MODES.dominoes;
  const menu = document.getElementById('main-menu-overlay');
  if (menu) menu.classList.remove('show');
  startGame();
}
