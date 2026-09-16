// ══════════════════════════════════════════════════════════════════════════
// THE PHOTO OFFICE (r244) - js/office-photo.js + css/office-photo.css
//
// The game opens on a PHOTOGRAPH of an office. There is a computer on the desk
// and the game's own menu is drawn ON ITS SCREEN. Press PLAY and the camera
// pushes in on that monitor until its glass fills the viewport, a channel change
// flashes, and the real game UI is behind it at full size.
//
// This replaces the CSS-drawn cubicle and the arcade cabinet around it (r180).
// The monitor in the photo IS the machine now, so the beige housing, its marquee
// and its bezel are hidden while photo mode is live.
//
// ── THE ONE THING YOU HAVE TO SUPPLY ──────────────────────────────────────
// The four corners of the monitor's GLASS, in the image's own pixels. The screen
// in a photograph is a trapezoid, not a rectangle, so four points - not a box.
// Open office-calibrate.html, click the corners, paste the block it dumps into
// OFFICE_PHOTO below. Nothing else needs editing.
//
// ── HOW THE GEOMETRY WORKS ────────────────────────────────────────────────
// Three facts, and the whole file falls out of them:
//
// 1. The photo and the game screen are BOTH inside #camera, so one scale() on
//    the camera moves them together. The dolly is therefore a pure composited
//    transform with no relayout in it - the same rule js/camera.js already lives
//    by, and the reason the board's card metrics are computed once at their
//    final size rather than re-measured every frame of the zoom.
//
// 2. The photo is placed so the MONITOR'S CENTRE sits on the viewport centre.
//    That is what reduces "fly into the screen" to scale(k) about the viewport
//    centre. Without it the zoom would need a translate kept in step with the
//    scale, in two orientations, against a resize.
//
// 3. The SKEW IS ON #cab-screen, never on #cabinet or #stage.
//      - Not #cabinet, because js/channel-change.js writes #cabinet.style
//        .transform directly during the flash. It would stomp the skew and the
//        screen would snap flat a beat BEFORE the collapse hid it. On #cab-screen
//        the channel change's squeeze composes on top of the skew instead.
//      - Not #stage, because #stage carries `zoom` and a transform-origin on a
//        zoomed box is a fight not worth having.
//
// The scale at the END of the dolly is 1, and that is not a coincidence: the
// photo's own scale S is chosen so the monitor's glass covers the viewport at
// k = 1. So the flat, un-skewed game screen the channel change reveals is
// already the size the trapezoid had grown to, and the cut is continuous.
//
// How much zoom there is = how small the monitor is in the frame. A photo where
// the monitor is already half the picture has almost no push left in it; frame
// the shot with the whole desk in it.
// ══════════════════════════════════════════════════════════════════════════

const OFFICE_PHOTO = {
  // Any format a browser can draw. A photograph as PNG is enormous - a 2560px
  // JPG or WebP is a tenth the size and indistinguishable behind a CRT flash.
  file: 'assets/room/office.png',

  // The monitor's glass, in the IMAGE'S OWN PIXELS, in this order:
  //   top-left, top-right, bottom-right, bottom-left
  // Left at null the photo is ignored entirely and the CSS room (r180) runs
  // exactly as it did - so an uncalibrated or missing image cannot break the
  // opening. Fill it in from office-calibrate.html.
  screen: null,
  // e.g. screen: [[812,404],[1388,436],[1381,802],[806,758]],
  //
  // assets/room/_test-office.svg is a synthetic office with its glass at
  // [[760,430],[1240,470],[1230,790],[770,745]] - point file and screen at those
  // two and the whole opening runs with no photograph in the repo at all. That is
  // what this was built against.

  // The image's natural size, for the calibration page's numbers to mean
  // something before the file has loaded. Filled in automatically on load.
  w: 0, h: 0,
};

const OFFICE_DOLLY_MS = 2600;   // the push in on the monitor
const OFFICE_HOLD_MS  = 260;    // a beat at full screen before the channel change

