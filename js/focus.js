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
function colorizeKeywords(text) {
  if (text == null) return text;
  return String(text).replace(/\b(pips?|mult|focus|credits?|seconds?|time|replays?|retriggers?)\b/gi, (m) => {
    const w = m.toLowerCase();
    let cls;
    if (w.startsWith('pip'))       cls = 'kw-pips';
    else if (w === 'mult')          cls = 'kw-mult';
    else if (w === 'focus')         cls = 'kw-focus';
    else if (w.startsWith('credit'))cls = 'kw-credits';
    else if (w.startsWith('second') || w === 'time') cls = 'kw-time';
    else                            cls = 'kw-replay'; // replay(s) / retrigger(s)
    return `<span class="${cls}">${m}</span>`;
  });
}

// ══════════════════════════════════════════════
// FOCUS METER (formerly Fate Meter)
// ══════════════════════════════════════════════
function focusColor(nodes) {
  const charges = Math.min(Math.floor(nodes / FOCUS_THRESHOLD), FOCUS_COLORS.length - 1);
  return FOCUS_COLORS[charges];
}

function buildFocusMeter() {
  const seg = document.getElementById('focus-active-segment');
  if (!seg) return;
  seg.innerHTML = '';
  focusNodeEls = [];
  for (let i = 0; i < FOCUS_THRESHOLD; i++) {
    const node = document.createElement('div');
    node.className = 'focus-node';
    seg.appendChild(node); // column-reverse: first child = bottom of segment
    focusNodeEls.push(node);
  }
}

