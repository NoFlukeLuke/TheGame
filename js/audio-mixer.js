// ══════════════════════════════════════════════
// AUDIO MIXER (r191) - buses, priority, ducking, voice limits
// ══════════════════════════════════════════════
// Before this, every sound in the game connected straight to the output at
// whatever gain its own designer picked, so a Focus node detaching was as loud as
// a hand scoring. This is the standard game-audio answer to that, which is three
// separate mechanisms people often lump together as "priority":
//
//   1. BUSES + STATIC TRIM. Sounds are grouped by what they mean, not by what
//      makes them, and each group has one fader. This is most of the fix: a
//      background tick should simply be quieter than a headline, always, before
//      anything dynamic happens.
//   2. DUCKING. When something important starts, the groups BELOW it dip for as
//      long as it lasts and then come back. This is what makes room for a big
//      sound instead of just piling on top of the small ones.
//   3. VOICE LIMITS. A cap on how many of a group can sound at once, and a
//      minimum gap between repeats of one sound, so a fast loop cannot turn into
//      a buzzsaw.
//
// The whole point of the split is that (1) sets the balance you always want and
// (2) only handles the collisions. Trying to do it all with ducking gives you a
// mix that pumps; trying to do it all with static gains gives you a mix where the
// big moments never actually get any room.

// ── The buses ───────────────────────────────────────────────────────────────
// `pri` decides who ducks whom: a sound ducks every bus with a LOWER pri than
// its own. `trim` is the always-on fader. `duckTo` is how far this bus dips when
// something above it plays (1 = never ducks).
// `duckHold` is how long this bus's sounds hold OTHER buses down. `voiceHold` is
// how long one of its voices counts against maxVoices. They are NOT the same
// number and sharing one is a bug: a headline should keep the mix out of its way
// for most of a second, but must not therefore occupy a voice slot for that long.
const SFX_BUSES = {
  // Ambient texture. The stuff you should stop noticing after ten minutes.
  detail:   { pri: 1, trim: 0.55, duckTo: 0.30, maxVoices: 6,  duckHold: 0.08, voiceHold: 0.10 },
  // The board answering your finger. Wants to feel immediate, not loud.
  board:    { pri: 2, trim: 0.80, duckTo: 0.45, maxVoices: 8,  duckHold: 0.16, voiceHold: 0.20 },
  // The scoring dance. The main event most of the time.
  score:    { pri: 3, trim: 1.00, duckTo: 0.55, maxVoices: 10, duckHold: 0.30, voiceHold: 0.25 },
  // Economy and round structure - things that change your situation.
  event:    { pri: 3, trim: 0.95, duckTo: 0.55, maxVoices: 8,  duckHold: 0.45, voiceHold: 0.40 },
  // Goal cleared, level up, boss down. Should flatten everything else.
  headline: { pri: 4, trim: 1.00, duckTo: 1.00, maxVoices: 4,  duckHold: 0.90, voiceHold: 0.70 },
  // The boss-approach heartbeat. Never ducked by anything, ever - it is the one
  // sound whose whole job is to be heard over the top of a busy board. Its cap is
  // deliberately loose: the heartbeat accelerates to one every 420ms, and a tight
  // cap would start dropping beats at exactly the moment the mode is at its most
  // tense. Nothing else uses this bus, so it is self-limiting anyway.
  alert:    { pri: 5, trim: 1.00, duckTo: 1.00, maxVoices: 8,  duckHold: 0.50, voiceHold: 0.30 },
};

