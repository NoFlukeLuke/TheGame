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
  ['between', 'Between rounds'],
  ['schedule','The schedule'],
  ['pressure','Pressure'],
  ['modes',   'Modes'],
];

const INFO_TOPICS = [
  // ── The basics ────────────────────────────────────────────────────────────
  { id: 'select', group: 'basics', title: 'What a selection is',
    body: [
      'You pick cards off the board to make a poker hand. The only rule about WHERE they are is that the cards you pick must touch each other edge to edge, in one connected group. Diagonals do not count.',
      'Inside that group, nothing else about position matters, and the order you tapped them in never matters. 4, 6, 7, 5 is a Run of 4 whichever cells they sit in and whichever one you tapped first.',
    ] },

  { id: 'penalty_cards', group: 'basics', title: 'Cards your hand drops',
    body: [
      'Every card in a hand has to be part of the hand. If you select five cards and only four of them make a shape, the fifth is DROPPED: you lose its pips, and the card is used up anyway.',
      'A dropped card turns red on the board before you play, and the hand label prices it, so you can always see it coming.',
      ['A run needs consecutive ranks. 4-6-7-5-9 is not a Straight, it is a Run of 4 with the 9 dropped.',
       'A hand can be several shapes at once, so a spare card is often not spare. 2, 2, J, Q, K is a Pair and a Run of 3, and every card is used.',
       () => `The hard cap is ${typeof HAND_MAX_CARDS !== 'undefined' ? HAND_MAX_CARDS : 7} cards in a hand, so at the largest selection sizes some cards are always dropped.`],
      'The Tagalong {knack} lifts the whole rule: your hands may carry cards that are not part of them, and those cards score normally instead of being billed.',
    ] },

  { id: 'min_selection', group: 'basics', title: 'The minimum you must commit',
    body: [
      'Selection Size is not just a ceiling. Raising it also raises a FLOOR two below it, so at a Selection Size of 5 you must commit at least 3 cards to every hand.',
      'The hand label reads NEED / n in red until you have enough.',
    ] },

  { id: 'high_card', group: 'basics', title: 'High Card',
    body: [
      'When the minimum forces you to commit cards that do not make a shape, the hand still plays as a High Card. It scores the cards\' own pips and nothing else: no base pips, no mult, no {FOCUS}.',
      'High Card does not grow with Natural Scaling.',
    ] },

  { id: 'hand_layers', group: 'basics', title: 'A hand can be several hands',
    body: [
      'A played hand is broken into COMPONENTS, and every component pays its own base pips and base mult. Seven cards can be a Run of 4 and a Three of a Kind at once, and both get paid.',
      'A flush LAYERS on top rather than replacing anything. Three cards of one suit that are also a run pay the run and the flush, and those cards score twice.',
      'The hand label beside the preview names every layer, so what it says is exactly what the score counted.',
    ] },

  // ── The board ─────────────────────────────────────────────────────────────
  { id: 'swap_discard', group: 'board', title: 'Swapping and discarding',
    body: [
      'A SWAP trades two cards that touch. A DISCARD throws selected cards away and pulls new ones down. Both are capped per round, and in most modes both cost time off the round clock.',
      'Each swap and discard you did not use pays credits at the end of the round.',
    ] },

  { id: 'sleight_grid', group: 'board', title: '{Sleights} sit on the board',
    body: [
      'A {sleight} is a real card in your deck, drawn like any other. It falls, swaps, gets discarded, and can be played inside a hand.',
      'Most have limited charges, shown on the card. Some work just by SITTING there, some fire when you play them, some when you double-tap them.',
      'Press and hold one on the board to read what it does. A single tap is reserved for selecting it into a hand.',
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
      'It scores no pips of its own and fires no {Tricks}. The set it completes pays its own base pips and mult as normal, and the real cards in it score as normal.',
      'A set needs at least one real card to name its rank, so wilds on their own are not a hand.',
      'Four are shuffled into the deck at the start of a run.',
    ] },

  { id: 'curses', group: 'board', title: 'Cursed cards',
    body: [
      'A curse rides one specific card, not a rank or a suit, and lifts by itself after that card has scored a few times.',
      ['Leaden - scores no pips.',
       'Taxing - costs seconds every time it scores.',
       'Snared - cannot be swapped or discarded.'],
      'The Clean Up meeting can take every curse off at once.',
    ] },

  { id: 'card_buffs', group: 'board', title: 'FLAT and SCALING card buffs',
    body: [
      'A buffed card says which kind it is, and the difference matters:',
      ['FLAT - "scores +5 mult when played". That is the number, every time, forever.',
       'SCALING - "scales +1 mult each time it\'s played". The bonus itself grows with use, and the card carries a small green arrow.'],
    ] },

  { id: 'line_markers', group: 'board', title: 'Coloured lines down the board',
    body: [
      'Some {tricks} mark a whole row or column. The line is drawn behind the cards in that {trick}\'s colour, with its symbol on both ends, and every card on the line wears a ring in the same colour.',
      'A card sitting where two lines cross splits its ring between both colours. The lines stay for the whole run and stay visible between rounds.',
    ] },

  // ── Scoring ───────────────────────────────────────────────────────────────
  { id: 'pips_mult', group: 'scoring', title: 'Pips, mult and the tally',
    body: [
      'A hand is worth its PIPS multiplied by its MULT, then multiplied by {FOCUS}. The hand type sets a base for the first two; every card adds its own pips; everything you own adds to one or the other.',
      'The tally plays out one card at a time. Each {trick} pops and throws its own number at the moment it actually pays.',
      'A blue diamond is pips, a red one is mult, violet is {FOCUS}, gold is credits, white is time.',
    ] },

  { id: 'focus', group: 'scoring', title: '{FOCUS}',
    body: [
      '{FOCUS} is a multiplier on the whole hand. You earn it by playing complicated hands and by playing them fast, and it DECAYS while you sit still.',
      'The {FOCUS} a hand earns is applied to that same hand.',
      'The meter has a ceiling you can raise. Some things trade the ceiling for something else, and a few pay out every time you reach the top.',
    ] },

  { id: 'speed_bonus', group: 'scoring', title: 'The speed bonus',
    body: [
      'A hand\'s {FOCUS} comes from two things: what the hand IS, and how fast you played it after the previous one.',
      'The speed part is largest the instant a hand lands and fades over the next few seconds. Playing slowly earns only the hand\'s own {FOCUS}.',
      'Pair, Flush of 3 and Flush of 4 earn half the speed bonus. Some things scale it: Overclock multiplies it, and Long Fuse and Governor give you longer to earn the same amount.',
    ] },

  { id: 'natural_scaling', group: 'scoring', title: 'Hands get better as you play them',
    body: [
      'Every hand TYPE has its own permanent bonus that grows each time you play it. Play Runs of 3 all run and Runs of 3 get worth more; it does nothing for your Four of a Kind.',
      'The RECORDS -> Hands tab shows the live value of every hand with the earned part in green. The Old Tricks {knack} makes every hand read the best bonus anywhere in its family.',
    ] },

  { id: 'replays', group: 'scoring', title: 'A card that scores twice',
    body: [
      'A REPLAY re-scores one card, exactly as if it were in the hand again. In the tally you see that card\'s whole beat repeat, numbers and all.',
      'The commonest source is layering: a card that is in two components of the same hand scores once for each. Several {tricks} and card buffs add replays of their own.',
      'A replay re-scores what the CARDS earned. It does not double the hand\'s base pips or any bonus paid to the hand as a whole.',
    ] },

  // ── What you own ──────────────────────────────────────────────────────────
  { id: 'tricks', group: 'owned', title: '{Tricks} and the slot cap',
    body: [
      'A {trick} is a scoring buff that sits in your tray, never on the board. It works by itself whenever its condition is met.',
      'Your tray has a HARD CAP. When it is full, a new {trick} is refused outright: the count flashes red and nothing is taken. Make room first by SELLING one, which you do by tapping it in the tray and choosing Sell.',
      'Some {tricks} depend on their position in the tray. The Tray Order meeting changes the order.',
    ] },

  { id: 'sleights', group: 'owned', title: '{Sleights}',
    body: [
      'A {sleight} is a card that lives in your deck. See "{Sleights} sit on the board" for how they behave in play.',
      'Their charges are per RUN, not per round, and most cycle back into the deck after firing rather than being destroyed.',
    ] },

  { id: 'knacks', group: 'owned', title: '{Knacks}',
    body: [
      'A {knack} is not a card and not a tray item. It is a permanent rule change for the rest of the run, shown as a small chip in the HUD.',
      '{Knacks} are never duplicated and never expire. Tap one to read it, or to sell it.',
    ] },

  { id: 'improve', group: 'owned', title: 'Improvement tiers - the v2.0 stamp',
    body: [
      'Anything you own can be IMPROVED, which makes its own numbers bigger. A +5 bonus climbs 5, 10, 15, 20, 25, 40 across five improvements.',
      'The tier is stamped on the object as a version number, and the object itself changes: gold bands count up across its corner, and a {trick}\'s shutter climbs from grey through bronze, silver, gold and black to iridescent.',
      'The printed description follows the number.',
    ] },

  { id: 'priming', group: 'owned', title: 'Primed - the violet +2',
    body: [
      'A PRIMED {trick} fires again on your next hand. The violet pill on the tile is how many extra fires are stacked up, and all of them go off on the same hand.',
      'The stack is then spent. The Extra Rep meeting primes a {trick} PERMANENTLY, so that one fires an extra time every hand for the rest of the run.',
      'A prime cannot make a {trick} fire when its condition was not met, and a {trick} that sat the hand out keeps its stack. A FORCED fire is the other thing: it ignores the condition and pays anyway.',
    ] },

  // ── Between rounds ────────────────────────────────────────────────────────
  { id: 'payout', group: 'between', title: 'The payout',
    body: [
      'Clearing the {GOAL} pays credits. Three lines:',
      () => ['Interest on the credits you are holding.',
       `Time left on the clock, at 1 credit per ${(typeof efficiencySecondsPerCoin === 'function') ? efficiencySecondsPerCoin() : 10} seconds.`,
       'Swaps and discards you did not spend.'],
      'The Contributions view on the same screen breaks the round down by what earned it.',
    ] },

  { id: 'reward_grid', group: 'between', title: 'The reward grid',
    body: [
      'A board of rewards and liabilities. You pick a CONNECTED PATH through it and take EVERYTHING on that path.',
      'Tapping a tile you cannot reach shows its description. Tapping one you can reach picks it and shows its description.',
      'There is a minimum number of picks, the same as on the board. SKIP takes nothing.',
    ] },

  { id: 'pick_three', group: 'between', title: 'Take your pick',
    body: [
      'Three offers, and you take one. The Schedule offers one after every round you clear; Flow and Survival after every {GOAL}. Guided sells one as a slot.',
      'Each offer rolls its own type. The chances depend on the mode; see that mode\'s entry under Modes.',
      'A tap selects an option and shows its description. CONFIRM takes it.',
      () => `Rerolls come from one pool for the whole run: ${typeof PICK_REROLLS_START !== 'undefined' ? PICK_REROLLS_START : 3} at the start, +${typeof PICK_REROLLS_PER_BOSS !== 'undefined' ? PICK_REROLLS_PER_BOSS : 2} per review passed. When the pool is empty a reroll costs credits, rising each time on the same screen.`,
    ] },

  { id: 'shop', group: 'between', title: 'The company store',
    body: [
      'The shop is drawn on your own board, at your own board size, so raising the board raises the shop. Each row is a category with a plate naming it.',
      'Buying several things at once that touch each other is cheaper.',
      'The shop uses the swaps and discards you had left. A swap moves a tile: double-tap it, then tap a neighbour. A discard rerolls a row: select its label and press REROLL.',
      'SELL shows what you own. Going back does not reroll the stock.',
    ] },

  { id: 'events', group: 'between', title: 'Meetings',
    body: [
      'A meeting is a one-screen decision: a trade, a gamble, an upgrade, a clean-up. SKIP is always available.',
      'A meeting you could not use is never offered. If you own nothing to improve, the improve meetings do not come up at all.',
      'The same meeting never lands twice in a row.',
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
      'Then an optional SECOND pick, which costs you something off a short list drawn at that moment. JUST THE ONE always walks away with the free pick and no price.',
    ] },

  { id: 'prize_grid', group: 'between', title: 'The prize grid',
    body: [
      'Beating a review opens a prize grid INSTEAD of an ordinary reward grid. It is smaller, every single cell is a reward with no liabilities at all, and nothing common is on it.',
    ] },

  { id: 'quarter', group: 'between', title: 'Quarters',
    body: [
      () => `A run is ${typeof QUARTERS_PER_RUN !== 'undefined' ? QUARTERS_PER_RUN : 4} QUARTERS. Each quarter is a handful of stops and then a manager review; beating the review closes the quarter and opens the next.`,
      'The card that comes up between them is a summary, and a tap skips it. At the end of the run the report breaks the whole thing down quarter by quarter.',
    ] },

  // ── The schedule ──────────────────────────────────────────────────────────
  { id: 'schedule', group: 'schedule', title: 'The schedule',
    body: [
      'Your schedule is a board of OBLIGATIONS in six TIME SLOTS, read left to right, ending in the manager review.',
      'Each obligation is one thing you will do: a client account is an ordinary round. The legend button lists every kind on this schedule, and tapping a row lights up where they are.',
      'You can draw on it. Right-drag lays ink over the board, double right-click changes colour, and it is saved with your run.',
    ] },

  { id: 'slots_visits', group: 'schedule', title: 'Time slots and two visits',
    body: [
      'You move one step at a time and EVERY step activates the obligation you land on. Moves are up, down or forward, never diagonal.',
      'You may take at most TWO obligations in a slot, and only if they are next to each other. Moving forward always enters the next slot on your current lane.',
      'A move that would strand you is refused rather than allowed: the bar tells you a path dead-ends instead of letting you walk into it.',
    ] },

  { id: 'skip_cost', group: 'schedule', title: 'Leaving a slot early',
    body: [
      'Leave a slot after taking only one obligation and you are paid credits. The amount goes up each time you do it.',
    ] },

  { id: 'curve', group: 'schedule', title: 'Everything advances the goal',
    body: [
      'Every obligation raises the difficulty, whether you PLAYED it or BOUGHT it. Visiting the store moves the {GOAL} exactly as finishing a round does.',
    ] },

  // ── Pressure ──────────────────────────────────────────────────────────────
  { id: 'clock', group: 'pressure', title: 'The round clock',
    body: [
      'The clock is the round. Reach the {GOAL} before it runs out and the round is cleared; run out first and the run ends.',
      'Two different things give time back and the words are not interchangeable: a PAUSE freezes the clock for a few seconds, a REWIND puts seconds back on it. Some things scale off one and not the other.',
      'Swaps and discards bill the clock. Playing a hand is free.',
    ] },

  { id: 'boss', group: 'pressure', title: 'Manager reviews',
    body: [
      'A review is an ordinary round with one modifier on it and a much larger {GOAL}. The briefing says exactly what the modifier does before the clock starts, and PROCEED is what starts it.',
      'A review can make a style of play COST more or PAY less. It can never make one impossible, and there is always something still paying full.',
      'You can read the briefing again mid-round by tapping the {GOAL} chip or the progress block.',
    ] },

  { id: 'mini_boss', group: 'pressure', title: 'Priority accounts',
    body: [
      'A priority account is an ordinary round with a RAISED {GOAL} and one extra requirement, and it pays credits for both.',
      'Missing the requirement is not failing the round. Clear the raised {GOAL} and the round passes as normal; meet the requirement too and you also take the bonus.',
    ] },

  { id: 'seed', group: 'pressure', title: 'Seeds',
    body: [
      'Every run is built from a SEED, a short code shown on the menu. The same seed deals the same opening board and stocks the same shops.',
      'It is a seed, not a replay: what you choose still changes what comes next.',
    ] },

  // ── Modes (r310) - how each mode works, one entry per carousel card ──────
  // Plain description only: what happens, in what order, and the numbers.
  { id: 'mode_map', group: 'modes', title: 'The Schedule',
    body: [
      () => `A run is ${typeof QUARTERS_PER_RUN !== 'undefined' ? QUARTERS_PER_RUN : 4} quarters. Each quarter is a new schedule: 4 lanes, 6 time slots, then the manager review.`,
      'Every step activates the obligation you land on. You can take up to two obligations in a slot, if they are next to each other. Leaving a slot after one pays credits.',
      'Obligations: client accounts (rounds), priority accounts (hard rounds), the shop, incentive programs (reward grids), meetings (events) and raise requests (Limit Break). Some are hidden until you arrive.',
      'Every obligation raises the goal. The review\'s goal is fixed when the schedule is drawn.',
      () => `Clearing a round offers a pick of three: ${typeof GUIDED_PICK_WEIGHTS !== 'undefined' ? `${GUIDED_PICK_WEIGHTS.trick}% {trick}, ${GUIDED_PICK_WEIGHTS.sleight}% {sleight}, ${GUIDED_PICK_WEIGHTS.knack}% {knack}` : ''} per offer. A priority account adds a pick of two {knacks}.`,
    ] },
  { id: 'mode_flow', group: 'modes', title: 'Flow',
    body: [
      () => `A ${Math.round((typeof FLOW_SESSION_SECONDS !== 'undefined' ? FLOW_SESSION_SECONDS : 300) / 60)}-minute clock counts down to the review. It does not reset when you level up.`,
      'Clear a {GOAL} to level up. Each level up offers a pick of three, then the next, larger {GOAL} starts. Missing a {GOAL} does not end the run.',
      () => `When the clock reaches zero the review starts. It has its own ${typeof FLOW_BOSS_WINDOW !== 'undefined' ? FLOW_BOSS_WINDOW : 120}-second clock and its own {GOAL}. Pass it and the clock refills. Fail it and the run ends. After five reviews you can stop or continue with faster-rising goals.`,
      () => `Pick of three odds per offer: ${typeof SURVIVAL_PICK_WEIGHTS !== 'undefined' ? `${SURVIVAL_PICK_WEIGHTS.trick}% {trick}, ${SURVIVAL_PICK_WEIGHTS.sleight}% {sleight}, ${SURVIVAL_PICK_WEIGHTS.knack}% {knack}, ${SURVIVAL_PICK_WEIGHTS.limit}% limit` : ''}. At least one limit and one {knack} are offered every four levels.`,
      () => `The shop can be opened at any time for ${typeof SURVIVAL_SHOP_COST !== 'undefined' ? SURVIVAL_SHOP_COST : 5} credits. Swaps and discards cost no time. The {FOCUS} ceiling starts at ${typeof FLOW_FOCUS_CAP !== 'undefined' ? FLOW_FOCUS_CAP : 20}.`,
    ] },
  { id: 'mode_guided', group: 'modes', title: 'Guided',
    body: [
      () => `Each quarter is ${typeof GUIDED_SLOTS_PER_ACT !== 'undefined' ? GUIDED_SLOTS_PER_ACT : 8} slots, then the manager review.`,
      'Before each slot you choose one of four offers: a round, a hard round, a reward grid, the shop, a pick of three or a meeting. Rounds are free. Most other offers cost credits, and buying the same kind again in a quarter costs more.',
      'At least one offer in every three choices is a round. Every slot raises the goal, whether it is played or bought.',
      () => `Pick of three odds per offer: ${typeof GUIDED_PICK_WEIGHTS !== 'undefined' ? `${GUIDED_PICK_WEIGHTS.trick}% {trick}, ${GUIDED_PICK_WEIGHTS.sleight}% {sleight}, ${GUIDED_PICK_WEIGHTS.knack}% {knack}` : ''}.`,
    ] },
  { id: 'mode_sixsuits', group: 'modes', title: 'Six Suits',
    body: [
      'Six suits: spades, hearts, diamonds, clubs, crowns and moons. 60 cards, with one rank removed from the middle.',
      'Flush of 3 and Flush of 4 can be played from the start. Everything else is as in Classic.',
    ] },
  { id: 'mode_normal', group: 'modes', title: 'Classic',
    body: [
      () => `Four suits, 52 cards. A run is ${typeof QUARTERS_PER_RUN !== 'undefined' ? QUARTERS_PER_RUN : 4} quarters of five rounds, each followed by a manager review.`,
      'Reach each round\'s {GOAL} before the clock runs out, or the run ends. After each round: the payout, then the reward grid. The reward grid can lead to the shop or a meeting.',
      'Passing a review opens the prize grid.',
    ] },
  { id: 'mode_spectrum', group: 'modes', title: 'Spectrum',
    body: [
      'No suits and no face cards. Seven colours, each with the values 0 to 11 plus a 15 and a 20. A card scores pips equal to its value.',
      '9s, 10s and 11s are white and never count toward a flush. 15 and 20 cannot be part of a run. Flush of 3 scores nothing.',
      'Four payout cards are shuffled in. Score two hands next to one and it pays: +2 swaps, +2 discards, +10 seconds or +5 credits. It then leaves the board and returns to the deck.',
    ] },
  { id: 'mode_picker', group: 'modes', title: 'Custom',
    body: [
      'Seven questions build the run: the deck, what happens between rounds, round length, whether swaps and discards cost time, bosses on or off, who submits hands, and what hand types are worth.',
      'Some answers set others. Those are shown in amber.',
    ] },
  { id: 'mode_squares', group: 'modes', title: 'Poker Squares',
    body: [
      'Each turn deals three tiles of cards. Place them on the 5x5 board over four turns.',
      'At the end of the round every row and column scores as a five-card poker hand, lowest first. Ten rounds, no clock and no goal.',
      'SCORE ALL scores all ten lines at the end. SELECT SCORE scores one line per turn, and a scored line is closed.',
      'Between rounds you pick a {trick} and a consumable.',
      'The daily 3x3 and 4x4 grids score three- and four-card hands, valued from the real three- and four-card poker pay tables.',
    ] },
  { id: 'mode_survival', group: 'modes', title: 'Survival',
    body: [
      'Each {GOAL} has its own 2-minute clock. Clear it for a pick of three; miss it and the run ends. Score above the {GOAL} carries into the next round.',
      'A review comes every 5 minutes of play, played on the time you had left over.',
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
  const shown = INFO_TOPICS.filter(t => infoHubMatch(t, q));

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
