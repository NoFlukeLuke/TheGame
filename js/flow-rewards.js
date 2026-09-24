// ══════════════════════════════════════════════
// FLOW MULTI-REWARD CHAIN (r325)
// ══════════════════════════════════════════════
// A Flow level-up can pay MORE THAN ONE reward screen. On each goal clear the
// count is rolled as a CHAIN - a chance of a 2nd, then (only if you got the
// 2nd) a chance of a 3rd, and so on to a cap of 5 - and each chance is a GOOD
// roll, so Luck multiplies it (luckChance: 30% at luck 10 is 33%).
//
// The count is announced by a COUNTER CARD over the board: it lands on x1 and
// every further reward CUTS IN - a stinger, a shake, the number bumping - so a
// big roll reads as the game interrupting itself with more. While a chain has
// screens left, the TOP EDGES of the queued chips peek out behind the current
// one, staggered, each in its kind's own colour, so "how much is still coming"
// is on screen without a number.
//
// The chain's screens (kinds): pick3 (the ordinary Survival pick), limits,
// deck (the deck-edit takeover below), sleights, improve. Ordering has three
// phases (owner spec):
//   1. until 2 EXTRA rewards have been rolled this run: the fixed dev-tunable
//      order (pick3, limits, deck, sleights, improve).
//   2. after that: shuffled, with slot 1 the ordinary pick3 at exactly 30%.
//   3. after the 2nd inspection is beaten: fully shuffled.
//
// FLOW ONLY. Survival keeps its single pick (the chain leans on Flow having no
// round clock to burn - five screens between Survival's 2:00 rounds is a wall).
// The post-boss prize grid and any bonus pick bypass the chain entirely.
//
// HOW IT HOOKS IN - three one-line seams, nothing else in the engine changes:
//   - survivalShowPick: `flowrMaybeStart()` takes over the goal-clear pick.
//   - survivalChoose:   `flowrAfterStep()` before its triggerLevelUp tail - a
//     mid-chain choose shows the next screen instead of dealing.
//   - finishSurvival (js/reward-grid.js): same guard, for the rare reward-grid
//     offer taken mid-chain.
// The LEVEL-UP RUNS ONCE, at the chain's end (flowrFinish), with the ordinary
// goal-clear carry-over - every screen before it only grants.

const FLOWR_MAX  = 5;
const FLOWR_DEF  = {
  on: true,
  chances: [25, 30, 30, 30],                              // % for the 2nd..5th
  steps: ['pick3', 'limits', 'deck', 'sleights', 'improve'], // phase-1 order
};
const FLOWR_KEY  = 'lethe.flowRewards.v1'; // OVERRIDES ONLY (the goal-tuner rule)

const FLOWR_KINDS = {
  pick3:    { label: () => 'CHOOSE ONE', short: 'PICK 3',   color: '#5ad4c0' },
  limits:   { label: () => 'LIMITS',     short: 'LIMITS',   color: '#d4a017' },
  deck:     { label: () => 'DECK EDIT',  short: 'DECK',     color: '#4aa3e0' },
  sleights: { label: () => (typeof entityLabel === 'function' ? entityLabel('sleight', true) : 'Sleights').toUpperCase(),
              short: 'VENDOR',   color: '#c07aee' },
  improve:  { label: () => 'IMPROVE',    short: 'IMPROVE',  color: '#e0813a' },
};

// ── Config (dev -> Rewards). Overrides only; an untouched knob tracks FLOWR_DEF. ──
function flowrCfg() {
  let ov = {};
  try { ov = JSON.parse(localStorage.getItem(FLOWR_KEY) || '{}') || {}; } catch (e) {}
  return {
    on: (typeof ov.on === 'boolean') ? ov.on : FLOWR_DEF.on,
    chances: Array.isArray(ov.chances) && ov.chances.length === 4 ? ov.chances : FLOWR_DEF.chances.slice(),
    steps: Array.isArray(ov.steps) && ov.steps.length === 5 ? ov.steps : FLOWR_DEF.steps.slice(),
  };
}
function flowrSaveCfg(cfg) {
  const ov = {};
  if (cfg.on !== FLOWR_DEF.on) ov.on = cfg.on;
  if (cfg.chances.join() !== FLOWR_DEF.chances.join()) ov.chances = cfg.chances;
  if (cfg.steps.join() !== FLOWR_DEF.steps.join()) ov.steps = cfg.steps;
  try {
    if (Object.keys(ov).length) localStorage.setItem(FLOWR_KEY, JSON.stringify(ov));
    else localStorage.removeItem(FLOWR_KEY);
  } catch (e) {}
}

