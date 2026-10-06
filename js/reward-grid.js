// Reward grids run on a POSITIONAL seeded stream keyed by visit index, so the
// Nth grid of a seed is always the same grid - however many cards the player
// discarded, whatever Tricks fired, whichever route they took to get here.
// See js/seed.js.
// ── PRIZE GRID (r179) ────────────────────────────────────────────────────────
// The reward for beating a boss. Same machinery as the reward grid - same tiles,
// same connected-path pick, same confirm/fly/apply - with three differences, all
// of them decided here in generation:
//   · it is SMALLER: two fewer rows and two fewer columns, floored at 3x3, so the
//     path you walk is short and every step of it matters;
//   · there are NO penalty tiles and no destination tile. Every cell is a reward,
//     which is why the checkerboard (buff on even (r+c), debuff on odd) is skipped
//     entirely rather than having its debuff half replaced;
//   · NOTHING COMMON. Common-tier Tricks/Sleights/Knacks are filtered out of the
//     pools, and the four common resource tiles (+1 swap, +1 discard, +15s,
//     Windfall) are not in the category list at all.
// Mystery tiles are also out: "probably good... probably" is a gamble, and this
// grid is a payout.
//
// It REPLACES the post-boss reward grid rather than being shown after it - one
// grid, not two. Survival and Flow have no reward grid at all (they run a
// pick-of-three), so they keep their bonus pick.
let rewardGridMode = 'normal';   // 'normal' | 'prize' | 'penalty' | 'mini'
function prizeGridActive() { return rewardGridMode === 'prize'; }
// ── PENALTY GRID (r444) ──────────────────────────────────────────────────────
// The inverse of the prize grid: what a failed challenge round costs
// (js/challenge-round.js). Every cell is a penalty, drawn from the reward grid's
// own penalty table, and the path must be EXACTLY your Selection Size long - you
// choose which penalties, not how many. No skip. Greedy Boi does not lengthen it.
function penaltyGridActive() { return rewardGridMode === 'penalty'; }
function penaltyPickCount() {
  const cells = (rewardCells || []).reduce((n, row) => n + (row ? row.filter(Boolean).length : 0), 0);
  return Math.max(1, Math.min(limits.selection.current, cells || limits.selection.current));
}
let penaltyVisitIndex = 0;
let _penaltyDone = null;
function openPenaltyGrid(done) {
  rewardGridMode = 'penalty';
  rewardGridContext = 'penalty';
  _penaltyDone = done || null;
  openRewardGrid();
  showMessage(`Pick ${penaltyPickCount()} penalties`, 'var(--red)', { ms: 3000 });
}
// ── MINI GRID (r478) ─────────────────────────────────────────────────────────
// A free 3x3 ordinary grid (buffs and debuffs on the checkerboard, no guaranteed
// tiles, no destination), paid for a challenge card taken at difficulty 2+ outside
// Flow. Hands control back to whoever opened it, like the penalty grid.
function miniGridActive() { return rewardGridMode === 'mini'; }
let miniVisitIndex = 0;
function openMiniGrid(done) {
  rewardGridMode = 'mini';
  rewardGridContext = 'mini';
  _penaltyDone = done || null;
  openRewardGrid();
}
function devOpenMiniGrid() {
  if (typeof closeDevPanel === 'function') closeDevPanel();
  openMiniGrid(() => { gameTimerPaused = false; if (gridData && gridData[0]) { startRoundTimer(); render(); } });
}
function devOpenPenaltyGrid() {
  if (typeof closeDevPanel === 'function') closeDevPanel();
  openPenaltyGrid(() => { gameTimerPaused = false; if (gridData && gridData[0]) { startRoundTimer(); render(); } });
}

// The Trick-tile floor for a grid. A prize grid is 9 tiles at its smallest and
// several of those are guaranteed upgrades, so demanding 5 Tricks there would
// crowd out everything else. Lifted out of _generateRewardContent because the
// difficulty conversion below has to reserve these slots BEFORE the fill runs.
function MIN_TRICK_TILES_FOR(prize) { return prize ? 2 : 5; }

function generateRewardContent() {
  // The penalty grid draws on its own stream, so taking one never shifts which
  // reward grids a seed deals.
  if (penaltyGridActive()) return withSeededRng(_generateRewardContent, 'penalty', penaltyVisitIndex++);
  if (miniGridActive()) return withSeededRng(_generateRewardContent, 'mini', miniVisitIndex++);
  return withSeededRng(_generateRewardContent, 'reward', rewardVisitIndex++);
}
// Weighted reward-grid tile categories (r409: hoisted, tunable in dev).
const REWARD_PRIZE_CATS = [
  { weight: 34, kind: 'trick' },
  { weight: 20, kind: 'sleight' },
  { weight: 16, kind: 'knack' },
  { weight: 16, kind: 'limit_up' },
  { weight:  5, kind: 'blessed' },   // r444: halved, and no Cut tile - see REWARD_BUFF_CATS
  { weight:  8, kind: 'luck' },
  { weight:  7, kind: 'improve_trick' },
  { weight:  5, kind: 'improve_knack' },
  { weight:  5, kind: 'improve_sleight' },
];
const REWARD_BUFF_CATS = [
  { weight: 40, kind: 'trick' },
  { weight: 12, kind: 'sleight' },
  { weight:  7, kind: 'knack' },
  { weight:  5, kind: 'discard' },
  { weight:  5, kind: 'swap' },
  { weight:  5, kind: 'time' },
  { weight:  6, kind: 'coins' },
  { weight:  4, kind: 'limit_up' },
  // r444 (owner: less deck manipulation on the grids, now that card packs, the
  // deck editor, Dealer's Choice and the Clean Up / Deck Trim events exist):
  // card buffs halved (6 -> 3), the Cut tile gone, and no two-card dual op.
  { weight:  3, kind: 'blessed' },
  { weight:  3, kind: 'cleanse' },
  { weight:  3, kind: 'mystery' },
  { weight:  4, kind: 'luck' },
  { weight:  4, kind: 'improve_trick' },
  { weight:  3, kind: 'improve_knack' },
  { weight:  3, kind: 'improve_sleight' },
];

