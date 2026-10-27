// ══════════════════════════════════════════════
// SCREEN CHANGE (r532) - how the machine explains a screen changing over
// ══════════════════════════════════════════════
// Owner: the game is a piece of hardware, so the screen cannot just become a
// different screen. Flow's reward chain opens and closes through one of these:
//   'turn'    the right-hand side of the machine (board, Focus gauge, clock, keys
//             and the housing between them) revolves on a vertical axis like a
//             rotating wall panel, over a dark cavity; the reward screen is on
//             its back. Then it revolves home again.
//   'shutter' housing plates slide out from under the screen's bezel, meet,
//             the screen changes behind them, and they slide apart.
//   'fall'    (r691, owner, the default) the screen's contents fall out of the bottom of
//             the board's box and the next screen's fall in from the top. Nothing in
//             the housing moves: the keys stay put and only their dot words change
//             (js/key-dots.js), as the owner asked.
//   'none'    the old cut.
// screenChange(swap) runs the first half, calls swap() at the moment nothing of
// the screen is visible, and runs the second half. Dev -> Aesthetics -> Screen
// change; the store holds only a non-default choice.
const SC_KEY = 'lethe.screenChange.v1';
const SC_LOOKS = ['fall', 'turn', 'shutter', 'none'];
const SC_DEFAULT = 'fall';
const SC_FALL_OUT = 420;     // one item's drop out of the box, x animSlow()
const SC_FALL_IN = 560;      // one item's fall in, with its bounce
const SC_FALL_STAG = 26;     // between columns / rows
const SC_TURN_MS = 380;      // the turn away; the turn home is 1.3x (it settles)
const SC_PERSP = 1100;       // design px
const SC_SHUT_MS = 300;      // plates closing; opening is the same
const SC_SHUT_HOLD = 160;    // closed, while the screen changes behind them
const SC_RIGHT_LAND = ['clock-area', 'vclock', 'focus-meter-wrap', 'grid-slot', 'swap-indicator', 'btn-discard', 'btn-play'];
const SC_RIGHT_PORT = ['focus-meter-wrap', 'grid-slot', 'swap-indicator', 'btn-discard', 'btn-play'];

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
  try { (scLook === 'shutter' ? scShutter : scLook === 'fall' ? scFall : scTurn)(swap, done); }
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

// The housing's own surface, for a plate that has to look like a piece of it:
// #stage's computed background, copied onto a box of the stage's own size so
// every layer (grain, seams, screws) lands where it does on the housing.
function scHousingBg(el, S) {
  const cs = getComputedStyle(S.st);
  ['backgroundColor', 'backgroundImage', 'backgroundRepeat', 'backgroundSize', 'backgroundPosition']
    .forEach(k => { el.style[k] = cs[k]; });
}
// A moving door carries a stage-sized copy, offset to the place it closes over.
function scHousingSkin(door, S, l, t) {
  const sk = document.createElement('b');
  sk.className = 'sc-skin';
  sk.style.cssText = `left:${-l}px;top:${-t}px;width:${S.st.offsetWidth}px;height:${S.st.offsetHeight}px;`;
  scHousingBg(sk, S);
  door.appendChild(sk);
}

// ── TURN ────────────────────────────────────────────────────────────────────
async function scTurn(swap, done) {
  const S = scStage(); if (!S) { swap(); done(); return; }
  const land = S.st.classList.contains('landscape');
  const els = (land ? SC_RIGHT_LAND : SC_RIGHT_PORT).map(id => document.getElementById(id))
    .filter(e => e && e.offsetWidth && getComputedStyle(e).display !== 'none');
  if (!els.length) { swap(); done(); return; }
  // The panel: from the left seam to the stage's right edge in landscape, the
  // board block's full width in portrait.
  const boxes = els.map(e => scStageRect(e, S.st, S.z, S.sr));
  let U = { l: Math.min(...boxes.map(b => b.l)), t: Math.min(...boxes.map(b => b.t)),
            r: Math.max(...boxes.map(b => b.l + b.w)), b: Math.max(...boxes.map(b => b.t + b.h)) };
  const W = S.st.offsetWidth, H = S.st.offsetHeight;
  if (land) U = { l: W * 0.4135, t: 0, r: W, b: H };
  else U = { l: 0, t: Math.max(0, U.t - 6), r: W, b: Math.min(H, U.b + 6) };
  const ax = (U.l + U.r) / 2, ay = (U.t + U.b) / 2;

  const cavity = document.createElement('div');
  cavity.className = 'sc-cavity';
  cavity.style.cssText = `left:${U.l}px;top:${U.t}px;width:${U.r - U.l}px;height:${U.b - U.t}px;`;
  const plate = document.createElement('div');
  plate.className = 'sc-plate';
  plate.style.cssText = `left:0;top:0;width:${W}px;height:${H}px;clip-path:inset(${U.t}px ${W - U.r}px ${H - U.b}px ${U.l}px);`;
  scHousingBg(plate, S);
  S.st.insertBefore(plate, S.st.firstChild);
  S.st.insertBefore(cavity, S.st.firstChild);

  const parts = [{ el: plate, ox: ax, oy: ay }].concat(els.map((el, i) => ({ el, ox: ax - boxes[i].l, oy: ay - boxes[i].t })));
  const saved = parts.map(p => p.el.style.transformOrigin);
  parts.forEach(p => { p.el.style.transformOrigin = `${p.ox}px ${p.oy}px`; });
  const tf = a => `perspective(${SC_PERSP}px) rotateY(${a}deg)`;
  try { sfxScreenTurn(SC_TURN_MS); } catch (e) {}
  const out = parts.map(p => p.el.animate([
    { transform: tf(0), filter: 'brightness(1)' },
    { transform: tf(-5), offset: 0.14 },
    { transform: tf(90), filter: 'brightness(.45)' }],
    { duration: SC_TURN_MS, easing: 'cubic-bezier(.5,0,.85,.45)', fill: 'forwards' }));
  await Promise.all(out.map(a => a.finished.catch(() => {})));

  // Edge-on: nothing of the panel shows, so the screen changes now, laid out
  // with no transforms in the way (the board is measured off its real box).
  parts.forEach(p => p.el.classList.add('sc-hide'));
  out.forEach(a => a.cancel());
  try { swap(); } catch (e) { console.error(e); }
  await scFrames();

  // The panel's back comes round. Re-measured: the swap may move a part.
  const S2 = scStage() || S;
  parts.forEach(p => {
    if (p.el === plate) return;
    const b = scStageRect(p.el, S2.st, S2.z, S2.sr);
    p.el.style.transformOrigin = `${ax - b.l}px ${ay - b.t}px`;
  });
  const T2 = SC_TURN_MS * 1.3;
  const back = parts.map(p => p.el.animate([
    { transform: tf(-90), filter: 'brightness(.45)' },
    { transform: tf(7), filter: 'brightness(1.05)', offset: 0.72 },
    { transform: tf(-2.5), offset: 0.87 },
    { transform: tf(0), filter: 'brightness(1)' }],
    { duration: T2, easing: 'cubic-bezier(.2,.6,.35,1)', fill: 'forwards' }));
  parts.forEach(p => p.el.classList.remove('sc-hide'));
  setTimeout(() => { try { sfxScreenLatch(); } catch (e) {} }, T2 * 0.72);
  await Promise.all(back.map(a => a.finished.catch(() => {})));
  back.forEach(a => a.cancel());
  parts.forEach((p, i) => { p.el.style.transformOrigin = saved[i]; });
  plate.remove(); cavity.remove();
  done();
}

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

