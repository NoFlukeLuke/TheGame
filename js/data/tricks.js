const TRICK_POOL = [
  // ── Runs ──
  { id:'overgrowth',     name:'Cascade',             tier:'common',    desc:'Runs score +20 pips per card', tags:['pips','card','run','scores'] },
  { id:'long_road',      name:'Storm',               tier:'common',    desc:'Runs score +10 mult per card', tags:['mult','card','run','scores'] },
  { id:'river_run',      name:'Torrent',             tier:'rare',      desc:'Runs add +1 Focus per card', tags:['focus','card','run'] },
  { id:'correct_run',    name:'Rogue Wave',          tier:'rare',    desc:'Runs played in correct sequential order score one of the following: +80 pips, +20 mult, +10 Focus', tags:['pips','mult','focus','hand','run','scores','chance'] },
  { id:'tide_table',     name:'Tide Table',          tier:'epic',      desc:'Runs score ×1.25 mult, +×0.5 per Run scored this round', tags:['xmult','hand','run','scores'] },
  { id:'undertow',       name:'Undertow',            tier:'epic',      desc:'Runs score ×2 pips, +×0.5 per card beyond 3', tags:['xpips','hand','run','size','scores'] },
  { id:'high_water',     name:'High Water',          tier:'epic',      desc:'Runs pause the clock for 1s for each Run played this round', tags:['time','hand','run'] },
  // ── Multiplier batch (r179) ──
  // ×pips and ×mult on triggers the pools had never covered: replays, a held clock,
  // credits, buffed cards on the grid, and the Focus level itself. Every one of them
  // reads in the PIPS or MULT chip, which a ×score never did.
  { id:'rerun',       name:'Rerun',       tier:'epic',   desc:'×1.25 pips each time a card is replayed', tags:['xpips','card','scores','replays'] },
  { id:'chorus',      name:'Chorus',      tier:'epic',   desc:'×1.5 mult each time a card is replayed', tags:['xmult','card','scores','replays'] },
  { id:'deep_breath', name:'Deep Breath', tier:'rare',   desc:'Score ×2 pips while the clock is paused', tags:['xpips','hand','pause','scores'] },
  { id:'interest',    name:'Interest',    tier:'rare',   desc:'Score ×1 pips, +0.1 for every 10 credits you hold, up to ×3', tags:['xpips','hand','scores','held'] },
  { id:'portfolio',   name:'Portfolio',   tier:'epic',   desc:'Score ×1 mult, +×0.25 for every card on the grid with a buff', tags:['xmult','hand','buffed','scores'] },
  // ── Focus RATE batch (r180) - see focusRateMods() in js/focus-config.js ──
  { id:'overclock',     name:'Overclock',     tier:'epic', desc:'The Focus speed bonus is multiplied by 2.', tags:['focus','other'] },
  // ── Pairs / sets ──
  { id:'kindred',        name:'Quake',               tier:'rare',    desc:'Sets score +15 mult per card in the largest set', tags:['mult','card','set','scores'] },
  { id:'double_bloom',   name:'Magnitude',           tier:'epic',      desc:'Hands containing a pair (pair, 2 pair, full house) score ×1.5 mult', tags:['xmult','hand','set','scores'] },
  { id:'high_pair',      name:'Resonance',           tier:'rare',      desc:'Hands containing a pair and a 2 or 4 add +4 Focus per card', tags:['focus','card','set','rank'] },
  { id:'rare_bloom',     name:'Bedrock',             tier:'epic',      desc:'Four of a Kind permanently buffs its 4 cards +8 pips each', tags:['deck','pips','hand','set','scaling','scores'] },
  { id:'full_house_streak', name:'Collapsing Columns', tier:'epic',  desc:'Full Houses score +15 Focus', tags:['focus','hand','set'] },
  { id:'pair_pips',      name:'Aftershock',          tier:'common',    desc:'Two Pair scores ×2 pips', tags:['xpips','hand','set','scores'] },
  { id:'two_pair_mult',  name:'Double Dutch',        tier:'epic',      desc:'Play 3 hands with a pair within 30s to add +20 Focus', tags:['focus','hand','set','clock'] },
  { id:'richter',        name:'Richter',             tier:'legendary', desc:'Four of a Kind scores ×3 mult and +10 Focus', tags:['xmult','focus','hand','set','scores'] },
  { id:'eye_of_storm',   name:'Eye of the Storm',    tier:'epic',      desc:'Hands played in the middle third of the round replay the highest-ranked card(s) 2x', tags:['replay','card','clock','scores','rank'] },
  { id:'ripple',         name:'Ripple',              tier:'rare',      desc:'Cards adjacent in rank to another card in the hand have a 66% chance to replay', tags:['replay','card','scores','chance','rank'] },
  // ── Flush / special hand types ──
  { id:'enriched',       name:'Enriched',            tier:'common',    desc:'Flushes score +100 pips', tags:['pips','hand','flush','scores'] },
  { id:'tidal_force',    name:'Tidal Forces',        tier:'common',    desc:'Flushes score +15 mult per card', tags:['mult','card','flush','scores'] },
  { id:'deluge',         name:'Deluge',              tier:'rare',      desc:'Flushes rewind the clock 15s', tags:['time','hand','flush'] },
  { id:'summit',     name:'Unsummit',   tier:'common', desc:'The highest-ranking card in each hand scores +(level x 2) pips.', tags:['pips','card','scores','scaling','rank'] },
  { id:'light_touch',    name:'Nimble',              tier:'common',    desc:'2-card hands score +30 mult', tags:['mult','hand','size','scores'] },
  { id:'release_valve',  name:'Release Valve',       tier:'common',    desc:'Each time you hit your Focus limit, gain +1 swap and +1 discard and lose 16 Focus.', tags:['stock','other','cost'] },
  { id:'heavy_hand',     name:'Full Load',           tier:'rare',      desc:'5-card hands score +20 pips per card', tags:['pips','card','size','scores'] },
  { id:'blackjack_bonus', name:'Twenty-One',         tier:'legendary', desc:'If the face values of your cards total exactly 21, score ×3 pips', tags:['xpips','hand','rank','scores'] },
  // ── Rank-specific pips / mult ──
  { id:'first_light',    name:'First Light',         tier:'common',    desc:'Aces score 42 pips', tags:['pips','card','rank','scores'] },
  { id:'wild_heart',     name:'Inspirato',           tier:'epic',      tags:['retrigger','card','rank','tricks'], desc:'When an Ace scores, prime your first and last Tricks' },
  { id:'face_value',     name:'Face Value',          tier:'common',    desc:'Face cards (J/Q/K) score +20 pips', tags:['pips','card','rank','scores'] },
  { id:'king_guard',     name:'Men of Repute',       tier:'common',    desc:'Kings and Jacks score +10 pips and +5 mult', tags:['pips','mult','card','rank','scores'] },
  { id:'knave_power',    name:'Jackpot',              tier:'legendary', desc:'Score ×1.5 pips for each Jack on the grid', tags:['xpips','hand','rank','scores'] },
  { id:'humble_roots',   name:'Every Day Essentials', tier:'common',   desc:'Rank-6-and-below cards score their rank ×3 pips', tags:['pips','card','rank','scores'] },
  { id:'before_the_tide', name:'Gnomes',             tier:'epic',      desc:'Each rank 5 or lower card scored adds its rank in Focus', tags:['focus','card','rank'] },
  { id:'royal_trio',     name:'Heads of State',      tier:'epic',      desc:'A hand containing a King and one other Royal scores ×2 mult', tags:['xmult','hand','rank','scores'] },
  // ── Per-card pip bonuses ──
  { id:'rich_soil',      name:'Rich Soil',           tier:'common',    desc:'All cards score +3 mult', tags:['mult','card','scores'] },
  { id:'first_fruits',   name:'First Fruits',        tier:'rare',      desc:'Each card in the first hand each round permanently gains +5 pips', tags:['deck','pips','card','scaling','scores','start'] },
  { id:'sapling',        name:'Sapling',             tier:'rare',      retired:true, desc:'Each level, 3 cards permanently gain +5 pips', tags:['deck','pips','other','level','scaling','scores'] },   // r624 (owner): out of the pool
  // ── Timing ──
  { id:'early_bird',     name:'Early Bird',          tier:'common',    desc:'Hands played in the first third of the round score +20 pips per card', tags:['pips','card','clock','scores'] },
  { id:'night_owl',      name:'Night Owl',           tier:'common',    desc:'Hands played in the last third of the round score +10 mult per card', tags:['mult','card','clock','scores'] },
  { id:'closing_time',   name:'Near Extinction',     tier:'common',    desc:'In the last third of the round, each scored card replays', tags:['replay','card','clock','scores'] },
  { id:'quick_draw',     name:'Quick Draw',          tier:'common',    desc:'Hands played within 3 seconds of the previous hand add +1 to your Focus limit (max +10)', tags:['focus','hand','clock','scaling'] },
  { id:'patience_reward', name:'The Heron',          tier:'rare',      desc:'Adds mult equal to 2x the seconds passed since the last hand was played', tags:['mult','hand','clock','scores'] },
  { id:'first_play',     name:'Head Start',          tier:'rare',    desc:"The round's first hand adds +5 Focus; each hand after adds 1 less, down to 0", tags:['focus','hand'] },
  { id:'still_water',    name:'Eagle Eye',           tier:'rare',      desc:'Score +10 mult for every 10 seconds elapsed without using a swap', tags:['mult','hand','clock','scores'] },
  { id:'frozen_moment',  name:'The Falcon',          tier:'epic',      desc:'Hands played while the clock is paused add +10 Focus', tags:['focus','hand','pause'] },
  { id:'swift',          name:'The Swift',           tier:'rare',      desc:'+6 mult for every 10 seconds elapsed this round', tags:['mult','hand','clock','scores'] },
  { id:'cuckoo',         name:'The Cuckoo',          tier:'epic',      desc:'Every other hand pauses the clock for 1s for every 5 replays triggered this round', tags:['time','hand','replays'] },
  { id:'double_jeopardy', name:'Double Jeopardy',    tier:'epic',      desc:'2 cells are secretly marked at round start; the first time you score from those cells, pause the clock for 15s each', tags:['time','card','position'] },
  { id:'woodpecker',     name:'The Woodpecker',      tier:'rare',      desc:'Marks a random cell every 30 seconds; a card scored from the marked cell replays 2x', tags:['replay','card','position','clock','scores'] },
  { id:'hummingbird',    name:'The Hummingbird',     tier:'rare',      desc:'+3 mult for every clock pause or rewind triggered this game', tags:['mult','hand','pause','scores','scaling'] },
  { id:'albatross',      name:'The Albatross',       tier:'rare',      desc:'+10 pips for every second the clock has spent paused this round', tags:['pips','hand','pause','scores'] },
  { id:'vulture',        name:'The Vulture',         tier:'epic',      desc:'Cards discarded during the round’s first pause permanently gain a 3s pause (cannot stack from a single source)', tags:['deck','time','card','discard','pause','scaling'] },
  // ── Clock-mark Tricks (fire as the round clock passes static timestamps) ──
  { id:'ticktock',       name:'Tick-Tock',           tier:'common',    tags:['focus','other','clock'],     desc:'Every time the clock ends in a 0, gain +4 Focus' },
  { id:'quarter_chime',  name:'Quarter Chime',       tier:'rare',      tags:['pips','hand','clock','scores'],      desc:'Every time the clock passes a multiple of 15s, your next hand scores +60 pips' },
  { id:'minute_hand',    name:'Minute Hand',         tier:'rare',      tags:['xmult','hand','clock','scores'],      desc:'Every time the clock passes a multiple of 30s, your next hand scores ×2 mult' },
  { id:'second_hand',    name:'Second Hand',         tier:'common',    tags:['pips','mult','hand','clock','scores','chance'],      desc:'Every time the clock passes a multiple of 10s, your next hand scores either +20 mult or +30 pips' },
  { id:'hourglass',      name:'Hourglass',           tier:'epic',      tags:['deck','replay','other','clock','scores','scaling','chance'], desc:'Each time the clock passes a 60s mark, there is a 50% chance to give a random card on the grid +1 replay (permanent buff)' },
  { id:'sediment',       name:'Sediment',            tier:'rare',      tags:['pips','hand','clock','scores'],      desc:'Scores +10 pips for every 10 seconds elapsed this round' },
  { id:'kingfisher',     name:'The Kingfisher',      tier:'rare',      tags:['mult','hand','pause','scores'],      desc:'+2 mult for every 2 seconds the clock has been paused or rewound this round' },
  { id:'magpie',         name:'Hyperphagia',       tier:'epic',      tags:['time','hand','held'],  desc:'Each hand rewinds the clock 1s for every 2 swaps + discards you hold' },
  { id:'mockingbird',    name:'Traveler',            tier:'rare',      tags:['stock','hand','streak'],desc:'Every 4 hands you play without a same-type streak grants +1 swap' },
  { id:'starling',       name:'Type A',              tier:'rare',      tags:['stock','hand','streak'],desc:'Every 2nd hand of an unbroken same-type streak grants +1 discard' },
  { id:'phoenix',        name:'The Phoenix',         tier:'legendary',    desc:'While the clock is paused, the Focus multiplier applies twice (hands that trigger a pause count)', tags:['focus','hand','pause','scores'] },
  // ── Streaks ──
  { id:'kindling',       name:'Kindling',            tier:'common',    desc:'Same-hand streaks score +8 mult × the streak count', tags:['mult','hand','streak','scores'] },
  { id:'wildfire',       name:'Wildfire',            tier:'rare',      desc:'Reaching a same-hand streak of 3 adds +5 Focus', tags:['focus','hand','streak'] },
  { id:'echo_hand',      name:'Echoes',              tier:'common',    desc:'Playing the same hand type as the previous hand replays each card', tags:['replay','card','streak','scores'] },
  // ── Suit conditions ──
  { id:'club_double',    name:'Hard Labour',         tier:'legendary',    tags:['pips','card','suit','scores'], desc:'Each club scored this round adds more and more pips: doubles each time, starting at 1' },
  { id:'monochrome',     name:'Blood Diamonds',      tier:'epic',      desc:'Hands containing exclusively hearts AND diamonds score +25 mult and grant +5 credits but cost 10 seconds', tags:['mult','credits','hand','suit','scores','cost'] },
  { id:'full_color',     name:'Rainbow',             tier:'rare',      desc:'Hands with all four suits score x1.25 mult per card', tags:['xmult','card','suit','scores'] },
  { id:'balanced_diet',  name:'Balance',             tier:'rare',    desc:'Hands with exactly 2 suits score +10 mult per card', tags:['mult','card','suit','scores'] },
  // ── Number magic ──
  { id:'lucky_sevens',   name:'Lucky Sevens',        tier:'rare',      desc:'+5 Focus for each 7 scored or discarded', tags:['focus','card','rank','discard'] },
  { id:'ninesong',       name:'Threepeat',           tier:'epic',      desc:"If the hand's pip total is divisible by 3, one of the following happens: rewind the clock 9s, +27 mult, +9 Focus, or all three", tags:['time','mult','focus','hand','scores','chance'] },
  { id:'prime_time',     name:'Prime Time',          tier:'rare',      desc:'Prime-ranked cards (A,2,3,5,7) score +29 pips', tags:['pips','card','rank','scores'] },
  { id:'even_score',     name:'Get Even',            tier:'common',    desc:'Even-ranked cards score +16 pips', tags:['pips','card','rank','scores'] },
  { id:'odd_squad',      name:'Odd One In',          tier:'rare',      desc:'Odd-ranked cards score +7 mult', tags:['mult','card','rank','scores'] },
  // ── Rank diversity ──
  { id:'number_crunch',  name:'Diversity',           tier:'rare',      desc:'Hands with 4+ different ranks score +8 mult per card', tags:['mult','card','rank','scores'] },
  // ── Position ──
  { id:'rowcol_triple_pips', name:'Right Place',     tier:'common',    tags:['pips','card','position','scores','line'], desc:'Cards scored in a marked row or column score +25 pips' },
  { id:'rowcol_mult',    name:'Power Line',          tier:'common',    tags:['mult','card','position','scores','line'], desc:'Cards scored in a marked row or column score +15 mult' },
  { id:'rowcol_retrigger', name:'Echo Location',     tier:'rare',      tags:['replay','card','position','scores','chance','line'], desc:'Cards scored in a marked row or column have a 2 in 3 chance to replay' },
  { id:'perfect_timing', name:'Perfect Timing',      tier:'epic',      tags:['replay','card','position','scores','line'], desc:'Cards scored in a marked row or column replay once' },
  { id:'right_time',     name:'Right Time',          tier:'rare',      tags:['time','card','position','line'], desc:'Cards scored in a marked row or column pause the clock for 2s' },
  { id:'study_hall',     name:'Study Hall',          tier:'rare',      tags:['focus','card'], desc:'Every 2 cards scored adds +2 Focus' },
  { id:'rowcol_perm_double', name:'Ley Line',        tier:'epic',      tags:['deck','mult','card','position','scaling','scores'], desc:'Cards scored at the intersection of a row effect and a column effect permanently gain +2 mult' },
  { id:'shape_square',   name:'Hands of Blue',       tier:'epic',      tags:['mult','focus','hand','position','scores'], desc:'A 2×2 shaped hand scores +24 mult and adds +16 Focus' },
  { id:'shape_cross',    name:'Crossroads',          tier:'rare',      tags:['mult','focus','hand','position','size','scores'], desc:'A 5 card + shaped hand adds +25 Focus and +25 mult' },
  { id:'shape_line',     name:'Straight Shot',       tier:'epic',      tags:['mult','hand','position','size','scores'], desc:"5-card hands played in a straight line add every card's pip value to mult" },
  { id:'corner_retrigger', name:'Cornered',          tier:'rare',      tags:['xpips','card','position','clock','scores'], desc:'Corner cards score ×pips equal to the whole minutes left on the clock' },
  { id:'two_corners',    name:'Ornery',              tier:'epic',      tags:['xmult','card','position','scores'], desc:'Corner cards score ×2 mult' },
  { id:'edge_pips',      name:'On the Edge',         tier:'common',    tags:['pips','card','position','scores'], desc:'Cards scored on an edge score +15 pips' },
  { id:'wide_span_mult', name:'Inclusive',           tier:'rare',      tags:['mult','hand','position','scores'], desc:'Hands spanning the full width or height of the grid score +50 mult' },
  { id:'column_rush',    name:'Stand Up',            tier:'common',    retired:true, desc:'Hands with cards from only one column score +5 mult per card', tags:['mult','card','position','scores'] },
  { id:'row_power',      name:'Lie Down',            tier:'rare',    desc:'Hands with cards from only one row score +12 mult per card', tags:['mult','card','position','scores'] },
  // ── New position tricks (owner batch) ──
  { id:'groove',         name:'Groove',              tier:'rare',      tags:['focus','hand','position','line'], desc:'This trick scales +1 Focus for every 2 cards scored from a marked row or column. Resets each round.' },
  { id:'assembly_line',  name:'Assembly Line',       tier:'epic',      tags:['mult','card','position','scores','line'],  desc:'Cards scored in a marked row or column score +2 mult for every card played from that line last round (+1 in Flow, counting the last quarter)' },
  // ── r646 line Tricks (owner): a marked line, x pips / x mult / a forced fire / a prime / credits, a second line at the 5th improvement ──
  { id:'line_xpips',     name:'Live Wire',           tier:'epic',      tags:['xpips','card','position','scores','line'], desc:'Cards scored in a marked row or column score ×1.2 pips' },
  { id:'line_xmult',     name:'High Voltage',        tier:'epic',      tags:['xmult','card','position','scores','line'], desc:'Cards scored in a marked row or column score ×1.2 mult' },
  { id:'obligatory',     name:'Obligatory',          tier:'epic',      tags:['retrigger','card','position','tricks','chance','line'], desc:"Cards scored in a marked row or column have a 25% chance to force-trigger the Trick in the tray slot of that line's number" },
  { id:'suggestive',     name:'Suggestive',          tier:'epic',      tags:['retrigger','card','position','tricks','chance','line'], desc:"Cards scored in a marked row or column have a 35% chance to prime the Trick in the tray slot of that line's number" },
  { id:'coin_sword',     name:'Coin and the Sword',  tier:'rare',      tags:['credits','mult','card','position','chance','scores','line'], desc:'Cards scored in a marked row or column have a 10% chance to pay credits equal to the hand size and a 20% chance to score mult equal to 25% of your credits' },
  // ── r646 INSEPARABLE (js/inseparable.js): two owned Tricks fuse into one. Never offered; fused: true. ──
  { id:'lie_up',         name:'Lie Up',              tier:'epic',      fused:true, tags:['mult','hand','position','scores'], desc:'Hands with cards from only one row or only one column score +24 mult' },
  // r651 (owner): 21 more. `acts` = the fused Trick stands in for both parts (hasTrick, their BAL row through TB(), their line); the rest have their own scoring.
  { id:'well_adjusted',  name:'Well Adjusted',       tier:'epic',      fused:true, tags:['pips','mult','hand','scores'], desc:'Every hand scores +20 pips and +20 mult' },
  { id:'right_place_time', name:'Right Place & Time', tier:'epic',     fused:true, acts:['rowcol_triple_pips','right_time'], tags:['pips','time','card','position','scores','line'], desc:'Cards scored in a marked row or column score +25 pips and pause the clock for 2s' },
  { id:'short_circuit',  name:'Short Circuit',       tier:'epic',      fused:true, acts:['rowcol_mult','line_xpips'], tags:['mult','xpips','card','position','scores','line'], desc:'Cards scored in a marked row or column score +15 mult and ×1.2 pips' },
  { id:'advanced_interrogation', name:'Advanced Interrogation', tier:'epic', fused:true, acts:['line_xmult','obligatory'], tags:['xmult','retrigger','card','position','tricks','chance','scores','line'], desc:"Cards scored in a marked row or column score ×1.2 mult and have a 25% chance to force-trigger the Trick in the tray slot of that line's number" },
  { id:'love_of_money',  name:'Love of Money',       tier:'epic',      fused:true, acts:['obsessed','interest'], tags:['xmult','xpips','card','suit','held','scores'], desc:'Each heart applies x mult equal to 1 + (credits / 100); score ×1 pips, +0.1 for every 10 credits you hold, up to ×3' },
  { id:'penny_perfect',  name:'Penny Perfect',       tier:'epic',      fused:true, tags:['pips','mult','hand','discard','scaling','scores'], desc:'Every 9 cards discarded or played permanently adds +5 pips and +3 mult to this trick' },
  { id:'hurricane',      name:'Hurricane',           tier:'epic',      fused:true, acts:['overgrowth','long_road'], tags:['pips','mult','card','run','scores'], desc:'Runs score +20 pips and +10 mult per card' },
  { id:'riptide',        name:'Riptide',             tier:'epic',      fused:true, acts:['tide_table','undertow'], tags:['xmult','xpips','hand','run','scores'], desc:'Runs score ×1.25 mult, +×0.5 per Run scored this round, and ×2 pips, +×0.5 per card beyond 3' },
  { id:'encore_bang',    name:'Encore!',             tier:'epic',      fused:true, acts:['rerun','chorus'], tags:['xpips','xmult','card','replays','scores'], desc:'×1.25 pips and ×1.5 mult each time a card is replayed' },
  { id:'lidar',          name:'Lidar',               tier:'epic',      fused:true, acts:['rowcol_retrigger','perfect_timing'], tags:['replay','card','position','chance','scores','line'], desc:'Cards scored in a marked row or column replay once, with a 67% chance of a second replay' },
  { id:'erosion',        name:'Erosion',             tier:'epic',      fused:true, acts:['swift','sediment'], tags:['mult','pips','hand','clock','scores'], desc:'+6 mult and +10 pips for every 10 seconds elapsed this round' },
  { id:'seabird',        name:'Seabird',             tier:'epic',      fused:true, acts:['albatross','kingfisher'], tags:['pips','mult','hand','pause','scores'], desc:'+10 pips for every second the clock has spent paused this round, and +8 mult for every 2 seconds paused or rewound' },
  { id:'flood',          name:'Flood',               tier:'epic',      fused:true, acts:['dam_holding','high_water'], tags:['time','hand','run'], desc:'Runs pause the clock for 3s, plus 1s for each Run played this round' },
  { id:'relativity',     name:'Relativity',          tier:'epic',      fused:true, acts:['hourglass','sands_of_time'], tags:['pips','replay','hand','clock','chance','scores'], desc:'Score +pips equal to time remaining ÷ 2; each time the clock passes a 60s mark, 50% chance a random card on the grid gains +1 replay' },
  { id:'men_of_means',   name:'Men of Means',        tier:'epic',      fused:true, tags:['pips','mult','card','rank','scores'], desc:'Face cards (J/Q/K) score +30 pips and +20 mult' },
  { id:'omega_prime',    name:'OmegaPrime',          tier:'epic',      fused:true, acts:['prime_time','prime_times'], tags:['pips','retrigger','card','rank','tricks','scores'], desc:'Prime-ranked cards (A,2,3,5,7) score +29 pips and prime your leftmost Trick' },
  { id:'stranger_still', name:'Stranger Still',      tier:'epic',      fused:true, acts:['odd_squad','what_odds'], tags:['mult','xmult','card','rank','scores'], desc:'Odd-ranked cards score +7 mult, then x1.7 mult' },
  { id:'can_even',       name:'Can Even',            tier:'epic',      fused:true, acts:['even_score','even_better'], tags:['pips','xpips','card','rank','chance','scores'], desc:'Even-ranked cards score +16 pips and have a 66% chance to score x2.25 pips' },
  { id:'inferno',        name:'Inferno',             tier:'epic',      fused:true, acts:['kindling','wildfire'], tags:['mult','focus','hand','streak','scores'], desc:'Same-hand streaks score +8 mult × the streak count; reaching a streak of 3 adds +5 Focus' },
  { id:'serenity',       name:'Serenity',            tier:'epic',      fused:true, tags:['mult','focus','hand','position','scores'], desc:'A hand that is not a straight line scores +50 mult and adds +25 Focus' },
  { id:'working_class',  name:'Working Class',       tier:'epic',      fused:true, acts:['club_double','landfill'], tags:['pips','mult','card','suit','discard','swap','scaling','scores'], desc:'Each club scored this round adds more and more pips: doubles each time, starting at 1; score +4 mult for every swapped or discarded card this game' },
  { id:'overtime',       name:'Overtime',            tier:'rare',      tags:['time','hand','position','line'],  desc:'Every hand rewinds the clock 1s for every 3 cards you have scored from its marked row or column this round. The count resets each round.' },
  { id:'feng_shui',      name:'Feng Shui',           tier:'epic',      tags:['pips','hand','position','scores','scaling'],  desc:'Permanently scores +3 pips for each hand scored with a positional buff (row or column effects)' },
  { id:'clean_sweep',    name:'Clean Sweep',         tier:'epic',      tags:['focus','credits','hand','position'],           desc:'Use every cell of any row or column within two hands to add +8 Focus and +4 credits' },
  // ── Level scaling ──
  // r676 (owner; CHALLENGE_REWARDS.md section 7): becomes a random Trick each round (js/changing.js). Working name.
  { id:'changeling',     name:'Temp',                tier:'epic',    desc:'At the start of each round, becomes a random Trick of any rarity. Improvements apply to the Trick it becomes.', tags:['other','chance','start'] },
  { id:'middle_man',     name:'Middle Man',          tier:'rare',    desc:'Each time you gain or lose credits during a round, this gains +3 mult', tags:['mult','hand','scores','scaling'] },
  { id:'rising_tide',    name:'Rising Tide',         tier:'rare',    desc:'Each level you pass while holding this adds +5 to +10 mult to it', tags:['mult','hand','level','scores','scaling','chance'] },
  // ── Accumulating ──
  { id:'compound_mult',  name:'Compound',            tier:'epic',      desc:'Each hand played permanently adds +0.1 mult to this trick', tags:['mult','hand','scores','scaling'] },
  { id:'acorns',         name:'Acorns',              tier:'rare',      tags:['focus','hand','scaling'], desc:'Each card scored scales this trick +0.025 Focus, starting at +0; adds its whole-number Focus each hand' },
  { id:'plan_ahead',     name:'Plan Ahead',          tier:'rare',      tags:['focus','hand'], desc:'Every 3rd hand adds Focus equal to 2x your average hands per round' },
  { id:'fives_discard',  name:'Penny Saved',         tier:'rare',      tags:['pips','hand','rank','discard','scores','scaling'], desc:'Each 5 discarded or played permanently adds +5 pips to this trick' },
  { id:'nines_mult',     name:'Cloud Nine',          tier:'epic',      tags:['deck','mult','hand','rank','discard','scores','scaling','cost'], desc:'Adds 9 9s to your deck. Each 9 scored adds +2 mult to this trick. A 9 that scores or is discarded is destroyed; when none are left, this trick deletes itself' },
  { id:'tens_mult',      name:'Perfect Ten',         tier:'rare',      tags:['mult','hand','discard','scores','scaling'], desc:'Every 9 cards discarded or played permanently adds +3 mult to this trick' },
  { id:'sixes_perm',     name:'D6',                  tier:'epic',      tags:['deck','pips','mult','card','scaling','scores','chance'], desc:'Every 6th card scored permanently gains a random +1–6 pips or mult' },
  { id:'fours_perm',     name:'Middle Management',   tier:'common',    tags:['deck','pips','card','size','scaling','scores'], desc:'4-card hands permanently give the 4th card +8 pips' },
  { id:'twos_retrigger', name:'Double Take',         tier:'rare',      tags:['retrigger','card','rank','tricks'], desc:'Each 2 scored force triggers your rightmost Trick (other than this one)' },
  { id:'prime_times',    name:'Prime Times',         tier:'rare',      tags:['retrigger','card','rank','tricks'], desc:'Scoring prime-ranked cards (A,2,3,5,7) primes your leftmost Trick' },
  { id:'eights_retrigger', name:'Sideways to Infinity', tier:'rare',   tags:['replay','card','rank','scores'], desc:'Each scored 8 replays once for each other 8 in the hand' },
  { id:'queens_upgrade', name:'Royal Favour',        tier:'epic',      tags:['deck','card','rank','position','clock','scaling','cost'], desc:"Scoring a card adjacent to a Queen permanently increases that card's rank (after it scores). Queens are automatically discarded after they've been on the grid for 30 seconds" },
  { id:'aces_absorb',    name:'Ace Absorb',          tier:'legendary', tags:['deck','card','rank','scaling','chance','cost'], desc:'When an Ace scores, 50% chance to permanently remove one random unscoring card and add its buffs to the Ace (once per hand)' },
  { id:'monopoly',       name:'Monopoly',            tier:'legendary', tags:['deck','card','rank','position','scaling','cost'], modes:['spectrum'], desc:'When a 15 or a 20 scores, one random adjacent card is forgotten and its bonuses added to it (once per hand)' },
  // ── Situational pip ──
  { id:'sands_of_time',  name:'Sands of Time',       tier:'rare',      desc:'Score +pips equal to time remaining ÷ 2', tags:['pips','hand','clock','scores'] },
  { id:'discard_pips',   name:'Compost',             tier:'common',    tags:['mult','hand','discard','scores'], desc:'+4 mult per card discarded this round (+2 in Flow)' },
  { id:'spade_flood',    name:'Dark Matter',         tier:'epic',      tags:['pips','hand','suit','clock','scores'], desc:'All-Spade hands add the remaining round time as pips' },
  { id:'mirror',         name:'Mirror',              tier:'rare',      tags:['retrigger','hand','tricks'], desc:'Tap to tilt left or right; mimics the effect of the Trick it reflects.' },
  // ── Diverse conditions ──
  { id:'combo_score',    name:'Combo Score',         tier:'common',    desc:'+6 mult for every distinct hand type played this round', tags:['mult','hand','scores'] },
  { id:'move_as_one',    name:'Move as One',         tier:'epic',      retired:true, tags:['retrigger','hand','tricks'], desc:'If 2+ of your Tricks share a keyword, a random Trick sharing that keyword scores its effect a second time each time all of them are triggered' },
  // ── Reward-grid meta (r128) ──
  { id:'more_better',    name:'More Better',         tier:'common',    tags:['mult','hand','reward','scores','scaling'], desc:'Each reward grid where you select 3+ tiles permanently adds +9 mult to this trick' },
  { id:'rain_check',     name:'Rain Check',          tier:'epic',      retired:true, tags:['time','other','reward'],           desc:'Skipping a reward: the next round starts with +30s (in Flow, rewind the clock 30s)' },
  // ── Time / position (r128) ──
  { id:'temporal_rift',  name:'Temporal Rift',       tier:'epic',      tags:['retrigger','card','position','tricks'], desc:'A card scored where a row and column effect intersect force triggers the Trick in position 3' },
  // ── Risk / negative-tile scaling (r129) ──
  { id:'wild_side',      name:'Wild Side',           tier:'rare',      tags:['mult','hand','reward','scores','scaling'],    desc:'+6 mult, scaling, for every negative reward tile you take' },
  { id:'wait_for_it',    name:'Wait For Iiiit',      tier:'epic',      retired:true, tags:['replay','card','reward','level','scores','scaling','chance'],  desc:'Each negative reward tile taken this run gives every scored card a +3% chance to replay. In Flow: each level-up that pays a single reward gives +5% instead, Luck aside' },
  // ── Focus ──
  { id:'meditation',     name:'Meditation',          tier:'rare',    tags:['focus','other'], desc:'Focus decays 2 seconds slower' },
  { id:'tunnel_vision',  name:'Tunnel Vision',       tier:'common',    tags:['focus','other','start'], desc:'Start each round with 10 Focus' },
  { id:'first_wind',     name:'First Wind',          tier:'common',    tags:['focus','other','clock'], desc:'Focus does not decay for the first 45 seconds of a round' },
  { id:'rhythm',         name:'Rhythm',              tier:'common',    tags:['focus','hand'], desc:'Each hand played adds 2 additional Focus' },
  { id:'cull',           name:'Cull',                tier:'common',    tags:['focus','other','discard','swap'], desc:'Discarding or swapping adds +2 Focus per 2 remaining swaps and discards' },
  { id:'expanse',        name:'Expanse',             tier:'common',    tags:['focus','other','scaling','cost'], desc:'Each time you hit your Focus limit, increase it by 1 (max +10), then lose half your Focus' },
  { id:'kaleidoscope',   name:'Kaleidoscope',        tier:'epic',      tags:['focus','hand','suit','scores'], desc:'Apply the Focus multiplier a number of times equal to the number of suits in the hand' },
  { id:'flow_state',     name:'Flow State',          tier:'rare',      tags:['pips','card','scores','held'], desc:'While focus is ×1.5 or higher, score +15 pips per card' },
  { id:'hyper_focus',    name:'Hyper Focus',         tier:'rare',      tags:['mult','card','scores'], desc:'Each card scored adds mult equal to 2x your Focus multiplier' },
  // ── Legendary ──
  { id:'heartwood',      name:'Heartwood',           tier:'epic',      desc:'When scored, the center-most card gains +5 pips & +5 mult', tags:['deck','pips','mult','card','position','scaling','scores'] },
  // ── Combo batch (r83): payoffs / sleight-charge synergies ──
  { id:'landfill',       name:'Landfill',            tier:'epic',    tags:['mult','card','discard','swap','scores'],  desc:'Score +1 mult for every swapped or discarded card this game' },
  { id:'old_growth',     name:'Old Growth',          tier:'legendary',      tags:['mult','card','scores'],  desc:'Cards add their pip value to mult' },
  { id:'magician',       name:'Magician',            tier:'common',      tags:['pips','mult','hand','sleights','scores'],  desc:'+50 pips if you own no Sleights, or +6 mult for each Sleight you own' },
  { id:'stand_up',       name:'Stand-Up',            tier:'rare',      tags:['mult','card','position','scores'],  desc:'Hands with cards from only one column score +12 mult per card' },
  { id:'scalper',        name:'Scalper',             tier:'rare',      tags:['xmult','hand','sleights','scores'],  desc:'Score ×1 mult, +×0.25 per charge your Sleights are missing' },
  // ── 5-card-hand family (r103) ──
  { id:'five_stack',     name:'Five Stack',          tier:'legendary',    tags:['pips','mult','focus','card','size','scores'], desc:'Each card in a 5-card hand scores +20 pips, +5 mult, and +1 Focus' },
  { id:'little_guys',    name:'the little guys',     tier:'rare',      tags:['focus','hand','size','rank','scaling'],           desc:'A 5-card hand with no face cards increases your Focus limit by 1 (max +15)' },
  { id:'five_fodder',    name:'Five for Fodder',     tier:'common',    tags:['credits','other','discard'], desc:'Discarding a valid hand grants the hand size in credits' },
  { id:'five_second',    name:'Five Second Rule',    tier:'rare',      tags:['time','hand','size'],            desc:'5-card hands pause the clock for 5s' },
  // ── Focus-capacity & generation (r104) ──
  { id:'life_lessons',   name:'Life Lessons',        tier:'rare',      tags:['focus','other','level','scaling'],           desc:'Each round you complete increases your Focus limit by 1' },
  { id:'wellspring',     name:'Wellspring',          tier:'rare',      tags:['mult','hand','scores','scaling'], desc:'For every 30 Focus generated this game, this trick scores +1 mult' },
  // ── 3-card-hand family (r113) ──
  { id:'third_down',     name:'3rd Down',            tier:'rare',      tags:['focus','hand','size'],           desc:'3-card hands add +3 Focus' },
  { id:'ready_set_go',   name:'Ready, Set, Go',      tier:'common',    tags:['mult','hand','size','rank','scores'],            desc:'A 3-card hand containing a 3, 6 or 9 scores +18 mult' },
  { id:'third_charm',    name:"3rd Time's a Charm",  tier:'rare',      tags:['replay','card','scores'],          desc:'The 3rd card of a hand replays 2x' },
  // ── 4-card-hand family (r123) ──
  { id:'four_eyes',      name:'Four Eyes',           tier:'common',    tags:['mult','hand','size','scores'],            desc:'4-card hands score +24 mult' },
  { id:'four_by_four',   name:'4x4',                 tier:'common',    retired:true, tags:['pips','card','position','scores','line'], desc:'Cards scored in the 4th and 6th columns score +24 pips' },
  { id:'four_horseman',  name:'Four Horse-man',      tier:'epic',      tags:['pips','mult','focus','time','hand','size','scores','chance'], desc:'4-card hands grant a random bonus: +24 pips, +24 mult, +8 Focus, or pause the clock for 8s' },
  { id:'wait_four_it',   name:'Wait Four It',        tier:'rare',      tags:['deck','time','card','size','scaling'],            desc:'4-card hands permanently buff their 4th card with a 2s pause (cannot stack from this source)' },
  // ── Set add-ons (r124) ──
  { id:'undue_influence', name:'Undue Influence',    tier:'epic',      tags:['credits','hand','set','rank'],   desc:'A Set containing a face card grants credits equal to the number of Set hands you have played this round' },
  { id:'encore',          name:'Encore',             tier:'common',      tags:['replay','card','set','rank','scores'],    desc:'Odd-ranked cards in a set replay once' },
  { id:'shaky_foundation',name:'Shaky Foundation',   tier:'common',    tags:['mult','hand','set','scores'],      desc:'Every other Set scores +18 mult' },
  // ── r359: the 9.23 sheet's new Tricks ──
  { id:'obsessed',        name:'Obsessed',           tier:'legendary', tags:['xmult','card','suit','scores','held'], desc:'Each heart applies x mult equal to 1 + (credits / 100). 50 credits = x1.5' },
  { id:'buried_treasure', name:'Buried Treasure',    tier:'legendary', tags:['credits','card','suit','chance','held'], desc:'Each scored diamond has a chance equal to half your Luck to apply x1.1 to your credits' },
  { id:'relentless',      name:'Relentless',         tier:'legendary', tags:['xmult','card','suit','scores','scaling'], desc:'Each spade scores x0.05 mult for every spade scored since you took this (replays count). No effect until it passes x1' },
  { id:'patient_rulers',  name:'Patient Rulers',     tier:'epic',      tags:['xmult','card','rank','pause','scores'],   desc:'If you have paused or rewound the clock this round, face cards score x1.5 mult' },
  { id:'even_better',     name:'Even Better',        tier:'epic',      tags:['xpips','card','rank','scores','chance'],   desc:'Even-ranked cards have a 66% chance to score x2.25 pips' },
  { id:'what_odds',       name:'What are The Odds',  tier:'epic',      tags:['xmult','card','rank','scores'],          desc:'Odd-ranked cards score x1.7 mult' },
  { id:'critical',        name:'Critical',           tier:'epic',      tags:['xmult','hand','flush','scores'],          desc:'Flush type hands score x5 mult' },
  { id:'twinners',        name:'Twinners',           tier:'epic',      tags:['xpips','hand','set','scores'],            desc:'Set type hands score x3 pips' },
  { id:'feelin_lucky',    name:'Feelin Lucky',       tier:'epic',      tags:['xmult','card','rank','scores','chance','cost'],   desc:'Five randomly rolled ranks score x1.25 mult. Trying to sell this costs 30% of your credits and rerolls the ranks instead - 3 times, then it really sells' },
  { id:'marathon',        name:'Marathon',           tier:'epic',      tags:['focus','hand','run','scores'],           desc:'Run type hands apply the Focus multiplier 1 extra time(s)' },
  // ── Run add-ons (r124) ──
  { id:'dam_holding',    name:'Dam Holding…',        tier:'rare',      tags:['time','hand','run'],            desc:'Runs pause the clock for 3s' },
  { id:'wave_amp',       name:'Wave Amplification',  tier:'common',    tags:['pips','hand','run','streak','scores'],   desc:'Consecutively played Runs score +15 pips × the streak count' },
];

