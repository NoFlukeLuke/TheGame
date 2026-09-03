// ══════════════════════════════════════════════
// SETTINGS (r155) - the player-facing options screen
// ══════════════════════════════════════════════
// Distinct from the DEV panel (which stays the developer/debug surface). Every
// option is one entry in SETTINGS_DEF, so adding a new one is a single line:
//   { id, label, hint, type: 'toggle'|'slider'|'select', default, apply(v) }
// Values persist in localStorage and are re-applied on load.

const SETTINGS_KEY = 'lethe.settings.v1';
let SETTINGS = {};

const SETTINGS_DEF = [
  // ── Audio ──
  // Three volumes, not one: master scales both buses, and music/effects set the
  // balance between them. Every sound multiplies by sfxVolume(), music by
  // musicVolume(); both fold in `muted` so the toggle needs no separate wiring.
  { group: 'Audio', id: 'muted', label: 'Mute all sound', hint: 'Silences music and effects.',
    type: 'toggle', default: false },
  { group: 'Audio', id: 'volume', label: 'Master volume', hint: 'Scales everything below.',
    type: 'slider', min: 0, max: 100, step: 5, default: 100, unit: '%' },
  { group: 'Audio', id: 'musicVolume', label: 'Music', hint: 'Background tracks from assets/music/.',
    type: 'slider', min: 0, max: 100, step: 5, default: 60, unit: '%',
    apply: () => { if (typeof applyMusicVolume === 'function') applyMusicVolume(); } },
  { group: 'Audio', id: 'sfxVolumePct', label: 'Sound effects', hint: 'Cards, coins, scoring, bosses.',
    type: 'slider', min: 0, max: 100, step: 5, default: 100, unit: '%' },
  // Sound source (r186). Files beat packs beat classic - see the resolution order
  // in js/audio-assets.js. Both rows are read there rather than applied from here,
  // so there is no `apply` to keep in step.
  { group: 'Audio', id: 'useSoundFiles', label: 'Use my sound files',
    hint: 'Play the files in assets/sfx/ where one is listed for a sound. Off means every sound is generated in code.',
    type: 'toggle', default: true },
  { group: 'Audio', id: 'sfxPack', label: 'Sound pack',
    hint: 'Which coded sounds to use - for every effect, and for anything a file does not cover.',
    type: 'select', default: 'classic',
    options: (typeof SFX_PACK_LIST !== 'undefined')
      ? SFX_PACK_LIST.map(([id, name]) => [id, name])
      : [['classic', 'Classic']] },
  // The two boards live in their own pop-ups (js/audio-menu.js): a flat settings
  // list cannot hold 30 auditionable sounds without becoming the whole screen.
  { group: 'Audio', id: 'audioBoards', type: 'action', label: '', hint: '',
    buttons: () => [
      { label: 'Sound effects', fn: 'openSfxBoard()' },
      { label: 'Music playlist', fn: 'openPlaylist()' },
    ] },

  // ── Motion ──
  // NOTE: dncSpeed is `isGoalHand ? 1 : DANCE_CFG.norm`, so this deliberately does
  // not rush the goal-clearing finale - only ordinary scoring hands.
  { group: 'Motion', id: 'animSpeed', label: 'Scoring speed', hint: 'How fast ordinary hands score. The goal-clearing finale always plays in full.',
    type: 'select', default: '1', options: [['0.75','Relaxed'], ['1','Normal'], ['1.5','Brisk'], ['2','Rapid']],
    apply: v => { if (typeof DANCE_CFG !== 'undefined') DANCE_CFG.norm = parseFloat(v); } },
  { group: 'Motion', id: 'reducedMotion', label: 'Reduced motion', hint: 'Cuts drifting, shaking and idle flourishes. Scoring still animates.',
    type: 'toggle', default: false,
    apply: v => document.body.classList.toggle('reduced-motion', !!v) },
  { group: 'Motion', id: 'noShake', label: 'No screen shake', hint: 'Disables impact shake on big scores and boss hits.',
    type: 'toggle', default: false,
    apply: v => document.body.classList.toggle('no-shake', !!v) },

  // ── Display ──
  { group: 'Display', id: 'bigText', label: 'Larger text', hint: 'Increases UI text size across panels and pop-ups.',
    type: 'toggle', default: false,
    apply: v => document.body.classList.toggle('big-text', !!v) },
  { group: 'Display', id: 'highContrast', label: 'High-contrast cards', hint: 'Stronger card borders and darker pips for legibility.',
    type: 'toggle', default: false,
    apply: v => document.body.classList.toggle('high-contrast', !!v) },
  // The room the cabinet sits in on the menu (js/camera.js + css/room.css).
  { group: 'Display', id: 'roomStyle', label: 'Office', hint: 'The room around the cabinet on the menu. Grimy is dimmer and dirtier; clean is the lit version.',
    type: 'select', default: 'grimy', options: [['grimy','Grimy'], ['clean','Clean']],
    apply: v => { if (typeof camSetRoomStyle === 'function') camSetRoomStyle(v); } },
  { group: 'Display', id: 'introReplay', type: 'action',
    label: 'Intro animation', hint: 'Watch the camera pull back to the desk and zoom in on the screen.',
    buttons: () => [{ label: 'Play intro', fn: 'camPlayIntro()' }] },

  // ── Run ── save / resume (see js/save.js). `action` rows are buttons, not a
  // stored preference, so they are skipped by loadSettings/resetSettings.
  // No label or hint: the group title says RUN and the buttons say the rest.
  { group: 'Run', id: 'runSave', type: 'action', label: '', hint: '',
    buttons: () => {
      const has = (typeof hasSavedRun === 'function') && hasSavedRun();
      const inRun = (typeof runCheckpoint !== 'undefined') && !!runCheckpoint;
      const rows = [{ label: inRun ? `Save Run (Round ${runCheckpoint.meta.level})` : 'Save Run',
                      fn: 'settingsSaveRun()', primary: true, disabled: !inRun }];
      if (has) rows.push({ label: 'Resume', fn: 'settingsResumeRun()' },
                         { label: 'Delete', fn: 'settingsDeleteSave()' });
      return rows;
    } },
];

