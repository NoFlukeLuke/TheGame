const SCROLL_DIGIT_IDS = new Set(['score-total-num']);

function animateDigitEl(el, value) {
  if (!el) return;
  const str = typeof value === 'number' ? value.toLocaleString() : String(value);
  if (el.textContent === str) return;
  if (SCROLL_DIGIT_IDS.has(el.id)) {
    scrollDigitEl(el, str);
  } else {
    el.textContent = str;
    el.classList.remove('digit-pop');
    void el.offsetWidth;
    el.classList.add('digit-pop');
  }
}

function scrollDigitEl(el, newStr) {
  const oldStr = el.dataset.displayVal || '';
  el.dataset.displayVal = newStr;

  // Determine direction: compare numeric value if possible
  const oldNum = parseFloat(oldStr.replace(/,/g, ''));
  const newNum = parseFloat(newStr.replace(/,/g, ''));
  const increasing = isNaN(oldNum) || isNaN(newNum) || newNum >= oldNum;

  // Build character arrays, padding old to same length as new with leading spaces
  const oldChars = oldStr.split('');
  const newChars = newStr.split('');

  // Pad old chars on the left to match new length
  while (oldChars.length < newChars.length) oldChars.unshift(' ');
  // If new is shorter, trim old from the left
  while (oldChars.length > newChars.length) oldChars.shift();

  el.innerHTML = '';
  el.classList.add('scroll-digits');

  newChars.forEach((ch, i) => {
    const oldCh = oldChars[i] || ' ';
    const isStatic = ch === oldCh || ch === ',' || ch === '.';

    if (isStatic) {
      // Non-animating character
      const span = document.createElement('span');
      span.textContent = ch;
      el.appendChild(span);
    } else {
      // Animating digit
      const wrap = document.createElement('span');
      wrap.className = 'scroll-digit-wrap';

      const inner = document.createElement('span');
      inner.className = 'scroll-digit-inner';
      inner.textContent = ch;
      inner.style.animationName = increasing ? 'scroll-in-right' : 'scroll-in-left';

      wrap.appendChild(inner);
      el.appendChild(wrap);
    }
  });
}

function popSubbox(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('subbox-pop');
  void el.offsetWidth;
  el.classList.add('subbox-pop');
}

// Wrap ♠ glyphs in a halo span so pure-black spade renders are legible on dark surfaces.
// Use this for any innerHTML that may contain ♠.
function withSuitHalo(text) {
  if (text == null) return text;
  return String(text).replace(/♠/g, '<span class="spade-halo">♠</span>');
}

// Highlight score/resource keywords in tooltips & descriptions with their colors.
// pips=blue, mult=red, focus=purple, credits=yellow, time/seconds=black+white glow,
// replay/retrigger=white+rgb glow (both share the color; words stay distinct).
// Single-pass replace: inserted spans are never re-scanned, so it's safe to run once
// on plain description text (compose as colorizeKeywords(withSuitHalo(desc))).
// Kept as the shared entry point (lots of call sites), but the term list and
// colours now live in js/keywords.js so tooltips, previews and the carousel all
// highlight the same vocabulary. Falls back to the old inline set if that file
// somehow isn't loaded.
function colorizeKeywords(text) {
  if (text == null) return text;
  if (typeof highlightKeywords === 'function') return highlightKeywords(text);
  return String(text);
}

// ══════════════════════════════════════════════
// FOCUS METER (formerly Fate Meter)
// ══════════════════════════════════════════════
function focusColor(nodes) {
  const charges = Math.min(Math.floor(nodes / FOCUS_THRESHOLD), FOCUS_COLORS.length - 1);
  return FOCUS_COLORS[charges];
}

