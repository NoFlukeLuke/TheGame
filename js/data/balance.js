const BAL = {
  rich_soil: { mult: 1 },
  court_of_leaves: { pips: 3 },
  low_tide: { pips: 6 },
  first_light: { worth: 21 },
  power_two: { pips: 4 },
  ten_strong: { pips: 7 },
  king_guard: { pips: 5, mult: 5 },
  dark_matter: { pips: 5 },
  face_value: { face_pips: 10 },
  humble_roots: { pip_mult: 3 },
  summit: { pips_per_level: 2 },
  before_the_tide: { extra_mult: 5 },
  knave_power: { per_jack: 2 },
  rowcol_triple_pips: { flat_pips: 10 },
  right_time:     { pause_seconds: 2 },
  study_hall:     { focus: 1, every: 2 },
  high_water:     { pause_per_run: 1 },
  rowcol_perm_double: { perm_mult: 1 },
  wide_span_mult: { mult: 25 },
  hidden_pair: { pips: 12 },
  twin_sprouts: { pips: 15 },
  enriched: { pips: 100 },
  overgrowth: { pips_per_card: 10 },
  triple_threat: { pips: 20 },
  early_bird: { pips_per_card: 5 },
  kindling: { mult_per_streak: 4 },
  spade_flood: { time_div: 1 },
  sands_of_time: { divisor: 2 },
  discard_pips: { mult_per: 2 },
  landfill: { mult_per: 1 },
  magician: { mult_per_sleight: 3 },
  stand_up: { mult_per_card: 5 },
  scalper: { mult_mult_per_missing: 0.25 },
  down_and_back_in: { coins: 5 },
  scavenger: { coins: 10 },
  edge_pips: { pips_per_card: 15 },
  high_pair: { focus_per_card: 2 },
  pair_pips: { pip_mult: 2 },
  heavy_hand: { pips_per_card: 10 },
  quick_draw: { window_ms: 2000, cap_gain: 1, cap: 10 },
  expanse: { cap_gain: 1, cap: 10, keep_fraction: 0.5 },
  flow_state: { pips_per_card: 10 },
  club_double: { base: 1 },
  night_owl: { mult_per_card: 3 },
  wildfire: { focus: 5 },
  frozen_moment: { focus: 10 },
  swift: { mult_per_interval: 5, interval_seconds: 10 },
  cuckoo: { hands_between: 2, per_replays: 5 },
  clean_sweep: { focus: 5, credits: 5 },
  double_jeopardy: { pause_seconds: 15, cells: 2 },
  aces_absorb: { chance: 0.5 },
  queens_upgrade: { queen_seconds: 45 },
  woodpecker: { interval_seconds: 30, retrigger_count: 2 },
  hummingbird: { mult_per_pause: 2 },
  albatross: { pips_per_second: 5 },
  vulture: { pause_seconds: 3 },
  phoenix: {},
  metronome: { seconds: 5 },
  syncopation: { seconds: 12 },
  sundial: { seconds: 8 },
  long_pause: { multiplier: 1.5 },
  snooze: { seconds: 10 },
  kindred: { mult_per_card: 5 },
  tidal_force: { mult_per_card: 5 },
  rare_bloom: { perm_pips: 8 },
  two_pair_mult: { focus: 16, window_ms: 30000, need_count: 3 },
  threes_run: { mult: 9 },
  lucky_three: { mult: 2 },
  light_touch: { mult: 10 },
  patience_reward: { mult: 10, seconds: 15 },
  first_play: { focus: 5 },
  monochrome: { coins: 5, seconds: 10 },
  full_color: { pips_per_card: 16, mult_per_card: 16 },
  balanced_diet: { mult_per_card: 5 },
  number_crunch: { mult_per_card: 5 },
  cull: { focus_per_stock: 1, per: 2 },
  even_score: { pips_per_card: 4 },
  odd_squad: { mult_per_card: 3 },
  long_road: { mult_per_card: 2 },
  still_water: { mult_per_interval: 5 },
  wild_heart: { mult_per_ace: 2 },
  jack_mult: { mult_per_jack: 2 },
  same_kind: { mult_per_match: 2 },
  column_rush: { mult_per_card: 5 },
  row_power: { mult_per_card: 10 },
  groove:        { focus_per_2: 1 },
  assembly_line: { mult_per_prior: 1 },
  overtime:      { seconds_per_3: 1 },
  shift_change:  { consolation_credits: 15 },   // Shift Change event, when you hold under 2 Tricks
  feng_shui:     { pips: 3, pips_per_hand: 3 },
  five_stack:    { pips: 20, mult: 5, focus_per_card: 1 },
  little_guys:   { cap_gain: 1, cap: 15 },
  five_fodder:   { credits: 5 },
  five_second:   { pause_seconds: 5 },
  life_lessons:  { cap_gain: 1 },
  wellspring:    { per_focus: 10, mult_per: 1 },
  third_down:    { focus: 3 },
  ready_set_go:  { mult: 9 },
  third_charm:   { extra_replays: 2 },
  four_eyes:     { mult: 12 },
  four_by_four:  { pips: 16 },
  four_horseman: { pips: 16, mult: 8, focus: 4, pause: 4 },
  wait_four_it:  { pause: 2 },
  shaky_foundation: { mult: 15 },
  wave_amp:      { pips_per_streak: 10 },
  dam_holding:   { pause: 3 },
  acorns:        { focus_per_card: 0.1 },
  plan_ahead:    { every: 3 },
  more_better:   { mult: 5, min_tiles: 3 },
  rain_check:    { seconds: 30 },
  temporal_rift: { rewind: 3 },

  // Shop multi-buy discount (js/shop-grid-preview.js): % off per ADDITIONAL item
  // in the connected group. Bulk Buyer raises the rate to bulk_per_item. No cap of
  // its own - Selection Size already caps the group.
  shop_discount: { per_item: 3, bulk_per_item: 5 },
  reward_skip:   { gold: 20 },   // gold paid for skipping the whole reward grid (shown on the SKIP button)
  wild_side:     { mult_per: 6 },       // +mult per negative reward tile taken this run
  rising_tide:   { mult: 1, mult_per: 1 }, // +1 mult, +1 more per level reached
  wait_for_it:   { chance_per: 0.02 },  // +replay chance per negative reward tile taken this run
  greedy_boi:    { selection: 2 },      // +reward-grid selection size (knack)
  combo_score: { mult_per_type: 4 },
  heart_double: { heart_mult: 1 },
  full_house_streak: { focus: 10 },
  blackjack_bonus: { pip_mult: 3 },
  double_bloom: { mult_mult: 1.5 },
  richter: { mult_mult: 3, focus: 10 },
  ripple: { chance: 0.5 },
  river_run: { focus_per_card: 1 },
  deluge: { seconds: 15 },
  perfect_storm: { pip_mult: 5 },
  extinction: { mult_mult: 2 },
  lucky_sevens: { focus: 3 },
  ninesong: { seconds: 9, mult: 9, focus: 9 },
  royal_trio: { mult_mult: 2 },
  prime_time: { pips_per_card: 23 },
  shape_square: { focus: 16 },
  shape_cross: { focus: 25 },
  two_corners: { mult_mult: 4 },
  correct_run: { pips: 80, mult: 20, focus: 10 },
  tide_table: { mult_step: 0.25 },
  undertow: { pip_mult_base: 1.5, pip_mult_step: 0.5 },
  // ── r179 multiplier batch: ×pips / ×mult on triggers the pools had never used ──
  // (replays, a paused clock, credits held, buffed cards on the grid, Focus level)
  rerun:       { pip_mult: 1.2 },
  deep_breath: { pip_mult: 2 },
  interest:    { pip_mult_per_10_credits: 0.1, max_pip_mult: 3 },
  chorus:      { mult_mult: 1.75 },
  portfolio:   { mult_mult_per_card: 0.15 },
  // Compound (legendary): every interval_seconds of round time the current round score
  // is banked; the next scored hand pays bank_fraction of it again. Repeats, so the
  // score compounds across a round rather than doubling once.
  // ── Upgrade events (r194) ──
  rehearsal: { consolation_credits: 12 },
  workshop:  { cap_bonus: 2, consolation_credits: 12 },
  // ── Card Market (r211) - buy cards INTO the deck, each carrying one effect ──
  // Three on offer, priced by how strong the effect is. The card itself is a copy
  // of one already in the deck, so the market can never hand out a rank or suit
  // the mode does not use (Spectrum has no courts, Six Suits has two extra suits).
  market: { offers: 3, prices: { pips: 8, mult: 12, time: 10, replay: 18, coin: 6 } },
  // ── Deck Trim (r211) - the frequent-removal event ──
  // Three cuts of rising size and price. first_free makes the smallest cut cost
  // nothing, so the event always does something even at 0 credits.
  deck_trim: { tiers: [ { cards: 1, price: 0 }, { cards: 2, price: 6 }, { cards: 4, price: 14 } ] },
  // ── Guided (r219): what a slot costs to fill with something other than a round. ──
  guided: {
    price_shop: 12, price_reward: 10, price_event: 6,
  },
  clean_slate:  { consolation_credits: 14 },
  // ── r218 events ──
  reassignment: { consolation_credits: 12 },
  the_draw:     { steps: 2, spin_ms: 3200, consolation_credits: 12 },
  the_floor:    { line_cost: 6 },
  the_payline:  { spin_cost: 8, consolation_credits: 12 },
  // ── Focus RATE batch (r180) - scale how fast Focus accrues, not the ceiling ──
  // complexity_mult scales HAND_FOCUS; speed_mult scales the speed bonus;
  // window_mult dilates the speed clock (2 = twice as long for the same bonus).
  overclock:      { speed_mult: 2 },
  long_fuse:      { window_mult: 2 },
  shorthand:      { complexity_mult: 1.5 },
  governor:       { window_mult: 1.5 },
  // ── play/round-side: accumulators & permanent gains ──
  first_fruits: { pips: 3 },
  heartwood: { pips: 5, mult: 2 },
  fours_perm: { pips: 4 },
  fives_discard: { pips_per_five: 5 },
  nines_mult: { mult_per_nine: 9 },
  tens_mult: { mult_per_milestone: 3, discards_per_milestone: 9 },
  sixes_perm: { roll_min: 1, roll_max: 6, interval: 6 },
  compound_mult: { mult_per_hand: 0.1 },
  // ── clock-mark Tricks ──
  ticktock: { focus: 2 },
  quarter_chime: { pips: 45 },
  minute_hand: { mult_mult: 2, interval_seconds: 30 },
  understudy: { interval_seconds: 30 },
  hallmark:   { mult: 5, pips: 10, seconds: 3, force_scale: 1, force_cap_x: 8 },
  turnover:   { idle_seconds: 45 },
  // Card states (r278, js/card-states.js). Not an entity, so improve.js never
  // touches these - they are the states' own numbers, in one place.
  card_states: { review_up: 0.2, review_down: 0.5, roll_call_penalty: 15, fuse_seconds: 60 },
  payout_pick: { pips: 12 },
  second_hand: { pips: 10, mult: 5 },
  hourglass: { chance: 0.5 },
  sediment: { interval_seconds: 10, pips_per_interval: 10 },
  kingfisher: { interval_seconds: 2, mult_per_interval: 1 },
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
  bellhop: { swaps: 2, discards: 1 },
  cash_out: { coins: 10 },
  amplifier: { mult: 10 },
  piggy_bank: { coins: 5 },
  // ── adjacency / position sleights (r120) ──
  whetstone:  { mult_per_event: 2 },
  entourage:  { mult_per_sleight: 10 },
  lighthouse: { mult: 20, falloff_per_column: 7 },
  // ── focus-payout entities (r123) ──
  // ── reward-grid penalties (r194) ──
  rider:        { seconds_per_proc: 2 },
  spot_check:   { mult: 0.5, plays_to_clear: 3 },
  interest_freeze: { rounds: 3 },
  reflect:      { extra_replays: 2, board_seconds: 60 },
  soul_mirror:  { /* replays = copies of the aimed rank in the whole deck */ },
  power_cell:   { focus_on_enter: 10, focus_cap: 10 },
  slow_burn:    { seconds_per: 45, cap: 15 },
  capacitor:    { focus_cost: 10, time_cost: 10, credits: 10 },
  siphon:       { focus_cost: 15, mult: 4 },
  release_valve:{ focus_drop: 16 },
  dividend:     { credits: 8, keep_fraction: 0.33 },
  trade_winds:  { cap_reduction: 10, payout_fraction: 0.5 },
  growth_spurt: { cap_reduction: 5 },
  // ── knacks ──
  tempo:    { limit: 2, interval_seconds: 15 },
  jury_rig: { chance: 0.5, charges: 1 },
  coin_toss: { chance: 0.5, charges: 1 },   // was hardcoded in js/level-up.js until r196
  rowcol_retrigger: { chance: 2/3 },        // was an unscalable modulo in js/scoring.js until r196
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
  _exalt: { club_pips: 10, diamond_coins: 3, heart_mult: 4, spade_time: 4 },
  _corrupt: { club_pips: 25, club_mult: -3, diamond_coins: 5, diamond_pips: -20, heart_mult: 5, heart_time: -5, spade_time: 7, spade_coins: -5 },
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
const ENTITY_TIER_W  = [71, 22, 5.5, 1.5];

// The post-boss PRIZE (boss) grid. It used to cut commons out of every pool and
// draw the remaining three tiers, which is a different thing from a table: the
// filters decided the floor and the weights only shared out what was left.
// It is a real four-tier table now (owner's numbers), so the prize grid's
// generosity is one line here rather than a filter in three pool builders, and
// what it says is what it draws. A common is a third of the tiles and the
// middle of the ladder is where a prize grid pays: RARE is more than half.
const PRIZE_TIER_W   = [30, 55, 12, 3];

const DESC_TEMPLATES = {
  understudy: 'Every {interval_seconds} seconds one of your tricks is primed: it fires an extra time on your next hand.',
  hallmark:   'Once a round a card on the board is marked. Score it and it takes a random buff: +{mult} mult, +{pips} pips, an extra replay, {seconds}s of clock, or a trick primed or forced.',
  turnover:   'Any card you leave alone for {idle_seconds} seconds is discarded and a fresh one falls in. Costs you nothing.',
  whetstone: 'Whenever an adjacent card is swapped or discarded, Whetstone gains +{mult_per_event} mult permanently. Hands that score a card adjacent to Whetstone score that mult.',
  entourage: 'Hands score +{mult_per_sleight} mult for every other Sleight on the grid.',
  lighthouse: 'Each round Lighthouse picks either the first or last column. All hands score +{mult} mult when Lighthouse is in that column, −{falloff_per_column} per column away (minimum 0).',
  tempo: 'When acquired, sets your swap and discard limits to {limit}. Every {interval_seconds} seconds, gain 1 back - alternating swap, then discard.',
  capacitor: 'Double-tap: spend {focus_cost} Focus and {time_cost} seconds for {credits} credits. Becomes inert on use: it can no longer be swapped or discarded. (1 charge)',
  siphon: 'Double-tap to spend {focus_cost} Focus: your next scored hand gets ×{mult} mult. Discards on use.',
  release_valve: 'Each time you hit your Focus limit, gain +1 swap and +1 discard and lose {focus_drop} Focus.',
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
  jack_mult: 'Jacks add +{mult_per_jack} mult each',
  ten_strong: 'Tens score +{pips} pips each',
  power_two: 'Cards ranked 2 score +{pips} pips each',
  lucky_three: 'Any 3 in a hand adds +{mult} mult',
  rich_soil: 'All cards score +{mult} mult',
  heart_double: 'Each scored heart adds +{heart_mult} mult',
  number_crunch: 'Hands with 4+ different ranks score +{mult_per_card} mult per card',
  shape_square: 'A 2×2 shaped hand adds +{focus} Focus',
  shape_cross: 'A 5 card + shaped hand adds +{focus} Focus',
  two_corners: 'When a hand has 2 or more corner cards, each corner card scores ×{mult_mult} mult',
  edge_pips: 'Hands where all cards are on an edge score +{pips_per_card} pips per card',
  column_rush: 'Hands with cards from only one column score +{mult_per_card} mult per card',
  row_power: 'Hands with cards from only one row score +{mult_per_card} mult per card',
  right_time: 'Cards scored in a marked row or column pause the clock for +{pause_seconds}s',
  study_hall: 'Every {every} cards scored adds +{focus} Focus',
  cull: 'Discarding or swapping adds +{focus_per_stock} Focus per {per} remaining swaps and discards',
  rowcol_perm_double: 'Cards scored at the intersection of a row effect and a column effect permanently gain +{perm_mult} mult',
  groove:        'Scales +{focus_per_2} Focus for every 2 cards scored from a marked row or column. Resets each round.',
  assembly_line: 'Cards scored in a marked row or column score +{mult_per_prior} mult for every card played from that line this round',
  overtime:      "Rewind the clock +{seconds_per_3}s for every 3 cards you have scored from this Trick's marked row or column. Resets each round.",
  feng_shui: 'Scores +{pips} pips, +{pips_per_hand} more for each hand scored with a row or column buff',
  sands_of_time: 'Score +pips equal to time remaining ÷ {divisor}',
  discard_pips: '+{mult_per} mult per card discarded this round',
  dark_matter: 'Corrupted cards in a hand add +{pips} pips each',
  combo_score: '+{mult_per_type} mult for every distinct hand type played this round',
  flow_state: 'While focus is ×1.5 or higher, score +{pips_per_card} pips per card',
  low_tide: 'Cards below 6 score +{pips} pips',
  rowcol_triple_pips: 'Cards scored in a marked row or column score +{flat_pips} pips',
  first_fruits: 'Each card in the first hand each round permanently gains +{pips} pips',
  compound_mult: 'Each hand played permanently adds +{mult_per_hand} mult to this trick',
  tens_mult: 'Every {discards_per_milestone} cards discarded permanently adds +{mult_per_milestone} mult to this trick',
  heartwood: 'When scored, the center-most card gains +{pips} pips & +{mult} mult',
  pivot: 'Cards touching Pivot swap for free. Swap two of its neighbours together and both gain +{mult} permanent mult, then Pivot leaves the board. (3 charges)',
  the_naturalist: 'Play this: each other scored card permanently gains +{pips} pips.',
  bellhop: 'Play this: gain +{swaps} swaps and +{discards} discard. (5 charges)',
  the_bomb: 'Discard this: every card on the grid permanently gains +{pips} pips. (2 charges)',
  cash_out: 'Discard this: gain {coins} credits. (3 charges)',
  lightning_rod: 'When swapped, the card it traded with permanently gains +{pips} pips.',
  the_catalyst: 'When swapped, the card it traded with permanently gains +{mult} mult.',
  time_bank: '+{seconds} seconds at the start of every round.',
  inheritance: 'Start each round with +{coins} credits.',
  lucky_seven: 'Every {interval_hands}th hand played gives +{swaps} swap.',
  extra_swaps: 'Start each round with +{swaps} extra swaps.',
  extra_discards: 'Start each round with +{discards} extra discards.',
  carry_swaps: 'Unused swaps carry over to the next round (max {max}).',
  carry_discards: 'Unused discards carry over to the next round (max {max}).',
  carry_time: 'Unused round seconds carry over (max {max_seconds}s).',
  fives_discard: 'Each 5 discarded or played permanently adds +{pips_per_five} pips to this trick',
  nines_mult: 'Each 9 scored permanently adds +{mult_per_nine} mult to this trick',
  fours_perm: '4-card hands permanently give the 4th card +{pips} pips',
  interest: 'Score ×1 pips, +{pip_mult_per_10_credits} for every 10 credits you hold, up to ×{max_pip_mult}',
  idol: 'Finish the round with this on your board to earn {interest_mult}× interest. (Once)',
  amplifier: 'Double-tap: the next hand scores +{mult} mult. (5 charges)',
  the_legacy: 'Discard this: the next hand played gets ×{mult_x} mult. (3 charges)',
  power_cell: 'When it enters the grid: +{focus_on_enter} Focus. While it remains on the grid: +{focus_cap} to your Focus limit.',
  rowcol_retrigger: 'Cards scored in a marked row or column have a {chance_pct}% chance to replay',
  coin_toss: 'At the start of each round, every Sleight has a {chance_pct}% chance to restore {charges} charge.',
  reflect: 'Tap to rotate its aim. The rank it faces replays {extra_replays}x when scored. Cannot be swapped, discarded or played. Discards itself after {board_seconds}s.',
  deluge: 'Flushes rewind the clock {seconds} seconds',
  monochrome: 'Hands containing exclusively hearts AND diamonds grant +{coins} credits but cost {seconds} seconds',
  ninesong: "If the hand's pip total is divisible by 3, one of the following happens: rewind {seconds} seconds, +{mult} mult, +{focus} Focus",
  deja_vu: 'Playing the same ranks in two hands in a row rewinds the clock {seconds} seconds.',
  clockmaker: 'Any time a single hand scores at least 30% of the round goal, rewind the clock {seconds} seconds.',
  piggy_bank: 'Double-tap: gain {coins} credits, once per round. Becomes inert on use: it can no longer be swapped or discarded. (5 charges)',
  steady_hand: 'Swaps no longer count against the swap limit, but cost {swap_seconds}s each.',
  hoarder: 'Discards no longer count against the discard limit, but cost {discard_seconds_per_card}s per card.',
  king_guard: 'Kings and Jacks score +{pips} pips and +{mult} mult',
  full_color: 'Hands with all four suits score +{pips_per_card} pips and +{mult_per_card} mult per card',
  second_hand: 'Every time the clock passes a multiple of 10s, your next hand scores either +{mult} mult or +{pips} pips',
  sediment: 'Scores +{pips_per_interval} pips for every {interval_seconds} seconds elapsed this round',
  rising_tide: 'Score +{mult} mult, +{mult_per} more for each level reached',
  ready_set_go: 'A 3-card hand containing a 3, 6 or 9 scores +{mult} mult',
  minute_hand: 'Every time the clock passes a multiple of {interval_seconds}s, your next hand scores ×{mult_mult} mult',
};
// {key} prints the raw value; {key_pct} prints it as a percentage, which is how
// every chance entity wants to read ("a 50% chance", not "a 0.5 chance").
function fillDescTemplate(t, p) {
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
