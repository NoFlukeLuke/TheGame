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
  const mfb = document.getElementById('dev-map-freebranch');
  if (mfb) mfb.checked = mapFreeBranch;
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
  devRenderModes();
  devRenderTips();
  devRenderEvents();
  devRenderGroupMenu();
  devSyncFloatSliders();
  devSyncHbSliders();
  devSyncBlipSliders();
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
  { g:'modes',    icon:'▶', label:'Modes',     sub:() => `${Object.keys(MODES).length} playable · ${MODE_HIDDEN_LIST.length} hidden` },
  { g:'anim',     icon:'✺', label:'Animation', sub:() => 'fall · score · item float' },
  { g:'focus',    icon:'◎', label:'Focus',     sub:() => 'meter · decay · speed bonus' },
  { g:'time',     icon:'⏱', label:'Time',      sub:() => 'add / set round seconds' },
  { g:'coins',    icon:'💰', label:'Coins',    sub:() => 'add / zero credits' },
  { g:'score',    icon:'#', label:'Score',     sub:() => 'add score · win · skip level' },
  { g:'goals',    icon:'◈', label:'Goals',     sub:() => devGoalGroupSub() },
  { g:'hud',      icon:'▤', label:'HUD',       sub:() => 'toggles · scoring dance' },
  { g:'display',  icon:'⛶', label:'Display',   sub:() => 'fullscreen' },
  { g:'save',     icon:'💾', label:'Save Run',  sub:() => { const s = savedRunSummary(); return s ? `saved · Round ${s.level}` : 'no save yet'; } },
  { g:'seed',     icon:'⚄', label:'Run Seed',  sub:() => runSeed ? `on · ${runSeed}` : 'off · random' },
  { g:'map',      icon:'🗺', label:'Map',       sub:() => mapFreeBranch ? 'free branch ON' : 'free branch off' },
  { g:'match3',   icon:'⬚', label:'Match-3',   sub:() => 'match types · sandbox' },
  { g:'spectrum', icon:'◐', label:'Spectrum',  sub:() => `${spectrumRanks().length} values × ${spectrumColors().length} colours` },
  { g:'deck',     icon:'\u265B', label:'Deck',      sub:() => { const m = deckModelNow();
      return m === 'weighted' ? `weighted · ${deckWeightedSize()} cards · ${deckWeightedSuits().length} suits`
           : m === 'six'      ? `six suits · ${deckDesignSize()} cards`
           : m === 'spectrum' ? 'Spectrum owns its deck'
           : 'four suits · 52 cards'; } },
  { g:'improve',  icon:'\u2191', label:'Improve',   sub:() => devImproveSub() },
  { g:'cardstates', icon:'\u29c9', label:'Card States', sub:() => devCardStateSub() },
  { g:'builds',   icon:'▤', label:'Builds',    sub:() => `${discoveredIds.size} records open` },
  { g:'tips',     icon:'\u2139', label:'Tips',      sub:() => `${INSIGHTS.length} tips \u00b7 ${insightsSeenCount()} seen` },
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
  if (g === 'deck') devRenderDeckDesign();
  if (g === 'goals') devRenderGoalPanel();
  if (g === 'improve') devRenderImprove();
  if (g === 'cardstates') devRenderCardStates();
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
// Every mode in MODES, not just the carousel's list - this is the only way into
// Match-3, Zen and Dominoes now that MODE_SELECT_LIST hides them (js/menu.js).
// Generated rather than hand-written for the same reason the boss and event rows
// are: a new mode cannot go missing from the panel.
// Tips (r280). Every row is FIRED ON DEMAND rather than waited for: most of the
// predicates need a board state that is a nuisance to reach, and devShowInsight
// deliberately does not burn a tip that had not been seen yet.
function devRenderTips() {
  const el = document.getElementById('dev-tip-btns'); if (!el) return;
  el.innerHTML =
    `<div class="dev-note">${insightsSeenCount()} of ${INSIGHTS.length} seen \u00b7 `
      + `tips are ${insightsOn() ? 'ON' : 'OFF'} (Settings \u203a Help)</div>` +
    `<button class="dev-btn" onclick="resetInsights(); devRenderTips();">Reset all</button>` +
    `<button class="dev-btn" onclick="openInfoHub()">Open handbook</button>` +
    INSIGHTS.map(r => {
      const seen = insightsSeen.has(r.id);
      return `<button class="dev-btn" onclick="devShowInsight('${r.id}')" `
           + `title="${seen ? 'already seen' : 'not yet seen'}">${r.id}${seen ? '' : ' \u2022'}</button>`;
    }).join('');
}

