// ══════════════════════════════════════════════
// KEY DOTS (r670, owner) - the keys' words drawn in lit dots
// ══════════════════════════════════════════════
// With the tube key look (js/key-looks.js) every word on PLAY, DISCARD and SWAP,
// and on the keys other screens borrow (CONFIRM, REROLL, BUY, CLOCK IN...), is a
// dot matrix: lit squares in the key's colour, each with a dark outline and a gap,
// on a canvas laid over the key's glass (`.kd-c`). The key's own text stays in the
// DOM, laid out as ever but transparent (css/key-looks.css): each line is read back
// from it (a Range per character), so the dots sit where the words always did and
// every screen that writes a key's words keeps writing them the old way.
// A glyph that changes falls out of the bottom of the glass (clipped at its edge)
// and KD_IN_DELAY later the new one falls in from the top, its dots setting off in
// a random order, so the word builds itself. Unchanged glyphs stay put.
// Fonts: 5x7 for words, 3x5 for small print (a cost, a count). Upper case only.
const KD_IN_DELAY = 300;     // ms from the old word starting to fall to the new one starting
const KD_OUT_SPREAD = 90;    // ms over which the old dots let go
const KD_IN_SPREAD = 380;    // ms over which the new dots set off
const KD_G = 2600;           // the fall, design px per s^2
const KD_KEYS = ['swap-indicator', 'btn-discard', 'btn-play', 'btn-leave'];
const KD_SKIP = '.kd-c, .mapk-ico, .mapk-sw, .kb-ico';   // drawn by the browser, never as dots (r672: the borrowed keys' icons too)

