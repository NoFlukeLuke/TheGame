// ══════════════════════════════════════════════
// BUG REPORT (r471) - js/bug-report.js
// ══════════════════════════════════════════════
// The player's side of the event log (js/devlog.js). Three jobs:
//   1. TRACE: the game's big moments (boss, challenge card, level-up, interlude,
//      swap, discard, notices...) are wrapped once all scripts have loaded, so
//      each call lands in the log with its arguments. A wrapper only logs and
//      passes through; it never changes what the function does or returns.
//   2. WATCH: the board's size and shape, the card size and the drawn #grid
//      are checked four times a second and logged when they change. A board
//      whose gridData no longer matches gridRows x gridCols is a WARN.
//   3. REPORT: Settings -> Help -> Copy bug report puts one block of text on the
//      clipboard: build, device, run state, loadout, the board, every distinct
//      error with its stack, the log (notices included), and the previous page
//      load's log if there was one.

// The board as text, one row per line. `*` marks a selected cell; UNDEF is a
// cell inside gridRows x gridCols that gridData does not have.
function dbgBoardText() {
  if (!_dv(() => gridData.length, 0)) return '(no board)';
  const rows = Math.max(_dv(() => gridRows, 0), _dv(() => gridData.length, 0));
  const cols = Math.max(_dv(() => gridCols, 0), ..._dv(() => gridData.map(r => r ? r.length : 0), [0]));
  const sel = new Set(_dv(() => selected.map(([r, c]) => r + '-' + c), []));
  const out = [];
  for (let r = 0; r < rows; r++) {
    const row = _dv(() => gridData[r], undefined);
    const cells = [];
    for (let c = 0; c < cols; c++) {
      const s = row === undefined ? 'UNDEF' : dbgCardStr(row[c]);
      cells.push(((sel.has(r + '-' + c) ? '*' : '') + s).padEnd(9));
    }
    out.push(cells.join(' ').trimEnd());
  }
  return out.join('\n');
}

// A short, safe rendering of one argument.
function _brArg(a) {
  if (a === null || a === undefined) return String(a);
  const t = typeof a;
  if (t === 'number' || t === 'boolean') return String(a);
  if (t === 'string') return JSON.stringify(a.length > 60 ? a.slice(0, 60) + '…' : a);
  if (t === 'function') return 'fn';
  if (Array.isArray(a)) return a.length <= 6 && a.every(x => typeof x !== 'object' || Array.isArray(x)) ? JSON.stringify(a) : `[${a.length}]`;
  if (a.cr || a.rank || a._isSleight) return dbgCardStr(a);
  const id = a.id || a.kind || a.type || a.name || a._id;
  return id ? `{${id}}` : '{' + Object.keys(a).slice(0, 4).join(',') + '}';
}

// Which functions are traced, and how loudly. `quiet` ones log no arguments.
const BR_TRACE = [
  // bosses
  'triggerBoss', 'startBossTimer', 'endBoss', 'flowTriggerBoss', 'flowEndBoss',
  // challenge cards
  'crBeginArrival', 'crLand', 'crTap', 'crRaise', 'crCollect', 'crFail', 'crDrain',
  'crOnClockOut', 'crSettle', 'crTakePrize', 'crFlowSpawn', 'crFlowCancel',
  // between rounds
  'onRoundEnd', 'flashRoundEnd', 'startInterlude', 'triggerLevelUp', 'rolloverQuarter',
  'openGridPick', 'openPenaltyGrid', 'openEvent', 'openShopGrid', 'flowrArm', 'onGameEnd',
  // the player's own moves
  'doSwap', 'doDiscard', 'removeAndFall', 'rewindTime', 'pauseRound',
  // run and screen
  'startGame', 'quitToMainMenu', 'pauseGame', 'resumeGame',
  'saveRunToStorage', 'continueSavedRun', 'resumeSavedRun', 'recomputeGridMetrics',
];
const BR_QUIET = new Set(['crDrain', 'recomputeGridMetrics']);

