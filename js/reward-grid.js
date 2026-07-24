function generateRewardContent() {
  const ROWS = limits.grid_rows.current;
  const COLS = limits.grid_cols.current;

  // Weighted buff categories. Tricks are also guaranteed a minimum count per
  // grid (MIN_TRICK_TILES below), so their true share ends up higher than the
  // raw weight suggests — the other categories fight over the leftover slots.
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
  const _handNow = 5 + extraPlayCostPerm + nextRoundPlayCost;
  const _discNow = 3 + extraDiscardCostPerm + nextRoundDiscardCost;
  const debuffs = [
    { weight: 8, icon: '☁', label: '-5s Round Cap', tier: 'penalty',
      desc: `Round cap: ${formatTime(_capNow)} → ${formatTime(Math.max(10, _capNow - 5))} · permanent, stacks`,
      apply: () => { roundPenaltySeconds += 5; showMessage('Round cap -5s (permanent)', 'var(--red)'); } },
    { weight: 8, icon: '☠', label: '-1 Discard', tier: 'penalty',
      desc: `Next round discards: ${_proj.discards} → ${Math.max(0, _proj.discards - 1)} · next round only`,
      apply: () => { nextRoundDiscardDelta -= 1; showMessage('-1 discard next round', 'var(--red)'); } },
    { weight: 8, icon: '✖', label: '-1 Swap', tier: 'penalty',
      desc: `Next round swaps: ${_proj.swaps} → ${Math.max(0, _proj.swaps - 1)} · next round only`,
      apply: () => { nextRoundSwapDelta -= 1; showMessage('-1 swap next round', 'var(--red)'); } },
    { weight: 8, icon: '💔', label: 'Lose a Trick', tier: 'penalty',
      desc: 'Discard one random Trick you own.',
      apply: applyRewardLoseTrick },
    { weight: 8, icon: '🐌', label: 'Hands +2s', tier: 'penalty',
      desc: `Hand cost: ${_handNow}s → ${_handNow + 2}s each · permanent, stacks`,
      apply: () => { extraPlayCostPerm += 2; showMessage('Playing a hand costs +2s (permanent)', 'var(--red)'); } },
    { weight: 8, icon: '⌛', label: 'Hands +5s · 1rd', tier: 'penalty',
      desc: `Next round hand cost: ${_handNow}s → ${_handNow + 5}s each · next round only`,
      apply: () => { nextRoundPlayCost += 5; showMessage('Hands cost +5s next round', 'var(--red)'); } },
    { weight: 8, icon: '🐌', label: 'Discards +2s', tier: 'penalty',
      desc: `Discard cost: ${_discNow}s → ${_discNow + 2}s per card · permanent, stacks`,
      apply: () => { extraDiscardCostPerm += 2; showMessage('Discarding costs +2s/card (permanent)', 'var(--red)'); } },
    { weight: 8, icon: '⌛', label: 'Discards +5s · 1rd', tier: 'penalty',
      desc: `Next round discard cost: ${_discNow}s → ${_discNow + 5}s per card · next round only`,
      apply: () => { nextRoundDiscardCost += 5; showMessage('Discards cost +5s/card next round', 'var(--red)'); } },
    // ── Variety debuffs (r74) ──
    { weight: 8, icon: '💸', label: 'Pickpocket', tier: 'penalty',
      desc: `Lose 10 coins (${coins} → ${Math.max(0, coins - 10)}).`,
      apply: () => { coins = Math.max(0, coins - 10); updateCoinsUI(); showMessage('-10 coins', 'var(--red)'); } },
    { weight: 8, icon: '🪨', label: 'Stones', tier: 'penalty',
      desc: 'Two Stones are shuffled into your deck. They block cells until purged.',
      apply: () => { injectStonesIntoDeck(2); showMessage('2 Stones added to deck', 'var(--red)'); } },
    { weight: 8, icon: '⏳', label: 'Slow Start', tier: 'penalty',
      desc: 'Next round starts with 20 fewer seconds.',
      apply: () => { nextRoundSecondsDelta -= 20; showMessage('-20s next round', 'var(--red)'); } },
  ];
  // Cursed-card debuff: afflicts one specific shown card (weight 10; only if an
  // un-cursed identity exists). Card is pre-picked so the tile shows exactly it.
  {
    const _uncursed = [];
    RANKS.forEach(rank => SUITS.forEach(suit => { if (!cardCurses[cardKey(rank, suit)]) _uncursed.push({ rank, suit }); }));
    if (_uncursed.length) {
      const _victim = _uncursed[Math.floor(Math.random() * _uncursed.length)];
      const _cids = Object.keys(CURSE_DEFS);
      const _cid  = _cids[Math.floor(Math.random() * _cids.length)];
      debuffs.push({ weight: 10, icon: CURSE_DEFS[_cid].icon, label: `${CURSE_DEFS[_cid].name} Curse`, tier: 'penalty',
        cardFace: { rank: _victim.rank, suit: _victim.suit },
        desc: `${_victim.rank}${_victim.suit} is cursed — ${CURSE_DEFS[_cid].desc}`,
        apply: () => { cardCurses[cardKey(_victim.rank, _victim.suit)] = { id: _cid, left: CURSE_DEFS[_cid].liftAfter }; showMessage(`${_victim.rank}${_victim.suit} cursed: ${CURSE_DEFS[_cid].name}`, '#9b59b6'); } });
    }
  }
  // Limit-drain debuff: -1 to a shown limit (weight 5; only if something is drainable).
  // round_time is excluded — a 1-second drain reads like a bug, not a curse.
  {
    const _drainable = LIMITS_DEF.filter(d => d.id !== 'round_time' && limits[d.id].current > 1);
    if (_drainable.length) {
      const _dl = pickWeightedLimits(1, _drainable)[0];
      debuffs.push({ weight: 5, icon: '⬇️', label: `-1 ${_dl.label}`, tier: 'penalty',
        desc: `${_dl.label}: ${limits[_dl.id].current} → ${limits[_dl.id].current - 1} · permanent (limits are precious!)`,
        apply: () => { decrementLimit(_dl.id); showMessage(`-1 ${_dl.label}`, 'var(--red)'); } });
    }
  }
  // Dark mystery: unknown until claimed — mostly bad (weight 6).
  debuffs.push({ weight: 6, icon: '❓', label: 'Dark Mystery', tier: 'mystery',
    desc: 'Unknown until claimed. Probably bad… probably.',
    apply: () => resolveRewardMystery(0.3) });
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
  function shuffled(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  // Pre-pick Trick at generation time so the tile shows the exact card
  function makeTrickPayload() {
    if (typeof TRICK_POOL === 'undefined') return { icon: '★', label: 'Trick', tier: 'rare', apply: applyRewardRandomTrick };
    const owned = new Set((acquiredTricks || []).map(b => b.id));
    const eligible = TRICK_POOL.filter(b => !owned.has(b.id));
    if (eligible.length === 0) return { icon: '★', label: 'Trick', tier: 'rare', apply: applyRewardRandomTrick };
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    return {
      icon: '★', label: pick.name, desc: pick.desc, tier: pick.tier || 'rare',
      apply: () => injectTrickAfterReward(pick)
    };
  }

  function makeSleightPayload() {
    const eligible = SLEIGHT_POOL.filter(j => !grantedSleightIds.has(j.id));
    if (!eligible.length) return makeTrickPayload(); // fallback
    const [pick] = pickSleightByRarity(1, grantedSleightIds);
    if (!pick) return makeTrickPayload();
    return {
      icon: pick.emoji || '\u{1F0CF}', label: pick.name, desc: pick.desc, tier: pick.rarity || 'rare',
      apply: () => grantSleight(pick)
    };
  }

  // Blessed-card buff: a specific shown card gains a permanent bonus.
  function makeBlessedPayload() {
    const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    const mult = Math.random() < 0.3; // 30% of blessings are the (stronger) +1 mult
    return mult
      ? { icon: '✨', label: 'Blessed Card', tier: 'epic', cardFace: { rank, suit },
          desc: `${rank}${suit} permanently gains +1 mult when scored.`,
          apply: () => { const k = cardKey(rank, suit); permMult[k] = (permMult[k] || 0) + 1; showMessage(`${rank}${suit} blessed: +1 mult`, 'var(--gold)'); } }
      : { icon: '✨', label: 'Blessed Card', tier: 'rare', cardFace: { rank, suit },
          desc: `${rank}${suit} permanently gains +12 pips.`,
          apply: () => { const k = cardKey(rank, suit); permPips[k] = (permPips[k] || 0) + 12; showMessage(`${rank}${suit} blessed: +12 pips`, 'var(--gold)'); } };
  }
  // Cull buff: deck thinning — a specific low card leaves the run for good.
  function makeCullPayload() {
    const rank = ['2', '3', '4'][Math.floor(Math.random() * 3)];
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    return { icon: '✂️', label: 'Cull', tier: 'rare', cardFace: { rank, suit },
      desc: `Remove ${rank}${suit} from your deck for the rest of the run.`,
      apply: () => { removeCardIdentityFromRun(rank, suit)
        ? showMessage(`${rank}${suit} culled from deck`, 'var(--gold)')
        : showMessage(`${rank}${suit} was already gone`, 'var(--cream-dim)'); } };
  }
  function makeLimitUpPayload() {
    // round_time excluded — its +1 = 1 second; time is handled by the +15s tile.
    const eligible = LIMITS_DEF.filter(d => d.id !== 'round_time' && limits[d.id].current < limits[d.id].max);
    if (!eligible.length) return makeTrickPayload();
    const dl = pickWeightedLimits(1, eligible)[0];
    return { icon: '⬆️', label: `+1 ${dl.label}`, tier: 'epic',
      desc: `${dl.label}: ${limits[dl.id].current} → ${limits[dl.id].current + 1} · permanent`,
      apply: () => { incrementLimit(dl.id); showMessage(`+1 ${dl.label}!`, 'var(--gold)'); } };
  }

  function makeBuff() {
    const cat = weightedPick(buffCategories);
    switch (cat.kind) {
      case 'trick':      return makeTrickPayload();
      case 'sleight':   return makeSleightPayload();
      case 'knack':   return { icon: '♛', label: 'Knack',        tier: 'legendary', apply: applyRewardKnack };
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
      case 'limit_up': return makeLimitUpPayload();
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
                               apply: () => resolveRewardMystery(0.7) };
    }
  }

  // Checkerboard: (r+c) even → buff/dest slot, (r+c) odd → debuff slot
  const buffPos   = [];
  const debuffPos = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      ((r + c) % 2 === 0 ? buffPos : debuffPos).push([r, c]);

  const shuffledBuff = shuffled(buffPos);
  const grid = Array.from({length: ROWS}, () => Array(COLS).fill(null));

  // One destination in a random buff slot
  grid[shuffledBuff[0][0]][shuffledBuff[0][1]] = { kind: 'dest', payload: pickRand(destOptions) };

  // Fill remaining buff positions
  for (let i = 1; i < shuffledBuff.length; i++) {
    const [r, c] = shuffledBuff[i];
    grid[r][c] = { kind: 'buff', payload: makeBuff() };
  }

  // Guarantee a minimum number of Trick tiles per grid (owner spec: a reward
  // grid should always offer a real Trick choice — tricks are the connective
  // tissue of builds). Non-trick buffs are converted at random until met.
  const MIN_TRICK_TILES = 5;
  {
    const isTrickTile = cell => cell?.kind === 'buff' && cell.payload && String(cell.payload.icon) === '★';
    let trickCount = 0;
    const convertible = [];
    for (let i = 1; i < shuffledBuff.length; i++) {
      const [r, c] = shuffledBuff[i];
      if (isTrickTile(grid[r][c])) trickCount++;
      else convertible.push([r, c]);
    }
    while (trickCount < MIN_TRICK_TILES && convertible.length) {
      const [r, c] = convertible.splice(Math.floor(Math.random() * convertible.length), 1)[0];
      grid[r][c] = { kind: 'buff', payload: makeTrickPayload() };
      trickCount++;
    }
  }

  // Fill all debuff positions — weighted, and one-per-grid for the "big" kinds
  // (two identical curse/drain/mystery tiles in one grid would be confusing)
  const usedOnce = new Set();
  for (const [r, c] of debuffPos) {
    let pick = null;
    for (let tries = 0; tries < 12; tries++) {
      const cand = weightedPick(debuffs);
      const isOnceKind = cand.cardFace || cand.icon === '⬇️' || cand.tier === 'mystery';
      if (isOnceKind && usedOnce.has(cand.label)) continue;
      if (isOnceKind) usedOnce.add(cand.label);
      pick = cand; break;
    }
    grid[r][c] = { kind: 'debuff', payload: pick || pickRand(debuffs) };
  }

  return grid;
}

