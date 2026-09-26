function sleightDef(card) { return SLEIGHT_POOL.find(j => j.id === card.sleightId); }

// ── Sleight card FACE (r172, reworked r175) ────────────────────────────────
// A Sleight is a card in the deck, so it wears a card's furniture: an index in
// the top-left corner. What that index SAYS depends on what the Sleight is.
//
//   plain Sleight   S over a house mark (◈ ◇ ✦ …)  - "this is a Sleight, and it
//                   has no playing identity"
//   wildcard        W over ∞                      - wild rank, endless suit
//   tinkered        a REAL rank over a REAL suit   - it has been given an
//                   identity at the Mart's Tinker bench and now plays as a card
//
// r172 gave every Sleight a RANDOM rank and suit. That was worse than nothing:
// it printed 7♦ on a card that could never be part of a seven, so the face was
// a lie. The marks below identify rather than impersonate, and a real rank only
// ever appears on a Sleight that has actually earned one (see sleightAssignIdentity).
const SLEIGHT_HOUSE_MARKS = ['◈', '◇', '✦', '❖', '⬥', '◆'];

function sleightIsWild(def) { return !!def && def.activation === 'wildcard'; }
// A Sleight that has been given a playing identity at the Tinker bench. Wildcards
// can never be tinkered, so this and sleightIsWild are mutually exclusive.
function sleightIsPlayable(card) {
  if (!card || !card.rank) return false;
  if (sleightDef(card)?.fixedRank) return true;   // The Queen (r358): a real rank, no suit
  return !!(card._playable && card.suit);
}

function sleightFace(card, def) {
  if (!card) return { rank: 'S', suit: '◈', kind: 'plain' };
  if (sleightIsPlayable(card)) return { rank: card.rank, suit: card.suit || '♛', kind: 'playable' };
  if (sleightIsWild(def || sleightDef(card))) return { rank: 'W', suit: '∞', kind: 'wild' };
  // The house mark is stable per card, so a Sleight keeps the same face across
  // renders and deck cycles rather than flickering through the set.
  if (card._faceMark == null) card._faceMark = SLEIGHT_HOUSE_MARKS[Math.floor(Math.random() * SLEIGHT_HOUSE_MARKS.length)];
  return { rank: 'S', suit: card._faceMark, kind: 'plain' };
}

// Rarity → the card's edge colour, as a class both render paths add.
function sleightRarityClass(def) {
  const r = def && def.rarity;
  return ['common','rare','epic','legendary','fixture'].includes(r) ? ' sl-rar-' + r : ' sl-rar-common';
}

// Markup shared by both render paths (js/render.js and js/card-fall.js) so the
// grid, the fall animation and the hand preview can never disagree.
function sleightFaceHTML(card, def, usesStr) {
  const f = sleightFace(card, def);
  const red = f.kind === 'playable' && '♥♦'.includes(f.suit);
  const numeric = f.kind === 'playable' && (typeof isColorSuit === 'function') && isColorSuit(f.suit);
  const tone = f.kind === 'playable' ? (red ? 'sl-red' : 'sl-blk') : 'sl-mark';
  return `<div class="sleight-index ${tone} sl-k-${f.kind}${numeric ? ' sl-num' : ''}">`
       +   `<span class="sl-rank">${f.rank}</span><span class="sl-suit">${f.suit}</span>`
       + `</div>`
       + `<div class="sleight-card-emoji">${def?.emoji || '🃏'}</div>`
       + `<div class="sleight-card-name">${def?.name || 'Sleight'}</div>`
       + `<div class="sleight-card-uses">${usesStr}</div>`;
}

// ── The Tinker bench: give a Sleight a real playing identity ────────────────
// The card keeps everything it already does AND starts counting as a normal
// card in hand detection. Wildcards are refused: they already have the best
// identity in the game, and pinning one would silently un-wild it.
function sleightCanTinker(card, def) {
  return !!card && !sleightIsWild(def || sleightDef(card)) && !sleightIsPlayable(card);
}
function sleightAssignIdentity(card, rank, suit) {
  if (!card) return null;
  const ranks = (typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS.length) ? ACTIVE_RANKS : RANKS;
  const suits = (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length) ? ACTIVE_SUITS : SUITS;
  card.rank = rank || ranks[Math.floor(Math.random() * ranks.length)];
  card.suit = suit || suits[Math.floor(Math.random() * suits.length)];
  card._playable = true;
  return { rank: card.rank, suit: card.suit };
}

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
function bossEffectsIgnored() { return !!liveFightPower(); }