// ── Run state ────────────────────────────────────────────────────────────────
let flowrQueue        = null;  // ['pick3','limits',...] for the level-up in progress
let flowrIdx          = 0;
let flowrExtraEarned  = 0;     // extra rewards rolled this RUN - gates the phases. In SAVE_VARS.
let _flowrBypass      = false; // survivalShowPick called BY the chain (its own pick3 step)

function flowrResetRun() { flowrQueue = null; flowrIdx = 0; flowrExtraEarned = 0; flowrClearStack(); }
function flowrChainActive() { return !!flowrQueue; }
// True while a chain screen that is NOT the ordinary pick is up - what stops
// survivalUpdateRerollBtn stamping survival's four actions over this step's row.
function flowrOwnsScreen() { return !!flowrQueue && flowrQueue[flowrIdx] !== 'pick3'; }

// ── The roll ─────────────────────────────────────────────────────────────────
function flowrRollCount() {
  const ch = flowrCfg().chances;
  let n = 1;
  while (n < FLOWR_MAX) {
    const p = (typeof luckChance === 'function' ? luckChance(ch[n - 1] || 0) : (ch[n - 1] || 0)) / 100;
    if (Math.random() >= p) break;
    n++;
  }
  return n;
}

function flowrPhase() {
  if (typeof survivalBossesBeaten !== 'undefined' && survivalBossesBeaten >= 2) return 3;
  if (flowrExtraEarned >= 2) return 2;
  return 1;
}

// Phase 2's "the first is the normal pick3 at like 30%" is EXACT, not a bias on
// top of the shuffle: 30% force it to the front, the other 70% force it OFF the
// front (a plain 5-shuffle would leave it there 20% of the time, so the naive
// "force at 30%" lands at 44%).
function flowrOrder() {
  const kinds = flowrCfg().steps.slice();
  const ph = flowrPhase();
  if (ph === 1) return kinds;
  const out = shuffle(kinds);
  if (ph === 2) {
    const i = out.indexOf('pick3');
    if (i >= 0) {
      if (Math.random() < 0.30) { out.splice(i, 1); out.unshift('pick3'); }
      else if (i === 0 && out.length > 1) {
        const j = 1 + Math.floor(Math.random() * (out.length - 1));
        [out[0], out[j]] = [out[j], out[0]];
      }
    }
  }
  return out;
}

// A kind with nothing to offer substitutes pick3 rather than showing an empty
// screen (the reward-grid "an event you cannot use is never offered" rule).
function flowrKindViable(kind) {
  try {
    if (kind === 'limits')   return LIMITS_DEF.some(d => limits[d.id].current < limits[d.id].max);
    if (kind === 'sleights') {
      const granted = _grantedSleightSet();
      return SLEIGHT_POOL.some(j => !survivalEntityBanned(j.id) && !granted.has(j.id) && sleightOfferable(j));
    }
    if (kind === 'improve')  return ['trick', 'knack', 'sleight'].some(t => ownedImprovable(t).length);
    if (kind === 'deck')     return true; // the board always holds ordinary cards
  } catch (e) {}
  return kind === 'pick3';
}

// ── Entry: called from the top of survivalShowPick (goal-clear only) ─────────
function flowrMaybeStart() {
  if (_flowrBypass) return false;
  if (typeof flowActive !== 'function' || !flowActive()) return false;
  if (!flowrCfg().on) return false;
  if (flowrQueue) return false;
  const n = flowrRollCount();
  const queue = flowrOrder().slice(0, n).map(k => flowrKindViable(k) ? k : 'pick3');
  // One reward and it is the ordinary pick: today's behaviour, no ceremony.
  if (n <= 1 && queue[0] === 'pick3') return false;
  flowrQueue = queue;
  flowrIdx = 0;
  if (n > 1) { flowrExtraEarned += n - 1; flowrPlayCounter(n, () => flowrShowStep()); }
  else flowrShowStep();
  return true;
}

