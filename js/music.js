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
    return musicTrackOn(t.id) && !_musicDeadIds.has(t.id) && (scene === 'any' || scene === _musicScene);
  });
}

function musicVolume() {
  if (SETTINGS.muted) return 0;
  const master = (typeof SETTINGS.volume === 'number' ? SETTINGS.volume : 100) / 100;
  const mus = (typeof SETTINGS.musicVolume === 'number' ? SETTINGS.musicVolume : 60) / 100;
  return master * mus;
}
function applyMusicVolume() { if (_musicEl) _musicEl.volume = Math.max(0, Math.min(1, musicVolume())); }

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
  applyMusicVolume();
  const p = musicEl().play();
  if (p && p.catch) p.catch(() => { /* autoplay blocked - armMusicAutostart retries on the next gesture */ });
  if (typeof renderPlaylist === 'function') renderPlaylist();
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

// The menu and a run can have different tracks. Changing scene only interrupts
// the current track if it does not belong in the new scene.
function musicSetScene(scene) {
  if (_musicScene === scene) return;
  _musicScene = scene;
  const cur = musicTrackAt(_musicIndex);
  const ok = cur && ((cur.scene || 'any') === 'any' || (cur.scene || 'any') === scene);
  if (!ok) musicNext();
}

// ── Autostart on the first interaction ───────────────────────────────────────
// One listener, removed once it has fired. It also unlocks the AudioContext and
// warms the sound-effect samples, so the first coin sound is not a download.
let musicAutoStarted = false;
function armMusicAutostart() {
  const go = () => {
    if (musicAutoStarted) return;
    musicAutoStarted = true;
    window.removeEventListener('pointerdown', go, true);
    window.removeEventListener('keydown', go, true);
    try { getAudioCtx(); } catch (e) {}
    try { prewarmSfxSamples(); } catch (e) {}
    if (AUDIO_PREFS.musicOn && musicPlayableIndexes().length) musicPlay();
  };
  window.addEventListener('pointerdown', go, true);
  window.addEventListener('keydown', go, true);
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
