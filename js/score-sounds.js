// ══════════════════════════════════════════════
// SCORING SOUNDS (r781, owner) - a sound when a card or a Trick TRIGGERS
// ══════════════════════════════════════════════
// Owner: "sounds for when cards and tricks trigger instead of when chips or mult
// land... an extra 8 pairs of sounds to pick from." A chip landing is a soft tick
// now (sfxScoreTick); the sound belongs to the trigger, played as its chip appears
// (js/score-dance.js `fireEvent`).
//
// A PAIR is a card sound and a Trick sound in one key: the card is the short dry
// hit (what happened), the Trick the brighter answer (what it set off). Both climb
// a scale through the hand (ssStep, reset per hand), so a long hand rises.
// Settings -> Audio -> Scoring sounds; 'pack' is the sound pack's old pip and mult
// sounds, on the card and the Trick.
//
// Variants, the same in every pair (ssPlay):
//   prime k   the Trick's sound a step up per prime with a bright tick in front
//   forced    the Trick's sound with a low thump under it and a short rise
//   dull      a wild card: a fifth down and quieter
//   voice     a Trick may add its own tail (SCORE_VOICES; face-card Tricks get a
//             three-note royal figure). `scoreVoiceFor(id)` is the one lookup.
//
// CUT-OFF (ssVoice): every trigger sound is built into its own gain node. When the
// next one starts, the one before drops to a third and fades over 0.2s while its
// oscillators fall five semitones: it drives away instead of piling up. Reverb
// tails are left alone. The DSP toolkit connects everything at sfxOut(), so a
// voice swaps that for its own node while it is being built.
//
// score-sounds-preview is not needed: Settings plays a pair when it is chosen.

const SS_ROOT = 261.63;            // C4
const SS_SCALE = 'majPent';
let _ssStep = 0, _ssLast = null;
function ssReset() { _ssStep = 0; }
const ssSemi = (k, up = 0) => dDegree(SS_SCALE, Math.min(Math.max(0, k), 12)) + up;

// One trigger sound as one voice the next can push away.
function ssVoice(build) {
  let ctx; try { ctx = getAudioCtx(); } catch (e) { return null; }
  if (!ctx) { build(); return null; }
  const realOut = window.sfxOut, out = realOut(ctx);
  const g = ctx.createGain(); g.gain.value = 1; g.connect(out);
  const v = { g, srcs: [], ctx };
  const co = ctx.createOscillator, cb = ctx.createBufferSource;
  window.sfxOut = () => g;
  ctx.createOscillator = function () { const o = co.call(ctx); v.srcs.push(o); return o; };
  ctx.createBufferSource = function () { const o = cb.call(ctx); v.srcs.push(o); return o; };
  try { build(); } catch (e) { /* a sound must never break a hand */ }
  finally { window.sfxOut = realOut; delete ctx.createOscillator; delete ctx.createBufferSource; }
  setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 4000);
  return v;
}
const SS_CUT = { to: 0.3, fade: 0.2, cents: -500 };
function ssPushAway(v) {
  if (!v) return;
  const t = v.ctx.currentTime;
  try {
    v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t);
    v.g.gain.linearRampToValueAtTime(SS_CUT.to, t + 0.03);
    v.g.gain.linearRampToValueAtTime(0.0001, t + SS_CUT.fade);
  } catch (e) {}
  v.srcs.forEach(o => { try { if (o.detune) { o.detune.setValueAtTime(o.detune.value, t); o.detune.linearRampToValueAtTime(o.detune.value + SS_CUT.cents, t + SS_CUT.fade); } } catch (e) {} });
}

