// ══ PRINTER NOTICES (r432, reworked r435) ═══════════════════════════════════
// The top-of-screen notices print on black tractor-feed paper that comes down
// from the top edge of the game screen. Notices that arrive together share ONE
// slip: each notice within PT_CFG.groupMs of the one before adds a line to it.
// Each line is printed out of sight (the print sound) and then fed down
// already written (the feed sound). A finished slip hangs PT_CFG.holdPerLine a
// line (longer lines longer, see ptLineHold) and is then pulled back up into the
// top. A notice that arrives while a slip is still up finishes that slip at once
// and pulls it back. Tapping a slip pulls it back; its pin keeps it up (r510):
// pinned slips stack at the top and new slips hang below them.
//
// showMessage (js/round-timers.js) hands every notice here while the setting is
// on, so no call site changed. noteMessage is for things the player just did and
// can already see; it prints nothing. The old plate toast is the fallback.

const PT_CFG = {
  groupMs: 500,        // a notice this soon after the last one adds a line to its slip (owner, r596)
  holdPerLine: 2000,   // how long a finished slip hangs, per line of average length
  avgChars: 26,        // an average notice (measured over every showMessage text)
  longScale: 0.5,      // a line N% longer than average hangs N * longScale % longer
  maxLines: 6,         // a slip with this many lines is pulled back and a new one starts
  width: 340,          // px; every slip is this wide, a long notice wraps
  charMs: 9,           // print time per character, out of sight above the screen...
  lineMinMs: 140,      // ...floored...
  lineMaxMs: 340,      // ...and capped, so a line never takes long
  feedMs: 110,         // the paper's jump down one line, already printed
  pullMs: 280,         // the slip being pulled back up
  fontPx: 21,          // px (VT323 runs small: 21 reads like the old 15px toast)
  paper: '#0d0b09', bar: '#151f17',
  overChangeHold: 1.6, // r627: a line printed while the improvement animation runs hangs this much longer
};

let printToastsOn = true;          // Settings > Display > Printer notices
let _ptLayer = null, _ptSlip = null, _ptPinned = [];
// r627: the recent notices, printed (ink) and quiet (noteMessage, dim), for the drawer.
const PT_HISTORY_MAX = 40;
const ptHistory = [];
function ptHistoryPush(text, ink, quiet) {
  if (!text) return;
  const last = ptHistory[ptHistory.length - 1];
  if (last && last.text === String(text)) { last.n = (last.n || 1) + 1; return; }
  ptHistory.push({ text: String(text), ink: ink || null, quiet: !!quiet, n: 1 });
  if (ptHistory.length > PT_HISTORY_MAX) ptHistory.shift();
}

// The layer is laid over the game screen in raw viewport px and clips to it, so
// the paper appears from the screen's top edge and falls out of its bottom. It is
// a body child for the usual reason: #cabinet's zoom would scale a fixed child.
function ptLayer() {
  if (!_ptLayer || !_ptLayer.isConnected) {
    _ptLayer = document.createElement('div');
    _ptLayer.id = 'pt-layer';
    document.body.appendChild(_ptLayer);
    ptTabBuild(_ptLayer);
  }
  const st = document.getElementById('stage');
  let r = st && st.getBoundingClientRect();
  if (!r || r.width < 50 || r.height < 50) r = { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const s = _ptLayer.style;
  s.left = r.left + 'px'; s.top = r.top + 'px'; s.width = r.width + 'px'; s.height = r.height + 'px';
  _ptLayer.style.setProperty('--fpx', PT_CFG.fontPx + 'px');
  _ptLayer.style.setProperty('--pt-paper', PT_CFG.paper);
  _ptLayer.style.setProperty('--pt-bar', PT_CFG.bar);
  return _ptLayer;
}

// Ink: the notice's own UI colour, which is already bright enough for black paper.
// Not `ptInk`: that name is the score plate's (js/score-dance.js), and this file loads
// later, so a second one replaced it and every plate number took a stray colour (r531).
function ptLineInk(color) { return color || 'var(--cream, #f0e2c0)'; }

function printToast(text, color, opts) {
  const o = opts || {};
  const layer = ptLayer();
  const now = performance.now();
  const s = _ptSlip;

  // The same notice again while its slip hangs: stamp a count rather than a line.
  if (s) {
    const same = s.lines.find(l => l.el && l.text === String(text));
    if (same) {
      same.n = (same.n || 1) + 1;
      const x = same.el.querySelector('.pt-x') || same.el.appendChild(Object.assign(document.createElement('span'), { className: 'pt-x' }));
      x.textContent = 'x' + same.n;
      try { sfxPrintFeed?.(); } catch (e) {}
      if (s.done) ptArmHold(s);
      return same.el;
    }
  }
  // Join the slip if its last notice came a moment ago, otherwise pull it back now.
  if (s && (now - s.last > PT_CFG.groupMs || s.lines.length >= PT_CFG.maxLines)) ptPull(s);
  if (!_ptSlip) _ptSlip = ptNewSlip(layer, now);
  const slip = _ptSlip;
  ptHistoryPush((o.icon ? o.icon + ' ' : '') + text, ptLineInk(color), false);
  if (_ptDrawer) ptDrawerClose();
  const line = { text: String(text), icon: o.icon || '', ink: ptLineInk(color), el: null, n: 1,
                 holdMul: (typeof improveAnimRunning === 'function' && improveAnimRunning()) ? PT_CFG.overChangeHold : 1 };
  slip.lines.push(line); slip.queue.push(line);
  slip.last = now; clearTimeout(slip.hold);
  if (!slip.busy) ptPrintNext(slip);
  return slip.el;
}

function ptNewSlip(layer, now) {
  const el = document.createElement('div');
  el.className = 'pt-slip';
  el.innerHTML = '<div class="pt-paper"><div class="pt-lines"></div></div><button class="pt-pin" title="Pin">\u{1F4CC}</button>';
  el.style.setProperty('--ptw', PT_CFG.width + 'px');
  el.style.top = ptPinBottom() + 'px';
  el.classList.add('pt-empty');                      // nothing shows until the first line is fed
  layer.appendChild(el);
  const slip = { el, paper: el.firstChild, box: el.firstChild.firstChild, lines: [], queue: [],
                 opened: now, last: now, busy: false, done: false, timers: [], width: 0, pinned: false };
  el.addEventListener('pointerdown', e => e.stopPropagation());
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.closest('.pt-pin')) ptSetPinned(slip, !slip.pinned);
    else ptPull(slip);
  });
  return slip;
}