function flowrShowStep() {
  if (!flowrQueue) return;
  animating = false;
  if (typeof trickSelectionPhase !== 'undefined') trickSelectionPhase = false;
  const kind = flowrQueue[flowrIdx];
  flowrRenderStack();
  if (kind === 'pick3') {
    _flowrBypass = true;
    try { survivalShowPick(false); } finally { _flowrBypass = false; }
    return;
  }
  if (kind === 'deck') { flowrShowDeckPick(); return; }
  flowrShowEntityStep(kind);
}

// Called after ANY chain screen resolves (survivalChoose's tail, finishSurvival,
// and this file's own onChoose handlers). True = the chain took it - the caller
// must NOT run its own level-up.
function flowrAfterStep() {
  if (!flowrQueue) return false;
  flowrIdx++;
  flowrRenderStack();
  if (flowrIdx < flowrQueue.length) { setTimeout(() => flowrShowStep(), 380); return true; }
  flowrFinish();
  return true;
}

function flowrFinish() {
  flowrQueue = null; flowrIdx = 0;
  flowrClearStack();
  // The chain only ever starts on a GOAL CLEAR, so the level-up carries the
  // score overflow and pays the time credits exactly as a single pick would.
  survivalGridPickCarry = false;
  survivalBonusPick = false;
  survivalSkipCarryover = false;
  triggerLevelUp();
  survivalSkipCarryover = false;
}

