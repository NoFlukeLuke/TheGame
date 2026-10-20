// ══════════════════════════════════════════════
// AUDIO DSP (r234) - the toolkit every sound pack is built from
// ══════════════════════════════════════════════
// The packs before this one each invented their own voices, so a bell in one pack
// and a bell in another shared no code and no level. This file is the instrument
// layer: a pack picks voices from here, gives them its own pitches, lengths and
// proportions, and nothing else.
//
// ── THE ONE RULE: A HEAVY SOUND IS THREE LAYERS, NOT ONE LOUD ONE ───────────
// Game and film sound design builds an impact out of separate parts that each do
// one job, and that is why every pack below reads as a stack of two or three
// calls rather than as a single voice:
//
//   TRANSIENT  dClick / dWood     the first 20ms. What the thing IS.
//   BODY       dThump / dBell     the middle. What it WEIGHS.
//   TAIL       the room send      where it happened.
//
// The corollary matters as much: punch comes from TRANSIENT CONTROL AND CONTRAST,
// not from level. If a hit is not landing, sharpen its transient or shorten what
// is around it before turning it up. That is what `verb` and the mixer's room are
// for, and it is why the biggest sounds here START with a beat of near-silence.
//
// ── EVERY VOICE OBEYS THE SAME TWO CONTRACTS ────────────────────────────────
//   1. It multiplies its gain by sfxVolume() exactly once, at call time, so the
//      Settings sliders and mute reach it.
//   2. It ends at dRoute(), which connects it to sfxOut() (the mixer's bus for
//      whichever sound is currently being built) and, if it asked for one, to the
//      room send. Nothing here ever connects to ctx.destination.
//
// LOAD ORDER: after js/audio.js (getAudioCtx, fxRandom) and js/audio-mixer.js
// (sfxOut, sfxVerbIn), before js/audio-packs.js.

function _dctx() { return getAudioCtx(); }
function _dvol() { return (typeof sfxVolume === 'function') ? sfxVolume() : 1; }

// Cosmetic randomness, so a seeded run's gameplay draws are never perturbed by a
// sound. Same rule as js/score-dance.js and js/float-anim.js.
function dRand(a, b) {
  const r = (typeof fxRandom === 'function') ? fxRandom() : Math.random();
  return a + (b - a) * r;
}

// ── Pitch ───────────────────────────────────────────────────────────────────
// Everything musical in the packs is written in SEMITONES from a root, never in
// Hz, because that is the only way four packs can share a phrase and each play it
// in its own register.
function dHz(semi, root = 261.6256) { return root * Math.pow(2, semi / 12); }

const D_SCALES = {
  majPent: [0, 2, 4, 7, 9],       // the casino scale: no semitone clashes, all of it sounds like a win
  maj:     [0, 2, 4, 5, 7, 9, 11],
  lydian:  [0, 2, 4, 6, 7, 9, 11],// major with a lift. Fanfares.
  minPent: [0, 3, 5, 7, 10],
  min:     [0, 2, 3, 5, 7, 8, 10],
  whole:   [0, 2, 4, 6, 8, 10],   // no home note. Suspense, never resolution.
};
// The same thing in SEMITONES rather than Hz, for the packs whose voices take a
// semitone offset (most of them do, so they can transpose a phrase in one place).
function dDegree(name, i) {
  const s = D_SCALES[name] || D_SCALES.majPent;
  const n = s.length;
  return s[((i % n) + n) % n] + 12 * Math.floor(i / n);
}
// Degree `i` may run past the end of the scale; it octaves up instead of clamping,
// so a 12-step run is one call in a loop.
function dScale(name, i, root) {
  const s = D_SCALES[name] || D_SCALES.majPent;
  const n = s.length;
  const oct = Math.floor(i / n), step = ((i % n) + n) % n;
  return dHz(s[step] + 12 * oct, root);
}