let officeReady   = false;      // the image loaded AND the corners are calibrated
// TWO states, and collapsing them into one is a bug. `officeActive` means THE
// CABINET IS REPLACED - the housing, marquee and bezel are hidden and #cab-screen
// is a box the exact size of #stage. That is a LAYOUT fact and it must hold for
// the whole session: the cabinet's resting offset was measured against it, so
// putting the bezel back at the channel change would shift the board 12px off
// centre with nothing left to re-measure it. `officeShowing` is the much smaller
// question of whether the photograph is on screen, and that is what the swap
// turns off.
let officeActive  = false;
let officeShowing = false;
let officeWideK   = 1;          // camera scale that frames the whole photo
let officeDollyRaf = null;
// Which attract screen the player was last looking at, and a latch that stops
// camera.js's "a menu appeared, pull out to it" observer from firing while we are
// deliberately holding one up during the push in.
let officeLastAttract = 'main-menu-overlay';
let officeEntering = false;

function officeEl()    { return document.getElementById('office'); }
function officeImgEl() { return document.getElementById('office-img'); }
function officeGlass() { return document.getElementById('cab-screen'); }

// Is there a usable photo at all? Everything else early-returns on this, so a
// missing file, a 404 or an uncalibrated quad all land on the CSS room.
function officeAvailable() {
  const q = OFFICE_PHOTO.screen;
  return officeReady && Array.isArray(q) && q.length === 4 && OFFICE_PHOTO.w > 0;
}

// ── The homography ──────────────────────────────────────────────────────────
// Maps the rect (0,0,w,h) onto an arbitrary quad and returns it as a CSS
// matrix3d. A perspective map needs the projective terms g and h - an affine
// matrix() can move, scale, rotate and shear a rectangle but can never turn it
// into a trapezoid, which is exactly what a screen photographed at an angle is.
//
// Heckbert's unit-square-to-quad, then pre-scaled by 1/w and 1/h so the source
// can be the element's own box. Use with transform-origin: 0 0.
function officeQuadMatrix(w, h, quad) {
  if (!w || !h || !quad || quad.length !== 4) return '';
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, i;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    // The quad really is a parallelogram - the projective terms are zero and the
    // general formula's denominator would be doing nothing but losing precision.
    a = x1 - x0; b = x3 - x0; c = x0;
    d = y1 - y0; e = y3 - y0; f = y0;
    g = 0; i = 0;
  } else {
    const dx1 = x1 - x2, dy1 = y1 - y2;
    const dx2 = x3 - x2, dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    if (!den) return '';
    g = (sx * dy2 - dx2 * sy) / den;
    i = (dx1 * sy - sx * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + i * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + i * y3; f = y0;
  }
  const m = [a / w, d / w, 0, g / w,  b / h, e / h, 0, i / h,  0, 0, 1, 0,  c, f, 0, 1];
  return 'matrix3d(' + m.map(n => (Math.abs(n) < 1e-12 ? 0 : +n.toFixed(10))).join(',') + ')';
}

function officeQuadBBox(q) {
  const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
  const l = Math.min(...xs), r = Math.max(...xs);
  const t = Math.min(...ys), b = Math.max(...ys);
  return { l, t, w: r - l, h: b - t, cx: (l + r) / 2, cy: (t + b) / 2 };
}

// ── Load ────────────────────────────────────────────────────────────────────
function officeInit() {
  const img = officeImgEl();
  if (!img || !OFFICE_PHOTO.file) return;
  // Uncalibrated: don't even ask for the file. Photo mode cannot turn on without
  // the corners, so fetching it would only be a 404 in the console on every load
  // of the shipped game - which reads as something being broken when nothing is.
  if (!Array.isArray(OFFICE_PHOTO.screen) || OFFICE_PHOTO.screen.length !== 4) return;
  img.addEventListener('load', () => {
    OFFICE_PHOTO.w = img.naturalWidth;
    OFFICE_PHOTO.h = img.naturalHeight;
    officeReady = true;
    officeSetActive(true);
    officeSetShowing(true);
    // The r185 opening creep has almost certainly already started - camInit runs
    // long before a photograph finishes downloading, so the check there loses the
    // race every time. End it now, or the wide framing sits at 0.85x of itself
    // for seven seconds with the edge of the photo showing.
    if (typeof camEndBootDolly === 'function') camEndBootDolly();
    if (typeof camLayout === 'function') camRelayout();
  });
  img.addEventListener('error', () => {
    // Never fatal. The CSS room is still in the document underneath.
    console.warn('[office] could not load', OFFICE_PHOTO.file, '- falling back to the CSS room.');
    officeReady = false;
    officeSetActive(false);
  });
  img.src = OFFICE_PHOTO.file;
}