// ── Trick category → emoji ──
// One emoji per effect category (mirrors the section groupings in TRICK_POOL).
// Used on the reward-pick and shop cards so each Trick shows emoji + name, with
// the full description reserved for the tooltip. The emoji picks the Trick's
// pixel icon (tools/icons/manifest.js). r604 (owner): a theme in the NAME wins
// over the effect, so every bird is a bird and the Three / Four / Five Tricks
// wear their number; a Trick in no row falls back to the white sparkles.
const TRICK_CATEGORIES = [
  { emoji:'🪜', ids:['overgrowth','long_road','river_run','correct_run','tide_table','undertow','high_water','dam_holding','wave_amp'] }, // Runs
  { emoji:'👯', ids:['kindred','double_bloom','high_pair','rare_bloom','full_house_streak','pair_pips','two_pair_mult','richter','eye_of_storm','ripple','undue_influence','encore','shaky_foundation'] }, // Pairs / sets
  { emoji:'🎴', ids:['enriched','tidal_force','deluge','summit','light_touch','heavy_hand','blackjack_bonus'] }, // Flush / special hands
  { emoji:'👑', ids:['first_light','wild_heart','face_value','king_guard','knave_power','humble_roots','before_the_tide','royal_trio'] }, // Rank-specific
  { emoji:'🌱', ids:['rich_soil','first_fruits','sapling','old_growth'] }, // Per-card pips
  { emoji:'⏱️', ids:['closing_time','quick_draw','steady_pace','momentum','first_play','frozen_moment','ticktock','quarter_chime','minute_hand','second_hand','hourglass','sediment','magpie','mockingbird','starling','rain_check','deep_breath'] }, // Timing
  { emoji:'🔥', ids:['kindling','wildfire','echo_hand','hot_streak','rerun','chorus','inferno','encore_bang'] }, // Streaks
  { emoji:'🎨', ids:['club_double','monochrome','full_color','balanced_diet'] }, // Suit conditions
  { emoji:'🔢', ids:['lucky_sevens','ninesong','prime_time','even_score','odd_squad'] }, // Number magic
  { emoji:'🌈', ids:['number_crunch'] }, // Rank diversity
  { emoji:'⚗️', ids:['well_adjusted','love_of_money','penny_perfect','hurricane','riptide','erosion','seabird','flood','relativity','men_of_means','omega_prime','stranger_still','can_even','working_class'] }, // r651: the rest of the fused Tricks (their tiles draw both parts' icons, js/inseparable.js)
  { emoji:'📍', ids:['rowcol_triple_pips','rowcol_mult','rowcol_retrigger','perfect_timing','right_time','rowcol_perm_double','shape_square','shape_cross','shape_line','corner_retrigger','two_corners','edge_pips','wide_span_mult','column_rush','row_power','groove','assembly_line','overtime','feng_shui','clean_sweep','temporal_rift','stand_up','double_jeopardy','line_xpips','line_xmult','obligatory','suggestive','coin_sword','lie_up','right_place_time','short_circuit','advanced_interrogation','lidar','serenity'] }, // Position
  { emoji:'📈', ids:['rising_tide'] }, // Level scaling
  { emoji:'🧮', ids:['middle_man','interest','portfolio','compound_mult','acorns','plan_ahead','more_better','fives_discard','nines_mult','tens_mult','sixes_perm','fours_perm','twos_retrigger','prime_times','eights_retrigger','queens_upgrade','aces_absorb','monopoly'] }, // Accumulating
  { emoji:'🎲', ids:['sands_of_time','discard_pips','spade_flood','mirror','wild_side','wait_for_it'] }, // Situational pip
  { emoji:'🔀', ids:['combo_score','move_as_one'] }, // Diverse conditions
  { emoji:'🎯', ids:['study_hall','meditation','tunnel_vision','first_wind','rhythm','cull','expanse','kaleidoscope','flow_state','hyper_focus','overclock','release_valve','life_lessons','wellspring'] }, // Focus
  { emoji:'⭐', ids:['heartwood'] }, // Legendary misc
  { emoji:'💎', ids:['obsessed','buried_treasure','relentless','patient_rulers','even_better','what_odds','critical','twinners','marathon','feelin_lucky'] }, // r359 multipliers
  { emoji:'🐦', ids:['swift','cuckoo','woodpecker','hummingbird','albatross','vulture','phoenix','early_bird','night_owl','patience_reward','still_water','kingfisher'] }, // Birds (by name)
  { emoji:'3️⃣', ids:['third_down','ready_set_go'] }, // 3-card hands
  { emoji:'4️⃣', ids:['four_eyes','four_horseman','wait_four_it'] }, // 4-card hands
  { emoji:'5️⃣', ids:['five_stack','five_fodder','five_second','little_guys'] }, // 5-card hands
  { emoji:'🪄', ids:['magician','scalper'] }, // Sleights
  { emoji:'🗑️', ids:['landfill'] }, // Discards and swaps
  { emoji:'🦎', ids:['changeling'] }, // r676: changes every round (its tile shows the form's icon while it has one)
];
const TRICK_EMOJI = {};
TRICK_CATEGORIES.forEach(cat => cat.ids.forEach(id => { TRICK_EMOJI[id] = cat.emoji; }));
function trickEmoji(trick) {
  if (trick && trick.id === 'changeling' && trick._form) return TRICK_EMOJI[trick._form] || '✦';   // r676: Temp wears its form's icon
  return (trick && TRICK_EMOJI[trick.id]) || '✦';
}

