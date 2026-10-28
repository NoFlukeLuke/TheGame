// ── r696: the rising SCORE (owner) ───────────────────────────────────────────
// While any hand is scoring the SCORE box does not wait for its tally. From the
// moment a hand is banked (playHand's `score += finalScore`) the box rolls up
// toward the banked total like a mechanical odometer: the units wheel turns
// without stopping and each higher wheel turns over on the carry, in the last
// tenth of the wheel below it. A lone hand's roll takes `riseCfg.ms`; every hand
// played while the roll is still moving makes the rest of it `riseCfg.step` times
// faster (the gap is re-planned from where the wheels are). Nothing else changes:
// the chips, the fuse, the throw and the dance's own climb run as before; the
// dance simply does not write the box while the roll owns it (scoreRiseOwns), and
// updateScoreUI reads dncScoreShown() as it always did (the roll writes it). When
// the roll lands with no hand scoring and none waiting, the box is handed back as
// plain text. A cut dance, a level-up or a screen between rounds snaps it home.
const RISE_KEY = 'lethe.scoreRise.v1';
const RISE_DEFAULT = { on: 1, ms: 2400, step: 1.5 };   // ms: a lone hand's roll; step: x faster per extra hand
const riseCfg = Object.assign({}, RISE_DEFAULT);
try { Object.assign(riseCfg, JSON.parse(localStorage.getItem(RISE_KEY) || '{}')); } catch (e) {}
function setScoreRise(key, v) {
  if (!(key in RISE_DEFAULT)) return;
  riseCfg[key] = key === 'on' ? (v ? 1 : 0) : Math.max(key === 'ms' ? 200 : 1, +v || RISE_DEFAULT[key]);
  const ov = {}; for (const k in RISE_DEFAULT) if (riseCfg[k] !== RISE_DEFAULT[k]) ov[k] = riseCfg[k];
  try { Object.keys(ov).length ? localStorage.setItem(RISE_KEY, JSON.stringify(ov)) : localStorage.removeItem(RISE_KEY); } catch (e) {}
  riseDevSync();
}
function riseDevSync() {
  const on = document.getElementById('dev-rise-on'), ms = document.getElementById('dev-rise-ms'), st = document.getElementById('dev-rise-step');
  if (on) on.checked = !!riseCfg.on; if (ms) ms.value = riseCfg.ms; if (st) st.value = riseCfg.step;
}
function scoreRiseOn() {
  return !!riseCfg.on && !document.body.classList.contains('reduced-motion');
}

const rise = { owns: false, cur: 0, target: 0, vel: 0, hands: 0, raf: 0, last: 0, ui: 0, n: 0, k: 1, w: 0.62, ink: 1, off: 0 };
function scoreRiseOwns() { return rise.owns; }
function riseEl() { return document.getElementById('score-total-num'); }

// The pace the tally runs at (Settings -> Animation speed); the roll keeps step with it.
function risePace() { return (typeof DANCE_CFG !== 'undefined' && DANCE_CFG.norm) || 1; }

// A hand has just been banked into `score`: start the roll, or re-plan a live one.
function scoreRiseNote(from) {
  if (!scoreRiseOn() || (typeof suppressScoreDisplay !== 'undefined' && suppressScoreDisplay)) return;
  const el = riseEl(); if (!el || el.style.visibility === 'hidden') return;
  if (typeof scorePanelIsBetweenRounds === 'function' && scorePanelIsBetweenRounds()) return;
  if (!rise.owns) {
    rise.owns = true; rise.hands = 0;
    // Start from what the box shows: the dance's number if one is live, else the total before this hand.
    rise.cur = (typeof dncShowScore !== 'undefined' && dncShowScore != null) ? dncShowScore : (typeof from === 'number' ? from : score);
    rise.cur = Math.max(0, Math.min(rise.cur, score));
    rise.n = 0; riseMeasure(el); el.classList.add('odo'); riseBuild(el, score);
  }
  rise.hands++;
  rise.target = score;
  const dur = riseCfg.ms / risePace() / Math.pow(riseCfg.step, rise.hands - 1);
  rise.vel = Math.max(0, rise.target - rise.cur) / Math.max(60, dur);   // points per ms
  if (!rise.raf) { rise.last = performance.now(); rise.raf = requestAnimationFrame(riseFrame); }
  riseDraw(el);
}

