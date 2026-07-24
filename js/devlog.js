const DBG_MAX = 80;
const _dbgBuf = [];

function dbgEvent(type, msg, data) {
  const ts = new Date().toISOString().slice(11,23);
  _dbgBuf.push({ ts, type, msg, data: data ? JSON.stringify(data) : '' });
  if (_dbgBuf.length > DBG_MAX) _dbgBuf.shift();
  _devLogRender();
}

function _devLogRender() {
  const el = document.getElementById('dev-event-log');
  const ct = document.getElementById('dev-log-count');
  if (!el) return;
  ct.textContent = `(${_dbgBuf.length})`;
  el.innerHTML = _dbgBuf.slice().reverse().map(e => {
    const cls = e.type === 'error' ? 'log-error' : e.type === 'warn' ? 'log-warn' : 'log-ok';
    const data = e.data ? ` ${e.data}` : '';
    return `<span class="${cls}">[${e.ts}] ${e.type.toUpperCase()} ${e.msg}${data}</span>`;
  }).join('\n');
}

function devLogCopy() {
  const n = parseInt(document.getElementById('dev-log-n')?.value || '20');
  const slice = _dbgBuf.slice(-n);
  const text = slice.map(e => `[${e.ts}] ${e.type.toUpperCase()} ${e.msg}${e.data ? ' ' + e.data : ''}`).join('\n');
  navigator.clipboard?.writeText(text).then(() => {
    const btn = document.getElementById('dev-log-copy');
    const orig = btn.textContent; btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

function devLogClear() { _dbgBuf.length = 0; _devLogRender(); }

// Capture uncaught JS errors into the log
window.addEventListener('error', e => {
  dbgEvent('error', e.message, { file: e.filename?.split('/').pop(), line: e.lineno, col: e.colno });
});
window.addEventListener('unhandledrejection', e => {
  dbgEvent('error', String(e.reason));
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
let GRID_PAD = 3; // matches #grid padding

let gridRows = 4; // playing-grid rows (set from limits at round start)
let gridCols = 4; // playing-grid columns

// Fallback footprint (design px), used only if the grid slot can't be measured
// yet (e.g. before first layout). Normally the slot is measured live.
let GRID_FOOTPRINT_W = 320; // fallback grid width  (design px)
let GRID_FOOTPRINT_H = 392; // fallback grid height (design px)