// Pinned slips stack down from the top edge; the live slip hangs below them.
function ptPinBottom() {
  return _ptPinned.reduce((y, p) => y + p.el.offsetHeight, -6);
}
function ptRestack() {
  let y = -6;
  _ptPinned.forEach(p => { p.el.style.top = y + 'px'; y += p.el.offsetHeight; });
  if (_ptSlip) _ptSlip.el.style.top = y + 'px';
}
function ptSetPinned(slip, on) {
  slip.pinned = on;
  slip.el.classList.toggle('pt-pinned', on);
  if (on) {
    clearTimeout(slip.hold);
    if (_ptSlip === slip) { ptFinish(slip); _ptSlip = null; }
    _ptPinned.push(slip);
  } else {
    _ptPinned = _ptPinned.filter(p => p !== slip);
    ptArmHold(slip);
  }
  ptRestack();
}

// A line of average length hangs holdPerLine; a longer one hangs longer by
// longScale of how much longer it is (twice the length: 1.5x the time).
function ptLineHold(line) {
  const n = [...((line.icon ? line.icon + ' ' : '') + line.text)].length;
  return PT_CFG.holdPerLine * (1 + PT_CFG.longScale * Math.max(0, n / PT_CFG.avgChars - 1)) * (line.holdMul || 1);
}

function ptLater(slip, ms, fn) { const t = setTimeout(fn, ms); slip.timers.push(t); return t; }

// Each line is printed out of sight, above the screen (the print sound), and then
// fed down already written (the feed sound, the paper jumping in steps).
function ptPrintNext(slip) {
  const line = slip.queue.shift();
  if (!line) { slip.busy = false; slip.done = true; ptArmHold(slip); return; }
  slip.busy = true; slip.done = false;
  const full = (line.icon ? line.icon + ' ' : '') + line.text;
  const ms = Math.max(PT_CFG.lineMinMs, Math.min(PT_CFG.lineMaxMs, [...full].length * PT_CFG.charMs));
  try { sfxPrintLine?.(ms); } catch (e) {}
  ptLater(slip, ms, () => {
    ptFeedLine(slip, line);
    try { sfxPrintFeed?.(); } catch (e) {}
    ptLater(slip, PT_CFG.feedMs, () => ptPrintNext(slip));
  });
}

function ptFeedLine(slip, line) {
  const el = document.createElement('div');
  el.className = 'pt-line'; el.style.setProperty('--ink', line.ink);
  el.innerHTML = '<span class="pt-t"></span>';
  el.firstChild.textContent = (line.icon ? line.icon + ' ' : '') + line.text;
  line.el = el;
  slip.box.insertBefore(el, slip.box.firstChild);    // the newest line is at the head
  slip.el.classList.remove('pt-empty');
}

