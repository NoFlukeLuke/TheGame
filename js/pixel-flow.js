// ══════════════════════════════════════════════
// PIXEL FLOW (r853, owner): a number leaves as lit squares that fly, each on its own
// clock, to the squares of the number it joins. The score merge's LED carry
// (js/pmf-merge.js, _pmfLedCarry) does this inside the score row; this is the same
// look over the whole display, for what crosses between screens:
//   - the fused hand score flying into SCORE (pmfFlyToScore, LEDs look)
//   - a score chip's last stretch into PIPS or MULT (ptLaunch's `pixTo`): the chip's
//     background fades and the squares of its label flow onto the figure it lands on.
// One body-level fixed canvas (no id, no pointer events), so in console mode the
// housing takes it under its mask like any flier. It exists only while squares fly.
// ══════════════════════════════════════════════
const PXF_CFG = {
  tail: .38,     // share of a chip's flight (after it has sat) given to its squares
  spread: .4,    // share of a flow over which the squares set off
  fade: 110,     // ms the chip's background takes to go
  minTail: 140,  // a chip with less flight than this keeps its plain landing
};
let _pxf = null;   // { c, x, dpr, items, raf }

function pxfReduced() {
  return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function pxfLayer() {
  if (_pxf && _pxf.c.isConnected) return _pxf;
  const dpr = window.devicePixelRatio || 1;
  const c = document.createElement('canvas'); c.className = 'pxf-layer'; c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:710;';
  c.width = Math.max(1, Math.round(innerWidth * dpr)); c.height = Math.max(1, Math.round(innerHeight * dpr));
  document.body.appendChild(c);
  _pxf = { c, x: c.getContext('2d'), dpr, items: [], raf: 0 };
  return _pxf;
}
function pxfClear() {
  if (!_pxf) return;
  if (_pxf.raf) cancelAnimationFrame(_pxf.raf);
  try { _pxf.c.remove(); } catch (e) {}
  _pxf = null;
}

// A number's squares in device px of the display: the keys' 5x7 grid sized like the
// LED matrix's readouts (js/led-matrix.js), centred on the text. `text` overrides what
// is read; `rect` overrides where (an odometer's cells are not its number).
function pxfDotsOf(el, text, rect) {
  const dpr = window.devicePixelRatio || 1;
  const rgb = (typeof _pmfRGB === 'function') ? _pmfRGB(getComputedStyle(el).color) : [255, 255, 255];
  const t = String(text != null ? text : (el.textContent || '')).replace(/\s+/g, ' ').trim().toUpperCase();
  const tr = rect || ((typeof _pmfTextRect === 'function') ? _pmfTextRect(el) : el.getBoundingClientRect());
  if (!t || !tr || !tr.width || typeof kdGlyph !== 'function') return { P: 2, dots: [], rgb };
  const glyphs = [...t].map(ch => ch === ' ' ? null : kdGlyph(7, ch));
  let cols = 0; glyphs.forEach((g, i) => { cols += (g ? g.w : 3) + (i < glyphs.length - 1 ? 1 : 0); });
  let P = Math.floor(tr.height * dpr * .72 / 7);
  const room = tr.width * dpr;
  if (cols && cols * P > room) P = Math.floor(room / cols);
  P = Math.max(2, P);
  const x0 = Math.round((tr.left + tr.width / 2) * dpr - cols * P / 2), y0 = Math.round((tr.top + tr.height / 2) * dpr - 7 * P / 2);
  const dots = []; let gx = x0;
  glyphs.forEach(g => {
    if (g) g.rows.forEach((row, ry) => row.forEach((on, rx) => { if (on) dots.push({ x: gx + rx * P, y: y0 + ry * P }); }));
    gx += ((g ? g.w : 3) + 1) * P;
  });
  return { P, dots, rgb };
}

// Fly squares A onto squares B over `dur` ms. Every target takes a square while there
// are enough; spare squares land on a target already taken. Resolves after `dur`
// (a timer, not the frames: rAF stops in a background tab).
function pxfFlow(A, B, dur) {
  if (!A.dots.length || !B.dots.length || dur <= 0) return Promise.resolve();
  const L = pxfLayer(), now = performance.now(), spread = dur * PXF_CFG.spread;
  const rnd = () => (typeof fxRandom === 'function' ? fxRandom() : Math.random());
  const tg = B.dots.slice();
  for (let i = tg.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = tg[i]; tg[i] = tg[j]; tg[j] = t; }
  A.dots.forEach((d, i) => {
    const t = i < tg.length ? tg[i] : tg[Math.floor(rnd() * tg.length)], off = rnd() * spread;
    L.items.push({ x0: d.x, y0: d.y, P0: A.P, rgb0: A.rgb, x1: t.x, y1: t.y, P1: B.P, rgb1: B.rgb, t0: now + off, dur: dur - off });
  });
  pxfTick();
  return new Promise(res => setTimeout(() => { pxfPrune(); res(); }, dur + 30));
}
function pxfPrune() {
  if (!_pxf) return;
  const now = performance.now();
  _pxf.items = _pxf.items.filter(it => now < it.t0 + it.dur);
  if (!_pxf.items.length) pxfClear();
}
function pxfTick() { if (_pxf && !_pxf.raf) _pxf.raf = requestAnimationFrame(pxfFrame); }
function pxfFrame(now) {
  const L = _pxf; if (!L) return;
  L.raf = 0;
  const x = L.x; x.clearRect(0, 0, L.c.width, L.c.height);
  L.items = L.items.filter(it => now < it.t0 + it.dur);
  if (!L.items.length) { pxfClear(); return; }
  for (const it of L.items) {
    const t = Math.min(1, Math.max(0, (now - it.t0) / it.dur));
    const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const P = it.P0 + (it.P1 - it.P0) * e, st = Math.max(1, it.P1);   // stepped a whole square at a time
    const px = it.x1 - Math.round((it.x1 - it.x0) * (1 - e) / st) * st;
    const py = it.y1 - Math.round((it.y1 - it.y0) * (1 - e) / st) * st;
    const rgb = [0, 1, 2].map(i => Math.round(it.rgb0[i] + (it.rgb1[i] - it.rgb0[i]) * e));
    const gap = P >= 3 ? 1 : .5, D = Math.max(1, P - gap), col = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(px - .5, py - .5, D + 1, D + 1);
    x.shadowColor = col; x.shadowBlur = P * 1.3;
    x.fillStyle = col; x.fillRect(px, py, D, D);
    x.shadowBlur = 0; x.shadowColor = 'transparent';
    x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(px, py, D, D);
  }
  pxfTick();
}

// A score chip's last stretch: its label becomes squares where it is, its background
// fades, and the squares flow onto the figure it lands on (`to`, #pips-val / #mult-val),
// arriving as the chip would have. Called by ptLaunch at the start of that stretch.
function pxfPlate(el, to, ms) {
  if (!el || !el.isConnected || !to || !to.isConnected) return;
  const lab = el.querySelector('.pt-lab'), box = el.querySelector('.pt-box');
  if (!lab) return;
  const A = pxfDotsOf(lab), B = pxfDotsOf(to);
  if (!A.dots.length || !B.dots.length) return;
  lab.style.visibility = 'hidden';
  if (box) box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Math.min(PXF_CFG.fade, ms * .5), easing: 'ease-out', fill: 'forwards' });
  pxfFlow(A, B, ms);
}
