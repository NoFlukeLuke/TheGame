// ══════════════════════════════════════════════
// SLOT EVENTS (r197) - The Floor (cards) · The Payline (entities)
// ══════════════════════════════════════════════
// Two machines that share one reel engine. They differ in what a symbol IS and
// in what a win pays, and in nothing else.
//
// THE MATH, WHICH IS THE WHOLE DESIGN PROBLEM HERE. A slot machine is only
// honest if the odds are knowable, and these reels are built from the player's
// own live deck and loadout, which change every run. So nothing is hand-tuned:
// each reel is an INDEPENDENT UNIFORM DRAW over a symbol population taken from
// the run, which makes the odds a closed form the game can compute and PRINT
// before the player pays.
//
//   cards     - symbol = one card of the live deck, so P(the leftmost three on a
//               line share a suit) = sum over suits of p_s^3, where p_s is that
//               suit's share of the deck. Four even suits gives 4*(1/4)^3 = 1/16
//               a line, about 27% over five lines. Spectrum's seven colours give
//               1/49, which is the correct answer for a seven-colour deck rather
//               than a number that needs re-tuning per mode.
//   entities  - symbol = one owned Trick, Knack or Sleight, capped at SLOT_ENT_SYMBOLS
//               distinct, so P(three alike) = 1/k^2 exactly. The cap is what
//               keeps a large loadout from making the machine unwinnable: at 12
//               owned entities a free draw would be 1 in 144.
//
// slotOddsText() renders those formulas straight onto the panel. "Idk how to make
// the math work" is answered by making the machine show its work.

const SLOT_ROWS = 3;
const SLOT_REELS = 5;
const SLOT_ENT_REELS = 3;
const SLOT_ENT_SYMBOLS = 4;      // distinct entities on the reels - see the note above
const SLOT_MIN_RUN = 3;          // shortest paying run, counted from the left

// The five lines, as a row index per reel. Middle first: it is the one line a
// player buying a single line expects to get.
const SLOT_LINES = [
  { name:'CENTRE', rows:[1,1,1,1,1] },
  { name:'TOP',    rows:[0,0,0,0,0] },
  { name:'BOTTOM', rows:[2,2,2,2,2] },
  { name:'V',      rows:[0,1,2,1,0] },
  { name:'PEAK',   rows:[2,1,0,1,2] },
];

// Rotating buffs. A paying line takes the next one and the index advances, so a
// lucky run spreads its winnings across pips, mult and replays instead of piling
// one stat onto a handful of cards.
const SLOT_BUFFS = [
  { e:{ pips:25 },  say:'+25 pips' },
  { e:{ mult:4 },   say:'+4 mult' },
  { e:{ pips:40 },  say:'+40 pips' },
  { e:{ retrig:1 }, say:'replays' },
  { e:{ mult:7 },   say:'+7 mult' },
  { e:{ xmult:2 },  say:'×2 mult' },
];
let slotBuffIdx = 0;

// ── Reel engine ─────────────────────────────────────────────────────────────
// A spin is decided in full before a pixel moves: slotSpin builds the result
// grid, slotRenderSpin merely shows it. An animation that is interrupted, or a
// tab that is backgrounded mid-spin, can therefore never change the outcome.
function slotSpin(symbols, reels, rows) {
  const grid = [];
  for (let c = 0; c < reels; c++) {
    const col = [];
    for (let r = 0; r < rows; r++) col.push(symbols[Math.floor(Math.random() * symbols.length)]);
    grid.push(col);
  }
  return grid;
}

// The leftmost run on `line`, by the given key function. Returns the cells that
// pay, or null. Counted from the left and stopping at the first mismatch - the
// rule every physical five-reel machine uses, and the reason reel 1 matters most.
function slotLineRun(grid, line, keyOf) {
  const first = grid[0][line.rows[0]];
  if (first === undefined || first === null) return null;
  const key = keyOf(first);
  const cells = [[0, line.rows[0]]];
  for (let c = 1; c < grid.length; c++) {
    const s = grid[c][line.rows[c]];
    if (s === undefined || s === null || keyOf(s) !== key) break;
    cells.push([c, line.rows[c]]);
  }
  return cells.length >= SLOT_MIN_RUN ? cells : null;
}

