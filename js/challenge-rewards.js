// ══════════════════════════════════════════════════════════════════════════════
// CHALLENGE REWARDS (r671, owner; CHALLENGE_REWARDS.md sections 3 to 5)
// ══════════════════════════════════════════════════════════════════════════════
// A challenge card pays ONE reward: clearing stage 1 pays the reward's first
// tier, a raise that clears pays its second tier instead. Which reward is fixed
// when the card lands (crrRewardFor): the quarter's department on the Schedule
// (deptChallengePay, js/departments.js), else CR_FIXED_PAY. A STANDARD card's
// stage 1 is difficulty 1; a HARD card's is CR_BONUS_D or more.
//
// A timed card (Flow, spot) that runs out charges stage 1's reward IN REVERSE
// (owner): -8 credits, an improvement taken back, a limit lowered. A reward or a
// penalty that cannot land (nothing to improve, no Knack to lose) falls back to
// the credits one, so every card pays and every failure costs.
//
// Paid during a round, a reward lands at once with a plate flying from the card.
// Paid at a round's end (a cleared card nobody took), time, swaps, discards and
// Focus wait for the next round's start (crPending). A pick (improvements,
// limits, Tricks, Knacks, Sleights) opens after the round (crScreens), or in
// Flow as a step of the next reward chain (crFlow.steps).

// r685 (owner): with no department, an easy card pays one of these at random
// (fixed when it lands); a hard card an improvement.
const CR_FIXED_PAY = { std: ['credits', 'prime', 'cardbuff'], hard: 'improve' };

var crPending = null;        // { lv, secs, swaps, discards, focus } for the next round's start - SAVE_VARS
var crInterestBoost = null;  // { next: payouts left, quarter } doubled interest - SAVE_VARS
var crBossGoalMult = 1;      // the next boss's goal, x this - SAVE_VARS
var crFocusMute = 0;         // hands left that score without Focus - SAVE_VARS
var crGridBonus = 0;         // + to the next reward grid's path - SAVE_VARS
let crScreens = [];          // picks to open after the round: { kind, floor }

function crrReset() { crPending = null; crInterestBoost = null; crBossGoalMult = 1; crFocusMute = 0; crGridBonus = 0; crScreens = []; }

function crHard(q) { return !!(q && q.ladder && q.ladder[0] && q.ladder[0].d >= CR_BONUS_D); }
function crrRewardFor(q) {
  const cls = crHard(q) ? 'hard' : 'std';
  const d = (typeof deptChallengePay === 'function') ? deptChallengePay(cls) : null;
  if (d && CRR[d]) return d;
  const f = CR_FIXED_PAY[cls];
  return Array.isArray(f) ? f[Math.floor(Math.random() * f.length)] : f;
}
function crPayOf(q) { if (!q.pay || !CRR[q.pay]) q.pay = crrRewardFor(q); return q.pay; }
function crrQuarter() {
  if (typeof isActMode === 'function' && isActMode()) return typeof actNumber === 'number' ? actNumber : 1;
  return (typeof survivalBossesBeaten === 'number' ? survivalBossesBeaten : 0) + 1;
}
const _crrWord = (t, many) => (typeof entityLabel === 'function' ? entityLabel(t, many) : t);
const _crrRand = a => a[Math.floor(Math.random() * a.length)];

// ── Animation helpers ───────────────────────────────────────────────────────
// A plate from the card to the readout it changed; with no readout on screen (a
// reroll, the next reward grid) it rises off the card instead.
const CRR_GOLD = '#ffe27a', CRR_RED = '#ff4d4d';
function crrRise(el, label, color, scale) {
  if (typeof ptLaunch !== 'function') return 0;
  const g = document.getElementById('grid');
  const src = (el && el.getBoundingClientRect && el.getBoundingClientRect()) || (g && g.getBoundingClientRect());
  if (!src || !src.width) return 0;
  const a = { left: src.left, top: src.top, width: src.width, height: src.height };
  const b = { left: a.left, top: a.top - Math.max(60, a.height * 0.9), width: a.width, height: a.height };
  const dur = (typeof SETTINGS === 'object' && SETTINGS && SETTINGS.reducedMotion) ? 120 : 620;
  ptLaunch(a, b, 'credits', label, color, dur, { trail: 0, scale: scale || 1 });
  return dur;
}
function crrFly(el, to, label, loss) {
  const color = loss ? CRR_RED : CRR_GOLD, scale = loss ? CR_FAIL_PLATE : 1.2;
  const d = (to && typeof efxFly === 'function' && efxTargetEl(to)) ? efxFly(el, to, label, color, loss ? 'loss' : to, scale) : 0;
  return d || crrRise(el, label, color, scale);
}
// The Sleights on the board light up when their charges change.
function crrFlashSleights(cls) {
  document.querySelectorAll('#grid .sleight-card').forEach(el => {
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 900);
  });
}
function crrRepaintBoard() { if (!animating && !falling && !roundEnded && typeof render === 'function') render(); }

