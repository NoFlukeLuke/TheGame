// ── THE ZIGZAG TRAY (r486) ───────────────────────────────────────────────────
// Portrait only, and a Settings choice (Display -> Trick tray on a phone):
// the tilted fan (js/tricks-ui.js, r399) or this. Every other Trick drops down
// a row, so a line through their centres zigzags. The upper row sits on top and
// covers the lower row's shutter, which is the part of a Trick that says least.
//
// THE TILES ARE SOLID. They take turns coming forward, toward the middle of
// the tray, and a tile never passes through another one:
//   1. it slides LEFT until its right edge clears the tile covering it,
//   2. comes forward over the other row, a little bigger,
//   3. slides back over its own place, holds `hold` ms, and goes back the same way.
// Only the row on top can come forward, so after the last tile of that row the
// rows trade places: the lower row drops until its top clears the upper row's
// bottom, comes to the front, rises back, and its tiles take their turns left
// to right. Then back again.
//
// It stops while a hand scores (the tray's own trigger pops play undisturbed),
// while a Trick is lifted or its tooltip is open, while paused, and under
// Reduced motion. Positions are design px written as left/top; the motion rides
// the standalone translate and scale properties.
const ZZ_DEFAULTS = { height: 90, step: 60, drop: 60, scale: 1.15, hold: 2000 };
const ZZ_KEY = 'lethe.trayZigzag.v1';
let ZZ_CFG = { ...ZZ_DEFAULTS };
try { Object.assign(ZZ_CFG, JSON.parse(localStorage.getItem(ZZ_KEY) || '{}')); } catch (e) {}

function trayZigzagOn() {
  return (typeof SETTINGS === 'undefined' || SETTINGS.trickTrayLayout !== 'tilt');
}
function zzSetCfg(key, val) {
  const v = parseFloat(val);
  if (!isFinite(v)) return;
  ZZ_CFG[key] = v;
  const over = {};
  for (const k in ZZ_CFG) if (ZZ_CFG[k] !== ZZ_DEFAULTS[k]) over[k] = ZZ_CFG[k];
  try { Object.keys(over).length ? localStorage.setItem(ZZ_KEY, JSON.stringify(over)) : localStorage.removeItem(ZZ_KEY); } catch (e) {}
  if (typeof renderTrickTray === 'function') renderTrickTray();
}
function zzResetCfg() {
  ZZ_CFG = { ...ZZ_DEFAULTS };
  try { localStorage.removeItem(ZZ_KEY); } catch (e) {}
  zzSyncDev();
  if (typeof renderTrickTray === 'function') renderTrickTray();
}
function zzSyncDev() {
  for (const k in ZZ_DEFAULTS) { const el = document.getElementById('dev-zz-' + k); if (el && document.activeElement !== el) el.value = ZZ_CFG[k]; }
}

let _zzGeo = null, _zzGen = 0, _zzPhase = 'up', _zzNext = 0;

// Lay the tiles out. Called by fanTrickTray (portrait) when the zigzag is on.
function zigzagTrickTray(list, track, chips) {
  list.classList.add('zz');
  list.classList.remove('fanned');
  chips.forEach(c => {
    c.style.width = ''; c.style.height = ''; c.style.left = ''; c.style.top = '';
    c.style.translate = ''; c.style.scale = ''; c.style.transition = '';
    c.style.removeProperty('--tilt'); c.style.marginRight = '';
  });
  const bw = chips[0].offsetWidth || 80, bh = chips[0].offsetHeight || 76;
  const W = list.clientWidth, H = list.clientHeight;
  if (W <= 0 || H <= 0) return false;
  const n = chips.length;
  let h = bh * ZZ_CFG.height / 100, w = h * bw / bh, drop = n > 1 ? h * ZZ_CFG.drop / 100 : 0;
  if (h + drop > H) { const k = H / (h + drop); h *= k; w *= k; drop *= k; }
  // A tile slides left by (w - 2*step) before it comes forward, so the first
  // tile of each row needs that much room on its left or the tray clips it.
  // The room is reserved, and the step shrinks to pay for it, down to a floor
  // past which the slide is allowed to clip a little.
  const slide = s => (n > 2 ? Math.max(0, w - 2 * s + 2) : 0);
  let step = w * ZZ_CFG.step / 100;
  if (n > 1 && slide(step) + w + (n - 1) * step > W) {
    step = (W - w) / (n - 1);
    if (slide(step) > 0) step = n > 3 ? (W - 2 * w - 2) / (n - 3) : step;
    step = Math.max(step, w * 0.2);
  }
  // r517 (owner): left-aligned, not centred. Only the slide's reserve sits left of the first tile.
  const res = slide(step);
  const x0 = Math.min(res, Math.max(0, W - w - (n - 1) * step)), y0 = Math.max(0, (H - (h + drop)) / 2);
  chips.forEach((c, i) => {
    c.style.width = w.toFixed(1) + 'px'; c.style.height = h.toFixed(1) + 'px';
    c.style.left = (x0 + i * step).toFixed(1) + 'px';
    c.style.top = (y0 + (i % 2 ? drop : 0)).toFixed(1) + 'px';
  });
  _zzGeo = { w, h, drop, step, x0 };
  if (n < 2) _zzPhase = 'up';
  zzApplyZ(chips);
  zzStart();
  return true;
}