// P(the leftmost `n` draws are equal under keyOf) = sum of each key's share^n.
function slotMatchOdds(symbols, keyOf, n) {
  const share = {};
  symbols.forEach(s => { const k = keyOf(s); share[k] = (share[k] || 0) + 1; });
  const total = symbols.length || 1;
  return Object.values(share).reduce((acc, c) => acc + Math.pow(c / total, n), 0);
}
function slotPct(p) { return p <= 0 ? '0%' : (p * 100 < 1 ? (p * 100).toFixed(2) : (p * 100).toFixed(1)) + '%'; }

// ── Shared reel rendering ───────────────────────────────────────────────────
// Reels stop left to right, SLOT_STAGGER apart. That stagger is the whole reason
// a slot machine is tense: by the time the last reel is still moving you already
// know whether it can pay.
const SLOT_STAGGER = 260;
const SLOT_SPIN_MS = 900;

function slotRenderSpin(host, grid, cellHTML, onDone) {
  host.innerHTML = '';
  const reelEls = [];
  grid.forEach((col, ci) => {
    const reel = document.createElement('div');
    reel.className = 'slot-reel';
    const strip = document.createElement('div');
    strip.className = 'slot-strip';
    // Blur cells above the result so the reel has something to spin past; the
    // final `rows` cells are the real outcome and the strip lands on them.
    const LEAD = 9;
    for (let i = 0; i < LEAD; i++) {
      const filler = grid[(ci + i) % grid.length][i % col.length];
      strip.appendChild(slotCell(filler, cellHTML));
    }
    col.forEach(sym => strip.appendChild(slotCell(sym, cellHTML)));
    reel.appendChild(strip);
    host.appendChild(reel);
    reelEls.push({ reel, strip, lead: LEAD });
  });
  // Let the cells lay out before measuring, or every offsetHeight is 0.
  requestAnimationFrame(() => {
    reelEls.forEach((r, i) => {
      const cell = r.strip.firstElementChild;
      const h = cell ? cell.offsetHeight : 46;
      r.strip.style.transform = 'translateY(0px)';
      requestAnimationFrame(() => {
        r.strip.style.transition = `transform ${SLOT_SPIN_MS + i * SLOT_STAGGER}ms cubic-bezier(.16,.68,.2,1)`;
        r.strip.style.transform  = `translateY(${-(r.lead * h)}px)`;
      });
      setTimeout(() => {
        r.reel.classList.add('stopped');
        if (typeof sfxCardPop === 'function') try { sfxCardPop(); } catch (e) {}
      }, SLOT_SPIN_MS + i * SLOT_STAGGER);
    });
    setTimeout(onDone, SLOT_SPIN_MS + (reelEls.length - 1) * SLOT_STAGGER + 160);
  });
}
function slotCell(sym, cellHTML) {
  const d = document.createElement('div');
  d.className = 'slot-cell';
  d.innerHTML = cellHTML(sym);
  return d;
}
// Mark the winning cells once the reels have stopped.
function slotLightCells(host, cells) {
  cells.forEach(([c, r]) => {
    const reel = host.children[c];
    const strip = reel && reel.firstElementChild;
    if (!strip) return;
    // The result rows are the LAST `rows` cells of the strip; a machine with one
    // visible row (The Payline) says so on the reel, since it cannot be inferred.
    const idx = strip.children.length - (reel.dataset.rows ? +reel.dataset.rows : SLOT_ROWS) + r;
    strip.children[idx]?.classList.add('slot-win');
  });
}

