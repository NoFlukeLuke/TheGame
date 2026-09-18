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
  file: 'assets/room/office.jpg',

  // The monitor's glass, in the IMAGE'S OWN PIXELS, in this order:
  //   top-left, top-right, bottom-right, bottom-left
  // Left at null the photo is ignored entirely and the CSS room (r180) runs
  // exactly as it did - so an uncalibrated or missing image cannot break the
  // opening. Fill it in from office-calibrate.html.
  screen: [[1056,351],[1344,358],[1343,561],[1056,553]],
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

// THE OPENING IS A DRIFT, THEN A PUSH, THEN THE CUT. The camera creeps in on the
// monitor by itself for OFFICE_ATTRACT_MS while the menu waits on its screen and
// settles at the REST framing - the machine centred, with its frame, keyboard and
// desk still in shot. It never pulls back out.
//
// EVERY ATTRACT SCREEN PLAYS ON THE GLASS, the mode carousel included. A button
// pressed mid-drift only hurries the camera to the rest framing (OFFICE_SETTLE_MS)
// so the screen it opens is at full size; it does not leave the photograph. Only
// STARTING A RUN does that: the camera dives into the monitor over OFFICE_PUSH_MS
// until the glass covers the viewport, and the channel change flashes at the end of
// the dive - behind which the photograph is gone for good and the UI is flat and
// full-screen.
//
// r248 cut on ANY button instead, which put the mode carousel full-screen at the
// cabinet zoom: about twice the size it is on the glass, and the owner's report was
// that it read as far too big. The carousel belongs on the monitor; the push is
// what earns the full screen.
const OFFICE_ATTRACT_MS = 15000;  // the drift, start to settle
const OFFICE_SETTLE_MS  = 520;    // a button pressed mid-drift: hurry to the rest framing
const OFFICE_PUSH_MS    = 820;    // a mode picked: the dive into the screen
// Share of the viewport the glass fills at rest. TWO numbers, because in portrait
// the binding axis is the WIDTH and a landscape monitor held to 0.78 of a phone's
// width is a small band in the middle of a very tall picture. 0.92 is as close as
// it gets before the photograph's own edge comes into shot.
const OFFICE_HERO_FIT   = { landscape: 0.78, portrait: 0.92 };

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
let officeHeroK   = 1;          // where the drift settles, and the resting framing
// The photograph is the OPENING, not a place you come back to. Once it has been
// cut away it stays away for the session: a run that ends returns to a flat
// full-screen menu rather than pulling the camera back out to the desk.
let officeDone    = false;
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

// THE MONITOR IN THE PHOTOGRAPH IS A LANDSCAPE MONITOR, so while the photo is up
// the machine shows its LANDSCAPE face whatever the device is doing. The skew maps
// #stage's whole box onto the glass quad, so a portrait stage (420x740, aspect
// 0.57) crushed into a quad of aspect 1.37 is a 2.4x horizontal squeeze - measured,
// and on a phone it made the menu unreadable. Landscape against the same quad is
// 1.78 vs 1.37, which is the foreshortening of a screen seen at an angle and reads
// as perspective rather than as distortion. Desktop never showed the bug for
// exactly that reason.
//
// It is only ever a lie for as long as the photograph is on screen: the channel
// change re-runs the real decision behind the flash, so the board is always dealt
// to the device's own orientation.
function officeForcesLandscape() { return officeShowing && officeAvailable(); }

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
    officeArmMenuSettle();
    // LAYOUT FIRST, THEN THE DRIFT. officeWideK and officeHeroK are both still 1
    // until the viewport has been measured, and the drift is the ratio between
    // them - started above it, that ratio is 1, which the "nothing to travel"
    // guard reads as a shot with no move in it and the whole opening silently does
    // not happen.
    //
    // It is applyStageLayout and NOT camRelayout because the stage may have to
    // CHANGE ORIENTATION here: bootstrap's first pass ran long before a photograph
    // could finish downloading, so on a phone the stage is still portrait and only
    // the shared path re-decides it.
    if (typeof applyStageLayout === 'function') applyStageLayout();
    else if (typeof camRelayout === 'function') camRelayout();
    officeStartDrift();
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
  //
  // IT IS MEASURED FROM THE MONITOR, NOT FROM THE IMAGE'S SIZE, because the zoom
  // holds the monitor on the viewport centre and a monitor is never in the middle
  // of the shot. Each of the four margins from the monitor to an edge of the photo
  // has to reach half the viewport on its own, and the SMALLEST one decides: a
  // monitor 71% across has only 29% of the picture to its right, and the naive
  // whole-image figure left 306px of bare background down the right-hand side.
  const mL = bb.cx, mR = OFFICE_PHOTO.w - bb.cx;
  const mT = bb.cy, mB = OFFICE_PHOTO.h - bb.cy;
  officeWideK = Math.min(1, Math.max(
    (W / 2) / (Math.max(1, mL) * S), (W / 2) / (Math.max(1, mR) * S),
    (H / 2) / (Math.max(1, mT) * S), (H / 2) / (Math.max(1, mB) * S)));
  // The HERO framing is where the drift stops: the glass filling OFFICE_HERO_FIT
  // of the viewport, against whichever axis binds first so it always fits. Held at
  // or above the cover figure, because below it the edge of the photograph shows.
  const fit = OFFICE_HERO_FIT[(W > H) ? 'landscape' : 'portrait'];
  officeHeroK = Math.min(1, Math.max(officeWideK, Math.min(
    (W * fit) / (bb.w * S), (H * fit) / (bb.h * S))));

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
  // The camera's 'wide' view IS the hero framing - the drift is run as a multiplier
  // underneath it (below), exactly as r185's opening creep is. That is what lets a
  // relayout mid-drift recompute the framing without stamping on the movement, and
  // it means anything that re-asserts 'wide' lands where the drift settled rather
  // than pulling back out to the cover framing.
  return officeHeroK;
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

