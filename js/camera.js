// ── ROOM CAMERA (r180) ────────────────────────────────────────────────────
// The whole scene - the office cubicle in css/room.css and the arcade cabinet -
// lives inside #camera. The camera has two framings and dollies between them:
//
//   wide  = the attract framing. The whole cabinet on its desk, walls and props
//           around it. The main menu and the mode carousel are drawn ON the CRT,
//           so what you are looking at is a machine in a room.
//   play  = pushed all the way in. The zoom is sized so #stage alone fills the
//           viewport, which puts the beige housing off every edge and hands the
//           game the entire screen.
//
// TWO RULES HOLD THIS TOGETHER, and both are load-bearing:
//
// 1. --stage-zoom is ALWAYS the play zoom. It never changes between framings.
//    The wide framing is a `scale()` on #camera, not a smaller zoom, so the
//    board's layout and card metrics are computed once at their final size and
//    the dolly is a pure composited transform - no relayout mid-animation.
//
// 2. At the play framing #camera carries NO transform at all. It cannot: a
//    transform makes its element the containing block for every position:fixed
//    descendant, and #stage is full of them (the Mart, the pause menu, the shop,
//    the reward grid, the 3-2-1, the end screen). Leaving a transform on would
//    silently re-anchor all of them. So the cabinet is nudged into place with a
//    position:relative offset instead - which does NOT re-anchor fixed children -
//    and the camera's transform is cleared the moment the dolly lands.
//
// Because the cabinet is offset so that the STAGE centre sits on the viewport
// centre, the wide framing is just `scale(k)` about the viewport centre. No
// translate to keep in step, and one code path covers both orientations.

// Design footprints, in the cabinet's own (pre-zoom) px.
const CAM_DESIGN = {
  landscape: { cabW: 824, cabH: 506, stageW: 747, stageH: 420 },
  portrait:  { cabW: 496, cabH: 826, stageW: 420, stageH: 740 },
};
// Share of the viewport the cabinet fills at the wide framing. Two numbers, not
// one: the fit is against whichever axis binds, and in portrait that is always
// the width, so a single 0.55 would leave the cabinet filling 55% of the width
// and barely a quarter of the height - a small machine adrift in a lot of desk.
const CAM_WIDE_FIT = { landscape: 0.55, portrait: 0.78 };
const CAM_PLAY_PAD = 2;      // px of slack at the play framing, against rounding
const CAM_DUR      = 1250;   // dolly length, ms
// The opening shot (r185): the page loads with the camera further back than the
// wide framing and creeps in on the machine over seven seconds. It is a multiplier
// on whatever framing is current rather than a third framing of its own, so it
// composes with a relayout mid-flight instead of being cancelled by one.
const CAM_BOOT_MS  = 7000;
const CAM_BOOT_OUT = 0.42;   // how far back the opening shot starts, x the wide framing
const CAM_EASE     = 'cubic-bezier(0.45, 0.04, 0.22, 1)';
// The room canvas, in the same design px as the cabinet. Its centre is the
// cabinet's centre; css/room.css lays the cubicle out inside this box. It has to
// out-cover the widest framing on the tallest screen - portrait at CAM_WIDE_FIT
// shows about 2000 design px of height - or the canvas edge shows as a hard seam.
const ROOM_W = 3000, ROOM_H = 2400;

let camView      = 'wide';   // 'wide' | 'play'
let camBootMul   = 1;        // 1 except during the opening shot
let camBootRaf   = null;
let camWideK     = 0.6;      // scale that renders the wide framing
let camPlayZoom  = 1;        // the live --stage-zoom
let camDollyTimer = null;

function camEl()   { return document.getElementById('camera'); }
function camRoom() { return document.getElementById('room'); }

// The live scale of the camera, read off the computed matrix so it is correct
// mid-dolly too. Anything that measures a rect inside #camera and wants design
// px has to divide by this as well as by --stage-zoom.
function camScale() {
  const cam = camEl();
  if (!cam) return 1;
  const t = getComputedStyle(cam).transform;
  if (!t || t === 'none') return 1;
  const m = t.match(/matrix3?d?\(([^)]+)\)/);
  return m ? (parseFloat(m[1].split(',')[0]) || 1) : 1;
}