// ══════════════════════════════════════════════
// EVENT: THE FLOOR - the card machine
// ══════════════════════════════════════════════
function renderFloor() {
  const body = document.getElementById('event-body');
  const deck = (typeof everyDeckCard === 'function') ? everyDeckCard() : [];
  if (deck.length < SLOT_REELS) {
    body.innerHTML = evEmptyHTML('Not enough cards in the deck to fill the reels.');
    eventState.floorNone = true;
    setEventConfirm(true); return;
  }
  eventState.floorDeck  = deck;
  eventState.floorLines = 1;
  eventState.floorSpun  = 0;
  eventState.floorWon   = 0;
  body.appendChild(evNote('Every card in your deck is on the reels. Buy lines, then spin for as long as you can pay. A run of three or more from the left pays the cards that made it.'));
  floorRenderControls();
}

function floorLineCost() { return priceOf(BAL.the_floor.line_cost) * eventState.floorLines; }

function floorRenderControls() {
  const body = document.getElementById('event-body');
  document.getElementById('ev-floor-panel')?.remove();
  const deck = eventState.floorDeck;
  const wrap = document.createElement('div');
  wrap.id = 'ev-floor-panel';

  const pSuit = slotMatchOdds(deck, c => c.suit, SLOT_MIN_RUN);
  const pRank = slotMatchOdds(deck, c => c.rank, SLOT_MIN_RUN);
  const lines = eventState.floorLines;
  // At least one hit across `lines` independent lines. The lines overlap on reel 1,
  // so this is an approximation and is labelled as "about" on the panel.
  const any = 1 - Math.pow(1 - (pSuit + pRank), lines);

  wrap.appendChild(evLabel('LINES'));
  const row = document.createElement('div');
  row.className = 'slot-lines';
  SLOT_LINES.forEach((ln, i) => {
    const b = document.createElement('button');
    b.className = 'ev-btn slot-linebtn' + (i < lines ? ' on' : '');
    b.textContent = ln.name;
    b.onclick = () => { eventState.floorLines = i + 1; floorRenderControls(); };
    row.appendChild(b);
  });
  wrap.appendChild(row);
  wrap.appendChild(evNote(
    `${lines} line${lines > 1 ? 's' : ''} · <b>${floorLineCost()} credits</b> a spin.<br>`
    + `Suit run pays about <b>${slotPct(pSuit)}</b> a line, rank run <b>${slotPct(pRank)}</b>. `
    + `About <b>${slotPct(any)}</b> of spins pay something.`));

  const host = document.createElement('div');
  host.className = 'slot-machine';
  host.id = 'ev-floor-reels';
  wrap.appendChild(host);

  const status = document.createElement('div');
  status.id = 'ev-floor-status';
  status.className = 'ev-note';
  status.innerHTML = eventState.floorSpun
    ? `${eventState.floorSpun} spin${eventState.floorSpun > 1 ? 's' : ''} · ${eventState.floorWon} card${eventState.floorWon === 1 ? '' : 's'} improved`
    : 'Reels idle.';
  wrap.appendChild(status);

  const spin = document.createElement('button');
  spin.className = 'ev-btn';
  spin.id = 'ev-floor-spin';
  spin.textContent = `SPIN · ${floorLineCost()}`;
  spin.disabled = coins < floorLineCost();
  spin.onclick = () => floorSpin();
  wrap.appendChild(spin);

  body.appendChild(wrap);
  setEventConfirm(true);
  document.getElementById('event-confirm').textContent = eventState.floorSpun ? 'CASH OUT' : 'Confirm';
}