function _brWrap(name) {
  const orig = window[name];
  if (typeof orig !== 'function' || orig._brTraced) return;
  const w = function (...args) {
    try {
      const a = BR_QUIET.has(name) ? '' : args.map(_brArg).join(', ');
      dbgEvent('info', `> ${name}(${a})`);
    } catch (e) {}
    return orig.apply(this, args);
  };
  w._brTraced = true;
  window[name] = w;
}

// What the player was told. noteMessage prints nothing, but is logged too.
function _brWrapNotices() {
  ['showMessage', 'noteMessage'].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function' || orig._brTraced) return;
    const w = function (text, ...rest) {
      try { dbgEvent('info', (name === 'showMessage' ? 'notice: ' : 'note: ') + String(text).replace(/<[^>]+>/g, '').slice(0, 160)); } catch (e) {}
      return orig.call(this, text, ...rest);
    };
    w._brTraced = true;
    window[name] = w;
  });
}

// ── WATCH ──
let _brWatchSig = { shape: '', card: '', dom: '' };
function _brWatchTick() {
  const shape = dbgBoardShape();
  if (shape.text !== _brWatchSig.shape) {
    if (_brWatchSig.shape) dbgEvent(shape.ok ? 'info' : 'warn', `board ${_brWatchSig.shape} -> ${shape.text}`,
      shape.ok ? undefined : { board: dbgBoardText() });
    _brWatchSig.shape = shape.text;
  }
  const card = `${_dv(() => Math.round(CARD_W), '?')}x${_dv(() => Math.round(CARD_H), '?')}`;
  if (card !== _brWatchSig.card) {
    if (_brWatchSig.card) dbgEvent('info', `card size ${_brWatchSig.card} -> ${card}`);
    _brWatchSig.card = card;
  }
  // What is actually drawn: #grid's size and visibility, and how many card
  // elements it holds against how many cards the board has.
  const g = document.getElementById('grid');
  let dom = 'no #grid';
  if (g) {
    const cs = getComputedStyle(g);
    const n = g.querySelectorAll('[data-card-id]').length;
    let cards = 0;
    _dv(() => gridData.forEach(r => r && r.forEach(c => { if (c) cards++; })));
    const hidden = cs.display === 'none' ? ' display:none' : cs.visibility === 'hidden' ? ' hidden'
      : Number(cs.opacity) < 0.05 ? ' opacity:0' : '';
    dom = `#grid ${g.offsetWidth}x${g.offsetHeight}${hidden} drawn ${n}/${cards}`;
  }
  if (dom !== _brWatchSig.dom) {
    // Only a change of size or visibility is news; the drawn count moves on every fall.
    const strip = s => s.replace(/ drawn .*/, '');
    if (_brWatchSig.dom && strip(dom) !== strip(_brWatchSig.dom)) dbgEvent('info', dom);
    _brWatchSig.dom = dom;
  }
}

