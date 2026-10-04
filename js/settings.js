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
  // ── Help ── (r280) FIRST on purpose: a player who opens Settings looking for
  // an explanation should not have to scroll past the volume sliders to find one.
  // The handbook is js/info-hub.js; the tips are js/insights.js. `tips` is a
  // plain stored setting and NOTHING ELSE PERSISTS IT - insightsOn() reads this
  // row live. A module keeping its own copy of a settings-backed flag is the
  // r244 payout-pick trap: loadSettings applies every row's stored value OR its
  // default at boot, so a second store gets stamped back over on the next load.
  { group: 'Help', id: 'handbook', type: 'action',
    label: 'Handbook', hint: 'How everything works, in more detail than the game stops to explain.',
    buttons: () => [{ label: 'Open the handbook', fn: 'openInfoHubFromSettings()', primary: true }] },
  // r471: everything the log saw, on the clipboard (js/bug-report.js).
  { group: 'Help', id: 'bugReport', type: 'action',
    label: 'Bug report', hint: 'Copies a record of what just happened in the game. Paste it into a message to the developer.',
    buttons: () => [{ label: 'Copy bug report', fn: 'settingsCopyBugReport(this)' }] },
  { group: 'Help', id: 'tips', label: 'Tips',
    hint: 'A one-line note the first time something new turns up. Each one shows once, ever, and never blocks play.',
    type: 'toggle', default: true },
  { group: 'Help', id: 'walkthrough', label: 'First-run walkthrough',
    hint: 'The first time you play a mode, it explains itself as you go. Each mode gets one.',
    type: 'toggle', default: true },
  { group: 'Help', id: 'walkthroughReset', type: 'action', label: '', hint: '',
    buttons: () => [{ label: 'Play the walkthroughs again',
                      fn: 'resetWalkthroughs(); renderSettings();',
                      disabled: (typeof modesStarted === 'undefined') || modesStarted.size === 0 }] },
  { group: 'Help', id: 'tipsReset', type: 'action', label: '', hint: '',
    buttons: () => {
      const n = (typeof insightsSeenCount === 'function') ? insightsSeenCount() : 0;
      return [{ label: n ? `Show all tips again (${n} seen)` : 'Show all tips again',
                fn: 'resetInsights(); renderSettings();', disabled: !n }];
    } },

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
  // OFF by default since r234. Files beat packs, and the six ids listed in
  // AUDIO_MANIFEST are the most frequent board sounds in the game, so leaving this
  // on meant a pack was never heard where it is heard most. The files are still
  // there and this switch still brings them back.
  { group: 'Audio', id: 'useSoundFiles', label: 'Use my sound files',
    hint: 'Play the files in assets/sfx/ where one is listed for a sound. Off means every sound is generated in code.',
    type: 'toggle', default: false },
  { group: 'Audio', id: 'sfxPack', label: 'Sound pack',
    hint: 'Which coded sounds to use - for every effect, and for anything a file does not cover.',
    type: 'select',
    default: (typeof SFX_PACK_DEFAULT !== 'undefined') ? SFX_PACK_DEFAULT : 'classic',
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
  // A slider rather than four presets (r197): now that every Trick pays out at its
  // own moment, a loaded tray has many more beats than a bare one, and how fast a
  // player wants to watch them is personal and changes as a run goes on. 1 is as
  // authored; 16 is "I know what these do, get on with it". Each beat also runs 5%
  // quicker than the last within a hand (DANCE_CFG.beatAccel), so the ramp handles
  // long hands on its own and this stays a preference rather than a chore.
  { group: 'Motion', id: 'animSpeed', label: 'Scoring speed',
    hint: 'How fast hands tally. Higher is faster. Interrupting a hand still rushes it regardless. Default 2x.',
    type: 'slider', min: 0.5, max: 16, step: 0.5, default: 2, unit: 'x',
    apply: v => { const n = parseFloat(v); if (typeof DANCE_CFG !== 'undefined' && isFinite(n) && n > 0) DANCE_CFG.norm = n; } },
  { group: 'Motion', id: 'reducedMotion', label: 'Reduced motion', hint: 'Cuts drifting, shaking and idle flourishes. Scoring still animates.',
    type: 'toggle', default: false,
    apply: v => document.body.classList.toggle('reduced-motion', !!v) },
  { group: 'Motion', id: 'noShake', label: 'No screen shake', hint: 'Disables impact shake on big scores and boss hits.',
    type: 'toggle', default: false,
    apply: v => document.body.classList.toggle('no-shake', !!v) },

  // ── Skip ── (r380) Owner: "add a setting in settings to skip transitions.
  // maybe have a whole tab for things you can skip. scoring animations,
  // transitions, payouts, think through other things like this that take time
  // without mechanical progression." Every row is read LIVE through skipOn(),
  // at the one place that thing starts, so none of them needs an apply.
  // Nothing here changes a number - a skipped animation lands exactly what the
  // full one would have.
  { group: 'Skip', id: 'skipTransitions', label: 'Screen transitions',
    hint: 'The beat and the card explosion between reward screens, the 3-2-1 back into a Flow level, and the channel flicker.',
    type: 'toggle', default: false },
  { group: 'Skip', id: 'skipScoring', label: 'Scoring animations',
    hint: 'Every hand tallies at skip speed. The same numbers land in the same order.',
    type: 'toggle', default: false },
  { group: 'Skip', id: 'skipFinale', label: 'Round-winning finale',
    hint: 'The hand that clears the goal skips its jitter and explosion, as if you pressed SKIP.',
    type: 'toggle', default: false },
  { group: 'Skip', id: 'skipPayout', label: 'Payout count-up',
    hint: 'The end-of-round credits land at once instead of counting up.',
    type: 'toggle', default: false },
  { group: 'Skip', id: 'skipRewardCount', label: 'Reward count-up',
    hint: 'Flow: the GOAL CLEARED card that counts how many reward screens you earned. The count still shows as a toast.',
    type: 'toggle', default: false },
  { group: 'Skip', id: 'skipIntro', label: 'Opening camera move',
    hint: 'The slow push in on the office monitor when the game loads.',
    type: 'toggle', default: false },

  { group: 'Motion', id: 'payoutPick', label: 'Card pick after payout',
    hint: 'EXPERIMENTAL. After the payout the board comes back and you boost, copy or remove one card. Off by default.',
    type: 'toggle', default: false,
    apply: v => { if (typeof setPayoutPickEnabled === 'function') setPayoutPickEnabled(!!v); } },

  // ── Controls ── (r409)
  { group: 'Controls', id: 'controlMode', label: 'Playing a hand',
    hint: 'Tap and PLAY: tap cards to select them, then press PLAY. Drag to play: press on a card, drag across the others and let go to play them; to discard this way, tap DISCARD first, then drag. With a mouse, right-click and drag to discard instead, in either mode.',
    type: 'select', default: 'tap', options: [['tap','Tap and PLAY'], ['drag','Drag to play']],
    apply: v => { if (typeof setControlMode === 'function') setControlMode(v); } },
  { group: 'Controls', id: 'ctlDragGrace', label: 'After a drag',
    hint: 'Only with Drag to play. After you let go, the hand waits this long before it plays. Tap another card during the wait to add it.',
    type: 'select', default: '0', options: [['0','Play at once'], ['500','Wait 0.5s'], ['1000','Wait 1s'], ['1500','Wait 1.5s']] },
  { group: 'Controls', id: 'ctlDragBack', label: 'Drag back to unselect',
    hint: 'While dragging, move back onto the card you just left to unselect the newest card. A T shape crosses one card twice, so drag the straight part, then tap the last card. With Drag to play, that tap only works if After a drag is set to a wait.',
    type: 'toggle', default: false },
  { group: 'Controls', id: 'ctlDoubleTapPlay', label: 'Double-tap to play',
    hint: 'Tap a selected card twice quickly to play your selection. Double-tapping a card that is not selected still picks it up to swap, as normal.',
    type: 'toggle', default: false },
  { group: 'Controls', id: 'ctlAutoPlay', label: 'Auto-play',
    hint: 'A selection that makes a hand plays by itself after this long. Off: hands play only when you press PLAY, or through Drag to play or Double-tap to play.',
    type: 'select', default: '2000', options: [['0','Off'], ['1000','1s'], ['2000','2s'], ['4000','4s']] },
  { group: 'Controls', id: 'ctlWheelSwap', label: 'Wheel to swap',
    hint: 'Select two cards side by side, then turn the mouse wheel once over the board to swap them. Uses a swap, same as pressing SWAP.',
    type: 'toggle', default: true },
  { group: 'Controls', id: 'ctlConfirmDiscard', label: 'Confirm discards',
    hint: 'Every discard asks first. The cards stay selected and DISCARD flashes; discard again within 3 seconds to confirm.',
    type: 'toggle', default: false },
  { group: 'Controls', id: 'ctlIdleHint', label: 'Idle hint',
    hint: 'If you go 20 seconds without playing or selecting anything, a faint shine passes over cards that make a hand.',
    type: 'toggle', default: true },
  { group: 'Controls', id: 'ctlHaptics', label: 'Vibration',
    hint: 'Your phone buzzes when a move is not allowed, and with Idle hint. Android phones only.',
    type: 'toggle', default: true },
  { group: 'Controls', id: 'ctlLeftHanded', label: 'Left-handed',
    hint: 'On a phone held upright, moves SWAP, DISCARD and PLAY to the left side of the board.',
    type: 'toggle', default: false,
    apply: v => { if (typeof ctlSetLeftHanded === 'function') ctlSetLeftHanded(v); } },
  { group: 'Keys', id: 'keysInfo', type: 'action', label: 'Rebinding',
    hint: 'Click a key, then press the new one. Backspace removes the key. If the new key was already used, the other action loses it.',
    buttons: () => [{ label: 'Restore keys', fn: 'keyBindsReset()' }] },
  ...KEY_ACTIONS.map(a => ({ group: 'Keys', id: 'key_' + a.id, label: a.label,
    hint: a.hint, type: 'keybind', default: a.def })),

  // ── Display ──
  { group: 'Display', id: 'bigText', label: 'Larger text', hint: 'Increases UI text size across panels and pop-ups.',
    type: 'toggle', default: false,
    apply: v => document.body.classList.toggle('big-text', !!v) },
  { group: 'Display', id: 'highContrast', label: 'High-contrast cards', hint: 'Stronger card borders and darker pips for legibility.',
    type: 'toggle', default: false,
    apply: v => document.body.classList.toggle('high-contrast', !!v) },
  // Which vocabulary the game speaks (js/labels.js). Entity NAMES never change -
  // "Cascade" is content, not vocabulary - but every keyword, stat label and
  // rarity word follows this. Descriptions are stored in the gamer wording and
  // translated on the way to the screen, so the toggle is live and needs no
  // second copy of anything.
  { group: 'Display', id: 'lexicon', label: 'Wording',
    hint: 'Gamer: pips, mult, score, goal, Tricks and Sleights. Corporate: work, skill, output, quota, Utilities and Vendors.',
    type: 'select', default: 'gamer', options: [['gamer','Gamer'], ['corporate','Corporate']],
    apply: v => { if (typeof setLexicon === 'function') setLexicon(v); } },
  // The room the cabinet sits in on the menu (js/camera.js + css/room.css).
  { group: 'Display', id: 'roomStyle', label: 'Office', hint: 'The room around the cabinet on the menu. Grimy is dimmer and dirtier; clean is the lit version.',
    type: 'select', default: 'grimy', options: [['grimy','Grimy'], ['clean','Clean']],
    apply: v => { if (typeof camSetRoomStyle === 'function') camSetRoomStyle(v); } },
  // THE BOARD PATTERN (r409, css/hypno.css). A faint wheel turning behind the
  // cards, inside the board and nowhere else. It replaces the r391 whole-screen
  // pattern (`hypno`) and the r408 opt-in board copy (`hypnoBoard`), and it is a
  // NEW id on purpose: a stored value beats a default, and saveSettings writes
  // every setting, so most players carry a stored `hypno` that says nothing about
  // what they chose. A fresh id means everyone starts from this default.
  // It is painted once and only TURNED, in small steps, which the compositor does
  // without repainting, over an area the size of the board (the whole-screen
  // version was four layers the size of the screen's diagonal). Measured in a
  // software-rendered browser: 60 fps on and off at phone size and at 1100x620,
  // 53-59 against 60 at 1440x820. With a graphics card it is nothing.
  { group: 'Display', id: 'printToasts', label: 'Printer notices',
    hint: 'Notices print on paper that drops from the top of the screen. Turn off for plain boxes.',
    type: 'toggle', default: true, apply: v => { printToastsOn = !!v; } },
  { group: 'Display', id: 'customCursor', label: 'Custom cursor',
    hint: 'A themed pointer instead of the system one. Turn off to use your normal cursor.',
    type: 'toggle', default: true,
    apply: v => document.documentElement.classList.toggle('os-cursor', !v) },
  { group: 'Display', id: 'boardPattern', label: 'Board pattern',
    hint: 'A faint turning pattern behind the cards on the board. Motion follows Reduced motion.',
    type: 'toggle', default: true,
    apply: v => document.body.classList.toggle('board-pattern', !!v) },
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
  // ...and the per-sound trim for whichever sound is being built right now
  // (js/audio-mixer.js). Folding it in HERE is what makes one table of gains
  // reach every voice - playTone, playNoise, the packs, samples and the two
  // hand-built sounds - without touching any of them.
  const trim = (typeof sfxIdGain === 'function') ? sfxIdGain() : 1;
  return master * sfx * trim;
}