// ── The pairs. card(f, o) / trick(f, o): f(n) is the frequency n semitones above
// this trigger's note, o.L the level (variants lower or lift it). ─────────────
const SCORE_SETS = {
  pack: { name: 'Sound pack', desc: 'The sound pack’s own pip and mult sounds.' },
  // Lounge: a short Rhodes note answered by the vibraphone.
  keys: { name: 'Keys and vibes', desc: 'A Rhodes note, answered by the vibraphone.',
    card:  (f, o) => dRhodes({ freq: f(0), dur: 0.3, gain: 0.15 * o.L, verb: 0.18, bright: 1.1 }),
    trick: (f, o) => { dMallet({ freq: f(12), dur: 0.42, gain: 0.13 * o.L, verb: 0.24, wood: 0.5 }); dTone({ freq: f(24), type: 'sine', dur: 0.3, gain: 0.03 * o.L, attack: 0.004, verb: 0.2 }); } },
  // High Roller: a filtered pluck with a sub under it, answered by a brass stab.
  brass: { name: 'Pluck and brass', desc: 'A low pluck, answered by a brass stab.',
    card:  (f, o) => { dPluck({ freq: f(0), dur: 0.2, gain: 0.16 * o.L, cutFrom: 7, cutTo: 2.2, q: 4, sat: 0.3, verb: 0.16 }); dSub({ freq: f(-24), dur: 0.12, gain: 0.08 * o.L, sat: 0.4 }); },
    trick: (f, o) => dStab({ freq: f(0), dur: 0.26, gain: 0.12 * o.L, voices: 4, detune: 10, cutFrom: 8, cutTo: 2.4, attack: 0.006, verb: 0.22, sub: 0.3 }) },
  // The felt and a bell over it.
  felt: { name: 'Felt and chime', desc: 'A soft knock on the felt, answered by a small bell.',
    card:  (f, o) => { dWood({ freq: f(-12), dur: 0.12, gain: 0.2 * o.L, verb: 0.1, soft: 0.6 }); dThump({ freq: 150, to: 70, dur: 0.1, gain: 0.1 * o.L, sat: 0.3 }); },
    trick: (f, o) => dBell({ freq: f(24), ratio: 3.51, index: 3.2, dur: 0.5, gain: 0.11 * o.L, verb: 0.26, bite: 0.2 }) },
  // Mallets: marimba low, glockenspiel high.
  mallets: { name: 'Marimba and glock', desc: 'A marimba bar, answered by a glockenspiel.',
    card:  (f, o) => dMallet({ freq: f(0), dur: 0.28, gain: 0.17 * o.L, verb: 0.14, wood: 1.2 }),
    trick: (f, o) => dMetal({ freq: f(24), set: 'ring', dur: 0.38, gain: 0.09 * o.L, verb: 0.22, tilt: 0.6 }) },
  // The table: a clay chip set down, then chips stacked and a coin over them.
  chips: { name: 'Chip and stack', desc: 'A clay chip set down, answered by a stack and a coin.',
    card:  (f, o) => { dClick({ dur: 0.012, freq: 2300, q: 1.6, gain: 0.11 * o.L, kind: 'pink' }); dWood({ freq: f(12), dur: 0.07, gain: 0.13 * o.L, verb: 0.08, bright: 1.2 }); },
    trick: (f, o) => { [0, 0.028, 0.05].forEach((d, i) => dClick({ dur: 0.01, freq: 2600 + i * 300, q: 1.6, gain: 0.07 * o.L, kind: 'pink', delay: d })); dCoin({ freq: f(36), dur: 0.26, gain: 0.08 * o.L, delay: 0.06, verb: 0.16 }); } },
  // The band: an upright bass note, answered by a finger snap and a high key.
  upright: { name: 'Upright and snap', desc: 'An upright bass note, answered by a finger snap.',
    card:  (f, o) => { dPluck({ freq: f(-12), dur: 0.3, gain: 0.2 * o.L, type: 'triangle', cutFrom: 5, cutTo: 1.4, q: 2, sat: 0.2, verb: 0.1 }); dClick({ dur: 0.008, freq: 900, q: 1, gain: 0.04 * o.L }); },
    trick: (f, o) => { dNoise({ kind: 'white', dur: 0.03, gain: 0.13 * o.L, type: 'bandpass', freq: 2100, q: 2.4, attack: 0.0006, verb: 0.2 }); dRhodes({ freq: f(24), dur: 0.22, gain: 0.07 * o.L, delay: 0.012, verb: 0.2, bright: 1.3 }); } },
  // The office: a typewriter key, answered by the carriage bell.
  typewriter: { name: 'Key and carriage bell', desc: 'A typewriter key, answered by the carriage bell.',
    card:  (f, o) => { dClick({ dur: 0.011, freq: 3600, q: 1, gain: 0.1 * o.L, kind: 'metal', rate: 2.2 }); dWood({ freq: 270, dur: 0.06, gain: 0.14 * o.L, verb: 0.08 }); },
    trick: (f, o) => { dClick({ dur: 0.008, freq: 5200, q: 1, gain: 0.05 * o.L, kind: 'metal', rate: 2.6 }); dBell({ freq: f(31), ratio: 2.76, index: 2.2, dur: 0.6, gain: 0.1 * o.L, delay: 0.01, verb: 0.24, bite: 0.14 }); } },
  // Glass: a tink on a glass, answered by a bowl that swells.
  glass: { name: 'Glass and bowl', desc: 'A tink on a glass, answered by a singing bowl.',
    card:  (f, o) => { dNoise({ kind: 'metal', dur: 0.014, gain: 0.05 * o.L, type: 'bandpass', freq: 5200, q: 1.3, rate: 2.2, attack: 0.0005 }); dMetal({ freq: f(24), set: [1, 2.32, 4.25], dur: 0.2, gain: 0.1 * o.L, verb: 0.14, tilt: 0.6 }); },
    trick: (f, o) => { dTone({ freq: f(12), type: 'sine', dur: 0.5, attack: 0.03, hold: 0.06, gain: 0.11 * o.L, verb: 0.3 }); dTone({ freq: f(12) * 2.71, type: 'sine', dur: 0.3, attack: 0.02, gain: 0.035 * o.L, verb: 0.3 }); } },
  // Arcade: a square blip, answered by a two-note pickup.
  arcade: { name: 'Blip and pickup', desc: 'A square-wave blip, answered by a two-note pickup.',
    card:  (f, o) => dTone({ freq: f(12), wave: dPulse(0.25), dur: 0.07, attack: 0.001, gain: 0.07 * o.L, lp: 6000 }),
    trick: (f, o) => { const w = dPulse(0.5); dTone({ freq: f(12), wave: w, dur: 0.05, attack: 0.001, gain: 0.06 * o.L, lp: 6500 }); dTone({ freq: f(19), wave: w, dur: 0.16, attack: 0.001, hold: 0.03, gain: 0.06 * o.L, delay: 0.05, lp: 6500, verb: 0.1 }); } },
};
const SCORE_SET_DEFAULT = 'pack';
function scoreSetId() {
  const v = (typeof SETTINGS !== 'undefined' && SETTINGS.scoreSounds) || SCORE_SET_DEFAULT;
  return SCORE_SETS[v] ? v : SCORE_SET_DEFAULT;
}
function scoreSetOptions() { return Object.keys(SCORE_SETS).map(id => [id, SCORE_SETS[id].name]); }

