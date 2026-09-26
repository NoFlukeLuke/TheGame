// ══════════════════════════════════════════════
// SOUND PACKS (r234) - four casino sets, built from js/audio-dsp.js
// ══════════════════════════════════════════════
// Four ways every sound in SFX_CATALOG can be produced. `classic` is not defined
// here: it is the original synthesised set in js/audio.js, and it is what the
// wrapper falls through to for any id a pack leaves out. Nothing can go silent.
//
//   vegas       a real slot cabinet. Relays, hoppers, struck bells, reel detents.
//   highroller  cinematic. Sub drops, brass, taiko, long tails.
//   neon        modern casino app. FM bells, supersaws, tight sub kicks.
//   lounge      warm analogue. Rhodes, vibes, tape thumps, brushed noise.
//
// ── WHAT THE FOUR SHARE, AND WHY ────────────────────────────────────────────
// They are four PALETTES over one SET OF DECISIONS, which is the only reason a
// pack is a few hundred lines rather than a rewrite of the game's whole feel:
//
//   * Every impact is TRANSIENT + BODY + TAIL (js/audio-dsp.js). A pack chooses
//     what the three are made of, never whether there are three.
//   * Anything that pays out RISES. Ascending is what a reward sounds like, and
//     it is why every win here is a run up a scale rather than one loud note.
//   * Anything that refuses is FLAT AND DEAD: no rise, no resolution, no tail.
//     A refusal that resolves reads as a small win, which is worse than silence.
//   * Pitch is written in SEMITONES from a root, never in Hz, so one phrase can
//     be played by four completely different instruments.
//   * The big moments open with a beat of near-silence (D_ANTICIPATION). Contrast
//     buys more weight than level does, and it is the one thing a limiter cannot
//     take away.
//
// ── WHAT MAKES A SOUND "BIGGER" HERE ────────────────────────────────────────
// Three things, in the order they are worth reaching for:
//   1. a sub layer under the body, saturated so a laptop speaker can hear the
//      harmonics of a fundamental it cannot reproduce;
//   2. a tail, sent per voice, so the sound happened somewhere;
//   3. more EVENTS, not more level. A jackpot is forty coins landing over two
//      seconds. One louder ding is not a jackpot.
//
// ── ADDING A SOUND ──────────────────────────────────────────────────────────
// One row in SFX_CATALOG (js/audio-assets.js), one row in SFX_MIX
// (js/audio-mixer.js), then one entry per pack here. A pack that omits it keeps
// playing the classic version and nothing breaks.

// ══ Shared helpers ══════════════════════════════════════════════════════════

// Suits and Spectrum colours both come in as `suit`. Returning an INDEX rather
// than a frequency is what lets each pack spread them across its own register.
function packSuitIndex(suit) {
  if (typeof COLORS !== 'undefined' && COLORS.indexOf) {
    const i = COLORS.indexOf(suit);
    if (i >= 0) return i;
  }
  return suit === '♠' ? 0 : suit === '♣' ? 1 : suit === '♥' ? 2 : suit === '♦' ? 3 : 0;
}

// How big a hand was, as 0 to 4. Logarithmic because the score range across a run
// spans four orders of magnitude and a linear read would put every hand of the
// first three levels in the same bucket.
function packScoreTier(score) {
  const s = Math.max(10, Number(score) || 100);
  return Math.max(0, Math.min(4, Math.floor(Math.log10(s)) - 1));
}

// The escalating particle counter lives in js/audio.js as a plain top-level let,
// so every pack increments the same one and resetParticleStep() keeps working.
function packParticleIndex() { return _particleStep++; }

// ══════════════════════════════════════════════════════════════════════════════
// VEGAS FLOOR - a machine, in a room, made of metal and wood
// ══════════════════════════════════════════════════════════════════════════════
// The premise is that every sound is a PHYSICAL EVENT in a cabinet: a solenoid
// throwing, a detent dropping into a notch, a coin hitting a steel tray, a bell
// being struck by a hammer. Nothing here is a tone that fades; everything is
// something hitting something else.
//
// The single most important ingredient is the short-mode LFSR noise (dNoiseBuf
// 'metal'): 93 steps, so it rings at a pitch instead of hissing. It is what makes
// a click sound like machinery rather than like static, and it is in almost every
// sound in this pack.

const VG_BELL = 523.25;    // C5 - the bell register
const VG_BODY = 130.81;    // C3 - the cabinet

// A hammer striking a bell. Two partial sets layered: `ring` for the note you
// hear and `bar` for the strike you feel.
function vgBell(semi, { dur = 1.2, gain = 0.14, delay = 0, verb = 0.34 } = {}) {
  const f = dHz(semi, VG_BELL);
  dClick({ dur: 0.012, freq: f * 4.2, q: 1.2, gain: gain * 0.42, delay, kind: 'metal', rate: 2.0, verb: verb * 0.4 });
  dMetal({ freq: f, set: 'ring', dur, gain: gain * 0.9, delay, verb, tilt: 0.66 });
  dMetal({ freq: f * 2.02, set: 'bar', dur: dur * 0.22, gain: gain * 0.3, delay, verb: verb * 0.6 });
  return dur;
}

// A coin landing in the steel tray. The tray is the point: the coin is a ping,
// the tray is a short bright rattle around it.
function vgCoin(semi, { gain = 0.1, delay = 0, verb = 0.3 } = {}) {
  dCoin({ freq: dHz(semi, 1760), dur: 0.36, gain, delay, verb, bright: 1.15 });
  dNoise({ kind: 'metal', dur: 0.09, gain: gain * 0.28, delay: delay + 0.012, type: 'bandpass',
           freq: 5200, q: 0.8, rate: 1.7, rateTo: 1.1, attack: 0.002, verb: verb * 0.5 });
}

// The detent: a sprung pawl dropping into the next notch on a counter wheel.
function vgDetent({ gain = 0.09, delay = 0, pitch = 1, verb = 0.12 } = {}) {
  dClick({ dur: 0.009, freq: 4200 * pitch, q: 1.4, gain: gain * 0.8, delay, kind: 'metal', rate: 2.6, verb });
  dTone({ freq: 900 * pitch, to: 620 * pitch, type: 'triangle', dur: 0.03, gain: gain * 0.5, delay, attack: 0.0008, verb });
}

// The hopper emptying. Coins land bunched at the start and thin out, which is
// what `accel` below 1 does, and it is the difference between a payout and a
// metronome.
function vgHopper(n, { spread = 0.9, gain = 0.075, delay = 0, lo = 0, hi = 14 } = {}) {
  dCascade(n, (i, at) => vgCoin(dRand(lo, hi), { gain: gain * dRand(0.7, 1.15), delay: at, verb: 0.26 }),
           { spread, jitter: 0.5, delay, accel: 0.72 });
}

