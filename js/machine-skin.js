/* Machine panel, the moving parts (r483; css/skin-machine.css is the look).
   Everything here only acts while trayMachineOn() (dev -> Aesthetics -> Tray look ->
   machine panel); switching the skin off puts the game back exactly.

   1. UNDER THE HOUSING. A flier (a card flying to the hand preview, a score plate, a
      Trick going to its tray...) is a body-level position:fixed element with
      pointer-events:none. Each one is moved into #mc-fly, a full-viewport layer whose
      mask is opaque only over the screens (every window, the board, the Focus gauge,
      the clock) and MC_FLY_GHOST (0) over the housing. So a flier shows on a screen and
      is hidden completely while it passes under the housing between them.
   2. THE FLIP CLOCK. #clock keeps its text (every writer still writes it); the text is
      hidden and #mc-flip, laid over it, shows four split-flap digits that flip when
      they change. Always four digits (leading zero), so the width never changes.
   3. CRISP TEXT. An SVG filter (#mc-crisp) that removes anti-aliasing from readout
      text and adds a phosphor bloom; css/skin-machine.css says which text gets it. */

const MC_FLY_GHOST = 0;      // nothing shows through the housing: it is in front of the screens (owner, r486)
const MC_SCREENS = ['score-center', 'score-left', 'pips-box', 'mult-box', 'focus-box', 'screen-location', 'pmf-merged',
  'knack-carousel-wrap', 'selected-cards', 'trick-tray-area', 'coin-info', 'vclock', 'run-progress', 'grid',
  'focus-bar-outer', 'clock', 'hand-preview-area'];
const mcOn = () => typeof trayMachineOn === 'function' && trayMachineOn();

// ── 1. Fliers go under the housing ───────────────────────────────────────────
let _mcFly = null, _mcFlyRaf = 0, _mcMaskKey = '';
function mcFlyLayer() {
  if (_mcFly && _mcFly.isConnected) return _mcFly;
  _mcFly = document.createElement('div');
  _mcFly.id = 'mc-fly';
  document.body.appendChild(_mcFly);
  return _mcFly;
}
// The mask: MC_FLY_GHOST everywhere (0: the housing hides it), fully opaque over each visible screen.
function mcFlyMask() {
  const layers = [`linear-gradient(rgb(0 0 0 / ${MC_FLY_GHOST}), rgb(0 0 0 / ${MC_FLY_GHOST}))`], sizes = ['100% 100%'], pos = ['0 0'];
  const land = document.getElementById('stage')?.classList.contains('landscape');
  MC_SCREENS.forEach(id => {
    const e = document.getElementById(id);
    if (!e || !e.offsetWidth) return;
    if (land && id === 'hand-preview-area') return;   // a wrapper there; #selected-cards is the screen
    // a screen faded out (the Focus gauge and clock on a pick or reward grid) is housing there
    if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    layers.push('linear-gradient(#000, #000)');
    sizes.push(`${Math.round(r.width)}px ${Math.round(r.height)}px`);
    pos.push(`${Math.round(r.left)}px ${Math.round(r.top)}px`);
  });
  const key = sizes.join() + pos.join();
  if (key === _mcMaskKey) return;
  _mcMaskKey = key;
  const s = _mcFly.style;
  s.webkitMaskImage = s.maskImage = layers.join(', ');
  s.webkitMaskSize = s.maskSize = sizes.join(', ');
  s.webkitMaskPosition = s.maskPosition = pos.join(', ');
}
function mcFlyTick() {
  _mcFlyRaf = 0;
  if (!_mcFly || !_mcFly.childElementCount) return;   // nothing flying: stop
  mcFlyMask();                                          // screens can slide while something flies
  _mcFlyRaf = requestAnimationFrame(mcFlyTick);
}
function mcIsFlier(el) {
  if (!(el instanceof HTMLElement) || el.id || el === _mcFly) return false;
  if (el.closest('#mc-fly')) return false;
  const cs = getComputedStyle(el);
  return cs.position === 'fixed' && cs.pointerEvents === 'none';
}
function mcAdopt(el) {
  const layer = mcFlyLayer();
  layer.appendChild(el);   // fixed stays fixed: a mask makes no containing block
  _mcMaskKey = ''; mcFlyMask();
  if (!_mcFlyRaf) _mcFlyRaf = requestAnimationFrame(mcFlyTick);
}
// An element that flies OUT of a screen (a reward tile going to its tray) lives inside
// the board, which clips. mcFlightClone lifts a copy of it to the body, where the
// observer below takes it under the housing; the original is hidden. Returns the copy
// and the stage zoom, so the caller can divide its viewport-px deltas by it.
function mcFlightClone(el) {
  const r = el.getBoundingClientRect(), z = (r.width / (el.offsetWidth || 1)) || 1;
  const c = el.cloneNode(true);
  c.removeAttribute('id');
  c.style.cssText = `position:fixed;left:${r.left / z}px;top:${r.top / z}px;width:${el.offsetWidth}px;height:${el.offsetHeight}px;` +
    `zoom:${z};margin:0;pointer-events:none;transition:none;transform:none;`;
  mcAdopt(c);   // straight under the housing (a tile's own CSS may not read as a flier)
  el.style.visibility = 'hidden';
  return { el: c, zoom: z };
}
const _mcBodyMo = new MutationObserver(ms => {
  if (!mcOn()) return;
  ms.forEach(m => m.addedNodes.forEach(n => { if (n.parentNode === document.body && mcIsFlier(n)) mcAdopt(n); }));
});