// Effects volume used by the audio engine (0 when muted). Master x effects.
// Every playTone / playNoise / sample multiplies its gain by this, so it is the
// single choke point for both the mute toggle and the two sliders.
function sfxVolume() {
  if (SETTINGS.muted) return 0;
  const master = (typeof SETTINGS.volume === 'number' ? SETTINGS.volume : 100) / 100;
  const sfx = (typeof SETTINGS.sfxVolumePct === 'number' ? SETTINGS.sfxVolumePct : 100) / 100;
  return master * sfx;
}

function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { saved = {}; }
  SETTINGS = {};
  SETTINGS_DEF.forEach(d => { if (d.type === 'action') return; SETTINGS[d.id] = (saved[d.id] !== undefined) ? saved[d.id] : d.default; });
  applyAllSettings();
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) {}
}

function applyAllSettings() {
  SETTINGS_DEF.forEach(d => { if (d.apply) { try { d.apply(SETTINGS[d.id]); } catch (e) {} } });
}

function setSetting(id, value) {
  const def = SETTINGS_DEF.find(d => d.id === id);
  if (!def) return;
  SETTINGS[id] = value;
  if (def.apply) { try { def.apply(value); } catch (e) {} }
  saveSettings();
  renderSettings();
}

// ── UI ──
function settingsOverlay() {
  let el = document.getElementById('settings-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'settings-overlay';
    el.innerHTML = `<div id="settings-panel">
        <div id="settings-head">
          <div class="set-brand"><span class="rec-dot"></span>SETTINGS</div>
          <button id="set-close" onclick="closeSettings()">✕</button>
        </div>
        <div id="settings-body"></div>
        <div id="settings-foot">
          <button class="set-reset" onclick="resetSettings()">Restore defaults</button>
        </div>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

let settingsFromMenu = false;
function openSettings(fromMenu = false) {
  settingsFromMenu = fromMenu;
  if (fromMenu) document.getElementById('main-menu-overlay')?.classList.remove('show');
  const el = settingsOverlay();   // must exist BEFORE renderSettings looks up #settings-body
  renderSettings();
  el.classList.add('show');
}

function closeSettings() {
  settingsOverlay().classList.remove('show');
  if (settingsFromMenu) {
    settingsFromMenu = false;
    document.getElementById('main-menu-overlay')?.classList.add('show');
  }
}

function resetSettings() {
  SETTINGS_DEF.forEach(d => { if (d.type !== 'action') SETTINGS[d.id] = d.default; });
  applyAllSettings();
  saveSettings();
  renderSettings();
}

function renderSettings() {
  const body = document.getElementById('settings-body');
  if (!body) return;
  const groups = [];
  SETTINGS_DEF.forEach(d => {
    let g = groups.find(x => x.name === d.group);
    if (!g) groups.push(g = { name: d.group, items: [] });
    g.items.push(d);
  });
  body.innerHTML = groups.map(g => `
    <div class="set-group-title">${g.name}</div>
    ${g.items.map(d => settingsRowHTML(d)).join('')}
  `).join('') + `<div id="settings-run-msg"></div>`;
}

// label/hint may be functions so a row can reflect live state (the Run row
// reports what is currently saved).
function _setText(x) { try { return (typeof x === 'function') ? x() : (x || ''); } catch (e) { return ''; } }

function settingsRowHTML(d) {
  const v = SETTINGS[d.id];
  let control = '';
  if (d.type === 'action') {
    let btns = [];
    try { btns = (typeof d.buttons === 'function') ? d.buttons() : (d.buttons || []); } catch (e) { btns = []; }
    control = `<span class="set-actions">` + btns.map(b =>
        `<button class="set-action-b${b.primary ? ' primary' : ''}" ${b.disabled ? 'disabled' : ''} onclick="${b.fn}">${b.label}</button>`
      ).join('') + `</span>`;
  } else if (d.type === 'toggle') {
    control = `<button class="set-switch${v ? ' on' : ''}" onclick="setSetting('${d.id}', ${!v})">
        <span class="set-knob"></span></button>`;
  } else if (d.type === 'slider') {
    control = `<span class="set-slider-wrap">
        <input type="range" min="${d.min}" max="${d.max}" step="${d.step}" value="${v}"
               oninput="setSettingLive('${d.id}', this.value)">
        <span class="set-slider-v">${v}${d.unit || ''}</span></span>`;
  } else if (d.type === 'select') {
    control = `<span class="set-seg">` + d.options.map(([val, lbl]) =>
        `<button class="set-seg-b${String(v) === String(val) ? ' on' : ''}" onclick="setSetting('${d.id}', '${val}')">${lbl}</button>`
      ).join('') + `</span>`;
  }
  const lab = _setText(d.label), hint = _setText(d.hint);
  const text = (lab || hint)
    ? `<span class="set-row-text"><span class="set-label">${lab}</span><span class="set-hint">${hint}</span></span>`
    : '';
  return `<div class="set-row${d.type === 'action' ? ' set-row-action' : ''}${text ? '' : ' set-row-bare'}">
      ${text}${control}</div>`;
}

// Slider needs live feedback without re-rendering (which would drop focus).
function setSettingLive(id, raw) {
  const def = SETTINGS_DEF.find(d => d.id === id);
  if (!def) return;
  const value = Number(raw);
  SETTINGS[id] = value;
  if (def.apply) { try { def.apply(value); } catch (e) {} }
  const row = document.querySelector(`input[oninput*="'${id}'"]`)?.parentElement?.querySelector('.set-slider-v');
  if (row) row.textContent = value + (def.unit || '');
  saveSettings();
}

loadSettings();


// ── Run save / resume, surfaced in Settings (implementation in js/save.js) ──
function settingsRunMsg(text, ok) {
  const el = document.getElementById('settings-run-msg');
  if (el) { el.textContent = text || ''; el.style.color = ok === false ? 'var(--red)' : 'var(--gold)'; }
}

function settingsSaveRun() {
  if (typeof saveRunToStorage !== 'function') return;
  const r = saveRunToStorage();
  renderSettings();
  settingsRunMsg(r.msg, r.ok);
  if (typeof updateContinueBtn === 'function') updateContinueBtn();
}

function settingsDeleteSave() {
  if (typeof clearSavedRun !== 'function') return;
  clearSavedRun();
  renderSettings();
  settingsRunMsg('Save deleted.');
}

function settingsResumeRun() {
  if (typeof hasSavedRun !== 'function' || !hasSavedRun()) return;
  closeSettings();
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  resumeSavedRun();
}
