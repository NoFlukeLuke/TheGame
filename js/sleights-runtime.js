function sleightDef(card) { return SLEIGHT_POOL.find(j => j.id === card.sleightId); }

function grantSleight(def) {
  const card = {
    _isSleight: true, sleightId: def.id,
    rank: def.defaultRank ?? null, suit: def.defaultSuit ?? null,
    _id: 80000 + (Date.now() % 10000) + Math.floor(Math.random()*100),
    _usesLeft: def.durability,
  };
  drawPile.push(card);
  grantedSleightIds.add(def.id);
  updateDeckHud?.();
  showMessage(`+ ${def.name}`, '#cc88ff');
}

function hasSleightOnGrid(id) {
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++)
      if (gridData[r]?.[c]?._isSleight && gridData[r][c].sleightId === id) return true;
  return false;
}

// Boss-immunity check used by isCellBlocked / isTrickDisabledByBoss / boss objective
function bossEffectsIgnored() { return hasSleightOnGrid('fight_power'); }

// Consume one charge from a sleight card at [r,c]; remove from grid when depleted.
function consumeSleightCharge(card, r, c) {
  if (!card || card._usesLeft === 'infinite') return;
  card._usesLeft--;
  if (card._usesLeft <= 0) {
    if (r >= 0 && c >= 0) gridData[r][c] = null;
    showMessage(`${sleightDef(card)?.name || 'Sleight'} consumed`, 'var(--cream-dim)');
  }
}

// double_tap / on_swap sleights fire at most once per round, then sit locked on the
// grid (still selectable/swappable/discardable normally) until next round resets them.
function sleightCanActivateThisRound(card) {
  if (!card || card._usedThisRound) return false;
  return card._usesLeft === 'infinite' || card._usesLeft > 0;
}
function lockSleightForRound(card) {
  if (!card) return;
  card._usedThisRound = true;
  if (card._usesLeft !== 'infinite') card._usesLeft--;
  if (card._usesLeft !== 'infinite' && card._usesLeft <= 0)
    showMessage(`${sleightDef(card)?.name || 'Sleight'} consumed — locked until discarded or played`, 'var(--cream-dim)');
}

// ── Exalt / Corrupt helpers ──
function exaltCard(r, c) {
  if (!exaltCorruptEnabled) return; // mechanic paused
  const card = gridData[r]?.[c];
  if (!card || card._isSleight || card._isTrick || card._isStone || !card.rank) return;
  card._corrupted = false;
  card._exalted = true;
}
function corruptCard(r, c) {
  if (!exaltCorruptEnabled) return; // mechanic paused
  const card = gridData[r]?.[c];
  if (!card || card._isSleight || card._isTrick || card._isStone || !card.rank) return;
  card._exalted = false;
  card._corrupted = true;
}
function exaltRandomCard() {
  const opts = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r][c];
    if (card && !card._isSleight && !card._isTrick && !card._isStone && card.rank && !card._exalted) opts.push([r, c]);
  }
  if (opts.length === 0) return;
  const [r, c] = opts[Math.floor(Math.random() * opts.length)];
  exaltCard(r, c);
}
function getNeighborsAll(r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) out.push([nr, nc]);
  }
  return out;
}

// ── round_start sleights (none in current pool, kept for framework) ──
function fireSleightsAtRoundStart() {
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const card = gridData[r][c];
      if (!card?._isSleight) continue;
      const def = sleightDef(card);
      if (!def || def.activation !== 'round_start') continue;
      applySleightGridEffect(def.id, r, c);
      consumeSleightCharge(card, r, c);
    }
  }
}

// ── on_draw sleights: fire when a sleight lands on the grid (called after deal) ──
function fireSleightsOnDraw() {
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const card = gridData[r][c];
      if (!card?._isSleight || card._drawFired) continue;
      const def = sleightDef(card);
      if (!def) continue;
      card._drawFired = true; // only fire once per landing
      if (def.activation === 'on_draw') {
        applySleightGridEffect(def.id, r, c);
        consumeSleightCharge(card, r, c);
      }
    }
  }
}

