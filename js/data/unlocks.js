// ══════════════════════════════════════════════════════════════════════════
// TRICK UNLOCKS (r706, owner) - content, no logic. js/unlocks.js reads it.
//
// A LOCKED Trick is never offered (pickEntityByRarity, survivalEntityBanned).
// A Trick with no row here is unlocked. Once unlocked, it stays unlocked
// (`lethe.unlocks.v1`). Lifetime counts, kept across every run and mode.
//
// Row shapes:
//   { start: 1 }                 unlocked from the first run
//   { s: 'fam:run', n: 40 }       a lifetime count reaches n
//   { s: 'fam:run', n: 40, run: 1 }  ... in one run
//   { s: 'max:handreplays', n: 4 }   a best-ever value reaches n
//   { buy: 1 }                   only the Licensing event unlocks it (credits)
//   text: '...'                  overrides the generated goal sentence
//
// The owner's plan: half the commons start unlocked and the rest unlock in a
// run or two; about 20% of rares and 10% of epics start unlocked, nearly every
// rare unlocks within about five runs; legendaries unlock with a won run and
// are found 1% of the time or less (ENTITY_TIER_W, js/data/balance.js). Five
// Tricks are licensed, three of them credits Tricks (Middle Man, Undue Influence,
// Clean Sweep).
//
// Numbers were sized from the sim's bot (tools/unlocks/measure.js, r706):
// a Classic run is about 100 hands, 20 rounds, 80 set / 60 run / 2.5 flush
// hands, 500 cards scored, 30 replays, 2 pauses. The bot plays 5-card hands
// far more than a person; goals on 3- and 4-card hands are set for people.
//
// The epic and rare rows marked `unique` are the r706 proposals for the owner
// to review (UNLOCKS.md lists them with a verdict column). They are live.
// ══════════════════════════════════════════════════════════════════════════

// How a counter reads in a goal ({n} is the number).
const UL_STAT_TEXT = {
  'hands': 'Play {n} hands', 'cards': 'Score {n} cards', 'rounds': 'Clear {n} rounds', 'runs': 'Finish {n} runs', 'wins': 'Win {n} run',
  'fam:set': 'Play {n} Set hands', 'fam:run': 'Play {n} Run hands', 'fam:flush': 'Play {n} Flush hands',
  'h:Pair': 'Play {n} Pairs', 'h:Two Pair': 'Play {n} Two Pairs', 'h:Full House': 'Play {n} Full Houses', 'h:Four of a Kind': 'Play Four of a Kind {n} times',
  'h:Flush': 'Play {n} Flushes', 'h:Straight': 'Play {n} Straights',
  'size:3': 'Play {n} hands of 3 cards', 'size:4': 'Play {n} hands of 4 cards', 'size:5': 'Play {n} hands of 5 cards',
  'faces': 'Score {n} face cards', 'odd': 'Score {n} odd-ranked cards', 'even': 'Score {n} even-ranked cards', 'primes': 'Score {n} prime-ranked cards (A 2 3 5 7)',
  'low': 'Score {n} cards of rank 6 or lower',
  'rank:A': 'Score {n} Aces', 'rank:2': 'Score {n} 2s', 'rank:5': 'Score {n} 5s', 'rank:7': 'Score {n} 7s', 'rank:8': 'Score {n} 8s',
  'edge': 'Score {n} cards on an edge', 'corner': 'Score {n} corner cards', 'linecards': 'Score {n} cards from marked rows or columns',
  'crosscards': 'Score {n} cards where a marked row and a marked column cross',
  'twocorner': 'Play {n} hands with 2 corner cards', 'foursuit': 'Play {n} hands with all 4 suits', 'redhands': 'Play {n} hands of only hearts and diamonds',
  'longruns': 'Play {n} Run hands of 4 or more cards',
  'replays': 'Trigger {n} replays', 'max:handreplays': 'Trigger {n} replays in one hand',
  'pauses': 'Pause the clock {n} times', 'pausesecs': 'Keep the clock paused for {n}s in total', 'rewinds': 'Rewind the clock {n} times',
  'timesecs': 'Pause or rewind the clock for {n}s in total', 'timedrounds': 'Pause or rewind the clock in {n} different rounds',
  'pausedhands': 'Play {n} hands while the clock is paused', 'pausediscards': 'Discard {n} cards while the clock is paused',
  'discards': 'Discard {n} cards', 'swaps': 'Swap {n} times', 'sleights': 'Use a Sleight {n} times', 'sells': 'Sell {n} Tricks or Knacks',
  'focusmax': 'Fill the Focus bar {n} times', 'max:focusmult': 'Reach Focus x{n}',
  'credits': 'Gain {n} credits', 'max:creditsheld': 'Hold {n} credits at once', 'max:secsleft': 'Clear a round with {n}s left',
  'streak3': 'Play the same hand type 3 times in a row, {n} times', 'max:streak': 'Play the same hand type {n} times in a row',
  'shapes:square': 'Play {n} hands in a 2x2 square', 'shapes:cross': 'Play {n} hands of 5 cards shaped like a +, T or L',
  'shapes:line5': 'Play {n} hands of 5 cards in a straight line',
  'max:roundruns': 'Play {n} Run hands in one round', 'pairburst': 'Play 3 hands with a pair within 30s, {n} times',
  'max:pairhandscore': 'Score {n} with one hand that holds a pair',
  'challenges': 'Bank {n} challenge stages', 'bosses': 'Beat {n} bosses', 'improves': 'Improve {n} times', 'events': 'Open {n} events',
};

