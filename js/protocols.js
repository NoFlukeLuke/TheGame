// ══════════════════════════════════════════════
// PROTOCOLS (r748, owner; r749 Limitless, Hyperfocus, the locks): the same run, a different rule set.
//
// Flow and the Schedule are the two ways a run progresses. A PROTOCOL is laid
// over either one: PLAY on the Flow or Schedule card opens the protocol screen
// (protoOpen), and the run's ACTIVE_MODE is the base mode with the protocol's
// flag added (protocolMode). The id stays the base's ('flow' / 'map'), so the
// walkthrough seeds, the deck switch, Records and every id-keyed store still
// read the mode it runs on; `ACTIVE_MODE.protocol` names the protocol.
//
//   standard   the base mode as it is
//   dexterous  Sleights are playing cards (js/dexterous.js reads `dexterous`)
//   precision  no rush: a flat, weaker speed bonus, bigger hands make Focus,
//              smaller ones lose it, more stock, a wider board, longer clocks
//
// DIFFICULTY IS PER PROTOCOL, shared by Flow and the Schedule (owner: a win on
// either counts for both). difficultyModeId maps a Flow or Schedule run to its
// protocol's key. A won run also unlocks the protocol's Knack (PROTO_KNACKS),
// which every other run can then be offered.
// A protocol other than Standard has no walkthrough and does not mark its base
// mode as started, so the base's first Standard run still teaches it.
// ══════════════════════════════════════════════

const PROTOCOL_BASES = ['flow', 'map'];
const PROTOCOLS = [
  { id: 'standard',  name: 'Standard',  accent: '#6fd0ff', short: 'No changes.',
    say: { flow: 'Flow as it is.', map: 'The Schedule as it is.' } },
  { id: 'dexterous', name: 'Dexterous', accent: '#c07aee', flag: 'dexterous', short: 'Sleights are playing cards.',
    say: { any: 'Every Sleight is dealt a rank and a suit. Sleights count as cards in a hand and do their thing when played. They are four times as common in rewards. Two start in the deck.' } },
  { id: 'precision', name: 'Precision', accent: '#e8c36a', flag: 'precision', short: 'A flat speed bonus. Longer hands make more Focus.',
    say: { flow: () => precisionSay('flow'), map: () => precisionSay('map') } },
  { id: 'limitless', name: 'Limitless', accent: '#ff7a5c', flag: 'limitless', short: 'Every limit at its max. Fewer rewards.',
    say: { flow: () => limitlessSay('flow'), map: () => limitlessSay('map') } },
  { id: 'hyperfocus', name: 'Hyperfocus', accent: '#cf8cff', flag: 'hyperfocus', short: 'Focus you make is doubled. It fades 3x as fast.',
    say: { any: () => `Every Focus you make is doubled. Focus fades ${HYPERFOCUS.decay} times as fast. Focus limits are the usual ones.` } },
];
// r749 (owner): each protocol opens with a won run of the one before it, in this
// order. A win in Flow or the Schedule counts for both (protoWon).
const PROTOCOL_ORDER = PROTOCOLS.map(p => p.id);
function protocolDef(id) { return PROTOCOLS.find(p => p.id === id) || PROTOCOLS[0]; }
function protocolSay(id, base) {
  const s = protocolDef(id).say; const v = s[base] || s.any || '';
  return typeof v === 'function' ? v() : v;
}

// The live run's protocol ('standard' outside Flow and the Schedule).
function activeProtocol() { return (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && ACTIVE_MODE.protocol) || 'standard'; }

// The mode a run of `baseId` under protocol `protoId` plays. Standard is the
// MODES entry itself; any other is a copy with the protocol's flag.
function protocolMode(baseId, protoId) {
  const base = MODES[baseId] || MODES.flow;
  const p = protocolDef(protoId);
  if (p.id === 'standard') return base;
  const m = { ...base, protocol: p.id, name: `${base.name} · ${p.name}`, noWalkthrough: true };
  if (p.flag) m[p.flag] = true;
  return m;
}

