const BAL = {
  rich_soil: { mult: 3 },
  court_of_leaves: { pips: 3 },
  low_tide: { pips: 6 },
  first_light: { worth: 42 },
  power_two: { pips: 4 },
  ten_strong: { pips: 7 },
  king_guard: { pips: 8, mult: 8 },
  dark_matter: { pips: 5 },
  face_value: { face_pips: 20 },
  humble_roots: { pip_mult: 3 },
  summit: { pips_per_level: 2 },
  before_the_tide: { max_rank: 5 },   // r625: ranks at or under this pay their rank in Focus (improvements raise it)
  knave_power: { per_jack: 1.5 },   // r539 owner: x2 per Jack was x16 with four
  rowcol_triple_pips: { flat_pips: 25 },
  rowcol_mult: { mult: 15 },              // r623: was 5, typed in scoring.js
  // r646 line Tricks (owner). The 5th improvement marks a SECOND line at the base value: line2 / chance2 hold it (0 = none yet).
  line_xpips:  { pip_mult: 1.2, line2: 0 },
  line_xmult:  { mult_mult: 1.2, line2: 0 },
  obligatory:  { chance: 0.25, chance2: 0 },
  suggestive:  { chance: 0.35, chance2: 0 },
  coin_sword:  { credit_chance: 0.1, mult_chance: 0.2, credit_pct: 0.25, line2: 0 },
  // r646 INSEPARABLE: Lie Down + Stand-Up. span 1 = one row or one column; 2 (the 5th improvement) = no more than 2 of either.
  lie_up:      { mult: 24, span: 1 },
  // r651 (owner): the 21 fused Tricks. An `acts` row holds BOTH parts' keys (their code reads it through TB()).
  well_adjusted: { pips: 20, mult: 20 },
  right_place_time: { flat_pips: 25, pause_seconds: 2 },
  short_circuit: { mult: 15, pip_mult: 1.2, line2: 0 },
  advanced_interrogation: { mult_mult: 1.2, line2: 0, chance: 0.25, chance2: 0 },
  love_of_money: { per_credits: 100, pip_mult_per_10_credits: 0.1, max_pip_mult: 3 },
  penny_perfect: { every: 9, pips: 5, mult: 3 },   // retired r708, kept for saved runs
  to_the_clouds: { mult_per_nine: 2, added: 9, no_delete: 0, mult_per_milestone: 3 },   // r708: Cloud Nine + To The Nines
  cornery: { mult_mult: 2 },                                                       // r708: Ornery + Cornered
  hurricane: { pips_per_card: 20, mult_per_card: 10 },
  riptide: { mult_base: 1.25, mult_step: 0.5, pip_mult_base: 2, pip_mult_step: 0.5 },
  encore_bang: { pip_mult: 1.25, mult_mult: 1.5 },
  lidar: { chance: 2/3, chance2: 0, extra_line: 0 },
  erosion: { interval_seconds: 10, mult_per_interval: 6, pips_per_interval: 10 },
  seabird: { pips_per_second: 10, interval_seconds: 2, mult_per_interval: 8 },
  flood: { pause: 3, pause_per_set: 1 },
  relativity: { divisor: 2, chance: 0.5, interval_seconds: 60 },
  men_of_means: { pips: 30, mult: 20 },
  omega_prime: { pips_per_card: 29 },
  stranger_still: { mult_per_card: 7, mult_mult: 1.7, replay: 0 },
  can_even: { pips_per_card: 16, chance: 0.66, pip_mult: 2.25, replay: 0 },
  inferno: { mult_per_streak: 8, focus: 5 },
  serenity: { mult: 50, focus: 25 },
  working_class: { base: 1, mult_per: 4 },
  separation_anxiety: { chance: 0.1 },
  tunnel_vision: { focus: 10 },           // r623: was 5, typed in level-up.js
  rhythm: { focus: 2 },                   // r623: was 1, typed in play-hand.js
  right_time:     { pause_seconds: 2 },
  study_hall:     { focus: 2, every: 2 },
  high_water:     { pause_per_set: 1 },
  rowcol_perm_double: { perm_mult: 2 },
  wide_span_mult: { mult: 50 },
  hidden_pair: { pips: 12 },
  twin_sprouts: { pips: 15 },
  enriched: { pips: 100 },
  overgrowth: { pips_per_card: 20 },
  triple_threat: { pips: 20 },
  early_bird: { pips_per_card: 20 },
  kindling: { mult_per_streak: 8 },
  spade_flood: { time_div: 1, time_mult: 1, suits: 0 },   // r625: suits 0 all spades / 1 all clubs or spades / 2 any club or spade; time_mult by IMPROVE_PLAN
  sands_of_time: { divisor: 2 },
  discard_pips: { mult_per: 4, mult_per_flow: 2 },   // r651 (owner): Flow pays the smaller one
  landfill: { mult_per: 1 },   // r651 (owner): per swapped or discarded card THIS GAME (landfillCount)
  magician: { mult_per_sleight: 6, solo_pips: 50 },   // r635: solo_pips while you own no Sleight
  stand_up: { mult_per_card: 12 },   // r646 (owner): 10 -> 12
  scalper: { mult_mult_per_missing: 0.25 },
  down_and_back_in: { coins: 5, grant: 2 },   // r635: grant swaps or discards, alternating
  short_change: { coins: 1 },
  scavenger: { coins: 10 },
  edge_pips: { pips_per_card: 15 },
  high_pair: { focus_per_card: 4 },   // r624: any hand with a pair in it and a 2 or 4
  pair_pips: { pip_mult: 2 },
  heavy_hand: { pips_per_card: 20 },
  quick_draw: { window_ms: 3000, cap_gain: 1, cap: 10, focus_cut: 0.25, sell_bonus: 6 },   // r708 owner: costs 25% of your Focus; sells for more at max
  expanse: { cap_gain: 1, cap: 10, keep_fraction: 0.5, sell_bonus: 6 },
  flow_state: { pips_per_card: 15 },
  hyper_focus: { focus_mult: 2 },
  club_double: { base: 1 },
  night_owl: { mult_per_card: 10 },
  wildfire: { focus: 5 },
  frozen_moment: { focus: 10 },
  swift: { mult_per_interval: 6, interval_seconds: 10 },   // r624: improvements alternate +2 mult / -2s (IMPROVE_PLAN)
  cuckoo: { hands_between: 2, per_replays: 5 },
  clean_sweep: { focus: 8, credits: 4 },
  obsessed:        { per_credits: 100 },
  relentless:      { mult_per_spade: 0.05 },
  buried_treasure: { luck_share: 0.5, credit_mult: 1.1 },
  patient_rulers:  { mult_mult: 1.5, extra_ranks: 0 },           // r625: the 5th improvement adds 3 random ranks (rolled on the Trick)
  even_better:     { chance: 0.66, pip_mult: 2.25, replay: 0 },   // r625: replay 1 = even cards replay (5th improvement)
  what_odds:       { mult_mult: 1.7, replay: 0 },
  critical:        { mult_mult: 5, extra_family: 0 },             // r625: 5th improvement extends to sets or runs (rolled on the Trick)
  twinners:        { pip_mult: 3, replay: 0 },
  feelin_lucky:    { mult_mult: 1.25, ranks: 5, sell_cost_share: 0.3, rerolls: 3 },
  double_jeopardy: { pause_seconds: 15, cells: 2, prime_random: 0 },   // r625: prime_random from the 3rd improvement (IMPROVE_PLAN)
  aces_absorb: { chance: 0.5 },
  queens_upgrade: { queen_seconds: 30 },
  woodpecker: { interval_seconds: 30, retrigger_count: 2, chance_extra: 0 },   // r624: the mark is never spent; r646 (owner): 2 replays (3 plays), improvements add replays and a Luck-free chance of one more
  hummingbird: { mult_per_pause: 3 },
  albatross: { pips_per_second: 10 },
  vulture: { pause_seconds: 3 },
  phoenix: {},
  metronome: { seconds: 5 },
  syncopation: { seconds: 12 },
  sundial: { seconds: 8 },
  long_pause: { multiplier: 1.5 },
  snooze: { seconds: 10 },
  kindred: { mult_per_card: 15 },
  tidal_force: { mult_per_card: 15 },
  rare_bloom: { perm_pips: 8 },
  two_pair_mult: { focus: 20, window_ms: 30000, need_count: 3 },
  threes_run: { mult: 9 },
  lucky_three: { mult: 2 },
  light_touch: { mult: 30 },
  patience_reward: { mult_per_second: 2 },   // r624: mult = this x the seconds since the last hand
  first_play: { focus: 5 },
  monochrome: { coins: 5, seconds: 10, mult: 25 },   // r625: pays mult too; IMPROVE_PLAN cycles the three
  full_color: { mult_mult: 1.25 },   // r539 owner: x mult per card (was +16 pips +16 mult per card)
  balanced_diet: { mult_per_card: 10 },
  number_crunch: { mult_per_card: 8 },
  cull: { focus_per_stock: 2, per: 2 },
  even_score: { pips_per_card: 16 },
  odd_squad: { mult_per_card: 7 },
  long_road: { mult_per_card: 10 },
  still_water: { mult_per_interval: 10, interval_seconds: 5 },
  wild_heart: { primes: 1, extra_ranks: 0 },   // r625: primes per Ace; extra ranks are rolled on the Trick when improved
  same_kind: { mult_per_match: 2 },
  column_rush: { mult_per_card: 5 },
  row_power: { mult_per_card: 12 },
  groove:        { focus_per_2: 1 },
  assembly_line: { mult_per_prior: 2, mult_per_flow: 1, lines: 1 },   // r646 (owner): per card played from the line LAST round (last quarter in Flow); lines 2 = the 5th improvement's second line
  overtime:      { seconds_per_3: 1 },
  shift_change:  { consolation_credits: 15 },   // Shift Change event, when you hold under 2 Tricks
  feng_shui:     { pips_per_hand: 3 },
  five_stack:    { pips: 20, mult: 5, focus_per_card: 1 },
  little_guys:   { cap_gain: 1, cap: 15 },
  five_fodder:   { credits_per_card: 1 },   // r623: any valid hand discarded pays its size in credits
  five_second:   { pause_seconds: 5 },
  life_lessons:  { cap_gain: 1 },
  wellspring:    { per_focus: 30, mult_per: 1 },   // r539 owner: per 30 Focus (was 10)
  third_down:    { focus: 3 },
  ready_set_go:  { mult: 18 },
  third_charm:   { extra_replays: 2 },
  four_eyes:     { mult: 24 },
  four_by_four:  { pips: 24, chance: 0.44, queens: 0 },   // r635: a Knack; pips is the retired Trick's (saved runs only)
  four_horseman: { pips: 24, mult: 24, focus: 8, pause: 8, picks: 1 },   // r625: picks 2 at the 5th improvement
  wait_four_it:  { pause: 2 },
  shaky_foundation: { mult: 18 },
  wave_amp:      { pips_per_streak: 15 },
  dam_holding:   { pause: 3 },
  acorns:        { focus_per_card: 0.025 },
  plan_ahead:    { every: 3, times: 2 },   // r624: Focus = times x the average hands per round
  more_better:   { mult: 12, min_tiles: 3 },
  rain_check:    { seconds: 30 },
  temporal_rift: { chance_extra: 0 },   // r625: force-triggers the 3rd Trick per intersecting card; chance_extra = one more per tier

  // Shop multi-buy discount (js/shop-grid-preview.js): % off per ADDITIONAL item
  // in the connected group. Bulk Buyer raises the rate to bulk_per_item. No cap of
  // its own - Selection Size already caps the group.
  shop_discount: { per_item: 3, bulk_per_item: 5 },
  reward_skip:   { gold: 20 },   // gold paid for skipping the whole reward grid (shown on the SKIP button)
  wild_side:     { mult_per: 6 },       // +mult per negative reward tile taken this run
  rising_tide:   { mult_min: 5, mult_max: 10 }, // each level passed while held adds this much mult (r624: 5-10)
  middle_man:    { mult_per: 3, anywhere: 0 },  // r649: mult per credit change in a round; anywhere = between rounds too (the 5th improvement)
  wait_for_it:   { chance_per: 0.03, flow_per: 0.05 },  // +replay chance per negative reward tile taken; in Flow per single-reward level-up, luck-free (r625, a knack)
  greedy_boi:    { selection: 2 },      // +reward-grid selection size (knack)
  combo_score: { mult_per_type: 6 },
  full_house_streak: { focus: 15 },
  blackjack_bonus: { pip_mult: 3 },
  double_bloom: { mult_mult: 1.5 },
  richter: { mult_mult: 3, focus: 10 },
  ripple: { chance: 0.66, chance2: 0 },   // r624: chance2 is a second replay rolled after a first success (improvements, IMPROVE_PLAN)
  river_run: { focus_per_card: 1 },
  deluge: { seconds: 15 },
  perfect_storm: { pip_mult: 5 },
  extinction: { mult_mult: 2 },
  lucky_sevens: { focus: 5 },
  ninesong: { seconds: 9, mult: 27, focus: 9, all_chance: 0.2 },   // r625: all_chance = all three at once (silent; 0.35 at the 5th improvement)
  royal_trio: { mult_mult: 2 },
  prime_time: { pips_per_card: 29 },
  shape_square: { focus: 16, mult: 24 },
  shape_line: { buffs: 0, span6: 0 },         // r625: buffs = count buffed pips; span6 = 6 rows + columns in all count as a line
  perfect_timing: { chance2: 0, extra_line: 0 },   // r625: a second replay chance; a second marked line at the 5th
  kaleidoscope: { extra: 0 },                 // r625: applications past the suit count
  marathon: { extra: 1, flush: 0, sets: 0 },  // r625: extra applications on runs; flush / sets extend them
  undue_influence: { faces: 0 },              // r625: 1 = also pays the face cards in the hand
  shape_cross: { focus: 25, mult: 25 },   // r624: the + shape pays mult as well
  two_corners: { mult_mult: 2 },
  correct_run: { pips: 80, mult: 20, focus: 10 },
  tide_table: { mult_base: 1.25, mult_step: 0.5 },
  undertow: { pip_mult_base: 2, pip_mult_step: 0.5 },
  // ── r179 multiplier batch: ×pips / ×mult on triggers the pools had never used ──
  // (replays, a paused clock, credits held, buffed cards on the grid, Focus level)
  rerun:       { pip_mult: 1.25 },
  deep_breath: { pip_mult: 2 },
  interest:    { pip_mult_per_10_credits: 0.1, max_pip_mult: 3 },
  chorus:      { mult_mult: 1.5 },   // r637: on each replay's beat
  portfolio:   { mult_mult_per_card: 0.25 },
  // Compound (legendary): every interval_seconds of round time the current round score
  // is banked; the next scored hand pays bank_fraction of it again. Repeats, so the
  // score compounds across a round rather than doubling once.
  // ── Upgrade events (r194) ──
  rehearsal: { consolation_credits: 12, encore_curses: 2, echo_curses: 4, chain_curses: 2, chain_cursed: 2 },   // r590: paid in curse cards
  forge: { pips: 8, mult: 5, both_price: 10, both_chance: 0.5 },   // r590 (owner): +8 pips / +5 mult a score
  reschedule: { price: 8, step: 1, rolls: 10, skip_pay: 10 },   // r590: 16, +2 a reroll, up to 10; skipping pays 20 (all through priceOf)
  luck_dice: { skip_cost: 10 },                                  // r590: skipping costs 20 through priceOf
  state_change: { common: 4, rare: 6, epic: 8, legendary: 12 },   // r580: by the state's tier, through priceOf
  licensing:    { common: 6, rare: 10, epic: 16, legendary: 24 },   // r706: a Trick license, by its tier, through priceOf (js/events-meta.js)
  editor: { price: 6 },                                            // r698: the Editor, through priceOf (12 on screen)
  rewire: { junk: 2 },                                             // r580: junk cards into the deck   // r579: through priceOf (16 on screen)
  flip_events: { reflip: 10, keep_cap: 15, ladder_focus: 5 },   // r578: reflip and keep_cap through priceOf (20 / 30 on screen)   // r576: scaling only; both_price runs through priceOf
  workshop:  { cap_bonus: 2, cap_pct: 0.2, consolation_credits: 12 },   // r576: +20% of the ceiling, never under cap_bonus
  // ── Card Market (r211) - buy cards INTO the deck, each carrying one effect ──
  // Three on offer, priced by how strong the effect is. The card itself is a copy
  // of one already in the deck, so the market can never hand out a rank or suit
  // the mode does not use (Spectrum has no courts, Six Suits has two extra suits).
  market: { card_price: 2.5, one_buff: 0.50, two_buffs: 0.05 },   // r576: shows as 5 at PRICE_MULT 2 (owner: "lets go with 5"); 45% plain
  // ── Deck Trim (r211) - the frequent-removal event ──
  // Three cuts of rising size and price. first_free makes the smallest cut cost
  // nothing, so the event always does something even at 0 credits.
  deck_trim: { step: 4, cap: 64, junk_each: 2,   // r590: card k costs 8k, capped at 128; junk 4 a card (all through priceOf)
               tiers: [ { cards: 1, price: 0 }, { cards: 2, price: 6 }, { cards: 4, price: 14 } ] },   // tiers: read only by the layouts lab's sample (js/event-grid-lab.js)
  // ── Guided (r219): what a slot costs to fill with something other than a round. ──
  guided: {
    price_shop: 12, price_reward: 10, price_event: 6,
  },
  clean_slate:  { consolation_credits: 14 },
  // ── r218 events ──
  reassignment: { consolation_credits: 12, price: 7.5 },   // r590: 15 credits through priceOf, or all you have
  the_draw:     { steps: 2, spin_ms: 3200, consolation_credits: 12 },
  the_floor:    { pull: 4 },   // r590: a pull after the free first one, through priceOf (8)
  the_payline:  { spin_cost: 5, spin_secs: 5, consolation_credits: 12 },   // r590: pulls alternate 10 credits (priceOf) and 5s
  // ── Focus RATE batch (r180) - scale how fast Focus accrues, not the ceiling ──
  // complexity_mult scales HAND_FOCUS; speed_mult scales the speed bonus;
  // window_mult dilates the speed clock (2 = twice as long for the same bonus).
  overclock:      { speed_mult: 2 },
  long_fuse:      { window_mult: 2 },
  shorthand:      { complexity_mult: 1.5 },
  governor:       { window_mult: 1.5 },
  // ── play/round-side: accumulators & permanent gains ──
  first_fruits: { pips: 5, hands: 1 },   // r624: the first `hands` hands of a round (IMPROVE_PLAN alternates pips / hands)
  heartwood: { pips: 5, mult: 5, cells: 1 },   // r625: cells 2 = a second secret cell (5th improvement)
  fours_perm: { pips: 8 },
  fives_discard: { pips_per_five: 5 },
  nines_mult: { mult_per_nine: 2, added: 9, no_delete: 0 },   // r539 owner's rework: brings its own 9s; r625: no_delete at the 5th improvement
  tens_mult: { mult_per_milestone: 3 },   // r708 owner: To The Nines, +3 mult per 9 discarded or played
  sixes_perm: { roll_min: 1, roll_max: 6, interval: 6 },
  compound_mult: { mult_per_hand: 0.1 },
  // ── clock-mark Tricks ──
  ticktock: { focus: 4 },
  quarter_chime: { pips: 60 },
  minute_hand: { mult_mult: 2, interval_seconds: 30 },
  understudy: { interval_seconds: 30 },
  hallmark:   { mult: 5, pips: 10, seconds: 3, force_scale: 1, force_cap_x: 8 },
  turnover:   { idle_seconds: 45 },
  challenge_dial: { pct: 25 },   // r556: how far the dial turns the challenge chance, either way
  reserve: { open: 10, more: 5, cards: 3, buff_chance: 0.75 },   // r569: the Focus bar's double-tap (js/reserve.js)
  // r571: the Focus knacks (js/focus-knacks.js)
  free_hand:    { focus: 10, seconds: 10 },
  charged_card: { focus: 10 },
  shuffle_up:   { focus: 10 },
  double_down:  { focus: 10, hands: 3 },
  overdrive:    { focus_per_hand: 5, mult_step: 0.5, cooldown: 45 },
  // Card states (r278, js/card-states.js). Not an entity, so improve.js never
  // touches these - they are the states' own numbers, in one place.
  card_states: { review_up: 0.2, review_down: 0.5, roll_call_penalty: 15, fuse_seconds: 60 },
  payout_pick: { pips: 12 },
  second_hand: { pips: 30, mult: 20 },
  hourglass: { chance: 0.5, interval_seconds: 60 },
  sediment: { interval_seconds: 10, pips_per_interval: 10 },
  kingfisher: { interval_seconds: 2, mult_per_interval: 2 },
  magpie: { actions_per_second: 2 },
  // ── sleights ──
  rewind: { /* seconds = hand size */ },
  last_call: { seconds: 15 },
  sandbag: { extra_per_member: 0.5 /* seconds = the set's rank, +50% per card past a pair */ },
  dazed: { cost_coins: 3, cost_seconds: 10 },
  pivot: { mult: 5 },
  idol: { interest_mult: 3 },
  the_legacy: { mult_x: 3 },
  the_naturalist: { pips: 3 },
  lightning_rod: { pips: 10 },
  the_catalyst: { mult: 5 },
  the_bomb: { pips: 3 },
  bellhop: { swaps: 2, discards: 2 },   // r646 (owner): improvements alternate +2 swaps / +2 discards
  cash_out: { coins: 10 },
  amplifier: { mult_per_level: 3 },   // r636: the next hand scores level x this
  // r675: the rule Sleights (js/rule-sleights.js)
  rule_ranks: { ranks: 2 },        // ranks named when it lands; each named card replays once
  rule_evens: { focus: 2 },        // Focus per even card scored, replay-weighted
  rule_faces: { seconds: 2 },      // rewind per face card scored, replay-weighted
  // r647 (owner): new Sleights. `charges` is the cap (sleightBaseCharges); `double_spend` the v6 chance a use spends 2.
  procrastinate: { charges: 5, discards: 0, double_spend: 0 },
  retake: { charges: 8, copies: 0, permanent: 0, double_spend: 0 },
  shredder: { charges: 3, deletes: 1, double_spend: 0 },
  photocopier: { copies: 4, permanent: 0, double_spend: 0 },
  logistics_assistant: { charges: 4, swaps: 0, max_swaps: 8 },
  touch_up: { cards: 3, max: 0, kinds: 1 },   // r677 knack: cards buffed at a level clear; max = buffed cards allowed on the grid; kinds 1 / 2 / 3
  trophy_case: { epic: 0, legend: 0, starts: 1 },   // r685 knack: completed challenge cards become Sleights; starts = the version they arrive at
  stacked: { chance: 0.25, seconds: 30 },          // r685 knack: each Sleight on the grid may prime its column's Trick every N seconds
  very_rewarding: { times: 2, bonus: 0, hard: 0, stage: 0 },   // r685 knack: challenge rewards paid N times, then a bonus reward
  deluxe_subscription: { chance: 0.15, chance2: 0 },   // knack: an offered Trick / Sleight comes improved; chance2 (5th improvement) rolls each further one
  yoked: { mult: 2 },   // knack: card buffs gained are x this (an x buff's bonus); js/yoked.js
  green_station: { chance: 0.3, chance2: 0 },   // r647 knack: a charge back per Sleight at round end; chance2 a second
  piggy_bank: { coins: 5 },
  // ── adjacency / position sleights (r120) ──
  whetstone:  { mult_per_event: 2, life_seconds: 90 },
  autopilot:  { delay_seconds: 30, focus_cost: 5, max_hands: 5 },
  entourage:  { mult_per_sleight: 10 },
  lighthouse: { mult: 20, falloff_per_column: 7 },
  // ── focus-payout entities (r123) ──
  // ── reward-grid penalties (r194) ──
  rider:        { seconds_per_proc: 2 },
  spot_check:   { mult: 0.5, plays_to_clear: 3 },
  interest_freeze: { rounds: 3 },
  reflect:      { extra_replays: 2, board_seconds: 60 },
  the_queen:    { pips: 10, mult: 10, pause_seconds: 5 },
  soul_mirror:  { /* replays = copies of the aimed rank in the whole deck */ },
  power_cell:   { focus_on_enter: 10, focus_cap: 10 },
  slow_burn:    { seconds_per: 45, cap: 15 },
  capacitor:    { focus_cost: 10, time_cost: 10, credits: 10 },
  siphon:       { focus_cost: 15, mult: 4 },
  release_valve:{ swaps: 1, discards: 1, focus_drop: 16 },   // r624: improvements cycle swap / discard / -4 drop (IMPROVE_PLAN)
  dividend:     { credits: 8, keep_fraction: 0.33 },
  trade_winds:  { cap_reduction: 10, payout_fraction: 0.5 },
  growth_spurt: { cap_reduction: 5 },
  // ── knacks ──
  tempo:    { limit: 2, interval_seconds: 15 },
  jury_rig: { chance: 0.5, charges: 1 },
  coin_toss: { chance: 0.5, charges: 1 },   // was hardcoded in js/level-up.js until r196
  rowcol_retrigger: { chance: 2/3, chance2: 0 },   // r624: chance2 like Ripple's (IMPROVE_PLAN)
  time_slip: { chance: 0.25 },
  replay_rewind: { chance: 0.25, seconds: 2 },
  deja_vu: { seconds: 15 },
  clockmaker: { goal_fraction: 0.30, seconds: 15 },
  time_bank: { seconds: 30 },
  inheritance: { coins: 5 },
  lucky_seven: { interval_hands: 7, swaps: 1 },
  steady_hand: { swap_seconds: 20 },
  hoarder: { discard_seconds_per_card: 6 },
  extra_swaps: { swaps: 2 },
  extra_discards: { discards: 2 },
  carry_swaps: { max: 8 },
  carry_discards: { max: 8 },
  carry_time: { max_seconds: 60 },
  // ── system: base resource time costs ──
  _resources: { unspent_credits: 2, unspent_cap: 10, interest_cap: 10, swap_seconds: 8, discard_seconds_per_card: 3 },   // play is free by default
};