function _generateRewardContent() {
  const PRIZE = prizeGridActive(), MINI = miniGridActive();
  // Two smaller in each direction, never below 3x3. The mini grid is always 3x3.
  const ROWS = MINI ? 3 : PRIZE ? Math.max(3, limits.grid_rows.current - 2) : limits.grid_rows.current;
  const COLS = MINI ? 3 : PRIZE ? Math.max(3, limits.grid_cols.current - 2) : limits.grid_cols.current;

  // Weighted buff categories. Tricks are also guaranteed a minimum count per
  // grid (MIN_TRICK_TILES below), so their true share ends up higher than the
  // raw weight suggests - the other categories fight over the leftover slots.
  // Prize grid: no common-tier resource tiles, no gamble. Entities and permanent
  // upgrades only - see the PRIZE GRID note at the top of this file.
  // Fortune / Jinx both move Luck by the same ladder: 5, 10 or 15, rolled at
  // GENERATION time so the tile states the exact figure before you take it.
  // They move luckModifiers rather than the limit, which is what lets Jinx push
  // Luck below zero (decrementLimit floors at 0) and lets Fortune stack past the
  // ceiling. The limit itself is what the shop, the Mart and a Limit Break sell.
  const LUCK_STEPS = [5, 10, 15];
  const _luckAmt = () => LUCK_STEPS[Math.floor(Math.random() * LUCK_STEPS.length)];
  // Bigger swings are rarer things to meet.
  const _luckTier = n => (n >= 15 ? 'legendary' : n >= 10 ? 'epic' : 'rare');

  // r409: the two category tables are top-level (REWARD_PRIZE_CATS /
  // REWARD_BUFF_CATS) so dev -> Probabilities can tune them.
  const prizeCategories = REWARD_PRIZE_CATS;
  const buffCategories  = REWARD_BUFF_CATS;
  // Hover projections (computed when the grid opens, reflecting current standing debuffs).
  const _proj    = computeRoundResources();
  const _capNow  = Math.max(10, Math.max(ROUND_DURATION, limits.round_time.current) - roundPenaltySeconds);
  const _handNow = 0 + extraPlayCostPerm + nextRoundPlayCost;   // base play cost is 0 (r50)
  const _discNow = 3 + extraDiscardCostPerm + nextRoundDiscardCost;
  // ── Penalty tiles ──────────────────────────────────────────────────────────
  // `perm: true` marks a penalty that outlives the next round. A penalty that
  // resolves instantly and is then over (Pickpocket) is NOT permanent: it costs
  // you once.
  const debuffs = [
    { weight: 8, perm: true, icon: '☁', label: '-5s Round Cap', tier: 'penalty',
      desc: `Round cap: ${formatTime(_capNow)} → ${formatTime(Math.max(10, _capNow - 5))} · permanent, stacks`,
      apply: () => { roundPenaltySeconds += 5; noteMessage('Round cap -5s (permanent)', 'var(--red)'); } },
    { weight: 8, perm: false, icon: '☠', label: '-1 Discard', tier: 'penalty',
      desc: `Next round discards: ${_proj.discards} → ${Math.max(0, _proj.discards - 1)} · next round only`,
      apply: () => { nextRoundDiscardDelta -= 1; noteMessage('-1 discard next round', 'var(--red)'); } },
    { weight: 8, perm: false, icon: '✖', label: '-1 Swap', tier: 'penalty',
      desc: `Next round swaps: ${_proj.swaps} → ${Math.max(0, _proj.swaps - 1)} · next round only`,
      apply: () => { nextRoundSwapDelta -= 1; noteMessage('-1 swap next round', 'var(--red)'); } },
    { weight: 8, perm: true, icon: '💔', label: 'Lose a Trick', tier: 'penalty',
      desc: 'Discard one random Trick you own.',
      apply: applyRewardLoseTrick },
    { weight: 8, perm: true, icon: '🐌', label: 'Hands +2s', tier: 'penalty',
      desc: `Hand cost: ${_handNow}s → ${_handNow + 2}s each · permanent, stacks`,
      apply: () => { extraPlayCostPerm += 2; noteMessage('Playing a hand costs +2s (permanent)', 'var(--red)'); } },
    { weight: 8, perm: false, icon: '⌛', label: 'Hands +5s · 1rd', tier: 'penalty',
      desc: `Next round hand cost: ${_handNow}s → ${_handNow + 5}s each · next round only`,
      apply: () => { nextRoundPlayCost += 5; noteMessage('Hands cost +5s next round', 'var(--red)'); } },
    { weight: 8, perm: true, icon: '🐌', label: 'Discards +2s', tier: 'penalty',
      desc: `Discard cost: ${_discNow}s → ${_discNow + 2}s per card · permanent, stacks`,
      apply: () => { extraDiscardCostPerm += 2; noteMessage('Discarding costs +2s/card (permanent)', 'var(--red)'); } },
    { weight: 8, perm: false, icon: '⌛', label: 'Discards +5s · 1rd', tier: 'penalty',
      desc: `Next round discard cost: ${_discNow}s → ${_discNow + 5}s per card · next round only`,
      apply: () => { nextRoundDiscardCost += 5; noteMessage('Discards cost +5s/card next round', 'var(--red)'); } },
    // ── Variety debuffs (r74) ──
    { weight: 8, perm: false, icon: '💸', label: 'Pickpocket', tier: 'penalty',
      desc: `Lose 10 coins (${coins} → ${Math.max(0, coins - 10)}).`,
      apply: () => { coins = Math.max(0, coins - 10); updateCoinsUI(); noteMessage('-10 coins', 'var(--red)'); } },
    { weight: 8, perm: true, icon: '🪨', label: 'Stones', tier: 'penalty',
      desc: 'Two Stones are shuffled into your deck. They block cells until purged.',
      apply: () => { injectStonesIntoDeck(2); noteMessage('2 Stones added to deck', 'var(--red)'); } },
    { weight: 8, perm: false, icon: '⏳', label: 'Slow Start', tier: 'penalty',
      desc: 'Next round starts with 20 fewer seconds.',
      apply: () => { nextRoundSecondsDelta -= 20; noteMessage('-20s next round', 'var(--red)'); } },
    // ── r193 penalties: four that cost something other than seconds ──────────
    // Every penalty before these took time, resources or a card. The grid needed
    // costs aimed at the other three things a run runs on - the goal you are
    // chasing, the Focus multiplier, the credits, and the loadout itself.
    { weight: 7, perm: true, icon: '📈', label: 'Quota Revision', tier: 'penalty',
      desc: `Every future round goal rises by 10% (now ×${goalPenaltyMult.toFixed(2)} → ×${(goalPenaltyMult * 1.10).toFixed(2)}) · permanent, stacks`,
      apply: () => { goalPenaltyMult *= 1.10; noteMessage('Goals +10% (permanent)', 'var(--red)'); } },
    { weight: 7, perm: true, icon: '📋', label: 'Red Tape', tier: 'penalty',
      desc: `Hands generate ${Math.round(100 / (focusRatePenalty * 1.25))}% of their listed Focus (now ${Math.round(100 / focusRatePenalty)}%) · permanent, stacks`,
      apply: () => { focusRatePenalty *= 1.25; noteMessage('Focus gain reduced (permanent)', 'var(--red)'); } },
    { weight: 7, perm: false, icon: '🚫', label: 'Withheld', tier: 'penalty',
      desc: 'The next round pays out nothing: no interest, no leftover-time credits.',
      apply: () => { skipNextPayout = true; noteMessage('Next payout withheld', 'var(--red)'); } },
    // The TYPE is fixed when the tile is generated so the tile can name it; WHICH
    // entity gets suspended is rolled at the start of the round it applies to.
    (() => {
      const t = ['trick', 'knack', 'sleight'][Math.floor(Math.random() * 3)];
      const noun = { trick: 'Trick', knack: 'Knack', sleight: 'Sleight' }[t];
      return { weight: 7, perm: false, icon: '⛔', label: `Suspend a ${noun}`, tier: 'penalty',
        desc: `One random ${noun} you own stops working for the first half of next round. Which one is decided when the round deals.`,
        apply: () => { pendingEntityLockout = { type: t }; noteMessage(`A ${noun} will be suspended next round`, 'var(--red)'); } };
    })(),
    // ── r194 penalties: five that cost you a board, a habit or a Trick's rent ──
    (() => {
      const n = _luckAmt();
      return { weight: 7, perm: true, icon: '🐈‍⬛', label: `-${n} Luck`, tier: 'penalty',
        desc: `Luck ${luckTotal()} → ${luckTotal() - n}. Chance effects fire less often and worse entities turn up. Permanent, and it can take Luck below zero.`,
        apply: () => { luckModifiers -= n; noteMessage(`-${n} Luck`, 'var(--red)'); } };
    })(),
    { weight: 7, perm: false, icon: '🧊', label: 'Interest Freeze', tier: 'penalty',
      desc: `No interest paid for the next ${BAL.interest_freeze.rounds} rounds. Leftover-time credits still pay.`,
      apply: () => { interestFreezeRounds += BAL.interest_freeze.rounds; noteMessage(`Interest frozen for ${BAL.interest_freeze.rounds} rounds`, 'var(--red)'); } },
  ];

  // ── Conditional penalties (r194) ────────────────────────────────────────────
  // Each of these is only worth putting on the board when the run can actually
  // pay it. A tile that resolves to nothing is worse than a tile that hurts: it
  // reads as a penalty the player dodged, and it cost a cell to say so.

  // Short Staffed - the board loses a line for one round. OWNER'S RULE: only
  // offered at 5+ on the axis it would cut, so it can never take a board below
  // 4 on either side. Which axis is decided at generation time so the tile can
  // name it, and only qualifying axes are candidates.
  {
    const _axes = [];
    if (limits.grid_rows.current >= 5) _axes.push(['rows', 'row',    limits.grid_rows.current]);
    if (limits.grid_cols.current >= 5) _axes.push(['cols', 'column', limits.grid_cols.current]);
    if (_axes.length) {
      const [_ax, _noun, _now] = _axes[Math.floor(Math.random() * _axes.length)];
      debuffs.push({ weight: 7, perm: false, icon: '📉', label: `Short Staffed`, tier: 'penalty',
        desc: `Next round the board is one ${_noun} smaller (${_now} → ${_now - 1}). One round only.`,
        apply: () => { nextRoundGridShrink = _ax; noteMessage(`-1 ${_noun} next round`, 'var(--red)'); } });
    }
  }

  // Spot Check - one hand type scores at half mult until you have played it
  // enough times to clear it. Drawn from achievableHandTypes(), the same guard
  // The Redaction uses: flagging Straight Flush on a 4x4 board is not a penalty,
  // it is a rounding error.
  {
    const _pool = (typeof achievableHandTypes === 'function' ? achievableHandTypes() : [])
      .filter(h => HAND_BASE[h] && !(spotCheckHand === h && spotCheckLeft > 0));
    if (_pool.length) {
      const _h = _pool[Math.floor(Math.random() * _pool.length)];
      const _n = BAL.spot_check.plays_to_clear;
      debuffs.push({ weight: 7, perm: false, icon: '🔍', label: 'Spot Check', tier: 'penalty',
        desc: `${_h} scores at ×${BAL.spot_check.mult} mult until you have played it ${_n} more times.`,
        apply: () => { spotCheckHand = _h; spotCheckLeft = _n; showMessage(`Spot check: ${_h} ×${BAL.spot_check.mult}`, 'var(--red)'); } });
    }
  }

  // Dead Drop - one cell plays but does not pay. Only on a board with a cell to
  // spare, and never one already dead.
  {
    const _free = [];
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++)
      if (!isCellDead(r, c) && !(typeof isCellBlocked === 'function' && isCellBlocked(r, c))) _free.push([r, c]);
    if (_free.length > 4) {
      const [_dr, _dc] = _free[Math.floor(Math.random() * _free.length)];
      debuffs.push({ weight: 6, perm: true, icon: '🕳', label: 'Dead Drop', tier: 'penalty',
        desc: `One cell goes dead for the rest of the act. Its card can still be selected and still counts toward the hand - it just scores no pips and fires none of its own Tricks.`,
        apply: () => { deadCells.add(`${_dr}-${_dc}`); render(); showMessage('A cell went dead', 'var(--red)'); } });
    }
  }

  // Rider - a Trick you own keeps working and starts charging rent. Needs a
  // Trick to ride, and will not double up on one that already carries it.
  {
    const _owned = trickTray
      .filter(t => t && t.id && t.id !== riderTrickId);
    if (_owned.length) {
      const _t = _owned[Math.floor(Math.random() * _owned.length)];
      debuffs.push({ weight: 6, perm: true, icon: '🐒', label: 'Rider', tier: 'penalty',
        desc: `${_t.name} keeps working, but every time it fires it costs ${BAL.rider.seconds_per_proc}s. Permanent - it only leaves if the Trick does.`,
        apply: () => { riderTrickId = _t.id; showMessage(`Rider on ${_t.name}`, 'var(--red)'); } });
    }
  }
  // Cursed-card debuff: afflicts one specific shown card (weight 10; only if an
  // un-cursed identity exists). Card is pre-picked so the tile shows exactly it.
  {
    const _uncursed = everyDeckCard().filter(c => !cardCurses[cardId(c)]);
    if (_uncursed.length) {
      const _victim = _uncursed[Math.floor(Math.random() * _uncursed.length)];
      const _cids = Object.keys(CURSE_DEFS);
      const _cid  = _cids[Math.floor(Math.random() * _cids.length)];
      debuffs.push({ weight: 10, perm: true, icon: CURSE_DEFS[_cid].icon, label: `${CURSE_DEFS[_cid].name} Curse`, tier: 'penalty',
        cardFace: { rank: _victim.rank, suit: _victim.suit },
        desc: `${_victim.rank}${_victim.suit} is cursed - ${CURSE_DEFS[_cid].desc}`,
        apply: () => { const v = resolveDeckCard(_victim); if (!v) return;
          cardCurses[cardId(v)] = { id: _cid, left: CURSE_DEFS[_cid].liftAfter }; showMessage(`${v.rank}${v.suit} cursed: ${CURSE_DEFS[_cid].name}`, '#9b59b6'); } });
    }
  }
  // Limit-drain debuff: -1 to a shown limit (weight 5; only if something is drainable).
  // round_time is excluded - a 1-second drain reads like a bug, not a curse.
  {
    // limitCanDecrement, not `current > 1` - a limit at its own floor cannot be
    // drained, and a tile that takes nothing is worse than another penalty.
    const _drainable = LIMITS_DEF.filter(d => d.id !== 'round_time' && limitCanDecrement(d.id));
    if (_drainable.length) {
      const _dl = pickWeightedLimits(1, _drainable)[0];
      const _dtx = limitDeltaText(_dl.id, -1);           // the REAL loss, floor included
      const _dch = limitChangeText(_dl.id, -1);
      debuffs.push({ weight: 5, perm: true, icon: '⬇️', label: `${_dtx} ${_dl.label}`, tier: 'penalty',
        desc: `${_dch} · permanent (limits are precious!)`,
        apply: () => { decrementLimit(_dl.id); noteMessage(`${_dtx} ${_dl.label}`, 'var(--red)'); } });
    }
  }
  // Dark mystery: unknown until claimed - mostly bad (weight 6).
  // _mystery + _goodChance let the resolve animation pre-roll + reveal it; apply()
  // reuses that same rolled outcome so what you see is what you get.
  debuffs.push({ weight: 6, perm: false, icon: '❓', label: 'Dark Mystery', tier: 'mystery',
    desc: 'Unknown until claimed. Probably bad… probably.',
    _mystery: true, _goodChance: 0.3,
    apply: function () { (this._rolled || (this._rolled = rollRewardMystery(this._goodChance))).apply(); } });
  const destOptions = [
    { icon: '🏪', label: 'Next: Shop',  tier: 'dest', apply: () => { pendingEventOverride = 'shop'; } },
    { icon: '🏪', label: 'Next: Shop',  tier: 'dest', apply: () => { pendingEventOverride = 'shop'; } },
    { icon: '🎲', label: 'Next: Event', tier: 'dest', apply: () => { pendingEventOverride = 'event'; } },
  ];

  function weightedPick(arr) {
    const total = arr.reduce((s, x) => s + (x.weight || 1), 0);
    let rng = Math.random() * total;
    for (const x of arr) { rng -= (x.weight || 1); if (rng <= 0) return x; }
    return arr[arr.length - 1];
  }
  function pickRand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  // Survival and Flow keep entities out of their offer pools that their mode can't
  // support (reward-grid-only Tricks; Flow's round-clock entities). Until r188 no
  // reward grid ever opened in those modes, so these factories never had to ask -
  // the prize grid is a new offer path, and a new offer path that skips this leaks
  // the bans (see js/survival.js).
  function offerBanned(id) { return typeof survivalEntityBanned === 'function' && survivalEntityBanned(id); }
  // Each factory picks independently, so the same Trick could land on two tiles of
  // one grid. Barely noticeable across 13 buff slots; on a 9-tile prize grid it is
  // a wasted pick staring at you. Anything already placed this generation is
  // filtered out, with a fall-back to the unfiltered list so an exhausted pool
  // repeats rather than blanking.
  const _usedThisGrid = new Set();
  function freshPool(pool) { const f = pool.filter(x => !_usedThisGrid.has(x.id)); return f.length ? f : pool; }
  function shuffled(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  // The penalty grid: every cell a penalty, full board size, no mystery (a
  // penalty you can see is the point). The one-per-grid rule for the big kinds
  // holds, falling back to a repeat only if the table runs out.
  if (penaltyGridActive()) {
    const pool = debuffs.filter(d => d.tier !== 'mystery');
    const pen = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const once = new Set();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      let pick = null;
      for (let tries = 0; tries < 16 && !pick; tries++) {
        const cand = weightedPick(pool);
        const onceKind = cand.cardFace || cand.icon === '⬇️' || cand.icon === '🐈‍⬛' || cand.perm;
        if (onceKind && once.has(cand.label)) continue;
        if (onceKind) once.add(cand.label);
        pick = cand;
      }
      pen[r][c] = { kind: 'debuff', payload: pick || pickRand(debuffs) };
    }
    return pen;
  }

  // Pre-pick Trick at generation time so the tile shows the exact card.
  // entity/rarity drive the LETHE reward-entity visuals (see buildRewardTileInner).
  // Trick tiles are drawn on the SHOP'S RARITY TABLE (r193), not uniformly.
  //
  // They used to be picked flat out of the eligible pool, which sounds fair and is
  // not: TRICK_POOL is 49 common / 66 rare / 50 epic / 12 legendary, so a
  // uniform draw made an epic-or-better tile a 35% event on EVERY trick slot, and
  // a grid guarantees five of them. Sleights had gone through pickSleightByRarity
  // since the shop was written; tricks and knacks never did, which is most of why
  // a reward grid reads as a pile of epics.
  // Owner's call (r195): tricks and knacks draw on the SAME table as sleights,
  // rather than the slightly looser one r193 gave them. That is a further
  // tightening - epic-or-better goes from 21% of a trick tile to 13%.
  //
  // The PRIZE grid draws on its own table (PRIZE_TIER_W) rather than on the
  // ordinary one with commons filtered out of the pool. A filter is not a table:
  // it decided the floor while the weights only shared out what survived, so the
  // printed spread and the real one could never agree. See js/data/balance.js.
  const TRICK_TIERS  = ENTITY_TIERS;
  const TRICK_TIER_W = luckTierWeights(PRIZE ? PRIZE_TIER_W : ENTITY_TIER_W);   // Luck tilts the ladder (js/luck.js)
  // pickEntityByRarity now lives in js/luck.js so the events can reach it too.
  const pickByRarity = (pool, tierOf, weights, tiers) => pickEntityByRarity(pool, tierOf, weights, tiers);

  function makeTrickPayload() {
    if (typeof TRICK_POOL === 'undefined') return { icon: '★', label: 'Trick', tier: 'rare', entity: 'trick', rarity: 'rare', apply: applyRewardRandomTrick };
    const owned = new Set((acquiredTricks || []).map(b => b.id));
    let eligible = TRICK_POOL.filter(b => !owned.has(b.id) && !offerBanned(b.id));
    if (eligible.length === 0) return { icon: '★', label: 'Trick', tier: 'rare', entity: 'trick', rarity: 'rare', apply: applyRewardRandomTrick };
    eligible = freshPool(eligible);
    const pick = pickByRarity(eligible, b => (b.tier || 'common'), TRICK_TIER_W, TRICK_TIERS)
              || eligible[Math.floor(Math.random() * eligible.length)];
    _usedThisGrid.add(pick.id);
    return {
      icon: '★', label: pick.name, desc: pick.desc, tier: pick.tier || 'rare',
      entity: 'trick', rarity: pick.tier || 'rare', _trick: pick,
      apply: () => injectTrickAfterReward(pick)
    };
  }

  // Prize-grid sleight draw: the prize table, through the shared chokepoint.
  // It had its own copy of the roll-and-cascade loop, which is exactly how a
  // path drifts off the table everything else reads.
  function pickPrizeSleight() {
    const pool = freshPool(SLEIGHT_POOL.filter(j => !grantedSleightIds.has(j.id) && sleightOfferable(j) && !offerBanned(j.id)));
    if (!pool.length) return null;
    return pickEntityByRarity(pool, j => (j.rarity || 'common'), TRICK_TIER_W, TRICK_TIERS)
        || pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Improve an entity you already own (r206) ───────────────────────────────
  // The TARGET is chosen when the grid is BUILT, not when the tile is taken, so
  // the tile can name what it will improve and show the number it will become.
  // That follows Fortune/Jinx, which roll their Luck step at generation for the
  // same reason. It is also why `apply` re-checks: a Trick can be taken off you
  // between the grid being built and the tile being picked.
  function makeImprovePayload(type) {
    const ICON = { trick: '\u2605', knack: '\u25c6', sleight: '\u2666' };
    const NOUN = { trick: 'Trick', knack: 'Knack', sleight: 'Sleight' };
    const pick = (typeof pickImproveTarget === 'function') ? pickImproveTarget(type) : null;
    // Nothing of that type owned, or everything of it is already maxed. A tile
    // that does nothing is worse than an ordinary one.
    if (!pick) return makeTrickPayload();
    const prev = (typeof improvePreview === 'function') ? improvePreview(pick.id) : null;
    const tierTxt = prev ? ` (tier ${prev.tier}/${IMPROVE_MAX_TIER})` : '';
    // The sentence ONCE, with the number that moves marked in place (r281).
    // improveDeltaHTML returns null when the two descriptions are not provably
    // the same sentence, and only then do we fall back to printing both.
    const delta = (prev && prev.after !== prev.before && typeof improveDeltaHTML === 'function')
                    ? improveDeltaHTML(prev.before, prev.after) : null;
    return {
      icon: ICON[type] || '\u2605', label: 'Improve: ' + pick.name,
      // <br>, not \n: .rtt-desc has no `white-space: pre-line`, so a newline
      // renders as a space and the tier line runs into the sentence.
      desc: delta
              ? `<b>${pick.name}${tierTxt}</b><br>${delta}`
              : (prev && prev.after !== prev.before)
                ? `${pick.name}${tierTxt}\n${prev.before}\n\u2193\n${prev.after}`
                : `Improve your ${NOUN[type]} ${pick.name}${tierTxt}`,
      tier: 'rare', entity: type, rarity: pick.rarity || 'rare', _improve: true,
      apply: () => {
        if (typeof improveEntity !== 'function' || !improveEntity(pick.id)) {
          showMessage(`${pick.name} could not be improved`, 'var(--red)');
          return;
        }
        noteMessage(`\u2191 ${pick.name} improved`, 'var(--gold)');
        if (typeof renderTrickTray === 'function') renderTrickTray();
        if (typeof updateKnackList  === 'function') updateKnackList();
      }
    };
  }

  function makeSleightPayload() {
    const eligible = SLEIGHT_POOL.filter(j => !grantedSleightIds.has(j.id) && sleightOfferable(j) && !offerBanned(j.id));
    if (!eligible.length) return makeTrickPayload(); // fallback
    // pickSleightByRarity excludes by id, so hand it the granted set PLUS whatever
    // this grid has already placed - otherwise the dedupe stops at the prize path.
    const _excl = new Set([...grantedSleightIds, ..._usedThisGrid]);
    const pick = PRIZE ? (pickPrizeSleight() || pickSleightByRarity(1, _excl)[0])
                       : pickSleightByRarity(1, _excl)[0];
    if (!pick) return makeTrickPayload();
    _usedThisGrid.add(pick.id);
    return {
      icon: pick.emoji || '\u{1F0CF}', emoji: pick.emoji || '\u{1F0CF}', label: pick.name, desc: pick.desc, tier: pick.rarity || 'rare',
      entity: 'sleight', rarity: pick.rarity || 'rare',
      uses: (pick.durability === 'infinite' || pick.durability == null) ? '∞' : pick.durability,
      apply: () => grantSleight(pick)
    };
  }

  // Pre-pick a specific Knack (like tricks/sleights) so the tile shows its
  // emoji + name + rarity - not a generic "Knack" placeholder.
  function makeKnackPayload() {
    if (typeof KNACK_POOL === 'undefined') return { icon: '♛', label: 'Knack', tier: 'rare', entity: 'knack', rarity: 'rare', apply: applyRewardKnack };
    const owned = new Set((acquiredKnacks || []).map(t => t.id));
    let eligible = KNACK_POOL.filter(t => !owned.has(t.id) && !offerBanned(t.id));
    if (!eligible.length) return makeTrickPayload(); // fallback - all knacks owned
    eligible = freshPool(eligible);
    // Same rarity table as Tricks, for the same reason - KNACK_POOL is 24 common /
    // 23 rare / 1 epic, so a flat draw was very nearly a coin flip for a rare.
    const pick = pickByRarity(eligible, t => (t.rarity || 'common'), TRICK_TIER_W, TRICK_TIERS)
              || eligible[Math.floor(Math.random() * eligible.length)];
    _usedThisGrid.add(pick.id);
    return {
      icon: pick.emoji, emoji: pick.emoji, label: pick.name, desc: pick.desc,
      tier: pick.rarity || 'common', rarity: pick.rarity || 'common', entity: 'knack',
      apply: () => { acquiredKnacks.push({ ...pick }); updateKnackList?.(); noteMessage(`+ ${pick.name}`, 'var(--gold)'); }
    };
  }

  // Blessed-card buff: a specific shown card gains a permanent bonus.
  function makeBlessedPayload() {
    // ONE card out of the run, not one rank+suit: a blessing lands on the card the
    // tile names and on no other copy of it.
    const _all = everyDeckCard();
    if (!_all.length) return null;
    const card = _all[Math.floor(Math.random() * _all.length)];
    const rank = card.rank, suit = card.suit;
    // Three blessings, worded by buffOfferLine (js/deck-grid.js) rather than by
    // hand - r209's point was that FLAT and SCALING must be told apart in the
    // words, and r294's is that saying it TWO WAYS in five places is how they
    // came to differ by one verb. Flat is the word BUFF; scaling is SCALES.
    const face = `${rank}${suit}`;
    const bless = (icon, label, tier, e) => ({ icon, label, tier, cardFace: { rank, suit },
      desc: buffOfferLine(e, face, false),
      apply: () => { const t = resolveDeckCard(card); if (!t) return;
        enhanceCardKey(cardId(t), e);
        noteMessage(`${face}: ${buffOfferName(e)}`, 'var(--gold)'); } });
    // r391: THE FLOW CARD OPTIONS replace the old blessings (owner). A tile is
    // either a CARD PACK (3 buffed cards join the deck) or one of the deck
    // editor's BUFF OPS landing on the named card and up to 2 more at random,
    // value rolled weighted-low from the same table (FLOWR_DECK_OPS). Odds are
    // a guess, pending the card-effect probability table (TODO.md).
    if (typeof FLOWR_DECK_OPS !== 'undefined' && Math.random() < 0.35 && typeof flowrBuildPacks === 'function') {
      const pack = flowrBuildPacks()[0];
      if (pack) return { icon: '🃏', label: 'Card Pack', tier: 'epic',
        cardFace: { rank: pack.ranks[0], suit: pack.suit },
        desc: `${pack.ranks.length} cards join your deck: ${pack.ranks.map(r => r + pack.suit).join(', ')}. Each one scores ${pack.label}.`,
        apply: () => flowrGrantPack(pack) };
    }
    if (typeof FLOWR_DECK_OPS !== 'undefined') {
      // r444: buff ops only. The DUAL op (pick touching cards on next round's
      // board) stays in Flow's chain; on a reward grid it took over a round.
      const op = flowrDrawOps(1, FLOWR_DECK_OPS.filter(o => o.buff))[0];   // r392: weighted
      const v = flowrValRoll(op.buff.range);
      const lbl = flowrBuffLabel(op.buff, v);
      const n = flowrQtyRoll(3);
      const rare = flowrOpWeight(op) <= 6;
      return { icon: op.icon, label: op.name, tier: rare ? 'epic' : 'rare', cardFace: { rank, suit },
        desc: `${face} and ${n - 1 > 0 ? `up to ${n - 1} more random card${n - 1 === 1 ? '' : 's'}` : 'no other card'} score ${lbl}.`,
        apply: () => {
          const t = resolveDeckCard(card); const picks = t ? [t] : [];
          const rest = everyDeckCard().filter(cd => cd !== t && !(typeof isWildCard === 'function' && isWildCard(cd)));
          while (picks.length < n && rest.length) picks.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
          picks.forEach(cd => enhanceCardKey(cardId(cd), { [op.buff.key]: v }));
          noteMessage(`${op.icon} ${lbl} on ${picks.length} card${picks.length === 1 ? '' : 's'}`, 'var(--gold)'); } };
    }
    return bless('✨', 'Blessed Card', 'rare', { pips: 12 });
  }
  function makeLimitUpPayload() {
    // EVERY LIMIT HAS ITS OWN STEP, and this tile used to ignore all of them: it
    // printed "+1" and "current → current + 1" whatever it was raising. Two limits
    // do not step by 1 - round_time steps by 15 and focus_cap by 3 - so the tile
    // said "+1 Focus Cap · 30 → 31" and then granted +3. round_time was excluded
    // outright on the strength of the same wrong assumption ("its +1 = 1 second"),
    // which is why a limit tile could never raise your round time at all.
    // incrementLimit was always applying def.step correctly; only the label lied.
    const eligible = LIMITS_DEF.filter(d => limitCanIncrement(d.id));
    if (!eligible.length) return makeTrickPayload();
    const dl = pickWeightedLimits(1, eligible)[0];
    // PRINT THE STEP, not "+1". incrementLimit has always moved a limit by its
    // `step`, while this tile hardcoded 1 in its label, its before/after and its
    // toast - so Focus Cap (step 3) has been quietly paying triple what the tile
    // promised, and Luck (step 10) made it impossible to miss.
    //
    // NOTE (r211): that fix was INERT on its own, because startGame rebuilt the
    // limits table without `step` at all - so `limits[id].step` was undefined here
    // and `|| 1` gave back the very number this was written to stop printing. See
    // the limits reset in js/game-control.js. Seconds also get a unit, or a Round
    // Time tile reads "+15 Round Time" and could be 15 of anything.
    //
    // r227: and the step is still not the gain - at 295/300 Starting Time steps
    // by 15 and moves by 5. limitDeltaText / limitChangeText (js/limits.js) are
    // the one place the printed number is worked out, clamp included.
    const _tx = limitDeltaText(dl.id, 1);
    const _ch = limitChangeText(dl.id, 1);
    return { icon: '⬆️', label: `${_tx} ${dl.label}`, tier: 'epic',
      desc: `${_ch} · permanent`,
      apply: () => { incrementLimit(dl.id); noteMessage(`${_tx} ${dl.label}!`, 'var(--gold)'); } };
  }

  // At most this many limit tiles on a prize grid, INCLUDING the guaranteed Limit
  // Break - so one is guaranteed and two more are the most that can turn up. Past
  // the ceiling the category is dropped from the draw and the slot becomes
  // something else, rather than a limit tile being swapped in after the fact.
  const PRIZE_MAX_LIMIT_TILES = 3;
  let _limitTilesThisGrid = 0;

  function makeBuff() {
    let cats = PRIZE ? prizeCategories : buffCategories;
    if (PRIZE && _limitTilesThisGrid >= PRIZE_MAX_LIMIT_TILES) cats = cats.filter(c => c.kind !== 'limit_up');
    const cat = weightedPick(cats);
    switch (cat.kind) {
      case 'trick':      return makeTrickPayload();
      case 'sleight':   return makeSleightPayload();
      case 'knack':   return makeKnackPayload();
      case 'improve_trick':   return makeImprovePayload('trick');
      case 'improve_knack':   return makeImprovePayload('knack');
      case 'improve_sleight': return makeImprovePayload('sleight');
      case 'discard': return { icon: '🗑', label: '+1 Discard',   tier: 'common',
                               desc: `Next round discards: ${_proj.discards} → ${_proj.discards + 1}`,
                               apply: () => { nextRoundDiscardDelta += 1; noteMessage('+1 discard next round', 'var(--gold)'); } };
      case 'swap':    return { icon: '⚡', label: '+1 Swap',      tier: 'common',
                               desc: `Next round swaps: ${_proj.swaps} → ${_proj.swaps + 1}`,
                               apply: () => { nextRoundSwapDelta += 1; noteMessage('+1 swap next round', 'var(--gold)'); } };
      case 'time':    return { icon: '⏱', label: '+15s Round',   tier: 'common',
                               desc: `Next round starts with +15s`,
                               apply: () => { nextRoundSecondsDelta += 15; noteMessage('+15s next round', 'var(--gold)'); } };
      case 'coins':   return { icon: '💰', label: 'Windfall',     tier: 'common',
                               desc: `Gain 8 coins (${coins} → ${coins + 8}).`,
                               apply: () => { coins += 8; updateCoinsUI(); noteMessage('+8 coins', 'var(--gold)'); } };
      case 'limit_up': {
        // makeLimitUpPayload falls back to a Trick when nothing is upgradeable, so
        // count the tile only when it really is a limit (its ⬆️ icon).
        const t = makeLimitUpPayload();
        if (t && t.icon === '⬆️') _limitTilesThisGrid++;
        return t;
      }
      case 'luck': {
        const n = _luckAmt();
        return { icon: '🍀', label: `+${n} Luck`, tier: _luckTier(n),
                 desc: `Luck ${luckTotal()} → ${luckTotal() + n}. Good chance effects fire more often and better entities turn up. Permanent.`,
                 apply: () => { luckModifiers += n; noteMessage(`+${n} Luck`, 'var(--gold)'); } };
      }
      case 'blessed': return makeBlessedPayload() || makeTrickPayload();
      case 'cleanse':
        // Only meaningful if something is cursed; otherwise fall back to a Trick
        if (!Object.keys(cardCurses).length) return makeTrickPayload();
        return { icon: '🕊️', label: 'Cleanse', tier: 'rare',
                 desc: 'Lift one random curse from your deck.',
                 apply: () => { const _cl = cleanseRandomCurse(); showMessage(_cl ? `Curse lifted: ${_cl.face}` : 'No curses to lift', '#54af88'); } };
      case 'mystery': return { icon: '❓', label: 'Mystery', tier: 'mystery',
                               desc: 'Unknown until claimed. Probably good… probably.',
                               _mystery: true, _goodChance: 0.7,
                               apply: function () { (this._rolled || (this._rolled = rollRewardMystery(this._goodChance))).apply(); } };
    }
  }

  // ── Guaranteed-tile builders (r114) ──
  // A limit-upgrade tile that raises `id` by up to `amount` (permanent). Returns
  // null if the limit is already maxed, so callers can fall back to an alternate.
  // `amount` is how many STEPS to grant, not how many units. It used to be read
  // as units and then applied as `gain` calls to incrementLimit, which agree only
  // while the limit steps by 1 - every id this is called with does, so nothing was
  // wrong, but pointing it at Focus Cap (step 3) would have promised +2 and paid
  // +6. Now it counts steps and asks limits.js what that comes to.
  function makeLimitUpgradeTile(id, steps) {
    const l = limits[id]; if (!l || !limitCanIncrement(id)) return null;
    const def = LIMITS_DEF.find(d => d.id === id);
    const cur = l.current, u = limitUnit(id);
    const next = Math.min(l.max, cur + steps * limitStep(id));
    const gain = next - cur;
    return {
      icon: '⬆️', label: `+${gain}${u} ${def.label}`, tier: 'epic', rarity: 'legendary', _guaranteed: true,
      desc: `${def.label}: ${cur}${u} → ${next}${u} · permanent`,
      apply: () => { for (let k = 0; k < steps; k++) incrementLimit(id); onLimitChanged?.(id); noteMessage(`+${gain}${u} ${def.label}!`, 'var(--gold)'); }
    };
  }
  function makeGrowthTile()      { const o = Math.random()<0.5 ? ['grid_rows','grid_cols'] : ['grid_cols','grid_rows']; for (const id of o) { const t = makeLimitUpgradeTile(id, 1); if (t) return t; } return null; }
  function makeSwapDiscardTile() { const o = Math.random()<0.5 ? ['swaps','discards'] : ['discards','swaps'];         for (const id of o) { const t = makeLimitUpgradeTile(id, 2); if (t) return t; } return null; }
  function makeLimitBreakPayload() {
    return {
      icon: '💥', label: 'Limit Break', tier: 'legendary', rarity: 'legendary', _guaranteed: true,
      desc: 'Break a limit for free - raise any one limit permanently (opens the Limit Break screen; a second break is available for a sacrifice).',
      apply: () => { pendingLimitBreak = true; }
    };
  }
  // Every grid gets a Limit Break; the first 5 grids of a run also get the core
  // growth upgrades (row/col, selection, and +2 swaps/discards) so early runs ramp.
  //
  // The PRIZE grid takes the Limit Break and NOTHING ELSE guaranteed. That ramp is
  // for the opening of a run; in Survival and Flow the prize grid is the only grid
  // there is, so the first boss kill was landing all four on a 9-tile board - four
  // guaranteed limit upgrades stacked in one payout, which is not what a prize is
  // for. It also has a hard ceiling on limit tiles overall (below).
  function buildGuaranteedRewardTiles() {
    if (MINI) return [];
    const out = [ makeLimitBreakPayload() ];
    if (!PRIZE && rewardGridsSeen <= 5) {
      out.push(makeGrowthTile());
      out.push(makeLimitUpgradeTile('selection', 1));
      out.push(makeSwapDiscardTile());
    }
    return out.filter(Boolean);
  }

  // Checkerboard: (r+c) even → buff/dest slot, (r+c) odd → debuff slot.
  // The PRIZE grid has no debuff half and no destination tile, so every cell is a
  // buff slot and the first index is not spent on a destination.
  const buffPos   = [];
  const debuffPos = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      (PRIZE || (r + c) % 2 === 0 ? buffPos : debuffPos).push([r, c]);

  const shuffledBuff = shuffled(buffPos);

  const grid = Array.from({length: ROWS}, () => Array(COLS).fill(null));

  // One destination in a random buff slot (not on a prize grid - it pays out, it
  // does not route you anywhere).
  // A DESTINATION tile routes the next node ('Next: Shop' / 'Next: Event'), and
  // that only means something in the node flow. Guided buys its stops at the
  // crossroads and MAP mode walks to them as tiles, so in both the override is
  // cleared unread by finishInterludeRoute - the player picks 'Next: Event',
  // pays a tile for it, and NOTHING HAPPENS. Guided was excluded when it landed
  // and the map was missed. Owner's call: on the map an event is an event TILE.
  const NO_DEST = PRIZE || MINI
    || (typeof guidedActive === 'function' && guidedActive())
    || (typeof mapActive === 'function' && mapActive())
    // Survival/Flow reach a STANDARD grid through the pick-of-three's rare
    // reward-grid offer (r311+). Their continuation (finishSurvival) never reads
    // pendingEventOverride, so a destination tile would cost a pick and do
    // nothing - the exact bug the map clause above documents.
    || (typeof survivalActive === 'function' && survivalActive());
  if (!NO_DEST) grid[shuffledBuff[0][0]][shuffledBuff[0][1]] = { kind: 'dest', payload: pickRand(destOptions) };

  // Guaranteed tiles first (protected from the Trick-minimum conversion below)
  const guaranteed = buildGuaranteedRewardTiles();
  // The Limit Break is a limit tile too - seed the ceiling with it so the prize
  // grid can add at most PRIZE_MAX_LIMIT_TILES - 1 more.
  if (PRIZE) _limitTilesThisGrid = guaranteed.filter(p => p.icon === '💥' || p.icon === '⬆️').length;
  let placeIdx = NO_DEST ? 0 : 1;
  for (const payload of guaranteed) {
    if (placeIdx >= shuffledBuff.length) break;
    const [r, c] = shuffledBuff[placeIdx++];
    grid[r][c] = { kind: 'buff', payload };
  }

  // Fill remaining buff positions with ordinary buffs
  for (let i = placeIdx; i < shuffledBuff.length; i++) {
    const [r, c] = shuffledBuff[i];
    grid[r][c] = { kind: 'buff', payload: makeBuff() };
  }

  // Guarantee a minimum number of Trick tiles per grid (owner spec: a reward
  // grid should always offer a real Trick choice - tricks are the connective
  // tissue of builds). Non-trick buffs are converted at random until met.
  // A prize grid is 9 tiles at its smallest, several of them guaranteed upgrades -
  // demanding 5 Tricks there would crowd everything else out.
  const MIN_TRICK_TILES = MIN_TRICK_TILES_FOR(PRIZE || MINI);
  {
    const isTrickTile = cell => cell?.kind === 'buff' && cell.payload && String(cell.payload.icon) === '★';
    let trickCount = 0;
    const convertible = [];
    for (let i = (PRIZE || MINI ? 0 : 1); i < shuffledBuff.length; i++) {
      const [r, c] = shuffledBuff[i];
      if (grid[r][c]?.payload?._guaranteed) continue;   // never overwrite a guaranteed tile
      // An improve tile is not a Trick offer and must not be converted into one.
      // Without this the minimum pass ate every improve-a-Knack and
      // improve-a-Sleight tile before the grid was ever shown.
      if (grid[r][c]?.payload?._improve) continue;
      if (isTrickTile(grid[r][c])) trickCount++;
      else convertible.push([r, c]);
    }
    while (trickCount < MIN_TRICK_TILES && convertible.length) {
      const [r, c] = convertible.splice(Math.floor(Math.random() * convertible.length), 1)[0];
      grid[r][c] = { kind: 'buff', payload: makeTrickPayload() };
      trickCount++;
    }
  }

  // Fill all debuff positions - weighted, and one-per-grid for the "big" kinds.
  // debuffPos is empty on a prize grid, so this loop simply does not run.
  // (two identical curse/drain/mystery tiles in one grid would be confusing)
  const usedOnce = new Set();
  for (const [r, c] of debuffPos) {
    let pick = null;
    for (let tries = 0; tries < 12; tries++) {
      const cand = weightedPick(debuffs);
      const isOnceKind = cand.cardFace || cand.icon === '⬇️' || cand.icon === '🐈‍⬛' || cand.tier === 'mystery';
      if (isOnceKind && usedOnce.has(cand.label)) continue;
      if (isOnceKind) usedOnce.add(cand.label);
      pick = cand; break;
    }
    grid[r][c] = { kind: 'debuff', payload: pick || pickRand(debuffs) };
  }

  // The tutorial rewrites its FIRST grid into a Trick → liability → Mart row so
  // the reward step can teach the path rule by making the player walk one. Every
  // later grid (and every other mode) passes through untouched.
  _rewardTrickPayloadFactory = makeTrickPayload;
  return (typeof tutorialScriptRewardGrid === 'function') ? tutorialScriptRewardGrid(grid) : grid;
}

