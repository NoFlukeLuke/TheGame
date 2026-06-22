// ══════════════════════════════════════════════
// BONUS POOL — Bonus Cards (BCs)
// ══════════════════════════════════════════════
// This file holds ONLY the bonus data list. It is loaded by index.html as a
// plain <script> tag BEFORE the main game script, so `BONUS_POOL` below is a
// normal global that the rest of the game can see (hasBonus, the shop, events,
// the reward grid, etc. all read from it).
//
// To add or edit a bonus you only need to touch THIS file.
// Each entry: { id, name, tier, desc, tags? }
//   id    — unique key used by the code (hasBonus('id'), dedup, etc.)
//   tier  — 'common' | 'rare' | 'legendary'  (affects how often it's offered)
//   desc  — player-facing text shown on the card / tooltip
//   tags  — optional grouping used by themed events (e.g. ['focus'], ['suit'])
//
// NOTE: this is the bonus *data*. The bonus *effects* (the actual scoring math)
// still live in index.html (mainly in calcScore / playHand). Editing numbers or
// text here is safe; brand-new mechanics may also need a change there.
//
// After editing, check the syntax with:  node --check data/bonuses.js
// ══════════════════════════════════════════════

const BONUS_POOL = [
  { id:'deep_roots',    name:'Deep Roots',    tier:'common',    desc:'Run of 3 scores +1 mult' },
  { id:'overgrowth',    name:'Overgrowth',    tier:'common',    desc:'Run of 3 scores +2 mult' },
  { id:'ancient_grove', name:'Ancient Grove', tier:'legendary', desc:'Run of 3 ×2 score' },
  { id:'rich_soil',     name:'Rich Soil',     tier:'common',    desc:'All cards score +1 pip' },
  { id:'fertile_ground',name:'Fertile Ground',tier:'rare',      desc:'All cards score +3 pips' },
  { id:'kindred',       name:'Kindred',       tier:'common',    desc:'Three of a Kind scores +1 mult' },
  { id:'trinity',       name:'Trinity',       tier:'legendary', desc:'Three of a Kind ×2 score' },
  { id:'twin_sprouts',  name:'Twin Sprouts',  tier:'common',    desc:'Pair scores +5 pips' },
  { id:'double_bloom',  name:'Double Bloom',  tier:'rare',      desc:'Any hand containing a pair ×2 score' },
  { id:'worn_path',     name:'Worn Path',     tier:'common',    desc:'Straight scores +10 pips' },
  { id:'long_road',     name:'Long Road',     tier:'rare',      desc:'Any hand containing a run scores +2 mult per card in the run' },
  { id:'river_run',     name:'River Run',     tier:'rare',      desc:'Straight ×2 score' },
  { id:'torrent',       name:'Torrent',       tier:'legendary', desc:'Runs longer than 3 multiply score — ×2 for Run of 4, ×4 for Straight or Straight Flush' },
  { id:'enriched',      name:'Enriched',      tier:'common',    desc:'Flush scores +10 pips' },
  { id:'deluge',        name:'Deluge',        tier:'legendary', desc:'Flush ×2 score' },
  { id:'rare_bloom',    name:'Rare Bloom',    tier:'rare',      desc:'Four of a Kind scores +12 mult' },
  { id:'perfect_storm', name:'Perfect Storm', tier:'legendary', desc:'Straight Flush ×5 score' },
  { id:'early_bird',    name:'Early Bird',    tier:'common',    desc:'Hands in first 10s score +20 pips' },
  { id:'night_owl',     name:'Night Owl',     tier:'common',    desc:'Hands in last 10s score +3 mult' },
  { id:'steady_pace',   name:'Steady Pace',   tier:'common',    desc:'Each hand played scores +1 mult' },
  { id:'kindling',      name:'Kindling',      tier:'common',    desc:'Same hand streak scores +4 pips × streak' },
  { id:'wildfire',      name:'Wildfire',      tier:'rare',      desc:'3 same hands in a row scores +2 mult' },
  { id:'sapling',       name:'Sapling',       tier:'rare',      desc:'Each level, 3 cards permanently gain +2 pips' },
  { id:'swap_shop',     name:'Swap Shop',     tier:'rare',      desc:'Swaps increased from 3 to 5 per round' },
  { id:'second_harvest',name:'Second Harvest',tier:'rare',      desc:'Discards increased from 4 to 6 per round' },
  { id:'well_stocked',  name:'Well Stocked',  tier:'rare',      desc:'Gain +1 swap and +1 discard per round' },
  { id:'free_range',    name:'Free Range',    tier:'legendary', desc:'Swaps limited to 2 per round, but you can swap any 2 cards anywhere on the grid' },
  { id:'still_water',   name:'Still Water',   tier:'rare',      desc:'+5 mult for every 10 seconds elapsed without using a swap' },
  { id:'reserves_swaps',   name:'Reserves: Swaps',   tier:'rare',      desc:'Unused swaps carry over to the next round (max 99 total)' },
  { id:'reserves_discards',name:'Reserves: Discards', tier:'rare',      desc:'Unused discards carry over to the next round (max 99 total)' },
  { id:'reserves_time',    name:'Reserves: Time',     tier:'legendary', desc:'Unused round seconds carry over to the next round (max 99s banked)' },
  { id:'hidden_pair',   name:'Hidden Pair',   tier:'common',    desc:'Hands containing a pair score +10 pips' },
  { id:'court_of_leaves',name:'Court of Leaves',tier:'common', desc:'Face cards (J/Q/K) score +3 pips' },
  { id:'low_tide',      name:'Low Tide',      tier:'common',    desc:'Cards below 6 score +6 pips' },
  { id:'before_the_tide',name:'Before the Tide',tier:'legendary',desc:'Cards below 6 score 6× their base pip value instead' },
  { id:'first_light',   name:'First Light',   tier:'common',    desc:'Aces score +5 pips' },
  { id:'heartwood',     name:'Heartwood',     tier:'legendary', desc:'Dead center card permanently gains +5 pips & +1 mult each time scored' },
  { id:'resilience',    name:'Resilience',    tier:'legendary', desc:'Once per game: if you miss the goal, get a 60s second chance' },
  { id:'first_fruits',  name:'First Fruits',  tier:'rare',      desc:'Each card in first hand each round permanently gains +2 pips' },
  { id:'frozen_moment', name:'Frozen Moment', tier:'legendary', desc:'Hands while timer paused score ×2' },
  { id:'deep_breath',   name:'Deep Breath',   tier:'rare',      desc:'Run of 3 pauses round timer 3s' },
  { id:'stale',         name:'Stale',         tier:'rare',      desc:'Sandwich pauses round timer 2s' },
  { id:'carpe_diem',    name:'Carpe Diem',    tier:'legendary', desc:'Pause effects become cumulative' },
  { id:'lucky_sevens',  name:'Lucky Sevens',  tier:'legendary', desc:'7s ×2 score' },
  { id:'ninesong',      name:'Ninesong',      tier:'rare',      desc:'If pip total is multiple of 9, ×3 score' },
  { id:'momentum',      name:'Momentum',      tier:'rare',      desc:'Consecutive hand within 5s scores +2 mult' },
  // ── Batch 1 ──
  { id:'knave_power',   name:'Knave Power',   tier:'rare',      desc:'Each Jack in hand doubles running pips when scored' },
  { id:'face_value',    name:'Face Value',    tier:'common',    desc:'Face cards (J/Q/K) are worth 15 pips' },
  { id:'humble_roots',  name:'Humble Roots',  tier:'common',    desc:'Cards below 6 contribute triple pips' },
  { id:'echo_hand',     name:'Echo Hand',     tier:'rare',      desc:'Playing the same hand type twice in a row scores ×1.5' },
  { id:'rising_tide',   name:'Rising Tide',   tier:'common',    desc:'Base mult increases by +1 for each level reached' },
  { id:'rye_bread',     name:'Rye Bread',     tier:'legendary', desc:'Sandwich ×2 score' },
  // ── Batch 2 ──
  { id:'long_pause',    name:'Long Pause',    tier:'rare',      desc:'4-card hands pause the round timer 4s' },
  { id:'held_breath',   name:'Held Breath',   tier:'common',    desc:'Every hand played pauses the round timer 1s' },
  { id:'sands_of_time', name:'Sands of Time', tier:'rare',      desc:'Current round time remaining ÷ 2 added as pips' },
  // ── Batch 3 — card value bonuses ──
  { id:'twos_retrigger',  name:'Double Take',    tier:'rare',      desc:'The 2nd card scored retriggeres its effects 3× total', tags:['retrigger','value'] },
  { id:'threes_run',      name:'Trinity Run',    tier:'common',    desc:'Runs containing a 3, 6, or 9 score +9 mult', tags:['mult','run','value'] },
  { id:'fours_perm',      name:'Steady Fours',   tier:'common',    desc:'4-card hands permanently give the 4th card +4 pips', tags:['scaling','pips','value'] },
  { id:'fives_discard',   name:'Penny Saved',    tier:'rare',      desc:'Each 5 discarded or played permanently adds +5 pips to this bonus', tags:['scaling','pips','discard','value'] },
  { id:'sixes_swap',      name:'Six Appeal',     tier:'common',    desc:'Gain +1 swap each time a 6 is scored', tags:['resource','value'] },
  { id:'sixes_perm',      name:'Lucky Roll',     tier:'rare',      desc:'Every 6th card scored gains a random +1–6 mult permanently', tags:['scaling','mult','value'] },
  { id:'eights_retrigger',name:'Octave',         tier:'legendary', desc:'Each scored 8 has a 1-in-8 chance to retrigger all card effects once more', tags:['retrigger','value'] },
  { id:'nines_mult',      name:'Cloud Nine',     tier:'rare',      desc:'Each 9 scored is forgotten and permanently adds +9 mult to this bonus', tags:['scaling','mult','discard','value'] },
  { id:'nines_discard',   name:'Nine Lives',     tier:'common',    desc:'Every 9 seconds, gain +1 discard', tags:['resource','time','value'] },
  { id:'tens_mult',       name:'Perfect Ten',    tier:'rare',      desc:'Every 10 cards discarded permanently adds +1 mult to this bonus', tags:['scaling','mult','discard','value'] },
  { id:'queens_upgrade',  name:'Royal Favour',   tier:'legendary', desc:'After scoring, cards adjacent to Queens on the grid permanently gain +1 rank', tags:['scaling','grid','value'] },
  { id:'kings_downgrade', name:"King's Toll",    tier:'legendary', desc:'After scoring, cards adjacent to Kings on the grid permanently lose 1 rank', tags:['scaling','grid','value'] },
  { id:'aces_absorb',     name:'Ace Absorb',     tier:'legendary', desc:'When an Ace scores, one random adjacent card is forgotten and its bonuses added to the Ace (once per hand)', tags:['scaling','value'] },
  { id:'swap_pause',      name:'Still Waters',   tier:'rare',      desc:'Each swap pauses the round timer 4s', tags:['time','resource'] },
  { id:'discard_pips',    name:'Compost',        tier:'common',    desc:'+3 pips per card discarded this round', tags:['pips','discard'] },
  // ── Batch 4 — suit bonuses ──
  { id:'spade_flood',     name:'Spade Flood',    tier:'legendary', desc:'4 or 5-card all-♠ hands add twice the remaining round time as pips', tags:['suit','pips','time'] },
  { id:'heart_double',    name:'Devoted',        tier:'rare',      desc:'Each ♥ scored adds +1 mult instead of +0.5', tags:['suit','mult'] },
  { id:'spade_double',    name:'Sharp Edge',     tier:'rare',      desc:'Each ♠ scored adds +2s instead of +1s', tags:['suit','time'] },
  { id:'club_double',     name:'Hard Labour',    tier:'rare',      desc:'Each ♣ scored adds +10 pips instead of +5', tags:['suit','pips'] },
  { id:'diamond_double',  name:'Appraised',      tier:'rare',      desc:'Each ♦ scored earns +2 coins instead of +1', tags:['suit','coins'] },
  // ── Batch 5 — hand type gaps ──
  { id:'full_house_streak', name:'House Rules',    tier:'rare',      desc:'Each Full House this round scores ×1.5 more than the last (resets each level)', tags:['scaling','hand','fullhouse'] },
  { id:'two_pair_mult',     name:'Double Dutch',   tier:'common',    desc:'Two Pair scores +10 mult', tags:['mult','hand','twopair'] },
  { id:'high_card_mult',    name:'Lone Wolf',      tier:'common',    desc:'High Card scores +(level × 2) mult', tags:['mult','hand','highcard','level'] },
  { id:'high_card_pips',    name:'Underdog',       tier:'rare',      desc:'High Card: card pips × level', tags:['pips','hand','highcard','level'] },
  { id:'blackjack_bonus',   name:'Twenty-One',     tier:'legendary', desc:'If the face values of your cards total exactly 21, score ×3', tags:['score','hand','blackjack','value'] },
  // ── Batch A — positional row/col bonuses ──
  // These are generated dynamically with assigned row/col — templates only
  { id:'rowcol_triple_pips', name:'Triple Pips',   tier:'rare',      desc:'Cards scored in a specific row or column contribute triple pips', tags:['pips','position'] },
  { id:'rowcol_mult',        name:'Power Line',    tier:'rare',      desc:'Cards scored in a specific row or column each add +2 mult', tags:['mult','position'] },
  { id:'rowcol_retrigger',   name:'Echo Line',     tier:'rare',      desc:'Cards scored in a specific row or column trigger their effects twice', tags:['retrigger','position'] },
  { id:'rowcol_perm_double', name:'Ley Line',      tier:'legendary', desc:'Cards scored at a specific grid intersection permanently double their pips (resets each level)', tags:['pips','position','scaling'] },
  // ── Batch B — shape detection bonuses ──
  { id:'shape_square',   name:'Four Corners',  tier:'legendary', desc:'A 2×2 hand scores ×4 pips', tags:['position','shape'] },
  { id:'shape_cross',    name:'Crossroads',    tier:'rare',      desc:'A + shaped hand scores ×3', tags:['position','shape'] },
  { id:'shape_line',     name:'Straight Shot', tier:'common',    desc:'All-row or all-column hands add the first and last card\'s pip values to mult', tags:['position','shape','mult'] },
  { id:'shape_snake',    name:'Snake',         tier:'rare',      desc:'A hand that changes direction every step (no 3 cards in a row or column) scores +2 mult per card', tags:['position','shape','mult'] },
  // ── Batch C — positional condition bonuses ──
  { id:'corner_retrigger', name:'Corner Power',  tier:'rare',      desc:'Cards in corner cells retrigger their card-tied bonuses once more', tags:['position','retrigger'] },
  { id:'two_corners',      name:'Diagonal',      tier:'legendary', desc:'A hand containing 2 corner cells scores ×4', tags:['position','score'] },
  { id:'correct_run',      name:'In Order',      tier:'common',    desc:'Runs selected in consecutive ascending or descending order score ×2', tags:['position','run','score'] },
  { id:'edge_pips',        name:'On the Edge',   tier:'common',    desc:'Hands where all cards are on the outer edge score +15 pips per card', tags:['position','pips'] },
  { id:'wide_span_mult',   name:'Wide Reach',    tier:'rare',      desc:'Hands spanning 4+ rows or columns score +24 mult. +5 mult per extra column, +20 pips per extra row', tags:['position','mult','pips'] },

  // ── Focus bonuses (chunk 3) ──
  { id:'meditation',    name:'Meditation',    tier:'common', desc:'Focus decays 1 second slower',                                        tags:['focus'] },
  { id:'tunnel_vision', name:'Tunnel Vision', tier:'common', desc:'Start each round with 5 focus',                                        tags:['focus'] },
  { id:'first_wind',    name:'First Wind',    tier:'common', desc:'Focus does not decay for the first 45 seconds of a round',             tags:['focus'] },
  { id:'rhythm',        name:'Rhythm',        tier:'common', desc:'Each hand played adds 1 additional focus',                             tags:['focus'] },
  { id:'restless',      name:'Restless',      tier:'common', desc:'Swapping adds 1 focus',                                                tags:['focus'] },
  { id:'cull',          name:'Cull',          tier:'common', desc:'Using a discard adds 1 focus',                                         tags:['focus'] },
  { id:'expanse',       name:'Expanse',       tier:'common', desc:'Each time you hit max focus, increase max focus capacity by 1',        tags:['focus'] },
  { id:'kaleidoscope',  name:'Kaleidoscope',  tier:'rare',   desc:'Playing one of each suit in a hand adds 4 focus',                      tags:['focus'] },
  { id:'flow_state',    name:'Flow State',    tier:'rare',   desc:'While focus is ×1.5 or higher, +10 pips per card scored',              tags:['focus','pips'] },
];
