// ══════════════════════════════════════════════
// SLOT EVENTS (r197, rebuilt r590) - Card Slots · Entity Slots
// ══════════════════════════════════════════════
// Both on the shared cabinet (js/event-slot-machine.js): fixed reel strips, a
// three-row window, staggered snapping stops and a lever to pull.
//
// THE ODDS ARE SET, NOT EMERGENT (owner: "edit the rolls to achieve this
// outcome"). Each pull first rolls win or lose at the event's chance, then picks
// reel stops that show exactly that: a win's stops make a line, a loss's stops
// make none. The strips only decide what a result looks like.
//
//   Card Slots   - three reels of the ranks your deck holds (a rank with no
//                  card is left off), the same order on every reel; only the
//                  middle row counts. Three alike (CARD_SLOT_WIN, 1 in 7) buffs
//                  every card of that rank in your deck with a random buff at
//                  event strength. The first pull is free, then each costs.
//   Entity Slots - three reels of your improvable Tricks, Knacks and Sleights,
//                  each reel its own fixed order with some entities in runs
//                  (so a column can match). Three alike on any row, column or
//                  diagonal improves that entity a tier. The chance falls from
//                  1 in 3 at 5 entities to 1 in 7 at 14 and more. Pulls cost
//                  10 credits and 5 seconds off the next round, alternately.
//                  Needs 5 improvable entities.

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

// ══════════════════════════════════════════════
// CARD SLOTS (id 'the_floor')
// ══════════════════════════════════════════════
const CARD_SLOT_WIN = 1 / 7;
function floorRanks() {
  const val = r => r === 'A' ? 14 : (RANK_ORDER[r] || 0);
  return [...new Set(everyDeckCard().filter(c => !isWildCard(c)).map(c => c.rank))].sort((a, b) => val(b) - val(a));
}
function floorPullPrice() { return eventState.floorPulls ? priceOf(BAL.the_floor.pull) : 0; }
function renderFloor() {
  const s = eventState, body = evBodyEl();
  const ranks = floorRanks();
  s.floorPulls = 0; s.floorBusy = false;
  body.appendChild(evNote('Spin for a chance to buff a rank! If you win, buff each card of the winning rank in your deck with a random buff.'));
  const strip = ranks.map(r => ({ key: r, html: `<span class="sl-rank">${r}</span>` }));
  s.floorStrip = strip;
  s.floorMachine = evSlotMachine(body, { reels: [strip, strip, strip], payRow: 1, itemW: 56, itemH: 44, onPull: floorPull });
  s.floorOut = document.createElement('div'); body.appendChild(s.floorOut);
  floorSync();
}
function floorSync() {
  const s = eventState, price = floorPullPrice();
  s.floorMachine.lever(!s.floorBusy && coins >= price, price ? `PULL · ${price}` : 'PULL · FREE');
  evConfirmBtn('DONE', !s.floorBusy);
  setEventConfirm(!s.floorBusy);
  const skip = document.getElementById('event-skip'); if (skip) skip.style.display = s.floorPulls ? 'none' : 'inline-block';
}
function floorPull() {
  const s = eventState;
  if (s.floorBusy) return;
  const price = floorPullPrice();
  if (coins < price) return;
  coins -= price; updateCoinsUI?.();
  s.floorPulls++; s.floorBusy = true; floorSync();
  s.floorOut.innerHTML = '';
  const n = s.floorStrip.length, win = Math.random() < CARD_SLOT_WIN;
  let stops;
  if (win || n < 2) { const i = Math.floor(Math.random() * n); stops = [i, i, i]; }
  else do { stops = [0, 1, 2].map(() => Math.floor(Math.random() * n)); } while (stops[0] === stops[1] && stops[1] === stops[2]);
  const tease = stops[0] === stops[1];
  s.floorMachine.spin(stops, { tease }).then(() => {
    const rank = s.floorStrip[stops[1]].key;
    if (stops[0] === stops[1] && stops[1] === stops[2]) {
      s.floorMachine.flash([[1, 0], [1, 1], [1, 2]]);
      const cards = everyDeckCard().filter(c => !isWildCard(c) && c.rank === rank);
      cards.forEach(c => { const b = rollBuffs(1, { event: true })[0]; if (b) enhanceCardKey(cardId(c), b.e); });
      const res = document.createElement('div'); res.className = 'evt-big win';
      res.textContent = `${cards.length} × ${rank} BUFFED`;
      s.floorOut.appendChild(res); evReveal(res);
      _etSfx('sfxChallengeWin');
    } else if (tease) {
      s.floorMachine.flash([[1, 0], [1, 1]], 'evt-sym-near');
    }
    s.floorBusy = false; floorSync();
  });
}
function confirmFloor() { if (!eventState.floorBusy) closeEvent(); }