// A saved run or a New Run note names its mode and protocol. A pre-r748 save of
// the Dexterous MODE ('dexterous') is Flow under the Dexterous protocol.
function protocolRestore(modeId, protoId) {
  if (modeId === 'dexterous') return protocolMode('flow', 'dexterous');
  if (protoId && PROTOCOL_BASES.includes(modeId)) return protocolMode(modeId, protoId);
  return MODES[modeId] || MODES.normal;
}

// ── Locks (r749): a protocol opens with a won run of the protocol before it ──
const PROTO_WIN_KEY = 'lethe.protocolWins.v1';
function _protoWinSet() { try { const a = JSON.parse(localStorage.getItem(PROTO_WIN_KEY) || '[]'); return new Set(Array.isArray(a) ? a : []); } catch (e) { return new Set(); } }
// Won once, in Flow or the Schedule. A difficulty tier past the first also says
// so (a win before r749 opened tier 2 of its protocol).
function protoWon(id) { return _protoWinSet().has(id) || difficultyMax(protoKey(id)) >= 2; }
function protoBefore(id) { const i = PROTOCOL_ORDER.indexOf(id); return i > 0 ? PROTOCOL_ORDER[i - 1] : null; }
function protoUnlocked(id) { const b = protoBefore(id); return !b || protoWon(b); }
// Dev: every protocol open.
function protoUnlockAll() { try { localStorage.setItem(PROTO_WIN_KEY, JSON.stringify(PROTOCOL_ORDER)); } catch (e) {} }

// The last protocol chosen for each base ({ flow: 'precision' }), overrides only.
const PROTO_PICK_KEY = 'lethe.protocol.v1';
function _protoPicks() { try { return JSON.parse(localStorage.getItem(PROTO_PICK_KEY) || '{}') || {}; } catch (e) { return {}; } }
function protoLastPick(base) { const id = _protoPicks()[base]; return PROTOCOLS.some(p => p.id === id) && protoUnlocked(id) ? id : 'standard'; }
function protoSavePick(base, id) {
  const all = _protoPicks();
  if (id === 'standard') delete all[base]; else all[base] = id;
  try { Object.keys(all).length ? localStorage.setItem(PROTO_PICK_KEY, JSON.stringify(all)) : localStorage.removeItem(PROTO_PICK_KEY); } catch (e) {}
}