// Which bus each catalog id belongs to, and an optional per-sound trim on top of
// the bus fader for the ones that still sit wrong inside their own group.
// `gap` is the minimum ms between two plays of this id (see the voice limits).
const SFX_MIX = {
  // ── detail ──
  score_tick:    { bus: 'detail', gain: 0.85, gap: 28 },
  focus_pop:     { bus: 'detail', gain: 0.90, gap: 30 },
  focus_drop:    { bus: 'detail', gain: 0.85, gap: 40 },

  // ── board ──
  card_select:   { bus: 'board' },
  card_pop:      { bus: 'board', gain: 0.95 },
  flip_shuffle:  { bus: 'board' },
  no_swaps:      { bus: 'board', gain: 1.15 },
  card_discard:  { bus: 'board' },
  // The forced discard is a thing happening TO you, so it rides `event` (a louder
  // fader that also ducks the board under it) rather than `board`, on top of the
  // 1.7x the sound itself carries.
  card_discard_forced: { bus: 'event', gain: 1.1 },
  reward_select: { bus: 'board', gain: 1.05 },

  // ── score ── the dance
  particle_pip:  { bus: 'score', gap: 22 },
  particle_mult: { bus: 'score', gap: 22 },
  focus_beat:    { bus: 'score', gain: 0.90 },
  hand_scored:   { bus: 'score' },
  bonus_hand:    { bus: 'score', gain: 0.85 },
  m3_match:      { bus: 'score', gap: 20 },
  m3_pop:        { bus: 'score', gap: 20 },
  m3_combo:      { bus: 'score' },

  // ── event ──
  coin:          { bus: 'event' },
  shop_open:     { bus: 'event', gain: 0.90 },
  round_start:   { bus: 'event' },
  countdown:     { bus: 'event' },
  reward_good:   { bus: 'event' },
  reward_bad:    { bus: 'event' },
  reward_reveal: { bus: 'event', gain: 0.90 },
  chal_appear:   { bus: 'event' },

  // ── headline ──
  win_explode:   { bus: 'headline' },
  multi_goal:    { bus: 'headline' },
  success:       { bus: 'headline', gain: 0.90 },
  victory:       { bus: 'headline' },
  level_up:      { bus: 'headline' },
  chal_win:      { bus: 'headline' },
  chal_fail:     { bus: 'headline' },

  // ── alert ──
  heartbeat:     { bus: 'alert' },

  // Added to the catalog in r234. They had no rows because they had no catalog
  // entries, so they landed on the default bus and could not be switched off.
  clock_tick:    { bus: 'detail', gain: 0.80, gap: 120 },
  tick_tock:     { bus: 'event',  gain: 0.95 },
  rewind:        { bus: 'event' },
};

const SFX_DUCK_ATTACK  = 0.025;   // dip fast - the point is to clear the way NOW
const SFX_DUCK_RELEASE = 0.28;    // come back slowly, or the mix audibly pumps

let _mixNodes = null;        // bus id -> GainNode
let _mixCtx = null;
let _mixTail = null;         // what the master chain is currently connected to
let _mixPunch = null;        // { in, out } - the saturation + limiter insert (below)
let _mixRoom = null;         // { send, conv, ret } - the reverb send (below)
let _mixRoomKey = null;      // which room profile is loaded
let _mixMuffle = null;       // { lp, g } - the always-in-line muffle insert (below)
let _mixMuffled = false;
let _mixCurrentId = null;    // the sound being built right now (set by the wrapper)
const _mixVoices = {};       // bus id -> count of voices currently sounding
const _mixLastPlay = {};     // sound id -> when it last started, ms
const _mixDuckUntil = {};    // bus id -> audio-clock time the current duck ends

function sfxMixEntry(id) { return (id && SFX_MIX[id]) || null; }
function sfxBusOf(id) { const e = sfxMixEntry(id); return (e && e.bus) || 'board'; }

// Build the bus gains once, and keep them patched to whatever the legacy
// sfxDuckGain is doing. That node is created and thrown away around the goal
// flourish (js/interlude.js, js/score-dance.js), so the tail can change under us;
// re-patching on demand is cheaper than making those files aware of the mixer.
function sfxMixGraph() {
  const ctx = getAudioCtx();
  if (!_mixNodes || _mixCtx !== ctx) {
    _mixCtx = ctx;
    // The muffle insert sits between every bus and the tail, ALWAYS - see
    // sfxSetMuffle below for why it is left in line rather than patched in.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = SFX_MUFFLE_OPEN;
    lp.Q.value = 0.7071;                // Butterworth: flat, no resonant peak
    const mg = ctx.createGain();
    mg.gain.value = 1;
    lp.connect(mg);
    _mixMuffle = { lp, g: mg };
    _mixMuffled = false;
    _mixNodes = {};
    Object.keys(SFX_BUSES).forEach(b => {
      const g = ctx.createGain();
      g.gain.value = SFX_BUSES[b].trim;
      g.connect(lp);
      _mixNodes[b] = g;
    });
    _mixPunch = _buildPunch(ctx);
    mg.connect(_mixPunch.in);
    // The room RETURNS into the muffle insert, not into the tail, so a reverb
    // tail is muffled and punched exactly like the dry sound that threw it.
    _mixRoom = _buildRoom(ctx, lp);
    _mixRoomKey = null;
    _mixTail = null;
  }
  sfxRoomSync();
  const tail = (typeof sfxDuckGain !== 'undefined' && sfxDuckGain) ? sfxDuckGain : ctx.destination;
  if (tail !== _mixTail) {
    // Only the OUTPUT end re-patches. The buses stay wired to the muffle insert
    // and the muffle to the punch chain for the life of the context, so a tail
    // swap can never bypass either.
    try { _mixPunch.out.disconnect(); } catch (e) {}
    _mixPunch.out.connect(tail);
    _mixTail = tail;
  }
  return _mixNodes;
}