// Continuous-bar model (r96): one node per point of the FULL capacity (cap*10),
// filled bottom→top to the current focus level. Color grades cool→hot by height so
// altitude itself reads as intensity; a tick marks every 10-node charge boundary.
function focusNodeColor(i, cap) {
  const f = cap <= 1 ? 0 : i / (cap - 1);
  // stops: mint → cyan → yellow → magenta
  const stops = [[53,213,155],[22,200,216],[255,206,43],[255,47,142]];
  const seg = f * (stops.length - 1);
  const a = Math.min(stops.length - 1, Math.floor(seg));
  const b = Math.min(stops.length - 1, a + 1);
  const t = seg - a;
  const m = (x, y) => Math.round(x + (y - x) * t);
  return `rgb(${m(stops[a][0],stops[b][0])},${m(stops[a][1],stops[b][1])},${m(stops[a][2],stops[b][2])})`;
}
function buildFocusMeter() {
  const seg = document.getElementById('focus-active-segment');
  if (!seg) return;
  const cap = focusCapNodes();
  seg.innerHTML = '';
  focusNodeEls = [];
  for (let i = 0; i < cap; i++) {
    const node = document.createElement('div');
    // tick class on the first node of each new charge (except the very bottom)
    node.className = 'focus-node' + ((i > 0 && i % FOCUS_THRESHOLD === 0) ? ' tick' : '');
    seg.appendChild(node); // column-reverse: first child = bottom of bar
    focusNodeEls.push(node);
  }
}

function syncFocusMeterState() {
  const cap = focusCapNodes();
  // Capacity can grow mid-run (Expanse / Quick Draw) - keep the bar's node count in sync.
  if (focusNodeEls.length !== cap) buildFocusMeter();
  const total = Math.min(focusNodes, cap);
  // Meter-wide glow color tracks the current top of the fill.
  document.documentElement.style.setProperty('--focus-color', focusNodeColor(Math.max(0, total - 1), cap));
  focusNodeEls.forEach((node, i) => {
    const on = i < total;
    node.classList.toggle('filled', on);
    if (on) { const c = focusNodeColor(i, cap); node.style.background = c; node.style.boxShadow = '0 0 3px ' + c; }
    else    { node.style.background = ''; node.style.boxShadow = ''; }
  });
  applyFocusGlow();
  updateFocusMultReadout();
}

// Updates the multiplier readout text + active/dim state. Optionally pulses.
function updateFocusMultReadout(pulse = false) {
  const mult = focusMultiplier();
  // FOCUS score box mirrors the live focus multiplier (suppressed mid-dance; the dance drives it)
  const fvEl = document.getElementById('focus-val');
  if (fvEl && !danceAbortController) fvEl.textContent = (mult === 1) ? '×1' : '×' + mult.toFixed(1);
  const el = document.getElementById('focus-mult-readout');
  if (!el) return;
  el.textContent = '×' + mult.toFixed(1);
  const active = focusNodes > FOCUS_THRESHOLD;
  el.classList.toggle('active', active);
  el.classList.toggle('dim', !active);
  if (pulse) {
    el.classList.remove('pulsing');
    void el.offsetWidth;
    el.classList.add('pulsing');
  }
}

function updateFocusMeter() {
  syncFocusMeterState();
}

