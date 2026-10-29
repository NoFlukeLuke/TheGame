// CONFLUENCE_THEMES (tag-based themes) were replaced by ENGINES, js/data/engines.js (r576).

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
// ARCHIVED EVENTS (r576) - kept, never offered
// ══════════════════════════════════════════════
// Owner's cuts after the r482 review (EVENTS.md, "THE OWNER'S VERDICT"). Their
// code stays exactly where it is and the dev panel can still open them, so a cut
// is reversible by deleting a line here. Nothing that DRAWS an event may offer
// one: openEvent, Guided's crossroads, the Schedule's tiles and the Builds
// browser all read liveEventIds(), directly or through eligibleEventIds().
const EVENT_ARCHIVED = new Set([
  'bench',        // Pick a Card: the reward grid's card tile with an extra tap
  'twin_path',    // Two and a Catch: randomness too hard to read (POST_LAUNCH.md)
  'bargain',      // The Price: grid goods on both sides of the trade
  'crossroads',   // The Trade: the same
  'wager',        // the old Coin Flip, replaced by the r576 flip events
]);
// Scheduled events (r706) are never DRAWN: the lore event replaces an opened event
// on its own schedule (evmScheduled, js/events-meta.js).
const EVENT_SCHEDULED = new Set(['lore']);
function liveEventIds() { return Object.keys(EVENT_META).filter(id => !EVENT_ARCHIVED.has(id) && !EVENT_SCHEDULED.has(id)); }

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
  // Once a run, wherever the clock can end a round (js/overtime.js, r562).
  overtime:     () => typeof overtimeOfferable === 'function' && overtimeOfferable(),
  // Needs a Trick to reorder / rehearse / reassign, or a trade to offer.
  crossroads:   () => buildCrossroadsTrades().length > 0,   // it has NO consolation: an empty build is a blank panel
  rehearsal:    () => (trickTray || []).length > 0,
  reassignment: () => (trickTray || []).length > 0,
  // Tray ORDER is the whole screen, so one Trick is not a decision.
  shift_change: () => (trickTray || []).length >= 2 && ownsPositional(),   // r590: only when position matters
  // r644: two position effects whose lines can trade places (js/events.js, Line Shift).
  line_shift:   () => lineShiftEntries().length >= 2,
  // r698: two Tricks or Knacks with a rank condition, and the price (js/rank-editor.js).
  editor:       () => rkEditables().length >= 2 && coins >= rkEditorPrice(),
  // Needs something improvable to stake or to spin between.
  the_draw:     () => evImprovables().length >= 2,
  the_payline:  () => evImprovables().length >= ENTITY_SLOT_MIN,   // r590: five entities
  // Needs a Sleight whose charge ceiling can actually move (infinite returns null).
  workshop:     () => allOwnedSleightCards().filter(c => sleightCapOf(c) !== null).length > 0,
  // r576: Theme Draft needs one engine with a Trick and a Sleight left to offer.
  confluence:   () => confluenceThemes().length > 0,
  // Needs cards to work on.
  the_floor:    () => floorRanks().length >= 2,
  bench:        () => drawPile.some(c => c && c.rank && !c._isSleight),
  deck_trim:    () => everyDeckCard().length > 0 && coins >= priceOf(BAL.deck_trim.step),
  market:       () => coins >= marketCardPrice(),   // r576: one card is the least you can buy
  forge:        () => allDeckCards().length > 0,
  plinko:       () => allDeckCards().length > 0,
  // r578: something rare-or-better left to offer.
  // r579
  wild_cards:   () => wildCardCount() > 0 && wildCardsOptions().length > 0 && deckWildCount() > 0,
  trick_gamble: () => trickGambleChoices().length >= 2,
  reschedule:   () => isActMode() && bossesEnabled() && rescheduleBosses().length > 0 && coins >= reschedulePrice(),
  grid_spinner: () => LIMITS_DEF.some(d => limitCanIncrement(d.id)),
  state_change: () => everyDeckCard().length > 0 && coins >= priceOf(BAL.state_change.rare),
  rewire:       () => everyDeckCard().filter(c => !isWildCard(c) && !c.suit2 && !c.rank2).length >= 2,
  keep_it:      () => { const p = guidedPickPools(); return p.knack.length + p.sleight.length + (trickTrayFull() ? 0 : p.trick.length) > 0; },
  wager:        () => allDeckCards().length > 0,
  // Needs a liability on the record to clear.
  licensing:    () => licensingEligible(),
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
  const list = (ids || liveEventIds()).filter(id => !EVENT_ARCHIVED.has(id));
  const ok = list.filter(eventEligible);
  return ok.length ? ok : list;
}

