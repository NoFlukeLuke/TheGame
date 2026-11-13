// ═══════════════════════════════════════════════════════════════════════════
// THE CASCADE (r773) - one runner for everything that plays hands for you
// ═══════════════════════════════════════════════════════════════════════════
// Owner: Overdrive, Autopilot and All Hands should "work like a match 3 game
// would, where the cards they're auto playing get selected and scored in a
// noticeable dramatic way and they fly to the preview in rapid succession."
//
// A cascade is a run of hands the game plays itself. Each hand is one step:
//   1. PICK   its cards are picked one at a time, fast, each with a pop and a
//             note that climbs
//   2. HIT    the cards flash, a ring bursts out of the hand and its tag pops
//             over it (HAND 2, x2.0 MULT, FOCUS x3...)
//   3. PLAY   the real playHand. The cards fly to the preview: the first hand
//             is tallied there, every later one joins the scoring queue behind
//             it (js/score-dance.js), which runs faster the deeper it is
//   4. FALL   the board falls, and the next hand is picked as soon as it lands
// So hands are never waited on one at a time: they leave the board as fast as
// it can fall, and the tally catches up behind them.
//
// While a cascade runs the board is its own (taps, PLAY, DISCARD and SWAP are
// off: cascadeRunning()), the board wears a frame in the cascade's colour with
// its name and hand count, and a banner names it before the first hand.
//
// A cascade is a spec:
//   name, title, color      which one, what the board prints, its colour
//   sub()                   the banner's small line
//   intro(run)              async, before the first hand (All Hands lights its hands)
//   next(k)                 the cells of hand k, 'wait' to ask again, or null to stop
//   label(k)                the tag that pops over hand k
//   hue(k)                  optional: a hue for hand k's ring and tag
//   begin(k, cells)         just before hand k is played: charge its cost here
//   play(k)                 optional: how to call playHand (default: playHand())
//   after(k, played)        after it; return false to stop
//   end(k)                  the run is over (k hands were played)
//   holdFall                the board does not fall between hands (fallHoldOn is the caller's)
// ═══════════════════════════════════════════════════════════════════════════

const CAS_CFG = {
  bannerMs: 640,        // the name on the board before the first hand
  pickMs: [110, 52],    // a card's pick beat: on hand 1, and from hand 5 on
  hitMs: 200,           // the hit, before the cards fly
  gapMs: 60,            // after the fall lands
  heldGapMs: 140,       // fall held (All Hands): between hands
  pollMs: 50,
  stallMs: 20000,       // a board that never comes free ends the run
  queueMax: 7,          // hands waiting behind the one scoring (a played hand's cap is 4)
  fallK: 0.42,          // the fall's length while a cascade runs, against the usual (js/card-fall.js)
  fallStag: 0.3,        // and how far into one card's fall the next in its column starts (0.6 usually)
};

let _casRun = null;        // { spec, k, miss } while a cascade runs
let _casPlaying = false;   // true while the cascade itself is inside playHand

function cascadeRunning() { return !!_casRun; }
function cascadePlaying() { return _casPlaying; }
function cascadeIs(name) { return !!_casRun && _casRun.spec.name === name; }
function cascadeQueueMax() { return CAS_CFG.queueMax; }

function _casLerp(pair, t) { return pair[0] + (pair[1] - pair[0]) * Math.max(0, Math.min(1, t)); }
// The beats follow Settings -> Motion -> Animation speed, within reason: a cascade is meant to be quick.
function _casK() { const s = (typeof animSlow === 'function') ? animSlow() : 1; return Math.max(0.6, Math.min(1.35, s)); }
function _casStill() { return document.body.classList.contains('reduced-motion'); }
// Pausable (the pause menu and RECORDS hold it, like the tally).
function _casWait(ms) { return (typeof dncWait === 'function') ? dncWait(ms) : new Promise(r => setTimeout(r, ms)); }