// ── Timed charges (r356, plan 4i) ───────────────────────────────────────────
// A Sleight whose def carries `secsPerCharge` spends its charges as TIME: every
// that-many seconds of use is one charge. _usesLeft stays the charge count, so
// everything that reads or restores charges (the n/max on the card, Jury-Rig,
// Maintenance, Martyr) works on these unchanged - a restored charge is simply
// secsPerCharge more seconds. _chargeSecsUsed is the part of the current charge
// already spent.
function sleightSecsLeft(card) {
  const def = sleightDef(card);
  if (!def?.secsPerCharge || typeof card._usesLeft !== 'number') return null;
  return Math.max(0, card._usesLeft * def.secsPerCharge - (card._chargeSecsUsed || 0));
}
// Spend one second. Returns false once the Sleight is spent (and takes it off
// the board - a spent timed Sleight has nothing left to give).
function sleightTimedDrain(card) {
  const def = sleightDef(card);
  if (!def?.secsPerCharge || typeof card._usesLeft !== 'number') return true;
  card._chargeSecsUsed = (card._chargeSecsUsed || 0) + 1;
  if (card._chargeSecsUsed >= def.secsPerCharge) { card._usesLeft--; card._chargeSecsUsed = 0; }
  if (card._usesLeft > 0) return true;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (gridData[r]?.[c] === card) gridData[r][c] = null;
  refuse(`${def.name} is spent`, { color: 'var(--cream-dim)' });
  if (typeof render === 'function') render();
  return false;
}
// The first Fight the Power on the board with time left.
function liveFightPower() {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (cd?._isSleight && cd.sleightId === 'fight_power' && (cd._usesLeft === 'infinite' || cd._usesLeft > 0)) return cd;
  }
  return null;
}
// Round tick: Fight the Power only spends its time while a boss is actually
// running - there is nothing to ignore otherwise.
function fightPowerTick() {
  if (typeof bossFxLive !== 'function' || !bossFxLive()) return;
  const fp = liveFightPower();
  if (fp) sleightTimedDrain(fp);
}

// ── A Sleight with a board LIFESPAN (r371) ───────────────────────────────────
// Whetstone discards itself after BAL.whetstone.life_seconds on the board. The
// clock is _gridSecs ON THE CARD, ticked from the round tick (so it stops with
// the round, the pause menu and RECORDS), and it is left out of discardToPlayed's
// rebuild on purpose: every lap back onto the board starts a fresh clock. The
// board persists between rounds (r332), so a Whetstone that stays put keeps
// counting across them. The leave waits out an animation or a fall rather than
// cutting it short (the r213 Hollow lesson) - the card just runs a second late.
const SLEIGHT_LIFESPAN = { whetstone: () => BAL.whetstone?.life_seconds || 90 };
function sleightLifeLeft(card) {
  const f = card?._isSleight && SLEIGHT_LIFESPAN[card.sleightId];
  if (!f) return null;
  const total = f();
  return { left: Math.max(0, total - (card._gridSecs || 0)), total };
}
function sleightLifeTick() {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r]?.[c];
    if (!card?._isSleight || !SLEIGHT_LIFESPAN[card.sleightId]) continue;
    if ((card._gridSecs || 0) < SLEIGHT_LIFESPAN[card.sleightId]()) card._gridSecs = (card._gridSecs || 0) + 1;
    if (card._gridSecs < SLEIGHT_LIFESPAN[card.sleightId]()) continue;
    if (animating || falling || sleightSpinLock) continue;   // try again next tick
    const def = sleightDef(card);
    showMessage(`${def?.name || 'Sleight'} discards itself`, 'var(--cream-dim)');
    spinSleightTile(r, c, () => {
      if (gridData[r]?.[c] !== card) return;   // the board moved during the spin
      discardToPlayed(card);                   // cycles back with its charges and banked mult
      removeAndFall([[r, c]], 'discard');      // slide it out + gravity-refill the cell
    });
    return;                                    // one at a time: removeAndFall takes the falling lock
  }
}

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
    showMessage(`${sleightDef(card)?.name || 'Sleight'} consumed - locked until discarded or played`, 'var(--cream-dim)');
}

// ── INERT on use (r341, owner's word) ──
// Piggy Bank and Capacitor no longer discard-on-use: they fire IN PLACE, at most
// once per round (the ordinary _usedThisRound lock, cleared by the round-start
// sweep), and become INERT - the card stays on the grid and can no longer be
// swapped or discarded (cardCan gates both). It can still be selected into a
// hand, which is its one way off the board. Deliberately NOT lockSleightForRound:
// its 0-charge message says "locked until discarded or played", which is a lie here.
const INERT_ON_USE_SLEIGHTS = new Set(['piggy_bank', 'capacitor']);
function sleightUseInPlace(card, r, c) {
  if (!card) return;
  card._usedThisRound = true;
  if (card._usesLeft !== 'infinite') card._usesLeft = Math.max(0, card._usesLeft - 1);
  card._inert = true;
  spinSleightTile(r, c);
  if (!animating && !falling) render();
}

// Active-tap sleights (Amplifier/Snooze/Magnet/Siphon) LEAVE the grid
// the moment they fire - replacing the old once-per-round lock. Like a normal discard the
// card cycles back into the deck with its remaining charges (discardToPlayed drops it once
// fully spent), and removeAndFall animates it out AND refills the hole (nulling the cell by
// hand would leave a permanent gap). Fire-and-forget, mirroring doDiscard.
function discardSleightAfterUse(card, r, c) {
  if (!card) return;
  // Spin first, then leave. The spin IS the "it fired" feedback for every
  // double-tap sleight (r179), so it lives here rather than at the six call
  // sites; removeAndFall's fly-out would paint over it if they overlapped.
  spinSleightTile(r, c, () => {
    if (typeof card._usesLeft === 'number') card._usesLeft--;
    discardToPlayed(card);                 // back into circulation with charges left (or dropped if spent)
    removeAndFall([[r, c]], 'discard');    // slide it out + gravity-refill the cell
  });
}

