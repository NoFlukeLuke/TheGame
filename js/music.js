// ══════════════════════════════════════════════
// MUSIC (r179) - background tracks from assets/music/
// ══════════════════════════════════════════════
// Tracks are listed in js/data/audio-manifest.js and played through a single
// <audio> element, NOT through the Web Audio graph the sound effects use. That is
// deliberate: an <audio> element streams a long file and starts playing before it
// has finished downloading, where decodeAudioData has to hold the whole track in
// memory first. A four-minute MP3 decodes to ~40 MB of PCM; a phone should not
// have to do that to hear a loop.
//
// The cost of that choice is that music does NOT pass through sfxDuckGain, so it
// is not ducked by the heartbeat. Its own volume slider covers that need.
//
// AUTOPLAY: browsers refuse to start audio before the player has interacted with
// the page. `armMusicAutostart` waits for the first click/key and starts then, so
// the menu is silent until the player touches it and then music begins.

let _musicEl = null;
let _musicIndex = -1;
let _musicScene = 'menu';        // 'menu' while the main menu is up, 'game' in a run
let _musicWantPlaying = false;   // what the player asked for, regardless of autoplay
let _musicOrder = [];            // shuffled index order when shuffle is on
// Track ids whose FILE failed to load this session. Without this, a missing
// file was an infinite loop: error -> musicNext -> the same track (it is the
// only one in its scene) -> load -> error, re-requesting the file nonstop for
// the whole run (r470, found with deadline.mp3 absent from assets/music/).
// Session-only on purpose: a deploy that adds the file heals on the next load.
const _musicDeadIds = new Set();

function musicEl() {
  if (!_musicEl) {
    _musicEl = new Audio();
    _musicEl.preload = 'none';
    _musicEl.addEventListener('ended', () => musicNext());
    _musicEl.addEventListener('error', () => {
      const t = musicTrackAt(_musicIndex);
      if (t) {
        console.warn('[music] could not play', t.file, '- skipping.');
        _musicDeadIds.add(t.id);
      }
      musicNext();
    });
  }
  return _musicEl;
}

// Every track in the manifest, valid rows only.
function musicAllTracks() {
  const list = (typeof AUDIO_MANIFEST !== 'undefined' && AUDIO_MANIFEST.music) || [];
  return list.filter(t => t && t.id && t.file);
}
function musicTrackAt(i) { return musicAllTracks()[i] || null; }

// A track is on unless the player switched it off - or, if they have never
// touched it, unless the manifest marks it `off: true`. That default is what
// lets a dozen ambience beds ship without the playlist starting as a wall of
// noise; the moment the player flips one, their choice is what counts.
function musicTrackOn(id) {
  const pref = AUDIO_PREFS.trackOff[id];
  if (pref !== undefined) return !pref;
  const t = musicAllTracks().find(x => x.id === id);
  return !(t && t.off);
}
function setMusicTrackOn(id, on) {
  if (on) delete AUDIO_PREFS.trackOff[id]; else AUDIO_PREFS.trackOff[id] = true;
  saveAudioPrefs();
  // Switching off the track that is playing should take effect now, not at the
  // end of a four-minute song.
  const cur = musicTrackAt(_musicIndex);
  if (cur && cur.id === id && !on) musicNext();
  else if (on && _musicWantPlaying && !musicIsPlaying()) musicPlay();
}

// Indexes (into musicAllTracks) that are switched on and belong in this scene.
function musicPlayableIndexes() {
  return musicAllTracks().map((t, i) => i).filter(i => {
    const t = musicTrackAt(i);
    const scene = t.scene || 'any';
    return musicTrackOn(t.id) && !_musicDeadIds.has(t.id) && musicSceneFits(scene, _musicScene);
  });
}

