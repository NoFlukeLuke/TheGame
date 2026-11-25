// ══════════════════════════════════════════════
// EVENT FILES (r795, owner)
// ══════════════════════════════════════════════
// Two steps (r797). One visit opens an event's FILE: Builds -> EVENTS shows its name
// and what it does (eventSeen). EVENT_KNOW_NEED (5) visits REVEAL it (eventKnown):
// from then on the Schedule's line and the pick of three's event tile name it. Until
// then both read plain EVENT, with no count. REWARDS_MEMBER_NEED (10) revealed events
// unlock the Rewards Member Knack.
//
// One store, `lethe.eventVisits.v1` { id: opens }. `eventVisitNote(id)` is the one
// writer (openEvent, guidedOpenNamedEvent); tours and test drives do not count.
const EVENT_VISIT_KEY     = 'lethe.eventVisits.v1';
const EVENT_KNOW_NEED     = 5;
const REWARDS_MEMBER_NEED = 10;   // r799 (owner): was 15
// Rewards Member: events `mult` times as common in rewards; on the Schedule and in
// Flow, `grid`% of ordinary Balance Sheets carry a Next: Event tile.
const REWARDS_MEMBER = { mult: 3, grid: 50 };

let _evVisits = null;
function eventVisits() {
  if (_evVisits) return _evVisits;
  try { const o = JSON.parse(localStorage.getItem(EVENT_VISIT_KEY) || '{}'); _evVisits = (o && typeof o === 'object') ? o : {}; }
  catch (e) { _evVisits = {}; }
  return _evVisits;
}
function eventVisitCount(id) { return Math.max(0, eventVisits()[id] | 0); }
function eventKnown(id) { return eventVisitCount(id) >= EVENT_KNOW_NEED; }
function eventSeen(id) { return eventVisitCount(id) >= 1; }
function eventFileIds() { return (typeof liveEventIds === 'function') ? liveEventIds() : []; }
function eventsKnownCount() { return eventFileIds().filter(eventKnown).length; }
function rewardsMemberEarned() { return eventsKnownCount() >= REWARDS_MEMBER_NEED; }

function eventVisitNote(id) {
  if (!id || typeof EVENT_META === 'undefined' || !EVENT_META[id]) return;
  if (typeof EVENT_SCHEDULED !== 'undefined' && EVENT_SCHEDULED.has(id)) return;
  if (typeof unlockPaused === 'function' && unlockPaused()) return;
  const v = eventVisits(), wasSeen = eventSeen(id), wasKnown = eventKnown(id), wasMember = rewardsMemberEarned();
  v[id] = (v[id] | 0) + 1;
  try { localStorage.setItem(EVENT_VISIT_KEY, JSON.stringify(v)); } catch (e) {}
  if (typeof showMessage !== 'function') return;
  if (!wasSeen)
    setTimeout(() => showMessage(`EVENT FILE OPENED: ${EVENT_META[id].name} · Builds › Events`, 'var(--gold)', { svgIcon: 'unlock', icon: '\u{1F513}' }), 600);
  if (!wasKnown && eventKnown(id))
    setTimeout(() => showMessage(`EVENT REVEALED: ${EVENT_META[id].name}`, 'var(--gold)', { svgIcon: 'unlock', icon: '\u{1F513}' }), 600);
  if (!wasMember && rewardsMemberEarned())
    setTimeout(() => showMessage(`UNLOCKED: ${knackName('rewards_member')} · Knack`, 'var(--gold)', { svgIcon: 'unlock', icon: '\u{1F513}' }), 1400);
}

// What each event does, for its file and for a named tile. The shell's own flavor
// line where it has one; these rows cover the events whose screen needs no line.
const EVENT_DOES = {
  deck_trim:    'Pay to cut cards out of your deck. Each cut costs more than the last.',
  reassignment: 'Trade one Trick for another at least one rarity higher.',
  the_draw:     'Pick three of your Tricks, Knacks or Sleights. A spin upgrades one of them twice.',
  the_floor:    'Slot reels of your own cards. A line of three alike, or a run of three, buffs those cards.',
  clean_slate:  'Undo one downside you have taken.',
  the_payline:  'Slot reels of what you own. Three alike in a line upgrades it.',
  pairs:        'Sixteen cards face down. Match pairs for cards and deck edits. A matched penalty pair costs you.',
  keep_it:      'Choose one of three rewards, then flip a coin for it.',
  hot_streak:   'Up to four coin flips. Each heads adds a pick of three. A tails loses them all.',
  prize_ladder: 'Coin flips up a ladder of prizes. A tails loses what is not secured.',
  trick_gamble: 'Pick two Tricks. One upgrades twice. The other is deleted.',
  reschedule:   'See this quarter\'s boss and the next. Pay to reroll both.',
  grid_spinner: 'Spin the wheel. Add that many rows and columns.',
  static_bonus: 'Two wheels set a bonus of pips or mult added to every hand for the run.',
  luck_dice:    'Two dice. Their product is added to your Luck.',
};
function eventDoes(id) {
  const m = (typeof EVENT_META !== 'undefined' && EVENT_META[id]) || {};
  return EVENT_DOES[id] || m.flavor || '';
}
// What a screen may print about an event before it is opened.
function eventShownName(id) { return eventKnown(id) ? EVENT_META[id].name : 'Event'; }
function eventShownDoes(id) {
  return eventKnown(id) ? eventDoes(id) : 'Something happens.';
}

// ── Rewards Member (rare Knack `rewards_member`) ─────────────────────────────
function eventOfferMult() { return (typeof hasKnack === 'function' && hasKnack('rewards_member')) ? REWARDS_MEMBER.mult : 1; }
function rewardsMemberBanned() { return !rewardsMemberEarned(); }
// Does this Balance Sheet carry a Next: Event tile on the Schedule / in Flow?
function rewardsMemberGridEvent() { return eventOfferMult() > 1 && Math.random() * 100 < REWARDS_MEMBER.grid; }

// ── The pick of three's event offer ──────────────────────────────────────────
// One event a screen at most, rolled here. Not in the walkthrough. `out` is a Set
// of ids the caller cannot host (Flow: FLOWR_EVENT_OUT).
function eventPickEntry(out) {
  if (typeof openEvent !== 'function' || typeof guidedOpenNamedEvent !== 'function') return null;
  if (typeof tutorialActive === 'function' && tutorialActive()) return null;
  const pool = eventFileIds().filter(id => !(out && out.has(id)) && (typeof eventEligible !== 'function' || eventEligible(id)));
  const fresh = pool.filter(id => typeof recentEventIds === 'undefined' || !recentEventIds.includes(id));
  const id = evWeightedPick(fresh.length ? fresh : pool);
  return id ? { id, rarity: 'rare' } : null;
}
function eventPickName(id) { return eventKnown(id) ? EVENT_META[id].name : 'Event'; }
function eventPickDesc(id) { return eventKnown(id) ? eventDoes(id) : 'Opens an event.'; }
