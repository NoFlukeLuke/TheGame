// ════════════════════════════════════════════════════════════════════════════
// READING PAUSE (r769, owner): a big pop-up holds the round clock while it is read.
//
// A walkthrough bubble or a tip that covers the board (or runs past two lines)
// stops the round clock for as long as its words take to read at a slow pace,
// then counts down 5 4 3 2 1 on the pop-up and lets the clock go, whether the
// pop-up is still up or not. Closing it sooner lets the clock go at once.
//
// The hold is a CLAIM on gameTimerPaused, taken only when the clock is running
// and nothing else holds it, and given back only while that is still ours to
// give (no screen between rounds has taken the board since). One at a time: a
// new pop-up replaces the last one's hold.
// ════════════════════════════════════════════════════════════════════════════
const READ_HOLD = {
  wps: 3,          // words a second: about 180 a minute, slower than the ~230 a typical reader manages
  extra: 2,        // seconds on top of the words: finding the pop-up, the anchor it points at
  count: 5,        // the 5 4 3 2 1 before the clock goes again
  minWords: 25,    // a pop-up off the board this long still holds (about two lines and more)
  min: 4, max: 40, // reading seconds, before the countdown
};
let _rh = null;    // { owner, el, readMs, ms, last, timer, pill, n }

function readHoldWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}
function readHoldSeconds(text) {
  const s = READ_HOLD.extra + readHoldWords(text) / READ_HOLD.wps;
  return Math.max(READ_HOLD.min, Math.min(READ_HOLD.max, s));
}
// Does the pop-up cover any of the board?
function readHoldCoversBoard(el) {
  const g = document.getElementById('grid');
  if (!el || !g) return false;
  const a = el.getBoundingClientRect(), b = g.getBoundingClientRect();
  if (a.width < 2 || b.width < 2) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
// The round clock is running, or about to (the walkthrough's first bubble is up
// before the round's opening count ends), and nothing else holds it.
function readHoldClockLive() {
  return !roundEnded && !gameTimerPaused && !readHoldScreenUp()
    && !(typeof isPaused !== 'undefined' && isPaused)
    && !(typeof pipeTimerPaused !== 'undefined' && pipeTimerPaused);
}
// A screen between rounds has the board: the clock is its to give back, not ours.
function readHoldScreenUp() {
  const b = document.body.classList;
  return b.contains('grid-screen') || b.contains('gp-active') || b.contains('reward-active')
    || b.contains('map-active') || b.contains('pick-active')
    || (typeof shopGridActive !== 'undefined' && shopGridActive)
    || (typeof interludeActive !== 'undefined' && interludeActive)
    || !!document.querySelector('#event-overlay.show');
}

function readHoldActive() { return !!_rh; }

// owner: 'tut' | 'tip'. el: the pop-up. text: what it says.
// opts.force: hold whatever its size (a walkthrough step marked `hold`).
function readHoldBegin(owner, el, text, opts = {}) {
  readHoldEnd();
  if (!el || !readHoldClockLive()) return false;
  if (!opts.force && !readHoldCoversBoard(el) && readHoldWords(text) < READ_HOLD.minWords) return false;
  gameTimerPaused = true;
  const pill = document.createElement('div');
  pill.className = 'rh-pill';
  pill.innerHTML = `<span class="rh-word">CLOCK PAUSED</span><span class="rh-num"></span><i class="rh-bar"></i>`;
  const foot = el.querySelector('#tut-skip, #tip-off');   // above the pop-up's quiet foot link
  if (foot && foot.parentNode === el) el.insertBefore(pill, foot); else el.appendChild(pill);
  _rh = { owner, el, pill, readMs: readHoldSeconds(text) * 1000, ms: 0, last: performance.now(), n: 0 };
  _rh.timer = setInterval(readHoldTick, 100);
  readHoldPaint();
  return true;
}

function readHoldTick() {
  const h = _rh;
  if (!h) return;
  const now = performance.now(), dt = Math.min(500, now - h.last);
  h.last = now;
  // Someone else let the clock go, or the round ended under the pop-up: our
  // claim is gone, so drop it without touching the clock.
  if (!gameTimerPaused || roundEnded || !h.el.isConnected) { readHoldDrop(); return; }
  // The pause menu or a hidden tab stops the reading time too.
  if ((typeof isPaused !== 'undefined' && isPaused) || document.hidden) return;
  h.ms += dt;
  if (h.ms >= h.readMs + READ_HOLD.count * 1000) { readHoldEnd(); return; }
  readHoldPaint();
}

function readHoldPaint() {
  const h = _rh;
  if (!h) return;
  const left = h.readMs - h.ms;
  h.pill.style.setProperty('--rh-p', Math.max(0, Math.min(1, left / h.readMs)).toFixed(3));
  if (left > 0) return;
  const n = Math.max(1, Math.ceil(READ_HOLD.count + left / 1000));
  if (n === h.n) return;
  h.n = n;
  h.pill.classList.add('rh-count');
  h.pill.querySelector('.rh-word').textContent = 'CLOCK STARTS IN';
  const num = h.pill.querySelector('.rh-num');
  num.textContent = n;
  num.classList.remove('rh-pop'); void num.offsetWidth; num.classList.add('rh-pop');
  sfxReadCount(n);
}

// Let the clock go (if the claim is still ours to give) and take the pill off.
// With an owner, only that owner's hold is ended.
function readHoldEnd(owner) {
  const h = _rh;
  if (!h || (owner && h.owner !== owner)) return;
  if (gameTimerPaused && !roundEnded && !readHoldScreenUp()) gameTimerPaused = false;
  readHoldDrop();
}
function readHoldDrop() {
  const h = _rh;
  if (!h) return;
  clearInterval(h.timer);
  h.pill.remove();
  _rh = null;
}

// One short beep a second, higher on the last.
function sfxReadCount(n) {
  if (typeof playTone !== 'function') return;
  try {
    playTone({ freq: n === 1 ? 880 : 620, type: 'square', gain: 0.05, attack: 0.004,
               decay: 0.05, sustain: 0.1, release: 0.08, duration: 0.09 });
  } catch (e) {}
}