function devRenderModes() {
  const el = document.getElementById('dev-mode-btns'); if (!el) return;
  // The unlock state is PERSISTED across runs, so without a reset here a mode's
  // first-run tutorial can only ever be seen once per browser.
  const done = (typeof modesFinished !== 'undefined') ? modesFinished.size : 0;
  const seen = (typeof modesStarted  !== 'undefined') ? modesStarted.size  : 0;
  el.innerHTML =
    `<div class="dev-note">Unlocks: ${done} finished \u00b7 ${seen} played</div>` +
    `<button class="dev-btn" onclick="devUnlockAllModes()">Unlock every mode</button>` +
    `<button class="dev-btn" onclick="devResetModeProgress(); devRenderModes();">Reset unlocks + first runs</button>` +
    Object.keys(MODES).map(id => {
      const hidden = MODE_HIDDEN_LIST.includes(id);
      return `<button class="dev-btn" onclick="devStartMode('${id}')" title="${hidden ? 'hidden from the mode carousel' : ''}">`
           + `${MODES[id].name || id}${hidden ? ' \u00b7' : ''}</button>`;
    }).join('');
}

// Launch a mode from the panel. chooseMode() is the menu's own entry point, so
// this only has to clear the surfaces the panel may be sitting on top of first -
// the panel itself, the main menu, and the carousel if it is open behind it.
function devStartMode(id) {
  if (!MODES[id]) return;
  devPanelFromMenu = false;          // never bounce back to the menu - a run is starting
  devPanelOpen = false;
  document.getElementById('dev-panel').style.display = 'none';
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  chooseMode(id);
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

// ── Score-particle blip growth (r233) - PARTICLE_CFG lives in js/score-dance.js ──
// Past the first `growStart` particles of a hand, each further one is `growStep`%
// bigger than the last, compounding to `growMax`. Persisted, because a tuning
// session should survive a reload. Shape, colour and the flight itself are tuned
// in particle-preview.html instead - these three are the only ones that need to be
// felt against a real hand, so they are the only ones here.
const BLIP_KEYS = ['growStart','growStep','growMax'];
function devSetBlip(k, v) {
  if (typeof PARTICLE_CFG === 'undefined' || !BLIP_KEYS.includes(k)) return;
  PARTICLE_CFG[k] = +v;
  const lab = document.getElementById('dev-blip-' + k + '-val');
  if (lab) lab.textContent = (+v).toString();
  try { const o = {}; BLIP_KEYS.forEach(x => o[x] = PARTICLE_CFG[x]);
        localStorage.setItem('lethe.blipGrow.v1', JSON.stringify(o)); } catch (e) {}
}
function devResetBlip() {
  try { localStorage.removeItem('lethe.blipGrow.v1'); } catch (e) {}
  if (typeof PARTICLE_CFG !== 'undefined') { PARTICLE_CFG.growStart = 5; PARTICLE_CFG.growStep = 5; PARTICLE_CFG.growMax = 3; }
  devSyncBlipSliders();
}
function devSyncBlipSliders() {
  if (typeof PARTICLE_CFG === 'undefined') return;
  BLIP_KEYS.forEach(k => {
    const el = document.getElementById('dev-blip-' + k), lab = document.getElementById('dev-blip-' + k + '-val');
    if (el) el.value = PARTICLE_CFG[k];
    if (lab) lab.textContent = String(PARTICLE_CFG[k]);
  });
}
// Restore at load, before any hand is played.
(function(){ try {
  const raw = localStorage.getItem('lethe.blipGrow.v1'); if (!raw) return;
  const o = JSON.parse(raw); if (typeof PARTICLE_CFG === 'undefined') return;
  BLIP_KEYS.forEach(k => { if (typeof o[k] === 'number') PARTICLE_CFG[k] = o[k]; });
} catch (e) {} })();

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
  devSyncNs();
  _devSafeRender();
}
function devResetNs() { resetNaturalScaling(); devSyncNs(); }
// The RATES, not the accumulators (r282) - the two reset buttons are deliberately
// separate, because "start this hand's growth over" and "go back to the shipped
// growth rate" are different questions.
function devResetNsRates() { resetNaturalScaleRates(); _nsRowsKey = ''; devSyncNs(); }