// generateRewardContent builds its payload factories as closures, so the only
// way to mint a Trick tile from outside is to capture one on the way past.
let _rewardTrickPayloadFactory = null;
function makeRewardTrickPayload() {
  return _rewardTrickPayloadFactory ? _rewardTrickPayloadFactory()
                                    : { icon: '★', label: 'Trick', tier: 'rare', entity: 'trick', rarity: 'rare', apply: applyRewardRandomTrick };
}

// ── Mystery tile resolution ──
// goodChance ∈ [0,1]: buff-slot Mystery = 0.7, debuff-slot Dark Mystery = 0.3.
// Effects are deliberately simple + self-contained (no Trick grants - a
// tray-full replace picker popping out of a mystery would be jarring).
// Roll a Mystery outcome WITHOUT applying it, so the reward-resolve animation can
// morph the tile into what it becomes, show its tooltip, THEN apply the SAME
// outcome. Each outcome carries { good, icon, label, desc, flyTo, apply }.
function rollRewardMystery(goodChance) {
  const good = Math.random() < goodChance;
  if (good) {
    const roll = Math.floor(Math.random() * 5);
    if (roll === 0) return { good, icon:'💰', label:'+12 Credits', flyTo:'coins', desc:'Gain 12 credits.',
      apply:()=>{ coins += 12; updateCoinsUI(); showMessage('Mystery: +12 coins!', 'var(--gold)'); } };
    if (roll === 1) return { good, icon:'⚡', label:'+2 Swaps', flyTo:'swaps', desc:'+2 swaps next round.',
      apply:()=>{ nextRoundSwapDelta += 2; showMessage('Mystery: +2 swaps next round!', 'var(--gold)'); } };
    if (roll === 2) return { good, icon:'🗑', label:'+2 Discards', flyTo:'discards', desc:'+2 discards next round.',
      apply:()=>{ nextRoundDiscardDelta += 2; showMessage('Mystery: +2 discards next round!', 'var(--gold)'); } };
    if (roll === 3) return { good, icon:'⏱', label:'+25s Round', flyTo:'clock', desc:'Next round starts with +25 seconds.',
      apply:()=>{ nextRoundSecondsDelta += 25; showMessage('Mystery: +25s next round!', 'var(--gold)'); } };
    const _all = everyDeckCard();
    const _c = _all.length ? _all[Math.floor(Math.random()*_all.length)] : null;
    const rank = _c ? _c.rank : '?', suit = _c ? _c.suit : '';
    return { good, icon:'✨', label:`Blessed ${rank}${suit}`, flyTo:'deck', desc:`${rank}${suit} permanently gains +10 pips.`,
      apply:()=>{ const t = resolveDeckCard(_c); if (!t) return; const k = cardId(t); permPips[k] = (permPips[k]||0)+10; showMessage(`Mystery: ${rank}${suit} +10 pips!`, 'var(--gold)'); } };
  }
  const roll = Math.floor(Math.random() * 5);
  if (roll === 0) return { good, icon:'💸', label:'-8 Credits', flyTo:'coins', desc:'Lose 8 credits.',
    apply:()=>{ coins = Math.max(0, coins - 8); updateCoinsUI(); showMessage('Mystery: -8 coins…', 'var(--red)'); } };
  if (roll === 1) return { good, icon:'✖', label:'-1 Swap', flyTo:'swaps', desc:'-1 swap next round.',
    apply:()=>{ nextRoundSwapDelta -= 1; showMessage('Mystery: -1 swap next round…', 'var(--red)'); } };
  if (roll === 2) return { good, icon:'☁', label:'-15s Round', flyTo:'clock', desc:'Next round starts with 15 fewer seconds.',
    apply:()=>{ nextRoundSecondsDelta -= 15; showMessage('Mystery: -15s next round…', 'var(--red)'); } };
  if (roll === 3) return { good, icon:'🪨', label:'Stone', flyTo:'deck', desc:'A Stone slips into your deck. It blocks a cell until purged.',
    apply:()=>{ injectStonesIntoDeck(1); showMessage('Mystery: a Stone slips into your deck…', 'var(--red)'); } };
  return { good, icon:'🩸', label:'Curse', flyTo:'deck', desc:'A random card in your deck is cursed.',
    apply:()=>{ const v = curseRandomCard(); showMessage(v ? `Mystery: ${v.rank}${v.suit} cursed (${CURSE_DEFS[v.curse].name})…` : 'Mystery: …nothing?', '#9b59b6'); } };
}
function resolveRewardMystery(goodChance) { rollRewardMystery(goodChance).apply(); }