// ══════════════════════════════════════════════
// FOCUS GAUGE FX - fill-scaled jitter + glow (r97)
// ══════════════════════════════════════════════
// Fraction of the bar that's full (0..1).
function focusFillFrac() {
  const cap = focusCapNodes();
  return cap > 0 ? Math.max(0, Math.min(1, focusNodes / cap)) : 0;
}
// Jitter ramp: 0 at/below ×1.0 (the warm-up charge), rising to 1 at full along the curve.
function focusJitterFrac() {
  const cap = focusCapNodes();
  const denom = cap - FOCUS_THRESHOLD;
  const p = denom > 0 ? Math.max(0, Math.min(1, (focusNodes - FOCUS_THRESHOLD) / denom)) : 0;
  return Math.pow(p, FOCUS_FX.jitterCurve);
}
function focusReduceMotion() {
  return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
// Glow: subtle early, blooming to glowMaxPx at full. Driven via CSS vars so the bezel
// keeps its own inset shadows (see #focus-bar-outer box-shadow in style.css).
function applyFocusGlow() {
  const outer = document.getElementById('focus-bar-outer');
  if (!outer) return;
  const cap = focusCapNodes();
  const blur = FOCUS_FX.glowMaxPx * Math.pow(focusFillFrac(), FOCUS_FX.glowCurve);
  if (blur > 0.5 && focusNodes > 0) {
    const color = focusNodeColor(Math.max(0, Math.min(cap - 1, focusNodes - 1)), cap);
    outer.style.setProperty('--focus-glow', blur.toFixed(1) + 'px');
    outer.style.setProperty('--focus-glow-color', color);
  } else {
    outer.style.setProperty('--focus-glow', '0px');
    outer.style.setProperty('--focus-glow-color', 'transparent');
  }
}
// Jitter loop: discrete shakes whose amplitude AND rate scale with fill; off at/below ×1.0.
let _focusJitterLast = 0, _focusJX = 0, _focusJY = 0, _focusJitterOn = false;
function focusFxLoop(ts) {
  const outer = document.getElementById('focus-bar-outer');
  if (outer) {
    const jf = focusReduceMotion() ? 0 : focusJitterFrac();
    const amp = FOCUS_FX.jitterMaxPx * jf;
    if (amp > 0.05) {
      const interval = 45 + (1 - jf) * 95;      // ~140ms slow → ~45ms fast when fuller
      if (ts - _focusJitterLast >= interval) {
        _focusJX = (Math.random() * 2 - 1) * amp;
        _focusJY = (Math.random() * 2 - 1) * amp;
        _focusJitterLast = ts;
      }
      outer.style.transform = 'translate(' + _focusJX.toFixed(2) + 'px,' + _focusJY.toFixed(2) + 'px)';
      _focusJitterOn = true;
    } else if (_focusJitterOn) {
      outer.style.transform = 'translate(0,0)';
      _focusJitterOn = false;
    }
  }
  requestAnimationFrame(focusFxLoop);
}
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusFxLoop);

function addFocus(amount) {
  if (!amount || amount <= 0) return;
  focusGenGame += amount; focusGenRound += amount; // total Focus generated (any source) - Wellspring / Feedback Loop
  focusDecayBuffer = 0;   // gaining focus resets the x.0 grace buffer
  const cap = focusCapNodes();
  const prev = Math.min(focusNodes, cap);
  focusNodes = Math.min(focusNodes + amount, cap);
  const _justMaxed = prev < cap && focusNodes === cap;
  // Expanse: each time we hit max capacity, bump the cap by 10 nodes (for the rest of the run)
  if (hasTrick('expanse') && _justMaxed) {
    focusCapPerm += 10;
  }
  // r123 focus-payout entities fire on the transition INTO max Focus.
  if (_justMaxed) onFocusMaxed();
  // Keep the bar's node count in sync if capacity changed, preserving already-filled nodes.
  if (focusNodeEls.length !== focusCapNodes()) {
    buildFocusMeter();
    const c0 = focusCapNodes();
    focusNodeEls.forEach((n, i) => { if (i < prev) { const c = focusNodeColor(i, c0); n.classList.add('filled'); n.style.background = c; n.style.boxShadow = '0 0 3px ' + c; } });
  }
  const newTotal = Math.min(focusNodes, focusCapNodes());
  for (let i = prev; i < newTotal; i++) focusAnimQueue.push({ nodeIdx: i });
  runFocusAnimQueue();
}

