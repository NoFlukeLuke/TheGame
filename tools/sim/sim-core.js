// ── Runs INSIDE the game vm context. Method-2 Monte Carlo bot. ──
// A greedy bot plays whole runs: real deck, real detectHand/calcScore, real
// entity pools & luck tables, real focus generation & natural scaling.
// Modeled away: bosses' modifiers, reward-grid debuffs, swaps, the shop economy
// (a shop visit = 1 entity), and animation/timing (a hand takes SIM_CFG.handTime
// seconds of clock, clock-mark tricks fire per simulated second).

var SIM_CFG = {
  handTime: 15,          // seconds of round clock per played hand (bot skill knob)
  candK: 6,              // subsets fully scored per decision
  maxSubset: 5,
};

// r683: no run is a walkthrough. A mode's first run pins the walkthrough's seed
// (tutorialRunSeed), so the first run of every batch was the same deal.
if (typeof SETTINGS !== 'undefined') SETTINGS.walkthrough = false;

// connected subsets of live cells, sizes 2..maxSize (bitmask enumeration)
function SIM_connectedSubsets(maxSize) {
  const cells = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r] && gridData[r][c];
    if (!card) continue;
    if (card._isStone) continue;
    if (typeof isCellBlocked === 'function' && isCellBlocked(r, c)) continue;
    cells.push([r, c]);
  }
  const n = cells.length;
  const idxOf = new Map(cells.map((rc, i) => [rc[0] * 100 + rc[1], i]));
  const adj = cells.map(([r, c]) => {
    const out = [];
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const j = idxOf.get((r + dr) * 100 + (c + dc));
      if (j !== undefined) out.push(j);
    }
    return out;
  });
  // r683: masks are sums of powers of two, exact up to 53 cells. `1 << i` wrapped
  // past 31, so a board over 31 cells (6x6 and up) found the wrong shapes. A set
  // already expanded is skipped, so each one grows once.
  const P2 = cells.map((_, i) => Math.pow(2, i));
  const seen = new Set();
  const out = [];
  const stack = [];
  for (let i = 0; i < n; i++) stack.push([P2[i], [i]]);
  while (stack.length) {
    const [mask, mem] = stack.pop();
    if (seen.has(mask)) continue;
    seen.add(mask);
    if (mem.length >= 2) out.push(mem);
    if (mem.length >= maxSize) continue;
    for (const i of mem) for (const j of adj[i]) {
      if (mem.includes(j)) continue;
      const nm = mask + P2[j];
      if (!seen.has(nm)) stack.push([nm, mem.concat([j])]);
    }
  }
  return out.map(mem => mem.map(i => cells[i]));
}

function SIM_bestHand() {
  const maxSel = Math.min(SIM_CFG.maxSubset, (limits.selection && limits.selection.current) || 5);
  // (subset cap is a perf guard; selection upgrades widen the search up to it)
  const minSel = (typeof minSelection === 'function') ? Math.min(minSelection(), maxSel) : 2;
  const subs = SIM_connectedSubsets(maxSel);
  const cand = [];
  for (const cells of subs) {
    if (cells.length < Math.max(2, minSel)) continue;
    let ok = true;
    for (const [r, c] of cells) {
      const card = gridData[r][c];
      if (!card || (typeof cardCan === 'function' && !cardCan(card, 'select'))) { ok = false; break; }
    }
    if (!ok) continue;
    const hand = detectHand(cells);
    if (!hand || hand === 'High Card') continue;
    let pips = 0;
    for (const [r, c] of cells) { const cd = gridData[r][c]; pips += (cd && !cd._isSleight) ? cardPips(cd.rank) : 0; }
    const base = (typeof handBasePips === 'function' ? handBasePips(hand) : 0) *
                 Math.max(1, typeof handBaseMult === 'function' ? handBaseMult(hand) : 1);
    cand.push({ cells, hand, pri: base + pips * 3 });
  }
  if (!cand.length) return null;
  cand.sort((a, b) => b.pri - a.pri);
  let best = null;
  for (const c of cand.slice(0, SIM_CFG.candK)) {
    let s = 0;
    try { s = calcScore(c.hand, c.cells); } catch (e) { continue; }
    if (!best || s > best.score) best = { ...c, score: s };
  }
  return best;
}

