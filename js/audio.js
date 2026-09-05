function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone({ freq = 440, type = 'sine', gain = 0.18, attack = 0.005,
                    decay = 0.08, sustain = 0.4, release = 0.25, duration = 0.35,
                    detune = 0, delay = 0 } = {}) {
  gain *= sfxVolume();          // Settings → master volume / mute (js/settings.js)
  if (gain <= 0) return;
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const now = ctx.currentTime + delay;

  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;

  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(gain, now + attack);
  env.gain.linearRampToValueAtTime(gain * sustain, now + attack + decay);
  env.gain.linearRampToValueAtTime(0, now + duration + release);

  osc.connect(env);
  env.connect(sfxOut(ctx));
  osc.start(now);
  osc.stop(now + duration + release + 0.05);
}

function playNoise({ gain = 0.05, attack = 0.002, release = 0.06, delay = 0 } = {}) {
  gain *= sfxVolume();
  if (gain <= 0) return;
  const ctx = getAudioCtx();
  const bufSize = ctx.sampleRate * (release + 0.1);
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = fxRandom() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const env = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  filter.Q.value = 0.8;
  const now = ctx.currentTime + delay;
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(gain, now + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
  src.connect(filter);
  filter.connect(env);
  env.connect(sfxOut(ctx));
  src.start(now);
  src.stop(now + release + 0.15);
}

// ── Individual sound designs ──

function sfxCardSelect() {
  // Soft wooden tap - quick noise burst + low thud (+20% louder)
  playNoise({ gain: 0.084, attack: 0.001, release: 0.05 });
  playTone({ freq: 180, type: 'triangle', gain: 0.108, attack: 0.002,
             decay: 0.04, sustain: 0.1, release: 0.08, duration: 0.06 });
}

function sfxNoSwaps() {
  // Descending "nuh-uh" - two short low tones
  playTone({ freq: 220, type: 'square', gain: 0.10, attack: 0.002, decay: 0.04, sustain: 0.1, release: 0.08, duration: 0.1 });
  playTone({ freq: 160, type: 'square', gain: 0.10, attack: 0.002, decay: 0.04, sustain: 0.1, release: 0.08, duration: 0.1, delay: 0.12 });
}

function popSwapIndicator() {
  const el = document.getElementById('swap-indicator');
  if (!el) return;
  el.classList.remove('swap-pop');
  void el.offsetWidth;
  el.classList.add('swap-pop');
}

function sfxFlipShuffle() {
  // Rapid card flip/shuffle - quick staggered noise bursts at varying pitches
  const ctx = getAudioCtx();
  const flipCount = 5;
  for (let i = 0; i < flipCount; i++) {
    const d = i * 0.055;
    playNoise({ gain: 0.09 - i * 0.01, attack: 0.001, release: 0.04, delay: d });
    playTone({ freq: 220 + i * 60, type: 'triangle', gain: 0.07 - i * 0.008,
               attack: 0.001, decay: 0.03, sustain: 0.05, release: 0.04, duration: 0.05, delay: d });
  }
}

function sfxHandScored(finalScore) {
  // Ascending chime - pitch and brightness scale with score
  const base = Math.min(Math.max(finalScore, 10), 2000);
  const rootFreq = 261.6 + (base / 2000) * 400; // C4 to ~E5
  const chord = [1, 1.26, 1.5, 2]; // minor-ish triad + octave
  chord.forEach((ratio, i) => {
    playTone({
      freq: rootFreq * ratio,
      type: 'triangle',
      gain: 0.13 - i * 0.02,
      attack: 0.005,
      decay: 0.12,
      sustain: 0.3,
      release: 0.4,
      duration: 0.5,
      delay: i * 0.07,
    });
  });
  // Soft shimmer on top
  playTone({ freq: rootFreq * 4, type: 'sine', gain: 0.05, attack: 0.01,
             decay: 0.1, sustain: 0.1, release: 0.5, duration: 0.6, delay: 0.15 });
}

function sfxSuccess() {
  // Brief celebratory chime - major triad arpeggio with bell shimmer
  // Distinct from sfxVictory (which is longer/grander)
  const root = 523.3; // C5
  [[1, 0],     // C
   [1.26, 0.06], // E (major third)
   [1.5, 0.12]   // G (perfect fifth)
  ].forEach(([ratio, delay]) => {
    playTone({
      freq: root * ratio,
      type: 'triangle',
      gain: 0.16,
      attack: 0.005,
      decay: 0.1,
      sustain: 0.4,
      release: 0.5,
      duration: 0.4,
      delay,
    });
  });
  // Bell shimmer on top
  playTone({ freq: root * 4, type: 'sine', gain: 0.05, attack: 0.01,
             decay: 0.1, sustain: 0.15, release: 0.6, duration: 0.5, delay: 0.18 });
}

function sfxVictory() {
  // Triumphant rising chord
  const ctx = getAudioCtx();
  [[261.6, 0], [329.6, 0.06], [392.0, 0.12], [523.3, 0.2], [659.3, 0.3]].forEach(([freq, delay]) => {
    playTone({ freq, type: 'triangle', gain: 0.18, attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.6, duration: 1.0, delay });
    playTone({ freq: freq * 2, type: 'sine', gain: 0.06, attack: 0.02, decay: 0.15, sustain: 0.3, release: 0.5, duration: 0.8, delay: delay + 0.03 });
  });
}

function sfxHeartbeat(gain = 1.0) {
  // Two-thump heartbeat: lub-dub. It used to connect straight to the destination
  // to stay loud while the other effects ducked - which also meant it ignored
  // sfxVolume() entirely, so mute never silenced it (the same bug sfxWinExplode
  // had). It now rides the `alert` bus, whose duckTo is 1: nothing ducks it, and
  // the volume sliders reach it like everything else.
  const vol = sfxVolume();
  if (vol <= 0) return;
  const ctx = getAudioCtx();
  [[0, 0.18], [0.18, 0.12]].forEach(([delay, g]) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(sfxOut(ctx));
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, ctx.currentTime + delay);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + delay + 0.12);
    gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
    gainNode.gain.linearRampToValueAtTime(g * gain * vol, ctx.currentTime + delay + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.22);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.25);
  });
}