function _casReady(run) {
  if (animating || isPaused || gameTimerPaused) return false;
  if (typeof dealPhase !== 'undefined' && dealPhase) return false;
  if (typeof sleightSpinLock !== 'undefined' && sleightSpinLock) return false;
  if (!run.spec.holdFall && falling) return false;
  if (typeof dncQueueFull === 'function' && dncQueueFull()) return false;
  if (typeof improveAnimRunning === 'function' && improveAnimRunning()) return false;
  if (typeof flowBossFighting !== 'undefined' && flowBossFighting && !bossActive) return false;   // Flow's boss is arriving: playHand refuses
  if (typeof bossJumpRunning === 'function' && bossJumpRunning()) return false;
  return true;
}

// The best hand on the board, asked again a few times when the search ran out of
// budget before it could call the board empty (js/autopilot.js).
function cascadeFindHand(state) {
  const cells = autopilotBestHand();
  if (cells) { state.retry = 0; return cells; }
  if (autopilotBestHand.exhausted && (state.retry = (state.retry || 0) + 1) <= 3) return 'wait';
  return null;
}

function cascadeStart(spec) {
  if (_casRun) return false;
  const run = _casRun = { spec, k: 0, miss: 0 };
  selected = []; swapPending = null;
  if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  document.body.classList.add('autoplay-loud', 'cas-on');
  casFrameOn(run);
  dbgEvent('info', 'cascade start: ' + spec.name);
  _casLoop(run).catch(e => { console.error('[CASCADE]', e); }).then(() => _casEnd(run));
  return true;
}

async function _casLoop(run) {
  const spec = run.spec;
  const live = () => _casRun === run && !roundEnded;
  casBanner(run, spec.title, spec.sub ? spec.sub() : '');
  sfxCascadeStart();
  await _casWait(CAS_CFG.bannerMs * _casK());
  if (!live()) return;
  if (spec.intro) { await spec.intro(run); if (!live()) return; }
  let stallAt = 0;
  while (live()) {
    if (!_casReady(run)) {
      if (!isPaused && !gameTimerPaused) { stallAt = stallAt || performance.now(); if (performance.now() - stallAt > CAS_CFG.stallMs) { dbgEvent('warn', 'cascade stalled: ' + spec.name); return; } }
      else stallAt = 0;
      await _casWait(CAS_CFG.pollMs); continue;
    }
    stallAt = 0;
    const k = run.k + 1;
    const cells = spec.next(k);
    if (cells === 'wait') { await _casWait(100); continue; }
    if (!cells || !cells.length) return;
    const ids = cells.map(([r, c]) => gridData[r]?.[c]?._id);
    const hue = spec.hue ? spec.hue(k) : null;
    casTag(run, k);
    // 1. PICK
    selected = [];
    const pm = _casLerp(CAS_CFG.pickMs, (k - 1) / 4) * _casK();
    for (let i = 0; i < cells.length; i++) {
      if (!live()) return;
      selected = [...selected, cells[i]];
      render();
      casPickFx(cells[i], i, k, hue);
      await _casWait(pm);
    }
    if (!live()) return;
    // 2. HIT
    casHitFx(run, cells, k, hue);
    await _casWait(CAS_CFG.hitMs * _casK());
    // Something else may have taken the board for a moment (a boss effect, a horseman).
    while (live() && animating) await _casWait(CAS_CFG.pollMs);
    if (!live()) return;
    // The cells must still hold the cards that were picked; if not, look again.
    if (cells.some(([r, c], i) => gridData[r]?.[c]?._id !== ids[i])) { selected = []; render(); if (++run.miss > 3) return; continue; }
    // 3. PLAY
    if (spec.begin) spec.begin(k, cells);
    run.k = k;
    selected = cells.map(c => [...c]);
    // Every cascade hand is tallied at the SPEED UP pace, and the preview's key reads SKIP for the lot (r734's carry).
    if (typeof dncCarry !== 'undefined') dncCarry = Math.max(dncCarry, 1);
    const before = handsPlayed;
    _casPlaying = true;
    try { if (spec.play) spec.play(k); else playHand(); }
    catch (e) { console.error('[CASCADE] play', e); }
    finally { _casPlaying = false; }
    const played = handsPlayed > before;
    if (!played) { selected = []; if (!animating && !roundEnded) { try { render(); } catch (e) {} } }
    if (spec.after && spec.after(k, played) === false) return;
    if (!played && ++run.miss > 3) return;
    // 4. FALL: the next pass waits for it (or, held, for the beat between hands)
    await _casWait((spec.holdFall ? CAS_CFG.heldGapMs : CAS_CFG.gapMs) * _casK());
  }
}

