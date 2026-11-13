// ── COIN (r744) ─────────────────────────────────────────────────────────────
//
// The coin flip as physics, and the sounds of a real coin.
//
// coinSimulate is a small rigid-body sim of a thin disc in the plane it turns in
// (height and depth): gravity, and a contact at whichever corner of the rim is
// lowest, with a bounce, friction and the spin the hit puts on it. A coin that
// lands on its rim tips, rocks and falls flat by itself. Once it is down and slow
// it hands over to a short settling wobble (the tilt runs round the coin faster
// and faster as it drops, like a coin rattling to rest), which the rattle
// recording plays under.
//
// THE RESULT IS DECIDED FIRST (js/event-toys.js's rule). Throws are simulated
// with different spins until one comes down on the decided face, so the flight
// is pure physics and nothing is corrected. Each try is about a millisecond.
//
// Sounds (Economy in the sound board): sfxCoinFlick, the thumb and the ring as
// it leaves (synthesised); sfxCoinHit(k), one impact, played at every real
// contact the sim records, louder for a harder one and never quite the same
// pitch; sfxCoinSettle, the rattle to rest. The hits and the rattle are cut from
// "Coin drop" by vinrax (opengameart.org, CC0): assets/sfx/coin-hit-*.wav,
// coin-settle.wav. WAV, so a hit starts on its sample with no encoder delay.
// Cosmetic randomness is fxRandom.

const COIN_CFG = {
  r: 33, h: 8,          // radius and thickness, stage px
  g: 1300,              // gravity, px/s^2
  apex: [80, 94],       // throw height range
  turns: [3.5, 5.5],    // turns in the air
  rest: 0.42,           // bounce off the table
  hop: 0.32,            // a hop is at most this share of the landing speed
  spinKeep: 0.7,        // spin kept through a hard hit
  mu: 0.35,             // friction at the rim
  hitMin: 55,           // contact speed that sounds, px/s
  wobMs: 360,           // the settle: the rattle recording's length
  maxMs: 2600,
};
const COIN_SND = { hit: ['assets/sfx/coin-hit-1.wav', 'assets/sfx/coin-hit-2.wav'], settle: 'assets/sfx/coin-settle.wav' };

function _cRnd() { return (typeof fxRandom === 'function') ? fxRandom() : Math.random(); }

// One throw from flat at angle th0 (0 heads, PI tails). Returns frames at 60 a
// second ({ y, z, x, th, yaw, wx, wy }: y the lift off the table, th the turn,
// wx / wy the settling tilt, radians), hits ({ t, k }) and the face it settles on.
function coinSimulate(th0, seed) {
  const C = COIN_CFG, r = C.r, hh = C.h / 2, m = 1, I = m * (r * r / 4 + C.h * C.h / 12);
  const rnd = seed || _cRnd;
  const H = C.apex[0] + rnd() * (C.apex[1] - C.apex[0]);
  let vy = Math.sqrt(2 * C.g * H), T = 2 * vy / C.g;
  let w = (C.turns[0] + rnd() * (C.turns[1] - C.turns[0])) * 2 * Math.PI / T;
  let y = hh, z = 0, vz = (rnd() - 0.5) * 120, th = th0;   // r763: it skids on the table
  let x = 0, vx = (rnd() - 0.5) * 70;
  const yawAmp = (rnd() - 0.5) * 0.6;
  const dt = 1 / 480, frames = [], hits = [];
  let t = 0, acc = 0, landed = false, handover = null;
  while (t < C.maxMs / 1000) {
    vy -= C.g * dt;
    y += vy * dt; z += vz * dt; th += w * dt; x += vx * dt;
    // The lowest corner of the rim.
    const c = Math.cos(th), s = Math.sin(th);
    let px = 0, py = Infinity;
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const qx = a * r * c - b * hh * s, qy = a * r * s + b * hh * c;
      if (qy < py) { py = qy; px = qx; }
    }
    let ground = false;
    if (y + py <= 0 && (vy <= 0 || landed)) {   // not while it leaves the thumb
      ground = true;
      y = -py;
      const vpy = vy + w * px;
      if (vpy < 0) {
        const e = vpy < -C.hitMin ? C.rest : 0;
        const j = -(1 + e) * vpy / (1 / m + px * px / I);
        vy += j / m; w += px * j / I;
        const vpt = vz - w * py;
        let jt = -vpt / (1 / m + py * py / I);
        jt = Math.max(-C.mu * j, Math.min(C.mu * j, jt));
        vz += jt / m; w += -py * jt / I;
        // A rim landing can turn the spin into a hop as high as the throw; a real
        // coin loses most of that into the table. Cap the hop, and damp the spin.
        if (-vpy > C.hitMin) { vy = Math.min(vy, -vpy * C.hop); w *= C.spinKeep; }
        if (-vpy > C.hitMin) {
          const last = hits[hits.length - 1];
          const k = Math.min(1, -vpy / 520);
          if (last && t - last.t < 0.03) last.k = Math.max(last.k, k); else hits.push({ t, k });
        }
        landed = true;
      }
      w *= 1 - 0.8 * dt; vz *= 1 - 3 * dt; vx *= 1 - 4 * dt;
    }
    acc += dt;
    const flat = Math.round(th / Math.PI) * Math.PI, d = th - flat;
    const yaw = landed ? 0 : yawAmp * Math.sin(Math.min(1, t / T) * Math.PI);
    if (acc >= 1 / 60 - 1e-9) { acc = 0; frames.push({ y: y - hh, z, x, th, yaw, wx: 0, wy: 0 }); }
    t += dt;
    // Down and slow: the settle takes over.
    if (landed && ground && Math.abs(vy) < 30 && Math.abs(w) < 5 && Math.abs(d) < 0.45 && t > T) {
      handover = { th: flat, d, z, x }; break;
    }
  }
  const capped = !handover;
  if (!handover) {
    const flat = Math.round(th / Math.PI) * Math.PI;
    handover = { th: flat, d: th - flat, z, x };
  }
  // The settle: the tilt runs round the coin, faster as it drops (Euler's disk).
  const a0 = Math.max(0.07, Math.min(0.32, Math.abs(handover.d)));
  const n = Math.round(C.wobMs / (1000 / 60));
  let ph = handover.d >= 0 ? 0 : Math.PI;
  const wob0 = frames.length;
  for (let i = 1; i <= n; i++) {
    const u = i / n, a = a0 * Math.pow(1 - u, 1.6) * Math.min(1, i / 4 + Math.abs(handover.d) / a0);
    ph += (9 + 46 * u * u) / 60;
    frames.push({ y: r * Math.sin(a) * 0.5, z: handover.z, x: handover.x, th: handover.th, yaw: 0,
      wx: a * Math.cos(ph), wy: a * Math.sin(ph) });
  }
  const face = (((Math.round(handover.th / Math.PI) % 2) + 2) % 2) ? 'tails' : 'heads';
  return { frames, hits, face, settleAt: wob0 / 60, capped };
}