// ── Natural Scaling bonus editor (r201) ──
// A table of every scalable hand type with its EARNED pips and mult, typed
// directly. Rebuilt only when the set of rows changes, so typing in a field does
// not tear the field out from under the caret on the next sync.
let _nsRowsKey = '';
function devRenderNsRows() {
  const host = document.getElementById('dev-ns-rows');
  if (!host || typeof naturalScaleRows !== 'function') return;
  const rows = naturalScaleRows();
  const key = rows.map(r => r.name).join('|');
  if (key !== _nsRowsKey) {
    _nsRowsKey = key;
    host.innerHTML =
      `<div class="dev-ns-row dev-ns-head">
         <span class="dev-ns-name">HAND</span>
         <span title="pips this hand earns per grant">PIPS</span>
         <span title="mult this hand earns per grant">MULT</span>
         <span title="a grant fires on every Nth play of this hand">EVERY</span>
         <span title="alternate: each grant pays pips OR mult, pips first">ALT</span>
         <span title="pips earned so far this run">+P</span>
         <span title="mult earned so far this run">+M</span>
         <span title="plays this run / growth in this hand's own worth per play">N</span>
       </div>` +
      rows.map(r => `<div class="dev-ns-row" data-nsrow="${r.name}">
      <span class="dev-ns-name">${r.name}</span>
      <input type="number" step="1"    min="0" data-ns="${r.name}" data-f="rpips"  oninput="devSetNsRate(this)">
      <input type="number" step="0.05" min="0" data-ns="${r.name}" data-f="rmult"  oninput="devSetNsRate(this)">
      <input type="number" step="1"    min="1" data-ns="${r.name}" data-f="revery" oninput="devSetNsRate(this)">
      <input type="checkbox" class="dev-ns-alt" data-ns="${r.name}" data-f="ralt"  onchange="devSetNsRate(this)">
      <input type="number" step="1"    min="0" data-ns="${r.name}" data-f="pips"   oninput="devSetNsBonus(this)">
      <input type="number" step="0.25" min="0" data-ns="${r.name}" data-f="mult"   oninput="devSetNsBonus(this)">
      <span class="dev-ns-plays"></span>
    </div>`).join('');
  }
  // Values are written separately from the markup so a live field is only
  // updated when it is not the one being typed in.
  const V = { rpips: r => r.rate.pips, rmult: r => r.rate.mult, revery: r => r.rate.every,
              pips: r => r.pips, mult: r => r.mult };
  rows.forEach(r => {
    host.querySelectorAll(`[data-ns="${CSS.escape(r.name)}"]`).forEach(inp => {
      if (inp === document.activeElement) return;
      if (inp.dataset.f === 'ralt') inp.checked = !!r.rate.alt;
      else inp.value = V[inp.dataset.f](r);
    });
    const row = host.querySelector(`[data-nsrow="${CSS.escape(r.name)}"]`);
    if (!row) return;
    // A row the owner has moved off the shipped table is marked, so "what have I
    // actually changed" is answerable without diffing against the source.
    row.classList.toggle('dev-ns-tuned', !!r.tuned);
    const pl = row.querySelector('.dev-ns-plays');
    if (pl) {
      pl.textContent = (r.plays || '0') + ' · ' + r.growth.toFixed(1) + '%';
      pl.title = r.plays + ' played this run · this hand grows ' + r.growth.toFixed(2)
               + '% of its own worth per play';
    }
  });
}
// The accumulator - what this hand carries NOW.
function devSetNsBonus(inp) {
  setNaturalScaleBonus(inp.dataset.ns, inp.dataset.f, inp.value);
  const st = document.getElementById('dev-ns-state');
  if (st) st.textContent = naturalScaleSummary();
  _devSafeRender();   // the live PIPS/MULT chips quote it, so repaint
}
// The rate - how fast it grows from here. `devSyncNs` is NOT called: it would
// rewrite every field in the table, and the growth readout is refreshed here
// instead so the field being typed in is left alone.
function devSetNsRate(inp) {
  const f = { rpips: 'pips', rmult: 'mult', revery: 'every', ralt: 'alt' }[inp.dataset.f];
  setNaturalScaleRate(inp.dataset.ns, f, f === 'alt' ? inp.checked : inp.value);
  devRenderNsRows();
}