function zzChips() {
  const list = document.getElementById('trick-tray-list');
  if (!list || !list.classList.contains('zz')) return [];
  return [...list.querySelectorAll('.trick-tray-chip')];
}
// The row on top gets the high z; inside a row the later tile is on top.
function zzApplyZ(chips) {
  chips.forEach((c, i) => {
    const onTop = (i % 2 === 1) === (_zzPhase === 'down');
    c.style.zIndex = String((onTop ? 100 : 10) + i);
  });
}

function zzBlocked() {
  const st = document.getElementById('stage');
  if (!st || st.classList.contains('landscape') || !trayZigzagOn()) return true;
  if (document.hidden || document.body.classList.contains('reduced-motion')) return true;
  if (typeof danceAbortController !== 'undefined' && danceAbortController) return true;
  if (typeof isPaused !== 'undefined' && isPaused) return true;
  if (typeof _liftChip !== 'undefined' && _liftChip) return true;
  if (document.getElementById('trick-tooltip')) return true;
  return false;
}

// Waits `ms` of unblocked time. False if the tray was rebuilt or play blocked it.
function zzWait(ms, g) {
  return new Promise(res => {
    const t0 = performance.now();
    const tick = () => {
      if (g !== _zzGen) return res(false);
      if (zzBlocked()) return res(false);
      if (performance.now() - t0 >= ms) return res(true);
      setTimeout(tick, Math.min(80, ms));
    };
    setTimeout(tick, Math.min(80, ms));
  });
}
function zzMove(els, tx, ty, s, ms) {
  els.forEach(el => {
    el.style.transition = `translate ${ms}ms cubic-bezier(.4,0,.2,1), scale ${ms}ms cubic-bezier(.4,0,.2,1)`;
    el.style.translate = (tx || ty) ? `${tx.toFixed(1)}px ${ty.toFixed(1)}px` : '';
    el.style.scale = s !== 1 ? String(s) : '';
  });
}
// Everything back to rest, quickly. Used when play interrupts a turn.
function zzRestAll() {
  const chips = zzChips();
  zzMove(chips, 0, 0, 1, 160);
  zzApplyZ(chips);
}

function zzStart() {
  const g = ++_zzGen;
  setTimeout(() => zzLoop(g), 600);
}
async function zzLoop(g) {
  while (g === _zzGen) {
    if (zzBlocked()) {
      await new Promise(r => setTimeout(r, 300));
      continue;
    }
    const chips = zzChips();
    if (!chips.length || !_zzGeo) return;
    const row = chips.filter((c, i) => (i % 2 === 1) === (_zzPhase === 'down'));
    let ok;
    if (_zzNext < row.length) {
      ok = await zzHop(chips, row[_zzNext], g);
      if (ok) _zzNext++;
    } else if (chips.length > 1) {
      ok = await zzSwapRows(chips, g);
      if (ok) _zzNext = 0;
    } else { _zzNext = 0; ok = await zzWait(600, g); }
    if (!ok && g === _zzGen) zzRestAll();
  }
}

async function zzHop(chips, chip, g) {
  const G = _zzGeo, i = chips.indexOf(chip);
  const next = chips[i + 2];
  // How far it must slide left before nothing covers its right edge.
  const ov = next ? Math.max(0, G.w - 2 * G.step + 2) : 0;
  const lower = i % 2 === 1;
  const toward = (lower ? -1 : 1) * G.drop / 2;   // toward the middle of the tray
  const S = ZZ_CFG.scale;
  const steps = [];
  if (ov) steps.push(() => zzMove([chip], -ov, 0, 1, 220), 220);
  steps.push(() => { chip.style.zIndex = '300'; zzMove([chip], -ov, toward, S, 260); }, 260);
  if (ov) steps.push(() => zzMove([chip], 0, toward, S, 220), 220);
  steps.push(() => {}, ZZ_CFG.hold);
  if (ov) steps.push(() => zzMove([chip], -ov, toward, S, 220), 220);
  steps.push(() => zzMove([chip], -ov, 0, 1, 260), 260);
  steps.push(() => zzApplyZ(chips), 0);
  if (ov) steps.push(() => zzMove([chip], 0, 0, 1, 220), 220);
  steps.push(() => {}, 350);
  for (let k = 0; k < steps.length; k += 2) {
    steps[k]();
    if (steps[k + 1] && !(await zzWait(steps[k + 1], g))) return false;
  }
  return true;
}

// The lower row drops clear of the upper row, the two trade places front to
// back, and the lower row rises back.
async function zzSwapRows(chips, g) {
  const G = _zzGeo;
  const lowers = chips.filter((c, i) => i % 2 === 1);
  const dy = G.h - G.drop + 2;
  zzMove(lowers, 0, dy, 1, 320);
  if (!(await zzWait(340, g))) return false;
  _zzPhase = _zzPhase === 'up' ? 'down' : 'up';
  zzApplyZ(chips);
  zzMove(lowers, 0, 0, 1, 320);
  if (!(await zzWait(700, g))) return false;
  return true;
}

// Stop the cycle and put the tray back to an ordinary layout.
function zzTeardown(list) {
  if (!list || !list.classList.contains('zz')) return;
  _zzGen++;
  list.classList.remove('zz');
  list.querySelectorAll('.trick-tray-chip').forEach(c => {
    ['width','height','left','top','translate','scale','transition','zIndex'].forEach(p => { c.style[p] = ''; });
  });
}

zzSyncDev();
