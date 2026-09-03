function applyDeckHudVisibility() {
  const hud = document.getElementById('deck-hud');
  if (hud) hud.style.display = showDeckHud ? '' : 'none';
}

function toggleDeckHud(on) {
  showDeckHud = !!on;
  localStorage.setItem('showDeckHud', showDeckHud);
  applyDeckHudVisibility();
}

function initDevMode() {
  const toggle = document.getElementById('dev-mode-toggle');
  if (toggle) toggle.checked = devMode;
  const ecToggle = document.getElementById('exalt-corrupt-toggle');
  if (ecToggle) ecToggle.checked = exaltCorruptEnabled;
  const hudToggle = document.getElementById('dev-deck-hud-toggle');
  if (hudToggle) hudToggle.checked = showDeckHud;
  const trickToggle = document.getElementById('dev-trick-tray-toggle');
  if (trickToggle) trickToggle.checked = !trickTrayMode;   // checked = Tricks placed on grid
  const ndToggle = document.getElementById('dev-new-dance-toggle');
  if (ndToggle) ndToggle.checked = newDanceEnabled;
  const diSel = document.getElementById('dev-dance-interrupt');
  if (diSel) diSel.value = danceInterruptMode;
  syncMatch3DevToggles();
  applyDeckHudVisibility();
  // Focus + scoring controls are generated from FOCUS_TUNABLES, so one call
  // rebuilds every row at its persisted value.
  devRenderFocusPanel();
  applyDevMode();
}

function toggleDevMode(on) {
  devMode = on;
  localStorage.setItem('devMode', on);
  applyDevMode();
}

// Exalt/Corrupt suit mechanic toggle (pause-menu Settings). Off by default.
function toggleExaltCorrupt(on) {
  exaltCorruptEnabled = !!on;
  localStorage.setItem('exaltCorruptEnabled', exaltCorruptEnabled);
  _devSafeRender();   // refresh glows immediately (no-op with no board yet)
}

// Push the Match-3 dev toggles' real state into their checkboxes. Called both at
// init and every time the panel opens, so the boxes never drift from reality
// (setMatch3Type can refuse a change, e.g. turning off the last match type).
function syncMatch3DevToggles() {
  const m3Deck = document.getElementById('dev-match3-infinite-deck');
  if (m3Deck) m3Deck.checked = match3InfiniteDeck;
  const m3Mode = document.getElementById('dev-match3-infinite-mode');
  if (m3Mode) m3Mode.checked = match3InfiniteMode;
  const m3Prev = document.getElementById('dev-match3-preview-select');
  if (m3Prev) m3Prev.checked = match3PreviewSelect;
  ['flush', 'run', 'set'].forEach(t => {
    const el = document.getElementById('dev-match3-type-' + t);
    if (el) el.checked = !!match3Types[t];
  });
}

function applyDevMode() {
  const btn = document.getElementById('dev-btn');
  if (btn) btn.style.display = devMode ? 'flex' : 'none';
  if (!devMode && devPanelOpen) closeDevPanel();
}

function toggleDevPanel() {
  devPanelOpen ? closeDevPanel() : openDevPanel();
}

// Opened as the "Settings" screen from the main menu (no game running yet).
// The dev panel doubles as settings; toggles set here (Tricks on grid, card counter)
// persist into the game you start. Closing returns to the menu.
let devPanelFromMenu = false;
function openSettingsFromMenu() {
  devPanelFromMenu = true;
  document.getElementById('main-menu-overlay').classList.remove('show');
  openDevPanel();
}

function openDevPanel() {
  devPanelOpen = true;
  const panel = document.getElementById('dev-panel');
  panel.style.display = 'flex';
  // Same panel serves as both the menu's Settings screen and the in-game dev panel.
  const title = document.getElementById('dev-panel-title');
  if (title) title.textContent = devPanelFromMenu ? 'SETTINGS' : 'DEV MODE';
  // Reflect current toggle states so the checkboxes match reality.
  const hudToggle = document.getElementById('dev-deck-hud-toggle');
  if (hudToggle) hudToggle.checked = showDeckHud;
  const trickToggle = document.getElementById('dev-trick-tray-toggle');
  if (trickToggle) trickToggle.checked = !trickTrayMode;   // checked = Tricks placed on grid
  syncMatch3DevToggles();
  devFilterTricks('');
  devFilterKnacks('');
  devRenderLimits();
  devRenderSleights();
  devRenderBosses();
  devRenderEvents();
  devRenderGroupMenu();
  devSyncFloatSliders();
  devSyncHbSliders();
  devSyncNs();
  devSyncCcSliders();
  devSyncDisco();
  devSyncFullscreen();
  devSyncSaveSection();
  renderSpectrumDev();
  devCloseGroup();          // always land on the group menu, not the last group opened
  stopTimers();
}