// x = a lit dot. Rows top to bottom, space-separated.
const KD_F7_SRC = {
  A: '.xxx. x...x x...x xxxxx x...x x...x x...x', B: 'xxxx. x...x x...x xxxx. x...x x...x xxxx.',
  C: '.xxx. x...x x.... x.... x.... x...x .xxx.', D: 'xxx.. x..x. x...x x...x x...x x..x. xxx..',
  E: 'xxxxx x.... x.... xxxx. x.... x.... xxxxx', F: 'xxxxx x.... x.... xxxx. x.... x.... x....',
  G: '.xxx. x...x x.... x.xxx x...x x...x .xxxx', H: 'x...x x...x x...x xxxxx x...x x...x x...x',
  I: 'xxx .x. .x. .x. .x. .x. xxx',             J: '..xxx ...x. ...x. ...x. ...x. x..x. .xx..',
  K: 'x...x x..x. x.x.. xx... x.x.. x..x. x...x', L: 'x.... x.... x.... x.... x.... x.... xxxxx',
  M: 'x...x xx.xx x.x.x x.x.x x...x x...x x...x', N: 'x...x x...x xx..x x.x.x x..xx x...x x...x',
  O: '.xxx. x...x x...x x...x x...x x...x .xxx.', P: 'xxxx. x...x x...x xxxx. x.... x.... x....',
  Q: '.xxx. x...x x...x x...x x.x.x x..x. .xx.x', R: 'xxxx. x...x x...x xxxx. x.x.. x..x. x...x',
  S: '.xxxx x.... x.... .xxx. ....x ....x xxxx.', T: 'xxxxx ..x.. ..x.. ..x.. ..x.. ..x.. ..x..',
  U: 'x...x x...x x...x x...x x...x x...x .xxx.', V: 'x...x x...x x...x x...x x...x .x.x. ..x..',
  W: 'x...x x...x x...x x.x.x x.x.x x.x.x .x.x.', X: 'x...x x...x .x.x. ..x.. .x.x. x...x x...x',
  Y: 'x...x x...x x...x .x.x. ..x.. ..x.. ..x..', Z: 'xxxxx ....x ...x. ..x.. .x... x.... xxxxx',
  0: '.xxx. x...x x..xx x.x.x xx..x x...x .xxx.', 1: '..x.. .xx.. ..x.. ..x.. ..x.. ..x.. .xxx.',
  2: '.xxx. x...x ....x ...x. ..x.. .x... xxxxx', 3: 'xxxxx ...x. ..x.. ...x. ....x x...x .xxx.',
  4: '...x. ..xx. .x.x. x..x. xxxxx ...x. ...x.', 5: 'xxxxx x.... xxxx. ....x ....x x...x .xxx.',
  6: '..xx. .x... x.... xxxx. x...x x...x .xxx.', 7: 'xxxxx ....x ...x. ..x.. .x... .x... .x...',
  8: '.xxx. x...x x...x .xxx. x...x x...x .xxx.', 9: '.xxx. x...x x...x .xxxx ....x ...x. .xx..',
  '.': '. . . . . . x', ',': '.. .. .. .. .. .x x.', ':': '. . x . x . .', '!': 'x x x x x . x',
  '?': '.xxx. x...x ....x ...x. ..x.. ..... ..x..', "'": 'x x . . . . .', '"': 'x.x x.x ... ... ... ... ...',
  '+': '..... ..x.. ..x.. xxxxx ..x.. ..x.. .....', '-': '.... .... .... xxxx .... .... ....',
  '=': '..... ..... xxxxx ..... xxxxx ..... .....', '/': '..... ....x ...x. ..x.. .x... x.... .....',
  '(': '..x .x. x.. x.. x.. .x. ..x', ')': 'x.. .x. ..x ..x ..x .x. x..',
  '%': 'xx... xx..x ...x. ..x.. .x... x..xx ...xx', '#': '.x.x. .x.x. xxxxx .x.x. xxxxx .x.x. .x.x.',
  '*': '..... ..x.. x.x.x .xxx. x.x.x ..x.. .....', '_': '..... ..... ..... ..... ..... ..... xxxxx',
  '<': '...x ..x. .x.. x... .x.. ..x. ...x', '>': 'x... .x.. ..x. ...x ..x. .x.. x...',
  '·': '. . . x . . .', '•': '.. .. xx xx .. .. ..', '×': '..... x...x .x.x. ..x.. .x.x. x...x .....',
  '↓': '..x.. ..x.. ..x.. ..x.. x.x.x .xxx. ..x..', '↑': '..x.. .xxx. x.x.x ..x.. ..x.. ..x.. ..x..',
  '←': '..... ..x.. .x... xxxxx .x... ..x.. .....', '→': '..... ..x.. ...x. xxxxx ...x. ..x.. .....',
  '◆': '..... ..x.. .xxx. xxxxx .xxx. ..x.. .....', '∞': '..... ..... .x.x. x.x.x .x.x. ..... .....',
  '▶': 'x... xx.. xxx. xxxx xxx. xx.. x...', '$': '..x.. .xxxx x.x.. .xxx. ..x.x xxxx. ..x..',
};
const KD_F5_SRC = {
  A: '.x. x.x xxx x.x x.x', B: 'xx. x.x xx. x.x xx.', C: '.xx x.. x.. x.. .xx', D: 'xx. x.x x.x x.x xx.',
  E: 'xxx x.. xx. x.. xxx', F: 'xxx x.. xx. x.. x..', G: '.xx x.. x.x x.x .xx', H: 'x.x x.x xxx x.x x.x',
  I: 'xxx .x. .x. .x. xxx', J: '..x ..x ..x x.x .x.', K: 'x.x x.x xx. x.x x.x', L: 'x.. x.. x.. x.. xxx',
  M: 'x...x xx.xx x.x.x x...x x...x', N: 'x..x xx.x x.xx x..x x..x', O: '.x. x.x x.x x.x .x.',
  P: 'xx. x.x xx. x.. x..', Q: '.x. x.x x.x xxx .xx', R: 'xx. x.x xx. x.x x.x', S: '.xx x.. .x. ..x xx.',
  T: 'xxx .x. .x. .x. .x.', U: 'x.x x.x x.x x.x xxx', V: 'x.x x.x x.x x.x .x.',
  W: 'x...x x...x x.x.x x.x.x .x.x.', X: 'x.x x.x .x. x.x x.x', Y: 'x.x x.x .x. .x. .x.', Z: 'xxx ..x .x. x.. xxx',
  0: 'xxx x.x x.x x.x xxx', 1: '.x. xx. .x. .x. xxx', 2: 'xx. ..x .x. x.. xxx', 3: 'xx. ..x .x. ..x xx.',
  4: 'x.x x.x xxx ..x ..x', 5: 'xxx x.. xx. ..x xx.', 6: '.xx x.. xxx x.x xxx', 7: 'xxx ..x .x. .x. .x.',
  8: 'xxx x.x xxx x.x xxx', 9: 'xxx x.x xxx ..x xx.',
  '.': '. . . . x', ',': '. . . x x', ':': '. x . x .', '!': 'x x x . x', '?': 'xx. ..x .x. ... .x.',
  "'": 'x x . . .', '+': '... .x. xxx .x. ...', '-': '... ... xxx ... ...', '/': '..x ..x .x. x.. x..',
  '(': '.x x. x. x. .x', ')': 'x. .x .x .x x.', '%': 'x.x ..x .x. x.. x.x', '=': '... xxx ... xxx ...',
  '·': '. . x . .', '•': '. . x . .', '×': '... x.x .x. x.x ...', '◆': '... .x. xxx .x. ...',
  '↓': '.x. .x. .x. xxx .x.', '↑': '.x. xxx .x. .x. .x.', '←': '... .x. xxx .x. ...', '→': '... .x. xxx .x. ...',
  '∞': '..... .x.x. x.x.x .x.x. .....', '▶': 'x.. xx. xxx xx. x..', '#': 'x.x xxx x.x xxx x.x',
};
function kdFont(src) {
  const f = {};
  for (const ch in src) { const rows = src[ch].split(' '); f[ch] = { w: rows[0].length, rows: rows.map(r => [...r].map(c => c === 'x')) }; }
  return f;
}
const KD_FONTS = { 7: kdFont(KD_F7_SRC), 5: kdFont(KD_F5_SRC) };
const kdGlyph = (kind, ch) => KD_FONTS[kind][ch] || KD_FONTS[kind][ch.toUpperCase()] || null;
// A line's width in dots: glyphs a dot apart, a space three (two in the small font).
function kdLineDots(kind, text) {
  let w = 0, n = 0;
  for (const ch of text) { const g = ch === ' ' ? null : kdGlyph(kind, ch); w += g ? g.w : (kind === 7 ? 3 : 2); n++; }
  return w + Math.max(0, n - 1);
}