// ── Picks after the round ───────────────────────────────────────────────────
function crrScreen(kind, floor) {
  const s = { kind, floor: floor || null };
  if (typeof flowActive === 'function' && flowActive()) { const st = crFlowState(); (st.steps = st.steps || []).push(s); return ' at the next level-up'; }
  crScreens.push(s);
  return ' after the round';
}
// One pick of three of a reward chain kind, with an optional rarity floor
// (flowrOfferFloor, read by flowrBuildOffers).
function crrKindPick(s, done) {
  if (typeof flowrBuildOffers !== 'function' || typeof openGridPick !== 'function') { done(); return; }
  flowrOfferFloor = s.floor || null;
  let offers;
  try { offers = flowrBuildOffers(s.kind); } finally { flowrOfferFloor = null; }
  if (!offers.length) { done(); return; }
  openGridPick({
    title: FLOWR_KINDS[s.kind] ? FLOWR_KINDS[s.kind].label() : 'TAKE ONE', tone: 'reward',
    offers: offers.map(o => ({ entity: o.type === 'improve' ? o.etype : o.type, _improve: o.type === 'improve',
      id: o.id, emoji: o.icon, icon: o.icon, label: o.name, desc: o.desc, rarity: o.rar, tag: o.tag })),
    actions: [],
    onChoose: i => { flowrGrantOffer(offers[i]); done(); },
    onSkip: () => done(),
  });
}
function crrRunScreens() {
  const list = crScreens.splice(0);
  return list.reduce((p, s) => p.then(() => new Promise(res => (s.kind === 'cardpick' ? crrCardPick(res) : crrKindPick(s, res)))), Promise.resolve());
}
// Card buffs, stage 2 (r677): choose up to 3 cards from the whole deck (the event
// deck picker, js/event-picker.js) on a board screen; each takes a random buff off
// the deck editor's rows (rollEditorBuff). Also a step of Flow's next chain.
function crrCardPick(done) {
  if (typeof boardScreenOpen !== 'function' || typeof evDeckPicker !== 'function') { done(); return; }
  const host = document.createElement('div'); host.className = 'crr-cardpick';
  const note = document.createElement('div'); note.className = 'bs-note'; note.textContent = 'Choose up to 3 cards. Each takes a random buff.';
  host.appendChild(note);
  let picker = null, ctl = null;
  const go = () => {
    const picks = picker ? picker.picks.slice() : [];
    if (!picks.length) { refuse('Choose a card first'); return; }
    const said = picks.map(c => { const e = rollEditorBuff(); if (!e) return null; enhanceCardKey(cardId(c), e); return `${cardLabel(c)} ${_crrBuffWord(e)}`; }).filter(Boolean);
    showMessage(`⚑ Buffed: ${said.join(', ')}`, CRR_GOLD);
    try { sfxRewardTaken?.(); } catch (e) {}
    ctl.close(); done();
  };
  ctl = boardScreenOpen({ head: '> BUFF 3 CARDS', html: host, cls: 'crr-cardpick-screen',
    keys: [{ label: 'SKIP', fn: () => { ctl.close(); done(); } }, { label: 'CONFIRM', primary: true, fn: go }] });
  if (!ctl) { done(); return; }
  picker = evDeckPicker(host, { cards: _crrBuffable(), max: 3, ordered: true });
}

// ── Paid after the round: the next round's start ────────────────────────────
function crrPend(k, n) {
  crPending = crPending || { lv: level, secs: 0, swaps: 0, discards: 0, focus: 0 };
  crPending[k] = (k === 'focus' && (n === 'max' || crPending.focus === 'max')) ? 'max' : (crPending[k] || 0) + n;
}
// startRoundTimer also runs on resumes (a pause, the dev panel), so the pending
// rewards wait for a round of a LATER level than the one that paid them.
function crrPendingApply() {
  const p = crPending; if (!p || p.lv === level || roundEnded) return;
  crPending = null;
  if (p.secs > 0) rewindTime(p.secs, `⚑ Challenge - rewound ${p.secs}s`);
  else if (p.secs < 0) { roundSeconds = Math.max(1, roundSeconds + p.secs); updateClockUI(); }
  if (p.swaps)    swaps    = Math.max(0, swaps + p.swaps);
  if (p.discards) discards = Math.max(0, discards + p.discards);
  if (p.focus === 'max' || p.focus > 0) addFocus(p.focus === 'max' ? focusCapNodes() : p.focus);
  else if (p.focus < 0) removeFocus(-p.focus);
  if (p.swaps || p.discards) { if (typeof updateSelectionUI === 'function') updateSelectionUI(); crrRepaintBoard(); }
}

