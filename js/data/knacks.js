const KNACK_POOL = [
  // ── r625 (owner): three Tricks became Knacks. Same ids, so BAL and the templates carry over. ──
  { id:'move_as_one',   emoji:'🔀',  name:'Move as One',      rarity:'epic',   desc:'If 2+ of your Tricks share a keyword, a random Trick sharing that keyword scores its effect a second time each time all of them are triggered', tags:['retrigger','hand','tricks'] },
  { id:'rain_check',    emoji:'⏱️',  name:'Rain Check',       rarity:'epic',   desc:'Skipping a reward: the next round starts with +30s (in Flow, rewind the clock 30s)', tags:['time','other','reward'] },
  { id:'wait_for_it',   emoji:'🎲',  name:'Wait For Iiiit',   rarity:'epic',   desc:'Each negative reward tile taken this run gives every scored card a +3% chance to replay. In Flow: each level-up that pays a single reward gives +5% instead, Luck aside', tags:['replay','card','reward','level','scores','scaling','chance'] },
  // ── Queue-view knacks (r329, js/queue-views.js) ──
  { id:'head_count',      emoji:'🔢',  name:'Head Count',       rarity:'common', desc:'The Sleight queue (the button on your Trick tray) shows how many cards sit in front of each Sleight.', tags:['info','other','sleights'] },
  { id:'card_counter',    emoji:'🂠',  name:'Card Counter',     rarity:'rare',   desc:'Double-tap the hand preview to see the draw queue: the next cards in draw order, left to right, 2x your column count. Double-tap again to put it away.', tags:['info','other'] },
  { id:'advance_notice',  emoji:'📋',  name:'Advance Notice',   rarity:'rare',   desc:'While you hold it, its tooltip names the boss waiting at the end of the NEXT quarter. Sell it and a different boss takes that slot.', tags:['info','other','boss'] },
  { id:'contingency',     emoji:'🛡️',  name:'Contingency Plan', rarity:'rare',   desc:'Boss effects are 10% weaker - timed effects tick 10% less often, and everything else is 10% smaller.', tags:['shield','other','boss'] },
  { id:'free_swaps',      emoji:'🕊️',  name:'Free Swaps',       rarity:'common', desc:'Swapping cards costs no time.', tags:['stock','other','swap'] },
  { id:'free_discards',   emoji:'🪶',  name:'Free Discards',    rarity:'common', desc:'Discarding costs no time.', tags:['stock','other','discard'] },
  { id:'steady_hand',     emoji:'♾️',  name:'Steady Hand',      rarity:'common', desc:'Swaps no longer count against the swap limit, but cost 2× time.', tags:['stock','other','swap','cost'] },
  { id:'hoarder',         emoji:'🗑️',  name:'Hoarder',          rarity:'common', desc:'Discards no longer count against the discard limit, but cost 2× time.', tags:['stock','other','discard','cost'] },
  { id:'time_bank',       emoji:'⏳',  name:'Time Bank',        rarity:'rare',   desc:'Every round starts with +30s.', tags:['time','other','start'] },
  { id:'inheritance',     emoji:'💰',  name:'Inheritance',      rarity:'rare',   desc:'Start each round with +5 credits.', tags:['credits','other','start'] },
  { id:'short_change',    emoji:'🤏',  name:'Short Change',     rarity:'common', desc:'Each hand you play with fewer cards than your hand size earns 1 credit.', tags:['credits','hand','size'] },
  { id:'bulk_buyer',      emoji:'🛒',  name:'Bulk Buyer',       rarity:'rare',   desc:'The shop multi-buy discount is 5% per extra item instead of 3%.', tags:['credits','other','shop'] },
  { id:'haggler',         emoji:'🤝',  name:'Haggler',          rarity:'rare',   desc:'Shop prices are 5% lower.', tags:['credits','other','shop'] },
  { id:'time_and_a_half', emoji:'🕰️',  name:'Time and a Half',  rarity:'rare',   desc:'Leftover round time pays double: 1 credit per 10 seconds remaining instead of 20.', tags:['credits','other','level','clock'] },
  { id:'gross_pay',       emoji:'🧾',  name:'Gross Pay',        rarity:'rare',   desc:'Your payout lines are uncapped. Interest and unused stock pay in full.', tags:['credits','other','level'] },
  { id:'high_roller',     emoji:'🎰',  name:'High Roller',      rarity:'epic',   desc:'Each scored card has a chance to replay equal to your credits plus your Luck, as a percent. Over 100% guarantees a replay and rolls the remainder for another.', tags:['replay','card','scores','chance','held'] },
  { id:'combo_keeper',    emoji:'🔥',  name:'Combo Keeper',     rarity:'rare',   desc:'Streaks survive one non-streak hand. Re-arms after 2 streak hands.', tags:['other','streak'] },
  { id:'lucky_seven',     emoji:'🎯',  name:'Lucky Seven',      rarity:'common', desc:'Every 7th hand played gives +1 swap.', tags:['stock','hand'] },
  { id:'extra_swaps',     emoji:'🔄',  name:'Swap Shop',        rarity:'common', desc:`Start each round with +2 extra swaps. After each boss you beat, ${KNACK_BOSS_GROW_PCT}% chance it gives 1 more.`, tags:['stock','other','boss','scaling','chance','start'] },
  { id:'extra_discards',  emoji:'🌾',  name:'Harvest',          rarity:'common', desc:`Start each round with +2 extra discards. After each boss you beat, ${KNACK_BOSS_GROW_PCT}% chance it gives 1 more.`, tags:['stock','other','boss','scaling','chance','start'] },
  { id:'carry_swaps',     emoji:'🎒',  name:'Pack Rat',         rarity:'common', desc:'Unused swaps carry over to the next round (max 8).', tags:['stock','other','level'] },
  { id:'carry_discards',  emoji:'📦',  name:'Collector',        rarity:'common', desc:'Unused discards carry over to the next round (max 8).', tags:['stock','other','level'] },
  { id:'carry_time',      emoji:'🕰️',  name:'Clock Tower',      rarity:'rare',   desc:'The next round starts with the seconds this round ends with (max 60s).', tags:['time','other','level','clock'] },
  { id:'safety_net',      emoji:'🪢',  name:'Safety Net',       rarity:'rare',   desc:'Once per game: if you miss the round goal, the round goes on with 30s on the clock instead of failing.', tags:['shield','time','other','level'] },
  { id:'last_swap',       emoji:'🔀',  name:'Last Swap',        rarity:'rare',   desc:'End a round with exactly one swap left and you can trade two touching tiles on the reward grid. Double-tap a tile, then tap its neighbour. Uses the swap.', tags:['other','reward','level','cost'] },
  { id:'free_range_t',    emoji:'🦅',  name:'Free Range',       rarity:'rare',   desc:'Can swap any two non-adjacent cards, but limited to 2 swaps per round.', tags:['stock','other','swap','cost'] },
  { id:'understudy',      emoji:'🎭',  name:'Understudy',       rarity:'rare',   desc:'Every 30 seconds one of your tricks is primed: it fires an extra time on your next hand.', tags:['retrigger','other','clock','tricks'] },
  { id:'hallmark',        emoji:'🔖',  name:'Hallmark',         rarity:'rare',   desc:'Once a round a card on the board is marked. Score it and it takes a random buff.', tags:['deck','card','position','scaling','chance'] },
  { id:'turnover',        emoji:'♻️',  name:'Turnover',         rarity:'rare',   desc:'Any card you leave alone for 45 seconds becomes Fodder until it leaves the board: swapping or discarding it costs no time and no stock.', tags:['stock','other','clock','swap','discard'] },
  // r556 (owner): a dial you turn by double-tapping the chip. challengeDial (js/challenge-round.js) holds its direction.
  { id:'challenge_dial',  emoji:'🎚️',  name:'Challenge Dial',   rarity:'rare',   desc:'Challenge cards show up 25% more often. Double-tap this to make them 25% rarer instead, and back.', tags:['luck','other','challenge'] },
  // ── Focus knacks (r571): what a double-tap on the Focus bar does. One at a time (js/focus-knacks.js). ──
  { id:'free_hand',       emoji:'🖐️',  name:'Free Hand',        rarity:'rare',   desc:'Double-tap the Focus bar: spend 10 Focus and swaps and discards cost no time and no stock for 10 seconds. Replaces the Reserve.', tags:['stock','other','swap','discard','cost'] },
  { id:'charged_card',    emoji:'🔋',  name:'Charged Card',     rarity:'rare',   desc:'Double-tap the Focus bar: spend 10 Focus and the first card of your next hand takes a random buff. Replaces the Reserve.', tags:['deck','other','scaling','chance','cost'] },
  { id:'shuffle_up',      emoji:'🔀',  name:'Shuffle Up',       rarity:'common', desc:'Double-tap the Focus bar: spend 10 Focus and every card on the board changes place. Replaces the Reserve.', tags:['board','other','cost'] },
  { id:'double_down',     emoji:'✌️',  name:'Double Down',      rarity:'epic',   desc:'Double-tap the Focus bar: spend 10 Focus and Focus applies twice for your next 3 hands. Replaces the Reserve.', tags:['focus','other','cost','scores'] },
  { id:'overdrive',       emoji:'⚡',  name:'Overdrive',        rarity:'epic',   desc:'Double-tap the Focus bar: the board plays its best hand for 5 Focus, again and again until Focus runs out. Hand 1 scores x1.5 mult, hand 2 x2, and so on. These hands make no Focus of their own. Then 45 seconds to cool down. Replaces the Reserve.', tags:['xmult','focus','other','scores','cost'] },
  { id:'long_pause',      emoji:'🦉',  name:'Long Pause',       rarity:'common', desc:'All clock pauses last 1.5× as long.', tags:['time','other','pause'] },
  { id:'sundial',         emoji:'🌇',  name:'Sundial',          rarity:'common', desc:'Hands where every card shares a column pause the clock for 8s.', tags:['time','hand','position'] },
  { id:'metronome',       emoji:'🥁',  name:'Metronome',        rarity:'common', desc:'Each round a hand type you can make is chosen; playing that hand type pauses the clock for 5s.', tags:['time','hand','chance','start'] },
  // ── Rewind knacks ──
  { id:'time_slip',       emoji:'⏮️',  name:'Time Slip',        rarity:'common', desc:'Whenever the clock would pause, 25% chance to rewind the clock that many seconds instead.', tags:['time','other','pause','chance'] },
  { id:'replay_rewind',   emoji:'🔂',  name:'Rewound Echo',     rarity:'common', desc:'Any time a card replays, 25% chance to rewind the clock 2s.', tags:['time','card','chance','replays'] },
  { id:'deja_vu',         emoji:'🔁',  name:'Déjà Vu',          rarity:'common', desc:'Playing the same ranks in two hands in a row rewinds the clock 15s.', tags:['time','hand','rank'] },
  { id:'clockmaker',      emoji:'⏱️',  name:'Clockmaker',       rarity:'rare',   desc:'Any time a single hand scores at least 30% of the round goal, rewind the clock 15s.', tags:['time','hand'] },
  // ── Combo batch (r83) ──
  { id:'high_and_mighty', emoji:'👑',  name:'High and Mighty',  rarity:'rare',   desc:'The highest-ranked cards in each scored hand replay once.', tags:['replay','card','scores','rank'] },
  { id:'low_and_behold',  emoji:'🐛',  name:'Low and Behold',   rarity:'rare',   desc:'Any played hand containing the grid’s lowest rank replays the whole hand once.', tags:['replay','hand','scores','rank'] },
  { id:'down_and_back_in',emoji:'🔁',  name:'Down and Back In', rarity:'common', desc:'Discarding a card of the grid’s highest rank grants +2 discards or +2 swaps (alternating) and +5 credits.', tags:['stock','credits','other','discard','rank'] },
  { id:'muscle_memory',   emoji:'🤝',  name:'Buddy System',     rarity:'common', desc:'Whenever a Trick is primed, a different Trick is primed too.', tags:['retrigger','other','tricks'] },
  { id:'curator',         emoji:'✦',   name:'Curator',          rarity:'rare',   desc:`+1 Trick Slot. After each boss you beat, ${KNACK_BOSS_GROW_PCT}% chance it gives 1 more.`, tags:['limit','other','boss','scaling','chance'] },
  { id:'short_suit',      emoji:'🃏',  name:'Short Suit',       rarity:'rare',   desc:'Flush of 3 and Flush of 4 become scorable hands.', tags:['other','flush','size'] },
  // ── Natural Scaling knack (r198) ──
  // Natural Scaling is per HAND TYPE now, so a family's growth sits in whichever
  // hand you actually play. This pools it: every hand in a family reads the best
  // bonus in that family. It REPLACES the hand's own bonus, never adds to it.
  { id:'old_tricks',      emoji:'🎩',  name:'Old Tricks',       rarity:'epic',   desc:'Every hand type scores with the best growth anywhere in its family - sets, runs and flushes each pool their own. It replaces what that hand had earned, it does not add to it.', tags:['hand','scores'] },
  // ── Passenger knack (r201) ──
  // A hand normally has to use every card you select; a spare makes it not a hand,
  // and the spare is billed as a penalty card. This lifts that.
  { id:'threes_crowd_k', emoji:'👥',  name:"Three's a Crowd", rarity:'rare',   desc:'Hands count as 1 card bigger than they are for your entities: a Pair is a 3-card hand, Two Pair a 5-card hand. Cards carried along do not count. Natural Scaling is unaffected.', tags:['hand','size'] },
  { id:'tagalong',       emoji:'🧳',  name:'Tagalong',        rarity:'rare',   desc:'Your hands may carry any number of kickers, and kickers cost nothing.', tags:['hand'] },
  { id:'stand_in',       emoji:'🃏',  name:'Stand-In',       rarity:'rare',   desc:'Wilds score as the card they stand in for: in a set, that rank; in a run, the lowest card; in a flush alone, a 2 of the flush suit.', tags:['card','wild','scores'] },
  { id:'kick_in',        emoji:'🪙',  name:'Pip In',         rarity:'rare',   desc:'Kickers cost nothing, and score their pips and fire Tricks as though they were in the hand. They do not change the hand type.', tags:['pips','card','scores'] },
  // ── Reward-grid / risk knacks (r129) ──
  { id:'shady_stimulants',emoji:'💊',  name:'Shady Stimulants', rarity:'rare',   desc:'Every negative reward tile you take raises your Focus limit by 1.', tags:['focus','other','reward','scaling'] },
  { id:'greedy_boi',      emoji:'🤑',  name:'Greedy Boi',       rarity:'rare',   desc:'+2 selection size in the reward grid - grab more tiles at once.', tags:['other','reward'] },
  { id:'scavenger',       emoji:'🦴',  name:'Scavenger',        rarity:'common', desc:'Whenever a curse lifts, gain +10 coins and +1 discard next round.', tags:['credits','stock','other'] },
  { id:'coin_toss',       emoji:'🪙',  name:'Coin Toss',        rarity:'common', desc:'At the start of each round, every Sleight has a 50% chance to restore 1 charge.', tags:['other','sleights','chance','charges','start'] },
  { id:'martyr',          emoji:'⚰️',  name:'Martyr',           rarity:'common', desc:'Discarding a non-discard Sleight restores 1 charge to all Sleights on the grid.', tags:['other','sleights','discard','charges'] },
  // ── Position knacks (r102) - control which line a position Trick marks ──
  { id:'surveyor',        emoji:'📐',  name:'Surveyor',         rarity:'common', desc:'When you gain a position Trick, you choose which column it marks.', tags:['other','tricks','position','line'] },
  { id:'leveler',         emoji:'📏',  name:'Leveler',          rarity:'common', desc:'When you gain a position Trick, you choose which row it marks.', tags:['other','tricks','position','line'] },
  { id:'alignment',       emoji:'🧲',  name:'Alignment',        rarity:'common', desc:'Position Tricks automatically mark the column matching their tray slot (slot 3 → column 3).', tags:['other','tricks','position','line'] },
  { id:'district',        emoji:'🏙️',  name:'District',          rarity:'common', desc:'Position Tricks may share a row or column instead of spreading onto separate lines.', tags:['other','tricks','position','line'] },
  // ── Tempo / repair knacks (r120) ──
  { id:'tempo',           emoji:'⏲️',  name:'Tempo',            rarity:'rare', desc:'When acquired, sets your swap and discard limits to 2. Every 15 seconds, gain 1 back - alternating swap, then discard.', tags:['stock','other','clock','cost'] },
  { id:'jury_rig',        emoji:'🔧',  name:'Jury-Rig',         rarity:'rare', desc:'Swapping or discarding a card adjacent to a Sleight has a 50% chance to restore 1 charge to it. Rolls separately for each adjacent Sleight.', tags:['other','sleights','position','swap','discard','chance','charges'] },
  // ── Focus-payout knacks (r123): fire when you reach max Focus ──
  { id:'dividend',     emoji:'🏦',  name:'Dividend',      rarity:'rare', desc:'Each time you hit your Focus limit, gain 8 credits, then Focus resets to a third of the limit.', tags:['credits','other','cost'] },
  { id:'trade_winds',  emoji:'⛵',  name:'Trade Winds',   rarity:'rare', desc:'Your Focus limit is 10 lower. At the end of each round, gain credits equal to half your current Focus.', tags:['credits','focus','other','level','cost'] },
  { id:'knock_on',     emoji:'🔗',  name:'Knock-On',      rarity:'rare', desc:'Whenever a limit other than Focus Cap goes up, another random limit goes up too.', tags:['limit','other'] },
  { id:'growth_spurt', emoji:'🌱',  name:'Growth Spurt',  rarity:'rare', desc:'Each time you hit your Focus limit, the limit drops by 5. If you hit it during a round, a random limit rises by 1 at the end of that round.', tags:['limit','focus','other','level','cost'] },
  // ── Focus-capacity knacks (r104) ──
  { id:'stimulants',      emoji:'💊',  name:'Stimulants',       rarity:'rare', desc:'+10 to your Focus limit.', tags:['focus','other'] },
  // ── Focus RATE batch (r180) - these scale how fast Focus ACCRUES. Every knack
  // above raises the ceiling; nothing raised the rate. See focusRateMods().
  { id:'long_fuse',       emoji:'🧨',  name:'Long Fuse',        rarity:'rare', desc:'You have 2× as long to earn the same Focus speed bonus.', tags:['focus','other'] },
  { id:'shorthand',       emoji:'✍️',  name:'Shorthand',        rarity:'rare', desc:'Hands generate 1.5× their listed Focus.', tags:['focus','other'] },
  { id:'core_memories',   emoji:'🧠',  name:'Core Memories',    rarity:'rare', desc:'Each Event you attend raises your Focus limit by 2.', tags:['focus','other','scaling'] },
];
// ── SLEIGHT POOL ──
// Sleights live in the deck as special cards (_isSleight:true). They fall onto the grid,
// can be swapped/discarded/selected/played like normal cards.
// activation describes HOW the sleight's effect fires:
//   'wildcard'    - participates in hand detection (rank/suit flexible)
//   'on_play'     - fires when the sleight is part of a played hand
//   'on_discard'  - fires when the sleight is discarded
//   'on_swap'     - fires when the sleight is moved by a swap (either direction)
//   'on_draw'     - fires when the sleight is dealt onto the grid
//   'round_start' - fires at the start of each round while on the grid
//   'round_end'   - fires at round end / interest calc while on the grid
//   'passive'     - effect always active while on the grid
//   'double_tap'  - fires when the sleight is double-tapped
// wild: 'rank' | 'suit' | 'both' (only for activation:'wildcard')
// durability: number of charges (per GAME), or 'infinite'
// defaultRank/defaultSuit: optional fixed identity (most sleights leave these null)
// TBD: tags marked needsResolve have simplified placeholder behavior pending design
