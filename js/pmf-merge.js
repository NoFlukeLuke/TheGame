// ══════════════════════════════════════════════
// PMF MERGE  (r157, rebuilt r592)
// ══════════════════════════════════════════════
// The PIPS · MULT · FOCUS chips are the running arithmetic of a hand. Once all
// three have landed on their totals they stop being three numbers and become
// one: the score this hand just made. This animates that idea, the SCORE total
// then climbs by that amount, and the row comes back as three chips.
//
// r592 (owner): the fuse is TWO STEPS, so the multiplication is read twice.
//   step 1  PIPS and MULT jitter and combine into one chip reading pips x mult.
//   step 2  that chip and FOCUS jitter and combine into the hand's score.
// Then the fused number flies to SCORE and the row splits back out.
//
// Two looks, dev -> Aesthetics -> Score merge (`lethe.pmfLook.v1`, overrides only):
//   slide  (the pit, the default): the chips slide into each other and MELT. A
//          blob layer behind the chips carries the shapes through an SVG goo
//          filter (a blur, then the alpha channel pushed through feColorMatrix so
//          the blurred edges sharpen into one merged outline; the Codrops /
//          CSS-Tricks recipe), while the chips' own text crossfades on top, sharp.
//          The fused chip grows in where the blobs meet.
//   hold   (console mode): the screens are set in the housing and cannot move, so
//          nothing slides. The VALUES jitter, PIPS fades and MULT holds the
//          product; MULT fades and FOCUS holds the score; the ghost that flies
//          to SCORE is a body-level flier, which the housing takes under its mask.
//   one    (the r157 look): all three slide into one chip in one go.
//   auto   picks hold in console mode, slide elsewhere.
// A call without pips/mult (the interrupt handoff) takes the one-step look.
//
// r708 (owner): Focus resolves IN THE MULT TRAY. Step 2 is no longer "the product and
// FOCUS meet in the middle": FOCUS applies onto the product where it stands, once per
// application. A hand whose Focus applies more than once (Kaleidoscope, Phoenix, Double
// Down, Marathon...) shows one staggered COPY of the Focus figure per extra application
// in the FOCUS tray (pmfFocusCopyAdd, from the dance's Focus beat); at the fuse the
// copies are spent one by one, back first, then the figure itself, each multiplying the
// MULT tray's number on its own beat. `opts.focus` is ONE application's multiplier and
// `opts.focusN` how many times it applies; without them it is one application of
// whatever turns the product into the score.
//
// Runs in BOTH orientations off measured rects, never an assumed layout.
//
// ── Where it sits in the dance ──
// playPreviewDance: card beats → pips/mult reconciled to totals → FOCUS beat →
// [MERGE] → SCORE climb → [SPLIT] → settle. All Hands' finale and the interrupt
// handoff (danceHandoffToScore) use the same three calls.

const PMF_CFG = {
  jitter: 300,   // shake before each fuse
  merge:  380,   // chips slide together / fused chip grows in (one step)
  settle: 90,    // beat after a fuse, before the next step or the climb
  split:  300,   // fused chip back out to three
  hold:   260,   // console: a value fades and the next screen takes the number
};
const PMF_KEY = 'lethe.pmfLook.v1';
// r721: five CARRY looks (a number leaves its tray and is carried into the next one) beside
// the r592 fuses. 'auto' is Rise in every skin.
const PMF_CARRY = ['rise', 'stamp', 'stream', 'zap', 'roll'];
const PMF_LOOKS = ['auto', ...PMF_CARRY, 'hold', 'slide', 'one'];
const PMF_LOOK_NAMES = { auto: 'Auto (Rise)', rise: 'Rise', stamp: 'Stamp', stream: 'Stream', zap: 'Zap', roll: 'Roll',
  hold: 'Hold', slide: 'Melt', one: 'One step' };
const PMF_DEFAULT = 'auto';
// Where a carry look ends: 'mid' (the MULT tray takes the product, then Focus is carried
// into it) or 'focus' (the product is carried on into the FOCUS tray). Overrides only.
const PMF_RESOLVE_KEY = 'lethe.pmfResolve.v1';
let pmfResolve = (() => { try { return localStorage.getItem(PMF_RESOLVE_KEY) === 'focus' ? 'focus' : 'mid'; } catch (e) { return 'mid'; } })();
function setPmfResolve(v) {
  pmfResolve = v === 'focus' ? 'focus' : 'mid';
  try { pmfResolve === 'mid' ? localStorage.removeItem(PMF_RESOLVE_KEY) : localStorage.setItem(PMF_RESOLVE_KEY, pmfResolve); } catch (e) {}
  document.querySelectorAll('[data-pmf-resolve]').forEach(b => b.classList.toggle('on', b.dataset.pmfResolve === pmfResolve));
}

let pmfLookChoice = (() => {
  try { const v = localStorage.getItem(PMF_KEY); return PMF_LOOKS.includes(v) ? v : PMF_DEFAULT; }
  catch (e) { return PMF_DEFAULT; }
})();
function setPmfLook(v) {
  if (!PMF_LOOKS.includes(v)) return;
  pmfLookChoice = v;
  try { v === PMF_DEFAULT ? localStorage.removeItem(PMF_KEY) : localStorage.setItem(PMF_KEY, v); } catch (e) {}
  const sel = document.getElementById('dev-pmf-look'); if (sel) sel.value = v;
}
function pmfLook() {
  if (pmfLookChoice !== 'auto') return pmfLookChoice;
  return 'rise';
}

let _pmfMerged = null;     // the fused chip element (created once, reused)
let _pmfActive = false;
let _pmfMode = null;       // the look the live merge is using
let _pmfFlyFrom = null;    // the element the ghost leaves from
let _pmfFlyText = '';      // what the ghost reads
let _pmfHoldSaved = null;  // hold look: the values' texts before the merge
let _pmfAnims = [];        // WAAPI animations the merge owns (cancelled on reset)
let _pmfFCopies = [];      // r708: the staggered copies of the Focus figure, front last
let _pmfFSpent = [];       // copies a fuse has used up (faded, removed at the reset)
let _pmfFliers = [];       // r721: the carry looks' moving copies, beams and sparks (removed at the reset)
let _pmfGen = 0;           // r721: bumped by every reset; a carry from before it stops writing
let _pmfTimers = [];       // r721: the carry looks' intervals { id, res } (cleared, and their waits let go, at the reset)

