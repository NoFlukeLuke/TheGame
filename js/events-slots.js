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
// that; rows, columns and diagonals pay (r775). A win is drawn and held a beat
// (the machine's scan, r775) before it pays. Pulls cost the same in both
// (slotPullPrice: the first free, then 15 20 25 30 40 50...), and four winning
// pulls close the machine. Entity Slots need 5 improvable entities.

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
// r775 (owner): the price of the next pull, `pulls` being the pulls made so far.
// The first is free; repulls 15, 20, 25, 30, then +10 each (BAL.slot_pulls).
function slotPullPrice(pulls) {
  const B = BAL.slot_pulls;
  if (!pulls) return 0;
  const i = pulls - 1;
  return B.first + B.step * Math.min(i, B.steps) + B.step2 * Math.max(0, i - B.steps);
}
// The machine closes after BAL.slot_pulls.max_wins winning pulls.
function slotWinsLeft(wins) { return Math.max(0, BAL.slot_pulls.max_wins - (wins || 0)); }
function slotPullLabel(price, wins) {
  if (!slotWinsLeft(wins)) return 'NO MORE PULLS';
  return price ? `PULL · ${creditsTxt(price)}` : 'PULL · FREE';
}
// 3+ paying lines double what each pays, 5+ multiply it by five.
function slotLineMult(n) { return n >= 5 ? 5 : n >= 3 ? 2 : 1; }
function slotClosedNote(out) {
  out.appendChild(evNote(`${BAL.slot_pulls.max_wins} wins. The machine takes no more pulls.`));
}
// ══════════════════════════════════════════════
// CARD SLOTS (id 'the_floor')
// ══════════════════════════════════════════════
// r764 (owner): the reels hold your own cards, dealt in a random order across
// the three reels (each card once). The stops are random, so the odds are what
// the cards make: every row, column and diagonal of the 3x3 is read, and a line
// holding a three-card hand (Three of a Kind, Run of 3; a wild completes a set)
// buffs its cards, each once a pull. r775 (owner): a Flush of 3 counts only with
// the Short Suit knack; no pairs. Measured over 200,000 pulls on the 56-card
// deck: 34% of pulls pay (54% with flushes).
const FLOOR_HAND_WORD = { set: 'SET OF 3', run: 'RUN OF 3', flush: 'FLUSH OF 3' };
function floorCards() { return everyDeckCard().filter(c => c && c.rank && !c._isSleight && !c._isStone); }
function floorRanks() { return [...new Set(floorCards().filter(c => !isWildCard(c)).map(c => c.rank))]; }   // kept for old callers
function floorFlushOn() { return typeof hasKnack === 'function' && hasKnack('short_suit'); }
function floorHand(cards) {
  const n = cards.filter(c => !isWildCard(c)), w = cards.length - n.length;
  if (n.length && n.every(c => c.rank === n[0].rank) && handIsActive('Three of a Kind')) return { kind: 'set', cards };
  if (!w) {
    const v = n.map(c => RANK_ORDER[c.rank] || 0).sort((x, y) => x - y);
    const run = (v[1] === v[0] + 1 && v[2] === v[1] + 1) || v.join() === '1,12,13';
    if (run && handIsActive('Run of 3')) return { kind: 'run', cards };
    if (floorFlushOn() && n.every(c => c.suit === n[0].suit)) return { kind: 'flush', cards };
  }
  return null;
}
function floorFaceHTML(c) {
  if (isWildCard(c)) return `<span class="sl-rank sl-wild">${WILD_RANK}</span>`;
  return `<span class="sl-rank ${typeof suitClass === 'function' ? suitClass(c.suit) : ''}">${c.rank}<i>${c.suit}</i></span>`;
}
function floorPullPrice() { return slotPullPrice(eventState.floorPulls); }
function renderFloor() {
  const s = eventState, body = evBodyEl();
  s.floorPulls = 0; s.floorWins = 0; s.floorBusy = false;
  body.appendChild(evNote(floorFlushOn()
    ? 'Any row, column or diagonal holding a Set of 3, a Run of 3 or a Flush of 3 buffs those cards.'
    : 'Any row, column or diagonal holding a Set of 3 or a Run of 3 buffs those cards.'));
  const deal = evShuffle(floorCards().slice()), n = Math.ceil(deal.length / 3);
  s.floorStrips = [0, 1, 2].map(k => deal.slice(k * n, (k + 1) * n).map(c => ({ key: cardId(c), card: c, html: floorFaceHTML(c) })));
  s.floorMachine = evSlotMachine(body, { reels: s.floorStrips, payRow: null, itemW: 56, itemH: 44 });
  s.floorOut = document.createElement('div'); body.appendChild(s.floorOut);
  floorSync();
}
function floorSync() {
  const s = eventState, price = floorPullPrice();
  evConfirmBtn(slotPullLabel(price, s.floorWins), !s.floorBusy && slotWinsLeft(s.floorWins) > 0 && coins >= price);
  slotSkipSync(s.floorPulls, s.floorBusy);
}
function floorPull() {
  const s = eventState;
  if (s.floorBusy || !slotWinsLeft(s.floorWins)) return;
  const price = floorPullPrice();
  if (coins < price) return;
  coins -= price; updateCoinsUI?.();
  s.floorPulls++; s.floorBusy = true; floorSync();
  s.floorOut.innerHTML = '';
  const stops = s.floorStrips.map(st => Math.floor(Math.random() * st.length));
  const grid = slotGrid(s.floorStrips, stops);
  const hands = SLOT_LINES_3.map(line => floorHand(line.map(([r, k]) => grid[r][k].card)));
  const wins = SLOT_LINES_3.map((line, i) => ({ line, hand: hands[i] })).filter(w => w.hand);
  const mult = slotLineMult(wins.length);
  // A near miss: two touching cards on a row or diagonal through the first two reels share a rank.
  const near = SLOT_LINES_3.find(l => l[0][1] === 0 && l[1][1] === 1 && grid[l[0][0]][0].card.rank === grid[l[1][0]][1].card.rank);
  s.floorMachine.spin(stops, { tease: wins.length > 0 || !!near }).then(() =>
    s.floorMachine.scan(SLOT_LINES_3, hands, { big: `${wins.length} LINES · BUFFS x2`, huge: `${wins.length} LINES · BUFFS x5` })
  ).then(() => {
    if (!wins.length) { s.floorBusy = false; floorSync(); return; }
    s.floorWins++;
    const done = new Set(), lines = [];
    wins.forEach(w => {
      const got = [];
      w.hand.cards.forEach(c => {
        if (isWildCard(c) || done.has(cardId(c))) return;
        done.add(cardId(c));
        const b = rollBuffs(1, { event: true, mult: mult > 1 ? mult : 0 })[0];
        if (b) { enhanceCardKey(cardId(c), b.e); got.push(`${c.rank}${c.suit} ${b.label}`); }
      });
      if (got.length) lines.push(`${FLOOR_HAND_WORD[w.hand.kind]} · ${got.join(', ')}`);
    });
    const res = document.createElement('div'); res.className = 'evt-big win';
    res.textContent = `${done.size} CARD${done.size === 1 ? '' : 'S'} BUFFED${mult > 1 ? ` · x${mult}` : ''}`;
    s.floorOut.appendChild(res);
    lines.forEach(t => s.floorOut.appendChild(evNote(t)));
    if (!slotWinsLeft(s.floorWins)) slotClosedNote(s.floorOut);
    evReveal(res);
    _etSfx('sfxRewardGood');
    s.floorBusy = false; floorSync();
  });
}
function confirmFloor() { floorPull(); }

