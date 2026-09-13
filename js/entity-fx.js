// ══════════════════════════════════════════════
// ENTITY EFFECT FX (r197) - js/entity-fx.js
// ══════════════════════════════════════════════
// Tricks, Knacks and Sleights pay out in five currencies, and until now only two
// of them were ever animated. A Trick that added pips threw a particle at the PIPS
// chip; a Trick that handed you 20 seconds, 8 credits, a swap or 5 Focus changed a
// number somewhere and printed a line of text that was gone before you read it.
//
// This is the same grammar as the scoring dance, pointed at the rest of the HUD:
// the entity POPS, a symbol flies from it to the readout it changed, and a sound
// plays. One function, one table of targets - so a new effect is a call, not a
// new animation.
//
// BASIC VERSION, deliberately (r197). Attribution is by ENTITY ID where the caller
// knows it and by currency alone where it does not, in which case the symbol flies
// from the middle of the tray rather than from a specific tile. Threading the id
// through every grant site is the follow-up; the mechanism is here and correct.

// Where each currency lives on screen. Several are orientation-dependent, so each
// is a LIST and the first one that is actually laid out wins - the same reason
// js/tutorial.js tests by rect rather than by offsetParent.
const EFX_TARGETS = {
  time:     ['#clock', '#vclock', '#clock-area', '#time-display'],
  credits:  ['#ci-coins', '#coins-display', '#coin-count', '#coins-chip'],
  focus:    ['#focus-meter', '#focus-box', '#focus-val'],
  swaps:    ['#swap-indicator', '#swaps-display'],
  discards: ['#discard-btn', '#discards-display'],
  score:    ['#score-mid', '#score-total-num'],
};

const EFX_STYLE = {
  time:     { icon: '⏱', color: '#5aa9e6' },
  rewind:   { icon: '⏪', color: '#5aa9e6' },
  pause:    { icon: '⏸', color: '#7fd4ff' },
  credits:  { icon: '💰', color: '#e8c56b' },
  focus:    { icon: '◈',  color: '#a25cd8' },
  swaps:    { icon: '⇄',  color: '#6fd08c' },
  discards: { icon: '✕',  color: '#e07a5f' },
};

// First laid-out element from a target list. A zero-size rect means "not showing
// in this orientation", which is exactly the case a plain getElementById misses.
function efxTargetEl(kind) {
  const list = EFX_TARGETS[kind] || [];
  for (const sel of list) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

// Fly one symbol from `srcEl` to the readout for `kind`. Body-level and fixed, so
// it is unaffected by the cabinet's CSS `zoom` (same rule as the score particles).
function efxFly(srcEl, kind, label, color) {
  const target = efxTargetEl(kind);
  if (!target) return;
  const src = srcEl && srcEl.getBoundingClientRect && srcEl.getBoundingClientRect();
  const a = (src && src.width) ? src : target.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'efx-particle';
  el.textContent = label;
  el.style.color = color;
  el.style.left = (a.left + a.width / 2) + 'px';
  el.style.top  = (a.top + a.height / 2) + 'px';
  document.body.appendChild(el);
  const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
  const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
  const dur = (typeof SETTINGS === 'object' && SETTINGS && SETTINGS.reducedMotion) ? 120 : 620;
  el.animate([
    { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: .22 },
    { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.85)`, opacity: 0 },
  ], { duration: dur, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
  setTimeout(() => el.remove(), dur + 80);
  // The readout itself acknowledges the hit, so the flight has a destination that
  // reacts rather than a number that silently changed some time earlier.
  setTimeout(() => {
    target.classList.remove('efx-hit'); void target.offsetWidth; target.classList.add('efx-hit');
    setTimeout(() => target.classList.remove('efx-hit'), 380);
  }, dur * 0.8);
}

// The one entry point. `opts.id` / `opts.source` name the entity when the caller
// knows it, and the symbol then flies from that entity's real tray tile.
//
//   entityEffectFX('credits', 8, { id:'dividend', source:'knack' })
//   entityEffectFX('rewind', 12, { id:'overtime' })
function entityEffectFX(kind, amount, opts) {
  const o = opts || {};
  const style = EFX_STYLE[kind] || EFX_STYLE.time;
  const currency = (kind === 'rewind' || kind === 'pause') ? 'time' : kind;
  let srcEl = null;
  if (o.id && typeof danceEntityEl === 'function') {
    try { srcEl = danceEntityEl(o.source || 'trick', o.id); } catch (e) { srcEl = null; }
  }
  if (srcEl && typeof dncReleaseReal === 'function') dncReleaseReal(srcEl);
  const n = (typeof amount === 'number') ? amount : null;
  const sign = (n !== null && n < 0) ? '' : '+';
  const unit = currency === 'time' ? 's' : '';
  const label = o.label || (n === null ? style.icon : `${style.icon} ${sign}${n}${unit}`);
  efxFly(srcEl, currency, label, o.color || style.color);
  if (o.sfx !== false) efxSound(kind);
}

// Each currency gets the sound it already owns elsewhere in the game, so nothing
// new has to be authored and the packs cover it for free.
function efxSound(kind) {
  try {
    if (kind === 'credits' && typeof sfxCoin === 'function') return sfxCoin();
    if (kind === 'focus' && typeof sfxFocusBeat === 'function') return sfxFocusBeat();
    if ((kind === 'rewind') && typeof sfxRewind === 'function') return sfxRewind();
    if ((kind === 'pause' || kind === 'time') && typeof sfxTickTock === 'function') return sfxTickTock();
    if (typeof sfxParticleStep === 'function') sfxParticleStep('pip');
  } catch (e) {}
}