function floorSpin() {
  const cost = floorLineCost();
  if (coins < cost) return;
  coins -= cost; updateCoinsUI?.();
  eventState.floorSpun++;
  const btn = document.getElementById('ev-floor-spin');
  if (btn) btn.disabled = true;
  const host = document.getElementById('ev-floor-reels');
  const grid = slotSpin(eventState.floorDeck, SLOT_REELS, SLOT_ROWS);
  slotRenderSpin(host, grid, c => {
    const red = ['♥','♦'].includes(c.suit);
    return `<span class="ev-cardchip${red ? ' red' : ''}">${c.rank}${(typeof cardColorSuit === 'function') ? cardColorSuit(c) : c.suit}</span>`;
  }, () => floorResolve(host, grid));
}

function floorResolve(host, grid) {
  const lines = SLOT_LINES.slice(0, eventState.floorLines);
  const hits = [];
  lines.forEach(ln => {
    // Rank first: a rank run is also a stronger claim on the same cells, and a
    // line pays once.
    const byRank = slotLineRun(grid, ln, c => c.rank);
    const run = byRank || slotLineRun(grid, ln, c => c.suit);
    if (run) hits.push({ ln, run, kind: byRank ? 'rank' : 'suit' });
  });
  let improved = 0;
  const said = [];
  hits.forEach(h => {
    const buff = SLOT_BUFFS[slotBuffIdx % SLOT_BUFFS.length];
    slotBuffIdx++;
    slotLightCells(host, h.run);
    h.run.forEach(([c, r]) => {
      // Re-resolve at apply time: the pick was made off a snapshot of the deck and
      // a card can have left the run since (Monopoly eats one, Spectrum rebuilds).
      const target = (typeof resolveDeckCard === 'function') ? resolveDeckCard(grid[c][r]) : grid[c][r];
      if (!target) return;
      enhanceCardKey(cardId(target), buff.e);
      improved++;
    });
    said.push(`${h.ln.name} ${h.kind} run · ${buff.say}`);
  });
  eventState.floorWon += improved;
  const status = document.getElementById('ev-floor-status');
  if (status) status.innerHTML = hits.length
    ? said.join('<br>') + `<br><b>${improved} card${improved === 1 ? '' : 's'} improved.</b>`
    : 'No line paid.';
  if (hits.length && typeof sfxCoin === 'function') try { sfxCoin(); } catch (e) {}
  const btn = document.getElementById('ev-floor-spin');
  if (btn) {
    btn.disabled = coins < floorLineCost();
    btn.textContent = `SPIN · ${floorLineCost()}`;
  }
  document.getElementById('event-confirm').textContent = 'CASH OUT';
}

function confirmFloor() {
  if (eventState.floorWon) showMessage(`${eventState.floorWon} cards improved`, 'var(--gold)');
  closeEvent();
}

// ══════════════════════════════════════════════
// EVENT: THE PAYLINE - the entity machine
// ══════════════════════════════════════════════
function renderPayline() {
  const body = document.getElementById('event-body');
  const all = (typeof evImprovables === 'function') ? evImprovables() : [];
  if (all.length < 2) {
    body.innerHTML = evEmptyHTML('Not enough Tricks or Sleights to fill the reels. Take the fee instead.');
    eventState.paylineNone = true;
    setEventConfirm(true); return;
  }
  // Cap the distinct symbols so the odds stay reachable for a big loadout - at 12
  // owned entities an uncapped machine would be 1 in 144 a spin. Which ones make
  // the reels is drawn once, up front, and shown, so the player is never paying
  // into a machine whose contents they cannot see.
  const symbols = (typeof evShuffle === 'function' ? evShuffle(all) : all.slice()).slice(0, SLOT_ENT_SYMBOLS);
  eventState.paylineSyms = symbols;
  eventState.paylineSpun = 0;
  eventState.paylineWon  = [];
  const k = symbols.length;
  body.appendChild(evNote(
    `Three alike on the line and that entity improves a tier. `
    + `<b>${k}</b> on the reels, so a win is <b>1 in ${k * k}</b> · about <b>${slotPct(1 / (k * k))}</b> a spin.`));
  paylineRenderControls();
}