// A throw that lands on `side`, starting flat on `from`.
function coinThrowFor(side, from) {
  const th0 = from === 'tails' ? Math.PI : 0;
  let sim = null;
  for (let i = 0; i < 60; i++) {
    sim = coinSimulate(th0);
    if (sim.face === side && !sim.capped) return sim;   // a throw that never settled is not used
  }
  // Never seen: give up on purity and turn the whole throw over (a half turn more).
  sim.frames.forEach(f => { f.th += Math.PI; });
  sim.face = side;
  return sim;
}

// ── sounds ──
function _coinBuf(path) {
  if (typeof _sfxBuffers === 'undefined' || typeof loadSfxBuffer !== 'function') return null;
  const b = _sfxBuffers[path];
  if (b && typeof b.duration === 'number') return b;
  if (!(path in _sfxBuffers)) loadSfxBuffer(path);
  return null;
}
function coinSoundsWarm() { COIN_SND.hit.concat(COIN_SND.settle).forEach(p => { try { _coinBuf(p); } catch (e) {} }); }
function _coinPlay(buf, gain, rate) {
  const ctx = getAudioCtx(), src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.playbackRate.value = rate || 1;
  g.gain.value = gain * sfxVolume() * (typeof sfxIdGain === 'function' ? sfxIdGain() : 1);
  src.connect(g); g.connect(sfxOut(ctx)); src.start();
}
let _coinHitN = 0;
function sfxCoinHit(k) {
  try {
    const kk = k == null ? 0.8 : k;
    const buf = _coinBuf(COIN_SND.hit[(_coinHitN++) % COIN_SND.hit.length]);
    if (buf) return _coinPlay(buf, 0.25 + 0.75 * kk, 0.93 + _cRnd() * 0.14);
    // Not loaded yet: a short dry knock.
    playTone({ freq: 2400 + _cRnd() * 600, type: 'triangle', gain: 0.07 * (0.3 + kk), attack: 0.001, decay: 0.03, sustain: 0, release: 0.03, duration: 0.04 });
  } catch (e) {}
}
function sfxCoinSettle() {
  try {
    const buf = _coinBuf(COIN_SND.settle);
    if (buf) return _coinPlay(buf, 1, 0.97 + _cRnd() * 0.06);
    for (let i = 0; i < 6; i++)
      playTone({ freq: 2600, type: 'triangle', gain: 0.04 * (1 - i / 7), attack: 0.001, decay: 0.02, sustain: 0, release: 0.02, duration: 0.03, delay: 0.32 * (1 - Math.pow(0.82, i + 1)) / 0.7 });
  } catch (e) {}
}
// The thumb, then the coin ringing as it leaves: a dry tick and four inharmonic
// partials (a struck disc's modes) dying away, a little high and bright.
function sfxCoinFlick() {
  try {
    const ctx = getAudioCtx(), out = sfxOut(ctx), t0 = ctx.currentTime + 0.005;
    const vol = sfxVolume() * (typeof sfxIdGain === 'function' ? sfxIdGain() : 1);
    const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 3);
    const ns = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    ns.buffer = nb; hp.type = 'highpass'; hp.frequency.value = 1800; ng.gain.value = 0.22 * vol;
    ns.connect(hp); hp.connect(ng); ng.connect(out); ns.start(t0);
    const f0 = 2350 + _cRnd() * 250;
    [[1, 0.06, 0.55], [2.32, 0.035, 0.35], [3.86, 0.022, 0.22], [5.6, 0.012, 0.14]].forEach(([k, a, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f0 * k;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(a * vol, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + d + 0.02);
    });
  } catch (e) {}
}