// ── The Focus copies (r708) ──────────────────────────────────────────────────
// Copy k sits behind the figure, `PMF_FCOPY_STEP` px right and up per step (the
// scoring queue's stack, small), each a little darker. Children of #focus-box, so
// they live and die with the tray; the figure itself is raised over them.
const PMF_FCOPY_STEP = { x: 10, y: 4, max: 5 };
function pmfFocusCopyAdd(k) {
  const box = document.getElementById('focus-box'), val = document.getElementById('focus-val');
  if (!box || !val || !val.getBoundingClientRect().width) return null;
  if (getComputedStyle(box).position === 'static') box.classList.add('pmf-fc-host');
  val.classList.add('pmf-fcopy-front');
  const i = Math.min(k, PMF_FCOPY_STEP.max);
  const el = document.createElement('div');
  el.className = 'subbox-val pmf-fcopy';
  el.textContent = val.textContent;
  el.style.width = val.offsetWidth + 'px';
  el.style.setProperty('--fc-dim', String(Math.max(0.3, 0.72 - 0.1 * (i - 1))));
  el.dataset.i = i;
  box.insertBefore(el, box.firstChild);
  _pmfFCopies.push(el);
  // The stack must stay inside the tray: the step shrinks so the furthest copy's ink
  // ends at the box's inner edge (the figure is centred, so half the slack is free).
  let ink = 0;
  try { const rg = document.createRange(); rg.selectNodeContents(val); ink = rg.getBoundingClientRect().width; } catch (e) {}
  const z = (box.getBoundingClientRect().width / (box.offsetWidth || 1)) || 1;
  const room = Math.max(0, (box.clientWidth - ink / z) / 2 - 2), n = Math.max(..._pmfFCopies.map(c => +c.dataset.i || 1));
  const sx = Math.min(PMF_FCOPY_STEP.x, room / n);
  _pmfFCopies.forEach(c => { const j = +c.dataset.i || 1; c.style.left = (val.offsetLeft + j * sx) + 'px'; c.style.top = (val.offsetTop - j * PMF_FCOPY_STEP.y) + 'px'; });
  try { el.animate([{ transform: 'translate(-4px,4px) scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }); } catch (e) {}
  return el;
}
function pmfFocusCopiesClear() {
  _pmfFCopies.concat(_pmfFSpent).forEach(el => { try { el.remove(); } catch (e) {} });
  _pmfFCopies = []; _pmfFSpent = [];
  const box = document.getElementById('focus-box'), val = document.getElementById('focus-val');
  if (box) box.classList.remove('pmf-fc-host');
  if (val) val.classList.remove('pmf-fcopy-front');
}
// The applications of step 2: [k, the element spent, the number after it].
function _pmfFocusSteps(handScore, pips, mult, o) {
  const prod = pips * mult, n = Math.max(1, Math.round(o.focusN || 1));
  const f = (typeof o.focus === 'number' && o.focus > 0) ? o.focus : (prod > 0 ? handScore / prod : 1);
  const out = []; let cur = prod;
  for (let k = 1; k <= n; k++) {
    cur = (k === n || !(prod > 0)) ? handScore : cur * f;
    out.push({ k, n, val: cur });
  }
  return out;
}

function _pmfParts() {
  const wrap = document.getElementById('score-subboxes');
  if (!wrap) return null;
  const boxes = ['pips-box', 'mult-box', 'focus-box'].map(id => document.getElementById(id)).filter(Boolean);
  if (boxes.length !== 3) return null;
  const times = [...wrap.querySelectorAll('.subbox-times')];
  return { wrap, boxes, times };
}

// Is there anything to animate? On grid-takeover screens (Rewards / Shop /
// Event) the chips are display:none and #screen-location shows in their place,
// so a merge there would fuse three invisible boxes.
function _pmfVisible(p) {
  if (!p) return false;
  const r = p.wrap.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  return p.boxes.every(b => b.getBoundingClientRect().width > 1);
}

function _pmfEnsureMerged(wrap) {
  if (_pmfMerged && _pmfMerged.parentNode === wrap) return _pmfMerged;
  if (_pmfMerged && _pmfMerged.parentNode) _pmfMerged.parentNode.removeChild(_pmfMerged);
  const el = document.createElement('div');
  el.id = 'pmf-merged';
  // No label (r169) - the fused chip is just the number.
  el.innerHTML = '<div class="pmf-merged-val">0</div>';
  wrap.appendChild(el);
  _pmfMerged = el;
  return el;
}

const _pmfWait = ms => new Promise(r => setTimeout(r, ms));
const _pmfFmt = n => Math.round(n).toLocaleString();
function _pmfAnim(el, kf, t) { const a = el.animate(kf, t); _pmfAnims.push(a); return a; }
function _pmfJit(els, on) { els.forEach(b => { if (!b) return; b.classList.remove('pmf-jitter'); if (on) { void b.offsetWidth; b.classList.add('pmf-jitter'); } }); }
function _pmfJitVal(els, on) { els.forEach(b => { if (!b) return; b.classList.remove('pmf-jit-val'); if (on) { void b.offsetWidth; b.classList.add('pmf-jit-val'); } }); }
// A box's rect in the wrap's own design px (the cabinet zoom divided out).
function _pmfRel(el, wrap) {
  const r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect(), z = (w.width / (wrap.offsetWidth || 1)) || 1;
  return { x: (r.left - w.left) / z, y: (r.top - w.top) / z, w: r.width / z, h: r.height / z, cx: (r.left - w.left + r.width / 2) / z, cy: (r.top - w.top + r.height / 2) / z };
}

// ── The goo filter and the blob layer (slide look) ──────────────────────────
// One hidden SVG filter on the body; a layer inside the wrap (bled 14px so the
// blur has room) holds one blob per chip, melting into each other as they move.
function _pmfEnsureGoo() {
  if (document.getElementById('pmf-goo-svg')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'pmf-goo-svg'; svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = '<filter id="pmf-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>' +
    '<feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="g"/>' +
    '<feComposite in="SourceGraphic" in2="g" operator="atop"/></filter>';
  document.body.appendChild(svg);
}
function _pmfGooLayer(wrap) {
  let g = wrap.querySelector('.pmf-goo');
  if (!g) { g = document.createElement('div'); g.className = 'pmf-goo'; wrap.appendChild(g); }
  g.innerHTML = '';
  return g;
}
function _pmfBlob(layer, r, cls) {
  const b = document.createElement('div'); b.className = 'pmf-blob' + (cls ? ' ' + cls : '');
  // The layer is bled 14px: offsets are from its own top-left.
  b.style.cssText = `left:${r.x + 14}px;top:${r.y + 14}px;width:${r.w}px;height:${r.h}px`;
  layer.appendChild(b); return b;
}
function _pmfSlideTo(el, from, cx, cy, scale, dur, fade) {
  const dx = cx - from.cx, dy = (cy == null) ? 0 : cy - from.cy;
  const kf = fade
    ? [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * .55}px,${dy * .55}px) scale(${1 - (1 - scale) * .5})`, opacity: .55, offset: .5 }, { transform: `translate(${dx}px,${dy}px) scale(${scale})`, opacity: 0 }]
    : [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px,${dy}px) scale(${scale})` }];
  return _pmfAnim(el, kf, { duration: dur, easing: 'cubic-bezier(.55,0,.15,1)', fill: 'forwards' });
}

// ── Slide: two steps, the shapes melt ───────────────────────────────────────
async function _pmfSlide(handScore, pips, mult, speed, sig, p, o) {
  const { wrap, boxes, times } = p;
  const [pipsB, multB, focusB] = boxes;
  const J = PMF_CFG.jitter / speed, M = PMF_CFG.merge / speed, S = PMF_CFG.settle / speed;
  const bail = () => { if (sig && sig.aborted) { pmfResetNow(); return true; } return false; };
  _pmfEnsureGoo();
  wrap.classList.add('pmf-two');
  const merged = _pmfEnsureMerged(wrap);
  merged.classList.remove('show', 'pmf-gold', 'pmf-jitter');

  // ── step 1: PIPS and MULT ──
  _pmfJit([pipsB, multB], true);
  if (typeof sfxScoreTick === 'function') sfxScoreTick();
  await _pmfWait(J); if (bail()) return false;
  _pmfJit([pipsB, multB], false);
  const a = _pmfRel(pipsB, wrap), b = _pmfRel(multB, wrap);
  const c1x = (a.cx + b.cx) / 2, c1y = a.cy;
  const goo = _pmfGooLayer(wrap);
  const blobs1 = [a, b].map(r => _pmfBlob(goo, r));
  blobs1.forEach((bl, i) => _pmfSlideTo(bl, [a, b][i], c1x, null, .92, M, false));
  _pmfSlideTo(pipsB, a, c1x, null, .5, M, true);
  _pmfSlideTo(multB, b, c1x, null, .5, M, true);
  if (times[0]) _pmfAnim(times[0], [{ opacity: 1 }, { opacity: 0 }], { duration: M * .5, fill: 'forwards' });
  // The fused chip grows where the blobs meet, a little before they have fully landed.
  const w1 = Math.min(wrap.offsetWidth - 8, a.w * 1.3);
  merged.style.left = (c1x - w1 / 2) + 'px'; merged.style.width = w1 + 'px';
  merged.querySelector('.pmf-merged-val').textContent = _pmfFmt(pips * mult);
  merged.classList.add('pmf-step1');
  wrap.style.setProperty('--pmf-dur', Math.round(M * .6) + 'ms');
  await _pmfWait(M * .45); if (bail()) return false;
  void merged.offsetWidth; merged.classList.add('show');
  if (typeof sfxFocusBeat === 'function') sfxFocusBeat();
  await _pmfWait(M * .55 + S); if (bail()) return false;
  blobs1.forEach(bl => _pmfAnim(bl, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 / speed, fill: 'forwards' }));

  // ── step 2 (r708): FOCUS applies onto the product where it stands, once per application ──
  blobs1.forEach(bl => bl.remove());
  const steps = _pmfFocusSteps(handScore, pips, mult, o);
  for (const st of steps) {
    // The copies are spent first, back to front; the figure itself last.
    const src = _pmfFCopies.length ? _pmfFCopies.pop() : focusB;
    if (src !== focusB) _pmfFSpent.push(src);
    const last = st.k === st.n;
    _pmfJit([merged, src], true);
    if (typeof sfxScoreTick === 'function') sfxScoreTick();
    await _pmfWait(st.k === 1 ? J : J * .6); if (bail()) return false;
    _pmfJit([merged, src], false);
    const m = _pmfRel(merged, wrap), f = _pmfRel(src, wrap);
    const bl = _pmfBlob(goo, f, 'pmf-blob-gold');
    _pmfSlideTo(bl, f, m.cx, m.cy, .6, M * .8, true);
    _pmfSlideTo(src, f, m.cx, m.cy, .5, M * .8, true);
    if (last && times[1]) _pmfAnim(times[1], [{ opacity: 1 }, { opacity: 0 }], { duration: M * .5, fill: 'forwards' });
    if (last) {
      const w2 = Math.min(wrap.offsetWidth - 8, a.w * 1.5);
      _pmfAnim(merged, [{ left: m.x + 'px', width: m.w + 'px' }, { left: (m.cx - w2 / 2) + 'px', width: w2 + 'px' }],
        { duration: M * .8, easing: 'cubic-bezier(.55,0,.15,1)', fill: 'forwards' });
    }
    await _pmfWait(M * .5); if (bail()) return false;
    merged.querySelector('.pmf-merged-val').textContent = _pmfFmt(st.val);
    if (last) { merged.classList.remove('pmf-step1'); merged.classList.add('pmf-gold'); }
    _pmfAnim(merged.querySelector('.pmf-merged-val'), [{ transform: 'scale(.8)' }, { transform: 'scale(1.18)', offset: .45 }, { transform: 'scale(1)' }], { duration: 320 / speed, easing: 'ease-out' });
    if (st.k > 1 && typeof sfxFocusAgain === 'function') sfxFocusAgain(st.k - 1); else if (typeof sfxFocusBeat === 'function') sfxFocusBeat();
    await _pmfWait(M * .3 + S); if (bail()) return false;
    _pmfAnim(bl, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 / speed, fill: 'forwards' });
  }
  _pmfFlyFrom = merged; _pmfFlyText = _pmfFmt(handScore);
  return true;
}