// ── The drift, and the cut ──────────────────────────────────────────────────

// Start the slow creep in on the machine. It is a MULTIPLIER on the hero framing
// (camera.js's camBootMul), never a framing of its own, for r185's reason: the
// first seconds of a load trigger several relayouts and each one re-applies the
// camera, so a CSS transition would be stamped on by the first of them while a
// multiplier folded into the scale simply composes with the recomputed value.
function officeStartDrift() {
  if (!officeShowing || officeDone) return;
  if (officeHeroK <= 0) return;
  // Start at the cover framing and finish at the hero one, expressed against the
  // hero framing because that is what the camera is now resting at.
  const from = Math.min(1, officeWideK / officeHeroK);
  if (from > 0.985) return;            // nothing to travel, don't fake it
  if (typeof camPlayBootDolly === 'function') camPlayBootDolly(from, OFFICE_ATTRACT_MS);
}

// Take the photograph away and hand the screen over, flat and full size. The swap
// runs at the channel change's collapse, where a real set hides the switch.
//
// `.office-photo` DELIBERATELY STAYS ON. It means THE CABINET IS REPLACED, which is
// a layout fact: the cabinet's resting offset and the attract screens' inset:0 were
// both measured against it, so putting the bezel back here would shift the board off
// centre with nothing left to re-measure it. Only `.office-scene` - whether the
// photograph is on screen - is what gets turned off.
function officeCutToScreen() {
  if (!officeShowing || officeDone) return;
  officeDone = true;
  officeEntering = true;
  const swap = () => {
    officeEntering = false;
    officeSetShowing(false);
    if (typeof camEndBootDolly === 'function') camEndBootDolly();
    camSetView('play', false);         // k = 1 and, crucially, NO transform at all
    // officeShowing is false by now, so this re-decides landscape vs portrait from
    // the viewport and lays the whole stage out again - which is what hands a phone
    // back its portrait layout after the monitor borrowed a landscape one. It has
    // to be the SHARED path (bootstrap's own update), not a camRelayout: that
    // re-uses camLastLandscape, which is still the forced value.
    if (typeof applyStageLayout === 'function') applyStageLayout();
    else {
      if (typeof camRelayout === 'function') camRelayout();
      if (typeof recomputeGridMetrics === 'function') recomputeGridMetrics();
    }
  };
  const flash = () => {
    if (document.body.classList.contains('reduced-motion') || typeof channelChange !== 'function') swap();
    else channelChange(swap);
  };
  // THE PUSH. Dive from the rest framing until the glass COVERS the viewport, then
  // flash. The photo's own scale S was chosen so that happens at camera scale 1
  // (see officeLayout), so the flat screen the channel change reveals is already
  // the size the trapezoid had grown to and the cut is continuous - which is the
  // whole reason the dive is worth having rather than cutting from where we stood.
  //
  // camWideK IS the rest framing here, so the multiplier that gets k to 1 is its
  // reciprocal. Guarded: with no travel to make (an uncalibrated photo, or a rest
  // framing already at 1) it flashes on the spot rather than running a 0-length
  // dolly.
  const rest = (typeof camWideK === 'number' && camWideK > 0.01) ? camWideK : 1;
  const to   = 1 / rest;
  if (to <= 1.01 || typeof camDollyMul !== 'function') { flash(); return; }
  camDollyMul(camBootMulNow(), to, OFFICE_PUSH_MS, { pow: 2.4, hold: true, onDone: flash });
}

// A BUTTON ENDS THE DRIFT; IT DOES NOT END THE PHOTOGRAPH. Whatever the player
// opens - the mode carousel on the glass, or Settings / History / Builds, which are
// body-level panels over it - they should meet it at the rest framing rather than
// at wherever a fifteen second drift happened to be three seconds in.
//
// It HURRIES rather than snapping: camEndBootDolly writes the final scale with no
// transition, so a drift caught at 0.6 of its travel would jump. Carrying on from
// where it is over half a second reads as the camera arriving.
//
// One delegated listener in the CAPTURE phase, and it does NOT stop the event: the
// button's own handler runs as it always did. A capture-phase listener also cannot
// be beaten to it by a handler that re-renders the menu out from under the click.
function officeArmMenuSettle() {
  ['main-menu-overlay', 'mode-select-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el._officeCutArmed) return;
    el._officeCutArmed = true;
    el.addEventListener('click', (e) => {
      if (!officeShowing || officeDone) return;
      if (!(e.target && e.target.closest && e.target.closest('button'))) return;
      officeSettleNow();
    }, true);
  });
}

// Hurry the opening drift to its end. No-op once it has landed.
function officeSettleNow() {
  if (typeof camBootDollyRunning !== 'function' || !camBootDollyRunning()) return;
  camDollyMul(camBootMulNow(), 1, OFFICE_SETTLE_MS);
}

// startGame's own hook. By the time a run starts the menu's button has almost
// always cut already, so this is the backstop for any path that reaches a run with
// the photograph still up.
function officeEnterGame() { officeCutToScreen(); }

// Coming back to the menu after a run. The photograph does not return - see
// `officeDone` above - so this reports 'stay' and camera.js leaves the camera where
// it is rather than pulling out to a desk that is no longer part of the session.
function officeReturnToMenu() {
  if (officeDone) return 'stay';
  if (!officeAvailable()) return false;
  officeSetShowing(true);
  if (typeof camRelayout === 'function') camRelayout();
  return true;
}