function musicVolume() {
  if (SETTINGS.muted) return 0;
  const master = (typeof SETTINGS.volume === 'number' ? SETTINGS.volume : 100) / 100;
  const mus = (typeof SETTINGS.musicVolume === 'number' ? SETTINGS.musicVolume : 60) / 100;
  return master * mus;
}
function applyMusicVolume() {
  if (!_musicEl) return;
  const v = Math.max(0, Math.min(1, musicVolume()));
  // Routed through the speaker (below), the volume is a gain node after it and the
  // element plays at full level, so no browser applies the volume twice.
  if (_spk) { _musicEl.volume = 1; _spk.vol.gain.value = v; }
  else _musicEl.volume = v;
}

// ── THE SPEAKER (r824, owner) ───────────────────────────────────────────────
// Every track plays as if through the small speaker in a cheap cabinet: the low
// end and the top are cut off steeply, the middle where a small cone rings is
// pushed up a little, a compressor evens the level out, it is made up for what was cut, and a soft clip
// rounds the loudest peaks off the way a little speaker breaks up.
//   element -> highpass x2 -> peak -> lowpass x2 -> compressor -> makeup -> tanh clip -> volume
// The <audio> element is routed into the Web Audio graph the first time the
// speaker is wanted (createMediaElementSource can only be called once per
// element); after that the element's sound only ever leaves through the graph,
// so Off is a bypass (source straight to the volume), not an unroute. Music does
// NOT go through sfxOut: it is not ducked or bus-limited (r191), as before.
// musicSpeakerChain() is the ONE builder: the game and speaker-preview tooling
// (an OfflineAudioContext) both call it, so a preview is the game's sound.
// Settings -> Audio -> Music speaker (musicSpeaker: 'on' / 'off').
// Q for the high / low passes is in dB in the Web Audio spec: -3.01 dB is the
// linear 0.707 of a Butterworth stage, so two stages make a clean 24 dB/octave.
const MUSIC_SPEAKER = { hp: 260, lp: 4200, passQ: -3.01, peakF: 1600, peakQ: 0.8, peakDb: 3,
                        compDb: -30, compKnee: 10, compRatio: 6, makeupDb: 2, clip: 1 };
let _spk = null;   // { src, chainIn, chainOut, vol } once routed

function musicSpeakerOn() { return !(typeof SETTINGS !== 'undefined' && SETTINGS.musicSpeaker === 'off'); }

// Build the speaker on `ctx` between `input` and `output`; returns its nodes.
function musicSpeakerChain(ctx, input, output) {
  const c = MUSIC_SPEAKER, bq = (type, f, q, g) => {
    const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q;
    if (g != null) n.gain.value = g; return n;
  };
  const nodes = [bq('highpass', c.hp, c.passQ), bq('highpass', c.hp, c.passQ),
                 bq('peaking', c.peakF, c.peakQ, c.peakDb),
                 bq('lowpass', c.lp, c.passQ), bq('lowpass', c.lp, c.passQ)];
  // A compressor evens the tracks out: a bass-heavy mix loses more to the high
  // pass than a trumpet-heavy one, and a fixed gain left them 8 dB apart.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = c.compDb; comp.knee.value = c.compKnee; comp.ratio.value = c.compRatio;
  comp.attack.value = 0.005; comp.release.value = 0.2;
  const makeup = ctx.createGain(); makeup.gain.value = Math.pow(10, c.makeupDb / 20);
  const clip = ctx.createWaveShaper();
  const N = 2048, curve = new Float32Array(N), k = c.clip;
  // tanh: unity for quiet passages, rounds peaks off; the input is clamped to +-1.
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / k; }
  clip.curve = curve; clip.oversample = '2x';
  nodes.push(comp, makeup, clip);
  input.connect(nodes[0]);
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  nodes[nodes.length - 1].connect(output);
  return { first: nodes[0], last: nodes[nodes.length - 1] };
}

