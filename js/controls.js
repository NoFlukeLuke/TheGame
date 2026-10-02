// ══════════════════════════════════════════════
// CONTROLS (r436) - Settings > Controls
// ══════════════════════════════════════════════
// The reads every control option goes through, plus the three things that are
// not a branch in input.js: keyboard shortcuts, vibration and the idle hint.
// Loads after input.js and BEFORE settings.js, whose rows call into it at boot.

function ctlOn(id) { return typeof SETTINGS !== 'undefined' && !!SETTINGS[id]; }
function ctlNum(id, dflt) {
  const v = typeof SETTINGS !== 'undefined' ? Number(SETTINGS[id]) : NaN;
  return Number.isFinite(v) ? v : dflt;
}
function ctlAutoPlayMs()  { return ctlNum('ctlAutoPlay', AUTO_SUBMIT_DELAY); }
function ctlDragGraceMs() { return ctlNum('ctlDragGrace', 0); }

// The live board, with no takeover screen borrowing #grid or the buttons.
function ctlLiveBoard() {
  return !(typeof rewardOnGrid !== 'undefined' && rewardOnGrid)
    && !(typeof shopGridActive !== 'undefined' && shopGridActive)
    && !(typeof squaresActive === 'function' && squaresActive())
    && !(typeof mapActive === 'function' && mapActive())
    && !(typeof gridPickState !== 'undefined' && gridPickState)
    && !(typeof flowrDeckActive === 'function' && flowrDeckActive())
    && !(typeof dealerActive === 'function' && dealerActive())
    && !(typeof match3Active === 'function' && match3Active());
}

// ── Confirm before discarding ──
// The first press names what is about to go; a second press within 3s on the
// SAME selection discards. Changing the selection starts over.
let _discConfirm = { key: '', at: 0 };
function ctlDiscardGate() {
  if (!ctlOn('ctlConfirmDiscard') || !selected.length || !ctlLiveBoard()) return true;
  const key = selected.map(([r, c]) => r * 100 + c).sort((a, b) => a - b).join(',');
  const btn = document.getElementById('btn-discard');
  if (_discConfirm.key === key && Date.now() - _discConfirm.at < 3000) {
    _discConfirm = { key: '', at: 0 };
    btn?.classList.remove('confirm-armed');
    return true;
  }
  _discConfirm = { key, at: Date.now() };
  const n = selected.length;
  showMessage(`Discard ${n} card${n > 1 ? 's' : ''}? Press DISCARD again`, 'var(--cream-dim)');
  btn?.classList.add('confirm-armed');
  setTimeout(() => { if (Date.now() - _discConfirm.at >= 2990) btn?.classList.remove('confirm-armed'); }, 3000);
  return false;
}

// ── Vibration ──
// navigator.vibrate exists on Android browsers; iPhones ignore it.
function ctlHaptic(kind) {
  if (!ctlOn('ctlHaptics')) return;
  try { navigator.vibrate?.(kind === 'refuse' ? 35 : [12, 60, 12]); } catch (e) {}
}

// ── Left-handed ──
function ctlSetLeftHanded(on) { document.body.classList.toggle('left-handed', !!on); }

// ── Keyboard shortcuts ──
// Stored as KeyboardEvent.code (the physical key), one per action, every one
// rebindable in Settings. An empty string is unbound.
const KEY_ACTIONS = [
  { id: 'play',    label: 'Play hand',        def: 'Space',
    hint: 'Also confirms on screens where PLAY is CONFIRM or BUY.' },
  { id: 'discard', label: 'Discard',          def: 'KeyD' },
  { id: 'swap',    label: 'Swap two selected cards', def: 'KeyS' },
  { id: 'clear',   label: 'Clear selection',  def: 'Escape' },
  { id: 'records', label: 'Records',          def: 'KeyR' },
  { id: 'pause',   label: 'Pause',            def: 'KeyP' },
];
function keyLabel(code) {
  if (!code) return 'none';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  const map = { Escape: 'Esc', Space: 'Space', Enter: 'Enter', ArrowUp: '↑', ArrowDown: '↓',
    ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'L Shift', ShiftRight: 'R Shift',
    ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt',
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Tab: 'Tab' };
  return map[code] || code;
}
function keyBindOf(action) {
  const v = typeof SETTINGS !== 'undefined' ? SETTINGS['key_' + action] : undefined;
  return v == null ? (KEY_ACTIONS.find(a => a.id === action)?.def || '') : v;
}