// ── The protocol screen (the picker overlay, like Stacked's start screen) ──
let _protoBase = 'flow', _protoSel = 'standard';
function protoOpen(baseId) {
  _protoBase = PROTOCOL_BASES.includes(baseId) ? baseId : 'flow';
  _protoSel = protoLastPick(_protoBase);
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  const ov = document.getElementById('picker-overlay');
  if (!ov) { protoStart(_protoBase, _protoSel); return; }
  ov.classList.add('show'); ov.classList.add('pk-proto');
  const title = document.getElementById('picker-title'), sub = document.getElementById('picker-sub');
  if (title) title.textContent = modeDisplayName(_protoBase);
  if (sub) sub.textContent = 'Choose a protocol';
  document.getElementById('picker-rail').innerHTML = `<button class="pk-rail-step on"><span class="pk-rail-n">1</span><span class="pk-rail-l">PROTOCOL</span></button>`;
  protoPaint();
}
function protoKey(id) { return 'proto:' + id; }
function protoPaint() {
  const body = document.getElementById('picker-body'), foot = document.getElementById('picker-foot');
  if (!body || !foot) return;
  const base = _protoBase, sel = protocolDef(_protoSel), selOpen = protoUnlocked(sel.id);
  body.innerHTML = `<div class="pk-q">Which protocol?</div>` +
    `<div class="pk-opts">` + PROTOCOLS.map(p => {
      const lv = difficultySetting(protoKey(p.id)), open = protoUnlocked(p.id);
      return `<button class="pk-opt${p.id === sel.id ? ' on' : ''}${open ? '' : ' pk-locked'}" data-opt="${p.id}" style="--pa:${p.accent}">` +
        `<div class="pk-opt-head"><span class="pk-opt-name">${p.name}</span><span class="pk-opt-tag">${open ? difficultyDollars(lv) : '\u{1F512}'}</span></div>` +
        `<div class="pk-opt-desc">${p.short}</div></button>`;
    }).join('') + `</div>` +
    `<div class="pk-proto-rules" style="--pa:${sel.accent}">${protocolSay(sel.id, base)}</div>` +
    (selOpen
      ? `<div class="pk-proto-diff" style="--mode-accent:${sel.accent}">${modeDiffHTML(protoKey(sel.id), base)}</div>` +
        `<div class="pk-note pk-proto-note">Difficulty belongs to the protocol: a win in Flow or the Schedule unlocks the next tier for both.${protoKnackLine(sel.id)}</div>`
      : `<div class="pk-note pk-proto-note pk-proto-lock">\u{1F512} Win a run of ${protocolDef(protoBefore(sel.id)).name}, in Flow or the Schedule, to unlock ${sel.name}.</div>`);
  body.querySelectorAll('.pk-opt').forEach(b => { b.onclick = () => { _protoSel = b.dataset.opt; if (protoUnlocked(_protoSel)) protoSavePick(base, _protoSel); protoPaint(); }; });
  const dv = body.querySelector('.pk-proto-diff');
  if (dv) {
    modeDiffBind(dv, protoKey(sel.id), base);
    // The chosen protocol's $ tag follows the tier keys.
    dv.addEventListener('click', () => { const tg = body.querySelector(`.pk-opt[data-opt="${sel.id}"] .pk-opt-tag`); if (tg) tg.textContent = difficultyDollars(difficultySetting(protoKey(sel.id))); });
  }
  foot.innerHTML = `<button class="pk-btn pk-back">CANCEL</button><div class="pk-sum">${modeDisplayName(base)} · ${sel.name}</div><button class="pk-btn pk-next go${selOpen ? '' : ' pk-off'}">START RUN</button>`;
  foot.querySelector('.pk-back').onclick = () => { protoClose(); document.getElementById('mode-select-overlay')?.classList.add('show'); };
  foot.querySelector('.pk-next').onclick = () => {
    if (!selOpen) { if (typeof refuse === 'function') { try { refuse(); } catch (e) {} } return; }
    protoClose(); protoStart(base, sel.id);
  };
}
function protoKnackLine(id) {
  const k = PROTO_KNACKS.find(x => x.protocol === id);
  if (!k) return '';
  const row = KNACK_POOL.find(x => x.id === k.id);
  return protoKnackUnlocked(k.id) ? ` Its Knack, ${row ? row.name : k.id}, is unlocked.` : ' Win a run to unlock its Knack.';
}
function protoClose() {
  const ov = document.getElementById('picker-overlay');
  if (ov) { ov.classList.remove('show'); ov.classList.remove('pk-proto'); }
  const title = document.getElementById('picker-title'); if (title) title.textContent = 'BUILD A MODE';
}
function protoStart(baseId, protoId) {
  ACTIVE_MODE = protocolMode(baseId, protoId);
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  document.getElementById('mode-select-overlay')?.classList.remove('show');
  startGame();
}