function sfxCoin() {
  playTone({ freq: 1318.5, type: 'sine', gain: 0.18, attack: 0.005, decay: 0.08, sustain: 0.1, release: 0.3, duration: 0.4 });
  playTone({ freq: 1760, type: 'sine', gain: 0.08, attack: 0.01, decay: 0.05, sustain: 0.05, release: 0.2, duration: 0.3, delay: 0.04 });
}

// Reward-resolve sounds (r110): good = punchy rising chime, bad = low dissonant
// buzz, reveal = quick rising shimmer for a Mystery morphing into its outcome.
function sfxRewardGood() {
  playTone({ freq: 783.99,  type: 'triangle', gain: 0.16, attack: 0.004, decay: 0.05, sustain: 0.30, release: 0.24, duration: 0.10, delay: 0.00 });
  playTone({ freq: 1046.50, type: 'triangle', gain: 0.16, attack: 0.004, decay: 0.05, sustain: 0.30, release: 0.24, duration: 0.10, delay: 0.05 });
  playTone({ freq: 1318.51, type: 'triangle', gain: 0.15, attack: 0.004, decay: 0.05, sustain: 0.30, release: 0.28, duration: 0.12, delay: 0.10 });
}
function sfxRewardBad() {
  playTone({ freq: 190, type: 'sawtooth', gain: 0.15, attack: 0.004, decay: 0.06, sustain: 0.55, release: 0.16, duration: 0.17 });
  playTone({ freq: 138, type: 'square',   gain: 0.09, attack: 0.004, decay: 0.06, sustain: 0.55, release: 0.14, duration: 0.17 });
}
function sfxRewardReveal() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    playTone({ freq: f, type: 'sine', gain: 0.10, attack: 0.01, decay: 0.04, sustain: 0.30, release: 0.14, duration: 0.08, delay: i * 0.06 }));
}

// Picking a tile on the reward grid (r186). There was no sound on selection at
// all before - only on the resolve. Short and dry: it fires once per tile and a
// path is up to five taps.
function sfxRewardSelect() {
  playTone({ freq: 660, type: 'triangle', gain: 0.10, attack: 0.002, decay: 0.03, sustain: 0.2, release: 0.09, duration: 0.06 });
  playTone({ freq: 990, type: 'sine',     gain: 0.05, attack: 0.003, decay: 0.03, sustain: 0.15, release: 0.08, duration: 0.05, delay: 0.02 });
}

function sfxCountdown321() {
  // Three deep ticks
  [0, 1, 2].forEach(i => {
    playTone({ freq: 220, type: 'square', gain: 0.12, attack: 0.005, decay: 0.05, sustain: 0.1, release: 0.15, duration: 0.2, delay: i * 1.0 });
  });
}

