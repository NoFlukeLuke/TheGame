// ── SIDE PROJECTS (r833, owner: the Schedule's chunk 4) ──────────────────────
// Two linked rounds on the Schedule, framed together: the first in one slot, the
// second in the same lane of the next. Book the first and its COST starts; book
// and clear the second and the cost ends and it PAYS. Leave the second's slot
// without booking it and you keep the cost you paid and take a PENALTY. Never
// book the first and nothing happens.
//   - Dealt at map build (`spDeal`, from mapGenerate): SIDE_CFG.chance % of
//     quarters, SIDE_CFG.max a run (`mapSideLog`, quarter -> 1). Both halves are
//     plain one-cell rounds (an account, a priority, an audit or a one-on-one),
//     never a mystery; in Q1 the first half is never slot 1 (round 1 rides
//     startGame's deal).
//   - `mapSide` (SAVE_VARS) is the quarter's project: the two tile ids, the cost,
//     the reward, the penalty, its state (idle / run / done / gone / skip) and
//     what the cost has taken (`war` stone ids, `cut` Selection Size).
//   - The cost applies to the two halves' own levels (`spCostLive`), or to every
//     level until the review once COST STAYS was the penalty. Readers:
//     mapApplyPendingGoal (goal), triggerLevelUp's `spRoundStart` (seconds,
//     stock, Selection Size), addFocus (`spFocusScale`), miniBossMaybeStart
//     (`spMiniNow`). War cards go in the deck when the first half is booked.
//   - The reward is paid from mapAfterLevel (`spAfterLevel`), before the level's
//     own reward. The penalty from mapConfirm (`spOnBook`).
// Every weighted roll here is in PROB_TABLES ('sidecfg', 'sidecost', 'sidepay',
// 'sidepen').
const SIDE_CFG = { chance: 25, max: 2 };
const SIDE_COST_W = { goal: 10, time: 10, stock: 10, hand: 10, focus: 10, boss: 10, war: 10 };
const SIDE_PAY_W  = { tricks: 10, permaprime: 10, tiers: 10, knacks: 10, credits: 10, slot: 10 };
const SIDE_PEN_W  = { review: 10, credits: 10, tier: 10, stays: 10 };
const SIDE_GOAL = 1.15, SIDE_SECS = 20, SIDE_WAR = 3, SIDE_CREDITS = 40, SIDE_PEN_CREDITS = 20, SIDE_REVIEW = 1.1;

let mapSide = null;        // this quarter's side project, or null
let mapSideLog = {};       // quarters that dealt one (quarter number -> 1)
let _spFocusRem = 0;       // the half a Focus point FOCUS ½ carries to the next gain

const SIDE_COSTS = {
  goal:  { short: 'GOAL +15%',    say: () => 'the two levels ask 15% more' },
  time:  { short: '-20s',         say: () => `the two levels start ${SIDE_SECS} seconds short` },
  stock: { short: 'STOCK -1', say: () => 'one swap and one discard fewer in the two levels' },
  hand:  { short: 'HAND -1',      say: () => 'Selection Size is one smaller in the two levels' },
  focus: { short: 'FOCUS ½',      say: () => 'Focus builds half as fast in the two levels' },
  boss:  { short: 'HALF BOSS',  say: s => `a boss effect at half strength in the two levels: ${(spMiniDef(s) || {}).label || 'a handicap'}` },
  war:   { short: `+${SIDE_WAR} WAR`, say: () => `${SIDE_WAR} War cards go in the deck until it ends` },
};
const SIDE_PAYS = {
  tricks:     { short: 'EPIC TRICK',    say: () => 'pick 1 of 3 Tricks, epic or better', can: () => !(typeof trickTrayFull === 'function' && trickTrayFull()) },
  permaprime: { short: 'PERMAPRIME',    say: () => 'permaprime a Trick you pick', can: () => typeof trickTray !== 'undefined' && trickTray.length > 0 },
  tiers:      { short: '+2 TIERS',      say: () => 'improve something you pick, twice', can: () => typeof evImprovables === 'function' && evImprovables().length > 0 },
  knacks:     { short: 'RARE KNACK',    say: () => 'pick 1 of 3 Knacks, rare or better', can: () => true },
  credits:    { short: creditsTxt(SIDE_CREDITS), say: () => `${SIDE_CREDITS} credits`, can: () => true },
  slot:       { short: 'TRICK SLOT', say: () => 'one more Trick slot', can: () => limits.trick_slots.current < limits.trick_slots.max },
};
const SIDE_PENS = {
  review:  { short: 'REVIEW +10%', say: () => 'this quarter’s review asks 10% more' },
  credits: { short: '-' + creditsTxt(SIDE_PEN_CREDITS), say: () => `you lose ${SIDE_PEN_CREDITS} credits` },
  tier:    { short: '-1 TIER',     say: () => 'something you improved loses an improvement' },
  stays:   { short: 'COST STAYS',  say: () => 'the cost lasts until the review' },
};