// Put a Trick in the tray. Use this any time a Trick is granted.
// THE chokepoint every Trick grant passes through - the shop, the reward grid,
// every event, both picks, the wheel and the dev panel. Returns false when the
// grant was refused, so a caller about to charge for one can check first.
function injectTrickAfterReward(trick) {
  if (!trick) return false;
  // Slots full: REFUSED, not queued (r277). Selling is how a slot is freed.
  // Guarding here as well as at the selection sites is deliberate - plenty of
  // grants arrive with nothing to select (a wheel prize, an event payout, a
  // Mystery tile), and those have to bounce rather than vanish.
  if (trickTrayFull()) return refuseTrickCapacity();
  trickTray.push(trick);
  selectTrick(trick, true);
  renderTrickTray();
  return true;
}

// "A random Trick" - the Crossroads sacrifice trade, and makeTrickPayload's
// fallback when a grid's pool is exhausted. It drew FLAT from the whole pool
// until r203, which on a 177-Trick pool made it a 31% shot at epic-or-better
// every time. On the rarity table now, like every other offer.
function applyRewardRandomTrick() {
  if (typeof TRICK_POOL === 'undefined') return;
  const owned = new Set((acquiredTricks || []).map(b => b.id));
  const eligible = TRICK_POOL.filter(b => !owned.has(b.id) && !offerBannedGlobal(b.id));
  if (eligible.length === 0) return;
  const pick = pickTrickByRarity(eligible) || eligible[Math.floor(Math.random() * eligible.length)];
  injectTrickAfterReward(pick);
}
function applyRewardLoseTrick() {
  const options = trickTray.map((trick, idx) => ({ trick, source: 'tray', idx }));
  if (options.length === 0) { showMessage('No Tricks to lose', 'var(--cream-dim)'); return; }
  openTrickLosePicker(options);
}

let _blpOptions   = [];
let _blpSelected  = -1;

// Trick tiers and entity rarities are the same four words, but a Trick can carry
// a tier the tile has no colour for - fall back rather than paint nothing.
const BLP_TIERS = ['common', 'rare', 'epic', 'legendary'];
function blpRarity(tier) {
  const t = String(tier || '').toLowerCase();
  return BLP_TIERS.includes(t) ? t : 'common';
}

// ONE job now: a debuff is taking a Trick off you. The 'replace' mode this
// screen used to double as went with the replace picker in r277.
function openTrickLosePicker(options) {
  document.getElementById('blp-eyebrow').textContent = 'Forfeit';
  document.getElementById('blp-title').textContent = 'CHOOSE A TRICK TO LOSE';
  document.getElementById('blp-sub').textContent = 'Select one - it will be removed permanently.';
  document.getElementById('blp-confirm').textContent = 'Remove Selected';
  const inc = document.getElementById('blp-incoming');
  if (inc) { inc.innerHTML = ''; inc.classList.remove('show'); }
  _blpOptions  = options;
  _blpSelected = -1;
  const cap = (typeof trickCapacity === 'function') ? trickCapacity() : options.length;
  document.getElementById('blp-count').textContent = `${trickTray.length} / ${cap}`;
  const list = document.getElementById('blp-list');
  list.innerHTML = '';
  options.forEach((opt, i) => {
    const el = document.createElement('div');
    el.className = 'blp-item rar-' + blpRarity(opt.trick.tier);
    // Same tile as the reward grid, the Mart shelf and your own tray, so what
    // you are giving up is recognisable at a glance instead of being a line of text.
    el.innerHTML = `<div class="blp-item-tile">${entityTileHTML(
                        { entity:'trick', label: opt.trick.name, emoji: trickEmoji(opt.trick) },
                        blpRarity(opt.trick.tier))}</div>`
                 + `<div class="blp-item-body">`
                 +   `<div class="blp-item-tier">${opt.trick.tier || 'common'}</div>`
                 +   `<div class="blp-item-name">${opt.trick.name}</div>`
                 +   `<div class="blp-item-desc">${colorizeKeywords(opt.trick.desc || '')}</div>`
                 + `</div>`
                 + `<div class="blp-item-mark">✕</div>`;
    el.addEventListener('click', () => selectBLPItem(i));
    list.appendChild(el);
  });
  document.getElementById('blp-confirm').disabled = true;
  document.getElementById('trick-lose-picker').classList.add('show');
  // The panel is reused, so it reopens wherever it was last scrolled to - which
  // hides the title and the incoming tile under the sticky bar.
  const panel = document.getElementById('blp-panel');
  if (panel) panel.scrollTop = 0;
  fitEntityNames(list, '.rwd-name', { maxLines: 3 });
}