function kdOn() { return typeof keyLookOn === 'function' && keyLookOn(); }
const _kd = new Map();        // key element -> state
const _kdDirty = new Map();   // key element -> resync at once (no fall)?
let _kdRaf = 0, _kdQueued = false, _kdS = 1;   // _kdS: design px -> device px, for the fall's speed

// The key's words as lines in its own design px: { text, cx, cy, fs, a }, top to bottom.
// Elements the browser draws (icons, the pen swatch) come back as `blocks`.
function kdRead(el, z) {
  const kr = el.getBoundingClientRect();
  const lines = [], range = document.createRange();
  const blocks = [...el.querySelectorAll('.mapk-ico, .kb-ico')].map(b => b.getBoundingClientRect()).filter(r => r.width && r.height)
    .map(r => ({ top: (r.top - kr.top) / z, bot: (r.bottom - kr.top) / z }));
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let line = null;
  for (let n; (n = tw.nextNode()); ) {
    const p = n.parentElement; if (!p) continue;
    if (p.closest(KD_SKIP)) { line = null; continue; }
    const cs = getComputedStyle(p);
    if (cs.visibility === 'hidden') continue;
    // dimmed words (a tool that cannot act) keep their dimming; the key's own opacity is the canvas's too
    let a = 1; for (let q = p; q && q !== el; q = q.parentElement) { const o = parseFloat(getComputedStyle(q).opacity); if (o < 1) a *= o; }
    if (a < .02) continue;
    const fs = parseFloat(cs.fontSize) || 12, t = n.data;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === '\n' || ch === '\r') { line = null; continue; }
      range.setStart(n, i); range.setEnd(n, i + 1);
      const r = range.getClientRects()[0];
      if (!r || r.height <= 0 || (r.width <= 0 && ch !== ' ')) continue;
      const x = (r.left - kr.left) / z, y = (r.top - kr.top) / z, w = r.width / z, h = r.height / z, cy = y + h / 2;
      if (!line || Math.abs(cy - line.cy) > Math.max(h, line.h) * .45 || x < line.r - Math.max(1, w * .4)) {
        if (/\s/.test(ch)) continue;   // a line never starts on a space
        line = { t: '', cy, h, l: x, r: x + w, fs, a }; lines.push(line);
      }
      line.t += /\s/.test(ch) ? ' ' : ch; line.r = Math.max(line.r, x + w); line.fs = Math.max(line.fs, fs); line.a = Math.min(line.a, a);
    }
  }
  return { lines: lines.map(l => ({ text: l.t.trim(), cx: (l.l + l.r) / 2, cy: l.cy, fs: l.fs, a: l.a })).filter(l => l.text).sort((p, q) => p.cy - q.cy), blocks };
}