// ── Layered hands (r198) - state lives in js/hand-detect.js ──
// A big balance lever (a same-suit run pays two hands' base AND replays every
// card), so it gets a switch rather than being a fact of the game.
function devSetLayeredHands(on) {
  layeredHandsEnabled = !!on;
  localStorage.setItem('layeredHands', on ? '1' : '0');
  const chk = document.getElementById('dev-layered-enabled'); if (chk) chk.checked = layeredHandsEnabled;
  _devSafeRender();
}
// How many cards of one suit a hand needs before the flush overlay pays. At 3 it
// fires on about half of all five-card hands, which is the intent; 4 or 5 makes
// it something you have to build for again.
function devSetFlushOverlayMin(v) {
  flushOverlayMin = Math.max(3, Math.min(7, parseInt(v, 10) || 3));
  localStorage.setItem('flushOverlayMin', flushOverlayMin);
  const lab = document.getElementById('dev-flushmin-val'); if (lab) lab.textContent = flushOverlayMin;
  _devSafeRender();
}
function devSyncNs() {
  const chk = document.getElementById('dev-ns-enabled'); if (chk) chk.checked = nsEnabled;
  const st = document.getElementById('dev-ns-state');
  if (st) st.textContent = naturalScaleSummary();
  const lay = document.getElementById('dev-layered-enabled'); if (lay) lay.checked = layeredHandsEnabled;
  const fm = document.getElementById('dev-flushmin'); if (fm) fm.value = flushOverlayMin;
  devRenderNsRows();
  const fml = document.getElementById('dev-flushmin-val'); if (fml) fml.textContent = flushOverlayMin;
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
  roundSeconds = Math.max(1, Math.min(crunchNoRoundCap(ROUND_DURATION), roundSeconds + s));
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
  const say = `${limitDeltaText(id, 1)} ${LIMITS_DEF.find(d=>d.id===id)?.label}`;   // before the increment
  const ok = incrementLimit(id);
  if (ok) showMessage(say, 'var(--gold)');
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

// ══════════════════════════════════════════════
// GOALS  (r197)  -  the round-goal curve, live
// ══════════════════════════════════════════════
// Same shape as FOCUS_TUNABLES: one table drives the rows, the persistence and
// the reset. Values live in js/goal-tuning.js; every set() re-applies the curve
// to the round in progress, so a change is visible without restarting the run.

const GOAL_TUNABLES = {
  global: [
    { key: 'globalMult', label: 'Multiply every mode’s goal by',
      min: 0.1, max: 10, step: 0.05, dp: 2, unit: 'x',
      get: () => goalTune('globalMult'), set: v => setGoalTune('globalMult', v) },
  ],
  classic: [
    { key: 'classicBase', label: 'Round 1 goal',
      min: 100, max: 100000, step: 100, dp: 0, unit: '',
      get: () => goalTune('classicBase'), set: v => setGoalTune('classicBase', v) },
    { key: 'classicGrowth', label: 'Harder each round by',
      min: 0, max: 200, step: 1, dp: 1, unit: '%',
      get: () => goalTune('classicGrowth'), set: v => setGoalTune('classicGrowth', v) },
    { key: 'classicGrowthLate', label: 'Late-game growth per round',
      min: 0, max: 200, step: 1, dp: 1, unit: '%',
      get: () => goalTune('classicGrowthLate'), set: v => setGoalTune('classicGrowthLate', v) },
    { key: 'classicLateStart', label: 'Late growth starts at round',
      min: 2, max: 60, step: 1, dp: 0, unit: '',
      get: () => goalTune('classicLateStart'), set: v => setGoalTune('classicLateStart', v) },
    { key: 'classicRoundTo', label: 'Round the goal to the nearest',
      min: 1, max: 5000, step: 50, dp: 0, unit: '',
      get: () => goalTune('classicRoundTo'), set: v => setGoalTune('classicRoundTo', v) },
  ],
  survival: [
    { key: 'survivalBase', label: 'Round 1 goal',
      min: 100, max: 100000, step: 100, dp: 0, unit: '',
      get: () => goalTune('survivalBase'), set: v => setGoalTune('survivalBase', v) },
    { key: 'survivalGrowth', label: 'Harder each round by',
      min: 0, max: 200, step: 1, dp: 1, unit: '%',
      get: () => goalTune('survivalGrowth'), set: v => setGoalTune('survivalGrowth', v) },
    { key: 'survivalRoundTo', label: 'Round the goal to the nearest',
      min: 1, max: 5000, step: 10, dp: 0, unit: '',
      get: () => goalTune('survivalRoundTo'), set: v => setGoalTune('survivalRoundTo', v) },
    { key: 'endlessAccel', label: 'Endless mode grows faster by',
      min: 1, max: 5, step: 0.05, dp: 2, unit: 'x',
      get: () => goalTune('endlessAccel'), set: v => setGoalTune('endlessAccel', v) },
  ],
  other: [
    { key: 'mapGrowth', label: 'Schedule: harder each level by',
      min: 0, max: 200, step: 1, dp: 1, unit: '%',
      get: () => goalTune('mapGrowth'), set: v => setGoalTune('mapGrowth', v) },
    { key: 'zenMult', label: 'Zen (no clock) multiplies the classic goal by',
      min: 0.5, max: 10, step: 0.25, dp: 2, unit: 'x',
      get: () => goalTune('zenMult'), set: v => setGoalTune('zenMult', v) },
  ],
};

function _devFindGoalTunable(key) {
  for (const group of Object.values(GOAL_TUNABLES)) {
    const t = group.find(x => x.key === key);
    if (t) return t;
  }
  return null;
}

// dir: -1 / +1 to step, 0 to take the typed value.
function devTuneGoal(key, dir, typed) {
  const t = _devFindGoalTunable(key);
  if (!t) return;
  let v = (dir === 0) ? parseFloat(typed) : t.get() + dir * t.step;
  if (!isFinite(v)) v = t.get();
  v = Math.min(t.max, Math.max(t.min, +v.toFixed(4)));
  t.set(v);
  devGoalApplyAndRender();
}

function devResetGoalTune() { resetGoalTune(); devGoalApplyAndRender(); }

// Every change moves the live round's bar too - that is the point of tuning here
// rather than in the data files. applyGoalTuneLive() reports what it did (or why
// it held off, during a boss).
function devGoalApplyAndRender() {
  const line = applyGoalTuneLive();
  devRenderGoalPanel(line);
  devRenderGroupMenu();
}

function devGoalGroupSub() {
  const g1 = classicGoalForLevel(1);
  return `R1 ${g1.toLocaleString()} · +${(+goalTune('classicGrowth')).toFixed(0)}%/round`
       + (goalTuneTouched() ? ' · tuned' : '');
}

// A curve is only readable as a list of what it actually asks for, so both
// previews print the real goals and the round-1 multiple at the far end.
function _devGoalCurveLine(fn, rounds) {
  const vals = rounds.map(fn);
  const grow = vals[vals.length - 1] / Math.max(1, vals[0]);
  return rounds.map((r, i) => `R${r}: ${vals[i].toLocaleString()}`).join('  ·  ')
       + `\n(R${rounds[rounds.length - 1]} is ${grow.toFixed(1)}x round 1)`;
}

function devRenderGoalPanel(liveLine) {
  const fill = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  ['global', 'classic', 'survival', 'other'].forEach(g =>
    fill('dev-goal-' + g + '-rows', GOAL_TUNABLES[g].map(t => _devStepper(t, 'devTuneGoal')).join('')));

  fill('dev-goal-classic-preview', _devGoalCurveLine(classicGoalForLevel, [1, 2, 3, 6, 9, 12, 15, 18]));

  // survivalGoalForLevel reads the run's endless state, so the preview is the
  // ordinary (pre-endless) curve unless the live run has already switched.
  fill('dev-goal-survival-preview', _devGoalCurveLine(survivalGoalForLevel, [1, 2, 3, 5, 8, 11, 14, 17]));

  const live = (typeof roundGoal === 'number' && typeof level === 'number' && typeof gridData !== 'undefined'
                && Array.isArray(gridData) && gridData.length)
    ? `Live: round ${level}, goal ${roundGoal.toLocaleString()}` : 'No run in progress';
  fill('dev-goal-live', live + (liveLine ? `\n${liveLine}` : ''));
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
      <span class="dev-trick-name">${j.emoji} ${j.name} <span style="color:var(--gold-dim);font-size:9px">${tierLabel('sleight', j.rarity)}</span>${owned?' ✓':''}</span>
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


// ── Improve (r206) - entity tiers ────────────────────────────────────────────
// The tier system's test surface: see what you own, what tier it is at, and
// what one more improvement would read as, without waiting for a reward grid.
// ── Card states (r278) ──────────────────────────────────────────────────────
// The only grant path outside the Hallmark knack today. Pick a state here, then
// tap a card on the board: the tap intercept lives in js/input.js and is armed
// only while devCardStatePick is set, so it can never interfere with ordinary
// play.
let devCardStatePick = null;

function devCardStateSub() {
  try {
    const n = Object.keys(cardStates || {}).length;
    const t = cardStateBoardCards().filter(([c]) => isTempCard(c)).length;
    return `${cardStateIds().length} states \u00b7 ${n} charged \u00b7 ${t} temp on board`;
  } catch (e) { return 'per-card charges'; }
}

function devRenderCardStates() {
  const el = document.getElementById('dev-card-state-list');
  if (!el) return;
  el.innerHTML = cardStateIds().map(id => {
    const d = cardStateDef(id);
    const on = devCardStatePick === id;
    return `<button class="dev-btn" style="display:block;width:100%;text-align:left;margin-bottom:3px;`
         + `border-color:${on ? d.color : 'rgba(255,255,255,0.18)'};color:${on ? d.color : ''}"`
         + ` onclick="devPickCardState('${id}')">`
         + `<b>${d.icon} ${d.name}</b>${d.fuse ? ` <span style="opacity:.6">fuse ${d.fuse}s</span>` : ''}`
         + `<br><span style="font-size:9px;opacity:.75">${d.desc}</span></button>`;
  }).join('');
  devRenderCardStateBoard();
}

function devRenderCardStateBoard() {
  const el = document.getElementById('dev-card-state-board');
  if (!el) return;
  const rows = [];
  try {
    cardStateBoardCards().forEach(([card, r, c]) => {
      const list = cardStateList(card);
      if (!list.length && !isTempCard(card)) return;
      const idle = cardIdleSecs[cardId(card)] || 0;
      rows.push(`${card.rank}${card.suit} @${r},${c}`
        + (isTempCard(card) ? ' <span style="color:#7ac4ff">TEMP</span>' : '')
        + (list.length ? ' \u00b7 ' + list.map(s => `${s.def.name}${s.n > 1 ? ' x' + s.n : ''}`).join(', ') : '')
        + ` \u00b7 idle ${idle}s`);
    });
  } catch (e) { rows.push('(no board)'); }
  el.innerHTML = rows.length ? rows.join('<br>') : '<span style="opacity:.6">nothing charged on the board</span>';
}

function devPickCardState(id) {
  devCardStatePick = (devCardStatePick === id) ? null : id;
  devRenderCardStates();
  if (devCardStatePick) showMessage(`Tap a card to make it ${cardStateDef(id).name}`, 'var(--gold)');
}

// Consumed by the tap intercept in js/input.js. Returns true if it took the tap.
function devCardStateApplyTap(r, c) {
  if (!devCardStatePick) return false;
  const card = gridData[r]?.[c];
  if (!card || !card.rank || card._isSleight || card._isStone || card._isTrick) return false;
  const d = cardStateDef(devCardStatePick);
  addCardState(card, devCardStatePick, 1);
  showMessage(`${d.icon} ${card.rank}${card.suit} is ${d.name}`, d.color);
  devCardStatePick = null;
  devRenderCardStates();
  render();
  return true;
}

function devCardStateRandom() {
  const pool = cardStateBoardCards();
  if (!pool.length) { showMessage('No board to charge', 'var(--red)'); return; }
  const [card] = pool[Math.floor(Math.random() * pool.length)];
  const ids = cardStateIds();
  const id = ids[Math.floor(Math.random() * ids.length)];
  addCardState(card, id, 1);
  showMessage(`${cardStateDef(id).icon} ${card.rank}${card.suit} is ${cardStateDef(id).name}`, cardStateDef(id).color);
  devRenderCardStates(); render();
}

// Swap a board card for a temp copy of itself, so the temp look and the
// evaporate-at-level-end rule can be checked without waiting for a Backfill.
function devMakeTempCard() {
  const pool = cardStateBoardCards().filter(([c]) => !isTempCard(c));
  if (!pool.length) { showMessage('No ordinary card on the board', 'var(--red)'); return; }
  const [card, r, c] = pool[Math.floor(Math.random() * pool.length)];
  discardToDrawPile(card);
  gridData[r][c] = makeTempCard(card.rank, card.suit, null);
  showMessage(`Temp ${card.rank}${card.suit} on the board`, '#7ac4ff');
  devRenderCardStates(); render(); updateDeckHud();
}

function devClearCardStates() {
  cardStatesResetRun();
  showMessage('Card states cleared', 'var(--cream-dim)');
  devRenderCardStates(); render();
}

function devImproveSub() {
  try {
    const n = ['trick','knack','sleight'].reduce((a,t) => a + ownedImprovable(t).length, 0);
    const up = Object.values(entityTier || {}).filter(v => v > 0).length;
    return `${n} improvable · ${up} improved`;
  } catch (e) { return 'entity tiers'; }
}

function devRenderImprove() {
  const el = document.getElementById('dev-improve-list');
  if (!el) return;
  const rows = [];
  ['trick','knack','sleight'].forEach(type => {
    const owned = (typeof ownedImprovable === 'function') ? ownedImprovable(type) : [];
    rows.push(`<div style="margin:6px 0 2px;opacity:.7;font-size:10px;letter-spacing:.08em">${type.toUpperCase()} (${owned.length})</div>`);
    if (!owned.length) { rows.push('<div style="opacity:.45;font-size:11px">none owned that can improve</div>'); return; }
    owned.forEach(o => {
      const t = entityTierOf(o.id);
      const pv = improvePreview(o.id);
      rows.push(`<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
        <button class="dev-btn" style="padding:2px 7px" onclick="devImproveOne('${o.id}')">+1</button>
        <span style="min-width:118px;font-size:11px">${o.name}</span>
        <span style="opacity:.6;font-size:10px">tier ${t}/${IMPROVE_MAX_TIER}</span>
        <span style="opacity:.5;font-size:10px;flex:1">${(typeof improveDeltaFor === 'function' && improveDeltaFor(o.id)) || (pv ? pv.after : '')}</span></div>`);
    });
  });
  el.innerHTML = rows.join('');
}

function devImproveOne(id) {
  if (typeof improveEntity === 'function') improveEntity(id);
  if (typeof renderTrickTray === 'function') renderTrickTray();
  if (typeof updateKnackList === 'function') updateKnackList();
  devRenderImprove();
}
function devImproveRandom(type) {
  const pick = (typeof pickImproveTarget === 'function') ? pickImproveTarget(type) : null;
  if (!pick) { showMessage(`No ${type} to improve`, 'var(--red)'); return; }
  devImproveOne(pick.id);
  showMessage(`\u2191 ${pick.name} improved`, 'var(--gold)');
}
function devResetImprove() {
  if (typeof resetEntityTiers === 'function') resetEntityTiers();
  if (typeof renderTrickTray === 'function') renderTrickTray();
  if (typeof updateKnackList === 'function') updateKnackList();
  devRenderImprove();
}