// ── Double-tap spin (r179) ────────────────────────────────────────────────
// A double-tap sleight used to fire with no feedback on the tile itself: the
// only sign was the message line. It now spins horizontally in place. The
// class is re-applied by render() (which rewrites className every repaint), so
// a repaint mid-spin can't cut the animation short.
const SLEIGHT_SPIN_MS = 420;
let sleightSpinLock = false;   // taps are ignored while a tile is spinning
function spinSleightTile(r, c, done) {
  const el = document.querySelector(`#grid .sleight-card[data-row="${r}"][data-col="${c}"]`);
  if (!el) { if (done) done(); return; }
  sleightSpinLock = true;
  el.classList.add('sl-spin');
  setTimeout(() => {
    sleightSpinLock = false;
    el.classList.remove('sl-spin');
    if (done) done();
  }, SLEIGHT_SPIN_MS);
}

// A sleight that can no longer be activated but is still sitting on the grid.
// Only the ACTIVE kinds can go inert this way: double_tap (Stopwatch, once its
// freeze budget is gone) and on_swap (Dazed / Pivot, which lock for the round
// rather than leaving). Passive / wildcard / on_play / adjacent sleights work
// by being there, so they are never "spent".
function sleightIsSpent(card, def) {
  if (!card || !def) return false;
  if (def.activation !== 'double_tap' && def.activation !== 'on_swap') return false;
  if (typeof card._usesLeft === 'number' && card._usesLeft <= 0) return true;
  return def.activation === 'on_swap' && !!card._usedThisRound;
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

// ── Orthogonal neighbors (adjacency for Whetstone / Jury-Rig) ──
function getNeighborsOrtho(r, c) {
  const out = [];
  [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([nr, nc]) => {
    if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) out.push([nr, nc]);
  });
  return out;
}
const _isOrthoAdj = (r1, c1, r2, c2) => Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;

// ── Pivot (r205) ─────────────────────────────────────────────────────────────
// Pivot works by SITTING on the grid, not by being swapped. Any card touching it
// swaps for free; swap two of its neighbours TOGETHER and both take a permanent
// mult buff and the Pivot leaves the board (see doSwap in js/input.js).
//
// Adjacency here is 8-WAY, and that is load-bearing rather than a flourish. A
// swap moves two ORTHOGONALLY adjacent cells, and two orthogonally adjacent cells
// have no common orthogonal neighbour at all - they sit on opposite colours of the
// board's checkerboard, and every orthogonal neighbour of a cell is the other
// colour. So under orthogonal-only adjacency "one Pivot touching both ends of the
// swap" could never fire once, and the payout would be dead on arrival.
const _isTouching = (r1, c1, r2, c2) =>
  !(r1 === r2 && c1 === c2) && Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;

// The first Wanderer on the grid with charges left, as [card, r, c] (r354).
function liveWanderer() {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd?._isSleight || cd.sleightId !== 'the_wanderer') continue;
    if (typeof isCellBlocked === 'function' && isCellBlocked(r, c)) continue;
    if (cd._usesLeft === 'infinite' || cd._usesLeft > 0) return [cd, r, c];
  }
  return null;
}

// Every Pivot with charges left that touches (r,c).
function livePivotsTouching(r, c) {
  const out = [];
  for (let pr = 0; pr < gridRows; pr++) for (let pc = 0; pc < gridCols; pc++) {
    const card = gridData[pr]?.[pc];
    if (!card?._isSleight || card.sleightId !== 'pivot') continue;
    if (card._usesLeft !== 'infinite' && !(card._usesLeft > 0)) continue;
    if (_isTouching(pr, pc, r, c)) out.push([pr, pc]);
  }
  return out;
}
// Does either end of this swap touch a live Pivot? (That is what makes it free.)
function swapTouchesLivePivot(r1, c1, r2, c2) {
  return livePivotsTouching(r1, c1).length > 0 || livePivotsTouching(r2, c2).length > 0;
}
// The one Pivot touching BOTH ends - the one that pays the buff and then leaves.
// Null when the swap only brushed past a Pivot: no bonus, and no discard either.
function pivotForSwap(r1, c1, r2, c2) {
  return livePivotsTouching(r1, c1).find(([pr, pc]) => _isTouching(pr, pc, r2, c2)) || null;
}

// ── Whetstone: sharpens on nearby churn ──────────────────────────────────────
// Every adjacent card swapped or discarded adds +1 mult, banked on the card itself
// (_whetMult) so it survives deck cycling. `cells` = the cells just swapped/discarded.
function feedWhetstones(cells) {
  let fed = 0;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r]?.[c];
    if (!card?._isSleight || card.sleightId !== 'whetstone') continue;
    // The Whetstone's own cell never counts - only cards moved/removed beside it.
    const gain = cells.filter(([cr, cc]) => !(cr === r && cc === c) && _isOrthoAdj(cr, cc, r, c)).length;
    if (gain) { card._whetMult = (card._whetMult || 0) + gain * BAL.whetstone.mult_per_event; fed += gain; }
  }
  if (fed) showMessage(`🔪 Whetstone +${fed} mult`, '#ffd700');
}
// Mult a scored hand collects: each Whetstone next to at least one scored card gives
// everything it has sharpened. Several Whetstones stack.
function whetstoneMultForCells(cells) {
  let total = 0;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r]?.[c];
    if (!card?._isSleight || card.sleightId !== 'whetstone' || !card._whetMult) continue;
    if (cells.some(([cr, cc]) => _isOrthoAdj(cr, cc, r, c))) total += card._whetMult;
  }
  return total;
}

