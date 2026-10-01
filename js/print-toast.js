// ══ PRINTER NOTICES (r432) ═══════════════════════════════════════════════════
// Owner: the top-of-screen notices are printed on tractor-feed paper. Notices
// that arrive together print on ONE slip, line by line, fast and jerky, with a
// dot-matrix sound. A slip hangs for PT_CFG.holdPerLine a line, then tears off
// (a tear sound) and falls, swinging side to side like real paper. A notice that
// arrives while a slip is still up finishes that slip at once, tears it off and
// starts a new one. There is no printer drawn: the paper comes down from the top
// edge of the game screen.
//
// showMessage (js/round-timers.js) hands every notice here while the setting is
// on, so no call site changed. The old plate toast is the fallback.
//
// THE FALL is a cheap phenomenological model of "flutter", the regime a sheet of
// paper falls in: it swings side to side like a pendulum, tilts its leading edge
// down into the direction it is moving, drops fastest through the middle of a
// swing and almost stalls at each end, turning edge-on to the viewer as it does.
// One transform per slip per frame, so it runs on the compositor.

const PT_CFG = {
  groupMs: 160,        // notices this close together share a slip
  holdPerLine: 2000,   // how long a finished slip hangs, per line
  maxLines: 6,         // a slip with this many lines tears and a new one starts
  charMs: 9,           // print time per character...
  lineMinMs: 140,      // ...floored...
  lineMaxMs: 340,      // ...and capped, so a line never takes long
  chunk: 3,            // characters struck per jerk of the head
  feedMs: 110,         // the paper's jump down one line
  fontPx: 13,          // design px; scaled by the stage zoom
  ink: 80,             // % of the game colour in the ink (the rest is near-black)
  paper: '#f2ead8', bar: '#dfe9d6',
  swingPeriod: 1.15,   // seconds per full swing, +-20% per slip
  swingAmp: 0.45,      // side to side, as a share of the slip's width
  tilt: 24,            // degrees the leading edge dips
  turn: 38,            // degrees it turns edge-on at the end of a swing
  fallSlow: 14,        // design px/s at the ends of a swing
  fallFast: 190,       // design px/s through the middle
  fallLife: 3.6,       // seconds before a falling slip is removed
};

let printToastsOn = true;          // Settings > Display > Printer notices
let _ptLayer = null, _ptSlip = null, _ptFalling = [], _ptRaf = 0;

function ptZoom() {
  const st = document.getElementById('stage');
  if (!st || !st.offsetWidth) return 1;
  const w = st.getBoundingClientRect().width;
  return w > 50 ? w / st.offsetWidth : 1;
}

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
  _ptLayer.style.setProperty('--z', ptZoom());
  _ptLayer.style.setProperty('--fpx', PT_CFG.fontPx + 'px');
  _ptLayer.style.setProperty('--pt-paper', PT_CFG.paper);
  _ptLayer.style.setProperty('--pt-bar', PT_CFG.bar);
  return _ptLayer;
}

// Ink on paper: a light game colour cannot be read on cream, so the lighter the
// colour, the more of it is swapped for near-black.
let _ptProbe = null;
function ptInk(color) {
  if (!color) return '#2a2118';
  try {
    _ptProbe = _ptProbe || Object.assign(document.createElement('i'), { hidden: true });
    if (!_ptProbe.isConnected) document.body.appendChild(_ptProbe);
    _ptProbe.style.color = ''; _ptProbe.style.color = color;
    const m = getComputedStyle(_ptProbe).color.match(/[\d.]+/g);
    if (m) {
      const [r, g, b] = m.map(Number), L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (L > 0.78) return '#2a2118';
      const k = L > 0.55 ? Math.round(PT_CFG.ink * 0.7) : PT_CFG.ink;
      return `color-mix(in srgb, ${color} ${k}%, #1b140c)`;
    }
  } catch (e) {}
  return '#2a2118';
}

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
  // Join the slip if it opened a moment ago, otherwise tear it off now.
  if (s && (now - s.opened > PT_CFG.groupMs || s.lines.length >= PT_CFG.maxLines)) { ptFinish(s); ptTear(s); }
  if (!_ptSlip) _ptSlip = ptNewSlip(layer, now);
  const slip = _ptSlip;
  const line = { text: String(text), icon: o.icon || '', ink: ptInk(color), el: null, n: 1 };
  slip.lines.push(line); slip.queue.push(line);
  ptSizeSlip(slip, line);
  if (!slip.busy) ptPrintNext(slip);
  return slip.el;
}

