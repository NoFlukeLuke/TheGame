// Five sleights are COMMENTED OUT below (Good Friend, Not a Friend, Shepherd,
// Idol, Shortcut) - owner's call, not an accident. They are unreachable rather
// than deleted, so their runtime cases in js/sleights-runtime.js and the Idol's
// interest branch in js/interlude.js are dead code that still compiles; leave
// them, they are what makes re-enabling one a single-line change.
const SLEIGHT_POOL = [
  { id:'the_queen',     name:'The Queen',      emoji:'👑', rarity:'epic', activation:'wildcard',   wild:'rank', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['wildrank','scoring'],        desc:'Wild rank - becomes the rank that makes the best hand. (Reach + queen-replay: TBD)', needsResolve:true },
  { id:'warehouse',     name:'Warehouse',      emoji:'🏭', rarity:'common',      activation:'wildcard',   wild:'suit', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['wildsuit','suit'],           desc:'Counts as 2 cards of any suit for the purpose of completing a flush. Has no rank.' },
 // { id:'good_friend',   name:'The Good Friend',emoji:'🤝', rarity:'rare',      activation:'on_play',    durability:3,          defaultRank:null, defaultSuit:null, tags:['exalt','position'],          desc:'Play it as part of a hand: exalts all adjacent cards. (3 charges)' },
//  { id:'not_a_friend',  name:'Not a Friend',   emoji:'🗡️', rarity:'rare',      activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['corrupt','position'],        desc:'Discard it: corrupts all adjacent cards. (3 charges)' },
 // { id:'shepherd',      name:'Shepherd',       emoji:'🐑', rarity:'common',    activation:'on_draw',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['exalt'],                     desc:'When drawn onto the grid, exalts 1 random card.' },
 // { id:'idol',          name:'Idol',           emoji:'🗿', rarity:'rare',      activation:'round_end',  durability:1,          defaultRank:null, defaultSuit:null, tags:['coins'],                     desc:'Finish the round with this on your board to earn triple interest. (Once)' },
//  { id:'shortcut',      name:'Shortcut',       emoji:'⏩', rarity:'legendary', activation:'on_play',    durability:1,          defaultRank:null, defaultSuit:null, tags:['challenge'],                 desc:'Play it in any 4-card hand to instantly complete the active challenge. (Once)' },
  { id:'the_ringer',    name:'The Ringer',      emoji:'🎩', rarity:'epic',      activation:'passive',    durability:10,         defaultRank:null, defaultSuit:null, tags:['scoring','grid'],            desc:'While on the grid, a hand you submit pulls in one more card off the board when that makes a better hand - a third 10 becomes a fourth, a J-Q-K becomes a run of four. Ignores your selection size. (10 charges)' },
  { id:'fight_power',   name:'Fight the Power',emoji:'⚔️', rarity:'legendary', activation:'passive',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['boss'],                      desc:'While on the grid, all boss effects are ignored.' },
  { id:'dazed',         name:'Fresh Start',    emoji:'😵', rarity:'rare',     activation:'on_discard', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['grid'],                      desc:'When discarded, shuffles all cards back into the deck and redeals. Costs 3 credits and 10s' },
  { id:'pivot',         name:'Pivot!',         emoji:'🔃', rarity:'common',    activation:'passive',    durability:3,          defaultRank:null, defaultSuit:null, tags:['resource','scoring'],        desc:'Cards touching Pivot swap for free. Swap two of its neighbours together and both gain +5 permanent mult, then Pivot leaves the board. (3 charges)' },
  // ── Play-based ──
  { id:'echo_play',      name:'Echo',           emoji:'🔁', rarity:'epic',      activation:'on_play',    durability:3,          defaultRank:null, defaultSuit:null, tags:['scoring'],           desc:'Play this in any hand: each card replays 2x. (3 charges)' },
  { id:'the_naturalist', name:'Naturalist',     emoji:'🌿', rarity:'rare',      activation:'on_play',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','pips'],     desc:'Play this: each other scored card permanently gains +3 pips.' },
  { id:'bellhop',        name:'Bellhop',        emoji:'🛎️', rarity:'common',    activation:'on_play',    durability:5,          defaultRank:null, defaultSuit:null, tags:['resource'],           desc:'Play this: gain +2 swaps and +1 discard. (5 charges)' },
  { id:'syncopation',    name:'Syncopation',    emoji:'🎼', rarity:'rare',      activation:'on_play',    durability:3,          defaultRank:null, defaultSuit:null, tags:['time'],               desc:'Play this in a hand of a different type than your previous hand: pause the clock for 12 seconds. (3 charges)' },
  { id:'rewind',         name:'Rewind',         emoji:'⏪', rarity:'rare',      activation:'on_play',    durability:5,          defaultRank:null, defaultSuit:null, tags:['time'],               desc:'Play this in a hand to rewind the clock by the hand size in seconds (this Sleight counts toward the size). (5 charges)' },
  // ── Discard-based ──
  { id:'the_bomb',       name:'Bomb',           emoji:'💣', rarity:'epic',      activation:'on_discard', durability:2,          defaultRank:null, defaultSuit:null, tags:['scoring','pips'],     desc:'Discard this: every card on the grid permanently gains +3 pips. (2 charges)' },
  { id:'the_legacy',     name:'Legacy',         emoji:'📜', rarity:'rare',      activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['scoring'],           desc:'Discard this: the next hand played get x3 mult. (3 charges)' },
  { id:'cash_out',       name:'Cash Out',       emoji:'💰', rarity:'rare',    activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['resource','coins'],   desc:'Discard this: gain 10 credits. (3 charges)' },
  { id:'last_call',      name:'Last Call',      emoji:'⏳', rarity:'rare',      activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['time'],               desc:'Discard this: rewind the clock 15 seconds. (3 charges)' },
  { id:'sandbag',        name:'Sandbagger',     emoji:'⏬', rarity:'rare',      activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['time'],               desc:'Discard this with a pair to rewind the clock by that pair’s rank in seconds, +50% more time for every additional member of the set. (3 charges)' },
  // ── Swap-based ──
  { id:'lightning_rod',  name:'Lightning Rod',  emoji:'⚡', rarity:'rare',      activation:'on_swap',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','pips'],     desc:'When swapped, the card it traded with permanently gains +10 pips.' },
  { id:'the_catalyst',   name:'Catalyst',       emoji:'🧪', rarity:'rare',      activation:'on_swap',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','mult'],     desc:'When swapped, the card it traded with permanently gains +5 mult.' },
  { id:'the_wanderer',   name:'Wanderer',       emoji:'🧭', rarity:'rare',    activation:'passive',    durability:5,          defaultRank:null, defaultSuit:null, tags:['resource'],           desc:'While on grid: allows any two cards to be swapped regardless of position. Still uses your swap stock. (5 charges)' },
  // ── Double-tap-based ──
  { id:'amplifier',      name:'Amplifier',      emoji:'📢', rarity:'common',    activation:'double_tap', durability:5,          defaultRank:null, defaultSuit:null, tags:['scoring','mult'],     desc:'Double-tap: your next hand scores +10 mult, then Amplifier returns to your deck. (5 charges)' },
  { id:'snooze',         name:'Snooze Button',  emoji:'😴', rarity:'common',    activation:'double_tap', durability:5,          defaultRank:null, defaultSuit:null, tags:['time'],                desc:'Double-tap: pause the clock for 10 seconds, then Snooze returns to your deck. (5 charges)' },
  { id:'shady_tree',     name:'Shady Tree',     emoji:'🌳', rarity:'rare',      activation:'on_play',    durability:10,         defaultRank:null, defaultSuit:null, tags:['time','position'],    desc:'Play this from column x (changes each round) to pause the clock. Pauses for its remaining charges in seconds (10 → 1), −1 each use; destroyed at 0.' },
  { id:'stopwatch',      name:'Stopwatch',      emoji:'⏱️', rarity:'epic',      activation:'double_tap', durability:60,         defaultRank:null, defaultSuit:null, tags:['time'],                desc:'Double-tap: freeze the clock until you next play a hand (swaps and discards keep it frozen). Holds up to 60 paused seconds total, drained 1 per second; destroyed at 0.' },
  { id:'piggy_bank',     name:'Piggy Bank',     emoji:'🐷', rarity:'common',    activation:'double_tap', durability:5,          defaultRank:null, defaultSuit:null, tags:['resource','coins'],   desc:'Double-tap: gain 5 credits, once per round. Becomes inert on use: it can no longer be swapped or discarded. (5 charges)' },
  { id:'magnet',         name:'Magnet',         emoji:'🧲', rarity:'common',    activation:'double_tap', durability:3,          defaultRank:null, defaultSuit:null, tags:['position','swap'],    desc:'Double-tap, then tap a card: every card of that rank slides next to Magnet (counts as several swaps), then Magnet returns to your deck. (3 charges)' },
  // ── Aim-based (fixtures: tap to rotate aim; cannot be swapped or discarded) ──
  { id:'reflect',     name:'Reflect',     emoji:'🪞', rarity:'epic',   activation:'aim', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['retrigger','position'], desc:'Tap to rotate its aim. The rank it faces replays 2x when a hand scores. Works once per round. Cannot be swapped or discarded.' },
  { id:'soul_mirror', name:'Soul Mirror', emoji:'👁️', rarity:'legendary', activation:'aim', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['retrigger','rank'],     desc:'Tap to rotate its aim. When the rank it faces is scored, it replays equal to the count of that rank on grid. Cannot be swapped or discarded.' },
  // ── Adjacency / position sleights (r120) ──
  { id:'whetstone',  name:'Whetstone',  emoji:'🔪', rarity:'epic', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','mult','position'], desc:'Whenever an adjacent card is swapped or discarded, Whetstone gains +2 mult permanently. Hands that score a card adjacent to Whetstone score that mult.' },
  { id:'entourage',  name:'Entourage',  emoji:'👥', rarity:'epic', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','mult'],            desc:'Hands score +10 mult for every other Sleight on the grid.' },
  { id:'lighthouse', name:'Lighthouse', emoji:'🗼', rarity:'rare', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','mult','position'], desc:'Each round Lighthouse picks either the first or last column. All hands score +20 mult when Lighthouse is its column, −7 per column away (minimum 0).' },
  // ── Focus-spending sleights (r123) ──
  { id:'capacitor', name:'Capacitor', emoji:'🔋', rarity:'common', activation:'double_tap', durability:1, defaultRank:null, defaultSuit:null, tags:['focus','coins'], desc:'Double-tap: spend 10 Focus and 10 seconds for 10 credits. Becomes inert on use: it can no longer be swapped or discarded. (1 charge)' },
  { id:'siphon',    name:'Siphon',    emoji:'🩸', rarity:'rare',   activation:'double_tap', durability:4, defaultRank:null, defaultSuit:null, tags:['focus','mult'],  desc:'Double-tap to spend 15 Focus: your next scored hand gets ×4 mult. Returns to your deck after use.' },
  // ── Focus-capacity sleights (r104) ──
  { id:'power_cell',  name:'Power Cell',  emoji:'🔋', rarity:'rare',   activation:'on_draw', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['focus'], desc:'When it enters the grid: +10 Focus. While it remains on the grid: +10 to your Focus limit.' },
  { id:'slow_burn',   name:'Slow Burn',   emoji:'🕯️', rarity:'rare',   activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['focus'], desc:'+1 to your Focus limit for every 45 seconds this sleight spends on the grid (max +15).' },
  // ── Focus-rate sleights (r180) - passive, read by focusRateMods() ──
  { id:'governor', name:'Governor', emoji:'🎚️', rarity:'epic', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['focus'], desc:'While on the grid, you have 1.5× as long to earn the same Focus speed bonus.' },
  // ── Spectrum deck fixtures (r161) - four extra cards shuffled into the Spectrum
  // deck at run start. They are NOT offered by the shop, Mart, wheel, reward grid
  // or events (see SLEIGHT_FIXTURES): the only way to have one is to draw it.
  // activation:'adjacent' - count the hands scored in a cell touching this card;
  // at `adjacentPlays` it pays out `payout` and then LEAVES THE BOARD (r280),
  // cycling back into the draw pile with its charges, so it can be drawn again.
  // Progress rides on the card (`_adjPlays`) and is carried through a deck cycle
  // by discardToPlayed's field list - leave it out and a half-counted fixture
  // silently resets at every round boundary.
  { id:'shift_swap',  name:'Shift Swap',  emoji:'🔀', rarity:'fixture', activation:'adjacent', adjacentPlays:2, adjCards:true, payout:{ swaps:2 },    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['resource','position'], desc:'Score two cards adjacent to this sleight to get +2 swaps. Discards itself after giving bonus.' },
  { id:'recycler',    name:'Recycler',    emoji:'♻️', rarity:'fixture', activation:'adjacent', adjacentPlays:2, adjCards:true, payout:{ discards:2 }, durability:'infinite', defaultRank:null, defaultSuit:null, tags:['resource','position'], desc:'Score two cards adjacent to this sleight to get +2 discards. Discards itself after giving bonus.' },
  { id:'time_clock',  name:'Time Clock',  emoji:'⏱️', rarity:'fixture', activation:'adjacent', adjacentPlays:2, payout:{ pause_seconds:10 }, durability:'infinite', defaultRank:null, defaultSuit:null, tags:['time','position'],     desc:'Score two hands beside this card for a 10 second pause, then it goes back into the deck.' },
  { id:'petty_cash',  name:'Petty Cash',  emoji:'💵', rarity:'fixture', activation:'adjacent', adjacentPlays:2, payout:{ coins:5 },    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['coins','position'],    desc:'Score two hands beside this card to get +5 credits. Discards itself after giving bonus.' },
];

// Deck fixtures: dealt into the Spectrum deck, never sold or awarded. Kept in
// SLEIGHT_POOL (sleightDef / rendering look them up there) but filtered out of
// every offer pool.
const SLEIGHT_FIXTURES = new Set(['shift_swap', 'recycler', 'time_clock', 'petty_cash']);
function sleightOfferable(def) { return !!def && !SLEIGHT_FIXTURES.has(def.id); }

// ── Aim sleights (Reflect, Soul Mirror): fixtures that point at an adjacent cell ──
// ══════════════════════════════════════════════
// COMBO FAMILIES - legibility layer (r83)
// Each family is a set of "slots"; a slot is one required entity id, or an array
// (own ANY one of these). checkComboMilestones() (called at round start) fires a
// one-time "COMBO ONLINE" toast when a family is fully owned, and a one-time
// "combo close - need X" hint when you own all but one slot - so synergies feel
// discovered, not stumbled into. A wrong/renamed id just fails to fire (harmless).
// ══════════════════════════════════════════════