// ── Entourage: +mult per OTHER Sleight on the grid (each Entourage counts the rest) ──
function entourageMult() {
  let sleightCount = 0, entourages = 0;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r]?.[c];
    if (!card?._isSleight) continue;
    sleightCount++;
    if (card.sleightId === 'entourage') entourages++;
  }
  return entourages ? entourages * Math.max(0, sleightCount - 1) * BAL.entourage.mult_per_sleight : 0;
}

// ── Lighthouse: full mult in the round's favored column, decaying by distance, floored at 0 ──
function lighthouseMult() {
  let total = 0;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const card = gridData[r]?.[c];
    if (!card?._isSleight || card.sleightId !== 'lighthouse') continue;
    const dist = Math.abs(c - lighthouseColumn);
    total += Math.max(0, BAL.lighthouse.mult - dist * BAL.lighthouse.falloff_per_column);
  }
  return total;
}

// ── Jury-Rig knack: swapping/discarding beside a Sleight may restore one of its charges ──
// Restore 1 charge, never above the Sleight's printed durability ('infinite' is a no-op).
// A Sleight's charge ceiling: the printed durability plus anything the Workshop
// event has added (r194). Every "restore up to the cap" site reads this rather
// than def.durability, or a reinforced Sleight would refill only to its printed
// value and the upgrade would silently do nothing.
let sleightCapBonus = {};   // sleightId -> extra charges above the printed durability
function sleightMaxCharges(def) {
  if (!def || def.durability === 'infinite') return null;
  if (typeof def.durability !== 'number') return null;
  return def.durability + (sleightCapBonus[def.id] || 0);
}
// Every Sleight the run currently holds, wherever it is - board, draw or played.
function allOwnedSleightCards() {
  const out = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (cd && cd._isSleight) out.push(cd);
  }
  (typeof drawPile   !== 'undefined' ? drawPile   : []).forEach(cd => { if (cd && cd._isSleight) out.push(cd); });
  (typeof playedPile !== 'undefined' ? playedPile : []).forEach(cd => { if (cd && cd._isSleight) out.push(cd); });
  return out;
}

