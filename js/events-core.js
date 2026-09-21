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

// The last few events shown, so one cannot repeat straight after itself. Classic
// routes to an event rarely enough that a bare random draw was fine; Guided runs
// four an act plus two after every boss - about 12 a run against a pool of 11 -
// where a repeat, and especially the same event twice in the post-boss pair, is
// otherwise near certain.
let recentEventIds = [];
const EVENT_NO_REPEAT = 4;

// ══════════════════════════════════════════════
// EVENT ELIGIBILITY (r248) - an event you cannot use is never OFFERED
// ══════════════════════════════════════════════
// Sixteen renderers open with a guard and an `evEmptyHTML` consolation - "Not
// enough Tricks or Sleights to fill the reels. Take the fee instead." Every one
// was reachable, because **nothing anywhere asked whether an event could do
// anything before offering it**: not openEvent's pool, not Guided's crossroads,
// not the map's tile fill.
//
// In Classic that is a wasted screen. In Guided it is worse: the crossroads NAMES
// the event, charges `price_event` AND a slot, and `guidedAdvanceCurve` moves the
// quota - so an Entity Slots with one improvable entity cost 6 credits, a whole
// slot and a level of goal scaling to pay 12 credits back. On the map it spends a
// tile out of a 12-slot budget. Owner's call: that node should not exist until
// you qualify for it.
//
// **THE TABLE IS THE ONE ANSWER AND THE RENDERERS READ IT.** Each predicate is
// the renderer's OWN guard condition, and each gated renderer's guard is
// rewritten to call `eventEligible` rather than to repeat the test - so the offer
// filter and the empty state cannot disagree about what "usable" means. A second
// copy of the condition is precisely how the two would drift.
//
// **Not every empty state is an ENTRY gate.** The Confluence's "Nothing left in
// this theme" fires after a theme has been picked, and the Merchant builds its
// list inside the event; those screens still have a decision on them, so they
// stay ungated. Only an event that would open with nothing to do at all is
// listed, and **an id absent from the table is ELIGIBLE** - a missing row must
// never silently remove an event from the game.
const EVENT_REQUIRES = {
  // Crunch only: everywhere else the clock is a ROUND's and it refills, so +90s
  // is either most of a round for a downside that bites next round, or clamped
  // away. See js/crunch-mode.js.
  overtime:     () => (typeof crunchActive === 'function') && crunchActive(),
  // Needs a Trick to reorder / rehearse / reassign, or a trade to offer.
  crossroads:   () => buildCrossroadsTrades().length > 0,   // it has NO consolation: an empty build is a blank panel
  rehearsal:    () => trickTrayMode && (trickTray || []).length > 0,
  reassignment: () => trickTrayMode && (trickTray || []).length > 0,
  // Tray ORDER is the whole screen, so one Trick is not a decision.
  shift_change: () => trickTrayMode && (trickTray || []).length >= 2,
  // Needs something improvable to stake or to spin between.
  the_draw:     () => evImprovables().length >= 2,
  the_payline:  () => evImprovables().length >= 2,
  // Needs a Sleight whose charge ceiling can actually move (infinite returns null).
  workshop:     () => allOwnedSleightCards().filter(c => sleightMaxCharges(sleightDef(c)) !== null).length > 0,
  // Needs cards to work on.
  the_floor:    () => everyDeckCard().length >= SLOT_REELS,
  bench:        () => drawPile.some(c => c && c.rank && !c._isSleight),
  deck_trim:    () => springCuttableCards().length > 0,
  market:       () => allDeckCards().length > 0,
  forge:        () => allDeckCards().length > 0,
  wager:        () => allDeckCards().length > 0,
  // Needs a liability on the record to clear.
  clean_slate:  () => CLEAN_SLATE_FIXES.some(f => { try { return f.has(); } catch (e) { return false; } }),
};