// ── A Trick's own tail ──────────────────────────────────────────────────────
// SCORE_VOICES names a tail by Trick id; a Trick not listed gets one from its words
// (face cards: the royal figure). A new custom sound is a row here and a function below.
const SCORE_VOICES = {};
const SS_TAILS = {
  // Three quick notes up a major chord, brass-like and short.
  royal: (f, o) => [0, 4, 7].forEach((n, i) => dStab({ freq: f(12 + n), dur: 0.12, gain: 0.05 * o.L, voices: 3, detune: 8, cutFrom: 7, cutTo: 3, attack: 0.004, verb: 0.2, sub: 0, delay: 0.05 + i * 0.055 })),
};
const _ssVoiceMemo = {};
function scoreVoiceFor(id) {
  if (!id) return null;
  if (id in _ssVoiceMemo) return _ssVoiceMemo[id];
  let v = SCORE_VOICES[id] || null;
  if (!v && typeof TRICK_POOL_ALL !== 'undefined') {
    const t = TRICK_POOL_ALL.find(x => x.id === id);
    if (t && /face cards?|\bkings?\b|\bqueens?\b|\bjacks?\b|\broyal/i.test(t.desc || '')) v = 'royal';
  }
  return (_ssVoiceMemo[id] = v);
}

// The pack's own particle sound, for the 'pack' pair.
function _ssPack(kind) {
  const id = kind === 'card' ? 'particle_pip' : 'particle_mult';
  const impl = (typeof sfxPackImpl === 'function') ? sfxPackImpl(id) : null;
  if (impl) { try { impl(); return; } catch (e) {} }
  const fn = window.sfxParticleStep; const coded = (fn && fn._coded) || fn;
  if (typeof coded === 'function') coded(kind === 'card' ? 'pip' : 'mult');
}
function ssPlay(kind, o, setId) {
  o = o || {};
  const set = SCORE_SETS[setId && SCORE_SETS[setId] ? setId : scoreSetId()];
  const k = _ssStep++;
  const up = (o.prime ? 2 * Math.min(o.prime, 8) : 0) + (o.dull ? -7 : 0);
  const base = dHz(ssSemi(k, up), SS_ROOT);
  const f = n => base * Math.pow(2, n / 12);
  const lv = { L: o.dull ? 0.6 : 1 };
  ssPushAway(_ssLast);
  _ssLast = ssVoice(() => {
    if (kind === 'trick' && o.prime) dClick({ dur: 0.008, freq: 6200, q: 1, gain: 0.05, kind: 'metal', rate: 2.6 });
    if (kind === 'trick' && o.forced) {
      dThump({ freq: 170, to: 52, dur: 0.14, gain: 0.16, sat: 0.5 });
      dNoise({ kind: 'white', dur: 0.07, gain: 0.03, type: 'bandpass', freq: 700, to: 3600, q: 1.4, up: true });
    }
    if (set.card) (kind === 'card' ? set.card : set.trick)(f, lv); else _ssPack(kind);
    const tail = kind === 'trick' && !o.prime && SS_TAILS[scoreVoiceFor(o.id)];
    if (tail) tail(f, lv);
  });
}
// The catalog rows 'score_card' / 'score_trick' (js/audio-assets.js) wrap these two.
function sfxScoreCard(o) { ssPlay('card', o); }
function sfxScoreTrick(o) { ssPlay('trick', o); }
// Settings plays the pair it was just set to: card, Trick, then a prime and a forced trigger.
function scoreSetDemo(id) {
  ssReset();
  [['card', {}], ['trick', {}], ['card', {}], ['trick', {}], ['trick', { prime: 1 }], ['trick', { prime: 2 }], ['trick', { forced: true }]]
    .forEach(([kind, o], i) => setTimeout(() => { if (kind === 'card') sfxScoreCard(o); else sfxScoreTrick(o); }, i * 230 - (i > 4 ? (i - 4) * 110 : 0)));
}

// ── A Knack or a chance Trick going off (r781, owner) ───────────────────────
// A small bright two-note figure for the burst on its chip (entityPing, js/tray-fx.js).
function sfxEntityPing() {
  dClick({ dur: 0.008, freq: 5400, q: 1, gain: 0.04, kind: 'metal', rate: 2.4 });
  dBell({ freq: 1318.5, ratio: 2, index: 1.4, dur: 0.22, gain: 0.07, verb: 0.16, bite: 0.16 });
  dBell({ freq: 1975.5, ratio: 2, index: 1.2, dur: 0.3, gain: 0.05, delay: 0.06, verb: 0.2, bite: 0.14 });
}
