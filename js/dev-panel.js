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
  // Focus dev controls — restore persisted values
  const decaySlider = document.getElementById('dev-focus-decay-slider');
  const decayLabel  = document.getElementById('dev-focus-decay-val');
  if (decaySlider) {
    const s = (focusDecayBaseMs / 1000);
    decaySlider.value = s;
    if (decayLabel) decayLabel.textContent = s.toFixed(2) + 's';
  }
  const beatSlider = document.getElementById('dev-focus-beat-slider');
  const beatLabel  = document.getElementById('dev-focus-beat-val');
  if (beatSlider) {
    beatSlider.value = focusBeatDurationMs;
    if (beatLabel) beatLabel.textContent = Math.round(focusBeatDurationMs) + 'ms';
  }
  const speedSelect = document.getElementById('dev-focus-speed-select');
  if (speedSelect) speedSelect.value = focusSpeedFormula;
  renderFocusSpeedParams();
  updateFocusSpeedPreview();
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
  if (typeof render === 'function') render(); // refresh glows immediately
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
  devSyncCcSliders();
  devCloseGroup();          // always land on the group menu, not the last group opened
  stopTimers();
}

// ── Group menu / sub-pop-ups ─────────────────────────────────────────────────
// The panel used to render every section at once in one long scroll. Now it opens
// on a menu of groups and each group is its own pop-up. The .dev-section elements
// are never moved — they all keep their ids (plenty of code binds to them) and are
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
  { g:'match3',   icon:'⬚', label:'Match-3',   sub:() => 'match types · sandbox' },
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

// ── Channel-change sliders (CC_CFG lives in js/channel-change.js) ──
const CC_KEYS = ['dur','static','roll','collapse','split','flash','hold'];
function devSetCc(k, v) {
  setCcParam(k, v);
  const lab = document.getElementById('dev-cc-' + k + '-val');
  if (lab) lab.textContent = (+v).toString();
}
function devCcPreset(name) { setCcPreset(name); devSyncCcSliders(); devCcTest(); }
function devResetCc() { resetCcCfg(); devSyncCcSliders(); }
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
    // Return to the main menu — do NOT start game timers (no game is running).
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
  const preset = presetId
    ? BOSS_PRESETS.find(p => p.id === presetId)
    : BOSS_PRESETS[bossNumber % BOSS_PRESETS.length];
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

// ── Focus dev controls (chunk 3) ──
function devAddFocus(n) { addFocus(n); }

function devSetFocusDecay(val) {
  focusDecayBaseMs = parseFloat(val) * 1000;
  localStorage.setItem('focusDecayBaseMs', focusDecayBaseMs);
  document.getElementById('dev-focus-decay-val').textContent = parseFloat(val).toFixed(2) + 's';
  recomputeFocusDecayInterval();
}

function devSetFocusBeat(val) {
  focusBeatDurationMs = parseFloat(val);
  localStorage.setItem('focusBeatDurationMs', focusBeatDurationMs);
  document.getElementById('dev-focus-beat-val').textContent = Math.round(val) + 'ms';
}

function devSetFocusSpeedFormula(formula) {
  focusSpeedFormula = formula;
  localStorage.setItem('focusSpeedFormula', formula);
  renderFocusSpeedParams();
  updateFocusSpeedPreview();
}

function devSetFocusSpeedParam(key, val) {
  if (!focusSpeedParams[focusSpeedFormula]) focusSpeedParams[focusSpeedFormula] = {};
  focusSpeedParams[focusSpeedFormula][key] = parseFloat(val);
  localStorage.setItem('focusSpeedParams', JSON.stringify(focusSpeedParams));
  updateFocusSpeedPreview();
}

function renderFocusSpeedParams() {
  const container = document.getElementById('dev-focus-speed-params');
  if (!container) return;
  const p = focusSpeedParams[focusSpeedFormula] || {};
  const numInput = (key, label, val, step) =>
    `<label style="display:flex;align-items:center;gap:6px;font-family:'Crimson Pro',serif;font-size:11px;color:var(--cream);">
       <span style="min-width:78px;color:var(--cream-dim);">${label}</span>
       <input type="number" step="${step}" value="${val}" oninput="devSetFocusSpeedParam('${key}', this.value)"
         style="width:70px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--cream);font-family:'Crimson Pro',serif;font-size:12px;padding:3px 6px;border-radius:3px;">
     </label>`;
  let html = '';
  if (focusSpeedFormula === 'linear') {
    html += numInput('max_bonus', 'Max trick', p.max_bonus ?? 12, '0.5');
    html += numInput('slope',     'Slope',     p.slope     ?? 1.5, '0.1');
  } else if (focusSpeedFormula === 'stepped') {
    html += numInput('t1',     't1 (s)',  p.t1     ?? 2, '0.5');
    html += numInput('bonus1', 'bonus1',  p.bonus1 ?? 6, '1');
    html += numInput('t2',     't2 (s)',  p.t2     ?? 5, '0.5');
    html += numInput('bonus2', 'bonus2',  p.bonus2 ?? 2, '1');
  } else if (focusSpeedFormula === 'exponential') {
    html += numInput('max_bonus', 'Max trick', p.max_bonus ?? 8, '1');
  }
  container.innerHTML = html;
}

function updateFocusSpeedPreview() {
  const el = document.getElementById('dev-focus-speed-preview');
  if (!el) return;
  const samples = [1, 2, 4, 8];
  el.textContent = samples.map(t => `t=${t}s: +${Math.floor(speedBonusFromTime(t))}`).join('  |  ');
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

