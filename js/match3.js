// ══════════════════════════════════════════════
// MATCH-3 AUTO-PLAY MODE
// ══════════════════════════════════════════════
// A 5×5 board where any straight LINE (row or column) of 3+ contiguous cards
// forming a Flush / Run / Set auto-plays itself, then cascades — the player
// never presses Play. The player's ONLY board actions are swap and discard;
// those stay 100% manual (nothing auto-swaps or auto-discards, by design).
//
// Flow:  swap/discard  →  match3Resolve()  →  [detect → flash → pop → score →
//        removeAndFall → re-detect] until the board is quiet.
//
// Scoring reuses the REAL economy: every match is mapped to a normal poker hand
// name and run through calcScore, so Tricks, Knacks, permanent card buffs and
// Focus all apply exactly as they do in Normal mode. The combo multiplier is
// applied on top (score = pips × mult, so ×N score IS ×N pips).
// TBD: Sleight activations (on_play etc.) don't fire on auto-matches yet.

// ── Tuning ────────────────────────────────────────────────────────────────────
// Presentation per match type (label + burst colour). Scoring values come from
// HAND_BASE via the hand-name mapping below, not from here.
const MATCH3_BASE = {
  flush: { label: 'FLUSH', color: '#5aa9e6' },
  run:   { label: 'RUN',   color: '#54af88' },
  set:   { label: 'SET',   color: '#c9a84c' },
};

// Map a match (type + length) onto a real hand name so calcScore can price it.
// Longer lines naturally land on the bigger hands, which is where the
// "match-4 / match-5 is worth more" escalation comes from.
function match3HandName(type, len, cells) {
  if (type === 'set') return len >= 4 ? 'Four of a Kind' : 'Three of a Kind';
  if (type === 'run') {
    // A 5-long line that's also single-suited is a genuine Straight Flush.
    if (len >= 5) {
      const suits = new Set(cells.map(([r, c]) => gridData[r][c].suit));
      return suits.size === 1 ? 'Straight Flush' : 'Straight';
    }
    return len === 4 ? 'Run of 4' : 'Run of 3';
  }
  return 'Flush'; // flush of any length 3–5
}

// Combo multiplier by cascade step. Step 1 (the match the player set up) is ×1;
// every chain reaction after it is ×2, ×4, ×6, … (owner spec: "2x pips per combo").
function match3ComboMult(step) { return step <= 1 ? 1 : 2 * (step - 1); }

// ── Runtime state ─────────────────────────────────────────────────────────────
let match3Resolving   = false;  // a cascade is currently running
let match3ChainStep   = 0;      // current cascade depth (for the combo badge)
// Dev toggles (persisted)
// · infinite DECK  — scored cards requeue to the back of the draw pile instead of
//                    being held out until round end (finite is the default).
// · infinite MODE  — no clock and no goal gate. Pure sandbox, for testing.
// · preview select — highlight a match for a beat before it plays, so the player
//                    could interrupt it (off by default; owner leaned against it).
let match3InfiniteDeck  = localStorage.getItem('match3InfiniteDeck') === 'true';
let match3InfiniteMode  = localStorage.getItem('match3InfiniteMode') === 'true';
let match3PreviewSelect = localStorage.getItem('match3PreviewSelect') === 'true';

// Which match types are live. Turning a type off removes it from detection
// entirely — the board simply stops seeing those lines as matches.
// Flushes in particular fire very often on a random 5×5 (any 3 cards of the
// same suit in a line), and because matches must be disjoint a high-scoring
// flush can suppress a crossing run/set, so switching them off is a real
// balancing lever rather than just a filter.
let match3Types = (function () {
  const DEF = { flush: true, run: true, set: true };
  try {
    const saved = JSON.parse(localStorage.getItem('match3Types'));
    if (saved && typeof saved === 'object') return { ...DEF, ...saved };
  } catch (e) { /* fall through to defaults */ }
  return DEF;
})();