function selectBLPItem(i) {
  _blpSelected = i;
  document.querySelectorAll('.blp-item').forEach((el, idx) => el.classList.toggle('selected', idx === i));
  document.getElementById('blp-confirm').disabled = false;
}

function confirmTrickLosePicker() {
  if (_blpSelected < 0) return;
  const opt = _blpOptions[_blpSelected];
  if (!opt) return;
  document.getElementById('trick-lose-picker').classList.remove('show');
  document.getElementById('blp-incoming').classList.remove('show');

  if (opt.source === 'tray') {
    trickTray.splice(opt.idx, 1);
    const ai = acquiredTricks.findIndex(b => b.id === opt.trick.id);
    if (ai >= 0) acquiredTricks.splice(ai, 1);
    showMessage(`- ${opt.trick.name}`, 'var(--red)');
    renderTrickTray();
  } else {
    gridData[opt.r][opt.c] = null;
    const ai = acquiredTricks.findIndex(b => b.id === opt.trick.id);
    if (ai >= 0) acquiredTricks.splice(ai, 1);
    showMessage(`- ${opt.trick.name}`, 'var(--red)');
    render();
  }
}
function applyRewardPipsCard() {
  const cells = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r][c];
    if (card && !card._isTrick && !card._isStone) cells.push(card);
  }
  if (cells.length === 0) return;
  const card = cells[Math.floor(Math.random() * cells.length)];
  const k = cardId(card);
  permPips[k] = (permPips[k] || 0) + 10;
  render();
  showMessage('+10 PIPS', 'var(--gold)');
}
function applyRewardKnack() {
  if (typeof KNACK_POOL === 'undefined') { showMessage('+ KNACK', 'var(--gold)'); return; }
  const owned = new Set((acquiredKnacks || []).map(t => t.id));
  const eligible = KNACK_POOL.filter(t => !owned.has(t.id));
  if (eligible.length === 0) return;
  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  acquiredKnacks.push({ ...pick });
  updateKnackList?.();   // refresh the HUD + apply limit-setting knacks (Tempo)
  showMessage(`+ ${pick.name}`, 'var(--gold)');
}

// The post-boss payout. Sets the mode, then runs the ordinary reward-grid open -
// everything downstream (render, selection, confirm, apply, close) reads its
// dimensions from rewardCells, so nothing else needs to know the grid is smaller.
function openPrizeGrid() {
  rewardGridMode = 'prize';
  openRewardGrid();
}

let rewardSwapReady = false, rewardSwapLift = null, rewardTapKey = null, rewardTapAt = 0;
function openRewardGrid() {
  gameTimerPaused = true;
  if (!penaltyGridActive() && !miniGridActive()) rewardGridsSeen++;   // count this grid (gates the first-5 guaranteed upgrades)
  rewardCells     = generateRewardContent();
  rewardSelected  = new Set();
  rewardPickOrder = [];
  rewardTipKey    = null;
  rewardConfirmed = false;
  rewardOnGrid    = true;
  // Last Swap: ready only if the round ended on exactly one swap. Spent on use.
  rewardSwapReady = hasKnack('last_swap') && swaps === 1;
  rewardSwapLift = null; rewardTapKey = null; rewardTapAt = 0;
  if (rewardSwapReady) showMessage('Last Swap: double-tap a tile, then tap a neighbour to trade them', 'var(--c-mint)');
  // The reward grid now lives ON the play grid (r100). Reveal the board: drop the
  // interlude dark veil (showNextGoalFlash re-adds it later) and repurpose the
  // Play/Discard buttons into Confirm/Clear.
  document.getElementById('next-goal-bg')?.classList.remove('show');
  document.body.classList.add('reward-active');
  // Boss reward grids (post-boss-win, nodeInAct 5; or timer-mode boss context) tint red;
  // ordinary reward grids stay teal (see the per-screen #stage backgrounds).
  // The post-boss grid tints red. This tested ACTIVE_MODE.id === 'normal', which
  // missed every OTHER act mode - Six Suits, Spectrum, Orientation and now Guided
  // all route their post-boss prize grid through here with nodeInAct 5 and were
  // silently getting the ordinary tint. isActMode() is the real question.
  document.body.classList.toggle('reward-boss', !miniGridActive() && (rewardGridContext === 'boss' || (isActMode() && nodeInAct === 5)));
  document.body.classList.toggle('reward-prize', prizeGridActive());
  document.body.classList.toggle('reward-penalty', penaltyGridActive());
  if (penaltyGridActive()) document.body.classList.remove('reward-boss');
  if (typeof enterGridScreenHud === 'function') enterGridScreenHud(prizeGridActive() ? 'PRIZE' : penaltyGridActive() ? 'PENALTIES' : miniGridActive() ? 'BONUS' : 'REWARDS', 'reward');
  enterRewardButtonMode();
  renderRewardTiles(true);   // deal the reward tiles in like a new round's cards
}

// Render the reward cells INTO the play #grid, positioned exactly like cards
// (same cellLeft/cellTop + CARD_W/CARD_H metrics), so the reward step happens
// on the board itself instead of a separate overlay.
// animateIn: on first open, drop each tile in with the same fall/bounce the
// round-start deal uses (startNewRoundDealAnims). Selection re-renders skip it.
function renderRewardTiles(animateIn = false) {
  const gridEl = document.getElementById('grid');
  if (!gridEl || !rewardCells.length) return;
  recomputeGridMetrics();          // make sure CARD_W/H + #grid box are current
  hideRewardTooltip();
  gridEl.innerHTML = '';
  const ROWS = rewardCells.length, COLS = rewardCells[0]?.length || 0;
  // The prize grid is smaller than the play grid it is drawn onto, and cellLeft/
  // cellTop are anchored at the board's top-left corner - so without this it
  // would sit in the corner with a wedge of empty board beside it. Centre it on
  // the board instead; the tiles keep their normal card size.
  const offX = Math.round(Math.max(0, gridCols - COLS) / 2 * (CARD_W + CARD_GAP));
  const offY = Math.round(Math.max(0, gridRows - ROWS) / 2 * (CARD_H + CARD_GAP));

  // Deal-in timing (mirrors startNewRoundDealAnims)
  const FALL_DUR = 420, COL_OFFSET = 55, BOUNCE = 8, SQUISH = 0.10;
  const dealAnimsLocal = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = rewardCells[r][c];
      if (!cell) continue;
      const key    = `${r}-${c}`;
      const isSel   = rewardSelected.has(key);
      const canSel  = isRewardCellSelectable(r, c);
      const p       = cell.payload;

      const div = document.createElement('div');
      div.className = [
        'reward-cell', 'on-grid', cell.kind,
        p.entity ? 'entity' : '',
        p.entity ? 'entity-' + p.entity : '',
        p.entity ? 'rar-' + rewardRarity(p) : '',
        // The improvement tier's bands + shutter material (r274). This surface
        // builds its own cell from entityTileInner, so it adds the class itself.
        p.entity ? entityTierClass(p) : '',
        isSel   ? 'selected'    : '',
        rewardSwapLift === key ? 'shop-lifted' : '',
        !isSel && canSel  ? 'selectable'  : '',
        !isSel && !canSel ? 'unselectable': '',
      ].filter(Boolean).join(' ');
      div.style.left   = (cellLeft(c) + offX) + 'px';
      div.style.top    = (cellTop(r)  + offY) + 'px';
      div.style.width  = CARD_W + 'px';
      div.style.height = CARD_H + 'px';
      div.dataset.r = r; div.dataset.c = c;
      div.dataset.floatKey = `reward-${r}-${c}`;   // keeps this tile's float phase across re-renders
      div.innerHTML = buildRewardTileInner(p);
      div.onclick = () => onRewardCellClick(r, c);
      // Every tile with a description gets the hover tooltip - including card-face
      // tiles (blessed/cursed/cull) so curses & buffs are explained on hover.
      if (p.desc) attachRewardTooltip(div, p, cell.kind);

      gridEl.appendChild(div);
      const nameEl = div.querySelector('.rwd-name');
      if (nameEl) fitRewardName(nameEl);

      if (animateIn) {
        const dropDist = (ROWS - r) * CARD_STEP;
        const delay    = c * COL_OFFSET + (ROWS - 1 - r) * 18;
        dealAnimsLocal.push(div.animate([
          { opacity: 0, transform: `translateY(${-dropDist}px) scaleY(1)` },
          { opacity: 1, transform: `translateY(${-dropDist}px) scaleY(1)`,                        offset: 0.06 },
          { opacity: 1, transform: `translateY(${-dropDist * 0.45}px) scaleY(0.96)`,              offset: 0.55, easing: 'ease-in' },
          { opacity: 1, transform: `translateY(${BOUNCE}px) scaleY(${1 - SQUISH})`,               offset: 0.83 },
          { opacity: 1, transform: `translateY(${-BOUNCE * 0.7}px) scaleY(${1 + SQUISH})`,        offset: 0.91 },
          { opacity: 1, transform: `translateY(${BOUNCE * 0.3}px) scaleY(${1 - SQUISH * 0.2})`,   offset: 0.96 },
          { opacity: 1, transform: 'translateY(0) scaleY(1)' },
        ], { duration: FALL_DUR, delay, easing: 'ease-in', fill: 'both' }));
      }
    }
  }
  updateRewardButtons();
  // The live x/y readout, here rather than in render(): a reward tile click calls
  // renderRewardTiles() directly and never goes through render(), so wiring it there
  // alone left the count frozen at 0 for the whole reward step.
  if (typeof updateSelectionUI === 'function') updateSelectionUI();
  // The marked row / column lines stay on the board while you pick (js/entity-fx.js).
  // They are part of how the board reads, and the reward step is exactly when a
  // player is deciding whether another line-marking Trick is worth taking - so
  // hiding the ones already down is hiding the thing the choice is about.
  // gridEl.innerHTML = '' above took the old ones with it, so this redraws them,
  // and the grid being drawn is passed explicitly: a prize grid is smaller than
  // the play board and centred on it, so the lines have to be clamped and offset
  // to match the tiles rather than the board underneath them.
  if (typeof renderLineMarkers === 'function') {
    renderLineMarkers({ rows: ROWS, cols: COLS, offX, offY });
  }
  // The tiles were just thrown away and rebuilt, so the pinned tooltip has to be
  // re-anchored to the new node for the tile it belongs to (r182).
  restoreRewardTooltip();

  if (animateIn && dealAnimsLocal.length) {
    rewardDealing = true;
    Promise.allSettled(dealAnimsLocal.map(a => a.finished)).then(() => {
      rewardDealing = false;
      // The deal-in runs with fill:'both', so its final keyframe would keep
      // overriding the CSS transform forever - cancel it to hand the transform
      // back to the float (its last keyframe is identity, so nothing moves).
      dealAnimsLocal.forEach(a => { try { a.cancel(); } catch (e) {} });
      startRewardFloat();
    });
  } else if (rewardOnGrid) {
    startRewardFloat();
  }
}

// Reward tiles drift with the same barely-there float as the shop (js/float-anim.js).
// Held still while a tile is mid-resolve so the reward payoff animation reads cleanly.
const REWARD_FLOAT_SEL = '#grid .reward-cell.on-grid';
function startRewardFloat() { startFloat('reward', REWARD_FLOAT_SEL, el => el.classList.contains('resolving')); }
function stopRewardFloat()  { stopFloat('reward'); clearFloat(REWARD_FLOAT_SEL); clearFloatSeeds('reward-'); }

function updateRewardButtons() {
  const hasAny = rewardSelected.size > 0;
  const play = document.getElementById('btn-play');
  const disc = document.getElementById('btn-discard');
  // CONFIRM needs the minimum; CLEAR only needs something to clear, or a short
  // pick would strand the player with no way to undo it.
  if (play) play.disabled = !rewardPicksMet();   // CONFIRM
  if (disc) disc.disabled = !hasAny;             // CLEAR
}

// Repurpose the two action buttons for the reward step (green CONFIRM / yellow CLEAR).
// Original markup is captured once and restored on exit.
let _origPlayHTML = null, _origDiscardHTML = null, _origSwapHTML = null;
function enterRewardButtonMode() {
  const play = document.getElementById('btn-play');
  const disc = document.getElementById('btn-discard');
  const swap = document.getElementById('swap-indicator');
  if (play) {
    if (_origPlayHTML === null) _origPlayHTML = play.innerHTML;
    play.classList.add('reward-buy');
    play.innerHTML = 'C<br>O<br>N<br>F<br>I<br>R<br>M';
    play.disabled = true;
  }
  if (disc) {
    if (_origDiscardHTML === null) _origDiscardHTML = disc.innerHTML;
    disc.classList.add('reward-clear');
    disc.innerHTML = 'C<br>L<br>E<br>A<br>R';
    disc.disabled = true;
  }
  // Repurpose the swap indicator slot into a SKIP button for the reward step (always available -
  // it's the "take nothing" alternative to Confirm, which needs ≥1 pick).
  if (swap) {
    if (_origSwapHTML === null) _origSwapHTML = swap.innerHTML;
    swap.classList.add('reward-skip');
    // Label states the payout so the "take nothing" option is never a blind choice.
    // Rain Check (Trick) adds its seconds to the label too, since it changes what SKIP is worth.
    swap.innerHTML = `<span class="rskip-word">SKIP</span><span class="rskip-arrow">\u2193</span>`
                   + `<span class="rskip-gain">+${BAL.reward_skip.gold}\u00a0\ud83d\udcb0</span>`
                   + (hasTrick('rain_check') ? `<span class="rskip-gain rskip-gain-time">+${BAL.rain_check.seconds}s</span>` : '');
    swap.onclick = skipRewardGrid;
    // The penalty grid has no skip: the slot says how many you must take.
    if (penaltyGridActive()) swap.innerHTML = `<span class="rskip-word">TAKE</span><span class="rskip-gain">${penaltyPickCount()}</span>`;
  }
}
function exitRewardButtonMode() {
  const play = document.getElementById('btn-play');
  const disc = document.getElementById('btn-discard');
  const swap = document.getElementById('swap-indicator');
  if (play && _origPlayHTML !== null) { play.classList.remove('reward-buy');  play.innerHTML = _origPlayHTML; }
  if (disc && _origDiscardHTML !== null) { disc.classList.remove('reward-clear'); disc.innerHTML = _origDiscardHTML; }
  if (swap && _origSwapHTML !== null) { swap.classList.remove('reward-skip'); swap.innerHTML = _origSwapHTML; swap.onclick = null; }
}