// ── Read by the game ────────────────────────────────────────────────────────
// payoutInterestMult (js/interlude.js): doubled while a boost is live.
function crrInterestMult() {
  const b = crInterestBoost; if (!b) return 1;
  return ((b.next || 0) > 0 || b.quarter === crrQuarter()) ? 2 : 1;
}
// showPayoutUI, once a payout has paid: a one-payout boost is spent.
function crrInterestPaid() {
  const b = crInterestBoost; if (!b) return;
  if ((b.next || 0) > 0) b.next--;
  if (!b.next && b.quarter !== crrQuarter()) crInterestBoost = null;
}
// The next boss's goal as the Schedule's review line prints it.
function crrBossGoalShown(goal) { return Math.max(1, Math.ceil(goal * (crBossGoalMult || 1))); }
// triggerBoss: the boss's goal moves, then the multiplier is spent.
function crrBossGoalApply(goal) {
  const m = crBossGoalMult || 1; crBossGoalMult = 1;
  return m === 1 ? goal : Math.max(1, Math.ceil(goal * m));
}
// calcScore: a muted hand scores with Focus x1. crOnHand spends it.
function crrFocusMuted() { return crFocusMute > 0; }
function crrAfterHand() { if (crFocusMute > 0) { crFocusMute--; if (typeof focusChipSync === 'function') focusChipSync(); } }
// rewardSelectionCap: the next ordinary reward grid's path. closeRewardGrid spends it.
function crrGridBonus() { return crGridBonus || 0; }
function crrGridClosed() { crGridBonus = 0; }

// ── The rewards ─────────────────────────────────────────────────────────────
// Each: `say(t)` (t = 0 stage 1, 1 stage 2), `face` (the card's short line:
// [stage 1, stage 2, unit]), `can(t)`, `give(t, ctx)` -> extra words or '',
// and the reverse of stage 1: `penSay`, `penCan()`, `penTo` (the readout its
// plate flies to) and `take()` -> what was taken, said, or undefined for penSay.
// ctx = { el: the card, live: a round is being played }.
const _crrMostPlayed = () => {
  const p = (typeof nsFamPlays === 'object' && nsFamPlays) || {};
  return ['set', 'run', 'flush'].reduce((a, f) => ((p[f] || 0) > (p[a] || 0) ? f : a), 'set');
};
const CRR_FAM = { set: 'sets', run: 'runs', flush: 'flushes' };
const _crrOwnedSleights = () => (typeof allOwnedSleightCards === 'function' ? allOwnedSleightCards() : [])
  .filter(c => c && c._usesLeft !== 'infinite' && typeof sleightMaxCharges === 'function' && sleightCapOf(c) != null);
const _crrLimitPool = dir => LIMITS_DEF.filter(d => {
  const l = limits[d.id]; if (!l) return false;
  if (dir > 0) return l.current < l.max && d.id !== 'focus_cap';
  if (d.id === 'trick_slots' && typeof trickTray !== 'undefined' && trickTray.length >= l.current) return false;
  return l.current > (l.min || 0);
});
const CRR_LIMIT_TO = { swaps: 'swaps', discards: 'discards', round_time: 'time', focus_cap: 'focus', trick_slots: 'tricks', selection: 'hand' };
const _crrImproved = () => {
  const ids = [];
  (typeof trickTray !== 'undefined' ? trickTray : []).forEach(t => t && ids.push({ id: t.id, name: t.name }));
  (typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []).forEach(k => k && ids.push({ id: k.id, name: k.name }));
  (typeof allOwnedSleightCards === 'function' ? allOwnedSleightCards() : []).forEach(c => { const d = sleightDef(c); if (d && !ids.some(x => x.id === d.id)) ids.push({ id: d.id, name: d.name }); });
  return ids.filter(e => entityTierOf(e.id) > 0);
};
const _crrTrickPool = () => (typeof trickTray !== 'undefined' ? trickTray : [])
  .filter(t => t && !(typeof altarTrickLocked === 'function' && altarTrickLocked(t.id)));
// Card buffs (r677): the deck editor's buff rows, in words; a card that can take one; a buff taken off.
function _crrBuffWord(e) {
  const k = Object.keys(e || {})[0], v = e && e[k];
  return { pips: `+${v} pips`, mult: `+${v} mult`, xpips: `×${v} pips`, xmult: `×${v} mult`, time: `rewind ${v}s`,
           focus: `+${v} Focus`, coin: `+${v} credits` }[k] || '';
}
const _crrBuffable = () => (typeof everyDeckCard === 'function' ? everyDeckCard() : [])
  .filter(c => c && !c._temp && !(typeof isWildCard === 'function' && isWildCard(c)));