// ── Description templates - keep tooltip text in sync with BAL numbers ──
// {param} tokens are filled from BAL[id] at load (applyBalDescriptions), so a
// value change via the balance sheet updates the in-game description too. Only
// entities whose wording maps unambiguously to their params are listed.
// ══════════════════════════════════════════════
// THE RARITY TABLE (r195) - one copy, read by every offer path
// ══════════════════════════════════════════════
// How likely each tier is when the game offers you an entity. It was written out
// FOUR times before this - js/shop.js for sleights, js/mart-shop.js for the Mart
// shelves and the wheel, and two in js/reward-grid.js - and the reward grid's
// trick/knack copy had drifted to its own numbers. One table now, so tuning the
// game's generosity is editing one line and so that a future Luck stat has a
// single place to reach.
//
// The prize grid has its own table, PRIZE_TIER_W, below.
//
// FOUR tiers, not five (r226). `mythic` was merged into `legendary` when the
// data pools were re-tiered, so the fifth slot matched NOTHING: every mythic
// roll - 1% of all draws - cascaded down into legendary anyway, and the tiles
// that hard-coded tier:'mythic' (the Limit Break) asked for a `rar-mythic`
// colour no stylesheet defines. Its weight is folded into legendary, so the
// effective spread is unchanged.
const ENTITY_TIERS   = ['common', 'rare', 'epic', 'legendary'];
// r706 (owner): legendaries are found 1% of the time or less (was 1.5). The meta
// unlock "Legendaries are easier to find" (metaFlag('legendary_find'), js/unlocks.js;
// parked with the meta shop, dev toggle only) puts back META_LEGENDARY_W.
const ENTITY_TIER_W  = [71, 22, 5.5, 0.9];
const META_LEGENDARY_W = 1.5;