// ══════════════════════════════════════════════
// PRECISION
// ══════════════════════════════════════════════
const PRECISION = {
  speedStrength: 0.5,  // the speed bonus is half as strong...
  speedFlat: 10,       // ...the same from 0 to 10 seconds after the last hand...
  speedFade: 20,       // ...then fades to nothing over the next 20 seconds
  focusAdd: 2,         // every hand but a Pair makes 2 more Focus
  sizeStep: 2,         // -2 Focus for every card a hand is short of the Hand Size
  lossCap: 5,          // r749: a hand loses 5 Focus at most
  swaps: 2, discards: 2, cols: 1,
  flowSeconds: 120,    // Flow: every quarter's clock is 2 minutes longer
  mapSeconds: 60,      // the Schedule: every round is 1 minute longer
};
function precisionOn() { return !!ACTIVE_MODE && ACTIVE_MODE.precision === true; }
// The flat speed bonus: Precision itself, or its Knack.
function precisionSpeedOn() { return precisionOn() || (typeof hasKnack === 'function' && hasKnack('measure_twice')); }
// `formula0` is the ordinary formula's bonus at 0 seconds (speedBonusFromTime passes it).
function precisionSpeedBonus(t, formula0) {
  if (t === Infinity || !(t >= 0)) t = 0;
  const top = formula0 * PRECISION.speedStrength;
  if (t <= PRECISION.speedFlat) return top;
  return Math.max(0, top * (1 - (t - PRECISION.speedFlat) / PRECISION.speedFade));
}
// A hand's own Focus (HAND_FOCUS) under Precision: +2 unless it is a Pair, and -2
// for every card the hand is short of the Hand Size. `n` is the hand's length
// without kickers (a Pair with a kicker is a 2-card hand). Outside Precision the
// table's figure.
function handFocusValue(hand, n) {
  let f = HAND_FOCUS[hand] || 0;
  if (!precisionOn() || hand === 'High Card') return f;
  if (hand !== 'Pair') f += PRECISION.focusAdd;
  if (n == null) n = (typeof HAND_CARD_COUNT !== 'undefined' && HAND_CARD_COUNT[hand]) || 0;
  const size = (typeof limits !== 'undefined' && limits.selection) ? limits.selection.current : 3;
  return Math.max(-PRECISION.lossCap, f - PRECISION.sizeStep * Math.max(0, size - n));
}
// The scored cells' length without kickers.
function handLenNoKickers(cells) {
  if (!cells || !cells.length) return 0;
  let k = 0;
  try { k = (typeof handTagalongCells === 'function') ? (handTagalongCells(cells) || []).length : 0; } catch (e) { k = 0; }
  return Math.max(0, cells.length - k);
}
// Seconds added to every round (the Schedule) or every Flow quarter.
function precisionClockBonus() {
  if (!precisionOn()) return 0;
  return (typeof flowActive === 'function' && flowActive()) ? PRECISION.flowSeconds : PRECISION.mapSeconds;
}
function precisionSay(base) {
  const clock = base === 'flow' ? `Every quarter's clock is ${PRECISION.flowSeconds / 60} minutes longer.` : `Every round is ${PRECISION.mapSeconds / 60} minute longer.`;
  return `The speed bonus is half as strong but the same for the first ${PRECISION.speedFlat} seconds, then fades slowly. Every hand but a Pair makes ${PRECISION.focusAdd} more Focus, and loses ${PRECISION.sizeStep} for every card it is short of your Hand Size, ${PRECISION.lossCap} at most. Start with Meditation, Attention to Detail, +${PRECISION.swaps} swaps, +${PRECISION.discards} discards and +${PRECISION.cols} column. ${clock}`;
}

// ── Run start (startGame) ──
// Limits: after the rows are rebuilt, before swaps / discards / the board are read.
function protocolLimitsSetup() {
  if (typeof limits === 'undefined') return;
  // Limitless: every limit at its max. The base stays, so Flow's Focus cap reads the raise.
  if (limitlessOn()) { LIMITS_DEF.forEach(d => { const l = limits[d.id]; if (l && l.max > l.current) l.current = l.max; }); return; }
  if (!precisionOn()) return;
  const add = (id, n) => { const l = limits[id]; if (!l) return; l.current += n; l.base += n; if (l.max < l.current) l.max = l.current; };
  add('swaps', PRECISION.swaps); add('discards', PRECISION.discards); add('grid_cols', PRECISION.cols);
}
// Loadout: after acquiredKnacks is reset.
function protocolRunSetup() {
  if (typeof limitlessFlowFrom !== 'undefined') limitlessFlowFrom = Infinity;
  if (!precisionOn()) return;
  ['meditation', 'attention_to_detail'].forEach(id => {
    const k = KNACK_POOL.find(x => x.id === id);
    if (k && !hasKnack(id)) acquiredKnacks.push({ ...k });
  });
  if (typeof updateKnackList === 'function') updateKnackList();
  if (typeof recomputeFocusDecayInterval === 'function') recomputeFocusDecayInterval();
}

