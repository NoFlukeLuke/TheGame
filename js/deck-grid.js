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
// Credits this card pays when it scores (the Card Market's payday card, r278).
// Replay-weighted: a card that scores three times pays three times.
let permCoins  = {}; // { "<card id>": 2, ... } credits paid per score
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

// ── HOW A CARD BUFF IS WORDED (r294) ─────────────────────────────────────────
//
// ONE vocabulary, for the buff you HOLD (cardBuffLines) and for the buff you are
// being OFFERED (buffOfferLine). Five sites offered card buffs in five phrasings
// for two ideas, and two of the five differed by a single verb. The Forge put
//
//     A\u2665 gains another +4 pips each time it is played
//     7\u2660 scores +30 pips every time it is played
//
// side by side and asked the player to choose between them: same length, same
// shape, same closing clause, and the only thing saying one number GROWS and the
// other does not is gains/scores. Owner: "it's kind of confusing that the only
// differentiation is gains +5 mult each time it's scored vs scores."
//
// So the two ideas are told apart by the WORD, never by the verb:
//
//   FLAT     the word BUFF, and NO "each time it is played" at all. Every buff
//            in the game pays when the card is played - saying so on the flat
//            one is exactly what made the two read alike, and it is the clause
//            that has to mean something on the scaling one.
//   SCALING  the word SCALES, and it KEEPS "each time it's played", because that
//            clause IS the difference: the number itself climbs.
//
// A held buff drops the clause from the flat side entirely and is just the
// number, which is what a stat line wants: "+30 pips" reads as a fact about the
// card, and "Scales +4 pips each time it's played" beside it cannot be mistaken
// for one.
function cardBuffLines(k) {
  const lines = [];
  const pp = permPips[k] || 0, pm = permMult[k] || 0;
  const gp = permPipsGrow[k] || 0, gm = permMultGrow[k] || 0;
  const xp = permXPips[k] || 1, xm = permXMult[k] || 1, re = permRetrig[k] || 0;
  if (gp) lines.push(`Scales +${gp} pips each time it's played`);
  if (gm) lines.push(`Scales +${gm} mult each time it's played`);
  if (pp) lines.push(`+${pp} pips`);
  if (pm) lines.push(`+${pm} mult`);
  if (xp > 1) lines.push(`\u00d7${xp} pips`);
  if (xm > 1) lines.push(`\u00d7${xm} mult`);
  if (re) lines.push(`+${re} replay`);
  // These go straight into a tooltip's innerHTML and into the shop's card list,
  // neither of which runs the prose lexicon - so a card's grid tooltip said
  // "pips" while the tile that granted the buff said "work" (r198's rule, r294's
  // pass). lexProse is idempotent (no corporate word is a gamer key), so a
  // caller that highlights afterwards is unaffected.
  return (typeof lexProse === 'function') ? lines.map(lexProse) : lines;
}

