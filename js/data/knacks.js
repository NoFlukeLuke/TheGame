const KNACK_POOL = [
  // ── Queue-view knacks (r329, js/queue-views.js) ──
  { id:'head_count',      emoji:'🔢',  name:'Head Count',       rarity:'common', desc:'The Sleight queue (the button on your Trick tray) shows how many cards sit in front of each Sleight.' },
  { id:'card_counter',    emoji:'🂠',  name:'Card Counter',     rarity:'rare',   desc:'A button below the Focus bar swaps it for the draw queue: the next cards in draw order, 2x your column count.' },
  { id:'advance_notice',  emoji:'📋',  name:'Advance Notice',   rarity:'rare',   desc:'While you hold it, its tooltip names the boss waiting at the end of the NEXT quarter. Sell it and a different boss takes that slot.' },
  { id:'contingency',     emoji:'🛡️',  name:'Contingency Plan', rarity:'rare',   desc:'Boss effects are 10% weaker - timed effects tick 10% less often, and everything else is 10% smaller.' },
  { id:'free_swaps',      emoji:'🕊️',  name:'Free Swaps',       rarity:'common', desc:'Swapping cards costs no time.' },
  { id:'free_discards',   emoji:'🪶',  name:'Free Discards',    rarity:'common', desc:'Discarding costs no time.' },
  { id:'steady_hand',     emoji:'♾️',  name:'Steady Hand',      rarity:'common', desc:'Swaps no longer count against the swap limit, but cost 2× time.' },
  { id:'hoarder',         emoji:'🗑️',  name:'Hoarder',          rarity:'common', desc:'Discards no longer count against the discard limit, but cost 2× time.' },
  { id:'time_bank',       emoji:'⏳',  name:'Time Bank',        rarity:'rare',   desc:'+30 seconds at the start of every round.' },
  { id:'inheritance',     emoji:'💰',  name:'Inheritance',      rarity:'rare',   desc:'Start each round with +5 credits.' },
  { id:'bulk_buyer',      emoji:'🛒',  name:'Bulk Buyer',       rarity:'rare',   desc:'The shop multi-buy discount is 5% per extra item instead of 3%.' },
  { id:'haggler',         emoji:'🤝',  name:'Haggler',          rarity:'rare',   desc:'Shop prices are 5% lower.' },
  { id:'time_and_a_half', emoji:'🕰️',  name:'Time and a Half',  rarity:'rare',   desc:'Leftover round time pays double: 1 credit per 5 seconds remaining instead of 10.' },
  { id:'gross_pay',       emoji:'🧾',  name:'Gross Pay',        rarity:'rare',   desc:'Your payout lines are uncapped. Interest and unused stock pay in full.' },
  { id:'high_roller',     emoji:'🎰',  name:'High Roller',      rarity:'epic',   desc:'Each scored card has a chance to replay equal to your credits plus your Luck, as a percent. Over 100% guarantees a replay and rolls the remainder for another.' },
  { id:'combo_keeper',    emoji:'🔥',  name:'Combo Keeper',     rarity:'rare',   desc:'Streaks survive one non-streak hand. Re-arms after 2 streak hands.' },
  { id:'lucky_seven',     emoji:'🎯',  name:'Lucky Seven',      rarity:'common', desc:'Every 7th hand played gives +1 swap.' },
  { id:'extra_swaps',     emoji:'🔄',  name:'Swap Shop',        rarity:'common', desc:'Start each round with +2 extra swaps.' },
  { id:'extra_discards',  emoji:'🌾',  name:'Harvest',          rarity:'common', desc:'Start each round with +2 extra discards.' },
  { id:'carry_swaps',     emoji:'🎒',  name:'Pack Rat',         rarity:'common', desc:'Unused swaps carry over to the next round (max 8).' },
  { id:'carry_discards',  emoji:'📦',  name:'Collector',        rarity:'common', desc:'Unused discards carry over to the next round (max 8).' },
  { id:'carry_time',      emoji:'🕰️',  name:'Clock Tower',      rarity:'rare',   desc:'Unused round seconds carry over (max 60s).' },
  { id:'safety_net',      emoji:'🪢',  name:'Safety Net',       rarity:'rare',   desc:'Once per game: if you miss the round goal, gain a 30s extension instead of failing.' },
  { id:'free_range_t',    emoji:'🦅',  name:'Free Range',       rarity:'rare',   desc:'Can swap any two non-adjacent cards, but limited to 2 swaps per round.' },
  { id:'understudy',      emoji:'🎭',  name:'Understudy',       rarity:'rare',   desc:'Every 30 seconds one of your tricks is primed: it fires an extra time on your next hand.' },
  { id:'hallmark',        emoji:'🔖',  name:'Hallmark',         rarity:'rare',   desc:'Once a round a card on the board is marked. Score it and it takes a random buff.' },
  { id:'turnover',        emoji:'♻️',  name:'Turnover',         rarity:'rare',   desc:'Any card you leave alone for 45 seconds is discarded and a fresh one falls in. Costs you nothing.' },
  { id:'long_pause',      emoji:'🦉',  name:'Long Pause',       rarity:'common', desc:'All clock pauses last 1.5× as long.' },
  { id:'sundial',         emoji:'🌇',  name:'Sundial',          rarity:'common', desc:'Hands where every card shares a column pause the clock for 8 seconds.' },
  { id:'metronome',       emoji:'🥁',  name:'Metronome',        rarity:'common', desc:'Each round a hand type you can make is chosen; playing that hand type pauses the clock for 5 seconds.' },
  // ── Rewind knacks ──
  { id:'time_slip',       emoji:'⏮️',  name:'Time Slip',        rarity:'common', desc:'Whenever the clock would pause, 25% chance to rewind that many seconds instead.' },
  { id:'replay_rewind',   emoji:'🔂',  name:'Rewound Echo',     rarity:'common', desc:'Any time a card replays, 25% chance to rewind the clock 2 seconds.' },
  { id:'deja_vu',         emoji:'🔁',  name:'Déjà Vu',          rarity:'common', desc:'Playing the same ranks in two hands in a row rewinds the clock 5 seconds.' },
  { id:'clockmaker',      emoji:'⏱️',  name:'Clockmaker',       rarity:'rare',   desc:'Any time a single hand scores at least 30% of the round goal, rewind the clock 5 seconds.' },
  // ── Combo batch (r83) ──
  { id:'high_and_mighty', emoji:'👑',  name:'High and Mighty',  rarity:'rare',   desc:'The highest-ranked cards in each scored hand replay once.' },
  { id:'low_and_behold',  emoji:'🐛',  name:'Low and Behold',   rarity:'rare',   desc:'Any played hand containing the grid’s lowest rank replays the whole hand once.' },
  { id:'down_and_back_in',emoji:'🔁',  name:'Down and Back In', rarity:'common', desc:'Discarding the grid’s highest rank grants +1 discard or swap (alternating) and +5 coins. If several cards share that top rank, all must be discarded together.' },
  { id:'muscle_memory',   emoji:'🤝',  name:'Buddy System',     rarity:'common', desc:'Whenever a Trick is primed, a different Trick is primed too.' },
  { id:'curator',         emoji:'✦',   name:'Curator',          rarity:'rare',   desc:'+1 Trick Slot.' },
  { id:'short_suit',      emoji:'🃏',  name:'Short Suit',       rarity:'rare',   desc:'Flush of 3 and Flush of 4 become scorable hands.' },
  // ── Natural Scaling knack (r198) ──
  // Natural Scaling is per HAND TYPE now, so a family's growth sits in whichever
  // hand you actually play. This pools it: every hand in a family reads the best
  // bonus in that family. It REPLACES the hand's own bonus, never adds to it.
  { id:'old_tricks',      emoji:'🎩',  name:'Old Tricks',       rarity:'epic',   desc:'Every hand type scores with the best growth anywhere in its family - sets, runs and flushes each pool their own. It replaces what that hand had earned, it does not add to it.' },
  // ── Passenger knack (r201) ──
  // A hand normally has to use every card you select; a spare makes it not a hand,
  // and the spare is billed as a penalty card. This lifts that.
  { id:'tagalong',       emoji:'🧳',  name:'Tagalong',        rarity:'rare',   desc:'Your hands may carry cards that are not part of them. Those cards still score their own pips instead of being billed as penalties.' },
  // ── Reward-grid / risk knacks (r129) ──
  { id:'shady_stimulants',emoji:'💊',  name:'Shady Stimulants', rarity:'rare',   desc:'Every negative reward tile you take raises your Focus limit by 1.' },
  { id:'greedy_boi',      emoji:'🤑',  name:'Greedy Boi',       rarity:'rare',   desc:'+2 selection size in the reward grid - grab more tiles at once.' },
  { id:'scavenger',       emoji:'🦴',  name:'Scavenger',        rarity:'common', desc:'Whenever a curse lifts, gain +10 coins and +1 discard next round.' },
  { id:'coin_toss',       emoji:'🪙',  name:'Coin Toss',        rarity:'common', desc:'At the start of each round, every Sleight has a 50% chance to restore 1 charge.' },
  { id:'martyr',          emoji:'⚰️',  name:'Martyr',           rarity:'common', desc:'Discarding a non-discard Sleight restores 1 charge to all Sleights on the grid.' },
  // ── Position knacks (r102) - control which line a position Trick marks ──
  { id:'surveyor',        emoji:'📐',  name:'Surveyor',         rarity:'common', desc:'When you gain a position Trick, you choose which column it marks.' },
  { id:'leveler',         emoji:'📏',  name:'Leveler',          rarity:'common', desc:'When you gain a position Trick, you choose which row it marks.' },
  { id:'alignment',       emoji:'🧲',  name:'Alignment',        rarity:'common', desc:'Position Tricks automatically mark the column matching their tray slot (slot 3 → column 3).' },
  { id:'district',        emoji:'🏙️',  name:'District',          rarity:'common', desc:'Position Tricks may share a row or column instead of spreading onto separate lines.' },
  // ── Tempo / repair knacks (r120) ──
  { id:'tempo',           emoji:'⏲️',  name:'Tempo',            rarity:'rare', desc:'When acquired, sets your swap and discard limits to 2. Every 15 seconds, gain 1 back - alternating swap, then discard.' },
  { id:'jury_rig',        emoji:'🔧',  name:'Jury-Rig',         rarity:'rare', desc:'Swapping or discarding a card adjacent to a Sleight has a 50% chance to restore 1 charge to it. Rolls separately for each adjacent Sleight.' },
  // ── Focus-payout knacks (r123): fire when you reach max Focus ──
  { id:'dividend',     emoji:'🏦',  name:'Dividend',      rarity:'rare', desc:'Each time you hit your Focus limit, gain 8 credits, then Focus resets to a third of the limit.' },
  { id:'trade_winds',  emoji:'⛵',  name:'Trade Winds',   rarity:'rare', desc:'Your Focus limit is 10 lower. At the end of each round, gain credits equal to half your current Focus.' },
  { id:'growth_spurt', emoji:'🌱',  name:'Growth Spurt',  rarity:'rare', desc:'Each time you hit your Focus limit, the limit drops by 5. If you hit it during a round, a random limit rises by 1 at the end of that round.' },
  // ── Focus-capacity knacks (r104) ──
  { id:'stimulants',      emoji:'💊',  name:'Stimulants',       rarity:'rare', desc:'+10 to your Focus limit while owned.' },
  // ── Focus RATE batch (r180) - these scale how fast Focus ACCRUES. Every knack
  // above raises the ceiling; nothing raised the rate. See focusRateMods().
  { id:'long_fuse',       emoji:'🧨',  name:'Long Fuse',        rarity:'rare', desc:'You have 2× as long to earn the same Focus speed bonus.' },
  { id:'shorthand',       emoji:'✍️',  name:'Shorthand',        rarity:'rare', desc:'Hands generate 1.5× their listed Focus.' },
  { id:'core_memories',   emoji:'🧠',  name:'Core Memories',    rarity:'rare', desc:'Each Event you attend raises your Focus limit by 2.' },
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
