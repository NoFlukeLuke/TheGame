const TRICK_POOL = [
  // ── Runs ──
  { id:'overgrowth',     name:'Cascade',             tier:'common',    desc:'Runs score +10 pips per card' },
  { id:'long_road',      name:'Storm',               tier:'common',    desc:'Runs score +2 mult per card' },
  { id:'river_run',      name:'Torrent',             tier:'rare',      desc:'Runs add +1 Focus per card' },
  { id:'correct_run',    name:'Rogue Wave',          tier:'rare',    desc:'Runs played in correct sequential order score one of the following: +80 pips, +20 mult, +10 Focus' },
  { id:'tide_table',     name:'Tide Table',          tier:'epic',      desc:'Runs score ×1 mult, +×0.25 per Run scored this round' },
  { id:'undertow',       name:'Undertow',            tier:'epic',      desc:'Runs score ×1.5 pips, +×0.5 per card beyond 3' },
  { id:'high_water',     name:'High Water',          tier:'epic',      desc:'Runs pause the clock for 1 second for each Run played this round' },
  // ── Multiplier batch (r179) ──
  // ×pips and ×mult on triggers the pools had never covered: replays, a held clock,
  // credits, buffed cards on the grid, and the Focus level itself. Every one of them
  // reads in the PIPS or MULT chip, which a ×score never did.
  { id:'rerun',       name:'Rerun',       tier:'epic',   desc:'×1.2 pips each time a card is replayed' },
  { id:'chorus',      name:'Chorus',      tier:'epic',   desc:'×1.75 mult each time a card is replayed' },
  { id:'deep_breath', name:'Deep Breath', tier:'rare',   desc:'Score ×2 pips while the clock is paused' },
  { id:'interest',    name:'Interest',    tier:'rare',   desc:'Score ×1 pips, +0.1 for every 10 credits you hold, up to ×3' },
  { id:'portfolio',   name:'Portfolio',   tier:'epic',   desc:'Score ×1 mult, +×0.15 for every card on the grid with a buff' },
  // ── Focus RATE batch (r180) - see focusRateMods() in js/focus-config.js ──
  { id:'overclock',     name:'Overclock',     tier:'epic', desc:'The Focus speed bonus is multiplied by 2.' },
  // ── Pairs / sets ──
  { id:'kindred',        name:'Quake',               tier:'common',    desc:'Sets score +5 mult per card in the largest set' },
  { id:'double_bloom',   name:'Magnitude',           tier:'epic',      desc:'Hands containing a pair score ×1.5 mult' },
  { id:'high_pair',      name:'Resonance',           tier:'rare',      desc:'Pairs and Two Pairs containing a 2 or 4 add +2 Focus per card' },
  { id:'rare_bloom',     name:'Bedrock',             tier:'epic',      desc:'Four of a Kind permanently buffs its 4 cards +8 pips each' },
  { id:'full_house_streak', name:'Collapsing Columns', tier:'epic',  desc:'Full Houses score +10 Focus' },
  { id:'pair_pips',      name:'Aftershock',          tier:'common',    desc:'Two Pair scores ×2 pips' },
  { id:'two_pair_mult',  name:'Double Dutch',        tier:'epic',      desc:'Play 3 hands with a pair within 30s to add +16 Focus' },
  { id:'richter',        name:'Richter',             tier:'legendary', desc:'Four of a Kind scores ×3 mult and +10 Focus' },
  { id:'eye_of_storm',   name:'Eye of the Storm',    tier:'epic',      desc:'Hands played in the middle third of the round replay the highest-ranked card(s) 2x' },
  { id:'ripple',         name:'Ripple',              tier:'rare',      desc:'Cards adjacent in rank to another card in the hand have a 50% chance to replay' },
  // ── Flush / special hand types ──
  { id:'enriched',       name:'Enriched',            tier:'common',    desc:'Flushes score +100 pips' },
  { id:'tidal_force',    name:'Tidal Forces',        tier:'common',    desc:'Flushes score +5 mult per card' },
  { id:'deluge',         name:'Deluge',              tier:'rare',      desc:'Flushes add +5 seconds to the clock' },
  { id:'summit',     name:'Unsummit',   tier:'common', desc:'The highest-ranking card in each hand scores +(level x 2) pips.' },
  { id:'light_touch',    name:'Nimble',              tier:'common',    desc:'2-card hands score +10 mult' },
  { id:'release_valve',  name:'Release Valve',       tier:'rare',      desc:'Each time you hit your Focus limit, gain +1 swap and +1 discard and lose 16 Focus.' },
  { id:'heavy_hand',     name:'Full Load',           tier:'rare',      desc:'5-card hands score +10 pips per card' },
  { id:'blackjack_bonus', name:'Twenty-One',         tier:'legendary', desc:'If the face values of your cards total exactly 21, score ×3 pips' },
  // ── Rank-specific pips / mult ──
  { id:'first_light',    name:'First Light',         tier:'common',    desc:'Aces score 21 pips' },
  { id:'wild_heart',     name:'Inspirato',           tier:'epic',      desc:'When an Ace scores, prime your first and last Tricks' },
  { id:'face_value',     name:'Face Value',          tier:'common',    desc:'Face cards (J/Q/K) score +10 pips' },
  { id:'king_guard',     name:'Men of Repute',       tier:'common',    desc:'Kings and Jacks score +5 pips and +5 mult' },
  { id:'knave_power',    name:'Jackpot',              tier:'legendary', desc:'Score ×2 pips for each Jack on the grid' },
  { id:'humble_roots',   name:'Every Day Essentials', tier:'rare',     desc:'Rank-6-and-below cards score their rank ×3 pips' },
  { id:'before_the_tide', name:'Gnomes',             tier:'epic',      desc:'Each rank 5 or lower card scored adds its rank in Focus' },
  { id:'royal_trio',     name:'Heads of State',      tier:'epic',      desc:'A hand containing a King and one other Royal scores ×2 mult' },
  // ── Per-card pip bonuses ──
  { id:'rich_soil',      name:'Rich Soil',           tier:'common',    desc:'All cards score +1 mult' },
  { id:'first_fruits',   name:'First Fruits',        tier:'rare',      desc:'Each card in the first hand each round permanently gains +3 pips' },
  { id:'sapling',        name:'Sapling',             tier:'rare',      desc:'Each level, 3 cards permanently gain +5 pips' },
  // ── Timing ──
  { id:'early_bird',     name:'Early Bird',          tier:'common',    desc:'Hands played in the first third of the round score +5 pips per card' },
  { id:'night_owl',      name:'Night Owl',           tier:'common',    desc:'Hands played in the last third of the round score +3 mult per card' },
  { id:'closing_time',   name:'Near Extinction',     tier:'rare',      desc:'In the last third of the round, each scored card replays' },
  { id:'quick_draw',     name:'Quick Draw',          tier:'common',    desc:'Hands played within 2 seconds of the previous hand add +1 to your Focus limit (max +10)' },
  { id:'patience_reward', name:'The Heron',          tier:'rare',      desc:'Hands played 15+ seconds after the previous hand score +10 mult' },
  { id:'first_play',     name:'Head Start',          tier:'rare',    desc:'The round\'s first hand adds +5 Focus; each hand after adds 1 less, down to 0' },
  { id:'still_water',    name:'Eagle Eye',           tier:'rare',      desc:'Score +5 mult for every 10 seconds elapsed without using a swap' },
  { id:'frozen_moment',  name:'The Falcon',          tier:'epic',      desc:'Hands played while the clock is paused add +10 Focus' },
  { id:'swift',          name:'The Swift',           tier:'rare',      desc:'+5 mult for every 10 seconds elapsed this round' },
  { id:'cuckoo',         name:'The Cuckoo',          tier:'epic',      desc:'Every other hand pauses the clock for 1 second for every 5 replays triggered this round' },
  { id:'double_jeopardy', name:'Double Jeopardy',    tier:'epic',      desc:'2 cells are secretly marked at round start; the first time you score from those cells, pause the clock for 15 seconds each' },
  { id:'woodpecker',     name:'The Woodpecker',      tier:'rare',      desc:'Marks a random card once every 30 seconds; scoring the marked card replays it 2x' },
  { id:'hummingbird',    name:'The Hummingbird',     tier:'rare',      desc:'+2 mult for every clock pause or rewind triggered this game' },
  { id:'albatross',      name:'The Albatross',       tier:'rare',      desc:'+5 pips for every second the clock has spent paused this round' },
  { id:'vulture',        name:'The Vulture',         tier:'epic',      desc:'Cards discarded during the round’s first pause permanently gain +3s pause when scored (time buffs do not stack)' },
  // ── Clock-mark Tricks (fire as the round clock passes static timestamps) ──
  { id:'ticktock',       name:'Tick-Tock',           tier:'common',    tags:['time','focus'],     desc:'Every time the clock ends in a 0, gain +2 Focus' },
  { id:'quarter_chime',  name:'Quarter Chime',       tier:'rare',      tags:['time','pips'],      desc:'Every time the clock passes a multiple of 15s, your next hand scores +45 pips' },
  { id:'minute_hand',    name:'Minute Hand',         tier:'rare',      tags:['time','mult'],      desc:'Every time the clock passes a multiple of 30s, your next hand scores ×2 mult' },
  { id:'second_hand',    name:'Second Hand',         tier:'common',    tags:['time','pips'],      desc:'Every time the clock passes a multiple of 10s, your next hand scores either +5 mult or +10 pips' },
  { id:'hourglass',      name:'Hourglass',           tier:'epic',      tags:['time','retrigger'], desc:'Each time the clock passes a minute mark, there is a 50% chance to give a random card on the grid +1 replay' },
  { id:'sediment',       name:'Sediment',            tier:'rare',      tags:['time','pips'],      desc:'Scores +10 pips for every 10 seconds elapsed this round' },
  { id:'kingfisher',     name:'The Kingfisher',      tier:'rare',      tags:['time','mult'],      desc:'+1 mult for every 2 seconds the clock has been paused or rewound this round' },
  { id:'magpie',         name:'Hoarder House',       tier:'epic',      tags:['time','resource'],  desc:'Each hand rewinds the clock 1 second for every 2 swaps + discards you hold' },
  { id:'mockingbird',    name:'Traveler',            tier:'rare',      tags:['resource','streak'],desc:'Every 4 hands you play without a same-type streak grants +1 swap' },
  { id:'starling',       name:'Type A',              tier:'rare',      tags:['resource','streak'],desc:'Every 2nd hand of an unbroken same-type streak grants +1 discard' },
  { id:'phoenix',        name:'The Phoenix',         tier:'legendary',    desc:'While the clock is paused, the Focus multiplier applies twice (hands that trigger a pause count)' },
  // ── Streaks ──
  { id:'kindling',       name:'Kindling',            tier:'common',    desc:'Same-hand streaks score +4 mult × the streak count' },
  { id:'wildfire',       name:'Wildfire',            tier:'rare',      desc:'Reaching a same-hand streak of 3 adds +5 Focus' },
  { id:'echo_hand',      name:'Echoes',              tier:'common',    desc:'Playing the same hand type as the previous hand replays each card' },
  // ── Suit conditions ──
  { id:'club_double',    name:'Hard Labour',         tier:'legendary',    tags:['suit','pips'], desc:'Each club scored this round adds more and more pips: doubles each time, starting at 1' },
  { id:'monochrome',     name:'Blood Diamonds',      tier:'epic',      desc:'Hands containing exclusively hearts AND diamonds grant +5 credits but cost 10 seconds' },
  { id:'full_color',     name:'Rainbow',             tier:'rare',      desc:'Hands with all four suits score +16 pips and +16 mult per card' },
  { id:'balanced_diet',  name:'Balance',             tier:'common',    desc:'Hands with exactly 2 suits score +5 mult per card' },
  // ── Number magic ──
  { id:'lucky_sevens',   name:'Lucky Sevens',        tier:'rare',      desc:'+3 Focus for each 7 scored or discarded' },
  { id:'ninesong',       name:'Threepeat',           tier:'epic',      desc:"If the hand's pip total is divisible by 3, one of the following happens: rewind 9 seconds, +9 mult, +9 Focus" },
  { id:'prime_time',     name:'Prime Time',          tier:'rare',      desc:'Hands with 3+ prime-ranked cards (A,2,3,5,7) score +23 pips per card' },
  { id:'even_score',     name:'Get Even',            tier:'common',    desc:'Even-ranked cards score +4 pips' },
  { id:'odd_squad',      name:'Odd One In',          tier:'rare',      desc:'Odd-ranked cards score +3 mult' },
  // ── Rank diversity ──
  { id:'number_crunch',  name:'Diversity',           tier:'rare',      desc:'Hands with 4+ different ranks score +5 mult per card' },
  // ── Position ──
  { id:'rowcol_triple_pips', name:'Right Place',     tier:'common',    tags:['pips','position'], desc:'Cards scored in a marked row or column score +10 pips' },
  { id:'rowcol_mult',    name:'Power Line',          tier:'common',    tags:['mult','position'], desc:'Cards scored in a marked row or column score +5 mult' },
  { id:'rowcol_retrigger', name:'Echo Location',     tier:'rare',      tags:['replay','position'], desc:'Cards scored in a marked row or column have a 2 in 3 chance to replay' },
  { id:'perfect_timing', name:'Perfect Timing',      tier:'epic',      tags:['replay','position'], desc:'Cards scored in a marked row or column replay once' },
  { id:'right_time',     name:'Right Time',          tier:'rare',      tags:['time','position'], desc:'Each card scored in a marked row or column pauses the clock 2 seconds' },
  { id:'study_hall',     name:'Study Hall',          tier:'rare',      tags:['focus'], desc:'Every 2 cards you score adds +1 Focus' },
  { id:'rowcol_perm_double', name:'Ley Line',        tier:'epic',      tags:['mult','position','scaling'], desc:'Cards scored at the intersection of a row effect and a column effect permanently gain +1 mult' },
  { id:'shape_square',   name:'Hands of Blue',       tier:'epic',      tags:['position','shape','focus'], desc:'A 2×2 shaped hand adds +16 Focus' },
  { id:'shape_cross',    name:'Crossroads',          tier:'rare',      tags:['position','shape','focus'], desc:'A + shaped hand adds +25 Focus' },
  { id:'shape_line',     name:'Straight Shot',       tier:'epic',      tags:['position','shape','mult'], desc:"5-card hands played in a straight line add every card's pip value to mult" },
  { id:'corner_retrigger', name:'Cornered',          tier:'rare',      tags:['position','pips'], desc:'Corner cards score ×pips equal to the whole minutes left on the clock' },
  { id:'two_corners',    name:'Stretch',             tier:'epic',      tags:['position','mult'], desc:'When a hand has 2 or more corner cards, each corner card scores ×4 mult' },
  { id:'edge_pips',      name:'On the Edge',         tier:'common',    tags:['position','pips'], desc:'Hands where all cards are on an edge score +15 pips per card' },
  { id:'wide_span_mult', name:'Inclusive',           tier:'rare',      tags:['position','mult'], desc:'Hands spanning the full width or height of the grid score +25 mult' },
  { id:'column_rush',    name:'Stand Up',            tier:'common',    desc:'Hands with cards from only one column score +5 mult per card' },
  { id:'row_power',      name:'Lie Down',            tier:'rare',    desc:'Hands with cards from only one row score +10 mult per card' },
  // ── New position tricks (owner batch) ──
  { id:'groove',         name:'Groove',              tier:'rare',      tags:['focus','position','scaling'], desc:'This trick scales +1 Focus for every 2 cards scored from a marked row or column. Resets each round.' },
  { id:'assembly_line',  name:'Assembly Line',       tier:'epic',      tags:['mult','position','scaling'],  desc:'Cards scored in a marked row or column score +1 mult for every card played from that line this round' },
  { id:'overtime',       name:'Overtime',            tier:'rare',      tags:['time','position','scaling'],  desc:'Every hand rewinds the clock 1 second for every 3 cards you have scored from its marked row or column this round. The count resets each round.' },
  { id:'feng_shui',      name:'Feng Shui',           tier:'epic',      tags:['pips','position','scaling'],  desc:'Scores +3 pips, +3 more for each hand scored with a row or column buff' },
  { id:'clean_sweep',    name:'Clean Sweep',         tier:'epic',      tags:['focus','position'],           desc:'Use every cell of any row or column within two hands to add +5 Focus and +5 credits' },
  // ── Level scaling ──
  { id:'rising_tide',    name:'Rising Tide',         tier:'common',    desc:'Score +1 mult, +1 more for each level reached' },
  // ── Accumulating ──
  { id:'compound_mult',  name:'Relentless',          tier:'epic',      desc:'Each hand played permanently adds +0.05 mult to this trick' },
  { id:'acorns',         name:'Acorns',              tier:'epic',      tags:['focus','scaling'], desc:'Each card scored scales this trick +0.1 Focus, starting at +0; grants its whole-number Focus each hand' },
  { id:'plan_ahead',     name:'Plan Ahead',          tier:'rare',      tags:['focus','scaling'], desc:'Every 3rd hand adds Focus equal to your average hands per round' },
  { id:'fives_discard',  name:'Penny Saved',         tier:'rare',      tags:['scaling','pips','value'], desc:'Each 5 discarded or played permanently adds +5 pips to this trick' },
  { id:'nines_mult',     name:'Cloud Nine',          tier:'epic',      tags:['scaling','mult','value'], desc:'Each 9 scored permanently adds +9 mult to this trick' },
  { id:'tens_mult',      name:'Perfect Ten',         tier:'rare',      tags:['scaling','mult','value'], desc:'Every 9 cards discarded permanently adds +3 mult to this trick' },
  { id:'sixes_perm',     name:'D6',                  tier:'epic',      tags:['scaling','pips','value'], desc:'Every 6th card scored permanently gains a random +1–6 pips' },
  { id:'fours_perm',     name:'Middle Management',   tier:'common',    tags:['scaling','pips','value'], desc:'4-card hands permanently give the 4th card +4 pips' },
  { id:'twos_retrigger', name:'Double Take',         tier:'rare',      tags:['retrigger','value'], desc:'Each 2 scored force triggers your rightmost Trick' },
  { id:'prime_times',    name:'Prime Times',         tier:'rare',      tags:['retrigger','prime'], desc:'Scoring prime-ranked cards (A,2,3,5,7) primes your leftmost Trick' },
  { id:'eights_retrigger', name:'Sideways to Infinity', tier:'rare',   tags:['retrigger','value'], desc:'Each scored 8 replays once for each other 8 in the hand' },
  { id:'queens_upgrade', name:'Royal Favour',        tier:'epic',      tags:['scaling','grid','value'], desc:'Scoring a card adjacent to a Queen permanently increases that card\'s rank (after it scores). Queens are automatically discarded after they\'ve been on the grid for 45 seconds' },
  { id:'aces_absorb',    name:'Ace Absorb',          tier:'legendary', tags:['scaling','value'], desc:'When an Ace scores, 50% chance to permanently remove one random unscoring card and add its buffs to the Ace (once per hand)' },
  { id:'monopoly',       name:'Monopoly',            tier:'legendary', tags:['scaling','value'], modes:['spectrum'], desc:'When a 15 or a 20 scores, one random adjacent card is forgotten and its bonuses added to it (once per hand)' },
  // ── Situational pip ──
  { id:'sands_of_time',  name:'Sands of Time',       tier:'rare',      desc:'Score +pips equal to time remaining ÷ 2' },
  { id:'discard_pips',   name:'Compost',             tier:'common',    tags:['pips','discard'], desc:'+2 mult per card discarded this round' },
  { id:'spade_flood',    name:'Dark Matter',         tier:'epic',      tags:['suit','pips'], desc:'All-Spade hands add the remaining round time as pips' },
  { id:'mirror',         name:'Mirror',              tier:'rare',      tags:['utility'], desc:'Tap to tilt left or right; mimics the effect of the Trick it reflects.' },
  // ── Diverse conditions ──
  { id:'combo_score',    name:'Combo Score',         tier:'common',    desc:'+4 mult for every distinct hand type played this round' },
  { id:'move_as_one',    name:'Move as One',         tier:'epic',      tags:['synergy'], desc:'If 3+ of your Tricks share a keyword, a random Trick sharing that keyword scores its effect a second time' },
  // ── Reward-grid meta (r128) ──
  { id:'more_better',    name:'More Better',         tier:'common',    tags:['mult','scaling'], desc:'Each reward grid where you select 3+ tiles permanently adds +5 mult to this trick' },
  { id:'rain_check',     name:'Rain Check',          tier:'epic',      tags:['time'],           desc:'Skipping a reward adds +30 seconds to your next round (in Flow, to the timer)' },
  // ── Time / position (r128) ──
  { id:'temporal_rift',  name:'Temporal Rift',       tier:'epic',      tags:['time','position','scaling'], desc:'A card scored where a row and column effect intersect gains +3s rewind when scored (time buffs do not stack)' },
  // ── Risk / negative-tile scaling (r129) ──
  { id:'wild_side',      name:'Wild Side',           tier:'rare',      tags:['mult','scaling','risk'],    desc:'+6 mult, scaling, for every negative reward tile you take' },
  { id:'wait_for_it',    name:'Wait For Iiiit',      tier:'epic',      tags:['replay','scaling','risk'],  desc:'Each negative reward tile taken this run gives every scored card a +2% chance to replay' },
  // ── Focus ──
  { id:'meditation',     name:'Meditation',          tier:'rare',    tags:['focus'], desc:'Focus decays 2 seconds slower' },
  { id:'tunnel_vision',  name:'Tunnel Vision',       tier:'common',    tags:['focus'], desc:'Start each round with 5 focus' },
  { id:'first_wind',     name:'First Wind',          tier:'common',    tags:['focus'], desc:'Focus does not decay for the first 45 seconds of a round' },
  { id:'rhythm',         name:'Rhythm',              tier:'common',    tags:['focus'], desc:'Each hand played adds 1 additional focus' },
  { id:'cull',           name:'Cull',                tier:'common',    tags:['focus'], desc:'Discarding or swapping adds +1 Focus per 2 remaining swaps and discards' },
  { id:'expanse',        name:'Expanse',             tier:'common',    tags:['focus'], desc:'Each time you hit your Focus limit, increase it by 1 (max +10), then lose half your Focus' },
  { id:'kaleidoscope',   name:'Kaleidoscope',        tier:'rare',      tags:['focus'], desc:'Playing four or more suits in a hand applies the Focus multiplier a second time' },
  { id:'flow_state',     name:'Flow State',          tier:'rare',      tags:['focus','pips'], desc:'While focus is ×1.5 or higher, score +10 pips per card' },
  // ── Legendary ──
  { id:'heartwood',      name:'Heartwood',           tier:'epic',      desc:'When scored, the center-most card gains +5 pips & +2 mult' },
  // ── Combo batch (r83): payoffs / sleight-charge synergies ──
  { id:'landfill',       name:'Landfill',            tier:'epic',    tags:['discard','mult'],  desc:'Score +1 mult per card for every discard or swap used this round' },
  { id:'old_growth',     name:'Old Growth',          tier:'epic',      tags:['scaling','mult'],  desc:'Cards add their pip value to mult' },
  { id:'magician',       name:'Magician',            tier:'common',      tags:['sleight','mult'],  desc:'+3 mult for each Sleight you own' },
  { id:'stand_up',       name:'Stand-Up',            tier:'rare',      tags:['sleight','pips'],  desc:'Hands with cards from only one column score +5 mult per card' },
  { id:'scalper',        name:'Scalper',             tier:'rare',      tags:['sleight','pips'],  desc:'Score ×1 mult, +×0.25 per charge your Sleights are missing' },
  // ── 5-card-hand family (r103) ──
  { id:'five_stack',     name:'Five Stack',          tier:'legendary',    tags:['pips','mult','focus'], desc:'Each card in a 5-card hand scores +20 pips, +5 mult, and +1 Focus' },
  { id:'little_guys',    name:'the little guys',     tier:'rare',      tags:['focus'],           desc:'A 5-card hand with no face cards increases your Focus limit by 1 (max +15)' },
  { id:'five_fodder',    name:'Five for Fodder',     tier:'common',    tags:['credits','discard'], desc:'Discarding a valid 5-card hand grants +5 credits' },
  { id:'five_second',    name:'Five Second Rule',    tier:'rare',      tags:['time'],            desc:'5-card hands pause the clock +5s' },
  // ── Focus-capacity & generation (r104) ──
  { id:'life_lessons',   name:'Life Lessons',        tier:'rare',      tags:['focus'],           desc:'Each round you complete increases your Focus limit by 1' },
  { id:'wellspring',     name:'Wellspring',          tier:'rare',      tags:['focus','pips','scaling'], desc:'For every 10 Focus generated this game, this trick scores +1 mult' },
  // ── 3-card-hand family (r113) ──
  { id:'third_down',     name:'3rd Down',            tier:'rare',      tags:['focus'],           desc:'3-card hands add +3 Focus' },
  { id:'ready_set_go',   name:'Ready, Set, Go',      tier:'common',    tags:['mult'],            desc:'A 3-card hand containing a 3, 6 or 9 scores +9 mult' },
  { id:'third_charm',    name:"3rd Time's a Charm",  tier:'rare',      tags:['replay'],          desc:'The 3rd card of a hand replays 2x' },
  // ── 4-card-hand family (r123) ──
  { id:'four_eyes',      name:'Four Eyes',           tier:'common',    tags:['mult'],            desc:'4-card hands score +12 mult' },
  { id:'four_by_four',   name:'4x4',                 tier:'common',    tags:['pips','position'], desc:'Cards scored in the 4th column score +16 pips' },
  { id:'four_horseman',  name:'Four Horse-man',      tier:'epic',      tags:['pips','mult','focus','time'], desc:'4-card hands grant a random bonus: +16 pips, +8 mult, +4 Focus, or a 4-second pause' },
  { id:'wait_four_it',   name:'Wait Four It',        tier:'rare',      tags:['time'],            desc:'4-card hands permanently buff their 4th card with +2s pause when scored (time buffs do not stack)' },
  // ── Set add-ons (r124) ──
  { id:'undue_influence', name:'Undue Influence',    tier:'epic',      tags:['credits','set'],   desc:'A Set containing a face card grants credits equal to the number of Set hands you have played this round' },
  { id:'encore',          name:'Encore',             tier:'epic',      tags:['replay','set'],    desc:'Set-type hands made of only odd-ranked cards replay each card' },
  { id:'shaky_foundation',name:'Shaky Foundation',   tier:'common',    tags:['mult','set'],      desc:'Every other Set scores +15 mult' },
  // ── r359: the 9.23 sheet's new Tricks ──
  { id:'obsessed',        name:'Obsessed',           tier:'legendary', tags:['mult','suit','credits'], desc:'Each heart applies x mult equal to 1 + (credits / 100). 50 credits = x1.5' },
  { id:'buried_treasure', name:'Buried Treasure',    tier:'legendary', tags:['credits','suit','luck'], desc:'Each scored diamond has a chance equal to half your Luck to apply x1.1 to your credits' },
  { id:'patient_rulers',  name:'Patient Rulers',     tier:'epic',      tags:['mult','face','pause'],   desc:'If you have paused or rewound the clock this round, face cards score x1.5 mult' },
  { id:'even_better',     name:'Even Better',        tier:'epic',      tags:['pips','value','luck'],   desc:'Even-ranked cards have a 66% chance to score x2.2 pips' },
  { id:'what_odds',       name:'What are The Odds',  tier:'epic',      tags:['mult','value'],          desc:'Odd-ranked cards score x1.7 mult' },
  { id:'critical',        name:'Critical',           tier:'epic',      tags:['mult','flush'],          desc:'Flush type hands score x3 mult' },
  { id:'twinners',        name:'Twinners',           tier:'epic',      tags:['pips','set'],            desc:'Set type hands score x3 pips' },
  { id:'feelin_lucky',    name:'Feelin Lucky',       tier:'epic',      tags:['mult','value','luck'],   desc:'Five randomly rolled ranks score x1.25 mult. Trying to sell this costs 30% of your credits and rerolls the ranks instead - 3 times, then it really sells' },
  { id:'marathon',        name:'Marathon',           tier:'epic',      tags:['focus','run'],           desc:'Run type hands apply the Focus multiplier twice' },
  // ── Run add-ons (r124) ──
  { id:'dam_holding',    name:'Dam Holding…',        tier:'rare',      tags:['time'],            desc:'Runs pause the clock +3s' },
  { id:'wave_amp',       name:'Wave Amplification',  tier:'common',    tags:['pips','streak'],   desc:'Consecutively played Runs score +10 pips × the streak count' },
];