// ── Hold: nothing moves, the numbers hand on (console mode) ────────────────
async function _pmfHold(handScore, pips, mult, speed, sig, p, o) {
  const { boxes, times } = p;
  const [pipsB, multB, focusB] = boxes;
  const pv = document.getElementById('pips-val'), mv = document.getElementById('mult-val'), fv = document.getElementById('focus-val');
  if (!pv || !mv || !fv) return false;
  const J = PMF_CFG.jitter / speed, H = PMF_CFG.hold / speed, S = PMF_CFG.settle / speed;
  const bail = () => { if (sig && sig.aborted) { pmfResetNow(); return true; } return false; };
  _pmfHoldSaved = { pips: pv.textContent, mult: mv.textContent, focus: fv.textContent };
  const pop = el => { el.classList.remove('subbox-pop'); void el.offsetWidth; el.classList.add('subbox-pop'); };

  // ── step 1: PIPS fades, MULT holds the product ──
  _pmfJitVal([pv, mv], true);
  if (typeof sfxScoreTick === 'function') sfxScoreTick();
  await _pmfWait(J); if (bail()) return false;
  _pmfJitVal([pv, mv], false);
  _pmfAnim(pv, [{ opacity: 1 }, { opacity: .12 }], { duration: H, fill: 'forwards' });
  if (times[0]) _pmfAnim(times[0], [{ opacity: 1 }, { opacity: .15 }], { duration: H, fill: 'forwards' });
  await _pmfWait(H * .5); if (bail()) return false;
  mv.textContent = _pmfFmt(pips * mult); pop(multB);
  if (typeof sfxFocusBeat === 'function') sfxFocusBeat();
  await _pmfWait(H * .5 + S); if (bail()) return false;

  // ── step 2 (r708): FOCUS applies onto MULT's number, once per application ──
  const steps = _pmfFocusSteps(handScore, pips, mult, o);
  for (const st of steps) {
    const copy = _pmfFCopies.length ? _pmfFCopies.pop() : null;
    if (copy) _pmfFSpent.push(copy);
    const src = copy || fv, last = st.k === st.n;
    _pmfJitVal([src, mv], true);
    if (typeof sfxScoreTick === 'function') sfxScoreTick();
    await _pmfWait(st.k === 1 ? J : J * .6); if (bail()) return false;
    _pmfJitVal([src, mv], false);
    _pmfAnim(src, [{ opacity: 1 }, { opacity: copy ? 0 : .12 }], { duration: H, fill: 'forwards' });
    if (last && times[1]) _pmfAnim(times[1], [{ opacity: 1 }, { opacity: .15 }], { duration: H, fill: 'forwards' });
    await _pmfWait(H * .5); if (bail()) return false;
    mv.textContent = _pmfFmt(st.val); pop(multB);
    if (last) mv.classList.add('pmf-hold-score');
    if (st.k > 1 && typeof sfxFocusAgain === 'function') sfxFocusAgain(st.k - 1); else if (typeof sfxFocusBeat === 'function') sfxFocusBeat();
    await _pmfWait(H * .5 + S); if (bail()) return false;
  }
  _pmfFlyFrom = multB; _pmfFlyText = _pmfFmt(handScore);
  return true;
}

