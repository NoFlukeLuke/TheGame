// ══════════════════════════════════════════════
// AUDIO MENUS (r179) - the sound board and the music playlist
// ══════════════════════════════════════════════
// Two pop-ups opened from Settings -> Audio. Both are body-level, OUTSIDE
// #cabinet, for the usual reason: the cabinet applies CSS `zoom`, which would
// multiply the fixed positioning of anything inside it.
//
// They reuse the settings screen's switch / button classes so there is one visual
// language for options, and one place to restyle them.

function _audioOverlay(id, title, bodyId, footHTML) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'audio-overlay';
    el.innerHTML = `<div class="audio-panel">
        <div class="audio-head">
          <div class="set-brand"><span class="rec-dot"></span>${title}</div>
          <button class="audio-close" onclick="closeAudioMenus()">&#10005;</button>
        </div>
        <div class="audio-body" id="${bodyId}"></div>
        <div class="audio-foot">${footHTML}</div>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

function closeAudioMenus() {
  document.querySelectorAll('.audio-overlay').forEach(el => el.classList.remove('show'));
}

// ══ SOUND EFFECTS BOARD ══
function openSfxBoard() {
  const el = _audioOverlay('sfxboard-overlay', 'SOUND EFFECTS', 'sfxboard-body',
    `<button class="set-reset" onclick="sfxSetAll(true)">All on</button>
     <button class="set-reset" onclick="sfxSetAll(false)">All off</button>`);
  renderSfxBoard();
  el.classList.add('show');
}

function sfxSetAll(on) {
  SFX_CATALOG.forEach(e => { if (on) delete AUDIO_PREFS.sfxOff[e.id]; else AUDIO_PREFS.sfxOff[e.id] = true; });
  saveAudioPrefs();
  renderSfxBoard();
}

function toggleSfx(id) { setSfxOn(id, !sfxIsOn(id)); renderSfxBoard(); }

// The board doubles as the A/B surface for the packs: switching source at the top
// and pressing play on a row is the whole comparison, without a trip back to
// Settings between each one.
function sfxBoardSetPack(id) { setSetting('sfxPack', id); renderSfxBoard(); }
function sfxBoardToggleFiles() { setSetting('useSoundFiles', !sfxUseFiles()); renderSfxBoard(); }

const _SRC_LABEL = { file: 'FILE', classic: 'CODED', onebit: '1-BIT', slot: 'ARCADE' };

function renderSfxBoard() {
  const body = document.getElementById('sfxboard-body');
  if (!body) return;
  const listed = SFX_CATALOG.filter(e => sfxUsesFile(e.id)).length;
  const live = {};
  SFX_CATALOG.forEach(e => { const s = sfxSourceFor(e.id); live[s] = (live[s] || 0) + 1; });
  const groups = [];
  SFX_CATALOG.forEach(e => {
    let g = groups.find(x => x.name === e.group);
    if (!g) groups.push(g = { name: e.group, items: [] });
    g.items.push(e);
  });

  const packs = (typeof SFX_PACK_LIST !== 'undefined') ? SFX_PACK_LIST : [['classic', 'Classic', '']];
  const cur = sfxPackId();
  const files = sfxUseFiles();
  const head = `
    <div class="audio-source">
      <div class="audio-source-row">
        <span class="audio-source-lab">Sound pack</span>
        <span class="set-seg">${packs.map(([id, name]) =>
          `<button class="set-seg-b${cur === id ? ' on' : ''}" onclick="sfxBoardSetPack('${id}')">${name}</button>`).join('')}</span>
      </div>
      <div class="audio-source-desc">${(packs.find(p => p[0] === cur) || [])[2] || ''}</div>
      <div class="audio-source-row">
        <span class="audio-source-lab">Use my sound files</span>
        <button class="set-switch${files ? ' on' : ''}" onclick="sfxBoardToggleFiles()"><span class="set-knob"></span></button>
      </div>
      <div class="audio-source-desc">${listed
        ? `${listed} of ${SFX_CATALOG.length} sounds have a file in <code>assets/sfx/</code>. Files win where they exist; everything else uses the pack.`
        : `No files listed yet. Put one in <code>assets/sfx/</code> and name its id in <code>js/data/audio-manifest.js</code>.`}</div>
    </div>
    <div class="audio-note">
      Press <b>&#9654;</b> to hear exactly what a sound plays right now. Switching one off silences it in game.
      Live: ${Object.keys(live).map(k => `<b>${live[k]}</b> ${_SRC_LABEL[k] || k}`).join(' &middot; ')}.
    </div>`;

  body.innerHTML = head + groups.map(g => `
    <div class="set-group-title">${g.name}</div>
    ${g.items.map(e => {
      const on = sfxIsOn(e.id);
      const src = sfxSourceFor(e.id);
      return `<div class="audio-row${on ? '' : ' off'}">
        <button class="audio-play" onclick="sfxAudition('${e.id}')" title="Play">&#9654;</button>
        <span class="audio-row-text">
          <span class="audio-row-label">${e.label}</span>
          <span class="audio-row-sub"><code>${e.id}</code>${e.note ? ' &middot; ' + e.note : ''}</span>
        </span>
        <span class="audio-src src-${src}">${_SRC_LABEL[src] || src}</span>
        <button class="set-switch${on ? ' on' : ''}" onclick="toggleSfx('${e.id}')"><span class="set-knob"></span></button>
      </div>`;
    }).join('')}
  `).join('');
}

// ══ MUSIC PLAYLIST ══
function openPlaylist() {
  const el = _audioOverlay('playlist-overlay', 'MUSIC', 'playlist-body',
    `<div class="audio-transport">
       <button class="audio-tb" onclick="musicPrev()" title="Previous">&#9198;</button>
       <button class="audio-tb big" id="music-playpause" onclick="musicToggle()" title="Play / pause">&#9654;</button>
       <button class="audio-tb" onclick="musicNext()" title="Next">&#9197;</button>
       <button class="audio-tb wide" id="music-shuffle" onclick="setMusicShuffle(!AUDIO_PREFS.shuffle)">SHUFFLE</button>
     </div>`);
  renderPlaylist();
  el.classList.add('show');
}

function toggleTrack(id) { setMusicTrackOn(id, !musicTrackOn(id)); renderPlaylist(); }

function renderPlaylist() {
  const body = document.getElementById('playlist-body');
  if (!body) return;
  const tracks = musicAllTracks();

  const pp = document.getElementById('music-playpause');
  if (pp) pp.innerHTML = musicIsPlaying() ? '&#10074;&#10074;' : '&#9654;';
  const sh = document.getElementById('music-shuffle');
  if (sh) sh.classList.toggle('on', !!AUDIO_PREFS.shuffle);

  if (!tracks.length) {
    body.innerHTML = `<div class="audio-note">
        <b>No music yet.</b> The game ships without any, so this list is empty until you add a file.
        <ol class="audio-steps">
          <li>Put an MP3 in <code>assets/music/</code> in the repository.</li>
          <li>Add one line to the <code>music</code> list in <code>js/data/audio-manifest.js</code>:<br>
              <code>{ id: 'lobby', title: 'Lobby Hum', file: 'assets/music/lobby-hum.mp3', scene: 'menu' },</code></li>
          <li>Reload. It appears here, and can be switched on or off.</li>
        </ol>
        <code>scene</code> is where it plays: <b>menu</b>, <b>game</b>, or <b>any</b>.
      </div>`;
    return;
  }

  const on = !!AUDIO_PREFS.musicOn;
  body.innerHTML = `
    <div class="audio-row">
      <span class="audio-row-text">
        <span class="audio-row-label">Play music</span>
        <span class="audio-row-sub">Off silences every track without forgetting your picks.</span>
      </span>
      <button class="set-switch${on ? ' on' : ''}" onclick="setMusicOn(${!on}); renderPlaylist();"><span class="set-knob"></span></button>
    </div>
    <div class="set-group-title">Tracks</div>` +
    tracks.map((t, i) => {
      const en = musicTrackOn(t.id);
      const cur = (i === _musicIndex);
      return `<div class="audio-row${en ? '' : ' off'}${cur ? ' playing' : ''}">
        <button class="audio-play" onclick="musicPlayTrack('${t.id}')" title="Play now">&#9654;</button>
        <span class="audio-row-text">
          <span class="audio-row-label">${t.title || t.id}${cur ? ' <span class="audio-nowplaying">NOW PLAYING</span>' : ''}</span>
          <span class="audio-row-sub">${t.artist ? t.artist + ' &middot; ' : ''}${(t.scene || 'any').toUpperCase()}</span>
        </span>
        <button class="set-switch${en ? ' on' : ''}" onclick="toggleTrack('${t.id}')"><span class="set-knob"></span></button>
      </div>`;
    }).join('');
}