// ── A card's buffs are CORNER BANDS (r299) ───────────────────────────────────
// Owner: "Can we implement the same corner marking system the tricks have ...
// Like a diagonal line for every 5 pips or 5 mult, or 5 seconds if pause or
// rewind or for each 1 focus or 1 replay."
//
// The mark is r274's: diagonal bands across a corner, one per unit, each a
// coloured band with a bright centre line, drawn as background gradient stops
// whose every length is a PERCENTAGE of the gradient's own axis - so it is the
// same picture on a 40px card and a 119px one with no JS measurement, exactly as
// the Trick disc's tier bands are. Rendered by `.card-bands` (css/style.css).
//
// IT LIVES HERE, BESIDE cardBuffLines, because that is the documented one place
// a card's buffs are put into words (r209/r294) and this is the same question
// asked in pictures. A second table of "what can a card carry" is how the two
// would drift, which is what happened to the thing this replaces: the old
// `buffBandHTML` tally covered pips, mult and The Vulture's pause and nothing
// else, so a card carrying +4s of rewind or +1 replay looked unbuffed.
//
// THE TWO 8px `+Np` / `+Nm` TEXT LABELS ARE GONE WITH IT. A 57px card cannot
// carry four numbers, the disc carries bands and no number for the same reason,
// and the exact figures are one long-press away in cardBuffLines - which the
// grid tooltip, the RECORDS deck matrix and the reward tiles all already read.
//
// ONE ELEMENT PER CORNER, AND THE CORNER IS THE GRADIENT'S ANGLE. A 45deg
// gradient puts stop 0% at the bottom-left corner, 135deg at the top-left,
// 225deg at the top-right, 315deg at the bottom-right; the stop list is
// identical for all four, which is what keeps the four corners one object rather
// than four hand-placed decorations. An explicit angle rather than `to top
// right` because a card is 0.76 aspect, and a corner-to-corner gradient on a
// tall box runs at 37 degrees - the bands have to be at 45 to read as the folded
// corner the Trick disc's do.
//
// A corner is a FAMILY OF RESOURCES and the band colour says which member, so
// two families can share one corner and be told apart. Nothing shares one today;
// it is what a fifth family would do, because there are four corners.
//
// THERE IS NO PER-CARD FOCUS STORE, so the fifth family the owner named has
// nothing to read - a card cannot grant Focus when it scores today. Adding one is
// a row in this table plus the store and the site that pays it.
const CARD_BAND_FAMILIES = [
  { id: 'pips',   corner: 'tl', per: 5, color: '#3a6fca', lite: '#a9c8f7', of: (k, card) => permPips[k]   || 0 },
  { id: 'mult',   corner: 'tr', per: 5, color: '#c0392b', lite: '#f2ada4', of: (k, card) => permMult[k]   || 0 },
  // Seconds: the Card Market's rewind card AND The Vulture / Wait Four It /
  // Temporal Rift's pause, summed, because the owner named them as one family
  // ("5 seconds if pause or rewind"). The payout vocabulary makes time WHITE
  // (PARTICLE_CFG.colors.time) and r296 proved near-white cannot mark a cream
  // card, so the band inverts it the way r233 inverted the clock plate: a black
  // band with a white centre line.
  { id: 'time',   corner: 'bl', per: 5, color: '#141210', lite: '#ffffff', of: (k, card) => (permTime[k] || 0) + (card._vulturePause || 0) },
  // Replays have no colour in the payout vocabulary and Echo Location's #e0ddd0
  // is near-white, so green: the only high-contrast hue no other payout family
  // has taken, and the same one the scaling arrow uses for the neighbouring idea.
  { id: 'replay', corner: 'br', per: 1, color: '#2e9c68', lite: '#b6ecd1', of: (k, card) => permRetrig[k] || 0 },
];
const CARD_BAND_ANGLE = { tl: 135, tr: 225, br: 315, bl: 45 };
// The disc's own numbers are start 13 / pitch 5 / thick 3 and it stops at five
// bands. A CARD IS NOT THE DISC and they do not transfer: the disc's bands sit
// under a foil label that ghosts them, while a card's face is bare cream with a
// big centred rank on it, and a card has FOUR corners doing this at once where
// the disc has one. Measured on a 119x158 card, six bands fill a wedge of
// 113x113 at the disc's numbers - most of the face, four times over - 77x77 at
// start 9, and 66x66 here. START IS THE ONLY ONE OF THE FOUR THAT MOVES THE
// WHOLE MARK; pitch and thickness only change how the bands sit within it.
// The card's corner is rounded (5 design px), which eats the first r(sqrt2-1) =
// 2.1 design px along the diagonal, so 5% (4.7 design px) is about as close in
// as the first band can go and still be drawn whole.
const CARD_BAND_START = 5;    // % of the axis to the first band's near edge
const CARD_BAND_PITCH = 3.4;  // % from one band's near edge to the next
const CARD_BAND_FULL  = 2;    // % a band is thick
const CARD_BAND_OVER  = 4;    // % the outermost band is thick when the count runs past the cap
const CARD_BAND_MAX   = 6;    // bands per corner: a 7th starts reaching the card's middle

