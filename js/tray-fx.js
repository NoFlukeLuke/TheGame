/* Tray FX (r441): the infinity lines on every tray.
   Dev -> Aesthetics -> Tray lines. The stack actually painted is generated here
   (trayFxRingString) for the chosen line count, spacing and growth, with the live parts left
   as CSS custom properties: --tray-ph (ambient motion), --tray-hv / --tray-hp (the pointer's
   glow), --tray-tx / --tray-ty (the pointer's tilt), --tray-boost (land/leave flares).
   Motion is a rAF loop that writes those on each tray element (not on :root, so the rest
   of the page is not restyled). */
const TRAY_FX_KEY = 'lethe.trayFx.v2';   // r451: overrides only (v1 stored every field)
const TRAY_FX_DEFAULT = { lines: 3, thick: 2, glow: 10, gain: 1.2, motion: 'ripple', center: 35, fade: 70,
  gap: 2, grow: 5, tilt: 60 };
const TRAY_FX_IDS = ['score-center', 'score-left', 'pips-box', 'mult-box', 'focus-box', 'screen-location',
  'pmf-merged', 'knack-carousel-wrap', 'selected-cards', 'trick-tray-area', 'hand-preview-area',
  'coin-info', 'vclock', 'run-progress'];
let trayFx = (() => {
  const d = Object.assign({}, TRAY_FX_DEFAULT);
  try {
    let o = localStorage.getItem(TRAY_FX_KEY);
    if (o == null) {   // one-shot: carry v1 over, minus its old default fade (50 -> 70)
      const v1 = JSON.parse(localStorage.getItem('lethe.trayFx.v1') || '{}');
      if (v1.fade === 50) delete v1.fade;
      for (const k in v1) if (v1[k] === d[k]) delete v1[k];
      o = JSON.stringify(v1);
      localStorage.setItem(TRAY_FX_KEY, o); localStorage.removeItem('lethe.trayFx.v1');
    }
    return Object.assign(d, JSON.parse(o));
  } catch (e) { return d; } })();
let _trayFxRaf = 0, _trayFxLast = 0, _trayFxEls = null;

function trayFxSave() {
  const o = {}; for (const k in trayFx) if (trayFx[k] !== TRAY_FX_DEFAULT[k]) o[k] = trayFx[k];
  try { if (Object.keys(o).length) localStorage.setItem(TRAY_FX_KEY, JSON.stringify(o)); else localStorage.removeItem(TRAY_FX_KEY); } catch (e) {}
}
function trayFxSet(key, val) {
  trayFx[key] = (key === 'motion') ? String(val) : +val;
  trayFxSave();
  trayFxApply();
}
function trayFxReset() {
  trayFx = Object.assign({}, TRAY_FX_DEFAULT);
  trayFxSave();
  trayFxApply();
}
function trayFxApply() {
  const st = document.documentElement.style, f = trayFx;
  st.setProperty('--tray-lines', f.lines);
  st.setProperty('--tray-t', f.thick);
  st.setProperty('--tray-halo', f.glow);
  st.setProperty('--tray-gain', f.gain);
  st.setProperty('--tray-mode', f.motion === 'pulse' ? 0 : 1);
  st.setProperty('--tray-amp', f.motion === 'off' ? 0 : (f.motion === 'pulse' ? 0.6 : 0.9));
  trayFxTrimRings();
  st.setProperty('--tray-f', (1 - 0.45 * f.fade / 100).toFixed(3));
  trayFxEach(el => el.style.setProperty('--tray-ph', 0));
  trayFxLimitAll();
  cancelAnimationFrame(_trayFxRaf); _trayFxRaf = 0;
  if (f.motion !== 'off') _trayFxRaf = requestAnimationFrame(trayFxTick);
  trayFxWatch();
  trayFxSync();
}

// ── Perf (r449, step 9) ─────────────────────────────────────────────────────
// The stylesheet's ring stack is generated for 20 lines, and every one of its 60
// shadows is painted even at zero alpha. So the stack actually used is rebuilt
// for the chosen line count and injected after it under the same selector: 3
// lines paint 9 shadows instead of 60.
/* Line geometry, in design px (a box-shadow spread's unit; the stage zoom scales it up,
   so a fraction of a design px still lands on its own screen pixels). Line i starts at
   g.s[i]: its colour edge is thick px, a 1px soft edge, then a dark gap of
   gap * (1 + grow%)^i, so every gap is a little wider than the one outside it.
   g.w[i] is how far line i may slide sideways at full tilt: 0.6 of the gaps outside it,
   so a gap on the leaning side narrows to 40% at most and never closes. */