// opts.exclude: ids this caller cannot host (Flow's chain, r706: events that take the board).
function openEvent(afterFn, opts) {
  afterEventFn = afterFn || (() => drainLevelUpQueue());
  const ex = (opts && opts.exclude) || null;
  const pool = liveEventIds().filter(id => !ex || !ex.has(id));
  // Fall back to the full pool if the memory has eaten it - never draw a blank.
  const usable = eligibleEventIds(pool);
  const fresh = usable.filter(id => !recentEventIds.includes(id));
  const draw  = fresh.length ? fresh : usable;
  activeEventId = draw[Math.floor(Math.random() * draw.length)];
  recentEventIds.push(activeEventId);
  if (recentEventIds.length > EVENT_NO_REPEAT) recentEventIds.shift();
  if (typeof evmScheduled === 'function') activeEventId = evmScheduled(activeEventId);
  eventState = {};
  renderEventShell(activeEventId);
  evShow();
}

function closeEvent() {
  document.getElementById('event-overlay').classList.remove('show');
  evConsoleOff();
  // Core Memories knack: each Event attended permanently raises max Focus
  if (typeof hasKnack === 'function' && hasKnack('core_memories')) {
    focusCapPerm += 2;
    if (typeof showMessage === 'function') showMessage('Core Memories! +2 Focus limit', '#a25cd8');
  }
  activeEventId = null;
  eventState = {};
  const fn = afterEventFn;
  afterEventFn = null;
  if (fn) fn();
}

