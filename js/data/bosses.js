// A boss has NO score target of its own (r155, confirmed and enforced r205): the
// win bar is simply THIS ROUND'S GOAL - `bossGoalMet()` is `score >= roundGoal`.
// A boss's challenge is its MODIFIER. The vestigial `target: 4000`-style numbers
// these presets used to carry were read by nothing and are gone, so a preset can
// no longer look like it sets a second requirement. A `hand` objective is the one
// thing layered on top of the goal, and it still carries its own handName/count.
const BOSS_PRESETS = [
  {
    id: 'stone_lord',
    name: 'THE STONE LORD',
    flavor: 'Your deck turns to rubble',
    objective: { type: 'score' },
    brief: 'The board starts part-buried: stones land on it immediately, scaled to its size, and almost a fifth of your deck is rubble for the rest of the round. A stone cannot be selected, played, swapped or discarded - it just takes up a cell until something clears it.',
    modifiers: ['inject_stones'],
    // r216: stoneInjectCount is dead. The board dose is derived from the grid and
    // the deck dose from the real deck size (see inject_stones in js/boss.js).
    params: { deckStoneFraction: 0.18 }
  },
  {
    id: 'voidwright',
    name: 'THE VOIDWRIGHT',
    flavor: 'Two of your Tricks at a time',
    brief: 'Two of your Tricks are switched off for the first half of the round, then those two come back and a different two go off for the second half. The briefing shows you which - both halves, up front - and a switched-off Trick is greyed out in your tray and in Records the whole time.',
    objective: { type: 'score' },
    modifiers: ['trick_pool_split'],
    params: { perPhase: 2 }
  },
  {
    id: 'hand_of_famine',
    name: 'THE HAND OF FAMINE',
    flavor: 'A withered deck offers little',
    brief: 'Your deck is stacked against you: the low cards are near the top, so the early part of the round deals you far more of them than it should. Nothing is added or taken away - these are your own cards, in a bad order, and the good ones are still down there.',
    objective: { type: 'hand', handName: 'Flush', count: 2 },
    modifiers: ['low_card_infusion'],
    // r216: this no longer rewrites the rank of a drawn card (which invented
    // cards that were not in the deck). It weights the DRAW PILE at boss start.
    params: { lowCardWeight: 0.7 }
  },
  {
    id: 'cornerless_king',
    name: 'THE CORNERLESS KING',
    flavor: 'The edges hold no salvation',
    objective: { type: 'score' },
    brief: 'The four corners are gone for the round - no card falls there and nothing can be played from them. On top of that half your swaps and half your discards are taken, rounded in your favour.',
    modifiers: ['void_corners', 'ration_half'],
    params: {}
  },
  {
    id: 'the_hollow',
    name: 'THE HOLLOW',
    flavor: 'Cards crumble into nothing',
    brief: 'Every 7 seconds one card is pulled off the board and shuffled back into your deck. Another falls in to replace it, so the board stays full - but the card you were building around may not be there when you reach for it.',
    objective: { type: 'score' },
    // r213: the hole is REFILLED now (see periodic_null in js/boss.js), so this
    // is board churn rather than board destruction. 6s -> 7s alongside that,
    // because a refilling tick can safely be quicker than a shredding one and
    // the pair together land near the original threat level.
    modifiers: ['periodic_null'],
    params: { nullIntervalSecs: 7, nullCount: 1 }
  },

  // ── r150 roster ────────────────────────────────────────────────────────────
  // Every one of these acts ONCE at round start and then on its interval - that
  // shape lives in bossSchedule (js/boss-effects.js), which is also where the
  // Contingency Plan knack stretches the timings.
  {
    id: 'the_metronome',
    name: 'THE METRONOME',
    flavor: 'It keeps your time now',
    brief: 'The clock runs at your Focus multiplier. At ×3 Focus, three seconds leave the clock every second. Focus is still worth having - it just costs you the round to hold.',
    objective: { type: 'score' },
    modifiers: ['time_scales_with_focus'],
    params: {}
  },
  {
    id: 'the_tollman',
    name: 'THE TOLLMAN',
    flavor: 'Every touch is billed',
    brief: 'Swaps and discards cost double, and playing a hand - normally free - is billed 5 seconds on top of anything it already cost. The hand scores FIRST and the clock is charged after, so a hand you cannot afford still counts: if it wins the round, you win the round.',
    objective: { type: 'score' },
    modifiers: ['interact_surcharge'],
    params: { costMult: 2, playCostAdd: 5 }
  },
  {
    id: 'the_undertow',
    name: 'THE UNDERTOW',
    flavor: 'Concentration will not hold',
    brief: 'Every 15 seconds, 10 Focus is pulled out of the meter. Build it faster than it drains, or accept a low multiplier and score on volume.',
    objective: { type: 'score' },
    modifiers: ['focus_drain'],
    params: { everySecs: 15, amount: 10 }
  },
  {
    id: 'the_quarantine',
    name: 'THE QUARANTINE',
    flavor: 'The board is being condemned, cell by cell',
    brief: 'Every 15 seconds a cell is marked with a cross. Ten seconds later it goes dark: cards still fall into it, but nothing there can be selected, played, discarded or swapped. The dark cells accumulate.',
    objective: { type: 'score' },
    modifiers: ['cell_quarantine'],
    params: { everySecs: 15 }
  },
  {
    id: 'the_hold',
    name: 'THE HOLD',
    flavor: 'That one stays where it is',
    brief: 'Every 13 seconds two random cards are put on hold for 15 seconds each. A held card shows its countdown and cannot be selected, played, swapped or discarded. They come back when their timers run out, and by then two more are down.',
    objective: { type: 'score', target: 4000 },
    modifiers: ['card_hold'],
    params: { everySecs: 13, holdSecs: 15, count: 2 }
  },
  {
    id: 'the_censor',
    name: 'THE CENSOR',
    flavor: 'Your paperwork is under review',
    brief: 'Every 35 seconds one of your Tricks is suspended for 45 seconds. The windows overlap, so for 10 seconds of every cycle two of them are down at once.',
    objective: { type: 'score' },
    modifiers: ['trick_blackout'],
    params: { everySecs: 35, holdSecs: 45 }
  },
  {
    id: 'the_blight',
    name: 'THE BLIGHT',
    flavor: 'It spreads through the board',
    brief: 'Every 20 seconds three more cells are contaminated, for the rest of the round. Cards scored from a contaminated cell contribute half their pips, and may fail to trigger a Trick they otherwise would.',
    objective: { type: 'score' },
    modifiers: ['cell_blight'],
    params: { everySecs: 20, count: 3 }
  },
  {
    id: 'the_recall',
    name: 'THE RECALL',
    flavor: 'That rank has been withdrawn',
    brief: 'Three ranks are withdrawn at a time. Those cards stay on the board but cannot be played, swapped or discarded, and they carry a countdown. Every 45 seconds that set is reinstated and three different ranks are taken. Plan around what is down; it will come back.',
    objective: { type: 'score' },
    modifiers: ['rank_recall'],
    // r213: ONE rank froze 1.23 cards of 16 on average and hit nothing at all 22%
    // of the time. Three at a time on a slower rotation is the owner's spec - it
    // hurts, it is plannable, and it still leaves most of the board live.
    params: { everySecs: 45, rankCount: 3 }
  },
  {
    id: 'the_auditor',
    name: 'THE AUDITOR',
    flavor: 'Your allowances are under revision',
    brief: 'Every 30 seconds one swap or one discard is struck off your allowance for this round. Spend them while you still have them.',
    objective: { type: 'score' },
    modifiers: ['ration_cut'],
    params: { everySecs: 30 }
  },
  {
    id: 'the_ratchet',
    name: 'THE RATCHET',
    flavor: 'The bar only moves one way',
    brief: 'Every swap and every discard raises the objective by 5%. It never comes back down. Fixing the board is now a decision with a price attached.',
    objective: { type: 'score' },
    modifiers: ['goal_ratchet'],
    params: { rate: 0.05 }
  },
  {
    id: 'the_turnstile',
    name: 'THE TURNSTILE',
    flavor: 'Access is metered',
    brief: 'Every swap and every discard costs 5 credits, and you must be able to pay: with fewer than 5 credits the board is simply not yours to fix. Interest is still paid on whatever survives the round.',
    objective: { type: 'score' },
    modifiers: ['interact_fee'],
    params: { fee: 5 }
  },
  {
    id: 'the_marker',
    name: 'THE MARKER',
    flavor: 'Some of these are no good',
    brief: 'One card in every ten is quietly marked. Nothing tells you which. Play a marked card and it is discarded instead of scored, along with every other marked card in that hand - the hand does not score at all. Marked cards are only spent by being played, so a hand that fizzles at least clears them.',
    objective: { type: 'score' },
    modifiers: ['discard_curse'],
    params: { everyNthCard: 10 }
  },
  {
    id: 'the_redaction',
    name: 'THE REDACTION',
    flavor: 'That hand is no longer recognised',
    brief: 'A whole family of hands - sets, runs or flushes - scores a quarter of what it should. After 90 seconds that family is released and a different one is marked down, and so on for as long as the round runs. Two of the three are always paying full.',
    objective: { type: 'score' },
    modifiers: ['redact_hand'],
    params: { mult: 0.25, holdSecs: 90 }
  },

  // ══════════════════════════════════════════════
  // THE r217 ROSTER
  // ══════════════════════════════════════════════
  // Sixteen bosses, all built to one rule the owner set: a boss may make a play
  // style COST more or PAY less, but it may never make one impossible. Nothing
  // here says "you cannot play runs". The harshest of them mark a family or a set
  // of suits DOWN and always leave something paying full - which is what makes
  // the round a plan rather than a wall.
  {
    id: 'the_quota',
    name: 'THE QUOTA',
    flavor: 'Show your work, or start again',
    brief: 'Three deadlines inside the round: a fifth of the goal by the first third, two fifths by the second, three fifths by the third. Miss one and your score goes back to zero - the round is not lost, but everything you banked is. The last stretch has no deadline, which is when a loadout is meant to pay.',
    objective: { type: 'score' },
    modifiers: ['score_quota'],
    params: { shares: [0.2, 0.4, 0.6] }
  },
  {
    id: 'the_tax_man',
    name: 'THE TAX MAN',
    flavor: 'One credit a card, payable on play',
    brief: 'Every hand costs credits equal to how many cards were in it. Big hands are still the best hands, they just cost more. The hand scores first and the bill comes after, so a hand you cannot afford still counts if it is the one that wins. Run out of credits and the round is over.',
    objective: { type: 'score' },
    modifiers: ['play_fee_credits'],
    params: { perCard: 1 }
  },
  {
    id: 'the_grind',
    name: 'THE GRIND',
    flavor: 'It worked the first time',
    brief: 'A hand type pays 15% less every time you repeat it, and only forgets after five other hands. Nothing is switched off - your best hand is still your best hand, it just stops being the answer to everything. Move down the ladder and come back to it.',
    objective: { type: 'score' },
    modifiers: ['repeat_decay'],
    params: { rate: 0.15, window: 5 }
  },
  {
    id: 'the_drought',
    name: 'THE DROUGHT',
    flavor: 'Everything you learned, forgotten',
    brief: 'Natural Scaling pays nothing for this round. Every bonus your hands have earned over the run is still there and comes back the moment the round ends - it just does not count right now. You are playing on the printed rate card.',
    objective: { type: 'score' },
    modifiers: ['no_natural_scaling'],
    params: {}
  },
  {
    id: 'the_inspector',
    name: 'THE INSPECTOR',
    flavor: 'One hand, on the record, regularly',
    brief: 'A hand type is named up front, and it has to appear at least every 45 seconds. Miss a check and a fifth of your score goes. It is always something this mode actually deals, and playing it early in each window costs you nothing but the hand.',
    objective: { type: 'score' },
    modifiers: ['hand_inspection'],
    params: { everySecs: 45, penalty: 0.2 }
  },
  {
    id: 'the_ledger',
    name: 'THE LEDGER',
    flavor: 'The number keeps being revised',
    brief: 'The goal climbs by 15% of what it started at, every 30 seconds, for the whole round. It is a straight line rather than a spiral - it does not compound - so the arithmetic is knowable from the first minute: the longer you take, the further away it is.',
    objective: { type: 'score' },
    modifiers: ['goal_creep'],
    params: { rate: 0.15, everySecs: 30 }
  },
  {
    id: 'short_fuse',
    name: 'SHORT FUSE',
    flavor: 'Ninety seconds. Go.',
    brief: 'Half the usual window and half the usual goal. The arithmetic is even, so this is not about scoring more - it is about whether your loadout can get going at all in ninety seconds. Anything that builds slowly is worth less here than anything that starts hot.',
    objective: { type: 'score' },
    modifiers: ['short_window'],
    params: { seconds: 90, goalMult: 0.5 }
  },
  {
    id: 'the_sommelier',
    name: 'THE SOMMELIER',
    flavor: 'Only one of these is acceptable',
    brief: 'Three suits at a time score 60% of their pips, for a minute, then a different three. Exactly one suit is paying full at any moment and it is never the same one twice running - so the round is: find it, build on it, and be ready to move when it turns.',
    objective: { type: 'score' },
    modifiers: ['suit_markdown'],
    params: { mult: 0.6, holdSecs: 60, count: 3 }
  },
  {
    id: 'the_sieve',
    name: 'THE SIEVE',
    flavor: 'What you throw away is gone',
    brief: 'Discarded cards do not go back into the deck. You still have every discard you always had - they simply cost you the card as well as the time. A round of heavy discarding leaves you with a thinner deck to finish it on.',
    objective: { type: 'score' },
    modifiers: ['no_discard_return'],
    params: {}
  },
  {
    id: 'the_fog',
    name: 'THE FOG',
    flavor: 'You will have to look',
    brief: 'Card ranks are hidden until you select a card. Suits stay visible the whole time, so a flush can still be spotted at a glance and a run has to be uncovered one card at a time. Selecting is how you read the board.',
    objective: { type: 'score' },
    modifiers: ['hide_ranks'],
    params: {}
  },
  {
    id: 'the_gradient',
    name: 'THE GRADIENT',
    flavor: 'Where you play is worth something',
    brief: 'The board is a slope. One edge pays half, the opposite edge pays half again on top, and everything between is in between. It turns a quarter turn every 40 seconds. Cards on the paying end are visibly bigger and cards on the poor end visibly smaller, so you can read it without counting cells.',
    objective: { type: 'score' },
    modifiers: ['score_gradient'],
    params: { lo: 0.5, hi: 1.5, everySecs: 40 }
  },
  {
    id: 'the_swell',
    name: 'THE SWELL',
    flavor: 'It fills fast and it empties faster',
    brief: 'Focus decays three times as quickly and the ceiling is half of what it was. Everything you own that raises the ceiling still raises it - the halving lands on the total - so a Focus build is not dead here, it is just working for a much shorter breath.',
    objective: { type: 'score' },
    modifiers: ['focus_squeeze'],
    params: { decayMult: 3 }
  },
  {
    id: 'the_bookkeeper',
    name: 'THE BOOKKEEPER',
    flavor: 'One column for both',
    brief: 'Swaps and discards come out of one shared pool of four for the whole round, and it does not refill. Anything you own that hands a swap or a discard back still works - what it hands back goes into the same pool. Every touch of the board is now the same decision.',
    objective: { type: 'score' },
    modifiers: ['shared_pool'],
    params: { pool: 4 }
  },
  {
    id: 'the_rerun',
    name: 'THE RERUN',
    flavor: 'Half of it does not take',
    brief: 'Replays, pauses and rewinds each have a 50% chance of simply not happening. None of it is switched off - a loadout built on any of the three still works, it just works about half as often. A miss says so on screen, so you always know which way the coin fell.',
    objective: { type: 'score' },
    modifiers: ['effect_miss'],
    params: { chance: 0.5 }
  },
  {
    id: 'the_magpie',
    name: 'THE MAGPIE',
    flavor: 'It takes the shiny ones',
    brief: 'Every 20 seconds the two highest cards on the board are taken. The board refills straight away, so you never lose the cell - you lose the card you were building around, on a clock you can see coming.',
    objective: { type: 'score' },
    modifiers: ['steal_high'],
    params: { everySecs: 20, count: 2 }
  },
  {
    id: 'stale_deck',
    name: 'THE STALE DECK',
    flavor: 'Bottom of the box first',
    brief: 'The deck is reordered least-played first, so the round opens on whatever this run has never found a use for. Nothing is added and nothing is taken away - your good cards are still in there, they are just all at the back.',
    objective: { type: 'score' },
    modifiers: ['stale_order'],
    params: {}
  }
];

let currentBoss = null;         // active boss preset (clone)
let bossObjectiveProgress = 0;  // score or hand-count progress
let bossPhase = 1;              // 1 or 2 for split-phase bosses (Voidwright)
let bossSwapsDelta = 0;         // applied to swaps for boss; restored on end
let trickPoolA = new Set();        // for Voidwright phase 1 disabled Tricks (by id)
let trickPoolB = new Set();        // for Voidwright phase 2 disabled Tricks
let bossLowCardActive = false;  // for Famine
let bossLockedHand = null;      // for hand-type lock modifier (not in roster v1 but framework-ready)
let bossNullInterval = null;    // for The Hollow periodic null modifier

// ── Cell helpers ──
