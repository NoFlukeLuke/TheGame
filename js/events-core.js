const CONFLUENCE_THEMES = [
  { id:'time',      icon:'⏱',  name:'Time',      desc:'Bend the clock.',           trickTags:['time'],              knackIds:['time_bank','free_swaps','free_discards'], sleightTags:['time'] },
  { id:'suits',     icon:'♥',  name:'Suits',     desc:'One family, one purpose.',  trickTags:['suit'],              knackIds:[],                                        sleightTags:['suit'] },
  { id:'resources', icon:'🔄', name:'Resources', desc:'Discards and swaps as power.', trickTags:['resource','discard'], knackIds:['hoarder','steady_hand'],             sleightTags:['resource'] },
  { id:'focus',     icon:'🎯', name:'Focus',     desc:'Concentration unlocks mastery.', trickTags:['focus'],         knackIds:['lucky_seven','combo_keeper'],           sleightTags:['focus'] },
  { id:'scaling',   icon:'📈', name:'Scaling',   desc:'Grow stronger with each hand.', trickTags:['scaling','mult'], knackIds:[],                          sleightTags:['scaling'] },
];

// Shared mutable state for the active event
let eventState = {};
let activeEventId = null;
// afterEvent callback - called by closeEvent to continue game flow
let afterEventFn = null;

function openEvent(afterFn) {
  afterEventFn = afterFn || (() => drainLevelUpQueue());
  const pool = ['confluence','crossroads','gamble','merchant','altar','spring','twin_path','forge','bargain','wager','shift_change'];
  activeEventId = pool[Math.floor(Math.random() * pool.length)];
  eventState = {};
  renderEventShell(activeEventId);
  document.getElementById('event-overlay').classList.add('show');
}

function closeEvent() {
  document.getElementById('event-overlay').classList.remove('show');
  // Core Memories knack: each Event attended permanently raises max Focus
  if (typeof hasKnack === 'function' && hasKnack('core_memories')) {
    focusCapPerm += 2;
    if (typeof showMessage === 'function') showMessage('Core Memories! +2 max Focus', '#a25cd8');
  }
  activeEventId = null;
  eventState = {};
  const fn = afterEventFn;
  afterEventFn = null;
  if (fn) fn();
}

function setEventConfirm(enabled) {
  const btn = document.getElementById('event-confirm');
  if (btn) btn.disabled = !enabled;
}

function confirmEvent() {
  if (!activeEventId) return;
  const handlers = {
    confluence:  confirmConfluence,
    crossroads:  confirmCrossroads,
    gamble:      confirmGamble,
    merchant:    confirmMerchant,
    altar:       confirmAltar,
    spring:      confirmSpring,
    twin_path:   confirmTwinPath,
    forge:       confirmForge,
    bargain:     confirmBargain,
    wager:       confirmWager,
    shift_change: confirmShiftChange,
  };
  if (handlers[activeEventId]) handlers[activeEventId]();
  else closeEvent();
}

// ─── Shell renderer ───
const EVENT_META = {
  confluence: { name:'The Confluence',      flavor:'Choose a keyword. Then choose your reward.' },
  crossroads:  { name:'The Crossroads',      flavor:'Every gain demands a sacrifice. Choose wisely.' },
  gamble:      { name:'The Gamble',          flavor:'Fortune favours the bold.' },
  merchant:    { name:'Wandering Merchant',  flavor:'A rare visitor offers wares unavailable elsewhere.' },
  altar:       { name:'The Altar',           flavor:'Invest now. Reap rewards across the coming rounds.' },
  spring:      { name:'Cleansing Spring',    flavor:'The water runs clear. Something may be washed away.' },
  twin_path:   { name:'Twin Path',           flavor:'Two gifts. One shadow.' },
  forge:       { name:'The Forge',           flavor:'Heat, hammer, and a card made mighty.' },
  bargain:     { name:'The Bargain',         flavor:'Every gain has its price in flesh.' },
  wager:       { name:'The Wager',           flavor:'One flip. Fortune or ruin.' },
  shift_change:{ name:'Shift Change',        flavor:'Same crew, new rota. Put your Tricks in the order you want them.' },
};

function renderEventShell(id) {
  const meta = EVENT_META[id];
  document.getElementById('event-name').textContent   = meta.name;
  document.getElementById('event-flavor').textContent = meta.flavor;
  document.getElementById('event-body').innerHTML = '';
  document.getElementById('event-confirm').disabled = true;
  document.getElementById('event-skip').style.display = 'inline-block';
  document.getElementById('event-skip').textContent = 'Skip';
  const renderers = {
    confluence: renderConfluence,
    crossroads:  renderCrossroads,
    gamble:      renderGamble,
    merchant:    renderMerchant,
    altar:       renderAltar,
    spring:      renderSpring,
    twin_path:   renderTwinPath,
    forge:       renderForge,
    bargain:     renderBargain,
    wager:       renderWager,
    shift_change: renderShiftChange,
  };
  if (renderers[id]) renderers[id]();
  // The panel scrolls internally and is reused between events - reopening it
  // where the last one left off would hide the title under the sticky bar.
  const panel = document.getElementById('event-panel');
  if (panel) panel.scrollTop = 0;
}

// ─── helper: build a choice card DOM element ───
// The rarity is not just a word printed on the tile - it sets `rar-<tier>`,
// which is what gives the tile its --rc neon edge in css/dev-overlays.css. Same
// five tiers, same five colours as a reward-grid tile, so an epic looks like an
// epic wherever you meet it. Anything off the tier list (or a debuff, which owns
// its own red) is left uncoloured rather than guessed at.
const EV_TIERS = ['common', 'rare', 'epic', 'legendary', 'mythic'];

function makeChoiceEl(opts) {
  // opts: { icon, rarity, name, desc, cost, cls, onClick }
  const div = document.createElement('div');
  const rar = String(opts.rarity || '').toLowerCase();
  div.className = 'event-choice'
    + (EV_TIERS.includes(rar) ? ' rar-' + rar : '')
    + (opts.cls ? ' ' + opts.cls : '');
  div.innerHTML = `
    <div class="ec-top">
      <div class="ec-icon">${opts.icon || '★'}</div>
      <div class="ec-info">
        <div class="ec-rarity">${opts.rarity || ''}</div>
        <div class="ec-name">${opts.name}</div>
      </div>
    </div>
    <div class="ec-desc">${colorizeKeywords(opts.desc || '')}</div>
    ${opts.cost ? `<div class="ec-cost">${opts.cost}</div>` : ''}
  `;
  if (opts.onClick) div.addEventListener('click', opts.onClick);
  return div;
}

// ─── helper: the three bits of chrome every event body reuses ───
// These were a dozen near-identical inline cssText strings scattered through
// js/events.js, which is how the events drifted apart in the first place.
function evLabel(text, danger) {
  const d = document.createElement('div');
  d.className = 'ev-label' + (danger ? ' danger' : '');
  d.textContent = text;
  return d;
}
function evNote(html) {
  const d = document.createElement('div');
  d.className = 'ev-note';
  d.innerHTML = html;
  return d;
}
function evEmptyHTML(text) { return `<div class="ev-empty">${text}</div>`; }

// ══════════════════════════════════════════════
// EVENT: CONFLUENCE
// ══════════════════════════════════════════════
