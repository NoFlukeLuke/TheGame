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
const PMF_LOOKS = ['auto', 'slide', 'hold', 'one'];
const PMF_DEFAULT = 'auto';

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
  return (typeof trayMachineOn === 'function' && trayMachineOn()) ? 'hold' : 'slide';
}

let _pmfMerged = null;     // the fused chip element (created once, reused)
let _pmfActive = false;
let _pmfMode = null;       // the look the live merge is using
let _pmfFlyFrom = null;    // the element the ghost leaves from
let _pmfFlyText = '';      // what the ghost reads
let _pmfHoldSaved = null;  // hold look: the values' texts before the merge
let _pmfAnims = [];        // WAAPI animations the merge owns (cancelled on reset)

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
async function _pmfSlide(handScore, pips, mult, speed, sig, p) {
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

  // ── step 2: the product and FOCUS ──
  _pmfJit([merged, focusB], true);
  if (typeof sfxScoreTick === 'function') sfxScoreTick();
  await _pmfWait(J); if (bail()) return false;
  _pmfJit([merged, focusB], false);
  blobs1.forEach(bl => bl.remove());
  const m = _pmfRel(merged, wrap), f = _pmfRel(focusB, wrap);
  const c2x = wrap.offsetWidth / 2;
  const blobs2 = [m, f].map(r => _pmfBlob(goo, r, 'pmf-blob-gold'));
  blobs2.forEach((bl, i) => _pmfSlideTo(bl, [m, f][i], c2x, null, .95, M, false));
  _pmfSlideTo(focusB, f, c2x, null, .5, M, true);
  if (times[1]) _pmfAnim(times[1], [{ opacity: 1 }, { opacity: 0 }], { duration: M * .5, fill: 'forwards' });
  const w2 = Math.min(wrap.offsetWidth - 8, a.w * 1.7);
  // The chip itself travels (left and width are animated, so the number stays
  // centred in it) and takes the score half way, with a bump.
  _pmfAnim(merged, [{ left: m.x + 'px', width: m.w + 'px' }, { left: (c2x - w2 / 2) + 'px', width: w2 + 'px' }],
    { duration: M, easing: 'cubic-bezier(.55,0,.15,1)', fill: 'forwards' });
  await _pmfWait(M * .5); if (bail()) return false;
  merged.querySelector('.pmf-merged-val').textContent = _pmfFmt(handScore);
  merged.classList.remove('pmf-step1'); merged.classList.add('pmf-gold');
  _pmfAnim(merged.querySelector('.pmf-merged-val'), [{ transform: 'scale(.8)' }, { transform: 'scale(1.18)', offset: .45 }, { transform: 'scale(1)' }], { duration: 320 / speed, easing: 'ease-out' });
  if (typeof sfxFocusBeat === 'function') sfxFocusBeat();
  await _pmfWait(M * .5 + S); if (bail()) return false;
  blobs2.forEach(bl => _pmfAnim(bl, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 / speed, fill: 'forwards' }));
  _pmfFlyFrom = merged; _pmfFlyText = _pmfFmt(handScore);
  return true;
}

