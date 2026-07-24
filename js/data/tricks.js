const TRICK_POOL = [
  // ── Runs ──
  { id:'overgrowth',     name:'Cascade',             tier:'common',    desc:'Runs score +10 pips per card' },
  { id:'long_road',      name:'Storm',               tier:'common',    desc:'Runs score +2 mult per card' },
  { id:'river_run',      name:'Torrent',             tier:'rare',      desc:'Runs add +1 Focus per card' },
  { id:'ancient_grove',  name:'Flash Flood',         tier:'legendary', desc:'Runs of 4+ cards instantly advance Focus to the next threshold' },
  { id:'correct_run',    name:'Rogue Wave',          tier:'mythic',    desc:'Runs played in correct sequential order score +80 pips and +16 mult, and add +4 Focus, per card' },
  { id:'tide_table',     name:'Tide Table',          tier:'epic',      desc:'Runs ×mult, building +×0.75 per Run scored this round' },
  { id:'undertow',       name:'Undertow',            tier:'epic',      desc:'Runs ×1.5 pips, plus ×0.5 more per card beyond 3' },
  { id:'high_water',     name:'High Water',          tier:'epic',      desc:'After 3 Runs each round, every Run pauses the clock for its card count in seconds' },
  { id:'worn_path',      name:'Worn Path',           tier:'common',    desc:'Straight scores +20 pips' },
  // ── Pairs / sets ──
  { id:'kindred',        name:'Quake',               tier:'common',    desc:'Sets score +3 mult per card in the largest set' },
  { id:'trinity',        name:'Shock',               tier:'common',    desc:'Sets score +12 pips per card in the largest set' },
  { id:'double_bloom',   name:'Magnitude',           tier:'epic',      desc:'Hands containing a pair ×1.5 mult' },
  { id:'high_pair',      name:'Resonance',           tier:'rare',      desc:'Pairs and Two Pairs containing a 2 or 4 add +2 Focus per card' },
  { id:'rare_bloom',     name:'Bedrock',             tier:'epic',      desc:'Four of a Kind permanently buffs its 4 cards +8 pips each' },
  { id:'full_house_streak', name:'Collapsing Columns', tier:'epic',  desc:'Each Full House instantly advances Focus to the next threshold' },
  { id:'pair_pips',      name:'Aftershock',          tier:'common',    desc:'Two Pair ×2 pips' },
  { id:'two_pair_mult',  name:'Double Dutch',        tier:'rare',      desc:'Play 3 hands with a pair within 30s for +16 Focus (a non-pair hand breaks the streak)' },
  { id:'richter',        name:'Richter',             tier:'legendary', desc:'Four of a Kind ×3 mult and advances Focus to the next threshold' },
  { id:'eye_of_storm',   name:'Eye of the Storm',    tier:'epic',      desc:'Hands played in the middle third of the round replay the highest-ranked card(s)' },
  { id:'ripple',         name:'Ripple',              tier:'rare',      desc:'Once every 30s, cards adjacent in rank to another card in the hand replay' },
  // ── Flush / special hand types ──
  { id:'enriched',       name:'Enriched',            tier:'common',    desc:'Flushes score +40 pips' },
  { id:'tidal_force',    name:'Tidal Forces',        tier:'common',    desc:'Flushes score +10 mult' },
  { id:'deluge',         name:'Deluge',              tier:'rare',      desc:'Flushes add +5 seconds to the clock' },
  { id:'summit',     name:'Unsummit',   tier:'common', desc:'The lowest-ranking card in each hand scores +(its value × level) pips.' },
  { id:'last_stand', name:'Last Stand', tier:'rare',   desc:'If your score is below the round goal when you play, that hand scores x2.' },
  { id:'light_touch',    name:'Nimble',              tier:'common',    desc:'2-card hands score +5 mult' },
  { id:'heavy_hand',     name:'Full Load',           tier:'rare',      desc:'5-card hands score +6 pips per card' },
  { id:'blackjack_bonus', name:'Twenty-One',         tier:'legendary', desc:'If the face values of your cards total exactly 21, score ×3' },
  // ── Rank-specific pips / mult ──
  { id:'first_light',    name:'First Light',         tier:'common',    desc:'Aces are worth 21 pips' },
  { id:'wild_heart',     name:'Inspirato',           tier:'epic',      desc:'When an Ace scores, prime your first and last Tricks (each fires twice its next hand)' },
  { id:'face_value',     name:'Face Value',          tier:'common',    desc:'Face cards (J/Q/K) are worth 15 pips' },
  { id:'king_guard',     name:'Men of Repute',       tier:'common',    desc:'Kings and Jacks score +5 pips and +1 mult each' },
  { id:'knave_power',    name:'Knave for the People', tier:'legendary', desc:'Each Jack on the grid multiplies total pips ×2' },
  { id:'humble_roots',   name:'Every Day Essentials', tier:'rare',     desc:'Rank-5-and-below cards (incl. Ace) contribute 3× pips' },
  { id:'before_the_tide', name:'Gnomes',             tier:'epic',      desc:'Each rank-5-and-below card scored adds its rank in Focus' },
  { id:'royal_trio',     name:'Heads of State',      tier:'epic',      desc:'A hand containing K, Q, and J scores ×2 mult' },
  // ── Per-card pip bonuses ──
  { id:'rich_soil',      name:'Rich Soil',           tier:'common',    desc:'All cards score +2 pips' },
  { id:'fertile_ground', name:'Fertile Ground',      tier:'rare',      desc:'All cards score +3 pips' },
  { id:'first_fruits',   name:'First Fruits',        tier:'rare',      desc:'Each card in first hand each round permanently gains +2 pips' },
  { id:'sapling',        name:'Sapling',             tier:'rare',      desc:'Each level, 3 cards permanently gain +2 pips' },
  // ── Timing ──
  { id:'early_bird',     name:'Early Bird',          tier:'common',    desc:'Hands played in the first third of the round score +3 pips per card' },
  { id:'night_owl',      name:'Night Owl',           tier:'common',    desc:'Hands played in the last third of the round score +1 mult per card' },
  { id:'closing_time',   name:'Near Extinction',     tier:'rare',      desc:'When less than a quarter of the round remains, each scored card replays' },
  { id:'quick_draw',     name:'Quick Draw',          tier:'common',    desc:'Hands played within 3 seconds of the previous permanently add +1 max Focus capacity' },
  { id:'patience_reward', name:'The Heron',          tier:'rare',      desc:'Hands played 15+ round-seconds after the previous score +3 mult' },
  { id:'first_play',     name:'Head Start',          tier:'common',    desc:'The first hand each round adds +5 Focus' },
  { id:'still_water',    name:'Eagle Eye',           tier:'rare',      desc:'+5 mult for every 10 seconds elapsed without using a swap' },
  { id:'frozen_moment',  name:'The Falcon',          tier:'epic',      desc:'Hands played while the clock is paused add +10 Focus' },
  { id:'swift',          name:'The Swift',           tier:'rare',      desc:'+1 mult for every 3 seconds elapsed this round' },
  { id:'cuckoo',         name:'The Cuckoo',          tier:'epic',      desc:'Every 60 seconds of round time, pause the clock by 1 second for each replay that has happened this round' },
  { id:'double_jeopardy', name:'Double Jeopardy',    tier:'epic',      desc:'Once per round: a random card is marked at round start; the first time you score it, pause the clock for 15 seconds' },
  { id:'woodpecker',     name:'The Woodpecker',      tier:'rare',      desc:'In alternating 30-second blocks a random card is marked. Scoring a marked card replays it twice' },
  { id:'hummingbird',    name:'The Hummingbird',     tier:'rare',      desc:'+2 mult for every clock pause triggered this game' },
  { id:'albatross',      name:'The Albatross',       tier:'rare',      desc:'+5 pips for every second the clock has spent paused this round' },
  { id:'vulture',        name:'The Vulture',         tier:'epic',      desc:'Cards discarded during the round’s first clock pause permanently gain: pause the clock 1 second each time they score (replays stack)' },
  // ── Clock-mark Tricks (fire as the round clock passes static timestamps) ──
  { id:'ticktock',       name:'Tick-Tock',           tier:'common',    tags:['time','focus'],     desc:'Every time the round clock ends in a 0, gain +2 Focus' },
  { id:'quarter_chime',  name:'Quarter Chime',       tier:'rare',      tags:['time','pips'],      desc:'Every time the round clock reads a multiple of 15 seconds, your next hand scores +45 pips' },
  { id:'minute_hand',    name:'Minute Hand',         tier:'rare',      tags:['time','mult'],      desc:'Every minute mark the clock passes adds +3 mult to your next hand' },
  { id:'second_hand',    name:'Second Hand',         tier:'common',    tags:['time','pips'],      desc:'Every minute mark the clock passes adds +5 pips to your next hand' },
  { id:'hourglass',      name:'Hourglass',           tier:'epic',      tags:['time','retrigger'], desc:'Every minute mark the clock passes has a 1-in-3 chance to give a random card on the grid a permanent retrigger' },
  { id:'sediment',       name:'Sediment',            tier:'rare',      tags:['time','pips'],      desc:'Gains +10 pips for every 10 seconds of round time elapsed (resets each round)' },
  { id:'kingfisher',     name:'The Kingfisher',      tier:'epic',      tags:['time','mult'],      desc:'+1 mult for every 5 seconds the clock has been paused or rewound this round' },
  { id:'magpie',         name:'Hoarder House',       tier:'epic',      tags:['time','resource'],  desc:'Each hand rewinds the clock 1 second for every 2 unspent swaps + discards you hold' },
  { id:'mockingbird',    name:'Traveler',            tier:'rare',      tags:['resource','streak'],desc:'Every 3 hands you play without a same-type streak grants +1 swap' },
  { id:'starling',       name:'Type A',              tier:'rare',      tags:['resource','streak'],desc:'Every 2nd hand of an unbroken same-type streak grants +1 discard' },
  { id:'phoenix',        name:'The Phoenix',         tier:'mythic',    desc:'While the clock is paused, the Focus multiplier applies twice' },
  // ── Streaks ──
  { id:'kindling',       name:'Kindling',            tier:'common',    desc:'Same hand streak scores +4 pips × streak' },
  { id:'wildfire',       name:'Wildfire',            tier:'rare',      desc:'3 same hands in a row scores +2 mult' },
  { id:'echo_hand',      name:'Echoes',              tier:'common',    desc:'Playing the same hand type as the previous hand replays each card' },
  // ── Suit conditions ──
  { id:'club_double',    name:'Hard Labour',         tier:'mythic',    tags:['suit','pips'], desc:'Each club scored adds escalating pips — +5, doubling per club; replays count' },
  { id:'monochrome',     name:'Blood Diamonds',      tier:'epic',      desc:'Hands with at least one heart and one diamond grant +1 credit and +10 seconds' },
  { id:'full_color',     name:'Rainbow',             tier:'rare',      desc:'Hands with all four suits score +16 pips and +4 mult per card' },
  { id:'balanced_diet',  name:'Balance',             tier:'common',    desc:'Hands with exactly 2 suits score +2 mult per card' },
  // ── Number magic ──
  { id:'lucky_sevens',   name:'Lucky Sevens',        tier:'epic',      desc:'+3 Focus for each 7 scored or discarded' },
  { id:'ninesong',       name:'Threepeat',           tier:'epic',      desc:"If the hand's pip total is divisible by 3: +3 seconds, +9 mult, +3 Focus" },
  { id:'prime_time',     name:'Prime Time',          tier:'rare',      desc:'Hands with 3+ prime-rank cards (A,2,3,5,7) score +23 pips per card' },
  { id:'even_score',     name:'Get Even',            tier:'common',    desc:'Hands with 3+ even-ranked cards score +2 mult per card' },
  { id:'odd_squad',      name:'Odd One In',          tier:'rare',      desc:'Hands with 3+ odd-ranked cards score +5 mult per card' },
  // ── Rank diversity ──
  { id:'number_crunch',  name:'Diversity',           tier:'rare',      desc:'Hands with 4+ different ranks score +2 mult' },
  // ── Position ──
  { id:'rowcol_triple_pips', name:'Right Place',     tier:'common',    tags:['pips','position'], desc:'Cards scored in a marked row or column score +10 pips' },
  { id:'rowcol_mult',    name:'Power Line',          tier:'common',    tags:['mult','position'], desc:'Cards scored in a marked row or column each score +2 mult' },
  { id:'rowcol_retrigger', name:'Echo Location',     tier:'rare',      tags:['replay','position'], desc:'Cards scored in a marked row or column have a 50% chance to replay once' },
  { id:'perfect_timing', name:'Perfect Timing',      tier:'epic',      tags:['replay','position'], desc:'Cards scored in a marked row or column replay once' },
  { id:'right_time',     name:'Right Time',          tier:'rare',      tags:['time','position'], desc:'Each card scored in a marked row or column pauses the clock 2 seconds' },
  { id:'study_hall',     name:'Study Hall',          tier:'rare',      tags:['focus','position'], desc:'Cards scored in a marked row or column add +2 Focus, once per minute' },
  { id:'rowcol_perm_double', name:'Ley Line',        tier:'epic',      tags:['mult','position','scaling'], desc:'Cards scored at the intersection of a row effect and a column effect permanently gain +2 mult, once per minute' },
  { id:'shape_square',   name:'Hands of Blue',       tier:'epic',      tags:['position','shape','focus'], desc:'A 2×2 hand adds +16 Focus' },
  { id:'shape_cross',    name:'Crossroads',          tier:'rare',      tags:['position','shape','focus'], desc:'A + shaped hand adds +25 Focus' },
  { id:'shape_line',     name:'Straight Shot',       tier:'epic',      tags:['position','shape','mult'], desc:"5-card hands played in a straight line add the first and last card's pip values to mult" },
  { id:'corner_retrigger', name:'Cornered',          tier:'rare',      tags:['position','pips'], desc:'Corner cards multiply the running pips by the whole minutes left on the clock' },
  { id:'two_corners',    name:'Stretch',             tier:'epic',      tags:['position','mult'], desc:'When a hand has 2 or more corner cells, each corner card scores ×2 mult' },
  { id:'edge_pips',      name:'On the Edge',         tier:'common',    tags:['position','pips'], desc:'Hands where all cards are on the outer edge score +15 pips per card' },
  { id:'wide_span_mult', name:'Inclusive',           tier:'rare',      tags:['position','mult'], desc:'Hands spanning the full width or height of the grid score +25 mult' },
  { id:'column_rush',    name:'Stand Up',            tier:'common',    desc:'Hands with cards from only one column score +2 mult per card' },
  { id:'row_power',      name:'Lie Down',            tier:'common',    desc:'Hands with cards from only one row score +2 mult per card' },
  // ── New position tricks (owner batch) ──
  { id:'groove',         name:'Groove',              tier:'rare',      tags:['focus','position','scaling'], desc:'This trick scales +1 Focus for every 2 cards scored from a marked row or column. Resets each round.' },
  { id:'assembly_line',  name:'Assembly Line',       tier:'epic',      tags:['mult','position','scaling'],  desc:'Cards scored in a marked row or column score +1 mult for every card already scored from that line this round.' },
  { id:'overtime',       name:'Overtime',            tier:'rare',      tags:['time','position','scaling'],  desc:'This trick scales +1 second for every 3 cards scored from a marked row or column. Resets each round.' },
  { id:'feng_shui',      name:'Feng Shui',           tier:'epic',      tags:['pips','position','scaling'],  desc:'Permanently scores +3 pips each hand another position trick triggers.' },
  { id:'huddle',         name:'Huddle',              tier:'rare',      tags:['pips','position'],            desc:'Each scored card scores +11 pips for every adjacent card or sleight in the hand.' },
  { id:'clean_sweep',    name:'Clean Sweep',         tier:'epic',      tags:['focus','position'],           desc:'Cover a full row or column within two hands to advance Focus to the next threshold.' },
  // ── Level scaling ──
  { id:'rising_tide',    name:'Rising Tide',         tier:'common',    desc:'Base mult increases by +1 for each level reached' },
  { id:'veteran_bonus',  name:'Veteran',             tier:'common',    desc:'+2 pips per level reached this run' },
  // ── Accumulating ──
  { id:'compound_mult',  name:'Compound',            tier:'epic',      desc:'Each hand played permanently adds +0.1 mult to this trick' },
  { id:'prolific',       name:'Prolific',            tier:'rare',      desc:'Each hand played permanently adds +1 pip to this trick' },
  { id:'fives_discard',  name:'Penny Saved',         tier:'rare',      tags:['scaling','pips','value'], desc:'Each 5 discarded or played permanently adds +5 pips to this trick' },
  { id:'nines_mult',     name:'Cloud Nine',          tier:'rare',      tags:['scaling','mult','value'], desc:'Each 9 scored permanently adds +9 mult to this trick' },
  { id:'tens_mult',      name:'Perfect Ten',         tier:'rare',      tags:['scaling','mult','value'], desc:'Every 10 cards discarded permanently adds +1 mult to this trick' },
  { id:'sixes_perm',     name:'D6',                  tier:'epic',      tags:['scaling','pips','value'], desc:'Every 6th card scored permanently gains a random +1–6 pips' },
  { id:'fours_perm',     name:'Middle Management',   tier:'common',    tags:['scaling','pips','value'], desc:'4-card hands permanently give the 4th card +4 pips' },
  { id:'twos_retrigger', name:'Double Take',         tier:'rare',      tags:['retrigger','value'], desc:'Each 2 scored duplicates your most recently acquired Trick’s effect' },
  { id:'prime_times',    name:'Prime Times',         tier:'rare',      tags:['retrigger','prime'], desc:'When a prime-rank card (A,2,3,5,7) scores, prime your next Trick — cycling 1st→2nd→3rd→5th→7th' },
  { id:'eights_retrigger', name:'Sideways to Infinity', tier:'rare',   tags:['retrigger','value'], desc:'Each 8 in a hand scores a number of times equal to the number of 8s in that hand' },
  { id:'snowball',       name:'Snowball',            tier:'epic',      desc:'After any hand scoring 500+ pips, each scored card permanently gains +2 pips' },
  { id:'big_win',        name:'Jackpot',             tier:'legendary', desc:'The first time a single hand scores 10,000+, permanently add +5 mult to this trick' },
  { id:'queens_upgrade', name:'Royal Favour',        tier:'epic',      tags:['scaling','grid','value'], desc:'After scoring, cards adjacent to Queens permanently gain +1 rank' },
  { id:'aces_absorb',    name:'Ace Absorb',          tier:'legendary', tags:['scaling','value'], desc:'When an Ace scores, one random adjacent card is forgotten and its bonuses added to the Ace (once per hand)' },
  // ── Situational pip ──
  { id:'sands_of_time',  name:'Sands of Time',       tier:'rare',      desc:'Current round time remaining ÷ 2 added as pips' },
  { id:'discard_pips',   name:'Compost',             tier:'common',    tags:['pips','discard'], desc:'+3 pips per card discarded this round' },
  { id:'spade_flood',    name:'Dark Matter',         tier:'rare',      tags:['suit','pips'], desc:'All-spade hands add half the remaining round time as pips' },
  { id:'mirror',         name:'Mirror',              tier:'rare',      tags:['utility'], desc:'Tap to tilt left or right; borrows the effect of the Trick on that side. Facing an empty slot = no effect.' },
  // ── Diverse conditions ──
  { id:'combo_score',    name:'Combo Score',         tier:'common',    desc:'+2 mult for every distinct hand type played this round' },
  { id:'escalation',     name:'Escalation',          tier:'rare',      desc:'For each hand beyond the 5th in a round, score +1 mult' },
  // ── Focus ──
  { id:'meditation',     name:'Meditation',          tier:'common',    tags:['focus'], desc:'Focus decays 1 second slower' },
  { id:'tunnel_vision',  name:'Tunnel Vision',       tier:'common',    tags:['focus'], desc:'Start each round with 5 focus' },
  { id:'first_wind',     name:'First Wind',          tier:'common',    tags:['focus'], desc:'Focus does not decay for the first 45 seconds of a round' },
  { id:'rhythm',         name:'Rhythm',              tier:'common',    tags:['focus'], desc:'Each hand played adds 1 additional focus' },
  { id:'restless',       name:'Restless',            tier:'common',    tags:['focus'], desc:'Swapping adds 1 focus' },
  { id:'cull',           name:'Cull',                tier:'common',    tags:['focus'], desc:'Using a discard adds 1 focus' },
  { id:'expanse',        name:'Expanse',             tier:'common',    tags:['focus'], desc:'Each time you hit max focus, increase max focus capacity by 1' },
  { id:'kaleidoscope',   name:'Kaleidoscope',        tier:'rare',      tags:['focus'], desc:'Playing one or more of each suit in a hand adds +4 Focus' },
  { id:'flow_state',     name:'Flow State',          tier:'rare',      tags:['focus','pips'], desc:'While focus is ×1.5 or higher, +10 pips per card scored' },
  // ── Legendary ──
  { id:'heartwood',      name:'Heartwood',           tier:'epic',      desc:'Dead center card permanently gains +5 pips & +1 mult each time scored' },
  // ── Combo batch (r83): payoffs / sleight-charge synergies ──
  { id:'landfill',       name:'Landfill',            tier:'common',    tags:['discard','mult'],  desc:'Hands score +1 mult for every 5 cards you have discarded this round' },
  { id:'old_growth',     name:'Old Growth',          tier:'epic',      tags:['scaling','mult'],  desc:'Each scored card also adds its permanent pip bonus to mult' },
  { id:'magician',       name:'Magician',            tier:'rare',      tags:['sleight','mult'],  desc:'+3 mult for each Sleight you own' },
  { id:'stand_up',       name:'Stand-Up',            tier:'rare',      tags:['sleight','pips'],  desc:'+10 pips for each charge remaining across all your Sleights' },
  { id:'scalper',        name:'Scalper',             tier:'rare',      tags:['sleight','pips'],  desc:'Total pips ×(1 + 0.2 per charge your Sleights are missing), figured when the hand scores' },
];

