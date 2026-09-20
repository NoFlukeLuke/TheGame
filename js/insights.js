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
const INSIGHTS = [
  // ── the board ─────────────────────────────────────────────────────────────
  // The single most common surprise in the game: measured at r254, a random
  // 5-card selection carries a dropped card 80% of the time.
  { id: 'penalty_cards', title: 'That card is being dropped',
    anchor: ['#hand-name'],
    body: 'A red card is not part of the hand. You lose its pips AND the card. Every card has to earn its place.',
    when: () => !!document.querySelector('#hand-name .hn-drop') },

  { id: 'min_selection', title: 'You must commit more cards',
    anchor: ['#hand-name'],
    body: 'Selection Size sets a floor as well as a ceiling. Below it the hand will not play, and the label says how many more you need.',
    when: () => !!document.querySelector('#hand-name .hn-need') },

  { id: 'hand_layers', title: 'That is two hands at once',
    anchor: ['#hand-name'],
    body: 'A hand can be several shapes stacked together, and every one of them pays. Cards in two of them score twice.',
    when: () => document.querySelectorAll('#hand-name .hn-l').length >= 2
              && !document.querySelector('#hand-name .hn-need') },

  { id: 'sleight_grid', title: 'That is a {sleight}, not a card',
    anchor: ['#grid .sleight-card'],
    body: 'It lives in your deck and falls like any other card, but it does something of its own. Press and hold it to read what.',
    when: () => !!document.querySelector('#grid .sleight-card') },

  { id: 'curses', title: 'A card has been cursed',
    anchor: ['#grid'],
    body: 'The curse is on that ONE card, not on its rank or its suit, and it wears off by itself after the card has scored a few times.',
    when: () => typeof cardCurses !== 'undefined' && Object.keys(cardCurses).length > 0 },

  { id: 'card_buffs', title: 'A card has a permanent bonus',
    anchor: ['#grid'],
    body: 'It keeps that bonus for the rest of the run, wherever it goes in the deck. A green arrow means the bonus GROWS each time you play it.',
    when: () => (typeof permPips !== 'undefined' && Object.keys(permPips).length > 0)
             || (typeof permMult !== 'undefined' && Object.keys(permMult).length > 0) },

  { id: 'line_markers', title: 'A line is marked on the board',
    anchor: ['#grid'],
    body: 'One of your {tricks} has claimed that row or column for the rest of the run. Every card on it wears a ring in the same colour.',
    when: () => typeof rowColBonuses !== 'undefined' && rowColBonuses.length > 0 },

  { id: 'blocked_cells', title: 'Some cells are out of use',
    anchor: ['#grid'],
    body: 'Cards there cannot be played. A countdown ring means it comes back; no ring means it does not.',
    when: () => (typeof blockedCells !== 'undefined' && blockedCells.size > 0)
             || (typeof nullCells !== 'undefined' && nullCells.size > 0)
             || (typeof bossHeldCards !== 'undefined' && Object.keys(bossHeldCards).length > 0) },

  // ── scoring ───────────────────────────────────────────────────────────────
  { id: 'focus', title: '{FOCUS} is multiplying your hands',
    anchor: ['#focus-box', '#focus-meter-wrap'],
    body: 'You earn it by playing complicated hands quickly, and it drains while you sit still. It multiplies the hand you are playing right now.',
    when: () => typeof focusNodes !== 'undefined' && typeof FOCUS_THRESHOLD !== 'undefined'
             && focusNodes > FOCUS_THRESHOLD },

  { id: 'replays', title: 'A card scored twice',
    anchor: ['#selected-cards'],
    body: 'A replay re-scores one card as if it were in the hand again. It pays what the CARD earned, not the hand\'s base.',
    when: () => typeof replaysThisRound !== 'undefined' && replaysThisRound > 0 },

  { id: 'natural_scaling', title: 'That hand type is getting better',
    anchor: ['#hand-name'],
    body: 'Every hand type earns a permanent bonus each time you play it, and only that type. RECORDS shows what each one is worth now.',
    when: () => typeof nsBonus !== 'undefined'
             && Object.values(nsBonus).some(v => v && ((v.pips || 0) > 0 || (v.mult || 0) > 0)) },

  // ── what you own ──────────────────────────────────────────────────────────
  { id: 'knacks', title: 'You own a {knack}',
    anchor: ['#knack-list'],
    body: 'A {knack} is a permanent rule change for the rest of the run. It is not a card and it never expires. Tap it to read it.',
    when: () => typeof acquiredKnacks !== 'undefined' && acquiredKnacks.length > 0 },

  { id: 'tricks', title: 'Your {trick} slots are full',
    anchor: ['#trick-tray-count'],
    body: 'The cap is hard. A new {trick} will be refused until you make room, and you make room by tapping one in the tray and selling it.',
    when: () => typeof trickTrayFull === 'function' && trickTrayFull() },

  { id: 'improve', title: 'That one has been improved',
    anchor: ['#trick-tray-list'],
    body: 'The v2.0 stamp is its version. Its own numbers are bigger, and the gold bands on the object count the improvements.',
    when: () => typeof entityTier !== 'undefined'
             && Object.values(entityTier).some(v => (v || 0) > 0) },

  { id: 'priming', title: 'That one is primed',
    anchor: ['#trick-tray-list'],
    body: 'The violet +N is how many EXTRA times it fires on your next hand. It cannot fire a {trick} whose condition was not met.',
    when: () => typeof trickTray !== 'undefined'
             && trickTray.some(t => t && ((t._primed || 0) + (t._rank || 0)) > 0) },

  // ── between rounds ────────────────────────────────────────────────────────
  { id: 'reward_grid', title: 'You take the whole path',
    anchor: ['#grid'],
    body: 'Pick a connected run of tiles and you get EVERY tile on it, liabilities included. That is the decision: what you walk through to reach what you want.',
    when: () => typeof rewardOnGrid !== 'undefined' && rewardOnGrid
             && (typeof rewardGridMode === 'undefined' || rewardGridMode !== 'prize') },

  { id: 'prize_grid', title: 'Nothing here is a liability',
    anchor: ['#grid'],
    body: 'A prize grid is smaller than a reward grid, every cell on it is a reward, and nothing common is on the board.',
    when: () => typeof rewardOnGrid !== 'undefined' && rewardOnGrid
             && typeof rewardGridMode !== 'undefined' && rewardGridMode === 'prize' },

  { id: 'shop', title: 'Buying together is cheaper',
    anchor: ['#grid'],
    body: 'Pick tiles that touch each other and the bundle is discounted. Rerolling refills the shelves and costs more every time.',
    when: () => typeof shopGridActive !== 'undefined' && shopGridActive },

  { id: 'payout', title: 'What the round paid',
    anchor: ['#po-valued'],
    body: 'Interest on what you are holding, time left on the clock, and every swap and discard you did NOT spend. Leftovers are worth keeping.',
    when: () => !!document.querySelector('#po-valued.show') },

  { id: 'limit_break', title: 'The first pick is free',
    anchor: ['#lb-panel', '#limitbreak-overlay'],
    body: 'Lock one in and it applies at once. Only then are you offered a SECOND, and that one has a price. Walking away with just the free one is always allowed.',
    when: () => !!document.querySelector('#limitbreak-overlay.show') },

  { id: 'events', title: 'Skipping is a real option',
    anchor: ['#event-panel', '#event-overlay'],
    body: 'A meeting is one decision and then it is over. Nothing here is compulsory, and some of it is worse than nothing.',
    when: () => !!document.querySelector('#event-overlay.show') },

  // ── the schedule ──────────────────────────────────────────────────────────
  { id: 'schedule', title: 'Read the whole schedule first',
    anchor: ['#map-bar'],
    body: 'Every step you take happens, and you get at most TWO stops in a time slot. Use the legend to see what is where before you move.',
    when: () => document.body.classList.contains('map-active') },

  { id: 'skip_cost', title: 'Leaving early costs credits',
    anchor: ['#map-bar'],
    body: 'Take only one stop in a time slot and you pay to move on, and the fee rises every time you do it.',
    when: () => document.body.classList.contains('map-active')
             && typeof mapVisits !== 'undefined' && mapVisits === 1 },

  // ── pressure ──────────────────────────────────────────────────────────────
  { id: 'boss', title: 'You can read the brief again',
    anchor: ['#goal-display', '#run-progress'],
    body: 'Tap the {GOAL} chip or the progress block any time during a review to see exactly what it is doing to you.',
    when: () => typeof bossActive !== 'undefined' && bossActive
             && !document.querySelector('#boss-preamble.show') },

  { id: 'mini_boss', title: 'The extra task is a bonus, not a trap',
    anchor: ['#goal-display'],
    body: 'The quota is raised and that IS the round. Missing the extra requirement costs you the bonus, not the round.',
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
                   '#boss-preamble.show', '#countdown-321-overlay.show']) {
    if (document.querySelector(s)) return true;
  }
  // Mid-animation the card would land on a board that is about to move, and the
  // scoring dance owns the hand preview several of these anchors sit beside.
  if (typeof animating !== 'undefined' && animating) return true;
  if (typeof falling !== 'undefined' && falling) return true;
  if (document.querySelector('#selected-cards.dnc-active')) return true;
  return false;
}

// ── the sweep ───────────────────────────────────────────────────────────────
function insightTick() {
  if (insightCurrent) return;                       // one at a time
  if (Date.now() - insightLastAt < INSIGHT_GAP) return;
  if (insightThisRound >= INSIGHT_PER_ROUND) return;
  if (insightsBlocked()) return;
  for (const row of INSIGHTS) {
    if (insightsSeen.has(row.id)) continue;
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