// ── Routing ─────────────────────────────────────────────────────────────────
// `verb` is this voice's own send into the room, 0 to about 0.6. It is per voice
// and not per bus on purpose: a coin and a score tick sit on the same bus and want
// completely different tails.
function dRoute(node, verb) {
  const ctx = _dctx();
  node.connect(sfxOut(ctx));
  verb = dVerbCap(verb);
  if (verb > 0 && typeof sfxVerbIn === 'function') {
    try {
      const s = ctx.createGain();
      s.gain.value = verb;
      node.connect(s);
      s.connect(sfxVerbIn(ctx));
    } catch (e) { /* no room available: the dry path already played */ }
  }
}

// Sounds that can fire many times a SECOND. A 1.6s tail on a score particle is
// not a big sound, it is twenty overlapping tails and a wash - measured at r234,
// High Roller's particles were carrying 1.6s and its board sounds up to 2.4s.
//
// The cap is DIVIDED BY THE ROOM'S LENGTH, which is the part that makes it a rule
// rather than a number: choosing a bigger room for a pack must not silently make
// its repeating sounds longer. The one-shots (a goal blast, a victory, a level up)
// are absent from this table on purpose - they are exactly what the room is for.
const D_FREQUENT = {
  particle_pip: 0.11, particle_mult: 0.13, score_tick: 0.06, clock_tick: 0.06,
  card_select: 0.09,  card_pop: 0.11,     focus_pop: 0.10,  focus_drop: 0.10,
  coin: 0.20,         reward_select: 0.09, m3_match: 0.13,  m3_pop: 0.11,
  card_discard: 0.13, flip_shuffle: 0.13,
};
function dVerbCap(v) {
  if (!(v > 0)) return 0;
  const id = (typeof _mixCurrentId !== 'undefined') ? _mixCurrentId : null;
  const cap = id && D_FREQUENT[id];
  if (cap == null) return v;
  const secs = (typeof sfxRoomProfile === 'function') ? (sfxRoomProfile().seconds || 1) : 1;
  return Math.min(v, cap / Math.max(1, secs));
}

// ── Envelopes ───────────────────────────────────────────────────────────────
// Percussive: up fast, then an exponential fall. Exponential because a linear fade
// on a short sound reads as a fade and an exponential one reads as a decay.
// `hold` at the peak is the difference between a THUMP (none) and a RING (a little).
// Returns the audio-clock time the voice is finished, which is what every caller
// uses to stop its oscillator.
function dShape(param, t, peak, { attack = 0.002, hold = 0, decay = 0.2 } = {}) {
  const p = Math.max(peak, 0.00002);
  const floor = Math.max(p * 0.0007, 0.000015);
  const a = Math.max(0.0006, attack), d = Math.max(0.008, decay);
  param.setValueAtTime(0.000012, t);
  param.exponentialRampToValueAtTime(p, t + a);
  if (hold > 0) param.setValueAtTime(p, t + a + hold);
  param.exponentialRampToValueAtTime(floor, t + a + hold + d);
  param.setValueAtTime(0, t + a + hold + d + 0.004);
  return t + a + hold + d + 0.02;
}

// Reverse: swells from nothing and then stops. Risers, rewinds, anything that
// means "something is about to happen".
function dShapeUp(param, t, peak, dur, tail = 0.035) {
  const p = Math.max(peak, 0.00002);
  param.setValueAtTime(0.000012, t);
  param.exponentialRampToValueAtTime(p, t + Math.max(0.01, dur));
  param.exponentialRampToValueAtTime(p * 0.0008, t + dur + tail);
  param.setValueAtTime(0, t + dur + tail + 0.004);
  return t + dur + tail + 0.02;
}

// ── Saturation ──────────────────────────────────────────────────────────────
// tanh, normalised so it never changes the peak level - only the density. This is
// what lets a sub-bass thump be FELT without being louder: harmonics it generates
// are audible on a laptop speaker that cannot reproduce the fundamental at all.
const _dSatCurves = {};
function dSatCurve(k) {
  const key = k.toFixed(2);
  if (!_dSatCurves[key]) {
    const n = 1024, c = new Float32Array(n), norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(x * k) / norm;
    }
    _dSatCurves[key] = c;
  }
  return _dSatCurves[key];
}
function dSat(k) { const ws = _dctx().createWaveShaper(); ws.curve = dSatCurve(k); return ws; }

