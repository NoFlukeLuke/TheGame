const BOSS_WINDOW_DURATION = 180; // 3 minutes to survive
const BOSS_BLOCKED_CELLS_MIN = 3;
const BOSS_BLOCKED_CELLS_MAX = 5;

let nextBossTime  = GAME_DURATION - BOSS_LOOP_DURATION; // first boss at 6-min mark elapsed
let bossActive    = false;
// The boss runs on the ONE round clock since r205 (roundSeconds / roundInterval);
// there is no separate boss countdown or boss interval any more. See triggerBoss.
let blockedCells  = new Set(); // keys like "r-c"
let bossNumber    = 0;
let savedRoundSeconds = 0; // round timer value at boss start

// ── Node-based progression (Normal Mode) ──
// Each quarter = 5 normal events + 1 forced boss = 6 nodes; QUARTERS_PER_RUN of them.
let actNumber         = 1;     // current quarter (1..QUARTERS_PER_RUN, js/quarter.js)
let nodeInAct         = 0;     // events completed in current act (0–4 normal; at 5 → boss)
let forceBossNextRound = false; // triggers boss after next round deal animation

// Permanent pip bonuses per card key "rank-suit"
let permPips = {};   // { "A-♠": 3, ... }
let permMult = {};   // { "A-♠": 1, ... }
let permXPips  = {}; // { "A-♠": 2, ... } multiplies that card's pip contribution (default 1)
let permXMult  = {}; // { "A-♠": 2, ... } multiplies total mult per scored card of this key (default 1)
let permRetrig = {}; // { "A-♠": 1, ... } extra times this card scores its pips (default 0)
// Seconds this card puts BACK on the clock when it scores (the Card Market's time
// card, r211). It is a rewind, not a pause: it goes through rewindTime() like
// every other clock gain, so it respects rewindCeiling() and shows the ⏪ floater.
let permTime   = {}; // { "<card id>": 4, ... } seconds rewound per scored copy
// ── FLAT vs SCALING card buffs (r209) ────────────────────────────────────────
// permPips / permMult above are FLAT: the card scores that bonus, the same
// amount, every single time it is played. The wording "permanently gains +1
// mult" was used for them everywhere, which reads as growth and is why a player
// could hold a blessed card for a whole run waiting for a number that was never
// going to move.
// permPipsGrow / permMultGrow are the SCALING kind: they are not scored at all,
// they are how much the FLAT bonus goes up each time the card is played. So a
// card with permMultGrow 1 is worth +1 mult after its first play, +2 after its
// second, and so on. Grown in growCardScaling() after the score commits.
// The two are separate stores rather than one field with a flag, because a card
// can legitimately carry both (a flat blessing AND a scaling one), and because
// every existing read of permMult keeps working untouched.
let permPipsGrow = {}; // { cardId: 2 } - flat pips this card gains per play
let permMultGrow = {}; // { cardId: 1 } - flat mult this card gains per play

// Called once per scored card, after the hand's score is committed (play-hand.js),
// for the same reason recordNaturalScale is: a scaling buff earned by this hand
// must pay out on the NEXT one, or the first play would already be the second.
function growCardScaling(cards) {
  if (!cards || !cards.length) return;
  const seen = new Set();
  cards.forEach(card => {
    if (!card || !card.rank) return;
    const k = cardId(card);
    if (seen.has(k)) return;          // a retriggered card grows once per HAND
    seen.add(k);
    const gp = permPipsGrow[k] || 0, gm = permMultGrow[k] || 0;
    if (gp) permPips[k] = (permPips[k] || 0) + gp;
    if (gm) permMult[k] = (permMult[k] || 0) + gm;
  });
}

// The one place a card's buffs are put into words, so the reward tile, the
// event, the grid tooltip, the deck view and the shop cannot drift apart again.
// Returns plain lines, strongest first.
function cardBuffLines(k) {
  const lines = [];
  const pp = permPips[k] || 0, pm = permMult[k] || 0;
  const gp = permPipsGrow[k] || 0, gm = permMultGrow[k] || 0;
  const xp = permXPips[k] || 1, xm = permXMult[k] || 1, re = permRetrig[k] || 0;
  if (gp) lines.push(`Scales +${gp} pips each time it's played`);
  if (gm) lines.push(`Scales +${gm} mult each time it's played`);
  if (pp) lines.push(`Scores +${pp} pips when played`);
  if (pm) lines.push(`Scores +${pm} mult when played`);
  if (xp > 1) lines.push(`\u00d7${xp} pip score`);
  if (xm > 1) lines.push(`\u00d7${xm} mult`);
  if (re) lines.push(`+${re} replay`);
  return lines;
}