// Rebinding: the row's button listens for the next key. Backspace or Delete
// unbinds; Esc cancels. A key already bound elsewhere moves to this action.
let keyListening = null;
function keyBindListen(action) { keyListening = action; renderSettings(); }
function keyBindSet(action, code) {
  if (code) KEY_ACTIONS.forEach(a => { if (a.id !== action && keyBindOf(a.id) === code) SETTINGS['key_' + a.id] = ''; });
  keyListening = null;
  setSetting('key_' + action, code);
}
function keyBindRowHTML(d) {
  const action = d.id.slice(4);
  const on = keyListening === action;
  return `<span class="set-actions"><button class="set-action-b set-key${on ? ' listening' : ''}"
      onclick="keyBindListen('${action}')">${on ? 'Press a key' : keyLabel(keyBindOf(action))}</button></span>`;
}

function _ctlShown(id) { const el = document.getElementById(id); return !!(el && el.classList.contains('show')); }
function _ctlTyping(t) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }

window.addEventListener('keydown', e => {
  if (keyListening) {
    e.preventDefault(); e.stopPropagation();
    if (e.code === 'Escape') { keyListening = null; renderSettings(); return; }
    keyBindSet(keyListening, (e.code === 'Backspace' || e.code === 'Delete') ? '' : e.code);
    return;
  }
  if (e.repeat || _ctlTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
  const action = KEY_ACTIONS.find(a => keyBindOf(a.id) && keyBindOf(a.id) === e.code)?.id;
  if (!action) return;
  if (!gameStartTime || _ctlShown('main-menu-overlay') || _ctlShown('mode-select-overlay')
      || _ctlShown('settings-overlay') || (document.getElementById('dev-panel')?.style.display === 'flex')) return;
  // Poker Squares owns Esc and R for itself.
  if ((action === 'clear' || action === 'records') && typeof squaresActive === 'function' && squaresActive()) return;
  const recOpen = typeof recordsOpen !== 'undefined' && recordsOpen;
  if (recOpen) {
    if (action === 'records' || action === 'clear') { e.preventDefault(); closeRecords(); }
    return;
  }
  if (isPaused) {
    if (action === 'pause') { e.preventDefault(); togglePauseMenu(); }
    return;
  }
  const click = id => { const b = document.getElementById(id); if (b && !b.disabled) b.click(); };
  e.preventDefault();
  if (action === 'play') click('btn-play');
  else if (action === 'discard') click('btn-discard');
  else if (action === 'swap') click('swap-indicator');
  else if (action === 'records') openRecords();
  else if (action === 'pause') togglePauseMenu();
  else if (action === 'clear') {
    if (!ctlLiveBoard()) return;
    cancelAutoSubmit(); dragGrace = false; swapPending = null;
    if (typeof setDragDiscardArmed === 'function') setDragDiscardArmed(false);
    selected = []; render();
  }
}, true);

// ── Idle hint ──
// After 15s with nothing played, selected, discarded or swapped, a soft shine
// runs across one playable hand on the board (and a short buzz, if vibration
// is on). Watching the counters means nothing else has to report activity.
const CTL_IDLE_SECS = 15;
let _idleSig = '', _idleSecs = 0;
function ctlIdleTick() {
  if (!ctlOn('ctlIdleHint')) { _idleSecs = 0; return; }
  const live = ctlLiveBoard() && roundInterval && !isPaused && !gameTimerPaused
    && !animating && !falling && !roundEnded && !selected.length
    && !(typeof tutorialActive === 'function' && tutorialActive())
    && !(typeof recordsOpen !== 'undefined' && recordsOpen);
  const sig = [handsPlayed, selected.length, discards, swaps, score, level].join(',');
  if (!live || sig !== _idleSig) { _idleSig = sig; _idleSecs = 0; return; }
  if (++_idleSecs < CTL_IDLE_SECS) return;
  _idleSecs = 0;
  ctlShowHint();
}
function ctlShowHint() {
  if (typeof tutorialScanHands !== 'function') return false;
  let hands = [];
  try { hands = tutorialScanHands(Math.min(4, limits.selection.current)); } catch (e) { return false; }
  if (!hands.length) return false;
  const big = Math.max(...hands.map(h => h.length));
  const pool = hands.filter(h => h.length === big);
  const hand = pool[Math.floor(fxRandom() * pool.length)];
  hand.sort((a, b) => a[1] - b[1] || a[0] - b[0]).forEach(([r, c], i) => {
    const el = document.querySelector(`#grid [data-row="${r}"][data-col="${c}"]`);
    if (!el) return;
    const s = document.createElement('span');
    s.className = 'idle-shine';
    s.style.setProperty('--d', (i * 110) + 'ms');
    el.appendChild(s);
    setTimeout(() => s.remove(), 1500 + i * 110);
  });
  ctlHaptic('hint');
  return true;
}
setInterval(ctlIdleTick, 1000);