// ── Group menu / sub-pop-ups ─────────────────────────────────────────────────
// The panel used to render every section at once in one long scroll. Now it opens
// on a menu of groups and each group is its own pop-up. The .dev-section elements
// are never moved - they all keep their ids (plenty of code binds to them) and are
// simply shown or hidden by data-group.
const DEV_GROUPS = [
  { g:'tricks',   icon:'✦', label:'Tricks',    sub:() => `${TRICK_POOL.length} in pool` },
  { g:'sleights', icon:'▶', label:'Sleights',  sub:() => `${SLEIGHT_POOL.length} in pool` },
  { g:'knacks',   icon:'♦', label:'Knacks',    sub:() => `${KNACK_POOL.length} in pool` },
  { g:'limits',   icon:'▲', label:'Limits',    sub:() => `${LIMITS_DEF.length} upgradeable` },
  { g:'events',   icon:'✧', label:'Events',    sub:() => `${Object.keys(EVENT_META).length} + shop / limit break` },
  { g:'boss',     icon:'☠', label:'Bosses',    sub:() => `${BOSS_PRESETS.length} presets` },
  { g:'anim',     icon:'✺', label:'Animation', sub:() => 'fall · score · item float' },
  { g:'focus',    icon:'◎', label:'Focus',     sub:() => 'meter · decay · speed bonus' },
  { g:'time',     icon:'⏱', label:'Time',      sub:() => 'add / set round seconds' },
  { g:'coins',    icon:'💰', label:'Coins',    sub:() => 'add / zero credits' },
  { g:'score',    icon:'#', label:'Score',     sub:() => 'add score · win · skip level' },
  { g:'hud',      icon:'▤', label:'HUD',       sub:() => 'toggles · scoring dance' },
  { g:'display',  icon:'⛶', label:'Display',   sub:() => 'fullscreen' },
  { g:'save',     icon:'💾', label:'Save Run',  sub:() => { const s = savedRunSummary(); return s ? `saved · Round ${s.level}` : 'no save yet'; } },
  { g:'seed',     icon:'⚄', label:'Run Seed',  sub:() => runSeed ? `on · ${runSeed}` : 'off · random' },
  { g:'match3',   icon:'⬚', label:'Match-3',   sub:() => 'match types · sandbox' },
  { g:'spectrum', icon:'◐', label:'Spectrum',  sub:() => `${spectrumRanks().length} values × ${spectrumColors().length} colours` },
  { g:'builds',   icon:'▤', label:'Builds',    sub:() => `${discoveredIds.size} records open` },
  { g:'log',      icon:'✎', label:'Event Log', sub:() => 'in-game debug log' },
];
function devRenderGroupMenu() {
  const el = document.getElementById('dev-group-menu'); if (!el) return;
  el.innerHTML = DEV_GROUPS.map(d => {
    let sub = ''; try { sub = d.sub(); } catch (e) {}
    return `<button class="dev-group-btn" onclick="devOpenGroup('${d.g}')">
      <span class="dg-icon">${d.icon}</span>
      <span class="dg-label">${d.label}</span>
      <span class="dg-sub">${sub}</span>
    </button>`;
  }).join('');
}
function devOpenGroup(g) {
  const def = DEV_GROUPS.find(d => d.g === g);
  document.getElementById('dev-group-menu').style.display = 'none';
  document.getElementById('dev-group-pop').style.display = 'flex';
  document.getElementById('dev-group-pop-title').textContent = def ? def.label : g;
  document.querySelectorAll('#dev-group-pop-body .dev-section').forEach(sec => {
    sec.style.display = sec.dataset.group === g ? '' : 'none';
  });
  document.getElementById('dev-group-pop-body').scrollTop = 0;
  if (g === 'seed') devRefreshSeed();
  if (g === 'spectrum') renderSpectrumDev();
}
function devCloseGroup() {
  document.getElementById('dev-group-menu').style.display = '';
  document.getElementById('dev-group-pop').style.display = 'none';
}

// Boss + event buttons are generated from the data files, so a newly added preset
// or event shows up in the panel automatically (the_hollow was missing before).
function devRenderBosses() {
  const el = document.getElementById('dev-boss-btns'); if (!el) return;
  el.innerHTML = BOSS_PRESETS.map(b =>
    `<button class="dev-btn" onclick="devTriggerBoss('${b.id}')">${b.name || b.id}</button>`).join('');
}
function devRenderEvents() {
  const el = document.getElementById('dev-event-btns'); if (!el) return;
  el.innerHTML = Object.keys(EVENT_META).map(id =>
    `<button class="dev-btn" onclick="devTriggerEvent('${id}')">${EVENT_META[id].name}</button>`).join('');
}