// Place the cabinet so the STAGE (not the housing) is centred in the viewport,
// and glue the room's canvas to the same point. Measured rather than derived
// from the bezel/marquee paddings, so a CSS change to the housing can't drift it.
function camPlaceScene() {
  const cam = camEl(), cab = document.getElementById('cabinet'), stage = document.getElementById('stage');
  if (!cam || !cab || !stage) return;
  const prevTr = cam.style.transform, prevTs = cam.style.transition;
  cam.style.transition = 'none';
  cam.style.transform  = 'none';
  cab.style.left = '0px';
  cab.style.top  = '0px';
  const r = stage.getBoundingClientRect();
  const W = window.innerWidth, H = window.innerHeight;
  // Viewport-px delta, converted into the cabinet's own px (it carries the zoom).
  const dx = (W / 2 - (r.left + r.width  / 2)) / camPlayZoom;
  const dy = (H / 2 - (r.top  + r.height / 2)) / camPlayZoom;
  cab.style.left = dx.toFixed(2) + 'px';
  cab.style.top  = dy.toFixed(2) + 'px';
  // #room is transform-origin:0 0, so map its centre onto the same point.
  const z = camPlayZoom;
  const room = camRoom();
  if (room) {
    room.style.setProperty('--room-tx', (W / 2 + dx * z - ROOM_W / 2 * z).toFixed(2) + 'px');
    room.style.setProperty('--room-ty', (H / 2 + dy * z - ROOM_H / 2 * z).toFixed(2) + 'px');
  }
  cam.style.transform  = prevTr;
  void cam.offsetWidth;
  cam.style.transition = prevTs;
}

// Recompute both framings for the current viewport. Called from bootstrap's
// resize handler - it owns the landscape decision, we own the numbers.
function camLayout(isLandscape) {
  const d = CAM_DESIGN[isLandscape ? 'landscape' : 'portrait'];
  const W = window.innerWidth, H = window.innerHeight;
  // Play: fit the STAGE, and let the housing fall off the edges.
  camPlayZoom = Math.min((W - CAM_PLAY_PAD * 2) / d.stageW, (H - CAM_PLAY_PAD * 2) / d.stageH);
  // Wide: fit the whole cabinet into CAM_WIDE_FIT of the viewport, leaving the
  // rest of the frame for the desk and the cubicle.
  const wideZoom = Math.min(W / d.cabW, H / d.cabH) * CAM_WIDE_FIT[isLandscape ? 'landscape' : 'portrait'];
  camWideK = Math.max(0.15, Math.min(0.95, wideZoom / camPlayZoom));
  const root = document.documentElement.style;
  root.setProperty('--stage-zoom', camPlayZoom);
  root.setProperty('--cab-w', d.cabW + 'px');
  root.setProperty('--cab-h', d.cabH + 'px');
  // The room drops the props that only fit the wide landscape desk.
  camRoom()?.classList.toggle('room-portrait', !isLandscape);
  // The skew has to come OFF before the scene is placed. camPlaceScene centres the
  // cabinet by measuring #stage's rect, and with the skew on that rect is the
  // trapezoid's bounding box - so the board would be centred on a shape it is not.
  if (typeof officeClearSkew === 'function') officeClearSkew();
  camPlaceScene();
  // The photo office (r244), when it is live, owns the wide framing: its scale is
  // "the whole photograph fills the viewport", which is a different question from
  // "the cabinet fills 55% of it". It has to run AFTER camPlaceScene, because the
  // skew it writes is measured off the cabinet's final resting position.
  camLastLandscape = isLandscape;
  const photoK = (typeof officeLayout === 'function') ? officeLayout() : null;
  if (photoK) camWideK = photoK;
  camApply(false);
  return camPlayZoom;
}

// Recompute for whatever orientation is current. The photo layer calls this when
// its image lands, which can be any number of frames after the first layout.
let camLastLandscape = true;
function camRelayout() { camLayout(camLastLandscape); }