// ── on_play sleights: fire when a sleight is part of a played hand ──
// Called from playHand with the full set of selected cells.
function fireSleightsOnPlay(selectedCells, handCells, hand) {
  selectedCells.forEach(([r, c]) => {
    const card = gridData[r]?.[c];
    if (!card?._isSleight) return;
    const def = sleightDef(card);
    if (!def || def.activation !== 'on_play') return;
    // shortcut requires a 4-card hand
    if (def.id === 'shortcut' && handCells.length !== 4) return;
    // Rewind: rewind the clock by the hand size in seconds. The sleight itself counts toward the
    // size — but non-wild sleights are dropped from hand detection, so add 1 if it's not in handCells.
    if (def.id === 'rewind') {
      const _inHand = handCells.some(([hr, hc]) => hr === r && hc === c);
      const _size = _inHand ? handCells.length : handCells.length + 1;
      rewindTime(_size, `⏪ Rewind — +${_size}s`);
      consumeSleightCharge(card, r, c);
      return;
    }
    // Syncopation: hand type differs from the previous hand played
    if (def.id === 'syncopation') {
      if (lastHandType === null || hand === lastHandType) return;
      pauseRound(BAL.syncopation.seconds);
      consumeSleightCharge(card, r, c);
      return;
    }
    // Shady Tree: only fires when played from the round's "shady" column; pause = remaining charges
    // (10 → 1), which drop by 1 each use; the sleight is destroyed when it hits 0 (consumeSleightCharge).
    if (def.id === 'shady_tree') {
      if (c !== shadyColumn) return;
      pauseRound(card._usesLeft != null ? card._usesLeft : def.durability);
      consumeSleightCharge(card, r, c);
      return;
    }
    // Naturalist: each OTHER scored card permanently gains +2 pips
    if (def.id === 'the_naturalist') {
      let buffed = 0;
      handCells.forEach(([hr, hc]) => {
        if (hr === r && hc === c) return; // skip the sleight itself
        const hc2 = gridData[hr]?.[hc];
        if (hc2 && !hc2._isSleight && !hc2._isTrick && hc2.rank) {
          const k = cardKey(hc2.rank, hc2.suit);
          permPips[k] = (permPips[k] || 0) + BAL.the_naturalist.pips;
          buffed++;
        }
      });
      if (buffed > 0) showMessage(`🌿 Naturalist — ${buffed} card${buffed>1?'s':''} +2 pips!`, '#6aaa6a');
      consumeSleightCharge(card, r, c);
      return;
    }
    applySleightGridEffect(def.id, r, c);
    consumeSleightCharge(card, r, c);
  });
}

// ── on_swap sleights: fire when a sleight is one of the two swapped cells ──
function fireSleightsOnSwap(r1, c1, r2, c2) {
  [[r1, c1, r2, c2], [r2, c2, r1, c1]].forEach(([r, c, or2, oc2]) => {
    const card = gridData[r]?.[c];
    if (!card?._isSleight) return;
    const def = sleightDef(card);
    if (!def || def.activation !== 'on_swap') return;
    if (!sleightCanActivateThisRound(card)) return;
    if (def.id === 'lightning_rod') {
      const other = gridData[or2]?.[oc2];
      if (other && !other._isSleight && !other._isTrick && other.rank) {
        const k = cardKey(other.rank, other.suit);
        permPips[k] = (permPips[k] || 0) + BAL.lightning_rod.pips;
        showMessage('⚡ Lightning Rod — +5 pips!', '#ffd700');
        render();
      }
    } else if (def.id === 'the_catalyst') {
      const other = gridData[or2]?.[oc2];
      if (other && !other._isSleight && !other._isTrick && other.rank) {
        const k = cardKey(other.rank, other.suit);
        permMult[k] = (permMult[k] || 0) + BAL.the_catalyst.mult;
        showMessage('🧪 Catalyst — +1 perm mult!', '#cc88ff');
        render();
      }
    } else {
      applySleightGridEffect(def.id, r, c);
    }
    lockSleightForRound(card);
  });
}