// ── Item float sliders (FLOAT_CFG lives in js/float-anim.js) ──
function devSetFloat(k, v) {
  setFloatParam(k, v);
  const lab = document.getElementById('dev-float-' + k + '-val');
  if (lab) lab.textContent = (+v).toString();
}
function devResetFloat() { resetFloatCfg(); devSyncFloatSliders(); }

// ── Grid heartbeat sliders (HB_CFG lives in js/heartbeat.js) ──
const HB_KEYS = ['dx','dy','rot','scale','period','beat','gap','beat2','colStagger','rowStagger'];
function devSetHb(k, v) {
  setHbParam(k, v);
  const lab = document.getElementById('dev-hb-' + k + '-val');
  if (lab) lab.textContent = (+v).toString();
}
function devResetHb() { resetHbCfg(); devSyncHbSliders(); }

// ── Natural Scaling tuner (r181) - state lives in js/natural-scaling.js ──
// Each setting persists so a tuning session survives a reload. Changing pips/mult
// per hand affects FUTURE grants only; the accumulators already earned stay put
// (use "Reset accumulators" to clear them and re-measure from zero).
function devSetNs(k, v) {
  if (k === 'enabled') { nsEnabled = !!v; localStorage.setItem('nsEnabled', v ? '1' : '0'); }
  if (k === 'pips')    { nsPipsPerHand = parseFloat(v) || 0; localStorage.setItem('nsPipsPerHand', nsPipsPerHand); }
  if (k === 'mult')    { nsMultPerHand = parseFloat(v) || 0; localStorage.setItem('nsMultPerHand', nsMultPerHand); }
  if (k === 'every')   { nsEveryHands = Math.max(1, parseInt(v, 10) || 1); localStorage.setItem('nsEveryHands', nsEveryHands); }
  const lab = document.getElementById('dev-ns-' + k + '-val');
  if (lab) lab.textContent = (+v).toString();
  devSyncNs();
}
function devResetNs() { resetNaturalScaling(); devSyncNs(); }
function devSyncNs() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const chk = document.getElementById('dev-ns-enabled'); if (chk) chk.checked = nsEnabled;
  set('dev-ns-pips', nsPipsPerHand); set('dev-ns-mult', nsMultPerHand); set('dev-ns-every', nsEveryHands);
  const lab = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  lab('dev-ns-pips-val', nsPipsPerHand); lab('dev-ns-mult-val', nsMultPerHand); lab('dev-ns-every-val', nsEveryHands);
  const st = document.getElementById('dev-ns-state');
  if (st) st.textContent = naturalScaleSummary();
}

// ── Channel-change sliders (CC_CFG lives in js/channel-change.js) ──
const CC_KEYS = ['dur','static','roll','collapse','split','flash','hold'];
function devSetCc(k, v) {
  setCcParam(k, v);
  const lab = document.getElementById('dev-cc-' + k + '-val');
  if (lab) lab.textContent = (+v).toString();
}
function devCcPreset(name) { setCcPreset(name); devSyncCcSliders(); devCcTest(); }
function devResetCc() { resetCcCfg(); devSyncCcSliders(); }

// ── Builds archive / discovery ──
function devSetRevealAll(on) { setDevRevealAll(on); devSyncDisco(); if (buildsOpen) renderBuilds(); }
function devDiscoverAll() {
  [...TRICK_POOL, ...KNACK_POOL, ...SLEIGHT_POOL].forEach(e => markDiscovered(e.id));
  devSyncDisco(); if (buildsOpen) renderBuilds();
  showMessage('All records opened', 'var(--gold)');
}
function devForgetAll() {
  discoveredIds.clear(); saveDiscovered();
  devSyncDisco(); if (buildsOpen) renderBuilds();
  showMessage('Archive cleared', 'var(--cream-dim)');
}
function devSyncDisco() {
  const cb = document.getElementById('dev-reveal-all');
  if (cb) cb.checked = devRevealAll;
  const n = document.getElementById('dev-disco-count');
  if (n) n.textContent = `${discoveredIds.size} of ${TRICK_POOL.length + KNACK_POOL.length + SLEIGHT_POOL.length} entities discovered`;
}
function devCcTest() { channelChange(() => {}, { channel: 'TEST' }); }
function devSyncCcSliders() {
  const on = document.getElementById('dev-cc-enabled');
  if (on) on.checked = ccEnabled;
  CC_KEYS.forEach(k => {
    const sl = document.getElementById('dev-cc-' + k);
    const lab = document.getElementById('dev-cc-' + k + '-val');
    if (sl)  sl.value = CC_CFG[k];
    if (lab) lab.textContent = CC_CFG[k].toString();
  });
}
function devSyncHbSliders() {
  const on = document.getElementById('dev-hb-enabled');
  if (on) on.checked = hbEnabled;
  HB_KEYS.forEach(k => {
    const sl = document.getElementById('dev-hb-' + k);
    const lab = document.getElementById('dev-hb-' + k + '-val');
    if (sl)  sl.value = HB_CFG[k];
    if (lab) lab.textContent = HB_CFG[k].toString();
  });
}
function devSyncFloatSliders() {
  ['dx','dy','rot','per','sc'].forEach(k => {
    const sl = document.getElementById('dev-float-' + k);
    const lab = document.getElementById('dev-float-' + k + '-val');
    if (sl)  sl.value = FLOAT_CFG[k];
    if (lab) lab.textContent = FLOAT_CFG[k].toString();
  });
}

