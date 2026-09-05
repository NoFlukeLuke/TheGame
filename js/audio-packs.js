// ══════════════════════════════════════════════
// SOUND PACKS (r186) - alternative sets of coded sounds
// ══════════════════════════════════════════════
// Three ways every sound in SFX_CATALOG can be produced:
//
//   classic  - the original synthesised set in js/audio.js. Not defined here;
//              it is what the wrapper falls through to.
//   onebit   - one square wave, hard on/off, nothing else.
//   slot     - an 8-bit arcade slot machine: NES-style pulses, LFSR noise,
//              reel clicks, coin counters, jackpot fanfares.
//
// A pack does NOT have to cover every id. Anything it leaves out falls through
// to the classic sound, so a pack can be filled in a few sounds at a time.
//
// ── WHAT MAKES EACH ONE SOUND RIGHT ─────────────────────────────────────────
//
// ONE-BIT is a constraint, not a filter. A 1-bit machine (the ZX Spectrum
// beeper, a PC speaker) has a single output line that is either ON or OFF, so:
//   * there is no volume envelope - a note is at full level or silent, and the
//     hard gate below is the whole point. Fading anything in or out is the one
//     thing that instantly stops it sounding 1-bit.
//   * timbre comes from PULSE WIDTH alone. A 50% duty is the fat square; 12.5%
//     is the thin nasal one. That is the only tone control there is.
//   * pitch slides are STEPPED, not smooth, because the routine recomputes a
//     period per iteration rather than sweeping continuously.
//   * noise is a square wave whose period is re-randomised every few cycles.
//   * chords are faked by interleaving pulses from two pitches fast enough that
//     the ear fuses them (the "pulse interleaving" trick). onebitChord does this.
// The per-sound `gain` values here are a mixing concession - a real beeper has
// one loudness - but the ENVELOPE stays binary, which is what carries the sound.
//
// SLOT is NES APU vocabulary aimed at a casino cabinet:
//   * pulse waves at 12.5 / 25 / 50% duty for everything melodic, built with
//     createPeriodicWave from the Fourier series of a pulse: the nth harmonic of
//     a duty-d pulse has amplitude (2/(n*pi)) * sin(n*pi*d).
//   * the APU noise channel is a 15-bit shift register, feedback = bit0 XOR bit1
//     ("long", 32767 steps, a hiss) or bit0 XOR bit6 ("short", 93 steps, a
//     metallic ring). The short mode is what makes reel clicks and coin clatter
//     sound like a machine rather than like static, and it is the single biggest
//     difference between this and just using white noise.
//   * envelopes are instant-attack, linear-decay (the APU's 4-bit envelope).
//   * a WaveShaper quantises to 8-bit steps. The grit that adds is the point.
// Slot-machine anatomy the sounds follow: a firm mechanical click to commit, a
// reel whirr made of accelerating ticks, reels landing ONE AT A TIME with the
// gap between them doing the tension, a dry near-miss for a loss, bright
// repeating chimes for a small win, and a coin cascade for a big one.

// ══ Shared toolkit ══

// Pulse wave at an arbitrary duty cycle. Cached per duty AND per context - a
// PeriodicWave belongs to the context that made it.
const _pulseWaves = {};
function pulseWave(duty) {
  const ctx = getAudioCtx();
  const key = duty.toFixed(3);
  const hit = _pulseWaves[key];
  if (hit && hit.ctx === ctx) return hit.wave;
  const N = 28;                                   // harmonics; past this it is CPU for nothing
  const real = new Float32Array(N + 1);
  const imag = new Float32Array(N + 1);
  // Fourier series of a duty-d pulse. (The DC term createPeriodicWave ignores is
  // 2d-1, which is inaudible anyway.)
  for (let n = 1; n <= N; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  _pulseWaves[key] = { wave, ctx };
  return wave;
}

// 8-bit quantisation. A staircase transfer curve rounds every sample to one of
// 2^bits levels, which is what a WaveShaper is for - and it needs no
// AudioWorklet, which matters when the game is served as static files.
const _crushCurves = {};
function crusherNode(bits) {
  const ctx = getAudioCtx();
  const key = String(bits);
  if (!_crushCurves[key]) {
    const n = 2048, curve = new Float32Array(n), levels = Math.pow(2, bits - 1);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.round(x * levels) / levels;
    }
    _crushCurves[key] = curve;
  }
  const ws = ctx.createWaveShaper();
  ws.curve = _crushCurves[key];
  return ws;
}

