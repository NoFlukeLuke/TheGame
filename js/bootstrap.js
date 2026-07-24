initMainMenu();
initDevMode();

// ── STAGE SCALING (zoom-based) ──
// Computes a uniform zoom factor that fits the design canvas inside the viewport.
// Portrait: 420×740 canvas (default). Landscape/wide: 760×420 canvas.
// Letterbox area shows the body's green-felt background.
(function setupStageScaling() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const BODY_PAD = 14; // matches body padding above; reserves visible buffer
  function update() {
    const availW = window.innerWidth  - BODY_PAD * 2;
    const availH = window.innerHeight - BODY_PAD * 2;
    // Landscape when wider than tall AND wide enough to be meaningful
    const isLandscape = availW > availH && availW >= 480;
    const DESIGN_W = isLandscape ? 747 : 420;
    const DESIGN_H = isLandscape ? 420 : 740;
    const z = Math.min(availW / DESIGN_W, availH / DESIGN_H);
    stage.style.setProperty('--stage-zoom', z);
    stage.classList.toggle('landscape', isLandscape);
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

// Stamp build string into both visible locations
(function() {
  const els = ['build-stamp', 'menu-build-stamp'];
  els.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = BUILD; });
})();
