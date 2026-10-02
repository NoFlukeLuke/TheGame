/* Tray FX (r441): the infinity lines on every tray.
   Dev -> Aesthetics -> Tray lines. All five knobs are CSS custom properties on :root
   (see the --tray-rings stack in css/style.css), so every tray changes together.
   Motion is a rAF loop that writes --tray-ph on each tray element (not on :root, so the
   rest of the page is not restyled): Pulse breathes all lines together, Ripple sends a
   bright band inward through them. */
const TRAY_FX_KEY = 'lethe.trayFx.v1';
const TRAY_FX_DEFAULT = { lines: 3, thick: 2, glow: 10, gain: 1.2, motion: 'ripple' };
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
  trayFxEach(el => el.style.setProperty('--tray-ph', 0));
  cancelAnimationFrame(_trayFxRaf); _trayFxRaf = 0;
  if (f.motion !== 'off') _trayFxRaf = requestAnimationFrame(trayFxTick);
  trayFxSync();
}
function trayFxEach(fn) {
  if (!_trayFxEls) _trayFxEls = TRAY_FX_IDS.map(id => document.getElementById(id)).filter(Boolean);
  _trayFxEls.forEach(fn);
}
function trayFxTick(t) {
  _trayFxRaf = requestAnimationFrame(trayFxTick);
  if (t - _trayFxLast < 33) return;           // ~30fps is plenty for a slow glow
  _trayFxLast = t;
  if (document.body.classList.contains('reduced-motion')) return;
  let ph;
  if (trayFx.motion === 'pulse') ph = 0.5 - 0.5 * Math.cos(t / 1400 * Math.PI);          // 2.8s breath
  else { const n = Math.max(1, trayFx.lines) + 2; ph = ((t / 700) % (n + 1.5)) - 0.5; }  // inward sweep, one line per 0.7s
  trayFxEach(el => el.style.setProperty('--tray-ph', ph.toFixed(3)));
}
function trayFxSync() {
  const set = (id, v) => { const e = document.getElementById(id); if (e && document.activeElement !== e) e.value = String(v); };
  set('dev-tfx-lines', trayFx.lines); set('dev-tfx-thick', trayFx.thick); set('dev-tfx-glow', trayFx.glow);
  set('dev-tfx-gain', trayFx.gain); set('dev-tfx-motion', trayFx.motion);
}
if (document.body) trayFxApply(); else document.addEventListener('DOMContentLoaded', trayFxApply);
