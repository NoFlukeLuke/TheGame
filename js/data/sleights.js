// Five sleights are COMMENTED OUT below (Good Friend, Not a Friend, Shepherd,
// Idol, Shortcut) - owner's call, not an accident. They are unreachable rather
// than deleted, so their runtime cases in js/sleights-runtime.js and the Idol's
// interest branch in js/interlude.js are dead code that still compiles; leave
// them, they are what makes re-enabling one a single-line change.
const SLEIGHT_POOL = [
  { id:'the_queen',     name:'The Queen',      emoji:'👑', rarity:'epic', activation:'on_play',    fixedRank:true, royalReach:true, durability:'infinite', defaultRank:'Q', defaultSuit:null, tags:['pips','mult','time','card','wild','rank','scores'],        desc:'' },
  { id:'warehouse',     name:'Warehouse',      emoji:'🏭', rarity:'common',      activation:'wildcard',   wild:'suit', durability:5, defaultRank:null, defaultSuit:null, tags:['hand','wild','flush','scores'],           desc:'' },
 // { id:'idol',          name:'Idol',           emoji:'🗿', rarity:'rare',      activation:'round_end',  durability:1,          defaultRank:null, defaultSuit:null, tags:['coins'],                     desc:'Finish the round with this on your board to earn triple interest. (Once)' },
//  { id:'shortcut',      name:'Shortcut',       emoji:'⏩', rarity:'legendary', activation:'on_play',    durability:1,          defaultRank:null, defaultSuit:null, tags:['challenge'],                 desc:'Play it in any 4-card hand to instantly complete the active challenge. (Once)' },
  { id:'the_ringer',    name:'The Ringer',      emoji:'🎩', rarity:'epic',      activation:'passive',    durability:10,         defaultRank:null, defaultSuit:null, tags:['board','hand','scores'],            desc:'' },
  { id:'fight_power',   name:'Fight the Power',emoji:'⚔️', rarity:'legendary', activation:'passive',    durability:9, secsPerCharge:20, defaultRank:null, defaultSuit:null, tags:['shield','other','boss'],                      desc:'' },
  { id:'dazed',         name:'Fresh Start',    emoji:'😵', rarity:'rare',     activation:'on_discard', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['board','other','cost'],                      desc:'' },
  { id:'pivot',         name:'Pivot!',         emoji:'🔃', rarity:'common',    activation:'passive',    durability:3,          defaultRank:null, defaultSuit:null, tags:['stock','deck','mult','other','swap','position','scaling','scores'],        desc:'' },
  // ── Play-based ──
  { id:'echo_play',      name:'Echo',           emoji:'🔁', rarity:'epic',      activation:'on_play',    durability:5,          defaultRank:null, defaultSuit:null, tags:['replay','card','scores'],           desc:'' },
  { id:'the_naturalist', name:'Naturalist',     emoji:'🌿', rarity:'epic',      activation:'on_play',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['deck','pips','card','scaling','scores'],     desc:'' },
  { id:'bellhop',        name:'Bellhop',        emoji:'🛎️', rarity:'common',    activation:'on_play',    durability:5,          defaultRank:null, defaultSuit:null, tags:['stock','hand'],           desc:'Play this: gain +2 swaps and +2 discards. (5 charges)' },
  { id:'syncopation',    name:'Syncopation',    emoji:'🎼', rarity:'rare',      activation:'on_play',    durability:3,          defaultRank:null, defaultSuit:null, retired:true, tags:['time','hand','streak'],               desc:'Play this in a hand of a different type than your previous hand: pause the clock for 12s. (3 charges)' },
  { id:'rewind',         name:'Rewind',         emoji:'⏪', rarity:'rare',      activation:'on_play',    durability:5,          defaultRank:null, defaultSuit:null, tags:['time','hand','size'],               desc:'' },
  { id:'retake',         name:'Retake',         emoji:'🎬', rarity:'rare',      activation:'on_play',    durability:6,          defaultRank:null, defaultSuit:null, tags:['deck','hand'],                desc:'' },
  // ── Discard-based ──
  { id:'the_bomb',       name:'Bomb',           emoji:'💣', rarity:'epic',      activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['deck','pips','other','scaling','scores'],     desc:'' },
  { id:'the_legacy',     name:'Legacy',         emoji:'📜', rarity:'rare',      activation:'on_discard', durability:5,          defaultRank:null, defaultSuit:null, tags:['xpips','hand','scores'],           desc:'' },
  { id:'cash_out',       name:'Cash Out',       emoji:'💰', rarity:'rare',    activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['credits','other'],   desc:'Discard this: gain 10 credits. (3 charges)' },
  { id:'last_call',      name:'Last Call',      emoji:'⏳', rarity:'rare',      activation:'on_discard', durability:5,          defaultRank:null, defaultSuit:null, tags:['time','other'],               desc:'' },
  { id:'sandbag',        name:'Sandbagger',     emoji:'⏬', rarity:'rare',      activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['time','other','set','rank'],               desc:'' },
  { id:'procrastinate',  name:'Procrastinate',  emoji:'🛋️', rarity:'rare',      activation:'on_discard', durability:5,          defaultRank:null, defaultSuit:null, tags:['board','other','discard','position'], desc:'' },
  { id:'shredder',       name:'Shredder',       emoji:'📃', rarity:'rare',      activation:'on_discard', durability:3,          defaultRank:null, defaultSuit:null, tags:['deck','other','discard'],     desc:'' },
  // ── Swap-based ──
  { id:'lightning_rod',  name:'Lightning Rod',  emoji:'⚡', rarity:'rare',      activation:'on_swap',    durability:'infinite', defaultRank:null, defaultSuit:null, retired:true, tags:['deck','pips','card','scaling','scores'],     desc:'When swapped, the card it traded with permanently gains +10 pips.' },
  { id:'the_catalyst',   name:'Catalyst',       emoji:'🧪', rarity:'rare',      activation:'on_swap',    durability:6, defaultRank:null, defaultSuit:null, tags:['deck','pips','mult','card','scaling','scores','cost'],     desc:'' },
  { id:'the_wanderer',   name:'Wanderer',       emoji:'🧭', rarity:'rare',    activation:'passive',    durability:5,          defaultRank:null, defaultSuit:null, tags:['stock','other','swap'],           desc:'' },
  // ── Double-tap-based ──
  { id:'amplifier',      name:'Amplifier',      emoji:'📢', rarity:'common',    activation:'double_tap', durability:5,          defaultRank:null, defaultSuit:null, tags:['mult','hand','scores'],     desc:'' },
  { id:'snooze',         name:'Snooze Button',  emoji:'😴', rarity:'common',    activation:'double_tap', durability:5,          defaultRank:null, defaultSuit:null, tags:['time','other'],                desc:'Double-tap: pause the clock for 10s, then Snooze returns to your deck. (5 charges)' },
  { id:'shady_tree',     name:'Shady Tree',     emoji:'🌳', rarity:'rare',      activation:'on_play',    durability:15,         defaultRank:null, defaultSuit:null, tags:['time','hand','position'],    desc:'' },
  { id:'stopwatch',      name:'Stopwatch',      emoji:'⏱️', rarity:'epic',      activation:'double_tap', durability:10, secsPerCharge:6, defaultRank:null, defaultSuit:null, tags:['time','other'],                desc:'Double-tap: pause the clock for up to 60 seconds (each 6 seconds count as 1 charge).' },
  { id:'piggy_bank',     name:'Piggy Bank',     emoji:'🐷', rarity:'common',    activation:'double_tap', durability:5,          defaultRank:null, defaultSuit:null, tags:['credits','other','cost'],   desc:'Double-tap: gain 5 credits, once per round. Becomes inert on use: it can no longer be swapped or discarded. (5 charges)' },
  { id:'magnet',         name:'Magnet',         emoji:'🧲', rarity:'common',    activation:'double_tap', durability:5,          defaultRank:null, defaultSuit:null, tags:['board','other','rank','position','cost'],    desc:'' },
  { id:'photocopier',    name:'Photocopier',    emoji:'📠', rarity:'rare',      activation:'double_tap', durability:5,          defaultRank:null, defaultSuit:null, tags:['board','deck','other','position','buffed'], desc:'' },
  // r739 (owner's Sleight triage): Photocopier's sibling for runs (js/sleight-roles.js). Working name.
  { id:'sequencer',      name:'Sequencer',      emoji:'🪜', rarity:'rare', activation:'double_tap', durability:5, defaultRank:null, defaultSuit:null, tags:['board','deck','other','position','run'], desc:'' },
  { id:'logistics_assistant', name:'Logistics Assistant', emoji:'🚚', rarity:'epic', activation:'double_tap', durability:12, defaultRank:null, defaultSuit:null, tags:['board','other','swap'], desc:'' },
  // r568: the board redeals between rounds by default; the Keeper holds it. Its _keepMode
  // ('both' / 'cards' / 'sleights', double-tap cycles) lives on the board card (js/deck-grid.js boardKeepsCard).
  { id:'keeper',         name:'Keeper',         emoji:'📌', rarity:'rare',      activation:'double_tap', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['board','other','level'],   desc:'' },
  { id:'lockbox',        name:'Lockbox',        emoji:'🔐', rarity:'rare',      activation:'double_tap', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['deck','board','other'],   desc:'' },
  { id:'dealers_choice', name:"Dealer's Choice", emoji:'🃏', rarity:'common', activation:'double_tap', durability:3, defaultRank:null, defaultSuit:null, tags:['board','other','chance','cost'], desc:'' },
  // r572: All Hands plays every hand on the board in reading order (js/sweep.js).
  { id:'all_hands',      name:'All Hands',      emoji:'🧹', rarity:'legendary', activation:'double_tap', durability:3, retired:true, defaultRank:null, defaultSuit:null, tags:['other'], desc:'' },
  // ── Aim-based (fixtures: tap to rotate aim; cannot be swapped or discarded) ──
  { id:'reflect',     name:'Reflect',     emoji:'🪞', rarity:'epic',   activation:'aim', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['replay','card','rank','position','scores'], desc:'' },
  { id:'soul_mirror', name:'Soul Mirror', emoji:'👁️', rarity:'legendary', activation:'aim', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['replay','card','rank','position','scores'],     desc:'' },
  // ── Adjacency / position sleights (r120) ──
  { id:'autopilot',  name:'Autopilot',  emoji:'🤖', rarity:'legendary', activation:'passive', durability:15, retired:true, defaultRank:null, defaultSuit:null, tags:['focus','other','cost','scores'], desc:'' },
  { id:'whetstone',  name:'Whetstone',  emoji:'🔪', rarity:'epic', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['mult','hand','position','swap','discard','scores','scaling'], desc:'' },
  { id:'entourage',  name:'Entourage',  emoji:'👥', rarity:'epic', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['mult','hand','sleights','scores'],            desc:'' },
  { id:'lighthouse', name:'Lighthouse', emoji:'🗼', rarity:'rare', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['mult','hand','position','scores'], desc:'' },
  // ── Focus-spending sleights (r123) ──
  { id:'capacitor', name:'Theta', emoji:'🔋', rarity:'common', activation:'on_discard', durability:5, defaultRank:null, defaultSuit:null, tags:['credits','other','clock','scaling'], desc:'' },
  { id:'siphon',    name:'Siphon',    emoji:'🩸', rarity:'rare',   activation:'double_tap', durability:4, defaultRank:null, defaultSuit:null, tags:['xmult','hand','scores','cost'],  desc:'' },
  // ── Rule Sleights (r675, owner; CHALLENGE_REWARDS.md section 1). While one is on the
  // grid its rule is in force. It lands INERT (cannot be swapped or discarded, only played)
  // and each landing spends a charge (js/rule-sleights.js). Named by the owner (r677).
  { id:'rule_ranks', name:'Double Time',  emoji:'🎟️', rarity:'epic',   activation:'passive', durability:6, defaultRank:null, defaultSuit:null, tags:['replay','card','rank','scores'], desc:'' },
  { id:'rule_evens', name:'Even Keel',    emoji:'⚖️', rarity:'common', activation:'passive', durability:5, defaultRank:null, defaultSuit:null, tags:['focus','card','rank','scores'],  desc:'' },
  { id:'rule_faces', name:'In Your Face', emoji:'🫅', rarity:'rare',   activation:'passive', durability:5, defaultRank:null, defaultSuit:null, tags:['time','card','rank','scores'],   desc:'' },
  // r722 (owner): money Sleights (js/money.js). Descriptions from DESC_TEMPLATES.
  { id:'nest_egg',   name:'Nest Egg',   emoji:'💰', rarity:'rare', activation:'passive',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['credits','other','shop','scaling'], desc:'' },
  { id:'loan_shark', name:'Loan Shark', emoji:'💸', rarity:'rare', activation:'passive',    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['pips','mult','credits','hand','scores','cost'], desc:'' },
  { id:'bogo',       name:'BOGO',       emoji:'🎁', rarity:'epic', activation:'double_tap', durability:3,          defaultRank:null, defaultSuit:null, tags:['board','other','position','buffed','credits'], desc:'' },
  // r676 (owner; CHALLENGE_REWARDS.md section 7): becomes a random Sleight each round (js/changing.js). Working name.
  { id:'floater',    name:'Floater',      emoji:'🌀', rarity:'epic',   activation:'passive', durability:6, defaultRank:null, defaultSuit:null, tags:['other','chance'], desc:'' },
  // ── Focus-capacity sleights (r104) ──
  { id:'power_cell',  name:'Power Cell',  emoji:'🔋', rarity:'rare',   activation:'on_draw', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['focus','other'], desc:'When it enters the grid: +10 Focus. While it remains on the grid: +10 to your Focus limit.' },
  { id:'slow_burn',   name:'Slow Burn',   emoji:'🕯️', rarity:'rare',   activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, tags:['focus','other','clock'], desc:'' },
  // ── Focus-rate sleights (r180) - passive, read by focusRateMods() ──
  { id:'governor', name:'Governor', emoji:'🎚️', rarity:'epic', activation:'passive', durability:'infinite', defaultRank:null, defaultSuit:null, retired:true, tags:['focus','other'], desc:'While on the grid, you have 1.5× as long to earn the same Focus speed bonus.' },
  // ── Spectrum deck fixtures (r161) - four extra cards shuffled into the Spectrum
  // deck at run start. They are NOT offered by the shop, Mart, wheel, reward grid
  // or events (see SLEIGHT_FIXTURES): the only way to have one is to draw it.
  // activation:'adjacent' - count the hands scored in a cell touching this card;
  // at `adjacentPlays` it pays out `payout` and then LEAVES THE BOARD (r280),
  // cycling back into the draw pile with its charges, so it can be drawn again.
  // Progress rides on the card (`_adjPlays`) and is carried through a deck cycle
  // by discardToPlayed's field list - leave it out and a half-counted fixture
  // silently resets at every round boundary.
  { id:'shift_swap',  name:'Shift Swap',  emoji:'🔀', rarity:'fixture', activation:'adjacent', adjacentPlays:2, adjCards:true, payout:{ swaps:2 },    durability:'infinite', defaultRank:null, defaultSuit:null, retired:true, tags:['stock','other','position'], desc:'Score two cards adjacent to this sleight to get +2 swaps. Discards itself after giving bonus.' },
  { id:'recycler',    name:'Recycler',    emoji:'♻️', rarity:'rare', activation:'passive', durability:6, defaultRank:null, defaultSuit:null, tags:['stock','other','position','swap','discard'], desc:'' },
  { id:'time_clock',  name:'Time Clock',  emoji:'⏱️', rarity:'fixture', activation:'adjacent', adjacentPlays:2, payout:{ pause_seconds:10 }, durability:'infinite', defaultRank:null, defaultSuit:null, retired:true, tags:['time','other','position'],     desc:'Score two hands beside this card to pause the clock for 10s, then it goes back into the deck.' },
  { id:'petty_cash',  name:'Petty Cash',  emoji:'💵', rarity:'fixture', activation:'adjacent', adjacentPlays:2, payout:{ coins:5 },    durability:'infinite', defaultRank:null, defaultSuit:null, tags:['credits','other','position'],    desc:'Score two hands beside this card to get +5 credits. Discards itself after giving bonus.' },
];

// Deck fixtures: dealt into the Spectrum deck, never sold or awarded. Kept in
// SLEIGHT_POOL (sleightDef / rendering look them up there) but filtered out of
// every offer pool.
const SLEIGHT_FIXTURES = new Set(['shift_swap', 'time_clock', 'petty_cash']);
// r576: an `eventOnly` Sleight (the Lockbox) comes from its event and nowhere else.
function sleightOfferable(def) { return !!def && !def.retired && !SLEIGHT_FIXTURES.has(def.id) && !def.eventOnly; }

// ── Aim sleights (Reflect, Soul Mirror): fixtures that point at an adjacent cell ──
// ══════════════════════════════════════════════
// COMBO FAMILIES - legibility layer (r83)
// Each family is a set of "slots"; a slot is one required entity id, or an array
// (own ANY one of these). checkComboMilestones() (called at round start) fires a
// one-time "COMBO ONLINE" toast when a family is fully owned, and a one-time
// "combo close - need X" hint when you own all but one slot - so synergies feel
// discovered, not stumbled into. A wrong/renamed id just fails to fire (harmless).
// ══════════════════════════════════════════════