function closeDevPanel() {
  devPanelOpen = false;
  document.getElementById('dev-panel').style.display = 'none';
  if (devPanelFromMenu) {
    // Return to the main menu - do NOT start game timers (no game is running).
    devPanelFromMenu = false;
    renderMenuModes();
    document.getElementById('main-menu-overlay').classList.add('show');
    return;
  }
  if (!isPaused) startTimers();
}

function devAddTime(s) {
  roundSeconds = Math.max(1, Math.min(ROUND_DURATION, roundSeconds + s));
  updateClockUI();
}
function devSetTime(s) { roundSeconds = s; updateClockUI(); }

function devAddCoins(n) { coins += n; updateCoinsUI(); }
function devSetCoins(n) { coins = n; updateCoinsUI(); }

function devAddScore(n) { score += n; updateScoreUI(); }

function devWinRound() {
  score = roundGoal + 1;
  updateScoreUI();
  closeDevPanel();
}

function devSkipLevel() {
  closeDevPanel();
  triggerLevelUp(true);
}

function devOpenShop() {
  closeDevPanel();
  document.getElementById('shop-overlay').classList.add('show');
  renderShop();
}

function devTriggerBoss(presetId) {
  closeDevPanel();
  if (bossActive) return;
  // No id = "whatever the run would deal next" (the shuffled bag), same as play.
  const preset = presetId ? BOSS_PRESETS.find(p => p.id === presetId) : null;
  triggerBoss(preset);
}
function devEndBossWin() {
  closeDevPanel();
  if (bossActive) endBoss(true);
}
function devEndBossLose() {
  closeDevPanel();
  if (bossActive) endBoss(false);
}
function devOpenRewardGrid() {
  closeDevPanel();
  rewardGridContext = 'boss'; // dev open = mid-round, just resume the round when closed
  openRewardGrid();
}
function devOpenPrizeGrid() {
  closeDevPanel();
  rewardGridContext = 'boss'; // dev open = mid-round, just resume the round when closed
  openPrizeGrid();
}
function devOpenShopGridPreview() {
  closeDevPanel();
  openShopGridPreview();
}

function devTriggerEvent(eventId) {
  closeDevPanel();
  if (eventId === 'limit_break') {
    openLimitBreakEvent();
  } else if (eventId === 'shop') {
    document.getElementById('shop-overlay').classList.add('show');
    renderShop();
  } else {
    // Any node event in the registry (was a hardcoded list that could drift)
    if (EVENT_META[eventId]) {
      afterEventFn = () => {};
      activeEventId = eventId;
      eventState = {};
      renderEventShell(eventId);
      document.getElementById('event-overlay').classList.add('show');
    }
  }
}

function devRenderLimits() {
  const disp = document.getElementById('dev-limits-display');
  const btns = document.getElementById('dev-limits-btns');
  if (!disp || !btns) return;
  disp.innerHTML = LIMITS_DEF.map(def => {
    const l = limits[def.id];
    const bar = '█'.repeat(l.current - l.base) + '░'.repeat(l.max - l.current);
    const val = def.hideMax ? `${l.current}` : `${l.current}/${l.max}`;
    return `${def.icon} ${def.label.padEnd(18,' ')} ${val.padEnd(6,' ')} ${bar}`;
  }).join('<br>');
  btns.innerHTML = LIMITS_DEF.map(def => {
    const l = limits[def.id];
    const atMax = l.current >= l.max;
    return `<button class="dev-btn" style="font-size:9px;padding:3px 6px;" onclick="devIncrLimit('${def.id}')" ${atMax ? 'disabled style="opacity:0.4"' : ''}>+${def.icon}</button>`;
  }).join('');
}

