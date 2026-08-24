const SUITS = ['♠','♥','♦','♣'];
// Six Suits mode adds two extra suits (Star + Triangle) to dilute the deck so
// flushes become rare. ACTIVE_SUITS is the suit list the current game actually
// uses — set per-mode in startGame(). Classic play leaves it equal to SUITS,
// so nothing about the four-suit game changes.
const SUITS_EXTRA = ['★','▲'];
const SUITS_SIX = [...SUITS, ...SUITS_EXTRA];
let ACTIVE_SUITS = SUITS;
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED = new Set(['♥','♦']);

// ── SPECTRUM MODE (numeric deck) ──────────────────────────────────────────────
// A deck with no suits and no court cards: seven COLOURS instead of four suits,
// and plain values 1-15 plus a lone 20 instead of A/2-10/J/Q/K.
// The colour is stored in the card's `suit` field and the value in `rank`, so
// every existing system (flush = all one suit, cardKey, curses, saves, the deck
// audit) keeps working untouched — only the CONTENT of the two fields changes.
// Colours are emoji so any UI that just prints the suit character (deck view,
// records, tooltips, the Mart) stays readable with no extra styling.
const COLORS = ['🔴','🟡','🔵','🟢','🟣','🟠','⚫'];
const COLOR_NAMES = { '🔴':'Red', '🟡':'Yellow', '🔵':'Blue', '🟢':'Green', '🟣':'Purple', '🟠':'Orange', '⚫':'Black' };
// Face hex for each colour — used by the card face, score particles and chips.
const COLOR_HEX = { '🔴':'#d43b3b', '🟡':'#e0b81c', '🔵':'#2f6fd0', '🟢':'#2f9e54', '🟣':'#8b4bc8', '🟠':'#e07a1f', '⚫':'#23201c' };
// Two classes: `num-suit` (generic hook — carries the --num-color/--num-ink
// tokens wherever a colour card is drawn) plus the colour's own class.
const COLOR_CLASS = { '🔴':'num-suit col-red', '🟡':'num-suit col-yellow', '🔵':'num-suit col-blue', '🟢':'num-suit col-green', '🟣':'num-suit col-purple', '🟠':'num-suit col-orange', '⚫':'num-suit col-black' };
const RANKS_NUMERIC = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','20'];
// True for a card that belongs to the numeric deck — asked of the CARD, not the
// mode, so the hand preview / score dance / saved runs all render it correctly
// wherever they get their cards from.
function isColorSuit(suit) { return !!COLOR_HEX[suit]; }
function isNumericMode() { return !!(typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.numeric); }

// ACTIVE_RANKS is the rank list the current game actually uses (the mirror of
// ACTIVE_SUITS below). Set per-mode in startGame(); classic modes leave it equal
// to RANKS so nothing about the A-K game changes.
let ACTIVE_RANKS = RANKS;

// RANK_ORDER / RANK_PIPS carry the numeric ranks too. '2'-'10' already map to
// themselves, so only 1, 11-15 and 20 are new — no classic key changes value.
const RANK_ORDER = {A:1,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13,
                    '11':11,'12':12,'13':13,'14':14,'15':15,'20':20};
const RANK_PIPS  = {A:11,J:10,Q:10,K:10};   // numeric ranks fall through to parseInt (pips = value)

// Sort helpers — deck view / shop card list. Numeric ranks sort by value; an
// unknown rank sinks to the end.
function rankSortVal(rk) { return RANK_ORDER[rk] ?? (parseInt(rk) || 99); }
function suitSortVal(s)  { const i = ACTIVE_SUITS.indexOf(s); return i < 0 ? 99 : i; }

const HAND_BASE = {
  'Run of 3':        { pips:20, mult:3 },
  'Pair':            { pips:20, mult:2 },
  'Two Pair':        { pips:20, mult:2 },
  'Three of a Kind': { pips:30, mult:3 },
  'Run of 4':        { pips:28, mult:4 },
  'Straight':        { pips:30, mult:4 },
  'Flush of 3':      { pips:25, mult:3 },
  'Flush of 4':      { pips:32, mult:4 },
  'Flush':           { pips:35, mult:4 },
  'Full House':      { pips:40, mult:4 },
  'Four of a Kind':  { pips:60, mult:7 },
  'Straight Flush':  { pips:100,mult:8 },
};

const GAME_DURATION = 1200; // 20 minutes in seconds
const ROUND_DURATION = 180;
const LEVEL_UP_DURATION = 45;
const BASE_GOAL = 1000;
const GOAL_SCALE = 1.35;
const TRICK_CARD_INTERVAL = 20; // seconds

function suitClass(suit) {
  return COLOR_CLASS[suit]
      || { '♥':'suit-hearts', '♦':'suit-diamonds', '♠':'suit-spades', '♣':'suit-clubs', '★':'suit-stars', '▲':'suit-triangles' }[suit] || '';
}

// Central card capability gate — add new card types here, nowhere else
function cardCan(card, action) {
  if (!card) return false;
  if (card._isStone) {
    // Stones can be drawn, fall, render, and be swapped. Nothing else.
    return action === 'fall' || action === 'render' || action === 'swap' || action === 'draw';
  }
  if (card._isTrick) {
    // Tricks fall, render, and swap like normal cards — but can't be selected, scored, or discarded
    return action === 'fall' || action === 'render' || action === 'swap';
  }
  if (card._isSleight) {
    // Aim sleights are fixtures: fall & render only — never swapped, discarded, or selected
    // (so a single tap is free to rotate aim).
    if (AIM_SLEIGHTS.has(sleightDef(card)?.id)) return action === 'fall' || action === 'render';
    return action === 'fall' || action === 'render' || action === 'swap' || action === 'select' || action === 'discard';
  }
  if (card.isChallenge) {
    return action === 'render';
  }
  // Snared curse: the card is stuck — no swapping or discarding until it lifts
  if (card.rank && typeof cardCurses !== 'undefined' && cardCurses[cardKey(card.rank, card.suit)]?.id === 'snared'
      && (action === 'swap' || action === 'discard')) return false;
  // The Recall: cards of the withdrawn rank sit on the board doing nothing.
  if (typeof isCardRecalled === 'function' && isCardRecalled(card)) return action === 'fall' || action === 'render';
  // Normal cards can do everything
  return true;
}

// ── TRICK POOL (subset for prototype) ──
