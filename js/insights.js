// ══════════════════════════════════════════════════════════════════════════
// TIPS (r280) - the second half of the tutorial rework
//
// Owner: "when something that hasn't been explicitly covered comes up, I'd like
// a little tutorial window to show up to offer insight" - and, in the same
// breath, "I don't want to smother the player ... if something seems really
// really obvious, just skip it."
//
// So a tip is ONE LINE, fires ONCE EVER, and is about something the tutorial
// deliberately did not stop for. It says what you are looking at, right when you
// are looking at it, and then never appears again.
//
// ── IT IS POLLED, NOT CALLED ────────────────────────────────────────────────
// Every row is a PREDICATE over globals and DOM that already exist, evaluated by
// one interval. That is the same decision js/tutorial.js made and for the same
// payoff: **this whole file hooks into nothing.** No edits to play-hand.js,
// reward-grid.js, boss.js or any of the twenty places a tip's subject can first
// turn up, no chokepoint to find for a feature that has none, and adding a tip
// is one row rather than a call site somebody has to remember.
//
// The cost is that a predicate runs four times a second forever, so it has to be
// cheap, and it MUST NOT THROW. A throw is caught and read as "not yet", exactly
// as EVENT_REQUIRES treats one: this file may never be able to break the game by
// being wrong about it.
//
// ── IT NEVER BLOCKS PLAY ────────────────────────────────────────────────────
// The tutorial DIMS the screen and GATES input, because it is asking you to do a
// specific thing. A tip is an aside. No dim, no gate, nothing swallowed: the card
// sits beside what it is talking about and the game carries on underneath. That
// difference is the whole reason this is not just more TUTORIAL_STEPS.
//
// ── THE THREE VALVES ────────────────────────────────────────────────────────
// Several conditions are routinely true at once - resume a run at level 12 and a
// dozen rows qualify on the first tick - so a queue alone would be a wall of
// cards, which is the smothering the owner ruled out. Three limits, and all
// three are needed:
//   1. ONE AT A TIME. A queue, never a stack.
//   2. A GAP between them (INSIGHT_GAP), so two never read as one flashing card.
//   3. A CAP PER ROUND (INSIGHT_PER_ROUND). The rest keep until later; they are
//      first-time-ever tips, so there is no hurry and nothing is lost.
//
// ── SHARED IDS ──────────────────────────────────────────────────────────────
// A tip's id IS its handbook topic id (js/info-hub.js), so READ MORE needs no
// mapping table between the two files. A tip with no matching topic simply has
// no READ MORE, which is how a tip about something too small for a topic works.
// ══════════════════════════════════════════════════════════════════════════

const INSIGHT_KEY        = 'lethe.tipsSeen.v1';
const INSIGHT_GAP        = 7000;   // ms between one tip closing and the next opening
const INSIGHT_PER_ROUND  = 2;      // never more than this many in one round
const INSIGHT_TICK       = 400;    // ms between predicate sweeps

let insightsSeen   = new Set();
let insightQueue   = [];
let insightCurrent = null;
let insightTimer   = null;
let insightLastAt  = 0;
let insightThisRound = 0;
let insightEls     = null;

try {
  const raw = JSON.parse(localStorage.getItem(INSIGHT_KEY) || '[]');
  if (Array.isArray(raw)) insightsSeen = new Set(raw);
} catch (e) {}
function _saveInsightsSeen() {
  try { localStorage.setItem(INSIGHT_KEY, JSON.stringify([...insightsSeen])); } catch (e) {}
}

// Settings -> Help -> Tips. Read live rather than cached, so switching it off
// silences the next sweep with no wiring.
function insightsOn() {
  return (typeof SETTINGS === 'undefined') || SETTINGS.tips !== false;
}

