// ══════════════════════════════════════════════
// EVENT LOG (r471)
// ══════════════════════════════════════════════
// One ring buffer of what happened, read by the dev panel's log and by the
// player's bug report (js/bug-report.js, Settings -> Help). Every line carries
// a short game-state stamp (dbgCtx) printed only when it changed since the line
// before. An identical line in a row is folded into a count, so an error that
// fires on every tap cannot push the history out. The buffer is mirrored into
// storage, so a report can still be copied after the page is reloaded.
const DBG_MAX = 600;
const DBG_STORE_KEY = 'lethe.bugLog.v1';
const _dbgBuf = [];
const _dbgErrors = [];        // distinct errors this session, first occurrence each
let _dbgPrev = null;          // the previous page load's log, if one was stored
try { _dbgPrev = JSON.parse(localStorage.getItem(DBG_STORE_KEY) || 'null'); } catch (e) { _dbgPrev = null; }

// Reads a global without letting a missing or not-yet-declared one throw.
function _dv(f, d) { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } }

// The physical card in a cell, named so special cards are told apart.
// undefined (outside the board arrays) is printed loudly: it is always a bug.
function dbgCardStr(card) {
  if (card === undefined) return 'UNDEF';
  if (card === null) return '·';
  if (card.cr) return 'CH:' + (card.cr.kind || '?');
  if (card._isSleight) return 'SL:' + (card.sleightId || '?');
  if (card._isStone) return 'STONE';
  return `${card.rank}${card.suit}${card.suit2 ? '/' + card.suit2 : ''}`;
}

// gridRows x gridCols against what gridData really holds.
function dbgBoardShape() {
  const rows = _dv(() => gridRows, '?'), cols = _dv(() => gridCols, '?');
  const gd = _dv(() => gridData, null);
  if (!Array.isArray(gd) || !gd.length) return { rows, cols, ok: true, text: 'no board' };
  const lens = gd.map(r => Array.isArray(r) ? r.length : -1);
  let undef = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (gd[r] === undefined || gd[r][c] === undefined) undef++;
  const ok = gd.length === rows && lens.every(n => n === cols) && !undef;
  return { rows, cols, ok, undef, text: ok ? `${rows}x${cols}` : `${rows}x${cols} BUT data ${gd.length} rows [${lens.join(',')}] undef:${undef}` };
}

function dbgCtx() {
  const f = [];
  const m = _dv(() => ACTIVE_MODE.id, '?');
  f.push(`${m} L${_dv(() => level, '?')} Q${_dv(() => actNumber, '?')}`);
  const t = _dv(() => roundSeconds, null);
  if (typeof t === 'number') f.push(`${Math.round(t)}s`);
  f.push(`${Math.round(_dv(() => score, 0))}/${Math.round(_dv(() => roundGoal, 0))}`);
  f.push(`board ${dbgBoardShape().text}`);
  if (_dv(() => bossActive)) f.push('boss');
  if (_dv(() => flowBossFighting)) f.push('bossfight');
  if (_dv(() => bossApproachOn)) f.push('approach');
  if (_dv(() => crCards().length)) f.push('chal:' + _dv(() => crCards().length));
  if (_dv(() => roundEnded)) f.push('ended');
  if (_dv(() => gameTimerPaused)) f.push('clockpaused');
  if (_dv(() => isPaused)) f.push('paused');
  if (_dv(() => animating)) f.push('anim');
  if (_dv(() => falling)) f.push('fall');
  if (_dv(() => gridScreenOwnsBoard())) f.push('takeover');
  return f.join(' ');
}

function dbgEvent(type, msg, data) {
  let dataStr = '';
  if (data !== undefined && data !== null) { try { dataStr = JSON.stringify(data); } catch (e) { dataStr = String(data); } }
  const last = _dbgBuf[_dbgBuf.length - 1];
  if (last && last.type === type && last.msg === msg && last.data === dataStr) {
    last.n = (last.n || 1) + 1; last.ts2 = new Date().toISOString().slice(11, 23);
  } else {
    let ctx = '';
    try { ctx = dbgCtx(); } catch (e) {}
    _dbgBuf.push({ ts: new Date().toISOString().slice(11, 23), type, msg, data: dataStr, ctx });
    if (_dbgBuf.length > DBG_MAX) _dbgBuf.shift();
  }
  _dbgDirty = true;
  if (type === 'error') _dbgPersist();
  _devLogRender();
}

// One line of text per entry; the state stamp only where it changed.
function dbgLines(entries) {
  let prevCtx = null;
  return entries.map(e => {
    const rep = e.n > 1 ? ` (x${e.n}, last ${e.ts2})` : '';
    const ctx = e.ctx && e.ctx !== prevCtx ? `   | ${e.ctx}` : '';
    prevCtx = e.ctx || prevCtx;
    return `[${e.ts}] ${e.type.toUpperCase()} ${e.msg}${e.data ? ' ' + e.data : ''}${rep}${ctx}`;
  });
}

