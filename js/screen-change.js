// ══════════════════════════════════════════════
// SCREEN CHANGE (r532) - how the machine explains a screen changing over
// ══════════════════════════════════════════════
// Owner: the game is a piece of hardware, so the screen cannot just become a
// different screen. Flow's reward chain opens and closes through one of these:
//   (r692, owner: no sideways or cube rotation anywhere; the 'turn' and 'shutter'
//    looks of r532 are gone)
//   'console' a command types at the foot of the board ("> OPEN REWARDS", "> DEAL"),
//             the old screen scrolls up and out of the box, the new one scrolls up in
//             from below, like a terminal.
//   'fall'    (r691, owner, the default) the screen's contents fall out of the bottom of
//             the board's box and the next screen's fall in from the top. Nothing in
//             the housing moves: the keys stay put and only their dot words change
//             (js/key-dots.js), as the owner asked.
//   'none'    the old cut.
// screenChange(swap) runs the first half, calls swap() at the moment nothing of
// the screen is visible, and runs the second half. Dev -> Aesthetics -> Screen
// change; the store holds only a non-default choice.
const SC_KEY = 'lethe.screenChange.v1';
const SC_LOOKS = ['fall', 'console', 'none'];
const SC_DEFAULT = 'fall';
const SC_CON_MS = 300;       // the scroll out / in, x animSlow()
const SC_CON_STAG = 18;
const SC_FALL_OUT = 420;     // one item's drop out of the box, x animSlow()
const SC_FALL_IN = 560;      // one item's fall in, with its bounce
const SC_FALL_STAG = 26;     // between columns / rows

let scLook = (() => {
  try { const v = localStorage.getItem(SC_KEY); return SC_LOOKS.includes(v) ? v : SC_DEFAULT; }
  catch (e) { return SC_DEFAULT; }
})();
let _scBusy = false;

function setScreenChange(v) {
  if (!SC_LOOKS.includes(v)) return;
  scLook = v;
  try { v === SC_DEFAULT ? localStorage.removeItem(SC_KEY) : localStorage.setItem(SC_KEY, v); } catch (e) {}
  const sel = document.getElementById('dev-screen-change'); if (sel) sel.value = v;
}

function screenChange(swap) {
  // Console mode only (owner, r536): the move is the hardware explaining itself.
  const off = scLook === 'none' || _scBusy || !(typeof trayMachineOn === 'function' && trayMachineOn())
    || (typeof skipOn === 'function' && skipOn('transitions'))
    || document.body.classList.contains('reduced-motion');
  if (off) { swap(); return; }
  _scBusy = true;
  const done = () => { _scBusy = false; };
  try { (scLook === 'console' ? scConsole : scFall)(swap, done); }
  catch (e) { done(); swap(); }
}

// A rect in #stage's design px.
function scStageRect(el, st, z, sr) {
  const r = el.getBoundingClientRect();
  return { l: (r.left - sr.left) / z, t: (r.top - sr.top) / z, w: r.width / z, h: r.height / z };
}
function scStage() {
  const st = document.getElementById('stage'); if (!st) return null;
  const sr = st.getBoundingClientRect(), z = sr.width / (st.offsetWidth || 1);
  return z > 0.01 ? { st, sr, z } : null;
}
const scWait = ms => new Promise(r => setTimeout(r, ms));
const scFrames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