// ── SHUTTER ─────────────────────────────────────────────────────────────────
// The screen's recess: the board, and the Flow reward panel when it is up.
function scScreenRect(S) {
  const ids = ['grid', 'flowr-bg'];
  const rs = ids.map(id => document.getElementById(id))
    .filter(e => e && e.offsetWidth && getComputedStyle(e).visibility !== 'hidden')
    .map(e => scStageRect(e, S.st, S.z, S.sr));
  if (!rs.length) return null;
  return { l: Math.min(...rs.map(b => b.l)), t: Math.min(...rs.map(b => b.t)),
           r: Math.max(...rs.map(b => b.l + b.w)), b: Math.max(...rs.map(b => b.t + b.h)) };
}
function scPlaceBox(box, R) {
  box.style.cssText = `left:${R.l}px;top:${R.t}px;width:${R.r - R.l}px;height:${R.b - R.t}px;`;
}
async function scShutter(swap, done) {
  const S = scStage(); const R = S && scScreenRect(S);
  if (!R) { swap(); done(); return; }
  const box = document.createElement('div');
  box.className = 'sc-shutter';
  scPlaceBox(box, R);
  const machine = typeof trayMachineOn === 'function' && trayMachineOn();
  const top = document.createElement('i'), bot = document.createElement('i');
  top.className = 'sc-door sc-door-top'; bot.className = 'sc-door sc-door-bot';
  if (machine) { scHousingSkin(top, S, R.l, R.t); scHousingSkin(bot, S, R.l, (R.t + R.b) / 2); box.classList.add('sc-housing'); }
  box.append(top, bot);
  S.st.appendChild(box);
  try { sfxScreenTurn(SC_SHUT_MS * 0.8); } catch (e) {}
  const close = (el, from) => el.animate([
    { transform: `translateY(${from}%)` },
    { transform: 'translateY(0%)', offset: 0.82 },
    { transform: `translateY(${from > 0 ? 3 : -3}%)`, offset: 0.91 },
    { transform: 'translateY(0%)' }],
    { duration: SC_SHUT_MS, easing: 'cubic-bezier(.55,0,.9,.5)', fill: 'forwards' });
  const a1 = close(top, -102), a2 = close(bot, 102);
  setTimeout(() => { try { sfxScreenLatch(); } catch (e) {} }, SC_SHUT_MS * 0.82);
  await Promise.all([a1.finished, a2.finished].map(p => p.catch(() => {})));
  try { swap(); } catch (e) { console.error(e); }
  await scFrames();
  await scWait(SC_SHUT_HOLD);
  // The recess the doors open on: the old and the new screen together.
  const R2 = scScreenRect(scStage() || S);
  if (R2) scPlaceBox(box, { l: Math.min(R.l, R2.l), t: Math.min(R.t, R2.t), r: Math.max(R.r, R2.r), b: Math.max(R.b, R2.b) });
  try { sfxScreenTurn(SC_SHUT_MS * 0.8); } catch (e) {}
  const open = (el, to) => el.animate([{ transform: 'translateY(0%)' }, { transform: `translateY(${to}%)` }],
    { duration: SC_SHUT_MS, easing: 'cubic-bezier(.3,.4,.4,1)', fill: 'forwards' });
  a1.cancel(); a2.cancel();
  const b1 = open(top, -102), b2 = open(bot, 102);
  await Promise.all([b1.finished, b2.finished].map(p => p.catch(() => {})));
  box.remove();
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