function _spRoll(W, ok) {
  const ids = Object.keys(W).filter(k => (W[k] || 0) > 0 && (!ok || ok(k)));
  let r = Math.random() * ids.reduce((a, k) => a + W[k], 0);
  for (const k of ids) { r -= W[k]; if (r < 0) return k; }
  return ids[ids.length - 1] || null;
}
function spTile(id) { return mapTiles.find(t => t.id === id) || null; }
function spIsHalf(t) { return !!(mapSide && t && (t.id === mapSide.a || t.id === mapSide.b)); }
function spMiniDef(s) { return (s && s.mini && typeof CHALLENGE_DEFS !== 'undefined') ? CHALLENGE_DEFS.find(d => d.id === s.mini) : null; }

// ── Dealing ───────────────────────────────────────────────────────────────────
function _spRoundTile(t) {
  return !!t && (t.kind === 'level' || t.kind === 'challenge') && !t.mystery && !(t.cols > 1) && t.span !== 2;
}
// The pairs a project can sit on: a round, and a round in the same lane one slot down.
function spPairs(q) {
  const first = q <= 1 ? 1 : 0, out = [];
  mapTiles.forEach(a => {
    if (!_spRoundTile(a) || a.set < first || a.set >= MAP_SETS - 1) return;
    const b = mapTiles.find(x => x.lane === a.lane && x.set === a.set + 1 && _spRoundTile(x));
    if (b) out.push([a, b]);
  });
  return out;
}
function spDeal() {
  mapSide = null;
  if (!mapActive()) return;
  const q = mapQuarterNo();
  if (!mapSideLog || typeof mapSideLog !== 'object') mapSideLog = {};
  delete mapSideLog[q];
  if (Object.keys(mapSideLog).length >= SIDE_CFG.max) return;
  if (Math.random() * 100 >= SIDE_CFG.chance) return;
  const pairs = spPairs(q);
  if (!pairs.length) return;
  const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
  const minis = (typeof CHALLENGE_DEFS !== 'undefined') ? CHALLENGE_DEFS.filter(d => d.mini) : [];
  // A one-on-one already carries a boss effect, and one round holds one.
  const cost = _spRoll(SIDE_COST_W, k => k !== 'boss' || (minis.length && !mapTileIsMini(a) && !mapTileIsMini(b)));
  mapSide = { a: a.id, b: b.id, cost, pay: _spRoll(SIDE_PAY_W), pen: _spRoll(SIDE_PEN_W), state: 'idle', q,
              mini: cost === 'boss' ? minis[Math.floor(Math.random() * minis.length)].id : null, war: [], cut: 0, stays: false };
  mapSideLog[q] = 1;
}

