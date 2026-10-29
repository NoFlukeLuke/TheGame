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
    brief: 'Stones land on the board when the round starts, and about a fifth of your deck turns to stone for the round. A stone cannot be selected, played, swapped or discarded.',
    modifiers: ['inject_stones'],
    // r216: stoneInjectCount is dead. The board dose is derived from the grid and
    // the deck dose from the real deck size (see inject_stones in js/boss.js).
    params: { deckStoneFraction: 0.18 }
  },
  {
    id: 'voidwright',
    name: 'THE VOIDWRIGHT',
    flavor: 'Two of your Tricks at a time',
    brief: 'Two of your Tricks are off for the first half of the round, and two others for the second half.',
    objective: { type: 'score' },
    modifiers: ['trick_pool_split'],
    params: { perPhase: 2 }
  },
  {
    id: 'hand_of_famine',
    name: 'THE HAND OF FAMINE',
    flavor: 'A withered deck offers little',
    brief: 'Your draw pile is reordered with the low cards near the top.',
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
    brief: 'The grid\'s corners are removed, and your swaps and discards are halved, rounded up.',
    modifiers: ['void_corners', 'ration_half'],
    params: {}
  },
  {
    id: 'the_hollow',
    name: 'THE HOLLOW',
    flavor: 'Cards crumble into nothing',
    brief: 'Every 7 seconds one card on the board is shuffled back into your deck and replaced.',
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
    name: 'TIME DILATION',   // r561 (owner): was THE METRONOME, which clashed with the Metronome knack
    flavor: 'It keeps your time now',
    brief: 'The clock runs at your Focus multiplier.',
    objective: { type: 'score' },
    modifiers: ['time_scales_with_focus'],
    params: {}
  },
  {
    id: 'the_tollman',
    name: 'THE TOLLMAN',
    flavor: 'Every touch is billed',
    brief: 'Swaps and discards cost double. Playing a hand costs 5 seconds.',
    objective: { type: 'score' },
    modifiers: ['interact_surcharge'],
    params: { costMult: 2, playCostAdd: 5 }
  },
  {
    id: 'the_undertow',
    name: 'THE UNDERTOW',
    flavor: 'Concentration will not hold',
    brief: 'Every 15 seconds, 10 Focus is taken off the meter.',
    objective: { type: 'score' },
    modifiers: ['focus_drain'],
    params: { everySecs: 15, amount: 10 }
  },
  {
    id: 'the_quarantine',
    name: 'THE QUARANTINE',
    flavor: 'The board is being condemned, cell by cell',
    brief: 'Every 15 seconds a cell is marked. Ten seconds later it goes dark for the rest of the round: cards still fall into it, but nothing there can be selected, played, swapped or discarded.',
    objective: { type: 'score' },
    modifiers: ['cell_quarantine'],
    params: { everySecs: 15 }
  },
  {
    id: 'the_hold',
    name: 'THE HOLD',
    flavor: 'That one stays where it is',
    brief: 'Every 13 seconds two cards are held for 15 seconds. A held card cannot be selected, played, swapped or discarded.',
    objective: { type: 'score' },
    modifiers: ['card_hold'],
    params: { everySecs: 13, holdSecs: 15, count: 2 }
  },
  {
    id: 'the_censor',
    name: 'THE CENSOR',
    flavor: 'Your paperwork is under review',
    brief: 'Every 35 seconds one of your Tricks is suspended for 45 seconds.',
    objective: { type: 'score' },
    modifiers: ['trick_blackout'],
    params: { everySecs: 35, holdSecs: 45 }
  },
  {
    id: 'the_blight',
    name: 'THE BLIGHT',
    flavor: 'It spreads through the board',
    brief: 'Every 20 seconds three more cells are contaminated for the rest of the round. A card scored from one pays half its pips and may fail to trigger a Trick.',
    objective: { type: 'score' },
    modifiers: ['cell_blight'],
    params: { everySecs: 20, count: 3 }
  },
  {
    id: 'the_recall',
    name: 'THE RECALL',
    flavor: 'That rank has been withdrawn',
    brief: 'Three ranks are withdrawn: those cards cannot be played, swapped or discarded. Every 45 seconds three different ranks are withdrawn instead.',
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
    brief: 'Every 30 seconds you lose one swap or one discard for the round.',
    objective: { type: 'score' },
    modifiers: ['ration_cut'],
    params: { everySecs: 30 }
  },
  {
    id: 'the_ratchet',
    name: 'THE RATCHET',
    flavor: 'The bar only moves one way',
    brief: 'Every swap and every discard raises the goal by 5%.',
    objective: { type: 'score' },
    modifiers: ['goal_ratchet'],
    params: { rate: 0.05 }
  },
  {
    id: 'the_turnstile',
    name: 'THE TURNSTILE',
    flavor: 'Access is metered',
    brief: 'Every swap and every discard costs 5 credits.',
    objective: { type: 'score' },
    modifiers: ['interact_fee'],
    params: { fee: 5 }
  },
  {
    id: 'the_marker',
    name: 'THE MARKER',
    flavor: 'Some of these are no good',
    brief: 'One card in ten is secretly marked. A hand with a marked card does not score, and its marked cards are discarded.',
    objective: { type: 'score' },
    modifiers: ['discard_curse'],
    params: { everyNthCard: 10 }
  },
  {
    id: 'the_redaction',
    name: 'THE REDACTION',
    flavor: 'That hand is no longer recognised',
    brief: 'One family of hands (sets, runs or flushes) scores a quarter of its value. Every 90 seconds a different family is marked down.',
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
    brief: 'Three deadlines: a fifth of the goal by the first third of the round, two fifths by the second, three fifths by the third. Miss one and your score returns to zero.',
    objective: { type: 'score' },
    modifiers: ['score_quota'],
    params: { shares: [0.2, 0.4, 0.6] }
  },
  {
    id: 'the_tax_man',
    name: 'THE TAX MAN',
    flavor: 'One credit a card, payable on play',
    brief: 'Every hand costs 1 credit per card. Run out of credits and the round ends.',
    objective: { type: 'score' },
    modifiers: ['play_fee_credits'],
    params: { perCard: 1 }
  },
  {
    id: 'the_grind',
    name: 'THE GRIND',
    flavor: 'It worked the first time',
    brief: 'A hand type pays 15% less each time you repeat it, until you play five other hands.',
    objective: { type: 'score' },
    modifiers: ['repeat_decay'],
    params: { rate: 0.15, window: 5 }
  },
  {
    id: 'the_drought',
    name: 'THE DROUGHT',
    flavor: 'Everything you learned, forgotten',
    brief: 'Natural Scaling pays nothing this round.',
    objective: { type: 'score' },
    modifiers: ['no_natural_scaling'],
    params: {}
  },
  {
    id: 'the_inspector',
    name: 'THE INSPECTOR',
    flavor: 'One hand, on the record, regularly',
    brief: 'One hand type is named. Play it at least every 45 seconds or lose a fifth of your score.',
    objective: { type: 'score' },
    modifiers: ['hand_inspection'],
    params: { everySecs: 45, penalty: 0.2 }
  },
  {
    id: 'the_ledger',
    name: 'THE LEDGER',
    flavor: 'The number keeps being revised',
    brief: 'Every 30 seconds the goal rises by 15% of its starting value.',
    objective: { type: 'score' },
    modifiers: ['goal_creep'],
    params: { rate: 0.15, everySecs: 30 }
  },
  {
    id: 'short_fuse',
    name: 'SHORT FUSE',
    flavor: 'Ninety seconds. Go.',
    brief: 'A 90-second round with half the usual goal.',
    objective: { type: 'score' },
    modifiers: ['short_window'],
    params: { seconds: 90, goalMult: 0.5 }
  },
  {
    id: 'the_sommelier',
    name: 'THE SOMMELIER',
    flavor: 'Only one of these is acceptable',
    brief: 'Three suits at a time score 60% of their pips. Every 60 seconds a different three are marked down.',
    objective: { type: 'score' },
    modifiers: ['suit_markdown'],
    params: { mult: 0.6, holdSecs: 60, count: 3 }
  },
  {
    id: 'the_sieve',
    name: 'THE SIEVE',
    flavor: 'What you throw away is gone',
    brief: 'Discarded cards do not return to your deck.',
    objective: { type: 'score' },
    modifiers: ['no_discard_return'],
    params: {}
  },
  {
    id: 'the_fog',
    name: 'THE FOG',
    flavor: 'You will have to look',
    brief: 'Card ranks are hidden until the card is selected.',
    objective: { type: 'score' },
    modifiers: ['hide_ranks'],
    params: {}
  },
  {
    id: 'the_gradient',
    name: 'THE GRADIENT',
    flavor: 'Where you play is worth something',
    brief: 'Cards score from half pips at one edge of the board to 1.5x at the opposite edge. The paying edge turns a quarter every 40 seconds.',
    objective: { type: 'score' },
    modifiers: ['score_gradient'],
    params: { lo: 0.5, hi: 1.5, everySecs: 40 }
  },
  {
    id: 'the_swell',
    name: 'THE SWELL',
    flavor: 'It fills fast and it empties faster',
    brief: 'Focus decays three times as fast, and the Focus ceiling is halved.',
    objective: { type: 'score' },
    modifiers: ['focus_squeeze'],
    params: { decayMult: 3 }
  },
  {
    id: 'the_bookkeeper',
    name: 'THE BOOKKEEPER',
    flavor: 'One column for both',
    brief: 'Swaps and discards share one pool of four for the round, with no refill. Anything that grants a swap or a discard adds to it.',
    objective: { type: 'score' },
    modifiers: ['shared_pool'],
    params: { pool: 4 }
  },
  {
    id: 'the_rerun',
    name: 'THE RERUN',
    flavor: 'Half of it does not take',
    brief: 'Replays, pauses and rewinds each have a 50% chance of not happening.',
    objective: { type: 'score' },
    modifiers: ['effect_miss'],
    params: { chance: 0.5 }
  },
  {
    id: 'the_magpie',
    name: 'THE MAGPIE',
    flavor: 'It takes the shiny ones',
    brief: 'Every 20 seconds the two highest cards on the board are taken and replaced.',
    objective: { type: 'score' },
    modifiers: ['steal_high'],
    params: { everySecs: 20, count: 2 }
  },
  {
    id: 'stale_deck',
    name: 'THE STALE DECK',
    flavor: 'Bottom of the box first',
    brief: 'Your deck is reordered least-played first.',
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