// ONE VALUE, TWO STORES - the r244 payout-pick trap in a new shape. The wording
// lives in SETTINGS_KEY here AND in 'lethe.lexicon' over in js/labels.js, and
// this file loads second, so THIS is the copy that wins: applyAllSettings calls
// setLexicon, which writes labels.js's key from ours. Flipping the two defaults
// to 'gamer' therefore moves nobody who has already played - their stored
// 'corporate' beats both - so the old default has to be cleared out once.
//
// It clears a stored 'corporate' ONLY. A player who deliberately picks corporate
// after this runs keeps it, because the flag is already set by then.
//
// v3 (r409): v2 cleared the value IN MEMORY and never wrote it back, so it held
// for exactly one load and the stored 'corporate' returned on the next. It
// returns true now and loadSettings writes the result back. The key moved on so
// it runs once more for everyone v2 failed.
const LEXICON_MIGRATION_KEY = 'lethe.lexicon.migrated.v3';
function migrateLexiconDefault(saved) {
  try {
    if (localStorage.getItem(LEXICON_MIGRATION_KEY)) return false;
    localStorage.setItem(LEXICON_MIGRATION_KEY, '1');
    if (saved.lexicon !== 'corporate') return false;
    delete saved.lexicon;                        // fall through to the new default
    localStorage.removeItem('lethe.lexicon');    // and labels.js's early read with it
    return true;
  } catch (e) { return false; }
}