// Fits the lines on a dot grid of pitch P device px. kinds[i] is 7 or 5.
function kdTry(L, kinds, P, W, H, s, blocks) {
  const gap = Math.max(1, Math.round(P * .25)), ox = (W % P) / 2, oy = (H % P) / 2;
  const out = [];
  for (let i = 0; i < L.length; i++) {
    const k = kinds[i], wd = kdLineDots(k, L[i].text);
    const gw = wd * P - gap, gh = k * P - gap;
    if (gw > W - P) return null;
    const left = Math.round((L[i].cx * s - gw / 2 - ox) / P) * P + ox;
    const top = Math.round((L[i].cy * s - gh / 2 - oy) / P) * P + oy;
    if (top < 0 || top + gh > H) return null;
    const prev = out[out.length - 1];
    if (prev && top < prev.top + prev.gh + gap + P) return null;   // a clear row of dots between lines
    for (const b of blocks) if (top < b.bot * s + gap && top + gh > b.top * s - gap) return null;
    out.push({ i, k, text: L[i].text, left: Math.max(0, Math.min(W - gw, left)), top, gw, gh });
  }
  return { P, gap, rows: out };
}
// The fallback when the words cannot keep their places: each line wrapped at its spaces
// to the glass's width, the lot stacked a clear row of dots apart (two where the words
// had a wider gap), centred where they were.
function kdFlow(L, kinds, P, W, H, s) {
  const gap = Math.max(1, Math.round(P * .25)), ox = (W % P) / 2, oy = (H % P) / 2, fits = (k, t) => kdLineDots(k, t) * P - gap <= W - P;
  const rows = [];
  for (let i = 0; i < L.length; i++) {
    const k = kinds[i]; let cur = '';
    for (const w of L[i].text.split(' ')) {
      if (!fits(k, w)) return null;   // a word wider than the glass
      const t = cur ? cur + ' ' + w : w;
      if (fits(k, t)) cur = t; else { rows.push({ i, k, text: cur }); cur = w; }
    }
    if (cur) rows.push({ i, k, text: cur });
  }
  if (!rows.length) return null;
  const steps = L.slice(1).map((l, j) => l.cy - L[j].cy), tight = steps.length ? Math.min(...steps) : 0;
  let y = 0; const laid = rows.map((r, j) => {
    if (j) { const prev = rows[j - 1]; y += (prev.k + 1) * P + (prev.i !== r.i && L[r.i].cy - L[prev.i].cy > tight * 1.3 ? P : 0); }
    return { ...r, y };
  });
  const last = laid[laid.length - 1], total = last.y + last.k * P - gap;
  if (total > H) return null;
  const mid = (L[0].cy + L[L.length - 1].cy) / 2 * s;
  const top0 = Math.max(0, Math.min(H - total, Math.round((mid - total / 2 - oy) / P) * P + oy));
  return { P, gap, rows: laid.map(r => { const gw = kdLineDots(r.k, r.text) * P - gap, gh = r.k * P - gap;
    const left = Math.round((L[r.i].cx * s - gw / 2 - ox) / P) * P + ox;
    return { i: r.i, k: r.k, text: r.text, left: Math.max(0, Math.min(W - gw, left)), top: top0 + r.y, gw, gh }; }) };
}
function kdLayout(L, W, H, s, blocks) {
  if (!L.length) return { P: 0, gap: 0, rows: [] };
  const big = L.map(l => l.fs >= 11.5), designed = big.map(b => b ? 7 : 5), small = L.map(() => 5);
  const want = (k, fs) => fs * (k === 7 ? .105 : .15) * s;
  const Pd = Math.max(3, Math.round(Math.max(...L.map((l, i) => want(designed[i], l.fs)))));
  const Ps = Math.max(3, Math.round(Math.max(...L.map(l => want(5, l.fs)))));
  // Visible gaps need a pitch of 3 device px or more. The words in their places first (the
  // designed fonts, then all small print), then wrapped and stacked (not where the browser
  // draws an icon), then a 2 px pitch, then whatever it takes (the glass clips the rest).
  for (let P = Pd; P >= 3; P--) { const r = kdTry(L, designed, P, W, H, s, blocks); if (r) return r; }
  for (let P = Ps; P >= 3; P--) { const r = kdTry(L, small, P, W, H, s, blocks); if (r) return r; }
  if (!blocks.length) {
    for (let P = Pd; P >= 3; P--) { const r = kdFlow(L, designed, P, W, H, s); if (r) return r; }
    for (let P = Ps; P >= 3; P--) { const r = kdFlow(L, small, P, W, H, s); if (r) return r; }
  }
  return kdTry(L, designed, 2, W, H, s, blocks) || kdTry(L, small, 2, W, H, s, blocks)
      || (!blocks.length && kdFlow(L, small, 2, W, H, s))
      || kdTry(L, small, 2, W, 1e6, s, []) || { P: 0, gap: 0, rows: [] };
}

