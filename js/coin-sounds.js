// ══════════════════════════════════════════════
// PAYOUT COINS (r721, owner) - the coin the payout plays as each line counts up
// ══════════════════════════════════════════════
// Owner: "I don't like our current one." Five coins built from the DSP toolkit
// (js/audio-dsp.js), chosen in Settings -> Audio -> Payout coin; 'pack' is the
// sound pack's own coin, the one that played before. Only the payout count-up
// plays these (js/interlude.js); every other coin stays the pack's.
//
// sfxPayoutCoin(k, n): k is this sound's place in the line (0 first), n how many
// the line plays. `level` sets each coin's loudness against the pack coin (measured
// over its first 300ms: within about 1.5 dB, the arcade coin a little under, being brighter). The new coins climb a pentatonic step a sound, so a line rises
// as it fills, and the last one of a line rings a little longer.
//
// coin-preview.html loads THIS file, the real js/audio-dsp.js and js/audio-packs.js,
// so what the preview plays is what the game plays.

const PC_ROOT = 523.25;   // C5
const pcStep = k => dDegree('majPent', Math.min(Math.max(0, k), 9));
const PC_GLASS = [1, 2.32, 4.25, 6.63];

const PAYOUT_COINS = {
  pack: {
    name: 'Pack coin', desc: 'The sound pack’s own coin. What played before.',
    play: () => { if (typeof sfxCoin === 'function') sfxCoin(); },
  },
  // A pulse-wave two-note pickup, the arcade coin. The last of a line adds a third note.
  arcade: {
    name: '8-bit pickup', desc: 'Two square-wave notes, the arcade coin.',
    level: 2.5,
    play: (k, last, L = 1) => {
      const s = pcStep(k), w = dPulse(0.25);
      dTone({ freq: dHz(11 + s, PC_ROOT), wave: w, dur: 0.05, attack: 0.001, gain: 0.06 * L, lp: 6500 });
      dTone({ freq: dHz(16 + s, PC_ROOT), wave: w, dur: 0.2, attack: 0.001, hold: 0.04, gain: 0.06 * L, delay: 0.055, lp: 6500, verb: 0.08 });
      if (last) dTone({ freq: dHz(23 + s, PC_ROOT), wave: w, dur: 0.26, attack: 0.001, hold: 0.03, gain: 0.045 * L, delay: 0.12, lp: 7000, verb: 0.12 });
    },
  },
  // The drawer's clack, then the register bell.
  register: {
    name: 'Ka-ching', desc: 'A cash register: the drawer clacks, the bell rings.',
    level: 1.55,
    play: (k, last, L = 1) => {
      const s = pcStep(k), f = dHz(24 + s, PC_ROOT);
      dClick({ dur: 0.014, freq: 2600, q: 1.4, gain: 0.09 * L, kind: 'metal', rate: 1.6 });
      dWood({ freq: 240, dur: 0.06, gain: 0.08 * L, delay: 0.004, soft: 0.25 });
      dMetal({ freq: f, set: 'ring', dur: last ? 0.85 : 0.4, gain: 0.1 * L, delay: 0.045, verb: 0.2, tilt: 0.7 });
      dMetal({ freq: f * 1.5, set: 'ring', dur: 0.26, gain: 0.04 * L, delay: 0.085, verb: 0.15 });
    },
  },
  // A coin dropped on a stack: the hit, then a small bounce. Dry, so a fast run stays clear.
  stack: {
    name: 'Coin stack', desc: 'A coin dropped on a stack: a bright tink and a small bounce.',
    level: 2.8,
    play: (k, last, L = 1) => {
      const f = 2300 * Math.pow(2, pcStep(k) / 24);
      dNoise({ kind: 'metal', dur: 0.016, gain: 0.07 * L, type: 'bandpass', freq: 4200, q: 1.3, rate: 2.2, attack: 0.0005 });
      dMetal({ freq: f, set: 'coin', dur: last ? 0.32 : 0.16, gain: 0.09 * L, delay: 0.002, verb: 0.08, tilt: 0.5 });
      dNoise({ kind: 'metal', dur: 0.012, gain: 0.03 * L, type: 'bandpass', freq: 4600, q: 1.3, rate: 2.4, delay: 0.05, attack: 0.0005 });
      dMetal({ freq: f * 1.04, set: 'coin', dur: 0.08, gain: 0.035 * L, delay: 0.052, verb: 0.05, tilt: 0.5 });
    },
  },
  // A credit landing on the console: a chirp up, an FM blip, a hair of click.
  chip: {
    name: 'Credit chip', desc: 'A credit landing on the console: a chirp and a soft digital bell.',
    level: 2.9,
    play: (k, last, L = 1) => {
      const s = pcStep(k);
      dClick({ dur: 0.008, freq: 7000, q: 1, gain: 0.025 * L, kind: 'metal', rate: 2.6 });
      dTone({ freq: dHz(19 + s, PC_ROOT), to: dHz(31 + s, PC_ROOT), type: 'sine', dur: 0.06, glideTime: 0.03, attack: 0.001, gain: 0.07 * L });
      dBell({ freq: dHz(24 + s, PC_ROOT), ratio: 2, index: 1.6, dur: last ? 0.6 : 0.28, gain: 0.08 * L, delay: 0.03, verb: 0.14, bite: 0.2 });
    },
  },
  // A coin into a glass jar: the clink, the jar's hollow body, the coin settling.
  jar: {
    name: 'Tip jar', desc: 'A coin into a glass jar: a clink, a hollow knock, a settle.',
    level: 2.3,
    play: (k, last, L = 1) => {
      const f = 1900 * Math.pow(2, pcStep(k) / 18);
      dNoise({ kind: 'metal', dur: 0.02, gain: 0.05 * L, type: 'bandpass', freq: 5000, q: 1.2, rate: 2, attack: 0.0005 });
      dMetal({ freq: f, set: PC_GLASS, dur: last ? 0.5 : 0.26, gain: 0.09 * L, verb: 0.16, tilt: 0.6 });
      dNoise({ kind: 'pink', dur: 0.09, gain: 0.05 * L, type: 'bandpass', freq: 820, q: 6, delay: 0.004, verb: 0.1 });
      dMetal({ freq: f * 1.19, set: [1, 2.32, 4.25], dur: 0.14, gain: 0.035 * L, delay: 0.075, verb: 0.1, tilt: 0.6 });
    },
  },
};
const PAYOUT_COIN_DEFAULT = 'chip';

function payoutCoinId() {
  const v = (typeof SETTINGS !== 'undefined' && SETTINGS.payoutCoin) || PAYOUT_COIN_DEFAULT;
  return PAYOUT_COINS[v] ? v : PAYOUT_COIN_DEFAULT;
}
function payoutCoinOptions() { return Object.keys(PAYOUT_COINS).map(id => [id, PAYOUT_COINS[id].name]); }
// The catalog row 'payout_coin' (js/audio-assets.js) wraps this, so the mixer's bus,
// the sound board and the per-sound mute reach it like any other sound.
function sfxPayoutCoin(k = 0, n = 1, id) {
  const c = PAYOUT_COINS[id && PAYOUT_COINS[id] ? id : payoutCoinId()];
  c.play(k, k >= n - 1, c.level || 1);
}