// ══════════════════════════════════════════════
// ATTENTION TO DETAIL (r749): Precision's starting Knack. Tricks that pay for a
// card's rank, suit, buffs, wildness or position (their tags: scope `card` and
// one of DETAIL_WHEN, or `line`) pay 50% more: every flat bonus x1.5, every
// x bonus's part above x1 x1.5. Applied in applyEntityTiers after the tiers
// (detailApply), so BAL stays the one number and descriptions read it.
// ══════════════════════════════════════════════
const DETAIL_MULT = 1.5;
const DETAIL_WHEN = new Set(['rank', 'suit', 'position', 'buffed', 'wild', 'line']);
// Counts and limits, not payouts: never scaled.
const DETAIL_SKIP = new Set(['swaps', 'discards', 'extra_replays', 'retrigger_count', 'cap_gain', 'focus_cap',
  'max_seconds', 'cap_bonus', 'chance_per', 'cells', 'lines', 'base', 'max']);
let _detailIds = null, _detailLast = false, _detailBusy = false;
function detailOn() { return typeof hasKnack === 'function' && hasKnack('attention_to_detail'); }
function detailQualifies(id) {
  if (!_detailIds) {
    _detailIds = new Set();
    (typeof TRICK_POOL_ALL !== 'undefined' ? TRICK_POOL_ALL : []).forEach(t => {
      const tg = t && t.tags; if (!tg || !tg.includes('card')) return;
      if (tg.some(x => DETAIL_WHEN.has(x))) _detailIds.add(t.id);
    });
  }
  return _detailIds.has(id);
}
function detailBoosted(id) { return detailOn() && detailQualifies(id); }
function detailApply() {
  if (!detailOn() || typeof BAL === 'undefined') return;
  const r2 = v => Math.round(v * 100) / 100;
  Object.keys(BAL).forEach(id => {
    if (!detailQualifies(id) || !BAL[id]) return;
    const row = BAL[id];
    for (const k in row) {
      const v = row[k];
      if (typeof v !== 'number' || DETAIL_SKIP.has(k) || /chance/.test(k)) continue;
      if (IMPROVE_MUL.has(k)) { if (v > 1) row[k] = r2(1 + (v - 1) * DETAIL_MULT); }
      else if (IMPROVE_ADD.has(k)) row[k] = (Number.isInteger(v) && Math.abs(v) >= 2) ? Math.round(v * DETAIL_MULT) : r2(v * DETAIL_MULT);   // whole bonuses stay whole
    }
  });
}
// The Knack gained or lost: BAL is rebuilt (updateKnackList calls this).
function detailSync() {
  if (_detailBusy) return;
  const on = detailOn();
  if (on === _detailLast) return;
  _detailLast = on; _detailBusy = true;
  try { if (typeof applyEntityTiers === 'function') applyEntityTiers(); } finally { _detailBusy = false; }
}

