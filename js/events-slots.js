// ══════════════════════════════════════════════
// SLOT EVENTS (r197, rebuilt r590) - Card Slots · Entity Slots
// ══════════════════════════════════════════════
// Both on the shared cabinet (js/event-slot-machine.js): fixed reel strips, a
// three-row window, staggered snapping stops; PLAY pulls (r753, the lever is gone).
//
// Card Slots' odds are what the cards make (r764): your own cards, dealt in a
// random order onto the reels, random stops, every row, column and diagonal read
// for a three-card hand. Entity Slots' odds are SET (owner, r590: "edit the
// rolls to achieve this outcome"): a pull first rolls win or lose (1 in 3 at 5
// entities down to 1 in 7 at 14 and more), then picks stops that show exactly
// that; only a row or a diagonal pays (r764). A win is drawn and held a beat
// (the machine's celebrate) before it pays. Pulls cost: Card Slots' first is
// free, then BAL.the_floor.pull; Entity Slots alternate 10 credits and 5 seconds
// off the next round, and need 5 improvable entities.

let slotBuffIdx = 0;   // r197's rotating buff cursor: kept in SAVE_VARS for old saves, unused since r590
const SLOT_LINES_3 = [
  [[0, 0], [0, 1], [0, 2]], [[1, 0], [1, 1], [1, 2]], [[2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0]], [[0, 1], [1, 1], [2, 1]], [[0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 1], [2, 2]], [[2, 0], [1, 1], [0, 2]],
];
// The 3x3 a set of stops shows: grid[row][reel], row 0 the top.
function slotGrid(strips, stops) {
  return [0, 1, 2].map(r => strips.map((s, k) => s[(stops[k] + r - 1 + s.length) % s.length]));
}
function slotLinesWon(grid, lines) {
  return lines.filter(line => { const a = grid[line[0][0]][line[0][1]]; return a && line.every(([r, k]) => grid[r][k].key === a.key); });
}