// ── Mystery tile resolution ──
// goodChance ∈ [0,1]: buff-slot Mystery = 0.7, debuff-slot Dark Mystery = 0.3.
// Effects are deliberately simple + self-contained (no Trick grants — a
// tray-full replace picker popping out of a mystery would be jarring).
function resolveRewardMystery(goodChance) {
  const good = Math.random() < goodChance;
  if (good) {
    const roll = Math.floor(Math.random() * 5);
    if (roll === 0) { coins += 12; updateCoinsUI(); showMessage('Mystery: +12 coins!', 'var(--gold)'); }
    else if (roll === 1) { nextRoundSwapDelta += 2; showMessage('Mystery: +2 swaps next round!', 'var(--gold)'); }
    else if (roll === 2) { nextRoundDiscardDelta += 2; showMessage('Mystery: +2 discards next round!', 'var(--gold)'); }
    else if (roll === 3) { nextRoundSecondsDelta += 25; showMessage('Mystery: +25s next round!', 'var(--gold)'); }
    else { const rank = RANKS[Math.floor(Math.random()*RANKS.length)], suit = SUITS[Math.floor(Math.random()*SUITS.length)];
           const k = cardKey(rank, suit); permPips[k] = (permPips[k] || 0) + 10;
           showMessage(`Mystery: ${rank}${suit} +10 pips!`, 'var(--gold)'); }
  } else {
    const roll = Math.floor(Math.random() * 5);
    if (roll === 0) { coins = Math.max(0, coins - 8); updateCoinsUI(); showMessage('Mystery: -8 coins…', 'var(--red)'); }
    else if (roll === 1) { nextRoundSwapDelta -= 1; showMessage('Mystery: -1 swap next round…', 'var(--red)'); }
    else if (roll === 2) { nextRoundSecondsDelta -= 15; showMessage('Mystery: -15s next round…', 'var(--red)'); }
    else if (roll === 3) { injectStonesIntoDeck(1); showMessage('Mystery: a Stone slips into your deck…', 'var(--red)'); }
    else { const v = curseRandomCard(); showMessage(v ? `Mystery: ${v.rank}${v.suit} cursed (${CURSE_DEFS[v.curse].name})…` : 'Mystery: …nothing?', '#9b59b6'); }
  }
}

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
  // Collect all current Tricks — either from tray or grid
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