// A COUNT IS ROUNDED TO NEAREST AND FLOORED AT ONE, never truncated. The rate is
// what the owner asked for - one band per 5 pips - but a floor would draw NOTHING
// for the +4 pips The Bench hands out, which reads as the buff not having landed,
// and a part-band drawn thin enough to mean "and a bit" comes out sub-pixel at
// the sizes this is drawn at. So any buff at all is at least one band.
function cardBandCount(v, per) {
  return v > 0 ? Math.max(1, Math.round(v / per)) : 0;
}

function cardBandPaint(bands, angle) {
  if (!bands.length) return '';
  const stops = [];
  bands.forEach((b, i) => {
    const th = b.over ? CARD_BAND_OVER : CARD_BAND_FULL;
    const s = CARD_BAND_START + i * CARD_BAND_PITCH, e = s + th, m = s + th / 2;
    stops.push(`transparent ${s}%`, `${b.color} ${s}%`, `${b.lite} ${m}%`, `${b.color} ${e}%`, `transparent ${e}%`);
  });
  return `linear-gradient(${angle}deg, ${stops.join(',')})`;
}

function cardBandsHTML(card) {
  if (!card || !card.rank) return '';
  const k = cardId(card), byCorner = {};
  CARD_BAND_FAMILIES.forEach(f => {
    const n = cardBandCount(f.of(k, card) || 0, f.per);
    if (!n) return;
    const list = byCorner[f.corner] || (byCorner[f.corner] = []);
    for (let i = 0; i < n; i++) list.push({ color: f.color, lite: f.lite });
  });
  return Object.keys(byCorner).map(corner => {
    let list = byCorner[corner];
    // Past the cap the OUTERMOST band is drawn double thick, which is the shape
    // the tier ladder's own top rung has (r274: tier 5 and up is iridescent) -
    // "this many and beyond". Clamping silently would make the mark a lie, and
    // the exact figure is in the tooltip either way.
    if (list.length > CARD_BAND_MAX) {
      list = list.slice(0, CARD_BAND_MAX);
      list[CARD_BAND_MAX - 1] = Object.assign({}, list[CARD_BAND_MAX - 1], { over: true });
    }
    return `<div class="card-bands" style="--cb:${cardBandPaint(list, CARD_BAND_ANGLE[corner])}"></div>`;
  }).join('');
}

// The same vocabulary for an enhancement being OFFERED, from the `e` object
// enhanceCardKey takes - so an offer site states exactly what it is about to
// apply and the two cannot drift.
//
// FLAT and SCALING are kept in separate lists because they are two different
// sentences, not two items in one: an offer carrying both says both.
function buffBits(e) {
  e = e || {};
  const flat = [], scale = [];
  if (e.pips)     flat.push(`+${e.pips} pips`);
  if (e.mult)     flat.push(`+${e.mult} mult`);
  if (e.xpips)    flat.push(`\u00d7${e.xpips} pips`);
  if (e.xmult)    flat.push(`\u00d7${e.xmult} mult`);
  if (e.retrig)   flat.push(`+${e.retrig} replay`);
  if (e.time)     flat.push(`+${e.time}s`);
  if (e.coin)     flat.push(`+${e.coin} credits`);
  if (e.growPips) scale.push(`+${e.growPips} pips`);
  if (e.growMult) scale.push(`+${e.growMult} mult`);
  return { flat, scale };
}
function buffIsScaling(e) { return buffBits(e).scale.length > 0; }
// The short title an offer tile wears: the effect and nothing else, because the
// tile shows WHICH cards separately. "SCALES" carries the distinction here too.
//
// IT GOES THROUGH lexProse ITSELF. A description is translated on its way to the
// screen by colorizeKeywords / highlightKeywords (r198), and a NAME is not - so
// the Forge printed "+5 mult" as its title with "buff these three cards with +5
// skill" directly under it, the same figure in two vocabularies an inch apart.
// Doing it here rather than in makeChoiceEl keeps every other offer's name
// untouched, which matters: an entity name is content, not vocabulary.
function buffOfferName(e) {
  const b = buffBits(e);
  const parts = [];
  if (b.scale.length) parts.push('Scales ' + buffJoin(b.scale));
  if (b.flat.length)  parts.push(buffJoin(b.flat));
  const out = parts.join(' \u00b7 ');
  return (typeof lexProse === 'function') ? lexProse(out) : out;
}
// `subject` is the noun phrase the sentence is about - a card face ("7\u2660"),
// a list of them, or "these three cards" when the faces are drawn beside it.
// `plural` decides the agreement, because "7\u2660 scales" and "these cards
// scale" are the same sentence with two different verbs.
function buffOfferLine(e, subject, plural) {
  const b = buffBits(e);
  const out = [];
  if (b.flat.length)  out.push(`Buff ${subject} with ${buffJoin(b.flat)}.`);
  if (b.scale.length) out.push(`${buffCapFirst(subject)} ${plural ? 'scale' : 'scales'} `
    + `${buffJoin(b.scale)} each time ${plural ? "they're" : "it's"} played.`);
  const line = out.join(' ');
  return (typeof lexProse === 'function') ? lexProse(line) : line;
}
// "7\u2660" / "7\u2660 and 3\u2666" / "7\u2660, 3\u2666 and 9\u2663"
function buffJoin(list) {
  const a = (list || []).filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}