// ══════════════════════════════════════════════
// THE COUNTER CARD (option A) - "hold up, there's more"
// ══════════════════════════════════════════════
function flowrPlayCounter(n, done) {
  const host = document.getElementById('grid-slot') || document.getElementById('stage') || document.body;
  document.getElementById('flowr-counter')?.remove();
  const el = document.createElement('div');
  el.id = 'flowr-counter';
  el.innerHTML = `<div class="fc-kick">GOAL CLEARED</div><div class="fc-num">&times;1</div><div class="fc-sub">REWARD</div>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  try { sfxLevelUp?.(); } catch (e) {}
  let k = 1;
  const num = el.querySelector('.fc-num'), sub = el.querySelector('.fc-sub');
  const bump = () => {
    k++;
    num.textContent = '×' + k;
    sub.textContent = 'REWARDS';
    // restart the pop (the r277 pulse rule: remove, reflow, re-add)
    el.classList.remove('fc-pop'); void el.offsetWidth; el.classList.add('fc-pop');
    try { (k >= 4 ? sfxWinExplode : sfxSuccess)?.(); } catch (e) { try { sfxSuccess?.(); } catch (e2) {} }
    if (k < n) setTimeout(bump, 620);
    else setTimeout(finish, 850);
  };
  const finish = () => {
    el.classList.remove('show');
    setTimeout(() => { el.remove(); done && done(); }, 260);
  };
  if (n > 1) setTimeout(bump, 700);
  else setTimeout(finish, 900);
}

// ══════════════════════════════════════════════
// THE STACK (option C) - queued chips peeking out behind the current one
// ══════════════════════════════════════════════
function flowrRenderStack() {
  const host = document.getElementById('grid-slot');
  document.getElementById('flowr-stack')?.remove();
  if (!host || !flowrQueue) return;
  const rest = flowrQueue.slice(flowrIdx);
  if (rest.length < 2) return;   // nothing queued behind the current one
  const el = document.createElement('div');
  el.id = 'flowr-stack';
  // Furthest-back first, so DOM order is paint order (the rewind-ghost rule):
  // the current step's chip goes in last and sits lowest and on top.
  el.innerHTML = rest.slice().reverse().map((kind, i) => {
    const meta = FLOWR_KINDS[kind] || FLOWR_KINDS.pick3;
    const depth = rest.length - 1 - i;              // 0 = current
    return `<div class="fst-chip" style="--fst-c:${meta.color}; --fst-d:${depth}">`
      + `<span>${depth === 0 ? 'NOW' : ''} ${meta.short}</span></div>`;
  }).join('');
  host.appendChild(el);
}
function flowrClearStack() { document.getElementById('flowr-stack')?.remove(); }

// ══════════════════════════════════════════════
// ENTITY STEPS - limits / sleights / improve, on the shared pick board
// ══════════════════════════════════════════════
let _flowrStepOffers = null;

function flowrBuildOffers(kind) {
  const out = [];
  try {
    if (kind === 'limits') {
      const pool = LIMITS_DEF.filter(d => limits[d.id].current < limits[d.id].max);
      shuffle(pool.slice()).slice(0, 3).forEach(d => out.push(survivalMakeOption('limit', d)));
    } else if (kind === 'sleights') {
      const granted = _grantedSleightSet();
      const pool = SLEIGHT_POOL.filter(j => !survivalEntityBanned(j.id) && !granted.has(j.id) && sleightOfferable(j));
      const used = new Set();
      for (let i = 0; i < 3 && used.size < pool.length; i++) {
        const avail = pool.filter(j => !used.has(j.id));
        const pick = pickEntityByRarity(avail, j => j.rarity || 'common') || avail[0];
        if (!pick) break;
        used.add(pick.id);
        out.push(survivalMakeOption('sleight', pick));
      }
    } else if (kind === 'improve') {
      // Owned, improvable, all three types - the same draw the improve reward
      // tiles use, so Luck tilts which of your own things is offered.
      const pool = [];
      ['trick', 'knack', 'sleight'].forEach(t => ownedImprovable(t).forEach(e => pool.push({ ...e, etype: t })));
      const used = new Set();
      for (let i = 0; i < 3 && used.size < pool.length; i++) {
        const avail = pool.filter(e => !used.has(e.id));
        const pick = pickEntityByRarity(avail, e => e.rarity || 'common') || avail[0];
        if (!pick) break;
        used.add(pick.id);
        const delta = (typeof improveDeltaFor === 'function' ? improveDeltaFor(pick.id) : null)
                   || (typeof improvePreview === 'function' ? (improvePreview(pick.id) || {}).after : '') || '';
        out.push({ type: 'improve', id: pick.id, etype: pick.etype, name: pick.name,
                   icon: '⬆', desc: delta, rar: pick.rarity,
                   tag: 'v' + ((typeof entityTierOf === 'function' ? entityTierOf(pick.id) : 0) + 1) + '.0' });
      }
    }
  } catch (e) {}
  return out.filter(Boolean);
}

function flowrShowEntityStep(kind) {
  const offers = flowrBuildOffers(kind);
  if (!offers.length) { flowrAfterStep(); return; }
  _flowrStepOffers = offers;
  if (typeof pickRerollsNewScreen === 'function') pickRerollsNewScreen(); // price ladder restarts per screen
  const meta = FLOWR_KINDS[kind];
  openGridPick({
    title: meta.label(),
    tone: 'reward',
    offers: offers.map(o => ({
      entity: o.type === 'improve' ? o.etype : o.type,   // improve shows the real owned object
      id: o.id, emoji: o.icon, icon: o.icon,
      label: o.name, desc: o.desc, rarity: o.rar, tag: o.tag,
    })),
    actions: [pickRerollAction(() => {
      const fresh = flowrBuildOffers(kind);
      if (fresh.length) { _flowrStepOffers = fresh; gridPickRefresh(fresh.map(o => ({
        entity: o.type === 'improve' ? o.etype : o.type, id: o.id, emoji: o.icon, icon: o.icon,
        label: o.name, desc: o.desc, rarity: o.rar, tag: o.tag })), null); }
    })],
    onChoose: (i) => { flowrGrantOffer(_flowrStepOffers[i]); _flowrStepOffers = null; flowrAfterStep(); },
    onSkip: () => { _flowrStepOffers = null; rainCheckPay(); flowrAfterStep(); },
  });
  try { sfxShopOpen?.(); } catch (e) {}
}

function flowrGrantOffer(opt) {
  if (!opt) return;
  if (opt.type === 'improve') {
    const tier = improveEntity(opt.id);
    if (typeof syncOwnedEntityDescs === 'function') syncOwnedEntityDescs();
    showMessage(`⬆ ${opt.name} improved to v${tier}.0`, '#e0813a');
    try { sfxSuccess?.(); } catch (e) {}
    return;
  }
  survivalGrant(opt);   // limit / sleight rows are survival's own option shape
}

// ══════════════════════════════════════════════
// DECK EDIT - the takeover step
// ══════════════════════════════════════════════
// A pick of three drawn from the op table below; choosing one hands you the
// REAL BOARD with the HUD swapped to a DECK EDIT chip and a banner over the
// slot, so it reads as an editor and not the game. Every op works through ONE
// SELECTED CARD: the adjacency ops fire on its orthogonal neighbours, the buff
// ops on up to 3 cards you pick yourself.
//
// The buff quantity is rolled AT COMMIT, weighted low (the owner's .43/.36/.21),
// and revealed one card at a time - a selected card flashes green with its
// number when the buff lands on it and grey when it passes. Selecting fewer
// cards concentrates the roll (a rolled 3 clamps to what you selected);
// deliberately NOT explained anywhere in-game (owner's call).

const FLOWR_DECK_OPS = [
  { id: 'suit', adj: true, max: 4, luckMax: true, icon: '♠', name: 'Suit Spread',
    desc: 'Select a card. Up to 4 adjacent cards change to its suit.' },
  { id: 'rank', adj: true, max: 4, luckMax: true, icon: '⇅', name: 'Rank Pull',
    desc: 'Select a card. Up to 4 adjacent cards move one rank toward it.' },
  { id: 'del', adj: true, max: 3, icon: '✂', name: 'Cut',
    desc: 'Select a card. 1-3 adjacent cards leave the run for good.' },
  { id: 'copy', adj: true, max: 3, icon: '⧉', name: 'Stamp',
    desc: 'Select a card. 1-3 adjacent cards become copies of it.' },
  { id: 'pips',   buff: { key: 'pips',   range: [10, 15, 1],    word: 'pips'   }, icon: '➕', name: 'Pip Buff',
    desc: 'Pick up to 3 cards. Buffed cards score +10 to +15 pips.' },
  { id: 'mult',   buff: { key: 'mult',   range: [8, 12, 1],     word: 'mult'   }, icon: '✖', name: 'Mult Buff',
    desc: 'Pick up to 3 cards. Buffed cards score +8 to +12 mult.' },
  { id: 'focus',  buff: { key: 'focus',  range: [1, 2, 1],      word: 'Focus'  }, icon: '◉', name: 'Focus Buff',
    desc: 'Pick up to 3 cards. Buffed cards grant +1 to +2 Focus when they score.' },
  { id: 'time',   buff: { key: 'time',   range: [1, 5, 1],      word: 's'      }, icon: '⏱', name: 'Time Buff',
    desc: 'Pick up to 3 cards. Buffed cards put +1 to +5 seconds back on the clock when they score.' },
  { id: 'replay', buff: { key: 'retrig', range: [1, 2, 1],      word: 'replay' }, icon: '↻', name: 'Replay Buff',
    desc: 'Pick up to 3 cards. Buffed cards replay +1 to +2 times.' },
  { id: 'xmult',  buff: { key: 'xmult',  range: [1.5, 3, 0.5],  word: '× mult', x: true }, icon: '⨉', name: '×Mult Buff',
    desc: 'Pick up to 3 cards. Buffed cards multiply the mult by ×1.5 to ×3.' },
  { id: 'xpips',  buff: { key: 'xpips',  range: [1.25, 2, 0.25], word: '× pips', x: true }, icon: '∗', name: '×Pips Buff',
    desc: 'Pick up to 3 cards. Buffed cards multiply their pips by ×1.25 to ×2.' },
];

let _flowrDeckOp = null, _flowrDeckSel = [], _flowrDeckBusy = false;
let _flowrPlayHTML = null;
// render()'s button guard asks this (the r247 takeover rule): while the deck
// edit is up, PLAY is the APPLY button and render must not write over it.
function flowrDeckActive() { return !!_flowrDeckOp; }

function flowrShowDeckPick() {
  const ops = shuffle(FLOWR_DECK_OPS.slice()).slice(0, 3);
  openGridPick({
    title: 'DECK EDIT', tone: 'reward',
    offers: ops.map(op => ({ entity: 'deckop', id: op.id, icon: op.icon, emoji: op.icon,
                             label: op.name, desc: op.desc, rarity: 'rare', tag: 'DECK' })),
    actions: [],
    onChoose: (i) => flowrDeckBegin(ops[i]),
    onSkip: () => { rainCheckPay(); flowrAfterStep(); },
  });
}

function flowrDeckBegin(op) {
  _flowrDeckOp = op;
  _flowrDeckSel = [];
  _flowrDeckBusy = false;
  gameTimerPaused = true;
  if (typeof enterGridScreenHud === 'function') enterGridScreenHud('DECK EDIT', 'reward');
  document.body.classList.add('flowr-deck');
  // The cards come back. In Flow the goal hand's cards are still in gridData
  // (only their DOM left with the dance), so the FULL board is editable - those
  // cards are real deck cards and a buff on one persists through the deal.
  try { render(); } catch (e) {}
  flowrDeckBanner();
  // The board's own action column is the editor's: PLAY becomes APPLY for the
  // buff ops (the shop's BUY pattern - save the markup, restore on exit).
  // render()'s button guard skips its disabled writes while flowrDeckActive().
  const play = document.getElementById('btn-play');
  if (play) {
    if (_flowrPlayHTML === null) _flowrPlayHTML = play.innerHTML;
    play.classList.add('reward-buy');
    play.innerHTML = 'A<br>P<br>P<br>L<br>Y';
    play.disabled = true;   // buff ops enable it once a card is picked
  }
  const disc = document.getElementById('btn-discard');
  if (disc) disc.disabled = true;
  const gridEl = document.getElementById('grid');
  // CAPTURE PHASE, the squares rule: input.js binds its own pointerdown here and
  // a tap means "select into a hand", which this screen does not have.
  gridEl?.addEventListener('pointerdown', flowrDeckTap, true);
}

// The APPLY press: a capture listener on the play button, the Poker Squares
// pattern. The tricks-ui playHand listener on the same button no-ops with
// nothing selected, so it cannot double-fire underneath.
document.getElementById('btn-play')?.addEventListener('click', e => {
  if (!_flowrDeckOp || !_flowrDeckOp.buff) return;
  e.stopPropagation();
  flowrBuffConfirm();
}, true);

// The banner sits OVER THE CHIPS ROW, never over the board (owner's call - it
// was covering the top cards). It mounts on #stage: in landscape it takes the
// left column's chip band (the .score-subbox row is display:none on every
// grid-screen and #screen-location says DECK EDIT, so the space is free), and
// in portrait the top-bar band. CSS owns the placement; stage px throughout.
function flowrDeckBanner() {
  const host = document.getElementById('stage') || document.body;
  document.getElementById('flowr-banner')?.remove();
  const op = _flowrDeckOp;
  const el = document.createElement('div');
  el.id = 'flowr-banner';
  if (op.buff) {
    el.innerHTML = `<b>${op.name}</b><span id="fb-note">Pick up to 3 cards, then press APPLY · <i id="fb-count">0/3</i></span>`;
  } else {
    el.innerHTML = `<b>${op.name}</b><span id="fb-note">${op.desc.split('.')[0]}.</span>`;
  }
  host.appendChild(el);
}

function flowrDeckFindCell(el) {
  const id = el?.dataset?.cardId;
  if (id == null) return null;
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (cd && String(cd._id) === String(id)) return [r, c, cd];
  }
  return null;
}

function flowrDeckOrdinary(cd) {
  return !!cd && !!cd.rank && !cd._isSleight && !cd._isStone && !cd.trick && !cd.challengeCard;
}

function flowrDeckTap(e) {
  // The whole board is the editor's while this listener exists: every tap stops
  // here, so input.js's select/swap gestures can never fire underneath.
  e.stopPropagation(); e.preventDefault();
  if (_flowrDeckBusy) return;
  const cardEl = e.target.closest('[data-card-id]');
  if (!cardEl) return;
  const hit = flowrDeckFindCell(cardEl);
  if (!hit) return;
  const [r, c, cd] = hit;
  if (!flowrDeckOrdinary(cd)) { showMessage('Pick an ordinary card', '#e05a5a'); return; }
  const op = _flowrDeckOp;
  if (op.adj) { flowrAdjApply(r, c, cd); return; }
  // buff op: toggle selection, cap 3
  const i = _flowrDeckSel.findIndex(s => s.id === String(cd._id));
  if (i >= 0) { _flowrDeckSel.splice(i, 1); cardEl.classList.remove('flowr-sel'); }
  else if (_flowrDeckSel.length < 3) { _flowrDeckSel.push({ id: String(cd._id), r, c, cd, el: cardEl }); cardEl.classList.add('flowr-sel'); }
  const n = _flowrDeckSel.length;
  const cnt = document.getElementById('fb-count'); if (cnt) cnt.textContent = n + '/3';
  const btn = document.getElementById('btn-play'); if (btn) btn.disabled = n === 0;
  try { sfxCardSelect?.(); } catch (e2) {}
}

// Weighted-low roll over [1..max]: the owner's .43/.36/.21 at max 3, the same
// descending-linear shape at other maxes. Luck multiplies the weight of every
// count above 1, so a lucky run leans higher without a new formula.
function flowrQtyRoll(max) {
  const ls = (typeof luckScale === 'function') ? luckScale() : 1;
  const base3 = [0.43, 0.36, 0.21];
  const w = [];
  for (let k = 1; k <= max; k++) {
    let wk = (max === 3) ? base3[k - 1] : (max - k + 1);
    if (k > 1) wk *= ls;
    w.push(wk);
  }
  const total = w.reduce((s, x) => s + x, 0);
  let rng = Math.random() * total;
  for (let k = 0; k < w.length; k++) { rng -= w[k]; if (rng <= 0) return k + 1; }
  return max;
}

// Weighted-low roll over an inclusive numeric range with a step.
function flowrValRoll(range) {
  const [lo, hi, step] = range;
  const vals = [];
  for (let v = lo; v <= hi + 1e-9; v += step) vals.push(Math.round(v * 100) / 100);
  const w = vals.map((_, i) => vals.length - i);        // descending linear
  const total = w.reduce((s, x) => s + x, 0);
  let rng = Math.random() * total;
  for (let i = 0; i < vals.length; i++) { rng -= w[i]; if (rng <= 0) return vals[i]; }
  return vals[vals.length - 1];
}

// ── Adjacency ops: fire the moment a card is selected ────────────────────────
function flowrAdjApply(r, c, sel) {
  const op = _flowrDeckOp;
  const neigh = (typeof getNeighborsOrtho === 'function' ? getNeighborsOrtho(r, c) : [])
    .filter(([nr, nc]) => flowrDeckOrdinary(gridData[nr]?.[nc])
      && !(typeof isCellBlocked === 'function' && isCellBlocked(nr, nc)));
  if (!neigh.length) { showMessage('No ordinary card next to that one', '#e05a5a'); return; }
  _flowrDeckBusy = true;
  let count = flowrQtyRoll(op.max);
  count = Math.min(neigh.length, count);
  const targets = shuffle(neigh.slice()).slice(0, count);
  const gridEl = document.getElementById('grid');
  const elOf = (rr, cc) => {
    const cd = gridData[rr]?.[cc];
    return cd ? gridEl?.querySelector(`[data-card-id="${cd._id}"]`) : null;
  };
  elOf(r, c)?.classList.add('flowr-src');
  const summaries = [];
  targets.forEach(([tr, tc], i) => {
    setTimeout(() => {
      const t = gridData[tr]?.[tc];
      const tEl = elOf(tr, tc);
      tEl?.classList.add('flowr-hit');
      try { sfxCardPop?.(); } catch (e) {}
      if (!t) return;
      if (op.id === 'suit') { t.suit = sel.suit; summaries.push('suit'); }
      else if (op.id === 'rank') {
        const order = (typeof ACTIVE_RANKS !== 'undefined' && ACTIVE_RANKS) ? ACTIVE_RANKS : RANKS;
        const si = order.indexOf(sel.rank), ti = order.indexOf(t.rank);
        if (si >= 0 && ti >= 0 && si !== ti) t.rank = order[ti + (si > ti ? 1 : -1)];
      }
      else if (op.id === 'copy') { t.rank = sel.rank; t.suit = sel.suit; }
      else if (op.id === 'del') {
        if (typeof expectedDeckTotal !== 'undefined') expectedDeckTotal--;
        gridData[tr][tc] = (typeof drawCard === 'function' ? drawCard() : null) || null;
      }
    }, 380 * (i + 1));
  });
  setTimeout(() => {
    try { render(); } catch (e) {}
    if (typeof updateDeckHud === 'function') updateDeckHud();
    showMessage(`${op.icon} ${op.name}: ${count} card${count === 1 ? '' : 's'}`, '#4aa3e0');
    flowrDeckEnd();
  }, 380 * (targets.length + 1) + 420);
}

// ── Buff ops: selection then APPLY, with a one-by-one reveal ─────────────────
function flowrBuffConfirm() {
  if (_flowrDeckBusy || !_flowrDeckSel.length) return;
  _flowrDeckBusy = true;
  const op = _flowrDeckOp, b = op.buff;
  const q = Math.min(_flowrDeckSel.length, flowrQtyRoll(3));
  const winners = new Set(shuffle(_flowrDeckSel.slice()).slice(0, q).map(s => s.id));
  const v = flowrValRoll(b.range);
  const label = b.x ? `×${v} ${b.word.replace('× ', '')}` : `+${v}${b.word === 's' ? 's' : ' ' + b.word}`;
  const _pb = document.getElementById('btn-play'); if (_pb) _pb.disabled = true;
  _flowrDeckSel.forEach((s, i) => {
    setTimeout(() => {
      const won = winners.has(s.id);
      s.el?.classList.remove('flowr-sel');
      s.el?.classList.add(won ? 'flowr-won' : 'flowr-miss');
      if (won) {
        enhanceCardKey(cardId(s.cd), { [b.key]: v });
        try { sfxCoin?.(); } catch (e2) {}
      } else { try { sfxNoSwaps?.(); } catch (e2) {} }
    }, 480 * (i + 1));
  });
  setTimeout(() => {
    try { render(); } catch (e) {}
    showMessage(`${op.icon} ${label} on ${q} card${q === 1 ? '' : 's'}`, '#5ad4c0');
    flowrDeckEnd();
  }, 480 * (_flowrDeckSel.length + 1) + 420);
}

function flowrDeckEnd() {
  document.getElementById('grid')?.removeEventListener('pointerdown', flowrDeckTap, true);
  document.getElementById('flowr-banner')?.remove();
  document.body.classList.remove('flowr-deck');
  // Hand the play button back (the exitShopGridButtons shape); render() paints
  // the real disabled state on the next repaint.
  const play = document.getElementById('btn-play');
  if (play && _flowrPlayHTML !== null) {
    play.classList.remove('reward-buy');
    play.innerHTML = _flowrPlayHTML;
    play.disabled = true;
  }
  document.querySelectorAll('.flowr-sel, .flowr-src, .flowr-hit, .flowr-won, .flowr-miss')
    .forEach(el => el.classList.remove('flowr-sel', 'flowr-src', 'flowr-hit', 'flowr-won', 'flowr-miss'));
  if (typeof exitGridScreenHud === 'function') exitGridScreenHud();
  _flowrDeckOp = null; _flowrDeckSel = []; _flowrDeckBusy = false;
  flowrAfterStep();
}

// ══════════════════════════════════════════════
// DEV PANEL (dev -> Rewards) - the chain's knobs
// ══════════════════════════════════════════════
function flowrDevSync() {
  const cfg = flowrCfg();
  // Fill the five order <select>s once - the options are the kind table.
  cfg.steps.forEach((_, i) => {
    const el = document.getElementById('dev-flowr-st' + i);
    if (el && !el.options.length)
      el.innerHTML = Object.keys(FLOWR_KINDS).map(k => `<option value="${k}">${FLOWR_KINDS[k].short}</option>`).join('');
  });
  const on = document.getElementById('dev-flowr-on'); if (on) on.checked = cfg.on;
  cfg.chances.forEach((v, i) => { const el = document.getElementById('dev-flowr-ch' + i); if (el && document.activeElement !== el) el.value = v; });
  cfg.steps.forEach((k, i) => { const el = document.getElementById('dev-flowr-st' + i); if (el) el.value = k; });
  const ph = document.getElementById('dev-flowr-phase');
  if (ph) ph.textContent = `phase ${flowrPhase()} · ${flowrExtraEarned} extra earned · ${typeof survivalBossesBeaten !== 'undefined' ? survivalBossesBeaten : 0} inspections beaten`;
}
function flowrDevSet(field, value, i) {
  const cfg = flowrCfg();
  if (field === 'on') cfg.on = !!value;
  if (field === 'chance') cfg.chances[i] = Math.max(0, Math.min(100, parseFloat(value) || 0));
  if (field === 'step') cfg.steps[i] = value;
  flowrSaveCfg(cfg);
  flowrDevSync();
}
function flowrDevReset() { try { localStorage.removeItem(FLOWR_KEY); } catch (e) {} flowrDevSync(); }