// Route the element into the graph (once), then wire speaker or bypass.
// r830: the warble (a modulated delay, below) sits first, always in the path once
// routed. The ticks join at the volume, AFTER the speaker: its compressor pressed
// them under the music (measured 0 to 3 dB over it in their own band). They are
// already a small speaker's sound (2 to 3 kHz). Routed when the speaker OR the
// level's end is wanted.
//   element -> warble delay -> (speaker chain | bypass) -> volume
//   ticks ----------------------------------------------------^
function musicSpeakerApply() {
  if (!_musicEl) return;
  if (!_spk) {
    if (!musicSpeakerOn() && musicEdgeMode() === 'off') return;   // never routed until wanted
    let ctx; try { ctx = getAudioCtx(); } catch (e) { return; }
    if (!ctx || !ctx.createMediaElementSource) return;
    try {
      const src = ctx.createMediaElementSource(_musicEl);
      const vol = ctx.createGain(); vol.connect(ctx.destination);
      const wob = musicWarbleBuild(ctx);
      src.connect(wob.delay);
      const ticks = ctx.createGain(); ticks.gain.value = 1;
      _spk = { ctx, src, vol, wob, ticks, chain: null, wired: null };
    } catch (e) { console.warn('[music] speaker unavailable', e); return; }
  }
  const want = musicSpeakerOn() ? 'on' : 'off';
  if (_spk.wired === want) { applyMusicVolume(); return; }
  try { _spk.wob.delay.disconnect(); } catch (e) {}
  try { _spk.ticks.disconnect(); } catch (e) {}
  if (want === 'on') {
    if (!_spk.chain) _spk.chain = musicSpeakerChain(_spk.ctx, _spk.wob.delay, _spk.vol);
    else _spk.wob.delay.connect(_spk.chain.first);
  } else _spk.wob.delay.connect(_spk.vol);
  _spk.ticks.connect(_spk.vol);
  _spk.wired = want;
  applyMusicVolume();
}

// ── THE SPEED RAMP (r244) ───────────────────────────────────────────────────
// A track can get faster the longer it plays: `ramp` on its manifest row. The
// bare `ramp: true` is every 20s, +10%, capped at 2x - write an object to say
// something else. It is COMPOUNDING, so the cap is not decoration: +10% every
// 20s reaches 2x in two minutes and 4x in four, and an uncapped ramp on a long
// bed ends as a chipmunk scream.
//
//   ramp: true
//   ramp: { every: 20, by: 0.10, max: 2.0, pitchUp: true }
//
// `pitchUp` is the difference between the two things people mean by "faster":
//   false (default) - TEMPO only. The browser time-stretches, so the track keeps
//                     its key and just plays quicker. Musical.
//   true            - TAPE. Pitch rises with the speed. A machine winding up.
//
// TWO RULES:
//  - It advances on WALL CLOCK while the track is actually playing, never on
//    el.currentTime. currentTime runs at the playback rate, so keying off it
//    would make each step arrive sooner than the last on top of the compounding
//    and the ramp would run away.
//  - It RESETS on every track load. The ramp belongs to a play of a track, not
//    to the session; without this, skipping back to a track you already ran up
//    would start it at 2x with nothing on screen explaining why.
const MUSIC_RAMP_DEFAULT = { every: 20, by: 0.10, max: 2.0, pitchUp: false };
const MUSIC_RAMP_TICK = 250;     // ms; how often the accumulator is read
let _rampCfg = null, _rampAcc = 0, _rampLast = 0, _rampTimer = null;

// Normalise whatever the manifest row said into a config, or null for no ramp.
function musicRampConfig(t) {
  const r = t && t.ramp;
  if (!r) return null;
  const c = Object.assign({}, MUSIC_RAMP_DEFAULT, (r === true) ? {} : r);
  c.every = Math.max(1, +c.every || MUSIC_RAMP_DEFAULT.every);
  c.by    = Math.max(0, +c.by    || 0);
  c.max   = Math.max(1, +c.max   || 1);
  return c.by ? c : null;
}