function ptArmHold(slip) {
  clearTimeout(slip.hold);
  if (slip.pinned) return;
  slip.hold = setTimeout(() => ptPull(slip),
    slip.lines.reduce((t, l) => t + ptLineHold(l), 0));
}

// Print everything still owed at once: no more sound, no more jerks.
function ptFinish(slip) {
  slip.timers.forEach(clearTimeout); slip.timers = []; clearTimeout(slip.hold);
  slip.lines.forEach(line => { if (!line.el) ptFeedLine(slip, line); });
  slip.queue = []; slip.busy = false; slip.done = true;
}

// Pulled back up into the top of the screen, in jerks like the feed.
function ptPull(slip) {
  if (_ptSlip === slip) _ptSlip = null;
  if (slip.pulled) return;
  slip.pulled = true;
  if (slip.pinned) { _ptPinned = _ptPinned.filter(p => p !== slip); ptRestack(); }
  ptFinish(slip);
  const el = slip.el;
  if (el.classList.contains('pt-empty')) { el.remove(); return; }
  try { sfxPrintFeed?.(); } catch (e) {}
  el.style.setProperty('--pt-pull', PT_CFG.pullMs + 'ms');
  el.classList.add('pt-pulled');
  setTimeout(() => el.remove(), PT_CFG.pullMs + 60);
}

// ── Sounds ──────────────────────────────────────────────────────────────────
// A dot-matrix head is two noises: a hard pin chatter (the needles striking the
// ribbon, high and gritty) over a low rattle (the carriage stepper). The line
// feed is a ratchet and a thump.
function ptVoice(build) {
  let gain = sfxVolume(); if (gain <= 0) return;
  const ctx = getAudioCtx();
  try { build(ctx, gain, ctx.currentTime); } catch (e) {}
}
function ptNoiseBuf(ctx, sec, shape) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * sec)), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  const rnd = typeof fxRandom === 'function' ? fxRandom : Math.random;
  for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * shape(i / ctx.sampleRate, i / n, rnd);
  return b;
}
function ptPlay(ctx, buf, t, gain, type, freq, q, out) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
  s.connect(f).connect(g).connect(out || sfxOut(ctx)); s.start(t);
}

function sfxPrintLine(ms) {
  const sec = Math.max(0.12, (ms || 220) / 1000);
  ptVoice((ctx, v, t) => {
    // pin chatter: gated per character, each gate a burst of ~1.2 kHz strikes
    const charSec = 0.016;
    const chatter = ptNoiseBuf(ctx, sec, (ts, p, rnd) => {
      const inChar = (ts % charSec) / charSec < 0.72 ? 1 : 0.08;
      const pin = Math.sin(2 * Math.PI * 1180 * ts) > 0.2 ? 1 : 0.25;
      return inChar * pin * (p > 0.96 ? (1 - p) * 25 : 1);
    });
    ptPlay(ctx, chatter, t, 0.11 * v, 'bandpass', 2600, 1.1);
    // carriage rattle: a low buzzy grind under it
    const rattle = ptNoiseBuf(ctx, sec, ts => 0.6 + 0.4 * Math.sign(Math.sin(2 * Math.PI * 96 * ts)));
    ptPlay(ctx, rattle, t, 0.07 * v, 'lowpass', 520, 0.9);
  });
}

function sfxPrintFeed() {
  ptVoice((ctx, v, t) => {
    // ratchet: three short clicks, then the platen thump
    const click = ptNoiseBuf(ctx, 0.012, (ts, p) => 1 - p);
    for (let k = 0; k < 3; k++) ptPlay(ctx, click, t + k * 0.022, 0.09 * v, 'bandpass', 3200 - k * 300, 2.2);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(110, t + 0.05); o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    g.gain.setValueAtTime(0.0001, t + 0.05); g.gain.exponentialRampToValueAtTime(0.12 * v, t + 0.056);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(sfxOut(ctx)); o.start(t + 0.05); o.stop(t + 0.16);
  });
}