// ── the tips ────────────────────────────────────────────────────────────────
// { id, title, body, when(), anchor? }
//   id     - also the handbook topic id, when one exists
//   when() - cheap, side-effect free, and allowed to throw
//   anchor - selector list; the FIRST one with a real rect wins, which is the
//            rule js/payout-fx.js and js/tutorial.js both follow, because plenty
//            of readouts only exist in one orientation
//
// Body prose is written in the GAMER vocabulary and goes through infoText() on
// the way to the screen, so the Wording toggle moves it (r198).
// `screen` says WHERE a tip is allowed to fire, and it defaults to 'board'
// (r284). Without it a tip about the board fires on a screen that has no board:
// `#hand-name` keeps the last hand's markup and `replaysThisRound` stays true
// for the whole round, so `hand_layers` and `replays` both landed on the first
// reward grid, pointing at readouts the reward tiles had covered over.
const INSIGHTS = [
  // ── the board ─────────────────────────────────────────────────────────────
  // The single most common surprise in the game: measured at r254, a random
  // 5-card selection carries a dropped card 80% of the time.
  { id: 'penalty_cards', title: 'That card is being dropped',
    anchor: ['#hand-name'],
    body: 'A red card is not part of the hand. You lose its pips and the card. With Tagalong it also costs its pip value in seconds.',
    when: () => !!document.querySelector('#hand-name .hn-drop') },

  { id: 'min_selection', title: 'You need more cards',
    anchor: ['#hand-name'],
    body: 'Selection Size sets a floor as well as a ceiling. The hand label says how many more to add.',
    when: () => !!document.querySelector('#hand-name .hn-need') },

  { id: 'hand_layers', title: 'Your hand was also a flush',
    anchor: ['#hand-name'],
    body: 'A hand that is also a flush pays for both shapes, and every card in the flush scores twice.',
    // FLUSH-specific, because the copy is. The overlay is by far the common
    // layering (r199: it fires on roughly half of all five-card hands) and it is
    // the one a player cannot guess at - a suited run pays the flush too.
    when: () => document.querySelectorAll('#hand-name .hn-l').length >= 2
              && !document.querySelector('#hand-name .hn-need')
              && [...document.querySelectorAll('#hand-name .hn-l b')]
                   .some(b => /FLUSH/i.test(b.textContent || '')) },

  { id: 'sleight_grid', title: 'That is a {sleight}, not a card',
    anchor: ['#grid .sleight-card'],
    body: 'It lives in your deck and falls like any other card. Press and hold it to read what it does.',
    when: () => !!document.querySelector('#grid .sleight-card') },

  { id: 'curses', title: 'A card is cursed',
    anchor: ['#grid'],
    body: 'The curse is on that one card, not on its rank or its suit. It wears off after the card has scored a few times.',
    when: () => typeof cardCurses !== 'undefined' && Object.keys(cardCurses).length > 0 },

  { id: 'card_buffs', title: 'A card has a permanent bonus',
    anchor: ['#grid'],
    body: 'It keeps the bonus for the rest of the run, wherever it goes in the deck. A green arrow means the bonus grows each time you play it.',
    when: () => (typeof permPips !== 'undefined' && Object.keys(permPips).length > 0)
             || (typeof permMult !== 'undefined' && Object.keys(permMult).length > 0) },

  { id: 'line_markers', title: 'A line is marked on the board',
    anchor: ['#grid'],
    body: 'One of your {tricks} has claimed that row or column for the rest of the run. Every card on it wears a ring in the same colour.',
    when: () => typeof rowColBonuses !== 'undefined' && rowColBonuses.length > 0 },

  { id: 'blocked_cells', title: 'Some cells are out of use',
    anchor: ['#grid'],
    body: 'Cards there cannot be played. A countdown ring means the cell comes back.',
    when: () => (typeof blockedCells !== 'undefined' && blockedCells.size > 0)
             || (typeof nullCells !== 'undefined' && nullCells.size > 0)
             || (typeof bossHeldCards !== 'undefined' && Object.keys(bossHeldCards).length > 0) },

  // ── scoring ───────────────────────────────────────────────────────────────
  { id: 'focus', title: '{FOCUS} is multiplying your hands',
    anchor: ['#focus-box', '#focus-meter-wrap'],
    body: 'You earn it by playing bigger shapes quickly, and it drains while you sit still. It multiplies the hand you are playing now.',
    when: () => typeof focusNodes !== 'undefined' && typeof FOCUS_THRESHOLD !== 'undefined'
             && focusNodes > FOCUS_THRESHOLD },

  { id: 'replays', title: 'A card scored twice',
    anchor: ['#selected-cards'],
    body: 'A replay scores one card again. It pays what the card earned, not the hand\'s base.',
    when: () => typeof replaysThisRound !== 'undefined' && replaysThisRound > 0 },

  { id: 'natural_scaling', title: 'That hand type is getting better',
    anchor: ['#hand-name'],
    body: 'Every hand type earns a permanent bonus each time you play it, and only that type. RECORDS &rsaquo; Hands shows what each is worth now.',
    when: () => typeof nsBonus !== 'undefined'
             && Object.values(nsBonus).some(v => v && ((v.pips || 0) > 0 || (v.mult || 0) > 0)) },

  // ── what you own ──────────────────────────────────────────────────────────
  { id: 'knacks', screen: 'any', title: 'You own a {knack}',
    anchor: ['#knack-list'],
    body: 'A {knack} is a permanent rule change for the rest of the run. It is not a card and it never expires.',
    when: () => typeof acquiredKnacks !== 'undefined' && acquiredKnacks.length > 0 },

  { id: 'tricks', screen: 'any', title: 'Your {trick} slots are full',
    anchor: ['#trick-tray-count'],
    body: 'A new {trick} will be refused until you make room. Tap one in the tray and sell it.',
    when: () => typeof trickTrayFull === 'function' && trickTrayFull() },

  { id: 'improve', screen: 'any', title: 'That one has been improved',
    anchor: ['#trick-tray-list'],
    body: 'The v2.0 stamp is its version. Its numbers are bigger, and the gold bands on the object count the improvements.',
    when: () => typeof entityTier !== 'undefined'
             && Object.values(entityTier).some(v => (v || 0) > 0) },

  { id: 'priming', screen: 'any', title: 'That one is primed',
    anchor: ['#trick-tray-list'],
    body: 'The violet +N is how many extra times it fires on your next hand, all of them at once. Its condition still has to be met.',
    when: () => typeof trickTray !== 'undefined'
             && trickTray.some(t => t && ((t._primed || 0) + (t._rank || 0)) > 0) },

  // ── between rounds ────────────────────────────────────────────────────────
  { id: 'reward_grid', screen: 'any', title: 'You take the whole path',
    anchor: ['#grid'],
    body: 'Pick a connected run of tiles and you get every tile on it, liabilities included.',
    when: () => typeof rewardOnGrid !== 'undefined' && rewardOnGrid
             && (typeof rewardGridMode === 'undefined' || rewardGridMode !== 'prize') },

  { id: 'prize_grid', screen: 'any', title: 'Nothing here is a liability',
    anchor: ['#grid'],
    body: 'A prize grid is smaller than a reward grid. Every cell on it is a reward, and nothing common is on the board.',
    when: () => typeof rewardOnGrid !== 'undefined' && rewardOnGrid
             && typeof rewardGridMode !== 'undefined' && rewardGridMode === 'prize' },

  { id: 'shop', screen: 'any', title: 'Buying together is cheaper',
    anchor: ['#grid'],
    body: 'Tiles that touch each other are discounted as a batch. Swaps rearrange the shelves and a discard rerolls a row, so what you carried out of the round is what you shop with.',
    when: () => typeof shopGridActive !== 'undefined' && shopGridActive },

  { id: 'payout', screen: 'any', title: 'What the round paid',
    anchor: ['#po-valued'],
    body: 'Interest on the credits you hold, time left on the clock, and every swap and discard you did not spend.',
    when: () => !!document.querySelector('#po-valued.show') },

  { id: 'limit_break', screen: 'any', title: 'The first pick is free',
    anchor: ['#lb-panel', '#limitbreak-overlay'],
    body: 'Lock one in and it applies at once. You are then offered a second, and that one has a price. Taking just the free one is allowed.',
    when: () => !!document.querySelector('#limitbreak-overlay.show') },

  { id: 'events', screen: 'any', title: 'Skipping is an option',
    anchor: ['#event-panel', '#event-overlay'],
    body: 'A meeting is one decision and then it is over. Nothing on it is compulsory.',
    when: () => !!document.querySelector('#event-overlay.show') },

  // ── the schedule ──────────────────────────────────────────────────────────
  { id: 'schedule', screen: 'any', title: 'Read the whole schedule first',
    anchor: ['#map-bar'],
    body: 'Every step you take happens, and you get at most two stops in a time slot. Use the legend to see what is where.',
    when: () => document.body.classList.contains('map-active') },

  { id: 'skip_cost', screen: 'any', title: 'Leaving early costs credits',
    anchor: ['#map-bar'],
    body: 'Take only one stop in a time slot and you pay to move on. The fee rises each time.',
    when: () => document.body.classList.contains('map-active')
             && typeof mapVisits !== 'undefined' && mapVisits === 1 },

  // ── pressure ──────────────────────────────────────────────────────────────
  { id: 'boss', screen: 'any', title: 'You can read the brief again',
    anchor: ['#goal-display', '#run-progress'],
    body: 'Tap the {GOAL} chip or the progress block during a review to see what it is doing to you.',
    when: () => typeof bossActive !== 'undefined' && bossActive
             && !document.querySelector('#boss-preamble.show') },

  { id: 'wild_card', title: 'That card takes any rank',
    anchor: ['#hand-name', '#score-center'],
    body: 'A wild completes a SET at any rank - never a run and never a flush. It scores no pips and fires no {Tricks}; the set it finishes pays as normal.',
    // A BOARD tip (the default scope), so it cannot fire over the reward grid or
    // the shop the way the two r284 strays did - the card has to be on screen for
    // the ring to point at anything. gridData is read defensively because a
    // predicate may not throw (js/insights.js's own rule).
    when: () => {
      if (typeof isWildCard !== 'function' || typeof gridData === 'undefined') return false;
      for (let r = 0; r < gridRows; r++)
        for (let c = 0; c < gridCols; c++) if (isWildCard(gridData?.[r]?.[c])) return true;
      return false;
    } },

  { id: 'mini_boss', screen: 'any', title: 'The extra task is a bonus',
    anchor: ['#goal-display'],
    body: 'The {GOAL} is raised and that is the round. Missing the extra requirement costs you the bonus, not the round.',
    when: () => typeof miniBossActive !== 'undefined' && miniBossActive },
];