// Every ordinary deck card that carries at least one permanent buff (r234).
//
// "Two random cards leave your deck" is only a COST if the cards are worth
// something, and on a 52-card deck a random pair almost never is - The Price was
// selling real power for nothing. The trades that take cards now take BUFFED
// cards, which is the only version of that cost a player can feel.
//
// Reads through cardBuffLines() rather than testing the seven perm* stores by
// hand, so a buff kind added later is counted here for free.
function buffedDeckCards() {
  return everyDeckCard().filter(c => cardBuffLines(cardId(c)).length > 0);
}

// ── CARD CURSES (reward-grid debuffs) ──
// A curse afflicts one specific card identity (key "rank-suit", like permPips).
// Curses are worked off by SCORING the cursed card `liftAfter` times - playing
// through the curse is the cure - or removed instantly by a Cleanse tile.
// cardCurses = { "<card id>": { id:'leaden', left:3 }, ... }  (reset on newGame)
// Keyed per CARD, not per rank+suit: cursing one 9 of spades leaves any other alone.
let cardCurses = {};
const CURSE_DEFS = {
  leaden: { icon: '⚓', name: 'Leaden', liftAfter: 3, desc: 'Scores 0 pips. Lifts after scoring it 3 times.' },
  taxing: { icon: '🩸', name: 'Taxing', liftAfter: 4, desc: '-3s every time it scores. Lifts after scoring it 4 times.' },
  snared: { icon: '🕸️', name: 'Snared', liftAfter: 2, desc: "Can't be swapped or discarded. Lifts after scoring it 2 times." },
};
// Curse one random un-cursed card; returns {rank,suit,curse} or null.
function curseRandomCard(curseId) {
  const pool = everyDeckCard().filter(c => !cardCurses[cardId(c)]);
  if (!pool.length) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const id = curseId || Object.keys(CURSE_DEFS)[Math.floor(Math.random() * Object.keys(CURSE_DEFS).length)];
  cardCurses[cardId(pick)] = { id, left: CURSE_DEFS[id].liftAfter };
  return { rank: pick.rank, suit: pick.suit, curse: id };
}
function cleanseRandomCurse() {
  const keys = Object.keys(cardCurses);
  if (!keys.length) return null;
  const k = keys[Math.floor(Math.random() * keys.length)];
  const id = cardCurses[k].id;
  delete cardCurses[k];
  // The key is a card id now, which is not something to show anyone - look the
  // card up so the message can name the face that was actually cleansed.
  const card = everyDeckCard().find(c => cardId(c) === k);
  return { key: k, curse: id, face: card ? `${card.rank}${card.suit}` : 'a card' };
}