function paylineRenderControls() {
  const body = document.getElementById('event-body');
  document.getElementById('ev-payline-panel')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'ev-payline-panel';

  wrap.appendChild(evLabel('ON THE REELS'));
  const strip = document.createElement('div');
  strip.className = 'slot-lines';
  eventState.paylineSyms.forEach(e => {
    const b = document.createElement('div');
    b.className = 'ev-btn slot-linebtn on';
    b.textContent = `${e.emoji} ${e.name}`;
    strip.appendChild(b);
  });
  wrap.appendChild(strip);

  const host = document.createElement('div');
  host.className = 'slot-machine';
  host.id = 'ev-payline-reels';
  wrap.appendChild(host);

  const status = document.createElement('div');
  status.id = 'ev-payline-status';
  status.className = 'ev-note';
  status.innerHTML = eventState.paylineWon.length
    ? `Improved: <b>${eventState.paylineWon.join(', ')}</b>`
    : (eventState.paylineSpun ? `${eventState.paylineSpun} spins · nothing yet.` : 'Reels idle.');
  wrap.appendChild(status);

  const spin = document.createElement('button');
  spin.className = 'ev-btn';
  spin.id = 'ev-payline-spin';
  spin.textContent = `SPIN · ${priceOf(BAL.the_payline.spin_cost)}`;
  spin.disabled = coins < priceOf(BAL.the_payline.spin_cost);
  spin.onclick = () => paylineSpin();
  wrap.appendChild(spin);

  body.appendChild(wrap);
  setEventConfirm(true);
  document.getElementById('event-confirm').textContent = eventState.paylineSpun ? 'CASH OUT' : 'Confirm';
}

function paylineSpin() {
  const cost = priceOf(BAL.the_payline.spin_cost);
  if (coins < cost) return;
  coins -= cost; updateCoinsUI?.();
  eventState.paylineSpun++;
  const btn = document.getElementById('ev-payline-spin');
  if (btn) btn.disabled = true;
  const host = document.getElementById('ev-payline-reels');
  const grid = slotSpin(eventState.paylineSyms, SLOT_ENT_REELS, 1);
  slotRenderSpin(host, grid, e => `<span class="slot-ent"><span class="se-icon">${e.emoji}</span><span class="se-name">${e.name}</span></span>`,
    () => {
      // One visible row, so the winning-cell index counts back 1, not SLOT_ROWS.
      // Set before resolve, and only here - the reels do not exist any earlier.
      [...host.children].forEach(r => r.dataset.rows = '1');
      paylineResolve(host, grid);
    });
}

function paylineResolve(host, grid) {
  const line = { name:'LINE', rows:[0,0,0] };
  const run = slotLineRun(grid, line, e => e.id);
  const status = document.getElementById('ev-payline-status');
  if (run && run.length >= SLOT_ENT_REELS) {
    const ent = grid[0][0];
    slotLightCells(host, run);
    improveEntity(ent.id);
    const t = (typeof entityTierOf === 'function') ? entityTierOf(ent.id) : 0;
    eventState.paylineWon.push(ent.name);
    if (status) status.innerHTML = `<b>${ent.name} improved · tier ${t}</b>`;
    if (typeof sfxCoin === 'function') try { sfxCoin(); } catch (e) {}
  } else if (status) {
    status.innerHTML = 'No line. Spin again.';
  }
  const btn = document.getElementById('ev-payline-spin');
  if (btn) btn.disabled = coins < priceOf(BAL.the_payline.spin_cost);
  document.getElementById('event-confirm').textContent = 'CASH OUT';
}

function confirmPayline() {
  if (eventState.paylineNone) {
    coins += BAL.the_payline.consolation_credits;
    updateCoinsUI?.();
    showMessage(`+${BAL.the_payline.consolation_credits} credits`, 'var(--gold)');
  } else if (eventState.paylineWon.length) {
    showMessage(`${eventState.paylineWon.length} improved`, 'var(--gold)');
  }
  closeEvent();
}