// Tray is full — show the picker in 'replace' mode for the next queued new Trick.
function maybeOpenTrickReplacePicker() {
  if (!_trickReplaceQueue.length) return;
  if (document.getElementById('trick-lose-picker').classList.contains('show')) return; // one at a time
  const incoming = _trickReplaceQueue[0];
  _blpMode = 'replace';
  document.getElementById('blp-title').textContent = 'TRICK SLOTS FULL';
  document.getElementById('blp-sub').textContent =
    `New Trick: “${incoming.name}” — ${incoming.desc || ''}  Choose a Trick to replace, or skip the new one.`;
  document.getElementById('blp-confirm').textContent = 'Replace Selected';
  document.getElementById('blp-cancel').style.display = '';
  openTrickLosePicker(trickTray.map((trick, idx) => ({ trick, source: 'tray', idx })));
}

function cancelTrickReplacePicker() {
  document.getElementById('trick-lose-picker').classList.remove('show');
  const skipped = _trickReplaceQueue.shift();
  if (skipped) showMessage(`Skipped ${skipped.name} (tray full)`, 'var(--cream-dim)');
  _blpMode = 'lose';
  setTimeout(() => maybeOpenTrickReplacePicker(), 150);
}

function openTrickLosePicker(options) {
  if (_blpMode !== 'replace') {
    // restore the default 'lose' chrome (replace mode pre-sets its own)
    document.getElementById('blp-title').textContent = 'CHOOSE A TRICK TO LOSE';
    document.getElementById('blp-sub').textContent = 'Select one — it will be removed permanently.';
    document.getElementById('blp-confirm').textContent = 'Remove Selected';
    document.getElementById('blp-cancel').style.display = 'none';
  }
  _blpOptions  = options;
  _blpSelected = -1;
  const list = document.getElementById('blp-list');
  list.innerHTML = '';
  options.forEach((opt, i) => {
    const el = document.createElement('div');
    el.className = 'blp-item';
    el.innerHTML = `<div class="blp-item-tier">${opt.trick.tier || 'common'}</div>`
                 + `<div class="blp-item-name">${opt.trick.name}</div>`
                 + `<div class="blp-item-desc">${opt.trick.desc || ''}</div>`;
    el.addEventListener('click', () => selectBLPItem(i));
    list.appendChild(el);
  });
  document.getElementById('blp-confirm').disabled = true;
  document.getElementById('trick-lose-picker').classList.add('show');
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
  showMessage(`+ ${pick.name}`, 'var(--gold)');
}