function musicSetRate(rate, pitchUp) {
  const el = _musicEl; if (!el) return;
  const r = Math.max(0.25, Math.min(4, rate));
  // preservesPitch is the inverse of what we call pitchUp: true means "hold the
  // key and stretch time". The prefixed spellings are for older Safari/Firefox.
  // The manifest ramp passes its own flag; the clock ramp (below) passes the
  // setting's; a plain reset passes nothing and holds the key.
  const keep = !pitchUp;
  try { el.preservesPitch = keep; } catch (e) {}
  try { el.mozPreservesPitch = keep; } catch (e) {}
  try { el.webkitPreservesPitch = keep; } catch (e) {}
  el.playbackRate = r;
}

// Live rate, for a readout or a test.
function musicRate() { return _musicEl ? _musicEl.playbackRate : 1; }

function musicResetRamp() {
  _rampAcc = 0;
  _rampLast = performance.now();
  _rampCfg = musicRampConfig(musicTrackAt(_musicIndex));
  musicSetRate(1);
  if (_rampTimer) { clearInterval(_rampTimer); _rampTimer = null; }
  if (_rampCfg) _rampTimer = setInterval(musicRampTick, MUSIC_RAMP_TICK);
}

function musicRampTick() {
  const now = performance.now();
  const dt = now - _rampLast;
  _rampLast = now;
  if (!_rampCfg || !musicIsPlaying()) return;   // a paused track does not age
  _rampAcc += dt / 1000;
  const steps = Math.floor(_rampAcc / _rampCfg.every);
  const want = Math.min(_rampCfg.max, Math.pow(1 + _rampCfg.by, steps));
  if (Math.abs(want - musicRate()) > 0.0005) musicSetRate(want, _rampCfg.pitchUp);
}

// Override the ramp on whatever is playing right now, without editing the
// manifest - for tuning from the console: musicSetRamp({ every: 5, by: 0.2 }).
// Pass null to switch it off. Lasts until the next track loads.
function musicSetRamp(cfg) {
  _rampCfg = cfg ? musicRampConfig({ ramp: cfg }) : null;
  _rampAcc = 0;
  _rampLast = performance.now();
  musicSetRate(1);
  if (_rampTimer) { clearInterval(_rampTimer); _rampTimer = null; }
  if (_rampCfg) _rampTimer = setInterval(musicRampTick, MUSIC_RAMP_TICK);
}

function musicIsPlaying() { return !!_musicEl && !_musicEl.paused && !_musicEl.ended; }

// Pick the next index to play. Shuffle draws from the playable set at random
// (avoiding an immediate repeat when there is more than one option).
function _musicPickNext(from) {
  const pool = musicPlayableIndexes();
  if (!pool.length) return -1;
  if (AUDIO_PREFS.shuffle) {
    if (pool.length === 1) return pool[0];
    let n = from;
    while (n === from) n = pool[Math.floor(Math.random() * pool.length)];
    return n;
  }
  const after = pool.find(i => i > from);
  return (after !== undefined) ? after : pool[0];
}

function musicLoadIndex(i) {
  const t = musicTrackAt(i);
  if (!t) return false;
  const el = musicEl();
  _musicIndex = i;
  el.src = t.file;
  el.preload = 'auto';
  applyMusicVolume();
  musicResetRamp();
  if (typeof renderPlaylist === 'function') renderPlaylist();
  return true;
}

function musicPlay() {
  _musicWantPlaying = true;
  if (!AUDIO_PREFS.musicOn) return;
  const pool = musicPlayableIndexes();
  if (!pool.length) return;
  if (pool.indexOf(_musicIndex) === -1) { if (!musicLoadIndex(_musicPickNext(-1))) return; }
  musicSpeakerApply();
  if (_spk && _spk.ctx.state === 'suspended') { try { _spk.ctx.resume(); } catch (e) {} }
  applyMusicVolume();
  const p = musicEl().play();
  if (p && p.catch) p.catch(() => { /* autoplay blocked - armMusicAutostart retries on the next gesture */ });
  if (typeof renderPlaylist === 'function') renderPlaylist();
  return p;
}

function musicPause() {
  _musicWantPlaying = false;
  if (_musicEl) _musicEl.pause();
  if (typeof renderPlaylist === 'function') renderPlaylist();
}