// ── THE PAPER CORNER AND THE DRAWER (r627, owner) ───────────────────────────
// A folded corner of paper hangs just inside the top edge of the screen. It is
// out of sight until the mouse comes within PT_CFG.tabZone px of the top (a
// touch screen shows it faintly all the time); pointing at it brings it out;
// a click, or dragging it down PT_CFG.tabDrag px, pulls the DRAWER down: one
// long slip of the last PT_CFG.drawerLines notices, newest at the top, printed
// lines in their ink and quiet (noteMessage) lines dim. A click anywhere, the
// corner again, Escape, or a new notice pulls it back up.
PT_CFG.tabZone = 36; PT_CFG.tabDrag = 28; PT_CFG.drawerLines = 14; PT_CFG.drawerWidth = 400;
let _ptTab = null, _ptDrawer = null, _ptTabTouch = false;
function ptTabBuild(layer) {
  if (_ptTab) return;
  _ptTab = document.createElement('div');
  _ptTab.id = 'pt-tab'; _ptTab.title = 'Recent notices';
  _ptTab.innerHTML = '<div class="pt-tab-paper"></div>';
  layer.appendChild(_ptTab);
  _ptTabTouch = !!(window.matchMedia && matchMedia('(hover: none)').matches);
  _ptTab.classList.toggle('pt-tab-touch', _ptTabTouch);
  // near the top edge: peek
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !_ptLayer) return;
    const top = parseFloat(_ptLayer.style.top) || 0;
    const near = e.clientY - top < PT_CFG.tabZone && e.clientY >= top - 2;
    _ptTab.classList.toggle('pt-tab-peek', near || !!_ptDrawer);
  }, { passive: true });
  // a click toggles; a drag down opens
  let drag = null;
  _ptTab.addEventListener('pointerdown', e => { e.stopPropagation(); drag = { y: e.clientY, opened: false }; _ptTab.setPointerCapture?.(e.pointerId); });
  _ptTab.addEventListener('pointermove', e => {
    if (!drag || drag.opened) return;
    const d = e.clientY - drag.y;
    _ptTab.style.setProperty('--pt-tab-pull', Math.max(0, Math.min(PT_CFG.tabDrag, d)) + 'px');
    if (d > PT_CFG.tabDrag && !_ptDrawer) { drag.opened = true; ptDrawerOpen(); }
  });
  const up = e => {
    if (!drag) return;
    const was = drag; drag = null; _ptTab.style.removeProperty('--pt-tab-pull');
    if (!was.opened) { _ptDrawer ? ptDrawerClose() : ptDrawerOpen(); }
  };
  _ptTab.addEventListener('pointerup', up); _ptTab.addEventListener('pointercancel', up);
  _ptTab.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('pointerdown', e => { if (_ptDrawer && !e.target.closest('#pt-drawer, #pt-tab')) ptDrawerClose(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _ptDrawer) ptDrawerClose(); });
}
function ptDrawerOpen() {
  if (_ptDrawer) return;
  const layer = ptLayer();
  if (_ptSlip) ptPull(_ptSlip);
  const el = document.createElement('div');
  el.id = 'pt-drawer'; el.className = 'pt-slip pt-drawer';
  el.style.setProperty('--ptw', PT_CFG.drawerWidth + 'px');
  el.style.top = ptPinBottom() + 'px';
  const rows = ptHistory.slice(-PT_CFG.drawerLines).reverse();
  const lines = rows.length
    ? rows.map(h => `<div class="pt-line${h.quiet ? ' pt-quiet' : ''}" style="--ink:${h.ink || 'var(--cream, #f0e2c0)'}"><span class="pt-t"></span>${h.n > 1 ? `<span class="pt-x">x${h.n}</span>` : ''}</div>`).join('')
    : '<div class="pt-line pt-quiet"><span class="pt-t">no notices yet</span></div>';
  el.innerHTML = `<div class="pt-paper"><div class="pt-lines"><div class="pt-line pt-head"><span class="pt-t">RECENT NOTICES</span></div>${lines}</div></div>`;
  // the texts go in as text, never as markup
  const ts = el.querySelectorAll('.pt-line:not(.pt-head) .pt-t');
  rows.forEach((h, i) => { if (ts[i]) ts[i].textContent = h.text; });
  el.addEventListener('pointerdown', e => e.stopPropagation());
  el.addEventListener('click', e => { e.stopPropagation(); ptDrawerClose(); });
  layer.appendChild(el);
  _ptDrawer = el;
  _ptTab.classList.add('pt-tab-open', 'pt-tab-peek');
  try { sfxPrintFeed?.(); } catch (e) {}
}
function ptDrawerClose() {
  const el = _ptDrawer; if (!el) return;
  _ptDrawer = null;
  _ptTab.classList.remove('pt-tab-open');
  try { sfxPrintFeed?.(); } catch (e) {}
  el.style.setProperty('--pt-pull', PT_CFG.pullMs + 'ms');
  el.classList.add('pt-pulled');
  setTimeout(() => el.remove(), PT_CFG.pullMs + 60);
}
// The layer (and its paper corner) exist from the start, not from the first
// notice, and follow the stage when the window changes.
addEventListener('load', () => { try { ptLayer(); } catch (e) {} });
addEventListener('resize', () => { if (_ptLayer) { try { ptLayer(); } catch (e) {} } });
