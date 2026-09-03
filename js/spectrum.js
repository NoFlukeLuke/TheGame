// ══════════════════════════════════════════════
// SPECTRUM MODE - deck tuning + the four deck fixtures (r161)
// ══════════════════════════════════════════════
// Two things live here, both Spectrum-only:
//   1. The rank/colour TUNER (dev panel → Spectrum). Which values and which
//      colours are in the deck, toggled live and applied at the START OF THE
//      NEXT ROUND - never mid-round, so the board under the player's hand can't
//      change while they're looking at it.
//   2. The four DECK FIXTURES (Shift Swap · Recycler · Time Clock · Petty Cash):
//      extra cards shuffled into the deck at run start that pay out after two
//      hands have scored beside them. They are Sleights (activation:'adjacent')
//      so the grid, fall animation, tooltips, swap/discard and saves handle them
//      for free - see SLEIGHT_FIXTURES in js/data/sleights.js.

// ── Tuner state ──────────────────────────────────────────────────────────────
// Persisted so a tuning session survives a reload. Stored as arrays; an entry
// missing from storage means "everything on".
const SPECTRUM_TUNE_KEY = 'lethe.spectrum.tune.v1';
let spectrumRanksOn  = new Set(RANKS_NUMERIC);
let spectrumColorsOn = new Set(COLORS);
// Set by a toggle, consumed at the next round start. The current round always
// finishes on the deck it started with.
let spectrumDeckDirty = false;

(function loadSpectrumTune() {
  try {
    const raw = localStorage.getItem(SPECTRUM_TUNE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (Array.isArray(o.ranks)  && o.ranks.length)  spectrumRanksOn  = new Set(o.ranks.filter(r => RANKS_NUMERIC.includes(r)));
    if (Array.isArray(o.colors) && o.colors.length) spectrumColorsOn = new Set(o.colors.filter(c => COLORS.includes(c)));
  } catch (e) {}
})();
function saveSpectrumTune() {
  try {
    localStorage.setItem(SPECTRUM_TUNE_KEY, JSON.stringify({ ranks:[...spectrumRanksOn], colors:[...spectrumColorsOn] }));
  } catch (e) {}
}

// The lists a Spectrum run actually deals from - always in RANKS_NUMERIC / COLORS
// order (a Set preserves insertion order, which toggling would scramble).
function spectrumRanks()  { const a = RANKS_NUMERIC.filter(r => spectrumRanksOn.has(r));  return a.length ? a : [...RANKS_NUMERIC]; }
function spectrumColors() { const a = COLORS.filter(c => spectrumColorsOn.has(c));        return a.length ? a : [...COLORS]; }
function spectrumDeckSize() { return spectrumRanks().length * spectrumColors().length; }
// A deck has to out-size the board with room to draw into, or refills hand back
// nulls and the grid fills with holes. This is the floor the tuner enforces.
function spectrumMinDeck() { return (gridRows || 4) * (gridCols || 4) + 8; }

// ── Applying a tuning change ─────────────────────────────────────────────────
// Called from startGame (a new run picks up the current tuning immediately) and
// from the round-start hook below (a change made mid-round lands at the boundary).
function spectrumInstallLists() {
  ACTIVE_SUITS = spectrumColors();
  ACTIVE_RANKS = spectrumRanks();
  expectedDeckTotal = ACTIVE_SUITS.length * ACTIVE_RANKS.length;
  spectrumDeckDirty = false;
}

// Round-start hook: rebuild the deck and re-deal the board on the new lists.
// Sleights (the four fixtures included) are carried over - they aren't part of
// the rank × colour cross-product, so a rebuild would otherwise delete them.
function spectrumApplyPendingDeck() {
  if (!isNumericMode() || !spectrumDeckDirty) return;
  const carried = [];
  [...drawPile, ...playedPile].forEach(c => { if (c?._isSleight) carried.push(c); });
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++)
      if (gridData[r]?.[c]?._isSleight) carried.push(gridData[r][c]);

  spectrumInstallLists();
  initGridData();                       // fresh board + fresh draw pile off the new lists
  carried.forEach(c => { c._drawFired = false; drawPile.push(c); });
  drawPile = deckShuffle(drawPile);
  updateDeckHud();
  render();
  showMessage(`Deck rebuilt - ${ACTIVE_RANKS.length} values × ${ACTIVE_SUITS.length} colours = ${expectedDeckTotal}`, 'var(--gold)');
}

// ── The four deck fixtures ───────────────────────────────────────────────────
// Shuffled into the draw pile once, at run start, after initGridData has built
// the deck (it assigns drawPile wholesale, so anything added before is lost).
function spectrumGrantDeckCards() {
  if (!isNumericMode()) return;
  [...SLEIGHT_FIXTURES].forEach(id => {
    const def = SLEIGHT_POOL.find(j => j.id === id);
    if (!def) return;
    drawPile.push({
      _isSleight: true, sleightId: def.id,
      rank: null, suit: null,
      _id: 90000 + drawPile.length,
      _usesLeft: def.durability,
      _adjPlays: 0,
    });
    grantedSleightIds.add(def.id);
  });
  drawPile = deckShuffle(drawPile);
  updateDeckHud();
}