// ── Noise ───────────────────────────────────────────────────────────────────
// Three kinds, cached per context. They are not interchangeable:
//   white  flat. Air, riffles, sweeps.
//   pink   -3dB/octave. Sounds like a real object rather than like a hiss, which
//          is what makes it right under a wooden or felt transient.
//   metal  the NES short-mode LFSR, 93 steps, so it RINGS at a pitch instead of
//          hissing. Reel detents, coin edges, tray clatter. Nothing else in the
//          toolkit makes a machine sound like a machine the way this does.
const _dNoiseBufs = {};
function dNoiseBuf(kind) {
  const ctx = _dctx();
  const key = kind + '@' + ctx.sampleRate;
  if (_dNoiseBufs[key]) return _dNoiseBufs[key];
  const len = Math.floor(ctx.sampleRate * 1.3);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0;               // Paul Kellet's three-pole approximation
    for (let i = 0; i < len; i++) {
      const w = dRand(-1, 1);
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.26;
    }
  } else if (kind === 'metal') {
    let reg = 1, acc = 0, lvl = 1;
    const inc = 14000 / ctx.sampleRate;
    for (let i = 0; i < len; i++) {
      acc += inc;
      while (acc >= 1) {
        acc -= 1;
        const fb = (reg & 1) ^ ((reg >> 6) & 1);   // bit0 XOR bit6 = the short register
        reg = (reg >> 1) | (fb << 14);
        lvl = (reg & 1) ? -1 : 1;
      }
      d[i] = lvl;
    }
  } else {
    for (let i = 0; i < len; i++) d[i] = dRand(-1, 1);
  }
  _dNoiseBufs[key] = buf;
  return buf;
}

// Pulse wave at an arbitrary duty. The nth harmonic of a duty-d pulse has
// amplitude (2/(n*pi)) * sin(n*pi*d). Cached per duty AND per context, because a
// PeriodicWave belongs to the context that made it.
const _dPulseWaves = {};
function dPulse(duty) {
  const ctx = _dctx();
  const key = duty.toFixed(3);
  const hit = _dPulseWaves[key];
  if (hit && hit.ctx === ctx) return hit.wave;
  const N = 28;
  const real = new Float32Array(N + 1), imag = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  _dPulseWaves[key] = { wave, ctx };
  return wave;
}

// ══ THE VOICES ══════════════════════════════════════════════════════════════

// dTone - one oscillator with a percussive envelope, an optional glide and an
// optional filter. The workhorse; everything that is just "a note" is this.
function dTone({ freq = 440, to = null, type = 'sine', wave = null, dur = 0.25,
                 attack = 0.003, hold = 0, gain = 0.18, delay = 0, detune = 0,
                 sat = 0, verb = 0, glide = 'exp', lp = 0, hp = 0, q = 0.7,
                 glideTime = null } = {}) {
  const lvl = gain * _dvol();
  if (lvl <= 0) return 0;
  const ctx = _dctx(), t = ctx.currentTime + Math.max(0, delay);
  const osc = ctx.createOscillator();
  if (wave) osc.setPeriodicWave(wave); else osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(Math.max(0.02, freq), t);
  if (to && to !== freq) {
    const gt = t + (glideTime == null ? dur : glideTime);
    if (glide === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(0.02, to), gt);
    else osc.frequency.exponentialRampToValueAtTime(Math.max(0.02, to), gt);
  }
  const env = ctx.createGain();
  const done = dShape(env.gain, t, lvl, { attack, hold, decay: dur });
  let head = osc;
  if (lp || hp) {
    const f = ctx.createBiquadFilter();
    f.type = hp ? 'highpass' : 'lowpass';
    f.frequency.value = hp || lp;
    f.Q.value = q;
    head.connect(f); head = f;
  }
  if (sat > 0) { const s = dSat(1 + sat * 5); head.connect(s); head = s; }
  head.connect(env);
  dRoute(env, verb);
  osc.start(t); osc.stop(done + 0.04);
  return done;
}