function syncFocusMeterState() {
  const total = Math.min(focusNodes, focusCapacity * FOCUS_THRESHOLD);
  const chargesComplete = Math.floor(total / FOCUS_THRESHOLD);
  let nodesInSegment = total - chargesComplete * FOCUS_THRESHOLD;
  // Color reflects the tier currently being filled (next tier after completed charges)
  let segColorIdx = chargesComplete;
  // On a clean x.0 (the segment would read 0 but focus > 0), show it FULL in the
  // just-completed charge's colour — the bar only ever looks empty at true zero.
  if (total > 0 && nodesInSegment === 0) {
    nodesInSegment = FOCUS_THRESHOLD;
    segColorIdx = chargesComplete - 1;
  }
  const color = FOCUS_COLORS[Math.min(segColorIdx, FOCUS_COLORS.length - 1)];
  document.documentElement.style.setProperty('--focus-color', color);

  // Active segment nodes
  focusNodeEls.forEach((node, i) => {
    node.style.setProperty('--focus-color', color);
    node.classList.toggle('filled', i < nodesInSegment);
  });

  // Dots — light up one per completed charge (only first 3 visible)
  for (let i = 0; i < 3; i++) {
    const dot = document.getElementById(`focus-dot-${i}`);
    if (!dot) continue;
    const dotColor = FOCUS_COLORS[Math.min(i, FOCUS_COLORS.length - 1)];
    dot.style.setProperty('--focus-color', dotColor);
    dot.classList.toggle('lit', i < chargesComplete);
  }

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

function addFocus(amount) {
  if (!amount || amount <= 0) return;
  focusDecayBuffer = 0;   // gaining focus resets the x.0 grace buffer
  const cap = focusCapacity * FOCUS_THRESHOLD;
  const prev = Math.min(focusNodes, cap);
  const prevCharges = Math.floor(prev / FOCUS_THRESHOLD);
  const prevSegNode = prev - prevCharges * FOCUS_THRESHOLD;
  focusNodes = Math.min(focusNodes + amount, cap);
  // Expanse: each time we hit max capacity, bump capacity by 1 (for the rest of the run)
  if (hasTrick('expanse') && prev < cap && focusNodes === cap) {
    focusCapacity++;
  }
  const newCharges = Math.floor(focusNodes / FOCUS_THRESHOLD);
  const newSegNode = focusNodes - newCharges * FOCUS_THRESHOLD;
  const chargeCrossed = newCharges > prevCharges;

  if (chargeCrossed) {
    for (let i = prevSegNode; i < FOCUS_THRESHOLD; i++) focusAnimQueue.push({ segIdx: i });
    focusAnimQueue.push({ sentinel: true, charges: newCharges });
    for (let i = 0; i < newSegNode; i++) focusAnimQueue.push({ segIdx: i });
  } else {
    for (let i = prevSegNode; i < newSegNode; i++) focusAnimQueue.push({ segIdx: i });
  }
  runFocusAnimQueue();
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

// Remove `amount` nodes with sideways-pop-and-fall animation.
// Dots that unlight (charge boundary crossed downward) fall first, then nodes.
function removeFocus(amount) {
  if (!amount || amount <= 0) return;

  // Capture state BEFORE mutation so we can snapshot dot/node positions
  const cap = focusCapacity * FOCUS_THRESHOLD;
  const prevTotal = Math.min(focusNodes, cap);
  const newTotal  = Math.max(0, prevTotal - amount);
  const prevCharges = Math.floor(prevTotal / FOCUS_THRESHOLD);
  const newCharges  = Math.floor(newTotal  / FOCUS_THRESHOLD);

  // Collect the visual elements that need to fall (snapshot DOM refs before sync).
  // Dots: any lit dot whose index >= newCharges and < prevCharges.
  // Nodes: the currently-filled nodes in the active segment that will become unfilled.
  const dotsToFall = [];
  for (let i = newCharges; i < prevCharges && i < 3; i++) {
    const dot = document.getElementById(`focus-dot-${i}`);
    if (dot && dot.classList.contains('lit')) dotsToFall.push(dot);
  }

  // Nodes in the currently-displayed active segment that will visually disappear.
  // After mutation, syncFocusMeterState rebuilds .filled state — so capture which DOM
  // nodes are filled NOW and will be unfilled AFTER, and clone those.
  const prevSegNodes = prevTotal - prevCharges * FOCUS_THRESHOLD;
  const newSegNodes  = newTotal  - newCharges  * FOCUS_THRESHOLD;
  const nodesToFall = [];
  if (newCharges === prevCharges) {
    // Same charge tier — the top-most filled nodes vanish (indexes newSegNodes..prevSegNodes-1)
    for (let i = newSegNodes; i < prevSegNodes; i++) {
      const n = focusNodeEls[i];
      if (n) nodesToFall.push(n);
    }
  } else {
    // Charge boundary crossed — segment will be rebuilt at the new (lower) tier.
    // The visible filled nodes ALL vanish (the segment was full at prevCharges; after dotsToFall
    // animates them away, syncFocusMeterState will re-fill some at the new tier).
    for (let i = 0; i < prevSegNodes; i++) {
      const n = focusNodeEls[i];
      if (n) nodesToFall.push(n);
    }
    // Also, if newSegNodes < FOCUS_THRESHOLD, the nodes above newSegNodes at the new tier
    // were never visually full to begin with — they'll just stay unfilled after sync.
  }

  // Fire dot falls first (small lead so they're visibly first), then node falls.
  const DOT_LEAD = 100; // ms — dots leave first
  const NODE_STAGGER = 30; // ms between nodes
  dotsToFall.forEach((d, i) => spawnFocusFallClone(d, { delay: i * 40 }));
  nodesToFall.forEach((n, i) => spawnFocusFallClone(n, { delay: (dotsToFall.length > 0 ? DOT_LEAD : 0) + i * NODE_STAGGER }));

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

    if (item.sentinel) {
      // Charge completed — light the corresponding dot, then clear nodes & switch color
      const dotIdx = item.charges - 1;
      const dot = document.getElementById(`focus-dot-${dotIdx}`);
      if (dot) {
        const dotColor = FOCUS_COLORS[Math.min(dotIdx, FOCUS_COLORS.length - 1)];
        dot.style.setProperty('--focus-color', dotColor);
        dot.classList.add('lit');
        dot.style.animation = 'none';
        void dot.offsetWidth;
        dot.style.animation = 'focusChargePop 0.35s ease';
      }
      setTimeout(() => {
        const nextColor = FOCUS_COLORS[Math.min(item.charges, FOCUS_COLORS.length - 1)];
        document.documentElement.style.setProperty('--focus-color', nextColor);
        focusNodeEls.forEach(n => {
          n.classList.remove('filled');
          n.style.setProperty('--focus-color', nextColor);
        });
        updateFocusMultReadout(true);
        setTimeout(step, 120);
      }, 280);
      return;
    }

    const node = focusNodeEls[item.segIdx];
    if (!node) { step(); return; }
    node.classList.add('filled');
    node.style.animation = 'none';
    void node.offsetWidth;
    node.style.animation = 'focusNodePop 0.15s ease';
    // Pulse the readout if we just crossed into the active range (node 11+)
    const totalNow = (Math.floor(focusNodes / FOCUS_THRESHOLD) * FOCUS_THRESHOLD) + (item.segIdx + 1);
    if (totalNow > FOCUS_THRESHOLD) {
      updateFocusMultReadout(true);
    } else {
      updateFocusMultReadout(false);
    }
    setTimeout(step, 80);
  }
  step();
}

// ── Focus decay: tick down 1 node every `focusDecayIntervalMs` ms while active ──
function isFocusDecayPaused() {
  // First Wind: no decay for first 45s of round (measured via mutable roundSeconds,
  // so swaps/discards that consume time also consume the grace window)
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
  // Don't decay mid-animation — removeFocus() would mutate focusNodes and re-sync the
  // meter while addFocus()'s fill animation is still in flight, causing the visual
  // "jump up then get wiped" desync.
  if (focusAnimRunning) return;
  if (focusNodes <= 0) return;
  // Buffer: when focus lands on a whole-number multiplier (x.0 — i.e. focusNodes is a
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

// Reset the decay timer — called on every play/swap/discard so the next decay tick
// is the full interval away from the most recent action.
function resetFocusDecayTimer() {
  if (focusDecayTimerId !== null) {
    clearInterval(focusDecayTimerId);
    focusDecayTimerId = setInterval(focusDecayTick, focusDecayIntervalMs);
  } else {
    startFocusDecay();
  }
}

