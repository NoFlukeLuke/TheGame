// ── ENGINES (r576) - what genuinely works together ──────────────────────────
//
// Owner: "we need to create a reference that actually knows what goes well
// together." A tag says a Trick MENTIONS time; an engine says these pieces FEED
// each other: one makes the thing, another pays out on it. Free Pick offers the
// missing pieces of an engine you have started, and Theme Draft locks one engine
// and pays from it. Hand-curated from the descriptions; content, no logic.
//
// `buff` is the card buff that feeds the engine (a FLOWR_DECK_OPS id): Theme
// Draft's buffed card carries it. An engine with no offerable Sleight never
// becomes a Theme Draft theme (it needs a Trick, a Sleight and a card).
//
// COMBO_FAMILIES (js/combos-aim.js) is a different thing and stays: exact
// recipes that fire the "combo online" toast. These are broader pools.
const ENGINES = [
  { id: 'replay', name: 'Replays', icon: '↻', buff: 'replay',
    desc: 'Cards score again, and the pieces that pay per replay get paid again.',
    tricks:   ['rerun', 'chorus', 'echo_hand', 'ripple', 'closing_time', 'eye_of_storm', 'encore', 'eights_retrigger', 'rowcol_retrigger', 'perfect_timing', 'hourglass', 'woodpecker', 'cuckoo'],
    sleights: ['echo_play', 'reflect', 'soul_mirror'],
    knacks:   ['high_and_mighty', 'low_and_behold', 'replay_rewind', 'high_roller'] },
  { id: 'pause', name: 'Frozen Clock', icon: '⏸', buff: 'time',
    desc: 'Pause the clock often, then score big while it is stopped.',
    tricks:   ['deep_breath', 'frozen_moment', 'phoenix', 'albatross', 'kingfisher', 'hummingbird', 'patient_rulers', 'high_water', 'dam_holding', 'five_second', 'right_time', 'double_jeopardy', 'vulture', 'wait_four_it'],
    sleights: ['snooze', 'stopwatch', 'syncopation', 'shady_tree', 'the_queen'],
    knacks:   ['long_pause', 'sundial', 'metronome', 'time_slip'] },
  { id: 'rewind', name: 'Long Round', icon: '⏪', buff: 'time',
    desc: 'Keep the clock high with rewinds, then cash the time left in.',
    tricks:   ['deluge', 'magpie', 'temporal_rift', 'overtime', 'rain_check', 'spade_flood', 'corner_retrigger', 'kingfisher', 'hummingbird'],
    sleights: ['rewind', 'last_call', 'sandbag'],
    knacks:   ['clockmaker', 'deja_vu', 'replay_rewind', 'time_bank', 'carry_time', 'time_slip'] },
  { id: 'focus', name: 'Focus', icon: '◉', buff: 'focus',
    desc: 'Build Focus fast, raise its limit, and apply it more than once.',
    tricks:   ['river_run', 'high_pair', 'before_the_tide', 'study_hall', 'ticktock', 'rhythm', 'acorns', 'third_down', 'kaleidoscope', 'marathon', 'flow_state', 'hyper_focus', 'wellspring', 'overclock', 'expanse', 'life_lessons'],
    sleights: ['power_cell', 'slow_burn', 'governor', 'siphon'],
    knacks:   ['shorthand', 'long_fuse', 'stimulants', 'double_down', 'overdrive', 'dividend', 'core_memories'] },
  { id: 'discard', name: 'Discard Furnace', icon: '♻', buff: 'mult',
    desc: 'Swap and discard freely, and get paid for every card you throw away.',
    tricks:   ['discard_pips', 'landfill', 'cull', 'tens_mult', 'fives_discard', 'lucky_sevens', 'magpie', 'mockingbird', 'starling'],
    sleights: ['bellhop', 'whetstone', 'pivot', 'the_wanderer', 'cash_out', 'the_bomb', 'the_legacy'],
    knacks:   ['free_discards', 'free_swaps', 'hoarder', 'steady_hand', 'carry_swaps', 'carry_discards', 'down_and_back_in', 'turnover', 'free_hand'] },
  { id: 'lines', name: 'Marked Lines', icon: '▦', buff: 'pips',
    desc: 'Mark rows and columns, then play your hands along them.',
    tricks:   ['rowcol_triple_pips', 'rowcol_mult', 'rowcol_retrigger', 'perfect_timing', 'right_time', 'rowcol_perm_double', 'temporal_rift', 'groove', 'assembly_line', 'overtime', 'feng_shui', 'column_rush', 'row_power', 'clean_sweep'],
    sleights: ['lighthouse', 'shady_tree', 'magnet'],
    knacks:   ['surveyor', 'leveler', 'alignment', 'district', 'sundial'] },
  { id: 'flush', name: 'Suits', icon: '♥', buff: 'xmult',
    desc: 'Flushes and suit counts, paid in pips, mult and time.',
    tricks:   ['enriched', 'tidal_force', 'deluge', 'critical', 'kaleidoscope', 'full_color', 'balanced_diet', 'spade_flood', 'club_double', 'relentless', 'obsessed', 'buried_treasure'],
    sleights: ['warehouse'],
    knacks:   ['short_suit'] },
  { id: 'runs', name: 'Runs', icon: '⇗', buff: 'mult',
    desc: 'Play runs, longer and in order, and every run pays more.',
    tricks:   ['overgrowth', 'long_road', 'river_run', 'correct_run', 'tide_table', 'undertow', 'high_water', 'marathon', 'dam_holding', 'wave_amp', 'ripple'],
    sleights: ['the_ringer', 'magnet'],
    knacks:   ['old_tricks', 'deja_vu'] },
  { id: 'sets', name: 'Sets', icon: '⧉', buff: 'pips',
    desc: 'Pairs, threes and fours, pulled together and paid as sets.',
    tricks:   ['kindred', 'double_bloom', 'rare_bloom', 'pair_pips', 'twinners', 'richter', 'shaky_foundation', 'encore', 'undue_influence', 'high_pair', 'two_pair_mult'],
    sleights: ['magnet', 'the_ringer', 'the_queen'],
    knacks:   ['old_tricks', 'high_and_mighty'] },
  { id: 'credits', name: 'Bank', icon: '🪙', buff: 'coins',
    desc: 'Hold credits and earn more, and make the bank itself score.',
    tricks:   ['interest', 'obsessed', 'buried_treasure', 'five_fodder', 'undue_influence', 'clean_sweep'],
    sleights: ['piggy_bank', 'cash_out', 'capacitor'],
    knacks:   ['inheritance', 'short_change', 'gross_pay', 'high_roller', 'dividend', 'trade_winds', 'time_and_a_half', 'haggler'] },
  { id: 'growth', name: 'Snowball', icon: '🌱', buff: 'pips',
    desc: 'Cards and Tricks that grow every time they are used.',
    tricks:   ['first_fruits', 'sapling', 'rare_bloom', 'sixes_perm', 'fours_perm', 'rowcol_perm_double', 'feng_shui', 'acorns', 'wellspring', 'queens_upgrade', 'compound_mult'],
    sleights: ['the_naturalist', 'the_bomb', 'lightning_rod', 'the_catalyst', 'whetstone'],
    knacks:   ['hallmark', 'old_tricks'] },
  { id: 'prime', name: 'Priming', icon: '⚡', buff: 'mult',
    desc: 'Prime your Tricks so they fire twice.',
    tricks:   ['wild_heart', 'prime_times', 'prime_time'],
    sleights: [],
    knacks:   ['understudy', 'muscle_memory', 'hallmark'] },
];

// Drop ids that are not in their pool, so a renamed or removed entity cannot
// leave a dead offer behind. Runs once, after the pools have loaded.
(function engineValidate() {
  const have = {
    tricks: new Set((typeof TRICK_POOL_ALL !== 'undefined' ? TRICK_POOL_ALL : TRICK_POOL).map(t => t.id)),
    sleights: new Set(SLEIGHT_POOL.map(s => s.id)),
    knacks: new Set(KNACK_POOL.map(k => k.id)),
  };
  const gone = [];
  ENGINES.forEach(e => ['tricks', 'sleights', 'knacks'].forEach(k => {
    e[k] = e[k].filter(id => have[k].has(id) || (gone.push(`${e.id}.${id}`), false));
  }));
  if (gone.length && typeof console !== 'undefined') console.warn('[ENGINES] unknown ids dropped:', gone.join(', '));
})();
