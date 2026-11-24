// ══════════════════════════════════════════════════════════════════════════
// THE HANDBOOK (r280) - Settings -> Help -> Open the handbook
//
// Owner: "we'll need to add a glossary or info hub to the settings menu with
// more details on everything in the tutorial so they can read more later."
//
// It is the LONG form of everything the tutorial and the tips say in one line.
// The tutorial teaches by doing and has to stay short; a tip fires once and is
// gone; this is the page you come back to.
//
// THREE RULES THAT KEEP IT FROM ROTTING:
//
// 1. **A TOPIC ID IS SHARED WITH ITS TIP.** `js/insights.js` rows carry the same
//    id, so a tip's READ MORE opens this page at that entry with no mapping
//    table between them. A tip is the one-line version of its topic and must
//    never say something the topic contradicts.
// 2. **IT EXPLAINS MECHANICS, NOT CONTENT.** What a Trick IS lives here; what
//    Rich Soil does lives on Rich Soil, and RECORDS -> Owned lists what you
//    hold. Copying entity text in would be a second copy to keep in step with
//    `BAL`, and `js/improve.js` rewrites those numbers as a run goes on.
// 3. **IT SPEAKS BOTH VOCABULARIES.** Prose is written in the GAMER wording and
//    runs through `lexProse()` on the way to the screen, exactly as every entity
//    description does (r198), so the Settings -> Display -> Wording toggle moves
//    it with no second copy. Category words are `{trick}` / `{sleights}`
//    placeholders resolved through `entityLabel()`, because those are a lookup
//    rather than a word swap.
//
// Two tools, each for its own job, and mixing them up is the trap:
//   - flowing prose says "pips" and "mult" in lower case, and lexProse swaps them
//   - a reference to a READOUT ON SCREEN uses {PIPS} / {SCORE} / {GOAL}, which
//     resolve through lexTerm() to the label actually printed on that chip
// ══════════════════════════════════════════════════════════════════════════

// ── vocabulary expansion ────────────────────────────────────────────────────
// {trick} {tricks} {sleight} {knacks} {card} ... resolve through entityLabel.
// {PIPS} {MULT} {FOCUS} {SCORE} {GOAL} {CREDITS} resolve through lexTerm.
//
// THE LABEL'S OWN CASE WINS. entityLabel returns 'Cert' / 'Knack', and the game
// capitalises those category words everywhere else it writes them, so this does
// not lower-case them to suit the sentence: a first pass did and printed "You
// own a cert", which reads as a typo rather than as the thing in your HUD. Only
// an ALL-CAPS placeholder forces a change, and that is for the shouty HUD terms.
const INFO_ENTITY_KEYS = ['trick', 'sleight', 'knack', 'card'];
// The six HUD concepts lexTerm() knows, listed EXPLICITLY. Testing instead
// whether lexTerm returned something different from the key is the obvious
// shortcut and it is wrong in gamer mode, where lexTerm('goal') really is
// 'GOAL': the identity answer read as "not a term" and {GOAL} printed raw.
const INFO_TERM_KEYS = ['pips', 'mult', 'focus', 'score', 'goal', 'credits'];

function infoText(s) {
  if (s == null) return '';
  let out = String(s).replace(/\{([A-Za-z]+)\}/g, (m, key) => {
    const lower = key.toLowerCase();
    const upper = key === key.toUpperCase() && key.length > 1;
    if (upper && INFO_TERM_KEYS.includes(lower)) return lexTerm(lower);
    const plural = lower.endsWith('s') && INFO_ENTITY_KEYS.includes(lower.slice(0, -1));
    const base = plural ? lower.slice(0, -1) : lower;
    if (!INFO_ENTITY_KEYS.includes(base)) return m;
    const word = entityLabel(base, plural);
    return upper ? word.toUpperCase() : word;
  });
  // The same swap every entity description gets (r198). Identity in gamer mode.
  return (typeof lexProse === 'function') ? lexProse(out) : out;
}

// ── the content ─────────────────────────────────────────────────────────────
// { id, group, title, body }. A body entry is a paragraph (string) or a bullet
// list (array of strings). Add a row and the page, its search and the tips'
// READ MORE all pick it up.
const INFO_GROUPS = [
  ['basics',  'The basics'],
  ['board',   'The board'],
  ['scoring', 'Scoring'],
  ['owned',   'What you own'],
  ['between', 'Between levels'],
  ['schedule','The schedule'],
  ['pressure','Pressure'],
  ['modes',   'Modes'],
  ['credits', 'Credits'],
];