// ── Trick category → emoji ──
// One emoji per effect category (mirrors the section groupings in TRICK_POOL).
// Used on the reward-pick and shop cards so each Trick shows emoji + name, with
// the full description reserved for the tooltip.
const TRICK_CATEGORIES = [
  { emoji:'🪜', ids:['overgrowth','long_road','river_run','correct_run','tide_table','undertow','high_water','dam_holding','wave_amp'] }, // Runs
  { emoji:'👯', ids:['kindred','double_bloom','high_pair','rare_bloom','full_house_streak','pair_pips','two_pair_mult','richter','eye_of_storm','ripple','undue_influence','encore','shaky_foundation'] }, // Pairs / sets
  { emoji:'🎴', ids:['enriched','tidal_force','deluge','summit','light_touch','heavy_hand','blackjack_bonus'] }, // Flush / special hands
  { emoji:'👑', ids:['first_light','wild_heart','face_value','king_guard','knave_power','humble_roots','before_the_tide','royal_trio'] }, // Rank-specific
  { emoji:'🌱', ids:['rich_soil','first_fruits','sapling'] }, // Per-card pips
  { emoji:'⏱️', ids:['early_bird','night_owl','closing_time','quick_draw','patience_reward','steady_pace','momentum','first_play','still_water','frozen_moment','ticktock','quarter_chime','minute_hand','second_hand','hourglass','sediment','kingfisher','magpie','mockingbird','starling','rain_check','deep_breath'] }, // Timing
  { emoji:'🔥', ids:['kindling','wildfire','echo_hand','hot_streak','rerun','chorus'] }, // Streaks
  { emoji:'🎨', ids:['club_double','monochrome','full_color','balanced_diet'] }, // Suit conditions
  { emoji:'🔢', ids:['lucky_sevens','ninesong','prime_time','even_score','odd_squad'] }, // Number magic
  { emoji:'🌈', ids:['number_crunch'] }, // Rank diversity
  { emoji:'📍', ids:['rowcol_triple_pips','rowcol_mult','rowcol_retrigger','perfect_timing','right_time','rowcol_perm_double','shape_square','shape_cross','shape_line','corner_retrigger','two_corners','edge_pips','wide_span_mult','column_rush','row_power','groove','assembly_line','overtime','feng_shui','clean_sweep','temporal_rift'] }, // Position
  { emoji:'📈', ids:['rising_tide'] }, // Level scaling
  { emoji:'🧮', ids:['interest','portfolio','compound_mult','acorns','plan_ahead','more_better','fives_discard','nines_mult','tens_mult','sixes_perm','fours_perm','twos_retrigger','prime_times','eights_retrigger','queens_upgrade','aces_absorb','monopoly'] }, // Accumulating
  { emoji:'🎲', ids:['sands_of_time','discard_pips','spade_flood','mirror','wild_side','wait_for_it'] }, // Situational pip
  { emoji:'🔀', ids:['combo_score','move_as_one'] }, // Diverse conditions
  { emoji:'🎯', ids:['study_hall','meditation','tunnel_vision','first_wind','rhythm','cull','expanse','kaleidoscope','flow_state','overclock'] }, // Focus
  { emoji:'⭐', ids:['heartwood'] }, // Legendary misc
  { emoji:'💎', ids:['obsessed','buried_treasure','patient_rulers','even_better','what_odds','critical','twinners','marathon','feelin_lucky'] }, // r359 multipliers
];
const TRICK_EMOJI = {};
TRICK_CATEGORIES.forEach(cat => cat.ids.forEach(id => { TRICK_EMOJI[id] = cat.emoji; }));
function trickEmoji(trick) { return (trick && TRICK_EMOJI[trick.id]) || '✦'; }

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
  'club_double', 'monochrome', 'spade_flood', 'obsessed', 'buried_treasure', 'patient_rulers',
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
  if (m && m.suitCount === 6) tags.add('sixsuits');
  return tags;
}

function applyModeEntityFilter() {
  const tags  = modeEntityTags();
  const banned = isNumericMode() ? NUMERIC_BANNED_TRICKS : null;
  const keep = TRICK_POOL_ALL.filter(t =>
    !(banned && banned.has(t.id)) && (!t.modes || t.modes.some(id => tags.has(id)))
  );
  TRICK_POOL.length = 0;
  keep.forEach(t => TRICK_POOL.push(t));
}
function trickBannedInMode(id) { return isNumericMode() && NUMERIC_BANNED_TRICKS.has(id); }

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let gridData = [];        // gridData[row][col] = { rank, suit, trickStar, permPips, permMult }
let selected = [];        // array of [row,col] in order
let animating = false;
let falling = false;   // true during card fall animations - allows selection, queues play/discard
let pendingAction = null; // 'play' | 'discard' - queued while falling
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