// ── Hold: nothing moves, the numbers hand on (console mode) ────────────────
async function _pmfHold(handScore, pips, mult, speed, sig, p) {
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

  // ── step 2: MULT fades, FOCUS holds the score ──
  _pmfJitVal([mv, fv], true);
  if (typeof sfxScoreTick === 'function') sfxScoreTick();
  await _pmfWait(J); if (bail()) return false;
  _pmfJitVal([mv, fv], false);
  _pmfAnim(mv, [{ opacity: 1 }, { opacity: .12 }], { duration: H, fill: 'forwards' });
  if (times[1]) _pmfAnim(times[1], [{ opacity: 1 }, { opacity: .15 }], { duration: H, fill: 'forwards' });
  await _pmfWait(H * .5); if (bail()) return false;
  fv.textContent = _pmfFmt(handScore); fv.classList.add('pmf-hold-score'); pop(focusB);
  if (typeof sfxFocusBeat === 'function') sfxFocusBeat();
  await _pmfWait(H * .5 + S); if (bail()) return false;
  _pmfFlyFrom = focusB; _pmfFlyText = _pmfFmt(handScore);
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
  if (!_pmfVisible(p)) return false;
  pmfResetNow();
  _pmfActive = true;
  // A pop animation still running would beat the merge on the same property.
  p.boxes.forEach(b => b.classList.remove('subbox-pop'));
  const twoStep = typeof o.pips === 'number' && typeof o.mult === 'number';
  _pmfMode = twoStep ? pmfLook() : 'one';
  if (_pmfMode === 'hold') return _pmfHold(handScore, o.pips, o.mult, speed, sig, p);
  if (_pmfMode === 'slide') return _pmfSlide(handScore, o.pips, o.mult, speed, sig, p);
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
    if (_pmfHoldSaved) { if (pv) pv.textContent = _pmfHoldSaved.pips; if (mv) mv.textContent = _pmfHoldSaved.mult; if (fv) fv.textContent = _pmfHoldSaved.focus; }
    if (fv) fv.classList.remove('pmf-hold-score');
    [pv, mv, ...times].forEach(el => { if (el) _pmfAnim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: D, easing: 'ease-out' }); });
    await _pmfWait(D);
  }
  pmfResetNow();
}

// Instant, unconditional teardown. Called on every dance abort: an interrupted
// hand must never leave the row fused, because the next hand writes its numbers
// into chips the player cannot see.
function pmfResetNow() {
  _pmfActive = false; _pmfFlyFrom = null;
  _pmfAnims.forEach(a => { try { a.cancel(); } catch (e) {} }); _pmfAnims = [];
  const p = _pmfParts();
  if (p) {
    p.wrap.classList.remove('pmf-merging', 'pmf-two');
    p.wrap.style.removeProperty('--pmf-dur');
    p.boxes.forEach(b => { b.classList.remove('pmf-jitter'); b.style.removeProperty('--pmf-dx'); });
    const goo = p.wrap.querySelector('.pmf-goo'); if (goo) goo.remove();
    ['pips-val', 'mult-val', 'focus-val'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('pmf-jit-val', 'pmf-hold-score'); });
  }
  if (_pmfHoldSaved) {
    const fv = document.getElementById('focus-val'); if (fv && fv.classList.contains('pmf-hold-score')) fv.textContent = _pmfHoldSaved.focus;
    _pmfHoldSaved = null;
  }
  if (_pmfMerged) {
    _pmfMerged.classList.remove('show', 'pmf-jitter', 'pmf-step1', 'pmf-gold');
    _pmfMerged.getAnimations().forEach(a => a.cancel());
    _pmfMerged.style.removeProperty('left'); _pmfMerged.style.removeProperty('width');
  }
  _pmfMode = null;
}

// Dev -> Aesthetics -> Score merge -> Preview: the whole beat on the live row
// with whatever the chips read (40 x 6 x the Focus shown when they read 0).
async function pmfPreview() {
  if (typeof toggleDevPanel === 'function' && document.getElementById('dev-panel')?.classList.contains('show')) toggleDevPanel();
  const pv = document.getElementById('pips-val'), mv = document.getElementById('mult-val'), fv = document.getElementById('focus-val');
  if (!pv || !mv || !fv) return;
  const pips = parseFloat(pv.textContent.replace(/,/g, '')) || 40, mult = parseFloat(mv.textContent.replace(/,/g, '')) || 6;
  const focus = parseFloat((fv.textContent || '').replace(/[^0-9.]/g, '')) || 1;
  pv.textContent = pips; mv.textContent = mult;
  const total = Math.round(pips * mult * focus);
  await _pmfWait(200);
  if (!(await pmfMergeIn(total, { speed: 1, pips, mult }))) return;
  await pmfFlyToScore({ speed: 1 });
  await _pmfWait(300);
  await pmfSplitOut({ speed: 1 });
  pv.textContent = '0'; mv.textContent = '0';
}
document.addEventListener('DOMContentLoaded', () => setPmfLook(pmfLookChoice));
