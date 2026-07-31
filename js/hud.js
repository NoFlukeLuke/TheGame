function sfxBonusHand() {
  // Soft, quick rising ping — ducks under the goal-dance audio
  playTone({ freq: 880, type: 'sine', gain: 0.08, attack: 0.005,
             decay: 0.05, sustain: 0.4, release: 0.18, duration: 0.1 });
  playTone({ freq: 1320, type: 'sine', gain: 0.05, attack: 0.005,
             decay: 0.05, sustain: 0.3, release: 0.18, duration: 0.1, delay: 0.05 });
}

function showBonusHandScoreFlash(cells, scoreAmount) {
  // Floating "+N" text above the centroid of played cells
  if (!cells.length) return;
  const gridEl = document.getElementById('grid');
  let avgX = 0, avgY = 0;
  cells.forEach(([r, c]) => { avgX += cellLeft(c) + CARD_W / 2; avgY += cellTop(r) + CARD_H / 2; });
  avgX /= cells.length; avgY /= cells.length;

  const flash = document.createElement('div');
  flash.textContent = `+${scoreAmount.toLocaleString()}`;
  flash.style.cssText = `
    position: absolute;
    left: ${avgX}px;
    top: ${avgY}px;
    transform: translate(-50%, -50%);
    font-family: 'Cinzel', serif;
    font-size: 32px;
    font-weight: 600;
    color: #f5c042;
    text-shadow: 0 0 8px rgba(0,0,0,0.9), 0 0 16px rgba(245,192,66,0.5);
    -webkit-text-stroke: 1.5px rgba(0,0,0,0.85);
    pointer-events: none;
    z-index: 80;
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
  `;
  gridEl.appendChild(flash);
  void flash.offsetWidth;
  flash.style.opacity = '1';
  flash.style.transform = `translate(-50%, calc(-50% - 40px)) scale(1.1)`;
  setTimeout(() => {
    flash.style.opacity = '0';
    flash.style.transform = `translate(-50%, calc(-50% - 60px)) scale(1)`;
  }, 700);
  setTimeout(() => flash.remove(), 1100);
}

function updateScoreUI() {
  if (suppressScoreDisplay) return; // hold display during goal hand dance
  animateDigitEl(document.getElementById('score-total-num'), score);
  const scoreDisplayEl = document.getElementById('score-total-num');
  if (scoreDisplayEl && scoreDisplayEl.style.visibility !== 'hidden') {
    scoreDisplayEl.textContent = score.toLocaleString();
  }
  const pct = Math.min(score / roundGoal, 1);
  const bar = document.getElementById('score-progress-bar');
  if (bar) bar.style.width = Math.round(pct * 100) + '%';
  document.getElementById('goal-display').textContent = roundGoal.toLocaleString();
  document.getElementById('hands-display').textContent = handsPlayed;
  document.getElementById('level-display').textContent = level;
  updateCoinsUI();
  updateRunProgressUI();
}

// Called from dance to update live pips/mult sub-boxes
function updateDanceSubboxes(pips, mult) {
  const pipsEl = document.getElementById('pips-val');
  const multEl = document.getElementById('mult-val');
  const prevPips = parseFloat(pipsEl.dataset.displayVal) || 0;
  const prevMult = parseFloat(multEl.dataset.displayVal) || 0;
  if (pips !== prevPips) { animateDigitEl(pipsEl, Math.round(pips)); popSubbox('pips-box'); }
  if (mult !== prevMult) { animateDigitEl(multEl, parseFloat(mult.toFixed(1))); popSubbox('mult-box'); }
}

function updateCoinsUI() {
  document.getElementById('coins-display').textContent = '💰 ' + coins;
  const cg = document.getElementById('ci-gold'); if (cg) cg.textContent = coins;
  if (document.getElementById('shop-overlay').classList.contains('show')) refreshShopAffordability();
}

// v7 landscape: run-progress block (Act + node pips)
function updateRunProgressUI() {
  const rp = document.getElementById('run-progress'); if (!rp) return;
  const act = rp.querySelector('.rp-act'); if (act) act.textContent = 'ACT ' + actNumber;
  rp.querySelectorAll('.rp-nodes span:not(.boss)').forEach((s, i) => {
    s.classList.toggle('on', i < nodeInAct);
    s.classList.toggle('cur', i === nodeInAct);
  });
}

function updateKnackList() {
  const el = document.getElementById('knack-list');
  if (!el) return;
  if (acquiredKnacks.length === 0) {
    el.innerHTML = '';   // empty → faint KNACKS watermark shows through (r95)
    return;
  }
  el.innerHTML = acquiredKnacks.map(t =>
    `<div class="knack-chip" data-knack-id="${t.id}" tabindex="0" role="button" aria-label="${t.name}">${t.emoji}</div>`
  ).join('');
  // Wire interactions
  el.querySelectorAll('.knack-chip').forEach(chip => {
    const id = chip.dataset.knackId;
    chip.addEventListener('mouseenter', () => showKnackTooltip(chip, id));
    chip.addEventListener('mouseleave', () => hideKnackTooltip());
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const tt = document.getElementById('knack-tooltip');
      if (tt && tt.dataset.knackId === id && tt.classList.contains('show')) hideKnackTooltip();
      else showKnackTooltip(chip, id);
    });
  });
}

// Back-compat alias — older call sites updateTrickList() still re-render the rack
function updateTrickList() { updateKnackList(); }

function showKnackTooltip(chip, id) {
  const knack = KNACK_POOL.find(t => t.id === id);
  if (!knack) return;
  let tt = document.getElementById('knack-tooltip');
  if (!tt) return;
  tt.innerHTML = `
    <div class="knack-tooltip-name">${knack.emoji} ${knack.name}</div>
    <div class="knack-tooltip-desc">${colorizeKeywords(knack.desc)}</div>
  `;
  tt.dataset.knackId = id;
  // Position above the chip, centered horizontally
  const rect = chip.getBoundingClientRect();
  tt.classList.add('show');
  // Need to wait one frame for layout
  requestAnimationFrame(() => {
    const ttRect = tt.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - ttRect.width / 2;
    let top = rect.top - ttRect.height - 8;
    // Clamp to viewport
    left = Math.max(6, Math.min(window.innerWidth - ttRect.width - 6, left));
    if (top < 6) top = rect.bottom + 8;
    tt.style.left = left + 'px';
    tt.style.top = top + 'px';
  });
}
function hideKnackTooltip() {
  const tt = document.getElementById('knack-tooltip');
  if (tt) { tt.classList.remove('show'); tt.dataset.knackId = ''; }
}
// Tap anywhere else dismisses tooltip
document.addEventListener('click', (e) => {
  if (!e.target.closest('.knack-chip') && !e.target.closest('#knack-tooltip')) hideKnackTooltip();
}, true);

// ══════════════════════════════════════════════
// CARD INTERACTION — tap or swipe to select, double-tap to swap
// ══════════════════════════════════════════════

let swapPending = null;   // [r,c] of first card in pending swap
let lastTapCell = null;
let lastTapTime = 0;