function sfxRoundStart() {
  // Bright upward swoosh - round begins
  playTone({ freq: 440, type: 'sine', gain: 0.15, attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.3, duration: 0.5 });
  playTone({ freq: 880, type: 'sine', gain: 0.08, attack: 0.02, decay: 0.1, sustain: 0.1, release: 0.3, duration: 0.4, delay: 0.08 });
}

function sfxLevelUp() {
  // Warm arpeggiated flourish - pentatonic run upward
  const notes = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 659.3];
  notes.forEach((freq, i) => {
    playTone({
      freq,
      type: 'triangle',
      gain: 0.14,
      attack: 0.01,
      decay: 0.15,
      sustain: 0.4,
      release: 0.5,
      duration: 0.6,
      delay: i * 0.08,
    });
    // Octave harmonic for warmth
    playTone({
      freq: freq * 2,
      type: 'sine',
      gain: 0.05,
      attack: 0.01,
      decay: 0.1,
      sustain: 0.2,
      release: 0.4,
      duration: 0.5,
      delay: i * 0.08 + 0.02,
    });
  });
}

function sfxShopOpen() {
  // Gentle shimmer - high bell tones with reverb-like tail
  const bells = [523.3, 659.3, 783.9, 1046.5];
  bells.forEach((freq, i) => {
    playTone({
      freq,
      type: 'sine',
      gain: 0.1 - i * 0.015,
      attack: 0.005,
      decay: 0.2,
      sustain: 0.15,
      release: 0.8,
      duration: 0.9,
      delay: i * 0.12,
      detune: i % 2 === 0 ? 4 : -4,
    });
  });
  // Soft noise shimmer
  playNoise({ gain: 0.03, attack: 0.01, release: 0.3, delay: 0.05 });
}

function sfxChallengeAppear() {
  [440, 370, 415, 554].forEach((freq, i) => {
    playTone({ freq, type: 'triangle', gain: 0.12, attack: 0.01,
               decay: 0.1, sustain: 0.2, release: 0.3, duration: 0.35, delay: i * 0.1 });
  });
  playNoise({ gain: 0.04, attack: 0.01, release: 0.2, delay: 0.05 });
}

function sfxChallengeWin() {
  const notes = [523.3, 659.3, 783.9, 1046.5, 1318.5];
  notes.forEach((freq, i) => {
    playTone({ freq, type: 'triangle', gain: 0.13, attack: 0.005,
               decay: 0.1, sustain: 0.3, release: 0.4, duration: 0.5, delay: i * 0.07 });
    playTone({ freq: freq * 1.5, type: 'sine', gain: 0.05, attack: 0.005,
               decay: 0.08, sustain: 0.15, release: 0.3, duration: 0.4, delay: i * 0.07 + 0.02 });
  });
}

function sfxChallengeFail() {
  [415, 370, 330, 277, 247].forEach((freq, i) => {
    playTone({ freq, type: 'square', gain: 0.10, attack: 0.005,
               decay: 0.15, sustain: 0.25, release: 0.2, duration: 0.35, delay: i * 0.13 });
  });
  playTone({ freq: 80, type: 'sine', gain: 0.18, attack: 0.005,
             decay: 0.3, sustain: 0.1, release: 0.4, duration: 0.5, delay: 0.65 });
}

// Quick tick for score climbing. Very short, low-volume so rapid ticks don't get annoying.
function sfxScoreTick() {
  playTone({
    freq: 1400,
    type: 'square',
    gain: 0.025,
    attack: 0.001,
    decay: 0.008,
    sustain: 0.02,
    release: 0.02,
    duration: 0.04,
  });
}

// Per-card pop chirp. Short triangle blip with a sine overtone, suit-tinted.
function sfxCardPop(suit) {
  // Spectrum colours: spread the seven across the same register as the suits.
  if (typeof COLOR_HEX !== 'undefined' && COLOR_HEX[suit]) {
    const i = COLORS.indexOf(suit);
    playTone({ freq: 200 + i * 24, type:'triangle', gain:0.06, attack:0.001, decay:0.02, sustain:0.08, release:0.07, duration:0.11 });
    return;
  }
  const baseFreq = suit === '♥' ? 280
                : suit === '♦' ? 320
                : suit === '♣' ? 240
                : 200; // ♠
  playTone({
    freq: baseFreq,
    type: 'triangle',
    gain: 0.06,
    attack: 0.001,
    decay: 0.02,
    sustain: 0.08,
    release: 0.07,
    duration: 0.11,
  });
  playTone({
    freq: baseFreq * 2.5,
    type: 'sine',
    gain: 0.025,
    attack: 0.002,
    decay: 0.025,
    sustain: 0.05,
    release: 0.05,
    duration: 0.09,
  });
}