function musicToggle() { musicIsPlaying() ? musicPause() : musicPlay(); }

function musicNext() {
  const n = _musicPickNext(_musicIndex);
  if (n < 0) { musicPause(); return; }
  musicLoadIndex(n);
  if (_musicWantPlaying) musicPlay();
}

function musicPrev() {
  const pool = musicPlayableIndexes();
  if (!pool.length) return;
  const at = pool.indexOf(_musicIndex);
  const n = pool[(at <= 0 ? pool.length : at) - 1];
  musicLoadIndex(n);
  if (_musicWantPlaying) musicPlay();
}

// Play one specific track now (the playlist's row button).
function musicPlayTrack(id) {
  const i = musicAllTracks().findIndex(t => t.id === id);
  if (i < 0) return;
  _musicDeadIds.delete(id);   // an explicit press is a request to try the file again
  if (!musicTrackOn(id)) setMusicTrackOn(id, true);
  musicLoadIndex(i);
  musicPlay();
}

function setMusicShuffle(on) { AUDIO_PREFS.shuffle = !!on; saveAudioPrefs(); if (typeof renderPlaylist === 'function') renderPlaylist(); }
function setMusicOn(on) {
  AUDIO_PREFS.musicOn = !!on; saveAudioPrefs();
  if (!on) { if (_musicEl) _musicEl.pause(); }
  else if (_musicWantPlaying || musicAutoStarted) musicPlay();
  if (typeof renderPlaylist === 'function') renderPlaylist();
}

// Does a track of scene `ts` belong in scene `at`? 'any' is the menu and the run,
// never the shop: the shop plays its own tracks and nothing else (r824).
function musicSceneFits(ts, at) {
  ts = ts || 'any';
  if (at === 'shop') return ts === 'shop';
  return ts === 'any' || ts === at;
}

// The menu and a run can have different tracks. Changing scene only interrupts
// the current track if it does not belong in the new scene.
function musicSetScene(scene) {
  if (_musicScene === scene) return;
  if (scene !== 'shop') _musicResume = null;
  _musicScene = scene;
  const cur = musicTrackAt(_musicIndex);
  const ok = cur && musicSceneFits(cur.scene, scene);
  if (!ok) musicNext();
}

// ── The shop's music (r824) ──
// Opening the shop puts the run's track aside (index and position) and plays a
// shop track; closing it brings the run's track back where it stopped. With
// every shop track switched off the run's music just carries on.
let _musicResume = null;
function musicShopHasTracks() {
  return musicAllTracks().some(t => t.scene === 'shop' && musicTrackOn(t.id) && !_musicDeadIds.has(t.id));
}
function musicEnterShop() {
  if (_musicScene !== 'game' || !musicShopHasTracks()) return;
  const keep = (_musicIndex >= 0 && _musicEl) ? { i: _musicIndex, t: _musicEl.currentTime || 0 } : null;
  _clockRate = 1;   // the shop plays at 1x from its first note (the clock ramp's target there is 1)
  musicSetScene('shop');
  _musicResume = keep;
}
function musicLeaveShop() {
  if (_musicScene !== 'shop') return;
  const back = _musicResume; _musicResume = null;
  _musicScene = 'game';
  const t = back && musicTrackAt(back.i);
  if (t && musicPlayableIndexes().indexOf(back.i) >= 0) {
    musicLoadIndex(back.i);
    try { musicEl().currentTime = back.t; } catch (e) {}
    if (_musicWantPlaying) musicPlay();
  } else musicNext();
}