function officeSetActive(on) {
  officeActive = !!on && officeAvailable();
  document.body.classList.toggle('office-photo', officeActive);
  if (!officeActive) { officeSetShowing(false); }
}

function officeSetShowing(on) {
  officeShowing = !!on && officeActive;
  document.body.classList.toggle('office-scene', officeShowing);
  if (!officeShowing) officeClearSkew();
}

function officeClearSkew() {
  const g = officeGlass();
  if (g) { g.style.transform = ''; g.style.transformOrigin = ''; }
}

// ── Layout ──────────────────────────────────────────────────────────────────
// Called from camLayout, AFTER the cabinet has been placed, with the camera's
// transform already cleared for measurement. Returns the camera scale the wide
// framing should use, or null to leave camera.js's own cabinet fit alone.
function officeLayout() {
  if (!officeShowing || !officeAvailable()) return null;
  const el = officeEl(), glass = officeGlass();
  if (!el || !glass) return null;

  const W = window.innerWidth, H = window.innerHeight;
  const q = OFFICE_PHOTO.screen;
  const bb = officeQuadBBox(q);
  if (!bb.w || !bb.h) return null;

  // S: photo px -> camera-local px. Chosen so the monitor's glass COVERS the
  // viewport at camera scale 1, which is what makes the end of the dolly line up
  // with the flat game screen the channel change reveals.
  const S = Math.max(W / bb.w, H / bb.h);
  // The photo must cover the viewport at the wide framing too, or the edge of the
  // image shows as a hard seam. That minimum IS the furthest the camera can pull
  // back, and the ratio between it and 1 is the whole zoom.
  officeWideK = Math.min(1, Math.max(W / (OFFICE_PHOTO.w * S), H / (OFFICE_PHOTO.h * S)));

  // Put the monitor's centre on the viewport centre. #camera is position:fixed
  // inset:0, so its local px ARE viewport px, and scaling about 50%/50% then
  // holds the monitor still while everything grows around it.
  const tx = W / 2 - bb.cx * S;
  const ty = H / 2 - bb.cy * S;
  el.style.setProperty('--of-tx', tx.toFixed(2) + 'px');
  el.style.setProperty('--of-ty', ty.toFixed(2) + 'px');
  el.style.setProperty('--of-k', S.toFixed(5));
  el.style.width  = OFFICE_PHOTO.w + 'px';
  el.style.height = OFFICE_PHOTO.h + 'px';

  officeApplySkew(tx, ty, S);
  return officeWideK;
}

// Map #cab-screen's own box onto the monitor's glass. Measured, not derived from
// the layout percentages: a CSS change to the bezel or the housing can then never
// drift the game screen off the monitor it is supposed to be sitting on.
function officeApplySkew(tx, ty, S) {
  const glass = officeGlass();
  if (!glass) return;
  const cam = document.getElementById('camera');
  const prevCam = cam ? cam.style.transform : '';
  const prevTr = glass.style.transform;
  // Measure with BOTH transforms off, so the rect is in camera-local px.
  if (cam) cam.style.transform = 'none';
  glass.style.transform = 'none';
  const r = glass.getBoundingClientRect();
  glass.style.transform = prevTr;
  if (cam) cam.style.transform = prevCam;
  if (!r.width || !r.height || !glass.offsetWidth) return;

  // THE ZOOM. #cabinet carries `zoom: var(--stage-zoom)`, so #cab-screen's OWN
  // coordinate system is ~1.9x smaller than the pixels it paints into: its rect
  // reads 1436x807 while its box is 747x420. A transform is applied in the
  // element's own units, so a matrix built from the RECT is off by the zoom -
  // and because the horizontal translation here is near zero, it comes out as a
  // screen that is the right size and sitting well above the monitor. The same
  // trap the r160 Trick fan hit: never mix getBoundingClientRect with offsetWidth.
  const zx = r.width / glass.offsetWidth;
  const zy = r.height / glass.offsetHeight;

  // The quad, expressed relative to the glass's own untransformed top-left and in
  // its own units - which together are what transform-origin: 0 0 means.
  const quad = OFFICE_PHOTO.screen.map(([px, py]) =>
    [(tx + px * S - r.left) / zx, (ty + py * S - r.top) / zy]);
  const m = officeQuadMatrix(glass.offsetWidth, glass.offsetHeight, quad);
  if (!m) return;
  glass.style.transformOrigin = '0 0';
  glass.style.transform = m;
}