const _crrBuffStores = () => [['pips', permPips, 0], ['mult', permMult, 0], ['xpips', permXPips, 1], ['xmult', permXMult, 1],
  ['time', permTime, 0], ['focus', typeof permFocus !== 'undefined' ? permFocus : null, 0], ['coin', typeof permCoins !== 'undefined' ? permCoins : null, 0]];
const _crrBuffsOn = c => { const k = cardId(c); return _crrBuffStores().filter(([, m, rest]) => m && m[k] != null && m[k] !== rest); };
const _crrStripPool = () => _crrBuffable().filter(c => _crrBuffsOn(c).length);
function _crrStripOne(c) {
  const on = _crrBuffsOn(c); if (!on.length) return '';
  const [name, m] = _crrRand(on), k = cardId(c), v = m[k];
  delete m[k];
  return _crrBuffWord({ [name]: v });
}

const CRR = {
  // ── STANDARD ──
  credits: {
    n: [8, 20], face: ['+8', '+20', CREDIT_SYM],
    say: t => `+${CRR.credits.n[t]} credits`,
    can: () => true,
    give(t, ctx) { const n = this.n[t]; coins += n; updateCoinsUI(); if (ctx.el) crrFly(ctx.el, 'credits', `+${n}`); return ''; },
    penSay: '-8 credits', penTo: 'credits', penLabel: '-8',
    penCan: () => true,
    take() { coins = Math.max(0, coins - 8); updateCoinsUI(); },
  },
  time: {
    n: [15, 30], face: ['+15s', '+30s', ''],
    say: t => `rewind the clock ${CRR.time.n[t]}s`,
    can: () => true,
    give(t, ctx) {
      const n = this.n[t];
      if (ctx.live) { rewindTime(n); return ''; }
      crrPend('secs', n); return ' at the next round’s start';
    },
    penSay: '-15s', penTo: 'time', penLabel: '-15s',
    penCan: () => true,
    take() { roundSeconds = Math.max(1, roundSeconds - 15); updateClockUI(); },
  },
  rerolls: {
    n: [2, 5], face: ['+2', '+5', 'REROLL'],
    say: t => `+${CRR.rerolls.n[t]} free rerolls`,
    can: () => typeof pickRerollsLeft === 'number',
    give(t, ctx) { pickRerollsLeft += this.n[t]; if (ctx.el) crrFly(ctx.el, null, `+${this.n[t]} 🎲`); return ''; },
    penSay: '-2 free rerolls', penLabel: '-2 🎲',
    penCan: () => typeof pickRerollsLeft === 'number' && pickRerollsLeft > 0,
    take() { const k = Math.min(2, pickRerollsLeft); pickRerollsLeft -= k; return `-${k} free reroll${k === 1 ? '' : 's'}`; },
  },
  grid: {
    n: [1, 2], face: ['+1', '+2', 'PATH'],
    say: t => `+${CRR.grid.n[t]} to your next reward grid's path`,
    can: () => true,
    give(t, ctx) { crGridBonus += this.n[t]; if (ctx.el) crrFly(ctx.el, null, `+${this.n[t]} PATH`); return ''; },
    penSay: "-1 to your next reward grid's path", penLabel: '-1 PATH',
    penCan: () => true,
    take() { crGridBonus -= 1; },
  },
  charges: {
    face: ['+1', 'FULL', 'CHARGE'],
    say: t => t ? 'every Sleight back to full charges' : '+1 charge to every Sleight',
    can: () => _crrOwnedSleights().some(c => (c._usesLeft || 0) < sleightCapOf(c)),
    give(t, ctx) {
      _crrOwnedSleights().forEach(c => { const cap = sleightCapOf(c); c._usesLeft = t ? cap : Math.min(cap, (c._usesLeft || 0) + 1); });
      crrFlashSleights('crr-charge-up'); crrRepaintBoard();
      if (ctx.el) crrFly(ctx.el, null, t ? 'FULL' : '+1 CHARGE');
      return '';
    },
    penSay: '-1 charge from every Sleight', penLabel: '-1 CHARGE',
    penCan: () => _crrOwnedSleights().some(c => (c._usesLeft || 0) > 1),
    take() { _crrOwnedSleights().forEach(c => { if ((c._usesLeft || 0) > 1) c._usesLeft--; }); crrFlashSleights('crr-charge-down'); crrRepaintBoard(); },
  },
  stock: {
    n: [2, 4], face: ['+2', '+4', 'STOCK'],
    say: t => `+${CRR.stock.n[t]} swaps and +${CRR.stock.n[t]} discards`,
    can: () => true,
    give(t, ctx) {
      const n = this.n[t];
      if (!ctx.live) { crrPend('swaps', n); crrPend('discards', n); return ' at the next round’s start'; }
      swaps += n; discards += n;
      if (ctx.el) { crrFly(ctx.el, 'swaps', `+${n}`); setTimeout(() => crrFly(ctx.el, 'discards', `+${n}`), 160); }
      if (typeof updateSelectionUI === 'function') updateSelectionUI();
      crrRepaintBoard();
      return '';
    },
    penSay: '-2 swaps and -2 discards', penTo: 'swaps', penLabel: '-2',
    penCan: () => swaps > 0 || discards > 0,
    take(el) {
      swaps = Math.max(0, swaps - 2); discards = Math.max(0, discards - 2);
      if (el) crrFly(el, 'discards', '-2', true);
      if (typeof updateSelectionUI === 'function') updateSelectionUI();
      crrRepaintBoard();
    },
  },
  focus2: {
    n: [1, 3], face: ['1', '3', 'FOCUS×2'],
    say: t => t ? 'your next 3 hands apply Focus twice' : 'your next hand applies Focus twice',
    can: () => typeof focusDoubleHands === 'number',
    give(t, ctx) { focusDoubleHands += this.n[t]; if (typeof focusChipSync === 'function') focusChipSync(); if (ctx.el) crrFly(ctx.el, 'focus', 'x2'); return ''; },
    penSay: 'your next hand scores without Focus', penTo: 'focus', penLabel: 'x1',
    penCan: () => true,
    take() { crFocusMute++; if (typeof focusChipSync === 'function') focusChipSync(); },
  },
  interest: {
    face: ['1', 'Q', 'INT×2'],
    say: t => t ? 'double interest on every payout this quarter' : 'double interest on your next payout',
    can: () => true,
    give(t, ctx) {
      const b = crInterestBoost = crInterestBoost || { next: 0, quarter: null };
      if (t) b.quarter = crrQuarter(); else b.next = (b.next || 0) + 1;
      if (ctx.el) crrFly(ctx.el, 'credits', 'INT x2');
      return '';
    },
    penSay: 'no interest on your next payout', penTo: 'credits', penLabel: 'INT x0',
    penCan: () => typeof interestFreezeRounds === 'number',
    take() { interestFreezeRounds = Math.max(interestFreezeRounds, 1); },
  },
  // ── STANDARD spares (r677): paid by no department yet ──
  prime: {
    face: ['×2', 'ALL', 'PRIME'],
    say: t => t ? `every ${_crrWord('trick')} in your tray primed once` : `a random ${_crrWord('trick')} in your tray primed twice`,
    can: () => typeof trickTray !== 'undefined' && trickTray.length > 0,
    give(t, ctx) {
      const named = [];
      if (t) trickTray.forEach(tr => { if (primeTrick(tr, 1, { src: 'challenge' })) named.push(tr.name); });
      else for (const tr of shuffle(trickTray.slice())) if (primeTrick(tr, 2, { src: 'challenge' })) { named.push(tr.name); break; }
      if (typeof renderTrickTray === 'function') renderTrickTray();
      if (ctx.el && named.length) crrFly(ctx.el, 'tricks', t ? '+1 PRIME' : '+2 PRIME');
      return named.length ? ` (${named.join(', ')})` : '';
    },
    penSay: `a random primed ${_crrWord('trick')} loses 2 primes`, penTo: 'tricks', penLabel: '-2 PRIME',
    penCan: () => typeof trickTray !== 'undefined' && trickTray.some(t => (t._primed || 0) > 0),
    take() {
      const tr = _crrRand(trickTray.filter(t => (t._primed || 0) > 0)), n = Math.min(2, tr._primed);
      tr._primed -= n; if (!tr._primed) delete tr._primeSrc;
      if (typeof renderTrickTray === 'function') renderTrickTray();
      return `${tr.name} lost ${n} prime${n === 1 ? '' : 's'}`;
    },
  },
  cardbuff: {
    face: ['3', 'PICK', 'BUFF'],
    say: t => t ? '3 cards you choose from your deck take a random buff' : '3 random cards in your deck take a random buff',
    can: () => _crrBuffable().length > 0 && typeof rollEditorBuff === 'function',
    give(t, ctx) {
      if (t) return crrScreen('cardpick');
      const said = shuffle(_crrBuffable()).slice(0, 3).map(c => {
        const e = rollEditorBuff(); if (!e) return null;
        enhanceCardKey(cardId(c), e);
        return `${cardLabel(c)} ${_crrBuffWord(e)}`;
      }).filter(Boolean);
      crrRepaintBoard();
      if (ctx.el && said.length) crrFly(ctx.el, null, `+${said.length} BUFF${said.length === 1 ? '' : 'S'}`);
      return said.length ? ` (${said.join(', ')})` : '';
    },
    penSay: '3 random buffed cards in your deck lose a buff', penLabel: '-3 BUFFS',
    penCan: () => _crrStripPool().length > 0,
    take() {
      const said = shuffle(_crrStripPool()).slice(0, 3).map(c => `${cardLabel(c)} ${_crrStripOne(c)}`);
      crrRepaintBoard();
      return `buffs lost: ${said.join(', ')}`;
    },
  },
  // ── HARD ──
  improve: {
    face: ['1', 'PICK', '⬆'],
    say: t => t ? 'pick 1 of 3 improvements' : 'a random improvement',
    can: () => typeof evImprovables === 'function' && evImprovables().length > 0,
    give(t) {
      if (t) return crrScreen('improve');
      const e = _crrRand(evImprovables());
      improveEntity(e.id);
      if (typeof syncOwnedEntityDescs === 'function') syncOwnedEntityDescs();
      return ` (${e.name})`;
    },
    penSay: 'an improvement taken back', penTo: 'tricks', penLabel: '-1 TIER',
    penCan: () => _crrImproved().length > 0,
    take() {
      const e = _crrRand(_crrImproved()), was = entityTierOf(e.id);
      downgradeEntity(e.id, { anim: true });
      return `${e.name} lost an improvement (v${was + 1}.0 to v${was}.0)`;
    },
  },
  limit: {
    face: ['1', 'PICK', 'LIMIT'],
    say: t => t ? 'pick 1 of 3 limits to raise' : '+1 to a random limit',
    can: () => _crrLimitPool(1).length > 0,
    give(t, ctx) {
      if (t) return crrScreen('limits');
      const d = pickWeightedLimits(1, _crrLimitPool(1))[0];
      const said = limitChangeText(d.id, 1);
      incrementLimit(d.id);
      if (ctx.el) crrFly(ctx.el, CRR_LIMIT_TO[d.id], `${limitDeltaText(d.id, 1)} ${d.label.toUpperCase()}`);
      if (typeof updateSelectionUI === 'function') updateSelectionUI();
      return ` (${said})`;
    },
    penSay: 'a random limit lowered', penLabel: '-1 LIMIT',
    penCan: () => _crrLimitPool(-1).length > 0,
    plan() { const d = _crrRand(_crrLimitPool(-1)); return { to: CRR_LIMIT_TO[d.id], label: `${limitDeltaText(d.id, -1)} ${d.label.toUpperCase()}`, id: d.id }; },
    take(el, plan) {
      const id = plan.id, said = limitChangeText(id, -1);
      decrementLimit(id);
      if (typeof updateSelectionUI === 'function') updateSelectionUI();
      return `${said}`;
    },
  },
  tricks: {
    floor: ['rare', 'epic'], face: ['R+', 'E+', null],
    say: t => `pick 1 of 3 ${_crrWord('trick', true)} (${t ? 'epic' : 'rare'} or better)`,
    can: () => !(typeof trickTrayFull === 'function' && trickTrayFull()),
    give(t) { return crrScreen('tricks', this.floor[t]); },
    penSay: `a random ${_crrWord('trick')} removed`, penTo: 'tricks', penLabel: () => `-1 ${_crrWord('trick').toUpperCase()}`,
    penCan: () => _crrTrickPool().length > 0,
    take() {
      const tr = _crrRand(_crrTrickPool());
      const i = trickTray.findIndex(b => b.id === tr.id); if (i >= 0) trickTray.splice(i, 1);
      const a = acquiredTricks.findIndex(b => b.id === tr.id); if (a >= 0) acquiredTricks.splice(a, 1);
      if (typeof hideTrickTooltip === 'function') hideTrickTooltip();
      if (typeof renderTrickTray === 'function') renderTrickTray();
      crrRepaintBoard();
      return `lost ${_crrWord('trick')}: ${tr.name}`;
    },
  },
  focus: {
    face: ['½', 'MAX', 'FOCUS'],
    say: t => t ? 'Focus to max' : 'Focus up by half the bar',
    can: () => typeof focusCapNodes === 'function',
    give(t, ctx) {
      const cap = focusCapNodes(), n = t ? cap : Math.ceil(cap / 2);
      if (!ctx.live) { crrPend('focus', t ? 'max' : n); return ' at the next round’s start'; }
      if (ctx.el) crrFly(ctx.el, 'focus', t ? 'MAX' : `+${n}`);
      addFocus(t ? Math.max(0, cap - focusNodes) : n);
      return '';
    },
    penSay: 'Focus down by half the bar', penTo: 'focus', penLabel: () => `-${Math.ceil(focusCapNodes() / 2)}`,
    penCan: () => typeof focusNodes === 'number' && focusNodes > 0,
    take() { const n = Math.ceil(focusCapNodes() / 2); removeFocus(n); return `-${n} Focus`; },
  },
  knacks: {
    floor: [null, 'rare'], face: ['3', 'R+', null],
    say: t => `pick 1 of 3 ${_crrWord('knack', true)}${t ? ' (rare or better)' : ''}`,
    can: () => true,
    give(t) { return crrScreen('knacks', this.floor[t]); },
    penSay: `a random ${_crrWord('knack')} removed`, penTo: 'knacks', penLabel: () => `-1 ${_crrWord('knack').toUpperCase()}`,
    penCan: () => typeof acquiredKnacks !== 'undefined' && acquiredKnacks.length > 0,
    take() {
      const k = _crrRand(acquiredKnacks);
      acquiredKnacks.splice(acquiredKnacks.indexOf(k), 1);
      if (typeof hideKnackTooltip === 'function') hideKnackTooltip();
      if (typeof updateKnackList === 'function') updateKnackList();
      crrRepaintBoard();
      return `lost ${_crrWord('knack')}: ${k.name}`;
    },
  },
  sleights: {
    face: ['1', 'PICK', null],
    say: t => t ? `pick 1 of 3 ${_crrWord('sleight', true)}` : `a random ${_crrWord('sleight')}, on top of your deck`,
    can: () => typeof SLEIGHT_POOL !== 'undefined',
    give(t) {
      if (t) return crrScreen('sleights');
      const granted = typeof _grantedSleightSet === 'function' ? _grantedSleightSet() : new Set();
      const pool = SLEIGHT_POOL.filter(j => !survivalEntityBanned(j.id) && !granted.has(j.id) && sleightOfferable(j));
      const def = (pool.length && pickEntityByRarity(pool, j => j.rarity || 'common')) || pool[0];
      if (!def) return '';
      grantSleight(def);
      const card = drawPile.pop(); if (card) drawPile.unshift(card);   // drawCard takes from the front
      return ` (${def.name})`;
    },
    penSay: `a random ${_crrWord('sleight')} removed`, penLabel: () => `-1 ${_crrWord('sleight').toUpperCase()}`,
    penCan: () => typeof allOwnedSleightCards === 'function' && allOwnedSleightCards().length > 0,
    take() {
      const inPile = cd => drawPile.includes(cd) || playedPile.includes(cd);
      const all = allOwnedSleightCards(), piles = all.filter(inPile);
      const card = _crrRand(piles.length ? piles : all), def = sleightDef(card);
      if (inPile(card)) {
        [drawPile, playedPile].forEach(p => { const i = p.indexOf(card); if (i >= 0) p.splice(i, 1); });
      } else {
        // On the board: it sinks into the table and the deck fills its cell.
        let at = null;
        for (let r = 0; r < gridRows && !at; r++) for (let c = 0; c < gridCols; c++) if (gridData[r]?.[c] === card) { at = [r, c]; break; }
        if (at) {
          const el = crCardEl(card);
          const swap = () => { if (gridData[at[0]]?.[at[1]] === card) { gridData[at[0]][at[1]] = drawCard() || null; crrRepaintBoard(); } };
          if (el && typeof cardAnimRunner === 'function' && cardAnimRunner('discard', 'sink')) cardAnimRunner('discard', 'sink')({ cards: [el] }).catch(() => {}).then(swap);
          else swap();
        }
      }
      if (def && typeof grantedSleightIds !== 'undefined' && !allOwnedSleightCards().some(c => c.sleightId === def.id)) grantedSleightIds.delete(def.id);
      if (typeof updateDeckHud === 'function') updateDeckHud();
      return `lost ${_crrWord('sleight')}: ${def ? def.name : '?'}`;
    },
  },
  boss: {
    n: [5, 10], face: ['-5%', '-10%', 'BOSS'],
    say: t => `the next boss asks ${CRR.boss.n[t]}% less`,
    can: () => true,
    give(t, ctx) { crBossGoalMult *= 1 - this.n[t] / 100; if (ctx.el) crrFly(ctx.el, null, `BOSS -${this.n[t]}%`); return ''; },
    penSay: 'the next boss asks 5% more', penLabel: 'BOSS +5%',
    penCan: () => true,
    take() { crBossGoalMult *= 1.05; },
  },
  growth: {
    n: [5, 15], face: ['+5', '+15', 'PLAYS'],
    say: t => `+${CRR.growth.n[t]} plays to your most-played hand family`,
    can: () => typeof nsFamPlays === 'object',
    give(t, ctx) {
      const f = _crrMostPlayed(), n = this.n[t];
      nsFamPlays[f] = (nsFamPlays[f] || 0) + n;
      if (ctx.el) crrFly(ctx.el, null, `+${n} ${CRR_FAM[f].toUpperCase()}`);
      return ` (${CRR_FAM[f]})`;
    },
    penSay: '-5 plays from your most-played hand family', penLabel: '-5 PLAYS',
    penCan: () => typeof nsFamPlays === 'object' && Object.values(nsFamPlays).some(v => v > 0),
    take() { const f = _crrMostPlayed(); nsFamPlays[f] = Math.max(0, (nsFamPlays[f] || 0) - 5); return `-5 plays from ${CRR_FAM[f]}`; },
  },
};
const CRR_STD = ['credits', 'time', 'rerolls', 'grid', 'charges', 'stock', 'focus2', 'interest', 'prime', 'cardbuff'];
const CRR_HARD = ['improve', 'limit', 'tricks', 'focus', 'knacks', 'sleights', 'boss', 'growth'];