// ── 2. The flip clock ───────────────────────────────────────────────────────
let _mcFlip = null, _mcFlipVal = '', _mcClockMo = null;
function mcClockDigits() {
  const t = (document.getElementById('clock')?.textContent || '').trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  return m ? m[1].padStart(2, '0') + m[2] : null;   // "4:53" -> "0453"
}
function mcFlipBuild() {
  const area = document.getElementById('clock-area'); if (!area) return null;
  if (_mcFlip && _mcFlip.isConnected) return _mcFlip;
  _mcFlip = document.createElement('div');
  _mcFlip.id = 'mc-flip';
  _mcFlip.innerHTML = [0, 1, 'c', 2, 3].map(i => i === 'c' ? '<i class="mcf-colon"></i>'
    : '<b class="mcf-tile"><span class="mcf-top"><span>0</span></span><span class="mcf-bot"><span>0</span></span></b>').join('');
  area.appendChild(_mcFlip);
  _mcFlipVal = '';
  return _mcFlip;
}
function mcFlipPlace() {
  const c = document.getElementById('clock');
  if (!_mcFlip || !c) return;
  _mcFlip.style.left = c.offsetLeft + 'px'; _mcFlip.style.top = c.offsetTop + 'px';
  _mcFlip.style.width = c.offsetWidth + 'px'; _mcFlip.style.height = c.offsetHeight + 'px';
}
function mcFlipSet() {
  if (!mcOn()) return;
  const v = mcClockDigits(), f = mcFlipBuild();
  if (!f) return;
  mcFlipPlace();
  f.classList.toggle('mcf-blank', !v);
  if (!v || v === _mcFlipVal) return;
  const tiles = f.querySelectorAll('.mcf-tile'), old = _mcFlipVal;
  _mcFlipVal = v;
  [...v].forEach((d, i) => {
    const t = tiles[i], was = old ? old[i] : d;
    const top = t.querySelector('.mcf-top span'), bot = t.querySelector('.mcf-bot span');
    if (!old || was === d || document.body.classList.contains('reduced-motion') || !t.animate) {
      top.textContent = d; bot.textContent = d; return;
    }
    // The flap: the old top half falls down over the hinge, then the new bottom half
    // swings into place. The static halves show new-top / old-bottom underneath.
    top.textContent = d;
    const f1 = document.createElement('span'); f1.className = 'mcf-flap mcf-flap-top'; f1.innerHTML = `<span>${was}</span>`;
    const f2 = document.createElement('span'); f2.className = 'mcf-flap mcf-flap-bot'; f2.innerHTML = `<span>${d}</span>`;
    t.append(f1, f2);
    f1.animate([{ transform: 'rotateX(0deg)', filter: 'brightness(1)' }, { transform: 'rotateX(-90deg)', filter: 'brightness(.55)' }],
      { duration: 110, easing: 'ease-in', fill: 'forwards' });
    f2.animate([{ transform: 'rotateX(90deg)', filter: 'brightness(1.4)' }, { transform: 'rotateX(0deg)', filter: 'brightness(1)' }],
      { duration: 130, delay: 110, easing: 'cubic-bezier(.3,1.4,.6,1)', fill: 'backwards' })
      .onfinish = () => { bot.textContent = d; f1.remove(); f2.remove(); };
  });
}
function mcClockWatch() {
  const c = document.getElementById('clock');
  if (!c || _mcClockMo) return;
  _mcClockMo = new MutationObserver(mcFlipSet);
  _mcClockMo.observe(c, { childList: true, characterData: true, subtree: true });
}