// ── when a tip may not appear ───────────────────────────────────────────────
// Everything here is "the player is already being shown something", so a tip on
// top would be a second voice. The tutorial is the important one: it teaches
// several of these subjects itself, and a tip arguing with it is exactly the
// smothering this whole design is avoiding.
function insightsBlocked() {
  if (!insightsOn()) return true;
  if (typeof tutorialRunning !== 'undefined' && tutorialRunning) return true;
  if (typeof tutorialActive === 'function' && tutorialActive()) return true;
  // A run has to be under way. On the menu there is nothing to point at, and the
  // office photo owns the screen.
  if (document.body.classList.contains('office-scene')) return true;
  if (document.querySelector('#main-menu-overlay.show')) return true;
  if (document.querySelector('#mode-select-overlay.show')) return true;
  // Reading surfaces and modals.
  for (const s of ['#settings-overlay.show', '#records-overlay.show', '#info-overlay.show',
                   '#dev-panel.show', '#end-overlay.show', '#pause-overlay.show',
                   '#boss-preamble.show', '#countdown-321-overlay.show',
                   // Poker Squares' own console and its end-of-run scorecard are
                   // reading surfaces too, and the card is the one screen in that
                   // mode a tip would land squarely on top of.
                   '#sq-overlay.show', '#sq-card.show']) {
    if (document.querySelector(s)) return true;
  }
  // Mid-animation the card would land on a board that is about to move, and the
  // scoring dance owns the hand preview several of these anchors sit beside.
  if (typeof animating !== 'undefined' && animating) return true;
  if (typeof falling !== 'undefined' && falling) return true;
  if (document.querySelector('#selected-cards.dnc-active')) return true;
  return false;
}