// ── Autostart on the first interaction ───────────────────────────────────────
// One listener, removed once it has fired. It also unlocks the AudioContext and
// warms the sound-effect samples, so the first coin sound is not a download.
let musicAutoStarted = false;
// r717 (owner: "music won't play on mobile"): a FINGER's pointerdown is not a gesture
// a phone lets media start from (only a mouse's is; for touch it is pointerup /
// touchend / click), and this listener used to remove itself on the first
// pointerdown whatever play() said, so on a phone the music never started. It now
// listens to the release events too and stays armed until play() actually succeeds.
const MUSIC_GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
function armMusicAutostart() {
  let warmed = false, trying = false;
  const done = () => MUSIC_GESTURES.forEach(ev => window.removeEventListener(ev, go, true));
  function go() {
    if (musicAutoStarted) { done(); return; }
    try { const c = getAudioCtx(); if (c && c.state === 'suspended') c.resume(); } catch (e) {}
    if (!warmed) { warmed = true; try { prewarmSfxSamples(); } catch (e) {} }
    if (!AUDIO_PREFS.musicOn || !musicPlayableIndexes().length) { musicAutoStarted = true; done(); return; }
    if (trying) return;
    trying = true;
    const p = musicPlay();
    const ok = () => { trying = false; musicAutoStarted = true; done(); };
    if (p && p.then) p.then(ok, () => { trying = false; });
    else if (musicIsPlaying()) ok(); else trying = false;
  }
  MUSIC_GESTURES.forEach(ev => window.addEventListener(ev, go, true));
}
armMusicAutostart();

// ── THE CLOCK RAMP (r694) ───────────────────────────────────────────────────
// Owner: the music speeds up the closer the round is to its end. A track with
// no `ramp` of its own follows the ROUND CLOCK while a run is on: 1x as the
// clock starts, MUSIC_CLOCK.max as it reaches 0:00, along `p ^ curve` where p
// is the share of the round gone (so the first half barely moves and the last
// minute climbs). Read off `roundSeconds / roundStartSeconds`, the same figures
// the clock bar and "how far into the round" use: every round start, boss
// rounds included, funnels through startRoundTimer, which writes the start;
// Flow's level-ups add their seconds to both, so its one session clock reads
// as one long round; a rewind past the start clamps to 1x.
//
// A HELD clock (shop, event, reward screen, the pause menu: gameTimerPaused)
// holds the rate where it was. A FINISHED round (roundEnded, or no interval
// running) eases home to 1x, except in Flow, whose clock runs on through its
// level-ups; there the hold applies until the run leaves the board. The menu
// is always 1x. Every change is slewed (MUSIC_CLOCK.slew per second), so a new
// round or a pause is a glide, never a jump.
//
// Settings -> Audio -> Music follows the clock: off / tempo (the key is held,
// the browser time-stretches) / tape (the pitch rises with the speed).
// `musicClockSet({ max, curve, slew })` tunes it from the console for a session.
const MUSIC_CLOCK = { max: 1.65, curve: 1.6, slew: 0.5 };
const MUSIC_CLOCK_TICK = 250;   // ms
let _clockRate = 1, _clockTape = false;

function musicClockMode() {
  const m = (typeof SETTINGS !== 'undefined') ? SETTINGS.musicClock : 'tempo';
  return (m === 'off' || m === 'tape') ? m : 'tempo';
}
function musicClockSet(cfg) { Object.assign(MUSIC_CLOCK, cfg || {}); }

// The rate the clock asks for right now; `cur` is handed back where it holds.
function musicClockTarget(cur) {
  if (musicClockMode() === 'off' || _musicScene !== 'game') return 1;
  if (typeof roundSeconds !== 'number' || typeof roundStartSeconds !== 'number' || !(roundStartSeconds > 0)) return 1;
  const over = (typeof roundEnded !== 'undefined' && roundEnded) || (typeof roundInterval !== 'undefined' && !roundInterval);
  const flow = (typeof survivalActive === 'function') && survivalActive();
  if (over) return flow ? cur : 1;
  if ((typeof gameTimerPaused !== 'undefined' && gameTimerPaused) || (typeof pipeTimerPaused !== 'undefined' && pipeTimerPaused)) return cur;
  const p = Math.max(0, Math.min(1, 1 - roundSeconds / roundStartSeconds));
  return 1 + (MUSIC_CLOCK.max - 1) * Math.pow(p, MUSIC_CLOCK.curve);
}