// The post-boss PRIZE (boss) grid. It used to cut commons out of every pool and
// draw the remaining three tiers, which is a different thing from a table: the
// filters decided the floor and the weights only shared out what was left.
// It is a real four-tier table now (owner's numbers), so the prize grid's
// generosity is one line here rather than a filter in three pool builders, and
// what it says is what it draws. A common is a third of the tiles and the
// middle of the ladder is where a prize grid pays: RARE is more than half.
const PRIZE_TIER_W   = [30, 55, 12, 3];
// r716 (owner): which of YOUR OWN things an improvement lands on. It rolled on
// ENTITY_TIER_W, so the one common in a tray of rares took 71% of improvements.
// Read by pickImproveTarget and Flow's Improve screen.
const IMPROVE_TIER_W = [40, 30, 20, 10];

const DESC_TEMPLATES = {
  understudy: 'Every {interval_seconds} seconds one of your tricks is primed: it fires an extra time on your next hand.',
  hallmark:   'Once a round a card on the board is marked. Score it and it takes a random buff: +{mult} mult, +{pips} pips, an extra replay, rewind the clock {seconds}s, pause the clock for {seconds}s, or a trick primed or forced.',
  turnover:   'Any card you leave alone for {idle_seconds} seconds becomes Fodder until it leaves the board: swapping or discarding it costs no time and no stock.',
  challenge_dial: 'Challenge cards show up {pct}% more often. Double-tap this to make them {pct}% rarer instead, and back.',
  free_hand:    'Double-tap the Focus bar: spend {focus} Focus and swaps and discards cost no time and no stock for {seconds} seconds. Replaces the Reserve.',
  charged_card: 'Double-tap the Focus bar: spend {focus} Focus and the first card of your next hand takes a random buff. Replaces the Reserve.',
  shuffle_up:   'Double-tap the Focus bar: spend {focus} Focus and every card on the board changes place. Replaces the Reserve.',
  double_down:  'Double-tap the Focus bar: spend {focus} Focus and Focus applies twice for your next {hands} hands. Replaces the Reserve.',
  overdrive:    'Double-tap the Focus bar: the board plays its best hand for {focus_per_hand} Focus, again and again until Focus runs out. Hand 1 scores x1.5 mult, hand 2 x2, and so on. These hands make no Focus of their own. Then {cooldown} seconds to cool down. Replaces the Reserve.',
  autopilot: 'Costs {focus_cost} Focus when it lands on the board. {delay_seconds}s later it plays the best hand on the board, waits for the cards to fall, and repeats, up to {max_hands} hands or until no hand is left. Hand 2 applies Focus twice, hand 3 three times, and so on. Each hand it plays spends a charge. Then it discards itself.',
  whetstone: 'Whenever an adjacent card is swapped or discarded, Whetstone gains +{mult_per_event} mult permanently. Hands that score a card adjacent to Whetstone score that mult. Discards itself after {life_seconds}s on the board.',
  entourage: 'Hands score +{mult_per_sleight} mult for every other Sleight on the grid.',
  lighthouse: 'Each round Lighthouse picks either the first or last column. All hands score +{mult} mult when Lighthouse is in that column, −{falloff_per_column} per column away (minimum 0).',
  tempo: 'When acquired, sets your swap and discard limits to {limit}. Every {interval_seconds} seconds, gain 1 back - alternating swap, then discard.',
  capacitor: 'Double-tap: spend {focus_cost} Focus and {time_cost} seconds for {credits} credits. Becomes inert on use: it can no longer be swapped or discarded. (1 charge)',
  siphon: 'Double-tap to spend {focus_cost} Focus: your next scored hand gets ×{mult} mult. Discards on use.',
  release_valve: 'Each time you hit your Focus limit, gain +{swaps} swap[[swaps>1:s]] and +{discards} discard[[discards>1:s]] and lose {focus_drop} Focus.',
  dividend: 'Each time you hit your Focus limit, gain {credits} credits, then Focus resets to a third of the limit.',
  growth_spurt: 'Each time you hit your Focus limit, the limit drops by {cap_reduction}. If you hit it during a round, a random limit rises by 1 at the end of that round.',
  overclock: 'The Focus speed bonus is multiplied by {speed_mult}.',
  long_fuse: 'You have {window_mult}× as long to earn the same Focus speed bonus.',
  shorthand: 'Hands generate {complexity_mult}× their listed Focus.',
  governor: 'While on the grid, you have {window_mult_pctover}% longer to earn the Focus speed bonus.',
  overgrowth: 'Runs score +{pips_per_card} pips per card',
  long_road: 'Runs score +{mult_per_card} mult per card',
  river_run: 'Runs add +{focus_per_card} Focus per card',
  correct_run: 'Runs played in correct sequential order score one of the following: +{pips} pips, +{mult} mult, +{focus} Focus',
  perfect_storm: 'Straight Flush ×{pip_mult} pips',
  summit: 'The highest-ranking card in each hand scores +(level x {pips_per_level}) pips.',
  light_touch: '2-card hands score +{mult} mult',
  heavy_hand: '5-card hands score +{pips_per_card} pips per card',
  blackjack_bonus: 'If the face values of your cards total exactly 21, score ×{pip_mult} pips',
  face_value: 'Face cards (J/Q/K) score +{face_pips} pips',
  court_of_leaves: 'Face cards (J/Q/K) score +{pips} pips',
  ten_strong: 'Tens score +{pips} pips each',
  power_two: 'Cards ranked 2 score +{pips} pips each',
  lucky_three: 'Any 3 in a hand adds +{mult} mult',
  rich_soil: 'All cards score +{mult} mult',
  number_crunch: 'Hands with 4+ different ranks score +{mult_per_card} mult per card',
  shape_square: 'A 2×2 shaped hand scores +{mult} mult and adds +{focus} Focus',
  shape_cross: 'A 5 card + shaped hand adds +{focus} Focus and +{mult} mult',
  two_corners: 'Corner cards score ×{mult_mult} mult',
  edge_pips: 'Cards scored on an edge score +{pips_per_card} pips',
  column_rush: 'Hands with cards from only one column score +{mult_per_card} mult per card',
  row_power: 'Hands with cards from only one row score +{mult_per_card} mult per card',
  right_time: 'Cards scored in a marked row or column pause the clock for {pause_seconds}s',
  study_hall: 'Every {every} cards scored adds +{focus} Focus',
  cull: 'Discarding or swapping adds +{focus_per_stock} Focus per {per} remaining swaps and discards',
  rowcol_perm_double: 'Cards scored at the intersection of a row effect and a column effect permanently gain +{perm_mult} mult',
  groove:        'Scales +{focus_per_2} Focus for every 2 cards scored from a marked row or column. Resets each round.',
  assembly_line: 'Cards scored in a marked row or column score +{mult_per_prior} mult for every card played from that line last round (+{mult_per_flow} in Flow, counting the last quarter)[[lines>1:; a second line counts and pays too]]',
  // r646 line Tricks (owner). `line2` / `chance2` are the 5th improvement's second line, at the base value; 0 = no second line yet.
  line_xpips: 'Cards scored in a marked row or column score ×{pip_mult} pips[[line2:; a second line scores ×{line2} pips]]',
  line_xmult: 'Cards scored in a marked row or column score ×{mult_mult} mult[[line2:; a second line scores ×{line2} mult]]',
  obligatory: "Cards scored in a marked row or column have a {chance_pct}% chance to force-trigger the Trick in the tray slot of that line's number[[chance2:; a second line at {chance2_pct}%]]",
  suggestive: "Cards scored in a marked row or column have a {chance_pct}% chance to prime the Trick in the tray slot of that line's number[[chance2:; a second line at {chance2_pct}%]]",
  coin_sword: 'Cards scored in a marked row or column have a {credit_chance_pct}% chance to pay credits equal to the hand size and a {mult_chance_pct}% chance to score mult equal to {credit_pct_pct}% of your credits[[line2:; a second line at the base odds]]',
  lie_up: 'Hands with cards from [[span<2:only one row or only one column]][[span>1:no more than 2 rows or no more than 2 columns]] score +{mult} mult',
  overtime:      "Every hand rewinds the clock {seconds_per_3}s for every 3 cards you have scored from this Trick's marked row or column. Resets each round.",
  feng_shui: 'Permanently scores +{pips_per_hand} pips for each hand scored with a positional buff (row or column effects)',
  sands_of_time: 'Score +pips equal to time remaining ÷ {divisor}',
  discard_pips: '+{mult_per} mult per card discarded this round (+{mult_per_flow} in Flow)',
  dark_matter: 'Corrupted cards in a hand add +{pips} pips each',
  combo_score: '+{mult_per_type} mult for every distinct hand type played this round',
  flow_state: 'While focus is ×1.5 or higher, score +{pips_per_card} pips per card',
  hyper_focus: 'Each card scored adds mult equal to {focus_mult}x your Focus multiplier',
  low_tide: 'Cards below 6 score +{pips} pips',
  rowcol_triple_pips: 'Cards scored in a marked row or column score +{flat_pips} pips',
  first_fruits: 'Each card in the first [[hands>1:{hands} ]]hand[[hands>1:s]] each round permanently gains +{pips} pips',
  relentless: 'Each spade scores x{mult_per_spade} mult for every spade scored since you took this (replays count). No effect until it passes x1',
  compound_mult: 'Each hand played permanently adds +{mult_per_hand} mult to this trick',
  quick_draw: 'Hands played within 3 seconds of the previous hand remove {focus_cut_pct}% of your Focus and add +{cap_gain} to your Focus limit (max +{cap}). When max bonus is reached, +{sell_bonus} to sell value. If sold, keep half the bonus you\'ve reached',
  expanse: 'Each time you hit your Focus limit, increase it by {cap_gain} (max +{cap}), then lose half your Focus. When max bonus is reached, +{sell_bonus} to sell value. If sold, keep half the bonus you\'ve reached',
  tens_mult: 'Each 9 discarded or played permanently adds +{mult_per_milestone} mult to this trick',
  heartwood: 'When scored, the center-most card gains +{pips} pips & +{mult} mult',
  pivot: 'Cards touching Pivot swap for free. Swap two of its neighbours together and both gain +{mult} permanent mult, then Pivot leaves the board. (3 charges)',
  the_naturalist: 'Play this: each other scored card permanently gains +{pips} pips.',
  bellhop: 'Play this: gain +{swaps} swaps and +{discards} discards. (5 charges)',
  the_bomb: 'Discard this: every card on the grid permanently gains +{pips} pips. (2 charges)',
  cash_out: 'Discard this: gain {coins} credits. (3 charges)',
  lightning_rod: 'When swapped, the card it traded with permanently gains +{pips} pips.',
  the_catalyst: 'When swapped, the card it traded with permanently gains +{mult} mult.',
  time_bank: 'Every round starts with +{seconds}s.',
  inheritance: 'Start each round with +{coins} credits.',
  lucky_seven: 'Every {interval_hands}th hand played gives +{swaps} swap.',
  extra_swaps: `Start each round with +{swaps} extra swaps. After each boss you beat, ${KNACK_BOSS_GROW_PCT}% chance it gives 1 more.`,
  extra_discards: `Start each round with +{discards} extra discards. After each boss you beat, ${KNACK_BOSS_GROW_PCT}% chance it gives 1 more.`,
  carry_swaps: 'Unused swaps carry over to the next round (max {max}).',
  carry_discards: 'Unused discards carry over to the next round (max {max}).',
  carry_time: 'The next round starts with the seconds this round ends with (max {max_seconds}s).',
  fives_discard: 'Each 5 discarded or played permanently adds +{pips_per_five} pips to this trick',
  nines_mult: 'Adds {added} 9s to your deck. Each 9 scored adds +{mult_per_nine} mult to this trick. A 9 that scores or is discarded is destroyed[[no_delete<1:; when none are left, this trick deletes itself]]',
  fours_perm: '4-card hands permanently give the 4th card +{pips} pips',
  interest: 'Score ×1 pips, +{pip_mult_per_10_credits} for every 10 credits you hold, up to ×{max_pip_mult}',
  idol: 'Finish the round with this on your board to earn {interest_mult}× interest. (Once)',
  amplifier: 'Double-tap: the next hand scores mult equal to the current level x{mult_per_level}. (5 charges)',
  rule_ranks: 'When it lands, {ranks} random ranks are named on its face. While it is on the grid, cards of those ranks replay once. Inert: it cannot be swapped or discarded, only played. (4 charges)',
  rule_evens: 'While it is on the grid, even-ranked cards (2, 4, 6, 8, 10) score +{focus} Focus. Inert: it cannot be swapped or discarded, only played. (4 charges)',
  rule_faces: 'While it is on the grid, face cards (J, Q, K) rewind the clock {seconds}s when scored. Inert: it cannot be swapped or discarded, only played. (4 charges)',
  procrastinate: 'Discard this: the 8 cards around it go with it, costing no time. Counts as 2 discards for Tricks and Knacks.[[discards: Gives +{discards} discards.]] ({charges} charges)[[double_spend: Half the time a use spends 2 charges.]]',
  retake: 'Play this in a hand: it and the cards played with it go back into the deck instead of the played pile.[[copies>0:[[copies<2: Adds a temp copy of one of the cards played to the deck.]][[copies>1:[[permanent<1: Adds temp copies of {copies} of the cards played to the deck.]][[permanent: Adds copies of {copies} of the cards played to the deck.]]]]]] ({charges} charges)[[double_spend: Half the time a use spends 2 charges.]]',
  shredder: 'Discard this: deletes [[deletes<99:{deletes} of the cards]][[deletes>98:every card]] discarded with it, for good. ({charges} charges)[[double_spend: Half the time a use spends 2 charges.]]',
  photocopier: 'Double-tap: picks a card beside it at random and makes {copies} temp copies of it, buffs and all. They replace cards in its row, then the next row; any that do not fit go into the deck.[[permanent: {permanent} of them are permanent.]] Not on a wild unless you own Stand-In. (5 charges)[[double_spend: Half the time a use spends 2 charges.]]',
  logistics_assistant: 'Double-tap: finds swaps that make a playable hand and makes them one by one, left to right, for free. Then it discards itself.[[swaps: Gives +{swaps} swaps.]] ({charges} charges)',
  touch_up: '[[max<1:If there are no buffed cards]][[max:If no more than {max} buffed cards are]] on the grid when you complete a level, {cards} random cards on the grid take a buff: [[kinds<2:+pips or +mult]][[kinds>1:+pips, +mult, ×pips[[kinds<3: or ×mult]][[kinds>2:, ×mult, a second rank or a second suit]]]].[[max: Unbuffed cards first.]]',
  trophy_case: 'Completed challenge cards turn into a random Sleight ([[legend<1:[[epic<1:common or rare]][[epic:common, rare or epic]]]][[legend:any rarity]]) instead of paying their reward.[[starts>1: It arrives at v{starts}.0.]]',
  stacked: 'Every {seconds}s, each Sleight on the grid has a {chance_pct}% chance to prime the Trick in the tray slot of its column.',
  very_rewarding: 'Challenge cards pay their reward [[times<3:twice]][[times>2:{times} times]][[bonus:, plus a random [[hard<1:easy]][[hard:hard]] card’s stage [[stage<1:1]][[stage:2]] reward]].',
  deluxe_subscription: 'Tricks and Sleights you are offered have a {chance_pct}% chance to come improved[[chance2:, then a {chance2_pct}% chance of each further improvement]].',
  green_station: 'Sleights have a {chance_pct}% chance to get a charge back at the end of each round[[chance2:, then a {chance2_pct}% chance of one more]]. A Sleight at 0 charges is not destroyed: it sits out of the deck until it has a charge again.',
  the_legacy: 'Discard this: the next hand played gets ×{mult_x} mult. (3 charges)',
  power_cell: 'When it enters the grid: +{focus_on_enter} Focus. While it remains on the grid: +{focus_cap} to your Focus limit.',
  rowcol_retrigger: 'Cards scored in a marked row or column have a {chance_pct}% chance to replay[[chance2:, then a {chance2_pct}% chance to replay again]]',
  coin_toss: 'At the start of each round, every Sleight has a {chance_pct}% chance to restore {charges} charge.',
  short_change: 'Each hand you play with fewer cards than your hand size earns {coins} credit.',
  reflect: 'Tap to rotate its aim. The rank it faces replays {extra_replays}x when scored. Cannot be swapped, discarded or played. Discards itself after {board_seconds}s.',
  deluge: 'Flushes rewind the clock {seconds}s',
  // r550: time wording. A rewind reads "rewind(s) the clock Ns", a pause "pause(s) the clock
  // for Ns", a card's buff adds "when scored". Templated so an improvement shows its number.
  high_water: 'Sets pause the clock for {pause_per_set}s for each Set played this round',
  dam_holding: 'Runs pause the clock for {pause}s',
  five_second: '5-card hands pause the clock for {pause_seconds}s',
  four_horseman: '4-card hands grant [[picks>1:{picks} of these]][[picks<2:a random bonus]]: +{pips} pips, +{mult} mult, +{focus} Focus, [[picks<2:or ]]pause the clock for {pause}s',
  double_jeopardy: '{cells} cells are secretly marked at round start; the first time you score from those cells, pause the clock for {pause_seconds}s[[prime_random: and prime a random Trick]]',
  rain_check: 'Skipping a reward: the next round starts with +{seconds}s (in Flow, rewind the clock {seconds}s)',
  temporal_rift: 'A card scored where a row and column effect intersect force triggers the Trick in position 3[[chance_extra:, with a {chance_extra_pct}% chance of a second trigger]]',
  vulture: 'Cards discarded during the round’s first pause permanently gain a {pause_seconds}s pause (cannot stack from a single source)',
  wait_four_it: '4-card hands permanently buff their 4th card: it pauses the clock for {pause}s when scored (time buffs do not stack)',
  sundial: 'Hands where every card shares a column pause the clock for {seconds}s.',
  metronome: 'Each round a hand type you can make is chosen; playing that hand type pauses the clock for {seconds}s.',
  replay_rewind: 'Any time a card replays, {chance_pct}% chance to rewind the clock {seconds}s.',
  syncopation: 'Play this in a hand of a different type than your previous hand: pause the clock for {seconds}s. (3 charges)',
  last_call: 'Discard this: rewind the clock {seconds}s. (3 charges)',
  snooze: 'Double-tap: pause the clock for {seconds}s, then Snooze returns to your deck. (5 charges)',
  monochrome: 'Hands containing exclusively hearts AND diamonds score +{mult} mult, grant +{coins} credits, and cost {seconds} seconds',
  ninesong: "If the hand's pip total is divisible by 3, one of the following happens: rewind the clock {seconds}s, +{mult} mult, +{focus} Focus, or all three",
  deja_vu: 'Playing the same ranks in two hands in a row rewinds the clock {seconds}s.',
  clockmaker: 'Any time a single hand scores at least 30% of the round goal, rewind the clock {seconds}s.',
  piggy_bank: 'Double-tap: gain {coins} credits, once per round. Becomes inert on use: it can no longer be swapped or discarded. (5 charges)',
  steady_hand: 'Swaps no longer count against the swap limit, but cost {swap_seconds}s each.',
  hoarder: 'Discards no longer count against the discard limit, but cost {discard_seconds_per_card}s per card.',
  king_guard: 'Kings and Jacks score +{pips} pips and +{mult} mult',
  full_color: 'Hands with four unique suits score x{mult_mult} mult per card',
  knave_power: 'Score ×{per_jack} pips for each Jack on the grid',
  wellspring: 'For every {per_focus} Focus generated this game, this trick scores +{mult_per} mult',
  second_hand: 'Every time the clock passes a multiple of 10s, your next hand scores either +{mult} mult or +{pips} pips',
  sediment: 'Scores +{pips_per_interval} pips for every {interval_seconds} seconds elapsed this round',
  rising_tide: 'Each level you pass while holding this adds +{mult_min} to +{mult_max} mult to it',
  middle_man: 'Each time you gain or [[anywhere<1:lose credits during a round]][[anywhere:spend credits, anywhere]], this gains +{mult_per} mult',
  ready_set_go: 'A 3-card hand containing a 3, 6 or 9 scores +{mult} mult',
  minute_hand: 'Every time the clock passes a multiple of {interval_seconds}s, your next hand scores ×{mult_mult} mult',
  // r623: the common Tricks the owner's sheet renumbered, so an improvement prints its number
  first_light: 'Aces score {worth} pips',
  tidal_force: 'Flushes score +{mult_per_card} mult per card',
  early_bird: 'Hands played in the first third of the round score +{pips_per_card} pips per card',
  night_owl: 'Hands played in the last third of the round score +{mult_per_card} mult per card',
  ticktock: 'Every time the clock ends in a 0, gain +{focus} Focus',
  kindling: 'Same-hand streaks score +{mult_per_streak} mult × the streak count',
  even_score: 'Even-ranked cards score +{pips_per_card} pips',
  rowcol_mult: 'Cards scored in a marked row or column score +{mult} mult',
  more_better: 'Each ' + gridName('reward') + ' where you select {min_tiles}+ tiles permanently adds +{mult} mult to this trick',
  tunnel_vision: 'Start each round with {focus} Focus',
  rhythm: 'Each hand played adds {focus} additional Focus',
  down_and_back_in: 'Discarding a card of the grid’s highest rank grants +{grant} discards or +{grant} swaps (alternating) and +{coins} credits.',
  magician: '+{solo_pips} pips if you own no Sleights, or +{mult_per_sleight} mult for each Sleight you own',
  four_eyes: '4-card hands score +{mult} mult',
  four_by_four: 'Scored 4s[[queens: and Queens]] have a {chance_pct}% chance to force trigger the Trick in slot 4',
  shaky_foundation: 'Every other Set scores +{mult} mult',
  wave_amp: 'Consecutively played Runs score +{pips_per_streak} pips × the streak count',
  // r624: the rare Tricks the owner's sheet renumbered or reworked
  kindred: 'Sets score +{mult_per_card} mult per card in the largest set',
  high_pair: 'Hands containing a pair and a 2 or 4 add +{focus_per_card} Focus per card',
  ripple: 'Cards adjacent in rank to another card in the hand have a {chance_pct}% chance to replay[[chance2:, then a {chance2_pct}% chance to replay again]]',
  patience_reward: 'Adds mult equal to {mult_per_second}x the seconds passed since the last hand was played',
  first_play: "The round's first hand adds +{focus} Focus; each hand after adds 1 less, down to 0",
  still_water: 'Score +{mult_per_interval} mult for every {interval_seconds} seconds elapsed without using a swap',
  swift: '+{mult_per_interval} mult for every {interval_seconds} seconds elapsed this round',
  woodpecker: 'Marks a random cell every {interval_seconds} seconds; a card scored from the marked cell replays {retrigger_count}x[[chance_extra:, with a {chance_extra_pct}% chance of one more every time]]',
  hummingbird: '+{mult_per_pause} mult for every clock pause or rewind triggered this game',
  albatross: '+{pips_per_second} pips for every second the clock has spent paused this round',
  quarter_chime: 'Every time the clock passes a multiple of 15s, your next hand scores +{pips} pips',
  kingfisher: '+{mult_per_interval} mult for every {interval_seconds} seconds the clock has been paused or rewound this round',
  balanced_diet: 'Hands with exactly 2 suits score +{mult_per_card} mult per card',
  lucky_sevens: '+{focus} Focus for each 7 scored or discarded',
  prime_time: 'Prime-ranked cards (A,2,3,5,7) score +{pips_per_card} pips',
  odd_squad: 'Odd-ranked cards score +{mult_per_card} mult',
  wide_span_mult: 'Hands spanning the full width or height of the grid score +{mult} mult',
  plan_ahead: 'Every 3rd hand adds Focus equal to {times}x your average hands per round',
  stand_up: 'Hands with cards from only one column score +{mult_per_card} mult per card',
  wait_four_it: '4-card hands permanently buff their 4th card with a {pause}s pause (cannot stack from this source)',
  // r625: the epic Tricks the owner's sheet renumbered or reworked
  tide_table: 'Runs score ×{mult_base} mult, +×{mult_step} per Run scored this round',
  undertow: 'Runs score ×{pip_mult_base} pips, +×{pip_mult_step} per card beyond 3',
  rerun: '×{pip_mult} pips each time a card is replayed',
  chorus: '×{mult_mult} mult each time a card is replayed',
  portfolio: 'Score ×1 mult, +×{mult_mult_per_card} for every card on the grid with a buff',
  double_bloom: 'Hands containing a pair (pair, 2 pair, full house) score ×{mult_mult} mult',
  full_house_streak: 'Full Houses score +{focus} Focus',
  two_pair_mult: 'Play {need_count} hands with a pair within 30s to add +{focus} Focus',
  wild_heart: 'When an Ace[[extra_ranks: or [[extra_ranks<2:a rolled rank]][[extra_ranks>1:one of {extra_ranks} rolled ranks]]]] scores, prime your first and last Tricks[[primes>1: {primes} times]]',
  before_the_tide: 'Each rank {max_rank} or lower card scored adds its rank in Focus',
  royal_trio: 'A hand containing a King and one other Royal scores ×{mult_mult} mult',
  frozen_moment: 'Hands played while the clock is paused add +{focus} Focus',
  perfect_timing: 'Cards scored in a marked row or column replay [[chance2<0.995:once[[chance2>0:, with a {chance2_pct}% chance of a second replay]]]][[chance2>0.995:twice]][[extra_line:. A second line is marked, that line replays once]]',
  sixes_perm: 'Every {interval}th card scored permanently gains a random +{roll_min}–{roll_max} pips or mult',
  hourglass: 'Each time the clock passes a {interval_seconds}s mark: {chance_pct}% chance a random card on the grid gains +1 replay (permanent buff)',
  clean_sweep: 'Use every cell of any row or column within two hands to add +{focus} Focus and +{credits} credits',
  acorns: 'Each card scored scales this trick +{focus_per_card} Focus, starting at +0; adds its whole-number Focus each hand',
  queens_upgrade: "Scoring a card adjacent to a Queen permanently increases that card's rank (after it scores). Queens are automatically discarded after they've been on the grid for {queen_seconds} seconds",
  spade_flood: '[[suits<1:All-Spade hands]][[suits>0:[[suits<2:Hands of only clubs and/or spades]]]][[suits>1:Hands with a spade or a club]] add the remaining round time[[time_mult>1: ×{time_mult}]] as pips',
  wait_for_it: 'Each negative reward tile taken this run gives every scored card a +{chance_per_pct}% chance to replay. In Flow: each level-up that pays a single reward gives +{flow_per_pct}% instead, Luck aside',
  kaleidoscope: 'Apply the Focus multiplier a number of times equal to the number of suits in the hand[[extra: +{extra}]]',
  landfill: 'Score +{mult_per} mult for every swapped or discarded card this game',
  // r651 fused Tricks
  well_adjusted: 'Every hand scores +{pips} pips and +{mult} mult',
  right_place_time: 'Cards scored in a marked row or column score +{flat_pips} pips and pause the clock for {pause_seconds}s',
  short_circuit: 'Cards scored in a marked row or column score +{mult} mult and ×{pip_mult} pips',
  advanced_interrogation: "Cards scored in a marked row or column score ×{mult_mult} mult and have a {chance_pct}% chance to force-trigger the Trick in the tray slot of that line's number",
  love_of_money: 'Each heart applies x mult equal to 1 + (credits / {per_credits}); score ×1 pips, +{pip_mult_per_10_credits} for every 10 credits you hold, up to ×{max_pip_mult}',
  penny_perfect: 'Every {every} cards discarded or played permanently adds +{pips} pips and +{mult} mult to this trick',
  to_the_clouds: 'Adds {added} 9s to your deck. Each 9 scored adds +{mult_per_nine} mult to this trick, and each 9 discarded or played +{mult_per_milestone} more. A 9 that scores or is discarded is destroyed[[no_delete<1:; when none are left, this trick deletes itself]]',
  cornery: 'Corner cards score ×{mult_mult} mult and ×pips equal to the whole minutes left on the clock',
  hurricane: 'Runs score +{pips_per_card} pips and +{mult_per_card} mult per card',
  riptide: 'Runs score ×{mult_base} mult, +×{mult_step} per Run scored this round, and ×{pip_mult_base} pips, +×{pip_mult_step} per card beyond 3',
  encore_bang: '×{pip_mult} pips and ×{mult_mult} mult each time a card is replayed',
  lidar: 'Cards scored in a marked row or column replay once, with a {chance_pct}% chance of a second replay',
  erosion: '+{mult_per_interval} mult and +{pips_per_interval} pips for every {interval_seconds} seconds elapsed this round',
  seabird: '+{pips_per_second} pips for every second the clock has spent paused this round, and +{mult_per_interval} mult for every {interval_seconds} seconds paused or rewound',
  flood: 'Runs pause the clock for {pause}s; Sets pause the clock for {pause_per_set}s for each Set played this round',
  relativity: 'Score +pips equal to time remaining ÷ {divisor}; each time the clock passes a {interval_seconds}s mark, {chance_pct}% chance a random card on the grid gains +1 replay',
  men_of_means: 'Face cards (J/Q/K) score +{pips} pips and +{mult} mult',
  omega_prime: 'Prime-ranked cards (A,2,3,5,7) score +{pips_per_card} pips and prime your leftmost Trick',
  stranger_still: 'Odd-ranked cards score +{mult_per_card} mult, then x{mult_mult} mult[[replay: and replay once]]',
  can_even: 'Even-ranked cards score +{pips_per_card} pips and have a {chance_pct}% chance to score x{pip_mult} pips[[replay: and replay once]]',
  inferno: 'Same-hand streaks score +{mult_per_streak} mult × the streak count; reaching a streak of 3 adds +{focus} Focus',
  serenity: 'A hand that is not a straight line scores +{mult} mult and adds +{focus} Focus',
  working_class: 'Each club scored this round adds more and more pips: doubles each time, starting at {base}; score +{mult_per} mult for every swapped or discarded card this game',
  separation_anxiety: 'When an inseparable Trick triggers, {chance_pct}% chance to prime the Tricks beside it.',
  undue_influence: 'A Set containing a face card grants credits equal to the number of Set hands you have played this round[[faces:. Also pays credits equal to the number of face cards in the hand]]',
  patient_rulers: 'If you have paused or rewound the clock this round, face cards[[extra_ranks: and {extra_ranks} rolled ranks]] score x{mult_mult} mult',
  even_better: 'Even-ranked cards have a {chance_pct}% chance to score x{pip_mult} pips[[replay: and replay once]]',
  what_odds: 'Odd-ranked cards score x{mult_mult} mult[[replay: and replay once]]',
  critical: 'Flush type hands[[extra_family: and one rolled family]] score x{mult_mult} mult',
  twinners: 'Set type hands score x{pip_mult} pips[[replay: and every card replays once]]',
  feelin_lucky: 'Five randomly rolled ranks score x{mult_mult} mult. Trying to sell this costs 30% of your credits and rerolls the ranks instead - 3 times, then it really sells',
  marathon: 'Run type hands[[flush: and flushes]][[sets: and sets]] apply the Focus multiplier [[extra<2:one extra time]][[extra>1:{extra} extra times]]',
  shape_line: '5-card hands [[span6>0:that include 6 total rows and/or columns (e.g. 3 rows + 3 columns, 4 rows + 2 columns)]][[span6<1:played in a straight line]] add every card\'s pip value[[buffs: (including buffs)]] to mult',
};
// {key} prints the raw value; {key_pct} prints it as a percentage, which is how
// every chance entity wants to read ("a 50% chance", not "a 0.5 chance").
// [[key:text]] keeps the text only while p[key] > 0; [[key>N:text]] only while
// p[key] > N, [[key<N:text]] only while p[key] < N (r624: a second replay chance
// that is 0 until improved, a plural). Inner [[ ]] resolve first, so a block
// may nest one level.
function fillDescTemplate(t, p) {
  const cond = (k, op, n) => { const v = p[k] || 0, lim = n == null ? 0 : +n; return op === '<' ? v < lim : v > lim; };
  const re = /\[\[(\w+)(?:([<>])(-?\d+(?:\.\d+)?))?:((?:[^\[\]]|\[(?!\[)|\](?!\]))*)\]\]/g;
  for (let i = 0; i < 3; i++) t = t.replace(re, (m, k, op, n, txt) => (cond(k, op || '>', n) ? txt : ''));
  return t.replace(/\{(\w+)\}/g, (m, k) => {
    if (k in p) return p[k];
    if (k.endsWith('_pctover')) { const b = k.slice(0, -8); if (b in p) return Math.round((p[b] - 1) * 100); }
    if (k.endsWith('_pct')) { const b = k.slice(0, -4); if (b in p) return Math.round(p[b] * 100); }
    return m;
  });
}
function applyBalDescriptions() {
  [TRICK_POOL, SLEIGHT_POOL, KNACK_POOL].forEach(pool => pool.forEach(e => {
    if (DESC_TEMPLATES[e.id] && BAL[e.id]) e.desc = fillDescTemplate(DESC_TEMPLATES[e.id], BAL[e.id]);
  }));
}
applyBalDescriptions();