// ── Trick category → emoji ──
// One emoji per effect category (mirrors the section groupings in TRICK_POOL).
// Used on the reward-pick and shop cards so each Trick shows emoji + name, with
// the full description reserved for the tooltip.
const TRICK_CATEGORIES = [
  { emoji:'🪜', ids:['overgrowth','long_road','river_run','ancient_grove','correct_run','tide_table','undertow','high_water','worn_path'] }, // Runs
  { emoji:'👯', ids:['kindred','trinity','double_bloom','high_pair','rare_bloom','full_house_streak','pair_pips','two_pair_mult','richter','eye_of_storm','ripple'] }, // Pairs / sets
  { emoji:'🎴', ids:['enriched','tidal_force','deluge','summit','last_stand','light_touch','heavy_hand','blackjack_bonus'] }, // Flush / special hands
  { emoji:'👑', ids:['first_light','wild_heart','face_value','king_guard','knave_power','humble_roots','before_the_tide','royal_trio'] }, // Rank-specific
  { emoji:'🌱', ids:['rich_soil','fertile_ground','first_fruits','sapling'] }, // Per-card pips
  { emoji:'⏱️', ids:['early_bird','night_owl','closing_time','quick_draw','patience_reward','steady_pace','momentum','first_play','still_water','frozen_moment','ticktock','quarter_chime','minute_hand','second_hand','hourglass','sediment','kingfisher','magpie','mockingbird','starling'] }, // Timing
  { emoji:'🔥', ids:['kindling','wildfire','echo_hand','hot_streak'] }, // Streaks
  { emoji:'🎨', ids:['club_double','monochrome','full_color','balanced_diet'] }, // Suit conditions
  { emoji:'🔢', ids:['lucky_sevens','ninesong','prime_time','even_score','odd_squad'] }, // Number magic
  { emoji:'🌈', ids:['number_crunch'] }, // Rank diversity
  { emoji:'📍', ids:['rowcol_triple_pips','rowcol_mult','rowcol_retrigger','perfect_timing','right_time','study_hall','rowcol_perm_double','shape_square','shape_cross','shape_line','corner_retrigger','two_corners','edge_pips','wide_span_mult','column_rush','row_power','groove','assembly_line','overtime','feng_shui','huddle','clean_sweep'] }, // Position
  { emoji:'📈', ids:['rising_tide','veteran_bonus'] }, // Level scaling
  { emoji:'🧮', ids:['compound_mult','prolific','fives_discard','nines_mult','tens_mult','sixes_perm','fours_perm','twos_retrigger','prime_times','eights_retrigger','snowball','big_win','queens_upgrade','aces_absorb'] }, // Accumulating
  { emoji:'🎲', ids:['sands_of_time','discard_pips','spade_flood','mirror'] }, // Situational pip
  { emoji:'🔀', ids:['combo_score','escalation'] }, // Diverse conditions
  { emoji:'🎯', ids:['meditation','tunnel_vision','first_wind','rhythm','restless','cull','expanse','kaleidoscope','flow_state'] }, // Focus
  { emoji:'⭐', ids:['heartwood'] }, // Legendary misc
];
const TRICK_EMOJI = {};
TRICK_CATEGORIES.forEach(cat => cat.ids.forEach(id => { TRICK_EMOJI[id] = cat.emoji; }));
function trickEmoji(trick) { return (trick && TRICK_EMOJI[trick.id]) || '✦'; }

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let gridData = [];        // gridData[row][col] = { rank, suit, trickStar, permPips, permMult }
let selected = [];        // array of [row,col] in order
let animating = false;
let falling = false;   // true during card fall animations — allows selection, queues play/discard
let pendingAction = null; // 'play' | 'discard' — queued while falling
let dealPhase = false; // true while deal anims are running — suppresses render() card placement

let score = 0;      // current round's score — resets to 0 at the start of every round
let totalScore = 0; // lifetime total banked from completed rounds; display-only (end-of-run screens)
let roundGoal = BASE_GOAL;      // this round's score target, from zero
let level = 1;

// ── Focus Meter (formerly Fate Meter) ──
let focusNodes      = 0;   // current accumulated focus (resets each round)
