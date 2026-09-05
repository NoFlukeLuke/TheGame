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
};

const SFX_DUCK_ATTACK  = 0.025;   // dip fast - the point is to clear the way NOW
const SFX_DUCK_RELEASE = 0.28;    // come back slowly, or the mix audibly pumps

let _mixNodes = null;        // bus id -> GainNode
let _mixCtx = null;
let _mixTail = null;         // what the buses are currently connected to
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
    _mixNodes = {};
    Object.keys(SFX_BUSES).forEach(b => {
      const g = ctx.createGain();
      g.gain.value = SFX_BUSES[b].trim;
      _mixNodes[b] = g;
    });
    _mixTail = null;
  }
  const tail = (typeof sfxDuckGain !== 'undefined' && sfxDuckGain) ? sfxDuckGain : ctx.destination;
  if (tail !== _mixTail) {
    Object.keys(_mixNodes).forEach(b => {
      try { _mixNodes[b].disconnect(); } catch (e) {}
      _mixNodes[b].connect(tail);
    });
    _mixTail = tail;
  }
  return _mixNodes;
}

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