// Magnet: pull every card of `rank` into the cells orthogonally adjacent to Magnet,
// by swapping grid data. Each pull counts as a swap (fires on_swap Sleights + Restless),
// which is the intended synergy. Returns how many cards were moved.
function magnetCluster(mr, mc, rank) {
  const inBounds = (r, c) => r >= 0 && c >= 0 && r < gridRows && c < gridCols;
  const isRank   = card => card && card.rank === rank && !card._isSleight && !card._isStone && !card._isTrick;
  const neighbors = [[mr-1,mc],[mr+1,mc],[mr,mc-1],[mr,mc+1]].filter(([r,c]) => inBounds(r,c));
  let moved = 0;
  for (const [nr, nc] of neighbors) {
    const nb = gridData[nr]?.[nc];
    if (!nb || nb._isSleight || nb._isStone || nb._isTrick) continue; // don't disturb fixtures
    if (nb.rank === rank) continue;                                   // already holds the rank
    if (!cardCan(nb, 'swap')) continue;                               // respect Snared etc.
    // Find a far card of the rank (not in a neighbor cell, not Magnet, swappable)
    let found = null;
    for (let r = 0; r < gridRows && !found; r++) for (let c = 0; c < gridCols && !found; c++) {
      if (r === mr && c === mc) continue;
      if (neighbors.some(([ar, ac]) => ar === r && ac === c)) continue;
      const cand = gridData[r]?.[c];
      if (isRank(cand) && cardCan(cand, 'swap')) found = [r, c];
    }
    if (!found) break; // nothing left to pull
    const [fr, fc] = found;
    const tmp = gridData[nr][nc];
    gridData[nr][nc] = gridData[fr][fc];
    gridData[fr][fc] = tmp;
    fireSleightsOnSwap(nr, nc, fr, fc); // counts as a swap
    if (hasTrick('restless')) addFocus(1);
    moved++;
  }
  return moved;
}

function applySleightGridEffect(id, r, c) {
  switch (id) {
    case 'good_friend':
      getNeighborsAll(r, c).forEach(([nr, nc]) => exaltCard(nr, nc));
      showMessage('The Good Friend exalts neighbors!', '#ffd700'); render(); break;
    case 'not_a_friend':
      getNeighborsAll(r, c).forEach(([nr, nc]) => corruptCard(nr, nc));
      showMessage('Not a Friend corrupts neighbors!', '#cc88ff'); render(); break;
    case 'shepherd':
      exaltRandomCard();
      showMessage('Shepherd exalts a card', '#ffd700'); render(); break;
    case 'shortcut':
      if (challengeActive) { resolveChallenge(true); showMessage('Shortcut — challenge complete!', 'var(--gold)'); }
      else showMessage('Shortcut — no active challenge', 'var(--cream-dim)');
      break;
    case 'dazed':
      reshuffleGrid();
      showMessage('Dazed & Confused — grid reshuffled!', '#cc88ff'); break;
    case 'pivot':
      // Free swap + buff are applied inline in doSwap; this just announces.
      showMessage('Pivot! Free swap + cards buffed', 'var(--gold)'); break;
    case 'idol':
      // handled in interest calc (round_end); no immediate effect
      break;
    case 'echo_play':
      sleightNextHandDouble = true;
      showMessage('🔁 Echo — next hand scores twice!', '#ffd700'); break;
    case 'bellhop':
      swaps += BAL.bellhop.swaps; discards = Math.min(99, discards + BAL.bellhop.discards); render();
      showMessage('🛎️ Bellhop — +2 swaps, +1 discard!', '#ffd700'); break;
    case 'the_bomb': {
      let _cnt = 0;
      for (let _r = 0; _r < gridRows; _r++)
        for (let _c = 0; _c < gridCols; _c++) {
          const _card = gridData[_r]?.[_c];
          if (_card && !_card._isSleight && !_card._isTrick && !_card._isStone && _card.rank) {
            const _k = cardKey(_card.rank, _card.suit);
            permPips[_k] = (_k in permPips ? permPips[_k] : 0) + BAL.the_bomb.pips;
            _cnt++;
          }
        }
      showMessage(`💣 Bomb — ${_cnt} cards +3 pips!`, '#ffd700'); render(); break;
    }
    case 'the_legacy':
      sleightLegacyMult = true;
      showMessage('📜 Legacy — next hand ×3!', '#ffd700'); break;
    case 'cash_out':
      coins += BAL.cash_out.coins; updateCoinsUI();
      showMessage('💰 Cash Out — +10 credits!', 'var(--gold)'); break;
    case 'the_wanderer':
      swaps = Math.min(99, swaps + BAL.the_wanderer.swaps); render();
      showMessage('🧭 Wanderer — swap refunded!', 'var(--gold)'); break;
    case 'amplifier':
      sleightAmplifierMult += BAL.amplifier.mult;
      showMessage('📢 Amplifier — next hand +5 mult!', 'var(--gold)'); break;
    case 'snooze':
      pauseRound(BAL.snooze.seconds);
      showMessage('😴 Snooze — clock paused 10s!', 'var(--gold)'); break;
    case 'last_call':
      // Only rewinds when discarded during the final minute of the round.
      if (roundSeconds <= BAL.last_call.last_minute_at) rewindTime(BAL.last_call.seconds, `⏳ Last Call — rewound ${BAL.last_call.seconds}s`);
      else showMessage('⏳ Last Call — only works in the final minute', 'var(--cream-dim)');
      break;
    case 'sandbag': {
      // Rewinds only when discarded alongside a pair of cards below rank 8; the rewind
      // equals that pair's rank in seconds (highest qualifying pair wins if there are several).
      const _co = _discardContextCards || [];
      const _counts = {};
      _co.forEach(c => { const _v = RANK_ORDER[c.rank] || 99; if (_v < BAL.sandbag.rank_below) _counts[_v] = (_counts[_v] || 0) + 1; });
      const _pairRanks = Object.keys(_counts).map(Number).filter(v => _counts[v] >= 2);
      if (_pairRanks.length) { const _sec = Math.max(..._pairRanks); rewindTime(_sec, `⏬ Sandbagger — rewound ${_sec}s`); }
      else showMessage('⏬ Sandbagger — needs a pair below rank 8', 'var(--cream-dim)');
      break;
    }
    case 'piggy_bank':
      coins += BAL.piggy_bank.coins; updateCoinsUI();
      showMessage('🐷 Piggy Bank — +5 credits!', 'var(--gold)'); break;
    default:
      showMessage(`${SLEIGHT_POOL.find(j=>j.id===id)?.name||'Sleight'} activated!`, '#cc88ff'); break;
  }
}