let _dbgRenderQueued = false;
function _devLogRender() {
  if (_dbgRenderQueued) return;
  const el = document.getElementById('dev-event-log');
  if (!el || !el.offsetParent) return;                // the dev panel is closed: nothing to draw
  _dbgRenderQueued = true;
  requestAnimationFrame(() => {
    _dbgRenderQueued = false;
    const ct = document.getElementById('dev-log-count');
    if (ct) ct.textContent = `(${_dbgBuf.length})`;
    const tail = _dbgBuf.slice(-150);
    const lines = dbgLines(tail);
    el.innerHTML = tail.map((e, i) => {
      const cls = e.type === 'error' ? 'log-error' : e.type === 'warn' ? 'log-warn' : 'log-ok';
      const t = lines[i].replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return `<span class="${cls}">${t}</span>`;
    }).reverse().join('\n');
  });
}

function devLogCopy() {
  const n = parseInt(document.getElementById('dev-log-n')?.value || '20');
  const text = dbgLines(_dbgBuf.slice(-n)).join('\n');
  navigator.clipboard?.writeText(text).then(() => {
    const btn = document.getElementById('dev-log-copy');
    const orig = btn.textContent; btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

function devLogClear() { _dbgBuf.length = 0; _devLogRender(); }

// Mirror the buffer into storage: at once on an error, otherwise every few
// seconds while it changes, and when the page is hidden or closed.
let _dbgDirty = false;
function _dbgPersist() {
  _dbgDirty = false;
  try {
    localStorage.setItem(DBG_STORE_KEY, JSON.stringify({
      at: new Date().toISOString(), build: _dv(() => BUILD, '?'),
      errors: _dbgErrors.slice(0, 10), log: _dbgBuf.slice(-300),
    }));
  } catch (e) {}
}
setInterval(() => { if (_dbgDirty) _dbgPersist(); }, 5000);
window.addEventListener('pagehide', _dbgPersist);
document.addEventListener('visibilitychange', () => { if (document.hidden) _dbgPersist(); });

// A stack trimmed to the game's own frames: file:line, no URL noise.
function dbgStack(err, skip) {
  const s = err && err.stack ? String(err.stack) : '';
  return s.split('\n').slice(1 + (skip || 0))
    .map(l => l.trim().replace(/\(?(https?|file):\/\/[^)\s]*\/(js\/[^)\s]+)\)?/, '$2').replace(/^at /, ''))
    .filter(Boolean).slice(0, 8).join(' < ');
}

// Every distinct error once with its stack and the board as it was; repeats
// only count. Hooks (js/bug-report.js) may add the board picture.
function _dbgOnError(msg, where, stack) {
  const key = msg + '@' + where;
  let rec = _dbgErrors.find(r => r.key === key);
  if (rec) { rec.count++; }
  else {
    rec = { key, msg, where, stack, count: 1, at: new Date().toISOString().slice(11, 23), ctx: _dv(() => dbgCtx(), '') };
    try { if (typeof dbgBoardText === 'function') rec.board = dbgBoardText(); } catch (e) {}
    if (_dbgErrors.length < 30) _dbgErrors.push(rec);
  }
  dbgEvent('error', msg, { where, ...(rec.count === 1 && stack ? { stack } : {}) });
  try { if (typeof bugReportOnError === 'function') bugReportOnError(rec); } catch (e) {}
}

window.addEventListener('error', e => {
  const where = `${e.filename?.split('/').pop() || '?'}:${e.lineno}:${e.colno}`;
  _dbgOnError(e.message, where, dbgStack(e.error));
});
window.addEventListener('unhandledrejection', e => {
  const r = e.reason;
  const top = r && r.stack ? (String(r.stack).split('\n')[1] || '').trim().replace(/.*\/(js\/[^)\s]+)\)?/, '$1') : '?';
  _dbgOnError('(promise) ' + (r && r.message ? `${r.name || 'Error'}: ${r.message}` : String(r)), top, dbgStack(r));
});

// console.error / console.warn reach the log too (dev checks such as the
// dance's timeline drift report there).
['error', 'warn'].forEach(k => {
  const orig = console[k];
  if (typeof orig !== 'function') return;
  console[k] = function (...a) {
    try {
      const msg = a.map(x => x instanceof Error ? `${x.name}: ${x.message}` : (typeof x === 'object' ? _dv(() => JSON.stringify(x), String(x)) : String(x))).join(' ');
      dbgEvent(k === 'error' ? 'error' : 'warn', 'console: ' + msg.slice(0, 300));
    } catch (e) {}
    return orig.apply(this, a);
  };
});

// ══════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════
// ── GRID METRICS (dynamic) ──
// Card dimensions and grid dimensions are mutable; recomputeGridMetrics() resizes
// cards to fit a fixed footprint as the grid grows. cellLeft/cellTop and all
// animation paths read these live values, so resizing propagates everywhere.
let CARD_H = 75, CARD_GAP = 3, CARD_STEP = CARD_H + CARD_GAP;
let CARD_W = 57;
// CARD_GAP is DERIVED from the card now (r391, see recomputeGridMetrics); this is
// the orientation's floor, set by js/bootstrap.js and never read as the live gap.
let CARD_GAP_BASE = 3;
let GRID_PAD = 6;    // the board's own frame, where its rings are drawn (r391)
let GRID_BORDER = 1; // #grid's 1px border - counted so the frame is symmetric

let gridRows = 4; // playing-grid rows (set from limits at round start)
let gridCols = 4; // playing-grid columns

// Fallback footprint (design px), used only if the grid slot can't be measured
// yet (e.g. before first layout). Normally the slot is measured live.
let GRID_FOOTPRINT_W = 320; // fallback grid width  (design px)
let GRID_FOOTPRINT_H = 392; // fallback grid height (design px)