const INFO_TOPICS = [
  // ── The basics ────────────────────────────────────────────────────────────
  { id: 'select', group: 'basics', title: 'What a selection is',
    body: [
      'Pick cards that touch edge to edge, in one connected group. Diagonals do not count.',
      'Where a card sits in the group does not change what the hand is. The order you pick them in changes the score: the first card picked adds 1 mult, the second 2, and so on.',
    ] },

  { id: 'penalty_cards', group: 'basics', title: 'Kickers',
    body: [
      'A hand may carry ONE card it does not use: a KICKER. It scores nothing, and it costs its pips off the hand and its pip value in seconds off the clock.',
      'A hand with two or more spare cards will not play. The hand label reads KICKERS and the count.',
      'A kicker turns red on the board before you play, and the hand label prices it (KICK).',
      ['A run needs consecutive ranks. 4-6-7-5-9 is not a Straight, it is a Run of 4 carrying the 9 as a kicker.',
       'A hand can be several shapes at once, so a spare card is often not spare. 2, 2, J, Q, K is a Pair and a Run of 3, and every card is used.',
       () => `The hard cap is ${typeof HAND_MAX_CARDS !== 'undefined' ? HAND_MAX_CARDS : 7} cards in a hand.`],
      'There is no minimum. Any hand of two cards or more is legal at any Selection Size.',
      'The Tagalong {knack} lets a hand carry any number of kickers, and makes them free.',
      'The Pip In {knack} makes kickers free, and they score their pips and fire their {Tricks} as though they were in the hand. They still do not change what the hand is: a Run of 4 with a kicker is a four-card hand.',
    ] },

  { id: 'hand_layers', group: 'basics', title: 'A hand can be several hands',
    body: [
      'A played hand is broken into COMPONENTS. Seven cards can be a Run of 4 and a Three of a Kind at once. A card in two components scores twice.',
      'A run all in one suit is a run and a flush, and each card scores twice. A flush only layers when every card in the hand shares the suit.',
      'The hand label names every layer.',
    ] },

  // ── The board ─────────────────────────────────────────────────────────────
  { id: 'swap_discard', group: 'board', title: 'Swapping and discarding',
    body: [
      'A SWAP trades two cards that touch. A DISCARD throws selected cards away and pulls new ones down. Both are capped per level.',
      () => (swapSecondsBase() > 0 || discardSecondsBase() > 0)
        ? `At this difficulty a swap costs ${swapSecondsBase()}s and a discard ${discardSecondsBase()}s, whatever its size.`
        : 'At this difficulty neither costs time. From ENTRY LEVEL up, each costs seconds.',
      'The ones you did not use are your free rerolls on the reward screens.',
    ] },

  { id: 'sleight_grid', group: 'board', title: '{Sleights} sit on the board',
    body: [
      'A {sleight} is a real card in your deck, drawn like any other. It falls, swaps, gets discarded, and can be played inside a hand.',
      'Most have limited charges, shown on the card. Some work just by SITTING there, some fire when you play them, some when you double-tap them.',
      'Press and hold one on the board to read what it does. A tap selects it.',
    ] },

  { id: 'blocked_cells', group: 'board', title: 'Cards you cannot use',
    body: [
      'Several things make a cell unusable, and each looks different:',
      ['VOID - the cell is dark and nothing falls into it.',
       'QUARANTINED - cards still fall in, they are just inert, permanently.',
       'HELD - one card, frozen, with a countdown ring showing when it comes back.',
       'WITHDRAWN - a whole rank is off the board for a while, also with a countdown.'],
    ] },

  { id: 'wild_card', group: 'board', title: 'Wild cards',
    body: [
      'A wild takes any rank to complete a SET. Two 7s and a wild is a Three of a Kind; one 7 and two wilds is a Three of a Kind too.',
      'It is only ever a set. A wild can never be part of a run and never part of a flush.',
      'It scores no pips, adds no mult and fires no {Tricks}. The real cards in the set score as normal.',
      'A set needs at least one real card to name its rank, so wilds on their own are not a hand.',
      () => { const w = (typeof wildCardCount === 'function') ? wildCardCount() : 4; return w > 0 ? `${w} are shuffled into the deck at the start of a run.` : 'This run has none.'; },
    ] },

  { id: 'curses', group: 'board', title: 'Curses',
    body: [
      'A CURSE CARD is a card of its own in your deck: Death, Famine or Pestilence. Press and hold it to read it. On the lower difficulty tiers it leaves after a set number of draws, shown on the card.',
      'A CURSED card is an ordinary card carrying a curse. The curse lifts after that card has scored a few times.',
      ['Leaden - scores no pips.',
       'Taxing - costs seconds every time it scores.',
       'Snared - cannot be swapped or discarded.'],
      'The Clean Up event can take every curse off at once.',
    ] },

  { id: 'card_buffs', group: 'board', title: 'FLAT and SCALING card buffs',
    body: [
      'A card buff is one of two kinds:',
      ['FLAT - "scores +5 mult when played". The number never changes.',
       'SCALING - "scales +1 mult each time it\'s played". The bonus itself grows with use, and the card carries a small green arrow.'],
    ] },

  { id: 'line_markers', group: 'board', title: 'Coloured lines down the board',
    body: [
      'Some {tricks} mark a whole row or column. The line is drawn behind the cards in that {trick}\'s colour, with its symbol on both ends, and every card on the line wears a ring in the same colour.',
      'A card where two lines cross splits its ring between both colours.',
    ] },

  // ── Scoring ───────────────────────────────────────────────────────────────
  { id: 'pips_mult', group: 'scoring', title: 'Pips, mult and the tally',
    body: [
      'A hand scores its PIPS times its MULT, times {FOCUS}. Each card adds its pips. The first card picked adds 1 mult, the second 2, and so on. {Tricks}, {Knacks} and card buffs add to one or the other.',
      'The tally plays out one card at a time. Each {trick} pops and throws its own number at the moment it actually pays.',
      'Blue is pips, red is mult, violet is {FOCUS}, white is time. Credits are a gold circle.',
    ] },

  { id: 'focus', group: 'scoring', title: '{FOCUS}',
    body: [
      '{FOCUS} is a multiplier on the whole hand. You earn it by playing complicated hands and by playing them fast, and it DECAYS while you sit still.',
      'The {FOCUS} a hand earns is applied to that same hand.',
      'The {FOCUS} Cap limit sets the ceiling.',
    ] },

  { id: 'speed_bonus', group: 'scoring', title: 'The speed bonus',
    body: [
      'A hand\'s {FOCUS} comes from two things: what the hand IS, and how fast you played it after the previous one.',
      'The speed part is largest the instant a hand lands and fades over the next few seconds. A level\'s first hand earns no speed bonus.',
      'Pair, Flush of 3 and Flush of 4 earn half the speed bonus. Overclock multiplies it. Long Fuse gives you longer to earn it.',
    ] },

  { id: 'natural_scaling', group: 'scoring', title: 'Hands get better as you play them',
    body: [
      () => `Hands come in three families: sets, runs and flushes. Every ${ns2.multEvery} plays of a family, each card in that family's hands adds ${ns2.multStep} more mult. Every ${ns2.pipsEvery} plays, each adds ${ns2.pipsPer} more pip.`,
      'A same-suit run counts for both families and takes the better one.',
      'RECORDS -> Hands shows each family.',
    ] },

  { id: 'replays', group: 'scoring', title: 'A card that scores twice',
    body: [
      'A REPLAY re-scores one card, exactly as if it were in the hand again. In the tally you see that card\'s whole beat repeat, numbers and all.',
      'The commonest source is layering: a card that is in two components of the same hand scores once for each. Several {tricks} and card buffs add replays of their own.',
      'A replay re-scores the card: its pips, its mult and every per-card {trick}. Bonuses paid to the whole hand are not repeated.',
    ] },

  // ── What you own ──────────────────────────────────────────────────────────
  { id: 'tricks', group: 'owned', title: '{Tricks} and the slot cap',
    body: [
      'A {trick} is a scoring buff that sits in your tray, never on the board. It works by itself whenever its condition is met.',
      'When the tray is full a new {trick} is refused. Sell one first: tap it in the tray and choose Sell.',
      'Some {tricks} depend on their position in the tray. The Tray Order event changes the order.',
    ] },

  { id: 'sleights', group: 'owned', title: '{Sleights}',
    body: [
      'A {sleight} is a card that lives in your deck. See "{Sleights} sit on the board" for how they behave in play.',
      'Their charges are per RUN, not per level, and most cycle back into the deck after firing rather than being destroyed.',
    ] },

  { id: 'knacks', group: 'owned', title: '{Knacks}',
    body: [
      'A {knack} is a rule change for the rest of the run, shown as a chip in the HUD.',
      '{Knacks} are never duplicated and never expire. Tap one to read it, or to sell it.',
    ] },

  { id: 'improve', group: 'owned', title: 'Upgrade tiers - the v2.0 stamp',
    body: [
      '{Tricks}, {Knacks} and {Sleights} can be UPGRADED, which makes their numbers bigger. A +5 bonus climbs 5, 10, 15, 20, 25, 40 across five upgrades.',
      'The tier is stamped on the object as a version number, and a gold band is added across its corner for each upgrade.',
      'The printed description follows the number.',
    ] },

  { id: 'priming', group: 'owned', title: 'Primed - the violet +2',
    body: [
      'The next time a PRIMED {trick} triggers, it triggers again, once for each prime. The violet pill on the tile is how many primes it holds.',
      'They all go off on that first trigger: on the first card for a {trick} that pays per card, after the cards for one that pays per hand. Then they are gone. A permanent prime (the gold pill) is never used up.',
      'A {trick} that does not trigger keeps its primes. A FORCED trigger makes it trigger once whatever its condition says, and that sets its primes off.',
    ] },

  // ── Between rounds ────────────────────────────────────────────────────────
  { id: 'payout', group: 'between', title: 'The payout',
    body: [
      'On the Schedule, clearing the {GOAL} pays credits. Two lines:',
      () => ['Interest on the credits you are holding.',
       `Early Finish Bonus: 1 credit per ${(typeof efficiencySecondsPerCoin === 'function') ? efficiencySecondsPerCoin() : 10} seconds left on the clock.`],
      () => `Flow pays at each level-up instead: ${creditsTxt(SURVIVAL_LEVEL_COINS)} for the clear, more for score over the {GOAL}, and interest.`,
      'The Contributions view on the same screen breaks the level down by what earned it.',
    ] },

  { id: 'reward_grid', group: 'between', title: `The ${gridName('reward')}`,
    body: [
      'A board of rewards and penalties. Pick a connected path and take everything on it.',
      'Tapping a tile you cannot reach shows its description. Tapping one you can reach picks it and shows its description.',
      'The path can be as long as your Selection Size. SKIP takes nothing.',
    ] },

  { id: 'pick_three', group: 'between', title: 'Take your pick',
    body: [
      'Three offers, and you take one. The Schedule pays one after an ordinary level. In Flow it is one of the reward screens a level-up can pay.',
      'Each offer rolls its own type. The chances depend on the mode; see that mode\'s entry under Modes.',
      'A tap selects an option and shows its description. CONFIRM takes it.',
      'The other two keys reroll: one the three options, one the kind of reward. Each is free once for every discard or swap the level ended with, then costs credits, more each time.',
    ] },

  { id: 'shop', group: 'between', title: 'The company store',
    body: [
      'The shop is drawn on your board, at your board\'s size. Each row is a category with a plate naming it.',
      'Buying several things at once that touch each other is cheaper.',
      'The shop uses the swaps and discards you had left. A swap moves a tile: double-tap it, then tap a neighbour. A discard rerolls a row: select its label and press REROLL.',
      'SELL shows what you own. Going back does not reroll the stock.',
    ] },

  { id: 'events', group: 'between', title: 'Events',
    body: [
      'An event is a decision: a trade, a gamble, an upgrade, a clean-up. Most can be skipped free. A few price the skip, and the key says so.',
      'An event you could not use is never offered. An event does not repeat straight away.',
      () => `Visiting an event opens its file in Builds, EVENTS. After ${EVENT_KNOW_NEED} visits the Schedule names it before you open it.`,
    ] },

  { id: 'limits', group: 'between', title: 'Limits',
    body: [
      'Limits are the caps on everything: board size, selection size, starting time, swaps, discards, {trick} slots, {FOCUS} ceiling, luck.',
      'They have floors as well as ceilings. The number shown is what you actually get: at 295 of 300 seconds, a +15s upgrade shows +5s.',
      'RECORDS -> Limits lists every one with where it currently stands.',
    ] },

  { id: 'limit_break', group: 'between', title: 'Limit Break',
    body: [
      'Two stages. First a FREE pick of three limits: lock one in and it applies immediately. A blind offer is revealed once it is locked in.',
      'Then an optional SECOND pick, which costs you something off a short list drawn at that moment. JUST THE ONE keeps the free pick and takes no second.',
    ] },

  { id: 'prize_grid', group: 'between', title: `The ${gridName('prize')}`,
    body: [
      `Beating a review opens ${gridName('prize', { a: true })} INSTEAD of ${gridName('reward', { a: true })}. It is smaller, every cell is a reward, and nothing common is on it.`,
    ] },

  { id: 'quarter', group: 'between', title: 'Quarters',
    body: [
      () => `A run is ${typeof QUARTERS_PER_RUN !== 'undefined' ? QUARTERS_PER_RUN : 4} QUARTERS. Each quarter is a handful of stops and then a manager review; beating the review closes the quarter and opens the next.`,
      'A tap continues past the quarter screen. The end-of-run report has a table by quarter under DETAILS.',
    ] },

  // ── The schedule ──────────────────────────────────────────────────────────
  { id: 'schedule', group: 'schedule', title: 'The schedule',
    body: [
      'Your schedule is a to-do list of OBLIGATIONS in four TIME SLOTS, read top to bottom, ending in the manager review.',
      'Each obligation is one thing you will do: a client account is an ordinary level.',
      'While the schedule is up, the three keys on the right are its tools: PEN, LEGEND and CLOCK IN. LEGEND lists every kind on this schedule, and tapping a row lights up where they are.',
      'Pick an obligation and its name shows on the command line at the foot. CLOCK IN takes it.',
      'You can draw on it. PEN lets a finger or the mouse lay ink, and the keys become DONE, COLOUR and UNDO. Right-drag draws without it, double right-click changes colour, and the ink is saved with your run.',
    ] },

  { id: 'slots_visits', group: 'schedule', title: 'Time slots and two visits',
    // r648: the default is the pick rule; the old walk is a dev option (mapPickRule).
    body: [
      () => _mapPickOn()
        ? 'EVERY obligation you take happens. You may take any TWO in a slot, next to each other or not, in any order.'
        : 'You move one step at a time and EVERY step activates the obligation you land on. Moves are up, down or forward, never diagonal.',
      () => _mapPickOn()
        ? 'Then you move on, and you can start the next slot on any obligation in it.'
        : 'You may take at most TWO obligations in a slot, and only if they are next to each other. Moving forward always enters the next slot on your current lane.',
      () => _mapPickOn()
        ? 'A two-slot obligation counts as one of your picks in its second slot.'
        : 'A move that would strand you is refused.',
    ] },

  { id: 'skip_cost', group: 'schedule', title: 'R&R',
    body: [
      'Leave a slot after taking only one obligation and you earn R&R: one perk, the department\'s own more often than the rest. Tap R&R on the bar to see the likely one.',
      'The perks: Sleight charges, a chance at a permaprime (a Trick fires once more every time, for good), a swap and a discard for good, a longer path on the next grid, card buffs, an upgrade, or credits.',
    ] },

  { id: 'departments', group: 'schedule', title: 'Departments',
    body: [
      'Each quarter belongs to one department, named on the location screen. It makes one kind of obligation more common, leans offers toward one kind of {Trick}, {Knack} or {Sleight}, and draws most of its events from its own list.',
      'It also decides what challenge cards pay: one reward for ordinary cards, another for hard ones. A card shows its reward and what raising it pays.',
    ] },

  { id: 'curve', group: 'schedule', title: 'Level goals',
    body: [
      'A level\'s {GOAL} is set by its time slot. Later slots ask more. In a slot with two or more levels, one or two of them ask a level more. Each line prints its {GOAL} before you clock in.',
    ] },

  // ── Pressure ──────────────────────────────────────────────────────────────
  { id: 'clock', group: 'pressure', title: 'The level clock',
    body: [
      'Reach the {GOAL} before the clock runs out. On the Schedule, running out ends the run. In Flow it starts the review.',
      'A PAUSE stops the clock for a few seconds. A REWIND puts seconds back on it. Playing a hand ends a pause.',
      'From ENTRY LEVEL difficulty up, swaps and discards cost seconds. Playing a hand costs none, unless it carries a kicker.',
    ] },

  { id: 'boss', group: 'pressure', title: 'Manager reviews',
    body: [
      'A review is an ordinary level with a modifier on it and a much larger {GOAL}. The briefing says what the modifier does before the clock starts. PROCEED starts it.',
      'You can read the briefing again mid-level by tapping the {GOAL} chip or the progress block.',
    ] },

  { id: 'difficulty', group: 'pressure', title: 'Difficulty',
    body: [
      'Each protocol has its own tier, set on the run screen: a $ per tier. Winning a run opens the next tier of that protocol, in Flow and the Schedule alike. A run keeps the tier it started on. Each tier keeps the changes below it.',
      () => DIFF_TIERS.map(t => `${t.tier} ${t.name}: ${t.say}`),
    ] },
  { id: 'mini_boss', group: 'pressure', title: 'Priority accounts',
    body: [
      `A priority account is an ordinary level with a RAISED {GOAL} and one extra requirement. Clearing it pays ${gridName('reward', { a: true })}; meeting the requirement pays credits too.`,
      'A one-on-one is a review\u2019s modifier at half strength. It pays credits and an upgrade you pick, not ' + gridName('reward', { a: true }) + '.',
      'Missing the requirement loses its credits, not the level.',
    ] },

  // ── Modes (r310) - how each mode works, one entry per carousel card ──────
  // Plain description only: what happens, in what order, and the numbers.
  { id: 'mode_map', group: 'modes', title: 'The Schedule',
    body: [
      () => `A run is ${typeof QUARTERS_PER_RUN !== 'undefined' ? QUARTERS_PER_RUN : 4} quarters. Each quarter is a new schedule: ${typeof MAP_SETS !== 'undefined' ? MAP_SETS : 4} time slots of ${typeof MAP_LANES !== 'undefined' ? MAP_LANES : 4} obligations, then the manager review. Two managers wait at the end. Each unlocks at ${typeof mapBossNeedN === 'function' ? mapBossNeedN() : 5} bookings in its two lanes. Unlock one and face it. Unlock both and choose. Unlock neither and a random manager holds the review.`,
      'Take any two obligations in a slot. Leaving a slot after one earns R&R: a perk.',
      `Obligations: client accounts (levels), priority accounts (hard levels), one-on-ones (a review\u2019s modifier at half strength), audits (challenge cards), the shop, events and raise requests (Limit Break). IT\u2019s quarter adds incentive programs (${gridName('reward', { plural: true })}).`,
      `An unconfirmed obligation (???) is a level, an audit, a priority account, an event, a one-on-one or ${gridName('reward', { a: true })}. You find out when you commit to it.`,
      'A level\'s goal is set by its slot. The review\'s goal is fixed when the schedule is drawn.',
      () => `Clearing a level offers a pick of three. Weights per offer: ${typeof GUIDED_PICK_WEIGHTS !== 'undefined' ? `{trick} ${GUIDED_PICK_WEIGHTS.trick}, {sleight} ${GUIDED_PICK_WEIGHTS.sleight}, {knack} ${GUIDED_PICK_WEIGHTS.knack}, event ${GUIDED_PICK_WEIGHTS.event}` : ''}. A priority account pays ${gridName('reward', { a: true })} instead; a one-on-one pays an upgrade you pick. An audit pays its challenge cards\u2019 rewards and nothing more.`,
    ] },
  { id: 'seeds', group: 'modes', title: 'Seeds',
    body: [
      'Every run plays on a seed. The end of run screen shows it, with COPY.',
      'To play a seeded run, turn SEED on at the foot of the run screen and type the seed. The same seed deals the same opening board, bosses and reward grids. What you play changes the rest.',
      'A seeded run counts for nothing: no unlocks, win tokens, difficulty tiers or event files.',
    ] },
  { id: 'mode_protocols', group: 'modes', title: 'Protocols',
    body: [
      () => `Flow and the Schedule are played under a protocol, chosen on the run screen: ${PROTOCOLS.map(p => p.name).join(', ')}. A protocol changes a few rules. The mode stays the same.`,
      'Difficulty belongs to the protocol. A win in Flow or the Schedule unlocks the next tier of that protocol for both.',
      'Winning a run of Dexterous, Precision, Limitless, Hyperfocus or Past Capacity unlocks its Knack (Ambidextrous, Measure Twice, Insatiable, ADHD, Curio), which can then be offered in any other run (ADHD in Hyperfocus too). Winning a run of Agentic unlocks a {trick}.',
      'Standard, Turbo, Agentic and Crunch are open from the start. Crunch is the Schedule\'s only. Dexterous, Precision, Limitless and Hyperfocus each open with a won run of the one before, in Flow or the Schedule.',
    ] },
  { id: 'mode_dexterous', group: 'modes', title: 'Dexterous',
    body: [
      'A protocol of Flow and the Schedule. Every {sleight} is dealt a rank and a suit when it joins your deck. It counts as a card of that rank in a hand and scores its pips.',
      'A {sleight} played in a hand does what it does when double-tapped, discarded or swapped, as well as scoring. The hand it is in takes Amplifier, Legacy and Siphon. A few only score when played: Magnet, Photocopier, Logistics Assistant, Keeper, Lockbox, Dealer\'s Choice, All Hands, Stopwatch, BOGO, Procrastinate, Shredder, Sequencer, the Idol.',
      'Sleights are four times as common in rewards. Two random common Sleights start in the deck.',
    ] },
  { id: 'mode_precision', group: 'modes', title: 'Precision',
    body: [
      () => `A protocol of Flow and the Schedule. The {FOCUS} speed bonus is half as strong, but the same for the first ${PRECISION.speedFlat} seconds after a hand, then it fades over ${PRECISION.speedFade} seconds.`,
      () => `Every hand but a Pair makes ${PRECISION.focusAdd} more {FOCUS}. A hand loses ${PRECISION.sizeStep} {FOCUS} for every card it is short of your Hand Size, so a short hand can lose {FOCUS}, ${PRECISION.lossCap} at most. Kickers do not count toward a hand's length.`,
      'Attention to Detail: Tricks that pay for a card\'s rank, suit, buffs or position pay 50% more.',
      () => `You start with ${knackName('meditation')}, ${knackName('attention_to_detail')}, +${PRECISION.swaps} swaps, +${PRECISION.discards} discards and +${PRECISION.cols} column. Flow's quarters are ${PRECISION.flowSeconds / 60} minutes longer; the Schedule's levels are ${PRECISION.mapSeconds / 60} minute longer.`,
    ] },
  { id: 'mode_limitless', group: 'modes', title: 'Limitless',
    body: [
      'A protocol of Flow and the Schedule. Every limit starts at its max.',
      () => `Flow: one reward a level-up, and every pick shows ${LIMITLESS.options} options. After the second boss, goals are doubled, bosses included.`,
      () => `The Schedule: every pick shows ${LIMITLESS.options} options, an audit pays one card fewer, and the ${gridName('reward', { bare: true })} and the ${gridName('prize', { bare: true })} have holes among their rewards: 1 or 2 in every 4. From Q3, goals are doubled.`,
    ] },
  { id: 'mode_hyperfocus', group: 'modes', title: 'Hyperfocus',
    body: [
      () => `A protocol of Flow and the Schedule. Every {FOCUS} you make is doubled, and {FOCUS} fades ${HYPERFOCUS.decay} times as fast. The {FOCUS} limits are the usual ones.`,
    ] },
  { id: 'mode_turbo', group: 'modes', title: 'Turbo',
    body: [
      'A protocol of Flow and the Schedule, open from the start.',
      'Flow: the quarter\'s clock starts at half, and every reward comes twice.',
      () => `The Schedule: one obligation a slot. Each review unlocks at ${TURBO.reviewNeed} bookings in its two lanes.`,
    ] },
  { id: 'mode_crunch', group: 'modes', title: 'Crunch',
    body: [
      'A protocol of the Schedule.',
      () => crunchSay(),
    ] },
  { id: 'mode_agentic', group: 'modes', title: 'Agentic',
    body: [
      'A protocol of Flow and the Schedule, open from the start.',
      () => `A hand of ${AGENTIC.minLen} or more cards side by side in one row or one column plays itself. Every card in the line must be part of the hand.`,
      () => `Line hands played one after another with nothing done in between are a chain. The 2nd and 3rd of a chain apply {FOCUS} ${1 + agenticChainExtra(2)} times, the 4th and 5th ${1 + agenticChainExtra(4)} times, and so on. A hand you play, a swap, a discard or a cancelled wait starts the chain over.`,
      'A hand that plays itself earns no speed bonus.',
      'Winning a run of Agentic unlocks a {trick}.',
      () => `A found hand smaller than your Selection Size waits ${AGENTIC.waitMs / 1000}s first. A click or tap anywhere cancels it. Settings, Controls, Protocol: Agentic turns the wait off.`,
      'Every other hand is played as usual.',
    ] },
  { id: 'mode_flow', group: 'modes', title: 'Flow',
    body: [
      () => `A ${Math.round((typeof FLOW_SESSION_SECONDS !== 'undefined' ? FLOW_SESSION_SECONDS : 300) / 60)}-minute clock counts down to the review. It does not reset when you level up.`,
      'Clear a {GOAL} to level up. A level-up pays one or more reward screens, then the next {GOAL} starts. Missing a {GOAL} does not end the run.',
      () => `When the clock reaches zero the review starts. It has its own ${typeof FLOW_BOSS_WINDOW !== 'undefined' ? FLOW_BOSS_WINDOW : 120}-second clock and its own {GOAL}. Pass it and the clock refills. Fail it and the run ends. Pass ${typeof SURVIVAL_BOSS_COUNT !== 'undefined' ? SURVIVAL_BOSS_COUNT : 4} to win. ENDLESS on the win screen carries the run on with faster-rising goals.`,
      () => `A review asks the {GOAL} of level ${typeof FLOW_BOSS_GOAL_LEVELS !== 'undefined' ? FLOW_BOSS_GOAL_LEVELS.join(' / ') : '8 / 14 / 20 / 24'}, or of your own level when you are past it. Every level you are past pays ${typeof FLOW_AHEAD_PAY !== 'undefined' ? FLOW_AHEAD_PAY : 10} credits.`,
      () => `Pick of three weights per offer: ${typeof SURVIVAL_PICK_WEIGHTS !== 'undefined' ? `{trick} ${SURVIVAL_PICK_WEIGHTS.trick}, {sleight} ${SURVIVAL_PICK_WEIGHTS.sleight}, {knack} ${SURVIVAL_PICK_WEIGHTS.knack}, limit ${SURVIVAL_PICK_WEIGHTS.limit}, event ${SURVIVAL_PICK_WEIGHTS.event}` : ''}. With adaptive odds on, a limit and a {knack} are each offered at least every four levels.`,
      () => `The Shop tile on a reward screen opens the store for ${creditsTxt(typeof SURVIVAL_SHOP_COST !== 'undefined' ? SURVIVAL_SHOP_COST : 5)}. The {FOCUS} ceiling starts at ${typeof FLOW_FOCUS_CAP !== 'undefined' ? FLOW_FOCUS_CAP : 20}.`,
    ] },
  { id: 'mode_guided', dev: true, group: 'modes', title: 'Guided',
    body: [
      () => `Each quarter is ${typeof GUIDED_SLOTS_PER_ACT !== 'undefined' ? GUIDED_SLOTS_PER_ACT : 8} slots, then the manager review.`,
      'Before each slot you choose one of four offers: a level, a hard level, ' + gridName('reward', { a: true }) + ', the shop, a pick of three or an event. Levels are free. Most other offers cost credits, and buying the same kind again in a quarter costs more.',
      'At least one offer in every three choices is a level. Every slot raises the goal, whether it is played or bought.',
      () => `Pick of three weights per offer: ${typeof GUIDED_PICK_WEIGHTS !== 'undefined' ? `{trick} ${GUIDED_PICK_WEIGHTS.trick}, {sleight} ${GUIDED_PICK_WEIGHTS.sleight}, {knack} ${GUIDED_PICK_WEIGHTS.knack}, event ${GUIDED_PICK_WEIGHTS.event}` : ''}.`,
    ] },
  { id: 'mode_normal', dev: true, group: 'modes', title: 'Classic',
    body: [
      () => `Four suits, 52 cards. A run is ${typeof QUARTERS_PER_RUN !== 'undefined' ? QUARTERS_PER_RUN : 4} quarters of five levels, each followed by a manager review.`,
      `Reach each level's {GOAL} before the clock runs out, or the run ends. After each level: the payout, then the ${gridName('reward')}. The ${gridName('reward')} can lead to the shop or an event.`,
      `Passing a review opens the ${gridName('prize')}.`,
    ] },
  { id: 'mode_spectrum', dev: true, group: 'modes', title: 'Spectrum',
    body: [
      'No suits and no face cards. Seven colours, each with the values 0 to 11 plus a 15 and a 20. A card scores pips equal to its value.',
      '9s, 10s and 11s are white and never count toward a flush. 15 and 20 cannot be part of a run. Flush of 3 scores nothing.',
      'Four payout cards are shuffled in. Score two hands next to one and it pays: +2 swaps, +2 discards, +10 seconds or +5 credits. It then leaves the board and returns to the deck.',
    ] },
  { id: 'mode_picker', dev: true, group: 'modes', title: 'Custom',
    body: [
      'Seven questions build the run: the deck, what happens between levels, level length, whether swaps and discards cost time, bosses on or off, who submits hands, and what hand types are worth.',
      'Some answers set others. Those are shown in amber.',
    ] },
  { id: 'mode_squares', dev: true, group: 'modes', title: 'Poker Squares',
    body: [
      'The 5x5: cards arrive three at a time and you drag each onto the board. A card lasts one extra deal, then leaves your hand at the next deal. 30 seconds a deal, 5 minutes a grid.',
      'You pick a {trick} from five before the first deal and after every other deal. The tray caps at 5; a full tray refuses a pick until you drop one.',
      'Every row and column pays its best hand of 3 or more cards - the cards do not have to touch inside the line. Runs are any suit; suits matter only for flushes. The board pays in full once mid-grid and again at the end, times your Focus.',
      'Focus builds from placing next to matching cards, placing quickly, and completing a paying line. It drains slowly.',
      '3 swaps and 3 discards per grid, both on placed cards only. They come back when the grid scores.',
      'Two grids, one score. The daily 3x3 and 4x4 grids are unchanged: every tile at once, valued from the real three- and four-card poker pay tables.',
    ] },

  // ── Credits ───────────────────────────────────────────────────────────────
  { id: 'icon_credits', group: 'credits', title: 'Icons and type',
    body: [
      () => `The pictures on Tricks, Knacks, Sleights and reward tiles are pixel versions of icons from game-icons.net, by ${(typeof PX_ICON_AUTHORS !== 'undefined' ? PX_ICON_AUTHORS : []).join(', ')}. CC BY 3.0 (creativecommons.org/licenses/by/3.0). The list of icons is in assets/icons/CREDITS.md.`,
      'The playing cards are Pixel Cards by Jfred (jfredd.itch.io/pixel-cards), CC0; the Joker is the wild card.',
      'The dice and their throw sound are from the Boardgame Pack by Kenney (kenney.nl), CC0.',
      'The coin flip hits and rattle are cut from "Coin drop" by vinrax (opengameart.org), CC0.',
      'VT323 is by Peter Hull, under the SIL Open Font License.',
      'The music is by Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0): Your Call, Eternity, Presenterator, Delightful D, Digital Lemonade, Newer Wave, Getting it Done, Nowhere Land, Shiny Tech, and in the shop Dispersion Relation, Intractable, C-Funk, Semi-Funk, Private Eye, Spy Glass. The game plays them through a speaker filter. The list is in assets/music/CREDITS.md.',
    ] },
];