// dSub - pure low weight. Almost inaudible alone on a laptop, which is the point:
// it is felt under the body rather than heard beside it.
function dSub({ freq = 62, to = null, dur = 0.4, gain = 0.3, delay = 0, verb = 0, sat = 0.35 } = {}) {
  return dTone({ freq, to: to || freq * 0.72, type: 'sine', dur, gain, delay,
                 attack: 0.005, sat, verb, glideTime: dur * 0.6 });
}

// dThump - the BODY of every impact. A sine whose pitch collapses much faster than
// its level: `drop` is the fraction of the decay the pitch fall takes, and keeping
// it near 0.2 is the whole difference between a hit and a descending tone.
function dThump({ freq = 170, to = 46, dur = 0.3, gain = 0.34, delay = 0, sat = 0.5,
                  verb = 0, drop = 0.2, type = 'sine' } = {}) {
  const lvl = gain * _dvol();
  if (lvl <= 0) return 0;
  const ctx = _dctx(), t = ctx.currentTime + Math.max(0, delay);
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(18, to), t + Math.max(0.01, dur * drop));
  const env = ctx.createGain();
  const done = dShape(env.gain, t, lvl, { attack: 0.0015, decay: dur });
  let head = osc;
  if (sat > 0) { const s = dSat(1 + sat * 5); head.connect(s); head = s; }
  head.connect(env);
  dRoute(env, verb);
  osc.start(t); osc.stop(done + 0.04);
  return done;
}

// dNoise - a filtered noise voice. The start offset into the buffer is random, so
// two plays of one sound are never the same grain and a run of them does not read
// as a loop.
function dNoise({ kind = 'white', dur = 0.12, gain = 0.1, delay = 0, type = 'bandpass',
                  freq = 1200, to = null, q = 0.9, attack = 0.002, hold = 0,
                  verb = 0, rate = 1, rateTo = null, sat = 0, up = false } = {}) {
  const lvl = gain * _dvol();
  if (lvl <= 0) return 0;
  const ctx = _dctx(), t = ctx.currentTime + Math.max(0, delay);
  const src = ctx.createBufferSource();
  src.buffer = dNoiseBuf(kind);
  // Looped, because a voice pitched up consumes the buffer faster than real time
  // and a metal click at rate 2.4 starting late would otherwise run off the end
  // and go silent. A loop seam inside noise is inaudible.
  src.loop = true;
  src.playbackRate.setValueAtTime(rate, t);
  if (rateTo && rateTo !== rate) src.playbackRate.exponentialRampToValueAtTime(Math.max(0.02, rateTo), t + dur);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(Math.max(20, freq), t);
  f.Q.value = q;
  if (to && to !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + Math.max(0.01, dur));
  const env = ctx.createGain();
  const done = up ? dShapeUp(env.gain, t, lvl, dur)
                  : dShape(env.gain, t, lvl, { attack, hold, decay: dur });
  let head = f;
  if (sat > 0) { const s = dSat(1 + sat * 4); head.connect(s); head = s; }
  src.connect(f);
  head.connect(env);
  dRoute(env, verb);
  src.start(t, dRand(0, src.buffer.duration * 0.5));
  src.stop(done + 0.04);
  return done;
}

// dClick - the TRANSIENT layer. Under about 30ms the ear stops hearing pitch and
// starts hearing an event, which is exactly what this is for.
function dClick(o = {}) {
  return dNoise(Object.assign({ dur: 0.02, freq: 2800, q: 1.1, gain: 0.12, attack: 0.0007 }, o));
}

