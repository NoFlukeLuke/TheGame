// `reps` (optional) is an array aligned to `cards` giving each card's replay count
// (1 = scored once). Exalt/corrupt is a per-card suit buff, so a replayed card fires
// it once per (re)play - omit `reps` (or pass all-1s) for the pristine single-score total.
function exaltCorruptTotals(cards, reps) {
  let pips = 0, mult = 0, coins = 0, time = 0;
  if (!exaltCorruptEnabled) return { pips, mult, coins, time }; // mechanic paused → no suit buffs
  cards.forEach((c, i) => {
    if (!c) return;
    const n = reps ? (reps[i] || 1) : 1;
    if (c._exalted) {
      if      (c.suit === '♣') pips  += BAL._exalt.club_pips * n;          // exalted club:    +10 pips
      else if (c.suit === '♦') coins += BAL._exalt.diamond_coins * n;           // exalted diamond: +3 coins
      else if (c.suit === '♥') mult  += BAL._exalt.heart_mult * n;           // exalted heart:   +2 mult
      else if (c.suit === '♠') time  += BAL._exalt.spade_time * n;           // exalted spade:   +4 time
    }
    if (c._corrupted) {
      if      (c.suit === '♣') { pips  += BAL._corrupt.club_pips * n; mult  += BAL._corrupt.club_mult * n;  }  // corrupted club:    +25 pips  -3 mult
      else if (c.suit === '♦') { coins += BAL._corrupt.diamond_coins * n;  pips  += BAL._corrupt.diamond_pips * n; }  // corrupted diamond: +5 coins  -20 pips
      else if (c.suit === '♥') { mult  += BAL._corrupt.heart_mult * n;  time  += BAL._corrupt.heart_time * n;  }  // corrupted heart:   +5 mult   -5 time
      else if (c.suit === '♠') { time  += BAL._corrupt.spade_time * n;  coins += BAL._corrupt.spade_coins * n;  }  // corrupted spade:   +7 time   -8 coins
    }
  });
  return { pips, mult, coins, time };
}

// `ledger` (optional out-param) collects per-card animation data for the score dance:
//   ledger.cards = [{ r, c, card, rank, suit, rawPip, reps, ids:[trickId…] }]  in scoring order,
// where `ids` are the entities that fired on THAT card (so the dance can release each trick's
// particle as its trigger card animates, and replay the beat `reps` times). Hand-level tricks
// are whatever's in `contrib` but not tied to any card. Populating it never changes the score.
// A hand counts as a "3-card hand" for the 3-card tricks (3rd Down, Ready Set Go) if it has
// 3 cards - or is a Pair while Three's a Crowd is owned.
// Even / odd rank, hoisted to the file so the per-card payer table (which runs
// BEFORE the card loop) and the post-loop sites can share one definition.
function _rankIsEvenRank(r) { return ['2','4','6','8','10'].includes(r); }
function _rankIsOddRank(r)  { return ['A','3','5','7','9'].includes(r); }

function counts3CardHand(handName, cells) {
  return cells.length === 3 || (hasTrick('threes_crowd') && handName === 'Pair');
}

// A "Set" hand for the Set add-on tricks (Undue Influence / Encore / Shaky Foundation):
// any rank-matching hand - Pair, Two Pair, Three/Four of a Kind, Full House.
function isSetHand(handName) {
  return ['Pair','Two Pair','Three of a Kind','Four of a Kind','Full House'].includes(handName);
}