// Toggle a match type. At least one type must stay enabled or the board would
// deadlock (nothing could ever match), so the last one on refuses to turn off.
// Returns the resulting state so the UI can re-sync its checkbox.
function setMatch3Type(type, on) {
  if (!(type in match3Types)) return false;
  if (!on && Object.keys(match3Types).filter(t => match3Types[t]).length <= 1 && match3Types[type]) {
    if (typeof showMessage === 'function') showMessage('At least one match type must stay on', 'var(--cream-dim)');
    return true; // refused — caller re-checks the box
  }
  match3Types[type] = !!on;
  try { localStorage.setItem('match3Types', JSON.stringify(match3Types)); } catch (e) {}
  return match3Types[type];
}
const MATCH3_PREVIEW_MS = 1000; // highlight-before-play window when the toggle is on
// Set when a NEW board has been dealt (level-up) and still needs its silent
// settle. Consumed by startRoundTimer, which is the one call site every round
// start funnels through — a mid-round resume must NOT re-settle the board.
let match3PendingSettle = false;

function match3Active() { return !!ACTIVE_MODE?.match3; }
// Zen: match-3 with no clock and no swap/discard limits (goals are doubled at
// level-up so the reward grid is still reachable, just slower).
function match3IsZen()  { return !!ACTIVE_MODE?.zen; }
// True when nothing should end the round — Zen mode or the infinite dev toggle.
function match3NoTimer() { return match3Active() && (match3IsZen() || match3InfiniteMode); }
function match3NoGoal()  { return match3Active() && match3InfiniteMode; }

function setMatch3InfiniteDeck(on) {
  match3InfiniteDeck = !!on;
  localStorage.setItem('match3InfiniteDeck', match3InfiniteDeck);
}
function setMatch3InfiniteMode(on) {
  match3InfiniteMode = !!on;
  localStorage.setItem('match3InfiniteMode', match3InfiniteMode);
}
function setMatch3PreviewSelect(on) {
  match3PreviewSelect = !!on;
  localStorage.setItem('match3PreviewSelect', match3PreviewSelect);
}

// Zen (and the infinite dev toggle) run without swap/discard scarcity. Rather
// than special-casing every spend site, we just top the pools back up — the
// existing "do you have any left?" guards then always pass.
const MATCH3_ZEN_POOL = 99;
function match3ApplyZenResources() {
  if (!match3Active()) return;
  if (!match3IsZen() && !match3InfiniteMode) return;
  swaps = MATCH3_ZEN_POOL;
  discards = MATCH3_ZEN_POOL;
  if (typeof updateScoreUI === 'function') updateScoreUI();
}

// ══════════════════════════════════════════════
// DETECTION
// ══════════════════════════════════════════════
// Only plain cards match. Sleights, Tricks, stones and blocked cells act as
// immovable blockers that break a line (a Sleight that must be played inside a
// hand can't be auto-played, per owner call — so no Sleight joins a match).
// TBD: let wildcard Sleights stand in for a rank/suit here.
function match3Matchable(r, c) {
  const card = gridData[r]?.[c];
  if (!card) return false;
  if (card._isSleight || card._isTrick || card._isStone || card.isChallenge) return false;
  if (!card.rank || !card.suit) return false;
  if (isCellBlocked(r, c)) return false;
  return true;
}

// EVERY match type a group of cards satisfies. A single-suited run qualifies as
// both 'run' and 'flush', so we return both and let the scorer pick the more
// valuable reading (owner's overlap rule: the hand worth more total wins).
// Order-independent within the window, so a [7,5,6] line still reads as a run.
function match3TypesOf(cards) {
  if (cards.length < 3) return [];
  const types = [];
  const suits = new Set(cards.map(c => c.suit));
  const ranks = cards.map(c => c.rank);
  if (match3Types.set && new Set(ranks).size === 1) types.push('set');   // same rank
  if (match3Types.flush && suits.size === 1) types.push('flush');         // same suit
  // Run: distinct, consecutive ranks (Ace low or high)
  if (match3Types.run && new Set(ranks).size === ranks.length) {
    const lo = [...ranks.map(r => RANK_ORDER[r])].sort((a, b) => a - b);
    const hi = [...ranks.map(r => (r === 'A' ? 14 : RANK_ORDER[r]))].sort((a, b) => a - b);
    const seq = arr => arr.every((v, i) => i === 0 || v - arr[i - 1] === 1);
    if (seq(lo) || seq(hi)) types.push('run');
  }
  return types;
}

