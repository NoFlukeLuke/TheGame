initMainMenu();
initDevMode();

// ── STAGE SCALING (zoom-based) ──
// Computes a uniform zoom factor that fits the design canvas inside the viewport.
// Portrait: 420×740 canvas (default). Landscape/wide: 760×420 canvas.
// Letterbox area shows the body's green-felt background.
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
    // Zoom now fits the whole CABINET housing (stage + bezel/marquee/deck).
    const DESIGN_W = isLandscape ? 824 : 496;
    // Cabinet housing height after the thinned top bar + beige baseline (r117).
    // Smaller than before → the zoom-to-fit scales the whole game up into the
    // space the old thick marquee/deck used to occupy.
    const DESIGN_H = isLandscape ? 506 : 826;
    const z = Math.min(availW / DESIGN_W, availH / DESIGN_H);
    // Set on :root so both #cabinet (zoom) and #stage (grid measurement) inherit it.
    document.documentElement.style.setProperty('--stage-zoom', z);
    stage.classList.toggle('landscape', isLandscape);
    if (cabinet) cabinet.classList.toggle('landscape', isLandscape);
    // Larger inter-card gap in landscape keeps bigger cards visually separated.
    CARD_GAP = isLandscape ? 5 : 3;
    // Fallback footprints (only used if the slot can't be measured pre-layout).
    GRID_FOOTPRINT_W = isLandscape ? 380 : 320;
    GRID_FOOTPRINT_H = isLandscape ? 408 : 392;
    // Card sizing now measures the real grid slot — recompute after the class
    // toggle/zoom have been applied so the measurement reflects this layout.
    recomputeGridMetrics();
  }
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  update(); // initial run — also handles the first recomputeGridMetrics
  // One more pass after first paint, in case fonts/layout shifted the slot size.
  requestAnimationFrame(update);
})();

// ── Fullscreen support ──────────────────────────────────────────────
// Two paths to a bar-free view on mobile:
//   1) Fullscreen API — works in-browser on Android Chrome (and desktop).
//   2) "Add to Home Screen" (PWA) — the only bar-free option on iOS Safari.
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
function toggleFullscreen() {
  const el = document.documentElement;
  try {
    if (fsElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  } catch (e) { /* older engines may reject; the iOS hint covers those */ }
}
function updateFullscreenBtn() {
  const btn = document.getElementById('menu-fullscreen-btn');
  if (btn) btn.textContent = fsElement() ? '⛶ EXIT FULLSCREEN' : '⛶ FULLSCREEN';
}
document.addEventListener('fullscreenchange', updateFullscreenBtn);
document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);

(function initFullscreenControls() {
  const btn = document.getElementById('menu-fullscreen-btn');
  const hint = document.getElementById('ios-fullscreen-hint');
  if (isStandalone()) return; // launched fullscreen already — show neither control
  if (fsSupported()) {
    if (btn) { btn.style.display = 'block'; updateFullscreenBtn(); }
  } else if (hint) {
    // iOS Safari: no Fullscreen API — guide the player to Add to Home Screen.
    hint.style.display = 'block';
  }
})();

// Stamp build string into both visible locations
(function() {
  const els = ['build-stamp', 'menu-build-stamp'];
  els.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = BUILD; });
})();
