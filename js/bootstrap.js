initMainMenu();
// The red SCORE / GOAL chips (and the top-bar act readout) reopen a boss's
// briefing. Bound once - each handler no-ops unless a boss is running.
if (typeof bindBossBriefReopen === 'function') bindBossBriefReopen();
initDevMode();

// ── STAGE SCALING (zoom-based) ──
// The zoom itself now belongs to js/camera.js: as of r180 it fits the STAGE to
// the viewport (not the whole cabinet housing), so the beige housing falls off
// the edges during play and the board gets the full display. The wide "cabinet
// on a desk" framing the menu sits in is a camera transform on top of that, not
// a second zoom - see the header of js/camera.js. This block keeps what it
// always owned: deciding landscape vs portrait, and everything downstream of it.
(function setupStageScaling() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const cabinet = document.getElementById('cabinet');
  const BODY_PAD = 14; // matches body padding above; reserves visible buffer
  function update() {
    const availW = window.innerWidth  - BODY_PAD * 2;
    const availH = window.innerHeight - BODY_PAD * 2;
    // Landscape when wider than tall AND wide enough to be meaningful
    const isLandscape = availW > availH && availW >= 480;
    // The class has to land BEFORE camLayout measures, or the stage is still the
    // other orientation's size when the camera works out where to centre it.
    stage.classList.toggle('landscape', isLandscape);
    if (cabinet) cabinet.classList.toggle('landscape', isLandscape);
    // Sets --stage-zoom, --cab-w/--cab-h, places the scene, re-applies the framing.
    camLayout(isLandscape);
    // Turning a tablet mid-run switches layouts; re-assert the portrait strip's
    // shared-half state so it isn't left showing whatever landscape left behind.
    if (typeof syncPortraitPanel === 'function') syncPortraitPanel();
    // …and re-fit any preview cards on screen, which are sized from the strip.
    if (typeof fitPortraitPreviewCards === 'function') fitPortraitPreviewCards();
    // Larger inter-card gap in landscape keeps bigger cards visually separated.
    CARD_GAP = isLandscape ? 5 : 3;
    // Fallback footprints (only used if the slot can't be measured pre-layout).
    GRID_FOOTPRINT_W = isLandscape ? 380 : 320;
    GRID_FOOTPRINT_H = isLandscape ? 408 : 392;
    // Card sizing now measures the real grid slot - recompute after the class
    // toggle/zoom have been applied so the measurement reflects this layout.
    recomputeGridMetrics();
  }
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  update(); // initial run - also handles the first recomputeGridMetrics
  camInit();
  // One more pass after first paint, in case fonts/layout shifted the slot size.
  requestAnimationFrame(update);
  // …and again once the document is actually finished. This is not belt-and-braces:
  // the game's <script> tags live at the bottom of #stage, so while they run the
  // parser has NOT yet reached #cab-baseline - the cabinet measures 10px short and
  // the camera centres the board 5px high for the rest of the session. The rAF pass
  // above can still fire before the parser gets there, so DOMContentLoaded is the
  // first moment the housing is whole.
  document.addEventListener('DOMContentLoaded', update);
  window.addEventListener('load', update);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(update).catch(() => {});
})();

// ── Fullscreen support ──────────────────────────────────────────────
// Two paths to a bar-free view on mobile:
//   1) Fullscreen API - works in-browser on Android Chrome (and desktop).
//   2) "Add to Home Screen" (PWA) - the only bar-free option on iOS Safari.
// Both just show the live page; nothing is downloaded per-version.
function fsElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}
function fsSupported() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}
function isStandalone() {
  // Already launched from a home-screen icon → no bar to hide.
  return (window.matchMedia && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches)
    || window.navigator.standalone === true;
}
// Auto-fullscreen preference: ON by default; flipped off if the player
// deliberately exits via our button, so PLAY stops forcing it after that.
function autoFullscreenPref() { return localStorage.getItem('autoFullscreen') !== 'false'; }
function setAutoFullscreenPref(on) { try { localStorage.setItem('autoFullscreen', on ? 'true' : 'false'); } catch (e) {} }
function requestFs() {
  const el = document.documentElement;
  try { (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) {}
}
function toggleFullscreen() {
  try {
    if (fsElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      setAutoFullscreenPref(false); // player chose windowed - remember it
    } else {
      requestFs();
      setAutoFullscreenPref(true);
    }
  } catch (e) { /* older engines may reject; the iOS hint covers those */ }
}
// Fullscreen must be requested inside a user gesture - this rides the PLAY tap,
// so on Android/desktop the game goes fullscreen when a run starts, no extra tap.
// (Browsers forbid entering fullscreen automatically on page load.)
function maybeAutoFullscreen() {
  if (isStandalone() || !fsSupported() || fsElement() || !autoFullscreenPref()) return;
  requestFs();
}
function updateFullscreenBtn() {
  const btn = document.getElementById('menu-fullscreen-btn');
  if (btn) btn.textContent = fsElement() ? '⛶ EXIT FULLSCREEN' : '⛶ FULLSCREEN';
}
// Sync the dev/settings-panel Display controls to reality (label + checkbox).
// Lives here so all fullscreen logic stays together; called on panel open and
// whenever fullscreen state changes.
function devSyncFullscreen() {
  const btn = document.getElementById('dev-fullscreen-btn');
  if (btn) {
    if (!fsSupported()) { btn.disabled = true; btn.textContent = 'Fullscreen not available here'; }
    else { btn.disabled = false; btn.textContent = fsElement() ? 'Exit Fullscreen' : 'Enter Fullscreen'; }
  }
  const cb = document.getElementById('dev-autofs-toggle');
  if (cb) cb.checked = autoFullscreenPref();
}
function onFsChange() { updateFullscreenBtn(); devSyncFullscreen(); }
document.addEventListener('fullscreenchange', onFsChange);
document.addEventListener('webkitfullscreenchange', onFsChange);

(function initFullscreenControls() {
  const btn = document.getElementById('menu-fullscreen-btn');
  const hint = document.getElementById('ios-fullscreen-hint');
  if (isStandalone()) return; // launched fullscreen already - show neither control
  if (fsSupported()) {
    if (btn) { btn.style.display = 'block'; updateFullscreenBtn(); }
  } else if (hint) {
    // iOS Safari: no Fullscreen API - guide the player to Add to Home Screen.
    hint.style.display = 'block';
  }
})();

// Stamp build string into both visible locations
(function() {
  const els = ['build-stamp', 'menu-build-stamp'];
  els.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = BUILD; });
})();