// Deterministic [0,1) hash for chance-based replays (Wait For Iiiit). Keyed on card id + a salt
// (the round-hand index) so a card's roll is STABLE across the preview/score recomputes of the same
// hand - never a live Math.random(), which would desync the dance ledger - yet independent per card
// and re-rolled the next hand. Same philosophy as Echo Location's deterministic 50%.
function _detReplayRand(id, salt) {
  let h = (((id | 0) * 2654435761) + ((salt | 0) * 40503) + 0x9e3779b9) >>> 0;
  h ^= h >>> 15; h = (h * 2246822519) >>> 0; h ^= h >>> 13; h = (h * 3266489917) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Four Horse-man's random bonus: deterministic per hand (keyed on handsPlayedRound + first cell)
// so the preview and the scored result always agree. 0=pips, 1=mult, 2=Focus, 3=pause.
function fourHorsemanRoll(cells) {
  const c0 = cells[0] || [0, 0];
  return (((handsPlayedRound + c0[0] * 3 + c0[1] * 5) % 4) + 4) % 4;
}

function calcScore(handName, cells, contrib = null, ledger = null) {
  const base = HAND_BASE[handName];
  if (!base) return 0;
  const _scoreCells = scoringOrderCells(cells);
  const cards = _scoreCells.map(([r,c]) => gridData[r][c]);
  const hasTrickCard = trickCardPos && cells.some(([r,c]) => r===trickCardPos[0] && c===trickCardPos[1]);
  // Predicted post-update streak count for THIS hand (playHand updates streakCount/lastHandType
  // only after calcScore runs, so reading streakCount directly here is one hand stale).
  const _effStreak = (lastHandType !== null && handName === lastHandType) ? streakCount + 1 : 1;

  // 1. Base pips (scaled by level) + card pips.
  // handBasePips is 0 in the no-pips scoring models, so all pips then come from
  // the cards themselves (see SCORING_MODELS in js/focus-config.js).
  const levelScale = Math.pow(1.1, level - 1);
  // ── Layered hands (r198) ──
  // One shape can be several hands at once: a same-suit run is a Run AND a Flush.
  // handLayersFor returns every hand this play pays for, one per family, primary
  // first. Each extra layer adds its printed base pips and base mult, and every
  // card scores one more time (the retrigger below) - "you played two hands".
  // It is computed HERE, from the cells, rather than passed in by the six callers
  // of calcScore, so the live PIPS/MULT chips, the scoring dance, findBestHand's
  // comparison and the committed score can never disagree about what was played.
  const _comp = (typeof handComponentsFor === 'function') ? handComponentsFor(cells) : null;
  // Every component past the one that named the hand. `handName` is passed in by
  // the caller and is normally _comp.primary, but match-3 names its own hands, so
  // one is dropped by NAME rather than assumed to be the first entry.
  // Exactly ONE entry is dropped by name, not every entry matching it, so a hand
  // holding two Sets of 3 is still paid twice.
  const _extraLayers = [];
  if (_comp) {
    let seen = false;
    _comp.components.forEach(c => { if (!seen && c.name === handName) { seen = true; return; } if (HAND_BASE[c.name]) _extraLayers.push(c.name); });
    // If the caller named a hand that is not one of the components at all, the
    // components are describing something else and adding them would pay for the
    // same cards twice. Match-3 names its own hands, so this is reachable.
    if (!seen) _extraLayers.length = 0;
  }
  // Extra scoring passes per cell: one per component past the first that holds
  // it. This is what makes "the five suited cards of a Fullest House replay"
  // land on those five cards and not on the whole hand.
  const _compReps = (_extraLayers.length && typeof handReplayMap === 'function') ? handReplayMap(cells) : null;
  // handBasePips folds in Natural Scaling's earned bonus for that hand type, so
  // the bonus rides the 1.1^(level-1) scale exactly as the printed base does.
  let totalPips = Math.round(handBasePips(handName) * levelScale);
  _extraLayers.forEach(h => { totalPips += Math.round(handBasePips(h) * levelScale); });

  // Rising Tide: +1 base mult per level
  const risingTideBonus = hasTrick('rising_tide') ? (level - 1) : 0;

  // ── contrib tracking: accumulate per-Trick pip/mult deltas ──
  const _cp = {}, _cm = {};  // per-Trick pip/mult deltas (always tracked so Mirror can duplicate them)

  // _procs counts how many times each id FIRED, which is a different question
  // from how much it was worth (_cp / _cm) and the one the Rider penalty bills
  // against. Counted here because bPip/bMult are called once per proc already -
  // per card, per trigger - so there is nothing to instrument at the call sites.
  const _procs = {};
  const _proc = (id, n) => { _procs[id] = (_procs[id]||0) + (n === undefined ? 1 : n); };

  // ── The animation TIMELINE (r220) ────────────────────────────────────────
  // `_cp`/`_cm` are a SET OF TOTALS: what each Trick was worth by the end. That is
  // the right shape for the contributions tab and the wrong one for an animation,
  // which needs to know WHEN each thing happened and WHAT KIND of thing it was.
  // So every emit also pushes an ordered event:
  //
  //   { id, source, op:'pip+'|'mult+'|'pip*'|'mult*', value, card, from, scope, rnd }
  //
  //   op '…+'  → value is the ADDEND (what the old delta always was)
  //   op '…*'  → value is the FACTOR, so the dance can show "x2" and multiply its
  //              running chip instead of showing a meaningless "+35".
  //   card     → index into _scoreCells, or -1 for a hand-level event
  //   from     → which card the particle FLIES FROM, which is not the same
  //              question: a card enhancement's x mult multiplies the whole
  //              running mult, so it cannot fire inside that card's beat, but its
  //              particle should still leave that card.
  //   scope    → 'card' multiplies that ONE card's running subtotal (permXPips,
  //              a curse, the Blight); 'hand' multiplies the hand total. Getting
  //              this wrong is the difference between doubling one card and
  //              doubling everything scored so far.
  //   rnd      → the site's rounding, because the sites do not agree: a x pips
  //              rounds to a whole number, a x mult to one decimal, and the
  //              card-scoped ones do not round at all. Without it the dance's
  //              running chip drifts a few hundredths and snaps at the end.
  //
  // `_cp`/`_cm` are still written exactly as before, so the contributions tab,
  // Mirror, priming and Move as One are all untouched - they keep reading deltas.
  const _tl = ledger ? [] : null;
  let _tlCard = -1;
  const _ev = (id, op, value, source, from, rnd, once) => {
    if (!_tl) return;
    if ((op === 'pip*' || op === 'mult*') ? value === 1 : !value) return;
    const scope = _tlCard >= 0 && (op === 'pip*' || op === 'mult*') ? 'card' : 'hand';
    const e = { id, source: source || 'trick', op, value, card: _tlCard,
               from: _tlCard >= 0 ? _tlCard : (from === undefined ? -1 : from),
               scope,
               rnd: rnd || (scope === 'card' ? 'none' : op === 'pip*' ? 'int' : op === 'mult*' ? 'dp1' : 'none') };
    // `once`: pays per CARD, not per scoring iteration, so a replayed card must
    // not pay it again. The dance applies these on a card's first beat only.
    if (once) e.once = true;
    _tl.push(e);
  };
  const bPip  = (id, d) => { if (d) { _cp[id] = (_cp[id]||0)+d; _proc(id); _ev(id, 'pip+',  d); } };
  const bMult = (id, d) => { if (d) { _cm[id] = (_cm[id]||0)+d; _proc(id); _ev(id, 'mult+', d); } };
  // Quiet: writes the ledger (and bills the procs the caller says it fired) but
  // emits NO event, for totals the timeline already carries - the per-card mult
  // accumulators, and the retrigger bookkeeping, which the dance shows by
  // repeating the card's whole beat rather than as a particle of its own.
  const bPipQ  = (id, d, procs) => { if (d) { _cp[id] = (_cp[id]||0)+d; _proc(id, procs === undefined ? 0 : procs); } };
  const bMultQ = (id, d, procs) => { if (d) { _cm[id] = (_cm[id]||0)+d; _proc(id, procs === undefined ? 0 : procs); } };
  // Multiplicative: the ledger records the DELTA (so contributions read "+240
  // pips", which is what the player actually gained) while the timeline records
  // the FACTOR (so the dance reads "x1.5"). Same call, two audiences.
  const bPipX  = (id, factor, delta) => { if (delta) { _cp[id] = (_cp[id]||0)+delta; _proc(id); } _ev(id, 'pip*',  factor); };
  const bMultX = (id, factor, delta) => { if (delta) { _cm[id] = (_cm[id]||0)+delta; _proc(id); } _ev(id, 'mult*', factor); };

  // Process cards sequentially so Knave Power can multiply running total
  const _handMinRankVal = hasTrick('summit')
    ? Math.min(...cells.map(([_r,_c]) => RANK_ORDER[gridData[_r][_c]?.rank] || 99)) : -1;
  // Eye of the Storm: in the round's middle third, the highest-ranked card(s) retrigger
  const _eyeFrac = roundFractionRemaining();
  const _eyeStorm = hasTrick('eye_of_storm') && _eyeFrac > 1/3 && _eyeFrac <= 2/3;
  const _rankHigh = rk => rk === 'A' ? 14 : (RANK_ORDER[rk] || 0);
  const _eyeMax = _eyeStorm ? Math.max(...cards.map(c => _rankHigh(c.rank))) : -1;
  // High and Mighty (knack): the hand's highest-ranked card(s) all replay once
  const _hnmOn  = hasKnack('high_and_mighty');
  const _hnmMax = _hnmOn ? Math.max(...cards.map(c => _rankHigh(c.rank))) : -1;
  // Ripple: once per 30s, cards within one rank of another card in the hand retrigger
  const _rippleReady = hasTrick('ripple') && (Date.now() - _rippleLastFire >= BAL.ripple.cooldown_ms);
  const _rippleSet = new Set();
  if (_rippleReady) {
    _scoreCells.forEach(([_rr,_cc]) => {
      const _c0 = gridData[_rr][_cc]; if (!_c0) return;
      if (_scoreCells.some(([_r2,_c2]) => (_r2!==_rr||_c2!==_cc) && gridData[_r2][_c2] && _withinOneRank(_c0.rank, gridData[_r2][_c2].rank))) _rippleSet.add(`${_rr}-${_cc}`);
    });
  }
  // Per-card MULT, accumulated in the loop (r197). These used to be post-loop
  // `_wc(pred) x rate` sweeps, which is the SAME SUM - but a sweep cannot tell the
  // dance which card earned it, so every one of them animated in the end lump.
  // Emitting per card here is what lets "+1 mult for a heart" fire on the heart.
  let _hdMult = 0, _jmMult = 0, _kgMult = 0, _pmMult = 0, _ogMult = 0, _ecMultAcc = 0, _ecPipAcc = 0;
  // Per-card MULT, in scoring order: what each card adds every time it scores,
  // what it adds on its first scoring only, its own x mult, and how many times
  // it scores. Replayed against `mult` below (see _cardMultSeq's use).
  const _cardMultSeq = [];

  // ── PER-CARD PAYERS (r226) ───────────────────────────────────────────────
  // Seventeen Tricks pay "a rate x a number of CARDS" - Get Even is +2 mult per
  // even card - and every one of them was still a single hand-level lump at the
  // end of the tally. Owner's report on Get Even: "it gave +6 mult at the end,
  // that's incorrect, it should have given the mult as the cards animated."
  //
  // The rows below are that whole class, so a new one is a row rather than a
  // fix. Each is `{ id, cond, pays }`:
  //   cond(x)        - does it fire for this hand at all, evaluated ONCE up front
  //   pays(card, x)   - { pip, mult } for THIS card, or nothing
  //
  // TWO RULES KEEP THE SCORE BYTE-IDENTICAL:
  //   1. NOT replay-weighted. These read `cells.length`, not a replay-weighted
  //      count, so a card that scores three times still pays them once. The
  //      events carry `once`, and the dance applies those on a card's FIRST beat
  //      only - otherwise a replayed card would pay them again and the running
  //      chip would drift off the real total.
  //   2. Emitted at the END of the card's block, after `totalPips += cp`, so a
  //      pip lands outside that card's own subtotal and is never multiplied by a
  //      card-scoped x pips (Humble Roots, a card enhancement, the Blight). That
  //      is where they sit in the real arithmetic, so that is where they emit.
  // The accumulators are still ADDED at each Trick's original site further down,
  // so nothing moves in the order of operations either.
  const PER_CARD_PAYERS = [
    { id:'early_bird',    cond:x => x.earlyThird,                     pays:()  => ({ pip:  BAL.early_bird.pips_per_card }) },
    { id:'night_owl',     cond:x => x.lateThird,                      pays:()  => ({ mult: BAL.night_owl.mult_per_card }) },
    { id:'overgrowth',    cond:x => x.isRun,                          pays:()  => ({ pip:  BAL.overgrowth.pips_per_card }) },
    { id:'long_road',     cond:x => x.isRun,                          pays:()  => ({ mult: BAL.long_road.mult_per_card }) },
    { id:'correct_run',   cond:x => x.orderedRun,                     pays:()  => ({ pip:  BAL.correct_run.pips_per_card, mult: BAL.correct_run.mult_per_card }) },
    { id:'edge_pips',     cond:x => x.onEdge,                         pays:()  => ({ pip:  BAL.edge_pips.pips_per_card }) },
    { id:'full_color',    cond:x => x.suitCount === 4,                pays:()  => ({ pip:  BAL.full_color.pips_per_card, mult: BAL.full_color.mult_per_card }) },
    { id:'balanced_diet', cond:x => x.suitCount === 2,                pays:()  => ({ mult: BAL.balanced_diet.mult_per_card }) },
    { id:'column_rush',   cond:x => x.allSameCol,                     pays:()  => ({ mult: BAL.column_rush.mult_per_card }) },
    { id:'row_power',     cond:x => x.allSameRow,                     pays:()  => ({ mult: BAL.row_power.mult_per_card }) },
    { id:'heavy_hand',    cond:x => x.cardCount === 5,                pays:()  => ({ pip:  BAL.heavy_hand.pips_per_card }) },
    { id:'prime_time',    cond:x => x.primeCount >= 3,                pays:()  => ({ pip:  BAL.prime_time.pips_per_card }) },
    // These two count only the cards that qualify, not the whole hand, and they
    // have NO minimum (r226, owner's call). The old "3+ even cards" gate meant a
    // hand with one or two even cards paid nothing at all, which reads as the
    // Trick being broken rather than as a condition being unmet - and it is the
    // one gate in this table that the player cannot see coming while choosing.
    { id:'even_score',    cond:() => true,                            pays:c => _rankIsEvenRank(c.rank) ? ({ mult: BAL.even_score.mult_per_card }) : null },
    { id:'odd_squad',     cond:() => true,                            pays:c => _rankIsOddRank(c.rank)  ? ({ mult: BAL.odd_squad.mult_per_card })  : null },
    // Quake / Shock pay per card in the LARGEST matching rank group.
    { id:'kindred',       cond:x => x.maxCount >= 2,                  pays:(c,x) => x.topRanks.has(c.rank) ? ({ mult: BAL.kindred.mult_per_card }) : null },
    { id:'trinity',       cond:x => x.maxCount >= 2,                  pays:(c,x) => x.topRanks.has(c.rank) ? ({ pip:  BAL.trinity.pips_per_card })  : null },
  ];
  // Hand-level facts every row above is allowed to ask about. Computed ONCE,
  // before the loop, from things already known at this point.
  const _pcRankCounts = {};
  cards.forEach(c => { _pcRankCounts[c.rank] = (_pcRankCounts[c.rank]||0) + 1; });
  const _pcMax = cards.length ? Math.max(...Object.values(_pcRankCounts)) : 0;
  const _pcFrac = roundFractionRemaining();
  const _pcIsRun = ['Run of 3','Run of 4','Straight','Straight Flush'].includes(handName);
  const _pcCtx = {
    cardCount:  cells.length,
    isRun:      _pcIsRun,
    orderedRun: _pcIsRun && canBeOrderedRun(cells),
    earlyThird: _pcFrac > 2/3,
    lateThird:  _pcFrac <= 1/3,
    onEdge:     isOnEdge(cells),
    suitCount:  new Set(cards.map(c => cardColorSuit(c))).size,
    allSameCol: cells.every(([, cc]) => cc === cells[0][1]),
    allSameRow: cells.every(([rr]) => rr === cells[0][0]),
    primeCount: cards.filter(c => ['A','2','3','5','7'].includes(c.rank)).length,
    focusMult:  focusMultiplier(),
    evenCount:  cards.filter(c => _rankIsEvenRank(c.rank)).length,
    oddCount:   cards.filter(c => _rankIsOddRank(c.rank)).length,
    maxCount:   _pcMax,
    topRanks:   new Set(Object.keys(_pcRankCounts).filter(r => _pcRankCounts[r] === _pcMax)),
  };
  // Which rows are live this hand, resolved once.
  const _pcLive = PER_CARD_PAYERS.filter(row => hasTrick(row.id) && row.cond(_pcCtx));
  const _pcPips = {}, _pcMult = {};   // id -> total, for the LEDGER only (applied per card, r233)
  let _clubHits = 0; // Hard Labour: counts club scoring hits, including retriggers
  let _handRetrigs = 0; // Cuckoo: extra retriggers in this hand (committed to retriggersThisRound in playHand)
  let _vultureFires = 0; // Vulture: total buff-seconds fired this hand, counting retriggers
  const _eightCount = hasTrick('eights_retrigger') ? cards.filter(c => c.rank === '8').length : 0;
  // Huddle: set of scored cells for in-hand adjacency. Assembly Line: running mark counter
  // (starts from this round's persistent count; simulated locally so calcScore stays pure).
  const _cellSet = new Set(_scoreCells.map(([_hr,_hc]) => _hr + '-' + _hc));
  const _asmOn = hasTrick('assembly_line');
  let _asmK = _asmOn ? assemblyMarkCount : 0;
  let _asmMult = 0;
  // Five Stack: 5-card hands add per-card pips+mult, replay-aware (folds through the retrigger loop).
  const _fiveCard = hasTrick('five_stack') && cells.length === 5;
  let _fsMult = 0;
  // 3rd Time's a Charm: the 3rd card (scoring order) of any hand gets +2 replays.
  const _3rdKey = (hasTrick('third_charm') && _scoreCells.length >= 3 && _scoreCells[2]) ? _scoreCells[2][0] + '-' + _scoreCells[2][1] : null;
  // Straight Shot: capture the modified pip value of the line's first & last card
  const _slFirstKey = _scoreCells.length ? _scoreCells[0][0] + '-' + _scoreCells[0][1] : '';
  const _slLastKey  = _scoreCells.length ? _scoreCells[_scoreCells.length-1][0] + '-' + _scoreCells[_scoreCells.length-1][1] : '';
  let _slFirstPips = 0, _slLastPips = 0;
  // Encore: an all-odd-rank Set hand scores a second time (whole-hand replay via +1 retrig per card).
  const _encoreHand = hasTrick('encore') && isSetHand(handName) && cards.every(c => ['A','3','5','7','9'].includes(c.rank));
  // Wait For Iiiit: per-card replay chance = 2% per negative reward tile taken this run (same for every card).
  const _wfiChance = hasTrick('wait_for_it') ? negativeTilesTakenRun * BAL.wait_for_it.chance_per : 0;
  // Per-card replay count (key 'r-c' → times this card scores). Lets the post-loop
  // per-card MULT / coin / time bonuses re-fire on replay too (not just pips).
  const retrigByKey = {};
  const _ledgerCells = ledger ? [] : null;
  _scoreCells.forEach(([r, c], _ci) => {
    const card = gridData[r][c];
    _tlCard = _ci;                                          // everything emitted below belongs to THIS card
    const _tlMark = _tl ? _tl.length : 0;                   // rewind point for the Blight
    const _cpSnap = ledger ? Object.assign({}, _cp) : null; // to diff this card's per-card pip tricks
    // ── The Blight ──────────────────────────────────────────────────────────
    // A contaminated cell halves the card's pips AND may suppress the Tricks it
    // would have fired. The roll happens HERE, before any Trick logic, for two
    // reasons: the per-card MULT accumulators (_asmMult / _fsMult) have to be
    // skippable, and the pip fallback has to be the card's RAW value. Rolling
    // back after the fact only corrected the contributions ledger while the
    // score kept every Trick bonus - which made the suppression cosmetic.
    const _blighted = (typeof isCellDamped === 'function') && isCellDamped(r, c);
    const _blightMute = _blighted && Math.random() < 0.2;
    // Dead Drop (r194): this cell's card is fully part of the HAND - it was
    // selectable, detectHand counted it, and the hand's own Tricks fire on the
    // hand as a whole - but the card itself contributes nothing: no pips, and
    // none of its per-card Tricks. Same machinery as the Blight's mute (snapshot
    // the ledger, restore it after) because the requirement is the same shape;
    // the difference is where it lands, raw pips for the Blight and zero here.
    const _dead = (typeof isCellDead === 'function') && isCellDead(r, c);
    const _mute = _blightMute || _dead;
    const _cpSnapBlight = _mute ? Object.assign({}, _cp) : null;
    const _cmSnapBlight = _mute ? Object.assign({}, _cm) : null;
    const baseRank = card.rank;
    const _origPips = cardPips(baseRank);
    _ev('_card', 'pip+', _origPips, 'card');   // the card's own pips lead its beat
    let rawPips = _origPips;
    if (hasTrick('face_value') && ['J','Q','K'].includes(baseRank)) { rawPips = BAL.face_value.face_pips; bPip('face_value', rawPips - _origPips); }
    else if (hasTrick('first_light') && baseRank === 'A') { rawPips = BAL.first_light.worth; bPip('first_light', rawPips - _origPips); }
    if (hasTrick('humble_roots') && ['A','1','2','3','4','5'].includes(baseRank)) { const _b = rawPips; rawPips *= BAL.humble_roots.pip_mult; bPipX('humble_roots', BAL.humble_roots.pip_mult, rawPips - _b); }
    if (hasTrick('summit') && (RANK_ORDER[baseRank] || 0) === _handMinRankVal) { const _b = cardPips(baseRank) * level; rawPips += _b; bPip('summit', _b); }
    let cp = rawPips;
    if (hasTrick('rich_soil')) { cp += BAL.rich_soil.pips; bPip('rich_soil', BAL.rich_soil.pips); }
    if (hasTrick('fertile_ground')) { cp += BAL.fertile_ground.pips; bPip('fertile_ground', BAL.fertile_ground.pips); }
    if (hasTrick('court_of_leaves') && ['J','Q','K'].includes(baseRank)) { cp += BAL.court_of_leaves.pips; bPip('court_of_leaves', BAL.court_of_leaves.pips); }
    if (hasTrick('power_two') && baseRank === '2') { cp += BAL.power_two.pips; bPip('power_two', BAL.power_two.pips); }
    if (hasTrick('ten_strong') && baseRank === '10') { cp += BAL.ten_strong.pips; bPip('ten_strong', BAL.ten_strong.pips); }
    if (hasTrick('king_guard') && (baseRank === 'K' || baseRank === 'J')) { cp += BAL.king_guard.pips; bPip('king_guard', BAL.king_guard.pips); }
    if (hasTrick('dark_matter') && card._corrupted) { cp += BAL.dark_matter.pips; bPip('dark_matter', BAL.dark_matter.pips); }
    const _eKey = cardId(card);
    const _pp = permPips[_eKey] || 0;
    cp += _pp;
    bPip('sapling', _pp);
    // Huddle: +pips per orthogonally-adjacent card/sleight also in this hand
    if (hasTrick('huddle')) {
      let _adj = 0;
      if (_cellSet.has((r-1)+'-'+c)) _adj++;
      if (_cellSet.has((r+1)+'-'+c)) _adj++;
      if (_cellSet.has(r+'-'+(c-1))) _adj++;
      if (_cellSet.has(r+'-'+(c+1))) _adj++;
      if (_adj) { const _hb = _adj * BAL.huddle.pips_per_adj; cp += _hb; bPip('huddle', _hb); }
    }
    // Permanent ×pips enhancement (The Forge / Bargain / Wager events)
    const _xp = permXPips[_eKey] || 1;
    if (_xp !== 1) { const _preXp = cp; cp *= _xp; bPipX('sapling', _xp, cp - _preXp); }
    // Right Place: marked row/column cards score +flat pips
    if (cellHasRowColBonus(r, c, 'rowcol_triple_pips')) { cp += BAL.rowcol_triple_pips.flat_pips; bPip('rowcol_triple_pips', BAL.rowcol_triple_pips.flat_pips); }
    // Five Stack: +pips per card in a 5-card hand (before the retrigger multiply → replay-aware)
    if (_fiveCard) { cp += BAL.five_stack.pips; bPip('five_stack', BAL.five_stack.pips); }
    // 4x4: cards scored in the 4th column (index 3) score +pips
    if (hasTrick('four_by_four') && c === 3) { cp += BAL.four_by_four.pips; bPip('four_by_four', BAL.four_by_four.pips); }
    // Leaden curse: this card contributes no pips at all (applied last so it wins)
    if (cardCurses[_eKey]?.id === 'leaden') { if (cp) _ev('leaden', 'pip*', 0, 'curse'); cp = 0; }
    // Straight Shot: remember the first/last line card's modified pips (post-buff, post-curse, pre-replay)
    const _cKey = r + '-' + c;
    if (_cKey === _slFirstKey) _slFirstPips = cp;
    if (_cKey === _slLastKey)  _slLastPips = cp;
    // Retrigger / replay: certain conditions score this card's pips an extra time
    let _retrig = 1;
    const _r2 = false; // Double Take redesigned - now duplicates a Trick, not the 2 card
    const _r8 = hasTrick('eights_retrigger') && baseRank === '8';
    const _rc = false; // Cornered redesigned - now a post-loop pip multiplier, not a replay
    // Echo Location: a 50% replay, deterministic so preview == score. It was
    // `(card._id + handsPlayedRound) % 2 === 0`, which IS a fair 50% but has no
    // probability in it for Luck to scale - so it is now the same
    // hash-vs-threshold shape as Wait For Iiiit, off the same BAL number.
    const _rl = cellHasRowColBonus(r, c, 'rowcol_retrigger')
      ? luckRollDet(BAL.rowcol_retrigger.chance, (card._id || 0) + 7919, handsPlayedRound) : 0;
    const _pt = cellHasRowColBonus(r, c, 'perfect_timing'); // Perfect Timing: guaranteed replay
    const _res = _eyeStorm && _rankHigh(baseRank) === _eyeMax;
    const _rip = _rippleReady && _rippleSet.has(`${r}-${c}`);
    const _refl = reflectAimsAt(r, c);
    const _soul = soulMirrorRankCount(baseRank);
    // Echo (sleight): armed by playing it, every card in the hand replays twice.
    // It used to double the whole hand at SCORE level; as a per-card replay it
    // multiplies pips only, which is what "each card replays twice" describes.
    const _echoS = (typeof sleightNextHandDouble !== 'undefined') && sleightNextHandDouble;
    const _re = permRetrig[_eKey] || 0;  // permanent per-card retrigger (events)
    const _rne = hasTrick('closing_time') && roundFractionRemaining() < 0.25; // Near Extinction
    const _hnm = _hnmOn && _rankHigh(baseRank) === _hnmMax; // High and Mighty: top-rank card(s)
    const _ech = hasTrick('echo_hand') && _effStreak >= 2; // Echoes
    const _wp = hasTrick('woodpecker') && woodpeckerPos && r === woodpeckerPos.r && c === woodpeckerPos.c; // Woodpecker
    // Wait For Iiiit: each card independently rolls a replay at 2% × negative reward tiles taken this
    // run. Deterministic per (card, hand) so preview == score (see _detReplayRand).
    // Luck scales the THRESHOLD here rather than adding a roll: calling
    // Math.random() in calcScore would give findBestHand's preview a different
    // answer than the committed score. luckRollDet keeps the same hash and
    // compares it against the luck-scaled chance, so the preview stays honest -
    // and it returns a COUNT, so past 100% a card replays more than once.
    const _wfi = _wfiChance > 0 ? luckRollDet(_wfiChance, card._id || 0, handsPlayedRound) : 0;
    if (_r2) _retrig++; if (_r8) _retrig += (_eightCount - 1); if (_rc) _retrig++; _retrig += _rl; if (_pt) _retrig++;
    if (_res) _retrig++; if (_rip) _retrig++;
    if (_refl) _retrig += BAL.reflect.extra_replays; _retrig += _soul;
    if (_echoS) _retrig++;
    _retrig += _re;
    if (_rne) _retrig++; if (_ech) _retrig++; if (_wp) _retrig += BAL.woodpecker.retrigger_count;
    if (_hnm) _retrig++;
    _retrig += _wfi; // Wait For Iiiit: chance replay scaling with negative tiles taken
    if (_encoreHand) _retrig++; // Encore: all-odd-rank Set scores a second time
    if (_compReps) _retrig += (_compReps[_cKey] || 0); // Layered hand: this card scores again for each extra component it is in
    if (_cKey === _3rdKey) _retrig += BAL.third_charm.extra_replays; // 3rd Time's a Charm: 3rd card gets +2 replays
    // The Rerun (boss): every replay past the first is a coin flip. Deterministic,
    // keyed on the card and the hand index, so the preview and the committed score
    // can never disagree - the same rule Wait For Iiiit follows.
    if (typeof bossRerunKeepsReplay === 'function' && _retrig > 1) {
      let _kept = 1;
      for (let _ri = 1; _ri < _retrig; _ri++) if (bossRerunKeepsReplay(card._id || 0, _ri)) _kept++;
      _retrig = _kept;
    }
    retrigByKey[r + '-' + c] = _retrig;
    if (_ledgerCells) {
      // Per-card pip-trick single-iteration deltas = the change in _cp during THIS card's
      // pre-replay body (excludes replay bookkeeping, which the dance shows by repeating the beat).
      const _pipT = {};
      for (const _id in _cp) { const _d = (_cp[_id] || 0) - (_cpSnap[_id] || 0); if (_d) _pipT[_id] = _d; }
      _ledgerCells.push({ r, c, card, rank: card.rank, suit: card.suit, rawPip: _origPips, reps: _retrig, pipT: _pipT, multT: {} });
    }
    if (hasTrick('club_double') && (card.suit === '♣' || (card.combined && card.suit2 === '♣'))) _clubHits += _retrig;
    if (card._vulturePause) _vultureFires += card._vulturePause * _retrig; // Vulture buff fires once per (re)trigger
    // Assembly Line: each (re)play of a mark card earns the running counter, then increments it
    if (_asmOn && !_mute && cellHasRowColBonus(r, c, 'assembly_line')) {
      for (let _ai = 0; _ai < _retrig; _ai++) { _asmMult += _asmK; _asmK++; }
    }
    // Five Stack: +mult per card, once per (re)trigger of that card
    if (_fiveCard && !_mute) _fsMult += BAL.five_stack.mult * _retrig;
    if (_retrig > 1) {
      const _pre = cp; cp *= _retrig;
      const _extra = cp - _pre;
      _handRetrigs += (_retrig - 1); // Cuckoo counts retriggers this round
      // Ledger-only (bPipQ), but still one proc each: the timeline shows a replay
      // by REPEATING this card's whole beat, which re-adds these pips on its own,
      // so emitting them as events too would count every retrigger twice. The
      // proc still happened, and the Rider penalty bills against procs.
      if (_r2) bPipQ('twos_retrigger', _pre, 1);
      else if (_r8) bPipQ('eights_retrigger', _pre, 1);
      else if (_rc) bPipQ('corner_retrigger', _pre, 1);
      else if (_rl) bPipQ('rowcol_retrigger', _pre, 1);
      else if (_pt) bPipQ('perfect_timing', _pre, 1);
      else if (_res) bPipQ('eye_of_storm', _pre, 1);
      else if (_rip) bPipQ('ripple', _pre, 1);
      else if (_echoS) bPipQ('echo_play', _pre, 1);
      else if (_refl) bPipQ('reflect', _pre, 1);
      else if (_soul) bPipQ('soul_mirror', _pre, 1);
      else if (_re) bPipQ('sapling', _extra, 1);
      else if (_hnm) bPipQ('high_and_mighty', _pre, 1);
      else if (_rne) bPipQ('closing_time', _pre, 1);
      else if (_ech) bPipQ('echo_hand', _pre, 1);
      else if (_wp) bPipQ('woodpecker', _extra, 1);
      else if (_wfi) bPipQ('wait_for_it', _pre, 1);
      else if (_encoreHand) bPipQ('encore', _pre, 1);
      else if (_cKey === _3rdKey) bPipQ('third_charm', _extra, 1);
    }
    // The Blight, applied. A muted card falls back to its RAW pip value (plus any
    // permanent per-card buff, which is a property of the card rather than a
    // Trick trigger) - replays still apply, they are a separate mechanic. Then
    // the ledger is restored so the contributions tab matches what was scored.
    // TBD: whole-hand Tricks are still unaffected; only this card's own
    // contributions are suppressed.
    if (_mute) {
      // Blighted keeps the card's raw value; a dead cell keeps nothing.
      cp = _dead ? 0 : (_origPips + _pp) * Math.max(1, _retrig);
      const restore = (live, snap) => Object.keys(live).forEach(k => {
        if (snap && snap[k] !== undefined) live[k] = snap[k]; else delete live[k];
      });
      restore(_cp, _cpSnapBlight);
      restore(_cm, _cmSnapBlight);
      if (_tl) _tl.length = _tlMark;   // the suppressed Tricks never fired, so they never animate either
    }
    if (_blighted && !_dead) { _ev('_blight', 'pip*', 0.5, 'boss'); cp = cp * 0.5; }
    // The ONE place a boss changes what this card's pips are worth (the Sommelier's
    // marked-down suits, the Gradient's slope). A pure read - calcScore runs on
    // every preview recompute, so nothing here may mutate boss state.
    if (typeof bossCardPipScale === 'function') {
      const _bps = bossCardPipScale(card, r, c);
      if (_bps !== 1) { _ev('_bossCard', 'pip*', _bps, 'boss'); cp *= _bps; }
    }
    totalPips += cp;
    // ── Per-card MULT (see the accumulators above). Emitted AFTER the Blight's
    //    rewind, because the post-loop sweeps these replace were never Blight-
    //    suppressed - truncating them here would make the timeline under-report.
    //    One emit per card; the dance repeats the beat `_retrig` times, so the
    //    particle count lands on the same total the accumulator does.
    const _isHeartC = card.suit === '♥' || (card.combined && card.suit2 === '♥');
    // `_cmAdd` is what this card pays EVERY time it scores. `_cmOnce` is what it
    // pays on its FIRST scoring only (the PER_CARD_PAYERS, which read cells.length
    // rather than a replay-weighted count). The accumulators are kept purely as
    // LEDGER totals - the contributions tab wants one row per Trick, not one per
    // card - and the rep loop below is what actually moves `mult`.
    let _cmAdd = 0, _cmOnce = 0;
    if (hasTrick('heart_double') && _isHeartC) { const _v = BAL.heart_double.heart_mult; _cmAdd += _v; _hdMult += _v * _retrig; _ev('heart_double','mult+',_v); }
    if (hasTrick('jack_mult') && baseRank === 'J') { const _v = BAL.jack_mult.mult_per_jack; _cmAdd += _v; _jmMult += _v * _retrig; _ev('jack_mult','mult+',_v); }
    if (hasTrick('king_guard') && (baseRank === 'K' || baseRank === 'J')) { const _v = BAL.king_guard.mult; _cmAdd += _v; _kgMult += _v * _retrig; _ev('king_guard','mult+',_v); }
    const _pmv = permMult[_eKey] || 0;
    if (_pmv) { _cmAdd += _pmv; _pmMult += _pmv * _retrig; _proc('perm_mult'); _ev('perm_mult','mult+',_pmv); }
    if (hasTrick('old_growth') && _pp) { _cmAdd += _pp; _ogMult += _pp * _retrig; _proc('old_growth'); _ev('old_growth','mult+',_pp); }
    const _ec1 = exaltCorruptTotals([card]);
    if (_ec1.mult) { _cmAdd += _ec1.mult; _ecMultAcc += _ec1.mult * _retrig; _ev('_exalt','mult+',_ec1.mult,'exalt'); }
    if (_ec1.pips) { _ecPipAcc  += _ec1.pips * _retrig; _ev('_exalt','pip+', _ec1.pips,'exalt'); }
    // Per-card payers (see PER_CARD_PAYERS). NOT multiplied by _retrig - these
    // pay once per card however many times it scores - so the events carry
    // `once` and the dance applies them on the card's first beat only.
    _pcLive.forEach(row => {
      const p = row.pays(card, _pcCtx); if (!p) return;
      if (p.pip)  { _pcPips[row.id] = (_pcPips[row.id]||0) + p.pip;  _ev(row.id,'pip+', p.pip,  'trick', undefined, undefined, true); }
      if (p.mult) { _pcMult[row.id] = (_pcMult[row.id]||0) + p.mult; _cmOnce += p.mult; _ev(row.id,'mult+',p.mult, 'trick', undefined, undefined, true); }
    });
    // ── This card's own x MULT, and the whole reason the adds above had to move
    //    here (r233). A card enhancement that multiplies the mult is a CARD
    //    trigger: it fires on the card, once per replay, and it multiplies the
    //    number the player is watching - which is the running mult with this
    //    card's own adds already in it.
    //
    //    It used to sit in the x mult block at the very end, raised to the power
    //    of the replay count (x1.5 on a card scoring three times landed as one
    //    x3.375). That is the same arithmetic and it cannot be communicated: one
    //    lump at the end, on a card that finished animating seconds earlier, with
    //    an exponent nothing on screen explains.
    //
    //    THE REP LOOP IS THE ORDER THE DANCE REPLAYS THE BEAT, exactly: adds,
    //    then the once-payers on the first rep only, then the multiply. Emitting
    //    the multiply LAST in the block is what keeps the two in step - the dance
    //    filters `once` events out of later reps and applies everything else in
    //    emission order, so any other arrangement diverges the moment a replayed
    //    card carries an enhancement.
    const _xm = permXMult[_eKey] || 1;
    if (_xm !== 1) _ev('perm_mult', 'mult*', _xm, 'trick', undefined, 'none');
    // The EVENTS are emitted here, where they belong on the timeline. The
    // ARITHMETIC is banked and run in `_cardMultSeq` further down, because `mult`
    // itself does not exist yet - it is declared below this loop, and reading it
    // here is a temporal-dead-zone throw, not a wrong number. The sequence is
    // replayed the moment `mult` has its base value and before ANY hand-level
    // add, which is exactly where these events sit on the timeline.
    if (_cmAdd || _cmOnce || _xm !== 1) _cardMultSeq.push({ add: _cmAdd, once: _cmOnce, xm: _xm, reps: _retrig });
  });
  _tlCard = -1;   // back to hand level - everything past here is a whole-hand event
  _lastHandProcs = _procs;         // snapshot for the Rider penalty (read in playHand)
  _lastHandRetrigs = _handRetrigs; // snapshot for Cuckoo (read after captureRoundContrib in playHand)
  _lastHandVultureSeconds = _vultureFires; // snapshot for Vulture (retrigger-aware pause seconds)
  _lastRetrigByCell = retrigByKey; // snapshot for playHand's exalt/corrupt coin/time (replay-aware)
  // reps aligned to `cards`/`_scoreCells`. The replay-weighted per-card sweeps that
  // used to live here are accumulated in the loop instead (r197) - see the per-card
  // MULT block - so each one can animate on the card that earned it.
  const _reps = _scoreCells.map(([r, c]) => retrigByKey[r + '-' + c] || 1);

  // Hidden pair trick
  const rankCounts = {};
  cards.forEach(c => rankCounts[c.rank] = (rankCounts[c.rank]||0)+1);
  const hasPairInHand = Object.values(rankCounts).some(v => v >= 2);
  if (hasTrick('hidden_pair') && hasPairInHand) { totalPips += BAL.hidden_pair.pips; bPip('hidden_pair', BAL.hidden_pair.pips); }
  if (hasTrick('twin_sprouts') && handName === 'Pair')   { totalPips += BAL.twin_sprouts.pips; bPip('twin_sprouts', BAL.twin_sprouts.pips); }
  if (hasTrick('worn_path')    && handName === 'Straight'){ totalPips += BAL.worn_path.pips; bPip('worn_path', BAL.worn_path.pips); }
  if (hasTrick('enriched')     && handName === 'Flush')   { totalPips += BAL.enriched.pips; bPip('enriched', BAL.enriched.pips); }

  // Early bird: first third of the round, +pips per card
  if (_pcPips.early_bird) { totalPips += _pcPips.early_bird; bPipQ('early_bird', _pcPips.early_bird, 1); }

  // Kindling streak: +pips per streak hand beyond the first
  if (hasTrick('kindling') && _effStreak > 1) { const _a = BAL.kindling.pips_per_streak * (_effStreak - 1); totalPips += _a; bPip('kindling', _a); }

  // Albatross: +5 pips for every second the clock has spent paused this round
  if (hasTrick('albatross') && pausedSecondsRound > 0) { const _a = pausedSecondsRound * BAL.albatross.pips_per_second; totalPips += _a; bPip('albatross', _a); }

  // Sediment: +10 pips per 10 seconds of round time elapsed (grows as the round runs down)
  if (hasTrick('sediment')) {
    const _elapsed = Math.max(0, roundStartSeconds - roundSeconds);
    const _a = Math.floor(_elapsed / BAL.sediment.interval_seconds) * BAL.sediment.pips_per_interval;
    if (_a) { totalPips += _a; bPip('sediment', _a); }
  }

  // Clubs: neutral by default; +10 pips each with Hard Labour Trick
  const clubCount = cards.filter(c => c.suit === '♣' || (c.combined && c.suit2 === '♣')).length;
  if (hasTrick('club_double') && _clubHits > 0) { const _a = BAL.club_double.base * (Math.pow(2, _clubHits) - 1); totalPips += _a; bPip('club_double', _a); }

  // Spade Flood: all-Spade hand of 4+ adds roundSeconds x 2 as pips
  const allSpadesCalc = cards.every(c => c.suit === '♠' || (c.combined && c.suit2 === '♠'));
  if (hasTrick('spade_flood') && allSpadesCalc) { const _a = Math.floor(roundSeconds / BAL.spade_flood.time_div); totalPips += _a; bPip('spade_flood', _a); }

  // Sands of Time: remaining round seconds / 2 as trick pips
  if (hasTrick('sands_of_time')) { const _a = Math.floor(roundSeconds / BAL.sands_of_time.divisor); totalPips += _a; bPip('sands_of_time', _a); }

  // Compost: +3 pips per card discarded this round
  if (hasTrick('discard_pips')) { const _a = cardsDiscardedRound * BAL.discard_pips.pips_per_discard; totalPips += _a; bPip('discard_pips', _a); }
  // Stand-Up: +10 pips per charge remaining across all owned Sleights
  if (hasTrick('stand_up')) { const _a = sleightChargeInfo().total * BAL.stand_up.pips_per_charge; if (_a) { totalPips += _a; bPip('stand_up', _a); } }

  // Penny Saved: accumulated trick pips from discarded 5s
  if (hasTrick('fives_discard')) { totalPips += bonusMult_fives; bPip('fives_discard', bonusMult_fives); }

  // Clock-mark Tricks: pending pip bonuses accrued as the clock passed timestamps (consumed in playHand)
  if (pendingHandPips > 0) { totalPips += pendingHandPips; bPip('quarter_chime', pendingHandPips); }
  if (pendingCardPips > 0) { totalPips += pendingCardPips; bPip('second_hand', pendingCardPips); }

  // Trinity Run: +9 mult for runs with 3/6/9 (added to mult section below)
  const hasTrinityRank = (['Run of 3','Run of 4','Straight','Straight Flush'].includes(handName)) &&
    cards.some(c => ['3','6','9'].includes(c.rank));

  // 2. Base mult + bonuses
  // handBaseMult is the hand's ladder mult, or the hand's CARD COUNT under the
  // hand_size model, plus Natural Scaling's earned family bonus. _scoreCells is
  // the hand actually being scored.
  let mult = handBaseMult(handName, _scoreCells.length) + sleightAmplifierMult;

  // Layered hands: every other component adds its base mult too. Additive, not
  // multiplied - two hands' worth of ladder, not the product of them.
  _extraLayers.forEach(h => { mult += handBaseMult(h, _scoreCells.length); });

  // ── THE PER-CARD MULT SEQUENCE (r233) ──────────────────────────────────────
  // Every card's own mult, applied here in scoring order, BEFORE a single
  // hand-level bonus - which is precisely where the card beats sit on the
  // timeline, so the running MULT chip the player watches during the beats is
  // the real number rather than a stand-in that gets corrected at the end.
  //
  // It used to be a set of accumulators summed into `mult` at scattered points
  // after this. That was score-identical while every term here was an ADD, and
  // it stopped being so the moment a per-card x MULT joined them: a multiply has
  // to know what has already landed.
  //
  // THE REP LOOP IS THE ORDER THE DANCE REPLAYS A BEAT, exactly - the adds, then
  // the once-payers on the first rep only, then the multiply. The dance filters
  // `once` events out of later reps and applies everything else in emission
  // order, so any other arrangement diverges the moment a REPLAYED card carries
  // an enhancement.
  _cardMultSeq.forEach(m => {
    let _noX = mult;                 // what mult would be with no enhancement (ledger delta)
    for (let k = 0; k < m.reps; k++) {
      const a = m.add + (k === 0 ? m.once : 0);
      mult += a; _noX += a;
      if (m.xm !== 1) mult *= m.xm;
    }
    if (m.xm !== 1) bMultQ('perm_mult', mult - _noX, 1);
  });

  // Assembly Line: apply the mult accumulated in the per-card loop; snapshot the round counter
  if (_asmMult > 0) { mult += _asmMult * BAL.assembly_line.mult_per_prior; bMult('assembly_line', _asmMult * BAL.assembly_line.mult_per_prior); }
  if (_fsMult > 0) { mult += _fsMult; bMult('five_stack', _fsMult); }
  if (_asmOn) _lastHandAssemblyEnd = _asmK;

  if (risingTideBonus > 0) { mult += risingTideBonus; bMult('rising_tide', risingTideBonus); }
  // Minute Hand: primed by every minute mark, spent one hand at a time (r209).
  // Read-only here - playHand decrements the charge after the score commits, the
  // same discipline siphonMultX follows, so findBestHand stays consistent.
  if (hasTrick('minute_hand') && minuteHandCharges > 0) { mult += BAL.minute_hand.mult; bMult('minute_hand', BAL.minute_hand.mult); }
  // Generic pending mult (nothing feeds this today; kept as the seam a future
  // "+N mult to your next hand" effect drops into).
  if (pendingHandMult > 0) { mult += pendingHandMult; bMult('pending_mult', pendingHandMult); }
  // Night owl: last third of the round, +mult per card
  if (_pcMult.night_owl) { bMultQ('night_owl', _pcMult.night_owl, 1); }
  // Wildfire: 3+ same hands in a row
  if (hasTrick('wildfire') && _effStreak >= 3) { mult += BAL.wildfire.mult; bMult('wildfire', BAL.wildfire.mult); }
  // Hummingbird: +mult per clock pause triggered this game (uncapped)
  if (hasTrick('hummingbird') && pauseInstanceGame > 0) { const _a = pauseInstanceGame * BAL.hummingbird.mult_per_pause; mult += _a; bMult('hummingbird', _a); }
  // The Kingfisher: +1 mult per 5 seconds paused OR rewound this round (the rewind-aware amplifier)
  if (hasTrick('kingfisher')) {
    const _manip = pausedSecondsRound + rewoundSecondsRound;
    const _a = Math.floor(_manip / BAL.kingfisher.interval_seconds) * BAL.kingfisher.mult_per_interval;
    if (_a) { mult += _a; bMult('kingfisher', _a); }
  }
  // The Swift: +mult for every N seconds of round time elapsed
  if (hasTrick('swift')) { const _e = Math.max(0, roundStartSeconds - roundSeconds); const _a = Math.floor(_e / BAL.swift.interval_seconds) * BAL.swift.mult_per_interval; if (_a) { mult += _a; bMult('swift', _a); } }
  // Eagle Eye: +mult per 10 round-seconds elapsed since the last swap (or round start if none yet)
  if (hasTrick('still_water')) {
    const elapsedSinceSwap = lastSwapRoundSeconds !== null
      ? Math.max(0, lastSwapRoundSeconds - roundSeconds)
      : Math.max(0, roundStartSeconds - roundSeconds);
    const _a = BAL.still_water.mult_per_interval * Math.floor(elapsedSinceSwap / 10);
    if (_a) { mult += _a; bMult('still_water', _a); }
  }

  // Ready, Set, Go: a 3-card hand (or a Pair via Three's a Crowd) containing a 3 scores +mult
  if (hasTrick('ready_set_go') && counts3CardHand(handName, cells) && cards.some(cd => cd && cd.rank === '3')) {
    mult += BAL.ready_set_go.mult; bMult('ready_set_go', BAL.ready_set_go.mult);
  }
  // Four Eyes: 4-card hands score +mult
  if (hasTrick('four_eyes') && cells.length === 4) { mult += BAL.four_eyes.mult; bMult('four_eyes', BAL.four_eyes.mult); }
  // Four Horse-man: 4-card hands grant a random bonus (pips/mult here; Focus/pause in playHand)
  if (hasTrick('four_horseman') && cells.length === 4) {
    const _fhm = fourHorsemanRoll(cells);
    if (_fhm === 0)      { totalPips += BAL.four_horseman.pips; bPip('four_horseman', BAL.four_horseman.pips); }
    else if (_fhm === 1) { mult += BAL.four_horseman.mult; bMult('four_horseman', BAL.four_horseman.mult); }
  }

  // Hand-specific mult
  const isRun = ['Run of 3','Run of 4','Straight','Straight Flush'].includes(handName);
  if (_pcPips.overgrowth) { totalPips += _pcPips.overgrowth; bPipQ('overgrowth', _pcPips.overgrowth, 1); }
  if (_pcMult.long_road) { bMultQ('long_road', _pcMult.long_road, 1); }
  // Wave Amplification: consecutive Runs score +pips × their streak position (runStreak is the streak
  // ending at the PREVIOUS hand, so this run's position = runStreak + 1). playHand advances runStreak after.
  if (hasTrick('wave_amp') && isRun) { const _a = BAL.wave_amp.pips_per_streak * (runStreak + 1); totalPips += _a; bPip('wave_amp', _a); }
  if (hasTrick('correct_run') && isRun && canBeOrderedRun(cells)) {
    if (_pcPips.correct_run) { totalPips += _pcPips.correct_run; bPipQ('correct_run', _pcPips.correct_run, 1); }
    if (_pcMult.correct_run) { bMultQ('correct_run', _pcMult.correct_run, 1); }
  }
  if (handName === 'Flush') {
    if (hasTrick('tidal_force')) { mult += BAL.tidal_force.mult; bMult('tidal_force', BAL.tidal_force.mult); }
  }
  // Row/col +2 mult per affected card
  cells.forEach(([r, c]) => {
    const matches = rowColBonuses.filter(b => b.id === 'rowcol_mult' && ((b.axis === 'row' && b.index === r) || (b.axis === 'col' && b.index === c)));
    // Emitted, but NOT billed to _cp/_cm: this bonus has never had a contributions
    // row and adding one would change what that tab reports. The timeline needs it
    // regardless - a mult the dance cannot see is a mult that makes the chip drift.
    if (matches.length) _ev('rowcol_mult', 'mult+', matches.length * 2);
    mult += matches.length * 2;
  });

  // Shape: straight line - add first + last card pip values to mult
  // Straight Shot: a 5-card hand in a straight line adds its first+last card's modified pips to mult
  if (hasTrick('shape_line') && cells.length === 5 && isStraightLine(cells)) {
    const _a = _slFirstPips + _slLastPips; mult += _a; bMult('shape_line', _a);
  }

  // Batch C - positional conditions
  if (_pcPips.edge_pips) { totalPips += _pcPips.edge_pips; bPipQ('edge_pips', _pcPips.edge_pips, 1); }
  const { rowSpan, colSpan } = spanStats(cells);
  // Inclusive: a hand spanning the full width or full height of the grid scores +mult
  if (hasTrick('wide_span_mult') && (colSpan === gridCols || rowSpan === gridRows)) {
    mult += BAL.wide_span_mult.mult; bMult('wide_span_mult', BAL.wide_span_mult.mult);
  }

  // Perm mult (per-card buff → fires once per replay). Summed in the card loop so
  // it animates on the card carrying the buff; identical sum to the old sweep.
  if (_pmMult) { bMultQ('perm_mult', _pmMult); }
  // Old Growth: each scored card also adds its permanent pip bonus to mult (per replay)
  if (_ogMult) { bMultQ('old_growth', _ogMult); }
  // Magician: +3 mult per Sleight owned
  if (hasTrick('magician')) { const _a = ownedSleightCount() * BAL.magician.mult_per_sleight; if (_a) { mult += _a; bMult('magician', _a); } }
  // Landfill: +1 mult per 5 cards discarded this round
  if (hasTrick('landfill')) { const _a = Math.floor(cardsDiscardedRound / BAL.landfill.discards_per) * BAL.landfill.mult_per_n; if (_a) { mult += _a; bMult('landfill', _a); } }

  // Sleight-sourced mult (r120) - these come from Sleights sitting on the grid, not Tricks,
  // so they're tracked separately and attributed with source:'sleight' in the contributions.
  const _whetM  = whetstoneMultForCells(cells); // Whetstone: sharpened mult, if it neighbors the hand
  const _entM   = entourageMult();              // Entourage: +mult per other Sleight on the grid
  const _lightM = lighthouseMult();             // Lighthouse: mult by distance from its favored column
  mult += _whetM + _entM + _lightM;
  _ev('whetstone',  'mult+', _whetM,  'sleight');
  _ev('entourage',  'mult+', _entM,   'sleight');
  _ev('lighthouse', 'mult+', _lightM, 'sleight');
  let _siphonM = 0;                              // Siphon: multiplicative ×mult, applied after additive mults (below)
  let _legacyM = 0;                              // Legacy: multiplicative ×mult, same step as Siphon (r193)
  let _spotM   = 0;                              // Spot Check: multiplicative ×mult penalty (r194)

  // Hearts: neutral by default; +1 mult each with Devoted Trick (per-card → per replay)
  if (_hdMult) { bMultQ('heart_double', _hdMult, 1); }

  // Exalt / Corrupt - pip & mult contributions (coins & time applied in playHand); per-card → per replay
  // Summed per card in the loop above (same cards, same reps) so an exalted card's
  // buff animates on that card rather than in the end lump.
  const _ec = { pips: _ecPipAcc, mult: _ecMultAcc };
  totalPips += _ec.pips;
  // _ec.mult was applied per card in the loop; this is the floor it always had.
  if (mult < 1) mult = 1; // corruption can't drop mult below 1

  // Trinity Run: +9 mult for runs with 3/6/9
  if (hasTrick('threes_run') && hasTrinityRank) { mult += BAL.threes_run.mult; bMult('threes_run', BAL.threes_run.mult); }

  // Cloud Nine: accumulated mult from forgotten 9s
  if (hasTrick('nines_mult')) { mult += bonusMult_nines; bMult('nines_mult', bonusMult_nines); }

  // Perfect Ten: accumulated mult from discard milestones
  if (hasTrick('tens_mult')) { mult += bonusMult_tens; bMult('tens_mult', bonusMult_tens); }

  // ── New Trick mult bonuses ──
  // Per-rank mult
  const _aceCount   = cards.filter(c => c.rank === 'A').length;
  const _threeCount = cards.filter(c => c.rank === '3').length;
  if (_jmMult) { bMultQ('jack_mult', _jmMult, 1); }
  if (hasTrick('lucky_three') && _threeCount){ mult += BAL.lucky_three.mult; bMult('lucky_three', BAL.lucky_three.mult); }
  // Hand-size
  if (hasTrick('light_touch') && cells.length === 2) { mult += BAL.light_touch.mult; bMult('light_touch', BAL.light_touch.mult); }
  // Timing mult - Near Extinction's retrigger is handled in the per-card loop above.
  // The Heron: hands played 15+ round-seconds after the previous score +mult
  if (hasTrick('patience_reward') && lastHandRoundSeconds !== null && (lastHandRoundSeconds - roundSeconds) >= BAL.patience_reward.seconds) { mult += BAL.patience_reward.mult; bMult('patience_reward', BAL.patience_reward.mult); }
  // Suit conditions
  const _allRed   = cards.every(c => c.suit === '♥' || c.suit === '♦');
  const _allBlack = cards.every(c => c.suit === '♣' || c.suit === '♠');
  // Rainbow / Balance count COLOURS as seen, so a white card counts as white
  // rather than as the colour of the slot it came from.
  const _suitSet = new Set(cards.map(c => cardColorSuit(c)));
  if (_pcPips.full_color) { totalPips += _pcPips.full_color; bPipQ('full_color', _pcPips.full_color, 1); }
  if (_pcMult.full_color) { bMultQ('full_color', _pcMult.full_color, 0); }
  if (_pcMult.balanced_diet) { bMultQ('balanced_diet', _pcMult.balanced_diet, 1); }
  // Rank diversity
  const _rankSet = new Set(cards.map(c => c.rank));
  if (hasTrick('number_crunch') && _rankSet.size >= 4) { mult += BAL.number_crunch.mult; bMult('number_crunch', BAL.number_crunch.mult); }
  // Same-kind trick
  const _rankCounts2 = {};
  cards.forEach(c => _rankCounts2[c.rank] = (_rankCounts2[c.rank]||0)+1);
  const _maxCount = Math.max(...Object.values(_rankCounts2));
  // Sets - Quake (mult) / Shock (pips), scaling with the largest matching group
  if (_maxCount >= 2) {
    if (_pcMult.kindred) { bMultQ('kindred', _pcMult.kindred, 1); }
    if (_pcPips.trinity) { totalPips += _pcPips.trinity; bPipQ('trinity', _pcPips.trinity, 1); }
  }
  // Shaky Foundation: every other Set scores +mult (this Set is the (setsPlayedRound+1)-th; even → fires).
  if (hasTrick('shaky_foundation') && isSetHand(handName) && ((setsPlayedRound + 1) % 2 === 0)) { mult += BAL.shaky_foundation.mult; bMult('shaky_foundation', BAL.shaky_foundation.mult); }
  // Even/odd rank
  const _rankIsEven = _rankIsEvenRank, _rankIsOdd = _rankIsOddRank;
  // Get Even / Odd One In are deliberately the same effect mirrored (r205): the
  // bonus counts the EVEN (or ODD) cards, not every card in the hand. They used to
  // pay cells.length x rate, so a Pair with 3 evens in a 5-card hand paid for the
  // two odd cards as well, and Odd One In paid 5 where Get Even paid 2.
  // (`_evenN`, not `_ev` - that name is this function's timeline emitter, and a
  // block-scoped const of the same name shadows it.)
  if (_pcMult.even_score) { bMultQ('even_score', _pcMult.even_score, 1); }
  if (_pcMult.odd_squad) { bMultQ('odd_squad', _pcMult.odd_squad, 1); }
  // King's Guard's mult is accumulated per card in the loop now, so it animates on
  // the K or J that earned it; same replay-weighted sum the _wc sweep produced.
  if (_kgMult) { bMultQ('king_guard', _kgMult, 1); }
  if (hasTrick('ninesong')) { const _ps = cards.reduce((s,c) => s + cardPips(c.rank), 0); if (_ps % 3 === 0) { mult += BAL.ninesong.mult; bMult('ninesong', BAL.ninesong.mult); } }
  // Position: column/row
  const _allSameCol = cells.every(([, cc]) => cc === cells[0][1]);
  const _allSameRow = cells.every(([rr]) => rr === cells[0][0]);
  if (_pcMult.column_rush) { bMultQ('column_rush', _pcMult.column_rush, 1); }
  if (_pcMult.row_power) { bMultQ('row_power', _pcMult.row_power, 1); }
  // Level scaling
  if (hasTrick('veteran_bonus')) { const _a = (level - 1) * BAL.veteran_bonus.pips_per_level; totalPips += _a; bPip('veteran_bonus', _a); }
  // Accumulating scalers
  if (hasTrick('compound_mult') && bonusMult_compound > 0) { mult += bonusMult_compound; bMult('compound_mult', bonusMult_compound); }
  if (hasTrick('more_better') && bonusMult_morebetter > 0) { mult += bonusMult_morebetter; bMult('more_better', bonusMult_morebetter); }
  if (hasTrick('wild_side') && negativeTilesTakenRun > 0) { const _a = negativeTilesTakenRun * BAL.wild_side.mult_per; mult += _a; bMult('wild_side', _a); }
  if (hasTrick('prolific') && bonusPips_prolific > 0) { totalPips += bonusPips_prolific; bPip('prolific', bonusPips_prolific); }
  if (hasTrick('feng_shui') && bonusPips_fengshui > 0) { totalPips += bonusPips_fengshui; bPip('feng_shui', bonusPips_fengshui); }
  if (hasTrick('big_win') && bonusMult_jackpot > 0) { mult += bonusMult_jackpot; bMult('big_win', bonusMult_jackpot); }
  // Wellspring: +pips per 10 Focus generated this game. Feedback Loop: +mult per 5 Focus generated this round.
  if (hasTrick('wellspring')) { const _w = Math.floor(focusGenGame / BAL.wellspring.per_focus) * BAL.wellspring.pips_per; if (_w > 0) { totalPips += _w; bPip('wellspring', _w); } }
  if (hasTrick('feedback_loop')) { const _fl = Math.floor(focusGenRound / BAL.feedback_loop.per_focus) * BAL.feedback_loop.mult_per; if (_fl > 0) { mult += _fl; bMult('feedback_loop', _fl); } }
  // Hand type: pair-based pip bonuses
  // Hand type: specific pip bonuses
  if (hasTrick('triple_threat') && handName === 'Full House') { totalPips += BAL.triple_threat.pips; bPip('triple_threat', BAL.triple_threat.pips); }
  if (_pcPips.heavy_hand) { totalPips += _pcPips.heavy_hand; bPipQ('heavy_hand', _pcPips.heavy_hand, 1); }
  if (_pcPips.prime_time) { totalPips += _pcPips.prime_time; bPipQ('prime_time', _pcPips.prime_time, 1); }
  // Escalation: EVERY hand of the round counts, including the first three - they
  // just do not pay yet. Nothing lands until the (after_hands + 1)-th hand, and
  // then the bonus is the whole count x the rate: 4th = +12, 5th = +15, 6th = +18.
  // The hand being scored is the (handsPlayedRound + 1)-th, because handsPlayedRound
  // is bumped in playHand AFTER scoring.
  if (hasTrick('escalation')) {
    const _hands = handsPlayedRound + 1;
    if (_hands > BAL.escalation.after_hands) { const _a = _hands * BAL.escalation.mult_per_hand; mult += _a; bMult('escalation', _a); }
  }
  // Combo score: +2 mult per distinct hand type played this round
  if (hasTrick('combo_score') && handTypesRound.size > 0) { const _a = handTypesRound.size * BAL.combo_score.mult_per_type; mult += _a; bMult('combo_score', _a); }

  // The per-card x MULT enhancement (The Forge / Bargain / Wager events) USED TO
  // BE APPLIED HERE, at the very end of the additive ladder, as x(enhancement ^
  // replays). It fires on its own card now - see the rep loop in the card block
  // above. That is a real score change and a deliberate one: an effect the player
  // cannot see happen is not a mechanic, it is a number.
  // Run multipliers (epic) - applied after additive pip/mult bonuses
  if (isRun && hasTrick('undertow')) {
    const _um = BAL.undertow.pip_mult_base + BAL.undertow.pip_mult_step * Math.max(0, cells.length - 3);
    const _pre = totalPips; totalPips = Math.round(totalPips * _um); bPipX('undertow', _um, totalPips - _pre);
  }
  if (isRun && hasTrick('tide_table')) {
    const _tm = 1 + BAL.tide_table.mult_step * (runsPlayedRound + 1);
    const _pre = mult; mult = Math.round(mult * _tm * 10) / 10; bMultX('tide_table', _tm, mult - _pre);
  }
  // Set multipliers (epic) - applied after additive bonuses
  if (handName === 'Two Pair' && hasTrick('pair_pips')) { const _pre = totalPips; totalPips = Math.round(totalPips * BAL.pair_pips.pip_mult); bPipX('pair_pips', BAL.pair_pips.pip_mult, totalPips - _pre); }
  if (_maxCount >= 2 && hasTrick('double_bloom')) { const _pre = mult; mult = Math.round(mult * BAL.double_bloom.mult_mult * 10) / 10; bMultX('double_bloom', BAL.double_bloom.mult_mult, mult - _pre); }
  if (handName === 'Four of a Kind' && hasTrick('richter')) { const _pre = mult; mult = Math.round(mult * BAL.richter.mult_mult * 10) / 10; bMultX('richter', BAL.richter.mult_mult, mult - _pre); }
  // Rank multipliers
  if (hasTrick('royal_trio') && cards.some(c=>c.rank==='K') && cards.some(c=>c.rank==='Q') && cards.some(c=>c.rank==='J')) { const _pre = mult; mult = Math.round(mult * BAL.royal_trio.mult_mult * 10) / 10; bMultX('royal_trio', BAL.royal_trio.mult_mult, mult - _pre); }
  if (hasTrick('knave_power')) { let _jg = 0; for (let _gr=0; _gr<gridRows; _gr++) for (let _gc=0; _gc<gridCols; _gc++) { const _cc = gridData[_gr]?.[_gc]; if (_cc && !_cc._isSleight && !_cc._isTrick && _cc.rank === 'J') _jg++; } if (_jg > 0) { const _km = Math.pow(BAL.knave_power.per_jack, _jg); const _pre = totalPips; totalPips = Math.round(totalPips * _km); bPipX('knave_power', _km, totalPips - _pre); } }
  // Cornered: corner cards multiply the running pips by the whole minutes left (per corner card)
  if (hasTrick('corner_retrigger')) {
    const _minsLeft = Math.floor(roundSeconds / 60);
    const _nc = cornerCells(cells).length;
    if (_minsLeft >= 1 && _nc > 0) { const _cm2 = Math.pow(_minsLeft, _nc); const _pre = totalPips; totalPips = Math.round(totalPips * _cm2); bPipX('corner_retrigger', _cm2, totalPips - _pre); }
  }
  // Stretch: when a hand has 2+ corner cells, each corner card multiplies the running mult ×2
  if (hasTrick('two_corners')) {
    const _nc = cornerCells(cells).length;
    if (_nc >= 2) { const _tcm = Math.pow(BAL.two_corners.mult_mult, _nc); const _pre = mult; mult = Math.round(mult * _tcm * 10) / 10; bMultX('two_corners', _tcm, mult - _pre); }
  }
  // Scalper: ×(1 + 0.2 per missing Sleight charge) to total pips - figured once, now
  if (hasTrick('scalper')) { const _miss = sleightChargeInfo().missing; if (_miss > 0) { const _m = 1 + BAL.scalper.pip_mult_per_missing * _miss; const _pre = totalPips; totalPips = Math.round(totalPips * _m); bPipX('scalper', _m, totalPips - _pre); } }
  // ── Converted from ×score (r179) - see the note at the ×score step below ──
  // Twenty-One: raw face values total exactly 21 → ×pips
  if (hasTrick('blackjack_bonus')) {
    const _bjTotal = cards.reduce((sum, c) => {
      const v = c.rank === 'A' ? 11 : ['J','Q','K'].includes(c.rank) ? 10 : parseInt(c.rank);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    if (_bjTotal === 21) { const _pre = totalPips; totalPips = Math.round(totalPips * BAL.blackjack_bonus.pip_mult); bPipX('blackjack_bonus', BAL.blackjack_bonus.pip_mult, totalPips - _pre); }
  }
  if (handName === 'Straight Flush' && hasTrick('perfect_storm')) { const _pre = totalPips; totalPips = Math.round(totalPips * BAL.perfect_storm.pip_mult); bPipX('perfect_storm', BAL.perfect_storm.pip_mult, totalPips - _pre); }
  if (handName === 'Four of a Kind' && hasTrick('extinction')) { const _pre = mult; mult = Math.round(mult * BAL.extinction.mult_mult * 10) / 10; bMultX('extinction', BAL.extinction.mult_mult, mult - _pre); }
  if (hasTrick('last_stand') && score < roundGoal) { const _pre = mult; mult = Math.round(mult * BAL.last_stand.mult_mult * 10) / 10; bMultX('last_stand', BAL.last_stand.mult_mult, mult - _pre); }

  // ── r179 multiplier batch - triggers the ×pips/×mult pools had never covered ──
  // Replays: _reps[i] is this card's total scoring iterations, so the extras are
  // sum(_reps) - cards.length. Rerun takes them as pips, Chorus as mult.
  const _replayExtras = Math.max(0, _reps.reduce((a, b) => a + b, 0) - cards.length);
  if (_replayExtras > 0 && hasTrick('rerun')) {
    const _m = 1 + BAL.rerun.pip_mult_per_replay * _replayExtras;
    const _pre = totalPips; totalPips = Math.round(totalPips * _m); bPipX('rerun', _m, totalPips - _pre);
  }
  if (_replayExtras > 0 && hasTrick('chorus')) {
    const _m = 1 + BAL.chorus.mult_mult_per_replay * _replayExtras;
    const _pre = mult; mult = Math.round(mult * _m * 10) / 10; bMultX('chorus', _m, mult - _pre);
  }
  // Deep Breath: ×pips while the clock is held. Pairs with every pause entity.
  if (hasTrick('deep_breath') && pipeTimerPaused) { const _pre = totalPips; totalPips = Math.round(totalPips * BAL.deep_breath.pip_mult); bPipX('deep_breath', BAL.deep_breath.pip_mult, totalPips - _pre); }
  // Interest: ×pips scaling with credits held, capped so a rich run can't run away.
  if (hasTrick('interest') && coins > 0) {
    const _m = Math.min(BAL.interest.max_pip_mult, 1 + Math.floor(coins / 10) * BAL.interest.pip_mult_per_10_credits);
    if (_m > 1) { const _pre = totalPips; totalPips = Math.round(totalPips * _m); bPipX('interest', _m, totalPips - _pre); }
  }
  // Portfolio: ×mult per card ON THE GRID carrying a permanent pip/mult buff - it
  // grows as the run invests in its deck, and shrinks as those cards cycle away.
  if (hasTrick('portfolio')) {
    let _buffed = 0;
    for (let _gr = 0; _gr < gridRows; _gr++) for (let _gc = 0; _gc < gridCols; _gc++) {
      const _cc = gridData[_gr]?.[_gc];
      if (!_cc || _cc._isSleight || _cc._isTrick || _cc._isStone) continue;
      const _k = cardId(_cc);
      if ((permPips[_k] || 0) > 0 || (permMult[_k] || 0) > 0) _buffed++;
    }
    if (_buffed > 0) {
      const _m = 1 + BAL.portfolio.mult_mult_per_card * _buffed;
      const _pre = mult; mult = Math.round(mult * _m * 10) / 10; bMultX('portfolio', _m, mult - _pre);
    }
  }
  // Redline: ×mult once the Focus multiplier is at or above its threshold.
  if (hasTrick('redline') && focusMultiplier() >= BAL.redline.focus_threshold) {
    const _pre = mult; mult = Math.round(mult * BAL.redline.mult_mult * 10) / 10; bMultX('redline', BAL.redline.mult_mult, mult - _pre);
  }
  // Phoenix: while paused, the Focus multiplier applies twice - handled at the Focus step below.
  // Mirror (Blueprint): duplicate each borrowed Trick's pip/mult contribution (incl. the multipliers above)
  mirroredTrickIds().forEach(mid => {
    if (_cp[mid]) { const _d = _cp[mid]; totalPips += _d; bPip('mirror', _d); }
    if (_cm[mid]) { const _d = _cm[mid]; mult += _d; bMult('mirror', _d); }
  });
  // Primed Tricks (Inspirato / Prime Times): a primed Trick fires its effect an extra time
  // per prime stack the hand it naturally contributes. Stacks are consumed in playHand.
  // _rank is a PERMANENT prime (Rehearsal event, r194): it fires the Trick an
  // extra time exactly as a prime stack does, but playHand's consumption block
  // only decrements _primed, so a rank never runs out. Reusing the prime loop is
  // what makes a Trick upgrade generic - it needs no code in any of the 177
  // Tricks, because it duplicates whatever pip/mult delta the Trick reported.
  if (trickTrayMode) trickTray.forEach(t => {
    const _extra = (t._primed || 0) + (t._rank || 0);
    if (_extra <= 0) return;
    const _pd = _cp[t.id] || 0, _md = _cm[t.id] || 0;
    if (!_pd && !_md) return;
    for (let k = 0; k < _extra; k++) { if (_pd) { totalPips += _pd; bPip('primed', _pd); } if (_md) { mult += _md; bMult('primed', _md); } }
  });
  // Double Take: each scored 2 duplicates your most recently acquired Trick's contribution
  if (hasTrick('twos_retrigger') && trickTrayMode) {
    const _t2 = cards.filter(c => c.rank === '2').length;
    if (_t2 > 0) {
      let _mr = null;
      for (let i = trickTray.length - 1; i >= 0; i--) { const _tk = trickTray[i]; if (_tk.id !== 'twos_retrigger' && _tk.id !== 'mirror') { _mr = _tk; break; } }
      if (_mr) { const _pd = _cp[_mr.id] || 0, _md = _cm[_mr.id] || 0; for (let k = 0; k < _t2; k++) { if (_pd) { totalPips += _pd; bPip('twos_retrigger', _pd); } if (_md) { mult += _md; bMult('twos_retrigger', _md); } } }
    }
  }

  // Move as One: if 3+ owned Tricks share a keyword (tag), the lowest-rarity Trick carrying a
  // qualifying keyword scores its effect a second time - reuses the priming contribution model
  // (re-adds that Trick's pip/mult delta this hand). TBD: like priming, only the SCORING portion of
  // the doubled Trick re-fires; its non-scoring side effects (Focus/pause/coins) don't.
  if (hasTrick('move_as_one') && trickTrayMode) {
    const _pool = trickTray.filter(t => t.id !== 'move_as_one' && t.id !== 'mirror' && Array.isArray(t.tags) && t.tags.length);
    const _tagCount = {};
    _pool.forEach(t => t.tags.forEach(tag => { _tagCount[tag] = (_tagCount[tag] || 0) + 1; }));
    const _qualTags = new Set(Object.keys(_tagCount).filter(tag => _tagCount[tag] >= 3));
    if (_qualTags.size) {
      const _RANK = { common:0, rare:1, epic:2, legendary:3, mythic:4 };
      let _best = null, _bestRank = 99;
      _pool.forEach(t => {
        if (!t.tags.some(tag => _qualTags.has(tag))) return;
        const _r = _RANK[t.tier] ?? 0;
        if (_r < _bestRank) { _bestRank = _r; _best = t; } // ties keep the earlier (older) Trick
      });
      if (_best) {
        const _pd = _cp[_best.id] || 0, _md = _cm[_best.id] || 0;
        if (_pd) { totalPips += _pd; bPip('move_as_one', _pd); }
        if (_md) { mult += _md; bMult('move_as_one', _md); }
      }
    }
  }

  // Feng Shui: did another position trick contribute pips/mult this hand? (snapshot for playHand)
  _lastHandPositionFired = POSITION_TRICK_IDS.some(id => (_cp[id] || 0) > 0 || (_cm[id] || 0) > 0);

  // 3. Base score
  const fMult = focusMultiplier();
  // Flow State: +10 pips per card scored while focus mult >= 1.5
  if (hasTrick('flow_state') && fMult >= 1.5) {
    // NOT a per-card payer, and this is the reason: its payment sits AFTER the
    // x pips block (it is grouped with the Focus step), so every other pip in the
    // hand has already been multiplied by Undertow / Scalper / Knave Power /
    // Interest by the time it lands and it escapes all of them. Paying it inside
    // a card's beat would put it in front of those multiplies and change the
    // score - measured at 459 pips on a hand worth 430. Moving its site up into
    // the additive region would let those multiply it, which is a balance
    // decision rather than an animation one.
    const _a = BAL.flow_state.pips_per_card * cards.length; totalPips += _a; bPip('flow_state', _a);
  }
  // Siphon (sleight): ×3 the whole mult, applied last so it multiplies every additive bonus.
  // Read-only here (not consumed) - playHand clears siphonMultX after the hand commits, so
  // findBestHand's candidate scoring sees it consistently.
  if (typeof siphonMultX === 'number' && siphonMultX > 1) {
    const _pre = mult; mult = Math.round(mult * siphonMultX * 10) / 10; _siphonM = mult - _pre;
    _ev('siphon', 'mult*', siphonMultX, 'sleight');
  }
  // Legacy (sleight): ×3 the whole mult. It used to be applied at SCORE level in
  // playHand, where the arithmetic was identical (s = pips × mult) but nothing on
  // screen said why the number jumped - the same legibility problem r190 fixed for
  // the four xSCORE Tricks. Read-only here; playHand clears the flag after the hand.
  if (typeof sleightLegacyMult !== 'undefined' && sleightLegacyMult) {
    const _pre = mult; mult = Math.round(mult * BAL.the_legacy.mult_x * 10) / 10; _legacyM = mult - _pre;
  }
  // Spot Check (reward-grid penalty): one hand type scores at half until you have
  // played it enough times to clear the flag.
  //
  // Applied to MULT, not at SCORE level, and that is the whole of the owner's
  // "I prefer the latter" - the two are the SAME arithmetic (s = totalPips x mult,
  // and Focus is a separate multiplier after both), so a x0.5 here is a x0.5 on
  // the final number, Focus included. What it buys is that the MULT chip visibly
  // halves, instead of the score quietly coming out wrong. See the r190 note in
  // CLAUDE.md: a new xSCORE needs a reason, and this one has none.
  if (typeof spotCheckHand !== 'undefined' && spotCheckHand && spotCheckLeft > 0 && handName === spotCheckHand) {
    const _pre = mult; mult = Math.round(mult * BAL.spot_check.mult * 10) / 10; _spotM = mult - _pre;
  }
  // MULT stays "pure" - Focus is a SEPARATE third multiplier applied at the end (see below).
  lastPreFocusMult = mult;   // kept for dance compatibility (now == pure mult)
  lastCalcMult = mult;       // pure mult for the MULT box
  lastCalcPips = totalPips;
  // focus multiplier for the FOCUS box - Phoenix (paused) applies it twice, so show the doubled value
  lastCalcFocus = (hasTrick('phoenix') && pipeTimerPaused && fMult > 1) ? fMult * 2 : fMult;

  if (totalPips < 0) totalPips = 0; // corrupt costs can't push a hand into score debt

  let s = totalPips * mult;

  // 4. x score multipliers
  // The Redaction (boss): one hand type, fixed for the round, is marked down.
  if (typeof bossRedactedHandMult === 'function') s *= bossRedactedHandMult(handName);
  // The Grind (boss): a hand type pays less every time you repeat it inside its
  // window. Read-only here; playHand is what pushes the history.
  if (typeof bossGrindMult === 'function') s *= bossGrindMult(handName);
  // Last Stand / Twenty-One / Perfect Storm / Extinction were ×score until r179. A ×score
  // fires AFTER lastCalcPips/lastCalcMult are read, so it never showed in the PIPS/MULT
  // chips - the number just changed. They are ×pips / ×mult now (identical arithmetic,
  // since s = totalPips × mult) and live in the multiplier block above.
  // Echoes: same hand type as the previous hand retriggers each card (handled in the per-card loop above).
  // Blackjack: raw face values total exactly 21
  // The Falcon: Focus-doubling while paused is handled in playHand's focus-generation block.
  // Shape bonuses
  // Hands of Blue (2×2) and Crossroads (+ shape) now add Focus in playHand; Stretch is a ×mult above.

  if (hasTrickCard) s *= 2;

  // Low and Behold (knack): a hand containing the grid's lowest rank replays whole (×2)
  if (hasKnack('low_and_behold')) {
    let _gmin = 99;
    for (let _gr = 0; _gr < gridRows; _gr++) for (let _gc = 0; _gc < gridCols; _gc++) {
      const _gc0 = gridData[_gr]?.[_gc];
      if (_gc0 && _gc0.rank && !_gc0._isSleight && !_gc0._isStone && !_gc0._isTrick) _gmin = Math.min(_gmin, _rankHigh(_gc0.rank));
    }
    if (_gmin < 99 && cards.some(c => _rankHigh(c.rank) === _gmin)) s *= 2;
  }

  // 5. Focus multiplier - separate third element, applied at the very end of the sequence
  if (fMult > 1) s *= fMult;
  // Phoenix: while the clock is paused, the Focus multiplier applies a second time
  if (hasTrick('phoenix') && pipeTimerPaused && fMult > 1) s *= fMult;

  // Push accumulated contrib entries (pip then mult, skip zeros)
  if (contrib !== null) {
    if (_cp) Object.entries(_cp).forEach(([id, d]) => { if (d > 0) contrib.push({type:'pip',source:'trick',id,delta:d}); });
    if (_cm) Object.entries(_cm).forEach(([id, d]) => { if (d > 0) contrib.push({type:'mult',source:'trick',id,delta:Math.round(d*10)/10}); });
    if (_ec.pips > 0) contrib.push({type:'pip',source:'exalt',id:'_exalt',delta:_ec.pips});
    if (_ec.mult > 0) contrib.push({type:'mult',source:'exalt',id:'_exalt',delta:Math.round(_ec.mult*10)/10});
    // Sleight scoring contribution: Amplifier's carried-over mult (folded into base mult above).
    // NOTE: Knacks and other Sleights are rule/resource/wildcard effects - they add no pips/mult
    // during scoring, so nothing else is attributable here. Any future scoring Knack/Sleight can
    // push {type,source:'knack'|'sleight',id,delta} and the dance will render it automatically.
    if (typeof sleightAmplifierMult === 'number' && sleightAmplifierMult > 0)
      contrib.push({type:'mult',source:'sleight',id:'amplifier',delta:Math.round(sleightAmplifierMult*10)/10});
    if (_whetM  > 0) contrib.push({type:'mult',source:'sleight',id:'whetstone', delta:Math.round(_whetM*10)/10});
    if (_entM   > 0) contrib.push({type:'mult',source:'sleight',id:'entourage', delta:Math.round(_entM*10)/10});
    if (_lightM > 0) contrib.push({type:'mult',source:'sleight',id:'lighthouse',delta:Math.round(_lightM*10)/10});
    if (_siphonM > 0) contrib.push({type:'mult',source:'sleight',id:'siphon',    delta:Math.round(_siphonM*10)/10});
    if (_legacyM > 0) contrib.push({type:'mult',source:'sleight',id:'the_legacy',delta:Math.round(_legacyM*10)/10});
    if (_spotM < 0) contrib.push({type:'mult',source:'penalty',id:'spot_check',delta:Math.round(_spotM*10)/10});
  }

  // Finalize the animation ledger. The per-card MULT list that used to be
  // hand-written here is gone: those Tricks are summed inside the card loop now,
  // so they are already on the timeline in the right place, for every id rather
  // than the six this list happened to name.
  if (ledger && _ledgerCells) {
    ledger.cards = _ledgerCells;
    ledger.timeline = _tl;
    // What the boxes must read once every event has played. The dance replays the
    // timeline against its own running chips and then asserts against these, so a
    // drift shows up as a visible snap rather than as a wrong number.
    ledger.finalPips = lastCalcPips;
    ledger.finalMult = lastCalcMult;
    // The base the dance seeds its chips with. Layered hands (r2xx) contribute a
    // second hand's worth of base pips and mult directly, with no ledger call, so
    // they belong HERE rather than as events - they are part of what the hand is
    // worth before anything fires.
    ledger.basePips  = Math.round(handBasePips(handName) * levelScale)
                     + _extraLayers.reduce((a, h) => a + Math.round(handBasePips(h) * levelScale), 0);
    ledger.baseMult  = handBaseMult(handName, _scoreCells.length) + sleightAmplifierMult
                     + _extraLayers.reduce((a, h) => a + handBaseMult(h, _scoreCells.length), 0);
  }

  return Math.round(s);
}

// ══════════════════════════════════════════════
// PER-ROUND CONTRIBUTION TALLY (Payout > Contributions tab)
// Reuses calcScore's built-in `contrib` output (per-Trick + exalt pip/mult
// deltas) - no separate scoring math, so it can't drift from the real score.
// ══════════════════════════════════════════════
function contribDisplayName(source, id) {
  if (source === 'exalt') return 'Exalt / Corrupt';
  // Sleight/knack-sourced rows resolve against their own pools (Tricks are the default).
  if (source === 'sleight') return SLEIGHT_POOL.find(s => s.id === id)?.name || id;
  if (source === 'knack')   return KNACK_POOL.find(k => k.id === id)?.name || id;
  const def = TRICK_POOL.find(t => t.id === id);
  return def ? def.name : id;
}

// Credits granted BY AN ENTITY during a round. Coins are handed out from a dozen
// scattered sites (`coins += ...`) and none of them were reaching the payout's
// Contributions tab, which only ever tallied pips and mult - so a Trick whose whole
// job is paying credits showed up nowhere in the round's breakdown.
// One call adds the credits AND records who paid them.
function grantEntityCoins(amount, source, id) {
  const n = Math.round(amount || 0);
  if (!n) return;
  coins += n;
  if (typeof updateCoinsUI === 'function') updateCoinsUI();
  foldContribution(contribDisplayName(source, id), 'coin', n);
}

function foldContribution(label, kind, amount) {
  if (!amount) return;
  const key = label + '|' + kind;
  let e = roundContributions[key];
  if (!e) e = roundContributions[key] = { label, kind, amount: 0, count: 0 };
  e.amount += amount;
  e.count++;
}

// Snapshot a hand's contribution rows from PRISTINE state (call early in playHand,
// before per-hand mutations like Ripple cooldown / Snowball permPips change the
// numbers). Returns rows to fold later; does not touch the tally yet.
function captureRoundContrib(result) {
  if (!result) return null;
  const { hand, handCells } = result;
  const rows = [];
  // Bonus-entity contributions (Tricks + exalt) straight from calcScore.
  const contrib = [];
  calcScore(hand, handCells, contrib);
  contrib.forEach(e => rows.push({ label: contribDisplayName(e.source, e.id), kind: e.type, amount: e.delta }));
  // Base + raw card pips (everything not attributed to a bonus entity).
  const base = HAND_BASE[hand];
  if (base) {
    const levelScale = Math.pow(1.1, level - 1);
    // A layered hand pays every family's base, so the breakdown has to count them
    // all or it reports less base than calcScore actually used (see calcScore).
    const _layers = (typeof handLayersFor === 'function') ? handLayersFor(hand, handCells) : [hand];
    // Drop ONE entry by name (the component that named the hand), not every entry
    // matching it - two Sets of 3 must still be counted twice. If the name is not
    // a component at all, count none of them (same guard as calcScore).
    const _di = _layers.indexOf(hand);
    const _extra = _di >= 0 ? _layers.slice(0, _di).concat(_layers.slice(_di + 1)) : [];
    let cardPipsTotal = Math.round(handBasePips(hand) * levelScale);
    _extra.forEach(h => { if (HAND_BASE[h]) cardPipsTotal += Math.round(handBasePips(h) * levelScale); });
    handCells.forEach(([r, c]) => { const card = gridData[r]?.[c]; if (card?.rank) cardPipsTotal += cardPips(card.rank); });
    rows.push({ label: 'Base + card pips', kind: 'pip', amount: cardPipsTotal });
    // Base MULT from the hand type (calcScore seeds mult from handBaseMult). It's
    // the starting multiplier every trick adds onto, so surface it in Mult too.
    let _bm = handBaseMult(hand, handCells.length);
    _extra.forEach(h => { if (HAND_BASE[h]) _bm += handBaseMult(h, handCells.length); });
    if (_bm) rows.push({ label: _extra.length ? 'Base (' + _layers.join(' + ') + ')' : 'Base (hand type)', kind: 'mult', amount: _bm });
  }
  return rows;
}

// Fold a captured snapshot into the round tally (call once, at a commit point).
function commitRoundContrib(rows) {
  if (!rows) return;
  roundHandsScored++;
  rows.forEach(r => foldContribution(r.label, r.kind, r.amount));
}

function fmtContribution(e) {
  const r1 = n => (Math.round(n * 10) / 10);
  switch (e.kind) {
    case 'pip':  return `+${Math.round(e.amount)} pips`;
    case 'mult': return `+${r1(e.amount)} mult`;
    case 'coin': return `${e.amount >= 0 ? '+' : ''}${Math.round(e.amount)} credits`;
    default:     return String(e.amount);
  }
}

// Build the per-round contribution breakdown as HTML rows, grouped by kind.
function roundContributionRowsHTML() {
  const entries = Object.values(roundContributions);
  if (!entries.length || roundHandsScored === 0) {
    return `<div class="contrib-empty">No hands scored this round.</div>`;
  }
  let html = '';
  [{ kind: 'pip', title: 'Pips' }, { kind: 'mult', title: 'Mult' }, { kind: 'coin', title: 'Credits' }].forEach(g => {
    const rows = entries.filter(e => e.kind === g.kind).sort((a, b) => b.amount - a.amount);
    if (!rows.length) return;
    html += `<div class="contrib-group-title">${g.title}</div>`;
    rows.forEach(e => {
      const note = e.count > 1 ? `<span class="contrib-count">${e.count} hands</span>` : '';
      html += `<div class="contrib-row">
        <span class="contrib-label">${withSuitHalo(e.label)}${note}</span>
        <span class="contrib-val contrib-${e.kind}">${fmtContribution(e)}</span>
      </div>`;
    });
  });
  // Effects group - replays/retriggers and clock manipulation, shown ONLY when they
  // actually happened this round (owner request).
  const _timeManip = (timeManipRound || 0) + (rewoundSecondsRound || 0) + (pausedSecondsRound || 0);
  const fxRows = [];
  if (replaysThisRound > 0) fxRows.push({ label: 'Replays', val: `×${replaysThisRound}` });
  if (_timeManip > 0)       fxRows.push({ label: 'Time manipulation', val: `+${_timeManip}s` });
  if (fxRows.length) {
    html += `<div class="contrib-group-title">Effects</div>`;
    fxRows.forEach(r => {
      html += `<div class="contrib-row">
        <span class="contrib-label">${r.label}</span>
        <span class="contrib-val contrib-fx">${r.val}</span>
      </div>`;
    });
  }
  return html;
}

function hasTrick(id) {
  if (isTrickDisabledByBoss(id)) return false;
  if (typeof entitySuspended === 'function' && entitySuspended('trick', id)) return false;
  if (trickTrayMode && trickTray.some(b => b.id === id)) return true;
  // gridData?.[r] - the grid is empty between screens (menu, Builds, mid-deal), and
  // a stray timer tick landing there would otherwise throw on gridData[r][c].
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++) {
      const cell = gridData?.[r]?.[c];
      if (cell?._isTrick && cell.trick?.id === id) return true;
    }
  return false;
}
// For dedup only - checks acquiredTricks (Trick was ever granted, may not be on grid)
function ownsTrick(id) { return acquiredTricks.some(b => b.id === id); }
function hasKnack(id) {
  if (typeof entitySuspended === 'function' && entitySuspended('knack', id)) return false;
  return acquiredKnacks.some(t => t.id === id);
}
// Mirror Trick: borrows the effect of the tray Trick on its tilted side (-1 left / +1 right).
// Mirror Trick (Blueprint-style): ids of tray Tricks currently borrowed by a Mirror - the
// neighbour on its tilted side (-1 left / +1 right). Each borrowed trick's pip/mult
// contribution this hand is duplicated in calcScore. Multiple Mirrors stack.
function mirroredTrickIds() {
  const ids = [];
  if (!trickTrayMode) return ids;
  for (let i = 0; i < trickTray.length; i++) {
    const t = trickTray[i];
    if (t.id !== 'mirror') continue;
    const dir = (t._lockedDir != null) ? t._lockedDir : t._tiltDir;
    if (!dir) continue;
    const n = trickTray[i + dir];
    if (!n || n.id === 'mirror') continue;
    ids.push(n.id);
  }
  return ids;
}

// How many times a Trick's NON-SCORE effect should land this hand: 1 for owning it,
// plus one per prime stack, per permanent rank (Rehearsal), and per Mirror aimed at it.
//
// The pip/mult path already does this - calcScore keeps a per-Trick ledger (_cp/_cm)
// and replays a Trick's recorded delta once per extra firing, which is what makes an
// upgrade generic across all 177 Tricks with no code in any of them. That ledger can
// only carry pips and mult, so ~71 Tricks that pay in Focus, clock seconds, credits,
// swaps or discards fired exactly once no matter how many times they were duplicated:
// a rehearsed Tick-Tock or a mirrored Deluge did nothing at all. This is the same
// count, for the effects the ledger cannot carry.
//
// It returns 0 when the Trick is not owned or a boss has switched it off, so it stands
// in for the hasTrick() test at the call site rather than sitting beside it - the
// effect is multiplied by 0 and never lands. Every caller must therefore be an amount
// being granted, never a flag being set or a tally being kept.
function trickFires(id) {
  if (!hasTrick(id)) return 0;
  let n = 1;
  if (trickTrayMode) {
    const t = trickTray.find(b => b.id === id);
    if (t) n += (t._primed || 0) + (t._rank || 0);
    n += mirroredTrickIds().filter(m => m === id).length;
  }
  return n;
}

// Returns all row/col bonus entries matching this card position
function getRowColBonusesForCell(r, c) {
  return rowColBonuses.filter(b => (b.axis === 'row' && b.index === r) || (b.axis === 'col' && b.index === c));
}

function cellHasRowColBonus(r, c, id) {
  return rowColBonuses.some(b => b.id === id && ((b.axis === 'row' && b.index === r) || (b.axis === 'col' && b.index === c)));
}

// A cell sits at the intersection of two grid effects if some trick marks its row AND some trick marks its column.
function isEffectIntersection(r, c) {
  return rowColBonuses.some(b => b.axis === 'row' && b.index === r) &&
         rowColBonuses.some(b => b.axis === 'col' && b.index === c);
}

// Once-per-minute gate (round-time minutes). Rewind (task #10) will re-arm these by re-crossing
// minute boundaries. Returns true (and marks fired) at most once per whole round-minute per id.
function firesThisMinute(id) {
  const minute = Math.floor((roundStartSeconds - roundSeconds) / 60);
  if (_perMinuteFired[id] === minute) return false;
  _perMinuteFired[id] = minute;
  return true;
}

// ── Position-mark assignment (r102) ─────────────────────────────────────────
// Every "position Trick" marks one grid line (a row or column). Which line it gets
// is steered by the position knacks: Surveyor (you pick a column), Leveler (you pick a
// row), Alignment (auto column = tray slot), District (allow >1 effect on the same line).
// A manual chooser (Surveyor/Leveler) always beats Alignment. Assignment is idempotent
// per Trick object so an upgrade (selectTrick called twice) doesn't re-roll the line.
const POSITION_ASSIGN_IDS = ['rowcol_triple_pips','rowcol_mult','rowcol_retrigger','perfect_timing','right_time','groove','assembly_line','overtime'];

// Keep every marked line on a line that EXISTS. Growing the board needs nothing
// - the index is a stored number and a wider board simply has more columns past
// it - but shrinking one can leave a Trick marking a column that is no longer
// there, and a mark on nothing is a Trick that silently stopped working.
// A shrunk-past line moves to the highest line that exists and STAYS there; it
// does not remember where it was. That is lossy on purpose - the alternative is
// carrying a shadow index that could resurface on a board the player has since
// rebuilt differently.
//
// IT MEASURES AGAINST THE LIMITS, NOT AGAINST gridRows / gridCols, and that is
// the whole reason it is safe to call. Four things move the live board size
// TEMPORARILY and put it back: Short Staffed shrinks it for one round
// (js/level-up.js), the on-grid shop forces 4x4, a prize grid is two smaller
// than the play board, and Dominoes sets its own. Clamping against the live
// globals would let any of those permanently move a line the player's real
// board still has room for - a one-round penalty would cost a Trick its
// position for the rest of the run. The limit is the only number that means
// "this board will never be this wide again"; everything that merely borrows
// the board at a smaller size clamps what it DRAWS instead (renderLineMarkers,
// js/entity-fx.js) and leaves the registry alone.
function clampRowColBonuses() {
  if (typeof rowColBonuses === 'undefined' || !rowColBonuses.length) return;
  if (typeof limits === 'undefined' || !limits.grid_rows || !limits.grid_cols) return;
  rowColBonuses.forEach(b => {
    const span = b.axis === 'row' ? limits.grid_rows.current : limits.grid_cols.current;
    const max  = Math.max(0, span - 1);
    if (b.index <= max) return;
    // finalizePositionMark rewrites the Trick's printed description to name the
    // line, so moving the mark without it would leave the tray quoting a row
    // that is not there any more.
    if (b._trickRef) finalizePositionMark(b._trickRef, b.axis, max);
    else b.index = max;
  });
}

function lineOccupied(axis, index) {
  return rowColBonuses.some(b => b.axis === axis && b.index === index);
}
// Random line over the given axes, preferring an unoccupied one unless District is owned.
function pickDefaultLine(axes, district) {
  const cands = [];
  axes.forEach(axis => { const n = axis === 'row' ? gridRows : gridCols; for (let i = 0; i < n; i++) cands.push({ axis, index: i }); });
  let pool = cands;
  if (!district) { const free = cands.filter(c => !lineOccupied(c.axis, c.index)); if (free.length) pool = free; }
  return pool[Math.floor(Math.random() * pool.length)];
}
// Walk forward (wrapping) from start to the first unoccupied index on this axis.
function firstFreeAlong(axis, start) {
  const n = axis === 'row' ? gridRows : gridCols;
  for (let k = 0; k < n; k++) { const i = (start + k) % n; if (!lineOccupied(axis, i)) return i; }
  return start;
}
// Commit a Trick's marked line: refresh its registry entry + rewrite its description.
function finalizePositionMark(trick, axis, index) {
  if (trick._posDescBase == null) trick._posDescBase = trick.desc; // capture placeholder desc once
  rowColBonuses = rowColBonuses.filter(b => b._trickRef !== trick);  // one line per Trick object
  rowColBonuses.push({ id: trick.id, axis, index, _trickRef: trick });
  trick._posAxis = axis; trick._posIndex = index;
  const label = `${axis} ${index + 1}`;
  trick.desc = trick._posDescBase
    .replace('a specific row or column', label)
    .replace('a marked row or column', label)
    .replace('a specific grid intersection', `(${label})`);
  if (typeof updateTrickList === 'function') updateTrickList();
  if (typeof renderTrickTray === 'function') renderTrickTray();
  // Draw the line it just claimed, with an arrival sweep down the board, so the
  // grant is visibly attached to a line instead of being a registry write and a
  // rewritten tooltip (js/entity-fx.js). The line then stays for the run.
  if (typeof animateLineGrant === 'function') animateLineGrant(trick);
}
// Decide (and, for manual choosers, prompt for) a position Trick's line at pick time.
function assignPositionMark(trick) {
  if (!POSITION_ASSIGN_IDS.includes(trick.id)) return;
  if (trick._posAssigned) return;                 // idempotent (upgrade calls selectTrick twice)
  trick._posAssigned = true;
  const district = hasKnack('district');
  const axes = [];
  if (hasKnack('leveler'))  axes.push('row');
  if (hasKnack('surveyor')) axes.push('col');
  if (axes.length) {                              // manual chooser wins over Alignment
    const prov = pickDefaultLine(axes, district); // provisional so state is always valid
    finalizePositionMark(trick, prov.axis, prov.index);
    queuePositionChooser(trick, axes, district);
    return;
  }
  if (hasKnack('alignment')) {                    // auto: column = tray slot (wraps), else next free col
    let slot = trickTray.indexOf(trick); if (slot < 0) slot = trickTray.length;
    let index = ((slot % gridCols) + gridCols) % gridCols;
    if (!district) index = firstFreeAlong('col', index);
    finalizePositionMark(trick, 'col', index);
    return;
  }
  const prov = pickDefaultLine(['row', 'col'], district); // default: random (spreads unless District)
  finalizePositionMark(trick, prov.axis, prov.index);
}

// ── Surveyor / Leveler line-chooser overlay ─────────────────────────────────
let _posChooserQueue = [];
let _posChooserActive = false;
function queuePositionChooser(trick, axes, district) {
  _posChooserQueue.push({ trick, axes, district });
  if (!_posChooserActive) showNextPositionChooser();
}
function showNextPositionChooser() {
  const existing = document.getElementById('pos-chooser'); if (existing) existing.remove();
  if (!_posChooserQueue.length) { _posChooserActive = false; return; }
  _posChooserActive = true;
  const { trick, axes, district } = _posChooserQueue.shift();
  // If District is off but every other line is already taken, don't dead-end the modal.
  const anyFree = axes.some(axis => { const n = axis === 'row' ? gridRows : gridCols;
    for (let i = 0; i < n; i++) if (!rowColBonuses.some(x => x._trickRef !== trick && x.axis === axis && x.index === i)) return true; return false; });
  const allowAll = district || !anyFree;

  const ov = document.createElement('div');
  ov.id = 'pos-chooser';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.82);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:\'Crimson Pro\',serif;';
  const axisWords = axes.map(a => a === 'row' ? 'row' : 'column').join(' or ');
  const title = document.createElement('div');
  title.style.cssText = 'color:var(--gold);font-size:17px;text-align:center;max-width:320px;line-height:1.4;';
  title.innerHTML = `${trick.emoji || '📍'} <b>${trick.name}</b><br><span style="color:#cdb56a;font-size:12px;">Choose the ${axisWords} it marks</span>`;
  ov.appendChild(title);

  axes.forEach(axis => {
    const n = axis === 'row' ? gridRows : gridCols;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:340px;';
    if (axes.length > 1) { const lab = document.createElement('div'); lab.textContent = axis === 'row' ? 'Rows' : 'Columns'; lab.style.cssText = 'color:#cdb56a;font-size:11px;width:100%;text-align:center;'; row.appendChild(lab); }
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.textContent = (axis === 'row' ? 'R' : 'C') + (i + 1);
      const takenByOther = rowColBonuses.some(x => x._trickRef !== trick && x.axis === axis && x.index === i);
      const blocked = takenByOther && !allowAll;
      const current = trick._posAxis === axis && trick._posIndex === i; // provisional default
      b.disabled = blocked;
      b.style.cssText = `min-width:42px;padding:8px 10px;border-radius:8px;font-size:13px;`
        + (blocked ? 'border:1px solid #444;background:rgba(60,60,60,0.4);color:#666;cursor:not-allowed;'
          : `border:2px solid ${current ? 'var(--gold)' : 'rgba(201,168,76,0.5)'};background:rgba(201,168,76,${current ? '0.28' : '0.13'});color:var(--gold);cursor:pointer;`);
      if (!blocked) b.onclick = () => { finalizePositionMark(trick, axis, i); if (typeof showMessage === 'function') showMessage(`${trick.name} → ${axis} ${i + 1}`, 'var(--gold)'); showNextPositionChooser(); };
      row.appendChild(b);
    }
    ov.appendChild(row);
  });

  const hint = document.createElement('div');
  hint.textContent = 'Click outside to keep the highlighted default';
  hint.style.cssText = 'color:#8a7a3a;font-size:10px;';
  ov.appendChild(hint);
  ov.addEventListener('click', e => { if (e.target === ov) showNextPositionChooser(); }); // keep provisional
  document.body.appendChild(ov);
}

// ══════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════