function camApply(animate) {
  const cam = camEl();
  if (!cam) return;
  const k = ((camView === 'play') ? 1 : camWideK) * camBootMul;
  if (camDollyTimer) { clearTimeout(camDollyTimer); camDollyTimer = null; }
  if (!animate) {
    cam.style.transition = 'none';
    cam.style.transform  = (k === 1) ? '' : `scale(${k})`;
    // The flush below exists so a LATER transition starts from this value rather
    // than animating out of the old one. During the opening shot there is no
    // transition - the next frame just writes the next scale - so a forced reflow
    // per frame for seven seconds would be pure cost.
    if (camBootRaf) return;
    cam.style.willChange = '';
    void cam.offsetWidth;
    cam.style.transition = '';
    return;
  }
  cam.style.willChange = 'transform';
  cam.style.transition = `transform ${CAM_DUR}ms ${CAM_EASE}`;
  cam.style.transform  = `scale(${k})`;
  // scale(1) and no transform paint identically, so dropping the transform on
  // arrival is invisible - and it is what gives the fixed overlays inside #stage
  // their real viewport anchoring back. Never clear it while still zoomed out.
  camDollyTimer = setTimeout(() => {
    camDollyTimer = null;
    cam.style.willChange = '';
    if (camView === 'play') { cam.style.transition = 'none'; cam.style.transform = ''; void cam.offsetWidth; cam.style.transition = ''; }
  }, CAM_DUR + 60);
}

function camSetView(view, animate) {
  if (view !== 'wide' && view !== 'play') return;
  const changing = (view !== camView);
  // Pressing PLAY during the opening shot must not dolly in from 0.42 x the wide
  // framing - end the creep on its final value first, then run the real move. Only
  // when the view is REALLY changing: the attract screens re-assert 'wide' as they
  // open and close, and cancelling on those snapped the photo office's fifteen
  // second drift to its end the moment the mode carousel appeared.
  if (camBootRaf && changing) camEndBootDolly();
  camView = view;
  document.body.classList.toggle('cam-play', view === 'play');
  document.body.classList.toggle('cam-wide', view === 'wide');
  const reduce = document.body.classList.contains('reduced-motion');
  camApply(!!animate && changing && !reduce);
}