function devIncrLimit(id) {
  const ok = incrementLimit(id);
  if (ok) showMessage(`↑ ${LIMITS_DEF.find(d=>d.id===id)?.label}`, 'var(--gold)');
  devRenderLimits();
}

function devSetFallSpeed(val) {
  devFallSpeed = parseFloat(val);
  document.getElementById('dev-fall-val').textContent = devFallSpeed + '×';
}

function devSetAnimSpeed(val) {
  devAnimSpeed = parseFloat(val);
  document.getElementById('dev-anim-val').textContent = val + ' t/s';
}

// ══════════════════════════════════════════════
// FOCUS + SCORING DEV CONTROLS  (rebuilt r179)
// ══════════════════════════════════════════════
// These used to be raw sliders labelled with the formula itself
// ("Linear - max(0, max_bonus - slope x t)"), which required reading the source
// to use. Every control here is now a sentence plus a number you can type,
// generated from ONE table: add a row to FOCUS_TUNABLES and the panel, the
// persistence and the reset button all pick it up.
//
// Steppers rather than sliders: these are exact values worth typing (2.5 seconds,
// 0.15 per node), and a slider cannot hit them reliably at a useful range.

function devAddFocus(n) { addFocus(n); }

// The dev panel doubles as the main menu's Settings screen, where there is no
// board: render() reads gridData[0] and throws before a run has started. Every
// tunable that wants a repaint goes through this.
function _devSafeRender() {
  if (typeof render !== 'function') return;
  if (typeof gridData === 'undefined' || !Array.isArray(gridData) || !gridData.length) return;
  render();
}

// { get, set } read and write the live global. `min`/`max` clamp; `step` is what
// the +/- buttons move by; `dp` is decimal places shown.
const FOCUS_TUNABLES = {
  decay: [
    { key: 'decayEvery', label: 'Seconds of stillness before Focus drops one node',
      min: 0.1, max: 60, step: 0.25, dp: 2, unit: 's',
      get: () => focusDecayBaseMs / 1000,
      set: v => { focusDecayBaseMs = v * 1000; localStorage.setItem('focusDecayBaseMs', focusDecayBaseMs); recomputeFocusDecayInterval(); } },
  ],
  mult: [
    { key: 'multStart', label: 'Nodes you must hold before the multiplier starts climbing',
      min: 0, max: 100, step: 1, dp: 0, unit: '',
      get: () => focusMultStartNodes,
      set: v => { focusMultStartNodes = v; localStorage.setItem('focusMultStartNodes', v); _devSafeRender(); } },
    { key: 'multPer', label: 'Multiplier added per node above that',
      min: 0.01, max: 2, step: 0.05, dp: 2, unit: 'x',
      get: () => focusMultPerNode,
      set: v => { focusMultPerNode = v; localStorage.setItem('focusMultPerNode', v); _devSafeRender(); } },
  ],
  anim: [
    { key: 'beat', label: 'Time the meter takes to animate one node',
      min: 20, max: 3000, step: 25, dp: 0, unit: 'ms',
      get: () => focusBeatDurationMs,
      set: v => { focusBeatDurationMs = v; localStorage.setItem('focusBeatDurationMs', v); } },
  ],
};

// Plain-language names for the speed-bonus shapes, and their parameters.
const FOCUS_SPEED_MODES = {
  linear: {
    name: 'Fades evenly with every second you wait',
    params: [
      { key: 'max_bonus', label: 'Focus for playing instantly', min: 0, max: 100, step: 1,   dp: 0, unit: '' },
      { key: 'slope',     label: 'Focus lost per second waited', min: 0, max: 50,  step: 0.5, dp: 1, unit: '' },
    ],
  },
  stepped: {
    name: 'Two brackets, then nothing',
    params: [
      { key: 't1',     label: 'Play within this many seconds', min: 0.1, max: 60, step: 0.5, dp: 1, unit: 's' },
      { key: 'bonus1', label: 'and get this much Focus',       min: 0,   max: 100, step: 1,  dp: 0, unit: '' },
      { key: 't2',     label: 'Play within this many seconds',  min: 0.1, max: 60, step: 0.5, dp: 1, unit: 's' },
      { key: 'bonus2', label: 'and get this much Focus',        min: 0,   max: 100, step: 1,  dp: 0, unit: '' },
    ],
  },
  exponential: {
    name: 'Halves fast, then trails off',
    params: [
      { key: 'max_bonus', label: 'Focus for playing instantly', min: 0, max: 100, step: 1, dp: 0, unit: '' },
    ],
  },
};