// ── Carry: one number leaves its tray and is carried into the next (r721) ─────
// Step 1 carries PIPS into MULT, which then reads pips x mult. Step 2 carries Focus:
// resolving in the MIDDLE, each Focus copy and then the figure is carried into MULT,
// once per application; resolving in FOCUS, MULT's product is carried into FOCUS and
// then each copy into the figure. The number that leaves is a copy of the value
// (`.pmf-carry`, a child of #score-subboxes, so in console mode it moves inside the one
// shared screen, under the screen door); the value it left is faded out, and the tray it
// lands in writes the new number the moment the copy is gone. Five flights:
//   rise    the number rises, then flies to the tray, fading out completely on arrival.
//   stamp   it lifts high and large, travels over the tray and slams down into it.
//   stream  it breaks into its digits, which pour along an arc; the tray counts up as they land.
//   zap     a bolt of the number's colour jumps across; the tray scrambles, then locks.
//   roll    it slides along the foot of the screen; the tray's number rolls up and out
//           as the new one rolls up in, like an odometer.
const PMF_CARRY_MS = { rise: 560, stamp: 600, stream: 640, zap: 420, roll: 480 };

function _pmfFlier(src, wrap, text, scale) {
  const r = _pmfRel(src, wrap), cs = getComputedStyle(src);
  const el = document.createElement('div');
  el.className = 'subbox-val pmf-carry';
  el.textContent = text == null ? src.textContent : text;
  el.style.left = (r.cx - wrap.clientLeft) + 'px';
  el.style.top = (r.cy - wrap.clientTop) + 'px';
  el.style.color = cs.color; el.style.setProperty('--pmf-c', cs.color);   // console mode reads --pmf-c (its value colours are !important)
  el.style.fontSize = (parseFloat(cs.fontSize) * (scale || 1)) + 'px';
  wrap.appendChild(el); _pmfFliers.push(el);
  return { el, r };
}
function _pmfNum(t) { const v = parseFloat(String(t || '').replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : 0; }
function _pmfPopVal(el, big) {
  _pmfAnim(el, [{ transform: `scale(${big ? 1.5 : 1.25})`, filter: 'brightness(1.8)' }, { transform: 'scale(1)', filter: 'brightness(1)' }],
    { duration: big ? 380 : 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
function _pmfSound(k) {
  if (k > 1 && typeof sfxFocusAgain === 'function') sfxFocusAgain(k - 1);
  else if (typeof sfxFocusBeat === 'function') sfxFocusBeat();
}

// The flights. Each moves the copy from the source to the destination's centre and resolves
// when the destination should read the new number; `land(text)` writes it (a look that writes
// its own way, counting or scrambling, writes it itself and calls land() with nothing).
const PMF_FLIGHT = {
  rise({ fl, a, b, F, land, text }) {
    const H = Math.max(5, Math.min(a.h * .3, 12)), dx = b.cx - a.cx, dy = b.cy - a.cy;
    _pmfAnim(fl.el, [
      { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: 1, easing: 'cubic-bezier(.2,.7,.3,1)' },
      { transform: `translate(-50%,-50%) translate(0,${-H}px) scale(1.12)`, opacity: 1, offset: .3, easing: 'cubic-bezier(.45,0,.55,1)' },
      { transform: `translate(-50%,-50%) translate(${dx * .55}px,${dy * .55 - H * 1.15}px) scale(1)`, opacity: .55, offset: .66, easing: 'cubic-bezier(.4,0,.8,.6)' },
      { transform: `translate(-50%,-50%) translate(${dx}px,${dy - H * .3}px) scale(.82)`, opacity: 0 },
    ], { duration: F, fill: 'forwards' });
    return _pmfWait(F).then(() => land(text));
  },
  stamp({ fl, a, b, F, land, text, dst }) {
    const H = Math.max(5, Math.min(a.h * .28, 11)), dx = b.cx - a.cx, dy = b.cy - a.cy;
    _pmfAnim(fl.el, [
      { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: 1, easing: 'cubic-bezier(.2,.8,.3,1)' },
      { transform: `translate(-50%,-50%) translate(${dx * .1}px,${-H}px) scale(1.3)`, opacity: 1, offset: .32, easing: 'cubic-bezier(.45,0,.55,1)' },
      { transform: `translate(-50%,-50%) translate(${dx}px,${dy - H}px) scale(1.35)`, opacity: .9, offset: .74, easing: 'cubic-bezier(.7,0,1,.6)' },
      { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.7)`, opacity: 0 },
    ], { duration: F, fill: 'forwards' });
    return _pmfWait(F).then(() => {
      land(text, true);
      _pmfAnim(dst, [{ translate: '0 0' }, { translate: '-2px 2px' }, { translate: '2px -1px' }, { translate: '-1px -1px' }, { translate: '0 0' }],
        { duration: 220, easing: 'linear' });
    });
  },
  stream({ fl, a, b, F, land, text, wrap, dst, src }) {
    // The copy is only the measure: its digits each leave from where they sat.
    const chars = [...fl.el.textContent].filter(ch => /[0-9.]/.test(ch)).slice(0, 10);
    const w = fl.el.getBoundingClientRect().width / ((wrap.getBoundingClientRect().width / (wrap.offsetWidth || 1)) || 1);
    fl.el.remove();
    const n = Math.max(1, chars.length), step = w / n, gap = F * .45 / n, fly = F * .55;
    chars.forEach((ch, i) => {
      const p = _pmfFlier(src, wrap, ch, .62);
      const ox = (i - (n - 1) / 2) * step, dx = b.cx - a.cx - ox, dy = b.cy - a.cy, lift = Math.max(5, a.h * .3) + (i % 2) * 3;
      p.el.style.left = (a.cx + ox - wrap.clientLeft) + 'px';
      _pmfAnim(p.el, [
        { transform: 'translate(-50%,-50%) translate(0,0) scale(1.4)', opacity: 0 },
        { transform: `translate(-50%,-50%) translate(${dx * .15}px,${-lift * .6}px) scale(1.2)`, opacity: 1, offset: .18 },
        { transform: `translate(-50%,-50%) translate(${dx * .6}px,${dy * .6 - lift}px) scale(1)`, opacity: .8, offset: .6 },
        { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.5)`, opacity: 0 },
      ], { duration: fly, delay: i * gap, easing: 'cubic-bezier(.35,.1,.6,1)', fill: 'both' });
    });
    // The tray counts up from what it read as the digits land.
    const from = _pmfNum(dst.textContent), to = _pmfNum(text), t0 = performance.now() + fly * .7, span = F - fly * .7;
    return new Promise(res => {
      const id = setInterval(() => {
        const t = Math.min(1, Math.max(0, (performance.now() - t0) / span));
        if (t > 0) dst.textContent = _pmfFmt(from + (to - from) * (1 - Math.pow(1 - t, 2)));
        if (t >= 1) { clearInterval(id); land(text); res(); }
      }, 30);
      _pmfTimers.push({ id, res });
    });
  },
  zap({ fl, a, b, F, land, text, wrap, dst }) {
    // A jagged bolt from the source to the tray, flickering; the source goes out with it.
    fl.el.style.opacity = '0';
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'pmf-zap'); svg.style.color = fl.el.style.getPropertyValue('--pmf-c') || fl.el.style.color;
    const W = wrap.clientWidth, Hh = wrap.clientHeight; svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
    const pl = document.createElementNS(ns, 'polyline'); svg.appendChild(pl); wrap.appendChild(svg); _pmfFliers.push(svg);
    const x0 = a.cx - wrap.clientLeft, y0 = a.cy - wrap.clientTop, x1 = b.cx - wrap.clientLeft, y1 = b.cy - wrap.clientTop;
    const bolt = () => { const pts = []; for (let i = 0; i <= 7; i++) { const t = i / 7, j = (i && i < 7) ? (fxRand() - .5) * a.h * .7 : 0; pts.push(`${(x0 + (x1 - x0) * t).toFixed(1)},${(y0 + (y1 - y0) * t + j).toFixed(1)}`); } pl.setAttribute('points', pts.join(' ')); };
    bolt();
    const zapT = F * .5, scr = text.replace(/[0-9]/g, '#'), t0 = performance.now();
    return new Promise(res => {
      const id = setInterval(() => {
        const t = performance.now() - t0;
        if (t < zapT) { bolt(); svg.style.opacity = (fxRand() < .25 ? .25 : 1); }
        else svg.style.opacity = String(Math.max(0, 1 - (t - zapT) / (F * .2)));
        // The tray scrambles from the bolt's middle until the end, then locks.
        if (t > zapT * .5 && t < F) dst.textContent = scr.replace(/#/g, () => String(Math.floor(fxRand() * 10)));
        if (t >= F) { clearInterval(id); svg.remove(); land(text); res(); }
      }, 40);
      _pmfTimers.push({ id, res });
    });
  },
  roll({ fl, a, b, F, land, text, dst }) {
    const low = Math.max(4, a.h * .22), dx = b.cx - a.cx, dy = b.cy - a.cy;
    _pmfAnim(fl.el, [
      { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(-50%,-50%) translate(0,${low}px) scale(.8)`, opacity: 1, offset: .2 },
      { transform: `translate(-50%,-50%) translate(${dx}px,${dy + low}px) scale(.8)`, opacity: 0 },
    ], { duration: F * .65, easing: 'cubic-bezier(.4,0,.5,1)', fill: 'forwards' });
    const R = F * .35, up = Math.max(10, a.h * .6);
    return _pmfWait(F * .55).then(() => {
      _pmfAnim(dst, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-up}px)`, opacity: 0 }], { duration: R * .5, easing: 'ease-in', fill: 'forwards' });
      return _pmfWait(R * .5);
    }).then(() => {
      dst.getAnimations().forEach(x => { try { x.cancel(); } catch (e) {} });
      land(text, false, true);
      _pmfAnim(dst, [{ transform: `translateY(${up}px)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: R * .5, easing: 'cubic-bezier(.2,.8,.3,1)' });
      return _pmfWait(R * .5);
    });
  },
};
const fxRand = () => (typeof fxRandom === 'function' ? fxRandom() : Math.random());

async function _pmfCarry(handScore, pips, mult, speed, sig, p, o, look) {
  const { wrap, times } = p;
  const pv = document.getElementById('pips-val'), mv = document.getElementById('mult-val'), fv = document.getElementById('focus-val');
  if (!pv || !mv || !fv) return false;
  const J = PMF_CFG.jitter * .7 / speed, S = PMF_CFG.settle / speed, F = (PMF_CARRY_MS[look] || 520) / speed;
  const gen = _pmfGen;
  const bail = () => { if (gen !== _pmfGen) return true; if (sig && sig.aborted) { pmfResetNow(); return true; } return false; };
  _pmfHoldSaved = { pips: pv.textContent, mult: mv.textContent, focus: fv.textContent };
  const toFocus = pmfResolve === 'focus';
  const flight = PMF_FLIGHT[look] || PMF_FLIGHT.rise;

  // One carry: src's number leaves, dst reads `text` once it has arrived.
  const carry = async (src, dst, text, k, last, first) => {
    _pmfJitVal([src, dst], true);
    if (typeof sfxScoreTick === 'function') sfxScoreTick();
    await _pmfWait(first ? J : J * .6); if (bail()) return false;
    _pmfJitVal([src, dst], false);
    const fl = _pmfFlier(src, wrap);
    const a = fl.r, b = _pmfRel(dst, wrap);
    // the number has left: its own value goes dark (a spent Focus copy goes for good)
    _pmfAnim(src, [{ opacity: 1 }, { opacity: 0 }], { duration: 80, fill: 'forwards' });
    const land = (t, big, quiet) => {
      if (gen !== _pmfGen) return;
      if (t != null) dst.textContent = t;
      if (last) dst.classList.add('pmf-hold-score');
      if (!quiet) _pmfPopVal(dst, big || last);
      _pmfSound(k);
    };
    const n0 = _pmfFliers.length - 1;
    await flight({ fl, a, b, F, land, text, wrap, src, dst });
    _pmfFliers.splice(n0).forEach(el => { try { el.remove(); } catch (e) {} });   // this carry's copies (a stream's digits too)
    if (bail()) return false;
    await _pmfWait(S);
    return !bail();
  };

  // ── step 1: PIPS into MULT ──
  if (!(await carry(pv, mv, _pmfFmt(pips * mult), 1, false, true))) return false;
  if (times[0]) _pmfAnim(times[0], [{ opacity: 1 }, { opacity: .35 }], { duration: 200 / speed, fill: 'forwards' });

  // ── step 2: Focus, once per application ──
  const steps = _pmfFocusSteps(handScore, pips, mult, o);
  for (const st of steps) {
    const last = st.k === st.n;
    let src, dst;
    if (toFocus) {
      dst = fv;
      if (st.k === 1) src = mv;
      else { src = _pmfFCopies.pop() || null; if (src) _pmfFSpent.push(src); }
    } else {
      dst = mv;
      src = _pmfFCopies.pop() || null;
      if (src) _pmfFSpent.push(src); else src = fv;
    }
    if (!src) { dst.textContent = _pmfFmt(st.val); if (last) dst.classList.add('pmf-hold-score'); continue; }
    if (!(await carry(src, dst, _pmfFmt(st.val), st.k, last, st.k === 1))) return false;
  }
  if (times[1]) _pmfAnim(times[1], [{ opacity: 1 }, { opacity: .35 }], { duration: 200 / speed, fill: 'forwards' });
  _pmfFlyFrom = toFocus ? p.boxes[2] : p.boxes[1]; _pmfFlyText = _pmfFmt(handScore);
  return true;
}

// ── One step: the r157 look ─────────────────────────────────────────────────
async function _pmfOne(handScore, speed, sig, p) {
  const { wrap, boxes } = p;
  boxes.forEach(b => b.classList.remove('subbox-pop'));
  _pmfJit(boxes, true);
  if (typeof sfxScoreTick === 'function') sfxScoreTick();
  await _pmfWait(PMF_CFG.jitter / speed);
  if (sig && sig.aborted) { pmfResetNow(); return false; }
  _pmfJit(boxes, false);
  const wr = wrap.getBoundingClientRect();
  const cx = wr.left + wr.width / 2;
  boxes.forEach(b => { const r = b.getBoundingClientRect(); b.style.setProperty('--pmf-dx', Math.round(cx - (r.left + r.width / 2)) + 'px'); });
  const merged = _pmfEnsureMerged(wrap);
  merged.classList.remove('pmf-step1'); merged.classList.add('pmf-gold');
  merged.querySelector('.pmf-merged-val').textContent = _pmfFmt(handScore);
  wrap.style.setProperty('--pmf-dur', Math.round(PMF_CFG.merge / speed) + 'ms');
  void merged.offsetWidth;
  wrap.classList.add('pmf-merging');
  merged.classList.add('show');
  if (typeof sfxFocusBeat === 'function') sfxFocusBeat();
  await _pmfWait((PMF_CFG.merge + PMF_CFG.settle) / speed);
  if (sig && sig.aborted) { pmfResetNow(); return false; }
  _pmfFlyFrom = merged; _pmfFlyText = _pmfFmt(handScore);
  return true;
}

// Jitter → fuse → the fused number is ready to fly. `opts.pips` / `opts.mult`
// are the chips' landed totals; without them the one-step look runs.
// `speed` divides every duration so the merge keeps pace with a fast-forwarded dance.
async function pmfMergeIn(handScore, opts) {
  const o = opts || {};
  const speed = Math.max(0.25, o.speed || 1);
  const sig = o.signal;
  const p = _pmfParts();
  if (!_pmfVisible(p)) { pmfFocusCopiesClear(); return false; }
  const keep = _pmfFCopies.slice(); _pmfFCopies = [];   // the reset below must not take the copies this hand will spend
  pmfResetNow();
  _pmfFCopies = keep.filter(el => el.isConnected);
  _pmfActive = true;
  // A pop animation still running would beat the merge on the same property.
  p.boxes.forEach(b => b.classList.remove('subbox-pop'));
  const twoStep = typeof o.pips === 'number' && typeof o.mult === 'number';
  _pmfMode = twoStep ? pmfLook() : 'one';
  if (PMF_CARRY.includes(_pmfMode)) return _pmfCarry(handScore, o.pips, o.mult, speed, sig, p, o, _pmfMode);
  if (_pmfMode === 'hold') return _pmfHold(handScore, o.pips, o.mult, speed, sig, p, o);
  if (_pmfMode === 'slide') return _pmfSlide(handScore, o.pips, o.mult, speed, sig, p, o);
  return _pmfOne(handScore, speed, sig, p);
}

// The fused number FLIES to the SCORE total (r173). This is the beat the owner
// asked to be unskippable: however hurried a hand's animation gets, the number it
// made must always be seen leaving the row and landing on the score.
//
// A body-level fixed ghost with no id and no pointer events, like a flying card:
// the row can re-render underneath, and in console mode the housing's observer
// takes it under the mask (mcIsFlier), so it shows only through the screens.
async function pmfFlyToScore(opts) {
  const o = opts || {};
  const speed = Math.max(0.25, o.speed || 1);
  const target = document.getElementById('score-total-num');
  const src = _pmfFlyFrom;
  if (!target || !src || !_pmfActive) return false;
  const a = src.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (a.width < 2 || b.width < 1) return false;

  const ghost = document.createElement('div');
  ghost.className = 'pmf-ghost pmf-flying';
  ghost.innerHTML = `<div class="pmf-merged-val">${_pmfFlyText}</div>`;
  ghost.style.cssText = `position:fixed;margin:0;z-index:700;pointer-events:none;transition:none;` +
    `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;transform-origin:center center;`;
  document.body.appendChild(ghost);
  // r234: the fused chip STAYS PUT and a smaller copy peels off to the total:
  // the chip is the receipt, the ghost is the delivery.
  const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
  const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
  const dur = Math.max(110, 380 / speed);
  await new Promise(res => {
    let done = false;
    const fin = () => { if (done) return; done = true; res(); };
    const anim = ghost.animate([
      { transform: 'translate(0,0) scale(0.72)', opacity: 0.95 },
      { transform: `translate(${dx * 0.62}px, ${dy * 0.62}px) scale(0.56)`, opacity: 1, offset: 0.65 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.24)`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' });
    anim.onfinish = fin;
    setTimeout(fin, dur + 160);          // rAF is throttled to zero in a background tab
  });
  ghost.remove();
  const box = document.getElementById('score-mid') || document.getElementById('score-center');
  if (box) { box.classList.remove('box-popping'); void box.offsetWidth; box.classList.add('box-popping'); }
  if (typeof sfxScoreTick === 'function') sfxScoreTick();
  return true;
}

// The row comes back as three chips.
async function pmfSplitOut(opts) {
  const o = opts || {};
  const speed = Math.max(0.25, o.speed || 1);
  const p = _pmfParts();
  if (!p || !_pmfActive) { pmfResetNow(); return; }
  const { wrap, boxes, times } = p;
  const D = PMF_CFG.split / speed;
  if (_pmfMode === 'one') {
    wrap.style.setProperty('--pmf-dur', Math.round(D) + 'ms');
    wrap.classList.remove('pmf-merging');
    if (_pmfMerged) _pmfMerged.classList.remove('show');
    await _pmfWait(D);
  } else if (_pmfMode === 'slide') {
    wrap.style.setProperty('--pmf-dur', Math.round(D * .6) + 'ms');
    if (_pmfMerged) _pmfMerged.classList.remove('show');
    // The chips reappear in place: the slide animations are cancelled (they
    // snap home, unseen at opacity 0) and a fade brings them back.
    _pmfAnims.forEach(a => { try { a.cancel(); } catch (e) {} }); _pmfAnims = [];
    const goo = wrap.querySelector('.pmf-goo'); if (goo) goo.remove();
    [...boxes, ...times].forEach(el => _pmfAnim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: D, easing: 'ease-out' }));
    await _pmfWait(D);
  } else {
    const pv = document.getElementById('pips-val'), mv = document.getElementById('mult-val'), fv = document.getElementById('focus-val');
    _pmfAnims.forEach(a => { try { a.cancel(); } catch (e) {} }); _pmfAnims = [];
    _pmfFliers.forEach(el => { try { el.remove(); } catch (e) {} }); _pmfFliers = [];
    _pmfFCopies.concat(_pmfFSpent).forEach(el => { try { el.remove(); } catch (e) {} }); _pmfFCopies = []; _pmfFSpent = [];
    if (_pmfHoldSaved) { if (pv) pv.textContent = _pmfHoldSaved.pips; if (mv) mv.textContent = _pmfHoldSaved.mult; if (fv) fv.textContent = _pmfHoldSaved.focus; }
    if (fv) fv.classList.remove('pmf-hold-score');
    if (mv) mv.classList.remove('pmf-hold-score');
    [pv, mv, fv, ...times].forEach(el => { if (el) _pmfAnim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: D, easing: 'ease-out' }); });
    await _pmfWait(D);
  }
  pmfResetNow();
}