function infoTopic(id) { return INFO_TOPICS.find(t => t.id === id) || null; }

// ── the panel ───────────────────────────────────────────────────────────────
// Body-level, OUTSIDE #cabinet, for the reason every pop-up in this game is:
// anything inside the cabinet inherits its CSS `zoom` and every px in here is
// meant to be a real viewport px.
let infoHubOpen = false;
let infoHubQuery = '';
let infoHubFromSettings = false;

function infoHubOverlay() {
  let el = document.getElementById('info-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'info-overlay';
    el.innerHTML = `<div id="info-panel">
        <div id="info-head">
          <div class="info-brand"><span class="rec-dot"></span>HANDBOOK</div>
          <input id="info-search" type="text" placeholder="Search" autocomplete="off" spellcheck="false">
          <button id="info-close" onclick="closeInfoHub()">✕</button>
        </div>
        <div id="info-nav"></div>
        <div id="info-body"></div>
      </div>`;
    document.body.appendChild(el);
    const search = el.querySelector('#info-search');
    search.addEventListener('input', () => { infoHubQuery = search.value.trim(); renderInfoHub(); });
    // Click outside the panel closes. Bound once, on the overlay itself, so it
    // cannot stack a copy per open.
    el.addEventListener('mousedown', e => { if (e.target === el) closeInfoHub(); });
  }
  return el;
}

