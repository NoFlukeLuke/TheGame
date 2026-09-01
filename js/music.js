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

function musicEl() {
  if (!_musicEl) {
    _musicEl = new Audio();
    _musicEl.preload = 'none';
    _musicEl.addEventListener('ended', () => musicNext());
    _musicEl.addEventListener('error', () => {
      const t = musicTrackAt(_musicIndex);
      if (t) console.warn('[music] could not play', t.file, '- skipping.');
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

function musicTrackOn(id) { return !AUDIO_PREFS.trackOff[id]; }
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
    return musicTrackOn(t.id) && (scene === 'any' || scene === _musicScene);
  });
}

function musicVolume() {
  if (SETTINGS.muted) return 0;
  const master = (typeof SETTINGS.volume === 'number' ? SETTINGS.volume : 100) / 100;
  const mus = (typeof SETTINGS.musicVolume === 'number' ? SETTINGS.musicVolume : 60) / 100;
  return master * mus;
}
function applyMusicVolume() { if (_musicEl) _musicEl.volume = Math.max(0, Math.min(1, musicVolume())); }

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