function SIM_removeAndRefill(cells) {
  for (const [r, c] of cells) {
    const card = gridData[r][c];
    if (card) { try { discardToPlayed(card); } catch (e) {} gridData[r][c] = null; }
  }
  // gravity per column then refill from the draw pile
  for (let c = 0; c < gridCols; c++) {
    const col = [];
    for (let r = gridRows - 1; r >= 0; r--) if (gridData[r][c]) col.push(gridData[r][c]);
    let r = gridRows - 1;
    for (const card of col) { gridData[r][c] = card; r--; }
    for (; r >= 0; r--) {
      let card = null;
      try { card = drawCard(); } catch (e) {}
      gridData[r][c] = card || null;
    }
  }
}

// r683: the deck runs dry mid-round (no mid-round reshuffle since r507) and the
// game deals the Reshuffle card (js/reshuffle-card.js): played cards back into the
// deck, every hole refilled, Starting Time cut for LATER rounds. The bot takes it
// when the board is stuck or under half full. Without it every round that drew
// the deck out stalled with time on the clock, and that was nearly every death.
function SIM_tryReshuffle(stuck) {
  if (drawPile.length || !playedPile.some(c => c && !c._temp)) return false;
  let cards = 0, holes = 0;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    if (typeof isCellVoid === 'function' && isCellVoid(r, c)) continue;
    if (gridData[r][c]) cards++;
    else if (!(typeof isCellBlocked === 'function' && isCellBlocked(r, c))) holes++;
  }
  if (!holes || cards >= RESHUFFLE_BOARD_MAX) return false;
  if (!stuck && cards * 2 >= cards + holes) return false;
  const lt = limits.round_time, cut = Math.min(RESHUFFLE_CAP_CUT, lt.current - (lt.min || 0));
  if (cut <= 0) return false;
  lt.current -= cut;
  flushPlayedDeck();
  SIM_removeAndRefill([]);
  return true;
}

function SIM_spend(secs) {
  // burn clock while firing clock marks per second; honours mark-driven rewinds
  let clock = roundSeconds;
  for (let s = 0; s < secs && clock > 0; s++) {
    clock--; roundSeconds = clock;
    try { handleClockMarks(clock); } catch (e) {}
    clock = roundSeconds;
  }
  return clock;
}

// one round; assumes score already holds any carry-over, roundGoal/roundSeconds set
function SIM_playRound() {
  let clock = roundSeconds;
  let hands = 0, dry = 0, dryActs = 0, fmSum = 0, reshuffles = 0;
  roundStartSeconds = clock;
  let decayMs = (typeof focusDecayIntervalMs === 'number' && focusDecayIntervalMs > 0) ? focusDecayIntervalMs : 2000;
  while (clock > 0 && score < roundGoal) {
    let best = SIM_bestHand();
    if (SIM_tryReshuffle(!best)) { reshuffles++; clock = SIM_spend(2); continue; }   // double-tap + the refill
    if (!best) {
      // no hand: try a hand-making swap, then a discard, else burn scan time
      let acted = false;
      if (swaps > 0 && typeof tutorialFindSwap === 'function') {
        let sw = null;
        try { sw = tutorialFindSwap(); } catch (e) {}
        if (sw) {
          const [[r1, c1], [r2, c2]] = sw.pair;
          const a = gridData[r1][c1]; gridData[r1][c1] = gridData[r2][c2]; gridData[r2][c2] = a;
          swaps--; clock = SIM_spend(8 + 4); acted = true;
        }
      }
      if (!acted && discards > 0) {
        discards--;
        const live = [];
        for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++)
          if (gridData[r][c] && !gridData[r][c]._isSleight && !gridData[r][c]._isStone) live.push([r, c]);
        live.sort((a, b) => cardPips(gridData[a[0]][a[1]].rank) - cardPips(gridData[b[0]][b[1]].rank));
        SIM_removeAndRefill(live.slice(0, 3));
        clock = SIM_spend(9 + 4); acted = true;
      }
      if (!acted) clock = SIM_spend(6);
      dryActs++;
      if (++dry > 10) break;
      continue;
    }
    dry = 0;
    clock = SIM_spend(SIM_CFG.handTime);
    if (clock <= 0 || score >= roundGoal) break;
    lastHandTime = Date.now() - SIM_CFG.handTime * 1000;
    try { generateHandFocus(best.hand, best.cells, 0); } catch (e) {}
    // focus decay over the hand's think-time
    focusNodes = Math.max(0, focusNodes - Math.floor(SIM_CFG.handTime * 1000 / decayMs / 2));
    try { fmSum += focusMultiplier(); } catch (e) {}
    let s = 0;
    try { s = calcScore(best.hand, best.cells); } catch (e) {}
    score += s;
    hands++; handsPlayed++; handsPlayedRound++;
    try { recordNaturalScale(best.hand, best.cells); } catch (e) {}
    SIM_removeAndRefill(best.cells);
    clock = roundSeconds;
  }
  return { cleared: score >= roundGoal, score, hands, timeLeft: Math.max(0, clock),
    dryActs, reshuffles, stalled: dry > 10, avgFocus: hands ? +(fmSum / hands).toFixed(2) : 1, scorePct: +(score / Math.max(1, roundGoal) * 100).toFixed(0) };
}