// ══════════════════════════════════════════════
// ENTITY SLOTS (id 'the_payline')
// ══════════════════════════════════════════════
const ENTITY_SLOT_MIN = 5;
function paylineWinChance(n) {
  const hi = 1 / 3, lo = 1 / 7;
  return Math.max(lo, Math.min(hi, hi - (n - ENTITY_SLOT_MIN) * (hi - lo) / 9));
}
// Each reel its own fixed order: every entity in a block of 1 or 2, and at least
// one block of 3 so a column can line up.
function paylineStrip(ents) {
  const order = evShuffle(ents.slice()), triple = Math.floor(Math.random() * order.length);
  const out = [];
  order.forEach((e, i) => { const len = i === triple ? 3 : 1 + (Math.random() < 0.4 ? 1 : 0); for (let k = 0; k < len; k++) out.push(e); });
  return out;
}
function paylineCost(pull) { return pull % 2 === 0 ? { credits: priceOf(BAL.the_payline.spin_cost) } : { seconds: BAL.the_payline.spin_secs }; }
function paylineCostText(c) { return c.credits ? `${c.credits} credits` : `${c.seconds}s`; }
function renderPayline() {
  const s = eventState, body = evBodyEl();
  const ents = evImprovables();
  if (!eventEligible('the_payline')) { body.innerHTML = evEmptyHTML('Not enough to put on the reels.'); s.plNone = true; setEventConfirm(true); return; }
  s.plPulls = 0; s.plBusy = false;
  const syms = ents.map(e => ({ key: e.id, ent: e, html: `<div class="sl-ent">${entityTileHTML({ entity: e.kind, id: e.id, emoji: e.emoji, label: e.name }, e.rarity || 'common', { tip: false })}</div>` }));
  s.plStrips = [0, 1, 2].map(() => paylineStrip(syms));
  s.plChance = paylineWinChance(ents.length);
  body.appendChild(evNote('Three alike in a row, a column or a diagonal improves that entity.'));
  s.plMachine = evSlotMachine(body, { reels: s.plStrips, payRow: null, itemW: 54, itemH: 60, onPull: paylinePull });
  if (typeof fitRewardName === 'function') requestAnimationFrame(() => s.plMachine.el.querySelectorAll('.rwd-name').forEach(fitRewardName));
  s.plOut = document.createElement('div'); body.appendChild(s.plOut);
  paylineSync();
}
function paylineSync() {
  const s = eventState, c = paylineCost(s.plPulls);
  const can = !s.plBusy && (!c.credits || coins >= c.credits);
  s.plMachine.lever(can, `PULL · ${paylineCostText(c)}`);
  evConfirmBtn('DONE', !s.plBusy);
  const skip = document.getElementById('event-skip'); if (skip) skip.style.display = s.plPulls ? 'none' : 'inline-block';
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
    const won = slotLinesWon(slotGrid(s.plStrips, st), SLOT_LINES_3).length > 0;
    if (won === win) stops = st;
  }
  if (!stops) stops = s.plStrips.map(() => 0);
  const grid = slotGrid(s.plStrips, stops), lines = slotLinesWon(grid, SLOT_LINES_3);
  // Tease when two reels already hold a line's first two symbols and the last decides it.
  const tease = lines.length > 0 || SLOT_LINES_3.some(l => l[0][1] === 0 && l[1][1] === 1 && grid[l[0][0]][0].key === grid[l[1][0]][1].key);
  s.plMachine.spin(stops, { tease }).then(() => {
    if (lines.length) {
      const e = grid[lines[0][0][0]][lines[0][0][1]].ent;
      s.plMachine.flash(lines[0]);
      improveEntity(e.id);
      if (typeof syncOwnedEntityDescs === 'function') syncOwnedEntityDescs();
      const res = document.createElement('div'); res.className = 'evt-big win';
      res.textContent = `${e.name.toUpperCase()} · v${entityTierOf(e.id) + 1}.0`;
      s.plOut.appendChild(res); evReveal(res);
      _etSfx('sfxChallengeWin');
    }
    s.plBusy = false; paylineSync();
  });
}
function confirmPayline() { if (!eventState.plBusy) closeEvent(); }