// dBell - two-operator FM. The modulator's ratio decides whether this is metal or
// wood, and the modulation index collapsing far faster than the note is the STRIKE.
function dBell({ freq = 660, ratio = 3.51, index = 7, dur = 1.0, gain = 0.16,
                 delay = 0, verb = 0.3, attack = 0.002, bite = 0.28 } = {}) {
  const lvl = gain * _dvol();
  if (lvl <= 0) return 0;
  const ctx = _dctx(), t = ctx.currentTime + Math.max(0, delay);
  const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq;
  const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * ratio;
  const mg = ctx.createGain();
  const mi = Math.max(1, freq * index);
  mg.gain.setValueAtTime(mi, t);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, mi * 0.02), t + Math.max(0.01, dur * bite));
  mod.connect(mg); mg.connect(car.frequency);
  const env = ctx.createGain();
  const done = dShape(env.gain, t, lvl, { attack, decay: dur });
  car.connect(env);
  dRoute(env, verb);
  mod.start(t); car.start(t);
  mod.stop(done + 0.04); car.stop(done + 0.04);
  return done;
}

// dMetal - additive inharmonic partials. A struck bar, a coin, a tube. The partial
// SETS are what make each one a different object; they are ratios, not harmonics,
// which is the whole reason it does not sound like an organ.
const D_PARTIALS = {
  coin:  [1, 2.41, 3.83, 5.17, 7.02],
  tube:  [1, 2.76, 5.40, 8.93],
  bar:   [1, 3.93, 9.38],
  plate: [1, 1.51, 2.13, 2.87, 3.71],
  ring:  [1, 2.00, 3.01, 4.97],        // nearly harmonic: a hand bell rather than a slab
};
function dMetal({ freq = 1200, set = 'coin', dur = 0.5, gain = 0.1, delay = 0,
                  verb = 0.3, spread = 1, tilt = 0.7, fall = 0.62 } = {}) {
  const ps = Array.isArray(set) ? set : (D_PARTIALS[set] || D_PARTIALS.coin);
  ps.forEach((p, i) => dTone({
    freq: freq * (1 + (p - 1) * spread),
    type: 'sine',
    dur: dur * Math.pow(tilt, i),
    gain: gain * Math.pow(fall, i),
    delay, attack: 0.0012, verb: verb * Math.pow(0.85, i),
  }));
  return dur;
}

// dPluck - a saw through a filter that shuts fast. Cut points are MULTIPLES of the
// note, not Hz, so one call sounds like the same instrument at any pitch.
function dPluck({ freq = 220, dur = 0.4, gain = 0.16, delay = 0, type = 'sawtooth',
                  cutFrom = 7, cutTo = 1.5, q = 5, verb = 0, sat = 0.3, detune = 0,
                  attack = 0.002 } = {}) {
  const lvl = gain * _dvol();
  if (lvl <= 0) return 0;
  const ctx = _dctx(), t = ctx.currentTime + Math.max(0, delay);
  const osc = ctx.createOscillator(); osc.type = type;
  osc.frequency.value = freq; osc.detune.value = detune;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = q;
  f.frequency.setValueAtTime(Math.min(18000, freq * cutFrom), t);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * cutTo), t + Math.max(0.02, dur * 0.55));
  const env = ctx.createGain();
  const done = dShape(env.gain, t, lvl, { attack, decay: dur });
  let head = f;
  if (sat > 0) { const s = dSat(1 + sat * 5); head.connect(s); head = s; }
  osc.connect(f); head.connect(env);
  dRoute(env, verb);
  osc.start(t); osc.stop(done + 0.04);
  return done;
}