function openRewardGrid() {
  gameTimerPaused = true;
  rewardCells     = generateRewardContent();
  rewardSelected  = new Set();
  rewardConfirmed = false;
  document.getElementById('reward-overlay').classList.add('show'); // show first so offsetHeight is accurate
  renderRewardGrid();
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

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key  = `${r}-${c}`;
      const cell = rewardCells[r][c];
      const isSel = rewardSelected.has(key);
      const canSel = isRewardCellSelectable(r, c);

      const div = document.createElement('div');
      div.className = [
        'reward-cell',
        cell.kind,
        isSel   ? 'selected'    : '',
        !isSel && canSel  ? 'selectable'  : '',
        !isSel && !canSel ? 'unselectable': '',
      ].filter(Boolean).join(' ');
      div.dataset.r = r; div.dataset.c = c;

      const p = cell.payload;
      // Tiles that reference a specific card (blessed/cursed/cull) show a mini
      // playing card instead of a plain emoji, so the player sees exactly which.
      const faceHTML = p.cardFace
        ? `<div class="reward-face ${suitClass(p.cardFace.suit)}"><span class="reward-face-rank">${p.cardFace.rank}</span><span class="reward-face-suit">${p.cardFace.suit}</span></div>`
        : `<div class="reward-icon">${p.icon}</div>`;
      div.innerHTML = `
        <div class="reward-tier">${p.tier.toUpperCase()}</div>
        ${faceHTML}
        <div class="reward-label">${p.label}</div>
        ${p.desc ? `<div class="reward-desc">${colorizeKeywords(p.desc)}</div>` : ''}
      `;
      div.onclick = () => onRewardCellClick(r, c);
      gridEl.appendChild(div);
    }
  }

  // Footer
  const items = [...rewardSelected]
    .map(key => { const [r,c] = key.split('-').map(Number); return rewardCells[r][c]; })
    .filter(cell => cell.kind !== 'entry')
    .map(cell => `${cell.payload.icon} ${cell.payload.label}`);
  document.getElementById('reward-collected-list').textContent = items.length ? items.join('  ·  ') : '—';

  // Subtitle: picks counter (Selection Size cap) + destination warning
  const subEl = document.getElementById('reward-sub');
  if (subEl) {
    const selectedDest = [...rewardSelected].find(k => {
      const [sr, sc] = k.split('-').map(Number);
      return rewardCells[sr]?.[sc]?.kind === 'dest';
    });
    const cap = limits.selection.current;
    const picks = `Picks: ${rewardSelected.size}/${cap}`;
    const atCap = rewardSelected.size >= cap;
    subEl.textContent = atCap
      ? `${picks} — selection full. Confirm, or tap a pick to remove it.`
      : selectedDest
        ? `${picks} — destination locked in. Confirm to set your route.`
        : `${picks} — choose a connected group. At most one destination.`;
  }

  const hasAny = rewardSelected.size > 0;
  document.getElementById('reward-confirm').disabled = !hasAny;
  document.getElementById('reward-clear').disabled   = !hasAny;
}

