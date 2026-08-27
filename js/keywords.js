// ══════════════════════════════════════════════════════════════════════════
// MECHANIC KEYWORDS - one registry for colour + plain-English definition.
//
// Every keyword that appears in entity text gets a colour (matching the UI where
// there is one to match: pips = the blue PIPS chip, mult = the red MULT chip,
// focus = the purple FOCUS chip) and a short definition. Tooltips colour the
// words inline AND list the definitions beside the tooltip, so a player never has
// to already know the vocabulary to read a card.
//
// The term list was built by scanning every desc in TRICK_POOL / KNACK_POOL /
// SLEIGHT_POOL, not guessed - see the frequency counts in the r143 commit.
// Order matters: multi-word terms are matched before single words, so
// "selection size" wins over "size", and "x pips" wins over "pips".
// ══════════════════════════════════════════════════════════════════════════

const KEYWORD_DEFS = [
  // ── scoring core ──
  { key:'xmult',     cls:'kw-xmult',   terms:['xmult','×mult','x mult'],
    name:'×Mult',    def:'Multiplies your Mult itself, instead of adding to it. Applied after all + Mult.' },
  { key:'xpips',     cls:'kw-xpips',   terms:['xpips','×pips','x pips'],
    name:'×Pips',    def:'Multiplies the hand’s total Pips, instead of adding to them.' },
  { key:'pips',      cls:'kw-pips',    terms:['pips','pip'],
    name:'Pips',     def:'The base points a hand is worth. Final score = Pips × Mult.' },
  { key:'mult',      cls:'kw-mult',    terms:['mult'],
    name:'Mult',     def:'The multiplier applied to Pips. Final score = Pips × Mult.' },
  { key:'focus',     cls:'kw-focus',   terms:['focus'],
    name:'Focus',    def:'The meter beside the grid. It builds as you play and adds a score multiplier; it decays if you stall.' },
  { key:'score',     cls:'kw-score',   terms:['score'],
    name:'Score',    def:'Your points this round. Reach the round Goal to move on.' },
  { key:'goal',      cls:'kw-score',   terms:['goal'],
    name:'Goal',     def:'The score you must reach before the clock runs out to finish the round.' },

  // ── economy / resources ──
  { key:'credits',   cls:'kw-credits', terms:['credits','credit','gold'],
    name:'Credits',  def:'The shop currency. Earned from rounds, rewards and selling.' },
  { key:'time',      cls:'kw-time',    terms:['seconds','second','time'],
    name:'Time',     def:'The round clock. It runs down while you play; at zero the round ends.' },
  { key:'pause',     cls:'kw-time',    terms:['pause','paused','pauses'],
    name:'Pause',    def:'Freezes the round clock for a moment - you act for free while it is held.' },
  { key:'rewind',    cls:'kw-rewind',  terms:['rewind','rewinds','rewound'],
    name:'Rewind',   def:'Moves the clock backward, re-entering time you already spent.' },

  // ── actions ──
  { key:'swap',      cls:'kw-swap',    terms:['swaps','swap','swapped','swapping'],
    name:'Swap',     def:'Trade two adjacent cards’ positions. Limited per round by the Swaps limit.' },
  { key:'discard',   cls:'kw-discard', terms:['discards','discard','discarded','discarding'],
    name:'Discard',  def:'Throw selected cards away and draw replacements. Limited per round by the Discards limit.' },
  { key:'play',      cls:'kw-play',    terms:['played','plays','play'],
    name:'Play',     def:'Submitting a selected hand to score it.' },
  { key:'sell',      cls:'kw-sell',    terms:['sell','sold','sells'],
    name:'Sell',     def:'Trade an owned Trick or Knack back for credits - always less than it cost.' },
  { key:'buy',       cls:'kw-buy',     terms:['buy','bought','buys','purchase'],
    name:'Buy',      def:'Spend credits in the shop. Buying several at once earns a bundle discount.' },
  { key:'draw',      cls:'kw-play',    terms:['draw','draws','drawn'],
    name:'Draw',     def:'Pull a new card from the deck onto the grid.' },
  { key:'retrigger', cls:'kw-replay',  terms:['retrigger','retriggers','replay','replays','replayed'],
    name:'Retrigger',def:'Fire an effect a second time. Retriggered scoring counts fully again.' },

  // ── hand shapes ──
  { key:'run',       cls:'kw-hand',    terms:['runs','run'],
    name:'Run',      def:'Cards in consecutive rank order, e.g. 5-6-7. Ace counts high or low.' },
  { key:'set',       cls:'kw-hand',    terms:['sets','set'],
    name:'Set',      def:'Cards sharing the same rank, e.g. three 8s.' },
  { key:'flush',     cls:'kw-hand',    terms:['flush'],
    name:'Flush',    def:'Cards all of the same suit.' },
  { key:'pair',      cls:'kw-hand',    terms:['pair'],
    name:'Pair',     def:'Two cards of the same rank.' },
  { key:'straight',  cls:'kw-hand',    terms:['straight'],
    name:'Straight', def:'Five cards in consecutive rank order.' },
  { key:'streak',    cls:'kw-streak',  terms:['streak','streaks'],
    name:'Streak',   def:'Playing the same hand type repeatedly. Streaks build bonuses and break when you switch.' },
  { key:'hand',      cls:'kw-hand',    terms:['hands','hand'],
    name:'Hand',     def:'The set of connected cards you select and play together.' },

  // ── board ──
  { key:'selection', cls:'kw-limit',   terms:['selection size'],
    name:'Selection Size', def:'How many cards you can select at once. Upgradeable; also caps the shop bundle discount.' },
  { key:'adjacent',  cls:'kw-board',   terms:['adjacent','adjacency','orthogonally'],
    name:'Adjacent', def:'Sharing an edge on the grid - up, down, left or right (not diagonal).' },
  { key:'row',       cls:'kw-board',   terms:['rows','row'],
    name:'Row',      def:'A horizontal line of grid cells.' },
  { key:'column',    cls:'kw-board',   terms:['columns','column'],
    name:'Column',   def:'A vertical line of grid cells.' },
  { key:'corner',    cls:'kw-board',   terms:['corners','corner'],
    name:'Corner',   def:'One of the four cells at the extremes of the grid.' },
  { key:'grid',      cls:'kw-board',   terms:['grid','board'],
    name:'Grid',     def:'The playing field of cards. Its size is upgradeable.' },
  { key:'deck',      cls:'kw-board',   terms:['deck'],
    name:'Deck',     def:'Every card you own. Scored cards return to it and are reshuffled each round.' },
  { key:'suit',      cls:'kw-board',   terms:['suits','suit'],
    name:'Suit',     def:'♠ ♥ ♦ ♣. Suits are neutral by default - effects come from entities.' },
  { key:'rank',      cls:'kw-board',   terms:['ranks','rank'],
    name:'Rank',     def:'A card’s number or letter, A through K.' },
  { key:'wild',      cls:'kw-wild',    terms:['wild','wildcard'],
    name:'Wild',     def:'Stands in for any rank and/or suit when a hand is detected.' },

  // ── entities ──
  { key:'trick',     cls:'kw-trick',   terms:['tricks','trick'],
    name:'Trick',    def:'A scoring buff kept in your side tray. Capped by the Trick Slots limit.' },
  { key:'sleight',   cls:'kw-sleight', terms:['sleights','sleight'],
    name:'Sleight',  def:'A special card that lives in your deck and fires on a condition. Has limited charges.' },
  { key:'knack',     cls:'kw-knack',   terms:['knacks','knack'],
    name:'Knack',    def:'A permanent rule-changer. Always on once owned, never takes a slot on the grid.' },
  { key:'limit',     cls:'kw-limit',   terms:['limits','limit'],
    name:'Limit',    def:'An upgradeable cap - grid size, swaps, discards, selection size, trick slots and so on.' },
  { key:'curse',     cls:'kw-bad',     terms:['curse','cursed'],
    name:'Curse',    def:'A penalty attached to a card in your deck until it is cleansed.' },
  { key:'stone',     cls:'kw-bad',     terms:['stone','stones'],
    name:'Stone',    def:'An inert blocker that occupies a grid cell and cannot be played.' },
  { key:'boss',      cls:'kw-bad',     terms:['boss','bosses'],
    name:'Boss',     def:'The round that ends each Act, with a modifier that changes the rules.' },
  { key:'round',     cls:'kw-round',   terms:['rounds','round'],
    name:'Round',    def:'One timed attempt at a Goal. Clearing it advances you a node.' },
  { key:'level',     cls:'kw-round',   terms:['level','levels'],
    name:'Level',    def:'How far into the run you are. Goals scale with it.' },
  { key:'reward',    cls:'kw-reward',  terms:['reward','rewards'],
    name:'Reward',   def:'The pick-a-tile grid between rounds. Skipping the whole grid pays credits instead.' },
  { key:'shop',      cls:'kw-buy',     terms:['shop','mart'],
    name:'Shop',     def:'The LETHE Mart, where credits become Tricks, Sleights, Knacks and Limit upgrades.' },

  // ── rarity ──
  { key:'common',    cls:'kw-r-common',    terms:['common'],    name:'Common',    def:'The most frequent rarity (59% of shop rolls).' },
  { key:'rare',      cls:'kw-r-rare',      terms:['rare'],      name:'Rare',      def:'Uncommon rarity (28% of shop rolls).' },
  { key:'epic',      cls:'kw-r-epic',      terms:['epic'],      name:'Epic',      def:'Scarce rarity (10% of shop rolls).' },
  { key:'legendary', cls:'kw-r-legendary', terms:['legendary'], name:'Legendary', def:'Very scarce rarity (2% of shop rolls).' },
  { key:'mythic',    cls:'kw-r-mythic',    terms:['mythic'],    name:'Mythic',    def:'The scarcest rarity (1% of shop rolls).' },
];