// Instant, unconditional teardown. Called on every dance abort: an interrupted
// hand must never leave the row fused, because the next hand writes its numbers
// into chips the player cannot see.
function pmfResetNow() {
  _pmfGen++;
  _pmfActive = false; _pmfFlyFrom = null;
  _pmfAnims.forEach(a => { try { a.cancel(); } catch (e) {} }); _pmfAnims = [];
  pmfFocusCopiesClear();
  _pmfFliers.forEach(el => { try { el.remove(); } catch (e) {} }); _pmfFliers = [];
  const tm = _pmfTimers; _pmfTimers = [];
  tm.forEach(t => { clearInterval(t.id); t.res(); });   // a cut carry's wait ends (its caller then sees the abort)
  // A cut hold or carry look puts the chips' own figures back.
  if (_pmfHoldSaved) {
    const pv = document.getElementById('pips-val'), mv = document.getElementById('mult-val'), fv = document.getElementById('focus-val');
    if (pv) pv.textContent = _pmfHoldSaved.pips; if (mv) mv.textContent = _pmfHoldSaved.mult; if (fv) fv.textContent = _pmfHoldSaved.focus;
    _pmfHoldSaved = null;
  }
  const p = _pmfParts();
  if (p) {
    p.wrap.classList.remove('pmf-merging', 'pmf-two');
    p.wrap.style.removeProperty('--pmf-dur');
    p.boxes.forEach(b => { b.classList.remove('pmf-jitter'); b.style.removeProperty('--pmf-dx'); });
    const goo = p.wrap.querySelector('.pmf-goo'); if (goo) goo.remove();
    ['pips-val', 'mult-val', 'focus-val'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('pmf-jit-val', 'pmf-hold-score'); });
  }
  if (_pmfMerged) {
    _pmfMerged.classList.remove('show', 'pmf-jitter', 'pmf-step1', 'pmf-gold');
    _pmfMerged.getAnimations().forEach(a => a.cancel());
    _pmfMerged.style.removeProperty('left'); _pmfMerged.style.removeProperty('width');
  }
  _pmfMode = null;
}