// A cell is selectable if: nothing selected yet (any cell), OR orthogonally adjacent to any selected cell and not already selected
function isRewardCellSelectable(r, c) {
  const key = `${r}-${c}`;
  if (rewardSelected.has(key)) return false; // already selected
  // Picks are capped by the Selection Size limit — same cap as the play grid
  if (rewardSelected.size >= limits.selection.current) return false;
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
  if (rewardSelected.size === 0) return true; // first pick — anything goes
  // Must be orthogonally adjacent to at least one selected cell
  const neighbors = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
  return neighbors.some(([nr,nc]) => rewardSelected.has(`${nr}-${nc}`));
}

function onRewardCellClick(r, c) {
  if (rewardConfirmed) return;
  const key = `${r}-${c}`;

  // Clicking a selected cell deselects it (only if it's on the "fringe" — removing it
  // wouldn't disconnect the remaining group)
  if (rewardSelected.has(key)) {
    // Check: would removing this cell leave the rest connected?
    const remaining = new Set([...rewardSelected].filter(k => k !== key));
    if (remaining.size === 0 || isGroupConnected(remaining)) {
      rewardSelected.delete(key);
      renderRewardGrid();
    }
    return;
  }

  if (!isRewardCellSelectable(r, c)) return;
  rewardSelected.add(key);
  renderRewardGrid();
}