// No lever (r753): CONFIRM (the PLAY key) pulls; Skip reads Done once you have
// pulled, and waits while the reels turn.
function slotSkipSync(pulls, busy) {
  const b = document.getElementById('event-skip'); if (!b) return;
  b.style.display = 'inline-block'; b.textContent = pulls ? 'Done' : 'Skip'; b.disabled = !!busy;
}
// ══════════════════════════════════════════════
// CARD SLOTS (id 'the_floor')
// ══════════════════════════════════════════════
// r764 (owner): the reels hold your own cards, dealt in a random order across
// the three reels (each card once). The stops are random, so the odds are what
// the cards make: every row, column and diagonal of the 3x3 is read, and a line
// holding a three-card hand (Three of a Kind, Run of 3, and Flush of 3 once
// flushes are unlocked; a wild completes a set) buffs its cards, each once a
// pull. Pairs count only with CARD_SLOT_PAIRS. Measured over 200,000 pulls on
// the 56-card deck: 3-card hands 34% a pull (54% with flushes), 94% with pairs.
const CARD_SLOT_PAIRS = false;
const FLOOR_HAND_WORD = { set: 'SET OF 3', run: 'RUN OF 3', flush: 'FLUSH OF 3', pair: 'PAIR' };
function floorCards() { return everyDeckCard().filter(c => c && c.rank && !c._isSleight && !c._isStone); }
function floorRanks() { return [...new Set(floorCards().filter(c => !isWildCard(c)).map(c => c.rank))]; }   // kept for old callers
function floorHand(cards) {
  const n = cards.filter(c => !isWildCard(c)), w = cards.length - n.length;
  if (n.length && n.every(c => c.rank === n[0].rank) && handIsActive('Three of a Kind')) return { kind: 'set', cards };
  if (!w) {
    const v = n.map(c => RANK_ORDER[c.rank] || 0).sort((x, y) => x - y);
    const run = (v[1] === v[0] + 1 && v[2] === v[1] + 1) || v.join() === '1,12,13';
    if (run && handIsActive('Run of 3')) return { kind: 'run', cards };
    if (n.every(c => c.suit === n[0].suit) && handIsActive('Flush of 3')) return { kind: 'flush', cards };
  }
  if (CARD_SLOT_PAIRS) for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const x = cards[i], y = cards[j];
    if (isWildCard(x) || isWildCard(y) || x.rank === y.rank) return { kind: 'pair', cards: [x, y] };
  }
  return null;
}
function floorFaceHTML(c) {
  if (isWildCard(c)) return `<span class="sl-rank sl-wild">${WILD_RANK}</span>`;
  return `<span class="sl-rank ${typeof suitClass === 'function' ? suitClass(c.suit) : ''}">${c.rank}<i>${c.suit}</i></span>`;
}
function floorPullPrice() { return eventState.floorPulls ? priceOf(BAL.the_floor.pull) : 0; }
function renderFloor() {
  const s = eventState, body = evBodyEl();
  s.floorPulls = 0; s.floorBusy = false;
  body.appendChild(evNote('Any row, column or diagonal holding a three-card hand buffs those cards.'));
  const deal = evShuffle(floorCards().slice()), n = Math.ceil(deal.length / 3);
  s.floorStrips = [0, 1, 2].map(k => deal.slice(k * n, (k + 1) * n).map(c => ({ key: cardId(c), card: c, html: floorFaceHTML(c) })));
  s.floorMachine = evSlotMachine(body, { reels: s.floorStrips, payRow: null, itemW: 56, itemH: 44 });
  s.floorOut = document.createElement('div'); body.appendChild(s.floorOut);
  floorSync();
}
function floorSync() {
  const s = eventState, price = floorPullPrice();
  evConfirmBtn(price ? `PULL · ${creditsTxt(price)}` : 'PULL · FREE', !s.floorBusy && coins >= price);
  slotSkipSync(s.floorPulls, s.floorBusy);
}
function floorPull() {
  const s = eventState;
  if (s.floorBusy) return;
  const price = floorPullPrice();
  if (coins < price) return;
  coins -= price; updateCoinsUI?.();
  s.floorPulls++; s.floorBusy = true; floorSync();
  s.floorOut.innerHTML = '';
  const stops = s.floorStrips.map(st => Math.floor(Math.random() * st.length));
  const grid = slotGrid(s.floorStrips, stops);
  const wins = SLOT_LINES_3.map(line => ({ line, hand: floorHand(line.map(([r, k]) => grid[r][k].card)) })).filter(w => w.hand);
  // A near miss: two touching cards on a row or diagonal through the first two reels share a rank.
  const near = SLOT_LINES_3.find(l => l[0][1] === 0 && l[1][1] === 1 && grid[l[0][0]][0].card.rank === grid[l[1][0]][1].card.rank);
  s.floorMachine.spin(stops, { tease: wins.length > 0 || !!near }).then(() => {
    if (!wins.length) {
      if (near) s.floorMachine.flash(near.slice(0, 2), 'evt-sym-near');
      s.floorBusy = false; floorSync(); return;
    }
    return s.floorMachine.celebrate(wins.map(w => w.line)).then(() => {
      const done = new Set(), lines = [];
      wins.forEach(w => {
        const got = [];
        w.hand.cards.forEach(c => {
          if (isWildCard(c) || done.has(cardId(c))) return;
          done.add(cardId(c));
          const b = rollBuffs(1, { event: true })[0];
          if (b) { enhanceCardKey(cardId(c), b.e); got.push(`${c.rank}${c.suit} ${b.label}`); }
        });
        if (got.length) lines.push(`${FLOOR_HAND_WORD[w.hand.kind]} · ${got.join(', ')}`);
      });
      const res = document.createElement('div'); res.className = 'evt-big win';
      res.textContent = `${done.size} CARD${done.size === 1 ? '' : 'S'} BUFFED`;
      s.floorOut.appendChild(res);
      lines.forEach(t => s.floorOut.appendChild(evNote(t)));
      evReveal(res);
      _etSfx('sfxRewardGood');
      s.floorBusy = false; floorSync();
    });
  });
}
function confirmFloor() { floorPull(); }