const SCORING_MODEL_COPY = {
  classic:     ['Hand type sets both pips and mult',
                'The shipped table. A Straight is worth 40 pips and x5 before your cards are counted.'],
  mult_ladder: ['Hand type sets mult only, no bonus pips',
                'All pips come from the cards you actually played. Hand type still pays immediately, through the mult.'],
  hand_size:   ['Mult is just how many cards you played',
                'No bonus pips and no mult ladder. Hand type is then worth only the Focus it gives.'],
};

// One stepper: a sentence, a [-] [number] [+] group, and a unit.
function _devStepper(t, onchangeFn) {
  const v = t.get ? t.get() : t.value;
  return `<div class="dev-tune" data-key="${t.key}">
      <span class="dev-tune-label">${t.label}</span>
      <span class="dev-tune-ctl">
        <button class="dev-step" onclick="${onchangeFn}('${t.key}', -1)" aria-label="decrease">&minus;</button>
        <input class="dev-tune-num" type="number" inputmode="decimal"
               min="${t.min}" max="${t.max}" step="${t.step}" value="${(+v).toFixed(t.dp)}"
               onchange="${onchangeFn}('${t.key}', 0, this.value)">
        <button class="dev-step" onclick="${onchangeFn}('${t.key}', 1)" aria-label="increase">+</button>
        ${t.unit ? `<span class="dev-tune-unit">${t.unit}</span>` : ''}
      </span>
    </div>`;
}

function _devFindTunable(key) {
  for (const group of Object.values(FOCUS_TUNABLES)) {
    const t = group.find(x => x.key === key);
    if (t) return t;
  }
  return null;
}

// dir: -1 / +1 to step, 0 to take the typed value.
function devTuneFocus(key, dir, typed) {
  const t = _devFindTunable(key);
  if (!t) return;
  let v = (dir === 0) ? parseFloat(typed) : t.get() + dir * t.step;
  if (!isFinite(v)) v = t.get();
  v = Math.min(t.max, Math.max(t.min, +v.toFixed(4)));
  t.set(v);
  devRenderFocusPanel();
}

function devTuneSpeed(key, dir, typed) {
  const mode = FOCUS_SPEED_MODES[focusSpeedFormula];
  const t = mode && mode.params.find(p => p.key === key);
  if (!t) return;
  if (!focusSpeedParams[focusSpeedFormula]) focusSpeedParams[focusSpeedFormula] = {};
  const cur = focusSpeedParams[focusSpeedFormula][key] ?? 0;
  let v = (dir === 0) ? parseFloat(typed) : cur + dir * t.step;
  if (!isFinite(v)) v = cur;
  v = Math.min(t.max, Math.max(t.min, +v.toFixed(4)));
  focusSpeedParams[focusSpeedFormula][key] = v;
  localStorage.setItem('focusSpeedParams', JSON.stringify(focusSpeedParams));
  devRenderFocusPanel();
}

function devSetFocusSpeedFormula(formula) {
  focusSpeedFormula = formula;
  localStorage.setItem('focusSpeedFormula', formula);
  devRenderFocusPanel();
}

function devSetScoringModel(model) {
  if (!SCORING_MODELS.includes(model)) return;
  scoringModel = model;
  localStorage.setItem('scoringModel', model);
  // The preview slot and the RECORDS Hands tab both read the model, and the
  // selected-hand readout is rebuilt by render().
  _devSafeRender();
  if (typeof recordsOpen !== 'undefined' && recordsOpen && typeof renderRecords === 'function') renderRecords();
  devRenderFocusPanel();
}

function devResetFocusTunables() {
  ['focusDecayBaseMs','focusBeatDurationMs','focusMultStartNodes','focusMultPerNode',
   'focusSpeedFormula','focusSpeedParams','scoringModel'].forEach(k => localStorage.removeItem(k));
  focusDecayBaseMs    = 2000;
  focusBeatDurationMs = 300;
  focusMultStartNodes = FOCUS_THRESHOLD;
  focusMultPerNode    = 0.1;
  focusSpeedFormula   = 'linear';
  focusSpeedParams    = { linear: { max_bonus: 12, slope: 1.5 },
                          stepped: { t1: 2, bonus1: 6, t2: 5, bonus2: 2 },
                          exponential: { max_bonus: 8 } };
  scoringModel        = 'classic';
  recomputeFocusDecayInterval();
  _devSafeRender();
  devRenderFocusPanel();
}

function _devRadioRow(name, value, current, title, sub, onchangeFn) {
  return `<label class="dev-pick${value === current ? ' on' : ''}">
      <input type="radio" name="${name}" ${value === current ? 'checked' : ''}
             onchange="${onchangeFn}('${value}')">
      <span class="dev-pick-body"><b>${title}</b><i>${sub}</i></span>
    </label>`;
}