// ── Scaling bonus accumulators ──
let bonusMult_fives   = 0;
let bonusMult_nines   = 0;
let bonusMult_tens    = 0;
let bonusMult_compound  = 0;   // Compound Trick: +0.1 per hand played
let bonusPips_prolific  = 0;   // Prolific Trick: +1 pip per hand played
let bonusFocus_acorns   = 0;   // Acorns Trick: +0.05 Focus per scored card (per game); grants floor each hand
let handsPlayedGame     = 0;   // cumulative hands played this game (Plan Ahead average); reset on new game
let bonusMult_morebetter = 0;  // More Better Trick: +4 mult per reward grid where 3+ tiles were selected (per game)
let negativeTilesTakenRun = 0; // count of negative (debuff) reward tiles taken this run - Wild Side / Wait For Iiiit / Shady Stimulants
// New position-trick state
let bonusPips_fengshui  = 0;   // Feng Shui: permanent pips, grows when another position trick fires (per game)
let focusGenGame  = 0;   // total Focus generated this game (Wellspring); reset on new game
let focusGenRound = 0;   // total Focus generated this round (Feedback Loop); reset each round
let assemblyMarkCount   = 0;   // Assembly Line: cards scored from its marked line this round (replays count)
let _lastHandAssemblyEnd = 0;  // snapshot of assemblyMarkCount after the last scored hand
let studyHallCards      = 0;   // Study Hall: running count of cards scored this run; every 2nd one pays Focus
let markCount_groove    = 0;   // Groove: cards scored from its marked line this round
let markCount_overtime  = 0;   // Overtime: cards scored from its marked line this round
let _cleanSweepPrev     = [];  // Clean Sweep: cell keys scored in the previous hand (rolling 2-hand window)
let _lastHandPositionFired = false; // whether another position trick contributed pips/mult this hand (Feng Shui)
let _perMinuteFired = {};      // once-per-minute gate: trick id -> round-minute index it last fired (Study Hall, Ley Line)
// Position-trick ids (Feng Shui watches these; excludes itself). Focus/time-only ones
// (groove/overtime/clean_sweep) don't write pip/mult contributions, so they don't count.
const POSITION_TRICK_IDS = ['rowcol_triple_pips','rowcol_mult','rowcol_retrigger','perfect_timing','shape_line','corner_retrigger','two_corners','edge_pips','wide_span_mult','column_rush','row_power','assembly_line','huddle'];
let bonusMult_jackpot   = 0;   // Jackpot (big_win) Trick: +5 when score 10k+
let jackpotFired        = false; // big_win fires only once
let handsPlayedRound    = 0;   // count of hands played this round
// Per-round contribution tally for the Payout > Contributions tab.
// roundContributions[label|kind] = { label, kind, amount, count }
let roundContributions  = {};
let roundHandsScored    = 0;
let runsPlayedRound     = 0;   // count of Runs scored this round (Tide Table)
let setsPlayedRound     = 0;   // count of Set hands scored this round (Undue Influence / Shaky Foundation)
let runStreak           = 0;   // consecutive Run hands ending at the last-played hand (Wave Amplification)
let _ddPairTimes        = [];  // timestamps of recent pair-hands (Double Dutch)
let _rippleLastFire     = -100000; // last time Ripple's retrigger fired (30s cooldown)
let _primeTimesCursor   = 0;   // Prime Times: cycles tray positions 1st→2nd→3rd→5th→7th
let handTypesRound      = new Set(); // distinct hand types played this round
let safetyNetUsed       = false; // safety_net knack: once per game
let cardsDiscardedTotal = 0;
let cardsDiscardedRound = 0;
let swapsUsedRound      = 0; // swap actions this round (the No Takebacks challenge)
let cardsScoredTotal  = 0;
let nineSecondsCounter = 0;
let highestHandScore = 0;
let highestHandName  = null;
let gameStartTime    = 0;
let fullHouseThisRound = 0; // for House Rules

// ── Positional bonus state ──
// Each entry: { id, axis:'row'|'col', index:0-4, [intersectRow, intersectCol for ley line] }
let rowColBonuses = [];
let leyLinePos = null; // { r, c } - changes each round

// ══════════════════════════════════════════════
// DECK
// ══════════════════════════════════════════════
// ── Deck pools ──
// drawPile  = ordered draw stack; discards append to the back (so whole deck cycles before repeats)
// playedPile = scored cards held out, reshuffled into drawPile at round end
let drawPile   = [];
let playedPile = [];

// ── Deck audit (debug) ──
// Tracks the expected card count after intentional add/remove operations.
// HUD shows actual vs expected; mismatch = bug.
let expectedDeckTotal = 52;
function gridCardCount() {
  let n = 0;
  for (let r = 0; r < (gridData?.length || 0); r++)
    for (let c = 0; c < (gridData[r]?.length || 0); c++)
      if (gridData[r][c] && !gridData[r][c]._isTrick && gridData[r][c].rank) n++;
  return n;
}
function deckTotalActual() {
  return drawPile.length + playedPile.length + gridCardCount();
}
function updateDeckHud() {
  const hud = document.getElementById('deck-hud');
  if (!hud) return;
  const actual = deckTotalActual();
  document.getElementById('dh-draw').textContent   = drawPile.length;
  document.getElementById('dh-played').textContent = playedPile.length;
  document.getElementById('dh-grid').textContent   = gridCardCount();
  document.getElementById('dh-total').textContent  = actual;
  document.getElementById('dh-expected').textContent = '/' + expectedDeckTotal;
  hud.classList.toggle('mismatch', actual !== expectedDeckTotal);
  if (actual !== expectedDeckTotal) {
    console.warn(`[DECK AUDIT] mismatch: actual=${actual}, expected=${expectedDeckTotal}, draw=${drawPile.length}, played=${playedPile.length}, grid=${gridCardCount()}`);
  }
}
// Wrap so any call to updateDeckHud after layout settles
setTimeout(() => {
  const hud = document.getElementById('deck-hud');
  if (hud) hud.addEventListener('click', () => hud.classList.toggle('collapsed'));
}, 100);