const _BUFF_COUNT_WORDS = ['no', 'this', 'these two', 'these three', 'these four', 'these five'];
function cardCountPhrase(n) {
  return n === 1 ? 'this card' : `${_BUFF_COUNT_WORDS[n] || 'these ' + n} cards`;
}
function buffCapFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

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
// The deck audit is about the PERMANENT deck, so a temp card is not one of its
// cards - it was never drawn from a pile and will never return to one. Counting
// it would report a mismatch for as long as it sat on the board.
function gridCardCount() {
  let n = 0;
  for (let r = 0; r < (gridData?.length || 0); r++)
    for (let c = 0; c < (gridData[r]?.length || 0); c++) {
      const cd = gridData[r][c];
      if (cd && !cd._isTrick && !cd._temp && cd.rank) n++;
    }
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
  // A TEMP card (r278, js/card-states.js) exists for this level only. It is
  // named here so the flag survives this rebuild, which is what lets the two
  // pile functions below REFUSE it: a temp card that lost its flag on the way
  // into the draw pile would become a permanent member of the deck.
  '_temp',
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
  // The six-suit mode builds a DESIGNED deck instead of the plain cross product:
  // six suits but only four of each rank, so the deck is ranks x copies and the
  // suit count no longer decides its size. See js/deck-design.js.
  if (typeof deckWeightedActive === 'function' && deckWeightedActive()) return deckShuffle(buildWeightedDeck());
  if (typeof deckDesignActive === 'function' && deckDesignActive()) return deckShuffle(buildDesignedDeck());
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
  // A temp card evaporates rather than joining the deck (r278). This and
  // discardToPlayed below are the ONLY two ways a card enters a pile, so
  // refusing it in both is the whole of "it exists for this level only" - the
  // level-clear sweep runs discardToPlayed on every cell, which is what makes a
  // temp card disappear when the level ends without anything else sweeping.
  if (card._temp) { updateDeckHud(); return; }
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
      // _adjPlays rides along too (r280): it is an 'adjacent' fixture's progress
      // toward its payout, and the board is discarded through here at the end of
      // EVERY round - so leaving it out silently reset a 1/2 fixture to 0/2 at
      // every round boundary, which is what made the Spectrum fixtures read as
      // firing at random. Measured before the fix: 1 in, undefined out.
      playedPile.push({ _isSleight: true, sleightId: card.sleightId, rank: card.rank, suit: card.suit, _id: card._id,
                        _usesLeft: card._usesLeft, _faceMark: card._faceMark, _playable: card._playable,
                        _adjPlays: card._adjPlays || 0, _drawFired: false });
      updateDeckHud();
    }
    return;
  }
  if (card._temp) { updateDeckHud(); return; }   // see discardToDrawPile (r278)
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

