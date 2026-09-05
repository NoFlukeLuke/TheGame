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
let rewardGridMode = 'normal';   // 'normal' | 'prize'
function prizeGridActive() { return rewardGridMode === 'prize'; }

// The Trick-tile floor for a grid. A prize grid is 9 tiles at its smallest and
// several of those are guaranteed upgrades, so demanding 5 Tricks there would
// crowd out everything else. Lifted out of _generateRewardContent because the
// difficulty conversion below has to reserve these slots BEFORE the fill runs.
function MIN_TRICK_TILES_FOR(prize) { return prize ? 2 : 5; }

function generateRewardContent() {
  return withSeededRng(_generateRewardContent, 'reward', rewardVisitIndex++);
}
function _generateRewardContent() {
  const PRIZE = prizeGridActive();
  // Two smaller in each direction, never below 3x3.
  const ROWS = PRIZE ? Math.max(3, limits.grid_rows.current - 2) : limits.grid_rows.current;
  const COLS = PRIZE ? Math.max(3, limits.grid_cols.current - 2) : limits.grid_cols.current;

  // Weighted buff categories. Tricks are also guaranteed a minimum count per
  // grid (MIN_TRICK_TILES below), so their true share ends up higher than the
  // raw weight suggests - the other categories fight over the leftover slots.
  // Prize grid: no common-tier resource tiles, no gamble. Entities and permanent
  // upgrades only - see the PRIZE GRID note at the top of this file.
  const prizeCategories = [
    { weight: 34, kind: 'trick' },
    { weight: 20, kind: 'sleight' },
    { weight: 16, kind: 'knack' },
    { weight: 16, kind: 'limit_up' },
    { weight: 10, kind: 'blessed' },
    { weight:  4, kind: 'cull' },
  ];
  const buffCategories = [
    { weight: 40, kind: 'trick' },
    { weight: 12, kind: 'sleight' },
    { weight:  7, kind: 'knack' },
    { weight:  5, kind: 'discard' },
    { weight:  5, kind: 'swap' },
    { weight:  5, kind: 'time' },
    { weight:  6, kind: 'coins' },
    { weight:  4, kind: 'limit_up' },
    { weight:  6, kind: 'blessed' },
    { weight:  4, kind: 'cull' },
    { weight:  3, kind: 'cleanse' },
    { weight:  3, kind: 'mystery' },
  ];
  // Hover projections (computed when the grid opens, reflecting current standing debuffs).
  const _proj    = computeRoundResources();
  const _capNow  = Math.max(10, Math.max(ROUND_DURATION, limits.round_time.current) - roundPenaltySeconds);
  const _handNow = 0 + extraPlayCostPerm + nextRoundPlayCost;   // base play cost is 0 (r50)
  const _discNow = 3 + extraDiscardCostPerm + nextRoundDiscardCost;
  // ── Penalty tiles ──────────────────────────────────────────────────────────
  // `perm: true` marks a penalty that outlives the next round. The difficulty
  // tier multiplies the weight of every permanent one (diffPermWeightMult), and
  // the epic-neighbour rule below can only draw from the permanent half - so the
  // flag is load-bearing, not documentation. A penalty that resolves instantly
  // and is then over (Pickpocket) is NOT permanent: it costs you once.
  const debuffs = [
    { weight: 8, perm: true, icon: '☁', label: '-5s Round Cap', tier: 'penalty',
      desc: `Round cap: ${formatTime(_capNow)} → ${formatTime(Math.max(10, _capNow - 5))} · permanent, stacks`,
      apply: () => { roundPenaltySeconds += 5; showMessage('Round cap -5s (permanent)', 'var(--red)'); } },
    { weight: 8, perm: false, icon: '☠', label: '-1 Discard', tier: 'penalty',
      desc: `Next round discards: ${_proj.discards} → ${Math.max(0, _proj.discards - 1)} · next round only`,
      apply: () => { nextRoundDiscardDelta -= 1; showMessage('-1 discard next round', 'var(--red)'); } },
    { weight: 8, perm: false, icon: '✖', label: '-1 Swap', tier: 'penalty',
      desc: `Next round swaps: ${_proj.swaps} → ${Math.max(0, _proj.swaps - 1)} · next round only`,
      apply: () => { nextRoundSwapDelta -= 1; showMessage('-1 swap next round', 'var(--red)'); } },
    { weight: 8, perm: true, icon: '💔', label: 'Lose a Trick', tier: 'penalty',
      desc: 'Discard one random Trick you own.',
      apply: applyRewardLoseTrick },
    { weight: 8, perm: true, icon: '🐌', label: 'Hands +2s', tier: 'penalty',
      desc: `Hand cost: ${_handNow}s → ${_handNow + 2}s each · permanent, stacks`,
      apply: () => { extraPlayCostPerm += 2; showMessage('Playing a hand costs +2s (permanent)', 'var(--red)'); } },
    { weight: 8, perm: false, icon: '⌛', label: 'Hands +5s · 1rd', tier: 'penalty',
      desc: `Next round hand cost: ${_handNow}s → ${_handNow + 5}s each · next round only`,
      apply: () => { nextRoundPlayCost += 5; showMessage('Hands cost +5s next round', 'var(--red)'); } },
    { weight: 8, perm: true, icon: '🐌', label: 'Discards +2s', tier: 'penalty',
      desc: `Discard cost: ${_discNow}s → ${_discNow + 2}s per card · permanent, stacks`,
      apply: () => { extraDiscardCostPerm += 2; showMessage('Discarding costs +2s/card (permanent)', 'var(--red)'); } },
    { weight: 8, perm: false, icon: '⌛', label: 'Discards +5s · 1rd', tier: 'penalty',
      desc: `Next round discard cost: ${_discNow}s → ${_discNow + 5}s per card · next round only`,
      apply: () => { nextRoundDiscardCost += 5; showMessage('Discards cost +5s/card next round', 'var(--red)'); } },
    // ── Variety debuffs (r74) ──
    { weight: 8, perm: false, icon: '💸', label: 'Pickpocket', tier: 'penalty',
      desc: `Lose 10 coins (${coins} → ${Math.max(0, coins - 10)}).`,
      apply: () => { coins = Math.max(0, coins - 10); updateCoinsUI(); showMessage('-10 coins', 'var(--red)'); } },
    { weight: 8, perm: true, icon: '🪨', label: 'Stones', tier: 'penalty',
      desc: 'Two Stones are shuffled into your deck. They block cells until purged.',
      apply: () => { injectStonesIntoDeck(2); showMessage('2 Stones added to deck', 'var(--red)'); } },
    { weight: 8, perm: false, icon: '⏳', label: 'Slow Start', tier: 'penalty',
      desc: 'Next round starts with 20 fewer seconds.',
      apply: () => { nextRoundSecondsDelta -= 20; showMessage('-20s next round', 'var(--red)'); } },
    // ── r193 penalties: four that cost something other than seconds ──────────
    // Every penalty before these took time, resources or a card. The grid needed
    // costs aimed at the other three things a run runs on - the goal you are
    // chasing, the Focus multiplier, the credits, and the loadout itself.
    { weight: 7, perm: true, icon: '📈', label: 'Quota Revision', tier: 'penalty',
      desc: `Every future round goal rises by 10% (now ×${goalPenaltyMult.toFixed(2)} → ×${(goalPenaltyMult * 1.10).toFixed(2)}) · permanent, stacks`,
      apply: () => { goalPenaltyMult *= 1.10; showMessage('Goals +10% (permanent)', 'var(--red)'); } },
    { weight: 7, perm: true, icon: '📋', label: 'Red Tape', tier: 'penalty',
      desc: `Hands generate ${Math.round(100 / (focusRatePenalty * 1.25))}% of their listed Focus (now ${Math.round(100 / focusRatePenalty)}%) · permanent, stacks`,
      apply: () => { focusRatePenalty *= 1.25; showMessage('Focus gain reduced (permanent)', 'var(--red)'); } },
    { weight: 7, perm: false, icon: '🚫', label: 'Withheld', tier: 'penalty',
      desc: 'The next round pays out nothing: no interest, no leftover-time credits.',
      apply: () => { skipNextPayout = true; showMessage('Next payout withheld', 'var(--red)'); } },
    // The TYPE is fixed when the tile is generated so the tile can name it; WHICH
    // entity gets suspended is rolled at the start of the round it applies to.
    (() => {
      const t = ['trick', 'knack', 'sleight'][Math.floor(Math.random() * 3)];
      const noun = { trick: 'Trick', knack: 'Knack', sleight: 'Sleight' }[t];
      return { weight: 7, perm: false, icon: '⛔', label: `Suspend a ${noun}`, tier: 'penalty',
        desc: `One random ${noun} you own stops working for the first half of next round. Which one is decided when the round deals.`,
        apply: () => { pendingEntityLockout = { type: t }; showMessage(`A ${noun} will be suspended next round`, 'var(--red)'); } };
    })(),
    // ── r194 penalties: five that cost you a board, a habit or a Trick's rent ──
    { weight: 7, perm: false, icon: '🧊', label: 'Interest Freeze', tier: 'penalty',
      desc: `No interest paid for the next ${BAL.interest_freeze.rounds} rounds. Leftover-time credits still pay.`,
      apply: () => { interestFreezeRounds += BAL.interest_freeze.rounds; showMessage(`Interest frozen for ${BAL.interest_freeze.rounds} rounds`, 'var(--red)'); } },
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
        apply: () => { nextRoundGridShrink = _ax; showMessage(`-1 ${_noun} next round`, 'var(--red)'); } });
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
    const _owned = (trickTrayMode ? trickTray : (acquiredTricks || []))
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
    const _uncursed = [];
    ACTIVE_RANKS.forEach(rank => ACTIVE_SUITS.forEach(suit => { if (!cardCurses[cardKey(rank, suit)]) _uncursed.push({ rank, suit }); }));
    if (_uncursed.length) {
      const _victim = _uncursed[Math.floor(Math.random() * _uncursed.length)];
      const _cids = Object.keys(CURSE_DEFS);
      const _cid  = _cids[Math.floor(Math.random() * _cids.length)];
      debuffs.push({ weight: 10, perm: true, icon: CURSE_DEFS[_cid].icon, label: `${CURSE_DEFS[_cid].name} Curse`, tier: 'penalty',
        cardFace: { rank: _victim.rank, suit: _victim.suit },
        desc: `${_victim.rank}${_victim.suit} is cursed - ${CURSE_DEFS[_cid].desc}`,
        apply: () => { cardCurses[cardKey(_victim.rank, _victim.suit)] = { id: _cid, left: CURSE_DEFS[_cid].liftAfter }; showMessage(`${_victim.rank}${_victim.suit} cursed: ${CURSE_DEFS[_cid].name}`, '#9b59b6'); } });
    }
  }
  // Limit-drain debuff: -1 to a shown limit (weight 5; only if something is drainable).
  // round_time is excluded - a 1-second drain reads like a bug, not a curse.
  {
    const _drainable = LIMITS_DEF.filter(d => d.id !== 'round_time' && limits[d.id].current > 1);
    if (_drainable.length) {
      const _dl = pickWeightedLimits(1, _drainable)[0];
      debuffs.push({ weight: 5, perm: true, icon: '⬇️', label: `-1 ${_dl.label}`, tier: 'penalty',
        desc: `${_dl.label}: ${limits[_dl.id].current} → ${limits[_dl.id].current - 1} · permanent (limits are precious!)`,
        apply: () => { decrementLimit(_dl.id); showMessage(`-1 ${_dl.label}`, 'var(--red)'); } });
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

  // Like weightedPick, but the weight is read through `wf` - which is how the
  // difficulty tier re-weights permanent penalties without editing the table.
  function weightedPickBy(arr, wf) {
    const total = arr.reduce((s, x) => s + wf(x), 0);
    let rng = Math.random() * total;
    for (const x of arr) { rng -= wf(x); if (rng <= 0) return x; }
    return arr[arr.length - 1];
  }
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

  // Pre-pick Trick at generation time so the tile shows the exact card.
  // entity/rarity drive the LETHE reward-entity visuals (see buildRewardTileInner).
  // Trick tiles are drawn on the SHOP'S RARITY TABLE (r193), not uniformly.
  //
  // They used to be picked flat out of the eligible pool, which sounds fair and is
  // not: TRICK_POOL is 49 common / 66 rare / 50 epic / 7 legendary / 5 mythic, so a
  // uniform draw made an epic-or-better tile a 35% event on EVERY trick slot, and
  // a grid guarantees five of them. Sleights had gone through pickSleightByRarity
  // since the shop was written; tricks and knacks never did, which is most of why
  // a reward grid reads as a pile of epics.
  const TRICK_TIERS = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  const TRICK_TIER_W = [46, 33, 16, 3.5, 1.5];
  function pickByRarity(pool, tierOf, weights, tiers) {
    if (!pool.length) return null;
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total, ti = 0;
    for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) { ti = i; break; } }
    // Walk DOWN from the rolled tier, never up: an exhausted mythic pool hands
    // back a legendary, not a fresh roll that could land higher than it rolled.
    for (let i = ti; i >= 0; i--) {
      const t = pool.filter(x => tierOf(x) === tiers[i]);
      if (t.length) return t[Math.floor(Math.random() * t.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function makeTrickPayload() {
    if (typeof TRICK_POOL === 'undefined') return { icon: '★', label: 'Trick', tier: 'rare', entity: 'trick', rarity: 'rare', apply: applyRewardRandomTrick };
    const owned = new Set((acquiredTricks || []).map(b => b.id));
    let eligible = TRICK_POOL.filter(b => !owned.has(b.id) && !offerBanned(b.id));
    // Prize grid takes no commons. Fall back to the full list if filtering would
    // leave nothing - an empty tile is worse than a common one.
    if (PRIZE) { const up = eligible.filter(b => (b.tier || 'common') !== 'common'); if (up.length) eligible = up; }
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

  // Prize-grid sleight draw: the shop's rarity table with 'common' cut out of it.
  function pickPrizeSleight() {
    const TIERS = ['rare', 'epic', 'legendary', 'mythic'];
    const W     = [58, 28, 9, 5];
    const pool = freshPool(SLEIGHT_POOL.filter(j => !grantedSleightIds.has(j.id) && sleightOfferable(j) && !offerBanned(j.id) && (j.rarity || 'common') !== 'common'));
    if (!pool.length) return null;
    const total = W.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total, ti = 0;
    for (let i = 0; i < W.length; i++) { roll -= W[i]; if (roll <= 0) { ti = i; break; } }
    for (let i = ti; i >= 0; i--) { const t = pool.filter(j => j.rarity === TIERS[i]); if (t.length) return t[Math.floor(Math.random() * t.length)]; }
    return pool[Math.floor(Math.random() * pool.length)];
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
    if (PRIZE) { const up = eligible.filter(t => (t.rarity || 'common') !== 'common'); if (up.length) eligible = up; }
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
      apply: () => { acquiredKnacks.push({ ...pick }); updateKnackList?.(); showMessage(`+ ${pick.name}`, 'var(--gold)'); }
    };
  }

  // Blessed-card buff: a specific shown card gains a permanent bonus.
  function makeBlessedPayload() {
    const rank = ACTIVE_RANKS[Math.floor(Math.random() * ACTIVE_RANKS.length)];
    const suit = ACTIVE_SUITS[Math.floor(Math.random() * ACTIVE_SUITS.length)];
    const mult = Math.random() < 0.3; // 30% of blessings are the (stronger) +1 mult
    return mult
      ? { icon: '✨', label: 'Blessed Card', tier: 'epic', cardFace: { rank, suit },
          desc: `${rank}${suit} permanently gains +1 mult when scored.`,
          apply: () => { const k = cardKey(rank, suit); permMult[k] = (permMult[k] || 0) + 1; showMessage(`${rank}${suit} blessed: +1 mult`, 'var(--gold)'); } }
      : { icon: '✨', label: 'Blessed Card', tier: 'rare', cardFace: { rank, suit },
          desc: `${rank}${suit} permanently gains +12 pips.`,
          apply: () => { const k = cardKey(rank, suit); permPips[k] = (permPips[k] || 0) + 12; showMessage(`${rank}${suit} blessed: +12 pips`, 'var(--gold)'); } };
  }
  // Cull buff: deck thinning - a specific low card leaves the run for good.
  function makeCullPayload() {
    const rank = ['2', '3', '4'][Math.floor(Math.random() * 3)];
    const suit = ACTIVE_SUITS[Math.floor(Math.random() * ACTIVE_SUITS.length)];
    return { icon: '✂️', label: 'Cull', tier: 'rare', cardFace: { rank, suit },
      desc: `Remove ${rank}${suit} from your deck for the rest of the run.`,
      apply: () => { removeCardIdentityFromRun(rank, suit)
        ? showMessage(`${rank}${suit} culled from deck`, 'var(--gold)')
        : showMessage(`${rank}${suit} was already gone`, 'var(--cream-dim)'); } };
  }
  function makeLimitUpPayload() {
    // round_time excluded - its +1 = 1 second; time is handled by the +15s tile.
    const eligible = LIMITS_DEF.filter(d => d.id !== 'round_time' && limits[d.id].current < limits[d.id].max);
    if (!eligible.length) return makeTrickPayload();
    const dl = pickWeightedLimits(1, eligible)[0];
    return { icon: '⬆️', label: `+1 ${dl.label}`, tier: 'epic',
      desc: `${dl.label}: ${limits[dl.id].current} → ${limits[dl.id].current + 1} · permanent`,
      apply: () => { incrementLimit(dl.id); showMessage(`+1 ${dl.label}!`, 'var(--gold)'); } };
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
      case 'discard': return { icon: '🗑', label: '+1 Discard',   tier: 'common',
                               desc: `Next round discards: ${_proj.discards} → ${_proj.discards + 1}`,
                               apply: () => { nextRoundDiscardDelta += 1; showMessage('+1 discard next round', 'var(--gold)'); } };
      case 'swap':    return { icon: '⚡', label: '+1 Swap',      tier: 'common',
                               desc: `Next round swaps: ${_proj.swaps} → ${_proj.swaps + 1}`,
                               apply: () => { nextRoundSwapDelta += 1; showMessage('+1 swap next round', 'var(--gold)'); } };
      case 'time':    return { icon: '⏱', label: '+15s Round',   tier: 'common',
                               desc: `Next round starts with +15s`,
                               apply: () => { nextRoundSecondsDelta += 15; showMessage('+15s next round', 'var(--gold)'); } };
      case 'coins':   return { icon: '💰', label: 'Windfall',     tier: 'common',
                               desc: `Gain 8 coins (${coins} → ${coins + 8}).`,
                               apply: () => { coins += 8; updateCoinsUI(); showMessage('+8 coins', 'var(--gold)'); } };
      case 'limit_up': {
        // makeLimitUpPayload falls back to a Trick when nothing is upgradeable, so
        // count the tile only when it really is a limit (its ⬆️ icon).
        const t = makeLimitUpPayload();
        if (t && t.icon === '⬆️') _limitTilesThisGrid++;
        return t;
      }
      case 'blessed': return makeBlessedPayload();
      case 'cull':    return makeCullPayload();
      case 'cleanse':
        // Only meaningful if something is cursed; otherwise fall back to a Trick
        if (!Object.keys(cardCurses).length) return makeTrickPayload();
        return { icon: '🕊️', label: 'Cleanse', tier: 'rare',
                 desc: 'Lift one random curse from your deck.',
                 apply: () => { const _cl = cleanseRandomCurse(); showMessage(_cl ? `Curse lifted: ${_cl.key.replace('-', '')}` : 'No curses to lift', '#54af88'); } };
      case 'mystery': return { icon: '❓', label: 'Mystery', tier: 'mystery',
                               desc: 'Unknown until claimed. Probably good… probably.',
                               _mystery: true, _goodChance: 0.7,
                               apply: function () { (this._rolled || (this._rolled = rollRewardMystery(this._goodChance))).apply(); } };
    }
  }

  // ── Guaranteed-tile builders (r114) ──
  // A limit-upgrade tile that raises `id` by up to `amount` (permanent). Returns
  // null if the limit is already maxed, so callers can fall back to an alternate.
  function makeLimitUpgradeTile(id, amount) {
    const l = limits[id]; if (!l || l.current >= l.max) return null;
    const def = LIMITS_DEF.find(d => d.id === id);
    const cur = l.current, next = Math.min(l.max, cur + amount);
    const gain = next - cur;
    return {
      icon: '⬆️', label: `+${gain} ${def.label}`, tier: 'epic', rarity: 'legendary', _guaranteed: true,
      desc: `${def.label}: ${cur} → ${next} · permanent`,
      apply: () => { for (let k = 0; k < gain; k++) incrementLimit(id); onLimitChanged?.(id); showMessage(`+${gain} ${def.label}!`, 'var(--gold)'); }
    };
  }
  function makeGrowthTile()      { const o = Math.random()<0.5 ? ['grid_rows','grid_cols'] : ['grid_cols','grid_rows']; for (const id of o) { const t = makeLimitUpgradeTile(id, 1); if (t) return t; } return null; }
  function makeSwapDiscardTile() { const o = Math.random()<0.5 ? ['swaps','discards'] : ['discards','swaps'];         for (const id of o) { const t = makeLimitUpgradeTile(id, 2); if (t) return t; } return null; }
  function makeLimitBreakPayload() {
    return {
      icon: '💥', label: 'Limit Break', tier: 'mythic', rarity: 'mythic', _guaranteed: true,
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

  // ── Difficulty: convert extra buff cells into penalty cells (r193) ─────────
  // The checkerboard is a 50/50 split, which means a path of N tiles can always
  // be walked with roughly N/2 penalties - and with Selection Size 5, one penalty
  // and four rewards. Tier 3 raises the penalty share so that stops being true.
  //
  // Cells are converted from the END of the shuffled buff list, which is what
  // keeps this safe: the destination and every guaranteed tile are placed from
  // the FRONT of that same list, so they are never the ones taken away. A prize
  // grid has no penalty half at all and is skipped outright.
  const shuffledBuff = shuffled(buffPos);
  if (!PRIZE) {
    const share = (typeof diffDebuffShare === 'function') ? diffDebuffShare() : null;
    if (share) {
      const cells  = ROWS * COLS;
      const wanted = Math.round(cells * share);
      // Never eat into the guaranteed tiles or the destination, and always leave
      // enough buff slots for the Trick minimum - a grid with nothing worth
      // taking is not hard, it is empty.
      const reserved = 1 + buildGuaranteedRewardTiles().length + MIN_TRICK_TILES_FOR(PRIZE);
      let convert = Math.min(wanted - debuffPos.length, shuffledBuff.length - reserved);
      while (convert > 0) { debuffPos.push(shuffledBuff.pop()); convert--; }
    }
  }

  const grid = Array.from({length: ROWS}, () => Array(COLS).fill(null));

  // One destination in a random buff slot (not on a prize grid - it pays out, it
  // does not route you anywhere).
  if (!PRIZE) grid[shuffledBuff[0][0]][shuffledBuff[0][1]] = { kind: 'dest', payload: pickRand(destOptions) };

  // Guaranteed tiles first (protected from the Trick-minimum conversion below)
  const guaranteed = buildGuaranteedRewardTiles();
  // The Limit Break is a limit tile too - seed the ceiling with it so the prize
  // grid can add at most PRIZE_MAX_LIMIT_TILES - 1 more.
  if (PRIZE) _limitTilesThisGrid = guaranteed.filter(p => p.icon === '💥' || p.icon === '⬆️').length;
  let placeIdx = PRIZE ? 0 : 1;
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
  const MIN_TRICK_TILES = MIN_TRICK_TILES_FOR(PRIZE);
  {
    const isTrickTile = cell => cell?.kind === 'buff' && cell.payload && String(cell.payload.icon) === '★';
    let trickCount = 0;
    const convertible = [];
    for (let i = (PRIZE ? 0 : 1); i < shuffledBuff.length; i++) {
      const [r, c] = shuffledBuff[i];
      if (grid[r][c]?.payload?._guaranteed) continue;   // never overwrite a guaranteed tile
      if (isTrickTile(grid[r][c])) trickCount++;
      else convertible.push([r, c]);
    }
    while (trickCount < MIN_TRICK_TILES && convertible.length) {
      const [r, c] = convertible.splice(Math.floor(Math.random() * convertible.length), 1)[0];
      grid[r][c] = { kind: 'buff', payload: makeTrickPayload() };
      trickCount++;
    }
  }

  // ── Difficulty: push the best tiles out to the rim (r193) ─────────────────
  // A reward path is walked from a starting tile through orthogonally connected
  // neighbours, so a CENTRE cell is cheap to reach - it has four ways in - and a
  // corner is dear, with two. Above tier 1 the epic-and-better tiles are traded
  // out to edge and corner cells, so taking the best thing on the board means
  // committing the path to it instead of collecting it on the way past.
  //
  // This is a SWAP between two already-placed buff cells, never a re-roll: the
  // grid's contents are unchanged and only their positions move, so the Trick
  // minimum, the limit ceiling and the destination all still hold afterwards.
  const _isEdge = (r, c) => r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
  // How exposed a cell is, lowest first: a corner (2 ways in) beats an edge (3).
  const _openness = (r, c) => [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]
    .filter(([nr, nc]) => nr >= 0 && nc >= 0 && nr < ROWS && nc < COLS).length;
  if (!PRIZE && typeof diffWantsEdge === 'function') {
    const highInner = [], freeEdge = [];
    for (let i = (PRIZE ? 0 : 1); i < shuffledBuff.length; i++) {
      const [r, c] = shuffledBuff[i];
      const cell = grid[r][c];
      if (!cell || cell.kind !== 'buff') continue;
      const high = diffWantsEdge(cell.payload?.rarity || cell.payload?.tier);
      if (high && !_isEdge(r, c))       highInner.push([r, c]);
      else if (!high && _isEdge(r, c))  freeEdge.push([r, c]);
    }
    // Most exposed inner tile out first, into the least exposed edge cell going -
    // so on a board with one corner free, the mythic is the tile that gets it.
    highInner.sort((a, b) => _openness(b[0], b[1]) - _openness(a[0], a[1]));
    freeEdge.sort((a, b) => _openness(a[0], a[1]) - _openness(b[0], b[1]));
    const n = Math.min(highInner.length, freeEdge.length);
    for (let i = 0; i < n; i++) {
      const [ar, ac] = highInner[i], [br, bc] = freeEdge[i];
      const t = grid[ar][ac]; grid[ar][ac] = grid[br][bc]; grid[br][bc] = t;
    }
  }

  // Fill all debuff positions - weighted, and one-per-grid for the "big" kinds.
  // debuffPos is empty on a prize grid, so this loop simply does not run.
  // (two identical curse/drain/mystery tiles in one grid would be confusing)
  //
  // The weight of every PERMANENT penalty is multiplied by the difficulty tier's
  // permWeightMult, so a higher tier does not add more penalties (tier 3 does that
  // separately, above) - it changes which ones you meet.
  const _permMult = (typeof diffPermWeightMult === 'function') ? diffPermWeightMult() : 1;
  const _wOf = d => (d.weight || 1) * (d.perm ? _permMult : 1);
  // Cells that must carry a PERMANENT penalty: the ones orthogonally touching a
  // tile of an edge-bias rarity. Computed after the swap above, so it reads the
  // final positions.
  const _mustBePerm = new Set();
  if (!PRIZE && typeof diffPermNeighborCount === 'function' && diffPermNeighborCount() > 0) {
    const want = diffPermNeighborCount();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (!cell || cell.kind !== 'buff') continue;
      if (!diffWantsEdge(cell.payload?.rarity || cell.payload?.tier)) continue;
      const nb = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]
        .filter(([nr, nc]) => debuffPos.some(([dr, dc]) => dr === nr && dc === nc));
      // Shuffled so it is not always the same compass points that turn permanent.
      shuffled(nb).slice(0, want).forEach(([nr, nc]) => _mustBePerm.add(`${nr}-${nc}`));
    }
  }
  const usedOnce = new Set();
  for (const [r, c] of debuffPos) {
    let pick = null;
    const needPerm = _mustBePerm.has(`${r}-${c}`);
    // A forced-permanent cell draws from the permanent half only. If that half is
    // somehow empty it falls through to the ordinary draw rather than blanking.
    const table = needPerm ? debuffs.filter(d => d.perm) : debuffs;
    const pool = table.length ? table : debuffs;
    for (let tries = 0; tries < 12; tries++) {
      const cand = weightedPickBy(pool, _wOf);
      const isOnceKind = cand.cardFace || cand.icon === '⬇️' || cand.tier === 'mystery';
      if (isOnceKind && usedOnce.has(cand.label)) continue;
      if (isOnceKind) usedOnce.add(cand.label);
      pick = cand; break;
    }
    grid[r][c] = { kind: 'debuff', payload: pick || pickRand(pool) };
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
    const rank = ACTIVE_RANKS[Math.floor(Math.random()*ACTIVE_RANKS.length)], suit = ACTIVE_SUITS[Math.floor(Math.random()*ACTIVE_SUITS.length)];
    return { good, icon:'✨', label:`Blessed ${rank}${suit}`, flyTo:'deck', desc:`${rank}${suit} permanently gains +10 pips.`,
      apply:()=>{ const k = cardKey(rank, suit); permPips[k] = (permPips[k]||0)+10; showMessage(`Mystery: ${rank}${suit} +10 pips!`, 'var(--gold)'); } };
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

// Remove one copy of a specific card identity from the run (deck thinning).
// Searches drawPile, then playedPile, then the live grid (refilling the cell).
function removeCardIdentityFromRun(rank, suit) {
  const match = c => c && c.rank === rank && c.suit === suit && !c._isSleight && !c._isStone && !c._isTrick;
  let idx = drawPile.findIndex(match);
  if (idx >= 0) { drawPile.splice(idx, 1); updateDeckHud(); return true; }
  idx = playedPile.findIndex(match);
  if (idx >= 0) { playedPile.splice(idx, 1); updateDeckHud(); return true; }
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    if (match(gridData[r]?.[c])) { gridData[r][c] = drawCard() || null; render(); return true; }
  }
  return false;
}

// Place a Trick card physically on the grid (middle-row inner col, displacing if needed).
// Use this any time a Trick is granted outside the normal level-up Trick selection flow.
function injectTrickAfterReward(trick) {
  if (!trick) return;
  if (trickTrayMode) {
    // Tray full (trick_slots limit) → offer replace-or-skip instead of silent grow
    if (trickTray.length >= trickCapacity()) {
      _trickReplaceQueue.push(trick);
      maybeOpenTrickReplacePicker();
      return;
    }
    trickTray.push(trick);
    selectTrick(trick, true);
    renderTrickTray();
    return;
  }
  const midRow = Math.floor(gridRows / 2);
  const allCols = Array.from({length: gridCols}, (_, i) => i).sort(() => Math.random() - 0.5);
  // Prefer inner cols for aesthetic placement
  const innerCols = allCols.filter(c => c > 0 && c < gridCols - 1);
  const searchOrder = [...innerCols, ...allCols.filter(c => !innerCols.includes(c))];
  let targetRow = midRow, targetCol = searchOrder[0] ?? 0;
  for (const c of searchOrder) {
    if (!gridData[midRow]?.[c]?._isTrick && !gridData[midRow]?.[c]?._isSleight) { targetCol = c; break; }
  }
  // Fallback: any non-Trick, non-sleight cell in the grid
  if (gridData[targetRow]?.[targetCol]?._isTrick) {
    outer: for (let r = 0; r < gridRows; r++)
      for (const c of searchOrder)
        if (!gridData[r]?.[c]?._isTrick && !gridData[r]?.[c]?._isSleight) { targetRow = r; targetCol = c; break outer; }
  }
  // Salvage displaced card
  const displaced = gridData[targetRow][targetCol];
  if (displaced && !displaced._isTrick && !displaced._isSleight && displaced.rank) drawPile.push({ rank: displaced.rank, suit: displaced.suit });
  const trickId = 90000 + (Date.now() % 9000);
  gridData[targetRow][targetCol] = { rank: null, suit: null, _isTrick: true, _selectable: false, _trickState: 'acquired', trick, _id: trickId };
  selectTrick(trick, true); // handles acquiredTricks.push + positional assignment
  render();
}

function applyRewardRandomTrick() {
  if (typeof TRICK_POOL === 'undefined') return;
  const owned = new Set((acquiredTricks || []).map(b => b.id));
  const eligible = TRICK_POOL.filter(b => !owned.has(b.id));
  if (eligible.length === 0) return;
  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  injectTrickAfterReward(pick);
}
function applyRewardLoseTrick() {
  // Collect all current Tricks - either from tray or grid
  let options = [];
  if (trickTrayMode) {
    options = trickTray.map((trick, idx) => ({ trick, source: 'tray', idx }));
  } else {
    for (let r = 0; r < gridRows; r++)
      for (let c = 0; c < gridCols; c++)
        if (gridData[r]?.[c]?._isTrick) options.push({ trick: gridData[r][c].trick, source: 'grid', r, c });
  }
  if (options.length === 0) { showMessage('No Tricks to lose', 'var(--cream-dim)'); return; }
  openTrickLosePicker(options);
}

let _blpOptions   = [];
let _blpSelected  = -1;
let _blpMode      = 'lose';        // 'lose' (debuff: must remove) | 'replace' (tray full: swap or skip)
let _trickReplaceQueue = [];       // new Tricks waiting while the tray is at trick_slots capacity

// Tray is full - show the picker in 'replace' mode for the next queued new Trick.
// The incoming Trick is drawn as a real entity tile (js/entity-tile.js) rather
// than quoted into the subtitle: it is the thing you are deciding about, and it
// should look like it looks everywhere else you have met it.
function maybeOpenTrickReplacePicker() {
  if (!_trickReplaceQueue.length) return;
  if (document.getElementById('trick-lose-picker').classList.contains('show')) return; // one at a time
  const incoming = _trickReplaceQueue[0];
  _blpMode = 'replace';
  document.getElementById('blp-eyebrow').textContent = 'Trick slots full';
  document.getElementById('blp-title').textContent = 'NO ROOM FOR THIS ONE';
  document.getElementById('blp-sub').textContent =
    'Every slot is taken. Pick the Trick it replaces, or turn the new one away.';
  document.getElementById('blp-confirm').textContent = 'Replace Selected';
  document.getElementById('blp-cancel').style.display = '';
  const inc = document.getElementById('blp-incoming');
  // Tile first: #blp-incoming is a 2-column grid and the tile spans both rows.
  inc.innerHTML =
    `<div class="blp-inc-tile">${entityTileHTML(
        { entity:'trick', label: incoming.name, emoji: trickEmoji(incoming) },
        blpRarity(incoming.tier))}</div>
     <div class="blp-inc-label">Incoming</div>
     <div class="blp-inc-desc">${colorizeKeywords(incoming.desc || '')}</div>`;
  inc.classList.add('show');
  fitEntityNames(inc, '.rwd-name', { maxLines: 3 });
  openTrickLosePicker(trickTray.map((trick, idx) => ({ trick, source: 'tray', idx })));
}

// Trick tiers and entity rarities are the same five words, but a Trick can carry
// a tier the tile has no colour for - fall back rather than paint nothing.
const BLP_TIERS = ['common', 'rare', 'epic', 'legendary', 'mythic'];
function blpRarity(tier) {
  const t = String(tier || '').toLowerCase();
  return BLP_TIERS.includes(t) ? t : 'common';
}

function cancelTrickReplacePicker() {
  document.getElementById('trick-lose-picker').classList.remove('show');
  document.getElementById('blp-incoming').classList.remove('show');
  const skipped = _trickReplaceQueue.shift();
  if (skipped) showMessage(`Skipped ${skipped.name} (tray full)`, 'var(--cream-dim)');
  _blpMode = 'lose';
  setTimeout(() => maybeOpenTrickReplacePicker(), 150);
}

function openTrickLosePicker(options) {
  if (_blpMode !== 'replace') {
    // restore the default 'lose' chrome (replace mode pre-sets its own)
    document.getElementById('blp-eyebrow').textContent = 'Forfeit';
    document.getElementById('blp-title').textContent = 'CHOOSE A TRICK TO LOSE';
    document.getElementById('blp-sub').textContent = 'Select one - it will be removed permanently.';
    document.getElementById('blp-confirm').textContent = 'Remove Selected';
    document.getElementById('blp-cancel').style.display = 'none';
    const inc = document.getElementById('blp-incoming');
    inc.innerHTML = ''; inc.classList.remove('show');
  }
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
    // Replace mode: the freed slot goes to the queued new Trick
    if (_blpMode === 'replace') {
      const incoming = _trickReplaceQueue.shift();
      _blpMode = 'lose';
      if (incoming) {
        trickTray.push(incoming);
        selectTrick(incoming, true);
        showMessage(`+ ${incoming.name}`, 'var(--gold)');
      }
      renderTrickTray();
      setTimeout(() => maybeOpenTrickReplacePicker(), 150);
      return;
    }
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
  const k = cardKey(card.rank, card.suit);
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

function openRewardGrid() {
  gameTimerPaused = true;
  rewardGridsSeen++;               // count this grid (gates the first-5 guaranteed upgrades)
  rewardCells     = generateRewardContent();
  rewardSelected  = new Set();
  rewardPickOrder = [];
  rewardTipKey    = null;
  rewardConfirmed = false;
  rewardOnGrid    = true;
  // The reward grid now lives ON the play grid (r100). Reveal the board: drop the
  // interlude dark veil (showNextGoalFlash re-adds it later) and repurpose the
  // Play/Discard buttons into Confirm/Clear.
  document.getElementById('next-goal-bg')?.classList.remove('show');
  document.body.classList.add('reward-active');
  // Boss reward grids (post-boss-win, nodeInAct 5; or timer-mode boss context) tint red;
  // ordinary reward grids stay teal (see the per-screen #stage backgrounds).
  document.body.classList.toggle('reward-boss', rewardGridContext === 'boss' || (ACTIVE_MODE?.id === 'normal' && nodeInAct === 5));
  document.body.classList.toggle('reward-prize', prizeGridActive());
  if (typeof enterGridScreenHud === 'function') enterGridScreenHud(prizeGridActive() ? 'PRIZE' : 'REWARDS', 'reward');
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
        isSel   ? 'selected'    : '',
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
  if (play) play.disabled = !hasAny;   // CONFIRM
  if (disc) disc.disabled = !hasAny;   // CLEAR
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
  rewardConfirmed = true;
  coins += BAL.reward_skip.gold; updateCoinsUI();
  let _msg = `Skipped rewards · +${BAL.reward_skip.gold} gold`;
  if (hasTrick('rain_check')) { nextRoundSecondsDelta += BAL.rain_check.seconds; _msg += ` · +${BAL.rain_check.seconds}s next round`; }
  showMessage(_msg, 'var(--gold)');
  rewardSelected = new Set(); // abandon any in-progress picks
  rewardPickOrder = []; rewardTipKey = null;
  closeRewardGrid();
}

// ── Reward-entity visuals (LETHE) ────────────────────────────────────────────
// A reward tile can be an "entity" (trick / sleight / knack) rendered in the
// cabinet's CRT/neon language, a card-face tile (blessed/cursed/cull, unchanged),
// or a plain resource/debuff/dest tile (icon + name). Rarity → neon border color.
const REWARD_RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'];
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
  _rewardTT.innerHTML = `<div class="rtt-rar"></div><div class="rtt-name"></div><div class="rtt-desc"></div>`;
  document.body.appendChild(_rewardTT);
  return _rewardTT;
}
function hideRewardTooltip() { if (_rewardTT) { _rewardTT.classList.remove('show'); _rewardTT.dataset.key = ''; } }

// Which tile's tooltip is currently pinned open. This is the tile you most
// recently picked (or last tapped to inspect) - see onRewardCellClick.
let rewardTipKey = null;

// Fill and show the tooltip for one tile, anchored to it.
function showRewardTooltipFor(r, c) {
  const cell = rewardCells[r]?.[c];
  if (!cell || !cell.payload || !cell.payload.desc) { hideRewardTooltip(); return; }
  const p = cell.payload;
  // Works for the on-board tiles (#grid) and the legacy overlay grid alike.
  const el = document.querySelector(`#grid .reward-cell[data-r="${r}"][data-c="${c}"], #reward-grid .reward-cell[data-r="${r}"][data-c="${c}"]`);
  if (!el) return;
  const tt = ensureRewardTooltip();
  tt.className = 'rar-' + rewardRarity(p);
  tt.dataset.key = `${r}-${c}`;
  tt.querySelector('.rtt-rar').textContent  = (p.entity ? rewardRarity(p) + ' · ' : '') + rewardTypeLabel(p, cell.kind);
  tt.querySelector('.rtt-name').textContent = p.label;
  // Tricks show their current bonus value in () via trickLiveDesc (N/A here in
  // the reward grid for round-scoped tricks - the round isn't live yet).
  const descText = (p._trick && typeof trickLiveDesc === 'function') ? trickLiveDesc(p._trick) : (p.desc || '');
  tt.querySelector('.rtt-desc').innerHTML   = colorizeKeywords(descText);
  tt.classList.add('show');
  // Shared placement (js/entity-tooltip.js): roomiest side horizontally, with an
  // above/below fallback when neither side can fit the bubble - so a tile in the
  // right-most column pops out to the LEFT instead of squeezing against the edge.
  placeTipSmart(el, tt, { gap: 12 });
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
  el.addEventListener('mouseenter', () => showRewardTooltipFor(r, c));
  el.addEventListener('mouseleave', restoreRewardTooltip);
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
    const picks = `Picks: ${rewardSelected.size}/${cap}`;
    const atCap = rewardSelected.size >= cap;
    subEl.textContent = atCap
      ? `${picks} - selection full. Confirm, or tap a pick to remove it.`
      : selectedDest
        ? `${picks} - destination locked in. Confirm to set your route.`
        : `${picks} - choose a connected group. At most one destination.`;
  }

  const hasAny = rewardSelected.size > 0;
  document.getElementById('reward-confirm').disabled = !hasAny;
  document.getElementById('reward-clear').disabled   = !hasAny;
}

// Effective reward-grid pick cap = the Selection Size limit + Greedy Boi's reward-grid-only bonus.
function rewardSelectionCap() {
  return limits.selection.current + (hasKnack('greedy_boi') ? BAL.greedy_boi.selection : 0);
}

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
  if (label.includes('trick'))                                                    return 'tricks';   // Lose a Trick
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
  const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
  const dy = (b.top  + b.height / 2) - (a.top  + a.height / 2);
  await tile.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(0.62)`, opacity: 1, offset: 0.6 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.14)`, opacity: 0 },
  ], { duration: 380, easing: 'cubic-bezier(0.5,0,0.85,1)', fill: 'forwards' }).finished;
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
    'rar-common', 'rar-rare', 'rar-epic', 'rar-legendary', 'rar-mythic', 'mystery');
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
  if (hasTrick('more_better') && _picks >= BAL.more_better.min_tiles) {
    bonusMult_morebetter += BAL.more_better.mult;
    showMessage(`More Better! +${BAL.more_better.mult} mult (now +${bonusMult_morebetter})`, 'var(--gold)');
  }
  // Negative-tile tally (per run) - feeds Wild Side / Wait For Iiiit (read at scoring) + Shady Stimulants (on-take).
  if (_negThisGrid > 0) {
    negativeTilesTakenRun += _negThisGrid;
    if (hasKnack('shady_stimulants')) {
      focusCapPerm += _negThisGrid;
      showMessage(`Shady Stimulants - +${_negThisGrid} max Focus`, '#a25cd8');
    }
  }
  closeRewardGrid();
}