// r624 (owner): what a Trick needs before it can pay. `size` is the hand size it
// asks for; `hand` a hand type that has to be unlocked. offerWeightMult (js/luck.js)
// halves the offer weight of one you cannot play yet.
const TRICK_NEEDS = {
  four_eyes: { size: 4 }, four_horseman: { size: 4 }, wait_four_it: { size: 4 }, fours_perm: { size: 4 },
  number_crunch: { size: 4 }, full_color: { size: 4 }, kaleidoscope: { size: 4 },
  heavy_hand: { size: 5 }, five_stack: { size: 5 }, five_second: { size: 5 }, little_guys: { size: 5 },
  shape_cross: { size: 5 }, shape_line: { size: 5 },
  enriched: { hand: 'Flush' }, tidal_force: { hand: 'Flush' }, deluge: { hand: 'Flush' }, critical: { hand: 'Flush' },
};

// ── Mode entity filter (Spectrum) ─────────────────────────────────────────────
// Spectrum's deck has no Ace, no J/Q/K and no ♠♥♦♣, so a handful of Tricks are
// simply dead there (or, worse, free - "little guys" wants a 5-card hand with no
// face cards, which is EVERY hand). They're pulled out of the pool for that mode
// so the player is never offered one.
//
// Rather than patch the dozen places that draw from TRICK_POOL (reward grid,
// events, shop, Mart, wheel, survival, dev panel…), the pool ARRAY ITSELF is
// re-filled in place at startGame: every reader shares the one array reference,
// so they all see the mode's pool with no call-site changes. TRICK_POOL_ALL keeps
// the pristine list so switching back to a classic mode restores it.
const TRICK_POOL_ALL = [...TRICK_POOL];
const NUMERIC_BANNED_TRICKS = new Set([
  // Ace / court-card dependent - those ranks don't exist in Spectrum
  'first_light', 'wild_heart', 'face_value', 'king_guard', 'knave_power',
  'royal_trio', 'queens_upgrade', 'aces_absorb', 'undue_influence', 'little_guys',
  // Named-suit dependent - Spectrum has colours, not ♠♥♦♣
  'club_double', 'monochrome', 'spade_flood', 'obsessed', 'buried_treasure', 'relentless', 'patient_rulers',
]);
// Colour-COUNT tricks (Rainbow = 4 distinct, Balance = exactly 2, Kaleidoscope =
// 4+) still work as written, so they stay in.
// A Trick may also be EXCLUSIVE to a mode via `modes:['spectrum']` - Monopoly is
// Spectrum's stand-in for Ace Absorb (same effect, on 15s and 20s), so it must not
// leak into the classic pools.
// Which mode ids an entity's `modes` list should be matched against. It is the
// running mode's own id, PLUS a tag for the deck it is playing on (r234).
//
// A Trick gated to 'spectrum' is gated to the SPECTRUM DECK, not to the mode that
// happens to be named after it - Monopoly triggers on the 15 and the 20, which any
// numeric deck has. Matching on the bare id made a picker-built run on the colour
// deck the one place in the game those Tricks are unobtainable.
function modeEntityTags() {
  const m = (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) ? ACTIVE_MODE : null;
  const tags = new Set([m ? m.id : 'normal']);
  if (m && m.numeric) tags.add('spectrum');
  if (m && (typeof runSuitCount === 'function' ? runSuitCount() : m.suitCount) === 6) tags.add('sixsuits');
  return tags;
}