// ── entity grants ──
var SIM_TIER_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
function SIM_bestOf(picker, n) {
  let best = null;
  for (let i = 0; i < n; i++) {
    const p = picker();
    if (!p) continue;
    const r = SIM_TIER_RANK[p.tier || p.rarity || 'common'] || 0;
    if (!best || r > best.r) best = { p, r };
  }
  return best && best.p;
}
function SIM_improveRandomOwned() {
  try {
    const cands = [];
    for (const t of ['trick','knack','sleight']) {
      const list = (typeof ownedImprovable === 'function') ? ownedImprovable(t) : [];
      for (const e of list) cands.push(e);
    }
    if (!cands.length) return false;
    const e = cands[Math.floor(Math.random() * cands.length)];
    improveEntity(e.id || e);
    return true;
  } catch (err) { return false; }
}
function SIM_grant(type, bestOfN) {
  try {
    if (type === 'trick') {
      const owned = new Set(trickTray.map(t => t.id));
      const pool = TRICK_POOL.filter(t => !owned.has(t.id) &&
        !(typeof survivalEntityBanned === 'function' && survivalEntityBanned(t.id)));
      if (!pool.length) return false;
      const pick = SIM_bestOf(() => pickTrickByRarity(pool), bestOfN || 1);
      if (!pick) return false;
      if (trickTray.length >= trickCapacity()) return false;
      injectTrickAfterReward({ ...pick });
      return true;
    }
    if (type === 'knack') {
      const owned = new Set(acquiredKnacks.map(k => k.id));
      const pool = KNACK_POOL.filter(k => !owned.has(k.id) &&
        !(typeof survivalEntityBanned === 'function' && survivalEntityBanned(k.id)));
      if (!pool.length) return false;
      const pick = SIM_bestOf(() => pickKnackByRarity(pool), bestOfN || 1);
      if (!pick) return false;
      acquiredKnacks.push({ ...pick });
      try { updateKnackList(); } catch (e) {}
      return true;
    }
    if (type === 'sleight') {
      const pool = SLEIGHT_POOL.filter(s => (typeof sleightOfferable !== 'function' || sleightOfferable(s)) &&
        !(typeof survivalEntityBanned === 'function' && survivalEntityBanned(s.id)));
      if (!pool.length) return false;
      const pick = SIM_bestOf(() => pickEntityByRarity(pool, b => b.rarity || 'common'), bestOfN || 1);
      if (!pick) return false;
      grantSleight(pick);
      return true;
    }
    if (type === 'limit') {
      // a competent player prioritises the growth limits
      const pref = ['selection','grid_rows','grid_cols','round_time','swaps','discards','focus_cap','trick_slots','luck'];
      const ids = LIMITS_DEF.map(d => d.id).filter(id => typeof limitCanIncrement !== 'function' || limitCanIncrement(id));
      if (!ids.length) return false;
      let pick = null;
      if (Math.random() < 0.75) { for (const p of pref) if (ids.includes(p)) { pick = p; break; } }
      if (!pick) pick = ids[Math.floor(Math.random() * ids.length)];
      incrementLimit(pick);
      return true;
    }
  } catch (e) { return false; }
  return false;
}
function SIM_grantWeighted(w, bestOfN) {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [k, v] of Object.entries(w)) { roll -= v; if (roll <= 0) return SIM_grant(k, bestOfN); }
  return false;
}