// ══════════════════════════════════════════════
// ENTITY SLOTS (id 'the_payline')
// ══════════════════════════════════════════════
const ENTITY_SLOT_MIN = 5;
function paylineWinChance(n) {
  const hi = 1 / 3, lo = 1 / 7;
  return Math.max(lo, Math.min(hi, hi - (n - ENTITY_SLOT_MIN) * (hi - lo) / 9));
}
// r764 (owner): a row or a diagonal pays, never a column. Each reel its own fixed
// order, every entity in a block of 1 or 2, so a column can never show three alike.
const PAYLINE_LINES = SLOT_LINES_3.filter(l => !l.every(([, k]) => k === l[0][1]));
function paylineStrip(ents) {
  const out = [];
  evShuffle(ents.slice()).forEach(e => { const len = 1 + (Math.random() < 0.4 ? 1 : 0); for (let k = 0; k < len; k++) out.push(e); });
  return out;
}
function paylineCost(pull) { return pull % 2 === 0 ? { credits: priceOf(BAL.the_payline.spin_cost) } : { seconds: BAL.the_payline.spin_secs }; }
function paylineCostText(c) { return c.credits ? creditsTxt(c.credits) : `${c.seconds}s`; }
function renderPayline() {
  const s = eventState, body = evBodyEl();
  const ents = evImprovables();
  if (!eventEligible('the_payline')) { body.innerHTML = evEmptyHTML('Not enough to put on the reels.'); s.plNone = true; setEventConfirm(true); return; }
  s.plPulls = 0; s.plBusy = false;
  const syms = ents.map(e => ({ key: e.id, ent: e, html: `<div class="sl-ent">${entityTileHTML({ entity: e.kind, id: e.id, emoji: e.emoji, label: e.name }, e.rarity || 'common', { tip: false })}</div>` }));
  s.plStrips = [0, 1, 2].map(() => paylineStrip(syms));
  s.plChance = paylineWinChance(ents.length);
  body.appendChild(evNote('Three alike in a row or a diagonal improves that entity.'));
  s.plMachine = evSlotMachine(body, { reels: s.plStrips, payRow: null, itemW: 54, itemH: 60 });
  if (typeof fitRewardName === 'function') requestAnimationFrame(() => s.plMachine.el.querySelectorAll('.rwd-name').forEach(fitRewardName));
  s.plOut = document.createElement('div'); body.appendChild(s.plOut);
  paylineSync();
}
function paylineSync() {
  const s = eventState, c = paylineCost(s.plPulls);
  const can = !s.plBusy && (!c.credits || coins >= c.credits);
  evConfirmBtn(`PULL · ${paylineCostText(c)}`, can);
  slotSkipSync(s.plPulls, s.plBusy);
}
function paylinePull() {
  const s = eventState;
  if (s.plBusy) return;
  const c = paylineCost(s.plPulls);
  if (c.credits) { if (coins < c.credits) return; coins -= c.credits; updateCoinsUI?.(); }
  else {
    // The seconds come off the next round; in Flow (one running clock) off this one.
    if (typeof flowActive === 'function' && flowActive()) { roundSeconds = Math.max(1, roundSeconds - c.seconds); updateClockUI?.(); }
    else nextRoundSecondsDelta -= c.seconds;
  }
  s.plPulls++; s.plBusy = true; paylineSync();
  s.plOut.innerHTML = '';
  const win = Math.random() < s.plChance;
  let stops = null;
  for (let tries = 0; tries < 3000 && !stops; tries++) {
    const st = s.plStrips.map(strip => Math.floor(Math.random() * strip.length));
    const won = slotLinesWon(slotGrid(s.plStrips, st), PAYLINE_LINES).length > 0;
    if (won === win) stops = st;
  }
  if (!stops) stops = s.plStrips.map(() => 0);
  const grid = slotGrid(s.plStrips, stops), lines = slotLinesWon(grid, PAYLINE_LINES);
  // Tease when two reels already hold a line's first two symbols and the last decides it.
  const tease = lines.length > 0 || PAYLINE_LINES.some(l => l[0][1] === 0 && l[1][1] === 1 && grid[l[0][0]][0].key === grid[l[1][0]][1].key);
  s.plMachine.spin(stops, { tease }).then(() => {
    if (!lines.length) { s.plBusy = false; paylineSync(); return; }
    // r764: the winning line is drawn and held a beat; the improvement comes after.
    return s.plMachine.celebrate([lines[0]]).then(() => {
      const e = grid[lines[0][0][0]][lines[0][0][1]].ent;
      improveEntity(e.id);
      if (typeof syncOwnedEntityDescs === 'function') syncOwnedEntityDescs();
      const res = document.createElement('div'); res.className = 'evt-big win';
      res.textContent = `${e.name.toUpperCase()} · v${entityTierOf(e.id) + 1}.0`;
      s.plOut.appendChild(res); evReveal(res);
      s.plBusy = false; paylineSync();
    });
  });
}
function confirmPayline() { if (eventState.plNone) closeEvent(); else paylinePull(); }
