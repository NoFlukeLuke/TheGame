// ══════════════════════════════════════════════
// THE RUN SCREEN (r783, owner): one amber console screen in place of the mode
// carousel and the protocol screen. Flow and the Schedule are the two ways a run
// progresses and the only choices left here; everything else is a PROTOCOL laid
// over either one (js/protocols.js), and from now on a new mode is built as a
// protocol, never as its own card. Classic, Custom, Stacked and Poker Squares
// are still whole and start from dev -> Modes (MODE_HIDDEN_LIST).
//
// It draws into #mode-select-inner (the overlay sits on the CRT, so no stage
// zoom) under #mode-select-overlay.rs-console. The mode, the protocol and its
// difficulty are chosen on one page; START RUN is protoStart.
// ══════════════════════════════════════════════
let _rsBase = null, _rsProto = 'standard';
// r799: the seed toggle. On, the run plays on the seed typed (blank rolls one).
let _rsSeedOn = false, _rsSeed = '';
const RS_BASE_KEY = 'lethe.runBase.v1';   // the mode last started ('map' only: Flow is the default)

function runSelectBases() { return PROTOCOL_BASES.filter(id => MODES[id]); }
function rsLastBase() { try { const v = localStorage.getItem(RS_BASE_KEY); return runSelectBases().includes(v) && modeUnlocked(v) ? v : 'flow'; } catch (e) { return 'flow'; } }
function rsSaveBase(id) { try { id === 'flow' ? localStorage.removeItem(RS_BASE_KEY) : localStorage.setItem(RS_BASE_KEY, id); } catch (e) {} }

