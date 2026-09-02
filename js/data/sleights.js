const SLEIGHT_POOL = [
  { id:'the_queen',     name:'The Queen',      emoji:'👑', rarity:'legendary', activation:'wildcard',   wild:'rank', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['wildrank','scoring'],        desc:'Wild rank - becomes the rank that makes the best hand. (Reach + queen-replay: TBD)', needsResolve:true },
  { id:'warehouse',     name:'Warehouse',      emoji:'🏭', rarity:'rare',      activation:'wildcard',   wild:'suit', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['wildsuit','suit'],           desc:'Wild suit - becomes any suit to complete a flush. Has no rank.' },
  { id:'good_friend',   name:'The Good Friend',emoji:'🤝', rarity:'rare',      activation:'on_play',    durability:3,          defaultRank:null, defaultSuit:null, tags:['exalt','position'],          desc:'Play it as part of a hand: exalts all adjacent cards. (3 charges)' },
  { id:'not_a_friend',  name:'Not a Friend',   emoji:'🗡️', rarity:'rare',      activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['corrupt','position'],        desc:'Discard it: corrupts all adjacent cards. (3 charges)' },
  { id:'shepherd',      name:'Shepherd',       emoji:'🐑', rarity:'common',    activation:'on_draw',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['exalt'],                     desc:'When drawn onto the grid, exalts 1 random card.' },
  { id:'idol',          name:'Idol',           emoji:'🗿', rarity:'rare',      activation:'round_end',  durability:1,          defaultRank:null, defaultSuit:null, tags:['coins'],                     desc:'Finish the round with this on your board to earn triple interest. (Once)' },
  { id:'shortcut',      name:'Shortcut',       emoji:'⏩', rarity:'legendary', activation:'on_play',    durability:1,          defaultRank:null, defaultSuit:null, tags:['challenge'],                 desc:'Play it in any 4-card hand to instantly complete the active challenge. (Once)' },
  { id:'fight_power',   name:'Fight the Power',emoji:'⚔️', rarity:'legendary', activation:'passive',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['boss'],                      desc:'While on the grid, all boss effects are ignored.' },
  { id:'dazed',         name:'Dazed & Confused',emoji:'😵', rarity:'rare',     activation:'on_swap',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['grid'],                      desc:'When swapped, reshuffles every card on the grid.' },
  { id:'pivot',         name:'Pivot!',         emoji:'🔃', rarity:'common',    activation:'on_swap',    durability:3,          defaultRank:null, defaultSuit:null, tags:['resource','scoring'],        desc:'When swapped, that swap is free and both swapped cards gain +5 mult permanently. (3 charges)' },
  // ── Play-based ──
  { id:'echo_play',      name:'Echo',           emoji:'🔁', rarity:'epic',      activation:'on_play',    durability:3,          defaultRank:null, defaultSuit:null, tags:['scoring'],           desc:'Play this in any hand: that hand scores twice. (3 charges)' },
  { id:'the_naturalist', name:'Naturalist',     emoji:'🌿', rarity:'rare',      activation:'on_play',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','pips'],     desc:'Play this: each other scored card permanently gains +2 pips.' },
  { id:'bellhop',        name:'Bellhop',        emoji:'🛎️', rarity:'common',    activation:'on_play',    durability:5,          defaultRank:null, defaultSuit:null, tags:['resource'],           desc:'Play this: gain +2 swaps and +1 discard. (5 charges)' },
  { id:'syncopation',    name:'Syncopation',    emoji:'🎼', rarity:'rare',      activation:'on_play',    durability:3,          defaultRank:null, defaultSuit:null, tags:['time'],               desc:'Play this in a hand of a different type than your previous hand: pause the clock for 12 seconds. (3 charges)' },
  { id:'rewind',         name:'Rewind',         emoji:'⏪', rarity:'rare',      activation:'on_play',    durability:5,          defaultRank:null, defaultSuit:null, tags:['time'],               desc:'Play this in a hand to rewind the clock by the hand size in seconds (this Sleight counts toward the size). (5 charges)' },
  // ── Discard-based ──
  { id:'the_bomb',       name:'Bomb',           emoji:'💣', rarity:'epic',      activation:'on_discard', durability:2,          defaultRank:null, defaultSuit:null, tags:['scoring','pips'],     desc:'Discard this: every card on the grid permanently gains +3 pips. (2 charges)' },
  { id:'the_legacy',     name:'Legacy',         emoji:'📜', rarity:'rare',      activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['scoring'],           desc:'Discard this: the next hand played scores ×3. (3 charges)' },
  { id:'cash_out',       name:'Cash Out',       emoji:'💰', rarity:'common',    activation:'on_discard', durability:4,          defaultRank:null, defaultSuit:null, tags:['resource','coins'],   desc:'Discard this: gain 10 credits. (4 charges)' },
  { id:'last_call',      name:'Last Call',      emoji:'⏳', rarity:'epic',      activation:'on_discard', durability:2,          defaultRank:null, defaultSuit:null, tags:['time'],               desc:'Discard this in the final minute of a round to rewind the clock 15 seconds. (2 charges)' },
  { id:'sandbag',        name:'Sandbagger',     emoji:'⏬', rarity:'rare',      activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['time'],               desc:'Discard this together with a pair of cards below rank 8 to rewind the clock by that pair’s rank in seconds. (3 charges)' },
  // ── Swap-based ──
  { id:'lightning_rod',  name:'Lightning Rod',  emoji:'⚡', rarity:'rare',      activation:'on_swap',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','pips'],     desc:'When swapped, the card it traded with permanently gains +5 pips.' },
  { id:'the_catalyst',   name:'Catalyst',       emoji:'🧪', rarity:'rare',      activation:'on_swap',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','mult'],     desc:'When swapped, the card it traded with permanently gains +1 mult.' },
  { id:'the_wanderer',   name:'Wanderer',       emoji:'🧭', rarity:'common',    activation:'on_swap',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['resource'],           desc:'When swapped, refunds the swap (+1 swap back).' },
  // ── Double-tap-based ──
  { id:'amplifier',      name:'Amplifier',      emoji:'📢', rarity:'common',    activation:'double_tap', durability:5,          defaultRank:null, defaultSuit:null, tags:['scoring','mult'],     desc:'Double-tap: your next hand scores +5 mult, then Amplifier returns to your deck. (5 charges)' },
  { id:'snooze',         name:'Snooze Button',  emoji:'😴', rarity:'common',    activation:'double_tap', durability:5,          defaultRank:null, defaultSuit:null, tags:['time'],                desc:'Double-tap: pause the clock for 10 seconds, then Snooze returns to your deck. (5 charges)' },
  { id:'shady_tree',     name:'Shady Tree',     emoji:'🌳', rarity:'rare',      activation:'on_play',    durability:10,         defaultRank:null, defaultSuit:null, tags:['time','position'],    desc:'Play this from the round’s shady column to pause the clock. Pauses for its remaining charges (10 → 1), −1 each use; destroyed at 0.' },
  { id:'stopwatch',      name:'Stopwatch',      emoji:'⏱️', rarity:'epic',      activation:'double_tap', durability:60,         defaultRank:null, defaultSuit:null, tags:['time'],                desc:'Double-tap: freeze the clock until you next play a hand (swaps and discards keep it frozen). Holds up to 60 paused seconds total, drained 1 per second; destroyed at 0.' },
  { id:'piggy_bank',     name:'Piggy Bank',     emoji:'🐷', rarity:'common',    activation:'double_tap', durability:5,          defaultRank:null, defaultSuit:null, tags:['resource','coins'],   desc:'Double-tap: gain 5 credits, then Piggy Bank returns to your deck. (5 charges)' },
  { id:'magnet',         name:'Magnet',         emoji:'🧲', rarity:'common',    activation:'double_tap', durability:3,          defaultRank:null, defaultSuit:null, tags:['position','swap'],    desc:'Double-tap, then tap a card: every card of that rank slides next to Magnet (counts as several swaps), then Magnet returns to your deck. (3 charges)' },
  // ── Aim-based (fixtures: tap to rotate aim; cannot be swapped or discarded) ──
  { id:'reflect',     name:'Reflect',     emoji:'🪞', rarity:'epic',   activation:'aim', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['retrigger','position'], desc:'Tap to rotate its aim (up→right→down→left). The card it faces replays once when a hand scores. Cannot be swapped or discarded.' },
  { id:'soul_mirror', name:'Soul Mirror', emoji:'👁️', rarity:'mythic', activation:'aim', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['retrigger','rank'],     desc:'Tap to rotate its aim. While it faces a card, every scored card of that rank replays - anywhere on the grid. Multiple Soul Mirrors stack. Cannot be swapped or discarded.' },
  // ── Adjacency / position sleights (r120) ──
  { id:'whetstone',  name:'Whetstone',  emoji:'🔪', rarity:'epic', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','mult','position'], desc:'Whenever an adjacent card is swapped or discarded, Whetstone gains +1 mult. Hands that score a card adjacent to Whetstone score that mult.' },
  { id:'entourage',  name:'Entourage',  emoji:'👥', rarity:'epic', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','mult'],            desc:'Hands score +10 mult for every other Sleight on the grid.' },
  { id:'lighthouse', name:'Lighthouse', emoji:'🗼', rarity:'rare', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['scoring','mult','position'], desc:'Each round Lighthouse favors the first or last column. Hands score +20 mult while it sits in that column, −5 per column of distance away (minimum 0).' },
  // ── Focus-spending sleights (r123) ──
  { id:'capacitor', name:'Capacitor', emoji:'🔋', rarity:'common', activation:'double_tap', durability:1, defaultRank:null, defaultSuit:null, tags:['focus','coins'], desc:'Double-tap to spend 10 Focus and 20 seconds for 10 credits. Consumed on use.' },
  { id:'siphon',    name:'Siphon',    emoji:'🩸', rarity:'rare',   activation:'double_tap', durability:4, defaultRank:null, defaultSuit:null, tags:['focus','mult'],  desc:'Double-tap to spend 15 Focus: your next scored hand gets ×4 mult. Returns to your deck after use.' },
  // ── Focus-capacity sleights (r104) ──
  { id:'power_cell',  name:'Power Cell',  emoji:'🔋', rarity:'rare',   activation:'on_draw', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['focus'], desc:'When it enters the grid: +5 Focus. While it remains on the grid: +10 maximum Focus.' },
  { id:'slow_burn',   name:'Slow Burn',   emoji:'🕯️', rarity:'rare',   activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['focus'], desc:'+1 maximum Focus for every minute this sleight spends on the grid.' },
  // ── Focus-rate sleights (r180) - passive, read by focusRateMods() ──
  { id:'flywheel', name:'Flywheel', emoji:'⚙️', rarity:'epic', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['focus'], desc:'While on the grid, the Focus speed bonus is multiplied by 1.5.' },
  { id:'governor', name:'Governor', emoji:'🎚️', rarity:'epic', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['focus'], desc:'While on the grid, you have 1.5× as long to earn the same Focus speed bonus.' },
  // ── Spectrum deck fixtures (r161) - four extra cards shuffled into the Spectrum
  // deck at run start. They are NOT offered by the shop, Mart, wheel, reward grid
  // or events (see SLEIGHT_FIXTURES): the only way to have one is to draw it.
  // activation:'adjacent' - count the hands scored in a cell touching this card;
  // at `adjacentPlays` it pays out `payout` and the counter resets.
  { id:'shift_swap',  name:'Shift Swap',  emoji:'🔀', rarity:'fixture', activation:'adjacent', adjacentPlays:2, payout:{ swaps:2 },    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['resource','position'], desc:'Score two hands touching this card and it grants +2 swaps. Repeats.' },
  { id:'recycler',    name:'Recycler',    emoji:'♻️', rarity:'fixture', activation:'adjacent', adjacentPlays:2, payout:{ discards:2 }, durability:'infinite', defaultRank:null, defaultSuit:null, tags:['resource','position'], desc:'Score two hands touching this card and it grants +2 discards. Repeats.' },
  { id:'time_clock',  name:'Time Clock',  emoji:'⏱️', rarity:'fixture', activation:'adjacent', adjacentPlays:2, payout:{ seconds:10 }, durability:'infinite', defaultRank:null, defaultSuit:null, tags:['time','position'],     desc:'Score two hands touching this card and it adds +10 seconds to the clock. Repeats.' },
  { id:'petty_cash',  name:'Petty Cash',  emoji:'💵', rarity:'fixture', activation:'adjacent', adjacentPlays:2, payout:{ coins:5 },    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['coins','position'],    desc:'Score two hands touching this card and it pays 5 credits. Repeats.' },
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
