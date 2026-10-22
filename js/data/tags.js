// ══════════════════════════════════════════════════════════════════════════
// ENTITY TAGS (r634) - the one vocabulary every Trick, Sleight and Knack is
// described in. Content, no logic.
//
// Every row in TRICK_POOL / SLEIGHT_POOL / KNACK_POOL carries `tags: [...]`
// drawn ONLY from the ids below. The Builds browser (js/builds.js) filters
// and groups by these; text matching is the search box's job, not the axis.
// A tag belongs to exactly one group, and a group is one filter dropdown.
//
// Rules for tagging an entity:
//   PAYS   what it gives. Every tag that applies (Storm pays mult; Cull pays
//          focus; Deep Breath pays xpips). An entity that gives nothing of
//          these (an information Knack, a boss shield) carries `info` or
//          nothing in this group.
//   SCOPE  exactly one: `card` (pays per scored card), `hand` (pays once per
//          hand), `other` (not tied to a hand: round start, level-up, a
//          reward, the shop, a boss, a double-tap).
//   WHEN   what has to be true (any number, none is fine): the hand family,
//          a rank or suit, a position, the clock, an action.
//   HOW    `scores` if it changes the hand's PIPS / MULT / xPIPS / xMULT
//          (the score itself, so making Focus apply again counts); `scaling` if it grows permanently over the run
//          (a buff that stays, a counter that climbs); `chance` if luck is
//          rolled; `line` if it marks a row or column (Tray Order reads this).
//
// Sleight ACTIVATION is not a tag: the row's `activation` field is the axis.
// Rarity and type are read from the row and the pool.
// ══════════════════════════════════════════════════════════════════════════

const TAG_GROUPS = [
  { id: 'pays',  label: 'PAYS',  multi: true,  note: 'what it gives' },
  { id: 'scope', label: 'SCOPE', multi: false, note: 'per card, per hand, or elsewhere' },
  { id: 'when',  label: 'WHEN',  multi: true,  note: 'what has to be true' },
  { id: 'how',   label: 'HOW',   multi: true,  note: 'how it behaves' },
];