function closeRewardGrid() {
  hideRewardTooltip();
  stopRewardFloat();
  document.getElementById('reward-overlay')?.classList.remove('show');
  // Tear down the on-grid reward step: restore the action buttons, clear the
  // reward tiles from #grid, and drop back to normal render ownership.
  exitRewardButtonMode();
  document.body.classList.remove('reward-active', 'reward-boss', 'reward-prize');
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

    if (isActMode()) {
      if (nodeInAct === 5) {
        // Post-boss reward grid - transition to next act
        nodeInAct = 0;
        actNumber++;
        // Dead Drop cells are an ACT-long penalty; a new act is a clean board.
        deadCells = new Set();
        updateActProgressUI();
        if (actNumber > 3) {
          onGameWin();
          return;
        }
      } else {
        nodeInAct++;
        updateActProgressUI();
        if (nodeInAct === 5) {
          forceBossNextRound = true;
        }
      }
    }

    // Route based on destination tile the player selected (if any)
    const override = pendingEventOverride;
    pendingEventOverride = null;
    if (override === 'shop') {
      shopFromNodeFlow = true;
      triggerShop(); // shop close → drainLevelUpQueue (wired in shop-close handler)
    } else if (override === 'event') {
      shopFromNodeFlow = false;
      openEvent(() => drainLevelUpQueue());
    } else {
      drainLevelUpQueue();
    }
  };
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
    survivalSkipCarryover = true;
    triggerLevelUp();          // → showLevelUpScreen (survival) → survivalDealNext
    survivalSkipCarryover = false;
  };

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
let shopFromNodeFlow    = false;  // true when shop was opened mid-interlude; close → drainLevelUpQueue
let pendingLimitBreak   = false;  // a claimed Limit Break reward tile → open the LB screen on close

// ── LIMIT BREAK EVENT ──
// Offers 3 curated limits (2 known + 1 blind). Player breaks one for free.
// Optionally breaks a second by sacrificing: -1 to another limit, OR a Trick, OR a Knack.

let lbOffers = [];          // [{ id, blind, revealed }]
let lbPrimaryPick = null;   // offer index chosen as free pick
let lbSecondPick = null;    // offer index chosen as sacrifice pick
let lbSacrifice = null;     // { type:'limit'|'trick'|'knack', id }
let lbConfirmed = false;
let lbOnClose = null;       // continuation to run after the LB screen closes (reward-grid flow)