function _casEnd(run) {
  if (_casRun !== run) return;
  _casRun = null; _casPlaying = false;
  document.body.classList.remove('autoplay-loud', 'cas-on');
  casFrameOff();
  dbgEvent('info', 'cascade end: ' + run.spec.name + ' after ' + run.k);
  if (!roundEnded) selected = [];
  try { if (run.spec.end) run.spec.end(run.k); } catch (e) { console.error('[CASCADE] end', e); }
  if (!animating && !falling && !roundEnded) { try { render(); } catch (e) {} }
}
// A new run (startGame): whatever was running is dropped, nothing is paid or announced.
function cascadeReset() {
  _casRun = null; _casPlaying = false;
  document.body.classList.remove('autoplay-loud', 'cas-on');
  casFrameOff();
  document.getElementById('cas-banner')?.remove();
}

// ── What it looks like ─────────────────────────────────────────────────────
// Everything is a child of #grid (design px, under the screen door, inside the
// board's clip in console mode). render() leaves them alone: it only reconciles
// [data-card-id] elements.
function _casGrid() { return document.getElementById('grid'); }
function _casCardEl(cell) {
  const card = gridData[cell[0]]?.[cell[1]]; if (!card) return null;
  return _casGrid()?.querySelector(`[data-card-id="${card._id}"]`) || null;
}
function _casColor(run, hue) { return hue != null ? `hsl(${hue} 92% 64%)` : (run.spec.color || '#ffd36a'); }

function casFrameOn(run) {
  const g = _casGrid(); if (!g) return;
  let f = document.getElementById('cas-frame');
  if (!f) { f = document.createElement('div'); f.id = 'cas-frame'; f.innerHTML = '<div class="cas-tag"></div>'; }
  g.appendChild(f);
  g.style.setProperty('--cas-c', run.spec.color || '#ffd36a');
  f.querySelector('.cas-tag').textContent = run.spec.title;
}
function casFrameOff() {
  document.getElementById('cas-frame')?.remove();
  const g = _casGrid(); if (g) g.style.removeProperty('--cas-c');
  g?.querySelectorAll('.cas-ring, .cas-pop, .cas-spark').forEach(el => el.remove());
}
function casTag(run, k) {
  const t = document.querySelector('#cas-frame .cas-tag'); if (!t) return;
  t.textContent = `${run.spec.title} · HAND ${k}`;
  if (!_casStill()) { try { t.animate([{ scale: '1.25', filter: 'brightness(1.8)' }, { scale: '1', filter: 'none' }], { duration: 220, easing: 'ease-out' }); } catch (e) {} }
}
function casBanner(run, title, sub) {
  const g = _casGrid(); if (!g) return;
  let el = document.getElementById('cas-banner');
  if (!el) { el = document.createElement('div'); el.id = 'cas-banner'; }
  g.appendChild(el);
  el.style.setProperty('--cas-c', run.spec.color || '#ffd36a');
  el.innerHTML = `<div class="cb-k"></div><div class="cb-l"></div>`;
  el.querySelector('.cb-k').textContent = sub || '';
  el.querySelector('.cb-l').textContent = '> ' + title;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(casBanner._t);
  casBanner._t = setTimeout(() => el.remove(), 1500);
}

// A card is picked: it jumps at you and settles into the loud selected look.
function casPickFx(cell, i, k, hue) {
  sfxCascadePick(i + (k - 1));
  const el = _casCardEl(cell); if (!el) return;
  if (hue != null) el.style.setProperty('--cas-h', `hsl(${hue} 92% 64%)`); else el.style.removeProperty('--cas-h');
  if (_casStill()) return;
  try { el.animate([{ scale: '1.34', filter: 'brightness(2.4)' }, { scale: '.96', filter: 'brightness(1.3)', offset: .6 }, { scale: '1', filter: 'brightness(1)' }], { duration: 190, easing: 'cubic-bezier(.2,.8,.3,1)' }); } catch (e) {}
}

