// ══════════════════════════════════════════════
// AUDIO ASSETS (r179) - your own files standing in for the coded sounds
// ══════════════════════════════════════════════
// Every sound in the game is a plain top-level `function sfxSomething()`. Top-level
// FUNCTION DECLARATIONS become properties of `window` (top-level `let`/`const` do
// NOT - see the note in js/save.js about the same fact). That is what makes this
// file possible: it can REPLACE window.sfxCoin with a wrapper, and all ~200 bare
// `sfxCoin()` call sites across the engine resolve through the wrapper with no
// edits at any of them.
//
// The wrapper does three things, in this order:
//   1. the sound is switched off in Settings -> Sound effects  -> play nothing
//   2. a file is listed for this id in js/data/audio-manifest.js -> play the file
//   3. otherwise -> call the original coded sound, unchanged
//
// So the coded sounds remain the baseline and a file is an override. A missing or
// unplayable file falls back to the coded sound rather than going silent.
//
// LOAD ORDER: this file must come after every file that DEFINES an sfx (audio.js,
// hud.js, match3.js, score-dance.js) and after settings.js (it reads sfxVolume).

// ── The catalog: one row per sound the player can audition or switch off ──
// `fn`   - the global function this row owns
// `args` - what to pass when previewing it (the live game passes its own)
// `id`   - the manifest key, and the localStorage key for the on/off switch
const SFX_CATALOG = [
  // Board
  { id: 'card_select',   fn: 'sfxCardSelect',      group: 'Board',   label: 'Card select' },
  { id: 'card_pop',      fn: 'sfxCardPop',         group: 'Board',   label: 'Card pop',        args: ['♥'] },
  { id: 'flip_shuffle',  fn: 'sfxFlipShuffle',     group: 'Board',   label: 'Cards fly to preview',
    note: 'The riffle that plays as a hand leaves the board.' },
  { id: 'no_swaps',      fn: 'sfxNoSwaps',         group: 'Board',   label: 'Action refused' },

  // Scoring
  { id: 'particle_pip',  fn: 'sfxParticleStep',    group: 'Scoring', label: 'Pip particle',    args: ['pip'] },
  { id: 'particle_mult', fn: 'sfxParticleStep',    group: 'Scoring', label: 'Mult particle',   args: ['mult'], variantOf: 'particle_pip' },
  { id: 'score_tick',    fn: 'sfxScoreTick',       group: 'Scoring', label: 'Score climb tick' },
  { id: 'focus_beat',    fn: 'sfxFocusBeat',       group: 'Scoring', label: 'Focus beat' },
  { id: 'hand_scored',   fn: 'sfxHandScored',      group: 'Scoring', label: 'Hand scored',     args: [600] },
  { id: 'bonus_hand',    fn: 'sfxBonusHand',       group: 'Scoring', label: 'Bonus hand ping' },
  { id: 'win_explode',   fn: 'sfxWinExplode',      group: 'Scoring', label: 'Goal blast' },
  { id: 'multi_goal',    fn: 'sfxMultiGoal',       group: 'Scoring', label: 'Multi-goal dings', args: [2] },

  // Focus meter
  { id: 'focus_pop',     fn: 'sfxFocusNodePop',    group: 'Focus',   label: 'Focus node pops' },
  { id: 'focus_drop',    fn: 'sfxFocusNodeDrop',   group: 'Focus',   label: 'Focus node falls' },

  // Round flow
  { id: 'round_start',   fn: 'sfxRoundStart',      group: 'Round',   label: 'Round starts' },
  { id: 'countdown',     fn: 'sfxCountdown321',    group: 'Round',   label: 'Countdown 3-2-1' },
  { id: 'success',       fn: 'sfxSuccess',         group: 'Round',   label: 'Success chime' },
  { id: 'victory',       fn: 'sfxVictory',         group: 'Round',   label: 'Victory fanfare' },
  { id: 'level_up',      fn: 'sfxLevelUp',         group: 'Round',   label: 'Level up' },
  { id: 'heartbeat',     fn: 'sfxHeartbeat',       group: 'Round',   label: 'Heartbeat (boss approach)' },

  // Economy
  { id: 'coin',          fn: 'sfxCoin',            group: 'Economy', label: 'Coin' },
  { id: 'shop_open',     fn: 'sfxShopOpen',        group: 'Economy', label: 'Shop opens' },
  { id: 'reward_good',   fn: 'sfxRewardGood',      group: 'Economy', label: 'Reward - good' },
  { id: 'reward_bad',    fn: 'sfxRewardBad',       group: 'Economy', label: 'Reward - bad' },
  { id: 'reward_reveal', fn: 'sfxRewardReveal',    group: 'Economy', label: 'Reward - reveal' },

  // Challenges
  { id: 'chal_appear',   fn: 'sfxChallengeAppear', group: 'Challenge', label: 'Challenge appears' },
  { id: 'chal_win',      fn: 'sfxChallengeWin',    group: 'Challenge', label: 'Challenge won' },
  { id: 'chal_fail',     fn: 'sfxChallengeFail',   group: 'Challenge', label: 'Challenge failed' },

  // Match-3
  { id: 'm3_match',      fn: 'sfxMatch3Match',     group: 'Match-3', label: 'Match found',  args: [1] },
  { id: 'm3_pop',        fn: 'sfxMatch3Pop',       group: 'Match-3', label: 'Match pops',   args: [1] },
  { id: 'm3_combo',      fn: 'sfxMatch3Combo',     group: 'Match-3', label: 'Cascade combo', args: [3] },
];

function sfxCatalogEntry(id) { return SFX_CATALOG.find(s => s.id === id); }