// The Skip button. An event may react to being skipped (Overtime's gift, js/overtime.js),
// or price it: EVENT_SKIP[id] = { label, run } (r590, owner). Skipping is always allowed;
// a cost takes what you have when you cannot pay all of it.
const EVENT_SKIP = {
  reschedule: { label: () => `Face them · +${priceOf(BAL.reschedule.skip_pay)} credits`,
                run: () => { if (eventState.rsRolls) return; coins += priceOf(BAL.reschedule.skip_pay); updateCoinsUI?.(); } },
  lore:       { label: () => 'Leave', run: () => loreSpend() },
  luck_dice:  { label: () => `Skip · ${priceOf(BAL.luck_dice.skip_cost)} credits`,
                run: () => { coins = Math.max(0, coins - priceOf(BAL.luck_dice.skip_cost)); updateCoinsUI?.(); } },
};
function skipEvent() {
  if (activeEventId === 'overtime' && typeof skipOvertime === 'function') skipOvertime();
  const sk = EVENT_SKIP[activeEventId];
  if (sk) sk.run();
  closeEvent();
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
    line_shift:  confirmLineShift,
    editor:      confirmEditor,
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
    pairs:       confirmPairs,
    keep_it:     confirmKeepIt,
    hot_streak:  confirmLadder,
    prize_ladder: confirmLadder,
    call_it:     confirmCallIt,
    plinko:      confirmPlinko,
    wild_cards:  confirmWildCards,
    trick_gamble: confirmTrickGamble,
    reschedule:  confirmReschedule,
    grid_spinner: confirmGridSpinner,
    static_bonus: confirmStaticBonus,
    luck_dice:   confirmLuckDice,
    state_change: confirmStateChange,
    rewire:      confirmRewire,
    licensing:   confirmLicensing,
    lore:        confirmLore,
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
  overtime:    { name:'Overtime',         flavor:'Longer rounds, for a price.' },
  confluence:  { name:'Theme Draft',     flavor:'One theme. A Trick, a Sleight and a buffed card from it. Take two.' },
  crossroads:  { name:'The Trade',       flavor:'Every offer here gives you something and takes something.' },
  gamble:      { name:'The Gamble',      flavor:'Pick blind. One of these is worth having.' },
  merchant:    { name:'Free Pick',       flavor:'Three pieces that fit what you are building. Take one, free.' },
  altar:       { name:'The Investment',  flavor:'Pay now. It pays you back over the next few rounds.' },
  spring:      { name:'Clean Up',        flavor:'Cut cards out of your deck, or undo a downside.' },
  twin_path:   { name:'Two and a Catch', flavor:'Two Tricks. One downside, and you cannot refuse it.' },
  forge:       { name:'Card Upgrade',    flavor:'A buff that grows every time it scores. Pick two cards; one of them gets it.' },
  bargain:     { name:'The Price',       flavor:'Every offer here costs you something first.' },
  wager:       { name:'Coin Flip',       flavor:'Even odds. You pick how much is riding on it.' },
  shift_change:{ name:'Tray Order',      flavor:'Put your Tricks in the order you want them to fire.' },
  line_shift:  { name:'Line Shift',      flavor:'Move your marked lines. Two effects can trade places.' },
  editor:      { name:'The Editor',      flavor:'Rechoose the ranks one Trick or Knack asks for.' },
  bench:       { name:'Pick a Card',     flavor:'Choose the upgrade, then choose the card it goes on.' },
  rehearsal:   { name:'Extra Rep',       flavor:'Make one Trick fire more. It costs curse cards.' },
  workshop:    { name:'Maintenance',     flavor:'Refill your Sleights, or give them more charges.' },
  market:      { name:'Card Market',     flavor:'Buy cards now, put them on the board when you want them.' },
  deck_trim:   { name:'Deck Trim',       flavor:'' },
  reassignment:{ name:'Trade a Trick',   flavor:'' },
  the_draw:    { name:'Spin to Improve', flavor:'' },
  the_floor:   { name:'Card Slots',      flavor:'' },
  clean_slate: { name:'Clean Slate',      flavor:'' },
  the_payline: { name:'Entity Slots',    flavor:'' },
  pairs:       { name:'Pairs',           flavor:'' },
  // r578: the flip set (js/events-flip.js)
  keep_it:     { name:'Keep It',         flavor:'' },
  hot_streak:  { name:'Hot Streak',      flavor:'' },
  prize_ladder:{ name:'Prize Ladder',    flavor:'' },
  call_it:     { name:'Call It',         flavor:'Pick your path, then call the coin.' },
  plinko:      { name:'Plinko',          flavor:'Drop the ball. Green edits your cards; red curses three.' },
  // r579 (js/events-extra.js)
  wild_cards:  { name:'Wild Cards',      flavor:'Free your wilds, or double them.' },
  trick_gamble:{ name:'Trick Gamble',    flavor:'' },
  reschedule:  { name:'Reschedule',      flavor:'' },
  grid_spinner:{ name:'Grid Spinner',    flavor:'' },
  static_bonus:{ name:'Static Bonus',    flavor:'' },
  luck_dice:   { name:'Luck Dice',       flavor:'' },
  // r580: the structural events
  state_change:{ name:'State Change',    flavor:'Buy a card state and choose the card it goes on.' },
  rewire:      { name:'Rewire',          flavor:'A replay, a second suit or a second rank. Up to three times.' },
  // r706: the collection events (js/events-meta.js)
  licensing:   { name:'Licensing',       flavor:'Buy a Trick\'s license. It can be offered from then on, every run.' },
  lore:        { name:'?',               flavor:'' },
};