// Is a LIVE ROUND BOARD on screen? A board-scoped tip needs one, because the
// readouts it points at (#hand-name, #selected-cards, the meters) are still in
// the DOM holding the last hand's values when a takeover screen is up, and the
// tip would land on top of reward tiles explaining something not on screen.
// Same three classes js/render.js and js/map-mode.js already own, plus the shop.
function insightsBoardLive() {
  const b = document.body.classList;
  if (b.contains('grid-screen') || b.contains('gp-active')
   || b.contains('map-active') || b.contains('pick-active')
   || b.contains('reward-active')) return false;
  if (typeof shopGridActive !== 'undefined' && shopGridActive) return false;
  if (document.getElementById('payout-overlay')) return false;
  if (typeof gridData === 'undefined' || !gridData.length) return false;
  return gridData.some(row => (row || []).some(c => c && !c._isTrick));
}

// ── the sweep ───────────────────────────────────────────────────────────────
function insightTick() {
  if (insightCurrent) return;                       // one at a time
  if (Date.now() - insightLastAt < INSIGHT_GAP) return;
  if (insightThisRound >= INSIGHT_PER_ROUND) return;
  if (insightsBlocked()) return;
  const boardLive = insightsBoardLive();
  for (const row of INSIGHTS) {
    if (insightsSeen.has(row.id)) continue;
    if (row.screen !== 'any' && !boardLive) continue;   // board tips need a board
    let hit = false;
    try { hit = !!row.when(); } catch (e) { hit = false; }   // a throw is "not yet"
    if (hit) { showInsight(row); return; }
  }
}