// One glyph per character: its dots in device px and a key that says what and where it is.
function kdGlyphs(L, lay) {
  const out = [];
  lay.rows.forEach(row => {
    const l = L[row.i]; let x = row.left;
    for (const ch of row.text) {
      const g = ch === ' ' ? null : kdGlyph(row.k, ch);
      if (g) {
        const dots = [];
        g.rows.forEach((r, ry) => r.forEach((on, rx) => { if (on) dots.push([x + rx * lay.P, row.top + ry * lay.P]); }));
        out.push({ id: `${ch}@${x},${row.top},${lay.P}`, dots, a: l.a });
      }
      x += ((g ? g.w : (row.k === 7 ? 3 : 2)) + 1) * lay.P;
    }
  });
  return out;
}

function kdState(el) {
  let st = _kd.get(el);
  if (st) return st;
  const c = document.createElement('canvas'); c.className = 'kd-c'; c.setAttribute('aria-hidden', 'true');
  st = { el, c, x: c.getContext('2d'), glyphs: new Map(), dots: [], P: 0, gap: 1, sig: '', anim: false, W: 0, H: 0, s: 1 };
  _kd.set(el, st);
  st.mo = new MutationObserver(() => kdQueue(el));
  st.mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'disabled'] });
  return st;
}
function kdQueue(el, instant) {
  _kdDirty.set(el, (_kdDirty.get(el) || false) || !!instant);
  if (!_kdQueued) { _kdQueued = true; requestAnimationFrame(kdFlush); }
}
function kdFlush() { _kdQueued = false; const d = [..._kdDirty]; _kdDirty.clear(); d.forEach(([el, inst]) => kdSync(el, inst)); }