function trayFxGeom(n) {
  const f = trayFx, s = [0], w = [0];
  for (let i = 0; i < n; i++) {
    const gap = f.gap * Math.pow(1 + f.grow / 100, i);
    s.push(s[i] + f.thick + 1 + gap); w.push(w[i] + 0.6 * gap);
  }
  return { s, w };
}
const _tfxPx = v => +v.toFixed(2);
function trayFxRingString(n) {
  // Ambient band: a comet heading inward (sharp front, long tail behind it) so the ripple
  // reads as motion down into the tray. Pulse mode breathes every line by --tray-ph.
  // The pointer adds its own band (--tray-hv at line --tray-hp) on top of either.
  const ph = i => `(1 + var(--tray-amp) * (var(--tray-mode) * max(0, 1 - max((${i} - var(--tray-ph)) / 0.7, (var(--tray-ph) - ${i}) / 1.8)) + (1 - var(--tray-mode)) * var(--tray-ph)) + var(--tray-hv, 0) * max(0, 1 - abs(var(--tray-hp, 0) - ${i}) / 1.5)) * (1 + var(--tray-boost, 0) + 0.3 * var(--tray-hv, 0))`;
  const off = w => w ? `calc(var(--tray-tx, 0) * ${_tfxPx(w)}px) calc(var(--tray-ty, 0) * ${_tfxPx(w)}px)` : '0 0';
  const g = trayFxGeom(n), t = trayFx.thick, out = [];
  for (let i = 0; i < n; i++) {
    // fade = how much dimmer each line is than the one outside it (--tray-f, the depth
    // fade slider); vis = this tray's own cap (--tray-n, from the clear-centre rule).
    // A line and its soft edge slide by w[i]; the dark gap after it slides with the NEXT
    // line, so tilting narrows and widens the gaps and the lines keep their thickness.
    const fade = `pow(var(--tray-f, 0.685), ${i})`, vis = `clamp(0, var(--tray-n, 99) - ${i}, 1)`;
    out.push(`inset ${off(g.w[i])} 0 ${_tfxPx(g.s[i] + t)}px color-mix(in srgb, var(--tray-c) calc(min(100, 70 * ${fade} * var(--tray-gain) * ${ph(i)} * ${vis}) * 1%), transparent)`);
    out.push(`inset ${off(g.w[i])} 0 ${_tfxPx(g.s[i] + t + 1)}px color-mix(in srgb, var(--tray-c) calc(min(100, 23.1 * ${fade} * var(--tray-gain) * ${ph(i)} * ${vis}) * 1%), transparent)`);
    out.push(`inset ${off(g.w[i + 1])} 0 ${_tfxPx(g.s[i + 1])}px rgb(0 0 0 / calc(0.6 * ${fade} * ${vis}))`);
  }
  return out.join(', ');
}
let _trayRingSel = '';
// The selector of the ring rule in css/style.css, for when the stylesheet cannot be
// read (a file:// page blocks cssRules). Keep in step with that rule.
const TRAY_RING_SEL_FALLBACK = '#stage.landscape #score-center, #stage.landscape #score-left, #stage.landscape #selected-cards, #stage.landscape #knack-carousel-wrap, #stage.landscape #trick-tray-area, #stage.landscape #vclock, #stage.landscape #run-progress, #stage.landscape #coin-info, #stage:not(.landscape) #trick-tray-area, #stage:not(.landscape) #hand-preview-area, #stage:not(.landscape) #knack-carousel-wrap, #stage:not(.landscape) #score-center, #stage:not(.landscape) #score-left, #score-subboxes .score-subbox, #score-subboxes #screen-location, #score-subboxes #pmf-merged, .panel-box';
function trayFxTrimRings() {
  if (!_trayRingSel) {   // retried until the stylesheets are in
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      const find = list => { for (const r of list) {
        if (r.style && r.style.getPropertyValue('--tray-rings')) return r.selectorText;
        if (r.cssRules) { const x = find(r.cssRules); if (x) return x; } } return null; };
      const sel = rules && find(rules); if (sel) { _trayRingSel = sel; break; }
    }
  }
  if (!_trayRingSel && document.readyState === 'complete') _trayRingSel = TRAY_RING_SEL_FALLBACK;
  if (!_trayRingSel) { if (!trayFxTrimRings._retry) { trayFxTrimRings._retry = 1; window.addEventListener('load', trayFxTrimRings); } return; }
  let tag = document.getElementById('tray-rings-trim');
  if (!tag) { tag = document.createElement('style'); tag.id = 'tray-rings-trim'; document.head.appendChild(tag); }
  tag.textContent = `${_trayRingSel} { --tray-rings: ${trayFxRingString(Math.max(1, Math.min(20, trayFx.lines | 0)))}; }`;
}