// ══ Preferences (per-sound on/off, per-track on/off, shuffle) ══
// Kept apart from SETTINGS so the settings screen stays a flat list of rows and
// this can be an open-ended map of ids.
const AUDIO_PREFS_KEY = 'lethe.audio.v1';
let AUDIO_PREFS = { sfxOff: {}, trackOff: {}, shuffle: false, musicOn: true };

function loadAudioPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(AUDIO_PREFS_KEY) || '{}') || {};
    AUDIO_PREFS = Object.assign({ sfxOff: {}, trackOff: {}, shuffle: false, musicOn: true }, raw);
    AUDIO_PREFS.sfxOff = AUDIO_PREFS.sfxOff || {};
    AUDIO_PREFS.trackOff = AUDIO_PREFS.trackOff || {};
  } catch (e) { /* storage.js already guarantees this cannot throw, but be safe */ }
}
function saveAudioPrefs() {
  try { localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(AUDIO_PREFS)); } catch (e) {}
}
loadAudioPrefs();

function sfxIsOn(id) { return !AUDIO_PREFS.sfxOff[id]; }
function setSfxOn(id, on) {
  if (on) delete AUDIO_PREFS.sfxOff[id]; else AUDIO_PREFS.sfxOff[id] = true;
  saveAudioPrefs();
}

// ══ Sample loading ══
// Decoded once, cached by path. `null` = tried and failed (never retried, and the
// coded sound takes over permanently for that id).
const _sfxBuffers = {};      // path -> AudioBuffer | null | Promise
const _sfxWarned = {};

function sfxFileFor(id) {
  const m = (typeof AUDIO_MANIFEST !== 'undefined' && AUDIO_MANIFEST.sfx) || {};
  return m[id] || null;
}

function loadSfxBuffer(path) {
  if (path in _sfxBuffers) return _sfxBuffers[path];
  const p = fetch(path)
    .then(r => { if (!r.ok) throw new Error(r.status + ' ' + path); return r.arrayBuffer(); })
    .then(buf => getAudioCtx().decodeAudioData(buf))
    .then(decoded => { _sfxBuffers[path] = decoded; return decoded; })
    .catch(err => {
      _sfxBuffers[path] = null;
      if (!_sfxWarned[path]) { _sfxWarned[path] = true; console.warn('[audio] could not load', path, '- using the coded sound instead.', err.message); }
      return null;
    });
  _sfxBuffers[path] = p;
  return p;
}

// Warm the cache for everything listed, so the first play is not a download.
// Called on the first user gesture (which is also when the AudioContext unlocks).
let _sfxPrewarmed = false;
function prewarmSfxSamples() {
  if (_sfxPrewarmed) return;
  _sfxPrewarmed = true;
  const m = (typeof AUDIO_MANIFEST !== 'undefined' && AUDIO_MANIFEST.sfx) || {};
  Object.keys(m).forEach(id => loadSfxBuffer(m[id]));
}

// Play a decoded buffer through the same duck bus the coded sounds use, so
// heartbeat ducking and master volume behave identically either way.
function playSfxBuffer(buf, gain = 1) {
  const g = gain * sfxVolume();
  if (!buf || g <= 0) return;
  const ctx = getAudioCtx();
  const src = ctx.createBufferSource();
  const env = ctx.createGain();
  env.gain.value = g;
  src.buffer = buf;
  src.connect(env);
  env.connect(sfxDuckGain || ctx.destination);
  src.start();
}

// True if this id has a usable file RIGHT NOW (decoded and cached). A listed file
// that has not finished decoding yet plays the coded sound for that one call -
// which is why prewarm exists.
function sfxSampleReady(id) {
  const path = sfxFileFor(id);
  if (!path) return null;
  const b = _sfxBuffers[path];
  if (b && typeof b.duration === 'number') return b;
  if (!(path in _sfxBuffers)) loadSfxBuffer(path);
  return null;
}

// ══ The override install ══
// One wrapper per catalog row. `variantOf` rows (the pip/mult particle pair share
// one function) do not get their own wrapper - the base row's wrapper reads the
// argument and picks the right id.
function installSfxOverrides() {
  const byFn = {};
  SFX_CATALOG.forEach(e => { (byFn[e.fn] = byFn[e.fn] || []).push(e); });

  Object.keys(byFn).forEach(fnName => {
    const orig = window[fnName];
    if (typeof orig !== 'function') { console.warn('[audio] no such sound function:', fnName); return; }
    const rows = byFn[fnName];
    window[fnName] = function (...args) {
      // Which catalog row is this call? With one row it is that row; with several
      // (the particle pair) the first argument selects it.
      let row = rows[0];
      if (rows.length > 1) {
        const hit = rows.find(r => r.args && String(r.args[0]) === String(args[0]));
        if (hit) row = hit;
      }
      if (!sfxIsOn(row.id)) return;
      const buf = sfxSampleReady(row.id);
      if (buf) return playSfxBuffer(buf);
      return orig.apply(this, args);
    };
    window[fnName]._coded = orig;   // the audition button needs the original
  });
}
installSfxOverrides();

// Audition one sound from the Settings board. Ignores the on/off switch (you are
// asking to hear it) but respects volume and mute.
function sfxAudition(id) {
  const e = sfxCatalogEntry(id);
  if (!e) return;
  const buf = sfxSampleReady(id);
  if (buf) { playSfxBuffer(buf); return; }
  const fn = window[e.fn];
  const coded = (fn && fn._coded) || fn;
  if (typeof coded === 'function') { try { coded.apply(null, e.args || []); } catch (err) {} }
}

// Does this id currently play a file rather than the coded sound?
function sfxUsesFile(id) { return !!sfxFileFor(id); }
