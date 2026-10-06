/* Tray FX (r441): the infinity lines on every tray.
   Dev -> Aesthetics -> Tray lines. The stack actually painted is generated here
   (trayFxRingString) for the chosen line count, spacing and growth, with the live parts left
   as CSS custom properties on each tray: --tray-ph / --tray-boost (a band sweeping the lines
   and a flare, written only while a tray REACTS). r463: no idle motion and no hover. A tray
   moves for exactly three things: an entity arriving, one leaving, and one triggering
   (very light). The Pit look (js/tray-pit.js) replaces the lines and takes those three over. */
const TRAY_FX_KEY = 'lethe.trayFx.v2';   // r451: overrides only (v1 stored every field)
const TRAY_FX_DEFAULT = { lines: 3, thick: 1, glow: 10, gain: 1.2, center: 35, fade: 70, gap: 2, grow: 5, small: 35 };
const TRAY_FX_IDS = ['score-center', 'score-left', 'pips-box', 'mult-box', 'focus-box', 'screen-location',
  'pmf-merged', 'knack-carousel-wrap', 'selected-cards', 'trick-tray-area', 'hand-preview-area',
  'coin-info', 'vclock', 'run-progress'];
// The trays that hold entities, and so react. Every other tray is a SMALL tray, drawn at
// trayFx.small % loudness (lines and outer glow) so the big trays lead.
const TRAY_FX_MOVING = ['knack-carousel-wrap', 'selected-cards', 'trick-tray-area', 'hand-preview-area'];
const trayFxMoves = el => TRAY_FX_MOVING.includes(el.id);
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
    const sv = JSON.parse(o);   // r463: drop settings that no longer exist (motion, tilt, speed)
    for (const k in sv) if (k in d) d[k] = sv[k];
    return d;
  } catch (e) { return d; } })();
let _trayFxEls = null;