// ══════════════════════════════════════════════
// LIMITLESS (r749): every limit at its max, fewer rewards, a harder back half.
//   Flow       one reward a level-up; every pick shows 2 options
//   Schedule   picks show 2 options; an audit pays one card fewer; the Balance
//              Sheet and the Benefits Package have holes among their rewards
//              (1 or 2 in every 4); goals doubled from Q3
//   Flow       goals doubled once 2 bosses are beaten, bosses 3 and 4 too (r750)
// ══════════════════════════════════════════════
const LIMITLESS = { options: 2, backMult: 2 };
let limitlessFlowFrom = Infinity;   // Flow: the level the back half began at (SAVE_VARS)
let _limBossGoal = false;           // set while Flow's boss goal is computed
function limitlessOn() { return !!ACTIVE_MODE && ACTIVE_MODE.limitless === true; }
function limitlessSay(base) {
  return base === 'flow'
    ? `Every limit starts at its max. One reward a level-up, and every pick shows ${LIMITLESS.options} options. After the second boss, goals are doubled.`
    : `Every limit starts at its max. Every pick shows ${LIMITLESS.options} options, an audit pays one card fewer, and the ${gridName('reward', { bare: true })} and ${gridName('prize', { bare: true })} have holes among their rewards. From Q3, goals are doubled.`;
}
// Every pick of three is a pick of two (openGridPick, gridPickRefresh). A forced
// penalty pick keeps its three.
function protoTrimOffers(offers) {
  if (!limitlessOn() || !Array.isArray(offers) || offers.length <= LIMITLESS.options) return offers;
  if (offers.some(o => o && (o.type === 'penalty' || o.rarity === 'penalty'))) return offers;
  return offers.slice(0, LIMITLESS.options);
}
// Back-half goals are `backMult` (2) times what they would be. The Schedule's back
// half is Q3 on; Flow's is after the second boss (its level goals from the level
// it was beaten at; bosses 3 and 4, read from the boss table's levels).
function limitlessGoalMult(lv, scale) {
  if (!limitlessOn() || !(scale > 1)) return 1;
  let from = Infinity;
  if (typeof mapActive === 'function' && mapActive() && typeof mapQuarterLen === 'function') from = 2 * mapQuarterLen();
  else if (typeof flowActive === 'function' && flowActive()) {
    if (_limBossGoal) from = (typeof survivalBossesBeaten === 'number' && survivalBossesBeaten >= 2) ? FLOW_BOSS_GOAL_LEVELS[1] : Infinity;
    else from = limitlessFlowFrom;
  }
  // r750 (owner): a flat x2 on the back half's goals (r749 doubled the growth rate, which compounded).
  return lv > from ? LIMITLESS.backMult : 1;
}
// Flow: the back half starts when the second boss falls (survivalBossBookkeeping).
function limitlessOnBoss() {
  if (limitlessOn() && typeof survivalBossesBeaten === 'number' && survivalBossesBeaten === 2 && limitlessFlowFrom === Infinity) limitlessFlowFrom = level;
}
// Holes in the reward tiles: of every 4 reward tiles (in a random order), 1 or 2
// are holes, never a guaranteed tile or the destination; a last group of 2 or 3
// takes 1. A hole is not drawn as a reward and cannot be picked (rewardHidden).
function limitlessHoles(cells) {
  if (!limitlessOn() || !(typeof mapActive === 'function' && mapActive())) return;
  if (!(rewardGridMode === 'normal' || rewardGridMode === 'prize')) return;
  const pool = [];
  cells.forEach((row, r) => row.forEach((cell, c) => { if (cell && cell.kind === 'buff' && !(cell.payload && cell.payload._guaranteed)) pool.push(cell); }));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  for (let g = 0; g < pool.length; g += 4) {
    const grp = pool.slice(g, g + 4);
    const n = grp.length === 4 ? (Math.random() < 0.5 ? 1 : 2) : grp.length >= 2 ? 1 : 0;
    for (let k = 0; k < n; k++) grp[k].hole = true;
  }
}
// An audit (a challenge round) pays one card fewer: the first card that would pay
// pays nothing (crrPayCard). Returns true when this card is the one.
function limitlessSkipCardPay(q) {
  if (!limitlessOn() || !q || q.src !== 'seq' || typeof crRound === 'undefined' || !crRound) return false;
  if (crRound._limSkip) return false;
  crRound._limSkip = true;
  return true;
}