// BFS connectivity check — ensures remaining selected cells are still one connected group
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
  if (rewardConfirmed) return;
  rewardSelected = new Set();
  renderRewardGrid();
}

function confirmRewardPath() {
  if (rewardConfirmed || rewardSelected.size === 0) return;
  rewardConfirmed = true;
  rewardSelected.forEach(key => {
    const [r, c] = key.split('-').map(Number);
    const cell = rewardCells[r][c];
    if (cell.payload && typeof cell.payload.apply === 'function') cell.payload.apply();
  });
  closeRewardGrid();
}

function closeRewardGrid() {
  document.getElementById('reward-overlay').classList.remove('show');
  rewardSelected  = new Set();
  rewardCells     = [];
  gameTimerPaused = false;

  if (rewardGridContext === 'interlude') {
    skipTrickChoiceOverlay = true;

    if (ACTIVE_MODE.id === 'normal') {
      if (nodeInAct === 5) {
        // Post-boss reward grid — transition to next act
        nodeInAct = 0;
        actNumber++;
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
  } else {
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
  }
}

// Wire buttons
(function wireRewardButtons() {
  const confirm = document.getElementById('reward-confirm');
  const clear   = document.getElementById('reward-clear');
  if (confirm) confirm.addEventListener('click', confirmRewardPath);
  if (clear)   clear.addEventListener('click', clearRewardSelection);
})();

let pendingEventOverride = null; // 'normal' | 'shop' | 'event' — set by reward grid dest tiles
let shopFromNodeFlow    = false;  // true when shop was opened mid-interlude; close → drainLevelUpQueue

// ── LIMIT BREAK EVENT ──
// Offers 3 curated limits (2 known + 1 blind). Player breaks one for free.
// Optionally breaks a second by sacrificing: -1 to another limit, OR a Trick, OR a Knack.

let lbOffers = [];          // [{ id, blind, revealed }]
let lbPrimaryPick = null;   // offer index chosen as free pick
let lbSecondPick = null;    // offer index chosen as sacrifice pick
let lbSacrifice = null;     // { type:'limit'|'trick'|'knack', id }
let lbConfirmed = false;