// Quiet pop when a focus node detaches (quieter than sfxCardPop).
function sfxFocusNodePop() {
  playTone({
    freq: 360,
    type: 'triangle',
    gain: 0.022,
    attack: 0.001,
    decay: 0.015,
    sustain: 0.04,
    release: 0.04,
    duration: 0.06,
  });
}

// Quieter downward whoosh while the focus node falls.
function sfxFocusNodeDrop() {
  playTone({
    freq: 160,
    type: 'sawtooth',
    gain: 0.015,
    attack: 0.005,
    decay: 0.03,
    sustain: 0.08,
    release: 0.12,
    duration: 0.18,
  });
  playTone({
    freq: 90,
    type: 'sine',
    gain: 0.012,
    attack: 0.005,
    decay: 0.04,
    sustain: 0.1,
    release: 0.12,
    duration: 0.2,
  });
}

// Per-particle escalating tone. Step starts at 0, climbs with each call.
// Two types: 'pip' = lower base, 'mult' = higher base.
let _particleStep = 0;
function resetParticleStep() { _particleStep = 0; }
// TWO sounds, not one (r191). Each particle is a short attack tick and then a
// pitched body a beat behind it - "t-ding", not "ding". Two transients that close
// together read as one event with a shape, which is what makes a long run of them
// sound like a counter ratcheting rather than like a row of identical bleeps; the
// old version layered its overtone SIMULTANEOUSLY, which just made one thicker
// bleep. PARTICLE_GAP is the whole effect: below ~25ms the two fuse into a click,
// above ~90ms they separate into two events.
const PARTICLE_GAP = 0.045;

function sfxParticleStep(type = 'pip') {
  const i = _particleStep++;
  const baseFreq = type === 'mult' ? 520 : 380;
  const step = type === 'mult' ? 70 : 55;
  const freq = baseFreq + i * step;

  // 1. The tick: bright, tiny, no pitch to speak of. The "t".
  playTone({
    freq: freq * (type === 'mult' ? 3.1 : 2.7),
    type: 'square',
    gain: 0.030,
    attack: 0.001,
    decay: 0.012,
    sustain: 0.05,
    release: 0.02,
    duration: 0.028,
  });

  // 2. The body: the note that actually carries the climb. The "ding".
  playTone({
    freq,
    type: 'triangle',
    gain: 0.08,
    attack: 0.002,
    decay: 0.04,
    sustain: 0.1,
    release: 0.06,
    duration: 0.12,
    delay: PARTICLE_GAP,
  });
  playTone({
    freq: freq * 2,
    type: 'sine',
    gain: 0.030,
    attack: 0.002,
    decay: 0.03,
    sustain: 0.08,
    release: 0.05,
    duration: 0.1,
    delay: PARTICLE_GAP,
  });
}

function sfxMultiGoal(count) {
  for (let i = 0; i < count; i++) {
    const delay = i * 0.28;
    const freq = 660 + i * 180; // rises with each ding
    playTone({ freq, type: 'square', gain: 0.13, attack: 0.003,
               decay: 0.06, sustain: 0.12, release: 0.1, duration: 0.22, delay });
    playTone({ freq: freq * 2, type: 'sine', gain: 0.07, attack: 0.003,
               decay: 0.05, sustain: 0.08, release: 0.08, duration: 0.18, delay: delay + 0.01 });
    // Coin shimmer noise between dings
    playNoise({ gain: 0.025, attack: 0.002, release: 0.06, delay: delay + 0.04 });
  }
}

// Focus beat - a swelling tone that resolves into a bright pop, signalling the focus
// multiplier is applying to the mult.
function sfxFocusBeat() {
  // Low swell
  playTone({
    freq: 320,
    type: 'sine',
    gain: 0.08,
    attack: 0.02,
    decay: 0.06,
    sustain: 0.4,
    release: 0.08,
    duration: 0.18,
  });
  // Mid harmonic
  playTone({
    freq: 640,
    type: 'sine',
    gain: 0.06,
    attack: 0.012,
    decay: 0.05,
    sustain: 0.35,
    release: 0.1,
    duration: 0.2,
    delay: 0.02,
  });
  // Bright pop on top
  playTone({
    freq: 1100,
    type: 'triangle',
    gain: 0.07,
    attack: 0.003,
    decay: 0.04,
    sustain: 0.2,
    release: 0.12,
    duration: 0.18,
    delay: 0.05,
  });
  // Sparkle
  playTone({
    freq: 2200,
    type: 'sine',
    gain: 0.035,
    attack: 0.004,
    decay: 0.05,
    sustain: 0.15,
    release: 0.1,
    duration: 0.16,
    delay: 0.08,
  });
}