// Score one match through the real economy, then apply the combo multiplier.
function match3ScoreMatch(type, cells, comboMult) {
  const hand = match3HandName(type, cells.length, cells);
  const raw = calcScore(hand, cells);
  const out = Math.max(0, Math.round(raw * comboMult));
  // Match-3 never calls playHand, so it logs its own auto-played matches for the
  // SCORE-box hand log (js/hand-log.js).
  if (typeof logPlayedHand === 'function') logPlayedHand(hand, cells, out, { src: 'match3' });
  return out;
}

// Every valid contiguous window of 3+ in every row and column.
function match3AllWindows() {
  const out = [];
  const consider = (cells) => {
    const cards = cells.map(([r, c]) => gridData[r][c]);
    // One entry per satisfied type — the overlap pass keeps only the best-scoring
    // reading of any given set of cells.
    match3TypesOf(cards).forEach(type => out.push({ type, cells }));
  };
  // Rows
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (!match3Matchable(r, c)) continue;
      for (let len = 3; c + len <= gridCols; len++) {
        const cells = [];
        let ok = true;
        for (let i = 0; i < len; i++) {
          if (!match3Matchable(r, c + i)) { ok = false; break; }
          cells.push([r, c + i]);
        }
        if (!ok) break;
        consider(cells);
      }
    }
  }
  // Columns
  for (let c = 0; c < gridCols; c++) {
    for (let r = 0; r < gridRows; r++) {
      if (!match3Matchable(r, c)) continue;
      for (let len = 3; r + len <= gridRows; len++) {
        const cells = [];
        let ok = true;
        for (let i = 0; i < len; i++) {
          if (!match3Matchable(r + i, c)) { ok = false; break; }
          cells.push([r + i, c]);
        }
        if (!ok) break;
        consider(cells);
      }
    }
  }
  return out;
}

// Pick the set of matches that fire together this cascade step.
// Overlap priority (owner call): the match worth MORE total score wins; ties
// break on longer line, then on highest card rank. Non-overlapping matches all
// fire in the same step, the way simultaneous match-3 clears work.
function findMatch3Matches(comboMult = 1) {
  const windows = match3AllWindows();
  if (!windows.length) return [];
  windows.forEach(w => {
    w.score = match3ScoreMatch(w.type, w.cells, comboMult);
    w.topRank = Math.max(...w.cells.map(([r, c]) => rankHighVal(gridData[r][c].rank)));
  });
  windows.sort((a, b) =>
    b.score - a.score ||
    b.cells.length - a.cells.length ||
    b.topRank - a.topRank
  );
  const taken = new Set();
  const chosen = [];
  for (const w of windows) {
    if (w.cells.some(([r, c]) => taken.has(`${r}-${c}`))) continue; // overlaps a better match
    w.cells.forEach(([r, c]) => taken.add(`${r}-${c}`));
    chosen.push(w);
  }
  return chosen;
}

