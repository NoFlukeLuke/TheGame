// r699: the screen door. ONE layer of scan lines for every screen in the game, drawn on
// a canvas fixed to the display (#sd-door, body-level, over everything but the walkthrough,
// the tours and their panels). The lines belong to the glass, not to what is on it: cards
// falling, cards flying to the preview, a Trick lifted out of the tray all move UNDER them.
// Every screen gets the same lines: SD_CFG.line design px dark in every SD_CFG.pitch (r639
// set the console line at half a design px), at the stage's zoom, snapped to whole device
// pixels, phased from the top of the display. Console mode adds the phosphor grille. Settings -> Display -> Screen door turns it off
// (html.sd-off). Surfaces used to carry their own lines (about 35 rules, five different
// spacings, each moving with its element); those are gone, and each is listed here instead.
const SD_CFG = { pitch: 3, line: 0.5, dark: 0.13, grille: 0.55 };   // the r511 board door

// What counts as a screen. A selector that matches nothing visible costs nothing.
const SD_SCREENS = [
  'html:not(.skin-machine) #cab-screen',   // the pit look: the whole monitor (its padding is the bezel)
  // console mode: every window in the housing (css/skin-machine.css) and the keys' tube look
  'html.skin-machine #stage :is(#score-center, #score-left, #score-subboxes, #pmf-merged, #knack-carousel-wrap, #selected-cards, #trick-tray-area, #coin-info, #vclock, #run-progress, #focus-bar-outer)',
  'html.skin-machine #stage:not(.landscape) #hand-preview-area',
  'html.skin-machine body:not(.flowr-deck) #stage #grid',
  'html.skin-machine #mc-flip', 'html.skin-machine #boss-preamble.bp-console',
  'html.kl.kl-a #stage :is(#btn-play, #btn-discard, #swap-indicator, #btn-leave)',
  // amber screens on the board
  '.ia-screen', '.bs-screen', '#grid .map-term', '#grid .shop-title-tile',
  'html.skin-machine #limitbreak-overlay.lb-console #lb-panel',
  // panels and menus
  '#countdown-321-number', '#pause-overlay', '#lb-panel', '#main-menu-overlay', '#mode-select-overlay',
  '#picker-overlay', '#settings-overlay', '#records-overlay', '.audio-overlay', '#info-overlay',
  '#finale .fn-panel', '#builds-overlay .bv-scroll', '.sq-panel', '#event-panel', '#blp-panel',
  '#stage.landscape #payout-overlay:not(.po-tiled)',
  // the event layouts lab
  '#egl[data-lay="wire"]', '#egl[data-lay="terminal"]', '.egl-screen', '#egl[data-lay="wall"] .egl-cell', '.egl-tc-phos',
];
// Pop-ups that sit over a screen without being one: the lines are cut out under them.
const SD_COVERS = [
  '#entity-tip', '#trick-tooltip', '#knack-tooltip', '#challenge-tooltip', '.sleight-tooltip',
  '#sleight-grid-tooltip', '#card-enh-tooltip', '#sq-tip', '#ci-tip', '.time-popup',
  '#boss-peek-popup', '#hand-log-popup', '#limits-popup', '#goal-banner',
  '#pt-layer .pt-slip', '#pt-tab', '#dev-panel',
];
// r717 (perf, the owner's phone lag): the elements are found every SD_RESCAN_MS and their
// boxes read every SD_RECT_MS, not every frame. Reading ~15 boxes each frame forced a
// layout at the top of every frame (28% of an idle mid-run frame budget at 4x CPU
// throttle); the lines belong to screens that rarely move, so 10 reads a second is plenty.
const SD_RESCAN_MS = 500, SD_RECT_MS = 100;
// A phone (coarse pointer) gets the dark lines without the console grille, drawn without
// a blend mode: a full-display multiply layer at 3x pixel density is fill-rate a phone
// pays on every frame anything under it changes.
const SD_PLAIN = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
if (SD_PLAIN) document.documentElement.classList.add('sd-plain');

let _sdCv = null, _sdCtx = null, _sdKey = '', _sdScanAt = -1e9, _sdRectAt = -1e9, _sdScreens = [], _sdCovers = [], _sdZoom = 1;

function sdOn() { return !document.documentElement.classList.contains('sd-off'); }

function sdVisible(el) {
  if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  return el.getClientRects().length > 0;
}

// Elements and their box details are read every SD_RESCAN_MS; rects every frame.
function sdRescan() {
  const pick = sels => {
    const out = [];
    document.querySelectorAll(sels.join(',')).forEach(el => { if (sdVisible(el)) out.push(el); });
    return out;
  };
  _sdScreens = pick(SD_SCREENS).map(el => {
    const cs = getComputedStyle(el);
    // the monitor's bezel is its padding; a tube key's rim is --kr (css/key-looks.css)
    const pad = el.id === 'cab-screen' ? parseFloat(cs.paddingTop) || 0 : parseFloat(cs.getPropertyValue('--kr')) || 0;
    return { el, pad, rad: parseFloat(cs.borderTopLeftRadius) || 0 };
  });
  _sdCovers = pick(SD_COVERS);
  const st = document.getElementById('stage');
  if (st && st.offsetWidth) { const z = st.getBoundingClientRect().width / st.offsetWidth; if (z > 0.05) _sdZoom = z; }
}