// Count a scored hand against every 'adjacent' fixture it touched, and pay out
// the ones that just hit their threshold. Called from playHand once per hand -
// a fixture touched by three of the hand's cards still only counts ONE hand.
function fireAdjacentSleights(handCells) {
  if (!handCells || !handCells.length) return;
  const scored = new Set(handCells.map(([r, c]) => `${r}-${c}`));
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const card = gridData[r]?.[c];
      if (!card?._isSleight) continue;
      const def = sleightDef(card);
      if (!def || def.activation !== 'adjacent') continue;
      if (card._usesLeft !== 'infinite' && card._usesLeft <= 0) continue;   // spent fixture sits inert
      // The fixture itself can be part of the played hand - that doesn't count as
      // "beside it", so only its NEIGHBOURS are checked.
      const touched = getNeighbors(r, c).some(([nr, nc]) => scored.has(`${nr}-${nc}`));
      if (!touched) continue;
      card._adjPlays = (card._adjPlays || 0) + 1;
      if (card._adjPlays < (def.adjacentPlays || 2)) continue;
      card._adjPlays = 0;
      paySpectrumFixture(def, card, r, c);
    }
  }
}

function paySpectrumFixture(def, card, r, c) {
  const p = def.payout || {};
  const bits = [];
  if (p.swaps)    { swaps    += p.swaps;                       bits.push(`+${p.swaps} swaps`); }
  if (p.discards) { discards  = Math.min(99, discards + p.discards); bits.push(`+${p.discards} discards`); }
  // The Time Clock fixture is a rewind like any other (r183) - same conversion as
  // Deluge / Threepeat / Blood Diamonds, so it caps, floats, and counts for The
  // Kingfisher. `gained` and not `p.seconds` in the message, because a rewind up
  // against the round cap can hand back less than it offered.
  if (p.seconds)  { const g = rewindTime(p.seconds); if (g > 0) bits.push(`+${g}s`); }
  if (p.coins)    { coins    += p.coins; updateCoinsUI();      bits.push(`+${p.coins} credits`); }
  showMessage(`${def.emoji} ${def.name} - ${bits.join(', ')}!`, '#ffd700');
  consumeSleightCharge(card, r, c);   // no-op while durability is 'infinite'
  render();
}

// ── Dev panel - the rank / colour tuner ──────────────────────────────────────
function renderSpectrumDev() {
  const rEl = document.getElementById('dev-spectrum-ranks');
  const cEl = document.getElementById('dev-spectrum-colors');
  if (!rEl || !cEl) return;
  rEl.innerHTML = RANKS_NUMERIC.map(rk =>
    `<button class="dev-spec-chip${spectrumRanksOn.has(rk) ? ' on' : ''}" onclick="toggleSpectrumRank('${rk}')">${rk}</button>`
  ).join('');
  cEl.innerHTML = COLORS.map(co =>
    `<button class="dev-spec-chip${spectrumColorsOn.has(co) ? ' on' : ''}" onclick="toggleSpectrumColor('${co}')" title="${COLOR_NAMES[co]}">${co}</button>`
  ).join('');
  const st = document.getElementById('dev-spectrum-status');
  if (st) {
    const n = spectrumDeckSize();
    st.textContent = `${spectrumRanks().length} values × ${spectrumColors().length} colours = ${n} cards`
      + (spectrumDeckDirty ? ' · applies next round' : '');
    st.style.color = spectrumDeckDirty ? 'var(--gold)' : 'var(--cream-dim)';
  }
}

// A toggle is refused when it would leave the deck too small to keep the board
// fed (or would empty a list outright) - the tuner can't deal a broken run.
function _spectrumTryToggle(set, key) {
  const had = set.has(key);
  had ? set.delete(key) : set.add(key);
  const ok = spectrumRanks().length >= 3 && spectrumColors().length >= 1
          && spectrumDeckSize() >= spectrumMinDeck()
          && (!had || set.size > 0);
  if (!ok) {
    had ? set.add(key) : set.delete(key);
    showMessage(`Deck would be too small (min ${spectrumMinDeck()} cards)`, '#ff8080');
    return false;
  }
  spectrumDeckDirty = true;
  saveSpectrumTune();
  renderSpectrumDev();
  return true;
}
function toggleSpectrumRank(rk)  { _spectrumTryToggle(spectrumRanksOn, rk); }
function toggleSpectrumColor(co) { _spectrumTryToggle(spectrumColorsOn, co); }
function spectrumTuneAll(which) {
  if (which === 'ranks')  spectrumRanksOn  = new Set(RANKS_NUMERIC);
  if (which === 'colors') spectrumColorsOn = new Set(COLORS);
  spectrumDeckDirty = true;
  saveSpectrumTune();
  renderSpectrumDev();
}
// Rebuild immediately instead of waiting for the round boundary (dev convenience).
function spectrumApplyNow() {
  if (!isNumericMode()) { showMessage('Spectrum mode only', '#ff8080'); return; }
  spectrumDeckDirty = true;
  spectrumApplyPendingDeck();
  renderSpectrumDev();
}