function musicClockTick() {
  if (_rampCfg) return;                       // a track with its own ramp owns the rate
  const tape = musicClockMode() === 'tape';
  const target = musicClockTarget(_clockRate);
  const step = MUSIC_CLOCK.slew * MUSIC_CLOCK_TICK / 1000;
  const next = _clockRate + Math.max(-step, Math.min(step, target - _clockRate));
  // Nothing to write: the rate is where it should be and the pitch flag has not
  // changed (a switch between Tempo and Tape at 1x still has to land).
  if (tape === _clockTape && Math.abs(next - _clockRate) < 0.0005 && Math.abs(next - musicRate()) < 0.0005) return;
  _clockRate = next; _clockTape = tape;
  if (_musicEl) musicSetRate(_clockRate, tape);
}
// Always on: it is one comparison a quarter second, and it must also see a
// setting change (off -> 1x) and a run ending with no track loaded yet.
setInterval(musicClockTick, MUSIC_CLOCK_TICK);

// ── THE LEVEL'S END: TAPE WARBLE AND TICKS (r830, owner) ─────────────────────
// Near the end of a level the music starts to go wrong. From MUSIC_EDGE.warbleFrom
// seconds left the track WARBLES like a worn tape: the element's sound runs through
// a short delay whose length two slow, uneven sine waves (wow) and one fast one
// (flutter) push back and forth, which bends the pitch up and down. It deepens to
// full at 0:00 (`w` = (1 - left / warbleFrom) ^ curve). From tickFrom seconds a
// clock TICKS under it, tick then tock, once a second, twice a second from fastFrom,
// louder as the clock runs down. The ticks are built in the music's own graph and
// join it at its volume, so they follow the music volume and stop with it.
// Same clock and same rules as the clock ramp above: a held clock (shop, event,
// pause menu) holds the warble where it is and stops the ticks; a finished level
// lets the warble go (Flow holds it through its level-ups, as the rate); the menu
// and the shop are clean. Settings -> Audio -> Music at the level's end
// (musicEdge: 'both' / 'warble' / 'off'). Pitch swing at full warble: about 1.2%
// from the wow (2 pi f x depth) plus 1% from the second wow, ~40 cents at the peak.
const MUSIC_EDGE = {
  warbleFrom: 45, curve: 1.3, tickFrom: 30, fastFrom: 10,
  baseMs: 15, wowHz: 0.55, wowMs: 3.5, wow2Hz: 0.83, wow2Ms: 2, flutHz: 6.5, flutMs: 0.08,
  tickVol: 0.32, tickVolEnd: 0.6, lookahead: 0.6,
};
let _edgeW = 0, _edgeNext = 0, _edgeN = 0, _edgeTicking = false, _edgeNoise = null;

function musicEdgeMode() {
  const m = (typeof SETTINGS !== 'undefined') ? SETTINGS.musicEdge : 'both';
  return (m === 'off' || m === 'warble') ? m : 'both';
}
function musicEdgeSet(cfg) { Object.assign(MUSIC_EDGE, cfg || {}); }

function musicWarbleBuild(ctx) {
  const c = MUSIC_EDGE;
  const delay = ctx.createDelay(0.1); delay.delayTime.value = c.baseMs / 1000;
  const lfo = (hz, ms) => {
    const o = ctx.createOscillator(); o.frequency.value = hz;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g); g.connect(delay.delayTime); o.start();
    return { o, g, ms };
  };
  return { delay, lfos: [lfo(c.wowHz, c.wowMs), lfo(c.wow2Hz, c.wow2Ms), lfo(c.flutHz, c.flutMs)] };
}