function trayFxSave() {
  const o = {}; for (const k in trayFx) if (trayFx[k] !== TRAY_FX_DEFAULT[k]) o[k] = trayFx[k];
  try { if (Object.keys(o).length) localStorage.setItem(TRAY_FX_KEY, JSON.stringify(o)); else localStorage.removeItem(TRAY_FX_KEY); } catch (e) {}
}
function trayFxSet(key, val) {
  trayFx[key] = +val;
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
  st.setProperty('--tray-amp', 0.9);   // the band's strength; it only shows while a tray reacts
  trayFxTrimRings();
  st.setProperty('--tray-f', (1 - 0.45 * f.fade / 100).toFixed(3));
  trayFxEach(el => {
    el.style.setProperty('--tray-ph', TRAY_PH_REST);
    if (trayFxMoves(el)) ['--tray-loud', '--tray-amp', '--tray-halo'].forEach(p => el.style.removeProperty(p));
    else { const q = f.small / 100;
      el.style.setProperty('--tray-loud', q); el.style.setProperty('--tray-amp', 0);
      el.style.setProperty('--tray-halo', +(f.glow * q).toFixed(2)); }
  });
  trayFxLimitAll();
  trayFxWatch();
  if (typeof trayPitApply === 'function') trayPitApply();   // the pit reads Clear centre too
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
   gap * (1 + grow%)^i, so every gap is a little wider than the one outside it. */
function trayFxGeom(n) {
  const f = trayFx, s = [0];
  for (let i = 0; i < n; i++) s.push(s[i] + f.thick + 1 + f.gap * Math.pow(1 + f.grow / 100, i));
  return { s };
}
const _tfxPx = v => +v.toFixed(2);
const TRAY_RIPPLE_FRONT = 1, TRAY_RIPPLE_TAIL = 2.6;   // the reaction band's shape, in lines
const TRAY_PH_REST = -9;   // --tray-ph with the band parked off the lines
function trayFxRingString(n) {
  // The reaction band (a land sweeps it inward, a leave outward): a comet with a soft
  // front and a long tail. --tray-loud is a small tray's loudness.
  const band = (i, x) => `max(0, 1 - max((${i} - ${x}) / ${TRAY_RIPPLE_FRONT}, (${x} - ${i}) / ${TRAY_RIPPLE_TAIL}))`;
  const ph = i => `(1 + var(--tray-amp) * ${band(i, 'var(--tray-ph)')}) * (1 + var(--tray-boost, 0))`;
  const g = trayFxGeom(n), t = trayFx.thick, out = [];
  for (let i = 0; i < n; i++) {
    // fade = how much dimmer each line is than the one outside it (--tray-f, the depth
    // fade slider); vis = this tray's own cap (--tray-n, from the clear-centre rule).
    const fade = `pow(var(--tray-f, 0.685), ${i})`, vis = `clamp(0, var(--tray-n, 99) - ${i}, 1)`;
    out.push(`inset 0 0 0 ${_tfxPx(g.s[i] + t)}px color-mix(in srgb, var(--tray-c) calc(min(100, 70 * ${fade} * var(--tray-gain) * var(--tray-loud, 1) * ${ph(i)} * ${vis}) * 1%), transparent)`);
    out.push(`inset 0 0 0 ${_tfxPx(g.s[i] + t + 1)}px color-mix(in srgb, var(--tray-c) calc(min(100, 23.1 * ${fade} * var(--tray-gain) * var(--tray-loud, 1) * ${ph(i)} * ${vis}) * 1%), transparent)`);
    out.push(`inset 0 0 0 ${_tfxPx(g.s[i + 1])}px rgb(0 0 0 / calc(0.6 * ${fade} * ${vis}))`);
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
  const g = trayFxGeom(trayFx.lines);
  let n = 0; while (n < trayFx.lines && g.s[n + 1] <= room) n++;
  el._tfxN = n;
  el.style.setProperty('--tray-n', n);
}
function trayFxLimitAll() { trayFxEach(trayFxLimit); }
let _trayFxRo = null;
function trayFxWatch() {
  if (_trayFxRo || typeof ResizeObserver === 'undefined') return;
  _trayFxRo = new ResizeObserver(es => es.forEach(e => { trayFxLimit(e.target); if (typeof trayPitPaint === 'function') trayPitPaint(e.target); }));
  trayFxEach(el => _trayFxRo.observe(el));
}
function trayFxEach(fn) {
  if (!_trayFxEls) _trayFxEls = TRAY_FX_IDS.map(id => document.getElementById(id)).filter(Boolean);
  _trayFxEls.forEach(fn);
}
function trayFxSync() {
  const set = (id, v) => { const e = document.getElementById(id); if (e && document.activeElement !== e) e.value = String(v); };
  set('dev-tfx-lines', trayFx.lines); set('dev-tfx-thick', trayFx.thick); set('dev-tfx-glow', trayFx.glow);
  set('dev-tfx-gain', trayFx.gain);
  [['center', '%'], ['fade', '%'], ['gap', 'px'], ['grow', '%'], ['small', '%']].forEach(([k, u]) => {
    set('dev-tfx-' + k, trayFx[k]);
    const e = document.getElementById('dev-tfx-' + k + '-v'); if (e) e.textContent = trayFx[k] + u;
  });
}
if (document.body) trayFxApply(); else document.addEventListener('DOMContentLoaded', trayFxApply);

// ══ Tray reactions (r447; r463: the only motion a tray has) ══════════════════
// A tray moves for exactly three things:
//   - an entity LANDS (a Trick or Knack is gained): it drops into the tray from
//     above, large and blurred, settling into place, and the lines ripple inward
//     with a flare (trayFxKick 'in');
//   - an entity LEAVES (sold, traded, lost): a copy of it sinks into the tray,
//     shrinking and darkening, and the lines pull back outward, dimmed ('out');
//   - an entity TRIGGERS (it pays during the score tally): one small, quick flare
//     (trayFxTrigger). The chip's own pop is the dance's; this is only the tray answering.
// With the Pit look on, js/tray-pit.js draws all three instead (trayPitKick / trayPitTrigger).
const TRAY_KICK_MS = 560, TRAY_TRIGGER_MS = 240;
const _trayPit = () => typeof trayPitOn === 'function' && trayPitOn();

function trayFxKick(el, dir) {
  if (!el || document.body.classList.contains('reduced-motion')) return;
  if (_trayPit()) { trayPitKick(el, dir); return; }
  const n = Math.max(1, el._tfxN || trayFx.lines) + 1, t0 = performance.now();
  el._kickUntil = t0 + TRAY_KICK_MS;
  const step = t => {
    const p = Math.min(1, (t - t0) / TRAY_KICK_MS);
    const ph = dir === 'in' ? -0.5 + p * (n + 1) : n + 0.5 - p * (n + 1);
    const boost = dir === 'in' ? 1.4 * (1 - p) * (1 - p) : -0.55 * Math.sin(p * Math.PI);
    el.style.setProperty('--tray-ph', ph.toFixed(3));
    el.style.setProperty('--tray-boost', boost.toFixed(3));
    if (p < 1) requestAnimationFrame(step);
    else { el._kickUntil = 0; el.style.setProperty('--tray-ph', TRAY_PH_REST); el.style.removeProperty('--tray-boost'); }
  };
  requestAnimationFrame(step);
}
// A trigger: every line brightens a little (+35%) and settles back in TRAY_TRIGGER_MS.
// Skipped while a land/leave is still running, so a fast tally never stacks flares.
function trayFxTrigger(el) {
  if (!el || document.body.classList.contains('reduced-motion') || el._kickUntil > performance.now()) return;
  if (_trayPit()) { trayPitTrigger(el); return; }
  const t0 = performance.now(); el._trigAt = t0;
  const step = t => {
    if (el._trigAt !== t0 || el._kickUntil > t) return;   // a newer trigger or a kick took over
    const p = Math.min(1, (t - t0) / TRAY_TRIGGER_MS);
    el.style.setProperty('--tray-boost', (0.35 * (1 - p) * (1 - p)).toFixed(3));
    if (p < 1) requestAnimationFrame(step); else el.style.removeProperty('--tray-boost');
  };
  requestAnimationFrame(step);
}
// The dance's release on a real chip (js/score-dance.js) is the trigger moment.
function trayFxWatchTriggers() {
  const orig = window.dncReleaseReal; if (typeof orig !== 'function' || orig._tfxWrapped) return;
  const wrapped = function (el) {
    const out = orig.apply(this, arguments);
    const tray = el && el.closest && el.closest(TRAY_FX_MOVING.map(id => '#' + id).join(','));
    if (tray) trayFxTrigger(tray);
    return out;
  };
  wrapped._tfxWrapped = true;
  window.dncReleaseReal = wrapped;
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
  trayFxWatchTriggers();
  trayWatch('renderTrickTray', '#trick-tray-list', '.trick-tray-chip', 'trickId', 'trick-tray-area',
    () => (typeof trickTray !== 'undefined' ? trickTray : []));
  trayWatch('updateKnackList', '#knack-list', '.knack-chip', 'knackId', 'knack-carousel-wrap',
    () => (typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', trayFxInstallReactions);
else trayFxInstallReactions();