function restoreSleightCharge(card) {
  if (!card || card._usesLeft === 'infinite') return false;
  const def = sleightDef(card);
  const cap = sleightMaxCharges(def);
  if (cap === null || (card._usesLeft || 0) >= cap) return false;
  card._usesLeft = Math.min(cap, (card._usesLeft || 0) + BAL.jury_rig.charges);
  return true;
}
// One roll per adjacent Sleight (deduped by _id so a Sleight beside both swapped cells
// still only rolls once for that action).
function juryRigRoll(cells) {
  if (!hasKnack('jury_rig')) return;
  const seen = new Set(), targets = [];
  cells.forEach(([cr, cc]) => getNeighborsOrtho(cr, cc).forEach(([nr, nc]) => {
    const card = gridData[nr]?.[nc];
    if (!card?._isSleight || seen.has(card._id)) return;
    seen.add(card._id); targets.push(card);
  }));
  targets.forEach(card => {
    // COUNTABLE: past 100% it restores several charges at once. restoreSleightCharge
    // never exceeds the printed durability, so the cap is already enforced there.
    const _jrN = luckRoll(BAL.jury_rig.chance);
    if (_jrN <= 0) return;
    let _got = 0;
    for (let i = 0; i < _jrN * BAL.jury_rig.charges; i++) if (restoreSleightCharge(card)) _got++;
    if (_got) showMessage(`🔧 Jury-Rig - ${sleightDef(card)?.name || 'Sleight'} +${_got} charge${_got > 1 ? 's' : ''}`, '#6aaa6a');
  });
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
    // size - but non-wild sleights are dropped from hand detection, so add 1 if it's not in handCells.
    if (def.id === 'rewind') {
      const _inHand = handCells.some(([hr, hc]) => hr === r && hc === c);
      const _size = _inHand ? handCells.length : handCells.length + 1;
      rewindTime(_size, null, 'rewind', 'sleight');
      consumeSleightCharge(card, r, c);
      return;
    }
    // Syncopation: hand type differs from the previous hand played
    if (def.id === 'syncopation') {
      if (lastHandType === null || hand === lastHandType) return;
      pauseRound(BAL.syncopation.seconds, 'syncopation', 'sleight');
      consumeSleightCharge(card, r, c);
      return;
    }
    // Shady Tree: only fires when played from the round's "shady" column; pause = remaining charges
    // (10 → 1), which drop by 1 each use; the sleight is destroyed when it hits 0 (consumeSleightCharge).
    if (def.id === 'shady_tree') {
      if (c !== shadyColumn) return;
      pauseRound(card._usesLeft != null ? card._usesLeft : def.durability, 'shady_tree', 'sleight');
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
          const k = cardId(hc2);
          permPips[k] = (permPips[k] || 0) + BAL.the_naturalist.pips;
          buffed++;
        }
      });
      if (buffed > 0) showMessage(`🌿 Naturalist - ${buffed} card${buffed>1?'s':''} +2 pips!`, '#6aaa6a');
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
        const k = cardId(other);
        permPips[k] = (permPips[k] || 0) + BAL.lightning_rod.pips;
        showMessage('⚡ Lightning Rod - +5 pips!', '#ffd700');
        render();
      }
    } else if (def.id === 'the_catalyst') {
      const other = gridData[or2]?.[oc2];
      if (other && !other._isSleight && !other._isTrick && other.rank) {
        const k = cardId(other);
        permMult[k] = (permMult[k] || 0) + BAL.the_catalyst.mult;
        showMessage('🧪 Catalyst - +1 perm mult!', '#cc88ff');
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
// Magnet (r357): every card of `rank` elsewhere on the board is pulled in to
// replace the Magnet itself and then its orthogonal neighbours, and whatever it
// replaces is DISCARDED - the Magnet with its charge spent, the neighbours to
// the back of the draw pile. The discards cost no time and no stock, but each
// displaced card counts as a discard for everything that scales on discards.
// Returns how many cards it pulled (0 = nothing to pull; the caller discards
// the Magnet the ordinary way then).
function magnetCluster(mr, mc, rank) {
  const ordinary = cd => cd && cd.rank && !cd._isSleight && !cd._isStone && !cd._isTrick;
  const magnet = gridData[mr]?.[mc];
  const targets = [[mr, mc]];
  getNeighborsOrtho(mr, mc).forEach(([r, c]) => {
    const cd = gridData[r]?.[c];
    if (ordinary(cd) && cd.rank !== rank && cardCan(cd, 'discard') && !isCellBlocked(r, c)) targets.push([r, c]);
  });
  const isT = (r, c) => targets.some(([a, b]) => a === r && b === c);
  const sources = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!isT(r, c) && !(r === mr && c === mc) && ordinary(cd) && cd.rank === rank && cardCan(cd, 'swap') && !isCellBlocked(r, c)) sources.push([r, c]);
  }
  const n = Math.min(targets.length, sources.length);
  if (!n) return 0;
  const gridEl = document.getElementById('grid');
  const rectOf = cd => { const el = cd && gridEl?.querySelector(`[data-card-id="${cd._id}"]`); return el ? el.getBoundingClientRect() : null; };
  const pulled = [], displaced = [], ghosts = [], moves = [];
  for (let i = 0; i < n; i++) {
    const [tr, tc] = targets[i], [sr, sc] = sources[i];
    const out = gridData[tr][tc], inn = gridData[sr][sc];
    // Ghost the leaving card where it stands, so the discard is SEEN from its
    // own cell rather than from wherever the data shuffle parks it.
    const el = gridEl?.querySelector(`[data-card-id="${out._id}"]`);
    if (el) { const g = el.cloneNode(true), rc = el.getBoundingClientRect();
      Object.assign(g.style, { position: 'fixed', left: rc.left + 'px', top: rc.top + 'px', width: rc.width + 'px', height: rc.height + 'px', margin: 0, zIndex: 50, pointerEvents: 'none', transform: 'none' });
      document.body.appendChild(g); ghosts.push(g); }
    moves.push({ id: inn._id, from: rectOf(inn) });
    gridData[tr][tc] = inn; gridData[sr][sc] = out;
    pulled.push([tr, tc]); displaced.push([sr, sc]);
  }
  // Piles: the Magnet cycles with a charge spent, the neighbours go to the back
  // of the draw pile - exactly where a discard sends them.
  displaced.forEach(([r, c]) => {
    const cd = gridData[r][c];
    if (cd === magnet) { if (typeof cd._usesLeft === 'number') cd._usesLeft--; discardToPlayed(cd); }
    else discardToDrawPile(cd);
  });
  magnetCountDiscards(displaced.map(([r, c]) => gridData[r][c]).filter(cd => cd !== magnet));
  render();
  // The pulled cards FLY in from where they were; the displaced ones are hidden
  // at their parking cells (the ghosts are what the player watches leave).
  moves.forEach(m => {
    const el = gridEl?.querySelector(`[data-card-id="${m.id}"]`);
    if (!el || !m.from) return;
    const to = el.getBoundingClientRect(), z = (to.width / (el.offsetWidth || to.width)) || 1;
    const dx = (m.from.left - to.left) / z, dy = (m.from.top - to.top) / z;
    el.animate([{ transform: `translate(${dx}px,${dy}px) scale(1.12)`, zIndex: 20 }, { transform: 'translate(0,0) scale(1)', zIndex: 20 }],
      { duration: 460, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' });
  });
  displaced.forEach(([r, c]) => { const el = gridEl?.querySelector(`[data-card-id="${gridData[r][c]?._id}"]`); if (el) el.style.visibility = 'hidden'; });
  const btn = document.getElementById('btn-discard')?.getBoundingClientRect();
  ghosts.forEach((g, i) => {
    const rc = g.getBoundingClientRect();
    const dx = btn ? (btn.left + btn.width / 2) - (rc.left + rc.width / 2) : 0;
    const dy = btn ? (btn.top + btn.height / 2) - (rc.top + rc.height / 2) : 120;
    g.animate([{ transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
               { transform: `translate(${dx}px,${dy}px) scale(.45) rotate(${i % 2 ? 18 : -18}deg)`, opacity: 0 }],
      { duration: 520, delay: 60 * i, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });
    setTimeout(() => g.remove(), 620 + 60 * i);
  });
  if (typeof sfxCardDiscard === 'function') { try { sfxCardDiscard(); } catch (e) {} }
  // The parking cells empty and refill by gravity once the flights have landed.
  setTimeout(() => {
    displaced.forEach(([r, c]) => { gridData[r][c] = null; });
    removeAndFall(displaced, 'discard');
  }, 520);
  return n;
}
// Magnet's displaced cards count as discards for everything that scales on
// them (owner's spec) - one discard each, at no time or stock.
function magnetCountDiscards(cards) {
  const count = cards.length;
  if (!count) return;
  cardsDiscardedTotal += count;
  cardsDiscardedRound += count;
  discardsUsedRound += count;
  if (hasTrick('fives_discard')) bonusMult_fives += cards.filter(c => c.rank === '5').length * BAL.fives_discard.pips_per_five;
  if (hasTrick('tens_mult')) {
    const prev = Math.floor((cardsDiscardedTotal - count) / BAL.tens_mult.discards_per_milestone);
    const now  = Math.floor(cardsDiscardedTotal / BAL.tens_mult.discards_per_milestone);
    bonusMult_tens += (now - prev) * BAL.tens_mult.mult_per_milestone;
  }
}

function applySleightGridEffect(id, r, c) {
  // Suspension (reward-grid penalty) switches one owned entity off for the first
  // half of a round. Checked here rather than at each activation site because
  // every activation-driven sleight passes through this one function.
  if (typeof entitySuspended === 'function' && entitySuspended('sleight', id)) {
    showMessage(`${id} is suspended this round`, 'var(--red)');
    return;
  }
  // A STOCK payout throws the scoring dance's own plate at the readout it
  // changed (entityEffectFX, js/payout-fx.js) instead of printing a toast
  // (owner call, r326): the particle plus the currency's own sound IS the
  // report. The sleight's grid element is passed outright - this runs before
  // discardSleightAfterUse, so the card is still on the board - and the
  // entityEffectFX id lookup would find it anyway, but there is nothing to
  // search for when the caller holds the cell. Effects with no HUD readout
  // (next-hand mult, card buffs, reshuffles) keep their toasts.
  const _slEl = document.querySelector(`#grid [data-card-id="${gridData[r]?.[c]?._id}"]`);
  const _fx = (kind, amount) => {
    if (typeof entityEffectFX === 'function')
      entityEffectFX(kind, amount, { srcEl: _slEl, id, source: 'sleight' });
  };
  switch (id) {
    case 'power_cell':
      // addFocus with a named source fires the Focus particle itself.
      addFocus(BAL.power_cell.focus_on_enter, 'power_cell', 'sleight');
      break;
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
      if (challengeActive) { resolveChallenge(true); showMessage('Shortcut - challenge complete!', 'var(--gold)'); }
      else showMessage('Shortcut - no active challenge', 'var(--cream-dim)');
      break;
    case 'dazed':
      // Fresh Start (r353): the redeal waits for the discard's own fall to land
      // (drained from the tail of removeAndFall), or the discard would remove
      // cells out of the freshly dealt board.
      coins = Math.max(0, coins - BAL.dazed.cost_coins); updateCoinsUI();
      roundSeconds = Math.max(1, roundSeconds - BAL.dazed.cost_seconds); updateClockUI();
      freshStartPending = true; break;
    case 'pivot':
      // Unreachable since r205: Pivot is `passive` now (it works by sitting on the
      // grid), so fireSleightsOnSwap never dispatches it. The whole effect - the
      // free swap, the buff and the discard - is inline in doSwap.
      break;
    case 'idol':
      // handled in interest calc (round_end); no immediate effect
      break;
    case 'echo_play':
      sleightNextHandDouble = true;
      showMessage('🔁 Echo - next hand scores twice!', '#ffd700'); break;
    case 'the_queen':
      pauseRound(BAL.the_queen.pause_seconds, 'the_queen', 'sleight'); break;
    case 'bellhop':
      swaps += BAL.bellhop.swaps; discards = Math.min(99, discards + BAL.bellhop.discards); render();
      _fx('swaps', BAL.bellhop.swaps); _fx('discards', BAL.bellhop.discards); break;
    case 'the_bomb': {
      let _cnt = 0;
      for (let _r = 0; _r < gridRows; _r++)
        for (let _c = 0; _c < gridCols; _c++) {
          const _card = gridData[_r]?.[_c];
          if (_card && !_card._isSleight && !_card._isTrick && !_card._isStone && _card.rank) {
            const _k = cardId(_card);
            permPips[_k] = (_k in permPips ? permPips[_k] : 0) + BAL.the_bomb.pips;
            _cnt++;
          }
        }
      showMessage(`💣 Bomb - ${_cnt} cards +3 pips!`, '#ffd700'); render(); break;
    }
    case 'the_legacy':
      sleightLegacyMult = true;
      showMessage('📜 Legacy - next hand ×3!', '#ffd700'); break;
    case 'cash_out':
      grantEntityCoins(BAL.cash_out.coins, 'sleight', 'cash_out');
      _fx('credits', BAL.cash_out.coins); break;
    case 'amplifier':
      sleightAmplifierMult += BAL.amplifier.mult;
      showMessage('📢 Amplifier - next hand +5 mult!', 'var(--gold)'); break;
    case 'snooze':
      // pauseRound with a named source throws the pause plate at the clock.
      pauseRound(BAL.snooze.seconds, 'snooze', 'sleight'); break;
    case 'last_call':
      rewindTime(BAL.last_call.seconds, null, 'last_call', 'sleight');
      break;
    case 'sandbag': {
      // Discarded with a pair (r353, any rank): rewind the pair's rank in seconds,
      // +50% for each further card of that rank. The best set wins.
      const _co = _discardContextCards || [];
      const _counts = {};
      _co.forEach(c => { const _v = RANK_ORDER[c.rank]; if (_v) _counts[_v] = (_counts[_v] || 0) + 1; });
      let _sec = 0;
      Object.keys(_counts).forEach(v => { const n = _counts[v]; if (n >= 2) _sec = Math.max(_sec, Math.round(Number(v) * (1 + BAL.sandbag.extra_per_member * (n - 2)))); });
      if (_sec) rewindTime(_sec, null, 'sandbag', 'sleight');
      else showMessage('⏬ Sandbagger - needs a pair', 'var(--cream-dim)');
      break;
    }
    case 'piggy_bank':
      grantEntityCoins(BAL.piggy_bank.coins, 'sleight', 'piggy_bank');
      _fx('credits', BAL.piggy_bank.coins); break;
    default:
      showMessage(`${SLEIGHT_POOL.find(j=>j.id===id)?.name||'Sleight'} activated!`, '#cc88ff'); break;
  }
}

// Fresh Start (r353): every ordinary card on the board goes back into the draw
// pile, the pile is shuffled and the holes are dealt. Sleights, stones and other
// fixtures stay where they are. Run from the tail of removeAndFall.
let freshStartPending = false;
function freshStartDrain() {
  if (!freshStartPending || animating || falling) return;
  freshStartPending = false;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd.rank || cd._isSleight || cd._isStone || cd._isTrick) continue;
    if (typeof isCellBlocked === 'function' && isCellBlocked(r, c)) continue;
    discardToDrawPile(cd);
    gridData[r][c] = null;
  }
  drawPile = deckShuffle(drawPile);
  fillGridHoles();
  selected = [];
  showMessage('😵 Fresh Start - the board is redealt', '#cc88ff');
  render();
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
  // Charged sleights read n/max (owner's spec, r341); max comes through
  // sleightMaxCharges so a Maintenance-reinforced ceiling is the one printed.
  const _mxCh = sleightMaxCharges(def);
  let uses = card._usesLeft === 'infinite' ? '∞ uses'
           : (_mxCh ? `${card._usesLeft}/${_mxCh} charges` : `${card._usesLeft} use${card._usesLeft !== 1 ? 's' : ''} left`);
  // Whetstone banks mult on the card itself - surface it, it's the whole point of the Sleight.
  if (def.id === 'whetstone') uses = `+${card._whetMult || 0} mult sharpened`;
  // Lighthouse's value depends on where it is right now - show the live number.
  if (def.id === 'lighthouse') {
    const _v = Math.max(0, BAL.lighthouse.mult - Math.abs(c - lighthouseColumn) * BAL.lighthouse.falloff_per_column);
    uses = `+${_v} mult here · favors column ${lighthouseColumn + 1}`;
  }
  if (def.id === 'entourage') uses = `+${entourageMult()} mult right now`;
  // Focus-spend sleights: show what they'll cost against what you have right now.
  if (def.id === 'slow_burn') uses = `+${Math.min(BAL.slow_burn.cap, Math.floor((card._slowBurnSecs || 0) / BAL.slow_burn.seconds_per))} of ${BAL.slow_burn.cap} Focus limit`;
  if (def.id === 'capacitor') uses = `needs ${BAL.capacitor.focus_cost} Focus · you have ${focusNodes}`;
  if (def.id === 'siphon')    uses = `needs ${BAL.siphon.focus_cost} Focus · you have ${focusNodes}`;
  if (def.secsPerCharge && typeof card._usesLeft === 'number') uses = `Remaining time: ${sleightSecsLeft(card)}s · ${card._usesLeft}/${_mxCh} charges`;
  const tip = document.createElement('div');
  tip.id = 'sleight-grid-tooltip';
  tip.className = 'sleight-tooltip';
  if (card._inert) uses += ' · INERT (cannot be swapped or discarded)';
  const _usedLock = card._usedThisRound ? ' · USED THIS ROUND' : '';
  const _hint = def.id === 'stopwatch' ? 'DOUBLE-TAP TO FREEZE THE CLOCK'
              : def.activation === 'double_tap' ? (INERT_ON_USE_SLEIGHTS.has(def.id)
                  ? `DOUBLE-TAP TO ACTIVATE · ONCE PER ROUND · INERT AFTER USE${_usedLock}`
                  : 'DOUBLE-TAP TO ACTIVATE · DISCARDED AFTER USE')
              : def.activation === 'on_play' ? 'SELECT &amp; PLAY TO ACTIVATE'
              : def.activation === 'on_discard' ? 'SELECT &amp; DISCARD TO ACTIVATE'
              : def.activation === 'on_swap' ? `SWAP TO ACTIVATE · ONCE PER ROUND${_usedLock}`
              : def.activation === 'passive' ? 'ALWAYS ACTIVE WHILE ON THE GRID'
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
  // A timed Sleight's remaining time runs while you read it (r356), so the
  // line is rewritten each second for as long as the bubble is up.
  if (def.secsPerCharge && typeof card._usesLeft === 'number') {
    const _live = setInterval(() => {
      const el = document.getElementById('sleight-grid-tooltip');
      if (el !== tip) { clearInterval(_live); return; }
      const u = tip.querySelector('.sleight-tooltip-uses');
      if (u) u.textContent = `Remaining time: ${sleightSecsLeft(card)}s · ${card._usesLeft}/${_mxCh} charges`;
    }, 1000);
  }
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
  // Normal card - show enhancement tooltip only if something to show
  const k  = cardId(card);
  const pp = permPips[k]   || 0;
  const pm = permMult[k]   || 0;
  const xp = permXPips[k]  || 1;
  const xm = permXMult[k]  || 1;
  const re = permRetrig[k] || 0;
  const gp = permPipsGrow[k] || 0, gm = permMultGrow[k] || 0;
  if (!pp && !pm && !gp && !gm && xp <= 1 && xm <= 1 && !re && !card._exalted && !card._corrupted) return;
  const gridEl  = document.getElementById('grid');
  const cardEl  = gridEl?.querySelector(`[data-card-id="${card._id}"]`);
  if (!cardEl) return;
  // One shared wording for every card buff, flat and scaling alike
  // (cardBuffLines in js/deck-grid.js) - so the tooltip cannot say something
  // different from the tile that granted it.
  const lines = cardBuffLines(k);
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
  // Desktop hover in/out shows & hides the tooltip (only when no button is held -
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


// ══════════════════════════════════════════════
// THE RINGER (r197) - a spare card slipped into the hand
// ══════════════════════════════════════════════
// While it sits on the grid, submitting a hand can pull in ONE more card off the
// board, if doing so makes a better hand: a third 10 becomes a fourth, a J-Q-K
// becomes a 10-J-Q-K. Four deliberate decisions:
//
// 1. IT IGNORES SELECTION SIZE. The extra card is added AFTER the hand is found,
//    so a selection limit of 3 can still submit a four-card set. That is the
//    whole point of the Sleight, and it is why the augmentation lives here and
//    not in findBestHand, which is also what the live preview and the auto-submit
//    read - hooking it there would promise a card the player has not committed to.
// 2. IT IGNORES ADJACENCY. findBestHand only ever builds orthogonally connected
//    subsets, and the card that completes a run is usually nowhere near it.
//    detectHand does NOT check connectivity (it only reads the cards), so the
//    augmented hand is assembled here and handed to detectHand directly.
// 3. IT FIRES AT SUBMIT. The added cell joins `selected` and `handCells` before
//    the scoring dance runs, so the dance's existing fly-into-the-preview
//    animation carries it with no new animation code.
// 4. IT SEARCHES EVERY RANK ON THE BOARD, and this is the one place the first
//    draft was wrong. Naming a fixed rank up front - the board's highest, say -
//    reads well and barely ever fires: nothing ranks above the highest card, so
//    it can never extend a run, and it only ever helps the one set that happens
//    to share it. Verified on a board of 8-9-10 with a spare 10: a highest-rank
//    Ringer found no improvement at all. Taking the best card on the board
//    instead is what makes the Sleight do the thing its own description promises.

const RINGER_ID = 'the_ringer';

// The live Ringer on the grid with charges left, as [card, r, c].
function ringerOnGrid() {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (cd && cd._isSleight && cd.sleightId === RINGER_ID
        && (cd._usesLeft === 'infinite' || cd._usesLeft > 0)
        && (typeof cellCountsForTriggers !== 'function' || cellCountsForTriggers(r, c))) {
      return [cd, r, c];
    }
  }
  return null;
}

// How good a hand type is, under whichever scoring model is live. The same
// max(pips,1) shape detectHand's own tiebreak uses, so the comparison still holds
// in the two models that zero base pips (see "Scoring models" in CLAUDE.md).
function _ringerWorth(h) {
  if (!h) return -1;
  return Math.max(handBasePips(h), 1) * handBaseMult(h);
}

// Try to improve `result` by adding one card off the board. Returns the improved
// result (and spends a charge) or null. Never touches the board - the caller owns
// `selected`.
function ringerAugment(result, selCells) {
  const live = ringerOnGrid();
  if (!live || !result || !result.handCells) return null;

  const taken = new Set(result.handCells.map(([r, c]) => r + '-' + c));
  (selCells || []).forEach(([r, c]) => taken.add(r + '-' + c));

  let bestCell = null, bestHand = null, bestWorth = _ringerWorth(result.hand);
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    if (taken.has(r + '-' + c)) continue;
    const cd = gridData[r]?.[c];
    if (!cd || !cd.rank || cd._isSleight || cd._isTrick || cd._isStone) continue;
    if (isCellBlocked(r, c) || !cardCan(cd, 'select')) continue;
    const h = detectHand([...result.handCells, [r, c]]);
    const w = _ringerWorth(h);
    if (h && w > bestWorth) { bestWorth = w; bestHand = h; bestCell = [r, c]; }
  }
  if (!bestCell) return null;   // nothing improves the hand - no charge is spent

  const [card, sr, sc] = live;
  consumeSleightCharge(card, sr, sc);
  const added = gridData[bestCell[0]][bestCell[1]];
  showMessage(`The Ringer - ${added.rank}${added.suit || ''} joins the hand`, '#cc88ff');
  return { hand: bestHand, cell: bestCell,
           result: { ...result, hand: bestHand, handCells: [...result.handCells, bestCell] } };
}
