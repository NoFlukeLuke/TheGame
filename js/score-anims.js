function cancelDance() {
  _odoGen++; // invalidates all in-flight odometer timeouts
  if (danceAbortController) {
    console.log('[DANCE] cancelDance — aborting in-progress dance');
    danceAbortController.abort();
    danceAbortController = null;
  }
  // Clear jitter/glow left on the aborted dance's real tray/grid elements before a successor rebinds them.
  if (typeof dncCleanupReal === 'function') dncCleanupReal();
  // Un-hide any grid cards whose fly-to-preview was cut short (they were never removed).
  if (typeof dncRestoreHiddenGridEls === 'function') dncRestoreHiddenGridEls();
  // Restore any elements hidden by odometer overlays
  ['pips-val','mult-val','score-total-num'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.visibility = '';
  });
  const overlay = document.getElementById('dance-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.transition = '';
    overlay.style.opacity = '';
    void overlay.offsetWidth;
  }
}

function wait(ms, signal) {
  return new Promise((res, rej) => {
    if (signal?.aborted) return rej(new DOMException('aborted'));
    const t = setTimeout(res, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted')); }, { once: true });
  });
}

// ══════════════════════════════════════════════
// SNAP ODOMETER HELPER
// Runs in a fixed overlay over the target element — never disturbs layout.
// ══════════════════════════════════════════════
let _odoGen = 0; // incremented on cancelDance to invalidate in-flight odometers

function snapOdometerAnimate(targetEl, from, to, ticksPerSec, maxMs = 2000) {
  if (!targetEl) return Promise.resolve();
  const myGen  = ++_odoGen;
  const duration = Math.max(Math.min((Math.abs(to - from) / ticksPerSec) * 1000, maxMs), 80);

  // Measure target's position + style
  const rect   = targetEl.getBoundingClientRect();
  const cs     = window.getComputedStyle(targetEl);

  // Build fixed overlay positioned exactly over the element
  const overlay = document.createElement('div');
  // Use the element's own rendered font-size in px, capped to fit the box
  const elFontPx = Math.min(parseFloat(cs.fontSize) || 16, rect.height * 0.65);
  overlay.style.cssText = `
    position:fixed; left:${rect.left}px; top:${rect.top}px;
    width:${rect.width}px; height:${rect.height}px;
    display:flex; align-items:center; justify-content:center;
    overflow:hidden; pointer-events:none; z-index:300;
    font-size:${elFontPx}px; font-family:${cs.fontFamily};
    font-weight:${cs.fontWeight}; color:${cs.color};
    line-height:1;
  `;
  document.body.appendChild(overlay);

  // Hide original while animating
  targetEl.style.visibility = 'hidden';

  const str     = String(Math.abs(to));
  const numCols = str.length;
  const innerWrap = document.createElement('div');
  innerWrap.style.cssText = 'display:flex; align-items:center; justify-content:center;';
  overlay.appendChild(innerWrap);

  const colEls = [];
  str.split('').forEach((_, i) => {
    const place      = numCols - 1 - i;
    const totalTicks = Math.floor(Math.abs(to) / Math.pow(10, place));

    const wrap = document.createElement('div');
    wrap.style.cssText = 'overflow:hidden; display:inline-block; text-align:center;';

    if (place === 0) {
      // Ones: smooth strip
      const col = document.createElement('div');
      col.style.cssText = 'display:flex; flex-direction:column; will-change:transform;';
      for (let t = 0; t <= totalTicks; t++) {
        const span = document.createElement('span');
        span.textContent = t % 10;
        span.style.cssText = 'display:block; text-align:center; line-height:1.1;';
        col.appendChild(span);
      }
      wrap.appendChild(col);
      innerWrap.appendChild(wrap);
      colEls.push({ type:'smooth', col, wrap, totalTicks });
    } else {
      // Higher places: snap on carry
      const span = document.createElement('span');
      span.textContent = '0';
      span.style.cssText = 'display:block; text-align:center; line-height:1.1;';
      wrap.appendChild(span);
      innerWrap.appendChild(wrap);
      colEls.push({ type:'snap', span, place, totalTicks, wrap });
    }
  });

  return new Promise(resolve => {
    requestAnimationFrame(() => {
      // Measure a digit height and fix all wrap heights
      const firstDigit = colEls[0]?.type === 'smooth'
        ? colEls[0].col.children[0]
        : colEls[0]?.span;
      const digitH = firstDigit?.getBoundingClientRect().height || parseFloat(cs.fontSize) * 1.1;

      colEls.forEach(c => { c.wrap.style.height = digitH + 'px'; });

      // Animate smooth ones col
      colEls.filter(c => c.type === 'smooth').forEach(({ col, totalTicks }) => {
        if (!totalTicks) return;
        requestAnimationFrame(() => {
          col.style.transition = `transform ${duration}ms cubic-bezier(0.25,0.1,0.1,1)`;
          col.style.transform  = `translateY(${-(totalTicks * digitH)}px)`;
        });
      });

      // Drive snap cols
      const snapCols = colEls.filter(c => c.type === 'snap');
      if (snapCols.length) {
        const startTime  = performance.now();
        const prevDigits = new Array(snapCols.length).fill(0);
        function frame(now) {
          const progress = Math.min((now - startTime) / duration, 1);
          const eased    = 1 - Math.pow(1 - progress, 4);
          const tick     = Math.floor(eased * Math.abs(to));
          snapCols.forEach(({ span, place }, idx) => {
            const digit = Math.floor(tick / Math.pow(10, place)) % 10;
            if (digit !== prevDigits[idx]) {
              prevDigits[idx] = digit;
              span.textContent = digit;
              span.style.animation = 'none';
              void span.offsetWidth;
              span.style.animation = 'snap-digit-in 80ms ease-out forwards';
            }
          });
          if (progress < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }

      setTimeout(() => {
        if (_odoGen !== myGen) {
          // A newer dance started — just clean up without overwriting the element
          overlay.remove();
          targetEl.style.visibility = '';
          resolve();
          return;
        }
        targetEl.textContent = to;
        targetEl.style.visibility = '';
        overlay.remove();
        resolve();
      }, duration + 60);
    });
  });
}

// ══════════════════════════════════════════════
// COMBO FLOAT LABELS
// ══════════════════════════════════════════════
function showComboFloats(hand, handCells, result) {
  const scoreEl = document.getElementById('score-total-num');
  if (!scoreEl) return;
  const rect = scoreEl.getBoundingClientRect();
  const cx   = rect.left + rect.width / 2;
  const cy   = rect.top;

  const labels = [hand];
  // Add a few key trick labels from the result
  if (result.finalScore > 0 && lastCalcMult > 1)  labels.push(`×${lastCalcMult} mult`);
  if (lastCalcPips > 20) labels.push(`${lastCalcPips} pips`);

  labels.forEach((label, i) => {
    const el = document.createElement('div');
    el.className = 'combo-float';
    el.textContent = label;
    el.style.left = (cx + (i % 2 === 0 ? 0 : (i % 4 < 2 ? 12 : -12))) + 'px';
    el.style.top  = (cy - i * 6) + 'px';
    el.style.animationDelay = (i * 120) + 'ms';
    el.style.animation = `combo-float-anim 1.1s ease forwards ${i * 120}ms`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100 + i * 120);
  });
}

// ══════════════════════════════════════════════
// SCORE ANIMATION (replaces playScoreDance)
// ══════════════════════════════════════════════
function flashRoundEnd() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  grid.classList.remove('round-end-flash');
  void grid.offsetWidth;
  grid.classList.add('round-end-flash');
  setTimeout(() => grid.classList.remove('round-end-flash'), 1400);
}

// ══════════════════════════════════════════════
// FLY PARTICLE — generic source→target animation
// ══════════════════════════════════════════════
let roundEnded = false; // freeze input when set; cleared at round start

function tickValue(el, fromVal, toVal, duration) {
  if (!el) return Promise.resolve();
  const start = performance.now();
  const isMult = String(toVal).includes('.');
  return new Promise(res => {
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = fromVal + (toVal - fromVal) * eased;
      el.textContent = isMult ? v.toFixed(1) : Math.round(v);
      if (t < 1) requestAnimationFrame(tick);
      else { el.textContent = isMult ? toVal.toFixed(1) : toVal; res(); }
    }
    requestAnimationFrame(tick);
  });
}