// An id with no row is eligible. A predicate that THROWS is eligible too: the
// table must never be able to delete an event from the game by being wrong about
// it, and the renderer's own consolation is still there to catch that case.
function eventEligible(id) {
  const req = EVENT_REQUIRES[id];
  if (!req) return true;
  try { return !!req(); } catch (e) { return true; }
}

// The ids worth offering right now, in the order given. Every draw site filters
// through this; falling back to the unfiltered list is deliberate, the same rule
// `recentEventIds` follows - never hand back an empty pool.
function eligibleEventIds(ids) {
  const list = ids || Object.keys(EVENT_META);
  const ok = list.filter(eventEligible);
  return ok.length ? ok : list;
}

function openEvent(afterFn) {
  afterEventFn = afterFn || (() => drainLevelUpQueue());
  const pool = ['confluence','crossroads','gamble','merchant','altar','spring','twin_path','forge','bargain','wager','shift_change','bench','rehearsal','workshop','market','deck_trim','reassignment','the_draw','the_floor','the_payline','clean_slate','overtime'];
  // Fall back to the full pool if the memory has eaten it - never draw a blank.
  const usable = eligibleEventIds(pool);
  const fresh = usable.filter(id => !recentEventIds.includes(id));
  const draw  = fresh.length ? fresh : usable;
  activeEventId = draw[Math.floor(Math.random() * draw.length)];
  recentEventIds.push(activeEventId);
  if (recentEventIds.length > EVENT_NO_REPEAT) recentEventIds.shift();
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
    overtime:    confirmOvertime,
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
    bench:       confirmBench,
    rehearsal:   confirmRehearsal,
    workshop:    confirmWorkshop,
    market:      confirmMarket,
    deck_trim:   confirmDeckTrim,
    reassignment: confirmReassignment,
    the_draw:    confirmDraw,
    the_floor:   confirmFloor,
    the_payline: confirmPayline,
    clean_slate: confirmCleanSlate,
  };
  if (handlers[activeEventId]) handlers[activeEventId]();
  else closeEvent();
}

