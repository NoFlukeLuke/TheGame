// ══════════════════════════════════════════════
// EVENT FILES (r793, owner)
// ══════════════════════════════════════════════
// An event is FILED once it has been opened EVENT_KNOW_NEED (5) times, ever. Until
// then nothing names it ahead of time: the Schedule's line reads EVENT, the pick of
// three's event tile reads EVENT. Builds -> EVENTS lists the filed ones with what
// they do. REWARDS_MEMBER_NEED (15) filed events unlock the Rewards Member Knack.
//
// One store, `lethe.eventVisits.v1` { id: opens }. `eventVisitNote(id)` is the one
// writer (openEvent, guidedOpenNamedEvent); tours and test drives do not count.
const EVENT_VISIT_KEY     = 'lethe.eventVisits.v1';
const EVENT_KNOW_NEED     = 5;
const REWARDS_MEMBER_NEED = 15;
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
function eventFileIds() { return (typeof liveEventIds === 'function') ? liveEventIds() : []; }
function eventsKnownCount() { return eventFileIds().filter(eventKnown).length; }
function rewardsMemberEarned() { return eventsKnownCount() >= REWARDS_MEMBER_NEED; }

function eventVisitNote(id) {
  if (!id || typeof EVENT_META === 'undefined' || !EVENT_META[id]) return;
  if (typeof EVENT_SCHEDULED !== 'undefined' && EVENT_SCHEDULED.has(id)) return;
  if (typeof unlockPaused === 'function' && unlockPaused()) return;
  const v = eventVisits(), wasKnown = eventKnown(id), wasMember = rewardsMemberEarned();
  v[id] = (v[id] | 0) + 1;
  try { localStorage.setItem(EVENT_VISIT_KEY, JSON.stringify(v)); } catch (e) {}
  if (typeof showMessage !== 'function') return;
  if (!wasKnown && eventKnown(id))
    setTimeout(() => showMessage(`EVENT FILED: ${EVENT_META[id].name} · Builds › Events`, 'var(--gold)', { svgIcon: 'unlock', icon: '\u{1F513}' }), 600);
  if (!wasMember && rewardsMemberEarned())
    setTimeout(() => showMessage(`UNLOCKED: ${knackName('rewards_member')} · Knack`, 'var(--gold)', { svgIcon: 'unlock', icon: '\u{1F513}' }), 1400);
}

// What each event does, for its file and for a named tile. The shell's own flavor
// line where it has one; these rows cover the events whose screen needs no line.
const EVENT_DOES = {
  deck_trim:    'Pay to cut cards out of your deck. Each cut costs more than the last.',
  reassignment: 'Trade one Trick for another at least one rarity higher.',
  the_draw:     'Pick three of your Tricks, Knacks or Sleights. A spin improves one of them twice.',
  the_floor:    'Slot reels of your own cards. A line of three alike, or a run of three, buffs those cards.',
  clean_slate:  'Undo one downside you have taken.',
  the_payline:  'Slot reels of what you own. Three alike in a line improves it.',
  pairs:        'Sixteen cards face down. Match pairs for cards and deck edits. A matched penalty pair costs you.',
  keep_it:      'Choose one of three rewards, then flip a coin for it.',
  hot_streak:   'Up to four coin flips. Each heads adds a pick of three. A tails loses them all.',
  prize_ladder: 'Coin flips up a ladder of prizes. A tails loses what is not secured.',
  trick_gamble: 'Pick two Tricks. One improves twice. The other is deleted.',
  reschedule:   'See this quarter\'s boss and the next. Pay to reroll both.',
  grid_spinner: 'Stop the light on a number. Add that many rows and columns.',
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
  return eventKnown(id) ? eventDoes(id) : `Opened ${eventVisitCount(id)} of ${EVENT_KNOW_NEED} times.`;
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