// Reads the key and brings the canvas to it: new glyphs fall in, gone ones fall out.
function kdSync(el, instant) {
  if (!kdOn() || !el.isConnected) return;
  const st = kdState(el);
  if (st.c.parentElement !== el) el.appendChild(st.c);
  // A screen that saved the key's markup (to put it back later) saved a copy of the canvas too.
  el.querySelectorAll('canvas.kd-c').forEach(c => { if (c !== st.c) c.remove(); });
  const kr = el.getBoundingClientRect();
  if (!kr.width || !el.offsetWidth) return;
  const z = kr.width / el.offsetWidth, dpr = window.devicePixelRatio || 1, s = z * dpr;
  const inset = parseFloat(getComputedStyle(el).getPropertyValue('--kr')) || 5;
  const wCss = Math.max(1, el.offsetWidth - 2 * inset), hCss = Math.max(1, el.offsetHeight - 2 * inset);
  const W = Math.max(1, Math.round(wCss * s)), H = Math.max(1, Math.round(hCss * s));
  const sized = st.W !== W || st.H !== H || st.s !== s;
  if (sized) { st.c.width = W; st.c.height = H; st.c.style.width = wCss + 'px'; st.c.style.height = hCss + 'px'; st.W = W; st.H = H; st.s = s; instant = true; }
  const read = kdRead(el, z);
  const L = read.lines.map(l => ({ ...l, cx: l.cx - inset, cy: l.cy - inset }));
  const blocks = read.blocks.map(b => ({ top: b.top - inset, bot: b.bot - inset }));
  const sig = JSON.stringify([L, blocks, W, H]);
  if (sig === st.sig && !sized) return;
  st.sig = sig;
  const lay = kdLayout(L, W, H, s, blocks);
  const next = new Map(kdGlyphs(L, lay).map(g => [g.id, g]));
  st.P = lay.P; st.gap = lay.gap;
  const ph = getComputedStyle(el).getPropertyValue('--kc-ph').trim() || '255,214,92';
  st.ink = `rgb(${ph})`;
  const now = performance.now(), reduce = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (typeof skipOn === 'function' && skipOn('transitions'));
  if (instant || reduce || !st.glyphs.size) {
    st.glyphs = next; st.dots = [];
    next.forEach(g => g.dots.forEach(([x, y]) => st.dots.push({ x, y, g: g.id, a: g.a, st: 'rest' })));
    kdDraw(st); return;
  }
  let fell = false;
  // gone: every dot of a glyph that is not in the new set lets go (from wherever it is);
  // one still waiting above the glass to fall in just never comes
  st.dots.forEach(d => { if (d.st === 'out' || next.has(d.g)) return;
    if (d.st === 'in' && now < d.t0) { d.dead = true; return; }
    Object.assign(d, { st: 'out', y0: kdDotY(d, now), t0: now + fxRandom() * KD_OUT_SPREAD }); fell = true; });
  st.dots = st.dots.filter(d => !d.dead);
  // kept: a glyph in both takes its new alpha
  next.forEach((g, id) => { if (st.glyphs.has(id)) st.dots.forEach(d => { if (d.g === id) d.a = g.a; }); });
  // new: falls in, KD_IN_DELAY after the old word let go
  const t1 = now + (fell ? KD_IN_DELAY : 0);
  next.forEach((g, id) => { if (st.glyphs.has(id)) return;
    g.dots.forEach(([x, y]) => st.dots.push({ x, y, g: id, a: g.a, st: 'in', y0: -st.P * (1 + Math.floor(fxRandom() * 3)), t0: t1 + fxRandom() * KD_IN_SPREAD })); });
  st.glyphs = next;
  st.anim = true; kdTick();
}
// Where a dot is drawn now (device px), stepped to whole dots so the fall reads as pixels.
function kdDotY(d, now) {
  if (d.st === 'rest') return d.y;
  const t = Math.max(0, now - d.t0) / 1000, g = KD_G * (_kdS || 1);
  const dy = .5 * g * t * t;
  if (d.st === 'in') { const y = d.y0 + dy; return y >= d.y ? d.y : d.y - Math.ceil((d.y - y) / (d._P || 1)) * (d._P || 1); }
  return d.y0 + Math.floor(dy / (d._P || 1)) * (d._P || 1);
}
function kdTick() { if (!_kdRaf) _kdRaf = requestAnimationFrame(kdFrame); }
function kdFrame(now) {
  _kdRaf = 0; let more = false;
  _kd.forEach(st => {
    if (!st.anim) return;
    _kdS = st.s;
    let live = false;
    st.dots.forEach(d => {
      d._P = st.P;
      if (d.st === 'in' && now >= d.t0 && kdDotY(d, now) >= d.y) d.st = 'rest';
      if (d.st === 'out' && now >= d.t0 && kdDotY(d, now) > st.H) d.dead = true;
      if (d.st !== 'rest' && !d.dead) live = true;
    });
    st.dots = st.dots.filter(d => !d.dead);
    kdDraw(st, now);
    st.anim = live; if (live) more = true;
  });
  if (more) kdTick();
}
// A dot: the key's colour with a shaded lower-right edge, in a dark outline.
const KD_LOOK = { ring: .55, hot: .35 };   // the outline's darkness; how far the dot is mixed toward white
function kdDraw(st, now) {
  const x = st.x, P = st.P, gap = st.gap, D = P - gap;
  x.clearRect(0, 0, st.W, st.H);
  if (!P) return;
  _kdS = st.s; now = now || performance.now();
  const shade = D >= 4, ring = gap >= 1;
  for (const d of st.dots) {
    if (d.st === 'in' && now < d.t0) continue;   // not set off yet
    d._P = P;
    const y = kdDotY(d, now);
    if (y + D < 0 || y > st.H) continue;
    x.globalAlpha = d.a;
    if (ring) { x.fillStyle = `rgba(0,0,0,${KD_LOOK.ring})`; x.fillRect(d.x - 1, y - 1, D + 2, D + 2); }
    x.fillStyle = st.ink; x.fillRect(d.x, y, D, D);
    if (KD_LOOK.hot) { x.fillStyle = `rgba(255,255,255,${KD_LOOK.hot})`; x.fillRect(d.x, y, D, D); }
    if (shade) { x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(d.x, y + D - 1, D, 1); x.fillRect(d.x + D - 1, y, 1, D - 1); }
  }
  x.globalAlpha = 1;
}

