// ══════════════════════════════════════════════
// KEYS THAT PRESS (r541)
// ══════════════════════════════════════════════
// Every button goes down on pointerdown and stays down at least KEY_MIN_DOWN_MS,
// so a quick tap still shows the travel; it comes back up with a small spring.
// Down and up each click (sfxKeyClick), and the press buzzes a phone (ctlHaptic).
// Buttons that already draw their own pressed look (KEY_OWN) take `.key-dn` in
// those rules; every other button gets the plain 2px drop in css/key-press.css.
//
// DISCARD LATCHES: while a discard is waiting (armed for the next drag, waiting
// for its confirm, or queued behind falling cards) it stays down and jitters
// (`.key-latch`, discardLatchSync).
const KEY_SEL = 'button, #swap-indicator, [role="button"]';
const KEY_OWN = '.btn-play, .btn-discard, #swap-indicator, .pause-btn, #menu-start-btn, #menu-continue-btn, .mode-card-play, '
  + '#skip-btn, #panel-swap-btn, .clock-boss, #clock-boss, .sv-c-btn, .survival-shop-btn, #sv-pick-peek, #sv-peek-restore, .audio-play';
const KEY_MIN_DOWN_MS = 80;
let _keyHeld = null;   // { el, at }

function keyCanPress(el) {
  return el && !el.disabled && !el.closest('#dev-panel');
}
function keyDown(el) {
  el.classList.toggle('key-own', el.matches(KEY_OWN));
  el.classList.add('key-dn');
  try { sfxKeyClick('down'); } catch (e) {}
  if (typeof ctlHaptic === 'function') ctlHaptic('press');
}
function keyUp(el, at) {
  const wait = Math.max(0, KEY_MIN_DOWN_MS - (performance.now() - at));
  setTimeout(() => {
    el.classList.remove('key-dn');
    if (!el.classList.contains('key-latch')) keySpring(el);
    try { sfxKeyClick('up'); } catch (e) {}
  }, wait);
}
// The return: a touch past rest, then settle. Standalone `translate`, so it
// composes with whatever transform the button already has. fill none.
function keySpring(el) {
  if (document.body.classList.contains('reduced-motion') || !el.animate) return;
  el.animate([{ translate: '0 1px' }, { translate: '0 -1.5px', offset: 0.45 }, { translate: '0 0.5px', offset: 0.75 }, { translate: '0 0' }],
    { duration: 200, easing: 'ease-out' });
}
// A keyboard shortcut presses the key it stands for.
function keyTap(el) {
  if (!keyCanPress(el)) return;
  keyDown(el); keyUp(el, performance.now());
}

document.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const el = e.target.closest?.(KEY_SEL);
  if (!keyCanPress(el)) return;
  if (_keyHeld) keyUp(_keyHeld.el, _keyHeld.at);
  _keyHeld = { el, at: performance.now() };
  keyDown(el);
}, true);
const keyLetGo = () => { if (!_keyHeld) return; const h = _keyHeld; _keyHeld = null; keyUp(h.el, h.at); };
document.addEventListener('pointerup', keyLetGo, true);
document.addEventListener('pointercancel', keyLetGo, true);
window.addEventListener('blur', keyLetGo);

function discardLatchSync() {
  const b = document.getElementById('btn-discard');
  if (!b) return;
  const on = (typeof dragDiscardArmed !== 'undefined' && dragDiscardArmed)
    || b.classList.contains('confirm-armed')
    || (typeof pendingAction !== 'undefined' && pendingAction === 'discard');
  if (b.classList.contains('key-latch') === on) return;
  b.classList.toggle('key-latch', on);
  if (!on && !b.classList.contains('key-dn')) keySpring(b);
}

// ══════════════════════════════════════════════
// REFUSAL SHAKE
// ══════════════════════════════════════════════
// refuse() shakes the board's cards sideways. It animates --hbx, the x term of
// the composed card transform (css/style.css), on #grid; the cards inherit it.
// Registered in css/key-press.css so it moves smoothly. Reduced motion pins
// --hbx to 0 on the cards (css/settings.css), so this does nothing there.
let _gridShakeAnim = null;
function gridRefuseShake() {
  const g = document.getElementById('grid');
  if (!g || !g.animate || document.body.classList.contains('reduced-motion')) return;
  try { _gridShakeAnim?.cancel(); } catch (e) {}
  _gridShakeAnim = g.animate([
    { '--hbx': '0px' }, { '--hbx': '-3px' }, { '--hbx': '3px' }, { '--hbx': '-2px' },
    { '--hbx': '2px' }, { '--hbx': '-1px' }, { '--hbx': '0px' }
  ], { duration: 260, easing: 'ease-out' });
  _gridShakeAnim.onfinish = () => { _gridShakeAnim = null; };
}