function renderEventShell(id) {
  const meta = EVENT_META[id];
  _evTyped = false;   // r672: the title types out once the screen is up
  document.getElementById('event-name').textContent   = meta.name;
  const _fl = document.getElementById('event-flavor');
  _fl.textContent = meta.flavor || '';
  _fl.style.display = meta.flavor ? '' : 'none';   // r590: one explainer per screen
  document.getElementById('event-body').innerHTML = '';
  document.getElementById('event-confirm').disabled = true;
  document.getElementById('event-confirm').textContent = 'Confirm';
  document.getElementById('event-confirm').style.display = '';   // r573: Pairs hides it
  document.getElementById('event-overlay').classList.toggle('ev-pairs', id === 'pairs');   // r573: Pairs zooms its panel down
  document.getElementById('event-skip').style.display = 'inline-block';
  document.getElementById('event-skip').textContent = EVENT_SKIP[id] ? EVENT_SKIP[id].label() : 'Skip';
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
    line_shift:  renderLineShift,
    editor:      renderEditor,
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
    pairs:       renderPairs,
    keep_it:     renderKeepIt,
    hot_streak:  renderHotStreak,
    prize_ladder: renderPrizeLadder,
    call_it:     renderCallIt,
    plinko:      renderPlinko,
    wild_cards:  renderWildCards,
    trick_gamble: renderTrickGamble,
    reschedule:  renderReschedule,
    grid_spinner: renderGridSpinner,
    static_bonus: renderStaticBonus,
    luck_dice:   renderLuckDice,
    state_change: renderStateChange,
    rewire:      renderRewire,
    licensing:   renderLicensing,
    lore:        renderLore,
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
  // opts: { icon, rarity, name, desc, extra, cost, cls, tile, onClick }
  //
  // `extra` is raw HTML dropped in under the description, for an offer whose
  // subject needs SHOWING rather than listing - the Forge's two or three card
  // faces, drawn as the mini playing cards Clean Up already uses. It is kept
  // out of `desc` on purpose: that string goes through colorizeKeywords, and a
  // keyword pass has no business rewriting the inside of a card chip.
  //
  // It shares a WRAPPING ROW with the description rather than taking a line of
  // its own: the sentence and the cards it is about are one thought, and on a
  // stack of three offers a line each is 33px x 3 of a panel that already
  // scrolls. It wraps on its own when the two do not fit side by side.
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
    ${opts.extra
      ? `<div class="ec-descrow"><div class="ec-desc">${colorizeKeywords(opts.desc || '')}</div>${opts.extra}</div>`
      : `<div class="ec-desc">${colorizeKeywords(opts.desc || '')}</div>`}
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
// Mini playing cards for a choice's `extra` row (the Forge's look), one or many.
function evCardChips(cards) {
  const list = (Array.isArray(cards) ? cards : [cards]).filter(Boolean);
  const lab = c => (typeof cardLabel === 'function') ? cardLabel(c) : `${c.rank}${c.suit}`;
  return `<div class="ev-cardchips ec-facerow">${list.map(c =>
    `<span class="ev-cardchip${['♥', '♦'].includes(c.suit) ? ' red' : ''}">${lab(c)}</span>`).join('')}</div>`;
}
function evCardChip(card) { return evCardChips([card]); }
function fmtSigned(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }

// ══════════════════════════════════════════════
// EVENT: CONFLUENCE
// ══════════════════════════════════════════════

// ══ r672 (owner): an event is a SCREEN on the board ════════════════════════
// In console mode (the default skin) the event panel is laid over the board's
// box, the way the Limit Break is (r644, lbConsolePlace): the overlay stays
// body-level and only dims; #event-panel is fixed and zoomed so its px are
// design px, at EV_CONSOLE_ZOOM of the stage's zoom so the panel keeps about
// the width it was written for (a 420px panel in a 322px box). css/board-
// screen.css draws it as the amber glass with the title typed ("> FREE PICK").
// Its own CONFIRM / SKIP row is hidden there: the three keys are borrowed
// (keysTake, js/key-fit.js): PLAY reads the confirm button's word, DISCARD the
// skip button's (Skip, Continue, Leave, Done... a priced skip's cost on a sub
// line), SWAP is idle. They mirror the live buttons, so every renderer's
// disabled / hidden / relabelled state shows without an edit. Outside console
// mode the full-screen panel stays, as the Limit Break's does.
const EV_CONSOLE_ZOOM = 0.82;
let _evTyped = false, _evKeysObs = null;
function evConsoleOn() {
  return typeof trayMachineOn === 'function' && trayMachineOn() && typeof bsStage === 'function';
}
function evShow() {
  const ov = document.getElementById('event-overlay'); if (!ov) return;
  ov.classList.add('show');
  evConsolePlace();
}
function evConsolePlace() {
  const ov = document.getElementById('event-overlay'), panel = document.getElementById('event-panel');
  if (!ov || !panel || !ov.classList.contains('show')) return;
  const S = evConsoleOn() ? bsStage() : null;
  if (!S) { evConsoleOff(); return; }
  const g = bsBoardBox(S), F = EV_CONSOLE_ZOOM;
  ov.classList.add('ev-console');
  // The overlay sits inside #stage, so the cabinet's zoom (k) is already on it
  // (placePauseMenu's rule, js/game-control.js); the panel's own zoom makes up
  // the difference, x F, and its offsets are divided by F: design px x S.z on screen.
  panel.style.cssText = 'zoom:1;';
  const k = (ov.getBoundingClientRect().width / ov.offsetWidth) || 1;
  panel.style.cssText = `position:fixed;zoom:${(S.z * F / k).toFixed(4)};`
    + `left:${((S.sr.left / S.z + g.l) / F).toFixed(2)}px;top:${((S.sr.top / S.z + g.t) / F).toFixed(2)}px;`
    + `width:${(g.w / F).toFixed(2)}px;height:${(g.h / F).toFixed(2)}px;max-width:none;max-height:none;margin:0;`;
  evKeysTake();
  if (!_evTyped) { _evTyped = true; evTypeTitle(); }
}
function evConsoleOff() {
  const ov = document.getElementById('event-overlay'), panel = document.getElementById('event-panel');
  if (ov) ov.classList.remove('ev-console');
  if (panel) panel.style.cssText = '';
  evKeysReturn();
}
function evTypeTitle() {
  const el = document.getElementById('event-name'), panel = document.getElementById('event-panel');
  if (!el || !panel || typeof bsType !== 'function') return;
  const ctl = {};
  bsType(el, ctl);
  const fin = () => { if (ctl.finishTyping) ctl.finishTyping(); panel.removeEventListener('pointerdown', fin, true); };
  panel.addEventListener('pointerdown', fin, true);
}
// The keys read the live buttons. A priced skip ("Face them · +5 credits") puts
// its first part on the key and the rest on a sub line.
function evKeysSpec() {
  const sk = document.getElementById('event-skip'), cf = document.getElementById('event-confirm');
  const shown = b => !!b && getComputedStyle(b).display !== 'none';
  const skT = sk ? sk.textContent.trim() : '', cfT = cf ? (cf.textContent.trim() || 'Confirm') : '';
  const parts = skT.split(/\s*[\u00b7]\s*/), cparts = cfT.split(/\s*[\u00b7]\s*/);
  const cfOn = shown(cf), skOn = shown(sk) && !!skT;
  return {
    play: { ico: '&#10003;', word: cfOn ? cparts[0].toUpperCase() : '', sub: cfOn && cparts[1] ? cparts.slice(1).join(' ') : '', off: !cfOn || cf.disabled,
            title: cfOn ? (cf.disabled ? 'Pick something first' : cf.textContent.trim()) : '',
            fn: () => { if (cfOn && !cf.disabled) cf.click(); else if (typeof refuse === 'function') refuse(); } },
    disc: { ico: '&#8631;', word: skOn ? parts[0].toUpperCase() : '', sub: skOn && parts[1] ? parts.slice(1).join(' ') : '', off: !skOn || !!sk.disabled,
            title: skOn ? skT : '',
            fn: () => { if (skOn && !sk.disabled) sk.click(); else if (typeof refuse === 'function') refuse(); } },
    swap: { word: '', off: true },
  };
}
function evKeysTake() {
  if (typeof keysTake !== 'function') return;
  keysTake(evKeysSpec());
  if (!_evKeysObs) {
    _evKeysObs = new MutationObserver(() => { if (typeof keysTaken === 'function' && keysTaken()) keysTake(evKeysSpec()); });
    const acts = document.getElementById('event-actions');
    if (acts) _evKeysObs.observe(acts, { subtree: true, childList: true, characterData: true, attributes: true });
  }
}
function evKeysReturn() { if (typeof keysReturn === 'function') keysReturn(); }
window.addEventListener('resize', () => { setTimeout(evConsolePlace, 0); setTimeout(evConsolePlace, 400); });
