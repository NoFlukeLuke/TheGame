// ══════════════════════════════════════════════
// PROTOCOLS (r748, owner): the same run, a different rule set.
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
];
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

// The last protocol chosen for each base ({ flow: 'precision' }), overrides only.
const PROTO_PICK_KEY = 'lethe.protocol.v1';
function _protoPicks() { try { return JSON.parse(localStorage.getItem(PROTO_PICK_KEY) || '{}') || {}; } catch (e) { return {}; } }
function protoLastPick(base) { const id = _protoPicks()[base]; return PROTOCOLS.some(p => p.id === id) ? id : 'standard'; }
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
  const base = _protoBase, sel = protocolDef(_protoSel);
  body.innerHTML = `<div class="pk-q">Which protocol?</div>` +
    `<div class="pk-opts">` + PROTOCOLS.map(p => {
      const lv = difficultySetting(protoKey(p.id));
      return `<button class="pk-opt${p.id === sel.id ? ' on' : ''}" data-opt="${p.id}" style="--pa:${p.accent}">` +
        `<div class="pk-opt-head"><span class="pk-opt-name">${p.name}</span><span class="pk-opt-tag">${difficultyDollars(lv)}</span></div>` +
        `<div class="pk-opt-desc">${p.short}</div></button>`;
    }).join('') + `</div>` +
    `<div class="pk-proto-rules" style="--pa:${sel.accent}">${protocolSay(sel.id, base)}</div>` +
    `<div class="pk-proto-diff" style="--mode-accent:${sel.accent}">${modeDiffHTML(protoKey(sel.id), base)}</div>` +
    `<div class="pk-note pk-proto-note">Difficulty belongs to the protocol: a win in Flow or the Schedule unlocks the next tier for both.${protoKnackLine(sel.id)}</div>`;
  body.querySelectorAll('.pk-opt').forEach(b => { b.onclick = () => { _protoSel = b.dataset.opt; protoSavePick(base, _protoSel); protoPaint(); }; });
  const dv = body.querySelector('.pk-proto-diff');
  modeDiffBind(dv, protoKey(sel.id), base);
  // The chosen protocol's $ tag follows the tier keys.
  dv.addEventListener('click', () => { const tg = body.querySelector(`.pk-opt[data-opt="${sel.id}"] .pk-opt-tag`); if (tg) tg.textContent = difficultyDollars(difficultySetting(protoKey(sel.id))); });
  foot.innerHTML = `<button class="pk-btn pk-back">CANCEL</button><div class="pk-sum">${modeDisplayName(base)} · ${sel.name}</div><button class="pk-btn pk-next go">START RUN</button>`;
  foot.querySelector('.pk-back').onclick = () => { protoClose(); document.getElementById('mode-select-overlay')?.classList.add('show'); };
  foot.querySelector('.pk-next').onclick = () => { protoClose(); protoStart(base, sel.id); };
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
  return f - PRECISION.sizeStep * Math.max(0, size - n);
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
  return `The speed bonus is half as strong but the same for the first ${PRECISION.speedFlat} seconds, then fades slowly. Every hand but a Pair makes ${PRECISION.focusAdd} more Focus, and loses ${PRECISION.sizeStep} for every card it is short of your Hand Size. Start with Meditation, +${PRECISION.swaps} swaps, +${PRECISION.discards} discards and +${PRECISION.cols} column. ${clock}`;
}

// ── Run start (startGame) ──
// Limits: after the rows are rebuilt, before swaps / discards / the board are read.
function protocolLimitsSetup() {
  if (!precisionOn() || typeof limits === 'undefined') return;
  const add = (id, n) => { const l = limits[id]; if (!l) return; l.current += n; l.base += n; if (l.max < l.current) l.max = l.current; };
  add('swaps', PRECISION.swaps); add('discards', PRECISION.discards); add('grid_cols', PRECISION.cols);
}
// Loadout: after acquiredKnacks is reset.
function protocolRunSetup() {
  if (!precisionOn()) return;
  const k = KNACK_POOL.find(x => x.id === 'meditation');
  if (k && !hasKnack('meditation')) { acquiredKnacks.push({ ...k }); if (typeof updateKnackList === 'function') updateKnackList(); }
  if (typeof recomputeFocusDecayInterval === 'function') recomputeFocusDecayInterval();
}

// ══════════════════════════════════════════════
// PROTOCOL KNACKS: winning a run of a protocol unlocks its Knack for every run
// ══════════════════════════════════════════════
// Never offered while locked, nor in its own protocol (it would change nothing).
const PROTO_KNACKS = [
  { id: 'ambidextrous',  protocol: 'dexterous' },
  { id: 'measure_twice', protocol: 'precision' },
];
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