// Dev -> Aesthetics -> Score merge -> Preview: the whole beat on the live row with whatever
// the chips read (40 x 6 x the Focus shown when they read 0). r721: `look` plays one look
// without choosing it; `o.focusN` stacks that many Focus applications (copies in the tray);
// `o.pips` / `o.mult` / `o.focus` set the numbers.
let _pmfPreviewing = false;
async function pmfPreview(look, o) {
  o = o || {};
  if (_pmfPreviewing) return;
  if (typeof toggleDevPanel === 'function' && document.getElementById('dev-panel')?.classList.contains('show')) toggleDevPanel();
  const pv = document.getElementById('pips-val'), mv = document.getElementById('mult-val'), fv = document.getElementById('focus-val');
  if (!pv || !mv || !fv) return;
  _pmfPreviewing = true;
  const keep = pmfLookChoice;
  if (look && PMF_LOOKS.includes(look)) pmfLookChoice = look;
  const was = { pips: pv.textContent, mult: mv.textContent, focus: fv.textContent };
  try {
    const pips = o.pips || parseFloat(pv.textContent.replace(/,/g, '')) || 40, mult = o.mult || parseFloat(mv.textContent.replace(/,/g, '')) || 6;
    const focus = o.focus || parseFloat((fv.textContent || '').replace(/[^0-9.]/g, '')) || 1;
    const n = Math.max(1, Math.round(o.focusN || 1));
    pv.textContent = _pmfFmt(pips); mv.textContent = _pmfFmt(mult); fv.textContent = '×' + focus;
    const total = Math.round(pips * mult * Math.pow(focus, n));
    await _pmfWait(200);
    for (let k = 1; k < n; k++) { pmfFocusCopyAdd(k); await _pmfWait(160); }
    if (await pmfMergeIn(total, { speed: 1, pips, mult, focus, focusN: n })) {
      await pmfFlyToScore({ speed: 1 });
      await _pmfWait(300);
      await pmfSplitOut({ speed: 1 });
    }
  } finally {
    pmfLookChoice = keep;
    pmfResetNow();
    pv.textContent = was.pips; mv.textContent = was.mult; fv.textContent = was.focus;
    _pmfPreviewing = false;
  }
}
document.addEventListener('DOMContentLoaded', () => { setPmfLook(pmfLookChoice); setPmfResolve(pmfResolve); });