// ── Focus-payout entities (r123): fire when Focus transitions INTO max ──
// Called from inside addFocus. Resource/credit grants happen immediately; any Focus
// *drop* is deferred ~260ms so the fill-to-max animation plays first (a visible
// "discharge" beat) and we never call removeFocus() while addFocus's queue is mid-flight.
function onFocusMaxed() {
  // Immediate grants; any Focus DROP or cap change is deferred ~260ms so the fill-to-max
  // animation plays first and we never mutate focusNodes while addFocus's queue is in flight.
  let keepFrac = null; // smallest "fraction of cap to keep" across active droppers (min wins)
  if (hasKnack('dividend')) {
    coins += BAL.dividend.credits; updateCoinsUI();
    showMessage(`🏦 Dividend - +${BAL.dividend.credits} credits`, 'var(--gold)');
    keepFrac = Math.min(keepFrac ?? 1, BAL.dividend.keep_fraction);   // reset to 33% of max
  }
  if (hasTrick('release_valve')) {
    swaps++; discards++;
    showMessage('🎚️ Release Valve - +1 swap, +1 discard', 'var(--gold)');
    if (!animating && !falling) render();
    keepFrac = Math.min(keepFrac ?? 1, BAL.release_valve.keep_fraction); // lose 50% Focus
  }
  const _gs = hasKnack('growth_spurt');
  if (_gs) {
    // Each max lowers the ceiling by 5 (permanent, floored in focusCapNodes); the random
    // limit is banked once and granted at round end (triggerLevelUp) if you maxed at all.
    growthSpurtMaxedThisRound = true;
    showMessage(`🌱 Growth Spurt - max Focus −${BAL.growth_spurt.cap_reduction}`, 'var(--gold)');
  }
  if (keepFrac !== null || _gs) setTimeout(() => {
    if (_gs) growthSpurtCapPenalty += BAL.growth_spurt.cap_reduction;
    const cap = focusCapNodes();
    let target = focusNodes;
    if (keepFrac !== null) target = Math.min(target, Math.floor(cap * keepFrac));
    target = Math.min(target, cap);                  // Growth Spurt may have lowered the ceiling
    const amt = Math.max(0, focusNodes - target);
    if (amt > 0) removeFocus(amt);
    else { buildFocusMeter(); syncFocusMeterState(); } // cap shrank but nothing to drop - resync
  }, 260);
}

// Spawn a temp clone of `srcEl` at its current viewport position on document.body,
// then animate it: sideways pop, fall off bottom, rotate, fade.
// `kind` is 'node' or 'dot' (for sfx timing parity).
function spawnFocusFallClone(srcEl, opts = {}) {
  if (!srcEl) return;
  const rect = srcEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const cs = getComputedStyle(srcEl);
  const clone = document.createElement('div');
  clone.style.cssText = `
    position:fixed;
    left:${rect.left}px;
    top:${rect.top}px;
    width:${rect.width}px;
    height:${rect.height}px;
    background:${cs.backgroundColor};
    box-shadow:${cs.boxShadow};
    border-radius:${cs.borderRadius};
    border:${cs.border};
    pointer-events:none;
    z-index:9999;
    will-change:transform,opacity;
  `;
  document.body.appendChild(clone);

  const dx = (Math.random() * 40) - 20; // ±20px
  const dy = window.innerHeight - rect.top + 40;
  const rot = (Math.random() * 120) - 60; // ±60deg
  const dur = 600;
  const popDelay = opts.delay || 0;

  // Two-stage sfx: pop at fall start, drop ~150ms in
  setTimeout(() => sfxFocusNodePop(), popDelay);
  setTimeout(() => sfxFocusNodeDrop(), popDelay + 150);

  const anim = clone.animate([
    { transform: 'translate(0,0) rotate(0deg)', opacity: 1, offset: 0 },
    { transform: `translate(${dx * 0.4}px, -4px) rotate(${rot * 0.15}deg)`, opacity: 1, offset: 0.12 },
    { transform: `translate(${dx}px, ${dy * 0.45}px) rotate(${rot * 0.6}deg)`, opacity: 0.85, offset: 0.55 },
    { transform: `translate(${dx * 1.1}px, ${dy}px) rotate(${rot}deg)`, opacity: 0, offset: 1 },
  ], { duration: dur, delay: popDelay, easing: 'cubic-bezier(0.3, 0.0, 0.7, 1.0)', fill: 'forwards' });
  anim.onfinish = () => clone.remove();
}