const TAG_DEFS = [
  // ── PAYS ──
  { id: 'pips',    group: 'pays', label: 'Pips',     cls: 'kw-pips',    def: 'Adds pips.' },
  { id: 'mult',    group: 'pays', label: 'Mult',     cls: 'kw-mult',    def: 'Adds mult.' },
  { id: 'xpips',   group: 'pays', label: 'x Pips',   cls: 'kw-xpips',   def: 'Multiplies the pip total.' },
  { id: 'xmult',   group: 'pays', label: 'x Mult',   cls: 'kw-xmult',   def: 'Multiplies the mult.' },
  { id: 'focus',   group: 'pays', label: 'Focus',    cls: 'kw-focus',   def: 'Adds Focus, or changes how it is made or kept.' },
  { id: 'time',    group: 'pays', label: 'Time',     cls: 'kw-time',    def: 'Pauses or rewinds the clock, or starts a round with more.' },
  { id: 'credits', group: 'pays', label: 'Credits',  cls: 'kw-credits', def: 'Pays credits, or changes prices and payouts.' },
  { id: 'replay',  group: 'pays', label: 'Replay',   cls: 'kw-replay',  def: 'Scores a card again.' },
  { id: 'stock',   group: 'pays', label: 'Stock',    cls: 'kw-swap',    def: 'Gives swaps or discards, or changes what they cost.' },
  { id: 'deck',    group: 'pays', label: 'Deck',     cls: 'kw-board',   def: 'Changes the cards in the deck: buffs, adds, removes.' },
  { id: 'board',   group: 'pays', label: 'Board',    cls: 'kw-board',   def: 'Moves or changes the cards on the grid.' },
  { id: 'limit',   group: 'pays', label: 'Limits',   cls: 'kw-limit',   def: 'Raises a limit.' },
  { id: 'retrigger', group: 'pays', label: 'Retrigger', cls: 'kw-trick', def: 'Fires a Trick again: a prime, a mirror, a force-trigger.' },
  { id: 'charges', group: 'pays', label: 'Sleight charges', cls: 'kw-sleight', def: 'Restores Sleight charges, or helps the Sleights you hold.' },
  { id: 'luck',    group: 'pays', label: 'Luck',     cls: 'kw-reward',  def: 'Changes the odds of offers or rolls.' },
  { id: 'info',    group: 'pays', label: 'Info',     cls: 'kw-round',   def: 'Shows something you could not see.' },
  { id: 'shield',  group: 'pays', label: 'Shield',   cls: 'kw-bad',     def: 'Softens a boss, a curse or a failed round.' },

  // ── SCOPE ──
  { id: 'card',  group: 'scope', label: 'Per card', cls: 'kw-hand',  def: 'Pays on each scored card.' },
  { id: 'hand',  group: 'scope', label: 'Per hand', cls: 'kw-hand',  def: 'Pays once per hand.' },
  { id: 'other', group: 'scope', label: 'Elsewhere', cls: 'kw-round', def: 'Pays outside a hand: a round start, a level-up, a reward, the shop, a boss, a double-tap.' },

  // ── WHEN ──
  { id: 'run',      group: 'when', label: 'Runs',      cls: 'kw-hand',    def: 'Needs a run.' },
  { id: 'set',      group: 'when', label: 'Sets',      cls: 'kw-hand',    def: 'Needs a set (pair, three or four of a kind, full house).' },
  { id: 'flush',    group: 'when', label: 'Flushes',   cls: 'kw-hand',    def: 'Needs a flush.' },
  { id: 'size',     group: 'when', label: 'Hand size', cls: 'kw-limit',   def: 'Cares how many cards the hand has.' },
  { id: 'rank',     group: 'when', label: 'Ranks',     cls: 'kw-board',   def: 'Cares which ranks are played.' },
  { id: 'suit',     group: 'when', label: 'Suits',     cls: 'kw-board',   def: 'Cares which suits are played.' },
  { id: 'position', group: 'when', label: 'Position',  cls: 'kw-board',   def: 'Cares where the cards sit on the grid.' },
  { id: 'streak',   group: 'when', label: 'Streaks',   cls: 'kw-streak',  def: 'Cares about repeating a hand type.' },
  { id: 'clock',    group: 'when', label: 'Clock',     cls: 'kw-time',    def: 'Cares how much time is left or has passed.' },
  { id: 'pause',    group: 'when', label: 'Pauses',    cls: 'kw-pause',   def: 'Fires on a pause or a rewind.' },
  { id: 'discard',  group: 'when', label: 'Discards',  cls: 'kw-discard', def: 'Fires on a discard.' },
  { id: 'swap',     group: 'when', label: 'Swaps',     cls: 'kw-swap',    def: 'Fires on a swap.' },
  { id: 'buffed',   group: 'when', label: 'Buffed cards', cls: 'kw-reward', def: 'Cares about cards carrying buffs.' },
  { id: 'wild',     group: 'when', label: 'Wilds',     cls: 'kw-wild',    def: 'Cares about wild cards.' },
  { id: 'sleights', group: 'when', label: 'Sleights',  cls: 'kw-sleight', def: 'Cares about the Sleights you own.' },
  { id: 'tricks',   group: 'when', label: 'Tricks',    cls: 'kw-trick',   def: 'Cares about the Tricks you own or their order.' },
  { id: 'level',    group: 'when', label: 'Level-up',  cls: 'kw-round',   def: 'Fires at a round end or a level-up.' },
  { id: 'reward',   group: 'when', label: 'Rewards',   cls: 'kw-reward',  def: 'Fires on a reward screen.' },
  { id: 'shop',     group: 'when', label: 'Shop',      cls: 'kw-buy',     def: 'Fires in the shop.' },
  { id: 'boss',     group: 'when', label: 'Boss',      cls: 'kw-bad',     def: 'Fires on a boss.' },
  { id: 'challenge', group: 'when', label: 'Challenge', cls: 'kw-bad',    def: 'Cares about challenge cards.' },
  { id: 'start',    group: 'when', label: 'Round start', cls: 'kw-round', def: 'Fires when a round starts.' },
  { id: 'replays',  group: 'when', label: 'Replays',   cls: 'kw-replay',  def: 'Fires when a card scores again.' },

  // ── HOW ──
  { id: 'scores',  group: 'how', label: 'Scores',   cls: 'kw-score',  def: 'Changes the hand’s score: pips, mult, x pips or x mult.' },
  { id: 'scaling', group: 'how', label: 'Scaling',  cls: 'kw-reward', def: 'Grows for the rest of the run.' },
  { id: 'chance',  group: 'how', label: 'Chance',   cls: 'kw-wild',   def: 'Rolls the dice.' },
  { id: 'line',    group: 'how', label: 'Marks a line', cls: 'kw-board', def: 'Marks a row or column on the grid.' },
  { id: 'cost',    group: 'how', label: 'Has a cost', cls: 'kw-bad',   def: 'Takes something to give something.' },
];

const TAG_BY_ID = {};
TAG_DEFS.forEach(d => { TAG_BY_ID[d.id] = d; });
function tagDef(id) { return TAG_BY_ID[id] || null; }
function tagsInGroup(group) { return TAG_DEFS.filter(d => d.group === group); }