function crrSay(id, t) { const r = CRR[id] || CRR.credits; return r.say(t); }
// Pay stage `t` of reward `id`. Returns what was paid, in words, for the notice.
// A reward that cannot land pays the credits reward of the same stage instead.
function crrGrant(id, t, ctx) {
  const r = CRR[id] || CRR.credits;
  if (!r.can(t)) return `${CRR.credits.say(t)} instead of ${r.say(t)}` + (CRR.credits.give(t, ctx || {}) || '');
  return r.say(t) + (r.give(t, ctx || {}) || '');
}
// The reverse of stage 1, worked out before the burst flies (it says where to).
function crrPenaltyPlan(id) {
  let r = CRR[id] || CRR.credits;
  if (!r.penCan()) r = CRR.credits;
  const p = r.plan ? r.plan() : {};
  const lab = p.label || (typeof r.penLabel === 'function' ? r.penLabel() : r.penLabel);
  const plan = { to: p.to !== undefined ? p.to : r.penTo, label: lab, say: r.penSay };
  plan.take = el => r.take(el, p);
  return plan;
}

// A stage's figure with the credits mark joined to it ("+L¢8"); any other figure as it is.
function crrFig(id, t) {
  const r = CRR[id] || CRR.credits;
  return r.face[2] === CREDIT_SYM ? r.face[t].replace(/^([+-]?)/, '$1' + CREDIT_SYM) : r.face[t];
}
// A stage in a few characters, for the Schedule's bar ("+L¢8", "+15s", "FOCUS×2").
function crrShort(id, t) {
  const r = CRR[id] || CRR.credits; if (!r.face) return r.say(t);
  if (r.face[2] === CREDIT_SYM) return crrFig(id, t);
  const unit = r.face[2] != null ? r.face[2] : '';
  return (/^\d+$/.test(r.face[t]) ? unit : `${r.face[t]}${unit ? ' ' + unit : ''}`) || r.say(t);
}