const VEGAS_PACK = {
  // A cabinet button with a spring under it. The relay IS the commit.
  card_select: () => {
    dRelay({ gain: 0.15, delay: 0, pitch: 1.55, weight: 0.55, verb: 0.1 });
    dTone({ freq: 1150, to: 880, type: 'triangle', dur: 0.035, gain: 0.05, attack: 0.001, verb: 0.08 });
  },

  // Each scored card is one coin off the stack, pitched by suit so a flush reads
  // as one note repeated and a rainbow reads as a chord spelled out.
  card_pop: (suit) => {
    const i = packSuitIndex(suit);
    vgCoin(dScale('majPent', i, 1), { gain: 0.085, verb: 0.26 });
    dWood({ freq: dHz(i * 2, VG_BODY * 2), dur: 0.09, gain: 0.07, verb: 0.12 });
  },

  // A riffle. Dense pink-noise strokes bunched at the start, over a low wooden
  // body so the deck has a weight rather than being a hiss.
  flip_shuffle: () => {
    dCascade(11, (i, at) => dNoise({
      kind: 'pink', dur: 0.03, gain: 0.055 + i * 0.002, delay: at, type: 'bandpass',
      freq: 1700 + i * 260, q: 1.5, attack: 0.0008, verb: 0.1,
    }), { spread: 0.24, jitter: 0.5, accel: 0.8 });
    dWood({ freq: 150, dur: 0.16, gain: 0.11, delay: 0.02, verb: 0.14 });
    dThump({ freq: 110, to: 52, dur: 0.14, gain: 0.1, delay: 0.19, sat: 0.5, verb: 0.1 });
  },

  // Credit rejected. A relay that throws and finds nothing, then a dead buzz.
  // No pitch resolution anywhere in it, on purpose.
  no_swaps: () => {
    dRelay({ gain: 0.2, pitch: 0.62, weight: 1.2, verb: 0.1 });
    dRelay({ gain: 0.16, pitch: 0.55, weight: 1.1, delay: 0.1, verb: 0.1 });
    dTone({ freq: 82, type: 'square', dur: 0.2, gain: 0.07, delay: 0.02, sat: 0.6, lp: 420, verb: 0.06 });
  },

  // Cards into the hopper: the stroke, then the slot swallowing them. The forced
  // version (The Marker) is a SLAM with a sub under it, because it is something
  // happening to you rather than something you did.
  card_discard: (loud) => {
    const g = loud ? 1.75 : 1;
    dNoise({ kind: 'pink', dur: loud ? 0.1 : 0.07, gain: 0.09 * g, type: 'bandpass',
             freq: loud ? 1500 : 2100, to: 700, q: 1.2, attack: 0.0008, verb: 0.12 });
    dWood({ freq: loud ? 130 : 200, dur: 0.13, gain: 0.13 * g, delay: 0.01, verb: 0.14 });
    dThump({ freq: loud ? 150 : 105, to: loud ? 38 : 50, dur: loud ? 0.3 : 0.15,
             gain: 0.14 * g, delay: 0.012, sat: 0.65, verb: 0.14 });
    if (loud) {
      dNoise({ kind: 'metal', dur: 0.22, gain: 0.05, delay: 0.05, type: 'bandpass',
               freq: 3400, to: 1400, q: 0.7, rate: 1.4, verb: 0.3 });
    }
  },
  // A `variantOf` catalog row is looked up by its OWN id, so a pack that
  // defines only card_discard leaves the forced one playing the classic sound.
  card_discard_forced: () => VEGAS_PACK.card_discard(true),

  // The counter wheel climbing. Pips are coins, mults are bells: two different
  // objects, so a mixed run is legible as two streams rather than one ramp.
  particle_pip: () => {
    const i = packParticleIndex();
    vgCoin(dDegree('majPent', i), { gain: 0.13, verb: 0.24 });
    vgDetent({ gain: 0.045, pitch: 1 + i * 0.03, verb: 0.08 });
  },
  particle_mult: () => {
    const i = packParticleIndex();
    vgBell(dDegree('majPent', i), { dur: 0.42, gain: 0.14, verb: 0.3 });
  },

  // One notch. Deliberately tiny: it fires many times a second during a climb.
  score_tick: () => vgDetent({ gain: 0.05, pitch: 1.18, verb: 0.06 }),

  // The Focus multiplier landing. A struck bell with the cabinet resonating under
  // it, so it is the one board sound with real low end.
  focus_beat: () => {
    dThump({ freq: 190, to: 58, dur: 0.34, gain: 0.2, sat: 0.6, verb: 0.2 });
    vgBell(7, { dur: 1.3, gain: 0.13, delay: 0.01, verb: 0.4 });
    vgBell(19, { dur: 0.8, gain: 0.07, delay: 0.035, verb: 0.4 });
  },

  // The hand. Bells stacked into a chord, how many depends on what it paid, over
  // a cabinet thump. A big hand is MORE EVENTS, never one louder one.
  hand_scored: (finalScore) => {
    const tier = packScoreTier(finalScore);
    dThump({ freq: 170, to: 48, dur: 0.36, gain: 0.2 + tier * 0.02, sat: 0.6, verb: 0.2 });
    [0, 4, 7, 11, 14].slice(0, 2 + tier).forEach((s, i) =>
      vgBell(s, { dur: 1.1 - i * 0.08, gain: 0.105 - i * 0.008, delay: i * 0.055, verb: 0.38 }));
    if (tier >= 2) vgHopper(4 + tier * 2, { spread: 0.5, gain: 0.05, delay: 0.16 });
  },

  // A bonus caught. Three bells up, quickly: the shortest phrase that still rises.
  bonus_hand: () => [7, 11, 14].forEach((s, i) =>
    vgBell(s, { dur: 0.7, gain: 0.1 - i * 0.008, delay: i * 0.065, verb: 0.36 })),

  // THE JACKPOT. A beat of nothing, then the whole machine at once: the relay
  // throws, the bell is struck, the floor drops out from under it, and the hopper
  // runs for two seconds. The silence in front is doing as much work as the hit.
  win_explode: () => {
    const t0 = D_ANTICIPATION;
    dRelay({ gain: 0.26, pitch: 0.7, weight: 1.6, delay: t0 - 0.02, verb: 0.2 });
    dThump({ freq: 240, to: 34, dur: 0.85, gain: 0.34, delay: t0, sat: 0.8, verb: 0.24 });
    dSub({ freq: 58, to: 30, dur: 1.1, gain: 0.26, delay: t0, sat: 0.5 });
    [0, 7, 12, 16, 19].forEach((s, i) =>
      vgBell(s, { dur: 2.2 - i * 0.2, gain: 0.13 - i * 0.012, delay: t0 + i * 0.03, verb: 0.5 }));
    dNoise({ kind: 'metal', dur: 0.9, gain: 0.07, delay: t0, type: 'bandpass',
             freq: 6000, to: 2200, q: 0.6, rate: 1.9, rateTo: 1.0, verb: 0.45 });
    vgHopper(26, { spread: 1.9, gain: 0.07, delay: t0 + 0.14, lo: 0, hi: 19 });
  },

  // One bell per goal cleared, each a fourth higher, each with its own payout.
  multi_goal: (count) => {
    for (let i = 0; i < count; i++) {
      const at = i * 0.3;
      dThump({ freq: 180, to: 50, dur: 0.25, gain: 0.15, delay: at, sat: 0.6, verb: 0.16 });
      vgBell(i * 5, { dur: 1.3, gain: 0.13, delay: at, verb: 0.42 });
      vgHopper(4, { spread: 0.22, gain: 0.055, delay: at + 0.07, lo: i * 3, hi: i * 3 + 10 });
    }
  },

  focus_pop:  () => vgDetent({ gain: 0.06, pitch: 1.5, verb: 0.12 }),
  focus_drop: () => {
    dWood({ freq: 210, dur: 0.12, gain: 0.05, verb: 0.1, bright: 0.7 });
    dTone({ freq: 190, to: 84, type: 'triangle', dur: 0.16, gain: 0.05, attack: 0.002, sat: 0.3, verb: 0.1 });
  },

  // The lever. A mechanical draw, the reels spinning up, then the clunk of the
  // round actually starting.
  round_start: () => {
    dNoise({ kind: 'pink', dur: 0.26, gain: 0.07, type: 'bandpass', freq: 500, to: 1800, q: 1.1, up: true, verb: 0.16 });
    dCascade(12, (i, at) => vgDetent({ gain: 0.05, pitch: 0.9 + i * 0.05, delay: at, verb: 0.08 }),
             { spread: 0.34, jitter: 0.25, accel: 1.5 });
    dRelay({ gain: 0.22, pitch: 0.85, weight: 1.3, delay: 0.36, verb: 0.16 });
    vgBell(0, { dur: 0.9, gain: 0.1, delay: 0.37, verb: 0.34 });
  },

  // Three heavy throws, one a second. Nothing musical: this is a countdown, not
  // a fanfare, and it must not sound like a reward.
  countdown: () => {
    [0, 1, 2].forEach(i => {
      dRelay({ gain: 0.2, pitch: 0.75 + i * 0.06, weight: 1.3, delay: i * 1.0, verb: 0.2 });
      dThump({ freq: 130 + i * 10, to: 44, dur: 0.3, gain: 0.16, delay: i * 1.0, sat: 0.6, verb: 0.18 });
    });
  },

  success: () => [0, 7, 12].forEach((s, i) => vgBell(s, { dur: 1.4, gain: 0.12, delay: i * 0.05, verb: 0.44 })),

  // The full house bell, then the money.
  victory: () => {
    dThump({ freq: 200, to: 38, dur: 0.6, gain: 0.26, sat: 0.7, verb: 0.2 });
    dRun(6, (f, at, i) => vgBell(i * 2, { dur: 1.6, gain: 0.12, delay: at, verb: 0.46 }), { step: 0.09 });
    vgHopper(18, { spread: 1.4, gain: 0.07, delay: 0.3, lo: 0, hi: 16 });
  },

  level_up: () => {
    dRun(5, (f, at, i) => vgBell(i * 2, { dur: 1.0, gain: 0.115, delay: at, verb: 0.4 }), { step: 0.075 });
    dThump({ freq: 160, to: 46, dur: 0.3, gain: 0.16, sat: 0.6, verb: 0.16 });
    vgHopper(9, { spread: 0.7, gain: 0.06, delay: 0.16, lo: 4, hi: 16 });
  },

  // THE REWARD COUNTER (r378) - the one sound in the pack written to RING ON.
  // A struck house bell over the relay that threw it, with the tail growing a
  // fifth of a second a bump. Not a bigger coin: the beat is the machine
  // stopping, so it is the bell and the cabinet, not the payout.
  reward_count: (step = 0) => {
    const k = Math.min(step, 5), t = 2.0 + k * 0.22;
    dRelay({ gain: 0.26, pitch: 0.9, verb: 0.2, weight: 1.2 });
    [0, 7, 12].forEach((sm, i) => vgBell(sm + k * 2, { dur: t, gain: 0.17 - i * 0.028, delay: i * 0.04, verb: 0.62 }));
    dSub({ freq: 74, to: 52, dur: t * 0.7, gain: 0.3, sat: 0.4, verb: 0.3 });
  },

  // A compressor pump under the floor. Mechanical, not a pulse.
  heartbeat: (gain = 1.0) => {
    dThump({ freq: 96, to: 34, dur: 0.3, gain: 0.3 * gain, sat: 0.75, verb: 0.1 });
    dClick({ dur: 0.016, freq: 900, q: 0.9, gain: 0.05 * gain, kind: 'pink', verb: 0.08 });
    dThump({ freq: 80, to: 30, dur: 0.22, gain: 0.18 * gain, delay: 0.135, sat: 0.7, verb: 0.1 });
  },

  coin: () => vgCoin(dRand(5, 12), { gain: 0.24, verb: 0.32 }),

  // The change drawer rolling open.
  shop_open: () => {
    dNoise({ kind: 'pink', dur: 0.4, gain: 0.07, type: 'lowpass', freq: 900, to: 2600, q: 0.8, up: true, verb: 0.2 });
    dRelay({ gain: 0.19, pitch: 0.8, weight: 1.2, delay: 0.4, verb: 0.2 });
    vgHopper(6, { spread: 0.4, gain: 0.05, delay: 0.42, lo: 2, hi: 12 });
  },

  reward_good: () => { vgBell(4, { dur: 0.9, gain: 0.12, verb: 0.38 }); vgBell(11, { dur: 1.1, gain: 0.1, delay: 0.075, verb: 0.4 }); vgCoin(9, { gain: 0.07, delay: 0.1 }); },
  // Dead metal. A bell that was struck wrong.
  reward_bad: () => {
    dRelay({ gain: 0.2, pitch: 0.58, weight: 1.4, verb: 0.12 });
    dMetal({ freq: 196, set: 'plate', dur: 0.5, gain: 0.09, delay: 0.01, verb: 0.2, tilt: 0.5 });
    dTone({ freq: 92, type: 'square', dur: 0.26, gain: 0.07, delay: 0.01, sat: 0.6, lp: 380 });
  },
  reward_reveal: () => dRun(5, (f, at, i) => vgCoin(4 + i * 3, { gain: 0.06, delay: at, verb: 0.34 }), { step: 0.055 }),
  reward_select: () => { vgDetent({ gain: 0.2, pitch: 1.25, verb: 0.14 }); dWood({ freq: 260, dur: 0.07, gain: 0.11, verb: 0.1 }); },

  // A warning bell, struck once and left to ring over a rising floor.
  chal_appear: () => {
    dMetal({ freq: 330, set: 'plate', dur: 1.6, gain: 0.1, verb: 0.42, tilt: 0.8 });
    dSweep({ kind: 'tone', from: 70, to: 150, dur: 0.7, gain: 0.1, type: 'sawtooth', up: true, verb: 0.2 });
  },
  chal_win: () => { [0, 7, 16].forEach((s, i) => vgBell(s, { dur: 1.2, gain: 0.12, delay: i * 0.06, verb: 0.42 })); vgHopper(8, { spread: 0.5, gain: 0.06, delay: 0.14 }); },
  chal_fail: () => {
    [0, 1, 2].forEach(i => dRelay({ gain: 0.18 - i * 0.03, pitch: 0.7 - i * 0.1, weight: 1.2, delay: i * 0.11, verb: 0.14 }));
    dTone({ freq: 110, to: 58, type: 'square', dur: 0.5, gain: 0.08, delay: 0.02, sat: 0.6, lp: 400, verb: 0.1 });
  },

  m3_match: (step) => vgCoin(dRand(0, 2) + (step || 1) * 2, { gain: 0.09, verb: 0.3 }),
  m3_pop:   (step) => { vgDetent({ gain: 0.28, pitch: 1 + (step || 1) * 0.08, verb: 0.1 }); dWood({ freq: 220 + (step || 1) * 40, dur: 0.08, gain: 0.26, verb: 0.12 }); },
  m3_combo: (step) => {
    const n = Math.min(6, 2 + (step || 1));
    dRun(n, (f, at, i) => vgBell((step || 1) * 2 + i * 2, { dur: 0.7, gain: 0.1, delay: at, verb: 0.38 }), { step: 0.055 });
    dThump({ freq: 150, to: 48, dur: 0.24, gain: 0.13, sat: 0.6, verb: 0.14 });
  },

  // The escapement. Quiet by design: it fires six times a minute for a whole run.
  clock_tick: () => vgDetent({ gain: 0.04, pitch: 1.9, verb: 0.05 }),
  // The clock has STOPPED. Two throws, the second lower, over a held ring - the
  // second one landing late is the whole reason a stopped clock sounds stopped.
  tick_tock: () => {
    vgDetent({ gain: 0.09, pitch: 2.0, verb: 0.16 });
    dWood({ freq: 420, dur: 0.06, gain: 0.07, verb: 0.14 });
    vgDetent({ gain: 0.08, pitch: 1.45, delay: 0.22, verb: 0.16 });
    dWood({ freq: 300, dur: 0.07, gain: 0.065, delay: 0.22, verb: 0.14 });
    dMetal({ freq: 262, set: 'ring', dur: 1.1, gain: 0.05, delay: 0.01, verb: 0.4, tilt: 0.85 });
  },
  // The reels driven backwards: detents accelerating the wrong way, swelling into
  // a stop rather than decaying out of one.
  rewind: () => {
    dCascade(16, (i, at) => vgDetent({ gain: 0.03 + i * 0.004, pitch: 0.75 + i * 0.055, delay: at, verb: 0.1 }),
             { spread: 0.5, jitter: 0.2, accel: 0.75 });
    dNoise({ kind: 'metal', dur: 0.5, gain: 0.07, type: 'bandpass', freq: 700, to: 3400, q: 1.6,
             rate: 0.8, rateTo: 2.2, up: true, verb: 0.24 });
    dRelay({ gain: 0.15, pitch: 1.1, weight: 0.8, delay: 0.52, verb: 0.14 });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// HIGH ROLLER - the trailer cut of the same game
// ══════════════════════════════════════════════════════════════════════════════
// Where Vegas is an object in a room, this is a MIX: everything is deep, wide and
// slow to let go. The vocabulary is film rather than machinery - sub drops, brass,
// taiko, and a hall long enough that a payout is still ringing while you read it.
//
// Two things keep it from turning to mud, and both are rules rather than taste:
//   * The SUB and the BODY never share a register. The sub sits under 70Hz and
//     the brass starts at 130Hz. Stack two things in the same octave and you get
//     one loud smear, which is the failure mode of every cinematic preset.
//   * Nothing frequent gets a long tail. The room here is 2.6s (SFX_ROOMS), so a
//     score tick sending 0.3 into it would leave the mix permanently washed. The
//     per-voice send is what makes a big room survivable, and in this pack it is
//     the difference between cinematic and unusable.

const HR_SUB  = 65.41;     // C2
const HR_MID  = 130.81;    // C3 - brass
const HR_BELL = 1046.50;   // C6

// A brass stack. The sine underneath is not a bass part, it is the fundamental
// the saws are too bright to supply on a laptop speaker.
function hrBrass(semi, { dur = 0.7, gain = 0.13, delay = 0, verb = 0.34, bite = 6, voices = 5 } = {}) {
  return dStab({ freq: dHz(semi, HR_MID), dur, gain, delay, voices, detune: 11,
                 cutFrom: bite, cutTo: 1.9, q: 2.2, attack: 0.014, sat: 0.5, verb, sub: 0.7 });
}

// A taiko. Skin (pink noise), shell (the pitch drop) and floor (the sub), which
// is the same three layers as everything else, just very low.
function hrHit({ gain = 0.3, delay = 0, size = 1, verb = 0.3 } = {}) {
  dNoise({ kind: 'pink', dur: 0.05 * size, gain: gain * 0.3, delay, type: 'bandpass',
           freq: 900 / size, q: 0.9, attack: 0.0007, verb: verb * 0.4 });
  dThump({ freq: 175 / size, to: 42 / size, dur: 0.42 * size, gain: gain, delay, sat: 0.7, verb });
  dSub({ freq: 52 / size, to: 30, dur: 0.6 * size, gain: gain * 0.62, delay, sat: 0.45 });
  return 0.6 * size;
}

// An orchestral bell. Nearly harmonic, so it reads as pitched rather than as a
// slab of metal - the opposite choice from the Vegas bell on purpose.
function hrChime(semi, { dur = 2.0, gain = 0.1, delay = 0, verb = 0.45 } = {}) {
  dBell({ freq: dHz(semi, HR_BELL), ratio: 2.01, index: 4.5, dur, gain, delay, verb, bite: 0.14 });
  dTone({ freq: dHz(semi, HR_BELL) * 0.5, type: 'sine', dur: dur * 0.6, gain: gain * 0.4, delay, attack: 0.003, verb });
  return dur;
}

// Air moving. The one sound that says something is COMING rather than that
// something happened, so it swells and is cut off rather than decaying.
function hrRise({ dur = 0.8, gain = 0.1, delay = 0, from = 300, to = 5200, verb = 0.35 } = {}) {
  dNoise({ kind: 'white', dur, gain, delay, type: 'bandpass', freq: from, to, q: 1.4, up: true, verb });
  dSweep({ kind: 'tone', from: dHz(-12, HR_MID), to: dHz(12, HR_MID), dur, gain: gain * 0.5,
           delay, type: 'sawtooth', up: true, verb: verb * 0.6 });
}

const HIGHROLLER_PACK = {
  card_select: () => {
    dClick({ dur: 0.014, freq: 1900, q: 0.8, gain: 0.07, kind: 'pink', verb: 0.12 });
    dThump({ freq: 150, to: 62, dur: 0.1, gain: 0.13, sat: 0.5, verb: 0.16 });
  },

  // A pizzicato low string per suit. Rising by suit, so a flush is one note and a
  // mixed hand walks up.
  card_pop: (suit) => {
    const i = packSuitIndex(suit);
    dPluck({ freq: dHz(dDegree('min', i), HR_MID), dur: 0.3, gain: 0.12, cutFrom: 8, cutTo: 2, q: 4, sat: 0.35, verb: 0.24 });
    dSub({ freq: dHz(dDegree('min', i) - 12, HR_SUB), dur: 0.2, gain: 0.1, sat: 0.4 });
  },

  // Air, then the deck landing.
  flip_shuffle: () => {
    dNoise({ kind: 'white', dur: 0.24, gain: 0.05, type: 'bandpass', freq: 900, to: 4200, q: 1.2, up: true, verb: 0.3 });
    hrHit({ gain: 0.12, delay: 0.24, size: 0.8, verb: 0.3 });
  },

  // A minor second in the brass, which is the most reliably wrong-sounding
  // interval there is, over a sub that just sits there. No resolution.
  no_swaps: () => {
    hrBrass(-12, { dur: 0.42, gain: 0.12, bite: 3.4, verb: 0.2, voices: 4 });
    hrBrass(-11, { dur: 0.42, gain: 0.1, bite: 3.2, verb: 0.2, voices: 4 });
    dSub({ freq: 49, dur: 0.5, gain: 0.16, sat: 0.5 });
  },

  card_discard: (loud) => {
    const g = loud ? 1.8 : 1;
    dNoise({ kind: 'white', dur: loud ? 0.12 : 0.09, gain: 0.08 * g, type: 'bandpass',
             freq: 2600, to: 700, q: 0.9, attack: 0.001, verb: 0.2 });
    hrHit({ gain: (loud ? 0.3 : 0.15), delay: 0.012, size: loud ? 1.25 : 0.7, verb: 0.28 });
    if (loud) hrBrass(-14, { dur: 0.5, gain: 0.1, bite: 3, verb: 0.3, voices: 4 });
  },
  // A `variantOf` catalog row is looked up by its OWN id, so a pack that
  // defines only card_discard leaves the forced one playing the classic sound.
  card_discard_forced: () => HIGHROLLER_PACK.card_discard(true),

  particle_pip: () => {
    const i = packParticleIndex();
    dPluck({ freq: dHz(dDegree('lydian', i), HR_MID * 2), dur: 0.2, gain: 0.17,
             cutFrom: 7, cutTo: 2.4, q: 4, sat: 0.3, verb: 0.2 });
    dSub({ freq: dHz(dDegree('lydian', i) - 24, HR_MID), dur: 0.14, gain: 0.09, sat: 0.4 });
  },
  particle_mult: () => {
    const i = packParticleIndex();
    hrChime(dDegree('lydian', i), { dur: 0.5, gain: 0.15, verb: 0.3 });
  },

  score_tick: () => dClick({ dur: 0.012, freq: 3200, q: 1.0, gain: 0.062, kind: 'white', verb: 0.05 }),

  // The multiplier arriving: a short rise that lands on a brass hit, so the chip
  // settling has something under it rather than just changing number.
  focus_beat: () => {
    hrRise({ dur: 0.26, gain: 0.075, from: 500, to: 4000, verb: 0.25 });
    hrHit({ gain: 0.17, delay: 0.26, size: 0.95, verb: 0.32 });
    hrBrass(7, { dur: 0.8, gain: 0.09, delay: 0.26, bite: 7, verb: 0.38 });
  },

  // The hand. A stab whose chord grows with what it paid: a fifth for a small
  // one, a full stacked lydian chord for a big one.
  hand_scored: (finalScore) => {
    const tier = packScoreTier(finalScore);
    hrHit({ gain: 0.26 + tier * 0.015, size: 1, verb: 0.3 });
    [0, 7, 12, 16, 19].slice(0, 2 + tier).forEach((s, i) =>
      hrBrass(s, { dur: 0.75 + i * 0.05, gain: 0.105 - i * 0.008, delay: i * 0.02, bite: 6 + i, verb: 0.36 }));
    if (tier >= 3) hrChime(24, { dur: 2.2, gain: 0.07, delay: 0.06, verb: 0.5 });
  },

  bonus_hand: () => [12, 16, 19].forEach((s, i) => hrChime(s, { dur: 1.3, gain: 0.08, delay: i * 0.055, verb: 0.45 })),

  // The trailer hit. Silence, a short rise, then everything at once and a hall
  // that takes three seconds to let go of it.
  win_explode: () => {
    const t0 = D_ANTICIPATION;
    hrRise({ dur: t0 + 0.05, gain: 0.09, from: 400, to: 6000, verb: 0.4 });
    hrHit({ gain: 0.38, delay: t0, size: 1.5, verb: 0.45 });
    dSub({ freq: 78, to: 26, dur: 1.6, gain: 0.3, delay: t0, sat: 0.55 });
    [0, 7, 12, 16].forEach((s, i) =>
      hrBrass(s, { dur: 1.7 - i * 0.12, gain: 0.115 - i * 0.008, delay: t0 + i * 0.018, bite: 8, verb: 0.5 }));
    hrChime(24, { dur: 3.0, gain: 0.085, delay: t0 + 0.04, verb: 0.6 });
    dNoise({ kind: 'white', dur: 1.5, gain: 0.06, delay: t0, type: 'highpass', freq: 5000, to: 1800, q: 0.7, verb: 0.55 });
  },

  multi_goal: (count) => {
    for (let i = 0; i < count; i++) {
      const at = i * 0.3;
      hrHit({ gain: 0.26, delay: at, size: 1.05, verb: 0.34 });
      hrBrass(i * 5, { dur: 1.0, gain: 0.115, delay: at, bite: 7, verb: 0.42 });
      hrChime(12 + i * 5, { dur: 1.6, gain: 0.06, delay: at + 0.02, verb: 0.5 });
    }
  },

  focus_pop:  () => dTone({ freq: dHz(12, HR_BELL), type: 'sine', dur: 0.1, gain: 0.05, attack: 0.001, verb: 0.2 }),
  focus_drop: () => dSweep({ kind: 'tone', from: 260, to: 70, dur: 0.24, gain: 0.07, type: 'triangle', up: false, verb: 0.18 }),

  round_start: () => {
    hrRise({ dur: 0.55, gain: 0.1, from: 250, to: 5000, verb: 0.4 });
    hrHit({ gain: 0.3, delay: 0.55, size: 1.2, verb: 0.36 });
    hrBrass(0, { dur: 1.1, gain: 0.115, delay: 0.55, bite: 6, verb: 0.4 });
  },

  // Three taiko, falling in pitch. A countdown should tighten, not lift.
  countdown: () => [0, 1, 2].forEach(i => {
    hrHit({ gain: 0.26 + i * 0.02, delay: i * 1.0, size: 1.15 - i * 0.12, verb: 0.3 });
    dSub({ freq: 55 - i * 3, dur: 0.5, gain: 0.14, delay: i * 1.0, sat: 0.5 });
  }),

  success: () => { hrHit({ gain: 0.24, size: 1, verb: 0.34 }); [0, 7, 12].forEach((s, i) => hrBrass(s, { dur: 1.2, gain: 0.11, delay: i * 0.02, bite: 7, verb: 0.42 })); },

  victory: () => {
    hrHit({ gain: 0.34, size: 1.35, verb: 0.4 });
    dRun(6, (f, at, i) => hrBrass(dDegree('lydian', i), { dur: 1.3, gain: 0.105, delay: at, bite: 7 + i, verb: 0.46 }), { step: 0.1 });
    hrChime(24, { dur: 3.0, gain: 0.08, delay: 0.55, verb: 0.6 });
    hrHit({ gain: 0.3, delay: 0.6, size: 1.3, verb: 0.4 });
  },

  level_up: () => {
    dRun(5, (f, at, i) => hrChime(dDegree('lydian', i) + 12, { dur: 1.4, gain: 0.075, delay: at, verb: 0.5 }), { step: 0.08 });
    hrHit({ gain: 0.26, delay: 0.32, size: 1.1, verb: 0.36 });
    hrBrass(12, { dur: 1.2, gain: 0.105, delay: 0.32, bite: 8, verb: 0.44 });
  },

  // THE REWARD COUNTER (r378) - taiko, then brass and a chime left in the hall.
  reward_count: (step = 0) => {
    const k = Math.min(step, 5), t = 2.7 + k * 0.25;
    hrHit({ gain: 0.34, size: 1.15 + k * 0.05, verb: 0.5 });
    hrBrass(k * 2, { dur: t * 0.55, gain: 0.17, delay: 0.03, bite: 7, verb: 0.55 });
    hrChime(12 + k * 2, { dur: t, gain: 0.14, delay: 0.05, verb: 0.62 });
    dSub({ freq: 62, to: 44, dur: t * 0.6, gain: 0.3, sat: 0.35, verb: 0.3 });
  },

  heartbeat: (gain = 1.0) => {
    hrHit({ gain: 0.2 * gain, size: 1.3, verb: 0.2 });
    hrHit({ gain: 0.13 * gain, delay: 0.14, size: 1.15, verb: 0.2 });
  },

  coin: () => { hrChime(dRand(7, 19) | 0, { dur: 1.4, gain: 0.17, verb: 0.48 }); dClick({ dur: 0.01, freq: 6000, q: 1, gain: 0.03, kind: 'metal', rate: 2.4, verb: 0.2 }); },

  shop_open: () => {
    dNoise({ kind: 'white', dur: 0.5, gain: 0.07, type: 'lowpass', freq: 600, to: 3200, q: 0.7, up: true, verb: 0.4 });
    hrHit({ gain: 0.2, delay: 0.5, size: 1.1, verb: 0.36 });
    [0, 4, 7, 11].forEach((s, i) => hrBrass(s, { dur: 1.4, gain: 0.07, delay: 0.5 + i * 0.03, bite: 4.5, verb: 0.45 }));
  },

  reward_good: () => { hrChime(12, { dur: 1.6, gain: 0.085, verb: 0.5 }); hrChime(19, { dur: 1.8, gain: 0.075, delay: 0.07, verb: 0.5 }); hrHit({ gain: 0.16, size: 0.8, verb: 0.3 }); },
  reward_bad: () => {
    hrHit({ gain: 0.24, size: 1.3, verb: 0.3 });
    hrBrass(-13, { dur: 0.7, gain: 0.11, bite: 3, verb: 0.3, voices: 4 });
    hrBrass(-12, { dur: 0.7, gain: 0.09, bite: 3, verb: 0.3, voices: 4 });
  },
  reward_reveal: () => dRun(5, (f, at, i) => hrChime(dDegree('whole', i) + 12, { dur: 1.0, gain: 0.055, delay: at, verb: 0.5 }), { step: 0.06 }),
  reward_select: () => { dClick({ dur: 0.012, freq: 2400, q: 0.9, gain: 0.11, kind: 'pink', verb: 0.14 }); dThump({ freq: 200, to: 80, dur: 0.09, gain: 0.17, sat: 0.4, verb: 0.16 }); },

  // Suspense: a whole-tone cluster has no home note, so it cannot resolve and the
  // ear keeps waiting for it to.
  chal_appear: () => {
    hrRise({ dur: 1.0, gain: 0.08, from: 200, to: 3000, verb: 0.45 });
    [0, 2, 6].forEach((s, i) => hrBrass(s - 12, { dur: 1.6, gain: 0.075, delay: 0.95 + i * 0.02, bite: 3.5, verb: 0.45, voices: 4 }));
    hrHit({ gain: 0.22, delay: 0.95, size: 1.3, verb: 0.35 });
  },
  chal_win: () => { hrHit({ gain: 0.28, size: 1.1, verb: 0.36 }); [0, 7, 16].forEach((s, i) => hrBrass(s, { dur: 1.2, gain: 0.11, delay: i * 0.03, bite: 7, verb: 0.44 })); hrChime(24, { dur: 2.0, gain: 0.06, delay: 0.1, verb: 0.55 }); },
  chal_fail: () => {
    hrHit({ gain: 0.3, size: 1.5, verb: 0.35 });
    dSweep({ kind: 'tone', from: 130, to: 42, dur: 1.1, gain: 0.12, type: 'sawtooth', up: false, verb: 0.35 });
    hrBrass(-17, { dur: 1.2, gain: 0.1, bite: 2.6, verb: 0.35, voices: 4 });
  },

  m3_match: (step) => dPluck({ freq: dHz(dDegree('lydian', (step || 1) * 2), HR_MID * 2), dur: 0.3, gain: 0.1, cutFrom: 7, cutTo: 2.2, q: 4, sat: 0.3, verb: 0.28 }),
  m3_pop:   (step) => { dClick({ dur: 0.014, freq: 2200 + (step || 1) * 200, q: 1, gain: 0.17, kind: 'pink', verb: 0.14 }); dThump({ freq: 180, to: 70, dur: 0.1, gain: 0.32, sat: 0.4, verb: 0.16 }); },
  m3_combo: (step) => {
    const n = Math.min(6, 2 + (step || 1));
    hrHit({ gain: 0.22, size: 1, verb: 0.32 });
    dRun(n, (f, at, i) => hrBrass(dDegree('lydian', (step || 1) + i), { dur: 0.8, gain: 0.1, delay: at, bite: 7, verb: 0.4 }), { step: 0.06 });
  },

  clock_tick: () => dClick({ dur: 0.012, freq: 2600, q: 1.1, gain: 0.11, kind: 'pink', verb: 0.06 }),
  tick_tock: () => {
    dClick({ dur: 0.013, freq: 3000, q: 1.3, gain: 0.07, kind: 'pink', verb: 0.2 });
    dThump({ freq: 220, to: 90, dur: 0.1, gain: 0.08, sat: 0.4, verb: 0.2 });
    dClick({ dur: 0.013, freq: 2100, q: 1.3, gain: 0.06, kind: 'pink', delay: 0.22, verb: 0.2 });
    dThump({ freq: 170, to: 72, dur: 0.11, gain: 0.07, delay: 0.22, sat: 0.4, verb: 0.2 });
    hrBrass(-12, { dur: 1.4, gain: 0.05, bite: 3, verb: 0.45, voices: 3 });
  },
  // Tape pulled backwards: a swell that stops dead, pitching up the whole way.
  rewind: () => {
    dSweep({ kind: 'tone', from: dHz(-12, HR_MID), to: dHz(19, HR_MID), dur: 0.62, gain: 0.13, type: 'sawtooth', up: true, verb: 0.35 });
    dNoise({ kind: 'white', dur: 0.62, gain: 0.07, type: 'bandpass', freq: 500, to: 5000, q: 1.6, up: true, verb: 0.35 });
    dClick({ dur: 0.016, freq: 1800, q: 0.9, gain: 0.06, kind: 'pink', delay: 0.63, verb: 0.2 });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// NEON - the casino app, not the casino
// ══════════════════════════════════════════════════════════════════════════════
// Bright, tight and synthetic, and large by DENSITY rather than by length: the
// room is the smallest of the four (0.72s) so nothing smears, and the size comes
// from stacked detuned saws, hard sub kicks and a lot of events per second.
//
// The two things that make it read as modern rather than as chiptune:
//   * the sub kick is a real pitch drop with saturation, not a square wave. It is
//     what every one of these sounds is anchored to, and it is why a blip here
//     has weight that the same blip in the old 1-bit pack could not have.
//   * detuning. Five saws 18 cents apart beat against each other, and that
//     movement is the difference between a chord and a pad.

const NE_HI  = 1046.50;    // C6
const NE_MID = 523.25;     // C5
const NE_LOW = 130.81;     // C3

// A tight sub kick. Short, because this pack fires a lot of them and a long one
// would queue up behind itself.
function neKick({ gain = 0.26, delay = 0, size = 1, verb = 0.12 } = {}) {
  dClick({ dur: 0.008, freq: 5200, q: 0.9, gain: gain * 0.28, delay, kind: 'white', verb: verb * 0.5 });
  dThump({ freq: 220 / size, to: 48, dur: 0.2 * size, gain, delay, sat: 0.8, drop: 0.16, verb });
  return 0.25 * size;
}

// A glassy FM bell. The high modulator ratio is what makes it glass rather than
// metal, and the fast index collapse keeps it from ringing like a gong.
function neBell(semi, { dur = 0.6, gain = 0.11, delay = 0, verb = 0.3, bright = 1 } = {}) {
  dBell({ freq: dHz(semi, NE_HI), ratio: 5.01, index: 3.2 * bright, dur, gain, delay, verb, bite: 0.07 });
  dTone({ freq: dHz(semi, NE_HI) * 2, type: 'sine', dur: dur * 0.2, gain: gain * 0.3, delay, attack: 0.001, verb: verb * 0.7 });
  return dur;
}

// The supersaw. Seven voices is the point of diminishing returns; past it the
// beating is already dense and the extra oscillators are free CPU spent.
function neSaw(semi, { dur = 0.5, gain = 0.12, delay = 0, verb = 0.24, voices = 7, detune = 18, bite = 9 } = {}) {
  return dStab({ freq: dHz(semi, NE_MID), dur, gain, delay, voices, detune,
                 cutFrom: bite, cutTo: 2.6, q: 3.4, attack: 0.006, sat: 0.45, verb, sub: 0.6 });
}

// A pulse blip. 12.5% duty is the thin nasal one: it cuts through anything.
function neBlip(semi, { dur = 0.09, gain = 0.08, delay = 0, duty = 0.18, verb = 0.18, to = null } = {}) {
  return dTone({ freq: dHz(semi, NE_MID), to: to == null ? null : dHz(to, NE_MID),
                 wave: dPulse(duty), dur, gain, delay, attack: 0.001, sat: 0.3, verb });
}

const NEON_PACK = {
  card_select: () => { neBlip(19, { dur: 0.045, gain: 0.085, duty: 0.14, verb: 0.16 }); neKick({ gain: 0.1, size: 0.5, verb: 0.08 }); },

  card_pop: (suit) => {
    const i = packSuitIndex(suit);
    neBell(dDegree('lydian', i), { dur: 0.28, gain: 0.085, verb: 0.24, bright: 1.1 });
    neKick({ gain: 0.09, size: 0.5, verb: 0.06 });
  },

  flip_shuffle: () => {
    dCascade(9, (i, at) => dNoise({ kind: 'white', dur: 0.026, gain: 0.05, delay: at,
      type: 'bandpass', freq: 2600 + i * 420, q: 2.2, attack: 0.0007, verb: 0.16 }),
      { spread: 0.22, jitter: 0.5, accel: 0.85 });
    dSweep({ kind: 'noise', from: 900, to: 6000, dur: 0.22, gain: 0.05, q: 1.6, up: true, verb: 0.2 });
    neKick({ gain: 0.16, delay: 0.23, size: 0.9, verb: 0.12 });
  },

  // Down, not up, and through a closed filter so it has no top at all.
  no_swaps: () => {
    neSaw(-13, { dur: 0.3, gain: 0.12, bite: 2.4, verb: 0.16, voices: 5, detune: 26 });
    neBlip(-13, { dur: 0.18, gain: 0.07, duty: 0.5, verb: 0.12, to: -20 });
    neKick({ gain: 0.16, size: 1.2, verb: 0.1 });
  },

  card_discard: (loud) => {
    const g = loud ? 1.8 : 1;
    dSweep({ kind: 'noise', from: 5200, to: 700, dur: loud ? 0.2 : 0.13, gain: 0.07 * g, q: 1.2, up: false, verb: 0.18 });
    neKick({ gain: (loud ? 0.3 : 0.15), delay: 0.01, size: loud ? 1.4 : 0.8, verb: 0.14 });
    if (loud) neSaw(-15, { dur: 0.4, gain: 0.1, bite: 2.2, verb: 0.22, voices: 5 });
  },
  // A `variantOf` catalog row is looked up by its OWN id, so a pack that
  // defines only card_discard leaves the forced one playing the classic sound.
  card_discard_forced: () => NEON_PACK.card_discard(true),

  particle_pip:  () => { const i = packParticleIndex(); neBlip(dDegree('lydian', i), { dur: 0.07, gain: 0.32, duty: 0.22, verb: 0.16 }); },
  particle_mult: () => { const i = packParticleIndex(); neBell(dDegree('lydian', i), { dur: 0.32, gain: 0.17, verb: 0.26 }); },

  score_tick: () => neBlip(31, { dur: 0.016, gain: 0.035, duty: 0.1, verb: 0.05 }),

  focus_beat: () => {
    dSweep({ kind: 'noise', from: 700, to: 7000, dur: 0.2, gain: 0.06, q: 1.4, up: true, verb: 0.22 });
    neKick({ gain: 0.24, delay: 0.2, size: 1.1, verb: 0.14 });
    neSaw(7, { dur: 0.6, gain: 0.12, delay: 0.2, bite: 10, verb: 0.3 });
    neBell(19, { dur: 0.7, gain: 0.07, delay: 0.21, verb: 0.3 });
  },

  hand_scored: (finalScore) => {
    const tier = packScoreTier(finalScore);
    neKick({ gain: 0.3 + tier * 0.015, size: 1, verb: 0.12 });
    [0, 7, 12, 16, 19].slice(0, 2 + tier).forEach((s, i) =>
      neSaw(s, { dur: 0.45 + i * 0.04, gain: 0.15 - i * 0.01, delay: i * 0.018, bite: 9 + i, verb: 0.28 }));
    if (tier >= 2) dRun(3 + tier, (f, at, i) => neBell(dDegree('lydian', 7 + i) , { dur: 0.35, gain: 0.055, delay: at, verb: 0.3 }), { step: 0.045, delay: 0.1 });
  },

  bonus_hand: () => [12, 16, 19].forEach((s, i) => neBell(s, { dur: 0.5, gain: 0.08, delay: i * 0.05, verb: 0.3 })),

  // The app's big win: a riser, a hard kick, a stacked chord and an arpeggio that
  // keeps going for a second afterwards. It is loud because there is a lot in it.
  win_explode: () => {
    const t0 = D_ANTICIPATION;
    dSweep({ kind: 'noise', from: 500, to: 9000, dur: t0 + 0.04, gain: 0.08, q: 1.3, up: true, verb: 0.3 });
    neKick({ gain: 0.34, delay: t0, size: 1.6, verb: 0.18 });
    dSub({ freq: 70, to: 32, dur: 0.9, gain: 0.24, delay: t0, sat: 0.6 });
    [0, 7, 12, 16, 19].forEach((s, i) =>
      neSaw(s, { dur: 1.1 - i * 0.08, gain: 0.11 - i * 0.008, delay: t0 + i * 0.016, bite: 11, verb: 0.36 }));
    dRun(14, (f, at, i) => neBell(dDegree('lydian', i + 5), { dur: 0.45, gain: 0.06, delay: at, verb: 0.34 }),
         { step: 0.055, delay: t0 + 0.1 });
    dNoise({ kind: 'white', dur: 0.7, gain: 0.05, delay: t0, type: 'highpass', freq: 7000, to: 3000, q: 0.7, verb: 0.35 });
  },

  multi_goal: (count) => {
    for (let i = 0; i < count; i++) {
      const at = i * 0.3;
      neKick({ gain: 0.24, delay: at, size: 1.1, verb: 0.14 });
      neSaw(i * 5, { dur: 0.7, gain: 0.11, delay: at, bite: 10, verb: 0.32 });
      dRun(4, (f, a2, j) => neBell(dDegree('lydian', i * 3 + j + 7), { dur: 0.35, gain: 0.055, delay: a2, verb: 0.3 }), { step: 0.05, delay: at + 0.06 });
    }
  },

  focus_pop:  () => neBlip(28, { dur: 0.05, gain: 0.055, duty: 0.14, verb: 0.16 }),
  focus_drop: () => neBlip(14, { dur: 0.14, gain: 0.05, duty: 0.3, verb: 0.14, to: 0 }),

  round_start: () => {
    dSweep({ kind: 'noise', from: 400, to: 7000, dur: 0.45, gain: 0.08, q: 1.3, up: true, verb: 0.3 });
    neKick({ gain: 0.3, delay: 0.45, size: 1.3, verb: 0.16 });
    neSaw(0, { dur: 0.8, gain: 0.115, delay: 0.45, bite: 10, verb: 0.32 });
    neBell(24, { dur: 0.8, gain: 0.07, delay: 0.46, verb: 0.32 });
  },

  countdown: () => [0, 1, 2].forEach(i => {
    neKick({ gain: 0.26, delay: i * 1.0, size: 1.2, verb: 0.12 });
    neBlip(-5 + i, { dur: 0.1, gain: 0.08, duty: 0.5, delay: i * 1.0, verb: 0.16 });
  }),

  success: () => { neKick({ gain: 0.28, size: 1, verb: 0.12 }); [0, 7, 12].forEach((s, i) => neSaw(s, { dur: 0.8, gain: 0.16, delay: i * 0.02, bite: 10, verb: 0.32 })); },

  victory: () => {
    neKick({ gain: 0.32, size: 1.4, verb: 0.16 });
    dRun(8, (f, at, i) => neSaw(dDegree('lydian', i), { dur: 0.8, gain: 0.16, delay: at, bite: 10, verb: 0.34 }), { step: 0.085 });
    dRun(10, (f, at, i) => neBell(dDegree('lydian', i + 7), { dur: 0.5, gain: 0.06, delay: at, verb: 0.34 }), { step: 0.06, delay: 0.3 });
  },

  level_up: () => {
    dRun(6, (f, at, i) => neBell(dDegree('lydian', i + 5), { dur: 0.5, gain: 0.075, delay: at, verb: 0.32 }), { step: 0.06 });
    neKick({ gain: 0.26, delay: 0.3, size: 1.2, verb: 0.14 });
    neSaw(12, { dur: 0.9, gain: 0.11, delay: 0.3, bite: 11, verb: 0.34 });
  },

  // THE REWARD COUNTER (r378) - a tight kick under a wide FM bell and a pad
  // that is still there when the card bumps again.
  reward_count: (step = 0) => {
    const k = Math.min(step, 5), t = 2.1 + k * 0.2;
    neKick({ gain: 0.34, size: 1.25, verb: 0.16 });
    neBell(12 + k * 2, { dur: t, gain: 0.16, delay: 0.02, verb: 0.6, bright: 1.1 });
    neSaw(k * 2, { dur: t * 0.7, gain: 0.135, delay: 0.03, bite: 8, verb: 0.5 });
    dSub({ freq: 58, to: 40, dur: t * 0.6, gain: 0.33, sat: 0.4, verb: 0.24 });
  },

  heartbeat: (gain = 1.0) => {
    neKick({ gain: 0.3 * gain, size: 1.5, verb: 0.08 });
    neKick({ gain: 0.2 * gain, delay: 0.14, size: 1.35, verb: 0.08 });
  },

  coin: () => { neBell(dDegree('lydian', (dRand(3, 9) | 0)) + 12, { dur: 0.45, gain: 0.24, verb: 0.3, bright: 1.3 }); dClick({ dur: 0.008, freq: 7000, q: 1, gain: 0.03, kind: 'metal', rate: 2.6, verb: 0.14 }); },

  shop_open: () => {
    dSweep({ kind: 'noise', from: 500, to: 5000, dur: 0.4, gain: 0.06, q: 1.2, up: true, verb: 0.28 });
    neKick({ gain: 0.18, delay: 0.4, size: 1, verb: 0.12 });
    [0, 4, 7, 11].forEach((s, i) => neSaw(s, { dur: 1.0, gain: 0.07, delay: 0.4 + i * 0.025, bite: 6, verb: 0.34 }));
  },

  reward_good: () => { neBell(12, { dur: 0.5, gain: 0.17, verb: 0.3 }); neBell(19, { dur: 0.6, gain: 0.15, delay: 0.06, verb: 0.3 }); neKick({ gain: 0.2, size: 0.7, verb: 0.1 }); },
  reward_bad:  () => { neSaw(-14, { dur: 0.45, gain: 0.12, bite: 2.2, verb: 0.2, voices: 5, detune: 30 }); neKick({ gain: 0.2, size: 1.3, verb: 0.12 }); neBlip(-14, { dur: 0.22, gain: 0.06, duty: 0.5, to: -21, verb: 0.14 }); },
  reward_reveal: () => dRun(6, (f, at, i) => neBell(dDegree('lydian', i + 7), { dur: 0.35, gain: 0.05, delay: at, verb: 0.3 }), { step: 0.05 }),
  reward_select: () => { neBlip(24, { dur: 0.035, gain: 0.12, duty: 0.14, verb: 0.16 }); neKick({ gain: 0.16, size: 0.55, verb: 0.08 }); },

  chal_appear: () => {
    dSweep({ kind: 'noise', from: 300, to: 4000, dur: 0.9, gain: 0.07, q: 1.4, up: true, verb: 0.34 });
    [0, 2, 6].forEach((s, i) => neSaw(s - 12, { dur: 1.1, gain: 0.075, delay: 0.88 + i * 0.02, bite: 3.6, verb: 0.34, voices: 5 }));
    neKick({ gain: 0.2, delay: 0.88, size: 1.3, verb: 0.12 });
  },
  chal_win:  () => { neKick({ gain: 0.26, size: 1.1, verb: 0.14 }); [0, 7, 16].forEach((s, i) => neSaw(s, { dur: 0.8, gain: 0.105, delay: i * 0.025, bite: 10, verb: 0.32 })); },
  chal_fail: () => { neKick({ gain: 0.28, size: 1.5, verb: 0.14 }); dSweep({ kind: 'tone', from: 420, to: 60, dur: 0.7, gain: 0.11, type: 'sawtooth', up: false, verb: 0.26 }); },

  m3_match: (step) => neBell(dDegree('lydian', (step || 1) * 2), { dur: 0.32, gain: 0.09, verb: 0.28 }),
  m3_pop:   (step) => { neBlip(12 + (step || 1) * 2, { dur: 0.05, gain: 0.12, duty: 0.2, verb: 0.14 }); neKick({ gain: 0.2, size: 0.6, verb: 0.08 }); },
  m3_combo: (step) => {
    const n = Math.min(6, 2 + (step || 1));
    neKick({ gain: 0.2, size: 1, verb: 0.12 });
    dRun(n, (f, at, i) => neSaw(dDegree('lydian', (step || 1) + i), { dur: 0.5, gain: 0.15, delay: at, bite: 10, verb: 0.3 }), { step: 0.05 });
  },

  clock_tick: () => neBlip(36, { dur: 0.012, gain: 0.022, duty: 0.1, verb: 0.05 }),
  tick_tock: () => {
    neBlip(33, { dur: 0.03, gain: 0.07, duty: 0.12, verb: 0.16 });
    neBlip(26, { dur: 0.035, gain: 0.06, duty: 0.12, delay: 0.22, verb: 0.16 });
    neSaw(-12, { dur: 0.9, gain: 0.05, bite: 3.2, verb: 0.3, voices: 5 });
  },
  rewind: () => {
    dSweep({ kind: 'tone', from: dHz(-5, NE_LOW), to: dHz(26, NE_LOW), dur: 0.6, gain: 0.11, type: 'sawtooth', up: true, verb: 0.26 });
    dSweep({ kind: 'noise', from: 600, to: 8000, dur: 0.6, gain: 0.06, q: 1.7, up: true, verb: 0.26 });
    neBlip(12, { dur: 0.04, gain: 0.06, duty: 0.14, delay: 0.61, verb: 0.16 });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// LOUNGE - the bar off the casino floor
// ══════════════════════════════════════════════════════════════════════════════
// The quiet one, and deliberately not the small one. Weight here lives in the
// LOW MIDS rather than in the transient: tape-saturated thumps, an upright bass
// under almost everything, a long dark plate. Nothing is bright, nothing clicks,
// and the biggest moment is a chord rather than an impact.
//
// It exists because "heavier" and "louder" are different requests, and a player
// who has the game on for an hour will want one of these four to be this.

const LO_KEYS = 261.63;    // C4 - the Rhodes
const LO_BASS = 98.00;     // G2 - the upright
const LO_VIBE = 523.25;    // C5 - the vibraphone

// Tape thump. No click layer at all: the attack is the saturation, which is what
// keeps the pack soft without making it weak.
function loThump({ gain = 0.22, delay = 0, size = 1, verb = 0.24 } = {}) {
  dThump({ freq: 130 / size, to: 44, dur: 0.38 * size, gain, delay, sat: 0.85, drop: 0.3, verb });
  dNoise({ kind: 'pink', dur: 0.04, gain: gain * 0.16, delay, type: 'lowpass', freq: 700, q: 0.6, attack: 0.003, verb: verb * 0.4 });
  return 0.45 * size;
}
function loKey(semi, { dur = 1.1, gain = 0.13, delay = 0, verb = 0.32, bright = 1 } = {}) {
  return dRhodes({ freq: dHz(semi, LO_KEYS), dur, gain, delay, verb, bright });
}
function loVibe(semi, { dur = 1.4, gain = 0.1, delay = 0, verb = 0.38 } = {}) {
  return dMallet({ freq: dHz(semi, LO_VIBE), dur, gain, delay, verb, wood: 0.4 });
}
function loBass(semi, { dur = 0.6, gain = 0.15, delay = 0, verb = 0.14 } = {}) {
  dPluck({ freq: dHz(semi, LO_BASS), dur, gain, delay, type: 'triangle', cutFrom: 5, cutTo: 1.3, q: 3, sat: 0.5, verb });
  dSub({ freq: dHz(semi, LO_BASS) / 2, dur: dur * 0.7, gain: gain * 0.5, delay, sat: 0.4 });
}
// A brush on a snare head. Soft pink noise with no transient to speak of.
function loBrush({ dur = 0.2, gain = 0.06, delay = 0, freq = 1800, to = 700, verb = 0.24 } = {}) {
  dNoise({ kind: 'pink', dur, gain, delay, type: 'bandpass', freq, to, q: 0.8, attack: 0.008, verb });
}

const LOUNGE_PACK = {
  card_select: () => { loBrush({ dur: 0.05, gain: 0.075, freq: 2400, to: 1200, verb: 0.16 }); loThump({ gain: 0.11, size: 0.5, verb: 0.12 }); },

  card_pop: (suit) => {
    const i = packSuitIndex(suit);
    loKey(dDegree('maj', i), { dur: 0.45, gain: 0.1, verb: 0.26 });
    loBass(dDegree('maj', i), { dur: 0.22, gain: 0.07, verb: 0.1 });
  },

  flip_shuffle: () => {
    dCascade(9, (i, at) => loBrush({ dur: 0.035, gain: 0.05, delay: at, freq: 1500 + i * 180, to: 800, verb: 0.16 }),
             { spread: 0.24, jitter: 0.5, accel: 0.8 });
    loThump({ gain: 0.13, delay: 0.24, size: 0.85, verb: 0.2 });
  },

  // A flat minor second on the keys, undamped. It does not resolve and it does
  // not decay cleanly, which is the softest way to say no.
  no_swaps: () => {
    loKey(-13, { dur: 0.6, gain: 0.11, verb: 0.22, bright: 0.6 });
    loKey(-12, { dur: 0.6, gain: 0.09, verb: 0.22, bright: 0.6 });
    loBass(-12, { dur: 0.5, gain: 0.12, verb: 0.1 });
  },

  card_discard: (loud) => {
    const g = loud ? 1.8 : 1;
    loBrush({ dur: loud ? 0.16 : 0.1, gain: 0.07 * g, freq: 1600, to: 500, verb: 0.2 });
    loThump({ gain: (loud ? 0.26 : 0.13), delay: 0.01, size: loud ? 1.3 : 0.75, verb: 0.24 });
    if (loud) loBass(-17, { dur: 0.7, gain: 0.13, verb: 0.16 });
  },
  // A `variantOf` catalog row is looked up by its OWN id, so a pack that
  // defines only card_discard leaves the forced one playing the classic sound.
  card_discard_forced: () => LOUNGE_PACK.card_discard(true),

  particle_pip:  () => { const i = packParticleIndex(); loKey(dDegree('majPent', i), { dur: 0.3, gain: 0.17, verb: 0.24, bright: 1.1 }); },
  particle_mult: () => { const i = packParticleIndex(); loVibe(dDegree('majPent', i), { dur: 0.5, gain: 0.15, verb: 0.3 }); },

  score_tick: () => loBrush({ dur: 0.014, gain: 0.07, freq: 3600, to: 2400, verb: 0.05 }),

  focus_beat: () => {
    loBrush({ dur: 0.22, gain: 0.05, freq: 600, to: 3400, verb: 0.22 });
    loThump({ gain: 0.2, delay: 0.22, size: 1, verb: 0.26 });
    [0, 4, 7, 11].forEach((s, i) => loKey(s, { dur: 1.2, gain: 0.085, delay: 0.22 + i * 0.015, verb: 0.34 }));
  },

  hand_scored: (finalScore) => {
    const tier = packScoreTier(finalScore);
    loThump({ gain: 0.2 + tier * 0.012, size: 1, verb: 0.26 });
    loBass(0, { dur: 0.7, gain: 0.13, verb: 0.14 });
    [0, 4, 7, 11, 14].slice(0, 2 + tier).forEach((s, i) =>
      loKey(s, { dur: 1.1, gain: 0.09 - i * 0.006, delay: i * 0.025, verb: 0.32 }));
    if (tier >= 2) dRun(3 + tier, (f, at, i) => loVibe(dDegree('majPent', i + 4), { dur: 0.7, gain: 0.05, delay: at, verb: 0.36 }), { step: 0.06, delay: 0.1 });
  },

  bonus_hand: () => [11, 14, 18].forEach((s, i) => loVibe(s, { dur: 1.0, gain: 0.08, delay: i * 0.06, verb: 0.36 })),

  // A big warm chord rather than a hit: the bass takes the root, the keys take
  // the extensions, and the plate holds it for two seconds.
  win_explode: () => {
    const t0 = D_ANTICIPATION;
    loBrush({ dur: t0 + 0.06, gain: 0.07, freq: 400, to: 3600, verb: 0.35 });
    loThump({ gain: 0.3, delay: t0, size: 1.5, verb: 0.34 });
    loBass(-12, { dur: 1.6, gain: 0.18, delay: t0, verb: 0.2 });
    [0, 4, 7, 11, 14, 18].forEach((s, i) =>
      loKey(s, { dur: 2.2 - i * 0.12, gain: 0.095 - i * 0.006, delay: t0 + i * 0.025, verb: 0.44 }));
    dRun(10, (f, at, i) => loVibe(dDegree('majPent', i + 3), { dur: 1.2, gain: 0.055, delay: at, verb: 0.46 }),
         { step: 0.075, delay: t0 + 0.12 });
  },

  multi_goal: (count) => {
    for (let i = 0; i < count; i++) {
      const at = i * 0.3;
      loThump({ gain: 0.2, delay: at, size: 1.05, verb: 0.28 });
      loBass(i * 2, { dur: 0.8, gain: 0.13, delay: at, verb: 0.16 });
      [0, 4, 7].forEach((s, j) => loKey(s + i * 2, { dur: 1.3, gain: 0.085, delay: at + j * 0.02, verb: 0.36 }));
    }
  },

  focus_pop:  () => loVibe(24, { dur: 0.35, gain: 0.05, verb: 0.24 }),
  focus_drop: () => { loKey(7, { dur: 0.3, gain: 0.05, verb: 0.2, bright: 0.6 }); loBass(-5, { dur: 0.25, gain: 0.05, verb: 0.1 }); },

  round_start: () => {
    loBrush({ dur: 0.4, gain: 0.06, freq: 400, to: 3000, verb: 0.3 });
    loThump({ gain: 0.24, delay: 0.4, size: 1.2, verb: 0.3 });
    loBass(0, { dur: 1.0, gain: 0.15, delay: 0.4, verb: 0.16 });
    [0, 4, 7, 11].forEach((s, i) => loKey(s, { dur: 1.5, gain: 0.08, delay: 0.4 + i * 0.02, verb: 0.36 }));
  },

  countdown: () => [0, 1, 2].forEach(i => {
    loThump({ gain: 0.22, delay: i * 1.0, size: 1.15, verb: 0.26 });
    loBass(-5 + i, { dur: 0.5, gain: 0.12, delay: i * 1.0, verb: 0.14 });
  }),

  success: () => { loThump({ gain: 0.18, size: 0.95, verb: 0.28 }); [0, 4, 7, 11].forEach((s, i) => loKey(s, { dur: 1.5, gain: 0.085, delay: i * 0.02, verb: 0.36 })); },

  victory: () => {
    loThump({ gain: 0.28, size: 1.35, verb: 0.34 });
    loBass(-12, { dur: 1.8, gain: 0.17, verb: 0.2 });
    dRun(6, (f, at, i) => loKey(dDegree('maj', i + 2), { dur: 1.6, gain: 0.085, delay: at, verb: 0.42 }), { step: 0.1 });
    dRun(8, (f, at, i) => loVibe(dDegree('majPent', i + 3), { dur: 1.3, gain: 0.055, delay: at, verb: 0.46 }), { step: 0.075, delay: 0.4 });
  },

  level_up: () => {
    dRun(5, (f, at, i) => loVibe(dDegree('majPent', i + 2), { dur: 1.0, gain: 0.07, delay: at, verb: 0.4 }), { step: 0.075 });
    loThump({ gain: 0.2, delay: 0.3, size: 1.1, verb: 0.3 });
    [0, 4, 7, 11].forEach((s, i) => loKey(s + 12, { dur: 1.4, gain: 0.08, delay: 0.3 + i * 0.02, verb: 0.38 }));
  },

  // THE REWARD COUNTER (r378) - a tape thump, a vibes chord left to ring, and
  // an upright walking a tone up each bump.
  reward_count: (step = 0) => {
    const k = Math.min(step, 5), t = 2.2 + k * 0.22;
    loThump({ gain: 0.28, size: 1.05, verb: 0.3 });
    [0, 7, 16].forEach((sm, i) => loVibe(sm + k * 2, { dur: t, gain: 0.13 - i * 0.018, delay: i * 0.035, verb: 0.58 }));
    loKey(k * 2, { dur: t * 0.7, gain: 0.115, delay: 0.04, verb: 0.46 });
    loBass(k * 2 - 12, { dur: 0.9, gain: 0.22, verb: 0.2 });
  },

  heartbeat: (gain = 1.0) => {
    loThump({ gain: 0.28 * gain, size: 1.45, verb: 0.16 });
    loThump({ gain: 0.18 * gain, delay: 0.14, size: 1.3, verb: 0.16 });
  },

  coin: () => loVibe(dDegree('majPent', (dRand(2, 8) | 0)) + 12, { dur: 0.9, gain: 0.20, verb: 0.4 }),

  shop_open: () => {
    loBrush({ dur: 0.45, gain: 0.055, freq: 350, to: 2400, verb: 0.3 });
    loBass(-12, { dur: 1.2, gain: 0.14, delay: 0.45, verb: 0.18 });
    [0, 4, 7, 11, 14].forEach((s, i) => loKey(s, { dur: 1.8, gain: 0.07, delay: 0.45 + i * 0.03, verb: 0.4 }));
  },

  reward_good: () => { loVibe(12, { dur: 1.1, gain: 0.08, verb: 0.38 }); loVibe(19, { dur: 1.2, gain: 0.07, delay: 0.07, verb: 0.38 }); loKey(0, { dur: 0.9, gain: 0.07, verb: 0.3 }); },
  reward_bad:  () => { loThump({ gain: 0.2, size: 1.3, verb: 0.26 }); loKey(-13, { dur: 0.9, gain: 0.1, verb: 0.28, bright: 0.5 }); loBass(-17, { dur: 0.9, gain: 0.13, verb: 0.16 }); },
  reward_reveal: () => dRun(5, (f, at, i) => loVibe(dDegree('majPent', i + 4), { dur: 0.8, gain: 0.05, delay: at, verb: 0.4 }), { step: 0.06 }),
  reward_select: () => { loBrush({ dur: 0.04, gain: 0.09, freq: 2000, to: 1100, verb: 0.16 }); loKey(12, { dur: 0.22, gain: 0.12, verb: 0.22 }); },

  chal_appear: () => {
    loBrush({ dur: 0.8, gain: 0.055, freq: 300, to: 2200, verb: 0.34 });
    [0, 3, 6, 10].forEach((s, i) => loKey(s - 12, { dur: 1.8, gain: 0.07, delay: 0.78 + i * 0.02, verb: 0.4, bright: 0.7 }));
    loBass(-12, { dur: 1.2, gain: 0.13, delay: 0.78, verb: 0.18 });
  },
  chal_win:  () => { loThump({ gain: 0.2, size: 1, verb: 0.28 }); [0, 4, 7, 14].forEach((s, i) => loKey(s, { dur: 1.4, gain: 0.085, delay: i * 0.025, verb: 0.38 })); loVibe(24, { dur: 1.2, gain: 0.055, delay: 0.1, verb: 0.42 }); },
  chal_fail: () => { loThump({ gain: 0.24, size: 1.45, verb: 0.3 }); dSweep({ kind: 'tone', from: 200, to: 52, dur: 0.9, gain: 0.1, type: 'triangle', up: false, verb: 0.3 }); loKey(-17, { dur: 1.1, gain: 0.08, verb: 0.3, bright: 0.5 }); },

  m3_match: (step) => loVibe(dDegree('majPent', (step || 1) * 2), { dur: 0.7, gain: 0.085, verb: 0.34 }),
  m3_pop:   (step) => { loKey(dDegree('majPent', step || 1), { dur: 0.25, gain: 0.14, verb: 0.24 }); loThump({ gain: 0.16, size: 0.55, verb: 0.12 }); },
  m3_combo: (step) => {
    const n = Math.min(6, 2 + (step || 1));
    loThump({ gain: 0.16, size: 0.95, verb: 0.24 });
    dRun(n, (f, at, i) => loKey(dDegree('maj', (step || 1) + i), { dur: 0.9, gain: 0.085, delay: at, verb: 0.34 }), { step: 0.06 });
  },

  clock_tick: () => loBrush({ dur: 0.014, gain: 0.055, freq: 3000, to: 2200, verb: 0.05 }),
  tick_tock: () => {
    loBrush({ dur: 0.025, gain: 0.06, freq: 2800, to: 1800, verb: 0.2 });
    loBrush({ dur: 0.028, gain: 0.05, delay: 0.22, freq: 2000, to: 1300, verb: 0.2 });
    loKey(-12, { dur: 1.3, gain: 0.055, verb: 0.38, bright: 0.6 });
  },
  rewind: () => {
    dSweep({ kind: 'tone', from: dHz(-12, LO_KEYS), to: dHz(14, LO_KEYS), dur: 0.6, gain: 0.1, type: 'triangle', up: true, verb: 0.3 });
    dNoise({ kind: 'pink', dur: 0.6, gain: 0.06, type: 'bandpass', freq: 400, to: 3000, q: 1.3, up: true, verb: 0.3 });
    loKey(2, { dur: 0.5, gain: 0.07, delay: 0.61, verb: 0.28 });
  },
};

// ══ The picker ══════════════════════════════════════════════════════════════
// `classic` is deliberately NOT here. It is still the code floor every pack falls
// through to for an id it does not define, and it is still what plays if this
// file fails to load at all, but it is not something to choose: it is the thin
// set these four replaced. sfxPackId() maps any unknown stored value (an old
// save holding 'classic', 'onebit' or 'slot') onto the default rather than
// leaving the dropdown showing nothing.
const SFX_PACK_DEFAULT = 'vegas';

const SFX_PACKS = {
  vegas:      VEGAS_PACK,
  highroller: HIGHROLLER_PACK,
  neon:       NEON_PACK,
  lounge:     LOUNGE_PACK,
};

const SFX_PACK_LIST = [
  ['vegas',      'Vegas Floor', 'A slot cabinet: relays, coin hoppers, struck bells, reel detents.'],
  ['highroller', 'High Roller', 'Cinematic. Sub drops, brass, taiko and a long hall.'],
  ['neon',       'Neon',        'Modern casino app. FM bells, supersaws, tight sub kicks.'],
  ['lounge',     'Lounge',      'Warm analogue. Rhodes, vibes, tape thumps, brushed noise.'],
];