// ── The master punch (r234) ─────────────────────────────────────────────────
// Two stages, in this order, and the order is the whole point:
//
//   1. SATURATION. A tanh curve, normalised so it cannot raise the peak. It adds
//      harmonics rather than level, which is what makes a sub-bass thump audible
//      on a laptop speaker that cannot reproduce its fundamental at all. Density,
//      not volume.
//   2. A LIMITER. A DynamicsCompressor at a high ratio with a hard knee and a
//      fast attack. This is what lets the sounds themselves be written heavy: a
//      goal blast stacking eight voices would otherwise clip the output, and the
//      only alternative is writing every sound quieter than it wants to be.
//
// Makeup is deliberately modest. The loudness comes from the limiter holding the
// ceiling steady, not from pushing everything into it.
const SFX_DRIVE  = 1.45;   // tanh knee. Past about 2 the quiet sounds start to swell.
const SFX_MAKEUP = 1.30;   // drive INTO the limiter, never after it - see below
const SFX_CEIL   = -3.0;   // dB. The limiter is last, so this really is the ceiling.

function _buildPunch(ctx) {
  const inG = ctx.createGain();
  inG.gain.value = 1;

  const ws = ctx.createWaveShaper();
  const n = 1024, curve = new Float32Array(n), norm = Math.tanh(SFX_DRIVE);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * SFX_DRIVE) / norm;
  }
  ws.curve = curve;

  // The makeup drives INTO the limiter. With it after, the limiter's ceiling is
  // not the output's: measured at r234, 12 sounds rendered above 1.0 that way,
  // every one of them a goal blast, a victory or a multi-goal. Gain first, limiter
  // last, and nothing downstream can undo it.
  const drive = ctx.createGain();
  drive.gain.value = SFX_MAKEUP;

  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = SFX_CEIL;
  lim.knee.value = 0;         // a limiter, not a compressor: no soft region
  lim.attack.value = 0.002;   // fast enough to catch a transient, slow enough not to dull it
  lim.ratio.value = 20;
  lim.release.value = 0.12;

  const out = ctx.createGain();
  out.gain.value = 1;

  inG.connect(ws); ws.connect(drive); drive.connect(lim); lim.connect(out);
  return { in: inG, out };
}

// ── The room (r234) ─────────────────────────────────────────────────────────
// A tail is the third layer of an impact, after the transient and the body: it
// says where the sound happened. Without one, a synthesised hit sounds like it
// was generated rather than struck, however heavy its body is.
//
// It is a SEND, not an insert, so a voice chooses its own tail (the verb argument
// in js/audio-dsp.js). A coin and a score tick sit on the same bus and want
// opposite amounts, which a per-bus send could never give them.
//
// The profile is PER PACK, because "bigger" means a different room in each: a
// slot floor is small and hard, a cinematic one is a hall, a lounge is a warm
// plate. Switching pack rebuilds the impulse - see sfxRoomSync.
const SFX_ROOMS = {
  classic:    { seconds: 0.85, decay: 3.4, tone: 0.30, mix: 0.26, pre: 0.010 },
  vegas:      { seconds: 1.10, decay: 2.8, tone: 0.55, mix: 0.34, pre: 0.012 },
  highroller: { seconds: 2.60, decay: 1.9, tone: 0.20, mix: 0.58, pre: 0.030 },
  neon:       { seconds: 0.72, decay: 3.8, tone: 0.64, mix: 0.30, pre: 0.008 },
  lounge:     { seconds: 1.75, decay: 2.4, tone: 0.15, mix: 0.44, pre: 0.020 },
};
function sfxRoomProfile() {
  const id = (typeof sfxPackId === 'function') ? sfxPackId() : 'classic';
  return SFX_ROOMS[id] || SFX_ROOMS.classic;
}