// ── REPORT ──
function bugReportText() {
  const L = [];
  const ln = (k, v) => L.push(`${k}: ${v}`);
  L.push('=== TheGame bug report ===');
  ln('build', _dv(() => BUILD, '?'));
  ln('time', new Date().toString());
  ln('page', location.href.split('#')[0]);
  ln('browser', navigator.userAgent);
  ln('screen', `${innerWidth}x${innerHeight} dpr ${devicePixelRatio} ${_dv(() => document.getElementById('stage').classList.contains('landscape') ? 'landscape' : 'portrait', '?')}` +
    ` zoom ${_dv(() => getComputedStyle(document.getElementById('cabinet')).getPropertyValue('--stage-zoom').trim(), '?')}`);
  ln('storage', _dv(() => LETHE_STORAGE_OK, '?') ? 'ok' : 'blocked (in-memory)');
  ln('dev mode', _dv(() => devMode, false));
  L.push('');
  L.push('--- run ---');
  ln('mode', `${_dv(() => ACTIVE_MODE.name, '?')} (${_dv(() => ACTIVE_MODE.id, '?')})`);
  ln('seed', _dv(() => runSeed, null) ?? 'none');
  ln('state', _dv(() => dbgCtx(), '?'));
  ln('credits / swaps / discards', `${_dv(() => coins, '?')} / ${_dv(() => swaps, '?')} / ${_dv(() => discards, '?')}`);
  ln('tricks', _dv(() => trickTray.map(t => t.id || t).join(', '), '?') || 'none');
  ln('knacks', _dv(() => acquiredKnacks.map(k => k.id || k).join(', '), '?') || 'none');
  ln('draw / played pile', `${_dv(() => drawPile.length, '?')} / ${_dv(() => playedPile.length, '?')}`);
  L.push('');
  L.push(`--- board (${dbgBoardShape().text}) ---`);
  L.push(dbgBoardText() || '(empty)');
  L.push('');
  L.push(`--- errors (${_dbgErrors.length} distinct) ---`);
  if (!_dbgErrors.length) L.push('none');
  _dbgErrors.forEach(e => {
    L.push(`[${e.at}] x${e.count} ${e.msg} @ ${e.where}`);
    if (e.stack) L.push('  stack: ' + e.stack);
    if (e.ctx) L.push('  state: ' + e.ctx);
    if (e.board) L.push('  board:\n    ' + e.board.split('\n').join('\n    '));
  });
  L.push('');
  L.push(`--- log (${_dbgBuf.length} lines, oldest first) ---`);
  L.push(dbgLines(_dbgBuf).join('\n'));
  if (_dbgPrev && Array.isArray(_dbgPrev.log) && _dbgPrev.log.length) {
    L.push('');
    L.push(`--- previous page load (${_dbgPrev.at}, ${_dbgPrev.build}) ---`);
    (_dbgPrev.errors || []).forEach(e => L.push(`ERROR x${e.count} ${e.msg} @ ${e.where}${e.stack ? '\n  stack: ' + e.stack : ''}`));
    L.push(dbgLines(_dbgPrev.log.slice(-200)).join('\n'));
  }
  return L.join('\n');
}

// Copy, with two fallbacks: the old execCommand path, then a box the player
// can select from by hand, placed after `anchor`. `done(ok)` reports which.
function copyBugReport(done, anchor) {
  const text = bugReportText();
  dbgEvent('info', 'bug report copied');
  const fallback = () => {
    let ok = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch (e) {}
    if (!ok) bugReportShowText(text, anchor);
    done && done(ok);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => done && done(true), fallback);
  } else fallback();
}

// Last resort: the report in a box under the button, already selected.
function bugReportShowText(text, anchor) {
  document.getElementById('bug-report-text')?.remove();
  const ta = document.createElement('textarea');
  ta.id = 'bug-report-text'; ta.readOnly = true; ta.value = text;
  const row = anchor && anchor.closest('.set-row');
  if (row) row.after(ta); else document.body.appendChild(ta);
  ta.focus(); ta.select();
}

// The button itself says what happened: the message line sits at the foot of
// the tab, out of sight.
function settingsCopyBugReport(btn) {
  copyBugReport(ok => {
    if (!btn) return;
    btn.textContent = ok ? 'Copied. Paste it to the developer' : 'Copy blocked. Copy the text below';
    if (ok) setTimeout(() => { if (btn.isConnected) btn.textContent = 'Copy bug report'; }, 2500);
  }, btn);
}

// The first error of a page load tells the player where the report is. Once.
let _brToldPlayer = false;
function bugReportOnError(rec) {
  if (_brToldPlayer || rec.count > 1) return;
  _brToldPlayer = true;
  setTimeout(() => { try { showMessage('Something went wrong. Settings > Help > Copy bug report.', 'var(--red)'); } catch (e) {} }, 0);
}

// All scripts have run by DOMContentLoaded (classic scripts, no defer), so
// every traced name exists. A caller that took a reference earlier keeps the
// untraced original; that only costs a log line.
function bugReportInit() {
  BR_TRACE.forEach(_brWrap);
  _brWrapNotices();
  _brWatchTick();
  setInterval(_brWatchTick, 250);
  dbgEvent('info', 'page loaded', { build: _dv(() => BUILD.split(' · ')[1], '?') });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bugReportInit);
else bugReportInit();
