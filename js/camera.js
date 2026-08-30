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
const CAM_EASE     = 'cubic-bezier(0.45, 0.04, 0.22, 1)';
// The room canvas, in the same design px as the cabinet. Its centre is the
// cabinet's centre; css/room.css lays the cubicle out inside this box. It has to
// out-cover the widest framing on the tallest screen - portrait at CAM_WIDE_FIT
// shows about 2000 design px of height - or the canvas edge shows as a hard seam.
const ROOM_W = 3000, ROOM_H = 2400;

let camView      = 'wide';   // 'wide' | 'play'
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
  camPlaceScene();
  camApply(false);
  return camPlayZoom;
}

function camApply(animate) {
  const cam = camEl();
  if (!cam) return;
  const k = (camView === 'play') ? 1 : camWideK;
  if (camDollyTimer) { clearTimeout(camDollyTimer); camDollyTimer = null; }
  if (!animate) {
    cam.style.transition = 'none';
    cam.style.transform  = (k === 1) ? '' : `scale(${k})`;
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
  ['main-menu-overlay', 'mode-select-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || typeof MutationObserver !== 'function') return;
    new MutationObserver(() => {
      if (el.classList.contains('show')) camSetView('wide', true);
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
  });
  camSetView(document.getElementById('main-menu-overlay')?.classList.contains('show') ? 'wide' : 'play', false);
}

function camEnterGame() {
  // Entering a run always clears the attract screens off the glass. Every path in
  // hides them itself today, but they are no longer unmissable full-viewport
  // sheets - they are just something the CRT is displaying - so a path that
  // forgets would leave the menu sitting over a live board instead of over
  // everything. Removing .show here cannot loop: the observer only reacts to the
  // class being ADDED.
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  camSetView('play', true);
}