function runSelectOpen(baseId) {
  _rsBase = runSelectBases().includes(baseId) ? baseId : rsLastBase();
  _rsProto = protoLastPick(_rsBase);
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  document.getElementById('picker-overlay')?.classList.remove('show');
  runSelectRender();
  document.getElementById('mode-select-overlay')?.classList.add('show');
}
function rsBox(on, lock) { return lock ? '[#]' : on ? '[x]' : '[ ]'; }
function runSelectRender() {
  const ov = document.getElementById('mode-select-overlay'), inner = document.getElementById('mode-select-inner');
  if (!ov || !inner) return;
  ov.classList.add('rs-console');
  if (!_rsBase) { _rsBase = rsLastBase(); _rsProto = protoLastPick(_rsBase); }
  const base = _rsBase, sel = protocolDef(_rsProto), selOpen = protoUnlocked(sel.id) && modeUnlocked(base);
  const modes = runSelectBases().map(id => {
    const meta = MODE_META[id] || {}, open = modeUnlocked(id), on = id === base;
    return `<button class="rs-mode${on ? ' on' : ''}${open ? '' : ' rs-locked'}" data-mode="${id}">` +
      `<b>${rsBox(on, !open)} ${modeDisplayName(id).toUpperCase()}</b>` +
      `<i>${open ? (meta.suits || '') : 'LOCKED'}</i>` +
      `<span>${open ? (meta.blurb || MODES[id].desc || '') : `Finish a run of ${modeDisplayName(modeUnlockedBy(id))} to unlock.`}</span></button>`;
  }).join('');
  const protos = protocolsFor(base).map(p => {
    const open = protoUnlocked(p.id), on = p.id === sel.id;
    return `<button class="rs-proto${on ? ' on' : ''}${open ? '' : ' rs-locked'}" data-proto="${p.id}">` +
      `<b>${rsBox(on, !open)} ${p.name.toUpperCase()}</b>` +
      `<i>${open ? difficultyDollars(difficultySetting(protoKey(p.id))) : 'LOCKED'}</i>` +
      `<span>${open ? p.short : ''}</span></button>`;
  }).join('');
  const lockSay = protoBefore(sel.id) && !sel.need ? `Win a run of ${protocolDef(protoBefore(sel.id)).name}, in Flow or the Schedule, to unlock ${sel.name}.` : 'Locked.';
  const more = (typeof infoTopic === 'function' && infoTopic('mode_' + base)) ? `<button class="rs-key rs-more">HANDBOOK</button>` : '';
  inner.innerHTML =
    `<div class="rs-screen">` +
      `<div class="rs-head">&gt; NEW RUN<em class="rs-cur"></em></div>` +
      `<div class="rs-body">` +
        `<div class="rs-sec"><div class="rs-label">MODE</div><div class="rs-modes">${modes}</div></div>` +
        `<div class="rs-sec"><div class="rs-label">PROTOCOL</div><div class="rs-protos">${protos}</div></div>` +
        `<div class="rs-rules">${selOpen ? protocolSay(sel.id, base) : lockSay}${_rsSeedOn ? '<span class="rs-seed-note">A seeded run unlocks nothing.</span>' : ''}</div>` +
        (selOpen
          ? `<div class="rs-sec"><div class="rs-label">DIFFICULTY</div><div class="rs-diff">${modeDiffHTML(protoKey(sel.id), base)}</div>` +
                `<div class="rs-note">Difficulty belongs to the protocol: a win in Flow or the Schedule unlocks the next tier for both.${protoKnackLine(sel.id)}</div></div>`
          : '') +
      `</div>` +
      `<div class="rs-keys"><button class="rs-key rs-back">BACK</button>${more}` +
        `<button class="rs-key rs-seed${_rsSeedOn ? ' on' : ''}" title="Play a seed someone shared">${rsBox(_rsSeedOn)} SEED</button>` +
        (_rsSeedOn ? `<input class="rs-seed-in" type="text" maxlength="16" spellcheck="false" autocomplete="off" autocapitalize="characters" placeholder="TYPE A SEED" value="${_rsSeed}">`
                   : `<div class="rs-sum">${modeDisplayName(base).toUpperCase()} · ${sel.name.toUpperCase()}</div>`) +
        `<button class="rs-key rs-go${selOpen ? '' : ' rs-off'}">START RUN</button></div>` +
    `</div>`;
  inner.querySelectorAll('.rs-mode').forEach(b => { b.onclick = () => {
    if (!modeUnlocked(b.dataset.mode)) { rsRefuse(); return; }
    _rsBase = b.dataset.mode; rsSaveBase(_rsBase);
    if (!protoUnlocked(_rsProto) || !protocolFits(_rsProto, _rsBase)) _rsProto = protoLastPick(_rsBase);
    rsClick(); runSelectRender();
  }; });
  inner.querySelectorAll('.rs-proto').forEach(b => { b.onclick = () => {
    _rsProto = b.dataset.proto;
    if (protoUnlocked(_rsProto)) protoSavePick(base, _rsProto);
    rsClick(); runSelectRender();
  }; });
  const dv = inner.querySelector('.rs-diff');
  if (dv) {
    modeDiffBind(dv, protoKey(sel.id), base);
    dv.addEventListener('click', () => { const tg = inner.querySelector(`.rs-proto[data-proto="${sel.id}"] i`); if (tg) tg.textContent = difficultyDollars(difficultySetting(protoKey(sel.id))); });
  }
  inner.querySelector('.rs-back').onclick = () => closeModeSelect();
  const mb = inner.querySelector('.rs-more'); if (mb) mb.onclick = () => openInfoHub('mode_' + base);
  inner.querySelector('.rs-go').onclick = () => {
    if (!selOpen) { rsRefuse(); return; }
    protoStart(base, sel.id, _rsSeedOn ? seedClean(_rsSeed) : '');
  };
  inner.querySelector('.rs-seed').onclick = () => { _rsSeedOn = !_rsSeedOn; rsClick(); runSelectRender(); if (_rsSeedOn) inner.querySelector('.rs-seed-in')?.focus(); };
  const si = inner.querySelector('.rs-seed-in');
  if (si) {
    si.oninput = () => { _rsSeed = seedClean(si.value); if (si.value !== _rsSeed) si.value = _rsSeed; };
    si.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') inner.querySelector('.rs-go').click(); };
  }
}
function rsClick() { try { if (typeof sfxKeyClick === 'function') sfxKeyClick('down'); } catch (e) {} }
function rsRefuse() { if (typeof refuse === 'function') { try { refuse(); } catch (e) {} } }