// ── The cost ─────────────────────────────────────────────────────────────────
// The cost on the level being played now, or null.
function spCostLive() {
  const s = mapSide;
  if (!s || !mapActive() || mapBossArmed) return null;
  const t = spTile(mapPosTileId);
  if (!t || !(t.kind === 'level' || t.kind === 'challenge')) return null;
  if (s.state === 'run' && (t.id === s.a || t.id === s.b)) return s.cost;
  if (s.state === 'gone' && s.stays && t.visited) return s.cost;
  return null;
}
// What the cost does to a goal the list prints, for a round you have not booked yet.
function spGoalMultFor(t) {
  const s = mapSide;
  if (!s || s.cost !== 'goal' || !t || t.visited || !(t.kind === 'level' || t.kind === 'challenge')) return 1;
  if ((s.state === 'idle' || s.state === 'run') && spIsHalf(t)) return SIDE_GOAL;
  if (s.state === 'gone' && s.stays) return SIDE_GOAL;
  return 1;
}
// From mapApplyPendingGoal, after the curve and a hard round's raise.
function spApplyGoal() {
  if (spCostLive() === 'goal') roundGoal = Math.round(roundGoal * SIDE_GOAL / 50) * 50;
}
// From triggerLevelUp, once the level's seconds and stock are set.
function spRoundStart() {
  spRestoreHand();
  const c = spCostLive();
  if (!c) return;
  if (c === 'time') roundSeconds = Math.max(10, roundSeconds - SIDE_SECS);
  if (c === 'stock') { swaps = Math.max(0, swaps - 1); discards = Math.max(0, discards - 1); }
  if (c === 'hand' && limits.selection.current > 2) { limits.selection.current -= 1; mapSide.cut = 1; }
  if (c === 'focus') _spFocusRem = 0;
}
// Selection Size is put back as the level ends (mapAfterLevel), and before the next one.
function spRestoreHand() {
  if (!mapSide || !mapSide.cut) return;
  limits.selection.current += mapSide.cut;
  mapSide.cut = 0;
  if (typeof updateSelectionUI === 'function') updateSelectionUI();
}
// addFocus: FOCUS ½ halves every gain, carrying the half point to the next one.
function spFocusScale(amount) {
  if (spCostLive() !== 'focus' || (typeof roundEnded !== 'undefined' && roundEnded)) return amount;
  const v = amount / 2 + _spFocusRem, n = Math.floor(v);
  _spFocusRem = v - n;
  return n;
}
// miniBossMaybeStart: HALF A BOSS is a one-on-one's handicap on an ordinary round.
function spMiniNow() {
  const d = spCostLive() === 'boss' ? spMiniDef(mapSide) : null;
  return d ? d.mini : null;
}
function spWarIn() {
  const s = mapSide; if (!s) return;
  for (let i = 0; i < SIDE_WAR; i++) {
    const st = stampId(makeStoneCard());
    s.war.push(st._id);
    drawPile.splice(Math.floor(Math.random() * (drawPile.length + 1)), 0, st);
  }
  if (typeof updateDeckHud === 'function') updateDeckHud();
}
function spWarOut() {
  const s = mapSide; if (!s || !s.war || !s.war.length) return;
  const ids = new Set(s.war);
  drawPile = drawPile.filter(c => !(c && ids.has(c._id)));
  playedPile = playedPile.filter(c => !(c && ids.has(c._id)));
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (cd && ids.has(cd._id)) gridData[r][c] = drawCard() || null;
  }
  s.war = [];
  if (typeof updateDeckHud === 'function') updateDeckHud();
}
// A quarter ends: what its project still holds is let go (COST STAYS lasts to the review).
function spQuarterEnd() {
  if (!mapSide) return;
  spRestoreHand();
  spWarOut();
}

// ── Booking: started, walked away, missed ────────────────────────────────────
// From mapConfirm, before the tile is marked visited. `after` is the move's slot state.
function spOnBook(t, after) {
  const s = mapSide; if (!s || !t) return;
  const a = spTile(s.a), b = spTile(s.b);
  if (!a || !b) return;
  if (s.state === 'idle') {
    if (t.id === s.a) {
      s.state = 'run';
      if (s.cost === 'war') spWarIn();
      showMessage(`Side project started · ${SIDE_COSTS[s.cost].short} until the second is cleared`, 'var(--gold)');
    } else if (t.set > a.set || t.id === s.b) s.state = 'skip';
    return;
  }
  if (s.state !== 'run' || t.id === s.b) return;
  // Leaving the second's slot without it, or filling that slot with something else.
  if (t.set > b.set || (t.set === b.set && after && after.visits >= mapSlotCap())) spWalkAway();
}
function spWalkAway() {
  const s = mapSide; if (!s) return;
  s.state = 'gone';
  let pen = s.pen;
  if (pen === 'tier' && !(typeof CRR !== 'undefined' && CRR.improve.penCan())) pen = 'credits';
  let said = SIDE_PENS[pen].say(s);
  if (pen === 'review') mapBossGoal = Math.round(Number(mapBossGoal || 0) * SIDE_REVIEW / 50) * 50;
  else if (pen === 'credits') { coins = Math.max(0, coins - SIDE_PEN_CREDITS); if (typeof updateCoinsUI === 'function') updateCoinsUI(); }
  else if (pen === 'tier') said = CRR.improve.take() || said;
  else if (pen === 'stays') s.stays = true;
  if (!s.stays) spWarOut();
  showMessage(`Side project dropped · ${said}`, 'var(--red)');
}