// The NES noise channel: a 15-bit LFSR clocked at a fixed rate, output high when
// bit 0 is clear. One second is generated per mode and then PITCHED with
// playbackRate, which is how the real chip varies it too (a period divider).
const NOISE_STEP_HZ = 14000;
const _noiseBufs = {};
function lfsrNoiseBuffer(mode) {
  const ctx = getAudioCtx();
  const key = mode + '@' + ctx.sampleRate;
  if (_noiseBufs[key]) return _noiseBufs[key];
  const sr = ctx.sampleRate, len = Math.floor(sr);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let reg = 1, acc = 0, level = 1;
  const inc = NOISE_STEP_HZ / sr;
  for (let i = 0; i < len; i++) {
    acc += inc;
    while (acc >= 1) {
      acc -= 1;
      // bit0 XOR bit1 (long) or bit0 XOR bit6 (short, 93 steps - the metallic one)
      const fb = (reg & 1) ^ ((reg >> (mode === 'short' ? 6 : 1)) & 1);
      reg = (reg >> 1) | (fb << 14);
      level = (reg & 1) ? -1 : 1;
    }
    d[i] = level;
  }
  _noiseBufs[key] = buf;
  return buf;
}

// Everything below ends here: volume, then the duck bus the coded sounds use.
function _packOut(node, gain, bits) {
  const ctx = getAudioCtx();
  const g = ctx.createGain();
  g.gain.value = gain * sfxVolume();
  let head = node;
  if (bits) { const c = crusherNode(bits); head.connect(c); head = c; }
  head.connect(g);
  g.connect(sfxOut(ctx));
  return g;
}

// ── ONE-BIT primitives ──────────────────────────────────────────────────────