// Rebuilds every focus/scoring control from the tables above. Safe to call any
// time; each slot is only filled if it exists in the DOM.
function devRenderFocusPanel() {
  const fill = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  fill('dev-scoring-model', SCORING_MODELS
    .map(m => _devRadioRow('dev-scoring', m, scoringModel, SCORING_MODEL_COPY[m][0], SCORING_MODEL_COPY[m][1], 'devSetScoringModel'))
    .join(''));

  fill('dev-focus-speed-mode', Object.keys(FOCUS_SPEED_MODES)
    .map(k => _devRadioRow('dev-focus-speed', k, focusSpeedFormula, FOCUS_SPEED_MODES[k].name, '', 'devSetFocusSpeedFormula'))
    .join(''));

  const mode = FOCUS_SPEED_MODES[focusSpeedFormula] || { params: [] };
  const sp   = focusSpeedParams[focusSpeedFormula] || {};
  fill('dev-focus-speed-params', mode.params
    .map(p => _devStepper({ ...p, get: () => sp[p.key] ?? 0 }, 'devTuneSpeed')).join(''));

  ['decay', 'mult', 'anim'].forEach(g =>
    fill('dev-focus-' + g + '-rows', FOCUS_TUNABLES[g].map(t => _devStepper(t, 'devTuneFocus')).join('')));

  // Previews: what the numbers above actually produce.
  const sec = [0, 1, 2, 4, 8];
  fill('dev-focus-speed-preview',
    'Play after ' + sec.map(t => `${t}s: +${Math.floor(speedBonusFromTime(t))}`).join('  ·  '));
  const nodes = [focusMultStartNodes, focusMultStartNodes + 5, focusMultStartNodes + 10, focusMultStartNodes + 20];
  fill('dev-focus-mult-preview',
    nodes.map(n => `${n} nodes: x${(1 + Math.max(0, n - focusMultStartNodes) * focusMultPerNode).toFixed(2)}`).join('  ·  '));
}

function devFilterTricks(query) {
  const list = document.getElementById('dev-trick-list');
  const q = query.toLowerCase();
  const matches = TRICK_POOL.filter(b => !query || b.name.toLowerCase().includes(q) || b.id.includes(q));
  list.innerHTML = matches.slice(0, 30).map(b => `
    <div class="dev-trick-item">
      <span class="dev-trick-name">${b.name}</span>
      <button class="dev-trick-add" onclick="devAddTrick('${b.id}')">+ Add</button>
    </div>
  `).join('');
}

function devAddTrick(id) {
  const trick = TRICK_POOL.find(b => b.id === id);
  if (!trick) return;
  // Real grant path: pushes into trickTray (tray mode) / grid, enforces capacity,
  // records acquiredTricks via selectTrick, and re-renders the tray.
  injectTrickAfterReward(trick);
  // Refresh focus-related state since Meditation/etc. may have just been added
  recomputeFocusDecayInterval();
  // Flash confirmation (window.event may be absent when called programmatically)
  const btn = (typeof event !== 'undefined' && event) ? event.target : null;
  if (btn && btn.tagName === 'BUTTON') {
    btn.textContent = '✓ Added';
    btn.style.color = '#8bc34a';
    setTimeout(() => { btn.textContent = '+ Add'; btn.style.color = ''; }, 1200);
  }
}

function devFilterKnacks(query) {
  const list = document.getElementById('dev-knack-list');
  if (!list) return;
  const q = (query || '').toLowerCase();
  const matches = KNACK_POOL.filter(t => !q || t.name.toLowerCase().includes(q) || t.id.includes(q));
  list.innerHTML = matches.slice(0, 30).map(t => {
    const owned = hasKnack(t.id);
    return `
      <div class="dev-trick-item">
        <span class="dev-trick-name">${t.emoji} ${t.name}${owned ? ' ✓' : ''}</span>
        <button class="dev-trick-add" onclick="devAddKnack('${t.id}')" ${owned ? 'disabled style="opacity:0.5;cursor:default;"' : ''}>
          ${owned ? 'Owned' : '+ Add'}
        </button>
      </div>
    `;
  }).join('');
}

function devAddKnack(id) {
  const knack = KNACK_POOL.find(t => t.id === id);
  if (!knack) return;
  if (hasKnack(id)) return;
  acquiredKnacks.push(knack);
  updateKnackList();
  // Refresh dev list so the entry flips to "Owned"
  const searchEl = document.getElementById('dev-knack-search');
  devFilterKnacks(searchEl ? searchEl.value : '');
  const btn = event.target;
  btn.textContent = '✓ Added';
  btn.style.color = '#8bc34a';
}