function riseFrame(now) {
  rise.raf = 0;
  const el = riseEl();
  if (!rise.owns || !el) return;
  // The total moved under the roll: more to climb (re-plan at the same pace), or a reset
  // (a level-up banked the round, a new run): snap home.
  if (score > rise.target) { rise.target = score; rise.vel = Math.max(rise.vel, (rise.target - rise.cur) / Math.max(60, riseCfg.ms / risePace() / Math.pow(riseCfg.step, Math.max(0, rise.hands - 1)))); }
  if (score < rise.target || (typeof scorePanelIsBetweenRounds === 'function' && scorePanelIsBetweenRounds())) { scoreRiseSnap(); return; }
  const dt = Math.min(100, now - rise.last); rise.last = now;
  rise.cur = Math.min(rise.target, rise.cur + rise.vel * dt);
  if (typeof dncShowScore !== 'undefined') dncShowScore = Math.floor(rise.cur);
  riseDraw(el);
  if (now - rise.ui > 80) { rise.ui = now; if (typeof updateScoreUI === 'function') updateScoreUI(); }   // the goal bar follows
  if (rise.cur < rise.target) { rise.raf = requestAnimationFrame(riseFrame); return; }
  // Landed. With nothing scoring and nothing waiting the box goes back to plain text;
  // otherwise it stays owned, at rest, until the dance's end calls scoreRiseRelease.
  scoreRiseRelease();
}

// The dance's end: hand the box back if the roll has landed and no hand is left.
function scoreRiseRelease() {
  if (!rise.owns) return;
  const scoring = (typeof danceAbortController !== 'undefined' && danceAbortController) || (typeof dncQueue !== 'undefined' && dncQueue.some(e => !e.dead));
  if (rise.cur < rise.target || scoring) return;
  riseHandBack();
}
// A cut dance, a reset or a screen between rounds: the wheels land on the total now.
function scoreRiseSnap() {
  if (!rise.owns) return;
  rise.cur = rise.target = score;
  riseHandBack();
}
function riseHandBack() {
  if (rise.raf) { cancelAnimationFrame(rise.raf); rise.raf = 0; }
  rise.owns = false; rise.hands = 0;
  if (typeof dncShowScore !== 'undefined') dncShowScore = null;
  const el = riseEl();
  if (el) { el.classList.remove('odo'); const s = score.toLocaleString(); el.textContent = s; el.dataset.displayVal = s; }
  if (typeof updateScoreUI === 'function') updateScoreUI();
}