// One flat, pre-sorted alternation. Longest terms first so multi-word and
// x-prefixed keywords win over their shorter substrings.
const _KW_TERMS = KEYWORD_DEFS
  .flatMap(d => d.terms.map(t => ({ t, d })))
  .sort((a, b) => b.t.length - a.t.length);

function _kwEscape(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
const _KW_RE = new RegExp('(?<![\\w-])(' + _KW_TERMS.map(x => _kwEscape(x.t)).join('|') + ')(?![\\w-])', 'gi');
const _KW_BY_TERM = {};
_KW_TERMS.forEach(x => { _KW_BY_TERM[x.t.toLowerCase()] = x.d; });

// Wrap every mechanic keyword in its colour class. Safe on plain text only -
// callers must not pass HTML they care about, since this does not parse tags.
function highlightKeywords(text) {
  if (text == null) return '';
  return String(text).replace(_KW_RE, (m) => {
    const d = _KW_BY_TERM[m.toLowerCase()];
    return d ? `<span class="kw ${d.cls}">${m}</span>` : m;
  });
}

// The distinct keywords present in a piece of text, in first-appearance order -
// this is what the tooltip turns into definition boxes.
function keywordsIn(text) {
  if (text == null) return [];
  const seen = new Set(), out = [];
  String(text).replace(_KW_RE, (m) => {
    const d = _KW_BY_TERM[m.toLowerCase()];
    if (d && !seen.has(d.key)) { seen.add(d.key); out.push(d); }
    return m;
  });
  return out;
}