function ptNewSlip(layer, now) {
  const el = document.createElement('div');
  el.className = 'pt-slip';
  el.innerHTML = '<div class="pt-paper"><div class="pt-lines"></div></div>';
  layer.appendChild(el);
  return { el, paper: el.firstChild, box: el.firstChild.firstChild, lines: [], queue: [],
           opened: now, busy: false, done: false, timers: [], width: 0 };
}

// The slip is as wide as its longest line, reserved up front so the paper does
// not grow sideways under the print head.
function ptSizeSlip(slip, line) {
  const m = document.createElement('span');
  m.className = 'pt-measure'; m.textContent = (line.icon ? line.icon + ' ' : '') + line.text + ' x9';
  slip.paper.appendChild(m);
  const w = m.offsetWidth; m.remove();
  if (w > slip.width) { slip.width = w; slip.box.style.minWidth = w + 'px'; }
}

function ptLater(slip, ms, fn) { const t = setTimeout(fn, ms); slip.timers.push(t); return t; }

function ptPrintNext(slip) {
  const line = slip.queue.shift();
  if (!line) { slip.busy = false; slip.done = true; ptArmHold(slip); return; }
  slip.busy = true; slip.done = false;
  const el = document.createElement('div');
  el.className = 'pt-line'; el.style.setProperty('--ink', line.ink);
  el.innerHTML = '<span class="pt-t"></span><span class="pt-head"></span>';
  line.el = el;
  slip.box.insertBefore(el, slip.box.firstChild);    // the newest line is at the head
  try { sfxPrintFeed?.(); } catch (e) {}
  const full = (line.icon ? line.icon + ' ' : '') + line.text;
  const chars = [...full];
  const ms = Math.max(PT_CFG.lineMinMs, Math.min(PT_CFG.lineMaxMs, chars.length * PT_CFG.charMs));
  const steps = Math.max(1, Math.ceil(chars.length / PT_CFG.chunk));
  const t = el.firstChild;
  ptLater(slip, PT_CFG.feedMs, () => {
    try { sfxPrintLine?.(ms); } catch (e) {}
    let i = 0;
    const strike = () => {
      i = Math.min(chars.length, i + PT_CFG.chunk);
      t.textContent = chars.slice(0, i).join('');
      if (i < chars.length) ptLater(slip, ms / steps, strike);
      else { el.classList.add('pt-done'); ptPrintNext(slip); }
    };
    strike();
  });
}

function ptArmHold(slip) {
  clearTimeout(slip.hold);
  slip.hold = setTimeout(() => { if (_ptSlip === slip) { ptTear(slip); } },
    PT_CFG.holdPerLine * slip.lines.length);
}

// Print everything still owed at once: no more sound, no more jerks.
function ptFinish(slip) {
  slip.timers.forEach(clearTimeout); slip.timers = []; clearTimeout(slip.hold);
  slip.box.querySelectorAll('.pt-line').forEach(l => l.classList.add('pt-done'));
  slip.lines.forEach(line => {
    const full = (line.icon ? line.icon + ' ' : '') + line.text;
    if (!line.el) {
      const el = document.createElement('div');
      el.className = 'pt-line pt-done'; el.style.setProperty('--ink', line.ink);
      el.innerHTML = '<span class="pt-t"></span>';
      slip.box.insertBefore(el, slip.box.firstChild); line.el = el;
    }
    line.el.querySelector('.pt-t').textContent = full;
  });
  slip.queue = []; slip.busy = false; slip.done = true;
}