function flyParticle({ sourceRect, targetRect, label, color, delay = 0, duration = 520, onLand }) {
  if (!sourceRect || !targetRect) return;
  const p = document.createElement('div');
  p.className = 'score-particle';
  p.textContent = label;
  p.style.color = color;
  const sx = sourceRect.left + sourceRect.width  / 2;
  const sy = sourceRect.top  + sourceRect.height / 2;
  const tx = targetRect.left + targetRect.width  / 2;
  const ty = targetRect.top  + targetRect.height / 2;
  p.style.left = sx + 'px';
  p.style.top  = sy + 'px';
  document.body.appendChild(p);
  const dx = tx - sx, dy = ty - sy;
  setTimeout(() => {
    p.animate([
      { transform:'translate(-50%,-50%) scale(0.4)', opacity:0 },
      { transform:'translate(-50%,-50%) scale(1.15)', opacity:1, offset:0.12 },
      { transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(0.55)`, opacity:0.9, offset:0.85 },
      { transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(0)`,   opacity:0 },
    ], { duration, easing:'ease-in-out', fill:'forwards' });
    setTimeout(() => {
      if (onLand) onLand();
      p.remove();
    }, duration);
  }, delay);
}

// ══════════════════════════════════════════════
// COLLECT PARTICLES — derive sources from result
// ══════════════════════════════════════════════
function suitColor(suit) {
  return suit === '♥' ? '#c0353e'
       : suit === '♦' ? '#EC9F05'
       : suit === '♣' ? '#2255cc'
       : '#222';
}

function collectScoreParticles(handCells, gridEl) {
  const pip = [];   // { sourceRect, label, color }
  const mult = [];

  // ── 1. Played cards: one pip particle each (with rank pip value) ──
  handCells.forEach(([r, c]) => {
    const card = gridData[r][c];
    if (!card) return;
    const cardEl = gridEl.querySelector(`[data-card-id="${card._id}"]`);
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    pip.push({
      sourceRect: rect,
      label: '+' + cardPips(card.rank),
      color: suitColor(card.suit),
      sourceType: 'card',
    });
  });

  return { pip, mult };
}

