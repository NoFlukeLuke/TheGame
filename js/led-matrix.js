// ══════════════════════════════════════════════
// LED MATRIX (r759, owner) - Settings -> Display -> LED matrix
// ══════════════════════════════════════════════
// One switch: the cards (js/pixel-art.js pxArtFaceHTML) and the readouts (score,
// goal, PIPS / MULT / FOCUS, the clock, the level / quarter, credits) are drawn the
// way the keys' words are (js/key-dots.js): letters on the 5x7 grid, each lit square
// on its own with a gap and a dark edge, glowing in the readout's colour.
// A readout keeps its text in the DOM, laid out but hidden (`.led-host`, visibility),
// and a canvas (`.led-c`) laid over it draws it: read back with a Range, so the squares
// sit where the text did and every writer of these readouts keeps writing them as before.
// The canvas is the readout's SIBLING, never its child: a child would be counted in the
// readout's scrollWidth, and the HUD's fitters (chipValFit) shrank the text to nothing.
// The rolling SCORE (js/score-rise.js) is read from its roll while it owns the box.
// Store `lethe.ledMatrix.v1` holds 'on' only.
const LED_KEY = 'lethe.ledMatrix.v1';
let ledMatrixOn = (() => { try { return localStorage.getItem(LED_KEY) === 'on'; } catch (e) { return false; } })();
function ledOn() { return ledMatrixOn; }
// The readouts it draws. `ink` is the colour when the host's own is transparent
// (console mode hides the clock's text under its flip clock).
const LED_TARGETS = [
  { sel: '#score-total-num' }, { sel: '#goal-display' },
  { sel: '#pips-val' }, { sel: '#mult-val' }, { sel: '#focus-val' },
  { sel: '#clock', ink: '#ffb02e' },
  { sel: '.rp-act' }, { sel: '.rp-lv' }, { sel: '.rp-lnum' }, { sel: '#level-display' },
  { sel: '.ci-main' },
];
const LED_CFG = { ink: .72, gap: 1, minP: 2, glow: .9 };   // ink: the glyph's 7 rows over the text's line height
const _led = new Map();      // host -> state
let _ledRaf = 0;

function setLedMatrix(on) {
  ledMatrixOn = !!on;
  try { ledMatrixOn ? localStorage.setItem(LED_KEY, 'on') : localStorage.removeItem(LED_KEY); } catch (e) {}
  ledApply();
}
function ledApply() {
  document.documentElement.classList.toggle('led-on', ledMatrixOn);
  if (!ledMatrixOn) {
    _led.forEach((st, el) => { st.mo && st.mo.disconnect(); st.c.remove(); el.classList.remove('led-host'); });
    document.querySelectorAll('.led-parent').forEach(p => p.classList.remove('led-parent'));
    _led.clear();
  } else ledScan();
  if (typeof pxArtApply === 'function') pxArtApply();   // the card background class, and a re-render so the cards take or lose their faces
}

// Find the hosts (screens come and go: the corner block, the phone's top bar).
function ledScan() {
  if (!ledMatrixOn) return;
  LED_TARGETS.forEach(t => document.querySelectorAll(t.sel).forEach(el => {
    if (_led.has(el)) { ledMount(_led.get(el)); return; }
    const c = document.createElement('canvas'); c.className = 'led-c'; c.setAttribute('aria-hidden', 'true');
    el.classList.add('led-host');
    const st = { el, c, x: c.getContext('2d'), t, sig: '' };
    st.mo = new MutationObserver(ledQueue);
    st.mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
    _led.set(el, st); ledMount(st);
  }));
  _led.forEach((st, el) => { if (!el.isConnected) { st.mo.disconnect(); st.c.remove(); _led.delete(el); } });
  ledQueue();
}
// The canvas sits beside its readout, in a positioned parent.
function ledMount(st) {
  const p = st.el.parentElement; if (!p) return false;
  if (st.c.parentElement !== p || st.c.previousElementSibling !== st.el) { st.el.after(st.c); st.sig = ''; }
  if (getComputedStyle(p).position === 'static') p.classList.add('led-parent');
  return true;
}
function ledQueue() { if (!_ledRaf) _ledRaf = requestAnimationFrame(ledFrame); }
function ledFrame() {
  _ledRaf = 0;
  _led.forEach(st => ledDraw(st));
  // the rolling score moves by transform, which no observer sees: follow it while it rolls
  if (typeof rise !== 'undefined' && rise.owns) ledQueue();
}