function startInsights() {
  if (insightTimer) return;
  insightTimer = setInterval(insightTick, INSIGHT_TICK);
}
function stopInsights() {
  if (insightTimer) { clearInterval(insightTimer); insightTimer = null; }
  dismissInsight();
}
// Called from startRoundTimer - the one place every round start funnels through.
function insightsRoundReset() { insightThisRound = 0; startInsights(); }

// ── the card ────────────────────────────────────────────────────────────────
// Body-level and position:fixed in raw viewport px, the standing rule for every
// pop-up in this game: anything inside #cabinet inherits its CSS `zoom`.
function insightBuild() {
  if (insightEls) return insightEls;
  const layer = document.createElement('div');
  layer.id = 'tip-layer';
  layer.innerHTML =
    `<div id="tip-ring"></div>` +
    `<div id="tip-card">` +
      `<div id="tip-head"><span id="tip-eyebrow">TIP</span>` +
        `<button id="tip-x" aria-label="Close">✕</button></div>` +
      `<div id="tip-title"></div>` +
      `<div id="tip-body"></div>` +
      `<div id="tip-btns"></div>` +
      `<button id="tip-off">Turn tips off</button>` +
    `</div>`;
  document.body.appendChild(layer);
  layer.querySelector('#tip-x').onclick   = () => dismissInsight();
  layer.querySelector('#tip-off').onclick = () => {
    if (typeof setSetting === 'function') setSetting('tips', false);
    dismissInsight();
    if (typeof showMessage === 'function') showMessage('Tips off. Settings > Help to turn them back on.', 'var(--cream-dim)');
  };
  insightEls = {
    layer, ring: layer.querySelector('#tip-ring'), card: layer.querySelector('#tip-card'),
    title: layer.querySelector('#tip-title'), body: layer.querySelector('#tip-body'),
    btns: layer.querySelector('#tip-btns'),
  };
  return insightEls;
}