// ══════════════════════════════════════════════
// ENTITY SLOTS (id 'the_payline')
// ══════════════════════════════════════════════
// r775 (owner): rows, columns and diagonals all pay again. Each reel its own fixed
// order, every entity in a block of 1 or 2 and one entity in a block of 3, so a
// column can show three alike. The odds stay SET (paylineWinChance). Every paying
// line improves its entity once (x2 at 3+ lines, x5 at 5+), up to its last tier.
const ENTITY_SLOT_MIN = 5;
function paylineWinChance(n) {
  const hi = 1 / 3, lo = 1 / 7;
  return Math.max(lo, Math.min(hi, hi - (n - ENTITY_SLOT_MIN) * (hi - lo) / 9));
}
const PAYLINE_LINES = SLOT_LINES_3;
function paylineStrip(ents) {
  const out = [], order = evShuffle(ents.slice()), tri = Math.floor(Math.random() * order.length);
  order.forEach((e, i) => { const len = i === tri ? 3 : 1 + (Math.random() < 0.4 ? 1 : 0); for (let k = 0; k < len; k++) out.push(e); });
  return out;
}
function renderPayline() {
  const s = eventState, body = evBodyEl();
  const ents = evImprovables();
  if (!eventEligible('the_payline')) { body.innerHTML = evEmptyHTML('Not enough to put on the reels.'); s.plNone = true; setEventConfirm(true); return; }
  s.plPulls = 0; s.plWins = 0; s.plBusy = false;
  const syms = ents.map(e => ({ key: e.id, ent: e, html: `<div class="sl-ent">${entityTileHTML({ entity: e.kind, id: e.id, emoji: e.emoji, label: e.name }, e.rarity || 'common', { tip: false })}</div>` }));
  s.plStrips = [0, 1, 2].map(() => paylineStrip(syms));
  s.plChance = paylineWinChance(ents.length);
  body.appendChild(evNote('Three alike in a row, a column or a diagonal improves that entity.'));
  s.plMachine = evSlotMachine(body, { reels: s.plStrips, payRow: null, itemW: 54, itemH: 60 });
  if (typeof fitRewardName === 'function') requestAnimationFrame(() => s.plMachine.el.querySelectorAll('.rwd-name').forEach(fitRewardName));
  s.plOut = document.createElement('div'); body.appendChild(s.plOut);
  paylineSync();
}
function paylineSync() {
  const s = eventState, price = slotPullPrice(s.plPulls);
  evConfirmBtn(slotPullLabel(price, s.plWins), !s.plBusy && slotWinsLeft(s.plWins) > 0 && coins >= price);
  slotSkipSync(s.plPulls, s.plBusy);
}
function paylinePull() {
  const s = eventState;
  if (s.plBusy || !slotWinsLeft(s.plWins)) return;
  const price = slotPullPrice(s.plPulls);
  if (coins < price) return;
  coins -= price; updateCoinsUI?.();
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
  const won = PAYLINE_LINES.map(l => lines.includes(l));
  const mult = slotLineMult(lines.length);
  // Tease when two reels already hold a line's first two symbols and the last decides it.
  const tease = lines.length > 0 || PAYLINE_LINES.some(l => l[0][1] === 0 && l[1][1] === 1 && grid[l[0][0]][0].key === grid[l[1][0]][1].key);
  s.plMachine.spin(stops, { tease }).then(() =>
    s.plMachine.scan(PAYLINE_LINES, won, { big: `${lines.length} LINES · IMPROVE x2`, huge: `${lines.length} LINES · IMPROVE x5` })
  ).then(() => {
    if (!lines.length) { s.plBusy = false; paylineSync(); return; }
    s.plWins++;
    const got = new Map();
    lines.forEach(l => {
      const e = grid[l[0][0]][l[0][1]].ent;
      for (let i = 0; i < mult && canImprove(e.id); i++) { improveEntity(e.id); got.set(e, (got.get(e) || 0) + 1); }
    });
    if (typeof syncOwnedEntityDescs === 'function') syncOwnedEntityDescs();
    if (!got.size) s.plOut.appendChild(evNote('Already at its last improvement.'));
    got.forEach((n, e) => {
      const res = document.createElement('div'); res.className = 'evt-big win';
      res.textContent = `${e.name.toUpperCase()} · v${entityTierOf(e.id) + 1}.0${n > 1 ? ` · +${n}` : ''}`;
      s.plOut.appendChild(res);
    });
    if (!slotWinsLeft(s.plWins)) slotClosedNote(s.plOut);
    if (s.plOut.firstChild) evReveal(s.plOut.firstChild);
    s.plBusy = false; paylineSync();
  });
}
function confirmPayline() { if (eventState.plNone) closeEvent(); else paylinePull(); }