// ══════════════════════════════════════════════
// BOARD SETTLE (no free score at deal time)
// ══════════════════════════════════════════════
// A freshly dealt board may already contain matches. Rather than gifting the
// player an opening cascade, quietly re-draw the offending cards until the board
// is quiet (bounded, so a thin draw pile can't spin here forever).
function match3SettleBoard() {
  if (!match3Active()) return;
  for (let guard = 0; guard < 60; guard++) {
    const matches = findMatch3Matches();
    if (!matches.length) return;
    // Replace ONE card from each match — the cheapest way to break every line.
    let replaced = false;
    for (const m of matches) {
      const [r, c] = m.cells[Math.floor(m.cells.length / 2)];
      const old = gridData[r][c];
      const fresh = drawCard();
      if (!fresh) return; // deck exhausted — let it ride, the cascade will handle it
      gridData[r][c] = fresh;
      if (old && old.rank) drawPile.push({ rank: old.rank, suit: old.suit }); // recycle, don't lose it
      replaced = true;
    }
    if (!replaced) return;
  }
}

// ══════════════════════════════════════════════
// THE CASCADE LOOP
// ══════════════════════════════════════════════
// Runs after any board change. Detects → animates → scores → falls → repeats
// until nothing matches. Guarded so only one cascade runs at a time.
async function match3Resolve() {
  if (!match3Active()) return;
  if (match3Resolving) return;
  if (roundEnded || isPaused) return;
  if (animating || falling) return;

  match3Resolving = true;
  match3ChainStep = 0;

  try {
    while (!roundEnded) {
      const step = match3ChainStep + 1;
      if (step > 60) { dbgEvent('warn', 'match-3 cascade cap hit'); break; } // pathological-chain guard
      const comboMult = match3ComboMult(step);
      const matches = findMatch3Matches(comboMult);
      if (!matches.length) break;
      match3ChainStep = step;

      // Block input for the flash/pop beat.
      animating = true;

      // Optional dev behaviour: highlight the match first and give the player a
      // beat to interrupt, instead of popping it immediately.
      if (match3PreviewSelect) {
        match3HighlightMatches(matches, true);
        await match3Wait(MATCH3_PREVIEW_MS);
        if (roundEnded) { animating = false; break; }
      }

      // ── Flash → pop → score ──
      const stepScore = await match3PlayMatches(matches, step, comboMult);
      score += stepScore;
      handsPlayed += matches.length;
      updateScoreUI();

      // Goal check happens BEFORE the clear, so the goal-clinching match's cards
      // are still on the board to drive the win finale (they fly to the preview).
      // (Infinite dev mode never ends the round; Zen still has goals, just doubled.)
      const goalMet = !match3NoGoal() && score >= roundGoal && !goalReachedThisRound;
      if (goalMet) {
        goalReachedThisRound = true;
        roundEnded = true;
        if (roundInterval) { clearInterval(roundInterval); roundInterval = null; }
        match3ClearComboBadge();
        const winCells = matches.flatMap(m => m.cells);
        await match3WinFinale(winCells);      // jitter → explode → winners fly to preview
        setTimeout(() => triggerLevelUp(), 250);
        break;
      }

      // ── Clear + gravity + refill (shared engine) ──
      const removing = matches.flatMap(m => m.cells);
      animating = false; // removeAndFall refuses to run while `animating`
      await removeAndFall(removing, 'match3');
      await match3Wait(90); // small breath between chain links
    }
  } finally {
    animating = false;
    match3Resolving = false;
    match3ChainStep = 0;
    match3ClearComboBadge();
    if (!roundEnded) render();
  }
}

// Animate + score one cascade step. Returns the total score for the step.
async function match3PlayMatches(matches, step, comboMult) {
  let total = 0;
  const gridEl = document.getElementById('grid');

  // Combo badge (big ×2 / ×4 / ×6 over the grid) from the first chain link on.
  if (comboMult > 1) match3ShowComboBadge(comboMult, step);

  // 1) FLASH — every matched card lights up so the player sees WHERE it happened.
  match3HighlightMatches(matches, false);
  sfxMatch3Match(step);
  await match3Wait(230);

  // 2) POP — burst each match, floating score at its centre.
  matches.forEach((m) => {
    const s = match3ScoreMatch(m.type, m.cells, comboMult);
    m.score = s;
    total += s;
    m.cells.forEach(([r, c]) => {
      const card = gridData[r]?.[c];
      const el = card && gridEl?.querySelector(`[data-card-id="${card._id}"]`);
      if (el) {
        el.classList.remove('m3-match');
        el.classList.add('m3-pop');
      }
      match3Burst(r, c, MATCH3_BASE[m.type].color);
    });
    match3FloatScore(m, s, comboMult);
  });
  sfxMatch3Pop(step);
  await match3Wait(300);

  return total;
}