function ptTear(slip) {
  if (_ptSlip === slip) _ptSlip = null;
  ptFinish(slip);
  try { sfxPrintTear?.(); } catch (e) {}
  const el = slip.el, z = ptZoom();
  el.classList.add('pt-torn');
  const reduced = document.body.classList.contains('reduced-motion');
  if (reduced) { el.classList.add('pt-fade'); setTimeout(() => el.remove(), 400); return; }
  const rnd = typeof fxRandom === 'function' ? fxRandom : Math.random;
  const w = el.offsetWidth;
  _ptFalling.push({ el, t: 0, y: 0, vy: 0,
    T: PT_CFG.swingPeriod * (0.8 + rnd() * 0.4),
    A: Math.min(130 * z, Math.max(36 * z, w * PT_CFG.swingAmp)),
    dir: rnd() < 0.5 ? -1 : 1, z, H: _ptLayer ? _ptLayer.offsetHeight : innerHeight });
  while (_ptFalling.length > 8) _ptFalling.shift().el.remove();
  if (!_ptRaf) { _ptLast = performance.now(); _ptRaf = requestAnimationFrame(ptFallTick); }
}

let _ptLast = 0;
function ptFallTick(now) {
  const dt = Math.min(0.05, (now - _ptLast) / 1000); _ptLast = now;
  const c = PT_CFG;
  _ptFalling = _ptFalling.filter(f => {
    f.t += dt;
    const ramp = Math.min(1, f.t / 0.7);              // it drops straight before it starts to swing
    const ph = f.dir * 2 * Math.PI * f.t / f.T;
    const sw = Math.cos(ph), side = Math.sin(ph);
    const vt = (c.fallSlow + (c.fallFast - c.fallSlow) * sw * sw) * f.z;
    f.vy += (vt - f.vy) * Math.min(1, dt * 4);
    f.y += f.vy * dt;
    const x = f.A * ramp * side;
    const tilt = c.tilt * ramp * sw * f.dir;          // leading edge dips into the motion
    const turn = c.turn * ramp * side;                // edge-on at the ends of a swing
    const fade = f.t > c.fallLife - 0.6 ? Math.max(0, (c.fallLife - f.t) / 0.6) : 1;
    f.el.style.transform = `perspective(${700 * f.z}px) translateX(-50%) translate(${x.toFixed(1)}px, ${f.y.toFixed(1)}px) rotate(${tilt.toFixed(2)}deg) rotateY(${turn.toFixed(2)}deg)`;
    f.el.style.opacity = fade;
    if (f.t >= c.fallLife || f.y > f.H + 40) { f.el.remove(); return false; }
    return true;
  });
  _ptRaf = _ptFalling.length ? requestAnimationFrame(ptFallTick) : 0;
}

// ── Sounds ──────────────────────────────────────────────────────────────────
// A dot-matrix head is two noises: a hard pin chatter (the needles striking the
// ribbon, high and gritty) over a low rattle (the carriage stepper). The line
// feed is a ratchet and a thump. A tear is grainy noise that rises and snaps.
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

function sfxPrintTear() {
  ptVoice((ctx, v, t) => {
    // a perforation giving way: grains of noise, denser and louder, then a snap
    const sec = 0.26;
    const rip = ptNoiseBuf(ctx, sec, (ts, p, rnd) => {
      const grain = Math.sin(ts * 900 + Math.sin(ts * 37) * 6) > 0.1 ? 1 : 0.15;
      const env = p < 0.88 ? 0.25 + p * 0.85 : (1 - p) * 9;
      return grain * env * (0.6 + rnd() * 0.4);
    });
    ptPlay(ctx, rip, t, 0.16 * v, 'bandpass', 1900, 0.7);
    ptPlay(ctx, rip, t, 0.06 * v, 'highpass', 4200, 0.7);
    const snap = ptNoiseBuf(ctx, 0.03, (ts, p) => (1 - p) * (1 - p));
    ptPlay(ctx, snap, t + sec * 0.9, 0.14 * v, 'bandpass', 1300, 1.4);
  });
}