// Reshuffle every non-sleight card currently on the grid (Dazed & Confused).
function reshuffleGrid() {
  const cards = [];
  const slots = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r][c];
    if (card && !card._isSleight) { cards.push(card); slots.push([r, c]); }
  }
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [cards[i],cards[j]]=[cards[j],cards[i]]; }
  slots.forEach(([r, c], i) => { gridData[r][c] = cards[i]; });
  selected = [];
  render();
}

function showSleightGridTooltip(r, c, card) {
  hideSleightGridTooltip();
  const def = SLEIGHT_POOL.find(j => j.id === card.sleightId);
  if (!def) return;
  const gridEl = document.getElementById('grid');
  const sleightEl = gridEl?.querySelector(`[data-card-id="${card._id}"]`);
  if (!sleightEl) return;
  const uses = card._usesLeft === 'infinite' ? '∞ uses' : `${card._usesLeft} use${card._usesLeft !== 1 ? 's' : ''} left`;
  const tip = document.createElement('div');
  tip.id = 'sleight-grid-tooltip';
  tip.className = 'sleight-tooltip';
  const _usedLock = card._usedThisRound ? ' · USED THIS ROUND' : '';
  const _hint = def.id === 'stopwatch' ? 'DOUBLE-TAP TO FREEZE THE CLOCK'
              : def.activation === 'double_tap' ? `DOUBLE-TAP TO ACTIVATE · ONCE PER ROUND${_usedLock}`
              : def.activation === 'on_play' ? 'SELECT &amp; PLAY TO ACTIVATE'
              : def.activation === 'on_discard' ? 'SELECT &amp; DISCARD TO ACTIVATE'
              : def.activation === 'on_swap' ? `SWAP TO ACTIVATE · ONCE PER ROUND${_usedLock}`
              : 'LONG-PRESS FOR TOOLTIP';
    tip.innerHTML = `<div class="sleight-tooltip-name">${def.emoji} ${def.name}</div><div class="sleight-tooltip-desc">${colorizeKeywords(def.desc)}</div><div class="sleight-tooltip-uses">${uses}</div><div class="sleight-tooltip-hint">${_hint}</div>`;
  tip.style.opacity = '0';
  gridEl.appendChild(tip);
  void tip.offsetWidth;
  const gRect = gridEl.getBoundingClientRect();
  const eRect = sleightEl.getBoundingClientRect();
  const tipW = tip.offsetWidth, tipH = tip.offsetHeight;
  tip.style.left = Math.max(2, eRect.left - gRect.left + eRect.width/2 - tipW/2) + 'px';
  tip.style.top  = Math.max(2, eRect.top - gRect.top - tipH - 8) + 'px';
  tip.style.opacity = '1';
}
function hideSleightGridTooltip() {
  document.getElementById('sleight-grid-tooltip')?.remove();
}