function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { saved = {}; }
  // A MIGRATION THAT IS NOT WRITTEN BACK IS UNDONE BY THE NEXT LOAD (r409). A
  // migration edits `saved`, the copy in memory, and sets its flag so it never
  // runs again - so unless the edited copy goes back to storage, the next load
  // reads the old value with the flag already set, and the old value wins for
  // good. That is what kept the whole-screen pattern on (r397's migration) and
  // what undid r293's switch to gamer wording. It writes back `saved`, not
  // SETTINGS, so it stores exactly what the player had minus what was migrated,
  // and freezes no defaults in the process.
  if (migrateLexiconDefault(saved)) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(saved)); } catch (e) {}
  }
  SETTINGS = {};
  SETTINGS_DEF.forEach(d => {
    if (d.type === 'action') return;
    let v = (saved[d.id] !== undefined) ? saved[d.id] : d.default;
    // A SELECT whose stored value is no longer one of its options falls back to
    // the default. Without this, r234 replacing the sound packs would leave an
    // existing player pointing at a pack that does not exist, with the dropdown
    // showing nothing and no way to tell what they were hearing.
    if (d.type === 'select' && Array.isArray(d.options) && !d.options.some(o => o[0] === v)) v = d.default;
    SETTINGS[d.id] = v;
  });
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