// Exponentially decaying noise, lowpassed by a one-pole whose coefficient IS the
// tone knob, plus a handful of discrete early reflections in the first 60ms.
// Those taps are what make it read as a room rather than as a wash: a diffuse
// tail with no early reflections has no size, only length.
function _makeIR(ctx, p) {
  const sr = ctx.sampleRate;
  const len = Math.max(64, Math.floor(sr * (p.seconds + p.pre)));
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(sr * p.pre);
  const rnd = () => (typeof fxRandom === 'function') ? fxRandom() : Math.random();
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      const env = Math.pow(1 - t, p.decay);
      lp += ((rnd() * 2 - 1) - lp) * p.tone;
      d[i] = lp * env;
    }
    // Early reflections. Offset per channel so the two ears disagree, which is
    // where the width comes from without a panner anywhere in the graph.
    for (let k = 0; k < 6; k++) {
      const at = pre + Math.floor(sr * (0.004 + rnd() * 0.055) + ch * 37);
      if (at < len) d[at] += (rnd() * 2 - 1) * 0.55 * Math.pow(0.72, k);
    }
  }
  return buf;
}

function _buildRoom(ctx, returnTo) {
  const send = ctx.createGain();
  send.gain.value = 1;
  const conv = ctx.createConvolver();
  conv.normalize = true;
  // Keep the very bottom out of the tail. Sub energy in a reverb is mud, and the
  // thing it would smear is exactly the weight the sounds were written for.
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 220; hp.Q.value = 0.7071;
  const ret = ctx.createGain();
  ret.gain.value = 0;
  send.connect(hp); hp.connect(conv); conv.connect(ret); ret.connect(returnTo);
  return { send, conv, ret };
}

// Rebuild the impulse when the pack changes, and never otherwise. Generating a
// 2.6s stereo buffer is not something to do per voice, and this is called from
// sfxMixGraph, which every single voice goes through: the guard is a string
// compare and the work behind it happens once per pack switch.
function sfxRoomSync() {
  if (!_mixRoom) return;
  const id = (typeof sfxPackId === 'function') ? sfxPackId() : 'classic';
  if (id === _mixRoomKey) return;
  _mixRoomKey = id;
  const p = sfxRoomProfile();
  try {
    _mixRoom.conv.buffer = _makeIR(_mixCtx, p);
    _mixRoom.ret.gain.value = p.mix;
  } catch (e) { _mixRoom.ret.gain.value = 0; }
}

// Where a voice sends itself to be given a tail. Null-safe: if anything about the
// room failed to build, dRoute skips the send and the dry path has already played.
function sfxVerbIn(ctx) {
  sfxMixGraph();
  return _mixRoom ? _mixRoom.send : null;
}

// ── The muffle ──────────────────────────────────────────────────────────────
// "Heard through a wall": roll the top off everything and pull it back a bit.
// Used when a screen covers something the player still wants to hear happening
// underneath it (Survival's pick-of-three over the goal dance, js/survival.js).
//
// It is a LOWPASS THAT IS ALWAYS IN LINE, opened to 20kHz when idle, rather than
// a node patched in and out. Patching means disconnecting the graph while voices
// are sounding through it, which clicks; a Butterworth lowpass parked above the
// audible range is transparent and costs one node.
//
// This reaches samples, packs and coded sounds alike because every voice in the
// game connects at sfxOut. MUSIC IS NOT AFFECTED - it is an <audio> element and
// never enters this graph (js/music.js); its own slider is the control for that.
const SFX_MUFFLE_OPEN   = 20000;  // Hz - effectively bypassed
const SFX_MUFFLE_CLOSED = 620;    // Hz - through a wall, still clearly audible
const SFX_MUFFLE_GAIN   = 0.55;   // the pull-back that goes with it
const SFX_MUFFLE_RAMP   = 0.20;   // seconds, both directions

function sfxSetMuffle(on) {
  on = !!on;
  if (on === _mixMuffled && _mixMuffle) return;   // idempotent: no re-ramp per round start
  let ctx;
  try { ctx = getAudioCtx(); sfxMixGraph(); } catch (e) { return; }
  if (!_mixMuffle) return;
  const now = ctx.currentTime, t = now + SFX_MUFFLE_RAMP;
  const f = _mixMuffle.lp.frequency, g = _mixMuffle.g.gain;
  f.cancelScheduledValues(now); f.setValueAtTime(Math.max(f.value, 1), now);
  f.exponentialRampToValueAtTime(on ? SFX_MUFFLE_CLOSED : SFX_MUFFLE_OPEN, t);
  g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(on ? SFX_MUFFLE_GAIN : 1, t);
  _mixMuffled = on;
}

function sfxMuffled() { return _mixMuffled; }

