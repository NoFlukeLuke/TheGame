# Entity tags (r640, tables regenerated r646)

The one vocabulary every Trick, Sleight and Knack is described in: `js/data/tags.js` (groups
PAYS / SCOPE / WHEN / HOW, rules in its header). Each row's `tags:` is below. Rerun
`node tools/verify-tags.js` after editing a row; `--tables <file>` regenerates the tables.

## TRICK_POOL (178)

| id | name | desc (first 70) | tags |
|---|---|---|---|
| overgrowth | Cascade | Runs score +20 pips per card | pips card run scores |
| long_road | Storm | Runs score +10 mult per card | mult card run scores |
| river_run | Torrent | Runs add +1 Focus per card | focus card run |
| correct_run | Rogue Wave | Runs played in correct sequential order score one of the following: +8 | pips mult focus hand run scores chance |
| tide_table | Tide Table | Runs score ×1.25 mult, +×0.5 per Run scored this round | xmult hand run scores |
| undertow | Undertow | Runs score ×2 pips, +×0.5 per card beyond 3 | xpips hand run size scores |
| high_water | High Water | Runs pause the clock for 1s for each Run played this round | time hand run |
| rerun | Rerun | ×1.25 pips each time a card is replayed | xpips card scores replays |
| chorus | Chorus | ×1.5 mult each time a card is replayed | xmult card scores replays |
| deep_breath | Deep Breath | Score ×2 pips while the clock is paused | xpips hand pause scores |
| interest | Interest | Score ×1 pips, +0.1 for every 10 credits you hold, up to ×3 | xpips hand scores held |
| portfolio | Portfolio | Score ×1 mult, +×0.25 for every card on the grid with a buff | xmult hand buffed scores |
| overclock | Overclock | The Focus speed bonus is multiplied by 2. | focus other |
| kindred | Quake | Sets score +15 mult per card in the largest set | mult card set scores |
| double_bloom | Magnitude | Hands containing a pair (pair, 2 pair, full house) score ×1.5 mult | xmult hand set scores |
| high_pair | Resonance | Hands containing a pair and a 2 or 4 add +4 Focus per card | focus card set rank |
| rare_bloom | Bedrock | Four of a Kind permanently buffs its 4 cards +8 pips each | deck pips hand set scaling scores |
| full_house_streak | Collapsing Columns | Full Houses score +15 Focus | focus hand set |
| pair_pips | Aftershock | Two Pair scores ×2 pips | xpips hand set scores |
| two_pair_mult | Double Dutch | Play 3 hands with a pair within 30s to add +20 Focus | focus hand set clock |
| richter | Richter | Four of a Kind scores ×3 mult and +10 Focus | xmult focus hand set scores |
| eye_of_storm | Eye of the Storm | Hands played in the middle third of the round replay the highest-ranke | replay card clock scores rank |
| ripple | Ripple | Cards adjacent in rank to another card in the hand have a 66% chance t | replay card scores chance rank |
| enriched | Enriched | Flushes score +100 pips | pips hand flush scores |
| tidal_force | Tidal Forces | Flushes score +15 mult per card | mult card flush scores |
| deluge | Deluge | Flushes rewind the clock 15s | time hand flush |
| summit | Unsummit | The highest-ranking card in each hand scores +(level x 2) pips. | pips card scores scaling rank |
| light_touch | Nimble | 2-card hands score +30 mult | mult hand size scores |
| release_valve | Release Valve | Each time you hit your Focus limit, gain +1 swap and +1 discard and lo | stock other cost |
| heavy_hand | Full Load | 5-card hands score +20 pips per card | pips card size scores |
| blackjack_bonus | Twenty-One | If the face values of your cards total exactly 21, score ×3 pips | xpips hand rank scores |
| first_light | First Light | Aces score 42 pips | pips card rank scores |
| wild_heart | Inspirato | When an Ace scores, prime your first and last Tricks | retrigger card rank tricks |
| face_value | Face Value | Face cards (J/Q/K) score +20 pips | pips card rank scores |
| king_guard | Men of Repute | Kings and Jacks score +10 pips and +5 mult | pips mult card rank scores |
| knave_power | Jackpot | Score ×1.5 pips for each Jack on the grid | xpips hand rank scores |
| humble_roots | Every Day Essentials | Rank-6-and-below cards score their rank ×3 pips | pips card rank scores |
| before_the_tide | Gnomes | Each rank 5 or lower card scored adds its rank in Focus | focus card rank |
| royal_trio | Heads of State | A hand containing a King and one other Royal scores ×2 mult | xmult hand rank scores |
| rich_soil | Rich Soil | All cards score +3 mult | mult card scores |
| first_fruits | First Fruits | Each card in the first hand each round permanently gains +5 pips | deck pips card scaling scores start |
| sapling (retired) | Sapling | Each level, 3 cards permanently gain +5 pips | deck pips other level scaling scores |
| early_bird | Early Bird | Hands played in the first third of the round score +20 pips per card | pips card clock scores |
| night_owl | Night Owl | Hands played in the last third of the round score +10 mult per card | mult card clock scores |
| closing_time | Near Extinction | In the last third of the round, each scored card replays | replay card clock scores |
| quick_draw | Quick Draw | Hands played within 3 seconds of the previous hand add +1 to your Focu | focus hand clock scaling |
| patience_reward | The Heron | Adds mult equal to 2x the seconds passed since the last hand was playe | mult hand clock scores |
| first_play | Head Start | The round's first hand adds +5 Focus; each hand after adds 1 less, dow | focus hand |
| still_water | Eagle Eye | Score +10 mult for every 10 seconds elapsed without using a swap | mult hand clock scores |
| frozen_moment | The Falcon | Hands played while the clock is paused add +10 Focus | focus hand pause |
| swift | The Swift | +6 mult for every 10 seconds elapsed this round | mult hand clock scores |
| cuckoo | The Cuckoo | Every other hand pauses the clock for 1s for every 5 replays triggered | time hand replays |
| double_jeopardy | Double Jeopardy | 2 cells are secretly marked at round start; the first time you score f | time card position |
| woodpecker | The Woodpecker | Marks a random cell every 30 seconds; a card scored from the marked ce | replay card position clock scores |
| hummingbird | The Hummingbird | +3 mult for every clock pause or rewind triggered this game | mult hand pause scores scaling |
| albatross | The Albatross | +10 pips for every second the clock has spent paused this round | pips hand pause scores |
| vulture | The Vulture | Cards discarded during the round’s first pause permanently gain a 3s p | deck time card discard pause scaling |
| ticktock | Tick-Tock | Every time the clock ends in a 0, gain +4 Focus | focus other clock |
| quarter_chime | Quarter Chime | Every time the clock passes a multiple of 15s, your next hand scores + | pips hand clock scores |
| minute_hand | Minute Hand | Every time the clock passes a multiple of 30s, your next hand scores × | xmult hand clock scores |
| second_hand | Second Hand | Every time the clock passes a multiple of 10s, your next hand scores e | pips mult hand clock scores chance |
| hourglass | Hourglass | Each time the clock passes a 60s mark, there is a 50% chance to give a | deck replay other clock scores scaling chance |
| sediment | Sediment | Scores +10 pips for every 10 seconds elapsed this round | pips hand clock scores |
| kingfisher | The Kingfisher | +2 mult for every 2 seconds the clock has been paused or rewound this  | mult hand pause scores |
| magpie | Hyperphagia | Each hand rewinds the clock 1s for every 2 swaps + discards you hold | time hand held |
| mockingbird | Traveler | Every 4 hands you play without a same-type streak grants +1 swap | stock hand streak |
| starling | Type A | Every 2nd hand of an unbroken same-type streak grants +1 discard | stock hand streak |
| phoenix | The Phoenix | While the clock is paused, the Focus multiplier applies twice (hands t | focus hand pause scores |
| kindling | Kindling | Same-hand streaks score +8 mult × the streak count | mult hand streak scores |
| wildfire | Wildfire | Reaching a same-hand streak of 3 adds +5 Focus | focus hand streak |
| echo_hand | Echoes | Playing the same hand type as the previous hand replays each card | replay card streak scores |
| club_double | Hard Labour | Each club scored this round adds more and more pips: doubles each time | pips card suit scores |
| monochrome | Blood Diamonds | Hands containing exclusively hearts AND diamonds score +25 mult and gr | mult credits hand suit scores cost |
| full_color | Rainbow | Hands with all four suits score x1.25 mult per card | xmult card suit scores |
| balanced_diet | Balance | Hands with exactly 2 suits score +10 mult per card | mult card suit scores |
| lucky_sevens | Lucky Sevens | +5 Focus for each 7 scored or discarded | focus card rank discard |
| ninesong | Threepeat | If the hand's pip total is divisible by 3, one of the following happen | time mult focus hand scores chance |
| prime_time | Prime Time | Prime-ranked cards (A,2,3,5,7) score +29 pips | pips card rank scores |
| even_score | Get Even | Even-ranked cards score +16 pips | pips card rank scores |
| odd_squad | Odd One In | Odd-ranked cards score +7 mult | mult card rank scores |
| number_crunch | Diversity | Hands with 4+ different ranks score +8 mult per card | mult card rank scores |
| rowcol_triple_pips | Right Place | Cards scored in a marked row or column score +25 pips | pips card position scores line |
| rowcol_mult | Power Line | Cards scored in a marked row or column score +15 mult | mult card position scores line |
| rowcol_retrigger | Echo Location | Cards scored in a marked row or column have a 2 in 3 chance to replay | replay card position scores chance line |
| perfect_timing | Perfect Timing | Cards scored in a marked row or column replay once | replay card position scores line |
| right_time | Right Time | Cards scored in a marked row or column pause the clock for 2s | time card position line |
| study_hall | Study Hall | Every 2 cards scored adds +2 Focus | focus card |
| rowcol_perm_double | Ley Line | Cards scored at the intersection of a row effect and a column effect p | deck mult card position scaling scores |
| shape_square | Hands of Blue | A 2×2 shaped hand scores +24 mult and adds +16 Focus | mult focus hand position scores |
| shape_cross | Crossroads | A 5 card + shaped hand adds +25 Focus and +25 mult | mult focus hand position size scores |
| shape_line | Straight Shot | 5-card hands played in a straight line add every card's pip value to m | mult hand position size scores |
| corner_retrigger | Cornered | Corner cards score ×pips equal to the whole minutes left on the clock | xpips card position clock scores |
| two_corners | Ornery | Corner cards score ×2 mult | xmult card position scores |
| edge_pips | On the Edge | Cards scored on an edge score +15 pips | pips card position scores |
| wide_span_mult | Inclusive | Hands spanning the full width or height of the grid score +50 mult | mult hand position scores |
| column_rush (retired) | Stand Up | Hands with cards from only one column score +5 mult per card | mult card position scores |
| row_power | Lie Down | Hands with cards from only one row score +12 mult per card | mult card position scores |
| groove | Groove | This trick scales +1 Focus for every 2 cards scored from a marked row  | focus hand position line |
| assembly_line | Assembly Line | Cards scored in a marked row or column score +2 mult for every card pl | mult card position scores line |
| line_xpips | Live Wire | Cards scored in a marked row or column score ×1.2 pips | xpips card position scores line |
| line_xmult | High Voltage | Cards scored in a marked row or column score ×1.2 mult | xmult card position scores line |
| obligatory | Obligatory | Cards scored in a marked row or column have a 25% chance to force-trig | retrigger card position tricks chance line |
| suggestive | Suggestive | Cards scored in a marked row or column have a 35% chance to prime the  | retrigger card position tricks chance line |
| coin_sword | Coin and the Sword | Cards scored in a marked row or column have a 10% chance to pay credit | credits mult card position chance scores line |
| lie_up | Lie Up | Hands with cards from only one row or only one column score +24 mult | mult hand position scores |
| overtime | Overtime | Every hand rewinds the clock 1s for every 3 cards you have scored from | time hand position line |
| feng_shui | Feng Shui | Permanently scores +3 pips for each hand scored with a positional buff | pips hand position scores scaling |
| clean_sweep | Clean Sweep | Use every cell of any row or column within two hands to add +8 Focus a | focus credits hand position |
| middle_man | Middle Man | Each time you gain or lose credits during a round, this gains +3 mult | mult hand scores scaling |
| rising_tide | Rising Tide | Each level you pass while holding this adds +5 to +10 mult to it | mult hand level scores scaling chance |
| compound_mult | Compound | Each hand played permanently adds +0.1 mult to this trick | mult hand scores scaling |
| acorns | Acorns | Each card scored scales this trick +0.025 Focus, starting at +0; adds  | focus hand scaling |
| plan_ahead | Plan Ahead | Every 3rd hand adds Focus equal to 2x your average hands per round | focus hand |
| fives_discard | Penny Saved | Each 5 discarded or played permanently adds +5 pips to this trick | pips hand rank discard scores scaling |
| nines_mult | Cloud Nine | Adds 9 9s to your deck. Each 9 scored adds +2 mult to this trick. A 9  | deck mult hand rank discard scores scaling cost |
| tens_mult | Perfect Ten | Every 9 cards discarded or played permanently adds +3 mult to this tri | mult hand discard scores scaling |
| sixes_perm | D6 | Every 6th card scored permanently gains a random +1–6 pips or mult | deck pips mult card scaling scores chance |
| fours_perm | Middle Management | 4-card hands permanently give the 4th card +8 pips | deck pips card size scaling scores |
| twos_retrigger | Double Take | Each 2 scored force triggers your rightmost Trick (other than this one | retrigger card rank tricks |
| prime_times | Prime Times | Scoring prime-ranked cards (A,2,3,5,7) primes your leftmost Trick | retrigger card rank tricks |
| eights_retrigger | Sideways to Infinity | Each scored 8 replays once for each other 8 in the hand | replay card rank scores |
| queens_upgrade | Royal Favour | Scoring a card adjacent to a Queen permanently increases that card's r | deck card rank position clock scaling cost |
| aces_absorb | Ace Absorb | When an Ace scores, 50% chance to permanently remove one random unscor | deck card rank scaling chance cost |
| monopoly | Monopoly | When a 15 or a 20 scores, one random adjacent card is forgotten and it | deck card rank position scaling cost |
| sands_of_time | Sands of Time | Score +pips equal to time remaining ÷ 2 | pips hand clock scores |
| discard_pips | Compost | +4 mult per card discarded this round | mult hand discard scores |
| spade_flood | Dark Matter | All-Spade hands add the remaining round time as pips | pips hand suit clock scores |
| mirror | Mirror | Tap to tilt left or right; mimics the effect of the Trick it reflects. | retrigger hand tricks |
| combo_score | Combo Score | +6 mult for every distinct hand type played this round | mult hand scores |
| move_as_one (retired) | Move as One | If 2+ of your Tricks share a keyword, a random Trick sharing that keyw | retrigger hand tricks |
| more_better | More Better | Each reward grid where you select 3+ tiles permanently adds +9 mult to | mult hand reward scores scaling |
| rain_check (retired) | Rain Check | Skipping a reward: the next round starts with +30s (in Flow, rewind th | time other reward |
| temporal_rift | Temporal Rift | A card scored where a row and column effect intersect force triggers t | retrigger card position tricks |
| wild_side | Wild Side | +6 mult, scaling, for every negative reward tile you take | mult hand reward scores scaling |
| wait_for_it (retired) | Wait For Iiiit | Each negative reward tile taken this run gives every scored card a +3% | replay card reward level scores scaling chance |
| meditation | Meditation | Focus decays 2 seconds slower | focus other |
| tunnel_vision | Tunnel Vision | Start each round with 10 Focus | focus other start |
| first_wind | First Wind | Focus does not decay for the first 45 seconds of a round | focus other clock |
| rhythm | Rhythm | Each hand played adds 2 additional Focus | focus hand |
| cull | Cull | Discarding or swapping adds +2 Focus per 2 remaining swaps and discard | focus other discard swap |
| expanse | Expanse | Each time you hit your Focus limit, increase it by 1 (max +10), then l | focus other scaling cost |
| kaleidoscope | Kaleidoscope | Apply the Focus multiplier a number of times equal to the number of su | focus hand suit scores |
| flow_state | Flow State | While focus is ×1.5 or higher, score +15 pips per card | pips card scores held |
| hyper_focus | Hyper Focus | Each card scored adds mult equal to 2x your Focus multiplier | mult card scores |
| heartwood | Heartwood | When scored, the center-most card gains +5 pips & +5 mult | deck pips mult card position scaling scores |
| landfill | Landfill | Score +5 mult per card for every discard or swap used this round (+3 i | mult card discard swap scores |
| old_growth | Old Growth | Cards add their pip value to mult | mult card scores |
| magician | Magician | +50 pips if you own no Sleights, or +6 mult for each Sleight you own | pips mult hand sleights scores |
| stand_up | Stand-Up | Hands with cards from only one column score +12 mult per card | mult card position scores |
| scalper | Scalper | Score ×1 mult, +×0.25 per charge your Sleights are missing | xmult hand sleights scores |
| five_stack | Five Stack | Each card in a 5-card hand scores +20 pips, +5 mult, and +1 Focus | pips mult focus card size scores |
| little_guys | the little guys | A 5-card hand with no face cards increases your Focus limit by 1 (max  | focus hand size rank scaling |
| five_fodder | Five for Fodder | Discarding a valid hand grants the hand size in credits | credits other discard |
| five_second | Five Second Rule | 5-card hands pause the clock for 5s | time hand size |
| life_lessons | Life Lessons | Each round you complete increases your Focus limit by 1 | focus other level scaling |
| wellspring | Wellspring | For every 30 Focus generated this game, this trick scores +1 mult | mult hand scores scaling |
| third_down | 3rd Down | 3-card hands add +3 Focus | focus hand size |
| ready_set_go | Ready, Set, Go | A 3-card hand containing a 3, 6 or 9 scores +18 mult | mult hand size rank scores |
| third_charm | 3rd Time's a Charm | The 3rd card of a hand replays 2x | replay card scores |
| four_eyes | Four Eyes | 4-card hands score +24 mult | mult hand size scores |
| four_by_four (retired) | 4x4 | Cards scored in the 4th and 6th columns score +24 pips | pips card position scores line |
| four_horseman | Four Horse-man | 4-card hands grant a random bonus: +24 pips, +24 mult, +8 Focus, or pa | pips mult focus time hand size scores chance |
| wait_four_it | Wait Four It | 4-card hands permanently buff their 4th card with a 2s pause (cannot s | deck time card size scaling |
| undue_influence | Undue Influence | A Set containing a face card grants credits equal to the number of Set | credits hand set rank |
| encore | Encore | Odd-ranked cards in a set replay once | replay card set rank scores |
| shaky_foundation | Shaky Foundation | Every other Set scores +18 mult | mult hand set scores |
| obsessed | Obsessed | Each heart applies x mult equal to 1 + (credits / 100). 50 credits = x | xmult card suit scores held |
| buried_treasure | Buried Treasure | Each scored diamond has a chance equal to half your Luck to apply x1.1 | credits card suit chance held |
| relentless | Relentless | Each spade scores x0.05 mult for every spade scored since you took thi | xmult card suit scores scaling |
| patient_rulers | Patient Rulers | If you have paused or rewound the clock this round, face cards score x | xmult card rank pause scores |
| even_better | Even Better | Even-ranked cards have a 66% chance to score x2.25 pips | xpips card rank scores chance |
| what_odds | What are The Odds | Odd-ranked cards score x1.7 mult | xmult card rank scores |
| critical | Critical | Flush type hands score x5 mult | xmult hand flush scores |
| twinners | Twinners | Set type hands score x3 pips | xpips hand set scores |
| feelin_lucky | Feelin Lucky | Five randomly rolled ranks score x1.25 mult. Trying to sell this costs | xmult card rank scores chance cost |
| marathon | Marathon | Run type hands apply the Focus multiplier 1 extra time(s) | focus hand run scores |
| dam_holding | Dam Holding… | Runs pause the clock for 3s | time hand run |
| wave_amp | Wave Amplification | Consecutively played Runs score +15 pips × the streak count | pips hand run streak scores |

## SLEIGHT_POOL (49)

| id | name | desc (first 70) | tags |
|---|---|---|---|
| the_queen | The Queen | The rank of this sleight is Queen. It scores +10 pips, +10 mult, and p | pips mult time card wild rank scores |
| warehouse | Warehouse | Counts as 2 cards of any suit for the purpose of completing a flush. H | hand wild flush scores |
| the_ringer | The Ringer | While on the grid, a hand you submit pulls in one more card off the bo | board hand scores |
| fight_power | Fight the Power | While on the grid, all boss effects are ignored (3 minutes of use, eac | shield other boss |
| dazed | Fresh Start | When discarded, shuffles all cards back into the deck and redeals. Cos | board other cost |
| pivot | Pivot! | Cards touching Pivot swap for free. Swap two of its neighbours togethe | stock deck mult other swap position scaling scores |
| echo_play | Echo | Play this in any hand: each card replays 2x. (3 charges) | replay card scores |
| the_naturalist | Naturalist | Play this: each other scored card permanently gains +3 pips. | deck pips card scaling scores |
| bellhop | Bellhop | Play this: gain +2 swaps and +2 discards. (5 charges) | stock hand |
| syncopation | Syncopation | Play this in a hand of a different type than your previous hand: pause | time hand streak |
| rewind | Rewind | Play this in a hand to rewind the clock 1s for each card in the hand,  | time hand size |
| retake | Retake | Play this in a hand: it and the cards played with it go back into the dec | deck hand |
| the_bomb | Bomb | Discard this: every card on the grid permanently gains +3 pips. (2 cha | deck pips other scaling scores |
| the_legacy | Legacy | Discard this: the next hand played get x3 mult. (3 charges) | xmult hand scores |
| cash_out | Cash Out | Discard this: gain 10 credits. (3 charges) | credits other |
| last_call | Last Call | Discard this: rewind the clock 15s. (3 charges) | time other |
| sandbag | Sandbagger | Discard this with a pair to rewind the clock by that pair’s rank in se | time other set rank |
| procrastinate | Procrastinate | Discard this: the 8 cards around it go with it, costing no time. Coun | board other discard position |
| shredder | Shredder | Discard this: deletes 1 of the cards discarded with it, for good. (3 ch | deck other discard |
| lightning_rod | Lightning Rod | When swapped, the card it traded with permanently gains +10 pips. | deck pips card scaling scores |
| the_catalyst | Catalyst | When swapped, the card it traded with permanently gains +5 mult. | deck mult card scaling scores |
| the_wanderer | Wanderer | While on grid: allows any two cards to be swapped regardless of positi | stock other swap |
| amplifier | Amplifier | Double-tap: the next hand scores mult equal to the current level x3. ( | mult hand scores |
| snooze | Snooze Button | Double-tap: pause the clock for 10s, then Snooze returns to your deck. | time other |
| shady_tree | Shady Tree | Play this from column x (changes each round) to pause the clock for 1s | time hand position |
| stopwatch | Stopwatch | Double-tap: pause the clock until your next played hand (60s of use, e | time other |
| piggy_bank | Piggy Bank | Double-tap: gain 5 credits, once per round. Becomes inert on use: it c | credits other cost |
| magnet | Magnet | Double-tap, then tap any card: pull every card of that rank in to repl | board other rank position cost |
| photocopier | Photocopier | Double-tap: picks a card beside it at random and makes 4 temp copies o | board deck other position buffed |
| logistics_assistant | Logistics Assistant | Double-tap: finds swaps that make a playable hand and makes them one b | board other swap |
| keeper | Keeper | While on the grid, the board stays as it is between rounds instead of  | board other level |
| lockbox | Lockbox | Double-tap: take out the cards you bought at the Card Market. Tap a ca | deck board other |
| dealers_choice | Dealer's Choice | Double-tap: hold three cards using ranks on the board (most carry a bu | board other chance cost |
| all_hands | All Hands | Double-tap: plays every hand on the board, left to right, top to botto | other |
| reflect | Reflect | Tap to rotate its aim. The rank it faces replays 2x when scored. Canno | replay card rank position scores |
| soul_mirror | Soul Mirror | Tap to rotate its aim. When the rank it faces is scored, it replays on | replay card rank position scores |
| autopilot | Autopilot | Costs 5 Focus when it lands on the board. 30s later it plays the best  | focus other cost scores |
| whetstone | Whetstone | Whenever an adjacent card is swapped or discarded, Whetstone gains +2  | mult hand position swap discard scores scaling |
| entourage | Entourage | Hands score +10 mult for every other Sleight on the grid. | mult hand sleights scores |
| lighthouse | Lighthouse | Each round Lighthouse picks either the first or last column. All hands | mult hand position scores |
| capacitor | Capacitor | Double-tap: spend 10 Focus and 10 seconds for 10 credits. Becomes iner | credits other cost |
| siphon | Siphon | Double-tap to spend 15 Focus: your next scored hand gets ×4 mult. Disc | xmult hand scores cost |
| power_cell | Power Cell | When it enters the grid: +10 Focus. While it remains on the grid: +10  | focus other |
| slow_burn | Slow Burn | +1 to your Focus limit for every 45 seconds this sleight spends on the | focus other clock |
| governor | Governor | While on the grid, you have 1.5× as long to earn the same Focus speed  | focus other |
| shift_swap | Shift Swap | Score two cards adjacent to this sleight to get +2 swaps. Discards its | stock other position |
| recycler | Recycler | Score two cards adjacent to this sleight to get +2 discards. Discards  | stock other position |
| time_clock | Time Clock | Score two hands beside this card to pause the clock for 10s, then it g | time other position |
| petty_cash | Petty Cash | Score two hands beside this card to get +5 credits. Discards itself af | credits other position |

## KNACK_POOL (76)

| id | name | desc (first 70) | tags |
|---|---|---|---|
| move_as_one | Move as One | If 2+ of your Tricks share a keyword, a random Trick sharing that keyw | retrigger hand tricks |
| rain_check | Rain Check | Skipping a reward: the next round starts with +30s (in Flow, rewind th | time other reward |
| wait_for_it | Wait For Iiiit | Each negative reward tile taken this run gives every scored card a +3% | replay card reward level scores scaling chance |
| head_count | Head Count | The Sleight queue (the button on your Trick tray) shows how many cards | info other sleights |
| card_counter | Card Counter | Double-tap the hand preview to see the draw queue: the next cards in d | info other |
| advance_notice | Advance Notice | While you hold it, its tooltip names the boss waiting at the end of th | info other boss |
| contingency | Contingency Plan | Boss effects are 10% weaker - timed effects tick 10% less often, and e | shield other boss |
| free_swaps | Free Swaps | Swapping cards costs no time. | stock other swap |
| free_discards | Free Discards | Discarding costs no time. | stock other discard |
| steady_hand | Steady Hand | Swaps no longer count against the swap limit, but cost 2× time. | stock other swap cost |
| hoarder | Spoiled | Discards no longer count against the discard limit, but cost 2× time. | stock other discard cost |
| time_bank | Time Bank | Every round starts with +30s. | time other start |
| inheritance | Inheritance | Start each round with +5 credits. | credits other start |
| short_change | Short Change | Each hand you play with fewer cards than your hand size earns 1 credit | credits hand size |
| bulk_buyer | Bulk Buyer | The shop multi-buy discount is 5% per extra item instead of 3%. | credits other shop |
| haggler | Haggler | Shop prices are 5% lower. | credits other shop |
| time_and_a_half | Time and a Half | Leftover round time pays double: 1 credit per 10 seconds remaining ins | credits other level clock |
| gross_pay | Gross Pay | Your payout lines are uncapped. Interest and unused stock pay in full. | credits other level |
| high_roller | High Roller | Each scored card has a chance to replay equal to your credits plus you | replay card scores chance held |
| combo_keeper | Combo Keeper | Streaks survive one non-streak hand. Re-arms after 2 streak hands. | other streak |
| lucky_seven | Lucky Seven | Every 7th hand played gives +1 swap. | stock hand |
| extra_swaps | Swap Shop | Start each round with +2 extra swaps. After each boss you beat, 60% ch | stock other boss scaling chance start |
| extra_discards | Harvest | Start each round with +2 extra discards. After each boss you beat, 60% | stock other boss scaling chance start |
| carry_swaps | Pack Rat | Unused swaps carry over to the next round (max 8). | stock other level |
| carry_discards | Collector | Unused discards carry over to the next round (max 8). | stock other level |
| carry_time | Clock Tower | The next round starts with the seconds this round ends with (max 60s). | time other level clock |
| safety_net | Safety Net | Once per game: if you miss the round goal, the round goes on with 30s  | shield time other level |
| last_swap | Last Swap | End a round with exactly one swap left and you can trade two touching  | other reward level cost |
| free_range_t | Free Range | Can swap any two non-adjacent cards, but limited to 2 swaps per round. | stock other swap cost |
| understudy | Understudy | Every 30 seconds one of your tricks is primed: it fires an extra time  | retrigger other clock tricks |
| hallmark | Hallmark | Once a round a card on the board is marked. Score it and it takes a ra | deck card position scaling chance |
| turnover | Turnover | Any card you leave alone for 45 seconds becomes Fodder until it leaves | stock other clock swap discard |
| challenge_dial | Challenge Dial | Challenge cards show up 25% more often. Double-tap this to make them 2 | luck other challenge |
| free_hand | Free Hand | Double-tap the Focus bar: spend 10 Focus and swaps and discards cost n | stock other swap discard cost |
| charged_card | Charged Card | Double-tap the Focus bar: spend 10 Focus and the first card of your ne | deck other scaling chance cost |
| shuffle_up | Shuffle Up | Double-tap the Focus bar: spend 10 Focus and every card on the board c | board other cost |
| double_down | Double Down | Double-tap the Focus bar: spend 10 Focus and Focus applies twice for y | focus other cost scores |
| overdrive | Overdrive | Double-tap the Focus bar: the board plays its best hand for 5 Focus, a | xmult focus other scores cost |
| long_pause | Long Pause | All clock pauses last 1.5× as long. | time other pause |
| sundial | Sundial | Hands where every card shares a column pause the clock for 8s. | time hand position |
| metronome | Metronome | Each round a hand type you can make is chosen; playing that hand type  | time hand chance start |
| time_slip | Time Slip | Whenever the clock would pause, 25% chance to rewind the clock that ma | time other pause chance |
| replay_rewind | Rewound Echo | Any time a card replays, 25% chance to rewind the clock 2s. | time card chance replays |
| deja_vu | Déjà Vu | Playing the same ranks in two hands in a row rewinds the clock 15s. | time hand rank |
| clockmaker | Clockmaker | Any time a single hand scores at least 30% of the round goal, rewind t | time hand |
| high_and_mighty | High and Mighty | The highest-ranked cards in each scored hand replay once. | replay card scores rank |
| low_and_behold | Low and Behold | Any played hand containing the grid’s lowest rank replays the whole ha | replay hand scores rank |
| down_and_back_in | Down and Back In | Discarding a card of the grid’s highest rank grants +2 discards or +2  | stock credits other discard rank |
| muscle_memory | Buddy System | Whenever a Trick is primed, a different Trick is primed too. | retrigger other tricks |
| curator | Curator | +1 Trick Slot. After each boss you beat, 60% chance it gives 1 more. | limit other boss scaling chance |
| short_suit | Short Suit | Flush of 3 and Flush of 4 become scorable hands. | other flush size |
| old_tricks | Old Tricks | Every hand type scores with the best growth anywhere in its family - s | hand scores |
| threes_crowd_k | Three's a Crowd | Hands count as 1 card bigger than they are for your entities: a Pair i | hand size |
| tagalong | Tagalong | Your hands may carry any number of kickers, and kickers cost nothing. | hand |
| stand_in | Stand-In | Wilds score as the card they stand in for: in a set, that rank; in a r | card wild scores |
| kick_in | Pip In | Kickers cost nothing, and score their pips and fire Tricks as though t | pips card scores |
| shady_stimulants | Shady Stimulants | Every negative reward tile you take raises your Focus limit by 1. | focus other reward scaling |
| greedy_boi | Greedy Boi | +2 selection size in the reward grid - grab more tiles at once. | other reward |
| scavenger | Scavenger | Whenever a curse lifts, gain +10 coins and +1 discard next round. | credits stock other |
| coin_toss | Coin Toss | At the start of each round, every Sleight has a 50% chance to restore  | other sleights chance charges start |
| green_station | Green Station | Sleights have a 30% chance to get a charge back at the end of each rou | other sleights chance charges level |
| martyr | Martyr | Discarding a non-discard Sleight restores 1 charge to all Sleights on  | other sleights discard charges |
| surveyor | Surveyor | When you gain a position Trick, you choose which column it marks. | other tricks position line |
| leveler | Leveler | When you gain a position Trick, you choose which row it marks. | other tricks position line |
| district | District | Position Tricks may share a row or column instead of spreading onto se | other tricks position line |
| tempo | Tempo | When acquired, sets your swap and discard limits to 2. Every 15 second | stock other clock cost |
| jury_rig | Jury-Rig | Swapping or discarding a card adjacent to a Sleight has a 50% chance t | other sleights position swap discard chance charges |
| dividend | Dividend | Each time you hit your Focus limit, gain 8 credits, then Focus resets  | credits other cost |
| trade_winds | Trade Winds | Your Focus limit is 10 lower. At the end of each round, gain credits e | credits focus other level cost |
| knock_on | Knock-On | Whenever a limit other than Focus Cap goes up, another random limit go | limit other |
| four_by_four | 4x4 | Scored 4s have a 44% chance to force trigger the Trick in slot 4 | retrigger card rank chance tricks |
| growth_spurt | Growth Spurt | Each time you hit your Focus limit, the limit drops by 5. If you hit i | limit focus other level cost |
| stimulants | Stimulants | +10 to your Focus limit. | focus other |
| long_fuse | Long Fuse | You have 2× as long to earn the same Focus speed bonus. | focus other |
| shorthand | Shorthand | Hands generate 1.5× their listed Focus. | focus other |
| core_memories | Core Memories | Each Event you attend raises your Focus limit by 2. | focus other scaling |

## DECISIONS (owner, r635)

- A Focus payer that makes Focus APPLY more times is `scores` (Phoenix, Kaleidoscope, Marathon,
  Autopilot, Double Down, Overdrive). A plain Focus payer is not.
- A permanent card buff is `deck` + its buff kind + `scaling` + `scores`.
- Relative rank (highest / lowest / adjacent in rank) is `rank`, like a named rank.
- A Sleight that fires on a discard or a swap carries no `discard` / `swap` WHEN tag: its
  activation is its own dropdown. Tricks and Knacks that fire on those actions do carry them.
- A discard- or swap-triggered Trick is scoped `other` (the SCOPE dropdown: per card, per hand,
  elsewhere), not `hand`.
- `start` (WHEN, Round start) is new: Tunnel Vision, Time Bank, Inheritance, Swap Shop, Harvest,
  First Fruits, Metronome, Coin Toss.
- Cards scoring again are a REPLAY (`replay` in PAYS; `replays` in WHEN for what fires on one:
  Rerun, Chorus, The Cuckoo, Replay Rewind). A Trick firing again is a RETRIGGER (`retrigger` in
  PAYS, which replaces `prime`: primes, mirrors, force-triggers, Move as One).
- `charges` (PAYS, Sleight charges) is new: Coin Toss, Martyr, Jury-Rig.
- `held` (WHEN, r642: cares what you are holding) is new, one tag for all of it: Interest, Obsessed,
  High Roller (credits), Buried Treasure (Luck), Hyperphagia (stock), Flow State (the Focus level).

## STILL OPEN

- Round START vs round END: `start` is new; round END stays `level`.
- The registry still lacks: curses, Events, pure rule changes with no axis (Combo Keeper, Tagalong,
  Greedy Boi, Short Suit, Last Swap carry an empty PAYS).