// ── The reward ───────────────────────────────────────────────────────────────
// From mapAfterLevel. True when it took over: `then` runs once the reward is paid.
function spAfterLevel(t, then) {
  spRestoreHand();
  const s = mapSide;
  if (!s || s.state !== 'run' || !t || t.id !== s.b) return false;
  s.state = 'done';
  spWarOut();
  let pay = s.pay;
  if (!SIDE_PAYS[pay].can()) pay = 'credits';
  showMessage(`Side project done · ${SIDE_PAYS[pay].say(s)}`, '#94ecb0');
  try { sfxRewardTaken?.(); } catch (e) {}
  const next = () => then();
  switch (pay) {
    case 'tricks': crrKindPick({ kind: 'tricks', floor: 'epic' }, next); break;
    case 'knacks': crrKindPick({ kind: 'knacks', floor: 'rare' }, next); break;
    case 'tiers':  crrKindPick({ kind: 'improve', times: 2 }, next); break;
    case 'permaprime': spPermaprimePick(next); break;
    case 'slot':   incrementLimit('trick_slots'); if (typeof renderTrickTray === 'function') renderTrickTray(); next(); break;
    default:       coins += SIDE_CREDITS; if (typeof updateCoinsUI === 'function') updateCoinsUI(); next();
  }
  return true;
}
// Pick 1 of up to 3 of your own Tricks to permaprime.
function spPermaprimePick(done) {
  const pool = shuffle(trickTray.filter(tr => tr && tr.id)).slice(0, 3);
  if (!pool.length || typeof openGridPick !== 'function') { done(); return; }
  openGridPick({
    title: 'PERMAPRIME', tone: 'reward',
    offers: pool.map(tr => ({ entity: 'trick', id: tr.id, emoji: (typeof trickEmoji === 'function') ? trickEmoji(tr) : '✦',
      icon: (typeof trickEmoji === 'function') ? trickEmoji(tr) : '✦', label: tr.name,
      desc: 'Fires once more every time, for good.', rarity: tr.rarity || tr.tier, tag: 'TRICK' })),
    actions: [],
    onChoose: i => { permaprimeTrick(pool[i]); noteMessage(`${pool[i].name} is permaprimed`); done(); },
    onSkip: () => done(),
  });
}

// ── Words ────────────────────────────────────────────────────────────────────
function spStateWord(s) {
  return { idle: '2 TO GO', run: '1 TO GO', done: 'DONE', gone: 'DROPPED', skip: 'MISSED' }[s.state] || '';
}
// The line a half adds to its description (the toolbar, the tile's title).
function spDescFor(t) {
  const s = mapSide;
  if (!s || !spIsHalf(t)) return '';
  const c = SIDE_COSTS[s.cost].say(s), p = SIDE_PAYS[s.pay].say(s), n = SIDE_PENS[s.pen].say(s);
  if (s.state === 'done') return `Side project done: ${p}.`;
  if (s.state === 'gone') return `Side project dropped: ${n}.`;
  if (s.state === 'skip') return 'Side project missed.';
  const first = t.id === s.a;
  return `Side project, ${first ? 'first' : 'second'} half. Cost while it runs: ${c}. Pays when both are cleared: ${p}. Leaving the second's slot without it: ${n}.`;
}
// The ? card's row while this quarter has one.
function spHelpRow() {
  if (!mapSide) return null;
  return ['Side project', 'Two linked levels in one lane, framed. Book the first and its cost starts. Clear the second and it pays. Leave the second’s slot without booking it and you take a penalty.'];
}
// The frame round the two halves (mapRender): a grid item over both cells.
function spFrameEl() {
  const s = mapSide; if (!s) return null;
  const a = spTile(s.a), b = spTile(s.b); if (!a || !b) return null;
  const el = document.createElement('div');
  el.className = 'mt-spframe sp-' + s.state;
  el.style.gridRow = (a.set + 1) + ' / span 2';
  el.style.gridColumn = String(a.lane + 2);
  el.innerHTML = `<span class="sp-tab">SIDE PROJECT</span><span class="sp-count">${spStateWord(s)}</span>`;
  return el;
}
// The line a half prints under its stake: the cost on the first, the reward on the second
// (10 characters at most: a lane holds about that many).
function spTileLine(t) {
  const s = mapSide;
  if (!s || !spIsHalf(t) || s.state === 'skip') return '';
  return t.id === s.a
    ? `<span class="mt-stake mt-sp-cost">${SIDE_COSTS[s.cost].short}</span>`
    : `<span class="mt-stake mt-sp-pay">${SIDE_PAYS[s.pay].short}</span>`;
}