// Skip the reward grid: take no tiles, collect a baseline gold payout (placeholder), and - with
// Rain Check - bank extra seconds for next round. Then close the step normally (node still advances).
function skipRewardGrid() {
  if (rewardConfirmed || rewardDealing) return;
  if (penaltyGridActive()) { refuse(`Pick ${penaltyPickCount()} penalties`); return; }
  rewardConfirmed = true;
  coins += BAL.reward_skip.gold; updateCoinsUI();
  let _msg = `Skipped rewards · +${BAL.reward_skip.gold} gold`;
  if (hasTrick('rain_check')) { nextRoundSecondsDelta += BAL.rain_check.seconds; _msg += ` · +${BAL.rain_check.seconds}s next round`; }
  noteMessage(_msg, 'var(--gold)');
  rewardSelected = new Set(); // abandon any in-progress picks
  rewardPickOrder = []; rewardTipKey = null;
  closeRewardGrid();
}

// ── Reward-entity visuals (LETHE) ────────────────────────────────────────────
// A reward tile can be an "entity" (trick / sleight / knack) rendered in the
// cabinet's CRT/neon language, a card-face tile (blessed/cursed/cull, unchanged),
// or a plain resource/debuff/dest tile (icon + name). Rarity → neon border color.
const REWARD_RARITIES = ['common', 'rare', 'epic', 'legendary'];
function rewardRarity(p) {
  const r = p.rarity || p.tier;
  return REWARD_RARITIES.includes(r) ? r : 'rare';
}
function rewardTypeLabel(p, kind) {
  if (p.entity) return p.entity.charAt(0).toUpperCase() + p.entity.slice(1);
  if (kind === 'debuff') return 'Penalty';
  if (kind === 'dest')   return 'Destination';
  return 'Reward';
}
// The reward grid's tile contents come from the shared builder (js/entity-tile.js)
// so a Trick/Sleight/Knack is drawn identically here, in the Mart, in your tray
// and in the cart. `mystery` is the grid's one deliberate difference: a Trick you
// have not picked yet shows a ✦ instead of its category emoji.
function buildRewardTileInner(p) { return entityTileInner(p, { mystery: p.entity === 'trick' }); }
// Owner rule: names never overflow the tile. The name wraps at spaces and a
// too-long single word hyphenates (CSS). Here we shrink the font only if the
// wrapped/hyphenated name is still too tall (more than MAX_LINES) or too wide
// for the tile (e.g. one unbreakable token).
// Shared fitter (js/fit-text.js): soft-hyphenates long words at syllable breaks
// first, then shrinks - so a long name breaks cleanly instead of going tiny.
function fitRewardName(el) { fitEntityName(el, { maxLines: 3, minPx: 6 }); }

let _rewardTT = null;
function ensureRewardTooltip() {
  if (_rewardTT && document.body.contains(_rewardTT)) return _rewardTT;
  _rewardTT = document.createElement('div');
  _rewardTT.id = 'reward-tooltip';
  _rewardTT.innerHTML = `<button class="rtt-close" aria-label="Close">✕</button><span class="rtt-more"></span><div class="rtt-rar"></div><div class="rtt-name"></div><div class="rtt-desc"></div><div class="rtt-defs"></div>`;
  // The ✕ unpins as well as hides: an X'd tooltip must stay closed even though
  // its tile is still the most recently selected one (owner spec, r237).
  _rewardTT.querySelector('.rtt-close').onclick = (e) => {
    e.stopPropagation();
    rewardTipKey = null;
    hideRewardTooltip();
  };
  document.body.appendChild(_rewardTT);
  return _rewardTT;
}
function hideRewardTooltip() { if (_rewardTT) { _rewardTT.classList.remove('show', 'kw-open'); _rewardTT.dataset.key = ''; } }

// ── THE POINTER IS OVER THE BUBBLE (r288) ───────────────────────────────────
// The bubble is pointer-events:none (r170 - at 214px it would otherwise eat the
// clicks meant for the tiles it lies over), so a tile UNDERNEATH it still gets
// `mouseenter` and swaps the bubble to itself. That was harmless while the
// bubble was purely something to read; it is not harmless now there is a + in
// its corner, because reaching that + means crossing the bubble, and every tile
// crossed on the way rebuilt it - measured at 420x820, the rail opened on tile
// 0-0 and was replaced by tile 0-3's bubble in the same gesture.
//
// So the tile-hover re-show stands down while the pointer is inside the bubble.
// Tracked on the document because the bubble itself cannot receive the events.
let _rttPt = { x: -1, y: -1 };
document.addEventListener('pointermove', e => { _rttPt.x = e.clientX; _rttPt.y = e.clientY; }, true);
function pointerOverRewardTip() {
  if (!_rewardTT || !_rewardTT.classList.contains('show')) return false;
  const r = _rewardTT.getBoundingClientRect();
  return _rttPt.x >= r.left && _rttPt.x <= r.right && _rttPt.y >= r.top && _rttPt.y <= r.bottom;
}

// Which tile's tooltip is currently pinned open. This is the tile you most
// recently picked (or last tapped to inspect) - see onRewardCellClick.
let rewardTipKey = null;

// Fill and show the tooltip for one tile, anchored to it.
function showRewardTooltipFor(r, c) {
  // The shop shares this tooltip but keeps its stock in shopGridItems, not
  // rewardCells - reading rewardCells there showed the PREVIOUS reward grid's
  // tile (or nothing), which is why shop tooltips never worked (fixed r237).
  const onShop = (typeof shopGridActive !== 'undefined' && shopGridActive);
  const cell = onShop ? { kind: 'buff', payload: shopGridItems[r]?.[c] } : rewardCells[r]?.[c];
  if (!cell || !cell.payload || !cell.payload.desc) { hideRewardTooltip(); return; }
  const p = cell.payload;
  // Works for the on-board tiles (#grid) and the legacy overlay grid alike.
  const el = document.querySelector(`#grid .reward-cell[data-r="${r}"][data-c="${c}"], #reward-grid .reward-cell[data-r="${r}"][data-c="${c}"]`);
  if (!el) return;
  const tt = ensureRewardTooltip();
  // An OPEN definition rail has to survive a re-show of the SAME tile (r288).
  // This bubble is re-shown constantly: renderRewardTiles rebuilds the tiles and
  // calls restoreRewardTooltip, and the hover rule snaps back to the pinned tile
  // whenever the pointer leaves one - which is exactly what moving the pointer
  // onto the + does when the bubble is sitting over a tile (portrait). Without
  // this the rail opened and was rebuilt shut in the same gesture.
  const wasOpen = tt.dataset.key === `${r}-${c}` && tt.classList.contains('kw-open');
  tt.className = 'rar-' + rewardRarity(p);   // also clears kw-open from another tile
  tt.dataset.key = `${r}-${c}`;
  tt.querySelector('.rtt-rar').textContent  = (p.entity ? rewardRarity(p) + ' · ' : '') + rewardTypeLabel(p, cell.kind);
  tt.querySelector('.rtt-name').textContent = p.label;
  // Tricks show their current bonus value in () via trickLiveDesc (N/A here in
  // the reward grid for round-scoped tricks - the round isn't live yet).
  const descText = (p._trick && typeof trickLiveDesc === 'function') ? trickLiveDesc(p._trick) : (p.desc || '');
  tt.querySelector('.rtt-desc').innerHTML   = colorizeKeywords(descText);
  // r288 - definitions are never shown unasked; the + in the corner opens them.
  // The chip is rebuilt with the text, so it is re-wired on every show.
  tt.querySelector('.rtt-more').innerHTML = kwMoreHTML(descText);
  tt.querySelector('.rtt-defs').innerHTML = kwDefsHTML(descText);
  tt.classList.toggle('kw-open', wasOpen);
  const _sign = tt.querySelector('.kw-more-sign');
  if (_sign && wasOpen) _sign.textContent = '\u2212';
  // Opening the rail PINS the tile, the same "you asked for this, so it stays"
  // rule the entity tooltip's sticky mode follows. A hover-preview bubble is
  // thrown away by the next renderRewardTiles (restoreRewardTooltip hides it
  // outright when nothing is pinned), which would take the rail with it.
  wireKwMore(tt, tt, (open) => {
    if (open) rewardTipKey = `${r}-${c}`;
    if (onShop) placeTipBelow(el, tt, { gap: 10 }); else placeTipSmart(el, tt, { gap: 12 });
  });
  tt.classList.add('show');
  // Placement. The SHOP uses the boss-peek / hand-log rule (r254): centred on
  // the tile, below when there is room, flipped above when not, clamped - the
  // roomiest-side rule kept opening the bubble sideways across the very shelf
  // being read. The reward grid keeps roomiest-side: its picks are a connected
  // path, and a bubble below the tile would sit on the next tile to take.
  if (onShop) placeTipBelow(el, tt, { gap: 10 });
  else { placeTipSmart(el, tt, { gap: 12 }); placeTipOffBoard(el, tt, 12); }
}

// Landscape: the bubble sits beside the WHOLE board (the free side with room),
// never over a neighbouring tile - the picks are a connected path, so a bubble
// on the next tile hides the very thing being chosen.
function placeTipOffBoard(el, tt, gap) {
  if (!document.getElementById('stage')?.classList.contains('landscape')) return;
  const cells = [...document.querySelectorAll('#grid .reward-cell')];
  if (!cells.length) return;
  let L = Infinity, R = -Infinity;
  cells.forEach(c => { const b = c.getBoundingClientRect(); L = Math.min(L, b.left); R = Math.max(R, b.right); });
  const a = el.getBoundingClientRect(), w = tt.offsetWidth, h = tt.offsetHeight, PAD = 6;
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = L - gap - w;
  if (x < PAD) x = R + gap;
  if (x + w > vw - PAD) return;   // no clear side: keep placeTipSmart's spot
  tt.style.left = Math.round(x) + 'px';
  tt.style.top  = Math.round(Math.max(PAD, Math.min(a.top + a.height / 2 - h / 2, vh - h - PAD))) + 'px';
}

// Re-show whatever tooltip was up before a re-render, since renderRewardTiles
// throws the tiles away and rebuilds them.
function restoreRewardTooltip() {
  if (!rewardTipKey) { hideRewardTooltip(); return; }
  const [r, c] = rewardTipKey.split('-').map(Number);
  showRewardTooltipFor(r, c);
}

function attachRewardTooltip(el, p, kind) {
  // Mouse hover still previews any tile, but it must not fight the pinned
  // tooltip: leaving a tile snaps back to the tile that is actually pinned
  // rather than leaving the board with nothing explained.
  const r = +el.dataset.r, c = +el.dataset.c;
  el.addEventListener('mouseenter', () => { if (!pointerOverRewardTip()) showRewardTooltipFor(r, c); });
  el.addEventListener('mouseleave', () => { if (!pointerOverRewardTip()) restoreRewardTooltip(); });
  // Touch: press-and-hold PINS the tooltip without acting on the tile. The
  // click that follows the release is swallowed by whoever owns the tile's
  // click (the shop checks el._lpJustFired), so reading never costs a pick.
  let lpTimer = null;
  const arm = () => { lpTimer = setTimeout(() => {
    lpTimer = null;
    el._lpJustFired = true;
    rewardTipKey = `${r}-${c}`;
    showRewardTooltipFor(r, c);
  }, 430); };
  const disarm = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') arm(); });
  el.addEventListener('pointerup', disarm);
  el.addEventListener('pointercancel', disarm);
  el.addEventListener('pointerleave', disarm);
}

function renderRewardGrid() {
  const ROWS = limits.grid_rows.current;
  const COLS = limits.grid_cols.current;
  const gridEl = document.getElementById('reward-grid');
  // Compute cell dimensions to fill the overlay while keeping playing-card aspect ratio.
  // CARD_ASPECT = height/width ≈ 1.316 (matches game grid cards).
  const _hdrH  = document.getElementById('reward-header')?.offsetHeight || 72;
  const _ftrH  = document.getElementById('reward-footer')?.offsetHeight || 60;
  const _padY  = 40;  // overlay: 20px padding top + bottom
  const _padX  = 40;  // overlay: 20px padding left + right
  const _gap   = 8;   // gap between reward cells (px)
  const _avW   = window.innerWidth  - _padX;
  const _avH   = window.innerHeight - _padY - _hdrH - _ftrH - 48; // 48 = grid margin-top+bottom + some buffer
  const _cwW   = Math.floor((_avW - (COLS - 1) * _gap) / COLS);    // max cellW from width budget
  const _cwH   = Math.floor((_avH - (ROWS - 1) * _gap) / ROWS / CARD_ASPECT); // max cellW from height budget
  const _cellW = Math.max(60, Math.min(_cwW, _cwH, 160));           // clamp: min 60, max 160
  const _cellH = Math.round(_cellW * CARD_ASPECT);
  gridEl.style.gridTemplateColumns = `repeat(${COLS}, ${_cellW}px)`;
  gridEl.style.gridTemplateRows    = `repeat(${ROWS}, ${_cellH}px)`;
  gridEl.style.gap = `${_gap}px`;
  gridEl.innerHTML = '';
  hideRewardTooltip();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key  = `${r}-${c}`;
      const cell = rewardCells[r][c];
      const isSel = rewardSelected.has(key);
      const canSel = isRewardCellSelectable(r, c);
      const p = cell.payload;

      const div = document.createElement('div');
      div.className = [
        'reward-cell',
        cell.kind,
        p.entity ? 'entity' : '',
        p.entity ? 'entity-' + p.entity : '',
        p.entity ? 'rar-' + rewardRarity(p) : '',
        isSel   ? 'selected'    : '',
        !isSel && canSel  ? 'selectable'  : '',
        !isSel && !canSel ? 'unselectable': '',
      ].filter(Boolean).join(' ');
      div.dataset.r = r; div.dataset.c = c;
      div.innerHTML = buildRewardTileInner(p);
      div.onclick = () => onRewardCellClick(r, c);

      // Every tile with a description gets the hover tooltip - entities, resource/
      // debuff tiles, AND card-face tiles (blessed/cursed/cull) so curses & buffs
      // are explained on hover.
      if (p.desc) attachRewardTooltip(div, p, cell.kind);

      gridEl.appendChild(div);
      const nameEl = div.querySelector('.rwd-name');
      if (nameEl) fitRewardName(nameEl);
    }
  }

  // Footer
  const items = [...rewardSelected]
    .map(key => { const [r,c] = key.split('-').map(Number); return rewardCells[r][c]; })
    .filter(cell => cell.kind !== 'entry')
    .map(cell => `${cell.payload.icon} ${cell.payload.label}`);
  document.getElementById('reward-collected-list').textContent = items.length ? items.join('  ·  ') : '·';

  // Subtitle: picks counter (Selection Size cap) + destination warning
  const subEl = document.getElementById('reward-sub');
  if (subEl) {
    const selectedDest = [...rewardSelected].find(k => {
      const [sr, sc] = k.split('-').map(Number);
      return rewardCells[sr]?.[sc]?.kind === 'dest';
    });
    const cap = rewardSelectionCap();
    if (typeof updateSelectionUI === 'function') updateSelectionUI();
    const picks = `Picks: ${rewardSelected.size}/${cap}`;
    const atCap = rewardSelected.size >= cap;
    const need  = rewardMinPicks() - rewardSelected.size;
    // Short of the floor, say so and say nothing else - it is the only thing
    // standing between the player and CONFIRM.
    subEl.textContent = need > 0
      ? `${picks} - take ${need} more to confirm, or SKIP to take none.`
      : atCap
        ? `${picks} - selection full. Confirm, or tap a pick to remove it.`
        : selectedDest
          ? `${picks} - destination locked in. Confirm to set your route.`
          : `${picks} - choose a connected group. At most one destination.`;
  }

  const hasAny = rewardSelected.size > 0;
  document.getElementById('reward-confirm').disabled = !rewardPicksMet();
  document.getElementById('reward-clear').disabled   = !hasAny;
}