/* Every tray keeps a clear rectangle in its middle (f.center, % of the tray's shorter side):
   the lines may only use the room between the border and that rectangle, so a small tray
   shows fewer lines than a tall one and lines from opposite sides never meet. offsetWidth /
   offsetHeight are design px, the same unit a box-shadow spread is drawn in. */
function trayFxLimit(el) {
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  const room = (1 - trayFx.center / 100) / 2 * Math.min(w, h);
  // a line counts if it still clears the centre with the tunnel leaned fully away from it
  const g = trayFxGeom(trayFx.lines), lean = Math.abs(trayFx.tilt) / 100;
  let n = 0; while (n < trayFx.lines && g.s[n + 1] + lean * g.w[n + 1] <= room) n++;
  el._tfxN = n;
  el.style.setProperty('--tray-n', n);
}
function trayFxLimitAll() { trayFxEach(trayFxLimit); }
let _trayFxRo = null;
function trayFxWatch() {
  if (_trayFxRo || typeof ResizeObserver === 'undefined') return;
  _trayFxRo = new ResizeObserver(es => es.forEach(e => trayFxLimit(e.target)));
  trayFxEach(el => _trayFxRo.observe(el));
}
function trayFxEach(fn) {
  if (!_trayFxEls) _trayFxEls = TRAY_FX_IDS.map(id => document.getElementById(id)).filter(Boolean);
  _trayFxEls.forEach(fn);
}
function trayFxTick(t) {
  _trayFxRaf = requestAnimationFrame(trayFxTick);
  if (t - _trayFxLast < 50) return;           // 20fps is plenty for a slow glow (r449: was 30)
  _trayFxLast = t;
  if (document.body.classList.contains('reduced-motion')) return;
  const pulse = trayFx.motion === 'pulse', breath = 0.5 - 0.5 * Math.cos(t / 1400 * Math.PI);   // 2.8s breath
  const now = performance.now();
  trayFxEach(el => {
    if (el._kickUntil > now || !el.offsetWidth) return;
    // Ripple: one line per 0.7s from the border inward over THIS tray's own lines; as the
    // band leaves the innermost line the next one starts at the border (never back out).
    let ph = breath;
    if (!pulse) { const L = Math.max(1, el._tfxN || 1) + 0.6; ph = ((t / 700) % L) - 0.6; }
    const v = ph.toFixed(2);
    if (el._tfxPh !== v) { el._tfxPh = v; el.style.setProperty('--tray-ph', v); }
  });
}
function trayFxSync() {
  const set = (id, v) => { const e = document.getElementById(id); if (e && document.activeElement !== e) e.value = String(v); };
  set('dev-tfx-lines', trayFx.lines); set('dev-tfx-thick', trayFx.thick); set('dev-tfx-glow', trayFx.glow);
  set('dev-tfx-gain', trayFx.gain); set('dev-tfx-motion', trayFx.motion);
  [['center', '%'], ['fade', '%'], ['gap', 'px'], ['grow', '%'], ['tilt', '']].forEach(([k, u]) => {
    set('dev-tfx-' + k, trayFx[k]);
    const e = document.getElementById('dev-tfx-' + k + '-v'); if (e) e.textContent = trayFx[k] + u;
  });
}
if (document.body) trayFxApply(); else document.addEventListener('DOMContentLoaded', trayFxApply);

// ══ Tray reactions (r447, card-animation step 8) ═════════════════════════════
// Every tray's lines react to what happens in it:
//   - an entity LANDS (a Trick or Knack is gained): it drops into the tray from
//     above, large and blurred, settling into place, and the lines ripple inward
//     with a flare (trayFxKick 'in');
//   - an entity LEAVES (sold, traded, lost): a copy of it sinks into the tray,
//     shrinking and darkening, and the lines pull back outward, dimmed ('out');
//   - the POINTER over a tray: the line nearest it lights up and follows it, and the
//     tunnel leans toward it.
// A kicked tray is skipped by the ambient tick until it is done; the pointer's glow and
// tilt are their own properties, so a hovered tray keeps its ambient motion.
const TRAY_KICK_MS = 560;