// Manual level-up: bank score, bump level, set next goal from the schedule fn.
// r683: does what triggerLevelUp (js/level-up.js) does to the next round's
// resources, which the sim had skipped: the board takes the Grid Rows / Columns
// limits, swaps / discards / seconds come from computeRoundResources (its result
// was thrown away, so stock never refilled and Starting Time never counted),
// Focus resets, and Flow keeps its session clock (flowNextRoundSeconds). No mode
// carries the score over the goal since r441. Not run: individual Tricks'
// level-up hooks (Rising Tide, Life Lessons...), payouts, events.
function SIM_levelUp(goalFn) {
  totalScore += Math.min(score, roundGoal);
  level++;
  score = 0;
  roundGoal = goalFn(level);
  gridRows = limits.grid_rows.current;
  gridCols = limits.grid_cols.current;
  try { flushPlayedDeck(); } catch (e) {}
  const rr = computeRoundResources();
  swaps = rr.swaps; discards = rr.discards;
  roundSeconds = (typeof flowActive === 'function' && flowActive()) ? flowNextRoundSeconds(roundSeconds) : rr.seconds;
  try { resetFocusMeter(); recomputeFocusDecayInterval(); } catch (e) {}
  try { initGridData(); } catch (e) {}
}

function SIM_diag(res) {
  return { hands: res.hands, dryActs: res.dryActs, avgFocus: res.avgFocus, scorePct: res.scorePct,
    reshuffles: res.reshuffles, stalled: res.stalled ? 1 : 0 };
}

// ── full runs per mode. goalFn(level) -> goal. Returns {win, diedLevel, log} ──
function SIM_runClassic(goalFn, quarters) {
  ACTIVE_MODE = MODES.normal; startGame();
  roundGoal = goalFn(1);
  let gridsSeen = 0;
  for (let q = 1; q <= quarters; q++) {
    for (let node = 1; node <= 6; node++) {
      const isBoss = node === 6;
      const res = SIM_playRound();
      if (!res.cleared) return { win: false, diedLevel: level, boss: isBoss, diag: SIM_diag(res) };
      // between rounds: reward grid (2 draws + early-run guaranteed limit); boss pays prize grid (2 rare+)
      gridsSeen++;
      if (isBoss) {
        SIM_grantWeighted({ trick: 60, knack: 20, sleight: 20 });
        SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 });
      } else {
        SIM_grantWeighted({ trick: 55, knack: 15, sleight: 10, limit: 20 });
        SIM_grantWeighted({ trick: 55, knack: 15, sleight: 10, limit: 20 });
        if (gridsSeen <= 5) SIM_grant('limit');
        if (node === 2 || node === 4) { SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 }); SIM_improveRandomOwned(); }
      }
      SIM_levelUp(goalFn);
    }
  }
  return { win: true, diedLevel: level };
}

function SIM_runSchedule(goalFn, quarters, bossMult) {
  ACTIVE_MODE = MODES.map || MODES.normal; startGame();
  // r683: startGame opens the schedule screen, which lays the board out as the
  // schedule (5 x 4 since r655) over the 4 x 4 play board, so the bot's first
  // hand read a row gridData does not have and every run crashed. Clock in.
  if (typeof mapScreenOpen !== 'undefined' && mapScreenOpen) mapCloseScreen();
  roundGoal = goalFn(1);
  // r706: the review asks the goal of a fixed level a quarter (MAP_REVIEW_LEVEL);
  // bossMult, if given, lifts it.
  for (let q = 1; q <= quarters; q++) {
    // r655: a sched json's "tiles" replaces the walk; the default is an 8-booking 4 x 4 quarter.
    // r690: the reward tile is IT's alone; a priority account ('hard') pays the reward
    // grid instead of the pick of three and two knacks. 'audit' is a hard round's goal
    // and three challenge cards' credits (the bot plays no cards), no pick of three.
    const tiles = (typeof SIM_SCHED_TILES !== 'undefined' && SIM_SCHED_TILES)
      || ['level','level','level','hard','shop','event','level','event'];
    for (const t of tiles) {
      if (t === 'level' || t === 'hard' || t === 'audit') {
        if (t === 'hard') roundGoal = Math.round(roundGoal * 1.25);
        const res = SIM_playRound();
        if (!res.cleared) return { win: false, diedLevel: level, boss: false, diag: SIM_diag(res) };
        if (t === 'level') SIM_grantWeighted({ trick: 55, knack: 20, sleight: 25 }, 3);   // pick-of-three
        if (t === 'hard') { SIM_grantWeighted({ trick: 55, knack: 15, sleight: 10, limit: 20 }); SIM_grantWeighted({ trick: 55, knack: 15, sleight: 10, limit: 20 }); }  // reward grid
        if (t === 'audit') { coins += 20; }   // three standard cards' credits
        SIM_levelUp(goalFn);
      } else {
        if (t === 'reward') { SIM_grantWeighted({ trick: 55, knack: 15, sleight: 10, limit: 20 }); SIM_grantWeighted({ trick: 55, knack: 15, sleight: 10, limit: 20 }); }
        if (t === 'shop')   { SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 }); SIM_improveRandomOwned(); }
        if (t === 'event')  { SIM_grantWeighted({ trick: 60, knack: 20, sleight: 20 }); }
        // bought tile advances the curve, no round played
        level++; roundGoal = goalFn(level);
      }
    }
    // boss: the fixed review level (r706), as the game asks it (the quota alone)
    const lv = (typeof mapReviewLevel === 'function') ? mapReviewLevel(q) : 8 + 9 * (q - 1);
    roundGoal = bossMult ? Math.round(goalFn(lv) * bossMult / 500) * 500 : goalFn(lv);
    const res = SIM_playRound();
    if (!res.cleared) return { win: false, diedLevel: level, boss: true, diag: SIM_diag(res) };
    // prize grid
    SIM_grantWeighted({ trick: 60, knack: 20, sleight: 20 });
    SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 });
    SIM_levelUp(goalFn);
  }
  return { win: true, diedLevel: level };
}

