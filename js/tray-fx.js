/* Tray FX (r441): the infinity lines on every tray.
   Dev -> Aesthetics -> Tray lines. All five knobs are CSS custom properties on :root
   (see the --tray-rings stack in css/style.css), so every tray changes together.
   Motion is a rAF loop that writes --tray-ph on each tray element (not on :root, so the
   rest of the page is not restyled): Pulse breathes all lines together, Ripple sends a
   bright band inward through them. */
const TRAY_FX_KEY = 'lethe.trayFx.v1';
const TRAY_FX_DEFAULT = { lines: 3, thick: 2, glow: 10, gain: 1.2, motion: 'ripple', center: 35, fade: 50 };
const TRAY_FX_IDS = ['score-center', 'score-left', 'pips-box', 'mult-box', 'focus-box', 'screen-location',
  'pmf-merged', 'knack-carousel-wrap', 'selected-cards', 'trick-tray-area', 'hand-preview-area',
  'coin-info', 'vclock', 'run-progress'];
let trayFx = (() => { try { return Object.assign({}, TRAY_FX_DEFAULT, JSON.parse(localStorage.getItem(TRAY_FX_KEY) || '{}')); }
  catch (e) { return Object.assign({}, TRAY_FX_DEFAULT); } })();
let _trayFxRaf = 0, _trayFxLast = 0, _trayFxEls = null;

function trayFxSet(key, val) {
  trayFx[key] = (key === 'motion') ? String(val) : +val;
  try { localStorage.setItem(TRAY_FX_KEY, JSON.stringify(trayFx)); } catch (e) {}
  trayFxApply();
}
function trayFxReset() {
  trayFx = Object.assign({}, TRAY_FX_DEFAULT);
  try { localStorage.removeItem(TRAY_FX_KEY); } catch (e) {}
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
function trayFxRingString(n) {
  const ph = i => `(1 + var(--tray-amp) * (var(--tray-mode) * max(0, 1 - abs(var(--tray-ph) - ${i}) / 1.5) + (1 - var(--tray-mode)) * var(--tray-ph))) * (1 + var(--tray-boost, 0))`;
  const out = [];
  for (let i = 0; i < n; i++) {
    // fade = how much dimmer each line is than the one outside it (--tray-f, the depth
    // fade slider); vis = this tray's own cap (--tray-n, from the clear-centre rule).
    const fade = `pow(var(--tray-f, 0.775), ${i})`, vis = `clamp(0, var(--tray-n, 99) - ${i}, 1)`;
    out.push(`inset 0 0 0 calc(var(--tp) * ${i} + var(--tray-t) * 1px) color-mix(in srgb, var(--tray-c) calc(min(100, 70 * ${fade} * var(--tray-gain) * ${ph(i)} * ${vis}) * 1%), transparent)`);
    out.push(`inset 0 0 0 calc(var(--tp) * ${i} + (var(--tray-t) + 1) * 1px) color-mix(in srgb, var(--tray-c) calc(min(100, 23.1 * ${fade} * var(--tray-gain) * ${ph(i)} * ${vis}) * 1%), transparent)`);
    out.push(`inset 0 0 0 calc(var(--tp) * ${i + 1}) rgb(0 0 0 / calc(0.6 * ${fade} * ${vis}))`);
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
  const n = Math.max(0, Math.min(trayFx.lines, Math.floor(room / (trayFx.thick + 2))));
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
  let ph;
  if (trayFx.motion === 'pulse') ph = 0.5 - 0.5 * Math.cos(t / 1400 * Math.PI);          // 2.8s breath
  else { const n = Math.max(1, trayFx.lines) + 2; ph = ((t / 700) % (n + 1.5)) - 0.5; }  // inward sweep, one line per 0.7s
  const now = performance.now();
  const v = ph.toFixed(2);
  trayFxEach(el => { if (!el._hover && !(el._kickUntil > now) && el.offsetWidth && el._tfxPh !== v) { el._tfxPh = v; el.style.setProperty('--tray-ph', v); } });
}
function trayFxSync() {
  const set = (id, v) => { const e = document.getElementById(id); if (e && document.activeElement !== e) e.value = String(v); };
  set('dev-tfx-lines', trayFx.lines); set('dev-tfx-thick', trayFx.thick); set('dev-tfx-glow', trayFx.glow);
  set('dev-tfx-gain', trayFx.gain); set('dev-tfx-motion', trayFx.motion);
  set('dev-tfx-center', trayFx.center); set('dev-tfx-fade', trayFx.fade);
  const c = document.getElementById('dev-tfx-center-v'), d = document.getElementById('dev-tfx-fade-v');
  if (c) c.textContent = trayFx.center + '%'; if (d) d.textContent = trayFx.fade + '%';
}
if (document.body) trayFxApply(); else document.addEventListener('DOMContentLoaded', trayFxApply);

// ══ Tray reactions (r447, card-animation step 8) ═════════════════════════════
// Every tray's lines react to what happens in it:
//   - an entity LANDS (a Trick or Knack is gained): it drops into the tray from
//     above, large and blurred, settling into place, and the lines ripple inward
//     with a flare (trayFxKick 'in');
//   - an entity LEAVES (sold, traded, lost): a copy of it sinks into the tray,
//     shrinking and darkening, and the lines pull back outward, dimmed ('out');
//   - the POINTER over a tray: the line nearest it lights up and follows it.
// A kicked or hovered tray is skipped by the ambient tick until it is done.
const TRAY_KICK_MS = 560;

function trayFxKick(el, dir) {
  if (!el || document.body.classList.contains('reduced-motion')) return;
  const n = Math.max(1, trayFx.lines) + 1, t0 = performance.now();
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

// The pointer: the line nearest it lights, so the rings follow the cursor in and out.
function trayFxHover(el, e) {
  if (el._kickUntil > performance.now()) return;
  const r = el.getBoundingClientRect(), k = (r.width / (el.offsetWidth || 1)) || 1;
  const d = Math.min(e.clientX - r.left, r.right - e.clientX, e.clientY - r.top, r.bottom - e.clientY) / k;
  el._hover = true;
  el.style.setProperty('--tray-mode', 1);
  el.style.setProperty('--tray-ph', (Math.max(0, d) / (trayFx.thick + 2) - 0.3).toFixed(3));
  el.style.setProperty('--tray-boost', '0.5');
}
function trayFxHoverEnd(el) {
  el._hover = false;
  if (el._kickUntil > performance.now()) return;
  el.style.removeProperty('--tray-boost'); el.style.removeProperty('--tray-mode');
}
function trayFxBindHover() {
  trayFxEach(el => {
    if (el._tfxBound) return; el._tfxBound = true;
    el.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') trayFxHover(el, e); });
    el.addEventListener('pointerleave', () => trayFxHoverEnd(el));
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
