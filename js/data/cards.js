const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED = new Set(['♥','♦']);
const RANK_ORDER = {A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13};
const RANK_PIPS  = {A:11,J:10,Q:10,K:10};

const HAND_BASE = {
  'Run of 3':        { pips:20, mult:3 },
  'Pair':            { pips:20, mult:2 },
  'Two Pair':        { pips:20, mult:2 },
  'Three of a Kind': { pips:30, mult:3 },
  'Run of 4':        { pips:28, mult:4 },
  'Straight':        { pips:30, mult:4 },
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
  return { '♥':'suit-hearts', '♦':'suit-diamonds', '♠':'suit-spades', '♣':'suit-clubs' }[suit] || '';
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
  // Normal cards can do everything
  return true;
}

// ── TRICK POOL (subset for prototype) ──