// ── Unified long-press tooltip system ──────────────────────────────────────

let _longPressActive = false; // blocks onCardTap grid-pointerup call right after a long-press fires

function hideCardTooltip() {
  hideTrickTooltip();
  hideSleightGridTooltip();
  document.getElementById('card-enh-tooltip')?.remove();
}

function showCardTooltip(r, c) {
  hideCardTooltip();
  const card = gridData[r]?.[c];
  if (!card) return;
  if (card._isTrick)    { showTrickTooltip(card.trick, true); return; }
  if (card._isSleight) { showSleightGridTooltip(r, c, card); return; }
  // Normal card — show enhancement tooltip only if something to show
  const k  = cardKey(card.rank, card.suit);
  const pp = permPips[k]   || 0;
  const pm = permMult[k]   || 0;
  const xp = permXPips[k]  || 1;
  const xm = permXMult[k]  || 1;
  const re = permRetrig[k] || 0;
  if (!pp && !pm && xp <= 1 && xm <= 1 && !re && !card._exalted && !card._corrupted) return;
  const gridEl  = document.getElementById('grid');
  const cardEl  = gridEl?.querySelector(`[data-card-id="${card._id}"]`);
  if (!cardEl) return;
  const lines = [];
  if (pp)     lines.push(`+${pp} pips`);
  if (pm)     lines.push(`+${pm} mult`);
  if (xp > 1) lines.push(`×${xp} pip score`);
  if (xm > 1) lines.push(`×${xm} mult`);
  if (re)     lines.push(`+${re} replay`);
  if (card._exalted)   lines.push('Exalted');
  if (card._corrupted) lines.push('Corrupted');
  const tip = document.createElement('div');
  tip.id = 'card-enh-tooltip';
  tip.className = 'sleight-tooltip';
  tip.innerHTML = `<div class="sleight-tooltip-name">${card.rank}${card.suit}</div>`
                + `<div class="sleight-tooltip-desc">${lines.join('<br>')}</div>`;
  tip.style.opacity = '0';
  gridEl.appendChild(tip);
  void tip.offsetWidth;
  const gRect = gridEl.getBoundingClientRect();
  const eRect = cardEl.getBoundingClientRect();
  const tipW  = tip.offsetWidth, tipH = tip.offsetHeight;
  tip.style.left = Math.max(2, eRect.left - gRect.left + eRect.width / 2 - tipW / 2) + 'px';
  tip.style.top  = Math.max(2, eRect.top  - gRect.top  - tipH - 8) + 'px';
  tip.style.opacity = '1';
}

// Touch: tap-and-hold shows the tooltip. Desktop: hover shows it (no click-and-hold).
function attachLongPress(el, r, c) {
  let timer = null, longFired = false;
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const start = (e) => {
    if (e.pointerType === 'mouse') return; // desktop uses hover, not click-and-hold
    longFired = false;
    timer = setTimeout(() => {
      longFired = true;
      _longPressActive = true;
      showCardTooltip(r, c);
    }, 500);
  };
  el.onpointerdown  = start;
  el.onpointerup    = cancel;
  // Desktop hover in/out shows & hides the tooltip (only when no button is held —
  // a held button means a swipe-select is in progress, not a hover).
  el.onpointerenter = (e) => { if (e.pointerType === 'mouse' && e.buttons === 0) showCardTooltip(r, c); };
  el.onpointerleave = (e) => { cancel(); if (e.pointerType === 'mouse') hideCardTooltip(); };
  const prev = el.onclick;
  el.onclick = (e) => {
    if (longFired) { longFired = false; e.stopPropagation(); return; }
    if (prev) prev.call(el, e);
  };
}

// Dismiss any card tooltip when tapping outside a card or tooltip element
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('.trick-card') &&
      !e.target.closest('#trick-tooltip') &&
      !e.target.closest('#sleight-grid-tooltip') &&
      !e.target.closest('#card-enh-tooltip')) {
    hideCardTooltip();
  }
});

// ══════════════════════════════════════════════
// EVENT SYSTEM
// ══════════════════════════════════════════════