// `topicId` opens the page scrolled to that entry with it lit - this is what a
// tip's READ MORE calls, and why tips and topics share their ids.
function openInfoHub(topicId, opts = {}) {
  infoHubFromSettings = !!opts.fromSettings;
  const el = infoHubOverlay();   // must exist BEFORE render looks up #info-body
  infoHubQuery = '';
  const search = el.querySelector('#info-search');
  if (search) search.value = '';
  renderInfoHub();
  el.classList.add('show');
  infoHubOpen = true;
  if (topicId) infoHubGoTo(topicId);
}

function closeInfoHub() {
  infoHubOverlay().classList.remove('show');
  infoHubOpen = false;
  if (infoHubFromSettings) {
    infoHubFromSettings = false;
    document.getElementById('settings-overlay')?.classList.add('show');
  }
}

function infoHubGoTo(id) {
  const card = document.querySelector(`#info-body .info-topic[data-topic="${id}"]`);
  if (!card) return;
  card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  card.classList.remove('lit');
  void card.offsetWidth;          // restart the flash if it is already lit
  card.classList.add('lit');
}

// Searches the EXPANDED text, not the stored text. A player reading "Utility"
// on screen has to be able to search for "utility"; the raw body says {trick}.
function infoHubMatch(t, q) {
  if (!q) return true;
  const flat = t.body.map(infoBlockText).join(' ');
  const hay = infoText(t.title + ' ' + t.id + ' ' + flat).toLowerCase();
  return hay.includes(q.toLowerCase());
}