// The hit: the whole hand flashes, a ring and sparks burst from its middle, its tag pops.
function casHitFx(run, cells, k, hue) {
  try { sfxOverdriveHit(Math.min(k, 13)); } catch (e) {}
  const g = _casGrid(); if (!g) return;
  const els = cells.map(_casCardEl).filter(Boolean);
  if (!els.length) return;
  const col = _casColor(run, hue);
  // the hand's middle and reach, in the board's own px (offsets are immune to the zoom)
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  els.forEach(el => { x0 = Math.min(x0, el.offsetLeft); y0 = Math.min(y0, el.offsetTop); x1 = Math.max(x1, el.offsetLeft + el.offsetWidth); y1 = Math.max(y1, el.offsetTop + el.offsetHeight); });
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, reach = Math.max(x1 - x0, y1 - y0);
  const still = _casStill();
  if (!still) els.forEach(el => { try { el.animate([{ scale: '1', filter: 'brightness(1)' }, { scale: '1.22', filter: 'brightness(3.2) saturate(.2)', offset: .3 }, { scale: '1.08', filter: 'brightness(1.5)' }], { duration: CAS_CFG.hitMs * _casK(), easing: 'ease-out', fill: 'forwards' }).finished.then(a => { try { a.cancel(); } catch (e) {} }, () => {}); } catch (e) {} });
  const put = (cls, w, h) => { const d = document.createElement('div'); d.className = cls; d.style.cssText = `left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;--cas-c:${col};`; g.appendChild(d); return d; };
  if (!still) {
    const ring = put('cas-ring', reach, reach);
    setTimeout(() => ring.remove(), 520);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + fxRandom() * .5, d = reach * (.55 + fxRandom() * .5);
      const sp = put('cas-spark', 4, 4);
      try { sp.animate([{ translate: '0 0', opacity: 1, scale: '1.6' }, { translate: `${(Math.cos(a) * d).toFixed(1)}px ${(Math.sin(a) * d).toFixed(1)}px`, opacity: 0, scale: '.5' }], { duration: 380 + fxRandom() * 160, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' }); } catch (e) {}
      setTimeout(() => sp.remove(), 600);
    }
    const fr = document.getElementById('cas-frame');
    if (fr) { try { fr.animate([{ backgroundColor: `color-mix(in srgb, ${col} 26%, transparent)` }, { backgroundColor: 'transparent' }], { duration: 260, easing: 'ease-out' }); } catch (e) {} }
  }
  const text = run.spec.label ? run.spec.label(k) : `HAND ${k}`;
  if (text) {
    const pop = document.createElement('div'); pop.className = 'cas-pop'; pop.textContent = text;
    pop.style.cssText = `left:${cx}px;top:${cy}px;--cas-c:${col};`;
    g.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
  }
}

// ── Sounds (catalogued under Scoring in js/audio-assets.js) ─────────────────
// A pick: the card tap, and a short bright note a step up per card of the cascade.
const CAS_SCALE = [0, 2, 4, 7, 9];   // pentatonic, so any run of picks is in tune
function sfxCascadePick(n) {
  n = Math.max(0, n | 0);
  const semi = CAS_SCALE[n % 5] + 12 * Math.min(2, Math.floor(n / 5));
  try { sfxCardSelect(); } catch (e) {}
  playTone({ freq: 523.25 * Math.pow(2, semi / 12), type: 'square', gain: 0.045, attack: 0.002, decay: 0.04, sustain: 0.15, release: 0.08, duration: 0.07 });
}
// The cascade starting: a low thump and a fast rise.
function sfxCascadeStart() {
  playNoise({ gain: 0.07, attack: 0.001, release: 0.09 });
  playTone({ freq: 82, type: 'triangle', gain: 0.16, attack: 0.002, decay: 0.12, sustain: 0.2, release: 0.2, duration: 0.2 });
  [0, 4, 7, 12].forEach((s, i) => playTone({ freq: 261.6 * Math.pow(2, s / 12), type: 'square', gain: 0.05, attack: 0.003, decay: 0.05, sustain: 0.2, release: 0.1, duration: 0.09, delay: 0.06 + i * 0.07 }));
}

// ── The lab page: index.html?cascade ─────────────────────────────────────────
// A Classic run with the goal out of reach and three keys: each starts its cascade
// on the real board (Overdrive is given the Focus it spends, Autopilot and All
// Hands are put on the board as their own Sleight cards). Nothing is stored.
function cascadeLabOpen() {
  if (document.getElementById('cas-lab')) return;
  const p = document.createElement('div'); p.id = 'cas-lab';
  p.innerHTML = `<div class="bl-head">CASCADES</div>`
    + `<div class="bl-row"><button class="bl-b" data-cas="overdrive">OVERDRIVE</button><button class="bl-b" data-cas="autopilot">AUTOPILOT</button><button class="bl-b" data-cas="all_hands">ALL HANDS</button><button class="bl-b" onclick="location.href='index.html'">EXIT</button></div>`
    + `<div class="bl-note">Each key starts that one on the board. Wait for one to finish before the next.</div>`;
  document.body.appendChild(p);
  const put = id => {   // the Sleight, on the board's first ordinary cell
    const def = SLEIGHT_POOL.find(x => x.id === id); if (!def) return null;
    grantSleight(def);
    const i = drawPile.findIndex(c => c && c.sleightId === id); if (i < 0) return null;
    const card = drawPile.splice(i, 1)[0];
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
      const old = gridData[r]?.[c];
      if (!old || old._isSleight || old._isStone || isCellBlocked(r, c)) continue;
      gridData[r][c] = card; drawPile.push(old); render();
      return [card, r, c];
    }
    return null;
  };
  const start = id => {
    if (id === 'overdrive') {
      if (!hasKnack('overdrive')) { acquiredKnacks.push({ ...KNACK_POOL.find(k => k.id === 'overdrive') }); updateKnackList(); }
      overdriveCd = 0; addFocus(Math.max(0, 25 - focusNodes));
      overdriveStart();
    } else if (id === 'autopilot') {
      const at = put('autopilot'); if (!at) return;
      at[0]._apLanded = true; at[0]._apSecs = Math.max(0, (BAL.autopilot.delay_seconds || 30) - 3);   // 3s of its countdown left
      if (focusNodes < 12) addFocus(12 - focusNodes);
    } else {
      const at = put('all_hands'); if (!at) return;
      setTimeout(() => sweepStart(at[0], at[1], at[2]), 500);
    }
  };
  p.addEventListener('click', e => {
    const b = e.target.closest('[data-cas]'); if (!b) return;
    if (cascadeRunning() || animating || falling || roundEnded || p._busy) { if (typeof refuse === 'function') refuse('Wait for the board'); return; }
    const id = b.dataset.cas;
    // The deck comes back, and a board with no hand on it is dealt again first.
    try { flushPlayedDeck(); } catch (err) {}
    if (autopilotBestHand()) { start(id); return; }
    const cells = [];
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) { const cd = gridData[r]?.[c]; if (cd && cd.rank && !cd._isSleight && !cd._isStone && !isCellBlocked(r, c)) cells.push([r, c]); }
    p._busy = true;
    Promise.resolve(removeAndFall(cells, 'play')).catch(() => {}).then(() => setTimeout(() => { p._busy = false; start(id); }, 250));
  });
}
(function () {
  if (!/[?&]cascade\b/.test(location.search)) return;
  window.addEventListener('load', () => setTimeout(() => {
    try { window.insightsOn = () => false; } catch (e) {}   // no tips over the board (a tip holds the clock, and a cascade waits for the clock)
    try { devStartMode('normal'); } catch (e) { try { ACTIVE_MODE = MODES.normal; startGame(); } catch (e2) {} }
    setTimeout(() => {
      try { tutorialEnd(); } catch (e) {}
      cascadeLabOpen();
      setInterval(() => { try { if (!roundEnded) { roundGoal = Math.max(roundGoal, 1e9); if (typeof roundSeconds === 'number' && roundSeconds < 120) { roundSeconds = 599; roundStartSeconds = 599; updateClockUI?.(); } } } catch (e) {} }, 1000);
    }, 2500);
  }, 1200));
})();
