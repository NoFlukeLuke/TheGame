// ══════════════════════════════════════════════
// ENTITY PAYOUT FX (r220) - js/payout-fx.js
// ══════════════════════════════════════════════
// NOT js/entity-fx.js, which is a different system with a confusingly similar
// name: that one draws the LINES and CARD MARKS that say "this cell is MARKED by
// that Trick". This one animates what an entity PAID OUT, at the moment it paid.
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
  time:     ['#clock', '#vclock', '#clock-area'],
  credits:  ['#ci-gold', '#coin-info', '#coins-display'],
  focus:    ['#focus-box', '#focus-val'],
  swaps:    ['#swap-indicator'],
  discards: ['#disc-count', '#btn-discard'],
  score:    ['#score-total-num', '#score-center'],
};
// Two of these lists were pointing at ids that do not exist (r231). `#ci-coins`,
// `#coins-display` in landscape (0-size), `#discard-btn` and `#discards-display`
// in both orientations: credits and discards had NO reachable target, so those two
// currencies silently threw no particle at all. Audited in a real browser at
// 1440x820 and 420x820; every list above now resolves in both.

// `plate` is the PARTICLE_CFG colour family this currency is drawn in (r231), so a
// payout is the same object as a score particle rather than a second vocabulary.
// Anything with no family of its own borrows one; the icon is what tells them apart.
const EFX_STYLE = {
  time:     { icon: '⏱', color: '#5aa9e6', plate: 'time' },
  rewind:   { icon: '⏪', color: '#5aa9e6', plate: 'time' },
  pause:    { icon: '⏸', color: '#7fd4ff', plate: 'time' },
  credits:  { icon: '💰', color: '#e8c56b', plate: 'credits' },
  focus:    { icon: '◈',  color: '#a25cd8', plate: 'focus' },
  swaps:    { icon: '⇄',  color: '#6fd08c', plate: 'focus' },
  discards: { icon: '✕',  color: '#e07a5f', plate: 'multAdd' },
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

// Body-level and fixed, so it is unaffected by the cabinet's CSS `zoom` (same rule
// as the score particles).
// Fly one PLATE from `srcEl` to the readout for `currency`. Since r231 this is the
// SAME particle the scoring dance throws (ptLaunch, js/score-dance.js) rather than
// a second bare-text one: one shape vocabulary, one tuner, one legibility fix.
// `fxKind` is the effect (rewind / pause / credits...) and decides the ghost trail;
// `currency` is where it flies to and which colour family it wears.
function efxFly(srcEl, currency, label, color, fxKind) {
  const target = efxTargetEl(currency);
  if (!target) return;
  const src = srcEl && srcEl.getBoundingClientRect && srcEl.getBoundingClientRect();
  const a = (src && src.width) ? src : target.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dur = (typeof SETTINGS === 'object' && SETTINGS && SETTINGS.reducedMotion) ? 120 : 620;
  if (typeof ptLaunch === 'function') {
    const style = EFX_STYLE[fxKind || currency] || EFX_STYLE.time;
    ptLaunch(a, b, style.plate || currency, label, color, dur,
             { trail: (typeof ptTrail === 'function') ? ptTrail(fxKind || currency) : 0 });
  }
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
  // The PLATE carries the icon's old job - its colour, its shape and the readout it
  // flies into all say which currency this is - so the label is the NUMBER alone.
  // An icon beside it doubled the label's width on a 40px diamond and pushed the
  // digits off the plate. An effect with no number still shows its icon.
  const label = o.label || (n === null ? style.icon : `${sign}${n}${unit}`);
  efxFly(srcEl, currency, label, o.color || style.color, kind);
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