// A BODY ENTRY MAY BE A FUNCTION, and a tuning number must be one. Typing
// "1 credit per 5 seconds" into the prose is exactly how the payout label, the
// count-up and Survival's bonus drifted apart before r213 put them on one
// constant - and that constant went 10 -> 5 -> 10 across three revisions. A page
// that states a number reads it from the code that charges it.
function _mapPickOn() { return typeof mapPickRule !== 'function' || mapPickRule(); }
function infoBlockHTML(b) {
  const v = (typeof b === 'function') ? _infoSafe(b) : b;
  if (Array.isArray(v)) return `<ul class="info-list">${v.map(x => `<li>${infoText(typeof x === 'function' ? _infoSafe(x) : x)}</li>`).join('')}</ul>`;
  return `<p>${infoText(v)}</p>`;
}
// A topic must never be able to blank the page by reading a global that is not
// there yet - the handbook opens from the MENU, before a run exists.
function _infoSafe(fn) { try { return fn(); } catch (e) { return ''; } }
function infoBlockText(b) {
  const v = (typeof b === 'function') ? _infoSafe(b) : b;
  return Array.isArray(v) ? v.map(x => (typeof x === 'function') ? _infoSafe(x) : x).join(' ')
                          : String(v == null ? '' : v);
}

function renderInfoHub() {
  const body = document.getElementById('info-body');
  const nav  = document.getElementById('info-nav');
  if (!body) return;
  const q = infoHubQuery;
  const shown = INFO_TOPICS.filter(t => !t.dev && infoHubMatch(t, q));   // r797: dev-only modes are not listed

  if (nav) {
    // Only groups that still have something in them, so a search never leaves a
    // chip that scrolls to nothing.
    const live = INFO_GROUPS.filter(([gid]) => shown.some(t => t.group === gid));
    nav.innerHTML = live.map(([gid, label]) =>
      `<button class="info-chip" onclick="infoHubGoGroup('${gid}')">${label}</button>`).join('');
    nav.style.display = live.length > 1 ? '' : 'none';
  }

  if (!shown.length) {
    body.innerHTML = `<div class="info-empty">Nothing here matches "${q.replace(/[<>&]/g, '')}".</div>`;
    return;
  }
  body.innerHTML = INFO_GROUPS.map(([gid, label]) => {
    const rows = shown.filter(t => t.group === gid);
    if (!rows.length) return '';
    return `<div class="info-group" data-group="${gid}"><div class="info-group-head">${label}</div>`
      + rows.map(t => `<div class="info-topic" data-topic="${t.id}">`
          + `<div class="info-topic-head">${infoText(t.title)}</div>`
          + t.body.map(infoBlockHTML).join('')
        + `</div>`).join('')
      + `</div>`;
  }).join('');
}

function infoHubGoGroup(gid) {
  document.querySelector(`#info-body .info-group[data-group="${gid}"]`)
    ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

// Settings -> Help. Hides Settings behind it and puts it back on close, the same
// dance openSettings(fromMenu) does with the main menu.
function openInfoHubFromSettings() {
  document.getElementById('settings-overlay')?.classList.remove('show');
  openInfoHub(null, { fromSettings: true });
}
