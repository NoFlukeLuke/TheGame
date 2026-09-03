// ══════════════════════════════════════════════════════════════════════════
// SHARED ITEM FLOAT (shop + reward grid)
//
// A barely-noticeable drift on every purchasable / reward tile: each item sines
// slowly on x, y and rotation with its OWN random phase and slightly detuned
// frequency, so a row of tiles never moves in sync.
//
// Owner's chosen preset (from shop-float-anim-preview.html): x±1.5 · y±2.5 ·
// rot±0.5° · 6s. Live-tunable from the dev panel (Animation → Item Float) and
// persisted to localStorage so a tuning session survives a reload.
//
// The float is published as CSS custom properties (--fx / --fy / --fr / --fs)
// rather than written straight to el.style.transform, because .reward-cell
// already uses transform for its hover and .selected scale - the tiles compose
// the float into those transforms in CSS instead of fighting over the property.
// ══════════════════════════════════════════════════════════════════════════

const FLOAT_DEFAULTS = { dx: 1.5, dy: 2.5, rot: 0.5, per: 6, sc: 0 };
let FLOAT_CFG = { ...FLOAT_DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem('floatCfg') || 'null');
  if (saved && typeof saved === 'object') FLOAT_CFG = { ...FLOAT_DEFAULTS, ...saved };
} catch (e) {}

function saveFloatCfg() { try { localStorage.setItem('floatCfg', JSON.stringify(FLOAT_CFG)); } catch (e) {} }
function setFloatParam(k, v) { if (k in FLOAT_CFG) { FLOAT_CFG[k] = +v; saveFloatCfg(); } }
function resetFloatCfg() { FLOAT_CFG = { ...FLOAT_DEFAULTS }; saveFloatCfg(); }

// Per-item seed: random phase on each axis plus a slightly detuned frequency, so
// items drift apart over time instead of beating together.
function _floatSeed() {
  return { px: fxRandom() * 6.283, py: fxRandom() * 6.283, pr: fxRandom() * 6.283,
           fx: 0.85 + fxRandom() * 0.35, fy: 0.75 + fxRandom() * 0.45, fr: 0.7 + fxRandom() * 0.5 };
}

// Seeds cached by a stable key (data-float-key). The reward grid rebuilds its
// tiles on every selection click, and without this each rebuild would re-roll the
// phase and visibly snap the whole board. Keyed seeds keep a tile drifting through
// a re-render. Cleared per screen by clearFloatSeeds().
const _floatSeeds = {};
function _seedFor(el) {
  const key = el.dataset ? el.dataset.floatKey : null;
  if (!key) return el._floatSeed || (el._floatSeed = _floatSeed());
  return _floatSeeds[key] || (_floatSeeds[key] = _floatSeed());
}
function clearFloatSeeds(prefix) {
  Object.keys(_floatSeeds).forEach(k => { if (!prefix || k.startsWith(prefix)) delete _floatSeeds[k]; });
}

// One rAF loop per key ('mart', 'reward', …) so screens can float independently.
const _floatRAF = {};

// selector  - CSS selector for the tiles to float (queried fresh each frame, so
//             re-rendering a screen mid-float just works).
// skipFn    - optional (el) => true to hold an item still (frozen / sold tiles).
function startFloat(key, selector, skipFn) {
  stopFloat(key);
  function loop(ms) {
    const s = ms / 1000, w = 2 * Math.PI / (FLOAT_CFG.per || 6);
    document.querySelectorAll(selector).forEach(el => {
      if (skipFn && skipFn(el)) return;
      const k = _seedFor(el);
      const x = FLOAT_CFG.dx  * Math.sin(s * w * k.fx + k.px);
      const y = FLOAT_CFG.dy  * Math.sin(s * w * k.fy + k.py);
      const r = FLOAT_CFG.rot * Math.sin(s * w * k.fr + k.pr);
      el.style.setProperty('--fx', x.toFixed(2) + 'px');
      el.style.setProperty('--fy', y.toFixed(2) + 'px');
      el.style.setProperty('--fr', r.toFixed(2) + 'deg');
      if (FLOAT_CFG.sc) {
        el.style.setProperty('--fs', (1 + (FLOAT_CFG.sc / 100) * Math.sin(s * w * k.fx + k.pr)).toFixed(4));
      } else {
        el.style.setProperty('--fs', '1');
      }
    });
    _floatRAF[key] = requestAnimationFrame(loop);
  }
  _floatRAF[key] = requestAnimationFrame(loop);
}

function stopFloat(key) {
  if (_floatRAF[key]) cancelAnimationFrame(_floatRAF[key]);
  _floatRAF[key] = null;
}

// Clear the published values so a stopped screen doesn't keep a stale offset.
function clearFloat(selector) {
  document.querySelectorAll(selector).forEach(el => {
    el.style.removeProperty('--fx'); el.style.removeProperty('--fy');
    el.style.removeProperty('--fr'); el.style.removeProperty('--fs');
  });
}