// ONE READ for every Skip row (r380). `key` is the row id without its prefix:
// skipOn('transitions') reads skipTransitions. Read live, so flipping a switch
// changes the very next thing it covers.
function skipOn(key) {
  if (typeof SETTINGS === 'undefined' || !SETTINGS) return false;
  return !!SETTINGS['skip' + key.charAt(0).toUpperCase() + key.slice(1)];
}

// SETTINGS HAS TABS (r380). It had grown to one long scroll of six groups, and
// the owner asked for "a whole tab" for the Skip rows. The tab is remembered per
// viewer; a stored tab that no longer exists falls back to the first.
const SETTINGS_TAB_KEY = 'lethe.settingsTab';
let settingsTab = null;
try { settingsTab = localStorage.getItem(SETTINGS_TAB_KEY); } catch (e) {}
function setSettingsTab(name) {
  settingsTab = name;
  try { localStorage.setItem(SETTINGS_TAB_KEY, name); } catch (e) {}
  renderSettings();
  const body = document.getElementById('settings-body'); if (body) body.scrollTop = 0;
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
  if (!groups.some(g => g.name === settingsTab)) settingsTab = groups[0] && groups[0].name;
  const tabs = `<div class="set-tabs">` + groups.map(g =>
      `<button class="set-tab${g.name === settingsTab ? ' on' : ''}" onclick="setSettingsTab('${g.name}')">${g.name}</button>`
    ).join('') + `</div>`;
  body.innerHTML = tabs + groups.filter(g => g.name === settingsTab).map(g => `
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
  } else if (d.type === 'keybind') {
    control = keyBindRowHTML(d);
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
  // continueSavedRun, not a bare resumeSavedRun: it hides the menus itself and
  // catches a restore that throws, handing back the menu instead of stranding
  // the player on a dead board (r470).
  continueSavedRun();
}
