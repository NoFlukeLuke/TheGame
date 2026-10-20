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
  const seen = new Set();
  const out = [];
  // grow subsets: only allow adding neighbours with index > root to halve dupes; dedupe by mask anyway
  const stack = [];
  for (let i = 0; i < n; i++) stack.push([1 << i, i, [i]]);
  while (stack.length) {
    const [mask, root, mem] = stack.pop();
    if (mem.length >= 2 && !seen.has(mask)) { seen.add(mask); out.push(mem); }
    if (mem.length >= maxSize) continue;
    for (const i of mem) for (const j of adj[i]) {
      if (mask & (1 << j)) continue;
      const nm = mask | (1 << j);
      if (seen.has(nm)) continue;
      if (mem.length + 1 >= 2) { /* record on pop */ }
      stack.push([nm, root, mem.concat([j])]);
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
  let hands = 0, dry = 0, dryActs = 0, fmSum = 0;
  roundStartSeconds = clock;
  let decayMs = (typeof focusDecayIntervalMs === 'number' && focusDecayIntervalMs > 0) ? focusDecayIntervalMs : 2000;
  while (clock > 0 && score < roundGoal) {
    let best = SIM_bestHand();
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
    dryActs, avgFocus: hands ? +(fmSum / hands).toFixed(2) : 1, scorePct: +(score / Math.max(1, roundGoal) * 100).toFixed(0) };
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

// manual level-up: bank score, bump level, set next goal from the schedule fn
function SIM_levelUp(goalFn, opts) {
  opts = opts || {};
  totalScore += Math.min(score, roundGoal);
  const overflow = Math.max(0, score - roundGoal);
  level++;
  score = opts.carryOver ? overflow : 0;
  roundGoal = goalFn(level);
  try { flushPlayedDeck(); } catch (e) {}
  try { computeRoundResources(); } catch (e) {}
  roundSeconds = (typeof currentRoundDuration === 'function') ? currentRoundDuration() : 180;
  try { initGridData(); } catch (e) {}
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
      if (!res.cleared) return { win: false, diedLevel: level, boss: isBoss, diag: { hands: res.hands, dryActs: res.dryActs, avgFocus: res.avgFocus, scorePct: res.scorePct } };
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
  roundGoal = goalFn(1);
  // per quarter: 5 levels + 1 hard round + 2 reward tiles + 1 shop + 1 event, then boss.
  for (let q = 1; q <= quarters; q++) {
    const quarterOpenLevel = level;
    const tiles = ['level','reward','level','shop','level','hard','reward','level','event','level'];
    for (const t of tiles) {
      if (t === 'level' || t === 'hard') {
        if (t === 'hard') roundGoal = Math.round(roundGoal * 1.25);
        const res = SIM_playRound();
        if (!res.cleared) return { win: false, diedLevel: level, boss: false };
        SIM_grantWeighted({ trick: 55, knack: 20, sleight: 25 }, 3);   // pick-of-three
        if (t === 'hard') { SIM_grant('knack'); SIM_grant('knack'); }  // hard-round knack pick
        SIM_levelUp(goalFn);
      } else {
        if (t === 'reward') { SIM_grantWeighted({ trick: 55, knack: 15, sleight: 10, limit: 20 }); SIM_grantWeighted({ trick: 55, knack: 15, sleight: 10, limit: 20 }); }
        if (t === 'shop')   { SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 }); SIM_improveRandomOwned(); }
        if (t === 'event')  { SIM_grantWeighted({ trick: 60, knack: 20, sleight: 20 }); }
        // bought tile advances the curve, no round played
        level++; roundGoal = goalFn(level);
      }
    }
    // boss: quota anchored to the level the quarter opened on
    const quota = Math.round(goalFn(quarterOpenLevel) * bossMult / 500) * 500;
    roundGoal = Math.max(roundGoal, quota);
    roundSeconds = 180;
    const res = SIM_playRound();
    if (!res.cleared) return { win: false, diedLevel: level, boss: true };
    // prize grid
    SIM_grantWeighted({ trick: 60, knack: 20, sleight: 20 });
    SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 });
    SIM_levelUp(goalFn);
  }
  return { win: true, diedLevel: level };
}

function SIM_runSurvival(goalFn, bossEvery) {
  bossEvery = bossEvery || 300;
  ACTIVE_MODE = MODES.survival; startGame();
  roundGoal = goalFn(1);
  roundSeconds = 120;
  let liveSeconds = 0, bosses = 0;
  for (let guard = 0; guard < 200; guard++) {
    const isBossRound = liveSeconds >= bossEvery * (bosses + 1);
    if (isBossRound) roundSeconds = 120;
    const res = SIM_playRound();
    liveSeconds += Math.min(120, 120 - res.timeLeft + 0);
    if (!res.cleared) return { win: false, diedLevel: level, boss: isBossRound, bosses };
    if (isBossRound) {
      bosses++;
      if (bosses >= 5) return { win: true, diedLevel: level, bosses };
      SIM_grantWeighted({ trick: 60, knack: 20, sleight: 20 });
      SIM_grantWeighted({ trick: 50, knack: 20, sleight: 15, limit: 15 });
    }
    SIM_grantWeighted(SURVIVAL_PICK_WEIGHTS, 3);
    SIM_levelUp(goalFn, { carryOver: true });
    roundSeconds = 120;
  }
  return { win: false, diedLevel: level, bosses };
}