// ══════════════════════════════════════════════════════════════════════════
// GLOBAL PRICE MULTIPLIER (r234)
//
// One knob over every credit SINK in the game, so the economy can be retuned
// (and un-retuned) without editing a dozen price tables. It is applied in two
// different ways depending on where the number lives:
//
//   - a plain `const` table (shop.js) is scaled ONCE at load, so everything
//     derived from it - sell values, the +5 limit step - scales with it for
//     free and cannot drift out of step with the buy price.
//   - anything read out of BAL is scaled at the READ SITE, because
//     applyEntityTiers() rewrites BAL in place from BAL_BASE whenever a tier
//     changes and would throw away a load-time edit.
//
// Persisted so a tuning session survives a reload. Set to 1 for the shipped
// pre-r234 economy.
// ══════════════════════════════════════════════════════════════════════════
let PRICE_MULT = parseFloat(localStorage.getItem('lethe.priceMult'));
if (!isFinite(PRICE_MULT) || PRICE_MULT <= 0) PRICE_MULT = 2;

// Scale one price. Always at least 1 - a sink that rounds to zero stops being a
// cost at all, which is a different game rather than a cheaper one.
function priceOf(n) {
  if (typeof n !== 'number' || !isFinite(n) || n <= 0) return n;
  return Math.max(1, Math.round(n * PRICE_MULT));
}

// Scale every numeric value of a price table in place.
function scalePriceTable(tbl) {
  for (const k in tbl) if (typeof tbl[k] === 'number') tbl[k] = priceOf(tbl[k]);
  return tbl;
}

function setPriceMult(v) {
  v = parseFloat(v);
  if (!isFinite(v) || v <= 0) return PRICE_MULT;
  localStorage.setItem('lethe.priceMult', String(v));
  PRICE_MULT = v;     // tables already scaled this session; takes full effect on reload
  return PRICE_MULT;
}