// ── The lab page: index.html?merge (r721) ────────────────────────────────────
// Starts a Classic run and shows a key per look: a tap plays it on the real score row.
// MIDDLE / FOCUS says where the carry looks end; x1 / x2 / x3 how many times Focus
// applies; USE THIS keeps the last look played. Nothing else is stored.
let _pmfLabLast = null, _pmfLabN = 1;
function pmfLabOpen() {
  if (document.getElementById('pmf-lab')) return;
  const p = document.createElement('div'); p.id = 'pmf-lab';
  const looks = PMF_LOOKS.filter(k => k !== 'auto');
  p.innerHTML = `<div class="bl-head">SCORE MERGE <span class="bl-now"></span></div>`
    + `<div class="bl-row">${looks.map((k, i) => `<button class="bl-b" data-look="${k}">${i + 1} ${PMF_LOOK_NAMES[k]}</button>`).join('')}</div>`
    + `<div class="bl-row"><span class="bl-lab">RESOLVES IN</span><button class="bl-b" data-pmf-resolve="mid">MIDDLE</button><button class="bl-b" data-pmf-resolve="focus">FOCUS</button>`
    + `<span class="bl-lab">FOCUS APPLIES</span>${[1, 2, 3].map(n => `<button class="bl-b" data-n="${n}">×${n}</button>`).join('')}</div>`
    + `<div class="bl-row"><button class="bl-b bl-use" id="pl-use">USE THIS</button><button class="bl-b" id="pl-home" onclick="location.href='index.html'">EXIT</button></div>`
    + `<div class="bl-note">Tap a look to play it on the score row (48 × 12 × 1.5). The first five carry a number from tray to tray; MIDDLE / FOCUS is where they end. USE THIS keeps the last one you played.</div>`;
  document.body.appendChild(p);
  const paint = () => {
    p.querySelector('.bl-now').textContent = 'now: ' + PMF_LOOK_NAMES[pmfLookChoice] + (PMF_CARRY.includes(pmfLook()) ? ' · ends in ' + (pmfResolve === 'focus' ? 'FOCUS' : 'MIDDLE') : '');
    p.querySelectorAll('.bl-b[data-look]').forEach(b => { b.classList.toggle('bl-on', b.dataset.look === pmfLook()); b.classList.toggle('bl-last', b.dataset.look === _pmfLabLast); });
    p.querySelectorAll('.bl-b[data-n]').forEach(b => b.classList.toggle('on', +b.dataset.n === _pmfLabN));
    setPmfResolve(pmfResolve);
  };
  p.addEventListener('click', e => {
    const b = e.target.closest('.bl-b'); if (!b) return;
    if (b.dataset.look) { _pmfLabLast = b.dataset.look; paint(); pmfPreview(b.dataset.look, { pips: 48, mult: 12, focus: 1.5, focusN: _pmfLabN }); }
    else if (b.dataset.pmfResolve) { setPmfResolve(b.dataset.pmfResolve); paint(); }
    else if (b.dataset.n) { _pmfLabN = +b.dataset.n; paint(); }
    else if (b.id === 'pl-use' && _pmfLabLast) { setPmfLook(_pmfLabLast); paint(); }
  });
  paint();
}
(function () {
  if (!/[?&]merge\b/.test(location.search)) return;
  try { window.insightsOn = () => false; } catch (e) {}
  window.addEventListener('load', () => setTimeout(() => {
    try { devStartMode('normal'); } catch (e) { try { ACTIVE_MODE = MODES.normal; startGame(); } catch (e2) {} }
    setTimeout(() => {
      try { tutorialEnd(); } catch (e) {}
      pmfLabOpen();
      setInterval(() => { try { if (typeof roundSeconds === 'number' && roundSeconds < 600) { roundSeconds = 3599; roundStartSeconds = 3599; updateClockUI?.(); } } catch (e) {} }, 1000);
    }, 2500);
  }, 1200));
})();