// Add/remove the pulsing highlight on matched cards.
function match3HighlightMatches(matches, preview) {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  matches.forEach(m => m.cells.forEach(([r, c]) => {
    const card = gridData[r]?.[c];
    const el = card && gridEl.querySelector(`[data-card-id="${card._id}"]`);
    if (el) el.classList.add(preview ? 'm3-preview' : 'm3-match');
  }));
}

// ══════════════════════════════════════════════
// VISUALS
// ══════════════════════════════════════════════
function match3Wait(ms) { return new Promise(res => setTimeout(res, ms)); }

// Particle burst from a cell — the genre's signature "pop".
function match3Burst(r, c, color) {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  const cx = cellLeft(c) + CARD_W / 2;
  const cy = cellTop(r) + CARD_H / 2;
  const COUNT = 7;
  for (let i = 0; i < COUNT; i++) {
    const p = document.createElement('div');
    p.className = 'm3-particle';
    p.style.left = cx + 'px';
    p.style.top  = cy + 'px';
    p.style.background = color;
    gridEl.appendChild(p);
    const ang  = (Math.PI * 2 * i) / COUNT + Math.random() * 0.5;
    const dist = 22 + Math.random() * 26;
    p.animate([
      { transform: 'translate(-50%,-50%) scale(1)',   opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(0)`, opacity: 0 },
    ], { duration: 420 + Math.random() * 160, easing: 'cubic-bezier(0.2,0.7,0.3,1)', fill: 'forwards' })
      .finished.then(() => p.remove()).catch(() => p.remove());
  }
}

// "+N" floating up from the centre of the match.
function match3FloatScore(match, amount, comboMult) {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  const rs = match.cells.map(([r]) => r), cs = match.cells.map(([, c]) => c);
  const midR = (Math.min(...rs) + Math.max(...rs)) / 2;
  const midC = (Math.min(...cs) + Math.max(...cs)) / 2;
  const el = document.createElement('div');
  el.className = 'm3-float';
  el.style.left = (cellLeft(midC) + CARD_W / 2) + 'px';
  el.style.top  = (cellTop(midR) + CARD_H / 2) + 'px';
  el.style.color = MATCH3_BASE[match.type].color;
  el.innerHTML = `<span class="m3-float-type">${MATCH3_BASE[match.type].label}</span>` +
                 `<span class="m3-float-amt">+${amount.toLocaleString()}</span>`;
  gridEl.appendChild(el);
  el.animate([
    { transform: 'translate(-50%,-50%) scale(0.6)', opacity: 0 },
    { transform: 'translate(-50%,-72%) scale(1.06)', opacity: 1, offset: 0.28 },
    { transform: 'translate(-50%,-120%) scale(1)',  opacity: 0 },
  ], { duration: 900, easing: 'cubic-bezier(0.2,0.7,0.3,1)', fill: 'forwards' })
    .finished.then(() => el.remove()).catch(() => el.remove());
}

// Big ×2 / ×4 / ×6 combo callout over the grid.
function match3ShowComboBadge(mult, step) {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;
  let el = document.getElementById('m3-combo-badge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'm3-combo-badge';
    gridEl.appendChild(el);
  }
  el.innerHTML = `<span class="m3-combo-x">×${mult}</span><span class="m3-combo-lbl">COMBO ${step}</span>`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  sfxMatch3Combo(step);
}
function match3ClearComboBadge() {
  document.getElementById('m3-combo-badge')?.classList.remove('show');
}

// ══════════════════════════════════════════════
// WIN FINALE
// ══════════════════════════════════════════════
// Mirrors the Normal-mode goal-hand finale (jitter → gentle explode → winners
// fly to the preview), so a match-3 round win reads the same. `winCells` are the
// cells of the match that clinched the goal — they're still on the board here
// because the goal check runs before the clear. Self-contained (doesn't touch the
// shared score dance) and resolves when the sequence is done.
async function match3WinFinale(winCells) {
  const gridEl = document.getElementById('grid');
  if (!gridEl) { sfxSuccess(); return; }
  animating = true;
  sfxSuccess();

  const winIds = new Set(winCells.map(([r, c]) => gridData[r]?.[c]?._id).filter(v => v != null));
  const all = [...gridEl.querySelectorAll('[data-card-id]')];
  const winEls = [], loseEls = [];
  all.forEach(el => (winIds.has(+el.getAttribute('data-card-id')) ? winEls : loseEls).push(el));

  // Winners get a gold glow; everything else jitters, then blasts outward.
  winEls.forEach(el => { el.style.zIndex = '20'; el.animate(
    [{ boxShadow: '0 0 0 0 rgba(245,192,66,0)' }, { boxShadow: '0 0 16px 5px rgba(245,192,66,0.6)' }],
    { duration: 360, fill: 'forwards' }); });

  const jitters = loseEls.map(el => el.animate([
    { transform: 'translate(0,0) rotate(0)' },
    { transform: 'translate(1.3px,-1.1px) rotate(0.8deg)' },
    { transform: 'translate(-1.1px,1.3px) rotate(-0.9deg)' },
    { transform: 'translate(1.1px,1px) rotate(0.6deg)' },
    { transform: 'translate(-1.3px,-0.9px) rotate(-0.7deg)' },
    { transform: 'translate(0,0) rotate(0)' },
  ], { duration: 150, iterations: 10, easing: 'linear' })); // ~1.5s
  await match3Wait(1400);

  jitters.forEach(a => { try { a.cancel(); } catch (e) {} });
  sfxWinExplode();
  const gr = gridEl.getBoundingClientRect();
  const cx = gr.left + gr.width / 2, cy = gr.top + gr.height / 2;
  loseEls.forEach(el => {
    const r = el.getBoundingClientRect();
    let ax = (r.left + r.width / 2) - cx, ay = (r.top + r.height / 2) - cy;
    const len = Math.hypot(ax, ay) || 1; ax /= len; ay /= len;
    const dist = 200 + Math.random() * 140, rot = (Math.random() * 2 - 1) * 160;
    el.style.zIndex = '30';
    el.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      { transform: `translate(${ax * dist}px,${ay * dist}px) rotate(${rot}deg) scale(.82)`, opacity: 0 },
    ], { duration: 850, easing: 'cubic-bezier(.25,.6,.35,1)', fill: 'forwards' });
  });

  // Winners fly up into the hand-preview area (same destination Normal-mode
  // winners use), so the win moment lands in the preview like the poker modes.
  const preview = document.getElementById('selected-cards');
  const pr = preview ? preview.getBoundingClientRect() : null;
  winEls.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const destX = pr ? (pr.left + pr.width / 2) : cx;
    const destY = pr ? (pr.top + pr.height / 2) : cy - 160;
    const dx = destX - (r.left + r.width / 2), dy = destY - (r.top + r.height / 2);
    el.style.zIndex = '40';
    el.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(0.82)`, opacity: 0.95, offset: 0.85 },
      { transform: `translate(${dx}px,${dy}px) scale(0.7)`, opacity: 0 },
    ], { duration: 700, delay: 120 + i * 90, easing: 'cubic-bezier(.35,.65,.3,1)', fill: 'forwards' });
  });
  await match3Wait(120 + winEls.length * 90 + 700 + 120);

  all.forEach(el => el.remove()); // clear the board; triggerLevelUp deals the next one
}

