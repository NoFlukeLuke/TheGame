/* Tray Pit (r463): the trays drawn as pits sunk into the cabinet, instead of glowing lines.
   Dev -> Aesthetics -> Tray look. The default look since r464 (the lines are the alternative).

   What makes a hole read as a hole (trompe l'oeil, pixel-art pits, recessed UI):
   - ONE light. Here it comes from the top left, so the walls facing away from it (top, left)
     are in shadow and the walls facing it (bottom, right) are lit. Equal light on all four
     sides is what made the lines read as a flat glow.
   - Walls are TRAPEZOIDS that meet at mitred corners and narrow toward a smaller floor
     (perspective). The viewer looks down from slightly in front, so the far (top) wall shows
     more than the near (bottom) one (`view`).
   - Depth darkens: every step down is dimmer, the floor darkest, and the top lip casts a
     shadow onto the floor.
   - Steps (terraces) give the walls texture, and get NARROWER as they go down (`persp`),
     because equal steps further away look smaller.
   - `light: 'below'` is the other look: the tray's colour glows up from the floor, so the
     deepest steps are the brightest (an infinity mirror read the other way round).

   Each tray gets an SVG painted to its own size (design px, crisp pixel edges, so the stage
   zoom scales it up like pixel art). It is repainted only when the tray resizes or its
   colour changes; nothing animates at rest. The tray reactions (land, leave, trigger) come
   here from js/tray-fx.js while the pit is on. */
// r464: the pit is the default (owner's call), with one glowing 1px ring part way down
// (`ring`, % of the way from the rim to the floor; `ringGlow` its glow, 0 = no ring).
const TRAY_PIT_KEY = 'lethe.trayPit.v2';
const TRAY_PIT_DEFAULT = { on: 1, depth: 16, steps: 4, persp: 80, view: 30, tint: 45, light: 'top', floor: 0, ring: 50, ringGlow: 60 };
let trayPit = (() => {
  const d = Object.assign({}, TRAY_PIT_DEFAULT);
  try {
    let o = localStorage.getItem(TRAY_PIT_KEY);
    if (o == null) {   // one-shot: v1 (r463, pit off by default) carried over without its on/off
      const v1 = JSON.parse(localStorage.getItem('lethe.trayPit.v1') || '{}'); delete v1.on;
      o = JSON.stringify(v1); localStorage.setItem(TRAY_PIT_KEY, o); localStorage.removeItem('lethe.trayPit.v1');
    }
    const sv = JSON.parse(o); for (const k in sv) if (k in d) d[k] = sv[k];
  } catch (e) {}
  return d;
})();
// on: 0 = glowing lines, 1 = pit, 2 = machine panel (charcoal), 3 = machine panel (cream).
// The machine panel is css/skin-machine.css (r471); it uses the pit's three reactions.
function trayPitOn() { return trayPit.on >= 1; }
function trayPitDrawn() { return trayPit.on === 1; }
function trayMachineOn() { return trayPit.on >= 2; }
function trayPitSave() {
  const o = {}; for (const k in trayPit) if (trayPit[k] !== TRAY_PIT_DEFAULT[k]) o[k] = trayPit[k];
  try { if (Object.keys(o).length) localStorage.setItem(TRAY_PIT_KEY, JSON.stringify(o)); else localStorage.removeItem(TRAY_PIT_KEY); } catch (e) {}
}
function trayPitSet(key, val) {
  trayPit[key] = key === 'light' ? String(val) : +val;
  trayPitSave(); trayPitApply();
}
function trayPitPreset(name) {
  Object.assign(trayPit, TRAY_PIT_DEFAULT, TRAY_PIT_PRESETS[name] || {}, { on: 1 });
  trayPitSave(); trayPitApply();
}
// Three starting points for the comparison.
const TRAY_PIT_PRESETS = {
  shadow: {},                                                          // dark pit, light from the top left
  quarry: { depth: 20, steps: 6, persp: 72, view: 35, tint: 35 },       // deeper, more terraces
  glow:   { light: 'below', floor: 40, tint: 70, steps: 5, persp: 78 }, // the colour rises from the floor
};