// ── On the card ─────────────────────────────────────────────────────────────
function crrFaceHTML(q) {
  const id = crPayOf(q), r = CRR[id]; if (!r || !r.face) return '';
  const unit = r.face[2] != null ? r.face[2] : (id === 'tricks' ? _crrWord('trick') : id === 'knacks' ? _crrWord('knack') : _crrWord('sleight')).toUpperCase();
  const one = q.ladder.length < 2;
  // r677: got = the stage paid, passed = the one a take passed up, risk = stage 1 under a
  // raise (the 'take' / 'raise' looks draw them; nothing else does).
  const st = i => q.done === 'won' ? (i === q.banked ? ' got' : ' passed') : (!q.done && i < q.tier ? ' risk' : '');
  const s = i => `<b class="${q.tier === i ? 'cur' : ''}${st(i)}">${r.face[i]}</b>`;
  // r687 (owner): set tight, "L¢+8›+20", so two stages fit a card. A word unit (REROLL,
  // SLEIGHT) takes its own line over the figures; on one line it ran off the card.
  const word = unit && unit !== CREDIT_SYM;
  return `<div class="cr-pay${word ? ' crp-word' : ''}">${unit ? `<i>${unit}</i>` : ''}${s(0)}${one ? '' : `<span class="crp-to">›</span>${s(1)}`}</div>`;
}
// The tap read-out's last sentence: what it pays, and what it costs if it runs out.
function crrInfoText(q) {
  const id = crPayOf(q), r = CRR[id] || CRR.credits;
  const pays = q.ladder.length > 1 ? `Pays ${r.say(0)}; raised, ${r.say(1)}.` : `Pays ${r.say(0)}.`;
  return pays + (crTimed(q.src) ? ` Runs out: ${(r.penCan() ? r : CRR.credits).penSay}.` : '');
}