// r683: Flow, replacing the r278 Survival runner (MODES.survival went in r417, so
// it threw on its first line). Flow cannot lose a level: goals are cleared on one
// session clock (FLOW_SESSION_SECONDS, carried across level-ups); at 0:00 the boss
// comes with goalForLevel(flowBossGoalLevel()) in FLOW_BOSS_WINDOW seconds, and
// losing it ends the run. SURVIVAL_BOSS_COUNT bosses win it. Each level-up pays
// the game's own reward chain count and kinds (flowrRollCount, flowrRollKind);
// deck edits ('cards', 'deck') are not modelled. A board that stalls burns the
// rest of the session.
function SIM_flowReward(kind) {
  if (kind === 'pick3')    return SIM_grantWeighted(SURVIVAL_PICK_WEIGHTS, 3);
  if (kind === 'tricks')   return SIM_grant('trick', 3);
  if (kind === 'sleights') return SIM_grant('sleight', 3);
  if (kind === 'knacks')   return SIM_grant('knack', 3);
  if (kind === 'limits')   return SIM_grant('limit');
  if (kind === 'improve')  return SIM_improveRandomOwned();
  if (kind === 'shop')     return SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 });
  return false;
}
function SIM_runFlow(goalFn) {
  ACTIVE_MODE = MODES.flow; startGame();
  roundGoal = goalFn(1);
  for (let guard = 0; guard < 400; guard++) {
    const res = SIM_playRound();
    if (res.cleared && roundSeconds > 0) {
      let n = 1;
      try { n = flowrRollCount(); } catch (e) {}
      for (let i = 0; i < n; i++) { let k = 'pick3'; try { k = flowrRollKind(flowrOddsNow()); } catch (e) {} SIM_flowReward(k); }
      SIM_levelUp(goalFn);
      continue;
    }
    // the session is over: the boss, on a fresh deal with stock refilled (triggerBoss)
    score = 0;
    roundGoal = goalFn(flowBossGoalLevel());
    const rr = computeRoundResources();
    swaps = rr.swaps; discards = rr.discards;
    roundSeconds = FLOW_BOSS_WINDOW;
    try { resetFocusMeter(); } catch (e) {}
    try { flushPlayedDeck(); initGridData(); } catch (e) {}
    const boss = SIM_playRound();
    if (!boss.cleared) return { win: false, diedLevel: level, boss: true, bosses: survivalBossesBeaten, diag: SIM_diag(boss) };
    survivalBossesBeaten++;
    if (survivalBossesBeaten >= SURVIVAL_BOSS_COUNT) return { win: true, diedLevel: level, bosses: survivalBossesBeaten };
    SIM_grantWeighted({ trick: 60, knack: 20, sleight: 20 });
    SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 });
    flowRefillClock = true;   // flowEndBoss: the next level-up refills the session clock
    SIM_levelUp(goalFn);
  }
  return { win: false, diedLevel: level, bosses: survivalBossesBeaten };
}