// ══════════════════════════════════════════════
// LEVEL-UP (between rounds) — run the normal SHOP
// ══════════════════════════════════════════════
// Match-3 reuses the standard between-rounds shop (owner request). The shop is
// self-contained: it grants Tricks to the side tray (injectTrickAfterReward),
// never the grid, and its "leave" button already starts the next round when it
// isn't part of the node flow — see the shop-close handler's match3Active branch.
// The one gap is CREDITS: match-3 has no coin economy of its own yet, so we grant
// a per-level stipend, otherwise the shop would be unaffordable.
const MATCH3_SHOP_COINS_BASE  = 20;
const MATCH3_SHOP_COINS_LEVEL = 3;   // + this per level reached

async function showMatch3LevelUpScreen() {
  selected = [];
  const gridEl = document.getElementById('grid');
  gridEl?.querySelectorAll('[data-card-id],.trick-card,.temp-anim,.trick-target-slot').forEach(el => el.remove());
  // Deal the next round's board now (settled), hidden behind the shop overlay.
  // The 3-2-1 deal that reveals it runs when the shop is left (match3AfterShop).
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++)
      gridData[r][c] = drawCard() || null;
  match3SettleBoard();
  match3PendingSettle = true;
  dealPhase = true;

  // Credits stipend so the shop is actually usable.
  coins += MATCH3_SHOP_COINS_BASE + (level - 1) * MATCH3_SHOP_COINS_LEVEL;
  updateCoinsUI();

  triggerShop(); // pauses the round clock, shows the shop overlay
}