// Remove `amount` nodes from the top of the bar with a sideways-pop-and-fall animation.
function removeFocus(amount) {
  if (!amount || amount <= 0) return;

  const cap = focusCapNodes();
  const prevTotal = Math.min(focusNodes, cap);
  const newTotal  = Math.max(0, prevTotal - amount);

  // The now-topmost filled nodes (indexes newTotal..prevTotal-1) fall away; highest first.
  const nodesToFall = [];
  for (let i = prevTotal - 1; i >= newTotal; i--) {
    const n = focusNodeEls[i];
    if (n) nodesToFall.push(n);
  }
  const NODE_STAGGER = 30; // ms between nodes
  nodesToFall.forEach((n, i) => spawnFocusFallClone(n, { delay: i * NODE_STAGGER }));

  // Mutate state and re-render. The real DOM nodes go dark immediately;
  // the temp clones continue their fall on body.
  focusNodes = newTotal;
  syncFocusMeterState();
  updateFocusMultReadout(true);
}

function runFocusAnimQueue() {
  if (focusAnimRunning) return;
  focusAnimRunning = true;

  function step() {
    if (focusAnimQueue.length === 0) { focusAnimRunning = false; return; }
    const item = focusAnimQueue.shift();
    const node = focusNodeEls[item.nodeIdx];
    if (!node) { step(); return; }
    const c = focusNodeColor(item.nodeIdx, focusCapNodes());
    node.classList.add('filled');
    node.style.background = c;
    node.style.boxShadow = '0 0 3px ' + c;
    node.style.animation = 'none';
    void node.offsetWidth;
    node.style.animation = 'focusNodePop 0.15s ease';
    applyFocusGlow();
    // Pulse the readout once past the warm-up charge (node 11+ = multiplier > 1)
    updateFocusMultReadout(item.nodeIdx + 1 > FOCUS_THRESHOLD);
    setTimeout(step, 70);
  }
  step();
}

// ── Focus decay: tick down 1 node every `focusDecayIntervalMs` ms while active ──
function isFocusDecayPaused() {
  // First Wind: no decay for first 45s of round (measured via mutable roundSeconds,
  // so swaps/discards that consume time also consume the grace window)
  // NOTE: this measures the grace window against ROUND_DURATION, so it only makes
  // sense in a mode whose clock starts at (or below) that. Flow's starts at 300 and
  // would compute negative elapsed - which is why first_wind is in
  // FLOW_BANNED_ENTITIES and can never be owned there.
  if (typeof hasTrick === 'function' && hasTrick('first_wind')) {
    const elapsed = ROUND_DURATION - roundSeconds;
    if (elapsed < 45) return true;
  }
  return (typeof isPaused !== 'undefined' && isPaused)
      || (typeof interludeActive !== 'undefined' && interludeActive)
      || (typeof gameTimerPaused !== 'undefined' && gameTimerPaused)
      || (typeof roundEnded !== 'undefined' && roundEnded)
      || (typeof pipeTimerPaused !== 'undefined' && pipeTimerPaused);
}

function focusDecayTick() {
  if (isFocusDecayPaused()) return;
  // Don't decay mid-animation - removeFocus() would mutate focusNodes and re-sync the
  // meter while addFocus()'s fill animation is still in flight, causing the visual
  // "jump up then get wiped" desync.
  if (focusAnimRunning) return;
  if (focusNodes <= 0) return;
  // Buffer: when focus lands on a whole-number multiplier (x.0 - i.e. focusNodes is a
  // multiple of the threshold), hold for 3 ticks before dropping to (x-1).9. Feels nicer.
  if (focusNodes >= FOCUS_THRESHOLD && focusNodes % FOCUS_THRESHOLD === 0) {
    if (focusDecayBuffer < 2) { focusDecayBuffer++; return; }
  }
  focusDecayBuffer = 0;
  removeFocus(1);
}

function startFocusDecay() {
  stopFocusDecay();
  focusDecayTimerId = setInterval(focusDecayTick, focusDecayIntervalMs);
}

function stopFocusDecay() {
  if (focusDecayTimerId !== null) {
    clearInterval(focusDecayTimerId);
    focusDecayTimerId = null;
  }
}

// Reset the decay timer - called on every play/swap/discard so the next decay tick
// is the full interval away from the most recent action.
function resetFocusDecayTimer() {
  if (focusDecayTimerId !== null) {
    clearInterval(focusDecayTimerId);
    focusDecayTimerId = setInterval(focusDecayTick, focusDecayIntervalMs);
  } else {
    startFocusDecay();
  }
}