// r717 (perf): a live full-display canvas cost a phone most of its frame budget even
// when nothing on it changed (the compositor re-produced it every frame: 1.8s of a
// 5.7s idle trace at 4x CPU; the same lines as an <img> cost nothing). So the canvas is
// only on screen while the lines are CHANGING; SD_SETTLE_MS after the last change it is
// copied into #sd-door-img, which takes its place, and the canvas is hidden.
const SD_SETTLE_MS = 150;
let _sdImg = null, _sdImgUrl = '', _sdSettleT = 0;
function sdImgLayer() {
  if (_sdImg && _sdImg.isConnected) return _sdImg;
  _sdImg = document.createElement('img');
  _sdImg.id = 'sd-door-img'; _sdImg.alt = ''; _sdImg.setAttribute('aria-hidden', 'true');
  _sdImg.style.display = 'none';
  document.body.appendChild(_sdImg);
  return _sdImg;
}
function sdShowLive() {
  clearTimeout(_sdSettleT);
  if (_sdImg) _sdImg.style.display = 'none';
  _sdCv.style.display = '';
  _sdSettleT = setTimeout(sdSettle, SD_SETTLE_MS);
}
function sdSettle() {
  const key = _sdKey, cv = _sdCv;
  if (!cv || !cv.toBlob || key === 'off') return;
  cv.toBlob(b => {
    if (!b || _sdKey !== key || !sdOn()) return;
    const img = sdImgLayer(), url = URL.createObjectURL(b);
    img.onload = () => {
      if (_sdKey !== key || !sdOn()) { URL.revokeObjectURL(url); return; }
      if (_sdImgUrl) URL.revokeObjectURL(_sdImgUrl);
      _sdImgUrl = url;
      img.style.display = ''; cv.style.display = 'none';
    };
    img.src = url;
  });
}
function sdLayer() {
  if (_sdCv && _sdCv.isConnected) return _sdCv;
  _sdCv = document.createElement('canvas');
  _sdCv.id = 'sd-door';
  _sdCv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_sdCv);
  _sdCtx = _sdCv.getContext('2d');
  return _sdCv;
}

// One tile of the door in device px: the dark line at the top, the grille under it.
function sdPattern(P, L, grille) {
  const t = document.createElement('canvas');
  t.width = P; t.height = P;
  const c = t.getContext('2d');
  if (grille) {
    const a = Math.round(P / 3), b = Math.round(2 * P / 3);
    c.globalAlpha = SD_CFG.grille;
    c.fillStyle = 'rgb(255 205 205)'; c.fillRect(0, 0, a, P);
    c.fillStyle = 'rgb(205 255 210)'; c.fillRect(a, 0, b - a, P);
    c.fillStyle = 'rgb(233 235 255)'; c.fillRect(b, 0, P - b, P);
    c.globalAlpha = 1;
  }
  c.fillStyle = `rgba(0,0,0,${SD_CFG.dark})`;
  c.fillRect(0, 0, P, L);
  return _sdCtx.createPattern(t, 'repeat');
}

function sdTick(t) {
  requestAnimationFrame(sdTick);
  const cv = sdLayer();
  if (!sdOn()) {
    if (_sdKey !== 'off') { cv.style.display = 'none'; if (_sdImg) _sdImg.style.display = 'none'; clearTimeout(_sdSettleT); _sdKey = 'off'; }
    return;
  }
  if (t - _sdRectAt < SD_RECT_MS) return;
  _sdRectAt = t;
  if (t - _sdScanAt > SD_RESCAN_MS) { _sdScanAt = t; sdRescan(); }
  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
  const P = Math.max(2, Math.round(SD_CFG.pitch * _sdZoom * dpr));
  const L = Math.max(1, Math.min(P - 1, Math.round(SD_CFG.line * _sdZoom * dpr)));
  const grille = !SD_PLAIN && document.documentElement.classList.contains('skin-machine');
  const box = (r, pad, rad) => [r.left + pad, r.top + pad, r.width - 2 * pad, r.height - 2 * pad, rad]
    .map(v => Math.round(v * dpr));
  const scr = [], cov = [];
  _sdScreens.forEach(s => {
    const r = s.el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const z = s.el.offsetWidth ? r.width / s.el.offsetWidth : 1;
    const b = box(r, s.pad * z, s.rad * z);
    if (b[2] > 0 && b[3] > 0) scr.push(b);
  });
  _sdCovers.forEach(el => { const r = el.getBoundingClientRect(); if (r.width >= 1 && r.height >= 1) cov.push(box(r, 0, 0)); });
  const key = [W, H, P, L, grille ? 1 : 0, scr.join(';'), cov.join(';')].join('|');
  if (key === _sdKey) return;
  _sdKey = key;
  sdShowLive();
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = _sdCtx;
  c.clearRect(0, 0, W, H);
  if (!scr.length) return;
  c.fillStyle = sdPattern(P, L, grille);   // a pattern is anchored at the canvas origin: one phase for every screen
  c.beginPath();
  scr.forEach(([x, y, w, h, rad]) => {
    if (c.roundRect && rad > 0) c.roundRect(x, y, w, h, Math.max(0, Math.min(rad, w / 2, h / 2))); else c.rect(x, y, w, h);
  });
  c.fill();
  cov.forEach(([x, y, w, h]) => c.clearRect(x, y, w, h));
}

requestAnimationFrame(sdTick);