const TRICK_UNLOCKS = {
  // ── COMMON: 20 start, 21 unlock in a run or two ──────────────────────────
  overgrowth: { start: 1 }, long_road: { start: 1 }, enriched: { start: 1 }, tidal_force: { start: 1 },
  face_value: { start: 1 }, rich_soil: { start: 1 }, first_light: { start: 1 }, rowcol_triple_pips: { start: 1 },
  rowcol_mult: { start: 1 }, pair_pips: { start: 1 }, even_score: { start: 1 }, edge_pips: { start: 1 },
  kindling: { start: 1 }, light_touch: { start: 1 }, four_eyes: { start: 1 }, early_bird: { start: 1 },
  night_owl: { start: 1 }, combo_score: { start: 1 }, tunnel_vision: { start: 1 },
  king_guard:       { s: 'faces', n: 80 },
  humble_roots:     { s: 'low', n: 120 },
  summit:           { s: 'rounds', n: 8 },
  release_valve:    { s: 'focusmax', n: 10 },
  closing_time:     { s: 'rounds', n: 12 },
  quick_draw:       { s: 'hands', n: 80 },
  ticktock:         { s: 'rounds', n: 16 },
  second_hand:      { s: 'hands', n: 120 },
  echo_hand:        { s: 'streak3', n: 2 },
  ready_set_go:     { s: 'size:3', n: 25 },
  discard_pips:     { s: 'discards', n: 30 },
  more_better:      { s: 'runs', n: 2 },
  cull:             { s: 'swaps', n: 15 },
  first_wind:       { s: 'focusmax', n: 5 },
  expanse:          { s: 'focusmax', n: 20 },
  magician:         { s: 'sleights', n: 6 },
  encore:           { s: 'odd', n: 150 },
  shaky_foundation: { s: 'fam:set', n: 50 },
  wave_amp:         { s: 'fam:run', n: 35 },
  fours_perm:       { s: 'size:4', n: 25 },

  // ── RARE: 13 start, 3 licensed, the rest within about five runs ──────────
  kindred: { start: 1 }, river_run: { start: 1 }, heavy_hand: { start: 1 }, prime_time: { start: 1 },
  odd_squad: { start: 1 }, balanced_diet: { start: 1 }, full_color: { start: 1 }, sediment: { start: 1 },
  swift: { start: 1 }, study_hall: { start: 1 }, row_power: { start: 1 }, stand_up: { start: 1 }, first_fruits: { start: 1 },
  middle_man:        { buy: 1 },
  mirror:            { buy: 1 },
  scalper:           { buy: 1 },
  correct_run:       { s: 'fam:run', n: 80 },
  high_pair:         { s: 'h:Pair', n: 100 },
  patience_reward:   { s: 'hands', n: 250 },
  first_play:        { s: 'rounds', n: 25 },
  still_water:       { s: 'hands', n: 300 },
  hummingbird:       { s: 'pauses', n: 12 },
  albatross:         { s: 'pausesecs', n: 90 },
  minute_hand:       { s: 'rounds', n: 35 },
  number_crunch:     { s: 'size:4', n: 60 },
  rowcol_retrigger:  { s: 'linecards', n: 100 },
  right_time:        { s: 'linecards', n: 150 },
  wide_span_mult:    { s: 'size:5', n: 120 },
  groove:            { s: 'linecards', n: 200 },
  coin_sword:        { s: 'credits', n: 150 },
  overtime:          { s: 'rewinds', n: 10 },
  rising_tide:       { s: 'rounds', n: 45 },
  acorns:            { s: 'cards', n: 1500 },
  plan_ahead:        { s: 'hands', n: 450 },
  fives_discard:     { s: 'rank:5', n: 80 },
  tens_mult:         { s: 'discards', n: 100 },
  twos_retrigger:    { s: 'rank:2', n: 50 },
  prime_times:       { s: 'primes', n: 400 },
  eights_retrigger:  { s: 'rank:8', n: 100 },
  sands_of_time:     { s: 'max:secsleft', n: 90 },
  wild_side:         { s: 'runs', n: 4 },
  flow_state:        { s: 'max:focusmult', n: 1.5 },
  hyper_focus:       { s: 'max:focusmult', n: 2 },
  little_guys:       { s: 'low', n: 350 },
  five_second:       { s: 'size:5', n: 80 },
  wellspring:        { s: 'focusmax', n: 50 },
  third_down:        { s: 'size:3', n: 60 },
  wait_four_it:      { s: 'size:4', n: 80 },
  dam_holding:       { s: 'fam:run', n: 130 },
  // the r706 unique proposals (rare)
  ripple:            { s: 'replays', n: 60, unique: 1 },
  woodpecker:        { s: 'max:handreplays', n: 4, unique: 1 },
  deluge:            { s: 'fam:flush', n: 12, unique: 1 },
  interest:          { s: 'max:creditsheld', n: 50, unique: 1 },
  deep_breath:       { s: 'pausesecs', n: 60, unique: 1 },
  kingfisher:        { s: 'timesecs', n: 90, unique: 1 },
  wildfire:          { s: 'streak3', n: 15, unique: 1 },
  starling:          { s: 'max:streak', n: 5, unique: 1 },
  lucky_sevens:      { s: 'rank:7', n: 77, unique: 1 },
  shape_cross:       { s: 'shapes:cross', n: 3, unique: 1 },
  corner_retrigger:  { s: 'corner', n: 200, unique: 1 },
  third_charm:       { s: 'runs', n: 3, unique: 1 },
  quarter_chime:     { s: 'bosses', n: 6, unique: 1 },

  // ── EPIC: 5 start, 2 licensed, the rest the r706 proposals or a family goal
  twinners: { start: 1 }, even_better: { start: 1 }, compound_mult: { start: 1 }, heartwood: { start: 1 }, four_horseman: { start: 1 },
  feelin_lucky:       { s: 'sells', n: 10, unique: 1 },
  undue_influence:    { buy: 1 },
  clean_sweep:        { buy: 1 },
  tide_table:         { s: 'max:roundruns', n: 5, unique: 1 },
  undertow:           { s: 'longruns', n: 20, unique: 1 },
  high_water:         { s: 'fam:run', n: 120, unique: 1 },
  marathon:           { s: 'fam:run', n: 55, run: 1, unique: 1 },
  rerun:              { s: 'replays', n: 150, unique: 1 },
  chorus:             { s: 'max:handreplays', n: 6, unique: 1 },
  cuckoo:             { s: 'replays', n: 45, run: 1, unique: 1 },
  overclock:          { s: 'focusmax', n: 25, run: 1, unique: 1 },
  double_bloom:       { s: 'max:pairhandscore', n: 3000, unique: 1 },
  two_pair_mult:      { s: 'pairburst', n: 10, unique: 1 },
  rare_bloom:         { s: 'h:Four of a Kind', n: 4, unique: 1 },
  full_house_streak:  { s: 'h:Full House', n: 10, unique: 1 },
  wild_heart:         { s: 'rank:A', n: 140, unique: 1 },
  royal_trio:         { s: 'faces', n: 400, unique: 1 },
  frozen_moment:      { s: 'pausedhands', n: 8, unique: 1 },
  vulture:            { s: 'pausediscards', n: 12, unique: 1 },
  patient_rulers:     { s: 'timedrounds', n: 15, unique: 1 },
  monochrome:         { s: 'redhands', n: 25, unique: 1 },
  rowcol_perm_double: { s: 'crosscards', n: 15, unique: 1 },
  temporal_rift:      { s: 'crosscards', n: 3, unique: 1 },
  line_xpips:         { s: 'linecards', n: 250, unique: 1 },
  perfect_timing:     { s: 'linecards', n: 50, run: 1, unique: 1 },
  shape_square:       { s: 'shapes:square', n: 10, unique: 1 },
  shape_line:         { s: 'shapes:line5', n: 2, unique: 1 },
  two_corners:        { s: 'twocorner', n: 10, unique: 1 },
  obligatory:         { s: 'challenges', n: 12, unique: 1 },
  kaleidoscope:       { s: 'foursuit', n: 25, unique: 1 },
  landfill:           { s: 'discards', n: 160, unique: 1 },
  critical:           { s: 'fam:flush', n: 8, run: 1, unique: 1 },
  what_odds:          { s: 'odd', n: 700, unique: 1 },
  // family goals for the rest
  portfolio:          { s: 'improves', n: 15 },
  ninesong:           { s: 'rank:A', n: 200 },
  eye_of_storm:       { s: 'faces', n: 500 },
  magpie:             { s: 'swaps', n: 120 },
  hourglass:          { s: 'rounds', n: 70 },
  double_jeopardy:    { s: 'pauses', n: 30 },
  queens_upgrade:     { s: 'faces', n: 600 },
  spade_flood:        { s: 'cards', n: 3000 },
  sixes_perm:         { s: 'cards', n: 2500 },
  nines_mult:         { s: 'hands', n: 700 },
  feng_shui:          { s: 'linecards', n: 300 },
  assembly_line:      { s: 'linecards', n: 350 },
  line_xmult:         { s: 'linecards', n: 300 },
  suggestive:         { s: 'challenges', n: 8 },
  before_the_tide:    { s: 'low', n: 600 },
  changeling:         { s: 'runs', n: 6 },

  // ── LEGENDARY: unlocked by a won run; found 1% of the time or less ───────
  old_growth: { s: 'wins', n: 1 }, five_stack: { s: 'wins', n: 1 }, club_double: { s: 'wins', n: 1 }, knave_power: { s: 'wins', n: 1 },
  blackjack_bonus: { s: 'wins', n: 1 }, richter: { s: 'wins', n: 1 }, relentless: { s: 'wins', n: 1 }, obsessed: { s: 'wins', n: 1 },
  buried_treasure: { s: 'wins', n: 1 }, phoenix: { s: 'wins', n: 1 }, aces_absorb: { s: 'wins', n: 1 }, monopoly: { s: 'wins', n: 1 },
};