// A gated pulse. No attack, no release: the level is set at t and cleared at
// t+dur with setValueAtTime, never a ramp. `steps` slides the pitch in discrete
// jumps, the way a beeper routine does by recomputing its delay loop.
function bitTone({ freq = 880, dur = 0.06, duty = 0.5, gain = 0.13, delay = 0, to = null, steps = 6 }) {
  const lvl = gain * sfxVolume();
  if (lvl <= 0) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(pulseWave(duty));
  osc.frequency.setValueAtTime(freq, t);
  if (to && to !== freq) {
    for (let i = 1; i <= steps; i++) {
      osc.frequency.setValueAtTime(freq + (to - freq) * (i / steps), t + (dur * i) / steps);
    }
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.setValueAtTime(lvl, t);            // ON
  g.gain.setValueAtTime(0, t + dur);        // OFF. Nothing in between - that is the sound.
  osc.connect(g);
  g.connect(sfxOut(ctx));
  osc.start(t);
  osc.stop(t + dur + 0.01);
}

// Beeper noise: one square whose period is re-randomised every few milliseconds.
function bitNoise({ dur = 0.08, lo = 400, hi = 5000, gain = 0.1, delay = 0, grain = 0.004 }) {
  const lvl = gain * sfxVolume();
  if (lvl <= 0) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(pulseWave(0.5));
  for (let s = 0; s < dur; s += grain) {
    osc.frequency.setValueAtTime(lo + fxRandom() * (hi - lo), t + s);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(lvl, t);
  g.gain.setValueAtTime(0, t + dur);
  osc.connect(g);
  g.connect(sfxOut(ctx));
  osc.start(t);
  osc.stop(t + dur + 0.01);
}

// Two or three pitches from ONE output line, by interleaving very short pulses
// between them. The ear fuses them into a chord with the characteristic beeper
// grit - a real 1-bit machine's only way to play more than one note.
function bitChord(freqs, { dur = 0.3, gain = 0.11, delay = 0, slice = 0.006 } = {}) {
  const n = freqs.length;
  for (let s = 0, i = 0; s < dur; s += slice, i++) {
    bitTone({ freq: freqs[i % n], dur: slice * 0.85, duty: 0.5, gain, delay: delay + s });
  }
}

// ── SLOT primitives ─────────────────────────────────────────────────────────

// Instant attack, linear decay - the APU envelope generator, near enough.
function chipTone({ freq = 440, dur = 0.12, duty = 0.5, gain = 0.12, delay = 0,
                    to = null, type = null, bits = 8, sustain = 0 }) {
  const lvl = gain * sfxVolume();
  if (lvl <= 0) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  if (type) osc.type = type; else osc.setPeriodicWave(pulseWave(duty));
  osc.frequency.setValueAtTime(freq, t);
  if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(lvl, t);
  if (sustain > 0) g.gain.setValueAtTime(lvl, t + Math.min(sustain, dur));
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g);
  _packOut(g, 1, bits);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// `mode:'short'` is the metallic 93-step register - reel clicks, coin edges.
// `mode:'long'` is the hiss - whirr, cascades.
function chipNoise({ dur = 0.06, gain = 0.1, rate = 1, to = null, mode = 'short', delay = 0, bits = 8 }) {
  const lvl = gain * sfxVolume();
  if (lvl <= 0) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = lfsrNoiseBuffer(mode);
  src.loop = true;
  src.playbackRate.setValueAtTime(rate, t);
  if (to && to !== rate) src.playbackRate.linearRampToValueAtTime(Math.max(0.05, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(lvl, t);
  g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(g);
  _packOut(g, 1, bits);
  src.start(t, fxRandom() * 0.5);   // random offset so repeats do not phase-lock
  src.stop(t + dur + 0.02);
}

// One reel landing: a metallic click over a short pitch-drop thunk.
function reelStop({ delay = 0, pitch = 1, gain = 1 } = {}) {
  chipNoise({ dur: 0.05, gain: 0.11 * gain, rate: 1.5 * pitch, to: 0.5 * pitch, mode: 'short', delay });
  chipTone({ freq: 220 * pitch, to: 90 * pitch, dur: 0.09, duty: 0.5, gain: 0.10 * gain, delay });
}

// A handful of coins hitting a metal tray: irregular metallic ticks.
function coinCascade({ count = 10, spread = 0.45, delay = 0, gain = 1 } = {}) {
  for (let i = 0; i < count; i++) {
    const d = delay + (i / count) * spread + fxRandom() * 0.02;
    chipNoise({ dur: 0.035, gain: (0.075 + fxRandom() * 0.04) * gain, rate: 1.6 + fxRandom() * 1.4, mode: 'short', delay: d });
    if (i % 2 === 0) chipTone({ freq: 1300 + fxRandom() * 900, dur: 0.05, duty: 0.25, gain: 0.05 * gain, delay: d });
  }
}

// ══════════════════════════════════════════════
// THE PACKS
// ══════════════════════════════════════════════
// Keyed by SFX_CATALOG id. Arguments match the original function's, because the
// wrapper in js/audio-assets.js passes the live call straight through.
// An id a pack omits falls back to the classic coded sound.

const SFX_PACKS = {

  // ── ONE-BIT ───────────────────────────────────────────────────────────────
  onebit: {
    card_select:  () => bitTone({ freq: 1600, dur: 0.022, duty: 0.125, gain: 0.13 }),
    card_pop: (suit) => {
      // Suits are four duty cycles rather than four pitches: on one output line
      // the timbre IS the identifier, and it stays recognisable at any pitch.
      const duty = suit === '♥' ? 0.5 : suit === '♦' ? 0.25 : suit === '♣' ? 0.375 : 0.125;
      const base = suit === '♥' ? 700 : suit === '♦' ? 830 : suit === '♣' ? 590 : 490;
      bitTone({ freq: base, dur: 0.05, duty, gain: 0.11 });
    },
    flip_shuffle: () => {
      for (let i = 0; i < 5; i++) bitNoise({ dur: 0.028, lo: 900 + i * 400, hi: 4200 + i * 700, gain: 0.085, delay: i * 0.045, grain: 0.003 });
    },
    no_swaps: () => {
      bitTone({ freq: 300, dur: 0.07, duty: 0.125, gain: 0.12 });
      bitTone({ freq: 190, dur: 0.11, duty: 0.125, gain: 0.12, delay: 0.09 });
    },

    // Two pulses per particle (r191) - a thin tick, then the body. On one output
    // line the gap is the only way to give a repeated event any shape at all.
    particle_pip:  () => { const i = _particleStep++; const f = 420 + i * 55;
      bitTone({ freq: f * 2.7, dur: 0.014, duty: 0.125, gain: 0.055 });
      bitTone({ freq: f,       dur: 0.045, duty: 0.25,  gain: 0.10, delay: PARTICLE_GAP }); },
    particle_mult: () => { const i = _particleStep++; const f = 620 + i * 70;
      bitTone({ freq: f * 3.1, dur: 0.014, duty: 0.125, gain: 0.055 });
      bitTone({ freq: f,       dur: 0.045, duty: 0.125, gain: 0.10, delay: PARTICLE_GAP }); },
    score_tick:    () => bitTone({ freq: 2600, dur: 0.008, duty: 0.125, gain: 0.05 }),
    focus_beat:    () => bitTone({ freq: 350, to: 1500, dur: 0.16, duty: 0.25, gain: 0.11, steps: 10 }),
    hand_scored: (s) => {
      const root = 350 + Math.min(Math.max(s || 0, 10), 2000) / 2000 * 380;
      [1, 1.26, 1.5].forEach((r, i) => bitTone({ freq: root * r, dur: 0.07, duty: 0.5, gain: 0.11, delay: i * 0.06 }));
    },
    bonus_hand:  () => { bitTone({ freq: 900, dur: 0.03, duty: 0.25, gain: 0.09 }); bitTone({ freq: 1350, dur: 0.045, duty: 0.25, gain: 0.09, delay: 0.035 }); },
    win_explode: () => {
      bitNoise({ dur: 0.42, lo: 120, hi: 5200, gain: 0.13, grain: 0.006 });
      bitTone({ freq: 900, to: 70, dur: 0.42, duty: 0.5, gain: 0.09, steps: 16 });
    },
    multi_goal: (n) => {
      for (let i = 0; i < (n || 1); i++) bitTone({ freq: 700 + i * 190, dur: 0.1, duty: 0.25, gain: 0.12, delay: i * 0.26 });
    },
    focus_pop:  () => bitTone({ freq: 1200, dur: 0.012, duty: 0.125, gain: 0.05 }),
    focus_drop: () => bitTone({ freq: 620, to: 180, dur: 0.13, duty: 0.5, gain: 0.06, steps: 7 }),

    round_start: () => [440, 587, 740, 880].forEach((f, i) => bitTone({ freq: f, dur: 0.05, duty: 0.25, gain: 0.11, delay: i * 0.05 })),
    countdown:   () => [0, 1, 2].forEach(i => bitTone({ freq: 260, dur: 0.11, duty: 0.125, gain: 0.12, delay: i })),
    success:     () => bitChord([523, 659, 784], { dur: 0.34, gain: 0.10 }),
    victory:     () => {
      [523, 659, 784, 1047].forEach((f, i) => bitTone({ freq: f, dur: 0.11, duty: 0.5, gain: 0.13, delay: i * 0.1 }));
      bitChord([523, 784, 1047], { dur: 0.5, gain: 0.11, delay: 0.42 });
    },
    level_up: () => [262, 294, 330, 392, 440, 523, 659].forEach((f, i) => bitTone({ freq: f, dur: 0.06, duty: 0.25, gain: 0.12, delay: i * 0.065 })),
    heartbeat: (g = 1) => { bitTone({ freq: 62, dur: 0.09, duty: 0.5, gain: 0.17 * g }); bitTone({ freq: 48, dur: 0.07, duty: 0.5, gain: 0.13 * g, delay: 0.18 }); },

    coin:      () => { bitTone({ freq: 988, dur: 0.035, duty: 0.25, gain: 0.12 }); bitTone({ freq: 1319, dur: 0.13, duty: 0.25, gain: 0.12, delay: 0.035 }); },
    shop_open: () => [1047, 880, 740, 587].forEach((f, i) => bitTone({ freq: f, dur: 0.07, duty: 0.125, gain: 0.09, delay: i * 0.075 })),

    reward_select: () => bitTone({ freq: 520, to: 1400, dur: 0.05, duty: 0.125, gain: 0.12, steps: 4 }),
    reward_good:   () => [784, 1047, 1319].forEach((f, i) => bitTone({ freq: f, dur: 0.06, duty: 0.25, gain: 0.12, delay: i * 0.055 })),
    reward_bad:    () => { bitTone({ freq: 190, dur: 0.13, duty: 0.5, gain: 0.13 }); bitTone({ freq: 138, dur: 0.16, duty: 0.375, gain: 0.11, delay: 0.05 }); },
    reward_reveal: () => [523, 659, 784, 1047].forEach((f, i) => bitTone({ freq: f, dur: 0.035, duty: 0.125, gain: 0.09, delay: i * 0.05 })),

    chal_appear: () => [440, 370, 415, 554].forEach((f, i) => bitTone({ freq: f, dur: 0.08, duty: 0.375, gain: 0.11, delay: i * 0.09 })),
    chal_win:    () => [523, 659, 784, 1047, 1319].forEach((f, i) => bitTone({ freq: f, dur: 0.07, duty: 0.25, gain: 0.12, delay: i * 0.06 })),
    chal_fail:   () => { [415, 330, 262, 196].forEach((f, i) => bitTone({ freq: f, dur: 0.11, duty: 0.5, gain: 0.12, delay: i * 0.12 })); bitTone({ freq: 90, dur: 0.3, duty: 0.5, gain: 0.13, delay: 0.5 }); },

    m3_match: (step) => bitTone({ freq: 392 * Math.pow(2, Math.min((step || 1) - 1, 8) * 2 / 12), dur: 0.05, duty: 0.25, gain: 0.09 }),
    m3_pop:   (step) => bitTone({ freq: 523 * Math.pow(2, Math.min((step || 1) - 1, 8) * 2 / 12), dur: 0.08, duty: 0.5, gain: 0.11 }),
    m3_combo: (step) => {
      const r = 659 * Math.pow(2, Math.min((step || 1) - 1, 8) * 2 / 12);
      [0, 4, 7].forEach((s, i) => bitTone({ freq: r * Math.pow(2, s / 12), dur: 0.06, duty: 0.25, gain: 0.10, delay: i * 0.05 }));
    },
  },

  // ── 8-BIT SLOT MACHINE ────────────────────────────────────────────────────
  slot: {
    // The commit click: a mechanical button with a little spring in it.
    card_select: () => {
      chipNoise({ dur: 0.03, gain: 0.11, rate: 2.4, to: 1.2, mode: 'short' });
      chipTone({ freq: 780, to: 520, dur: 0.05, duty: 0.25, gain: 0.09 });
    },
    // Each scored card is one position on the counter wheel.
    card_pop: (suit) => {
      const i = (typeof COLORS !== 'undefined' && COLORS.indexOf) ? COLORS.indexOf(suit) : -1;
      const base = i >= 0 ? 520 + i * 45
                 : suit === '♥' ? 620 : suit === '♦' ? 700 : suit === '♣' ? 560 : 490;
      chipTone({ freq: base, dur: 0.07, duty: 0.25, gain: 0.09 });
      chipNoise({ dur: 0.022, gain: 0.05, rate: 2.2, mode: 'short' });
    },
    // The reels: ticks accelerating into a whirr, then the hand leaves the board.
    flip_shuffle: () => {
      for (let i = 0; i < 7; i++) chipNoise({ dur: 0.025, gain: 0.075, rate: 2.6 - i * 0.15, mode: 'short', delay: i * (0.052 - i * 0.004) });
      chipNoise({ dur: 0.2, gain: 0.035, rate: 1.1, to: 0.6, mode: 'long', delay: 0.02 });
    },
    // Credit rejected: the dry two-note the machine gives you for nothing.
    no_swaps: () => {
      chipTone({ freq: 233, dur: 0.09, duty: 0.5, gain: 0.11 });
      chipTone({ freq: 175, dur: 0.14, duty: 0.5, gain: 0.11, delay: 0.1 });
      chipNoise({ dur: 0.04, gain: 0.05, rate: 0.7, mode: 'long', delay: 0.1 });
    },

    // The credit meter counting up - the sound a slot spends most of its time making.
    // The credit meter: a mechanical click, then the coin lands (r191). The two
    // are what a counter wheel actually sounds like - the detent and the digit.
    particle_pip:  () => { const i = _particleStep++;
      chipNoise({ dur: 0.016, gain: 0.045, rate: 2.4, mode: 'short' });
      chipTone({ freq: 660 + i * 60, dur: 0.06, duty: 0.5,   gain: 0.085, delay: PARTICLE_GAP }); },
    particle_mult: () => { const i = _particleStep++;
      chipNoise({ dur: 0.016, gain: 0.045, rate: 3.0, mode: 'short' });
      chipTone({ freq: 880 + i * 80, dur: 0.06, duty: 0.125, gain: 0.085, delay: PARTICLE_GAP }); },
    score_tick:    () => chipNoise({ dur: 0.012, gain: 0.045, rate: 3.2, mode: 'short' }),
    focus_beat:    () => { chipTone({ freq: 330, to: 1320, dur: 0.16, duty: 0.25, gain: 0.10 }); chipTone({ freq: 660, to: 2640, dur: 0.16, duty: 0.125, gain: 0.05, delay: 0.02 }); },
    hand_scored: (s) => {
      const root = 392 + Math.min(Math.max(s || 0, 10), 2000) / 2000 * 330;
      [1, 1.25, 1.5, 2].forEach((r, i) => chipTone({ freq: root * r, dur: 0.16, duty: i % 2 ? 0.25 : 0.5, gain: 0.10 - i * 0.012, delay: i * 0.055, sustain: 0.04 }));
    },
    bonus_hand:  () => { chipTone({ freq: 1047, dur: 0.05, duty: 0.125, gain: 0.075 }); chipTone({ freq: 1568, dur: 0.09, duty: 0.125, gain: 0.06, delay: 0.045 }); },
    // Jackpot: siren, then the tray fills.
    win_explode: () => {
      chipNoise({ dur: 0.3, gain: 0.11, rate: 2.6, to: 0.35, mode: 'long' });
      chipTone({ freq: 180, to: 1400, dur: 0.22, duty: 0.5, gain: 0.11 });
      chipTone({ freq: 1400, to: 200, dur: 0.26, duty: 0.5, gain: 0.10, delay: 0.22 });
      coinCascade({ count: 16, spread: 0.7, delay: 0.16 });
    },
    multi_goal: (n) => {
      for (let i = 0; i < (n || 1); i++) {
        const d = i * 0.28;
        [0, 4, 7].forEach((s, j) => chipTone({ freq: 659 * Math.pow(2, (s + i * 2) / 12), dur: 0.2, duty: 0.25, gain: 0.10 - j * 0.02, delay: d + j * 0.035, sustain: 0.05 }));
        coinCascade({ count: 5, spread: 0.16, delay: d + 0.06, gain: 0.8 });
      }
    },
    focus_pop:  () => chipNoise({ dur: 0.018, gain: 0.04, rate: 3.4, mode: 'short' }),
    focus_drop: () => chipTone({ freq: 520, to: 130, dur: 0.16, duty: 0.5, gain: 0.06 }),

    round_start: () => { [392, 523, 659, 784].forEach((f, i) => chipTone({ freq: f, dur: 0.11, duty: 0.25, gain: 0.10, delay: i * 0.06, sustain: 0.03 })); chipNoise({ dur: 0.12, gain: 0.04, rate: 1.6, to: 0.8, mode: 'long' }); },
    // Three reels dropping into place, one per second.
    countdown:   () => [0, 1, 2].forEach(i => reelStop({ delay: i, pitch: 1 + i * 0.18 })),
    success:     () => { [523, 659, 784].forEach((f, i) => chipTone({ freq: f, dur: 0.26, duty: 0.25, gain: 0.11, delay: i * 0.05, sustain: 0.06 })); coinCascade({ count: 6, spread: 0.22, delay: 0.1 }); },
    victory:     () => {
      [523, 659, 784, 1047, 1319].forEach((f, i) => chipTone({ freq: f, dur: 0.3, duty: i % 2 ? 0.125 : 0.25, gain: 0.12, delay: i * 0.1, sustain: 0.07 }));
      chipTone({ freq: 131, dur: 0.9, gain: 0.09, type: 'triangle', delay: 0.1, sustain: 0.6 });
      coinCascade({ count: 22, spread: 1.0, delay: 0.4 });
    },
    level_up: () => {
      [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => chipTone({ freq: f, dur: 0.16, duty: 0.25, gain: 0.10, delay: i * 0.07, sustain: 0.04 }));
      chipTone({ freq: 131, to: 262, dur: 0.5, gain: 0.09, type: 'triangle' });
      coinCascade({ count: 10, spread: 0.4, delay: 0.3 });
    },
    heartbeat: (g = 1) => { chipTone({ freq: 70, to: 42, dur: 0.16, gain: 0.19 * g, type: 'triangle', bits: 0 }); chipTone({ freq: 58, to: 36, dur: 0.13, gain: 0.13 * g, type: 'triangle', bits: 0, delay: 0.18 }); },

    // One coin into the tray.
    coin:      () => { chipTone({ freq: 988, dur: 0.05, duty: 0.125, gain: 0.11 }); chipTone({ freq: 1319, dur: 0.16, duty: 0.125, gain: 0.11, delay: 0.05, sustain: 0.03 }); chipNoise({ dur: 0.03, gain: 0.05, rate: 2.8, mode: 'short', delay: 0.05 }); },
    shop_open: () => { [1047, 1319, 1568].forEach((f, i) => chipTone({ freq: f, dur: 0.3, duty: 0.125, gain: 0.075 - i * 0.014, delay: i * 0.09, sustain: 0.08 })); chipNoise({ dur: 0.25, gain: 0.03, rate: 0.9, to: 0.5, mode: 'long' }); },

    reward_select: () => { chipNoise({ dur: 0.028, gain: 0.1, rate: 2.8, to: 1.4, mode: 'short' }); chipTone({ freq: 660, to: 1320, dur: 0.06, duty: 0.25, gain: 0.09 }); },
    reward_good:   () => { [784, 1047, 1319].forEach((f, i) => chipTone({ freq: f, dur: 0.2, duty: 0.25, gain: 0.11, delay: i * 0.05, sustain: 0.05 })); coinCascade({ count: 4, spread: 0.16, delay: 0.08 }); },
    // The near miss: one reel short, dry and slightly deflating.
    reward_bad:    () => { chipTone({ freq: 196, to: 110, dur: 0.22, duty: 0.5, gain: 0.12 }); chipTone({ freq: 185, to: 104, dur: 0.22, duty: 0.5, gain: 0.09, delay: 0.01 }); chipNoise({ dur: 0.06, gain: 0.05, rate: 0.6, mode: 'long' }); },
    reward_reveal: () => reelStop({}),

    chal_appear: () => { [440, 370, 415, 554].forEach((f, i) => chipTone({ freq: f, dur: 0.18, duty: 0.125, gain: 0.10, delay: i * 0.09, sustain: 0.04 })); chipNoise({ dur: 0.1, gain: 0.035, rate: 1.2, mode: 'long', delay: 0.04 }); },
    chal_win:    () => { [523, 659, 784, 1047, 1319].forEach((f, i) => chipTone({ freq: f, dur: 0.22, duty: 0.25, gain: 0.11, delay: i * 0.06, sustain: 0.05 })); coinCascade({ count: 12, spread: 0.5, delay: 0.2 }); },
    chal_fail:   () => { [415, 330, 262, 196].forEach((f, i) => chipTone({ freq: f, dur: 0.2, duty: 0.5, gain: 0.11, delay: i * 0.13 })); chipTone({ freq: 82, to: 44, dur: 0.5, gain: 0.13, type: 'triangle', delay: 0.55 }); },

    // A cascade is reels landing in sequence, so the pitch climbs with the step.
    m3_match: (step) => reelStop({ pitch: 1 + Math.min((step || 1) - 1, 8) * 0.12, gain: 0.7 }),
    m3_pop:   (step) => { const p = Math.pow(2, Math.min((step || 1) - 1, 8) * 2 / 12); chipTone({ freq: 523 * p, dur: 0.14, duty: 0.25, gain: 0.11, sustain: 0.03 }); chipNoise({ dur: 0.03, gain: 0.05, rate: 2.4 * p, mode: 'short' }); },
    m3_combo: (step) => {
      const p = Math.pow(2, Math.min((step || 1) - 1, 8) * 2 / 12);
      [0, 4, 7].forEach((s, i) => chipTone({ freq: 659 * p * Math.pow(2, s / 12), dur: 0.18, duty: 0.25, gain: 0.09 - i * 0.015, delay: i * 0.05, sustain: 0.04 }));
      coinCascade({ count: 3, spread: 0.12, delay: 0.06, gain: 0.7 });
    },
  },
};

// The packs a player can choose, in the order Settings lists them.
const SFX_PACK_LIST = [
  ['classic', 'Classic',  'The original synthesised set.'],
  ['onebit',  '1-bit',    'One square wave, hard on and off. A beeper.'],
  ['slot',    'Arcade',   '8-bit slot machine: reels, coin counters, jackpots.'],
];