function trayFxKick(el, dir) {
  if (!el || document.body.classList.contains('reduced-motion')) return;
  const n = Math.max(1, el._tfxN || trayFx.lines) + 1, t0 = performance.now();
  el._kickUntil = t0 + TRAY_KICK_MS;
  el.style.setProperty('--tray-mode', 1);
  const step = t => {
    const p = Math.min(1, (t - t0) / TRAY_KICK_MS);
    const ph = dir === 'in' ? -0.5 + p * (n + 1) : n + 0.5 - p * (n + 1);
    const boost = dir === 'in' ? 1.4 * (1 - p) * (1 - p) : -0.55 * Math.sin(p * Math.PI);
    el.style.setProperty('--tray-ph', ph.toFixed(3));
    el.style.setProperty('--tray-boost', boost.toFixed(3));
    if (p < 1) requestAnimationFrame(step);
    else { el._kickUntil = 0; el.style.removeProperty('--tray-boost'); el.style.removeProperty('--tray-mode'); }
  };
  requestAnimationFrame(step);
}

// The pointer: the line nearest it lights, and the tunnel leans toward it as if the
// cursor's weight pressed that side down (--tray-tx/-ty, -1..1 x the Cursor tilt slider:
// the gaps on that side close up, the far side's open). Both ease in; on leaving they
// hold for TRAY_HOVER_HOLD_MS, then ease out slowly. One rAF loop runs while any tray is
// still settling and stops when they all are.
const TRAY_HOVER_HOLD_MS = 500;
const _trayHoverSet = new Set();
let _trayHoverRaf = 0, _trayHoverT = 0;
function trayFxHover(el, e) {
  const r = el.getBoundingClientRect(), k = (r.width / (el.offsetWidth || 1)) || 1;
  const d = Math.max(0, Math.min(e.clientX - r.left, r.right - e.clientX, e.clientY - r.top, r.bottom - e.clientY) / k);
  const g = trayFxGeom(Math.max(1, el._tfxN || 1));   // which line the pointer is over, fractional
  let i = 0; while (i < g.s.length - 2 && d >= g.s[i + 1]) i++;
  el._hp = i + Math.min(1, (d - g.s[i]) / Math.max(1, g.s[i + 1] - g.s[i])) - 0.3;
  const lean = trayFx.tilt / 100, cl = v => Math.max(-1, Math.min(1, v));
  el._txT = lean * cl((e.clientX - r.left - r.width / 2) / (r.width / 2));
  el._tyT = lean * cl((e.clientY - r.top - r.height / 2) / (r.height / 2));
  el._hvT = 1; el._leaveAt = 0;
  trayFxHoverWake(el);
}
function trayFxHoverEnd(el) { el._leaveAt = performance.now(); trayFxHoverWake(el); }
function trayFxHoverWake(el) {
  if (document.body.classList.contains('reduced-motion')) return;
  _trayHoverSet.add(el);
  if (!_trayHoverRaf) { _trayHoverT = performance.now(); _trayHoverRaf = requestAnimationFrame(trayFxHoverStep); }
}
function trayFxHoverStep(t) {
  const dt = Math.min(100, t - _trayHoverT); _trayHoverT = t;
  const ease = (v, to, tau) => v + (to - v) * (1 - Math.exp(-dt / tau));
  _trayHoverSet.forEach(el => {
    const out = el._leaveAt && t - el._leaveAt > TRAY_HOVER_HOLD_MS;
    if (out) { el._hvT = 0; el._txT = 0; el._tyT = 0; }
    const held = el._leaveAt && !out;
    if (!held) {
      // in: glow 0.1s, lean 0.4s. out: glow ~1.5s, lean ~2s to settle.
      el._hv = ease(el._hv || 0, el._hvT, out ? 450 : 100);
      el._tx = ease(el._tx || 0, el._txT, out ? 650 : 400);
      el._ty = ease(el._ty || 0, el._tyT, out ? 650 : 400);
    }
    const done = out && el._hv < 0.01 && Math.abs(el._tx) < 0.005 && Math.abs(el._ty) < 0.005;
    if (done) {
      ['--tray-hv', '--tray-hp', '--tray-tx', '--tray-ty'].forEach(p => el.style.removeProperty(p));
      el._hv = el._tx = el._ty = 0; el._leaveAt = 0; _trayHoverSet.delete(el); return;
    }
    el.style.setProperty('--tray-hv', el._hv.toFixed(3));
    el.style.setProperty('--tray-hp', (el._hp || 0).toFixed(2));
    el.style.setProperty('--tray-tx', el._tx.toFixed(3));
    el.style.setProperty('--tray-ty', el._ty.toFixed(3));
  });
  _trayHoverRaf = _trayHoverSet.size ? requestAnimationFrame(trayFxHoverStep) : 0;
}
function trayFxBindHover() {
  trayFxEach(el => {
    if (el._tfxBound) return; el._tfxBound = true;
    el.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') trayFxHover(el, e); });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') trayFxHoverEnd(el); });
  });
}

