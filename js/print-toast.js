// ══ PRINTER NOTICES (r432, reworked r435) ═══════════════════════════════════
// The top-of-screen notices print on black tractor-feed paper that comes down
// from the top edge of the game screen. Notices that arrive together share ONE
// slip. Each line is printed out of sight (the print sound) and then fed down
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
  groupMs: 160,        // notices this close together share a slip
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
};

let printToastsOn = true;          // Settings > Display > Printer notices
let _ptLayer = null, _ptSlip = null, _ptPinned = [];

// The layer is laid over the game screen in raw viewport px and clips to it, so
// the paper appears from the screen's top edge and falls out of its bottom. It is
// a body child for the usual reason: #cabinet's zoom would scale a fixed child.
function ptLayer() {
  if (!_ptLayer || !_ptLayer.isConnected) {
    _ptLayer = document.createElement('div');
    _ptLayer.id = 'pt-layer';
    document.body.appendChild(_ptLayer);
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
  // Join the slip if it opened a moment ago, otherwise pull it back now.
  if (s && (now - s.opened > PT_CFG.groupMs || s.lines.length >= PT_CFG.maxLines)) ptPull(s);
  if (!_ptSlip) _ptSlip = ptNewSlip(layer, now);
  const slip = _ptSlip;
  const line = { text: String(text), icon: o.icon || '', ink: ptLineInk(color), el: null, n: 1 };
  slip.lines.push(line); slip.queue.push(line);
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
                 opened: now, busy: false, done: false, timers: [], width: 0, pinned: false };
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
  return PT_CFG.holdPerLine * (1 + PT_CFG.longScale * Math.max(0, n / PT_CFG.avgChars - 1));
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