// ── the wheels ──
// One cell per digit of the target, a separator after every third place. A cell is a
// clipped window the height of a glyph's content area (measured: the console font
// draws past its 1em line box) holding a column of 0..9 and a 0 again, moved by
// translateY. Leading cells that have nothing to show yet are hidden (with their
// separator) until a carry starts turning them.
const RISE_SEP = (1000).toLocaleString().charAt(1).replace(/\d/, '') || ',';
function riseMeasure(el) {
  // k: a glyph's content area over the font size (the pitch between the wheel's
  // stacked glyphs; zoom cancels: both read in rects). w: the widest digit over the
  // font size, so the wheels never jiggle sideways. ink / off: the digits' ink height
  // and its top inside the content area, from canvas metrics at the USED font size
  // (font-size-adjust scales the console font well past its 1em line box), so the
  // window shows one digit's ink and nothing of its neighbours but what rolls through.
  const probe = document.createElement('span'); probe.style.cssText = 'visibility:hidden;white-space:pre;';   // in flow, so it is laid out exactly as the text was
  // The zoom is read while the element still holds its text (emptied, its box is 0 tall).
  const zr = el.getBoundingClientRect(), z = (zr.height && el.offsetHeight) ? zr.height / el.offsetHeight : 1;
  const keep = el.textContent; el.textContent = ''; el.appendChild(probe);
  const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 24;
  try {
    let w = 0, h = 0;
    for (let d = 0; d < 10; d++) {
      probe.textContent = String(d);
      const r = document.createRange(); r.selectNodeContents(probe); const b = r.getBoundingClientRect();
      w = Math.max(w, b.width / z); h = Math.max(h, b.height / z);
    }
    rise.k = h > 0 ? h / fs : 1; rise.w = w > 0 ? w / fs : .62;
  } catch (e) { rise.k = 1; rise.w = .62; }
  probe.remove(); el.textContent = keep;
  rise.ink = rise.k; rise.off = 0;
  try {
    const cv = document.createElement('canvas').getContext('2d');
    const fam = cs.fontFamily, wt = cs.fontWeight || '400', st = cs.fontStyle || 'normal';
    const adj = parseFloat(cs.fontSizeAdjust);
    let used = fs;
    if (adj > 0) { cv.font = `${st} ${wt} 100px ${fam}`; const xm = cv.measureText('x'); const xh = xm.actualBoundingBoxAscent / 100; if (xh > 0) used = fs * adj / xh; }
    cv.font = `${st} ${wt} ${used}px ${fam}`;
    let asc = 0, desc = 0, fa = 0, fd = 0;
    for (let d = 0; d < 10; d++) { const m = cv.measureText(String(d)); asc = Math.max(asc, m.actualBoundingBoxAscent); desc = Math.max(desc, m.actualBoundingBoxDescent); fa = Math.max(fa, m.fontBoundingBoxAscent || 0); fd = Math.max(fd, m.fontBoundingBoxDescent || 0); }
    const area = (fa + fd) || (rise.k * fs);
    if (asc + desc > 0 && asc + desc <= area * 1.05) {
      const pad = 0.04 * fs;   // a hair of air above and below the ink
      // The content area measured in the DOM is the truth for the pitch; the canvas's
      // font box places the ink inside it (the two agree when the same font answered).
      const top = Math.max(0, (rise.k * fs - area) / 2 + fa - asc - pad);
      rise.ink = Math.min(rise.k, (asc + desc + 2 * pad) / fs); rise.off = top / fs;
    }
  } catch (e) {}
  el.style.setProperty('--odo-k', rise.k.toFixed(3)); el.style.setProperty('--odo-w', rise.w.toFixed(3));
  el.style.setProperty('--odo-ink', rise.ink.toFixed(3)); el.style.setProperty('--odo-off', rise.off.toFixed(3));
}
function riseBuild(el, target) {
  const n = Math.max(1, String(Math.max(0, Math.floor(target))).length);
  if (n === rise.n && el.querySelector('.odo-c')) return;
  rise.n = n;
  let html = '';
  for (let k = n - 1; k >= 0; k--) {
    html += '<span class="odo-c" data-k="' + k + '"><span class="odo-wheel">' + '0123456789'.split('').map(d => '<b>' + d + '</b>').join('') + '<b>0</b></span></span>';
    if (k > 0 && k % 3 === 0) html += '<span class="odo-s" data-k="' + k + '">' + RISE_SEP + '</span>';
  }
  el.innerHTML = html;
}
function riseDraw(el) {
  if (!el.classList.contains('odo')) el.classList.add('odo');
  if (String(Math.floor(rise.target)).length !== rise.n) riseBuild(el, rise.target);
  const v = Math.max(0, rise.cur);
  const cells = el.querySelectorAll('.odo-c'), seps = el.querySelectorAll('.odo-s');
  let lit = false;   // once a wheel shows anything, every wheel below it shows
  cells.forEach(c => {
    const k = +c.dataset.k, p = Math.pow(10, k);
    const d = Math.floor(v / p) % 10;
    const lower = k === 0 ? v % 1 : (v % p) / p;
    const roll = k === 0 ? lower : Math.max(0, (lower - .9) * 10);
    const show = lit || d > 0 || roll > 0 || k === 0 || v >= p;
    lit = lit || show;
    c.classList.toggle('odo-z', !show);
    const wheel = c.firstElementChild;
    if (wheel) wheel.style.transform = 'translateY(' + (-((d + roll) * rise.k + rise.off)).toFixed(4) + 'em)';
  });
  // A separator shows when the wheel to its left does.
  seps.forEach(s => { const left = el.querySelector('.odo-c[data-k="' + s.dataset.k + '"]'); s.classList.toggle('odo-z', !!(left && left.classList.contains('odo-z'))); });
}

// Dev -> Aesthetics -> Rising score -> Preview: a mock roll on the live box (nothing banked).
async function scoreRisePreview() {
  if (rise.owns || (typeof danceAbortController !== 'undefined' && danceAbortController)) { if (typeof showMessage === 'function') showMessage('A hand is scoring. Wait.', '#ff6a3c', { plain: true }); return; }
  if (typeof toggleDevPanel === 'function' && document.getElementById('dev-panel')?.classList.contains('show')) toggleDevPanel();
  const el = riseEl(); if (!el) return;
  const realScore = score, steps = [1860, 2340, 3100];   // three hands, each banked before the last lands
  // Runs the real machine on the real total; the total is put back after.
  let t = score;
  for (let i = 0; i < steps.length; i++) {
    t += steps[i]; score = t; scoreRiseNote();
    await new Promise(r => setTimeout(r, i === 0 ? 1100 : 700));
  }
  await new Promise(r => { const chk = () => (rise.owns && rise.cur < rise.target) ? setTimeout(chk, 60) : r(); chk(); });
  await new Promise(r => setTimeout(r, 500));
  score = realScore; scoreRiseSnap();
}
document.addEventListener('DOMContentLoaded', riseDevSync);