function devRenderSleights() {
  const list = document.getElementById('dev-sleight-list');
  if (!list) return;
  list.innerHTML = SLEIGHT_POOL.map(j => {
    const owned = grantedSleightIds.has(j.id);
    return `<div class="dev-trick-item">
      <span class="dev-trick-name">${j.emoji} ${j.name} <span style="color:var(--gold-dim);font-size:9px">${j.rarity}</span>${owned?' ✓':''}</span>
      <button class="dev-trick-add" onclick="devAddSleight('${j.id}')" ${owned?'disabled style="opacity:0.5"':''}>
        ${owned?'Granted':'+ Add'}
      </button>
    </div>`;
  }).join('');
}
function devAddSleight(id) {
  const j = SLEIGHT_POOL.find(x=>x.id===id);
  if (!j) return;
  grantSleight(j);
  devRenderSleights();
}

// ── End of dev mode ──



// ── Run seed (dev panel → Run Seed) ──────────────────────────────────────────
// The seed is CONSUMED BY startGame, so setting one here only affects the next
// run - the current run's stream is already running. See js/seed.js.
function devSetSeed(v) {
  setPendingRunSeed(v.trim());
  devRefreshSeed();
}
function devRollSeed() {
  const v = randomSeedString();
  const el = document.getElementById('dev-seed-input');
  if (el) el.value = v;
  setPendingRunSeed(v);
  devRefreshSeed();
}
function devClearSeed() {
  const el = document.getElementById('dev-seed-input');
  if (el) el.value = '';
  setPendingRunSeed(null);
  devRefreshSeed();
}
function devRefreshSeed() {
  const now = document.getElementById('dev-seed-now');
  const nxt = document.getElementById('dev-seed-next');
  if (now) now.textContent = runSeed ? runSeed : '- (unseeded)';
  if (nxt) nxt.textContent = pendingRunSeed ? pendingRunSeed : '- (unseeded)';
}
function devStartSeededRun() {
  const el = document.getElementById('dev-seed-input');
  if (el) setPendingRunSeed(el.value.trim());
  closeDevPanel();
  startGame();
}


// ══════════════════════════════════════════════
// SAVE RUN (Settings group) - see js/save.js
// ══════════════════════════════════════════════
function devSaveMsg(text, ok) {
  const el = document.getElementById('dev-save-msg');
  if (el) { el.textContent = text || ''; el.style.color = ok === false ? 'var(--red)' : 'var(--gold)'; }
}

function devSyncSaveSection() {
  const stateEl = document.getElementById('dev-save-state');
  const s = savedRunSummary();
  // A run is only "in progress" once a round has actually started - that is what
  // produces the checkpoint this panel writes out.
  const inRun = !!runCheckpoint;
  if (stateEl) {
    stateEl.innerHTML = s
      ? `<strong style="color:var(--cream)">Saved run:</strong> ${s.modeName} · Round ${s.level} · ${s.totalScore.toLocaleString()} pts · ${s.tricks} tricks · ${s.knacks} knacks<br><span style="opacity:.7">${s.whenStr}</span>`
      : 'No saved run yet.';
  }
  const saveBtn = document.getElementById('dev-save-btn');
  if (saveBtn) {
    saveBtn.disabled = !inRun;
    saveBtn.style.opacity = inRun ? '' : '0.45';
    saveBtn.textContent = inRun ? `💾 Save Run (Round ${runCheckpoint.meta.level})` : '💾 Save Run - start a round first';
  }
  const resumeBtn = document.getElementById('dev-save-resume-btn');
  if (resumeBtn) { resumeBtn.style.display = s ? '' : 'none'; }
  const clearBtn = document.getElementById('dev-save-clear-btn');
  if (clearBtn) { clearBtn.style.display = s ? '' : 'none'; }
  devSaveMsg('');
}

function devSaveRun() {
  const r = saveRunToStorage();
  devSaveMsg(r.msg, r.ok);
  devSyncSaveSection();
  renderSpectrumDev();
  if (r.ok) devSaveMsg(r.msg, true);   // re-set: devSyncSaveSection clears it
  updateContinueBtn();
  devRenderGroupMenu();
}

function devClearSave() {
  clearSavedRun();
  devSyncSaveSection();
  renderSpectrumDev();
  devSaveMsg('Save deleted.');
  devRenderGroupMenu();
}

function devResumeRun() {
  if (!hasSavedRun()) return;
  closeDevPanel();
  document.getElementById('main-menu-overlay').classList.remove('show');
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  resumeSavedRun();
}