// dStab - a detuned stack through a closing filter, with a sine underneath it.
// Brass, supersaw, anything that has to sound like more than one thing at once.
// `voices` past about 7 costs CPU for nothing; the beating is already dense.
function dStab({ freq = 220, dur = 0.5, gain = 0.14, delay = 0, voices = 5, detune = 14,
                 type = 'sawtooth', cutFrom = 9, cutTo = 2.2, q = 3, attack = 0.012,
                 sat = 0.4, verb = 0.25, sub = 0.5, hold = 0 } = {}) {
  const lvl = gain * _dvol();
  if (lvl <= 0) return 0;
  const ctx = _dctx(), t = ctx.currentTime + Math.max(0, delay);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = q;
  f.frequency.setValueAtTime(Math.min(18000, freq * cutFrom), t);
  f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * cutTo), t + Math.max(0.03, dur * 0.6));
  const env = ctx.createGain();
  const done = dShape(env.gain, t, lvl / Math.sqrt(voices), { attack, hold, decay: dur });
  const oscs = [];
  for (let i = 0; i < voices; i++) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = (i - (voices - 1) / 2) * detune;
    o.connect(f); o.start(t); o.stop(done + 0.04);
    oscs.push(o);
  }
  let head = f;
  if (sat > 0) { const s = dSat(1 + sat * 5); head.connect(s); head = s; }
  head.connect(env);
  dRoute(env, verb);
  if (sub > 0) dTone({ freq: freq / 2, type: 'sine', dur: dur * 0.9, gain: gain * sub * 0.55,
                       delay, attack: attack * 0.6, sat: 0.4, verb: 0 });
  return done;
}

// dSweep - a riser or a faller. `up` swells and stops (something is coming);
// otherwise it hits and falls away (something landed).
function dSweep({ kind = 'noise', from = 300, to = 4000, dur = 0.6, gain = 0.1, delay = 0,
                  q = 2.4, type = 'sawtooth', verb = 0.2, up = true, noise = 'white' } = {}) {
  if (kind === 'noise') {
    return dNoise({ kind: noise, dur, gain, delay, type: 'bandpass', freq: from, to, q, verb, up });
  }
  const lvl = gain * _dvol();
  if (lvl <= 0) return 0;
  const ctx = _dctx(), t = ctx.currentTime + Math.max(0, delay);
  const osc = ctx.createOscillator(); osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, from), t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const env = ctx.createGain();
  const done = up ? dShapeUp(env.gain, t, lvl, dur)
                  : dShape(env.gain, t, lvl, { attack: 0.004, decay: dur });
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1;
  f.frequency.setValueAtTime(Math.max(200, from * 5), t);
  f.frequency.exponentialRampToValueAtTime(Math.max(200, to * 5), t + dur);
  osc.connect(f); f.connect(env);
  dRoute(env, verb);
  osc.start(t); osc.stop(done + 0.04);
  return done;
}

// ── Named objects ───────────────────────────────────────────────────────────
// Three layers each, pre-balanced. A pack calls these when it wants the object
// rather than the ingredients.

// A wooden knock. High-Q bandpassed pink noise IS the wood; the sine gives it a
// pitch so several of them read as the same block struck in different places.
// `soft` (0 to 1) takes the CRACK off without taking the wood away, and 0 is
// byte-identical to the original. The NOISE BURST is what reads as a knock - the
// pitched body underneath it is just a low tone - so softening moves four things
// on the burst alone: less level, a lower and broader band, and a slower attack.
// A transient that arrives over 4ms instead of 0.6ms stops being a rap on a
// surface and becomes something settling onto one.
function dWood({ freq = 320, dur = 0.16, gain = 0.16, delay = 0, verb = 0.1, bright = 1, soft = 0 } = {}) {
  dNoise({ kind: 'pink', dur: dur * (0.5 + soft * 0.25), gain: gain * (0.7 - soft * 0.45), delay,
           type: 'bandpass', freq: freq * (3.4 - soft * 1.7) * bright, q: 3.5 - soft * 2.1,
           attack: 0.0006 + soft * 0.0042, verb: verb * 0.5 });
  dTone({ freq, type: 'triangle', dur, gain: gain * 0.8, delay, attack: 0.0012 + soft * 0.003, verb, sat: 0.3 });
  return dur;
}