// ── 3. Crisp, glowing text ────────────────────────────────────────────────
// Readout text on the screens is drawn with its anti-aliasing thresholded away (every
// pixel fully on or off, so VT323 keeps its hard pixel steps at any zoom), then a soft
// bloom of the same pixels is laid under it: phosphor, not smoothing. #mc-crisp.
// A true live mosaic (sample one pixel per block, grow it) was tried and dropped: it
// cost 60 -> 20 fps on the board and its dilate step erased dark strokes on light faces.
function mcCrispFilter() {
  if (document.getElementById('mc-fx-svg')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'mc-fx-svg'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = `<filter id="mc-crisp" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
    <feComponentTransfer in="SourceGraphic" result="hard"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
    <feGaussianBlur in="hard" stdDeviation="1.8" result="blur"/>
    <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .8 0" result="bloom"/>
    <feMerge><feMergeNode in="bloom"/><feMergeNode in="hard"/></feMerge>
  </filter>`;
  document.body.appendChild(svg);
}

// ── 4. Words on the panel (r486, owner) ────────────────────────────────────
// DISCARD reads DEFER, SWAP and the credits lose their emoji, and the FOCUS screen drops its "x" (the x between the screens
// already says it). Both are text the game rewrites (the reward step relabels the
// key and restores its markup; the dance writes the Focus value), so an observer
// re-applies them after every write. Switching the skin off restores them.
// [element, text in the game, text on the panel]. The game's text is wrapped in a
// .mc-game span with a .mc-panel twin beside it; css/skin-machine.css shows one or the
// other. Nothing is ever deleted, so markup a screen saves and restores (the reward step
// does) carries both words, and switching the skin off needs no undo.
const MC_WORDS = [
  [() => document.getElementById('btn-discard'), 'D\nI\nS\nC\nA\nR\nD', 'D\nE\nF\nE\nR'],
  [() => document.getElementById('swap-indicator'), '\ud83d\udd04', ''],                     // the swap emoji
  [() => document.querySelector('#coin-info .ci-main'), '\ud83d\udcb0', ''],                // the credits emoji
  [() => document.getElementById('coins-display'), '\ud83d\udcb0', ''],                     // portrait's credits
];
function mcWordFix(on) {
  if (on) MC_WORDS.forEach(([get, game, panel]) => {
    const el = get(); if (!el) return;
    [...el.childNodes].forEach(n => {
      if (n.nodeType !== 3 || !n.data.includes(game)) return;
      const i = n.data.indexOf(game), frag = document.createDocumentFragment();
      if (i > 0) frag.append(n.data.slice(0, i));
      const g = document.createElement('span'); g.className = 'mc-game'; g.textContent = game;
      const q = document.createElement('span'); q.className = 'mc-panel'; q.textContent = panel;
      frag.append(g, q);
      if (i + game.length < n.data.length) frag.append(n.data.slice(i + game.length));
      n.replaceWith(frag);
    });
  });
  const f = document.getElementById('focus-val');
  if (f && on && /^[x×]/.test(f.textContent)) f.textContent = f.textContent.replace(/^[x×]\s*/, '');
  if (f && !on && /^\d/.test(f.textContent)) f.textContent = '×' + f.textContent;
}
let _mcWordMo = null;
function mcWordWatch() {
  if (_mcWordMo) return;
  _mcWordMo = new MutationObserver(() => { if (mcOn()) mcWordFix(true); });
  [...MC_WORDS.map(w => w[0]()), document.getElementById('focus-val')].forEach(e => {
    if (e) _mcWordMo.observe(e, { childList: true, characterData: true, subtree: true }); });
}

// ── Switching ───────────────────────────────────────────────────────────────
function mcApply() {
  const on = mcOn();
  if (on) { mcCrispFilter(); mcClockWatch(); mcFlipSet(); mcWordWatch(); }
  else if (_mcFlip) { _mcFlip.remove(); _mcFlip = null; _mcFlipVal = ''; }
  mcWordFix(on);
  if (!on && _mcFly) [..._mcFly.children].forEach(c => document.body.appendChild(c));   // hand back anything mid-flight
}
function mcInit() {
  _mcBodyMo.observe(document.body, { childList: true });
  mcApply();
  window.addEventListener('resize', () => { if (mcOn()) mcFlipPlace(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mcInit); else mcInit();