// The tray colour as [r,g,b]; a canvas normalises any CSS colour string.
let _pitCtx = null;
function trayPitRgb(el) {
  const c = getComputedStyle(el).getPropertyValue('--tray-c').trim() || '#666';
  if (!_pitCtx) _pitCtx = document.createElement('canvas').getContext('2d');
  _pitCtx.fillStyle = '#666'; _pitCtx.fillStyle = c;
  const h = _pitCtx.fillStyle;
  if (h[0] === '#') return [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  return (h.match(/\d+/g) || [102, 102, 102]).slice(0, 3).map(Number);
}

function trayPitSvg(w, h, rgb, f, center) {
  const v = f.view / 100, r = f.persp / 100;
  // The widest wall (top) may not reach into the clear centre (Tray lines -> Clear centre).
  const room = (1 - center / 100) / 2 * Math.min(w, h);
  const D = Math.max(2, Math.min(f.depth, room / (1 + v)));
  const wall = { t: D * (1 + v), b: D * (1 - v), l: D, r: D };
  const N = Math.max(1, Math.min(f.steps, Math.floor(D / 2)));
  const ws = []; for (let k = 0; k < N; k++) ws.push(Math.pow(r, k));
  const sum = ws.reduce((a, b) => a + b, 0), t = [0];
  ws.forEach((x, k) => t.push(t[k] + x / sum));
  const R = k => ({ x0: Math.round(wall.l * t[k]), y0: Math.round(wall.t * t[k]),
                    x1: Math.round(w - wall.r * t[k]), y1: Math.round(h - wall.b * t[k]) });
  // colours: the tray's hue, greyed by `tint`, scaled by how much light a face gets
  const g = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2], tint = f.tint / 100;
  const base = rgb.map(c => g + (c - g) * tint);
  const col = (k, a = 1) => `rgb(${base.map(c => Math.max(0, Math.min(255, Math.round(c * k)))).join(' ')} / ${a})`;
  const below = f.light === 'below';
  const face = below ? { t: 0.42, l: 0.5, r: 0.58, b: 0.66 } : { t: 0.16, l: 0.3, r: 0.55, b: 0.8 };
  const depthK = k => below ? 0.55 + 0.45 * (k + 1) / N : Math.pow(0.78, k);
  const P = pts => pts.map(p => p.join(',')).join(' ');
  let s = '';
  for (let k = 0; k < N; k++) {
    const a = R(k), b = R(k + 1), d = depthK(k);
    s += `<polygon fill="${col(face.t * d)}" points="${P([[a.x0, a.y0], [a.x1, a.y0], [b.x1, b.y0], [b.x0, b.y0]])}"/>`
       + `<polygon fill="${col(face.b * d)}" points="${P([[a.x0, a.y1], [a.x1, a.y1], [b.x1, b.y1], [b.x0, b.y1]])}"/>`
       + `<polygon fill="${col(face.l * d)}" points="${P([[a.x0, a.y0], [b.x0, b.y0], [b.x0, b.y1], [a.x0, a.y1]])}"/>`
       + `<polygon fill="${col(face.r * d)}" points="${P([[a.x1, a.y0], [b.x1, b.y0], [b.x1, b.y1], [a.x1, a.y1]])}"/>`;
    if (k > 0) {   // the step's edge: a lit lip on the lit walls, a shadowed one on the others
      const lit = col(Math.min(1.6, face.b * d * 1.45), 0.9), dark = 'rgb(0 0 0 / .45)';
      s += `<path stroke="${dark}" fill="none" d="M${a.x0 + .5} ${a.y1 - .5}V${a.y0 + .5}H${a.x1 - .5}"/>`
         + `<path stroke="${lit}" fill="none" d="M${a.x1 - .5} ${a.y0 + .5}V${a.y1 - .5}H${a.x0 + .5}"/>`;
    }
  }
  const fl = R(N), fw = fl.x1 - fl.x0, fh = fl.y1 - fl.y0;
  const floorK = below ? 0.35 + 0.65 * f.floor / 100 : 0.06 + 0.25 * f.floor / 100;
  s += `<rect x="${fl.x0}" y="${fl.y0}" width="${fw}" height="${fh}" fill="${col(floorK)}"/>`;
  if (below && f.floor) s += `<rect x="${fl.x0}" y="${fl.y0}" width="${fw}" height="${fh}" fill="url(#pg)"/>`;
  // the top lip's shadow on the floor, and a little from the left wall
  s += `<rect x="${fl.x0}" y="${fl.y0}" width="${fw}" height="${Math.max(2, Math.round(wall.t * 0.7))}" fill="url(#st)"/>`
     + `<rect x="${fl.x0}" y="${fl.y0}" width="${Math.max(2, Math.round(wall.l * 0.6))}" height="${fh}" fill="url(#sl)"/>`
     + `<rect x="${fl.x0 + .5}" y="${fl.y0 + .5}" width="${fw - 1}" height="${fh - 1}" fill="none" stroke="rgb(0 0 0 / .5)"/>`;
  // mitred corners, darkest where the walls fold
  [[0, 0, fl.x0, fl.y0], [w, 0, fl.x1, fl.y0], [0, h, fl.x0, fl.y1], [w, h, fl.x1, fl.y1]]
    .forEach(([x0, y0, x1, y1]) => { s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="rgb(0 0 0 / .4)"/>`; });
  // The ring: one 1px line in the tray's own (full) colour, part way down, over a soft blur of
  // itself so it glows. It follows the walls' perspective, so it is a smaller rectangle than the rim.
  if (f.ringGlow > 0 && f.ring > 0 && f.ring < 100) {
    const tr = f.ring / 100, q = f.ringGlow / 100;
    const rx0 = Math.round(wall.l * tr), ry0 = Math.round(wall.t * tr), rx1 = Math.round(w - wall.r * tr), ry1 = Math.round(h - wall.b * tr);
    const hot = rgb.map(c => Math.round(c + (255 - c) * 0.35)).join(' ');
    const box = `x="${rx0 + .5}" y="${ry0 + .5}" width="${rx1 - rx0 - 1}" height="${ry1 - ry0 - 1}" fill="none"`;
    s += `<rect ${box} stroke="rgb(${rgb.join(' ')} / ${(0.9 * q).toFixed(2)})" stroke-width="3" filter="url(#rg)" shape-rendering="auto"/>`
       + `<rect ${box} stroke="rgb(${hot} / ${(0.55 + 0.45 * q).toFixed(2)})"/>`;
  }
  const defs = `<defs><linearGradient id="st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`
    + `<linearGradient id="sl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`
    + `<radialGradient id="pg"><stop offset="0" stop-color="${col(1.5)}" stop-opacity="${(0.5 * f.floor / 100).toFixed(2)}"/><stop offset="1" stop-color="${col(1)}" stop-opacity="0"/></radialGradient>`
    + `<filter id="rg" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${(0.8 + 1.6 * f.ringGlow / 100).toFixed(2)}"/></filter></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${defs}${s}</svg>`;
}

function trayPitPaint(el) {
  if (!el) return;
  if (!trayPitDrawn()) { el.style.removeProperty('--pit-bg'); el._pitKey = ''; return; }
  const w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  const rgb = trayPitRgb(el), key = [w, h, rgb.join(), JSON.stringify(trayPit), trayFx.center].join('|');
  if (el._pitKey === key) return;
  el._pitKey = key;
  el.style.setProperty('--pit-bg', `url("data:image/svg+xml,${encodeURIComponent(trayPitSvg(w, h, rgb, trayPit, trayFx.center))}")`);
}

// The pit replaces the ring stack and the tray's flat background, on the trays only.
function trayPitApply() {
  const html = document.documentElement;
  html.classList.toggle('tray-pit', trayPitDrawn());
  html.classList.toggle('skin-machine', trayMachineOn());
  html.classList.toggle('mc-cream', trayPit.on === 3);
  let tag = document.getElementById('tray-pit-style');
  if (!tag) { tag = document.createElement('style'); tag.id = 'tray-pit-style'; document.head.appendChild(tag); }
  const sel = TRAY_FX_IDS.map(id => `html.tray-pit #stage #${id}`).join(', ');
  tag.textContent = `${sel} { --tray-set: 0 0 transparent !important; --tray-rings: 0 0 transparent !important;
    background: var(--pit-bg, none) 0 0 / 100% 100% no-repeat, #070604 !important; }`;
  trayFxEach(el => { el._pitKey = ''; trayPitPaint(el); });
  trayPitWatchColour();
  trayPitSync();
}
// A tray whose class changes may change colour (a boss alarm, a view swap): repaint it.
let _pitMo = null;
function trayPitWatchColour() {
  if (_pitMo || typeof MutationObserver === 'undefined') return;
  _pitMo = new MutationObserver(ms => ms.forEach(m => trayPitPaint(m.target)));
  trayFxEach(el => _pitMo.observe(el, { attributes: true, attributeFilter: ['class'] }));
}

// ── The three reactions, pit edition ─────────────────────────────────────────
// Land: the floor takes the impact (a flash of light and a 1px drop). Leave: the pit
// darkens as the entity sinks away. Trigger: a quick, small brightening.
function trayPitKick(el, dir) {
  if (!el.animate) return;
  if (trayMachineOn() && dir === 'in') trayMachineLamp(el, 420);
  el._kickUntil = performance.now() + 480;
  el.animate(dir === 'in'
    ? [{ filter: 'brightness(1.45)', translate: '0 1px' }, { filter: 'brightness(1)', translate: '0 0' }]
    : [{ filter: 'brightness(1)' }, { filter: 'brightness(.7)', offset: .35 }, { filter: 'brightness(1)' }],
    { duration: dir === 'in' ? 420 : 480, easing: 'ease-out' });
}
// Machine panel: the tray's backlit strip lights for `ms`, then fades (css/skin-machine.css).
function trayMachineLamp(el, ms) {
  el.classList.add('mc-lit'); clearTimeout(el._mcLit);
  el._mcLit = setTimeout(() => el.classList.remove('mc-lit'), ms);
}
function trayPitTrigger(el) {
  if (trayMachineOn()) { trayMachineLamp(el, 140); return; }   // the strip is the whole signal
  if (el.animate) el.animate([{ filter: 'brightness(1.14)' }, { filter: 'brightness(1)' }], { duration: 220, easing: 'ease-out' });
}

function trayPitSync() {
  const set = (id, v) => { const e = document.getElementById(id); if (e && document.activeElement !== e) e.value = String(v); };
  set('dev-pit-on', ['lines', 'pit', 'machine', 'machine-cream'][trayPit.on] || 'pit'); set('dev-pit-light', trayPit.light);
  [['depth', 'px'], ['steps', ''], ['persp', '%'], ['view', '%'], ['tint', '%'], ['floor', '%'], ['ring', '%'], ['ringGlow', '%']].forEach(([k, u]) => {
    set('dev-pit-' + k, trayPit[k]);
    const e = document.getElementById('dev-pit-' + k + '-v'); if (e) e.textContent = trayPit[k] + u;
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', trayPitApply);
else trayPitApply();