// ── The push in ─────────────────────────────────────────────────────────────
// Driven by rAF over the camera's scale rather than by a CSS transition, for the
// reason r185's opening shot documents: the first frames of a run trigger several
// relayouts (the board deals, fonts settle) and each one re-applies the camera.
// A transition would be stamped on by the first of them; a value we write every
// frame just carries on from wherever the recompute left it.
//
// The scale is interpolated in LOG space. Perceived zoom is multiplicative - the
// step from 0.1 to 0.2 reads as the same move as 0.5 to 1.0 - so a linear ramp
// looks like it slams to a halt at the end. Log space makes the rate constant and
// the smoothstep on top is what gives it the ease in and out.
function officeDollyIn(done) {
  const cam = document.getElementById('camera');
  if (!cam) { done && done(); return; }
  officeCancelDolly();
  const k0 = officeWideK, k1 = 1;
  if (k0 >= 0.999) { done && done(); return; }
  const t0 = performance.now();
  cam.style.willChange = 'transform';
  cam.style.transition = 'none';
  officeDollyRaf = requestAnimationFrame(function step(t) {
    const p = Math.min(1, (t - t0) / OFFICE_DOLLY_MS);
    const e = p * p * (3 - 2 * p);
    const k = k0 * Math.pow(k1 / k0, e);
    cam.style.transform = `scale(${k.toFixed(5)})`;
    if (p < 1) { officeDollyRaf = requestAnimationFrame(step); return; }
    officeDollyRaf = null;
    cam.style.willChange = '';
    done && done();
  });
}

function officeCancelDolly() {
  if (officeDollyRaf) { cancelAnimationFrame(officeDollyRaf); officeDollyRaf = null; }
}

// Entering a run, in photo mode. The menu STAYS on the monitor for the whole
// push - that is the shot: you fly at a screen with something on it. It is the
// channel change that takes it away, and the swap runs at the collapse, where a
// real set hides the switch.
function officeEnterGame() {
  const reduce = document.body.classList.contains('reduced-motion');
  const swap = () => {
    officeEntering = false;
    document.getElementById('main-menu-overlay')?.classList.remove('show');
    document.getElementById('mode-select-overlay')?.classList.remove('show');
    officeSetShowing(false);       // photograph out, skew cleared - chrome stays off
    officeCancelDolly();
    camSetView('play', false);     // k = 1 and, crucially, NO transform at all
  };
  if (reduce) { swap(); return; }
  // Hold the attract screen up for the length of the push. The shot is "you fly
  // at a screen with something on it": by this point startGame has already dealt
  // the board behind it, and arriving at a board you were already looking at is
  // not a transition. The latch is what stops camera.js's observer from reading
  // this as "back at the menu" and pulling the camera the other way.
  officeEntering = true;
  document.getElementById(officeLastAttract)?.classList.add('show');
  camSetView('wide', false);       // pin the camera at the wide framing to start
  officeDollyIn(() => {
    setTimeout(() => {
      if (typeof channelChange === 'function') channelChange(swap);
      else swap();
    }, OFFICE_HOLD_MS);
  });
}

// Back to the menu: the photo comes back and the camera pulls out to it.
function officeReturnToMenu() {
  if (!officeAvailable()) return false;
  officeSetShowing(true);
  if (typeof camRelayout === 'function') camRelayout();
  return true;
}