// ── FALL (r691) ─────────────────────────────────────────────────────────────
// What the board holds: its cards and tiles, by their drawn boxes. Overlay layers
// (the counter, a stamp, the board's own background) are left alone.
function scGridItems(grid) {
  return [...grid.children].filter(e => e instanceof HTMLElement && e.offsetWidth && e.offsetHeight
    && !e.id && !e.classList.contains('card-leaving') && !e.classList.contains('cr-stamp')
    && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).position !== 'fixed');
}
async function scFall(swap, done) {
  const S = scStage(), grid = document.getElementById('grid');
  if (!S || !grid) { swap(); done(); return; }
  const k = typeof animSlow === 'function' ? animSlow() : 1;
  const OUT = SC_FALL_OUT * k, IN = SC_FALL_IN * k, STAG = SC_FALL_STAG * k;
  const gr = scStageRect(grid, S.st, S.z, S.sr), bottom = gr.t + gr.h;
  const panel = document.getElementById('flowr-bg'), stack = document.getElementById('flowr-stack');
  grid.classList.add('sc-falling');
  // OUT: the bottom row lets go first, the rows above follow, each item with its own lean.
  const kids = scGridItems(grid).map(el => ({ el, r: scStageRect(el, S.st, S.z, S.sr) }));
  const rowTops = [...new Set(kids.map(x => Math.round(x.r.t / 4)))].sort((a, b) => b - a);
  const outs = kids.map(({ el, r }) => {
    const rank = rowTops.indexOf(Math.round(r.t / 4));
    const dy = bottom - r.t + 24, lean = (fxRandom() - .5) * 22;
    return el.animate([
      { translate: '0 0', rotate: '0deg' },
      { translate: `0 ${(-6).toFixed(1)}px`, rotate: '0deg', offset: .12 },
      { translate: `0 ${dy.toFixed(1)}px`, rotate: `${lean.toFixed(1)}deg` }],
      { duration: OUT, delay: rank * STAG + fxRandom() * STAG, easing: 'cubic-bezier(.45,0,.9,.55)', fill: 'forwards' });
  });
  const fades = [panel, stack].filter(e => e && e.offsetWidth).map(e => e.animate([{ opacity: 1 }, { opacity: 0 }],
    { duration: OUT + rowTops.length * STAG, easing: 'ease-in', fill: 'forwards' }));
  try { sfxScreenTurn(OUT * 0.9); } catch (e) {}
  await Promise.all(outs.concat(fades).map(a => a.finished.catch(() => {})));
  // Nothing of the old screen shows: change it, laid out with no transforms in the way.
  kids.forEach(({ el }) => { el.style.visibility = 'hidden'; });
  outs.forEach(a => a.cancel()); fades.forEach(a => a.cancel());
  try { swap(); } catch (e) { console.error(e); }
  kids.forEach(({ el }) => { if (el.isConnected) el.style.visibility = ''; });
  await scFrames();
  // IN: the new screen's items drop from above the box, left to right, the bottom row
  // landing first, with the card fall's bounce. An item the game is already animating
  // (a dealt board falls in on its own) is left to its own trip.
  const S2 = scStage() || S, gr2 = scStageRect(grid, S2.st, S2.z, S2.sr);
  const news = scGridItems(grid).filter(el => !el.getAnimations().length).map(el => ({ el, r: scStageRect(el, S2.st, S2.z, S2.sr) }));
  const cols = [...new Set(news.map(x => Math.round(x.r.l / 4)))].sort((a, b) => a - b);
  const rows2 = [...new Set(news.map(x => Math.round(x.r.t / 4)))].sort((a, b) => b - a);
  const ins = news.map(({ el, r }) => {
    const from = -(r.t - gr2.t + r.h + 16), c = cols.indexOf(Math.round(r.l / 4)), rw = rows2.indexOf(Math.round(r.t / 4));
    return el.animate([
      { translate: `0 ${from.toFixed(1)}px`, scale: '1 1', offset: 0 },
      { translate: `0 ${(from * .4).toFixed(1)}px`, scale: '1 .97', offset: .5, easing: 'ease-in' },
      { translate: '0 7px', scale: '1 .91', offset: .82 },
      { translate: '0 -5px', scale: '1 1.08', offset: .91 },
      { translate: '0 2px', scale: '1 .98', offset: .96 },
      { translate: '0 0', scale: '1 1', offset: 1 }],
      { duration: IN, delay: c * STAG + rw * STAG * .5, easing: 'ease-in', fill: 'backwards' });
  });
  const shows = [panel, stack].filter(e => e && e.offsetWidth).map(e => e.animate([{ opacity: 0 }, { opacity: 1 }],
    { duration: IN * .6, easing: 'ease-out' }));
  const landAt = IN * .82 + (cols.length - 1) * STAG;
  setTimeout(() => { try { sfxScreenLatch(); } catch (e) {} }, landAt);
  await Promise.all(ins.concat(shows).map(a => a.finished.catch(() => {})));
  ins.forEach(a => a.cancel()); shows.forEach(a => a.cancel());
  grid.classList.remove('sc-falling');
  done();
}