// Called from the shop-close handler in match-3: reveal the pre-dealt board with
// the goal flash + 3-2-1, then start the round (which settles + kicks the cascade).
function match3AfterShop() {
  if (pendingLevelUps > 0) { pendingLevelUps--; setTimeout(() => drainLevelUpQueue(), 400); return; }
  showNextGoalFlash().then(() => show321Countdown()).then(() => {
    dealPhase = false;
    gameTimerPaused = false;
    sfxRoundStart();
    updateClockUI();
    render();
    startRoundTimer(); // settles the board + kicks the cascade (match3PendingSettle)
  });
}

// ══════════════════════════════════════════════
// SOUND
// ══════════════════════════════════════════════
// Built on the existing procedural playTone engine. Deliberately ~75% of the
// saturation of a mainstream match-3: present and satisfying, not carnival.
// Pitch climbs with the cascade depth — the genre's core dopamine cue.
function match3StepSemitone(step) { return Math.min(step - 1, 8) * 2; } // whole steps, capped

function sfxMatch3Match(step) {
  const f = 392 * Math.pow(2, match3StepSemitone(step) / 12);
  playTone({ freq: f, type: 'triangle', gain: 0.075, attack: 0.004, decay: 0.05, sustain: 0.25, release: 0.12, duration: 0.09 });
}

function sfxMatch3Pop(step) {
  const root = 523.25 * Math.pow(2, match3StepSemitone(step) / 12);
  playTone({ freq: root,        type: 'triangle', gain: 0.115, attack: 0.003, decay: 0.05, sustain: 0.28, release: 0.20, duration: 0.11 });
  playTone({ freq: root * 1.5,  type: 'sine',     gain: 0.070, attack: 0.004, decay: 0.05, sustain: 0.22, release: 0.22, duration: 0.13, delay: 0.045 });
  playTone({ freq: root * 2,    type: 'sine',     gain: 0.045, attack: 0.006, decay: 0.04, sustain: 0.18, release: 0.24, duration: 0.14, delay: 0.085 });
}

function sfxMatch3Combo(step) {
  const root = 659.25 * Math.pow(2, match3StepSemitone(step) / 12);
  [0, 4, 7].forEach((semi, i) => {
    playTone({ freq: root * Math.pow(2, semi / 12), type: 'triangle', gain: 0.085 - i * 0.014,
      attack: 0.004, decay: 0.06, sustain: 0.3, release: 0.26, duration: 0.13, delay: i * 0.05 });
  });
}