// THE SEAM. Every voice in the game connects here instead of to the destination.
// Which bus it lands on comes from the sound id the wrapper is currently running.
function sfxOut(ctx) {
  try { return sfxMixGraph()[sfxBusOf(_mixCurrentId)]; }
  catch (e) { return (ctx || getAudioCtx()).destination; }
}

// The per-sound trim, folded into gain by the wrapper rather than by every voice.
function sfxMixGain(id) { const e = sfxMixEntry(id); return e && e.gain != null ? e.gain : 1; }

// ── Ducking ─────────────────────────────────────────────────────────────────
// Dip every bus below this one, hold for the sound's length, then release. A duck
// already running is EXTENDED rather than restarted, so a burst of scoring beats
// holds the detail bus down continuously instead of letting it flutter back up
// between them.
function sfxDuckFor(id, seconds) {
  const e = sfxMixEntry(id); if (!e) return;
  const me = SFX_BUSES[e.bus]; if (!me) return;
  const ctx = getAudioCtx(), now = ctx.currentTime;
  const hold = seconds != null ? seconds : (me.duckHold || 0.25);
  const nodes = sfxMixGraph();

  Object.keys(SFX_BUSES).forEach(b => {
    const bus = SFX_BUSES[b];
    if (bus.pri >= me.pri || bus.duckTo >= 1) return;
    const g = nodes[b].gain;
    const floor = bus.trim * bus.duckTo;
    const until = now + hold;
    if ((_mixDuckUntil[b] || 0) > now) {
      // Already ducked: just push the recovery out. Cancelling and re-ramping
      // from the top is what causes pumping.
      if (until > _mixDuckUntil[b]) {
        g.cancelScheduledValues(now);
        g.setValueAtTime(floor, now);
        g.setValueAtTime(floor, until);
        g.linearRampToValueAtTime(bus.trim, until + SFX_DUCK_RELEASE);
        _mixDuckUntil[b] = until;
      }
      return;
    }
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(floor, now + SFX_DUCK_ATTACK);
    g.setValueAtTime(floor, until);
    g.linearRampToValueAtTime(bus.trim, until + SFX_DUCK_RELEASE);
    _mixDuckUntil[b] = until;
  });
}

// ── Voice limits ────────────────────────────────────────────────────────────
// Two guards, both aimed at the same failure: a loop firing faster than the ear
// can resolve, which stops sounding like events and starts sounding like tone.
//   * `gap` - the same sound cannot retrigger within N ms.
//   * `maxVoices` - a bus at its cap drops the new voice rather than stealing,
//     because these are all sub-second one-shots: cutting one off mid-flight is
//     more audible than never starting it.
// Both are deliberately generous. Silence where the player expects a sound is a
// worse bug than a slightly busy mix.
function sfxMixAllow(id) {
  const e = sfxMixEntry(id); if (!e) return true;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (e.gap && (now - (_mixLastPlay[id] || -1e9)) < e.gap) return false;
  const bus = SFX_BUSES[e.bus];
  if (bus && (_mixVoices[e.bus] || 0) >= bus.maxVoices) return false;
  _mixLastPlay[id] = now;
  return true;
}

// Held for the sound's ring-out so maxVoices means "sounding at once", not
// "started at once".
function sfxMixHold(id) {
  const e = sfxMixEntry(id); if (!e) return;
  const bus = SFX_BUSES[e.bus]; if (!bus) return;
  _mixVoices[e.bus] = (_mixVoices[e.bus] || 0) + 1;
  setTimeout(() => { _mixVoices[e.bus] = Math.max(0, (_mixVoices[e.bus] || 1) - 1); },
             (bus.voiceHold || 0.25) * 1000);
}

// Clears the limiter's memory. Only the sound board needs this - auditioning the
// same row twice in a second must never be refused.
function sfxMixResetLimits() {
  Object.keys(_mixVoices).forEach(b => { _mixVoices[b] = 0; });
  Object.keys(_mixLastPlay).forEach(k => { delete _mixLastPlay[k]; });
}

// Run fn with `id` as the sound being built, so every voice it creates lands on
// the right bus. Synchronous on purpose: a sound's voices are all scheduled
// inside this call even when they carry a `delay`.
function sfxWithMixId(id, fn) {
  const prev = _mixCurrentId;
  _mixCurrentId = id;
  try { return fn(); } finally { _mixCurrentId = prev; }
}

// The live per-sound gain multiplier, read by playTone/playNoise and the packs on
// top of sfxVolume(). Kept separate from the bus fader so the board's audition
// button and the game hear the same balance.
function sfxIdGain() { return sfxMixGain(_mixCurrentId); }