// The dolly IN is explicit (startGame calls it) - a run starting is the only
// thing that means "we are on the machine now". The dolly OUT is driven off the
// menu screens showing, which covers every one of the ~10 places that put the
// player back at the menu without touching any of them. Deliberately one-way:
// SETTINGS / HISTORY / BUILDS all HIDE the main menu to open their own screen,
// so reacting to the class going away would push the camera in behind them.
function camInit() {
  if (typeof officeInit === 'function') officeInit();
  ['main-menu-overlay', 'mode-select-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || typeof MutationObserver !== 'function') return;
    new MutationObserver(() => {
      if (!el.classList.contains('show')) return;
      // The photo office puts an attract screen back up ON PURPOSE for the length
      // of its push in. Without this latch that reads as "the player went back to
      // the menu" and the camera would pull out through its own dolly.
      if (typeof officeEntering !== 'undefined' && officeEntering) return;
      if (typeof officeLastAttract !== 'undefined') officeLastAttract = id;
      // Back at the menu: the photograph comes back before the camera pulls out to
      // it, or the pull-out would be framing a scene that is not there yet. Once the
      // photo office has been cut away it answers 'stay' instead, and the camera is
      // left where it is - the opening does not play twice and the menu comes back
      // flat and full-screen rather than shrinking onto a desk.
      if (typeof officeReturnToMenu === 'function' && officeReturnToMenu() === 'stay') return;
      camSetView('wide', true);
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
  });
  const onMenu = !!document.getElementById('main-menu-overlay')?.classList.contains('show');
  camSetView(onMenu ? 'wide' : 'play', false);
  // The r185 opening creep is a CABINET shot - it starts behind the wide framing,
  // which in photo mode means behind the edge of the photograph. Photo mode opens
  // on the framed photo instead and saves the push for the run starting.
  if (onMenu && !(typeof officeShowing !== 'undefined' && officeShowing)) camPlayBootDolly();
  // js/settings.js applies its stored values at load, before #room may have been
  // reachable from every path; re-assert here now the scene definitely exists.
  if (typeof SETTINGS !== 'undefined') camSetRoomStyle(SETTINGS.roomStyle);
}

// ── The office's two moods ──────────────────────────────────────────────────
// 'grimy' (the default) is the same room left running for years: dimmer,
// yellower, stained, with a failing tube. It is a class on #room, so css/room.css
// carries it as overrides on one shared geometry. Wired to Settings > Display.
function camSetRoomStyle(style) {
  camRoom()?.classList.toggle('grimy', style !== 'clean');
}

// ── The opening shot ────────────────────────────────────────────────────────
// Seven seconds of the camera drifting in on the machine while the menu waits on
// its CRT. Driven by rAF over a multiplier rather than by a CSS transition, so
// the several relayouts the first second triggers (rAF pass, DOMContentLoaded,
// load, fonts.ready - see js/bootstrap.js) recompute camWideK and re-apply
// underneath it instead of stamping on a transition halfway through.
function camPlayBootDolly(fromMul, ms) {
  if (document.body.classList.contains('reduced-motion')) return;
  const cam = camEl(); if (!cam) return;
  const FROM = (typeof fromMul === 'number' && fromMul > 0 && fromMul < 1) ? fromMul : CAM_BOOT_OUT;
  const DUR  = (typeof ms === 'number' && ms > 0) ? ms : CAM_BOOT_MS;
  const t0 = performance.now();
  cam.style.willChange = 'transform';
  camBootRaf = requestAnimationFrame(function step(t) {
    const p = Math.min(1, (t - t0) / DUR);
    // A gentler ease-out than the cabinet's cubic. Over fifteen seconds a cubic
    // spends most of the shot already stopped, which reads as the drift having
    // finished early; squared keeps it visibly moving for most of its length.
    const eased = 1 - Math.pow(1 - p, 2);
    camBootMul = FROM + (1 - FROM) * eased;
    camApply(false);
    camBootRaf = (p < 1) ? requestAnimationFrame(step) : null;
    if (!camBootRaf) camEndBootDolly();
  });
  camBootMul = CAM_BOOT_OUT;
  camApply(false);
}

function camEndBootDolly() {
  if (camBootRaf) { cancelAnimationFrame(camBootRaf); camBootRaf = null; }
  camBootMul = 1;
  const cam = camEl(); if (cam) cam.style.willChange = '';
  camApply(false);
}

// Replay the opening move, for anyone who wants to look at it again (Settings >
// Display > Intro animation). From the menu it pulls back, pushes in, and returns
// to the menu; from inside a run it pulls out to the desk and comes back, so the
// run is exactly where it was when it finishes.
let camIntroRunning = false;
function camPlayIntro() {
  if (camIntroRunning) return;
  camIntroRunning = true;
  if (typeof closeSettings === 'function') { try { closeSettings(); } catch (e) {} }
  const fromPlay = (camView === 'play');
  const outFor = fromPlay ? CAM_DUR + 250 : 0;   // time spent pulling back first
  camSetView('wide', fromPlay);
  const hold = 900;                               // a beat on the desk before the push
  setTimeout(() => camSetView('play', true), outFor + hold);
  if (!fromPlay) setTimeout(() => camSetView('wide', true), outFor + hold + CAM_DUR + 1100);
  setTimeout(() => { camIntroRunning = false; }, outFor + hold + CAM_DUR * 2 + 1200);
}

function camEnterGame() {
  // Entering a run always clears the attract screens off the glass. Every path in
  // hides them itself today, but they are no longer unmissable full-viewport
  // sheets - they are just something the CRT is displaying - so a path that
  // forgets would leave the menu sitting over a live board instead of over
  // everything. Removing .show here cannot loop: the observer only reacts to the
  // class being ADDED.
  // The photo office runs its own entrance: a slow push in on the monitor with
  // the menu still lit on it, then a channel change that swaps the photograph out
  // for the real UI. It removes the attract screens itself, at the collapse.
  if (typeof officeShowing !== 'undefined' && officeShowing) { officeEnterGame(); return; }
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  camSetView('play', true);
}