// ─── Shell renderer ───
// NAMES SAY WHAT THE SCREEN DOES (r211). These were high-fantasy - The Altar,
// Cleansing Spring, Blood Price, "Every gain has its price in flesh" - against a
// game whose voice was stripped to plain and direct in r178. A player meeting an
// event for the first time should be able to read the title and know what they
// are about to be asked. The flavour line is one sentence of the same.
//
// The KEYS are unchanged and must stay unchanged: they are the event ids used by
// openEvent's pool, confirmEvent's handler map, renderEventShell's renderer map,
// recentEventIds and the dev panel's generated list.
const EVENT_META = {
  overtime:    { name:'Overtime',         flavor:'Ninety seconds back. It comes out of something else.' },
  confluence:  { name:'Theme Draft',     flavor:'Pick a theme. Then pick one reward from it.' },
  crossroads:  { name:'The Trade',       flavor:'Every offer here gives you something and takes something.' },
  gamble:      { name:'The Gamble',      flavor:'Pick blind. One of these is worth having.' },
  merchant:    { name:'Free Pick',       flavor:'Three items you will not see in the Mart. Take one, no charge.' },
  altar:       { name:'The Investment',  flavor:'Pay now. It pays you back over the next few rounds.' },
  spring:      { name:'Clean Up',        flavor:'Cut cards out of your deck, or put back what you have lost.' },
  twin_path:   { name:'Two and a Catch', flavor:'Two Tricks. One downside, and you cannot refuse it.' },
  forge:       { name:'Card Upgrade',    flavor:'Three upgrades, each already assigned to a card. Take one.' },
  bargain:     { name:'The Price',       flavor:'Every offer here costs you something first.' },
  wager:       { name:'Coin Flip',       flavor:'Even odds. You pick how much is riding on it.' },
  shift_change:{ name:'Tray Order',      flavor:'Put your Tricks in the order you want them to fire.' },
  bench:       { name:'Pick a Card',     flavor:'Choose the upgrade, then choose the card it goes on.' },
  rehearsal:   { name:'Extra Rep',       flavor:'One Trick fires an extra time, every hand, for the rest of the run.' },
  workshop:    { name:'Maintenance',     flavor:'Top up every Sleight, or raise one charge ceiling for good.' },
  market:      { name:'Card Market',     flavor:'Buy cards for your deck. Each one comes with something extra.' },
  deck_trim:   { name:'Deck Trim',       flavor:'A thinner deck draws what you need more often. Cut as deep as you can pay for.' },
  reassignment:{ name:'Trade a Trick',   flavor:'Give up a Trick. It comes back as a Knack or a Sleight, picked at random.' },
  the_draw:    { name:'Spin to Improve', flavor:'Choose three of your own. The wheel picks one and improves it twice.' },
  the_floor:   { name:'Card Slots',      flavor:'Your deck on five reels. Buy lines, and a winning line upgrades the cards that made it.' },
  clean_slate: { name:'Clean Slate',      flavor:'One penalty comes off your record for good.' },
  the_payline: { name:'Entity Slots',    flavor:'Three reels of what you own. Three alike and it improves a tier.' },
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
    overtime:    renderOvertime,
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
    bench:       renderBench,
    rehearsal:   renderRehearsal,
    workshop:    renderWorkshop,
    market:      renderMarket,
    deck_trim:   renderDeckTrim,
    reassignment: renderReassignment,
    the_draw:    renderDraw,
    the_floor:   renderFloor,
    the_payline: renderPayline,
    clean_slate: renderCleanSlate,
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
const EV_TIERS = ['common', 'rare', 'epic', 'legendary'];

function makeChoiceEl(opts) {
  // opts: { icon, rarity, name, desc, cost, cls, tile, onClick }
  //
  // `tile` is what makes an Event show you the real object (r211). When the
  // offer IS an entity - a Trick, a Sleight, a Knack - pass
  // { entity:'trick', emoji, label } and the left-hand art becomes the SHARED
  // entity tile (js/entity-tile.js), the same one the reward grid, the Mart, your
  // tray and Shift Change all draw. Before this an Event drew a bare emoji in a
  // disc, so the Trick you were offered and the Trick you then owned were two
  // different-looking things. Anything that is not an entity (a resource, a
  // trade, a downside) still gets the disc, because there is no object to show.
  const div = document.createElement('div');
  const rar = String(opts.rarity || '').toLowerCase();
  // has-tile flips the layout to a COLUMN - object on top, name and desc
  // beneath it (owner spec, r239): an entity offer leads with what the thing
  // will look like in your tray, everywhere, at the object's own ratio.
  div.className = 'event-choice'
    + (EV_TIERS.includes(rar) ? ' rar-' + rar : '')
    + (opts.tile ? ' has-tile' : '')
    + (opts.cls ? ' ' + opts.cls : '');
  const art = (opts.tile && typeof entityTileHTML === 'function')
    ? `<div class="ec-tile">${entityTileHTML(opts.tile, rar || 'common')}</div>`
    : `<div class="ec-icon">${opts.icon || '★'}</div>`;
  div.innerHTML = `
    <div class="ec-top">
      ${art}
      <div class="ec-info">
        <div class="ec-rarity">${opts.rarity || ''}</div>
        <div class="ec-name">${opts.name}</div>
      </div>
    </div>
    <div class="ec-desc">${colorizeKeywords(opts.desc || '')}</div>
    ${opts.cost ? `<div class="ec-cost">${opts.cost}</div>` : ''}
  `;
  if (opts.onClick) div.addEventListener('click', opts.onClick);
  const nm = div.querySelector('.ec-tile .rwd-name');
  if (nm && typeof fitRewardName === 'function') requestAnimationFrame(() => fitRewardName(nm));
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