// ══════════════════════════════════════════════
// CLOCK SOUNDS (r183) - see js/clock-fx.js
// ══════════════════════════════════════════════

// A single quiet clock tick, on the heartbeat wave every 10s. Deliberately at
// the very bottom of the mix: it plays six times a minute for a whole run, so
// anything you can actually notice becomes maddening. Escapement click (a tiny
// high noise pip) plus a short wooden body under it.
function sfxClockTick() {
  playNoise({ gain: 0.012, attack: 0.001, release: 0.018 });
  playTone({ freq: 1750, type: 'square', gain: 0.010, attack: 0.001,
             decay: 0.014, sustain: 0.05, release: 0.03, duration: 0.02 });
  playTone({ freq: 430,  type: 'triangle', gain: 0.016, attack: 0.001,
             decay: 0.02,  sustain: 0.06, release: 0.05, duration: 0.03 });
}

// TICK ... TOCK - the clock has been PAUSED. Two clicks, the second lower and a
// beat later, which is the whole reason a stopped clock sounds like a stopped
// clock. Louder than the idle tick because it marks a real state change.
function sfxTickTock() {
  const hit = (freq, delay, gain) => {
    playNoise({ gain: gain * 0.55, attack: 0.001, release: 0.03, delay });
    playTone({ freq, type: 'square', gain: gain * 0.5, attack: 0.001,
               decay: 0.018, sustain: 0.06, release: 0.04, duration: 0.026, delay });
    playTone({ freq: freq * 0.26, type: 'triangle', gain, attack: 0.001,
               decay: 0.03, sustain: 0.1, release: 0.09, duration: 0.05, delay });
  };
  hit(1900, 0,    0.075);   // tick
  hit(1380, 0.22, 0.065);   // tock
  // A held ring underneath, so the pause has a floor rather than two dry clicks.
  playTone({ freq: 262, type: 'sine', gain: 0.030, attack: 0.03,
             decay: 0.2, sustain: 0.5, release: 0.55, duration: 0.5 });
}

// REWIND - a tape played backwards. A normal sound is a hit that decays; this is
// the mirror image of that, so the envelope SWELLS from nothing and then stops
// dead, and the pitch sweeps UP instead of down. playTone's envelope only decays,
// so this one is built on raw nodes.
function sfxRewind() {
  const vol = (typeof sfxVolume === 'function') ? sfxVolume() : 1;
  if (vol <= 0) return;
  const ctx  = getAudioCtx();
  const now  = ctx.currentTime;
  const dur  = 0.62;
  const dest = sfxOut(ctx);

  // Two detuned saws sweeping upward - the "wind back" itself.
  [[196, 0], [196, 9]].forEach(([f, det]) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const lp  = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, now);
    lp.frequency.exponentialRampToValueAtTime(3200, now + dur);
    osc.type = 'sawtooth';
    osc.detune.value = det;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 3.4, now + dur);
    // Reversed envelope: silence → full, then cut off in 25ms.
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.075 * vol, now + dur);
    env.gain.linearRampToValueAtTime(0, now + dur + 0.025);
    osc.connect(lp); lp.connect(env); env.connect(dest);
    osc.start(now); osc.stop(now + dur + 0.08);
  });

  // Tape hiss swelling with it, through a filter that opens as it goes.
  const bufSize = Math.floor(ctx.sampleRate * (dur + 0.1));
  const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data    = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (fxRandom() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(600, now);
  bp.frequency.exponentialRampToValueAtTime(4200, now + dur);
  const nEnv = ctx.createGain();
  nEnv.gain.setValueAtTime(0.0001, now);
  nEnv.gain.exponentialRampToValueAtTime(0.05 * vol, now + dur);
  nEnv.gain.linearRampToValueAtTime(0, now + dur + 0.025);
  src.connect(bp); bp.connect(nEnv); nEnv.connect(dest);
  src.start(now); src.stop(now + dur + 0.1);
}

// ── Hook sounds into game events ──
// Sounds are called directly at their trigger sites above.

// ══════════════════════════════════════════════
// DEV MODE
// ══════════════════════════════════════════════
let devMode = localStorage.getItem('devMode') === 'true';
let devFallSpeed = 1;
let devAnimSpeed = 5; // t/s for score animation
let devPanelOpen = false;

// Card counter HUD visibility - default hidden, toggleable via dev panel. Persisted.
let showDeckHud = (localStorage.getItem('showDeckHud') === 'true');

