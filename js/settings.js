// ══════════════════════════════════════════════
// SETTINGS (r155) — the player-facing options screen
// ══════════════════════════════════════════════
// Distinct from the DEV panel (which stays the developer/debug surface). Every
// option is one entry in SETTINGS_DEF, so adding a new one is a single line:
//   { id, label, hint, type: 'toggle'|'slider'|'select', default, apply(v) }
// Values persist in localStorage and are re-applied on load.

const SETTINGS_KEY = 'lethe.settings.v1';
let SETTINGS = {};

const SETTINGS_DEF = [
  // ── Audio ──
  { group: 'Audio', id: 'muted', label: 'Mute all sound', hint: 'Silences every effect.',
    type: 'toggle', default: false },
  { group: 'Audio', id: 'volume', label: 'Master volume', hint: 'Applies to all sound effects.',
    type: 'slider', min: 0, max: 100, step: 5, default: 100, unit: '%' },

  // ── Motion ──
  { group: 'Motion', id: 'animSpeed', label: 'Animation speed', hint: 'Scales the scoring dance and transitions. Higher is faster.',
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
];

// Master volume used by the audio engine (0 when muted).
function sfxVolume() {
  if (SETTINGS.muted) return 0;
  const v = SETTINGS.volume;
  return (typeof v === 'number' ? v : 100) / 100;
}

function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { saved = {}; }
  SETTINGS = {};
  SETTINGS_DEF.forEach(d => { SETTINGS[d.id] = (saved[d.id] !== undefined) ? saved[d.id] : d.default; });
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
  SETTINGS_DEF.forEach(d => { SETTINGS[d.id] = d.default; });
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
  `).join('');
}

function settingsRowHTML(d) {
  const v = SETTINGS[d.id];
  let control = '';
  if (d.type === 'toggle') {
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
  return `<div class="set-row">
      <span class="set-row-text"><span class="set-label">${d.label}</span><span class="set-hint">${d.hint || ''}</span></span>
      ${control}</div>`;
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
