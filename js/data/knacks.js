const KNACK_POOL = [
  { id:'free_swaps',      emoji:'🕊️',  name:'Free Swaps',       rarity:'common', desc:'Swapping cards costs no time.' },
  { id:'free_discards',   emoji:'🪶',  name:'Free Discards',    rarity:'common', desc:'Discarding costs no time.' },
  { id:'steady_hand',     emoji:'♾️',  name:'Steady Hand',      rarity:'common', desc:'Swaps no longer count against the swap limit, but cost 2× time.' },
  { id:'hoarder',         emoji:'🗑️',  name:'Hoarder',          rarity:'common', desc:'Discards no longer count against the discard limit, but cost 2× time.' },
  { id:'time_bank',       emoji:'⏳',  name:'Time Bank',        rarity:'rare',   desc:'+30 seconds at the start of every round.' },
  { id:'inheritance',     emoji:'💰',  name:'Inheritance',      rarity:'rare',   desc:'Start each round with +5 credits.' },
  { id:'combo_keeper',    emoji:'🔥',  name:'Combo Keeper',     rarity:'rare',   desc:'Streaks survive one non-streak hand. Re-arms after 2 streak hands.' },
  { id:'lucky_seven',     emoji:'🎯',  name:'Lucky Seven',      rarity:'common', desc:'Every 7th hand played gives +1 swap.' },
  { id:'extra_swaps',     emoji:'🔄',  name:'Swap Shop',        rarity:'common', desc:'Start each round with +2 extra swaps.' },
  { id:'extra_discards',  emoji:'🌾',  name:'Harvest',          rarity:'common', desc:'Start each round with +2 extra discards.' },
  { id:'carry_swaps',     emoji:'🎒',  name:'Pack Rat',         rarity:'common', desc:'Unused swaps carry over to the next round (max 8).' },
  { id:'carry_discards',  emoji:'📦',  name:'Collector',        rarity:'common', desc:'Unused discards carry over to the next round (max 8).' },
  { id:'carry_time',      emoji:'🕰️',  name:'Clock Tower',      rarity:'rare',   desc:'Unused round seconds carry over (max 60s).' },
  { id:'safety_net',      emoji:'🪢',  name:'Safety Net',       rarity:'rare',   desc:'Once per game: if you miss the round goal, gain a 30s extension instead of failing.' },
  { id:'free_range_t',    emoji:'🦅',  name:'Free Range',       rarity:'rare',   desc:'Can swap any two non-adjacent cards, but limited to 2 swaps per round.' },
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
  { id:'muscle_memory',   emoji:'🧠',  name:'Muscle Memory',    rarity:'common', desc:'Primed Tricks stay primed for one extra hand.' },
  { id:'curator',         emoji:'✦',   name:'Curator',          rarity:'rare',   desc:'+1 Trick Slot.' },
  { id:'scavenger',       emoji:'🦴',  name:'Scavenger',        rarity:'common', desc:'Whenever a curse lifts, gain +10 coins and +1 discard next round.' },
  { id:'coin_toss',       emoji:'🪙',  name:'Coin Toss',        rarity:'common', desc:'At the start of each round, every Sleight has a 50% chance to restore 1 charge.' },
  { id:'martyr',          emoji:'⚰️',  name:'Martyr',           rarity:'common', desc:'Discarding a non-discard Sleight restores 1 charge to all Sleights on the grid.' },
];
// ── SLEIGHT POOL ──
// Sleights live in the deck as special cards (_isSleight:true). They fall onto the grid,
// can be swapped/discarded/selected/played like normal cards.
// activation describes HOW the sleight's effect fires:
//   'wildcard'    — participates in hand detection (rank/suit flexible)
//   'on_play'     — fires when the sleight is part of a played hand
//   'on_discard'  — fires when the sleight is discarded
//   'on_swap'     — fires when the sleight is moved by a swap (either direction)
//   'on_draw'     — fires when the sleight is dealt onto the grid
//   'round_start' — fires at the start of each round while on the grid
//   'round_end'   — fires at round end / interest calc while on the grid
//   'passive'     — effect always active while on the grid
//   'double_tap'  — fires when the sleight is double-tapped
// wild: 'rank' | 'suit' | 'both' (only for activation:'wildcard')
// durability: number of charges (per GAME), or 'infinite'
// defaultRank/defaultSuit: optional fixed identity (most sleights leave these null)
// TBD: tags marked needsResolve have simplified placeholder behavior pending design