// Seconds left on a live level clock, 'hold' while it is held or between Flow's
// levels, null when there is no level end to play (menu, shop, a finished level).
function musicEdgeLeft() {
  if (_musicScene !== 'game') return null;
  if (typeof roundSeconds !== 'number' || typeof roundStartSeconds !== 'number' || !(roundStartSeconds > 0)) return null;
  if (typeof runIsOver === 'function' && runIsOver()) return null;
  const over = (typeof roundEnded !== 'undefined' && roundEnded) || (typeof roundInterval !== 'undefined' && !roundInterval);
  if (over) return ((typeof survivalActive === 'function') && survivalActive()) ? 'hold' : null;
  if ((typeof gameTimerPaused !== 'undefined' && gameTimerPaused) || (typeof pipeTimerPaused !== 'undefined' && pipeTimerPaused)) return 'hold';
  // A clock that never ends the level (untimed Stacked, a custom 'no limit') has no end
  // to play; Flow's quarter clock does (the review comes at 0:00), and so does a boss window.
  const flow = (typeof flowActive === 'function') && flowActive();
  const boss = (typeof bossActive !== 'undefined') && bossActive;
  if (!flow && !boss && typeof modeHasNoRoundClock === 'function' && modeHasNoRoundClock()) return null;
  return Math.max(0, roundSeconds);
}

function musicEdgeNoise(ctx) {
  if (_edgeNoise && _edgeNoise.sampleRate === ctx.sampleRate) return _edgeNoise;
  const n = Math.floor(ctx.sampleRate * 0.03), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (((typeof fxRandom === "function") ? fxRandom() : Math.random()) * 2 - 1) * Math.pow(1 - i / n, 3);
  return (_edgeNoise = b);
}

// One tick (k even) or tock (odd) at audio time t, level v; into `out`.
function musicEdgeTickAt(ctx, out, t, k, v) {
  const tock = k % 2 === 1;
  const src = ctx.createBufferSource(); src.buffer = musicEdgeNoise(ctx);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = tock ? 2100 : 3200; bp.Q.value = 2.5;
  const g = ctx.createGain(); g.gain.value = v * 3;
  src.connect(bp); bp.connect(g); g.connect(out); src.start(t); src.stop(t + 0.04);
  // A small wooden body under the click.
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = tock ? 820 : 1150;
  const og = ctx.createGain(); og.gain.setValueAtTime(0, t);
  og.gain.linearRampToValueAtTime(v * 0.9, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.06);
}

function musicEdgeTick() {
  if (!_spk || !_spk.wob) return;
  const ctx = _spk.ctx, now = ctx.currentTime, c = MUSIC_EDGE, mode = musicEdgeMode();
  const left = musicEdgeLeft();
  // Warble depth.
  let w = _edgeW;
  if (mode === 'off' || left === null) w = 0;
  else if (left !== 'hold') w = Math.pow(Math.max(0, Math.min(1, 1 - left / c.warbleFrom)), c.curve);
  if (Math.abs(w - _edgeW) > 0.001 || (w === 0 && _edgeW !== 0)) {
    _edgeW = w;
    for (const l of _spk.wob.lfos) l.g.gain.setTargetAtTime(w * l.ms / 1000, now, 0.25);
  }
  // Ticks.
  const tick = mode === 'both' && typeof left === 'number' && left <= c.tickFrom && left > 0 &&
               musicIsPlaying() && ctx.state === 'running';
  if (!tick) {
    if (_edgeTicking) { _edgeTicking = false; _spk.ticks.gain.setTargetAtTime(0, now, 0.01); }
    return;
  }
  if (!_edgeTicking) {
    _edgeTicking = true; _edgeNext = now + 0.05; _edgeN = 0;
    _spk.ticks.gain.cancelScheduledValues(now); _spk.ticks.gain.setValueAtTime(1, now);
  }
  const period = left <= c.fastFrom ? 0.5 : 1;
  const v = c.tickVol + (c.tickVolEnd - c.tickVol) * (1 - left / c.tickFrom);
  if (_edgeNext < now) _edgeNext = now + 0.02;
  while (_edgeNext < now + c.lookahead) {
    musicEdgeTickAt(ctx, _spk.ticks, _edgeNext, _edgeN++, v);
    _edgeNext += period;
  }
}
setInterval(musicEdgeTick, MUSIC_CLOCK_TICK);