// Effective reward-grid pick cap = the Selection Size limit + Greedy Boi's reward-grid-only bonus.
function rewardSelectionCap() {
  if (penaltyGridActive()) return penaltyPickCount();
  return limits.selection.current + (hasKnack('greedy_boi') ? BAL.greedy_boi.selection : 0);
}

// ── The minimum applies here too (r214) ──
// Selection Size carries a floor as well as a cap (minSelection(), js/limits.js), and
// until now that floor was the play grid's alone - so raising the limit made hands
// harder to commit while making the reward grid strictly easier. One rule, both grids.
//
// It is derived from minSelection(), NOT from rewardSelectionCap(): Greedy Boi raises
// the ceiling as a reward, and having it raise the floor with it would be a downside
// stapled to a knack that is meant to be pure upside.
// The floor is also held BELOW the cap, so a grid can never demand more picks than it
// will accept - the two come from different places once Greedy Boi is in play.
//
// It reads minSelection(), the RAW arithmetic, and deliberately NOT the play grid's
// handMinSelection(): Tagalong lifts the floor for HANDS (r326) and has nothing to
// say about how many tiles a reward path has to take.
function rewardMinPicks() {
  if (penaltyGridActive()) return penaltyPickCount();   // exactly that many
  const min = (typeof minSelection === 'function') ? minSelection() : 1;
  return Math.max(1, Math.min(min, rewardSelectionCap()));
}
// SKIP is unaffected - taking nothing is a deliberate alternative, not a short pick.
function rewardPicksMet() { return rewardSelected.size >= rewardMinPicks(); }

// A cell is selectable if: nothing selected yet (any cell), OR orthogonally adjacent to any selected cell and not already selected
function isRewardCellSelectable(r, c) {
  const key = `${r}-${c}`;
  if (rewardSelected.has(key)) return false; // already selected
  // Picks are capped by the Selection Size limit (+ Greedy Boi) - same base cap as the play grid
  if (rewardSelected.size >= rewardSelectionCap()) return false;
  // Destination rule: at most one dest tile per selection
  const ROWS = limits.grid_rows.current;
  const COLS = limits.grid_cols.current;
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS && rewardCells[r]?.[c]?.kind === 'dest') {
    const alreadyHasDest = [...rewardSelected].some(k => {
      const [sr, sc] = k.split('-').map(Number);
      return rewardCells[sr]?.[sc]?.kind === 'dest';
    });
    if (alreadyHasDest) return false;
  }
  if (rewardSelected.size === 0) return true; // first pick - anything goes
  // Must be orthogonally adjacent to at least one selected cell
  const neighbors = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
  return neighbors.some(([nr,nc]) => rewardSelected.has(`${nr}-${nc}`));
}

// ── ONE TAP, TWO MEANINGS (r182) ───────────────────────────────────────────
// A reward tile answers two different questions - "what is this?" and "I want
// it" - and the grid now serves both from a single tap, deciding by whether the
// tile is one you could actually take:
//
//   tap a SELECTABLE tile      → select it AND pin its tooltip open
//   tap a NON-ADJACENT tile    → pin its tooltip only; the selection is untouched
//   tap a SELECTED tile        → deselect it and drop its tooltip
//
// So the most recently picked tile is always the one being explained, and you
// can read any tile on the board - including ones you cannot reach from your
// current group - without that reading costing you a pick or disturbing one.
function onRewardCellClick(r, c) {
  if (rewardConfirmed || rewardDealing) return;
  const key = `${r}-${c}`;

  // LAST SWAP: a lifted tile waits for its neighbour; double-tap lifts one.
  if (rewardSwapReady) {
    if (rewardSwapLift) {
      const [lr, lc] = rewardSwapLift.split('-').map(Number);
      if (rewardSwapLift === key) { rewardSwapLift = null; renderRewardTiles(); return; }
      if (Math.abs(lr - r) + Math.abs(lc - c) !== 1) { refuse('Trade with a tile it touches', { color: 'var(--cream-dim)' }); return; }
      const t = rewardCells[lr][lc]; rewardCells[lr][lc] = rewardCells[r][c]; rewardCells[r][c] = t;
      swaps = Math.max(0, swaps - 1);
      rewardSwapReady = false; rewardSwapLift = null; rewardSelected = new Set(); rewardPickOrder = []; rewardTipKey = null;
      try { sfxCardSelect?.(); } catch (e) {}
      noteMessage('Last Swap used', 'var(--c-mint)');
      renderRewardTiles();
      return;
    }
    const now = Date.now();
    if (rewardTapKey === key && now - rewardTapAt < DOUBLE_TAP_MS && rewardCells[r]?.[c]) {
      rewardTapKey = null; rewardTapAt = 0;
      rewardSwapLift = key; rewardSelected = new Set(); rewardPickOrder = []; rewardTipKey = null;
      try { sfxCardSelect?.(); } catch (e) {}
      renderRewardTiles();
      return;
    }
    rewardTapKey = key; rewardTapAt = now;
  }

  // Already selected: tapping it takes it back and clears its bubble. Still only
  // allowed from the fringe - removing a middle tile would split the group.
  if (rewardSelected.has(key)) {
    const remaining = new Set([...rewardSelected].filter(k => k !== key));
    if (remaining.size === 0 || isGroupConnected(remaining)) {
      rewardSelected.delete(key);
      // Hand the tooltip to whatever is now the most recent pick, or nothing.
      if (rewardTipKey === key) rewardTipKey = lastRewardPickKey();
      renderRewardTiles();
    }
    return;
  }

  // Not selectable (not adjacent, cap reached, second destination tile…): this is
  // a read, not a pick. Pin its tooltip and leave the selection exactly as it was.
  if (!isRewardCellSelectable(r, c)) { rewardTipKey = key; restoreRewardTooltip(); return; }

  // A Trick tile you have no room for is refused at SELECTION, not at apply: the
  // path is taken as a whole, so bouncing it later would mean spending a pick on
  // nothing. The tray count says why.
  const _pay = rewardCells[r] && rewardCells[r][c] && rewardCells[r][c].payload;
  if (offerNeedsTrickSlot(_pay)) { refuseTrickCapacity(); return; }

  rewardSelected.add(key);
  if (typeof sfxRewardSelect === 'function') { try { sfxRewardSelect(); } catch (e) {} }
  rewardPickOrder.push(key);
  rewardTipKey = key;               // the newest pick is the one being explained
  renderRewardTiles();
}

// The most recent still-selected pick, for handing the tooltip back after a
// deselect. rewardPickOrder is the order tiles were taken; entries for tiles that
// have since been dropped are skipped.
function lastRewardPickKey() {
  for (let i = rewardPickOrder.length - 1; i >= 0; i--)
    if (rewardSelected.has(rewardPickOrder[i])) return rewardPickOrder[i];
  return null;
}

// BFS connectivity check - ensures remaining selected cells are still one connected group
function isGroupConnected(keySet) {
  if (keySet.size <= 1) return true;
  const [startKey] = keySet;
  const visited = new Set([startKey]);
  const queue = [startKey];
  while (queue.length) {
    const [r, c] = queue.shift().split('-').map(Number);
    [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([nr,nc]) => {
      const nk = `${nr}-${nc}`;
      if (keySet.has(nk) && !visited.has(nk)) {
        visited.add(nk);
        queue.push(nk);
      }
    });
  }
  return visited.size === keySet.size;
}

function clearRewardSelection() {
  if (rewardConfirmed || rewardDealing) return;
  rewardSelected = new Set();
  rewardPickOrder = [];
  rewardTipKey = null;
  renderRewardTiles();
}

// Where a claimed reward flies to on confirm. Entities go to their home bar; the
// deck for sleights. Events (dest) + resource/card-face tiles have no home yet, so
// they (and everything unselected) just fall out.
// Which HUD readout a reward flies to on confirm. Entities go to their bar/deck;
// resource/curse tiles fly to the stat they affect. Events (dest) have no home.
function rewardTargetKey(p) {
  if (!p) return null;
  if (p.entity === 'trick')   return 'tricks';
  if (p.entity === 'sleight') return 'deck';
  if (p.entity === 'knack')   return 'knacks';
  if (p.flyTo) return p.flyTo;                 // mystery outcomes carry flyTo
  const label = (p.label || '').toLowerCase();
  const icon  = p.icon || '';
  if (p.cardFace && !p.entity)                                                    return 'deck';     // r391 card tiles
  if (label.includes('trick'))                                                  return 'tricks';   // Lose a Trick
  if (label.includes('swap'))                                                     return 'swaps';
  if (label.includes('discard'))                                                  return 'discards';
  if (label.includes('windfall') || label.includes('pickpocket') || icon === '💰' || icon === '💸') return 'coins';
  if (label.includes('round') || label.includes('slow') || label.includes('hands') ||
      icon === '⏱' || icon === '☁' || icon === '⌛' || icon === '🐌' || icon === '⏳')             return 'clock';
  if (p.cardFace || label.includes('stone') || label.includes('cleanse') ||
      label.includes('curse') || label.includes('cull') || label.includes('blessed'))               return 'deck';
  return 'deck';                                // limits + anything else: the deck
}
function rewardTargetEl(key) {
  switch (key) {
    case 'tricks':   return document.getElementById('trick-tray-area');
    case 'knacks':   return document.getElementById('knack-carousel-wrap');
    case 'deck':     return document.getElementById('btn-records');
    case 'clock':    return document.getElementById('vclock') || document.getElementById('round-clock');
    case 'swaps':    return document.getElementById('swap-indicator');
    case 'discards': return document.getElementById('btn-discard');
    case 'coins':    return document.getElementById('coin-info') || document.getElementById('coins-display');
  }
  return null;
}
// Add a class, force reflow, so the impact animation replays every time.
function pulseEl(el, cls, ms = 520) {
  if (!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

// Fly one tile to its target (or fall out if none). good → chime + target pop;
// bad → buzz + target jiggle ("took a hit").
async function flyRewardTile(tile, p, good) {
  tile.style.zIndex = '30';
  const target = rewardTargetEl(rewardTargetKey(p));
  if (!target) { await fallRewardTile(tile, 0); return; }
  const a = tile.getBoundingClientRect(), b = target.getBoundingClientRect();
  let dx = (b.left + b.width / 2) - (a.left + a.width / 2);
  let dy = (b.top  + b.height / 2) - (a.top  + a.height / 2);
  // Machine panel: a copy flies, under the housing, to the target screen (js/machine-skin.js).
  let mover = tile;
  if (typeof mcOn === 'function' && mcOn()) { const f = mcFlightClone(tile); mover = f.el; dx /= f.zoom; dy /= f.zoom; }
  await mover.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(0.62)`, opacity: 1, offset: 0.6 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.14)`, opacity: 0 },
  ], { duration: 380, easing: 'cubic-bezier(0.5,0,0.85,1)', fill: 'forwards' }).finished;
  if (mover !== tile) mover.remove();
  if (good) { try { sfxRewardGood(); } catch (e) {} pulseEl(target, 'reward-ding'); }
  else      { try { sfxRewardBad();  } catch (e) {} pulseEl(target, 'reward-hit'); }
}
function fallRewardTile(tile, delay) {
  tile.style.zIndex = '20';
  const r = +tile.dataset.r || 0;
  const dropY = (gridRows - r) * CARD_STEP + 160;
  const spin  = (Math.random() * 18 - 9);
  return tile.animate([
    { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
    { transform: `translateY(${dropY}px) rotate(${spin}deg)`, opacity: 0 },
  ], { duration: 460, delay, easing: 'cubic-bezier(0.4,0,1,1)', fill: 'forwards' }).finished;
}

// Anchor the reward tooltip beside a tile (used by the mystery reveal). If the
// tile is in the right-most column, show it on the LEFT so it stays on-screen.
function showRevealTooltip(tile, out, rightCol) {
  const tt = ensureRewardTooltip();
  tt.className = '';
  tt.style.setProperty('--rc', out.good ? 'var(--c-mint)' : 'var(--c-magenta)');
  tt.querySelector('.rtt-rar').textContent  = out.good ? 'reward' : 'penalty';
  tt.querySelector('.rtt-name').textContent = out.label;
  tt.querySelector('.rtt-desc').innerHTML   = colorizeKeywords(out.desc || '');
  tt.classList.add('show');
  const a = tile.getBoundingClientRect();
  const w = tt.offsetWidth, h = tt.offsetHeight;
  let x = rightCol ? (a.left - w - 10) : (a.right + 10);
  let y = a.top;
  x = Math.max(8, Math.min(x, window.innerWidth  - w - 8));
  y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
  tt.style.left = x + 'px'; tt.style.top = y + 'px';
}

// A claimed Mystery: extra beat → jiggle → morph into its real outcome → tooltip
// beside it 1.5s → fly to the outcome's target.
async function revealAndFlyMystery(tile, p, c, cols) {
  await new Promise(res => setTimeout(res, 300));
  pulseEl(tile, 'reward-mshake');
  try { sfxRewardReveal(); } catch (e) {}
  await new Promise(res => setTimeout(res, 480));

  const out = p._rolled || (p._rolled = rollRewardMystery(p._goodChance ?? 0.7));
  tile.classList.remove('entity', 'entity-trick', 'entity-sleight', 'entity-knack',
    'rar-common', 'rar-rare', 'rar-epic', 'rar-legendary', 'mystery');
  tile.classList.add(out.good ? 'reward-good' : 'reward-bad', 'reward-revealed');
  tile.innerHTML = `<div class="reward-icon">${out.icon}</div><div class="rwd-name">${out.label}</div>`;
  const nm = tile.querySelector('.rwd-name'); if (nm) fitRewardName(nm);
  pulseEl(tile, 'reward-reveal');
  await new Promise(res => setTimeout(res, 200));

  showRevealTooltip(tile, out, c === cols - 1);
  await new Promise(res => setTimeout(res, 1500));
  hideRewardTooltip();

  await flyRewardTile(tile, out, out.good);
}

// On confirm: claimed tiles resolve ONE AT A TIME (mysteries reveal first), then
// the unclaimed tiles fall out together.
async function animateRewardResolve() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  hideRewardTooltip();
  const cols = rewardCells[0]?.length || gridCols;
  const tiles = [...gridEl.querySelectorAll('.reward-cell.on-grid')];
  // Clear the lingering deal-in animations (fill:'both') so they don't override
  // the resolve transforms - WAAPI animations outrank CSS ones.
  tiles.forEach(t => t.getAnimations().forEach(a => a.cancel()));
  const claimed = [], rest = [];
  tiles.forEach(t => (rewardSelected.has(`${t.dataset.r}-${t.dataset.c}`) ? claimed : rest).push(t));

  for (const tile of claimed) {
    const r = +tile.dataset.r, c = +tile.dataset.c;
    const cell = rewardCells[r]?.[c]; if (!cell) continue;
    const p = cell.payload;
    if (p._mystery) await revealAndFlyMystery(tile, p, c, cols);
    else            await flyRewardTile(tile, p, cell.kind !== 'debuff');
    // Entity rewards populate a HUD chip - apply the moment the tile lands so the
    // chip fills as it shrinks in (no end-of-sequence delay). Everything else is
    // still applied together after the animation (confirmRewardPath).
    if (p && (p.entity === 'trick' || p.entity === 'knack' || p.entity === 'sleight')
        && typeof p.apply === 'function' && !p._applied) {
      try { p.apply(); p._applied = true; } catch (e) { console.error('[REWARD] land apply failed', e); }
    }
    await new Promise(res => setTimeout(res, 90));
  }
  await Promise.allSettled(rest.map((t, i) => fallRewardTile(t, i * 34)));
}