let _enterFromGridTop = false; // when true, new cards enter from grid top, not screen top
let _cardIdCounter = 0;
function stampId(card) {
  if (card && !card._id) card._id = ++_cardIdCounter;
  return card;
}

// ── CARD IDENTITY (r192) ─────────────────────────────────────────────────────
// Every per-card thing - permanent pips/mult, the x-buffs, retriggers, curses,
// the play/swap/dealt counts - is keyed by cardId(card), which is that ONE card.
// It used to be keyed by cardKey(rank, suit), i.e. by card TYPE, which meant two
// cards sharing a rank and suit shared everything: the shop's Duplicate service
// hands you a second 7 of spades, and a buff on either landed on both.
//
// cardKey(rank, suit) still exists and still means the TYPE. Nothing per-card may
// use it; it is for enumerating the rank x suit grid (the RECORDS matrix) only.
function cardId(card) { return card ? String(stampId(card)._id) : ''; }

// What survives the discard -> reshuffle -> redraw cycle.
// A normal card is rebuilt from scratch every time it leaves the board, so
// ANYTHING not named here is destroyed on the way back into the deck. `_id` heads
// the list because without it a card has no identity to key anything by; the rest
// were already documented as living "on the card object so they track the
// individual card and survive deck cycling" and did not, because this rebuild
// dropped them.
const DURABLE_CARD_FIELDS = [
  '_id',
  // combined cards (the shop's Combine service)
  'combined', 'rank2', 'suit2',
  // exalt / corrupt state and its per-card trigger counters
  '_exalted', '_corrupted', '_heartSwapPending',
  '_clubPackPlays', '_clubSoloPlays', '_heartSoloPlays',
  '_spadeEarlyPlays', '_spadeDiscards', '_diaPoorPlays', '_diaRichPlays',
  // Whetstone's banked mult and the Vulture's clock buff
  '_whetMult', '_vulturePause',
];
// Every real, ordinary card in the run, wherever it is. This is the list to pick
// from whenever something targets "a card" - a curse, a blessing, a shop service.
// Picking a rank and a suit instead (the old way) could name a card that is not in
// the deck at all, and hit every copy of it if it was.
function everyDeckCard() {
  const out = [];
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const cd = gridData[r]?.[c];
      if (cd && !cd._isTrick && !cd._isSleight && !cd._isStone && cd.rank) out.push(cd);
    }
  drawPile.forEach(cd => { if (cd && !cd._isSleight && cd.rank) out.push(cd); });
  playedPile.forEach(cd => { if (cd && !cd._isSleight && cd.rank) out.push(cd); });
  return out;
}
// A reward tile picks its victim when the grid is BUILT and applies it when the
// tile is taken, and a card can leave the run in between (Monopoly eats one, the
// Spectrum tuner rebuilds the deck). Re-resolve at apply time: the same card if it
// is still here, else any card of the same face, else nothing.
function resolveDeckCard(card) {
  if (!card) return null;
  const all = everyDeckCard();
  return all.find(c => c === card)
      || all.find(c => c.rank === card.rank && c.suit === card.suit)
      || null;
}

// The persisted copy of a normal card. Board and animation state is shed.
function recycleCard(card) {
  const out = { rank: card.rank, suit: card.suit };
  for (const f of DURABLE_CARD_FIELDS) if (card[f] !== undefined) out[f] = card[f];
  return out;
}

function freshShuffledDeck() {
  const d = [];
  for (const s of ACTIVE_SUITS) for (const r of ACTIVE_RANKS) d.push(stampId({ rank:r, suit:s }));
  return deckShuffle([...d]);
}