function showInsight(row) {
  const els = insightBuild();
  insightCurrent = row;
  // MARKED SEEN ON SHOW, not on dismiss. A reload with the card up would
  // otherwise re-queue it on the next load, forever.
  insightsSeen.add(row.id);
  _saveInsightsSeen();
  insightThisRound++;

  els.title.innerHTML = infoText(row.title);
  els.body.innerHTML  = infoText(row.body);
  const hasTopic = typeof infoTopic === 'function' && !!infoTopic(row.id);
  els.btns.innerHTML = `<button class="tip-btn" id="tip-ok">Got it</button>`
    + (hasTopic ? `<button class="tip-btn tip-btn-2" id="tip-more">Read more</button>` : '');
  els.btns.querySelector('#tip-ok').onclick = () => dismissInsight();
  if (hasTopic) els.btns.querySelector('#tip-more').onclick = () => {
    const id = row.id;
    dismissInsight();
    openInfoHub(id);
  };

  els.layer.classList.add('show');
  insightPlace(row);
  if (typeof sfxClockTick === 'function') { try { sfxClockTick(); } catch (e) {} }
}

function dismissInsight() {
  if (!insightEls) return;
  insightEls.layer.classList.remove('show');
  if (insightCurrent) insightLastAt = Date.now();
  insightCurrent = null;
}

// The anchor's first element with a REAL RECT wins - several of these readouts
// exist in only one orientation, so a plain getElementById would resolve to a
// 0-size box and put the ring in the corner.
function insightAnchorEl(row) {
  for (const s of (row.anchor || [])) {
    const el = document.querySelector(s);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) return el;
  }
  return null;
}

function insightPlace(row) {
  const els = insightEls;
  const card = els.card, ring = els.ring;
  const vw = window.innerWidth, vh = window.innerHeight;
  const cw = card.offsetWidth, ch = card.offsetHeight;
  const PAD = 10;
  const el = insightAnchorEl(row);

  if (!el) {
    ring.style.display = 'none';
    card.style.left = Math.round((vw - cw) / 2) + 'px';
    card.style.top  = Math.round(vh - ch - 18) + 'px';
    return;
  }
  const r = el.getBoundingClientRect();
  ring.style.display = '';
  ring.style.left = (r.left - 4) + 'px';
  ring.style.top  = (r.top  - 4) + 'px';
  ring.style.width  = (r.width  + 8) + 'px';
  ring.style.height = (r.height + 8) + 'px';

  // Below the anchor if it fits, otherwise above. Then CLAMPED to the viewport
  // on both axes - the same rule .time-popup needed: a pop-up placed in raw
  // viewport px and not clamped to one runs off a phone with no way back.
  let top = r.bottom + 12;
  if (top + ch > vh - PAD) top = r.top - ch - 12;
  top = Math.max(PAD, Math.min(top, vh - ch - PAD));
  let left = r.left + r.width / 2 - cw / 2;
  left = Math.max(PAD, Math.min(left, vw - cw - PAD));
  card.style.left = Math.round(left) + 'px';
  card.style.top  = Math.round(top) + 'px';
}

// ── dev + settings ──────────────────────────────────────────────────────────
function resetInsights() {
  insightsSeen = new Set();
  _saveInsightsSeen();
  insightThisRound = 0;
  insightLastAt = 0;
  if (typeof showMessage === 'function') showMessage('Tips reset - each one will show once more.', 'var(--c-mint)');
}
function insightsSeenCount() { return insightsSeen.size; }
// Dev: show one on demand, ignoring its predicate and without burning it.
function devShowInsight(id) {
  const row = INSIGHTS.find(r => r.id === id);
  if (!row) return;
  const had = insightsSeen.has(id);
  showInsight(row);
  if (!had) { insightsSeen.delete(id); _saveInsightsSeen(); }
  insightThisRound--;
}