// An entity dropping into its tray: large and soft above it, settling into place.
function trayEntityLand(chip) {
  if (!chip || !chip.animate || document.body.classList.contains('reduced-motion')) return;
  chip.animate([
    { scale: '1.8', translate: '0 -45%', opacity: 0, filter: 'blur(3px) brightness(1.7)' },
    { scale: '.88', translate: '0 4%', opacity: 1, filter: 'blur(0px) brightness(1.25)', offset: .62 },
    { scale: '1.04', translate: '0 0', opacity: 1, filter: 'blur(0px) brightness(1.05)', offset: .82 },
    { scale: '1', translate: '0 0', opacity: 1, filter: 'none' }], { duration: 520, easing: 'cubic-bezier(.3,.6,.35,1)' });
}
// An entity leaving: a copy sinks into the tray where it was, shrinking and darkening.
function trayEntitySink(rect, html, cls, zoom) {
  if (!rect || !rect.width || document.body.classList.contains('reduced-motion')) return;
  const c = document.createElement('div');
  c.className = cls; c.innerHTML = html;
  c.style.cssText = `position:fixed;left:${rect.left / zoom}px;top:${rect.top / zoom}px;width:${rect.width / zoom}px;height:${rect.height / zoom}px;zoom:${zoom};margin:0;z-index:400;pointer-events:none;`;
  document.body.appendChild(c);
  const a = c.animate([
    { scale: '1', opacity: 1, filter: 'brightness(1)', translate: '0 0' },
    { scale: '1.08', opacity: 1, filter: 'brightness(1.2)', translate: '0 -4%', offset: .18 },
    { scale: '.3', opacity: 0, filter: 'brightness(.15) blur(1px)', translate: '0 10%' }], { duration: 480, easing: 'cubic-bezier(.5,0,.8,.5)', fill: 'forwards' });
  a.onfinish = () => c.remove(); setTimeout(() => c.remove(), 700);
}

// Wrap a tray's renderer: diff the owned ids across the render.
function trayWatch(fnName, listSel, itemSel, idKey, trayId, owned) {
  const orig = window[fnName]; if (typeof orig !== 'function' || orig._tfxWrapped) return;
  let prev = null;
  const wrapped = function () {
    const list = document.querySelector(listSel);
    const before = new Map();
    // rects are read BEFORE the render, which detaches these chips
    if (list) list.querySelectorAll(itemSel).forEach(ch => { const id = ch.dataset[idKey]; if (!before.has(id)) before.set(id, { r: ch.getBoundingClientRect(), w: ch.offsetWidth, html: ch.innerHTML, cls: ch.className }); });
    const out = orig.apply(this, arguments);
    const now = new Set(owned().map(x => x.id));
    if (prev) {
      const tray = document.getElementById(trayId);
      const added = [...now].filter(id => !prev.has(id)), gone = [...prev].filter(id => !now.has(id));
      added.forEach(id => { const ch = list && list.querySelector(`${itemSel}[data-${idKey.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}="${id}"]`); trayEntityLand(ch); });
      gone.forEach(id => { const b = before.get(id); if (!b) return;
        trayEntitySink(b.r, b.html, b.cls, (b.r.width / (b.w || 1)) || 1); });
      if (added.length) trayFxKick(tray, 'in'); else if (gone.length) trayFxKick(tray, 'out');
    }
    prev = now;
    return out;
  };
  wrapped._tfxWrapped = true;
  window[fnName] = wrapped;
}
function trayFxInstallReactions() {
  trayFxBindHover();
  trayWatch('renderTrickTray', '#trick-tray-list', '.trick-tray-chip', 'trickId', 'trick-tray-area',
    () => (typeof trickTray !== 'undefined' ? trickTray : []));
  trayWatch('updateKnackList', '#knack-list', '.knack-chip', 'knackId', 'knack-carousel-wrap',
    () => (typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', trayFxInstallReactions);
else trayFxInstallReactions();