// The host's words: the roll's figure while it owns the score, else the text.
function ledText(st) {
  const el = st.el;
  if (el.id === 'score-total-num' && typeof rise !== 'undefined' && rise.owns) return Math.floor(rise.cur).toLocaleString();
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}
// Where the text sits (viewport px): the Range over its text, clipped to the host's
// line when the text is taller than the box (the odometer's wheels).
function ledTextRect(el) {
  const r = document.createRange(); r.selectNodeContents(el);
  const rs = [...r.getClientRects()].filter(x => x.width > 0 && x.height > 0);
  const hr = el.getBoundingClientRect();
  if (!rs.length) return hr;
  let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
  rs.forEach(x => { L = Math.min(L, x.left); T = Math.min(T, x.top); R = Math.max(R, x.right); B = Math.max(B, x.bottom); });
  if (el.classList.contains('odo')) { T = hr.top; B = hr.bottom; }
  return { left: L, top: T, right: R, bottom: B, width: R - L, height: B - T };
}
function ledInk(st) {
  const col = getComputedStyle(st.el).color;
  const m = col.match(/rgba?\(([^)]+)\)/);
  const a = m ? (m[1].split(',')[3] != null ? parseFloat(m[1].split(',')[3]) : 1) : 1;
  return a < .05 ? (st.t.ink || '#e8e4d8') : col;
}

function ledDraw(st) {
  const el = st.el, c = st.c, x = st.x;
  if (!el.isConnected || typeof kdGlyph !== 'function') return;
  if (!ledMount(st)) return;
  const p = el.parentElement, pr = p.getBoundingClientRect();
  const hr = el.getBoundingClientRect();
  if (!hr.width || !el.offsetWidth) { if (st.sig) { st.sig = ''; c.width = c.height = 0; } return; }
  const text = ledText(st).toUpperCase();
  const tr = ledTextRect(el);
  const z = hr.width / el.offsetWidth, dpr = window.devicePixelRatio || 1;
  const ink = ledInk(st);
  const sig = [text, Math.round(hr.left - pr.left), Math.round(hr.top - pr.top), Math.round(hr.width), Math.round(hr.height),
    Math.round(tr.left), Math.round(tr.width), Math.round(tr.height), ink, dpr].join('|');
  if (sig === st.sig) return;
  st.sig = sig;
  // Pitch in device px: the glyph's 7 rows fill LED_CFG.ink of the text's height, never
  // wider than the host can show.
  const glyphs = [...text].map(ch => ch === ' ' ? null : kdGlyph(7, ch));
  let cols = 0; glyphs.forEach((g, i) => { cols += (g ? g.w : 3) + (i < glyphs.length - 1 ? 1 : 0); });
  let P = Math.floor(tr.height * dpr * LED_CFG.ink / 7);
  const room = Math.max(hr.width, tr.width) * dpr;
  if (cols && cols * P > room) P = Math.floor(room / cols);
  P = Math.max(LED_CFG.minP, P);
  const pad = Math.ceil(P * 2);   // room for the glow
  const W = cols * P + pad * 2, H = 7 * P + pad * 2;
  // centred on where the text was drawn, placed in the parent's padding box
  const ox = pr.left + p.clientLeft * z, oy = pr.top + p.clientTop * z;
  const cx = (tr.left + tr.width / 2 - ox) * dpr, cy = (tr.top + tr.height / 2 - oy) * dpr;
  const left = Math.round(cx - W / 2), top = Math.round(cy - H / 2);   // whole device px, so the squares stay sharp
  c.width = Math.max(1, Math.round(W)); c.height = Math.max(1, Math.round(H));
  const css = v => (v / dpr / z) + 'px';
  c.style.left = css(left); c.style.top = css(top); c.style.width = css(W); c.style.height = css(H);
  c.style.setProperty('--led-ink', ink);
  x.clearRect(0, 0, c.width, c.height);
  const gap = P >= 3 ? LED_CFG.gap : 0.5, D = P - gap;
  let gx = pad;
  glyphs.forEach(g => {
    if (g) g.rows.forEach((row, ry) => row.forEach((on, rx) => {
      if (!on) return;
      const px = gx + rx * P, py = pad + ry * P;
      x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(px - .5, py - .5, D + 1, D + 1);
      x.fillStyle = ink; x.fillRect(px, py, D, D);
      x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(px, py, D, D);
    }));
    gx += ((g ? g.w : 3) + 1) * P;
  });
}

window.addEventListener('resize', () => { _led.forEach(st => st.sig = ''); ledQueue(); });
setInterval(() => { if (ledMatrixOn) ledScan(); }, 700);
if (document.body) ledApply(); else document.addEventListener('DOMContentLoaded', ledApply);