// A coin. The edge (metal noise) and the ring (inharmonic partials) are different
// events a few ms apart, which is what stops a run of them sounding like one tone
// repeated.
function dCoin({ freq = 2100, dur = 0.42, gain = 0.1, delay = 0, verb = 0.3, bright = 1 } = {}) {
  dNoise({ kind: 'metal', dur: 0.028, gain: gain * 0.55, delay, type: 'bandpass',
           freq: 3200 * bright, q: 1.6, rate: 2.2, attack: 0.0006, verb: verb * 0.4 });
  dMetal({ freq, set: 'coin', dur, gain: gain * 0.85, delay: delay + 0.004, verb, tilt: 0.55 });
  return dur;
}

// A mechanical relay: the solenoid click, the armature hitting the stop, and the
// cabinet resonating. Nothing in a casino sounds committed without one.
function dRelay({ gain = 0.22, delay = 0, pitch = 1, verb = 0.14, weight = 1 } = {}) {
  dClick({ dur: 0.013, freq: 3400 * pitch, q: 0.9, gain: gain * 0.5, delay, kind: 'metal', rate: 2.4, verb: verb * 0.4 });
  dWood({ freq: 190 * pitch, dur: 0.085, gain: gain * 0.75, delay: delay + 0.004, verb });
  dThump({ freq: 120 * pitch, to: 48, dur: 0.16 * weight, gain: gain * 0.7, delay: delay + 0.005, sat: 0.6, verb: verb * 0.6 });
  return 0.2;
}

// An FM electric piano. Ratio 1 with a fast index collapse is the tine; the `bar`
// partial on top is the hammer hitting it.
function dRhodes({ freq = 440, dur = 0.9, gain = 0.14, delay = 0, verb = 0.25, bright = 1 } = {}) {
  dBell({ freq, ratio: 1, index: 2.6 * bright, dur, gain, delay, verb, bite: 0.09 });
  dTone({ freq: freq * 3.93, type: 'sine', dur: dur * 0.12, gain: gain * 0.22 * bright,
          delay, attack: 0.001, verb: verb * 0.5 });
  return dur;
}

// A struck bar: marimba if the body is short, vibraphone if it rings.
function dMallet({ freq = 520, dur = 0.5, gain = 0.15, delay = 0, verb = 0.2, wood = 1 } = {}) {
  dNoise({ kind: 'pink', dur: 0.016, gain: gain * 0.4 * wood, delay, type: 'bandpass',
           freq: freq * 5, q: 2.2, attack: 0.0006 });
  dTone({ freq, type: 'sine', dur, gain, delay, attack: 0.0015, verb });
  dTone({ freq: freq * 3.93, type: 'sine', dur: dur * 0.3, gain: gain * 0.3, delay, attack: 0.0015, verb: verb * 0.6 });
  return dur;
}

// ── Patterns ────────────────────────────────────────────────────────────────

// Scatter n voices over a span. `accel` bends the spacing: below 1 they bunch at
// the start (a coin hopper emptying), above 1 they bunch at the end (a reel
// slowing into its stop).
function dCascade(n, fn, { spread = 0.5, jitter = 0.35, delay = 0, accel = 1 } = {}) {
  const last = Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const at = delay + spread * Math.pow(i / last, accel);
    // Clamped at 0: the jitter is symmetric, so without this the first event of
    // every cascade can be scheduled before now and setValueAtTime throws.
    fn(i, Math.max(0, at + dRand(-jitter, jitter) * (spread / (n + 1))));
  }
}

// A run of notes up (or down) a scale. The pitch argument is a degree, so a pack
// changes the whole feel of a fanfare by changing one scale name.
function dRun(n, fn, { scale = 'majPent', root = 261.6256, from = 0, step = 0.07,
                       delay = 0, dir = 1 } = {}) {
  for (let i = 0; i < n; i++) fn(dScale(scale, from + i * dir, root), delay + i * step, i);
}

// A beat of near-silence in front of a big hit. Contrast makes an impact feel
// heavier than more low end does, and this is the only way to buy it inside a
// sound rather than around it.
const D_ANTICIPATION = 0.09;