async function confirmRewardPath() {
  if (rewardConfirmed || rewardDealing || rewardSelected.size === 0) return;
  // Hard guard: a queued tap or a keyboard path reaches here without passing the
  // button's disabled state, the same reason playHand re-checks the play grid's floor.
  if (!rewardPicksMet()) { refuse(`Take ${rewardMinPicks() - rewardSelected.size} more to confirm`); return; }
  rewardConfirmed = true;
  const play = document.getElementById('btn-play');
  const disc = document.getElementById('btn-discard');
  if (play) play.disabled = true;
  if (disc) disc.disabled = true;
  // Fly the claimed items to their homes / drop the rest, THEN apply + continue.
  rewardDealing = true;   // block re-render from clobbering the flying tiles
  try { await animateRewardResolve(); } catch (e) { console.error('[REWARD] resolve anim failed', e); }
  rewardDealing = false;
  const _picks = rewardSelected.size; // captured before closeRewardGrid clears the set (More Better)
  let _negThisGrid = 0;               // negative (debuff) tiles taken this grid - risk entities
  rewardSelected.forEach(key => {
    const [r, c] = key.split('-').map(Number);
    const cell = rewardCells[r][c];
    if (cell.kind === 'debuff') _negThisGrid++;
    // A throwing payload must never strand the reward step - isolate each apply.
    // Entity rewards were already applied on landing (animateRewardResolve).
    try { if (cell.payload && typeof cell.payload.apply === 'function' && !cell.payload._applied) cell.payload.apply(); }
    catch (e) { console.error('[REWARD] payload apply failed', e); }
  });
  // More Better: every reward grid confirmed with 3+ tiles (all tiles count) permanently grows the trick.
  if (hasTrick('more_better') && _picks >= BAL.more_better.min_tiles && !penaltyGridActive()) {
    bonusMult_morebetter += BAL.more_better.mult;
    showMessage(`More Better! +${BAL.more_better.mult} mult (now +${bonusMult_morebetter})`, 'var(--gold)');
  }
  // Negative-tile tally (per run) - feeds Wild Side / Wait For Iiiit (read at scoring) + Shady Stimulants (on-take).
  if (_negThisGrid > 0) {
    negativeTilesTakenRun += _negThisGrid;
    if (hasKnack('shady_stimulants')) {
      focusCapPerm += _negThisGrid;
      showMessage(`Shady Stimulants - +${_negThisGrid} Focus limit`, '#a25cd8');
    }
  }
  closeRewardGrid();
}

function closeRewardGrid() {
  hideRewardTooltip(); rewardSwapReady = false; rewardSwapLift = null;
  stopRewardFloat();
  document.getElementById('reward-overlay')?.classList.remove('show');
  // Tear down the on-grid reward step: restore the action buttons, clear the
  // reward tiles from #grid, and drop back to normal render ownership.
  exitRewardButtonMode();
  document.body.classList.remove('reward-active', 'reward-boss', 'reward-prize', 'reward-penalty');
  rewardGridMode = 'normal';   // one prize grid per boss; the next grid is ordinary
  if (typeof exitGridScreenHud === 'function') exitGridScreenHud();
  rewardOnGrid = false;
  const gridEl = document.getElementById('grid');
  if (gridEl) gridEl.innerHTML = '';
  // In the interlude, the dark veil must be back up before the new round's cards
  // are dealt in (showNextGoalFlash also re-adds it, but restore now to avoid a
  // flash of the board while drainLevelUpQueue repopulates the grid).
  if (rewardGridContext === 'interlude') {
    document.getElementById('next-goal-bg')?.classList.add('show');
  }
  rewardSelected  = new Set();
  rewardPickOrder = [];
  rewardTipKey    = null;
  rewardCells     = [];
  gameTimerPaused = false;

  // What happens after the reward step, per context. A claimed Limit Break
  // (either context) opens the LB screen first, then runs this continuation.
  const finishInterlude = () => {
    skipTrickChoiceOverlay = true;

    // The node this reward grid belonged to, captured BEFORE the advance below.
    // Guided routes off it, and 5 is the post-boss prize grid.
    const _node = nodeInAct;
    const _guided = (typeof guidedActive === 'function' && guidedActive() && isActMode());
    const _map = (typeof mapActive === 'function' && mapActive());

    if (isActMode() && !_guided && !_map) {
      if (nodeInAct === 5) {
        // Post-boss reward grid - the quarter rolls over. rolloverQuarter
        // (js/quarter.js) closes the quarter's books, does the advance, and shows
        // the QUARTER CLOSED card before handing control back here. A won run
        // never comes back - it goes to onGameWin and the run report.
        rolloverQuarter(() => finishInterludeRoute(_node, _guided));
        return;
      } else {
        nodeInAct++;
        updateActProgressUI();
        if (typeof crMaybeArmForNode === 'function') crMaybeArmForNode(nodeInAct);   // Classic's challenge node
        if (nodeInAct === 5 && (typeof bossesEnabled !== 'function' || bossesEnabled())) {
          forceBossNextRound = true;
        }
      }
    }

    finishInterludeRoute(_node, _guided);
  };

  // Everything finishInterlude does AFTER the node/quarter bookkeeping. Split out
  // so the quarter card can run in front of it and then call it (js/quarter.js).
  function finishInterludeRoute(_node, _guided) {
    // Map mode (r238): a grid here is either one the player LANDED ON - back to
    // the map - or the post-boss prize grid, which is the run won. One act, so
    // there is no quarter to roll over; mapBossArmed is what tells them apart.
    if (typeof mapActive === 'function' && mapActive()) {
      pendingEventOverride = null;
      // A grid here is one the player LANDED ON - back to the map - or the
      // post-boss PRIZE grid, which closes the quarter (r249). rolloverQuarter
      // does the advance, shows the card, and goes to onGameWin itself past Q3,
      // so the map never has to know how many quarters a run is.
      if (mapBossArmed) rolloverQuarter(() => mapBeginQuarter());
      else mapAfterTile();
      return;
    }
    // Guided (r218) runs its own act: slots, not nodes. A grid here is either one
    // the player BOUGHT with a slot - back to the crossroads - or the post-boss
    // prize grid, which rolls the act over. Neither uses the node routing above,
    // which is why guided returns before the destination-tile branch.
    if (typeof guidedActive === 'function' && guidedActive() && isActMode()) {
      pendingEventOverride = null;
      // guidedInStop, NOT the node index: a grid the player BOUGHT is one slot
      // of the act, the post-boss PRIZE grid rolls the act over, and only the
      // flag tells them apart - nodeInAct is kept in step with the slot count for
      // the HUD and can legitimately read 5 for either.
      if (guidedInStop) guidedAfterSlot(); else guidedAfterPrizeGrid();
      return;
    }

    // Route based on destination tile the player selected (if any)
    const override = pendingEventOverride;
    pendingEventOverride = null;
    if (override === 'shop') {
      shopFromNodeFlow = true;
      triggerShop(); // closeShopGrid → resumeAfterNodeFlowShop
    } else if (override === 'event') {
      shopFromNodeFlow = false;
      openEvent(() => drainLevelUpQueue());
    } else {
      drainLevelUpQueue();
    }
  }
  const finishTimer = () => {
    // Timer-based / dev mid-round: no round-start reset follows, so apply any pending
    // reward deltas to the LIVE round now (otherwise they'd be silently lost).
    const _secCap = Math.max(ROUND_DURATION, limits.round_time.current);
    discards     = Math.max(0, discards + nextRoundDiscardDelta);
    swaps        = Math.max(0, swaps    + nextRoundSwapDelta);
    roundSeconds = Math.max(1, Math.min(_secCap, roundSeconds + nextRoundSecondsDelta));
    if (roundPenaltySeconds > 0) roundSeconds = Math.max(1, Math.min(roundSeconds, _secCap - roundPenaltySeconds));
    playHandCostThisRound = extraPlayCostPerm    + nextRoundPlayCost;
    discardCostThisRound  = extraDiscardCostPerm + nextRoundDiscardCost;
    nextRoundDiscardDelta = 0; nextRoundSwapDelta = 0; nextRoundSecondsDelta = 0;
    nextRoundPlayCost = 0; nextRoundDiscardCost = 0;
    startRoundTimer();
    updateClockUI();
    render();
  };

  // Survival / Flow: the prize grid REPLACES their post-boss pick-of-three, so the
  // continuation is that pick's own tail (survivalChoose) - no goal was cleared, so
  // the level-up must not carry score over or pay the leftover-time credits.
  const finishSurvival = () => {
    // A grid opened off the pick-of-three's reward-grid offer (survivalChoose)
    // stands in for a goal-cleared pick, so THAT one keeps the score carry-over
    // and time credits; the post-boss prize grid still skips them (no goal was
    // cleared for it).
    const _fromPick = typeof survivalGridPickCarry !== 'undefined' && survivalGridPickCarry;
    if (typeof survivalGridPickCarry !== 'undefined') survivalGridPickCarry = false;
    // The grid offer taken MID-CHAIN (Flow multi-reward, r325): the chain shows
    // its next screen and runs the one level-up at its end, carry included.
    if (typeof flowrAfterStep === 'function' && flowrAfterStep()) return;
    survivalSkipCarryover = !_fromPick;
    triggerLevelUp();          // → showLevelUpScreen (survival) → survivalDealNext
    survivalSkipCarryover = false;
  };

  // The penalty and mini grids hand control back to whoever opened them (crSettle).
  if (rewardGridContext === 'penalty' || rewardGridContext === 'mini') {
    const done = _penaltyDone; _penaltyDone = null;
    if (pendingLimitBreak) { pendingLimitBreak = false; openLimitBreakEvent(() => { if (typeof done === 'function') done(); }); return; }
    if (typeof done === 'function') done();
    return;
  }
  const proceed = rewardGridContext === 'survival' ? finishSurvival
                : rewardGridContext === 'interlude' ? finishInterlude
                : finishTimer;
  if (pendingLimitBreak) { pendingLimitBreak = false; openLimitBreakEvent(proceed); }
  else proceed();
}

// Wire buttons
(function wireRewardButtons() {
  const confirm = document.getElementById('reward-confirm');
  const clear   = document.getElementById('reward-clear');
  if (confirm) confirm.addEventListener('click', confirmRewardPath);
  if (clear)   clear.addEventListener('click', clearRewardSelection);
})();

let pendingEventOverride = null; // 'normal' | 'shop' | 'event' - set by reward grid dest tiles
let shopFromNodeFlow    = false;  // true when shop was opened mid-interlude; close → resumeAfterNodeFlowShop
// Where a node-flow shop hands control back. Classic leaves this null and goes
// straight to the next round; Guided sets it so the shop can be one stop in a
// longer chain (js/guided-mode.js). Three files close a node-flow shop
// (shop.js, mart-shop.js, shop-grid-preview.js) and all three route through here
// rather than repeating the continuation.
let nodeFlowAfterShop   = null;
function resumeAfterNodeFlowShop() {
  shopFromNodeFlow = false;
  const fn = nodeFlowAfterShop;
  nodeFlowAfterShop = null;
  (fn || drainLevelUpQueue)();
}
let pendingLimitBreak   = false;  // a claimed Limit Break reward tile → open the LB screen on close

// ── LIMIT BREAK EVENT ──
// Offers 3 curated limits (2 known + 1 blind). Stage 1: break one for free.
// Stage 2: optionally break a second against one of THREE rolled sacrifices.
// See the header of js/limit-break.js for why it is two stages.

let lbOffers = [];          // [{ id, blind, revealed }]
let lbPrimaryPick = null;   // offer index chosen as free pick
let lbSecondPick = null;    // offer index chosen as the traded-for pick
let lbSacrifice = null;     // the chosen entry of lbSacPool, plus _i
let lbConfirmed = false;
let lbStage = 1;            // 1 = free pick, 2 = trade for a second
let lbSacPool = null;       // the 3 rolled sacrifices, fixed for the whole of stage 2
let lbRevealing = false;    // the beat that shows what a blind SECOND pick turned out to be
let lbOnClose = null;       // continuation to run after the LB screen closes (reward-grid flow)