function shuffle(arr) {
  for (let i = arr.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

// Deck order runs on its OWN seeded stream (js/seed.js). shuffle() itself stays
// generic - it is also used to pick Trick options, shop rows and challenge
// columns, and binding it to the deck would let those advance the deck order.
// Only the real deck operations are wrapped, which is what lets a seed promise
// the same cards: an unrelated roll landing between two shuffles can no longer
// change what you draw.
function deckShuffle(arr) { return withSeededRng(() => shuffle(arr), 'deck'); }

function drawCard() {
  if (drawPile.length === 0) return null; // exhausted
  let c = stampId(drawPile.shift());
  // Famine modifier: bias drawn rank toward low cards. On the deck's stream - it
  // substitutes a drawn card, so it is a deck operation.
  c = withSeededRng(() => maybeFamineDrawSwap(c), 'deck');
  // The Marker boss silently marks one card in every ten. drawCard is the single
  // point every card enters play through, so the count is exact and covers the
  // opening deal and every refill alike (js/boss-effects.js).
  if (typeof bossMarkerConsider === 'function') bossMarkerConsider(c);
  updateDeckHud();
  return c;
}

// Discard action - card goes to BACK of draw pile (re-enters only after every other card seen)
function discardToDrawPile(card) {
  if (!cardCan(card, 'discard')) return;
  // Sleights are consumed on discard (their on_discard effect is fired by the caller
  // with grid position); they are not returned to the draw pile.
  if (card._isSleight) { updateDeckHud(); return; }
  drawPile.push(recycleCard(card)); updateDeckHud();
}

// Scored card - held out until round ends
function discardToPlayed(card) {
  if (!cardCan(card, 'discard')) return;
  // Sleights cycle back into the deck preserving identity & remaining charges
  // (unless fully consumed, in which case they're dropped).
  if (card._isSleight) {
    if (card._usesLeft === 'infinite' || card._usesLeft > 0) {
      // _faceRank/_faceSuit ride along so a Sleight keeps the same printed card
      // face across a deck cycle (this rebuild is a fixed field list - anything
      // not named here is silently dropped).
      // _faceMark and _playable ride along so a Sleight keeps its printed face -
      // and a tinkered one keeps the identity it was PAID for - across a deck
      // cycle (this rebuild is a fixed field list; anything not named is lost).
      playedPile.push({ _isSleight: true, sleightId: card.sleightId, rank: card.rank, suit: card.suit, _id: card._id,
                        _usesLeft: card._usesLeft, _faceMark: card._faceMark, _playable: card._playable, _drawFired: false });
      updateDeckHud();
    }
    return;
  }
  playedPile.push(recycleCard(card)); updateDeckHud();
}

// At round end: reshuffle played cards back into the draw pile (fresh order)
function flushPlayedDeck() {
  // Reset sleight on_draw flags so they can re-fire when next dealt
  [...drawPile, ...playedPile].forEach(c => { if (c?._isSleight) c._drawFired = false; });
  drawPile = deckShuffle([...drawPile, ...playedPile]);
  playedPile = [];
  updateDeckHud();
}

// ══════════════════════════════════════════════
// GRID INIT
// ══════════════════════════════════════════════
function initGridData() {
  // Dominoes mode builds its own two-cell board.
  if (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE.id === 'dominoes') { dominoInitBoard(); return; }
  // Clear any domino tiles left over from a previous Dominoes run - the normal
  // renderer only reconciles [data-card-id] elements, so these would linger.
  document.getElementById('grid')?.querySelectorAll('[data-domino-id]').forEach(el => el.remove());
  const fullDeck = freshShuffledDeck();
  const cellCount = gridRows * gridCols;
  // First cellCount cards go on the grid, rest go to future deck
  gridData = [];
  for (let r = 0; r < gridRows; r++) {
    gridData[r] = [];
    for (let c = 0; c < gridCols; c++) {
      gridData[r][c] = fullDeck[r*gridCols+c];
    }
  }
  drawPile = fullDeck.slice(cellCount); // remaining cards become the round's draw stack
  playedPile = [];
  trickCardPos = null;
}

// Deal a fresh 5×5 grid mid-game, drawing from existing deck pools
function dealGrid() {
  selected = [];
  trickCardPos = null;
  // Clear existing card DOM elements so render starts fresh
  const gridEl = document.getElementById('grid');
  if (gridEl) gridEl.querySelectorAll('.card[data-card-id], .trick-card').forEach(el => el.remove());
  gridData = [];
  for (let r = 0; r < gridRows; r++) {
    gridData[r] = [];
    for (let c = 0; c < gridCols; c++) {
      gridData[r][c] = drawCard() || null;
    }
  }
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function cardPips(rank) {
  // NB: the old `parseInt(rank) || 10` turned Spectrum's 0 card into a 10 -
  // 0 is falsy. Check for a real number instead; classic ranks are unchanged.
  if (RANK_PIPS[rank] != null) return RANK_PIPS[rank];
  const n = parseInt(rank);
  return Number.isFinite(n) ? n : 10;
}

function cardKey(rank, suit) { return `${rank}-${suit}`; }

