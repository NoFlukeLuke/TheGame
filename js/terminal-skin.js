// ══ TERMINAL LOOK (r471) - the cold-machine prototype ════════════════════════
// Owner's question 8: before deciding between "the machine is seductive" and
// "the machine is office equipment", play ten minutes of the cold version. One
// switch (dev -> Aesthetics -> Terminal look) treats the IN-ROUND screen:
//   - the chrome drains to one amber monochrome (css/terminal-skin.css);
//     the cards themselves are untouched
//   - card motion goes mechanical: the 'mech' looks in js/card-anims.js
//     (short travel, hard stop, no arc), idle stills to Current, and the
//     deal/fall bounce is flattened (termSkinNoBounce, read by card-fall
//     and level-up)
//   - the board's moment sounds go electromechanical: relay, typebar,
//     carriage, solenoid (termSkinSfx, read by the audio-assets wrapper
//     BEFORE files and packs)
// Nothing is overwritten: the stored animation picks, the sound pack and the
// stylesheet all stand aside while the switch is on and come back when it is
// off. Store is overrides-only; shipping default is OFF.

const TERM_SKIN_KEY = 'lethe.termSkin.v1';
let _termSkin = (() => { try { return JSON.parse(localStorage.getItem(TERM_SKIN_KEY)) || {}; } catch (e) { return {}; } })();

function termSkinOn() { return !!_termSkin.on; }
function setTermSkin(on) {
  if (on) _termSkin.on = 1; else delete _termSkin.on;
  try {
    Object.keys(_termSkin).length ? localStorage.setItem(TERM_SKIN_KEY, JSON.stringify(_termSkin))
                                  : localStorage.removeItem(TERM_SKIN_KEY);
  } catch (e) {}
  termSkinApply();
}
function termSkinApply() {
  document.body.classList.toggle('term-skin', termSkinOn());
  // the idle look changes with the switch (watch -> still), so re-arm it
  try { if (typeof cardAnimApplyIdle === 'function') cardAnimApplyIdle(); } catch (e) {}
}

// ── Animation picks while the look is on ────────────────────────────────────
// cardAnimChoice passes its answer through here; the player's stored picks are
// not touched. buff keeps Stamp and boss keeps Static - both are already
// machines.
const TERM_ANIMS = { swap: 'mech', fly: 'mech', discard: 'mech', cut: 'mech', idle: 'current' };
function termSkinAnim(kind, id) { return (termSkinOn() && TERM_ANIMS[kind]) ? TERM_ANIMS[kind] : id; }

// The deal/fall bounce reads this: a terminal does not bounce its cards.
function termSkinNoBounce() { return termSkinOn(); }

// ── Sounds: relays, typebars, the carriage ──────────────────────────────────
// ptVoice / ptNoiseBuf / ptPlay are the printer's synth helpers (js/print-toast.js).
// Gains sit near the printer's: these are moment sounds, not fanfares.

// a bare relay: one sharp contact click with a tiny metallic ring
function tsRelay(v, ctx, t, pitch) {
  const click = ptNoiseBuf(ctx, 0.012, (ts, p) => 1 - p);
  ptPlay(ctx, click, t, 0.14 * v, 'bandpass', pitch || 2900, 2.4);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = (pitch || 2900) * 1.4;
  g.gain.setValueAtTime(0.05 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  o.connect(g).connect(sfxOut(ctx)); o.start(t); o.stop(t + 0.05);
}
// a solenoid: the low armature thump under a contact clack
function tsSolenoid(v, ctx, t, hz) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(hz || 150, t); o.frequency.exponentialRampToValueAtTime((hz || 150) * 0.55, t + 0.07);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g).connect(sfxOut(ctx)); o.start(t); o.stop(t + 0.1);
  const clack = ptNoiseBuf(ctx, 0.018, (ts, p) => 1 - p * p);
  ptPlay(ctx, clack, t, 0.1 * v, 'bandpass', 1500, 1.4);
}

const TERM_SFX = {
  // tapping a card: a relay picks it up
  card_select: () => ptVoice((ctx, v, t) => tsRelay(v, ctx, t, 2700 + fxRandom() * 500)),
  // a card scoring: a typebar strike - the machine logging the work
  card_pop: () => ptVoice((ctx, v, t) => {
    const strike = ptNoiseBuf(ctx, 0.02, (ts, p) => 1 - p);
    ptPlay(ctx, strike, t, 0.16 * v, 'bandpass', 2200 + fxRandom() * 700, 1.8);
    tsSolenoid(v * 0.5, ctx, t + 0.004, 220);
  }),
  // the hand flying to the preview: the carriage ratchets across and returns
  flip_shuffle: () => ptVoice((ctx, v, t) => {
    const click = ptNoiseBuf(ctx, 0.01, (ts, p) => 1 - p);
    for (let k = 0; k < 5; k++) ptPlay(ctx, click, t + k * 0.03, 0.08 * v, 'bandpass', 3400 - k * 350, 2.2);
    const slide = ptNoiseBuf(ctx, 0.16, (ts, p) => (1 - p) * 0.7);
    ptPlay(ctx, slide, t + 0.02, 0.06 * v, 'lowpass', 900, 0.8);
    tsSolenoid(v, ctx, t + 0.17, 130);
  }),
  // a discard: the solenoid files it, hard
  card_discard: () => ptVoice((ctx, v, t) => { tsSolenoid(v, ctx, t, 160); tsRelay(v * 0.6, ctx, t + 0.05, 1900); }),
  card_discard_forced: () => ptVoice((ctx, v, t) => { tsSolenoid(v, ctx, t, 110); tsSolenoid(v * 0.8, ctx, t + 0.08, 95); }),
  // a refusal: the dead buzz of a coil that will not throw
  no_swaps: () => ptVoice((ctx, v, t) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'square'; o.frequency.value = 62; f.type = 'lowpass'; f.frequency.value = 420;
    g.gain.setValueAtTime(0.09 * v, t); g.gain.setValueAtTime(0.09 * v, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(f).connect(g).connect(sfxOut(ctx)); o.start(t); o.stop(t + 0.17);
  }),
};
// The audio-assets wrapper asks this FIRST, before files and packs.
function termSkinSfx(id) { return termSkinOn() ? (TERM_SFX[id] || null) : null; }

// Applied at load so a stored ON comes back with the page.
termSkinApply();