function applyModeEntityFilter() {
  const tags  = modeEntityTags();
  const banned = isNumericMode() ? NUMERIC_BANNED_TRICKS
               : (typeof climbActive === 'function' && climbActive()) ? CLIMB_BANNED_TRICKS : null;
  // `retired` (r539): kept in TRICK_POOL_ALL so a saved run that owns it still
  // draws and scores it, never offered again (Stand Up duplicated Stand-Up).
  const keep = TRICK_POOL_ALL.filter(t =>
    !t.retired && !(banned && banned.has(t.id)) && (!t.modes || t.modes.some(id => tags.has(id)))
    && !(typeof trickLocked === 'function' && trickLocked(t.id))   // r706: a locked Trick is never offered
  );
  TRICK_POOL.length = 0;
  keep.forEach(t => TRICK_POOL.push(t));
}
function trickBannedInMode(id) {
  if (typeof climbActive === 'function' && climbActive()) return CLIMB_BANNED_TRICKS.has(id);
  return isNumericMode() && NUMERIC_BANNED_TRICKS.has(id);
}
// Climb (r398) has real suits but no Aces and no courts, so only the rank half
// of Spectrum's list applies.
const CLIMB_BANNED_TRICKS = new Set([
  'first_light', 'wild_heart', 'face_value', 'king_guard', 'knave_power',
  'royal_trio', 'queens_upgrade', 'aces_absorb', 'undue_influence', 'little_guys',
  'court_of_leaves', 'patient_rulers',
]);

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let gridData = [];        // gridData[row][col] = { rank, suit, permPips, permMult }
let selected = [];        // array of [row,col] in order
let animating = false;
let falling = false;   // true during card fall animations - allows selection, queues play/discard
let pendingAction = null; // 'play' | 'discard' - queued while falling
let pendingDiscardCards = null; // the cards a queued discard was pressed on (runQueuedDiscard)
let dealPhase = false; // true while deal anims are running - suppresses render() card placement

let score = 0;      // current round's score - resets to 0 at the start of every round
let totalScore = 0; // lifetime total banked from completed rounds; display-only (end-of-run screens)
// The round just finished, and the goal it was measured against. Written by
// triggerLevelUp at the moment it banks and zeroes `score`, read by the
// between-rounds score panel (js/hud.js). Display-only; nothing scores off them.
let lastRoundScore = 0;
let lastRoundGoal  = 0;
let roundGoal = BASE_GOAL;      // this round's score target, from zero
let level = 1;

// ── Focus Meter (formerly Fate Meter) ──
let focusNodes      = 0;   // current accumulated focus (resets each round)