// ══════════════════════════════════════════════
// HYPERFOCUS (r749): every Focus made is doubled (addFocus); Focus fades 3x as
// fast (focusDecayIntervalNow). The caps are the usual ones.
// ══════════════════════════════════════════════
const HYPERFOCUS = { gain: 2, decay: 3 };
function hyperfocusOn() { return !!ACTIVE_MODE && ACTIVE_MODE.hyperfocus === true; }

// ══════════════════════════════════════════════
// PROTOCOL KNACKS: winning a run of a protocol unlocks its Knack for every run
// ══════════════════════════════════════════════
// Never offered while locked, nor in its own protocol (it would change nothing).
const PROTO_KNACKS = [
  { id: 'ambidextrous',  protocol: 'dexterous' },
  { id: 'measure_twice', protocol: 'precision' },
  { id: 'growth_mindset', protocol: 'limitless' },   // r750
];
// Growth Mindset (r750, working name): limit rewards twice as common in every
// reward roll (Flow's chain, the pick of three, the Balance Sheet, the shop's shelf).
// The owner's other idea, a second random limit on every limit raise, is Knock-On.
function limitOfferMult() { return (typeof hasKnack === 'function' && hasKnack('growth_mindset')) ? 2 : 1; }
const PROTO_KNACK_KEY = 'lethe.protocolKnacks.v1';
function _protoKnackSet() { try { const a = JSON.parse(localStorage.getItem(PROTO_KNACK_KEY) || '[]'); return new Set(Array.isArray(a) ? a : []); } catch (e) { return new Set(); } }
function protoKnackUnlocked(id) { return _protoKnackSet().has(id); }
function protoKnackLocked(id) { return PROTO_KNACKS.some(k => k.id === id) && !protoKnackUnlocked(id); }
function protoKnackBanned(id) {
  const k = PROTO_KNACKS.find(x => x.id === id);
  if (!k) return false;
  return !protoKnackUnlocked(id) || activeProtocol() === k.protocol;
}
// onGameWin: a won run of a protocol unlocks its Knack (tours and test drives never count).
function protocolOnWin() {
  if (typeof unlockPaused === 'function' && unlockPaused()) return;
  if (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE && PROTOCOL_BASES.includes(ACTIVE_MODE.id)) {
    const won = _protoWinSet(), id = activeProtocol(), wasOpen = PROTOCOLS.filter(p => protoUnlocked(p.id)).map(p => p.id);
    if (!won.has(id)) { won.add(id); try { localStorage.setItem(PROTO_WIN_KEY, JSON.stringify([...won])); } catch (e) {} }
    PROTOCOLS.forEach(p => { if (!wasOpen.includes(p.id) && protoUnlocked(p.id)) showMessage(`UNLOCKED: ${p.name} protocol`, 'var(--gold)', { svgIcon: 'unlock', icon: '\u{1F513}' }); });
  }
  const k = PROTO_KNACKS.find(x => x.protocol === activeProtocol());
  if (!k || protoKnackUnlocked(k.id)) return;
  const set = _protoKnackSet(); set.add(k.id);
  try { localStorage.setItem(PROTO_KNACK_KEY, JSON.stringify([...set])); } catch (e) {}
  const row = KNACK_POOL.find(x => x.id === k.id);
  showMessage(`UNLOCKED: ${row ? row.name : k.id} · Knack`, 'var(--gold)', { svgIcon: 'unlock', icon: '🔓' });
}
// Dev: unlock both.
function protoKnacksUnlockAll() { try { localStorage.setItem(PROTO_KNACK_KEY, JSON.stringify(PROTO_KNACKS.map(k => k.id))); } catch (e) {} }

// Ambidextrous: Sleights are cards (the Dexterous rules), twice as common in rewards.
function ambidextrousOn() { return typeof hasKnack === 'function' && hasKnack('ambidextrous'); }