function kdApply() {
  const on = kdOn();
  document.documentElement.classList.toggle('kd-on', on);
  _kd.forEach(st => { if (!on && st.c.parentElement) st.c.remove(); });
  if (!on) kdSweep();
  if (on) kdScan(true);
}
// r672: with the dots off, a copy of a canvas that a screen's stored key markup put
// back (the pick, the shop, the reward grid save and restore innerHTML) is a static
// child the size of the key, and it pushed the key's words out of the box. kdSync
// removes copies while the dots are on; this is the sweep for when they are off.
function kdSweep() {
  document.querySelectorAll('canvas.kd-c').forEach(c => { const st = _kd.get(c.parentElement); if (!st || st.c !== c || !kdOn()) c.remove(); });
}
// Keys come and go (the shop's LEAVE): any key without a canvas gets one.
function kdScan(instant) {
  if (!kdOn()) { kdSweep(); return; }
  KD_KEYS.forEach(id => { const el = document.getElementById(id); if (el && (!_kd.has(el) || _kd.get(el).c.parentElement !== el)) kdSync(el, true);
    else if (el && instant) kdQueue(el, true); });
  _kd.forEach((st, el) => { if (!el.isConnected) { st.mo.disconnect(); _kd.delete(el); } });
}
window.addEventListener('resize', () => { _kd.forEach((st, el) => kdQueue(el, true)); setTimeout(() => _kd.forEach((st, el) => kdQueue(el, true)), 400); });
setInterval(() => { kdScan(false); _kd.forEach((st, el) => kdQueue(el)); }, 600);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => kdScan(true));
if (document.body) kdApply(); else document.addEventListener('DOMContentLoaded', kdApply);