// ── CONSOLE (r692) ──────────────────────────────────────────────────────────
// A command line at the foot of the board types what is happening, the old screen
// scrolls up and out, the new one scrolls up in. The command reads from what is up:
// a pick or reward board on screen means the chain is closing (DEAL), else opening.
function scTypeLine(el, text) {
  const cps = typeof textTypeCps === 'function' ? textTypeCps() : 160;
  if (!cps) { el.textContent = text; return Promise.resolve(); }
  return new Promise(res => { let i = 0; const t = setInterval(() => { i++; el.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(t); res(); } }, 1000 / cps); });
}
async function scConsole(swap, done) {
  const S = scStage(), grid = document.getElementById('grid');
  if (!S || !grid) { swap(); done(); return; }
  const k = typeof animSlow === 'function' ? animSlow() : 1;
  const MS = SC_CON_MS * k, STAG = SC_CON_STAG * k;
  const gr = scStageRect(grid, S.st, S.z, S.sr);
  const panel = document.getElementById('flowr-bg'), stack = document.getElementById('flowr-stack');
  const closing = document.body.classList.contains('gp-active') || document.body.classList.contains('grid-screen') || !!grid.querySelector('.gp-opt, .reward-cell');
  const cmd = closing ? 'DEAL' : 'OPEN REWARDS';
  grid.classList.add('sc-falling');
  const line = document.createElement('div'); line.className = 'sc-cmd';
  line.innerHTML = '<b>&gt; </b><span></span><i></i>';
  grid.appendChild(line);
  try { sfxScreenTurn(MS * .6); } catch (e) {}
  await scTypeLine(line.querySelector('span'), cmd);
  await scWait(90 * k);
  // OUT: the top row first, everything scrolls up past the box's top edge.
  const kids = scGridItems(grid).map(el => ({ el, r: scStageRect(el, S.st, S.z, S.sr) }));
  const rows = [...new Set(kids.map(x => Math.round(x.r.t / 4)))].sort((a, b) => a - b);
  const outs = kids.map(({ el, r }) => el.animate([{ translate: '0 0' }, { translate: `0 ${(-(r.t - gr.t + r.h + 12)).toFixed(1)}px` }],
    { duration: MS, delay: rows.indexOf(Math.round(r.t / 4)) * STAG, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }));
  const fades = [panel, stack].filter(e => e && e.offsetWidth).map(e => e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MS, fill: 'forwards' }));
  await Promise.all(outs.concat(fades).map(a => a.finished.catch(() => {})));
  kids.forEach(({ el }) => { el.style.visibility = 'hidden'; });
  outs.forEach(a => a.cancel()); fades.forEach(a => a.cancel());
  try { swap(); } catch (e) { console.error(e); }
  kids.forEach(({ el }) => { if (el.isConnected) el.style.visibility = ''; });
  grid.appendChild(line);   // the swap may have rebuilt the board; the line stays through the scroll in
  await scFrames();
  // IN: the new screen scrolls up from below the box, bottom row first.
  const S2 = scStage() || S, gr2 = scStageRect(grid, S2.st, S2.z, S2.sr);
  const news = scGridItems(grid).filter(el => !el.getAnimations().length).map(el => ({ el, r: scStageRect(el, S2.st, S2.z, S2.sr) }));
  const rows2 = [...new Set(news.map(x => Math.round(x.r.t / 4)))].sort((a, b) => b - a);
  const ins = news.map(({ el, r }) => el.animate([{ translate: `0 ${(gr2.t + gr2.h - r.t + 12).toFixed(1)}px` }, { translate: '0 0' }],
    { duration: MS, delay: rows2.indexOf(Math.round(r.t / 4)) * STAG, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'backwards' }));
  const shows = [panel, stack].filter(e => e && e.offsetWidth).map(e => e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MS * .8, easing: 'ease-out' }));
  line.classList.add('sc-cmd-done');
  setTimeout(() => { try { sfxScreenLatch(); } catch (e) {} }, MS * .8);
  await Promise.all(ins.concat(shows).map(a => a.finished.catch(() => {})));
  ins.forEach(a => a.cancel()); shows.forEach(a => a.cancel());
  line.remove();
  grid.classList.remove('sc-falling');
  done();
}

// ── SOUNDS ──────────────────────────────────────────────────────────────────
// A small motor under load (a low saw through a closing filter, with rumble),
// and the latch: a click and a body thump as the panel hits its stop.
function sfxScreenTurn(ms) {
  if (typeof ptVoice !== 'function') return;
  const sec = Math.max(0.15, (ms || 380) / 1000);
  ptVoice((ctx, v, t) => {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(95, t + sec * 0.6);
    o.frequency.linearRampToValueAtTime(62, t + sec);
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(260, t + sec);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.04);
    g.gain.setValueAtTime(0.05 * v, t + sec * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
    o.connect(f).connect(g).connect(sfxOut(ctx)); o.start(t); o.stop(t + sec + 0.02);
    const rumble = ptNoiseBuf(ctx, sec, (ts, p) => Math.sin(Math.PI * p) * 0.8);
    ptPlay(ctx, rumble, t, 0.06 * v, 'bandpass', 180, 1.4);
  });
}
function sfxScreenLatch() {
  if (typeof ptVoice !== 'function') return;
  ptVoice((ctx, v, t) => {
    const click = ptNoiseBuf(ctx, 0.01, (ts, p) => 1 - p);
    ptPlay(ctx, click, t, 0.12 * v, 'bandpass', 2600, 2);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.16);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(sfxOut(ctx)); o.start(t); o.stop(t + 0.22);
  });
}

// Dev -> Aesthetics -> Screen change -> Preview: one change on whatever is up.
function screenChangePreview() {
  if (typeof toggleDevPanel === 'function' && document.getElementById('dev-panel')?.classList.contains('show')) toggleDevPanel();
  setTimeout(() => screenChange(() => {}), 150);
}
document.addEventListener('DOMContentLoaded', () => setScreenChange(scLook));
